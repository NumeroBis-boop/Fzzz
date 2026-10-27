/**
 * Classe pour la gestion des différents outils globals à fourmizzz.
 *
 * @class Outil
 * @constructor
 * @extends Boite
 */
class Dock {
  constructor() {
    /**
     *
     */
    // encadré « Extension OUAF », même style que l'encadré Compte+ du jeu
    this._html = `<div id="o_boiteExtension" class="boite_compte_plus">
            <div class="titre_colonne_cliquable"><span class="titre_compte_plus">Extension OUAF</span></div>
            <div class="contenu_boite_compte_plus"><div id="o_toolbarOutiiil">
            <div id="o_toolbarItem2" class="o_toolbarItem" title="Chasse"><span id="o_itemChasse" style="background-image: url(${IMG_SPRITE_MENU})"/></div>
            <div id="o_toolbarItem3" class="o_toolbarItem" title="Combat"><span id="o_itemCombat" style="background-image: url(${IMG_SPRITE_MENU})"/></div>
            <div id="o_toolbarItem6" class="o_toolbarItem" title="Préférence"><span id="o_itemParametre" style="background-image: url(${IMG_SPRITE_MENU})"/></div>
            </div></div></div>`;
    /**
     *
     */
    this._boiteChasse = new BoiteChasse();
    /**
     *
     */
    this._boiteCombat = new BoiteCombat();
    /**
     *
     */
    this._boiteParametre = new BoiteParametre();
  }
  /**
   * Affiche la boite.
   *
   * @private
   * @method afficher
   */
  afficher() {
    // Fzzz : encadré à part, juste sous l'encadré Compte+ (celui du jeu, ou
    // celui que Fzzz recrée hors C+). Le jeu place ses encadrés en position
    // absolue : le nôtre est alors placé de même, recalé quand l'encadré
    // Compte+ change de taille. Plus de bandeau fixe sur le bord droit.
    let $cplus = $("#boiteComptePlus").length ? $("#boiteComptePlus") : $("#boiteInfo"),
      $boite = $(this._html);
    if ($cplus.length) {
      $boite.insertAfter($cplus);
      Dock.caler($cplus[0], $boite[0]);
      if (window.ResizeObserver)
        new ResizeObserver(() => Dock.caler($cplus[0], $boite[0])).observe($cplus[0]);
      $(window).on("load resize", () => Dock.caler($cplus[0], $boite[0]));
    } else $boite.addClass("o_toolbarFlottante").appendTo("body");
    $("#o_toolbarOutiiil .o_toolbarItem").tooltip({
      tooltipClass: "warning-tooltip",
      content: function () {
        return $(this).prop("title");
      },
      position: { my: "center top", at: "center bottom+10" },
      hide: { effect: "fade", duration: 10 },
    });
    // evenement sur le clic d'un item de la boite d'outil
    $(".o_toolbarItem").click((e) => {
      // affichage de la boite
      switch ($(e.currentTarget).find("span").attr("id")) {
        case "o_itemChasse":
          this._boiteChasse.afficher();
          break;
        case "o_itemCombat":
          this._boiteCombat.afficher();
          break;
        case "o_itemParametre":
          this._boiteParametre.afficher();
          break;
        default:
          break;
      }
    });
  }
  /**
   * Encadré en position absolue comme celui du jeu : même colonne, juste
   * en dessous. En flux normal, rien à faire.
   *
   * @static
   * @method caler
   * @param {HTMLElement} cplus encadré Compte+
   * @param {HTMLElement} boite encadré « Extension OUAF »
   */
  static caler(cplus, boite) {
    let position = getComputedStyle(cplus).position;
    if (position != "absolute" && position != "fixed") {
      boite.style.position = "";
      return;
    }
    Object.assign(boite.style, {
      position: position,
      marginTop: "0",
      left: cplus.offsetLeft + "px",
      top: cplus.offsetTop + cplus.offsetHeight + 8 + "px",
      width: cplus.offsetWidth + "px",
    });
  }
}
