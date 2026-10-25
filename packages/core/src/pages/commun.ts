import type { CodeUnite, Effectifs } from "../data/unites.js";

/** « 3 460 273 » (espaces simples ou insécables) → 3460273. */
export function entier(texte: string | null | undefined): number | null {
  if (!texte) return null;
  const n = Number(texte.replace(/[\s  ]/g, ""));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/**
 * Abréviations utilisées par les pages du s5 (`div.que_sur_telephone`).
 * Les pages vues n'affichent que 12 unités : le Concierge d'élite et le Tank
 * d'élite (obtenus seulement par l'expérience) n'y ont pas de ligne.
 */
export const ABREVIATIONS_S5: Record<string, CodeUnite> = {
  JSN: "jsn",
  SN: "sn",
  NE: "ne",
  JS: "js",
  S: "s",
  C: "c",
  A: "a",
  AE: "ae",
  SE: "se",
  Tk: "tk",
  T: "tu",
  TE: "tue",
};

/**
 * Noms au singulier et au pluriel, tels qu'écrits dans les listes de troupes
 * (« 518 Jeunes Soldates Naines, 291 Naines d’Elites, 3 579 Artilleuses d’élites »).
 * Clés normalisées : minuscules, apostrophes droites, sans « s » final par mot.
 */
const NOMS_TROUPES: [string, CodeUnite][] = [
  ["jeune soldate naine", "jsn"],
  ["soldate naine", "sn"],
  ["naine d'elite", "ne"],
  ["jeune soldate", "js"],
  ["soldate d'elite", "se"],
  ["soldate", "s"],
  ["concierge d'elite", "ce"],
  ["concierge", "c"],
  ["artilleuse d'elite", "ae"],
  ["artilleuse", "a"],
  ["tank d'elite", "tke"],
  ["tank", "tk"],
  ["tueuse d'elite", "tue"],
  ["tueuse", "tu"],
  ["ouvriere", "ouvriere"],
];

function normaliserNom(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .split(/\s+/)
    .map((mot) => (mot.length > 3 && mot.endsWith("s") ? mot.slice(0, -1) : mot))
    .join(" ")
    .trim();
}

export function codeUnite(nom: string): CodeUnite | undefined {
  const n = normaliserNom(nom);
  return NOMS_TROUPES.find(([k]) => k === n)?.[1];
}

/** « 518 Jeunes Soldates Naines, 690 Soldates Naines » → { jsn: 518, sn: 690 }. */
export function lireTroupes(texte: string): Effectifs {
  const res: Effectifs = {};
  for (const morceau of texte.split(",")) {
    const m = /^\s*([\d\s\u00a0\u202f]+?)\s+(\D+?)\s*\.?\s*$/.exec(morceau);
    const code = m ? codeUnite(m[2]!) : undefined;
    const n = m ? entier(m[1]) : null;
    if (code && n !== null) res[code] = (res[code] ?? 0) + n;
  }
  return res;
}

/** Données cachées présentes sur toutes les pages (`#data`). */
export interface DonneesJoueur {
  pseudo: string;
  ouvrieres: number;
  materiaux: number;
  nourriture: number;
  tdc: number;
  alliance: string;
}

export function lireDonneesJoueur(doc: ParentNode): DonneesJoueur | null {
  const t = (id: string) => doc.querySelector(`#data #${id}`)?.textContent?.trim() ?? null;
  const pseudo = t("pseudo");
  const tdc = entier(t("quantite_tdc"));
  if (!pseudo || tdc === null) return null;
  return {
    pseudo,
    ouvrieres: entier(t("nb_ouvrieres")) ?? 0,
    materiaux: entier(t("nb_materiaux")) ?? 0,
    nourriture: Math.floor(Number(t("nb_nourriture") ?? 0)),
    tdc,
    alliance: t("tag_alliance") ?? "",
  };
}
