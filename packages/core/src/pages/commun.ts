import type { CodeUnite } from "../data/unites.js";

/** « 3 460 273 » (espaces simples ou insécables) → 3460273. */
export function entier(texte: string | null | undefined): number | null {
  if (!texte) return null;
  const n = Number(texte.replace(/[\s  ]/g, ""));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/**
 * Abréviations utilisées par les pages du s5 (`div.que_sur_telephone`).
 * Le s5 n'affiche que 12 unités : ni Concierge d'élite ni Tank d'élite.
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

/** Noms complets des pages du s5 (page Attaquer, sans abréviation). */
export const NOMS_S5: Record<string, CodeUnite> = {
  "Jeune Soldate Naine": "jsn",
  "Soldate Naine": "sn",
  "Naine d’Elite": "ne",
  "Jeune Soldate": "js",
  Soldate: "s",
  Concierge: "c",
  Artilleuse: "a",
  "Artilleuse d’élite": "ae",
  "Soldate d’élite": "se",
  Tank: "tk",
  Tueuse: "tu",
  "Tueuse d’élite": "tue",
};

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
