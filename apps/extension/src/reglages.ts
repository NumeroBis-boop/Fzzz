import type { CleConstruction, CleRecherche, Coordonnees, Effectifs } from "@fzzz/core";

/** Chasse vue sur Ressources.php, avec son heure de retour absolue (heure serveur, ms). */
export interface ChasseMemorisee {
  id: string;
  surface: number;
  fin: number;
  effectifs: Effectifs;
}

/** Attaque vue sur Armée ou Attaquer, avec son heure d'arrivée absolue (heure serveur, ms). */
export interface AttaqueMemorisee {
  id: string;
  cible: string;
  lieu: string | null;
  arrivee: number;
  effectifs: Effectifs;
}

/** Ce que l'extension retient des pages que le joueur a affichées. */
export interface Profil {
  recherches?: Partial<Record<CleRecherche, number>>;
  majRecherches?: number;
  /** Bouclier et Armes lus sur la page Armée. */
  niveauBouclier?: number;
  niveauArmes?: number;
  /** Couveuse + Solarium + Technique de ponte, déduit du rythme de ponte. */
  niveauxPonte?: number;
  /** Bonus de chasse lu sur Ressources.php. */
  vitesseChasse?: number;
  chasses?: ChasseMemorisee[];
  attaques?: AttaqueMemorisee[];
  /** Correction manuelle de l'horloge, en ms (pas de 100). */
  latence?: number;
  /** Ouvrières disponibles pour les convois, saisies au Laboratoire. */
  ouvrieresConvoi?: number;
  /** Armée totale (garnison + chasses + attaques) vue sur la page Armée. */
  armee?: Effectifs;
  majArmee?: number;
  salleAnalyse?: number;
  constructions?: Partial<Record<CleConstruction, number>>;
  /** Coordonnées de la fourmilière du joueur (son propre profil). */
  moi?: Coordonnees;
  /** Coordonnées vues sur les profils consultés, par pseudo. */
  coordonnees?: Record<string, Coordonnees & { maj: number }>;
}

/** Somme Couveuse + Solarium + Technique de ponte, si les deux pages ont été vues. */
export function bonusPonteConnu(p: Profil): number | undefined {
  const c = p.constructions;
  const tdp = p.recherches?.techniquePonte;
  if (c?.couveuse === undefined || c.solarium === undefined || tdp === undefined) return undefined;
  return c.couveuse + c.solarium + tdp;
}

export async function lireProfil(): Promise<Profil> {
  const { profil } = (await browser.storage.local.get("profil")) as { profil?: Profil };
  return profil ?? {};
}

export async function majProfil(maj: Partial<Profil>): Promise<void> {
  const profil = await lireProfil();
  await browser.storage.local.set({ profil: { ...profil, ...maj } });
}
