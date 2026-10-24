import type { Effectifs } from "../data/unites.js";
import type { Lieu } from "../armee.js";
import { ABREVIATIONS_S5, entier } from "./commun.js";

export interface PageArmee {
  niveauBouclier: number | null;
  niveauArmes: number | null;
  niveauDome: number | null;
  niveauLoge: number | null;
  troupes: Record<Lieu, Effectifs>;
}

const LIEUX: Lieu[] = ["terrain", "dome", "loge"];

function niveau(texte: string | null | undefined, motif: RegExp): number | null {
  const m = motif.exec(texte ?? "");
  return m ? Number(m[1]) : null;
}

/**
 * Lit la page Armee.php. Le tableau « Troupes en Garnison » a une colonne
 * de nom puis, pour chaque lieu, trois colonnes (flèche, nombre, flèche),
 * ou une seule cellule `colspan=3` vide quand il n'y a rien.
 */
export function lirePageArmee(doc: ParentNode): PageArmee {
  const troupes: Record<Lieu, Effectifs> = { terrain: {}, dome: {}, loge: {} };
  for (const tr of Array.from(doc.querySelectorAll("tr"))) {
    const abrev = tr.querySelector("td .que_sur_telephone")?.textContent?.trim();
    const code = abrev ? ABREVIATIONS_S5[abrev] : undefined;
    if (!code) continue;
    const cellules = Array.from(tr.children).slice(1) as HTMLTableCellElement[];
    let colonne = 0;
    for (const td of cellules) {
      const n = entier(td.querySelector("span.cliquable")?.textContent);
      const lieu = LIEUX[Math.floor(colonne / 3)];
      if (n !== null && lieu) troupes[lieu][code] = n;
      colonne += Number(td.getAttribute("colspan") ?? 1);
    }
  }
  const html = (sel: string) => doc.querySelector(sel)?.textContent;
  return {
    niveauBouclier: niveau(html("#detailVieLegende"), /Bouclier\s*\((\d+)\)/),
    niveauArmes: niveau(html("#detailAttaqueLegende"), /Arme\s*\((\d+)\)/),
    niveauDome: niveau(doc.querySelector('span[title^="Dôme"]')?.getAttribute("title"), /niveau\s*(\d+)/),
    niveauLoge: niveau(doc.querySelector('span[title^="Loge"]')?.getAttribute("title"), /niveau\s*(\d+)/),
    troupes,
  };
}
