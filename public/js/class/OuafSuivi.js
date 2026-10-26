// @ts-check
/*
 * OuafSuivi.js
 * Suivi des convois de la OUAF (site de l'alliance).
 **********************************************************************/

// site de suivi des convois de l'alliance
const OUAF_SITE = "http://ouafchaine.fr/";
// code de connexion, dans le stockage de l'extension (illisible par le jeu)
const CLE_OUAF_CODE = "fzzz_ouafCode";

/**
 * Code de connexion au site de suivi des convois. Il est rangé dans
 * chrome.storage.local, propre à l'extension : la page du jeu (et son
 * localStorage) n'y a pas accès.
 *
 * @class OuafSuivi
 */
class OuafSuivi {
  /**
   * @static
   * @method lireCode
   * @return {Promise<String>} code enregistré, ou ""
   */
  static lireCode() {
    try {
      return chrome.storage.local
        .get(CLE_OUAF_CODE)
        .then((r) => r[CLE_OUAF_CODE] || "")
        .catch(() => "");
    } catch (e) {
      return Promise.resolve("");
    }
  }
  /**
   * @static
   * @method enregistrerCode
   * @param {String} code "" pour effacer
   * @return {Promise}
   */
  static enregistrerCode(code) {
    try {
      return code
        ? chrome.storage.local.set({ [CLE_OUAF_CODE]: code })
        : chrome.storage.local.remove(CLE_OUAF_CODE);
    } catch (e) {
      return Promise.resolve();
    }
  }
}
