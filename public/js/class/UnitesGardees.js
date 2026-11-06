/*
 * UnitesGardees.js
 * Unités gardées au flood, modifiables pour l'attaque en cours.
 **********************************************************************/

/**
 * Bloc « Unités gardées pour cette attaque » du lanceur de flood et du
 * multi-flood : il part des préférences (onglet Attaque), qui restent les
 * valeurs par défaut ; une modification ici ne vaut que pour cette attaque.
 *
 * @class UnitesGardees
 */
class UnitesGardees {
  /**
   * @param {String} id identifiant du bloc dans la page
   * @param {Function} auChangement appelé après chaque modification
   * @param {String} [titre]
   */
  constructor(id, auChangement, titre = "Unités gardées pour cette attaque") {
    this._id = id;
    this._auChangement = auChangement;
    this._titre = titre;
    this._reglage = Armee.gardeesParDefaut();
  }
  /**
   * Réglage de l'attaque, à passer à Armee.gardees (modifié sur place).
   *
   * @return {{antisondes: Boolean, plus: Number, plusType: Number}}
   */
  get reglage() {
    return this._reglage;
  }
  /**
   * @method html
   * @return {String}
   */
  html() {
    let r = this._reglage,
      unites = ["Dernières unités de l'armée", ...NOM_UNITE.slice(1)]
        .map(
          (nom, i) => `<option value="${i}" ${i == r.plusType ? "selected" : ""}>${nom}</option>`,
        )
        .join("");
    return `<div id="${this._id}" class="o_gardees reduce">
        <span class="gras">${this._titre} :</span>
        <label><input type="checkbox" class="o_gardeesAntisondes" ${r.antisondes ? "checked" : ""}/> les antisondes <span class="o_gardeesNbAntisondes"></span></label>
        <span>+ <input class="o_gardeesPlus" value="${r.plus}" size="8"/> <select class="o_gardeesUnite">${unites}</select></span>
        <span>= <span class="o_gardeesTexte"></span></span>
        <a href="#" class="o_gardeesDefaut">par défaut : Préférences</a>
      </div>`;
  }
  /**
   * Branche les champs, une fois le bloc dans la page.
   *
   * @method brancher
   */
  brancher() {
    let $bloc = $("#" + this._id),
      changer = (modif) => {
        Object.assign(this._reglage, modif);
        this._auChangement();
      };
    $bloc
      .find(".o_gardeesAntisondes")
      .on("change", (e) => changer({ antisondes: e.currentTarget.checked }));
    $bloc
      .find(".o_gardeesPlus")
      .spinner({ min: 0, numberFormat: "i" })
      .on("input spinstop spinchange", (e) => {
        let plus = Math.max(0, parseInt($(e.currentTarget).spinner("value")) || 0);
        if (plus != this._reglage.plus) changer({ plus });
      });
    $bloc
      .find(".o_gardeesUnite")
      .on("change", (e) => changer({ plusType: parseInt(e.currentTarget.value) || 0 }));
    $bloc.find(".o_gardeesDefaut").on("click", (e) => {
      e.preventDefault();
      BoiteParametre.ouvrirOnglet("Attaque");
    });
    return this;
  }
  /**
   * Champs bloqués pendant un envoi : les unités qui partent ne changent plus.
   *
   * @method activer
   * @param {Boolean} actif
   */
  activer(actif) {
    let $bloc = $("#" + this._id);
    $bloc.find(".o_gardeesAntisondes, .o_gardeesUnite").prop("disabled", !actif);
    $bloc.find(".o_gardeesPlus").spinner(actif ? "enable" : "disable");
    return this;
  }
  /**
   * Nombre d'antisondes (onglet Armée) et unités gardées de `armee`, si elle
   * est connue.
   *
   * @method afficher
   * @param {Armee} [armee]
   */
  afficher(armee) {
    let p = monProfil.parametre,
      $bloc = $("#" + this._id);
    $bloc
      .find(".o_gardeesNbAntisondes")
      .text(
        `(${numeral(p["uniteAntisondeTerrain"].valeur).format()} en terrain + ${numeral(p["uniteAntisondeDome"].valeur).format()} en dôme)`,
      );
    // l'unité ne compte que s'il y a des unités en plus
    $bloc.find(".o_gardeesUnite").toggle(this._reglage.plus > 0);
    if (armee) $bloc.find(".o_gardeesTexte").text(Armee.texteGardees(armee.gardeesFlood()));
    return this;
  }
}
