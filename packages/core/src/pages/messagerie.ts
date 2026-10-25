import { entier } from "./commun.js";

/**
 * Messages d'une conversation « Vol par X » (messagerie.php, chargée au clic) :
 *   <td class="expe"><span><span>25/10/26 à 01h00</span></span></td>
 *   <div class="contenuJoueur"><a>Canaille</a> vous a pris 5 967 cm² lors de sa dernière attaque.</div>
 */
export interface VolSubi {
  attaquant: string;
  surface: number;
  /** Date affichée (« 25/10/26 à 01h00 »), à la minute. */
  date: string | null;
}

export function lireVolsSubis(racine: ParentNode): VolSubi[] {
  return Array.from(racine.querySelectorAll("tr[id^='message_']")).flatMap((tr) => {
    const texte = tr.querySelector(".contenuJoueur")?.textContent ?? "";
    const m = /^\s*(.+?)\s+vous a pris\s+([\d\s ]+)\s*cm²/.exec(texte);
    const surface = m ? entier(m[2]) : null;
    if (!m || surface === null) return [];
    return [{ attaquant: m[1]!, surface, date: tr.querySelector(".expe")?.textContent?.trim() ?? null }];
  });
}
