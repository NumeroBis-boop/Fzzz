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

  test("raison de l'échec affichée", () => {
    expect(
      bandeau({ total: 42481, reine: false, raison: "le jeu traitait une autre action" }),
    ).toContain("Reine.php illisible : le jeu traitait une autre action");
  });

  test("relevé mémorisé : âge affiché", () => {
    expect(bandeau({ total: 70481, reine: true, age: 4 })).toContain("relevé il y a 4 min");
  });
});

describe("Utils.ouvrieresTotales", () => {
  test("page Reine : lit #armee_initial et le mémorise", async () => {
    page.lire(`history.replaceState(null, "", "/Reine.php");
      document.body.insertAdjacentHTML("beforeend", "<span id='armee_initial'>70481</span>");`);
    expect(await page.lire(`Utils.ouvrieresTotales().then((o) => JSON.stringify(o))`)).toBe(
      JSON.stringify({ total: 70481, reine: true, age: 0 }),
    );
    expect(page.lire(`Utils.lireStockage("fzzz_ouvrieresReine_S5").total`)).toBe(70481);
  });

  test("ailleurs, relevé de moins de 10 min : aucune requête", async () => {
    page.lire(`history.replaceState(null, "", "/laboratoire.php");
      localStorage.setItem("fzzz_ouvrieresReine_S5", JSON.stringify({ total: 70000, date: Date.now() - 3 * 60000 }));
      window.requetes = 0; $.get = () => { window.requetes++; return $.Deferred().reject({ status: 0 }); };`);
    expect(await page.lire(`Utils.ouvrieresTotales().then((o) => JSON.stringify(o))`)).toBe(
      JSON.stringify({ total: 70000, reine: true, age: 3 }),
    );
    expect(page.lire(`window.requetes`)).toBe(0);
  });

  test("relevé périmé et jeu occupé (503) : en-tête, avec la raison", async () => {
    page.lire(`localStorage.setItem("fzzz_ouvrieresReine_S5", JSON.stringify({ total: 70000, date: Date.now() - 11 * 60000 }));
      $.get = () => { window.requetes++; return $.Deferred().reject({ status: 503 }); };`);
    const o = JSON.parse(
      await page.lire(`Utils.ouvrieresTotales().then((o) => JSON.stringify(o))`),
    );
    expect(o).toEqual({ total: 42481, reine: false, raison: "le jeu traitait une autre action" });
    expect(page.lire(`window.requetes`)).toBe(1);
  });
});
