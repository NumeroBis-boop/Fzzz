// @ts-check
/*
 * Synthese.js
 * Fzzz
 **********************************************************************/

// période par défaut : les 30 derniers jours, aujourd'hui compris
const SYNTHESE_JOURS = 30;
// au-delà, le script refuse (limite d'exécution d'Apps Script)
const SYNTHESE_JOURS_MAX = 3 * 366;
const PAS_SYNTHESE = { jour: "par jour", semaine: "par semaine", mois: "par mois" };
// séries du graphique du terrain gagné ou perdu, dans l'ordre des colonnes de l'évolution
const COULEURS_SYNTHESE = ["#9A5700", "#4a7a2c", "#2c6a9a", "#b03a2e"];
// une couleur par chasseur, dans cet ordre (voisines distinctes pour les
// daltonismes) ; au-delà de huit chasseurs, les mêmes en pointillés
const COULEURS_CHASSEURS = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
  "#6250d6",
  "#e34948",
];
const TRAITS_CHASSEURS = ["Solid", "ShortDash", "ShortDot", "LongDashDot"];
// fond clair des graphiques : sur le beige des boîtes, ces couleurs perdent leur contraste
const FOND_GRAPHIQUE = "#fffdf7";
const ENCRE_GRAPHIQUE = "#52514e";
const GRILLE_GRAPHIQUE = "#e1e0d9";
// unités de l'armée tracées une à une ; au-delà, les plus petites sont regroupées
const SYNTHESE_UNITES_MAX = 8;
const COULEUR_AUTRES_UNITES = "#898781";
// lignes au plus dans le tableau des chasses (les graphiques les ont toutes)
const SYNTHESE_LIGNES_MAX = 1000;
const FORMAT_INSTANT = "%d/%m %H:%M";
// axe des dates : « 02/11 », pas « 2. Nov. »
const AXE_DATES_SYNTHESE = {
  type: "datetime",
  lineColor: "#e1e0d9",
  labels: { style: { fontSize: "10px" } },
  dateTimeLabelFormats: {
    minute: "%H:%M",
    hour: "%d/%m %H:%M",
    day: "%d/%m",
    week: "%d/%m",
    month: "%m/%Y",
    year: "%Y",
  },
};
// mesures du graphique de l'armée, comme la page Statistiques du jeu (hors bonus)
const MESURES_ARMEE = [
  { libelle: "Nombre d'unités", unite: "", facteur: (/** @type {Number} */ i) => 1 },
  { libelle: "Vie", unite: "", facteur: (/** @type {Number} */ i) => VIE_UNITE[i + 1] },
  {
    libelle: "Dégâts en attaque",
    unite: "",
    facteur: (/** @type {Number} */ i) => ATT_UNITE[i + 1],
  },
  {
    libelle: "Dégâts en défense",
    unite: "",
    facteur: (/** @type {Number} */ i) => DEF_UNITE[i + 1],
  },
  {
    libelle: "Temps de ponte",
    unite: " j",
    facteur: (/** @type {Number} */ i) => TEMPS_UNITE[i + 1] / 86400,
  },
];
// case « Comparer aux autres chasseurs », retenue par le navigateur
const CLE_SYNTHESE_AUTRES = "fzzz_syntheseAutres";
// rang du graphique de l'armée dans SyntheseChasse.graphiques (boutons des mesures)
const RANG_ARMEE_SYNTHESE = 2;

/**
 * Onglet « Synthèse » des « Outils pour Chasseur » : statistiques du joueur
 * sur une période, calculées par le script du Google Sheet (les mêmes que
 * l'onglet « Statistiques » du fichier). Graphiques Highcharts sur les pages
 * qui chargent la bibliothèque (wxt.config.ts) ; ailleurs, les tableaux et un
 * lien vers la Messagerie.
 *
 * @class SyntheseChasse
 */
class SyntheseChasse {
  /**
   * @param {any} $panneau panneau de l'onglet
   */
  constructor($panneau) {
    this._$panneau = $panneau;
    /** @type {Array<any>} graphiques affichés, détruits avant d'en dessiner d'autres */
    this._graphiques = [];
    /** @type {any} dernières statistiques reçues */
    this._s = null;
    // les courbes des autres chasseurs ont été demandées avec ces statistiques
    this._avecAutres = false;
    this._mesure = 0;
  }
  /**
   * Choix de la période, puis bouton « Afficher ».
   *
   * @method afficher
   * @return {SyntheseChasse}
   */
  afficher() {
    let fin = Horloge.serveur(),
      debut = fin.clone().subtract(SYNTHESE_JOURS - 1, "days");
    this._$panneau.html(`<div class='o_synthese'>
        <p class='o_syntheseDates'>
          <label>Du <input type='date' id='o_syntheseDebut' value='${debut.format("YYYY-MM-DD")}'/></label>
          <label>au <input type='date' id='o_syntheseFin' value='${fin.format("YYYY-MM-DD")}'/></label>
          <button type='button' id='o_syntheseAfficher' class='o_button f_info'>Afficher</button>
          <label><input type='checkbox' id='o_syntheseAutres'${SyntheseChasse.autresCoches() ? " checked" : ""}/> Comparer aux autres chasseurs</label>
        </p>
        <div id='o_syntheseResultat'><p><em>Choisis la période, puis « Afficher » : les résultats sont calculés dans le Google Sheet où tu exportes tes rapports, comme son onglet « Statistiques ».</em></p></div>
      </div>`);
    this._$panneau.find("#o_syntheseAfficher").on("click", () => this.charger());
    this._$panneau.find("#o_syntheseAutres").on("change", (e) => {
      let coche = $(e.currentTarget).prop("checked");
      try {
        localStorage.setItem(CLE_SYNTHESE_AUTRES, coche ? "1" : "0");
      } catch (err) {}
      if (!this._s) return;
      // courbes pas encore lues : une requête, comme un clic sur « Afficher »
      if (coche && !this._avecAutres) this.charger();
      else this.montrer(this._s);
    });
    return this;
  }
  /**
   * @static
   * @method autresCoches
   * @return {Boolean}
   */
  static autresCoches() {
    try {
      return localStorage.getItem(CLE_SYNTHESE_AUTRES) == "1";
    } catch (e) {
      return false;
    }
  }
  /**
   * Lit les statistiques de la période choisie et les affiche.
   *
   * @method charger
   * @return {Promise<void>}
   */
  charger() {
    let $p = this._$panneau,
      debut = String($p.find("#o_syntheseDebut").val() || ""),
      fin = String($p.find("#o_syntheseFin").val() || ""),
      autres = !!$p.find("#o_syntheseAutres").prop("checked"),
      erreur = SyntheseChasse.erreurPeriode(debut, fin),
      $bouton = $p.find("#o_syntheseAfficher"),
      $resultat = $p.find("#o_syntheseResultat");
    if (erreur) {
      $resultat.html(`<p class='red'>${erreur}</p>`);
      return Promise.resolve();
    }
    $bouton.prop("disabled", true);
    $resultat.html("<p><em>Lecture du Google Sheet…</em></p>");
    return ExportRapports.statistiques(debut, fin, autres)
      .then(
        (s) => {
          this._avecAutres = autres;
          this.montrer(s);
        },
        (e) => {
          // plus de résultats affichés : la case ne doit pas en ramener d'anciens
          this._s = null;
          $resultat.html(
            `<p class='red'>Synthèse impossible : ${Utils.echapper(e && e.message ? e.message : "erreur inconnue")}.</p>`,
          );
        },
      )
      .then(() => {
        $bouton.prop("disabled", false);
      });
  }
  /**
   * @method montrer
   * @param {any} s statistiques renvoyées par le script
   */
  montrer(s) {
    this._graphiques.forEach((g) => g.destroy());
    this._graphiques = [];
    this._s = s;
    let autres = this._avecAutres && !!this._$panneau.find("#o_syntheseAutres").prop("checked"),
      $resultat = this._$panneau
        .find("#o_syntheseResultat")
        .html(SyntheseChasse.html(s, autres, this._mesure));
    if (typeof Highcharts == "undefined") {
      $resultat
        .find(".o_syntheseGraphiques")
        .html(
          "<p><em>Graphiques : ouvre les « Outils pour Chasseur » depuis la <a href='/messagerie.php'>Messagerie</a> (la bibliothèque de graphiques n'est chargée que sur les pages Messagerie, Alliance et Construction). Leurs valeurs sont dans « Données des graphiques ».</em></p>",
        );
      return;
    }
    SyntheseChasse.graphiques(s, autres, this._mesure).forEach((options, i) => {
      this._graphiques.push(Highcharts.chart($resultat.find(".o_syntheseTrace")[i], options));
    });
    $resultat.find(".o_syntheseMesure").on("click", (e) => {
      this._mesure = Number($(e.currentTarget).data("mesure")) || 0;
      this.montrer(s);
    });
    // dessinés repliés : à leur taille réelle quand la section s'ouvre
    $resultat
      .find(".o_spoilerTitre")
      .on("click", () => setTimeout(() => this._graphiques.forEach((g) => g.reflow()), 0));
  }
  /**
   * Message si la période ne peut pas être demandée, sinon "".
   *
   * @static
   * @method erreurPeriode
   * @param {String} debut "AAAA-MM-JJ"
   * @param {String} fin "AAAA-MM-JJ"
   * @return {String}
   */
  static erreurPeriode(debut, fin) {
    let jour = /^\d{4}-\d{2}-\d{2}$/;
    if (!jour.test(debut) || !jour.test(fin)) return "Choisis le premier et le dernier jour.";
    if (debut > fin) return "Le premier jour est après le dernier.";
    if (moment.utc(fin).diff(moment.utc(debut), "days") > SYNTHESE_JOURS_MAX)
      return "Période trop longue : trois ans au plus.";
    return "";
  }
  /**
   * Nombre à la française : entier, ou quatre décimales (pertes par cm², alignées en colonne).
   *
   * @static
   * @method valeur
   * @param {any} v
   * @return {String}
   */
  static valeur(v) {
    if (v === "" || v == null) return "—";
    if (typeof v != "number") return Utils.echapper(v);
    return Number.isInteger(v) ? numeral(v).format() : Utils.decimal(v, 4);
  }
  /**
   * Tableau à en-têtes (première colonne à gauche, nombres à droite).
   *
   * @static
   * @method tableau
   * @param {Array<String>} titres
   * @param {Array<Array<any>>} lignes
   * @return {String}
   */
  static tableau(titres, lignes) {
    return `<table class='o_syntheseTableau' cellspacing='0'><tr class='gras'>${titres
      .map((x, i) => `<td class='${i ? "right" : "left"}'>${Utils.echapper(x)}</td>`)
      .join("")}</tr>${lignes
      .map(
        (l) =>
          `<tr>${l.map((v, i) => `<td class='${i ? "right" : "left"}'>${SyntheseChasse.valeur(v)}</td>`).join("")}</tr>`,
      )
      .join("")}</table>`;
  }
  /**
   * Chiffres clés en tête, puis détail, graphiques, données et classements
   * dans des sections repliables (état retenu par Utils.spoiler).
   *
   * @static
   * @method html
   * @param {any} s statistiques renvoyées par le script
   * @param {Boolean} [autres] avec les autres chasseurs
   * @param {Number} [mesure] mesure du graphique de l'armée (MESURES_ARMEE)
   * @return {String}
   */
  static html(s, autres = false, mesure = 0) {
    let jour = (/** @type {String} */ j) => moment(j, "YYYY-MM-DD").format("DD/MM/YYYY"),
      // résumé du script découpé en sections : une ligne sans valeur est un titre
      sections = /** @type {Array<{titre: String, lignes: any[][]}>} */ ([]);
    s.resume.forEach((/** @type {any[]} */ l) => {
      if (l[1] === "") sections.push({ titre: l[0], lignes: [] });
      else if (sections.length) sections[sections.length - 1].lignes.push(l);
    });
    let carte = (/** @type {any} */ c) =>
        `<div class='o_syntheseCarte ${c.classe}'><span>${c.libelle}</span><b>${c.texte}</b>${c.detail ? `<small>${c.detail}</small>` : ""}</div>`,
      detail = sections
        .map(
          (sec) =>
            `<table class='o_syntheseTableau' cellspacing='0'><tr class='gras'><td colspan='2' class='left'>${Utils.echapper(sec.titre)}</td></tr>${sec.lignes
              .map(
                (l) =>
                  `<tr><td class='left'>${Utils.echapper(l[0])}</td><td class='right'>${SyntheseChasse.valeur(l[1])}</td></tr>`,
              )
              .join("")}</table>`,
        )
        .join(""),
      // tableau large (chasseurs) : une ligne de la grille à lui seul
      classement = (/** @type {String} */ titre, /** @type {any} */ t, large = false) =>
        `<div class='o_syntheseClassement${large ? " o_syntheseLarge" : ""}'><p class='gras'>${titre}</p>` +
        (t.lignes.length ? SyntheseChasse.tableau(t.titres, t.lignes) : "<p><em>Aucun.</em></p>") +
        "</div>",
      graphiques = SyntheseChasse.graphiques(s, autres, mesure)
        .map(
          (g, i) =>
            `<div class='o_syntheseGraphique'>${i == RANG_ARMEE_SYNTHESE ? SyntheseChasse.boutonsMesure(mesure) : ""}<div class='o_syntheseTrace'></div></div>`,
        )
        .join(""),
      mc = s.multiChasses,
      chasses = s.chasses.lignes.slice(-SYNTHESE_LIGNES_MAX),
      donnees =
        `<div class='o_syntheseDonnees'><p class='gras'>Évolution ${PAS_SYNTHESE[/** @type {"jour"} */ (s.pas)] || ""}</p>${SyntheseChasse.tableau(s.evolution.titres, s.evolution.lignes)}</div>` +
        `<div class='o_syntheseDonnees'><p class='gras'>Multi-chasses</p>${SyntheseChasse.tableau(
          mc.titres.slice(0, 5).concat("Unités"),
          mc.lignes.map((/** @type {any[]} */ l) =>
            l.slice(0, 5).concat(l.slice(8).reduce((a, b) => a + b, 0)),
          ),
        )}</div>` +
        `<div class='o_syntheseDonnees'><p class='gras'>${chasses.length < s.chasses.lignes.length ? `Chasses (les ${numeral(chasses.length).format()} dernières)` : "Chasses"}</p>${SyntheseChasse.tableau(s.chasses.titres, chasses)}</div>`;
    return `<p class='gras o_syntheseTitre'>Synthèse de ${Utils.echapper(s.joueur)} du ${jour(s.debut)} au ${jour(s.fin)}</p>
      <div class='o_syntheseCartes'>${SyntheseChasse.cartes(s).map(carte).join("")}</div>
      <p class='o_syntheseSousTitre'>Armée hors bonus, de la première à la dernière multi-chasse (chacune supposée emmener toute l'armée)</p>
      <div class='o_syntheseCartes o_syntheseArmee'>${SyntheseChasse.cartesArmee(s).map(carte).join("")}</div>
      ${Utils.spoiler("Détail", `<div class='o_syntheseGrille'>${detail}</div>`, "syntheseDetail", "gras", false)}
      ${Utils.spoiler(`Évolution ${PAS_SYNTHESE[/** @type {"jour"} */ (s.pas)] || ""}`, `<div class='o_syntheseGraphiques'>${graphiques}</div>`, "syntheseEvolution", "gras")}
      ${Utils.spoiler("Données des graphiques", donnees, "syntheseDonnees", "gras", false)}
      ${Utils.spoiler(
        "Classements",
        `<div class='o_syntheseGrille'>${autres ? classement("Chasseurs de la période", s.comparaison, true) : ""}${classement("Cibles hors alliance", s.cibles)}${classement("Attaquants hors alliance", s.attaquants)}${classement("Floods internes", s.internes)}</div>`,
        "syntheseClassements",
        "gras",
      )}`;
  }
  /**
   * Boutons des mesures du graphique de l'armée.
   *
   * @static
   * @method boutonsMesure
   * @param {Number} mesure mesure affichée
   * @return {String}
   */
  static boutonsMesure(mesure) {
    return `<div class='o_syntheseMesures'>${MESURES_ARMEE.map(
      (m, i) =>
        `<button type='button' class='o_button o_syntheseMesure${i == mesure ? " o_syntheseMesureActive" : ""}' data-mesure='${i}' aria-pressed='${i == mesure}'>${m.libelle}</button>`,
    ).join("")}</div>`;
  }
  /**
   * Valeur d'une ligne du résumé du script (null si absente ou vide).
   *
   * @static
   * @method resume
   * @param {any} s
   * @param {String} libelle
   * @return {Number|null}
   */
  static resume(s, libelle) {
    let l = s.resume.find((/** @type {any[]} */ x) => x[0] == libelle);
    return l && typeof l[1] == "number" ? l[1] : null;
  }
  /**
   * Chiffres clés de la période, lus dans le résumé du script.
   *
   * @static
   * @method cartes
   * @param {any} s statistiques renvoyées par le script
   * @return {Array<{libelle: String, texte: String, classe: String}>}
   */
  static cartes(s) {
    let v = (/** @type {String} */ libelle) => SyntheseChasse.resume(s, libelle),
      nombre = (/** @type {Number|null} */ n, unite = "", signe = false) =>
        n == null ? "—" : (signe && n > 0 ? "+" : "") + numeral(n).format() + unite,
      sens = (/** @type {Number|null} */ n) =>
        n == null || n == 0 ? "" : n > 0 ? "o_syntheseGain" : "o_synthesePerte",
      recu = v("Terrain reçu des alliés (cm²)"),
      donne = v("Terrain donné aux alliés (cm²)"),
      internes = recu == null || donne == null ? null : recu - donne,
      gagne = v("Terrain gagné (cm²)"),
      parCm2 = v("Pertes par cm² chassé");
    return [
      { libelle: "Chasses", texte: nombre(v("Chasses (RC)")), classe: "" },
      { libelle: "Multi-chasses", texte: nombre(v("Multi-chasses")), classe: "" },
      { libelle: "Terrain conquis", texte: nombre(v("Terrain conquis (cm²)"), " cm²"), classe: "" },
      { libelle: "Fourmis perdues", texte: nombre(v("Fourmis perdues")), classe: "" },
      {
        libelle: "Pertes / cm²",
        texte: parCm2 == null ? "—" : Utils.decimal(parCm2, 4),
        classe: "",
      },
      { libelle: "Nourriture rapportée", texte: nombre(v("Nourriture rapportée")), classe: "" },
      { libelle: "Nourriture / chasse", texte: nombre(v("Nourriture par chasse")), classe: "" },
      { libelle: "Floods internes", texte: nombre(internes, " cm²", true), classe: sens(internes) },
      { libelle: "Terrain gagné", texte: nombre(gagne, " cm²", true), classe: sens(gagne) },
    ];
  }
  /**
   * Armée de la première et de la dernière multi-chasse, et sa variation.
   *
   * @static
   * @method cartesArmee
   * @param {any} s statistiques renvoyées par le script
   * @return {Array<{libelle: String, texte: String, detail: String, classe: String}>}
   */
  static cartesArmee(s) {
    let libelles = /** @type {Object<String, String>} */ ({
        "Unités (capacité de flood)": "Capacité de flood",
      }),
      // espaces insécables dans les nombres : sur un téléphone, retour à la ligne après la flèche
      nombre = (/** @type {Number} */ n) => numeral(n).format().replace(/ /g, "\u00a0");
    return s.armee.lignes.map((/** @type {any[]} */ l) => {
      let variation = typeof l[3] == "number" ? l[3] : null;
      return {
        libelle: libelles[l[0]] || l[0],
        texte: l[1] === "" ? "—" : `${nombre(l[1])} → ${nombre(l[2])}`,
        detail:
          variation == null ? "" : `${variation > 0 ? "+" : ""}${Utils.decimal(variation, 1)} %`,
        classe: !variation ? "" : variation > 0 ? "o_syntheseGain" : "o_synthesePerte",
      };
    });
  }
  /**
   * Couleur et trait d'un chasseur : rang dans la liste de tous les chasseurs du
   * fichier, la même dans chaque graphique et pour chaque joueur.
   *
   * @static
   * @method style
   * @param {any} s
   * @param {String} joueur
   * @return {{color: String, dashStyle: String}}
   */
  static style(s, joueur) {
    let i = Math.max(
      0,
      (s.chasseurs || []).findIndex(
        (/** @type {String} */ c) => c.toLowerCase() == String(joueur).toLowerCase(),
      ),
    );
    return {
      color: COULEURS_CHASSEURS[i % COULEURS_CHASSEURS.length],
      dashStyle:
        TRAITS_CHASSEURS[Math.floor(i / COULEURS_CHASSEURS.length) % TRAITS_CHASSEURS.length],
    };
  }
  /**
   * Options Highcharts des graphiques de la période (mêmes données que
   * l'onglet « Statistiques » du fichier), avec les courbes des autres
   * chasseurs si demandé.
   *
   * @static
   * @method graphiques
   * @param {any} s statistiques renvoyées par le script
   * @param {Boolean} [autres] avec les autres chasseurs
   * @param {Number} [mesure] mesure du graphique de l'armée (MESURES_ARMEE)
   * @return {Array<any>}
   */
  static graphiques(s, autres = false, mesure = 0) {
    let lignes = s.evolution.lignes,
      titres = s.evolution.titres,
      eux = autres ? s.autres || [] : [],
      moi = SyntheseChasse.style(s, s.joueur),
      colonne = (/** @type {Number} */ i) =>
        lignes.map((/** @type {any[]} */ l) => (l[i] === "" ? null : l[i])),
      entier = /** @this {any} */ function () {
        return numeral(this.value).format();
      },
      // courbe d'un autre chasseur : fine, sans points, sa couleur et son trait
      autre = (/** @type {any} */ a, /** @type {any} */ data, options = {}) => ({
        type: "line",
        name: a.joueur,
        data,
        ...SyntheseChasse.style(s, a.joueur),
        lineWidth: 1.5,
        marker: { enabled: false },
        ...options,
      }),
      base = (
        /** @type {String} */ type,
        /** @type {String} */ titre,
        /** @type {Array<any>} */ series,
        options = {},
      ) => ({
        chart: {
          type,
          height: 260,
          backgroundColor: FOND_GRAPHIQUE,
          borderRadius: 4,
          spacing: [8, 8, 8, 8],
        },
        title: { text: titre, align: "left", style: { fontSize: "13px", fontWeight: "bold" } },
        credits: { enabled: false },
        xAxis: {
          categories: lignes.map((/** @type {any[]} */ l) => l[0]),
          labels: { style: { fontSize: "10px" } },
          lineColor: GRILLE_GRAPHIQUE,
        },
        // graduations à la française (« 50 000 », pas « 50k »)
        yAxis: {
          title: { text: null },
          gridLineColor: GRILLE_GRAPHIQUE,
          labels: { formatter: entier },
        },
        tooltip: { shared: true },
        legend: { enabled: series.length > 1 },
        series,
        ...options,
      }),
      datetime = AXE_DATES_SYNTHESE;
    // terrain chassé et sa tendance (droite calculée par le script)
    let terrain = base(
        "column",
        `Terrain chassé ${PAS_SYNTHESE[/** @type {"jour"} */ (s.pas)] || ""} (cm²) et tendance`,
        [
          { name: s.joueur, data: colonne(1), color: moi.color, maxPointWidth: 24 },
          {
            type: "line",
            name: "Tendance",
            data: colonne(7),
            color: ENCRE_GRAPHIQUE,
            dashStyle: "Dash",
            lineWidth: 2,
            marker: { enabled: false },
            // vide les jours sans chasse : une seule droite d'un jour chassé à l'autre
            connectNulls: true,
          },
          ...eux.map((/** @type {any} */ a) => autre(a, a.terrain)),
        ],
      ),
      // pertes par cm² : un point par multi-chasse, moyenne et écart-type du script
      moyenne = SyntheseChasse.resume(s, "Pertes par cm², moyenne des multi-chasses"),
      ecart = SyntheseChasse.resume(s, "Pertes par cm², écart-type"),
      decimales = /** @this {any} */ function () {
        return Utils.decimal(this.value, 4, true);
      },
      pertes = base(
        "line",
        "Pertes par cm² de chaque multi-chasse",
        [
          {
            name: s.joueur,
            data: s.multiChasses.instants
              .map((/** @type {Number} */ t, /** @type {Number} */ i) => [
                t,
                s.multiChasses.lignes[i][4],
              ])
              .filter((/** @type {any[]} */ p) => p[1] !== ""),
            ...moi,
            lineWidth: 2,
            marker: { enabled: true, radius: 4, lineColor: FOND_GRAPHIQUE, lineWidth: 2 },
          },
          ...eux.map((/** @type {any} */ a) => autre(a, a.multiChasses)),
        ],
        {
          // valeurs dans le sous-titre : des étiquettes dans le tracé recouvriraient les courbes
          subtitle: {
            text:
              moyenne == null || ecart == null
                ? ""
                : `Moyenne des multi-chasses ${Utils.decimal(moyenne, 4)} (tirets), écart-type ${Utils.decimal(ecart, 4)} (bande grise)`,
            align: "left",
            style: { fontSize: "11px", color: ENCRE_GRAPHIQUE },
          },
          xAxis: datetime,
          yAxis: {
            title: { text: null },
            min: 0,
            gridLineColor: GRILLE_GRAPHIQUE,
            labels: { formatter: decimales },
            plotBands:
              moyenne == null || ecart == null
                ? []
                : [
                    {
                      from: Math.max(0, moyenne - ecart),
                      to: moyenne + ecart,
                      color: "rgba(82, 81, 78, 0.12)",
                    },
                  ],
            plotLines:
              moyenne == null
                ? []
                : [
                    {
                      value: moyenne,
                      color: ENCRE_GRAPHIQUE,
                      dashStyle: "Dash",
                      width: 1,
                      zIndex: 3,
                    },
                  ],
          },
          tooltip: {
            shared: false,
            xDateFormat: FORMAT_INSTANT,
            pointFormatter: /** @this {any} */ function () {
              return `<span style="color:${this.color}">●</span> ${Utils.echapper(this.series.name)} : <b>${Utils.decimal(this.y, 4, true)}</b><br/>`;
            },
          },
          legend: { enabled: eux.length > 0 },
        },
      ),
      nourriture = base(
        "line",
        "Nourriture rapportée par chasse",
        [
          {
            name: s.joueur,
            data: s.chasses.lignes.map((/** @type {any[]} */ l) => l[3]),
            pointStart: 1,
            ...moi,
            lineWidth: 2,
            marker: { enabled: s.chasses.lignes.length <= 60, radius: 3 },
          },
          ...eux.map((/** @type {any} */ a) => autre(a, a.nourriture, { pointStart: 1 })),
        ],
        {
          xAxis: {
            title: { text: "Chasse n°", style: { fontSize: "10px" } },
            allowDecimals: false,
            min: 1,
            lineColor: GRILLE_GRAPHIQUE,
            labels: { style: { fontSize: "10px" } },
          },
          tooltip: { shared: true, headerFormat: "Chasse n° {point.key}<br/>" },
        },
      ),
      gagne = {
        ...base(
          "column",
          "Terrain gagné ou perdu (cm²)",
          [1, 2, 3, 4].map((i, k) => ({
            name: titres[i],
            color: COULEURS_SYNTHESE[k],
            data: colonne(i),
            maxPointWidth: 24,
          })),
        ),
        plotOptions: { column: { stacking: "normal" } },
      };
    return [terrain, pertes, SyntheseChasse.graphiqueArmee(s, mesure), nourriture, gagne];
  }
  /**
   * Armée de chaque multi-chasse par unité, empilée, comme la page Statistiques
   * du jeu ; une unité absente de la période n'est pas tracée.
   *
   * @static
   * @method graphiqueArmee
   * @param {any} s statistiques renvoyées par le script
   * @param {Number} mesure rang dans MESURES_ARMEE
   * @return {any}
   */
  static graphiqueArmee(s, mesure) {
    let m = MESURES_ARMEE[mesure] || MESURES_ARMEE[0],
      mc = s.multiChasses,
      noms = mc.titres.slice(8),
      nombre = (/** @type {Number} */ g, /** @type {Number} */ u) =>
        Number(mc.lignes[g][8 + u]) || 0,
      presentes = noms
        .map((/** @type {String} */ n, /** @type {Number} */ u) => u)
        .filter((/** @type {Number} */ u) =>
          mc.lignes.some((/** @type {any} */ l, /** @type {Number} */ g) => nombre(g, u) > 0),
        ),
      plusGrand = (/** @type {Number} */ u) =>
        Math.max(...mc.lignes.map((/** @type {any} */ l, /** @type {Number} */ g) => nombre(g, u))),
      // les plus nombreuses tracées une à une, les autres regroupées (choix fait
      // sur les nombres d'unités : couleurs inchangées d'une mesure à l'autre)
      gardees =
        presentes.length <= SYNTHESE_UNITES_MAX
          ? presentes
          : presentes
              .slice()
              .sort(
                (/** @type {Number} */ a, /** @type {Number} */ b) =>
                  plusGrand(b) - plusGrand(a) || a - b,
              )
              .slice(0, SYNTHESE_UNITES_MAX - 1)
              .sort((/** @type {Number} */ a, /** @type {Number} */ b) => a - b),
      regroupees = presentes.filter((/** @type {Number} */ u) => gardees.indexOf(u) == -1),
      valeur = (/** @type {Number} */ g, /** @type {Array<Number>} */ unites) =>
        unites.reduce((a, u) => a + nombre(g, u) * m.facteur(u), 0),
      serie = (
        /** @type {String} */ nom,
        /** @type {Array<Number>} */ unites,
        /** @type {String} */ couleur,
      ) => ({
        name: nom,
        color: couleur,
        data: mc.instants.map((/** @type {Number} */ t, /** @type {Number} */ g) => [
          t,
          valeur(g, unites),
        ]),
      }),
      series = gardees.map((/** @type {Number} */ u, /** @type {Number} */ k) =>
        serie(noms[u], [u], COULEURS_CHASSEURS[k]),
      );
    if (regroupees.length) series.push(serie("Autres unités", regroupees, COULEUR_AUTRES_UNITES));
    let format = (/** @type {Number} */ v) => numeral(v).format() + m.unite;
    return {
      chart: {
        type: "area",
        height: 300,
        backgroundColor: FOND_GRAPHIQUE,
        borderRadius: 4,
        spacing: [8, 8, 8, 8],
      },
      title: {
        text: `Armée envoyée en multi-chasse : ${m.libelle.toLowerCase()}${m.unite ? " (jours)" : ""}`,
        align: "left",
        style: { fontSize: "13px", fontWeight: "bold" },
      },
      credits: { enabled: false },
      xAxis: AXE_DATES_SYNTHESE,
      yAxis: {
        title: { text: null },
        gridLineColor: GRILLE_GRAPHIQUE,
        labels: {
          formatter: /** @this {any} */ function () {
            return numeral(this.value).format();
          },
        },
      },
      plotOptions: {
        area: {
          stacking: "normal",
          fillOpacity: 0.8,
          lineWidth: 2,
          lineColor: FOND_GRAPHIQUE,
          // une seule multi-chasse : un point, sans surface
          marker: { enabled: mc.lignes.length == 1, radius: 4 },
        },
      },
      legend: {
        layout: "vertical",
        align: "right",
        verticalAlign: "middle",
        title: { text: "Armée (clic pour cacher)", style: { fontSize: "11px" } },
        itemStyle: { fontSize: "11px", fontWeight: "normal" },
      },
      responsive: {
        rules: [
          {
            condition: { maxWidth: 520 },
            chartOptions: {
              legend: { layout: "horizontal", align: "center", verticalAlign: "bottom" },
            },
          },
        ],
      },
      tooltip: {
        shared: true,
        xDateFormat: FORMAT_INSTANT,
        pointFormatter: /** @this {any} */ function () {
          return `<span style="color:${this.color}">●</span> ${Utils.echapper(this.series.name)} : <b>${format(this.y)}</b><br/>`;
        },
        footerFormat: "",
      },
      series,
    };
  }
}
