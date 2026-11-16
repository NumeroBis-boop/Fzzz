// @ts-check
/*
 * Entrepots.js
 * NumeroBis-boop
 **********************************************************************/

// une récolte toutes les 30 minutes, une unité par ouvrière au travail
// (calculProduction du jeu, page Ressources)
const RECOLTES_PAR_JOUR = 48;
const MS_JOUR = 86400000;
const MS_RECOLTE = MS_JOUR / RECOLTES_PAR_JOUR;
// lecture de la page Ressources, par joueur : pillage subi, affectation
// automatique, production, chasses en cours, prochaine récolte et colonies,
// reprise sur les autres pages, où l'encart « S5 Pseudo » n'en dit rien
const CLE_RECOLTE = "fzzz_recolte";
// au-delà, l'entrepôt est dit « plein dans plus d'un an »
const JOURS_REMPLISSAGE_MAX = 365;
// écart entre le total de l'info-bulle du jeu et la somme de ses lignes connues
// au-delà duquel le total compte déjà autre chose (pillage) : arrondis du jeu
const ECART_TOTAL_RECOLTE = 2;
// ligne de l'encart en rouge quand l'entrepôt sera plein avant (règle du mainteneur, 16/11/2026)
const HEURES_ALERTE_PLEIN = 8;
// la ligne suit l'heure sans relire la page
const MS_RAFRAICHISSEMENT = 60000;
// taxe d'une colonie, la même sur son terrain et sa champignonnière : 20 %,
// plus 1 % par niveau d'Étable à pucerons du seigneur (règle du mainteneur, 16/11/2026)
const TAXE_COLONIE = 0.2;
const TAXE_COLONIE_PAR_NIVEAU = 0.01;
// rang de « Etable à pucerons » dans CONSTRUCTION (content.js)
const RANG_ETABLE_PUCERONS = 11;
// production par jour d'une champignonnière : 72 × 1,7^niveau, arrondi en dessous
// (page Construction : 595 612 au niveau 17, 1 012 542 au niveau 18)
const CHAMPIGNONNIERE_BASE = 72;
const CHAMPIGNONNIERE_FACTEUR = 1.7;
// niveaux de champignonnière des colonies, lus dans le fichier « Stats membres »
const CLE_NIVEAUX_COLONIES = "fzzz_niveauxColonies";
const MS_NIVEAUX_COLONIES = MS_JOUR;
const JOURNAL_ENTREPOTS = "Entrepôts";

/**
 * Remplissage des entrepôts. Sous la nourriture et les matériaux de l'encart
 * « S5 Pseudo », le temps avant qu'ils soient pleins (ou la famine) : récolte
 * du terrain exploité à chaque récolte du jeu, champignonnière et armée,
 * pillage subi (page Ressources), convois qui arrivent (page Convois) et TdC à
 * venir (chasses et floods lancés), exploité seulement avec l'affectation
 * automatique. Le pillage reçu en seigneur n'y est pas compté (règle du
 * mainteneur) : l'info-bulle le montre. Sur la page Ressources, un bilan sous
 * le bloc « Récoltes », pillage des colonies compris. Cases
 * « remplissageEntrepots » (encart) et « bilanRecolte » (bilan), Préférences →
 * Ressources.
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
   * champignonnière, armée) et pillage subi en vassal (« X vous pille … »),
   * [nourriture, matériaux]. Le jeu n'y écrit rien de ce que pille un seigneur.
   *
   * @static
   * @method lireRecolte
   * @param {any} [racine] document de Ressources.php (jQuery)
   * @return {{terrain: Array<Number>, champignon: Array<Number>, armee: Array<Number>, pille: Array<Number>, $p: any}|null}
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
      debut = texte.search(/vous pille\b/);
    if (debut >= 0)
      for (let a of texte.slice(debut).matchAll(/(\d[\d ]*)\s*#([NM])#/g))
        pille[a[2] == "N" ? 0 : 1] += Entrepots.nombre(a[1]);
    return {
      terrain: [
        Entrepots.nombre(racine.find("#nbNourriture").text()),
        Entrepots.nombre(racine.find("#nbMateriaux").text()),
      ],
      champignon: [montant(/(\d[\d ]*)\s*#N#\s*avec votre champignonni/), 0],
      armee: [-montant(/consomme\s*(\d[\d ]*)\s*#N#/), 0],
      pille: pille,
      $p: $p,
    };
  }
  /**
   * Prochaine récolte, d'après le compte à rebours « Les ouvrières rentreront
   * dans » de la page Ressources.
   *
   * @static
   * @method prochaineRecolte
   * @param {Document} [doc]
   * @return {Number|null} ms, horloge du serveur
   */
  static prochaineRecolte(doc = document) {
    for (let s of doc.querySelectorAll("script")) {
      let m = (s.textContent || "").match(/reste\(\s*(\d+)\s*,\s*["']retour_ouvrieres["']/);
      if (m) return Horloge.maintenant() + parseInt(m[1]) * 1000;
    }
    return null;
  }
  /**
   * @static
   * @method productionChampignonniere
   * @param {Number} niveau
   * @return {Number} nourriture par jour
   */
  static productionChampignonniere(niveau) {
    return niveau > 0
      ? Math.floor(CHAMPIGNONNIERE_BASE * Math.pow(CHAMPIGNONNIERE_FACTEUR, niveau))
      : 0;
  }
  /**
   * Part de la production d'une colonie prise par son seigneur.
   *
   * @static
   * @method tauxColonie
   * @param {Number} niveauEtable niveau d'Étable à pucerons du seigneur
   * @return {Number|null} null si le niveau est inconnu
   */
  static tauxColonie(niveauEtable) {
    return niveauEtable >= 0 ? TAXE_COLONIE + TAXE_COLONIE_PAR_NIVEAU * niveauEtable : null;
  }
  /**
   * Bilan du jour : production, consommation de l'armée, pillage subi et
   * pillage des colonies, [nourriture, matériaux], négatif quand le stock baisse.
   *
   * @static
   * @method recolteNette
   * @param {{terrain: Array<Number>, champignon: Array<Number>, armee: Array<Number>}} production
   *   armee : consommation, négative
   * @param {Array<Number>} pille pillage subi
   * @param {Array<Number>} colonies pillage des colonies
   * @return {Array<Number>}
   */
  static recolteNette(production, pille, colonies) {
    return [
      production.terrain[0] +
        production.champignon[0] +
        production.armee[0] -
        pille[0] +
        colonies[0],
      production.terrain[1] - pille[1] + colonies[1],
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
    let verbe = (/** @type {Number} */ n) => (n < 0 ? "perdez" : "gagnez"),
      montant = (/** @type {Number} */ i) => Entrepots.montant(Math.abs(net[i]), i);
    return verbe(net[0]) == verbe(net[1])
      ? `vous ${verbe(net[0])} ${montant(0)} et ${montant(1)}`
      : `vous ${verbe(net[0])} ${montant(0)} et ${verbe(net[1])} ${montant(1)}`;
  }
  /**
   * @static
   * @method montant
   * @param {Number} n
   * @param {Number} i 0 nourriture, 1 matériaux
   * @return {String} HTML : le nombre en gras et l'icône du jeu
   */
  static montant(n, i) {
    let icone = i
      ? `<img alt="materiaux" src="/images/icone/icone_bois.png" width="18" height="17" title="Matériaux"/>`
      : `<img alt="nourritures" src="/images/icone/icone_pomme.png" width="18" height="18" title="Nourriture"/>`;
    return `<strong>${numeral(n).format()}</strong> ${icone}`;
  }
  /**
   * Détail du pillage des colonies sous le bilan.
   *
   * @static
   * @method phraseColonies
   * @param {any} c colonies (Entrepots.colonies)
   * @return {String} HTML
   */
  static phraseColonies(c) {
    if (c.taux == null)
      return `<p class='o_recolteColonies'>Pillage de vos colonies non compté : niveau de votre Étable à pucerons inconnu (ouvrez la page Construction).</p>`;
    let detail = c.vassaux
      .map(
        (/** @type {any} */ v) =>
          `${Utils.echapper(v.pseudo)} : TdC ${numeral(v.terrain).format()}, champignonnière ${v.champignonniere == null ? "inconnue" : `niveau ${v.champignonniere}`}`,
      )
      .join(" ; ");
    return `<p class='o_recolteColonies'>Dont le pillage de vos colonies (${numeral(c.taux * 100).format()} %) : ${Entrepots.montant(c.total[0], 0)} et ${Entrepots.montant(c.total[1], 1)}. ${detail}. Le TdC d'une colonie est compté en matériaux${c.vassaux.some((/** @type {any} */ v) => v.champignonniere == null) ? ", une champignonnière absente du fichier « Stats membres » ne compte pas" : ""}.</p>`;
  }
  /**
   * Page Ressources : garde ce que les autres pages ne savent pas (pillage
   * subi, affectation automatique, chasses en cours, prochaine récolte), même
   * case décochée, ajoute le bilan sous le bloc « Récoltes », refait les
   * lignes de l'encart, puis calcule le pillage des colonies (requêtes, une
   * des deux cases cochée) et refait le bilan.
   *
   * @static
   * @method recolte
   * @param {Array<{impact: any, terrain: Number}>} chasses chasses en cours (PageRessource.lireChasses)
   * @return {Promise<void>}
   */
  static recolte(chasses = []) {
    let lu = Entrepots.lireRecolte();
    if (!lu) return Promise.resolve();
    let production = Entrepots.lireInfobulle() || lu,
      base = production.terrain[0] + production.terrain[1] + production.champignon[0],
      choix = $("input[name=choixOuvriere]:checked").not("#o_ratioRadio").val(),
      avant = Entrepots.lecture();
    Entrepots._noter({
      lu: Horloge.maintenant(),
      pille: lu.pille,
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
      recolte: Entrepots.prochaineRecolte(),
      colonies: (avant && avant.colonies) || null,
    });
    Entrepots.afficherBilan(lu, production);
    Entrepots.afficher();
    if (!Utils.affichage("remplissageEntrepots") && !Utils.affichage("bilanRecolte"))
      return Promise.resolve();
    return Entrepots.colonies().then(
      (colonies) => {
        let lecture = Entrepots.lecture();
        if (!lecture) return;
        lecture.colonies = colonies;
        Entrepots._noter(lecture);
        Entrepots.afficherBilan(lu, production);
        Entrepots.afficher();
      },
      (e) => Journal.info(JOURNAL_ENTREPOTS, "colonies non relues", String(e && e.message)),
    );
  }
  /**
   * Bilan sous le bloc « Récoltes ».
   *
   * @static
   * @method afficherBilan
   * @param {{pille: Array<Number>, $p: any}} lu
   * @param {{terrain: Array<Number>, champignon: Array<Number>, armee: Array<Number>}} production
   */
  static afficherBilan(lu, production) {
    $(".o_recolteSynthese").remove();
    if (!Utils.affichage("bilanRecolte")) return;
    let lecture = Entrepots.lecture(),
      c = lecture && lecture.colonies && lecture.colonies.vassaux.length ? lecture.colonies : null,
      net = Entrepots.recolteNette(production, lu.pille, c && c.taux != null ? c.total : [0, 0]);
    lu.$p.after(
      `<div class='o_recolteSynthese'><hr class='o_recolteSeparateur'/><p>En prenant en compte les vassalisations, la consommation de l'armée et les productions actuelles, chaque jour, ${Entrepots.phraseBilan(net)}.</p>${c ? Entrepots.phraseColonies(c) : ""}</div>`,
    );
  }
  /**
   * Colonies du joueur (export public des joueurs : leur seigneur et leur
   * TdC, à l'heure près) et ce qu'il y pille par jour : taux × (TdC × 48 en
   * matériaux, champignonnière en nourriture).
   *
   * @static
   * @method colonies
   * @return {Promise<{lu: Number, taux: Number|null, vassaux: Array<{pseudo: String, terrain: Number, champignonniere: Number|null, pille: Array<Number>}>, total: Array<Number>}>}
   */
  static colonies() {
    let lu = Horloge.maintenant();
    return ExportJoueurs.colonies(monProfil.pseudo).then((vassaux) => {
      let taux = Entrepots.tauxColonie((monProfil.niveauConstruction || [])[RANG_ETABLE_PUCERONS]);
      if (!vassaux.length) return { lu, taux, vassaux: [], total: [0, 0] };
      return Entrepots._niveauxChampignonnieres(vassaux.map((v) => v.pseudo)).then((niveaux) => {
        let total = [0, 0],
          liste = vassaux.map((v) => {
            let champignonniere = niveaux[v.pseudo.toLowerCase()] ?? null,
              pille =
                taux == null
                  ? [0, 0]
                  : [
                      champignonniere == null
                        ? 0
                        : Math.floor(taux * Entrepots.productionChampignonniere(champignonniere)),
                      // production d'une colonie supposée toute en matériaux (règle du mainteneur)
                      Math.floor(taux * v.terrain * RECOLTES_PAR_JOUR),
                    ];
            total[0] += pille[0];
            total[1] += pille[1];
            return { pseudo: v.pseudo, terrain: v.terrain, champignonniere, pille };
          });
        return { lu, taux, vassaux: liste, total };
      });
    });
  }
  /**
   * Niveaux de champignonnière gardés un jour, sinon lus dans l'onglet
   * « Dernier relevé » du fichier « Stats membres » (adresse dans le forum
   * caché). Un fichier illisible laisse les niveaux inconnus.
   *
   * @private
   * @static
   * @param {Array<String>} pseudos
   * @return {Promise<Object<string, Number|null>>} par pseudo en minuscules
   */
  static _niveauxChampignonnieres(pseudos) {
    let gardes = Utils.lireStockage(CLE_NIVEAUX_COLONIES),
      maintenant = Horloge.maintenant(),
      cle = (/** @type {String} */ p) => p.toLowerCase(),
      manquants = pseudos.filter(
        (p) => !gardes[cle(p)] || !(maintenant - gardes[cle(p)].t < MS_NIVEAUX_COLONIES),
      ),
      resultat = () =>
        Object.fromEntries(pseudos.map((p) => [cle(p), gardes[cle(p)] ? gardes[cle(p)].n : null]));
    if (!manquants.length) return Promise.resolve(resultat());
    return SuiviMembres.adresse()
      .then(({ url }) => {
        if (!url) throw new Error(`pas d'adresse du fichier « ${TITRE_STATS_MEMBRES} »`);
        return ExportRapports.requete(url, "POST", { niveaux: { joueurs: manquants } });
      })
      .then((/** @type {any} */ donnees) => {
        let niveaux = (donnees && donnees.niveaux) || {};
        manquants.forEach((p) => {
          let n = niveaux[p] && niveaux[p].champignonniere;
          gardes[cle(p)] = { n: Number.isInteger(n) ? n : null, t: maintenant };
        });
        try {
          localStorage.setItem(CLE_NIVEAUX_COLONIES, JSON.stringify(gardes));
        } catch (e) {}
        return resultat();
      })
      .catch((e) => {
        Journal.info(
          JOURNAL_ENTREPOTS,
          "niveaux de champignonnière des colonies non lus",
          String(e && e.message),
        );
        return resultat();
      });
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
   * Changements de la récolte par jour quand le TdC grandit : la terre gagnée
   * n'est exploitée qu'avec l'affectation automatique, tant qu'il reste des
   * ouvrières (une par cm²), la part du seigneur en moins.
   *
   * @static
   * @method changements
   * @param {Array<{t: Number, terrain: Number}>} gains
   * @param {{tdc: Number, ouvrieres: Number, partNourriture: Number|null, taux: Number}} etat
   *   partNourriture : 1 ou 0 selon l'affectation automatique, null sans elle
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
        if (plus > 0) parType[partNourriture ? 0 : 1].push({ t: g.t, d: plus });
      });
    return parType;
  }
  /**
   * Convois qui arrivent chez le joueur, lus sur la page Convois (« Vous allez
   * recevoir … »).
   *
   * @static
   * @method convois
   * @param {Number} maintenant
   * @return {Array<Array<{t: Number, q: Number}>>} [nourriture, matériaux]
   */
  static convois(maintenant) {
    let liste = Utils.lireStockage("outiiil_evolution").convoi;
    /** @type {Array<Array<{t: Number, q: Number}>>} */
    let parType = [[], []];
    (Array.isArray(liste) ? liste : []).forEach((c) => {
      let t = moment(c.exp).valueOf();
      if (c.sens !== false || !(t > maintenant)) return;
      [Number(c.nou) || 0, Number(c.mat) || 0].forEach((q, i) => {
        if (q > 0) parType[i].push({ t, q });
      });
    });
    return parType;
  }
  /**
   * Stock pas à pas jusqu'à JOURS_REMPLISSAGE_MAX jours : la récolte du
   * terrain arrive à chaque récolte du jeu, la champignonnière, l'armée et le
   * reste en continu, les convois à leur arrivée.
   *
   * @static
   * @method simuler
   * @param {{stock: Number, capacite: Number, continu: Number, recolte: Number, prochaine: Number|null, gains: Array<{t: Number, d: Number}>, convois: Array<{t: Number, q: Number}>, maintenant: Number}} e
   *   continu et recolte par jour ; prochaine : heure d'une récolte (sans elle,
   *   la récolte est étalée sur la journée) ; gains : récolte par jour en plus
   * @return {{plein: Number|null, famine: Number|null}} ms ; plein : maintenant
   *   s'il l'est déjà, null au-delà de JOURS_REMPLISSAGE_MAX jours
   */
  static simuler({ stock, capacite, continu, recolte, prochaine, gains, convois, maintenant }) {
    if (stock >= capacite) return { plein: maintenant, famine: null };
    let limite = maintenant + JOURS_REMPLISSAGE_MAX * MS_JOUR,
      parPaquets = prochaine != null,
      t = maintenant,
      s = stock,
      v = parPaquets ? continu : continu + recolte,
      h = parPaquets ? recolte : 0,
      suivante = parPaquets ? /** @type {Number} */ (prochaine) : Infinity,
      /** @type {Number|null} */
      famine = null,
      /** @type {Array<{t: Number, d?: Number, q?: Number}>} */
      evenements = [...gains, ...convois]
        .filter((x) => x.t > maintenant && x.t <= limite)
        .sort((a, b) => a.t - b.t),
      k = 0;
    while (suivante < t) suivante += MS_RECOLTE;
    while (t < limite) {
      let fin = Math.min(suivante, k < evenements.length ? evenements[k].t : Infinity, limite),
        apres = s + (v * (fin - t)) / MS_JOUR;
      if (v > 0 && apres >= capacite) return { plein: t + ((capacite - s) / v) * MS_JOUR, famine };
      if (v < 0 && famine == null && apres <= 0) famine = t + (s / -v) * MS_JOUR;
      s = Math.max(0, apres);
      t = fin;
      if (t >= limite) break;
      for (; k < evenements.length && evenements[k].t === t; k++) {
        let ev = evenements[k];
        s += ev.q || 0;
        if (parPaquets) h += ev.d || 0;
        else v += ev.d || 0;
      }
      if (suivante === t) {
        s += h / RECOLTES_PAR_JOUR;
        suivante += MS_RECOLTE;
      }
      if (s >= capacite) return { plein: t, famine };
    }
    return { plein: null, famine };
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
   * @return {{maintenant: Number, entrepots: Array<{stock: Number, capacite: Number|null, debit: Number, convois: Number, instant: Number|null, famine: Number|null}>, pillage: Boolean, lecture: any}|null}
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
      taux = (lecture && lecture.taux) || 0,
      garde = compte ? 1 : 1 - taux,
      recolte = [production.terrain[0] * garde, production.terrain[1] * garde],
      continu = compte
        ? [info.total[0] - production.terrain[0], info.total[1] - production.terrain[1]]
        : [production.champignon[0] * garde + production.armee[0], 0],
      choix = lecture && lecture.choix,
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
        partNourriture: choix == "nourriture" ? 1 : choix == "materiaux" ? 0 : null,
        taux: taux,
      }),
      convois = Entrepots.convois(maintenant),
      stocks = [Utils.nourriture, Utils.materiaux],
      prochaine = (lecture && lecture.recolte) || null;
    return {
      maintenant: maintenant,
      pillage: compte || taux > 0,
      lecture: lecture,
      entrepots: [0, 1].map((i) => {
        let stock = stocks[i] || 0,
          capacite = Entrepots.capacite(i, stock),
          r = Entrepots.simuler({
            stock,
            capacite: capacite == null ? Infinity : capacite,
            continu: continu[i],
            recolte: recolte[i],
            prochaine,
            gains: changements[i],
            convois: convois[i],
            maintenant,
          });
        return {
          stock: stock,
          capacite: capacite,
          debit: continu[i] + recolte[i],
          convois: convois[i].reduce((n, c) => n + c.q, 0),
          instant: r.plein,
          // seule la nourriture se mange
          famine: i == 0 ? r.famine : null,
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
   * Famine avant que l'entrepôt soit plein ?
   *
   * @static
   * @method avantPlein
   * @param {{instant: Number|null, famine: Number|null}} e
   * @return {Boolean}
   */
  static avantPlein(e) {
    return e.famine != null && (e.instant == null || e.famine < e.instant);
  }
  /**
   * Texte de la ligne sous une ressource de l'encart, ou null.
   *
   * @static
   * @method libelle
   * @param {{capacite: Number|null, debit: Number, instant: Number|null, famine: Number|null}} e
   * @param {Number} maintenant
   * @return {String|null}
   */
  static libelle(e, maintenant) {
    if (Entrepots.avantPlein(e))
      return /** @type {Number} */ (e.famine) <= maintenant
        ? "Famine en cours"
        : `Famine dans ${Entrepots.duree(/** @type {Number} */ (e.famine) - maintenant)}`;
    if (e.capacite == null) return null;
    if (e.instant != null && e.instant <= maintenant) return "Entrepôt plein";
    if (e.instant == null) return e.debit > 0 ? "Plein dans plus d'un an" : "Ne se remplit pas";
    return `Plein dans ${Entrepots.duree(e.instant - maintenant)}`;
  }
  /**
   * Plein ou en famine dans moins de HEURES_ALERTE_PLEIN heures.
   *
   * @static
   * @method alerte
   * @param {{instant: Number|null, famine: Number|null}} e
   * @param {Number} maintenant
   * @return {Boolean}
   */
  static alerte(e, maintenant) {
    let quand = Entrepots.avantPlein(e) ? e.famine : e.instant;
    return quand != null && quand - maintenant < HEURES_ALERTE_PLEIN * 3600000;
  }
  /**
   * Ajout à l'info-bulle Nourriture ou Matériaux de l'encart (affichage
   * infobulleRessources, sans case) : la production par jour comptée, les
   * convois attendus, l'heure où l'entrepôt sera plein ou de la famine, et ce
   * que rapportent les colonies, non compté ; rien quand la case
   * remplissageEntrepots est décochée.
   *
   * @static
   * @method ligneInfobulle
   * @param {Number} i 0 nourriture, 1 matériaux
   * @return {String} HTML, vide sans prévision
   */
  static ligneInfobulle(i) {
    let p = Entrepots.derniere;
    if (!p || !p.entrepots[i]) return "";
    let e = p.entrepots[i],
      maintenant = Horloge.maintenant(),
      date = (/** @type {Number} */ ms) => moment(ms).format("[le] DD/MM [à] HH[h]mm"),
      lignes = [];
    if (e.capacite != null || e.famine != null) {
      lignes.push(
        `Production : ${e.debit > 0 ? "+" : ""}${numeral(Math.round(e.debit)).format()} par jour${p.pillage ? " (pillage subi compté)" : ""}`,
      );
      if (e.convois > 0) lignes.push(`Convois attendus : +${numeral(e.convois).format()}`);
      if (Entrepots.avantPlein(e))
        lignes.push(
          `Famine ${/** @type {Number} */ (e.famine) <= maintenant ? "en cours" : date(/** @type {Number} */ (e.famine))}`,
        );
      else if (e.capacite != null)
        lignes.push(
          `Entrepôt ${e.instant == null ? "ne se remplit pas" : e.instant <= maintenant ? "plein" : `plein ${date(e.instant)}`}`,
        );
    }
    let c = p.lecture && p.lecture.colonies;
    if (c && c.vassaux && c.vassaux.length && c.total && c.total[i] > 0)
      lignes.push(
        `Pillage de vos colonies : +${numeral(c.total[i]).format()} par jour (non compté)`,
      );
    return lignes.map((l) => `<br/>${l}`).join("");
  }
  /**
   * Lignes « Plein dans … » sous la nourriture et les matériaux de l'encart
   * « S5 Pseudo », remises à l'heure chaque minute.
   *
   * @static
   * @method afficher
   */
  static afficher() {
    let $boite = $("#boiteInfo");
    if (!$boite.length) return;
    $boite.find(".o_entrepotPlein").remove();
    clearInterval(Entrepots._minuterie);
    let p = Utils.affichage("remplissageEntrepots") ? Entrepots.prevision() : null;
    Entrepots.derniere = p;
    if (!p) return;
    ["nourriture", "materiaux"].forEach((type, i) => {
      let $td = $boite.find(`.icone_${type}_boite_info`).closest("td");
      if ($td.length && Entrepots.libelle(p.entrepots[i], p.maintenant))
        $("<div class='o_entrepotPlein'></div>").attr("data-entrepot", i).appendTo($td);
    });
    Entrepots.majLignes();
    // seulement l'affichage : la prévision reste celle du chargement de la page
    Entrepots._minuterie = setInterval(() => Entrepots.majLignes(), MS_RAFRAICHISSEMENT);
  }
  /**
   * @static
   * @method majLignes
   */
  static majLignes() {
    let p = Entrepots.derniere,
      maintenant = Horloge.maintenant();
    if (!p) return;
    $("#boiteInfo .o_entrepotPlein").each((k, /** @type {HTMLElement} */ div) => {
      let e = p.entrepots[Number(div.dataset.entrepot)];
      $(div)
        .text(Entrepots.libelle(e, maintenant) || "")
        .toggleClass("o_entrepotAlerte", Entrepots.alerte(e, maintenant));
    });
  }
}
/** dernière prévision affichée (ligneInfobulle, majLignes) */
Entrepots.derniere = /** @type {any} */ (null);
/** @type {any} */
Entrepots._minuterie = null;
