import { beforeEach, describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Remplissage des entrepôts (lignes « Plein dans … » de l'encart « S5
 * Pseudo ») et synthèse de la récolte (page Ressources, bloc « Récoltes »).
 * HTML du jeu relevé sur une page Ressources enregistrée (info-bulle de la
 * ligne du TdC, bloc « Récoltes ») et sur une capture du 16/11/2026 (phrase du
 * pillage d'un vassal, 30 % de la production) ; joueurs et nombres inventés.
 */
const page = creerPage(
  ["js/class/Utils.js", "js/class/Entrepots.js"],
  `var heure = moment("2026-11-16 10:00:00", "YYYY-MM-DD HH:mm:ss").valueOf();
   var Horloge = { maintenant: () => heure, serveur: () => moment(heure) };
   var monProfil = { pseudo: "Moi", niveauConstruction: [-1, 10, 12] };
   var ATTAQUES = [];
   var AttaqueLancee = { charger: () => ATTAQUES };`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);
const HEURE = lire<number>(`heure`);
const H = 3600000;

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

beforeEach(() =>
  lire(`(() => {
    localStorage.clear();
    heure = ${HEURE};
    monProfil.niveauConstruction = [-1, 10, 12];
    ATTAQUES = [];
    $.ajax = () => { throw new Error("aucune requête attendue"); };
  })()`),
);

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

  test("bloc « Récoltes » d'un vassal : production et pillage du seigneur (30 %)", () => {
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
      recu: [0, 0],
    });
  });

  test("seigneur (texte supposé « vous pillez … ») et vassal à la fois : chaque montant à son verbe", () => {
    ouvrir(
      recoltes(
        ["0", "10 000 000"],
        "2 000 000",
        "50 000",
        ` et Suzerain vous pille <strong>600 000</strong> ${ICONE_N} et <strong>3 000 000</strong> ${ICONE_M} et vous pillez <strong>12 000</strong> ${ICONE_N} et <strong>45 000</strong> ${ICONE_M} à Vassal2.`,
      ),
    );
    expect(
      lire(`(() => { let r = Entrepots.lireRecolte(); return [r.pille, r.recu]; })()`),
    ).toEqual([
      [600000, 3000000],
      [12000, 45000],
    ]);
  });
});

describe("page Ressources : synthèse sous « Récoltes »", () => {
  const VASSAL = infobulle([
    ["Total par Jour", "1 950 000", "+10 000 000"],
    ["Terrain", "0", "10 000 000"],
    ["Champignon", "2 000 000", ""],
    ["Armée", "-50 000", ""],
  ]);
  const PILLAGE = ` et Suzerain vous pille <strong>600 000</strong> ${ICONE_N} et <strong>3 000 000</strong> ${ICONE_M}.`;

  test("séparateur fin puis la récolte du jour, pillage déduit, dans le même bloc", () => {
    ouvrir(
      encart([197540, 3460273]) +
        VASSAL +
        recoltes(["0", "10 000 000"], "2 000 000", "50 000", PILLAGE) +
        `<input type="radio" name="choixOuvriere" value="materiaux" checked/>`,
    );
    lire(`Entrepots.recolte([])`);
    const bloc = lire<any>(`(() => {
      let $s = $(".o_recolteSynthese");
      return {
        place: $s.parent().is("#boite_ouvriere td") && $s.prev().is("p"),
        separateur: $s.children().first().is("hr.o_recolteSeparateur"),
        texte: $s.find("p").text().replace(/\\s+/g, " ").trim(),
        icones: $s.find("img").map((i, e) => e.getAttribute("alt")).get(),
      };
    })()`);
    expect(bloc).toEqual({
      place: true,
      separateur: true,
      texte:
        "En prenant en compte les vassalisations et les productions actuelles, chaque jour, vous récoltez 1 400 000 et 7 000 000 sur votre terrain et avec votre champignonnière.",
      icones: ["nourritures", "materiaux"],
    });
    // lecture gardée pour les autres pages : part du seigneur, affectation, production
    expect(lire(`Entrepots.lecture()`)).toMatchObject({
      pille: [600000, 3000000],
      recu: [0, 0],
      taux: 0.3,
      choix: "materiaux",
      production: { terrain: [0, 10000000], champignon: [2000000, 0], armee: [-50000, 0] },
    });
    // page relue : une seule synthèse
    lire(`Entrepots.recolte([])`);
    expect(lire(`$(".o_recolteSynthese").length`)).toBe(1);
  });

  test("sans seigneur ni vassal : la récolte du jour telle quelle", () => {
    ouvrir(encart([197540, 3460273]) + INFOBULLE + recoltes(["0", "916 560"], "595 612", "42 173"));
    lire(`Entrepots.recolte([])`);
    expect(lire<string>(`$(".o_recolteSynthese p").text().replace(/\\s+/g, " ")`)).toContain(
      "vous récoltez 595 612 et 916 560 sur votre terrain",
    );
  });
});

describe("calcul du remplissage", () => {
  test("à débit constant, déjà plein, ne se remplit pas, au-delà d'un an", () => {
    const plein = (stock: number, cap: number, debit: number, ch: object[] = []) =>
      lire<number | null>(
        `Entrepots.instantPlein(${stock}, ${cap}, ${debit}, ${JSON.stringify(ch)}, heure)`,
      );
    expect(plein(0, 1000, 1000)).toBe(HEURE + 24 * H);
    expect(plein(1000, 1000, 1000)).toBe(HEURE);
    expect(plein(10, 1000, -10)).toBeNull();
    expect(plein(0, 1000, 2)).toBeNull();
    // rien pendant 12 h, puis 2 000 par jour : plein 12 h plus tard
    expect(plein(0, 1000, 0, [{ t: HEURE + 12 * H, d: 2000 }])).toBe(HEURE + 24 * H);
    // un changement passé ne compte pas
    expect(plein(0, 1000, 1000, [{ t: HEURE - H, d: 5000 }])).toBe(HEURE + 24 * H);
  });

  test("terre gagnée : exploitée tant qu'il reste des ouvrières, part du seigneur déduite", () => {
    const ch = lire(
      `Entrepots.changements([{ t: heure + ${H}, terrain: 100 }, { t: heure + ${2 * H}, terrain: 100 }], { tdc: 100, ouvrieres: 150, partNourriture: 0, taux: 0.3 })`,
    );
    // +50 cm² exploités (150 ouvrières), puis plus rien : 50 × 48 × 0,7
    expect(ch).toEqual([[], [{ t: HEURE + H, d: 1680 }]]);
    expect(
      lire(
        `Entrepots.changements([{ t: heure + ${H}, terrain: 100 }], { tdc: 100, ouvrieres: 0, partNourriture: 0.25, taux: 0 })`,
      ),
    ).toEqual([[{ t: HEURE + H, d: 1200 }], [{ t: HEURE + H, d: 3600 }]]);
    // répartition inconnue (rien d'exploité, pas d'affectation lue) : pas comptée
    expect(
      lire(
        `Entrepots.changements([{ t: heure + ${H}, terrain: 100 }], { tdc: 100, ouvrieres: 0, partNourriture: null, taux: 0 })`,
      ),
    ).toEqual([[], []]);
  });

  test("libellés : « Plein dans 2 j 5 h », « 5 h 07 », « 12 min », plein, sans remplissage", () => {
    const lib = (e: object) =>
      lire<string | null>(`Entrepots.libelle(${JSON.stringify(e)}, heure)`);
    expect(lib({ capacite: 9, debit: 1, instant: HEURE + 53 * H })).toBe("Plein dans 2 j 5 h");
    expect(lib({ capacite: 9, debit: 1, instant: HEURE + 5 * H + 7 * 60000 })).toBe(
      "Plein dans 5 h 07",
    );
    expect(lib({ capacite: 9, debit: 1, instant: HEURE + 12 * 60000 })).toBe("Plein dans 12 min");
    expect(lib({ capacite: 9, debit: 1, instant: HEURE })).toBe("Entrepôt plein");
    expect(lib({ capacite: 9, debit: -5, instant: null })).toBe("Ne se remplit pas");
    expect(lib({ capacite: 9, debit: 1, instant: null })).toBe("Plein dans plus d'un an");
    expect(lib({ capacite: null, debit: 1, instant: null })).toBeNull();
  });
});

describe("encart « S5 Pseudo » : lignes sous la nourriture et les matériaux", () => {
  test("production de l'info-bulle, capacité par niveau d'entrepôt : temps avant plein", () => {
    ouvrir(encart([197540, 3460273]) + INFOBULLE);
    lire(`Entrepots.afficher()`);
    // nourriture : 1 229 300 − 197 540 à 553 439 par jour ; matériaux : 4 915 700 − 3 460 273 à 916 560
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

  test("entrepôt plein en rouge ; niveau inconnu : capacité d'après le pourcentage de l'encart", () => {
    lire(`monProfil.niveauConstruction = [-1, -1, 1]`);
    ouvrir(encart([197540, 3460273]) + INFOBULLE);
    lire(`Entrepots.afficher()`);
    // nourriture : 197 540 / 16 % = 1 234 625 ; matériaux : 2 900 de capacité, déjà dépassée
    expect(lignes()).toEqual(["Plein dans 1 j 20 h", "Entrepôt plein"]);
    expect(lire(`$(".o_entrepotRempli").length`)).toBe(1);
  });

  test("stock qui baisse : « Ne se remplit pas » ; production inconnue : aucune ligne", () => {
    ouvrir(
      encart([197540, 3460273]) +
        infobulle([
          ["Total par Jour", "-42 173", "+0"],
          ["Terrain", "0", "0"],
          ["Champignon", "0", ""],
          ["Armée", "-42 173", ""],
        ]),
    );
    lire(`Entrepots.afficher()`);
    expect(lignes()).toEqual(["Ne se remplit pas", "Ne se remplit pas"]);
    ouvrir(encart([197540, 3460273]));
    lire(`Entrepots.afficher()`);
    expect(lignes()).toEqual([]);
  });

  test("vassal : la part du seigneur lue sur la page Ressources est déduite quand l'info-bulle ne la compte pas", () => {
    lire(
      `localStorage.setItem("fzzz_recolte", JSON.stringify({ moi: { lu: heure, pille: [0, 274968], recu: [0, 0], taux: 0.3, choix: "materiaux", chasses: [] } }))`,
    );
    ouvrir(encart([197540, 3460273]) + INFOBULLE);
    lire(`Entrepots.afficher()`);
    // matériaux : 916 560 × 0,7 = 641 592 par jour
    expect(lignes()[1]).toBe("Plein dans 2 j 6 h");
    expect(lire<string>(`Entrepots.ligneInfobulle(1)`)).toContain(
      "Production : +641 592 par jour (pillage compté)",
    );
  });

  test("le total de l'info-bulle compte déjà le pillage (ligne en plus) : pas déduit deux fois", () => {
    lire(
      `localStorage.setItem("fzzz_recolte", JSON.stringify({ moi: { lu: heure, pille: [0, 274968], recu: [0, 0], taux: 0.3, choix: "materiaux", chasses: [] } }))`,
    );
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

  test("rentrées de TdC : chasses de la page Ressources et floods lancés, exploitées par les ouvrières libres", () => {
    ouvrir(encart([197540, 3460273]) + INFOBULLE);
    lire(`Entrepots.afficher()`);
    const sans = lignes()[1];
    // chasse dans 2 h (+20 000 cm²) et flood lancé, rapport dans 3 h (+10 000 cm²) :
    // 68 031 ouvrières pour 19 095 cm², tout est exploité, en matériaux
    lire(`(() => {
      localStorage.setItem("fzzz_recolte", JSON.stringify({ moi: { lu: heure, pille: [0, 0], recu: [0, 0], taux: 0, choix: "materiaux",
        chasses: [{ t: heure + ${2 * H}, terrain: 20000 }, { t: heure - ${H}, terrain: 50000 }] } }));
      ATTAQUES = [{ id: 7, arrivee: heure + ${3 * H} - 20000, terrainDepart: 60000, terrainCible: 50000 }, { id: null, arrivee: null }];
    })()`);
    lire(`Entrepots.afficher()`);
    const avec = lignes()[1];
    expect(sans).toBe("Plein dans 1 j 14 h");
    // 2 h à 916 560, 1 h à 1 876 560, puis 2 356 560 par jour : 16 h 14,9 min
    expect(avec).toBe("Plein dans 16 h 15");
    // la nourriture n'en profite pas (affectation automatique aux matériaux)
    expect(lignes()[0]).toBe("Plein dans 1 j 20 h");
  });
});
