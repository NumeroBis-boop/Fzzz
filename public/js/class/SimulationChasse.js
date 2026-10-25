/*
 * SimulationChasse.js
 * Portage du simulateur de chasse de Calystene, révision 2.00.38
 * (http://alliancead2.free.fr), sans accès au DOM : le lanceur de chasses
 * (Ressources.php) et l'onglet « Simuler » de la boite chasse partagent le
 * même calcul.
 **********************************************************************/

/**
 * Calculs de chasse. Les armées sont des tableaux de 14 nombres dans l'ordre
 * de NOM_UNITE sans les ouvrières (indice 0 = JSN), comme Armee.unite.
 *
 * @class SimulationChasse
 */
class SimulationChasse {
  /**
   * JSN envoyées avec chaque chasse quand des unités XP partent : pertes max × ce facteur.
   */
  static get FACTEUR_SECURITE() {
    return 2.0;
  }
  /**
   * Attaque de base (hors bonus) d'une armée.
   */
  static attaqueBase(unites) {
    return unites.reduce((acc, n, i) => acc + n * ATT_UNITE[i + 1], 0);
  }
  /**
   * Attaque avec le bonus Armes.
   */
  static attaqueArmee(unites, armes) {
    let base = SimulationChasse.attaqueBase(unites);
    return base + (base * armes) / 10;
  }
  /**
   * Difficulté d'une chasse de `terrain` cm² qui arrive sur un TdC de `tdc` cm².
   */
  static difficulte(tdc, terrain) {
    return (
      (terrain + tdc * 0.01) *
      Math.pow(1.04, Math.round(Math.log(tdc / 50) / Math.log(Math.pow(10, 0.1)))) *
      3
    );
  }
  /**
   * Difficulté totale de `nombre` chasses de `terrain` cm², chacune arrivant
   * sur le TdC apporté par les précédentes.
   */
  static difficulteTotale(tdcArrivee, terrain, nombre) {
    let difficulte = 0;
    for (let i = 0; i < nombre; i++)
      difficulte += SimulationChasse.difficulte(tdcArrivee + terrain * i, terrain);
    return difficulte;
  }
  /**
   * Indice du ratio de référence des estimations de pertes : le plus proche
   * en dessous du ratio réel (le pire cas).
   */
  static indexRatioRef(ratio) {
    let index = 0;
    for (let i = 0; i < RATIO_CHASSE.length; i++) if (RATIO_CHASSE[i] <= ratio + 0.0001) index = i;
    return index;
  }
  /**
   * Pertes estimées, en nombre de JSN tuées.
   */
  static pertes(indexRatio, difficulte, bouclier) {
    let facteur = (difficulte / (10 + bouclier)) * 10;
    return {
      MIN: PERTE_MIN_CHASSE[indexRatio] * facteur,
      AVG: PERTE_MOY_CHASSE[indexRatio] * facteur,
      MAX: PERTE_MAX_CHASSE[indexRatio] * facteur,
    };
  }
  /**
   * Durée d'une chasse en secondes.
   */
  static duree(tdcLancement, terrain, vitesseChasse) {
    return Math.round((terrain + tdcLancement) * Math.pow(0.9, vitesseChasse));
  }
  /**
   * Nombre de chasses et terrain par chasse qui gardent le ratio au moins au
   * niveau visé. La recherche (héritée du simulateur Excel de 2009) part d'un
   * quart du TdC de lancement.
   */
  static calculerChasses(
    ratio,
    attArmee,
    nombreMax,
    tdcArrivee,
    terrainMin,
    nombreFixe = 0,
    terrainFixe = 0,
  ) {
    let cible = ratio + 0.0001,
      terrain = terrainFixe > 0 ? terrainFixe : Math.max(1, terrainMin),
      nombre = nombreFixe > 0 ? nombreFixe : 1,
      ratioDe = (t, n) => attArmee / SimulationChasse.difficulteTotale(tdcArrivee, t, n);
    if (!nombreFixe) while (ratioDe(terrain, nombre + 1) >= cible && nombre < nombreMax) nombre++;
    if (!terrainFixe) {
      // trop difficile : on baisse le terrain, par puissances de dix décroissantes
      for (let j = 5000000000000; j > 4; j /= 10)
        while (terrain > j && terrain > 1 && ratioDe(terrain - j, nombre) < cible) terrain -= j;
      while (terrain > 1 && ratioDe(terrain - 1, nombre) < cible) terrain--;
      // trop facile : on l'augmente
      for (let j = 5000000000000; j > 4; j /= 10)
        while (ratioDe(terrain + j, nombre) >= cible) terrain += j;
      while (ratioDe(terrain + 1, nombre) >= cible) terrain++;
      // 2.00.38 : les petites chasses pouvaient finir 1 cm² au-dessus du ratio
      while (terrain > 1 && ratioDe(terrain, nombre) < cible) terrain--;
    }
    return { nombre, terrain };
  }
  /**
   * Répartit l'armée entre les chasses, de la dernière à la première : les JSN
   * d'abord (deux fois les pertes max quand des unités XP partent, sinon au
   * prorata de la difficulté), puis les autres unités jusqu'à la part
   * d'attaque de la chasse. La première chasse prend tout ce qui reste.
   */
  static repartir(unites, tdcArrivee, terrain, nombre, indexRef, bouclier) {
    let dispo = unites.slice(),
      difficulte = SimulationChasse.difficulteTotale(tdcArrivee, terrain, nombre),
      restante = difficulte,
      base = SimulationChasse.attaqueBase(unites),
      chasses = new Array(nombre);
    for (let c = nombre - 1; c >= 0; c--) {
      let envoi = new Array(14).fill(0),
        diff = SimulationChasse.difficulte(tdcArrivee + c * terrain, terrain),
        pertes = SimulationChasse.pertes(indexRef, diff, bouclier),
        att = difficulte ? (diff * base) / difficulte : 0,
        xp = ORDRE_XP_CHASSE.some((u) => dispo[u] > 0);
      if (xp) envoi[0] = Math.round(pertes.MAX * SimulationChasse.FACTEUR_SECURITE);
      else {
        envoi[0] = Math.round((dispo[0] * diff) / restante);
        restante -= diff;
      }
      if (!c || envoi[0] > dispo[0] || envoi[0] < 0) envoi[0] = dispo[0];
      dispo[0] -= envoi[0];
      att -= envoi[0] * ATT_UNITE[1];
      for (let u of ORDRE_UNITE_CHASSE) {
        if (dispo[u] <= 0 || att <= 0) continue;
        let n = dispo[u] * ATT_UNITE[u + 1] > att ? Math.round(att / ATT_UNITE[u + 1]) : dispo[u];
        // Écart volontaire avec la 2.00.38, qui teste `envoi[u] + n` ici : pour
        // le complément de JSN, les JSN de sécurité sont comptées deux fois et la
        // chasse prend alors tout le stock, laissant les premières sans JSN.
        if (!c || n > dispo[u] || n < 0) n = dispo[u];
        envoi[u] += n;
        dispo[u] -= n;
        att -= n * ATT_UNITE[u + 1];
      }
      chasses[c] = { unites: envoi, difficulte: diff, pertes };
    }
    return chasses;
  }
  /**
   * Simulation complète : nombre et terrain des chasses, ratio, pertes, répartition.
   *
   * @param {Object} p unites, armes, bouclier, tdcLancement, tdcArrivee, ratio,
   *   nombreMax, et en option nombreFixe / terrainFixe (0 = calculé)
   */
  static simuler(p) {
    let tdcArrivee = Math.max(1, p.tdcArrivee),
      tdcLancement = Math.max(1, p.tdcLancement),
      attArmee = SimulationChasse.attaqueArmee(p.unites, p.armes),
      { nombre, terrain } = SimulationChasse.calculerChasses(
        p.ratio,
        attArmee,
        p.nombreMax,
        tdcArrivee,
        Math.round(tdcLancement / 4),
        p.nombreFixe || 0,
        p.terrainFixe || 0,
      ),
      difficulte = SimulationChasse.difficulteTotale(tdcArrivee, terrain, nombre),
      ratio = attArmee / difficulte,
      indexRef = SimulationChasse.indexRatioRef(ratio),
      chasses = SimulationChasse.repartir(
        p.unites,
        tdcArrivee,
        terrain,
        nombre,
        indexRef,
        p.bouclier,
      ).map((c) => {
        let att = SimulationChasse.attaqueArmee(c.unites, p.armes);
        return { ...c, att, ratio: att / c.difficulte };
      });
    return {
      nombre,
      terrain,
      attArmee,
      difficulte,
      ratio,
      indexRef,
      pertes: SimulationChasse.pertes(indexRef, difficulte, p.bouclier),
      chasses,
    };
  }
  /**
   * Ce que donnerait chaque ratio de la liste en laissant le simulateur choisir
   * le nombre et le terrain, pour les libellés de la liste.
   */
  static apercusRatios(p) {
    let tdcArrivee = Math.max(1, p.tdcArrivee),
      attArmee = SimulationChasse.attaqueArmee(p.unites, p.armes),
      terrainMin = Math.round(Math.max(1, p.tdcLancement) / 4);
    return RATIO_CHASSE.map((r, i) => {
      if (!attArmee) return null;
      let { nombre, terrain } = SimulationChasse.calculerChasses(
        r,
        attArmee,
        p.nombreMax,
        tdcArrivee,
        terrainMin,
      );
      return {
        nombre,
        terrain,
        pertes: SimulationChasse.pertes(
          i,
          SimulationChasse.difficulteTotale(tdcArrivee, terrain, nombre),
          p.bouclier,
        ),
      };
    });
  }
  /**
   * Pertes si le TdC vaut `nouveauTdc` au lieu du `tdcArrivee` prévu quand les
   * chasses arrivent. Les armées restent celles de la répartition : chaque
   * chasse a son propre nouveau ratio (son attaque était calibrée sur le ratio
   * de référence au TdC prévu).
   */
  static pertesAutreTdc(attArmee, tdcArrivee, nouveauTdc, terrain, nombre, indexRef, bouclier) {
    let somme = { MIN: 0, AVG: 0, MAX: 0 },
      prevu = Math.max(1, tdcArrivee),
      nouveau = Math.max(1, nouveauTdc);
    for (let c = 0; c < nombre; c++) {
      let nouvelleDiff = SimulationChasse.difficulte(nouveau + terrain * c, terrain),
        ancienneDiff = SimulationChasse.difficulte(prevu + terrain * c, terrain),
        pertes = SimulationChasse.pertes(
          SimulationChasse.indexRatioRef((ancienneDiff * RATIO_CHASSE[indexRef]) / nouvelleDiff),
          nouvelleDiff,
          bouclier,
        );
      somme.MIN += pertes.MIN;
      somme.AVG += pertes.AVG;
      somme.MAX += pertes.MAX;
    }
    let ratio = attArmee / SimulationChasse.difficulteTotale(nouveau, terrain, nombre);
    return { ...somme, ratio, indexRef: SimulationChasse.indexRatioRef(ratio) };
  }
}
