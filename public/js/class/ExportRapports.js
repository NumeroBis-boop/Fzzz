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
// source des entrées du journal de l'extension
const JOURNAL_EXPORT = "Export Google Sheet";
// dégâts de base sous lesquels l'arrondi du jeu fausse le niveau d'arme
const EXPORT_DEGATS_MIN = 100;
// un script déployé avant une requête la refuse (« requête invalide »)
const SCRIPT_PAS_A_JOUR =
  "le script du Google Sheet n'est pas à jour (la personne qui gère le fichier doit y recoller le code et déployer une nouvelle version)";

// colonnes d'un combat ou d'une prise (onglet « Flood internes »)
const ENTETES_INTERNES = [
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
// niveaux de l'ennemi tirés du RC (ExportRapports.ennemi)
const ENTETES_ENNEMI = ["Arme", "Bouclier", "Dôme", "Loge"];
// onglets d'attaques et de défenses : niveaux de l'ennemi après les pertes
const ENTETES_COMBATS = [
  ...ENTETES_INTERNES.slice(0, ENTETES_INTERNES.indexOf("Troupes en attaque")),
  ...ENTETES_ENNEMI,
  ...ENTETES_INTERNES.slice(ENTETES_INTERNES.indexOf("Troupes en attaque")),
];

/**
 * Onglets du fichier et leurs colonnes, dans l'ordre des valeurs envoyées. Le
 * script du fichier crée l'onglet et ses titres au premier envoi, et ajoute à
 * la fin une colonne qu'il ne connaît pas. Les combats vont dans « BDD
 * attaques » ou « BDD défenses » selon le camp du joueur qui exporte, ou dans
 * « Flood internes » contre un membre de l'alliance (même clé vu des deux
 * camps : une seule ligne).
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
  interne: { onglet: "Flood internes", entetes: ENTETES_INTERNES },
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
 * Requêtes : au clic seulement, vérification auprès du script des RC déjà
 * exportés, lecture une à une des conversations dont un RC manque au fichier
 * (comme leur ouverture dans le jeu), puis envoi au script.
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
   * @return {{signature: String, date: String, camp: String, adversaire: String, ennemi: Object<String, Number|String>, valeurs: Array}|null}
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
      connu = !!(attaquant || defenseur),
      camp = !connu ? "" : jAttaque ? "attaque" : "defense";
    lieu = ExportRapports.lieu(lieu);
    return {
      signature: ["combat", date, attaque, defense].map(ExportRapports.comparable).join("|"),
      date,
      camp,
      adversaire: !connu ? "" : jAttaque ? defenseur : attaquant,
      ennemi: ExportRapports.ennemi(texte, camp, lieu),
      valeurs: [
        pseudo,
        date,
        "Combat",
        attaquant,
        defenseur,
        lieu,
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
   * Niveaux de l'ennemi tirés du premier tour d'un combat vu du joueur : son
   * arme d'après le bonus de ses dégâts ; son bouclier d'après la vie qu'il
   * perd sous les dégâts du joueur, quand il n'a pas de bonus de lieu (il
   * attaque, ou défend son terrain de chasse). Dans sa fourmilière ou sa loge,
   * le RC ne donne que le bonus de vie total (bouclier + lieu) : niveaux du
   * dôme ou de la loge possibles pour un bouclier de son arme − 3 à son arme
   * + 2, comme l'analyse sous le RC. Une valeur reste vide quand le RC ne
   * permet pas de la connaître sûrement (aucune perte ou armée entière tuée au
   * premier tour, dégâts trop faibles, nombres qui ne collent pas).
   *
   * @static
   * @method ennemi
   * @param {String} texte RC, espaces ramenés (espaces())
   * @param {String} camp camp du joueur : "attaque", "defense" ou "" (inconnu)
   * @param {String} lieu lieu du combat, d'après lieu()
   * @return {Object<String, Number|String>} valeur par colonne de ENTETES_ENNEMI
   */
  static ennemi(texte, camp, lieu) {
    /** @type {Object<String, Number|String>} */
    let niveaux = Object.fromEntries(ENTETES_ENNEMI.map((t) => [t, ""]));
    // armée d'occupation : l'armée combattue n'est pas celle du joueur nommé
    if (!camp || /armée d['’]occupation/.test(texte)) return niveaux;
    try {
      let N = EXPORT_NOMBRE,
        siens = new RegExp(`ennemie inflige\\s+${N}\\(\\s*\\+\\s*${N}\\)\\s*dégâts`).exec(texte),
        arme = -1;
      if (siens) {
        let base = ExportRapports.nombre(siens[1]),
          a = (10 * ExportRapports.nombre(siens[2])) / base;
        if (base >= EXPORT_DEGATS_MIN && Math.abs(a - Math.round(a)) <= 0.2) arme = Math.round(a);
      }
      if (arme >= 0) niveaux.Arme = arme;
      // l'attaquant n'a jamais de bonus de lieu ; colonie ou lieu inconnu : pas de calcul
      let bonusLieu =
        camp == "defense"
          ? "aucun"
          : { "Terrain de chasse": "aucun", Fourmilière: "Dôme", Loge: "Loge" }[lieu];
      if (!bonusLieu) return niveaux;
      let miens = new RegExp(
          `Vous infligez\\s+${N}\\(\\s*\\+\\s*${N}\\)\\s*dégâts et tuez\\s+${N}`,
        ).exec(texte),
        troupes = ExportRapports.troupes(texte, camp == "attaque" ? "défense" : "attaque");
      if (!miens || !troupes) return niveaux;
      let avant = new Armee(),
        apres = new Armee(),
        tuees = ExportRapports.nombre(miens[3]);
      avant.parseArmee(troupes);
      if (tuees <= 0 || tuees >= avant.getSommeUnite()) return niveaux;
      apres.unite = avant.unite.slice(0);
      apres.retirerPerte(tuees);
      // les dégâts de trop entament l'unité suivante sans la tuer : à une unité près
      let vie = avant.getBaseVie() - apres.getBaseVie(),
        unite = VIE_UNITE[apres.unite.findIndex((n) => n > 0) + 1],
        multiplicateur = (ExportRapports.nombre(miens[1]) + ExportRapports.nombre(miens[2])) / vie;
      if (!(vie > unite)) return niveaux;
      let bas = (multiplicateur * vie) / (vie + unite),
        haut = (multiplicateur * vie) / (vie - unite),
        // a × multiplicateur − b, s'il n'a qu'une valeur entière possible (sinon -1)
        entier = (/** @type {Number} */ a, /** @type {Number} */ b) =>
          ExportRapports._entierUnique(a * bas - b, a * haut - b);
      // vie : bouclier +10 % par niveau ; dôme 10 % puis 5 % par niveau ; loge 30 %
      // puis 15 % par niveau (descriptions du jeu)
      if (bonusLieu == "aucun") {
        let bouclier = entier(10, 10);
        if (bouclier >= 0) niveaux.Bouclier = bouclier;
        return niveaux;
      }
      // 2 × bouclier + dôme, ou 2 × bouclier + 3 × loge
      let somme = bonusLieu == "Dôme" ? entier(20, 22) : entier(20, 26),
        possibles = [];
      if (somme < 0 || arme < 0) return niveaux;
      for (let bouclier = Math.max(0, arme - 3); bouclier <= arme + 2; bouclier++) {
        let reste = somme - 2 * bouclier,
          niveau = bonusLieu == "Dôme" ? reste : reste / 3;
        if (reste >= 0 && Number.isInteger(niveau))
          possibles.push(`${niveau} (bouclier ${bouclier})`);
      }
      niveaux[bonusLieu] = possibles.join(" · ");
    } catch (e) {
      // un RC inattendu n'empêche pas son export
      Journal.erreur(JOURNAL_EXPORT, "niveaux de l'ennemi non calculés", String(e));
    }
    return niveaux;
  }
  /**
   * Seul entier de [bas, haut] (à 0,1 près, nombres arrondis du RC), sinon -1.
   *
   * @private
   * @static
   * @param {Number} bas
   * @param {Number} haut
   * @return {Number}
   */
  static _entierUnique(bas, haut) {
    let min = Math.ceil(bas - 0.1),
      max = Math.floor(haut + 0.1);
    return min == max && min >= 0 ? min : -1;
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
   * @return {{signature: String, date: String, camp: String, adversaire: String, valeurs: Array}|null}
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
    let jAttaque = attaquant.toLowerCase() == pseudo.toLowerCase();
    return {
      signature: ["prise", date, attaquant, defenseur, terrain, nourriture, materiaux]
        .map((v) => ExportRapports.comparable(String(v)))
        .join("|"),
      date,
      camp: jAttaque ? "attaque" : "defense",
      adversaire: jAttaque ? defenseur : attaquant,
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
   * sa clé, avec son onglet (chasse ; interne contre un membre de l'alliance ;
   * sinon attaque ou défense : le camp du joueur d'après le RC, à défaut
   * d'après le titre de la conversation). Deux RC identiques (même minute,
   * mêmes armées, ou même prise) sont distingués par leur rang, dans l'ordre
   * des messages.
   *
   * @static
   * @method lignes
   * @param {String} type "chasse" ou "combat"
   * @param {Array} conversations [{id, titre, camp?, messages: [{id, date, texte}]}]
   * @param {String} pseudo
   * @param {Set<String>} [membres] pseudos des membres de l'alliance, en minuscules
   * @return {Array<{onglet: String, conversation: Number, ligne: Array}>} ligne : [clé, ...valeurs]
   */
  static lignes(type, conversations, pseudo, membres = new Set()) {
    /** @type {Array<{id: Number, conversation: Number, onglet: String, rc: {signature: String, date: String, valeurs: Array}}>} */
    let rcs = [];
    conversations.forEach((c) => {
      let titreUtilise = false;
      c.messages.forEach(
        (/** @type {{id: Number, date: String, texte: String, rc?: String}} */ m) => {
          if (type == "chasse") {
            let rc = ExportRapports.chasse(m.texte, m.date, pseudo);
            if (rc)
              rcs.push({
                id: m.id,
                conversation: c.id,
                onglet: "chasse",
                rc: ExportRapports._texteAffiche(rc, m),
              });
            return;
          }
          let rc =
            ExportRapports.combat(m.texte, m.date, pseudo) ||
            ExportRapports.prise(m.texte, m.date, pseudo, titreUtilise ? "" : c.titre);
          if (!rc) return;
          if (rc.valeurs[2] == "Prise") titreUtilise = true;
          let interne = !!rc.adversaire && membres.has(rc.adversaire.toLowerCase());
          rcs.push({
            id: m.id,
            conversation: c.id,
            onglet: interne ? "interne" : rc.camp || c.camp || "attaque",
            rc: ExportRapports._texteAffiche(rc, m),
          });
        },
      );
    });
    let rangs = new Map();
    return rcs
      .sort((a, b) => a.id - b.id)
      .map(({ onglet, conversation, rc }) => {
        let cleRang = onglet + "|" + rc.signature,
          rang = (rangs.get(cleRang) || 0) + 1;
        rangs.set(cleRang, rang);
        let cle = `${rc.date}|${ExportRapports.empreinte(rc.signature)}${rang > 1 ? "|" + rang : ""}`;
        return { onglet, conversation, ligne: ExportRapports._ligne(onglet, cle, rc) };
      });
  }
  /**
   * Valeurs dans l'ordre des colonnes de l'onglet : celles d'un combat ou d'une
   * prise (ENTETES_INTERNES), et les niveaux de l'ennemi dans les onglets des
   * attaques et des défenses.
   *
   * @private
   * @static
   * @param {String} onglet clé de EXPORTS_RAPPORTS
   * @param {String} cle
   * @param {{valeurs: Array, ennemi?: Object<String, Number|String>}} rc
   * @return {Array}
   */
  static _ligne(onglet, cle, rc) {
    if (onglet == "chasse" || onglet == "interne") return [cle, ...rc.valeurs];
    let valeurs = new Map(ENTETES_INTERNES.slice(1).map((t, i) => [t, rc.valeurs[i]]));
    ENTETES_ENNEMI.forEach((t) => valeurs.set(t, (rc.ennemi || {})[t] ?? ""));
    return [cle, ...ENTETES_COMBATS.slice(1).map((t) => valeurs.get(t))];
  }
  /**
   * Colonne « RC » (la dernière) : texte affiché du message, images comprises,
   * quand il est connu ; la clé et les valeurs restent celles du texte lu.
   *
   * @private
   * @static
   * @param {{valeurs: Array}} rc
   * @param {{rc?: String}} message
   * @return {any} rc
   */
  static _texteAffiche(rc, message) {
    if (message.rc)
      rc.valeurs[rc.valeurs.length - 1] = ExportRapports.texteRC(
        ExportRapports.espaces(message.rc),
      );
    return rc;
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
        // colonne « RC » : texte des icônes, comme à la copie (« 62 572 de
        // nourriture ») ; la lecture du RC se fait sans
        let $affiche = $message.clone();
        $affiche
          .find("img")
          .each((i, img) =>
            $(img).replaceWith(` ${img.getAttribute("alt") || img.getAttribute("title") || ""}`),
          );
        return {
          id: parseInt((tr.id.match(/\d+/) || ["0"])[0]),
          date: ExportRapports.date($(tr).find(".expe").first().text()),
          texte: $message.text(),
          rc: $affiche
            .text()
            .replace(
              /(\d)\s+(?:de\s+)?(nourriture|mat[ée]riaux)\b/gi,
              (/** @type {String} */ t, /** @type {String} */ chiffre, /** @type {String} */ mot) =>
                `${chiffre} de ${mot.toLowerCase().replace("materiaux", "matériaux")}`,
            ),
        };
      })
      .filter((m) => m.id && m.texte.trim());
  }
  /**
   * @private
   * @static
   * @param {String} type
   */
  static _cleMemoire(type) {
    return `fzzz_exportCles_${type}_${Utils.serveur}_${String(monProfil.pseudo || "").toLowerCase()}`;
  }
  /**
   * Clés des RC déjà exportés depuis ce navigateur, par numéro de conversation.
   * Elles évitent de relire une conversation dont tous les RC sont dans le
   * fichier ; le fichier fait foi (voir absentes).
   *
   * @static
   * @method memoire
   * @param {String} type
   * @return {Object<string, Array<String>>}
   */
  static memoire(type) {
    let m = Utils.lireStockage(ExportRapports._cleMemoire(type), {});
    return m && typeof m == "object" && !Array.isArray(m) ? m : {};
  }
  /**
   * @static
   * @method memoriser
   * @param {String} type
   * @param {Object<string, Array<String>>} parConversation clés envoyées, par conversation
   */
  static memoriser(type, parConversation) {
    let m = Object.assign(ExportRapports.memoire(type), parConversation),
      gardees = Object.keys(m)
        .map(Number)
        .sort((a, b) => b - a)
        .slice(0, EXPORT_MAX_CONVERSATIONS),
      /** @type {Object<string, Array<String>>} */
      reste = {};
    gardees.forEach((id) => (reste[id] = m[id]));
    try {
      localStorage.setItem(ExportRapports._cleMemoire(type), JSON.stringify(reste));
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
        Journal.info(
          JOURNAL_EXPORT,
          `forum lu : ${r.joueurs.length} joueur(s) dans la liste, toi ${autorise ? "dedans" : "hors liste"}, adresse de l'alliance ${r.adresse ? "postée" : "absente"}`,
        );
        // texte JSON : gardé tel quel par tous les gestionnaires de scripts
        return ExportRapports._garder(
          CLE_EXPORT_SHEET_ALLIANCE,
          autorise ? JSON.stringify({ pseudo, adresse }) : "",
        ).then(() => ({ autorise, adresse }));
      },
      (e) =>
        ExportRapports._lire(CLE_EXPORT_SHEET_ALLIANCE).then((texte) => {
          let c = null;
          try {
            c = JSON.parse(texte);
          } catch (e) {}
          Journal.noter(
            "alerte",
            JOURNAL_EXPORT,
            `forum de l'alliance illisible : ${pseudo && c && c.pseudo == pseudo ? "dernière lecture gardée utilisée" : "aucune lecture gardée"}`,
            e,
          );
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
   * Pseudos des membres de l'alliance du joueur (minuscules), d'après l'export
   * public des joueurs du jeu (refait chaque heure) : un RC contre l'un d'eux
   * va dans « Flood internes ». Sans alliance : aucun.
   *
   * @static
   * @method membres
   * @return {Promise<Set<String>>} rejetée avec un message pour le joueur
   */
  static membres() {
    let tag = String(Utils.alliance || "")
        .trim()
        .toLowerCase(),
      moi = String(monProfil.pseudo || "").toLowerCase();
    if (!tag) return Promise.resolve(new Set());
    return ExportJoueurs.lire().then(
      (index) => {
        let membres = new Set();
        index.forEach((j, p) => {
          if (String(j.alliance || "").toLowerCase() == tag) membres.add(p.toLowerCase());
        });
        // export pas encore à jour (arrivée récente) : un flood interne serait mal rangé
        if (!membres.has(moi))
          throw new Error(
            "ton alliance n'apparaît pas encore dans l'export public des joueurs du jeu (refait chaque heure), qui sert à reconnaître les floods internes",
          );
        return membres;
      },
      () => {
        throw new Error(
          "l'export public des joueurs du jeu ne répond pas (il sert à reconnaître les floods internes) ; réessaie dans un instant",
        );
      },
    );
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
    let quoi =
        corps && corps.statistiques
          ? "statistiques de la synthèse"
          : corps && corps.verifier
            ? "vérification des RC déjà exportés"
            : corps && corps.onglet
              ? `envoi de ${(corps.lignes || []).length} ligne(s) à « ${corps.onglet} »`
              : "test du script",
      echec = (/** @type {String} */ message, /** @type {any} */ r) => {
        // statut, réponse du script, ou texte de la page d'erreur de Google
        Journal.erreur(
          JOURNAL_EXPORT,
          `${quoi} : ${message}`,
          r && { statut: r.statut, reponse: r.donnees, extrait: r.extrait, erreur: r.erreur },
        );
        return Promise.reject(new Error(message));
      };
    return Promise.resolve(chrome.runtime.sendMessage({ type: "fzzz_sheet", url, methode, corps }))
      .catch(() => ({ erreur: "reseau" }))
      .then((/** @type {any} */ r) => {
        if (!r || r.erreur == "reseau") return echec("le script du Google Sheet ne répond pas", r);
        if (r.erreur == "permission")
          return echec("le navigateur n'a pas accordé l'accès à script.google.com", r);
        if (r.erreur) return echec("adresse du script invalide", r);
        if (r.donnees && r.donnees.erreur)
          return echec(`le script refuse : ${r.donnees.erreur}`, r);
        if (!r.ok || !r.donnees || typeof r.donnees != "object")
          return echec(`réponse inattendue du script (erreur ${r.statut || "?"})`, r);
        return r.donnees;
      });
  }
  /**
   * Pourquoi aucun fichier n'est utilisable (export, synthèse).
   *
   * @static
   * @method sansAdresse
   * @param {Boolean} alliance joueur de la liste du forum caché
   * @param {Boolean} [illisible] forum caché pas lu
   * @return {String}
   */
  static sansAdresse(alliance, illisible) {
    return alliance
      ? `l'adresse du Google Sheet de l'alliance n'est pas encore postée dans le forum caché (sujet « ${TITRE_EXPORT_SHEET} »)`
      : illisible
        ? `le forum de l'alliance n'a pas pu être lu (liste des joueurs autorisés à partager des RC, sujet « ${TITRE_EXPORT_SHEET} »). Réessaie dans un instant`
        : `ton pseudo n'est pas dans la liste des joueurs autorisés à partager des RC (forum caché, sujet « ${TITRE_EXPORT_SHEET} ») et aucune adresse de Google Sheet n'est renseignée dans Préférences → Messagerie`;
  }
  /**
   * Statistiques du joueur sur une période, calculées par le script du fichier
   * (les mêmes que son onglet « Statistiques ») : onglet « Synthèse » des
   * « Outils pour Chasseur ».
   *
   * @static
   * @method statistiques
   * @param {String} debut premier jour compris, "AAAA-MM-JJ"
   * @param {String} fin dernier jour compris, "AAAA-MM-JJ"
   * @return {Promise<any>} voir statistiques() dans google-sheet/export-rapports.gs
   */
  static statistiques(debut, fin) {
    if (!monProfil.pseudo) return Promise.reject(new Error("pseudo du joueur introuvable"));
    return ExportRapports.cible()
      .then(({ url, alliance, illisible }) => {
        if (!ExportRapports.adresseValide(url))
          throw new Error(ExportRapports.sansAdresse(alliance, !!illisible));
        return ExportRapports.requete(url, "POST", {
          statistiques: true,
          joueur: monProfil.pseudo,
          debut,
          fin,
        });
      })
      .then(
        (r) => {
          if (!r || !r.statistiques || !Array.isArray(r.statistiques.resume))
            throw new Error("réponse inattendue du script");
          return r.statistiques;
        },
        (e) => {
          if (/requête invalide/.test(e && e.message)) throw new Error(SCRIPT_PAS_A_JOUR);
          throw e;
        },
      );
  }
  /**
   * Parmi les clés de RC déjà exportés, celles que le fichier n'a plus (ligne
   * effacée, onglet vidé) : leurs conversations sont relues. Le script remet
   * aussi ces onglets en lignes compactes.
   *
   * @static
   * @method absentes
   * @param {String} type "chasse" ou "combat"
   * @param {Array<String>} cles
   * @param {String} url
   * @return {Promise<Set<String>>}
   */
  static absentes(type, cles, url) {
    if (!cles.length) return Promise.resolve(new Set());
    let onglets = (type == "chasse" ? ["chasse"] : ["attaque", "defense", "interne"]).map(
      (o) => EXPORTS_RAPPORTS[o].onglet,
    );
    return ExportRapports.requete(url, "POST", { verifier: true, onglets, cles }).then(
      (r) => {
        if (!Array.isArray(r.absentes)) throw new Error("réponse inattendue du script");
        return new Set(r.absentes.map(String));
      },
      (e) => {
        // script d'avant cette vérification : il refuse la requête
        if (/requête invalide/.test(e.message)) throw new Error(SCRIPT_PAS_A_JOUR);
        throw e;
      },
    );
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
   * ce type listées dans la messagerie dont un RC manque au fichier (jamais
   * exportée, ou ligne effacée depuis), lues une à une, puis envoyées au
   * fichier, onglet par onglet. Les clés d'une conversation ne sont retenues
   * qu'une fois ses RC acceptés par le fichier.
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
            text: `Export impossible : ${ExportRapports.sansAdresse(alliance, illisible)}.`,
          });
          return;
        }
        let memoire = ExportRapports.memoire(type),
          listees = $("tr.en_tete_message[id^='conversation_']")
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
            .filter((c) => c.id);
        let connues = listees.flatMap((c) => memoire[c.id] || []);
        return ExportRapports.absentes(type, connues, url).then((absentes) => {
          let aLire = listees.filter(
            (c) => !memoire[c.id] || memoire[c.id].some((cle) => absentes.has(cle)),
          );
          Journal.info(
            JOURNAL_EXPORT,
            `Export des ${quoi} vers le fichier ${alliance ? "de l'alliance" : "personnel"} : ${listees.length} conversation(s) listée(s), ${connues.length} RC déjà exporté(s) dont ${absentes.size} absent(s) du fichier, ${aLire.length} conversation(s) à lire`,
          );
          return ExportRapports._exporterListees(type, aLire, url);
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
  /**
   * Lit les conversations à exporter, puis envoie leurs RC au fichier.
   *
   * @private
   * @static
   * @param {String} type
   * @param {Array<{id: Number, titre: String, camp: String}>} aLire
   * @param {String} url
   * @return {Promise}
   */
  static _exporterListees(type, aLire, url) {
    let pseudo = monProfil.pseudo,
      quoi = type == "chasse" ? "chasses" : "RC";
    if (!aLire.length) {
      $.toast({
        ...TOAST_INFO,
        text: `Aucun nouveau ${type == "chasse" ? "rapport de chasse" : "RC"} à exporter dans la liste de la messagerie.`,
      });
      return Promise.resolve();
    }
    let lues = [],
      echecs = 0,
      membres = new Set();
    // membres lus avant les conversations : sans eux, pas de lecture
    return (type == "combat" ? ExportRapports.membres() : Promise.resolve(new Set()))
      .then((m) => {
        membres = m;
        if (type == "combat")
          Journal.info(
            JOURNAL_EXPORT,
            `membres de l'alliance (export public des joueurs) : ${m.size}`,
          );
        $.toast({
          ...TOAST_INFO,
          hideAfter: false,
          text: `Export des ${quoi} : lecture des conversations, une à une (le jeu n'en sert qu'une à la fois) <strong id='o_exportProgres'>0/${aLire.length}</strong>`,
        });
        return aLire.reduce(
          (suite, c, k) =>
            suite.then(() =>
              ExportRapports.messages(c.id)
                .then(
                  (messages) => lues.push({ ...c, messages }),
                  (e) => {
                    echecs++;
                    Journal.erreur(
                      JOURNAL_EXPORT,
                      `conversation ${c.id} illisible (« ${c.titre} »)`,
                      e,
                    );
                  },
                )
                .then(() => $("#o_exportProgres").text(`${k + 1}/${aLire.length}`)),
            ),
          Promise.resolve(),
        );
      })
      .then(() => {
        let lignes = ExportRapports.lignes(type, lues, pseudo, membres),
          // conversations sans RC reconnu : pas retenues, relues au prochain export
          /** @type {Object<string, Array<String>>} */
          parConversation = {},
          onglets = [...new Set(lignes.map((l) => l.onglet))],
          bilans = /** @type {Array<{onglet: String, ajoutees: Number, deja: Number}>} */ ([]);
        lignes.forEach((l) =>
          (parConversation[l.conversation] = parConversation[l.conversation] || []).push(
            l.ligne[0],
          ),
        );
        Journal.info(
          JOURNAL_EXPORT,
          `${lues.length} conversation(s) lue(s) : ${lignes.length} RC reconnu(s) (${onglets.map((o) => `${lignes.filter((l) => l.onglet == o).length} pour « ${EXPORTS_RAPPORTS[o].onglet} »`).join(", ") || "aucun"}), ${lues.length - Object.keys(parConversation).length} sans RC reconnu`,
        );
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
            ExportRapports.memoriser(type, parConversation);
            let sansRC = lues.length - Object.keys(parConversation).length,
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
  }
}
