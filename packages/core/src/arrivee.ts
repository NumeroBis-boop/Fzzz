/**
 * Heures d'arrivée à la seconde, en heure serveur.
 *
 * Le jeu donne, pour chaque attaque, le nombre de secondes restantes au
 * moment où il a généré la page (`reste(70427, "attaque_98500")`), et une
 * heure d'arrivée à la minute (« Arrivée à 19h56 »). Les combats sont résolus
 * dans l'ordre d'arrivée à la seconde (observation du joueur sur le s5).
 *
 * Arrivée = instant de génération de la page (heure serveur) + reste.
 * L'instant de génération vient de l'en-tête `Date` de la page elle-même
 * (précision ±1 s), ou à défaut de l'horloge estimée (`horloge.ts`).
 */

export const FUSEAU_SERVEUR = "Europe/Paris";

export function arrivee(generationServeurMs: number, resteSecondes: number): number {
  return generationServeurMs + resteSecondes * 1000;
}

const formats = new Map<string, Intl.DateTimeFormat>();
function format(secondes: boolean, fuseau: string): Intl.DateTimeFormat {
  const cle = `${secondes}|${fuseau}`;
  let f = formats.get(cle);
  if (!f) {
    f = new Intl.DateTimeFormat("fr-FR", {
      timeZone: fuseau,
      hour: "2-digit",
      minute: "2-digit",
      ...(secondes ? { second: "2-digit" } : {}),
      hourCycle: "h23",
    });
    formats.set(cle, f);
  }
  return f;
}

/** « 19:58:23 » (ou « 19:58 ») dans le fuseau du serveur. */
export function formaterHeure(ms: number, secondes = true, fuseau = FUSEAU_SERVEUR): string {
  return format(secondes, fuseau).format(new Date(ms));
}

/**
 * Vérifie qu'une heure calculée tombe dans la minute affichée par le jeu
 * (« 19h58 »). Sert de garde-fou : un écart signale un mauvais fuseau ou une
 * horloge mal estimée.
 */
export function concordeAvecMinuteAffichee(ms: number, affiche: string, fuseau = FUSEAU_SERVEUR): boolean {
  const m = /(\d{1,2})h(\d{2})/.exec(affiche);
  if (!m) return false;
  const [hh, mm] = formaterHeure(ms, false, fuseau).split(":");
  return Number(hh) === Number(m[1]) && Number(mm) === Number(m[2]);
}

/**
 * Minute affichée par le RC : celle qui suit l'impact (17:23:12 → 17h24),
 * sauf impact pile à la minute (17:23:00 → 17h23). Observation du joueur, s5.
 */
export function minuteRC(arriveeMs: number): number {
  return Math.ceil(Math.floor(arriveeMs / 1000) / 60) * 60_000;
}

/** « 17h24 », au format des RC du jeu. */
export function formaterMinuteRC(arriveeMs: number, fuseau = FUSEAU_SERVEUR): string {
  return formaterHeure(minuteRC(arriveeMs), false, fuseau).replace(":", "h");
}

export function formaterDuree(secondes: number): string {
  const j = Math.floor(secondes / 86400);
  const h = Math.floor((secondes % 86400) / 3600);
  const m = Math.floor((secondes % 3600) / 60);
  const s = Math.floor(secondes % 60);
  const hms = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return j > 0 ? `${j}j ${hms}` : hms;
}
