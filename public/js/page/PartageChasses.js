// @ts-check
/*
 * PartageChasses.js
 * NumeroBis-boop
 **********************************************************************/

// section du forum d'alliance qui sert de stockage partagé (premier nom : celui
// créé par l'extension ; les anciens noms restent reconnus)
const FORUM_SECTIONS_CHASSES = ["BDD partagée cachée", "Fzzz-Chasses", "Fzzz_Chasses"];
// le forum ne liste que les sections que le grade du joueur voit : une section
// cachée à son grade est introuvable comme une section qui n'existe pas
const SECTION_INTROUVABLE = `Section « ${FORUM_SECTIONS_CHASSES[0]} » introuvable : elle n'existe pas encore, ou ton grade ne la voit pas. Demande à un chef.`;
// entrées gardées par sujet (les plus récentes)
const PARTAGE_MAX_ENTREES = 300;
// actions passées : sujets « Historique Chasses N | pseudo » (et Floods),
// un seul message chacun, car une réponse empêche de modifier le premier
// message ; page suivante quand ce message dépasserait cette taille
const HISTORIQUE_MAX_CARACTERES = 15000;
// sujet où la personne qui gère le Google Sheet de l'alliance poste, à la main,
// l'adresse du script qui reçoit les rapports exportés et la liste des joueurs
// qui l'utilisent (ExportRapports.lireReglage)
const TITRE_EXPORT_SHEET = "Export Google Sheet";
// sujets où l'alliance tient à la main ses listes de GIF et de smileys pour le chat (ChatGif)
const TITRE_GIF_ALLIANCE = "GIF de l'alliance";
const TITRE_SMILEYS_ALLIANCE = "Smileys de l'alliance";
// sujet où est postée, à la main, l'adresse du script du fichier qui reçoit le
// relevé quotidien des statistiques des membres (SuiviMembres)
const TITRE_STATS_MEMBRES = "Stats membres";

// numéros des attaques déjà publiées dans la section du joueur (sujet commun des floods)
const CLE_FLOODS_PARTAGES = "fzzz_floodsPartages";
// floods à retirer du forum, notés avant l'écriture : une page quittée trop
// tôt n'empêche pas le retrait, repris au chargement de la page suivante
const CLE_FLOODS_A_RETIRER = "fzzz_floodsARetirer";
// dernière minute d'impact des chasses partagées depuis ce navigateur
// ("AAAA-MM-JJ HH:mm") : tant qu'elle n'est pas passée, la page Ressources
// recale le sujet « Chasses » sur les chasses encore en cours
const CLE_FIN_CHASSES_PARTAGEES = "fzzz_finChassesPartagees";
// échéance (ms) du partage des chasses demandé par « Envoyer + partager »
const CLE_PARTAGE_CHASSES_APRES = "fzzz_partageChassesApres";
// lectures et écritures de mes partages d'une page, l'une après l'autre :
// une lecture partie avant une écriture rendrait un état périmé
let fileFloodsForum = Promise.resolve();
// numéros dont le retrait est déjà en cours sur cette page
let retraitsEnCours = new Set();
// sujets lus pour l'affichage, réutilisés une minute d'une page à l'autre par
// la même version du script ; les écritures relisent toujours le forum (un
// autre appareil a pu écrire)
const CLE_CACHE_FORUM = "fzzz_cacheForum";
const DUREE_CACHE_FORUM = 60000;
// sujets communs lus pour l'affichage, gardés une minute comme les autres
// lectures : la colonne « Dernier message » de la liste ne change pas quand
// leur premier message est modifié (relevé du 14/11/2026), elle ne dit pas
// qu'un joueur y a écrit
const CLE_SUJETS_GARDES = "fzzz_sujetsGardes";
const DUREE_SUJETS_GARDES = 24 * 3600 * 1000;
// mois de la colonne « Dernier message » (« 13 nov. à 22h20 »)
const MOIS_FORUM = [
  /^janv?/,
  /^f[ée]vr?/,
  /^mars?/,
  /^avr/,
  /^mai/,
  /^juin/,
  /^juil/,
  /^ao[uû]t?/,
  /^sept?/,
  /^oct/,
  /^nov/,
  /^d[ée]c/,
];
// sujets communs à l'alliance, un par type, créés à la main avec un premier
// message modifiable par tous : une section par joueur, ses floods ou ses
// chasses en cours ; l'affichage lit un sujet au lieu d'un par joueur. Titre
// réécrit tel quel à chaque écriture
const SUJETS_COMMUNS = {
  Floods: "BDD générale flood - NE RIEN ÉCRIRE",
  Chasses: "BDD générale chasse - NE RIEN ÉCRIRE",
};
// « --- pseudo · AAAA-MM-JJ HH:mm:ss --- » : heure du serveur de sa dernière écriture
const ENTETE_SECTION = /^\s*---\s*(.+?)\s*·\s*(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)\s*---\s*$/;
// un message du forum est coupé au-delà d'une taille maximale (relevé du
// 13/11/2026 : 63 253 caractères gardés, 65 484 octets) : au-delà de ce seuil
// prudent, le partage est refusé plutôt que coupé
const COMMUN_MAX_CARACTERES = 40000;
// entrées à venir gardées par section (les plus proches) : un joueur seul ne remplit pas le sujet
const COMMUN_MAX_ENTREES = 100;
// le forum n'a pas de verrou : un membre qui a lu le sujet commun juste avant
// une écriture la défait en écrivant la sienne ; relu après cette pause, écrit
// de nouveau sinon
const PAUSE_VERIF_COMMUN = 4000;
const ESSAIS_COMMUN = 3;
// un message ne peut pas être vide
const COMMUN_VIDE = "Aucun partage en cours.";

/**
 * Partage des chasses et des floods avec l'alliance, stocké dans son forum
 * (aucun serveur tiers), section « BDD partagée cachée » : deux sujets
 * communs (SUJETS_COMMUNS), une section par joueur dans leur premier message
 * avec ses entrées en cours, une ligne par entrée ; chaque partage réécrit la
 * section du joueur (fusion sans doublon) et les chasses et floods passés
 * partent dans « Historique <type> N | pseudo » (voir archiver). Les convois
 * restent dans « Convois | pseudo » (ConvoisForum).
 *
 * Requêtes : au clic sur Partager, au chargement de page qui suit un envoi
 * « + partager » ou l'annulation d'un flood partagé, et la lecture des sujets
 * communs à l'ouverture d'une page membre ou de la page Armée (bloc « Mes
 * attaques en cours »). Rien de périodique.
 *
 * @class PartageChasses
 */
class PartageChasses {
  /**
   * Passe `action` (lecture ou écriture de mes partages) après les
   * précédentes de la page.
   *
   * @static
   * @method enFile
   * @param {() => any} action renvoie une promesse
   * @return {Promise}
   */
  static enFile(action) {
    let p = fileFloodsForum.then(action);
    fileFloodsForum = p.catch(() => {});
    return p;
  }
  static get cle() {
    return "fzzz_forumChasses_" + Utils.serveur;
  }
  static get idSection() {
    try {
      return localStorage.getItem(PartageChasses.cle);
    } catch (e) {
      return null;
    }
  }
  static set idSection(id) {
    try {
      if (id) localStorage.setItem(PartageChasses.cle, id);
      else localStorage.removeItem(PartageChasses.cle);
    } catch (e) {}
  }
  static estSection(nom) {
    // nom affiché par le forum : casse, espaces et accents composés tolérés
    let normaliser = (t) => String(t).normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
    return FORUM_SECTIONS_CHASSES.some((n) => normaliser(n) == normaliser(nom));
  }
  /**
   * Requête xajax du forum d'alliance (même protocole que la page Forum).
   *
   * @static
   * @param {String} fonction
   * @param {any} [args]
   * @param {Object} [options] réglages de plus pour $.ajax, ex. {fond: true} (Requetes.js)
   */
  static _xajax(fonction, args, options = {}) {
    let requete = Promise.resolve(
      $.ajax({
        type: "post",
        url: location.origin + "/alliance.php?forum_menu",
        data:
          args === undefined
            ? { xajax: fonction, xajaxr: moment().valueOf() }
            : { xajax: fonction, "xajaxargs[]": args, xajaxr: moment().valueOf() },
        ...options,
      }),
    );
    // sujet créé ou modifié : les lectures gardées ne sont plus à jour
    if (/^envoi/.test(fonction)) {
      PartageChasses.oublierCache();
      requete.then(PartageChasses.oublierCache, PartageChasses.oublierCache);
    }
    return requete;
  }
  /**
   * Lecture du forum gardée DUREE_CACHE_FORUM : `lire` n'est appelée que si la
   * dernière lecture de `cle` est plus ancienne. Le résultat est gardé.
   *
   * @static
   * @method _enCache
   * @param {String} cle
   * @param {Boolean} accepte false : lecture neuve (avant une écriture)
   * @param {() => Promise} lire
   * @return {Promise}
   */
  static _enCache(cle, accepte, lire) {
    let cache = Utils.lireStockage(CLE_CACHE_FORUM),
      version = PartageChasses._version(),
      e = cache[cle];
    // lecture gardée par une autre version du script (mise à jour, version
    // TEST) : elle n'a pas forcément retenu les mêmes choses du forum
    if (accepte && e && e.version === version && Date.now() - e.t < DUREE_CACHE_FORUM) {
      if (typeof COMPTE_REQUETES != "undefined") COMPTE_REQUETES.cache++;
      return Promise.resolve(e.v);
    }
    return lire().then((v) => {
      let maintenant = Date.now(),
        garde = Utils.lireStockage(CLE_CACHE_FORUM);
      for (let k in garde) if (maintenant - garde[k].t >= DUREE_CACHE_FORUM) delete garde[k];
      garde[cle] = { t: maintenant, v, version };
      try {
        localStorage.setItem(CLE_CACHE_FORUM, JSON.stringify(garde));
      } catch (err) {}
      return v;
    });
  }
  /**
   * @private
   * @static
   * @return {String} version du script ; "" tant que content.js n'est pas chargé
   */
  static _version() {
    try {
      return VERSION;
    } catch (e) {
      return "";
    }
  }
  /**
   * @static
   * @method oublierCache
   */
  static oublierCache() {
    try {
      localStorage.removeItem(CLE_CACHE_FORUM);
    } catch (e) {}
  }
  /**
   * Texte HTML de toutes les commandes d'une réponse xajax.
   *
   * @static
   */
  static _html(data) {
    return $(data)
      .find("cmd")
      .map((i, c) => $(c).text())
      .get()
      .join("");
  }
  /**
   * Texte du premier message d'un sujet (réponse de callGetTopic), retours à
   * la ligne compris : le suivi ne lit jamais les messages suivants (une
   * réponse d'un membre, l'historique). Sans message repéré, tout le sujet.
   *
   * @static
   * @method premierMessage
   * @param {any} data réponse xajax
   * @return {String}
   */
  static premierMessage(data) {
    let $div = Utils.parseHtml(PartageChasses._html(data)),
      $premier = $div.find(".messageForum").first(),
      $texte = $premier.length ? $premier : $div;
    $texte.find("br").replaceWith("\n");
    return $texte.text();
  }
  /**
   * Identifiant de la section : celui mémorisé, sinon lu dans la liste des
   * sections que renvoie le forum (le même appel que la page Forum du jeu).
   *
   * @static
   * @method trouverSection
   * @param {Object} [options] réglages de plus pour $.ajax (_xajax)
   * @return {Promise<String>} rejetée avec Error("absente") si la section n'est pas
   *   dans la liste (inexistante, ou cachée au grade du joueur)
   */
  static trouverSection(options = {}) {
    if (PartageChasses.idSection) return Promise.resolve(PartageChasses.idSection);
    return PartageChasses._xajax("callGetForum", undefined, options).then((data) => {
      // DOMParser : le HTML du forum (écrit par des membres) n'exécute rien
      let $span = Utils.parseHtml(PartageChasses._html(data))
          .find("span[class^='forum']")
          .filter((i, e) => PartageChasses.estSection($(e).text()))
          .first(),
        id = $span.length ? ($span.attr("class").match(/\d+/) || [])[0] : null;
      if (!id) throw new Error("absente");
      PartageChasses.idSection = id;
      return id;
    });
  }
  /**
   * Pseudo ou cible lu dans le forum, texte libre écrit par un membre : les
   * caractères de balisage (< > & " ') n'existent pas dans un pseudo du jeu et
   * sont retirés, pour qu'aucune balise ne puisse être injectée.
   *
   * @static
   * @method nettoyer
   */
  static nettoyer(texte) {
    return String(texte || "")
      .replace(/[<>&"']/g, "")
      .trim();
  }
  /**
   * Sujets de la section : {"Convois | pseudo": idSujet, communs, historiques…}.
   *
   * @static
   * @method sujets
   * @param {Boolean} [cache] lecture de moins d'une minute acceptée (affichage)
   * @param {Object} [options] réglages de plus pour $.ajax (_xajax)
   */
  static sujets(cache = false, options = {}) {
    return PartageChasses.trouverSection(options).then((id) =>
      PartageChasses._enCache("sujets", cache, () => PartageChasses._lireSujets(id, options)),
    );
  }
  /**
   * @private
   * @static
   * @param {String} id
   * @param {Object} [options]
   */
  static _lireSujets(id, options = {}) {
    return PartageChasses._xajax("callGetForum", id, options).then((data) => {
      let reponse = PartageChasses._html(data);
      if (!reponse.includes("form_cat")) {
        // identifiant périmé (section supprimée puis recréée) : on le relira
        PartageChasses.idSection = null;
        throw new Error("section inaccessible");
      }
      // clé « Convois | pseudo en minuscules » → id du sujet des convois du joueur ;
      // sujets.liste : anciens sujets « Floods | … » / « Chasses | … » des joueurs
      // pas encore à jour {type, pseudo, id, dernier, modifie}, lus seulement par
      // « Ranger le forum » ;
      // sujets.historiques : pages d'historique {type, page, pseudo, id} ;
      // sujets.exportSheet : sujet de l'adresse du Google Sheet ;
      // sujets.gifAlliance, sujets.smileysAlliance : sujets des GIF et des smileys de l'alliance ;
      // sujets.statsMembres : sujet de l'adresse du fichier des statistiques des membres
      // sujets.communs : sujets communs par type {type, id, dernier, modifie}
      let sujets = { liste: [], historiques: [], communs: {} },
        // titre écrit à la main : casse, espaces et apostrophe typographique tolérés
        normaliser = (/** @type {String} */ t) =>
          t
            .toLowerCase()
            .replace(/[’‘`]/g, "'")
            .replace(/\s+/g, " ")
            .trim();
      Utils.parseHtml(reponse)
        .find("#form_cat tr")
        .each((i, elt) => {
          let titre = $(elt).find("td:eq(1)").text().trim(),
            m = titre.match(/^Convois \| (.+)$/),
            suivi = titre.match(/^(Chasses|Floods) \| (.+)$/),
            h = titre.match(/^Historique (Chasses|Floods) (\d+) \| (.+)$/),
            idSujet =
              $(elt).find("input[name='topic[]']").val() ||
              (($(elt).find("a.topic_forum").attr("onclick") || "").match(/\d+/) || [])[0],
            // colonne « Dernier message » : auteur et minute de la création ou de la
            // dernière réponse ; une modification d'un message ne la change pas
            dernier = $(elt)
              .find("td")
              .slice(2)
              .contents()
              .map((i, n) => $(n).text())
              .get()
              .join(" ")
              .replace(/\s+/g, " ")
              .trim(),
            commun = Object.keys(SUJETS_COMMUNS).find((type) =>
              PartageChasses.estCommun(titre, type),
            );
          // titre écrit par un membre : caractères de balisage retirés
          if (m && idSujet)
            sujets[`Convois | ${PartageChasses.nettoyer(m[1]).toLowerCase()}`] = idSujet;
          if (suivi && idSujet)
            sujets.liste.push({
              type: suivi[1],
              pseudo: PartageChasses.nettoyer(suivi[2]),
              id: idSujet,
              dernier,
              modifie: PartageChasses.dateListe(dernier),
            });
          if (
            commun &&
            idSujet &&
            (!sujets.communs[commun] || Number(idSujet) < Number(sujets.communs[commun].id))
          )
            sujets.communs[commun] = {
              type: commun,
              id: idSujet,
              dernier,
              modifie: PartageChasses.dateListe(dernier),
            };
          // créé deux fois (deux enregistrements au même instant) : le plus ancien fait foi
          if (
            titre == TITRE_EXPORT_SHEET &&
            idSujet &&
            (!sujets.exportSheet || Number(idSujet) < Number(sujets.exportSheet))
          )
            sujets.exportSheet = idSujet;
          for (let [cle, titreListe] of [
            ["gifAlliance", TITRE_GIF_ALLIANCE],
            ["smileysAlliance", TITRE_SMILEYS_ALLIANCE],
            ["statsMembres", TITRE_STATS_MEMBRES],
          ])
            if (
              normaliser(titre) == normaliser(titreListe) &&
              idSujet &&
              (!sujets[cle] || Number(idSujet) < Number(sujets[cle]))
            )
              sujets[cle] = idSujet;
          if (h && idSujet)
            sujets.historiques.push({
              type: h[1],
              page: parseInt(h[2]),
              pseudo: PartageChasses.nettoyer(h[3]),
              id: idSujet,
            });
        });
      return sujets;
    });
  }
  /**
   * Minute de la colonne « Dernier message » de la liste des sujets (création
   * du sujet ou dernière réponse : « 13 nov. à 22h20 », l'année en plus si ce
   * n'est pas l'année en cours, « aujourd'hui à … », « hier à … »), à l'heure
   * du jeu.
   *
   * @static
   * @method dateListe
   * @param {String} texte
   * @return {Number|null} ms ; null si aucune date n'est lisible
   */
  static dateListe(texte) {
    let t = String(texte || "")
        .toLowerCase()
        .replace(/[’‘`]/g, "'")
        .replace(/\s+/g, " "),
      maintenant = Horloge.serveur(),
      d = t.match(/(\d{1,2}) ([a-zéû]+)\.?(?: (\d{4}))? à (\d{1,2}) ?h ?(\d{2})/),
      r = t.match(/(aujourd'hui|hier) à (\d{1,2}) ?h ?(\d{2})/),
      date = null;
    if (d) {
      let mois = MOIS_FORUM.findIndex((m) => m.test(d[2]));
      if (mois < 0) return null;
      date = moment(
        `${d[3] || maintenant.year()}-${mois + 1}-${d[1]} ${d[4]}:${d[5]}`,
        "YYYY-M-D H:mm",
        true,
      );
      // sans année : une date à venir est celle de l'an passé
      if (!d[3] && date.isValid() && date.valueOf() > maintenant.valueOf() + 24 * 3600 * 1000)
        date.subtract(1, "year");
    } else if (r) {
      date = moment(`${maintenant.format("YYYY-MM-DD")} ${r[2]}:${r[3]}`, "YYYY-MM-DD H:mm", true);
      if (r[1] == "hier") date.subtract(1, "day");
    }
    return date && date.isValid() ? date.valueOf() : null;
  }
  /**
   * Lecture gardée d'un sujet commun, si elle fait encore foi : faite il y a
   * moins d'une minute par cette version du script, et même texte « Dernier
   * message » qu'alors (une réponse postée depuis le change).
   *
   * @static
   * @method sujetGarde
   * @param {any} gardes lectures gardées (CLE_SUJETS_GARDES)
   * @param {{id: String, dernier?: String, modifie?: Number|null}} t sujet de la liste
   * @return {any} {chasses, floods}, ou null : à relire
   */
  static sujetGarde(gardes, t) {
    let e = gardes[t.id];
    if (!e || e.version !== PartageChasses._version() || e.dernier !== (t.dernier || ""))
      return null;
    return Horloge.maintenant() - e.lu < DUREE_CACHE_FORUM ? e.v : null;
  }
  /**
   * @private
   * @static
   * @param {String} id
   * @param {String} dernier date « Dernier message » de la liste lue avant
   * @param {Number} lu heure du serveur juste avant la lecture
   * @param {any} v contenu lu
   */
  static _garderSujet(id, dernier, lu, v) {
    let gardes = Utils.lireStockage(CLE_SUJETS_GARDES),
      version = PartageChasses._version();
    for (let k in gardes)
      if (gardes[k].version !== version || lu - gardes[k].lu > DUREE_SUJETS_GARDES)
        delete gardes[k];
    gardes[id] = { dernier, lu, v, version };
    try {
      localStorage.setItem(CLE_SUJETS_GARDES, JSON.stringify(gardes));
    } catch (e) {}
  }
  /**
   * Premier message d'un sujet, lu au forum (sans les lectures gardées).
   *
   * @private
   * @static
   * @param {String} idSujet
   * @return {Promise<String>}
   */
  static _texteSujet(idSujet) {
    return PartageChasses._xajax("callGetTopic", idSujet).then((data) =>
      PartageChasses.premierMessage(data),
    );
  }
  /**
   * Chasses et floods des lignes d'un texte : premier message du sujet d'un
   * joueur, ou sa section d'un sujet commun.
   *
   * @static
   * @method lireEntrees
   * @param {String} texte
   * @return {{chasses: Array, floods: Array}}
   */
  static lireEntrees(texte) {
    let chasses = [],
      floods = [],
      m,
      // tolérant aux corrections à la main : 1 ou 2 chiffres, année sur 2 ou
      // 4 chiffres, « 02:46 » ou « 02h46 », espaces libres autour des « | »
      D = "(\\d{1,2})/(\\d{1,2})/(\\d{2,4})\\s+(\\d{1,2})[:hH](\\d{2})",
      N = "(\\d[\\d \\u00a0\\u202f.]*)\\s*cm",
      reC = new RegExp(`${D}\\s*\\|\\s*${N}`, "g"),
      // flood : « date | cible | [unités envoyées |] prise cm² [| TdC relevé] [| #id] »
      // (unités et TdC relevé depuis 1.19 ; numéro d'attaque depuis 1.18.5)
      U = "(\\d[\\d \\u00a0\\u202f.]*)\\s*unit[ée]s?",
      reF = new RegExp(
        `${D}\\s*\\|\\s*([^|\\n]+?)\\s*\\|\\s*(?:${U}\\s*\\|\\s*)?${N}²?(?:\\s*\\|\\s*TdC\\s*(\\d[\\d \\u00a0\\u202f.]*))?(?:\\s*\\|\\s*#(\\d+))?`,
        "g",
      ),
      // attaque en dôme ou en loge : « date | cible | Dôme | unités [| TdC] [| #id] »
      reZ = new RegExp(
        `${D}\\s*\\|\\s*([^|\\n]+?)\\s*\\|\\s*(Dôme|Loge)\\s*\\|\\s*${U}(?:\\s*\\|\\s*TdC\\s*(\\d[\\d \\u00a0\\u202f.]*))?(?:\\s*\\|\\s*#(\\d+))?`,
        "g",
      ),
      // anciens relevés (Fzzz 1.13.0/1.13.1) : codes FZC / FZF, lus seulement
      // si le sujet n'a aucune ligne au format actuel
      reC0 = /FZC\|(\d{4}-\d\d-\d\d \d\d:\d\d)\|(\d+)\|/g,
      reF0 = /FZF\|(\d{4}-\d\d-\d\d \d\d:\d\d)\|([^|\s]+)\|(\d+)\|/g,
      date = (m) =>
        moment(
          `${m[1]}/${m[2]}/${m[3].length == 2 ? "20" + m[3] : m[3]} ${m[4]}:${m[5]}`,
          "D/M/YYYY H:mm",
        ).format("YYYY-MM-DD HH:mm"),
      nombre = (t) => parseInt(t.replace(/\D/g, ""));
    while ((m = reF.exec(texte)))
      floods.push({
        date: date(m),
        cible: PartageChasses.nettoyer(m[6]),
        unites: m[7] ? nombre(m[7]) : null,
        terrain: nombre(m[8]),
        tdcCible: m[9] ? nombre(m[9]) : null,
        id: m[10] ? parseInt(m[10]) : null,
      });
    while ((m = reZ.exec(texte)))
      floods.push({
        date: date(m),
        cible: PartageChasses.nettoyer(m[6]),
        unites: nombre(m[8]),
        terrain: 0,
        tdcCible: m[9] ? nombre(m[9]) : null,
        id: m[10] ? parseInt(m[10]) : null,
        lieu: m[7],
      });
    // une ligne de flood contient aussi « date | … » : les chasses sont lues
    // sur le texte privé des lignes de flood
    let texteC = texte.replace(reF, "").replace(reZ, "");
    while ((m = reC.exec(texteC))) chasses.push({ date: date(m), terrain: nombre(m[6]) });
    if (!chasses.length)
      while ((m = reC0.exec(texte))) chasses.push({ date: m[1], terrain: parseInt(m[2]) });
    if (!floods.length)
      while ((m = reF0.exec(texte)))
        floods.push({
          date: m[1],
          cible: PartageChasses.nettoyer(m[2]),
          terrain: parseInt(m[3]),
        });
    return { chasses: chasses, floods: floods };
  }
  /**
   * Titre d'un sujet commun du type, écrit à la main : casse, accents et
   * espaces tolérés, suite du titre libre.
   *
   * @static
   * @method estCommun
   * @param {String} titre
   * @param {String} type "Floods" ou "Chasses"
   * @return {Boolean}
   */
  static estCommun(titre, type) {
    let simple = (/** @type {String} */ t) =>
      String(t)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
    return simple(titre).startsWith(simple(SUJETS_COMMUNS[type].split(" - ")[0]));
  }
  /**
   * Sections d'un sujet commun, une par joueur : son en-tête (ENTETE_SECTION)
   * puis ses lignes. Le texte avant la première section, écrit à la main, est
   * gardé tel quel.
   *
   * @static
   * @method sections
   * @param {String} texte premier message
   * @return {{preambule: String, sections: Array<any>}} sections : {pseudo,
   *   ecrit, lignes, chasses, floods}
   */
  static sections(texte) {
    /** @type {Array<String>} */
    let preambule = [],
      /** @type {Array<any>} */
      sections = [],
      /** @type {any} */
      courante = null;
    String(texte || "")
      .split("\n")
      .forEach((ligne) => {
        let m = ligne.match(ENTETE_SECTION);
        if (m)
          sections.push(
            (courante = { pseudo: PartageChasses.nettoyer(m[1]), ecrit: m[2], lignes: [] }),
          );
        else if (courante) {
          if (ligne.trim()) courante.lignes.push(ligne.trim());
        } else preambule.push(ligne);
      });
    return {
      preambule: preambule.join("\n").trim(),
      sections: sections.map((s) => ({ ...s, ...PartageChasses.lireEntrees(s.lignes.join("\n")) })),
    };
  }
  /**
   * Premier message d'un sujet commun : le préambule, puis les sections par
   * pseudo ; jamais vide.
   *
   * @static
   * @method texteCommun
   * @param {String} preambule
   * @param {Array<{pseudo: String, ecrit: String, lignes: Array<String>}>} sections
   * @return {String}
   */
  static texteCommun(preambule, sections) {
    let corps = sections
        .slice()
        .sort((a, b) => a.pseudo.toLowerCase().localeCompare(b.pseudo.toLowerCase()))
        .map((s) => [`--- ${s.pseudo} · ${s.ecrit} ---`, ...s.lignes].join("\n"))
        .join("\n"),
      tete = preambule == COMMUN_VIDE && corps ? "" : preambule;
    return [tete, corps].filter(Boolean).join("\n") || COMMUN_VIDE;
  }
  /**
   * Section la plus récente de chaque joueur.
   *
   * @static
   * @method sectionsRecentes
   * @param {Array<any>} sections sections()
   * @return {any} {pseudo en minuscules: section}
   */
  static sectionsRecentes(sections) {
    /** @type {any} */
    let recentes = {};
    sections.forEach((s) => {
      let k = s.pseudo.toLowerCase();
      if (!recentes[k] || s.ecrit > recentes[k].ecrit) recentes[k] = s;
    });
    return recentes;
  }
  /**
   * Sections d'un sujet commun, gardées une minute (sujetGarde).
   *
   * @private
   * @static
   * @param {{id: String, dernier?: String, modifie?: Number|null}} t sujet commun de la liste
   * @param {{prevoir: (n: Number) => void, faite: () => void}|null} [suivi] prévenu d'une
   *   lecture au forum seulement : une lecture gardée fausserait la durée moyenne affichée
   * @return {Promise<any>} sections()
   */
  static _lireCommun(t, suivi = null) {
    let garde = PartageChasses.sujetGarde(Utils.lireStockage(CLE_SUJETS_GARDES), t);
    if (garde) {
      if (typeof COMPTE_REQUETES != "undefined") COMPTE_REQUETES.cache++;
      return Promise.resolve(garde);
    }
    if (suivi) suivi.prevoir(1);
    let debut = Horloge.maintenant();
    return PartageChasses._texteSujet(t.id).then((texte) => {
      let v = PartageChasses.sections(texte);
      PartageChasses._garderSujet(t.id, t.dernier || "", debut, v);
      if (suivi) suivi.faite();
      return v;
    });
  }
  /**
   * Lignes d'une section, la plus tardive d'abord.
   *
   * @private
   * @static
   * @param {String} type
   * @param {Array} entrees
   * @return {Array<String>}
   */
  static _lignesSection(type, entrees) {
    return entrees
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.id || 0) - (a.id || 0)))
      .map((e) => PartageChasses._ligne(type, e));
  }
  /**
   * Mes entrées dans ma section la plus récente d'un sujet commun.
   *
   * @private
   * @static
   * @param {String} type "Chasses" ou "Floods"
   * @param {Array<any>} sections sections()
   * @return {Array<any>}
   */
  static _mesEntrees(type, sections) {
    let s =
      PartageChasses.sectionsRecentes(sections)[
        PartageChasses.nettoyer(monProfil.pseudo).toLowerCase()
      ];
    return s ? (type == "Chasses" ? s.chasses : s.floods) : [];
  }
  /**
   * Écrit mes changements (lignes ajoutées et retirées) dans ma section du
   * sujet commun, sur mes entrées relues au forum (un autre de mes appareils a
   * pu écrire), les sections des autres joueurs gardées telles quelles. Le
   * forum n'a pas de verrou : le sujet est relu après PAUSE_VERIF_COMMUN, et
   * l'écriture refaite si un membre qui l'avait lu avant elle l'a défaite.
   *
   * @private
   * @static
   * @param {String} type
   * @param {String} idSujet
   * @param {Array<any>} ajouts
   * @param {Array<any>} retraits
   * @param {String|null} [texte] premier message lu juste avant, sinon relu
   * @param {Number} [essai]
   * @return {Promise<{etat: String, essai: Number, longueur: Number}>} etat :
   *   « écrite », « défaites » ou « trop long »
   */
  static _ecrireSection(type, idSujet, ajouts, retraits, texte = null, essai = 1) {
    let pseudo = PartageChasses.nettoyer(monProfil.pseudo),
      ligne = (/** @type {any} */ e) => PartageChasses._ligne(type, e),
      sans = new Set(retraits.map(ligne)),
      bilan = (/** @type {String} */ etat, longueur = 0) => ({ etat, essai, longueur });
    return (texte == null ? PartageChasses._texteSujet(idSujet) : Promise.resolve(texte)).then(
      (lu) => {
        let avant = PartageChasses.sections(lu),
          miennes = PartageChasses._mesEntrees(type, avant.sections).filter(
            (e) => !sans.has(ligne(e)),
          ),
          deja = new Set(miennes.map(ligne)),
          toutes = miennes.concat(ajouts.filter((e) => !deja.has(ligne(e)))),
          message = PartageChasses.texteCommun(
            avant.preambule,
            avant.sections
              .filter((s) => s.pseudo.toLowerCase() != pseudo.toLowerCase())
              .concat(
                toutes.length
                  ? [
                      {
                        pseudo,
                        ecrit: Horloge.serveur().format("YYYY-MM-DD HH:mm:ss"),
                        lignes: PartageChasses._lignesSection(type, toutes),
                      },
                    ]
                  : [],
              ),
          );
        if (message.length > COMMUN_MAX_CARACTERES) return bilan("trop long", message.length);
        let q = `sujet=${encodeURIComponent(SUJETS_COMMUNS[type])}&message=${encodeURIComponent(message)}&modifiable=envoyer&send=Envoyer`;
        return PartageChasses._xajax(
          "envoiEditTopic",
          `<xjxquery><q>IDTopic=${idSujet}&${q}</q></xjxquery>`,
        )
          .then(() => PartageChasses._attendre(PAUSE_VERIF_COMMUN))
          .then(() => PartageChasses._texteSujet(idSujet))
          .then((relu) => {
            let presentes = new Set(
              PartageChasses._mesEntrees(type, PartageChasses.sections(relu).sections).map(ligne),
            );
            if (
              ajouts.every((e) => presentes.has(ligne(e))) &&
              !retraits.some((e) => presentes.has(ligne(e)))
            )
              return bilan("écrite", message.length);
            if (essai < ESSAIS_COMMUN)
              return PartageChasses._ecrireSection(
                type,
                idSujet,
                ajouts,
                retraits,
                null,
                essai + 1,
              );
            return bilan("défaites");
          });
      },
    );
  }
  /**
   * @private
   * @static
   * @param {Number} ms
   * @return {Promise}
   */
  static _attendre(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
  /**
   * Le sujet d'un joueur est-il recopié par sa section ? Oui si sa date
   * « Dernier message » ne dépasse pas la minute où elle a été écrite. Cette
   * date est celle de sa création ou de sa dernière réponse, pas de ses
   * modifications (relevé du 14/11/2026) : un sujet modifié après sa section
   * passe pour recopié, ses nouvelles entrées ne sont pas reportées.
   *
   * @static
   * @method couvert
   * @param {{modifie?: Number|null}} t sujet du joueur dans la liste
   * @param {{ecrit: String}|null|undefined} s sa section la plus récente
   * @return {Boolean}
   */
  static couvert(t, s) {
    return (
      !!s &&
      t.modifie != null &&
      t.modifie <= moment(s.ecrit, "YYYY-MM-DD HH:mm:ss").startOf("minute").valueOf()
    );
  }
  /**
   * Bouton « Ranger le forum » (Préférences → Partage de données, réservé au
   * mainteneur), première étape : un joueur pas encore à jour partage dans son
   * sujet « Floods | … » / « Chasses | … », que l'extension ne lit plus ; ses
   * entrées à venir sont reportées dans sa section du sujet commun quand elle
   * manque ou est plus ancienne que son sujet (couvert). La section reportée
   * est datée de la seconde qui précède la minute de la lecture du sujet.
   *
   * @static
   * @method reporterTout
   * @param {(texte: String) => void} [etat] avancement affiché
   * @param {Array<String>} [demandes] types à reporter, "Floods" et/ou "Chasses"
   * @return {Promise<String>} bilan à afficher
   */
  static reporterTout(etat = () => {}, demandes = ["Floods", "Chasses"]) {
    etat("Lecture de la liste des sujets…");
    return PartageChasses.sujets().then((sujets) => {
      let types = demandes.filter((type) => (sujets.communs || {})[type]);
      if (!types.length)
        return `Aucun sujet ${demandes.map((type) => `« ${SUJETS_COMMUNS[type]} »`).join(" ni ")} dans la section : rien à reporter.`;
      /** @type {Array<String>} */
      let bilans = [];
      return types
        .reduce(
          (suite, type) =>
            suite.then(() =>
              PartageChasses._reporter(type, sujets, etat).then((b) => void bilans.push(b)),
            ),
          Promise.resolve(),
        )
        .then(() => bilans.join(" "));
    });
  }
  /**
   * @private
   * @static
   * @param {String} type
   * @param {any} sujets
   * @param {(texte: String) => void} etat
   * @return {Promise<String>}
   */
  static _reporter(type, sujets, etat) {
    let titre = SUJETS_COMMUNS[type],
      commun = sujets.communs[type],
      nombre = (
        /** @type {Number} */ n,
        /** @type {String} */ un,
        /** @type {String} */ plusieurs,
      ) => `${numeral(n).format()} ${n > 1 ? plusieurs : un}`;
    etat(`« ${titre} » : lecture…`);
    return PartageChasses._texteSujet(commun.id).then((texte) => {
      let recentes = PartageChasses.sectionsRecentes(PartageChasses.sections(texte).sections),
        joueurs = sujets.liste.filter((/** @type {any} */ t) => t.type == type),
        aLire = joueurs.filter(
          (/** @type {any} */ t) => !PartageChasses.couvert(t, recentes[t.pseudo.toLowerCase()]),
        ),
        /** @type {Array<any>} */
        nouvelles = [],
        illisibles = 0,
        coupes = 0,
        k = 0,
        maintenant = Horloge.serveur().format("YYYY-MM-DD HH:mm");
      return aLire
        .reduce(
          (suite, /** @type {any} */ t) =>
            suite.then(() => {
              etat(`« ${titre} » : sujet ${++k} / ${aLire.length} (${t.pseudo})…`);
              return PartageChasses._lireDate(t).then(
                ({ v, lu }) => {
                  // les plus proches d'abord : ce sont elles que l'affichage montre en premier
                  let entrees = (type == "Chasses" ? v.chasses : v.floods)
                    .filter((/** @type {any} */ e) => e.date >= maintenant)
                    .sort((/** @type {any} */ a, /** @type {any} */ b) =>
                      a.date < b.date ? -1 : a.date > b.date ? 1 : (a.id || 0) - (b.id || 0),
                    );
                  if (entrees.length > COMMUN_MAX_ENTREES) coupes++;
                  nouvelles.push({
                    pseudo: t.pseudo,
                    ecrit: moment(lu)
                      .startOf("minute")
                      .subtract(1, "second")
                      .format("YYYY-MM-DD HH:mm:ss"),
                    lignes: PartageChasses._lignesSection(
                      type,
                      entrees.slice(0, COMMUN_MAX_ENTREES),
                    ),
                  });
                },
                () => void illisibles++,
              );
            }),
          Promise.resolve(),
        )
        .then(() => {
          etat(`« ${titre} » : écriture…`);
          return PartageChasses._reporterSections(type, commun.id, nouvelles);
        })
        .then((r) => {
          let aJour = joueurs.length - aLire.length,
            details = [
              nombre(r.ecrites, "section reportée", "sections reportées"),
              aJour ? nombre(aJour, "déjà à jour", "déjà à jour") : "",
              illisibles ? nombre(illisibles, "sujet illisible", "sujets illisibles") : "",
              coupes
                ? `${nombre(coupes, "sujet coupé", "sujets coupés")} aux ${COMMUN_MAX_ENTREES} entrées les plus proches`
                : "",
            ]
              .filter(Boolean)
              .join(", "),
            bilan =
              r.etat == "écrites"
                ? `« ${titre} » : ${details}.`
                : r.etat == "trop long"
                  ? `« ${titre} » : rien n'est écrit, le message dépasserait la taille d'un message du forum (${numeral(r.longueur).format()} caractères).`
                  : `« ${titre} » : écriture défaite par d'autres membres après ${r.essai} essais, réessaie plus tard.`;
          if (r.etat == "écrites") Journal.info("Forum", bilan);
          else Journal.erreur("Forum", bilan);
          return bilan;
        });
    });
  }
  /**
   * Bouton « Ranger le forum » (réservé au mainteneur) : report des anciens
   * sujets dans les sujets communs (reporterTout), puis suppression de chaque
   * ancien sujet dont toutes les entrées à venir sont dans la section de son
   * joueur, ses entrées passées d'abord ajoutées à son historique ; un sujet
   * dont une entrée à venir manque (son joueur, à jour, a partagé depuis sans
   * elle, ou la section est coupée) reste. Règle du mainteneur, 14/11/2026.
   *
   * @static
   * @method rangerForum
   * @param {(texte: String) => void} [etat] avancement affiché
   * @return {Promise<String>} bilan à afficher
   */
  static rangerForum(etat = () => {}) {
    return PartageChasses.reporterTout(etat).then((report) =>
      PartageChasses._supprimerAnciens(etat).then((suppression) =>
        [report, suppression].filter(Boolean).join(" "),
      ),
    );
  }
  /**
   * @private
   * @static
   * @param {(texte: String) => void} etat
   * @return {Promise<String>}
   */
  static _supprimerAnciens(etat) {
    let nombre = (
      /** @type {Number} */ n,
      /** @type {String} */ un,
      /** @type {String} */ plusieurs,
    ) => `${numeral(n).format()} ${n > 1 ? plusieurs : un}`;
    etat("Anciens sujets : lecture de la liste…");
    PartageChasses.oublierCache();
    return PartageChasses.sujets().then((sujets) => {
      let types = Object.keys(SUJETS_COMMUNS).filter((type) => (sujets.communs || {})[type]),
        anciens = sujets.liste.filter((/** @type {any} */ t) => types.includes(t.type));
      if (!anciens.length)
        return "Aucun ancien sujet « Floods | … » ou « Chasses | … » à supprimer.";
      let maintenant = Horloge.serveur().format("YYYY-MM-DD HH:mm"),
        /** @type {any} */
        sections = {},
        /** @type {Array<any>} */
        aSupprimer = [],
        incomplets = 0,
        sansHistorique = 0,
        k = 0;
      return types
        .reduce(
          (suite, type) =>
            suite.then(() =>
              PartageChasses._texteSujet(sujets.communs[type].id).then((texte) => {
                sections[type] = PartageChasses.sectionsRecentes(
                  PartageChasses.sections(texte).sections,
                );
              }),
            ),
          Promise.resolve(),
        )
        .then(() =>
          anciens.reduce(
            (suite, /** @type {any} */ t) =>
              suite.then(() => {
                etat(`Anciens sujets : ${++k} / ${anciens.length} (${t.type} | ${t.pseudo})…`);
                return PartageChasses._lireDate(t).then(
                  ({ v }) => {
                    let ligne = (/** @type {any} */ e) => PartageChasses._ligne(t.type, e),
                      entrees = t.type == "Chasses" ? v.chasses : v.floods,
                      s = sections[t.type][t.pseudo.toLowerCase()],
                      presentes = new Set(
                        (s ? (t.type == "Chasses" ? s.chasses : s.floods) : []).map(ligne),
                      );
                    if (
                      !entrees
                        .filter((/** @type {any} */ e) => e.date >= maintenant)
                        .every((/** @type {any} */ e) => presentes.has(ligne(e)))
                    )
                      return void incomplets++;
                    return PartageChasses.archiverPassees(
                      t.type,
                      entrees.filter((/** @type {any} */ e) => e.date < maintenant),
                      sujets,
                      undefined,
                      undefined,
                      t.pseudo,
                    ).then((archivees) => {
                      if (archivees) aSupprimer.push(t);
                      else sansHistorique++;
                    });
                  },
                  () => void incomplets++,
                );
              }),
            Promise.resolve(),
          ),
        )
        .then(() => {
          if (!aSupprimer.length) return 0;
          etat("Anciens sujets : suppression…");
          return PartageChasses._xajax("callSupprimer", [
            `<xjxquery><q>${aSupprimer.map((t) => "topic[]=" + t.id).join("&")}</q></xjxquery>`,
            PartageChasses.idSection,
          ])
            .then(() => {
              PartageChasses.oublierCache();
              return PartageChasses.sujets();
            })
            .then((apres) => {
              let restants = new Set(apres.liste.map((/** @type {any} */ t) => t.id));
              return aSupprimer.filter((t) => !restants.has(t.id)).length;
            });
        })
        .then((supprimes) => {
          let refuses = aSupprimer.length - supprimes,
            bilan = `Anciens sujets : ${[
              nombre(supprimes, "supprimé", "supprimés"),
              incomplets
                ? `${nombre(incomplets, "gardé", "gardés")} (entrées à venir absentes de la section du joueur, ou sujet illisible)`
                : "",
              sansHistorique
                ? `${nombre(sansHistorique, "gardé", "gardés")} (historique du joueur pas écrit)`
                : "",
              refuses
                ? `${nombre(refuses, "pas supprimé", "pas supprimés")} : le forum le${refuses > 1 ? "s" : ""} montre encore (droits de gestion du forum ?)`
                : "",
            ]
              .filter(Boolean)
              .join(", ")}.`;
          if (refuses || sansHistorique) Journal.erreur("Forum", bilan);
          else Journal.info("Forum", bilan);
          return bilan;
        });
    });
  }
  /**
   * Contenu du sujet d'un joueur et heure du serveur de sa lecture : la
   * lecture gardée si elle fait foi, sinon une lecture neuve.
   *
   * @private
   * @static
   * @param {any} t sujet de la liste
   * @return {Promise<{v: any, lu: Number}>}
   */
  static _lireDate(t) {
    let gardes = Utils.lireStockage(CLE_SUJETS_GARDES),
      garde = PartageChasses.sujetGarde(gardes, t);
    if (garde) return Promise.resolve({ v: garde, lu: gardes[t.id].lu });
    // avant la requête : l'heure de lecture gardée n'est jamais trop tardive
    let debut = Horloge.maintenant();
    return PartageChasses._texteSujet(t.id).then((texte) => {
      let v = PartageChasses.lireEntrees(texte);
      PartageChasses._garderSujet(t.id, t.dernier || "", debut, v);
      return { v, lu: debut };
    });
  }
  /**
   * Sections reportées pour d'autres joueurs : chacune remplace celle de son
   * joueur, sauf si celle-ci est plus récente (il a partagé depuis avec cette
   * version) ; une section sans ligne retire la sienne. Relu après
   * PAUSE_VERIF_COMMUN, écrit de nouveau si un membre l'a défait.
   *
   * @private
   * @static
   * @param {String} type
   * @param {String} idSujet
   * @param {Array<{pseudo: String, ecrit: String, lignes: Array<String>}>} nouvelles
   * @param {Number} [essai]
   * @return {Promise<{etat: String, essai: Number, ecrites: Number, longueur: Number}>}
   *   etat : « écrites », « défaites » ou « trop long »
   */
  static _reporterSections(type, idSujet, nouvelles, essai = 1) {
    let cle = (/** @type {String} */ p) => String(p).toLowerCase(),
      bilan = (/** @type {String} */ etat, ecrites = 0, longueur = 0) => ({
        etat,
        essai,
        ecrites,
        longueur,
      });
    return PartageChasses._texteSujet(idSujet).then((texte) => {
      let lu = PartageChasses.sections(texte),
        siennes = (/** @type {Array<any>} */ sections, /** @type {any} */ n) =>
          sections.filter((s) => cle(s.pseudo) == cle(n.pseudo)),
        // un joueur sans ligne ni section : rien à changer
        retenues = nouvelles.filter(
          (n) =>
            !siennes(lu.sections, n).some((s) => s.ecrit > n.ecrit) &&
            (n.lignes.length || siennes(lu.sections, n).length),
        ),
        remplaces = new Set(retenues.map((n) => cle(n.pseudo))),
        message = PartageChasses.texteCommun(
          lu.preambule,
          lu.sections
            .filter((/** @type {any} */ s) => !remplaces.has(cle(s.pseudo)))
            .concat(retenues.filter((n) => n.lignes.length)),
        );
      if (!retenues.length) return bilan("écrites");
      if (message.length > COMMUN_MAX_CARACTERES) return bilan("trop long", 0, message.length);
      let q = `sujet=${encodeURIComponent(SUJETS_COMMUNS[type])}&message=${encodeURIComponent(message)}&modifiable=envoyer&send=Envoyer`;
      return PartageChasses._xajax(
        "envoiEditTopic",
        `<xjxquery><q>IDTopic=${idSujet}&${q}</q></xjxquery>`,
      )
        .then(() => PartageChasses._attendre(PAUSE_VERIF_COMMUN))
        .then(() => PartageChasses._texteSujet(idSujet))
        .then((relu) => {
          let apres = PartageChasses.sections(relu).sections,
            // une section plus récente du même joueur (il a partagé entre-temps) compte aussi
            faite = (/** @type {any} */ n) =>
              n.lignes.length
                ? siennes(apres, n).some((s) => s.ecrit >= n.ecrit)
                : !siennes(apres, n).some((s) => s.ecrit < n.ecrit);
          if (retenues.every(faite)) return bilan("écrites", retenues.length, message.length);
          if (essai < ESSAIS_COMMUN)
            return PartageChasses._reporterSections(type, idSujet, nouvelles, essai + 1);
          return bilan("défaites");
        });
    });
  }
  /**
   * Ajoute des lignes (actions passées, de la plus ancienne à la plus récente)
   * à l'historique du joueur, dans sa dernière page « Historique <type> N |
   * pseudo », ou dans une page nouvelle quand le message dépasserait
   * HISTORIQUE_MAX_CARACTERES. Une ligne déjà présente dans la page n'est pas
   * répétée (nouvel essai après une écriture perdue).
   *
   * @static
   * @method archiver
   * @param {String} type "Chasses" ou "Floods"
   * @param {Array<String>} lignes
   * @param {Object} sujets voir sujets()
   * @param {String} [pseudo] joueur de l'historique (« Ranger le forum » : un autre que moi)
   * @return {Promise} rejetée si l'historique n'a pas pu être lu ou écrit
   */
  static archiver(type, lignes, sujets, pseudo = monProfil.pseudo) {
    if (!lignes.length) return Promise.resolve();
    let pages = (sujets.historiques || [])
        .filter(
          (/** @type {any} */ h) =>
            h.type == type && h.pseudo.toLowerCase() == pseudo.toLowerCase(),
        )
        .sort((/** @type {any} */ a, /** @type {any} */ b) => a.page - b.page),
      derniere = pages[pages.length - 1],
      // même page créée deux fois (deux onglets au même instant) : la plus
      // ancienne reçoit la suite, les lignes des deux comptent comme présentes
      doubles = derniere ? pages.filter((h) => h.page == derniere.page) : [],
      ecrire = (
        /** @type {Number} */ page,
        /** @type {any} */ idSujet,
        /** @type {String} */ contenu,
      ) => {
        let q = `sujet=${encodeURIComponent(`Historique ${type} ${page} | ${pseudo}`)}&message=${encodeURIComponent(contenu)}&modifiable=envoyer&send=Envoyer`;
        return idSujet
          ? PartageChasses._xajax(
              "envoiEditTopic",
              `<xjxquery><q>IDTopic=${idSujet}&${q}</q></xjxquery>`,
            )
          : PartageChasses._xajax(
              "envoiNouveauSujet",
              `<xjxquery><q>cat=${PartageChasses.idSection}&${q}&type=normal&question=&reponse[]=&reponse[]=&reponse[]=</q></xjxquery>`,
            );
      };
    if (!derniere) return ecrire(1, null, lignes.join("\n"));
    derniere = doubles.reduce((a, h) => (Number(h.id) < Number(a.id) ? h : a), derniere);
    let lue = /** @type {any} */ (derniere);
    return Promise.all(
      doubles.map((/** @type {any} */ h) =>
        PartageChasses._xajax("callGetTopic", h.id).then((data) => ({
          canonique: h.id == lue.id,
          lignes: PartageChasses.premierMessage(data)
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean),
        })),
      ),
    ).then((lus) => {
      let anciennes = lus.filter((l) => l.canonique).flatMap((l) => l.lignes),
        restantes = lus.flatMap((l) => l.lignes),
        nouvelles = lignes.filter((l) => {
          let k = restantes.indexOf(l);
          if (k == -1) return true;
          restantes.splice(k, 1);
          return false;
        });
      if (!nouvelles.length) return;
      let contenu = anciennes.concat(nouvelles).join("\n");
      if (anciennes.length && contenu.length > HISTORIQUE_MAX_CARACTERES)
        return ecrire(lue.page + 1, null, nouvelles.join("\n"));
      return ecrire(lue.page, lue.id, contenu);
    });
  }
  /**
   * Entrées passées d'un sujet vers l'historique du joueur, avant la
   * réécriture du sujet. Résout false si l'historique n'a pas pu être écrit :
   * elles restent alors dans le sujet, pour l'écriture suivante.
   *
   * @static
   * @method archiverPassees
   * @param {String} type "Chasses" ou "Floods"
   * @param {Array} entrees
   * @param {Object} sujets voir sujets()
   * @param {(e: any) => String} [ligne] texte d'une entrée
   * @param {(e: any) => String} [date] "AAAA-MM-JJ HH:mm" d'une entrée
   * @param {String} [pseudo] joueur de l'historique
   * @return {Promise<Boolean>}
   */
  static archiverPassees(
    type,
    entrees,
    sujets,
    ligne = (e) => PartageChasses._ligne(type, e),
    date = (e) => e.date,
    pseudo = monProfil.pseudo,
  ) {
    if (!entrees.length) return Promise.resolve(true);
    let lignes = entrees
      .slice()
      .sort((a, b) => (date(a) < date(b) ? -1 : date(a) > date(b) ? 1 : (a.id || 0) - (b.id || 0)))
      .map(ligne);
    return PartageChasses.archiver(type, lignes, sujets, pseudo).then(
      () => true,
      (e) => {
        console.warn(`[${NOM_EXTENSION}] historique ${type} non écrit`, e);
        return false;
      },
    );
  }
  /**
   * Modifie ma section du sujet commun du type : `changer` reçoit mes entrées
   * relues au forum et rend toutes celles à garder, ou null s'il n'y a rien à
   * écrire ; seuls les changements sont écrits et vérifiés (_ecrireSection).
   * `changer` rend un tableau quand il n'a rien écrit au forum : le texte lu
   * sert alors à l'écriture, sans le relire.
   *
   * @private
   * @static
   * @param {String} type "Chasses" ou "Floods"
   * @param {(anciennes: Array<any>, sujets: any) => any} changer rend un
   *   tableau d'entrées, null, ou leur promesse
   * @return {Promise<Array<any>|null>} entrées gardées ; rejetée avec
   *   Error("absente"), Error("sans sujet commun"), Error("défaites") ou
   *   Error("trop long"), titre du sujet commun dans .titre
   */
  static _modifierSection(type, changer) {
    let titre = SUJETS_COMMUNS[type],
      ligne = (/** @type {any} */ e) => PartageChasses._ligne(type, e),
      refus = (/** @type {String} */ code) =>
        Promise.reject(Object.assign(new Error(code), { titre }));
    return PartageChasses.sujets().then((sujets) => {
      let commun = (sujets.communs || {})[type];
      if (!commun) return refus("sans sujet commun");
      return PartageChasses._texteSujet(commun.id).then((texte) => {
        let anciennes = PartageChasses._mesEntrees(type, PartageChasses.sections(texte).sections),
          rendu = changer(anciennes, sujets),
          lu = Array.isArray(rendu) ? texte : null;
        return Promise.resolve(rendu).then((/** @type {Array<any>|null} */ toutes) => {
          if (!toutes) return null;
          let avant = new Set(anciennes.map(ligne)),
            apres = new Set(toutes.map(ligne)),
            ajouts = toutes.filter((e) => !avant.has(ligne(e))),
            retraits = anciennes.filter((e) => !apres.has(ligne(e)));
          if (!ajouts.length && !retraits.length) return toutes;
          return PartageChasses._ecrireSection(type, commun.id, ajouts, retraits, lu).then((r) => {
            if (r.etat == "écrite" && r.essai > 1)
              Journal.info(
                "Forum",
                `« ${titre} » : section écrite à l'essai ${r.essai} (sujet écrit au même moment par un autre membre ou appareil)`,
              );
            return r.etat == "écrite" ? toutes : refus(r.etat);
          });
        });
      });
    });
  }
  /**
   * Fusionne des entrées dans ma section du sujet commun du type ; les entrées
   * passées partent d'abord dans mon historique.
   *
   * @private
   * @param {String} type "Chasses" ou "Floods"
   * @param {Array} entrees [{date "AAAA-MM-JJ HH:mm", terrain, cible?, unites?}]
   * @return {Promise<Integer>} nombre d'entrées nouvelles
   */
  static _partager(type, entrees) {
    // une chasse par minute ; un flood par attaque du jeu (un multi-flood
    // envoie plusieurs attaques sur la même cible à la même minute)
    let cle = (/** @type {any} */ e) =>
        e.date + "|" + (e.cible || "") + "|" + (e.cible ? e.terrain : ""),
      ajoutees = 0;
    return PartageChasses._modifierSection(type, (anciennes, sujets) => {
      let ids = anciennes.filter((e) => e.id).map((e) => e.id),
        // anciennes lignes sans numéro d'attaque : chacune ne couvre qu'un envoi
        sansId = anciennes.filter((e) => !e.id).map(cle),
        nouvelles = entrees.filter((e) => {
          if (e.id && ids.includes(e.id)) return false;
          let k = sansId.indexOf(cle(e));
          if (type == "Chasses" ? k != -1 : k != -1 && !e.id) return false;
          if (k != -1) {
            sansId.splice(k, 1);
            return false;
          }
          return true;
        });
      if (type == "Chasses") PartageChasses.noterFinChasses(entrees.map((e) => e.date));
      // les entrées passées quittent la section pour l'historique du joueur
      let maintenant = Horloge.serveur().format("YYYY-MM-DD HH:mm"),
        aVenir = anciennes.filter((e) => e.date >= maintenant),
        passees = anciennes.concat(nouvelles).filter((e) => e.date < maintenant);
      if (!nouvelles.length && aVenir.length == anciennes.length) return null;
      ajoutees = nouvelles.length;
      let garder = (/** @type {Boolean} */ archivees) => {
        let toutes = (archivees ? aVenir : anciennes).concat(
            archivees ? nouvelles.filter((e) => e.date >= maintenant) : nouvelles,
          ),
          prochaines = toutes
            .filter((e) => e.date >= maintenant)
            .sort((a, b) =>
              a.date < b.date ? -1 : a.date > b.date ? 1 : (a.id || 0) - (b.id || 0),
            );
        if (prochaines.length > COMMUN_MAX_ENTREES) {
          Journal.info(
            "Forum",
            `${prochaines.length} ${type == "Chasses" ? "chasses" : "floods"} à venir : les ${COMMUN_MAX_ENTREES} plus proches partagés`,
          );
          ajoutees -= prochaines
            .slice(COMMUN_MAX_ENTREES)
            .filter((e) => nouvelles.includes(e)).length;
        }
        return toutes
          .filter((e) => e.date < maintenant)
          .concat(prochaines.slice(0, COMMUN_MAX_ENTREES));
      };
      return passees.length
        ? PartageChasses.archiverPassees(type, passees, sujets).then(garder)
        : garder(true);
    }).then(() => ajoutees);
  }
  /**
   * @private
   * @static
   */
  static noterFinChasses(dates) {
    try {
      let connue = localStorage.getItem(CLE_FIN_CHASSES_PARTAGEES),
        fin = [connue == "-" ? "" : connue || "", ...dates].sort().pop();
      if (fin) localStorage.setItem(CLE_FIN_CHASSES_PARTAGEES, fin);
    } catch (e) {}
  }
  /**
   * Chasses du sujet à garder d'après les chasses en cours : une entrée est
   * gardée si un groupe de chasses (minutes d'impact consécutives) couvre sa
   * minute, à une minute près, avec la minute et le TdC actuels du groupe
   * (une chasse du groupe a pu être annulée) ; sinon elle est retirée.
   *
   * @static
   * @method recalerListeChasses
   * @param {Array} anciennes entrées du sujet {date, terrain}
   * @param {Array} groupes {debut, fin, terrain}, dates "AAAA-MM-JJ HH:mm"
   * @param {String} maintenant "AAAA-MM-JJ HH:mm"
   * @return {Object} {lignes, change}
   */
  static recalerListeChasses(anciennes, groupes, maintenant) {
    let minute = (d) => moment(d, "YYYY-MM-DD HH:mm").valueOf() / 60000,
      aVenir = anciennes.filter((e) => e.date >= maintenant),
      lignes = [];
    aVenir.forEach((e) => {
      let m = minute(e.date),
        g = groupes.find((g) => m >= minute(g.debut) - 1 && m <= minute(g.fin) + 1);
      if (g && !lignes.some((l) => l.date == g.fin))
        lignes.push({ date: g.fin, terrain: g.terrain });
    });
    let change =
      lignes.length != aVenir.length ||
      lignes.some((l, i) => l.date != aVenir[i].date || l.terrain != aVenir[i].terrain);
    return { lignes, change };
  }
  /**
   * Page Ressources : chasses partagées puis annulées (en masse ou une par
   * une) retirées de ma section du sujet commun des chasses. Le forum n'est lu
   * que si une chasse partagée est encore à venir (ou la première fois, repère
   * inconnu).
   *
   * @static
   * @method recalerChasses
   * @param {Array} groupes chasses en cours {debut, fin, terrain}
   * @return {Promise}
   */
  static recalerChasses(groupes) {
    let maintenant = Horloge.serveur().format("YYYY-MM-DD HH:mm"),
      fin = null;
    try {
      fin = localStorage.getItem(CLE_FIN_CHASSES_PARTAGEES);
    } catch (e) {}
    // "-" : aucune chasse à venir dans ma section ; null : jamais vérifié
    if ((fin != null && fin < maintenant) || !monProfil.pseudo) return Promise.resolve();
    let retenir = (/** @type {Array<any>} */ lignes) => {
      try {
        localStorage.setItem(
          CLE_FIN_CHASSES_PARTAGEES,
          lignes
            .map((e) => e.date)
            .sort()
            .pop() || "-",
        );
      } catch (e) {}
    };
    return PartageChasses.enFile(() =>
      PartageChasses._modifierSection("Chasses", (anciennes, sujets) => {
        let r = PartageChasses.recalerListeChasses(anciennes, groupes, maintenant);
        retenir(r.lignes);
        if (!r.change) return null;
        // passées : vers l'historique ; annulées : retirées
        let passees = anciennes.filter((e) => e.date < maintenant);
        return passees.length
          ? PartageChasses.archiverPassees("Chasses", passees, sujets).then((archivees) =>
              r.lignes.concat(archivees ? [] : passees),
            )
          : r.lignes;
      }).then((ecrites) => {
        if (ecrites)
          $.toast({
            ...TOAST_INFO,
            text: `Chasses annulées : partage mis à jour dans le forum de la ${Utils.alliance || "l'alliance"}.`,
          });
      }),
    ).catch((e) => {
      // pas de section ou de sujet commun dans le forum : rien à recaler, ne plus le lire
      if (e && (e.message == "absente" || e.message == "sans sujet commun"))
        try {
          localStorage.setItem(CLE_FIN_CHASSES_PARTAGEES, "-");
        } catch (err) {}
    });
  }
  /**
   * @private
   */
  static _ligne(type, e) {
    let date = moment(e.date, "YYYY-MM-DD HH:mm").format("DD/MM/YY HH:mm"),
      suite = `${e.tdcCible ? ` | TdC ${numeral(e.tdcCible).format()}` : ""}${e.id ? ` | #${e.id}` : ""}`;
    if (type == "Chasses") return `${date} | ${numeral(e.terrain).format()} cm²`;
    // dôme ou loge : sans « cm² », la ligne est ignorée par les versions qui
    // ne connaissent pas les zones (elles y verraient un flood prenant du TdC)
    if (e.lieu)
      return `${date} | ${e.cible} | ${e.lieu} | ${numeral(e.unites || 0).format()} unités${suite}`;
    return `${date} | ${e.cible} | ${e.unites ? numeral(e.unites).format() + " unités | " : ""}${numeral(e.terrain).format()} cm²${suite}`;
  }
  /**
   * Bouton : désactivé pendant l'envoi, puis bilan.
   *
   * @private
   * @return {Promise<Boolean>} vrai si ces entrées sont dans le forum
   */
  static _avecBouton($bouton, type, entrees) {
    let libelle = type == "Chasses" ? "chasse" : "flood",
      accord = (n) => (type == "Chasses" ? "e" : "") + (n > 1 ? "s" : "");
    if (!entrees.length) {
      $.toast({ ...TOAST_INFO, text: `Aucun ${libelle} à partager.` });
      return Promise.resolve(false);
    }
    if ($bouton) $bouton.prop("disabled", true);
    let mesure = Journal.mesurer(`Partage des ${libelle}s`);
    return PartageChasses._partager(type, entrees)
      .then((n) => {
        // floods présents dans le sujet (nouveaux ou déjà publiés) : marqués partagés
        if (type == "Floods") {
          PartageChasses.marquerFloodsPartages(entrees.map((e) => e.id));
          AttaqueLancee.majPartages();
        }
        return n;
      })
      .then((n) => {
        $.toast({
          ...TOAST_SUCCESS,
          text: n
            ? `${n} ${libelle}${n > 1 ? "s" : ""} partagé${accord(n)} avec la ${Utils.alliance}.`
            : `Ces ${libelle}s étaient déjà partagé${accord(2)}.`,
        });
        return true;
      })
      .catch((e) => {
        let code = e && e.message;
        $.toast({
          ...TOAST_ERROR,
          hideAfter: 10000,
          text:
            code == "absente"
              ? SECTION_INTROUVABLE
              : code == "sans sujet commun"
                ? `Partage impossible : pas de sujet « ${e.titre} » dans la section « ${FORUM_SECTIONS_CHASSES[0]} » du forum. Demande à un chef de le créer, avec un premier message modifiable par tous les membres.`
                : code == "défaites"
                  ? `Partage non enregistré : le sujet « ${e.titre} » n'a pas été modifié. Si quelqu'un y a répondu, son premier message n'est plus modifiable (un chef peut supprimer la réponse) ; sinon, ton grade n'a peut-être pas le droit d'y écrire (demande à un chef), ou d'autres membres l'écrivaient au même moment : réessaie.`
                  : code == "trop long"
                    ? `Partage non enregistré : le sujet « ${e.titre} » est plein (un message du forum a une taille maximale) : préviens un chef.`
                    : `Partage impossible : le forum de l'alliance n'a pas pu être lu ou modifié.`,
        });
        // refus du forum : un nouvel essai à chaque page n'y changerait rien
        // (le bouton Partager de la liste des attaques reste)
        if (
          type == "Floods" &&
          ["absente", "sans sujet commun", "défaites", "trop long"].includes(code)
        )
          AttaqueLancee.oublierPartage(entrees.map((x) => x.id));
        return false;
      })
      .finally(() => {
        mesure.fin();
        if ($bouton) $bouton.prop("disabled", false);
      });
  }
  /**
   * Retire de ma section du sujet commun des floods des floods (numéros
   * d'attaque) qui ne sont plus dans la liste du jeu, annulés ou arrivés : un
   * flood ne quitte le forum que pour cette raison (règle du mainteneur, pas
   * de retrait à la main). Les entrées passées sont purgées au passage, comme
   * lors d'un partage ; rien n'est écrit si aucun de ces floods n'est dans ma
   * section, et un message seulement si un flood à venir est retiré.
   *
   * @static
   * @method retirerFloods
   * @param {Array<Number>} ids
   * @return {Promise}
   */
  static retirerFloods(ids) {
    ids = ids.filter((id) => !retraitsEnCours.has(id));
    if (!ids.length) return Promise.resolve();
    PartageChasses.noterARetirer(ids, true);
    ids.forEach((id) => retraitsEnCours.add(id));
    return PartageChasses.enFile(() => PartageChasses._retirerFloods(ids)).finally(() =>
      ids.forEach((id) => retraitsEnCours.delete(id)),
    );
  }
  /**
   * Note (ajouter) ou efface des floods de la liste des retraits à faire.
   *
   * @static
   * @method noterARetirer
   * @param {Array<Number>} ids
   * @param {Boolean} ajouter
   */
  static noterARetirer(ids, ajouter) {
    let liste = Utils.lireStockage(CLE_FLOODS_A_RETIRER, []).filter((id) => !ids.includes(id));
    if (ajouter) liste.push(...ids);
    try {
      localStorage.setItem(CLE_FLOODS_A_RETIRER, JSON.stringify(liste));
    } catch (e) {}
  }
  /**
   * Au chargement de chaque page : reprend les retraits et les partages de
   * floods qu'une page quittée trop tôt a laissés en suspens. Aucune requête
   * s'il n'y a rien en attente.
   *
   * @static
   * @method reprendre
   * @return {Promise}
   */
  static reprendre() {
    if (!monProfil.pseudo) return Promise.resolve();
    let aRetirer = Utils.lireStockage(CLE_FLOODS_A_RETIRER, []);
    return Promise.all([
      aRetirer.length ? PartageChasses.retirerFloods(aRetirer) : null,
      AttaqueLancee.partagerMarquees(),
    ]);
  }
  /**
   * @private
   * @static
   * @param {Array<Number>} ids
   * @return {Promise}
   */
  static _retirerFloods(ids) {
    let mesure = Journal.mesurer("Retrait de floods partagés"),
      retires = 0;
    return PartageChasses._modifierSection("Floods", (anciennes, sujets) => {
      let maintenant = Horloge.serveur().format("YYYY-MM-DD HH:mm"),
        gardes = anciennes.filter((e) => e.date >= maintenant && !ids.includes(e.id)),
        presents = anciennes.filter((e) => ids.includes(e.id));
      // un flood arrivé n'est plus « retiré » : il serait purgé de toute façon
      retires = presents.filter((e) => e.date >= maintenant).length;
      if (!presents.length) return null;
      // arrivés (minute passée) : vers l'historique ; annulés à venir : retirés
      let passees = anciennes.filter((e) => e.date < maintenant);
      return passees.length
        ? PartageChasses.archiverPassees("Floods", passees, sujets).then((archivees) =>
            gardes.concat(archivees ? [] : passees),
          )
        : gardes;
    })
      .then(() => {
        PartageChasses.oublierFloodsPartages(ids);
        PartageChasses.noterARetirer(ids, false);
        AttaqueLancee.majPartages();
        if (retires)
          $.toast({
            ...TOAST_SUCCESS,
            text: `${retires} flood${retires > 1 ? "s annulés retirés" : " annulé retiré"} du forum de la ${Utils.alliance}.`,
          });
      })
      .catch((e) => {
        // pas de section de partage ni de sujet commun : rien à retirer, inutile de réessayer
        if (e && (e.message == "absente" || e.message == "sans sujet commun")) {
          PartageChasses.oublierFloodsPartages(ids);
          PartageChasses.noterARetirer(ids, false);
        }
        // réessayé à la page suivante, sans message
        console.warn(`[${NOM_EXTENSION}] retrait des floods différé`, e);
      })
      .finally(mesure.fin);
  }
  /**
   * @static
   * @method oublierFloodsPartages
   */
  static oublierFloodsPartages(ids) {
    let liste = PartageChasses.floodsPartages();
    ids.forEach((id) => delete liste[id]);
    try {
      localStorage.setItem(CLE_FLOODS_PARTAGES, JSON.stringify(liste));
    } catch (e) {}
  }
  /**
   * Numéros des attaques déjà publiées dans ma section du sujet commun des floods :
   * {id: date du marquage (ms)}. Tenu à jour à chaque partage depuis ce
   * navigateur, et sur la page Armée d'après la lecture du forum.
   *
   * @static
   * @method floodsPartages
   */
  static floodsPartages() {
    return Utils.lireStockage(CLE_FLOODS_PARTAGES, {});
  }
  /**
   * @static
   * @method marquerFloodsPartages
   */
  static marquerFloodsPartages(ids) {
    let liste = PartageChasses.floodsPartages(),
      limite = Date.now() - 7 * 86400000;
    ids.filter(Boolean).forEach((id) => (liste[id] = Date.now()));
    // attaques arrivées depuis longtemps : oubliées
    for (let id in liste) if (liste[id] < limite) delete liste[id];
    try {
      localStorage.setItem(CLE_FLOODS_PARTAGES, JSON.stringify(liste));
    } catch (e) {}
  }
  /**
   * État « partagé » des floods affichés recalé sur le forum, qui fait foi
   * entre appareils : publiés ailleurs → partagés ici, retirés ailleurs →
   * à partager ici.
   *
   * @static
   * @method recalerFloods
   * @param {Array<Number>} publies numéros présents dans le sujet du joueur
   * @param {Array<Number>} affiches numéros des attaques affichées
   */
  static recalerFloods(publies, affiches) {
    PartageChasses.marquerFloodsPartages(publies);
    PartageChasses.oublierFloodsPartages(affiches.filter((id) => !publies.includes(id)));
  }
  /**
   * Ressources.php : groupes de la synthèse des chasses.
   *
   * @static
   * @method partager
   * @param {Array} groupes [{impact (moment), terrain, unites (texte)}]
   */
  static partager(groupes, $bouton) {
    // en file : un second partage (clic répété, page rechargée) relit le sujet écrit par le premier
    return PartageChasses.enFile(() =>
      PartageChasses._avecBouton(
        $bouton,
        "Chasses",
        groupes.map((g) => ({
          date: g.impact.format("YYYY-MM-DD HH:mm"),
          terrain: g.terrain,
        })),
      ),
    );
  }
  /**
   * Attaques capturées (AttaqueLancee) : floods sur le terrain de chasse dont
   * l'arrivée et la prise estimée sont connues.
   *
   * @static
   * @method partagerFloods
   */
  static partagerFloods(captures, $bouton) {
    if ($bouton) $bouton.prop("disabled", true);
    return PartageChasses.enFile(() => PartageChasses._partagerFloods(captures, $bouton));
  }
  /**
   * @private
   * @static
   */
  static _partagerFloods(captures, $bouton) {
    return PartageChasses._avecBouton($bouton, "Floods", PartageChasses.entreesFloods(captures));
  }
  /**
   * Lignes « Floods » du forum de mes attaques capturées (AttaqueLancee) :
   * minute du RC, cible, unités, prise estimée au lancement, TdC de la cible.
   *
   * @static
   * @method entreesFloods
   * @param {Array} captures
   * @return {Array}
   */
  static entreesFloods(captures) {
    return captures
      .filter((c) => c && c.arrivee)
      .map((c) => {
        let unites = Object.values(c.unite || {}).reduce((t, n) => t + (n || 0), 0),
          zone = AttaqueLancee.zoneLieu(c.lieu),
          estimee =
            c.terrainDepart != null && c.terrainCible != null
              ? c.terrainDepart - c.terrainCible
              : null;
        // dôme ou loge : le TdC est pris comme au terrain ; la ligne du forum
        // garde sa zone et le format sans « cm² » (prise recalculée à la lecture)
        if (zone == "Dôme" || zone == "Loge")
          return {
            date: Utils.minuteRC(moment(c.arrivee)).format("YYYY-MM-DD HH:mm"),
            cible: c.cible,
            unites: unites || null,
            terrain: estimee != null ? estimee : unites,
            tdcCible: c.terrainConnu || c.terrainDepart || null,
            id: c.id,
            lieu: zone,
          };
        return {
          // minute du RC (celle où le terrain change), comme le tableau des attaques
          date: Utils.minuteRC(moment(c.arrivee)).format("YYYY-MM-DD HH:mm"),
          cible: c.cible,
          // unités envoyées et prise estimée au lancement (règle des 20 %) ;
          // les synthèses recalculent la prise à l'impact (PartageChasses.simuler)
          unites: unites || null,
          terrain: estimee != null ? estimee : unites,
          // TdC de la cible connu au lancement (profil ou saisie du lanceur de flood)
          tdcCible: c.terrainConnu || c.terrainDepart || null,
          id: c.id,
        };
      })
      .filter((e) => e.terrain > 0 || (e.lieu && e.unites));
  }
  /**
   * Lit dans les sujets communs du forum les chasses (des joueurs demandés,
   * ou de tous) et les floods de tous les membres, une section par joueur.
   * Rejetée avec Error("sans sujet commun") si un sujet commun manque.
   *
   * @static
   * @method charger
   * @param {Array|null} chassesDe pseudos dont lire les chasses (null : tous)
   * @param {Boolean} [avecFloods] false : les chasses seulement
   * @param {{prevoir: (n: Number) => void, faite: () => void}|null} [suivi] prévenu de chaque lecture (avancement affiché)
   * @return {Promise<Object>} {chasses: {pseudo minuscule: [...]}, floods: [... avec lanceur]}
   */
  static charger(chassesDe = null, avecFloods = true, suivi = null) {
    if (suivi) suivi.prevoir(1);
    return PartageChasses.sujets(true).then((sujets) => {
      let voulus = chassesDe ? chassesDe.map((p) => p.toLowerCase()) : null,
        types = ["Floods", "Chasses"].filter((type) =>
          type == "Floods" ? avecFloods : !voulus || voulus.length,
        ),
        manquants = types.filter((type) => !(sujets.communs || {})[type]),
        d = { chasses: {}, floods: [] };
      if (manquants.length) {
        Journal.info(
          "Forum",
          `pas de sujet ${manquants.map((type) => `« ${SUJETS_COMMUNS[type]} »`).join(" ni ")} dans la section : partages illisibles`,
        );
        throw Object.assign(new Error("sans sujet commun"), {
          titre: SUJETS_COMMUNS[manquants[0]],
        });
      }
      if (suivi) suivi.faite();
      return Promise.all(
        types.map((type) =>
          PartageChasses._lireCommun(sujets.communs[type], suivi).then((v) => [type, v]),
        ),
      ).then((lus) => {
        // floods de tous les joueurs ; chasses des joueurs demandés
        lus.forEach(([type, v]) => {
          let recentes = PartageChasses.sectionsRecentes(v.sections);
          Object.keys(recentes)
            .sort()
            .forEach((k) => {
              let s = recentes[k];
              if (type == "Floods")
                s.floods.forEach((/** @type {any} */ e) =>
                  d.floods.push({ ...e, lanceur: s.pseudo }),
                );
              else if (!voulus || voulus.includes(k)) d.chasses[k] = s.chasses;
            });
        });
        return d;
      });
    });
  }
  /**
   * Joueurs que des floods partagés relient aux joueurs suivis, même de proche
   * en proche (lanceur d'un flood sur l'un d'eux, cible d'un de leurs floods,
   * et ainsi de suite) : les TdC des autres joueurs ne changent pas les leurs.
   *
   * @static
   * @method relies
   * @param {Array} floods
   * @param {Array<String>} suivis
   * @return {Array<String>} pseudos en minuscules, sans les joueurs suivis
   */
  static relies(floods, suivis) {
    let depart = suivis.map((p) => String(p).toLowerCase()),
      groupe = new Set(depart),
      ajout = true;
    while (ajout) {
      ajout = false;
      floods.forEach((f) => {
        let l = String(f.lanceur).toLowerCase(),
          c = String(f.cible).toLowerCase();
        if (groupe.has(l) != groupe.has(c)) {
          groupe.add(l);
          groupe.add(c);
          ajout = true;
        }
      });
    }
    return [...groupe].filter((p) => !depart.includes(p));
  }
  /**
   * Ajoute aux partages lus pour suivre des joueurs ce que la page Membres
   * utilise aussi : les chasses des joueurs reliés et les TdC actuels des
   * membres. Sans le TdC du lanceur, un flood d'un autre joueur sur un joueur
   * suivi ne pouvait pas être jugé hors portée et comptait 20 %.
   *
   * @static
   * @method completer
   * @param {Object} d charger(suivis), mes mouvements compris s'il y a lieu
   * @param {Array<String>} suivis
   * @param {{prevoir: (n: Number) => void, faite: () => void}|null} [suivi] prévenu de chaque lecture (avancement affiché)
   * @return {Promise<{d: Object, tdc: Object}>} tdc : {pseudo: TdC} des membres ({} sans joueur relié)
   */
  static completer(d, suivis, suivi = null) {
    let relies = PartageChasses.relies(d.floods, suivis);
    if (!relies.length) return Promise.resolve({ d, tdc: {} });
    let manquants = relies.filter((p) => !d.chasses[p]);
    if (suivi) suivi.prevoir(1);
    return Promise.all([
      manquants.length
        ? PartageChasses.charger(manquants, false, suivi).catch(() => ({ chasses: {} }))
        : { chasses: {} },
      PartageChasses.tdcMembres().then((tdc) => {
        if (suivi) suivi.faite();
        return tdc;
      }),
    ]).then(([lu, tdc]) => {
      let chasses = { ...d.chasses };
      manquants.forEach((p) => {
        if (lu.chasses[p]) chasses[p] = lu.chasses[p];
      });
      return { d: { ...d, chasses }, tdc };
    });
  }
  /**
   * TdC actuels des membres, gardés une minute comme les lectures du forum :
   * page Membres du jeu, ou, si son tableau n'y est pas (le jeu peut le
   * remplir après coup, comme le forum), page de l'alliance au classement.
   *
   * @static
   * @method tdcMembres
   * @return {Promise<Object>} {pseudo: TdC} ; {} si aucune n'est lisible
   */
  static tdcMembres() {
    let lire = (adresse, colonnePseudo, colonneTerrain) =>
      Promise.resolve($.get(location.origin + adresse)).then(
        (html) => {
          let tdc = PartageChasses.lireTdcMembres(
            Utils.parseHtml(String(html)),
            colonnePseudo,
            colonneTerrain,
          );
          // page de connexion, ou tableau absent : rien n'est gardé
          if (!Object.keys(tdc).length) throw new Error(`${adresse} : tableau des membres absent`);
          return tdc;
        },
        (xhr) => {
          throw new Error(`${adresse} : HTTP ${xhr && xhr.status}`);
        },
      );
    return PartageChasses._enCache("tdcMembres", true, () =>
      lire("/alliance.php?Membres", 3, 5).catch((e) =>
        Utils.alliance
          ? lire("/classementAlliance.php?alliance=" + encodeURIComponent(Utils.alliance), 2, 4)
          : Promise.reject(e),
      ),
    ).catch((e) => {
      if (typeof Journal != "undefined")
        Journal.erreur("TdC des membres", String((e && e.message) || e));
      return {};
    });
  }
  /**
   * TdC des membres, où ceux lus sur la page ouverte (plus frais) les remplacent.
   *
   * @static
   * @method tdcConnus
   * @param {Object} membres tdcMembres()
   * @param {Object} page {pseudo: TdC} ; un TdC absent ou nul ne remplace rien
   * @return {Object} {pseudo: TdC}, pour simuler()
   */
  static tdcConnus(membres, page) {
    let connus = { ...membres };
    for (let p in page) if (p && page[p] > 0) connus[p] = page[p];
    return connus;
  }
  /**
   * @static
   * @method lireTdcMembres
   * @param {Object} $page page Membres ou page de l'alliance au classement (jQuery)
   * @param {Number} colonnePseudo 3 sur la page Membres, 2 au classement
   * @param {Number} colonneTerrain 5 sur la page Membres, 4 au classement
   * @return {Object} {pseudo: TdC}
   */
  static lireTdcMembres($page, colonnePseudo, colonneTerrain) {
    let tdc = {};
    $page.find("#tabMembresAlliance tr").each((i, tr) => {
      let $cases = $(tr).children("td"),
        pseudo = $cases.eq(colonnePseudo).text().trim(),
        terrain = numeral($cases.eq(colonneTerrain).text()).value();
      if (pseudo && terrain > 0) tdc[pseudo] = terrain;
    });
    return tdc;
  }
  /**
   * Partages du forum où mes floods sont ceux de la liste du jeu et mes
   * chasses celles de Ressources.php (s'il a été lu) : mes mouvements non
   * partagés comptent, sans doublon.
   *
   * @static
   * @method avecMesMouvements
   * @param {Object} d charger()
   * @param {String} moi
   * @param {Array} mesFloods lignes de entreesFloods
   * @param {Array|null} mesChasses [{date, terrain}] ; null : celles du forum
   * @param {Array<Number>} [enCours] numéros de mes attaques de la liste du jeu : la
   *   ligne du forum de celles que `mesFloods` ne décrit pas (lancées ailleurs, sans
   *   détail du jeu) est gardée
   * @return {Object} {chasses, floods}
   */
  static avecMesMouvements(d, moi, mesFloods, mesChasses, enCours = []) {
    let m = moi.toLowerCase(),
      decrits = mesFloods.map((f) => f.id);
    return {
      chasses: mesChasses ? { ...d.chasses, [m]: mesChasses } : d.chasses,
      floods: d.floods
        .filter(
          (f) =>
            String(f.lanceur).toLowerCase() != m ||
            (enCours.includes(f.id) && !decrits.includes(f.id)),
        )
        .concat(mesFloods.map((f) => ({ ...f, lanceur: moi }))),
    };
  }
  /**
   * Rejoue dans l'ordre d'arrivée les chasses et floods partagés à venir, en
   * suivant le TdC de chaque joueur concerné, pour estimer la prise réelle de
   * chaque flood à l'impact :
   *  - prise = min(unités envoyées, ⌊20 % du TdC de la cible à l'impact⌋) ;
   *  - aucune prise si, à l'impact, la cible n'est plus à portée du lanceur
   *    (Utils.aPortee : de la moitié au triple − 1 du TdC du lanceur ; c'est
   *    l'« opti-flood raté ») ;
   *  - TdC connus : ceux de la page (paramètre `connus`), sinon, pour une
   *    cible, le TdC relevé au lancement du flood le plus récent sur elle ;
   *    sans TdC connu pour la cible, la prise estimée au lancement est gardée.
   * À minute égale : les chasses d'abord, puis les floods dans l'ordre d'envoi.
   *
   * @static
   * @method simuler
   * @param {Object} d résultat de charger()
   * @param {Object} connus {pseudo: TdC actuel}
   * @param {Object|null} [depuis] heure (moment) où ces TdC ont été lus ; défaut : maintenant
   * @return {Object} {evenements: [...], depart: {pseudo minuscule: TdC}}
   */
  static simuler(d, connus = {}, depuis = null) {
    // les mouvements arrivés depuis la lecture des TdC sont rejoués
    let maintenant = (depuis ? moment(depuis) : Horloge.serveur()).format("YYYY-MM-DD HH:mm"),
      tdc = {},
      releve = {};
    for (let p in connus) if (connus[p] > 0) tdc[p.toLowerCase()] = connus[p];
    d.floods.forEach((f) => {
      let c = f.cible.toLowerCase();
      if (f.tdcCible > 0 && (!releve[c] || (f.id || 0) >= releve[c].id))
        releve[c] = { id: f.id || 0, tdc: f.tdcCible };
    });
    for (let c in releve) if (tdc[c] == null) tdc[c] = releve[c].tdc;
    let depart = { ...tdc },
      evts = [];
    for (let p in d.chasses)
      (d.chasses[p] || []).forEach((e) =>
        evts.push({ type: "chasse", date: e.date, joueur: p, terrain: e.terrain, id: 0 }),
      );
    d.floods.forEach((f) => evts.push({ ...f, type: "flood", id: f.id || 0 }));
    evts = evts
      .filter((e) => e.date >= maintenant)
      .sort((a, b) =>
        a.date < b.date
          ? -1
          : a.date > b.date
            ? 1
            : a.type != b.type
              ? a.type == "chasse"
                ? -1
                : 1
              : a.id - b.id,
      );
    evts.forEach((e) => {
      if (e.type == "chasse") {
        e.prise = e.terrain;
        if (tdc[e.joueur] != null) tdc[e.joueur] += e.terrain;
        e.tdcApres = tdc[e.joueur];
        return;
      }
      let c = e.cible.toLowerCase(),
        l = e.lanceur.toLowerCase(),
        tc = tdc[c],
        tl = tdc[l],
        envoi = e.unites != null ? e.unites : e.terrain;
      e.tdcCibleAvant = tc;
      // même règle au dôme et en loge (e.lieu) qu'au terrain de chasse
      if (tc == null) {
        // TdC de la cible inconnu : prise estimée au lancement
        e.prise = e.terrain;
        e.statut = "inconnu";
      } else if (tl != null && !Utils.aPortee(tc, tl)) {
        e.prise = 0;
        e.statut = "portee";
      } else {
        let plafond = Math.floor(tc * 0.2);
        e.prise = Math.min(envoi, plafond);
        e.statut = envoi > plafond ? "plafond" : "ok";
      }
      if (tc != null) tdc[c] = tc - e.prise;
      if (tl != null) tdc[l] = tl + e.prise;
      e.tdcCibleApres = tdc[c];
      e.tdcLanceurApres = tdc[l];
    });
    return { evenements: evts, depart: depart };
  }
  /**
   * Variations à venir d'un joueur d'après une simulation : une ligne par
   * chasse ou par flood (même à la même minute), dans l'ordre.
   *
   * @static
   * @method chronologie
   * @return {Array} [{date, delta, unites, autre, statut, flood}]
   */
  static chronologie(sim, pseudo) {
    let p = pseudo.toLowerCase(),
      lignes = [];
    sim.evenements.forEach((e) => {
      if (e.type == "chasse") {
        if (e.joueur == p)
          lignes.push({ date: e.date, delta: e.prise, autre: "Chasse", flood: false });
        return;
      }
      let vers = e.cible.toLowerCase() == p,
        depuis = e.lanceur.toLowerCase() == p;
      if (vers == depuis) return;
      lignes.push({
        date: e.date,
        delta: vers ? -e.prise : e.prise,
        unites: e.unites,
        autre: vers ? e.lanceur : e.cible,
        lanceur: e.lanceur,
        cible: e.cible,
        statut: e.statut,
        lieu: e.lieu || null,
        flood: true,
      });
    });
    return lignes;
  }
  /**
   * Ligne d'une chronologie où se trouve le TdC qu'une attaque lancée à
   * `depart` trouverait : son arrivée est ramenée à la minute du RC, comme les
   * dates des floods partagés, et une variation de la même minute passe avant
   * elle (ordre d'envoi, comme dans simuler).
   *
   * @static
   * @method arriveeAttaque
   * @param {Array} vars chronologie(), dans l'ordre
   * @param {Number|null} secondes temps de trajet à ma Vitesse d'attaque (null : inconnu)
   * @param {Object} depart heure du lancement (moment)
   * @return {{minute: Object, ligne: Number}|null} ligne : indice dans vars, -1 avant toute variation
   */
  static arriveeAttaque(vars, secondes, depart) {
    if (secondes == null) return null;
    let minute = Utils.roundMinute(secondes, depart),
      cle = minute.format("YYYY-MM-DD HH:mm");
    return { minute, ligne: vars.reduce((a, v, j) => (v.date <= cle ? j : a), -1) };
  }
  /**
   * Lignes du tableau du TdC après chaque variation (info-bulle de la page
   * Membres, page d'un membre), la ligne `surlignee` mise en évidence.
   *
   * @static
   * @method lignesEvolution
   * @param {Number} terrain TdC actuel
   * @param {Array} vars chronologie()
   * @param {Number|null} surlignee indice dans vars, -1 : « Actuellement », null : aucune
   * @param {String} classeEntete classe de la ligne d'en-tête
   * @return {String} HTML des lignes
   */
  static lignesEvolution(terrain, vars, surlignee, classeEntete) {
    let tdc = terrain,
      classe = (/** @type {Number} */ j) => (j === surlignee ? " class='o_ligneArrivee'" : ""),
      lignes = [
        `<tr class='${classeEntete}'><td></td><td>TdC</td><td>Variation</td><td>Unités</td><td>Lanceur → cible</td></tr>`,
        `<tr${classe(-1)}><td>Actuellement</td><td>${numeral(tdc).format()} cm²</td><td></td><td></td><td></td></tr>`,
      ];
    vars.forEach((v, j) => {
      tdc += v.delta;
      lignes.push(
        `<tr${classe(j)}><td>${moment(v.date, "YYYY-MM-DD HH:mm").format("DD/MM HH[h]mm")}</td><td>${numeral(tdc).format()} cm²</td><td class='o_partageVariation'>${PartageChasses.libellePrise(v, "")}</td><td class='o_partageVariation'>${v.flood && v.unites != null ? numeral(v.unites).format() : ""}</td><td class='o_allInfoCible'>${PartageChasses.sens(v)}</td></tr>`,
      );
    });
    return lignes.join("");
  }
  /**
   * Quand `pseudo` est à ma portée (je peux le flooder : Utils.aPortee de son
   * TdC face au mien), d'après les mouvements partagés à venir, les siens et
   * les miens. L'état est pris à la fin de chaque minute : deux floods de la
   * même minute ne laissent pas un instant pour lancer.
   *
   * @static
   * @method portee
   * @param {Object} sim simuler()
   * @param {String} pseudo
   * @param {Number} terrain son TdC actuel
   * @param {Number} monTerrain mon TdC actuel
   * @return {{deja: Boolean, date: String|null}|null} deja : à portée maintenant, `date` (« AAAA-MM-JJ HH:mm ») étant alors celle où il en sort, sinon celle où il y entre (null : jamais) ; null pour moi ou un TdC inconnu
   */
  static portee(sim, pseudo, terrain, monTerrain) {
    let p = pseudo.toLowerCase(),
      m = String(monProfil.pseudo || "").toLowerCase();
    if (p == m || !(terrain > 0) || !(monTerrain > 0)) return null;
    let lui = terrain,
      moi = monTerrain,
      deja = Utils.aPortee(lui, moi),
      evts = sim.evenements;
    for (let i = 0; i < evts.length; i++) {
      let e = evts[i],
        variation = (/** @type {String} */ joueur) =>
          e.type == "chasse"
            ? e.joueur == joueur
              ? e.prise
              : 0
            : (e.lanceur.toLowerCase() == joueur ? e.prise : 0) -
              (e.cible.toLowerCase() == joueur ? e.prise : 0);
      lui += variation(p);
      moi += variation(m);
      if (i + 1 < evts.length && evts[i + 1].date == e.date) continue;
      if (Utils.aPortee(lui, moi) != deja) return { deja, date: e.date };
    }
    return { deja, date: null };
  }
  /**
   * Mention écrite après le pseudo : « à portée le 10/11 à 12h45 », « déjà à
   * portée (jusqu'au …) » ou « hors de portée », l'heure mise en évidence.
   *
   * @static
   * @method mentionPortee
   * @param {{deja: Boolean, date: String|null}|null} portee portee()
   * @return {String} HTML ("" sans portée connue)
   */
  static mentionPortee(portee) {
    if (!portee) return "";
    let heure = portee.date
        ? `<span class='o_porteeHeure'>${moment(portee.date, "YYYY-MM-DD HH:mm").format("DD/MM [à] HH[h]mm")}</span>`
        : "",
      texte = portee.deja
        ? `déjà à portée${heure ? ` jusqu'au ${heure}` : ""}`
        : heure
          ? `à portée le ${heure}`
          : "hors de portée";
    return ` <span class='o_portee'>${texte}</span>`;
  }
  /**
   * Note sous ce tableau : heure d'arrivée de l'attaque, sinon `siInconnue`.
   *
   * @static
   * @method noteArrivee
   * @param {{minute: Object, ligne: Number}|null} arrivee arriveeAttaque()
   * @param {String} siInconnue texte sans temps de trajet ("" : pas de note)
   * @return {String} HTML
   */
  static noteArrivee(arrivee, siInconnue) {
    let texte = arrivee
      ? `Surligné : TdC à l'arrivée d'une attaque lancée à l'ouverture de la page (${arrivee.minute.format("DD/MM HH[h]mm")}).`
      : siInconnue;
    return texte ? `<div class='o_note'>${texte}</div>` : "";
  }
  /**
   * Sens d'une variation de la chronologie : « lanceur → cible » pour un
   * flood, « Chasse » pour une chasse (HTML échappé).
   *
   * @static
   * @method sens
   * @param {Object} v ligne de chronologie
   * @return {String}
   */
  static sens(v) {
    return v.flood ? `${Utils.echapper(v.lanceur)} → ${Utils.echapper(v.cible)}` : "Chasse";
  }
  /**
   * Prise signée et colorée, avec la raison quand elle diffère des unités
   * envoyées : « (20 %) » plafonnée, « hors portée », « ~ » estimée au lancement ;
   * « (dôme) » ou « (loge) » pour une attaque à ce lieu.
   *
   * @static
   * @method libellePrise
   */
  static libellePrise(v, unite = " cm²") {
    let html =
      v.delta == 0
        ? `<span>0${unite}</span>`
        : `<span class='${v.delta > 0 ? "o_varPos" : "o_varNeg"}'>${v.delta > 0 ? "+" : "−"}${v.statut == "inconnu" ? "~" : ""}${numeral(Math.abs(v.delta)).format()}${unite}</span>`;
    if (v.statut == "plafond") html += " <small class='o_priseNote'>(20 %)</small>";
    else if (v.statut == "portee")
      html +=
        " <small class='o_priseNote' title='À l&#39;impact, la cible n&#39;est plus à portée (50 % à 300 % du TdC du lanceur) : opti-flood raté'>(hors portée)</small>";
    if (v.lieu == "Dôme" || v.lieu == "Loge")
      html += ` <small class='o_priseNote' title='Attaque ${v.lieu == "Loge" ? "en loge" : "au dôme"} : TdC pris comme au terrain de chasse'>(${v.lieu == "Loge" ? "loge" : "dôme"})</small>`;
    return html;
  }
  /**
   * Page d'un membre : évolution de son TdC avec ses chasses et les floods
   * partagés (unités envoyées et prise estimée à l'impact pour chaque flood),
   * où est surlignée la ligne du TdC à l'arrivée d'une attaque lancée à
   * l'ouverture de la page.
   *
   * @static
   * @method afficherProfil
   * @param {String} pseudo
   * @param {Number} terrain
   * @param {{secondes: Number|null, depart: Object}|null} [attaque] trajet vers lui et heure d'ouverture (null : son propre profil)
   */
  static afficherProfil(pseudo, terrain, attaque = null) {
    if (!Utils.affichage("profilPartages")) return;
    // chasses du joueur affiché, les miennes et celles des joueurs reliés ;
    // floods de tous les membres : à chaque affichage, une correction faite dans
    // le forum est prise en compte
    let suivis = monProfil.pseudo ? [pseudo, monProfil.pseudo] : [pseudo],
      mesure = Journal.mesurer("Page d'un membre");
    PartageChasses.charger(suivis)
      .then((d) => PartageChasses.completer(d, suivis))
      .then(({ d, tdc }) => {
        let page = { [pseudo]: terrain };
        if (monProfil.pseudo) page[monProfil.pseudo] = Utils.terrain;
        let sim = PartageChasses.simuler(d, PartageChasses.tdcConnus(tdc, page)),
          vars = PartageChasses.chronologie(sim, pseudo),
          // la synthèse seule (règle du mainteneur) : chaque chasse et chaque flood y a sa ligne
          contenu = "<p class='centre'>Aucune chasse ni aucun flood en cours partagé.</p>";
        if (vars.length && !(terrain > 0))
          contenu = `<p class='centre'>TdC de ${Utils.echapper(pseudo)} illisible sur la page : évolution impossible.</p>`;
        else if (vars.length) {
          let arrivee = attaque
            ? PartageChasses.arriveeAttaque(vars, attaque.secondes, attaque.depart)
            : null;
          contenu =
            `<div class='o_partageSynthese'>` +
            `<h3 class='o_partageTitre'>Évolution du TdC de ${Utils.echapper(pseudo)}${attaque ? PartageChasses.mentionPortee(PartageChasses.portee(sim, pseudo, terrain, Utils.terrain)) : ""}</h3>
              <table class='centre' cellspacing='0'>${PartageChasses.lignesEvolution(terrain, vars, arrivee ? arrivee.ligne : null, "o_partageEntete")}</table>` +
            PartageChasses.noteArrivee(
              arrivee,
              attaque ? "TdC à l'arrivée d'une attaque : temps de trajet inconnu." : "",
            ) +
            "</div>";
        }
        $("#o_chassesPartagees").remove();
        // entre le bloc « Action » et la suite de la page
        let $action = $(".boite_membre").filter((i, e) => /^\s*Action/.test($(e).text()));
        ($action.length ? $action.first() : $(".boite_membre").last()).after(
          `<div id='o_chassesPartagees' class='boite_membre'>` +
            Utils.spoiler(
              `Chasses et floods en cours partagés avec la ${Utils.alliance}`,
              contenu,
              "profilPartages",
              "o_partageTitre o_partageSpoiler",
            ) +
            "</div>",
        );
      })
      .catch(() => {})
      .then(mesure.fin);
  }
  /**
   * Forum d'alliance : repère la section (et propose de la créer).
   *
   * @static
   * @method observerForum
   */
  static observerForum() {
    let $alliance = $("#alliance");
    if (!$alliance.length) return;
    let traiter = () => {
      let $span = $alliance
        .find("span[class^='forum']")
        .filter((i, e) => PartageChasses.estSection($(e).text()))
        .first();
      if ($span.length) {
        let id = ($span.attr("class").match(/\d+/) || [])[0];
        if (id) PartageChasses.idSection = id;
        $("#o_creerSectionChasses").remove();
      } else if (
        Utils.affichage("forumSection") &&
        $alliance.find("#cat_forum").length &&
        !$("#o_creerSectionChasses").length
      ) {
        $alliance
          .find("#cat_forum")
          .after(
            `<div id='o_creerSectionChasses' class='centre o_marginT15'><button type='button' class='o_button f_info'>${NOM_EXTENSION} : créer la section cachée « ${FORUM_SECTIONS_CHASSES[0]} » (partage des chasses)</button></div>`,
          );
        $("#o_creerSectionChasses button").on("click", (e) => {
          $(e.currentTarget).prop("disabled", true);
          PartageChasses._creerSection().then(
            () => location.reload(),
            () => {
              $(e.currentTarget).prop("disabled", false);
              $.toast({
                ...TOAST_ERROR,
                text: "Création impossible : il faut les droits de gestion du forum.",
              });
            },
          );
        });
      }
    };
    traiter();
    new MutationObserver(traiter).observe($alliance[0], { childList: true, subtree: true });
  }
  /**
   * Crée la section puis la passe en « cachée » (le jeu ne permet pas de la
   * créer directement cachée).
   *
   * @private
   */
  static _creerSection() {
    let nom = FORUM_SECTIONS_CHASSES[0];
    return PartageChasses._xajax(
      "ajoutCategorie",
      `<xjxquery><q>nom=${encodeURIComponent(nom)}</q></xjxquery>`,
    ).then((data) => {
      let reponse = Utils.parseHtml($(data).find("cmd:eq(1)").text() || "");
      let id = (
        $(reponse)
          .find("input")
          .filter((i, e) => PartageChasses.estSection(e.value))
          .parent()
          .attr("id") || ""
      ).match(/\d+/);
      if (!id) throw new Error("section non créée");
      PartageChasses.idSection = id[0];
      return PartageChasses._xajax(
        "renommerCategorie",
        `<xjxquery><q>nom=${encodeURIComponent(nom)}&type=cache&ID_cat=${id[0]}&del=Supprimer</q></xjxquery>`,
      );
    });
  }
}
