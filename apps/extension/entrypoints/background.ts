import type { EchantillonHorloge } from "@fzzz/core";

/**
 * Lecture passive de l'en-tête `Date` des pages Fourmizzz chargées par le
 * joueur. Aucune requête n'est émise : la session n'est jamais prolongée
 * (règlement C2).
 */

const FILTRE = { urls: ["*://*.fourmizzz.fr/*"], types: ["main_frame", "xmlhttprequest"] as const };
const MAX_ECHANTILLONS = 30;

/** Heure locale d'envoi par requestId, le temps que les en-têtes arrivent. */
const envois = new Map<string, number>();

export interface PageServeur extends EchantillonHorloge {
  url: string;
}

export default defineBackground(() => {
  browser.webRequest.onSendHeaders.addListener(
    (d) => {
      envois.set(d.requestId, d.timeStamp);
    },
    { urls: FILTRE.urls, types: [...FILTRE.types] },
  );

  browser.webRequest.onHeadersReceived.addListener(
    (d) => {
      const envoi = envois.get(d.requestId);
      envois.delete(d.requestId);
      const date = d.responseHeaders?.find((h) => h.name.toLowerCase() === "date")?.value;
      const dateServeur = date ? Date.parse(date) : NaN;
      if (envoi !== undefined && !Number.isNaN(dateServeur)) {
        const e: EchantillonHorloge = { dateServeur, envoi, reception: d.timeStamp };
        void enregistrer(e, d.type === "main_frame" ? { tabId: d.tabId, url: d.url } : null);
      }
      return undefined;
    },
    { urls: FILTRE.urls, types: [...FILTRE.types] },
    ["responseHeaders"],
  );

  browser.runtime.onMessage.addListener((msg: unknown, sender) => {
    if ((msg as { type?: string })?.type !== "fzzz:page" || sender.tab?.id === undefined) return;
    return browser.storage.session.get(`page:${sender.tab.id}`).then((r) => r[`page:${sender.tab!.id}`] ?? null);
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    void browser.storage.session.remove(`page:${tabId}`);
  });
});

async function enregistrer(e: EchantillonHorloge, page: { tabId: number; url: string } | null): Promise<void> {
  const { echantillons = [] } = (await browser.storage.local.get("echantillons")) as {
    echantillons?: EchantillonHorloge[];
  };
  echantillons.push(e);
  await browser.storage.local.set({ echantillons: echantillons.slice(-MAX_ECHANTILLONS) });
  if (page) {
    const p: PageServeur = { ...e, url: page.url };
    await browser.storage.session.set({ [`page:${page.tabId}`]: p });
  }
}
