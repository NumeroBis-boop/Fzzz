/*
 * BoiteParametre.js
 * Hraesvelg
 **********************************************************************/

/**
 * Classe permettant de choisir ses préférences.
 *
 * @class BoiteParametre
 * @constructor
 * @extends Boite
 */
class BoiteParametre extends Boite {
  /**
   *
   */
  constructor() {
    super(
      "o_boiteParametre",
      "Paramètres",
      `<div id='o_tabsParametre' class='o_tabs'><ul><li><a href='#o_tabsParametre1'>Général</a></li><li><a href='#o_tabsParametre2'>Utilitaire</a></li><li><a href='#o_tabsParametre3'>Apparence</a></li><li><a href='#o_tabsParametre4'>À propos</a></li></ul><div id='o_tabsParametre1'/><div id='o_tabsParametre2'/><div id='o_tabsParametre3'/><div id='o_tabsParametre4'/></div>`,
    );
    /**
     *
     */
    this._paramStyle = [
      "couleurTitre",
      "couleur1",
      "couleur2",
      "couleur3",
      "couleurTexte",
      "dockPosition",
      "dockVisible",
      "boiteShow",
      "boiteHide",
    ];
    /**
     *
     */
    this._paramUtilitaire = ["forumCommande", "forumMembre"];
    /**
     *
     */
    this._paramGeneral = [
      "affectationRessource",
      "methodeFlood",
      "uniteAntisondeTerrain",
      "uniteAntisondeDome",
      "uniteSonde",
      "reserveFlood",
      "reserveFloodAuto",
      "replacerArmeeAuto",
      "ratioRecolte",
    ];
  }
  /**
   * Affiche la boite.
   *
   * @private
   * @method afficher
   */
  afficher() {
    if (super.afficher()) {
      $("#o_tabsParametre")
        .tabs({
          activate: (e, ui) => {
            this.css();
          },
        })
        .removeClass("ui-widget");
      this.parametreStyle().parametreUtilitaire().parametreGeneral().apropos().css().event();
    }
  }
  /**
   * Applique le style propre à la boite.
   *
   * @private
   * @method css
   */
  css() {
    super.css();
    $(".o_tabs .ui-widget-header .ui-tabs-anchor").css(
      "background-color",
      monProfil.parametre["couleur2"].valeur,
    );
    $(".o_content a")
      .unbind("mouseenter mouseleave")
      .css("color", monProfil.parametre["couleurTexte"].valeur);
    $(".o_content li:not(.ui-state-active) a").css("color", "inherit");
    let matches = monProfil.parametre["couleurTexte"].valeur.match(
      /#([\da-f]{2})([\da-f]{2})([\da-f]{2})/i,
    );
    $(".o_content li:not(.ui-state-active):not(.ui-state-disabled) a").hover(
      (e) => {
        $(e.currentTarget).css(
          "color",
          "rgba(" +
            matches
              .slice(1)
              .map((m) => {
                return parseInt(m, 16);
              })
              .concat("0.5") +
            ")",
        );
      },
      (e) => {
        $(e.currentTarget).css("color", "inherit");
      },
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
    super.event();
    for (let param of this._paramStyle) monProfil.parametre[param].ajouterEvent();
    for (let param of this._paramUtilitaire) monProfil.parametre[param].ajouterEvent();
    for (let param of this._paramGeneral) monProfil.parametre[param].ajouterEvent();
    // le curseur de ratio n'a de sens qu'en mode Ratio
    $("#affectationRessource")
      .on("change", (e) => {
        $("#ratioRecolteGroupe").toggle(e.currentTarget.value == "3");
      })
      .trigger("change");
    $("#dockPosition").on("change", () => Dock.appliquerPosition());
    // Sync de la réserve avec les antisondes quand « Suivre antisondes » est coché.
    // Quand actif : on désactive le spinner et on le force à la somme antisondeTerrain + antisondeDome.
    let syncReserveFlood = () => {
      if ($("#reserveFloodAuto").prop("checked")) {
        let sum =
          monProfil.parametre["uniteAntisondeTerrain"].valeur +
          monProfil.parametre["uniteAntisondeDome"].valeur;
        $("#reserveFlood").spinner("value", sum).spinner("disable");
      } else $("#reserveFlood").spinner("enable");
    };
    syncReserveFlood();
    $("#reserveFloodAuto").on("change", syncReserveFlood);
    $("#uniteAntisondeTerrain, #uniteAntisondeDome").on("spinchange spinstop", syncReserveFlood);
    // Reset complet des paramètres (À propos) — efface le localStorage et recharge la page,
    // ce qui reconstruit monProfil avec les valeurs par défaut.
    $("#o_resetParametres").click(() => {
      if (confirm("Réinitialiser tous les paramètres aux valeurs par défaut ?")) {
        localStorage.removeItem("outiiil_parametre");
        location.reload();
      }
    });
    return this;
  }
  /**
   *
   */
  parametreStyle() {
    let couleurs = ``;
    for (let param of ["couleurTitre", "couleur1", "couleur2", "couleur3", "couleurTexte"])
      couleurs += monProfil.parametre[param].getForm();
    let dock = ``;
    for (let param of ["dockPosition", "dockVisible"]) dock += monProfil.parametre[param].getForm();
    let effets = ``;
    for (let param of ["boiteShow", "boiteHide"]) effets += monProfil.parametre[param].getForm();
    $("#o_tabsParametre3").append(`<form>
            <p class='left reduce gras'>Couleurs des boîtes et du texte</p>
            ${couleurs}
            <p class='left reduce gras'>Position et visibilité de la barre d'outils</p>
            ${dock}
            <p class='left reduce gras'>Effets d'animation à l'ouverture et fermeture des boîtes</p>
            ${effets}
        </form>`);
    return this;
  }
  /**
   *
   */
  parametreUtilitaire() {
    let content = ``;
    for (let param of this._paramUtilitaire) content += monProfil.parametre[param].getForm();
    // max-width sur le bloc texte : sans ça, le long paragraphe pousse la boîte à grandir
    // pendant le drag (la boîte n'a pas de max-width et son layout est recalculé en
    // continu, ce qui déclenche un effet "s'agrandit sans cesse").
    $("#o_tabsParametre2").append(`
      <p class='left reduce gras' style='margin-left:10px;'>Saisissez les identifiants des sujets de votre utilitaire<span class="cliquable2" style="font-size:0.8em; font-weight:normal;" onclick="spoilerId('o_paramUtilitaireInfo');"> En savoir plus ?</span></p>
      <div id='o_paramUtilitaireInfo' class='o_marginT15 left reduce' style='display:none; max-width:500px; word-wrap:break-word; margin-left:auto; margin-right:auto;'>
        <p>Ces deux champs pointent vers les sections cachées du forum d'alliance (<b>Toolzzz_Commande</b> et <b>Toolzzz_Membre</b>, ou les anciens noms <b>Outiiil_Commande</b>/<b>Outiiil_Membre</b> si l'alliance a préparé son forum à l'époque d'Outiiil) qui servent de stockage partagé pour les fonctionnalités d'utilitaire d'alliance : assignations d'attaques, ordres collectifs, et coordonnées des membres (colonnes Tdt / Retour dans la liste des membres).</p>
        <p>Tu n'as <b>pas besoin de les remplir à la main</b> dans la majorité des cas. L'extension les auto-détecte quand tu visites le forum de ton alliance, à condition que les sections existent. C'est le chef d'alliance qui les crée via le bouton <em>Préparer le forum pour un SDC</em> dans le forum.</p>
        <p>Modifie ici <b>uniquement si</b> l'auto-détection a échoué, après un reset des paramètres, ou si ton chef t'a communiqué les IDs directement.</p>
      </div>
      <form>${content}</form>
    `);
    return this;
  }
  /**
   *
   */
  parametreGeneral() {
    // L'affectation auto Toolzzz vit dans PageRessource.affectation(), pour
    // tous les comptes : en C+ le jeu propose nativement Matériaux /
    // Nourriture, le mode Ratio reste un apport de l'extension.
    let blocAffectation = `<p class='left reduce gras'>L'affectation sera automatique lors de la consultation de la page ressource</p>
         <p class='left small'><em>Ratio : les ouvrières suivent la part choisie, même après une chasse ou un flood.${Utils.comptePlus ? " En Compte+, l'activer sur la page Ressources coupe l'affectation automatique du jeu." : ""}</em></p>
         ${monProfil.parametre[this._paramGeneral[0]].getForm()}
         ${monProfil.parametre[this._paramGeneral[8]].getForm()}`;
    $("#o_tabsParametre1").append(`<form>
            ${blocAffectation}
            <p class='left reduce gras'>La méthode sera sélectionnée par défaut dans le lanceur de flood</p>
            ${monProfil.parametre[this._paramGeneral[1]].getForm()}
            <p class='left reduce gras'>Indiquez le nombre d'unité selon l'objectif</p>
            <p class='left small'><em>Le nombre est choisi aléatoirement entre 90% du max et le max.</em></p>
            ${monProfil.parametre[this._paramGeneral[2]].getForm() + monProfil.parametre[this._paramGeneral[3]].getForm() + monProfil.parametre[this._paramGeneral[4]].getForm()}
            <p class='left reduce gras'>Nombre d'unités à conserver lors d'un flood (réserve)</p>
            <p class='left small'><em>Coche « Suivre antisondes » pour synchroniser automatiquement la réserve avec la somme des antisondes (terrain + dôme).</em></p>
            ${monProfil.parametre[this._paramGeneral[5]].getForm() + monProfil.parametre[this._paramGeneral[6]].getForm()}
            <p class='left reduce gras'>Replacer l'armée à l'arrivée sur la page Armée</p>
            ${monProfil.parametre[this._paramGeneral[7]].getForm()}
        </form>`);
    return this;
  }
  /**
   *
   */
  apropos() {
    const repo = "https://github.com/NumeroBis-boop/fzzz";
    $("#o_tabsParametre4").append(`
      <p class='left reduce gras'>Fzzz v${VERSION}</p>
      <p class='left reduce'>Extension open source pour Fourmizzz.fr.</p>
      <ul class='left reduce'>
        <li><a href='https://github.com/GuiEpi/toolzzz/wiki' target='_blank' rel='noopener'>Wiki (Toolzzz)</a></li>
        <li><a href='${repo}' target='_blank' rel='noopener'>Code source (GitHub)</a></li>
        <li><a href='${repo}/issues/new?template=bug_report.yml' target='_blank' rel='noopener'>Signaler un bug</a></li>
        <li><a href='${repo}/issues/new?template=feature_request.yml' target='_blank' rel='noopener'>Proposer une fonctionnalité</a></li>
      </ul>
      <p class='left reduce'>Fork de <a href='https://github.com/GuiEpi/toolzzz' target='_blank' rel='noopener'>Toolzzz</a> (GuiEpi), lui-même fork d'<a href='https://github.com/Hraesvelg/Outiiil' target='_blank' rel='noopener'>Outiiil</a> (Hraesvelg), sous licence <a href='${repo}/blob/main/LICENSE' target='_blank' rel='noopener'>GPL-3.0</a>.</p>
      <hr class='o_marginT15' style='border:0; border-top:1px dashed currentColor; opacity:0.35;'/>
      <p class='left reduce gras'>Réinitialiser les paramètres</p>
      <p class='left small'><em>Remet toutes les options (couleurs, dock, flood, antisondes, replacer auto, etc.) aux valeurs par défaut. La page sera rechargée.</em></p>
      <button id='o_resetParametres' class='o_button f_error'>Réinitialiser</button>
    `);
    return this;
  }
}
