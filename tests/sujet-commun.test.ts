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
      if (FORUM.historiqueEchoue) return Promise.reject(new Error("forum"));
      const q = String(args);
      FORUM.sujets.push({
        id: String(100 + FORUM.sujets.length),
        titre: decodeURIComponent(q.match(/sujet=([^&]*)/)[1]),
        dernier: moment(heure).format("D MMM [à] H[h]mm"),
        texte: decodeURIComponent(q.match(/message=([^&]*)/)[1]),
      });
      PartageChasses.oublierCache();
      return Promise.resolve("<xjx></xjx>");
    }
    // cases cochées de la liste des sujets, puis « Supprimer »
    if (f == "callSupprimer") {
      const ids = [...String(args[0]).matchAll(/topic\\[\\]=(\\d+)/g)].map((m) => m[1]);
      FORUM.suppressions.push(ids);
      FORUM.ordre.push("supprimé " + ids.join(","));
      if (!FORUM.refuseSuppression) FORUM.sujets = FORUM.sujets.filter((s) => !ids.includes(s.id));
      return Promise.resolve("<xjx></xjx>");
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
    FORUM = { sujets: ${JSON.stringify(sujets)}, lectures: [], ecritures: [], ordre: [], echoue: [], refuse: [], pendant: null, suppressions: [] };
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

  test("sujets communs lus il y a moins d'une minute : gardés d'une page à l'autre ; au-delà, relus même si la colonne « Dernier message » n'a pas changé", async () => {
    preparer();
    await charger();
    regler("2026-11-13 22:30:50");
    await charger();
    expect(lectures()).toEqual([]);
    // lectures évitées, comptées pour la mesure du journal
    expect(lire<number>(`COMPTE_REQUETES.cache`)).toBeGreaterThan(0);
    regler("2026-11-13 22:35:00");
    await charger();
    expect(lectures()).toEqual(["10", "11"]);
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

describe("boutons « Reporter les floods » et « Reporter les chasses » (mainteneur) : sujets des joueurs de la version finale vers leur section", () => {
  const G5 = flood("2026-11-13 23:45", "Alpha", 51);
  /** Gamma : section ancienne, sujet modifié depuis ; Delta : sujet vide, sans section. */
  function preparerReport() {
    preparer(
      [
        section("Alpha", "2026-11-13 22:20:30", [ligne("Floods", F11)]),
        section("Gamma", "2026-11-13 22:10:00", [
          ligne("Floods", flood("2026-11-13 23:05", "Old", 9)),
        ]),
      ].join("\n"),
    );
    lire(`(() => {
      FORUM.sujets.push({ id: "5", titre: "Floods | Gamma", dernier: "13 nov. à 22h27", texte: ${JSON.stringify(ligne("Floods", G5))} });
      FORUM.sujets.push({ id: "6", titre: "Floods | Delta", dernier: "13 nov. à 22h00", texte: "Aucun flood en cours." });
    })()`);
    regler("2026-11-13 22:30:40");
  }
  const reporter = () =>
    lire<Promise<string>>(
      `(() => { window.ETATS = []; return PartageChasses.reporterTout((t) => ETATS.push(t)); })()`,
    );
  const sectionsDe = (id: string) =>
    lire<any[]>(
      `PartageChasses.sections(FORUM.sujets.find((s) => s.id == ${JSON.stringify(id)}).texte).sections`,
    );

  test("reporte les joueurs sans section ou dont la section est plus ancienne que leur sujet ; bilan", async () => {
    preparerReport();
    expect(await reporter()).toBe(
      "« BDD générale flood - NE RIEN ÉCRIRE » : 2 sections reportées, 1 déjà à jour. « BDD générale chasse - NE RIEN ÉCRIRE » : 1 section reportée.",
    );
    // datée de la minute qui précède la lecture de son sujet
    expect(
      sectionsDe("10").map((s) => [s.pseudo, s.ecrit, s.floods.map((f: any) => f.id)]),
    ).toEqual([
      ["Alpha", "2026-11-13 22:20:30", [11]],
      ["Beta", "2026-11-13 22:29:59", [21]],
      ["Gamma", "2026-11-13 22:29:59", [51]],
    ]);
    expect(sectionsDe("11").map((s) => [s.pseudo, s.chasses.map((c: any) => c.terrain)])).toEqual([
      ["Alpha", [1500]],
    ]);
    // le texte écrit à la main reste ; une écriture par sujet commun, puis sa vérification
    expect(sujet("10").texte.startsWith("NE RIEN ÉCRIRE ICI\n")).toBe(true);
    expect(lire<string[]>(`FORUM.ecritures.map((e) => e.id)`)).toEqual(["10", "11"]);
    expect(lire<string[]>(`ETATS`)).toContain(
      "« BDD générale flood - NE RIEN ÉCRIRE » : sujet 1 / 3 (Beta)…",
    );
    expect(notes()).toContain(
      "« BDD générale flood - NE RIEN ÉCRIRE » : 2 sections reportées, 1 déjà à jour.",
    );
  });

  test("seuls les floods à venir sont reportés, pas ceux déjà arrivés", async () => {
    preparerReport();
    lire(
      `(() => { FORUM.sujets.find((s) => s.id == "2").texte = ${JSON.stringify([ligne("Floods", F21), ligne("Floods", flood("2026-11-13 22:00", "Passe", 8))].join("\n"))}; })()`,
    );
    await reporter();
    expect(
      sectionsDe("10")
        .find((s) => s.pseudo == "Beta")
        .floods.map((f: any) => f.id),
    ).toEqual([21]);
  });

  test("ensuite, l'affichage ne lit plus que les sujets communs", async () => {
    preparerReport();
    await reporter();
    regler("2026-11-13 22:40:00");
    const d = await charger();
    expect(lectures().filter((id) => !["10", "11"].includes(id))).toEqual([]);
    expect(d.floods.map((f: any) => [f.lanceur, f.id])).toEqual([
      ["Alpha", 11],
      ["Beta", 21],
      ["Gamma", 51],
    ]);
  });

  test("une modification du sujet dans la minute de sa lecture : ce joueur est reporté de nouveau au report suivant", async () => {
    preparerReport();
    await reporter();
    // Beta modifie son sujet à 22:30:50, après la lecture du report (22:30:40) : même minute
    lire(`(() => {
      const s = FORUM.sujets.find((s) => s.id == "2");
      s.dernier = "13 nov. à 22h30";
      s.texte = ${JSON.stringify(ligne("Floods", flood("2026-11-13 23:59", "Zeta", 22)))};
      FORUM.lectures.length = 0;
    })()`);
    regler("2026-11-13 22:40:00");
    expect(await reporter()).toStartWith(
      "« BDD générale flood - NE RIEN ÉCRIRE » : 1 section reportée, 2 déjà à jour.",
    );
    expect(lire<string[]>(`FORUM.lectures`)).toContain("2");
    expect(
      sectionsDe("10")
        .find((s) => s.pseudo == "Beta")
        .floods.map((f: any) => f.id),
    ).toEqual([22]);
  });

  test("une section plus récente que le report (son joueur l'a recopiée entre-temps) est gardée", async () => {
    preparer(
      section("Beta", "2026-11-13 22:35:00", [
        ligne("Floods", flood("2026-11-13 23:59", "Zeta", 77)),
      ]),
    );
    const r = await lire<Promise<any>>(
      `PartageChasses._reporterSections("Floods", "10", [{ pseudo: "Beta", ecrit: "2026-11-13 22:29:59", lignes: ["x"] }])`,
    );
    expect([r.etat, r.ecrites]).toEqual(["écrites", 0]);
    expect(lire<number>(`FORUM.ecritures.length`)).toBe(0);
  });

  test("tout est déjà à jour : rien n'est écrit", async () => {
    preparerReport();
    await reporter();
    lire(`(() => { FORUM.ecritures.length = 0; })()`);
    regler("2026-11-13 22:45:00");
    expect(await reporter()).toBe(
      "« BDD générale flood - NE RIEN ÉCRIRE » : 0 section reportée, 3 déjà à jour. « BDD générale chasse - NE RIEN ÉCRIRE » : 0 section reportée, 1 déjà à jour.",
    );
    expect(lire<number>(`FORUM.ecritures.length`)).toBe(0);
  });

  test("sujet d'un joueur illisible : compté, les autres sont reportés", async () => {
    preparerReport();
    lire(`(() => { FORUM.echoue.push("5"); })()`);
    expect(await reporter()).toStartWith(
      "« BDD générale flood - NE RIEN ÉCRIRE » : 1 section reportée, 1 déjà à jour, 1 sujet illisible.",
    );
  });

  test("joueur avec trop de floods à venir pour une section : les plus proches reportés, compté", async () => {
    preparerReport();
    const beaucoup = Array.from({ length: 101 }, (_, i) =>
      flood("2026-11-13 23:40", "Cible", 100 + i),
    );
    lire(
      `(() => { FORUM.sujets.find((s) => s.id == "5").texte = ${JSON.stringify(beaucoup.map((f) => ligne("Floods", f)).join("\n"))}; })()`,
    );
    expect(await reporter()).toStartWith(
      "« BDD générale flood - NE RIEN ÉCRIRE » : 2 sections reportées, 1 déjà à jour, 1 sujet coupé aux 100 entrées les plus proches.",
    );
    const gamma = sectionsDe("10").find((s) => s.pseudo == "Gamma");
    expect([gamma.floods.length, gamma.floods.some((f: any) => f.id == 200)]).toEqual([100, false]);
  });

  test("sujet lu il y a peu (lecture gardée qui fait foi) : pas relu, daté de cette lecture", async () => {
    preparerReport();
    await reporter();
    // la section de Beta est défaite : le report suivant reprend la lecture gardée de son sujet
    lire(`(() => {
      const s = FORUM.sujets.find((s) => s.id == "10");
      s.texte = s.texte.replace(/--- Beta[^\\n]*\\n[^\\n]*\\n?/, "");
      FORUM.lectures.length = 0;
    })()`);
    expect(sectionsDe("10").map((s) => s.pseudo)).toEqual(["Alpha", "Gamma"]);
    regler("2026-11-13 22:31:20");
    await reporter();
    expect(lire<string[]>(`FORUM.lectures.filter((id) => ["2", "5", "6"].includes(id))`)).toEqual(
      [],
    );
    expect(sectionsDe("10").find((s) => s.pseudo == "Beta").ecrit).toBe("2026-11-13 22:29:59");
  });

  test("message trop long : rien n'est écrit, le bilan le dit", async () => {
    preparerReport();
    // texte écrit à la main avant les sections, gardé à chaque écriture
    lire(
      `(() => { const s = FORUM.sujets.find((s) => s.id == "10"); s.texte = "x".repeat(40000) + "\\n" + s.texte; })()`,
    );
    expect(await reporter()).toStartWith(
      "« BDD générale flood - NE RIEN ÉCRIRE » : rien n'est écrit, le message dépasserait la taille d'un message du forum",
    );
    expect(lire<string[]>(`FORUM.ecritures.map((e) => e.id)`)).toEqual(["11"]);
  });

  test("écriture défaite à chaque essai : le bilan dit de réessayer", async () => {
    preparerReport();
    lire(`(() => {
      const avant = FORUM.sujets.find((s) => s.id == "10").texte;
      FORUM.pendant = () => {
        FORUM.sujets.find((s) => s.id == "10").texte = avant;
        return Promise.resolve();
      };
    })()`);
    expect(await reporter()).toStartWith(
      "« BDD générale flood - NE RIEN ÉCRIRE » : écriture défaite par d'autres membres après 3 essais, réessaie plus tard.",
    );
  });

  test("bouton des chasses : seul le sujet commun des chasses est écrit", async () => {
    preparerReport();
    const bilan = await lire<Promise<string>>(`PartageChasses.reporterTout(() => {}, ["Chasses"])`);
    expect(bilan).toBe("« BDD générale chasse - NE RIEN ÉCRIRE » : 1 section reportée.");
    expect(lire<string[]>(`FORUM.ecritures.map((e) => e.id)`)).toEqual(["11"]);
    expect(sectionsDe("11").map((s) => [s.pseudo, s.chasses.map((c: any) => c.terrain)])).toEqual([
      ["Alpha", [1500]],
    ]);
    // aucun sujet de floods lu
    expect(
      lire<string[]>(`FORUM.lectures.filter((id) => ["1", "2", "5", "6", "10"].includes(id))`),
    ).toEqual([]);
  });

  test("bouton des floods : seul le sujet commun des floods est écrit", async () => {
    preparerReport();
    const bilan = await lire<Promise<string>>(`PartageChasses.reporterTout(() => {}, ["Floods"])`);
    expect(bilan).toBe(
      "« BDD générale flood - NE RIEN ÉCRIRE » : 2 sections reportées, 1 déjà à jour.",
    );
    expect(lire<string[]>(`FORUM.ecritures.map((e) => e.id)`)).toEqual(["10"]);
  });

  test("bouton des chasses sans sujet commun des chasses : le bilan le dit", async () => {
    preparerReport();
    lire(`(() => { FORUM.sujets = FORUM.sujets.filter((s) => s.id != "11"); })()`);
    expect(await lire<Promise<string>>(`PartageChasses.reporterTout(() => {}, ["Chasses"])`)).toBe(
      "Aucun sujet « BDD générale chasse - NE RIEN ÉCRIRE » dans la section : rien à reporter.",
    );
    expect(lire<number>(`FORUM.ecritures.length`)).toBe(0);
  });

  test("pas de sujet commun : rien n'est lu, le bilan le dit", async () => {
    preparer(null);
    lire(`(() => { FORUM.sujets = FORUM.sujets.filter((s) => s.id != "11"); })()`);
    expect(await reporter()).toBe(
      "Aucun sujet « BDD générale flood - NE RIEN ÉCRIRE » ni « BDD générale chasse - NE RIEN ÉCRIRE » dans la section : rien à reporter.",
    );
    expect(lire<string[]>(`FORUM.lectures`)).toEqual([]);
  });
});

describe("« Ranger le forum » (mainteneur) : report, puis suppression des anciens sujets", () => {
  const G5 = flood("2026-11-13 23:45", "Alpha", 51);
  /** Comme le report : Gamma, section ancienne et sujet modifié depuis ; Delta, sujet vide. */
  function preparerRangement() {
    preparer(
      [
        section("Alpha", "2026-11-13 22:20:30", [ligne("Floods", F11)]),
        section("Gamma", "2026-11-13 22:10:00", [
          ligne("Floods", flood("2026-11-13 23:05", "Old", 9)),
        ]),
      ].join("\n"),
    );
    lire(`(() => {
      FORUM.sujets.push({ id: "5", titre: "Floods | Gamma", dernier: "13 nov. à 22h27", texte: ${JSON.stringify(ligne("Floods", G5))} });
      FORUM.sujets.push({ id: "6", titre: "Floods | Delta", dernier: "13 nov. à 22h00", texte: "Aucun flood en cours." });
    })()`);
    regler("2026-11-13 22:30:40");
  }
  const ranger = () =>
    lire<Promise<string>>(
      `(() => { window.ETATS = []; return PartageChasses.rangerForum((t) => ETATS.push(t)); })()`,
    );
  const titres = () => lire<string[]>(`FORUM.sujets.map((s) => s.titre)`);

  test("anciens sujets reportés puis supprimés en une fois ; convois et historiques gardés ; bilan", async () => {
    preparerRangement();
    const bilan = await ranger();
    expect(bilan).toBe(
      "« BDD générale flood - NE RIEN ÉCRIRE » : 2 sections reportées, 1 déjà à jour. « BDD générale chasse - NE RIEN ÉCRIRE » : 1 section reportée. Anciens sujets : 5 supprimés.",
    );
    expect(lire(`FORUM.suppressions`)).toEqual([["1", "2", "3", "5", "6"]]);
    expect(titres()).toEqual(["Convois | Alpha", COMMUN_F, COMMUN_C]);
    // les floods restent visibles : dans les sections
    const d = await charger();
    expect(d.floods.map((f: any) => [f.lanceur, f.id])).toEqual([
      ["Alpha", 11],
      ["Beta", 21],
      ["Gamma", 51],
    ]);
    expect(notes()).toContain("Anciens sujets : 5 supprimés.");
  });

  test("entrées passées de l'ancien sujet : dans l'historique du joueur avant la suppression", async () => {
    preparerRangement();
    const passe = flood("2026-11-13 22:00", "Passe", 8);
    lire(
      `(() => { FORUM.sujets.find((s) => s.id == "2").texte = ${JSON.stringify([ligne("Floods", F21), ligne("Floods", passe)].join("\n"))}; })()`,
    );
    await ranger();
    const historique = lire<any>(
      `FORUM.sujets.find((s) => s.titre == "Historique Floods 1 | Beta")`,
    );
    expect(historique.texte).toBe(ligne("Floods", passe));
    // l'historique est écrit avant la suppression
    const ordre = lire<string[]>(`FORUM.ordre`);
    expect(ordre.indexOf("nouveau sujet")).toBeLessThan(
      ordre.findIndex((o) => o.startsWith("supprimé")),
    );
    expect(titres()).not.toContain("Floods | Beta");
  });

  test("historique pas écrit : l'ancien sujet reste, le bilan le dit", async () => {
    preparerRangement();
    lire(`(() => {
      FORUM.sujets.find((s) => s.id == "2").texte = ${JSON.stringify([ligne("Floods", F21), ligne("Floods", flood("2026-11-13 22:00", "Passe", 8))].join("\n"))};
      FORUM.historiqueEchoue = true;
      console.warn = () => {};
    })()`);
    expect(await ranger()).toEndWith(
      "Anciens sujets : 4 supprimés, 1 gardé (historique du joueur pas écrit).",
    );
    expect(titres()).toContain("Floods | Beta");
  });

  test("flood à venir absent de la section (son joueur, à jour, a partagé depuis sans lui) : l'ancien sujet reste", async () => {
    preparerRangement();
    // Alpha, à jour, a écrit sa section à 22:25 sans F11 ; son ancien sujet (22h20) le garde
    lire(`(() => {
      const s = FORUM.sujets.find((s) => s.id == "10");
      s.texte = s.texte.replace(${JSON.stringify(section("Alpha", "2026-11-13 22:20:30", [ligne("Floods", F11)]))}, ${JSON.stringify(section("Alpha", "2026-11-13 22:25:00", [ligne("Floods", flood("2026-11-13 23:50", "Zeta", 12))]))});
    })()`);
    expect(await ranger()).toEndWith(
      "Anciens sujets : 4 supprimés, 1 gardé (entrées à venir absentes de la section du joueur, ou sujet illisible).",
    );
    expect(titres()).toContain("Floods | Alpha");
  });

  test("suppression refusée par le forum (droits de gestion) : vue à la relecture de la liste", async () => {
    preparerRangement();
    lire(`(() => { FORUM.refuseSuppression = true; })()`);
    expect(await ranger()).toEndWith(
      "Anciens sujets : 0 supprimé, 5 pas supprimés : le forum les montre encore (droits de gestion du forum ?).",
    );
    expect(notes()).toContain(
      "Anciens sujets : 0 supprimé, 5 pas supprimés : le forum les montre encore (droits de gestion du forum ?).",
    );
  });

  test("sujet d'un joueur illisible : gardé, jamais supprimé", async () => {
    preparerRangement();
    lire(`(() => { FORUM.echoue.push("5"); })()`);
    const bilan = await ranger();
    expect(bilan).toContain("1 sujet illisible");
    expect(lire(`FORUM.suppressions`)).toEqual([["1", "2", "3", "6"]]);
    expect(titres()).toContain("Floods | Gamma");
  });

  test("aucun ancien sujet supprimable : aucune demande de suppression au forum", async () => {
    preparerRangement();
    lire(`(() => { FORUM.echoue.push("1", "2", "3", "5", "6"); })()`);
    expect(await ranger()).toEndWith(
      "Anciens sujets : 0 supprimé, 5 gardés (entrées à venir absentes de la section du joueur, ou sujet illisible).",
    );
    expect(lire(`FORUM.suppressions`)).toEqual([]);
  });

  test("plus d'ancien sujet : rien n'est supprimé, le bilan le dit", async () => {
    preparerRangement();
    await ranger();
    lire(`(() => { FORUM.suppressions.length = 0; })()`);
    regler("2026-11-13 22:45:00");
    expect(await ranger()).toEndWith(
      "Aucun ancien sujet « Floods | … » ou « Chasses | … » à supprimer.",
    );
    expect(lire(`FORUM.suppressions`)).toEqual([]);
  });
});
