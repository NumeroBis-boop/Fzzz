import { unite, type CodeUnite } from "../data/unites.js";
import { codeUnite, entier } from "./commun.js";

/**
 * Boîte Compte+ (`#boiteComptePlus`), présente sur toutes les pages pour un
 * joueur qui a le Compte+. Elle résume ponte, chasses, attaques et convois.
 * Pour les chasses, elle donne :
 *   - `resteTemps(12839,"temps_chasse")` : secondes restantes de la chasse
 *     qui se termine en premier ;
 *   - une infobulle avec, par chasse, la surface et l'heure de fin à la minute.
 */

export interface ChasseBoite {
  surface: number;
  /** Heure de fin affichée (« 03h57 »). */
  finAffichee: string;
}

export interface ChassesBoite {
  nombre: number;
  /** Secondes restantes de la première chasse à se terminer. */
  restePremiere: number | null;
  chasses: ChasseBoite[];
}

export function lireChassesBoite(doc: ParentNode): ChassesBoite | null {
  const ligne = doc.querySelector("#ligne_chasse");
  if (!ligne) return null;
  const nombre = entier(ligne.querySelector("strong")?.textContent) ?? 0;
  const scripts = Array.from(ligne.querySelectorAll("script"), (s) => s.textContent ?? "").join("\n");
  const reste = /resteTemps\(\s*(\d+)\s*,\s*["']temps_chasse["']\s*\)/.exec(scripts);
  const chasses: ChasseBoite[] = [];
  for (const m of scripts.matchAll(/<strong>([\d\s ]+)<\/strong>\s*cm².*?(\d{1,2}h\d{2})/g)) {
    const surface = entier(m[1]);
    if (surface !== null && m[2]) chasses.push({ surface, finAffichee: m[2] });
  }
  return { nombre, restePremiere: reste ? Number(reste[1]) : null, chasses };
}

export interface PonteBoite {
  /** Unités en file, dans l'ordre (seules celles listées dans l'infobulle). */
  file: { nombre: number; unite: CodeUnite }[];
  /** Secondes restantes avant la fin de la file. */
  reste: number | null;
}

export function lirePonteBoite(doc: ParentNode): PonteBoite | null {
  const ligne = doc.querySelector("#ligne_ponte");
  if (!ligne) return null;
  const scripts = Array.from(ligne.querySelectorAll("script"), (s) => s.textContent ?? "").join("\n");
  const reste = /resteTemps\(\s*(\d+)\s*,\s*["']temps_ponte["']\s*\)/.exec(scripts);
  const file: PonteBoite["file"] = [];
  for (const m of scripts.matchAll(/<strong>([\d\s ]+)<\/strong><\/td><td[^>]*>([^<]+)<\/td>/g)) {
    const nombre = entier(m[1]);
    const code = codeUnite(m[2]!);
    if (nombre !== null && code) file.push({ nombre, unite: code });
  }
  return { file, reste: reste ? Number(reste[1]) : null };
}

/**
 * Déduit la somme des bonus de ponte (Couveuse + Solarium + Technique de
 * ponte) du rythme de la file : reste ≈ Σ nombre × temps de base × 0,9^n.
 * Le résultat n'est fiable que si la file est assez longue pour que l'unité
 * en cours, déjà entamée, pèse peu (> 100 unités par exemple).
 */
export function estimerNiveauxPonte(ponte: PonteBoite): number | null {
  if (ponte.reste === null || ponte.file.length === 0) return null;
  const base = ponte.file.reduce((t, f) => t + f.nombre * unite(f.unite).ponte, 0);
  if (base <= 0 || ponte.reste <= 0) return null;
  return Math.round(Math.log(ponte.reste / base) / Math.log(0.9));
}
