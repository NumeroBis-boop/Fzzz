/*
 * Alliance.js
 * Hraesvelg
 **********************************************************************/

/**
 * Classe pour creer et gérer une alliance
 *
 * @class Alliance
 */
class Alliance {
  constructor(parametres) {
    /**
     * tag de l'alliance
     */
    this._tag = parametres["tag"];
    /**
     * nom de l'alliance
     */
    this._nom = parametres["nom"] || "";
    /**
     * terrain globale de l'alliance
     */
    this._terrain = parametres["terrain"] || -1;
    /**
     *
     */
    this._fourmiliere = parametres["fourmiliere"] || -1;
    /**
     *
     */
    this._technologie = parametres["technologie"] || -1;
    /**
     * liste des joueurs
     */
    this._joueurs = {};
    if (parametres.hasOwnProperty("joueurs"))
      for (let pseudo in parametres["joueurs"])
        this._joueurs[pseudo] = new Joueur(parametres["joueurs"][pseudo]);
    /**
     *
     */
    this._ordreRadar = parametres["ordreRadar"] || 0;
    /**
     *
     */
    this._sujetForum = parametres["sujetForum"] || -1;
  }
  /**
   *
   */
  get tag() {
    return this._tag;
  }
  /**
   *
   */
  set tag(newTag) {
    this._tag = newTag;
  }
  /**
   *
   */
  get nom() {
    return this._nom;
  }
  /**
   *
   */
  set nom(newNom) {
    this._nom = newNom;
  }
  /**
   *
   */
  get terrain() {
    return this._terrain;
  }
  /**
   *
   */
  set terrain(newTerrain) {
    this._terrain = newTerrain;
  }
  /**
   *
   */
  get joueurs() {
    return this._joueurs;
  }
  /**
   *
   */
  set joueurs(newJoueurs) {
    this._joueurs = newJoueurs;
  }
  /**
   *
   */
  get ordreRadar() {
    return this._ordreRadar;
  }
  /**
   *
   */
  set ordreRadar(newOrdre) {
    this._ordreRadar = newOrdre;
  }
  /**
   *
   */
  get sujetForum() {
    return this._sujetForum;
  }
  /**
   *
   */
  set sujetForum(newSujet) {
    this._sujetForum = newSujet;
  }
  /**
   *
   */
  calculTerrain() {
    this._terrain = Object.keys(this._joueurs).reduce((acc, key) => {
      return acc + this._joueurs[key].terrain;
    }, 0);
    return this._terrain;
  }
  /**
   *
   */
  calculTechnologie() {
    this._technologie = Object.keys(this._joueurs).reduce((acc, key) => {
      return acc + this._joueurs[key].technologie;
    }, 0);
    return this._technologie;
  }
  /**
   *
   */
  calculFourmiliere() {
    this._fourmiliere = Object.keys(this._joueurs).reduce((acc, key) => {
      return acc + this._joueurs[key].fourmiliere;
    }, 0);
    return this._fourmiliere;
  }
  /**
   *
   */
  toJSON() {
    return {
      tag: this._tag,
      joueurs: this._joueurs,
      terrain: this._terrain,
      technologie: this._technologie,
      fourmiliere: this._fourmiliere,
      ordreRadar: this._ordreRadar,
      sujetForum: this._sujetForum,
    };
  }
  /**
   * Récupére la description d'une alliance.
   *
   * @private
   * @method getDescription
   */
  getDescription() {
    return $.ajax({
      url: location.origin + "/classementAlliance.php?alliance=" + this._tag,
    });
  }
  /**
   *
   */
  getLigneRadar(radar, id, indice) {
    $(id).append(
      `<tr id="o_item_${indice}" class="lien"><td><a id="o_maj_${this._tag}" class='o_actualiser' href=""><img src="${IMG_ACTUALISER}" alt="rang" height="20"/></a></td><td class="left"><a class="gras" href="classementAlliance.php?alliance=${this._tag}">${this._tag}</a><sup style="font-size:0.65em;margin-left:3px;opacity:0.7;">ALI</sup></td><td id="o_terrain_${this._tag}" class="right reduce" title="">${numeral(this._terrain).format()}</td></tr>`,
    );
    // event
    $("#o_maj_" + this._tag).click((e) => {
      this.refreshDansRadar(radar).then((res) => {
        if (res.changed) radar.sauvegarder();
      });
      return false;
    });
    return this;
  }
  /**
   * Rafraîchit l'alliance dans le contexte de la boite radar : spin de l'icône,
   * fetch de la description, somme du terrain des membres, highlight du diff.
   * Ne sauvegarde pas — c'est au caller (click single, ou batch "Tout actualiser")
   * de décider quoi faire selon le résultat ({ removed, changed }).
   *
   * @method refreshDansRadar
   * @param {BoiteRadar} radar
   * @return {Promise<{ removed: boolean, changed: boolean }>}
   */
  refreshDansRadar(radar) {
    let oldTerrain = numeral($("#o_terrain_" + this._tag).text()).value(),
      $icon = $("#o_maj_" + this._tag);
    $({ deg: 0 }).animate(
      { deg: 360 },
      {
        duration: 600,
        step: (now) => $icon.find("img").css({ transform: "rotate(" + now + "deg)" }),
      },
    );
    return this.getDescription().then((data) => {
      this._terrain = 0;
      $(data)
        .find("#tabMembresAlliance tr:gt(0)")
        .each((i, elt) => {
          this._terrain += numeral($(elt).find("td:eq(4)").text()).value();
        });
      let diff = this._terrain - oldTerrain;
      if (!diff) return { removed: false, changed: false };
      $("#o_terrain_" + this._tag)
        .text(numeral(this._terrain).format())
        .effect("highlight", { color: diff > 0 ? "#458D58" : "#8D4545" }, 1000)
        .attr("title", numeral(diff).format())
        .tooltip({
          position: { my: "left+10 center", at: "right center" },
          content: `<span class='${diff > 0 ? "green_light" : "red_xlight"}'>${diff > 0 ? "+ " + $("#o_terrain_" + this._tag).attr("title") : $("#o_terrain_" + this._tag).attr("title")} cm²</span>`,
          hide: { effect: "fade", duration: 10 },
          tooltipClass: "warning-tooltip ui-tooltip-right",
        })
        .tooltip("open");
      return { removed: false, changed: true };
    });
  }
  /**
   *
   */
  static rechercher(elt) {
    return $.ajax({
      type: "post",
      url: location.origin + "/classementAlliance.php",
      data: {
        requete: elt,
        recherche: 1,
        prioriteRecherche: "alliance",
      },
    });
  }
}
