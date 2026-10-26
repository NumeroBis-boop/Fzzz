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

/** Résultat de la vérification de mise à jour demandée par le bouton « Mettre à jour Fzzz ». */
interface ResultatMaj {
  statut: "update_available" | "no_update" | "throttled" | "non_supporte" | "dossier" | "erreur";
  version?: string;
  message?: string;
}

/**
 * Bouton « Mettre à jour Fzzz » (Paramètres → À propos). Chrome sait demander
 * une vérification immédiate au Chrome Web Store ; s'il trouve une version, le
 * rechargement de l'extension l'installe. Firefox n'a pas cette fonction : la
 * page propose alors le dernier .xpi signé (et Firefox vérifie seul chaque jour).
 */
async function verifierMiseAJour(): Promise<ResultatMaj> {
  // chargée depuis un dossier (mode développeur) : jamais de mise à jour automatique,
  // et Chrome répondrait « no_update » à tort
  try {
    const moi = await browser.management.getSelf();
    if (moi.installType === "development") return { statut: "dossier" };
  } catch (e) {
    /* management.getSelf indisponible : on tente quand même la vérification */
  }
  // requestUpdateCheck : Chrome uniquement (absent des types communs WXT)
  const runtime = browser.runtime as unknown as {
    requestUpdateCheck?: () => Promise<{ status: string; version?: string } | [string, object]>;
  };
  if (typeof runtime.requestUpdateCheck !== "function") return { statut: "non_supporte" };
  try {
    const res = await runtime.requestUpdateCheck();
    const statut = (Array.isArray(res) ? res[0] : res.status) as ResultatMaj["statut"];
    const version = Array.isArray(res) ? undefined : res.version;
    // la nouvelle version, déjà téléchargée, s'installe au rechargement
    if (statut === "update_available") setTimeout(() => browser.runtime.reload(), 800);
    return { statut, version };
  } catch (e) {
    // extension chargée depuis un dossier (mode développeur) : pas de mise à jour possible
    return { statut: "erreur", message: String(e) };
  }
}

/** Site de suivi des convois de la OUAF (http uniquement). */
const OUAF = "http://ouafchaine.fr";
const OUAF_ORIGINE = "http://ouafchaine.fr/*";

interface RequeteOuaf {
  type: "fzzz_ouaf";
  methode: string;
  chemin: string;
  corps?: unknown;
}

/**
 * Requête au site de suivi des convois, pour le script de contenu de la page
 * Convois (une page https ne peut pas appeler un site http). Limitée à l'API
 * du site, et seulement si le joueur a accordé l'accès à ouafchaine.fr. La
 * session du site est gardée par son cookie, comme dans un onglet.
 */
async function requeteOuaf(m: RequeteOuaf): Promise<{
  ok?: boolean;
  statut?: number;
  donnees?: unknown;
  erreur?: "permission" | "requete" | "reseau";
}> {
  if (!/^\/api\/[a-z/-]+$/.test(m.chemin) || !["GET", "POST", "PUT"].includes(m.methode))
    return { erreur: "requete" };
  if (!(await browser.permissions.contains({ origins: [OUAF_ORIGINE] })))
    return { erreur: "permission" };
  try {
    const r = await fetch(OUAF + m.chemin, {
      method: m.methode,
      credentials: "include",
      headers: m.corps === undefined ? {} : { "Content-Type": "application/json" },
      body: m.corps === undefined ? undefined : JSON.stringify(m.corps),
    });
    const donnees = await r.json().catch(() => ({}));
    return { ok: r.ok, statut: r.status, donnees };
  } catch (e) {
    return { erreur: "reseau" };
  }
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: unknown) => {
    const type = (message as { type?: string })?.type;
    if (type === "fzzz_ouaf") return requeteOuaf(message as RequeteOuaf);
    if (type !== "fzzz_majVerifier") return undefined;
    return verifierMiseAJour();
  });

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
