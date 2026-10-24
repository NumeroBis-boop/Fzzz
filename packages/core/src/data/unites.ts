import type { Source } from "../statut.js";

export type CodeUnite =
  | "ouvriere"
  | "jsn"
  | "sn"
  | "ne"
  | "js"
  | "s"
  | "c"
  | "ce"
  | "a"
  | "ae"
  | "se"
  | "tk"
  | "tke"
  | "tu"
  | "tue";

export interface Unite {
  code: CodeUnite;
  nom: string;
  /** Temps de ponte de base, en secondes. */
  ponte: number;
  /** Coût en nourriture. */
  cout: number;
  vie: number;
  att: number;
  def: number;
}

/**
 * Ordre identique à la liste de ponte du jeu (et à `NOM_UNITE` de Toolzzz).
 * L'ordre compte : en combat, les unités les plus faibles meurent en premier
 * dans cet ordre.
 */
export const UNITES: readonly Unite[] = [
  { code: "ouvriere", nom: "Ouvrière", ponte: 60, cout: 5, vie: 0, att: 0, def: 0 },
  { code: "jsn", nom: "Jeune Soldate Naine", ponte: 300, cout: 16, vie: 8, att: 3, def: 2 },
  { code: "sn", nom: "Soldate Naine", ponte: 450, cout: 20, vie: 10, att: 5, def: 4 },
  { code: "ne", nom: "Naine d’Élite", ponte: 570, cout: 26, vie: 13, att: 7, def: 6 },
  { code: "js", nom: "Jeune Soldate", ponte: 740, cout: 30, vie: 16, att: 10, def: 9 },
  { code: "s", nom: "Soldate", ponte: 1000, cout: 36, vie: 20, att: 15, def: 14 },
  { code: "c", nom: "Concierge", ponte: 1410, cout: 70, vie: 30, att: 1, def: 25 },
  { code: "ce", nom: "Concierge d’élite", ponte: 1410, cout: 100, vie: 40, att: 1, def: 35 },
  { code: "a", nom: "Artilleuse", ponte: 1440, cout: 30, vie: 10, att: 30, def: 15 },
  { code: "ae", nom: "Artilleuse d’élite", ponte: 1520, cout: 34, vie: 12, att: 35, def: 18 },
  { code: "se", nom: "Soldate d’élite", ponte: 1450, cout: 44, vie: 27, att: 24, def: 23 },
  { code: "tk", nom: "Tank", ponte: 1860, cout: 100, vie: 35, att: 55, def: 1 },
  { code: "tke", nom: "Tank d’élite", ponte: 1860, cout: 150, vie: 50, att: 80, def: 1 },
  { code: "tu", nom: "Tueuse", ponte: 2740, cout: 80, vie: 50, att: 50, def: 50 },
  { code: "tue", nom: "Tueuse d’élite", ponte: 2740, cout: 90, vie: 55, att: 55, def: 55 },
];

export const SOURCE_UNITES: Source = {
  statut: "communaute",
  origine: "Toolzzz content.js (TEMPS_UNITE, COUT_UNITE, VIE/ATT/DEF_UNITE)",
};

/**
 * Unités présentes sur le s5 : les pages Armée et Attaquer n'y listent que 12
 * unités de combat (ni Concierge d'élite ni Tank d'élite).
 */
export const UNITES_S5: ReadonlySet<CodeUnite> = new Set<CodeUnite>([
  "ouvriere", "jsn", "sn", "ne", "js", "s", "c", "a", "ae", "se", "tk", "tu", "tue",
]);

export function unite(code: CodeUnite): Unite {
  const u = UNITES.find((x) => x.code === code);
  if (!u) throw new Error(`Unité inconnue : ${code}`);
  return u;
}

/** Effectifs d'une armée, par code d'unité (les codes absents valent 0). */
export type Effectifs = Partial<Record<CodeUnite, number>>;
