/*
 * Script du Google Sheet de l'alliance (Apps Script) : reçoit les rapports
 * exportés par l'extension (boutons « Exporter mes chasses » et « Exporter mes
 * RC » de la messagerie) et les ajoute à leur onglet, sans doublon : une ligne
 * dont la « Clé » est déjà dans l'onglet n'est pas ajoutée. Un combat entre
 * membres de l'alliance n'est que dans « Flood internes » (même clé vu des deux
 * camps : une seule ligne).
 *
 * Installation, par le propriétaire du fichier :
 *  1. Extensions → Apps Script ; remplacer le contenu de Code.gs par ce fichier.
 *  2. Déployer → Nouveau déploiement → type « Application Web » ;
 *     « Exécuter en tant que : moi », « Qui a accès : Tout le monde ».
 *  3. Autoriser, puis copier l'adresse de l'application (…/exec) et la poster
 *     dans le forum de l'alliance, section « BDD partagée cachée », sujet
 *     « Export Google Sheet », suivie de « Joueurs autorisés à partager des
 *     RC : » et de leurs pseudos : l'extension de ces joueurs lit l'adresse
 *     toute seule. Pas de réponse dans ce sujet : elle empêcherait de modifier
 *     le message (ajouter ou retirer un joueur).
 * Après une modification de ce code : Enregistrer, puis Déployer → Gérer les
 * déploiements → modifier → Version : Nouvelle version (l'adresse ne change
 * pas). L'adresse ouverte dans le navigateur montre alors la nouvelle
 * « version ».
 *
 * Onglet « Statistiques » : créé s'il manque quand on ouvre l'adresse du script
 * dans le navigateur (jamais pendant un export). Joueur et période se
 * choisissent dans ses cases B3 à B5 ; la fonction STATS_OUAF y calcule les
 * mêmes résultats que l'onglet « Synthèse » des « Outils pour Chasseur » de
 * l'extension (requête statistiques). Supprimé, il est recréé de la même façon
 * (à faire aussi pour avoir la disposition d'une nouvelle version du script).
 *
 * Le fichier doit rester réservé à l'alliance : publier des RC est interdit
 * par le règlement du s5.
 */

// onglets que l'extension peut remplir
var ONGLETS_EXPORT = ["BDD chasse", "BDD attaques", "BDD défenses", "Flood internes"];
var ONGLET_INTERNE = "Flood internes";
var ONGLETS_CAMPS = ["BDD attaques", "BDD défenses"];
// hauteur d'une ligne de texte : un RC (plusieurs lignes) n'y montre que la première
var HAUTEUR_LIGNE = 21;

// rendue par doGet : ouvrir l'adresse du script dans le navigateur montre le code déployé
var VERSION_SCRIPT = "2026-11-09.4";

function doGet() {
  var classeur = SpreadsheetApp.getActiveSpreadsheet();
  avecVerrou(function () {
    preparerStatistiques(classeur);
  });
  return reponseJson({ ok: true, fichier: classeur.getName(), version: VERSION_SCRIPT });
}

function doPost(e) {
  var d;
  try {
    d = JSON.parse(e.postData.contents);
  } catch (err) {
    return reponseJson({ erreur: "requête illisible" });
  }
  if (!d || !requeteValide(d)) return reponseJson({ erreur: "requête invalide" });
  var classeur = SpreadsheetApp.getActiveSpreadsheet();
  // lecture seule : n'attend pas la fin d'un export
  if (d.statistiques) return reponseJson(statistiquesDemandees(classeur, d));
  // deux joueurs qui exportent en même temps : l'un après l'autre
  return reponseJson(
    avecVerrou(function () {
      return d.verifier ? clesAbsentes(classeur, d.onglets, d.cles) : ajouter(classeur, d);
    }),
  );
}

function requeteValide(d) {
  if (d.statistiques) return statistiquesValides(d);
  return d.verifier ? verificationValide(d) : ajoutValide(d);
}

function avecVerrou(action) {
  var verrou = LockService.getScriptLock();
  verrou.waitLock(30000);
  try {
    return action();
  } finally {
    verrou.releaseLock();
  }
}

function ajoutValide(d) {
  return (
    ONGLETS_EXPORT.indexOf(d.onglet) != -1 &&
    Array.isArray(d.entetes) &&
    d.entetes[0] == "Clé" &&
    Array.isArray(d.lignes)
  );
}

function verificationValide(d) {
  return (
    Array.isArray(d.onglets) &&
    d.onglets.every(function (o) {
      return ONGLETS_EXPORT.indexOf(o) != -1;
    }) &&
    Array.isArray(d.cles)
  );
}

function ajouter(classeur, d) {
  var cles = {},
    exclues = {};
  d.lignes.forEach(function (l) {
    var cle = String((l && l[0]) || "");
    if (cle) cles[cle] = true;
  });
  // combat entre membres : retiré des onglets des camps (exporté avant d'être
  // reconnu comme interne), et jamais rajouté à l'un d'eux ensuite
  if (d.onglet == ONGLET_INTERNE) retirerCles(classeur, ONGLETS_CAMPS, cles);
  else if (ONGLETS_CAMPS.indexOf(d.onglet) != -1) exclues = clesDe(classeur, ONGLET_INTERNE);
  return ajouterLignes(classeur, d.onglet, d.entetes, d.lignes, exclues);
}

/**
 * Clés de `cles` absentes de tous les onglets `noms` : l'extension relit les
 * conversations de ces RC (ligne effacée, onglet vidé). Les onglets sont remis
 * en lignes compactes au passage, à chaque clic d'export.
 */
function clesAbsentes(classeur, noms, cles) {
  var presentes = {};
  noms.forEach(function (nom) {
    var feuille = classeur.getSheetByName(nom);
    if (!feuille) return;
    lireCles(feuille).forEach(function (c) {
      presentes[c] = true;
    });
    compacter(feuille);
  });
  return {
    absentes: cles.filter(function (c) {
      return !presentes[String(c)];
    }),
  };
}

/**
 * Ajoute à l'onglet `nom` (créé au besoin, avec ses titres) les lignes dont la
 * clé (première valeur) n'y est pas encore, ni dans `exclues`. Une colonne
 * inconnue de l'onglet est ajoutée à la fin ; les colonnes ajoutées à la main
 * sont laissées vides.
 */
function ajouterLignes(classeur, nom, entetes, lignes, exclues) {
  var feuille = classeur.getSheetByName(nom);
  if (!feuille) {
    feuille = classeur.insertSheet(nom);
    feuille.getRange(1, 1, 1, entetes.length).setValues([entetes]).setFontWeight("bold");
    feuille.setFrozenRows(1);
  }
  var largeur = Math.max(feuille.getLastColumn(), 1),
    titres = feuille
      .getRange(1, 1, 1, largeur)
      .getValues()[0]
      .map(function (t) {
        return String(t);
      });
  entetes.forEach(function (t) {
    if (titres.indexOf(t) != -1) return;
    var vide = titres.indexOf("");
    if (vide == -1) titres.push(t);
    else titres[vide] = t;
    agrandir(feuille, 1, titres.length);
    feuille
      .getRange(1, titres.indexOf(t) + 1)
      .setValue(t)
      .setFontWeight("bold");
  });
  var derniere = feuille.getLastRow(),
    cles = {};
  for (var k in exclues || {}) cles[k] = true;
  lireCles(feuille).forEach(function (c) {
    cles[c] = true;
  });
  var nouvelles = [];
  lignes.forEach(function (l) {
    var cle = String((l && l[0]) || "");
    if (!cle || cles[cle]) return;
    cles[cle] = true;
    var ligne = titres.map(function () {
      return "";
    });
    entetes.forEach(function (t, i) {
      ligne[titres.indexOf(t)] = valeurCellule(l[i]);
    });
    nouvelles.push(ligne);
  });
  if (nouvelles.length) {
    agrandir(feuille, derniere + nouvelles.length, titres.length);
    feuille.getRange(derniere + 1, 1, nouvelles.length, titres.length).setValues(nouvelles);
  }
  compacter(feuille);
  return { ajoutees: nouvelles.length, deja: lignes.length - nouvelles.length };
}

// la grille de l'onglet (1 000 lignes et 26 colonnes à sa création) doit
// contenir la plage écrite : le tableur refuse d'écrire au-delà
function agrandir(feuille, lignes, colonnes) {
  var l = lignes - feuille.getMaxRows(),
    c = colonnes - feuille.getMaxColumns();
  if (l > 0) feuille.insertRowsAfter(feuille.getMaxRows(), l);
  if (c > 0) feuille.insertColumnsAfter(feuille.getMaxColumns(), c);
}

// clés de l'onglet (colonne « Clé »), de la ligne 2 à la dernière
function lireCles(feuille) {
  var derniere = feuille.getLastRow(),
    largeur = Math.max(feuille.getLastColumn(), 1),
    colonne = feuille.getRange(1, 1, 1, largeur).getValues()[0].map(String).indexOf("Clé");
  if (colonne == -1 || derniere < 2) return [];
  return feuille
    .getRange(2, colonne + 1, derniere - 1, 1)
    .getValues()
    .map(function (r) {
      return String(r[0]);
    });
}

function clesDe(classeur, nom) {
  var feuille = classeur.getSheetByName(nom),
    cles = {};
  if (feuille)
    lireCles(feuille).forEach(function (c) {
      cles[c] = true;
    });
  return cles;
}

// supprime des onglets `noms` les lignes dont la clé est dans `cles`
function retirerCles(classeur, noms, cles) {
  noms.forEach(function (nom) {
    var feuille = classeur.getSheetByName(nom);
    if (!feuille) return;
    var valeurs = lireCles(feuille);
    if (
      !valeurs.some(function (v) {
        return v && cles[v];
      })
    )
      return;
    // une ligne vide sous les données : le tableur refuse de supprimer toutes
    // les lignes non figées
    if (feuille.getMaxRows() <= valeurs.length + 1)
      feuille.insertRowsAfter(feuille.getMaxRows(), 1);
    // de bas en haut, par blocs contigus : une suppression ne décale pas les lignes restant à voir
    for (var i = valeurs.length - 1; i >= 0; i--) {
      if (!valeurs[i] || !cles[valeurs[i]]) continue;
      var fin = i;
      while (i > 0 && valeurs[i - 1] && cles[valeurs[i - 1]]) i--;
      feuille.deleteRows(i + 2, fin - i + 1);
    }
  });
}

// lignes d'une ligne de haut, texte en haut de cellule ; une mise en forme
// impossible n'empêche pas l'ajout des lignes (raison dans Apps Script → Exécutions)
function compacter(feuille) {
  try {
    var n = feuille.getLastRow() - 1;
    if (n < 1) return;
    feuille.getRange(2, 1, n, feuille.getLastColumn()).setVerticalAlignment("top");
    feuille.setRowHeightsForced(2, n, HAUTEUR_LIGNE);
  } catch (err) {
    console.warn("Mise en forme impossible : " + err);
  }
}

// un texte qui commence par = + - @ reste du texte (pas une formule)
function valeurCellule(v) {
  if (v === null || v === undefined) return "";
  if (typeof v == "string" && /^[=+\-@]/.test(v)) return "'" + v;
  return v;
}

function reponseJson(o) {
  var sortie = ContentService.createTextOutput(JSON.stringify(o));
  return sortie.setMimeType(ContentService.MimeType.JSON);
}

/* ---------------------------------------------------------------------
 * Statistiques de chasse d'un joueur sur une période. Un seul calcul
 * (statistiques) pour l'onglet « Statistiques » du fichier (fonction
 * STATS_OUAF) et pour l'onglet « Synthèse » de l'extension (requête
 * statistiques).
 * ------------------------------------------------------------------- */

var ONGLET_STATISTIQUES = "Statistiques";
// format de la réponse : l'extension dit « script pas à jour » devant un autre
var FORMAT_STATISTIQUES = 5;
// colonnes lues dans « BDD chasse » (titres écrits par l'extension)
var COLONNES_CHASSE = [
  "Exporté par",
  "Date",
  "Terrain conquis (cm²)",
  "Nourriture",
  "Fourmis perdues",
  "Troupes en attaque",
  // faune rencontrée : difficulté de la chasse
  "Troupes en défense",
  // expérience gagnée (« Les unités survivantes ont appris de cette bataille »)
  "RC",
];
// chasses rentrées à moins de 5 minutes l'une de l'autre : une même multi-chasse
// (les expéditions d'un même lancement rentrent à une ou deux minutes d'écart)
var MULTICHASSE_MINUTES = 5;
// unités dans l'ordre de l'extension (Armee.unite), noms des RC au singulier
// sans accent, vie, attaque et défense hors bonus (VIE_UNITE, ATT_UNITE et
// DEF_UNITE de content.js, comparés par tests/statistiques-script.test.ts)
var UNITES = [
  { nom: "Jeune Soldate Naine", cle: "jeune soldate naine", vie: 8, att: 3, def: 2 },
  { nom: "Soldate Naine", cle: "soldate naine", vie: 10, att: 5, def: 4 },
  { nom: "Naine d'Elite", cle: "naine d'elite", vie: 13, att: 7, def: 6 },
  { nom: "Jeune Soldate", cle: "jeune soldate", vie: 16, att: 10, def: 9 },
  { nom: "Soldate", cle: "soldate", vie: 20, att: 15, def: 14 },
  { nom: "Concierge", cle: "concierge", vie: 30, att: 1, def: 25 },
  { nom: "Concierge d'élite", cle: "concierge d'elite", vie: 40, att: 1, def: 35 },
  { nom: "Artilleuse", cle: "artilleuse", vie: 10, att: 30, def: 15 },
  { nom: "Artilleuse d'élite", cle: "artilleuse d'elite", vie: 12, att: 35, def: 18 },
  { nom: "Soldate d'élite", cle: "soldate d'elite", vie: 27, att: 24, def: 23 },
  { nom: "Tank", cle: "tank", vie: 35, att: 55, def: 1 },
  { nom: "Tank d'élite", cle: "tank d'elite", vie: 50, att: 80, def: 1 },
  { nom: "Tueuse", cle: "tueuse", vie: 50, att: 50, def: 50 },
  { nom: "Tueuse d'élite", cle: "tueuse d'elite", vie: 55, att: 55, def: 55 },
];
// faune des chasses et ses points de difficulté (FAUNE de content.js, comparée
// par tests/statistiques-script.test.ts) : la difficulté d'une chasse est la
// somme de ceux de la faune rencontrée ; sa nourriture en vaut 0,763 fois, à
// 0,5 % près sur 52 RC réels
var FAUNE = [
  { nom: "Petite araignée", diff: 23.2 },
  { nom: "Araignée", diff: 34.3 },
  { nom: "Chenille", diff: 49.8 },
  { nom: "Criquet", diff: 58.9 },
  { nom: "Guèpe", diff: 76.05 },
  { nom: "Cigale", diff: 107.55 },
  { nom: "Abeille", diff: 144.6 },
  { nom: "Dionée", diff: 201.25 },
  { nom: "Hanneton", diff: 228.2 },
  { nom: "Scarabée", diff: 436 },
  { nom: "Mante religieuse", diff: 890.7 },
  { nom: "Lézard", diff: 1700.75 },
  { nom: "Souris", diff: 2405.25 },
  { nom: "Mulot", diff: 4453.6 },
  { nom: "Alouette", diff: 15745.9 },
  { nom: "Rat", diff: 64282.5 },
  { nom: "Tamanoir", diff: 2032789 },
];
// au-delà, une requête lirait trop longtemps (limite d'exécution d'Apps Script)
var STATS_JOURS_MAX = 3 * 366;
// lignes sans RC utile lues quand même entre deux qui en ont besoin : une
// lecture de moins vaut mieux que quelques textes de trop
var ECART_LECTURE_RC = 20;
// couleurs des graphiques, celles de la synthèse de l'extension : le joueur en
// vert, la moyenne des chasseurs en rouge, les autres chasseurs dans cet ordre,
// puis une nuance de chacun, plus claire ou plus foncée (demande du mainteneur)
var COULEUR_JOUEUR = "#008300";
var COULEUR_MOYENNE = "#e34948";
var COULEURS_AUTRES_CHASSEURS = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#6250d6",
  "#65a8ff",
  "#9f3600",
  "#066c49",
  "#9d6a06",
  "#b54d77",
  "#8c84fe",
];
var COULEUR_NOURRITURE = "#eb6834";
var COULEUR_PERTES = "#6250d6";
var COULEUR_ENCRE = "#52514e";
// chiffres de chaque chasseur de la période (tableau de la synthèse, écarts à leur moyenne)
var TITRES_COMPARAISON = [
  "Chasseur",
  "Chasses (RC)",
  "Multi-chasses",
  "Terrain chassé (cm²)",
  "Terrain par multi-chasse (cm²)",
  "Fourmis perdues",
  "Pertes par M cm² chassé",
  "Nourriture rapportée",
  "Nourriture par multi-chasse",
];
var MOYENNE_DES_CHASSEURS = "Moyenne des chasseurs";
// tableau des chasseurs de l'onglet « Statistiques », celui de la synthèse de
// l'extension : titre affiché, colonne de la comparaison
var COLONNES_TABLEAU_CHASSEURS = [
  ["Chasseur", "Chasseur"],
  ["Terrain chassé (cm²)", "Terrain chassé (cm²)"],
  ["Terrain / multi-chasse", "Terrain par multi-chasse (cm²)"],
  ["Pertes", "Fourmis perdues"],
  ["Pertes / M cm² chassé", "Pertes par M cm² chassé"],
  ["Nourriture rapportée", "Nourriture rapportée"],
  ["Nourriture / multi-chasse", "Nourriture par multi-chasse"],
];
// chiffres du résumé où être sous la moyenne des chasseurs est mieux ; couleurs
// de l'écart (mieux, moins bien), celles de la synthèse de l'extension
var RESUME_MOINS_EST_MIEUX = ["Fourmis perdues", "Pertes par M cm² chassé"];
var COULEUR_ECART_MIEUX = "#2e7d32";
var COULEUR_ECART_MOINS_BIEN = "#b03a2e";
// blocs de l'onglet « Statistiques », côte à côte à partir de la colonne D,
// séparés par une colonne vide
var COLONNE_STATISTIQUES = 4;
// lignes de l'onglet (celles d'un nouvel onglet : une plage plus longue est refusée)
var LIGNES_STATISTIQUES = 1000;
// une ligne par chasse : simple, ou multi-chasse aux résultats additionnés ; puis ses unités
// une extension d'avant le format 4 lit les colonnes par leur titre et les
// unités après « Nourriture » : les colonnes ajoutées vont avant elle
var TITRES_CHASSES = [
  "Chasse",
  "Retour",
  // numéro de série (jours depuis le 30/12/1899, heure du fichier) : une date du tableur
  "Date",
  "Expéditions",
  "Terrain (cm²)",
  "Tendance (cm²)",
  "Moyenne des chasseurs (cm²)",
  "Tendance de la moyenne (cm²)",
  "Pertes",
  "Pertes / M cm²",
  "Moyenne (pertes / M cm²)",
  "Difficulté / cm²",
  "Nourriture",
];
var BLOCS_STATISTIQUES = [
  { nom: "resume", titre: "Résumé", largeur: 3 },
  {
    nom: "comparaison",
    titre: "Chasseurs de la période",
    largeur: COLONNES_TABLEAU_CHASSEURS.length,
  },
  { nom: "armee", titre: "Armée (hors bonus)", largeur: 4 },
  { nom: "chasses", titre: "Chasses", largeur: TITRES_CHASSES.length + UNITES.length },
  { nom: "joueurs", titre: "Chasseurs", largeur: 1 },
  // une colonne par autre chasseur du fichier : dernier bloc, sa largeur varie
  { nom: "autres", titre: "Autres chasseurs : terrain étiré sur tes chasses (cm²)", largeur: 0 },
];

/**
 * Statistiques de chasse du joueur entre deux jours compris.
 *
 * tables : {chasse}, valeurs de l'onglet « BDD chasse » avec ses titres en
 * première ligne (vide s'il manque) ; debut, fin : "AAAA-MM-JJ" ; fuseau :
 * celui du fichier (jour d'une date) ; autres : avec les courbes des autres
 * chasseurs (synthèse de l'extension, sur demande).
 * Une « chasse » des graphiques est une multi-chasse : les chasses rentrées à
 * moins de MULTICHASSE_MINUTES de la précédente, résultats et troupes
 * additionnés (une chasse seule en est une d'une expédition).
 */
function statistiques(tables, joueur, debut, fin, fuseau, autres) {
  var moi = nomJoueur(joueur),
    parJoueur = chassesParJoueur(
      lignesDePeriode(tables.chasse, COLONNES_CHASSE, debut, fin, fuseau),
    ),
    miennes = parJoueur[moi] ? parJoueur[moi].chasses : [],
    groupes = multiChasses(miennes),
    terrain = somme(miennes, "terrain"),
    pertes = somme(miennes, "pertes"),
    nourriture = somme(miennes, "nourriture"),
    // moyenne des pertes par million de cm² des chasses (chacune compte autant)
    // pertes par M cm² de la période : celles du résumé (total ÷ total)
    moyenne = parMillion(pertes, terrain),
    terrains = groupes.map(function (g) {
      return g.terrain;
    }),
    tendanceTerrain = tendance(terrains),
    eux = autresChasseurs(parJoueur, moi, groupes.length),
    // moyenne de tous les chasseurs, chasse par chasse : les autres étirés sur les miennes
    moyenneChasseurs = moyenneDesCourbes(
      [terrains].concat(
        eux.map(function (a) {
          return a.etire;
        }),
      ),
    ),
    tendanceMoyenne = tendance(moyenneChasseurs);
  return {
    format: FORMAT_STATISTIQUES,
    joueur: String(joueur || "").trim(),
    debut: debut,
    fin: fin,
    resume: [
      ["Chasses (RC)", miennes.length],
      ["Multi-chasses", groupes.length],
      ["Terrain chassé (cm²)", terrain],
      ["Fourmis perdues", pertes],
      ["Pertes par M cm² chassé", parMillion(pertes, terrain)],
      ["Nourriture rapportée", nourriture],
      // une chasse seule est une multi-chasse d'une expédition
      [
        "Nourriture par multi-chasse",
        groupes.length ? Math.round(nourriture / groupes.length) : "",
      ],
    ],
    // la première multi-chasse est supposée emmener toute l'armée
    armee: blocArmee(groupes),
    chasses: {
      titres: TITRES_CHASSES.concat(
        UNITES.map(function (u) {
          return u.nom;
        }),
      ),
      lignes: groupes.map(function (g, i) {
        return [
          "Chasse " + (i + 1) + " (" + libelleMinute(g.minute).slice(0, 5) + ")",
          libelleMinute(g.minute),
          dateSerie(g.minute),
          g.nombre,
          g.terrain,
          tendanceTerrain[i],
          moyenneChasseurs[i],
          tendanceMoyenne[i],
          g.pertes,
          parMillion(g.pertes, g.terrain),
          moyenne,
          difficulteParCm2(g),
          g.nourriture,
        ].concat(g.unites);
      }),
    },
    // tous les chasseurs du fichier, toujours dans le même ordre : une couleur chacun
    chasseurs: chasseursDe(tables.chasse),
    comparaison: comparaisonChasseurs(parJoueur),
    autres: autres ? eux : [],
  };
}

function somme(liste, champ) {
  return liste.reduce(function (a, x) {
    return a + x[champ];
  }, 0);
}

// pertes par million de cm² chassés
function parMillion(pertes, terrain) {
  return terrain > 0 ? Math.round((pertes * 1e6) / terrain) : "";
}

// chasses de chaque chasseur (pseudo en minuscules), dans l'ordre de leur retour
function chassesParJoueur(lignes) {
  var parJoueur = {};
  lignes.forEach(function (l) {
    var nom = String(l["Exporté par"] || "").trim(),
      cle = nomJoueur(nom);
    if (!cle) return;
    parJoueur[cle] = parJoueur[cle] || { joueur: nom, chasses: [] };
    parJoueur[cle].chasses.push({
      minute: l.minute,
      instant: instantDe(l.minute),
      terrain: nombre(l["Terrain conquis (cm²)"]),
      nourriture: nombre(l["Nourriture"]),
      pertes: nombre(l["Fourmis perdues"]),
      unites: unitesDe(l["Troupes en attaque"]),
      variation: variationDe(l["Troupes en attaque"], nombre(l["Fourmis perdues"]), l["RC"]),
      difficulte: difficulteDe(l["Troupes en défense"]),
    });
  });
  Object.keys(parJoueur).forEach(function (k) {
    parJoueur[k].chasses.sort(function (a, b) {
      return a.minute < b.minute ? -1 : a.minute > b.minute ? 1 : 0;
    });
  });
  return parJoueur;
}

// chasses rentrées à moins de MULTICHASSE_MINUTES de la précédente : un groupe
function multiChasses(chasses) {
  var groupes = [];
  chasses.forEach(function (c) {
    var g = groupes[groupes.length - 1];
    if (!g || c.instant - g.dernier > MULTICHASSE_MINUTES * 60000) {
      g = {
        minute: c.minute,
        dernier: c.instant,
        nombre: 0,
        terrain: 0,
        nourriture: 0,
        pertes: 0,
        difficulte: 0,
        unites: UNITES.map(function () {
          return 0;
        }),
        variation: UNITES.map(function () {
          return 0;
        }),
      };
      groupes.push(g);
    }
    g.dernier = c.instant;
    g.nombre++;
    g.terrain += c.terrain;
    g.nourriture += c.nourriture;
    g.pertes += c.pertes;
    g.difficulte += c.difficulte;
    c.unites.forEach(function (n, i) {
      g.unites[i] += n;
      g.variation[i] += c.variation[i];
    });
  });
  return groupes;
}

// rang d'une unité d'après son nom de RC (singulier ou pluriel), -1 si inconnue
function rangUnite(nom) {
  return UNITES.map(function (u) {
    return u.cle;
  }).indexOf(cleNom(nom));
}

// nom de RC sans accent, en minuscules, mots au singulier (« Mantes religieuses »
// → « mante religieuse » ; « souris » donne « souri » au singulier comme au pluriel)
function cleNom(nom) {
  return String(nom || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2019\u2018]/g, "'")
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map(function (mot) {
      return mot.length > 3 && /s$/.test(mot) ? mot.slice(0, -1) : mot;
    })
    .join(" ");
}

// difficulté d'une chasse : points de difficulté de la faune de « Troupes en
// défense » (« 1 234 Criquets, 56 Abeilles »)
function difficulteDe(texte) {
  var cles = FAUNE.map(function (f) {
      return cleNom(f.nom);
    }),
    total = 0;
  String(texte || "")
    .split(",")
    .forEach(function (morceau) {
      var m = /^\s*(\d[\d\s\u00a0\u202f]*)\s+(.+?)\s*\.?\s*$/.exec(morceau),
        k = m ? cles.indexOf(cleNom(m[2])) : -1;
      if (k != -1) total += Number(m[1].replace(/\D/g, "")) * FAUNE[k].diff;
    });
  return total;
}

// difficulté par cm² chassé d'une multi-chasse, au centième
function difficulteParCm2(g) {
  return g.terrain > 0 ? arrondi(g.difficulte / g.terrain, 2) : "";
}

// nombre de chaque unité d'une liste de troupes de RC (« 1 000 Jeunes Soldates Naines, … »)
function unitesDe(texte) {
  var unites = UNITES.map(function () {
    return 0;
  });
  String(texte || "")
    .split(",")
    .forEach(function (morceau) {
      var m = /^\s*(\d[\d\s\u00a0\u202f]*)\s+(.+?)\s*\.?\s*$/.exec(morceau),
        i = m ? rangUnite(m[2]) : -1;
      if (i != -1) unites[i] += Number(m[1].replace(/\D/g, ""));
    });
  return unites;
}

// expérience d'un RC : « - 60 Jeunes Soldates Naines sont devenues des Soldates Naines »
function experienceDe(rc) {
  var liste = [],
    re =
      /^\s*-\s*(\d[\d \u00a0\u202f]*)\s+(.+?)\s+(?:sont devenues|est devenue)\s+(?:des|une|un)\s+(.+?)\s*\.?\s*$/gm,
    m;
  while ((m = re.exec(String(rc || "")))) {
    var de = rangUnite(m[2]),
      vers = rangUnite(m[3]);
    if (de != -1 && vers != -1)
      liste.push({ nombre: Number(m[1].replace(/\D/g, "")), de: de, vers: vers });
  }
  return liste;
}

// ce qu'une chasse change à l'armée, par unité : ses morts, dans l'ordre de
// l'armée (le jeu tue d'abord les premières unités : dans un RC, les dégâts
// reçus divisés par les morts donnent la vie de la première unité envoyée),
// puis l'expérience gagnée par les survivantes
function variationDe(troupes, morts, rc) {
  var reste = morts,
    v = unitesDe(troupes).map(function (n) {
      var k = Math.min(n, reste);
      reste -= k;
      // pas de « -0 » pour une unité sans mort
      return k ? -k : 0;
    });
  experienceDe(rc).forEach(function (e) {
    v[e.de] -= e.nombre;
    v[e.vers] += e.nombre;
  });
  return v;
}

// unités, attaque, défense et vie hors bonus d'une armée
function forcesDe(unites) {
  var f = { unites: 0, att: 0, def: 0, vie: 0 };
  unites.forEach(function (n, i) {
    f.unites += n;
    f.att += n * UNITES[i].att;
    f.def += n * UNITES[i].def;
    f.vie += n * UNITES[i].vie;
  });
  return f;
}

// armée de la première multi-chasse, puis après les chasses de la période sans
// les unités pondues entre-temps : chaque chasse lui applique son effet en %
// (pertes et expérience rapportées aux troupes qu'elle a emmenées), à la suite ;
// soustraire toutes les pertes de la période la rendrait négative sur une longue
// période, les pontes remplaçant les mortes
function blocArmee(groupes) {
  var debut = groupes.length ? forcesDe(groupes[0].unites) : null,
    apres = function (cle) {
      return groupes.reduce(function (v, g) {
        var envoye = forcesDe(g.unites)[cle];
        return envoye > 0 ? Math.max(0, v * (1 + forcesDe(g.variation)[cle] / envoye)) : v;
      }, debut[cle]);
    },
    ligne = function (libelle, cle) {
      var a = debut ? debut[cle] : "",
        b = debut ? Math.round(apres(cle)) : "";
      return [libelle, a, b, debut && a > 0 ? arrondi(((b - a) / a) * 100, 1) : ""];
    };
  return {
    titres: [
      "Armée (hors bonus)",
      "Première multi-chasse",
      "Après les chasses, sans les pontes",
      "Variation (%)",
    ],
    lignes: [
      ligne("FdF", "att"),
      ligne("Défense", "def"),
      ligne("Vie", "vie"),
      ligne("Capacité de flood (unités)", "unites"),
    ],
  };
}

// chasseurs du fichier (colonne « Exporté par »), sans doublon de casse, triés
function chasseursDe(table) {
  var vus = {};
  if (table && table.length > 1) {
    var k = table[0]
      .map(function (t) {
        return String(t).trim();
      })
      .indexOf("Exporté par");
    for (var i = 1; k != -1 && i < table.length; i++) {
      var nom = String(table[i][k] || "").trim();
      if (nom && !vus[nom.toLowerCase()]) vus[nom.toLowerCase()] = nom;
    }
  }
  return Object.keys(vus)
    .sort()
    .map(function (k) {
      return vus[k];
    });
}

// courbes des autres chasseurs de la période, chasse par chasse (la leur)
function autresChasseurs(parJoueur, moi, n) {
  return Object.keys(parJoueur)
    .sort()
    .filter(function (k) {
      return k != moi;
    })
    .map(function (k) {
      var groupes = multiChasses(parJoueur[k].chasses);
      return {
        joueur: parJoueur[k].joueur,
        terrain: groupes.map(function (g) {
          return g.terrain;
        }),
        pertes: groupes.map(function (g) {
          return parMillion(g.pertes, g.terrain);
        }),
        nourriture: groupes.map(function (g) {
          return g.nourriture;
        }),
        difficulte: groupes.map(difficulteParCm2),
        dates: groupes.map(function (g) {
          return dateSerie(g.minute);
        }),
        etire: etirer(
          groupes.map(function (g) {
            return g.terrain;
          }),
          n,
        ),
      };
    });
}

// chasseurs de la période, le joueur compris (ordre du fichier), et la moyenne de
// chaque colonne entre eux (chacun compte autant), au dixième
function comparaisonChasseurs(parJoueur) {
  var lignes = Object.keys(parJoueur)
      .sort()
      .map(function (k) {
        var chasses = parJoueur[k].chasses,
          n = multiChasses(chasses).length,
          terrain = somme(chasses, "terrain"),
          pertes = somme(chasses, "pertes"),
          nourriture = somme(chasses, "nourriture");
        return [
          parJoueur[k].joueur,
          chasses.length,
          n,
          terrain,
          n ? Math.round(terrain / n) : "",
          pertes,
          parMillion(pertes, terrain),
          nourriture,
          n ? Math.round(nourriture / n) : "",
        ];
      }),
    moyenne = TITRES_COMPARAISON.slice(1).map(function (t, k) {
      var valeurs = lignes
        .map(function (l) {
          return l[k + 1];
        })
        .filter(function (v) {
          return typeof v == "number";
        });
      return valeurs.length
        ? arrondi(
            valeurs.reduce(function (a, b) {
              return a + b;
            }, 0) / valeurs.length,
            1,
          )
        : "";
    });
  return {
    titres: TITRES_COMPARAISON,
    lignes: lignes,
    moyenne: [MOYENNE_DES_CHASSEURS].concat(moyenne),
  };
}

// résumé de l'onglet avec l'écart de chaque chiffre à la moyenne des chasseurs
// de la période (chacun compte autant), en %, au dixième, comme la synthèse ;
// vide s'ils sont moins de deux
function ecartsDuResume(s) {
  var c = s.comparaison;
  return s.resume.map(function (l) {
    var m = c.lignes.length >= 2 ? c.moyenne[c.titres.indexOf(l[0])] : "";
    return [
      l[0],
      l[1],
      typeof l[1] == "number" && typeof m == "number" && m > 0
        ? arrondi(((l[1] - m) / m) * 100, 1)
        : "",
    ];
  });
}

// tableau des chasseurs de la période, comme dans la synthèse : du plus grand
// terrain chassé au plus petit, puis leur moyenne
function tableauChasseurs(c) {
  var k = function (titre) {
      return c.titres.indexOf(titre);
    },
    terrain = k("Terrain chassé (cm²)"),
    ligne = function (l) {
      return COLONNES_TABLEAU_CHASSEURS.map(function (colonne) {
        return l[k(colonne[1])];
      });
    },
    lignes = c.lignes
      .slice()
      .sort(function (a, b) {
        return (Number(b[terrain]) || 0) - (Number(a[terrain]) || 0);
      })
      .map(ligne);
  return {
    titres: COLONNES_TABLEAU_CHASSEURS.map(function (colonne) {
      return colonne[0];
    }),
    lignes: lignes.length ? lignes.concat([ligne(c.moyenne)]) : [],
  };
}

// courbe de m valeurs ramenée sur n points (n chasses du joueur) : même début,
// même fin, valeurs intermédiaires interpolées ; une seule chasse : le milieu
function etirer(valeurs, n) {
  var m = valeurs.length,
    resultat = [];
  for (var i = 0; m && i < n; i++) {
    var u = (n == 1 ? 0.5 : i / (n - 1)) * (m - 1),
      k = Math.floor(u),
      f = u - k;
    resultat.push(Math.round(k + 1 < m ? valeurs[k] * (1 - f) + valeurs[k + 1] * f : valeurs[k]));
  }
  return resultat;
}

// moyenne point par point de courbes de même longueur (la première)
function moyenneDesCourbes(courbes) {
  return courbes[0].map(function (v, i) {
    var valeurs = courbes
      .map(function (c) {
        return c[i];
      })
      .filter(function (x) {
        return typeof x == "number";
      });
    return Math.round(
      valeurs.reduce(function (a, b) {
        return a + b;
      }, 0) / valeurs.length,
    );
  });
}

// numéro de série du tableur d'une minute "AAAA-MM-JJ HH:mm" (heure du fichier)
function dateSerie(minute) {
  return (instantDe(minute) - Date.UTC(1899, 11, 30)) / 86400000;
}

// droite des moindres carrés des chasses dans l'ordre (valeur ajustée de
// chacune), jamais sous 0 : un terrain chassé n'est pas négatif
function tendance(valeurs) {
  var n = valeurs.length,
    mx = (n - 1) / 2,
    my =
      valeurs.reduce(function (a, b) {
        return a + b;
      }, 0) / (n || 1),
    sxy = 0,
    sxx = 0;
  valeurs.forEach(function (y, x) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) * (x - mx);
  });
  return valeurs.map(function (y, x) {
    return Math.max(0, Math.round(my + (sxx ? sxy / sxx : 0) * (x - mx)));
  });
}

// baisse plus petite que l'arrondi : 0, pas -0
function arrondi(v, decimales) {
  var f = Math.pow(10, decimales);
  return Math.round(v * f) / f || 0;
}

// "AAAA-MM-JJ HH:mm" lu comme UTC : écarts exacts entre deux retours
function instantDe(minute) {
  var m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/.exec(minute) || [];
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
}

function libelleMinute(minute) {
  return minute.slice(8, 10) + "/" + minute.slice(5, 7) + " " + minute.slice(11, 16);
}

// lignes d'un onglet datées de la période, en objets {titre: valeur, minute}
function lignesDePeriode(table, colonnes, debut, fin, fuseau) {
  if (!table || table.length < 2) return [];
  var titres = table[0].map(function (t) {
      return String(t).trim();
    }),
    index = colonnes.map(function (c) {
      return titres.indexOf(c);
    }),
    manquante = colonnes.filter(function (c, i) {
      return index[i] == -1;
    })[0],
    lignes = [];
  // onglet créé vide (jamais rempli) : aucune donnée
  if (
    titres.every(function (t) {
      return !t;
    })
  )
    return [];
  if (manquante) throw new Error("colonne « " + manquante + " » introuvable");
  for (var i = 1; i < table.length; i++) {
    var minute = minuteDe(table[i][index[colonnes.indexOf("Date")]], fuseau),
      jour = minute.slice(0, 10);
    if (!jour || jour < debut || jour > fin) continue;
    var l = { minute: minute };
    colonnes.forEach(function (c, k) {
      l[c] = table[i][index[k]];
    });
    lignes.push(l);
  }
  return lignes;
}

// minute "AAAA-MM-JJ HH:mm" d'une date du fichier ("" si ce n'en est pas une)
function minuteDe(v, fuseau) {
  if (Object.prototype.toString.call(v) == "[object Date]")
    return isNaN(v.getTime()) ? "" : Utilities.formatDate(v, fuseau, "yyyy-MM-dd HH:mm");
  if (typeof v == "number" && v > 0)
    return new Date(Date.UTC(1899, 11, 30) + Math.round(v * 86400000))
      .toISOString()
      .slice(0, 16)
      .replace("T", " ");
  var m = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(String(v || "").trim());
  return m ? m[1] + " " + (m[2] || "00") + ":" + (m[3] || "00") : "";
}

// jour "AAAA-MM-JJ" d'une date du fichier : date, numéro de série ou texte
function jourDe(v, fuseau) {
  if (Object.prototype.toString.call(v) == "[object Date]")
    return isNaN(v.getTime()) ? "" : Utilities.formatDate(v, fuseau, "yyyy-MM-dd");
  if (typeof v == "number" && v > 0)
    return new Date(Date.UTC(1899, 11, 30) + Math.round(v * 86400000)).toISOString().slice(0, 10);
  var m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v || "").trim());
  return m ? m[1] : "";
}

function nomJoueur(p) {
  return String(p || "")
    .trim()
    .toLowerCase();
}

function nombre(v) {
  return Number(v) || 0;
}

function dateDuJour(jour) {
  var p = jour.split("-");
  return new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])));
}

function joursEntre(debut, fin) {
  return Math.round((dateDuJour(fin) - dateDuJour(debut)) / 86400000);
}

function statistiquesValides(d) {
  var jour = /^\d{4}-\d{2}-\d{2}$/;
  return (
    typeof d.joueur == "string" &&
    d.joueur.trim().length > 0 &&
    d.joueur.length <= 40 &&
    jour.test(d.debut) &&
    jour.test(d.fin) &&
    d.debut <= d.fin &&
    joursEntre(d.debut, d.fin) <= STATS_JOURS_MAX
  );
}

// requête de l'extension : seules les colonnes utiles de l'onglet sont lues
function statistiquesDemandees(classeur, d) {
  try {
    var fuseau = classeur.getSpreadsheetTimeZone(),
      s = statistiques(
        tablesDuFichier(classeur, d.joueur, d.debut, d.fin, fuseau),
        d.joueur,
        d.debut,
        d.fin,
        fuseau,
        d.autres === true,
      );
    // une extension d'avant le format 4 n'en demande pas : la réponse reste
    // lisible pour elle (mêmes titres, colonnes ajoutées avant « Nourriture »)
    s.format = Math.min(FORMAT_STATISTIQUES, Number(d.format) || 3);
    return { statistiques: s };
  } catch (err) {
    return { erreur: "statistiques impossibles : " + (err && err.message ? err.message : err) };
  }
}

// l'onglet des chasses, lu de la même façon pour les deux vues : toutes ses
// lignes jusqu'aux troupes, et le texte de leur RC (long, l'onglet grossit
// sans fin) seulement pour les chasses du joueur dans la période, les seules
// dont l'expérience gagnée compte
function tablesDuFichier(classeur, joueur, debut, fin, fuseau) {
  var nom = "BDD chasse",
    table = lireColonnes(
      classeur,
      nom,
      COLONNES_CHASSE.filter(function (c) {
        return c != "RC";
      }),
    );
  if (table.length < 2) return { chasse: table };
  var feuille = classeur.getSheetByName(nom),
    titres = function (ligne) {
      return ligne.map(function (t) {
        return String(t).trim();
      });
    },
    kRc = titres(feuille.getRange(1, 1, 1, feuille.getLastColumn()).getValues()[0]).indexOf("RC");
  // colonne des RC absente : l'erreur « colonne introuvable » le dira
  if (kRc == -1) return { chasse: table };
  var kPar = titres(table[0]).indexOf("Exporté par"),
    kDate = titres(table[0]).indexOf("Date"),
    moi = nomJoueur(joueur),
    // joueur ou période refusés (onglet « Statistiques ») : rien à lire, son message le dit
    demande = moi && debut && fin && debut <= fin && joursEntre(debut, fin) <= STATS_JOURS_MAX,
    lignes = [],
    // ligne de l'onglet → texte de son RC, pour les seules lignes utiles
    rc = {},
    k = 0;
  for (var i = 1; demande && kPar != -1 && kDate != -1 && i < table.length; i++) {
    var jour = minuteDe(table[i][kDate], fuseau).slice(0, 10);
    if (nomJoueur(table[i][kPar]) == moi && jour && jour >= debut && jour <= fin)
      lignes.push(i + 1);
  }
  // blocs et lignes croissants : chaque ligne est dans le premier bloc qui va jusqu'à elle
  blocsDeLignes(lignes, ECART_LECTURE_RC).forEach(function (b) {
    var valeurs = feuille.getRange(b[0], kRc + 1, b[1] - b[0] + 1, 1).getValues();
    for (; k < lignes.length && lignes[k] <= b[1]; k++)
      rc[lignes[k]] = valeurs[lignes[k] - b[0]][0];
  });
  return {
    chasse: table.map(function (l, i) {
      return l.concat(i == 0 ? "RC" : i + 1 in rc ? rc[i + 1] : "");
    }),
  };
}

// lignes de l'onglet (croissantes) regroupées en blocs [première, dernière] :
// deux lignes séparées d'au plus `ecart` autres sont lues d'un coup
function blocsDeLignes(lignes, ecart) {
  var blocs = [];
  lignes.forEach(function (r) {
    var b = blocs[blocs.length - 1];
    if (b && r - b[1] <= ecart + 1) b[1] = r;
    else blocs.push([r, r]);
  });
  return blocs;
}

// valeurs de l'onglet jusqu'à la dernière des colonnes demandées
function lireColonnes(classeur, nom, colonnes) {
  var feuille = classeur.getSheetByName(nom);
  if (!feuille || feuille.getLastRow() < 2) return [];
  var titres = feuille
      .getRange(1, 1, 1, Math.max(feuille.getLastColumn(), 1))
      .getValues()[0]
      .map(function (t) {
        return String(t).trim();
      }),
    largeur = Math.max.apply(
      null,
      colonnes.map(function (c) {
        return titres.indexOf(c) + 1;
      }),
    );
  return feuille.getRange(1, 1, feuille.getLastRow(), Math.max(largeur, 1)).getValues();
}

// blocs de l'onglet : colonne de départ (à partir de 0) de chacun
function colonneBloc(nom) {
  var colonne = 0;
  for (var i = 0; i < BLOCS_STATISTIQUES.length; i++) {
    if (BLOCS_STATISTIQUES[i].nom == nom) return colonne;
    colonne += BLOCS_STATISTIQUES[i].largeur + 1;
  }
  return -1;
}

/**
 * Statistiques de chasse d'un joueur sur une période, pour l'onglet
 * « Statistiques » : résumé, armée et chasses côte à côte. Un seul argument,
 * B3:B6 (joueur, premier et dernier jour, contrôle des données) : une formule
 * sans séparateur d'arguments se lit pareil dans tous les paramètres
 * régionaux (« , » ou « ; »). La case de contrôle change avec l'onglet des
 * chasses : la fonction est recalculée quand il change.
 *
 * @param {Array<Array>} parametres B3:B6
 * @return {Array<Array>}
 * @customfunction
 */
function STATS_OUAF(parametres) {
  var classeur = SpreadsheetApp.getActiveSpreadsheet(),
    fuseau = classeur.getSpreadsheetTimeZone(),
    p = (parametres || []).map(function (l) {
      return l[0];
    }),
    joueur = p[0],
    jours = [jourDe(p[1], fuseau), jourDe(p[2], fuseau)],
    tables = tablesDuFichier(classeur, joueur, jours[0], jours[1], fuseau),
    message = !String(joueur || "").trim()
      ? "Choisis un joueur (case B3)."
      : !jours[0] || !jours[1]
        ? "Indique le premier et le dernier jour (cases B4 et B5)."
        : jours[0] > jours[1]
          ? "Le premier jour est après le dernier."
          : joursEntre(jours[0], jours[1]) > STATS_JOURS_MAX
            ? "Période trop longue : trois ans au plus."
            : "",
    s = message ? null : statistiques(tables, joueur, jours[0], jours[1], fuseau, true),
    vide = { titres: [], lignes: [] },
    blocs = {
      resume: {
        titres: ["Indicateur", "Valeur", "Écart à la moyenne des chasseurs"],
        lignes: s ? ecartsDuResume(s) : [[message, "", ""]],
      },
      comparaison: s ? tableauChasseurs(s.comparaison) : vide,
      armee: s ? s.armee : vide,
      chasses: s ? s.chasses : vide,
      joueurs: {
        titres: ["Pseudo"],
        lignes: chasseursDe(tables.chasse).map(function (j) {
          return [j];
        }),
      },
      autres: autresDuBloc(tables.chasse, joueur, s),
    },
    titres = {},
    hauteur = 2,
    sortie = [];
  // listes plus longues que l'onglet : les plus récentes, titre complété
  BLOCS_STATISTIQUES.forEach(function (b) {
    var lignes = blocs[b.nom].lignes,
      place = LIGNES_STATISTIQUES - 2;
    titres[b.nom] = b.titre;
    if (lignes.length > place) {
      blocs[b.nom] = { titres: blocs[b.nom].titres, lignes: lignes.slice(-place) };
      titres[b.nom] = b.titre + " (les " + place + " dernières lignes)";
    }
    hauteur = Math.max(hauteur, 2 + blocs[b.nom].lignes.length);
  });
  var largeur = colonneBloc("autres") + Math.max(1, blocs.autres.titres.length);
  for (var r = 0; r < hauteur; r++) {
    var ligne = [];
    for (var c = 0; c < largeur; c++) ligne.push("");
    sortie.push(ligne);
  }
  BLOCS_STATISTIQUES.forEach(function (b) {
    var c0 = colonneBloc(b.nom),
      bloc = blocs[b.nom];
    sortie[0][c0] = titres[b.nom];
    bloc.titres.forEach(function (t, k) {
      sortie[1][c0 + k] = t;
    });
    bloc.lignes.forEach(function (l, r) {
      l.forEach(function (v, k) {
        sortie[2 + r][c0 + k] = v;
      });
    });
  });
  return sortie;
}

// bloc « autres » de l'onglet : une colonne par chasseur du fichier sauf le
// joueur (les mêmes d'une période à l'autre : celles du graphique), son terrain
// étiré sur les chasses du joueur, vide s'il n'a pas chassé dans la période
function autresDuBloc(table, joueur, s) {
  var moi = nomJoueur(joueur),
    noms = chasseursDe(table).filter(function (j) {
      return nomJoueur(j) != moi;
    }),
    parNom = {},
    lignes = [];
  ((s && s.autres) || []).forEach(function (a) {
    parNom[nomJoueur(a.joueur)] = a.etire;
  });
  for (var i = 0; s && i < s.chasses.lignes.length; i++)
    lignes.push(
      noms.map(function (j) {
        var e = parNom[nomJoueur(j)];
        return e ? e[i] : "";
      }),
    );
  return { titres: noms, lignes: lignes };
}

// lettres d'une colonne (1 : A, 27 : AA), pour une formule de mise en forme conditionnelle
function lettresColonne(n) {
  var lettres = "";
  for (; n > 0; n = Math.floor((n - 1) / 26))
    lettres = String.fromCharCode(65 + ((n - 1) % 26)) + lettres;
  return lettres;
}

// change dès qu'une ligne est ajoutée, retirée ou modifiée dans « BDD chasse » ;
// « + » et fonctions à un argument : aucun séparateur d'arguments
function formuleControle() {
  return "=COUNTA('BDD chasse'!A:A)+SUM('BDD chasse'!C:F)";
}

// onglet « Statistiques » manquant : créé (doGet) ; une erreur n'empêche pas la réponse
function preparerStatistiques(classeur) {
  try {
    if (!classeur.getSheetByName(ONGLET_STATISTIQUES)) creerStatistiques(classeur);
  } catch (err) {
    console.warn("Onglet Statistiques non créé : " + err);
  }
}

function creerStatistiques(classeur) {
  // la formule de contrôle cite l'onglet des chasses : il doit exister, même vide
  if (!classeur.getSheetByName("BDD chasse")) classeur.insertSheet("BDD chasse");
  var f = classeur.insertSheet(ONGLET_STATISTIQUES, 0),
    c0 = COLONNE_STATISTIQUES,
    // colonne (à partir de 1) de la k-ième colonne d'un bloc
    colonne = function (bloc, k) {
      return c0 + colonneBloc(bloc) + (k || 0);
    },
    titreChasses = function (titre) {
      return colonne("chasses", TITRES_CHASSES.indexOf(titre));
    },
    cJoueurs = colonne("joueurs"),
    cAutres = colonne("autres"),
    // une colonne par autre chasseur du fichier : celles du graphique (onglet à
    // recréer quand de nouveaux chasseurs exportent)
    nAutres = Math.max(
      1,
      chasseursDe(lireColonnes(classeur, "BDD chasse", ["Exporté par"])).length - 1,
    ),
    donnees = LIGNES_STATISTIQUES - 2,
    // libellés du résumé (ils ne dépendent pas des données) : graphiques dessous
    resume = statistiques({}, "?", "2000-01-01", "2000-01-01", "UTC").resume;
  // résultat de STATS_OUAF plus large que les 26 colonnes d'un nouvel onglet
  agrandir(f, LIGNES_STATISTIQUES, cAutres + nAutres - 1);
  f.getRange(1, 1).setValue("Statistiques de chasse (Extension OUAF)").setFontWeight("bold");
  f.getRange(3, 1, 3, 1)
    .setValues([["Joueur"], ["Premier jour"], ["Dernier jour"]])
    .setFontWeight("bold");
  f.getRange(4, 2).setFormula("=TODAY()-30");
  f.getRange(5, 2).setFormula("=TODAY()");
  f.getRange(4, 2, 2, 1)
    .setNumberFormat("dd/mm/yyyy")
    .setDataValidation(
      SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false).build(),
    );
  f.getRange(3, 2).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInRange(f.getRange(3, cJoueurs, donnees, 1), true)
      .setAllowInvalid(true)
      .build(),
  );
  f.getRange(7, 1).setValue(
    "Choisis un joueur et une période : tableaux et graphiques se mettent à jour seuls.",
  );
  // contrôle des données, lu avec les paramètres ; sa ligne reste visible (la
  // cacher masquerait aussi une ligne de chaque bloc), sa valeur non (« ;;; »)
  f.getRange(6, 1).setValue("Contrôle (ne pas effacer)");
  f.getRange(6, 2).setFormula(formuleControle()).setNumberFormat(";;;");
  f.getRange(1, c0).setFormula("=STATS_OUAF(B3:B6)");
  f.getRange(1, c0, 2, cAutres + nAutres - c0).setFontWeight("bold");
  f.getRange(3, c0 + 1, donnees, cAutres + nAutres - c0 - 1).setNumberFormat("#,##0");
  // variation de l'armée en % : une décimale ; date de retour ; difficulté au centième
  f.getRange(3, colonne("armee", 3), donnees, 1).setNumberFormat("0.0");
  f.getRange(3, titreChasses("Date"), donnees, 1).setNumberFormat("dd/mm hh:mm");
  f.getRange(3, titreChasses("Difficulté / cm²"), donnees, 1).setNumberFormat("0.00");
  // écarts du résumé en %, signés ; mieux que la moyenne des chasseurs en vert,
  // moins bien en rouge (au-dessus, sauf pour les pertes), comme la synthèse
  var cEcart = colonne("resume", 2),
    lignesEcart = function (moinsEstMieux) {
      return resume
        .map(function (l, i) {
          return RESUME_MOINS_EST_MIEUX.indexOf(l[0]) >= 0 == moinsEstMieux
            ? f.getRange(3 + i, cEcart)
            : null;
        })
        .filter(Boolean);
    },
    couleurEcart = function (plages, positif, couleur) {
      var regle = SpreadsheetApp.newConditionalFormatRule();
      return (positif ? regle.whenNumberGreaterThan(0) : regle.whenNumberLessThan(0))
        .setFontColor(couleur)
        .setRanges(plages)
        .build();
    },
    cTableau = colonne("comparaison"),
    tableau = f.getRange(3, cTableau, donnees, COLONNES_TABLEAU_CHASSEURS.length),
    nom = "$" + lettresColonne(cTableau) + "3";
  f.getRange(3, cEcart, resume.length, 1).setNumberFormat('+0.0" %";-0.0" %";0.0" %"');
  // tableau des chasseurs : le joueur de la case B3 en gras, la moyenne en italique
  f.setConditionalFormatRules([
    couleurEcart(lignesEcart(false), true, COULEUR_ECART_MIEUX),
    couleurEcart(lignesEcart(false), false, COULEUR_ECART_MOINS_BIEN),
    couleurEcart(lignesEcart(true), true, COULEUR_ECART_MOINS_BIEN),
    couleurEcart(lignesEcart(true), false, COULEUR_ECART_MIEUX),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied("=LOWER(TRIM(" + nom + "))=LOWER(TRIM($B$3))")
      .setBold(true)
      .setRanges([tableau])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied("=" + nom + '="' + MOYENNE_DES_CHASSEURS + '"')
      .setItalic(true)
      .setRanges([tableau])
      .build(),
  ]);
  f.setColumnWidth(1, 110);
  f.setColumnWidth(2, 110);
  f.setColumnWidth(c0, 200);
  f.setColumnWidth(cEcart, 200);
  f.hideColumns(cJoueurs);
  // titres en ligne 2, valeurs dessous ; première plage : l'axe horizontal
  var plage = function (titre, n) {
      return f.getRange(2, titreChasses(titre), LIGNES_STATISTIQUES - 1, n || 1);
    },
    chasses = plage("Chasse"),
    premiere = resume.length + 5,
    // couleurs de la synthèse de l'extension : chaque chasseur en pointillés, le
    // joueur en vert, les autres dans les autres couleurs (un autre pointillé
    // quand elles sont épuisées) ; les tendances en tirets, celle du joueur en
    // vert, celle de la moyenne des chasseurs en rouge
    trait = [10, 5],
    pointilles = [2, 3],
    autresPointilles = [pointilles, [6, 3, 2, 3], [12, 3, 2, 3]],
    seriesAutres = {};
  for (var k = 0; k < nAutres; k++)
    seriesAutres[3 + k] = {
      color: COULEURS_AUTRES_CHASSEURS[k % COULEURS_AUTRES_CHASSEURS.length],
      lineWidth: 2,
      lineDashStyle:
        autresPointilles[
          Math.floor(k / COULEURS_AUTRES_CHASSEURS.length) % autresPointilles.length
        ],
    };
  seriesAutres[0] = { color: COULEUR_JOUEUR, lineWidth: 2, lineDashStyle: pointilles };
  seriesAutres[1] = { color: COULEUR_JOUEUR, lineWidth: 2, lineDashStyle: trait };
  seriesAutres[2] = { color: COULEUR_MOYENNE, lineWidth: 2, lineDashStyle: trait };
  [
    {
      // pommes et pertes sur le même axe de droite (Google Sheets n'en a que
      // deux) : en échelle logarithmique, les pertes ne s'écrasent pas en bas
      type: Charts.ChartType.COMBO,
      titre: "Terrain (barres), nourriture et pertes (courbes, échelle log) de chaque chasse",
      plages: [chasses, plage("Terrain (cm²)"), plage("Nourriture"), plage("Pertes")],
      options: {
        seriesType: "bars",
        series: {
          0: { color: COULEUR_JOUEUR, targetAxisIndex: 0 },
          1: { type: "line", color: COULEUR_NOURRITURE, targetAxisIndex: 1, lineWidth: 2 },
          2: { type: "line", color: COULEUR_PERTES, targetAxisIndex: 1, lineWidth: 2 },
        },
        vAxes: {
          0: { title: "Terrain (cm²)", minValue: 0 },
          1: { title: "Nourriture et pertes", logScale: true },
        },
      },
    },
    {
      type: Charts.ChartType.LINE,
      titre:
        "Terrain chassé à chaque chasse : toi, les autres chasseurs (étirés sur tes chasses) et la tendance de leur moyenne",
      plages: [
        chasses,
        plage("Terrain (cm²)", 2),
        plage("Tendance de la moyenne (cm²)"),
        f.getRange(2, cAutres, LIGNES_STATISTIQUES - 1, nAutres),
      ],
      options: { series: seriesAutres },
    },
    {
      type: Charts.ChartType.SCATTER,
      titre: "Nourriture selon le terrain chassé (un point par chasse)",
      plages: [plage("Terrain (cm²)"), plage("Nourriture")],
      options: {
        series: { 0: { color: COULEUR_JOUEUR, pointSize: 6 } },
        hAxis: { title: "Terrain chassé (cm²)" },
        vAxis: { title: "Nourriture" },
        legend: { position: "none" },
      },
    },
    {
      type: Charts.ChartType.SCATTER,
      titre: "Terrain chassé selon la difficulté par cm² (un point par chasse)",
      plages: [plage("Difficulté / cm²"), plage("Terrain (cm²)")],
      options: {
        series: { 0: { color: COULEUR_JOUEUR, pointSize: 6 } },
        hAxis: { title: "Difficulté par cm² (faune rencontrée)" },
        vAxis: { title: "Terrain chassé (cm²)" },
        legend: { position: "none" },
      },
    },
    {
      type: Charts.ChartType.LINE,
      titre:
        "Pertes par M cm² de chaque chasse dans le temps, et la moyenne de la période (pertes totales ÷ terrain total)",
      plages: [plage("Date"), plage("Pertes / M cm²", 2)],
      options: {
        series: {
          0: { color: COULEUR_JOUEUR, lineWidth: 2, pointSize: 5 },
          1: { color: COULEUR_ENCRE, lineWidth: 1, lineDashStyle: [6, 4] },
        },
        hAxis: { format: "dd/MM" },
      },
    },
    {
      type: Charts.ChartType.AREA,
      titre: "Armée envoyée à chaque chasse (unités, hors bonus)",
      plages: [
        chasses,
        f.getRange(
          2,
          colonne("chasses", TITRES_CHASSES.length),
          LIGNES_STATISTIQUES - 1,
          UNITES.length,
        ),
      ],
      options: { isStacked: true },
    },
  ].forEach(function (g, i) {
    var graphique = f
      .newChart()
      .setChartType(g.type)
      .setNumHeaders(1)
      .setPosition(premiere + 18 * i, 1, 0, 0)
      .setOption("title", g.titre)
      .setOption("legend", { position: "bottom" })
      .setOption("width", 640)
      .setOption("height", 340);
    g.plages.forEach(function (p) {
      graphique.addRange(p);
    });
    Object.keys(g.options || {}).forEach(function (k) {
      graphique.setOption(k, g.options[k]);
    });
    f.insertChart(graphique.build());
  });
}
