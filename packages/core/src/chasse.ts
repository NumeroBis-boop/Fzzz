import type { Source } from "./statut.js";

export const SOURCE_DUREE_CHASSE: Source = {
  statut: "verifie-s5",
  origine: "Ressources.php du s5, fonction calculTempsChasse du jeu : ceil((TDC + surface) × 0,9^bonus)",
  note: "Toolzzz arrondit au plus proche (Math.round) ; le jeu arrondit à l'entier supérieur.",
};

/** Durée d'une chasse, en secondes. */
export function dureeChasse(tdcActuel: number, surface: number, vitesseChasse: number): number {
  return Math.ceil((tdcActuel + surface) * 0.9 ** vitesseChasse);
}
