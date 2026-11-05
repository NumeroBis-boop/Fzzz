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

/** Floods prévus par la méthode « Optimisée » (le premier est l'antisonde, ici 0). */
const optimise = (monTerrain: number, cible: number, unites: number, creneaux = 3) =>
  page.lire<number[]>(
    `new Armee({ unite: { "Jeune Soldate Naine": ${unites} } }).simulerFlood(${monTerrain}, ${cible}, "1", [0], 0, ${creneaux}, -1)`,
  );

describe("lanceur de flood, méthode « Optimisée »", () => {
  test("déjà à la limite de portée : pas d'attaque de 0 ou −1 unité", () => {
    expect(optimise(20000, 10000, 5000)).toEqual([0, 2000]);
    expect(optimise(19998, 10000, 5000)).toEqual([0, 2000]);
  });
  test("reste sous 20 % : tout part d'un coup, sans petite attaque « limite »", () => {
    expect(optimise(19990, 10000, 1000)).toEqual([0, 1000]);
    expect(optimise(17000, 10000, 2000)).toEqual([0, 2000]);
  });
  test("assez d'unités : attaque « limite » gardée, elle prend plus", () => {
    // 1 000 puis 20 % de 9 000 : la cible finit à exactement la moitié, encore à portée
    expect(optimise(17000, 10000, 5000)).toEqual([0, 1000, 1800]);
    expect(optimise(10000, 10000, 50000, 4)).toEqual([0, 2000, 1333, 1333]);
  });
  test("la cible reste à portée de la dernière attaque après la « limite »", () => {
    // cas réel du 05/11/26 (SerPounce → LabraDrungor) : 16 524, 11 231 puis 10 973
    expect(optimise(81975, 82620, 50000)).toEqual([0, 16524, 11231, 10973]);
  });
  test("jamais d'attaque négative", () => {
    for (let mien = 15000; mien <= 20000; mien += 7)
      for (const u of [10, 1500, 2500, 9000])
        for (const f of optimise(mien, 10000, u)) expect(f).toBeGreaterThanOrEqual(0);
  });
});
