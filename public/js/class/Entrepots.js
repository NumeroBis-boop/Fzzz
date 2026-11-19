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
// lecture de la page Ressources, par joueur : pillage subi, production,
// prochaine récolte et colonies, reprise sur les autres pages, où l'encart
// « S5 Pseudo » n'en dit rien
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
// capacité d'un entrepôt : 500 + 1 200 × 2^niveau, donc 2 × capacité − 500 au niveau suivant
const ENTREPOT_BASE = 500;
const ENTREPOT_PAR_NIVEAU = 1200;
// convois qui arrivent chez le joueur, par joueur : lignes « Vous allez recevoir … »
// de la page Convois, à chaque lecture ; le jeu ne les montre qu'avec le Compte+
// (constat du mainteneur, 19/11/2026)
const CLE_CONVOIS_ENTRANTS = "fzzz_convoisEntrants";
// une ligne, icônes remplacées par leur nom : « Vous allez recevoir 1 500 000
// nourritures et 0 materiaux de Krokmou dans 1J 2H 03m 10s » ; un seul montant lu aussi
const LIGNE_CONVOI_RECU =
  /^Vous allez recevoir (\d[\d ]*?) ?(\D*?)(?: et (\d[\d ]*?) ?(\D*?))? de (\S+(?: \S+){0,3}?) dans ((?:\d+ ?[jhms] ?)+)/i;
// compte à rebours du jeu : reste(secondes, "id de son span"), resteTemps dans l'encart Compte+
const RESTE_JEU = /reste(?:Temps)?\(\s*(\d+)\s*,\s*["']([^"']+)["']/;
// entrepôt en construction, par joueur : vu dans l'encart Compte+ du jeu ou sur
// la page Construction, gardé après sa fin tant que le niveau connu ne le compte pas
const CLE_CHANTIER_ENTREPOT = "fzzz_chantierEntrepot";
// écart toléré entre deux lectures de la fin d'une même construction
const ECART_FIN_CHANTIER = 30000;
// noms des deux entrepôts dans le jeu (rangs 1 et 2 de CONSTRUCTION, content.js)
const NOMS_ENTREPOTS = [/entrep[oô]t de nourriture/i, /entrep[oô]t de mat[eé]riaux/i];

/**
 * Remplissage des entrepôts. Sous la nourriture et les matériaux de l'encart
 * « S5 Pseudo », le temps avant qu'ils soient pleins (ou la famine) : à chaque
 * récolte du jeu, terrain exploité, champignonnière et armée, pillage subi
 * déduit (page Ressources), convois qui arrivent (page Convois) et
 * entrepôt agrandi à la fin de sa construction (chantier). Ni le
 * terrain des chasses et floods en cours, ni le pillage reçu en seigneur n'y
 * sont comptés (règles du mainteneur) : l'info-bulle montre ce dernier. Sur la page Ressources, un bilan sous
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
    return Number.isInteger(niveauEtable) && niveauEtable >= 0
      ? TAXE_COLONIE + TAXE_COLONIE_PAR_NIVEAU * niveauEtable
      : null;
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
   * subi, prochaine récolte), même case décochée, ajoute le bilan sous le bloc « Récoltes », refait les
   * lignes de l'encart, puis calcule le pillage des colonies (requêtes, une
   * des deux cases cochée) et refait le bilan.
   *
   * @static
   * @method recolte
   * @return {Promise<void>}
   */
  static recolte() {
    let lu = Entrepots.lireRecolte();
    if (!lu) return Promise.resolve();
    let production = Entrepots.lireInfobulle() || lu,
      base = production.terrain[0] + production.terrain[1] + production.champignon[0],
      avant = Entrepots.lecture();
    Entrepots._noter({
      lu: Horloge.maintenant(),
      pille: lu.pille,
      taux: base > 0 ? (lu.pille[0] + lu.pille[1]) / base : 0,
      production: {
        terrain: production.terrain,
        champignon: production.champignon,
        armee: production.armee,
      },
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
        if (!url)
          throw new Error(
            `pas de ligne « ${REGLAGES_ALLIANCE.feuilleStats.nom} » dans le sujet « ${TITRE_REGLAGES} »`,
          );
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
   * Garde les convois qui arrivent chez le joueur, lus sur la page Convois ou
   * dans sa relecture (pages Construction et Laboratoire), et redessine les
   * lignes « Plein dans … » de l'encart avec eux.
   *
   * @static
   * @method garderConvois
   * @param {Array<{de: String, t: Number, q: Array<Number>}>} liste (lireConvois)
   * @param {Number} instant heure de la lecture (ms, horloge du serveur)
   */
  static garderConvois(liste, instant) {
    Entrepots.convoisLus = liste;
    let pseudo = String(monProfil.pseudo || "").toLowerCase();
    if (pseudo) {
      let tout = Utils.lireStockage(CLE_CONVOIS_ENTRANTS);
      tout[pseudo] = { lu: instant, convois: liste.filter((c) => c.t > instant) };
      try {
        localStorage.setItem(CLE_CONVOIS_ENTRANTS, JSON.stringify(tout));
      } catch (e) {}
    }
    if ($("#boiteInfo .o_entrepotPlein").length) Entrepots.afficher();
  }
  /**
   * Convois qui arrivent chez le joueur, gardés à la dernière lecture de la
   * page Convois (garderConvois) ; avant la première, ceux que Commerce.js
   * gardait sans Compte+.
   *
   * @static
   * @method convoisGardes
   * @return {Array<{de: String, t: Number, q: Array<Number>}>} par heure d'arrivée
   */
  static convoisGardes() {
    let garde =
      Utils.lireStockage(CLE_CONVOIS_ENTRANTS)[String(monProfil.pseudo || "").toLowerCase()];
    if (garde && Array.isArray(garde.convois))
      return garde.convois
        .map((/** @type {any} */ c) => ({
          de: String(c.de || ""),
          t: Number(c.t),
          q: [Number(c.q && c.q[0]) || 0, Number(c.q && c.q[1]) || 0],
        }))
        .sort((a, b) => a.t - b.t);
    let liste = Utils.lireStockage("outiiil_evolution").convoi;
    return (Array.isArray(liste) ? liste : [])
      .filter((c) => c.sens === false)
      .map((c) => ({
        de: String(c.cible || ""),
        t: moment(c.exp).valueOf(),
        q: [Number(c.nou) || 0, Number(c.mat) || 0],
      }))
      .sort((a, b) => a.t - b.t);
  }
  /**
   * Convois gardés qui ne sont pas encore arrivés.
   *
   * @static
   * @method convois
   * @param {Number} maintenant
   * @return {Array<Array<{t: Number, q: Number}>>} [nourriture, matériaux]
   */
  static convois(maintenant) {
    return Entrepots.parType(Entrepots.convoisGardes().filter((c) => c.t > maintenant));
  }
  /**
   * Convois qui arrivent chez le joueur d'après une page Convois : « Vous allez
   * recevoir A et B de X dans … ». Lus dans le texte du cadre, quelle que soit
   * la balise des lignes : le jeu ne les montre qu'avec le Compte+ et leur forme
   * réelle n'est pas connue (des <strong> attendus n'ont rien donné chez le
   * mainteneur, 19/11/2026). Une ligne illisible est comptée dans
   * `convoisIllisibles` et notée au journal avec son HTML.
   *
   * @static
   * @method lireConvois
   * @param {any} $racine page Convois (jQuery)
   * @param {Number} instant heure de la page (ms, horloge du serveur)
   * @return {Array<{de: String, t: Number, q: Array<Number>}>} par heure
   *   d'arrivée ; q : [nourriture, matériaux]
   */
  static lireConvois($racine, instant) {
    /** @type {Array<{de: String, t: Number, q: Array<Number>}>} */
    let liste = [],
      /** @type {Array<String>} */
      illisibles = [],
      centre = $racine.find("#centre")[0];
    Entrepots.convoisIllisibles = 0;
    if (!centre) return liste;
    let $copie = $(centre.cloneNode(true));
    // compte à rebours écrit seulement par le script du jeu : ses secondes
    $copie.find("script").each((/** @type {Number} */ k, /** @type {HTMLElement} */ s) => {
      let m = (s.textContent || "").match(RESTE_JEU),
        $span = m ? $copie.find(`[id="${m[2]}"]`) : $();
      if ($span.length && !$span.text().trim()) $span.text(`${m[1]}s`);
    });
    $copie.find("script, style").remove();
    // une icône compte pour son nom (« nourritures », « materiaux ») : il dit la ressource
    $copie
      .find("img")
      .each((/** @type {Number} */ k, /** @type {HTMLElement} */ img) =>
        $(img).replaceWith(` ${img.getAttribute("alt") || ""} `),
      );
    ($copie.text() || "")
      .replace(/\s+/g, " ")
      // une ligne par « Vous allez » : une ligne illisible ne prend pas le compte à rebours de la suivante
      .split(/(?=Vous allez )/i)
      .filter((/** @type {String} */ l) => /^Vous allez recevoir\b/i.test(l))
      .forEach((/** @type {String} */ ligne) => {
        let m = ligne.match(LIGNE_CONVOI_RECU);
        if (!m) {
          illisibles.push(ligne.slice(0, 200).trim());
          return;
        }
        let q = [0, 0];
        [
          [m[1], m[2]],
          [m[3], m[4]],
        ].forEach(([n, nom], k) => {
          if (n != null)
            q[/mat|bois/i.test(nom) ? 1 : /nour|pomme/i.test(nom) ? 0 : k] += Entrepots.nombre(n);
        });
        liste.push({ de: m[5].trim(), t: instant + Utils.timeToInt(m[6].trim()) * 1000, q });
      });
    if (illisibles.length) {
      Entrepots.convoisIllisibles = illisibles.length;
      Journal.info(
        JOURNAL_ENTREPOTS,
        `${illisibles.length} convoi(s) qui arrive(nt) illisible(s) sur la page Convois`,
        `${illisibles.join(" | ")}\nHTML : ${Entrepots._htmlRecus(centre)}`,
      );
    }
    return liste.sort((a, b) => a.t - b.t);
  }
  /**
   * HTML des lignes « recevoir » d'une page Convois, pour le journal : la
   * balise de la ligne et ce qui la suit jusqu'au <br>.
   *
   * @private
   * @static
   * @param {HTMLElement} centre
   * @return {String}
   */
  static _htmlRecus(centre) {
    return $(centre)
      .find("*")
      .addBack()
      .contents()
      .filter(
        (/** @type {Number} */ k, /** @type {Node} */ n) =>
          n.nodeType == 3 && /allez recevoir/i.test(n.textContent || ""),
      )
      .slice(0, 3)
      .map((/** @type {Number} */ k, /** @type {Node} */ texte) => {
        let debut = texte.parentNode && texte.parentNode != centre ? texte.parentNode : texte,
          html = "";
        for (let n = debut; n && n.nodeName != "BR" && html.length < 500; n = n.nextSibling)
          html += n.nodeType == 1 ? /** @type {Element} */ (n).outerHTML : n.textContent;
        return html.slice(0, 500);
      })
      .get()
      .join(" | ");
  }
  /**
   * @static
   * @method parType
   * @param {Array<{t: Number, q: Array<Number>}>} liste (lireConvois)
   * @return {Array<Array<{t: Number, q: Number}>>} [nourriture, matériaux]
   */
  static parType(liste) {
    return [0, 1].map((i) => liste.filter((c) => c.q[i] > 0).map((c) => ({ t: c.t, q: c.q[i] })));
  }
  /**
   * Stock pas à pas jusqu'à JOURS_REMPLISSAGE_MAX jours : à chaque récolte du
   * jeu, toutes les 30 min, le 48e de la production nette du jour (terrain,
   * champignonnière et consommation de l'armée arrivent ensemble, règle du
   * mainteneur, 18/11/2026) ; les convois à leur arrivée ; la capacité agrandie
   * à la fin d'une construction de l'entrepôt. Sans heure de récolte connue, la
   * production est étalée sur la journée.
   *
   * @static
   * @method simuler
   * @param {{stock: Number, capacite: Number, parJour: Number, prochaine: Number|null, convois: Array<{t: Number, q: Number}>, maintenant: Number, agrandissement?: {t: Number, capacite: Number}|null, objectif?: Number|null}} e
   *   parJour : production nette du jour, pillage subi déduit ; prochaine : heure
   *   d'une récolte ; agrandissement : capacité à la fin d'une construction de
   *   l'entrepôt ; objectif : stock cherché, la capacité sinon (plein)
   * @return {{atteint: Number|null, famine: Number|null}} ms ; atteint :
   *   maintenant si c'est déjà le cas, null au-delà de JOURS_REMPLISSAGE_MAX
   *   jours ou au-dessus de la capacité ; famine : la nourriture à zéro
   */
  static simuler({
    stock,
    capacite,
    parJour,
    prochaine,
    convois,
    maintenant,
    agrandissement = null,
    objectif = null,
  }) {
    let limite = maintenant + JOURS_REMPLISSAGE_MAX * MS_JOUR,
      palier =
        agrandissement && agrandissement.t > maintenant && agrandissement.t <= limite
          ? agrandissement
          : null,
      // plein : la capacité, agrandie à la fin d'une construction
      cible = () => (objectif == null ? capacite : objectif),
      s = Math.min(stock, capacite);
    if (s >= cible()) return { atteint: maintenant, famine: null };
    if (cible() > Math.max(capacite, palier ? palier.capacite : 0))
      return { atteint: null, famine: null };
    let parRecolte = prochaine != null ? parJour / RECOLTES_PAR_JOUR : 0,
      v = prochaine != null ? 0 : parJour,
      t = maintenant,
      suivante = prochaine != null ? prochaine : Infinity,
      /** @type {Number|null} */
      famine = null,
      evenements = convois
        .filter((x) => x.t > maintenant && x.t <= limite)
        .sort((a, b) => a.t - b.t),
      k = 0;
    while (suivante < t) suivante += MS_RECOLTE;
    while (t < limite) {
      let fin = Math.min(
        suivante,
        k < evenements.length ? evenements[k].t : Infinity,
        palier ? palier.t : Infinity,
        limite,
      );
      if (v) {
        let apres = s + (v * (fin - t)) / MS_JOUR;
        if (v > 0 && apres >= cible() && cible() <= capacite)
          return { atteint: t + ((cible() - s) / v) * MS_JOUR, famine };
        if (v < 0 && famine == null && apres <= 0) famine = t + (s / -v) * MS_JOUR;
        s = Math.min(capacite, Math.max(0, apres));
      }
      t = fin;
      if (t >= limite) break;
      if (palier && palier.t === t) {
        capacite = palier.capacite;
        palier = null;
      }
      for (; k < evenements.length && evenements[k].t === t; k++) s += evenements[k].q;
      if (suivante === t) {
        s += parRecolte;
        suivante += MS_RECOLTE;
        if (parRecolte < 0 && famine == null && s <= 0) famine = t;
      }
      s = Math.min(capacite, Math.max(0, s));
      if (s >= cible()) return { atteint: t, famine };
      // plus rien ne fait monter le stock (et la famine, s'il y en a une, est datée)
      if (
        parRecolte <= 0 &&
        v <= 0 &&
        k >= evenements.length &&
        !palier &&
        (famine != null || (parRecolte == 0 && v == 0))
      )
        break;
    }
    return { atteint: null, famine };
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
    if (niveau >= 0) return ENTREPOT_BASE + ENTREPOT_PAR_NIVEAU * Math.pow(2, niveau);
    let titre =
        $("#boiteInfo")
          .find(`.icone_${i ? "materiaux" : "nourriture"}_boite_info`)
          .closest("td")
          .attr("title") || "",
      pourcent = parseInt((titre.match(/rempli à (\d+)\s*%/) || [])[1]);
    return pourcent > 0 && stock > 0 ? Math.round(stock / (pourcent / 100)) : null;
  }
  /**
   * Plus petit niveau d'entrepôt dont la capacité contient une quantité.
   *
   * @static
   * @method niveauPour
   * @param {Number} quantite
   * @return {Number}
   */
  static niveauPour(quantite) {
    let niveau = 0;
    while (ENTREPOT_BASE + ENTREPOT_PAR_NIVEAU * Math.pow(2, niveau) < quantite) niveau++;
    return niveau;
  }
  /**
   * Récoltes du jeu de `debut` à `fin` compris, comme simuler les compte : la
   * première à `prochaine` ou toutes les 30 min après, pas avant `debut`.
   *
   * @static
   * @method recoltes
   * @param {Number} prochaine heure d'une récolte (ms)
   * @param {Number} debut
   * @param {Number} fin
   * @return {{nombre: Number, premiere: Number|null, derniere: Number|null}}
   */
  static recoltes(prochaine, debut, fin) {
    let premiere =
      prochaine >= debut
        ? prochaine
        : prochaine + Math.ceil((debut - prochaine) / MS_RECOLTE) * MS_RECOLTE;
    if (fin < premiere) return { nombre: 0, premiere: null, derniere: null };
    let nombre = Math.floor((fin - premiere) / MS_RECOLTE) + 1;
    return { nombre, premiere, derniere: premiere + (nombre - 1) * MS_RECOLTE };
  }
  /**
   * Capacité au niveau suivant : 500 + 1 200 × 2^(niveau + 1).
   *
   * @static
   * @method capaciteSuivante
   * @param {Number} capacite
   * @return {Number}
   */
  static capaciteSuivante(capacite) {
    return 2 * capacite - ENTREPOT_BASE;
  }
  /**
   * Entrepôt en construction d'après la page ouverte : l'encart Compte+ du
   * jeu, sur chaque page (nom sans niveau et temps restant), sinon la page
   * Construction (« - Entrepôt de Nourriture 15 se termine dans : »).
   *
   * @static
   * @method chantierVu
   * @param {Number} maintenant
   * @return {{i: Number, fin: Number}|null|undefined} null : autre construction ou
   *   aucune ; undefined : la page n'en dit rien
   */
  static chantierVu(maintenant) {
    let entrepot = (/** @type {String} */ nom, /** @type {Number} */ secondes) => {
      let i = NOMS_ENTREPOTS.findIndex((r) => r.test(nom));
      return i >= 0 && secondes > 0 ? { i, fin: maintenant + secondes * 1000 } : null;
    };
    let $ligne = $("#ligne_construction");
    if ($ligne.length)
      return entrepot(
        $ligne.find("td").eq(1).text(),
        parseInt(
          ($ligne
            .find("script")
            .text()
            .match(/resteTemps\((\d+)/) || [])[1],
        ),
      );
    if (location.pathname.toLowerCase() != "/construction.php") return undefined;
    /** @type {{i: Number, fin: Number}|null} */
    let vu = null;
    $("#centre > strong").each((/** @type {Number} */ k, /** @type {Element} */ elt) => {
      vu =
        vu ||
        entrepot(
          $(elt).text(),
          parseInt(
            ($(elt)
              .children("script")
              .text()
              .match(/reste\((\d+),/) || [])[1],
          ),
        );
    });
    return vu;
  }
  /**
   * Entrepôt en construction pour le calcul, gardé par joueur : celui que
   * montre la page, sinon le dernier vu. Après sa fin, il reste compté tant
   * que le niveau connu ne le compte pas (lu sur la page Construction : un
   * compte Compte+ ne le met à jour qu'en l'ouvrant) ; une autre construction
   * vue avant sa fin l'annule.
   *
   * @static
   * @method chantier
   * @param {Number} maintenant
   * @return {{i: Number, fin: Number, niveau: Number}|null} niveau : celui d'avant
   *   la construction, -1 s'il est inconnu
   */
  static chantier(maintenant) {
    let pseudo = String(monProfil.pseudo || "").toLowerCase(),
      tout = Utils.lireStockage(CLE_CHANTIER_ENTREPOT),
      /** @type {{i: Number, fin: Number, niveau: Number}|null} */
      garde = (pseudo && tout[pseudo]) || null,
      vu = Entrepots.chantierVu(maintenant),
      niveaux = monProfil.niveauConstruction || [],
      connu = (/** @type {Number} */ i) => (niveaux[i + 1] >= 0 ? niveaux[i + 1] : -1),
      chantier = garde;
    if (vu) {
      let meme = !!garde && garde.i == vu.i && Math.abs(garde.fin - vu.fin) < ECART_FIN_CHANTIER;
      // la même construction : sa première lecture, sans réécrire à chaque page
      chantier =
        meme && garde.niveau >= 0
          ? garde
          : { ...(meme ? { i: garde.i, fin: garde.fin } : vu), niveau: connu(vu.i) };
    } else if (vu === null && garde && garde.fin > maintenant + ECART_FIN_CHANTIER) chantier = null;
    else if (vu === undefined && !garde) chantier = Entrepots._chantierSynthese(maintenant, connu);
    // finie et comptée : par le niveau connu, sinon par le « rempli à N % » de l'encart
    if (
      chantier &&
      (connu(chantier.i) >= 0 && chantier.niveau >= 0
        ? connu(chantier.i) > chantier.niveau
        : chantier.fin <= maintenant)
    )
      chantier = null;
    if (pseudo && JSON.stringify(chantier) != JSON.stringify(garde)) {
      if (chantier) tout[pseudo] = chantier;
      else delete tout[pseudo];
      try {
        localStorage.setItem(CLE_CHANTIER_ENTREPOT, JSON.stringify(tout));
      } catch (e) {}
    }
    return chantier;
  }
  /**
   * Hors Compte+ : construction en cours que garde l'encadré de synthèse de
   * l'extension (lue sur la page Construction), quand ce calcul ne l'a pas vue.
   *
   * @private
   * @static
   * @param {Number} maintenant
   * @param {function(Number): Number} connu niveau connu d'un entrepôt, -1 sinon
   * @return {{i: Number, fin: Number, niveau: Number}|null}
   */
  static _chantierSynthese(maintenant, connu) {
    let evolution = Utils.lireStockage("outiiil_evolution"),
      i = NOMS_ENTREPOTS.findIndex((r) => r.test(String(evolution.construction || ""))),
      fin = moment(evolution.expConstruction).valueOf();
    return i >= 0 && fin > maintenant ? { i, fin, niveau: connu(i) } : null;
  }
  /**
   * Ce que le calcul sait de la page ouverte et de la dernière lecture de la
   * page Ressources : production nette du jour de chaque ressource (pillage
   * subi déduit, sauf si le total de l'info-bulle le compte déjà), prochaine
   * récolte, stock, capacité, agrandissement en cours et convois attendus.
   *
   * Convois : ceux de la page Convois relue sur cette page (Entrepots.convoisLus),
   * sinon ceux de la dernière visite de la page Convois.
   *
   * @static
   * @method etat
   * @param {Number} maintenant
   * @return {{maintenant: Number, parJour: Array<Number>, production: {terrain: Array<Number>, champignon: Array<Number>, armee: Array<Number>}, autres: Array<Number>, libelleAutres: String, prochaine: Number|null, pillage: Boolean, lecture: any, entrepots: Array<{stock: Number, capacite: Number|null, agrandissement: {t: Number, capacite: Number}|null, convois: Array<{t: Number, q: Number}>}>}|null}
   *   parJour = terrain + champignonnière + armée + autres, [nourriture,
   *   matériaux] ; autres : pillage subi (négatif), ou les autres lignes du
   *   total du jeu quand il le compte déjà ; null : production inconnue
   */
  static etat(maintenant) {
    let info = Entrepots.lireInfobulle(),
      lecture = Entrepots.lecture(),
      production = info || (lecture && lecture.production);
    if (!production) return null;
    let sansPillage = [
        production.terrain[0] + production.champignon[0] + production.armee[0],
        production.terrain[1],
      ],
      // le total du jeu compte-t-il déjà le pillage (lignes en plus, ou écart) ?
      compte =
        !!info &&
        [0, 1].some((i) => Math.abs(info.total[i] - sansPillage[i]) > ECART_TOTAL_RECOLTE),
      taux = (lecture && lecture.taux) || 0,
      // la part du seigneur est prise sur le terrain et la champignonnière, pas sur l'armée
      garde = 1 - taux,
      parJour = compte
        ? [info.total[0], info.total[1]]
        : [
            (production.terrain[0] + production.champignon[0]) * garde + production.armee[0],
            production.terrain[1] * garde,
          ],
      attendus = Entrepots.convoisLus
        ? Entrepots.parType(Entrepots.convoisLus.filter((c) => c.t > maintenant))
        : Entrepots.convois(maintenant),
      stocks = [Utils.nourriture, Utils.materiaux],
      chantier = Entrepots.chantier(maintenant);
    return {
      maintenant,
      parJour,
      production: {
        terrain: production.terrain,
        champignon: production.champignon,
        armee: production.armee,
      },
      autres: compte
        ? [info.autres[0], info.autres[1]]
        : [
            -taux * (production.terrain[0] + production.champignon[0]),
            -taux * production.terrain[1],
          ],
      libelleAutres:
        !compte || (lecture && lecture.pille && lecture.pille[0] + lecture.pille[1] > 0)
          ? "Pillage"
          : "Autres",
      prochaine: (lecture && lecture.recolte) || null,
      pillage: compte || taux > 0,
      lecture,
      entrepots: [0, 1].map((i) => {
        let stock = stocks[i] || 0,
          ch = chantier && chantier.i == i ? chantier : null,
          finie = !!ch && ch.fin <= maintenant,
          base = Entrepots.capacite(i, stock),
          // construction finie que le niveau connu, celui d'avant, ne compte pas encore
          retard = finie && (monProfil.niveauConstruction || [])[i + 1] === ch.niveau,
          capacite = base != null && retard ? Entrepots.capaciteSuivante(base) : base;
        return {
          stock,
          capacite,
          agrandissement:
            ch && !finie && capacite != null
              ? { t: ch.fin, capacite: Entrepots.capaciteSuivante(capacite) }
              : null,
          convois: attendus[i],
        };
      }),
    };
  }
  /**
   * Prévision des deux entrepôts : heure où chacun sera plein, famine.
   *
   * @static
   * @method prevision
   * @return {{maintenant: Number, entrepots: Array<{stock: Number, capacite: Number|null, debit: Number, convois: Number, instant: Number|null, famine: Number|null, agrandissement: {t: Number, capacite: Number}|null}>, pillage: Boolean, lecture: any}|null}
   *   null : production inconnue
   */
  static prevision() {
    let e = Entrepots.etat(Horloge.maintenant());
    if (!e) return null;
    return {
      maintenant: e.maintenant,
      pillage: e.pillage,
      lecture: e.lecture,
      entrepots: e.entrepots.map((x, i) => {
        let r = Entrepots.simuler({
          stock: x.stock,
          capacite: x.capacite == null ? Infinity : x.capacite,
          parJour: e.parJour[i],
          prochaine: e.prochaine,
          convois: x.convois,
          maintenant: e.maintenant,
          agrandissement: x.agrandissement,
        });
        return {
          stock: x.stock,
          capacite: x.capacite,
          debit: e.parJour[i],
          convois: x.convois.reduce((n, c) => n + c.q, 0),
          instant: r.atteint,
          // seule la nourriture se mange
          famine: i == 0 ? r.famine : null,
          agrandissement: x.agrandissement,
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
      if (e.agrandissement && e.capacite != null)
        lignes.push(
          `Construction en cours comptée : capacité ${numeral(e.capacite).format()} → ${numeral(e.agrandissement.capacite).format()} ${date(e.agrandissement.t)}`,
        );
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
/** convois de la page Convois relue sur la page ouverte (DelaiRessources), null sinon */
Entrepots.convoisLus = /** @type {Array<{de: String, t: Number, q: Array<Number>}>|null} */ (null);
/** lignes « Vous allez recevoir » illisibles à la dernière lecture d'une page Convois */
Entrepots.convoisIllisibles = 0;
/** @type {any} */
Entrepots._minuterie = null;
