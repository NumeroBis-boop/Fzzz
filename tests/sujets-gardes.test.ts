import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Sujets de suivi du forum (« Floods | … », « Chasses | … ») gardés d'une
 * lecture à l'autre tant que leur date « Dernier message » ne change pas dans
 * la liste des sujets (elle change quand le premier message est modifié,
 * relevé du mainteneur le 13/11/2026), à la minute près : une lecture faite
 * pendant la minute affichée ne fait foi qu'après cette minute. Joueurs inventés.
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
  PartageChasses._lireSujet = (id) => {
    LUS.push(id);
    return ECHECS.includes(id) ? Promise.reject(new Error("forum")) : Promise.resolve(JSON.parse(JSON.stringify(CONTENUS[id])));
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
/** Forum : trois sujets de suivi, avec la date de leur dernier message. */
function preparer() {
  lire(`(() => {
    localStorage.clear();
    PartageChasses.idSection = "7";
    VERSION = "1.110.3";
    LUS.length = 0;
    ECHECS.length = 0;
    Object.keys(COMPTE_REQUETES).forEach((k) => (COMPTE_REQUETES[k] = 0));
    SUJETS = [
      { id: "1", titre: "Floods | Alpha", dernier: "13 nov. à 22h20" },
      { id: "2", titre: "Floods | Beta", dernier: "13 nov. à 22h25" },
      { id: "3", titre: "Chasses | Alpha", dernier: "13 nov. à 21h00" },
    ];
    CONTENUS = {
      1: { chasses: [], floods: [${JSON.stringify(flood("2026-11-13 23:00", "Gamma", 11))}] },
      2: { chasses: [], floods: [${JSON.stringify(flood("2026-11-13 23:10", "Alpha", 21))}] },
      3: { chasses: [{ date: "2026-11-13 23:30", terrain: 1500 }], floods: [] },
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
const modifier = (id: string, dernier: string, floods: any[]) =>
  lire(`(() => {
    SUJETS.find((s) => s.id == ${JSON.stringify(id)}).dernier = ${JSON.stringify(dernier)};
    CONTENUS[${JSON.stringify(id)}].floods = ${JSON.stringify(floods)};
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

  test("la liste donne, pour chaque sujet de suivi, le texte de la colonne et sa minute", async () => {
    preparer();
    regler("2026-11-13 22:30:00");
    const sujets = await lire<Promise<any>>(`PartageChasses.sujets()`);
    expect(sujets.liste.map((s: any) => [s.id, s.dernier, s.modifie])).toEqual([
      ["1", "DoggyBag 13 nov. à 22h20", ms("2026-11-13 22:20")],
      ["2", "DoggyBag 13 nov. à 22h25", ms("2026-11-13 22:25")],
      ["3", "DoggyBag 13 nov. à 21h00", ms("2026-11-13 21:00")],
    ]);
  });

  test("date illisible : notée au journal du mainteneur, avec un exemple", async () => {
    preparer();
    lire(`(() => { journalInstalle = true; SUJETS[1].dernier = null; })()`);
    await lire(`PartageChasses.sujets()`);
    const notes = lire<any[]>(
      `Journal.entrees().filter((e) => e.s == "Forum").map((e) => [e.m, e.d])`,
    );
    lire(`(() => { journalInstalle = false; })()`);
    expect(notes).toEqual([
      [
        "date « Dernier message » illisible pour 1 sujet(s) de suivi : ils sont relus à chaque affichage",
        "Exemple : «  »",
      ],
    ]);
  });
});

describe("sujets gardés tant que leur date ne change pas", () => {
  test("première page : tout est lu ; page suivante, liste inchangée : rien n'est relu, mêmes partages", async () => {
    preparer();
    const premiere = await afficher("2026-11-13 22:30:00");
    expect(premiere.lus).toEqual(["1", "2", "3"]);
    expect(premiere.d.floods.map((f: any) => [f.lanceur, f.id])).toEqual([
      ["Alpha", 11],
      ["Beta", 21],
    ]);
    const suivante = await afficher("2026-11-13 22:35:00");
    expect(suivante.lus).toEqual([]);
    expect(suivante.d).toEqual(premiere.d);
    // lectures évitées, comptées pour la mesure du journal
    expect(lire<number>(`COMPTE_REQUETES.cache`)).toBe(3);
  });

  test("sujet modifié (nouvelle date) : lui seul est relu, ses nouveaux floods sont pris", async () => {
    preparer();
    await afficher("2026-11-13 22:30:00");
    modifier("2", "13 nov. à 22h36", [flood("2026-11-13 23:20", "Alpha", 22)]);
    const r = await afficher("2026-11-13 22:40:00");
    expect(r.lus).toEqual(["2"]);
    expect(r.d.floods.map((f: any) => [f.lanceur, f.id])).toEqual([
      ["Alpha", 11],
      ["Beta", 22],
    ]);
  });

  test("lu pendant la minute affichée : une modification de la même minute est prise une minute plus tard", async () => {
    preparer();
    await afficher("2026-11-13 22:30:00");
    // Beta modifie à 22:36:10, la page lit à 22:36:20, Beta modifie encore à 22:36:50 : la date reste « 22h36 »
    modifier("2", "13 nov. à 22h36", [flood("2026-11-13 23:20", "Alpha", 22)]);
    expect((await afficher("2026-11-13 22:36:20")).lus).toEqual(["2"]);
    modifier("2", "13 nov. à 22h36", [flood("2026-11-13 23:25", "Alpha", 23)]);
    // moins d'une minute après la lecture : gardée, comme toute lecture de moins d'une minute
    expect((await afficher("2026-11-13 22:36:40")).lus).toEqual([]);
    // plus d'une minute après, et lue avant la fin de la minute affichée (+ marge) : relue
    const r = await afficher("2026-11-13 22:37:30");
    expect(r.lus).toEqual(["2"]);
    expect(r.d.floods.map((f: any) => f.id)).toEqual([11, 23]);
    // lue après la fin de la minute affichée : elle fait foi
    expect((await afficher("2026-11-13 22:45:00")).lus).toEqual([]);
  });

  test("la marge : une lecture juste après la fin de la minute affichée ne fait pas encore foi", async () => {
    preparer();
    await afficher("2026-11-13 22:30:00");
    modifier("2", "13 nov. à 22h36", [flood("2026-11-13 23:20", "Alpha", 22)]);
    // 22:37:03 : moins de 5 s après la fin de la minute 22h36
    expect((await afficher("2026-11-13 22:37:03")).lus).toEqual(["2"]);
    expect((await afficher("2026-11-13 22:39:00")).lus).toEqual(["2"]);
    expect((await afficher("2026-11-13 22:41:00")).lus).toEqual([]);
  });

  test("date illisible : relu dès que la lecture a plus d'une minute, comme avant", async () => {
    preparer();
    lire(`(() => { SUJETS[0].dernier = "DoggyBag"; })()`);
    await afficher("2026-11-13 22:30:00");
    expect((await afficher("2026-11-13 22:30:40")).lus).toEqual([]);
    expect((await afficher("2026-11-13 22:31:30")).lus).toEqual(["1"]);
    expect((await afficher("2026-11-13 22:40:00")).lus).toEqual(["1"]);
    // le texte de la colonne change, même illisible : relu sans attendre la minute
    lire(`(() => { SUJETS[0].dernier = "Grim"; })()`);
    expect((await afficher("2026-11-13 22:40:20")).lus).toEqual(["1"]);
  });

  test("ordre des floods : celui de la liste, que les sujets soient relus ou gardés", async () => {
    preparer();
    await afficher("2026-11-13 22:30:00");
    modifier("1", "13 nov. à 22h36", [flood("2026-11-13 23:40", "Beta", 12)]);
    const r = await afficher("2026-11-13 22:40:00");
    expect(r.lus).toEqual(["1"]);
    expect(r.d.floods.map((f: any) => [f.lanceur, f.id])).toEqual([
      ["Alpha", 12],
      ["Beta", 21],
    ]);
  });

  test("lecture gardée par une autre version du script : relue", async () => {
    preparer();
    await afficher("2026-11-13 22:30:00");
    lire(`(() => { VERSION = "1.111.0"; })()`);
    expect((await afficher("2026-11-13 22:35:00")).lus).toEqual(["1", "2", "3"]);
  });

  test("lecture en échec : rien n'est gardé, le sujet est relu à la page suivante", async () => {
    preparer();
    lire(`(() => { ECHECS.push("2"); })()`);
    const r = await afficher("2026-11-13 22:30:00");
    expect(r.d.floods.map((f: any) => f.lanceur)).toEqual(["Alpha"]);
    lire(`(() => { ECHECS.length = 0; })()`);
    expect((await afficher("2026-11-13 22:35:00")).lus).toEqual(["2"]);
  });

  test("avancement affiché (bloc « Mes attaques en cours ») : seules les lectures faites sont prévues", async () => {
    preparer();
    await afficher("2026-11-13 22:30:00");
    modifier("1", "13 nov. à 22h40", [flood("2026-11-13 23:40", "Beta", 12)]);
    regler("2026-11-13 22:45:00");
    lire(`(() => { PartageChasses.oublierCache(); window.AVANCE = { prevues: 0, faites: 0 }; })()`);
    await lire(
      `PartageChasses.charger(null, true, { prevoir: (n) => (AVANCE.prevues += n), faite: () => AVANCE.faites++ })`,
    );
    // la liste des sujets, puis le seul sujet modifié
    expect(lire(`[AVANCE.prevues, AVANCE.faites]`)).toEqual([2, 2]);
  });

  test("les écritures relisent toujours le forum : une lecture sans la liste ignore les sujets gardés", async () => {
    preparer();
    await afficher("2026-11-13 22:30:00");
    lire(`(() => { LUS.length = 0; })()`);
    await lire(`PartageChasses.lireSujet("1")`);
    expect(lire<string[]>(`LUS.slice()`)).toEqual(["1"]);
  });
});
