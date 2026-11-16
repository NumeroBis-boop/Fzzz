import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Remplissage des entrepôts (lignes « Plein dans … » de l'encart « S5
 * Pseudo ») et bilan de la récolte (page Ressources, bloc « Récoltes »).
 * HTML du jeu relevé sur une page Ressources enregistrée (info-bulle de la
 * ligne du TdC, bloc « Récoltes », compte à rebours de la récolte) et sur une
 * capture du 16/11/2026 (phrase du pillage d'un vassal) ; joueurs et nombres
 * inventés.
 */
const page = creerPage(
  ["js/class/Utils.js", "js/class/Entrepots.js"],
  `var heure = moment("2026-11-16 10:00:00", "YYYY-MM-DD HH:mm:ss").valueOf();
   var Horloge = { maintenant: () => heure, serveur: () => moment(heure) };
   var monProfil = { pseudo: "Moi", niveauConstruction: [-1, 10, 12] };
   var ATTAQUES = [];
   var AttaqueLancee = { charger: () => ATTAQUES };
   var TITRE_STATS_MEMBRES = "Stats membres";
   var COLONIES = [], APPELS = [], NIVEAUX = {}, JOURNAL = [];
   var ExportJoueurs = {
     colonies: (p) => (APPELS.push("export " + p),
       COLONIES == "indisponible" ? Promise.reject(new Error("export indisponible")) : Promise.resolve(COLONIES)),
   };
   var SuiviMembres = {
     adresse: () => (APPELS.push("forum"), Promise.resolve({ url: "https://script.google.com/macros/s/X/exec", manque: "" })),
   };
   var ExportRapports = {
     requete: (url, methode, corps) => (APPELS.push(JSON.stringify(corps)), Promise.resolve({ ok: true, niveaux: NIVEAUX })),
   };`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);
const HEURE = lire<number>(`heure`);
const H = 3600000;
const MIN = 60000;

/** Info-bulle de la ligne du TdC de l'encart, telle que le jeu l'écrit. */
function infobulle(lignes: [string, string, string][]) {
  const corps = lignes
    .map(
      ([l, n, m]) => `<tr><td>${l}</td><td style='padding:0px 20px;' >${n}</td><td>${m}</td></tr>`,
    )
    .join("");
  return `<script language="JavaScript">$(function() {
		$("#boite_info_tdc").tooltip({
	    tooltipClass: "warning-tooltip",
	    content:"<table id='tooltip_conso' style='white-space: nowrap;'><tr style='text-align:center'><td></td><td><img src='images/icone/icone_pomme.png' width='28' height='28'/></td><td><img src='images/icone/icone_bois.png' width='28' /></td></tr><tr style='font-weight:bold'><td>Total par Jour</td><td style='padding:0px 20px;'><span>+<span style='display:none;'>_</span>${lignes[0]![1]}</span></td><td>${lignes[0]![2]}</td></tr>${corps.replace(/^<tr>.*?<\/tr>/, "")}</table>"
		});
		});</script>`;
}
/** Valeurs de la page Ressources enregistrée (joueur sans seigneur). */
const INFOBULLE = infobulle([
  ["Total par Jour", "553 439", "+916 560"],
  ["Terrain", "0", "916 560"],
  ["Champignon", "595 612", ""],
  ["Armée", "-42 173", ""],
]);
const ICONE_N = `<img  alt="nourritures" src="/images/icone/icone_pomme.png" width="18" height="18"  title="Nourriture" />`;
const ICONE_M = `<img  alt="materiaux" src="/images/icone/icone_bois.png" width="18" height="17" title="Materiaux" />`;
/** Bloc « Récoltes » de la page Ressources ; `pillage` : phrases ajoutées par le jeu. */
function recoltes(terrain: [string, string], champi: string, armee: string, pillage = "") {
  return `<table class="boite_amelioration" id="boite_ouvriere"><tr><td align="left"><p style="text-indent:0px">
Chaque jour, vous récoltez <strong id="nbNourriture">${terrain[0]}</strong> ${ICONE_N} et <strong id="nbMateriaux">${terrain[1]}</strong>${ICONE_M}</strong> sur votre terrain<br/>et <strong>${champi}</strong> ${ICONE_N} avec votre champignonnière.<br/><br/>Pendant ce temps, votre armée consomme <strong>${armee}</strong> ${ICONE_N}.${pillage}</p>
</td></tr></table>`;
}
/** Compte à rebours de la récolte, comme le script de la page Ressources. */
const COMPTE_A_REBOURS = (secondes: number) =>
  `<span id="retour_ouvrieres"></span><script>reste(${secondes}, "retour_ouvrieres");</script>`;
const AUTOMATIQUE = `<input type="radio" name="choixOuvriere" value="materiaux" checked/>`;
/** Encart « S5 Pseudo » et données cachées du jeu. */
function encart(stock: [number, number], tdc = 19095, ouvrieres = 68031) {
  return `<div id="data" style="display:none"><div id="pseudo">Moi</div><div id="nb_ouvrieres">${ouvrieres}</div><div id="nb_materiaux">${stock[1]}</div><div id="nb_nourriture">${stock[0]}.36482010334</div><div id="quantite_tdc">${tdc}</div></div>
<div id="boiteInfo" class="boite_info"><div class="contenu_boite_info"><table id="tableau_boite_info">
<tr><td class="lien tooltip_boite_info" title="Votre entrepôt de nourriture est rempli à 16%"><a class="ligne_boite_info" href="Reine.php"><img class="icone_nourriture_boite_info" alt="Nourriture" src="images/icone/icone_pomme.png"/><div class="texte_ligne_boite_info">${stock[0]}</div></a></td></tr>
<tr><td class="lien tooltip_boite_info" title="Votre entrepôt de matériaux est rempli à 35%"><a class="ligne_boite_info" href="construction.php"><img class="icone_materiaux_boite_info" alt="Materiaux" src="images/icone/icone_bois.png" width="28" /><div class="texte_ligne_boite_info">${stock[1]}</div></a></td></tr>
</table></div></div>`;
}
const ouvrir = (html: string) =>
  lire(`(() => { document.body.innerHTML = ${JSON.stringify(html)}; })()`);
const lignes = () =>
  lire<string[]>(`$("#boiteInfo .o_entrepotPlein").map((i, e) => $(e).text()).get()`);
const noterLecture = (lecture: object) =>
  lire(
    `localStorage.setItem("fzzz_recolte", JSON.stringify({ moi: Object.assign({ lu: heure, pille: [0, 0], taux: 0, choix: null, chasses: [] }, ${JSON.stringify(lecture)}) }))`,
  );
const bilan = () =>
  lire<string[]>(
    `$(".o_recolteSynthese p").map((i, e) => $(e).text().replace(/\\s+/g, " ").trim()).get()`,
  );

beforeEach(() =>
  lire(`(() => {
    localStorage.clear();
    heure = ${HEURE};
    monProfil.niveauConstruction = [-1, 10, 12];
    ATTAQUES = [];
    COLONIES = [];
    APPELS = [];
    NIVEAUX = {};
    JOURNAL = [];
    Journal.info = (s, m) => JOURNAL.push(m);
    $.ajax = () => { throw new Error("aucune requête au jeu attendue"); };
  })()`),
);
afterEach(() => lire(`clearInterval(Entrepots._minuterie)`));

describe("lectures du jeu", () => {
  test("info-bulle de la ligne du TdC (sur chaque page) : chaque ligne, [nourriture, matériaux]", () => {
    ouvrir(INFOBULLE);
    expect(lire(`Entrepots.lireInfobulle()`)).toEqual({
      total: [553439, 916560],
      terrain: [0, 916560],
      champignon: [595612, 0],
      armee: [-42173, 0],
      autres: [0, 0],
    });
    ouvrir("<p>rien</p>");
    expect(lire(`Entrepots.lireInfobulle()`)).toBeNull();
  });

  test("bloc « Récoltes » d'un vassal : production et pillage subi", () => {
    ouvrir(
      recoltes(
        ["0", "10 000 000"],
        "2 000 000",
        "50 000",
        ` et Suzerain vous pille <strong>600 000</strong> ${ICONE_N} et <strong>3 000 000</strong> ${ICONE_M}.`,
      ),
    );
    const r = lire(`(() => { let r = Entrepots.lireRecolte(); delete r.$p; return r; })()`);
    expect(r).toEqual({
      terrain: [0, 10000000],
      champignon: [2000000, 0],
      armee: [-50000, 0],
      pille: [600000, 3000000],
    });
  });

  test("prochaine récolte : compte à rebours de la page Ressources", () => {
    ouvrir(COMPTE_A_REBOURS(227));
    expect(lire(`Entrepots.prochaineRecolte()`)).toBe(HEURE + 227000);
    ouvrir("<p>rien</p>");
    expect(lire(`Entrepots.prochaineRecolte()`)).toBeNull();
  });
});

describe("formules", () => {
  test("champignonnière : 72 × 1,7^niveau arrondi en dessous (page Construction et captures)", () => {
    expect(lire(`[0, 17, 18, 20, 21].map((n) => Entrepots.productionChampignonniere(n))`)).toEqual([
      0, 595612, 1012542, 2926246, 4974619,
    ]);
  });

  test("taxe d'une colonie : 20 % plus 1 % par niveau d'Étable à pucerons du seigneur", () => {
    expect(lire<number>(`Entrepots.tauxColonie(0)`)).toBeCloseTo(0.2, 10);
    expect(lire<number>(`Entrepots.tauxColonie(6)`)).toBeCloseTo(0.26, 10);
    expect(lire(`Entrepots.tauxColonie(-1)`)).toBeNull();
  });
});

describe("calcul pas à pas", () => {
  const simuler = (e: object) =>
    lire<{ plein: number | null; famine: number | null }>(
      `Entrepots.simuler(Object.assign({ stock: 0, capacite: 1000, continu: 0, recolte: 0, prochaine: null, gains: [], convois: [], maintenant: heure }, ${JSON.stringify(e)}))`,
    );

  test("récolte du terrain toutes les 30 min, à l'heure de la récolte du jeu", () => {
    // 48 000 par jour : 1 000 à chaque récolte ; récoltes à +10 min, +40 min, +70 min
    expect(simuler({ capacite: 2500, recolte: 48000, prochaine: HEURE + 10 * MIN }).plein).toBe(
      HEURE + 70 * MIN,
    );
    // heure de récolte gardée d'une page ouverte plus tôt : la suivante s'en déduit
    expect(simuler({ capacite: 2500, recolte: 48000, prochaine: HEURE - 20 * MIN }).plein).toBe(
      HEURE + 70 * MIN,
    );
    // sans heure de récolte connue : récolte étalée sur la journée
    expect(simuler({ capacite: 1000, recolte: 48000 }).plein).toBe(HEURE + 30 * MIN);
  });

  test("champignonnière et armée en continu, entre les récoltes", () => {
    expect(simuler({ capacite: 1000, continu: 1000 }).plein).toBe(HEURE + 24 * H);
    // 100 par heure de champignonnière et 1 000 à chaque récolte : 1 050 à la première
    expect(
      simuler({ capacite: 1040, continu: 2400, recolte: 48000, prochaine: HEURE + 30 * MIN }).plein,
    ).toBe(HEURE + 30 * MIN);
    // puis la champignonnière remplit le reste entre deux récoltes : 50 en 30 min
    expect(
      simuler({ capacite: 1100, continu: 2400, recolte: 48000, prochaine: HEURE + 30 * MIN }).plein,
    ).toBe(HEURE + 60 * MIN);
  });

  test("famine : la nourriture tombe à zéro ; déjà plein ; plus d'un an", () => {
    expect(simuler({ stock: 100, continu: -2400 })).toEqual({ plein: null, famine: HEURE + H });
    expect(simuler({ stock: 1000 }).plein).toBe(HEURE);
    expect(simuler({ continu: 2 })).toEqual({ plein: null, famine: null });
  });

  test("convoi qui arrive : ajouté à son arrivée ; terre gagnée : récolte en plus", () => {
    expect(simuler({ convois: [{ t: HEURE + 3 * H, q: 1000 }] }).plein).toBe(HEURE + 3 * H);
    // un convoi déjà arrivé ne compte pas
    expect(simuler({ convois: [{ t: HEURE - H, q: 1000 }] }).plein).toBeNull();
    // rien, puis 48 000 par jour à partir de +1 h : 1 000 à la récolte de +1 h 10
    expect(
      simuler({
        capacite: 1000,
        prochaine: HEURE + 10 * MIN,
        gains: [{ t: HEURE + H, d: 48000 }],
      }).plein,
    ).toBe(HEURE + 70 * MIN);
  });

  test("terre gagnée : seulement avec l'affectation automatique, tant qu'il reste des ouvrières", () => {
    const ch = (partNourriture: number | null, ouvrieres = 150) =>
      lire(
        `Entrepots.changements([{ t: heure + ${H}, terrain: 100 }, { t: heure + ${2 * H}, terrain: 100 }], { tdc: 100, ouvrieres: ${ouvrieres}, partNourriture: ${partNourriture}, taux: 0.3 })`,
      );
    // +50 cm² exploités (150 ouvrières), puis plus rien : 50 × 48 × 0,7
    expect(ch(0)).toEqual([[], [{ t: HEURE + H, d: 1680 }]]);
    expect(ch(1)).toEqual([[{ t: HEURE + H, d: 1680 }], []]);
    // sans affectation automatique, le jeu ne met pas d'ouvrières sur la terre gagnée
    expect(ch(null)).toEqual([[], []]);
  });

  test("convois de la page Convois : ceux qui arrivent chez le joueur, pas encore arrivés", () => {
    lire(`localStorage.setItem("outiiil_evolution", JSON.stringify({ convoi: [
      { cible: "Grenier", sens: false, nou: "200000", mat: "0", exp: moment(heure + ${2 * H}).toISOString() },
      { cible: "Grenier", sens: false, nou: "0", mat: "50000", exp: moment(heure - ${H}).toISOString() },
      { cible: "Autre", sens: true, nou: "0", mat: "90000", exp: moment(heure + ${H}).toISOString() },
    ] }))`);
    expect(lire(`Entrepots.convois(heure)`)).toEqual([[{ t: HEURE + 2 * H, q: 200000 }], []]);
  });

  test("libellés : plein, famine, sans remplissage", () => {
    const lib = (e: object) =>
      lire<string | null>(
        `Entrepots.libelle(Object.assign({ famine: null }, ${JSON.stringify(e)}), heure)`,
      );
    expect(lib({ capacite: 9, debit: 1, instant: HEURE + 53 * H })).toBe("Plein dans 2 j 5 h");
    expect(lib({ capacite: 9, debit: 1, instant: HEURE + 5 * H + 7 * MIN })).toBe(
      "Plein dans 5 h 07",
    );
    expect(lib({ capacite: 9, debit: 1, instant: HEURE + 12 * MIN })).toBe("Plein dans 12 min");
    expect(lib({ capacite: 9, debit: 1, instant: HEURE - MIN })).toBe("Entrepôt plein");
    expect(lib({ capacite: 9, debit: -5, instant: null })).toBe("Ne se remplit pas");
    expect(lib({ capacite: 9, debit: 1, instant: null })).toBe("Plein dans plus d'un an");
    expect(lib({ capacite: null, debit: 1, instant: null })).toBeNull();
    expect(lib({ capacite: 9, debit: -5, instant: null, famine: HEURE + 3 * H })).toBe(
      "Famine dans 3 h 00",
    );
    expect(lib({ capacite: null, debit: -5, instant: null, famine: HEURE - MIN })).toBe(
      "Famine en cours",
    );
  });
});

describe("encart « S5 Pseudo » : lignes sous la nourriture et les matériaux", () => {
  test("production de l'info-bulle, capacité par niveau d'entrepôt : temps avant plein", () => {
    ouvrir(encart([197540, 3460273]) + INFOBULLE);
    lire(`Entrepots.afficher()`);
    // sans page Ressources lue, récolte étalée : nourriture 1 229 300 − 197 540 à 553 439
    // par jour ; matériaux 4 915 700 − 3 460 273 à 916 560
    expect(lignes()).toEqual(["Plein dans 1 j 20 h", "Plein dans 1 j 14 h"]);
    expect(
      lire(`$(".icone_nourriture_boite_info").closest("td").children(".o_entrepotPlein").length`),
    ).toBe(1);
    // affiché de nouveau : pas de ligne en double
    lire(`Entrepots.afficher()`);
    expect(lignes().length).toBe(2);
    expect(lire<string>(`Entrepots.ligneInfobulle(1)`)).toBe(
      "<br/>Production : +916 560 par jour<br/>Entrepôt plein le 18/11 à 00h06",
    );
  });

  test("heure de la récolte connue : plein à une récolte du jeu", () => {
    noterLecture({ recolte: HEURE + 10 * MIN });
    ouvrir(encart([197540, 3460273]) + INFOBULLE);
    lire(`Entrepots.afficher()`);
    // matériaux : 19 095 à chaque récolte, 77 récoltes, la 1re à 10h10 : le 18/11 à 00h10
    expect(lire<string>(`Entrepots.ligneInfobulle(1)`)).toContain(
      "Entrepôt plein le 18/11 à 00h10",
    );
  });

  test("entrepôt plein en rouge ; niveau inconnu : capacité d'après le pourcentage de l'encart", () => {
    lire(`monProfil.niveauConstruction = [-1, -1, 1]`);
    ouvrir(encart([197540, 3460273]) + INFOBULLE);
    lire(`Entrepots.afficher()`);
    // nourriture : 197 540 / 16 % = 1 234 625 ; matériaux : 2 900 de capacité, déjà dépassée
    expect(lignes()).toEqual(["Plein dans 1 j 20 h", "Entrepôt plein"]);
    expect(
      lire(`$(".o_entrepotPlein").map((i, e) => $(e).hasClass("o_entrepotAlerte")).get()`),
    ).toEqual([false, true]);
  });

  test("plein dans moins de 8 h : en rouge ; à 8 h et plus : couleur normale", () => {
    const rouges = (stockMateriaux: number) => {
      ouvrir(encart([197540, stockMateriaux]) + INFOBULLE);
      lire(`Entrepots.afficher()`);
      return lire<any[]>(
        `$(".o_entrepotPlein").map((i, e) => $(e).text() + ($(e).hasClass("o_entrepotAlerte") ? " (rouge)" : "")).get()`,
      );
    };
    // matériaux : 4 915 700 de capacité, 916 560 par jour, soit 38 190 par heure
    expect(rouges(4915700 - 38190 * 7.5)).toEqual([
      "Plein dans 1 j 20 h",
      "Plein dans 7 h 30 (rouge)",
    ]);
    expect(rouges(4915700 - 38190 * 8.5)).toEqual(["Plein dans 1 j 20 h", "Plein dans 8 h 30"]);
  });

  test("armée qui mange plus que la production : « Famine dans … », en rouge sous 8 h", () => {
    const famine = infobulle([
      ["Total par Jour", "-42 173", "+0"],
      ["Terrain", "0", "0"],
      ["Champignon", "0", ""],
      ["Armée", "-42 173", ""],
    ]);
    ouvrir(encart([197540, 3460273]) + famine);
    lire(`Entrepots.afficher()`);
    // 197 540 ÷ 42 173 par jour = 4 j 16 h ; matériaux : rien ne rentre
    expect(lignes()).toEqual(["Famine dans 4 j 16 h", "Ne se remplit pas"]);
    expect(lire<string>(`Entrepots.ligneInfobulle(0)`)).toBe(
      "<br/>Production : -42 173 par jour<br/>Famine le 21/11 à 02h25",
    );
    ouvrir(encart([10000, 3460273]) + famine);
    lire(`Entrepots.afficher()`);
    expect(
      lire(
        `$(".o_entrepotPlein").first().text() + " " + $(".o_entrepotPlein").first().hasClass("o_entrepotAlerte")`,
      ),
    ).toBe("Famine dans 5 h 41 true");
    ouvrir(encart([197540, 3460273]));
    lire(`Entrepots.afficher()`);
    expect(lignes()).toEqual([]);
  });

  test("vassal : la part du seigneur lue sur la page Ressources est déduite quand l'info-bulle ne la compte pas", () => {
    noterLecture({ pille: [0, 274968], taux: 0.3, choix: "materiaux" });
    ouvrir(encart([197540, 3460273]) + INFOBULLE);
    lire(`Entrepots.afficher()`);
    // matériaux : 916 560 × 0,7 = 641 592 par jour
    expect(lignes()[1]).toBe("Plein dans 2 j 6 h");
    expect(lire<string>(`Entrepots.ligneInfobulle(1)`)).toContain(
      "Production : +641 592 par jour (pillage subi compté)",
    );
  });

  test("le total de l'info-bulle compte déjà le pillage (ligne en plus) : pas déduit deux fois", () => {
    noterLecture({ pille: [0, 274968], taux: 0.3, choix: "materiaux" });
    ouvrir(
      encart([197540, 3460273]) +
        infobulle([
          ["Total par Jour", "553 439", "+641 592"],
          ["Terrain", "0", "916 560"],
          ["Champignon", "595 612", ""],
          ["Armée", "-42 173", ""],
          ["Suzerain", "0", "-274 968"],
        ]),
    );
    lire(`Entrepots.afficher()`);
    expect(lignes()[1]).toBe("Plein dans 2 j 6 h");
  });

  test("rentrées de TdC : chasses et floods lancés, exploités avec l'affectation automatique", () => {
    const avecChasses = (choix: string) => {
      noterLecture({
        choix,
        chasses: [
          { t: HEURE + 2 * H, terrain: 20000 },
          { t: HEURE - H, terrain: 50000 },
        ],
      });
      lire(
        `ATTAQUES = [{ id: 7, arrivee: heure + ${3 * H} - 20000, terrainDepart: 60000, terrainCible: 50000 }, { id: null, arrivee: null }]`,
      );
      ouvrir(encart([197540, 3460273]) + INFOBULLE);
      lire(`Entrepots.afficher()`);
      return lignes();
    };
    // chasse dans 2 h (+20 000 cm²) et flood dont le RC est dans 3 h (+10 000 cm²) :
    // 68 031 ouvrières pour 19 095 cm², tout est exploité, en matériaux :
    // 2 h à 916 560, 1 h à 1 876 560, puis 2 356 560 par jour
    expect(avecChasses("materiaux")).toEqual(["Plein dans 1 j 20 h", "Plein dans 16 h 15"]);
    // sans affectation automatique : la terre gagnée ne rapporte rien
    expect(avecChasses("rien")).toEqual(["Plein dans 1 j 20 h", "Plein dans 1 j 14 h"]);
  });

  test("convoi qui arrive (page Convois) : compté à son arrivée, montré dans l'info-bulle", () => {
    lire(`localStorage.setItem("outiiil_evolution", JSON.stringify({ convoi: [
      { cible: "Grenier", sens: false, nou: "0", mat: "1000000", exp: moment(heure + ${2 * H}).toISOString() },
    ] }))`);
    ouvrir(encart([197540, 3460273]) + INFOBULLE);
    lire(`Entrepots.afficher()`);
    // 2 h à 916 560 par jour, +1 000 000, puis 379 047 qui manquent à 916 560 par jour
    expect(lignes()[1]).toBe("Plein dans 11 h 56");
    expect(lire<string>(`Entrepots.ligneInfobulle(1)`)).toContain("Convois attendus : +1 000 000");
  });

  test("ligne remise à l'heure chaque minute, sans refaire le calcul", () => {
    ouvrir(encart([197540, 3460273]) + INFOBULLE);
    lire(`Entrepots.afficher()`);
    expect(lire(`Entrepots._minuterie != null`)).toBe(true);
    // stock de la page changé : la ligne ne le relit pas, seule l'heure avance
    lire(`(() => { $("#nb_materiaux").text("10"); heure += ${10 * H}; Entrepots.majLignes(); })()`);
    expect(lignes()).toEqual(["Plein dans 1 j 10 h", "Plein dans 1 j 4 h"]);
    lire(`(() => { heure += ${30 * H}; Entrepots.majLignes(); })()`);
    expect(lignes()[1]).toBe("Entrepôt plein");
  });
});

describe("page Ressources : bilan sous « Récoltes »", () => {
  const VASSAL = infobulle([
    ["Total par Jour", "1 950 000", "+10 000 000"],
    ["Terrain", "0", "10 000 000"],
    ["Champignon", "2 000 000", ""],
    ["Armée", "-50 000", ""],
  ]);
  const PILLAGE = ` et Suzerain vous pille <strong>600 000</strong> ${ICONE_N} et <strong>3 000 000</strong> ${ICONE_M}.`;

  test("séparateur fin puis le bilan du jour, pillage subi et armée déduits, dans le même bloc", async () => {
    ouvrir(
      encart([197540, 3460273]) +
        VASSAL +
        recoltes(["0", "10 000 000"], "2 000 000", "50 000", PILLAGE) +
        COMPTE_A_REBOURS(227) +
        AUTOMATIQUE,
    );
    await lire<Promise<void>>(`Entrepots.recolte([])`);
    const bloc = lire<any>(`(() => {
      let $s = $(".o_recolteSynthese");
      return {
        place: $s.parent().is("#boite_ouvriere td") && $s.prev().is("p"),
        separateur: $s.children().first().is("hr.o_recolteSeparateur"),
        icones: $s.find("img").map((i, e) => e.getAttribute("alt")).get(),
      };
    })()`);
    expect(bloc).toEqual({ place: true, separateur: true, icones: ["nourritures", "materiaux"] });
    // nourriture : 2 000 000 − 50 000 (armée) − 600 000 ; matériaux : 10 000 000 − 3 000 000
    expect(bilan()).toEqual([
      "En prenant en compte les vassalisations, la consommation de l'armée et les productions actuelles, chaque jour, vous gagnez 1 350 000 et 7 000 000 .",
    ]);
    // lecture gardée pour les autres pages : part du seigneur, affectation, production, récolte
    expect(lire(`Entrepots.lecture()`)).toMatchObject({
      pille: [600000, 3000000],
      taux: 0.3,
      choix: "materiaux",
      production: { terrain: [0, 10000000], champignon: [2000000, 0], armee: [-50000, 0] },
      recolte: HEURE + 227000,
      colonies: { vassaux: [], total: [0, 0] },
    });
    // page relue : un seul bilan
    await lire<Promise<void>>(`Entrepots.recolte([])`);
    expect(lire(`$(".o_recolteSynthese").length`)).toBe(1);
  });

  test("armée qui mange plus que la production : « vous perdez »", async () => {
    ouvrir(
      encart([197540, 3460273]) +
        infobulle([
          ["Total par Jour", "-42 173", "+916 560"],
          ["Terrain", "0", "916 560"],
          ["Champignon", "0", ""],
          ["Armée", "-42 173", ""],
        ]) +
        recoltes(["0", "916 560"], "0", "42 173"),
    );
    await lire<Promise<void>>(`Entrepots.recolte([])`);
    expect(bilan()[0]).toContain("chaque jour, vous perdez 42 173 et gagnez 916 560 .");
    expect(lire<string>(`Entrepots.phraseBilan([-5, -7]).replace(/<[^>]*>/g, "")`)).toBe(
      "vous perdez 5  et 7 ",
    );
  });

  test("seigneur : pillage de ses colonies calculé (export, niveau d'étable, fichier « Stats membres »)", async () => {
    lire(`(() => {
      monProfil.niveauConstruction = [-1, 10, 12, 0, 0, 0, 0, 0, 0, 0, 0, 6];
      COLONIES = [{ pseudo: "Vassal", terrain: 100000 }, { pseudo: "Hors <b>OUAF</b>", terrain: 50000 }];
      NIVEAUX = { Vassal: { champignonniere: 20, jour: "2026-11-16" } };
    })()`);
    ouvrir(encart([197540, 3460273]) + INFOBULLE + recoltes(["0", "916 560"], "595 612", "42 173"));
    await lire<Promise<void>>(`Entrepots.recolte([])`);
    // taxe 26 % : champignonnière niveau 20 (2 926 246) → 760 823 ; TdC 100 000 × 48 → 1 248 000,
    // 50 000 × 48 → 624 000, en matériaux ; l'autre colonie, absente du fichier, sans champignonnière
    expect(bilan()).toEqual([
      "En prenant en compte les vassalisations, la consommation de l'armée et les productions actuelles, chaque jour, vous gagnez 1 314 262 et 2 788 560 .",
      "Dont le pillage de vos colonies (26 %) : 760 823 et 1 872 000 . Vassal : TdC 100 000, champignonnière niveau 20 ; Hors <b>OUAF</b> : TdC 50 000, champignonnière inconnue. Le TdC d'une colonie est compté en matériaux, une champignonnière absente du fichier « Stats membres » ne compte pas.",
    ]);
    expect(lire(`$(".o_recolteSynthese b").length`)).toBe(0);
    expect(lire(`APPELS`)).toEqual([
      "export Moi",
      "forum",
      JSON.stringify({ niveaux: { joueurs: ["Vassal", "Hors <b>OUAF</b>"] } }),
    ]);
    // pas compté dans le remplissage, montré dans l'info-bulle
    expect(lignes()).toEqual(["Plein dans 1 j 20 h", "Plein dans 1 j 14 h"]);
    expect(lire<string>(`Entrepots.ligneInfobulle(1)`)).toContain(
      "Pillage de vos colonies : +1 872 000 par jour (non compté)",
    );
    // niveaux gardés un jour : la page relue ne relit pas le fichier
    lire(`APPELS = []`);
    await lire<Promise<void>>(`Entrepots.recolte([])`);
    expect(lire(`APPELS`)).toEqual(["export Moi"]);
  });

  test("seigneur sans niveau d'étable connu ; export indisponible : bilan sans colonies", async () => {
    lire(`COLONIES = [{ pseudo: "Vassal", terrain: 100000 }]`);
    ouvrir(encart([197540, 3460273]) + INFOBULLE + recoltes(["0", "916 560"], "595 612", "42 173"));
    await lire<Promise<void>>(`Entrepots.recolte([])`);
    expect(bilan()).toEqual([
      "En prenant en compte les vassalisations, la consommation de l'armée et les productions actuelles, chaque jour, vous gagnez 553 439 et 916 560 .",
      "Pillage de vos colonies non compté : niveau de votre Étable à pucerons inconnu (ouvrez la page Construction).",
    ]);
    lire(`(() => { localStorage.clear(); COLONIES = "indisponible"; })()`);
    await lire<Promise<void>>(`Entrepots.recolte([])`);
    expect(bilan().length).toBe(1);
    expect(lire(`JOURNAL`)).toEqual(["colonies non relues"]);
  });

  test("case « remplissageEntrepots » décochée : ni bilan ni lignes ni requête, la lecture est gardée", async () => {
    lire(`(() => {
      localStorage.setItem("fzzz_affichage_remplissageEntrepots", "0");
      COLONIES = [{ pseudo: "Vassal", terrain: 100000 }];
    })()`);
    ouvrir(
      encart([197540, 3460273]) +
        INFOBULLE +
        recoltes(["0", "916 560"], "595 612", "42 173") +
        AUTOMATIQUE,
    );
    await lire<Promise<void>>(`Entrepots.recolte([])`);
    expect(lire(`$(".o_recolteSynthese, .o_entrepotPlein").length`)).toBe(0);
    expect(lire<string>(`Entrepots.ligneInfobulle(1)`)).toBe("");
    expect(lire(`APPELS`)).toEqual([]);
    expect(lire(`Entrepots.lecture().choix`)).toBe("materiaux");
    // cochée par défaut
    lire(`localStorage.removeItem("fzzz_affichage_remplissageEntrepots")`);
    lire(`Entrepots.afficher()`);
    expect(lignes().length).toBe(2);
  });
});
