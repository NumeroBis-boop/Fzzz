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
    // celui que Fzzz recrée hors C+), avec le même écart qu'entre l'encadré
    // « S5 pseudo » et le Compte+. Plus de bandeau fixe sur le bord droit.
    let $cplus = $("#boiteComptePlus").length ? $("#boiteComptePlus") : $("#boiteInfo"),
      $boite = $(this._html);
    if ($cplus.length) {
      $boite.insertAfter($cplus);
      Dock.suivre($cplus[0], $boite[0], () => Dock.ecart($("#boiteInfo")[0], $cplus[0]));
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
   * Écart vertical entre deux encadrés de la colonne (8 px par défaut).
   *
   * @static
   * @method ecart
   * @param {HTMLElement} haut
   * @param {HTMLElement} bas
   * @return {Number}
   */
  static ecart(haut, bas) {
    if (!haut || !bas || haut == bas) return 8;
    let e = bas.getBoundingClientRect().top - haut.getBoundingClientRect().bottom;
    return e >= 0 && e < 80 ? Math.round(e) : 8;
  }
  /**
   * Garde `boite` juste sous `ref`, à `ecart()` px, même colonne, même
   * largeur ; recalé quand `ref` change de taille ou la fenêtre de taille.
   *
   * @static
   * @method suivre
   */
  static suivre(ref, boite, ecart) {
    let caler = () => Dock.caler(ref, boite, ecart());
    caler();
    if (window.ResizeObserver) new ResizeObserver(caler).observe(ref);
    $(window).on("load resize", caler);
    // placements du jeu terminés après le chargement
    setTimeout(caler, 500);
  }
  /**
   * Place `boite` sous `ref`. Le jeu place les encadrés de la colonne de
   * gauche lui-même (colonne fixe, encadrés positionnés) : si l'encadré ne se
   * retrouve pas naturellement sous `ref`, il est positionné par rapport à
   * son conteneur, aux coordonnées mesurées de `ref`.
   *
   * @static
   * @method caler
   * @param {HTMLElement} ref encadré au-dessus
   * @param {HTMLElement} boite encadré à placer
   * @param {Number} ecart px entre les deux
   */
  static caler(ref, boite, ecart = 8) {
    let r = ref.getBoundingClientRect();
    if (!r.width) return;
    Object.assign(boite.style, {
      position: "",
      top: "",
      left: "",
      width: "",
      marginTop: ecart + "px",
    });
    let b = boite.getBoundingClientRect();
    if (Math.abs(b.top - (r.bottom + ecart)) <= 1 && Math.abs(b.left - r.left) <= 1) return;
    // `ref` dans un conteneur fixe qui ne contient pas `boite` : position
    // fixe, aux coordonnées de la fenêtre (les deux restent ensemble au
    // défilement)
    let fixe = null;
    for (let e = ref; e && e != document.body; e = e.parentElement)
      if (getComputedStyle(e).position == "fixed") {
        fixe = e;
        break;
      }
    boite.style.marginTop = "0";
    if (fixe && !fixe.contains(boite)) {
      Object.assign(boite.style, {
        position: "fixed",
        left: r.left + "px",
        top: r.bottom + ecart + "px",
        width: r.width + "px",
      });
      return;
    }
    boite.style.position = "absolute";
    let parent = boite.offsetParent || document.body,
      p = parent.getBoundingClientRect();
    Object.assign(boite.style, {
      left: r.left - p.left - parent.clientLeft + parent.scrollLeft + "px",
      top: r.bottom + ecart - p.top - parent.clientTop + parent.scrollTop + "px",
      width: r.width + "px",
    });
  }
}
