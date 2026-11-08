// @ts-check
/*
 * ExportRapports.js
 * Fzzz
 **********************************************************************/

// adresse du script Google (Apps Script) d'un fichier : elle permet d'y écrire,
// donc jamais dans le code (public). Celle de l'alliance et la liste des joueurs
// qui l'utilisent sans rien régler sont postées à la main dans le premier message
// du sujet TITRE_EXPORT_SHEET du forum caché (copie gardée ici, pour ce joueur,
// si le forum ne répond pas) ; un autre joueur donne celle de son propre fichier
const CLE_EXPORT_SHEET_ALLIANCE = "fzzz_exportSheetAlliance";
const CLE_EXPORT_SHEET = "fzzz_exportSheet";
// titre de la liste, dans ce message : « Joueurs autorisés à partager des RC : »
const LISTE_EXPORT_ALLIANCE = /joueurs\s+autoris[ée]s?[^:\n]*(?::|\n|$)/i;
const ADRESSE_EXPORT_SHEET =
  /^https:\/\/script\.google\.com\/(?:a\/macros\/[^/\s]+|macros)\/s\/[\w-]+\/exec$/;
// lignes envoyées par requête au script
const EXPORT_PAQUET = 200;
// conversations exportées dont on garde le numéro, par type
const EXPORT_MAX_CONVERSATIONS = 5000;
// liens « messages précédents » suivis au plus dans une conversation
const EXPORT_MAX_PRECEDENTS = 30;
// nombre du jeu : « 1 234 » (espaces, insécables compris)
const EXPORT_NOMBRE = "(\\d[\\d \\u00a0\\u202f]*)";
// un export à la fois (double clic, ou les deux boutons)
let exportEnCours = false;

// colonnes des onglets d'attaques et de défenses
const ENTETES_COMBATS = [
  "Clé",
  "Exporté par",
  "Date",
  "Type",
  "Attaquant",
  "Défenseur",
  "Lieu",
  "Terrain (cm²)",
  "Nourriture",
  "Matériaux",
  "Pertes attaquant",
  "Pertes défenseur",
  "Troupes en attaque",
  "Troupes en défense",
  "RC",
];

/**
 * Onglets du fichier et leurs colonnes, dans l'ordre des valeurs envoyées. Le
 * script du fichier crée l'onglet et ses titres au premier envoi, et ajoute à
 * la fin une colonne qu'il ne connaît pas. Les combats vont dans « BDD
 * attaques » ou « BDD défenses » selon le camp du joueur qui exporte.
 */
const EXPORTS_RAPPORTS = {
  chasse: {
    onglet: "BDD chasse",
    entetes: [
      "Clé",
      "Exporté par",
      "Date",
      "Terrain conquis (cm²)",
      "Nourriture",
      "Fourmis perdues",
      "Troupes en attaque",
      "Troupes en défense",
      "RC",
    ],
  },
  attaque: { onglet: "BDD attaques", entetes: ENTETES_COMBATS },
  defense: { onglet: "BDD défenses", entetes: ENTETES_COMBATS },
};

/**
 * Export des rapports de la messagerie vers le Google Sheet de l'alliance :
 * « Exporter mes chasses » (onglet « BDD chasse ») et « Exporter mes RC »
 * (onglets « BDD attaques » et « BDD défenses », selon le camp du joueur), un
 * RC par ligne (une multichasse donne un message par expédition). Chaque RC a
 * une clé tirée de sa minute et des armées qui s'affrontent (les prédateurs
 * d'une chasse sont tirés au hasard) : le script du fichier n'ajoute jamais une
 * clé déjà présente dans l'onglet.
 *
 * Requêtes : au clic seulement, lecture une à une des conversations listées
 * pas encore exportées (comme leur ouverture dans le jeu), puis envoi au script.
 *
 * @class ExportRapports
 */
class ExportRapports {
  /**
   * @static
   * @param {String|undefined|null} t
   * @return {Number}
   */
  static nombre(t) {
    return parseInt(String(t || "").replace(/\D/g, "")) || 0;
  }
  /**
   * Date d'un message (« 07/11/26 à 21h07 ») au format "AAAA-MM-JJ HH:mm", ou "".
   *
   * @static
   * @method date
   * @param {String} expe
   * @return {String}
   */
  static date(expe) {
    let m = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})\D+?(\d{1,2})h(\d{2})/.exec(String(expe || ""));
    if (!m) return "";
    let deux = (/** @type {String} */ n) => n.padStart(2, "0");
    return `${m[3].length == 2 ? "20" + m[3] : m[3]}-${deux(m[2])}-${deux(m[1])} ${deux(m[4])}:${m[5]}`;
  }
  /**
   * Espaces du jeu (insécables, doublés) ramenés à une espace simple ; les
   * retours à la ligne restent.
   *
   * @static
   * @param {String} texte
   * @return {String}
   */
  static espaces(texte) {
    return String(texte || "").replace(/[ \t\u00a0\u202f]+/g, " ");
  }
  /**
   * Liste « Troupes en attaque » ou « Troupes en défense » d'un RC, ou null.
   *
   * @static
   * @param {String} texte
   * @param {String} cote "attaque" ou "défense"
   * @return {String|null}
   */
  static troupes(texte, cote) {
    let m = new RegExp(`Troupes en ${cote}\\s*:\\s*([^.]*)\\.`).exec(texte);
    return m ? m[1].replace(/\s+/g, " ").trim() : null;
  }
  /**
   * Somme des nombres capturés par `motif` (un tour de combat chacun).
   *
   * @static
   * @param {String} texte
   * @param {String} motif source d'expression régulière avec EXPORT_NOMBRE
   * @return {Number}
   */
  static somme(texte, motif) {
    let s = 0;
    for (let m of texte.matchAll(new RegExp(motif, "g"))) s += ExportRapports.nombre(m[1]);
    return s;
  }
  /**
   * Texte du RC pour la colonne « RC » : une ligne par ligne du rapport.
   *
   * @static
   * @param {String} texte
   * @return {String}
   */
  static texteRC(texte) {
    return String(texte)
      .split("\n")
      .map((l) => l.replace(/[ \t  ]+/g, " ").trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  /**
   * Pseudo lu dans un RC (texte de la messagerie) : caractères de balisage retirés.
   *
   * @static
   * @param {String} texte
   * @return {String}
   */
  static pseudo(texte) {
    return String(texte || "")
      .replace(/[<>&"']/g, "")
      .trim();
  }
  /**
   * Armées comparées d'un RC à l'autre : sans espaces ni casse, apostrophes
   * typographiques ramenées à « ' ».
   *
   * @static
   * @param {String} t
   * @return {String}
   */
  static comparable(t) {
    return String(t || "")
      .replace(/[’‘]/g, "'")
      .replace(/[\s  ]+/g, "")
      .toLowerCase();
  }
  /**
   * Empreinte courte et stable d'un texte (cyrb53, 14 chiffres hexadécimaux).
   *
   * @static
   * @method empreinte
   * @param {String} texte
   * @return {String}
   */
  static empreinte(texte) {
    let h1 = 0xdeadbeef,
      h2 = 0x41c6ce57;
    for (let i = 0; i < texte.length; i++) {
      let c = texte.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761);
      h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
  }
  /**
   * RC de chasse (un message de la conversation), ou null.
   *
   * @static
   * @method chasse
   * @param {String} texte texte du message, retours à la ligne compris
   * @param {String} date "AAAA-MM-JJ HH:mm"
   * @param {String} pseudo joueur qui exporte
   * @return {{signature: String, date: String, valeurs: Array}|null}
   */
  static chasse(texte, date, pseudo) {
    texte = ExportRapports.espaces(texte);
    let attaque = ExportRapports.troupes(texte, "attaque"),
      defense = ExportRapports.troupes(texte, "défense");
    if (!attaque || !defense) return null;
    let N = EXPORT_NOMBRE,
      terrain =
        new RegExp(`conquis\\s+${N}\\s*cm²`).exec(texte) || new RegExp(`${N}\\s*cm²`).exec(texte),
      nourriture =
        new RegExp(`rapportent\\s+${N}`, "i").exec(texte) ||
        new RegExp(`${N}\\s*(?:de\\s+)?nourriture`, "i").exec(texte);
    return {
      signature: ["chasse", date, pseudo.toLowerCase(), attaque, defense]
        .map(ExportRapports.comparable)
        .join("|"),
      date,
      valeurs: [
        pseudo,
        date,
        ExportRapports.nombre(terrain && terrain[1]),
        ExportRapports.nombre(nourriture && nourriture[1]),
        ExportRapports.somme(texte, `et en tue ${N}`),
        attaque,
        defense,
        ExportRapports.texteRC(texte),
      ],
    };
  }
  /**
   * RC de combat, vu de l'attaquant (« Vous attaquez la fourmilière de X ») ou
   * du défenseur (« X attaque votre Terrain de Chasse »), ou null.
   *
   * @static
   * @method combat
   * @param {String} texte
   * @param {String} date
   * @param {String} pseudo
   * @return {{signature: String, date: String, camp: String, valeurs: Array}|null}
   */
  static combat(texte, date, pseudo) {
    texte = ExportRapports.espaces(texte);
    let attaque = ExportRapports.troupes(texte, "attaque"),
      defense = ExportRapports.troupes(texte, "défense");
    if (!attaque || !defense) return null;
    let attaquant = "",
      defenseur = "",
      lieu = "",
      m =
        /Vous attaquez (.+?) de (\S+?),?\s*(?:mais une armée d'occupation|Troupes en attaque)/.exec(
          texte,
        );
    if (m) {
      attaquant = pseudo;
      defenseur = ExportRapports.pseudo(m[2]);
      lieu = m[1];
    } else if ((m = /(\S+) attaque (votre [^.,\n]+|une de vos colonies)/.exec(texte))) {
      attaquant = ExportRapports.pseudo(m[1]);
      defenseur = pseudo;
      lieu = m[2];
    } else if ((m = /contre (\S+?)[.,]?\s*\n/.exec(texte))) {
      attaquant = pseudo;
      defenseur = ExportRapports.pseudo(m[1]);
    }
    let N = EXPORT_NOMBRE,
      // « … dégâts à vos fourmis et en tue N » : mes pertes ; « … et tuez N ennemies » : les siennes
      miennes = ExportRapports.somme(texte, `et en tue ${N}`),
      siennes = ExportRapports.somme(texte, `et tuez ${N}`),
      jAttaque = attaquant.toLowerCase() == pseudo.toLowerCase(),
      // camp inconnu (tournure de RC non reconnue) : pertes non attribuées
      connu = !!(attaquant || defenseur);
    return {
      signature: ["combat", date, attaque, defense].map(ExportRapports.comparable).join("|"),
      date,
      camp: !connu ? "" : jAttaque ? "attaque" : "defense",
      valeurs: [
        pseudo,
        date,
        "Combat",
        attaquant,
        defenseur,
        ExportRapports.lieu(lieu),
        "",
        "",
        "",
        connu ? (jAttaque ? miennes : siennes) : "",
        connu ? (jAttaque ? siennes : miennes) : "",
        attaque,
        defense,
        ExportRapports.texteRC(texte),
      ],
    };
  }
  /**
   * @static
   * @param {String} lieu texte du RC (« la fourmilière », « votre Terrain de Chasse »…)
   * @return {String}
   */
  static lieu(lieu) {
    if (/terrain/i.test(lieu)) return "Terrain de chasse";
    if (/loge/i.test(lieu)) return "Loge";
    if (/fourmili/i.test(lieu)) return "Fourmilière";
    if (/colonie/i.test(lieu)) return "Colonie";
    return String(lieu || "").trim();
  }
  /**
   * Terrain ou ressources pris (« X vous a pris N cm² », « Vos fourmis ont
   * conquis N cm² … appartenaient à X »), d'après le message ou, à défaut,
   * d'après le titre de la conversation (« Vol par X : N cm² », « Butin chez
   * X : N cm² »). null si rien de tel.
   *
   * @static
   * @method prise
   * @param {String} texte
   * @param {String} date
   * @param {String} pseudo
   * @param {String} [titre] titre de la conversation, pour son premier message sans RC
   * @return {{signature: String, date: String, camp: String, valeurs: Array}|null}
   */
  static prise(texte, date, pseudo, titre = "") {
    titre = ExportRapports.espaces(titre).trim();
    let N = EXPORT_NOMBRE,
      plat = texte.replace(/\s+/g, " ").trim(),
      attaquant = "",
      defenseur = "",
      terrain = 0,
      nourriture = 0,
      materiaux = 0,
      m;
    if ((m = new RegExp(`(\\S+) vous a pris ${N}\\s*cm²`).exec(plat))) {
      attaquant = m[1];
      defenseur = pseudo;
      terrain = ExportRapports.nombre(m[2]);
    } else if ((m = /appartenaient à (\S+?)\.?$/.exec(plat))) {
      attaquant = pseudo;
      defenseur = m[1];
      let c = new RegExp(`conquis ${N}\\s*cm²`).exec(plat),
        p = new RegExp(`pillé ${N}\\s*et ${N}`).exec(plat);
      terrain = ExportRapports.nombre(c && c[1]);
      nourriture = ExportRapports.nombre(p && p[1]);
      materiaux = ExportRapports.nombre(p && p[2]);
    } else if ((m = new RegExp(`^Vol par (\\S+?)\\s*:\\s*${N}\\s*cm²`).exec(titre))) {
      attaquant = m[1];
      defenseur = pseudo;
      terrain = ExportRapports.nombre(m[2]);
    } else if ((m = new RegExp(`^Butin chez (\\S+?)\\s*:\\s*${N}\\s*cm²`).exec(titre))) {
      attaquant = pseudo;
      defenseur = m[1];
      terrain = ExportRapports.nombre(m[2]);
    } else return null;
    attaquant = ExportRapports.pseudo(attaquant);
    defenseur = ExportRapports.pseudo(defenseur);
    if (!attaquant || !defenseur) return null;
    return {
      signature: ["prise", date, attaquant, defenseur, terrain, nourriture, materiaux]
        .map((v) => ExportRapports.comparable(String(v)))
        .join("|"),
      date,
      camp: attaquant.toLowerCase() == pseudo.toLowerCase() ? "attaque" : "defense",
      valeurs: [
        pseudo,
        date,
        "Prise",
        attaquant,
        defenseur,
        "",
        terrain,
        nourriture,
        materiaux,
        "",
        "",
        "",
        "",
        ExportRapports.texteRC(texte),
      ],
    };
  }
  /**
   * Lignes à envoyer pour des conversations lues : un RC par ligne, précédé de
   * sa clé, avec son onglet (chasse, attaque ou défense : le camp du joueur
   * d'après le RC, sinon d'après le titre de la conversation). Deux RC
   * identiques (même minute, mêmes armées, ou même prise) sont distingués par
   * leur rang, dans l'ordre des messages.
   *
   * @static
   * @method lignes
   * @param {String} type "chasse" ou "combat"
   * @param {Array} conversations [{id, titre, camp?, messages: [{id, date, texte}]}]
   * @param {String} pseudo
   * @return {Array<{onglet: String, ligne: Array}>} ligne : [clé, ...valeurs]
   */
  static lignes(type, conversations, pseudo) {
    /** @type {Array<{id: Number, onglet: String, rc: {signature: String, date: String, valeurs: Array}}>} */
    let rcs = [];
    conversations.forEach((c) => {
      let titreUtilise = false;
      c.messages.forEach((/** @type {{id: Number, date: String, texte: String}} */ m) => {
        if (type == "chasse") {
          let rc = ExportRapports.chasse(m.texte, m.date, pseudo);
          if (rc) rcs.push({ id: m.id, onglet: "chasse", rc });
          return;
        }
        let rc =
          ExportRapports.combat(m.texte, m.date, pseudo) ||
          ExportRapports.prise(m.texte, m.date, pseudo, titreUtilise ? "" : c.titre);
        if (!rc) return;
        if (rc.valeurs[2] == "Prise") titreUtilise = true;
        rcs.push({ id: m.id, onglet: rc.camp || c.camp || "attaque", rc });
      });
    });
    let rangs = new Map();
    return rcs
      .sort((a, b) => a.id - b.id)
      .map(({ onglet, rc }) => {
        let cleRang = onglet + "|" + rc.signature,
          rang = (rangs.get(cleRang) || 0) + 1;
        rangs.set(cleRang, rang);
        let cle = `${rc.date}|${ExportRapports.empreinte(rc.signature)}${rang > 1 ? "|" + rang : ""}`;
        return { onglet, ligne: [cle, ...rc.valeurs] };
      });
  }
  /**
   * Messages d'une conversation, tous : chargée comme à son ouverture, puis
   * « messages précédents » tant qu'il y en a.
   *
   * @static
   * @method messages
   * @param {Number} idConv
   * @return {Promise<Array<{id: Number, date: String, texte: String}>>}
   */
  static messages(idConv) {
    let poster = (/** @type {Object} */ donnees) =>
        Promise.resolve($.post(location.origin + "/messagerie.php", donnees)),
      // DOMParser : le contenu des messages (écrit par d'autres joueurs) n'exécute rien
      lire = (/** @type {String} */ html) => Utils.parseHtml(`<table>${html}</table>`);
    return poster({ traitement: "afficher", conversation: idConv }).then((html) => {
      let $page = lire(html),
        messages = ExportRapports._messagesDe($page),
        precedents = (/** @type {Number} */ k, /** @type {any} */ $p) => {
          if (
            k >= EXPORT_MAX_PRECEDENTS ||
            !messages.length ||
            !$p.find(".lien_voir_precedent").length
          )
            return Promise.resolve(messages);
          return poster({
            traitement: "afficher_plus",
            id_conversation: idConv,
            id_dernier_message: messages[0].id,
          }).then((suite) => {
            let $suite = lire(suite),
              anciens = ExportRapports._messagesDe($suite).filter(
                (m) => !messages.some((n) => n.id == m.id),
              );
            if (!anciens.length) return messages;
            messages = anciens.concat(messages);
            return precedents(k + 1, $suite);
          });
        };
      return precedents(0, $page);
    });
  }
  /**
   * @private
   * @static
   * @param {any} $page
   * @return {Array<{id: Number, date: String, texte: String}>}
   */
  static _messagesDe($page) {
    return $page
      .find("tr[id^='message_']")
      .get()
      .map((/** @type {Element} */ tr) => {
        let $message = $(tr).find(".message").first().clone();
        $message.find("br").replaceWith("\n");
        // ajouts de l'extension (analyses, boutons) : pas dans le RC
        $message.find("div[id^='o_analyse'], .o_optionMessage").remove();
        return {
          id: parseInt((tr.id.match(/\d+/) || ["0"])[0]),
          date: ExportRapports.date($(tr).find(".expe").first().text()),
          texte: $message.text(),
        };
      })
      .filter((m) => m.id && m.texte.trim());
  }
  /**
   * @private
   * @static
   * @param {String} type
   */
  static _cleExportees(type) {
    return `fzzz_exportees_${type}_${Utils.serveur}_${String(monProfil.pseudo || "").toLowerCase()}`;
  }
  /**
   * Numéros des conversations déjà exportées depuis ce navigateur.
   *
   * @static
   * @method exportees
   * @param {String} type
   * @return {Array<Number>}
   */
  static exportees(type) {
    let liste = Utils.lireStockage(ExportRapports._cleExportees(type), []);
    return Array.isArray(liste) ? liste : [];
  }
  /**
   * @static
   * @method marquer
   * @param {String} type
   * @param {Array<Number>} ids
   */
  static marquer(type, ids) {
    let liste = ExportRapports.exportees(type).filter((id) => !ids.includes(id));
    liste.push(...ids);
    try {
      localStorage.setItem(
        ExportRapports._cleExportees(type),
        JSON.stringify(liste.slice(-EXPORT_MAX_CONVERSATIONS)),
      );
    } catch (e) {}
  }
  /**
   * Réglage de l'alliance, dans le premier message du sujet TITRE_EXPORT_SHEET
   * (réponse de callGetTopic) : l'adresse du script, n'importe où dans le
   * message, et les pseudos écrits après « Joueurs autorisés … : », séparés par
   * des virgules, des espaces ou des retours à la ligne, jusqu'à la fin du
   * message ou la prochaine ligne qui contient « : ».
   *
   * @static
   * @method lireReglage
   * @param {any} data réponse xajax
   * @return {{adresse: String, joueurs: Array<String>}}
   */
  static lireReglage(data) {
    let $div = Utils.parseHtml(PartageChasses._html(data)),
      $premier = $div.find(".messageForum").first(),
      $message = $premier.length ? $premier : $div,
      // le forum peut changer l'adresse en lien (texte raccourci) : href lus aussi
      liens = $message
        .find("a[href]")
        .get()
        .map((/** @type {Element} */ a) => a.getAttribute("href"));
    $message.find("br").replaceWith("\n");
    let texte = $message.text(),
      url = /https:\/\/script\.google\.com\/[^\s"'<>]+?\/exec\b/.exec([texte, ...liens].join(" ")),
      titre = LISTE_EXPORT_ALLIANCE.exec(texte),
      joueurs = /** @type {Array<String>} */ ([]);
    if (titre) {
      let [reste, ...suite] = texte.slice(titre.index + titre[0].length).split("\n"),
        fin = suite.findIndex((l) => l.includes(":"));
      joueurs = [reste, ...(fin == -1 ? suite : suite.slice(0, fin))]
        .join(" ")
        .split(/[\s,;]+/)
        .map((p) => PartageChasses.nettoyer(p).replace(/\.+$/, ""))
        .filter((p) => p && !/[:/]/.test(p));
    }
    return { adresse: url && ExportRapports.adresseValide(url[0]) ? url[0] : "", joueurs };
  }
  /**
   * @static
   * @method autorise
   * @param {Array<String>} joueurs pseudos de la liste du forum
   * @param {String} [pseudo]
   * @return {Boolean} pseudo dans la liste, casse ignorée
   */
  static autorise(joueurs, pseudo = monProfil.pseudo) {
    let p = String(pseudo || "").toLowerCase();
    return !!p && joueurs.some((j) => j.toLowerCase() == p);
  }
  /**
   * Le joueur est-il dans la liste du forum caché, et l'adresse du fichier de
   * l'alliance ? Le forum fait foi quand il se lit ; sinon, la dernière lecture
   * faite pour ce joueur (rien pour un joueur hors liste ni un autre pseudo).
   *
   * @static
   * @method reglageAlliance
   * @return {Promise<{autorise: Boolean, adresse: String, illisible?: Boolean}>} illisible : forum pas lu et aucune lecture gardée
   */
  static reglageAlliance() {
    let pseudo = String(monProfil.pseudo || "").toLowerCase();
    return ExportRapports._reglageForum().then(
      (r) => {
        let autorise = ExportRapports.autorise(r.joueurs, pseudo),
          adresse = autorise ? r.adresse : "";
        // texte JSON : gardé tel quel par tous les gestionnaires de scripts
        return ExportRapports._garder(
          CLE_EXPORT_SHEET_ALLIANCE,
          autorise ? JSON.stringify({ pseudo, adresse }) : "",
        ).then(() => ({ autorise, adresse }));
      },
      () =>
        ExportRapports._lire(CLE_EXPORT_SHEET_ALLIANCE).then((texte) => {
          let c = null;
          try {
            c = JSON.parse(texte);
          } catch (e) {}
          return pseudo && c && c.pseudo == pseudo
            ? { autorise: true, adresse: String(c.adresse || "") }
            : { autorise: false, adresse: "", illisible: true };
        }),
    );
  }
  /**
   * @private
   * @static
   * @return {Promise<{adresse: String, joueurs: Array<String>}>} rien si le sujet n'existe pas ; rejetée si le forum ne se lit pas
   */
  static _reglageForum() {
    return PartageChasses.sujets(true).then((sujets) =>
      sujets.exportSheet
        ? PartageChasses._xajax("callGetTopic", sujets.exportSheet).then((data) =>
            ExportRapports.lireReglage(data),
          )
        : { adresse: "", joueurs: [] },
    );
  }
  /**
   * Adresse où exporter : celle de l'alliance pour un joueur de la liste du
   * forum caché, sinon celle de son propre fichier.
   *
   * @static
   * @method cible
   * @return {Promise<{url: String, alliance: Boolean, illisible?: Boolean}>} url "" si aucune
   */
  static cible() {
    return ExportRapports.reglageAlliance().then((r) =>
      r.autorise
        ? { url: r.adresse, alliance: true }
        : ExportRapports.adressePersonnelle().then((url) => ({
            url,
            alliance: false,
            illisible: !!r.illisible,
          })),
    );
  }
  /**
   * Adresse du propre fichier d'un joueur hors de la liste, gardée dans ce
   * navigateur.
   *
   * @static
   * @method adressePersonnelle
   * @return {Promise<String>}
   */
  static adressePersonnelle() {
    return ExportRapports._lire(CLE_EXPORT_SHEET);
  }
  /**
   * @private
   * @static
   * @param {String} cle
   * @return {Promise<String>} valeur gardée, ou ""
   */
  static _lire(cle) {
    try {
      return chrome.storage.local
        .get(cle)
        .then((/** @type {Object} */ r) => r[cle] || "")
        .catch(() => "");
    } catch (e) {
      return Promise.resolve("");
    }
  }
  /**
   * @private
   * @static
   * @param {String} cle
   * @param {String} valeur "" pour oublier
   * @return {Promise}
   */
  static _garder(cle, valeur) {
    try {
      return (
        valeur ? chrome.storage.local.set({ [cle]: valeur }) : chrome.storage.local.remove(cle)
      ).catch(() => {});
    } catch (e) {
      return Promise.resolve();
    }
  }
  /**
   * Adresse du propre fichier d'un joueur hors de la liste, gardée dans ce
   * navigateur (un joueur de la liste ne l'utilise jamais).
   *
   * @static
   * @method enregistrerAdresse
   * @param {String} url "" pour effacer
   * @return {Promise}
   */
  static enregistrerAdresse(url) {
    return ExportRapports._garder(CLE_EXPORT_SHEET, url);
  }
  /**
   * @static
   * @method adresseValide
   * @param {String} url
   * @return {Boolean}
   */
  static adresseValide(url) {
    return ADRESSE_EXPORT_SHEET.test(String(url || "").trim());
  }
  /**
   * Requête au script du fichier, faite par le script d'arrière-plan (ou le
   * gestionnaire de scripts utilisateur).
   *
   * @static
   * @method requete
   * @param {String} url
   * @param {String} methode "GET" ou "POST"
   * @param {Object} [corps]
   * @return {Promise<Object>} réponse du script ; rejetée avec un message pour le joueur
   */
  static requete(url, methode, corps) {
    let echec = (/** @type {String} */ message) => Promise.reject(new Error(message));
    return Promise.resolve(chrome.runtime.sendMessage({ type: "fzzz_sheet", url, methode, corps }))
      .catch(() => ({ erreur: "reseau" }))
      .then((/** @type {any} */ r) => {
        if (!r || r.erreur == "reseau") return echec("le script du Google Sheet ne répond pas");
        if (r.erreur == "permission")
          return echec("le navigateur n'a pas accordé l'accès à script.google.com");
        if (r.erreur) return echec("adresse du script invalide");
        if (r.donnees && r.donnees.erreur) return echec(`le script refuse : ${r.donnees.erreur}`);
        if (!r.ok || !r.donnees || typeof r.donnees != "object")
          return echec(`réponse inattendue du script (erreur ${r.statut || "?"})`);
        return r.donnees;
      });
  }
  /**
   * Envoie les lignes d'un onglet au fichier, par paquets.
   *
   * @static
   * @method envoyer
   * @param {String} onglet clé de EXPORTS_RAPPORTS
   * @param {Array<Array>} lignes
   * @param {String} url
   * @return {Promise<{ajoutees: Number, deja: Number}>}
   */
  static envoyer(onglet, lignes, url) {
    let cfg = EXPORTS_RAPPORTS[onglet],
      total = { ajoutees: 0, deja: 0 },
      suite = Promise.resolve();
    for (let i = 0; i < lignes.length; i += EXPORT_PAQUET) {
      let paquet = lignes.slice(i, i + EXPORT_PAQUET);
      suite = suite
        .then(() =>
          ExportRapports.requete(url, "POST", {
            onglet: cfg.onglet,
            entetes: cfg.entetes,
            lignes: paquet,
          }),
        )
        .then((r) => {
          total.ajoutees += Number(r.ajoutees) || 0;
          total.deja += Number(r.deja) || 0;
        });
    }
    return suite.then(() => total);
  }
  /**
   * Bouton « Exporter mes chasses » / « Exporter mes RC » : conversations de
   * ce type listées dans la messagerie et pas encore exportées, lues une à une,
   * puis envoyées au fichier, onglet par onglet. Une conversation n'est retenue
   * comme exportée qu'une fois ses RC acceptés par le fichier.
   *
   * @static
   * @method exporter
   * @param {String} type "chasse" ou "combat"
   * @param {any} [$bouton]
   * @return {Promise}
   */
  static exporter(type, $bouton) {
    let pseudo = monProfil.pseudo,
      quoi = type == "chasse" ? "chasses" : "RC";
    if (exportEnCours) {
      $.toast({ ...TOAST_INFO, text: "Un export est déjà en cours, patiente un instant." });
      return Promise.resolve();
    }
    if (!pseudo) return Promise.resolve();
    exportEnCours = true;
    if ($bouton) $bouton.prop("disabled", true);
    let fin = () => {
      exportEnCours = false;
      if ($bouton) $bouton.prop("disabled", false);
      $("#o_exportProgres").closest(".jq-toast-single").remove();
    };
    return ExportRapports.cible()
      .then(({ url, alliance, illisible }) => {
        if (!ExportRapports.adresseValide(url)) {
          $.toast({
            ...TOAST_ERROR,
            hideAfter: 10000,
            text: alliance
              ? `Export impossible : l'adresse du Google Sheet de l'alliance n'est pas encore postée dans le forum caché (sujet « ${TITRE_EXPORT_SHEET} »).`
              : illisible
                ? `Export impossible : le forum de l'alliance n'a pas pu être lu (liste des joueurs autorisés à partager des RC, sujet « ${TITRE_EXPORT_SHEET} »). Réessaie dans un instant.`
                : `Export impossible : ton pseudo n'est pas dans la liste des joueurs autorisés à partager des RC (forum caché, sujet « ${TITRE_EXPORT_SHEET} ») et aucune adresse de Google Sheet n'est renseignée dans Préférences → Messagerie.`,
          });
          return;
        }
        let faites = ExportRapports.exportees(type),
          aLire = $("tr.en_tete_message[id^='conversation_']")
            .get()
            .filter((elt) => {
              let c = MessagerieFzzz.categorie($(elt));
              return c && c.nom == type;
            })
            .map((elt) => ({
              id: parseInt((elt.id.match(/\d+/) || ["0"])[0]),
              titre: $(elt).find(".intitule_message").text().replace(/\s+/g, " ").trim(),
              // camp d'après le titre, pour un RC dont la tournure n'est pas reconnue
              camp: MessagerieFzzz.typeCouleur($(elt)) == "defense" ? "defense" : "attaque",
            }))
            .filter((c) => c.id && !faites.includes(c.id));
        if (!aLire.length) {
          $.toast({
            ...TOAST_INFO,
            text: `Aucun nouveau ${type == "chasse" ? "rapport de chasse" : "RC"} à exporter dans la liste de la messagerie.`,
          });
          return;
        }
        let lues = [],
          echecs = 0;
        $.toast({
          ...TOAST_INFO,
          hideAfter: false,
          text: `Export des ${quoi} : lecture des conversations, une à une (le jeu n'en sert qu'une à la fois) <strong id='o_exportProgres'>0/${aLire.length}</strong>`,
        });
        return aLire
          .reduce(
            (suite, c, k) =>
              suite.then(() =>
                ExportRapports.messages(c.id)
                  .then(
                    (messages) => lues.push({ ...c, messages }),
                    () => echecs++,
                  )
                  .then(() => $("#o_exportProgres").text(`${k + 1}/${aLire.length}`)),
              ),
            Promise.resolve(),
          )
          .then(() => {
            let lignes = ExportRapports.lignes(type, lues, pseudo),
              // conversations sans RC reconnu : relues au prochain export
              avecRC = lues
                .filter((c) => ExportRapports.lignes(type, [c], pseudo).length)
                .map((c) => c.id),
              onglets = [...new Set(lignes.map((l) => l.onglet))],
              bilans = /** @type {Array<{onglet: String, ajoutees: Number, deja: Number}>} */ ([]);
            if (lignes.length) $("#o_exportProgres").text("envoi au Google Sheet…");
            return onglets
              .reduce(
                (suite, onglet) =>
                  suite.then(() =>
                    ExportRapports.envoyer(
                      onglet,
                      lignes.filter((l) => l.onglet == onglet).map((l) => l.ligne),
                      url,
                    ).then((r) => bilans.push({ onglet, ...r })),
                  ),
                Promise.resolve(),
              )
              .then(() => {
                ExportRapports.marquer(type, avecRC);
                let sansRC = lues.length - avecRC.length,
                  pluriel = (/** @type {Number} */ n) => (n > 1 ? "s" : ""),
                  deja = bilans.reduce((t, b) => t + b.deja, 0);
                $.toast({
                  ...TOAST_SUCCESS,
                  hideAfter: 10000,
                  text:
                    `Export des ${quoi} : ` +
                    (bilans.length
                      ? bilans
                          .map(
                            (b) =>
                              `${b.ajoutees} ligne${pluriel(b.ajoutees)} ajoutée${pluriel(b.ajoutees)} dans « ${EXPORTS_RAPPORTS[b.onglet].onglet} »`,
                          )
                          .join(", ")
                      : "rien à ajouter") +
                    (deja ? ` (${deja} déjà présente${pluriel(deja)})` : "") +
                    "." +
                    (sansRC ? ` ${sansRC} conversation(s) sans RC reconnu.` : "") +
                    (echecs
                      ? ` ${echecs} conversation(s) n'ont pas pu être lues : réessaie plus tard.`
                      : ""),
                });
              });
          });
      })
      .catch((e) =>
        $.toast({
          ...TOAST_ERROR,
          hideAfter: 10000,
          text: `Export des ${quoi} impossible : ${e && e.message ? e.message : "erreur inconnue"}. Rien n'a été marqué comme exporté.`,
        }),
      )
      .finally(fin);
  }
}
