/*
 * Joueur.js
 * Hraesvelg
 **********************************************************************/

/**
 * Classe pour creer et gérer un joueur
 *
 * @class Joueur
 */
class Joueur {
  constructor(parametres) {
    /**
     * id du joueur
     */
    this._id = parametres["id"] || -1;
    /**
     * pseudo du joueur
     */
    this._pseudo = parametres["pseudo"];
    /**
     * abscisse du joueur
     */
    this._x = parametres["x"] || -1;
    /**
     * ordonnée du joueur
     */
    this._y = parametres["y"] || -1;
    /**
     *
     */
    this._terrain = parametres["terrain"] || -1;
    /**
     *
     */
    this._niveauRecherche = parametres["niveauRecherche"] || new Array(10).fill(-1);
    /**
     *
     */
    this._technologie = parametres["technologie"] || -1;
    /**
     *
     */
    this._niveauConstruction = parametres["niveauConstruction"] || new Array(13).fill(-1);
    /**
     *
     */
    this._fourmiliere = parametres["fourmiliere"] || -1;
    /**
     *
     */
    this._mv = parametres["mv"] || false;
    /**
     *
     */
    this._ordreRadar = parametres["ordreRadar"] || 0;
    /**
     *
     */
    this._sujetForum = parametres["sujetForum"] || 0;
    /**
     *
     */
    this._rang = parametres["rang"] || "";
    /**
     *
     */
    this._ordreRang = parametres["ordreRang"] || 0;
    /**
     * Préférence du joueur.
     *
     * @private
     * @property _parametre
     * @type Object
     */
    this._parametre = {};
    // parametres style des boites
    this._parametre["couleur1"] = new Parametre("couleur1", "Couleur de fond", "color", "#d7c384");
    this._parametre["couleur2"] = new Parametre(
      "couleur2",
      "Couleur secondaire",
      "color",
      "#c9ad63",
    );
    this._parametre["couleur3"] = new Parametre("couleur3", "Couleur bordure", "color", "#bd8d46");
    this._parametre["couleurTexte"] = new Parametre(
      "couleurTexte",
      "Couleur du texte",
      "color",
      "#000000",
    );
    this._parametre["couleurTitre"] = new Parametre(
      "couleurTitre",
      "Couleur des titres",
      "color",
      "#787423",
    );
    this._parametre["dockPosition"] = new Parametre(
      "dockPosition",
      "Position des outils",
      "select",
      0,
      ["Droite", "Bas"],
    );
    this._parametre["dockVisible"] = new Parametre(
      "dockVisible",
      "Outils toujours visible ?",
      "checkbox",
      true,
    );
    this._parametre["boiteShow"] = new Parametre(
      "boiteShow",
      "Effet appariation des boites",
      "select",
      0,
      EFFET,
    );
    this._parametre["boiteHide"] = new Parametre(
      "boiteHide",
      "Effet disparition des boites",
      "select",
      0,
      EFFET,
    );
    // parametres armée
    this._parametre["methodeFlood"] = new Parametre(
      "methodeFlood",
      "Méthode de flood",
      "select",
      1,
      METHODE_FLOOD,
    );
    this._parametre["uniteAntisondeTerrain"] = new Parametre(
      "uniteAntisondeTerrain",
      "Antisonde max en terrain",
      "number",
      1,
    );
    this._parametre["uniteAntisondeDome"] = new Parametre(
      "uniteAntisondeDome",
      "Antisonde max en dôme",
      "number",
      0,
    );
    this._parametre["uniteSonde"] = new Parametre("uniteSonde", "Sonde vers l'ennemi", "number", 0);
    this._parametre["reserveFlood"] = new Parametre(
      "reserveFlood",
      "Réserve d'unités au flood",
      "number",
      0,
    );
    this._parametre["reserveFloodAuto"] = new Parametre(
      "reserveFloodAuto",
      "Suivre antisondes",
      "checkbox",
      true,
    );
    this._parametre["replacerArmeeAuto"] = new Parametre(
      "replacerArmeeAuto",
      "Replacer l'armée automatiquement",
      "checkbox",
      false,
    );
    // parametre divers
    this._parametre["couleurChat"] = new Parametre(
      "couleurChat",
      "Couleur chat",
      "color",
      "#000000",
    );
    this._parametre["couleurMessagerie"] = new Parametre(
      "couleurMessagerie",
      "Couleur messagerie",
      "color",
      "#000000",
    );
    this._parametre["affectationRessource"] = new Parametre(
      "affectationRessource",
      "Affectation des ressources",
      "select",
      0,
      ["Non", "Materiaux", "Nourriture", "Ratio"],
    );
    // part des ouvrières affectée à la nourriture en mode Ratio (le reste va
    // aux matériaux) : curseur de 10 en 10, champ au pourcent près
    this._parametre["ratioRecolte"] = new Parametre(
      "ratioRecolte",
      "Part en nourriture",
      "slider",
      50,
      {
        min: 0,
        max: 100,
        step: 10,
        unite: " %",
      },
    );
    return this;
  }
  /**
   *
   */
  get id() {
    return this._id;
  }
  /**
   *
   */
  set id(newId) {
    this._id = newId;
  }
  /**
   *
   */
  get pseudo() {
    return this._pseudo;
  }
  /**
   *
   */
  set pseudo(newPseudo) {
    this._pseudo = newPseudo;
  }
  /**
   *
   */
  get x() {
    return this._x;
  }
  /**
   *
   */
  set x(newX) {
    this._x = newX;
  }
  /**
   *
   */
  get y() {
    return this._y;
  }
  /**
   *
   */
  set y(newY) {
    this._y = newY;
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
  get niveauRecherche() {
    return this._niveauRecherche;
  }
  /**
   *
   */
  set niveauRecherche(newNiveau) {
    this._niveauRecherche = newNiveau;
  }
  /**
   *
   */
  get technologie() {
    return this._technologie;
  }
  /**
   *
   */
  set technologie(newTechnologie) {
    this._technologie = newTechnologie;
  }
  /**
   *
   */
  get niveauConstruction() {
    return this._niveauConstruction;
  }
  /**
   *
   */
  set niveauConstruction(newNiveau) {
    this._niveauConstruction = newNiveau;
  }
  /**
   *
   */
  get fourmiliere() {
    return this._fourmiliere;
  }
  /**
   *
   */
  set fourmiliere(newFourmiliere) {
    this._fourmiliere = newFourmiliere;
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
  get mv() {
    return this._mv;
  }
  /**
   *
   */
  set mv(newMV) {
    this._mv = newMV;
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
  get rang() {
    return this._rang;
  }
  /**
   *
   */
  set rang(newRang) {
    this._rang = newRang;
  }
  /**
   *
   */
  get ordreRang() {
    return this._ordreRang;
  }
  /**
   *
   */
  set ordreRang(newOrdre) {
    this._ordreRang = newOrdre;
  }
  /**
   * Renvoie les joueurs et les alliances sous surveillance.
   *
   * @method Radar
   * @return {Object} les joueurs et alliances format JSON.
   */
  get parametre() {
    return this._parametre;
  }
  /**
   *
   */
  toJSON() {
    return {
      id: this._id,
      pseudo: this._pseudo,
      x: this._x,
      y: this._y,
      terrain: this._terrain,
      mv: this._mv,
      ordreRadar: this._ordreRadar,
      rang: this._rang,
      niveauConstruction: this._niveauConstruction,
      niveauRecherche: this._niveauRecherche,
    };
  }
  /**
   *
   */
  estJoueurCourant() {
    return this._pseudo == monProfil.pseudo;
  }
  /**
   *
   */
  estAttaquable() {
    return this._terrain >= Utils.terrain * 0.5 + 1 && this._terrain <= Utils.terrain * 3 - 1;
  }
  /**
   *
   */
  estAttaquant() {
    return this._terrain * 0.5 + 1 <= Utils.terrain && this._terrain * 3 - 1 >= Utils.terrain;
  }
  /**
   *
   */
  getTDP() {
    return this._niveauConstruction[3] + this._niveauConstruction[4] + this._niveauRecherche[0];
  }
  /**
   *
   */
  getTempsParcours(x = monProfil.x, y = monProfil.y) {
    return Math.ceil(
      Math.pow(0.9, this._niveauRecherche[6]) *
        637200 *
        (1 - Math.exp(-(Math.sqrt(Math.pow(x - this._x, 2) + Math.pow(y - this._y, 2)) / 350))),
    );
  }
  /**
   *
   */
  getTempsParcours2(joueur) {
    return Math.ceil(
      Math.pow(0.9, this._niveauRecherche[6]) *
        637200 *
        (1 -
          Math.exp(
            -(Math.sqrt(Math.pow(joueur.x - this._x, 2) + Math.pow(joueur.y - this._y, 2)) / 350),
          )),
    );
  }
  /**
   *
   */
  getLienFourmizzz() {
    return this._pseudo != "Vous" || this._pseudo != "Ennemie"
      ? `<a href="Membre.php?Pseudo=${this._pseudo}" class='o_lien'>${this._pseudo}</a>`
      : this._pseudo;
  }
  /**
   *
   */
  attenteSynchro() {
    return 60 - (moment().add(this.getTempsParcours(), "s").seconds() % 60);
  }
  /**
   *
   */
  getParametre() {
    let data = JSON.parse(localStorage.getItem("outiiil_parametre")) || {};
    // Si des données sont deja presente et à jour on les charges
    for (let cle in data) if (this._parametre[cle]) this._parametre[cle].valeur = data[cle];
    return this;
  }
  /**
   *
   */
  sauvegarder() {
    return localStorage.setItem(
      "outiiil_joueur",
      JSON.stringify(this, ["id", "x", "y", "niveauConstruction", "niveauRecherche"]),
    );
  }
  /**
   *
   */
  getProfil() {
    return $.ajax({
      url: location.origin + "/Membre.php?Pseudo=" + this._pseudo,
    });
  }
  /**
   * Épée « Attaquer cette Fourmilière », comme dans les tableaux de membres
   * en Compte+. Le tableau ne donne que le pseudo et la page d'attaque veut
   * l'id du joueur : le lien mène au profil, et au clic l'id y est lu pour
   * ouvrir directement la page d'attaque (cf. Joueur.activerLiensAttaque).
   *
   * @static
   * @method lienAttaque
   * @param {String} pseudo
   * @return {String} html
   */
  static lienAttaque(pseudo) {
    return `<a href="Membre.php?Pseudo=${encodeURIComponent(pseudo)}" class="o_lienAttaque" data-pseudo="${pseudo}"><img src="images/icone/icone_degat_attaque.gif" title="Attaquer cette Fourmilière" alt="Attaquer" width="18" height="18"></a>`;
  }
  /**
   * Clic sur une épée de Joueur.lienAttaque : lit l'id sur le profil puis
   * ouvre la page d'attaque. En cas d'échec, le lien mène au profil.
   *
   * @static
   * @method activerLiensAttaque
   */
  static activerLiensAttaque() {
    $(document)
      .off("click.o_lienAttaque")
      .on("click.o_lienAttaque", ".o_lienAttaque", (e) => {
        e.preventDefault();
        let lien = e.currentTarget,
          joueur = new Joueur({ pseudo: $(lien).data("pseudo") });
        joueur.getProfil().then(
          (html) => {
            try {
              joueur.chargerProfil(html);
            } catch (erreur) {}
            location.href =
              joueur.id != -1 ? `ennemie.php?Attaquer=${joueur.id}&lieu=1` : lien.href;
          },
          () => (location.href = lien.href),
        );
      });
  }
  /**
   *
   */
  getProfilCourant() {
    // si on est le joueur courant on a peut etre les infos dans le storage
    if (monProfil.pseudo == this._pseudo) {
      // si on est le joueur courant on regarde dans le localstorage
      let data = JSON.parse(localStorage.getItem("outiiil_joueur")) || {};
      // Si des données sont deja presente et à jour on les charges
      if (data.hasOwnProperty("id") && data.hasOwnProperty("x") && data.hasOwnProperty("y")) {
        this._id = data.id;
        this._x = data.x;
        this._y = data.y;
      }
    }
    // sinon. 0 / 0 compte comme inconnu : c'est ce qu'enregistraient les versions
    // qui ne lisaient pas le lien carte.php de s5, et le profil n'était alors
    // jamais relu (temps de trajet faux)
    if (this._x == -1 || this._y == -1 || this._id == -1 || (this._x == 0 && this._y == 0))
      return this.getProfil();
    return null;
  }
  /**
   *
   */
  chargerProfil(html) {
    if (html.includes("Aucun joueurs avec le pseudo")) return false;
    else {
      // Strip `<img>` avant le parseHTML de jQuery — sinon `$(html)` crée un
      // fragment où le navigateur tente de charger toutes les images du profil
      // (avatars, signatures), dont des hôtes morts type skyrock.net qui
      // spamment `ERR_NAME_NOT_RESOLVED` dans la console. On lit que du texte
      // et de la structure ici, jamais les images.
      let stripped = html.replace(/<img\b[^>]*>/gi, ""),
        // -1 / -1 si les coordonnées sont introuvables : la carte d'alliance
        // écarte alors le joueur au lieu de le placer en 0 / 0
        coordonnees = Utils.coordonnees($(stripped).find(".boite_membre"));
      this._id = $(stripped).find("a[href^='commerce.php?ID=']").attr("href").match(/\d+/g)[0];
      this._x = coordonnees.x;
      this._y = coordonnees.y;
      this._mv = $(stripped)
        .find("table:eq(0) tr:eq(0) td:eq(0)")
        .text()
        .includes("Joueur en vacances");
      this._terrain = numeral($(stripped).find(".tableau_score tr:eq(1) td:eq(1)").text()).value();
      if (monProfil.pseudo == this._pseudo) this.sauvegarder();
    }
    return true;
  }
  /**
   * Récupére les niveaux des constructions du joueur ainsi que la construction en cours.
   *
   * @method getConstruction
   */
  getConstruction() {
    // si on est le joueur courant on regarde dans le localstorage
    let data = JSON.parse(localStorage.getItem("outiiil_joueur")) || {};
    // Si des données sont deja presente et à jour on les charges
    if (data.hasOwnProperty("niveauConstruction"))
      this._niveauConstruction = data.niveauConstruction;
    // si on pas les infos en localstorage
    if (
      this._niveauConstruction.every((elt) => {
        return elt == -1;
      })
    )
      return $.ajax({ url: location.origin + "/construction.php" });
    return null;
  }
  /**
   *
   */
  chargerConstruction(html) {
    let parsed = Utils.parseHtml(html);
    // Niveau des batiments
    parsed.find(".ligneAmelioration").each((i, elt) => {
      this._niveauConstruction[i] = parseInt(
        $(elt).find(".niveau_amelioration").text().split(" ")[1],
      );
    });
    // Construction en cours ?!
    let ligne = parsed.find("#centre strong").text(),
      construction = ligne.substring(2, ligne.indexOf("se termine") - 1),
      time = parseInt(ligne.split(",")[0].split("(")[1]);
    // si il y a une construction en cours les données expirent à la fin de cette construction
    if (construction) {
      let dataEvo = JSON.parse(localStorage.getItem("outiiil_evolution")) || {};
      // si on a pas de donné ou que la consutrction n'est pas deja enregistré
      if (!dataEvo.hasOwnProperty("construction")) {
        // si on pas les infos en localstorage
        dataEvo.construction = construction.substr(0, 1).toUpperCase() + construction.substr(1);
        dataEvo.expConstruction = moment().add(time, "s");
        dataEvo.startConstruction = moment();
        localStorage.setItem("outiiil_evolution", JSON.stringify(dataEvo));
      }
    }
    this.sauvegarder();
    return this;
  }
  /**
   * Récupére les niveaux des recherches du joueur ainsi que la recherche en cours.
   *
   * @method getLaboratoire
   */
  getLaboratoire() {
    // si on est le joueur courant on regarde dans le localstorage
    let data = JSON.parse(localStorage.getItem("outiiil_joueur")) || {};
    // Si des données sont deja presente et à jour on les charges
    if (data.hasOwnProperty("niveauRecherche")) this._niveauRecherche = data.niveauRecherche;
    // si on pas les infos en localstorage
    if (
      this._niveauRecherche.every((elt) => {
        return elt == -1;
      })
    )
      return $.ajax({ url: location.origin + "/laboratoire.php" });
    return null;
  }
  /**
   *
   */
  chargerRecherche(html) {
    let parsed = Utils.parseHtml(html);
    // Niveau des recherches
    parsed.find(".ligneAmelioration").each((i, elt) => {
      this._niveauRecherche[i] = parseInt($(elt).find(".niveau_amelioration").text().split(" ")[1]);
    });
    // Recherche en cours ?!
    let ligne = parsed.find("#centre strong").text();
    let recherche = ligne.substring(2, ligne.indexOf("termin") - 1),
      time = parseInt(ligne.split(",")[0].split("(")[1]);
    // si il y a une recherche en cours les données expirent à la fin de cette construction
    if (recherche) {
      let dataEvo = JSON.parse(localStorage.getItem("outiiil_evolution")) || {};
      // si on a pas de donné ou que la recherche n'est pas deja enregistré
      if (!dataEvo.hasOwnProperty("recherche")) {
        // si on pas les infos en localstorage
        dataEvo.recherche = recherche;
        dataEvo.expRecherche = moment().add(time, "s");
        dataEvo.startRecherche = moment();
        localStorage.setItem("outiiil_evolution", JSON.stringify(dataEvo));
      }
    }
    this.sauvegarder();
    return this;
  }
  /**
   *
   */
  getLigneRadar(radar, id, indice) {
    let cellTerrain = this.estAttaquable()
      ? `<a class="gras ${this._mv ? "blue_light" : ""} href="/ennemie.php?Attaquer=${this._id}&lieu=1">${numeral(this._terrain).format()}</a>`
      : `<span ${this._mv ? `class="blue_light" title="En vacances"` : ""}>${numeral(this._terrain).format()}</span>`;
    $(id).append(
      `<tr id="o_item_${indice}" class="lien"><td><a id="o_maj_${this._id}" class='o_actualiser' href=""><img src="${IMG_ACTUALISER}" alt="rang" height="20"/></a></td><td id="o_nom_${this._id}" class="left" title=""><a class="gras ${this._mv ? "blue_light" : ""}" href="Membre.php?Pseudo=${this._pseudo}">${this._pseudo}</a></td><td id="o_terrain_${this._id}" class="right reduce" title="">${cellTerrain}</td></tr>`,
    );
    // event
    $("#o_maj_" + this._id).click((e) => {
      this.refreshDansRadar(radar).then((res) => {
        if (res.removed) {
          $.toast({ ...TOAST_WARNING, text: `Le joueur ${this._pseudo} n'existe plus.` });
          radar.supprimeJoueur(this).sauvegarder().actualiser();
        } else if (res.changed) {
          radar.sauvegarder();
        }
      });
      return false;
    });
    // tooltip vacance...
    $("#o_terrain_" + this._id).tooltip({
      position: { my: "left+10 center", at: "right center" },
      tooltipClass: "warning-tooltip",
    });
    // creation du tooltip sur les joueurs pour avoir le temps de trajet
    $("#o_nom_" + this._id).tooltip({
      position: { my: "left+10 bottom", at: "right center" },
      content: "NC",
      open: (e, ui) => {
        if (radar.joueurs.hasOwnProperty(this._pseudo)) {
          $(e.currentTarget).tooltip({
            position: { my: "left+10 center", at: "right center" },
            content: `<table><tr><td>Temps de trajet</td><td class="right">${Utils.intToTime(monProfil.getTempsParcours2(radar.joueurs[this._pseudo]))}</td></tr><td>Retour le</td><td class="right">${moment().add(monProfil.getTempsParcours2(radar.joueurs[this._pseudo]), "s").format("D MMM à HH[h]mm[m]ss[s]")}</td><tr></tr></table>`,
            hide: { effect: "fade", duration: 10 },
            tooltipClass: "warning-tooltip ui-tooltip-right",
          });
        }
      },
      hide: { effect: "fade", duration: 10 },
      tooltipClass: "warning-tooltip ui-tooltip-right",
    });
  }
  /**
   * Rafraîchit le joueur dans le contexte de la boite radar : spin de l'icône,
   * fetch du profil, mise à jour du terrain et de l'état MV, highlight du diff.
   * Ne sauvegarde pas et ne touche pas la collection du radar — c'est au caller
   * (click single, ou batch "Tout actualiser") de décider quoi faire selon le
   * résultat ({ removed, changed }).
   *
   * @method refreshDansRadar
   * @param {BoiteRadar} radar
   * @return {Promise<{ removed: boolean, changed: boolean }>}
   */
  refreshDansRadar(radar) {
    let oldTerrain = numeral($("#o_terrain_" + this._id).text()).value(),
      oldMV = this._mv,
      $icon = $("#o_maj_" + this._id);
    $({ deg: 0 }).animate(
      { deg: 360 },
      {
        duration: 600,
        step: (now) => $icon.find("img").css({ transform: "rotate(" + now + "deg)" }),
      },
    );
    return this.getProfil().then((data) => {
      if (!this.chargerProfil(data)) return { removed: true, changed: false };
      let diff = this._terrain - oldTerrain,
        changed = false,
        cellTerrain = this.estAttaquable()
          ? `<a class="gras ${this._mv ? "blue_light" : ""} href="/ennemie.php?Attaquer=${this._id}&lieu=1">${numeral(this._terrain).format()}</a>`
          : `<span ${this._mv ? `class="blue_light" title="En vacances"` : ""}>${numeral(this._terrain).format()}</span>`;
      if (oldMV != this._mv) {
        $("#o_terrain_" + this._id).html(cellTerrain);
        if (this._mv) $("#o_nom_" + this._id + " a").addClass("blue_light");
        else $("#o_nom_" + this._id + " a").removeClass("blue_light");
        changed = true;
      }
      if (diff) {
        $("#o_terrain_" + this._id)
          .html(cellTerrain)
          .effect("highlight", { color: diff > 0 ? "#458D58" : "#8D4545" }, 1000)
          .attr("title", numeral(diff).format())
          .tooltip({
            position: { my: "left+10 center", at: "right center" },
            content: `<span class='${diff > 0 ? "green_light" : "red_xlight"}'>${diff > 0 ? "+ " + $("#o_terrain_" + this._id).attr("title") : $("#o_terrain_" + this._id).attr("title")} cm²</span>`,
            hide: { effect: "fade", duration: 10 },
            tooltipClass: "warning-tooltip ui-tooltip-right",
          })
          .tooltip("open");
        changed = true;
      }
      return { removed: false, changed };
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
        prioriteRecherche: "joueur",
      },
    });
  }
}
