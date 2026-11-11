// @ts-check
/*
 * Requetes.js
 * File d'attente des requêtes de l'extension vers le jeu.
 **********************************************************************/

/**
 * Les serveurs récents (s5, derrière un proxy envoy) refusent une requête si
 * une autre est déjà en cours sur le compte : 503 « Une autre action est en
 * cours sur votre compte, réessayez dans un instant. » Le jeu, lui, n'en
 * envoie jamais deux à la fois, mais l'extension en lançait souvent plusieurs
 * en parallèle (actualisation de l'alliance, carte, radar, démarrage…) et la
 * plupart échouaient.
 *
 * On remplace donc $.ajax (que $.get et $.post appellent aussi) : les requêtes
 * vers le jeu partent une par une, et une requête refusée pour ce motif est
 * réessayée après un court délai. Les autres requêtes ne passent pas par la file.
 * L'objet renvoyé est une promesse jQuery, résolue avec les mêmes arguments que
 * $.ajax : les .then / .done / .fail / .always et Promise.all existants marchent
 * sans changement.
 */
/**
 * Requêtes qui exécutent une action du joueur (attaque, sonde, chasse,
 * déplacement d'armée, annulation) : elles passent devant les lectures
 * automatiques (forum, profils, Reine…). Après l'une d'elles, les lectures
 * attendent PAUSE_APRES_ACTION : les étapes suivantes d'un enchaînement
 * (flood, chasses espacées, replacement) passent sans attendre derrière elles.
 * Une lecture qui fait partie d'un tel enchaînement (relecture de la page Armée
 * pendant un replacement) le dit avec l'option `action: true` de $.ajax.
 */
const REQUETES_ACTION = [
  { url: /\/ennemie\.php\?(Attaquer|annuler)=/i },
  { url: /\/AcquerirTerrain\.php/i },
  { url: /\/Armee\.php\?(deplacement|Transferer|annuler)/i },
  { url: /\/Armee\.php/i, methode: "POST" },
  { url: /\/Ressources\.php\?annuler=/i },
];
const PAUSE_APRES_ACTION = 2500;

(function () {
  const ajaxOriginal = $.ajax,
    VERROU = "Une autre action est en cours sur votre compte",
    ESSAIS_MAX = 8,
    DELAI_ESSAI = 400, // ms, multiplié par le numéro de l'essai
    // sans délai max, une requête qui ne répond jamais bloquerait toute la file
    DELAI_MAX = 30000;
  let enCours = false,
    finAction = 0,
    attente = null,
    actions = [],
    lectures = [];

  let versLeJeu = (url) =>
    typeof url == "string" && (url.startsWith(location.origin) || url.startsWith("/"));

  let estAction = (requete) => {
    let d = requete.data,
      adresse = requete.url + (d ? "?" + (typeof d == "string" ? d : $.param(d)) : "");
    return REQUETES_ACTION.some(
      (r) =>
        r.url.test(adresse) &&
        (!r.methode || String(requete.method || requete.type || "GET").toUpperCase() == r.methode),
    );
  };

  // une requête à la fois : les actions d'abord, les lectures ensuite
  let suivante = () => {
    if (enCours) return;
    let envoi = actions.shift(),
      action = !!envoi;
    if (!envoi && lectures.length) {
      let reste = finAction + PAUSE_APRES_ACTION - Date.now();
      if (reste > 0) {
        clearTimeout(attente);
        attente = setTimeout(suivante, reste);
        return;
      }
      envoi = lectures.shift();
    }
    if (!envoi) return;
    enCours = true;
    envoi().then(() => {
      enCours = false;
      if (action) finAction = Date.now();
      suivante();
    });
  };

  $.ajax = function (url, options) {
    if (typeof url == "object") {
      options = url;
      url = options.url;
    }
    options = { ...(options || {}), url };
    if (!versLeJeu(url)) return ajaxOriginal.call(this, options);
    // les callbacks sont appelés une seule fois, sur le résultat final, et pas à
    // chaque essai refusé
    let { success, error, complete, context, action, ...requete } = options,
      differe = $.Deferred(),
      appeler = (f, args) => {
        if (f) [].concat(f).forEach((g) => g.apply(context || requete, args));
      };
    if (requete.timeout == null) requete.timeout = DELAI_MAX;
    let envoyer = (essai) =>
      new Promise((fin) => {
        ajaxOriginal(requete).then(
          (data, statut, jqXHR) => {
            appeler(success, [data, statut, jqXHR]);
            appeler(complete, [jqXHR, statut]);
            differe.resolve(data, statut, jqXHR);
            fin();
          },
          (jqXHR, statut, erreur) => {
            if (
              jqXHR.status == 503 &&
              String(jqXHR.responseText || "").indexOf(VERROU) != -1 &&
              essai < ESSAIS_MAX
            )
              setTimeout(() => envoyer(essai + 1).then(fin), DELAI_ESSAI * essai);
            else {
              appeler(error, [jqXHR, statut, erreur]);
              appeler(complete, [jqXHR, statut]);
              differe.reject(jqXHR, statut, erreur);
              fin();
            }
          },
        );
      });
    (action || estAction(requete) ? actions : lectures).push(() => envoyer(1));
    suivante();
    return differe.promise();
  };
})();
