/*
 * BoiteParametre.js
 * Hraesvelg
 **********************************************************************/

// dernière version publiée du script utilisateur (si le gestionnaire ne donne pas son adresse)
const SCRIPT_UTILISATEUR =
  "https://raw.githubusercontent.com/NumeroBis-boop/Fzzz/main/fzzz.user.js";
// onglets rangés par page du jeu, dans l'ordre de son menu (réorganisation
// approuvée par le mainteneur, 14/11/2026) : « Général » pour toutes les pages,
// « Partage de données » pour ce qui sort du navigateur. affichages : cases
// d'AFFICHAGES_REGLABLES de l'onglet ; pages : groupes de PAGES_EXTENSION dont
// la case décochée rend ses réglages sans effet
const ONGLETS_PARAMETRE = [
  { id: "General", titre: "Général", pages: ["General"], affichages: ["horloge", "nouveautes"] },
  {
    id: "Ressources",
    titre: "Ressources",
    pages: ["Ressources"],
    affichages: ["affectationOuvrieres", "lanceurChasse", "remplissageEntrepots", "bilanRecolte"],
  },
  {
    id: "Armee",
    titre: "Armée",
    pages: ["Armee"],
    affichages: ["armeeMiseEnPage", "armeeStatistiques", "listeAttaques", "replacerArmee"],
  },
  {
    id: "Attaque",
    titre: "Attaque",
    pages: ["Attaque"],
    affichages: ["couleurAttaquer", "statArmee", "lanceurFlood"],
  },
  {
    id: "Convois",
    titre: "Convois",
    pages: ["Convois"],
    affichages: [
      "convoisSuiviLignes",
      "convoisSansReceptionBarree",
      "convoisSansReceptionRouge",
      "convoisSansReceptionColonne",
    ],
  },
  {
    id: "Messagerie",
    titre: "Messagerie",
    pages: ["Messagerie"],
    affichages: [
      "messagerieRanger",
      "messagerieCompacte",
      "messagerieNonLus",
      "messagerieCouleurs",
      "messagerieCopie",
      "messagerieAnalyse",
      "messagerieExport",
      "messagerieMiseEnForme",
      "messagerieSmileys",
      "messagerieSmileysAlliance",
    ],
  },
  {
    id: "Alliance",
    titre: "Alliance",
    pages: ["Membre", "Chat", "Forum"],
    affichages: [
      "membresTableau",
      "membresFloods",
      "membresMoi",
      // colonnes de la vue « Floods et chasses en cours », dans l'ordre de MEMBRES_COLONNES_FLOODS
      "membresFloodsRang",
      "membresFloodsPseudo",
      "membresFloodsTdc",
      "membresFloodsDernier",
      "membresFloodsTotal",
      "membresFloodsProchain",
      "membresFloodsVariation",
      "membresFloodsFinal",
      "membresFloodsTrajet",
      "membresFloodsRetour",
      "membresFloodsEtat",
      "chatMesGif",
      "chatGifAlliance",
      "chatSmileysAlliance",
      "forumGif",
      "forumSmileysAlliance",
    ],
  },
  { id: "Partage", titre: "Partage de données", pages: [], affichages: ["rappelExport"] },
  { id: "Pages", titre: "Pages", pages: [], affichages: [] },
  { id: "Apropos", titre: "À propos", pages: [], affichages: [] },
];
// onglet montré à chaque ouverture des Préférences (règle du mainteneur, 16/11/2026)
const ONGLET_OUVERTURE = "General";
// pages où l'extension agit, chacune désactivable (Préférences → Pages ; ids lus
// par bootstrap.js, ONGLET_PAGE, et stockés sous CLE_ORIGINE + id)
const PAGES_EXTENSION = [
  {
    id: "General",
    libelle:
      "Toutes les pages : horloge, alerte de ponte, encadré Compte+ et radar, entrées Carte, Stats membres et Multi-flood opti des menus, info-bulles des entrepôts, thème des fenêtres et style des champs (la boîte « Extension OUAF » reste, pour revenir ici)",
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
      "Préférences",
      `<div class='o_rechercheParam'><input type='search' id='o_rechercheParam' placeholder='Rechercher un réglage' autocomplete='off' spellcheck='false'/>
        <ul id='o_rechercheResultats' hidden></ul>
        <p class='o_aideParam'>La plupart des changements s'appliquent au prochain chargement de la page.</p></div>
      <div id='o_tabsParametre' class='o_tabs'><ul>${ONGLETS_PARAMETRE.map((o) => `<li><a href='#o_tabsParametre${o.id}'>${o.titre}</a></li>`).join("")}</ul>${ONGLETS_PARAMETRE.map((o) => `<div id='o_tabsParametre${o.id}'/>`).join("")}</div>`,
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
      "alerteFloods",
      "convoisAvantRecolte",
      "decalageChasses",
      "decalageFloods",
    ];
  }
  /**
   * Affiche la boite sur l'onglet « Général » ; déjà ouverte, elle garde son
   * onglet (un lien vers un onglet, BoiteParametre.ouvrirOnglet, l'ouvre ensuite).
   *
   * @method afficher
   */
  afficher() {
    let $boite = $("#o_boiteParametre"),
      ouverte = $boite.length > 0 && $boite.css("display") != "none",
      general = Math.max(
        0,
        ONGLETS_PARAMETRE.findIndex((o) => o.id == ONGLET_OUVERTURE),
      );
    if (super.afficher()) {
      $("#o_tabsParametre")
        .tabs({ active: general, activate: () => this.css().ajusterTaille() })
        .removeClass("ui-widget");
      this.construireOnglets().css().event();
      $(window).on("resize.o_boiteParametre", () => this.ajusterTaille());
    } else if (!ouverte) $("#o_tabsParametre").tabs("option", "active", general);
    // après l'effet d'ouverture : la taille n'est mesurable qu'une fois affichée
    $("#o_boiteParametre")
      .promise()
      .done(() => this.ajusterTaille());
  }
  /**
   * Contenu de tous les onglets, dans l'ordre de ONGLETS_PARAMETRE.
   *
   * @method construireOnglets
   */
  construireOnglets() {
    this.ongletGeneral()
      .ongletRessources()
      .ongletArmee()
      .ongletAttaque()
      .ongletConvois()
      .ongletMessagerie()
      .ongletAlliance()
      .ongletPartage()
      .ongletPages()
      .apropos();
    ONGLETS_PARAMETRE.filter((o) => o.pages.length).forEach((o) =>
      $(`#o_tabsParametre${o.id}`).prepend(
        `<p class='o_pageDesactivee' data-pages='${o.pages.join(" ")}' hidden></p>`,
      ),
    );
    return this.majPagesDesactivees();
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
    Joueur.suivreChoixDecalage();
    // le curseur de ratio n'a de sens qu'en mode Ratio
    $("#affectationRessource")
      .on("change", (e) => {
        $("#ratioRecolteGroupe").toggle(e.currentTarget.value == "3");
      })
      .trigger("change");
    // unités gardées au flood par défaut ; le nombre d'antisondes suit celui réglé dans l'onglet Armée
    if (this._gardees) {
      this._gardees.brancher().afficher();
      $("#uniteAntisondeTerrain, #uniteAntisondeDome").on("spinchange spinstop", () =>
        this._gardees.afficher(),
      );
    }
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
      this.majPagesDesactivees();
    });
    // rôle : son étiquette en couleur
    $("#role").on("change", () => this.majEtiquettes());
    $("#o_boiteParametre").on("click", ".o_lienOnglet", (e) => {
      e.preventDefault();
      BoiteParametre.ouvrirOnglet(e.currentTarget.dataset.onglet);
    });
    $("#o_boiteParametre").on("input", "#o_rechercheParam", (e) =>
      this.afficherRecherche(e.currentTarget.value),
    );
    $("#o_boiteParametre").on("click", "#o_rechercheResultats a", (e) => {
      e.preventDefault();
      let r = this._resultats[parseInt(e.currentTarget.dataset.i)];
      if (r) BoiteParametre.montrerReglage(r.onglet, r.element);
    });
    // Réinitialiser (À propos) : la page rechargée reconstruit monProfil par défaut
    $("#o_resetParametres").click(() => {
      if (confirm("Remettre les réglages chiffrés ou à choix à leur valeur par défaut ?")) {
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
   * Ouvre l'onglet d'un réglage trouvé par la recherche et le fait clignoter.
   *
   * @static
   * @method montrerReglage
   * @param {String} onglet id de l'onglet
   * @param {Element} element ligne du réglage
   */
  static montrerReglage(onglet, element) {
    BoiteParametre.ouvrirOnglet(onglet);
    let $e = $(element).removeClass("o_reglageTrouve");
    // relancer l'animation : la classe est retirée, puis remise après un rendu
    void element.offsetWidth;
    $e.addClass("o_reglageTrouve");
    if (element.scrollIntoView) element.scrollIntoView({ block: "center" });
  }
  /**
   * Case d'un affichage réglable (AFFICHAGES_REGLABLES).
   *
   * @method caseAffichage
   * @param {String} cle
   * @param {String} [apres] HTML ajouté après le libellé (étiquette de rôle)
   * @return {String}
   */
  caseAffichage(cle, apres = "") {
    let libelles = { ...AFFICHAGES_FZZZ, ...AFFICHAGES_CONVOIS };
    return `<label class='o_affichageFzzz'><input type='checkbox' data-affichage='${cle}' ${Utils.affichageCoche(cle) ? "checked" : ""}/> ${libelles[cle]}${apres}</label>`;
  }
  /**
   * Cases des affichages d'un onglet.
   *
   * @method cases
   * @param {String} id identifiant de l'onglet (ONGLETS_PARAMETRE)
   * @param {Array<String>} [cles] ses affichages, ou une partie
   * @return {String}
   */
  cases(id, cles = ONGLETS_PARAMETRE.find((o) => o.id == id).affichages) {
    return cles.map((cle) => this.caseAffichage(cle)).join("");
  }
  /**
   * Section d'un onglet : un titre, puis ses réglages.
   *
   * @method section
   * @param {String} titre HTML du titre
   * @param {String} contenu
   * @return {String}
   */
  section(titre, contenu) {
    return `<div class='o_sectionParam'><p class='o_titreParam'>${titre}</p>${contenu}</div>`;
  }
  /**
   * Aide d'un réglage : une ligne, le détail derrière « En savoir plus ».
   *
   * @method aide
   * @param {String} texte
   * @param {String} [plus]
   * @return {String}
   */
  aide(texte, plus = "") {
    return `<div class='left o_aideParam'>${texte}${plus ? ` <details class='o_aidePlus'><summary>En savoir plus</summary>${plus}</details>` : ""}</div>`;
  }
  /**
   * Étiquette du rôle concerné par un réglage, en couleur pour le rôle choisi.
   *
   * @method etiquette
   * @param {String} role nom de ROLES
   * @return {String}
   */
  etiquette(role) {
    return `<span class='o_etiquetteRole' data-role='${role}' title='Réglage du rôle ${role}'>${role}</span>`;
  }
  /**
   * @method majEtiquettes
   */
  majEtiquettes() {
    let role = ROLES[parseInt($("#role").val() ?? monProfil.parametre["role"].valeur)];
    $("#o_tabsParametre .o_etiquetteRole").each((i, e) =>
      $(e).toggleClass("o_etiquetteMienne", e.dataset.role == role),
    );
    return this;
  }
  /**
   * Lien qui ouvre un autre onglet des Préférences.
   *
   * @method lienOnglet
   * @param {String} id identifiant de l'onglet
   * @param {String} texte
   * @return {String}
   */
  lienOnglet(id, texte) {
    return `<a href='#' class='o_lienOnglet' data-onglet='${id}'>${texte}</a>`;
  }
  /**
   * En haut d'un onglet dont une page est décochée dans « Pages » : ses
   * réglages y sont sans effet.
   *
   * @method majPagesDesactivees
   */
  majPagesDesactivees() {
    $("#o_tabsParametre .o_pageDesactivee").each((i, p) => {
      let pages = String(p.dataset.pages).split(" "),
        toutes = Utils.origine("General"),
        coupees = PAGES_EXTENSION.filter((g) => pages.includes(g.id) && Utils.origine(g.id));
      $(p)
        .prop("hidden", !toutes && !coupees.length)
        .html(
          `L'extension est désactivée ${
            toutes
              ? "sur toutes les pages"
              : `sur : ${coupees.map((g) => (g.id == "General" ? "toutes les pages" : g.libelle)).join(", ")}`
          } (${this.lienOnglet("Pages", "onglet « Pages »")}) : ces réglages y sont sans effet.`,
        );
    });
    return this;
  }
  /**
   * Accents, majuscules, apostrophes et espaces ignorés.
   *
   * @static
   * @method normaliser
   * @param {String} texte
   * @return {String}
   */
  static normaliser(texte) {
    return String(texte)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[’`]/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }
  /**
   * Réglages trouvés pour une recherche : ceux dont le libellé ou le titre de
   * la section contient tous les mots tapés, puis les sections dont l'aide
   * les contient.
   *
   * @method chercher
   * @param {String} texte
   * @return {Array} [{onglet, titreOnglet, section, libelle, element}]
   */
  chercher(texte) {
    let mots = BoiteParametre.normaliser(texte).split(" ").filter(Boolean),
      contient = (t) => {
        let n = BoiteParametre.normaliser(t);
        return mots.every((m) => n.includes(m));
      },
      reglages = [],
      sections = [];
    if (!mots.length) return [];
    ONGLETS_PARAMETRE.forEach((o) =>
      $(`#o_tabsParametre${o.id} .o_sectionParam`).each((i, s) => {
        let titre = $(s).children(".o_titreParam").first().clone(),
          aide = $(s).find(".o_aideParam").text();
        titre.find(".o_etiquetteRole, .o_aideParam, button").remove();
        let section = titre.text().trim(),
          // libellé d'une ligne : sans le texte des options de ses listes
          libelle = (e) =>
            $(e).clone().find("select, option").remove().end().text().replace(/\s+/g, " ").trim(),
          trouves = $(s)
            .find("label.o_affichageFzzz, .o_ligneParam, .o_reglage")
            .get()
            .filter((e) => contient(section + " " + libelle(e)))
            .map((e) => ({
              onglet: o.id,
              titreOnglet: o.titre,
              section,
              libelle: libelle(e),
              element: e,
            }));
        reglages.push(...trouves);
        if (!trouves.length && contient(section + " " + aide))
          sections.push({ onglet: o.id, titreOnglet: o.titre, section, libelle: "", element: s });
      }),
    );
    return [...reglages, ...sections];
  }
  /**
   * @method afficherRecherche
   * @param {String} texte
   */
  afficherRecherche(texte) {
    const MAX = 40;
    let trouves = this.chercher(texte),
      coupe = (t) => (t.length > 90 ? t.slice(0, 89) + "…" : t);
    this._resultats = trouves.slice(0, MAX);
    $("#o_rechercheResultats")
      .prop("hidden", !String(texte).trim())
      .html(
        trouves.length
          ? this._resultats
              .map(
                (r, i) =>
                  `<li><a href='#' data-i='${i}'>${[r.titreOnglet, r.section, coupe(r.libelle)].filter(Boolean).join(" › ")}</a></li>`,
              )
              .join("") +
              (trouves.length > MAX
                ? `<li class='o_aideParam'>… et ${trouves.length - MAX} autres</li>`
                : "")
          : "<li class='o_aideParam'>Aucun réglage trouvé.</li>",
      );
    this.ajusterTaille();
    return this;
  }
  /**
   * Général : ce qui agit sur toutes les pages, rôle, mise à jour et journal de débug.
   *
   * @method ongletGeneral
   */
  ongletGeneral() {
    let p = monProfil.parametre;
    $("#o_tabsParametreGeneral").append(`<form>
        ${this.section("Horloge et nouveautés", this.cases("General"))}
        ${this.section("Alerte de ponte", p["alertePonte"].getForm("Alerte si la ponte finit dans moins de"))}
        ${this.section("Rôle", p["role"].getForm("Ton rôle dans l'alliance"))}
        ${this.section(
          "Retard des heures partagées dans le forum",
          p["decalageChasses"].getForm("Chasses, au plus") +
            p["decalageFloods"].getForm("Floods, au plus") +
            this.aide(
              "L'heure de chaque chasse ou flood que tu partages est retardée d'un délai tiré au hasard, de 0 à ce maximum : une fuite du forum ne donne pas l'heure exacte où ton armée est dehors. 0, la valeur par défaut : heure exacte.",
              "Le délai est tiré une fois par chasse ou flood et gardé dans ce navigateur ; la ligne reste dans le forum jusqu'à son heure publiée, même si la chasse ou le flood est déjà arrivé. Les autres membres calculent avec l'heure publiée : leur TdC à l'impact, « à portée le … », la colonne « Synchro » et l'alerte des floods peuvent être décalés d'autant. Tes propres affichages gardent l'heure exacte.",
            ),
        )}
      </form>
      ${this.section(
        `Mise à jour (v${VERSION})`,
        `<p class='left o_reglage'><button type='button' id='o_majFzzz' class='o_button f_success'>Mettre à jour l'extension</button></p>
        <p id='o_majFzzzEtat' class='left small'></p>`,
      )}
      ${this.section(
        "Journal de débug",
        `<p class='left o_reglage'><button type='button' id='o_copierJournal' class='o_button'>Copier le journal de débug</button></p>
        <p id='o_copierJournalEtat' class='left small'></p>
        ${this.aide(
          "Pour signaler un bug : copie le journal, puis colle-le dans ton message.",
          `Le journal garde, dans ce navigateur et pour ce serveur, les 200 dernières notes de l'extension : notifications, erreurs, étapes des lectures et des envois. Les adresses des fichiers Google et les mots de passe y sont masqués. Les jours où il contient une erreur, il est aussi envoyé une fois au Google Sheet des stats membres de l'alliance (${this.lienOnglet("Partage", "onglet Partage de données")}).`,
        )}`,
      )}`);
    $("#o_majFzzz").on("click", (e) => {
      e.preventDefault();
      BoiteParametre.mettreAJour($(e.currentTarget), $("#o_majFzzzEtat"));
    });
    $("#o_copierJournal").on("click", (e) => {
      e.preventDefault();
      let $etat = $("#o_copierJournalEtat");
      Journal.copier($etat, (texte) => $etat.text(texte));
    });
    this.majEtiquettes();
    return this;
  }
  /**
   * Ressources : répartition des ouvrières et lanceur de chasses.
   *
   * @method ongletRessources
   */
  ongletRessources() {
    let p = monProfil.parametre;
    $("#o_tabsParametreRessources").append(`<form>
        ${this.section(
          "Répartition des ouvrières",
          this.caseAffichage("affectationOuvrieres") +
            p["affectationRessource"].getForm("Affectation") +
            p["ratioRecolte"].getForm() +
            this.aide(
              `Préparée à l'ouverture de la page Ressources, à valider dans le formulaire du jeu.${Utils.comptePlus ? " Le mode Ratio coupe l'affectation automatique du Compte+." : ""}`,
            ),
        )}
        ${this.section(
          `Lanceur de chasses ${this.etiquette("Chasseur")}`,
          this.caseAffichage("lanceurChasse") +
            p["tdcArriveeMax"].getForm("TdC à l'arrivée proposé, au plus", " cm²") +
            this.aide(
              "Le TdC à l'arrivée proposé est le TdC courant, jusqu'à cette valeur.",
              "Au-delà, les chasses durent trop pour que le TdC du moment soit une prévision : à renseigner soi-même.",
            ) +
            p["ratioPlancher"].getForm("Ratio plancher") +
            this.aide(
              "Ratio plancher quand le ratio est libre (pertes acceptées fixées).",
              "À 7,2 plus aucune chance de réplique à 50 % ; à 6, l'ancien plancher du lanceur par budget, 65 % des chasses subissent 30 % de réplique mais le budget sert en entier.",
            ) +
            p["alerteFloods"].getForm() +
            this.aide(
              "Sous le bouton « Envoyer » du lanceur, les floods sur toi qui arrivent dans ce délai, avec leur prise estimée.",
              "Seuls les floods partagés dans le forum de l'alliance par ses membres sont connus : une attaque ennemie ne l'est pas. Ils sont lus à l'ouverture de la page Ressources (forum, et la page Membres quand un autre joueur est concerné) ; le texte se met à jour chaque minute, sans autre lecture. Sans flood dans ce délai, rien ne s'affiche.",
            ),
        )}
        ${this.section(
          "Entrepôts et récolte",
          this.cases("Ressources", ["remplissageEntrepots", "bilanRecolte"]) +
            BoiteParametre.methodeEntrepots(),
        )}
      </form>`);
    this.majEtiquettes();
    return this;
  }
  /**
   * Méthode des calculs de l'encart « S5 Pseudo » et du bilan de la page
   * Ressources (Entrepots.js), repliée (demande du mainteneur, 16/11/2026).
   *
   * @static
   * @method methodeEntrepots
   * @return {String} HTML
   */
  static methodeEntrepots() {
    let liste = (/** @type {Array<String>} */ l) =>
      `<ul class='o_methode'>${l.map((x) => `<li>${x}</li>`).join("")}</ul>`;
    return `<details class='o_aidePlus o_aideParam left'><summary>Méthode de calcul</summary>
      <p><b>Temps avant que l'entrepôt soit plein</b> (encart « S5 pseudo » et son info-bulle), recalculé à chaque page, la ligne mise à jour chaque minute :</p>
      ${liste([
        "départ : le stock de l'encart ; capacité de l'entrepôt : 500 + 1 200 × 2<sup>niveau</sup> (niveau lu sur la page Construction ; sinon d'après le « rempli à N % » de l'encart) ;",
        "un entrepôt en construction (vu dans l'encart Compte+ du jeu ou sur la page Construction) prend un niveau à la fin de sa construction : sa capacité devient 2 × capacité − 500 ; il reste compté après, jusqu'à ce que la page Construction donne son nouveau niveau ;",
        "à chaque récolte du jeu, toutes les 30 min (heure lue sur la page Ressources), le 48<sup>e</sup> de la production du jour : la récolte du terrain couvert par tes ouvrières (1 par ouvrière au travail) et ta champignonnière, moins la consommation de ton armée ; sans heure de récolte connue, la production est étalée sur la journée ;",
        "si tu es vassal, la part de ton seigneur est prise à chaque récolte sur le terrain et la champignonnière, au pourcentage que donne la page Ressources (« X vous pille … ») ;",
        "les convois qui arrivent, à leur arrivée : avec le Compte+, ceux de ta dernière visite de la page Convois ; sans, le jeu ne les montre pas : ceux que leurs expéditeurs ont transmis au site de suivi, notés dans le sujet commun des convois du forum de l'alliance, lus à l'ouverture des pages Construction et Laboratoire ;",
        "pas compté : le terrain que rapporteront tes chasses et tes floods en cours, ce que tu pilles sur tes colonies (montré dans l'info-bulle), la nourriture rapportée par les chasses, les floods reçus, ce que coûteront les pontes, constructions et recherches que tu lanceras ;",
        "« Famine dans … » quand la nourriture tombe à zéro avant que l'entrepôt soit plein ; en rouge à moins de 8 h.",
      ])}
      <p><b>Ressources d'une construction ou d'une recherche</b> (pages Construction et Laboratoire : temps affiché sous le coût, à la place de celui du Compte+, et détail au survol du coût) : le même calcul, jusqu'au coût plutôt que jusqu'à la capacité ; la page Convois y est relue à l'ouverture de la page ; un cycle est une récolte du jeu, toutes les 30 min ; un coût plus grand que l'entrepôt demande d'abord le niveau d'entrepôt indiqué (« REQUIS »).</p>
      <p><b>Bilan de la récolte</b> (page Ressources, sous le bloc « Récoltes »), par jour :</p>
      ${liste([
        "récolte du terrain + champignonnière − consommation de l'armée − pillage subi + pillage de tes colonies ;",
        "pillage de tes colonies : 20 % + 1 % par niveau de ton Étable à pucerons, sur le TdC de chaque colonie × 48, compté en matériaux, et sur sa champignonnière (72 × 1,7<sup>niveau</sup> par jour), en nourriture ;",
        "colonies et leur TdC : export public des joueurs, à l'heure près ; niveau de leur champignonnière : fichier « Stats membres » de l'alliance, relu une fois par jour (une colonie absente du fichier compte sans champignonnière).",
      ])}
    </details>`;
  }
  /**
   * Armée : affichages de la page, replacement et antisondes.
   *
   * @method ongletArmee
   */
  ongletArmee() {
    let p = monProfil.parametre;
    ["uniteAntisondeTerrainType", "uniteAntisondeDomeType"].forEach(
      (cle) => (p[cle].valeurPossible = ["Première disponible", ...NOM_UNITE.slice(1)]),
    );
    $("#o_tabsParametreArmee").append(`<form>
        ${this.section(
          "Affichages de la page",
          this.cases("Armee", ["armeeMiseEnPage", "armeeStatistiques", "listeAttaques"]),
        )}
        ${this.section(
          "Replacer l'armée",
          this.caseAffichage("replacerArmee") +
            p["replacerArmeeAuto"].getForm(
              "Signaler une armée à replacer à l'ouverture de la page Armée",
            ),
        )}
        ${this.section(
          "Antisondes <span class='o_aideParam'>(nombre tiré entre 90 % du max et le max)</span>",
          `<div class='o_grilleParam o_grille2'>${p["uniteAntisondeTerrain"].getForm("Max en terrain")}${p["uniteAntisondeTerrainType"].getForm("Unité")}${p["uniteAntisondeDome"].getForm("Max en dôme")}${p["uniteAntisondeDomeType"].getForm("Unité")}</div>` +
            this.aide(
              `Pour le replacement de l'armée et les unités gardées au flood (${this.lienOnglet("Attaque", "onglet Attaque")}).`,
            ),
        )}
      </form>`);
    return this;
  }
  /**
   * Attaque : affichages des pages d'attaque, lanceur de flood, unités
   * gardées et sonde.
   *
   * @method ongletAttaque
   */
  ongletAttaque() {
    let p = monProfil.parametre;
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
    $("#o_tabsParametreAttaque").append(`<form>
        ${this.section("Affichages de la page", this.cases("Attaque", ["couleurAttaquer", "statArmee"]))}
        ${this.section(
          "Lanceur de Flood",
          this.caseAffichage("lanceurFlood") +
            p["methodeFlood"].getForm("Méthode de flood par défaut") +
            p["floodAttaques"].getForm("Nombre d'attaques proposées") +
            p["degressifBase"].getForm(
              "Dégressive : 1re attaque",
              "<span class='o_aideParam'>% du TdC de la cible</span>",
            ) +
            p["degressifRegle"].getForm("Dégressive : attaques suivantes") +
            p["floodImpactAuto"].getForm(
              "TdC à l'impact dès l'ouverture",
              "<span class='o_aideParam'>sans clic, mis dans les champs ; une valeur tapée est gardée</span>",
            ),
        )}
        ${this.section(
          "Unités gardées au flood <span class='o_aideParam'>(par défaut, modifiables à chaque attaque)</span>",
          this._gardees.html() +
            this.aide(`Nombre d'antisondes : ${this.lienOnglet("Armee", "onglet Armée")}.`),
        )}
        ${this.section(
          "Sonder",
          p["sondeUnite"].getForm("Unité envoyée en sonde") +
            p["sondeQuantite"].getForm("Nombre d'unités (au plus)") +
            p["sondeLieu"].getForm("Lieu de sonde"),
        )}
      </form>`);
    return this;
  }
  /**
   * Messagerie : liste des messages, couleurs des titres, rapports, écriture.
   *
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
        ${this.section(
          "Liste des messages",
          this.cases("Messagerie", ["messagerieRanger", "messagerieCompacte", "messagerieNonLus"]),
        )}
        ${this.section(
          "Couleurs des titres <span class='o_aideParam'>(couleur décochée : celle du jeu)</span> <button type='button' id='o_couleursMessagesDefaut' class='o_button'>Par défaut</button>",
          this.caseAffichage("messagerieCouleurs") + `<div class='o_grilleParam'>${couleurs}</div>`,
        )}
        ${this.section(
          "Rapports",
          this.cases("Messagerie", ["messagerieCopie", "messagerieAnalyse", "messagerieExport"]),
        )}
        ${this.section(
          "Écrire un message",
          this.cases("Messagerie", [
            "messagerieMiseEnForme",
            "messagerieSmileys",
            "messagerieSmileysAlliance",
          ]),
        )}
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
    let $zone = $("#o_exportSheetReglage").addClass("o_sectionParam").html(`
        <p class='o_titreParam'>Adresse de ton Google Sheet</p>
        <p id='o_exportSheetEtat' class='left small'></p>
        <p class='left small'><em>Pour exporter tes rapports (boutons « Exporter mes chasses » et « Exporter mes RC »), renseigne l'adresse du script de ton propre Google Sheet. Elle reste dans ton navigateur. Les joueurs de la ligne « ${REGLAGES_ALLIANCE.autorisesRc.nom} » du sujet « ${TITRE_REGLAGES} » (forum caché) n'ont rien à régler.</em></p>
        <p class='left small o_reglage'><label for='o_exportSheet'>Adresse du script :</label>
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
   * Convois : suivi de la page Convois, convoi avant la récolte, et mot de
   * passe du site de suivi des convois de l'alliance (seul endroit où il se
   * renseigne). Il est gardé dans le stockage de l'extension, que le jeu ne
   * peut pas lire, et n'est placé dans le champ que si le joueur clique
   * « Afficher ».
   *
   * @method ongletConvois
   */
  ongletConvois() {
    let site = OuafSuivi.site();
    if (!site) {
      $("#o_tabsParametreConvois").append(
        `<p class='left'>Aucun site de suivi des convois dans les réglages de ton alliance : un chef l'écrit sur la ligne « ${REGLAGES_ALLIANCE.siteConvois.nom} » du sujet « ${TITRE_REGLAGES} » (${this.lienOnglet("Partage", "onglet Partage de données")}, section « Fonctionnement sur les autres serveurs »).</p>`,
      );
      return this;
    }
    $("#o_tabsParametreConvois").append(`<form autocomplete='off'>
        ${this.section(
          `Suivi des convois de l'alliance ${this.etiquette("Grenier")}`,
          `${this.cases("Convois", ["convoisSuiviLignes"])}
            <p class='left small'>Site (réglages de l'alliance) : <a href='${Utils.echapper(site.url)}' target='_blank' rel='noopener'>${Utils.echapper(site.hote)}</a> <span id='o_siteConvoisEtat'></span></p>
            <p class='left small o_reglage'><label for='o_ouafCode'>Mot de passe du site de suivi :</label>
              <input type='password' id='o_ouafCode' autocomplete='new-password' spellcheck='false' style='width:12em'/>
              <button type='button' id='o_ouafCodeVoir' class='o_button' title='Afficher le mot de passe enregistré'>👁 Afficher</button>
              <button type='button' id='o_ouafCodeEnregistrer' class='o_button f_success'>Enregistrer</button>
              <button type='button' id='o_ouafCodeEffacer' class='o_button f_error'>Effacer</button></p>
            <p id='o_ouafCodeEtat' class='left small'></p>
            <p id='o_profilSiteEtat' class='left small'></p>
            ${this.aide(
              "Le mot de passe reste dans ton navigateur, dans l'espace privé de l'extension.",
              "Il n'est envoyé qu'au site de suivi, une fois ce site accepté : pour « 📤 Envoyer au suivi » à côté d'un convoi, la colonne « Convoi à faire » du Récapitulatif (avec les avances demandées sur la page Avances du site), le lien « Ouvrir le site de suivi des convois » et la mise à jour de ton profil sur le site (niveaux de l'Étable à pucerons et de la Champignonnière, nombre total d'ouvrières, convois compris), une fois par jour et quand l'un de ces deux niveaux change. Si les réglages de l'alliance donnent un autre site et que tu l'acceptes, ce mot de passe est effacé : il ne part pas vers le nouveau site.",
            )}`,
        )}
        ${this.section(
          `Récapitulatif : joueur qui ne veut pas de convois ${this.etiquette("Grenier")}`,
          `<p class='left small'>Le montrer par (une case ou plusieurs) :</p>${this.cases("Convois", MARQUES_SANS_RECEPTION)}` +
            this.aide(
              "",
              "Ligne barrée, ligne en rouge, colonne « Statut des stocks » : « ⚠️ Plein ⚠️ » pour ce joueur, « ✅ » s'il accepte, « (+avance) » en vert et en gras s'il a demandé une avance sur la page Avances du site (après « ⚠️ Plein ⚠️ » s'il ne veut pas de convois), « — » quand le site ne le dit pas (aucun convoi prévu vers lui). Aucune case cochée : rien n'est signalé. Lu avec la colonne « Convoi à faire » à l'ouverture de la page Convois, mot de passe du site enregistré : rien de plus n'est demandé au site. Les montants restent ceux du site, et un clic sur un montant remplit toujours le convoi. Sur téléphone, la colonne élargit le tableau ; la ligne barrée ou rouge ne prend pas de place.",
            ),
        )}
        ${this.section(
          `Convoi avant la récolte ${this.etiquette("Grenier")}`,
          monProfil.parametre["convoisAvantRecolte"].getForm(
            "Compter les ouvrières qui reviennent de convoi avant la récolte",
          ) +
            this.aide(
              "Efficace seulement avec le Compte+ réglé sur l'affectation automatique Nourriture ou Matériaux (page Ressources) : les ouvrières qui arrivent y sont mises au travail d'elles-mêmes.",
              "Au clic sur un montant du Récapitulatif (page Convois), l'extension lit tes pages Ressources (prochaine récolte, ouvrières, TdC, chasses en cours) et Armée (tes floods en cours, quand l'encart Compte+ en montre). À chaque récolte où le convoi envoyé est dehors, ouvrières disponibles = ouvrières présentes + celles d'un convoi qui rentre au moins une minute avant la récolte − ton TdC − le terrain de tes chasses et de tes floods arrivés avant la récolte (prise calculée comme dans « Mes attaques en cours »). Le plus petit résultat est retenu ; un convoi qui revient au moins une minute avant la prochaine récolte peut emmener toutes tes ouvrières. Le calcul vaut pour un convoi lancé dans les 5 minutes. Par prudence, les floods que tu reçois et les ouvrières pondues ne comptent pas. Sans Compte+, ou réglé sur la croix ou « Ratio », il faut affecter soi-même celles qui reviennent avant chaque récolte.",
            ),
        )}
      </form>`);
    this.majEtiquettes();
    // Entrée dans un champ ne doit pas envoyer ce formulaire : la page se rechargerait
    $("#o_tabsParametreConvois form").on("submit", (e) => e.preventDefault());
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
    let accord = () =>
        OuafSuivi.siteAccepte().then((ok) =>
          $("#o_siteConvoisEtat").html(
            ok
              ? "<span class='green'>(accepté)</span>"
              : "<button type='button' id='o_siteConvoisAccepter' class='o_button f_info'>Accepter ce site</button>",
          ),
        ),
      profil = () =>
        Promise.all([OuafSuivi.siteAccepte(), OuafSuivi.codeEnregistre()]).then(([ok, code]) =>
          $("#o_profilSiteEtat").text(ProfilConvois.resume(ok, code)),
        );
    accord();
    profil();
    $("#o_tabsParametreConvois").on("click", "#o_siteConvoisAccepter", () =>
      OuafSuivi.accepterSite()
        .then(() => ProfilConvois.reprendre())
        .then(accord)
        .then(profil)
        .then(() => OuafSuivi.codeEnregistre())
        .then(etat),
    );
    OuafSuivi.codeEnregistre().then(etat);
    $("#o_ouafCodeEnregistrer").on("click", () => {
      let code = String($("#o_ouafCode").val() || "").trim();
      if (!code) return;
      OuafSuivi.enregistrerCode(code).then(() => {
        masquer();
        $("#o_ouafCode").removeClass("o_champSignale");
        etat(code);
        ProfilConvois.reprendre();
        profil();
      });
    });
    $("#o_ouafCodeEffacer").on("click", () =>
      OuafSuivi.enregistrerCode("").then(() => {
        masquer();
        etat("");
        profil();
      }),
    );
    $("#o_ouafCodeVoir").on("click", () => {
      if ($("#o_ouafCode").attr("type") == "text") return masquer();
      OuafSuivi.codeEnregistre().then((code) => {
        if (!code) return etat("");
        $("#o_ouafCode").attr("type", "text").val(code);
        $("#o_ouafCodeVoir").text("🙈 Masquer").attr("title", "Masquer le mot de passe");
      });
    });
    return this;
  }
  /**
   * Préférences → Partage de données : ce qu'une alliance règle dans son forum
   * pour que l'extension marche chez elle, sur n'importe quel serveur.
   *
   * @static
   * @method autresServeurs
   * @return {String}
   */
  static autresServeurs() {
    let lignes = {
      siteConvois: "adresse du site de suivi des convois de l'alliance (page Convois)",
      feuilleRc:
        "adresse du script du Google Sheet qui reçoit les RC (https://script.google.com/macros/s/…/exec)",
      autorisesRc:
        "pseudos des joueurs qui exportent leurs RC vers ce Google Sheet sans rien régler, séparés par des virgules",
      feuilleStats: "adresse du script du Google Sheet du relevé quotidien des stats membres",
      chefs:
        "pseudos des chefs : dans la vue « Stats membres » (menu Alliance), ils voient le pseudo de chaque joueur et son TdC ; les autres membres, les mêmes informations sans pseudo, sauf le leur",
      chasseurs: "pseudos des chasseurs : rôle Chasseur par défaut",
      greniers: "pseudos des greniers : rôle Grenier et réglages des greniers par défaut",
      journal:
        "pseudos de ceux qui ont le journal de l'extension et les boutons qui rangent le forum",
    };
    let serveur = location.hostname.split(".")[0];
    return (
      `<label class='o_affichageFzzz'><input type='checkbox' id='o_sansConfigAlliance' ${Utils.sansConfigAlliance() ? "checked" : ""}/> Sans config alliance sur ce serveur (${Utils.echapper(serveur)})</label>` +
      BoiteParametre.prototype.aide(
        "À cocher si ton alliance n'a pas réglé l'extension sur ce serveur : rien n'est lu ni écrit dans son forum, et les fonctions qui servent seulement à plusieurs disparaissent. Pris en compte à la page suivante.",
        `Cochée, sur ce serveur seulement : les réglages de l'alliance ne sont ni lus ni utilisés (site de suivi des convois, Google Sheet de l'alliance, listes de joueurs) ; aucun partage (boutons « Partager » et « + partager » retirés ; le Multi-flood opti a un bouton « Lancer », sans partage) ; ni GIF ni smileys de l'alliance (« Mes GIF » reste) ; ni vue « Stats membres », ni vue « Floods et chasses en cours » de la page Membres, ni synthèse des partages sur la page d'un membre, ni alerte des floods qui arrivent sur toi. Le TdC à l'impact et le Multi-flood ne comptent alors que tes propres chasses et attaques. Tes rapports s'exportent vers ton propre Google Sheet (adresse ci-dessus). Tout le reste marche comme avant.`,
      ) +
      BoiteParametre.prototype.aide(
        `L'extension marche sur les serveurs s1 à s5. Ce qui est propre à une alliance (adresses de ses sites et de ses fichiers, listes de joueurs) ne s'écrit jamais dans l'extension : un chef le note dans le forum de l'alliance, section cachée « ${FORUM_SECTIONS_CHASSES[0]} » (à créer, visible des grades concernés).`,
        `<b>Sujet « ${TITRE_REGLAGES} »</b> : dans son premier message, une ligne par réglage, « Nom : valeur » (casse et accents sans importance) ; une liste peut continuer sur les lignes suivantes, jusqu'à une ligne vide. Personne n'y répond. Une ligne absente coupe ce qu'elle règle. Ce message dit où partent les données des joueurs : ne le rends pas modifiable par tous les membres (chaque joueur accepte lui-même le site de suivi des convois).<ul>${Object.entries(
          lignes,
        )
          .map(([cle, texte]) => `<li>« ${REGLAGES_ALLIANCE[cle].nom} : … » : ${texte}</li>`)
          .join(
            "",
          )}</ul><b>Sujets « ${SUJETS_COMMUNS.Floods} », « ${SUJETS_COMMUNS.Chasses} » et « ${SUJETS_COMMUNS.Convois} »</b> : créés à la main ; l'extension de chaque joueur y écrit sa réponse avec ses floods, ses chasses et ses convois en cours (un convoi y est noté quand il est transmis au site de suivi). <b>Sujets « ${TITRE_GIF_ALLIANCE} » et « ${TITRE_SMILEYS_ALLIANCE} »</b> : les images de leur premier message, pour les chats, la messagerie et le forum. Chaque joueur règle ici son propre Google Sheet s'il n'est pas dans la liste des RC, et dans l'onglet Convois le mot de passe du site de suivi. Les réglages sont relus au plus une fois par heure, et quand une fonction en a besoin.`,
      ) +
      "<p id='o_reglagesEtat' class='left small'></p><p class='left o_reglage'><button type='button' class='o_button f_info o_reglagesRelire'>Relire les réglages</button></p>"
    );
  }
  /**
   * Alliance : page Membres de l'alliance, chats et forum.
   *
   * @method ongletAlliance
   */
  ongletAlliance() {
    $("#o_tabsParametreAlliance").append(`<form>
        ${this.section(
          "Membres de l'alliance",
          this.cases("Alliance", ["membresTableau", "membresFloods", "membresMoi"]) +
            monProfil.parametre["vueMembres"].getForm(
              "Vue par défaut de la page Membres de l'alliance",
            ),
        )}
        ${this.section(
          "Colonnes de la vue « Floods et chasses en cours »",
          this.cases("Alliance", MEMBRES_COLONNES_FLOODS) +
            this.aide(
              "Aucune colonne cochée : le pseudo seul.",
              "Prochain mouvement : la première minute où le TdC du membre change d'après les floods et chasses partagés (minute du rapport de combat), ceux de cette minute comptés ensemble (multi-flood) ; sa variation est leur somme. Les floods hors portée, sans effet sur le TdC, ne comptent pas. Temps de trajet : à ta Vitesse d'attaque (page Laboratoire), avec les coordonnées gardées par l'extension (Carte de l'alliance, sinon export des joueurs du jeu, lu une fois si besoin). Retour : minute du rapport d'une attaque partie au chargement de la page, avec ce temps de trajet, comme la vue « Temps de trajet ». État de la colonie : le contenu de la colonne « Etat » du tableau du jeu, en dernière colonne.",
            ),
        )}
        ${this.section("Chats", this.cases("Alliance", ["chatMesGif", "chatGifAlliance", "chatSmileysAlliance"]))}
        ${this.section("Forum de l'alliance", this.cases("Alliance", ["forumGif", "forumSmileysAlliance"]))}
      </form>`);
    return this;
  }
  /**
   * Partage de données : une case par information relevée chaque jour pour le
   * fichier de l'alliance (SuiviMembres), puis l'export automatique des
   * chasses (ExportAuto) et son rappel, les boutons d'export des rapports,
   * utilisables de toutes les pages, et l'adresse du Google Sheet personnel.
   *
   * @method ongletPartage
   */
  ongletPartage() {
    let $onglet = $("#o_tabsParametrePartage").append(`<form>
        ${this.section(
          "Statistiques des membres",
          this.aide(
            "",
            `Les chefs (ligne « ${REGLAGES_ALLIANCE.chefs.nom} » du sujet « ${TITRE_REGLAGES} ») voient ce que tu partages avec ton pseudo ; les autres membres le voient sans ton pseudo, mêlé à ce que partagent les autres joueurs. Champignonnière et Puceron sont toujours partagés. Elle refait le relevé à la première page ouverte après un changement de niveau de ta Champignonnière ou de ton Étable à pucerons. Sans Compte+, la page Reine ne donne ni le total des ouvrières ni l'armée complète : l'extension compte les ouvrières présentes et celles de tes convois en cours (page Convois), et ton armée en garnison (page Armée) avec les troupes parties en chasse ou en attaque depuis ce navigateur ; tant qu'une chasse ou une attaque lancée ailleurs (autre appareil) est en cours, l'armée ne peut pas être relevée et le relevé est réessayé plus tard. L'adresse du fichier est lue dans le forum caché de l'alliance (ligne « ${REGLAGES_ALLIANCE.feuilleStats.nom} » du sujet « ${TITRE_REGLAGES} ») : sans elle, rien n'est relevé ni envoyé. Chaque jour, l'extension envoie aussi au même fichier (onglet « Réglages extension ») les réglages de l'extension dans ce navigateur : version, appareil, pages et affichages cochés, choix des Préférences ; jamais d'adresse ni de mot de passe. ${DONNEES_PARTAGEES.map((d) => d.libelle).join(" ; ")}.`,
          ) +
            SuiviMembres.casesPartage("o_partageLigne") +
            `<p id='o_partageEtat' class='left small'></p>
            <p class='left o_reglage'><button type='button' id='o_partageEnvoyer' class='o_button'>Envoyer maintenant</button></p>`,
        )}
        ${this.section(
          "Journal de débug",
          `<label class='o_affichageFzzz'><input type='checkbox' id='o_partageJournal' ${EnvoiJournal.coche() ? "checked" : ""}/> Envoyer mon journal de débug les jours où il contient une erreur</label>` +
            this.aide(
              "",
              `Au plus une fois par jour, à une page que tu ouvres : les notes du journal depuis le dernier envoi, à l'onglet « Journal » du Google Sheet des stats membres de l'alliance. Rien n'est envoyé les jours sans erreur. Les adresses des fichiers Google et les mots de passe sont masqués. L'adresse du fichier est celle de la ligne « ${REGLAGES_ALLIANCE.feuilleStats.nom} » du sujet « ${TITRE_REGLAGES} » : sans elle, rien n'est envoyé. Le bouton « Copier le journal de débug » est dans l'${this.lienOnglet("General", "onglet Général")}.`,
            ),
        )}
        ${this.section(
          "Rapports de chasse et de combat",
          `<label class='o_affichageFzzz'><input type='checkbox' id='o_partageChasses' ${ExportAuto.coche() ? "checked" : ""}/> Exporter mes chasses automatiquement${this.etiquette("Chasseur")}</label>` +
            this.aide(
              "Deux fois par semaine au plus : à ton premier clic sur « Envoyer » ou « Envoyer + partager » du lanceur de chasses après le mercredi ou le dimanche 22h (heure du serveur), l'extension lit les rapports de chasse de ta messagerie pas encore exportés et les envoie au Google Sheet où tu exportes tes rapports.",
              "Elle le fait une fois les chasses envoyées et après toutes ses autres demandes au jeu ; ceux que tu n'avais pas lus restent marqués non lus. Sans ce clic (chasses lancées avec le formulaire du jeu), rien n'est exporté automatiquement. Le bouton « Exporter mes chasses » ci-dessous reste, pour un export immédiat. Le rappel « Export des chasses à faire » ne s'affiche que si un essai échoue. Décochée : rien n'est lu ni envoyé sans ton clic sur ce bouton, et le rappel s'affiche dès le mercredi et le dimanche 22h.",
            ) +
            `<p id='o_partageChassesEtat' class='left small'></p>` +
            this.cases("Partage") +
            `<p class='left o_reglage'><button type='button' class='o_button f_info o_exporterRapports' data-quoi='chasse'>Exporter mes chasses</button> <button type='button' class='o_button f_info o_exporterRapports' data-quoi='combat'>Exporter mes RC</button></p>` +
            this.aide(
              "Les conversations de ta boîte de réception dont un rapport manque au Google Sheet où tu exportes tes rapports sont lues une à une, puis envoyées.",
              `Chasses (onglet « ${EXPORTS_RAPPORTS.chasse.onglet} ») ; attaques (« ${EXPORTS_RAPPORTS.attaque.onglet} »), défenses (« ${EXPORTS_RAPPORTS.defense.onglet} ») et floods avec les membres de l'alliance (« ${EXPORTS_RAPPORTS.interne.onglet} »). Les mêmes boutons peuvent aussi s'afficher dans la messagerie (${this.lienOnglet("Messagerie", "onglet Messagerie")}).`,
            ),
        )}
        <div id='o_exportSheetReglage'></div>
        ${this.section("Fonctionnement sur les autres serveurs", BoiteParametre.autresServeurs())}
      </form>`),
      // seulement ce qui a empêché le relevé, ou le résultat de « Envoyer maintenant »
      etat = (message = "") =>
        $onglet.find("#o_partageEtat").text(message || SuiviMembres.probleme()),
      etatChasses = () => $onglet.find("#o_partageChassesEtat").text(ExportAuto.resume());
    this.reglageExport().majEtiquettes();
    etat();
    etatChasses();
    let etatReglages = () => {
      $onglet.find("#o_reglagesEtat").text(ReglagesAlliance.resume());
      $onglet.find(".o_reglagesRelire").prop("disabled", Utils.sansConfigAlliance());
    };
    etatReglages();
    $onglet.find("#o_sansConfigAlliance").on("change", (e) => {
      Utils.choisirSansConfigAlliance(e.currentTarget.checked);
      etatReglages();
    });
    $onglet.find(".o_reglagesRelire").on("click", (e) => {
      let $b = $(e.currentTarget).prop("disabled", true);
      ReglagesAlliance.charger({}, "tout")
        .then(etatReglages, () =>
          $onglet
            .find("#o_reglagesEtat")
            .text("Le forum de l'alliance n'a pas pu être lu : réessaie dans un instant."),
        )
        .then(() => $b.prop("disabled", false));
    });
    $onglet
      .find("#o_partageJournal")
      .on("change", (e) => EnvoiJournal.choisir(e.currentTarget.checked));
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
    // les mêmes cases que la vue « Stats membres », qui suivent si elle est ouverte
    SuiviMembres.majCases();
    SuiviMembres.brancherCases();
    $(document)
      .off("o_partageChoisi.preferences")
      .on("o_partageChoisi.preferences", () => etat());
    $onglet.find("#o_partageEnvoyer").on("click", (e) => {
      e.preventDefault();
      let $bouton = $(e.currentTarget).prop("disabled", true);
      etat("Relevé et envoi en cours…");
      SuiviMembres.lancer(true).then((resultat) => {
        $bouton.prop("disabled", false);
        etat(
          resultat == "envoyé"
            ? SuiviMembres.probleme() || "Relevé envoyé."
            : resultat == "sans alliance"
              ? "Sans alliance, rien n'est relevé."
              : "",
        );
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
        ${this.section(
          "Pages où l'extension agit <span class='o_aideParam'>(décochée : la page reste telle que le jeu l'affiche, au prochain chargement)</span>",
          PAGES_EXTENSION.map(
            (g) =>
              `<label class='o_affichageFzzz'><input type='checkbox' data-page='${g.id}' ${Utils.origine(g.id) ? "" : "checked"}/> ${g.libelle}</label>`,
          ).join(""),
        )}
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
      ${this.section(
        "Réinitialiser les réglages",
        `<p class='left small'><em>Remet les réglages chiffrés ou à choix à leur valeur par défaut : rôle, alerte de ponte, répartition des ouvrières, lanceur de chasses, antisondes, signalement de l'armée à replacer, flood, unités gardées, sonde, vue de la page Membres, convoi avant la récolte. Les cases d'affichage, de pages et de partage et les couleurs des messages ne changent pas. La page sera rechargée.</em></p>
        <p class='left o_reglage'><button id='o_resetParametres' class='o_button f_error'>Réinitialiser</button></p>`,
      )}
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
          MiseAJour.ouvrir(r.url || SCRIPT_UTILISATEUR, Dock.violentmonkey());
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
