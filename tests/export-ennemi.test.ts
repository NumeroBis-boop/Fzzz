import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";
import { classeurSimule, feuille } from "./sheet-simule";

/**
 * Niveaux de l'ennemi (colonnes « Arme », « Bouclier », « Dôme », « Loge » des
 * onglets « BDD attaques » et « BDD défenses ») tirés du premier tour d'un RC :
 * dégâts +10 % par niveau d'armes, vie +10 % par niveau de bouclier, dôme 10 %
 * puis 5 % par niveau, loge 30 % puis 15 % par niveau (descriptions du jeu).
 * RC inventés, aux nombres calculés pour des niveaux connus (aucune armée
 * réelle dans le dépôt public).
 */
const page = creerPage(
  [
    "js/class/Utils.js",
    "js/class/Parametre.js",
    "js/class/Joueur.js",
    "js/class/Armee.js",
    // constantes des unités (VIE_UNITE) ; l'encart « Connexion » empêche le démarrage
    "js/content.js",
    "js/class/ExportRapports.js",
  ],
  `var chrome = { runtime: { getManifest: () => ({ version: "0" }), getURL: (p) => p } };
   document.body.innerHTML = "<div class='boite_connexion_titre'>Connexion</div>";`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);
const DATE = "2026-11-07 21:07";
const combat = (texte: string, pseudo: string) =>
  lire(`ExportRapports.combat(${JSON.stringify(texte)}, "${DATE}", "${pseudo}")`);
const ennemi = (texte: string, pseudo: string) => combat(texte, pseudo).ennemi;

// Alpha (arme 7, bouclier 12) attaque Bravo : 4 000 JSN d'Alpha tuées au
// premier tour (32 000 de vie de base), 70 400 dégâts de Bravo (× 2,2)
const DEFENSE = `Alpha attaque votre Terrain de chasse :
Troupes en attaque : 20 000 Jeunes Soldates Naines, 1 000 Soldates.
Troupes en défense : 5 000 Jeunes Soldates Naines.

La troupe ennemie inflige 50 000 (+ 35 000) dégâts à vos fourmis et en tue 900.
Vous infligez 44 000 (+ 26 400) dégâts et tuez 4 000 ennemies.

La troupe ennemie inflige 40 000 (+ 28 000) dégâts à vos fourmis et en tue 800.
Vous infligez 30 000 (+ 18 000) dégâts et tuez 2 000 ennemies.`;

// attaque d'Alpha sur Bravo (arme 13) dans un lieu donné, bonus de vie total
// de Bravo × multiplicateur : 4 000 JSN de Bravo tuées au premier tour
const attaque = (lieu: string, degats: string, defense = "20 000 Jeunes Soldates Naines") =>
  `Vous attaquez ${lieu} de Bravo
Troupes en attaque : 30 000 Jeunes Soldates Naines.
Troupes en défense : ${defense}.

Vous infligez ${degats} dégâts et tuez 4 000 ennemies.
La troupe ennemie inflige 10 000 (+ 13 000) dégâts à vos fourmis et en tue 1 000.

Vous infligez 20 000 (+ 12 000) dégâts et tuez 2 000 ennemies.
La troupe ennemie inflige 5 000 (+ 6 500) dégâts à vos fourmis et en tue 500.`;

describe("niveaux de l'ennemi d'après le RC", () => {
  test("il attaque (BDD défenses) : arme et bouclier exacts, ni dôme ni loge", () => {
    expect(ennemi(DEFENSE, "Bravo")).toEqual({ Arme: 7, Bouclier: 12, Dôme: "", Loge: "" });
  });

  test("il défend son terrain de chasse : bouclier exact, pertes sur deux types d'unités", () => {
    // 3 000 JSN (24 000) + 1 000 Soldates (20 000) tuées : 44 000 de vie, × 1,9 (bouclier 9)
    const rc = attaque(
      "le terrain de chasse",
      "52 250 (+ 31 350)",
      "3 000 Jeunes Soldates Naines, 2 000 Soldates",
    );
    expect(combat(rc, "Alpha").valeurs[5]).toBe("Terrain de chasse");
    expect(ennemi(rc, "Alpha")).toEqual({ Arme: 13, Bouclier: 9, Dôme: "", Loge: "" });
  });

  test("il défend sa fourmilière : dôme possible pour chaque bouclier proche de son arme", () => {
    // bouclier 12, dôme 20 : × (1 + 1,2 + 0,1 + 1,0) = 3,3, soit 105 600 dégâts
    expect(ennemi(attaque("la fourmilière", "66 000 (+ 39 600)"), "Alpha")).toEqual({
      Arme: 13,
      Bouclier: "",
      Dôme: "24 (bouclier 10) · 22 (bouclier 11) · 20 (bouclier 12) · 18 (bouclier 13) · 16 (bouclier 14) · 14 (bouclier 15)",
      Loge: "",
    });
  });

  test("il défend sa loge : seuls les niveaux entiers de loge sont proposés", () => {
    // bouclier 12, loge 10 : × (1 + 1,2 + 0,3 + 1,5) = 4, soit 128 000 dégâts
    expect(ennemi(attaque("la Loge Impériale", "80 000 (+ 48 000)"), "Alpha")).toEqual({
      Arme: 13,
      Bouclier: "",
      Dôme: "",
      Loge: "10 (bouclier 12) · 8 (bouclier 15)",
    });
  });

  test("armée entière tuée au premier tour : arme seule (les dégâts dépassent sa vie)", () => {
    const rc = `Vous attaquez le terrain de chasse de Bravo
Troupes en attaque : 30 000 Jeunes Soldates Naines.
Troupes en défense : 1 000 Jeunes Soldates Naines.

Vous infligez 100 000 (+ 60 000) dégâts et tuez 1 000 ennemies.
La troupe ennemie inflige 2 000 (+ 1 400) dégâts à vos fourmis et en tue 200.

Vous avez gagné cette bataille !`;
    expect(ennemi(rc, "Alpha")).toEqual({ Arme: 7, Bouclier: "", Dôme: "", Loge: "" });
  });

  test("flood (dégâts minimes, aucune perte) : rien de sûr, cases vides", () => {
    const rc = `Alpha attaque votre Terrain de chasse :
Troupes en attaque : 2 000 Jeunes Soldates Naines.
Troupes en défense : 1 Jeune Soldate Naine.

L’ennemie inflige 6 (+ 2) dégâts à vos fourmis et en tue 1.
Vous infligez 1 (+ 1) dégâts et tuez 0 ennemies.`;
    expect(ennemi(rc, "Bravo")).toEqual({ Arme: "", Bouclier: "", Dôme: "", Loge: "" });
  });

  test("peu de pertes (deux unités) : bouclier trop incertain, laissé vide", () => {
    const rc = attaque("le terrain de chasse", "100 (+ 60)", "10 Tanks").replace(
      "tuez 4 000 ennemies",
      "tuez 2 ennemies",
    );
    expect(ennemi(rc, "Alpha").Bouclier).toBe("");
  });

  test("nombres qui ne donnent pas un niveau entier : laissé vide plutôt que faux", () => {
    // × 2,25 : bouclier 12,5
    expect(ennemi(attaque("le terrain de chasse", "45 000 (+ 27 000)"), "Alpha").Bouclier).toBe("");
  });

  test("armée d'occupation ou colonie : pas de niveaux attribués au mauvais joueur", () => {
    const occupation = attaque("la fourmilière", "66 000 (+ 39 600)").replace(
      "de Bravo\n",
      "de Bravo, mais une armée d'occupation est déjà présente\n",
    );
    expect(ennemi(occupation, "Alpha")).toEqual({ Arme: "", Bouclier: "", Dôme: "", Loge: "" });
    expect(ennemi(occupation.replace("d'occupation", "d’occupation"), "Alpha").Arme).toBe("");
    // lieu de la colonie inconnu : arme seule
    expect(ennemi(attaque("la colonie", "66 000 (+ 39 600)"), "Alpha")).toEqual({
      Arme: 13,
      Bouclier: "",
      Dôme: "",
      Loge: "",
    });
  });
});

describe("colonnes des onglets", () => {
  const entetes = (onglet: string) => lire<string[]>(`EXPORTS_RAPPORTS.${onglet}.entetes`);
  const ligne = (onglet: string, membres: string[] = []) =>
    lire<{ onglet: string; ligne: any[] }[]>(
      `ExportRapports.lignes("combat", [{ id: 1, titre: "", messages: [{ id: 1, date: "${DATE}", texte: ${JSON.stringify(DEFENSE)} }] }], "Bravo", new Set(${JSON.stringify(membres)}))`,
    ).find((l) => l.onglet == onglet)!.ligne;

  test("BDD attaques et BDD défenses : niveaux de l'ennemi après les pertes, avant les troupes", () => {
    const t = entetes("defense");
    expect(t).toEqual(entetes("attaque"));
    expect(t.slice(10, 17)).toEqual([
      "Pertes attaquant",
      "Pertes défenseur",
      "Arme",
      "Bouclier",
      "Dôme",
      "Loge",
      "Troupes en attaque",
    ]);
    const l = ligne("defense");
    expect(l).toHaveLength(t.length);
    const cellule = (titre: string) => l[t.indexOf(titre)];
    expect(cellule("Attaquant")).toBe("Alpha");
    expect(cellule("Arme")).toBe(7);
    expect(cellule("Bouclier")).toBe(12);
    expect(cellule("Dôme")).toBe("");
    expect(cellule("Troupes en attaque")).toBe("20 000 Jeunes Soldates Naines, 1 000 Soldates");
    expect(cellule("RC")).toContain("Alpha attaque votre Terrain de chasse");
  });

  test("Flood internes : colonnes d'avant, sans niveaux (le même RC vu des deux camps)", () => {
    const t = entetes("interne");
    expect(t).not.toContain("Arme");
    const l = ligne("interne", ["alpha"]);
    expect(l).toHaveLength(t.length);
    expect(l[t.indexOf("Troupes en attaque")]).toBe(
      "20 000 Jeunes Soldates Naines, 1 000 Soldates",
    );
  });

  test("onglet créé par la version précédente : colonnes ajoutées au bout, valeurs sous leur titre", () => {
    const anciens = entetes("interne"),
      fichier = classeurSimule({ "BDD défenses": feuille("BDD défenses", [anciens.slice()]) }),
      r = fichier.doPost({
        onglet: "BDD défenses",
        entetes: entetes("defense"),
        lignes: [ligne("defense")],
      });
    expect(r).toEqual({ ajoutees: 1, deja: 0 });
    const grille = fichier.onglets["BDD défenses"].grille as any[][],
      titres = grille[0]!,
      valeurs = grille[1]!;
    expect(titres).toEqual([...anciens, "Arme", "Bouclier", "Dôme", "Loge"]);
    expect(valeurs[titres.indexOf("Arme")]).toBe(7);
    expect(valeurs[titres.indexOf("Bouclier")]).toBe(12);
    expect(valeurs[titres.indexOf("RC")]).toContain("Alpha attaque votre Terrain de chasse");
  });
});
