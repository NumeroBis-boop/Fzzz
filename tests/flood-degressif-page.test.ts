import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

const page = creerPage(
  [
    "js/lib/jquery-ui_1.12.1.js",
    "js/lib/moment-duration-format.js",
    "js/lib/globalize_0.1.1.js",
    "js/lib/globalize-locale-fr.js",
    "js/class/Utils.js",
    "js/class/Parametre.js",
    "js/class/Joueur.js",
    "js/class/Armee.js",
    "js/page/Attaquer.js",
  ],
  `var METHODE_FLOOD = ["Standard", "Optimisée", "Uniforme", "Dégressive"],
     AFFECTATION_RESSOURCE = [], RATIO_RECOLTE = {}, TOAST_WARNING = {};
   var NOM_UNITE = ["Ouvrière", "Jeune Soldate Naine"];`,
);

// lanceur de flood ouvert sur une cible à 100 000 cm², armée largement suffisante
function ouvrir(reglages: object) {
  page.lire(`(() => {
    localStorage.setItem("outiiil_parametre", JSON.stringify({ reserveFlood: 0, reserveFloodAuto: false, ...${JSON.stringify(reglages)} }));
    window.monProfil = new Joueur({ pseudo: "Moi" }).getParametre();
    document.body.innerHTML = '<span id="quantite_tdc">100000</span><table class="simulateur"></table>';
    window.p = Object.create(PageAttaquer.prototype);
    p._cible = { pseudo: "X", terrain: 100000, x: 0, y: 0 };
    p._armee = new Armee({ unite: { "Jeune Soldate Naine": 1000000 } });
    p._nbAttaque = 4;
    p.formulaireFlood();
    // happy-dom ignore l'option marquée selected (il renvoie toujours la 2e) :
    // la liste est remise sur la méthode réglée, comme l'afficherait un navigateur
    $("#o_methodeFlood").val(String(monProfil.parametre.methodeFlood.valeur)).trigger("change");
  })()`);
}
const attaques = () =>
  page.lire<number[]>(`[1, 2, 3].map((i) => $("#o_attaque" + i).spinner("value"))`);
const saisir = (ligne: number, valeur: number) =>
  page.lire(`$("#o_attaque${ligne}").spinner("value", ${valeur}).trigger("input")`);

describe("page d'attaque : flood dégressif réglable", () => {
  test("préférences par défaut : 20 % du TdC restant, comme avant", () => {
    ouvrir({ methodeFlood: 3 });
    expect(attaques()).toEqual([20000, 16000, 12800]);
  });

  test("écart fixe réglé à 25 % et 5 points : 25 000, 20 000, 15 000 en un clic", () => {
    ouvrir({ methodeFlood: 3, degressifBase: 25, degressifRegle: 1 });
    expect(attaques()).toEqual([25000, 20000, 15000]);
  });

  test("attaque 1 saisie au-dessus de la base : les suivantes en repartent", () => {
    ouvrir({ methodeFlood: 3, degressifBase: 25, degressifRegle: 1 });
    saisir(1, 30000);
    expect(attaques()).toEqual([30000, 25000, 20000]);
  });

  test("attaque suivante saisie : toutes les valeurs restent telles quelles", () => {
    ouvrir({ methodeFlood: 3, degressifBase: 25, degressifRegle: 1 });
    saisir(2, 22222);
    expect(attaques()).toEqual([25000, 22222, 15000]);
    // un autre changement (TdC de la cible) ne les écrase pas
    page.lire(`$("#o_floodTDCB").spinner("value", 100000).trigger("input")`);
    expect(attaques()).toEqual([25000, 22222, 15000]);
  });

  test("changer de méthode puis revenir en dégressive : valeurs recalculées", () => {
    ouvrir({ methodeFlood: 3, degressifBase: 25, degressifRegle: 1 });
    saisir(2, 22222);
    page.lire(`$("#o_methodeFlood").val("0").trigger("change")`);
    page.lire(`$("#o_methodeFlood").val("3").trigger("change")`);
    expect(attaques()).toEqual([25000, 20000, 15000]);
  });

  test("écart fixe arrivé à 0 % : les lignes en trop disparaissent toutes", () => {
    // 5 % puis 0 % : une seule attaque, les deux autres lignes proposées partent
    ouvrir({ methodeFlood: 3, degressifBase: 5, degressifRegle: 1 });
    expect(page.lire<number>(`$("input[id^='o_attaque']").length`)).toBe(1);
    expect(page.lire<number>(`$("#o_attaque1").spinner("value")`)).toBe(5000);
  });

  test("« Reste » coché puis moins d'attaques calculées : le reste part sur la ligne cochée", () => {
    ouvrir({ methodeFlood: 1 });
    expect(attaques()).toEqual([20000, 13333, 13333]);
    page.lire(`$("#o_suppAttaque3").prop("checked", true).trigger("change")`);
    // cible à la moitié de mon terrain : l'Optimisée ne prévoit qu'une attaque
    page.lire(`$("#o_floodTDCB").spinner("value", 50000).trigger("input")`);
    expect(attaques()).toEqual([10000, 0, 990000]);
  });

  test("réserve : une attaque saisie ne prend pas les unités gardées", () => {
    ouvrir({ methodeFlood: 0, reserveFlood: 400000 });
    saisir(1, 700000);
    // plus d'unités pour les attaques 2 et 3 : leurs lignes disparaissent
    expect(
      page.lire<number[]>(`$("input[id^='o_attaque']").map((i, e) => $(e).spinner("value")).get()`),
    ).toEqual([600000]);
    expect(page.lire<number>(`p._armee.repartition[1][0]`)).toBe(600000);
  });

  test("nombre d'attaques proposées réglable, dans la limite des créneaux", () => {
    ouvrir({ methodeFlood: 0, floodAttaques: 2 });
    expect(page.lire<number>(`$("input[id^='o_attaque']").length`)).toBe(2);
    ouvrir({ methodeFlood: 0, floodAttaques: 9 });
    expect(page.lire<number>(`$("input[id^='o_attaque']").length`)).toBe(3);
  });
});
