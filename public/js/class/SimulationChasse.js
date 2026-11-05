// @ts-check
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
   * JSN envoyées en tampon avec chaque chasse quand des unités XP partent :
   * au plus pertes max × ce facteur (au-delà, les JSN sont des attaquantes).
   * Dès × 1, les pertes max sont couvertes ; 2 est large.
   */
  static get FACTEUR_SECURITE() {
    return 2.0;
  }
  /**
   * Ratio en dessous duquel le lanceur ne descend pas de lui-même quand le
   * ratio est libre : plus aucune chance de réplique à 50 %. La réplique à
   * 50 % demande vie des prédateurs / B > 1,5 × ratio, et le tirage le plus
   * résistant possible (dionées seules, une escorte) donne vie / B = 10,76,
   * atteint sur 5 405 tirages du jeu : plus jamais de 50 % dès 7,17.
   */
  static get RATIO_PLANCHER() {
    return 7.2;
  }
  /**
   * Temps de ponte d'une JSN en secondes au niveau de ponte donné
   * (Couveuse + Solarium + Technique de ponte).
   */
  static tempsPonte(niveauPonte) {
    return TEMPS_UNITE[1] * Math.pow(0.9, niveauPonte);
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
   * `facteur` remplace la marge de JSN par défaut (lanceur par budget de pertes).
   */
  static repartir(
    unites,
    tdcArrivee,
    terrain,
    nombre,
    indexRef,
    bouclier,
    facteur = SimulationChasse.FACTEUR_SECURITE,
  ) {
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
      if (xp) envoi[0] = Math.round(pertes.MAX * facteur);
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
   * Chiffres d'une salve de `nombre` chasses de `terrain` cm² : difficulté,
   * ratio, pertes, durée, part du temps de ponte et rendement, sans la
   * répartition (sert à comparer des salves).
   *
   * @param {Object} p unites, armes, bouclier, tdcLancement, tdcArrivee,
   *   et en option vitesse (niveau de vitesse de chasse) et tempsPonte (s / JSN)
   */
  static evaluer(p, nombre, terrain) {
    let tdcArrivee = Math.max(1, p.tdcArrivee),
      attArmee = SimulationChasse.attaqueArmee(p.unites, p.armes),
      difficulte = SimulationChasse.difficulteTotale(tdcArrivee, terrain, nombre),
      ratio = attArmee / difficulte,
      indexRef = SimulationChasse.indexRatioRef(ratio),
      pertes = SimulationChasse.pertes(indexRef, difficulte, p.bouclier),
      duree = Math.max(
        1,
        SimulationChasse.duree(Math.max(1, p.tdcLancement), terrain, p.vitesse || 0),
      );
    return {
      nombre,
      terrain,
      attArmee,
      difficulte,
      ratio,
      indexRef,
      pertes,
      duree,
      // part du temps de ponte consacrée à remplacer les pertes moyennes
      budget: p.tempsPonte ? (pertes.AVG * p.tempsPonte) / duree : 0,
      // cm² chassés par seconde
      rendement: (nombre * terrain) / duree,
    };
  }
  /**
   * Salve complète : chiffres et répartition de l'armée. La marge de JSN max
   * est réduite uniformément quand le stock ne la permet pas pour toutes les
   * chasses (sinon les dernières servies partent sans JSN), puis le
   * rééquilibrage JSN → SN → NE est appliqué si demandé.
   *
   * @param {Object} p ceux d'`evaluer`, plus facteur (marge de JSN max, défaut
   *   FACTEUR_SECURITE) et reequilibrer
   */
  static plan(p, nombre, terrain) {
    let salve = SimulationChasse.evaluer(p, nombre, terrain),
      marge = p.facteur == null ? SimulationChasse.FACTEUR_SECURITE : p.facteur,
      facteur = salve.pertes.MAX > 0 ? Math.min(marge, p.unites[0] / salve.pertes.MAX) : marge,
      chasses = SimulationChasse.repartir(
        p.unites,
        Math.max(1, p.tdcArrivee),
        terrain,
        nombre,
        salve.indexRef,
        p.bouclier,
        facteur,
      ),
      residuel = p.reequilibrer ? SimulationChasse.reequilibrer(chasses, marge) : null;
    chasses = chasses.map((c) => {
      let att = SimulationChasse.attaqueArmee(c.unites, p.armes);
      return { ...c, att, ratio: att / c.difficulte };
    });
    return { ...salve, facteur, chasses, residuel };
  }
  /**
   * Plus grand terrain (≥ 1) qui vérifie `ok`, `ok` passant de vrai à faux
   * quand le terrain grandit ; 0 si même 1 cm² ne convient pas.
   */
  static plusGrandTerrain(ok, max = 5000000000000) {
    if (!ok(1)) return 0;
    if (ok(max)) return max;
    let bas = 1,
      haut = 2;
    while (ok(haut)) {
      bas = haut;
      haut = Math.min(max, haut * 2);
    }
    while (haut - bas > 1) {
      let milieu = Math.floor((bas + haut) / 2);
      if (ok(milieu)) bas = milieu;
      else haut = milieu;
    }
    return bas;
  }
  /**
   * Plus petit terrain (≥ 1) qui vérifie `ok`, `ok` passant de faux à vrai
   * quand le terrain grandit ; 0 si aucun terrain jusqu'à `max` ne convient.
   */
  static plusPetitTerrain(ok, max = 5000000000000) {
    if (ok(1)) return 1;
    if (!ok(max)) return 0;
    let bas = 1,
      haut = 2;
    while (!ok(haut)) {
      bas = haut;
      haut = Math.min(max, haut * 2);
    }
    while (haut - bas > 1) {
      let milieu = Math.floor((bas + haut) / 2);
      if (ok(milieu)) haut = milieu;
      else bas = milieu;
    }
    return haut;
  }
  /**
   * Salve à lancer d'après ce que le joueur fixe. Deux degrés de liberté, le
   * nombre de chasses et le terrain par chasse ; le reste en découle :
   *
   * - `nombre` et `terrain` fixés : la salve est entièrement déterminée ;
   * - sinon le coût accepté borne le terrain : ratio au moins `ratio`, ou
   *   pertes au plus `budget` (part du temps de ponte, le ratio restant au
   *   moins `ratioMin`), et le nombre libre est choisi pour le meilleur
   *   rendement (cm² par seconde) ;
   * - `rendement` fixé : la salve la moins coûteuse (part de ponte minimale)
   *   qui l'atteint, sans dépasser les bornes ci-dessus.
   *
   * Pour un nombre donné, tout varie dans un seul sens avec le terrain (le
   * ratio baisse ; pertes, part de ponte, durée et rendement montent) : chaque
   * borne est un terrain trouvé par dichotomie, et le meilleur terrain est à
   * une borne.
   *
   * @param {Object} p ceux de `plan`, plus nombreMax (places libres), et les
   *   valeurs fixées (0 ou absent = libre) : nombre, terrain, ratio, budget,
   *   rendement ; ratioMin (défaut RATIO_PLANCHER)
   * @return {Object|null} null sans armée ni place ; { erreur } si rien ne
   *   borne le coût ou si même 1 cm² (ou une chasse du terrain fixé) dépasse
   *   une borne ; sinon le plan avec en plus `limite` (ce qui a fixé le
   *   terrain : "fixe", "terrain", "ratio", "budget", "plancher" ou "rendement"),
   *   `plafonne` (budget inatteignable au-dessus du plancher) et
   *   `infaisable` (rendement demandé hors d'atteinte dans les bornes)
   */
  static resoudre(p) {
    let nombreMax = Math.floor(p.nombreMax || 0),
      attArmee = SimulationChasse.attaqueArmee(p.unites, p.armes);
    if (!(attArmee > 0) || nombreMax < 1) return null;
    let nombreFixe = Math.min(nombreMax, Math.floor(p.nombre || 0)),
      terrainFixe = Math.floor(p.terrain || 0),
      ratioMin = p.ratioMin == null ? SimulationChasse.RATIO_PLANCHER : p.ratioMin;
    if (!(nombreFixe && terrainFixe) && !p.ratio && !p.budget && !p.rendement)
      return { erreur: "cout" };
    let candidats = [],
      impossible = null,
      de = nombreFixe || 1,
      a = nombreFixe || nombreMax;
    for (let nombre = de; nombre <= a; nombre++) {
      let salveDe = (terrain) => SimulationChasse.evaluer(p, nombre, terrain),
        terrain,
        limite = "fixe",
        plafonne = false,
        infaisable = false;
      if (terrainFixe) {
        terrain = terrainFixe;
        if (!nombreFixe) {
          // le nombre est libre : seuls les nombres qui tiennent les bornes comptent
          let salve = salveDe(terrain),
            ratioMinimal = p.ratio || ratioMin;
          limite = "terrain";
          if (salve.ratio < ratioMinimal + 0.0001) {
            impossible = impossible || (p.ratio ? "ratio" : "plancher");
            continue;
          }
          if (p.budget && salve.budget > p.budget) {
            impossible = impossible || "budget";
            continue;
          }
          if (p.rendement && salve.rendement < p.rendement) infaisable = true;
        }
      } else {
        // bornes hautes : le coût accepté
        let bornes = [];
        if (p.ratio)
          bornes.push({
            limite: "ratio",
            terrain: SimulationChasse.plusGrandTerrain((t) => salveDe(t).ratio >= p.ratio + 0.0001),
          });
        else
          bornes.push({
            limite: "plancher",
            terrain: SimulationChasse.plusGrandTerrain(
              (t) => salveDe(t).ratio >= ratioMin + 0.0001,
            ),
          });
        if (p.budget) {
          let plancher = bornes[0].terrain,
            t = SimulationChasse.plusGrandTerrain((t) => salveDe(t).budget <= p.budget, plancher);
          if (t >= plancher) plafonne = !p.ratio;
          else bornes.push({ limite: "budget", terrain: t });
        }
        let haute = bornes.reduce((b, c) => (c.terrain < b.terrain ? c : b));
        terrain = haute.terrain;
        limite = haute.limite;
        if (p.rendement) {
          // borne basse : le rendement demandé, atteint au plus juste
          let t = SimulationChasse.plusPetitTerrain(
            (t) => salveDe(t).rendement >= p.rendement,
            haute.terrain,
          );
          if (t >= 1 && t <= haute.terrain) {
            terrain = t;
            limite = "rendement";
          } else infaisable = true;
        }
      }
      if (terrain < 1) {
        // même 1 cm² dépasse cette borne
        impossible = impossible || limite;
        continue;
      }
      candidats.push({ ...salveDe(terrain), limite, plafonne, infaisable });
    }
    if (!candidats.length) return { erreur: impossible || "cout" };
    let faisables = candidats.filter((c) => !c.infaisable),
      meilleur = (liste, mieux) => liste.reduce((m, c) => (mieux(c, m) ? c : m)),
      choix = p.rendement
        ? faisables.length
          ? meilleur(faisables, (c, m) => c.budget < m.budget)
          : meilleur(candidats, (c, m) => c.rendement > m.rendement)
        : meilleur(candidats, (c, m) => c.rendement > m.rendement);
    return {
      ...SimulationChasse.plan(p, choix.nombre, choix.terrain),
      limite: choix.limite,
      plafonne: choix.plafonne,
      infaisable: choix.infaisable,
    };
  }
  /**
   * Tampon de pertes de chaque chasse : objectif `marge` × pertes max, en
   * équivalent JSN. Les JSN sont redistribuées entre les chasses au prorata de
   * ce besoin, puis le déficit restant est comblé avec les SN et les NE (ordre
   * de mort), convertis par leurs points de vie ; les totaux par unité ne
   * changent pas. Modifie `chasses` et renvoie le déficit restant par chasse
   * (en JSN). Portage du greffon « budget de pertes » de Calystène (CHS2B).
   */
  static reequilibrer(chasses, marge) {
    let n = chasses.length,
      besoin = chasses.map((c) => marge * c.pertes.MAX);
    for (let k of [0, 1, 2]) {
      let stock = chasses.reduce((s, c) => s + c.unites[k], 0);
      if (stock <= 0) continue;
      let pv = VIE_UNITE[k + 1] / VIE_UNITE[1],
        voulu = besoin.map((b) => Math.max(0, b) / pv),
        somme = voulu.reduce((s, v) => s + v, 0);
      if (somme <= 0) continue;
      // de quoi couvrir tout le monde : le surplus est rendu au prorata de la
      // répartition d'origine ; sinon chacun reçoit sa part du stock
      let alloc =
          somme <= stock
            ? voulu.map((v, i) => v + ((stock - somme) * chasses[i].unites[k]) / stock)
            : voulu.map((v) => (stock * v) / somme),
        donne = 0;
      for (let i = 0; i < n - 1; i++) {
        alloc[i] = Math.round(alloc[i]);
        donne += alloc[i];
      }
      alloc[n - 1] = stock - donne;
      chasses.forEach((c, i) => {
        c.unites[k] = alloc[i];
        besoin[i] -= alloc[i] * pv;
      });
    }
    return besoin.map((b) => Math.max(0, Math.round(b)));
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
