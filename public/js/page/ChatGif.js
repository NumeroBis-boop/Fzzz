// @ts-check
/*
 * ChatGif.js
 * GIF des chats (ceux que le joueur a envoyés, ceux de l'alliance) et smileys
 * de l'alliance des chats et de la Messagerie.
 **********************************************************************/

// GIF envoyés par le joueur avec [img]…[/img], le plus récent en premier
const CLE_MES_GIF = "fzzz_mesGif";
const MES_GIF_MAX = 60;
// dernières lectures des sujets de l'alliance, montrées quand le forum ne répond pas
const CLE_GIF_ALLIANCE = "fzzz_gifAlliance";
const CLE_SMILEYS_ALLIANCE = "fzzz_smileysAlliance";
// listes du panneau repliées par le joueur : {mes: true, alliance: true, "smileys:membres": true}
const CLE_GIF_REPLIEES = "fzzz_gifRepliees";
// adresse utilisable telle quelle dans [img]…[/img]
const ADRESSE_IMAGE = /^https?:\/\/[^\s[\]<>"'`]+$/i;
// codes du premier pack de smileys du jeu, écrit dans ses pages ; ceux des
// autres packs sont dans LISTESMILEY1 à 6 (content.js)
const SMILEYS_JEU_PACK1 = [
  "pouce",
  "smile",
  "biggrin",
  "laugh",
  "tongue",
  "bye",
  "cool",
  "interest",
  "angel",
  "smug",
  "nudgewink",
  "blink",
  "unsure",
  "shy",
  "oh",
  "sleep",
  "sad",
  "mad",
  "worker",
  "food",
  "wood",
  "convoy",
  "letter",
  "hunt_report",
  "fight_report",
  "convoy_report",
];
const TITRE_SECTION_MAX = 40;
const CODE_SMILEY_MAX = 30;
/** @type {Set<String>|null} */
let codesSmileysJeu = null;
// lectures des sujets de l'alliance lancées pour cette page
/** @type {Record<String, Promise<any>>} */
let lecturesAlliance = {};
let envoisMessagerieSuivis = false;

/**
 * @typedef {{nom: String, adresse: String}} Smiley
 * @typedef {{titre: String, smileys: Array<Smiley>}} SectionSmileys
 * @typedef {{champ: HTMLInputElement|HTMLTextAreaElement, $bouton: any, $panneau: any}} PosteSmileys
 *   champ de message, son bouton « Smileys » et son panneau
 */

/**
 * Bouton « GIF » des chats d'alliance et général, deux listes : « Mes GIF »
 * (ceux que le joueur a envoyés avec la balise [img] du jeu, gardés dans son
 * navigateur) et « GIF de l'alliance » (premier message du sujet caché
 * TITRE_GIF_ALLIANCE, tenu à la main). Un clic écrit [img]adresse[/img] dans
 * le message, que le joueur envoie lui-même ; le jeu affiche l'image à tous,
 * avec ou sans l'extension.
 *
 * Bouton « Smileys » des chats et de la Messagerie : les images du sujet
 * TITRE_SMILEYS_ALLIANCE, rangées sous les titres écrits dans ce sujet. Un clic
 * écrit le code du smiley, {nom}, comme pour ceux du jeu ; le jeu ne
 * connaissant que les siens, le code devient [img]adresse[/img] au moment où
 * le joueur envoie son message.
 *
 * Requêtes : sur les chats, les sujets de l'alliance sont lus à l'ouverture de
 * la page (une lecture chacun et une de la liste des sujets, permises par les
 * règles s5 : rien de périodique), et de nouveau à l'ouverture du panneau si
 * elle a échoué ; dans la Messagerie, au premier clic sur « Smileys ».
 *
 * @class ChatGif
 */
class ChatGif {
  /**
   * Adresses des images d'un message, balises [img] en majuscules comprises.
   *
   * @static
   * @method adresses
   * @param {String} message
   * @return {Array<String>}
   */
  static adresses(message) {
    return [...String(message || "").matchAll(/\[img\]\s*(.*?)\s*\[\/img\]/gi)]
      .map((m) => m[1])
      .filter((a) => ADRESSE_IMAGE.test(a));
  }
  /**
   * @private
   * @static
   * @param {String} adresse
   * @return {URL|null}
   */
  static _url(adresse) {
    if (!ADRESSE_IMAGE.test(adresse)) return null;
    try {
      return new URL(adresse);
    } catch (e) {
      return null;
    }
  }
  /**
   * @static
   * @method extension
   * @param {String} adresse
   * @return {String} extension du fichier, en minuscules ("" sans)
   */
  static extension(adresse) {
    let url = ChatGif._url(adresse),
      m = url && /\.([a-z0-9]+)$/i.exec(url.pathname);
    return m ? m[1].toLowerCase() : "";
  }
  /**
   * @static
   * @method estGif
   * @param {String} adresse
   * @return {Boolean} GIF ou WebP (animé chez Giphy)
   */
  static estGif(adresse) {
    return ["gif", "webp"].includes(ChatGif.extension(adresse));
  }
  /**
   * @static
   * @method estImage
   * @param {String} adresse
   * @return {Boolean}
   */
  static estImage(adresse) {
    return ["gif", "webp", "png", "jpg", "jpeg"].includes(ChatGif.extension(adresse));
  }
  /**
   * « Mes GIF », le plus récent en premier.
   *
   * @static
   * @method mesGif
   * @return {Array<String>}
   */
  static mesGif() {
    try {
      let liste = JSON.parse(localStorage.getItem(CLE_MES_GIF) || "[]");
      return Array.isArray(liste)
        ? liste.filter((a) => typeof a == "string" && ChatGif.estGif(a))
        : [];
    } catch (e) {
      return [];
    }
  }
  /**
   * @private
   * @static
   * @param {Array<String>} liste
   */
  static _garder(liste) {
    try {
      localStorage.setItem(CLE_MES_GIF, JSON.stringify(liste.slice(0, MES_GIF_MAX)));
    } catch (e) {}
  }
  /**
   * GIF d'un message envoyé : en tête de « Mes GIF », sans doublon.
   *
   * @static
   * @method noterEnvoi
   * @param {String} message
   */
  static noterEnvoi(message) {
    // un smiley animé de l'alliance n'est pas un GIF du joueur
    let smileys = new Set(ChatGif.codes().values()),
      nouveaux = ChatGif.adresses(message).filter((a) => ChatGif.estGif(a) && !smileys.has(a));
    if (nouveaux.length) ChatGif._garder([...new Set([...nouveaux, ...ChatGif.mesGif()])]);
  }
  /**
   * @static
   * @method retirer
   * @param {String} adresse
   */
  static retirer(adresse) {
    ChatGif._garder(ChatGif.mesGif().filter((a) => a != adresse));
  }
  /**
   * Images du premier message du sujet de l'alliance (les réponses ne comptent
   * pas) : images affichées, liens et adresses écrites en texte.
   *
   * @static
   * @method lireListe
   * @param {String} data réponse du forum
   * @return {{gifs: Array<String>, ignores: Number}} ignores : liens qui ne sont pas des images
   */
  static lireListe(data) {
    let $div = Utils.parseHtml(PartageChasses._html(data)),
      $premier = $div.find(".messageForum").first(),
      $message = ($premier.length ? $premier : $div).clone(),
      vues = [
        ...$message
          .find("img[src]")
          .get()
          .map((/** @type {Element} */ e) => e.getAttribute("src")),
        ...$message
          .find("a[href]")
          .get()
          .map((/** @type {Element} */ e) => e.getAttribute("href")),
      ];
    // le texte d'un lien peut être l'adresse raccourcie : seul son href compte
    $message.find("a").remove();
    $message.find("br").replaceWith("\n");
    vues.push(
      ...($message.text().match(/https?:\/\/[^\s[\]<>"'`]+/gi) || []).map((a) =>
        a.replace(/[.,;:!?)]+$/, ""),
      ),
    );
    let adresses = [
        ...new Set(vues.map((a) => String(a || "").trim()).filter((a) => /^https?:\/\//i.test(a))),
      ],
      // smileys et pages du jeu dans le message : ni GIF de la liste, ni lien à signaler
      horsJeu = adresses.filter((a) => {
        let url = ChatGif._url(a);
        return !url || !/(^|\.)fourmizzz\.fr$/i.test(url.hostname);
      }),
      gifs = horsJeu.filter((a) => ChatGif.estImage(a));
    return { gifs, ignores: horsJeu.length - gifs.length };
  }
  /**
   * Lignes d'un message du forum : ses textes et ses adresses (images, liens,
   * adresses écrites), dans l'ordre du message.
   *
   * @private
   * @static
   * @param {Element} message
   * @return {Array<Array<{texte?: String, adresse?: String}>>}
   */
  static _lignes(message) {
    /** @type {Array<Array<{texte?: String, adresse?: String}>>} */
    let lignes = [[]],
      ligne = () => lignes[lignes.length - 1],
      saut = () => {
        if (ligne().length) lignes.push([]);
      },
      texte = (/** @type {String} */ t) => {
        let fin = 0;
        for (let m of t.matchAll(/https?:\/\/[^\s[\]<>"'`]+/gi)) {
          let adresse = m[0].replace(/[.,;:!?)]+$/, ""),
            debut = m.index || 0;
          if (debut > fin) ligne().push({ texte: t.slice(fin, debut) });
          ligne().push({ adresse });
          fin = debut + adresse.length;
        }
        if (fin < t.length) ligne().push({ texte: t.slice(fin) });
      },
      parcourir = (/** @type {Node} */ noeud) => {
        noeud.childNodes.forEach((n) => {
          if (n.nodeType == 3) return texte(n.nodeValue || "");
          if (n.nodeType != 1) return;
          let e = /** @type {Element} */ (n),
            balise = e.nodeName.toUpperCase();
          if (balise == "BR") lignes.push([]);
          else if (balise == "IMG") ligne().push({ adresse: e.getAttribute("src") || "" });
          else if (balise == "A") {
            // le texte d'un lien peut être l'adresse raccourcie : seul son href compte
            e.querySelectorAll("img[src]").forEach((i) =>
              ligne().push({ adresse: i.getAttribute("src") || "" }),
            );
            ligne().push({ adresse: e.getAttribute("href") || "" });
          } else {
            let bloc = /^(DIV|P|LI|UL|OL|TR|TABLE|H[1-6]|BLOCKQUOTE|CENTER|PRE|HR)$/.test(balise);
            if (bloc) saut();
            parcourir(e);
            if (bloc) saut();
          }
        });
      };
    parcourir(message);
    return lignes;
  }
  /**
   * Code d'un smiley, comme ceux du jeu ({tongue}) : minuscules sans accent,
   * le reste remplacé par des tirets.
   *
   * @static
   * @method codeSmiley
   * @param {String} texte nom écrit dans le sujet, nom de fichier ou code tapé
   * @return {String} "" si rien n'en reste
   */
  static codeSmiley(texte) {
    return String(texte || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, CODE_SMILEY_MAX)
      .replace(/-+$/, "");
  }
  /**
   * @private
   * @static
   * @param {String} adresse
   * @return {String} nom du fichier de l'image, sans son extension
   */
  static _nomFichier(adresse) {
    let url = ChatGif._url(adresse),
      fichier = url ? url.pathname.split("/").pop() || "" : "";
    try {
      fichier = decodeURIComponent(fichier);
    } catch (e) {}
    return fichier.replace(/\.[a-z0-9]+$/i, "");
  }
  /**
   * Codes des smileys du jeu ({tongue}, {flower}…) : jamais donnés à un smiley
   * de l'alliance, qui remplacerait celui du jeu à l'envoi.
   *
   * @static
   * @method codesJeu
   * @return {Set<String>}
   */
  static codesJeu() {
    if (codesSmileysJeu) return codesSmileysJeu;
    let listes =
      typeof LISTESMILEY1 == "undefined"
        ? ""
        : [LISTESMILEY1, LISTESMILEY2, LISTESMILEY3, LISTESMILEY4, LISTESMILEY5, LISTESMILEY6].join(
            " ",
          );
    codesSmileysJeu = new Set([
      ...SMILEYS_JEU_PACK1,
      ...[...listes.matchAll(/addRaccourciSmiley\("[^"]*","\s*([^"]+?)\s*"\)/g)].map((m) => m[1]),
    ]);
    return codesSmileysJeu;
  }
  /**
   * Donne son code à chaque smiley : le nom écrit devant lui dans le sujet,
   * sinon celui du fichier de l'image ; un code déjà pris (smiley du jeu ou
   * autre smiley de l'alliance) reçoit un numéro.
   *
   * @private
   * @static
   * @param {Array<SectionSmileys>} sections
   * @return {Array<SectionSmileys>}
   */
  static _nommer(sections) {
    let pris = new Set(ChatGif.codesJeu());
    sections.forEach((s) =>
      s.smileys.forEach((smiley) => {
        let base =
            ChatGif.codeSmiley(smiley.nom) ||
            ChatGif.codeSmiley(ChatGif._nomFichier(smiley.adresse)) ||
            "smiley",
          nom = base;
        for (let n = 2; pris.has(nom); n++) nom = `${base}-${n}`;
        pris.add(nom);
        smiley.nom = nom;
      }),
    );
    return sections;
  }
  /**
   * Smileys du premier message du sujet de l'alliance, dans l'ordre du
   * message. Une ligne sans image qui finit par « : » est le titre des smileys
   * qui la suivent (« Membres : », « Génériques : ») ; un {nom} écrit juste
   * avant une image lui donne ce code au lieu du nom de son fichier.
   *
   * @static
   * @method lireSmileys
   * @param {String} data réponse du forum
   * @return {{gifs: Array<String>, ignores: Number, sections: Array<SectionSmileys>}}
   *   gifs : les adresses des smileys ; ignores : liens qui ne sont pas des images
   */
  static lireSmileys(data) {
    let $div = Utils.parseHtml(PartageChasses._html(data)),
      $premier = $div.find(".messageForum").first(),
      /** @type {Array<SectionSmileys>} */
      sections = [],
      vues = new Set(),
      ignores = 0,
      avant = "";
    ChatGif._lignes(($premier.length ? $premier : $div)[0]).forEach((ligne) => {
      if (!ligne.some((e) => e.adresse != null)) {
        let titre = new RegExp(`^(.{1,${TITRE_SECTION_MAX}}?)\\s*:$`).exec(
          ligne
            .map((e) => e.texte)
            .join("")
            .trim(),
        );
        if (titre) {
          sections.push({ titre: titre[1].trim(), smileys: [] });
          avant = "";
          return;
        }
      }
      ligne.forEach((e) => {
        if (e.adresse == null) {
          avant += e.texte;
          return;
        }
        let adresse = e.adresse.trim(),
          nom = /\{([^{}]+)\}\s*$/.exec(avant),
          url = ChatGif._url(adresse);
        avant = "";
        if (!/^https?:\/\//i.test(adresse) || vues.has(adresse)) return;
        vues.add(adresse);
        // smileys et pages du jeu dans le message : ni smiley de la liste, ni lien à signaler
        if (url && /(^|\.)fourmizzz\.fr$/i.test(url.hostname)) return;
        if (!ChatGif.estImage(adresse)) {
          ignores++;
          return;
        }
        if (!sections.length) sections.push({ titre: "", smileys: [] });
        sections[sections.length - 1].smileys.push({ nom: nom ? nom[1] : "", adresse });
      });
      avant += "\n";
    });
    sections = ChatGif._nommer(sections.filter((s) => s.smileys.length));
    return { gifs: sections.flatMap((s) => s.smileys.map((s) => s.adresse)), ignores, sections };
  }
  /**
   * Sections d'une lecture du sujet des smileys ; une lecture gardée par une
   * version sans sections (1.101) : une seule, sans titre.
   *
   * @static
   * @method sectionsLues
   * @param {any} lecture
   * @return {Array<SectionSmileys>}
   */
  static sectionsLues(lecture) {
    if (!lecture) return [];
    if (!Array.isArray(lecture.sections))
      return ChatGif._nommer([
        {
          titre: "",
          smileys: (Array.isArray(lecture.gifs) ? lecture.gifs : [])
            .filter((/** @type {any} */ a) => typeof a == "string" && ChatGif.estImage(a))
            .map((/** @type {String} */ adresse) => ({ nom: "", adresse })),
        },
      ]).filter((s) => s.smileys.length);
    return lecture.sections
      .map((/** @type {any} */ s) => ({
        titre: String((s && s.titre) || ""),
        smileys: (s && Array.isArray(s.smileys) ? s.smileys : []).filter(
          (/** @type {any} */ smiley) =>
            smiley &&
            typeof smiley.adresse == "string" &&
            ChatGif.estImage(smiley.adresse) &&
            /^[a-z0-9_-]+$/.test(String(smiley.nom)),
        ),
      }))
      .filter((/** @type {SectionSmileys} */ s) => s.smileys.length);
  }
  /**
   * Smileys de l'alliance connus de ce navigateur (dernière lecture du sujet) :
   * code → adresse de l'image.
   *
   * @static
   * @method codes
   * @return {Map<String, String>}
   */
  static codes() {
    let codes = new Map();
    ChatGif.sectionsLues(ChatGif._lue("smileys")).forEach((s) =>
      s.smileys.forEach((smiley) => codes.set(smiley.nom, smiley.adresse)),
    );
    return codes;
  }
  /**
   * Message où chaque code {nom} d'un smiley de l'alliance est remplacé par la
   * balise de son image ; les autres accolades (smileys du jeu compris) restent.
   *
   * @static
   * @method convertir
   * @param {String} message
   * @param {Map<String, String>} [codes]
   * @return {String}
   */
  static convertir(message, codes = ChatGif.codes()) {
    if (!codes.size) return String(message);
    return String(message).replace(/\{([^{}\n]{1,40})\}/g, (tout, code) => {
      let adresse = codes.get(ChatGif.codeSmiley(code));
      return adresse ? `[img]${adresse}[/img]` : tout;
    });
  }
  /**
   * Liste de l'alliance « gif » ou « smileys » : son panneau, son sujet du
   * forum et ses textes.
   *
   * @private
   * @static
   * @param {String} type "gif" ou "smileys"
   */
  static _liste(type) {
    return type == "smileys"
      ? {
          panneau: "#o_smileysPanneau",
          bouton: "#o_smileysBouton",
          zone: ".o_smileysAlliance",
          sujet: "smileysAlliance",
          titre: TITRE_SMILEYS_ALLIANCE,
          cle: CLE_SMILEYS_ALLIANCE,
          nom: "smileys",
          image: "le smiley",
          ce: "ce smiley",
        }
      : {
          panneau: "#o_gifPanneau",
          bouton: "#o_gifBouton",
          zone: ".o_gifAlliance",
          sujet: "gifAlliance",
          titre: TITRE_GIF_ALLIANCE,
          cle: CLE_GIF_ALLIANCE,
          nom: "GIF",
          image: "le GIF",
          ce: "ce GIF",
        };
  }
  /**
   * @private
   * @static
   * @param {String} [type] "gif" ou "smileys"
   * @return {any} dernière lecture du sujet pour cette alliance, ou null
   */
  static _lue(type = "gif") {
    try {
      let lue = JSON.parse(localStorage.getItem(ChatGif._liste(type).cle) || "null");
      return lue && lue.alliance == Utils.alliance && Array.isArray(lue.gifs) ? lue : null;
    } catch (e) {
      return null;
    }
  }
  /**
   * Images d'une liste de l'alliance lues dans son sujet du forum ; la lecture
   * est gardée pour le cas où le forum ne répond pas.
   *
   * @static
   * @method lireAlliance
   * @param {String} type "gif" ou "smileys"
   * @param {Boolean} [listeRecente] liste des sujets lue il y a moins d'une
   *   minute acceptée ; sinon relue (le sujet a pu être créé depuis)
   * @return {Promise<{gifs: Array<String>, ignores: Number, absent?: Boolean, date: Number}>}
   */
  static lireAlliance(type, listeRecente = false) {
    let liste = ChatGif._liste(type);
    return PartageChasses.sujets(listeRecente)
      .then((sujets) =>
        sujets[liste.sujet]
          ? PartageChasses._xajax("callGetTopic", sujets[liste.sujet]).then((data) =>
              type == "smileys" ? ChatGif.lireSmileys(data) : ChatGif.lireListe(data),
            )
          : { gifs: [], ignores: 0, absent: true },
      )
      .then((r) => {
        let lecture = { ...r, date: Horloge.maintenant(), alliance: Utils.alliance };
        try {
          localStorage.setItem(liste.cle, JSON.stringify(lecture));
        } catch (e) {}
        return lecture;
      });
  }
  /**
   * @static
   * @method gifAlliance
   * @return {Promise<{gifs: Array<String>, ignores: Number, absent?: Boolean, date: Number}>}
   */
  static gifAlliance() {
    return ChatGif.lireAlliance("gif");
  }
  /**
   * Lecture d'une liste de l'alliance pour cette page : celle lancée à son
   * ouverture, sinon (échec) une nouvelle.
   *
   * @private
   * @static
   * @param {String} [type] "gif" ou "smileys"
   * @param {Promise<any>|null} [apres] lecture des GIF de la page : la liste des
   *   sujets qu'elle vient de lire sert aussi aux smileys
   * @return {Promise<any>}
   */
  static _lecture(type = "gif", apres = null) {
    let lecture = lecturesAlliance[type];
    if (lecture) return lecture;
    lecture = apres
      ? apres.then(
          () => ChatGif.lireAlliance(type, true),
          () => ChatGif.lireAlliance(type),
        )
      : ChatGif.lireAlliance(type);
    lecturesAlliance[type] = lecture;
    // l'erreur est montrée à l'ouverture du panneau, qui relira
    lecture.catch(() => {
      if (lecturesAlliance[type] === lecture) delete lecturesAlliance[type];
    });
    return lecture;
  }
  /**
   * Écrit `texte` à la place du curseur, séparé du texte voisin.
   *
   * @private
   * @static
   * @param {HTMLInputElement|HTMLTextAreaElement} champ
   * @param {String} texte
   * @param {Boolean} [espaceApres] une espace après lui en fin de message,
   *   comme après un smiley du jeu : la suite se tape sans le toucher
   * @return {Boolean} faux si le message envoyé dépasserait la longueur permise
   */
  static _ecrire(champ, texte, espaceApres = false) {
    let valeur = champ.value,
      debut = champ.selectionStart ?? valeur.length,
      fin = champ.selectionEnd ?? valeur.length,
      avant = valeur.slice(0, debut),
      apres = valeur.slice(fin),
      ajout =
        (avant && !/\s$/.test(avant) ? " " : "") +
        texte +
        (apres ? (/^\s/.test(apres) ? "" : " ") : espaceApres ? " " : ""),
      nouveau = avant + ajout + apres;
    // les codes des smileys comptent pour la balise qui les remplacera à l'envoi
    if (champ.maxLength > 0 && ChatGif.convertir(nouveau).length > champ.maxLength) return false;
    champ.value = nouveau;
    champ.focus();
    champ.setSelectionRange((avant + ajout).length, (avant + ajout).length);
    return true;
  }
  /**
   * Écrit [img]adresse[/img] à la place du curseur, séparé du texte voisin.
   *
   * @static
   * @method inserer
   * @param {HTMLInputElement|HTMLTextAreaElement} champ
   * @param {String} adresse
   * @return {Boolean} faux si le message dépasserait la longueur permise
   */
  static inserer(champ, adresse) {
    return ChatGif._ecrire(champ, `[img]${adresse}[/img]`);
  }
  /**
   * Écrit le code {nom} d'un smiley de l'alliance à la place du curseur.
   *
   * @static
   * @method insererCode
   * @param {HTMLInputElement|HTMLTextAreaElement} champ
   * @param {String} nom
   * @return {Boolean} faux si le message envoyé dépasserait la longueur permise
   */
  static insererCode(champ, nom) {
    return ChatGif._ecrire(champ, `{${nom}}`, true);
  }
  /**
   * Au moment où le joueur envoie son message : les codes des smileys de
   * l'alliance y deviennent les balises de leurs images, que le jeu affiche à
   * tous. Un message qui dépasserait ainsi la longueur permise n'est pas
   * envoyé : le jeu le couperait au milieu d'une balise.
   *
   * @static
   * @method avantEnvoi
   * @param {HTMLInputElement|HTMLTextAreaElement} champ
   * @param {any} [e] événement de l'envoi (touche Entrée, clic, validation du formulaire)
   * @return {Boolean} faux si l'envoi est retenu
   */
  static avantEnvoi(champ, e) {
    let message = champ.value,
      converti = ChatGif.convertir(message);
    if (converti == message) return true;
    if (champ.maxLength > 0 && converti.length > champ.maxLength) {
      if (e) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
      let trop = converti.length - champ.maxLength;
      $.toast({
        ...TOAST_WARNING,
        text: `Message trop long de ${numeral(trop).format()} caractère${trop > 1 ? "s" : ""} avec les images de ses smileys : raccourcis-le avant de l'envoyer.`,
      });
      return false;
    }
    champ.value = converti;
    return true;
  }
  /**
   * Boutons « GIF » et « Smileys » au bout de la ligne d'« Envoyer » du chat,
   * leurs panneaux sous le formulaire.
   *
   * @static
   * @method installer
   * @param {{mes: Boolean, alliance: Boolean, smileys?: Boolean}} sections listes cochées dans les Préférences
   */
  static installer(sections) {
    let $champ = $("#message"),
      $formulaire = $("#formulaireChat");
    if (!$champ.length || $("#o_gifBouton, #o_smileysBouton").length) return;
    lecturesAlliance = {};
    let champ = /** @type {HTMLInputElement} */ ($champ[0]),
      $ancre = ChatGif._ancre($formulaire),
      // même bouton que « Envoyer » et « Actualiser » du jeu (maintainer request)
      classe = $("input[name='Envoyer']").attr("class") || "",
      ajouter = (
        /** @type {String} */ id,
        /** @type {String} */ libelle,
        /** @type {String} */ panneau,
      ) => {
        let $bouton = $(
            `<input type="button" id="${id}" aria-expanded="false" aria-controls="${panneau}"/>`,
          )
            .attr("value", libelle)
            .addClass(classe),
          $panneau = $(`<div id="${panneau}" hidden></div>`);
        if ($ancre.length) $bouton.insertAfter($ancre);
        else if ($formulaire.length) $bouton.appendTo($formulaire);
        else $bouton.insertAfter($champ);
        // espace avant : le navigateur peut passer à la ligne avant le bouton
        $bouton.before(document.createTextNode(" "));
        $ancre = $bouton;
        if ($formulaire.length) $panneau.appendTo($formulaire);
        else $panneau.insertAfter($bouton);
        // pas de mise en forme si le bouton est tombé dans un élément cliquable du jeu
        return $bouton.on("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
      },
      lectureGif = null;
    if (sections.mes || sections.alliance) {
      ajouter("o_gifBouton", "GIF", "o_gifPanneau").on("click", () => ChatGif.basculer(sections));
      // lu dès l'ouverture de la page : la liste est à jour au premier clic
      if (sections.alliance) lectureGif = ChatGif._lecture();
    }
    if (sections.smileys) {
      let $bouton = ajouter("o_smileysBouton", ChatGif.libelleSmileys(), "o_smileysPanneau"),
        poste = { champ, $bouton, $panneau: $("#o_smileysPanneau") };
      $bouton.on("click", () => ChatGif.basculerSmileys(poste));
      ChatGif._lecture("smileys", lectureGif);
    }
    if (!sections.mes && !sections.smileys) return;
    // avant l'envoi par le jeu, comme la couleur du texte (PageChat.parserMessage)
    let avantEnvoi = (/** @type {any} */ e) => {
      if (sections.smileys && !ChatGif.avantEnvoi(champ, e)) return;
      if (sections.mes) ChatGif.noterEnvoi(champ.value);
    };
    $champ.on("keypress.o_gif", (e) => {
      if ((e.keyCode || e.which) == 13) avantEnvoi(e);
    });
    $("input[name='Envoyer']").on("click.o_gif", avantEnvoi);
    // validation du formulaire sans touche ni clic vus (clavier d'un téléphone)
    let formulaire = $champ.closest("form")[0];
    if (formulaire) formulaire.addEventListener("submit", avantEnvoi, true);
  }
  /**
   * @static
   * @method libelleSmileys
   * @return {String} « Smileys OUAF » : le bouton porte le tag de l'alliance
   */
  static libelleSmileys() {
    return `Smileys ${Utils.alliance}`.trim();
  }
  /**
   * Messagerie : bouton « Smileys » de chaque message à écrire, le nouveau
   * message et les réponses des conversations ouvertes, au bout de sa barre de
   * mise en forme ; leurs codes deviennent des images à l'envoi. Rappelé quand
   * le jeu ajoute une conversation à la page.
   *
   * @static
   * @method messagerie
   */
  static messagerie() {
    $("#message_envoi, textarea[id^='champ_reponse_']").each((i, element) => {
      let champ = /** @type {HTMLTextAreaElement} */ (element),
        reponse = /^champ_reponse_(\d+)$/.exec(champ.id);
      if (!reponse && champ.id != "message_envoi") return;
      let $barre = $(reponse ? `#champ_bbcode_${reponse[1]}` : "#barre_bbcode_nouveau_message");
      if (!$barre.length || $barre.find(".o_smileysBouton").length) return;
      let $ancre = ChatGif._ancre($barre),
        $bouton = $(`<input type="button" class="o_smileysBouton" aria-expanded="false"/>`).attr(
          "value",
          ChatGif.libelleSmileys(),
        ),
        $panneau = $(`<div class="o_smileysPanneau" hidden></div>`),
        poste = { champ, $bouton, $panneau };
      if ($ancre.length) $bouton.insertAfter($ancre);
      else $bouton.appendTo($barre);
      // espace avant : le navigateur peut passer à la ligne avant le bouton
      $bouton.before(document.createTextNode(" "));
      // dans la barre : caché avec elle quand le joueur choisit autre chose que « Répondre »
      $panneau.appendTo($barre);
      $bouton.on("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        ChatGif.basculerSmileys(poste);
      });
    });
    if (envoisMessagerieSuivis) return;
    envoisMessagerieSuivis = true;
    // avant le jeu, qui lit le message au clic depuis un élément parent
    document.addEventListener("click", (e) => ChatGif._avantEnvoiMessagerie(e), true);
  }
  /**
   * Clic sur « Envoyer » ou sur « Répondre » d'une conversation : les codes
   * des smileys du message envoyé deviennent leurs images.
   *
   * @private
   * @static
   * @param {Event} e
   */
  static _avantEnvoiMessagerie(e) {
    let cible = /** @type {any} */ (e.target),
      champ = null;
    if (!cible || typeof cible.closest != "function") return;
    if (cible.closest("#bt_envoi_message")) champ = document.getElementById("message_envoi");
    else {
      let reaction = cible.closest(".reaction_choisie"),
        m = reaction && /^repondre_(?:tous|unique)_(\d+)$/.exec(reaction.id);
      if (m) champ = document.getElementById(`champ_reponse_${m[1]}`);
    }
    if (champ) ChatGif.avantEnvoi(/** @type {HTMLTextAreaElement} */ (champ), e);
  }
  /**
   * Place des boutons : au bout de la ligne d'« Envoyer », après les boutons
   * de mise en forme, ceux du jeu (Compte+ : images dans un span) ou le groupe
   * de ceux de l'extension. Les images des couleurs du jeu (#listeCouleur0,
   * caché, en fin de formulaire) ne sont pas un repère.
   *
   * @private
   * @static
   * @param {any} $formulaire
   * @return {any} jQuery ; vide : à la fin du formulaire
   */
  static _ancre($formulaire) {
    let $dernier = $formulaire.find("[onclick*='miseEnForme']").last(),
      $parent = $dernier.parent(),
      $ancre = $dernier.closest(".o_group_bouton_chat");
    if (!$ancre.length)
      $ancre =
        !$parent.is($formulaire) && $parent.children("[onclick*='miseEnForme']").length > 1
          ? $parent
          : $dernier;
    // ligne insécable du jeu : les boutons la suivent, pour passer à la ligne
    // sur téléphone au lieu d'élargir la page
    let $ligne = $ancre.closest(".sur_une_ligne", $formulaire[0]);
    return $ligne.length ? $ligne : $ancre;
  }
  /**
   * @private
   * @static
   * @param {any} panneau sélecteur ou jQuery
   * @param {any} bouton sélecteur ou jQuery
   */
  static _fermer(panneau, bouton) {
    $(panneau).prop("hidden", true);
    $(bouton).attr("aria-expanded", "false");
  }
  /**
   * @static
   * @method basculer
   * @param {{mes: Boolean, alliance: Boolean}} sections
   */
  static basculer(sections) {
    let $panneau = $("#o_gifPanneau"),
      ouvrir = $panneau.prop("hidden");
    if (ouvrir) ChatGif._fermer("#o_smileysPanneau", "#o_smileysBouton");
    $panneau.prop("hidden", !ouvrir);
    $("#o_gifBouton").attr("aria-expanded", String(ouvrir));
    if (ouvrir) ChatGif.dessiner(sections);
  }
  /**
   * Panneau des smileys de l'alliance d'un champ ; celui des GIF se ferme.
   *
   * @static
   * @method basculerSmileys
   * @param {PosteSmileys} poste
   */
  static basculerSmileys(poste) {
    let ouvrir = poste.$panneau.prop("hidden");
    if (ouvrir) ChatGif._fermer("#o_gifPanneau", "#o_gifBouton");
    poste.$panneau.prop("hidden", !ouvrir);
    poste.$bouton.attr("aria-expanded", String(ouvrir));
    if (!ouvrir) return;
    poste.$panneau.html(`<div class="o_smileysAlliance"></div>`);
    ChatGif.afficherAlliance("smileys", poste);
  }
  /**
   * @static
   * @method dessiner
   * @param {{mes: Boolean, alliance: Boolean}} sections
   */
  static dessiner(sections) {
    let $panneau = $("#o_gifPanneau").empty();
    if (sections.mes)
      ChatGif._montrerMes(
        ChatGif._section("mes", "Mes GIF").addClass("o_gifMes").appendTo($panneau),
      );
    if (sections.alliance) {
      ChatGif._section("alliance", "GIF de l'alliance")
        .append(`<div class="o_gifAlliance"></div>`)
        .appendTo($panneau);
      ChatGif.afficherAlliance();
    }
  }
  /**
   * Liste dépliable du panneau (titre cliquable), repliée si le joueur l'a
   * laissée repliée.
   *
   * @private
   * @static
   * @param {String} cle "mes", "alliance" ou "smileys:<titre>"
   * @param {String} titre
   * @return {any} jQuery
   */
  static _section(cle, titre) {
    let $section = $(
      `<details class="o_gifSection"><summary class="o_gifTitre gras"></summary></details>`,
    );
    $section.find("summary").text(titre);
    $section.prop("open", !Utils.lireStockage(CLE_GIF_REPLIEES)[cle]);
    $section.on("toggle", () => {
      let repliees = Utils.lireStockage(CLE_GIF_REPLIEES);
      repliees[cle] = !$section.prop("open");
      try {
        localStorage.setItem(CLE_GIF_REPLIEES, JSON.stringify(repliees));
      } catch (e) {}
    });
    return $section;
  }
  /**
   * @private
   * @static
   * @param {any} $section
   */
  static _montrerMes($section) {
    $section.find(".o_gifGrille, .o_gifNote").remove();
    let liste = ChatGif.mesGif();
    if (!liste.length) {
      $section.append(
        `<p class="reduce o_gifNote">Les GIF que tu envoies avec [img]adresse du GIF[/img] s'ajoutent ici.</p>`,
      );
      return;
    }
    $section.append(
      ChatGif.grille(liste, (adresse) => {
        ChatGif.retirer(adresse);
        ChatGif._montrerMes($section);
      }),
    );
  }
  /**
   * Vignettes cliquables ; avec `retirer`, une croix sur chacune.
   *
   * @static
   * @method grille
   * @param {Array<String>} adresses
   * @param {(adresse: String) => void} [retirer]
   * @return {any} jQuery
   */
  static grille(adresses, retirer) {
    let $grille = $(`<div class="o_gifGrille"></div>`);
    adresses.forEach((adresse, i) => {
      let $case = $(`<span class="o_gifCase">
          <button type="button" class="o_gifChoix" title="Mettre ce GIF dans le message"><img loading="lazy" alt=""/></button>
        </span>`);
      $case.find("img").attr({ src: adresse, alt: `GIF ${i + 1}` });
      $case.find(".o_gifChoix").on("click", (e) => {
        e.preventDefault();
        ChatGif.choisir(adresse);
      });
      if (retirer)
        $(
          `<button type="button" class="o_gifRetirer" title="Retirer de Mes GIF" aria-label="Retirer de Mes GIF">×</button>`,
        )
          .on("click", (e) => {
            e.preventDefault();
            retirer(adresse);
          })
          .appendTo($case);
      $grille.append($case);
    });
    return $grille;
  }
  /**
   * Petites icônes de smileys de l'alliance ; le code de chacun en info-bulle.
   *
   * @static
   * @method grilleSmileys
   * @param {Array<Smiley>} smileys
   * @param {PosteSmileys} poste champ où un clic écrit le code
   * @return {any} jQuery
   */
  static grilleSmileys(smileys, poste) {
    let $grille = $(`<div class="o_smileysGrille"></div>`);
    smileys.forEach((smiley) => {
      let code = `{${smiley.nom}}`,
        $choix = $(
          `<button type="button" class="o_smileyChoix"><img loading="lazy" alt=""/></button>`,
        ).attr("title", code);
      $choix.find("img").attr({ src: smiley.adresse, alt: code });
      $choix.on("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        ChatGif.choisirSmiley(smiley, poste);
      });
      $grille.append($choix);
    });
    return $grille;
  }
  /**
   * GIF mis dans le message du chat, puis son panneau se ferme.
   *
   * @static
   * @method choisir
   * @param {String} adresse
   */
  static choisir(adresse) {
    let champ = /** @type {HTMLInputElement} */ ($("#message")[0]),
      liste = ChatGif._liste("gif");
    if (!champ) return;
    if (!ChatGif.inserer(champ, adresse)) {
      ChatGif._tropLong(champ, liste.ce);
      return;
    }
    ChatGif._fermer(liste.panneau, liste.bouton);
  }
  /**
   * Code du smiley mis dans le message, puis son panneau se ferme.
   *
   * @static
   * @method choisirSmiley
   * @param {Smiley} smiley
   * @param {PosteSmileys} poste
   */
  static choisirSmiley(smiley, poste) {
    if (!ChatGif.insererCode(poste.champ, smiley.nom)) {
      ChatGif._tropLong(poste.champ, ChatGif._liste("smileys").ce);
      return;
    }
    ChatGif._fermer(poste.$panneau, poste.$bouton);
  }
  /**
   * @private
   * @static
   * @param {HTMLInputElement|HTMLTextAreaElement} champ
   * @param {String} ce « ce GIF », « ce smiley »
   */
  static _tropLong(champ, ce) {
    $.toast({
      ...TOAST_WARNING,
      text: `Message trop long pour y ajouter ${ce} (${numeral(champ.maxLength).format()} caractères au plus).`,
    });
  }
  /**
   * @static
   * @method afficherAlliance
   * @param {String} [type] "gif" ou "smileys"
   * @param {PosteSmileys|null} [poste] smileys : le champ et son panneau
   */
  static afficherAlliance(type = "gif", poste = null) {
    let liste = ChatGif._liste(type),
      $zone = poste ? poste.$panneau.find(liste.zone) : $(`${liste.panneau} ${liste.zone}`);
    $zone.html(`<p class="reduce o_gifNote">Lecture du forum…</p>`);
    return ChatGif._lecture(type).then(
      (r) => ChatGif._montrerAlliance($zone, r, type, poste),
      (e) => {
        let absente = e && e.message == "absente",
          lue = ChatGif._lue(type);
        if (typeof Journal != "undefined")
          Journal.erreur(
            type == "smileys" ? "Smileys" : "GIF",
            `sujet des ${liste.nom} de l'alliance illisible`,
            e && e.message,
          );
        $zone.empty();
        if (lue) ChatGif._montrerAlliance($zone, lue, type, poste);
        $zone.prepend(
          `<p class="reduce red o_gifNote">${absente ? SECTION_INTROUVABLE : `Forum de l'alliance illisible${lue ? " : dernière lecture affichée" : ""}.`}</p>`,
        );
      },
    );
  }
  /**
   * Smileys de l'alliance sous leurs titres dépliables, comme les listes de
   * GIF ; ceux d'avant le premier titre, sans titre.
   *
   * @private
   * @static
   * @param {any} $zone
   * @param {Array<SectionSmileys>} sections
   * @param {PosteSmileys} poste
   */
  static _montrerSmileys($zone, sections, poste) {
    sections.forEach((section) => {
      let $grille = ChatGif.grilleSmileys(section.smileys, poste);
      if (section.titre)
        ChatGif._section(`smileys:${ChatGif.codeSmiley(section.titre)}`, section.titre)
          .append($grille)
          .appendTo($zone);
      else $zone.append($grille);
    });
  }
  /**
   * @private
   * @static
   * @param {any} $zone
   * @param {{gifs: Array<String>, ignores: Number, absent?: Boolean}} r
   * @param {String} [type] "gif" ou "smileys"
   * @param {PosteSmileys|null} [poste] smileys : le champ et son panneau
   */
  static _montrerAlliance($zone, r, type = "gif", poste = null) {
    let liste = ChatGif._liste(type),
      sections = type == "smileys" && poste ? ChatGif.sectionsLues(r) : [];
    $zone.empty();
    if (r.absent) {
      $zone.append(
        `<p class="reduce o_gifNote">Pas de sujet « ${liste.titre} » dans la section « ${FORUM_SECTIONS_CHASSES[0]} » du forum. Crée-le et mets les adresses des ${liste.nom} dans son premier message (n'y réponds pas : le premier message ne serait plus modifiable).</p>`,
      );
      return;
    }
    if (sections.length && poste) ChatGif._montrerSmileys($zone, sections, poste);
    else if (type != "smileys" && r.gifs.length) $zone.append(ChatGif.grille(r.gifs));
    else
      $zone.append(
        `<p class="reduce o_gifNote">Aucune adresse d'image dans le premier message du sujet « ${liste.titre} ».</p>`,
      );
    if (r.ignores)
      $zone.append(
        `<p class="reduce o_gifNote">${numeral(r.ignores).format()} lien${r.ignores > 1 ? "s" : ""} du sujet ne mène${r.ignores > 1 ? "nt" : ""} pas à une image : l'adresse doit finir par .gif, .webp, .png ou .jpg (clic droit sur ${liste.image}, « Copier l'adresse de l'image »).</p>`,
      );
  }
}
