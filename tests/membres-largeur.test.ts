import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { creerPage } from "./harnais";

/**
 * Tableau de la page Membres sur téléphone (capture du mainteneur du
 * 24/11/2026, vue « Floods et chasses en cours ») : la 1.156.1 avait fixé la
 * zone du tableau à la largeur de sa case (`width: 0`), le cadre du jeu se
 * réduisait alors à son en-tête et le tableau défilait, coupé. Le cadre suit de
 * nouveau le tableau jusqu'à presque toute la largeur de l'écran, et la police
 * se réduit pour que tout le tableau s'affiche. happy-dom n'a pas de mise en
 * page : les largeurs sont posées ; la mise en page réelle est vérifiée dans
 * Chromium (390 à 1 300 px).
 */
const page = creerPage(["js/class/Utils.js", "js/page/AllianceFzzz.js"], "");

/** Tableau de `naturelle` px à police entière dans une zone de `zone` px ; police obtenue en %. */
function ajuster(naturelle: number, zone: number) {
  return page.lire<number | null>(`(() => {
    document.body.innerHTML = "<div id='tabMembresAlliance_wrapper'><table id='tabMembresAlliance'><tr><td>x</td></tr></table></div>";
    let w = document.getElementById("tabMembresAlliance_wrapper"),
      t = document.getElementById("tabMembresAlliance"),
      base = 12,
      police = () => (t.style.fontSize ? parseFloat(t.style.fontSize) : base),
      largeur = () => Math.round((${naturelle} * police()) / base);
    t.style.fontSize = "20px";
    Object.defineProperty(w, "clientWidth", { configurable: true, get: () => ${zone} });
    Object.defineProperty(w, "scrollWidth", { configurable: true, get: () => Math.max(${zone}, largeur()) });
    Object.defineProperty(t, "offsetWidth", { configurable: true, get: largeur });
    window.getComputedStyle = () => ({ fontSize: base + "px" });
    AllianceFzzz.ajusterTaille();
    return t.style.fontSize ? Math.round((parseFloat(t.style.fontSize) / base) * 100) : null;
  })()`);
}

describe("AllianceFzzz.ajusterTaille : la police se réduit jusqu'à ce que le tableau tienne", () => {
  test("tableau qui tient : police entière, rien d'écrit (une réduction d'avant est effacée)", () => {
    expect(ajuster(370, 378)).toBeNull();
  });

  test("545 px dans 378 (téléphone, vue remplie) : réduit par pas de 5 % jusqu'à tenir", () => {
    // 545 × 0,65 = 354 ≤ 378, 545 × 0,70 = 382 > 378
    expect(ajuster(545, 378)).toBe(65);
  });

  test("beaucoup trop large : pas sous 60 %, le reste défile", () => {
    expect(ajuster(2000, 378)).toBe(60);
  });

  test("tableau caché (Carte, Stats membres) : rien de mesuré, police entière", () => {
    expect(ajuster(2000, 0)).toBeNull();
  });
});

test("CSS : sur écran étroit, la zone du tableau suit son contenu jusqu'à la largeur de l'écran", () => {
  const css = readFileSync(join(__dirname, "..", "public", "css", "outiiil.css"), "utf8"),
    debut = css.indexOf("@media (max-width: 760px)"),
    regle = css.slice(debut).match(/#tabMembresAlliance_wrapper \{[^}]*\}/)?.[0] ?? "";
  expect(regle).toContain("width: auto !important;");
  // 32 px : marges et bords du cadre du jeu dans son affichage mobile (24 élargissait la page de 5 px)
  expect(regle).toContain("max-width: calc(100vw - 32px);");
  expect(regle).not.toMatch(/(^|[^-])width: 0/);
});
