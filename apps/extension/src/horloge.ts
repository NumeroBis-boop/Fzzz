import { estimerDecalage, type EchantillonHorloge, type EstimationDecalage } from "@fzzz/core";
import type { PageServeur } from "../entrypoints/background";

let estimation: EstimationDecalage | null = null;

export async function initialiserHorloge(): Promise<void> {
  const charger = (e: EchantillonHorloge[] | undefined) => {
    estimation = estimerDecalage(e ?? []);
  };
  const { echantillons } = (await browser.storage.local.get("echantillons")) as { echantillons?: EchantillonHorloge[] };
  charger(echantillons);
  browser.storage.local.onChanged.addListener((c) => {
    if (c.echantillons) charger(c.echantillons.newValue as EchantillonHorloge[] | undefined);
  });
}

export function estimationHorloge(): EstimationDecalage | null {
  return estimation;
}

/** Heure serveur actuelle (ms), ou null si aucune page n'a encore été mesurée. */
export function maintenantServeur(): number | null {
  return estimation ? Date.now() + estimation.decalage : null;
}

/**
 * Instant (heure serveur, ms) où le jeu a généré la page affichée. Les
 * comptes à rebours du jeu (`reste(…)`) partent de cet instant.
 *
 * Source préférée : l'en-tête `Date` de cette page (même seconde que le calcul
 * du serveur, ±1 s). Repli : début de réponse local + décalage estimé.
 */
export async function generationPage(): Promise<{ ms: number; source: "date" | "estimation" } | null> {
  try {
    const p = (await browser.runtime.sendMessage({ type: "fzzz:page" })) as PageServeur | null;
    if (p && p.url === location.href) return { ms: p.dateServeur, source: "date" };
  } catch {
    // arrière-plan indisponible : on passe au repli
  }
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (!estimation || !nav) return null;
  return { ms: performance.timeOrigin + nav.responseStart + estimation.decalage, source: "estimation" };
}
