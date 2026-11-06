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
    "js/class/LanceurChasse.js",
    "js/boite/ImportArmee.js",
    "js/page/PartageChasses.js",
    "js/page/Ressource.js",
    "js/content.js",
  ],
  `var chrome = { runtime: { getManifest: () => ({ version: "0" }), getURL: (p) => p } };
   var Horloge = { serveur: () => moment(), maintenant: () => Date.now() };
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
    var armee = new Armee().parseArmee(${JSON.stringify(ARMEE)});
    armee._nbrJSN = armee.unite[0];
    var lanceur = new LanceurChasse(armee, 9).afficher($("#boite_tdc"));
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
    expect(lire(`$("#o_chasseDiffRep").text()`)).toMatch(/Rep10% : \d+ %/);
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

  test("modifiés : lancement possible, mais sur confirmation qui liste les écarts", () => {
    lire(`$("#o_cpArmes").spinner("value", 12); $("#o_cpArmes").trigger("input")`);
    expect(lire(`$("#o_chasseEnvoyer").prop("disabled")`)).toBe(false);
    expect(lire(`$("#o_chasseAlerte").text()`)).toContain("demandera confirmation");
    // refus : rien ne part ; les unités saisies au-delà du stock sont signalées
    lire(`$("input[name='o_cpUnite'][data-i='0']").spinner("value", 6000000).trigger("input")`);
    const message = lire<string>(`lanceur._confirmationModifies()`);
    expect(message).toContain("Armes : 12 au lieu de 10");
    expect(message).toContain("le jeu refusera");
    lire(
      `window.confirm = () => false; window.envois = 0; Armee.posterChasse = () => { window.envois++; return Promise.resolve(""); };`,
    );
    lire(`$("#o_chasseEnvoyer").trigger("click")`);
    expect(lire(`window.envois`)).toBe(0);
    expect(lire(`$("#o_chasseEnvoyer").prop("disabled")`)).toBe(false);
    expect(plan().attArmee).toBeCloseTo(
      lire(`SimulationChasse.attaqueArmee(lanceur._parametres().unites, 12)`),
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
    expect(lire(`$("#o_chasseReglagesDefaut").text()`)).toBe("Réinitialiser les réglages");
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

describe("lanceur : plusieurs instances dans la page", () => {
  test("second lanceur préfixé à côté du premier : ids distincts, calculs indépendants", () => {
    lire(`
      $("#o_tabsChasse3").remove();
      $("body").append("<div id='o_tabsChasse3'></div>");
      var armee2 = new Armee().parseArmee("300000 jsn, 20000 sn");
      armee2._nbrJSN = armee2.unite[0];
      var simu = new LanceurChasse(armee2, 4, { prefixe: "s_", cadre: false }).afficher($("#o_tabsChasse3"), "append");
    `);
    expect(lire(`$("#o_chasseNbr").length`)).toBe(1);
    expect(lire(`$("#s_o_chasseNbr").length`)).toBe(1);
    expect(lire(`$("#s_o_prepaChasse").hasClass("boite_amelioration")`)).toBe(false);
    expect(lire(`$("#s_o_prepaChasse h2").length`)).toBe(0);
    expect(lire(`$("#s_o_chasseEnvoyer").length`)).toBe(1);
    expect(lire(`$("#o_chasseEnvoyer").length`)).toBe(1);
    expect(lire(`simu._simu.attArmee`)).not.toBe(lire(`lanceur._simu.attArmee`));
    // une action dans la simulation ne touche pas le lanceur
    lire(`$("#s_o_chasseNbr").trigger("focus")`);
    expect(lire(`$("#s_o_chasseNbrAuto").is(":checked")`)).toBe(false);
    expect(coche("o_chasseNbrAuto")).toBe(true);
    lire(`$("#s_o_cpArmes").spinner("value", 12); $("#s_o_cpArmes").trigger("input")`);
    expect(lire(`$("#s_o_chasseAlerte").text()`)).toContain("demandera confirmation");
    expect(lire(`$("#o_chasseAlerte").text()`)).not.toContain("demandera confirmation");
    lire(`$("#o_tabsChasse3").remove()`);
  });
});

describe("lanceur : liste des ratios de référence", () => {
  test("le bouton ▾ ouvre la liste, un choix remplit et fixe la difficulté", () => {
    cocher("o_chasseDiffAuto", true);
    expect(lire(`$("#o_chasseDiffMenu")[0].style.display`)).toBe("none");
    lire(`$("#o_chasseDiffBouton").trigger("click")`);
    expect(lire(`$("#o_chasseDiffMenu")[0].style.display`)).not.toBe("none");
    expect(lire(`$("#o_chasseDiffMenu .o_chasseDiffItem").length`)).toBe(13);
    lire(`$("#o_chasseDiffMenu .o_chasseDiffItem[data-ratio='7.5']").trigger("click")`);
    expect(lire(`$("#o_chasseDiffMenu")[0].style.display`)).toBe("none");
    expect(valeur("o_chasseDiff")).toBe(7.5);
    expect(coche("o_chasseDiffAuto")).toBe(false);
    expect(plan().limite).toBe("ratio");
    expect(plan().ratio).toBeGreaterThanOrEqual(7.5);
    // la valeur libre reste possible
    saisir("o_chasseDiff", 8.3);
    expect(valeur("o_chasseDiff")).toBe(8.3);
  });
});

describe("lanceur : difficulté plancher (Paramètres)", () => {
  test("7,2 par défaut ; à 6, le mode budget descend jusqu'à 6", () => {
    cocher("o_chasseDiffAuto", true);
    saisir("o_chasseBudget", 500);
    expect(plan().plafonne).toBe(true);
    expect(plan().ratioMin).toBe(7.2);
    expect(lire(`SimulationChasse.RATIO_PLANCHER`)).toBe(7.2);
    expect(plan().ratio).toBeGreaterThanOrEqual(7.2);
    expect(lire(`$("#o_chasseAlerte").text()`)).toContain("plafonné à 7.2");
    creerLanceur(`monProfil.parametre["ratioPlancher"].valeur = 6;`);
    cocher("o_chasseDiffAuto", true);
    saisir("o_chasseBudget", 500);
    expect(plan().ratioMin).toBe(6);
    expect(plan().ratio).toBeGreaterThanOrEqual(6);
    expect(plan().ratio).toBeLessThan(7.2);
    expect(lire(`$("#o_chasseAlerte").text()`)).toContain("plafonné à 6");
  });
});

describe("lanceur : difficulté et pertes fixées ensemble", () => {
  test("la limite qui tient s'affiche, l'autre champ garde sa valeur et montre le réel", () => {
    expect(lire(`$("#o_chasseDiffQualif").text()`)).toBe("");
    cocher("o_chasseBudgetAuto", false);
    saisir("o_chasseBudget", 5);
    // les deux fixées : les libellés disent le sens de chaque limite
    expect(lire(`$("#o_chasseDiffQualif").text()`)).toBe(" (au moins)");
    expect(lire(`$("#o_chasseBudgetQualif").text()`)).toBe(" (au plus)");
    // difficulté 9 fixée et pertes 5 % fixées : les pertes tiennent avant, le ratio réel dépasse 9
    const p = plan();
    expect(p.limite).toBe("budget");
    expect(valeur("o_chasseDiff")).toBe(9);
    expect(p.ratio).toBeGreaterThan(9.05);
    expect(lire(`$("#o_chasseDiffRep").text()`)).toContain("réel");
    expect(valeur("o_chasseBudget")).toBe(5);
    // l'inverse : pertes 500 % et difficulté 9 : la difficulté tient, les pertes réelles sont en dessous
    saisir("o_chasseBudget", 500);
    expect(plan().limite).toBe("ratio");
    expect(valeur("o_chasseBudget")).toBe(500);
    expect(lire(`$("#o_chasseBudgetInfo").text()`)).toContain("réel");
  });
});

describe("lanceur : terrain à l'arrivée vide", () => {
  test("rien à lancer : boutons désactivés, plan oublié", () => {
    saisir("o_chasseTDCDep", 0);
    expect(lire(`lanceur._simu`)).toBeNull();
    expect(lire(`$("#o_chasseEnvoyer").prop("disabled")`)).toBe(true);
    expect(lire(`$("#o_chasseAlerte").text()`)).toContain("terrain à l'arrivée");
  });
});

describe("lanceur : rendement affiché puis fixé", () => {
  test("la valeur affichée reste atteignable une fois fixée", () => {
    for (const tdc of [1500000, 1234567, 999999]) {
      saisir("o_chasseTDCDep", tdc);
      lire(`$("#o_chasseRendement").trigger("focus")`);
      expect(plan().infaisable).toBe(false);
      cocher("o_chasseRendementAuto", true);
    }
  });
});

describe("lanceur : dans la boîte (page: false)", () => {
  test("bilan sans rechargement, partage par lecture de la page Ressources", () => {
    lire(`
      $("#o_tabsChasse4").remove();
      $("body").append("<div id='o_tabsChasse4'></div>");
      var armee3 = new Armee().parseArmee("3000000 jsn, 100000 sn");
      armee3._nbrJSN = armee3.unite[0];
      var boite = new LanceurChasse(armee3, 4, { prefixe: "b_", cadre: false, page: false }).afficher($("#o_tabsChasse4"), "append");
      window.toasts = []; $.toast = (t) => window.toasts.push(t.text);
    `);
    expect(lire(`$("#b_o_chasseEnvoyerPartager").length`)).toBe(1);
    lire(`boite._finLancement(2, 3)`);
    expect(lire(`window.toasts[0]`)).toContain("2 chasses lancées sur 3");
    expect(lire(`$("#b_o_chasseEnvoyer").prop("disabled")`)).toBe(true);
    // avec partage : la page Ressources est lue puis publiée
    lire(`
      window.lectures = []; window.publie = null;
      $.ajax = (o) => { window.lectures.push(o.url); return { then: (ok) => ok("<html><body><div id='boite_tdc'></div></body></html>") }; };
      PageRessource.partagerChassesDe = (html) => { window.publie = html; };
      boite._finLancement(3, 3, true);
    `);
    expect(lire(`window.lectures[0]`)).toContain("/Ressources.php");
    expect(lire(`window.publie`)).toContain("boite_tdc");
    lire(`$("#o_tabsChasse4").remove()`);
  });
});
