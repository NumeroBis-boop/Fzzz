/*
 * RappelExport.js
 **********************************************************************/

// rendez-vous d'export des chasses (règle du mainteneur) : mercredi et dimanche
// à 22h, heure du serveur ; jours de moment().day()
const RAPPEL_EXPORT_JOURS = [3, 0];
const RAPPEL_EXPORT_HEURE = 22;
// dernier export des chasses mené au bout (ms, horloge du serveur)
const CLE_EXPORT_CHASSES_FAIT = "fzzz_exportChassesFait";
// la croix masque le rappel jusqu'à cette heure (ms)
const CLE_RAPPEL_EXPORT_MASQUE = "fzzz_rappelExportMasque";
const MINUTES_MASQUAGE_RAPPEL = 60;

/**
 * Rappel « Export des chasses à faire » pour le rôle Chasseur : un bandeau
 * sous le menu à partir du mercredi et du dimanche 22h, jusqu'à l'export des
 * chasses (bouton de la messagerie). Aucune requête au jeu : le joueur ouvre
 * la messagerie et clique (règlement du s5 : pas d'export sans son clic).
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
    let role = monProfil.parametre && monProfil.parametre["role"];
    if (!role || parseInt(role.valeur) != ROLE_CHASSEUR) return false;
    if (!Utils.affichage("rappelExport")) return false;
    // sans le bouton « Exporter mes chasses » de la messagerie, rien à rappeler
    if (Utils.origine("Messagerie") || !Utils.affichage("messagerieExport")) return false;
    let lire = (cle) => {
        try {
          return Number(localStorage.getItem(cle)) || 0;
        } catch (e) {
          return 0;
        }
      },
      rdv = RappelExport.dernier(Horloge.serveur());
    return (
      !!rdv &&
      lire(CLE_EXPORT_CHASSES_FAIT) < rdv.valueOf() &&
      lire(CLE_RAPPEL_EXPORT_MASQUE) < Horloge.maintenant()
    );
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
