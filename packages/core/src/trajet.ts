import type { Source } from "./statut.js";

export interface Coordonnees {
  x: number;
  y: number;
}

export const SOURCE_TRAJET: Source = {
  statut: "communaute",
  origine: "Toolzzz Joueur.js / content.js : ceil(0.9^VA × 637200 × (1 − e^(−d/350)))",
  note: "La MAJ 8 annonce une nouvelle carte : à recaler sur des trajets réels du s5.",
};

/**
 * Paramètres de la courbe de trajet. Exposés pour pouvoir recaler la formule
 * sur le s5 sans toucher au code appelant.
 */
export interface ParametresTrajet {
  /** Durée maximale (distance infinie) à VA 0, en secondes. */
  dureeMax: number;
  /** Distance caractéristique de la courbe. */
  echelle: number;
}

export const PARAMETRES_TRAJET_DEFAUT: ParametresTrajet = { dureeMax: 637_200, echelle: 350 };

export function distance(a: Coordonnees, b: Coordonnees): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Durée d'une attaque ou d'un convoi, en secondes. */
export function dureeTrajet(
  dist: number,
  vitesseAttaque: number,
  p: ParametresTrajet = PARAMETRES_TRAJET_DEFAUT,
): number {
  return Math.ceil(0.9 ** vitesseAttaque * p.dureeMax * (1 - Math.exp(-dist / p.echelle)));
}

/**
 * Niveau de VA compatible avec une durée observée : sert à estimer la VA
 * d'un adversaire à partir d'un RC. Renvoie les niveaux dont la durée
 * théorique est à `tolerance` secondes près de la durée observée.
 */
export function niveauxVACompatibles(
  dist: number,
  dureeObservee: number,
  tolerance = 1,
  p: ParametresTrajet = PARAMETRES_TRAJET_DEFAUT,
  vaMax = 50,
): number[] {
  const res: number[] = [];
  for (let va = 0; va <= vaMax; va++) {
    if (Math.abs(dureeTrajet(dist, va, p) - dureeObservee) <= tolerance) res.push(va);
  }
  return res;
}
