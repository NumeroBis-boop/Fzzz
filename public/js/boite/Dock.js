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
    this._html = `<div id="o_toolbarOutiiil" ${monProfil.parametre["dockVisible"].valeur == 1 ? "" : "style='display:none'"}>
            <div id="o_toolbarItem1" class="o_toolbarItem" title="Ponte"><span id="o_itemPonte" style="background-image: url(${IMG_SPRITE_MENU})"/></div>
            <div id="o_toolbarItem2" class="o_toolbarItem" title="Chasse"><span id="o_itemChasse" style="background-image: url(${IMG_SPRITE_MENU})"/></div>
            <div id="o_toolbarItem3" class="o_toolbarItem" title="Combat"><span id="o_itemCombat" style="background-image: url(${IMG_SPRITE_MENU})"/></div>
            <div id="o_toolbarItem6" class="o_toolbarItem" title="Préférence"><span id="o_itemParametre" style="background-image: url(${IMG_SPRITE_MENU})"/></div>
            </div>`;
    /**
     *
     */
    this._boitePonte = new BoitePonte();
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
    $("body").append(this._html);
    $("#o_toolbarOutiiil .o_toolbarItem").tooltip({
      tooltipClass: "warning-tooltip",
      content: function () {
        return $(this).prop("title");
      },
      hide: { effect: "fade", duration: 10 },
    });
    Dock.appliquerPosition();
    // En mobile (écran étroit), le côté droit n'a pas la place — on bascule la
    // toolbar en bas même si la pref enregistrée est "à droite". On suit la
    // mediaQuery pour réagir aussi quand on traverse le breakpoint à chaud.
    Dock._mql.addEventListener("change", () => Dock.appliquerPosition());
    // selon la pref on cache l'element
    if (monProfil.parametre["dockVisible"].valeur == "0") {
      $(document).mousemove((e) => {
        if (Dock.estEnBas()) {
          if ($(window).height() - e.pageY < 60) $("#o_toolbarOutiiil").slideDown(500);
          else $("#o_toolbarOutiiil").slideUp(500);
        } else {
          if ($(window).width() - e.pageX < 60)
            $("#o_toolbarOutiiil").show("slide", { direction: "right" }, 500);
          else $("#o_toolbarOutiiil").hide("slide", { direction: "right" }, 500);
        }
      });
    }
    // evenement sur le clic d'un item de la boite d'outil
    $(".o_toolbarItem").click((e) => {
      // affichage de la boite
      switch ($(e.currentTarget).find("span").attr("id")) {
        case "o_itemPonte":
          this._boitePonte.afficher();
          break;
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
   * Applique la position du dock (classe + position des tooltips) selon
   * la préférence "dockPosition". Appelable à chaud quand l'utilisateur
   * change le paramètre depuis la BoiteParametre.
   *
   * @static
   * @method appliquerPosition
   */
  static appliquerPosition() {
    let isBas = Dock.estEnBas();
    let position = isBas
      ? { my: "center top", at: "center bottom+10" }
      : { my: "left+10 center", at: "right center" };
    $("#o_toolbarOutiiil")
      .toggleClass("o_toolbarBas", isBas)
      .toggleClass("o_toolbarDroite", !isBas)
      .find(".o_toolbarItem")
      .each((i, el) => {
        if ($(el).tooltip("instance")) $(el).tooltip("option", "position", position);
      });
  }
  /**
   * Position effective du dock = pref de l'utilisateur, sauf en mobile
   * où on force "bas" car la rangée verticale à droite n'est pas viable
   * sur écran étroit. Ne modifie pas la pref enregistrée.
   *
   * @static
   * @method estEnBas
   */
  static estEnBas() {
    return Dock._mql.matches || monProfil.parametre["dockPosition"].valeur == "1";
  }
}
Dock._mql = window.matchMedia("(max-width: 768px)");
