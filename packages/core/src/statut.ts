/**
 * Niveau de confiance d'une formule ou d'une donnée de jeu.
 *
 * - `officiel`   : écrit dans le tutoriel ou le règlement du jeu.
 * - `communaute` : rétro-ingénierie communautaire (Toolzzz, Calystène…),
 *                  vérifiée sur d'anciens serveurs mais pas sur le s5.
 * - `verifie-s5` : confronté à des observations réelles sur le s5.
 * - `hypothese`  : choix de modélisation non vérifié (arrondi, borne…).
 */
export type Statut = "officiel" | "communaute" | "verifie-s5" | "hypothese";

export interface Source {
  statut: Statut;
  origine: string;
  note?: string;
}
