// @ts-check
/*
 * Journal.js
 * Fzzz
 **********************************************************************/

// entrées gardées dans ce navigateur, toutes pages confondues
const JOURNAL_MAX = 200;
const CLE_JOURNAL = "fzzz_journal";
const JOURNAL_MESSAGE_MAX = 400;
const JOURNAL_DETAIL_MAX = 1200;
// même entrée revenue dans ce délai (ms) : comptée au lieu d'être recopiée
const JOURNAL_REPETITION = 60000;
const NIVEAUX_JOURNAL = { erreur: "ERREUR", alerte: "ALERTE", succes: "OK", info: "INFO" };
// en-têtes génériques des notifications (TOAST_*) : la source devient « Notification »
const TITRES_NOTIFICATION = ["Erreur", "Succès", "Attention", "Information"];
let journalInstalle = false;

/**
 * Journal de l'extension : ce qu'elle fait et ses erreurs, à copier pour les
 * signaler (boîte « Journal » sous l'encadré « Extension OUAF »). Rempli par
 * les notifications affichées, les erreurs écrites dans la console par
 * l'extension, les erreurs JavaScript non rattrapées et les étapes notées par
 * les modules. Adresses de script Google et codes masqués : le texte copié
 * peut être envoyé tel quel.
 *
 * @class Journal
 */
class Journal {
  /**
   * @static
   * @method noter
   * @param {String} niveau "erreur", "alerte", "succes" ou "info"
   * @param {String} source module concerné (« Export Google Sheet »…)
   * @param {any} message
   * @param {any} [detail] texte, erreur ou objet
   */
  static noter(niveau, source, message, detail = "") {
    try {
      let entree = {
          t: Journal._maintenant(),
          n: NIVEAUX_JOURNAL[niveau] ? niveau : "info",
          s: Journal._court(String(source || ""), 60),
          m: Journal._court(Journal.masquer(Journal.texteDe(message)), JOURNAL_MESSAGE_MAX),
          d: Journal._court(Journal.masquer(Journal.texteDe(detail)), JOURNAL_DETAIL_MAX),
          p: location.pathname.replace(/^\//, ""),
          v: Journal._version(),
          x: 1,
        },
        entrees = Journal.entrees(),
        derniere = entrees[0];
      if (
        derniere &&
        derniere.n == entree.n &&
        derniere.s == entree.s &&
        derniere.m == entree.m &&
        entree.t - derniere.t < JOURNAL_REPETITION
      ) {
        derniere.x = (derniere.x || 1) + 1;
        derniere.t = entree.t;
        if (entree.d) derniere.d = entree.d;
      } else entrees.unshift(entree);
      // trop d'entrées : les plus anciennes partent, les erreurs en dernier
      while (entrees.length > JOURNAL_MAX) {
        let k = entrees.length - 1;
        while (k > 0 && entrees[k].n == "erreur") k--;
        entrees.splice(entrees[k].n == "erreur" ? entrees.length - 1 : k, 1);
      }
      Journal._garder(entrees);
      document.dispatchEvent(new CustomEvent("fzzz_journal"));
    } catch (e) {}
  }
  /**
   * @static
   * @method erreur
   * @param {String} source
   * @param {any} message
   * @param {any} [detail]
   */
  static erreur(source, message, detail) {
    Journal.noter("erreur", source, message, detail);
  }
  /**
   * @static
   * @method info
   * @param {String} source
   * @param {any} message
   * @param {any} [detail]
   */
  static info(source, message, detail) {
    Journal.noter("info", source, message, detail);
  }
  /**
   * Entrées, de la plus récente à la plus ancienne.
   *
   * @static
   * @method entrees
   * @return {Array<{t: Number, n: String, s: String, m: String, d: String, p: String, v: String, x: Number}>}
   */
  static entrees() {
    try {
      let liste = JSON.parse(localStorage.getItem(CLE_JOURNAL) || "[]");
      return Array.isArray(liste) ? liste : [];
    } catch (e) {
      return [];
    }
  }
  /**
   * @static
   * @method vider
   */
  static vider() {
    try {
      localStorage.removeItem(CLE_JOURNAL);
    } catch (e) {}
    document.dispatchEvent(new CustomEvent("fzzz_journal"));
  }
  /**
   * Adresse de script Google (elle permet d'écrire dans le fichier), son
   * identifiant, et paramètres d'adresse qui portent un code ou un jeton.
   *
   * @static
   * @method masquer
   * @param {String} texte
   * @return {String}
   */
  static masquer(texte) {
    return String(texte == null ? "" : texte)
      .replace(
        /https?:\/\/script\.google(?:usercontent)?\.com\/[^\s"'<>]*/gi,
        "[adresse du script masquée]",
      )
      .replace(/AKfyc[\w-]{10,}/g, "[identifiant masqué]")
      .replace(/([?&;](?:code|mdp|motdepasse|password|pass|token|t|cle|key)=)[^&\s"'<>]+/gi, "$1…")
      .replace(/("(?:mot_de_passe|code|password|token)"\s*:\s*)"[^"]*"/gi, '$1"…"');
  }
  /**
   * Texte lisible d'un message ou d'un détail : erreur (nom, message, début
   * de la pile), réponse de requête jQuery, objet (JSON) ou texte.
   *
   * @static
   * @method texteDe
   * @param {any} valeur
   * @return {String}
   */
  static texteDe(valeur) {
    if (valeur == null) return "";
    if (valeur instanceof Error || (valeur && typeof valeur.stack == "string")) {
      let pile = String(valeur.stack || "")
        .split("\n")
        .filter((l) => l.trim() && !l.includes(valeur.message))
        .slice(0, 4)
        .join("\n");
      return `${valeur.name || "Error"}: ${valeur.message}${pile ? "\n" + pile : ""}`;
    }
    if (typeof valeur == "object" && "status" in valeur && "statusText" in valeur)
      return `requête HTTP ${valeur.status} ${valeur.statusText || ""}`.trim();
    if (typeof valeur == "object") {
      try {
        return JSON.stringify(valeur);
      } catch (e) {
        return String(valeur);
      }
    }
    return String(valeur);
  }
  /**
   * Texte à copier : versions, navigateur, page, puis les entrées.
   *
   * @static
   * @method texte
   * @return {String}
   */
  static texte() {
    let date = (/** @type {Number} */ t) => moment(t).format("DD/MM/YYYY HH:mm:ss"),
      entrees = Journal.entrees(),
      lignes = [
        `Journal ${Journal._nom()} v${Journal._version()}, copié le ${date(Journal._maintenant())} (heure du jeu)`,
        `Gestionnaire : ${Journal._gestionnaire()} | Navigateur : ${navigator.userAgent}`,
        `Page : ${location.origin}${location.pathname}`,
        `${entrees.length} entrée(s), de la plus récente à la plus ancienne :`,
      ];
    entrees.forEach((e) => {
      lignes.push(
        "",
        `${date(e.t)} [${NIVEAUX_JOURNAL[e.n] || e.n}] ${e.s} (${e.p || "?"}, v${e.v || "?"})${e.x > 1 ? ` ×${e.x}` : ""}`,
        `  ${e.m}`,
      );
      if (e.d) lignes.push(`  Détail : ${e.d.replace(/\n/g, "\n    ")}`);
    });
    return Journal.masquer(lignes.join("\n"));
  }
  /**
   * Note les notifications affichées, les erreurs écrites dans la console et
   * les erreurs JavaScript non rattrapées. Une seule fois par page.
   *
   * @static
   * @method installer
   */
  static installer() {
    if (journalInstalle) return;
    journalInstalle = true;
    let toast = $.toast;
    if (typeof toast == "function") {
      let notifier = function (/** @type {any} */ options) {
        Journal.depuisNotification(options);
        return toast.apply(this, arguments);
      };
      // $.toast.options : réglages lus par le module des notifications
      $.toast = Object.assign(notifier, toast);
    }
    ["error", "warn"].forEach((methode) => {
      let ecrire = console[methode];
      console[methode] = function (/** @type {Array} */ ...args) {
        let [premier, ...reste] = args;
        Journal.noter(
          methode == "error" ? "erreur" : "alerte",
          "Console",
          typeof premier == "string" ? premier : Journal.texteDe(premier),
          reste.map(Journal.texteDe).join("\n"),
        );
        return ecrire.apply(console, args);
      };
    });
    window.addEventListener("error", (e) => {
      let fichier = String(e.filename || "");
      Journal.noter(
        "erreur",
        /fourmizzz\.fr|googleapis/.test(fichier) ? "JavaScript du jeu" : "JavaScript",
        e.message || "erreur",
        [
          fichier && `${fichier.replace(/^.*\//, "")}${e.lineno ? ":" + e.lineno : ""}`,
          e.error ? Journal.texteDe(e.error) : "",
        ]
          .filter(Boolean)
          .join("\n"),
      );
    });
    window.addEventListener("unhandledrejection", (e) =>
      Journal.noter(
        "erreur",
        "JavaScript",
        "promesse rejetée sans traitement",
        Journal.texteDe(e.reason),
      ),
    );
  }
  /**
   * @static
   * @method depuisNotification
   * @param {any} options celles de $.toast (ou son texte)
   */
  static depuisNotification(options) {
    let o = typeof options == "string" ? { text: options } : options || {},
      niveau = { error: "erreur", warning: "alerte", success: "succes" }[o.icon] || "info",
      titre = Journal._texteHtml(o.heading),
      texte = Journal._texteHtml(Array.isArray(o.text) ? o.text.join(" ; ") : o.text);
    if (texte)
      Journal.noter(
        niveau,
        titre && !TITRES_NOTIFICATION.includes(titre) ? titre : "Notification",
        texte,
      );
  }
  /**
   * @private
   * @static
   * @param {any} html
   * @return {String}
   */
  static _texteHtml(html) {
    if (!html) return "";
    // DOMParser : rien n'est exécuté
    let doc = new DOMParser().parseFromString(String(html), "text/html");
    return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
  }
  /**
   * @private
   * @static
   * @param {String} texte
   * @param {Number} max
   * @return {String}
   */
  static _court(texte, max) {
    return texte.length > max ? texte.slice(0, max - 1) + "…" : texte;
  }
  /**
   * @private
   * @static
   * @param {Array} entrees
   */
  static _garder(entrees) {
    try {
      localStorage.setItem(CLE_JOURNAL, JSON.stringify(entrees));
    } catch (e) {
      // stockage plein : les plus récentes seulement
      try {
        localStorage.setItem(CLE_JOURNAL, JSON.stringify(entrees.slice(0, 20)));
      } catch (e2) {}
    }
  }
  /**
   * Heure du serveur ; celle du PC si l'horloge n'est pas encore chargée
   * (erreur pendant le chargement des scripts).
   *
   * @private
   * @static
   * @return {Number}
   */
  static _maintenant() {
    try {
      return Horloge.maintenant();
    } catch (e) {
      return Date.now();
    }
  }
  /**
   * @private
   * @static
   * @return {String}
   */
  static _version() {
    try {
      return VERSION;
    } catch (e) {
      return "";
    }
  }
  /**
   * @private
   * @static
   * @return {String}
   */
  static _nom() {
    try {
      return NOM_EXTENSION;
    } catch (e) {
      return "Extension OUAF";
    }
  }
  /**
   * @private
   * @static
   * @return {String}
   */
  static _gestionnaire() {
    try {
      return `${GM_info.scriptHandler || "gestionnaire de scripts"} ${GM_info.version || ""}`.trim();
    } catch (e) {
      return "extension du navigateur";
    }
  }
}
