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
      `<div id='o_tabsParametre' class='o_tabs'><ul><li><a href='#o_tabsParametre1'>Général</a></li><li><a href='#o_tabsParametre3'>Apparence</a></li><li><a href='#o_tabsParametre5'>Affichages</a></li><li><a href='#o_tabsParametre6'>Convoi</a></li><li><a href='#o_tabsParametre4'>À propos</a></li></ul><div id='o_tabsParametre1'/><div id='o_tabsParametre3'/><div id='o_tabsParametre5'/><div id='o_tabsParametre6'/><div id='o_tabsParametre4'/></div>`,
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
      "boiteShow",
      "boiteHide",
    ];
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
      "alertePonte",
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
      this.parametreStyle().parametreGeneral().affichages().convoi().apropos().css().event();
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
    this.cssOnglets();
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
    for (let param of this._paramGeneral) monProfil.parametre[param].ajouterEvent();
    // le curseur de ratio n'a de sens qu'en mode Ratio
    $("#affectationRessource")
      .on("change", (e) => {
        $("#ratioRecolteGroupe").toggle(e.currentTarget.value == "3");
      })
      .trigger("change");
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
    let effets = ``;
    for (let param of ["boiteShow", "boiteHide"]) effets += monProfil.parametre[param].getForm();
    $("#o_tabsParametre3").append(`<form>
            <p class='left reduce gras'>Couleurs des boîtes et du texte</p>
            ${couleurs}
            <p class='left reduce gras'>Effets d'animation à l'ouverture et fermeture des boîtes</p>
            ${effets}
        </form>`);
    return this;
  }
  /**
   *
   */
  parametreGeneral() {
    // L'affectation auto Toolzzz vit dans PageRessource.affectation(), pour
    // tous les comptes : en C+ le jeu propose nativement Matériaux /
    // Nourriture, le mode Ratio reste un apport de l'extension.
    let blocAffectation = `<p class='left reduce gras'>À l'ouverture de la page Ressources, la répartition est préparée dans le formulaire du jeu : clique sur Valider pour l'enregistrer</p>
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
            <p class='left reduce gras'>À l'ouverture de la page Armée, signaler une armée à replacer (bouton mis en évidence, tu cliques)</p>
            ${monProfil.parametre[this._paramGeneral[7]].getForm()}
        </form>`);
    return this;
  }
  /**
   * Fzzz : une case par affichage ajouté par l'extension (AFFICHAGES_FZZZ),
   * toutes cochées par défaut ; pris en compte au prochain chargement de page.
   */
  affichages() {
    let cases = Object.entries(AFFICHAGES_FZZZ)
      .map(
        ([cle, libelle]) =>
          `<label class='o_affichageFzzz'><input type='checkbox' data-affichage='${cle}' ${Utils.affichage(cle) ? "checked" : ""}/> ${libelle}</label>`,
      )
      .join("");
    $("#o_tabsParametre5").append(`<form>
            <p class='left reduce gras'>Affichages ajoutés par Fzzz</p>
            <p class='left small'><em>Décoche ce que tu ne veux pas voir. Pris en compte au prochain chargement de la page.</em></p>
            ${cases}
        </form>`);
    $("#o_tabsParametre5 input[data-affichage]").on("change", (e) => {
      try {
        localStorage.setItem(
          "fzzz_affichage_" + e.currentTarget.dataset.affichage,
          e.currentTarget.checked ? "1" : "0",
        );
      } catch (err) {}
    });
    return this;
  }
  /**
   * Onglet Convoi : affichages de la page Convois, et code de connexion au
   * site de suivi des convois de la OUAF (seul endroit où il se renseigne). Le
   * code est gardé dans le stockage de l'extension (le jeu ne peut pas le
   * lire) ; il n'est placé dans le champ que si le joueur clique « Afficher ».
   *
   * @method convoi
   */
  convoi() {
    let cases = Object.entries(AFFICHAGES_CONVOIS)
      .map(
        ([cle, libelle]) =>
          `<label class='o_affichageFzzz'><input type='checkbox' data-affichage='${cle}' ${Utils.affichage(cle) ? "checked" : ""}/> ${libelle}</label>`,
      )
      .join("");
    $("#o_tabsParametre6").append(`<form autocomplete='off'>
            <p class='left reduce gras'>Affichages de la page Convois</p>
            <p class='left small'><em>Décoche ce que tu ne veux pas voir. Pris en compte au prochain chargement de la page.</em></p>
            ${cases}
            <p class='left reduce gras o_marginT15'>Suivi des convois de la OUAF</p>
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
    $("#o_tabsParametre6 input[data-affichage]").on("change", (e) => {
      try {
        localStorage.setItem(
          "fzzz_affichage_" + e.currentTarget.dataset.affichage,
          e.currentTarget.checked ? "1" : "0",
        );
      } catch (err) {}
    });
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
    // consulter le mot de passe enregistré, même masqué
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
   *
   */
  apropos() {
    const repo = "https://github.com/NumeroBis-boop/fzzz";
    $("#o_tabsParametre4").append(`
      <p class='left reduce gras'>Fzzz v${VERSION}</p>
      <p class='left reduce'>Extension open source pour Fourmizzz.fr.</p>
      <p class='left'><button type='button' id='o_majFzzz' class='o_button f_success'>Mettre à jour Fzzz</button></p>
      <p id='o_majFzzzEtat' class='left small'></p>
      <ul class='left reduce'>
        <li><a href='https://github.com/GuiEpi/toolzzz/wiki' target='_blank' rel='noopener'>Wiki (Toolzzz)</a></li>
        <li><a href='${repo}' target='_blank' rel='noopener'>Code source (GitHub)</a></li>
        <li><a href='${repo}/issues/new?template=bug_report.yml' target='_blank' rel='noopener'>Signaler un bug</a></li>
        <li><a href='${repo}/issues/new?template=feature_request.yml' target='_blank' rel='noopener'>Proposer une fonctionnalité</a></li>
      </ul>
      <p class='left reduce'>Fork de <a href='https://github.com/GuiEpi/toolzzz' target='_blank' rel='noopener'>Toolzzz</a> (GuiEpi), lui-même fork d'<a href='https://github.com/Hraesvelg/Outiiil' target='_blank' rel='noopener'>Outiiil</a> (Hraesvelg), sous licence <a href='${repo}/blob/main/LICENSE' target='_blank' rel='noopener'>GPL-3.0</a>.</p>
      <hr class='o_marginT15' style='border:0; border-top:1px dashed currentColor; opacity:0.35;'/>
      <p class='left reduce gras'>Réinitialiser les paramètres</p>
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
        if (r.statut == "no_update") $etat.text(`Fzzz est à jour (v${VERSION}).`);
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
