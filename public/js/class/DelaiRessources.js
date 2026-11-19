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
 * matériaux suffiront (demande du mainteneur, 18/11/2026), et dans la cellule
 * du coût le temps avant de pouvoir lancer, à la place de celui du Compte+ qui
 * ne compte que la production (19/11/2026). Calcul des entrepôts
 * (Entrepots.simuler) : production à chaque récolte du jeu, pillage subi
 * déduit, convois de la page Convois relue à l'ouverture de la page. Les
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
   * Contenu de l'info-bulle d'une ligne : un bloc par ressource du coût, la
   * plus restrictive en premier et en gras ; sous une ressource qui manque, ce
   * que le calcul compte jusqu'à ce qu'elle suffise, en cycles de récolte
   * (format du mainteneur, 19/11/2026).
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
      blocs = ordre.map((i, k) => {
        let r = /** @type {any} */ (resultats[i]),
          titre = DelaiRessources._titre(r, i, maintenant),
          detail = DelaiRessources._detail(r, i, etat);
        return `<div class='o_delaiBloc'>${k == 0 && r.manque ? `<b>${titre}</b>` : titre}${
          detail.length ? `<div class='o_delaiDetail'>${detail.join("<br/>")}</div>` : ""
        }</div>`;
      }),
      notes = DelaiRessources._notes(resultats, etat);
    return (
      blocs.join("") + (notes.length ? `<div class='o_delaiNote'>${notes.join("<br/>")}</div>` : "")
    );
  }
  /**
   * Durée entre deux heures, en minutes entières de l'horloge (la minute de
   * `debut` plus la durée donne celle de `fin`) : « 6j 21h 33m », « 5h 07m »,
   * « 12m », au moins une minute.
   *
   * @static
   * @method duree
   * @param {Number} debut ms
   * @param {Number} fin ms
   * @return {String}
   */
  static duree(debut, fin) {
    let min = Math.max(1, Math.floor(fin / 60000) - Math.floor(debut / 60000)),
      j = Math.floor(min / 1440),
      h = Math.floor((min % 1440) / 60),
      m = min % 60;
    return [j ? `${j}j` : "", h ? `${h}h` : "", m ? `${h ? String(m).padStart(2, "0") : m}m` : ""]
      .filter(Boolean)
      .join(" ");
  }
  /**
   * « REQUIS : Entrepôt de Nourriture niveau 16 » : le plus petit entrepôt qui
   * contient le coût (règle du mainteneur, 19/11/2026).
   *
   * @static
   * @method requis
   * @param {Number} i 0 nourriture, 1 matériaux
   * @param {Number} cout
   * @return {String}
   */
  static requis(i, cout) {
    return `REQUIS : Entrepôt de ${["Nourriture", "Matériaux"][i]} niveau ${Entrepots.niveauPour(cout)}`;
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
    if (r.trop) return DelaiRessources.requis(i, r.cout);
    if (r.atteint == null)
      return DelaiRessources._jamais(r)
        ? `${nom} jamais ${accord} avec la production actuelle`
        : `${nom} pas ${accord} d'ici un an`;
    let date = moment(r.atteint).format("[Le] DD/MM [à] HH[h]mm");
    // heure passée depuis l'ouverture de la page, d'où part le calcul
    return r.atteint > maintenant
      ? `${nom} ${accord} dans ${DelaiRessources.duree(maintenant, r.atteint)} (${date})`
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
   * Récoltes du jeu comptées pour une ressource, de l'ouverture de la page à
   * l'heure où elle suffit ; sans heure de récolte connue, leur nombre est
   * estimé (durée ÷ 30 min).
   *
   * @static
   * @method cycles
   * @param {any} etat Entrepots.etat
   * @param {Number} atteint ms
   * @return {{nombre: Number, estime: Boolean, premiere: Number|null, derniere: Number|null}}
   */
  static cycles(etat, atteint) {
    if (etat.prochaine == null)
      return {
        nombre: Math.max(0, atteint - etat.maintenant) / MS_RECOLTE,
        estime: true,
        premiere: null,
        derniere: null,
      };
    return { ...Entrepots.recoltes(etat.prochaine, etat.maintenant, atteint), estime: false };
  }
  /**
   * Ce que le calcul compte pour une ressource qui manque (pas une déjà en
   * stock ni un entrepôt trop petit), jusqu'à ce qu'elle suffise : le nombre de
   * cycles de récolte et ce qu'il représente, production du TdC,
   * champignonnière, armée et pillage sur ces cycles, convois arrivés d'ici
   * là ; les valeurs nulles sont omises. Ressource qui ne suffit pas d'ici un
   * an ou jamais : par jour.
   *
   * @private
   * @static
   * @param {any} r résultat de la ressource (calculer)
   * @param {Number} i 0 nourriture, 1 matériaux
   * @param {any} etat Entrepots.etat
   * @return {Array<String>} HTML, une ligne par élément
   */
  static _detail(r, i, etat) {
    if (!r.manque || r.trop) return [];
    let unite = ["pommes", "bois"][i],
      p = etat.production,
      c = r.atteint == null ? null : DelaiRessources.cycles(etat, r.atteint),
      // estimé : au moins un cycle quand la ressource suffit avant 15 min
      n = c ? (c.estime ? Math.max(1, Math.round(c.nombre)) : c.nombre) : 0,
      suite = c
        ? ` en ${c.estime ? "≈ " : ""}${numeral(n).format()} ${n > 1 ? "cycles" : "cycle"}`
        : "",
      facteur = c ? c.nombre / RECOLTES_PAR_JOUR : 1,
      /** @type {Array<String>} */
      lignes = [],
      ajouter = (
        /** @type {String} */ nom,
        /** @type {Number} */ quantite,
        /** @type {String} */ apres,
      ) => {
        let v = Math.round(quantite);
        if (v)
          lignes.push(
            `${nom} : <span class='${v > 0 ? "o_delaiPlus" : "o_delaiMoins"}'>${v > 0 ? "+" : "−"}${numeral(Math.abs(v)).format()} ${unite}${c ? "" : "/jour"}</span>${apres}`,
          );
      },
      // convois comptés : arrivés avant que la ressource suffise
      convois = r.convois.filter(
        (/** @type {{t: Number}} */ x) => r.atteint == null || x.t <= r.atteint,
      );
    if (c && c.nombre > 0) lignes.push(DelaiRessources._ligneCycles(c, etat.maintenant));
    ajouter("Prod TdC", p.terrain[i] * facteur, suite);
    if (i == 0) {
      ajouter("Champi", p.champignon[0] * facteur, suite);
      ajouter("Armée", p.armee[0] * facteur, suite);
    }
    ajouter(etat.libelleAutres, etat.autres[i] * facteur, suite);
    if (convois.length)
      ajouter(
        `${convois.length} ${convois.length > 1 ? "convois" : "convoi"}`,
        convois.reduce((s, /** @type {{q: Number}} */ x) => s + x.q, 0),
        "",
      );
    return lignes;
  }
  /**
   * « 332 cycles : les 332 récoltes du jeu (une toutes les 30 min) de 10h03
   * au 25/11 à 07h33 ».
   *
   * @private
   * @static
   * @param {{nombre: Number, estime: Boolean, premiere: Number|null, derniere: Number|null}} c
   * @param {Number} maintenant
   * @return {String}
   */
  static _ligneCycles(c, maintenant) {
    if (c.estime || c.premiere == null || c.derniere == null)
      return `≈ ${numeral(Math.max(1, Math.round(c.nombre))).format()} cycles de 30 min (heure des récoltes inconnue)`;
    let jour = moment(maintenant),
      heure = (/** @type {Number} */ t, /** @type {String} */ meme, /** @type {String} */ autre) =>
        moment(t).isSame(jour, "day")
          ? `${meme} ${moment(t).format("HH[h]mm")}`
          : `${autre} ${moment(t).format("DD/MM [à] HH[h]mm")}`;
    if (c.nombre == 1) return `1 cycle : la récolte du jeu ${heure(c.premiere, "de", "du")}`;
    return `${numeral(c.nombre).format()} cycles : les ${numeral(c.nombre).format()} récoltes du jeu (une toutes les 30 min) ${heure(c.premiere, "de", "du")} ${heure(c.derniere, "à", "au")}`;
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
   * Valeur de la ligne horloge d'un coût : le temps avant que toutes ses
   * ressources suffisent, compté depuis l'ouverture de la page (« 1j 10h 12m »),
   * « REQUIS : Entrepôt de … niveau N » quand un entrepôt est trop petit,
   * « jamais », « &gt; 1 an », « ? » sans production connue.
   *
   * @static
   * @method valeurLigne
   * @param {Array<Number>} cout [nourriture, matériaux]
   * @param {any} etat Entrepots.etat, null si la production est inconnue
   * @return {{html: String, requis: Boolean}|null} null : rien ne manque
   */
  static valeurLigne(cout, etat) {
    if (!etat) {
      let stocks = [Utils.nourriture, Utils.materiaux];
      return cout.some((c, i) => c > (stocks[i] || 0)) ? { html: "?", requis: false } : null;
    }
    let r = DelaiRessources.calculer(cout, etat),
      manquent = [0, 1].filter((i) => r[i] && /** @type {any} */ (r[i]).manque > 0),
      res = (/** @type {Number} */ i) => /** @type {any} */ (r[i]);
    if (!manquent.length) return null;
    let trop = manquent.filter((i) => res(i).trop);
    if (trop.length)
      return {
        html: trop
          .map((i) => `<div class='o_delaiRequis'>${DelaiRessources.requis(i, res(i).cout)}</div>`)
          .join(""),
        requis: true,
      };
    if (manquent.some((i) => DelaiRessources._jamais(res(i))))
      return { html: "jamais", requis: false };
    if (manquent.some((i) => res(i).atteint == null)) return { html: "&gt; 1 an", requis: false };
    return {
      html: DelaiRessources.duree(
        etat.maintenant,
        Math.max(...manquent.map((i) => res(i).atteint)),
      ),
      requis: false,
    };
  }
  /**
   * Ligne horloge de chaque coût : notre valeur, sous la ligne du Compte+
   * (« Temps pour récolter … », production seule) cachée, ou ajoutée quand le
   * jeu n'en a pas (sans Compte+, Laboratoire).
   *
   * @private
   * @static
   */
  static _poserLignes() {
    let etat = Entrepots.etat(DelaiRessources._ouverture || Horloge.maintenant());
    $(".o_delaiRessources").each((/** @type {Number} */ k, /** @type {HTMLElement} */ td) => {
      let $td = $(td),
        v = DelaiRessources.valeurLigne(
          DelaiRessources.cout($td.closest(".ligneAmelioration")),
          etat,
        ),
        $jeu = $td.find(
          "tr[title^='Temps pour récolter'], tr[data-o-titre^='Temps pour récolter']",
        ),
        $ligne = $td.find("tr.o_delaiLigne");
      $jeu.hide();
      if (!v) return void $ligne.remove();
      if (!$ligne.length) {
        $ligne = $(
          "<tr class='o_delaiLigne'><td><img src='images/icone/horloge.png' width='18' height='18' alt=''/></td><td class='o_delaiValeur'></td></tr>",
        );
        if ($jeu.length) $jeu.last().after($ligne);
        else $td.find("table").first().append($ligne);
      }
      $ligne.find(".o_delaiValeur").html(v.html);
    });
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
        Entrepots.garderConvois(liste, Horloge.maintenant());
        DelaiRessources._rafraichir();
      },
      (e) => {
        DelaiRessources._convois = { etat: "echec", raison: String((e && e.message) || e) };
        Journal.info(JOURNAL_DELAI, "page Convois non relue", DelaiRessources._convois.raison);
        DelaiRessources._rafraichir();
      },
    );
    $cellules.addClass("o_delaiRessources");
    DelaiRessources._poserLignes();
    $cellules.each((/** @type {Number} */ k, /** @type {HTMLElement} */ td) => {
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
    DelaiRessources._poserLignes();
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
