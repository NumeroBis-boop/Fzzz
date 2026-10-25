import type { Source } from "./statut.js";

export const SOURCE_FLOOD: Source = {
  statut: "officiel",
  origine: "Tutoriel : prise = 20 % du TDC cible, 1 cm² max par unité ; portée ½–3× vérifiée à l'arrivée",
  note:
    "Page Ennemies du s5 : pour 19 095 cm², « Terrain Max » = 57 284 = 3 × 19 095 − 1, d'où une borne haute stricte. " +
    "Arrondi de la prise (floor) : hypothèse reprise de Toolzzz, à vérifier sur RC.",
};

/**
 * Portée d'attaque : cible d'au moins la moitié et de moins du triple du TDC
 * de l'attaquant (bornes déduites de la page Ennemies, voir SOURCE_FLOOD).
 */
export function estAPortee(tdcAttaquant: number, tdcCible: number): boolean {
  return 2 * tdcCible >= tdcAttaquant && tdcCible < 3 * tdcAttaquant;
}

/** Terrain pris par une attaque victorieuse. */
export function prise(tdcCible: number, unites: number): number {
  return Math.min(Math.floor(tdcCible * 0.2), unites);
}

/**
 * Plus grande prise qui laisse la cible à portée de l'attaquant pour une
 * attaque suivante : après la prise L, il faut cible − L ≥ (att + L) / 2,
 * soit L ≤ (2·cible − att) / 3. `marge` retire quelques cm² par prudence
 * (Toolzzz retire 1).
 */
export function priseLimitePortee(tdcAttaquant: number, tdcCible: number, marge = 0): number {
  return Math.max(0, Math.floor((2 * tdcCible - tdcAttaquant) / 3) - marge);
}

export interface AttaqueSequence {
  /** Identifiant de l'attaquant (pseudo), pour les floods à plusieurs. */
  attaquant: string;
  unites: number;
}

export interface ResultatAttaque extends AttaqueSequence {
  /** `false` si la cible était hors de portée à l'arrivée : attaque annulée. */
  aPortee: boolean;
  prise: number;
  tdcAttaquantApres: number;
  tdcCibleApres: number;
}

/**
 * Simule une suite d'attaques arrivant sur une même cible, dans l'ordre
 * d'arrivée. Gère plusieurs attaquants (floods d'alliance) : chacun a son
 * propre TDC, et la portée est vérifiée à chaque arrivée.
 *
 * Hypothèses : toutes les attaques gagnent leur combat et rien d'autre ne
 * modifie les TDC pendant la séquence (chasses, autres attaques).
 */
export function simulerSequence(
  tdcCible: number,
  tdcAttaquants: Readonly<Record<string, number>>,
  attaques: readonly AttaqueSequence[],
): ResultatAttaque[] {
  const tdc: Record<string, number> = { ...tdcAttaquants };
  let cible = tdcCible;
  return attaques.map((a) => {
    const att = tdc[a.attaquant];
    if (att === undefined) throw new Error(`TDC inconnu pour ${a.attaquant}`);
    const aPortee = estAPortee(att, cible);
    const p = aPortee ? prise(cible, a.unites) : 0;
    cible -= p;
    tdc[a.attaquant] = att + p;
    return { ...a, aPortee, prise: p, tdcAttaquantApres: att + p, tdcCibleApres: cible };
  });
}

export interface ParametresFlood {
  tdcAttaquant: number;
  tdcCible: number;
  /** Unités disponibles ; chaque unité envoyée peut prendre au plus 1 cm². */
  unites: number;
  attaquesMax: number;
  /** Marge de sécurité de la prise limite (cm²). */
  marge?: number;
}

/**
 * Optiflood pour un attaquant seul : liste des tailles d'attaque qui
 * maximise le terrain pris.
 *
 * Chaque attaque prend le maximum possible (20 % ou unités restantes), sauf
 * si cela ferait sortir la cible de portée alors qu'il reste des attaques :
 * on prend alors la prise limite, puis une dernière attaque à 20 %. Le
 * caractère optimal de cette stratégie gloutonne est vérifié par recherche
 * exhaustive dans les tests.
 */
export function planifierFlood(p: ParametresFlood): number[] {
  const marge = p.marge ?? 0;
  const plan: number[] = [];
  let att = p.tdcAttaquant;
  let cible = p.tdcCible;
  let unites = p.unites;

  for (let i = 0; i < p.attaquesMax && unites > 0 && estAPortee(att, cible); i++) {
    const derniere = i === p.attaquesMax - 1;
    let taille = prise(cible, unites);
    if (!derniere) {
      const limite = priseLimitePortee(att, cible, marge);
      if (limite < taille) {
        // Cible déjà à la limite : on garde l'attaque restante pour la fin.
        if (limite > 0) {
          plan.push(limite);
          att += limite;
          cible -= limite;
          unites -= limite;
        }
        const finale = prise(cible, unites);
        if (finale > 0 && estAPortee(att, cible)) plan.push(finale);
        return plan;
      }
    }
    if (taille <= 0) break;
    plan.push(taille);
    att += taille;
    cible -= taille;
    unites -= taille;
  }
  return plan;
}
