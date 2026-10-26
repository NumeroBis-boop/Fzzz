import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

// constantes du jeu (content.js) ; l'encart « Connexion » empêche le démarrage
const page = creerPage(
  [
    "js/class/Utils.js",
    "js/class/Parametre.js",
    "js/class/Joueur.js",
    "js/class/Armee.js",
    "js/class/Combat.js",
    "js/content.js",
  ],
  `var chrome = { runtime: { getManifest: () => ({ version: "0" }), getURL: (p) => p } };
   document.body.innerHTML = "<div class='boite_connexion_titre'>Connexion</div>";`,
);

describe("Armee.parseArmee", () => {
  test("abréviations : jsn, tk, tu (Tueuses), tue", () => {
    const unites = page.lire<number[]>(
      `new Armee().parseArmee("30 jsn, 2 tk, 7 tu et 4 tue").unite.slice()`,
    );
    // index : 0 JSN … 10 Tank, 12 Tueuse, 13 Tueuse d'élite
    expect(unites[0]).toBe(30);
    expect(unites[10]).toBe(2);
    expect(unites[12]).toBe(7);
    expect(unites[13]).toBe(4);
  });

  test("texte d'une armée du jeu", () => {
    const unites = page.lire<number[]>(
      `new Armee().parseArmee("1 919 Jeunes Soldates Naines, 50 Soldates Naines, 3 Tanks").unite.slice()`,
    );
    expect(unites[0]).toBe(1919);
    expect(unites[1]).toBe(50);
    expect(unites[10]).toBe(3);
  });
});

describe("Utils.timeToInt", () => {
  test("jours, heures, minutes, secondes, espaces multiples", () => {
    expect(page.lire(`Utils.timeToInt("1J 2h 3m 4s")`)).toBe(86400 + 7200 + 180 + 4);
    expect(page.lire(`Utils.timeToInt("2h  05m")`)).toBe(7500);
  });
});

describe("Combat.simuler", () => {
  test("s'arrête même avec des niveaux non numériques", () => {
    const tours = page.lire<number>(`(() => {
      let c = new Combat({});
      c.armee1.unite[0] = 1000;
      c.armee2.unite[0] = 1000;
      c.attaquant.niveauRecherche[1] = NaN; c.attaquant.niveauRecherche[2] = NaN;
      c.defenseur.niveauRecherche[1] = NaN; c.defenseur.niveauRecherche[2] = NaN;
      c.simuler();
      return c._tour.length;
    })()`);
    expect(tours).toBeLessThanOrEqual(1000);
  });
});
