/*
 * Alliance.js
 * Hraesvelg
 **********************************************************************/

/** Vitesse d'attaque du fichier Excel de la Carte (choix du mainteneur), modifiable dans le fichier. */
const VITESSE_EXPORT_TRAJETS = 10;
/**
 * Couleurs au choix des lignes de la Carte (ton alliance, joueurs et alliances
 * ajoutés), la première libre proposée à l'ajout. Écart deux à deux au moins 15
 * en vision normale (OKLab ×100, validateur de la méthode dataviz), sauf
 * l'orange (demandé par le mainteneur), à 11 du rouge (la couleur des membres
 * par défaut) : la forme et le nom des points les distinguent. Jaune (trop pâle
 * sur le blanc, comme l'orange), turquoise (comme le bleu) et marron (comme le
 * gris) écartés.
 */
const COULEURS_CARTE = [
  ["Rouge", "#c0392b"],
  ["Bleu", "#2a78d6"],
  ["Violet", "#7b3fb0"],
  ["Rose", "#e75fa3"],
  ["Vert", "#0b6e2f"],
  ["Orange", "#e8590c"],
  ["Noir", "#1a1a1a"],
  ["Bleu marine", "#1c3f94"],
  ["Bordeaux", "#7a1f3d"],
  ["Gris", "#8a8a8a"],
  ["Vert clair", "#27ae60"],
];
/** Symbole Highcharts de la croix, ajouté à ceux de Highcharts 6 (rond, carré, losange, triangles). */
const SYMBOLE_CROIX = "fzzzCroix";
/**
 * Formes des points de la Carte : [clé, nom, symbole Highcharts, caractère de
 * la liste et de la légende, px de rayon en plus : un losange ou un triangle
 * du même rayon qu'un rond paraît plus petit].
 */
const FORMES_CARTE = [
  ["rond", "Rond", "circle", "●", 0],
  ["carre", "Carré", "square", "■", 0],
  ["losange", "Losange", "diamond", "◆", 1],
  ["triangle", "Triangle", "triangle", "▲", 1],
  ["triangleBas", "Triangle bas", "triangle-down", "▼", 1],
  ["croix", "Croix", SYMBOLE_CROIX, "✕", 0],
];
/** Tailles des points de la Carte : [clé, nom, rayon en px] ; « Moyenne » est celle des membres d'avant 1.152.0. */
const TAILLES_CARTE = [
  ["petite", "Petite", 4],
  ["moyenne", "Moyenne", 5],
  ["grande", "Grande", 7],
  ["tresGrande", "Très grande", 10],
];
/** Couleur, forme et taille des membres de mon alliance sur la Carte (localStorage du jeu, donc par serveur). */
const CLE_CARTE_STYLE_MEMBRES = "fzzz_carteStyleMembres";
// membres de mon alliance retirés de la carte, pour regarder les autres seuls
const CLE_CARTE_MEMBRES_MASQUES = "fzzz_carteMembresMasques";
/** Couleur, forme et taille de ma fourmilière sur la Carte, et son retrait (localStorage du jeu, donc par serveur). */
const CLE_CARTE_STYLE_MOI = "fzzz_carteStyleMoi";
const CLE_CARTE_MOI_MASQUE = "fzzz_carteMoiMasque";
/** Joueur de départ des « Temps de trajet depuis un joueur » (localStorage du jeu, donc par serveur). */
const CLE_CARTE_DEPART_TRAJETS = "fzzz_carteDepartTrajets";
const STYLE_CARTE_MEMBRES = { couleur: "#c0392b", forme: "rond", taille: "moyenne" };
// le vert de ma fourmilière d'avant 1.155.0
const STYLE_CARTE_MOI = { couleur: "#27ae60", forme: "rond", taille: "moyenne" };
const STYLE_CARTE_AUTRE = { couleur: "#2a78d6", forme: "losange", taille: "moyenne" };
/** Suggestions proposées au plus pendant la saisie d'un pseudo ou d'un tag. */
const SUGGESTIONS_CARTE_MAX = 8;
/** Couleurs gardées par une version précédente et leur remplaçante (gris de 1.151.0, trop proche du vert). */
const COULEURS_CARTE_REMPLACEES = { "#6b6b6b": "#8a8a8a" };
/** Joueurs et alliances ajoutés à la Carte : liste du joueur, dans le localStorage du jeu (donc par serveur). */
const CLE_CARTE_AUTRES = "fzzz_carteAutres";
/** Place prise autour du tracé de la Carte (axes, titre, sous-titre), en px, pour en estimer la hauteur. */
const MARGES_CARTE = { largeur: 70, hauteur: 135 };
/** Hauteur réservée au-dessus des points du haut de la Carte pour leur nom, en px. */
const PX_NOM_CARTE = 20;

/**
 * Classe de fonction pour la page /alliance.php.
 *
 * @class PageAlliance
 * @constructor
 */
class PageAlliance {
  constructor() {
    /**
     * Creation du modele Alliance
     */
    this._alliance = new Alliance({ tag: Utils.alliance });
    /**
     * Grade natif du jeu par pseudo, proposé comme filtre sur la carte.
     */
    this._gradesNatifs = {};
    /**
     * Dernière liste complète de membres passée à la carte (avant filtrage).
     */
    this._carteMembres = null;
  }
  /**
   *
   */
  executer() {
    StatsMembres.installer();
    // Si le tableau des membres est déjà rendu, on enrichit directement.
    // Sinon, on observe `#alliance` pour réagir dès que le tableau apparaît
    // (rendu async sur certaines variantes de la page). Si aucun des deux
    // n'existe — page sans UI alliance, mobile, ou DOM atypique —, on skip
    // proprement plutôt que de crasher sur `observe(undefined)`.
    let afficher = () => {
      this.traitementMembre();
      if (Utils.affichage("membresCarte")) this.carte().ongletCarte();
    };
    if ($("#tabMembresAlliance").length) afficher();
    else if ($("#alliance").length) {
      let observer = new MutationObserver((mutationsList) => {
        afficher();
        observer.disconnect();
      });
      observer.observe($("#alliance")[0], { childList: true });
    }
    return this;
  }
  /**
   * Affiche les modifications du tableau des membres.
   *
   * @private
   * @method traitementMembre
   */
  traitementMembre() {
    let tableau = Utils.affichage("membresTableau"),
      moi = Utils.affichage("membresMoi") ? String(monProfil.pseudo || "").toLowerCase() : "";
    if (tableau) $("#tabMembresAlliance td:eq(5)").css("white-space", "nowrap");
    if (Utils.affichage("membresEtats")) this.compterEtats();
    // ajout des totaux de l'alliance
    let tmpJoueurs = {};
    $("#tabMembresAlliance tr:gt(0)").each((i, elt) => {
      let pseudo = $(elt).find("td:eq(3)").text(),
        terrain = numeral($(elt).find("td:eq(5)").text()).value();
      if (moi && pseudo.trim().toLowerCase() == moi) $(elt).addClass("o_allMoi");
      tmpJoueurs[pseudo] = new Joueur({
        pseudo: pseudo,
        terrain: terrain,
        fourmiliere: ~~$(elt).find("td:eq(8)").text(),
        technologie: ~~$(elt).find("td:eq(7)").text(),
        // grade natif du jeu
        rang: $(elt).find("td:eq(2)").text().trim().replace(/\//g, "-"),
      });
      this._gradesNatifs[pseudo] = tmpJoueurs[pseudo].rang;
      if (Utils.affichage("membresEpees"))
        Joueur.epeesPortee(tmpJoueurs[pseudo], $(elt).find("td:eq(4)"), $(elt).find("td:eq(6)"));
      if (!tableau) return;
      $(elt).find("td:eq(3)").addClass("o_allPseudo");
      $(elt).find("td:eq(4)").addClass("o_allEpeeG");
      $(elt).find("td:eq(5)").addClass("o_allTerrain");
      $(elt).find("td:eq(6)").addClass("o_allEpeeD");
      // rang limité à 12 caractères (en entier au survol)
      let $rang = $(elt).find("td:eq(2)"),
        rang = $rang.text().trim();
      $rang
        .attr("title", rang)
        .html(
          `<span class="o_rangTexte">${Utils.echapper(rang.length > 12 ? rang.slice(0, 12) + "…" : rang)}</span>`,
        );
    });
    this._alliance.joueurs = tmpJoueurs;
    Joueur.activerLiensAttaque();
    if (!tableau) return this;

    $("#tabMembresAlliance").append(
      `<tfoot class='${Object.keys(this._alliance.joueurs).length % 2 ? "ligne_paire" : ""}'><tr class='gras centre'><td colspan='12'>Terrain : <span id='totalTerrain'>${numeral(this._alliance.calculTerrain()).format()}</span> cm² | Fourmilière : ${numeral(this._alliance.calculFourmiliere()).format()} | Technologie : ${numeral(this._alliance.calculTechnologie()).format()}.</td></tr></tfoot>`,
    );
    $("#tabMembresAlliance tr:first").remove();
    $("#tabMembresAlliance").prepend(
      `<thead><tr class='alt'><th></th><th></th><th>Rang</th><th class='o_allPseudo'>Pseudo</th><th class='o_allEpeeG'></th><th class='o_allTerrain'>Terrain</th><th class='o_allEpeeD'></th><th><span style='padding-right:10px'>Technologie</span></th><th><span style='padding-right:10px'>Fourmiliere</span></th><th colspan='2'>Etat</th><th></th></tr></thead>`,
    );

    this.tableauAvecCarteCache();
    return this;
  }
  /**
   * Nombre de membres par état, à côté de chaque libellé de l'encadré du jeu.
   *
   * @private
   * @method compterEtats
   */
  compterEtats() {
    [
      [0, 1, "Actif"],
      [0, 3, "Vacances"],
      [1, 1, "Inactif depuis 3 jours"],
      [1, 3, "Bannie"],
      [2, 1, "Inactif depuis 10 jours"],
      [2, 3, "Colonisé"],
    ].forEach(([ligne, colonne, etat]) =>
      $(`.simulateur table[class='ligne_paire'] tr:eq(${ligne}) td:eq(${colonne})`).append(
        ` (${$(`img[alt='${etat}']`).length})`,
      ),
    );
  }
  /**
   * Variante de tableau() qui utilise le cache local de la Carte de l'alliance
   * (rempli via le bouton "Charger / Actualiser") pour ajouter les colonnes
   * Tdt + Retour.
   * Si pas de cache → fallback sur tableau() basique.
   *
   * @method tableauAvecCarteCache
   */
  tableauAvecCarteCache() {
    const cacheKey = `outiiil_carteAlliance_${Utils.serveur}_${Utils.alliance}`;
    let cached = null;
    try {
      cached = JSON.parse(localStorage.getItem(cacheKey));
    } catch (e) {
      cached = null;
    }
    const hasCache = cached && cached.members && cached.members.length;
    if (hasCache) {
      // Hydrate les coords depuis le cache
      const coordsByPseudo = new Map();
      cached.members.forEach((m) => coordsByPseudo.set(m.pseudo, { x: m.x, y: m.y }));
      for (const pseudo in this._alliance.joueurs) {
        if (coordsByPseudo.has(pseudo)) {
          Object.assign(this._alliance.joueurs[pseudo], coordsByPseudo.get(pseudo));
        }
      }
      // Ajoute les colonnes Tdt + Retour entre Fourmilière et Etat
      $("#tabMembresAlliance th:eq(8)").after(`<th>Tdt</th><th>Retour</th>`);
      $("#tabMembresAlliance tfoot td:eq(0)").attr("colspan", 14);
      $("#tabMembresAlliance tr:gt(0):lt(-1)").each((i, elt) => {
        const pseudo = $(elt).find("td:eq(3)").text();
        const j = this._alliance.joueurs[pseudo];
        const has = j && j.x !== -1 && j.y !== -1;
        let tdHtml;
        if (has) {
          const tdt = monProfil.getTempsParcours2(j);
          const retour = Utils.roundMinute(tdt, Horloge.clic());
          // data-order : DataTable trie sur l'attribut (entier brut) plutôt que sur
          // le texte affiché ("22h 31m" sinon trié en alphabétique).
          tdHtml = `<td data-order='${tdt}'>${Utils.intToTime(tdt)}</td><td data-order='${retour.unix()}'>${retour.format("D MMM à HH[h]mm")}</td>`;
        } else {
          tdHtml = `<td data-order='-1'>N/C</td><td data-order='-1'>N/C</td>`;
        }
        $(elt).find("td:eq(8)").after(tdHtml);
      });
      // DataTable — targets ajustés vs tableau() : Etat-2 et last passent de 10/11 à 12/13
      $("#tabMembresAlliance th:eq(7), #tabMembresAlliance th:eq(8)").css({
        maxWidth: "50px",
        textOverflow: "ellipsis",
        overflow: "hidden",
      });
      AllianceFzzz.colonnes();
      $("#tabMembresAlliance").DataTable({
        bInfo: false,
        bPaginate: false,
        bAutoWidth: false,
        dom: "Bfrti",
        buttons: [],
        order: [],
        stripeClasses: ["", "alt"],
        responsive: false, // Fzzz : le repli des colonnes (bouton +) cachait les colonnes ajoutées
        language: {
          zeroRecords: "Aucun joueur trouvé",
          infoEmpty: "Aucun enregistrement",
          infoFiltered: "(Filtré par _MAX_ enregistrements)",
          search: "Rechercher : ",
        },
        columnDefs: [
          { type: "quantite-grade", targets: 5 },
          { sortable: false, targets: [0, 1, 4, 6, 12, 13] },
        ],
      });
    } else {
      this.tableau();
    }
    // Fzzz : vues Temps de trajet (ancien « Synchroniser ») / Reset / Floods et
    // chasses en cours, et évolution du TdC au survol (AllianceFzzz)
    AllianceFzzz.installer(
      (progres) => this._fetchAndCacheCoords(progres),
      !!hasCache,
      // temps de trajet de la colonne « Tdt » ; inconnu sans coordonnées ou sans Vitesse d'attaque
      (pseudo) => {
        const j = Object.values(this._alliance.joueurs).find(
          (m) => String(m.pseudo).trim() == pseudo,
        );
        return j && j.x !== -1 && j.y !== -1 && monProfil.niveauRecherche[6] >= 0
          ? monProfil.getTempsParcours2(j)
          : null;
      },
    );
    return this;
  }
  /**
   * Ajoute le tri.
   *
   * @private
   * @method tableau
   */
  tableau() {
    $("#tabMembresAlliance th:eq(7), #tabMembresAlliance th:eq(8)").css({
      maxWidth: "50px",
      textOverflow: "ellipsis",
      overflow: "hidden",
    });
    AllianceFzzz.colonnes();
    $("#tabMembresAlliance").DataTable({
      bInfo: false,
      bPaginate: false,
      bAutoWidth: false,
      dom: "Bfrti",
      buttons: [],
      order: [],
      stripeClasses: ["", "alt"],
      responsive: false, // Fzzz : le repli des colonnes (bouton +) cachait les colonnes ajoutées
      language: {
        zeroRecords: "Aucun joueur trouvé",
        infoEmpty: "Aucun enregistrement",
        infoFiltered: "(Filtré par _MAX_ enregistrements)",
        search: "Rechercher : ",
      },
      columnDefs: [
        { type: "quantite-grade", targets: 5 },
        { sortable: false, targets: [0, 1, 4, 6, 10, 11] },
      ],
    });
    return this;
  }
  /**
   * Injecte la section "Carte de l'alliance" en bas de la page.
   * Charge depuis localStorage si dispo ; refresh manuel via bouton.
   *
   * @method carte
   */
  carte() {
    if ($("#o_carteAlliance").length) return this; // déjà rendue
    let couleurs = COULEURS_CARTE.map(
      ([nom, valeur]) => `<option value='${valeur}'>${nom}</option>`,
    ).join("");
    $("#alliance").after(`
      <div id='o_carteAlliance' class='boite_amelioration simulateur centre' style='display:none;'>
        <h2>Carte de l'alliance</h2>
        <p class='reduce'>Positions des membres, à la même échelle en X et en Y : les distances à l'œil sont celles des temps de trajet. <b>Survole</b> ou touche un point pour voir le temps de trajet depuis ta fourmilière. <b>Glisse</b> pour zoomer sur une zone, <b>clic</b> sur un point pour zoomer 4× dessus. Positions chargées à la demande puis gardées dans ce navigateur.</p>
        <div class='centre o_marginT15'>
          <button id='o_carteAllianceRefresh' class='o_button f_info'>Charger / Actualiser</button>
          <button id='o_carteAllianceExportForum' class='o_button f_success' style='margin-left:8px;'>Exporter pour le forum</button>
          <button id='o_carteAllianceExportExcel' class='o_button f_success' style='margin-left:8px;' title='Coordonnées des membres affichés, temps de trajet entre eux et formule'>Exporter en Excel</button>
          <span id='o_carteAllianceStatus' class='reduce o_secondaire' style='margin-left:12px;'></span>
        </div>
        <div id='o_carteFiltres' class='left o_marginT15' style='display:none;'></div>
        <div id='o_carteAutres' class='left o_marginT15'>
          <p class='left reduce gras'>Alliances et joueurs sur la carte <span class='reduce o_secondaire' style='font-weight:normal;'>(ta liste, gardée dans ce navigateur)</span></p>
          <div class='o_carteAutreAjout'>
            <select id='o_carteAutreType' aria-label='Joueur ou alliance'><option value='joueur'>Joueur</option><option value='alliance'>Alliance</option></select>
            <input type='text' id='o_carteAutreNom' maxlength='40' placeholder='Pseudo ou tag' aria-label='Pseudo ou tag' autocomplete='off' aria-controls='o_carteSuggestions'/>
            <span id='o_carteAutreApercu' class='o_carteSymbole'>${FORMES_CARTE.find((f) => f[0] == STYLE_CARTE_AUTRE.forme)[3]}</span><select id='o_carteAutreCouleur' aria-label='Couleur'>${couleurs}</select>
            <button type='button' id='o_carteAutreAjouter' class='o_button f_info'>Ajouter</button>
          </div>
          <ul id='o_carteSuggestions' class='o_carteSuggestions' role='listbox' style='display:none;'></ul>
          <ul id='o_carteAutresListe'></ul>
        </div>
        <div id='o_carteAllianceChart' style='margin-top:15px;display:none;'></div>
        <p id='o_carteLegende' class='reduce' style='display:none;'></p>
        <div id='o_carteTrajets' class='o_marginT15' style='display:none;'>
          <div class='centre gras'>Temps de trajet depuis un joueur</div>
          <p class='reduce'>Vers chacun des joueurs affichés sur la carte (membres selon les filtres, joueurs et alliances ajoutés), du plus proche au plus loin. Le temps dépend de la Vitesse d'attaque de celui qui attaque : la tienne par défaut.</p>
          <div class='o_carteTrajetsChoix'>
            <label>Depuis <select id='o_trajetsDepart'></select></label>
            <label>Vitesse d'attaque <input type='number' id='o_trajetsVa' min='0' max='99' step='1' inputmode='numeric' /></label>
          </div>
          <table id='o_trajetsListe' class='o_maxWidth centre o_marginT15' cellspacing='0'></table>
        </div>
        <div id='o_carteChaine' class='o_marginT15' style='display:none;'>
          <div class='centre gras'>Chaîne entre plus proches voisins</div>
          <p class='reduce'>Ordre de passage qui minimise le temps de trajet total entre les membres affichés : chacun envoie au suivant. Les joueurs décochés dans les filtres et les autres joueurs ajoutés sont exclus. Temps sans amélioration de Vitesse d'attaque.</p>
          <div class='centre o_marginT15'>
            <label>Départ <select id='o_chaineDepart'></select></label>
            <button id='o_chaineCalculer' class='o_button f_info' style='margin-left:12px;'>Calculer la chaîne</button>
            <label style='margin-left:12px;'><input type='checkbox' id='o_chaineTracer'/> Tracer sur la carte</label>
            <button id='o_chaineCopier' class='o_button f_success' style='margin-left:12px;'>Copier pour le forum</button>
          </div>
          <table id='o_chaineListe' class='o_maxWidth centre o_marginT15' cellspacing='0'></table>
        </div>
      </div>
    `);
    // dessinée seulement quand on l'affiche (ongletCarte) : la page Membres
    // n'a pas à la calculer pour qui ne l'ouvre pas
    let gardee = PageAlliance._carteGardee();
    if (gardee) this._afficherAge(gardee.timestamp);
    $("#o_carteAllianceRefresh").click(() => this._actualiserCarte());
    $("#o_carteAllianceExportForum").click(() => this._exporterCarteForumPng());
    $("#o_carteAllianceExportExcel").click(() => this._exporterCarteExcel());
    this._evenementsChaine();
    this._evenementsAutres();
    $("#o_trajetsDepart").on("change", () => {
      try {
        localStorage.setItem(CLE_CARTE_DEPART_TRAJETS, JSON.stringify($("#o_trajetsDepart").val()));
      } catch (e) {}
      this._trajets();
    });
    $("#o_trajetsVa").on("input change", () => this._trajets());
    // la carte garde la même échelle sur ses deux axes : redessinée à sa nouvelle largeur
    let attente = 0;
    $(window).on("resize", () => {
      clearTimeout(attente);
      attente = setTimeout(() => {
        if (
          this._carteMembres &&
          $("#o_carteAlliance").is(":visible") &&
          $("#o_carteAllianceChart").width() != this._largeurCarte
        )
          this._redessiner();
      }, 250);
    });
    return this;
  }
  /**
   * Positions gardées par « Charger / Actualiser », sans les membres en 0 / 0
   * des versions qui ne lisaient pas le lien carte.php du s5 (un Actualiser
   * les repositionne) ; null sans positions.
   *
   * @private
   * @static
   * @return {{timestamp: Number, members: Array<any>}|null}
   */
  static _carteGardee() {
    let cached = null;
    try {
      cached = JSON.parse(
        localStorage.getItem(`outiiil_carteAlliance_${Utils.serveur}_${Utils.alliance}`),
      );
    } catch (e) {
      cached = null;
    }
    if (!cached || !Array.isArray(cached.members)) return null;
    cached.members = cached.members.filter((m) => !(m.x == 0 && m.y == 0));
    return cached.members.length ? cached : null;
  }
  /**
   * Vue Carte affichée : dessinée la première fois depuis les positions
   * gardées, redessinée si sa largeur a changé pendant qu'elle était cachée.
   *
   * @private
   * @method _montrerCarte
   */
  _montrerCarte() {
    this._listeAutres();
    if (this._carteMembres) {
      if ($("#o_carteAllianceChart").width() != this._largeurCarte) this._redessiner();
      return;
    }
    let gardee = PageAlliance._carteGardee();
    if (gardee) this._renderCarte(gardee.members);
  }
  /**
   * @private
   * @method _redessiner
   */
  _redessiner() {
    if (this._carteMembres)
      this._dessinerCarte(this._filtrerMembres(this._carteMembres), this._carteMembres.length);
  }
  /**
   * Active l'onglet "Carte" du menu Alliance (injecté par content.js sur toutes
   * les pages) : intercepte le clic pour un toggle client-side, et bascule
   * automatiquement si la page est chargée avec le hash #carte (cas où on
   * arrive depuis une autre page d'alliance).
   *
   * @method ongletCarte
   */
  ongletCarte() {
    if (!$("#o_ongletCarte").length) return this;
    const showCarte = () => {
      $("#alliance, #o_statsMembres").hide();
      $("#o_carteAlliance").show();
      this._montrerCarte();
    };
    $("#o_ongletCarte").click((e) => {
      e.preventDefault();
      showCarte();
    });
    if (location.hash === "#carte") showCarte();
    return this;
  }
  /**
   * Coordonnées de tous les membres de la page, gardées pour la Carte, la vue
   * « Temps de trajet » et le Récapitulatif de la page Convois.
   *
   * @private
   * @method _fetchAndCacheCoords
   * @returns {Promise<{members, timestamp}>}
   */
  _fetchAndCacheCoords(progres = () => {}) {
    return PageAlliance.chargerPositions(this._alliance.joueurs, progres);
  }
  /**
   * Positions des membres depuis une autre page que Membres (Récapitulatif de
   * la page Convois, au clic) : leur liste est lue comme pour les TdC (page
   * Membres, sinon page de l'alliance au classement), puis comme « Charger /
   * Actualiser » de la Carte.
   *
   * @static
   * @method actualiserPositions
   * @param {Function} [progres] (faits, total)
   * @returns {Promise<{members, timestamp}>}
   */
  static actualiserPositions(progres = () => {}) {
    return PartageChasses.tdcMembres().then((tdc) => {
      let joueurs = {};
      for (let pseudo in tdc) joueurs[pseudo] = new Joueur({ pseudo, terrain: tdc[pseudo] });
      return PageAlliance.chargerPositions(joueurs, progres);
    });
  }
  /**
   * Coordonnées des membres + persistance localStorage. Lues dans l'export
   * public des joueurs (une requête) ; les pages de profil ne sont lues que
   * pour les membres absents de l'export (arrivés depuis), ou pour tous si
   * l'export ne répond pas. Ne touche pas à l'affichage : chaque page appelante
   * donne son propre retour.
   *
   * @static
   * @method chargerPositions
   * @param {Object} joueurs {pseudo: Joueur}
   * @param {Function} [progres] (faits, total)
   * @returns {Promise<{members, timestamp}>}
   */
  static chargerPositions(joueurs, progres = () => {}) {
    const pseudos = Object.keys(joueurs);
    if (!pseudos.length) {
      return Promise.reject(new Error("Aucun membre détecté dans l'alliance."));
    }
    const cacheKey = `outiiil_carteAlliance_${Utils.serveur}_${Utils.alliance}`;
    return ExportJoueurs.lire()
      .catch(() => new Map())
      .then((exportJoueurs) => {
        let faits = 0;
        const promises = pseudos.map((pseudo) => {
          const joueur = joueurs[pseudo],
            exporte = exportJoueurs.get(pseudo);
          if (exporte) {
            Object.assign(joueur, { id: exporte.id, x: exporte.x, y: exporte.y });
            if (!(joueur.terrain > 0)) joueur.terrain = exporte.terrain;
            progres(++faits, pseudos.length);
            return Promise.resolve(joueur);
          }
          return joueur
            .getProfil()
            .then((html) => {
              joueur.chargerProfil(html);
              return joueur;
            })
            .catch(() => null)
            .then((j) => {
              progres(++faits, pseudos.length);
              return j;
            });
        });
        return Promise.all(promises);
      })
      .then((joueurs) => {
        const members = joueurs
          .filter((j) => j && j.x !== -1 && j.y !== -1)
          .map((j) => ({
            pseudo: j.pseudo,
            // identifiant, pour le lien de convoi (commerce.php?ID=)
            id: j.id > 0 ? j.id : null,
            x: j.x,
            y: j.y,
            terrain: j.terrain || 0,
          }));
        if (!members.length) throw new Error("Aucune coordonnée récupérée.");
        const timestamp = Date.now();
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ timestamp, members }));
        } catch (e) {
          console.warn("outiiil: localStorage write failed", e);
        }
        return { members, timestamp };
      });
  }
  /**
   * Refresh de la Carte (UI Carte + render Highcharts).
   *
   * @private
   * @method _actualiserCarte
   */
  _actualiserCarte() {
    const pseudos = Object.keys(this._alliance.joueurs),
      liberer = () => {
        $("#o_carteAllianceRefresh").prop("disabled", false).text("Charger / Actualiser");
        $("#o_carteAllianceExportForum, #o_carteAllianceExportExcel").prop("disabled", false);
      };
    // bloqués pendant le chargement : les profils partent un par un
    $("#o_carteAllianceRefresh")
      .prop("disabled", true)
      .text(`Chargement des profils… (0/${pseudos.length})`);
    $("#o_carteAllianceExportForum, #o_carteAllianceExportExcel").prop("disabled", true);
    $("#o_carteAllianceStatus").text("");
    this._fetchAndCacheCoords((faits, total) =>
      $("#o_carteAllianceRefresh").text(`Chargement des profils… (${faits}/${total})`),
    )
      .then(({ members, timestamp }) => {
        liberer();
        $.toast({
          ...TOAST_SUCCESS,
          text: `Carte mise à jour : ${members.length} membres positionnés.`,
        });
        this._afficherAge(timestamp);
        this._renderCarte(members);
      })
      .catch((err) => {
        liberer();
        $.toast({
          ...TOAST_ERROR,
          text: err.message || "Erreur lors du chargement des profils.",
        });
      });
  }
  /**
   * Membres de la carte gardée, avec la sélection des filtres comme à
   * l'écran ; null, après un message, quand il n'y a rien à exporter.
   *
   * @private
   * @method _membresCarte
   * @param {String} usage fin de « Charge d'abord la carte avant de pouvoir … »
   */
  _membresCarte(usage) {
    const cached = PageAlliance._carteGardee();
    if (!cached) {
      $.toast({
        ...TOAST_WARNING,
        text: `Charge d'abord la carte avant de pouvoir ${usage}.`,
      });
      return null;
    }
    if (!this._filtres) this._filtres = this._chargerFiltres();
    const tous = this._carteMembres || cached.members,
      members = this._filtrerMembres(tous);
    if (!members.length) {
      $.toast({
        ...TOAST_WARNING,
        text: "Aucun membre affiché : élargis les filtres avant d'exporter.",
      });
      return null;
    }
    return { members, masques: tous.length - members.length, timestamp: cached.timestamp };
  }
  /**
   * Fichier Excel des membres affichés sur la carte : rien n'est lu, les
   * positions sont celles de la carte.
   *
   * @private
   * @method _exporterCarteExcel
   */
  _exporterCarteExcel() {
    const carte = this._membresCarte("l'exporter en Excel");
    if (!carte) return;
    const maintenant = Horloge.serveur(),
      feuilles = PageAlliance.classeurTrajets(carte.members, VITESSE_EXPORT_TRAJETS, {
        alliance: Utils.alliance,
        positions: carte.timestamp ? moment(carte.timestamp).format("DD/MM/YYYY [à] HH[h]mm") : "",
        cree: maintenant.format("DD/MM/YYYY [à] HH[h]mm"),
        masques: carte.masques,
      }),
      nom = `trajets-${Utils.alliance.replace(/[^\w-]/g, "") || "alliance"}-${maintenant.format("YYYY-MM-DD")}.xlsx`;
    try {
      Classeur.telecharger(Classeur.xlsx(feuilles), nom);
    } catch (e) {
      console.error("Fzzz : fichier Excel de la carte", e);
      $.toast({ ...TOAST_ERROR, text: "Le fichier Excel n'a pas pu être créé." });
      return;
    }
    $.toast({
      ...TOAST_SUCCESS,
      text:
        `Fichier Excel créé : ${PageAlliance._membres(carte.members.length)}, vitesse d'attaque ${VITESSE_EXPORT_TRAJETS} (modifiable dans la feuille « Trajets »)` +
        (carte.masques ? `, sans ${PageAlliance._masques(carte.masques)}.` : "."),
    });
  }
  /**
   * @private
   * @param {Number} n
   */
  static _membres(n) {
    return `${n} membre${n > 1 ? "s" : ""}`;
  }
  /**
   * @private
   * @param {Number} n membres masqués par les filtres de la carte
   */
  static _masques(n) {
    return n == 1 ? "le membre masqué par les filtres" : `les ${n} membres masqués par les filtres`;
  }
  /**
   * Feuilles du fichier Excel de la carte : « Coordonnées », « Trajets » (de
   * la ligne vers la colonne : formules sur la vitesse d'attaque de la case
   * B1, avec leur valeur pour les lecteurs qui ne recalculent pas) et
   * « Formule ».
   *
   * @static
   * @method classeurTrajets
   * @param {Array<{pseudo: String, x: Number, y: Number}>} membres
   * @param {Number} va
   * @param {{alliance: String, positions: String, cree: String, masques: Number}} infos
   * @return {Array} feuilles de Classeur.xlsx
   */
  static classeurTrajets(membres, va, infos) {
    const tries = [...membres].sort((a, b) =>
        a.pseudo.localeCompare(b.pseudo, "fr", { sensitivity: "base" }),
      ),
      // ligne du premier membre dans la feuille « Trajets »
      premiere = 4,
      x = (i) => `$B$${premiere + i}`,
      y = (i) => `$C$${premiere + i}`,
      longueur = Math.max(6, ...tries.map((m) => m.pseudo.length)),
      gras = (texte) => ({ v: texte, s: "gras" }),
      note = (texte) => ({ v: texte, s: "note" });
    const matrice = tries.map((a, i) => [
      gras(a.pseudo),
      a.x,
      a.y,
      ...tries.map((b, j) =>
        i == j
          ? { v: "—", s: "diagonale" }
          : {
              f: `ROUND(0.9^$B$1*${TRAJET_MAX}*(1-EXP(-SQRT((${x(i)}-${x(j)})^2+(${y(i)}-${y(j)})^2)/${TRAJET_DISTANCE})),0)/86400`,
              v: Joueur.tempsTrajet(a, b, va) / 86400,
              s: "duree",
            },
      ),
    ]);
    return [
      {
        nom: "Coordonnées",
        lignes: [[gras("Pseudo"), gras("X"), gras("Y")], ...tries.map((m) => [m.pseudo, m.x, m.y])],
        largeurs: [longueur + 2, 6, 6],
        figer: { lignes: 1, colonnes: 0 },
      },
      {
        nom: "Trajets",
        lignes: [
          [
            gras("Vitesse d'attaque"),
            { v: va, s: "saisie" },
            note("← change ce nombre : toute la matrice se recalcule."),
          ],
          [
            note(
              "Durées en heures:minutes:secondes, de la fourmilière de la ligne vers celle de la colonne. Formule : feuille « Formule ».",
            ),
          ],
          [
            gras("Pseudo"),
            gras("X"),
            gras("Y"),
            ...tries.map((m) => ({ v: m.pseudo, s: "vertical" })),
          ],
          ...matrice,
        ],
        largeurs: [Math.max(longueur, 17) + 2, 6, 6, ...tries.map(() => 10)],
        figer: { lignes: 3, colonnes: 3 },
        hauteurs: { 3: Math.min(160, 12 + 6.5 * longueur) },
      },
      {
        nom: "Formule",
        lignes: [
          [gras("Temps de trajet entre deux fourmilières")],
          ["temps (secondes) = ARRONDI(0,9^VA × 637 200 × (1 − e^(−d / 350)))"],
          [
            "d = √((x₂ − x₁)² + (y₂ − y₁)²) : distance entre les deux fourmilières, dans les coordonnées (x, y) du jeu.",
          ],
          [
            "VA : niveau de la recherche « Vitesse d'attaque » de celui qui envoie (case B1 de la feuille « Trajets »). Chaque niveau multiplie le temps par 0,9.",
          ],
          [
            "637 200 s (7 j 9 h) : le trajet le plus long possible en VA 0, vers une distance infinie.",
          ],
          ["C'est la formule des temps de trajet de l'extension, arrondie à la seconde."],
          [],
          [gras("Source")],
          [
            `Positions : Carte de l'alliance ${infos.alliance}, chargées le ${infos.positions || "(date inconnue)"} ; ${PageAlliance._membres(tries.length)}` +
              (infos.masques ? `, sans ${PageAlliance._masques(infos.masques)} de la carte.` : "."),
          ],
          [`Fichier créé le ${infos.cree} par l'${NOM_EXTENSION}.`],
        ],
        largeurs: [120],
      },
    ];
  }
  /**
   * Génère un PNG simple dessiné sur canvas, à la même échelle en X et en Y
   * que la carte (les distances à l'œil sont celles des temps de trajet), son
   * plus grand côté vers 900 px. Sans grille marquée — pensée pour partager
   * dans le forum d'alliance. Utilise directement le cache des coords (pas
   * besoin que le chart Highcharts soit rendu).
   *
   * @private
   * @method _exporterCarteForumPng
   */
  _exporterCarteForumPng() {
    const carte = this._membresCarte("l'exporter pour le forum");
    if (!carte) return;
    const members = carte.members;
    const xs = members.map((m) => m.x);
    const ys = members.map((m) => m.y);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    // une seule échelle pour X et Y
    const PX = PageAlliance.echelleImage(xMax - xMin, yMax - yMin);
    // Padding suffisant pour les graduations d'axes (X en haut, Y à gauche)
    const PAD_LEFT = 38;
    const PAD_TOP = 26;
    const PAD_BOTTOM = 16;
    const PAD_RIGHT_MIN = 16;
    const LABEL_LINE_H = 13;
    const LABEL_GAP = 8;
    // Pré-mesure des largeurs de label sur un canvas temporaire pour calculer les
    // collisions avant de dimensionner le vrai canvas.
    const tmp = document.createElement("canvas").getContext("2d");
    tmp.font = "bold 11px sans-serif";
    // Tri haut→bas, gauche→droite : algo glouton qui décale les labels vers le bas
    // dès qu'ils chevaucheraient un label déjà placé.
    const sorted = [...members].sort((a, b) => a.y - b.y || a.x - b.x);
    const placed = [];
    const positions = sorted.map((m) => {
      const dotX = (m.x - xMin) * PX + PAD_LEFT;
      const dotY = (m.y - yMin) * PX + PAD_TOP;
      const labelW = tmp.measureText(m.pseudo).width;
      const labelX = dotX + LABEL_GAP;
      let labelY = dotY;
      while (
        placed.some(
          (p) =>
            labelX < p.x + p.w + 4 &&
            labelX + labelW + 4 > p.x &&
            Math.abs(labelY - p.y) < LABEL_LINE_H,
        )
      ) {
        labelY += LABEL_LINE_H;
      }
      placed.push({ x: labelX, y: labelY, w: labelW });
      return { m, dotX, dotY, labelX, labelY, labelW };
    });
    // Dimensions du canvas en fonction des positions finales (labels potentiellement
    // décalés vers le bas en cas de cluster dense). On étend aussi pour couvrir le
    // tick supérieur arrondi (ceil) afin que le 50 / 1900 / etc. soit toujours visible.
    const maxRight = Math.max(...positions.map((p) => p.labelX + p.labelW));
    const maxBottom = Math.max(...positions.map((p) => Math.max(p.labelY + 6, p.dotY + 4)));
    const yStep = PageAlliance.pasGrille(PX);
    const xStep = yStep;
    const xTickEnd = Math.ceil(xMax / xStep) * xStep;
    const yTickEnd = Math.ceil(yMax / yStep) * yStep;
    const tickRight = (xTickEnd - xMin) * PX + PAD_LEFT;
    const tickBottom = (yTickEnd - yMin) * PX + PAD_TOP;
    const W = Math.max(220, Math.max(maxRight, tickRight) + PAD_RIGHT_MIN);
    const H = Math.max(220, Math.max(maxBottom, tickBottom) + PAD_BOTTOM);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(W);
    canvas.height = Math.round(H);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Graduations d'axes — yStep et xStep déjà calculés plus haut.
    ctx.strokeStyle = "#eee";
    ctx.lineWidth = 0.5;
    ctx.fillStyle = "#888";
    ctx.font = "10px sans-serif";
    // Grille verticale (X) + labels en haut. Ceil sur la borne sup pour inclure 50, etc.
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    const xGridStart = Math.floor(xMin / xStep) * xStep;
    for (let x = xGridStart; x <= xTickEnd; x += xStep) {
      if (x < xMin) continue;
      const px = (x - xMin) * PX + PAD_LEFT;
      ctx.beginPath();
      ctx.moveTo(px, PAD_TOP);
      ctx.lineTo(px, canvas.height - PAD_BOTTOM);
      ctx.stroke();
      ctx.fillText(x.toString(), px, PAD_TOP - 6);
    }
    // Grille horizontale (Y) + labels à gauche. Ceil sur la borne sup pour inclure 1900, etc.
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    const yGridStart = Math.floor(yMin / yStep) * yStep;
    for (let y = yGridStart; y <= yTickEnd; y += yStep) {
      if (y < yMin) continue;
      const py = (y - yMin) * PX + PAD_TOP;
      ctx.beginPath();
      ctx.moveTo(PAD_LEFT, py);
      ctx.lineTo(canvas.width - PAD_RIGHT_MIN, py);
      ctx.stroke();
      ctx.fillText(y.toString(), PAD_LEFT - 4, py);
    }
    ctx.font = "bold 11px sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    for (const pos of positions) {
      const { m, dotX, dotY, labelX, labelY } = pos;
      // Connecteur fin gris si le label a été décalé pour éviter une collision —
      // sinon on ne sait plus quel label appartient à quel dot.
      if (Math.abs(labelY - dotY) > 1) {
        ctx.strokeStyle = "#bbb";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(dotX + 4, dotY);
        ctx.lineTo(labelX - 1, labelY);
        ctx.stroke();
      }
      // Toutes les fourmilières en rouge — l'image est destinée au forum (partage),
      // pas de raison de mettre en évidence l'auteur.
      ctx.fillStyle = "#c0392b";
      ctx.beginPath();
      ctx.arc(dotX, dotY, 4, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.fillText(m.pseudo, labelX, labelY);
    }
    canvas.toBlob((blob) => {
      if (!blob) {
        $.toast({ ...TOAST_ERROR, text: "Erreur lors de la génération du PNG forum." });
        return;
      }
      const date = new Date().toISOString().slice(0, 10);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `toolzzz-carte-forum-${Utils.alliance}-${date}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    }, "image/png");
  }
  /**
   * Pixels par unité de l'image pour le forum, les mêmes en X et en Y : son
   * plus grand côté fait environ 900 px, 20 px par unité au plus.
   *
   * @static
   * @method echelleImage
   * @param {Number} etendueX
   * @param {Number} etendueY
   * @return {Number}
   */
  static echelleImage(etendueX, etendueY) {
    return Math.min(20, 900 / Math.max(etendueX, etendueY, 1));
  }
  /**
   * Pas des graduations (1, 2 ou 5 × 10^n unités), au moins 40 px entre deux.
   *
   * @static
   * @method pasGrille
   * @param {Number} pxParUnite
   * @return {Number}
   */
  static pasGrille(pxParUnite) {
    let brut = 40 / pxParUnite,
      puissance = Math.pow(10, Math.floor(Math.log10(brut)));
    return [1, 2, 5, 10].map((k) => k * puissance).find((v) => v >= brut - 1e-9) || 10 * puissance;
  }
  /**
   * Affiche le timestamp en texte humain à côté du bouton.
   *
   * @private
   * @method _afficherAge
   */
  _afficherAge(timestamp) {
    const minutes = Math.floor((Date.now() - timestamp) / 60000);
    let age;
    if (minutes < 1) age = "à l'instant";
    else if (minutes < 60) age = `il y a ${minutes} min`;
    else if (minutes < 1440) age = `il y a ${Math.floor(minutes / 60)}h`;
    else age = `il y a ${Math.floor(minutes / 1440)}j`;
    $("#o_carteAllianceStatus").text(`Données ${age}`);
  }
  /**
   * Clé de persistance de la sélection des filtres (par serveur et alliance).
   *
   * @private
   * @method _cleFiltres
   */
  _cleFiltres() {
    return `outiiil_carteFiltres_${Utils.serveur}_${Utils.alliance}`;
  }
  /**
   * Sélection courante. On mémorise ce qui est *masqué* et non ce qui est
   * affiché : un membre ou un grade apparu depuis la dernière visite est
   * visible par défaut, au lieu d'être silencieusement absent de la carte.
   *
   * @private
   * @method _chargerFiltres
   */
  _chargerFiltres() {
    let f = {};
    try {
      f = JSON.parse(localStorage.getItem(this._cleFiltres())) || {};
    } catch (e) {
      f = {};
    }
    return {
      grades: f.grades || [],
      joueurs: f.joueurs || [],
    };
  }
  /**
   *
   * @private
   * @method _sauverFiltres
   */
  _sauverFiltres() {
    try {
      localStorage.setItem(this._cleFiltres(), JSON.stringify(this._filtres));
    } catch (e) {
      console.warn("outiiil: localStorage write failed", e);
    }
    return this;
  }
  /**
   * Grade natif du jeu d'un membre.
   *
   * @private
   * @method _gradeDe
   */
  _gradeDe(pseudo) {
    return this._gradesNatifs[pseudo] || "Sans grade";
  }
  /**
   * Applique la sélection à une liste de membres.
   *
   * @private
   * @method _filtrerMembres
   */
  _filtrerMembres(membres) {
    let f = this._filtres;
    return membres.filter((m) => {
      return f.grades.indexOf(this._gradeDe(m.pseudo)) == -1 && f.joueurs.indexOf(m.pseudo) == -1;
    });
  }
  /**
   * Construit le bloc de filtres : une case par grade et la liste dépliable
   * des joueurs.
   *
   * @private
   * @method _construireFiltres
   */
  _construireFiltres(membres) {
    const esc = (t) => $("<div>").text(t).html();
    // Un grade d'alliance est du texte libre : chaque chef y met ce qu'il veut,
    // souvent long et décoré. On n'essaie pas de deviner sa mise en forme, on
    // se contente de retirer les remplisseurs invisibles (U+3164, espaces
    // insécables…) qui creusent des trous dans la liste, et de tronquer pour
    // que les cases restent alignées. Le libellé complet est en infobulle et
    // la valeur filtrée reste le grade brut.
    const lisible = (t) => {
      let net = t
        .replace(/[\u3164\u00a0\u200b\u2800]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return esc(net.length > 34 ? net.slice(0, 34) + "…" : net || t);
    };
    // valeurs passées par index : un grade peut contenir n'importe quel caractère
    let compte = (valeur, accesseur) =>
        membres.filter((m) => accesseur.call(this, m.pseudo) == valeur).length,
      // grades les plus portés en tête : dans beaucoup d'alliances chaque
      // membre a son grade décoratif à lui, et les rares grades partagés
      // (VIP, passeurs…) sont justement ceux sur lesquels on veut filtrer
      parEffectif = (accesseur) => (a, b) =>
        compte(b, accesseur) - compte(a, accesseur) || a.localeCompare(b),
      grades = [...new Set(membres.map((m) => this._gradeDe(m.pseudo)))].sort(
        parEffectif(this._gradeDe),
      ),
      pseudos = membres.map((m) => m.pseudo).sort(),
      cases = (liste, classe, accesseur) =>
        liste
          .map(
            (v, i) =>
              `<label title='${esc(v)}'><input type='checkbox' class='${classe}' data-i='${i}'/> ${lisible(v)}${accesseur ? ` <span class='reduce'>(${compte(v, accesseur)})</span>` : ""}</label>`,
          )
          .join("");
    this._filtresValeurs = { grades: grades, joueurs: pseudos };
    // un grade unique par membre ne regroupe rien : on le signale plutôt que
    // d'afficher une liste de grades qui double celle des joueurs
    let partages = grades.filter((g) => compte(g, this._gradeDe) > 1).length;
    // Chaque section est repliée par défaut pour ne pas alourdir la page. Le
    // titre indique combien d'entrées sont masquées, pour qu'un filtre actif
    // reste visible même section fermée.
    let section = (id, titre, contenu) =>
      `<p class='left reduce gras'>${titre} <span id='${id}Masques' class='reduce' style='font-weight:normal;'></span> <span class='o_filtreVoir cliquable2 cursor' data-cible='${id}' style='font-size:0.8em;font-weight:normal;'>Afficher la liste</span></p>
      <div id='${id}' style='display:none;'>${contenu}</div>`;
    let html = section(
      "o_filtreGrades",
      "Grades",
      `${partages ? "" : `<p class='left small'><em>Chaque membre a un grade différent dans cette alliance : la liste des joueurs sera sans doute plus pratique.</em></p>`}
        <div>${cases(grades, "o_filtreGrade", this._gradeDe)}</div>`,
    );
    html += section(
      "o_filtreJoueurs",
      "Joueurs",
      `<p class='left small'><em><span id='o_filtreTout' class='souligne cursor'>Tout cocher</span> · <span id='o_filtreAucun' class='souligne cursor'>Tout décocher</span></em></p>
        <div>${cases(pseudos, "o_filtreJoueur", null)}</div>`,
    );
    $("#o_carteFiltres").html(html).show();
    // état initial des cases depuis la sélection mémorisée
    let poser = (classe, valeurs, exclus) =>
      $("." + classe).each((i, elt) => {
        $(elt).prop("checked", exclus.indexOf(valeurs[$(elt).data("i")]) == -1);
      });
    poser("o_filtreGrade", grades, this._filtres.grades);
    poser("o_filtreJoueur", pseudos, this._filtres.joueurs);
    let afficherMasques = () => {
      let libelle = (n) => (n ? `(${n} masqué${n > 1 ? "s" : ""})` : "");
      $("#o_filtreGradesMasques").text(libelle(this._filtres.grades.length));
      $("#o_filtreJoueursMasques").text(libelle(this._filtres.joueurs.length));
    };
    afficherMasques();
    let appliquer = () => {
      let lire = (classe, valeurs) =>
        $("." + classe)
          .filter((i, elt) => !elt.checked)
          .map((i, elt) => valeurs[$(elt).data("i")])
          .get();
      this._filtres = {
        grades: lire("o_filtreGrade", grades),
        joueurs: lire("o_filtreJoueur", pseudos),
      };
      this._sauverFiltres();
      afficherMasques();
      this._dessinerCarte(this._filtrerMembres(this._carteMembres), this._carteMembres.length);
    };
    $("#o_carteFiltres input[type=checkbox]").on("change", appliquer);
    $("#o_carteFiltres .o_filtreVoir").click((e) => {
      let cible = $("#" + $(e.currentTarget).data("cible"));
      cible.toggle();
      $(e.currentTarget).text(cible.is(":visible") ? "Masquer la liste" : "Afficher la liste");
    });
    $("#o_filtreTout").click(() => {
      $(".o_filtreJoueur").prop("checked", true);
      appliquer();
    });
    $("#o_filtreAucun").click(() => {
      $(".o_filtreJoueur").prop("checked", false);
      appliquer();
    });
    return this;
  }
  /**
   * Options de la chaîne (départ, tracé), mémorisées par alliance.
   *
   * @private
   * @method _chargerOptionsChaine
   */
  _chargerOptionsChaine() {
    let o = {};
    try {
      o =
        JSON.parse(
          localStorage.getItem(`outiiil_carteChaine_${Utils.serveur}_${Utils.alliance}`),
        ) || {};
    } catch (e) {
      o = {};
    }
    return { depart: o.depart || "", tracer: !!o.tracer };
  }
  /**
   * @private
   * @method _sauverOptionsChaine
   */
  _sauverOptionsChaine() {
    try {
      localStorage.setItem(
        `outiiil_carteChaine_${Utils.serveur}_${Utils.alliance}`,
        JSON.stringify(this._optionsChaine),
      );
    } catch (e) {
      console.warn("outiiil: localStorage write failed", e);
    }
    return this;
  }
  /**
   * @private
   * @method _evenementsChaine
   */
  _evenementsChaine() {
    if (!this._optionsChaine) this._optionsChaine = this._chargerOptionsChaine();
    $("#o_chaineTracer").prop("checked", this._optionsChaine.tracer);
    let redessiner = () => {
      this._optionsChaine = {
        depart: $("#o_chaineDepart").val() || "",
        tracer: $("#o_chaineTracer").prop("checked"),
      };
      this._sauverOptionsChaine();
      this._redessiner();
    };
    $("#o_chaineDepart, #o_chaineTracer").on("change", redessiner);
    // calculée à la demande : la carte s'affiche sans l'attendre
    $("#o_chaineCalculer").click(() => {
      this._chaineVoulue = true;
      if (this._carteMembres) this._chaineAJour(this._filtrerMembres(this._carteMembres), true);
    });
    let copie = new Clipboard("#o_chaineCopier", {
      text: () => {
        this._chaineVoulue = true;
        if (this._carteMembres) this._chaineAJour(this._filtrerMembres(this._carteMembres), true);
        return this._texteChaine();
      },
    });
    copie.on("success", () => {
      $.toast({ ...TOAST_SUCCESS, text: "La chaîne a été copiée dans le presse papier." });
    });
    copie.on("error", () => {
      $.toast({ ...TOAST_ERROR, text: "Une erreur a été rencontrée, la copie a échoué." });
    });
    return this;
  }
  /**
   * Temps de trajet de base (sans Vitesse d'attaque) entre deux fourmilières.
   *
   * @private
   * @method _tempsEntre
   */
  _tempsEntre(a, b) {
    return Math.round(637200 * (1 - Math.exp(-Math.hypot(a.x - b.x, a.y - b.y) / 350)));
  }
  /**
   * Temps de trajet de base entre chaque paire de membres, calculés une fois
   * pour toute la chaîne.
   *
   * @private
   * @method _matriceTemps
   * @param {Array} membres
   * @return {Array<Array<Number>>}
   */
  _matriceTemps(membres) {
    return membres.map((a) => membres.map((b) => this._tempsEntre(a, b)));
  }
  /**
   * Ordre de passage qui minimise la somme des temps de trajet : plus proche
   * voisin depuis le départ, puis amélioration 2-opt (on inverse un morceau du
   * parcours tant que ça raccourcit le total), sur les temps de la matrice.
   *
   * @private
   * @method _calculerChaine
   * @param {Array} membres membres affichés
   * @param {Object} depart membre de départ
   * @param {Array<Array<Number>>} [temps] _matriceTemps(membres)
   */
  _calculerChaine(membres, depart, temps = this._matriceTemps(membres)) {
    let n = membres.length,
      debut = membres.indexOf(depart),
      ordre = [debut],
      restants = membres.map((m, k) => k).filter((k) => k != debut);
    while (restants.length) {
      let dernier = ordre[ordre.length - 1],
        i = 0;
      restants.forEach((m, j) => {
        if (temps[dernier][m] < temps[dernier][restants[i]]) i = j;
      });
      ordre.push(restants.splice(i, 1)[0]);
    }
    // rien après le bout de la chaîne
    const t = (/** @type {Number} */ a, /** @type {Number|undefined} */ b) =>
      b === undefined ? 0 : temps[a][b];
    let ameliore = n > 3;
    while (ameliore) {
      ameliore = false;
      for (let i = 1; i < n - 1; i++)
        for (let k = i + 1; k < n; k++) {
          let avant = t(ordre[i - 1], ordre[i]) + t(ordre[k], ordre[k + 1]),
            apres = t(ordre[i - 1], ordre[k]) + t(ordre[i], ordre[k + 1]);
          if (apres < avant) {
            for (let a = i, b = k; a < b; a++, b--) [ordre[a], ordre[b]] = [ordre[b], ordre[a]];
            ameliore = true;
          }
        }
    }
    return this._chaineDepuisOrdre(ordre.map((k) => membres[k]));
  }
  /**
   * Temps de chaque étape d'un ordre de passage donné.
   *
   * @private
   * @method _chaineDepuisOrdre
   */
  _chaineDepuisOrdre(ordre) {
    let etapes = ordre.slice(1).map((m, k) => this._tempsEntre(ordre[k], m));
    return {
      ordre: ordre,
      etapes: etapes,
      total: etapes.reduce((s, v) => s + v, 0),
      max: etapes.length ? Math.max(...etapes) : 0,
    };
  }
  /**
   * Départ libre : on essaie chaque membre comme départ et on garde la chaîne
   * la plus courte, orientée du bas vers le haut de la carte (la parcourir dans
   * un sens ou dans l'autre prend le même temps).
   *
   * @private
   * @method _chaineLaPlusCourte
   */
  _chaineLaPlusCourte(membres) {
    let temps = this._matriceTemps(membres),
      c = membres
        .map((m) => this._calculerChaine(membres, m, temps))
        .reduce((a, b) => (b.total < a.total ? b : a));
    if (c.ordre[0].y > c.ordre[c.ordre.length - 1].y) {
      c.ordre.reverse();
      c.etapes.reverse();
    }
    return c;
  }
  /**
   * Chaîne des membres affichés : celle déjà calculée pour ces membres et ce
   * départ, sinon calculée si `calculer`, sinon le tableau invite à la
   * calculer. Remplit la liste des départs et le tableau sous la carte.
   *
   * @private
   * @method _chaineAJour
   * @param {Array} membres membres affichés
   * @param {Boolean} calculer
   * @return {Object|null}
   */
  _chaineAJour(membres, calculer) {
    if (!this._optionsChaine) this._optionsChaine = this._chargerOptionsChaine();
    $("#o_carteChaine").show();
    let echapper = (/** @type {String} */ t) => $("<div>").text(t).html(),
      pseudos = membres.map((m) => m.pseudo).sort((a, b) => a.localeCompare(b)),
      // sans départ choisi (ou s'il n'est plus affiché), départ libre
      depart = membres.find((m) => m.pseudo === this._optionsChaine.depart),
      cle =
        (depart ? depart.pseudo : "") +
        "|" +
        membres
          .map((m) => `${m.pseudo}:${m.x}:${m.y}`)
          .sort()
          .join(",");
    $("#o_chaineDepart").html(
      `<option value=''>Le plus court (départ libre)</option>` +
        pseudos.map((p) => `<option value='${echapper(p)}'>${echapper(p)}</option>`).join(""),
    );
    $("#o_chaineDepart").val(depart ? depart.pseudo : "");
    if (this._chaine && this._chaine.cle == cle) return this._chaine;
    this._chaine = null;
    if (membres.length < 2) {
      $("#o_chaineListe").html(
        "<tr><td><em>Il faut au moins deux membres affichés pour former une chaîne.</em></td></tr>",
      );
      $("#o_chaineCopier, #o_chaineCalculer").prop("disabled", true);
      return null;
    }
    $("#o_chaineCopier, #o_chaineCalculer").prop("disabled", false);
    if (!calculer) {
      $("#o_chaineListe").html(
        "<tr><td><em>« Calculer la chaîne » établit l'ordre de passage des membres affichés.</em></td></tr>",
      );
      return null;
    }
    let chaine = (this._chaine = {
        ...(depart ? this._calculerChaine(membres, depart) : this._chaineLaPlusCourte(membres)),
        cle,
      }),
      lien = (m) => `<a href='Membre.php?Pseudo=${m.pseudo}'>${echapper(m.pseudo)}</a>`,
      lignes = chaine.ordre.map((m, k) => {
        let vers = chaine.ordre[k + 1];
        return `<tr><td>${k + 1}</td><td>${lien(m)}${m.isMe ? " <em>(toi)</em>" : ""}</td><td>${m.x} / ${m.y}</td>
          <td>${vers ? lien(vers) : "—"}</td><td>${vers ? Utils.intToTime(chaine.etapes[k]) : "—"}</td></tr>`;
      });
    $("#o_chaineListe").html(
      `<thead><tr><th>#</th><th>Joueur</th><th>Position</th><th>Envoie à</th><th>Temps de trajet</th></tr></thead>
      <tbody>${lignes.join("")}
        <tr class='reduce'><td colspan='5'><em>${chaine.etapes.length} étapes · temps cumulé ${Utils.intToTime(chaine.total)} · plus longue étape ${Utils.intToTime(chaine.max)}</em></td></tr>
      </tbody>`,
    );
    $("#o_chaineListe tr:even").css("background-color", monProfil.parametre["couleur2"].valeur);
    return chaine;
  }
  /**
   * Texte de la chaîne pour le forum, une étape par ligne.
   *
   * @private
   * @method _texteChaine
   */
  _texteChaine() {
    let c = this._chaine;
    if (!c) return "";
    let n = c.ordre.length,
      lignes = c.etapes.map(
        (t, k) =>
          `${k + 1}. ${c.ordre[k].pseudo} → ${c.ordre[k + 1].pseudo} (${Utils.intToTime(t)})`,
      );
    return (
      `Chaîne de ${n} joueurs :\n${lignes.join("\n")}\n` +
      `Temps cumulé ${Utils.intToTime(c.total)}, plus longue étape ${Utils.intToTime(c.max)} (sans Vitesse d'attaque)`
    );
  }
  /**
   * Point d'entrée de la carte : mémorise la liste complète, (re)construit les
   * filtres, puis dessine la carte filtrée, avec les autres joueurs ajoutés
   * (lus dans l'export public : tout de suite si sa copie gardée est à jour,
   * sinon après sa lecture, la carte redessinée).
   *
   * @private
   * @method _renderCarte
   */
  _renderCarte(membres) {
    this._carteMembres = membres;
    this._listeAutres();
    this._filtres = this._chargerFiltres();
    this._construireFiltres(membres);
    let entrees = PageAlliance.autresGardes(),
      base = entrees.length ? ExportJoueurs.gardee(true) : null;
    if (base) this._poserAutres(base);
    this._dessinerCarte(this._filtrerMembres(membres), membres.length);
    if (entrees.length && !base) this._lireAutres();
  }
  /**
   * Cadre de la carte autour des points, avec une marge ; avec la largeur de
   * la carte, de quoi écrire le nom d'un point du haut au-dessus de lui (sinon
   * Highcharts le ramène dans le tracé, sur le point).
   *
   * @static
   * @method bornesCarte
   * @param {Array<{x: Number, y: Number}>} points
   * @param {Number} [largeur] px
   * @return {{xMin: Number, xMax: Number, yMin: Number, yMax: Number}}
   */
  static bornesCarte(points, largeur = 0) {
    let xs = points.map((p) => p.x),
      ys = points.map((p) => p.y),
      xMin = Math.min(...xs),
      xMax = Math.max(...xs),
      yMin = Math.min(...ys),
      yMax = Math.max(...ys),
      marge = Math.max(2, 0.06 * Math.max(xMax - xMin, yMax - yMin)),
      b = { xMin: xMin - marge, xMax: xMax + marge, yMin: yMin - marge, yMax: yMax + marge };
    if (!largeur) return b;
    let parPixel = Math.max(
      (b.xMax - b.xMin) / Math.max(1, largeur - MARGES_CARTE.largeur),
      (b.yMax - b.yMin) / Math.max(1, PageAlliance.hauteurCarte(b, largeur) - MARGES_CARTE.hauteur),
    );
    return { ...b, yMax: b.yMax + PX_NOM_CARTE * parPixel };
  }
  /**
   * Cadre qui contient `bornes`, centré sur elles, avec autant d'unités par
   * pixel en X qu'en Y sur un tracé de `largeur` × `hauteur` px : le temps de
   * trajet suit la distance en ligne droite, une case de travers ne doit pas
   * paraître plus loin qu'en face.
   *
   * @static
   * @method cadreOrthonorme
   * @param {{xMin: Number, xMax: Number, yMin: Number, yMax: Number}} bornes
   * @param {Number} largeur px
   * @param {Number} hauteur px
   * @return {{xMin: Number, xMax: Number, yMin: Number, yMax: Number}}
   */
  static cadreOrthonorme(bornes, largeur, hauteur) {
    let l = Math.max(1, largeur),
      h = Math.max(1, hauteur),
      parPixel = Math.max((bornes.xMax - bornes.xMin) / l, (bornes.yMax - bornes.yMin) / h, 1e-6),
      cx = (bornes.xMin + bornes.xMax) / 2,
      cy = (bornes.yMin + bornes.yMax) / 2;
    return {
      xMin: cx - (parPixel * l) / 2,
      xMax: cx + (parPixel * l) / 2,
      yMin: cy - (parPixel * h) / 2,
      yMax: cy + (parPixel * h) / 2,
    };
  }
  /**
   * Hauteur de la carte (px) pour une largeur donnée : celle qui garde les
   * proportions des positions, entre 320 et 900 px (au-delà, le cadre
   * s'élargit pour garder la même échelle).
   *
   * @static
   * @method hauteurCarte
   */
  static hauteurCarte(bornes, largeur) {
    let trace = Math.max(150, largeur - MARGES_CARTE.largeur),
      hauteur =
        (trace * (bornes.yMax - bornes.yMin)) / Math.max(1e-6, bornes.xMax - bornes.xMin) +
        MARGES_CARTE.hauteur;
    return Math.round(Math.min(900, Math.max(320, hauteur)));
  }
  /**
   * Met les axes au cadre orthonormé du tracé réel (repris par « Reset zoom ») ;
   * refait une fois si la largeur des graduations a changé le tracé.
   *
   * @static
   * @method cadrer
   * @param {any} chart graphique Highcharts
   * @param {{xMin: Number, xMax: Number, yMin: Number, yMax: Number}} bornes
   */
  static cadrer(chart, bornes) {
    for (let essai = 0; essai < 2; essai++) {
      let l = chart.plotWidth,
        h = chart.plotHeight,
        c = PageAlliance.cadreOrthonorme(bornes, l, h);
      chart.xAxis[0].update({ min: c.xMin, max: c.xMax }, false);
      chart.yAxis[0].update({ min: c.yMin, max: c.yMax }, false);
      chart.redraw(false);
      if (chart.plotWidth == l && chart.plotHeight == h) return;
    }
  }
  /**
   * Zoom par glisser : la zone choisie est élargie dans un sens pour garder
   * la même échelle sur les deux axes.
   *
   * @static
   * @method zoomOrthonorme
   * @param {any} chart
   * @param {any} e événement « selection » de Highcharts
   * @return {Boolean} false : zoom fait ici
   */
  static zoomOrthonorme(chart, e) {
    if (e.resetSelection || !e.xAxis || !e.yAxis) return true;
    let c = PageAlliance.cadreOrthonorme(
      { xMin: e.xAxis[0].min, xMax: e.xAxis[0].max, yMin: e.yAxis[0].min, yMax: e.yAxis[0].max },
      chart.plotWidth,
      chart.plotHeight,
    );
    chart.xAxis[0].setExtremes(c.xMin, c.xMax, false);
    chart.yAxis[0].setExtremes(c.yMin, c.yMax, false);
    chart.redraw();
    chart.showResetZoom();
    return false;
  }
  /**
   * Couleur, forme et taille d'une ligne de la Carte, chacune parmi celles
   * proposées, sinon celle par défaut.
   *
   * @static
   * @method style
   * @param {any} e ligne gardée
   * @param {{couleur: String, forme: String, taille: String}} defaut
   * @return {{couleur: String, forme: String, taille: String}}
   */
  static style(e, defaut) {
    let x = e || {},
      couleur = COULEURS_CARTE_REMPLACEES[x.couleur] || x.couleur;
    return {
      couleur: COULEURS_CARTE.some((c) => c[1] == couleur) ? couleur : defaut.couleur,
      forme: FORMES_CARTE.some((f) => f[0] == x.forme) ? x.forme : defaut.forme,
      taille: TAILLES_CARTE.some((t) => t[0] == x.taille) ? x.taille : defaut.taille,
    };
  }
  /**
   * Couleur, forme et taille des membres de mon alliance sur la carte.
   *
   * @static
   * @method styleMembres
   */
  static styleMembres() {
    return PageAlliance.style(Utils.lireStockage(CLE_CARTE_STYLE_MEMBRES), STYLE_CARTE_MEMBRES);
  }
  /**
   * Membres de mon alliance masqués sur la carte (bouton de sa ligne).
   *
   * @static
   * @method membresMasques
   * @return {Boolean}
   */
  static membresMasques() {
    return Utils.lireStockage(CLE_CARTE_MEMBRES_MASQUES, false) === true;
  }
  /**
   * Couleur, forme et taille de ma fourmilière sur la carte.
   *
   * @static
   * @method styleMoi
   */
  static styleMoi() {
    return PageAlliance.style(Utils.lireStockage(CLE_CARTE_STYLE_MOI), STYLE_CARTE_MOI);
  }
  /**
   * Ma fourmilière masquée sur la carte (bouton de sa ligne), indépendamment de mon alliance.
   *
   * @static
   * @method moiMasque
   * @return {Boolean}
   */
  static moiMasque() {
    return Utils.lireStockage(CLE_CARTE_MOI_MASQUE, false) === true;
  }
  /**
   * Joueurs et alliances ajoutés à la carte, couleur, forme et taille vérifiées.
   *
   * @static
   * @method autresGardes
   * @return {Array<{type: String, nom: String, couleur: String, forme: String, taille: String}>}
   */
  static autresGardes() {
    let liste = Utils.lireStockage(CLE_CARTE_AUTRES, []);
    return (Array.isArray(liste) ? liste : [])
      .filter(
        (e) => e && (e.type == "joueur" || e.type == "alliance") && String(e.nom || "").trim(),
      )
      .map((e) => ({
        type: e.type,
        nom: String(e.nom).trim(),
        ...PageAlliance.style(e, STYLE_CARTE_AUTRE),
      }));
  }
  /**
   * Marqueur Highcharts d'une case de la carte, à la couleur, la forme et la
   * taille de sa ligne : une case de plusieurs joueurs plus grande et cerclée
   * de noir, la mienne cerclée de noir aussi. La croix, faite de traits, prend
   * la couleur dans son trait.
   *
   * @static
   * @method marqueur
   * @param {{couleur: String, forme: String, taille: String}} style
   * @param {{n?: Number, moi?: Boolean}} [cas] n : joueurs sur la case
   * @return {any}
   */
  static marqueur(style, cas = {}) {
    let n = cas.n || 1,
      forme = FORMES_CARTE.find((f) => f[0] == style.forme) || FORMES_CARTE[0],
      rayon = (TAILLES_CARTE.find((t) => t[0] == style.taille) || TAILLES_CARTE[1])[2] + forme[4],
      couleur = style.couleur,
      marque = n > 1 || !!cas.moi;
    if (forme[2] == SYMBOLE_CROIX)
      return {
        symbol: forme[2],
        radius: rayon + Math.min(n - 1, 3),
        fillColor: couleur,
        lineColor: couleur,
        lineWidth: marque ? 3.5 : 2.5,
      };
    return {
      symbol: forme[2],
      radius: rayon + Math.min(n - 1, 3),
      fillColor: couleur,
      lineColor: marque ? "#222" : "#fff",
      lineWidth: marque ? 2 : 1.5,
    };
  }
  /**
   * Ajoute la croix aux formes de Highcharts (une fois).
   *
   * @static
   * @method formeCroix
   */
  static formeCroix() {
    let symboles =
      typeof Highcharts != "undefined" &&
      Highcharts.SVGRenderer &&
      Highcharts.SVGRenderer.prototype.symbols;
    if (symboles && !symboles[SYMBOLE_CROIX])
      symboles[SYMBOLE_CROIX] = (
        /** @type {Number} */ x,
        /** @type {Number} */ y,
        /** @type {Number} */ w,
        /** @type {Number} */ h,
      ) => ["M", x, y, "L", x + w, y + h, "M", x + w, y, "L", x, y + h];
  }
  /**
   * Caractère de la forme, à la couleur de la ligne, pour la liste et la légende.
   *
   * @static
   * @method glyphe
   * @param {{couleur: String, forme: String}} style
   * @return {String} HTML
   */
  static glyphe(style) {
    let forme = FORMES_CARTE.find((f) => f[0] == style.forme) || FORMES_CARTE[0];
    return `<span class='o_carteSymbole' style='color:${style.couleur};'>${forme[3]}</span>`;
  }
  /**
   * Pseudos et tags de l'export public, pour les suggestions de saisie.
   *
   * @static
   * @method indexSuggestions
   * @param {Object<string, Array<any>>} base {pseudo: [x, y, terrain, id, seigneur, alliance]}
   * @return {{joueurs: Array<any>, alliances: Array<any>}}
   */
  static indexSuggestions(base) {
    let tags = new Map(),
      joueurs = Object.keys(base).map((p) => {
        let tag = base[p][5] || "";
        if (tag) tags.set(tag, (tags.get(tag) || 0) + 1);
        return { nom: p, min: p.toLowerCase(), tag, terrain: Number(base[p][2]) || 0 };
      });
    return {
      joueurs,
      alliances: [...tags].map(([tag, n]) => ({ nom: tag, min: tag.toLowerCase(), n })),
    };
  }
  /**
   * Pseudos ou tags qui contiennent le texte saisi (casse ignorée), ceux qui
   * commencent par lui d'abord, puis dans l'ordre alphabétique ; sans mon
   * alliance, ses membres ni ce qui est déjà sur la carte.
   *
   * @static
   * @method suggestions
   * @param {{joueurs: Array<any>, alliances: Array<any>}} index indexSuggestions
   * @param {String} type "joueur" ou "alliance"
   * @param {String} texte
   * @param {{tag: String, deja: Array<String>}} exclus mon tag ; noms déjà ajoutés de ce type
   * @param {Number} [max]
   * @return {Array<{valeur: String, detail: String}>}
   */
  static suggestions(index, type, texte, exclus, max = SUGGESTIONS_CARTE_MAX) {
    let t = String(texte || "")
        .trim()
        .toLowerCase(),
      tag = String(exclus.tag || "").toLowerCase(),
      deja = new Set(exclus.deja.map((n) => String(n).toLowerCase()));
    if (!t) return [];
    return (type == "alliance" ? index.alliances : index.joueurs)
      .filter(
        (e) =>
          e.min.includes(t) &&
          !deja.has(e.min) &&
          (type == "alliance" ? e.min != tag : !tag || e.tag.toLowerCase() != tag),
      )
      .sort(
        (a, b) =>
          Number(!a.min.startsWith(t)) - Number(!b.min.startsWith(t)) ||
          a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" }),
      )
      .slice(0, max)
      .map((e) => ({
        valeur: e.nom,
        detail:
          type == "alliance"
            ? `${e.n} joueur${e.n > 1 ? "s" : ""}`
            : `${e.tag ? `[${e.tag}]` : "sans alliance"} · ${numeral(e.terrain).format()} cm²`,
      }));
  }
  /**
   * @private
   * @static
   */
  static _garderAutres(liste) {
    try {
      localStorage.setItem(CLE_CARTE_AUTRES, JSON.stringify(liste));
    } catch (e) {}
  }
  /**
   * Points des joueurs et alliances ajoutés, d'après la base de l'export
   * public : un joueur ajouté seul garde sa couleur même si son alliance est
   * ajoutée aussi ; un membre de mon alliance n'y est jamais (il est sur la
   * carte comme membre). Pseudos et tags comparés sans la casse.
   *
   * @static
   * @method resoudreAutres
   * @param {Array<{type: String, nom: String, couleur: String}>} entrees
   * @param {Object<string, Array<any>>} base {pseudo: [x, y, terrain, id, seigneur, alliance]}
   * @param {String} monAlliance tag
   * @param {Array<String>} membres pseudos des membres
   * @return {{points: Array<any>, etats: Array<String>}} etats : ce qui est affiché pour chaque entrée
   */
  static resoudreAutres(entrees, base, monAlliance, membres) {
    let min = (/** @type {any} */ t) => String(t || "").toLowerCase(),
      exclus = new Set(membres.map(min)),
      tag = min(monAlliance),
      pseudos = Object.keys(base),
      parMin = new Map(pseudos.map((p) => [min(p), p])),
      places = new Map(),
      etats = entrees.map(() => ""),
      dansMonAlliance = (/** @type {String} */ p) =>
        exclus.has(min(p)) || (!!tag && min(base[p][5]) == tag),
      placer = (/** @type {String} */ p, /** @type {any} */ e) => {
        let j = base[p];
        places.set(min(p), {
          pseudo: p,
          x: j[0],
          y: j[1],
          terrain: Number(j[2]) || 0,
          alliance: j[5] || "",
          couleur: e.couleur,
          forme: e.forme,
          taille: e.taille,
        });
      };
    entrees.forEach((e, k) => {
      if (e.type != "joueur") return;
      let p = parMin.get(min(e.nom));
      if (!p) etats[k] = "introuvable dans la liste publique des joueurs";
      else if (dansMonAlliance(p)) etats[k] = "membre de ton alliance";
      else {
        placer(p, e);
        let j = base[p];
        etats[k] = `${j[5] ? j[5] : "sans alliance"} · ${numeral(Number(j[2]) || 0).format()} cm²`;
      }
    });
    entrees.forEach((e, k) => {
      if (e.type != "alliance") return;
      let n = 0;
      pseudos.forEach((p) => {
        if (min(base[p][5]) != min(e.nom) || dansMonAlliance(p) || places.has(min(p))) return;
        placer(p, e);
        n++;
      });
      etats[k] = n ? `${n} joueur${n > 1 ? "s" : ""}` : "aucun joueur dans la liste publique";
    });
    return { points: [...places.values()], etats };
  }
  /**
   * Joueurs et alliances ajoutés résolus avec la base donnée (gardée pour les
   * changements de couleur et les retraits), liste mise à jour.
   *
   * @private
   * @method _poserAutres
   */
  _poserAutres(base) {
    this._baseAutres = base;
    let membres = [
      ...Object.keys((this._alliance && this._alliance.joueurs) || {}),
      ...(this._carteMembres || []).map((m) => m.pseudo),
    ];
    this._autres = PageAlliance.resoudreAutres(
      PageAlliance.autresGardes(),
      base,
      Utils.alliance,
      membres,
    );
    this._listeAutres();
  }
  /**
   * Lit l'export public (au plus une fois par heure) pour placer les joueurs
   * ajoutés, puis redessine la carte.
   *
   * @private
   * @method _lireAutres
   */
  _lireAutres() {
    return ExportJoueurs.avecAlliances().then(
      (base) => {
        this._poserAutres(base);
        this._redessiner();
      },
      () => {
        $("#o_carteAutresListe").prepend(
          "<li class='reduce o_secondaire'>Liste publique des joueurs illisible pour l'instant : les joueurs ajoutés n'apparaissent pas.</li>",
        );
      },
    );
  }
  /**
   * Lignes de la carte, sous les filtres : mon alliance d'abord (ses membres),
   * puis les joueurs et alliances ajoutés ; couleur, forme et taille sur
   * chacune, et une ✕ sur les ajoutés.
   *
   * @private
   * @method _listeAutres
   */
  _listeAutres() {
    let entrees = PageAlliance.autresGardes(),
      membres = PageAlliance.styleMembres(),
      etats = this._autres ? this._autres.etats : [],
      echapper = (/** @type {String} */ t) => $("<div>").text(t).html(),
      choix = (
        /** @type {Array<Array<any>>} */ liste,
        /** @type {String} */ choisie,
        /** @type {String} */ champ,
        /** @type {String} */ libelle,
      ) =>
        `<select class='o_carteStyle' data-champ='${champ}' aria-label='${echapper(libelle)}'>${liste
          .map(
            ([valeur, nom]) =>
              `<option value='${valeur}'${valeur == choisie ? " selected" : ""}>${nom}</option>`,
          )
          .join("")}</select>`,
      reglages = (/** @type {any} */ style, /** @type {String} */ nom, retirer = "") =>
        `<span class='o_carteAutreActions'>${choix(
          COULEURS_CARTE.map(([n, v]) => [v, n]),
          style.couleur,
          "couleur",
          `Couleur de ${nom}`,
        )}${choix(FORMES_CARTE, style.forme, "forme", `Forme de ${nom}`)}<span class='o_carteAutreFin'>${choix(
          TAILLES_CARTE,
          style.taille,
          "taille",
          `Taille de ${nom}`,
        )}${retirer}</span></span>`,
      nbMembres = this._carteMembres ? this._carteMembres.length : 0,
      masques = PageAlliance.membresMasques(),
      moi = PageAlliance.styleMoi(),
      moiMasque = PageAlliance.moiMasque(),
      lignes = [
        `<li data-k='membres' class='o_carteLigneMembres${masques ? " o_carteLigneMasquee" : ""}'>${PageAlliance.glyphe(membres)}<b>${echapper(Utils.alliance)}</b> <span class='reduce'>ton alliance${nbMembres ? ` · ${nbMembres} membres` : ""}${masques ? " · masquée" : ""}</span>
          ${reglages(
            membres,
            Utils.alliance,
            `<button type='button' class='o_carteMasquer o_button f_info' aria-pressed='${masques}' title='${masques ? "Remettre les membres de ton alliance sur la carte" : "Retirer les membres de ton alliance de la carte (pas ta fourmilière, qui a sa ligne), pour regarder les joueurs et alliances ajoutés"}'>${masques ? "Afficher" : "Masquer"}</button>`,
          )}</li>`,
        `<li data-k='moi' class='o_carteLigneMoi${moiMasque ? " o_carteLigneMasquee" : ""}'>${PageAlliance.glyphe(moi)}<b>${echapper(monProfil.pseudo)}</b> <span class='reduce'>ta fourmilière${moiMasque ? " · masquée" : ""}</span>
          ${reglages(
            moi,
            "ta fourmilière",
            `<button type='button' class='o_carteMasquer o_button f_info' aria-pressed='${moiMasque}' title='${moiMasque ? "Remettre ta fourmilière sur la carte" : "Retirer ta fourmilière de la carte"}'>${moiMasque ? "Afficher" : "Masquer"}</button>`,
          )}</li>`,
        ...entrees.map(
          (e, k) =>
            `<li data-k='${k}'>${PageAlliance.glyphe(e)}<b>${echapper(e.nom)}</b> <span class='reduce'>${e.type == "alliance" ? "alliance" : "joueur"}${etats[k] ? ` · ${echapper(etats[k])}` : ""}</span>
              ${reglages(e, e.nom, "<span class='o_carteAutreRetirer cursor' role='button' title='Retirer de la carte'>✕</span>")}</li>`,
        ),
      ];
    if (!entrees.length)
      lignes.push(
        "<li class='reduce o_secondaire'>Ajoute un joueur ou une alliance entière (alliés, ennemis, recrues…).</li>",
      );
    $("#o_carteAutresListe").html(lignes.join(""));
    // couleur proposée : la première que ni mon alliance, ni moi, ni un ajouté n'a prise
    let prises = [membres.couleur, moi.couleur, ...entrees.map((e) => e.couleur)],
      libre = COULEURS_CARTE.find((c) => !prises.includes(c[1]));
    $("#o_carteAutreCouleur").val((libre || COULEURS_CARTE[1])[1]);
    $("#o_carteAutreApercu").css("color", String($("#o_carteAutreCouleur").val()));
  }
  /**
   * Ajout, réglages et retrait des lignes ; suggestions pendant la saisie.
   *
   * @private
   * @method _evenementsAutres
   */
  _evenementsAutres() {
    let changer = (/** @type {(liste: Array<any>) => void} */ modifier) => {
      let liste = PageAlliance.autresGardes();
      modifier(liste);
      PageAlliance._garderAutres(liste);
      if (this._baseAutres) this._poserAutres(this._baseAutres);
      else this._listeAutres();
      this._redessiner();
    };
    $("#o_carteAutreAjouter").on("click", () => this._ajouterAutre());
    $("#o_carteAutreCouleur").on("change", (e) =>
      $("#o_carteAutreApercu").css("color", String($(e.currentTarget).val())),
    );
    $("#o_carteAutreNom")
      .on("keydown", (e) => {
        if (e.key == "Enter") {
          e.preventDefault();
          this._cacherSuggestions();
          this._ajouterAutre();
        } else if (e.key == "Escape") this._cacherSuggestions();
      })
      .on("focus", () => this._chargerSuggestions())
      .on("input", () => this._proposer())
      // après le clic sur une suggestion (mousedown la garde du blur)
      .on("blur", () => {
        setTimeout(() => this._cacherSuggestions(), 200);
      });
    $("#o_carteAutreType").on("change", () => this._proposer());
    $("#o_carteSuggestions")
      .on("mousedown", (e) => e.preventDefault())
      .on("click", "li[data-valeur]", (e) => {
        $("#o_carteAutreNom")
          .val(String($(e.currentTarget).data("valeur")))
          .trigger("focus");
        this._cacherSuggestions();
      });
    $("#o_carteAutresListe")
      .on("change", ".o_carteStyle", (e) => {
        let k = $(e.currentTarget).closest("li").data("k"),
          champ = String($(e.currentTarget).data("champ")),
          valeur = String($(e.currentTarget).val());
        if (k == "membres" || k == "moi") {
          let [cle, actuel] =
            k == "moi"
              ? [CLE_CARTE_STYLE_MOI, PageAlliance.styleMoi()]
              : [CLE_CARTE_STYLE_MEMBRES, PageAlliance.styleMembres()];
          try {
            localStorage.setItem(cle, JSON.stringify({ ...actuel, [champ]: valeur }));
          } catch (err) {}
          this._listeAutres();
          this._redessiner();
          return;
        }
        changer((liste) => {
          if (liste[Number(k)]) liste[Number(k)][champ] = valeur;
        });
      })
      .on("click", ".o_carteMasquer", (e) => {
        let moi = $(e.currentTarget).closest("li").data("k") == "moi",
          cle = moi ? CLE_CARTE_MOI_MASQUE : CLE_CARTE_MEMBRES_MASQUES,
          masque = moi ? PageAlliance.moiMasque() : PageAlliance.membresMasques();
        try {
          if (masque) localStorage.removeItem(cle);
          else localStorage.setItem(cle, "true");
        } catch (err) {}
        this._listeAutres();
        this._redessiner();
      })
      .on("click", ".o_carteAutreRetirer", (e) => {
        let k = Number($(e.currentTarget).closest("li").data("k"));
        changer((liste) => liste.splice(k, 1));
      });
    this._listeAutres();
  }
  /**
   * Lit l'export public pour les suggestions (au plus une fois par heure, au
   * premier passage dans le champ).
   *
   * @private
   * @method _chargerSuggestions
   */
  _chargerSuggestions() {
    if (this._suggestions) return this._suggestions;
    this._indexSuggestions = null;
    this._suggestions = ExportJoueurs.avecAlliances().then(
      (base) => {
        this._indexSuggestions = PageAlliance.indexSuggestions(base);
        this._proposer();
      },
      () => {
        this._suggestionsIllisibles = true;
        this._proposer();
      },
    );
    return this._suggestions;
  }
  /**
   * Suggestions sous le champ pour le texte saisi.
   *
   * @private
   * @method _proposer
   */
  _proposer() {
    let texte = String($("#o_carteAutreNom").val() || "").trim(),
      type = String($("#o_carteAutreType").val()),
      $liste = $("#o_carteSuggestions"),
      echapper = (/** @type {String} */ t) => $("<div>").text(t).html(),
      message = (/** @type {String} */ t) =>
        $liste.html(`<li class='reduce o_secondaire'>${t}</li>`).show();
    if (!texte) return $liste.hide().empty();
    if (this._suggestionsIllisibles)
      return message(
        "Liste publique des joueurs illisible pour l'instant : saisis le nom en entier.",
      );
    if (!this._indexSuggestions) return message("Chargement de la liste publique des joueurs…");
    let proposees = PageAlliance.suggestions(this._indexSuggestions, type, texte, {
      tag: Utils.alliance,
      deja: PageAlliance.autresGardes()
        .filter((e) => e.type == type)
        .map((e) => e.nom),
    });
    if (!proposees.length)
      return message(
        type == "alliance" ? "Aucune alliance ne correspond." : "Aucun joueur ne correspond.",
      );
    $liste
      .html(
        proposees
          .map(
            (p) =>
              `<li role='option' data-valeur='${echapper(p.valeur)}'><b>${echapper(p.valeur)}</b> <span class='reduce'>${echapper(p.detail)}</span></li>`,
          )
          .join(""),
      )
      .show();
  }
  /**
   * @private
   * @method _cacherSuggestions
   */
  _cacherSuggestions() {
    $("#o_carteSuggestions").hide().empty();
  }
  /**
   * Ajoute le joueur ou l'alliance saisi, après l'avoir trouvé dans l'export
   * public (lu au plus une fois par heure), avec son orthographe du jeu.
   *
   * @private
   * @method _ajouterAutre
   * @return {Promise<void>}
   */
  _ajouterAutre() {
    let type = String($("#o_carteAutreType").val()),
      nom = String($("#o_carteAutreNom").val() || "").trim(),
      couleur = String($("#o_carteAutreCouleur").val()),
      min = (/** @type {any} */ t) => String(t || "").toLowerCase(),
      refus = (/** @type {String} */ texte) => $.toast({ ...TOAST_WARNING, text: texte });
    if (!nom) return Promise.resolve();
    if (PageAlliance.autresGardes().some((e) => e.type == type && min(e.nom) == min(nom)))
      return Promise.resolve(refus(`« ${nom} » est déjà sur la carte.`));
    if (type == "alliance" && min(nom) == min(Utils.alliance))
      return Promise.resolve(refus("Ton alliance est déjà sur la carte : ce sont les membres."));
    let $bouton = $("#o_carteAutreAjouter").prop("disabled", true);
    return ExportJoueurs.avecAlliances()
      .then(
        (base) => {
          let pseudos = Object.keys(base),
            exact =
              type == "joueur"
                ? pseudos.find((p) => min(p) == min(nom))
                : (pseudos.map((p) => base[p][5]).find((t) => t && min(t) == min(nom)) ?? null);
          if (!exact)
            return refus(
              `${type == "joueur" ? "Joueur" : "Alliance"} « ${nom} » introuvable dans la liste publique des joueurs (le jeu la refait chaque heure).`,
            );
          let membres = [
            ...Object.keys((this._alliance && this._alliance.joueurs) || {}),
            ...(this._carteMembres || []).map((m) => m.pseudo),
          ];
          if (
            type == "joueur" &&
            (membres.some((p) => min(p) == min(exact)) ||
              (!!Utils.alliance && min(base[exact][5]) == min(Utils.alliance)))
          )
            return refus(`${exact} est membre de ton alliance : il est déjà sur la carte.`);
          let liste = PageAlliance.autresGardes();
          liste.push({ type, nom: exact, ...STYLE_CARTE_AUTRE, couleur });
          PageAlliance._garderAutres(liste);
          $("#o_carteAutreNom").val("");
          this._poserAutres(base);
          this._redessiner();
        },
        () =>
          $.toast({
            ...TOAST_ERROR,
            text: "Liste publique des joueurs illisible pour l'instant : réessaie plus tard.",
          }),
      )
      .then(() => {
        $bouton.prop("disabled", false);
      });
  }
  /**
   * Vitesse d'attaque saisie : un niveau entier de 0 à 99.
   *
   * @static
   * @method vaTrajets
   * @param {any} saisie
   * @return {Number}
   */
  static vaTrajets(saisie) {
    let n = Math.floor(Number(String(saisie ?? "").replace(",", ".")));
    return Number.isFinite(n) ? Math.min(99, Math.max(0, n)) : 0;
  }
  /**
   * Temps de trajet du départ vers chaque cible, du plus court au plus long
   * (puis par pseudo) ; le départ lui-même retiré.
   *
   * @static
   * @method trajetsDepuis
   * @param {{pseudo: String, x: Number, y: Number}} depart
   * @param {Array<{pseudo: String, x: Number, y: Number}>} cibles
   * @param {Number} va Vitesse d'attaque de l'attaquant
   * @return {Array<any>} les cibles avec leur `temps` en secondes
   */
  static trajetsDepuis(depart, cibles, va) {
    let cle = (/** @type {String} */ p) => String(p || "").toLowerCase();
    return cibles
      .filter((c) => cle(c.pseudo) != cle(depart.pseudo))
      .map((c) => ({ ...c, temps: Joueur.tempsTrajet(depart, c, va) }))
      .sort((a, b) => a.temps - b.temps || a.pseudo.localeCompare(b.pseudo, "fr"));
  }
  /**
   * Tableau « Temps de trajet depuis un joueur » : le départ choisi (gardé),
   * vers les joueurs affichés sur la carte au dernier dessin.
   *
   * @private
   * @method _trajets
   */
  _trajets() {
    let p = this._pointsTrajets;
    if (!p) return;
    let echapper = (/** @type {String} */ t) => $("<div>").text(t).html(),
      cle = (/** @type {String} */ t) => String(t || "").toLowerCase(),
      tri = (/** @type {any} */ a, /** @type {any} */ b) => a.pseudo.localeCompare(b.pseudo, "fr"),
      membres = p.cibles.filter((c) => !c.ajoute && !c.moi).sort(tri),
      ajoutes = p.cibles.filter((c) => c.ajoute).sort(tri),
      voulu = $("#o_trajetsDepart").val() || Utils.lireStockage(CLE_CARTE_DEPART_TRAJETS, ""),
      depart = [p.moi, ...membres, ...ajoutes].find((c) => cle(c.pseudo) == cle(voulu)) || p.moi,
      option = (/** @type {any} */ c) =>
        $("<option>")
          .val(c.pseudo)
          .text(c.ajoute && c.alliance ? `${c.pseudo} [${c.alliance}]` : c.pseudo),
      groupe = (/** @type {String} */ nom, /** @type {Array<any>} */ liste) =>
        liste.length ? $("<optgroup>").attr("label", nom).append(liste.map(option)) : null;
    $("#o_trajetsDepart")
      .empty()
      .append(
        $("<option>").val(p.moi.pseudo).text(`Toi (${p.moi.pseudo})`),
        groupe(`Ton alliance (${Utils.alliance})`, membres),
        groupe("Joueurs et alliances ajoutés", ajoutes),
      )
      .val(depart.pseudo);
    let va = PageAlliance.vaTrajets($("#o_trajetsVa").val()),
      lignes = PageAlliance.trajetsDepuis(depart, p.cibles, va);
    if (!lignes.length) {
      $("#o_trajetsListe").html(
        "<tr><td><em>Aucun autre joueur affiché sur la carte.</em></td></tr>",
      );
      return;
    }
    $("#o_trajetsListe").html(
      `<thead><tr><th>Joueur</th><th>Alliance</th><th>Temps de trajet</th></tr></thead>
      <tbody>${lignes
        .map(
          (c) =>
            `<tr><td><a href='Membre.php?Pseudo=${encodeURIComponent(c.pseudo)}'>${echapper(c.pseudo)}</a>${c.moi ? " <em>(toi)</em>" : ""}</td><td>${c.alliance ? echapper(c.alliance) : "—"}</td><td>${Utils.intToTime(c.temps)}</td></tr>`,
        )
        .join("")}
        <tr class='reduce'><td colspan='3'><em>Depuis ${echapper(depart.pseudo)} (${depart.x} / ${depart.y}), Vitesse d'attaque ${va} · ${lignes.length} joueur${lignes.length > 1 ? "s" : ""}</em></td></tr>
      </tbody>`,
    );
    $("#o_trajetsListe tbody tr:even").css(
      "background-color",
      monProfil.parametre["couleur2"].valeur,
    );
  }
  /**
   * Render Highcharts dans #o_carteAllianceChart, à la même échelle sur les
   * deux axes. Regroupe les membres par case (x,y), relie chaque case à ses
   * plus proches voisines, affiche le temps de trajet au survol ; les joueurs
   * ajoutés sont des losanges à leur couleur, hors des liens et de la chaîne.
   *
   * @private
   * @method _dessinerCarte
   * @param {Array} members membres à tracer (déjà filtrés)
   * @param {Integer} total effectif avant filtrage, pour le titre
   */
  _dessinerCarte(members, total) {
    const $graphe = $("#o_carteAllianceChart").show();
    const styleMembres = PageAlliance.styleMembres();
    const masques = PageAlliance.membresMasques();
    const styleMoi = PageAlliance.styleMoi();
    const moiMasque = PageAlliance.moiMasque();
    PageAlliance.formeCroix();
    $("#o_carteLegende")
      .html(
        [
          masques
            ? "Ton alliance est masquée (« Afficher » sur sa ligne)"
            : `${PageAlliance.glyphe(styleMembres)} Membre`,
          moiMasque ? "ta fourmilière masquée" : `${PageAlliance.glyphe(styleMoi)} Toi`,
          "les autres : forme et couleur de leur ligne",
        ].join(" · "),
      )
      .show();
    // Désactive le warning Highcharts #15 : nos séries `line` représentent des arêtes
    // arbitraires entre cases (a→b dans n'importe quelle direction), donc les x ne
    // sont pas monotonement croissants. Le rendu marche, c'est juste un warning console.
    Highcharts.seriesTypes.line.prototype.requireSorting = false;
    const K_NEIGHBORS = 3; // chaque case reliée à ses K cases les plus proches
    const niveauVitesseAttaque = monProfil.niveauRecherche[6] || 0;
    members.forEach((m) => {
      m.isMe = m.pseudo === monProfil.pseudo;
    });
    const me = members.find((m) => m.isMe) || { x: monProfil.x, y: monProfil.y };
    // chaque ligne masquable à part : mon alliance (ses autres membres) et ma fourmilière
    const affiches = members.filter((m) => (m.isMe ? !moiMasque : !masques));
    const chaine = this._chaineAJour(
      members,
      !!(this._optionsChaine && this._optionsChaine.tracer) || !!this._chaineVoulue,
    );
    const tracer = !masques && !!(chaine && this._optionsChaine.tracer);
    const rangs = new Map(tracer ? chaine.ordre.map((m, k) => [m.pseudo, k + 1]) : []);
    const tempsParcours = (target, niveauVit) => Joueur.tempsTrajet(me, target, niveauVit);
    // Regroupement par case (x, y)
    const parCase = (liste) => {
      const cases = new Map();
      for (const m of liste) {
        const key = `${m.x},${m.y}`;
        if (!cases.has(key)) cases.set(key, { x: m.x, y: m.y, members: [] });
        cases.get(key).members.push(m);
      }
      return [...cases.values()];
    };
    // alliance masquée : ni ses cases, ni ses liens ; temps de trajet toujours depuis moi
    const spots = parCase(affiches).map((s) => ({
      ...s,
      isMyGroup: s.members.some((m) => m.isMe),
    }));
    const autres = parCase(this._autres ? this._autres.points : []);
    this._pointsTrajets = {
      moi: { pseudo: monProfil.pseudo, x: me.x, y: me.y, alliance: Utils.alliance },
      cibles: [
        ...affiches.map((m) => ({
          pseudo: m.pseudo,
          x: m.x,
          y: m.y,
          alliance: Utils.alliance,
          moi: !!m.isMe,
        })),
        ...(this._autres ? this._autres.points : []).map((a) => ({
          pseudo: a.pseudo,
          x: a.x,
          y: a.y,
          alliance: a.alliance,
          ajoute: true,
        })),
      ],
    };
    // ma Vitesse d'attaque proposée au premier dessin, puis celle saisie
    if (!this._vaTrajetsPosee) {
      $("#o_trajetsVa").val(niveauVitesseAttaque);
      this._vaTrajetsPosee = true;
    }
    $("#o_carteTrajets").show();
    this._trajets();
    // Liens : K plus proches voisins (s'adapte à l'étalement de l'alliance)
    const edgeSet = new Set();
    for (let i = 0; i < spots.length; i++) {
      const others = spots
        .map((s, j) => ({ idx: j, d: Math.hypot(s.x - spots[i].x, s.y - spots[i].y) }))
        .filter((o) => o.idx !== i)
        .sort((a, b) => a.d - b.d)
        .slice(0, K_NEIGHBORS);
      others.forEach((o) => {
        const key = i < o.idx ? `${i}-${o.idx}` : `${o.idx}-${i}`;
        edgeSet.add(key);
      });
    }
    // la chaîne tracée remplace les liens, sinon la carte devient illisible
    if (tracer) edgeSet.clear();
    const edges = [...edgeSet].map((key) => {
      const [i, j] = key.split("-").map(Number);
      return [spots[i], spots[j]];
    });
    // Split en deux séries : liens vers moi (vert) vs entre autres membres (gris)
    const myLineData = [];
    const otherLineData = [];
    edges.forEach(([a, b]) => {
      const target = a.isMyGroup || b.isMyGroup ? myLineData : otherLineData;
      target.push([a.x, a.y]);
      target.push([b.x, b.y]);
      target.push([null, null]);
    });
    // Stats
    const allDists = [];
    for (let i = 0; i < spots.length; i++) {
      for (let j = i + 1; j < spots.length; j++) {
        allDists.push(Math.hypot(spots[i].x - spots[j].x, spots[i].y - spots[j].y));
      }
    }
    const dMin = allDists.length ? Math.min(...allDists) : 0;
    const dMax = allDists.length ? Math.max(...allDists) : 0;
    const dAvg = allDists.length ? allDists.reduce((s, v) => s + v, 0) / allDists.length : 0;
    // même échelle en X et en Y : hauteur d'après la largeur, cadre ajusté au tracé
    const points = [...spots, ...autres];
    // largeur mesurée gardée telle quelle : comparée à l'affichage suivant
    this._largeurCarte = $graphe.width();
    const largeur = this._largeurCarte || 600;
    const bornes = PageAlliance.bornesCarte(points.length ? points : [me], largeur);
    const hauteur = PageAlliance.hauteurCarte(bornes, largeur);
    const depart = PageAlliance.cadreOrthonorme(
      bornes,
      largeur - MARGES_CARTE.largeur,
      hauteur - MARGES_CARTE.hauteur,
    );
    $graphe.css("height", hauteur + "px");
    const nbAutres = autres.reduce((n, s) => n + s.members.length, 0);
    const axe = (titre) => ({
      title: { text: titre },
      gridLineWidth: 1,
      gridLineColor: "#f0f0f0",
      // mêmes graduations sur les deux axes : la grille fait des carrés
      tickPixelInterval: 50,
      startOnTick: false,
      endOnTick: false,
      minPadding: 0,
      maxPadding: 0,
    });
    const echapper = (t) => $("<div>").text(t).html();
    const trajet = (cible) => {
      const tSans = tempsParcours(cible, 0);
      const tAvec = tempsParcours(cible, niveauVitesseAttaque);
      return (
        `&nbsp;&nbsp;Sans amélioration : ${Utils.intToTime(tSans)}<br/>` +
        `&nbsp;&nbsp;Avec ton bonus (Vit. att. ${niveauVitesseAttaque}) : ${Utils.intToTime(tAvec)}`
      );
    };
    // joueur ajouté : alliance, TdC de l'export (à l'heure près) et portée
    const infoAutre = (a) => {
      let html = `<b>${echapper(a.pseudo)}</b>${a.alliance ? ` [${echapper(a.alliance)}]` : " (sans alliance)"}<br/>`;
      html += `Terrain : ${numeral(a.terrain).format()} cm² <span class="reduce">(liste publique, à l'heure près)</span>`;
      if (Utils.terrain > 0 && a.terrain > 0)
        html +=
          `<br/>Tu peux l'attaquer : ${Utils.aPortee(a.terrain, Utils.terrain) ? "oui" : "non"}` +
          ` · il peut t'attaquer : ${Utils.aPortee(Utils.terrain, a.terrain) ? "oui" : "non"}`;
      return html;
    };
    Highcharts.chart("o_carteAllianceChart", {
      chart: {
        type: "scatter",
        zoomType: "xy",
        panKey: "shift",
        backgroundColor: "#fff",
        spacingTop: 25,
        // la largeur change l'échelle : la carte est redessinée (resize) plutôt qu'étirée
        reflow: false,
        events: {
          load: function () {
            PageAlliance.cadrer(this, bornes);
          },
          selection: function (e) {
            return PageAlliance.zoomOrthonorme(this, e);
          },
        },
      },
      title: {
        text: masques
          ? `Ton alliance masquée • ${nbAutres ? `${nbAutres} autre${nbAutres > 1 ? "s" : ""} • ${points.length} case${points.length > 1 ? "s" : ""}` : "aucun joueur ajouté à montrer"}`
          : `${total > affiches.length ? `${affiches.length} membres affichés sur ${total}` : `${affiches.length} membres`}${nbAutres ? ` • ${nbAutres} autre${nbAutres > 1 ? "s" : ""}` : ""} • ${spots.length} cases • ${tracer ? `chaîne de ${chaine.ordre.length} joueurs (${Utils.intToTime(chaine.total)} cumulés)` : `${edges.length} liens (${K_NEIGHBORS} plus proches voisins)`}`,
        style: { fontSize: "14px", fontWeight: "600" },
      },
      subtitle: {
        text: allDists.length
          ? `Distance min ${Utils.decimal(dMin)} • max ${Utils.decimal(dMax)} • moyenne ${Utils.decimal(dAvg)}`
          : "",
        style: { fontSize: "11px", color: "#888" },
      },
      xAxis: { ...axe("X (coord monde)"), min: depart.xMin, max: depart.xMax },
      yAxis: { ...axe("Y (coord monde)"), min: depart.yMin, max: depart.yMax },
      credits: { enabled: false },
      legend: { enabled: false },
      tooltip: {
        // Semi-transparent pour ne pas masquer le rectangle de drag-zoom derrière
        backgroundColor: "rgba(255,255,255,0.7)",
        borderColor: "#888",
        useHTML: true,
        formatter: function () {
          const spot = this.point.spot;
          const pos = `(${Math.round(spot.x)}, ${Math.round(spot.y)})`;
          let html = "";
          if (this.point.autre) {
            html += spot.members.map(infoAutre).join("<br/><br/>");
            html += `<br/>Position : ${pos}<br/><br/><b>Temps de trajet</b><br/>${trajet(spot)}`;
          } else if (spot.members.length === 1) {
            const m = spot.members[0];
            html += `<b>${m.pseudo}</b><br/>`;
            html += `Terrain : ${numeral(m.terrain).format()} cm²<br/>`;
            html += `Position : ${pos}`;
            if (m.isMe) {
              html += `<br/><em class="o_succesClair">C'est toi</em>`;
            } else {
              html += `<br/><br/><b>Temps de trajet</b><br/>${trajet(m)}`;
            }
          } else {
            html += `<b>${spot.members.length} membres sur cette case</b><br/>`;
            html += `Position : ${pos}`;
            if (spot.isMyGroup) {
              html += `<br/><em class="o_succesClair">Tu es ici, avec :</em>`;
              spot.members
                .filter((m) => !m.isMe)
                .forEach((m) => {
                  html += `<br/>&nbsp;&nbsp;• ${m.pseudo} (${numeral(m.terrain).format()} cm²)`;
                });
            } else {
              html += `<br/><br/>`;
              spot.members.forEach((m) => {
                html += `&nbsp;&nbsp;• <b>${m.pseudo}</b> (${numeral(m.terrain).format()} cm²)<br/>`;
              });
              html += `<br/><b>Temps de trajet</b> (commun, même case)<br/>${trajet(spot)}`;
            }
          }
          return html;
        },
      },
      plotOptions: {
        scatter: {
          marker: {
            symbol: "circle",
            states: { hover: { lineColor: "#000", lineWidth: 2 } },
          },
          dataLabels: {
            enabled: true,
            format: "{point.name}",
            allowOverlap: false,
            style: {
              fontSize: "10px",
              fontWeight: "normal",
              color: "#222",
              textOutline: "2px contrast",
            },
            y: -14,
          },
          point: {
            events: {
              click: function () {
                // Clic sur un point → zoom 4× autour (utile pour explorer les clusters denses) ;
                // les deux axes divisés par 4 : l'échelle reste la même en X et en Y.
                // Cap : on stop si le viewport descendrait sous 1 unité de jeu (sinon clic infini).
                const chart = this.series.chart;
                const xExt = chart.xAxis[0].getExtremes();
                const yExt = chart.yAxis[0].getExtremes();
                const xR = (xExt.max - xExt.min) / 4;
                const yR = (yExt.max - yExt.min) / 4;
                if (xR < 1 || yR < 1) return;
                chart.xAxis[0].setExtremes(this.x - xR / 2, this.x + xR / 2);
                chart.yAxis[0].setExtremes(this.y - yR / 2, this.y + yR / 2);
                // Force l'apparition du bouton natif "Reset zoom" (sinon il n'apparaît
                // que quand le zoom est déclenché par drag-select, pas via setExtremes).
                chart.showResetZoom();
              },
            },
          },
        },
      },
      series: [
        // Liens entre autres membres (gris discret, en arrière-plan)
        {
          type: "line",
          name: "Liens",
          data: otherLineData,
          color: "rgba(120, 140, 160, 0.35)",
          lineWidth: 1,
          marker: { enabled: false },
          enableMouseTracking: false,
          states: { hover: { enabled: false } },
          showInLegend: false,
          animation: false,
        },
        // Liens vers moi (vert plus marqué, par-dessus les autres)
        {
          type: "line",
          name: "Liens vers toi",
          data: myLineData,
          color: "rgba(39, 174, 96, 0.7)",
          lineWidth: 1.5,
          marker: { enabled: false },
          enableMouseTracking: false,
          states: { hover: { enabled: false } },
          showInLegend: false,
          animation: false,
        },
        // Chaîne entre plus proches voisins, dans l'ordre de passage
        {
          type: "line",
          name: "Chaîne",
          data: tracer ? chaine.ordre.map((m) => [m.x, m.y]) : [],
          color: "rgba(41, 128, 185, 0.85)",
          lineWidth: 2,
          dashStyle: "ShortDash",
          marker: { enabled: false },
          enableMouseTracking: false,
          states: { hover: { enabled: false } },
          showInLegend: false,
          animation: false,
        },
        // Joueurs et alliances ajoutés, sous les membres
        {
          type: "scatter",
          name: "Autres",
          data: autres.map((s) => {
            const n = s.members.length;
            return {
              x: s.x,
              y: s.y,
              spot: s,
              autre: true,
              name:
                n === 1
                  ? s.members[0].pseudo
                  : `${[...s.members].map((m) => m.pseudo).sort()[0]} +${n - 1}`,
              marker: PageAlliance.marqueur(s.members[0], { n }),
            };
          }),
        },
        {
          type: "scatter",
          name: "Membres",
          data: spots.map((s) => {
            const n = s.members.length;
            let label;
            if (n === 1) label = s.members[0].pseudo;
            else if (s.isMyGroup) label = `Toi +${n - 1}`;
            else label = `${[...s.members].map((m) => m.pseudo).sort()[0]} +${n - 1}`;
            // numéro de passage dans la chaîne tracée
            if (tracer)
              label = `${s.members
                .map((m) => rangs.get(m.pseudo))
                .sort((a, b) => a - b)
                .join(", ")}. ${label}`;
            return {
              x: s.x,
              y: s.y,
              spot: s,
              name: label,
              marker: s.isMyGroup
                ? PageAlliance.marqueur(styleMoi, { n, moi: true })
                : PageAlliance.marqueur(styleMembres, { n }),
            };
          }),
        },
      ],
    });
  }
}
