import type { CleRecherche } from "../data/couts.js";

/**
 * Niveaux de recherche (laboratoire.php).
 *
 * NON VÉRIFIÉ sur le s5 : sélecteurs repris de Toolzzz (`.ligneAmelioration`
 * contenant `.niveau_amelioration` = « Niveau 9 »), dans l'ordre ci-dessous.
 * À valider avec le HTML réel de la page.
 */
export const ORDRE_RECHERCHES: CleRecherche[] = [
  "techniquePonte",
  "bouclier",
  "armes",
  "architecture",
  "communication",
  "vitesseChasse",
  "vitesseAttaque",
  "genetique",
  "acide",
  "poison",
];

export function lireNiveauxRecherche(doc: ParentNode): Partial<Record<CleRecherche, number>> {
  const res: Partial<Record<CleRecherche, number>> = {};
  Array.from(doc.querySelectorAll(".ligneAmelioration")).forEach((ligne, i) => {
    const cle = ORDRE_RECHERCHES[i];
    const m = /Niveau\s+(\d+)/i.exec(ligne.querySelector(".niveau_amelioration")?.textContent ?? "");
    if (cle && m) res[cle] = Number(m[1]);
  });
  return res;
}
