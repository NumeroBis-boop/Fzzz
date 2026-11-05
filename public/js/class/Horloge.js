/*
 * Horloge.js
 * Fzzz
 **********************************************************************/

/**
 * Clé (localStorage) de la latence réglée par le joueur, en millisecondes.
 */
const CLE_LATENCE = "fzzz_latence";
/** Clé (stockage de l'extension) de la position déplacée de l'horloge {x, y} en px. */
const CLE_POSITION_HORLOGE = "fzzz_positionHorloge";
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
    return moment(Horloge.maintenant());
  }
  /**
   * Heure du serveur maintenant, en ms (à défaut, heure du PC). Une heure de
   * jeu (arrivée, retour, fin de ponte…) se compare à elle, pas à Date.now() :
   * l'horloge du PC peut être fausse.
   *
   * @static
   * @method maintenant
   * @return {Number} ms
   */
  static maintenant() {
    return Date.now() + (decalageServeur || 0);
  }
  /**
   * Heure du serveur à un instant donné de l'horloge du PC (ms).
   *
   * @static
   * @method serveurA
   * @param {Number} local
   * @return {Object} moment
   */
  static serveurA(local) {
    return moment(local + (decalageServeur || 0));
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
    return moment(Horloge.maintenant() + Horloge.latence);
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
   * Horloge flottante : fixée à l'écran (visible en faisant défiler la page),
   * déplaçable en la faisant glisser, position retenue d'une page à l'autre.
   * Première fois : au-dessus de l'encart « S5 Pseudo ». Mise à jour calée sur
   * le changement de seconde.
   *
   * @static
   * @method afficher
   */
  static afficher() {
    if ($("#o_horloge").length) return;
    let $h = $(`<div id='o_horloge' title=''>
        <span class='o_horlogeLatence'>
          <button type='button' id='o_latenceMoins' title='Latence − 0,1 s'>−</button>
          <span id='o_latenceValeur' title='Latence : délai entre ton clic et sa prise en compte par le serveur. Elle est ajoutée à l’heure affichée et aux synchronisations d’attaque.'></span>
          <button type='button' id='o_latencePlus' title='Latence + 0,1 s'>+</button>
        </span>
        <span id='o_horlogeHeure'></span>
      </div>`).appendTo("body"),
      h = $h[0],
      // position déplacée {x, y} (px dans la fenêtre), null : position d'origine
      retenue = null,
      placer = (x, y) => {
        let maxX = document.documentElement.clientWidth - h.offsetWidth,
          maxY = document.documentElement.clientHeight - h.offsetHeight;
        h.style.left = Math.max(0, Math.min(x, maxX)) + "px";
        h.style.top = Math.max(0, Math.min(y, maxY)) + "px";
      },
      // largeur de l'encart « S5 Pseudo » (dessiné par ses éléments internes),
      // police réduite jusqu'à ce que l'heure et la latence y tiennent
      caler = () => {
        let boite = $("#boiteInfo")[0],
          r = boite ? Dock.emprise(boite) : null;
        if (r && r.width) h.style.width = r.width + "px";
        $("#o_horlogeHeure").css("font-size", "1em");
        let taille = 20;
        h.style.fontSize = taille + "px";
        if (h.scrollWidth > h.clientWidth)
          taille = Math.max(10, Math.floor((20 * h.clientWidth) / h.scrollWidth));
        for (; taille >= 10; taille--) {
          h.style.fontSize = taille + "px";
          if (taille == 20 || h.scrollWidth <= h.clientWidth) break;
        }
        $("#o_horlogeHeure").css("font-size", "0.7em");
        if (retenue) placer(retenue.x, retenue.y);
        else placer(r ? r.left : 8, r ? r.top - h.offsetHeight - 6 : 8);
      },
      appliquer = (pos) => {
        retenue = pos && pos.x != null ? pos : null;
        caler();
        h.style.visibility = "";
      },
      enregistrer = (pos) => {
        try {
          chrome.storage.local.set({ [CLE_POSITION_HORLOGE]: pos });
        } catch (err) {}
      };
    // position partagée par toutes les pages et onglets du jeu (http et https
    // compris) : stockage de l'extension, suivi en direct
    h.style.visibility = "hidden";
    try {
      chrome.storage.local.get(CLE_POSITION_HORLOGE).then(
        (r) => appliquer(r[CLE_POSITION_HORLOGE]),
        () => appliquer(null),
      );
      chrome.storage.onChanged.addListener((changements, zone) => {
        if (zone == "local" && changements[CLE_POSITION_HORLOGE])
          appliquer(changements[CLE_POSITION_HORLOGE].newValue);
      });
    } catch (e) {
      appliquer(null);
    }
    // encadrés du jeu placés tardivement : position d'origine recalculée
    $(window).on("load resize", caler);
    setTimeout(caler, 1000);
    // glisser (souris ou doigt) ailleurs que sur les boutons de latence
    h.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      let dx = e.clientX - h.offsetLeft,
        dy = e.clientY - h.offsetTop,
        bouger = (m) => placer(m.clientX - dx, m.clientY - dy),
        lacher = () => {
          h.removeEventListener("pointermove", bouger);
          h.classList.remove("o_horlogeDeplace");
          retenue = { x: h.offsetLeft, y: h.offsetTop };
          enregistrer(retenue);
        };
      e.preventDefault();
      h.setPointerCapture(e.pointerId);
      h.classList.add("o_horlogeDeplace");
      h.addEventListener("pointermove", bouger);
      h.addEventListener("pointerup", lacher, { once: true });
      h.addEventListener("pointercancel", lacher, { once: true });
    });
    let regler = (delta) => (e) => {
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
    let local = Horloge.heureLocale(Horloge.maintenant()),
      titre = Horloge.estSynchronisee()
        ? `Heure du serveur${local ? " (Paris)" : ""} + latence`
        : "Heure du PC : l’heure du serveur sera connue après le chargement d’une page du jeu";
    $("#o_horloge")
      .toggleClass("o_horlogePC", !Horloge.estSynchronisee())
      .attr("title", local ? `${titre}\n${local}` : titre);
  }
  /**
   * Heure locale du joueur dont le PC n'est pas à l'heure de Paris, pour
   * l'info-bulle de l'horloge (le reste de l'extension suit l'heure du jeu).
   *
   * @static
   * @method heureLocale
   * @param {Number} instant ms
   * @return {String|null} null sur un PC à l'heure de Paris
   */
  static heureLocale(instant) {
    if (typeof PC_AUTRE_FUSEAU == "undefined" || !PC_AUTRE_FUSEAU) return null;
    let local = moment(instant).local(),
      ecart = local.utcOffset() - moment.tz(instant, FUSEAU_JEU).utcOffset(),
      heures = Math.floor(Math.abs(ecart) / 60),
      minutes = Math.abs(ecart) % 60,
      duree = `${heures} h${minutes ? " " + String(minutes).padStart(2, "0") : ""}`;
    return `Chez toi : ${local.format("HH:mm")}${ecart ? ` (${duree} ${ecart < 0 ? "de moins" : "de plus"} que le jeu)` : ""}`;
  }
}
