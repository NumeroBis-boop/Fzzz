import type { Source } from "./statut.js";
import { UNITES, type CodeUnite, type Effectifs } from "./data/unites.js";

export type Lieu = "terrain" | "dome" | "loge";

export const SOURCE_BONUS: Source = {
  statut: "verifie-s5",
  origine: "Pages Armée du s5 (2026-10-24) : JSN en dôme 3 et en loge 3, Bouclier 8, Armes 9",
  note:
    "Vie : base + ⌊base × 0,1 × Bouclier⌋ + ⌊base × bonus de lieu⌋ (dôme (n+2) × 5 %, loge (n+2) × 15 %). " +
    "Dégâts : base + ⌊base × 0,1 × Armes⌋. Arrondis par défaut (1 020,6 → 1 020).",
};

/** Partie entière, tolérante aux erreurs de virgule flottante (0,1 × 3 = 0,30000000000000004). */
const plancher = (x: number) => Math.floor(x + 1e-9);

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
    vie: vieBase + plancher(vieBase * 0.1 * niveaux.bouclier) + plancher(vieBase * bonusLieu(lieu, niveauLieu)),
    attBase,
    att: attBase + plancher(attBase * 0.1 * niveaux.armes),
    defBase,
    def: defBase + plancher(defBase * 0.1 * niveaux.armes),
  };
}

/** Taux d'entretien journalier (fraction du coût en nourriture). */
export const ENTRETIEN: Record<Lieu, number> = { terrain: 0.05, dome: 0.1, loge: 0.15 };

export function consommationJournaliere(effectifs: Effectifs, lieu: Lieu): number {
  let cout = 0;
  for (const u of UNITES) cout += (effectifs[u.code] ?? 0) * u.cout;
  return plancher(cout * ENTRETIEN[lieu]);
}

export type { CodeUnite };
