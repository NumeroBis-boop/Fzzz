/**
 * Fzzz : lecture passive de l'en-tête HTTP `Date` des réponses de Fourmizzz,
 * pour caler l'horloge de l'extension sur l'heure du serveur. Aucune requête
 * n'est émise : on n'observe que les pages et requêtes déjà faites par le
 * joueur ou par l'extension, et rien ne prolonge la session (règlement C2).
 *
 * Pour chaque réponse, on mémorise l'heure locale d'envoi, celle de réception
 * des en-têtes et la valeur de `Date` (tronquée à la seconde). Les scripts de
 * contenu en déduisent le décalage serveur − PC (voir public/js/class/Horloge.js).
 * Les échantillons sont rangés par serveur (s1, s5…), dans storage.local.
 */

const FILTRE: Browser.webRequest.RequestFilter = {
  urls: ["*://*.fourmizzz.fr/*"],
  types: ["main_frame", "xmlhttprequest"],
};
const MAX_ECHANTILLONS = 30;

interface Echantillon {
  /** En-tête `Date`, en ms depuis l'époque (multiple de 1000). */
  date: number;
  /** Heure locale (ms) au départ de la requête. */
  envoi: number;
  /** Heure locale (ms) à la réception des en-têtes. */
  reception: number;
}

/** Heure locale d'envoi par requête, le temps que les en-têtes arrivent. */
const envois = new Map<string, number>();
/** Écritures chaînées : deux réponses proches ne doivent pas s'écraser. */
let file: Promise<void> = Promise.resolve();

function enregistrer(serveur: string, e: Echantillon): void {
  const cle = `fzzz_horloge_${serveur}`;
  file = file
    .then(async () => {
      const lu = (await browser.storage.local.get(cle))[cle];
      const liste: Echantillon[] = Array.isArray(lu) ? lu : [];
      liste.push(e);
      await browser.storage.local.set({ [cle]: liste.slice(-MAX_ECHANTILLONS) });
    })
    .catch(() => {});
}

export default defineBackground(() => {
  browser.webRequest.onSendHeaders.addListener((d) => {
    envois.set(d.requestId, d.timeStamp);
  }, FILTRE);

  browser.webRequest.onHeadersReceived.addListener(
    (d) => {
      const envoi = envois.get(d.requestId);
      envois.delete(d.requestId);
      const entete = d.responseHeaders?.find((h) => h.name.toLowerCase() === "date")?.value;
      const date = entete ? Date.parse(entete) : NaN;
      if (envoi === undefined || Number.isNaN(date)) return undefined;
      const serveur = new URL(d.url).hostname.split(".")[0] ?? "";
      enregistrer(serveur, { date, envoi, reception: d.timeStamp });
      return undefined;
    },
    FILTRE,
    ["responseHeaders"],
  );

  // requête abandonnée ou en erreur : on oublie son heure d'envoi
  browser.webRequest.onErrorOccurred.addListener((d) => {
    envois.delete(d.requestId);
  }, FILTRE);
});
