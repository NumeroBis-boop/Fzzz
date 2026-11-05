import { beforeEach, describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Le lanceur de chasses de la page Ressources, dans le DOM : les deux usages
 * principaux (difficulté choisie, pertes acceptées), les verrous entre les
 * cases Auto, le clic qui fixe un champ, l'heure de retour, les réglages
 * mémorisés et le verrou de lancement quand l'armée simulée n'est pas la vraie.
 * Rien ne part : Armee.posterChasse n'est jamais appelé.
 */
const page = creerPage(
  [
    "js/lib/globalize_0.1.1.js",
    "js/lib/globalize-locale-fr.js",
    "js/lib/moment-duration-format.js",
    "js/lib/jquery-ui_1.12.1.js",
    "js/lib/jquery-datetimepicker_1.6.3.js",
    "js/class/Utils.js",
    "js/class/Parametre.js",
    "js/class/Joueur.js",
    "js/class/Armee.js",
    "js/class/Combat.js",
    "js/class/SimulationChasse.js",
    "js/boite/ImportArmee.js",
    "js/page/PartageChasses.js",
    "js/page/Ressource.js",
    "js/content.js",
  ],
  `var chrome = { runtime: { getManifest: () => ({ version: "0" }), getURL: (p) => p } };
   var Horloge = { serveur: () => moment() };
   document.body.innerHTML = "<div class='boite_connexion_titre'>Connexion</div><span id='pseudo'>Test</span><span id='tag_alliance'>OUAF</span><span id='quantite_tdc'>1000000</span><div id='boite_tdc'>TdC</div>";`,
);

const ARMEE = "5000000 jsn, 400000 sn, 100000 ne, 50000 js, 20000 s, 30000 a, 2000 tk, 1000 tu";

/** Un lanceur neuf sur la page, avec le profil et l'armée du test ; `avant` s'exécute entre les deux. */
function creerLanceur(avant = "") {
  page.lire(`
    localStorage.removeItem("fzzz_affichage_lanceurChasse");
    $("#o_prepaChasse").remove();
    var monProfil = new Joueur({
      pseudo: "Test",
      niveauRecherche: [15, 8, 10, 0, 0, 8, 0, 0, 0, 0],
      niveauConstruction: [0, 0, 0, 20, 10, 0, 0, 0, 0, 0, 0, 0, 0],
    });
    ${avant}
    var lanceur = new PageRessource(null);
    lanceur._armee.parseArmee(${JSON.stringify(ARMEE)});
    lanceur._armee._nbrJSN = lanceur._armee.unite[0];
    lanceur.lanceur();
  `);
}
const lire = <T = any>(expr: string) => page.lire<T>(expr);
const valeur = (id: string) => lire<number>(`$("#${id}").spinner("value")`);
const coche = (id: string) => lire<boolean>(`$("#${id}").is(":checked")`);
const cocher = (id: string, etat: boolean) =>
  lire(`$("#${id}").prop("checked", ${etat}).trigger("change")`);
const saisir = (id: string, v: number) =>
  lire(`$("#${id}").spinner("value", ${v}); $("#${id}").trigger("input")`);
const plan = () =>
  lire(`JSON.parse(JSON.stringify({ ...lanceur._simu, chasses: lanceur._simu.chasses.length }))`);
const reglages = () => JSON.parse(lire<string>(`localStorage.getItem("fzzz_lanceurChasse")`));

beforeEach(() => {
  lire(`localStorage.removeItem("fzzz_lanceurChasse")`);
  creerLanceur();
});

describe("lanceur : difficulté choisie (défaut)", () => {
  test("nombre et terrain calculés au meilleur rendement, le reste affiché", () => {
    expect(coche("o_chasseDiffAuto")).toBe(false);
    expect(valeur("o_chasseDiff")).toBe(9);
    for (const id of [
      "o_chasseNbrAuto",
      "o_chasseTDCRepAuto",
      "o_chasseBudgetAuto",
      "o_chasseRendementAuto",
    ])
      expect(coche(id)).toBe(true);
    const p = plan();
    expect(p.limite).toBe("ratio");
    expect(p.ratio).toBeGreaterThanOrEqual(9);
    expect(p.nombre).toBeGreaterThanOrEqual(1);
    expect(p.nombre).toBeLessThanOrEqual(9);
    expect(valeur("o_chasseNbr")).toBe(p.nombre);
    expect(valeur("o_chasseTDCRep")).toBe(p.terrain);
    expect(valeur("o_chasseBudget")).toBeCloseTo(Math.round(p.budget * 1000) / 10, 5);
    expect(valeur("o_chasseRendement")).toBe(Math.round(p.rendement * 3600));
    expect(lire(`$("#o_chasseDateArrivee").val()`)).toMatch(/^\d\d-\d\d-\d{4} \d\d:\d\d$/);
    expect(lire(`$("#o_chasseEnvoyer").prop("disabled")`)).toBe(false);
    expect(lire(`$("#o_simulationChasse tr").length`)).toBe(p.nombre + 1);
    // la cible est le rendement
    expect(lire(`$("#o_chasseCibleRendement")[0].style.display`)).not.toBe("none");
    expect(lire(`$("#o_chasseCiblePertes")[0].style.display`)).toBe("none");
  });

  test("difficulté saisie entre deux valeurs de référence : gardée, référence du dessous", () => {
    saisir("o_chasseDiff", 8.3);
    expect(valeur("o_chasseDiff")).toBe(8.3);
    const p = plan();
    expect(p.ratio).toBeGreaterThanOrEqual(8.3);
    expect(p.indexRef).toBe(9); // RATIO_CHASSE[9] = 8
    expect(lire(`$("#o_chasseDiffInfo").text()`)).toContain("réf. 8.0");
  });

  test("un clic sur un champ calculé le fixe à la valeur affichée", () => {
    const n = valeur("o_chasseNbr");
    lire(`$("#o_chasseNbr").trigger("focus")`);
    expect(coche("o_chasseNbrAuto")).toBe(false);
    expect(valeur("o_chasseNbr")).toBe(n);
    expect(lire(`$("#o_chasseNbr").prop("readonly")`)).toBe(false);
    expect(plan().nombre).toBe(n);
  });

  test("nombre et terrain fixés : le reste passe en Auto et se verrouille", () => {
    cocher("o_chasseNbrAuto", false);
    cocher("o_chasseTDCRepAuto", false);
    for (const id of ["o_chasseDiffAuto", "o_chasseBudgetAuto", "o_chasseRendementAuto"]) {
      expect(coche(id)).toBe(true);
      expect(lire(`$("#${id}").prop("disabled")`)).toBe(true);
    }
    expect(plan().limite).toBe("fixe");
    expect(lire(`$("#o_chasseCibleRendement")[0].style.display`)).toBe("none");
    // un clic sur un champ verrouillé ne le fixe pas
    lire(`$("#o_chasseBudget").trigger("focus")`);
    expect(coche("o_chasseBudgetAuto")).toBe(true);
    // déverrouillé : sans coût fixé, la difficulté redevient fixée
    cocher("o_chasseNbrAuto", true);
    expect(coche("o_chasseDiffAuto")).toBe(false);
    expect(lire(`$("#o_chasseDiffAuto").prop("disabled")`)).toBe(false);
  });

  test("heure de retour saisie : fixe le terrain par chasse", () => {
    // à 1 M cm² et vitesse 8, une chasse dure au moins 5 jours : retour dans 6 jours
    const dans = lire<string>(`moment().add(6, "days").format("DD-MM-YYYY HH:mm")`);
    lire(`$("#o_chasseDateArrivee").val(${JSON.stringify(dans)}).trigger("change")`);
    expect(coche("o_chasseTDCRepAuto")).toBe(false);
    const terrain = valeur("o_chasseTDCRep"),
      attendu = lire<number>(`Math.round(6 * 86400 / Math.pow(0.9, 8) - 1000000)`);
    // l'heure est à la minute : 60 s / 0,9^8 = 139 cm² d'écart possible
    expect(Math.abs(terrain - attendu)).toBeLessThanOrEqual(140);
    expect(plan().terrain).toBe(terrain);
    expect(plan().limite).toBe("terrain");
  });
});

describe("lanceur : pertes acceptées", () => {
  test("difficulté Auto fixe les pertes acceptées à la valeur mémorisée (30 %)", () => {
    cocher("o_chasseDiffAuto", true);
    expect(coche("o_chasseBudgetAuto")).toBe(false);
    expect(valeur("o_chasseBudget")).toBe(30);
    const p = plan();
    expect(["budget", "plancher"]).toContain(p.limite);
    expect(p.ratio).toBeGreaterThanOrEqual(7.2);
    if (!p.plafonne) expect(p.budget).toBeLessThanOrEqual(0.3);
    expect(valeur("o_chasseDiff")).toBeCloseTo(Math.round(p.ratio * 100) / 100, 5);
    expect(lire(`$("#o_chasseBudgetInfo").text()`)).toContain("JSN / jour");
  });

  test("pertes acceptées saisies : respectées au plus juste", () => {
    cocher("o_chasseDiffAuto", true);
    saisir("o_chasseBudget", 10);
    const p = plan();
    expect(p.limite).toBe("budget");
    expect(p.budget).toBeLessThanOrEqual(0.1);
    expect(p.budget).toBeGreaterThan(0.08);
  });

  test("remettre les pertes en Auto sans autre coût refixe la difficulté", () => {
    cocher("o_chasseDiffAuto", true);
    cocher("o_chasseBudgetAuto", true);
    expect(coche("o_chasseDiffAuto")).toBe(false);
    expect(plan().limite).toBe("ratio");
  });

  test("rendement fixé : la cible devient les pertes", () => {
    const r = valeur("o_chasseRendement");
    cocher("o_chasseRendementAuto", false);
    saisir("o_chasseRendement", Math.round(r * 0.8));
    const p = plan();
    expect(p.limite).toBe("rendement");
    expect(p.rendement * 3600).toBeGreaterThanOrEqual(Math.round(r * 0.8));
    expect(lire(`$("#o_chasseCiblePertes")[0].style.display`)).not.toBe("none");
  });
});

describe("lanceur : réglages mémorisés", () => {
  test("mode et valeurs stables reviennent, le reste repart en Auto", () => {
    cocher("o_chasseDiffAuto", true);
    saisir("o_chasseBudget", 12);
    cocher("o_chasseNbrAuto", false);
    saisir("o_chasseNbr", 2);
    lire(`$("#o_chasseInt").val("60").trigger("change")`);
    saisir("o_chasseMarge", 1.5);
    const r = reglages();
    expect(r.auto).toEqual({ ratio: true, budget: false });
    expect(r.budget).toBe(12);
    expect(r.intervalle).toBe(60);
    expect(r.marge).toBe(1.5);
    expect(r.nombre).toBeUndefined();
    creerLanceur();
    expect(coche("o_chasseDiffAuto")).toBe(true);
    expect(coche("o_chasseBudgetAuto")).toBe(false);
    expect(valeur("o_chasseBudget")).toBe(12);
    expect(coche("o_chasseNbrAuto")).toBe(true);
    expect(lire(`$("#o_chasseInt").val()`)).toBe("60");
    expect(valeur("o_chasseMarge")).toBe(1.5);
    expect(plan().limite).toBe("budget");
  });
});

describe("lanceur : terrain à l'arrivée", () => {
  test("par défaut le TdC courant, au plus le paramètre tdcArriveeMax (2 000 000)", () => {
    lire(`$("#quantite_tdc").text("2500000")`);
    creerLanceur();
    expect(valeur("o_chasseTDCDep")).toBe(2000000);
    creerLanceur(`monProfil.parametre["tdcArriveeMax"].valeur = 3000000;`);
    expect(valeur("o_chasseTDCDep")).toBe(2500000);
    expect(plan().difficulte).toBeCloseTo(
      lire(
        `SimulationChasse.difficulteTotale(2500000, lanceur._simu.terrain, lanceur._simu.nombre)`,
      ),
      6,
    );
    lire(`$("#quantite_tdc").text("1000000")`);
  });
});

describe("lanceur : armée et niveaux utilisés", () => {
  test("préremplis avec le compte, lancement possible", () => {
    expect(lire(`$("input[name='o_cpUnite'][data-i='0']").spinner("value")`)).toBe(5000000);
    expect(valeur("o_cpArmes")).toBe(10);
    expect(valeur("o_cpVitesse")).toBe(8);
    expect(valeur("o_cpTdcLancement")).toBe(1000000);
    expect(valeur("o_cpPlaces")).toBe(9);
    expect(lire(`$("#o_chasseEnvoyer").prop("disabled")`)).toBe(false);
  });

  test("modifiés : simulation seulement, lancement verrouillé jusqu'à « Rétablir »", () => {
    lire(`$("#o_cpArmes").spinner("value", 12); $("#o_cpArmes").trigger("input")`);
    expect(lire(`$("#o_chasseEnvoyer").prop("disabled")`)).toBe(true);
    expect(lire(`$("#o_chasseAlerte").text()`)).toContain("Simulation seulement");
    expect(plan().attArmee).toBeCloseTo(
      lire(`SimulationChasse.attaqueArmee(lanceur._armee.unite, 12)`),
      6,
    );
    lire(`$("#o_chasseParamRetablir").trigger("click")`);
    expect(lire(`$("#o_chasseEnvoyer").prop("disabled")`)).toBe(false);
    expect(valeur("o_cpArmes")).toBe(10);
  });

  test("JSN gardées : retirées de l'armée envoyée", () => {
    saisir("o_chasseJSN", 100000);
    const jsn = lire<number>(`lanceur._armee.repartition.reduce((s, u) => s + u[0], 0)`);
    expect(jsn).toBeLessThanOrEqual(4900000);
  });
});

describe("lanceur : saisie décimale à la française", () => {
  test("« 7,2 » vaut 7.2, pas 72", () => {
    lire(`$("#o_chasseDiff").val("7,2").trigger("input")`);
    expect(valeur("o_chasseDiff")).toBe(7.2);
    expect(plan().ratio).toBeGreaterThanOrEqual(7.2);
    expect(plan().ratio).toBeLessThan(7.5);
  });
});

describe("lanceur : nombres entiers affichés avec séparateur de milliers", () => {
  test("« 1,443 » dans Rendement vaut 1443", () => {
    cocher("o_chasseRendementAuto", false);
    saisir("o_chasseRendement", 1443);
    expect(valeur("o_chasseRendement")).toBe(1443);
    expect(plan().rendement * 3600).toBeGreaterThanOrEqual(1443);
  });
});

describe("lanceur : réglages par défaut", () => {
  test("oublie les réglages mémorisés et revient à l'état initial", () => {
    cocher("o_chasseDiffAuto", true);
    saisir("o_chasseBudget", 12);
    saisir("o_chasseMarge", 1.5);
    expect(reglages().budget).toBe(12);
    lire(`$("#o_chasseReglagesDefaut").trigger("click")`);
    expect(lire(`localStorage.getItem("fzzz_lanceurChasse")`)).toBeNull();
    expect(coche("o_chasseDiffAuto")).toBe(false);
    expect(valeur("o_chasseDiff")).toBe(9);
    expect(coche("o_chasseBudgetAuto")).toBe(true);
    expect(valeur("o_chasseMarge")).toBe(2);
    expect(plan().limite).toBe("ratio");
    expect(lire(`$("#o_chasseRendementInfo").text()`)).toMatch(/cm² \/ jour$/);
  });
});
