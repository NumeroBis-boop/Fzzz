// @ts-check
/*
 * SuiviMembres.js
 * Partage de données : relevé quotidien des statistiques du joueur pour le
 * Google Sheet « Stats membres » de son alliance, refait quand le niveau de
 * sa Champignonnière ou de son Étable à pucerons change.
 **********************************************************************/

/**
 * Informations que le joueur peut partager, une case chacune dans Préférences →
 * Partage de données ; les clés sont celles du script du fichier
 * (google-sheet/stats-membres.gs).
 */
const DONNEES_PARTAGEES = [
  { cle: "tdp", titre: "TdP", libelle: "TdP : Couveuse + Solarium + Technique de ponte" },
  {
    cle: "cdf",
    titre: "CdF",
    libelle: "CdF : nombre total d'unités de ton armée, ouvrières non comptées",
  },
  { cle: "fdfHB", titre: "FdF HB", libelle: "FdF HB : force de frappe de ton armée, hors bonus" },
  {
    cle: "fdfAB",
    titre: "FdF AB",
    libelle: "FdF AB : force de frappe avec le bonus de la recherche Armes",
  },
  { cle: "va", titre: "VA", libelle: "VA : niveau de Vitesse d'attaque" },
  { cle: "vc", titre: "VC", libelle: "VC : niveau de Vitesse de chasse" },
  { cle: "puceron", titre: "Puceron", libelle: "Puceron : niveau de l'Étable à pucerons" },
  { cle: "champignonniere", titre: "Champignonnière", libelle: "Champignonnière : niveau" },
  {
    cle: "ouvrieres",
    titre: "Ouvrières",
    libelle: "Ouvrières : nombre total, y compris celles parties en convoi",
  },
];
// ordre des informations dans la vue « Stats membres » et les cases du partage
// (mainteneur, 18/11/2026) ; une information qui n'y est pas va à la fin
const ORDRE_STATS = [
  "tdp",
  "ouvrieres",
  "cdf",
  "fdfHB",
  "fdfAB",
  "va",
  "vc",
  "champignonniere",
  "puceron",
];
const TITRES_COURTS_STATS = { ouvrieres: "Ov", champignonniere: "Champi" };
// toujours partagées avec les chefs (règle du mainteneur, 18/11/2026) : leur case reste cochée
const DONNEES_OBLIGATOIRES = ["champignonniere", "puceron"];
// « Partagé avec les chefs » décochée : "0" ; cochée par défaut
const CLE_PARTAGE = "fzzz_partage_";
// « Partagé avec les autres » décochée : "0" ; jamais choisie, comme celle des chefs
const CLE_PARTAGE_AUTRES = "fzzz_partageAutres_";
// par pseudo : jour du dernier relevé tenté, s'il est fait, essais du jour,
// annonce déjà montrée, dernier envoi, construction suivie en cours
const CLE_SUIVI_MEMBRES = "fzzz_suiviMembres";
// relevé qui échoue (jeu, forum ou fichier sans réponse) : nouvel essai à une
// page ouverte plus tard, jamais à chaque page
const SUIVI_ESSAIS_PAR_JOUR = 3;
const SUIVI_PAUSE_ESSAIS = 3600 * 1000;
const JOURNAL_SUIVI = "Partage de données";
// pages du jeu où se lit chaque information
const SUIVI_CONSTRUCTION = ["tdp", "puceron", "champignonniere"];
const SUIVI_LABORATOIRE = ["tdp", "va", "vc", "fdfAB"];
const SUIVI_ARMEE = ["cdf", "fdfHB", "fdfAB"];
const SUIVI_REINE = ["ouvrieres"];
// niveaux dont le changement fait refaire le relevé du jour sans attendre le
// lendemain (demande du mainteneur) : information partagée → nom du bâtiment
const SUIVI_NIVEAUX_SUIVIS = { champignonniere: "champignonniere", puceron: "etable a pucerons" };
// la fin d'une construction est estimée (heure du serveur à la seconde près,
// délai d'affichage de la page) : écart toléré
const SUIVI_ECART_FIN = 30 * 1000;

/**
 * Une fois par jour, à la première page que le joueur ouvre, ses informations
 * cochées sont relevées (pages Construction, Laboratoire et Reine, lues une
 * fois chacune ; sans Compte+, Convois, Armée et Ressources au lieu des champs
 * de la page Reine) et envoyées au script du fichier de l'alliance, dont l'adresse
 * est dans le sujet des réglages de l'alliance (ReglagesAlliance) : sans elle,
 * rien n'est lu ni envoyé. Une information décochée n'est ni relevée ni
 * envoyée ; le fichier reçoit seulement le fait qu'elle n'est pas partagée.
 * Le relevé du jour est refait à la première page ouverte après un changement
 * de niveau de SUIVI_NIVEAUX_SUIVIS (observer).
 *
 * Règles s5 : tout part de l'ouverture d'une page par le joueur, une fois par
 * jour et une fois par changement de niveau ; aucune minuterie, aucune requête
 * répétée.
 *
 * @class SuiviMembres
 */
class SuiviMembres {
  /**
   * @private
   * @static
   * @param {String} prefixe
   * @param {String} cle
   * @return {String|null} choix gardé
   */
  static _choix(prefixe, cle) {
    try {
      return localStorage.getItem(prefixe + cle);
    } catch (e) {
      return null;
    }
  }
  /**
   * @private
   * @static
   * @param {String} prefixe
   * @param {String} cle
   * @param {Boolean} coche
   */
  static _garderChoix(prefixe, cle, coche) {
    try {
      localStorage.setItem(prefixe + cle, coche ? "1" : "0");
    } catch (e) {}
  }
  /**
   * @static
   * @method partageAutres
   * @param {String} cle clé de DONNEES_PARTAGEES
   * @return {Boolean} case « Partagé avec les autres » cochée : tous les membres la voient
   */
  static partageAutres(cle) {
    let autres = SuiviMembres._choix(CLE_PARTAGE_AUTRES, cle);
    // jamais choisie : cochée, sauf pour une information que le joueur ne partageait déjà plus
    return autres != null ? autres != "0" : SuiviMembres._choix(CLE_PARTAGE, cle) != "0";
  }
  /**
   * @static
   * @method partage
   * @param {String} cle clé de DONNEES_PARTAGEES
   * @return {Boolean} case « Partagé avec les chefs » cochée : l'information est relevée et envoyée
   */
  static partage(cle) {
    return (
      DONNEES_OBLIGATOIRES.includes(cle) ||
      SuiviMembres.partageAutres(cle) ||
      SuiviMembres._choix(CLE_PARTAGE, cle) != "0"
    );
  }
  /**
   * @static
   * @method partages
   * @return {Record<String, Boolean>} chaque information : partagée ou non
   */
  static partages() {
    /** @type {Record<String, Boolean>} */
    let partages = {};
    DONNEES_PARTAGEES.forEach((d) => (partages[d.cle] = SuiviMembres.partage(d.cle)));
    return partages;
  }
  /**
   * @static
   * @method partagesAutres
   * @return {Record<String, Boolean>} chaque information : partagée avec les autres membres ou non
   */
  static partagesAutres() {
    /** @type {Record<String, Boolean>} */
    let publics = {};
    DONNEES_PARTAGEES.forEach((d) => (publics[d.cle] = SuiviMembres.partageAutres(d.cle)));
    return publics;
  }
  /**
   * Case « Partagé avec les chefs » cochée ou décochée par le joueur : le
   * fichier le saura à la prochaine page ouverte, sans attendre le lendemain.
   *
   * @static
   * @method choisir
   * @param {String} cle
   * @param {Boolean} coche
   */
  static choisir(cle, coche) {
    if (DONNEES_OBLIGATOIRES.includes(cle)) return;
    SuiviMembres._garderChoix(CLE_PARTAGE, cle, coche);
    // plus partagée avec les chefs : plus avec personne
    if (!coche) SuiviMembres._garderChoix(CLE_PARTAGE_AUTRES, cle, false);
    SuiviMembres._garder({ ...SuiviMembres.etat(), fait: false, essais: 0, essai: 0, raison: "" });
  }
  /**
   * Case « Partagé avec les autres » cochée ou décochée : envoyée à la page
   * suivante comme celle des chefs.
   *
   * @static
   * @method choisirAutres
   * @param {String} cle
   * @param {Boolean} coche
   */
  static choisirAutres(cle, coche) {
    SuiviMembres._garderChoix(CLE_PARTAGE_AUTRES, cle, coche);
    // partagée avec les autres membres : aussi avec les chefs
    if (coche) SuiviMembres._garderChoix(CLE_PARTAGE, cle, true);
    SuiviMembres._garder({ ...SuiviMembres.etat(), fait: false, essais: 0, essai: 0, raison: "" });
  }
  /**
   * @static
   * @method ordonnees
   * @return {Array<{cle: String, titre: String, libelle: String}>} DONNEES_PARTAGEES dans l'ordre de la vue « Stats membres »
   */
  static ordonnees() {
    let rang = (/** @type {{cle: String}} */ d) => {
      let i = ORDRE_STATS.indexOf(d.cle);
      return i < 0 ? ORDRE_STATS.length : i;
    };
    return [...DONNEES_PARTAGEES].sort((a, b) => rang(a) - rang(b));
  }
  /**
   * @static
   * @method titreCourt
   * @param {{cle: String, titre: String}} d
   * @return {String} titre de sa colonne et de sa case
   */
  static titreCourt(d) {
    return TITRES_COURTS_STATS[d.cle] || d.titre;
  }
  /**
   * Les deux lignes de cases du partage, les mêmes dans Préférences → Partage
   * de données et dans la vue « Stats membres » ; majCases les coche.
   *
   * @static
   * @method casesPartage
   * @param {String} classe de chaque ligne
   * @return {String} HTML
   */
  static casesPartage(classe) {
    let ligne = (/** @type {String} */ niveau, /** @type {String} */ intitule) =>
      `<div class='${classe}'><span class='gras'>${intitule}</span>${SuiviMembres.ordonnees()
        .map(
          (d) =>
            `<label class='o_partageCase'><input type='checkbox' data-partage-${niveau}='${d.cle}'/> ${SuiviMembres.titreCourt(d)}</label>`,
        )
        .join("")}</div>`;
    return (
      ligne("chefs", "Partagé avec les chefs :") + ligne("autres", "Partagé avec les autres :")
    );
  }
  /**
   * Coche les cases du partage de la page d'après les choix gardés, et
   * verrouille celles des chefs qu'on ne peut pas décocher ; l'info-bulle dit
   * l'information et pourquoi.
   *
   * @static
   * @method majCases
   */
  static majCases() {
    let libelle = (/** @type {String} */ cle) =>
      (DONNEES_PARTAGEES.find((d) => d.cle == cle) || { libelle: cle }).libelle;
    $("input[data-partage-chefs]").each((/** @type {Number} */ i, /** @type {any} */ c) => {
      let cle = String(c.dataset.partageChefs),
        obligatoire = DONNEES_OBLIGATOIRES.includes(cle),
        parAutres = SuiviMembres.partageAutres(cle);
      c.checked = SuiviMembres.partage(cle);
      c.disabled = obligatoire || parAutres;
      $(c)
        .parent()
        .attr(
          "title",
          libelle(cle) +
            (obligatoire
              ? " (toujours partagé avec les chefs)"
              : parAutres
                ? " (partagé avec les chefs puisque partagé avec les autres)"
                : ""),
        );
    });
    $("input[data-partage-autres]").each((/** @type {Number} */ i, /** @type {any} */ c) => {
      let cle = String(c.dataset.partageAutres);
      c.checked = SuiviMembres.partageAutres(cle);
      $(c).parent().attr("title", libelle(cle));
    });
  }
  /**
   * Une case du partage changée, dans la vue ou les Préférences : le choix est
   * gardé, toutes les cases de la page suivent, puis l'événement
   * « o_partageChoisi » est lancé sur le document. Branché une fois.
   *
   * @static
   * @method brancherCases
   */
  static brancherCases() {
    $(document)
      .off("change.o_partage")
      .on(
        "change.o_partage",
        "input[data-partage-chefs], input[data-partage-autres]",
        (/** @type {any} */ e) => {
          let c = e.currentTarget;
          if (c.dataset.partageChefs) SuiviMembres.choisir(c.dataset.partageChefs, c.checked);
          else SuiviMembres.choisirAutres(String(c.dataset.partageAutres), c.checked);
          SuiviMembres.majCases();
          $(document).trigger("o_partageChoisi");
        },
      );
  }
  /**
   * @static
   * @method jour
   * @return {String} jour du serveur, "AAAA-MM-JJ"
   */
  static jour() {
    return Horloge.serveur().format("YYYY-MM-DD");
  }
  /**
   * @private
   * @static
   * @return {String}
   */
  static _pseudo() {
    return String(monProfil.pseudo || "").toLowerCase();
  }
  /**
   * @static
   * @method etat
   * @return {any} suivi du joueur dans ce navigateur : {jour, fait, essais, essai, raison, annonce, envoi}
   */
  static etat() {
    let e = Utils.lireStockage(CLE_SUIVI_MEMBRES)[SuiviMembres._pseudo()];
    return e && typeof e == "object" ? e : {};
  }
  /**
   * @private
   * @static
   * @param {any} etat
   */
  static _garder(etat) {
    let tous = Utils.lireStockage(CLE_SUIVI_MEMBRES);
    tous[SuiviMembres._pseudo()] = etat;
    try {
      localStorage.setItem(CLE_SUIVI_MEMBRES, JSON.stringify(tous));
    } catch (e) {}
  }
  /**
   * Adresse du script du fichier de l'alliance : ligne « Google Sheet des stats
   * membres » du sujet des réglages de l'alliance.
   *
   * @static
   * @method adresse
   * @return {Promise<{url: String, manque: String}>} sans adresse, ce qui manque :
   *   "section" (cachée absente ou invisible pour le grade), "sujet", "ligne" ou
   *   "adresse" (ligne présente, adresse illisible) ; rejetée si le forum ne se lit pas
   */
  static adresse() {
    return ReglagesAlliance.charger().then((r) =>
      !r.section
        ? { url: "", manque: "section" }
        : !r.sujet
          ? { url: "", manque: "sujet" }
          : r.reglages.feuilleStats
            ? { url: r.reglages.feuilleStats, manque: "" }
            : { url: "", manque: r.reglages.lignes.includes("feuilleStats") ? "adresse" : "ligne" },
    );
  }
  /**
   * @private
   * @static
   * @param {String} texte nom d'une construction ou d'une recherche
   * @return {String} minuscules sans accent
   */
  static _nom(texte) {
    return String(texte || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[’‘`]/g, "'")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }
  /**
   * Niveaux d'une page Construction ou Laboratoire, par nom.
   *
   * @static
   * @method niveaux
   * @param {any} $page jQuery
   * @return {Record<String, Number>} {"couveuse": 14, "etable a pucerons": 0…}
   */
  static niveaux($page) {
    /** @type {Record<String, Number>} */
    let niveaux = {};
    $page.find(".ligneAmelioration").each((/** @type {Number} */ i, /** @type {Element} */ elt) => {
      let nom = SuiviMembres._nom($(elt).find("h2").first().text()),
        niveau = parseInt(
          (/\d+/.exec($(elt).find(".niveau_amelioration").first().text()) || [])[0],
        );
      if (nom && !isNaN(niveau)) niveaux[nom] = niveau;
    });
    return niveaux;
  }
  /**
   * Niveaux lus par nom (niveaux) dans l'ordre d'une liste du jeu
   * (CONSTRUCTION, RECHERCHE) : un nom absent de la page garde son ancien
   * niveau, -1 s'il n'en avait pas. Une page Construction ou Laboratoire sans
   * la liste (une confirmation…) n'efface donc rien, et une ligne en plus ou en
   * moins ne décale pas les autres.
   *
   * @static
   * @method ranger
   * @param {Record<String, Number>} niveaux (niveaux)
   * @param {Array<String>} noms
   * @param {Array<any>} anciens
   * @return {Array<Number>}
   */
  static ranger(niveaux, noms, anciens) {
    return noms.map((nom, i) => {
      let lu = niveaux[SuiviMembres._nom(nom)],
        ancien = (anciens || [])[i];
      return lu != null ? lu : Number.isInteger(ancien) ? ancien : -1;
    });
  }
  /**
   * Niveaux d'une page Construction ou Laboratoire : la page ouverte si c'est
   * elle, sinon lue dans le jeu une fois par page ouverte (le relevé et le
   * profil du site de suivi des convois, ProfilConvois, partagent la lecture).
   *
   * @static
   * @method niveauxDe
   * @param {String} chemin "/construction.php" ou "/laboratoire.php"
   * @param {{chantier?: any} | null} [vu] reçoit la construction suivie en cours
   *   d'une page Construction lue dans le jeu
   * @return {Promise<Record<String, Number>>}
   */
  static niveauxDe(chemin, vu = null) {
    if (location.pathname.toLowerCase() == chemin)
      return Promise.resolve(SuiviMembres.niveaux($(document.body)));
    if (!SuiviMembres._lues[chemin])
      SuiviMembres._lues[chemin] = Promise.resolve($.get(location.origin + chemin))
        .then(Utils.parseHtml)
        .then(($page) => ({
          niveaux: SuiviMembres.niveaux($page),
          chantier: SuiviMembres.chantierDe($page, Horloge.maintenant()),
        }));
    return SuiviMembres._lues[chemin].then((lue) => {
      if (vu) vu.chantier = lue.chantier;
      return lue.niveaux;
    });
  }
  /**
   * @private
   * @static
   * @param {String} nom construction en cours, telle que le jeu l'affiche
   * @param {Number} secondes temps restant
   * @param {Number} instant heure du serveur à la lecture
   * @return {{cle: String, fin: Number} | null} null si ce n'est pas un niveau suivi
   */
  static _chantier(nom, secondes, instant) {
    let construction = SuiviMembres._nom(nom),
      cle = Object.keys(SUIVI_NIVEAUX_SUIVIS).find((c) =>
        construction.includes(SUIVI_NIVEAUX_SUIVIS[c]),
      );
    return cle && secondes > 0 ? { cle, fin: instant + secondes * 1000 } : null;
  }
  /**
   * Construction suivie en cours, d'après une page Construction telle que le
   * jeu l'écrit (« - Etable à pucerons 3 se termine dans : », chrono `reste`).
   *
   * @static
   * @method chantierDe
   * @param {any} $page jQuery
   * @param {Number} instant heure du serveur à la lecture
   * @return {{cle: String, fin: Number} | null}
   */
  static chantierDe($page, instant) {
    /** @type {{cle: String, fin: Number} | null} */
    let chantier = null;
    $page.find("#centre > strong").each((/** @type {Number} */ i, /** @type {Element} */ elt) => {
      let secondes = parseInt(
        ($(elt)
          .children("script")
          .text()
          .match(/reste\((\d+),/) || [])[1],
      );
      chantier = chantier || SuiviMembres._chantier($(elt).text(), secondes, instant);
    });
    return chantier;
  }
  /**
   * Compte+ : construction suivie en cours d'après l'encart du jeu, présent
   * sur chaque page (nom et secondes restantes), sans requête.
   *
   * @static
   * @method chantierEncart
   * @param {Number} instant heure du serveur à la lecture
   * @return {{cle: String, fin: Number} | null | undefined} undefined sans cet encart
   */
  static chantierEncart(instant) {
    let $ligne = $("#ligne_construction");
    if (!$ligne.length) return undefined;
    return SuiviMembres._chantier(
      $ligne.find("td").eq(1).text(),
      parseInt(
        ($ligne
          .find("script")
          .text()
          .match(/resteTemps\((\d+)/) || [])[1],
      ),
      instant,
    );
  }
  /**
   * @private
   * @static
   * @param {{cle: String, fin: Number} | undefined} avant construction suivie jusqu'ici
   * @param {{cle: String, fin: Number} | null | undefined} vue celle que la page
   *   affiche ; undefined quand la page ne le dit pas
   * @param {Number} instant
   * @return {Boolean} la construction suivie est terminée
   */
  static _finie(avant, vue, instant) {
    if (!avant) return false;
    // la page ne dit rien : à l'heure prévue, passée de l'écart toléré
    if (vue === undefined) return avant.fin + SUIVI_ECART_FIN <= instant;
    // la page dit ce qui se construit : terminée si ce n'est plus elle, vers
    // l'heure prévue (plus tôt, elle a été annulée)
    return (
      avant.fin - SUIVI_ECART_FIN <= instant &&
      !(vue && vue.cle == avant.cle && Math.abs(vue.fin - avant.fin) < SUIVI_ECART_FIN)
    );
  }
  /**
   * Ce que la page ouverte dit des niveaux suivis, sans requête : les niveaux
   * affichés (page Construction), la construction suivie jusqu'ici, celle que
   * la page affiche (encart Compte+ du jeu, ou page Construction ; undefined
   * quand la page ne le dit pas) et si la première est terminée.
   *
   * @static
   * @method constructionVue
   * @param {Number} instant heure du serveur
   * @return {{niveaux: Record<String, Number>, avant: any, vue: any, finie: Boolean}}
   */
  static constructionVue(instant) {
    let surConstruction = location.pathname.toLowerCase() == "/construction.php",
      niveaux = surConstruction ? SuiviMembres.niveaux($(document.body)) : {},
      avant = SuiviMembres.etat().chantier,
      vue = SuiviMembres.chantierEncart(instant);
    if (vue === undefined && surConstruction)
      vue = SuiviMembres.chantierDe($(document.body), instant);
    return { niveaux, avant, vue, finie: SuiviMembres._finie(avant, vue, instant) };
  }
  /**
   * Niveaux suivis changés depuis un envoi : sur la page Construction, niveau
   * affiché différent de celui envoyé ; ailleurs, construction suivie
   * terminée après l'envoi.
   *
   * @static
   * @method niveauxChanges
   * @param {ReturnType<typeof SuiviMembres.constructionVue>} vu
   * @param {Record<String, Number>} envoyes niveaux envoyés, par clé de SUIVI_NIVEAUX_SUIVIS
   * @param {Number} [depuis] heure de l'envoi
   * @return {Array<String>} clés de SUIVI_NIVEAUX_SUIVIS
   */
  static niveauxChanges(vu, envoyes, depuis) {
    return Object.keys(SUIVI_NIVEAUX_SUIVIS).filter((c) => {
      let affiche = vu.niveaux[SUIVI_NIVEAUX_SUIVIS[c]];
      if (affiche != null && envoyes[c] != null) return affiche != envoyes[c];
      return vu.finie && vu.avant.cle == c && !(depuis != null && depuis >= vu.avant.fin);
    });
  }
  /**
   * Niveau de la Champignonnière ou de l'Étable à pucerons changé depuis le
   * relevé du jour : ce relevé est marqué à refaire, et lancer() le refait sur
   * cette page. Le changement se voit sans requête (constructionVue) : sur la
   * page Construction, au niveau affiché, différent du dernier envoyé ;
   * ailleurs, à la fin d'une construction suivie (encart Compte+ du jeu, page
   * Construction ouverte ou lue par un relevé). À appeler à l'ouverture de
   * chaque page, avant que son module ne la modifie et après
   * ProfilConvois.observer(), qui lit la construction suivie avant qu'elle ne
   * soit oubliée ici ; rien n'est lu dans le jeu ni envoyé ici.
   *
   * @static
   * @method observer
   */
  static observer() {
    if (!SuiviMembres._pseudo() || !Utils.alliance) return;
    let etat = SuiviMembres.etat(),
      vu = SuiviMembres.constructionVue(Horloge.maintenant()),
      avant = vu.avant,
      chantier = vu.vue !== undefined ? vu.vue : vu.finie ? null : avant,
      changes = SuiviMembres.niveauxChanges(
        vu,
        (etat.envoi && etat.envoi.niveaux) || {},
        etat.envoi && etat.envoi.instant,
      ).filter((c) => SuiviMembres.partage(c)),
      refaire = changes.length > 0 && etat.jour == SuiviMembres.jour() && etat.fait && !etat.raison;
    if (!refaire && JSON.stringify(chantier || null) == JSON.stringify(avant || null)) return;
    if (refaire)
      Journal.info(
        JOURNAL_SUIVI,
        "niveau changé depuis le relevé du jour : relevé à refaire",
        SuiviMembres._titres(changes),
      );
    SuiviMembres._garder({
      ...etat,
      ...(refaire ? { fait: false, essais: 0, essai: 0 } : {}),
      chantier: chantier || undefined,
    });
  }
  /**
   * Armée complète (garnison et troupes parties), d'après la page Reine ;
   * sans Compte+, reconstituée (_armeeSansComptePlus).
   *
   * @private
   * @static
   * @return {Promise<Array<Number>>} nombres par unité, ordre d'Armee.unite
   */
  static _armee() {
    return Utils.lireReine().then((/** @type {any} */ reine) => {
      if (!reine.reine && reine.sansComptePlus) return SuiviMembres._armeeSansComptePlus();
      if (!reine.reine) throw new Error(`page Reine illisible (${reine.raison})`);
      let unites = Utils.armeeReine(reine.brut, null);
      if (unites) return unites;
      // lignes de la page Reine sans nom d'unité : rangs des unités débloquées, page Armée
      return Promise.resolve($.get(location.origin + "/Armee.php")).then((html) => {
        let parRang = Utils.armeeReine(reine.brut, Armee.debloquees(html));
        if (!parRang) throw new Error("unités de la page Reine non reconnues");
        return parRang;
      });
    });
  }
  /**
   * Nombre total d'ouvrières de la page Reine (celles parties en convoi
   * comprises), page lue une fois par page ouverte (Utils.lireReine) ; sans
   * Compte+, reconstitué (_ouvrieresSansComptePlus).
   *
   * @static
   * @method ouvrieres
   * @return {Promise<Number>}
   */
  static ouvrieres() {
    return Utils.lireReine().then((/** @type {any} */ reine) => {
      if (reine.reine) return reine.ouvrieres;
      if (reine.sansComptePlus) return SuiviMembres._ouvrieresSansComptePlus();
      throw new Error(`page Reine illisible (${reine.raison})`);
    });
  }
  /**
   * @private
   * @static
   * @param {String} chemin page du jeu
   * @return {Promise<String>} son HTML, lu une fois par page ouverte
   */
  static _html(chemin) {
    let cle = "html " + chemin;
    if (!SuiviMembres._lues[cle])
      SuiviMembres._lues[cle] = Promise.resolve($.get(location.origin + chemin));
    return SuiviMembres._lues[cle];
  }
  /**
   * Sans Compte+, aucune page ne donne le total des ouvrières : celles de
   * l'en-tête de la page Convois (présentes) et celles de ses convois en cours,
   * (nourriture + matériaux) ÷ ce que porte une ouvrière, arrondi au-dessus
   * comme pour « Convoi avant la récolte ».
   *
   * @private
   * @static
   * @return {Promise<Number>}
   */
  static _ouvrieresSansComptePlus() {
    return Promise.all([
      SuiviMembres.niveauxDe("/construction.php"),
      SuiviMembres._html("/commerce.php"),
    ]).then(([niveaux, html]) => {
      let $page = Utils.parseHtml(html),
        presentes = parseInt($page.find("#nb_ouvrieres").text().replace(/\D/g, "")),
        etable = niveaux[SUIVI_NIVEAUX_SUIVIS.puceron];
      if (!$page.find("#centre").length || isNaN(presentes))
        throw new Error("page Convois illisible (ouvrières sans Compte+)");
      if (etable == null) throw new Error(`niveau introuvable : ${SUIVI_NIVEAUX_SUIVIS.puceron}`);
      let parOuvriere = Utils.parOuvriere(etable);
      return CommerceFzzz.montantsEnvoyes($page).reduce(
        (total, montant) => total + Math.ceil(montant / parOuvriere),
        presentes,
      );
    });
  }
  /**
   * Sans Compte+, aucune page ne donne les troupes parties : garnison de la
   * page Armée et troupes parties en chasse ou en attaque connues de ce
   * navigateur (TroupesDehors, mémorisées à l'envoi). Une chasse ou une attaque
   * en cours dont elles sont inconnues (lancée ailleurs) fait échouer le
   * relevé, refait plus tard comme pour une page illisible : jamais d'armée
   * comptée en moins.
   *
   * @private
   * @static
   * @return {Promise<Array<Number>>} nombres par unité, ordre d'Armee.unite
   */
  static _armeeSansComptePlus() {
    return Promise.all([
      SuiviMembres._html("/Armee.php"),
      SuiviMembres._html("/Ressources.php"),
    ]).then(([htmlArmee, htmlRessources]) => {
      if (!/Troupes en Garnison/i.test(htmlArmee))
        throw new Error("page Armée illisible (armée sans Compte+)");
      let $ressources = Utils.parseHtml(htmlRessources);
      if (!$ressources.find("#quantite_tdc").length)
        throw new Error("page Ressources illisible (armée sans Compte+)");
      // un renfort (sans cible) n'est pas une troupe du joueur
      let attaques = AttaqueLancee.extraireLignes(Utils.parseHtml(htmlArmee)).filter(
        (/** @type {any} */ l) => l.cible,
      );
      TroupesDehors.synchroniserAttaques(attaques);
      let liste = TroupesDehors.synchroniserChasses($ressources),
        connue = (/** @type {String} */ type, /** @type {Number} */ id) =>
          liste.some((t) => t.type == type && t.id == id),
        inconnues =
          attaques.filter((/** @type {any} */ l) => !connue("attaque", l.id)).length +
          TroupesDehors.lignesChasses($ressources).filter((l) => !connue("chasse", l.id)).length;
      if (inconnues)
        throw new Error(
          `${inconnues} chasse(s) ou attaque(s) en cours aux troupes inconnues sans Compte+ (lancées depuis un autre navigateur) : armée incomplète`,
        );
      let dehors = TroupesDehors.total();
      return new Armee()
        .chargeData(htmlArmee)
        .unite.map((/** @type {Number} */ n, /** @type {Number} */ i) => n + dehors[i]);
    });
  }
  /**
   * Valeurs des informations partagées ; seules les pages utiles sont lues.
   *
   * @static
   * @method relever
   * @param {Record<String, Boolean>} partages
   * @param {{chantier?: any} | null} [vu] reçoit la construction suivie en cours,
   *   si la page Construction est lue dans le jeu
   * @return {Promise<Record<String, Number>>} rejetée si une valeur partagée ne se lit pas
   */
  static relever(partages, vu = null) {
    let utile = (/** @type {Array<String>} */ cles) => cles.some((c) => partages[c]);
    return Promise.all([
      utile(SUIVI_CONSTRUCTION) ? SuiviMembres.niveauxDe("/construction.php", vu) : null,
      utile(SUIVI_LABORATOIRE) ? SuiviMembres.niveauxDe("/laboratoire.php") : null,
      utile(SUIVI_ARMEE) ? SuiviMembres._armee() : null,
      utile(SUIVI_REINE) ? SuiviMembres.ouvrieres() : null,
    ]).then(([construction, recherche, unites, ouvrieres]) => {
      let niveau = (/** @type {any} */ niveaux, /** @type {String} */ nom) => {
          if (!niveaux || niveaux[nom] == null) throw new Error(`niveau introuvable : ${nom}`);
          return niveaux[nom];
        },
        armee = new Armee(),
        /** @type {Record<String, () => Number>} */
        valeurs = {
          tdp: () =>
            niveau(construction, "couveuse") +
            niveau(construction, "solarium") +
            niveau(recherche, "technique de ponte"),
          cdf: () => armee.getSommeUnite(),
          fdfHB: () => armee.getBaseAtt(),
          fdfAB: () => armee.getTotalAtt(niveau(recherche, "armes")),
          va: () => niveau(recherche, "vitesse d'attaque"),
          vc: () => niveau(recherche, "vitesse de chasse"),
          puceron: () => niveau(construction, "etable a pucerons"),
          champignonniere: () => niveau(construction, "champignonniere"),
          ouvrieres: () => Number(ouvrieres),
        },
        /** @type {Record<String, Number>} */
        donnees = {};
      if (unites) armee.unite = unites;
      DONNEES_PARTAGEES.forEach((d) => {
        if (partages[d.cle]) donnees[d.cle] = valeurs[d.cle]();
      });
      return donnees;
    });
  }
  /**
   * @static
   * @method envoyer
   * @param {String} url adresse du script du fichier
   * @param {String} jour "AAAA-MM-JJ"
   * @param {Record<String, Number>} donnees
   * @param {Record<String, Boolean>} partages avec les chefs
   * @param {Record<String, Boolean>} publics avec les autres membres
   * @return {Promise<any>} rejetée avec un message si le fichier refuse ou ne répond pas
   */
  static envoyer(url, jour, donnees, partages, publics) {
    return ExportRapports.requete(url, "POST", {
      suivi: { joueur: monProfil.pseudo, jour, donnees, partages, publics, version: VERSION },
    }).then((r) => {
      if (!r.ok) throw new Error("réponse inattendue du script");
      return r;
    });
  }
  /**
   * Relevé du jour, s'il reste à faire : appelé à chaque page ouverte, il ne
   * lit et n'envoie quelque chose qu'à la première du jour, puis à celle où
   * observer() a vu un niveau suivi changer (ou, après un échec, à une page
   * ouverte au moins SUIVI_PAUSE_ESSAIS plus tard, SUIVI_ESSAIS_PAR_JOUR fois
   * au plus). La première fois, le joueur est prévenu et rien n'est envoyé :
   * l'envoi se fait à la page suivante, ce qui lui laisse le temps de décocher
   * ce qu'il ne veut pas partager.
   *
   * @static
   * @method lancer
   * @param {Boolean} [maintenant] bouton « Envoyer maintenant » : sans attendre le lendemain
   * @return {Promise<String>} "sans alliance", "attente", "sans sujet", "annonce", "envoyé" ou "échec"
   */
  static lancer(maintenant = false) {
    if (!SuiviMembres._pseudo() || !Utils.alliance) return Promise.resolve("sans alliance");
    // bouton « Envoyer maintenant » : les pages lues à l'ouverture de cette page ont pu changer
    if (maintenant) SuiviMembres._lues = {};
    let jour = SuiviMembres.jour(),
      instant = Horloge.maintenant(),
      etat = SuiviMembres.etat();
    if (etat.jour != jour)
      etat = {
        annonce: etat.annonce,
        envoi: etat.envoi,
        chantier: etat.chantier,
        jour,
        fait: false,
        essais: 0,
        essai: 0,
      };
    // « rien aujourd'hui » conclu par une autre version du script : à revoir (« non autorisé » :
    // la 1.134.0 réservait l'envoi à une liste de joueurs, cet état peut rester ce jour-là)
    if ((etat.raison == "sans sujet" || etat.raison == "non autorisé") && etat.version !== VERSION)
      etat = { ...etat, fait: false, essais: 0, essai: 0, raison: "" };
    if (
      !maintenant &&
      (etat.fait ||
        etat.essais >= SUIVI_ESSAIS_PAR_JOUR ||
        instant - (etat.essai || 0) < SUIVI_PAUSE_ESSAIS)
    )
      return Promise.resolve("attente");
    // noté avant les lectures : une page quittée en route ne relance pas tout à la suivante
    etat = { ...etat, essais: (etat.essais || 0) + 1, essai: instant, raison: "" };
    SuiviMembres._garder(etat);
    let partages = SuiviMembres.partages(),
      publics = SuiviMembres.partagesAutres(),
      fin = (/** @type {String} */ resultat, /** @type {any} */ suite) => {
        SuiviMembres._garder({ ...etat, ...suite });
        return resultat;
      };
    return SuiviMembres.adresse()
      .then(({ url, manque }) => {
        // ligne présente, adresse illisible (message en cours d'écriture, lecture
        // ratée) : un échec, repris plus tard comme les autres
        if (manque == "adresse") throw new Error(SuiviMembres.sansAdresse(manque));
        if (!url) {
          Journal.info(
            JOURNAL_SUIVI,
            manque == "section"
              ? "section cachée du forum introuvable ou invisible pour ton grade : rien n'est relevé aujourd'hui"
              : manque == "sujet"
                ? `pas de sujet « ${TITRE_REGLAGES} » dans la section cachée du forum : rien n'est relevé aujourd'hui`
                : `pas de ligne « ${REGLAGES_ALLIANCE.feuilleStats.nom} » dans le sujet « ${TITRE_REGLAGES} » : rien n'est relevé aujourd'hui`,
          );
          return fin("sans sujet", { fait: true, raison: "sans sujet", version: VERSION });
        }
        if (!etat.annonce && !maintenant) {
          SuiviMembres.annoncer(partages);
          return fin("annonce", { annonce: true, essais: 0, essai: 0 });
        }
        // avec l'encart Compte+, la page ouverte dit déjà ce qui se construit (observer)
        /** @type {{chantier?: any} | null} */
        let vu = $("#ligne_construction").length ? null : {};
        return SuiviMembres.relever(partages, vu)
          .then((donnees) =>
            SuiviMembres.envoyer(url, jour, donnees, partages, publics).then(() => donnees),
          )
          .then((donnees) => {
            let cles = DONNEES_PARTAGEES.filter((d) => partages[d.cle]).map((d) => d.cle),
              autres = cles.filter((c) => publics[c]),
              // ceux qui sont partagés : les autres, absents du relevé, ne sont pas gardés
              niveaux = Object.fromEntries(
                Object.keys(SUIVI_NIVEAUX_SUIVIS).map((c) => [c, donnees[c]]),
              );
            Journal.info(
              JOURNAL_SUIVI,
              `relevé du ${jour} envoyé`,
              `${cles.join(", ") || "rien"} ; avec les autres membres : ${autres.join(", ") || "rien"}`,
            );
            return fin("envoyé", {
              annonce: true,
              fait: true,
              envoi: { instant: Horloge.maintenant(), cles, autres, niveaux },
              ...(vu && "chantier" in vu ? { chantier: vu.chantier || undefined } : {}),
            });
          });
      })
      .catch((e) => {
        let raison = String((e && e.message) || "forum de l'alliance illisible");
        Journal.erreur(JOURNAL_SUIVI, `relevé du ${jour} non envoyé`, raison);
        return fin("échec", { raison });
      });
  }
  /**
   * @private
   * @static
   * @param {Array<String>} cles
   * @return {String} « TdP, CdF et VA »
   */
  static _titres(cles) {
    let titres = DONNEES_PARTAGEES.filter((d) => cles.includes(d.cle)).map((d) => d.titre);
    return titres.length > 1
      ? `${titres.slice(0, -1).join(", ")} et ${titres[titres.length - 1]}`
      : titres.join("");
  }
  /**
   * Prévient le joueur, avant le premier envoi : ce qui sera partagé, et où le
   * choisir.
   *
   * @static
   * @method annoncer
   * @param {Record<String, Boolean>} partages
   */
  static annoncer(partages) {
    let titres = SuiviMembres._titres(
        DONNEES_PARTAGEES.map((d) => d.cle).filter((c) => partages[c]),
      ),
      suivis = Object.keys(SUIVI_NIVEAUX_SUIVIS).some((c) => partages[c]);
    $.toast({
      ...TOAST_INFO,
      heading: "Partage de données",
      text: `Une fois par jour, l'extension envoie au Google Sheet des stats membres de ton alliance ${titres ? `tes statistiques : ${titres}` : "le fait que tu ne partages aucune statistique"}.${suivis ? " Elle les renvoie quand le niveau de ta Champignonnière ou de ton Étable à pucerons change." : ""} Le premier envoi se fera à ta prochaine page. Tu choisis ce que tu partages avec les chefs et avec les autres membres dans <a href='#' class='o_ouvrirPartage'>Préférences → Partage de données</a>.`,
      hideAfter: false,
      allowToastClose: true,
    });
    SuiviMembres.lierPreferences();
  }
  /**
   * Les liens « Préférences → Partage de données » des annonces (classe
   * o_ouvrirPartage) ouvrent cet onglet.
   *
   * @static
   * @method lierPreferences
   */
  static lierPreferences() {
    $(document)
      .off("click.o_ouvrirPartage")
      .on("click.o_ouvrirPartage", ".o_ouvrirPartage", (e) => {
        e.preventDefault();
        BoiteParametre.ouvrirOnglet("Partage");
      });
  }
  /**
   * Ce qui a empêché le relevé d'aujourd'hui dans ce navigateur, pour l'onglet
   * des Préférences.
   *
   * @static
   * @method probleme
   * @return {String} texte, vide quand rien ne l'a empêché
   */
  static probleme() {
    let e = SuiviMembres.etat();
    if (e.jour != SuiviMembres.jour()) return "";
    if (!e.fait && e.raison)
      return `Aujourd'hui, le relevé n'a pas pu être envoyé : ${e.raison}. Nouvel essai à une page ouverte plus tard (${numeral(SUIVI_ESSAIS_PAR_JOUR).format()} essais par jour au plus).`;
    if (e.raison == "sans sujet")
      return `Aujourd'hui, rien n'a été envoyé : pas de ligne « ${REGLAGES_ALLIANCE.feuilleStats.nom} » dans le sujet « ${TITRE_REGLAGES} » du forum caché de ton alliance.`;
    return "";
  }
  /**
   * Pourquoi le fichier de l'alliance est introuvable, d'après ce que
   * `adresse()` dit qu'il manque.
   *
   * @static
   * @method sansAdresse
   * @param {String} manque "section", "sujet", "ligne" ou "adresse"
   * @return {String}
   */
  static sansAdresse(manque) {
    let ligne = REGLAGES_ALLIANCE.feuilleStats.nom;
    return manque == "section"
      ? `section cachée « ${FORUM_SECTIONS_CHASSES[0]} » du forum introuvable ou invisible pour ton grade`
      : manque == "sujet"
        ? `pas de sujet « ${TITRE_REGLAGES} » dans la section cachée du forum`
        : manque == "ligne"
          ? `pas de ligne « ${ligne} » dans le sujet « ${TITRE_REGLAGES} »`
          : ReglagesAlliance.fichier("feuilleStats")
            ? ReglagesAlliance.aideFichier("feuilleStats")
            : `pas d'adresse de script lisible à la ligne « ${ligne} » du sujet « ${TITRE_REGLAGES} »`;
  }
}
// pages lues dans le jeu depuis l'ouverture de la page, une fois chacune :
// niveaux de Construction et Laboratoire, HTML des pages lues sans Compte+
SuiviMembres._lues = /** @type {Record<String, Promise<any>>} */ ({});
