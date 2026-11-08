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
// séries du graphique du terrain, dans l'ordre des colonnes de l'évolution
const COULEURS_SYNTHESE = ["#9A5700", "#4a7a2c", "#2c6a9a", "#b03a2e"];

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
        </p>
        <div id='o_syntheseResultat'><p><em>Choisis la période, puis « Afficher » : les résultats sont calculés dans le Google Sheet où tu exportes tes rapports, comme son onglet « Statistiques ».</em></p></div>
      </div>`);
    this._$panneau.find("#o_syntheseAfficher").on("click", () => this.charger());
    return this;
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
    return ExportRapports.statistiques(debut, fin)
      .then(
        (s) => this.montrer(s),
        (e) =>
          $resultat.html(
            `<p class='red'>Synthèse impossible : ${Utils.echapper(e && e.message ? e.message : "erreur inconnue")}.</p>`,
          ),
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
    let $resultat = this._$panneau.find("#o_syntheseResultat").html(SyntheseChasse.html(s));
    if (typeof Highcharts == "undefined") {
      $resultat
        .find(".o_syntheseGraphiques")
        .html(
          "<p><em>Graphiques : ouvre les « Outils pour Chasseur » depuis la <a href='/messagerie.php'>Messagerie</a> (la bibliothèque de graphiques n'est chargée que sur les pages Messagerie, Alliance et Construction).</em></p>",
        );
      return;
    }
    SyntheseChasse.graphiques(s).forEach((options, i) => {
      let $div = $(`<div class='o_syntheseGraphique' id='o_syntheseGraphique${i}'></div>`).appendTo(
        $resultat.find(".o_syntheseGraphiques"),
      );
      this._graphiques.push(Highcharts.chart($div[0], options));
    });
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
   * Résumé, place des graphiques et classements, au style des tableaux du jeu.
   *
   * @static
   * @method html
   * @param {any} s statistiques renvoyées par le script
   * @return {String}
   */
  static html(s) {
    let jour = (/** @type {String} */ j) => moment(j, "YYYY-MM-DD").format("DD/MM/YYYY"),
      valeur = (/** @type {any} */ v) =>
        v === "" || v == null
          ? "—"
          : typeof v == "number"
            ? numeral(v).format()
            : Utils.echapper(v),
      resume = s.resume
        .map((/** @type {any[]} */ l) =>
          l[1] === ""
            ? `<tr class='gras o_syntheseSection'><td colspan='2' class='left'>${Utils.echapper(l[0])}</td></tr>`
            : `<tr><td class='left'>${Utils.echapper(l[0])}</td><td class='right'>${valeur(l[1])}</td></tr>`,
        )
        .join(""),
      tableau = (/** @type {String} */ titre, /** @type {any} */ t) =>
        `<p class='gras o_marginT15'>${titre}</p>` +
        (t.lignes.length
          ? `<table class='o_maxWidth o_syntheseTableau' cellspacing='0'><tr class='gras'>${t.titres
              .map(
                (/** @type {String} */ x, /** @type {Number} */ i) =>
                  `<td class='${i ? "right" : "left"}'>${Utils.echapper(x)}</td>`,
              )
              .join("")}</tr>${t.lignes
              .map(
                (/** @type {any[]} */ l) =>
                  `<tr>${l.map((v, i) => `<td class='${i ? "right" : "left"}'>${valeur(v)}</td>`).join("")}</tr>`,
              )
              .join("")}</table>`
          : "<p><em>Aucun.</em></p>");
    return `<p class='gras o_marginT15'>Synthèse de ${Utils.echapper(s.joueur)} du ${jour(s.debut)} au ${jour(s.fin)}</p>
      <table class='o_maxWidth o_syntheseResume' cellspacing='0'>${resume}</table>
      <p class='gras o_marginT15'>Évolution ${PAS_SYNTHESE[/** @type {"jour"} */ (s.pas)] || ""}</p>
      <div class='o_syntheseGraphiques'></div>
      ${tableau("Cibles hors alliance", s.cibles)}
      ${tableau("Attaquants hors alliance", s.attaquants)}
      ${tableau("Floods internes", s.internes)}`;
  }
  /**
   * Options Highcharts des trois graphiques de l'évolution (mêmes séries que
   * l'onglet « Statistiques » du fichier).
   *
   * @static
   * @method graphiques
   * @param {any} s statistiques renvoyées par le script
   * @return {Array<any>}
   */
  static graphiques(s) {
    let lignes = s.evolution.lignes,
      titres = s.evolution.titres,
      colonne = (/** @type {Number} */ i) =>
        lignes.map((/** @type {any[]} */ l) => (l[i] === "" ? null : l[i])),
      base = (
        /** @type {String} */ type,
        /** @type {String} */ titre,
        /** @type {Array<any>} */ series,
      ) => ({
        chart: { type, height: 260, backgroundColor: "transparent", spacing: [6, 6, 6, 6] },
        title: { text: titre, style: { fontSize: "13px", fontWeight: "bold" } },
        credits: { enabled: false },
        xAxis: {
          categories: lignes.map((/** @type {any[]} */ l) => l[0]),
          labels: { style: { fontSize: "10px" } },
        },
        // graduations à la française (« 50 000 », pas « 50k »)
        yAxis: {
          title: { text: null },
          labels: {
            formatter: /** @this {any} */ function () {
              return numeral(this.value).format();
            },
          },
        },
        tooltip: { shared: true },
        legend: { enabled: series.length > 1 },
        series,
      });
    return [
      {
        ...base(
          "column",
          "Terrain gagné ou perdu (cm²)",
          [1, 2, 3, 4].map((i, k) => ({
            name: titres[i],
            color: COULEURS_SYNTHESE[k],
            data: colonne(i),
          })),
        ),
        plotOptions: { column: { stacking: "normal" } },
      },
      base("column", "Nourriture rapportée par les chasses", [
        { name: titres[5], color: "#7a6a3a", data: colonne(5) },
      ]),
      base("line", "Pertes par million de cm² chassés", [
        { name: titres[6], color: "#9A5700", data: colonne(6) },
      ]),
    ];
  }
}
