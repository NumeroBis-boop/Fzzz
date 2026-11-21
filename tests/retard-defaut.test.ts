import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Retard au hasard de l'heure des chasses et floods partagés : 0 par défaut
 * pour tout le monde (règle du mainteneur, 21/11/2026). La 1.149.0 mettait les
 * chasses à 5 min ; tous les réglages étant enregistrés ensemble, ce 5 gardé
 * ne dit pas que le joueur l'a choisi : seul un réglage du curseur fixe la
 * valeur des chasses.
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
   var NOM_UNITE = ["Ouvrière"], NOM_UNITES = ["Ouvrières"];
   var Horloge = { maintenant: () => 0, serveur: () => moment(0) };`,
);

/** Retards lus au chargement, réglages enregistrés et choix noté donnés. */
const retards = (enregistres: object, choisi = false) =>
  page.lire<number[]>(`(() => {
    localStorage.clear();
    localStorage.setItem("outiiil_parametre", ${JSON.stringify(JSON.stringify(enregistres))});
    if (${choisi}) localStorage.setItem(CLE_DECALAGE_CHASSES_CHOISI, "1");
    let p = new Joueur({ pseudo: "Moi" }).getParametre().parametre;
    return [p["decalageChasses"].valeur, p["decalageFloods"].valeur];
  })()`);

describe("retard des heures partagées par défaut", () => {
  test("0 pour les chasses et les floods, quel que soit le rôle", () => {
    for (const role of [0, 1, 2, 3]) expect(retards({ role })).toEqual([0, 0]);
    expect(retards({})).toEqual([0, 0]);
  });

  test("5 min des chasses enregistré avec les autres réglages, sans avoir été choisi : remis à 0", () => {
    expect(retards({ role: 0, decalageChasses: 5 })).toEqual([0, 0]);
    expect(retards({ role: 3, decalageChasses: 5 })).toEqual([0, 0]);
  });

  test("réglé par le joueur : gardé", () => {
    expect(retards({ role: 3, decalageChasses: 12, decalageFloods: 7 }, true)).toEqual([12, 7]);
    expect(retards({ role: 0, decalageChasses: 5 }, true)).toEqual([5, 0]);
    // les floods n'ont jamais eu d'autre défaut que 0 : une valeur gardée a été choisie
    expect(retards({ decalageFloods: 9 })).toEqual([0, 9]);
  });

  test("un réglage du curseur note le choix, pas celui d'un autre réglage", () => {
    const choisi = (id: string) =>
      page.lire<string | null>(`(() => {
        localStorage.clear();
        let j = (window.monProfil = new Joueur({ pseudo: "Moi" }).getParametre());
        Joueur.suivreChoixDecalage();
        j.parametre[${JSON.stringify(id)}].sauvegarde();
        return localStorage.getItem(CLE_DECALAGE_CHASSES_CHOISI);
      })()`);
    expect(choisi("alertePonte")).toBeNull();
    expect(choisi("decalageChasses")).toBe("1");
  });
});
