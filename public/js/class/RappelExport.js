/*
 * RappelExport.js
 **********************************************************************/

// deux exports des chasses par semaine (règle du mainteneur) : le jeu supprime
// les conversations lues au bout de 7 jours. Rendez-vous le mercredi et le
// dimanche à 22h, heure du serveur ; jours de moment().day()
const RAPPEL_EXPORT_JOURS = [3, 0];
const RAPPEL_EXPORT_HEURE = 22;
// seule la fréquence compte : un export des 24 h d'avant vaut pour le rendez-vous
// (au pire 5 jours entre deux exports sans rappel, 2 avant la suppression)
const HEURES_EXPORT_AVANT_RDV = 24;
// dernier export des chasses mené au bout (ms, horloge du serveur)
const CLE_EXPORT_CHASSES_FAIT = "fzzz_exportChassesFait";
// la croix masque le rappel jusqu'à cette heure (ms)
const CLE_RAPPEL_EXPORT_MASQUE = "fzzz_rappelExportMasque";
const MINUTES_MASQUAGE_RAPPEL = 60;

/**
 * Rendez-vous d'export des chasses du rôle Chasseur, le mercredi et le
 * dimanche à 22h, sauf export dans les 24 h d'avant. L'export automatique
 * (ExportAuto) s'en charge quand le joueur lance ensuite une chasse ; le
 * rappel « Export des chasses à faire », un bandeau sous le menu sans aucune
 * requête au jeu, ne reste que s'il ne peut pas le faire : case décochée, ou
 * essai en échec. Le joueur ouvre alors la messagerie et clique.
 *
 * @class RappelExport
 */
class RappelExport {
  /**
   * Dernier rendez-vous d'export passé à `maintenant`.
   *
   * @static
   * @method dernier
   * @param {Object} maintenant heure du serveur (moment)
   * @return {Object} moment
   */
  static dernier(maintenant) {
    for (let j = 0; j <= 7; j++) {
      let rdv = moment(maintenant)
        .subtract(j, "days")
        .hours(RAPPEL_EXPORT_HEURE)
        .minutes(0)
        .seconds(0)
        .milliseconds(0);
      if (RAPPEL_EXPORT_JOURS.includes(rdv.day()) && !rdv.isAfter(maintenant)) return rdv;
    }
    return null;
  }
  /**
   * Le rappel est-il à montrer maintenant ?
   *
   * @static
   * @method aRappeler
   * @return {Boolean}
   */
  static aRappeler() {
    if (!RappelExport.chasseur()) return false;
    if (!Utils.affichage("rappelExport")) return false;
    // sans le bouton « Exporter mes chasses » de la messagerie, rien à rappeler
    if (Utils.origine("Messagerie") || !Utils.affichage("messagerieExport")) return false;
    let rdv = RappelExport.rendezVousDu();
    return (
      !!rdv &&
      !(typeof ExportAuto != "undefined" && ExportAuto.enCharge(rdv)) &&
      RappelExport._lire(CLE_RAPPEL_EXPORT_MASQUE) < Horloge.maintenant()
    );
  }
  /**
   * @static
   * @method chasseur
   * @return {Boolean} rôle « Chasseur » choisi dans les Préférences
   */
  static chasseur() {
    let role = monProfil.parametre && monProfil.parametre["role"];
    return !!role && parseInt(role.valeur) == ROLE_CHASSEUR;
  }
  /**
   * @private
   * @static
   * @param {String} cle
   * @return {Number} instant gardé (ms), 0 sans
   */
  static _lire(cle) {
    try {
      return Number(localStorage.getItem(cle)) || 0;
    } catch (e) {
      return 0;
    }
  }
  /**
   * @static
   * @method exportFait
   * @return {Number} dernier export des chasses mené au bout dans ce navigateur (ms), 0 sans
   */
  static exportFait() {
    return RappelExport._lire(CLE_EXPORT_CHASSES_FAIT);
  }
  /**
   * Rendez-vous passé dont l'export reste à faire.
   *
   * @static
   * @method rendezVousDu
   * @return {Number} son instant (ms, heure du serveur), 0 si l'export est à jour
   */
  static rendezVousDu() {
    let rdv = RappelExport.dernier(Horloge.serveur());
    return rdv && RappelExport.exportFait() < rdv.valueOf() - HEURES_EXPORT_AVANT_RDV * 3600000
      ? rdv.valueOf()
      : 0;
  }
  /**
   * Export des chasses mené au bout : plus de rappel avant le rendez-vous suivant.
   *
   * @static
   * @method noterExport
   */
  static noterExport() {
    try {
      localStorage.setItem(CLE_EXPORT_CHASSES_FAIT, String(Horloge.maintenant()));
    } catch (e) {}
    $("#o_rappelExport").remove();
    $("#o_partageAlliance button[data-quoi='chasse']").removeClass("o_synchroPret");
  }
  /**
   * Bandeau sous le menu (sous celui de la ponte s'il y en a un).
   *
   * @static
   * @method afficher
   */
  static afficher() {
    $("#o_rappelExport").remove();
    // pages où l'on lance ou replace l'armée : un bandeau ajouté après coup
    // déplacerait les boutons sous le doigt
    if (Utils.pageSansAlertePonte(location) || !RappelExport.aRappeler()) return;
    let surMessagerie = /^\/messagerie\.php$/i.test(location.pathname),
      texte = `<strong>Export des chasses à faire</strong> : ${surMessagerie ? "clique sur" : "ouvre la messagerie et clique sur"} « Exporter mes chasses ».`,
      $bandeau = $(`<div id="o_rappelExport" role="status">
        <span class="o_rappelExportSymbole" aria-hidden="true">⏰</span>
        ${
          surMessagerie
            ? `<span class="o_rappelExportTexte">${texte}</span>`
            : `<a class="o_rappelExportTexte" href="/messagerie.php" title="Aller à la messagerie">${texte}</a>`
        }
        <button type="button" class="o_rappelExportFermer" title="Masquer pendant ${MINUTES_MASQUAGE_RAPPEL} min" aria-label="Masquer pendant ${MINUTES_MASQUAGE_RAPPEL} min">×</button>
      </div>`);
    $bandeau.find(".o_rappelExportFermer").on("click", () => {
      try {
        localStorage.setItem(
          CLE_RAPPEL_EXPORT_MASQUE,
          String(Horloge.maintenant() + MINUTES_MASQUAGE_RAPPEL * 60000),
        );
      } catch (e) {}
      $bandeau.remove();
    });
    if ($("#o_alertePonte").length) $bandeau.insertAfter("#o_alertePonte");
    else if ($("#o_attaquesLancees.o_epingle").length) $bandeau.insertAfter("#o_attaquesLancees");
    else if ($("#menu").length) $bandeau.insertAfter("#menu");
    else if ($("#centre").length) $bandeau.prependTo("#centre");
    else $bandeau.prependTo("body");
    RappelExport.caler();
    // la page peut encore bouger (images, polices, largeur de fenêtre)
    $(window)
      .off(".o_rappelExport")
      .on("load.o_rappelExport resize.o_rappelExport", RappelExport.caler);
    if (document.fonts) document.fonts.ready.then(RappelExport.caler);
  }
  /**
   * Juste sous le menu, ou à l'écart habituel sous le bandeau qui le précède.
   *
   * @static
   * @method caler
   */
  static caler() {
    let $bandeau = $("#o_rappelExport");
    if (!$bandeau.length) return;
    if ($bandeau.prev().is("#menu")) Utils.calerSousMenu($bandeau[0]);
    else $bandeau.css("margin-top", ECART_SOUS_MENU + "px");
  }
}
