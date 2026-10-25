import type { CleRecherche, Effectifs } from "@fzzz/core";

/** Chasse vue sur Ressources.php, avec son heure de retour absolue (heure serveur, ms). */
export interface ChasseMemorisee {
  id: string;
  surface: number;
  fin: number;
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
}

export async function lireProfil(): Promise<Profil> {
  const { profil } = (await browser.storage.local.get("profil")) as { profil?: Profil };
  return profil ?? {};
}

export async function majProfil(maj: Partial<Profil>): Promise<void> {
  const profil = await lireProfil();
  await browser.storage.local.set({ profil: { ...profil, ...maj } });
}
