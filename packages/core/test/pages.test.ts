// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lireAttaquesEnCours } from "../src/pages/attaques.js";
import { lireChassesBoite } from "../src/pages/boite-compte-plus.js";
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
