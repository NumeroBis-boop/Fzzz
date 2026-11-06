// @ts-check
/*
 * ModeleChasse.js
 * Modèle du mécanisme d'une chasse, reconstruit sur 5 425 tirages du
 * simulateur du jeu (octobre 2026) : tirage des prédateurs, palier de
 * réplique, prédateurs tués, unités perdues. Ce n'est pas le code du jeu :
 * la structure du tirage et ses constantes sont ajustées aux mesures (pertes
 * moyennes à ±3 % près), les tirages de petites difficultés (< 5 000)
 * s'en écartent un peu plus. Pas encore affiché : la base d'une estimation
 * de la dispersion des pertes (quantiles, pire cas) pour le lanceur.
 **********************************************************************/

/**
 * Prédateurs par réplique croissante, calculés à la première demande.
 */
let predateursModele = null;

/**
 * Prédateurs et pertes d'une chasse, tirage par tirage. Les armées sont des
 * tableaux de 14 nombres dans l'ordre d'Armee.unite (indice 0 = JSN), qui est
 * aussi l'ordre de mort.
 *
 * @class ModeleChasse
 */
class ModeleChasse {
  /**
   * Puissance allouée aux prédateurs par point de difficulté B (celle du jeu,
   * un tiers de celle de Calystène) ; la puissance d'un prédateur est
   * √(réplique × vie).
   */
  static get PUISSANCE_PAR_DIFFICULTE() {
    return 3.466;
  }
  /**
   * Marge de sécurité sur la puissance allouée : le modèle tire des chasses
   * un peu plus dures que mesuré, pour que ses pertes ne passent jamais sous
   * celles du jeu (rejeu des 5 405 tirages : +0,3 % en zone plate, jusqu'à
   * +3,3 % au ratio 6,5). Chaque surestimation coûte de l'optimisation : la
   * marge est la plus petite qui couvre le bruit des mesures.
   */
  static get MARGE_BUDGET() {
    return 1.005;
  }
  /**
   * Escorte de petites araignées : part de la puissance d'un lot, et chance
   * d'un lot supplémentaire à chaque fois.
   */
  static get ESCORTE_PART() {
    return 0.048;
  }
  static get ESCORTE_PROBA() {
    return 0.37;
  }
  /**
   * Part du reste prise par le créneau principal : uniforme entre ces bornes.
   */
  static get PRINCIPAL_PART() {
    return [0.25, 0.75];
  }
  /**
   * Palier de réplique subi selon attaque / vie des prédateurs (seuils
   * inclusifs, dans l'ordre).
   */
  static get PALIERS() {
    return [
      [3, 0.1],
      [2, 0.3],
      [1.5, 0.5],
      [0, 1],
    ];
  }
  /**
   * Prédateurs par réplique croissante (ordre de mort) : {nom, replique, vie, puissance}.
   */
  static get PREDATEURS() {
    if (!predateursModele)
      predateursModele = FAUNE.map((f) => ({
        nom: f.nom,
        replique: f.fdf,
        vie: f.vie,
        puissance: Math.sqrt(f.fdf * f.vie),
      })).sort((a, b) => a.replique - b.replique);
    return predateursModele;
  }
  /**
   * Générateur pseudo-aléatoire (mulberry32) : même graine, mêmes tirages.
   *
   * @param {Number} graine
   * @return {Function} () => nombre dans [0, 1)
   */
  static alea(graine = Math.floor(Math.random() * 4294967296)) {
    let etat = graine >>> 0;
    return () => {
      etat = (etat + 0x6d2b79f5) >>> 0;
      let t = etat;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /**
   * Difficulté B du jeu d'une chasse de `terrain` cm² arrivant sur `tdc`
   * (celle de Calystène vaut 3 × B).
   */
  static difficulte(tdc, terrain) {
    return SimulationChasse.difficulte(Math.max(1, tdc), terrain) / 3;
  }
  /**
   * Tire les prédateurs d'une chasse : escorte, créneau principal, complément,
   * reliquats. Le jeu ne laisse jamais plus d'un lot d'escorte inutilisé :
   * au-dessus, un type inabordable est retiré ; en dessous, le premier
   * inabordable arrête. Le créneau principal est retiré quand le type tiré ne
   * tient pas dans sa part.
   *
   * @param {Number} tdc TdC à l'arrivée
   * @param {Number} terrain cm² chassés
   * @param {Function} alea générateur
   * @return {Object} {nombres (par prédateur, ordre de PREDATEURS), replique, vie, puissance}
   */
  static tirer(tdc, terrain, alea) {
    let P = ModeleChasse.PREDATEURS,
      escorte = P[0],
      budget =
        ModeleChasse.PUISSANCE_PAR_DIFFICULTE *
        ModeleChasse.MARGE_BUDGET *
        ModeleChasse.difficulte(tdc, terrain),
      nombres = new Array(P.length).fill(0),
      lot = ModeleChasse.ESCORTE_PART * budget,
      lots = 1;
    while (alea() < ModeleChasse.ESCORTE_PROBA) lots++;
    // l'escorte est réservée d'abord, comptée à la fin
    let reste = budget - lots * lot;
    // créneau principal
    for (let essai = 0; essai < 100; essai++) {
      let pred = P[Math.floor(alea() * P.length)],
        [bas, haut] = ModeleChasse.PRINCIPAL_PART,
        n = Math.floor(((bas + alea() * (haut - bas)) * reste) / pred.puissance);
      if (n > 0) {
        nombres[P.indexOf(pred)] += n;
        reste -= n * pred.puissance;
        break;
      }
    }
    // complément puis reliquats
    let complement = true;
    for (let essai = 0; essai < 1000 && reste >= escorte.puissance; essai++) {
      let pred = P[Math.floor(alea() * P.length)];
      if (pred.puissance > reste) {
        if (complement || reste > lot) continue;
        break;
      }
      let n = Math.floor(reste / pred.puissance);
      nombres[P.indexOf(pred)] += n;
      reste -= n * pred.puissance;
      complement = false;
    }
    nombres[0] += Math.round((lots * lot) / escorte.puissance);
    let replique = 0,
      vie = 0,
      puissance = 0;
    nombres.forEach((n, i) => {
      replique += n * P[i].replique;
      vie += n * P[i].vie;
      puissance += n * P[i].puissance;
    });
    return { nombres, replique, vie, puissance };
  }
  /**
   * Fraction de la réplique subie.
   */
  static palier(attaque, vie) {
    for (let [seuil, palier] of ModeleChasse.PALIERS) if (attaque >= seuil * vie) return palier;
    return 1;
  }
  /**
   * Prédateurs tués, par réplique croissante, chacun coûtant sa vie à l'attaque.
   *
   * @return {Array} nombre tué par prédateur (ordre de PREDATEURS)
   */
  static tues(nombres, attaque) {
    let P = ModeleChasse.PREDATEURS;
    return nombres.map((n, i) => {
      let k = Math.min(n, Math.floor(attaque / P[i].vie));
      attaque -= k * P[i].vie;
      return k;
    });
  }
  /**
   * Unités perdues : dans l'ordre d'Armee.unite, chacune absorbant
   * vie × (1 + 0,1 × bouclier) ; entiers tronqués.
   *
   * @return {Array} 14 nombres
   */
  static perdues(unites, degats, bouclier) {
    return unites.map((n, u) => {
      let vie = VIE_UNITE[u + 1] * (1 + 0.1 * bouclier),
        k = Math.min(n, Math.floor(degats / vie));
      degats -= k * vie;
      return k;
    });
  }
  /**
   * Une chasse, du tirage aux pertes.
   *
   * @param {Object} p tdc (à l'arrivée), terrain, unites, armes, bouclier
   * @param {Function} alea
   * @return {Object} tirage, palier, degats, tues, perdues, jsn (pertes en équivalent JSN)
   */
  static chasse(p, alea) {
    let tirage = ModeleChasse.tirer(p.tdc, p.terrain, alea),
      attaque = SimulationChasse.attaqueArmee(p.unites, p.armes),
      palier = ModeleChasse.palier(attaque, tirage.vie),
      degats = tirage.replique * palier,
      perdues = ModeleChasse.perdues(p.unites, degats, p.bouclier);
    return {
      tirage,
      palier,
      degats,
      tues: ModeleChasse.tues(tirage.nombres, attaque),
      perdues,
      jsn: perdues.reduce((s, k, u) => s + (k * VIE_UNITE[u + 1]) / VIE_UNITE[1], 0),
    };
  }
  /**
   * Statistiques d'une série de valeurs : min, médiane, moyenne, p95, max.
   */
  static statistiques(valeurs) {
    let v = valeurs.slice().sort((a, b) => a - b),
      n = v.length,
      q = (p) => (n ? v[Math.min(n - 1, Math.floor(p * n))] : 0);
    return {
      min: n ? v[0] : 0,
      mediane: q(0.5),
      moyenne: n ? v.reduce((s, x) => s + x, 0) / n : 0,
      p95: q(0.95),
      max: n ? v[n - 1] : 0,
    };
  }
  /**
   * Tailles de chasse des tirages qui engendrent les tables : TdC de 20 000 à
   * 1 000 000 cm², chasses de 5 à 20 % du TdC (difficultés de 5 000 à
   * 700 000, là où les pertes par point de difficulté ne dépendent plus de la
   * taille).
   */
  static get TAILLES_TABLES() {
    let tailles = [];
    for (let tdc of [20000, 50000, 100000, 200000, 500000, 1000000])
      for (let part of [0.05, 0.1, 0.2]) tailles.push([tdc, Math.round(tdc * part)]);
    return tailles;
  }
  /**
   * Tables de pertes du lanceur, engendrées par le modèle : pour chaque ratio
   * de `de` à `a` par pas de `pas`, JSN perdues par point de difficulté de
   * Calystène (3 × B, bouclier 0) sur `tirages` tirages rejoués contre une
   * armée de JSN au ratio voulu (la chasse est déterministe une fois les
   * prédateurs tirés : chaque tirage sert à tous les ratios). min, moy, max
   * et rep10 (part des tirages à 10 % de réplique). Déterministe à graine
   * donnée : tests/pertes-chasse.test.ts vérifie que content.js en est
   * l'exacte copie.
   *
   * @param {Object} options de, a, pas (ratios), tirages, graine
   * @return {Object} {de, pas, min, moy, max, rep10}
   */
  static tables(options = {}) {
    let de = options.de || 1,
      a = options.a || 11,
      pas = options.pas || 0.05,
      tirages = options.tirages || 100000,
      alea = ModeleChasse.alea(options.graine == null ? 2026 : options.graine),
      tailles = ModeleChasse.TAILLES_TABLES,
      T = [];
    for (let i = 0; i < tirages; i++) {
      let [tdc, terrain] = tailles[i % tailles.length],
        B = ModeleChasse.difficulte(tdc, terrain),
        t = ModeleChasse.tirer(tdc, terrain, alea);
      T.push([3 * B, t.vie, t.replique]);
    }
    let n = Math.round((a - de) / pas) + 1,
      arrondi = (x) => Number(x.toPrecision(6)),
      min = [],
      moy = [],
      max = [],
      rep10 = [];
    for (let k = 0; k < n; k++) {
      let r = de + k * pas,
        somme = 0,
        mini = Infinity,
        maxi = 0,
        dix = 0;
      for (let [D, V, R] of T) {
        let palier = ModeleChasse.palier(D * r, V),
          perte = Math.floor((R * palier) / VIE_UNITE[1]) / D;
        somme += perte;
        if (perte < mini) mini = perte;
        if (perte > maxi) maxi = perte;
        if (palier == 0.1) dix++;
      }
      min.push(arrondi(mini));
      moy.push(arrondi(somme / T.length));
      max.push(arrondi(maxi));
      rep10.push(arrondi(dix / T.length));
    }
    return { de, pas, min, moy, max, rep10 };
  }
  /**
   * Une salve tirée `tirages` fois : la i-ème chasse arrive sur
   * tdcArrivee + i × terrain avec sa propre armée.
   *
   * @param {Object} p tdcArrivee, terrain, armes, bouclier, chasses [{unites}]
   * @param {Number} tirages
   * @param {Number} graine
   * @return {Object} chasses [{paliers {0.1: proba…}, jsn (statistiques), perdues (moyenne par unité), pire (perdues du pire tirage)}], total (idem sur la somme des chasses d'un même tirage)
   */
  static salve(p, tirages, graine) {
    let alea = ModeleChasse.alea(graine),
      n = p.chasses.length,
      parChasse = p.chasses.map(() => ({
        paliers: {},
        jsn: [],
        perdues: new Array(14).fill(0),
        pire: null,
      })),
      totaux = new Array(tirages).fill(0),
      perduesTotal = new Array(14).fill(0),
      pireTotal = { jsn: -1, perdues: new Array(14).fill(0) };
    for (let t = 0; t < tirages; t++) {
      let somme = new Array(14).fill(0),
        jsnTotal = 0;
      for (let i = 0; i < n; i++) {
        let r = ModeleChasse.chasse(
            {
              tdc: p.tdcArrivee + i * p.terrain,
              terrain: p.terrain,
              unites: p.chasses[i].unites,
              armes: p.armes,
              bouclier: p.bouclier,
            },
            alea,
          ),
          c = parChasse[i];
        c.paliers[r.palier] = (c.paliers[r.palier] || 0) + 1;
        c.jsn.push(r.jsn);
        r.perdues.forEach((k, u) => {
          c.perdues[u] += k;
          somme[u] += k;
        });
        if (!c.pire || r.jsn > c.pire.jsn) c.pire = { jsn: r.jsn, perdues: r.perdues };
        jsnTotal += r.jsn;
      }
      totaux[t] = jsnTotal;
      somme.forEach((k, u) => (perduesTotal[u] += k));
      if (jsnTotal > pireTotal.jsn) pireTotal = { jsn: jsnTotal, perdues: somme };
    }
    let finir = (c) => ({
      paliers: Object.fromEntries(
        ModeleChasse.PALIERS.map(([, palier]) => [palier, (c.paliers[palier] || 0) / tirages]),
      ),
      jsn: ModeleChasse.statistiques(c.jsn),
      perdues: c.perdues.map((k) => k / tirages),
      pire: c.pire ? c.pire.perdues : new Array(14).fill(0),
    });
    return {
      tirages,
      chasses: parChasse.map(finir),
      total: {
        jsn: ModeleChasse.statistiques(totaux),
        perdues: perduesTotal.map((k) => k / tirages),
        pire: pireTotal.perdues,
      },
    };
  }
}
