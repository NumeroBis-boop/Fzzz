// @ts-check
/*
 * ReglagesAlliance.js
 * Réglages propres à une alliance (adresses de ses sites et de ses fichiers,
 * listes de joueurs), écrits à la main par un chef dans le premier message du
 * sujet caché TITRE_REGLAGES : rien de l'alliance n'est écrit dans le code
 * (règle du mainteneur, 18/11/2026).
 **********************************************************************/

const TITRE_REGLAGES = "Réglages de l'extension";
// dernière lecture du sujet et dernier essai, dans le localStorage du jeu (propre au serveur)
const CLE_REGLAGES_ALLIANCE = "fzzz_reglagesAlliance";
// une ligne « Nom : valeur » par réglage, nom sans tenir compte de la casse ni des accents
const REGLAGES_ALLIANCE = {
  siteConvois: { nom: "Site de suivi des convois", type: "site" },
  feuilleRc: { nom: "Google Sheet des RC", type: "sheet" },
  autorisesRc: { nom: "Joueurs autorisés à partager des RC", type: "liste" },
  feuilleStats: { nom: "Google Sheet des stats membres", type: "sheet" },
  chasseurs: { nom: "Chasseurs", type: "liste" },
  greniers: { nom: "Greniers", type: "liste" },
  journal: { nom: "Journal", type: "liste" },
};
// lecture gardée relue au plus une fois par heure, à l'ouverture d'une page
const REGLAGES_RELECTURE = 3600000;
// lecture assez récente pour servir telle quelle à une fonction qui en a besoin
const REGLAGES_FRAIS = 60000;
const ADRESSE_SITE = /^https?:\/\/[a-z0-9.-]+(?::\d+)?(?:\/[^\s"'<>]*)?$/i;

class ReglagesAlliance {
  /**
   * @static
   * @method vides
   * @return {{siteConvois: String, feuilleRc: String, autorisesRc: Array<String>, feuilleStats: String, chasseurs: Array<String>, greniers: Array<String>, journal: Array<String>, lignes: Array<String>}}
   */
  static vides() {
    return {
      siteConvois: "",
      feuilleRc: "",
      autorisesRc: [],
      feuilleStats: "",
      chasseurs: [],
      greniers: [],
      journal: [],
      lignes: [],
    };
  }
  /**
   * @private
   * @static
   * @param {String} texte
   * @return {String} minuscules sans accent, espaces simples
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
   * Réglages du premier message du sujet (réponse de callGetTopic). Une
   * adresse que le forum a changée en lien, au texte parfois raccourci, est
   * lue dans son href.
   *
   * @static
   * @method lire
   * @param {any} data réponse xajax
   * @return {ReturnType<typeof ReglagesAlliance.vides>}
   */
  static lire(data) {
    let $div = Utils.parseHtml(PartageChasses._html(data)),
      $premier = $div.find(".messageForum").first(),
      $message = $premier.length ? $premier : $div;
    $message.find("a[href]").each((/** @type {Number} */ i, /** @type {Element} */ a) => {
      let href = String(a.getAttribute("href") || "");
      if (/^https?:\/\//i.test(href) && /^\s*(https?:\/\/|www\.)/i.test($(a).text()))
        $(a).replaceWith(` ${href} `);
    });
    $message.find("br").replaceWith("\n");
    return ReglagesAlliance.lireTexte($message.text());
  }
  /**
   * Une ligne « Nom : valeur » par réglage ; une valeur peut continuer sur les
   * lignes suivantes, jusqu'à une ligne vide ou la prochaine ligne « Nom : … »,
   * pour qu'une phrase écrite sous une liste n'y ajoute pas ses mots. Lignes
   * inconnues ignorées.
   *
   * @static
   * @method lireTexte
   * @param {String} texte
   * @return {ReturnType<typeof ReglagesAlliance.vides>}
   */
  static lireTexte(texte) {
    let r = ReglagesAlliance.vides(),
      /** @type {String|null} */ courant = null;
    for (let ligne of String(texte || "").split("\n")) {
      if (!ligne.trim()) {
        courant = null;
        continue;
      }
      let m = /^\s*([^:]{2,60}?)\s*:\s*(.*)$/.exec(ligne);
      if (m && !/^https?$/i.test(m[1].trim())) {
        let nom = ReglagesAlliance._nom(m[1]);
        courant =
          Object.keys(REGLAGES_ALLIANCE).find(
            (c) => ReglagesAlliance._nom(REGLAGES_ALLIANCE[c].nom) == nom,
          ) || null;
        if (courant) {
          if (!r.lignes.includes(courant)) r.lignes.push(courant);
          ReglagesAlliance._ajouter(r, courant, m[2]);
        }
      } else if (courant) ReglagesAlliance._ajouter(r, courant, ligne);
    }
    return r;
  }
  /**
   * @private
   * @static
   * @param {any} r
   * @param {String} cle
   * @param {String} valeur
   */
  static _ajouter(r, cle, valeur) {
    let type = REGLAGES_ALLIANCE[cle].type;
    if (type == "liste") {
      for (let p of String(valeur).split(/[\s,;]+/)) {
        let pseudo = PartageChasses.nettoyer(p).replace(/\.+$/, "");
        if (
          pseudo &&
          !/[:/]/.test(pseudo) &&
          !r[cle].some((/** @type {String} */ x) => x.toLowerCase() == pseudo.toLowerCase())
        )
          r[cle].push(pseudo);
      }
    } else if (!r[cle]) {
      let m =
        type == "sheet"
          ? /https:\/\/script\.google\.com\/[^\s"'<>]+?\/exec\b/.exec(valeur)
          : /https?:\/\/[^\s"'<>]+/i.exec(valeur);
      let url = m ? m[0].replace(/[.,;)]+$/, "") : "";
      if (type == "sheet" ? ExportRapports.adresseValide(url) : ADRESSE_SITE.test(url))
        r[cle] = url;
    }
  }
  /**
   * @private
   * @static
   * @return {any} ce qui est gardé tel quel (dernière lecture, dernier essai), null sans rien
   */
  static _brut() {
    try {
      return JSON.parse(localStorage.getItem(CLE_REGLAGES_ALLIANCE) || "null");
    } catch (e) {
      return null;
    }
  }
  /**
   * @private
   * @static
   * @param {Object} g
   */
  static _ecrire(g) {
    try {
      localStorage.setItem(CLE_REGLAGES_ALLIANCE, JSON.stringify(g));
    } catch (e) {}
  }
  /**
   * @private
   * @static
   * @return {String} tag de l'alliance affiché par la page, "" sans alliance
   */
  static _tag() {
    return String($("#tag_alliance").text() || "").trim();
  }
  /**
   * Dernière lecture gardée dans ce navigateur pour ce serveur (le localStorage
   * du jeu est propre à chaque serveur) ; celle d'une autre alliance que celle
   * de la page (le joueur en a changé) ne compte pas.
   *
   * @static
   * @method garde
   * @return {{lu: Number, version: String, alliance: String, section: Boolean, sujet: Boolean, reglages: ReturnType<typeof ReglagesAlliance.vides>}|null}
   */
  static garde() {
    let g = ReglagesAlliance._brut(),
      tag = ReglagesAlliance._tag();
    if (!g || !g.reglages) return null;
    if (g.alliance && tag && String(g.alliance).toLowerCase() != tag.toLowerCase()) return null;
    return { ...g, reglages: { ...ReglagesAlliance.vides(), ...g.reglages } };
  }
  /**
   * @private
   * @static
   * @param {Boolean} section section cachée trouvée
   * @param {Boolean} sujet sujet des réglages trouvé
   * @param {ReturnType<typeof ReglagesAlliance.vides>} reglages
   */
  static _garder(section, sujet, reglages) {
    let g = {
      ...ReglagesAlliance._brut(),
      lu: Horloge.maintenant(),
      version: PartageChasses._version(),
      alliance: ReglagesAlliance._tag(),
      section,
      sujet,
      reglages,
    };
    ReglagesAlliance._ecrire(g);
    return g;
  }
  /**
   * Essai de lecture noté avant la requête, réussi ou non : il règle le rythme
   * de la relecture à l'ouverture des pages (actualiser).
   *
   * @private
   * @static
   */
  static _noterEssai() {
    ReglagesAlliance._ecrire({
      ...ReglagesAlliance._brut(),
      essai: Horloge.maintenant(),
      versionEssai: PartageChasses._version(),
    });
  }
  /**
   * @private
   * @static
   * @param {Number} duree
   * @return {Boolean} lecture gardée par cette version du script depuis moins de `duree`
   */
  static _recente(duree) {
    let g = ReglagesAlliance.garde(),
      age = g ? Horloge.maintenant() - g.lu : NaN;
    return !!g && g.version === PartageChasses._version() && age >= 0 && age < duree;
  }
  /**
   * @private
   * @static
   * @param {Number} duree
   * @return {Boolean} essai de lecture fait par cette version du script depuis moins de `duree`
   */
  static _essaiRecent(duree) {
    let g = ReglagesAlliance._brut(),
      age = g && g.essai ? Horloge.maintenant() - g.essai : NaN;
    return !!g && g.versionEssai === PartageChasses._version() && age >= 0 && age < duree;
  }
  /**
   * Réglages de la dernière lecture gardée, vides sans lecture.
   *
   * @static
   * @method reglages
   * @return {ReturnType<typeof ReglagesAlliance.vides>}
   */
  static reglages() {
    let g = ReglagesAlliance.garde();
    return g ? g.reglages : ReglagesAlliance.vides();
  }
  /**
   * @static
   * @method contient
   * @param {"chasseurs"|"greniers"|"journal"|"autorisesRc"} cle
   * @param {String} pseudo
   * @return {Boolean} pseudo dans cette liste de la dernière lecture, casse ignorée
   */
  static contient(cle, pseudo) {
    let p = String(pseudo || "")
      .trim()
      .toLowerCase();
    return !!p && ReglagesAlliance.reglages()[cle].some((j) => j.toLowerCase() == p);
  }
  /**
   * Lit le sujet des réglages dans le forum. Sans section cachée visible ni
   * sujet : réglages vides, gardés ; une réponse du forum sans la section déjà
   * lue pour cette alliance est prise pour une panne, ses réglages restent.
   *
   * @static
   * @method charger
   * @param {Object} [options] réglages de plus pour les requêtes du forum (PartageChasses._xajax)
   * @param {"garde"|"sujet"|"tout"} [lecture] "garde" : une lecture de moins d'une
   *   minute sert telle quelle ; "sujet" : le sujet est relu (clic d'un export : le
   *   forum fait foi), la liste des sujets pouvant venir de la minute écoulée ;
   *   "tout" : liste et sujet relus (bouton « Relire les réglages »)
   * @return {Promise<{section: Boolean, sujet: Boolean, reglages: ReturnType<typeof ReglagesAlliance.vides>}>} rejetée si le forum ne se lit pas
   */
  static charger(options = {}, lecture = "garde") {
    if (lecture == "garde" && ReglagesAlliance._recente(REGLAGES_FRAIS))
      return Promise.resolve(/** @type {any} */ (ReglagesAlliance.garde()));
    ReglagesAlliance._noterEssai();
    return PartageChasses.sujets(lecture != "tout", options).then(
      (sujets) =>
        sujets.reglages
          ? PartageChasses._xajax("callGetTopic", sujets.reglages, options).then((data) =>
              ReglagesAlliance._garder(true, true, ReglagesAlliance.lire(data)),
            )
          : ReglagesAlliance._garder(true, false, ReglagesAlliance.vides()),
      (e) => {
        if (e && e.message == "absente") {
          let avant = ReglagesAlliance.garde();
          if (avant && avant.section) throw new Error("section cachée introuvable");
          // section inexistante ou cachée au grade du joueur : pas une panne
          return ReglagesAlliance._garder(false, false, ReglagesAlliance.vides());
        }
        throw e;
      },
    );
  }
  /**
   * Ce que dit la dernière lecture, pour Préférences → Partage de données : les
   * adresses des Google Sheet, qui permettent d'y écrire, ne sont jamais montrées.
   *
   * @static
   * @method resume
   * @return {String}
   */
  static resume() {
    let g = ReglagesAlliance.garde();
    if (!g) return "Réglages de l'alliance pas encore lus dans ce navigateur.";
    let minutes = Math.max(0, Math.round((Horloge.maintenant() - g.lu) / 60000)),
      quand = minutes < 1 ? "à l'instant" : `il y a ${numeral(minutes).format()} min`;
    if (!g.section)
      return `Lus ${quand} : section cachée « ${FORUM_SECTIONS_CHASSES[0]} » introuvable ou invisible pour ton grade.`;
    if (!g.sujet)
      return `Lus ${quand} : pas de sujet « ${TITRE_REGLAGES} » dans la section cachée.`;
    let r = g.reglages,
      liste = (/** @type {Array<String>} */ l) => numeral(l.length).format();
    return `Lus ${quand} : site de suivi des convois ${r.siteConvois ? r.siteConvois.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : "absent"} ; Google Sheet des RC ${r.feuilleRc ? "renseigné" : "absent"} (${liste(r.autorisesRc)} joueur(s) autorisé(s)) ; Google Sheet des stats membres ${r.feuilleStats ? "renseigné" : "absent"} ; ${liste(r.chasseurs)} chasseur(s), ${liste(r.greniers)} grenier(s), ${liste(r.journal)} au journal.`;
  }
  /**
   * Relit les réglages à l'ouverture d'une page, au plus une fois par heure
   * (essai raté compris) et à la priorité la plus faible ; jamais sur les pages Armée et d'attaque, où
   * une lecture en cours retarderait un envoi réglé à la seconde, ni sans
   * alliance (pas de forum).
   *
   * @static
   * @method actualiser
   * @return {Promise<void>}
   */
  static actualiser() {
    if (
      !Utils.alliance ||
      ReglagesAlliance._recente(REGLAGES_RELECTURE) ||
      ReglagesAlliance._essaiRecent(REGLAGES_RELECTURE) ||
      Utils.pageSansAlertePonte(location)
    )
      return Promise.resolve();
    return ReglagesAlliance.charger({ fond: true }).then(
      () => {},
      (e) =>
        Journal.info(
          "Réglages de l'alliance",
          "sujet des réglages non relu",
          String(e && e.message),
        ),
    );
  }
}
