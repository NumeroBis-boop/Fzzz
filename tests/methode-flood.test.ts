import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Méthode de flood par défaut : Dégressive (règle du mainteneur, 1.96.2).
 * Tous les réglages étant enregistrés ensemble, « Optimisée » (l'ancien
 * défaut) passe en Dégressive une fois par navigateur ; un autre choix reste.
 */
const page = creerPage(
  [
    "js/lib/jquery-ui_1.12.1.js",
    "js/class/Utils.js",
    "js/class/Parametre.js",
    "js/class/Joueur.js",
  ],
  `var METHODE_FLOOD = ["Standard", "Optimisée", "Uniforme", "Dégressive"],
     AFFECTATION_RESSOURCE = [], RATIO_RECOLTE = {};
   var NOM_UNITE = ["Ouvrière", "Jeune Soldate Naine"], NOM_UNITES = ["Ouvrières", "Jeunes Soldates Naines"];`,
);

// méthode lue au chargement, d'après les réglages enregistrés et la migration
function methode(enregistre: object | null, migrationFaite = false) {
  return page.lire<{ valeur: number; stockee: number | null; marque: string | null }>(`(() => {
    localStorage.clear();
    localStorage.setItem("fzzz_reserveEnPlus", "1");
    if (${migrationFaite}) localStorage.setItem("fzzz_methodeDegressive", "1");
    let r = ${JSON.stringify(enregistre)};
    if (r) localStorage.setItem("outiiil_parametre", JSON.stringify(r));
    window.monProfil = new Joueur({ pseudo: "Moi" }).getParametre();
    let stocke = JSON.parse(localStorage.getItem("outiiil_parametre") || "null");
    return {
      valeur: Number(monProfil.parametre.methodeFlood.valeur),
      stockee: stocke ? Number(stocke.methodeFlood) : null,
      marque: localStorage.getItem("fzzz_methodeDegressive"),
    };
  })()`);
}

describe("méthode de flood par défaut : Dégressive", () => {
  test("rien d'enregistré : Dégressive", () => {
    expect(methode(null).valeur).toBe(3);
  });

  test("« Optimisée » enregistrée (l'ancien défaut) : passe en Dégressive, une fois", () => {
    expect(methode({ methodeFlood: 1, floodAttaques: 4 })).toEqual({
      valeur: 3,
      stockee: 3,
      marque: "1",
    });
    // valeur d'une liste lue comme texte
    expect(methode({ methodeFlood: "1" }).valeur).toBe(3);
    // rechoisie après le passage : elle reste
    expect(methode({ methodeFlood: 1 }, true).valeur).toBe(1);
  });

  test("Standard ou Uniforme, choisies exprès : gardées", () => {
    expect(methode({ methodeFlood: 0 }).valeur).toBe(0);
    expect(methode({ methodeFlood: 2 }).valeur).toBe(2);
  });
});
