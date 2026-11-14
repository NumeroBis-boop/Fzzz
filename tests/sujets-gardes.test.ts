import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";
import { FORUM_SIMULE } from "./forum-simule";

/**
 * Sujets communs du forum (« BDD générale flood / chasse - NE RIEN ÉCRIRE »)
 * gardés une minute d'une lecture à l'autre : la colonne « Dernier message »
 * de la liste des sujets ne change pas quand leur premier message est modifié
 * (relevé du mainteneur le 14/11/2026, contraire à celui du 13/11, sur lequel
 * la 1.113.0 gardait une lecture tant que la colonne ne changeait pas).
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
lire(FORUM_SIMULE);
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
  // sujet commun : une réponse par joueur
  PartageChasses._lireSujet = (id) => {
    LUS.push(id);
    if (ECHECS.includes(id)) return Promise.reject(new Error("forum"));
    let type = id == "10" ? "Floods" : "Chasses";
    return Promise.resolve(SIM.html({ id, titre: "Sujet " + id, texte: "", reponses: (CONTENUS[id] || []).map((s, i) =>
      ({ id: 500 + i, auteur: s.pseudo, texte: s.entrees.map((e) => PartageChasses._ligne(type, e)).join("\\n") })) }, monProfil.pseudo));
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
  // liste des sujets relue ; les lectures gardées des sujets communs restent
  lire(`(() => { localStorage.removeItem("fzzz_cacheForum"); LUS.length = 0; })()`);
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

describe("colonne « Dernier message » de la liste des sujets", () => {
  test("la liste donne, pour chaque sujet commun, le texte de la colonne", async () => {
    preparer();
    regler("2026-11-13 22:30:00");
    const sujets = await lire<Promise<any>>(`PartageChasses.sujets()`);
    expect(Object.values(sujets.communs).map((s: any) => [s.type, s.id, s.dernier])).toEqual([
      ["Floods", "10", "DoggyBag 13 nov. à 22h20"],
      ["Chasses", "11", "DoggyBag 13 nov. à 21h00"],
    ]);
    // les anciens sujets des joueurs ne servent plus aux floods ni aux chasses
    expect(sujets["Floods | alpha"]).toBeUndefined();
  });
});

describe("sujets communs gardés une minute", () => {
  test("première page : les deux sujets communs sont lus ; dans la minute qui suit : rien n'est relu", async () => {
    preparer();
    const premiere = await afficher("2026-11-13 22:30:00");
    // l'ancien sujet « Floods | Alpha » n'est jamais lu
    expect(premiere.lus).toEqual(["10", "11"]);
    expect(premiere.d.floods.map((f: any) => [f.lanceur, f.id])).toEqual([
      ["Alpha", 11],
      ["Beta", 21],
    ]);
    expect(premiere.d.chasses.alpha.map((c: any) => c.terrain)).toEqual([1500]);
    const suivante = await afficher("2026-11-13 22:30:50");
    expect(suivante.lus).toEqual([]);
    expect(suivante.d).toEqual(premiere.d);
    // lectures évitées, comptées pour la mesure du journal
    expect(lire<number>(`COMPTE_REQUETES.cache`)).toBe(2);
  });

  test("un membre modifie le sujet, la colonne « Dernier message » ne change pas (relevé du 14/11) : relu dès que la lecture a plus d'une minute", async () => {
    preparer();
    await afficher("2026-11-13 22:30:00");
    // Beta partage un flood : son premier message change, la colonne reste « 13 nov. à 22h20 »
    modifier("Beta", "13 nov. à 22h20", [flood("2026-11-13 23:20", "Alpha", 22)]);
    expect((await afficher("2026-11-13 22:30:40")).lus).toEqual([]);
    const r = await afficher("2026-11-13 22:31:10");
    expect(r.lus).toEqual(["10", "11"]);
    expect(r.d.floods.map((f: any) => [f.lanceur, f.id])).toEqual([
      ["Alpha", 11],
      ["Beta", 22],
    ]);
    // une heure plus tard, toujours la même colonne : relu aussi
    expect((await afficher("2026-11-13 23:31:10")).lus).toEqual(["10", "11"]);
  });

  test("texte de la colonne changé (réponse postée dans le sujet) : relu sans attendre la minute", async () => {
    preparer();
    await afficher("2026-11-13 22:30:00");
    modifier("Beta", "13 nov. à 22h30", [flood("2026-11-13 23:20", "Alpha", 22)]);
    const r = await afficher("2026-11-13 22:30:20");
    expect(r.lus).toEqual(["10"]);
    expect(r.d.floods.map((f: any) => f.id)).toEqual([11, 22]);
  });

  test("floods rangés par joueur, quel que soit l'ordre des sections, relues ou gardées", async () => {
    preparer();
    lire(`(() => { CONTENUS[10].reverse(); })()`);
    const lu = await afficher("2026-11-13 22:30:00");
    expect(lu.d.floods.map((f: any) => f.lanceur)).toEqual(["Alpha", "Beta"]);
    modifier("Alpha", "13 nov. à 22h20", [flood("2026-11-13 23:40", "Beta", 12)]);
    const r = await afficher("2026-11-13 22:40:00");
    expect(r.lus).toEqual(["10", "11"]);
    expect(r.d.floods.map((f: any) => [f.lanceur, f.id])).toEqual([
      ["Alpha", 12],
      ["Beta", 21],
    ]);
    expect((await afficher("2026-11-13 22:40:30")).d).toEqual(r.d);
  });

  test("lecture gardée par une autre version du script : relue", async () => {
    preparer();
    await afficher("2026-11-13 22:30:00");
    lire(`(() => { VERSION = "1.111.0"; })()`);
    expect((await afficher("2026-11-13 22:30:30")).lus).toEqual(["10", "11"]);
  });

  test("sujet commun illisible : l'affichage échoue (il manquerait des joueurs), relu à la page suivante", async () => {
    preparer();
    lire(`(() => { ECHECS.push("10"); localStorage.removeItem("fzzz_cacheForum"); })()`);
    regler("2026-11-13 22:30:00");
    expect(await lire(`PartageChasses.charger().then(() => "lu", (e) => e.message)`)).toBe("forum");
    lire(`(() => { ECHECS.length = 0; })()`);
    // le sujet des chasses, lu sans erreur, est gardé
    expect((await afficher("2026-11-13 22:30:30")).lus).toEqual(["10"]);
  });

  test("avancement affiché (bloc « Mes attaques en cours ») : seules les lectures faites sont prévues", async () => {
    preparer();
    await afficher("2026-11-13 22:30:00");
    modifier("Alpha", "13 nov. à 22h30", [flood("2026-11-13 23:40", "Beta", 12)]);
    regler("2026-11-13 22:30:40");
    lire(
      `(() => { localStorage.removeItem("fzzz_cacheForum"); window.AVANCE = { prevues: 0, faites: 0 }; })()`,
    );
    await lire(
      `PartageChasses.charger(null, true, { prevoir: (n) => (AVANCE.prevues += n), faite: () => AVANCE.faites++ })`,
    );
    // la liste des sujets, puis le seul sujet commun modifié
    expect(lire(`[AVANCE.prevues, AVANCE.faites]`)).toEqual([2, 2]);
  });

  test("les écritures relisent toujours le forum : ma réponse est relue sans les lectures gardées", async () => {
    preparer();
    await afficher("2026-11-13 22:30:00");
    lire(`(() => { LUS.length = 0; })()`);
    await lire(`PartageChasses._modifierMessage("Floods", () => null)`);
    expect(lire<string[]>(`LUS.slice()`)).toEqual(["10"]);
  });
});
