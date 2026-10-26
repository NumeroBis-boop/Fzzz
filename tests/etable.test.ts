import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

// étable 10, Communication avec les animaux 12, TdC 19 095
const page = creerPage(
  ["js/class/Utils.js"],
  `var monProfil = { niveauConstruction: Object.assign([], { 11: 10 }), niveauRecherche: Object.assign([], { 4: 12 }) };
   document.body.innerHTML = "<span id='quantite_tdc'>19095</span><div id='nb_ouvrieres'>42481</div>";`,
);

/** Texte du bandeau, espaces de numeral normalisés. */
function bandeau(ouvrieres: object): string {
  const html = page.lire<string>(`Utils.htmlRentabiliteEtable(${JSON.stringify(ouvrieres)})`);
  return html.replace(/<[^>]+>/g, " ").replace(/[\s  ]+/g, " ");
}

describe("Utils.htmlRentabiliteEtable", () => {
  test("ouvrières de la page Reine (convois compris) : disponibles = total − TdC", () => {
    const t = bandeau({ total: 70481, reine: true });
    expect(t).toContain("Ouvrières : 70 481");
    expect(t).toContain("disponibles pour les convois : 51 386");
    expect(t).toContain("convois en cours compris");
  });

  test("étable 11 : 327 680 ouvrières sacrifiées, il en manque 10 106 695", () => {
    // Communication 13 : 80 × 2^12 ; minimum = Cₙ × (20 + n) + 1 = 327 680 × 31 + 1
    const t = bandeau({ total: 70481, reine: true });
    expect(t).toContain("Étable 11 (Communication 13) 327 680");
    expect(t).toContain("10 106 695 ouvrières");
  });

  test("repli sur le compteur de l'en-tête, signalé", () => {
    expect(bandeau({ total: 42481, reine: false })).toContain("ouvrières en convoi non comptées");
  });

  test("ouvrières.ouvrieresTotales lit #armee_initial sur la page Reine", async () => {
    page.lire(`history.replaceState(null, "", "/Reine.php");
      document.body.insertAdjacentHTML("beforeend", "<span id='armee_initial'>70481</span>");`);
    expect(await page.lire(`Utils.ouvrieresTotales().then((o) => JSON.stringify(o))`)).toBe(
      JSON.stringify({ total: 70481, reine: true }),
    );
  });
});
