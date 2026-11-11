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

// numéros des attaques déjà publiées dans le sujet « Floods » du joueur
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
// lectures et écritures du sujet « Floods » d'une page, l'une après l'autre :
// une lecture partie avant une écriture rendrait un état périmé
let fileFloodsForum = Promise.resolve();
// numéros dont le retrait est déjà en cours sur cette page
let retraitsEnCours = new Set();
// sujets lus pour l'affichage, réutilisés une minute d'une page à l'autre ;
// les écritures relisent toujours le forum (un autre appareil a pu écrire)
const CLE_CACHE_FORUM = "fzzz_cacheForum";
const DUREE_CACHE_FORUM = 60000;

/**
 * Partage des chasses et des floods avec l'alliance, stocké dans son forum
 * (aucun serveur tiers). Deux sujets par joueur dans la section
 * « BDD partagée cachée » : « Chasses | pseudo » et « Floods | pseudo » (et
 * « Convois | pseudo », voir ConvoisForum). Le message unique du sujet
 * contient les entrées en cours, une ligne par entrée, et chaque partage le
 * réécrit (fusion sans doublon) ; les chasses et floods passés partent dans
 * « Historique <type> N | pseudo » (voir archiver). La page membre lit les
 * deux sujets du joueur consulté.
 *
 * Chaque ligne porte un code lisible par Fzzz (« FZC|date|cm²| » pour une
 * chasse, « FZF|date|cible|cm²| » pour un flood) après le texte pour les humains.
 *
 * Requêtes : au clic sur Partager, au chargement de page qui suit un envoi
 * « + partager » ou l'annulation d'un flood partagé, et la lecture des sujets
 * à l'ouverture d'une page membre. Rien de périodique.
 *
 * @class PartageChasses
 */
class PartageChasses {
  /**
   * Passe `action` (lecture ou écriture du sujet « Floods ») après les
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
   */
  static _xajax(fonction, args) {
    let requete = Promise.resolve(
      $.ajax({
        type: "post",
        url: location.origin + "/alliance.php?forum_menu",
        data:
          args === undefined
            ? { xajax: fonction, xajaxr: moment().valueOf() }
            : { xajax: fonction, "xajaxargs[]": args, xajaxr: moment().valueOf() },
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
      e = cache[cle];
    if (accepte && e && Date.now() - e.t < DUREE_CACHE_FORUM) return Promise.resolve(e.v);
    return lire().then((v) => {
      let maintenant = Date.now(),
        garde = Utils.lireStockage(CLE_CACHE_FORUM);
      for (let k in garde) if (maintenant - garde[k].t >= DUREE_CACHE_FORUM) delete garde[k];
      garde[cle] = { t: maintenant, v };
      try {
        localStorage.setItem(CLE_CACHE_FORUM, JSON.stringify(garde));
      } catch (err) {}
      return v;
    });
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
   * @return {Promise<String>} rejetée avec Error("absente") si la section n'est pas
   *   dans la liste (inexistante, ou cachée au grade du joueur)
   */
  static trouverSection() {
    if (PartageChasses.idSection) return Promise.resolve(PartageChasses.idSection);
    return PartageChasses._xajax("callGetForum").then((data) => {
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
   * Sujets de la section : {"Chasses | pseudo": idSujet, ...}.
   *
   * @static
   * @method sujets
   * @param {Boolean} [cache] lecture de moins d'une minute acceptée (affichage)
   */
  static sujets(cache = false) {
    return PartageChasses.trouverSection().then((id) =>
      PartageChasses._enCache("sujets", cache, () => PartageChasses._lireSujets(id)),
    );
  }
  /**
   * @private
   * @static
   */
  static _lireSujets(id) {
    return PartageChasses._xajax("callGetForum", id).then((data) => {
      let reponse = PartageChasses._html(data);
      if (!reponse.includes("form_cat")) {
        // identifiant périmé (section supprimée puis recréée) : on le relira
        PartageChasses.idSection = null;
        throw new Error("section inaccessible");
      }
      // clé « Type | pseudo en minuscules » → id ; sujets.liste garde la casse ;
      // sujets.historiques : pages d'historique {type, page, pseudo, id} ;
      // sujets.exportSheet : sujet de l'adresse du Google Sheet ;
      // sujets.gifAlliance, sujets.smileysAlliance : sujets des GIF et des smileys de l'alliance
      let sujets = { liste: [], historiques: [] },
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
            m = titre.match(/^(Chasses|Floods|Convois) \| (.+)$/),
            h = titre.match(/^Historique (Chasses|Floods) (\d+) \| (.+)$/),
            idSujet =
              $(elt).find("input[name='topic[]']").val() ||
              (($(elt).find("a.topic_forum").attr("onclick") || "").match(/\d+/) || [])[0];
          if (m && idSujet) {
            // titre écrit par un membre : caractères de balisage retirés
            let pseudo = PartageChasses.nettoyer(m[2]);
            sujets[`${m[1]} | ${pseudo.toLowerCase()}`] = idSujet;
            sujets.liste.push({ type: m[1], pseudo: pseudo, id: idSujet });
          }
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
   * Lignes de données (codes FZC / FZF) du premier message d'un sujet.
   *
   * @static
   * @method lireSujet
   * @param {String} idSujet
   * @param {Boolean} [cache] lecture de moins d'une minute acceptée (affichage)
   */
  static lireSujet(idSujet, cache = false) {
    return PartageChasses._enCache("sujet " + idSujet, cache, () =>
      PartageChasses._lireSujet(idSujet),
    );
  }
  /**
   * @private
   * @static
   */
  static _lireSujet(idSujet) {
    return PartageChasses._xajax("callGetTopic", idSujet).then((data) => {
      let texte = PartageChasses.premierMessage(data),
        chasses = [],
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
   * @return {Promise} rejetée si l'historique n'a pas pu être lu ou écrit
   */
  static archiver(type, lignes, sujets) {
    if (!lignes.length) return Promise.resolve();
    let pseudo = monProfil.pseudo,
      pages = (sujets.historiques || [])
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
   * @return {Promise<Boolean>}
   */
  static archiverPassees(
    type,
    entrees,
    sujets,
    ligne = (e) => PartageChasses._ligne(type, e),
    date = (e) => e.date,
  ) {
    if (!entrees.length) return Promise.resolve(true);
    let lignes = entrees
      .slice()
      .sort((a, b) => (date(a) < date(b) ? -1 : date(a) > date(b) ? 1 : (a.id || 0) - (b.id || 0)))
      .map(ligne);
    return PartageChasses.archiver(type, lignes, sujets).then(
      () => true,
      (e) => {
        console.warn(`[${NOM_EXTENSION}] historique ${type} non écrit`, e);
        return false;
      },
    );
  }
  /**
   * Fusionne des entrées dans le sujet du joueur (créé au premier partage).
   *
   * @private
   * @param {String} type "Chasses" ou "Floods"
   * @param {Array} entrees [{date "AAAA-MM-JJ HH:mm", terrain, cible?, unites?}]
   * @return {Promise<Integer>} nombre d'entrées nouvelles
   */
  static _partager(type, entrees) {
    let pseudo = monProfil.pseudo,
      titre = `${type} | ${pseudo}`,
      // une chasse par minute ; un flood par attaque du jeu (un multi-flood
      // envoie plusieurs attaques sur la même cible à la même minute)
      cle = (e) => e.date + "|" + (e.cible || "") + "|" + (e.cible ? e.terrain : "");
    return PartageChasses.sujets().then((sujets) => {
      let idSujet = sujets[`${type} | ${pseudo.toLowerCase()}`];
      return (
        idSujet
          ? PartageChasses.lireSujet(idSujet).then((d) =>
              type == "Chasses" ? d.chasses : d.floods,
            )
          : Promise.resolve([])
      ).then((anciennes) => {
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
        // les entrées passées quittent le sujet pour l'historique du joueur
        let maintenant = Horloge.serveur().format("YYYY-MM-DD HH:mm"),
          aVenir = anciennes.filter((e) => e.date >= maintenant),
          passees = anciennes.concat(nouvelles).filter((e) => e.date < maintenant);
        if (!nouvelles.length && aVenir.length == anciennes.length) return 0;
        return PartageChasses.archiverPassees(type, passees, sujets).then((archivees) => {
          let toutes = (archivees ? aVenir : anciennes)
              .concat(archivees ? nouvelles.filter((e) => e.date >= maintenant) : nouvelles)
              .sort((a, b) =>
                a.date < b.date ? 1 : a.date > b.date ? -1 : (b.id || 0) - (a.id || 0),
              )
              .slice(0, PARTAGE_MAX_ENTREES),
            message = toutes.map((e) => PartageChasses._ligne(type, e)).join("\n"),
            q = `sujet=${encodeURIComponent(titre)}&message=${encodeURIComponent(message)}&modifiable=envoyer&send=Envoyer`;
          return (
            idSujet
              ? PartageChasses._xajax(
                  "envoiEditTopic",
                  `<xjxquery><q>IDTopic=${idSujet}&${q}</q></xjxquery>`,
                )
              : PartageChasses._xajax(
                  "envoiNouveauSujet",
                  `<xjxquery><q>cat=${PartageChasses.idSection}&${q}&type=normal&question=&reponse[]=&reponse[]=&reponse[]=</q></xjxquery>`,
                )
          )
            .then(() =>
              PartageChasses._verifierPartage(
                type,
                idSujet,
                nouvelles.filter((e) => toutes.includes(e)),
                cle,
              ),
            )
            .then(() => nouvelles.length);
        });
      });
    });
  }
  /**
   * Relit le forum après l'écriture d'un partage : il ne signale pas une
   * écriture refusée (grade sans droit d'écrire dans la section, premier
   * message bloqué par une réponse). Sujet créé : il doit être dans la liste ;
   * sujet modifié : les entrées écrites doivent y être.
   *
   * @private
   * @static
   * @param {String} type "Chasses" ou "Floods"
   * @param {String|undefined} idSujet sujet modifié, absent s'il a été créé
   * @param {Array} ecrites entrées nouvelles écrites dans le sujet
   * @param {(e: any) => String} cle entrée sans numéro d'attaque
   * @return {Promise} rejetée avec Error("non créé") ou Error("non modifié")
   */
  static _verifierPartage(type, idSujet, ecrites, cle) {
    let pseudo = monProfil.pseudo,
      refus = (/** @type {String} */ code) =>
        Promise.reject(Object.assign(new Error(code), { titre: `${type} | ${pseudo}` }));
    if (!idSujet)
      return PartageChasses.sujets().then((sujets) =>
        sujets[`${type} | ${pseudo.toLowerCase()}`] ? undefined : refus("non créé"),
      );
    if (!ecrites.length) return Promise.resolve();
    return PartageChasses.lireSujet(idSujet).then((d) => {
      let relues = type == "Chasses" ? d.chasses : d.floods,
        ids = relues.filter((e) => e.id).map((e) => e.id),
        cles = relues.map(cle);
      if (ecrites.some((e) => !(e.id ? ids.includes(e.id) : cles.includes(cle(e)))))
        return refus("non modifié");
    });
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
   * une) retirées du sujet « Chasses » du joueur. Le forum n'est lu que si une
   * chasse partagée est encore à venir (ou la première fois, repère inconnu).
   *
   * @static
   * @method recalerChasses
   * @param {Array} groupes chasses en cours {debut, fin, terrain}
   * @return {Promise}
   */
  static recalerChasses(groupes) {
    let maintenant = Horloge.serveur().format("YYYY-MM-DD HH:mm"),
      pseudo = monProfil.pseudo,
      fin = null;
    try {
      fin = localStorage.getItem(CLE_FIN_CHASSES_PARTAGEES);
    } catch (e) {}
    // "-" : aucune chasse à venir dans le sujet ; null : jamais vérifié
    if ((fin != null && fin < maintenant) || !pseudo) return Promise.resolve();
    let titre = `Chasses | ${pseudo}`;
    return PartageChasses.enFile(() =>
      PartageChasses.sujets().then((sujets) => {
        let idSujet = sujets[`Chasses | ${pseudo.toLowerCase()}`],
          retenir = (lignes) => {
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
        if (!idSujet) return retenir([]);
        return PartageChasses.lireSujet(idSujet).then((d) => {
          let r = PartageChasses.recalerListeChasses(d.chasses, groupes, maintenant);
          retenir(r.lignes);
          if (!r.change) return;
          // passées : vers l'historique ; annulées : retirées
          let passees = d.chasses.filter((e) => e.date < maintenant);
          return PartageChasses.archiverPassees("Chasses", passees, sujets).then((archivees) => {
            // un sujet ne peut pas être vide : ligne neutre, ignorée à la lecture
            let message =
                r.lignes
                  .concat(archivees ? [] : passees)
                  .map((e) => PartageChasses._ligne("Chasses", e))
                  .join("\n") || "Aucune chasse en cours.",
              q = `sujet=${encodeURIComponent(titre)}&message=${encodeURIComponent(message)}&modifiable=envoyer&send=Envoyer`;
            return PartageChasses._xajax(
              "envoiEditTopic",
              `<xjxquery><q>IDTopic=${idSujet}&${q}</q></xjxquery>`,
            ).then(() => {
              $.toast({
                ...TOAST_INFO,
                text: `Chasses annulées : partage mis à jour dans le forum de la ${Utils.alliance || "l'alliance"}.`,
              });
            });
          });
        });
      }),
    ).catch((e) => {
      // pas de section de partage dans le forum : rien à recaler, ne plus le lire
      if (e && e.message == "absente")
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
   */
  static _avecBouton($bouton, type, entrees) {
    let libelle = type == "Chasses" ? "chasse" : "flood",
      accord = (n) => (type == "Chasses" ? "e" : "") + (n > 1 ? "s" : "");
    if (!entrees.length) {
      $.toast({ ...TOAST_INFO, text: `Aucun ${libelle} à partager.` });
      return Promise.resolve();
    }
    if ($bouton) $bouton.prop("disabled", true);
    return PartageChasses._partager(type, entrees)
      .then((n) => {
        // floods présents dans le sujet (nouveaux ou déjà publiés) : marqués partagés
        if (type == "Floods") {
          PartageChasses.marquerFloodsPartages(entrees.map((e) => e.id));
          AttaqueLancee.majPartages();
        }
        return n;
      })
      .then((n) =>
        $.toast({
          ...TOAST_SUCCESS,
          text: n
            ? `${n} ${libelle}${n > 1 ? "s" : ""} partagé${accord(n)} avec la ${Utils.alliance}.`
            : `Ces ${libelle}s étaient déjà partagé${accord(2)}.`,
        }),
      )
      .catch((e) => {
        let code = e && e.message;
        $.toast({
          ...TOAST_ERROR,
          hideAfter: 10000,
          text:
            code == "absente"
              ? SECTION_INTROUVABLE
              : code == "non créé"
                ? `Partage non enregistré : le sujet « ${e.titre} » n'apparaît pas dans le forum après l'envoi. Ton grade n'a peut-être pas le droit d'écrire dans la section « ${FORUM_SECTIONS_CHASSES[0]} » : demande à un chef.`
                : code == "non modifié"
                  ? `Partage non enregistré : le sujet « ${e.titre} » n'a pas été modifié. Si quelqu'un y a répondu, son premier message n'est plus modifiable (un chef peut supprimer la réponse) ; sinon, ton grade n'a peut-être pas le droit d'y écrire : demande à un chef.`
                  : `Partage impossible : le forum de l'alliance n'a pas pu être lu ou modifié.`,
        });
        // refus du forum : un nouvel essai à chaque page n'y changerait rien
        // (le bouton Partager de la liste des attaques reste)
        if (type == "Floods" && ["absente", "non créé", "non modifié"].includes(code))
          AttaqueLancee.oublierPartage(entrees.map((x) => x.id));
      })
      .finally(() => $bouton && $bouton.prop("disabled", false));
  }
  /**
   * Retire des floods (numéros d'attaque) du sujet « Floods » du joueur ; les
   * entrées passées sont purgées au passage, comme lors d'un partage.
   *
   * @static
   * @method retirerFloods
   * @param {Array<Number>} ids
   * @param {jQuery|null} $bouton
   * @param {Boolean} [discret] retrait automatique (attaques disparues de la
   *   liste) : rien n'est écrit si aucun de ces floods n'est dans le sujet, et
   *   un message seulement si un flood à venir est retiré
   * @return {Promise}
   */
  static retirerFloods(ids, $bouton, discret = false) {
    let pseudo = monProfil.pseudo,
      titre = `Floods | ${pseudo}`;
    ids = ids.filter((id) => !retraitsEnCours.has(id));
    if (!ids.length) return Promise.resolve();
    PartageChasses.noterARetirer(ids, true);
    ids.forEach((id) => retraitsEnCours.add(id));
    if ($bouton) $bouton.prop("disabled", true);
    return PartageChasses.enFile(() =>
      PartageChasses._retirerFloods(ids, $bouton, pseudo, titre, discret),
    ).finally(() => ids.forEach((id) => retraitsEnCours.delete(id)));
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
      aRetirer.length ? PartageChasses.retirerFloods(aRetirer, null, true) : null,
      AttaqueLancee.partagerMarquees(),
    ]);
  }
  /**
   * @private
   * @static
   */
  static _retirerFloods(ids, $bouton, pseudo, titre, discret = false) {
    return PartageChasses.sujets()
      .then((sujets) => {
        let idSujet = sujets[`Floods | ${pseudo.toLowerCase()}`];
        if (!idSujet) return 0;
        return PartageChasses.lireSujet(idSujet).then((d) => {
          let maintenant = Horloge.serveur().format("YYYY-MM-DD HH:mm"),
            gardes = d.floods.filter((e) => e.date >= maintenant && !ids.includes(e.id)),
            presents = d.floods.filter((e) => ids.includes(e.id)),
            // un flood arrivé n'est plus « retiré » : il serait purgé de toute façon
            retires = presents.filter((e) => e.date >= maintenant).length;
          if (discret && !presents.length) return 0;
          // arrivés (minute passée) : vers l'historique ; annulés à venir : retirés
          let passees = d.floods.filter((e) => e.date < maintenant);
          return PartageChasses.archiverPassees("Floods", passees, sujets).then((archivees) => {
            // un sujet ne peut pas être vide : ligne neutre, ignorée à la lecture
            let message =
                gardes
                  .concat(archivees ? [] : passees)
                  .sort((a, b) =>
                    a.date < b.date ? 1 : a.date > b.date ? -1 : (b.id || 0) - (a.id || 0),
                  )
                  .map((e) => PartageChasses._ligne("Floods", e))
                  .join("\n") || "Aucun flood en cours.",
              q = `sujet=${encodeURIComponent(titre)}&message=${encodeURIComponent(message)}&modifiable=envoyer&send=Envoyer`;
            return PartageChasses._xajax(
              "envoiEditTopic",
              `<xjxquery><q>IDTopic=${idSujet}&${q}</q></xjxquery>`,
            ).then(() => retires);
          });
        });
      })
      .then((n) => {
        PartageChasses.oublierFloodsPartages(ids);
        PartageChasses.noterARetirer(ids, false);
        AttaqueLancee.majPartages();
        if (n || !discret)
          $.toast({
            ...TOAST_SUCCESS,
            text: n
              ? `${n} flood${n > 1 ? "s annulés retirés" : " annulé retiré"} du forum de la ${Utils.alliance}.`
              : "Ce flood n'était plus dans le forum.",
          });
      })
      .catch((e) => {
        // pas de section de partage : rien à retirer, inutile de réessayer
        if (e && e.message == "absente") {
          PartageChasses.oublierFloodsPartages(ids);
          PartageChasses.noterARetirer(ids, false);
        }
        // retrait automatique : réessayé à la page suivante, sans message
        if (discret) console.warn(`[${NOM_EXTENSION}] retrait des floods différé`, e);
        else
          $.toast({
            ...TOAST_ERROR,
            text: "Retrait du flood annulé impossible : le forum de l'alliance n'a pas pu être lu ou modifié.",
          });
      })
      .finally(() => $bouton && $bouton.prop("disabled", false));
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
   * Numéros des attaques déjà publiées dans le sujet « Floods » du joueur :
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
   * Numéros d'attaque publiés dans le sujet « Floods » du joueur, lus sur le
   * forum (deux lectures : liste des sujets, puis le sien). Vide si le sujet
   * ou la section n'existe pas.
   *
   * @static
   * @method mesFloodsForum
   * @return {Promise<Array<Number>>}
   */
  static mesFloodsForum() {
    let pseudo = (monProfil.pseudo || "").toLowerCase();
    return PartageChasses.sujets().then((sujets) => {
      let id = sujets[`Floods | ${pseudo}`];
      return id
        ? PartageChasses.lireSujet(id).then((d) => d.floods.map((f) => f.id).filter(Boolean))
        : [];
    });
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
   * Lit dans le forum les chasses (des joueurs demandés, ou de tous) et les
   * floods de tous les membres, par paquets de 4 sujets.
   *
   * @static
   * @method charger
   * @param {Array|null} chassesDe pseudos dont lire les chasses (null : tous)
   * @param {Boolean} [avecFloods] false : les chasses seulement
   * @return {Promise<Object>} {chasses: {pseudo minuscule: [...]}, floods: [... avec lanceur]}
   */
  static charger(chassesDe = null, avecFloods = true) {
    return PartageChasses.sujets(true).then((sujets) => {
      let voulus = chassesDe ? chassesDe.map((p) => p.toLowerCase()) : null,
        liste = sujets.liste.filter(
          (t) =>
            (avecFloods && t.type == "Floods") ||
            (t.type == "Chasses" && (!voulus || voulus.includes(t.pseudo.toLowerCase()))),
        ),
        d = { chasses: {}, floods: [] },
        lirePaquet = (k) =>
          k >= liste.length
            ? Promise.resolve()
            : Promise.all(
                liste.slice(k, k + 4).map((t) =>
                  PartageChasses.lireSujet(t.id, true)
                    .then((r) => {
                      if (t.type == "Chasses") d.chasses[t.pseudo.toLowerCase()] = r.chasses;
                      else r.floods.forEach((e) => d.floods.push({ ...e, lanceur: t.pseudo }));
                    })
                    .catch(() => {}),
                ),
              ).then(() => lirePaquet(k + 4));
      return lirePaquet(0).then(() => d);
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
   * @return {Promise<{d: Object, tdc: Object}>} tdc : {pseudo: TdC} des membres ({} sans joueur relié)
   */
  static completer(d, suivis) {
    let relies = PartageChasses.relies(d.floods, suivis);
    if (!relies.length) return Promise.resolve({ d, tdc: {} });
    let manquants = relies.filter((p) => !d.chasses[p]);
    return Promise.all([
      manquants.length
        ? PartageChasses.charger(manquants, false).catch(() => ({ chasses: {} }))
        : { chasses: {} },
      PartageChasses.tdcMembres(),
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
      html += ` <small class='o_priseNote' title='Attaque ${v.lieu == "Loge" ? "en loge : TdC pris comme au terrain, ressources pillées, la cible devient vassale" : "au dôme : TdC pris comme au terrain, ressources pillées en plus"}'>(${v.lieu == "Loge" ? "loge" : "dôme"})</small>`;
    return html;
  }
  /**
   * Armee.php : floods en cours sur le joueur, au-dessus de « Troupes en
   * Garnison » : unités envoyées et TdC qu'ils prendront à l'impact
   * (simulation avec les TdC actuels des membres et les chasses partagées du
   * joueur et des joueurs reliés, comme la page Membres).
   *
   * @static
   * @method afficherArmee
   */
  static afficherArmee() {
    if (!Utils.affichage("floodsRecus")) return;
    let moi = monProfil.pseudo,
      $titre = $("#centre *")
        .filter(
          (i, e) =>
            /^\s*Troupes en Garnison/i.test(e.textContent) &&
            !$(e)
              .children()
              .filter((k, c) => /Troupes en Garnison/i.test(c.textContent)).length,
        )
        .first();
    if (!moi || !$titre.length) return;
    let $ancre = $titre.closest("table").length ? $titre.closest("table") : $titre;
    PartageChasses.enFile(() =>
      PartageChasses.charger([moi]).then((d) => PartageChasses.completer(d, [moi])),
    )
      .then(({ d, tdc }) => {
        // mes floods publiés ou retirés, y compris depuis un autre appareil
        PartageChasses.recalerFloods(
          d.floods
            .filter((f) => f.id && f.lanceur.toLowerCase() == moi.toLowerCase())
            .map((f) => f.id),
          AttaqueLancee.idsAffiches(),
        );
        AttaqueLancee.majPartages();
        let sim = PartageChasses.simuler(
            d,
            PartageChasses.tdcConnus(tdc, { [moi]: Utils.terrain }),
          ),
          recus = PartageChasses.chronologie(sim, moi).filter(
            (v) => v.flood && v.delta <= 0 && v.cible.toLowerCase() == moi.toLowerCase(),
          ),
          html = "";
        if (!recus.length) html += "<p>Aucun flood partagé en cours sur toi.</p>";
        else {
          html += `<table class='o_attaquesLancees o_maxWidth centre' cellspacing='0'><thead><tr><th>#</th><th>Arrivée</th><th>Unités envoyées</th><th>TdC perdu (estimé)</th><th>Lanceur</th></tr></thead><tbody>`;
          recus.forEach((v, i) => {
            html += `<tr${i % 2 ? " class='ligne_paire'" : ""}><td>${i + 1}</td><td>${moment(v.date, "YYYY-MM-DD HH:mm").format("DD/MM HH[h]mm")}</td><td>${v.unites != null ? numeral(v.unites).format() : "?"}</td><td>${PartageChasses.libellePrise(v)}</td><td><a href='Membre.php?Pseudo=${encodeURIComponent(v.lanceur)}'>${Utils.echapper(v.lanceur)}</a></td></tr>`;
          });
          let unites = recus.reduce((t, v) => t + (v.unites || 0), 0),
            perte = recus.reduce((t, v) => t + v.delta, 0);
          html += `<tr class='o_syntheseTotal'><td></td><td>Total (${recus.length})</td><td>${numeral(unites).format()}</td><td>${PartageChasses.libellePrise({ delta: perte })}</td><td></td></tr></tbody></table>
            <p class='reduce'><em>Prise estimée à l'impact : au plus 20 % de ton TdC à ce moment, rien si tu sors de la portée du lanceur.</em></p>`;
        }
        $("#o_floodsRecus").remove();
        $ancre.before(
          "<div id='o_floodsRecus' class='boite_amelioration simulateur centre o_blocAttaques o_blocArmee'>" +
            Utils.spoiler(
              `Floods en cours sur ${moi} partagés avec la ${Utils.alliance} (${recus.length})`,
              html,
              "armeeFloodsRecus",
              "o_attaquesTitre",
              false,
            ) +
            "</div>",
        );
        if (typeof PageArmee != "undefined") PageArmee.calerLargeurs();
      })
      .catch(() => {});
  }
  /**
   * Page membre : chasses et floods partagés du joueur consulté, et évolution
   * de son TdC (unités envoyées et prise estimée à l'impact pour chaque flood),
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
    let suivis = monProfil.pseudo ? [pseudo, monProfil.pseudo] : [pseudo];
    PartageChasses.charger(suivis)
      .then((d) => PartageChasses.completer(d, suivis))
      .then(({ d, tdc }) => {
        let page = { [pseudo]: terrain };
        if (monProfil.pseudo) page[monProfil.pseudo] = Utils.terrain;
        let sim = PartageChasses.simuler(d, PartageChasses.tdcConnus(tdc, page)),
          vars = PartageChasses.chronologie(sim, pseudo),
          chasses = vars.filter((v) => !v.flood),
          floods = vars.filter((v) => v.flood),
          date = (v) => moment(v.date, "YYYY-MM-DD HH:mm").format("DD/MM/YY HH:mm"),
          lien = (p) =>
            `<a href='Membre.php?Pseudo=${encodeURIComponent(p)}'>${Utils.echapper(p)}</a>`,
          tableau = (titre, lignes, colonnes, cellules, total) => {
            let html = `<h3 class='o_partageTitre'>${titre} (${lignes.length})</h3>`;
            if (!lignes.length) return html + "<p class='centre'>Aucun partage en cours.</p>";
            html += `<table class='centre' cellspacing='0'><tr class='o_partageEntete'>${colonnes.map((t) => `<td>${t}</td>`).join("")}</tr>`;
            lignes.forEach((v, i) => {
              html += `<tr${i % 2 ? "" : " class='ligne_paire'"}>${cellules(v)
                .map((t) => `<td>${t}</td>`)
                .join("")}</tr>`;
            });
            return (
              html +
              `<tr class='o_syntheseTotal'>${total.map((t) => `<td>${t}</td>`).join("")}</tr></table>`
            );
          };
        let synthese = "";
        if (vars.length && terrain > 0) {
          let arrivee = attaque
            ? PartageChasses.arriveeAttaque(vars, attaque.secondes, attaque.depart)
            : null;
          synthese =
            "<div class='o_partageSeparation'></div>" +
            `<div class='o_partageSynthese'>` +
            `<h3 class='o_partageTitre'>Évolution du TdC de ${pseudo}${attaque ? PartageChasses.mentionPortee(PartageChasses.portee(sim, pseudo, terrain, Utils.terrain)) : ""}</h3>
              <table class='centre' cellspacing='0'>${PartageChasses.lignesEvolution(terrain, vars, arrivee ? arrivee.ligne : null, "o_partageEntete")}</table>` +
            PartageChasses.noteArrivee(
              arrivee,
              attaque ? "TdC à l'arrivée d'une attaque : temps de trajet inconnu." : "",
            ) +
            "</div>";
        }
        let unitesFloods = floods.reduce((t, v) => t + (v.unites || 0), 0),
          netFloods = floods.reduce((t, v) => t + v.delta, 0);
        $("#o_chassesPartagees").remove();
        // entre le bloc « Action » et la suite de la page
        let $action = $(".boite_membre").filter((i, e) => /^\s*Action/.test($(e).text()));
        ($action.length ? $action.first() : $(".boite_membre").last()).after(
          `<div id='o_chassesPartagees' class='boite_membre'>` +
            // un seul dépliant pour tout l'encart
            Utils.spoiler(
              `Chasses et floods en cours partagés avec la ${Utils.alliance}`,
              tableau(
                `Chasses en cours partagées avec la ${Utils.alliance}`,
                chasses,
                ["Heure d'impact", "TdC chassé"],
                (v) => [date(v), numeral(v.delta).format() + " cm²"],
                [
                  `Total (${chasses.length})`,
                  numeral(chasses.reduce((t, v) => t + v.delta, 0)).format() + " cm²",
                ],
              ) +
                "<div class='o_partageSeparation'></div>" +
                tableau(
                  `Floods en cours depuis ou vers ${pseudo} partagés avec la ${Utils.alliance}`,
                  floods,
                  ["Arrivée", "Unités envoyées", "TdC pris (estimé)", "Lanceur → cible"],
                  (v) => [
                    date(v),
                    v.unites != null ? numeral(v.unites).format() : "?",
                    PartageChasses.libellePrise(v),
                    `${lien(v.lanceur)} → ${lien(v.cible)}`,
                  ],
                  [
                    `Total (${floods.length})`,
                    numeral(unitesFloods).format(),
                    PartageChasses.libellePrise({ delta: netFloods }),
                    "",
                  ],
                ) +
                synthese,
              "profilPartages",
              "o_partageTitre o_partageSpoiler",
            ) +
            "</div>",
        );
      })
      .catch(() => {});
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
