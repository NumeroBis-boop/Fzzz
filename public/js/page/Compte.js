/*
 * Compte.js
 **********************************************************************/

/**
 * Hook sur /compte.php pour capter / configurer les préférences du
 * « menu rapide » (checkboxes `menuRapide*`).
 *
 * - C+ : on capte le formulaire natif et on en sauvegarde un snapshot
 *   en localStorage à chaque submit. Le natif continue à sauver côté
 *   serveur en parallèle.
 * - non-C+ : le formulaire natif n'est pas rendu côté serveur. On en
 *   injecte une copie (sections Fourmilière / Alliance / Communauté)
 *   avec ses propres handlers, en lecture/écriture sur localStorage.
 *
 * @class PageCompte
 * @constructor
 */
class PageCompte {
  constructor(boiteComptePlus) {
    this._boiteComptePlus = boiteComptePlus;
  }
  /**
   * @method executer
   */
  executer() {
    if (Utils.comptePlus) this._hookNatif();
    else this._injecterFormulaire();
    return this;
  }
  /**
   * Pré-coche les checkboxes natives selon les prefs sauvegardées et
   * snapshot l'état à la soumission.
   *
   * @private
   * @method _hookNatif
   */
  _hookNatif() {
    let prefs = this._lirePrefs();
    if (Object.keys(prefs).length) {
      MENU_RAPIDE.forEach((item) => {
        if (prefs[item.name] !== undefined) {
          $("#" + item.name).prop("checked", prefs[item.name]);
        }
      });
    }
    $("input[name='submitMenuRapide']")
      .closest("form")
      .on("submit", () => this._sauverPrefs());
  }
  /**
   * Injecte un formulaire « menu rapide » Toolzzz pour les non-C+ qui
   * n'ont pas le natif. Persistance en localStorage uniquement.
   *
   * @private
   * @method _injecterFormulaire
   */
  _injecterFormulaire() {
    if ($("#o_menuRapideForm").length) return;
    let prefs = this._lirePrefs();
    let sections = {};
    MENU_RAPIDE.forEach((item) => {
      (sections[item.section] = sections[item.section] || []).push(item);
    });
    let cols = Object.entries(sections)
      .map(([nom, items]) => {
        let cases = items
          .map(
            (item) =>
              `<label style='display:block;'><input type='checkbox' id='${item.name}' ${prefs[item.name] ? "checked" : ""}/> ${item.label}</label>`,
          )
          .join("");
        return `<td style='vertical-align:top;padding:0 12px;'><b>${nom}</b><br/>${cases}</td>`;
      })
      .join("");
    let html = `
      <br/>
      <div id='o_menuRapideForm' class='boite_amelioration simulateur centre'>
        <h2>Menu rapide</h2>
        <p class='reduce'>Choisis les raccourcis qui s'afficheront en bas de la boîte Fzzz. Préférences sauvegardées localement (localStorage), partagées avec ton compte si tu repasses Compte+ un jour.</p>
        <table style='margin:0 auto;'><tr>${cols}</tr></table>
        <button type='button' id='o_menuRapideValider' class='o_button f_success o_marginT15'>Valider</button>
        <span id='o_menuRapideStatus' class='reduce' style='margin-left:12px;'></span>
      </div>`;
    let cible = $("#cadre, #centre").last();
    if (cible.length) cible.append(html);
    else $("body").append(html);
    $("#o_menuRapideValider").click(() => {
      this._sauverPrefs();
      if (this._boiteComptePlus) this._boiteComptePlus.majRaccourcisMenuRapide();
      $("#o_menuRapideStatus").text("Préférences sauvegardées.");
      setTimeout(() => $("#o_menuRapideStatus").text(""), 2500);
    });
  }
  /**
   * @private
   * @method _lirePrefs
   * @returns {Object}
   */
  _lirePrefs() {
    try {
      return JSON.parse(localStorage.getItem(MENU_RAPIDE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }
  /**
   * @private
   * @method _sauverPrefs
   */
  _sauverPrefs() {
    let snapshot = {};
    MENU_RAPIDE.forEach((item) => {
      snapshot[item.name] = $("#" + item.name).is(":checked");
    });
    try {
      localStorage.setItem(MENU_RAPIDE_KEY, JSON.stringify(snapshot));
    } catch (e) {}
  }
}
