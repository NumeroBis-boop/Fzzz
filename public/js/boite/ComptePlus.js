// @ts-check
/**
 * Creer la boite compte plus.
 *
 * @class BoiteComptePlus
 * @constructor
 * @extends Boite
 */
class BoiteComptePlus {
  constructor() {
    // attribut de la classe
    this._ponte = [];
    this._startPonte = 0;
    this._construction = "";
    this._expConstruction = 0;
    this._startConstruction = 0;
    this._recherche = "";
    this._expRecherche = 0;
    this._startRecherche = 0;
    this._attaque = [];
    this._startAttaque = 0;
    this._convoi = [];
    this._startConvoi = 0;
    this._chasse = [];
    this._startChasse = 0;
    // on charge les données depuis le storage
    this.getData();
  }
  /**
   *
   */
  get ponte() {
    return this._ponte;
  }
  /**
   *
   */
  set ponte(newPonte) {
    this._ponte = newPonte;
  }
  /**
   *
   */
  get startPonte() {
    return this._startPonte;
  }
  /**
   *
   */
  set startPonte(newStart) {
    this._startPonte = newStart;
  }
  /**
   *
   */
  get construction() {
    return this._construction;
  }
  /**
   *
   */
  set construction(newConstruction) {
    this._construction = newConstruction;
  }
  /**
   *
   */
  get expConstruction() {
    return this._expConstruction;
  }
  /**
   *
   */
  set expConstruction(newExp) {
    this._expConstruction = newExp;
  }
  /**
   *
   */
  get startConstruction() {
    return this._startConstruction;
  }
  /**
   *
   */
  set startConstruction(newStart) {
    this._startConstruction = newStart;
  }
  /**
   *
   */
  get recherche() {
    return this._recherche;
  }
  /**
   *
   */
  set recherche(newRecherche) {
    this._recherche = newRecherche;
  }
  /**
   *
   */
  get expRecherche() {
    return this._expRecherche;
  }
  /**
   *
   */
  set expRecherche(newExp) {
    this._expRecherche = newExp;
  }
  /**
   *
   */
  get startRecherche() {
    return this._startRecherche;
  }
  /**
   *
   */
  set startRecherche(newStart) {
    this._startRecherche = newStart;
  }
  /**
   *
   */
  get convoi() {
    return this._convoi;
  }
  /**
   *
   */
  set convoi(newConvoi) {
    this._convoi = newConvoi;
  }
  /**
   *
   */
  get startConvoi() {
    return this._startConvoi;
  }
  /**
   *
   */
  set startConvoi(newStart) {
    this._startConvoi = newStart;
  }
  /**
   *
   */
  get attaque() {
    return this._attaque;
  }
  /**
   *
   */
  set attaque(newAttaque) {
    this._attaque = newAttaque;
  }
  /**
   *
   */
  get startAttaque() {
    return this._startAttaque;
  }
  /**
   *
   */
  set startAttaque(newStart) {
    this._startAttaque = newStart;
  }
  /**
   *
   */
  get chasse() {
    return this._chasse;
  }
  /**
   *
   */
  set chasse(newChasse) {
    this._chasse = newChasse;
  }
  /**
   *
   */
  get startChasse() {
    return this._startChasse;
  }
  /**
   *
   */
  set startChasse(newStart) {
    this._startChasse = newStart;
  }
  /**
   * Récupére les données sur les joueurs sous surveillance.
   *
   * @method getRadar
   */
  getData() {
    let data = Utils.lireStockage("outiiil_evolution");
    if (data.ponte) this._ponte = data.ponte;
    if (data.startPonte) this._startPonte = data.startPonte;
    if (data.construction) this._construction = data.construction;
    if (data.expConstruction) this._expConstruction = data.expConstruction;
    if (data.startConstruction) this._startConstruction = data.startConstruction;
    if (data.recherche) this._recherche = data.recherche;
    if (data.expRecherche) this._expRecherche = data.expRecherche;
    if (data.startRecherche) this._startRecherche = data.startRecherche;
    if (data.attaque) this._attaque = data.attaque;
    if (data.startAttaque) this._startAttaque = data.startAttaque;
    if (data.convoi) this._convoi = data.convoi;
    if (data.startConvoi) this._startConvoi = data.startConvoi;
    if (data.chasse) this._chasse = data.chasse;
    if (data.startChasse) this._startChasse = data.startChasse;
    return this;
  }
  /**
   *
   */
  toJSON() {
    let data = {};
    if (this._ponte.length) data.ponte = this._ponte;
    if (this._startPonte) data.startPonte = this._startPonte;
    if (this._construction) data.construction = this._construction;
    if (this._expConstruction) data.expConstruction = this._expConstruction;
    if (this._startConstruction) data.startConstruction = this._startConstruction;
    if (this._recherche) data.recherche = this._recherche;
    if (this._expRecherche) data.expRecherche = this._expRecherche;
    if (this._startRecherche) data.startRecherche = this._startRecherche;
    if (this._attaque.length) data.attaque = this._attaque;
    if (this._startAttaque) data.startAttaque = this._startAttaque;
    if (this._convoi.length) data.convoi = this._convoi;
    if (this._startConvoi) data.startConvoi = this._startConvoi;
    if (this._chasse.length) data.chasse = this._chasse;
    if (this._startChasse) data.startChasse = this._startChasse;
    return data;
  }
  /**
   *
   */
  sauvegarder() {
    localStorage.setItem("outiiil_evolution", JSON.stringify(this));
    return this;
  }
  /**
   *
   */
  verifierDonnees() {
    // si la construction est fini
    if (this._construction && moment(this._expConstruction).diff(moment()) < 0) {
      // on met à jour le niveau de la construction
      let index = CONSTRUCTION.findIndex((elt) => {
        return this._construction.toLowerCase().includes(elt.toLowerCase());
      });
      monProfil.niveauConstruction[index]++;
      monProfil.sauvegarder();
      // si la construction est une evolution de ponte, on met a jour les pontes
      if (this._construction.includes("Couveuse") || this._construction.includes("Solarium"))
        this.recalculeTempsPonte();
      this._startConstruction = 0;
      this._expConstruction = 0;
      this._construction = "";
    }
    // si la recherche est fini
    if (this._recherche && moment(this._expRecherche).diff(moment()) < 0) {
      // on met à jour le niveau de la recherche
      let index = RECHERCHE.findIndex((elt) => {
        return this._recherche.toLowerCase().includes(elt.toLowerCase());
      });
      monProfil.niveauRecherche[index]++;
      monProfil.sauvegarder();
      // si la recherche est une evolution de ponte, on met a jour les pontes
      if (this._recherche.includes("Technique de ponte")) this.recalculeTempsPonte();
      this._expRecherche = 0;
      this._startRecherche = 0;
      this._recherche = "";
    }
    // si la ou les pontes sont finis
    for (let i = this._ponte.length; i--; )
      if (moment(this._ponte[i].exp).diff(moment()) < 0) this._ponte.splice(i, 1);
    if (!this._ponte.length) this._startPonte = 0;
    // si la ou les convois sont finis
    for (let i = this._convoi.length; i--; )
      if (moment(this._convoi[i].exp).diff(moment()) < 0) this._convoi.splice(i, 1);
    if (!this._convoi.length) this._startConvoi = 0;
    // si la ou les attaques sont finis
    for (let i = this._attaque.length; i--; )
      if (moment(this._attaque[i].exp).diff(moment()) < 0) this._attaque.splice(i, 1);
    if (!this._attaque.length) this._startAttaque = 0;
    // si la ou les chasses sont finis
    for (let i = this._chasse.length; i--; )
      if (moment(this._chasse[i].exp).diff(moment()) < 0) this._chasse.splice(i, 1);
    if (!this._chasse.length) this._startChasse = 0;
    return this.sauvegarder();
  }
  /**
   *
   */
  recalculeTempsPonte() {
    this._ponte.forEach((ponte) => {
      ponte.exp = moment().add(Math.round((moment(ponte.exp).diff(moment()) / 1000) * 0.9), "s");
    });
  }
  /**
   * Construit le bloc de raccourcis « menu rapide » (cf. MENU_RAPIDE) à
   * partir des préférences stockées par `PageCompte`. Renvoie une chaîne
   * vide si aucune préférence n'est cochée — pas de bloc fantôme.
   *
   * Réutilise la classe native `lien_rapide` que Fourmizzz utilise dans
   * la BoiteComptePlus côté Compte+ → on hérite gratuitement de son
   * styling au lieu de bricoler.
   *
   * @private
   * @method _htmlRaccourcisMenuRapide
   * @returns {string}
   */
  _htmlRaccourcisMenuRapide() {
    let prefs = {};
    try {
      prefs = Utils.lireStockage(MENU_RAPIDE_KEY);
    } catch (e) {
      return "";
    }
    let actifs = MENU_RAPIDE.filter((item) => prefs[item.name]);
    if (!actifs.length) return "";
    let liens = actifs
      .map((item) => {
        let target = item.target ? ` target='${item.target}' rel='noopener'` : "";
        // la carte n'a pas la même adresse sur tous les serveurs
        let url = item.url == "carte2.php" ? Utils.pageCarte : item.url;
        return `<a href='${url}'${target}>${item.label}</a>`;
      })
      .join("");
    return `<div class='lien_rapide'>${liens}</div>`;
  }
  /**
   * Re-rend le bloc raccourcis depuis localStorage. Appelé par PageCompte
   * après que l'utilisateur valide ses préférences sur compte.php — évite
   * le reload de page qui serait disproportionné pour un changement de
   * pure préférence visuelle.
   *
   * @method majRaccourcisMenuRapide
   */
  majRaccourcisMenuRapide() {
    if (Utils.comptePlus) return this; // natif gère pour les C+
    let $box = $("#boiteComptePlus .contenu_boite_compte_plus");
    if (!$box.length) return this;
    $box.find(".lien_rapide").remove();
    let html = this._htmlRaccourcisMenuRapide();
    if (html) $box.append(html);
    return this;
  }
  /**
   * Affiche la boite.
   *
   * @private
   * @method afficher
   */
  afficher() {
    let visible = localStorage.getItem("outiiil_boiteActive");
    if (!Utils.comptePlus) {
      // Ajout du contenue : à la place de l'encadré du jeu, ou (s'il n'y en a
      // pas) sous l'encadré « S5 pseudo »
      if (!$("#boiteComptePlus").length && $("#boiteInfo").length)
        $("<div id='boiteComptePlus'/>").insertAfter("#boiteInfo");
      let cree = !$("#boiteComptePlus").hasClass("boite_compte_plus");
      $("#boiteComptePlus").replaceWith(
        "<div id='boiteComptePlus' class='boite_compte_plus'><div class='titre_colonne_cliquable'><span class='titre_compte_plus'>" +
          TITRE_SYNTHESE +
          "</span></div><div class='contenu_boite_compte_plus'><table " +
          (visible == null || visible == "C" ? "" : "style='display:none'") +
          ">" +
          // Ligne ponte
          "<tr class='lien' title='Aller sur Reine'><td><a href='Reine.php'><div style='position:relative;height:27px;padding-left:5px;'><div class='mini_icone_ponte'/><div id='o_resteUnite' class='o_labelBoite'></div><div id='o_tempsUnite' class='o_labelTempsBoite'></div><div id='o_progressUnite'/></div></a></td></tr>" +
          // Ligne construction
          "<tr class='lien' title='Aller sur Construction'><td><a href='construction.php'><div style='position:relative;height:27px;padding-left:5px;'><div class='mini_icone_construction'/><div id='o_resteConstruction' class='o_labelBoite'>Aucune construction</div><div id='o_tempsConstruction' class='o_labelTempsBoite'></div><div id='o_progressConstruction'/></div></a></td></tr>" +
          // Ligne recherche
          "<tr class='lien' title='Aller sur Laboratoire'><td><a href='laboratoire.php'><div style='position:relative;height:27px;padding-left:5px;'><div class='mini_icone_recherche'/><div id='o_resteRecherche' class='o_labelBoite'>Aucune recherche</div><div id='o_tempsRecherche' class='o_labelTempsBoite'></div><div id='o_progressRecherche'/></div></a></td></tr>" +
          // Ligne Chasse
          "<tr class='lien' title='Aller sur Ressource'><td><a href='Ressources.php'><div style='position:relative;height:27px;padding-left:5px;'><div class='mini_icone_chasse'/><div id='o_resteChasse' class='o_labelBoite'></div><div id='o_tempsChasse' class='o_labelTempsBoite'></div><div id='o_progressChasse'/></div></a></td></tr>" +
          // Ligne attaque
          "<tr class='lien' title='Aller sur Armée'><td><a href='Armee.php'><div style='position:relative;height:27px;padding-left:5px;'><div class='mini_icone_attaque'/><div id='o_resteAttaque' class='o_labelBoite'></div><div id='o_tempsAttaque' class='o_labelTempsBoite'></div><div id='o_progressAttaque'/></div></a></td></tr>" +
          // Ligne Convoi
          "<tr class='lien' title='Aller sur Convoi'><td><a href='commerce.php'><div style='position:relative;height:27px;padding-left:5px;'><div class='mini_icone_convoi'/><div id='o_resteConvoi' class='o_labelBoite'></div><div id='o_tempsConvoi' class='o_labelTempsBoite'></div><div id='o_progressConvoi'/></div></a></td></tr>" +
          // Formulaire de recherche
          "</table>" +
          "<form method='post' action='classementAlliance.php' style='text-align:center;margin-top:5px;'><input type='text' name='requete' id='recherche' placeholder='Joueur ou Alliance'/></form>" +
          this._htmlRaccourcisMenuRapide() +
          "</div></div>",
      );
      // encadré créé par Fzzz : placé sous l'encadré « S5 pseudo »
      if (cree) Dock.suivre($("#boiteInfo")[0], $("#boiteComptePlus")[0], () => ECART_ENCADRES);
      // Remplissage des champs
      this.verifierDonnees()
        .majPonte()
        .majConstruction()
        .majRecherche()
        .majAttaque()
        .majConvoi()
        .majChasse();
      // Formatage du title
      $("#boiteComptePlus table tr").tooltip({
        tooltipClass: "warning-tooltip",
        content: function () {
          return $(this).prop("title");
        },
        position: { my: "left+10 center", at: "right center" },
        hide: { effect: "fade", duration: 10 },
      });
      // autocomplete sur le chams de recherche
      $("#recherche")
        .autocomplete({
          source: (request, response) => {
            // requete pour autocomplete
            Joueur.rechercher(request.term).then((data) => {
              response(Utils.extraitRecherche(data));
            });
          },
          position: { my: "left top-5", at: "left bottom" },
          delay: 0,
          minLength: 3,
          select: (event, ui) => {
            window.location.replace(ui.item.url);
          },
        })
        .data("ui-autocomplete");
    } else
      visible == null || visible == "C"
        ? ""
        : $("#boiteComptePlus .contenu_boite_compte_plus table:eq(0)").css("display", "none");
    // Effet highlight si du terrain est découvert : on parse un tooltip
    // injecté en script-tag à côté de #tableau_boite_info (forme `content: ... })`).
    // Sur mobile, ce bandeau natif peut être absent ou rendu différemment ;
    // sans guard, le `.split("content:")[1]` renvoie undefined et le
    // `.split("})")` qui suit throw, ce qui cassait toute la chaîne d'init
    // (BoiteRadar, routage Reine.php / compte.php, etc.).
    let tooltipRaw = $("#tableau_boite_info").next().text();
    if (tooltipRaw.includes("content:")) {
      let tooltipConso = Utils.parseHtml(tooltipRaw.split("content:")[1].split("})")[0]);
      if (
        Utils.terrain * 48 !=
          numeral(tooltipConso.find("td:eq(7)").text()).value() +
            numeral(tooltipConso.find("td:eq(8)").text()).value() &&
        Utils.ouvrieres > Utils.terrain
      )
        $("#boite_info_tdc .jauge").addClass("highlight_error");
    }
  }
  /**
   * Compte à rebours d'une ligne de la boîte jusqu'à exp, et sa barre de
   * progression depuis start : durée courte au-delà d'une heure, secondes
   * visibles en dessous. Pour une liste (pontes, chasses…), l'élément terminé
   * en est retiré à 0 et la ligne passe au suivant. Pas pour la construction
   * et la recherche : leur fin met à jour les niveaux du profil (cf.
   * verifierDonnees), à faire une seule fois au chargement d'une page et non
   * dans chaque onglet ouvert.
   *
   * @private
   * @method _compteARebours
   * @param {String} ligne suffixe des ids o_temps / o_progress
   * @param start début, pour la progression
   * @param exp fin
   * @param {String} liste attribut de la liste dont exp est le premier élément
   */
  _compteARebours(ligne, start, exp, liste = "") {
    let debut = moment(start).valueOf(),
      fin = moment(exp).valueOf(),
      progression = $("#o_progress" + ligne);
    Utils.decreaseTime((fin - Date.now()) / 1000, "o_temps" + ligne, {
      format: (t) => (t > 3600 ? Utils.shortcutTime(t) : Utils.intToTime(t)),
      chaqueSeconde: (t) => {
        progression
          .progressbar({ value: fin > debut ? ((Date.now() - debut) * 100) / (fin - debut) : 100 })
          .toggleClass("highlight_success", t <= 600);
      },
      aZero: () => {
        if (!liste) return;
        // une seconde plus tard, pour que l'élément soit bien passé
        setTimeout(() => {
          this[liste] = this[liste].filter((elt) => moment(elt.exp).isAfter(moment()));
          this["maj" + (ligne == "Unite" ? "Ponte" : ligne)]();
        }, 1000);
      },
    });
  }
  /**
   * Met à jour les pontes si elles ne correspondent pas.
   *
   * @private
   * @method majPonte
   */
  majPonte() {
    if (this._ponte.length) {
      $("#o_resteUnite").text(this._ponte[0].unite).css({
        "max-width": "110px",
        "text-overflow": "ellipsis",
        overflow: "hidden",
        "white-space": "nowrap",
      });
      // Ajout du title
      let table = "<table>",
        tmpExp = moment(this._ponte[0].exp),
        nombreU,
        tempsU;
      for (let i = 0; i < this._ponte.length; i++) {
        nombreU = this._ponte[i]["nombre"];
        tempsU =
          nombreU > 1
            ? TEMPS_UNITE[NOM_UNITES.indexOf(this._ponte[i].unite)]
            : TEMPS_UNITE[NOM_UNITE.indexOf(this._ponte[i].unite)];
        if (i == 0)
          nombreU = Math.ceil(
            moment(this._ponte[i].exp).diff(moment()) /
              1000 /
              (tempsU * Math.pow(0.9, monProfil.getTDP())),
          );
        table += `<tr><td class='gras right'>${nombreU < 1000 ? nombreU : numeral(nombreU).format("0[.]00a")}</td><td>${this._ponte[i].unite}</td><td>${moment(this._ponte[i].exp).add(1, "minute").startOf("minute").format("D MMM YYYY à HH[h]mm")}</td></tr>`;
      }
      table += "</table>";
      $("#boiteComptePlus table tr:eq(0)").attr("title", table);
      // Si il reste moins d'une heure (on voit les secondes) on met dynamise
      this._compteARebours("Unite", this._startPonte, this._ponte[0].exp, "_ponte");
    } else {
      $("#o_resteUnite").html("<span class='red_light'>Aucune ponte</span>");
      Utils.arreterTime("o_tempsUnite");
      $("#o_tempsUnite").text("");
      $("#o_progressUnite").progressbar({ value: 0 }).removeClass("highlight_success");
    }
    return this;
  }
  /**
   * Met à jour la construction en cours si elle change.
   *
   * @private
   * @method majConstruction
   */
  majConstruction() {
    if (this._construction) {
      $("#o_resteConstruction").text(this._construction).css({
        "max-width": "110px",
        "text-overflow": "ellipsis",
        overflow: "hidden",
        "white-space": "nowrap",
      });
      this._compteARebours("Construction", this._startConstruction, this._expConstruction);
    }
    return this;
  }
  /**
   * Met à jour la recherche en cours si elle change.
   *
   * @private
   * @method majRecherche
   */
  majRecherche() {
    if (this._recherche) {
      $("#o_resteRecherche").text(this._recherche).css({
        "max-width": "110px",
        "text-overflow": "ellipsis",
        overflow: "hidden",
        "white-space": "nowrap",
      });
      this._compteARebours("Recherche", this._startRecherche, this._expRecherche);
    }
    return this;
  }
  /**
   * Met à jour les attaques si elles ne correspondent pas.
   *
   * @private
   * @method majAttaque
   */
  majAttaque() {
    if (this._attaque.length) {
      $("#o_resteAttaque").text(this._attaque[0].cible).css({
        "max-width": "110px",
        "text-overflow": "ellipsis",
        overflow: "hidden",
        "white-space": "nowrap",
      });
      // Ajout du title
      let table = "<table>";
      for (let i = 0, l = this._attaque.length; i < l; i++)
        table += `<tr><td class='gras'>${this._attaque[i].cible}</td><td>&nbsp;</td><td>Retour le ${moment(this._attaque[i].exp).add(1, "minute").startOf("minute").format("D MMM YYYY à HH[h]mm")}</td></tr>`;
      table += "</table>";
      $("#boiteComptePlus table tr:eq(4)").attr("title", table);
      this._compteARebours("Attaque", this._startAttaque, this._attaque[0].exp, "_attaque");
    } else {
      $("#o_resteAttaque").text("Aucune attaque");
      Utils.arreterTime("o_tempsAttaque");
      $("#o_tempsAttaque").text("");
      $("#o_progressAttaque").progressbar({ value: 0 }).removeClass("highlight_success");
    }
    return this;
  }
  /**
   * Met à jour les convois si ils ne correspondent pas.
   *
   * @private
   * @method majConvoi
   */
  majConvoi() {
    if (this._convoi.length) {
      $("#o_resteConvoi").text(this._convoi[0].cible).css({
        "max-width": "110px",
        "text-overflow": "ellipsis",
        overflow: "hidden",
        "white-space": "nowrap",
      });
      // Ajout du title
      let table = "<table id='o_titleConvoi'>";
      for (let i = 0, l = this._convoi.length; i < l; i++)
        table += `<tr><td>${this._convoi[i].sens ? "<img src='" + IMG_DOWN + "' alt='reception'/>" : "<img src='" + IMG_UP + "' alt='livraison'/>"}</td><td class='gras'>${this._convoi[i].cible}</td><td>&nbsp;</td><td class="right">${numeral(this._convoi[i].nou).format("0[.]00a")} <img alt="nourritures" src="images/icone/icone_pomme.png" height="17"></td><td class="right">${numeral(this._convoi[i].mat).format("0[.]00a")} <img alt="materiaux" src="images/icone/icone_bois.png" height="17"/></td><td>Retour le ${moment(this._convoi[i].exp).add(1, "minute").startOf("minute").format("D MMM YYYY à HH[h]mm")}</td></tr>`;
      table += "</table>";
      $("#boiteComptePlus table tr:eq(5)").attr("title", table);
      this._compteARebours("Convoi", this._startConvoi, this._convoi[0].exp, "_convoi");
    } else {
      $("#o_resteConvoi").text("Aucun convoi");
      Utils.arreterTime("o_tempsConvoi");
      $("#o_tempsConvoi").text("");
      $("#o_progressConvoi").progressbar({ value: 0 }).removeClass("highlight_success");
    }
    return this;
  }
  /**
   * Met à jour les chasses si elles ne correspondent pas.
   *
   * @private
   * @method majChasse
   */
  majChasse() {
    if (this._chasse.length) {
      // creation du title
      let table = "<table>",
        total = 0;
      for (let i = 0, l = this._chasse.length; i < l; i++) {
        total += this._chasse[i].quantite;
        table += `<tr><td><span class="gras">${numeral(this._chasse[i].quantite).format()}</span> cm²</td><td>Retour le ${moment(this._chasse[i].exp).add(1, "minute").startOf("minute").format("D MMM YYYY à HH[h]mm")}</td></tr>`;
      }
      table += "</table>";
      $("#o_resteChasse")
        .text(numeral(total).format() + " cm²")
        .css({
          "max-width": "110px",
          "text-overflow": "ellipsis",
          overflow: "hidden",
          "white-space": "nowrap",
        });
      // Ajout du title
      $("#boiteComptePlus table tr:eq(3)").attr("title", table);
      this._compteARebours("Chasse", this._startChasse, this._chasse[0].exp, "_chasse");
    } else {
      $("#o_resteChasse").text("Aucune chasse");
      Utils.arreterTime("o_tempsChasse");
      $("#o_tempsChasse").text("");
      $("#boiteComptePlus table tr:eq(3)").attr("title", "");
      $("#o_progressChasse").progressbar({ value: 0 }).removeClass("highlight_success");
    }
    return this;
  }
}
