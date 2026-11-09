// @ts-check
/*
 * Synthese.js
 * Fzzz
 **********************************************************************/

// période par défaut : les 30 derniers jours, aujourd'hui compris
const SYNTHESE_JOURS = 30;
// au-delà, le script refuse (limite d'exécution d'Apps Script)
const SYNTHESE_JOURS_MAX = 3 * 366;
// couleurs des unités du graphique de l'armée, dans cet ordre (voisines
// distinctes pour les daltonismes)
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
// le joueur en vert, la moyenne des chasseurs en rouge (choix du mainteneur) ;
// les autres chasseurs dans les autres couleurs, puis une nuance de chacune au-delà
// de six (demande du mainteneur), toujours en pointillés, un autre pointillé
// au-delà de douze (mêmes couleurs que l'onglet du Sheet)
const COULEUR_JOUEUR = "#008300";
const COULEUR_MOYENNE = "#e34948";
const COULEURS_AUTRES = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#6250d6",
  "#65a8ff",
  "#9f3600",
  "#066c49",
  "#9d6a06",
  "#b54d77",
  "#8c84fe",
];
const TRAITS_AUTRES = ["ShortDot", "ShortDashDot", "LongDashDot"];
// les deux tendances (joueur et moyenne) : même trait
const TRAIT_TENDANCE = "LongDash";
const COULEUR_NOURRITURE = "#eb6834";
const COULEUR_PERTES = "#6250d6";
// chiffres de chasse où être sous la moyenne des chasseurs est mieux (demande du mainteneur)
const SYNTHESE_MOINS_EST_MIEUX = ["Fourmis perdues", "Pertes par M cm² chassé"];
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
const RANG_ARMEE_SYNTHESE = 5;
// jours du tableur (depuis le 30/12/1899) au 01/01/1970
const JOURS_TABLEUR_1970 = 25569;

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
          <label title='Leurs points dans les nuages de points et les pertes dans le temps (le graphique du terrain les montre toujours)'><input type='checkbox' id='o_syntheseAutres'${SyntheseChasse.autresCoches() ? " checked" : ""}/> Comparer aux autres chasseurs</label>
        </p>
        <div id='o_syntheseResultat'><p><em>Choisis la période, puis « Afficher » : les résultats sont calculés dans le Google Sheet où tu exportes tes rapports, comme son onglet « Statistiques ».</em></p></div>
      </div>`);
    this._$panneau.find("#o_syntheseAfficher").on("click", () => this.charger());
    this._$panneau.find("#o_syntheseAutres").on("change", (e) => {
      let coche = $(e.currentTarget).prop("checked");
      try {
        localStorage.setItem(CLE_SYNTHESE_AUTRES, coche ? "1" : "0");
      } catch (err) {}
      if (this._s) this.montrer(this._s);
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
      erreur = SyntheseChasse.erreurPeriode(debut, fin),
      $bouton = $p.find("#o_syntheseAfficher"),
      $resultat = $p.find("#o_syntheseResultat");
    if (erreur) {
      $resultat.html(`<p class='red'>${erreur}</p>`);
      return Promise.resolve();
    }
    $bouton.prop("disabled", true);
    $resultat.html("<p><em>Lecture du Google Sheet…</em></p>");
    // autres chasseurs toujours lus : le graphique du terrain les montre
    return ExportRapports.statistiques(debut, fin, true)
      .then((s) => this.montrer(s))
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
    let autres = !!this._$panneau.find("#o_syntheseAutres").prop("checked"),
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
        `<div class='o_syntheseCarte ${c.classe}'><span>${c.libelle}</span><b>${c.texte}</b>${c.detail ? `<small${c.classeDetail ? ` class='${c.classeDetail}'` : ""}>${c.detail}</small>` : ""}</div>`,
      cartes = SyntheseChasse.cartes(s),
      graphiques = SyntheseChasse.graphiques(s, autres, mesure)
        .map(
          (g, i) =>
            `<div class='o_syntheseGraphique'>${i == RANG_ARMEE_SYNTHESE ? SyntheseChasse.boutonsMesure(mesure) : ""}<div class='o_syntheseTrace'></div></div>`,
        )
        .join("");
    return `<p class='gras o_syntheseTitre'>Synthèse de ${Utils.echapper(s.joueur)} du ${jour(s.debut)} au ${jour(s.fin)}</p>
      ${cartes.some((c) => c.detail) ? `<p class='o_syntheseSousTitre'>Sous chaque chiffre : l'écart avec la moyenne des ${s.comparaison.lignes.length} chasseurs de la période</p>` : ""}
      <div class='o_syntheseCartes o_syntheseChiffres'>${cartes.map(carte).join("")}</div>
      <p class='o_syntheseSousTitre'>Armée hors bonus : la première multi-chasse (supposée emmener toute l'armée), puis l'effet en % de chaque chasse — pertes et expérience — sans les pontes</p>
      <div class='o_syntheseCartes o_syntheseArmee'>${SyntheseChasse.cartesArmee(s).map(carte).join("")}</div>
      <div class='o_syntheseGraphiques'>${graphiques}</div>
      ${SyntheseChasse.tableau(s)}`;
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
   * Chiffres clés de chasse de la période, lus dans le résumé du script, avec
   * l'écart à la moyenne des chasseurs de la période (chacun compte autant ;
   * mieux qu'elle en vert, moins bien en rouge : au-dessus, sauf pour les
   * pertes ; demandes du mainteneur), quand ils sont au moins deux et que le
   * joueur en est.
   *
   * @static
   * @method cartes
   * @param {any} s statistiques renvoyées par le script
   * @return {Array<{libelle: String, texte: String, classe: String, detail: String, classeDetail: String}>}
   */
  static cartes(s) {
    let v = (/** @type {String} */ libelle) => SyntheseChasse.resume(s, libelle),
      nombre = (/** @type {Number|null} */ n, unite = "") =>
        n == null ? "—" : numeral(n).format() + unite,
      c = s.comparaison,
      moi = String(s.joueur).toLowerCase(),
      // sans chasse dans la période, le joueur n'est pas l'un des chasseurs comparés
      compare =
        !!c &&
        c.lignes.length >= 2 &&
        c.lignes.some((/** @type {any[]} */ l) => String(l[0]).toLowerCase() == moi),
      moyenne = (/** @type {String} */ titre) => {
        if (!compare) return null;
        let m = c.moyenne[c.titres.indexOf(titre)];
        return typeof m == "number" && m > 0 ? m : null;
      },
      carte = (/** @type {String} */ libelle, /** @type {String} */ titre, unite = "") => {
        let valeur = v(titre),
          m = moyenne(titre),
          ecart = valeur == null || m == null ? null : ((valeur - m) / m) * 100,
          arrondi = ecart == null ? 0 : Number(ecart.toFixed(1));
        return {
          libelle,
          texte: nombre(valeur, unite),
          classe: "",
          detail: ecart == null ? "" : `${arrondi > 0 ? "+" : ""}${Utils.decimal(arrondi, 1)} %`,
          classeDetail: !arrondi
            ? ""
            : arrondi > 0 != SYNTHESE_MOINS_EST_MIEUX.includes(titre)
              ? "o_syntheseEcartMieux"
              : "o_syntheseEcartMoinsBien",
        };
      };
    return [
      carte("Chasses", "Chasses (RC)"),
      carte("Multi-chasses", "Multi-chasses"),
      carte("Terrain chassé", "Terrain chassé (cm²)", " cm²"),
      carte("Pertes", "Fourmis perdues"),
      carte("Pertes / M cm² chassé", "Pertes par M cm² chassé"),
      carte("Nourriture rapportée", "Nourriture rapportée"),
      carte("Nourriture / multi-chasse", "Nourriture par multi-chasse"),
    ];
  }
  /**
   * Tableau des chasseurs de la période (le joueur compris), du plus grand
   * terrain chassé au plus petit, puis leur moyenne ; vide si le script ne
   * le donne pas (format 4).
   *
   * @static
   * @method tableau
   * @param {any} s statistiques renvoyées par le script
   * @return {String}
   */
  static tableau(s) {
    let c = s.comparaison;
    if (!c)
      return "<p class='o_syntheseSousTitre'>Tableau des chasseurs : le script du Google Sheet n'est pas à jour.</p>";
    let k = (/** @type {String} */ titre) => c.titres.indexOf(titre),
      colonnes = [
        ["Terrain chassé (cm²)", "Terrain chassé (cm²)"],
        ["Terrain / multi-chasse", "Terrain par multi-chasse (cm²)"],
        ["Pertes", "Fourmis perdues"],
        ["Pertes / M cm² chassé", "Pertes par M cm² chassé"],
        ["Nourriture rapportée", "Nourriture rapportée"],
        ["Nourriture / multi-chasse", "Nourriture par multi-chasse"],
      ],
      cellules = (/** @type {any[]} */ l) =>
        colonnes
          .map(
            ([, t]) => `<td>${typeof l[k(t)] == "number" ? numeral(l[k(t)]).format() : "—"}</td>`,
          )
          .join(""),
      moi = String(s.joueur).toLowerCase(),
      lignes = c.lignes
        .slice()
        .sort(
          (/** @type {any[]} */ a, /** @type {any[]} */ b) =>
            (Number(b[k("Terrain chassé (cm²)")]) || 0) -
            (Number(a[k("Terrain chassé (cm²)")]) || 0),
        )
        .map(
          (/** @type {any[]} */ l) =>
            `<tr${String(l[0]).toLowerCase() == moi ? " class='o_syntheseMoi'" : ""}><td><span style="color:${SyntheseChasse.style(s, l[0]).color}">●</span> ${Utils.echapper(String(l[0]))}</td>${cellules(l)}</tr>`,
        )
        .join("");
    return `<div class='o_syntheseTableau'><p class='gras o_syntheseTitre'>Chasseurs de la période</p>
      <table class='o_syntheseComparaison'><thead><tr><th>Chasseur</th>${colonnes.map(([nom]) => `<th>${nom}</th>`).join("")}</tr></thead>
      <tbody>${lignes}</tbody>
      <tfoot><tr class='o_syntheseTotal'><td>Moyenne des chasseurs</td>${cellules(c.moyenne)}</tr></tfoot></table></div>`;
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
   * Couleur et trait d'un chasseur : le joueur en vert, trait plein ; un autre
   * selon son rang parmi les chasseurs du fichier sans le joueur (la même
   * couleur dans chaque graphique, cacher un chasseur ne change pas les autres).
   *
   * @static
   * @method style
   * @param {any} s
   * @param {String} joueur
   * @return {{color: String, dashStyle: String}}
   */
  static style(s, joueur) {
    let cle = (/** @type {String} */ j) => String(j).toLowerCase();
    if (cle(joueur) == cle(s.joueur)) return { color: COULEUR_JOUEUR, dashStyle: "Solid" };
    let i = Math.max(
      0,
      (s.chasseurs || [])
        .filter((/** @type {String} */ c) => cle(c) != cle(s.joueur))
        .findIndex((/** @type {String} */ c) => cle(c) == cle(joueur)),
    );
    return {
      color: COULEURS_AUTRES[i % COULEURS_AUTRES.length],
      dashStyle: TRAITS_AUTRES[Math.floor(i / COULEURS_AUTRES.length) % TRAITS_AUTRES.length],
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
   * Instant (ms) d'un numéro de série du tableur : l'heure du fichier lue comme
   * UTC, que Highcharts (useUTC) affiche telle quelle.
   *
   * @static
   * @method instant
   * @param {Number} serie
   * @return {Number}
   */
  static instant(serie) {
    return Math.round((serie - JOURS_TABLEUR_1970) * 86400000);
  }
  /**
   * Moyenne point par point de courbes de même longueur (la première), comme
   * le script du Sheet (moyenneDesCourbes) ; [] sans courbe.
   *
   * @static
   * @method moyenne
   * @param {Array<Array<Number|null>>} courbes
   * @return {Array<Number|null>}
   */
  static moyenne(courbes) {
    if (!courbes.length) return [];
    return courbes[0].map((v, i) => {
      let valeurs = courbes.map((c) => c[i]).filter((x) => typeof x == "number");
      return valeurs.length
        ? Math.round(
            valeurs.reduce((/** @type {Number} */ a, b) => a + Number(b), 0) / valeurs.length,
          )
        : null;
    });
  }
  /**
   * Droite des moindres carrés d'une courbe, jamais négative, comme le script
   * du Sheet (tendance).
   *
   * @static
   * @method tendance
   * @param {Array<Number|null>} valeurs
   * @return {Array<Number>}
   */
  static tendance(valeurs) {
    let y = valeurs.map((v) => Number(v) || 0),
      n = y.length,
      mx = (n - 1) / 2,
      my = y.reduce((a, b) => a + b, 0) / (n || 1),
      sxy = 0,
      sxx = 0;
    y.forEach((v, x) => {
      sxy += (x - mx) * (v - my);
      sxx += (x - mx) * (x - mx);
    });
    return y.map((v, x) => Math.max(0, Math.round(my + (sxx ? sxy / sxx : 0) * (x - mx))));
  }
  /**
   * Tendance de la moyenne des chasseurs affichés, recalculée quand un chasseur
   * est caché ou montré par la légende du graphique du terrain.
   *
   * @static
   * @method recalculer
   * @param {any} graphique graphique Highcharts
   */
  static recalculer(graphique) {
    let courbes = graphique.series
        .filter((/** @type {any} */ se) => se.userOptions.chasseur && se.visible)
        .map((/** @type {any} */ se) => se.userOptions.data),
      serieTendance = graphique.get("o_tendanceMoyenne");
    if (serieTendance)
      serieTendance.setData(
        courbes.length ? SyntheseChasse.tendance(SyntheseChasse.moyenne(courbes)) : [],
        false,
      );
    graphique.redraw();
  }
  /**
   * Options Highcharts des graphiques de la période : terrain, nourriture et
   * pertes de chaque chasse ; terrain du joueur, des autres chasseurs et la
   * tendance de leur moyenne ; nourriture selon le terrain ; terrain selon la difficulté par cm² ;
   * pertes par M cm² dans le temps ; armée. Les autres chasseurs : toujours au
   * graphique du terrain, sinon si demandé.
   *
   * @static
   * @method graphiques
   * @param {any} s statistiques renvoyées par le script
   * @param {Boolean} [autres] avec les autres chasseurs
   * @param {Number} [mesure] mesure du graphique de l'armée (MESURES_ARMEE)
   * @return {Array<any>}
   */
  static graphiques(s, autres = false, mesure = 0) {
    let tous = s.autres || [],
      eux = autres ? tous : [],
      chasses = SyntheseChasse.colonne(s, "Chasse"),
      retours = SyntheseChasse.colonne(s, "Retour"),
      terrain = SyntheseChasse.colonne(s, "Terrain (cm²)"),
      nourriture = SyntheseChasse.colonne(s, "Nourriture"),
      entier = (/** @type {Number} */ v) => numeral(v).format(),
      centieme = (/** @type {Number} */ v) => Utils.decimal(v, 2),
      jour = (/** @type {Number} */ serie) =>
        moment.utc(SyntheseChasse.instant(serie)).format("DD/MM"),
      echappe = (/** @type {any} */ t) => Utils.echapper(String(t)),
      cadre = (/** @type {Number} */ hauteur) => ({
        height: hauteur,
        backgroundColor: FOND_GRAPHIQUE,
        borderRadius: 4,
        spacing: [8, 8, 8, 8],
      }),
      titre = (/** @type {String} */ texte) => ({
        text: texte,
        align: "left",
        style: { fontSize: "13px", fontWeight: "bold" },
      }),
      // graduations à la française (« 50 000 », pas « 50k »)
      axe = (
        /** @type {String|null} */ nom,
        /** @type {(v: Number) => String} */ format,
        options = {},
      ) => ({
        title: { text: nom, style: { fontSize: "11px", color: ENCRE_GRAPHIQUE } },
        min: 0,
        gridLineColor: GRILLE_GRAPHIQUE,
        labels: {
          formatter: /** @this {any} */ function () {
            return format(this.value);
          },
        },
        ...options,
      }),
      // abscisse des graphiques par chasse : « Chasse 1 (01/11) »…
      axeChasses = {
        categories: chasses,
        lineColor: GRILLE_GRAPHIQUE,
        labels: { style: { fontSize: "10px" } },
      },
      // info-bulle d'une chasse du joueur : son retour, puis chaque courbe
      bulleChasse = (/** @type {(p: any) => String} */ format) => ({
        shared: true,
        formatter: /** @this {any} */ function () {
          let i = this.points && this.points.length ? this.points[0].point.index : 0;
          return (
            `<b>${echappe(chasses[i] || "")}</b>${retours[i] ? ` (retour ${echappe(retours[i])})` : ""}<br/>` +
            (this.points || [])
              .map(
                (/** @type {any} */ p) =>
                  `<span style="color:${p.color}">●</span> ${echappe(p.series.name)} : <b>${format(p)}</b>`,
              )
              .join("<br/>")
          );
        },
      }),
      // un point par chasse : celles du joueur, puis celles des autres si demandé
      nuage = (
        /** @type {String} */ nomX,
        /** @type {String} */ nomY,
        /** @type {(v: Number) => String} */ formatX,
        /** @type {(v: Number) => String} */ formatY,
        /** @type {Array<Number|null>} */ xMiens,
        /** @type {Array<Number|null>} */ yMiens,
        /** @type {(a: any) => Array<Number|null>} */ xAutre,
        /** @type {(a: any) => Array<Number|null>} */ yAutre,
        /** @type {String} */ texte,
        optionsX = {},
      ) => ({
        chart: { type: "scatter", ...cadre(280) },
        title: titre(texte),
        credits: { enabled: false },
        xAxis: axe(nomX, formatX, { lineColor: GRILLE_GRAPHIQUE, gridLineWidth: 0, ...optionsX }),
        yAxis: axe(nomY, formatY),
        legend: { enabled: eux.length > 0 },
        tooltip: {
          formatter: /** @this {any} */ function () {
            return `<b>${echappe(this.series.name)}</b> · ${echappe(this.point.name)}<br/>${echappe(nomX)} : <b>${formatX(this.x)}</b><br/>${echappe(nomY)} : <b>${formatY(this.y)}</b>`;
          },
        },
        plotOptions: { scatter: { marker: { symbol: "circle" } }, series: { turboThreshold: 0 } },
        series: [
          {
            name: s.joueur,
            color: COULEUR_JOUEUR,
            marker: { radius: 5, lineColor: FOND_GRAPHIQUE, lineWidth: 1 },
            data: xMiens
              .map((x, i) => ({ x, y: yMiens[i], name: chasses[i] }))
              .filter((p) => p.x != null && p.y != null),
          },
          ...eux.map((/** @type {any} */ a) => ({
            name: a.joueur,
            color: SyntheseChasse.style(s, a.joueur).color,
            marker: { radius: 4, lineColor: FOND_GRAPHIQUE, lineWidth: 1 },
            data: xAutre(a)
              .map((x, k) => ({
                x,
                y: yAutre(a)[k],
                name: `Chasse ${k + 1} (${jour(a.dates[k])})`,
              }))
              .filter((p) => typeof p.x == "number" && typeof p.y == "number"),
          })),
        ],
      }),
      // terrain du joueur et des autres chasseurs (étirés sur ses chasses) :
      // la moyenne suit les chasseurs affichés
      chasseurs = [
        {
          name: s.joueur,
          data: terrain,
          chasseur: true,
          color: COULEUR_JOUEUR,
          // même pointillé que les autres chasseurs : seule la couleur les distingue
          dashStyle: TRAITS_AUTRES[0],
          lineWidth: 2,
          zIndex: 5,
          marker: { enabled: false },
        },
        ...tous.map((/** @type {any} */ a) => ({
          name: a.joueur,
          data: a.etire,
          chasseur: true,
          ...SyntheseChasse.style(s, a.joueur),
          lineWidth: 2,
          marker: { enabled: false },
        })),
      ],
      moyenneChasseurs = SyntheseChasse.moyenne(chasseurs.map((c) => c.data)),
      pertes = SyntheseChasse.colonne(s, "Pertes / M cm²"),
      // celle de la carte : pertes totales ÷ terrain total (demande du mainteneur)
      moyennePertes = SyntheseChasse.resume(s, "Pertes par M cm² chassé"),
      dates = SyntheseChasse.colonne(s, "Date");
    return [
      // terrain en colonnes (axe de gauche), nourriture et pertes en courbes,
      // chacune son axe à droite (les pertes, 100 à 200 fois moins, s'écraseraient)
      {
        chart: cadre(300),
        title: titre("Terrain, nourriture et pertes de chaque chasse"),
        credits: { enabled: false },
        xAxis: axeChasses,
        yAxis: [
          axe("Terrain (cm²)", entier),
          axe("Nourriture", entier, { opposite: true, gridLineWidth: 0 }),
          axe("Pertes", entier, { opposite: true, gridLineWidth: 0 }),
        ],
        tooltip: bulleChasse((p) => entier(p.y)),
        legend: { enabled: true },
        plotOptions: { series: { turboThreshold: 0 } },
        series: [
          {
            type: "column",
            name: "Terrain chassé (cm²)",
            data: terrain,
            yAxis: 0,
            color: COULEUR_JOUEUR,
            maxPointWidth: 24,
            borderRadius: 2,
          },
          {
            type: "line",
            name: "Nourriture",
            data: nourriture,
            yAxis: 1,
            color: COULEUR_NOURRITURE,
            lineWidth: 2,
            marker: { radius: 3 },
          },
          {
            type: "line",
            name: "Pertes",
            data: SyntheseChasse.colonne(s, "Pertes"),
            yAxis: 2,
            color: COULEUR_PERTES,
            lineWidth: 2,
            marker: { radius: 3 },
          },
        ],
      },
      // chaque chasseur en pointillés, de sa couleur (le joueur en vert) ; les
      // deux tendances en tirets, la sienne en vert, celle de la moyenne des
      // chasseurs affichés en rouge (recalculée à chaque clic dans la légende)
      {
        chart: { type: "line", ...cadre(320) },
        title: titre(
          "Terrain chassé à chaque chasse : toi, les autres chasseurs et la tendance de leur moyenne",
        ),
        subtitle: {
          text: "Les autres chasseurs : leurs chasses étirées sur les tiennes, de la première à la dernière. Clic sur un nom de la légende : le cacher ou le montrer ; la tendance de la moyenne suit les chasseurs affichés.",
          align: "left",
          style: { fontSize: "11px", color: ENCRE_GRAPHIQUE },
        },
        credits: { enabled: false },
        xAxis: axeChasses,
        yAxis: axe(null, entier),
        tooltip: bulleChasse((p) => entier(p.y)),
        // symboles assez longs pour montrer les tirets des tendances
        legend: {
          enabled: true,
          symbolWidth: 32,
          itemStyle: { fontSize: "11px", fontWeight: "normal" },
        },
        plotOptions: {
          series: {
            turboThreshold: 0,
            events: {
              show: /** @this {any} */ function () {
                SyntheseChasse.recalculer(this.chart);
              },
              hide: /** @this {any} */ function () {
                SyntheseChasse.recalculer(this.chart);
              },
            },
          },
        },
        series: [
          ...chasseurs,
          {
            id: "o_tendanceMoyenne",
            name: "Tendance de la moyenne",
            data: SyntheseChasse.tendance(moyenneChasseurs),
            color: COULEUR_MOYENNE,
            dashStyle: TRAIT_TENDANCE,
            lineWidth: 2,
            zIndex: 4,
            marker: { enabled: false },
            enableMouseTracking: false,
          },
          {
            name: "Ta tendance",
            data: SyntheseChasse.colonne(s, "Tendance (cm²)"),
            color: COULEUR_JOUEUR,
            dashStyle: TRAIT_TENDANCE,
            lineWidth: 2,
            zIndex: 4,
            marker: { enabled: false },
            enableMouseTracking: false,
          },
        ],
      },
      nuage(
        "Terrain chassé (cm²)",
        "Nourriture",
        entier,
        entier,
        terrain,
        nourriture,
        (a) => a.terrain,
        (a) => a.nourriture,
        "Nourriture selon le terrain chassé (un point par chasse)",
      ),
      nuage(
        "Difficulté par cm² (faune rencontrée)",
        "Terrain chassé (cm²)",
        centieme,
        entier,
        SyntheseChasse.colonne(s, "Difficulté / cm²"),
        terrain,
        (a) => a.difficulte,
        (a) => a.terrain,
        "Terrain chassé selon la difficulté par cm² (un point par chasse)",
        // difficultés proches les unes des autres : l'axe part de la plus petite, pas de 0
        {
          min: null,
          labels: {
            formatter: /** @this {any} */ function () {
              return Utils.decimal(this.value, 2, true);
            },
          },
        },
      ),
      // pertes par M cm² de chaque chasse à son heure de retour, et leur moyenne
      {
        chart: { type: "line", ...cadre(280) },
        title: titre("Pertes par M cm² de chaque chasse dans le temps"),
        subtitle: {
          text:
            moyennePertes == null
              ? ""
              : `Moyenne de la période : ${entier(moyennePertes)} (tirets, le chiffre de la carte)`,
          align: "left",
          style: { fontSize: "11px", color: ENCRE_GRAPHIQUE },
        },
        credits: { enabled: false },
        xAxis: {
          type: "datetime",
          lineColor: GRILLE_GRAPHIQUE,
          labels: { style: { fontSize: "10px" } },
          dateTimeLabelFormats: { hour: "%d/%m %Hh", day: "%d/%m", week: "%d/%m", month: "%m/%Y" },
        },
        yAxis: axe(null, entier, {
          plotLines:
            moyennePertes == null
              ? []
              : [
                  {
                    value: moyennePertes,
                    color: ENCRE_GRAPHIQUE,
                    dashStyle: "Dash",
                    width: 1,
                    zIndex: 3,
                  },
                ],
        }),
        tooltip: {
          formatter: /** @this {any} */ function () {
            return `<b>${echappe(this.series.name)}</b> · ${moment.utc(this.x).format("DD/MM HH:mm")}<br/>Pertes par M cm² : <b>${entier(this.y)}</b>`;
          },
        },
        legend: { enabled: eux.length > 0 },
        plotOptions: { series: { turboThreshold: 0 } },
        series: [
          {
            name: s.joueur,
            color: COULEUR_JOUEUR,
            lineWidth: 2,
            zIndex: 5,
            marker: { enabled: true, radius: 4, lineColor: FOND_GRAPHIQUE, lineWidth: 1 },
            data: dates
              .map((d, i) => [d == null ? null : SyntheseChasse.instant(d), pertes[i]])
              .filter((p) => p[0] != null && p[1] != null),
          },
          ...eux.map((/** @type {any} */ a) => ({
            name: a.joueur,
            ...SyntheseChasse.style(s, a.joueur),
            lineWidth: 1.5,
            marker: { enabled: true, radius: 3 },
            data: (a.dates || [])
              .map((/** @type {Number} */ d, /** @type {Number} */ k) => [
                SyntheseChasse.instant(d),
                a.pertes[k],
              ])
              .filter((/** @type {any[]} */ p) => typeof p[1] == "number"),
          })),
        ],
      },
      SyntheseChasse.graphiqueArmee(s, mesure),
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
