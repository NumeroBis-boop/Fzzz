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
/**
 * Requêtes de fond (option `fond: true` de $.ajax) : l'export automatique des
 * chasses, la priorité la plus faible de toutes (règle du mainteneur). Elles ne
 * partent que quand aucune autre n'attend, et PAUSE_AVANT_FOND après la fin de
 * la dernière autre : la requête suivante d'un enchaînement (partage, lecture
 * d'une page), envoyée à la réponse de la précédente, passe avant elles.
 */
const PAUSE_AVANT_FOND = 1000;
/**
 * Requêtes au jeu terminées depuis l'ouverture de la page, pour la mesure du
 * chargement des vues (Journal.mesurer) : nombre et durée de l'envoi à la
 * réponse (attente dans la file exclue), celles du forum à part, et lectures
 * évitées : faites il y a moins d'une minute (PartageChasses._enCache) ou
 * sujet inchangé (PartageChasses.sujetGarde).
 */
const COMPTE_REQUETES = { nombre: 0, duree: 0, forum: 0, dureeForum: 0, cache: 0 };

(function () {
  const ajaxOriginal = $.ajax,
    VERROU = "Une autre action est en cours sur votre compte",
    ESSAIS_MAX = 8,
    DELAI_ESSAI = 400, // ms, multiplié par le numéro de l'essai
    // sans délai max, une requête qui ne répond jamais bloquerait toute la file
    DELAI_MAX = 30000;
  let enCours = false,
    finAction = 0,
    // fin de la dernière requête qui n'est pas de fond
    finAutre = 0,
    attente = null,
    actions = [],
    lectures = [],
    fonds = [];

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

  // une requête à la fois : les actions d'abord, les lectures ensuite, les
  // requêtes de fond en dernier
  let suivante = () => {
    if (enCours) return;
    let envoi = actions.shift(),
      file = envoi ? "action" : "";
    if (!envoi && (lectures.length || fonds.length)) {
      let reste =
        Math.max(
          finAction + PAUSE_APRES_ACTION,
          lectures.length ? 0 : finAutre + PAUSE_AVANT_FOND,
        ) - Date.now();
      if (reste > 0) {
        clearTimeout(attente);
        attente = setTimeout(suivante, reste);
        return;
      }
      file = lectures.length ? "lecture" : "fond";
      envoi = (lectures.length ? lectures : fonds).shift();
    }
    if (!envoi) return;
    enCours = true;
    envoi().then(() => {
      enCours = false;
      if (file != "fond") finAutre = Date.now();
      if (file == "action") finAction = finAutre;
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
    let { success, error, complete, context, action, fond, ...requete } = options,
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
    let forum = /\/alliance\.php\?forum_menu/i.test(String(url)),
      tache = () => {
        let depart = performance.now();
        return envoyer(1).then(() => {
          let duree = performance.now() - depart;
          COMPTE_REQUETES.nombre++;
          COMPTE_REQUETES.duree += duree;
          if (forum) {
            COMPTE_REQUETES.forum++;
            COMPTE_REQUETES.dureeForum += duree;
          }
        });
      };
    (action || estAction(requete) ? actions : fond ? fonds : lectures).push(tache);
    suivante();
    return differe.promise();
  };
})();
