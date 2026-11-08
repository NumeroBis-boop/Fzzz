// @ts-check
/*
 * Boite.js
 * Hraesvelg
 **********************************************************************/

// écart entre une boîte et les bords de la fenêtre
const MARGE_BOITE = 8;
// bords de la boîte : poignées pour la déplacer, comme son titre
const BORDS_BOITE = ["Haut", "Bas", "Gauche", "Droite"]
  .map((b) => `<div class='o_bord o_bord${b}'></div>`)
  .join("");
// une seule écoute du redimensionnement de la fenêtre pour toutes les boîtes
let boitesSuiventFenetre = false;

/**
 * Classe abstraite pour la creation de boite. Une boîte reste dans la
 * fenêtre : un contenu plus haut qu'elle défile à l'intérieur (.o_corps), et
 * elle se déplace par son titre ou par ses bords.
 *
 * @class Boite
 * @constructor
 */
class Boite {
  constructor(idBoite, titre, content = "") {
    /**
     * id de la boite.
     *
     * @private
     * @property titre
     * @type string
     */
    this._id = idBoite;
    /**
     * titre de la boite.
     *
     * @private
     * @property titre
     * @type string
     */
    this._titre = titre;
    /**
     * Contenue html de la boite.
     *
     * @private
     * @property content
     * @type string
     */
    this._content = content;
  }
  /**
   * Supprime la boite.
   *
   * @private
   * @method desctructor
   */
  destructor() {
    $("#" + this._id).remove();
  }
  /**
   * Affiche la boite.
   *
   * @private
   * @method afficher
   */
  afficher() {
    let bCreate = false;
    if (!$("#" + this._id).length) {
      $("body").append(
        `<div id='${this._id}' class='o_content'>${BORDS_BOITE}<span class='o_titre'>${this._titre}</span><div id="${this._id}Close" class='o_close'><b/><b/><b/><b/></div><div class='o_corps'>${this._content}</div></div>`,
      );
      let $boite = $("#" + this._id)
        .css({ top: Math.random() * 100 + 50 + "px", left: Math.random() * 250 + 100 + "px" })
        .draggable({
          handle: ".o_titre, .o_bord",
          stack: "div",
          containment: "window",
          stop: () => Boite.ajuster($boite),
        });
      // contenu qui grandit (résultats, onglet plus haut) : la boîte reste dans la fenêtre
      if (typeof ResizeObserver == "function")
        new ResizeObserver(() => Boite.ajuster($boite)).observe($boite[0]);
      Boite.suivreFenetre();
      bCreate = true;
    }
    $("#" + this._id).show(0, () => {
      $(".o_content").css({
        "background-color": monProfil.parametre["couleur1"].valeur,
        "border-color": monProfil.parametre["couleur3"].valeur,
      });
      Boite.ajuster($("#" + this._id));
    });
    return bCreate;
  }
  /**
   * Garde une boîte visible dans la fenêtre : son contenu (.o_corps) ne dépasse
   * pas la hauteur de l'écran et défile à l'intérieur ; la boîte est replacée
   * pour que son titre et ses bords restent à l'écran.
   *
   * @static
   * @method ajuster
   * @param {any} $boite
   */
  static ajuster($boite) {
    if (!$boite.length || !$boite.is(":visible")) return;
    let $corps = $boite.children(".o_corps"),
      // titre, bords et marges intérieures de la boîte
      entourage = ($boite.outerHeight() || 0) - ($corps.outerHeight() || 0),
      r = $boite[0].getBoundingClientRect(),
      // horloge de l'extension, fixe en haut et au-dessus des boîtes : leur
      // titre reste sous elle (sur téléphone, les boîtes prennent la largeur)
      horloge = document.getElementById("o_horloge"),
      // position fixe : offsetParent est toujours nul, la taille dit si elle est affichée
      h = horloge ? horloge.getBoundingClientRect() : null,
      haut0 =
        h &&
        h.height > 0 &&
        h.bottom < window.innerHeight / 3 &&
        h.right > r.left &&
        h.left < r.right
          ? Math.max(MARGE_BOITE, h.bottom + MARGE_BOITE)
          : MARGE_BOITE,
      hauteurMax = Math.max(120, window.innerHeight - haut0 - MARGE_BOITE - entourage) + "px";
    if ($corps[0] && $corps[0].style.maxHeight != hauteurMax) $corps.css("max-height", hauteurMax);
    r = $boite[0].getBoundingClientRect();
    let dans = (
        /** @type {Number} */ v,
        /** @type {Number} */ taille,
        /** @type {Number} */ min,
        /** @type {Number} */ max,
      ) => Math.min(Math.max(v, min), Math.max(min, max - taille - MARGE_BOITE)),
      haut = dans(r.top, r.height, haut0, window.innerHeight),
      gauche = dans(r.left, r.width, MARGE_BOITE, window.innerWidth);
    if (Math.abs(haut - r.top) > 0.5) $boite.css("top", haut + "px");
    if (Math.abs(gauche - r.left) > 0.5) $boite.css("left", gauche + "px");
  }
  /**
   * Fenêtre redimensionnée (téléphone tourné, fenêtre réduite) : les boîtes
   * ouvertes restent dedans. Une seule écoute pour toutes les boîtes.
   *
   * @static
   * @method suivreFenetre
   */
  static suivreFenetre() {
    if (boitesSuiventFenetre) return;
    boitesSuiventFenetre = true;
    $(window).on("resize", () => $(".o_content:visible").each((i, e) => Boite.ajuster($(e))));
  }
  /**
   * Cache la boite.
   *
   * @private
   * @method masquer
   */
  masquer() {
    $("#" + this._id).hide();
    return this;
  }
  /**
   * Applique le style propre à la boite.
   *
   * @private
   * @method css
   */
  css() {
    $(".o_titre").css("color", monProfil.parametre["couleurTitre"].valeur);
    $(".o_content").css({
      "background-color": monProfil.parametre["couleur1"].valeur,
      "border-color": monProfil.parametre["couleur3"].valeur,
    });
    $(".o_close b:nth-child(1)").css("border-top-color", monProfil.parametre["couleur1"].valeur);
    $(".o_close b:nth-child(2)").css("border-left-color", monProfil.parametre["couleur1"].valeur);
    $(".o_close b:nth-child(3)").css("border-bottom-color", monProfil.parametre["couleur1"].valeur);
    $(".o_close b:nth-child(4)").css("border-right-color", monProfil.parametre["couleur1"].valeur);
    let $fermer = $(".o_close")
      .css("background-color", monProfil.parametre["couleur2"].valeur)
      // css() est rappelé à chaque ouverture : sans off(), les survols s'empilaient
      .off("mouseenter mouseleave");
    // sur écran tactile, Safari iOS prend le premier toucher d'un élément qui
    // change au survol pour un survol, sans clic : la croix ne fermait rien
    if (window.matchMedia("(hover: hover)").matches)
      $fermer.hover(
        (e) => {
          $(e.currentTarget).animate({ "background-color": "#bb3333" }, 400);
        },
        (e) => {
          $(e.currentTarget).animate(
            { "background-color": monProfil.parametre["couleur2"].valeur },
            400,
          );
        },
      );
    $(".o_tabs > .ui-widget-header").css(
      "border-bottom-color",
      monProfil.parametre["couleur2"].valeur,
    );
    $(".o_content p, .o_content .o_label, .o_content label, .o_content table").css(
      "color",
      monProfil.parametre["couleurTexte"].valeur,
    );
    return this;
  }
  /**
   * Couleurs des onglets des boîtes (Chasse, Combat, Paramètres) et survol des
   * liens d'onglet en couleur de texte à demi transparente.
   *
   * @method cssOnglets
   */
  cssOnglets() {
    let texte = monProfil.parametre["couleurTexte"].valeur,
      m = String(texte).match(/#([\da-f]{2})([\da-f]{2})([\da-f]{2})/i),
      // couleur saisie autrement qu'en #rrggbb : pas de survol coloré
      survol = m
        ? "rgba(" + [...m.slice(1).map((h) => parseInt(h, 16)), 0.5].join(",") + ")"
        : "inherit";
    $(".o_tabs .ui-widget-header .ui-tabs-anchor").css(
      "background-color",
      monProfil.parametre["couleur2"].valeur,
    );
    $(".o_content a").unbind("mouseenter mouseleave").css("color", texte);
    $(".o_content li:not(.ui-state-active) a").css("color", "inherit");
    $(".o_content li:not(.ui-state-active):not(.ui-state-disabled) a").hover(
      (e) => $(e.currentTarget).css("color", survol),
      (e) => $(e.currentTarget).css("color", "inherit"),
    );
    $(".o_content .ui-state-disabled a").css({ cursor: "not-allowed", "pointer-events": "all" });
    return this;
  }
  /**
   * Ajoute les evenements propres à la boite.
   *
   * @private
   * @method event
   */
  event() {
    $("#" + this._id + "Close").click((e) => {
      this.masquer();
    });
    return this;
  }
}
