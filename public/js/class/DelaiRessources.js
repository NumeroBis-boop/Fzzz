// @ts-check
/*
 * DelaiRessources.js
 * NumeroBis-boop
 **********************************************************************/

// lecture de la page Convois à l'ouverture des pages Construction et
// Laboratoire, abandonnée au-delà : « sauf si ça prend trop de temps »
// (demande du mainteneur, 18/11/2026)
const MS_LECTURE_CONVOIS = 5000;
const JOURNAL_DELAI = "Ressources manquantes";
// en dessous, l'info-bulle se place sous le coût plutôt qu'à sa droite
const LARGEUR_BULLE_A_COTE = 760;

/**
 * Pages Construction et Laboratoire : au survol (au toucher sur téléphone) du
 * coût d'un bâtiment ou d'une recherche, l'heure où la nourriture et les
 * matériaux suffiront (demande du mainteneur, 18/11/2026). Calcul des
 * entrepôts (Entrepots.simuler) : production à chaque récolte du jeu, pillage
 * subi déduit, convois de la page Convois relue à l'ouverture de la page. Les
 * ouvrières ne viennent pas de la récolte : rien sur elles.
 *
 * @class DelaiRessources
 */
class DelaiRessources {
  /**
   * Coût d'une ligne de la page (bâtiment ou recherche).
   *
   * @static
   * @method cout
   * @param {any} $ligne tr.ligneAmelioration (jQuery)
   * @return {Array<Number>} [nourriture, matériaux], 0 quand le coût n'en a pas
   */
  static cout($ligne) {
    return ["nourriture", "materiaux"].map((type) =>
      Entrepots.nombre($ligne.find(`.cout_amelioration .${type}`).first().text()),
    );
  }
  /**
   * Pour chaque ressource du coût : ce qui manque et l'heure où le stock suffira.
   *
   * @static
   * @method calculer
   * @param {Array<Number>} cout [nourriture, matériaux]
   * @param {any} etat Entrepots.etat
   * @return {Array<{cout: Number, stock: Number, manque: Number, atteint: Number|null, capacite: Number|null, trop: Boolean, parJour: Number, convois: Array<{t: Number, q: Number}>}|null>}
   *   null : ressource absente du coût ; atteint : l'heure où le stock suffit
   *   (celle de l'état s'il suffit déjà), null s'il ne suffit pas d'ici un an ;
   *   trop : coût au-dessus de la capacité de l'entrepôt, agrandissement en cours compris
   */
  static calculer(cout, etat) {
    return [0, 1].map((i) => {
      if (!(cout[i] > 0)) return null;
      let x = etat.entrepots[i],
        manque = Math.max(0, cout[i] - x.stock),
        capacite = x.agrandissement ? x.agrandissement.capacite : x.capacite,
        trop = manque > 0 && capacite != null && cout[i] > capacite,
        atteint = !manque
          ? etat.maintenant
          : trop
            ? null
            : Entrepots.simuler({
                stock: x.stock,
                capacite: x.capacite == null ? Infinity : x.capacite,
                parJour: etat.parJour[i],
                prochaine: etat.prochaine,
                convois: x.convois,
                maintenant: etat.maintenant,
                agrandissement: x.agrandissement,
                objectif: cout[i],
              }).atteint;
      return {
        cout: cout[i],
        stock: x.stock,
        manque,
        atteint,
        capacite,
        trop,
        parJour: etat.parJour[i],
        convois: x.convois,
      };
    });
  }
  /**
   * Contenu de l'info-bulle d'une ligne : une ligne par ressource du coût,
   * la plus restrictive en premier et en gras, puis ce que le calcul compte
   * pour les ressources qui manquent (format du mainteneur, 18/11/2026).
   *
   * @static
   * @method html
   * @param {Array<Number>} cout [nourriture, matériaux]
   * @return {String} HTML
   */
  static html(cout) {
    let etat = Entrepots.etat(DelaiRessources._ouverture || Horloge.maintenant());
    if (!etat)
      return "Production de ressources inconnue : ouvre la page Ressources pour qu'elle soit lue.";
    let maintenant = Horloge.maintenant(),
      resultats = DelaiRessources.calculer(cout, etat),
      ordre = [0, 1]
        .filter((i) => resultats[i])
        .sort(
          (a, b) =>
            DelaiRessources._rang(/** @type {any} */ (resultats[b])) -
            DelaiRessources._rang(/** @type {any} */ (resultats[a])),
        ),
      lignes = ordre.map((i, k) => {
        let r = /** @type {any} */ (resultats[i]),
          titre = DelaiRessources._titre(r, i, maintenant);
        return k == 0 && r.manque ? `<b>${titre}</b>` : titre;
      }),
      detail = DelaiRessources._composantes(resultats, etat).map(
        (c) =>
          `${c.nom} : ${c.valeurs
            .map(
              (v) => `<span class='${v.n > 0 ? "o_delaiPlus" : "o_delaiMoins"}'>${v.texte}</span>`,
            )
            .join(" et ")}`,
      ),
      notes = DelaiRessources._notes(resultats, etat);
    return (
      lignes.join("<br/>") +
      (detail.length ? `<div class='o_delaiDetail'>${detail.join("<br/>")}</div>` : "") +
      (notes.length ? `<div class='o_delaiNote'>${notes.join("<br/>")}</div>` : "")
    );
  }
  /**
   * « 6j21h », « 5h07 », « 12min ».
   *
   * @static
   * @method duree
   * @param {Number} ms
   * @return {String}
   */
  static duree(ms) {
    let min = Math.max(1, Math.round(ms / 60000)),
      j = Math.floor(min / 1440),
      h = Math.floor((min % 1440) / 60),
      m = min % 60;
    return j ? `${j}j${h}h` : h ? `${h}h${String(m).padStart(2, "0")}` : `${m}min`;
  }
  /**
   * Plus grand pour la ressource la plus restrictive : jamais, pas d'ici un
   * an, l'heure où elle suffit ; 0 si elle suffit déjà.
   *
   * @private
   * @static
   * @param {any} r résultat d'une ressource (calculer)
   * @return {Number}
   */
  static _rang(r) {
    if (!r.manque) return 0;
    // finis, pour que deux rangs égaux se soustraient à 0 dans le tri
    if (DelaiRessources._jamais(r)) return Number.MAX_VALUE;
    return r.atteint == null ? Number.MAX_VALUE / 2 : r.atteint;
  }
  /**
   * « Matériaux suffisants dans 6j21h (Le 25/11 à 07h33) ».
   *
   * @private
   * @static
   * @param {any} r résultat d'une ressource (calculer)
   * @param {Number} i 0 nourriture, 1 matériaux
   * @param {Number} maintenant
   * @return {String} HTML
   */
  static _titre(r, i, maintenant) {
    let nom = ["Pommes", "Matériaux"][i],
      accord = ["suffisantes", "suffisants"][i];
    if (!r.manque) return `${nom} ${accord}`;
    if (r.trop)
      return `${nom} jamais ${accord} : entrepôt trop petit (${numeral(r.capacite).format()})`;
    if (r.atteint == null)
      return DelaiRessources._jamais(r)
        ? `${nom} jamais ${accord} avec la production actuelle`
        : `${nom} pas ${accord} d'ici un an`;
    let date = moment(r.atteint).format("[Le] DD/MM [à] HH[h]mm");
    // heure passée depuis l'ouverture de la page, d'où part le calcul
    return r.atteint > maintenant
      ? `${nom} ${accord} dans ${DelaiRessources.duree(r.atteint - maintenant)} (${date})`
      : `${nom} ${accord} d'après le calcul (${date}) : recharge la page`;
  }
  /**
   * Jamais suffisante : entrepôt trop petit, ou production qui ne fait pas
   * monter le stock et aucun convoi attendu.
   *
   * @private
   * @static
   * @param {any} r résultat d'une ressource (calculer)
   * @return {Boolean}
   */
  static _jamais(r) {
    return r.manque > 0 && (r.trop || (r.atteint == null && r.parJour <= 0 && !r.convois.length));
  }
  /**
   * Ce que le calcul compte pour les ressources qui manquent (pas celles déjà
   * en stock ni un entrepôt trop petit) : production du TdC, convois arrivés
   * avant que la ressource suffise, pillage, champignonnière et armée par
   * jour ; les valeurs nulles sont omises.
   *
   * @private
   * @static
   * @param {Array<any>} resultats (calculer)
   * @param {any} etat Entrepots.etat
   * @return {Array<{nom: String, valeurs: Array<{n: Number, texte: String}>}>}
   */
  static _composantes(resultats, etat) {
    let manquent = [0, 1].filter(
        (i) => resultats[i] && resultats[i].manque > 0 && !resultats[i].trop,
      ),
      unites = ["pommes", "bois"],
      valeur = (
        /** @type {Number} */ n,
        /** @type {Number} */ i,
        /** @type {Boolean} */ parJour,
      ) => ({
        n: Math.round(n),
        texte: `${n > 0 ? "+" : "−"}${numeral(Math.abs(Math.round(n))).format()} ${unites[i]}${parJour ? "/jour" : ""}`,
      }),
      /** @type {Array<{nom: String, valeurs: Array<{n: Number, texte: String}>}>} */
      lignes = [],
      ajouter = (
        /** @type {String} */ nom,
        /** @type {Array<{n: Number, texte: String}>} */ valeurs,
      ) => {
        let nonNulles = valeurs.filter((v) => v.n != 0);
        if (nonNulles.length) lignes.push({ nom, valeurs: nonNulles });
      },
      // convois comptés : arrivés avant que la ressource suffise
      comptes = manquent.map((i) =>
        resultats[i].convois.filter(
          (/** @type {{t: Number, q: Number}} */ c) =>
            resultats[i].atteint == null || c.t <= resultats[i].atteint,
        ),
      ),
      p = etat.production;
    ajouter(
      "Production TdC",
      manquent.map((i) => valeur(p.terrain[i], i, true)),
    );
    ajouter(
      Math.max(0, ...comptes.map((l) => l.length)) > 1 ? "Convois" : "Convoi",
      manquent.map((i, k) =>
        valeur(
          comptes[k].reduce((n, /** @type {{q: Number}} */ c) => n + c.q, 0),
          i,
          false,
        ),
      ),
    );
    ajouter(
      etat.libelleAutres,
      manquent.map((i) => valeur(etat.autres[i], i, true)),
    );
    if (manquent.includes(0)) {
      ajouter("Champi", [valeur(p.champignon[0], 0, true)]);
      ajouter("Armée", [valeur(p.armee[0], 0, true)]);
    }
    return lignes;
  }
  /**
   * Ce qui rend le calcul moins sûr, seulement quand une ressource manque :
   * page Convois pas relue, heure des récoltes inconnue.
   *
   * @private
   * @static
   * @param {Array<any>} resultats (calculer)
   * @param {any} etat Entrepots.etat
   * @return {Array<String>} HTML
   */
  static _notes(resultats, etat) {
    if (!resultats.some((r) => r && r.manque > 0 && !r.trop)) return [];
    let notes = [],
      lecture = DelaiRessources._convois;
    if (lecture.etat == "lecture")
      notes.push("Page Convois en cours de lecture : convois de ta dernière visite.");
    else if (lecture.etat == "echec")
      notes.push(
        `Page Convois pas relue (${Utils.echapper(lecture.raison || "")}) : convois de ta dernière visite.`,
      );
    if (etat.prochaine == null)
      notes.push("Heure des récoltes inconnue : ouvre la page Ressources.");
    return notes;
  }
  /**
   * Lit la page Convois.
   *
   * @static
   * @method chargerConvois
   * @return {Promise<Array<{de: String, t: Number, q: Array<Number>}>>} convois qui arrivent
   */
  static chargerConvois() {
    return Promise.resolve($.ajax({ url: "/commerce.php", timeout: MS_LECTURE_CONVOIS })).then(
      (html) => {
        let $page = Utils.parseHtml(String(html));
        if (!$page.find("#centre").length || !$page.find("#quantite_tdc").length)
          throw new Error("la réponse n'est pas la page Convois");
        return Entrepots.lireConvois($page, Horloge.maintenant());
      },
      (/** @type {any} */ jqXHR) => {
        throw new Error(
          jqXHR && jqXHR.statusText == "timeout"
            ? `pas de réponse en ${MS_LECTURE_CONVOIS / 1000} s`
            : `erreur ${(jqXHR && jqXHR.status) || "réseau"}`,
        );
      },
    );
  }
  /**
   * Relit la page Convois et pose l'info-bulle sur le coût de chaque bâtiment
   * ou recherche de la page.
   *
   * @static
   * @method installer
   * @return {Promise<void>} fin de la lecture de la page Convois, réussie ou non
   */
  static installer() {
    let $cellules = $(".ligneAmelioration > .cout_amelioration").filter(
      (/** @type {Number} */ k, /** @type {HTMLElement} */ td) =>
        DelaiRessources.cout($(td).closest(".ligneAmelioration")).some((n) => n > 0),
    );
    if (!$cellules.length) return Promise.resolve();
    DelaiRessources._ouverture = Horloge.maintenant();
    DelaiRessources._convois = { etat: "lecture", raison: "" };
    let lecture = DelaiRessources.chargerConvois().then(
      (liste) => {
        DelaiRessources._convois = { etat: "lu", raison: "" };
        Entrepots.convoisLus = liste;
        // lignes « Plein dans … » de l'encart, quand elles sont affichées
        if ($("#boiteInfo .o_entrepotPlein").length) Entrepots.afficher();
        DelaiRessources._rafraichir();
      },
      (e) => {
        DelaiRessources._convois = { etat: "echec", raison: String((e && e.message) || e) };
        Journal.info(JOURNAL_DELAI, "page Convois non relue", DelaiRessources._convois.raison);
        DelaiRessources._rafraichir();
      },
    );
    $cellules
      .addClass("o_delaiRessources")
      .each((/** @type {Number} */ k, /** @type {HTMLElement} */ td) => {
        // les title du jeu (Matériaux, Temps pour récolter…) ouvriraient une
        // deuxième info-bulle : retirés pendant le survol, avant ses gestionnaires
        td.addEventListener("mouseover", () => DelaiRessources._titres(td, false), true);
        td.addEventListener("mouseleave", () => DelaiRessources._titres(td, true));
      });
    $cellules.tooltip({
      items: ".o_delaiRessources",
      content: DelaiRessources._contenu,
      // écran étroit : sous la cellule, à côté elle la couvrirait (et le doigt avec)
      position:
        document.documentElement.clientWidth < LARGEUR_BULLE_A_COTE
          ? { my: "center top+8", at: "center bottom", collision: "flipfit" }
          : { my: "left+10 center", at: "right center", collision: "flipfit" },
      tooltipClass: "warning-tooltip o_delaiInfobulle",
    });
    // au toucher : un téléphone n'envoie pas toujours de survol (iPhone, sauf
    // sur un élément cliquable) ; toucher ailleurs la ferme
    $cellules.on("click.o_delai", function () {
      DelaiRessources._fermer(this);
      DelaiRessources._titres(this, false);
      $(this).tooltip("open");
    });
    $(document)
      .off("click.o_delai")
      .on("click.o_delai", (/** @type {any} */ e) => {
        if (!$(e.target).closest(".o_delaiRessources").length) DelaiRessources._fermer(null);
      });
    return lecture;
  }
  /**
   * Ferme les info-bulles ouvertes, sauf celle d'une cellule.
   *
   * @private
   * @static
   * @param {HTMLElement|null} sauf
   */
  static _fermer(sauf) {
    $(".o_delaiRessources[aria-describedby]").each(
      (/** @type {Number} */ k, /** @type {HTMLElement} */ td) => {
        if (td === sauf) return;
        $(td).tooltip("close");
        DelaiRessources._titres(td, true);
      },
    );
  }
  /**
   * Contenu de l'info-bulle, appelé par jQuery UI avec la cellule du coût pour `this`.
   *
   * @private
   * @static
   * @this {HTMLElement}
   * @return {String} HTML
   */
  static _contenu() {
    return DelaiRessources.html(DelaiRessources.cout($(this).closest(".ligneAmelioration")));
  }
  /**
   * Info-bulles ouvertes refaites (page Convois lue entre-temps).
   *
   * @private
   * @static
   */
  static _rafraichir() {
    $(".o_delaiRessources[aria-describedby]").each(
      (/** @type {Number} */ k, /** @type {HTMLElement} */ td) => {
        $(td).tooltip("option", "content", DelaiRessources._contenu);
      },
    );
  }
  /**
   * @private
   * @static
   * @param {HTMLElement} td
   * @param {Boolean} remettre
   */
  static _titres(td, remettre) {
    td.querySelectorAll(remettre ? "[data-o-titre]" : "[title]").forEach((e) => {
      if (remettre) {
        e.setAttribute("title", e.getAttribute("data-o-titre") || "");
        e.removeAttribute("data-o-titre");
      } else {
        e.setAttribute("data-o-titre", e.getAttribute("title") || "");
        e.removeAttribute("title");
      }
    });
  }
}
/** heure d'ouverture de la page : stock de la page et départ du calcul */
DelaiRessources._ouverture = /** @type {Number|null} */ (null);
/** lecture de la page Convois : lecture, lu ou echec (raison) */
DelaiRessources._convois = { etat: "lecture", raison: "" };
