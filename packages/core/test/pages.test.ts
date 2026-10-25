// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lireAttaquesEnCours, lireChassesEnCours } from "../src/pages/attaques.js";
import { estimerNiveauxPonte, lireChassesBoite, lirePonteBoite } from "../src/pages/boite-compte-plus.js";
import { lireBonusChasse } from "../src/pages/ressources.js";
import { lireTroupes } from "../src/pages/commun.js";
import { dureeChasse } from "../src/chasse.js";
import { estimerSalleAnalyse, lireLaboratoire, lireNiveauxRecherche } from "../src/pages/laboratoire.js";
import { coutRecherche, productionChampignonniere, tempsRecherche } from "../src/data/couts.js";
import { lirePageArmee } from "../src/pages/armee.js";
import { lireTableauEnnemie } from "../src/pages/ennemie.js";
import { lireDonneesJoueur } from "../src/pages/commun.js";
import { caracteristiques, consommationJournaliere } from "../src/armee.js";

function charger(nom: string): Document {
  const html = readFileSync(join(import.meta.dirname, "fixtures", nom), "utf8");
  return new DOMParser().parseFromString(html, "text/html");
}

describe("page Armée (s5)", () => {
  const doc = charger("armee.html");

  it("lit les données cachées du joueur", () => {
    expect(lireDonneesJoueur(doc)).toEqual({
      pseudo: "MonPseudo",
      ouvrieres: 68031,
      materiaux: 3460273,
      nourriture: 197540,
      tdc: 19095,
      alliance: "TAG",
    });
  });

  it("lit niveaux et garnison", () => {
    const p = lirePageArmee(doc);
    expect(p).toMatchObject({ niveauBouclier: 8, niveauArmes: 9, niveauDome: 3, niveauLoge: 3 });
    expect(p.troupes).toEqual({ terrain: {}, dome: {}, loge: { jsn: 173 } });
  });

  it("retrouve exactement les valeurs affichées par le jeu", () => {
    const c = caracteristiques({ jsn: 173 }, { bouclier: 8, armes: 9 }, "loge", 3);
    // Vie : 1 384 + 1 107 + 1 038 = 3 529 ; attaque : 519 + 467 = 986 ; défense 346 + 311 = 657
    expect(c).toMatchObject({ vieBase: 1384, vie: 3529, attBase: 519, att: 986, defBase: 346, def: 657 });
    expect(consommationJournaliere({ jsn: 173 }, "loge")).toBe(415);
  });

  it("lit l'attaque en cours", () => {
    const [a, ...autres] = lireAttaquesEnCours(doc);
    expect(autres).toHaveLength(0);
    expect(a).toMatchObject({
      id: "98500",
      cible: "Cible",
      allianceCible: "TAG",
      lieu: "Terrain de chasse",
      reste: 70427,
      troupes: "1 Jeune Soldate Naine",
      arriveeAffichee: "19h56",
    });
  });

  it("lit la chasse dans la boîte Compte+", () => {
    expect(lireChassesBoite(doc)).toEqual({
      nombre: 1,
      restePremiere: 12839,
      chasses: [{ surface: 12924, finAffichee: "03h57" }],
    });
  });
});

describe("page Attaquer (s5)", () => {
  it("lit toutes les attaques dans l'ordre", () => {
    const a = lireAttaquesEnCours(charger("attaquer.html"));
    expect(a.map((x) => [x.id, x.reste, x.arriveeAffichee])).toEqual([
      ["98502", 70418, "19h58"],
      ["98504", 70431, "19h58"],
      ["98506", 70436, "19h58"],
    ]);
  });
});

describe("page Ennemies (s5)", () => {
  it("lit pseudo, terrain et distance", () => {
    const l = lireTableauEnnemie(charger("ennemie.html"));
    expect(l.map((x) => [x.pseudo, x.terrain, x.distance, x.etat])).toEqual([
      ["Joueur1", 57128, 26, "Fourmilière Libre"],
      ["Joueur2", 48693, 89, "En vacances"],
      ["Joueur3", 37891, 44, "Soumis à Joueur4"],
    ]);
  });
});

describe("page Armée avec dôme (s5)", () => {
  const doc = charger("armee-dome.html");

  it("lit la garnison sur deux lieux", () => {
    expect(lirePageArmee(doc).troupes).toEqual({ terrain: {}, dome: { jsn: 378 }, loge: { jsn: 35 } });
  });

  it("retrouve les valeurs du jeu, arrondies par défaut", () => {
    // Dôme 3 : 3 024 + 2 419 + 756 = 6 199 ; attaque 1 134 + 1 020 (1 020,6) = 2 154 ; défense 756 + 680
    expect(caracteristiques({ jsn: 378 }, { bouclier: 8, armes: 9 }, "dome", 3)).toMatchObject({
      vie: 6199,
      att: 2154,
      def: 1436,
    });
    // Loge 3 : 280 + 224 + 210 = 714 ; attaque 105 + 94 (94,5) = 199 ; défense 70 + 63
    expect(caracteristiques({ jsn: 35 }, { bouclier: 8, armes: 9 }, "loge", 3)).toMatchObject({
      vie: 714,
      att: 199,
      def: 133,
    });
    expect(consommationJournaliere({ jsn: 378 }, "dome")).toBe(604);
    expect(consommationJournaliere({ jsn: 35 }, "loge")).toBe(84);
  });

  it("lit lieu, troupes et minute d'arrivée de chaque attaque", () => {
    expect(lireAttaquesEnCours(doc).map((a) => [a.cible, a.lieu, a.reste, a.effectifs, a.arriveeAffichee])).toEqual([
      ["Allie1", "Dôme", 14440, { jsn: 2 }, "04h46"],
      ["Allie2", "Loge Impériale", 33130, { jsn: 3 }, "09h57"],
      ["Allie3", "Terrain de chasse", 48357, { jsn: 1 }, "14h11"],
    ]);
  });
});

describe("page Ressources (s5)", () => {
  const doc = charger("ressources.html");

  it("lit les chasses en cours avec leurs troupes", () => {
    const c = lireChassesEnCours(doc);
    expect(c.map((x) => [x.id, x.surface, x.reste, x.arriveeAffichee])).toEqual([
      ["232614", 1, 8204, "02h59"],
      ["232531", 12924, 11667, "03h57"],
    ]);
    expect(c[0]?.effectifs).toEqual({ jsn: 384 });
    expect(c[1]?.effectifs).toEqual({
      jsn: 518,
      sn: 690,
      ne: 291,
      js: 8449,
      s: 3078,
      a: 8886,
      ae: 3579,
      se: 1248,
    });
  });

  it("lit les deux chasses dans la boîte Compte+", () => {
    expect(lireChassesBoite(doc)?.chasses).toEqual([
      { surface: 1, finAffichee: "02h59" },
      { surface: 12924, finAffichee: "03h57" },
    ]);
  });

  it("déduit 38 niveaux de bonus de ponte du rythme de la file", () => {
    const ponte = lirePonteBoite(doc);
    expect(ponte).toEqual({ file: [{ nombre: 4576, unite: "jsn" }], reste: 25050 });
    expect(estimerNiveauxPonte(ponte!)).toBe(38);
  });

  it("lit le bonus de chasse et applique la formule du jeu", () => {
    expect(lireBonusChasse(doc)).toEqual({ bonus: 8, tdc: 19095 });
    expect(dureeChasse(19095, 12924, 8)).toBe(Math.ceil(32019 * 0.9 ** 8));
  });
});

describe("lireTroupes", () => {
  it("gère singulier, pluriel et milliers", () => {
    expect(lireTroupes("1 Jeune Soldate Naine")).toEqual({ jsn: 1 });
    expect(lireTroupes("1 248 Soldates d’élites, 2 Tanks, 5 Tueuses d’élite")).toEqual({ se: 1248, tk: 2, tue: 5 });
  });
});

describe("page Laboratoire (s5)", () => {
  const lignes = lireLaboratoire(charger("laboratoire.html"));

  it("lit les niveaux par titre de recherche", () => {
    expect(lireNiveauxRecherche(charger("laboratoire.html"))).toEqual({
      techniquePonte: 12,
      bouclier: 8,
      armes: 9,
      architecture: 11,
      communication: 2,
      vitesseChasse: 8,
      vitesseAttaque: 7,
      genetique: 4,
      acide: 1,
      poison: 0,
    });
  });

  it("retrouve exactement les coûts affichés du niveau suivant", () => {
    for (const l of lignes) expect(coutRecherche(l.cle, l.niveau + 1), l.cle).toEqual(l.cout);
  });

  it("retrouve les temps affichés avec la Salle d'analyse déduite (6)", () => {
    const sa = estimerSalleAnalyse(lignes);
    expect(sa).toBe(6);
    for (const l of lignes) expect(tempsRecherche(l.cle, l.niveau + 1, sa!), l.cle).toBe(l.temps);
  });
});

describe("Champignonnière", () => {
  it("produit 595 612 au niveau 17 comme sur le s5", () => {
    expect(productionChampignonniere(17)).toBe(595612);
  });
});
