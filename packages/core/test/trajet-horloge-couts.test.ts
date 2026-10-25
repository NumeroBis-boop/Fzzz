import { describe, expect, it } from "vitest";
import { coutRecherche, coutConstruction, capaciteEntrepot } from "../src/data/couts.js";
import { distance, dureeTrajet, niveauxVACompatibles } from "../src/trajet.js";
import { estimerDecalage } from "../src/horloge.js";

describe("trajet", () => {
  it("reproduit la formule Toolzzz", () => {
    const d = distance({ x: 0, y: 0 }, { x: 30, y: 40 });
    expect(d).toBe(50);
    expect(dureeTrajet(d, 0)).toBe(Math.floor(637200 * (1 - Math.exp(-50 / 350))));
  });

  it("reproduit un trajet réel du s5 à la seconde", () => {
    // (9, 36) → (99, 17), VA 7 : 19 h 33 min 56 s affichés sur le profil
    expect(dureeTrajet(distance({ x: 9, y: 36 }, { x: 99, y: 17 }), 7)).toBe(70436);
  });

  it("retrouve la VA à partir d'une durée observée", () => {
    expect(niveauxVACompatibles(120, dureeTrajet(120, 7))).toContain(7);
  });
});

describe("coûts", () => {
  it("double à chaque niveau et coûte des ouvrières pour Armes", () => {
    expect(coutRecherche("armes", 1)).toEqual({ nourriture: 300, materiaux: 200, ouvrieres: 80 });
    expect(coutRecherche("armes", 4).ouvrieres).toBe(640);
  });

  it("l'étable à pucerons ne coûte que des matériaux", () => {
    expect(coutConstruction("etablePucerons", 3)).toEqual({ nourriture: 0, materiaux: 6000, ouvrieres: 0 });
  });

  it("calcule la capacité d'entrepôt", () => {
    expect(capaciteEntrepot(1)).toBe(2900);
  });
});

describe("horloge serveur", () => {
  it("encadre le vrai décalage et le resserre avec les échantillons", () => {
    const vrai = 3_456; // serveur en avance de 3,456 s
    const echantillons = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => {
      const envoi = 1_000_000 + k * 7_919 + k * 113;
      const latence = 40 + ((k * 37) % 90);
      const production = envoi + latence / 2; // heure locale où le serveur répond
      const dateServeur = Math.floor((production + vrai) / 1000) * 1000;
      return { dateServeur, envoi, reception: envoi + latence };
    });
    const est = estimerDecalage(echantillons);
    expect(est).not.toBeNull();
    expect(Math.abs(est!.decalage - vrai)).toBeLessThanOrEqual(est!.incertitude);
    expect(est!.incertitude).toBeLessThan(500);
    expect(est!.retenus).toBe(8);
  });

  it("repart des échantillons récents si l'horloge locale a sauté", () => {
    const avant = { dateServeur: 10_000, envoi: 9_950, reception: 10_050 };
    const apres = { dateServeur: 20_000, envoi: 9_950 + 60_000, reception: 10_050 + 60_000 };
    expect(estimerDecalage([avant, apres])?.retenus).toBe(1);
  });
});
