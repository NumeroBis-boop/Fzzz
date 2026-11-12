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
];
// case décochée : "0" ; cochée par défaut
const CLE_PARTAGE = "fzzz_partage_";
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
// niveaux dont le changement fait refaire le relevé du jour sans attendre le
// lendemain (demande du mainteneur) : information partagée → nom du bâtiment
const SUIVI_NIVEAUX_SUIVIS = { champignonniere: "champignonniere", puceron: "etable a pucerons" };
// la fin d'une construction est estimée (heure du serveur à la seconde près,
// délai d'affichage de la page) : écart toléré
const SUIVI_ECART_FIN = 30 * 1000;

/**
 * Une fois par jour, à la première page que le joueur ouvre, ses informations
 * cochées sont relevées (pages Construction, Laboratoire et Reine, lues une
 * fois chacune) et envoyées au script du fichier de l'alliance, dont l'adresse
 * est dans le premier message du sujet caché TITRE_STATS_MEMBRES : sans ce
 * sujet, rien n'est lu ni envoyé. Une information décochée n'est ni relevée ni
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
   * @static
   * @method partage
   * @param {String} cle clé de DONNEES_PARTAGEES
   * @return {Boolean} information cochée dans les Préférences
   */
  static partage(cle) {
    try {
      return localStorage.getItem(CLE_PARTAGE + cle) != "0";
    } catch (e) {
      return true;
    }
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
   * Case cochée ou décochée par le joueur : le fichier le saura à la prochaine
   * page ouverte, sans attendre le lendemain.
   *
   * @static
   * @method choisir
   * @param {String} cle
   * @param {Boolean} coche
   */
  static choisir(cle, coche) {
    try {
      localStorage.setItem(CLE_PARTAGE + cle, coche ? "1" : "0");
    } catch (e) {}
    SuiviMembres._garder({ ...SuiviMembres.etat(), fait: false, essais: 0, essai: 0, raison: "" });
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
   * Adresse du script du fichier de l'alliance, postée à la main dans le
   * premier message du sujet caché TITRE_STATS_MEMBRES.
   *
   * @static
   * @method adresse
   * @return {Promise<String>} "" sans section cachée, sans sujet ou sans adresse ;
   *   rejetée si le forum ne se lit pas
   */
  static adresse() {
    return PartageChasses.sujets(true).then(
      (sujets) =>
        sujets.statsMembres
          ? PartageChasses._xajax("callGetTopic", sujets.statsMembres).then(
              (data) => ExportRapports.lireReglage(data).adresse,
            )
          : "",
      (e) => {
        // section inexistante ou cachée au grade du joueur : pas une panne
        if (e && e.message == "absente") return "";
        throw e;
      },
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
   * @private
   * @static
   * @param {String} chemin "/construction.php" ou "/laboratoire.php"
   * @param {{chantier?: any} | null} [vu] reçoit la construction suivie en cours
   *   d'une page Construction lue dans le jeu
   * @return {Promise<Record<String, Number>>} la page ouverte si c'est elle, sinon lue
   */
  static _niveauxDe(chemin, vu = null) {
    if (location.pathname.toLowerCase() == chemin)
      return Promise.resolve(SuiviMembres.niveaux($(document.body)));
    return Promise.resolve($.get(location.origin + chemin))
      .then(Utils.parseHtml)
      .then(($page) => {
        if (vu) vu.chantier = SuiviMembres.chantierDe($page, Horloge.maintenant());
        return SuiviMembres.niveaux($page);
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
   * Niveau de la Champignonnière ou de l'Étable à pucerons changé depuis le
   * relevé du jour : ce relevé est marqué à refaire, et lancer() le refait sur
   * cette page. Le changement se voit sans requête : sur la page Construction,
   * au niveau affiché, différent du dernier envoyé ; ailleurs, à la fin d'une
   * construction suivie (encart Compte+ du jeu, page Construction ouverte ou
   * lue par un relevé). À appeler à l'ouverture de chaque page, avant que son
   * module ne la modifie ; rien n'est lu dans le jeu ni envoyé ici.
   *
   * @static
   * @method observer
   */
  static observer() {
    if (!SuiviMembres._pseudo() || !Utils.alliance) return;
    let instant = Horloge.maintenant(),
      etat = SuiviMembres.etat(),
      surConstruction = location.pathname.toLowerCase() == "/construction.php",
      niveaux = surConstruction ? SuiviMembres.niveaux($(document.body)) : {},
      envoyes = (etat.envoi && etat.envoi.niveaux) || {},
      avant = etat.chantier,
      vue = SuiviMembres.chantierEncart(instant);
    if (vue === undefined && surConstruction)
      vue = SuiviMembres.chantierDe($(document.body), instant);
    let finie = SuiviMembres._finie(avant, vue, instant),
      chantier = vue !== undefined ? vue : finie ? null : avant,
      changes = Object.keys(SUIVI_NIVEAUX_SUIVIS).filter((c) => {
        if (!SuiviMembres.partage(c)) return false;
        let affiche = niveaux[SUIVI_NIVEAUX_SUIVIS[c]];
        if (affiche != null && envoyes[c] != null) return affiche != envoyes[c];
        // niveau non affiché : construction finie après le dernier envoi
        return finie && avant.cle == c && !(etat.envoi && etat.envoi.instant >= avant.fin);
      }),
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
   * Armée complète (garnison et troupes parties), d'après la page Reine.
   *
   * @private
   * @static
   * @return {Promise<Array<Number>>} nombres par unité, ordre d'Armee.unite
   */
  static _armee() {
    return Utils.lireReine().then((/** @type {any} */ reine) => {
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
      utile(SUIVI_CONSTRUCTION) ? SuiviMembres._niveauxDe("/construction.php", vu) : null,
      utile(SUIVI_LABORATOIRE) ? SuiviMembres._niveauxDe("/laboratoire.php") : null,
      utile(SUIVI_ARMEE) ? SuiviMembres._armee() : null,
    ]).then(([construction, recherche, unites]) => {
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
   * @param {Record<String, Boolean>} partages
   * @return {Promise<any>} rejetée avec un message si le fichier refuse ou ne répond pas
   */
  static envoyer(url, jour, donnees, partages) {
    return ExportRapports.requete(url, "POST", {
      suivi: { joueur: monProfil.pseudo, jour, donnees, partages, version: VERSION },
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
      fin = (/** @type {String} */ resultat, /** @type {any} */ suite) => {
        SuiviMembres._garder({ ...etat, ...suite });
        return resultat;
      };
    return SuiviMembres.adresse()
      .then((url) => {
        if (!url) {
          Journal.info(JOURNAL_SUIVI, `pas d'adresse dans le sujet « ${TITRE_STATS_MEMBRES} »`);
          return fin("sans sujet", { fait: true, raison: "sans sujet" });
        }
        if (!etat.annonce && !maintenant) {
          SuiviMembres.annoncer(partages);
          return fin("annonce", { annonce: true, essais: 0, essai: 0 });
        }
        // avec l'encart Compte+, la page ouverte dit déjà ce qui se construit (observer)
        /** @type {{chantier?: any} | null} */
        let vu = $("#ligne_construction").length ? null : {};
        return SuiviMembres.relever(partages, vu)
          .then((donnees) => SuiviMembres.envoyer(url, jour, donnees, partages).then(() => donnees))
          .then((donnees) => {
            let cles = DONNEES_PARTAGEES.filter((d) => partages[d.cle]).map((d) => d.cle),
              // ceux qui sont partagés : les autres, absents du relevé, ne sont pas gardés
              niveaux = Object.fromEntries(
                Object.keys(SUIVI_NIVEAUX_SUIVIS).map((c) => [c, donnees[c]]),
              );
            Journal.info(JOURNAL_SUIVI, `relevé du ${jour} envoyé`, cles.join(", ") || "rien");
            return fin("envoyé", {
              annonce: true,
              fait: true,
              envoi: { instant: Horloge.maintenant(), cles, niveaux },
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
      text: `Une fois par jour, l'extension envoie au Google Sheet « ${TITRE_STATS_MEMBRES} » de ton alliance ${titres ? `tes statistiques : ${titres}` : "le fait que tu ne partages aucune statistique"}.${suivis ? " Elle les renvoie quand le niveau de ta Champignonnière ou de ton Étable à pucerons change." : ""} Le premier envoi se fera à ta prochaine page. Tu choisis ce que tu partages dans <a href='#' class='o_ouvrirPartage'>Préférences → Partage de données</a>.`,
      hideAfter: false,
      allowToastClose: true,
    });
    $(document)
      .off("click.o_ouvrirPartage")
      .on("click.o_ouvrirPartage", ".o_ouvrirPartage", (e) => {
        e.preventDefault();
        BoiteParametre.ouvrirOnglet("Partage");
      });
  }
  /**
   * Où en est le partage dans ce navigateur, pour l'onglet des Préférences.
   *
   * @static
   * @method resume
   * @return {String} texte
   */
  static resume() {
    let e = SuiviMembres.etat(),
      phrases = [];
    if (e.envoi && e.envoi.instant)
      phrases.push(
        `Dernier envoi depuis ce navigateur : le ${moment(e.envoi.instant).format("DD/MM/YYYY [à] HH[h]mm")} (${SuiviMembres._titres(e.envoi.cles || []) || "aucune information partagée"}).`,
      );
    else phrases.push("Aucun envoi depuis ce navigateur pour l'instant.");
    if (e.jour == SuiviMembres.jour() && !e.fait && e.raison)
      phrases.push(
        `Aujourd'hui, le relevé n'a pas pu être envoyé : ${e.raison}. Nouvel essai à une page ouverte plus tard (${numeral(SUIVI_ESSAIS_PAR_JOUR).format()} essais par jour au plus).`,
      );
    else if (e.jour == SuiviMembres.jour() && e.raison == "sans sujet")
      phrases.push(
        `Aujourd'hui, rien n'a été envoyé : pas de sujet « ${TITRE_STATS_MEMBRES} » avec l'adresse du fichier dans le forum caché de ton alliance.`,
      );
    else if (e.jour == SuiviMembres.jour() && !e.fait)
      phrases.push("Le prochain envoi se fera à ta prochaine page.");
    return phrases.join(" ");
  }
}
