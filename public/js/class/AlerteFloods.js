// @ts-check
/*
 * AlerteFloods.js
 * Page Ressources : les floods partagés sur le joueur qui arrivent bientôt,
 * sous les boutons d'envoi du lanceur de chasses, sur toute la largeur
 * (demandes du mainteneur, 20 et 21/11/2026). Sans flood dans le délai
 * choisi, la page ne change pas.
 **********************************************************************/

// texte (« dans 23 min ») refait chaque minute, sans lecture
const MS_ALERTE_FLOODS = 60000;
// essais du mainteneur (20/11/2026) : la ligne « Journal » des réglages de l'alliance
// voit un flood fictif quand aucun n'arrive ; à retirer une fois les essais finis
const ALERTE_FLOODS_ESSAI = true;
const MINUTES_FLOOD_FICTIF = 20;
let minuterieAlerteFloods = 0;

/**
 * @class AlerteFloods
 */
class AlerteFloods {
  /**
   * Délai choisi dans Préférences → Ressources, en heures.
   *
   * @static
   * @method heures
   * @return {Number}
   */
  static heures() {
    let p = monProfil.parametre && monProfil.parametre["alerteFloods"],
      rang = p ? Number(p.valeur) : ALERTE_FLOODS_DEFAUT;
    return ALERTE_FLOODS_HEURES[rang] ?? ALERTE_FLOODS_HEURES[ALERTE_FLOODS_DEFAUT];
  }
  /**
   * Floods partagés sur moi, rejoués avec les partages du forum comme sur la
   * page d'un membre : la prise et la portée à l'impact suivent les chasses et
   * les floods de chacun. Mes chasses sont celles de la page (elle fait foi),
   * mes floods ceux que j'ai partagés (la page Ressources ne liste pas mes
   * attaques).
   *
   * @static
   * @method lire
   * @param {Array} chasses PageRessource.lireChasses de la page
   * @return {Promise<Array>} événements de PartageChasses.simuler sur moi
   */
  static lire(chasses) {
    let moi = monProfil.pseudo,
      m = String(moi || "").toLowerCase(),
      minute = (/** @type {any} */ instant) => instant.format("YYYY-MM-DD HH:mm");
    if (!moi) return Promise.resolve([]);
    return PartageChasses.enFile(() => PartageChasses.charger([moi], true))
      .then((/** @type {any} */ d) => {
        let mesChasses = PageRessource.aPartager(PageRessource.grouperChasses(chasses)).map(
          (/** @type {any} */ g) => ({ date: minute(g.impact), terrain: g.terrain }),
        );
        return PartageChasses.completer(
          { chasses: { ...d.chasses, [m]: mesChasses }, floods: d.floods },
          [moi],
        );
      })
      .then(({ d, tdc }) =>
        PartageChasses.simuler(
          d,
          PartageChasses.tdcConnus(tdc, { [moi]: Utils.terrain }),
        ).evenements.filter(
          (/** @type {any} */ e) => e.type == "flood" && String(e.cible).toLowerCase() == m,
        ),
      );
  }
  /**
   * Floods qui arrivent d'ici `heures` : leur minute de RC est après la
   * minute en cours (un flood de la minute en cours est déjà arrivé) et au
   * plus celle d'une arrivée dans `heures`.
   *
   * @static
   * @method prochains
   * @param {Array} floods voir lire
   * @param {any} maintenant moment, heure du serveur
   * @param {Number} heures
   * @return {Array}
   */
  static prochains(floods, maintenant, heures) {
    let debut = maintenant.format("YYYY-MM-DD HH:mm"),
      fin = Utils.minuteRC(moment(maintenant).add(heures * 60, "minutes")).format(
        "YYYY-MM-DD HH:mm",
      );
    return floods.filter((e) => e.date > debut && e.date <= fin);
  }
  /**
   * « 30 min », « 1 h », « 1 h 05 » : temps jusqu'à la minute du RC.
   *
   * @static
   * @method dans
   * @param {Number} ms
   * @return {String}
   */
  static dans(ms) {
    let minutes = Math.max(1, Math.round(ms / 60000)),
      h = Math.floor(minutes / 60),
      reste = minutes % 60;
    return h ? `${h} h${reste ? " " + String(reste).padStart(2, "0") : ""}` : `${minutes} min`;
  }
  /**
   * Contenu de l'alerte ; vide sans flood dans le délai.
   *
   * @static
   * @method html
   * @param {Array} floods voir lire
   * @param {any} maintenant moment, heure du serveur
   * @param {Number} heures
   * @param {Boolean} [fictif] flood d'essai : signalé, sans lien vers un joueur
   * @return {String}
   */
  static html(floods, maintenant, heures, fictif = false) {
    let liste = AlerteFloods.prochains(floods, maintenant, heures);
    if (!liste.length) return "";
    let delai = heures < 1 ? `${heures * 60} min` : `${numeral(heures).format()} h`,
      titre =
        (liste.length == 1
          ? `⚠️ 1 flood arrive sur toi d'ici <span>${delai}</span>`
          : `⚠️ ${liste.length} floods arrivent sur toi d'ici <span>${delai}</span>`) +
        (fictif ? " (test : flood fictif)" : ""),
      lignes = liste.map((e) => {
        let impact = moment(e.date, "YYYY-MM-DD HH:mm"),
          lanceur = fictif
            ? Utils.echapper(e.lanceur)
            : `<a href='Membre.php?Pseudo=${encodeURIComponent(e.lanceur)}'>${Utils.echapper(e.lanceur)}</a>`;
        return `<div class='o_alerteFloodsLigne'>${lanceur} à ${impact.format("HH[h]mm")} (dans ${AlerteFloods.dans(impact.valueOf() - maintenant.valueOf())}) : ${PartageChasses.libellePrise({ delta: -e.prise, statut: e.statut, lieu: e.lieu || null })}</div>`;
      });
    return `<div class='o_alerteFloodsTitre'>${titre}</div>${lignes.join("")}`;
  }
  /**
   * Joueur des essais de l'alerte (ligne « Journal » des réglages de l'alliance).
   *
   * @static
   * @method essai
   * @return {Boolean}
   */
  static essai() {
    return ALERTE_FLOODS_ESSAI && Journal.pourCeJoueur();
  }
  /**
   * Flood fictif des essais, dans MINUTES_FLOOD_FICTIF minutes.
   *
   * @static
   * @method fictif
   * @param {any} maintenant moment, heure du serveur
   * @return {Object} événement comme ceux de lire
   */
  static fictif(maintenant) {
    return {
      type: "flood",
      date: Utils.minuteRC(moment(maintenant).add(MINUTES_FLOOD_FICTIF, "minutes")).format(
        "YYYY-MM-DD HH:mm",
      ),
      lanceur: "Exemple",
      cible: monProfil.pseudo,
      prise: 12345,
      statut: "ok",
    };
  }
  /**
   * Lit les floods sur moi et place l'alerte sous les boutons « Envoyer » du
   * lanceur de la page, déjà affiché ; refaite chaque minute sans lecture.
   * Forum illisible : rien (la page reste celle d'aujourd'hui), noté au journal ;
   * pendant les essais, le flood fictif quand aucun n'arrive.
   *
   * @static
   * @method installer
   * @return {Promise<void>}
   */
  static installer() {
    if (!monProfil.pseudo || !Utils.alliance || Utils.sansConfigAlliance())
      return Promise.resolve();
    let heures = AlerteFloods.heures();
    return AlerteFloods.lire(PageRessource.lireChasses($(document)))
      .catch((/** @type {any} */ e) => {
        // niveau « alerte », pas « erreur » : une alliance sans les sujets partagés
        // n'enverrait pas son journal chaque jour pour autant (EnvoiJournal)
        Journal.noter(
          "alerte",
          "Alerte des floods",
          "floods partagés sur moi illisibles : pas d'alerte",
          String((e && e.message) || e),
        );
        return [];
      })
      .then((floods) => {
        let maj = () => {
          let maintenant = Horloge.serveur(),
            html = AlerteFloods.html(floods, maintenant, heures);
          if (!html && AlerteFloods.essai())
            html = AlerteFloods.html([AlerteFloods.fictif(maintenant)], maintenant, heures, true);
          let $alerte = $("#o_alerteFloods");
          if (!$alerte.length) {
            if (!html) return;
            let $pile = $("#o_chasseEnvoyer").closest(".o_pile");
            if (!$pile.length) return;
            $pile.after(
              "<div id='o_alerteFloods' class='o_alerteFloods' role='status' title='Floods partagés dans le forum de l&#39;alliance : une attaque ennemie n&#39;y figure pas. Heure du rapport, à la minute ; prise estimée à l&#39;impact.'></div>",
            );
            $alerte = $("#o_alerteFloods");
          }
          $alerte.html(html).prop("hidden", !html);
        };
        maj();
        clearInterval(minuterieAlerteFloods);
        minuterieAlerteFloods = Number(setInterval(maj, MS_ALERTE_FLOODS));
      });
  }
}
