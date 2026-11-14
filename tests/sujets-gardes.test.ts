import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Sujets communs du forum (« BDD générale flood / chasse - NE RIEN ÉCRIRE »)
 * gardés d'une lecture à l'autre tant que leur date « Dernier message » ne
 * change pas dans la liste des sujets (elle change quand le premier message
 * est modifié, relevé du mainteneur le 13/11/2026), à la minute près : une
 * lecture faite pendant la minute affichée ne fait foi qu'après cette minute.
 * Joueurs inventés.
 */
const page = creerPage(
  ["js/class/Utils.js", "js/class/Requetes.js", "js/page/PartageChasses.js"],
  `var VERSION = "1.110.3";
   var heure = moment("2026-11-13 22:30:00", "YYYY-MM-DD HH:mm:ss").valueOf();
   var Horloge = { maintenant: () => heure, serveur: () => moment(heure), clic: () => moment(heure) };
   var monProfil = { pseudo: "Moi" };
   var SUJETS = [], CONTENUS = {}, LUS = [], ECHECS = [];`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);
lire(`(() => {
  PartageChasses.idSection = "7";
  PartageChasses._html = (d) => d;
  // liste des sujets comme la page Forum : case, titre, puis auteur et date du dernier message
  PartageChasses._xajax = (f) =>
    f == "callGetForum"
      ? Promise.resolve('<form id="form_cat"><table>' + SUJETS.map((s) =>
          '<tr><td><input name="topic[]" value="' + s.id + '"/></td><td>' + s.titre + '</td>' +
          (s.dernier == null ? "" : '<td><b>DoggyBag</b><br/>' + s.dernier + '</td>') + '</tr>').join("") + '</table></form>')
      : Promise.reject(new Error("inattendu"));
  // premier message d'un sujet commun : une section par joueur
  PartageChasses._texteSujet = (id) => {
    LUS.push(id);
    if (ECHECS.includes(id)) return Promise.reject(new Error("forum"));
    let type = id == "10" ? "Floods" : "Chasses";
    return Promise.resolve((CONTENUS[id] || []).map((s) =>
      ["--- " + s.pseudo + " · 2026-11-13 20:00:00 ---", ...s.entrees.map((e) => PartageChasses._ligne(type, e))].join("\\n")).join("\\n"));
  };
})()`);

const flood = (date: string, cible: string, id: number) => ({
  date,
  cible,
  unites: 1000,
  terrain: 1000,
  tdcCible: null,
  id,
});
const regler = (quand: string) =>
  lire(`(() => { heure = moment(${JSON.stringify(quand)}, "YYYY-MM-DD HH:mm:ss").valueOf(); })()`);
/** Forum : les deux sujets communs avec la date de leur dernier message, et un ancien sujet de joueur. */
function preparer() {
  lire(`(() => {
    localStorage.clear();
    PartageChasses.idSection = "7";
    VERSION = "1.110.3";
    LUS.length = 0;
    ECHECS.length = 0;
    Object.keys(COMPTE_REQUETES).forEach((k) => (COMPTE_REQUETES[k] = 0));
    SUJETS = [
      { id: "1", titre: "Floods | Alpha", dernier: "13 nov. à 22h29" },
      { id: "10", titre: "BDD générale flood - NE RIEN ÉCRIRE", dernier: "13 nov. à 22h20" },
      { id: "11", titre: "BDD générale chasse - NE RIEN ÉCRIRE", dernier: "13 nov. à 21h00" },
    ];
    CONTENUS = {
      10: [
        { pseudo: "Alpha", entrees: [${JSON.stringify(flood("2026-11-13 23:00", "Gamma", 11))}] },
        { pseudo: "Beta", entrees: [${JSON.stringify(flood("2026-11-13 23:10", "Alpha", 21))}] },
      ],
      11: [{ pseudo: "Alpha", entrees: [{ date: "2026-11-13 23:30", terrain: 1500 }] }],
    };
  })()`);
}
/** Une page qui affiche les partages : liste des sujets relue, puis charger(). */
async function afficher(quand: string) {
  regler(quand);
  lire(`(() => { PartageChasses.oublierCache(); LUS.length = 0; })()`);
  const d = await lire<Promise<any>>(
    `PartageChasses.charger().then((d) => JSON.parse(JSON.stringify(d)))`,
  );
  return { d, lus: lire<string[]>(`LUS.slice().sort()`) };
}
/** Le joueur `pseudo` réécrit sa section du sujet des floods : nouvelle date dans la liste. */
const modifier = (pseudo: string, dernier: string, floods: any[]) =>
  lire(`(() => {
    SUJETS.find((s) => s.id == "10").dernier = ${JSON.stringify(dernier)};
    CONTENUS[10].find((s) => s.pseudo == ${JSON.stringify(pseudo)}).entrees = ${JSON.stringify(floods)};
  })()`);

describe("date « Dernier message » de la liste des sujets", () => {
  const date = (texte: string) =>
    lire<number | null>(`PartageChasses.dateListe(${JSON.stringify(texte)})`);
  const ms = (t: string) =>
    lire<number>(`moment(${JSON.stringify(t)}, "YYYY-MM-DD HH:mm").valueOf()`);

  test("jour, mois abrégé, heure ; l'année quand elle est écrite ; aujourd'hui, hier", () => {
    regler("2026-11-13 22:30:00");
    expect(date("DoggyBag 13 nov. à 22h20")).toBe(ms("2026-11-13 22:20"));
    expect(date("Grim 2 janv. 2025 à 9h05")).toBe(ms("2025-01-02 09:05"));
    expect(date("Bob Aujourd’hui à 08h00")).toBe(ms("2026-11-13 08:00"));
    expect(date("hier à 23h59")).toBe(ms("2026-11-12 23:59"));
    const mois = [
      "janv.",
      "févr.",
      "mars",
      "avr.",
      "mai",
      "juin",
      "juil.",
      "août",
      "sept.",
      "oct.",
      "nov.",
      "déc.",
    ];
    expect(mois.map((m) => lire<number>(`moment(${date(`1 ${m} 2026 à 1h00`)}).month()`))).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
  });

  test("sans année, une date à venir est celle de l'an passé", () => {
    regler("2027-01-02 10:00:00");
    expect(date("28 déc. à 23h00")).toBe(ms("2026-12-28 23:00"));
    expect(date("2 janv. à 9h00")).toBe(ms("2027-01-02 09:00"));
  });

  test("pseudo collé à la date : le jour reste juste ou devient plus tardif, jamais plus tôt", () => {
    regler("2026-11-13 22:30:00");
    expect(date("Bob413 nov. à 22h20")).toBe(ms("2026-11-13 22:20"));
    // « Bob1 » + « 3 nov. » : lu 13 nov., plus tard que le vrai : le sujet est relu, jamais gardé à tort
    expect(date("Bob13 nov. à 22h20")! >= ms("2026-11-03 22:20")).toBe(true);
  });

  test("illisible : null", () => {
    for (const t of ["", "DoggyBag", "13 foo. à 22h20", "43 nov. à 22h20", "13 nov. 22h20"])
      expect(date(t)).toBeNull();
  });

  test("la liste donne, pour chaque sujet commun, le texte de la colonne et sa minute", async () => {
    preparer();
    regler("2026-11-13 22:30:00");
    const sujets = await lire<Promise<any>>(`PartageChasses.sujets()`);
    expect(
      Object.values(sujets.communs).map((s: any) => [s.type, s.id, s.dernier, s.modifie]),
    ).toEqual([
      ["Floods", "10", "DoggyBag 13 nov. à 22h20", ms("2026-11-13 22:20")],
      ["Chasses", "11", "DoggyBag 13 nov. à 21h00", ms("2026-11-13 21:00")],
    ]);
    // les anciens sujets des joueurs ne servent plus aux floods ni aux chasses
    expect(sujets["Floods | alpha"]).toBeUndefined();
  });

  test("date illisible d'un sujet commun : notée au journal du mainteneur, avec un exemple", async () => {
    preparer();
    lire(
      `(() => { journalInstalle = true; SUJETS[0].dernier = null; SUJETS[1].dernier = null; })()`,
    );
    await lire(`PartageChasses.sujets()`);
    const notes = lire<any[]>(
      `Journal.entrees().filter((e) => e.s == "Forum").map((e) => [e.m, e.d])`,
    );
    lire(`(() => { journalInstalle = false; })()`);
    expect(notes).toEqual([
      [
        "date « Dernier message » illisible pour 1 sujet(s) commun(s) : relu(s) à chaque affichage",
        "Exemple : «  »",
      ],
    ]);
  });
});

describe("sujets communs gardés tant que leur date ne change pas", () => {
  test("première page : les deux sujets communs sont lus ; page suivante, liste inchangée : rien n'est relu", async () => {
    preparer();
    const premiere = await afficher("2026-11-13 22:30:00");
    // l'ancien sujet « Floods | Alpha » n'est jamais lu
    expect(premiere.lus).toEqual(["10", "11"]);
    expect(premiere.d.floods.map((f: any) => [f.lanceur, f.id])).toEqual([
      ["Alpha", 11],
      ["Beta", 21],
    ]);
    expect(premiere.d.chasses.alpha.map((c: any) => c.terrain)).toEqual([1500]);
    const suivante = await afficher("2026-11-13 22:35:00");
    expect(suivante.lus).toEqual([]);
    expect(suivante.d).toEqual(premiere.d);
    // lectures évitées, comptées pour la mesure du journal
    expect(lire<number>(`COMPTE_REQUETES.cache`)).toBe(2);
  });

  test("sujet modifié (nouvelle date) : lui seul est relu, les nouveaux floods sont pris", async () => {
    preparer();
    await afficher("2026-11-13 22:30:00");
    modifier("Beta", "13 nov. à 22h36", [flood("2026-11-13 23:20", "Alpha", 22)]);
    const r = await afficher("2026-11-13 22:40:00");
    expect(r.lus).toEqual(["10"]);
    expect(r.d.floods.map((f: any) => [f.lanceur, f.id])).toEqual([
      ["Alpha", 11],
      ["Beta", 22],
    ]);
  });

  test("lu pendant la minute affichée : une modification de la même minute est prise une minute plus tard", async () => {
    preparer();
    await afficher("2026-11-13 22:30:00");
    // Beta écrit à 22:36:10, la page lit à 22:36:20, Beta écrit encore à 22:36:50 : la date reste « 22h36 »
    modifier("Beta", "13 nov. à 22h36", [flood("2026-11-13 23:20", "Alpha", 22)]);
    expect((await afficher("2026-11-13 22:36:20")).lus).toEqual(["10"]);
    modifier("Beta", "13 nov. à 22h36", [flood("2026-11-13 23:25", "Alpha", 23)]);
    // moins d'une minute après la lecture : gardée, comme toute lecture de moins d'une minute
    expect((await afficher("2026-11-13 22:36:40")).lus).toEqual([]);
    // plus d'une minute après, et lue avant la fin de la minute affichée (+ marge) : relue
    const r = await afficher("2026-11-13 22:37:30");
    expect(r.lus).toEqual(["10"]);
    expect(r.d.floods.map((f: any) => f.id)).toEqual([11, 23]);
    // lue après la fin de la minute affichée : elle fait foi
    expect((await afficher("2026-11-13 22:45:00")).lus).toEqual([]);
  });

  test("la marge : une lecture juste après la fin de la minute affichée ne fait pas encore foi", async () => {
    preparer();
    await afficher("2026-11-13 22:30:00");
    modifier("Beta", "13 nov. à 22h36", [flood("2026-11-13 23:20", "Alpha", 22)]);
    // 22:37:03 : moins de 5 s après la fin de la minute 22h36
    expect((await afficher("2026-11-13 22:37:03")).lus).toEqual(["10"]);
    expect((await afficher("2026-11-13 22:39:00")).lus).toEqual(["10"]);
    expect((await afficher("2026-11-13 22:41:00")).lus).toEqual([]);
  });

  test("date illisible : relu dès que la lecture a plus d'une minute", async () => {
    preparer();
    lire(`(() => { SUJETS[1].dernier = "DoggyBag"; })()`);
    await afficher("2026-11-13 22:30:00");
    expect((await afficher("2026-11-13 22:30:40")).lus).toEqual([]);
    expect((await afficher("2026-11-13 22:31:30")).lus).toEqual(["10"]);
    expect((await afficher("2026-11-13 22:40:00")).lus).toEqual(["10"]);
    // le texte de la colonne change, même illisible : relu sans attendre la minute
    lire(`(() => { SUJETS[1].dernier = "Grim"; })()`);
    expect((await afficher("2026-11-13 22:40:20")).lus).toEqual(["10"]);
  });

  test("floods rangés par joueur, quel que soit l'ordre des sections, relues ou gardées", async () => {
    preparer();
    lire(`(() => { CONTENUS[10].reverse(); })()`);
    const lu = await afficher("2026-11-13 22:30:00");
    expect(lu.d.floods.map((f: any) => f.lanceur)).toEqual(["Alpha", "Beta"]);
    modifier("Alpha", "13 nov. à 22h36", [flood("2026-11-13 23:40", "Beta", 12)]);
    const r = await afficher("2026-11-13 22:40:00");
    expect(r.lus).toEqual(["10"]);
    expect(r.d.floods.map((f: any) => [f.lanceur, f.id])).toEqual([
      ["Alpha", 12],
      ["Beta", 21],
    ]);
    expect((await afficher("2026-11-13 22:45:00")).d).toEqual(r.d);
  });

  test("lecture gardée par une autre version du script : relue", async () => {
    preparer();
    await afficher("2026-11-13 22:30:00");
    lire(`(() => { VERSION = "1.111.0"; })()`);
    expect((await afficher("2026-11-13 22:35:00")).lus).toEqual(["10", "11"]);
  });

  test("sujet commun illisible : l'affichage échoue (il manquerait des joueurs), relu à la page suivante", async () => {
    preparer();
    lire(`(() => { ECHECS.push("10"); PartageChasses.oublierCache(); })()`);
    regler("2026-11-13 22:30:00");
    expect(await lire(`PartageChasses.charger().then(() => "lu", (e) => e.message)`)).toBe("forum");
    lire(`(() => { ECHECS.length = 0; })()`);
    // le sujet des chasses, lu sans erreur, est gardé
    expect((await afficher("2026-11-13 22:35:00")).lus).toEqual(["10"]);
  });

  test("avancement affiché (bloc « Mes attaques en cours ») : seules les lectures faites sont prévues", async () => {
    preparer();
    await afficher("2026-11-13 22:30:00");
    modifier("Alpha", "13 nov. à 22h40", [flood("2026-11-13 23:40", "Beta", 12)]);
    regler("2026-11-13 22:45:00");
    lire(`(() => { PartageChasses.oublierCache(); window.AVANCE = { prevues: 0, faites: 0 }; })()`);
    await lire(
      `PartageChasses.charger(null, true, { prevoir: (n) => (AVANCE.prevues += n), faite: () => AVANCE.faites++ })`,
    );
    // la liste des sujets, puis le seul sujet commun modifié
    expect(lire(`[AVANCE.prevues, AVANCE.faites]`)).toEqual([2, 2]);
  });

  test("les écritures relisent toujours le forum : ma section est relue sans les lectures gardées", async () => {
    preparer();
    await afficher("2026-11-13 22:30:00");
    lire(`(() => { LUS.length = 0; })()`);
    await lire(`PartageChasses._modifierSection("Floods", () => null)`);
    expect(lire<string[]>(`LUS.slice()`)).toEqual(["10"]);
  });
});
