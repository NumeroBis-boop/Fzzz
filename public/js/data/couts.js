/*
 * couts.js
 *
 * Coûts / temps / effets des constructions et recherches Fourmizzz.
 *
 * Approche formulaire : seules les valeurs de **niveau 1** sont stockées,
 * les autres niveaux sont déduits via des ratios géométriques constants —
 * vérifié sur s1/s2/s3/test (game balance identique sur tous les serveurs).
 *
 * Bonus utilisateur :
 * - Architecture (labo3) niveau N → temps construction × 0.9^N
 * - Salle d'analyse (cons8) niveau N → temps recherche × 0.9^N
 * - Aucun bonus n'affecte le coût (vérifié contre toolzzz.fr/couts.php).
 *
 * Source : extraction depuis https://www.toolzzz.fr/couts.php — 2026-05-07.
 **********************************************************************/

const COUTS_RATIO_T_CONSTRU = 1.6;
const COUTS_RATIO_T_RECHERCHE = 1.7;
const COUTS_RATIO_COUT = 2.0;
const COUTS_RATIO_PROD_CHAMPI = 1.7;
const COUTS_RATIO_BONUS = 0.9;

/**
 * Constructions. `id` = clé Fourmizzz (consN).
 * - `t` : temps niveau 1 (s)
 * - `m` : coût matériaux niveau 1
 * - `max` : niveau max accessible
 * - `prod` : production niveau 1 (Champignonnière uniquement)
 * - `mR` : ratio coût matériaux personnalisé (Champi a 1.85 au lieu de 2.0)
 */
const COUTS_CONSTRUCTIONS = {
  cons5: { nom: "Champignonnière", t: 120, m: 90, max: 50, prod: 122, mR: 1.85 },
  cons3: { nom: "Entrepôt de Nourriture", t: 180, m: 600, max: 50 },
  cons4: { nom: "Entrepôt de Matériaux", t: 180, m: 600, max: 50 },
  cons2: { nom: "Couveuse", t: 180, m: 600, max: 50 },
  cons7: { nom: "Solarium", t: 1000, m: 2000, max: 50 },
  cons6: { nom: "Laboratoire", t: 300, m: 1400, max: 50 },
  cons8: { nom: "Salle d'analyse", t: 300, m: 1400, max: 50 },
  cons9: { nom: "Salle de combat", t: 120, m: 300, max: 50 },
  cons10: { nom: "Caserne", t: 200, m: 800, max: 50 },
  cons11: { nom: "Dôme", t: 400, m: 3500, max: 50 },
  cons12: { nom: "Loge Impériale", t: 500, m: 5000, max: 50 },
  cons0: { nom: "Étable à pucerons", t: 500, m: 1500, max: 50 },
  cons1: { nom: "Étable à cochenilles", t: 150, m: 10000, max: 36 },
};

/**
 * Recherches. `id` = clé Fourmizzz (laboN).
 * - `t` : temps niveau 1 (s)
 * - `o` : coût ouvrières niveau 1 (absent pour les recherches sans coût en
 *        fourmis — TDP, Architecture, Vitesse d'attaque)
 * - `p` : coût pommes niveau 1
 * - `m` : coût matériaux niveau 1
 * - `max` : niveau max
 */
const COUTS_RECHERCHES = {
  labo0: { nom: "Technique de ponte", t: 120, p: 120, m: 120, max: 50 },
  labo1: { nom: "Bouclier Thoracique", t: 120, o: 80, p: 200, m: 300, max: 50 },
  labo2: { nom: "Armes", t: 120, o: 80, p: 300, m: 200, max: 50 },
  labo3: { nom: "Architecture", t: 200, p: 100, m: 200, max: 50 },
  labo4: { nom: "Communication avec les animaux", t: 120, o: 80, p: 200, m: 500, max: 50 },
  labo5: { nom: "Vitesse de chasse", t: 200, o: 50, p: 4000, m: 2500, max: 50 },
  labo6: { nom: "Vitesse d'attaque", t: 200, p: 3000, m: 1000, max: 50 },
  labo7: { nom: "Génétique", t: 180, o: 1000, p: 3000, m: 10000, max: 50 },
  labo8: { nom: "Acide", t: 2800, o: 5000, p: 100000, m: 300000, max: 30 },
  labo9: { nom: "Poison", t: 3200, o: 250000, p: 40000000, m: 15000000, max: 20 },
};

/**
 * Calcule le temps de construction (s) pour un niveau, en appliquant
 * éventuellement le bonus Architecture.
 */
function coutsTempsConstru(item, niveau, archi = 0) {
  let base = item.t * Math.pow(COUTS_RATIO_T_CONSTRU, niveau - 1);
  return Math.round(base * Math.pow(COUTS_RATIO_BONUS, archi));
}

/** Temps de recherche (s), bonus Salle d'analyse appliqué si fourni. */
function coutsTempsRecherche(item, niveau, sa = 0) {
  let base = item.t * Math.pow(COUTS_RATIO_T_RECHERCHE, niveau - 1);
  return Math.round(base * Math.pow(COUTS_RATIO_BONUS, sa));
}

/** Coût matériaux (par niveau). Ratio par défaut 2.0, surchargé pour Champi. */
function coutsMat(item, niveau) {
  let ratio = item.mR || COUTS_RATIO_COUT;
  return Math.round(item.m * Math.pow(ratio, niveau - 1));
}

/** Coût pommes (recherches uniquement). */
function coutsPom(item, niveau) {
  return Math.round(item.p * Math.pow(COUTS_RATIO_COUT, niveau - 1));
}

/** Coût ouvrières (recherches qui en demandent). Renvoie 0 si pas de coût en fourmis. */
function coutsOuv(item, niveau) {
  if (!item.o) return 0;
  return Math.round(item.o * Math.pow(COUTS_RATIO_COUT, niveau - 1));
}

/** Capacité d'un entrepôt au niveau N (Nourriture et Matériaux, formule identique). */
function coutsCapaEntrepot(niveau) {
  return 500 + 1200 * Math.pow(2, niveau);
}

/** Production de la Champignonnière au niveau N (nourriture/jour). */
function coutsProdChampi(item, niveau) {
  return Math.round(item.prod * Math.pow(COUTS_RATIO_PROD_CHAMPI, niveau - 1));
}
