import { UNITES, UNITES_PONDABLES, unite, type CodeUnite, type Effectifs } from "./data/unites.js";
import { coutConstruction, coutRecherche, tempsRecherche, type Cout } from "./data/couts.js";

/**
 * Rentabilité d'un niveau d'Armes, de Bouclier ou d'Étable à pucerons.
 *
 * Critère (fiche 03, validé par le joueur) : les ouvrières sacrifiées
 * viennent du stock des convois et ne récoltaient rien. Leur vrai coût est
 * donc le **temps de ponte** qu'il a fallu pour les pondre, temps qui aurait
 * pu servir à pondre des unités de combat. On compare le gain du niveau au
 * gain de ces unités pondues à la place.
 *
 * Hypothèse : une seule file de ponte (ouvrières et unités se partagent la reine).
 */

export interface ContexteRentabilite {
  effectifs: Effectifs;
  niveauArmes: number;
  niveauBouclier: number;
  /** Couveuse + Solarium + Technique de ponte : chaque niveau réduit la ponte de 10 %. */
  niveauxPonte: number;
}

export function tempsPonte(code: CodeUnite, nombre: number, niveauxPonte: number): number {
  return nombre * unite(code).ponte * 0.9 ** niveauxPonte;
}

export interface Alternative {
  unite: CodeUnite;
  /** Unités pondables pendant le temps de ponte des ouvrières sacrifiées. */
  nombre: number;
  gain: number;
  nourriture: number;
}

export interface Rentabilite {
  niveauVise: number;
  cout: Cout;
  /** Temps (s) de ponte des ouvrières sacrifiées. */
  tempsPonteOuvrieres: number;
  tempsRecherche: number;
  /** Gain du niveau, en points (vie pour Bouclier, attaque ou défense pour Armes). */
  gainNiveau: number;
  /** Meilleure alternative de ponte pour la même caractéristique. */
  alternatives: Alternative[];
  /** Vrai si le niveau rapporte plus que la meilleure alternative. */
  rentable: boolean;
}

type Carac = "vie" | "att" | "def";

function base(effectifs: Effectifs, champ: Carac): number {
  let t = 0;
  for (const u of UNITES) t += (effectifs[u.code] ?? 0) * u[champ];
  return t;
}

function evaluer(
  cle: "armes" | "bouclier",
  champ: Carac,
  ctx: ContexteRentabilite,
  salleAnalyse: number,
): Rentabilite {
  const niveauActuel = cle === "armes" ? ctx.niveauArmes : ctx.niveauBouclier;
  // Le bonus d'une unité pondue dépend du niveau dans SA caractéristique.
  const niveauCarac = champ === "vie" ? ctx.niveauBouclier : ctx.niveauArmes;
  const niveauVise = niveauActuel + 1;
  const cout = coutRecherche(cle, niveauVise);
  const tOuv = tempsPonte("ouvriere", cout.ouvrieres, ctx.niveauxPonte);
  const gainNiveau = base(ctx.effectifs, champ) * 0.1;

  const alternatives = UNITES.filter((u) => UNITES_PONDABLES.has(u.code) && u.code !== "ouvriere" && u[champ] > 0)
    .map((u): Alternative => {
      const nombre = Math.floor(tOuv / (u.ponte * 0.9 ** ctx.niveauxPonte));
      return {
        unite: u.code,
        nombre,
        gain: nombre * u[champ] * (1 + 0.1 * niveauCarac),
        nourriture: nombre * u.cout,
      };
    })
    .sort((a, b) => b.gain - a.gain);

  return {
    niveauVise,
    cout,
    tempsPonteOuvrieres: tOuv,
    tempsRecherche: tempsRecherche(cle, niveauVise, salleAnalyse),
    gainNiveau,
    alternatives,
    rentable: gainNiveau > (alternatives[0]?.gain ?? 0),
  };
}

export function rentabiliteBouclier(ctx: ContexteRentabilite, salleAnalyse = 0): Rentabilite {
  return evaluer("bouclier", "vie", ctx, salleAnalyse);
}

export function rentabiliteArmes(
  ctx: ContexteRentabilite,
  salleAnalyse = 0,
): { attaque: Rentabilite; defense: Rentabilite } {
  return { attaque: evaluer("armes", "att", ctx, salleAnalyse), defense: evaluer("armes", "def", ctx, salleAnalyse) };
}

/**
 * Étable à pucerons : le niveau n exige Communication avec les animaux au
 * niveau n + 2 (règle donnée par le joueur, s5).
 */
export function communicationRequise(niveauEtable: number): number {
  return niveauEtable + 2;
}

export interface CoutPuceron {
  niveauVise: number;
  /** Niveaux de Communication à rechercher d'abord (vide s'il n'en manque pas). */
  niveauxCommunication: number[];
  cout: Cout;
  tempsPonteOuvrieres: number;
}

export function coutNiveauPuceron(
  niveauEtable: number,
  niveauCommunication: number,
  niveauxPonte: number,
): CoutPuceron {
  const niveauVise = niveauEtable + 1;
  const total: Cout = { ...coutConstruction("etablePucerons", niveauVise) };
  const niveauxCommunication: number[] = [];
  for (let n = niveauCommunication + 1; n <= communicationRequise(niveauVise); n++) {
    niveauxCommunication.push(n);
    const c = coutRecherche("communication", n);
    total.nourriture += c.nourriture;
    total.materiaux += c.materiaux;
    total.ouvrieres += c.ouvrieres;
  }
  return {
    niveauVise,
    niveauxCommunication,
    cout: total,
    tempsPonteOuvrieres: tempsPonte("ouvriere", total.ouvrieres, niveauxPonte),
  };
}

/**
 * Gain journalier d'un niveau d'étable, à partir de ce qui est pillé et
 * prélevé aujourd'hui : pillage = 30 % + 1 %/niveau, colonie = 20 % + 1 %/niveau
 * (tutoriel). Suppose que la limite « 1 ressource par point d'attaque
 * survivant » ne bride pas le pillage.
 */
export function gainJournalierPuceron(
  niveauEtable: number,
  pillageJournalier: number,
  prelevementColonieJournalier: number,
): number {
  return pillageJournalier / (30 + niveauEtable) + prelevementColonieJournalier / (20 + niveauEtable);
}
