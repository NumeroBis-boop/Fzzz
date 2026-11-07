// @ts-check
/*
 * OuafSuivi.js
 * Suivi des convois de la OUAF (site de l'alliance, ouafchaine.fr).
 **********************************************************************/

// site de suivi des convois de l'alliance (pas de https)
const OUAF_SITE = "http://ouafchaine.fr/";
// code de connexion, dans le stockage de l'extension (illisible par le jeu)
const CLE_OUAF_CODE = "fzzz_ouafCode";
// numéros des convois vus avec leur lien Annuler : {numéro: {vers, montant, arrivee (ms)}}
const CLE_OUAF_NUMEROS = "fzzz_ouafNumeros";
// écart d'arrivée toléré pour reconnaître un convoi sans son numéro (heure lue
// à la seconde près ici, à la minute dans le forum)
const OUAF_ECART_ARRIVEE = 2 * 60000;
// connexion au site, partagée par les lectures d'une même page (cookie de session)
/** @type {Promise<Object>|null} */
let connexionOuaf = null;
// envois au site l'un après l'autre : deux clics rapprochés liraient le même
// état du site (avance de l'un écrasée par l'autre, convoi prévu compté deux fois)
let fileEnvoisOuaf = Promise.resolve();
// site sans réponse : une lecture est abandonnée après ce délai (une écriture
// attend sa fin, elle a pu aboutir), puis les requêtes échouent tout de suite
// pendant la pause au lieu de faire attendre chaque clic
const OUAF_DELAI_LECTURE = 10000;
const OUAF_PAUSE_PANNE = 60000;
let ouafPanne = 0;

/**
 * Envoi des convois au site de suivi de la OUAF, au clic du joueur.
 *
 * Les requêtes passent par le script d'arrière-plan (le site est en http et
 * hors de fourmizzz.fr). Pour un convoi « Vous allez livrer » :
 *  - destinataire inconnu du site : rien, « joueur introuvable » ;
 *  - sinon, la part qui manque au convoi prévu est notée dans « Mes convois »
 *    (« Nouvel envoi » + Enregistrer), et le surplus (ou tout le convoi s'il
 *    n'était pas prévu) est noté en avance vers ce joueur.
 * Savoir si un convoi a déjà été transmis ne dépend que du forum (ConvoisForum).
 *
 * @class OuafSuivi
 */
class OuafSuivi {
  /**
   * Avances du joueur après un convoi noté en avance : une ligne de plus, les
   * précédentes vers le même joueur restent telles quelles (comme une avance
   * saisie sur le site). Le site attend la liste complète.
   *
   * @static
   * @method ajouterAvance
   * @param {Array} lignes avances lues sur le site
   * @param {String} de
   * @param {String} vers
   * @param {Number} montant
   * @return {Array} {de, vers, montant}
   */
  static ajouterAvance(lignes, de, vers, montant) {
    return (lignes || [])
      .map((l) => ({ de: l.de, vers: l.vers, montant: Number(l.montant) || 0 }))
      .concat([{ de, vers, montant }]);
  }
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
   * Requête au site, faite par le script d'arrière-plan. Site sans réponse ou
   * en panne (erreur 5xx) : erreur « reseau », et les requêtes suivantes
   * échouent tout de suite pendant OUAF_PAUSE_PANNE.
   *
   * @static
   * @method requete
   * @param {String} methode
   * @param {String} chemin
   * @param {Object} [corps]
   * @param {Number} [delai] attente maximale d'une lecture (ms)
   * @return {Promise<Object>} réponse JSON du site
   */
  static requete(methode, chemin, corps = undefined, delai = OUAF_DELAI_LECTURE) {
    let panne = (texte) => {
      let e = new Error(texte);
      e.name = "reseau";
      return e;
    };
    if (Date.now() - ouafPanne < OUAF_PAUSE_PANNE)
      return Promise.reject(panne("site de suivi sans réponse il y a moins d'une minute"));
    let envoi = Promise.resolve(
      chrome.runtime.sendMessage({ type: "fzzz_ouaf", methode, chemin, corps }),
    );
    if (methode != "PUT")
      envoi = Promise.race([
        envoi,
        new Promise((r) => setTimeout(() => r({ erreur: "delai" }), delai)),
      ]);
    return envoi.then((r) => {
      if (!r) throw new Error("le script d'arrière-plan n'a pas répondu");
      if (r.erreur == "permission") {
        let e = new Error("accès à ouafchaine.fr non autorisé");
        e.name = "permission";
        throw e;
      }
      if (r.erreur || r.statut >= 500) {
        ouafPanne = Date.now();
        throw panne(
          r.erreur == "delai"
            ? "site de suivi sans réponse"
            : r.erreur
              ? "site de suivi injoignable"
              : `site de suivi en panne (erreur ${r.statut})`,
        );
      }
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
    if (connexionOuaf) return connexionOuaf;
    connexionOuaf = OuafSuivi._connecter();
    // échec (code absent, refusé, accès) : la prochaine demande réessaie
    connexionOuaf.catch(() => (connexionOuaf = null));
    return connexionOuaf;
  }
  /**
   * @private
   * @static
   * @method _connecter
   */
  static _connecter() {
    return OuafSuivi.lireCode().then((code) => {
      if (!code) {
        let e = new Error("aucun mot de passe enregistré");
        e.name = "code";
        throw e;
      }
      return OuafSuivi.requete("POST", "/api/session", { mot_de_passe: code }).then((s) => {
        if (!s.connecte) throw new Error("mot de passe refusé par le site de suivi");
        return s;
      });
    });
  }
  /**
   * Convois envoyés en cours, lus dans la page Convois.
   *
   * @static
   * @method convoisJeu
   * @return {Array} [{elt, id, vers, montant, arrivee (ms)}]
   */
  static convoisJeu() {
    let convois = CommerceFzzz.lignes()
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
          annuler = OuafSuivi._lienAnnuler(elt);
        return {
          elt,
          // numéro du convoi dans le jeu (lien Annuler), noté dans le forum
          id: annuler ? parseInt(annuler) : null,
          vers,
          montant,
          arrivee,
        };
      })
      .filter(Boolean);
    OuafSuivi.numeroter(convois);
    return convois;
  }
  /**
   * Le lien Annuler d'un convoi peut disparaître avant son arrivée : son numéro,
   * retenu quand il était visible, lui est rendu (même destinataire, même
   * montant, même arrivée).
   *
   * @static
   * @method numeroter
   * @param {Array} convois voir convoisJeu
   */
  static numeroter(convois) {
    let maintenant = Horloge.maintenant(),
      retenus = Utils.lireStockage(CLE_OUAF_NUMEROS, {});
    for (let id in retenus) if (retenus[id].arrivee < maintenant) delete retenus[id];
    convois
      .filter((c) => c.id)
      .forEach(
        (c) =>
          (retenus[c.id] = { vers: c.vers.toLowerCase(), montant: c.montant, arrivee: c.arrivee }),
      );
    let liste = Object.keys(retenus).map((id) => ({ ...retenus[id], id: parseInt(id) })),
      pris = new Set(convois.map((c) => c.id).filter(Boolean));
    convois
      .filter((c) => !c.id)
      .forEach((c) => {
        let n = OuafSuivi.retrouver(liste, c, pris);
        if (n) pris.add((c.id = n.id));
      });
    try {
      localStorage.setItem(CLE_OUAF_NUMEROS, JSON.stringify(retenus));
    } catch (e) {}
  }
  /**
   * Convoi noté (forum ou ce navigateur) correspondant à un convoi de la page.
   *
   * @static
   * @method retrouver
   * @param {Array} notes [{id, vers, montant, arrivee (ms)}]
   * @param {Object} c {vers, montant, arrivee (ms)}
   * @param {Set<Number>} pris numéros déjà attribués, non réutilisés
   * @return {Object|undefined}
   */
  static retrouver(notes, c, pris) {
    return notes.find(
      (n) =>
        !pris.has(n.id) &&
        String(n.vers).toLowerCase() == c.vers.toLowerCase() &&
        n.montant == c.montant &&
        Math.abs(n.arrivee - c.arrivee) <= OUAF_ECART_ARRIVEE,
    );
  }
  /**
   * Temps de trajet (s) d'un convoi vers un membre, d'après ses coordonnées
   * (cache de Alliance → Membres → Temps de trajet) ; null si inconnues.
   *
   * @static
   * @method trajet
   */
  static trajet(pseudo) {
    let cache = Utils.lireStockage(`outiiil_carteAlliance_${Utils.serveur}_${Utils.alliance}`, {}),
      m = (cache.members || []).find((x) => x.pseudo == pseudo);
    return m && m.x != null && m.y != null && (m.x || m.y) ? monProfil.getTempsParcours2(m) : null;
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
   * Reste à livrer par destinataire (minuscules) d'après les lignes de
   * « Mes convois » : demandé − envoyé, jamais négatif, cumulé par joueur.
   *
   * @static
   * @method restants
   * @param {Array} lignes [{de, vers, demande, envoye}] (celles du joueur connecté)
   * @return {Map<string, number>}
   */
  static restants(lignes) {
    let restes = new Map();
    (lignes || []).forEach((l) => {
      if (!l || !l.vers) return;
      let cle = String(l.vers).toLowerCase(),
        reste = Math.max(0, (Number(l.demande) || 0) - (Number(l.envoye) || 0));
      restes.set(cle, (restes.get(cle) || 0) + reste);
    });
    return restes;
  }
  /**
   * Lecture de « Mes convois » sur le site : reste à livrer par destinataire
   * et membres connus du site.
   *
   * @static
   * @method mesConvois
   * @return {Promise<{restes: Map<string, number>, membres: Array<string>}>}
   */
  static mesConvois() {
    return OuafSuivi.connecter().then(() =>
      OuafSuivi.requete("GET", "/api/mes").then((mes) => ({
        restes: OuafSuivi.restants(mes.lignes),
        membres: mes.membres || [],
      })),
    );
  }
  /**
   * Transmet des convois, l'un après l'autre et après les envois déjà en cours.
   *
   * @static
   * @method envoyer
   * @param {Array} convois voir convoisJeu
   * @param {Function} suivi (convoi, statut, detail) appelé pour chaque convoi
   * @return {Promise<Object>} {envoyes, introuvables, erreurs}
   */
  static envoyer(convois, suivi = () => {}) {
    let envoi = fileEnvoisOuaf.then(() => OuafSuivi._envoyer(convois, suivi));
    fileEnvoisOuaf = envoi.catch(() => {});
    return envoi;
  }
  /**
   * @private
   * @static
   */
  static _envoyer(convois, suivi) {
    let bilan = { envoyes: 0, introuvables: 0, erreurs: 0 };
    return OuafSuivi.connecter().then((session) =>
      OuafSuivi.requete("GET", "/api/mes").then((mes) => {
        let pseudo = mes.pseudo || session.pseudo,
          membres = mes.membres || [];
        return convois
          .reduce(
            (suite, c) =>
              suite.then(() => {
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
                // surplus, ou convoi hors prévision : une avance de plus vers ce joueur
                if (r.avance > 0)
                  etape = etape
                    .then(() => OuafSuivi.requete("GET", "/api/avances"))
                    .then((av) =>
                      OuafSuivi.requete("PUT", "/api/avances", {
                        lignes: OuafSuivi.ajouterAvance(av.lignes, pseudo, nom, r.avance),
                      }),
                    );
                return etape.then(
                  () => {
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
