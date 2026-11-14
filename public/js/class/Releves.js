// @ts-check
/*
 * Releves.js — version TEST seulement
 * Fzzz
 **********************************************************************/

/*
 * Relevés pour mesurer l'horloge, les départs et les arrivées (demande du
 * mainteneur, 14/11/2026, après l'annonce du jeu « Les horloges sont
 * réparées » : les mouvements seraient résolus « à la minute précise »). Ils
 * lisent les pages et les réponses que le jeu envoie déjà, sans requête ; seul
 * le calibrage en fait, au clic du joueur, vers une petite image du jeu.
 */
// relevés gardés dans ce navigateur ; les plus anciens partent
const RELEVES_MAX = 1000;
const CLE_RELEVES = "fzzz_releves";
// "0" : relevés arrêtés (case de la boîte Journal)
const CLE_RELEVES_ACTIFS = "fzzz_relevesActifs";
// messages de la Messagerie déjà relevés (identifiants)
const CLE_RELEVES_MESSAGES = "fzzz_relevesMessages";
const RELEVES_MESSAGES_MAX = 1000;
// journal et relevés pour tous les joueurs de la version TEST
const RELEVES_POUR_TOUS = true;
// calibrage : une image du jeu (aucune page PHP, rien n'est fait sur le compte) ;
// une pause qui n'est pas un multiple de la seconde fait changer l'en-tête Date
// (à la seconde) à un moment différent de chaque requête, ce qui resserre
// l'intervalle du décalage
const CALIBRAGE_REQUETES = 12;
const CALIBRAGE_PAUSE = 230;
const CALIBRAGE_IMAGE = "/images/crayon.gif";
// clic ou envoi de formulaire rattaché à la requête ou à la page qui suit dans ce délai
const RELEVES_DELAI_CLIC = 30000;
// boutons de l'extension qui lancent des attaques ou des chasses
const RELEVES_BOUTONS =
  "#o_lancerPartager, #o_sonder, #o_lanceFlood, #o_lanceFloodPartager, [id$='o_chasseEnvoyer'], [id$='o_chasseEnvoyerPartager']";
// pages dont les requêtes portent des départs ou des comptes à rebours
const RELEVES_PAGES_JEU = /\/(ennemie|AcquerirTerrain|Armee|Ressources|commerce)\.php/i;
// comptes à rebours du jeu sans rapport avec les mouvements
const RELEVES_COMPTEURS_IGNORES = /ponte|construction|recherche/i;
// relevés branchés sur le journal (copie et effacement), une fois
let relevesBranches = false;
// relevés de la page installés, une fois
let relevesInstalles = false;

/**
 * @class Releves
 */
class Releves {
  /**
   * @static
   * @return {Boolean}
   */
  static get actifs() {
    try {
      return localStorage.getItem(CLE_RELEVES_ACTIFS) !== "0";
    } catch (e) {
      return false;
    }
  }
  static set actifs(oui) {
    try {
      localStorage.setItem(CLE_RELEVES_ACTIFS, oui ? "1" : "0");
    } catch (e) {}
  }
  /**
   * Relevés, du plus ancien au plus récent.
   *
   * @static
   * @method liste
   * @return {Array<{t: Number, y: String, p: String, m: String, c?: Number}>}
   */
  static liste() {
    try {
      let liste = JSON.parse(localStorage.getItem(CLE_RELEVES) || "[]");
      return Array.isArray(liste) ? liste : [];
    } catch (e) {
      return [];
    }
  }
  /**
   * @static
   * @method noter
   * @param {String} type PAGE, CLIC, ENVOI, REQUÊTE, SYNCHRO, LATENCE, RC ou CALIBRAGE
   * @param {String} texte
   * @param {Object} [options]
   * @param {Number} [options.t] instant à l'heure du serveur (ms), maintenant par défaut
   * @param {Number} [options.c] heure du PC du clic (ms), pour le rattacher à la requête qui suit
   */
  static noter(type, texte, options = {}) {
    Releves._ajouter([Releves._releve(type, texte, options)]);
  }
  /**
   * @private
   * @static
   * @param {String} type
   * @param {String} texte
   * @param {{t?: Number, c?: Number}} options
   * @return {{t: Number, y: String, p: String, m: String, c?: Number}}
   */
  static _releve(type, texte, options) {
    /** @type {{t: Number, y: String, p: String, m: String, c?: Number}} */
    let releve = {
      t: Math.round(options.t != null ? options.t : Horloge.maintenant()),
      y: type,
      p: location.pathname.replace(/^\//, "") + location.search,
      m: String(texte),
    };
    if (options.c != null) releve.c = options.c;
    return releve;
  }
  /**
   * Relevés ajoutés en une écriture.
   *
   * @private
   * @static
   * @param {Array<Object>} releves
   */
  static _ajouter(releves) {
    if (!Releves.actifs || !releves.length) return;
    let liste = Releves.liste().concat(releves);
    if (liste.length > RELEVES_MAX) liste.splice(0, liste.length - RELEVES_MAX);
    try {
      localStorage.setItem(CLE_RELEVES, JSON.stringify(liste));
    } catch (e) {
      // stockage plein : les plus récents seulement
      try {
        localStorage.setItem(CLE_RELEVES, JSON.stringify(liste.slice(-200)));
      } catch (e2) {}
    }
    document.dispatchEvent(new CustomEvent("fzzz_releves"));
  }
  /**
   * @static
   * @method vider
   */
  static vider() {
    try {
      localStorage.removeItem(CLE_RELEVES);
      localStorage.removeItem(CLE_RELEVES_MESSAGES);
    } catch (e) {}
    document.dispatchEvent(new CustomEvent("fzzz_releves"));
  }
  /**
   * Texte copié avec le journal.
   *
   * @static
   * @method texte
   * @return {String}
   */
  static texte() {
    let liste = Releves.liste();
    return [
      `Relevés de la version TEST : ${liste.length}, du plus ancien au plus récent (heure du jeu, à la milliseconde) :`,
      ...liste.map((r) => `${Releves.date(r.t)} ${r.y} (${r.p}) ${r.m}`),
    ].join("\n");
  }
  /**
   * @static
   * @param {Number} ms heure du serveur
   * @return {String} « 17:23:12,345 »
   */
  static heure(ms) {
    let m = moment(Math.round(ms));
    return `${m.format("HH:mm:ss")},${String(m.milliseconds()).padStart(3, "0")}`;
  }
  /**
   * @static
   * @param {Number} ms heure du serveur
   * @return {String} « 14/11 17:23:12,345 »
   */
  static date(ms) {
    return `${moment(Math.round(ms)).format("DD/MM")} ${Releves.heure(ms)}`;
  }
  /**
   * @static
   * @param {Number} ms durée
   * @param {Boolean} [signe]
   * @return {String} « +0,012 s »
   */
  static duree(ms, signe = false) {
    return `${numeral(ms / 1000).format(signe ? "+0,0.000" : "0,0.000")} s`;
  }
  /**
   * Heure du PC d'un instant de l'horloge de performance (requête, réponse) :
   * mesurée depuis maintenant, sans timeOrigin, qui peut retarder sur un
   * téléphone sorti de veille.
   *
   * @static
   * @param {Number} t ms, horloge de performance
   * @return {Number} ms, heure du PC
   */
  static instantPC(t) {
    return Date.now() - Math.max(0, performance.now() - t);
  }
  /**
   * Intervalle du décalage heure du serveur − heure du PC : même calcul que
   * Horloge.estimer (intersection des intervalles des plus récents
   * échantillons), avec ses bornes.
   *
   * @static
   * @method intervalle
   * @param {Array<{date: Number, envoi: Number, reception: Number}>} echantillons du plus ancien au plus récent
   * @return {{min: Number, max: Number, n: Number}|null}
   */
  static intervalle(echantillons) {
    let min = -Infinity,
      max = Infinity,
      n = 0;
    for (let i = echantillons.length - 1; i >= 0; i--) {
      let e = echantillons[i],
        a = Math.max(min, e.date - e.reception),
        b = Math.min(max, e.date + 1000 - e.envoi);
      if (a > b) break;
      min = a;
      max = b;
      n++;
    }
    return n ? { min, max, n } : null;
  }
  /**
   * Échantillons de l'horloge gardés pour ce serveur et leur intervalle.
   *
   * @static
   * @method etatHorloge
   * @return {Promise<{min?: Number, max?: Number, n?: Number, total: Number, liste: Array}>}
   */
  static etatHorloge() {
    let cle = `fzzz_horloge_${location.hostname.split(".")[0]}`;
    try {
      return chrome.storage.local.get(cle).then(
        (/** @type {any} */ r) => {
          let liste = Array.isArray(r[cle]) ? r[cle] : [];
          return { ...(Releves.intervalle(liste) || {}), total: liste.length, liste };
        },
        () => ({ total: 0, liste: [] }),
      );
    } catch (e) {
      return Promise.resolve({ total: 0, liste: [] });
    }
  }
  /**
   * @static
   * @param {{min?: Number, max?: Number, n?: Number, total: Number}} etat
   * @return {String}
   */
  static libelleHorloge(etat) {
    if (!etat || etat.min == null)
      return `heure du PC (aucun échantillon du serveur sur ${(etat && etat.total) || 0})`;
    return `décalage serveur − PC ${Releves.duree((etat.min + etat.max) / 2, true)} ± ${Releves.duree((etat.max - etat.min) / 2)} (${etat.n} échantillon(s) sur ${etat.total})`;
  }
  /**
   * Comptes à rebours du jeu (scripts reste(N, "id") et resteTemps(N, "id"))
   * et arrivée qu'ils donnent : le serveur compte N secondes entières depuis la
   * seconde où il a produit la page, entre l'envoi de la requête et sa réponse.
   * Deux arrivées possibles quand une seconde a changé entre les deux.
   *
   * @static
   * @method compteurs
   * @param {any} racine document ou élément
   * @param {Number} debut heure du serveur (ms) de l'envoi de la requête
   * @param {Number} fin heure du serveur (ms) du début de la réponse
   * @return {Array<String>}
   */
  static compteurs(racine, debut, fin) {
    let $racine = $(racine),
      vus = new Set(),
      sortie = [];
    $racine.find("script").each((/** @type {Number} */ i, /** @type {Element} */ script) => {
      let texte = script.textContent || "",
        re = /\b(?:reste|resteTemps)\(\s*(-?\d+)\s*,\s*["']([\w-]+)["']\s*\)/g,
        m;
      while ((m = re.exec(texte))) {
        let secondes = parseInt(m[1]),
          id = m[2];
        if (vus.has(id) || RELEVES_COMPTEURS_IGNORES.test(id)) continue;
        vus.add(id);
        let tot = Math.floor(debut / 1000) * 1000 + secondes * 1000,
          tard = Math.floor(fin / 1000) * 1000 + secondes * 1000,
          $elt = $racine.find(`[id='${id}']`).first(),
          ligne = Releves._ligne($elt),
          // pseudo de la cible d'une attaque, lien juste avant son compteur
          lien = /^attaque_/.test(id)
            ? $elt.prev().find("a[href*='Pseudo=']").first().text() ||
              $elt.prevAll("a[href*='Pseudo=']").first().text()
            : "",
          minute = ligne.match(/Arrivée à (\d{1,2})h(\d{2})/i),
          arrivee = moment(tot).format("HH:mm:ss");
        if (tard != tot) arrivee += ` ou ${moment(tard).format("HH:mm:ss")}`;
        sortie.push(
          `${id}${lien ? ` (${lien.trim()})` : ""} ${secondes} s → ${arrivee}${minute ? ` [jeu : ${minute[1].padStart(2, "0")}h${minute[2]}]` : ""}`,
        );
      }
    });
    return sortie;
  }
  /**
   * Texte de la ligne d'un compte à rebours (attaque, chasse…), pour la minute
   * « Arrivée à HHhMM » que le jeu y écrit (Compte+).
   *
   * @private
   * @static
   * @param {any} $elt
   * @return {String}
   */
  static _ligne($elt) {
    if (!$elt || !$elt.length) return "";
    if (/^attaque_/.test($elt.attr("id")) && typeof AttaqueLancee != "undefined")
      return AttaqueLancee.noeudsLigne($elt[0])
        .map((/** @type {Node} */ n) => n.textContent)
        .join(" ")
        .replace(/\s+/g, " ");
    let $ligne = $elt.parent();
    return `${$ligne.text()} ${$ligne.nextAll("small").first().text()}`.replace(/\s+/g, " ");
  }
  /**
   * Dernier clic d'un lanceur ou envoi de formulaire, dans RELEVES_DELAI_CLIC
   * avant l'instant du PC donné.
   *
   * @private
   * @static
   * @param {Number} avant heure du PC (ms)
   * @return {{t: Number, c: Number, y: String, m: String}|null}
   */
  static _clicAvant(avant) {
    let liste = Releves.liste();
    for (let i = liste.length - 1; i >= 0; i--) {
      let r = liste[i];
      if (r.c == null) continue;
      if (r.c <= avant && avant - r.c < RELEVES_DELAI_CLIC)
        return { t: r.t, c: r.c, y: r.y, m: r.m };
      if (avant - r.c >= RELEVES_DELAI_CLIC) return null;
    }
    return null;
  }
  /**
   * Écarts entre un clic et la requête qui l'a suivi (heures du PC).
   *
   * @private
   * @static
   * @param {Number} envoi heure du PC de l'envoi de la requête
   * @param {Number} reponse heure du PC du début de la réponse
   * @return {String}
   */
  static _apresClic(envoi, reponse) {
    let clic = Releves._clicAvant(envoi);
    if (!clic) return "";
    return `après le ${clic.y == "ENVOI" ? "formulaire envoyé" : "clic"} de ${Releves.heure(clic.t)} : clic → requête ${Releves.duree(envoi - clic.c, true)}, clic → réponse ${Releves.duree(reponse - clic.c, true)}`;
  }
  /**
   * Relevé de la page : heures de sa requête et de sa réponse, état de
   * l'horloge, TdC affichés, comptes à rebours.
   *
   * @static
   * @method page
   * @return {Promise}
   */
  static page() {
    /** @type {any} */
    let nav = null;
    try {
      nav = performance.getEntriesByType("navigation")[0] || null;
    } catch (e) {}
    let envoiPC = nav && nav.requestStart > 0 ? Releves.instantPC(nav.requestStart) : null,
      reponsePC = nav && nav.responseStart > 0 ? Releves.instantPC(nav.responseStart) : Date.now(),
      envoi = envoiPC != null ? Horloge.serveurA(envoiPC).valueOf() : null,
      reponse = Horloge.serveurA(reponsePC).valueOf();
    return Releves.etatHorloge().then((etat) => {
      let morceaux = [
        `${nav ? nav.type : "?"}${nav && nav.transferSize === 0 && nav.decodedBodySize > 0 ? " (cache du navigateur)" : ""}`,
      ];
      if (envoi != null)
        morceaux.push(
          `requête ${Releves.heure(envoi)} → réponse ${Releves.heure(reponse)} (${Releves.duree(reponse - envoi)})`,
        );
      morceaux.push(Releves.libelleHorloge(etat), `latence réglée ${Horloge.libelleLatence()}`);
      let tdc = numeral($("#quantite_tdc").first().text()).value();
      if (tdc > 0) morceaux.push(`mon TdC ${numeral(tdc).format()}`);
      if (/Membre\.php/i.test(location.pathname)) {
        let pseudo = new URLSearchParams(location.search).get("Pseudo"),
          sien = numeral($(".tableau_score tr:eq(1) td:eq(1)").text()).value();
        if (pseudo && sien > 0) morceaux.push(`TdC de ${pseudo} ${numeral(sien).format()}`);
      }
      if (envoiPC != null) {
        let clic = Releves._apresClic(envoiPC, reponsePC);
        if (clic) morceaux.push(clic);
      }
      let compteurs = Releves.compteurs(document, envoi != null ? envoi : reponse, reponse);
      if (compteurs.length) morceaux.push(`compteurs : ${compteurs.join(" ; ")}`);
      Releves.noter("PAGE", morceaux.join(" | "), { t: reponse });
    });
  }
  /**
   * Requête au jeu terminée (événements ajaxSend / ajaxComplete de jQuery) :
   * envois de l'extension (attaque, flood, chasse, déplacement, annulation) et
   * lectures qui portent des comptes à rebours.
   *
   * @static
   * @method requete
   * @param {any} jqXHR
   * @param {any} reglages réglages de la requête ($.ajax)
   */
  static requete(jqXHR, reglages) {
    let url = String((reglages && reglages.url) || ""),
      methode = String((reglages && reglages.type) || "GET").toUpperCase();
    if (!RELEVES_PAGES_JEU.test(url) || /xajax=/.test(String(reglages.data || ""))) return;
    let reponsePC = Date.now(),
      envoiPC = reglages.__fzzzEnvoi || reponsePC,
      texte = String((jqXHR && jqXHR.responseText) || ""),
      envoi = Horloge.serveurA(envoiPC).valueOf(),
      reponse = Horloge.serveurA(reponsePC).valueOf(),
      compteurs = /\breste(Temps)?\(/.test(texte)
        ? Releves.compteurs(new DOMParser().parseFromString(texte, "text/html"), envoi, reponse)
        : [];
    if (methode == "GET" && !compteurs.length) return;
    let chemin = url.replace(/^https?:\/\/[^/]+\//, "").replace(/[?&]_=\d+/, ""),
      morceaux = [
        `${methode} ${chemin} statut ${(jqXHR && jqXHR.status) || "?"}`,
        `envoyée ${Releves.heure(envoi)} → reçue ${Releves.heure(reponse)} (${Releves.duree(reponse - envoi)})`,
      ],
      clic = Releves._apresClic(envoiPC, reponsePC);
    if (clic) morceaux.push(clic);
    if (compteurs.length) morceaux.push(`compteurs : ${compteurs.join(" ; ")}`);
    Releves.noter("REQUÊTE", morceaux.join(" | "), { t: reponse });
  }
  /**
   * Trajet affiché par l'extension sur la page d'attaque, et arrivée qu'il
   * donne pour un clic fait maintenant (seconde de départ = heure du serveur +
   * latence, secondes coupées).
   *
   * @private
   * @static
   * @return {String}
   */
  static _trajet() {
    let texte = $("#o_tempsTrajet").first().text().trim();
    if (!texte || typeof Utils == "undefined") return "";
    let trajet = Utils.timeToInt(texte),
      depart = Math.floor(Horloge.clic().valueOf() / 1000) * 1000;
    return trajet > 0
      ? ` | trajet affiché ${texte} → arrivée prévue ${moment(depart + trajet * 1000).format("HH:mm:ss")}`
      : "";
  }
  /**
   * Formulaire envoyé (attaque, chasse, convoi, déplacement…) : son adresse et
   * son bouton, jamais ses valeurs (armée, quantités).
   *
   * @static
   * @method envoi
   * @param {HTMLFormElement} form
   * @param {any} [bouton] bouton qui l'envoie
   */
  static envoi(form, bouton) {
    let action = String(form.getAttribute("action") || location.pathname).replace(
        /^https?:\/\/[^/]+\//,
        "",
      ),
      libelle = bouton
        ? String(bouton.value || bouton.textContent || bouton.name || "").trim()
        : "";
    Releves.noter(
      "ENVOI",
      `formulaire ${action}${form.id ? ` (#${form.id})` : ""}${libelle ? ` bouton « ${libelle.slice(0, 40)} »` : ""} | latence réglée ${Horloge.libelleLatence()}${Releves._trajet()}`,
      { c: Date.now() },
    );
  }
  /**
   * Messages ouverts dans la Messagerie : horodatage (à la seconde) de chaque
   * message, catégorie et titre de sa conversation, phrases du TdC (pas les
   * armées). Une fois par message.
   *
   * @static
   * @method messages
   */
  static messages() {
    let vus = new Set(),
      ajoutes = [],
      /** @type {Array<Object>} */
      releves = [];
    try {
      JSON.parse(localStorage.getItem(CLE_RELEVES_MESSAGES) || "[]").forEach(
        (/** @type {String} */ id) => vus.add(String(id)),
      );
    } catch (e) {}
    $("tr.en_tete_message[id^='conversation_']").each(
      (/** @type {Number} */ i, /** @type {Element} */ entete) => {
        let $entete = $(entete),
          titre = $entete.find(".td_objet").first().text().replace(/\s+/g, " ").trim(),
          categorie =
            typeof MessagerieFzzz != "undefined" ? MessagerieFzzz.categorie($entete) : null;
        $entete
          .nextUntil("tr.en_tete_message")
          .find("tr[id^='message_']")
          .addBack("tr[id^='message_']")
          .each((/** @type {Number} */ j, /** @type {Element} */ tr) => {
            let id = String(tr.id).replace("message_", ""),
              horodatage = Number($(tr).find("[data-timestamp]").first().attr("data-timestamp"));
            if (vus.has(id) || !(horodatage > 1e9)) return;
            vus.add(id);
            ajoutes.push(id);
            let texte = $(tr).find(".message").first().text().replace(/\s+/g, " "),
              phrases = (texte.match(/[^.!?]*cm²[^.!?]*/g) || [])
                .map((p) => p.trim().slice(0, 120))
                .filter(Boolean)
                .slice(0, 3);
            releves.push(
              Releves._releve(
                "RC",
                `${categorie ? categorie.nom : "message"} « ${titre.slice(0, 80)} » message ${id} : horodatage ${moment(horodatage * 1000).format("DD/MM HH:mm:ss")}${phrases.length ? ` | ${phrases.join(" / ")}` : ""}`,
                {},
              ),
            );
          });
      },
    );
    Releves._ajouter(releves);
    if (ajoutes.length)
      try {
        localStorage.setItem(
          CLE_RELEVES_MESSAGES,
          JSON.stringify([...vus].slice(-RELEVES_MESSAGES_MAX)),
        );
      } catch (e) {}
  }
  /**
   * Une requête de calibrage : envoi, réception des en-têtes, en-tête Date.
   *
   * @private
   * @static
   * @return {Promise<{date: Number, envoi: Number, reception: Number}|null>}
   */
  static _requeteHorloge() {
    return new Promise((resoudre) => {
      let envoi = 0,
        reception = 0,
        date = NaN;
      $.ajax({
        url: location.origin + CALIBRAGE_IMAGE,
        type: "HEAD",
        cache: false,
        xhr: () => {
          let x = new XMLHttpRequest(),
            envoyer = x.send;
          x.send = function () {
            envoi = Date.now();
            return envoyer.apply(x, arguments);
          };
          x.addEventListener("readystatechange", () => {
            if (x.readyState < 2 || reception) return;
            reception = Date.now();
            date = Date.parse(x.getResponseHeader("Date") || "");
          });
          return x;
        },
      }).always(() =>
        resoudre(envoi && reception && !isNaN(date) ? { date, envoi, reception } : null),
      );
    });
  }
  /**
   * Calibrage au clic : CALIBRAGE_REQUETES requêtes d'une image du jeu, l'une
   * après l'autre. Leurs en-têtes Date rejoignent les échantillons de
   * l'horloge (script d'arrière-plan ou script utilisateur).
   *
   * @static
   * @method calibrer
   * @param {(texte: String) => void} [etat] avancement
   * @return {Promise<String>} bilan
   */
  static calibrer(etat = () => {}) {
    /** @type {Array<{date: Number, envoi: Number, reception: Number}>} */
    let echantillons = [],
      pause = () => new Promise((r) => setTimeout(r, CALIBRAGE_PAUSE));
    return Releves.etatHorloge().then((avant) => {
      let suite = Promise.resolve();
      for (let i = 0; i < CALIBRAGE_REQUETES; i++)
        suite = suite
          .then(() => {
            etat(`Calibrage : requête ${i + 1} / ${CALIBRAGE_REQUETES}…`);
            return Releves._requeteHorloge();
          })
          .then((e) => {
            if (e) echantillons.push(e);
            return i < CALIBRAGE_REQUETES - 1 ? pause() : undefined;
          });
      return suite
        .then(() => Releves.etatHorloge())
        .then((apres) => {
          let seul = Releves.intervalle(echantillons),
            allers = echantillons.map((e) => e.reception - e.envoi).sort((a, b) => a - b),
            mediane = allers.length ? allers[Math.floor(allers.length / 2)] : null,
            bilan = seul
              ? [
                  `${echantillons.length} réponse(s) sur ${CALIBRAGE_REQUETES}, aller-retour médian ${Releves.duree(mediane)}`,
                  `ces réponses seules : ${Releves.libelleHorloge({ ...seul, total: echantillons.length })}`,
                  `avant : ${Releves.libelleHorloge(avant)}`,
                  `après : ${Releves.libelleHorloge(apres)}`,
                ].join(" | ")
              : `aucune réponse utilisable sur ${CALIBRAGE_REQUETES} (en-tête Date absent ?) | ${Releves.libelleHorloge(apres)}`;
          Releves.noter("CALIBRAGE", bilan);
          return bilan;
        });
    });
  }
  /**
   * Relevés de la page et écoute des clics, envois, requêtes, synchros et
   * messages ouverts. Une fois par page, horloge chargée.
   *
   * @static
   * @method installer
   */
  static installer() {
    if (relevesInstalles) return;
    relevesInstalles = true;
    Releves.page().catch(() => {});
    window.addEventListener("pageshow", (e) => {
      if (e.persisted)
        Releves.noter(
          "PAGE",
          "reprise du cache par « Précédent » : aucune requête, comptes à rebours pas relus",
        );
    });
    document.addEventListener(
      "click",
      (e) => {
        let cible = /** @type {Element} */ (e.target),
          bouton = cible && cible.closest ? cible.closest(RELEVES_BOUTONS) : null;
        if (bouton)
          Releves.noter(
            "CLIC",
            `« ${String(bouton.textContent || bouton.id)
              .trim()
              .slice(0, 40)} » | latence réglée ${Horloge.libelleLatence()}${Releves._trajet()}`,
            { c: Date.now() },
          );
        if (cible && cible.closest && cible.closest("#o_latenceMoins, #o_latencePlus"))
          // lue après le réglage fait par le bouton
          setTimeout(() => Releves.noter("LATENCE", `réglée ${Horloge.libelleLatence()}`), 0);
      },
      true,
    );
    // envoi par le bouton du joueur (submit natif) ou par l'extension
    // (requestSubmit, clic du bouton du jeu) : une seule fois par envoi
    let dernierEnvoi = { form: null, c: 0 },
      surEnvoi = (/** @type {HTMLFormElement} */ form, /** @type {any} */ bouton) => {
        if (!form || (dernierEnvoi.form === form && Date.now() - dernierEnvoi.c < 500)) return;
        dernierEnvoi = { form, c: Date.now() };
        Releves.envoi(form, bouton);
      };
    document.addEventListener(
      "submit",
      (e) => surEnvoi(/** @type {HTMLFormElement} */ (e.target), /** @type {any} */ (e).submitter),
      true,
    );
    $(document).on("submit", "form", (/** @type {any} */ e) => surEnvoi(e.target, null));
    $(document).on(
      "ajaxSend",
      (/** @type {any} */ e, /** @type {any} */ x, /** @type {any} */ s) => {
        if (s) s.__fzzzEnvoi = Date.now();
      },
    );
    $(document).on(
      "ajaxComplete",
      (/** @type {any} */ e, /** @type {any} */ x, /** @type {any} */ s) => {
        try {
          Releves.requete(x, s);
        } catch (err) {}
      },
    );
    if (/ennemie\.php/i.test(location.pathname)) Releves._suivreSynchro();
    if (/messagerie\.php/i.test(location.pathname)) {
      let attente = 0;
      Releves.messages();
      new MutationObserver(() => {
        clearTimeout(attente);
        attente = setTimeout(() => Releves.messages(), 200);
      }).observe(document.body, { childList: true, subtree: true });
    }
  }
  /**
   * Compte à rebours de synchronisation de la page d'attaque (#o_syncA) : son
   * début (arrivée annoncée) et l'instant où il dit de cliquer.
   *
   * @private
   * @static
   */
  static _suivreSynchro() {
    let suivi = null;
    new MutationObserver(() => {
      let p = document.getElementById("o_syncA");
      if (!p || p === suivi) return;
      suivi = p;
      new MutationObserver(() => {
        let texte = (p.textContent || "").replace(/\s+/g, " ").trim();
        if (/maintenant/i.test(texte))
          Releves.noter(
            "SYNCHRO",
            `« ${texte} » affiché | latence réglée ${Horloge.libelleLatence()}`,
          );
        else if (/arrivée/i.test(texte))
          Releves.noter(
            "SYNCHRO",
            `compte à rebours lancé : ${texte.replace(/dans : [\d,\s]+s/, "dans …").slice(0, 160)}`,
          );
      }).observe(p, { childList: true });
    }).observe(document.body, { childList: true, subtree: true });
  }
  /**
   * Case, nombre de relevés et bouton « Calibrer l'horloge » dans la boîte
   * Journal.
   *
   * @static
   * @method equiperBoite
   */
  static equiperBoite() {
    let $boite = $("#o_boiteJournal");
    if (!$boite.length || $boite.find(".o_releves").length) return;
    // mise en page des boutons du journal (outiiil.css)
    let $zone = $(`<div class="o_releves o_journalBoutons">
        <label style="font-size:11px" title="Heures des pages, des clics des lanceurs, des envois, des requêtes et des messages ouverts, copiées avec le journal (« Copier »)"><input type="checkbox" class="o_relevesActifs"/> Relevés TEST : <span class="o_relevesNombre"></span></label>
        <button type="button" class="o_button o_relevesCalibrer" title="${CALIBRAGE_REQUETES} requêtes d'une image du jeu en quelques secondes, pour caler l'horloge sur le serveur">Calibrer l'horloge</button>
      </div>
      <p class="o_relevesEtat o_journalEtat"></p>`).insertAfter(
        $boite.find(".o_journalBoutons").first(),
      ),
      majNombre = () =>
        $zone.find(".o_relevesNombre").text(numeral(Releves.liste().length).format());
    $zone.find(".o_relevesActifs").prop("checked", Releves.actifs);
    $zone.find(".o_relevesActifs").on("change", (/** @type {any} */ e) => {
      Releves.actifs = e.currentTarget.checked;
    });
    $zone.find(".o_relevesCalibrer").on("click", (/** @type {any} */ e) => {
      let $b = $(e.currentTarget).prop("disabled", true),
        etat = (/** @type {String} */ t) => $boite.find(".o_relevesEtat").text(t);
      Releves.calibrer(etat)
        .then(etat, () => etat("Calibrage impossible."))
        .then(() => $b.prop("disabled", false));
    });
    majNombre();
    document.addEventListener("fzzz_releves", majNombre);
    window.addEventListener("storage", (e) => e.key == CLE_RELEVES && majNombre());
  }
  /**
   * « Copier » du journal copie aussi les relevés, « Effacer » les efface.
   *
   * @static
   * @method brancherJournal
   */
  static brancherJournal() {
    if (relevesBranches || typeof Journal == "undefined") return;
    relevesBranches = true;
    let texte = Journal.texte,
      vider = Journal.vider;
    Journal.texte = () => `${texte.call(Journal)}\n\n${Journal.masquer(Releves.texte())}`;
    Journal.vider = () => {
      vider.call(Journal);
      Releves.vider();
    };
  }
}
Releves.brancherJournal();
