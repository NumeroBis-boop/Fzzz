import { CONSTRUCTIONS, RECHERCHES, type CleConstruction, type CleRecherche, type Cout } from "../data/couts.js";
import { entier } from "./commun.js";

/**
 * Lignes du Laboratoire (laboratoire.php) et de la Construction (construction.php), s5 :
 *
 *   <tr class="ligneAmelioration"> … <td class="desciption_amelioration"><h2>Armes</h2>
 *   <span class="niveau_amelioration">niveau 9</span> … <td class="cout_amelioration">
 *   <div class="temps">2H 6m 3s</div> <div class="ouvriere">40 960</div>
 *   <div class="nourriture">153 600</div> <div class="materiaux">102 400</div>
 *
 * Le coût et le temps affichés sont ceux du niveau suivant. Les recherches sont
 * identifiées par leur titre : l'ordre des lignes du s5 n'est pas celui des
 * identifiants du jeu (Architecture vient avant Communication).
 */

export interface LigneAmelioration<K extends string> {
  cle: K;
  niveau: number;
  /** Coût du niveau suivant. */
  cout: Cout;
  /** Durée du niveau suivant, en secondes (bonus de Salle d'analyse inclus). */
  temps: number | null;
  /** Ligne du tableau, pour y accrocher un affichage. */
  ligne: Element;
}

/** Titre sans accents ni casse : la page Construction écrit « Etable », les données « Étable ». */
const normaliser = (nom: string) => nom.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function index<K extends string>(table: Record<K, { nom: string }>): Map<string, K> {
  return new Map((Object.entries(table) as [K, { nom: string }][]).map(([cle, r]) => [normaliser(r.nom), cle]));
}

const RECHERCHES_PAR_NOM = index<CleRecherche>(RECHERCHES);
const CONSTRUCTIONS_PAR_NOM = index<CleConstruction>(CONSTRUCTIONS);

/** « 2H 6m 3s », « 3m 4s », « 1J 2H » → secondes. */
export function lireDuree(texte: string): number | null {
  let total = 0;
  let trouve = false;
  for (const m of texte.matchAll(/(\d+)\s*([JHms])/g)) {
    trouve = true;
    total += Number(m[1]) * { J: 86400, H: 3600, m: 60, s: 1 }[m[2] as "J" | "H" | "m" | "s"];
  }
  return trouve ? total : null;
}

export type LigneLaboratoire = LigneAmelioration<CleRecherche>;
export type LigneConstruction = LigneAmelioration<CleConstruction>;

/** Même structure de page pour Laboratoire et Construction (`tr.ligneAmelioration`). */
function lireAmeliorations<K extends string>(doc: ParentNode, parNom: Map<string, K>): LigneAmelioration<K>[] {
  return Array.from(doc.querySelectorAll(".ligneAmelioration")).flatMap((ligne) => {
    const cle = parNom.get(normaliser(ligne.querySelector("h2")?.textContent ?? ""));
    const niveau = /niveau\s+(\d+)/i.exec(ligne.querySelector(".niveau_amelioration")?.textContent ?? "")?.[1];
    if (!cle || niveau === undefined) return [];
    const val = (sel: string) => entier(ligne.querySelector(`.cout_amelioration .${sel}`)?.textContent?.trim()) ?? 0;
    return [
      {
        cle,
        niveau: Number(niveau),
        cout: { ouvrieres: val("ouvriere"), nourriture: val("nourriture"), materiaux: val("materiaux") },
        temps: lireDuree(ligne.querySelector(".cout_amelioration .temps")?.textContent ?? ""),
        ligne,
      },
    ];
  });
}

export function lireLaboratoire(doc: ParentNode): LigneLaboratoire[] {
  return lireAmeliorations(doc, RECHERCHES_PAR_NOM);
}

export function lireConstructions(doc: ParentNode): LigneConstruction[] {
  return lireAmeliorations(doc, CONSTRUCTIONS_PAR_NOM);
}

export function lireNiveauxRecherche(doc: ParentNode): Partial<Record<CleRecherche, number>> {
  const res: Partial<Record<CleRecherche, number>> = {};
  for (const l of lireLaboratoire(doc)) res[l.cle] = l.niveau;
  return res;
}

/** Niveau de Salle d'analyse déduit des temps affichés (médiane des lignes). */
export function estimerSalleAnalyse(lignes: LigneLaboratoire[]): number | null {
  const estimations = lignes
    .filter((l) => l.temps && l.temps > 600)
    .map((l) => {
      const r = RECHERCHES[l.cle];
      return Math.log(l.temps! / (r.t * 1.7 ** l.niveau)) / Math.log(0.9);
    })
    .sort((a, b) => a - b);
  if (estimations.length === 0) return null;
  return Math.round(estimations[Math.floor(estimations.length / 2)]!);
}
