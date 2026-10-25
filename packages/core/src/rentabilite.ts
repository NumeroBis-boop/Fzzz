import { UNITES, UNITES_PONDABLES, unite, type CodeUnite, type Effectifs } from "./data/unites.js";
import { coutRecherche } from "./data/couts.js";

/**
 * Rentabilité d'un niveau d'Armes, de Bouclier ou d'Étable à pucerons, selon
 * les règles du joueur (fiche 03).
 *
 * Armes et Bouclier : comparer le niveau à ce que la reine pondrait pendant le
 * temps de ponte des ouvrières sacrifiées. Avec Cₙ ouvrières (60 s de ponte
 * de base chacune) et une unité produite de temps de ponte tᵤ et de
 * caractéristique cᵤ (hors bonus) :
 *
 *   Sₙ = ⌈ Cₙ × 60 / tᵤ × cᵤ × (n + 9) ⌉       rentable si H ≥ Sₙ
 *
 * où H est la caractéristique totale de l'armée hors bonus et n le niveau
 * visé. (n + 9) / 10 est le bonus actuel (niveau n − 1) des unités pondues,
 * et le niveau apporte 0,1 × H. Les bonus de ponte (Couveuse, Solarium,
 * Technique de ponte) réduisent ouvrières et unités dans la même proportion :
 * ils n'interviennent pas. Les ouvrières sacrifiées viennent du stock des
 * convois et ne récoltaient rien : aucune récolte perdue n'est comptée.
 */

export type Carac = "att" | "def" | "vie";

/** Recherche concernée par chaque caractéristique. */
const RECHERCHE: Record<Carac, "armes" | "bouclier"> = { att: "armes", def: "armes", vie: "bouclier" };

/** Temps de ponte de base d'une ouvrière, en secondes. */
const PONTE_OUVRIERE = 60;

export function totalHorsBonus(effectifs: Effectifs, carac: Carac): number {
  let total = 0;
  for (const u of UNITES) total += (effectifs[u.code] ?? 0) * u[carac];
  return total;
}

export function seuilRentabilite(carac: Carac, niveauVise: number, uniteProduite: CodeUnite): number {
  const u = unite(uniteProduite);
  const c = coutRecherche(RECHERCHE[carac], niveauVise).ouvrieres;
  // Arrondi supérieur à la toute fin, après correction des erreurs de virgule flottante.
  return Math.ceil((c * PONTE_OUVRIERE * u[carac] * (niveauVise + 9)) / u.ponte - 1e-9);
}

/**
 * Unité pondable au meilleur rendement (caractéristique par seconde de ponte) :
 * c'est la comparaison la plus exigeante pour le niveau de recherche.
 */
export function meilleureUnite(carac: Carac): CodeUnite {
  let meilleure: CodeUnite = "jsn";
  let rendement = 0;
  for (const u of UNITES) {
    if (!UNITES_PONDABLES.has(u.code) || u.code === "ouvriere") continue;
    if (u[carac] / u.ponte > rendement) {
      rendement = u[carac] / u.ponte;
      meilleure = u.code;
    }
  }
  return meilleure;
}

export interface Rentabilite {
  carac: Carac;
  niveauVise: number;
  ouvrieres: number;
  unite: CodeUnite;
  /** Caractéristique totale hors bonus de l'armée. */
  total: number;
  seuil: number;
  /** Points hors bonus qui manquent pour atteindre le seuil. */
  manquant: number;
  rentable: boolean;
}

export function rentabilite(
  effectifs: Effectifs,
  carac: Carac,
  niveauActuel: number,
  uniteProduite: CodeUnite = meilleureUnite(carac),
): Rentabilite {
  const niveauVise = niveauActuel + 1;
  const total = totalHorsBonus(effectifs, carac);
  const seuil = seuilRentabilite(carac, niveauVise, uniteProduite);
  return {
    carac,
    niveauVise,
    ouvrieres: coutRecherche(RECHERCHE[carac], niveauVise).ouvrieres,
    unite: uniteProduite,
    total,
    seuil,
    manquant: Math.max(0, seuil - total),
    rentable: total >= seuil,
  };
}

/**
 * Étable à pucerons. Chaque ouvrière transporte 10 + 0,5 × n ressources par
 * convoi (+5 % de la base par niveau, d'après la description du bâtiment).
 * Le niveau n exige Communication avec les animaux au niveau n + 2 : son coût
 * en ouvrières est celui des niveaux de Communication manquants, soit
 * 80 + 160 + 320 = 560 pour l'étable 1 en partant de zéro, puis
 * 80 × 2^(n+1) = 320 × 2^(n−1) par niveau.
 *
 *   ΔK = (O − Cₙ)(10 + 0,5n) − O(10 + 0,5(n−1)) = 0,5·O − Cₙ(10 + 0,5n)
 *   rentable si ΔK > 0, c'est-à-dire O ≥ Cₙ(20 + n) + 1
 *
 * où O est le nombre d'ouvrières disponibles pour les convois (hors TDC).
 */
export function communicationRequise(niveauEtable: number): number {
  return niveauEtable + 2;
}

/**
 * Ouvrières à sacrifier pour passer l'étable au niveau `niveauVise` : celles
 * des niveaux de Communication qui manquent. Sans niveau connu, on suppose le
 * minimum requis pour l'étable actuelle (modèle du joueur).
 */
export function coutOuvrieresEtable(niveauVise: number, niveauCommunication?: number): number {
  const depuis = niveauCommunication ?? (niveauVise === 1 ? 0 : communicationRequise(niveauVise - 1));
  let total = 0;
  for (let n = depuis + 1; n <= communicationRequise(niveauVise); n++) total += coutRecherche("communication", n).ouvrieres;
  return total;
}

export function capaciteConvoi(ouvrieres: number, niveauEtable: number): number {
  return ouvrieres * (10 + 0.5 * niveauEtable);
}

export interface PassageEtable {
  niveauVise: number;
  ouvrieresSacrifiees: number;
  ouvrieresAvant: number;
  gainCapacite: number;
  /** Ouvrières disponibles minimales pour que le passage soit rentable. */
  minimum: number;
  rentable: boolean;
}

export function passageEtable(ouvrieres: number, niveauActuel: number, niveauCommunication?: number): PassageEtable {
  const niveauVise = niveauActuel + 1;
  const c = coutOuvrieresEtable(niveauVise, niveauCommunication);
  const gainCapacite = 0.5 * ouvrieres - c * (10 + 0.5 * niveauVise);
  return {
    niveauVise,
    ouvrieresSacrifiees: c,
    ouvrieresAvant: ouvrieres,
    gainCapacite,
    minimum: c * (20 + niveauVise) + 1,
    rentable: gainCapacite > 0,
  };
}

/**
 * Enchaîne les passages tant qu'ils restent rentables, en déduisant chaque
 * sacrifice du stock d'ouvrières avant de tester le niveau suivant.
 */
export function planEtable(
  ouvrieres: number,
  niveauActuel: number,
  niveauCommunication?: number,
  maxPassages = 20,
): PassageEtable[] {
  const plan: PassageEtable[] = [];
  let o = ouvrieres;
  let niveau = niveauActuel;
  let comm = niveauCommunication;
  for (let i = 0; i < maxPassages; i++) {
    const p = passageEtable(o, niveau, comm);
    plan.push(p);
    if (!p.rentable) break;
    o -= p.ouvrieresSacrifiees;
    niveau = p.niveauVise;
    comm = communicationRequise(niveau);
  }
  return plan;
}
