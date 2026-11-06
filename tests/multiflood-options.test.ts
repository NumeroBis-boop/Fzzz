import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Multi-flood, options « Terrain Final » et « Prise Max » : le champ affiche
 * l'option avec l'espace des milliers (« 1 804 000 ») ; une modification doit
 * être relue en entier, pas jusqu'au premier espace.
 */
const page = creerPage(
  [
    "js/lib/jquery-ui_1.12.1.js",
    "js/lib/globalize_0.1.1.js",
    "js/lib/globalize-locale-fr.js",
    "js/class/Utils.js",
    "js/class/Parametre.js",
    "js/class/Joueur.js",
    "js/class/Armee.js",
    "js/class/UnitesGardees.js",
    "js/boite/Boite.js",
    "js/boite/Combat.js",
  ],
  `var METHODE_FLOOD = [], AFFECTATION_RESSOURCE = [], RATIO_RECOLTE = {};
   var NOM_UNITE = ["Ouvrière", "Jeune Soldate Naine"];`,
);

function ouvrir() {
  page.lire(`(() => {
    window.monProfil = new Joueur({ pseudo: "Moi" }).getParametre();
    document.body.innerHTML = '<div id="o_mfFormWrap"></div>';
    window.boite = Object.create(BoiteCombat.prototype);
    boite._mfCibles = [{ pseudo: "X", terrain: 3000000, tempsParcours: 60, terrainFinal: 1804000, priseMax: null, arrondir: 0 }];
    boite._mfAttaquantOpts = { terrainFinal: 2500000, priseMax: null };
    window.simulations = 0;
    boite.simulerMultiFlood = () => simulations++;
    boite._mfRenderForm();
  })()`);
}
const champ = (selecteur: string) => page.lire<string>(`$("${selecteur}").val()`);
const saisir = (selecteur: string, texte: string) =>
  page.lire(`$("${selecteur}").val(${JSON.stringify(texte)}).trigger("change")`);
const CIBLE = "#o_mfForm .o_mfOpt[data-opt='terrainFinal']",
  ATTAQUANT = "#o_mfForm .o_mfAttOpt[data-opt='terrainFinal']";

describe("multi-flood : options Terrain Final et Prise Max", () => {
  test("options affichées avec l'espace des milliers", () => {
    ouvrir();
    expect(champ(CIBLE)).toBe("1 804 000");
    expect(champ(ATTAQUANT)).toBe("2 500 000");
  });

  test("une option modifiée est relue en entier, pour la cible et pour l'attaquant", () => {
    ouvrir();
    saisir(CIBLE, "1 900 000");
    expect(page.lire<number>(`boite._mfCibles[0].terrainFinal`)).toBe(1900000);
    saisir(ATTAQUANT, "2 600 000");
    expect(page.lire<number>(`boite._mfAttaquantOpts.terrainFinal`)).toBe(2600000);
    saisir("#o_mfForm .o_mfOpt[data-opt='priseMax']", "250000");
    expect(page.lire<number>(`boite._mfCibles[0].priseMax`)).toBe(250000);
    expect(page.lire<number>(`simulations`)).toBe(3);
  });

  test("vide ou 0 : pas d'option ; la liste « Arrondir » reste lue telle quelle", () => {
    ouvrir();
    saisir(CIBLE, "");
    expect(page.lire(`boite._mfCibles[0].terrainFinal`)).toBeNull();
    saisir(ATTAQUANT, "0");
    expect(page.lire(`boite._mfAttaquantOpts.terrainFinal`)).toBeNull();
    page.lire(`$("#o_mfForm select.o_mfOpt").val("1000").trigger("change")`);
    expect(page.lire<number>(`boite._mfCibles[0].arrondir`)).toBe(1000);
    page.lire(`$("#o_mfForm select.o_mfOpt").val("0").trigger("change")`);
    expect(page.lire(`boite._mfCibles[0].arrondir`)).toBeNull();
  });
});
