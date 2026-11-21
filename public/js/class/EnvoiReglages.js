// @ts-check
/*
 * EnvoiReglages.js
 * Fzzz
 **********************************************************************/

// état de l'envoi dans ce navigateur : {joueur, jour, version, fait, essais, essai, raison}
const CLE_ENVOI_REGLAGES = "fzzz_envoiReglages";
// identifiant tiré une fois par navigateur : deux appareils pareils ont chacun leur colonne
const CLE_ID_APPAREIL = "fzzz_idAppareil";
const JOURNAL_REGLAGES = "Envoi des réglages";
const SCRIPT_SANS_REGLAGES =
  "le script du Google Sheet des stats membres n'est pas à jour (nouvelle version à déployer)";
// paramètres dont la liste des choix n'est posée qu'à l'ouverture des Préférences
// (Parametres.js) : valeur → nom de l'unité (NOM_UNITE de content.js)
const UNITES_PARAMETRES = {
  uniteAntisondeTerrainType: (/** @type {Number} */ v) =>
    v == 0 ? "Première disponible" : NOM_UNITE[v],
  uniteAntisondeDomeType: (/** @type {Number} */ v) =>
    v == 0 ? "Première disponible" : NOM_UNITE[v],
  sondeUnite: (/** @type {Number} */ v) => NOM_UNITE[v + 1],
  reserveFloodType: (/** @type {Number} */ v) =>
    v == 0 ? "Dernières unités de l'armée" : NOM_UNITE[v],
};

/**
 * Réglages de l'extension de chaque joueur, sur chacun de ses appareils, à
 * l'onglet « Réglages extension » du Google Sheet des stats membres (demande
 * du mainteneur, 20/11/2026 : comprendre une erreur d'affichage, une version
 * pas à jour) : une ligne par réglage, une colonne par joueur et appareil.
 * Une fois par jour du serveur, et de nouveau le jour où la version change ;
 * sans case dans les Préférences (réponse du mainteneur). Jamais d'adresse ni
 * de mot de passe. Aucune requête au jeu : seulement celle du script du fichier.
 *
 * @class EnvoiReglages
 */
class EnvoiReglages {
  /**
   * @static
   * @method etat
   * @return {any}
   */
  static etat() {
    try {
      let e = JSON.parse(localStorage.getItem(CLE_ENVOI_REGLAGES) || "{}");
      return e && typeof e == "object" ? e : {};
    } catch (e) {
      return {};
    }
  }
  /**
   * @private
   * @static
   * @param {any} etat
   */
  static _garder(etat) {
    try {
      localStorage.setItem(CLE_ENVOI_REGLAGES, JSON.stringify(etat));
    } catch (e) {}
  }
  /**
   * Nom de l'appareil, titre de sa colonne avec le pseudo : navigateur,
   * système, gestionnaire de scripts (sans leurs versions, qui changeraient la
   * colonne) et un identifiant tiré au premier envoi.
   *
   * @static
   * @method appareil
   * @return {String} « Firefox Android · Violentmonkey · 3fa9 »
   */
  static appareil() {
    let ua = navigator.userAgent,
      systeme = /Android/.test(ua)
        ? "Android"
        : /iPhone|iPad|iPod/.test(ua)
          ? "iOS"
          : /Windows/.test(ua)
            ? "Windows"
            : /Mac OS X|Macintosh/.test(ua)
              ? "macOS"
              : /CrOS/.test(ua)
                ? "ChromeOS"
                : /Linux/.test(ua)
                  ? "Linux"
                  : "système inconnu",
      navigateur = /Edg(A|iOS)?\//.test(ua)
        ? "Edge"
        : /OPR\/|Opera/.test(ua)
          ? "Opera"
          : /SamsungBrowser/.test(ua)
            ? "Samsung Internet"
            : /Firefox\/|FxiOS/.test(ua)
              ? "Firefox"
              : /Chrome\/|CriOS/.test(ua)
                ? "Chrome"
                : /Safari\//.test(ua)
                  ? "Safari"
                  : "navigateur inconnu",
      gestionnaire = "extension du navigateur",
      id = "";
    try {
      gestionnaire = String(GM_info.scriptHandler || "gestionnaire de scripts");
    } catch (e) {}
    try {
      id = localStorage.getItem(CLE_ID_APPAREIL) || "";
      if (!/^[0-9a-f]{4}$/.test(id)) {
        id = Math.floor(Math.random() * 0x10000)
          .toString(16)
          .padStart(4, "0");
        localStorage.setItem(CLE_ID_APPAREIL, id);
      }
    } catch (e) {}
    return [`${navigateur} ${systeme}`, gestionnaire, id].filter((x) => x).join(" · ");
  }
  /**
   * Valeur d'un paramètre (Parametre de Joueur) telle que les Préférences la
   * montrent : le texte du choix, oui ou non, le nombre écrit à la française.
   *
   * @private
   * @static
   * @param {any} p
   * @return {String}
   */
  static _valeurParametre(p) {
    let v = p.valeur;
    if (p.type == "checkbox") return v === true || v == 1 || v === "true" ? "oui" : "non";
    if (p.type == "select") {
      let possibles = Array.isArray(p.valeurPossible) ? p.valeurPossible : [],
        choix = possibles.length
          ? possibles[v]
          : /** @type {any} */ (UNITES_PARAMETRES)[p.id]?.(Number(v));
      if (choix != null) return String(typeof choix == "object" ? choix.libelle || "" : choix);
    }
    if (typeof v == "number") return Utils.decimal(v, 2, true);
    if (v != null && typeof v == "object") return JSON.stringify(v);
    return String(v == null ? "" : v);
  }
  /**
   * Réglages envoyés, dans l'ordre de leurs lignes : l'appareil, les pages et
   * les affichages de Préférences, les paramètres, le partage de données.
   *
   * @static
   * @method valeurs
   * @return {Array<{groupe: String, cle: String, libelle: String, valeur: String}>}
   */
  static valeurs() {
    /** @type {Array<{groupe: String, cle: String, libelle: String, valeur: String}>} */
    let liste = [],
      oui = (/** @type {Boolean} */ b) => (b ? "oui" : "non"),
      ajouter = (
        /** @type {String} */ groupe,
        /** @type {String} */ cle,
        /** @type {String} */ libelle,
        /** @type {any} */ valeur,
      ) => liste.push({ groupe, cle, libelle, valeur: String(valeur == null ? "" : valeur) }),
      gestionnaire = "extension du navigateur";
    try {
      gestionnaire =
        `${GM_info.scriptHandler || "gestionnaire de scripts"} ${GM_info.version || ""}`.trim();
    } catch (e) {}
    ajouter("Appareil", "version", "Version de l'extension", VERSION);
    ajouter("Appareil", "script", "Script", NOM_EXTENSION);
    ajouter("Appareil", "gestionnaire", "Gestionnaire de scripts", gestionnaire);
    ajouter("Appareil", "navigateur", "Navigateur", navigator.userAgent.slice(0, 300));
    ajouter(
      "Appareil",
      "fenetre",
      "Taille de la fenêtre",
      `${window.innerWidth} × ${window.innerHeight}`,
    );
    ajouter("Appareil", "comptePlus", "Compte+", oui(Utils.comptePlus));
    ajouter("Appareil", "serveur", "Serveur", location.hostname);
    PAGES_EXTENSION.forEach((g) =>
      ajouter(
        "Pages",
        "page." + g.id,
        g.id == "General" ? "Toutes les pages" : g.libelle,
        oui(!Utils.origine(g.id)),
      ),
    );
    /** @type {Record<String, String>} */
    let libelles = { ...AFFICHAGES_FZZZ, ...AFFICHAGES_CONVOIS };
    Object.keys(AFFICHAGES_REGLABLES).forEach((cle) => {
      let onglet = ONGLETS_PARAMETRE.find((o) => (o.affichages || []).includes(cle));
      ajouter(
        "Affichages" + (onglet ? " · " + onglet.titre : ""),
        "affichage." + cle,
        libelles[cle] || cle,
        oui(Utils.affichageCoche(cle)),
      );
    });
    Object.values((monProfil && monProfil.parametre) || {}).forEach((p) => {
      if (p && p.id)
        ajouter(
          "Paramètres",
          "parametre." + p.id,
          p.libelle || p.id,
          EnvoiReglages._valeurParametre(p),
        );
    });
    DONNEES_PARTAGEES.forEach((d) =>
      ajouter(
        "Partage de données",
        "partage." + d.cle,
        "Stats membres : " + d.libelle,
        oui(SuiviMembres.partage(d.cle)),
      ),
    );
    ajouter(
      "Partage de données",
      "partage.journal",
      "Envoyer mon journal de débug",
      oui(EnvoiJournal.coche()),
    );
    ajouter(
      "Partage de données",
      "partage.exportChasses",
      "Exporter mes chasses automatiquement",
      oui(ExportAuto.coche()),
    );
    return liste;
  }
  /**
   * À chaque page : envoie les réglages s'ils sont dus (pas encore envoyés
   * aujourd'hui, ou la version a changé depuis) ; un échec est repris à une
   * page ouverte au moins SUIVI_PAUSE_ESSAIS plus tard, SUIVI_ESSAIS_PAR_JOUR
   * fois par jour au plus, comme le relevé des stats.
   *
   * @static
   * @method lancer
   * @return {Promise<String>} "sans alliance", "page", "attente", "sans sujet", "envoyé" ou "échec"
   */
  static lancer() {
    if (!monProfil.pseudo || !Utils.alliance) return Promise.resolve("sans alliance");
    // pages où un envoi minuté à la seconde près ne doit rien attendre
    if (Utils.pageSansAlertePonte(location)) return Promise.resolve("page");
    let jour = SuiviMembres.jour(),
      instant = Horloge.maintenant(),
      etat = EnvoiReglages.etat();
    if (etat.joueur != monProfil.pseudo || etat.jour != jour || etat.version != VERSION)
      etat = { joueur: monProfil.pseudo, jour, version: VERSION, fait: false, essais: 0, essai: 0 };
    if (
      etat.fait ||
      etat.essais >= SUIVI_ESSAIS_PAR_JOUR ||
      instant - (etat.essai || 0) < SUIVI_PAUSE_ESSAIS
    )
      return Promise.resolve("attente");
    // noté avant la requête : une page quittée en route ne compte pas pour rien
    etat = { ...etat, essais: (etat.essais || 0) + 1, essai: instant, raison: "" };
    EnvoiReglages._garder(etat);
    let fin = (/** @type {String} */ resultat, /** @type {any} */ suite) => {
      EnvoiReglages._garder({ ...etat, ...suite });
      return resultat;
    };
    return SuiviMembres.adresse()
      .then(({ url, manque }) => {
        if (manque == "adresse") throw new Error(SuiviMembres.sansAdresse(manque));
        if (!url) {
          Journal.info(
            JOURNAL_REGLAGES,
            `réglages non envoyés aujourd'hui : ${SuiviMembres.sansAdresse(manque)}`,
          );
          return fin("sans sujet", { fait: true, raison: "sans sujet" });
        }
        let valeurs = EnvoiReglages.valeurs();
        return EnvoiReglages.envoyer(url, valeurs).then(() => {
          Journal.info(
            JOURNAL_REGLAGES,
            `réglages envoyés au Google Sheet des stats membres : ${valeurs.length} ligne(s)`,
          );
          return fin("envoyé", { fait: true });
        });
      })
      .catch((e) => {
        let raison = String((e && e.message) || "forum illisible");
        // script d'avant la requête « reglages »
        if (/requête invalide/.test(raison)) raison = SCRIPT_SANS_REGLAGES;
        Journal.info(JOURNAL_REGLAGES, `réglages non envoyés : ${raison}`);
        return fin("échec", { raison });
      });
  }
  /**
   * @static
   * @method envoyer
   * @param {String} url adresse du script du fichier
   * @param {Array<any>} valeurs voir valeurs
   * @return {Promise<any>} réponse du script
   */
  static envoyer(url, valeurs) {
    return ExportRapports.requete(url, "POST", {
      reglages: {
        joueur: monProfil.pseudo,
        appareil: EnvoiReglages.appareil(),
        version: VERSION,
        valeurs: valeurs.map((v) => ({ ...v, valeur: Journal.masquer(v.valeur) })),
      },
    }).then((r) => {
      if (!r.ok) throw new Error("réponse inattendue du script");
      return r;
    });
  }
}
