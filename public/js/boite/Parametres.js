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
// dernière version publiée du script utilisateur (si le gestionnaire ne donne pas son adresse)
const SCRIPT_UTILISATEUR =
  "https://raw.githubusercontent.com/NumeroBis-boop/Fzzz/main/fzzz.user.js";
// onglets de la liste du mainteneur (14/11/2026) : ses sous-catégories, puis
// les réglages des rôles (montrés à tous), les pages où l'extension agit et « À
// propos » ; affichages : cases d'AFFICHAGES_REGLABLES, dans l'ordre de l'onglet
const ONGLETS_PARAMETRE = [
  {
    id: "Options",
    titre: "Options",
    affichages: ["horloge", "nouveautes", "affectationOuvrieres"],
  },
  { id: "Partage", titre: "Partage de données", affichages: [] },
  { id: "MiseEnPage", titre: "Mise en page", affichages: ["armeeMiseEnPage"] },
  {
    id: "ArmeeFloods",
    titre: "Armée et floods",
    affichages: [
      "replacerArmee",
      "armeeStatistiques",
      "listeAttaques",
      "couleurAttaquer",
      "statArmee",
      "lanceurFlood",
    ],
  },
  {
    id: "Messagerie",
    titre: "Messagerie",
    affichages: [
      "messagerieCouleurs",
      "messagerieCopie",
      "messagerieAnalyse",
      "messagerieExport",
      "messagerieRanger",
      "messagerieCompacte",
      "messagerieNonLus",
      "messagerieMiseEnForme",
      "messagerieSmileys",
      "messagerieSmileysAlliance",
    ],
  },
  {
    id: "Affichage",
    titre: "Affichage",
    affichages: [
      "membresTableau",
      "membresFloods",
      "membresMoi",
      "chatMesGif",
      "chatGifAlliance",
      "chatSmileysAlliance",
    ],
  },
  { id: "Chasseur", titre: "Chasseur", affichages: ["rappelExport", "lanceurChasse"] },
  { id: "Grenier", titre: "Grenier", affichages: ["convoisSuiviLignes"] },
  { id: "Pages", titre: "Pages", affichages: [] },
  { id: "Apropos", titre: "À propos", affichages: [] },
];
// pages où l'extension agit, chacune désactivable (Préférences → Pages ; ids lus
// par bootstrap.js, ONGLET_PAGE, et stockés sous CLE_ORIGINE + id)
const PAGES_EXTENSION = [
  {
    id: "General",
    libelle:
      "Toutes les pages : horloge, alerte de ponte, encadré Compte+ et radar, entrées Carte et Coûts des menus, info-bulles des entrepôts, thème des fenêtres et style des champs (la boîte « Extension OUAF » reste, pour revenir ici)",
  },
  { id: "Ressources", libelle: "Ressources" },
  { id: "Armee", libelle: "Armée" },
  { id: "Attaque", libelle: "Pages d'attaque et liste des ennemis" },
  { id: "Laboratoire", libelle: "Laboratoire et Construction" },
  { id: "Messagerie", libelle: "Messagerie" },
  { id: "Convois", libelle: "Convois" },
  { id: "Membre", libelle: "Page d'un membre et Membres de l'alliance" },
  { id: "Reine", libelle: "Reine" },
  { id: "Classement", libelle: "Page d'une alliance (classement)" },
  { id: "Chat", libelle: "Chats (alliance et général)" },
  { id: "Forum", libelle: "Forum de l'alliance" },
  { id: "Compte", libelle: "Compte" },
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
    this._paramGeneral = [
      "affectationRessource",
      "methodeFlood",
      "floodAttaques",
      "degressifBase",
      "degressifRegle",
      "floodImpactAuto",
      "uniteAntisondeTerrain",
      "uniteAntisondeDome",
      "sondeUnite",
      "sondeQuantite",
      "sondeLieu",
      "uniteAntisondeTerrainType",
      "uniteAntisondeDomeType",
      "vueMembres",
      "role",
      "replacerArmeeAuto",
      "ratioRecolte",
      "alertePonte",
      "tdcArriveeMax",
      "ratioPlancher",
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
      this.ongletOptions()
        .ongletPartage()
        .ongletMiseEnPage()
        .ongletArmeeFloods()
        .ongletMessagerie()
        .ongletAffichage()
        .ongletChasseur()
        .ongletGrenier()
        .ongletPages()
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
    for (let param of this._paramGeneral) monProfil.parametre[param].ajouterEvent();
    // le curseur de ratio n'a de sens qu'en mode Ratio
    $("#affectationRessource")
      .on("change", (e) => {
        $("#ratioRecolteGroupe").toggle(e.currentTarget.value == "3");
      })
      .trigger("change");
    // unités gardées au flood par défaut ; le nombre d'antisondes suit celui réglé plus haut
    this._gardees.brancher().afficher();
    $("#uniteAntisondeTerrain, #uniteAntisondeDome").on("spinchange spinstop", () =>
      this._gardees.afficher(),
    );
    // réglages du flood utiles à la méthode par défaut
    let afficherFlood = () => {
      let methode = $("#methodeFlood").val();
      $("#floodAttaques")
        .closest(".o_ligneParam")
        .toggle(methode != "1");
      $("#degressifBase, #degressifRegle")
        .closest(".o_ligneParam")
        .toggle(methode == "3");
      this.ajusterTaille();
    };
    afficherFlood();
    $("#methodeFlood").on("change", afficherFlood);
    // un affichage présent dans deux onglets : les deux cases suivent
    $("#o_tabsParametre input[data-affichage]").on("change", (e) => {
      let cle = e.currentTarget.dataset.affichage,
        coche = e.currentTarget.checked;
      try {
        localStorage.setItem("fzzz_affichage_" + cle, coche ? "1" : "0");
      } catch (err) {}
      $(`#o_tabsParametre input[data-affichage='${cle}']`).prop("checked", coche);
    });
    // page décochée : l'extension n'y agit plus, telle que le jeu l'affiche
    $("#o_tabsParametre input[data-page]").on("change", (e) => {
      try {
        if (e.currentTarget.checked)
          localStorage.removeItem(CLE_ORIGINE + e.currentTarget.dataset.page);
        else localStorage.setItem(CLE_ORIGINE + e.currentTarget.dataset.page, "1");
      } catch (err) {}
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
   * Ouvre les préférences sur un onglet.
   *
   * @static
   * @method ouvrirOnglet
   * @param {String} id identifiant de l'onglet (ONGLETS_PARAMETRE)
   */
  static ouvrirOnglet(id) {
    if (!$("#o_tabsParametre" + id).is(":visible"))
      $("#o_itemParametre").closest(".o_toolbarItem").trigger("click");
    let $onglets = $("#o_tabsParametre");
    if ($onglets.hasClass("ui-tabs"))
      $onglets.tabs(
        "option",
        "active",
        $onglets.find(`a[href='#o_tabsParametre${id}']`).parent().index(),
      );
  }
  /**
   * Case d'un affichage réglable (AFFICHAGES_REGLABLES).
   *
   * @method caseAffichage
   * @param {String} cle
   * @return {String}
   */
  caseAffichage(cle) {
    let libelles = { ...AFFICHAGES_FZZZ, ...AFFICHAGES_CONVOIS };
    return `<label class='o_affichageFzzz'><input type='checkbox' data-affichage='${cle}' ${Utils.affichageCoche(cle) ? "checked" : ""}/> ${libelles[cle]}</label>`;
  }
  /**
   * Cases des affichages d'un onglet, sous un titre.
   *
   * @method cases
   * @param {String} id identifiant de l'onglet (ONGLETS_PARAMETRE)
   * @param {Array<String>} [cles] ses affichages, ou une partie
   * @return {String}
   */
  cases(id, cles = ONGLETS_PARAMETRE.find((o) => o.id == id).affichages) {
    if (!cles.length) return "";
    return `<p class='o_titreParam'>Affichages <span class='o_aideParam'>(décocher pour masquer, au prochain chargement de la page)</span></p>
      ${cles.map((cle) => this.caseAffichage(cle)).join("")}`;
  }
  /**
   * Options : horloge, nouveautés, alerte de ponte, rôle, répartition des
   * ouvrières, mise à jour.
   *
   * @method ongletOptions
   */
  ongletOptions() {
    let p = monProfil.parametre;
    $("#o_tabsParametreOptions").append(`<form>
        ${this.cases("Options", ["horloge", "nouveautes"])}
        <p class='o_titreParam'>Ponte</p>
        ${p["alertePonte"].getForm("Alerte si la ponte finit dans moins de")}
        <p class='o_titreParam'>Rôle</p>
        ${p["role"].getForm("Ton rôle dans l'alliance")}
        <p class='left o_aideParam'>Chasseur : tes rapports de chasse sont exportés deux fois par semaine (onglet « Partage de données ») et, si cet export ne peut pas se faire, le rappel « Export des chasses à faire » s'affiche à partir du mercredi et du dimanche 22h, heure du serveur (onglet « Chasseur »). Le jeu supprime les conversations lues au bout de 7 jours.</p>
        <p class='o_titreParam'>Ouvrières <span class='o_aideParam'>(répartition préparée à l'ouverture de la page Ressources, à valider dans le formulaire du jeu${Utils.comptePlus ? " ; le mode Ratio coupe l'affectation automatique du C+" : ""})</span></p>
        ${this.caseAffichage("affectationOuvrieres")}
        ${p["affectationRessource"].getForm("Affectation")}
        ${p["ratioRecolte"].getForm()}
      </form>
      <p class='o_titreParam'>Mise à jour (v${VERSION})</p>
      <p class='left'><button type='button' id='o_majFzzz' class='o_button f_success'>Mettre à jour l'extension</button></p>
      <p id='o_majFzzzEtat' class='left small'></p>`);
    $("#o_majFzzz").on("click", (e) => {
      e.preventDefault();
      BoiteParametre.mettreAJour($(e.currentTarget), $("#o_majFzzzEtat"));
    });
    return this;
  }
  /**
   * @method ongletMiseEnPage
   */
  ongletMiseEnPage() {
    $("#o_tabsParametreMiseEnPage").append(`<form>${this.cases("MiseEnPage")}</form>`);
    return this;
  }
  /**
   * Armée et floods : page Armée (replacement, antisondes), pages d'attaque,
   * lanceur de flood, unités gardées et sonde.
   *
   * @method ongletArmeeFloods
   */
  ongletArmeeFloods() {
    let p = monProfil.parametre;
    ["uniteAntisondeTerrainType", "uniteAntisondeDomeType"].forEach(
      (cle) => (p[cle].valeurPossible = ["Première disponible", ...NOM_UNITE.slice(1)]),
    );
    p["sondeUnite"].valeurPossible = NOM_UNITE.slice(1);
    this._gardees = new UnitesGardees(
      "o_gardeesDefaut",
      () => {
        Armee.enregistrerGardees(this._gardees.reglage);
        this._gardees.afficher();
        this.ajusterTaille();
      },
      { titre: null, preferences: true },
    );
    $("#o_tabsParametreArmeeFloods").append(`<form>
        ${this.cases("ArmeeFloods")}
        ${p["replacerArmeeAuto"].getForm("Signaler une armée à replacer à l'ouverture de la page Armée")}
        <p class='o_titreParam'>Antisondes <span class='o_aideParam'>(nombre tiré entre 90 % du max et le max)</span></p>
        <div class='o_grilleParam o_grille2'>${p["uniteAntisondeTerrain"].getForm("Max en terrain")}${p["uniteAntisondeTerrainType"].getForm("Unité")}${p["uniteAntisondeDome"].getForm("Max en dôme")}${p["uniteAntisondeDomeType"].getForm("Unité")}</div>
        <p class='o_titreParam'>Flood</p>
        ${p["methodeFlood"].getForm("Méthode de flood par défaut")}
        ${p["floodAttaques"].getForm("Nombre d'attaques proposées")}
        ${p["degressifBase"].getForm("Dégressive : 1re attaque", "<span class='o_aideParam'>% du TdC de la cible</span>")}
        ${p["degressifRegle"].getForm("Dégressive : attaques suivantes")}
        ${p["floodImpactAuto"].getForm("TdC à l'impact dès l'ouverture", "<span class='o_aideParam'>sans clic, mis dans les champs ; une valeur tapée est gardée</span>")}
        <p class='o_titreParam'>Unités gardées au flood <span class='o_aideParam'>(par défaut, modifiables à chaque attaque)</span></p>
        ${this._gardees.html()}
        <p class='o_titreParam'>Sonder</p>
        ${p["sondeUnite"].getForm("Unité envoyée en sonde")}
        ${p["sondeQuantite"].getForm("Nombre d'unités (au plus)")}
        ${p["sondeLieu"].getForm("Lieu de sonde")}
      </form>`);
    return this;
  }
  /**
   * Chasseur : rappel d'export et lanceur de chasses (montré à tous les rôles).
   *
   * @method ongletChasseur
   */
  ongletChasseur() {
    let p = monProfil.parametre;
    $("#o_tabsParametreChasseur").append(`<form>
        ${this.cases("Chasseur")}
        <p class='left o_aideParam'>Le rappel « Export des chasses à faire » ne concerne que le rôle Chasseur (onglet « Options ») : il s'affiche à partir du mercredi et du dimanche 22h (heure du serveur) quand l'export automatique de tes chasses ne peut pas se faire.</p>
        <p class='o_titreParam'>Lanceur de chasses <span class='o_aideParam'>(le TdC à l'arrivée proposé est le TdC courant, jusqu'à cette valeur ; au-delà, les chasses durent trop pour que le TdC du moment soit une prévision : à renseigner soi-même)</span></p>
        ${p["tdcArriveeMax"].getForm("TdC à l'arrivée proposé, au plus", " cm²")}
        <p class='o_aideParam'>Ratio plancher quand le ratio est libre (pertes acceptées fixées) : à 7,2 plus aucune chance de réplique à 50 % ; à 6, l'ancien plancher du lanceur par budget, 65 % des chasses subissent 30 % de réplique mais le budget sert en entier.</p>
        ${p["ratioPlancher"].getForm("Ratio plancher")}
      </form>`);
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
        <div id='o_exportSheetReglage'></div>
      </form>`);
    this.reglageExport();
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
   * Adresse du script du Google Sheet de l'export des RC, pour un joueur hors
   * de la liste du forum caché seulement (son propre fichier, adresse gardée
   * dans son navigateur) : pour ceux de la liste, rien à régler ni à afficher.
   *
   * @method reglageExport
   */
  reglageExport() {
    ExportRapports.reglageAlliance().then((r) => {
      if (!r.autorise) this.reglageExportPersonnel();
    });
    return this;
  }
  /**
   * @method reglageExportPersonnel
   */
  reglageExportPersonnel() {
    let $zone = $("#o_exportSheetReglage").html(`
        <p class='o_titreParam'>Export vers le Google Sheet</p>
        <p id='o_exportSheetEtat' class='left small'></p>
        <p class='left small'><em>Pour exporter tes rapports (boutons « Exporter mes chasses » et « Exporter mes RC » de la messagerie), renseigne l'adresse du script de ton propre Google Sheet. Elle reste dans ton navigateur. Les joueurs de la liste du forum caché (sujet « ${TITRE_EXPORT_SHEET} ») n'ont rien à régler.</em></p>
        <p class='left small'><label for='o_exportSheet'>Adresse du script :</label>
          <input type='password' id='o_exportSheet' autocomplete='new-password' spellcheck='false' placeholder='https://script.google.com/macros/s/…/exec' style='width:16em; max-width:100%'/>
          <button type='button' id='o_exportSheetVoir' class='o_button' title="Afficher l'adresse enregistrée">👁 Afficher</button>
          <button type='button' id='o_exportSheetEnregistrer' class='o_button f_success'>Enregistrer</button>
          <button type='button' id='o_exportSheetTester' class='o_button'>Tester</button>
          <button type='button' id='o_exportSheetEffacer' class='o_button f_error'>Effacer</button></p>`),
      etat = (/** @type {String} */ url, message = "") =>
        $zone
          .find("#o_exportSheetEtat")
          .html(
            message ||
              (url
                ? "<span class='green'>Adresse de ton fichier enregistrée.</span>"
                : "<span class='red'>Aucune adresse : l'export est impossible jusque-là.</span>"),
          ),
      masquer = () => {
        $zone.find("#o_exportSheet").attr("type", "password").val("");
        $zone
          .find("#o_exportSheetVoir")
          .text("👁 Afficher")
          .attr("title", "Afficher l'adresse enregistrée");
      };
    // section ajoutée après la lecture du forum : onglet peut-être déjà affiché
    this.ajusterTaille();
    ExportRapports.adressePersonnelle().then((url) => etat(url));
    $zone.find("#o_exportSheetEnregistrer").on("click", () => {
      let url = String($zone.find("#o_exportSheet").val() || "").trim();
      if (!url) return;
      if (!ExportRapports.adresseValide(url))
        return etat(
          url,
          "<span class='red'>Adresse refusée : elle commence par https://script.google.com/ et finit par /exec.</span>",
        );
      ExportRapports.enregistrerAdresse(url).then(() => {
        masquer();
        etat(url);
      });
    });
    $zone.find("#o_exportSheetEffacer").on("click", () =>
      ExportRapports.enregistrerAdresse("").then(() => {
        masquer();
        etat("");
      }),
    );
    $zone.find("#o_exportSheetVoir").on("click", () => {
      if ($zone.find("#o_exportSheet").attr("type") == "text") return masquer();
      ExportRapports.adressePersonnelle().then((url) => {
        if (!url) return etat("");
        $zone.find("#o_exportSheet").attr("type", "text").val(url);
        $zone.find("#o_exportSheetVoir").text("🙈 Masquer").attr("title", "Masquer l'adresse");
      });
    });
    $zone.find("#o_exportSheetTester").on("click", () => {
      let saisie = String($zone.find("#o_exportSheet").val() || "").trim();
      (saisie ? Promise.resolve(saisie) : ExportRapports.adressePersonnelle()).then((url) => {
        if (!ExportRapports.adresseValide(url))
          return etat(url, "<span class='red'>Aucune adresse valide à tester.</span>");
        etat(url, "Test en cours…");
        ExportRapports.requete(url, "GET").then(
          (r) =>
            etat(
              url,
              `<span class='green'>Script joignable${r.fichier ? ` : fichier « ${Utils.echapper(String(r.fichier))} »` : ""}.</span>`,
            ),
          (e) => etat(url, `<span class='red'>Échec : ${Utils.echapper(e.message)}.</span>`),
        );
      });
    });
    return this;
  }
  /**
   * Grenier : suivi OUAF de la page Convois, et mot de passe du site de suivi
   * des convois de la OUAF (seul endroit où il se renseigne). Il est gardé dans le stockage
   * de l'extension, que le jeu ne peut pas lire, et n'est placé dans le champ
   * que si le joueur clique « Afficher ».
   *
   * @method ongletGrenier
   */
  ongletGrenier() {
    $("#o_tabsParametreGrenier").append(`<form autocomplete='off'>
            ${this.cases("Grenier")}
            <p class='o_titreParam'>Suivi des convois de la OUAF</p>
            <p class='left small'>Site : <a href='${OUAF_SITE}' target='_blank' rel='noopener'>${OUAF_SITE.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a></p>
            <p class='left small'><label for='o_ouafCode'>Mot de passe du site de suivi :</label>
              <input type='password' id='o_ouafCode' autocomplete='new-password' spellcheck='false' style='width:12em'/>
              <button type='button' id='o_ouafCodeVoir' class='o_button' title='Afficher le mot de passe enregistré'>👁 Afficher</button>
              <button type='button' id='o_ouafCodeEnregistrer' class='o_button f_success'>Enregistrer</button>
              <button type='button' id='o_ouafCodeEffacer' class='o_button f_error'>Effacer</button></p>
            <p id='o_ouafCodeEtat' class='left small'></p>
            <p class='left small'><em>Le mot de passe reste dans ton navigateur, dans l'espace privé de l'extension. Il n'est envoyé qu'au site de suivi : pour « 📤 Envoyer au suivi » à côté d'un convoi, la colonne « Convoi à faire » du Récapitulatif et le lien « Ouvrir le site de suivi OUAF ».</em></p>
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
   * Affichage : page Membres de l'alliance et chats.
   *
   * @method ongletAffichage
   */
  ongletAffichage() {
    $("#o_tabsParametreAffichage").append(`<form>
        <p class='o_titreParam'>Membres de l'alliance <span class='o_aideParam'>(décocher pour masquer, au prochain chargement de la page)</span></p>
        ${["membresTableau", "membresFloods", "membresMoi"].map((cle) => this.caseAffichage(cle)).join("")}
        ${monProfil.parametre["vueMembres"].getForm("Vue par défaut de la page Membres de l'alliance")}
        <p class='o_titreParam'>Chats</p>
        ${["chatMesGif", "chatGifAlliance", "chatSmileysAlliance"].map((cle) => this.caseAffichage(cle)).join("")}
      </form>`);
    return this;
  }
  /**
   * Partage de données : une case par information relevée chaque jour pour le
   * fichier de l'alliance (SuiviMembres), puis celle de l'export automatique
   * des chasses (ExportAuto), toutes cochées par défaut, et les boutons
   * d'export des rapports, utilisables de toutes les pages.
   *
   * @method ongletPartage
   */
  ongletPartage() {
    let $onglet = $("#o_tabsParametrePartage").append(`<form>
        <p class='left o_aideParam'>Une fois par jour, à la première page que tu ouvres, l'extension relève les informations cochées ci-dessous et les envoie au Google Sheet « ${TITRE_STATS_MEMBRES} » de ton alliance, avec ton pseudo et la version de l'extension. Elle le refait à la première page ouverte après un changement de niveau de ta Champignonnière ou de ton Étable à pucerons, si tu partages ce niveau. L'adresse du fichier est lue dans le forum caché de l'alliance (sujet « ${TITRE_STATS_MEMBRES} ») : sans ce sujet, rien n'est relevé ni envoyé.</p>
        <p class='o_titreParam'>Informations partagées <span class='o_aideParam'>(décochée : elle n'est plus relevée ni envoyée ; le fichier indique seulement que tu ne la partages pas)</span></p>
        ${DONNEES_PARTAGEES.map(
          (d) =>
            `<label class='o_affichageFzzz'><input type='checkbox' data-partage='${d.cle}' ${SuiviMembres.partage(d.cle) ? "checked" : ""}/> ${d.libelle}</label>`,
        ).join("")}
        <p class='left o_aideParam'>Réglage propre à ce navigateur. Un changement est envoyé à ta prochaine page.</p>
        <p class='o_titreParam'>Envoi</p>
        <p id='o_partageEtat' class='left small'></p>
        <p class='left'><button type='button' id='o_partageEnvoyer' class='o_button'>Envoyer maintenant</button></p>
        <p class='o_titreParam'>Rapports de chasse <span class='o_aideParam'>(rôle Chasseur)</span></p>
        <label class='o_affichageFzzz'><input type='checkbox' id='o_partageChasses' ${ExportAuto.coche() ? "checked" : ""}/> Exporter mes chasses automatiquement</label>
        <p class='left o_aideParam'>Deux fois par semaine au plus : à ton premier clic sur « Envoyer » ou « Envoyer + partager » du lanceur de chasses après le mercredi ou le dimanche 22h (heure du serveur), l'extension lit les rapports de chasse de ta messagerie pas encore exportés et les envoie au Google Sheet où tu exportes tes rapports, une fois les chasses envoyées et après toutes ses autres demandes au jeu ; ceux que tu n'avais pas lus restent marqués non lus. Sans ce clic (chasses lancées avec le formulaire du jeu), rien n'est exporté automatiquement. Le bouton « Exporter mes chasses » ci-dessous reste, pour un export immédiat. Le rappel « Export des chasses à faire » ne s'affiche que si un essai échoue. Décochée : rien n'est lu ni envoyé sans ton clic sur ce bouton, et le rappel s'affiche dès le mercredi et le dimanche 22h.</p>
        <p id='o_partageChassesEtat' class='left small'></p>
        <p class='o_titreParam'>Exporter maintenant</p>
        <p class='left'><button type='button' class='o_button f_info o_exporterRapports' data-quoi='chasse'>Exporter mes chasses</button> <button type='button' class='o_button f_info o_exporterRapports' data-quoi='combat'>Exporter mes RC</button></p>
        <p class='left o_aideParam'>Les conversations de ta boîte de réception dont un rapport manque au Google Sheet où tu exportes tes rapports sont lues une à une, puis envoyées : chasses (onglet « ${EXPORTS_RAPPORTS.chasse.onglet} ») ; attaques (« ${EXPORTS_RAPPORTS.attaque.onglet} »), défenses (« ${EXPORTS_RAPPORTS.defense.onglet} ») et floods avec les membres de l'alliance (« ${EXPORTS_RAPPORTS.interne.onglet} »). Les mêmes boutons peuvent aussi s'afficher dans la messagerie (onglet « Messagerie »).</p>
      </form>`),
      etat = (message = "") =>
        $onglet.find("#o_partageEtat").text(message || SuiviMembres.resume()),
      etatChasses = () => $onglet.find("#o_partageChassesEtat").text(ExportAuto.resume());
    etat();
    etatChasses();
    $onglet.find("#o_partageChasses").on("change", (e) => {
      ExportAuto.choisir(e.currentTarget.checked);
      etatChasses();
    });
    let $exports = $onglet.find(".o_exporterRapports").on("click", (e) => {
      e.preventDefault();
      let quoi = e.currentTarget.dataset.quoi;
      ExportRapports.exporter(quoi, $(e.currentTarget), () =>
        ExportRapports.boiteDeReception(quoi),
      );
    });
    // rappel d'export en cours (rôle Chasseur) : le bouton à cliquer, encadré
    if (RappelExport.aRappeler()) $exports.filter("[data-quoi='chasse']").addClass("o_synchroPret");
    $onglet.find("input[data-partage]").on("change", (e) => {
      SuiviMembres.choisir(e.currentTarget.dataset.partage, e.currentTarget.checked);
      etat();
    });
    $onglet.find("#o_partageEnvoyer").on("click", (e) => {
      e.preventDefault();
      let $bouton = $(e.currentTarget).prop("disabled", true);
      etat("Relevé et envoi en cours…");
      SuiviMembres.lancer(true).then(() => {
        $bouton.prop("disabled", false);
        etat();
        this.ajusterTaille();
      });
    });
    return this;
  }
  /**
   * Pages où l'extension agit : décochée, une page reste telle que le jeu
   * l'affiche (règle du mainteneur 1.59, une section à part depuis le 14/11/2026).
   *
   * @method ongletPages
   */
  ongletPages() {
    $("#o_tabsParametrePages").append(`<form>
        <p class='o_titreParam'>Pages où l'extension agit <span class='o_aideParam'>(décochée : la page reste telle que le jeu l'affiche, au prochain chargement)</span></p>
        ${PAGES_EXTENSION.map(
          (g) =>
            `<label class='o_affichageFzzz'><input type='checkbox' data-page='${g.id}' ${Utils.origine(g.id) ? "" : "checked"}/> ${g.libelle}</label>`,
        ).join("")}
      </form>`);
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
      <ul class='left reduce'>
        <li><a href='https://github.com/GuiEpi/toolzzz/wiki' target='_blank' rel='noopener'>Wiki (Toolzzz)</a></li>
        <li><a href='${repo}' target='_blank' rel='noopener'>Code source (GitHub)</a></li>
        <li><a href='${repo}/issues/new?template=bug_report.yml' target='_blank' rel='noopener'>Signaler un bug</a></li>
        <li><a href='${repo}/issues/new?template=feature_request.yml' target='_blank' rel='noopener'>Proposer une fonctionnalité</a></li>
      </ul>
      <p class='left reduce'>Développement : DoggyBag ; chasses : Grim.</p>
      <p class='left reduce'>Fork de <a href='https://github.com/GuiEpi/toolzzz' target='_blank' rel='noopener'>Toolzzz</a> (GuiEpi), lui-même fork d'<a href='https://github.com/Hraesvelg/Outiiil' target='_blank' rel='noopener'>Outiiil</a> (Hraesvelg), sous licence <a href='${repo}/blob/main/LICENSE' target='_blank' rel='noopener'>GPL-3.0</a>.</p>
      <hr class='o_marginT15' style='border:0; border-top:1px dashed currentColor; opacity:0.35;'/>
      <p class='o_titreParam'>Réinitialiser les paramètres</p>
      <p class='left small'><em>Remet toutes les options (dock, flood, antisondes, signalement de l'armée à replacer, etc.) aux valeurs par défaut. La page sera rechargée.</em></p>
      <button id='o_resetParametres' class='o_button f_error'>Réinitialiser</button>
    `);
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
        else if (r.statut == "userscript") {
          // le gestionnaire de scripts intercepte l'ouverture d'un .user.js et
          // propose d'installer la version publiée
          window.open(r.url || SCRIPT_UTILISATEUR, "_blank", "noopener");
          $etat.text(
            "La dernière version du script s'ouvre : clique sur « Installer » (ou « Mettre à jour ») dans Violentmonkey ou Tampermonkey, puis recharge la page du jeu.",
          );
        } else if (r.statut == "non_supporte") {
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
