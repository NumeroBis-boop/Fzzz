// @ts-check
/*
 * OuafSuivi.js
 * Suivi des convois de la OUAF (site de l'alliance, ouafchaine.fr).
 **********************************************************************/

// site de suivi des convois de l'alliance (pas de https)
const OUAF_SITE = "http://ouafchaine.fr/";
// code de connexion, dans le stockage de l'extension (illisible par le jeu)
const CLE_OUAF_CODE = "fzzz_ouafCode";
// convois transmis depuis ce navigateur : {clé du convoi: date (ms)}
const CLE_OUAF_TRANSMIS = "fzzz_ouafTransmis";
// au-delà, un convoi est forcément arrivé : son marquage local est oublié
const OUAF_DUREE_VIE = 10 * 86400000;
// trajet maximal d'un convoi (vitesse 0) : fenêtre de recherche dans l'historique
const OUAF_TRAJET_MAX = 637200 * 1000;

/**
 * Envoi des convois au site de suivi de la OUAF, au clic du joueur.
 *
 * Les requêtes passent par le script d'arrière-plan (le site est en http et
 * hors de fourmizzz.fr). Pour chaque convoi « Vous allez livrer » :
 *  - déjà transmis (marqué dans ce navigateur, ou retrouvé dans l'historique
 *    du site, pour les envois faits depuis un autre appareil) : rien ;
 *  - destinataire inconnu du site : rien, « joueur introuvable » ;
 *  - sinon, la part qui manque au convoi prévu est notée dans « Mes convois »
 *    (« Nouvel envoi » + Enregistrer), et le surplus (ou tout le convoi s'il
 *    n'était pas prévu) est noté en avance vers ce joueur.
 *
 * @class OuafSuivi
 */
class OuafSuivi {
  /**
   * @static
   * @method lireCode
   * @return {Promise<String>} code enregistré, ou ""
   */
  static lireCode() {
    try {
      return chrome.storage.local
        .get(CLE_OUAF_CODE)
        .then((r) => r[CLE_OUAF_CODE] || "")
        .catch(() => "");
    } catch (e) {
      return Promise.resolve("");
    }
  }
  /**
   * @static
   * @method enregistrerCode
   * @param {String} code "" pour effacer
   * @return {Promise}
   */
  static enregistrerCode(code) {
    try {
      return code
        ? chrome.storage.local.set({ [CLE_OUAF_CODE]: code })
        : chrome.storage.local.remove(CLE_OUAF_CODE);
    } catch (e) {
      return Promise.resolve();
    }
  }
  /**
   * Requête au site, faite par le script d'arrière-plan.
   *
   * @static
   * @method requete
   * @return {Promise<Object>} réponse JSON du site
   */
  static requete(methode, chemin, corps = undefined) {
    return Promise.resolve(
      chrome.runtime.sendMessage({ type: "fzzz_ouaf", methode, chemin, corps }),
    ).then((r) => {
      if (!r) throw new Error("le script d'arrière-plan n'a pas répondu");
      if (r.erreur == "permission") {
        let e = new Error("accès à ouafchaine.fr non autorisé");
        e.name = "permission";
        throw e;
      }
      if (r.erreur) throw new Error("site injoignable");
      if (!r.ok) throw new Error((r.donnees && r.donnees.detail) || `erreur ${r.statut}`);
      return r.donnees || {};
    });
  }
  /**
   * Connexion avec le code enregistré.
   *
   * @static
   * @method connecter
   * @return {Promise<Object>} session {connecte, pseudo}
   */
  static connecter() {
    return OuafSuivi.lireCode().then((code) => {
      if (!code) {
        let e = new Error("aucun code de connexion enregistré");
        e.name = "code";
        throw e;
      }
      return OuafSuivi.requete("POST", "/api/session", { mot_de_passe: code }).then((s) => {
        if (!s.connecte) throw new Error("code de connexion refusé par le site");
        return s;
      });
    });
  }
  /**
   * Convois envoyés en cours, lus dans la page Convois.
   *
   * @static
   * @method convoisJeu
   * @return {Array} [{elt, cle, vers, montant, arrivee (ms)}]
   */
  static convoisJeu() {
    return CommerceFzzz.lignes()
      .get()
      .map((elt) => {
        let texte = CommerceFzzz.texte(elt),
          m = texte.match(
            /Vous allez livrer\s+([\d\s  ]+)\D+?et\s+([\d\s  ]+)\D+?à\s+(.+?)\s+dans\s+(.+?)(?:\s+-|$)/i,
          );
        if (!m) return null;
        let nombre = (t) => parseInt(String(t).replace(/\D/g, "")) || 0,
          vers = $(elt).find("a[href*='Pseudo=']").first().text().trim() || m[3].trim(),
          montant = nombre(m[1]) + nombre(m[2]),
          arrivee = Horloge.serveur().valueOf() + Utils.timeToInt(m[4]) * 1000,
          annuler = OuafSuivi._lienAnnuler(elt),
          // numéro d'annulation du jeu, sinon destinataire, montant et minute d'arrivée
          cle = annuler
            ? "id" + annuler
            : `${vers.toLowerCase()}|${montant}|${Math.round(arrivee / 60000)}`;
        return { elt, cle, vers, montant, arrivee };
      })
      .filter(Boolean);
  }
  /**
   * @private
   * @static
   */
  static _lienAnnuler(elt) {
    for (let n = elt.nextSibling; n && n.nodeName != "BR"; n = n.nextSibling)
      if (n.nodeName == "A") {
        let m = (n.getAttribute("href") || "").match(/annuler=(\d+)/);
        if (m) return m[1];
      }
    return null;
  }
  /**
   * Envois du joueur dans l'historique du site, regroupés par destinataire et
   * par moment (un convoi transmis = un envoi noté + une avance éventuelle,
   * à quelques secondes d'écart), avec leur montant net.
   *
   * @static
   * @method transmissions
   * @param {Array} lignes historique du site
   * @param {String} pseudo
   * @return {Array} [{vers, net, quand (ms)}]
   */
  static transmissions(lignes, pseudo) {
    let moi = String(pseudo || "").toLowerCase(),
      ecart = (detail) => {
        let m = String(detail || "").match(/([\d.]+)\s*→\s*([\d.]+)/);
        return m ? parseFloat(m[2]) - parseFloat(m[1]) : null;
      },
      mouvements = (lignes || [])
        .filter((r) => r.sens == "envoye" && String(r.de || "").toLowerCase() == moi)
        .map((r) => {
          let montant = Number(r.montant) || 0,
            delta =
              r.action == "convoi"
                ? (ecart(r.detail) ?? montant)
                : r.action == "convoi_annule"
                  ? (ecart(r.detail) ?? -montant)
                  : r.action == "avance"
                    ? montant
                    : r.action == "avance_annule"
                      ? -montant
                      : 0;
          return { vers: String(r.vers || "").toLowerCase(), delta, quand: Date.parse(r.quand) };
        })
        .filter((r) => r.delta && !isNaN(r.quand))
        .sort((a, b) => a.quand - b.quand),
      groupes = [];
    mouvements.forEach((r) => {
      let g = groupes.find((x) => x.vers == r.vers && r.quand - x.quand <= 120000);
      if (g) g.net += r.delta;
      else groupes.push({ vers: r.vers, net: r.delta, quand: r.quand });
    });
    return groupes.filter((g) => g.net > 0);
  }
  /**
   * Convois déjà transmis : marqués dans ce navigateur, ou retrouvés dans
   * l'historique (même destinataire, même montant, noté après le départ
   * possible du convoi ; chaque envoi de l'historique ne sert qu'une fois).
   *
   * @static
   * @method apparier
   * @return {Set<String>} clés des convois transmis
   */
  static apparier(convois, groupes) {
    let locaux = OuafSuivi.transmisLocaux(),
      libres = groupes.slice(),
      transmis = new Set();
    convois
      .slice()
      .sort((a, b) => a.arrivee - b.arrivee)
      .forEach((c) => {
        if (locaux[c.cle]) return transmis.add(c.cle);
        let i = libres.findIndex(
          (g) =>
            g.vers == c.vers.toLowerCase() &&
            Math.abs(g.net - c.montant) <= 1 &&
            g.quand >= c.arrivee - OUAF_TRAJET_MAX,
        );
        if (i != -1) {
          libres.splice(i, 1);
          transmis.add(c.cle);
        }
      });
    return transmis;
  }
  /**
   * @static
   * @method transmisLocaux
   */
  static transmisLocaux() {
    let liste = Utils.lireStockage(CLE_OUAF_TRANSMIS, {}),
      limite = Date.now() - OUAF_DUREE_VIE;
    for (let cle in liste) if (liste[cle] < limite) delete liste[cle];
    return liste;
  }
  /**
   * @static
   * @method marquerTransmis
   */
  static marquerTransmis(cle) {
    let liste = OuafSuivi.transmisLocaux();
    liste[cle] = Date.now();
    try {
      localStorage.setItem(CLE_OUAF_TRANSMIS, JSON.stringify(liste));
    } catch (e) {}
  }
  /**
   * Répartition d'un convoi : part notée sur le convoi prévu (au plus ce
   * qu'il reste à livrer) et surplus noté en avance.
   *
   * @static
   * @method repartir
   * @return {Object} {ligne, convoi, avance}
   */
  static repartir(montant, lignes, vers) {
    let ligne = (lignes || []).find(
        (l) => String(l.vers || "").toLowerCase() == vers.toLowerCase(),
      ),
      reste = ligne ? Math.max(0, Number(ligne.demande || 0) - Number(ligne.envoye || 0)) : 0,
      convoi = Math.min(montant, Math.round(reste));
    return { ligne: ligne || null, convoi: convoi, avance: montant - convoi };
  }
  /**
   * État des convois vis-à-vis du site.
   *
   * @static
   * @method etat
   * @return {Promise<Set<String>>} clés des convois transmis
   */
  static etat(convois) {
    return OuafSuivi.connecter().then((session) =>
      OuafSuivi.requete("GET", "/api/historique").then((h) =>
        OuafSuivi.apparier(convois, OuafSuivi.transmissions(h.lignes, session.pseudo)),
      ),
    );
  }
  /**
   * Transmet les convois pas encore notés, l'un après l'autre.
   *
   * @static
   * @method envoyer
   * @param {Array} convois voir convoisJeu
   * @param {Function} suivi (convoi, statut, detail) appelé pour chaque convoi
   * @return {Promise<Object>} {envoyes, deja, introuvables, erreurs}
   */
  static envoyer(convois, suivi = () => {}) {
    let bilan = { envoyes: 0, deja: 0, introuvables: 0, erreurs: 0 };
    return OuafSuivi.connecter().then((session) =>
      Promise.all([
        OuafSuivi.requete("GET", "/api/mes"),
        OuafSuivi.requete("GET", "/api/historique"),
      ]).then(([mes, historique]) => {
        let pseudo = mes.pseudo || session.pseudo,
          membres = mes.membres || [],
          transmis = OuafSuivi.apparier(
            convois,
            OuafSuivi.transmissions(historique.lignes, pseudo),
          );
        return convois
          .reduce(
            (suite, c) =>
              suite.then(() => {
                if (transmis.has(c.cle)) {
                  bilan.deja++;
                  return suivi(c, "transmis");
                }
                let nom = membres.find((m) => m.toLowerCase() == c.vers.toLowerCase());
                if (!nom) {
                  bilan.introuvables++;
                  return suivi(c, "introuvable");
                }
                let r = OuafSuivi.repartir(c.montant, mes.lignes, nom),
                  etape = Promise.resolve();
                // part du convoi prévu : « Nouvel envoi » puis Enregistrer
                if (r.convoi > 0)
                  etape = etape
                    .then(() =>
                      OuafSuivi.requete("PUT", "/api/mes", {
                        lignes: [
                          {
                            de: pseudo,
                            vers: r.ligne.vers,
                            demande: r.ligne.demande,
                            ajout: r.convoi,
                          },
                        ],
                        creer_avance: false,
                      }),
                    )
                    .then((m) => (mes = { ...mes, ...m, pseudo, membres }));
                // surplus, ou convoi hors prévision : ajouté à l'avance vers ce joueur
                if (r.avance > 0)
                  etape = etape
                    .then(() => OuafSuivi.requete("GET", "/api/avances"))
                    .then((av) => {
                      let lignes = (av.lignes || []).map((l) => ({
                          de: l.de,
                          vers: l.vers,
                          montant: Number(l.montant) || 0,
                        })),
                        existante = lignes.find(
                          (l) =>
                            String(l.de).toLowerCase() == pseudo.toLowerCase() &&
                            String(l.vers).toLowerCase() == nom.toLowerCase(),
                        );
                      if (existante) existante.montant += r.avance;
                      else lignes.push({ de: pseudo, vers: nom, montant: r.avance });
                      return OuafSuivi.requete("PUT", "/api/avances", { lignes });
                    });
                return etape.then(
                  () => {
                    OuafSuivi.marquerTransmis(c.cle);
                    bilan.envoyes++;
                    suivi(
                      c,
                      "envoye",
                      r.avance && r.convoi
                        ? `${numeral(r.convoi).format()} sur le convoi prévu, ${numeral(r.avance).format()} en avance`
                        : r.avance
                          ? "noté en avance (convoi non prévu ou déjà complet)"
                          : "noté sur le convoi prévu",
                    );
                  },
                  (e) => {
                    bilan.erreurs++;
                    suivi(c, "erreur", e.message);
                    // accès refusé : inutile de continuer
                    if (e.name == "permission") throw e;
                  },
                );
              }),
            Promise.resolve(),
          )
          .then(() => bilan);
      }),
    );
  }
  /**
   * Ouvre la page de l'extension qui demande l'accès à ouafchaine.fr (le
   * navigateur ne le permet qu'au clic, depuis une page de l'extension).
   *
   * @static
   * @method demanderAcces
   */
  static demanderAcces() {
    window.open(chrome.runtime.getURL("ouaf-autorisation.html"), "_blank");
  }
}
