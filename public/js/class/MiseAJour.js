// @ts-check
/*
 * MiseAJour.js
 * Version publiée du script utilisateur, lue sur son adresse de mise à jour.
 **********************************************************************/

// au plus une lecture par heure (adresse sur GitHub, jamais le jeu)
const DELAI_VERIFICATION_MAJ = 3600000;
const CLE_VERIFICATION_MAJ = "fzzz_majVerification";

/**
 * Violentmonkey et Tampermonkey ne cherchent les mises à jour qu'environ une
 * fois par jour : l'encadré « Extension OUAF » signale plus tôt une version
 * publiée plus récente.
 *
 * @class MiseAJour
 */
class MiseAJour {
  /**
   * @static
   * @method versionPubliee
   * @param {String} script texte d'un .user.js
   * @return {String|null} sa ligne @version
   */
  static versionPubliee(script) {
    let m = /^\/\/\s*@version\s+(\S+)/m.exec(String(script || ""));
    return m ? m[1] : null;
  }
  /**
   * Ordre de deux versions, toutes leurs parties comprises (TEST : 1.85.1.202611061519).
   *
   * @static
   * @method comparer
   * @param {String} a
   * @param {String} b
   * @return {Number} > 0 si a est plus récente que b
   */
  static comparer(a, b) {
    let x = String(a).split(".").map(Number),
      y = String(b).split(".").map(Number);
    for (let i = 0; i < Math.max(x.length, y.length); i++)
      if ((x[i] || 0) != (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
    return 0;
  }
  /**
   * Version publiée à `adresse` si elle est plus récente que `installee` : lue
   * au plus une fois par heure, sinon celle lue la dernière fois.
   *
   * @static
   * @method verifier
   * @param {String} adresse adresse de mise à jour du script installé
   * @param {String} installee version installée
   * @return {Promise<String|null>}
   */
  static verifier(adresse, installee) {
    let lu = Utils.lireStockage(CLE_VERIFICATION_MAJ),
      maintenant = Date.now(),
      plusRecente = (/** @type {String|null} */ v) =>
        v && MiseAJour.comparer(v, installee) > 0 ? v : null,
      noter = (/** @type {String|null} */ version) => {
        try {
          localStorage.setItem(
            CLE_VERIFICATION_MAJ,
            JSON.stringify({ t: maintenant, adresse, version }),
          );
        } catch (e) {
          /* stockage plein : nouvelle lecture au prochain chargement */
        }
        return plusRecente(version);
      };
    if (lu.adresse == adresse && lu.t <= maintenant && maintenant - lu.t < DELAI_VERIFICATION_MAJ)
      return Promise.resolve(plusRecente(lu.version));
    return fetch(adresse, { cache: "no-store" })
      .then((r) => (r.ok ? r.text() : ""))
      .then((texte) => noter(MiseAJour.versionPubliee(texte)))
      .catch(() => noter(null));
  }
}
