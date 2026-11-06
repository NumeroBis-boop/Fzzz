/*
 * UnitesGardees.js
 * Unités gardées au flood : valeurs par défaut (préférences) et réglage de
 * l'attaque en cours (lanceur de flood, multi-flood).
 **********************************************************************/

/**
 * Bloc des unités gardées : les antisondes (gardées ou non) et une ligne
 * « nombre + unité » par autre unité gardée, « + ajouter une unité » sous la
 * dernière. Dans le lanceur de flood et le multi-flood, il part des
 * préférences et ne vaut que pour cette attaque ; dans les préférences, il
 * règle les valeurs par défaut.
 *
 * @class UnitesGardees
 */
class UnitesGardees {
  /**
   * @param {String} id identifiant du bloc dans la page
   * @param {Function} auChangement appelé après chaque modification
   * @param {{titre?: String|null, preferences?: Boolean}} [options] preferences :
   *   bloc de l'onglet Attaque, sans liste des unités gardées ni lien
   */
  constructor(
    id,
    auChangement,
    { titre = "Unités gardées pour cette attaque", preferences = false } = {},
  ) {
    this._id = id;
    this._auChangement = auChangement;
    this._titre = titre;
    this._preferences = preferences;
    this._actif = true;
    this._reglage = Armee.gardeesParDefaut();
  }
  /**
   * Réglage du bloc, à passer à Armee.gardees (modifié sur place).
   *
   * @return {{antisondes: Boolean, autres: Array<{nombre: Number, unite: Number}>}}
   */
  get reglage() {
    return this._reglage;
  }
  /**
   * @private
   * @method ligne
   * @param {{nombre: Number, unite: Number}} ligne
   * @return {String}
   */
  ligne({ nombre, unite }) {
    let unites = ["Dernières unités de l'armée", ...NOM_UNITE.slice(1)]
      .map((nom, i) => `<option value="${i}" ${i == unite ? "selected" : ""}>${nom}</option>`)
      .join("");
    return `<div class="o_gardeesLigne">+ <input class="o_gardeesNombre" value="${nombre}" size="8"/> <select class="o_gardeesUnite">${unites}</select> <a href="#" class="o_gardeesRetirer" title="Ne plus garder cette unité">✕</a></div>`;
  }
  /**
   * @method html
   * @return {String}
   */
  html() {
    let r = this._reglage,
      titre = this._titre ? `<div class="o_gardeesTete gras">${this._titre} :</div>` : "",
      fin = this._preferences
        ? `<div class="o_gardeesAide o_aideParam">si l'armée en a moins qu'indiqué : toutes celles qu'elle a sont gardées, sans les compléter par d'autres unités</div>`
        : `<div class="o_gardeesResultat">= <span class="o_gardeesTexte"></span> · <a href="#" class="o_gardeesDefaut">par défaut : Préférences</a></div>`;
    return `<div id="${this._id}" class="o_gardees${this._preferences ? "" : " reduce"}">
        ${titre}
        <div class="o_gardeesTete"><label><input type="checkbox" class="o_gardeesAntisondes" ${r.antisondes ? "checked" : ""}/> les antisondes <span class="o_gardeesNbAntisondes"></span></label></div>
        <div class="o_gardeesLignes">${r.autres.map((ligne) => this.ligne(ligne)).join("")}</div>
        <div class="o_gardeesTete"><a href="#" class="o_gardeesAjouter">+ ajouter une unité</a></div>
        ${fin}
      </div>`;
  }
  /**
   * Branche les champs, une fois le bloc dans la page.
   *
   * @method brancher
   */
  brancher() {
    let $bloc = $("#" + this._id),
      // ligne du réglage d'un champ : même rang que sa ligne dans le bloc
      ligneDe = (e) => this._reglage.autres[$(e.currentTarget).closest(".o_gardeesLigne").index()];
    $bloc.on("change", ".o_gardeesAntisondes", (e) => {
      this._reglage.antisondes = e.currentTarget.checked;
      this._auChangement();
    });
    $bloc.on("input spinstop spinchange", ".o_gardeesNombre", (e) => {
      let ligne = ligneDe(e),
        nombre = Math.max(0, parseInt($(e.currentTarget).spinner("value")) || 0);
      if (!ligne || nombre == ligne.nombre) return;
      ligne.nombre = nombre;
      this._auChangement();
    });
    $bloc.on("change", ".o_gardeesUnite", (e) => {
      let ligne = ligneDe(e);
      if (!ligne) return;
      ligne.unite = parseInt(e.currentTarget.value) || 0;
      this._auChangement();
    });
    $bloc.on("click", ".o_gardeesRetirer", (e) => {
      e.preventDefault();
      if (!this._actif) return;
      let $ligne = $(e.currentTarget).closest(".o_gardeesLigne");
      this._reglage.autres.splice($ligne.index(), 1);
      $ligne.remove();
      this._auChangement();
    });
    $bloc.on("click", ".o_gardeesAjouter", (e) => {
      e.preventDefault();
      if (!this._actif) return;
      let ligne = { nombre: 0, unite: 0 };
      this._reglage.autres.push(ligne);
      let $ligne = $(this.ligne(ligne)).appendTo($bloc.find(".o_gardeesLignes"));
      $ligne.find(".o_gardeesNombre").spinner({ min: 0 }).trigger("focus");
      this._auChangement();
    });
    $bloc.on("click", ".o_gardeesDefaut", (e) => {
      e.preventDefault();
      BoiteParametre.ouvrirOnglet("Attaque");
    });
    $bloc.find(".o_gardeesNombre").spinner({ min: 0 });
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
    this._actif = actif;
    $bloc.find(".o_gardeesAntisondes, .o_gardeesUnite").prop("disabled", !actif);
    $bloc.find(".o_gardeesNombre").spinner(actif ? "enable" : "disable");
    $bloc.find(".o_gardeesAjouter, .o_gardeesRetirer").toggle(actif);
    return this;
  }
  /**
   * Nombre d'antisondes (onglet Armée) et unités gardées de `armee`, une fois
   * l'armée connue.
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
        `(${numeral(p["uniteAntisondeTerrain"].valeur).format()} en terrain + ${numeral(p["uniteAntisondeDome"].valeur).format()} en dôme${this._preferences ? ", onglet Armée" : ""})`,
      );
    $bloc.find(".o_gardeesAide").toggle(this._reglage.autres.some((ligne) => ligne.unite > 0));
    $bloc.find(".o_gardeesResultat").toggle(!!armee);
    if (armee) $bloc.find(".o_gardeesTexte").text(Armee.texteGardees(armee.gardeesFlood()));
    return this;
  }
}
