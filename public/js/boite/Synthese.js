// @ts-check
/*
 * Synthese.js
 * Fzzz
 **********************************************************************/

// période par défaut : les 30 derniers jours, aujourd'hui compris
const SYNTHESE_JOURS = 30;
// au-delà, le script refuse (limite d'exécution d'Apps Script)
const SYNTHESE_JOURS_MAX = 3 * 366;
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
 * Onglet « Synthèse » des « Outils pour Chasseur » : statistiques de chasse
 * du joueur sur une période, calculées par le script du Google Sheet (les
 * mêmes que l'onglet « Statistiques » du fichier) : chiffres clés, puis
 * graphiques chasse par chasse (une multi-chasse compte pour une chasse).
 * Graphiques Highcharts sur les pages qui chargent la bibliothèque
 * (wxt.config.ts) ; ailleurs, un lien vers la Messagerie.
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
    /** @type {any} suit la largeur des graphiques (boîte redimensionnée) */
    this._observateur = null;
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
      .then((s) => {
        this._avecAutres = autres;
        this.montrer(s);
      })
      .catch((e) => {
        // plus de résultats affichés : la case ne doit pas en ramener d'anciens
        this._s = null;
        $resultat.html(
          `<p class='red'>Synthèse impossible : ${Utils.echapper(e && e.message ? e.message : "erreur inconnue")}.</p>`,
        );
      })
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
    if (this._observateur) this._observateur.disconnect();
    this._s = s;
    let autres = this._avecAutres && !!this._$panneau.find("#o_syntheseAutres").prop("checked"),
      $resultat = this._$panneau
        .find("#o_syntheseResultat")
        .html(SyntheseChasse.html(s, autres, this._mesure));
    if (typeof Highcharts == "undefined") {
      $resultat
        .find(".o_syntheseGraphiques")
        .html(
          "<p><em>Graphiques : ouvre les « Outils pour Chasseur » depuis la <a href='/messagerie.php'>Messagerie</a> (la bibliothèque de graphiques n'est chargée que sur les pages Messagerie, Alliance et Construction).</em></p>",
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
    // boîte redimensionnée, fenêtre changée : graphiques à la nouvelle largeur
    if (typeof ResizeObserver == "function") {
      let attente = 0;
      this._observateur = new ResizeObserver(() => {
        cancelAnimationFrame(attente);
        attente = requestAnimationFrame(() => this._graphiques.forEach((g) => g.reflow()));
      });
      this._observateur.observe($resultat.find(".o_syntheseGraphiques")[0]);
    }
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
   * Chiffres clés de chasse et de l'armée, puis les graphiques.
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
      carte = (/** @type {any} */ c) =>
        `<div class='o_syntheseCarte ${c.classe}'><span>${c.libelle}</span><b>${c.texte}</b>${c.detail ? `<small>${c.detail}</small>` : ""}</div>`,
      graphiques = SyntheseChasse.graphiques(s, autres, mesure)
        .map(
          (g, i) =>
            `<div class='o_syntheseGraphique'>${i == RANG_ARMEE_SYNTHESE ? SyntheseChasse.boutonsMesure(mesure) : ""}<div class='o_syntheseTrace'></div></div>`,
        )
        .join("");
    return `<p class='gras o_syntheseTitre'>Synthèse de ${Utils.echapper(s.joueur)} du ${jour(s.debut)} au ${jour(s.fin)}</p>
      <div class='o_syntheseCartes'>${SyntheseChasse.cartes(s).map(carte).join("")}</div>
      <p class='o_syntheseSousTitre'>Armée hors bonus : la première multi-chasse (supposée emmener toute l'armée), puis l'effet en % de chaque chasse — pertes et expérience — sans les pontes</p>
      <div class='o_syntheseCartes o_syntheseArmee'>${SyntheseChasse.cartesArmee(s).map(carte).join("")}</div>
      <div class='o_syntheseGraphiques'>${graphiques}</div>`;
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
   * Chiffres clés de chasse de la période, lus dans le résumé du script.
   *
   * @static
   * @method cartes
   * @param {any} s statistiques renvoyées par le script
   * @return {Array<{libelle: String, texte: String, classe: String}>}
   */
  static cartes(s) {
    let v = (/** @type {String} */ libelle) => SyntheseChasse.resume(s, libelle),
      nombre = (/** @type {Number|null} */ n, unite = "") =>
        n == null ? "—" : numeral(n).format() + unite;
    return [
      { libelle: "Chasses", texte: nombre(v("Chasses (RC)")), classe: "" },
      { libelle: "Multi-chasses", texte: nombre(v("Multi-chasses")), classe: "" },
      { libelle: "Terrain chassé", texte: nombre(v("Terrain chassé (cm²)"), " cm²"), classe: "" },
      { libelle: "Pertes", texte: nombre(v("Fourmis perdues")), classe: "" },
      { libelle: "Pertes / M cm² chassé", texte: nombre(v("Pertes par M cm² chassé")), classe: "" },
      { libelle: "Nourriture rapportée", texte: nombre(v("Nourriture rapportée")), classe: "" },
      {
        libelle: "Nourriture / multi-chasse",
        texte: nombre(v("Nourriture par multi-chasse")),
        classe: "",
      },
    ];
  }
  /**
   * Armée de la première multi-chasse, puis après les chasses (pertes et
   * expérience, sans les pontes), et sa variation.
   *
   * @static
   * @method cartesArmee
   * @param {any} s statistiques renvoyées par le script
   * @return {Array<{libelle: String, texte: String, detail: String, classe: String}>}
   */
  static cartesArmee(s) {
    let libelles = /** @type {Object<String, String>} */ ({
        "Capacité de flood (unités)": "Capacité de flood",
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
   * Colonne du bloc « chasses » du script, lue par son titre ("" → null).
   *
   * @static
   * @method colonne
   * @param {any} s
   * @param {String} titre
   * @return {Array<any>}
   */
  static colonne(s, titre) {
    let k = s.chasses.titres.indexOf(titre);
    return s.chasses.lignes.map((/** @type {any[]} */ l) => (l[k] === "" ? null : l[k]));
  }
  /**
   * Options Highcharts des graphiques de la période, chasse par chasse en
   * abscisse (mêmes données que l'onglet « Statistiques » du fichier), avec les
   * courbes des autres chasseurs si demandé.
   *
   * @static
   * @method graphiques
   * @param {any} s statistiques renvoyées par le script
   * @param {Boolean} [autres] avec les autres chasseurs
   * @param {Number} [mesure] mesure du graphique de l'armée (MESURES_ARMEE)
   * @return {Array<any>}
   */
  static graphiques(s, autres = false, mesure = 0) {
    let eux = autres ? s.autres || [] : [],
      moi = SyntheseChasse.style(s, s.joueur),
      retours = SyntheseChasse.colonne(s, "Retour"),
      // points du joueur : la chasse en abscisse, son heure de retour pour l'info-bulle
      miens = (/** @type {String} */ titre) =>
        SyntheseChasse.colonne(s, titre).map((y, i) => ({ x: i + 1, y, retour: retours[i] })),
      entier = (/** @type {Number} */ v) => numeral(v).format(),
      // courbe d'un autre chasseur : fine, sans points, sa couleur et son trait
      autre = (/** @type {any} */ a, /** @type {Array<any>} */ data) => ({
        type: "line",
        name: a.joueur,
        data: data.map((v) => (v === "" ? null : v)),
        pointStart: 1,
        ...SyntheseChasse.style(s, a.joueur),
        lineWidth: 1.5,
        marker: { enabled: false },
      }),
      base = (
        /** @type {String} */ type,
        /** @type {String} */ titre,
        /** @type {Array<any>} */ series,
        /** @type {(v: Number) => String} */ format,
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
        // « Chasse 1 », « Chasse 2 »… : une multi-chasse compte pour une chasse
        xAxis: {
          allowDecimals: false,
          min: 1,
          tickPixelInterval: 90,
          lineColor: GRILLE_GRAPHIQUE,
          labels: {
            style: { fontSize: "10px" },
            formatter: /** @this {any} */ function () {
              return "Chasse " + this.value;
            },
          },
        },
        // graduations à la française (« 50 000 », pas « 50k »)
        yAxis: {
          title: { text: null },
          min: 0,
          gridLineColor: GRILLE_GRAPHIQUE,
          labels: {
            formatter: /** @this {any} */ function () {
              return format(this.value);
            },
          },
        },
        tooltip: {
          shared: true,
          headerFormat: "<b>Chasse {point.key}</b><br/>",
          pointFormatter: /** @this {any} */ function () {
            return `<span style="color:${this.color}">●</span> ${Utils.echapper(this.series.name)} : <b>${format(this.y)}</b>${this.retour ? ` (retour ${Utils.echapper(this.retour)})` : ""}<br/>`;
          },
        },
        legend: { enabled: series.length > 1 },
        plotOptions: { series: { turboThreshold: 0 } },
        series,
        ...options,
      }),
      moyenne = SyntheseChasse.colonne(s, "Moyenne (pertes / M cm²)")[0];
    return [
      // terrain de chaque chasse et sa tendance (droite calculée par le script)
      base(
        "column",
        "Terrain chassé à chaque chasse (cm²) et tendance",
        [
          { name: s.joueur, data: miens("Terrain (cm²)"), color: moi.color, maxPointWidth: 24 },
          {
            type: "line",
            name: "Tendance",
            data: SyntheseChasse.colonne(s, "Tendance (cm²)").map((y, i) => [i + 1, y]),
            color: ENCRE_GRAPHIQUE,
            dashStyle: "Dash",
            lineWidth: 2,
            marker: { enabled: false },
          },
          ...eux.map((/** @type {any} */ a) => autre(a, a.terrain)),
        ],
        entier,
      ),
      // pertes par million de cm² de chaque chasse et leur moyenne (sans écart-type)
      base(
        "line",
        "Pertes par M cm² de chaque chasse",
        [
          {
            name: s.joueur,
            data: miens("Pertes / M cm²"),
            ...moi,
            lineWidth: 2,
            marker: { enabled: true, radius: 4, lineColor: FOND_GRAPHIQUE, lineWidth: 2 },
          },
          ...eux.map((/** @type {any} */ a) => autre(a, a.pertes)),
        ],
        entier,
        {
          subtitle: {
            text: moyenne == null ? "" : `Moyenne : ${numeral(moyenne).format()} (tirets)`,
            align: "left",
            style: { fontSize: "11px", color: ENCRE_GRAPHIQUE },
          },
          yAxis: {
            title: { text: null },
            min: 0,
            gridLineColor: GRILLE_GRAPHIQUE,
            labels: {
              formatter: /** @this {any} */ function () {
                return entier(this.value);
              },
            },
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
          legend: { enabled: eux.length > 0 },
        },
      ),
      SyntheseChasse.graphiqueArmee(s, mesure),
      // nourriture de chaque chasse (multi-chasse : somme de ses expéditions)
      base(
        "line",
        "Nourriture rapportée à chaque chasse",
        [
          {
            name: s.joueur,
            data: miens("Nourriture"),
            ...moi,
            lineWidth: 2,
            marker: { enabled: s.chasses.lignes.length <= 60, radius: 3 },
          },
          ...eux.map((/** @type {any} */ a) => autre(a, a.nourriture)),
        ],
        entier,
      ),
    ];
  }
  /**
   * Armée de chaque chasse par unité, empilée, comme la page Statistiques du
   * jeu ; une unité absente de la période n'est pas tracée.
   *
   * @static
   * @method graphiqueArmee
   * @param {any} s statistiques renvoyées par le script
   * @param {Number} mesure rang dans MESURES_ARMEE
   * @return {any}
   */
  static graphiqueArmee(s, mesure) {
    let m = MESURES_ARMEE[mesure] || MESURES_ARMEE[0],
      lignes = s.chasses.lignes,
      premiere = s.chasses.titres.indexOf("Nourriture") + 1,
      noms = s.chasses.titres.slice(premiere),
      retours = SyntheseChasse.colonne(s, "Retour"),
      nombre = (/** @type {Number} */ g, /** @type {Number} */ u) =>
        Number(lignes[g][premiere + u]) || 0,
      presentes = noms
        .map((/** @type {String} */ n, /** @type {Number} */ u) => u)
        .filter((/** @type {Number} */ u) =>
          lignes.some((/** @type {any} */ l, /** @type {Number} */ g) => nombre(g, u) > 0),
        ),
      plusGrand = (/** @type {Number} */ u) =>
        Math.max(...lignes.map((/** @type {any} */ l, /** @type {Number} */ g) => nombre(g, u))),
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
        data: lignes.map((/** @type {any} */ l, /** @type {Number} */ g) => [
          g + 1,
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
        text: `Armée envoyée à chaque chasse : ${m.libelle.toLowerCase()}${m.unite ? " (jours)" : ""}`,
        align: "left",
        style: { fontSize: "13px", fontWeight: "bold" },
      },
      credits: { enabled: false },
      xAxis: {
        allowDecimals: false,
        min: 1,
        tickPixelInterval: 90,
        lineColor: GRILLE_GRAPHIQUE,
        labels: {
          style: { fontSize: "10px" },
          formatter: /** @this {any} */ function () {
            return "Chasse " + this.value;
          },
        },
      },
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
          // une seule chasse : un point, sans surface
          marker: { enabled: lignes.length == 1, radius: 4 },
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
        formatter: /** @this {any} */ function () {
          let retour = retours[this.x - 1];
          return (
            `<b>Chasse ${this.x}</b>${retour ? ` (retour ${Utils.echapper(retour)})` : ""}<br/>` +
            (this.points || [])
              .map(
                (/** @type {any} */ p) =>
                  `<span style="color:${p.color}">●</span> ${Utils.echapper(p.series.name)} : <b>${format(p.y)}</b>`,
              )
              .join("<br/>")
          );
        },
      },
      series,
    };
  }
}
