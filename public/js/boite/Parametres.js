/*
 * BoiteParametre.js
 * Hraesvelg
 **********************************************************************/

/**
 * Onglets des préférences : un par page du jeu que l'extension modifie (la
 * page Construction n'affiche que la rentabilité de l'étable, réglée avec le
 * Laboratoire). `affichages` : clés de AFFICHAGES_FZZZ / AFFICHAGES_CONVOIS ;
 * un affichage présent sur deux pages figure dans les deux onglets.
 */
const ONGLETS_PARAMETRE = [
  { id: "General", titre: "Général", affichages: ["horloge"] },
  { id: "Ressources", titre: "Ressources", affichages: ["syntheseChasses", "lanceurChasse"] },
  { id: "Armee", titre: "Armée", affichages: ["floodsRecus", "listeAttaques"] },
  { id: "Attaque", titre: "Attaque", affichages: ["trajet", "listeAttaques"] },
  { id: "Laboratoire", titre: "Laboratoire", affichages: ["rentabilite"] },
  {
    id: "Messagerie",
    titre: "Messagerie",
    affichages: ["messagerieCouleurs", "messagerieCopie", "messagerieAnalyse"],
  },
  { id: "Convois", titre: "Convois", affichages: Object.keys(AFFICHAGES_CONVOIS) },
  { id: "Membre", titre: "Page membre", affichages: ["profilPartages"] },
  { id: "Apropos", titre: "À propos", affichages: [] },
];

/**
 * Classe permettant de choisir ses préférences.
 *
 * @class BoiteParametre
 * @constructor
 * @extends Boite
 */
class BoiteParametre extends Boite {
  constructor() {
    super(
      "o_boiteParametre",
      "Paramètres",
      `<div id='o_tabsParametre' class='o_tabs'><ul>${ONGLETS_PARAMETRE.map((o) => `<li><a href='#o_tabsParametre${o.id}'>${o.titre}</a></li>`).join("")}</ul>${ONGLETS_PARAMETRE.map((o) => `<div id='o_tabsParametre${o.id}'/>`).join("")}</div>`,
    );
    this._paramStyle = ["couleurTitre", "couleur1", "couleur2", "couleur3", "couleurTexte"];
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
      "alertePonte",
    ];
  }
  /**
   * Affiche la boite.
   *
   * @method afficher
   */
  afficher() {
    if (super.afficher()) {
      $("#o_tabsParametre")
        .tabs({ activate: () => this.css().ajusterTaille() })
        .removeClass("ui-widget");
      this.ongletGeneral()
        .ongletRessources()
        .ongletArmee()
        .ongletAttaque()
        .ongletLaboratoire()
        .ongletMessagerie()
        .ongletConvois()
        .ongletMembre()
        .apropos()
        .css()
        .event();
      $(window).on("resize.o_boiteParametre", () => this.ajusterTaille());
    }
    // après l'effet d'ouverture : la taille n'est mesurable qu'une fois affichée
    $("#o_boiteParametre")
      .promise()
      .done(() => this.ajusterTaille());
  }
  /**
   * La boîte tient dans la fenêtre : seul le contenu de l'onglet défile, le
   * titre et la croix restent visibles.
   *
   * @method ajusterTaille
   */
  ajusterTaille() {
    let $boite = $("#o_boiteParametre"),
      $panneau = $boite.find(".ui-tabs-panel:visible");
    if (!$boite.is(":visible") || !$panneau.length) return this;
    const MARGE = 8;
    $panneau.css("max-height", "");
    let horsPanneau = $boite.outerHeight() - $panneau.outerHeight();
    $panneau.css({
      "max-height": Math.max(120, window.innerHeight - 2 * MARGE - horsPanneau) + "px",
      "overflow-y": "auto",
    });
    let r = $boite[0].getBoundingClientRect();
    if (r.top < MARGE || r.bottom > window.innerHeight - MARGE)
      $boite.css("top", Math.max(MARGE, window.innerHeight - MARGE - r.height) + "px");
    return this;
  }
  /**
   * Applique le style propre à la boite.
   *
   * @method css
   */
  css() {
    super.css();
    this.cssOnglets();
    return this;
  }
  /**
   * Ajoute les evenements propres à la boite.
   *
   * @method event
   */
  event() {
    super.event();
    for (let param of this._paramStyle) monProfil.parametre[param].ajouterEvent();
    for (let param of this._paramGeneral) monProfil.parametre[param].ajouterEvent();
    // le curseur de ratio n'a de sens qu'en mode Ratio
    $("#affectationRessource")
      .on("change", (e) => {
        $("#ratioRecolteGroupe").toggle(e.currentTarget.value == "3");
      })
      .trigger("change");
    // « Suivre antisondes » : la réserve vaut antisondes terrain + dôme
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
    // un affichage présent dans deux onglets : les deux cases suivent
    $("#o_tabsParametre input[data-affichage]").on("change", (e) => {
      let cle = e.currentTarget.dataset.affichage,
        coche = e.currentTarget.checked;
      try {
        localStorage.setItem("fzzz_affichage_" + cle, coche ? "1" : "0");
      } catch (err) {}
      $(`#o_tabsParametre input[data-affichage='${cle}']`).prop("checked", coche);
    });
    // Réinitialiser (À propos) : la page rechargée reconstruit monProfil par défaut
    $("#o_resetParametres").click(() => {
      if (confirm("Réinitialiser tous les paramètres aux valeurs par défaut ?")) {
        localStorage.removeItem("outiiil_parametre");
        location.reload();
      }
    });
    return this;
  }
  /**
   * Cases des affichages d'un onglet, cochées par défaut.
   *
   * @method cases
   * @param {String} id identifiant de l'onglet (ONGLETS_PARAMETRE)
   */
  cases(id) {
    let onglet = ONGLETS_PARAMETRE.find((o) => o.id == id),
      libelles = { ...AFFICHAGES_FZZZ, ...AFFICHAGES_CONVOIS };
    if (!onglet.affichages.length) return "";
    return `<p class='o_titreParam'>Affichages <span class='o_aideParam'>(décocher pour masquer, au prochain chargement de la page)</span></p>
      ${onglet.affichages
        .map(
          (cle) =>
            `<label class='o_affichageFzzz'><input type='checkbox' data-affichage='${cle}' ${Utils.affichage(cle) ? "checked" : ""}/> ${libelles[cle]}</label>`,
        )
        .join("")}`;
  }
  /**
   * Toutes les pages : horloge, alerte de ponte, couleurs des boîtes.
   *
   * @method ongletGeneral
   */
  ongletGeneral() {
    let p = monProfil.parametre;
    $("#o_tabsParametreGeneral").append(`<form>
        ${this.cases("General")}
        <p class='o_titreParam'>Ponte</p>
        ${p["alertePonte"].getForm("Alerte si la ponte finit dans moins de")}
        <p class='o_titreParam'>Couleurs des boîtes</p>
        <div class='o_grilleParam'>${["couleurTitre", "couleur1", "couleur2", "couleur3", "couleurTexte"].map((c) => p[c].getForm()).join("")}</div>
      </form>`);
    return this;
  }
  /**
   * L'affectation automatique vit dans PageRessource.affectation(), pour tous
   * les comptes : en C+ le jeu propose Matériaux / Nourriture, le mode Ratio
   * reste un apport de l'extension.
   *
   * @method ongletRessources
   */
  ongletRessources() {
    let p = monProfil.parametre;
    $("#o_tabsParametreRessources").append(`<form>
        ${this.cases("Ressources")}
        <p class='o_titreParam'>Ouvrières <span class='o_aideParam'>(répartition préparée à l'ouverture de la page, à valider dans le formulaire du jeu${Utils.comptePlus ? " ; le mode Ratio coupe l'affectation automatique du C+" : ""})</span></p>
        ${p["affectationRessource"].getForm("Affectation")}
        ${p["ratioRecolte"].getForm()}
      </form>`);
    return this;
  }
  /**
   * @method ongletArmee
   */
  ongletArmee() {
    let p = monProfil.parametre;
    $("#o_tabsParametreArmee").append(`<form>
        ${this.cases("Armee")}
        <p class='o_titreParam'>Antisondes <span class='o_aideParam'>(nombre tiré entre 90 % du max et le max)</span></p>
        <div class='o_grilleParam'>${p["uniteAntisondeTerrain"].getForm("Max en terrain")}${p["uniteAntisondeDome"].getForm("Max en dôme")}</div>
        ${p["replacerArmeeAuto"].getForm("Signaler une armée à replacer à l'ouverture de la page Armée")}
      </form>`);
    return this;
  }
  /**
   * @method ongletAttaque
   */
  ongletAttaque() {
    let p = monProfil.parametre;
    $("#o_tabsParametreAttaque").append(`<form>
        ${this.cases("Attaque")}
        <p class='o_titreParam'>Flood et sonde</p>
        ${p["methodeFlood"].getForm("Méthode de flood par défaut")}
        ${p["uniteSonde"].getForm("Unités envoyées en sonde")}
        ${p["reserveFlood"].getForm(
          "Unités gardées au flood (réserve)",
          `<label class='o_aideParam'><input id='reserveFloodAuto' type='checkbox' ${p["reserveFloodAuto"].valeur ? "checked" : ""}/> = antisondes terrain + dôme</label>`,
        )}
      </form>`);
    return this;
  }
  /**
   * @method ongletLaboratoire
   */
  ongletLaboratoire() {
    $("#o_tabsParametreLaboratoire").append(`<form>${this.cases("Laboratoire")}</form>`);
    return this;
  }
  /**
   * @method ongletMessagerie
   */
  ongletMessagerie() {
    let couleurs = Object.entries(COULEURS_MESSAGES)
      .map(([type, c]) => {
        let couleur = Utils.couleurMessage(type);
        return `<div class='o_couleurMessage'><input type='color' data-couleur='${type}' value='${couleur || c.defaut}'/>
          <label class='o_affichageFzzz'><input type='checkbox' data-couleur-active='${type}' ${couleur ? "checked" : ""}/> ${c.libelle}</label></div>`;
      })
      .join("");
    let $onglet = $("#o_tabsParametreMessagerie").append(`<form>
        ${this.cases("Messagerie")}
        <p class='o_titreParam'>Couleurs des titres <span class='o_aideParam'>(case décochée : couleur du jeu)</span>
          <button type='button' id='o_couleursMessagesDefaut' class='o_button'>Par défaut</button></p>
        <div class='o_grilleParam'>${couleurs}</div>
      </form>`);
    let enregistrer = (type) => {
      let active = $onglet.find(`input[data-couleur-active='${type}']`).prop("checked"),
        couleur = $onglet.find(`input[data-couleur='${type}']`).val();
      try {
        localStorage.setItem("fzzz_couleurMessage_" + type, active ? couleur : "");
      } catch (err) {}
    };
    $onglet.find("input[data-couleur]").on("change", (e) => {
      let type = e.currentTarget.dataset.couleur;
      $onglet.find(`input[data-couleur-active='${type}']`).prop("checked", true);
      enregistrer(type);
    });
    $onglet
      .find("input[data-couleur-active]")
      .on("change", (e) => enregistrer(e.currentTarget.dataset.couleurActive));
    $("#o_couleursMessagesDefaut").on("click", () => {
      for (let type in COULEURS_MESSAGES) {
        try {
          localStorage.removeItem("fzzz_couleurMessage_" + type);
        } catch (err) {}
        $onglet.find(`input[data-couleur='${type}']`).val(COULEURS_MESSAGES[type].defaut);
        $onglet.find(`input[data-couleur-active='${type}']`).prop("checked", true);
      }
    });
    return this;
  }
  /**
   * Affichages de la page Convois, et mot de passe du site de suivi des convois
   * de la OUAF (seul endroit où il se renseigne). Il est gardé dans le stockage
   * de l'extension, que le jeu ne peut pas lire, et n'est placé dans le champ
   * que si le joueur clique « Afficher ».
   *
   * @method ongletConvois
   */
  ongletConvois() {
    $("#o_tabsParametreConvois").append(`<form autocomplete='off'>
            ${this.cases("Convois")}
            <p class='o_titreParam'>Suivi des convois de la OUAF</p>
            <p class='left small'>Site : <a href='${OUAF_SITE}' target='_blank' rel='noopener'>${OUAF_SITE.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a></p>
            <p class='left small'><label for='o_ouafCode'>Mot de passe du site de suivi :</label>
              <input type='password' id='o_ouafCode' autocomplete='new-password' spellcheck='false' style='width:12em'/>
              <button type='button' id='o_ouafCodeVoir' class='o_button' title='Afficher le mot de passe enregistré'>👁 Afficher</button>
              <button type='button' id='o_ouafCodeEnregistrer' class='o_button f_success'>Enregistrer</button>
              <button type='button' id='o_ouafCodeEffacer' class='o_button f_error'>Effacer</button></p>
            <p id='o_ouafCodeEtat' class='left small'></p>
            <p class='left small'><em>Le mot de passe reste dans ton navigateur, dans l'espace privé de l'extension. Il ne sera envoyé qu'au site de suivi, quand tu cliqueras sur « 📤 Envoyer au suivi » à côté d'un convoi.</em></p>
            <p class='left small red'><em>Attention : le site de suivi n'est pas chiffré (http, pas de https). Ton mot de passe et le détail des convois envoyés y circulent en clair sur le réseau. Risque connu et accepté.</em></p>
        </form>`);
    let etat = (code) =>
        $("#o_ouafCodeEtat").html(
          code
            ? "<span class='green'>Mot de passe enregistré.</span>"
            : "<span class='red'>Aucun mot de passe enregistré : à renseigner pour envoyer tes convois au suivi.</span>",
        ),
      masquer = () => {
        $("#o_ouafCode").attr("type", "password").val("");
        $("#o_ouafCodeVoir")
          .text("👁 Afficher")
          .attr("title", "Afficher le mot de passe enregistré");
      };
    OuafSuivi.lireCode().then(etat);
    $("#o_ouafCodeEnregistrer").on("click", () => {
      let code = String($("#o_ouafCode").val() || "").trim();
      if (!code) return;
      OuafSuivi.enregistrerCode(code).then(() => {
        masquer();
        $("#o_ouafCode").removeClass("o_champSignale");
        etat(code);
      });
    });
    $("#o_ouafCodeEffacer").on("click", () =>
      OuafSuivi.enregistrerCode("").then(() => {
        masquer();
        etat("");
      }),
    );
    $("#o_ouafCodeVoir").on("click", () => {
      if ($("#o_ouafCode").attr("type") == "text") return masquer();
      OuafSuivi.lireCode().then((code) => {
        if (!code) return etat("");
        $("#o_ouafCode").attr("type", "text").val(code);
        $("#o_ouafCodeVoir").text("🙈 Masquer").attr("title", "Masquer le mot de passe");
      });
    });
    return this;
  }
  /**
   * @method ongletMembre
   */
  ongletMembre() {
    $("#o_tabsParametreMembre").append(`<form>${this.cases("Membre")}</form>`);
    return this;
  }
  /**
   *
   */
  apropos() {
    const repo = "https://github.com/NumeroBis-boop/fzzz";
    $("#o_tabsParametreApropos").append(`
      <p class='o_titreParam'>${NOM_EXTENSION} v${VERSION}</p>
      <p class='left reduce'>Extension open source pour Fourmizzz.fr.</p>
      <p class='left'><button type='button' id='o_majFzzz' class='o_button f_success'>Mettre à jour l'extension</button></p>
      <p id='o_majFzzzEtat' class='left small'></p>
      <ul class='left reduce'>
        <li><a href='https://github.com/GuiEpi/toolzzz/wiki' target='_blank' rel='noopener'>Wiki (Toolzzz)</a></li>
        <li><a href='${repo}' target='_blank' rel='noopener'>Code source (GitHub)</a></li>
        <li><a href='${repo}/issues/new?template=bug_report.yml' target='_blank' rel='noopener'>Signaler un bug</a></li>
        <li><a href='${repo}/issues/new?template=feature_request.yml' target='_blank' rel='noopener'>Proposer une fonctionnalité</a></li>
      </ul>
      <p class='left reduce'>Fork de <a href='https://github.com/GuiEpi/toolzzz' target='_blank' rel='noopener'>Toolzzz</a> (GuiEpi), lui-même fork d'<a href='https://github.com/Hraesvelg/Outiiil' target='_blank' rel='noopener'>Outiiil</a> (Hraesvelg), sous licence <a href='${repo}/blob/main/LICENSE' target='_blank' rel='noopener'>GPL-3.0</a>.</p>
      <hr class='o_marginT15' style='border:0; border-top:1px dashed currentColor; opacity:0.35;'/>
      <p class='o_titreParam'>Réinitialiser les paramètres</p>
      <p class='left small'><em>Remet toutes les options (couleurs, dock, flood, antisondes, signalement de l'armée à replacer, etc.) aux valeurs par défaut. La page sera rechargée.</em></p>
      <button id='o_resetParametres' class='o_button f_error'>Réinitialiser</button>
    `);
    $("#o_majFzzz").on("click", (e) => {
      e.preventDefault();
      BoiteParametre.mettreAJour($(e.currentTarget), $("#o_majFzzzEtat"));
    });
    return this;
  }
  /**
   * Fzzz : bouton « Mettre à jour Fzzz ». Chrome (installé depuis le Chrome Web
   * Store) : vérification immédiate et installation, puis rechargement de la
   * page. Firefox : ouverture du dernier .xpi signé, que Firefox propose
   * d'installer (la vérification automatique quotidienne reste active).
   *
   * @static
   * @method mettreAJour
   */
  static mettreAJour($bouton, $etat) {
    const xpi = "https://github.com/NumeroBis-boop/Fzzz/releases/latest/download/fzzz.xpi",
      releases = "https://github.com/NumeroBis-boop/Fzzz/releases/latest";
    $bouton.prop("disabled", true);
    $etat.text("Recherche d'une mise à jour…");
    chrome.runtime
      .sendMessage({ type: "fzzz_majVerifier" })
      .then((r) => {
        r = r || { statut: "erreur" };
        if (r.statut == "update_available") {
          $etat.text(
            `Version ${r.version || "plus récente"} trouvée : installation, puis la page se recharge…`,
          );
          setTimeout(() => location.reload(), 2500);
          return;
        }
        $bouton.prop("disabled", false);
        if (r.statut == "no_update") $etat.text(`${NOM_EXTENSION} est à jour (v${VERSION}).`);
        else if (r.statut == "throttled")
          $etat.text("Trop de vérifications rapprochées : réessaie dans quelques minutes.");
        else if (r.statut == "userscript")
          $etat.text(
            "Version script utilisateur : Tampermonkey ou Violentmonkey vérifie les mises à jour (menu du gestionnaire → « Rechercher des mises à jour »).",
          );
        else if (r.statut == "non_supporte") {
          // Firefox : il propose d'installer le .xpi ouvert (autoriser puis « Ajouter »)
          window.open(xpi, "_blank", "noopener");
          $etat.html(
            "Firefox ouvre la dernière version : accepte l'installation (« Autoriser » puis « Ajouter »). Si rien ne s'ouvre (Firefox Android), la mise à jour se fait seule chaque jour, ou via le menu Modules complémentaires.",
          );
        } else
          $etat.html(
            `Mise à jour automatique impossible pour cette installation (chargée depuis un dossier : il faut l'installer depuis le Chrome Web Store, ou le .xpi signé sur Firefox). Télécharge la dernière version sur <a href='${releases}' target='_blank' rel='noopener'>la page des versions</a>.`,
          );
      })
      .catch(() => {
        $bouton.prop("disabled", false);
        $etat.html(
          `La vérification a échoué. Dernière version : <a href='${releases}' target='_blank' rel='noopener'>page des versions</a>.`,
        );
      });
  }
}
