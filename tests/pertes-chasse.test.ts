import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Tables de pertes du lanceur (PERTES_CHASSE, content.js) : engendrées par le
 * modèle du mécanisme de chasse, vérifiées contre le jeu, lues par
 * interpolation.
 */
const page = creerPage(
  [
    "js/class/Utils.js",
    "js/class/Parametre.js",
    "js/class/Joueur.js",
    "js/class/Armee.js",
    "js/class/Combat.js",
    "js/class/SimulationChasse.js",
    "js/class/ModeleChasse.js",
    "js/content.js",
  ],
  `var chrome = { runtime: { getManifest: () => ({ version: "0" }), getURL: (p) => p } };
   document.body.innerHTML = "<div class='boite_connexion_titre'>Connexion</div>";`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);

/**
 * Pertes du jeu par ratio : rejeu des 5 405 tirages du simulateur du jeu
 * (note « Mécanisme de chasse Fourmizzz », octobre 2026) contre une armée de
 * JSN au ratio voulu, JSN perdues par point de difficulté de Calystène,
 * bouclier 0. Erreur-type de 0,3 à 0,6 % par point.
 */
const JEU: [number, number][] = [
  [3, 0.06411],
  [3.5, 0.04615],
  [4, 0.03768],
  [4.5, 0.02871],
  [5, 0.02491],
  [5.5, 0.02216],
  [6, 0.01834],
  [6.5, 0.01396],
  [7, 0.01141],
  [7.5, 0.01052],
  [8, 0.00978],
  [8.5, 0.00918],
  [9, 0.00881],
  [9.5, 0.00852],
  [10, 0.00841],
  [10.5, 0.00839],
  [11, 0.00835],
];

describe("PERTES_CHASSE : générées par le modèle", () => {
  test("content.js est la copie exacte de ModeleChasse.tables()", () => {
    const attendu = lire(`JSON.stringify(ModeleChasse.tables())`),
      actuel = lire(`JSON.stringify(PERTES_CHASSE)`);
    if (attendu !== actuel)
      console.log(
        "PERTES_CHASSE à mettre à jour dans content.js (modèle modifié) :\n" +
          attendu.replace(/"(\w+)":/g, "$1: ").replace(/,(\w+): /g, ",\n  $1: "),
      );
    expect(actuel).toBe(attendu);
  });

  test("201 pas de 0,05 de 1 à 11, tables croissantes ou décroissantes", () => {
    const t = lire(`PERTES_CHASSE`);
    expect(t.de).toBe(1);
    expect(t.pas).toBe(0.05);
    for (const nom of ["min", "moy", "max", "rep10"]) expect(t[nom].length).toBe(201);
    for (let i = 1; i < 201; i++) {
      expect(t.moy[i]).toBeLessThanOrEqual(t.moy[i - 1] + 1e-9);
      expect(t.rep10[i]).toBeGreaterThanOrEqual(t.rep10[i - 1] - 1e-9);
    }
  });

  test("au-dessus ou au niveau du jeu à chaque ratio, de 4 % au plus", () => {
    for (const [ratio, mesure] of JEU) {
      const moy = lire<number>(`SimulationChasse.table("moy", ${ratio})`);
      expect(moy / mesure - 1).toBeGreaterThan(-0.002);
      expect(moy / mesure - 1).toBeLessThan(0.04);
    }
  });

  test("part des tirages à 10 % : celle du jeu à ±2 points", () => {
    // rejeu des 5 405 tirages : P(vie / B ≤ ratio)
    for (const [ratio, part] of [
      [5, 0.096],
      [6, 0.355],
      [7, 0.768],
      [8, 0.881],
      [9, 0.958],
      [10, 0.994],
    ] as [number, number][])
      expect(
        Math.abs(lire<number>(`SimulationChasse.table("rep10", ${ratio})`) - part),
      ).toBeLessThan(0.02);
  });
});

describe("SimulationChasse.table / pertes : interpolation", () => {
  test("aux pas : la valeur de la table ; entre deux : linéaire ; au-delà : constante", () => {
    const t = lire(`PERTES_CHASSE`);
    expect(lire(`SimulationChasse.table("moy", 7)`)).toBeCloseTo(t.moy[120], 12);
    expect(lire(`SimulationChasse.table("moy", 7.025)`)).toBeCloseTo(
      (t.moy[120] + t.moy[121]) / 2,
      12,
    );
    expect(lire(`SimulationChasse.table("moy", 0.5)`)).toBe(t.moy[0]);
    expect(lire(`SimulationChasse.table("moy", 30)`)).toBe(t.moy[200]);
  });

  test("pertes : tables × difficulté × 10 / (10 + bouclier)", () => {
    const p = lire(`SimulationChasse.pertes(7.2, 1000, 5)`),
      f = (1000 * 10) / 15;
    expect(p.AVG).toBeCloseTo(lire(`SimulationChasse.table("moy", 7.2)`) * f, 9);
    expect(p.MIN).toBeCloseTo(lire(`SimulationChasse.table("min", 7.2)`) * f, 9);
    expect(p.MAX).toBeCloseTo(lire(`SimulationChasse.table("max", 7.2)`) * f, 9);
    expect(p.MIN).toBeLessThan(p.AVG);
    expect(p.AVG).toBeLessThan(p.MAX);
  });

  test("entre deux ratios de référence, les pertes diminuent avec le ratio", () => {
    const a = lire<number>(`SimulationChasse.pertes(7, 1000, 0).AVG`),
      b = lire<number>(`SimulationChasse.pertes(7.2, 1000, 0).AVG`),
      c = lire<number>(`SimulationChasse.pertes(7.5, 1000, 0).AVG`);
    expect(b).toBeLessThan(a);
    expect(c).toBeLessThan(b);
  });
});
