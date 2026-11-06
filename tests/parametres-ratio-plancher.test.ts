import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Onglet Ressources des préférences : le curseur « Ratio plancher » a un pas
 * décimal, son champ ne doit pas dépendre de la langue du navigateur
 * (toLocaleString() donne « 7,3 » en français, que Globalize en culture « en »
 * relisait 73).
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
    "js/boite/Parametres.js",
  ],
  `var METHODE_FLOOD = ["Standard", "Optimisée", "Uniforme", "Dégressive"],
     AFFECTATION_RESSOURCE = [], RATIO_RECOLTE = {};
   var NOM_UNITE = ["Ouvrière", "Jeune Soldate Naine", "Jeune Soldate", "Tank"];`,
);

function ouvrir(langue: string) {
  page.lire(`(() => {
    Number.prototype.toLocaleString = function () { return new Intl.NumberFormat(${JSON.stringify(langue)}).format(this); };
    localStorage.setItem("outiiil_parametre", JSON.stringify({ ratioPlancher: 7.2, tdcArriveeMax: 2000000 }));
    window.monProfil = new Joueur({ pseudo: "Moi" }).getParametre();
    document.body.innerHTML = "<div id='o_boiteParametre'><div id='o_tabsParametreRessources'></div></div>";
    window.boite = new BoiteParametre();
    boite.ongletRessources();
    for (const p of ["ratioPlancher", "tdcArriveeMax"]) monProfil.parametre[p].ajouterEvent();
  })()`);
}
const champ = (id: string) => page.lire<string>(`$("#${id}").val()`);
const valeur = (id: string) => page.lire<number>(`$("#${id}").spinner("value")`);

describe("préférences Ressources : ratio plancher et TdC max selon la langue du navigateur", () => {
  for (const langue of ["fr-FR", "de-DE", "en-US"]) {
    test(`${langue} : la flèche monte le ratio plancher de 7.2 à 7.3`, () => {
      ouvrir(langue);
      expect(valeur("ratioPlancherValeur")).toBeCloseTo(7.2, 5);
      page.lire(`$("#ratioPlancherValeur").spinner("stepUp")`);
      expect(valeur("ratioPlancherValeur")).toBeCloseTo(7.3, 5);
      expect(champ("ratioPlancherValeur")).toBe("7,3");
      expect(page.lire(`$("#ratioPlancher").slider("value")`)).toBeCloseTo(7.3, 5);
    });

    test(`${langue} : le TdC max affiche « 2 000 000 » et se relit`, () => {
      ouvrir(langue);
      expect(champ("tdcArriveeMax")).toBe("2 000 000");
      page.lire(`$("#tdcArriveeMax").spinner("stepUp")`);
      expect(valeur("tdcArriveeMax")).toBe(2000001);
    });
  }
});
