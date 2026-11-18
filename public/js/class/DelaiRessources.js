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
   * Contenu de l'info-bulle d'une ligne.
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
      utiles = /** @type {Array<any>} */ (resultats.filter(Boolean)),
      quand = (/** @type {Number} */ ms) => moment(ms).format("[le] DD/MM [à] HH[h]mm"),
      dans = (/** @type {Number} */ ms) =>
        ms > maintenant ? ` (dans ${Entrepots.duree(ms - maintenant)})` : "",
      // heure passée depuis l'ouverture de la page, d'où part le calcul (page restée ouverte)
      passee = (/** @type {Number} */ ms) => ms <= maintenant && ms > etat.maintenant,
      noms = ["Nourriture", "Matériaux"],
      accords = ["suffisante", "suffisants"],
      lignes = [];
    if (utiles.length > 1) {
      let dates = utiles.map((r) => r.atteint),
        fin = dates.every((d) => d != null) ? Math.max(...dates) : null;
      lignes.push(
        `<b>${
          utiles.every((r) => !r.manque)
            ? "Ressources suffisantes"
            : fin != null
              ? `Ressources suffisantes ${quand(fin)}${dans(fin)}${passee(fin) ? ", d'après le calcul : recharge la page" : ""}`
              : utiles.some((r) => DelaiRessources._jamais(r))
                ? "Ressources jamais suffisantes"
                : "Ressources pas suffisantes d'ici un an"
        }</b>`,
      );
    }
    resultats.forEach((r, i) => {
      if (!r) return;
      let etatRessource = !r.manque
        ? `${accords[i]} (${numeral(r.stock).format()} en stock)`
        : r.trop
          ? `il en faut ${numeral(r.cout).format()}, plus que ne contient ton entrepôt (${numeral(r.capacite).format()}) : jamais ${accords[i]}`
          : r.atteint != null
            ? `il en manque ${numeral(r.manque).format()}, ${accords[i]} ${quand(r.atteint)}${dans(r.atteint)}${passee(r.atteint) ? ", d'après le calcul : recharge la page" : ""}`
            : DelaiRessources._jamais(r)
              ? `il en manque ${numeral(r.manque).format()}, jamais ${accords[i]} avec la production actuelle (${numeral(Math.round(r.parJour)).format()} par jour)`
              : `il en manque ${numeral(r.manque).format()}, pas ${accords[i]} d'ici un an`;
      lignes.push(`<b>${noms[i]}</b> : ${etatRessource}`);
    });
    lignes.push(DelaiRessources._ligneConvois(resultats, quand, etat.maintenant));
    lignes.push(
      `<span class='o_delaiNote'>${DelaiRessources._ligneProduction(etat, resultats, maintenant)}</span>`,
    );
    return lignes.join("<br/>");
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
   * @private
   * @static
   * @param {Array<any>} resultats (calculer)
   * @param {function(Number): String} quand
   * @param {Number} depuis départ du calcul : les convois arrivés après sont comptés
   * @return {String} HTML
   */
  static _ligneConvois(resultats, quand, depuis) {
    let lecture = DelaiRessources._convois,
      source =
        lecture.etat == "lu"
          ? ""
          : lecture.etat == "lecture"
            ? " (page Convois en cours de lecture : convois de ta dernière visite de la page Convois)"
            : ` (page Convois pas relue, ${Utils.echapper(lecture.raison || "")} : convois de ta dernière visite de la page Convois)`,
      types = [0, 1].filter((i) => resultats[i]),
      liste = (Entrepots.convoisLus || Entrepots.convoisGardes())
        .filter((c) => c.t > depuis && types.some((i) => c.q[i] > 0))
        .map(
          (c) =>
            `${Utils.echapper(c.de || "?")} ${types
              .filter((i) => c.q[i] > 0)
              .map((i) => Entrepots.montant(c.q[i], i))
              .join(" ")} ${quand(c.t)}`,
        );
    return liste.length
      ? `Convois attendus, comptés à leur arrivée${source} : ${liste.join(" ; ")}`
      : `Aucun convoi attendu${source}.`;
  }
  /**
   * @private
   * @static
   * @param {any} etat Entrepots.etat
   * @param {Array<any>} resultats (calculer)
   * @param {Number} maintenant
   * @return {String} HTML
   */
  static _ligneProduction(etat, resultats, maintenant) {
    let parJour = [0, 1]
        .filter((i) => resultats[i])
        .map(
          (i) =>
            `${etat.parJour[i] > 0 ? "+" : ""}${numeral(Math.round(etat.parJour[i])).format()} ${i ? "matériaux" : "nourriture"}`,
        )
        .join(" et "),
      pillage =
        etat.taux > 0
          ? `, pillage subi déduit (${numeral(etat.taux * 100).format()} %)`
          : etat.pillage
            ? ", pillage subi déduit"
            : "";
    if (etat.prochaine == null)
      return `Production de ${parJour} par jour${pillage}, étalée sur la journée : heure des récoltes inconnue, ouvre la page Ressources pour qu'elle soit lue.`;
    let prochaine = etat.prochaine;
    while (prochaine < maintenant) prochaine += MS_RECOLTE;
    return `Production de ${parJour} par jour${pillage}, comptée à chaque récolte du jeu, toutes les 30 min (la prochaine à ${moment(prochaine).format("HH[h]mm")}).`;
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
