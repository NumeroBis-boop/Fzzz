import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Retard au hasard de l'heure des chasses partagées (1.149.0) : 0 par défaut
 * pour un joueur au rôle Chasseur, 5 min pour les autres (règles du
 * mainteneur, 21/11/2026), tant que le joueur ne l'a pas réglé. Tous les
 * réglages étant enregistrés ensemble, une valeur gardée ne dit pas qu'il l'a
 * choisie : seul un réglage du curseur fixe la valeur.
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

/** Retard des chasses lu au chargement, réglages enregistrés et choix noté donnés. */
const retard = (enregistres: object, choisi = false) =>
  page.lire<number>(`(() => {
    localStorage.clear();
    localStorage.setItem("outiiil_parametre", ${JSON.stringify(JSON.stringify(enregistres))});
    if (${choisi}) localStorage.setItem(CLE_DECALAGE_CHASSES_CHOISI, "1");
    return new Joueur({ pseudo: "Moi" }).getParametre().parametre["decalageChasses"].valeur;
  })()`);

describe("retard des chasses par défaut selon le rôle", () => {
  test("rôle Chasseur : 0 ; autres rôles : 5 min", () => {
    expect(retard({ role: 3 })).toBe(0);
    expect(retard({ role: 0 })).toBe(5);
    expect(retard({ role: 2 })).toBe(5);
    expect(retard({})).toBe(5);
  });

  test("5 min enregistré avec les autres réglages, sans avoir été choisi : suit le rôle", () => {
    expect(retard({ role: 3, decalageChasses: 5 })).toBe(0);
  });

  test("réglé par le joueur : gardé quel que soit le rôle", () => {
    expect(retard({ role: 3, decalageChasses: 12 }, true)).toBe(12);
    expect(retard({ role: 0, decalageChasses: 0 }, true)).toBe(0);
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
