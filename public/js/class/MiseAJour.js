// @ts-check
/*
 * MiseAJour.js
 * Version publiée du script utilisateur, lue sur son adresse de mise à jour.
 **********************************************************************/

// au plus une lecture par 24 h (règle du mainteneur, 18/11/2026), sur GitHub, jamais le jeu
const DELAI_VERIFICATION_MAJ = 24 * 3600000;
const CLE_VERIFICATION_MAJ = "fzzz_majVerification";
// Violentmonkey annule le chargement du .user.js dès la demande : passé ce délai,
// l'onglet ouvert pour lui est resté vide
const MS_ONGLET_VIDE = 3000;

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
   * Version publiée à `adresse`, lue au plus une fois par 24 h, sinon celle
   * lue la dernière fois ; null quand GitHub n'a pas répondu.
   *
   * @static
   * @method publiee
   * @param {String} adresse adresse de mise à jour du script installé
   * @return {Promise<String|null>}
   */
  static publiee(adresse) {
    let lu = Utils.lireStockage(CLE_VERIFICATION_MAJ),
      maintenant = Date.now(),
      noter = (/** @type {String|null} */ version) => {
        try {
          localStorage.setItem(
            CLE_VERIFICATION_MAJ,
            JSON.stringify({ t: maintenant, adresse, version }),
          );
        } catch (e) {
          /* stockage plein : nouvelle lecture au prochain chargement */
        }
        return version;
      };
    if (lu.adresse == adresse && lu.t <= maintenant && maintenant - lu.t < DELAI_VERIFICATION_MAJ)
      return Promise.resolve(lu.version || null);
    return fetch(adresse, { cache: "no-store" })
      .then((r) => (r.ok ? r.text() : ""))
      .then((texte) => noter(MiseAJour.versionPubliee(texte)))
      .catch(() => noter(null));
  }
  /**
   * Version publiée à `adresse` si elle est plus récente que `installee`.
   *
   * @static
   * @method verifier
   * @param {String} adresse adresse de mise à jour du script installé
   * @param {String} installee version installée
   * @return {Promise<String|null>}
   */
  static verifier(adresse, installee) {
    return MiseAJour.publiee(adresse).then((v) =>
      v && MiseAJour.comparer(v, installee) > 0 ? v : null,
    );
  }
  /**
   * Ouvre le script publié dans un nouvel onglet, au premier plan : le
   * gestionnaire de scripts propose de l'installer. Violentmonkey annule ce
   * chargement et ouvre sa page d'installation dans un autre onglet, au premier
   * plan puisque celui-ci l'est ; il ne remplace l'onglet de départ que pour une
   * page « nouvel onglet », pas about:blank (son confirmInstall) : l'onglet
   * resté vide est fermé (Firefox Android, 22/11/2026).
   *
   * @static
   * @method ouvrir
   * @param {String} adresse adresse du .user.js
   * @param {Boolean} violentmonkey script installé avec Violentmonkey
   * @return {Boolean} false si le navigateur a refusé d'ouvrir l'onglet
   */
  static ouvrir(adresse, violentmonkey) {
    let onglet = window.open(adresse, "_blank");
    if (!onglet) return false;
    try {
      onglet.opener = null;
    } catch (e) {
      /* sans effet sur l'ouverture */
    }
    if (violentmonkey)
      setTimeout(() => {
        try {
          if (!onglet.closed && onglet.location.href == "about:blank") onglet.close();
        } catch (e) {
          // page d'une autre origine (script ou gestionnaire) : gardée
        }
      }, MS_ONGLET_VIDE);
    return true;
  }
}
