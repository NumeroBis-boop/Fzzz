import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

const page = creerPage(
  ["js/class/Utils.js", "js/class/Parametre.js", "js/class/Joueur.js", "js/class/Armee.js"],
  `var METHODE_FLOOD = [], AFFECTATION_RESSOURCE = [], RATIO_RECOLTE = {};
   var NOM_UNITE = ["Ouvrière", "Jeune Soldate Naine"];`,
);
// sans réserve d'unités ni antisonde
page.lire(`localStorage.setItem("outiiil_parametre", JSON.stringify({ reserveFlood: 0, reserveFloodAuto: false }));
  var monProfil = new Joueur({ pseudo: "Moi" }).getParametre();`);

/** Floods de la méthode « Dégressive » (le premier est l'antisonde, ici 0). */
const degressif = (cible: number, unites: number, creneaux: number, reglage: object | null) =>
  page.lire<number[]>(
    `new Armee({ unite: { "Jeune Soldate Naine": ${unites} } }).simulerFlood(${cible}, ${cible}, "3", [0], 0, ${creneaux}, -1, ${JSON.stringify(reglage)})`,
  );

// calcul d'avant les réglages : 20 % du TdC restant de la cible à chaque attaque
function ancien(cible: number, unites: number, creneaux: number): number[] {
  const floods = [0];
  for (let i = 0; i < creneaux; i++) {
    const prise = Math.min(Math.floor(cible * 0.2), unites);
    floods.push(prise);
    cible -= prise;
    unites -= prise;
    if (unites <= 0) break;
  }
  return floods;
}

describe("flood dégressif réglable", () => {
  test("réglages par défaut : exactement le calcul d'avant", () => {
    for (let cible = 1000; cible < 400000; cible += 997)
      for (const unites of [5000, 60000, 1000000]) {
        expect(degressif(cible, unites, 3, null)).toEqual(ancien(cible, unites, 3));
        expect(
          degressif(cible, unites, 3, { base: 20, regle: "restant", ecart: 5, premiere: null }),
        ).toEqual(ancien(cible, unites, 3));
      }
  });

  test("même part du TdC restant, 1re attaque à 25 % : × 0,8 à chaque attaque", () => {
    expect(degressif(100000, 1000000, 3, { base: 25, regle: "restant" })).toEqual([
      0, 25000, 20000, 16000,
    ]);
  });

  test("écart fixe : 25 %, 20 %, 15 % du TdC de départ", () => {
    expect(degressif(100000, 1000000, 3, { base: 25, regle: "ecart", ecart: 5 })).toEqual([
      0, 25000, 20000, 15000,
    ]);
  });

  test("attaque 1 saisie : les suivantes partent de sa valeur", () => {
    expect(degressif(100000, 1000000, 3, { regle: "ecart", ecart: 5, premiere: 30000 })).toEqual([
      0, 30000, 25000, 20000,
    ]);
    expect(degressif(100000, 1000000, 3, { regle: "restant", premiere: 30000 })).toEqual([
      0, 30000, 24000, 19200,
    ]);
  });

  test("pas assez d'unités : la dernière attaque prend le reste, sans attaque vide", () => {
    expect(degressif(100000, 40000, 3, { base: 25, regle: "ecart", ecart: 5 })).toEqual([
      0, 25000, 15000,
    ]);
  });

  test("écart fixe arrivé à 0 % : plus d'attaque", () => {
    expect(degressif(100000, 1000000, 4, { base: 10, regle: "ecart", ecart: 5 })).toEqual([
      0, 10000, 5000,
    ]);
  });
});
