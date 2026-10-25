import type { Source } from "../statut.js";

/**
 * Coûts et temps des constructions et recherches. Seules les valeurs de
 * niveau 1 sont stockées ; les autres niveaux suivent des ratios géométriques.
 */
export const SOURCE_COUTS: Source = {
  statut: "communaute",
  origine: "Toolzzz public/js/data/couts.js, extrait de toolzzz.fr/couts.php (2026-05-07)",
  note:
    "Coûts des 10 recherches et temps de 8 recherches vérifiés sur le Laboratoire du s5 (2026-10-25, Salle d'analyse 6). " +
    "Temps de base d'Acide et de Poison corrigés (10 000 et 50 000 s au lieu de 2 800 et 3 200). Constructions : coûts et temps des 13 bâtiments vérifiés sur la page Construction (Architecture 11).",
};

const RATIO_T_CONSTRUCTION = 1.6;
const RATIO_T_RECHERCHE = 1.7;
const RATIO_COUT = 2;
const RATIO_PROD_CHAMPI = 1.7;
const RATIO_BONUS = 0.9;

export interface Construction {
  nom: string;
  /** Temps au niveau 1, en secondes. */
  t: number;
  /** Matériaux au niveau 1. */
  m: number;
  max: number;
  /** Ratio de coût en matériaux, s'il diffère de 2. */
  ratioM?: number;
}

export interface Recherche {
  nom: string;
  t: number;
  /** Ouvrières au niveau 1 (absent si la recherche n'en coûte pas). */
  o?: number;
  /** Nourriture au niveau 1. */
  n: number;
  m: number;
  max: number;
}

export const CONSTRUCTIONS = {
  champignonniere: { nom: "Champignonnière", t: 120, m: 90, max: 50, ratioM: 1.85 },
  entrepotNourriture: { nom: "Entrepôt de Nourriture", t: 180, m: 600, max: 50 },
  entrepotMateriaux: { nom: "Entrepôt de Matériaux", t: 180, m: 600, max: 50 },
  couveuse: { nom: "Couveuse", t: 180, m: 600, max: 50 },
  solarium: { nom: "Solarium", t: 1000, m: 2000, max: 50 },
  laboratoire: { nom: "Laboratoire", t: 300, m: 1400, max: 50 },
  salleAnalyse: { nom: "Salle d'analyse", t: 300, m: 1400, max: 50 },
  salleCombat: { nom: "Salle de combat", t: 120, m: 300, max: 50 },
  caserne: { nom: "Caserne", t: 200, m: 800, max: 50 },
  dome: { nom: "Dôme", t: 400, m: 3500, max: 50 },
  loge: { nom: "Loge Impériale", t: 500, m: 5000, max: 50 },
  etablePucerons: { nom: "Étable à pucerons", t: 500, m: 1500, max: 50 },
  etableCochenilles: { nom: "Étable à cochenilles", t: 150, m: 10000, max: 36 },
} as const satisfies Record<string, Construction>;

export const RECHERCHES = {
  techniquePonte: { nom: "Technique de ponte", t: 120, n: 120, m: 120, max: 50 },
  bouclier: { nom: "Bouclier Thoracique", t: 120, o: 80, n: 200, m: 300, max: 50 },
  armes: { nom: "Armes", t: 120, o: 80, n: 300, m: 200, max: 50 },
  architecture: { nom: "Architecture", t: 200, n: 100, m: 200, max: 50 },
  communication: { nom: "Communication avec les animaux", t: 120, o: 80, n: 200, m: 500, max: 50 },
  vitesseChasse: { nom: "Vitesse de chasse", t: 200, o: 50, n: 4000, m: 2500, max: 50 },
  vitesseAttaque: { nom: "Vitesse d'attaque", t: 200, n: 3000, m: 1000, max: 50 },
  genetique: { nom: "Génétique", t: 180, o: 1000, n: 3000, m: 10000, max: 50 },
  acide: { nom: "Acide", t: 10000, o: 5000, n: 100000, m: 300000, max: 30 },
  poison: { nom: "Poison", t: 50000, o: 250000, n: 40000000, m: 15000000, max: 20 },
} as const satisfies Record<string, Recherche>;

export type CleConstruction = keyof typeof CONSTRUCTIONS;
export type CleRecherche = keyof typeof RECHERCHES;

export interface Cout {
  nourriture: number;
  materiaux: number;
  ouvrieres: number;
}

/** Coût pour passer AU niveau `niveau` (le niveau 1 est le premier achat). */
export function coutConstruction(cle: CleConstruction, niveau: number): Cout {
  const c: Construction = CONSTRUCTIONS[cle];
  const ratio = c.ratioM ?? RATIO_COUT;
  // Tronqué comme le jeu : Champignonnière 18 = ⌊90 × 1,85^17⌋ = 3 134 453.
  return { nourriture: 0, materiaux: Math.floor(c.m * ratio ** (niveau - 1) + 1e-6), ouvrieres: 0 };
}

export function coutRecherche(cle: CleRecherche, niveau: number): Cout {
  const r: Recherche = RECHERCHES[cle];
  const f = RATIO_COUT ** (niveau - 1);
  return {
    nourriture: Math.round(r.n * f),
    materiaux: Math.round(r.m * f),
    ouvrieres: Math.round((r.o ?? 0) * f),
  };
}

/** Durée en secondes, réduite de 10 % par niveau d'Architecture. */
export function tempsConstruction(cle: CleConstruction, niveau: number, architecture = 0): number {
  const c: Construction = CONSTRUCTIONS[cle];
  return Math.round(c.t * RATIO_T_CONSTRUCTION ** (niveau - 1) * RATIO_BONUS ** architecture);
}

/** Durée en secondes, réduite de 10 % par niveau de Salle d'analyse. */
export function tempsRecherche(cle: CleRecherche, niveau: number, salleAnalyse = 0): number {
  const r: Recherche = RECHERCHES[cle];
  return Math.round(r.t * RATIO_T_RECHERCHE ** (niveau - 1) * RATIO_BONUS ** salleAnalyse);
}

export function capaciteEntrepot(niveau: number): number {
  return 500 + 1200 * 2 ** niveau;
}

/**
 * Production journalière de nourriture de la Champignonnière : ⌊72 × 1,7^n⌋.
 * Vérifié au niveau 17 sur le s5 (595 612). Toolzzz utilisait 122 × 1,7^(n−1),
 * soit 0,3 % de moins : 122 est l'arrondi de 72 × 1,7 = 122,4.
 */
export function productionChampignonniere(niveau: number): number {
  if (niveau <= 0) return 0;
  return Math.floor(72 * RATIO_PROD_CHAMPI ** niveau + 1e-6);
}
