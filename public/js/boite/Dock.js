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
            <div id="o_toolbarItem6" class="o_toolbarItem" title="Préférence"><span id="o_itemParametre" style="background-image: url(${IMG_SPRITE_MENU})"/></div>
            <div id="o_toolbarItem2" class="o_toolbarItem" title="Chasse"><span id="o_itemChasse" style="background-image: url(${IMG_SPRITE_MENU})"/></div>
            <div id="o_toolbarItem3" class="o_toolbarItem" title="Combat"><span id="o_itemCombat" style="background-image: url(${IMG_SPRITE_MENU})"/></div>
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
    let e = Dock.emprise(bas).top - Dock.emprise(haut).bottom;
    return e >= 0 && e < 80 ? Math.round(e) : 8;
  }
  /**
   * Emprise visible d'un encadré du jeu : son cadre est dessiné par ses
   * éléments intérieurs, l'élément lui-même pouvant mesurer 0 px (comme
   * l'encadré « S5 pseudo », voir Horloge.afficher).
   *
   * @static
   * @method emprise
   * @param {HTMLElement} elt
   * @return {{left: Number, top: Number, right: Number, bottom: Number, width: Number, height: Number}}
   */
  static emprise(elt) {
    let g = Infinity,
      h = Infinity,
      d = -Infinity,
      b = -Infinity;
    [elt, ...elt.querySelectorAll("*")].forEach((e) => {
      let r = e.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        g = Math.min(g, r.left);
        h = Math.min(h, r.top);
        d = Math.max(d, r.right);
        b = Math.max(b, r.bottom);
      }
    });
    return g == Infinity
      ? { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }
      : { left: g, top: h, right: d, bottom: b, width: d - g, height: b - h };
  }
  /**
   * Garde `boite` juste sous `ref`, à `ecart()` px, même colonne, même
   * largeur, même apparence. Le jeu place lui-même les encadrés de sa
   * colonne de gauche (et replace ce qu'on y ajoute) : `boite` est donc
   * rattaché à la page, hors de la colonne, et positionné d'après la
   * position mesurée de `ref`, recalculée quand `ref` bouge ou change de
   * taille (aucune requête au jeu, mesures dans la page seulement).
   *
   * @static
   * @method suivre
   */
  static suivre(ref, boite, ecart) {
    Dock.copierStyle(ref, boite);
    document.body.appendChild(boite);
    let attente = null,
      caler = () => {
        cancelAnimationFrame(attente);
        attente = requestAnimationFrame(() => Dock.caler(ref, boite, ecart()));
      };
    caler();
    // le cadre visible est dessiné par les enfants : on les suit aussi
    if (window.ResizeObserver) {
      let o = new ResizeObserver(caler);
      [ref, ...ref.children].forEach((e) => o.observe(e));
    }
    new MutationObserver(caler).observe(ref, {
      attributes: true,
      attributeFilter: ["style", "class"],
    });
    if (ref.parentElement)
      new MutationObserver(caler).observe(ref.parentElement, {
        attributes: true,
        attributeFilter: ["style", "class"],
      });
    $(window).on("load resize scroll", caler);
    // placements du jeu terminés après le chargement
    [300, 1000, 3000].forEach((ms) => setTimeout(caler, ms));
  }
  /**
   * Même apparence que l'encadré de référence (fond, bordure, ombre, titre),
   * le style du jeu pouvant dépendre de la colonne qu'on quitte.
   *
   * @static
   * @method copierStyle
   */
  static copierStyle(ref, boite) {
    let copier = (de, vers, proprietes) => {
      if (!de || !vers) return;
      let c = getComputedStyle(de);
      proprietes.forEach((p) => (vers.style[p] = c[p]));
    };
    copier(ref, boite, [
      "backgroundColor",
      "backgroundImage",
      "backgroundSize",
      "backgroundRepeat",
      "borderTop",
      "borderRight",
      "borderBottom",
      "borderLeft",
      "borderRadius",
      "boxShadow",
      "color",
      "fontFamily",
      "fontSize",
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",
    ]);
    // largeur totale identique à celle de `ref` (bordure et marges comprises)
    boite.style.boxSizing = "border-box";
    let titre = (e) => e.querySelector(".titre_colonne_cliquable"),
      libelle = (e) => e.querySelector(".titre_compte_plus, .titre_colonne_cliquable > *");
    copier(titre(ref), titre(boite), [
      "backgroundColor",
      "backgroundImage",
      "backgroundSize",
      "backgroundRepeat",
      "borderBottom",
      "borderRadius",
      "height",
      "lineHeight",
      "paddingTop",
      "paddingBottom",
      "textAlign",
      "marginBottom",
    ]);
    let contenu = (e) => e.querySelector(".contenu_boite_compte_plus");
    copier(contenu(ref), contenu(boite), [
      "backgroundColor",
      "backgroundImage",
      "backgroundSize",
      "backgroundRepeat",
      "borderTop",
      "borderRight",
      "borderBottom",
      "borderLeft",
      "borderRadius",
      "boxShadow",
      "paddingLeft",
      "paddingRight",
    ]);
    copier(libelle(ref), libelle(boite), [
      "color",
      "fontFamily",
      "fontSize",
      "fontWeight",
      "textShadow",
      "letterSpacing",
    ]);
  }
  /**
   * Place `boite` (rattaché à la page) sous `ref` : position fixe si `ref`
   * est dans un conteneur fixe (colonne qui ne défile pas), sinon absolue
   * aux coordonnées du document. Masqué si `ref` l'est.
   *
   * @static
   * @method caler
   * @param {HTMLElement} ref encadré au-dessus
   * @param {HTMLElement} boite encadré à placer
   * @param {Number} ecart px entre les deux
   */
  static caler(ref, boite, ecart = 8) {
    let r = Dock.emprise(ref);
    if (!r.width || !r.height) {
      boite.style.display = "none";
      return;
    }
    let fixe = false;
    for (let e = ref; e && e != document.documentElement; e = e.parentElement)
      if (getComputedStyle(e).position == "fixed") {
        fixe = true;
        break;
      }
    // au-dessus de la colonne du jeu : z-index le plus haut parmi `ref` et
    // ses conteneurs positionnés, plus un (sinon l'encadré passe derrière
    // le fond de la colonne)
    let z = 0;
    for (let e = ref; e && e != document.documentElement; e = e.parentElement) {
      let n = parseInt(getComputedStyle(e).zIndex);
      if (!isNaN(n)) z = Math.max(z, n);
    }
    let haut = r.bottom + ecart;
    Object.assign(boite.style, {
      display: "",
      position: fixe ? "fixed" : "absolute",
      margin: "0",
      left: r.left + (fixe ? 0 : window.scrollX) + "px",
      top: haut + (fixe ? 0 : window.scrollY) + "px",
      width: r.width + "px",
      zIndex: String(Math.max(z + 1, 100)),
    });
    if (!fixe) return;
    // colonne fixe : l'encadré doit tenir dans la fenêtre (on ne peut pas
    // défiler jusqu'à lui) ; s'il dépasse, il remonte juste ce qu'il faut
    if (haut + boite.offsetHeight > window.innerHeight)
      boite.style.top = Math.max(0, window.innerHeight - boite.offsetHeight - 4) + "px";
  }
}
