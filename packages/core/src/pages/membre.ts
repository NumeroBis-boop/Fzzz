import type { Coordonnees } from "../trajet.js";
import { lireDuree } from "./laboratoire.js";

/**
 * Profil d'un joueur (Membre.php?Pseudo=…) :
 *   <h2>Pseudo</h2> … Localisation : <a href="carte.php?x=9&y=36">x=9 et y=36</a>
 *   Distance : 92   Temps de trajet : 19H 33m 56s
 * Distance et temps sont donnés depuis la fourmilière du joueur qui regarde.
 */
export interface PageMembre extends Coordonnees {
  pseudo: string;
  alliance: string | null;
  distance: number | null;
  /** Temps de trajet affiché par le jeu, en secondes. */
  trajet: number | null;
}

export function lirePageMembre(doc: ParentNode): PageMembre | null {
  const pseudo = doc.querySelector("#centre center > h2, center > h2")?.textContent?.trim();
  const lien = doc.querySelector('a[href^="carte.php?x="]');
  const m = /x=(-?\d+)\D+y=(-?\d+)/.exec(lien?.getAttribute("href") ?? "");
  if (!pseudo || !m) return null;
  const valeur = (libelle: string) =>
    Array.from(doc.querySelectorAll(".boite_membre tr"))
      .find((tr) => tr.firstElementChild?.textContent?.includes(libelle))
      ?.lastElementChild?.textContent?.trim() ?? null;
  const distance = valeur("Distance");
  return {
    pseudo,
    x: Number(m[1]),
    y: Number(m[2]),
    alliance: doc.querySelector('.boite_membre a[href^="classementAlliance.php"]')?.textContent?.trim() ?? null,
    distance: distance === null ? null : Number(distance.replace(/\s/g, "")),
    trajet: lireDuree(valeur("Temps de trajet") ?? ""),
  };
}
