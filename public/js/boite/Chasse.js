/*
 * BoiteChasse.js
 * Hraesvelg
 **********************************************************************/

/**
 * Classe permettant d'analyser simuler et lancer des chasses.
 *
 * @class BoiteChasse
 * @constructor
 * @extends Boite
 */
class BoiteChasse extends Boite {
  constructor() {
    super(
      "o_boiteChasse",
      "Outils pour Chasseur",
      `<div id='o_tabsChasse' class='o_tabs'><ul><li><a href='#o_tabsChasse1'>Analyser</a></li><li><a href='#o_tabsChasse3'>Simuler</a></li><li><a href='#o_tabsChasse2'>Bestiaire</a></li></ul><div id='o_tabsChasse1'/><div id='o_tabsChasse3'/><div id='o_tabsChasse2'/></div>`,
    );
    /**
     * Ce que le joueur a vraiment — armée et places de chasse libres —, chargé à
     * la première ouverture de l'onglet « Simuler », pour remplir l'armée et
     * autoriser un lancement.
     */
    this._reel = null;
    /**
     * Dernière simulation, pour la copie et le lancement
     */
    this._simu = null;
    /**
     * Chasses en cours de lancement : le formulaire est figé pendant ce temps
     */
    this._lancement = false;
  }
  /**
   * Affiche la boite.
   *
   * @private
   * @method afficher
   */
  afficher() {
    if (super.afficher()) {
      $("#o_tabsChasse")
        .tabs({
          activate: (event, ui) => {
            this.css();
            if (ui.newPanel.attr("id") == "o_tabsChasse3" && !this._reel) this._chargerEtatReel();
          },
        })
        .removeClass("ui-widget");
      this.analyse().simuler().bestiaire().css().event();
    }
  }
  /**
   * Applique le style propre à la boite.
   *
   * @private
   * @method css
   */
  css() {
    super.css();
    $(
      "#o_resultatChasse tr:even, .o_tabs .ui-widget-header .ui-tabs-anchor, #o_bestiaireTable tr:even, #o_scDetails tr:even, #o_scPertes tr:even, #o_scRepartition tr:even, #o_scAutresTdc tr:even",
    ).css("background-color", monProfil.parametre["couleur2"].valeur);
    this.cssOnglets();
    return this;
  }
  /**
   * Ajoute les evenements propres à la boite.
   *
   * @private
   * @method event
   */
  event() {
    super.event();
    return this;
  }
  /**
   * Formulaire pour analyser une ou plusieurs chasse(s).
   *
   * @private
   * @method analyse
   */
  analyse() {
    $("#o_tabsChasse1").append(
      "<textarea id='o_rcChasse' class='o_maxWidth' placeholder='Rapport(s) de chasse(s)...'></textarea><div class='o_marginT15'><table  id='o_resultatChasse' class='o_maxWidth'></table></div>",
    );

    $("#o_rcChasse").on("input", (e) => {
      // on recup les chasses à analyser
      let chasses = e.currentTarget.value.split("nourriture"),
        bilan = new Chasse(""),
        chasse = null,
        erreur = false,
        html =
          "<tr class='gras'><td colspan='2'>Avant</td><td colspan='2'>Evolution</td><td colspan='2'>Résultat</td></tr>";
      // on nettoie l'ancien affichage
      $("#o_resultatChasse").html("");
      for (let i = 0; i < chasses.length; i++) {
        if (chasses[i]) {
          chasse = new Chasse(chasses[i]);
          let analyse = false;
          // rapport tronqué ou atypique : l'analyse lève une exception
          try {
            analyse = chasse.analyse();
          } catch (err) {
            analyse = false;
          }
          if (analyse) {
            html += chasse.toHTMLBoite(false);
            bilan.ajoute(chasse);
          } else {
            $.toast({ ...TOAST_WARNING, text: "Le rapport de chasse ne peut pas être analysé." });
            erreur = true;
          }
        }
      }
      if (!erreur) {
        $("#o_resultatChasse").append(html);
        this.afficherBilan(bilan);
      }
    });
    return this;
  }
  /**
   * Affiche les données issue d'un rapport de chasse.
   *
   * @private
   * @method afficherAnalyse
   * @param {Object} chasse
   * @param {Boolean} bilan
   */
  afficherBilan(chasse) {
    let i = 0,
      html = "<tr><td colspan='6'><select id='o_choixChasse' class='o_marginT15'>";
    for (
      ;
      i < Math.floor($("#o_resultatChasse tr").length / 4);
      html += "<option value='" + i + "'>Chasse " + (i + 1) + "</option>", i++
    );
    html += "<option value='" + i + "' selected>Bilan</option></select></td></tr>";
    $("#o_resultatChasse").append(chasse.toHTMLBoite(true) + html);
    // Style
    $("#o_resultatChasse tr:even").css("background-color", monProfil.parametre["couleur2"].valeur);
    $("#o_choixChasse").change((e) => {
      let selection = e.currentTarget.value;
      $("#o_resultatChasse tr:gt(0):lt(-1):visible").toggle();
      $(
        "#o_resultatChasse tr:eq(" +
          (selection * 4 + 1) +
          "), #o_resultatChasse tr:eq(" +
          (selection * 4 + 2) +
          "), #o_resultatChasse tr:eq(" +
          (selection * 4 + 3) +
          "), #o_resultatChasse tr:eq(" +
          (selection * 4 + 4) +
          ")",
      ).toggle();
    });
  }
  /**
   * Onglet « Simuler » — le simulateur de chasse du lanceur (Ressources.php),
   * alimenté par l'armée, les niveaux et le terrain que le joueur saisit.
   * Simulateur de Calystene 2.00.38, cf. class/SimulationChasse.js.
   *
   * @private
   * @method simuler
   */
  simuler() {
    let niveau = (id, label, valeur) =>
        `<tr><td><input id="${id}" value="${valeur}" size="6"/></td><td class="left">${label}</td></tr>`,
      unites = NOM_UNITE.slice(1)
        .map(
          (nom, i) =>
            `<tr><td><input name="o_scUnite${i}" value="0" size="12"/></td><td class="left">${nom}</td></tr>`,
        )
        .join(""),
      ratios = RATIO_CHASSE.map(
        (r, i) =>
          `<option value="${r}" class="${this._classeRatio(r)}"${i == 9 ? " selected" : ""}>${r.toFixed(1)}</option>`,
      ).join("");
    $("#o_tabsChasse3").append(`
        <table id="o_scForm" class="o_maxWidth">
          <tr><td valign="top">
            <table id="o_scArmee">
              <tr class="gras entete"><td><span id="o_scPlacement" class="cursor" title="Remplir avec votre armée, ou vider">${IMG_FLECHE} Armée ${IMG_FLECHE}</span> <span id="o_scCopier" class="cursor" title="Importer une armée">${IMG_COPY}</span></td><td></td></tr>
              ${unites}
              <tr><td id="o_scAttaque" class="right">0</td><td class="left">${IMG_ATT} Attaque avec Armes</td></tr>
            </table>
          </td><td valign="top">
            <table id="o_scNiveau">
              <tr class="gras entete"><td colspan="2" id="o_scNiveauJoueur" class="cursor" title="Vos niveaux, ou 0">${IMG_FLECHE} Niveaux ${IMG_FLECHE}</td></tr>
              ${niveau("o_scArmes", "Armes", monProfil.niveauRecherche[2])}
              ${niveau("o_scBouclier", "Bouclier thoracique", monProfil.niveauRecherche[1])}
              ${niveau("o_scVitesse", "Vitesse de chasse", monProfil.niveauRecherche[5])}
              <tr class="gras entete"><td colspan="2" class="cursor" id="o_scPonteJoueur" title="Ne sert qu'à convertir les pertes en temps de ponte">${IMG_FLECHE} Ponte (facultatif) ${IMG_FLECHE}</td></tr>
              ${niveau("o_scCouveuse", "Couveuse", monProfil.niveauConstruction[3])}
              ${niveau("o_scSolarium", "Solarium", monProfil.niveauConstruction[4])}
              ${niveau("o_scPonte", "Technique de ponte", monProfil.niveauRecherche[0])}
              <tr class="gras entete"><td colspan="2">Chasse</td></tr>
              <tr><td><input id="o_scTdcLancement" value="${Utils.terrain || 0}" size="14" title="Fixe la durée des chasses"/></td><td class="left">TdC au lancement</td></tr>
              <tr><td><input id="o_scTdcArrivee" value="${Utils.terrain || 0}" size="14" title="Fixe la difficulté des chasses : à modifier si votre TdC doit bouger pendant la chasse (flood…)"/></td><td class="left">TdC à l'arrivée</td></tr>
              <tr><td colspan="2"><select id="o_scRatio" class="o_maxWidth" title="Ratio = attaque de votre armée / difficulté de la chasse. Plus il est faible, plus la chasse est risquée.">${ratios}</select></td></tr>
              <tr><td><input id="o_scNombre" value="1" size="14"/></td><td class="left">Nombre de chasses <input id="o_scNombreAuto" type="checkbox" checked/><label for="o_scNombreAuto">Auto</label></td></tr>
              <tr><td><input id="o_scTdcChasse" value="1" size="14"/></td><td class="left">TdC par chasse <input id="o_scTdcChasseAuto" type="checkbox" checked/><label for="o_scTdcChasseAuto">Auto</label></td></tr>
              <tr><td><input id="o_scRetour" value="" size="14" placeholder="JJ-MM-AAAA HH:mm" title="Calcule le TdC par chasse pour rentrer à cette heure, en partant maintenant"/></td><td class="left">Retour souhaité <button type="button" id="o_scRetourAppliquer" disabled>Appliquer</button></td></tr>
              <tr><td colspan="2" id="o_scRetourInfo" class="left reduce"></td></tr>
            </table>
          </td></tr>
        </table>
        <div id="o_scResultat"></div>
        <p class="reduce"><em>Basé sur le simulateur de chasse de <a href="http://alliancead2.free.fr" target="_blank" rel="noopener">Calystene</a> (rév. 2.00.38).</em></p>`);
    $("#o_tabsChasse3").css({ "max-height": "70vh", "overflow-y": "auto" });
    $("#o_scArmee input, #o_scTdcLancement, #o_scTdcArrivee").spinner({
      min: 0,
      numberFormat: "i",
    });
    $("#o_scNombre, #o_scTdcChasse").spinner({ min: 1, numberFormat: "i", disabled: true });
    $("#o_scArmes, #o_scBouclier, #o_scVitesse, #o_scCouveuse, #o_scSolarium, #o_scPonte").spinner({
      min: 0,
      max: 50,
      numberFormat: "d2",
    });
    $("#o_scRetour").datetimepicker({
      ...DATEPICKER_OPTION,
      dateFormat: "dd-mm-yy",
      timeFormat: "HH:mm",
      timeText: "Horaire",
      hourText: "Heure",
      minuteText: "Minute",
      minDate: 0,
    });
    return this.evenementsSimulateur().actualiserSimulation();
  }
  /**
   * Événements de l'onglet « Simuler ».
   *
   * @private
   * @method evenementsSimulateur
   */
  evenementsSimulateur() {
    $("#o_scForm input.ui-spinner-input").on("input spin", (e, ui) => {
      let valeur = numeral(ui ? ui.value : e.currentTarget.value).value() || 0;
      $(e.currentTarget).spinner("value", valeur);
      this.actualiserSimulation();
    });
    $("#o_scRatio").change(() => this.actualiserSimulation());
    $("#o_scNombreAuto, #o_scTdcChasseAuto").click((e) => {
      let input = e.currentTarget.id == "o_scNombreAuto" ? "#o_scNombre" : "#o_scTdcChasse";
      $(input).spinner($(e.currentTarget).is(":checked") ? "disable" : "enable");
      this.actualiserSimulation();
    });
    $("#o_scPlacement").click(() => {
      if (this._reel) this._placerArmee();
      else this._chargerEtatReel().then(() => this._reel && this._placerArmee());
      return false;
    });
    $("#o_scCopier").click(() => {
      ouvrirImportArmee((armee) => this._setArmee(armee.unite));
      return false;
    });
    $("#o_scRetour").on("change", () => this._actualiserDateRetour());
    $("#o_scRetourAppliquer").click(() => {
      let terrain = $("#o_scRetour").data("tdc");
      if (!terrain) return false;
      $("#o_scTdcChasseAuto").prop("checked", false);
      $("#o_scTdcChasse").spinner("enable").spinner("value", terrain);
      this.actualiserSimulation();
      return false;
    });
    // bascule entre les niveaux du joueur et 0, comme le simulateur de combat
    let basculer = (ids, valeurs) => {
      let miens = ids.every((id, i) => $(id).spinner("value") == valeurs[i]);
      ids.forEach((id, i) => $(id).spinner("value", miens ? 0 : valeurs[i]));
      this.actualiserSimulation();
      return false;
    };
    $("#o_scNiveauJoueur").click(() =>
      basculer(
        ["#o_scArmes", "#o_scBouclier", "#o_scVitesse"],
        [2, 1, 5].map((i) => monProfil.niveauRecherche[i]),
      ),
    );
    $("#o_scPonteJoueur").click(() =>
      basculer(
        ["#o_scCouveuse", "#o_scSolarium", "#o_scPonte"],
        [
          monProfil.niveauConstruction[3],
          monProfil.niveauConstruction[4],
          monProfil.niveauRecherche[0],
        ],
      ),
    );
    $("#o_scResultat").on("click", "#o_scAutresTdcToggle", () => {
      $("#o_scAutresTdc").toggle();
      let fleche = $("#o_scAutresTdc").is(":visible") ? "▲" : "▼";
      $("#o_scAutresTdcToggle").text(`${fleche} Pertes selon le TdC à l'arrivée ${fleche}`);
    });
    $("#o_scResultat").on("click", "#o_scCopierDonnees", () => this._copierSimulation());
    $("#o_scResultat").on("click", "#o_scLancer", () => this._lancer());
    return this;
  }
  /**
   * Remplit l'armée avec celle du joueur, ou la vide si elle y est déjà.
   *
   * @private
   * @method _placerArmee
   */
  _placerArmee() {
    let actuelle = $("#o_scArmee input")
        .map((i, elt) => $(elt).spinner("value"))
        .get(),
      armee = this._reel.armee.unite,
      mienne = armee.every((n, i) => n == actuelle[i]);
    this._setArmee(mienne ? new Array(14).fill(0) : armee);
  }
  /**
   * @private
   * @method _setArmee
   */
  _setArmee(unites) {
    $("#o_scArmee input").each((i, elt) => {
      $(elt).spinner("value", unites[i] || 0);
    });
    this.actualiserSimulation();
  }
  /**
   * Couleur d'un ratio, comme dans le lanceur.
   *
   * @private
   * @method _classeRatio
   */
  _classeRatio(ratio) {
    return ratio <= 4 ? "black" : ratio <= 6 ? "red" : ratio <= 7.5 ? "orange" : "green";
  }
  /**
   * Lit le formulaire, lance le simulateur et affiche le résultat.
   *
   * @private
   * @method actualiserSimulation
   */
  actualiserSimulation() {
    // un lancement est en cours sur la répartition affichée : on n'y touche pas
    if (this._lancement) return this;
    let val = (id) => $(id).spinner("value") || 0,
      unites = $("#o_scArmee input")
        .map((i, elt) => $(elt).spinner("value") || 0)
        .get(),
      autoNombre = $("#o_scNombreAuto").is(":checked"),
      autoTerrain = $("#o_scTdcChasseAuto").is(":checked"),
      vitesse = val("#o_scVitesse"),
      p = {
        unites: unites,
        armes: val("#o_scArmes"),
        bouclier: val("#o_scBouclier"),
        tdcLancement: val("#o_scTdcLancement"),
        tdcArrivee: val("#o_scTdcArrivee"),
        ratio: parseFloat($("#o_scRatio").val()),
        nombreMax: vitesse + 1,
      };
    $("#o_scAttaque").text(
      numeral(Math.round(SimulationChasse.attaqueArmee(unites, p.armes))).format(),
    );
    this._actualiserDateRetour();
    // ce que donnerait chaque ratio, dans la liste
    SimulationChasse.apercusRatios(p).forEach((a, i) => {
      let texte = `${RATIO_CHASSE[i].toFixed(1)} → Rép. 10 % : ${Math.round(REPLIQUE_CHASSE[i] * 100)} %`;
      if (a)
        texte += ` · Pertes moy. ${numeral(Math.round(a.pertes.AVG)).format()} JSN · ${a.nombre} × ${numeral(a.terrain).format()} cm²`;
      $(`#o_scRatio option:eq(${i})`).text(texte);
    });
    if (!unites.some((n) => n > 0) || !p.tdcArrivee) {
      this._simu = null;
      $("#o_scResultat").html(
        `<p class="o_marginT15"><em>Renseignez une armée et votre TdC pour lancer la simulation.</em></p>`,
      );
      return this;
    }
    let simu = SimulationChasse.simuler({
      ...p,
      nombreFixe: autoNombre ? 0 : val("#o_scNombre"),
      terrainFixe: autoTerrain ? 0 : val("#o_scTdcChasse"),
    });
    if (autoNombre) $("#o_scNombre").spinner("value", simu.nombre);
    if (autoTerrain) $("#o_scTdcChasse").spinner("value", simu.terrain);
    // la liste suit le ratio de référence réellement atteint
    $("#o_scRatio")
      .val(String(RATIO_CHASSE[simu.indexRef]))
      .css("color", this._classeRatio(RATIO_CHASSE[simu.indexRef]));
    let duree = SimulationChasse.duree(p.tdcLancement, simu.terrain, vitesse),
      niveauPonte = val("#o_scCouveuse") + val("#o_scSolarium") + val("#o_scPonte");
    this._simu = { ...simu, p, vitesse, duree, niveauPonte };
    $("#o_scResultat").html(
      this._htmlDetails() +
        this._htmlRepartition() +
        this._htmlAutresTdc() +
        `<div class="o_marginT15"><button type="button" id="o_scLancer" class="o_button f_success" disabled>Lancer les chasses</button>
        <button type="button" id="o_scCopierDonnees" class="o_button">Copier le résumé</button></div>
        <p id="o_scLancerInfo" class="reduce"></p>`,
    );
    this._actualiserEtatLancement();
    $(
      "#o_scDetails tr:even, #o_scPertes tr:even, #o_scRepartition tr:even, #o_scAutresTdc tr:even",
    ).css("background-color", monProfil.parametre["couleur2"].valeur);
    return this;
  }
  /**
   * Récapitulatif et estimation des pertes de la dernière simulation.
   *
   * @private
   * @method _htmlDetails
   */
  _htmlDetails() {
    let s = this._simu,
      total = s.nombre * s.terrain,
      retour = Utils.roundMinute(s.duree).format("dddd D MMM YYYY [à] HH[h]mm"),
      lignePertes = (label, f) =>
        `<tr><td class="left">${label}</td>${["MIN", "AVG", "MAX"].map((k) => `<td class="right${k == "AVG" ? " gras" : ""}">${f(s.pertes[k])}</td>`).join("")}</tr>`,
      tempsPonte = (pertes) => Math.round(pertes * TEMPS_UNITE[1] * Math.pow(0.9, s.niveauPonte));
    return `
        <hr class="o_scSepar"/>
        <table id="o_scDetails" class="o_maxWidth o_marginT15" cellspacing="0">
          <tr><td class="left">TdC total chassé</td><td class="right green">${numeral(total).format()} cm²</td><td class="left">Découpage</td><td class="right">${s.nombre} × ${numeral(s.terrain).format()} cm²</td></tr>
          <tr><td class="left">Durée</td><td class="right">${Utils.intToTime(s.duree)}</td><td class="left">Retour</td><td class="right">${retour.charAt(0).toUpperCase() + retour.slice(1)}</td></tr>
          <tr><td class="left">Rentabilité</td><td class="right">${numeral(Math.round((total / s.duree) * 86400)).format()} cm² / jour</td><td class="left">Nourriture récoltée</td><td class="right">${numeral(Math.round(s.difficulte * 0.8)).format()}</td></tr>
          <tr><td class="left">Ratio réel</td><td class="right">${numeral(s.ratio).format("0.00")}</td><td class="left" title="Le ratio de la liste juste en dessous du ratio réel : c'est lui qui sert aux estimations de pertes">Ratio de référence</td><td class="right ${this._classeRatio(RATIO_CHASSE[s.indexRef])}">${RATIO_CHASSE[s.indexRef].toFixed(1)}</td></tr>
          <tr><td class="left">Difficulté</td><td class="right">${numeral(Math.round(s.difficulte)).format()}</td><td class="left">Réplique à 10 %</td><td class="right">${Math.round(REPLIQUE_CHASSE[s.indexRef] * 100)} %</td></tr>
        </table>
        <div class="centre gras o_marginT15">Estimation des pertes</div>
        <table id="o_scPertes" class="o_maxWidth" cellspacing="0">
          <thead><tr><th></th><th class="right">Min</th><th class="right">Moyenne</th><th class="right">Max</th></tr></thead>
          <tbody>
            ${lignePertes("JSN tuées", (l) => numeral(Math.round(l)).format())}
            ${lignePertes("Temps de ponte", (l) => Utils.intToTime(tempsPonte(l)))}
            ${lignePertes("Part de la durée de chasse", (l) => numeral((tempsPonte(l) / s.duree) * 100).format("0.00") + " %")}
            <tr class="reduce"><td colspan="4"><em>Pertes en JSN, Bouclier compris, tirées de milliers de chasses du simulateur Compte+.</em></td></tr>
          </tbody>
        </table>`;
  }
  /**
   * Répartition des unités par chasse de la dernière simulation.
   *
   * @private
   * @method _htmlRepartition
   */
  _htmlRepartition() {
    let s = this._simu,
      utilisees = s.p.unites.map((n) => n > 0),
      somme = (f) => s.chasses.reduce((acc, c) => acc + f(c), 0),
      fmt = (n) => numeral(Math.round(n)).format(),
      entete = NOM_RAC_UNITE.slice(1)
        .map((nom, u) => (utilisees[u] ? `<th class="right">${nom}</th>` : ""))
        .join(""),
      lignes = s.chasses
        .map(
          (c, i) =>
            `<tr><td>${i + 1}</td>${c.unites.map((n, u) => (utilisees[u] ? `<td class="right">${n ? fmt(n) : ""}</td>` : "")).join("")}<td class="right">${fmt(c.pertes.AVG)}</td><td class="right">${fmt(c.pertes.MAX)}</td><td class="right">${fmt(c.difficulte)}</td><td class="right">${fmt(c.att)}</td><td class="right">${numeral(c.ratio).format("0.00")}</td></tr>`,
        )
        .join(""),
      attTotale = somme((c) => c.att);
    return `
        <div class="centre gras o_marginT15">Répartition des unités</div>
        <div class="o_scDefile">
        <table id="o_scRepartition" class="o_maxWidth" cellspacing="0">
          <thead><tr><th>N°</th>${entete}<th class="right">Pertes moy.</th><th class="right">Pertes max</th><th class="right">Difficulté</th><th class="right">Attaque</th><th class="right">Ratio</th></tr></thead>
          <tbody>${lignes}
            <tr class="gras"><td>Total</td>${utilisees.map((u, i) => (u ? `<td class="right">${fmt(somme((c) => c.unites[i]))}</td>` : "")).join("")}<td class="right">${fmt(s.pertes.AVG)}</td><td class="right">${fmt(s.pertes.MAX)}</td><td class="right">${fmt(s.difficulte)}</td><td class="right">${fmt(attTotale)}</td><td class="right">${numeral(attTotale / s.difficulte).format("0.00")}</td></tr>
          </tbody>
        </table>
        </div>`;
  }
  /**
   * Pertes de la dernière simulation si le TdC à l'arrivée des chasses diffère
   * de celui prévu.
   *
   * @private
   * @method _htmlAutresTdc
   */
  _htmlAutresTdc() {
    let s = this._simu,
      fmt = (n) => numeral(Math.round(n)).format(),
      lignes = [
        s.p.tdcArrivee,
        1000000,
        5000000,
        10000000,
        15000000,
        20000000,
        30000000,
        40000000,
        50000000,
        75000000,
        100000000,
      ]
        .map((tdc, i) => {
          let a = SimulationChasse.pertesAutreTdc(
              s.attArmee,
              s.p.tdcArrivee,
              tdc,
              s.terrain,
              s.nombre,
              s.indexRef,
              s.p.bouclier,
            ),
            v = s.pertes.AVG > 0 ? ((a.AVG - s.pertes.AVG) / s.pertes.AVG) * 100 : 0,
            cls = v > 0.5 ? "red" : v < -0.5 ? "green" : "";
          return `<tr${i ? "" : ' class="gras"'}><td class="left">${fmt(tdc)} cm²${i ? "" : ' <span class="small">(prévu)</span>'}</td><td class="right">${fmt(a.MIN)}</td><td class="right">${fmt(a.AVG)}</td><td class="right">${fmt(a.MAX)}</td><td class="right">${i ? `<span class="${cls}">${v >= 0 ? "+" : ""}${v.toFixed(1)} %</span>` : "—"}</td><td class="right">${numeral(a.ratio).format("0.00")}</td></tr>`;
        })
        .join("");
    return `
        <div class="o_marginT15"><a id="o_scAutresTdcToggle" class="cursor souligne">▼ Pertes selon le TdC à l'arrivée ▼</a></div>
        <table id="o_scAutresTdc" class="o_maxWidth o_marginT15" cellspacing="0" style="display:none">
          <thead><tr><th class="left">TdC à l'arrivée</th><th class="right">Pertes min</th><th class="right">Pertes moy.</th><th class="right">Pertes max</th><th class="right">Variation moy.</th><th class="right">Ratio</th></tr></thead>
          <tbody>${lignes}
            <tr class="reduce"><td colspan="6"><em>Les armées restent celles de la répartition : ce sont les premières chasses qui souffrent le plus d'une hausse du TdC.</em></td></tr>
          </tbody>
        </table>`;
  }
  /**
   * Copie un résumé texte de la dernière simulation (gras BBCode pour le
   * forum), comme le bouton de copie de la 2.00.38 de Calystene.
   *
   * @private
   * @method _copierSimulation
   */
  _copierSimulation() {
    let s = this._simu;
    if (!s) return;
    let fmt = (n) => numeral(Math.round(n)).format(),
      retour = Utils.roundMinute(s.duree).format("dddd D MMM YYYY [à] HH[h]mm"),
      texte =
        `TdC total chassé : ${fmt(s.nombre * s.terrain)} cm² (${s.nombre} × ${fmt(s.terrain)} cm²)\n` +
        `Durée : ${Utils.intToTime(s.duree)}, retour ${retour}\n` +
        `Rentabilité : ${fmt(((s.nombre * s.terrain) / s.duree) * 86400)} cm² / jour\n\n` +
        `TdC au lancement : ${fmt(s.p.tdcLancement)} cm²\nTdC à l'arrivée : ${fmt(s.p.tdcArrivee)} cm²\n\n` +
        `Ratio réel : ${numeral(s.ratio).format("0.00")} (référence ${RATIO_CHASSE[s.indexRef].toFixed(1)})\n` +
        `Difficulté : ${fmt(s.difficulte)}, nourriture récoltée : ${fmt(s.difficulte * 0.8)}\n\n` +
        `Estimation des pertes min / [b] moy [/b] / max : ${fmt(s.pertes.MIN)} / [b] ${fmt(s.pertes.AVG)} [/b] / ${fmt(s.pertes.MAX)} JSN\n`,
      ok = () => $.toast({ ...TOAST_SUCCESS, text: "Résumé copié." }),
      secours = () => {
        // navigator.clipboard n'existe que sur les pages https, et la plupart des serveurs sont en http
        let zone = $("<textarea/>")
          .val(texte)
          .css({ position: "fixed", opacity: 0 })
          .appendTo("body");
        zone[0].select();
        let reussi = document.execCommand("copy");
        zone.remove();
        reussi ? ok() : $.toast({ ...TOAST_ERROR, text: "La copie a échoué." });
      };
    if (navigator.clipboard) navigator.clipboard.writeText(texte).then(ok, secours);
    else secours();
  }
  /**
   * Récupère ce que le joueur a vraiment : l'armée (Armee.php) et les places de
   * chasse libres (Vitesse de chasse + 1, moins les chasses de Ressources.php).
   *
   * @private
   * @method _chargerEtatReel
   * @return {Promise}
   */
  _chargerEtatReel() {
    let armee = new Armee();
    return Promise.all([armee.getArmee(), $.ajax({ url: location.origin + "/Ressources.php" })])
      .then(([htmlArmee, htmlRessources]) => {
        armee.chargeData(htmlArmee);
        let enCours =
          Utils.parseHtml(htmlRessources)
            .find("#boite_tdc")
            .text()
            .split(/- Vos chasseuses vont conquérir/g).length - 1;
        this._reel = { armee, places: monProfil.niveauRecherche[5] + 1 - enCours };
        this._reelErreur = false;
        this._actualiserEtatLancement();
      })
      .catch(() => {
        // lecture impossible : le lancement reste bloqué, avec la raison
        this._reelErreur = true;
        this._actualiserEtatLancement();
      });
  }
  /**
   * Terrain par chasse qui fait rentrer les chasses à l'heure demandée si elles
   * partent maintenant (Calystene 2.00.33, même calcul que le lanceur).
   *
   * @private
   * @method _actualiserDateRetour
   */
  _actualiserDateRetour() {
    let brut = String($("#o_scRetour").val() || ""),
      facteur = Math.pow(0.9, $("#o_scVitesse").spinner("value") || 0),
      tdcLancement = $("#o_scTdcLancement").spinner("value") || 0,
      afficher = (html, terrain = 0) => {
        $("#o_scRetour").data("tdc", terrain);
        $("#o_scRetourInfo").html(html);
        $("#o_scRetourAppliquer").prop("disabled", !terrain);
      };
    if (!brut) return afficher("");
    let cible = moment(brut, "DD-MM-YYYY HH:mm");
    if (!cible.isValid()) return afficher("<span class='red'>Date non valide.</span>");
    // même une chasse de 1 cm² dure le temps du TdC de lancement
    let auPlusTot = moment().add(Math.ceil((tdcLancement + 1) * facteur), "s"),
      terrain = Math.floor(cible.diff(moment(), "s") / facteur - tdcLancement);
    if (terrain < 1)
      return afficher(
        `<span class='red'>Pas de retour possible avant le ${auPlusTot.format("DD/MM [à] HH[h]mm")}.</span>`,
      );
    afficher(
      `→ TdC par chasse : <span class='gras'>${numeral(terrain).format()} cm²</span>`,
      terrain,
    );
  }
  /**
   * Ce qui empêche de lancer la simulation affichée telle quelle : l'armée et
   * les niveaux saisis doivent être ceux du joueur, et les chasses doivent
   * tenir dans les places libres. Le TdC à l'arrivée reste libre (prévoir un flood).
   *
   * @private
   * @method _blocagesLancement
   * @return {Array} raisons, vide si le lancement est possible
   */
  _blocagesLancement() {
    let s = this._simu,
      r = this._reel,
      fmt = (n) => numeral(n).format(),
      raisons = [];
    if (!r)
      return [
        this._reelErreur
          ? "Votre armée n'a pas pu être lue : rouvrez l'onglet Simuler pour réessayer."
          : "Chargement de votre armée…",
      ];
    s.p.unites.forEach((n, u) => {
      if (n > r.armee.unite[u])
        raisons.push(
          `${NOM_UNITES[u + 1]} : ${fmt(n)} saisies, vous en avez ${fmt(r.armee.unite[u])}.`,
        );
    });
    [
      ["Armes", s.p.armes, monProfil.niveauRecherche[2]],
      ["Bouclier thoracique", s.p.bouclier, monProfil.niveauRecherche[1]],
      ["Vitesse de chasse", s.vitesse, monProfil.niveauRecherche[5]],
    ].forEach(([nom, saisi, mien]) => {
      if (saisi != mien) raisons.push(`${nom} : niveau ${saisi} saisi, le vôtre est ${mien}.`);
    });
    if (s.p.tdcLancement != Utils.terrain)
      raisons.push(
        `TdC au lancement : ${fmt(s.p.tdcLancement)} saisi, votre terrain est de ${fmt(Utils.terrain)}.`,
      );
    if (r.places <= 0) raisons.push("Aucune chasse possible : toutes vos places sont prises.");
    else if (s.nombre > r.places)
      raisons.push(
        `Il ne vous reste que ${r.places} chasse${r.places > 1 ? "s" : ""} possible${r.places > 1 ? "s" : ""}.`,
      );
    return raisons;
  }
  /**
   * Active le bouton de lancement, ou liste ce qui l'empêche.
   *
   * @private
   * @method _actualiserEtatLancement
   */
  _actualiserEtatLancement() {
    if (!this._simu || this._lancement) return;
    let raisons = this._blocagesLancement();
    $("#o_scLancer").prop("disabled", raisons.length > 0);
    $("#o_scLancerInfo").html(
      raisons.length
        ? `<span class="red">${raisons.join("<br/>")}</span>`
        : "<em>Une chasse part toutes les 2 secondes : restez sur la page pendant le lancement.</em>",
    );
  }
  /**
   * Lance les chasses affichées, une toutes les 2 secondes, et s'arrête à la
   * première que le jeu refuse.
   *
   * @private
   * @method _lancer
   */
  _lancer() {
    let s = this._simu;
    if (!s || this._lancement || this._blocagesLancement().length) return;
    if (
      !confirm(
        `Lancer ${s.nombre} chasse${s.nombre > 1 ? "s" : ""} de ${numeral(s.terrain).format()} cm² ?`,
      )
    )
      return;
    this._lancement = true;
    $("#o_scLancer").prop("disabled", true);
    $("#o_scForm").css({ opacity: 0.6, "pointer-events": "none" });
    $("#o_scLancerInfo").html("<em>Lancement en cours, restez sur la page…</em>");
    // chaque chasse relit un jeton neuf (Armee.posterChasse)
    this._envoyerChasse(s, 0);
  }
  /**
   * @private
   * @method _envoyerChasse
   */
  _envoyerChasse(s, i) {
    if (i >= s.nombre) return this._finLancement(i, s.nombre);
    let marquer = (ok) => {
      if (ok) TroupesDehors.enregistrerChasse(s.chasses[i].unites);
      $(`#o_scRepartition tbody tr:eq(${i})`)
        .addClass(ok ? "green" : "red")
        .find("td:first")
        .text(`${ok ? "✓" : "✗"} ${i + 1}`);
      if (ok) setTimeout(() => this._envoyerChasse(s, i + 1), 2000);
      else this._finLancement(i, s.nombre);
    };
    Armee.posterChasse(s.terrain, s.chasses[i].unites).then((data) =>
      marquer(data.indexOf("La chasse est lancée.") > -1),
    );
  }
  /**
   * Fin d'un lancement : bilan, puis rechargement de ce que le joueur a, puisque
   * l'armée est partie. Sur Ressources.php c'est la page qui est rechargée.
   *
   * @private
   * @method _finLancement
   */
  _finLancement(lancees, nombre) {
    if (lancees == nombre)
      $.toast({
        ...TOAST_SUCCESS,
        text: `${nombre} chasse${nombre > 1 ? "s lancées" : " lancée"}.`,
      });
    else
      $.toast({
        ...TOAST_ERROR,
        text: `${lancees} chasse${lancees > 1 ? "s lancées" : " lancée"} sur ${nombre} : le jeu a refusé la suivante.`,
      });
    if (location.pathname == "/Ressources.php") return location.reload();
    this._lancement = false;
    $("#o_scForm").css({ opacity: "", "pointer-events": "" });
    this._chargerEtatReel();
  }
  /**
   * Onglet "Bestiaire" — liste des 17 espèces de faune avec image et stats.
   * Source de la table : http://alliancead2.free.fr/Bestiaire.html (constants
   * FAUNE dans content.js, images bundlées dans public/images/faune/).
   *
   * @private
   * @method bestiaire
   */
  bestiaire() {
    let rows = FAUNE.map(
      (f) =>
        `<tr><td><img src="${chrome.runtime.getURL("images/faune/" + f.slug + ".png")}" height="32" alt="${f.nom}"/></td><td class="left">${f.nom}</td><td class="right">${numeral(f.fdf).format()}</td><td class="right">${numeral(f.vie).format()}</td><td class="right">${numeral(f.diff).format()}</td></tr>`,
    ).join("");
    $("#o_tabsChasse2").append(`
        <table id="o_bestiaireTable" class="o_maxWidth centre" cellspacing="0">
            <thead><tr><th></th><th>Espèce</th><th class="right">FdF</th><th class="right">Vie</th><th class="right">Difficulté</th></tr></thead>
            <tbody>${rows}</tbody>
            <tfoot><tr><td colspan="5" class="reduce"><em>Stats issues du <a href="http://alliancead2.free.fr/Bestiaire.html" target="_blank">Bestiaire</a> de Calystène (2017).</em></td></tr></tfoot>
        </table>`);
    return this;
  }
}
