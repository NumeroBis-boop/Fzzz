import type { CleRecherche } from "@fzzz/core";

/** Ce que l'extension retient des pages que le joueur a affichées. */
export interface Profil {
  recherches?: Partial<Record<CleRecherche, number>>;
  majRecherches?: number;
}

export async function lireProfil(): Promise<Profil> {
  const { profil } = (await browser.storage.local.get("profil")) as { profil?: Profil };
  return profil ?? {};
}

export async function majProfil(maj: Partial<Profil>): Promise<void> {
  const profil = await lireProfil();
  await browser.storage.local.set({ profil: { ...profil, ...maj } });
}
