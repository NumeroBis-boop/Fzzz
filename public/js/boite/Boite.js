// @ts-check
/*
 * Boite.js
 * Hraesvelg
 **********************************************************************/

/**
 * Classe abstraite pour la creation de boite.
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
        `<div id='${this._id}' class='o_content'><span class='o_titre'>${this._titre}</span><div id="${this._id}Close" class='o_close'><b/><b/><b/><b/></div>${this._content}</div>`,
      );
      $("#" + this._id)
        .css({ top: Math.random() * 100 + 50 + "px", left: Math.random() * 250 + 100 + "px" })
        .draggable({ handle: ".o_titre", stack: "div", containment: "window" });
      bCreate = true;
    }
    $("#" + this._id).show(0, () => {
      $(".o_content").css({
        "background-color": monProfil.parametre["couleur1"].valeur,
        "border-color": monProfil.parametre["couleur3"].valeur,
      });
      if (bCreate) {
        // À la 1ʳᵉ apparition, si l'aléatoire de top/left a placé la boîte hors
        // viewport (cas mobile / petit écran), on la replace dans la fenêtre.
        const $box = $("#" + this._id);
        const rect = $box[0].getBoundingClientRect();
        if (rect.right > window.innerWidth) {
          $box.css("left", Math.max(0, window.innerWidth - rect.width - 10) + "px");
        }
        if (rect.bottom > window.innerHeight) {
          $box.css("top", Math.max(0, window.innerHeight - rect.height - 10) + "px");
        }
      }
    });
    return bCreate;
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
