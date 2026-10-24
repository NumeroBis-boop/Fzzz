import { entier } from "./commun.js";

/** Une ligne du tableau `#tabEnnemie` (ennemie.php). */
export interface LigneEnnemie {
  alliance: string;
  pseudo: string;
  terrain: number;
  /** Distance affichée, arrondie par le jeu. */
  distance: number;
  etat: string;
  ligne: HTMLTableRowElement;
}

/** Colonnes : alliance, pseudo, icône, terrain, attaquer, distance, état. */
export function lireTableauEnnemie(doc: ParentNode): LigneEnnemie[] {
  const res: LigneEnnemie[] = [];
  for (const tr of Array.from(doc.querySelectorAll<HTMLTableRowElement>("#tabEnnemie tr"))) {
    const td = tr.querySelectorAll("td");
    if (td.length < 7) continue;
    const terrain = entier(td[3]?.textContent);
    const distance = entier(td[5]?.textContent);
    if (terrain === null || distance === null) continue;
    res.push({
      alliance: td[0]?.textContent?.trim() ?? "",
      pseudo: td[1]?.textContent?.trim() ?? "",
      terrain,
      distance,
      etat: td[6]?.textContent?.trim() ?? "",
      ligne: tr,
    });
  }
  return res;
}
