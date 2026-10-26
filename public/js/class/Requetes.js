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
(function () {
  const ajaxOriginal = $.ajax,
    VERROU = "Une autre action est en cours sur votre compte",
    ESSAIS_MAX = 8,
    DELAI_ESSAI = 400, // ms, multiplié par le numéro de l'essai
    // sans délai max, une requête qui ne répond jamais bloquerait toute la file
    DELAI_MAX = 30000;
  let file = Promise.resolve();

  let versLeJeu = (url) =>
    typeof url == "string" && (url.startsWith(location.origin) || url.startsWith("/"));

  $.ajax = function (url, options) {
    if (typeof url == "object") {
      options = url;
      url = options.url;
    }
    options = { ...(options || {}), url };
    if (!versLeJeu(url)) return ajaxOriginal.call(this, options);
    // les callbacks sont appelés une seule fois, sur le résultat final, et pas à
    // chaque essai refusé
    let { success, error, complete, context, ...requete } = options,
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
    file = file.then(() => envoyer(1));
    return differe.promise();
  };
})();
