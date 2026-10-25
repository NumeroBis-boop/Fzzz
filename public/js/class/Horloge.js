/*
 * Horloge.js
 * Fzzz
 **********************************************************************/

/**
 * Clé (localStorage) de la latence réglée par le joueur, en millisecondes.
 */
const CLE_LATENCE = "fzzz_latence";
/**
 * Décalage estimé heure serveur − heure du PC, en ms (null tant qu'aucune
 * réponse du serveur n'a été observée).
 */
let decalageServeur = null;

/**
 * Heure du serveur de jeu, et horloge affichée au-dessus de l'encart « S5 Pseudo ».
 *
 * Le script d'arrière-plan relève l'en-tête HTTP `Date` des réponses du jeu
 * (entrypoints/background.ts), sans émettre de requête. `Date` est tronqué à la
 * seconde : pour une réponse demandée à l'instant local `envoi` et reçue à
 * `reception`, le décalage est dans [date − reception, date + 1000 − envoi].
 * L'intersection des intervalles de plusieurs réponses resserre l'estimation,
 * souvent sous quelques dixièmes de seconde après quelques pages.
 *
 * La latence, réglée par pas de 0,1 s, est le délai entre le clic et la prise
 * en compte de l'action par le serveur. Horloge.clic() donne donc l'heure
 * serveur à laquelle un clic fait maintenant sera enregistré : c'est l'heure
 * affichée, et celle qu'utilisent les outils de synchronisation des attaques.
 *
 * @class Horloge
 */
class Horloge {
  /**
   * Estime le décalage à partir des échantillons, du plus récent au plus
   * ancien. Si les intervalles cessent de se recouper (heure du PC réglée,
   * mise en veille…), on garde seulement les plus récents.
   *
   * @static
   * @method estimer
   * @param {Array} echantillons {date, envoi, reception}, du plus ancien au plus récent
   * @return {Number|null} décalage en ms
   */
  static estimer(echantillons) {
    let min = -Infinity,
      max = Infinity;
    for (let i = echantillons.length - 1; i >= 0; i--) {
      let e = echantillons[i],
        a = Math.max(min, e.date - e.reception),
        b = Math.min(max, e.date + 1000 - e.envoi);
      if (a > b) break;
      min = a;
      max = b;
    }
    return min > -Infinity ? (min + max) / 2 : null;
  }
  /**
   * Charge les échantillons du serveur courant et suit leurs mises à jour.
   *
   * @static
   * @method initialiser
   * @return {Promise}
   */
  static initialiser() {
    let cle = `fzzz_horloge_${location.hostname.split(".")[0]}`,
      appliquer = (liste) => {
        if (Array.isArray(liste) && liste.length) {
          decalageServeur = Horloge.estimer(liste);
          Horloge._majAffichage();
        }
      };
    try {
      chrome.storage.onChanged.addListener((changements, zone) => {
        if (zone == "local" && changements[cle]) appliquer(changements[cle].newValue);
      });
      return chrome.storage.local.get(cle).then((r) => appliquer(r[cle]));
    } catch (e) {
      return Promise.resolve();
    }
  }
  /**
   * @static
   * @return {Boolean} vrai si l'heure du serveur est connue
   */
  static estSynchronisee() {
    return decalageServeur !== null;
  }
  /**
   * @static
   * @return {Integer} latence en ms (multiple de 100)
   */
  static get latence() {
    return parseInt(localStorage.getItem(CLE_LATENCE)) || 0;
  }
  static set latence(ms) {
    let v = Math.max(-5000, Math.min(5000, Math.round(ms / 100) * 100));
    localStorage.setItem(CLE_LATENCE, v);
  }
  /**
   * Heure du serveur maintenant (à défaut, heure du PC).
   *
   * @static
   * @method serveur
   * @return {Object} moment
   */
  static serveur() {
    return moment(Date.now() + (decalageServeur || 0));
  }
  /**
   * Heure serveur à laquelle un clic fait maintenant sera pris en compte :
   * heure du serveur + latence.
   *
   * @static
   * @method clic
   * @return {Object} moment
   */
  static clic() {
    return moment(Date.now() + (decalageServeur || 0) + Horloge.latence);
  }
  /**
   * Libellé de la latence, ex. « +0,3 s ».
   *
   * @static
   */
  static libelleLatence() {
    let v = Horloge.latence / 1000;
    return `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1).replace(".", ",")} s`;
  }
  /**
   * Place l'horloge au-dessus de l'encart « S5 Pseudo » et lance sa mise à jour,
   * calée sur le changement de seconde.
   *
   * @static
   * @method afficher
   */
  static afficher() {
    let $boite = $("#boiteInfo");
    if (!$boite.length || $("#o_horloge").length) return;
    // Ancrée à l'encart : elle suit sa position, qu'il défile avec la page ou non.
    if ($boite.css("position") == "static") $boite.css("position", "relative");
    $boite.css("overflow", "visible");
    $(`<div id='o_horloge'>
        <span class='o_horlogeLatence'>
          <button type='button' id='o_latenceMoins' title='Latence − 0,1 s'>−</button>
          <span id='o_latenceValeur' title='Latence : délai entre ton clic et sa prise en compte par le serveur. Elle est ajoutée à l’heure affichée et aux synchronisations d’attaque.'></span>
          <button type='button' id='o_latencePlus' title='Latence + 0,1 s'>+</button>
        </span>
        <span id='o_horlogeHeure'></span>
      </div>`).prependTo($boite);
    // Le cadre visible de l'encart est dessiné par ses éléments internes, plus
    // larges que #boiteInfo lui-même : on mesure leur emprise réelle et on y
    // cale l'horloge (largeur minimale ; elle s'élargit si son contenu dépasse).
    let caler = () => {
      let boite = $boite[0].getBoundingClientRect(),
        gauche = boite.left,
        droite = boite.right;
      $boite
        .find("*")
        .not("#o_horloge, #o_horloge *")
        .each((i, elt) => {
          let r = elt.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            gauche = Math.min(gauche, r.left);
            droite = Math.max(droite, r.right);
          }
        });
      let $h = $("#o_horloge").css({
        left: gauche - boite.left + "px",
        width: droite - gauche + "px",
        minWidth: 0,
        right: "auto",
        float: "none",
      });
      // police réduite jusqu'à ce que l'heure et la latence tiennent dans le
      // cadre, puis l'heure seule réduite de 30 %
      $("#o_horlogeHeure").css("font-size", "1em");
      for (let taille = 20; taille >= 10; taille--) {
        $h.css("font-size", taille + "px");
        if ($h[0].scrollWidth <= $h[0].clientWidth) break;
      }
      $("#o_horlogeHeure").css("font-size", "0.7em");
    };
    caler();
    // recalage une fois les images et polices du jeu chargées
    $(window).on("load resize", caler);
    setTimeout(caler, 1000);
    let regler = (delta) => (e) => {
      // l'encart est cliquable (lien vers le profil) : le clic s'arrête ici
      e.preventDefault();
      e.stopPropagation();
      Horloge.latence = Horloge.latence + delta;
      Horloge._majAffichage();
    };
    $("#o_latenceMoins").click(regler(-100));
    $("#o_latencePlus").click(regler(100));
    let tic = () => {
      Horloge._majAffichage();
      // prochain tic juste après le changement de seconde affiché
      setTimeout(tic, 1000 - (Horloge.clic().valueOf() % 1000) + 5);
    };
    tic();
  }
  /**
   * @private
   * @static
   * @method _majAffichage
   */
  static _majAffichage() {
    if (!$("#o_horloge").length) return;
    $("#o_horlogeHeure").text(Horloge.clic().format("HH:mm:ss"));
    $("#o_latenceValeur").text(Horloge.libelleLatence());
    $("#o_horloge")
      .toggleClass("o_horlogePC", !Horloge.estSynchronisee())
      .attr(
        "title",
        Horloge.estSynchronisee()
          ? "Heure du serveur + latence"
          : "Heure du PC : l’heure du serveur sera connue après le chargement d’une page du jeu",
      );
  }
}
