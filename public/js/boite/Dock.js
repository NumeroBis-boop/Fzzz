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
    this._html = `<div id="o_toolbarOutiiil">
            <div id="o_toolbarItem2" class="o_toolbarItem" title="Chasse"><span id="o_itemChasse" style="background-image: url(${IMG_SPRITE_MENU})"/></div>
            <div id="o_toolbarItem3" class="o_toolbarItem" title="Combat"><span id="o_itemCombat" style="background-image: url(${IMG_SPRITE_MENU})"/></div>
            <div id="o_toolbarItem6" class="o_toolbarItem" title="Préférence"><span id="o_itemParametre" style="background-image: url(${IMG_SPRITE_MENU})"/></div>
            </div>`;
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
    // Fzzz : rangée d'outils dans la colonne de gauche, sous l'encadré
    // Compte+ (celui du jeu, ou celui que Fzzz recrée hors C+) ; plus de
    // bandeau fixe sur le bord droit, gênant sur mobile
    let $ancre = $("#boiteComptePlus").length ? $("#boiteComptePlus") : $("#boiteInfo");
    if ($ancre.length) $(this._html).insertAfter($ancre);
    else $(this._html).addClass("o_toolbarFlottante").appendTo("body");
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
}
