/**
 * Estimation du décalage entre l'horloge locale et celle du serveur, à partir
 * de l'en-tête HTTP `Date` des pages que le joueur charge lui-même (aucune
 * requête supplémentaire, donc rien qui prolonge la session).
 *
 * `Date` est tronqué à la seconde. Pour une réponse demandée à l'instant
 * local `envoi` et reçue à `reception`, l'heure serveur au moment où l'en-tête
 * a été produit est dans [D, D + 1 s[, et ce moment est dans [envoi, reception]
 * en heure locale. Le décalage (serveur − local) est donc dans :
 *
 *   [D − reception, D + 1000 − envoi]
 *
 * L'intersection des intervalles de plusieurs pages resserre l'estimation,
 * souvent sous la demi-seconde après quelques chargements.
 */

export interface EchantillonHorloge {
  /** Valeur de l'en-tête `Date`, en ms depuis l'époque (multiple de 1000). */
  dateServeur: number;
  /** Heure locale (ms) au départ de la requête. */
  envoi: number;
  /** Heure locale (ms) à la réception des en-têtes. */
  reception: number;
}

export interface Intervalle {
  min: number;
  max: number;
}

export function intervalleEchantillon(e: EchantillonHorloge): Intervalle {
  return { min: e.dateServeur - e.reception, max: e.dateServeur + 1000 - e.envoi };
}

export interface EstimationDecalage {
  /** Décalage retenu (milieu de l'intervalle), en ms : heureServeur = heureLocale + decalage. */
  decalage: number;
  /** Demi-largeur de l'intervalle, en ms. */
  incertitude: number;
  /** Échantillons effectivement retenus. */
  retenus: number;
}

/**
 * Combine les échantillons. Si les intervalles ne se recoupent pas (horloge
 * locale réajustée, mise en veille…), on repart des plus récents : les
 * échantillons sont supposés triés du plus ancien au plus récent.
 */
export function estimerDecalage(echantillons: readonly EchantillonHorloge[]): EstimationDecalage | null {
  let courant: Intervalle | null = null;
  let retenus = 0;
  for (let i = echantillons.length - 1; i >= 0; i--) {
    const e = echantillons[i];
    if (!e) continue;
    const iv = intervalleEchantillon(e);
    if (courant === null) {
      courant = iv;
      retenus = 1;
      continue;
    }
    const min = Math.max(courant.min, iv.min);
    const max = Math.min(courant.max, iv.max);
    if (min > max) break;
    courant = { min, max };
    retenus++;
  }
  if (courant === null) return null;
  return {
    decalage: (courant.min + courant.max) / 2,
    incertitude: (courant.max - courant.min) / 2,
    retenus,
  };
}
