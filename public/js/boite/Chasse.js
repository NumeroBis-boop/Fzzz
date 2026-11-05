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
      `<div id='o_tabsChasse' class='o_tabs'><ul><li><a href='#o_tabsChasse1'>Analyser</a></li><li><a href='#o_tabsChasse3'>Simuler</a></li><li><a href='#o_tabsChasse4'>Lancer</a></li><li><a href='#o_tabsChasse2'>Bestiaire</a></li></ul><div id='o_tabsChasse1'/><div id='o_tabsChasse3'/><div id='o_tabsChasse4'/><div id='o_tabsChasse2'/></div>`,
    );
    /**
     * Armée et places de chasse libres du joueur, lues à la première ouverture
     * des onglets « Simuler » ou « Lancer » (promesse, partagée par les deux)
     */
    this._reel = null;
    /**
     * Lanceur de l'onglet « Lancer », construit à sa première ouverture
     */
    this._lanceur = null;
    /**
     * Simulateur de l'onglet « Simuler », construit à sa première ouverture
     */
    this._simulateur = false;
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
            let onglet = ui.newPanel.attr("id");
            if (onglet == "o_tabsChasse3") this.ouvrirSimulateur();
            if (onglet == "o_tabsChasse4") this.ouvrirLanceur();
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
   * lues une fois pour les onglets « Simuler » et « Lancer ».
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
    if ($("#o_prepaChasse").length) {
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
        this._lanceur = new LanceurChasse(r.armee, r.places, { cadre: false }).afficher(
          $panneau,
          "append",
        );
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
   * Onglet « Simuler » : une salve tirée au sort avec le modèle du mécanisme
   * de chasse (class/ModeleChasse.js), pour voir la dispersion des pertes et
   * des paliers de réplique, chasse par chasse. L'armée est répartie entre
   * les chasses comme le lanceur le ferait (SimulationChasse.plan, avec la
   * marge de JSN et le rééquilibrage de ses réglages). Préremplie avec
   * l'armée et les niveaux du joueur quand ils ont pu être lus.
   *
   * @private
   * @method ouvrirSimulateur
   */
  ouvrirSimulateur() {
    if (this._simulateur) return this;
    this._simulateur = true;
    let niveau = (n) => Math.max(0, n || 0),
      champ = (id, libelle, valeur, titre = "") =>
        `<tr><td><input id='${id}' value='${valeur}' size='12'${titre ? ` title='${titre}'` : ""}/></td><td class='left'>${libelle}</td></tr>`;
    $("#o_tabsChasse3").css({ "max-height": "70vh", "overflow-y": "auto" }).html(`
        <table id='o_smForm' class='o_maxWidth'>
          <tr><td valign='top'>
            <table id='o_smArmee'>
              <tr class='gras entete'><td>Armée <span id='o_smImporter' class='cursor' title='Importer une armée (texte collé)'>${IMG_COPY}</span></td><td class='left'><a id='o_smMienne' class='cursor souligne small'>la mienne</a></td></tr>
              ${NOM_UNITE.slice(1)
                .map(
                  (nom, i) =>
                    `<tr><td><input name='o_smUnite' data-i='${i}' value='0' size='12'/></td><td class='left'>${nom}</td></tr>`,
                )
                .join("")}
            </table>
          </td><td valign='top'>
            <table id='o_smNiveau'>
              <tr class='gras entete'><td colspan='2'>Niveaux</td></tr>
              ${champ("o_smArmes", "Armes", niveau(monProfil.niveauRecherche[2]))}
              ${champ("o_smBouclier", "Bouclier thoracique", niveau(monProfil.niveauRecherche[1]))}
              <tr class='gras entete'><td colspan='2'>Salve</td></tr>
              ${champ("o_smTdc", "TdC à l'arrivée", niveau(Utils.terrain), "Fixe la difficulté de chaque chasse")}
              ${champ("o_smNombre", "Nombre de chasses", 1)}
              ${champ("o_smTerrain", "Terrain par chasse", Math.max(1, Math.round(niveau(Utils.terrain) / 10)))}
              ${champ("o_smTirages", "Tirages", 200, "Nombre de fois où la salve est tirée au sort")}
              <tr><td colspan='2'><button type='button' id='o_smSimuler' class='o_button f_success'>Simuler</button></td></tr>
            </table>
          </td></tr>
        </table>
        <p class='small'><em>Simulation imparfaite : modèle du mécanisme de chasse reconstruit sur 5 425 tirages du simulateur du jeu, pas le code du jeu. Pertes moyennes à ±3 % près ; les petites chasses (difficulté sous 5 000) s'en écartent davantage. L'armée est répartie entre les chasses comme par le lanceur (marge de JSN et rééquilibrage de ses réglages).</em></p>
        <div id='o_smResultat'></div>`);
    $("#o_smArmee input, #o_smTdc, #o_smTerrain").spinner({ min: 0, numberFormat: "i" });
    $("#o_smArmes, #o_smBouclier").spinner({ min: 0, max: 50, numberFormat: "i" });
    $("#o_smNombre").spinner({ min: 1, max: 20, numberFormat: "i" });
    $("#o_smTirages").spinner({ min: 10, max: 5000, step: 10, numberFormat: "i" });
    let placer = (unites) =>
      $("input[name='o_smUnite']").each((_, elt) =>
        $(elt).spinner("value", unites[$(elt).data("i")] || 0),
      );
    $("#o_smImporter").click(() => {
      ouvrirImportArmee((armee) => placer(armee.unite));
      return false;
    });
    $("#o_smMienne").click(() => {
      this._lireReel().then(
        (r) => placer(r.armee.unite),
        () => $.toast({ ...TOAST_ERROR, text: "Votre armée n'a pas pu être lue." }),
      );
      return false;
    });
    $("#o_smSimuler").click(() => this.simulerSalve());
    // préremplie avec l'armée du joueur quand elle est lisible
    this._lireReel().then(
      (r) => placer(r.armee.unite),
      () => {},
    );
    return this;
  }
  /**
   * Tire la salve de l'onglet « Simuler » et affiche le résultat.
   *
   * @private
   * @method simulerSalve
   */
  simulerSalve() {
    let valeur = (id) => $(id).spinner("value") || 0,
      unites = new Array(14).fill(0);
    $("input[name='o_smUnite']").each((_, elt) => (unites[$(elt).data("i")] = valeur(elt)));
    let reglages = LanceurChasse.reglages(),
      tdc = Math.max(1, valeur("#o_smTdc")),
      p = {
        unites,
        armes: valeur("#o_smArmes"),
        bouclier: valeur("#o_smBouclier"),
        tdcArrivee: tdc,
        tdcLancement: tdc,
        vitesse: 0,
        facteur: reglages.marge,
        reequilibrer: reglages.reequilibrer,
      },
      nombre = Math.max(1, valeur("#o_smNombre")),
      terrain = Math.max(1, valeur("#o_smTerrain")),
      tirages = Math.max(10, valeur("#o_smTirages"));
    if (!unites.some((n) => n > 0)) {
      $("#o_smResultat").html("<p class='o_marginT15 red'>Renseigne une armée.</p>");
      return this;
    }
    let plan = SimulationChasse.plan(p, nombre, terrain),
      resultat = ModeleChasse.salve(
        { tdcArrivee: tdc, terrain, armes: p.armes, bouclier: p.bouclier, chasses: plan.chasses },
        tirages,
      );
    $("#o_smResultat").html(BoiteChasse.htmlSimulation(plan, resultat));
    $("#o_smPaliers tbody tr:even, #o_smPerdues tbody tr:even").css(
      "background-color",
      monProfil.parametre["couleur2"].valeur,
    );
    return this;
  }
  /**
   * Résultat d'une salve simulée : paliers de réplique et pertes par chasse
   * (min, médiane, moyenne, p95, max, en équivalent JSN) face à la table, puis
   * les unités perdues en moyenne et au pire tirage.
   *
   * @static
   * @method htmlSimulation
   * @param {Object} plan SimulationChasse.plan
   * @param {Object} resultat ModeleChasse.salve
   * @return {String}
   */
  static htmlSimulation(plan, resultat) {
    let fmt = (n) => numeral(Math.round(n)).format(),
      pc = (x) => (x > 0 && x < 0.005 ? "<1 %" : `${Math.round(x * 100)} %`),
      stats = (s) =>
        ["min", "mediane", "moyenne", "p95", "max"]
          .map((k) => `<td class='right${k == "moyenne" ? " gras" : ""}'>${fmt(s[k])}</td>`)
          .join(""),
      lignes = resultat.chasses
        .map((c, i) => {
          let ch = plan.chasses[i];
          return `<tr><td>${i + 1}</td><td class='right'>${numeral(ch.ratio).format("0.00")}</td>${[0.1, 0.3, 0.5, 1].map((palier) => `<td class='right'>${pc(c.paliers[palier] || 0)}</td>`).join("")}${stats(c.jsn)}<td class='right'>${fmt(ch.pertes.AVG)}</td><td class='right'>${fmt(ch.pertes.MAX)}</td></tr>`;
        })
        .join(""),
      total =
        resultat.chasses.length > 1
          ? `<tr class='gras'><td>Salve</td><td class='right'>${numeral(plan.ratio).format("0.00")}</td><td colspan='4'></td>${stats(resultat.total.jsn)}<td class='right'>${fmt(plan.pertes.AVG)}</td><td class='right'>${fmt(plan.pertes.MAX)}</td></tr>`
          : "",
      unites = NOM_RAC_UNITE.slice(1)
        .map((nom, u) => ({ nom, u }))
        .filter(({ u }) => resultat.total.perdues[u] > 0 || resultat.total.pire[u] > 0),
      perdues = unites.length
        ? `<div class='centre gras o_marginT15'>Unités perdues par salve</div>
        <table id='o_smPerdues' class='o_maxWidth' cellspacing='0'>
          <thead><tr><th></th>${unites.map(({ nom }) => `<th class='right'>${nom}</th>`).join("")}</tr></thead>
          <tbody>
            <tr><td class='left'>Moyenne</td>${unites.map(({ u }) => `<td class='right'>${numeral(resultat.total.perdues[u]).format("0,0.0")}</td>`).join("")}</tr>
            <tr><td class='left'>Pire tirage</td>${unites.map(({ u }) => `<td class='right'>${fmt(resultat.total.pire[u])}</td>`).join("")}</tr>
          </tbody>
        </table>`
        : "";
    return `
        <p class='o_marginT15'>${plan.nombre} × ${fmt(plan.terrain)} cm², difficulté ${fmt(plan.difficulte)}, ratio <b>${numeral(plan.ratio).format("0.00")}</b> (réf. ${RATIO_CHASSE[plan.indexRef].toFixed(1)}), ${resultat.tirages} tirages.</p>
        <table id='o_smPaliers' class='o_maxWidth' cellspacing='0'>
          <thead>
            <tr><th rowspan='2'>N°</th><th rowspan='2' class='right'>Ratio</th><th colspan='4'>Réplique subie</th><th colspan='5'>Pertes (équivalent JSN)</th><th colspan='2'>Table</th></tr>
            <tr><th class='right'>10 %</th><th class='right'>30 %</th><th class='right'>50 %</th><th class='right'>100 %</th><th class='right'>min</th><th class='right'>méd.</th><th class='right'>moy.</th><th class='right'>p95</th><th class='right'>max</th><th class='right'>moy.</th><th class='right'>max</th></tr>
          </thead>
          <tbody>${lignes}${total}</tbody>
        </table>
        ${perdues}`;
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
