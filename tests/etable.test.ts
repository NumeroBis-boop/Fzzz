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
    page.lire(`history.replaceState(null, "", "/Reine.php");
      document.body.insertAdjacentHTML("beforeend", "<span id='armee_initial'>70481</span>");
      window.requetes = 0; $.get = () => { window.requetes++; return $.Deferred().reject({ status: 0 }); };`);
    expect(await page.lire(`Utils.ouvrieresTotales().then((o) => JSON.stringify(o))`)).toBe(
      JSON.stringify({ total: 70481, reine: true }),
    );
    expect(page.lire(`window.requetes`)).toBe(0);
  });

  test("ailleurs : une lecture de Reine.php à chaque chargement", async () => {
    page.lire(`history.replaceState(null, "", "/laboratoire.php");
      $.get = () => { window.requetes++; return $.Deferred().resolve("<span id='armee_initial'>70 481</span>"); };`);
    const o = JSON.parse(
      await page.lire(`Utils.ouvrieresTotales().then((o) => JSON.stringify(o))`),
    );
    expect(o.total).toBe(70481);
    expect(o.reine).toBe(true);
    expect(page.lire(`window.requetes`)).toBe(1);
  });

  test("jeu occupé (503) : en-tête, avec la raison", async () => {
    page.lire(`$.get = () => { window.requetes++; return $.Deferred().reject({ status: 503 }); };`);
    const o = JSON.parse(
      await page.lire(`Utils.ouvrieresTotales().then((o) => JSON.stringify(o))`),
    );
    expect(o).toEqual({ total: 42481, reine: false, raison: "le jeu traitait une autre action" });
    expect(page.lire(`window.requetes`)).toBe(2);
  });
});

describe("alerte de niveau finançable (Armes, Étable à pucerons)", () => {
  const p = creerPage(["js/data/couts.js", "js/class/Utils.js"]);
  const calcul = (
    niveaux: object,
    ressources: object,
    enCours = { recherche: "Aucune recherche", construction: "Aucune construction" },
  ) =>
    p.lire<{ nom: string; niveau: number; occupe: boolean }[]>(
      `JSON.parse(JSON.stringify(Utils.niveauxFinancables(${JSON.stringify(niveaux)}, ${JSON.stringify(ressources)}, ${JSON.stringify(enCours)})))`,
    );
  // Armes 10 : 153 600 nourriture, 102 400 matériaux, 40 960 ouvrières ; Étable 5 : 24 000 matériaux
  const juste = { nourriture: 153600, materiaux: 102400, ouvrieres: 40960 };

  test("ressources suffisantes : les deux niveaux, avec leur numéro", () => {
    expect(calcul({ armes: 9, etable: 4 }, juste).map((x) => `${x.nom} ${x.niveau}`)).toEqual([
      "Armes 10",
      "Étable à pucerons 5",
    ]);
  });
  test("une ressource manque : pas d'alerte pour ce niveau", () => {
    expect(
      calcul({ armes: 9, etable: 4 }, { ...juste, ouvrieres: 40959 }).map((x) => x.nom),
    ).toEqual(["Étable à pucerons"]);
    expect(
      calcul({ armes: 9, etable: 4 }, { nourriture: 0, materiaux: 23999, ouvrieres: 0 }),
    ).toEqual([]);
  });
  test("niveau inconnu ou déjà en cours : rien ; autre chantier en cours : signalé occupé", () => {
    expect(calcul({ armes: -1, etable: -1 }, juste)).toEqual([]);
    expect(
      calcul({ armes: 9, etable: 4 }, juste, {
        recherche: "Armes 3h 02m",
        construction: "Étable à pucerons",
      }),
    ).toEqual([]);
    const r = calcul({ armes: 9, etable: 4 }, juste, {
      recherche: "Architecture 2h 55m",
      construction: "Aucune construction",
    });
    expect(r.map((x) => x.occupe)).toEqual([true, false]);
  });
});
