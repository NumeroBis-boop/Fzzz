// @ts-check
/*
 * Entrepots.js
 * NumeroBis-boop
 **********************************************************************/

// une récolte toutes les 30 minutes, une unité par ouvrière au travail
// (calculProduction du jeu, page Ressources)
const RECOLTES_PAR_JOUR = 48;
// lecture de la page Ressources, par joueur : pillage (vassal ou seigneur),
// affectation automatique, production et chasses en cours, reprise sur les
// autres pages, où l'encart « S5 Pseudo » n'en dit rien
const CLE_RECOLTE = "fzzz_recolte";
// au-delà, l'entrepôt est dit « plein dans plus d'un an »
const JOURS_REMPLISSAGE_MAX = 365;
// écart entre le total de l'info-bulle du jeu et la somme de ses lignes connues
// au-delà duquel le total compte déjà autre chose (pillage) : arrondis du jeu
const ECART_TOTAL_RECOLTE = 2;
// ligne de l'encart en rouge quand l'entrepôt sera plein avant (règle du mainteneur, 16/11/2026)
const HEURES_ALERTE_PLEIN = 8;
const MS_JOUR = 86400000;

/**
 * Remplissage des entrepôts. Sous la nourriture et les matériaux de l'encart
 * « S5 Pseudo », le temps avant qu'ils soient pleins : production du jour
 * (info-bulle du jeu sur la ligne du TdC de l'encart), pillage subi en vassal
 * ou reçu en seigneur (page Ressources), et rentrées de TdC à venir (chasses
 * et floods lancés), exploitées par les ouvrières libres. Sur la page
 * Ressources, une synthèse sous le bloc « Récoltes ». Case
 * « remplissageEntrepots » (Préférences → Général). Aucune requête : tout
 * vient de la page ouverte et de la dernière lecture de la page Ressources.
 *
 * @class Entrepots
 */
class Entrepots {
  /**
   * @static
   * @method nombre
   * @param {any} t texte d'un nombre du jeu (« +553 439 », « -42 173 », vide)
   * @return {Number} 0 si illisible
   */
  static nombre(t) {
    let n = parseInt(
      String(t || "")
        .replace(/−/g, "-")
        .replace(/[^\d-]/g, ""),
    );
    return isNaN(n) ? 0 : n;
  }
  /**
   * Production par jour de l'info-bulle que le jeu met sur la ligne du TdC
   * de l'encart « S5 Pseudo » (script de chaque page) : [nourriture,
   * matériaux] de ses lignes Total, Terrain, Champignon, Armée, et la somme
   * des autres.
   *
   * @static
   * @method lireInfobulle
   * @param {Document} [doc]
   * @return {{total: Array<Number>, terrain: Array<Number>, champignon: Array<Number>, armee: Array<Number>, autres: Array<Number>}|null}
   */
  static lireInfobulle(doc = document) {
    let script = [...doc.querySelectorAll("script")].find((s) =>
        (s.textContent || "").includes("tooltip_conso"),
      ),
      m =
        script &&
        (script.textContent || "").match(
          /content\s*:\s*"(<table id='tooltip_conso'[\s\S]*?<\/table>)"/,
        );
    if (!m) return null;
    /** @type {any} */
    let lignes = {
        total: [0, 0],
        terrain: [0, 0],
        champignon: [0, 0],
        armee: [0, 0],
        autres: [0, 0],
      },
      total = false;
    Utils.parseHtml(m[1])
      .find("tr")
      .each((i, tr) => {
        let $td = $(tr).children("td"),
          libelle = $td.eq(0).text().trim().toLowerCase();
        if (!libelle) return;
        let cle = /total/.test(libelle)
          ? "total"
          : /terrain/.test(libelle)
            ? "terrain"
            : /champignon/.test(libelle)
              ? "champignon"
              : /arm/.test(libelle)
                ? "armee"
                : "autres";
        if (cle == "total") total = true;
        lignes[cle][0] += Entrepots.nombre($td.eq(1).text());
        lignes[cle][1] += Entrepots.nombre($td.eq(2).text());
      });
    return total ? lignes : null;
  }
  /**
   * Bloc « Récoltes » de la page Ressources : production par jour (terrain,
   * champignonnière, armée) et pillage, [nourriture, matériaux] : subi
   * (« X vous pille … ») et reçu (« vous pillez … », texte du seigneur
   * supposé : pas encore vu).
   *
   * @static
   * @method lireRecolte
   * @param {any} [racine] document de Ressources.php (jQuery)
   * @return {{terrain: Array<Number>, champignon: Array<Number>, armee: Array<Number>, pille: Array<Number>, recu: Array<Number>, $p: any}|null}
   *   null : bloc absent
   */
  static lireRecolte(racine = $(document)) {
    let $p = racine
      .find("p")
      .filter((i, /** @type {HTMLElement} */ p) =>
        /Chaque jour, vous récoltez/.test(p.textContent || ""),
      )
      .first();
    if (!$p.length) return null;
    // icônes du jeu remplacées par une marque : chaque montant est suivi de la sienne
    let $copie = $p.clone();
    $copie.find("img").each((i, /** @type {HTMLElement} */ img) => {
      let nom = `${img.getAttribute("src") || ""} ${img.getAttribute("alt") || ""}`.toLowerCase();
      $(img).replaceWith(
        /pomme|nourriture/.test(nom) ? " #N# " : /bois|materiau/.test(nom) ? " #M# " : " ",
      );
    });
    let texte = $copie.text().replace(/\s+/g, " "),
      montant = (/** @type {RegExp} */ re) => Entrepots.nombre((texte.match(re) || [])[1]),
      pille = [0, 0],
      recu = [0, 0],
      verbes = [...texte.matchAll(/vous pille(z?)\b/g)];
    // chaque montant va au verbe qui le précède : « X vous pille … », « vous pillez … »
    verbes.forEach((v, k) => {
      let fin = k + 1 < verbes.length ? verbes[k + 1].index : texte.length,
        cible = v[1] ? recu : pille;
      for (let a of texte.slice(v.index, fin).matchAll(/(\d[\d ]*)\s*#([NM])#/g))
        cible[a[2] == "N" ? 0 : 1] += Entrepots.nombre(a[1]);
    });
    return {
      terrain: [
        Entrepots.nombre(racine.find("#nbNourriture").text()),
        Entrepots.nombre(racine.find("#nbMateriaux").text()),
      ],
      champignon: [montant(/(\d[\d ]*)\s*#N#\s*avec votre champignonni/), 0],
      armee: [-montant(/consomme\s*(\d[\d ]*)\s*#N#/), 0],
      pille: pille,
      recu: recu,
      $p: $p,
    };
  }
  /**
   * Bilan du jour, pillage et consommation de l'armée comptés : [nourriture,
   * matériaux], négatif quand le stock baisse.
   *
   * @static
   * @method recolteNette
   * @param {{terrain: Array<Number>, champignon: Array<Number>, armee: Array<Number>}} production
   *   armee : consommation, négative
   * @param {Array<Number>} pille
   * @param {Array<Number>} recu
   * @return {Array<Number>}
   */
  static recolteNette(production, pille, recu) {
    return [
      production.terrain[0] + production.champignon[0] + production.armee[0] - pille[0] + recu[0],
      production.terrain[1] - pille[1] + recu[1],
    ];
  }
  /**
   * Phrase du bilan : « vous gagnez X et Y », « vous perdez X et gagnez Y ».
   *
   * @static
   * @method phraseBilan
   * @param {Array<Number>} net [nourriture, matériaux] (recolteNette)
   * @return {String} HTML
   */
  static phraseBilan(net) {
    let icones = [
        `<img alt="nourritures" src="/images/icone/icone_pomme.png" width="18" height="18" title="Nourriture"/>`,
        `<img alt="materiaux" src="/images/icone/icone_bois.png" width="18" height="17" title="Matériaux"/>`,
      ],
      verbe = (/** @type {Number} */ n) => (n < 0 ? "perdez" : "gagnez"),
      montant = (/** @type {Number} */ i) =>
        `<strong>${numeral(Math.abs(net[i])).format()}</strong> ${icones[i]}`;
    return verbe(net[0]) == verbe(net[1])
      ? `vous ${verbe(net[0])} ${montant(0)} et ${montant(1)}`
      : `vous ${verbe(net[0])} ${montant(0)} et ${verbe(net[1])} ${montant(1)}`;
  }
  /**
   * Page Ressources : garde ce que les autres pages ne savent pas (pillage,
   * affectation automatique, chasses en cours), même case décochée, puis
   * ajoute la synthèse sous le bloc « Récoltes » et refait les lignes de
   * l'encart.
   *
   * @static
   * @method recolte
   * @param {Array<{impact: any, terrain: Number}>} chasses chasses en cours (PageRessource.lireChasses)
   */
  static recolte(chasses = []) {
    let lu = Entrepots.lireRecolte();
    if (!lu) return;
    let production = Entrepots.lireInfobulle() || lu,
      base = production.terrain[0] + production.terrain[1] + production.champignon[0],
      choix = $("input[name=choixOuvriere]:checked").not("#o_ratioRadio").val();
    Entrepots._noter({
      lu: Horloge.maintenant(),
      pille: lu.pille,
      recu: lu.recu,
      // part de la production prise par le seigneur (30 % relevés le 16/11/2026)
      taux: base > 0 ? (lu.pille[0] + lu.pille[1]) / base : 0,
      choix: choix || null,
      production: {
        terrain: production.terrain,
        champignon: production.champignon,
        armee: production.armee,
      },
      chasses: chasses
        .filter((c) => c.terrain > 0)
        .map((c) => ({ t: moment(c.impact).valueOf(), terrain: c.terrain })),
    });
    $(".o_recolteSynthese").remove();
    if (Utils.affichage("remplissageEntrepots"))
      lu.$p.after(
        `<div class='o_recolteSynthese'><hr class='o_recolteSeparateur'/><p>En prenant en compte les vassalisations, la consommation de l'armée et les productions actuelles, chaque jour, ${Entrepots.phraseBilan(Entrepots.recolteNette(production, lu.pille, lu.recu))}.</p></div>`,
      );
    Entrepots.afficher();
  }
  /**
   * Dernière lecture de la page Ressources par ce joueur.
   *
   * @static
   * @method lecture
   * @return {any} null si jamais lue
   */
  static lecture() {
    let pseudo = String(monProfil.pseudo || "").toLowerCase();
    return (pseudo && Utils.lireStockage(CLE_RECOLTE)[pseudo]) || null;
  }
  /**
   * @private
   * @static
   * @param {Object} lecture
   */
  static _noter(lecture) {
    let pseudo = String(monProfil.pseudo || "").toLowerCase();
    if (!pseudo) return;
    let tout = Utils.lireStockage(CLE_RECOLTE);
    tout[pseudo] = lecture;
    try {
      localStorage.setItem(CLE_RECOLTE, JSON.stringify(tout));
    } catch (e) {}
  }
  /**
   * Changements de la production par jour quand le TdC grandit : la terre
   * gagnée est exploitée tant qu'il reste des ouvrières (une par cm²), la
   * part du seigneur en moins, partagée entre nourriture et matériaux.
   *
   * @static
   * @method changements
   * @param {Array<{t: Number, terrain: Number}>} gains
   * @param {{tdc: Number, ouvrieres: Number, partNourriture: Number|null, taux: Number}} etat
   * @return {Array<Array<{t: Number, d: Number}>>} [nourriture, matériaux]
   */
  static changements(gains, { tdc, ouvrieres, partNourriture, taux }) {
    /** @type {Array<Array<{t: Number, d: Number}>>} */
    let parType = [[], []];
    if (partNourriture == null) return parType;
    let terrain = tdc,
      max = ouvrieres > 0 ? ouvrieres : Infinity;
    gains
      .slice()
      .sort((a, b) => a.t - b.t)
      .forEach((g) => {
        let avant = Math.min(terrain, max);
        terrain += g.terrain;
        let plus = (Math.min(terrain, max) - avant) * RECOLTES_PAR_JOUR * (1 - taux);
        if (plus <= 0) return;
        if (partNourriture > 0) parType[0].push({ t: g.t, d: plus * partNourriture });
        if (partNourriture < 1) parType[1].push({ t: g.t, d: plus * (1 - partNourriture) });
      });
    return parType;
  }
  /**
   * Instant où l'entrepôt sera plein, la production par jour changeant aux
   * instants donnés.
   *
   * @static
   * @method instantPlein
   * @param {Number} stock
   * @param {Number} capacite
   * @param {Number} debit production nette par jour, maintenant
   * @param {Array<{t: Number, d: Number}>} changements
   * @param {Number} maintenant ms, horloge du serveur
   * @return {Number|null} ms ; maintenant s'il est déjà plein, null s'il ne se
   *   remplit pas en JOURS_REMPLISSAGE_MAX jours
   */
  static instantPlein(stock, capacite, debit, changements, maintenant) {
    if (stock >= capacite) return maintenant;
    let limite = maintenant + JOURS_REMPLISSAGE_MAX * MS_JOUR,
      t = maintenant,
      s = stock,
      v = debit;
    for (let c of changements
      .filter((c) => c.t > maintenant && c.t <= limite)
      .sort((a, b) => a.t - b.t)) {
      if (v > 0 && s + (v * (c.t - t)) / MS_JOUR >= capacite)
        return t + ((capacite - s) / v) * MS_JOUR;
      s = Math.max(0, s + (v * (c.t - t)) / MS_JOUR);
      t = c.t;
      v += c.d;
    }
    if (v <= 0) return null;
    let fin = t + ((capacite - s) / v) * MS_JOUR;
    return fin <= limite ? fin : null;
  }
  /**
   * Capacité d'un entrepôt : formule du jeu par niveau (Construction), sinon
   * d'après le pourcentage que l'encart donne au survol.
   *
   * @static
   * @method capacite
   * @param {Number} i 0 nourriture, 1 matériaux
   * @param {Number} stock
   * @return {Number|null}
   */
  static capacite(i, stock) {
    let niveau = (monProfil.niveauConstruction || [])[i + 1];
    if (niveau >= 0) return 500 + 1200 * Math.pow(2, niveau);
    let titre =
        $("#boiteInfo")
          .find(`.icone_${i ? "materiaux" : "nourriture"}_boite_info`)
          .closest("td")
          .attr("title") || "",
      pourcent = parseInt((titre.match(/rempli à (\d+)\s*%/) || [])[1]);
    return pourcent > 0 && stock > 0 ? Math.round(stock / (pourcent / 100)) : null;
  }
  /**
   * Prévision des deux entrepôts d'après la page ouverte et la dernière
   * lecture de la page Ressources.
   *
   * @static
   * @method prevision
   * @return {{maintenant: Number, entrepots: Array<{stock: Number, capacite: Number|null, debit: Number, instant: Number|null}>, pillage: Boolean, lecture: any}|null}
   *   null : production inconnue
   */
  static prevision() {
    let info = Entrepots.lireInfobulle(),
      lecture = Entrepots.lecture(),
      production = info || (lecture && lecture.production);
    if (!production) return null;
    let maintenant = Horloge.maintenant(),
      sansPillage = [
        production.terrain[0] + production.champignon[0] + production.armee[0],
        production.terrain[1],
      ],
      // le total du jeu compte-t-il déjà le pillage (lignes en plus, ou écart) ?
      compte =
        !!info &&
        [0, 1].some((i) => Math.abs(info.total[i] - sansPillage[i]) > ECART_TOTAL_RECOLTE),
      pille = !compte && lecture ? lecture.pille : [0, 0],
      recu = !compte && lecture ? lecture.recu : [0, 0],
      debit = compte
        ? info.total
        : [sansPillage[0] - pille[0] + recu[0], sansPillage[1] - pille[1] + recu[1]],
      exploite = production.terrain[0] + production.terrain[1],
      choix = lecture && lecture.choix,
      partNourriture =
        choix == "nourriture"
          ? 1
          : choix == "materiaux"
            ? 0
            : exploite > 0
              ? production.terrain[0] / exploite
              : null,
      // rentrées de TdC à venir : chasses lues sur la page Ressources, floods lancés
      gains = [
        ...((lecture && lecture.chasses) || []),
        ...AttaqueLancee.charger()
          .filter((a) => a.id && a.arrivee && a.terrainDepart != null && a.terrainCible != null)
          .map((a) => ({
            t: Utils.minuteRC(a.arrivee).valueOf(),
            terrain: Math.max(0, a.terrainDepart - a.terrainCible),
          })),
      ].filter((g) => g.t > maintenant && g.terrain > 0),
      changements = Entrepots.changements(gains, {
        tdc: Utils.terrain || 0,
        ouvrieres: Utils.ouvrieres || 0,
        partNourriture: partNourriture,
        taux: (lecture && lecture.taux) || 0,
      }),
      stocks = [Utils.nourriture, Utils.materiaux];
    return {
      maintenant: maintenant,
      pillage: compte || pille.some((n) => n) || recu.some((n) => n),
      lecture: lecture,
      entrepots: [0, 1].map((i) => {
        let stock = stocks[i] || 0,
          capacite = Entrepots.capacite(i, stock);
        return {
          stock: stock,
          capacite: capacite,
          debit: debit[i],
          instant:
            capacite == null
              ? null
              : Entrepots.instantPlein(stock, capacite, debit[i], changements[i], maintenant),
        };
      }),
    };
  }
  /**
   * « 2 j 5 h », « 5 h 07 », « 12 min ».
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
    if (j) return `${j} j ${h} h`;
    if (h) return `${h} h ${String(m).padStart(2, "0")}`;
    return `${m} min`;
  }
  /**
   * Texte de la ligne sous une ressource de l'encart, ou null.
   *
   * @static
   * @method libelle
   * @param {{capacite: Number|null, debit: Number, instant: Number|null}} e
   * @param {Number} maintenant
   * @return {String|null}
   */
  static libelle(e, maintenant) {
    if (e.capacite == null) return null;
    if (e.instant === maintenant) return "Entrepôt plein";
    if (e.instant == null) return e.debit > 0 ? "Plein dans plus d'un an" : "Ne se remplit pas";
    return `Plein dans ${Entrepots.duree(e.instant - maintenant)}`;
  }
  /**
   * Ajout à l'info-bulle Nourriture ou Matériaux de l'encart (affichage
   * infobulleRessources, sans case) : l'heure où l'entrepôt sera plein et la
   * production par jour comptée ; rien quand la case remplissageEntrepots est
   * décochée.
   *
   * @static
   * @method ligneInfobulle
   * @param {Number} i 0 nourriture, 1 matériaux
   * @return {String} HTML, vide sans prévision
   */
  static ligneInfobulle(i) {
    let p = Entrepots.derniere;
    if (!p || !p.entrepots[i] || p.entrepots[i].capacite == null) return "";
    let e = p.entrepots[i],
      quand =
        e.instant == null
          ? "ne se remplit pas"
          : e.instant === p.maintenant
            ? "plein"
            : `plein ${moment(e.instant).format("[le] DD/MM [à] HH[h]mm")}`;
    return `<br/>Production : ${e.debit > 0 ? "+" : ""}${numeral(Math.round(e.debit)).format()} par jour${p.pillage ? " (pillage compté)" : ""}<br/>Entrepôt ${quand}`;
  }
  /**
   * Lignes « Plein dans … » sous la nourriture et les matériaux de l'encart
   * « S5 Pseudo ».
   *
   * @static
   * @method afficher
   */
  static afficher() {
    let $boite = $("#boiteInfo");
    if (!$boite.length) return;
    $boite.find(".o_entrepotPlein").remove();
    let p = Utils.affichage("remplissageEntrepots") ? Entrepots.prevision() : null;
    Entrepots.derniere = p;
    if (!p) return;
    ["nourriture", "materiaux"].forEach((type, i) => {
      let $td = $boite.find(`.icone_${type}_boite_info`).closest("td"),
        e = p.entrepots[i],
        texte = Entrepots.libelle(e, p.maintenant);
      if (!$td.length || !texte) return;
      $("<div class='o_entrepotPlein'></div>")
        .text(texte)
        .toggleClass(
          "o_entrepotAlerte",
          e.instant != null && e.instant - p.maintenant < HEURES_ALERTE_PLEIN * 3600000,
        )
        .appendTo($td);
    });
  }
}
/** dernière prévision affichée (ligneInfobulle) */
Entrepots.derniere = /** @type {any} */ (null);
