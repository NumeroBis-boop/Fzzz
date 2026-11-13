import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Sujets communs « BDD générale flood » et « BDD générale chasse » (version
 * TEST, demande du mainteneur) : une section par joueur dans le premier
 * message, recopiée de son sujet « Floods | … » / « Chasses | … » après chaque
 * écriture ; l'affichage lit le sujet commun et ne lit le sujet d'un joueur
 * que si sa section est plus ancienne que lui. Joueurs inventés.
 */
const page = creerPage(
  ["js/class/Utils.js", "js/class/Requetes.js", "js/page/PartageChasses.js"],
  `var VERSION = "1.110.3";
   var heure = moment("2026-11-13 22:30:00", "YYYY-MM-DD HH:mm:ss").valueOf();
   var Horloge = { maintenant: () => heure, serveur: () => moment(heure), clic: () => moment(heure) };
   var monProfil = { pseudo: "Alpha" };
   var TOAST_INFO = {};
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
    return Promise.reject(new Error("inattendu " + f));
  };
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

describe("affichage : les sujets communs seulement, plus les sujets des joueurs", () => {
  test("chaque joueur vient de sa section ; les sujets des joueurs ne sont jamais lus ; sans section, absent", async () => {
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

  test("pas de sujet commun d'un type dans la section : les sujets des joueurs de ce type, comme avant, noté au journal", async () => {
    preparer(null);
    const d = await charger();
    expect(lectures()).toEqual(["1", "11", "2"]);
    expect(d.floods.map((f: any) => [f.lanceur, f.id])).toEqual([
      ["Alpha", 11],
      ["Beta", 21],
    ]);
    expect(notes()).toContain(
      "pas de sujet « BDD générale flood - NE RIEN ÉCRIRE » dans la section : sujets des joueurs lus",
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

describe("recopie de ma section après l'écriture de mon sujet", () => {
  const recopier = (type: string, entrees: any[]) =>
    lire<Promise<string>>(
      `PartageChasses.recopier(${JSON.stringify(type)}, ${JSON.stringify(entrees)})`,
    );

  test("ma section remplacée, celles des autres et le préambule gardés tels quels ; titre et case du sujet", async () => {
    preparer(
      [
        section("Alpha", "2026-11-13 22:20:30", [ligne("Floods", F11)]),
        section("Beta", "2026-11-13 22:25:10", ["13/11/26 23:10 | Alpha | 1 000 cm² | #21"]),
      ].join("\n"),
    );
    regler("2026-11-13 22:31:05");
    const F12 = flood("2026-11-13 23:40", "Delta", 12);
    expect(await recopier("Floods", [F11, F12])).toBe("recopiée");
    const e = lire<any[]>(`FORUM.ecritures`);
    expect(e.length).toBe(1);
    expect([e[0].id, e[0].sujet, e[0].modifiable]).toEqual(["10", COMMUN_F, true]);
    expect(sujet("10").texte).toBe(
      [
        "NE RIEN ÉCRIRE ICI",
        section("Alpha", "2026-11-13 22:31:05", [ligne("Floods", F12), ligne("Floods", F11)]),
        section("Beta", "2026-11-13 22:25:10", ["13/11/26 23:10 | Alpha | 1 000 cm² | #21"]),
      ].join("\n"),
    );
    // relu après la pause pour vérifier
    expect(lire<string[]>(`FORUM.lectures`)).toEqual(["10", "10"]);
    expect(notes()).toContain(
      "« BDD générale flood - NE RIEN ÉCRIRE » : section de Alpha recopiée (2 ligne(s), essai 1)",
    );
  });

  test("plus rien à venir : ma section est retirée", async () => {
    preparer();
    expect(await recopier("Floods", [])).toBe("recopiée");
    expect(sujet("10").texte).toBe("NE RIEN ÉCRIRE ICI");
  });

  test("ma section retirée puis remise par un membre qui avait lu avant : retirée de nouveau", async () => {
    preparer();
    regler("2026-11-13 22:31:05");
    lire(`(() => {
      const avant = FORUM.sujets.find((s) => s.id == "10").texte;
      let fois = 0;
      FORUM.pendant = () => {
        if (fois++ == 0) FORUM.sujets.find((s) => s.id == "10").texte = avant;
        return Promise.resolve();
      };
    })()`);
    expect(await recopier("Floods", [])).toBe("recopiée");
    expect(lire<number>(`FORUM.ecritures.length`)).toBe(2);
    expect(sujet("10").texte).toBe("NE RIEN ÉCRIRE ICI");
  });

  test("un autre membre réécrit le sujet lu avant ma recopie : elle est refaite", async () => {
    preparer(section("Beta", "2026-11-13 22:25:10", [ligne("Floods", F21)]));
    // Beta a lu le sujet avant ma recopie et l'écrit pendant la pause : ma section disparaît
    lire(`(() => {
      const avant = FORUM.sujets.find((s) => s.id == "10").texte;
      let fois = 0;
      FORUM.pendant = () => {
        if (fois++ == 0) FORUM.sujets.find((s) => s.id == "10").texte = avant + "\\n" + "13/11/26 23:20 | Beta2 | 500 cm²";
        return Promise.resolve();
      };
    })()`);
    expect(await recopier("Floods", [F11])).toBe("recopiée");
    expect(lire<number>(`FORUM.ecritures.length`)).toBe(2);
    const lu = lire<any>(`PartageChasses.sections(FORUM.sujets.find((s) => s.id == "10").texte)`);
    expect(lu.sections.map((s: any) => s.pseudo)).toEqual(["Alpha", "Beta"]);
    expect(notes().some((n) => n.includes("essai 2"))).toBe(true);
  });

  test("défaite à chaque essai : trois essais, puis une erreur au journal ; mon sujet seul fait foi", async () => {
    preparer();
    lire(`(() => {
      const avant = FORUM.sujets.find((s) => s.id == "10").texte;
      FORUM.pendant = () => {
        FORUM.sujets.find((s) => s.id == "10").texte = avant;
        return Promise.resolve();
      };
    })()`);
    regler("2026-11-13 22:31:05");
    expect(await recopier("Floods", [F11])).toBe("échec");
    expect(lire<number>(`FORUM.ecritures.length`)).toBe(3);
    expect(notes()).toContain(
      "« BDD générale flood - NE RIEN ÉCRIRE » : section de Alpha défaite après 3 essais ; ton sujet seul fait foi",
    );
  });

  test("recopie plus récente depuis mon autre appareil pendant la pause : rien à refaire", async () => {
    preparer();
    regler("2026-11-13 22:31:05");
    lire(`(() => {
      FORUM.pendant = () => {
        const s = FORUM.sujets.find((s) => s.id == "10");
        s.texte = s.texte.replace("2026-11-13 22:31:05", "2026-11-13 22:31:07");
        return Promise.resolve();
      };
    })()`);
    expect(await recopier("Floods", [F11])).toBe("recopiée");
    expect(lire<number>(`FORUM.ecritures.length`)).toBe(1);
  });

  test("écriture refusée par le forum (grade, message verrouillé) : vue à la relecture", async () => {
    preparer();
    lire(`(() => { FORUM.refuse.push("10"); })()`);
    expect(await recopier("Floods", [flood("2026-11-13 23:40", "Delta", 12)])).toBe("échec");
  });

  test("pas de sujet commun : rien n'est écrit, noté au journal", async () => {
    preparer(null);
    expect(await recopier("Floods", [F11])).toBe("sans sujet");
    expect(lire<number>(`FORUM.ecritures.length`)).toBe(0);
    expect(notes()).toContain(
      "pas de sujet « BDD générale flood - NE RIEN ÉCRIRE » dans la section : rien n'est recopié",
    );
  });

  test("trop de lignes, ou message trop long : pas de recopie, mon sujet seul fait foi", async () => {
    preparer();
    const beaucoup = Array.from({ length: 101 }, (_, i) =>
      flood("2026-11-13 23:40", "Cible", 100 + i),
    );
    expect(await recopier("Floods", beaucoup)).toBe("trop long");
    lire(`(() => { FORUM.sujets.find((s) => s.id == "10").texte = "x".repeat(40000); })()`);
    expect(await recopier("Floods", [F11])).toBe("trop long");
    expect(lire<number>(`FORUM.ecritures.length`)).toBe(0);
  });

  test("deux recopies d'une page : l'une après l'autre, la dernière l'emporte", async () => {
    preparer();
    const F12 = flood("2026-11-13 23:40", "Delta", 12);
    regler("2026-11-13 22:31:05");
    const p1 = recopier("Floods", [F11]);
    regler("2026-11-13 22:31:20");
    const p2 = recopier("Floods", [F11, F12]);
    expect([await p1, await p2]).toEqual(["recopiée", "recopiée"]);
    // la seconde lit le sujet une fois la première vérifiée
    expect(lire<string[]>(`FORUM.ordre`)).toEqual([
      "lu 10",
      "écrit 10",
      "lu 10",
      "lu 10",
      "écrit 10",
      "lu 10",
    ]);
    const lu = lire<any>(`PartageChasses.sections(FORUM.sujets.find((s) => s.id == "10").texte)`);
    expect(lu.sections[0].floods.map((f: any) => f.id).sort()).toEqual([11, 12]);
  });
});

describe("recopies déclenchées par les écritures du sujet du joueur", () => {
  function espionner() {
    lire(`(() => {
      window.RECOPIES = [];
      window.vraiRecopier = window.vraiRecopier || PartageChasses.recopier;
      PartageChasses.recopier = (type, entrees) => { RECOPIES.push([type, entrees.map((e) => e.id || e.date)]); return Promise.resolve("recopiée"); };
    })()`);
  }
  const remettre = () => lire(`(() => { PartageChasses.recopier = window.vraiRecopier; })()`);

  test("partage de floods : mon sujet puis ma section, avec les entrées à venir seulement", async () => {
    preparer();
    espionner();
    await lire(
      `PartageChasses._partager("Floods", [${JSON.stringify(flood("2026-11-13 23:40", "Delta", 12))}])`,
    );
    expect(lire<any[]>(`RECOPIES`)).toEqual([["Floods", [12, 11]]]);
    remettre();
  });

  test("rien de nouveau à partager : pas de recopie", async () => {
    preparer();
    espionner();
    await lire(`PartageChasses._partager("Floods", [${JSON.stringify(F11)}])`);
    expect(lire<any[]>(`RECOPIES`)).toEqual([]);
    remettre();
  });

  test("floods annulés retirés de mon sujet : ma section suit", async () => {
    preparer();
    espionner();
    await lire(`PartageChasses._retirerFloods([11], "Alpha", "Floods | Alpha")`);
    expect(lire<any[]>(`RECOPIES`)).toEqual([["Floods", []]]);
    remettre();
  });

  test("chasses annulées (page Ressources) : ma section suit", async () => {
    preparer();
    espionner();
    lire(`(() => { localStorage.setItem("fzzz_finChassesPartagees", "2026-11-13 23:30"); })()`);
    await lire(`PartageChasses.recalerChasses([])`);
    expect(lire<any[]>(`RECOPIES`)).toEqual([["Chasses", []]]);
    remettre();
  });
});

describe("bouton « Reporter tous les partages »", () => {
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
      `PartageChasses._ecrireSections("Floods", [{ pseudo: "Beta", ecrit: "2026-11-13 22:29:59", lignes: ["x"] }])`,
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

  test("joueur avec trop de floods à venir pour une section : compté, non reporté", async () => {
    preparerReport();
    const beaucoup = Array.from({ length: 101 }, (_, i) =>
      flood("2026-11-13 23:40", "Cible", 100 + i),
    );
    lire(
      `(() => { FORUM.sujets.find((s) => s.id == "5").texte = ${JSON.stringify(beaucoup.map((f) => ligne("Floods", f)).join("\n"))}; })()`,
    );
    expect(await reporter()).toStartWith(
      "« BDD générale flood - NE RIEN ÉCRIRE » : 1 section reportée, 1 déjà à jour, 1 sujet trop long.",
    );
    expect(sectionsDe("10").map((s) => s.pseudo)).toEqual(["Alpha", "Beta", "Gamma"]);
    // la section ancienne de Gamma reste : son sujet, plus récent, fait foi à la lecture
    expect(sectionsDe("10")[2].ecrit).toBe("2026-11-13 22:10:00");
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
    regler("2026-11-13 22:31:50");
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

  test("pas de sujet commun : rien n'est lu, le bilan le dit", async () => {
    preparer(null);
    lire(`(() => { FORUM.sujets = FORUM.sujets.filter((s) => s.id != "11"); })()`);
    expect(await reporter()).toBe(
      "Aucun sujet « BDD générale flood - NE RIEN ÉCRIRE » ni « BDD générale chasse - NE RIEN ÉCRIRE » dans la section : rien à reporter.",
    );
    expect(lire<string[]>(`FORUM.lectures`)).toEqual([]);
  });
});
