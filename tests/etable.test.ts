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
    expect(t).not.toContain("illisible");
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
});

describe("Utils.ouvrieresTotales", () => {
  test("page Reine : lit #armee_initial sans requête", async () => {
    // chaque test simule un nouveau chargement de page : lecture non partagée
    page.lire(`Utils._reine = null; history.replaceState(null, "", "/Reine.php");
      document.body.insertAdjacentHTML("beforeend", "<span id='armee_initial'>70481</span>");
      window.requetes = 0; $.get = () => { window.requetes++; return $.Deferred().reject({ status: 0 }); };`);
    expect(await page.lire(`Utils.ouvrieresTotales().then((o) => JSON.stringify(o))`)).toBe(
      JSON.stringify({ total: 70481, reine: true }),
    );
    expect(page.lire(`window.requetes`)).toBe(0);
  });

  test("ailleurs : une lecture de Reine.php à chaque chargement", async () => {
    page.lire(`Utils._reine = null; history.replaceState(null, "", "/laboratoire.php");
      $.get = () => { window.requetes++; return $.Deferred().resolve("<span id='armee_initial'>70 481</span>"); };`);
    const o = JSON.parse(
      await page.lire(`Utils.ouvrieresTotales().then((o) => JSON.stringify(o))`),
    );
    expect(o.total).toBe(70481);
    expect(o.reine).toBe(true);
    expect(page.lire(`window.requetes`)).toBe(1);
  });

  test("jeu occupé (503) : en-tête, avec la raison", async () => {
    page.lire(
      `Utils._reine = null; $.get = () => { window.requetes++; return $.Deferred().reject({ status: 503 }); };`,
    );
    const o = JSON.parse(
      await page.lire(`Utils.ouvrieresTotales().then((o) => JSON.stringify(o))`),
    );
    expect(o).toEqual({ total: 42481, reine: false, raison: "le jeu traitait une autre action" });
    expect(page.lire(`window.requetes`)).toBe(2);
  });
});

describe("Utils.lireReine : armée complète", () => {
  // unités débloquées d'un compte sans Concierge d'élite ni Tank d'élite (12 champs)
  const douze = [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 13, 14];

  test("champs lus dans l'ordre, une seule requête partagée", async () => {
    page.lire(`Utils._reine = null; history.replaceState(null, "", "/laboratoire.php");
      window.requetes = 0;
      $.get = () => { window.requetes++; return $.Deferred().resolve(
        "<span id='armee_initial'>70 481</span><span id='armee_initial1'>1 000</span><span id='armee_initial2'>250</span>"); };`);
    const r = JSON.parse(await page.lire(`Utils.lireReine().then((r) => JSON.stringify(r))`));
    expect(r.ouvrieres).toBe(70481);
    expect(r.brut.map((b: { nombre: number }) => b.nombre)).toEqual([1000, 250]);
    await page.lire(`Utils.ouvrieresTotales().then(() => 1)`);
    expect(page.lire(`window.requetes`)).toBe(1);
  });

  test("12 champs : attribués aux unités débloquées (Artilleuse d'élite, Tank, Tueuses)", () => {
    const brut = douze.map((u, k) => ({ nombre: (k + 1) * 10, unite: -1 }));
    const unites = page.lire<number[]>(
      `Utils.armeeReine(${JSON.stringify(brut)}, ${JSON.stringify(douze)})`,
    );
    expect(unites).toHaveLength(14);
    expect(unites[7]).toBe(70); // Artilleuse = 7e champ
    expect(unites[8]).toBe(80); // Artilleuse d'élite = 8e champ
    expect(unites[10]).toBe(100); // Tank = 10e champ
    expect(unites[6]).toBe(0); // Concierge d'élite non débloquée
    expect(unites[11]).toBe(0); // Tank d'élite non débloqué
    expect(unites[13]).toBe(120); // Tueuse d'élite = 12e champ
  });

  test("nom de l'unité sur la ligne : prioritaire ; noms en double : ordre des unités débloquées", () => {
    const parNom = [
      { nombre: 5, unite: 12 },
      { nombre: 7, unite: 9 },
    ];
    expect(page.lire<number[]>(`Utils.armeeReine(${JSON.stringify(parNom)}, null)`)[11]).toBe(5);
    const doublons = [
      { nombre: 5, unite: 8 },
      { nombre: 7, unite: 8 },
    ];
    const r = page.lire<number[]>(`Utils.armeeReine(${JSON.stringify(doublons)}, [8, 9])`);
    expect([r[7], r[8]]).toEqual([5, 7]);
    expect(page.lire(`Utils.armeeReine(${JSON.stringify(doublons)}, null)`)).toBeNull();
  });

  test("reconnaissance des 14 noms d'unités (pluriels, apostrophes, accents)", () => {
    const cas: [string, number][] = [
      ["Jeune Soldate Naine", 1],
      ["Soldates Naines", 2],
      ["Naine d’Elite", 3],
      ["Jeunes Soldates", 4],
      ["Soldate", 5],
      ["Concierge", 6],
      ["Concierge d'élite", 7],
      ["Artilleuses", 8],
      ["Artilleuse d’élite", 9],
      ["Soldates d’élites", 10],
      ["Tank", 11],
      ["Tanks d’élites", 12],
      ["Tueuse", 13],
      ["Tueuse d’élite", 14],
      ["Consommation Journalière", -1],
    ];
    for (const [texte, n] of cas)
      expect(page.lire(`Utils.uniteDepuisLibelle(${JSON.stringify(texte)})`)).toBe(n);
  });
});
