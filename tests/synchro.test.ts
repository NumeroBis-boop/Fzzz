import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

// 9h24m08,3s ; ma VA 7, la cible n'a pas de niveaux connus (-1)
const MAINTENANT = Date.UTC(2026, 9, 28, 9, 24, 8, 300);
const page = creerPage(
  ["js/class/Utils.js", "js/class/Parametre.js", "js/class/Joueur.js"],
  `var METHODE_FLOOD = [], AFFECTATION_RESSOURCE = [], RATIO_RECOLTE = {};
   var Horloge = { clic: () => moment(${MAINTENANT}) };`,
);
page.lire(`var monProfil = new Joueur({ pseudo: "Moi", x: 9, y: 36, niveauRecherche: [0, 0, 0, 0, 0, 0, 7, 0, 0, 0] });
  var cible = new Joueur({ pseudo: "Harkonnen", x: 120, y: 80 });`);

describe("Synchroniser : arrivée sur une minute pleine", () => {
  test("clic à l'instant indiqué : arrivée à :00 (au milieu de la seconde)", () => {
    const attente = page.lire<number>("cible.attenteSynchro()");
    const trajet = page.lire<number>("monProfil.getTempsParcours2(cible)") * 1000;
    expect(attente).toBeGreaterThanOrEqual(2);
    expect(attente).toBeLessThan(62);
    expect((MAINTENANT + attente * 1000 + trajet) % 60000).toBe(500);
  });
});
