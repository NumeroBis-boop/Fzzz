/*
 * BoiteChasse.js
 * Hraesvelg
 **********************************************************************/

/**
 * Classe permettant d'analyser et lancer des chasses.
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
      `<div id='o_tabsChasse' class='o_tabs'><ul><li><a href='#o_tabsChasse1'>Analyser</a></li><li><a href='#o_tabsChasse4'>Lancer</a></li><li><a href='#o_tabsChasse2'>Bestiaire</a></li></ul><div id='o_tabsChasse1'/><div id='o_tabsChasse4'/><div id='o_tabsChasse2'/></div>`,
    );
    /**
     * Armée et places de chasse libres du joueur, lues à la première ouverture
     * de l'onglet « Lancer » (promesse)
     */
    this._reel = null;
    /**
     * Lanceur de l'onglet « Lancer », construit à sa première ouverture
     */
    this._lanceur = null;
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
            if (ui.newPanel.attr("id") == "o_tabsChasse4") this.ouvrirLanceur();
          },
        })
        .removeClass("ui-widget");
      this.analyse().bestiaire().css().event();
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
   * Armée (Armee.php) et places de chasse libres (Ressources.php) du joueur,
   * lues une fois pour l'onglet « Lancer ».
   *
   * @private
   * @method _lireReel
   * @return {Promise} {armee, places}
   */
  _lireReel() {
    if (!this._reel) {
      let armee = new Armee();
      this._reel = Promise.all([
        armee.getArmee(),
        $.ajax({ url: location.origin + "/Ressources.php" }),
      ]).then(([htmlArmee, htmlRessources]) => {
        armee.chargeData(htmlArmee);
        let enCours =
          Utils.parseHtml(htmlRessources)
            .find("#boite_tdc")
            .text()
            .split(/- Vos chasseuses vont conquérir/g).length - 1;
        return { armee, places: monProfil.niveauRecherche[5] + 1 - enCours };
      });
      // lecture ratée : l'ouverture suivante réessaie
      this._reel.catch(() => (this._reel = null));
    }
    return this._reel;
  }
  /**
   * Onglet « Lancer » : le lanceur de chasses de la page Ressources
   * (class/LanceurChasse.js), sans son encadré, avec l'armée et les places
   * libres lues à la première ouverture. Sur Ressources.php, le lanceur est
   * déjà dans la page.
   *
   * @private
   * @method ouvrirLanceur
   */
  ouvrirLanceur() {
    if (this._lanceur) return this;
    let $panneau = $("#o_tabsChasse4");
    if (/^\/ressources\.php$/i.test(location.pathname)) {
      $panneau.html(
        "<p class='o_marginT15'><em>Le lanceur de chasses est sur cette page, sous le terrain de chasse.</em></p>",
      );
      return this;
    }
    this._lanceur = true;
    $panneau.html("<p class='o_marginT15'><em>Lecture de votre armée…</em></p>");
    this._lireReel().then(
      (r) => {
        $panneau.empty().css({ "max-height": "70vh", "overflow-y": "auto" });
        this._lanceur = new LanceurChasse(r.armee, r.places, {
          cadre: false,
          page: false,
        }).afficher($panneau, "append");
      },
      () => {
        this._lanceur = null;
        $panneau.html(
          "<p class='o_marginT15 red'>Votre armée n'a pas pu être lue : rouvrez l'onglet pour réessayer.</p>",
        );
      },
    );
    return this;
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
