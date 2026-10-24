import type { Source } from "./statut.js";
import { UNITES, type CodeUnite, type Effectifs } from "./data/unites.js";

export type Lieu = "terrain" | "dome" | "loge";

export const SOURCE_BONUS: Source = {
  statut: "verifie-s5",
  origine: "Page Armée du s5 (2026-10-24) : 173 JSN en loge 3, Bouclier 8, Armes 9",
  note:
    "Vie : base × (1 + 0,1 × Bouclier) + base × bonus de lieu (loge (n+2) × 15 % vérifié ; dôme (n+2) × 5 % non vérifié). " +
    "Dégâts : base × (1 + 0,1 × Armes). Arrondi à l'unité : floor et round non départagés par l'échantillon.",
};

/** Bonus de vie du lieu, en fraction de la vie de base. */
export function bonusLieu(lieu: Lieu, niveau: number): number {
  if (niveau <= 0 || lieu === "terrain") return 0;
  return lieu === "loge" ? (niveau + 2) * 0.15 : (niveau + 2) * 0.05;
}

export interface Caracteristiques {
  vieBase: number;
  vie: number;
  attBase: number;
  att: number;
  defBase: number;
  def: number;
}

function somme(effectifs: Effectifs, champ: "vie" | "att" | "def"): number {
  let total = 0;
  for (const u of UNITES) total += (effectifs[u.code] ?? 0) * u[champ];
  return total;
}

export function caracteristiques(
  effectifs: Effectifs,
  niveaux: { bouclier: number; armes: number },
  lieu: Lieu = "terrain",
  niveauLieu = 0,
): Caracteristiques {
  const vieBase = somme(effectifs, "vie");
  const attBase = somme(effectifs, "att");
  const defBase = somme(effectifs, "def");
  return {
    vieBase,
    vie: vieBase + Math.round(vieBase * 0.1 * niveaux.bouclier) + Math.round(vieBase * bonusLieu(lieu, niveauLieu)),
    attBase,
    att: attBase + Math.round(attBase * 0.1 * niveaux.armes),
    defBase,
    def: defBase + Math.round(defBase * 0.1 * niveaux.armes),
  };
}

/** Taux d'entretien journalier (fraction du coût en nourriture). */
export const ENTRETIEN: Record<Lieu, number> = { terrain: 0.05, dome: 0.1, loge: 0.15 };

export function consommationJournaliere(effectifs: Effectifs, lieu: Lieu): number {
  let cout = 0;
  for (const u of UNITES) cout += (effectifs[u.code] ?? 0) * u.cout;
  return Math.round(cout * ENTRETIEN[lieu]);
}

export type { CodeUnite };
