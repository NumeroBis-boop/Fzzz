import type { Source } from "./statut.js";

export interface Coordonnees {
  x: number;
  y: number;
}

export const SOURCE_TRAJET: Source = {
  statut: "verifie-s5",
  origine: "arrondi(0,9^VA × 637 200 × (1 − e^(−d/350))), d = distance euclidienne des coordonnées",
  note:
    "Vérifié sur le s5 (2026-10-25), VA 7 : (9, 36) → (99, 17) : 70 436,32 → 70 436 s ; " +
    "(9, 36) → (69, 28) : 48 402,69 → 48 403 s. Seul l'arrondi au plus proche colle aux deux " +
    "(Toolzzz arrondit au supérieur : 70 437 pour le premier).",
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
  return Math.round(0.9 ** vitesseAttaque * p.dureeMax * (1 - Math.exp(-dist / p.echelle)));
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
