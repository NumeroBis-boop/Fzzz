import { entier } from "./commun.js";

/**
 * Boîte Compte+ (`#boiteComptePlus`), présente sur toutes les pages pour un
 * joueur qui a le Compte+. Elle résume ponte, chasses, attaques et convois.
 * Pour les chasses, elle donne :
 *   - `resteTemps(12839,"temps_chasse")` : secondes restantes de la chasse
 *     qui se termine en premier ;
 *   - une infobulle avec, par chasse, la surface et l'heure de fin à la minute.
 */

export interface ChasseEnCours {
  surface: number;
  /** Heure de fin affichée (« 03h57 »). */
  finAffichee: string;
}

export interface ChassesBoite {
  nombre: number;
  /** Secondes restantes de la première chasse à se terminer. */
  restePremiere: number | null;
  chasses: ChasseEnCours[];
}

export function lireChassesBoite(doc: ParentNode): ChassesBoite | null {
  const ligne = doc.querySelector("#ligne_chasse");
  if (!ligne) return null;
  const nombre = entier(ligne.querySelector("strong")?.textContent) ?? 0;
  const scripts = Array.from(ligne.querySelectorAll("script"), (s) => s.textContent ?? "").join("\n");
  const reste = /resteTemps\(\s*(\d+)\s*,\s*["']temps_chasse["']\s*\)/.exec(scripts);
  const chasses: ChasseEnCours[] = [];
  for (const m of scripts.matchAll(/<strong>([\d\s ]+)<\/strong>\s*cm².*?(\d{1,2}h\d{2})/g)) {
    const surface = entier(m[1]);
    if (surface !== null && m[2]) chasses.push({ surface, finAffichee: m[2] });
  }
  return { nombre, restePremiere: reste ? Number(reste[1]) : null, chasses };
}
