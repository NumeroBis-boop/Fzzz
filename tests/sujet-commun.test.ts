import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Sujets communs « BDD générale flood » et « BDD générale chasse » (version
 * TEST, demande du mainteneur) : une section par joueur dans le premier
 * message, modifiable par tous les membres ; chaque partage écrit ses
 * changements dans la section de son joueur, vérifiés à la relecture, et
 * l'affichage ne lit que ces deux sujets. Joueurs inventés.
 */
const page = creerPage(
  ["js/class/Utils.js", "js/class/Requetes.js", "js/page/PartageChasses.js"],
  `var VERSION = "1.110.3";
   var heure = moment("2026-11-13 22:30:00", "YYYY-MM-DD HH:mm:ss").valueOf();
   var Horloge = { maintenant: () => heure, serveur: () => moment(heure), clic: () => moment(heure) };
   var monProfil = { pseudo: "Alpha" };
   var TOAST_INFO = {}, TOAST_SUCCESS = {}, TOAST_ERROR = {};
   var AttaqueLancee = { majPartages() {}, oublierPartage() {} };
   var FORUM = {};`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);
lire(`(() => {
  PartageChasses._html = (d) => d;
  // forum simulé : liste des sujets (case, titre, dernier message), premier message, modifications
  PartageChasses._xajax = (f, args) => {
    if (f == "callGetForum")
      return Promise.resolve('<form id="form_cat"><table>' + FORUM.sujets.map((s) =>
        '<tr><td><input name="topic[]" value="' + s.id + '"/></td><td>' + s.titre + '</td><td><b>X</b><br/>' + s.dernier + '</td></tr>').join("") + '</table></form>');
    if (f == "callGetTopic") {
      FORUM.lectures.push(String(args));
      FORUM.ordre.push("lu " + args);
      if (FORUM.echoue.includes(String(args))) return Promise.reject(new Error("forum"));
      const s = FORUM.sujets.find((s) => s.id == args);
      return Promise.resolve(s ? '<div class="messageForum">' + s.texte.replace(/\\n/g, "<br/>") + "</div>" : "");
    }
    if (f == "envoiEditTopic") {
      const q = String(args), id = q.match(/IDTopic=(\\d+)/)[1],
        sujet = decodeURIComponent(q.match(/sujet=([^&]*)/)[1]),
        message = decodeURIComponent(q.match(/message=([^&]*)/)[1]),
        s = FORUM.sujets.find((s) => s.id == id);
      FORUM.ecritures.push({ id, sujet, message, modifiable: /modifiable=envoyer/.test(q) });
      FORUM.ordre.push("écrit " + id);
      PartageChasses.oublierCache();
      if (s && !FORUM.refuse.includes(id)) {
        s.titre = sujet;
        s.texte = message;
        s.dernier = moment(heure).format("D MMM [à] H[h]mm");
      }
      return Promise.resolve("<xjx></xjx>");
    }
    // première page d'historique du joueur
    if (f == "envoiNouveauSujet") {
      FORUM.ordre.push("nouveau sujet");
      return FORUM.historiqueEchoue ? Promise.reject(new Error("forum")) : Promise.resolve("<xjx></xjx>");
    }
    return Promise.reject(new Error("inattendu " + f));
  };
  $.toast = () => {};
  // pause avant la vérification : un autre membre peut écrire pendant ce temps
  PartageChasses._attendre = () => (FORUM.pendant ? FORUM.pendant() : Promise.resolve());
})()`);

const ligne = (type: string, e: any) =>
  lire<string>(`PartageChasses._ligne(${JSON.stringify(type)}, ${JSON.stringify(e)})`);
const flood = (date: string, cible: string, id: number) => ({
  date,
  cible,
  unites: 1000,
  terrain: 1000,
  id,
});
const F11 = flood("2026-11-13 23:00", "Gamma", 11);
const F21 = flood("2026-11-13 23:10", "Alpha", 21);
const COMMUN_F = "BDD générale flood - NE RIEN ÉCRIRE";
const COMMUN_C = "BDD générale chasse - NE RIEN ÉCRIRE";
const regler = (quand: string) =>
  lire(`(() => { heure = moment(${JSON.stringify(quand)}, "YYYY-MM-DD HH:mm:ss").valueOf(); })()`);
const section = (pseudo: string, ecrit: string, lignes: string[]) =>
  [`--- ${pseudo} · ${ecrit} ---`, ...lignes].join("\n");

/** Section « BDD partagée cachée » : sujets communs et sujets des joueurs. */
function preparer(
  communFloods: string | null = section("Alpha", "2026-11-13 22:20:30", [ligne("Floods", F11)]),
) {
  const sujets = [
    { id: "1", titre: "Floods | Alpha", dernier: "13 nov. à 22h20", texte: ligne("Floods", F11) },
    { id: "2", titre: "Floods | Beta", dernier: "13 nov. à 22h25", texte: ligne("Floods", F21) },
    {
      id: "3",
      titre: "Chasses | Alpha",
      dernier: "13 nov. à 21h00",
      texte: ligne("Chasses", { date: "2026-11-13 23:30", terrain: 1500 }),
    },
    { id: "4", titre: "Convois | Alpha", dernier: "13 nov. à 21h00", texte: "rien" },
  ];
  if (communFloods != null)
    sujets.push({
      id: "10",
      titre: COMMUN_F,
      dernier: "13 nov. à 22h29",
      texte: "NE RIEN ÉCRIRE ICI\n" + communFloods,
    });
  sujets.push({ id: "11", titre: COMMUN_C, dernier: "13 nov. à 22h00", texte: "" });
  lire(`(() => {
    localStorage.clear();
    PartageChasses.idSection = "7";
    heure = moment("2026-11-13 22:30:00", "YYYY-MM-DD HH:mm:ss").valueOf();
    monProfil.pseudo = "Alpha";
    journalInstalle = true;
    Object.keys(COMPTE_REQUETES).forEach((k) => (COMPTE_REQUETES[k] = 0));
    FORUM = { sujets: ${JSON.stringify(sujets)}, lectures: [], ecritures: [], ordre: [], echoue: [], refuse: [], pendant: null };
  })()`);
}
const sujet = (id: string) => lire<any>(`FORUM.sujets.find((s) => s.id == ${JSON.stringify(id)})`);
const lectures = () => lire<string[]>(`FORUM.lectures.slice().sort()`);
const notes = (source = "Forum") =>
  lire<string[]>(
    `Journal.entrees().filter((e) => e.s == ${JSON.stringify(source)}).map((e) => e.m)`,
  );
async function charger(args = "") {
  lire(`(() => { PartageChasses.oublierCache(); FORUM.lectures.length = 0; })()`);
  return lire<Promise<any>>(
    `PartageChasses.charger(${args}).then((d) => JSON.parse(JSON.stringify(d)))`,
  );
}

describe("format du sujet commun", () => {
  test("titre reconnu sans tenir compte de la casse, des accents et de la suite", () => {
    const est = (titre: string, type: string) =>
      lire<boolean>(`PartageChasses.estCommun(${JSON.stringify(titre)}, ${JSON.stringify(type)})`);
    expect(est(COMMUN_F, "Floods")).toBe(true);
    expect(est("bdd GENERALE  flood (ne rien écrire)", "Floods")).toBe(true);
    expect(est(COMMUN_C, "Chasses")).toBe(true);
    expect(est(COMMUN_C, "Floods")).toBe(false);
    expect(est("Floods | BDD générale flood", "Floods")).toBe(false);
  });

  test("sections : en-tête « --- pseudo · heure --- », lignes, préambule gardé", () => {
    preparer();
    const texte = [
      "NE RIEN ÉCRIRE ICI",
      section("Beta", "2026-11-13 22:25:10", ["  " + ligne("Floods", F21) + "  ", ""]),
      section("Alpha", "2026-11-13 22:20:30", [ligne("Floods", F11)]),
    ].join("\n");
    const lu = lire<any>(`PartageChasses.sections(${JSON.stringify(texte)})`);
    expect(lu.preambule).toBe("NE RIEN ÉCRIRE ICI");
    expect(
      lu.sections.map((s: any) => [
        s.pseudo,
        s.ecrit,
        s.lignes.length,
        s.floods.map((f: any) => f.id),
      ]),
    ).toEqual([
      ["Beta", "2026-11-13 22:25:10", 1, [21]],
      ["Alpha", "2026-11-13 22:20:30", 1, [11]],
    ]);
    // réécrit : préambule, puis sections par pseudo
    expect(
      lire<string>(
        `PartageChasses.texteCommun(${JSON.stringify(lu.preambule)}, ${JSON.stringify(lu.sections)})`,
      ),
    ).toBe(
      [
        "NE RIEN ÉCRIRE ICI",
        section("Alpha", "2026-11-13 22:20:30", [ligne("Floods", F11)]),
        section("Beta", "2026-11-13 22:25:10", [ligne("Floods", F21)]),
      ].join("\n"),
    );
  });

  test("jamais vide : sans section ni préambule, une ligne neutre, retirée dès qu'une section revient", () => {
    expect(lire<string>(`PartageChasses.texteCommun("", [])`)).toBe("Aucun partage en cours.");
    expect(
      lire<string>(
        `PartageChasses.texteCommun("Aucun partage en cours.", [{ pseudo: "Alpha", ecrit: "2026-11-13 22:20:30", lignes: ["x"] }])`,
      ),
    ).toBe(section("Alpha", "2026-11-13 22:20:30", ["x"]));
  });

  test("la liste des sujets donne les sujets communs ; deux du même type : le plus ancien", async () => {
    preparer();
    lire(
      `(() => { FORUM.sujets.push({ id: "9", titre: "BDD générale flood - bis", dernier: "13 nov. à 22h00", texte: "" }); })()`,
    );
    const s = await lire<Promise<any>>(
      `PartageChasses.sujets().then((s) => JSON.parse(JSON.stringify(s.communs)))`,
    );
    expect([s.Floods.id, s.Floods.dernier, s.Chasses.id]).toEqual(["9", "X 13 nov. à 22h00", "11"]);
  });
});

describe("affichage : les sujets communs seulement", () => {
  test("chaque joueur vient de sa section ; les anciens sujets des joueurs ne sont jamais lus ; sans section, absent", async () => {
    preparer();
    const d = await charger();
    expect(lectures()).toEqual(["10", "11"]);
    expect(d.floods.map((f: any) => [f.lanceur, f.id])).toEqual([["Alpha", 11]]);
    // Beta n'a pas de section, ni Alpha dans le sujet commun des chasses
    expect(d.chasses).toEqual({});
  });

  test("sujet du joueur plus récent que sa section : la section reste ce qui est affiché", async () => {
    preparer();
    lire(`(() => {
      const s = FORUM.sujets.find((s) => s.id == "1");
      s.dernier = "13 nov. à 22h21";
      s.texte = ${JSON.stringify(ligne("Floods", flood("2026-11-13 23:40", "Delta", 12)))};
    })()`);
    const d = await charger();
    expect(lectures()).toEqual(["10", "11"]);
    expect(d.floods.map((f: any) => f.id)).toEqual([11]);
  });

  test("floods de tous les joueurs ; chasses seulement des joueurs suivis", async () => {
    preparer(
      [
        section("Alpha", "2026-11-13 22:20:30", [ligne("Floods", F11)]),
        section("Gamma", "2026-11-13 22:28:00", [
          ligne("Floods", flood("2026-11-13 23:50", "Beta", 31)),
        ]),
      ].join("\n"),
    );
    lire(
      `(() => { FORUM.sujets.find((s) => s.id == "11").texte = ${JSON.stringify(section("Gamma", "2026-11-13 22:28:00", [ligne("Chasses", { date: "2026-11-13 23:55", terrain: 900 })]))}; })()`,
    );
    const d = await charger();
    expect(d.floods.map((f: any) => [f.lanceur, f.id])).toEqual([
      ["Alpha", 11],
      ["Gamma", 31],
    ]);
    expect(Object.keys(d.chasses)).toEqual(["gamma"]);
    const suivi = await charger(`["Beta"]`);
    expect(Object.keys(suivi.chasses)).toEqual([]);
    expect(suivi.floods.map((f: any) => f.id)).toEqual([11, 31]);
  });

  test("deux sections d'un même joueur : la plus récente", async () => {
    preparer(
      [
        section("Alpha", "2026-11-13 22:10:00", [
          ligne("Floods", flood("2026-11-13 23:05", "Old", 9)),
        ]),
        section("Alpha", "2026-11-13 22:20:30", [ligne("Floods", F11)]),
      ].join("\n"),
    );
    const d = await charger();
    expect(d.floods.map((f: any) => f.id)).toEqual([11]);
  });

  test("sujet commun illisible : la lecture échoue (il manquerait des joueurs), aucun sujet de joueur lu", async () => {
    preparer();
    lire(`(() => { FORUM.echoue.push("10"); })()`);
    expect(
      await lire<Promise<string>>(
        `PartageChasses.charger().then(() => "lu", (e) => "échec : " + e.message)`,
      ),
    ).toBe("échec : forum");
    expect(lire<string[]>(`FORUM.lectures.filter((id) => !["10", "11"].includes(id))`)).toEqual([]);
  });

  test("pas de sujet commun d'un type dans la section : l'affichage échoue sans rien lire, noté au journal", async () => {
    preparer(null);
    expect(
      await lire<Promise<string>>(
        `PartageChasses.charger().then(() => "lu", (e) => "échec : " + e.message + " (" + e.titre + ")")`,
      ),
    ).toBe(`échec : sans sujet commun (${COMMUN_F})`);
    expect(lectures()).toEqual([]);
    expect(notes()).toContain(
      "pas de sujet « BDD générale flood - NE RIEN ÉCRIRE » dans la section : partages illisibles",
    );
  });

  test("chasses seules d'un joueur : seul le sujet commun des chasses est lu, jamais les sujets des joueurs ni des convois", async () => {
    preparer();
    await charger(`["Alpha"], false`);
    expect(lectures()).toEqual(["11"]);
  });

  test("sujet commun inchangé (même date) : gardé d'une page à l'autre", async () => {
    preparer();
    // 22:30:00 : le sujet commun, daté 22h29, est lu dans la minute qui suit sa date
    await charger();
    regler("2026-11-13 22:35:00");
    await charger();
    // une modification de 22:29:59 pourrait manquer à cette lecture : relu une fois
    expect(lectures()).toEqual(["10"]);
    regler("2026-11-13 22:40:00");
    await charger();
    expect(lectures()).toEqual([]);
    // lectures évitées, comptées pour la mesure du journal
    expect(lire<number>(`COMPTE_REQUETES.cache`)).toBeGreaterThan(0);
  });
});

describe("écriture de ma section", () => {
  const F12 = flood("2026-11-13 23:40", "Delta", 12);
  const F13 = flood("2026-11-13 23:50", "Delta", 13);
  /** Partage de floods : nombre de floods nouveaux, ou le code de l'erreur. */
  const partager = (entrees: any[]) =>
    lire<Promise<number | string>>(
      `PartageChasses._partager("Floods", ${JSON.stringify(entrees)}).then((n) => n, (e) => "échec : " + e.message)`,
    );
  const ecritures = () => lire<number>(`FORUM.ecritures.length`);
  const mesFloods = () =>
    lire<number[]>(
      `PartageChasses._mesEntrees("Floods", PartageChasses.sections(FORUM.sujets.find((s) => s.id == "10").texte).sections).map((f) => f.id).sort((a, b) => a - b)`,
    );
  /** Pendant la pause avant la vérification, `fois` fois : le sujet commun devient `texte(avant)`. */
  const pendant = (texte: string, fois = 1) =>
    lire(`(() => {
      const s = FORUM.sujets.find((s) => s.id == "10"), avant = s.texte;
      let n = 0;
      FORUM.pendant = () => {
        if (n++ < ${fois}) s.texte = (${texte})(avant, s.texte);
        return Promise.resolve();
      };
    })()`);

  test("partage : mes lignes ajoutées à ma section, celles des autres et le préambule gardés ; titre et case du sujet ; vérifié après la pause", async () => {
    preparer(
      [
        section("Alpha", "2026-11-13 22:20:30", [ligne("Floods", F11)]),
        section("Beta", "2026-11-13 22:25:10", ["13/11/26 23:10 | Alpha | 1 000 cm² | #21"]),
      ].join("\n"),
    );
    regler("2026-11-13 22:31:05");
    expect(await partager([F12])).toBe(1);
    const e = lire<any[]>(`FORUM.ecritures`);
    expect(e.map((x) => [x.id, x.sujet, x.modifiable])).toEqual([["10", COMMUN_F, true]]);
    expect(sujet("10").texte).toBe(
      [
        "NE RIEN ÉCRIRE ICI",
        section("Alpha", "2026-11-13 22:31:05", [ligne("Floods", F12), ligne("Floods", F11)]),
        section("Beta", "2026-11-13 22:25:10", ["13/11/26 23:10 | Alpha | 1 000 cm² | #21"]),
      ].join("\n"),
    );
    // rien à archiver : le sujet lu sert à l'écriture ; relu après la pause ; les anciens sujets des joueurs jamais touchés
    expect(lire<string[]>(`FORUM.ordre`)).toEqual(["lu 10", "écrit 10", "lu 10"]);
  });

  test("rien de nouveau à partager : ni écriture ni relecture", async () => {
    preparer();
    expect(await partager([F11])).toBe(0);
    expect(lire<string[]>(`FORUM.ordre`)).toEqual(["lu 10"]);
  });

  test("floods arrivés : vers mon historique, puis le sujet commun relu avant l'écriture", async () => {
    preparer(
      section("Alpha", "2026-11-13 22:20:30", [
        ligne("Floods", F11),
        ligne("Floods", flood("2026-11-13 22:25", "Gamma", 9)),
      ]),
    );
    regler("2026-11-13 22:31:05");
    expect(await partager([F12])).toBe(1);
    expect(lire<string[]>(`FORUM.ordre`)).toEqual([
      "lu 10",
      "nouveau sujet",
      "lu 10",
      "écrit 10",
      "lu 10",
    ]);
    expect(mesFloods()).toEqual([11, 12]);
  });

  test("historique illisible et rien de nouveau : les floods arrivés restent, rien n'est écrit", async () => {
    preparer(
      section("Alpha", "2026-11-13 22:20:30", [
        ligne("Floods", F11),
        ligne("Floods", flood("2026-11-13 22:25", "Gamma", 9)),
      ]),
    );
    lire(`(() => { FORUM.historiqueEchoue = true; console.warn = () => {}; })()`);
    expect(await partager([F11])).toBe(0);
    expect(lire<string[]>(`FORUM.ordre`)).toEqual(["lu 10", "nouveau sujet"]);
    expect(mesFloods()).toEqual([9, 11]);
  });

  test("flood annulé retiré ; plus rien à venir : ma section disparaît, le préambule reste", async () => {
    preparer();
    await lire(`PartageChasses._retirerFloods([11])`);
    expect(sujet("10").texte).toBe("NE RIEN ÉCRIRE ICI");
    expect(ecritures()).toBe(1);
  });

  test("ma section retirée puis remise par un membre qui avait lu avant : retirée de nouveau, noté au journal", async () => {
    preparer();
    pendant("(avant) => avant");
    await lire(`PartageChasses._retirerFloods([11])`);
    expect(ecritures()).toBe(2);
    expect(sujet("10").texte).toBe("NE RIEN ÉCRIRE ICI");
    expect(notes()).toContain(
      "« BDD générale flood - NE RIEN ÉCRIRE » : section écrite à l'essai 2 (sujet écrit au même moment par un autre membre ou appareil)",
    );
  });

  test("un autre membre réécrit le sujet lu avant mon écriture : la mienne est refaite, la sienne gardée", async () => {
    preparer(section("Beta", "2026-11-13 22:25:10", [ligne("Floods", F21)]));
    // Beta avait lu le sujet sans ma section et l'écrit pendant la pause, avec un flood de plus
    pendant(
      `(avant) => avant + "\\n" + ${JSON.stringify(ligne("Floods", flood("2026-11-13 23:20", "Gamma", 22)))}`,
    );
    expect(await partager([F11])).toBe(1);
    expect(ecritures()).toBe(2);
    const lu = lire<any>(`PartageChasses.sections(FORUM.sujets.find((s) => s.id == "10").texte)`);
    expect(lu.sections.map((s: any) => [s.pseudo, s.floods.map((f: any) => f.id)])).toEqual([
      ["Alpha", [11]],
      ["Beta", [21, 22]],
    ]);
  });

  test("défaite à chaque essai : trois essais, puis l'erreur", async () => {
    preparer();
    pendant("(avant) => avant", 3);
    regler("2026-11-13 22:31:05");
    expect(await partager([F12])).toBe("échec : défaites");
    expect(ecritures()).toBe(3);
  });

  test("mon autre appareil réécrit ma section pendant la pause, avec mes lignes : rien à refaire", async () => {
    preparer();
    regler("2026-11-13 22:31:05");
    pendant(
      `(avant, ecrit) => ecrit.replace("2026-11-13 22:31:05", "2026-11-13 22:31:07") + "\\n" + ${JSON.stringify(ligne("Floods", F13))}`,
    );
    expect(await partager([F12])).toBe(1);
    expect(ecritures()).toBe(1);
    expect(mesFloods()).toEqual([11, 12, 13]);
  });

  test("nouvel essai : une ligne déjà relue dans ma section n'est pas écrite deux fois", async () => {
    const F9 = flood("2026-11-13 22:25", "Gamma", 9);
    preparer(section("Alpha", "2026-11-13 22:20:30", [ligne("Floods", F11), ligne("Floods", F9)]));
    regler("2026-11-13 22:31:05");
    // mon autre appareil a partagé F12 sans archiver F9, arrivé : F9 revient, F12 y est déjà
    pendant(
      `() => ${JSON.stringify("NE RIEN ÉCRIRE ICI\n" + section("Alpha", "2026-11-13 22:31:07", [ligne("Floods", F12), ligne("Floods", F11), ligne("Floods", F9)]))}`,
    );
    expect(await partager([F12])).toBe(1);
    expect(ecritures()).toBe(2);
    expect(mesFloods()).toEqual([11, 12]);
  });

  test("mon autre appareil, qui avait lu avant, réécrit ma section sans mes lignes : refaite, les siennes gardées", async () => {
    preparer();
    regler("2026-11-13 22:31:05");
    pendant(
      `() => ${JSON.stringify("NE RIEN ÉCRIRE ICI\n" + section("Alpha", "2026-11-13 22:31:07", [ligne("Floods", F13), ligne("Floods", F11)]))}`,
    );
    expect(await partager([F12])).toBe(1);
    expect(ecritures()).toBe(2);
    expect(mesFloods()).toEqual([11, 12, 13]);
  });

  test("écriture refusée par le forum (grade, message verrouillé) : vue à la relecture, erreur", async () => {
    preparer();
    lire(`(() => { FORUM.refuse.push("10"); })()`);
    expect(await partager([F12])).toBe("échec : défaites");
    expect(ecritures()).toBe(3);
  });

  test("pas de sujet commun : ni lu ni écrit", async () => {
    preparer(null);
    expect(await partager([F12])).toBe("échec : sans sujet commun");
    expect(lire<string[]>(`FORUM.ordre`)).toEqual([]);
  });

  test("message trop long : rien n'est écrit", async () => {
    preparer();
    lire(`(() => { FORUM.sujets.find((s) => s.id == "10").texte = "x".repeat(40000); })()`);
    expect(await partager([F12])).toBe("échec : trop long");
    expect(ecritures()).toBe(0);
  });

  test("plus de 100 floods à venir : les 100 plus proches partagés, comptés ; noté au journal", async () => {
    preparer();
    const beaucoup = Array.from({ length: 105 }, (_, i) =>
      flood(
        lire<string>(
          `moment("2026-11-14 00:00", "YYYY-MM-DD HH:mm").add(${i}, "minutes").format("YYYY-MM-DD HH:mm")`,
        ),
        "Cible",
        100 + i,
      ),
    );
    // F11 (23:00) et les 99 premiers : les 6 derniers restent hors du forum
    expect(await partager(beaucoup)).toBe(99);
    const ids = mesFloods();
    expect([ids.length, ids[0], ids[ids.length - 1]]).toEqual([100, 11, 198]);
    expect(notes()).toContain("106 floods à venir : les 100 plus proches partagés");
  });

  test("deux partages d'une page : l'un après l'autre, le second relit ce que le premier a écrit", async () => {
    preparer();
    const p1 = lire<Promise<number>>(
      `PartageChasses.enFile(() => PartageChasses._partager("Floods", [${JSON.stringify(F12)}]))`,
    );
    const p2 = lire<Promise<number>>(
      `PartageChasses.enFile(() => PartageChasses._partager("Floods", [${JSON.stringify(F13)}]))`,
    );
    expect([await p1, await p2]).toEqual([1, 1]);
    expect(lire<string[]>(`FORUM.ordre`)).toEqual([
      "lu 10",
      "écrit 10",
      "lu 10",
      "lu 10",
      "écrit 10",
      "lu 10",
    ]);
    expect(mesFloods()).toEqual([11, 12, 13]);
  });

  test("lignes écrites relues à l'identique : flood avec unités, sans unités, au dôme, avec TdC ; chasse", () => {
    const entrees: [string, any][] = [
      [
        "Floods",
        { date: "2026-11-13 23:00", cible: "Gamma", unites: 12345, terrain: 6789, id: 11 },
      ],
      ["Floods", { date: "2026-11-13 23:01", cible: "Gamma", terrain: 6789 }],
      ["Floods", { date: "2026-11-13 23:02", cible: "Gamma", lieu: "Dôme", unites: 500, id: 12 }],
      [
        "Floods",
        {
          date: "2026-11-13 23:03",
          cible: "Gamma",
          unites: 1,
          terrain: 2,
          tdcCible: 345678,
          id: 13,
        },
      ],
      ["Chasses", { date: "2026-11-13 23:04", terrain: 1500000 }],
    ];
    for (const [type, e] of entrees) {
      const l = ligne(type, e);
      const relue = lire<string>(
        `(() => { const d = PartageChasses.lireEntrees(${JSON.stringify(l)}); return PartageChasses._ligne(${JSON.stringify(type)}, (${JSON.stringify(type)} == "Chasses" ? d.chasses : d.floods)[0]); })()`,
      );
      expect(relue).toBe(l);
    }
  });
});
