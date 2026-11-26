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
// sujets où l'alliance tient à la main ses listes de GIF et de smileys pour le chat (ChatGif)
const TITRE_GIF_ALLIANCE = "GIF de l'alliance";
const TITRE_SMILEYS_ALLIANCE = "Smileys de l'alliance";

// numéros des attaques déjà publiées dans la réponse du joueur (sujet commun des floods)
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
// Heures de mes chasses et floods publiées dans le forum retardées d'un délai
// tiré au hasard, de 0 au réglage du joueur : une fuite du forum ne donne pas
// l'heure exacte où son armée est dehors (règle du mainteneur, 21/11/2026).
// Le délai est tiré une fois par chasse ou flood et gardé ici ; tiré à chaque
// écriture, les versions successives de la réponse laisseraient retrouver l'heure.
const CLE_DECALAGES = "fzzz_decalagesPartage";
const DECALAGE_MAX = 59;
const PARAMETRE_DECALAGE = { Chasses: "decalageChasses", Floods: "decalageFloods" };
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
// sujets communs à l'alliance, un par type, créés à la main : une réponse par
// joueur, ses floods, ses chasses ou ses convois en cours (ConvoisForum),
// postée puis modifiée par son extension ; l'affichage lit un sujet au lieu
// d'un par joueur
const SUJETS_COMMUNS = {
  Floods: "BDD générale flood - NE RIEN ÉCRIRE",
  Chasses: "BDD générale chasse - NE RIEN ÉCRIRE",
  Convois: "BDD générale convoi - NE RIEN ÉCRIRE",
};
// un message du forum est coupé au-delà d'une taille maximale (relevé du
// 13/11/2026 : 63 253 caractères gardés, 65 484 octets) : au-delà de ce seuil
// prudent, le partage est refusé plutôt que coupé
const COMMUN_MAX_CARACTERES = 40000;
// entrées à venir gardées dans une réponse (les plus proches)
const COMMUN_MAX_ENTREES = 100;
// un message ne peut pas être vide : ma réponse sans entrée à venir
const MESSAGE_VIDE = {
  Floods: "Aucun flood en cours.",
  Chasses: "Aucune chasse en cours.",
  Convois: "Aucun convoi en cours.",
};

/**
 * Partage des chasses et des floods avec l'alliance, stocké dans son forum
 * (aucun serveur tiers), section « BDD partagée cachée » : deux sujets
 * communs (SUJETS_COMMUNS), une réponse par joueur avec ses entrées en cours,
 * une ligne par entrée ; chaque partage modifie la réponse du joueur (fusion
 * sans doublon), que lui seul écrit ; les entrées passées en sont retirées,
 * sans historique. Les convois ont leur sujet commun, écrit par ConvoisForum.
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
   * @return {Promise<any>} rejetée avec Error("absente"), sans requête, quand la case
   *   « Sans config alliance » est cochée
   */
  static _xajax(fonction, args, options = {}) {
    if (Utils.sansConfigAlliance()) return Promise.reject(new Error("absente"));
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
   * @static
   * @method _version
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
      // faites avant une écriture, elles ne l'ont pas
      localStorage.removeItem(CLE_SUJETS_GARDES);
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
   * Messages d'un sujet, dans l'ordre : réponse de callGetTopic, ou d'une
   * écriture, à laquelle le forum répond par le sujet à jour. Pour chacun :
   * l'auteur, le numéro (null pour le premier message) et le texte avec ses
   * retours à la ligne, sans les liens « Modifier » et « Effacer ».
   *
   * @static
   * @method messages
   * @param {any} data réponse xajax
   * @return {Array<{auteur: String, id: Number|null, texte: String}>}
   */
  static messages(data) {
    /** @type {Array<{auteur: String, id: Number|null, texte: String}>} */
    let liste = [];
    Utils.parseHtml(PartageChasses._html(data))
      .find(".auteurForum")
      .each((i, auteur) => {
        let $message = $(auteur).nextAll(".messageForum").first(),
          $corps = $message.find("[id^='editMessage'], [id^='editTopic']").first(),
          numero = ($corps.attr("id") || "").match(/^editMessage(\d+)$/),
          $texte = ($corps.length ? $corps : $message).clone();
        if (!$message.length) return;
        $texte.find("a[onclick]").remove();
        $texte.find("br").replaceWith("\n");
        liste.push({
          auteur: PartageChasses.nettoyer($(auteur).find("a").first().text()),
          id: numero ? parseInt(numero[1]) : null,
          texte: $texte.text().trim(),
        });
      });
    return liste;
  }
  /**
   * Dernière réponse de chaque joueur dans un sujet commun, avec ses chasses
   * et ses floods ; le premier message (ancien format) n'en est pas une.
   *
   * @static
   * @method reponses
   * @param {Array<{auteur: String, id: Number|null, texte: String}>} messages messages()
   * @return {any} {pseudo en minuscules: {pseudo, id, chasses, floods}}
   */
  static reponses(messages) {
    /** @type {any} */
    let joueurs = {};
    messages.forEach((m) => {
      let k = m.auteur.toLowerCase();
      if (m.id == null || !k || (joueurs[k] && joueurs[k].id > m.id)) return;
      joueurs[k] = { pseudo: m.auteur, id: m.id, ...PartageChasses.lireEntrees(m.texte) };
    });
    return joueurs;
  }
  /**
   * @private
   * @static
   * @param {Array<{auteur: String, id: Number|null, texte: String}>} messages messages()
   * @return {any} ma dernière réponse (reponses()), ou null
   */
  static _maReponse(messages) {
    return (
      PartageChasses.reponses(messages)[PartageChasses.nettoyer(monProfil.pseudo).toLowerCase()] ||
      null
    );
  }
  /**
   * Identifiant de la section : celui mémorisé, sinon lu dans la liste des
   * sections que renvoie le forum (le même appel que la page Forum du jeu).
   *
   * @static
   * @method trouverSection
   * @param {Object} [options] réglages de plus pour $.ajax (_xajax)
   * @return {Promise<String>} rejetée avec Error("absente") si la section n'est pas
   *   dans la liste (inexistante, ou cachée au grade du joueur), ou si la case
   *   « Sans config alliance » est cochée
   */
  static trouverSection(options = {}) {
    // case « Sans config alliance » : ni section ni lecture gardée
    if (Utils.sansConfigAlliance()) return Promise.reject(new Error("absente"));
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
   * Sujets de la section : {"Convois | pseudo": idSujet, communs, reglages…}.
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
      // sujets.reglages : sujet des réglages de l'alliance (ReglagesAlliance) ;
      // sujets.gifAlliance, sujets.smileysAlliance : sujets des GIF et des smileys de l'alliance ;
      // sujets.communs : sujets communs par type {type, id, dernier}
      let sujets = { communs: {} },
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
          if (
            commun &&
            idSujet &&
            (!sujets.communs[commun] || Number(idSujet) < Number(sujets.communs[commun].id))
          )
            sujets.communs[commun] = { type: commun, id: idSujet, dernier };
          // créé deux fois (deux enregistrements au même instant) : le plus ancien fait foi
          for (let [cle, titreListe] of [
            ["reglages", TITRE_REGLAGES],
            ["gifAlliance", TITRE_GIF_ALLIANCE],
            ["smileysAlliance", TITRE_SMILEYS_ALLIANCE],
          ])
            if (
              normaliser(titre) == normaliser(titreListe) &&
              idSujet &&
              (!sujets[cle] || Number(idSujet) < Number(sujets[cle]))
            )
              sujets[cle] = idSujet;
        });
      return sujets;
    });
  }
  /**
   * Lecture gardée d'un sujet commun, si elle fait encore foi : faite il y a
   * moins d'une minute par cette version du script, et même texte « Dernier
   * message » qu'alors (une réponse postée depuis le change).
   *
   * @static
   * @method sujetGarde
   * @param {any} gardes lectures gardées (CLE_SUJETS_GARDES)
   * @param {{id: String, dernier?: String}} t sujet de la liste
   * @return {any} reponses(), ou null : à relire
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
   * Sujet lu au forum (réponse xajax), sans les lectures gardées.
   *
   * @static
   * @param {String} idSujet
   * @return {Promise<any>}
   */
  static _lireSujet(idSujet) {
    return PartageChasses._xajax("callGetTopic", idSujet);
  }
  /**
   * Chasses et floods des lignes d'un texte : réponse d'un joueur dans un
   * sujet commun.
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
   * Réponses d'un sujet commun par joueur, gardées une minute (sujetGarde).
   *
   * @private
   * @static
   * @param {{type: String, id: String, dernier?: String}} t sujet commun de la liste
   * @param {{prevoir: (n: Number) => void, faite: () => void}|null} [suivi] prévenu d'une
   *   lecture au forum seulement : une lecture gardée fausserait la durée moyenne affichée
   * @return {Promise<any>} reponses()
   */
  static _lireCommun(t, suivi = null) {
    let garde = PartageChasses.sujetGarde(Utils.lireStockage(CLE_SUJETS_GARDES), t);
    if (garde) {
      if (typeof COMPTE_REQUETES != "undefined") COMPTE_REQUETES.cache++;
      return Promise.resolve(garde);
    }
    if (suivi) suivi.prevoir(1);
    let debut = Horloge.maintenant();
    return PartageChasses._lireSujet(t.id).then((data) => {
      // un sujet n'a jamais été vu sur plusieurs pages (relevé du 14/11/2026) :
      // des liens de page voudraient dire que des joueurs manquent
      if (/xajax_callGetTopic\s*\(\s*\d+\s*,/.test(PartageChasses._html(data)))
        Journal.info(
          "Forum",
          `« ${SUJETS_COMMUNS[t.type]} » : sujet sur plusieurs pages, seules les réponses de la première sont lues`,
        );
      let v = PartageChasses.reponses(PartageChasses.messages(data));
      PartageChasses._garderSujet(t.id, t.dernier || "", debut, v);
      if (suivi) suivi.faite();
      return v;
    });
  }
  /**
   * Lignes de ma réponse, la plus tardive d'abord.
   *
   * @private
   * @static
   * @param {String} type
   * @param {Array} entrees
   * @return {Array<String>}
   */
  static _lignesReponse(type, entrees) {
    return entrees
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.id || 0) - (a.id || 0)))
      .map((e) => PartageChasses._ligne(type, e));
  }
  /**
   * Écrit mes changements (lignes ajoutées et retirées) dans ma réponse du
   * sujet commun, postée la première fois puis modifiée : personne d'autre ne
   * l'écrit. Le forum répond par le sujet à jour, qui sert de vérification ;
   * il ne signale pas une écriture refusée (grade sans droit d'écrire dans la
   * section).
   *
   * @private
   * @static
   * @param {String} type
   * @param {String} idSujet
   * @param {Array<any>} ajouts
   * @param {Array<any>} retraits
   * @param {any} [moi] ma réponse lue juste avant (null : je n'en ai pas) ;
   *   absente, relue (un autre de mes appareils a pu écrire entre-temps)
   * @return {Promise<{etat: String, longueur?: Number}>} etat : « écrite »,
   *   « refusée » ou « trop long »
   */
  static _ecrireMessage(type, idSujet, ajouts, retraits, moi = undefined) {
    let ligne = (/** @type {any} */ e) => PartageChasses._ligne(type, e),
      entrees = (/** @type {any} */ r) => (r ? (type == "Chasses" ? r.chasses : r.floods) : []),
      sans = new Set(retraits.map(ligne)),
      prise = (/** @type {any} */ data) => {
        let presentes = new Set(
          entrees(PartageChasses._maReponse(PartageChasses.messages(data))).map(ligne),
        );
        return (
          ajouts.every((e) => presentes.has(ligne(e))) &&
          !retraits.some((e) => presentes.has(ligne(e)))
        );
      };
    return (
      moi === undefined
        ? PartageChasses._lireSujet(idSujet).then((data) =>
            PartageChasses._maReponse(PartageChasses.messages(data)),
          )
        : Promise.resolve(moi)
    ).then((/** @type {any} */ m) => {
      let miennes = entrees(m).filter((/** @type {any} */ e) => !sans.has(ligne(e))),
        deja = new Set(miennes.map(ligne)),
        toutes = miennes.concat(ajouts.filter((e) => !deja.has(ligne(e)))),
        texte = toutes.length
          ? PartageChasses._lignesReponse(type, toutes).join("\n")
          : MESSAGE_VIDE[type];
      // rien à retirer d'une réponse que je n'ai pas encore
      if (!m && !toutes.length) return { etat: "écrite" };
      if (texte.length > COMMUN_MAX_CARACTERES)
        return { etat: "trop long", longueur: texte.length };
      let q = `message=${encodeURIComponent(texte)}&send=Envoyer`;
      return (
        m
          ? PartageChasses._xajax(
              "envoiEditMessage",
              `<xjxquery><q>IDMessage=${m.id}&${q}</q></xjxquery>`,
            )
          : PartageChasses._xajax(
              "envoiNouveauMessage",
              `<xjxquery><q>topic=${idSujet}&${q}</q></xjxquery>`,
            )
      )
        .then((data) => prise(data) || PartageChasses._lireSujet(idSujet).then(prise))
        .then((ok) => ({ etat: ok ? "écrite" : "refusée", longueur: texte.length }));
    });
  }
  /**
   * Modifie ma réponse du sujet commun du type : `changer` reçoit mes entrées
   * lues au forum et rend toutes celles à garder, ou null s'il n'y a rien à
   * écrire ; seuls les changements sont écrits et vérifiés (_ecrireMessage).
   * `changer` rend un tableau quand il n'a rien écrit au forum : ma réponse
   * lue sert alors à l'écriture, sans la relire.
   *
   * @private
   * @static
   * @param {String} type "Chasses" ou "Floods"
   * @param {(anciennes: Array<any>, sujets: any) => any} changer rend un
   *   tableau d'entrées, null, ou leur promesse
   * @return {Promise<Array<any>|null>} entrées gardées ; rejetée avec
   *   Error("absente"), Error("sans sujet commun"), Error("refusée") ou
   *   Error("trop long"), titre du sujet commun dans .titre
   */
  static _modifierMessage(type, changer) {
    let titre = SUJETS_COMMUNS[type],
      ligne = (/** @type {any} */ e) => PartageChasses._ligne(type, e),
      refus = (/** @type {String} */ code) =>
        Promise.reject(Object.assign(new Error(code), { titre }));
    return PartageChasses.sujets().then((sujets) => {
      let commun = (sujets.communs || {})[type];
      if (!commun) return refus("sans sujet commun");
      return PartageChasses._lireSujet(commun.id).then((data) => {
        let moi = PartageChasses._maReponse(PartageChasses.messages(data)),
          anciennes = moi ? (type == "Chasses" ? moi.chasses : moi.floods) : [],
          rendu = changer(anciennes, sujets),
          lu = Array.isArray(rendu) ? moi : undefined;
        return Promise.resolve(rendu).then((/** @type {Array<any>|null} */ toutes) => {
          if (!toutes) return null;
          let avant = new Set(anciennes.map(ligne)),
            apres = new Set(toutes.map(ligne)),
            ajouts = toutes.filter((e) => !avant.has(ligne(e))),
            retraits = anciennes.filter((e) => !apres.has(ligne(e)));
          if (!ajouts.length && !retraits.length) return toutes;
          return PartageChasses._ecrireMessage(type, commun.id, ajouts, retraits, lu).then((r) => {
            if (r.etat != "écrite")
              Journal.erreur(
                "Forum",
                `« ${titre} » : ma réponse n'a pas été écrite (${r.etat})`,
                r.longueur ? `${r.longueur} caractères` : "",
              );
            return r.etat == "écrite" ? toutes : refus(r.etat);
          });
        });
      });
    });
  }
  /**
   * Fusionne des entrées dans ma réponse du sujet commun du type ; les entrées
   * passées en sont retirées.
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
      fenetre = PartageChasses.decalageMax(type),
      ajoutees = 0;
    entrees = PartageChasses.decaler(type, entrees);
    return PartageChasses._modifierMessage(type, (toutes) => {
      let fichesChasses = PartageChasses._decalages().Chasses,
        // ligne d'une version d'avant 1.156.7 : les chasses de minutes
        // consécutives sur une ligne, à la dernière ; remplacée par les lignes
        // de ses minutes, sinon son TdC compterait en plus du leur
        regroupees =
          type == "Chasses"
            ? toutes.filter((a) => {
                let reel = PartageChasses.reel("Chasses", a, fichesChasses) || a.date,
                  derniere = entrees.find((e) => e.reel == reel);
                return (
                  !!derniere &&
                  a.terrain > derniere.terrain &&
                  entrees.some((e) => e.reel == PartageChasses.decalerDate(reel, -1))
                );
              })
            : [],
        anciennes = toutes.filter((a) => !regroupees.includes(a)),
        ids = anciennes.filter((e) => e.id).map((e) => e.id),
        // anciennes lignes sans numéro d'attaque : chacune ne couvre qu'un envoi
        sansId = anciennes.filter((e) => !e.id).map(cle),
        // chasses publiées depuis un autre appareil (ou avant le retard des
        // heures) : leur heure réelle, inconnue ici, est de 0 à `fenetre` min
        // avant l'heure publiée ; chacune couvre une seule de mes chasses
        fiches = fichesChasses,
        inconnues =
          type == "Chasses"
            ? anciennes.filter((e) => PartageChasses.reel("Chasses", e, fiches) == null)
            : [],
        dejaPubliee = (/** @type {any} */ e) => {
          let fin = PartageChasses.decalerDate(e.reel, fenetre),
            k = inconnues.findIndex((a) => a.date >= e.reel && a.date <= fin);
          // retardée par un autre appareil au-delà de mon réglage : même TdC chassé,
          // au plus DECALAGE_MAX min après, la plus proche
          if (k == -1) {
            let loin = PartageChasses.decalerDate(e.reel, DECALAGE_MAX),
              proches = inconnues
                .filter((a) => a.date > fin && a.date <= loin && a.terrain == e.terrain)
                .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
            k = proches.length ? inconnues.indexOf(proches[0]) : -1;
          }
          if (k == -1) return false;
          inconnues.splice(k, 1);
          return true;
        },
        nouvelles = entrees.filter((e) => {
          if (e.id && ids.includes(e.id)) return false;
          let k = sansId.indexOf(cle(e));
          if (type == "Chasses" ? k != -1 : k != -1 && !e.id) return false;
          if (k != -1) {
            sansId.splice(k, 1);
            return false;
          }
          if (type == "Chasses" && dejaPubliee(e)) return false;
          return true;
        });
      if (type == "Chasses") PartageChasses.noterFinChasses(entrees.map((e) => e.date));
      // les entrées passées quittent ma réponse
      let maintenant = Horloge.serveur().format("YYYY-MM-DD HH:mm"),
        aVenir = anciennes.filter((e) => e.date >= maintenant);
      if (!nouvelles.length && aVenir.length == toutes.length) return null;
      ajoutees = nouvelles.length;
      let prochaines = aVenir
        .concat(nouvelles.filter((e) => e.date >= maintenant))
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.id || 0) - (b.id || 0)));
      if (prochaines.length > COMMUN_MAX_ENTREES) {
        Journal.info(
          "Forum",
          `${prochaines.length} ${type == "Chasses" ? "chasses" : "floods"} à venir : les ${COMMUN_MAX_ENTREES} plus proches partagés`,
        );
        ajoutees -= prochaines
          .slice(COMMUN_MAX_ENTREES)
          .filter((e) => nouvelles.includes(e)).length;
      }
      return prochaines.slice(0, COMMUN_MAX_ENTREES);
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
   * minute réelle, à une minute près, avec la minute et le TdC actuels du
   * groupe (une chasse du groupe a pu être annulée), son retard gardé ; une
   * entrée retardée arrivée reste jusqu'à son heure publiée ; les autres sont
   * retirées. Une entrée d'heure réelle inconnue ici, publiée plus de `fenetre`
   * min après son groupe (retard tiré sur un autre appareil, réglé plus haut),
   * est reconnue à son TdC chassé jusqu'à DECALAGE_MAX min, après les entrées
   * à l'heure exacte (doublon : celle-ci reste).
   *
   * @static
   * @method recalerListeChasses
   * @param {Array} anciennes entrées du sujet {date publiée, terrain, reel?}
   *   (reel : heure réelle connue de ce navigateur)
   * @param {Array} groupes {debut, fin, terrain}, dates "AAAA-MM-JJ HH:mm"
   * @param {String} maintenant "AAAA-MM-JJ HH:mm"
   * @param {Number} [fenetre] retard maximal (min) d'une entrée sans heure réelle connue
   * @return {Object} {lignes {date, terrain, reel}, change}
   */
  static recalerListeChasses(anciennes, groupes, maintenant, fenetre = 0) {
    let minute = (d) => moment(d, "YYYY-MM-DD HH:mm").valueOf() / 60000,
      aVenir = anciennes.filter((e) => e.date >= maintenant),
      // lignes reprises, par entrée : une, ou une par minute (ligne découpée)
      reprises = new Array(aVenir.length).fill(null),
      libre = (g) => !reprises.some((r) => r && r.some((l) => l.reel == g.fin)),
      // groupe pas encore repris par une autre ligne, le plus proche
      plusProche = (m, liste) =>
        liste
          .filter(libre)
          .sort((a, b) => Math.abs(m - minute(a.fin)) - Math.abs(m - minute(b.fin)))[0];
    aVenir.forEach((e, i) => {
      let connue = e.reel != null,
        m = minute(connue ? e.reel : e.date),
        // heure réelle inconnue ici : de 0 à `fenetre` min avant l'heure publiée
        avant = connue ? 0 : fenetre,
        g = plusProche(
          m,
          groupes.filter((g) => m >= minute(g.debut) - 1 && m - avant <= minute(g.fin) + 1),
        );
      if (!g) return;
      // le retard tiré reste : la ligne suit la dernière minute du groupe
      let retard = connue ? minute(e.date) - m : avant ? minute(e.date) - minute(g.fin) : 0,
        groupesLigne = [g];
      // ligne d'une version d'avant 1.156.7 : les chasses de minutes
      // consécutives sur une ligne, à la dernière ; une ligne par minute
      if (e.terrain > g.terrain)
        for (let k = 1; ; k++) {
          let avantG = groupes.find(
            (x) => minute(x.fin) == minute(g.fin) - k && libre(x) && !groupesLigne.includes(x),
          );
          if (!avantG) break;
          groupesLigne.unshift(avantG);
        }
      reprises[i] = groupesLigne.map((x) => ({
        date: PartageChasses.decalerDate(x.fin, retard),
        terrain: x.terrain,
        reel: x.fin,
      }));
    });
    // retardée par un autre appareil au-delà de mon réglage (son retard, tiré
    // là-bas, est inconnu ici) : la même chasse a le même TdC chassé, publiée au
    // plus DECALAGE_MAX min après son groupe ; heure publiée gardée
    aVenir.forEach((e, i) => {
      if (reprises[i] || e.reel != null) return;
      let m = minute(e.date),
        g = plusProche(
          m,
          groupes.filter(
            (g) =>
              g.terrain == e.terrain &&
              m > minute(g.fin) + 1 + fenetre &&
              m - DECALAGE_MAX <= minute(g.fin) + 1,
          ),
        );
      if (g) reprises[i] = [{ date: e.date, terrain: g.terrain, reel: g.fin }];
    });
    let lignes = [];
    aVenir.forEach((e, i) => {
      if (reprises[i]) return lignes.push(...reprises[i]);
      let connue = e.reel != null,
        m = minute(connue ? e.reel : e.date),
        avant = connue ? 0 : fenetre;
      // plus en cours : annulée, ou arrivée avant son heure publiée, gardée
      // jusqu'à elle (la retirer plus tôt donnerait l'heure réelle)
      let retardee = connue ? e.reel != e.date : avant > 0,
        arrivee = m - avant < minute(maintenant);
      if (retardee && arrivee)
        lignes.push({ date: e.date, terrain: e.terrain, reel: connue ? e.reel : null });
    });
    let change =
      lignes.length != aVenir.length ||
      lignes.some((l, i) => l.date != aVenir[i].date || l.terrain != aVenir[i].terrain);
    return { lignes, change };
  }
  /**
   * Page Ressources : chasses partagées puis annulées (en masse ou une par
   * une) retirées de ma réponse du sujet commun des chasses. Le forum n'est lu
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
    // "-" : aucune chasse à venir dans ma réponse ; null : jamais vérifié
    if ((fin != null && fin < maintenant) || !monProfil.pseudo || Utils.sansConfigAlliance())
      return Promise.resolve();
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
      PartageChasses._modifierMessage("Chasses", (anciennes) => {
        let fiches = PartageChasses._decalages().Chasses,
          r = PartageChasses.recalerListeChasses(
            anciennes.map((e) => ({ ...e, reel: PartageChasses.reel("Chasses", e, fiches) })),
            groupes,
            maintenant,
            PartageChasses.decalageMax("Chasses"),
          );
        PartageChasses.noterDecalages("Chasses", r.lignes);
        retenir(r.lignes);
        // passées et annulées : retirées
        return r.change ? r.lignes : null;
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
   * Retard maximal (minutes) que le joueur a choisi pour les heures publiées
   * de ce type, de 0 à DECALAGE_MAX.
   *
   * @static
   * @method decalageMax
   * @param {String} type "Chasses" ou "Floods"
   * @return {Number}
   */
  static decalageMax(type) {
    let p =
        typeof monProfil != "undefined" && monProfil.parametre
          ? monProfil.parametre[PARAMETRE_DECALAGE[type]]
          : null,
      n = parseInt(p ? p.valeur : 0);
    return isNaN(n) ? 0 : Math.min(DECALAGE_MAX, Math.max(0, n));
  }
  /**
   * @static
   * @method decalerDate
   * @param {String} date "AAAA-MM-JJ HH:mm"
   * @param {Number} minutes
   * @return {String}
   */
  static decalerDate(date, minutes) {
    return moment(date, "YYYY-MM-DD HH:mm").add(minutes, "minutes").format("YYYY-MM-DD HH:mm");
  }
  /**
   * Retards tirés dans ce navigateur : heure réelle et heure publiée de mes
   * chasses ({reel, affiche}) et de mes floods ({id, cible, reel, affiche}),
   * oubliés un jour après leur heure publiée.
   *
   * @private
   * @static
   * @return {{Chasses: Array<any>, Floods: Array<any>}}
   */
  static _decalages() {
    let tout = Utils.lireStockage(CLE_DECALAGES, {});
    if (!(tout.Chasses || []).length && !(tout.Floods || []).length)
      return { Chasses: [], Floods: [] };
    let limite = Horloge.serveur().subtract(1, "day").format("YYYY-MM-DD HH:mm");
    return {
      Chasses: (tout.Chasses || []).filter((/** @type {any} */ r) => r.affiche >= limite),
      Floods: (tout.Floods || []).filter((/** @type {any} */ r) => r.affiche >= limite),
    };
  }
  /**
   * @private
   * @static
   */
  static _garderDecalages(tout) {
    try {
      localStorage.setItem(CLE_DECALAGES, JSON.stringify(tout));
    } catch (e) {}
  }
  /**
   * Heure réelle d'une de mes entrées publiées que ce navigateur a retardée,
   * sinon null (publiée sans retard, ou depuis un autre appareil).
   *
   * @static
   * @method reel
   * @param {String} type "Chasses" ou "Floods"
   * @param {any} e entrée lue au forum (date publiée)
   * @param {Array<any>} [fiches] PartageChasses._decalages()[type]
   * @return {String|null}
   */
  static reel(type, e, fiches = PartageChasses._decalages()[type]) {
    let r = fiches.find((/** @type {any} */ x) =>
      type == "Floods"
        ? e.id
          ? x.id == e.id
          : !x.id && x.cible == e.cible && x.affiche == e.date
        : x.affiche == e.date,
    );
    return r ? r.reel : null;
  }
  /**
   * Mes entrées à publier, à leur heure retardée : le retard déjà tiré pour
   * cette chasse (heure réelle) ou ce flood (numéro d'attaque) est repris,
   * sinon un retard de 0 au réglage est tiré et gardé. `reel` garde l'heure réelle.
   *
   * @static
   * @method decaler
   * @param {String} type "Chasses" ou "Floods"
   * @param {Array<any>} entrees à leur heure réelle
   * @return {Array<any>}
   */
  static decaler(type, entrees) {
    let max = PartageChasses.decalageMax(type),
      tout = PartageChasses._decalages(),
      fiches = tout[type],
      prises = new Set(fiches.map((r) => r.affiche)),
      meme = (/** @type {any} */ r, /** @type {any} */ e) =>
        type == "Floods"
          ? e.id
            ? r.id == e.id
            : !r.id && r.cible == e.cible && r.reel == e.date
          : r.reel == e.date,
      sorties = entrees.map((e) => {
        let r = fiches.find((x) => meme(x, e));
        if (!r) {
          if (!max) return { ...e, reel: e.date };
          let affiche = e.date;
          // une chasse par minute dans ma réponse : deux chasses à la même heure publiée se confondraient
          for (let essai = 0; essai < 10; essai++) {
            affiche = PartageChasses.decalerDate(e.date, Math.floor(Math.random() * (max + 1)));
            if (type == "Floods" || !prises.has(affiche)) break;
          }
          r =
            type == "Floods"
              ? { id: e.id || null, cible: e.cible, reel: e.date, affiche }
              : { reel: e.date, affiche };
          fiches.push(r);
          prises.add(affiche);
        }
        return { ...e, date: r.affiche, reel: e.date };
      });
    PartageChasses._garderDecalages(tout);
    return sorties;
  }
  /**
   * Garde l'heure réelle des lignes de chasses recalées (dernière minute du
   * groupe, même retard qu'avant).
   *
   * @static
   * @method noterDecalages
   * @param {String} type
   * @param {Array<any>} lignes {date publiée, reel}
   */
  static noterDecalages(type, lignes) {
    let tout = PartageChasses._decalages(),
      fiches = tout[type];
    lignes
      .filter((l) => l.reel && l.reel != l.date)
      .forEach((l) => {
        let r = fiches.find((x) => x.affiche == l.date);
        if (r) r.reel = l.reel;
        else fiches.push({ reel: l.reel, affiche: l.date });
      });
    PartageChasses._garderDecalages(tout);
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
                ? `Partage impossible : pas de sujet « ${e.titre} » dans la section « ${FORUM_SECTIONS_CHASSES[0]} » du forum. Demande à un chef de le créer.`
                : code == "refusée"
                  ? `Partage non enregistré : ta réponse dans le sujet « ${e.titre} » n'a pas été écrite. Ton grade n'a peut-être pas le droit d'écrire dans la section « ${FORUM_SECTIONS_CHASSES[0]} » : demande à un chef.`
                  : code == "trop long"
                    ? `Partage non enregistré : ta réponse dans le sujet « ${e.titre} » dépasserait la taille d'un message du forum.`
                    : `Partage impossible : le forum de l'alliance n'a pas pu être lu ou modifié.`,
        });
        // refus du forum : un nouvel essai à chaque page n'y changerait rien
        // (le bouton Partager de la liste des attaques reste)
        if (
          type == "Floods" &&
          ["absente", "sans sujet commun", "refusée", "trop long"].includes(code)
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
   * Retire de ma réponse du sujet commun des floods des floods (numéros
   * d'attaque) qui ne sont plus dans la liste du jeu, annulés ou arrivés : un
   * flood ne quitte le forum que pour cette raison (règle du mainteneur, pas
   * de retrait à la main). Les entrées passées sont purgées au passage, comme
   * lors d'un partage ; rien n'est écrit si aucun de ces floods n'est dans ma
   * réponse, et un message seulement si un flood à venir est retiré.
   *
   * @static
   * @method retirerFloods
   * @param {Array<Number>} ids
   * @return {Promise}
   */
  static retirerFloods(ids) {
    // case « Sans config alliance » : rien à retirer, l'état des partages reste
    if (Utils.sansConfigAlliance()) return Promise.resolve();
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
    return PartageChasses._modifierMessage("Floods", (anciennes) => {
      let maintenant = Horloge.serveur().format("YYYY-MM-DD HH:mm"),
        fiches = PartageChasses._decalages().Floods,
        // arrivé avant son heure publiée (retardée) : gardé jusqu'à elle, le
        // retirer plus tôt donnerait l'heure réelle
        arriveRetarde = (/** @type {any} */ e) => {
          let reel = PartageChasses.reel("Floods", e, fiches);
          return reel != null && reel < maintenant;
        },
        gardes = anciennes.filter(
          (e) => e.date >= maintenant && (!ids.includes(e.id) || arriveRetarde(e)),
        ),
        presents = anciennes.filter((e) => ids.includes(e.id));
      // un flood arrivé n'est plus « retiré » : il serait purgé de toute façon
      retires = presents.filter((e) => e.date >= maintenant && !gardes.includes(e)).length;
      if (!presents.length) return null;
      // arrivés (minute passée) et annulés : retirés, sans historique des floods
      return gardes;
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
   * Numéros des attaques déjà publiées dans ma réponse du sujet commun des floods :
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
    // arrivés, gardés au forum jusqu'à leur heure publiée : plus à retirer
    let fiches = PartageChasses._decalages().Floods;
    if (fiches.length) {
      let maintenant = Horloge.serveur().format("YYYY-MM-DD HH:mm");
      publies = publies.filter((id) => {
        let reel = PartageChasses.reel("Floods", { id }, fiches);
        return reel == null || reel >= maintenant;
      });
    }
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
    if (Utils.sansConfigAlliance()) return Promise.resolve(false);
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
    if (Utils.sansConfigAlliance()) return Promise.resolve(false);
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
   * ou de tous) et les floods de tous les membres, la dernière réponse de
   * chaque joueur.
   * Rejetée avec Error("sans sujet commun") si un sujet commun manque.
   *
   * @static
   * @method charger
   * @param {Array|null} chassesDe pseudos dont lire les chasses (null : tous)
   * @param {Boolean} [avecFloods] false : les chasses seulement
   * @param {{prevoir: (n: Number) => void, faite: () => void}|null} [suivi] prévenu de chaque lecture (avancement affiché)
   * @return {Promise<Object>} {chasses: {pseudo minuscule: [...]}, floods: [... avec lanceur]} ;
   *   vides, sans requête, quand la case « Sans config alliance » est cochée (rien de partagé)
   */
  static charger(chassesDe = null, avecFloods = true, suivi = null) {
    if (Utils.sansConfigAlliance()) return Promise.resolve({ chasses: {}, floods: [] });
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
        let moi =
            typeof monProfil != "undefined" && monProfil.pseudo
              ? PartageChasses.nettoyer(monProfil.pseudo).toLowerCase()
              : "",
          fiches = PartageChasses._decalages(),
          // mes entrées à leur heure réelle quand ce navigateur l'a retardée
          reelle = (/** @type {String} */ type, /** @type {any} */ e) => {
            let reel = PartageChasses.reel(type, e, fiches[type]);
            return reel == null ? e : { ...e, date: reel, reel };
          };
        // floods de tous les joueurs ; chasses des joueurs demandés
        lus.forEach(([type, joueurs]) => {
          Object.keys(joueurs)
            .sort()
            .forEach((k) => {
              let r = joueurs[k];
              if (type == "Floods")
                r.floods.forEach((/** @type {any} */ e) =>
                  d.floods.push({ ...(k == moi ? reelle(type, e) : e), lanceur: r.pseudo }),
                );
              else if (!voulus || voulus.includes(k))
                d.chasses[k] = k == moi ? r.chasses.map((e) => reelle(type, e)) : r.chasses;
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
   * @param {Boolean} [frais] lus de nouveau même si une lecture de moins d'une minute est gardée
   * @return {Promise<Object>} {pseudo: TdC} ; {} si aucune n'est lisible
   */
  static tdcMembres(frais = false) {
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
          throw Object.assign(new Error(`${adresse} : HTTP ${xhr && xhr.status}`), {
            statut: xhr && xhr.status,
          });
        },
      );
    return PartageChasses._enCache("tdcMembres", !frais, () =>
      lire("/alliance.php?Membres", 3, 5).catch((e) =>
        Utils.alliance
          ? lire(
              "/classementAlliance.php?alliance=" + encodeURIComponent(Utils.alliance),
              2,
              4,
            ).catch((e2) => {
              throw Object.assign(e2, { avant: e });
            })
          : Promise.reject(e),
      ),
    ).catch((e) => {
      if (typeof Journal == "undefined") return {};
      let message = [e && e.avant && e.avant.message, String((e && e.message) || e)]
        .filter(Boolean)
        .join(" ; ");
      // HTTP 0 : lecture coupée, le plus souvent par le joueur qui change de page
      // (journal du 19 au 21/11/2026) ; une panne du jeu répond autrement
      if (e && e.statut === 0 && (!e.avant || e.avant.statut === 0))
        Journal.info("TdC des membres", "lecture interrompue (page quittée ?)", message);
      else Journal.erreur("TdC des membres", message);
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
   *    (Utils.aPortee : de la moitié au triple du TdC du lanceur, compris ; c'est
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
    // daté de la minute de lecture (minute du RC, arrondie au-dessus) : arrivé
    // avant elle, déjà dans les TdC lus
    evts = evts
      .filter((e) => e.date > maintenant)
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
   * @param {{secondes: Number|null, maintenant: Object, portee?: Object<string, Boolean>|null}|null} [synchro] trajet vers le joueur, heure de référence et portée par minute (porteeParMinute) de la colonne « Synchro » (null : sans elle)
   * @return {String} HTML des lignes
   */
  static lignesEvolution(terrain, vars, surlignee, classeEntete, synchro = null) {
    let tdc = terrain,
      avecSynchro = PartageChasses.avecSynchro(vars, synchro),
      classe = (/** @type {Number} */ j) => (j === surlignee ? " class='o_ligneArrivee'" : ""),
      lignes = [
        `<tr class='${classeEntete}'><td></td><td>TdC</td><td>Variation</td><td>Unités</td><td>Lanceur → cible</td>${avecSynchro ? "<td>Synchro</td>" : ""}</tr>`,
        `<tr${classe(-1)}><td>Actuellement</td><td>${numeral(tdc).format()} cm²</td><td></td><td></td><td></td>${avecSynchro ? "<td></td>" : ""}</tr>`,
      ];
    vars.forEach((v, j) => {
      tdc += v.delta;
      lignes.push(
        `<tr${classe(j)}><td>${moment(v.date, "YYYY-MM-DD HH:mm").format("DD/MM HH[h]mm")}</td><td>${numeral(tdc).format()} cm²</td><td class='o_partageVariation'>${PartageChasses.libellePrise(v, "")}</td><td class='o_partageVariation'>${v.flood && v.unites != null ? numeral(v.unites).format() : ""}</td><td class='o_allInfoCible'>${PartageChasses.sens(v)}</td>${avecSynchro ? PartageChasses.celluleSynchro(v, synchro) : ""}</tr>`,
      );
    });
    return lignes.join("");
  }
  /**
   * Colonne « Synchro » du tableau de l'évolution : pour un autre joueur que
   * moi, sur chacune de ses chasses et chacun de ses floods.
   *
   * @static
   * @method avecSynchro
   * @param {Array} vars chronologie()
   * @param {{secondes: Number|null, maintenant: Object, portee?: Object<string, Boolean>|null}|null} synchro trajet vers lui, heure de référence et portée par minute (null : moi)
   * @return {Boolean}
   */
  static avecSynchro(vars, synchro) {
    return !!synchro && vars.length > 0;
  }
  /**
   * Seconde de lancement d'une attaque qui arrive au début de la minute
   * partagée d'un mouvement : pour une chasse, la minute d'arrivée affichée
   * par le jeu + 1 (PageRessource.lireChasses) ; pour un flood, son arrivée
   * arrondie à la minute supérieure (Utils.minuteRC). L'attaque arrive donc
   * après le mouvement, ou dans la même seconde qu'un flood arrivé pile sur
   * une minute pleine.
   *
   * @static
   * @method lancementSynchro
   * @param {String} date minute partagée du mouvement, « AAAA-MM-JJ HH:mm »
   * @param {Number|null} secondes mon temps de trajet vers le joueur (null : inconnu)
   * @return {Object|null} moment du lancement, null si le trajet est inconnu
   */
  static lancementSynchro(date, secondes) {
    if (secondes == null) return null;
    return moment(date, "YYYY-MM-DD HH:mm").subtract(secondes, "s");
  }
  /**
   * Cellule « Synchro » : « passée », l'heure de lancement, ou « HdP (heure) »
   * quand le joueur sera hors de ma portée à l'arrivée (portée par minute
   * connue seulement), « ? » pour l'heure quand mon trajet est inconnu.
   *
   * @private
   * @static
   * @param {Object} v ligne de chronologie
   * @param {{secondes: Number|null, maintenant: Object, portee?: Object<string, Boolean>|null}} synchro
   * @return {String} HTML de la cellule
   */
  static celluleSynchro(v, synchro) {
    let lancement = PartageChasses.lancementSynchro(v.date, synchro.secondes),
      horsPortee = !!synchro.portee && synchro.portee[v.date] === false,
      cellule = (/** @type {String} */ heure) =>
        horsPortee
          ? `<td class='o_synchroLancement o_synchroHorsPortee' title="Hors de portée à l'arrivée">HdP <span class='o_synchroHeure'>(${heure})</span></td>`
          : `<td class='o_synchroLancement'>${heure}</td>`;
    if (!lancement) return cellule("?");
    if (lancement.isBefore(synchro.maintenant))
      return "<td class='o_synchroLancement o_synchroPassee'>passée</td>";
    let format = lancement.isSame(synchro.maintenant, "day")
      ? "HH[h]mm[m]ss[s]"
      : "DD/MM HH[h]mm[m]ss[s]";
    return cellule(lancement.format(format));
  }
  /**
   * Note sous le tableau quand il a la colonne « Synchro ».
   *
   * @static
   * @method noteSynchro
   * @param {Array} vars chronologie()
   * @param {{secondes: Number|null, maintenant: Object}|null} synchro
   * @return {String} HTML
   */
  static noteSynchro(vars, synchro) {
    if (!PartageChasses.avecSynchro(vars, synchro)) return "";
    let hdp = vars.some((v) =>
      PartageChasses.celluleSynchro(v, synchro).includes("o_synchroHorsPortee"),
    );
    return `<div class='o_note'>Synchro : lancer à cette seconde pour arriver au début de la minute du mouvement, donc après lui${synchro.secondes == null ? " (temps de trajet inconnu : ?)" : ""}${hdp ? " ; HdP : hors de ta portée à ce moment, d'après les mouvements partagés connus" : ""}.</div>`;
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
    let minutes = PartageChasses.porteeParMinute(sim, pseudo, terrain, monTerrain);
    if (!minutes) return null;
    let deja = Utils.aPortee(terrain, monTerrain),
      change = Object.keys(minutes).find((date) => minutes[date] != deja);
    return { deja, date: change || null };
  }
  /**
   * Pour chaque minute des mouvements partagés à venir (les siens et les
   * miens), si `pseudo` est alors à ma portée : l'état à la fin de la minute
   * du RC, que trouve une attaque arrivant au début de cette minute, après
   * les mouvements qui y sont datés.
   *
   * @static
   * @method porteeParMinute
   * @param {Object} sim simuler()
   * @param {String} pseudo
   * @param {Number} terrain son TdC actuel
   * @param {Number} monTerrain mon TdC actuel
   * @return {Object<string, Boolean>|null} {« AAAA-MM-JJ HH:mm »: à portée}, dans l'ordre ; null pour moi ou un TdC inconnu
   */
  static porteeParMinute(sim, pseudo, terrain, monTerrain) {
    let p = pseudo.toLowerCase(),
      m = String(monProfil.pseudo || "").toLowerCase();
    if (p == m || !(terrain > 0) || !(monTerrain > 0)) return null;
    let lui = terrain,
      moi = monTerrain,
      minutes = /** @type {Object<string, Boolean>} */ ({}),
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
      // le dernier mouvement de la minute donne l'état à sa fin
      minutes[e.date] = Utils.aPortee(lui, moi);
    }
    return minutes;
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
    if (!Utils.affichage("profilPartages") || Utils.sansConfigAlliance()) return;
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
              : null,
            synchro = attaque
              ? {
                  secondes: attaque.secondes,
                  maintenant: attaque.depart,
                  portee: PartageChasses.porteeParMinute(sim, pseudo, terrain, Utils.terrain),
                }
              : null;
          contenu =
            `<div class='o_partageSynthese'>` +
            `<h3 class='o_partageTitre'>Évolution du TdC de ${Utils.echapper(pseudo)}${attaque ? PartageChasses.mentionPortee(PartageChasses.portee(sim, pseudo, terrain, Utils.terrain)) : ""}</h3>
              <table class='centre' cellspacing='0'>${PartageChasses.lignesEvolution(terrain, vars, arrivee ? arrivee.ligne : null, "o_partageEntete", synchro)}</table>` +
            PartageChasses.noteArrivee(
              arrivee,
              attaque ? "TdC à l'arrivée d'une attaque : temps de trajet inconnu." : "",
            ) +
            PartageChasses.noteSynchro(vars, synchro) +
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
