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
var VERSION_SCRIPT = "2026-11-08.4";

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
 * Statistiques d'un joueur sur une période. Un seul calcul (statistiques)
 * pour l'onglet « Statistiques » du fichier (fonction STATS_OUAF) et pour
 * l'onglet « Synthèse » de l'extension (requête statistiques).
 * ------------------------------------------------------------------- */

var ONGLET_STATISTIQUES = "Statistiques";
// colonnes lues par onglet (titres écrits par l'extension) ; les combats et
// les prises ont les mêmes dans les trois onglets de combats
var COLONNES_CHASSE = [
  "Exporté par",
  "Date",
  "Terrain conquis (cm²)",
  "Nourriture",
  "Fourmis perdues",
  "Troupes en attaque",
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
var COLONNES_COMBATS = [
  "Exporté par",
  "Date",
  "Type",
  "Attaquant",
  "Défenseur",
  "Terrain (cm²)",
  "Nourriture",
  "Matériaux",
  "Pertes attaquant",
  "Pertes défenseur",
];
// évolution par jour jusqu'à deux mois, par semaine jusqu'à un an, sinon par
// mois : une soixantaine de points au plus par graphique
var STATS_JOURS_PAR_JOUR = 62;
var STATS_JOURS_PAR_SEMAINE = 366;
// au-delà, une requête lirait trop longtemps (limite d'exécution d'Apps Script)
var STATS_JOURS_MAX = 3 * 366;
// lignes des tableaux de cibles, d'attaquants et d'alliés
var STATS_TOP = 10;
var MOIS_COURTS = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];
// blocs de l'onglet « Statistiques », côte à côte à partir de la colonne D,
// séparés par une colonne vide
var COLONNE_STATISTIQUES = 4;
// lignes de l'onglet (celles d'un nouvel onglet : une plage plus longue est refusée)
var LIGNES_STATISTIQUES = 1000;
var BLOCS_STATISTIQUES = [
  { nom: "resume", titre: "Résumé", largeur: 2 },
  { nom: "evolution", titre: "Évolution", largeur: 8 },
  { nom: "cibles", titre: "Cibles hors alliance", largeur: 4 },
  { nom: "attaquants", titre: "Attaquants hors alliance", largeur: 4 },
  { nom: "internes", titre: "Floods internes", largeur: 4 },
  { nom: "armee", titre: "Armée (hors bonus)", largeur: 4 },
  { nom: "comparaison", titre: "Chasseurs de la période", largeur: 6 },
  { nom: "multiChasses", titre: "Multi-chasses", largeur: 8 + UNITES.length },
  { nom: "chasses", titre: "Chasses", largeur: 4 },
  { nom: "joueurs", titre: "Joueurs", largeur: 1 },
];

/**
 * Statistiques du joueur entre deux jours compris.
 *
 * tables : {chasse, attaques, defenses, internes}, valeurs des onglets avec
 * leurs titres en première ligne (vides si l'onglet manque) ; debut, fin :
 * "AAAA-MM-JJ" ; fuseau : celui du fichier (jour d'une date) ; autres : avec
 * les courbes des autres chasseurs (synthèse de l'extension, sur demande).
 * Chasses, attaques et défenses : lignes exportées par le joueur ; floods
 * internes : lignes où il est attaquant (terrain reçu) ou défenseur (donné).
 * Multi-chasse : chasses rentrées à moins de MULTICHASSE_MINUTES de la
 * précédente ; son armée est la somme des troupes de ses chasses.
 */
function statistiques(tables, joueur, debut, fin, fuseau, autres) {
  var moi = nomJoueur(joueur),
    pas = pasEvolution(debut, fin),
    periodes = periodesEntre(debut, fin, pas),
    parPeriode = {},
    chasses = { nombre: 0, terrain: 0, nourriture: 0, pertes: 0 },
    attaques = {
      butins: 0,
      terrain: 0,
      nourriture: 0,
      materiaux: 0,
      combats: 0,
      pertes: 0,
      tuees: 0,
    },
    defenses = { vols: 0, terrain: 0, combats: 0, pertes: 0, tuees: 0 },
    internes = { terrainRecu: 0, terrainDonne: 0 },
    cibles = {},
    attaquants = {},
    allies = {};
  periodes.forEach(function (p) {
    parPeriode[p.cle] = { chasse: 0, pris: 0, internes: 0, perdu: 0, nourriture: 0, pertes: 0 };
  });
  var periode = function (l) {
      return parPeriode[clePeriode(l.jour, pas)];
    },
    compter = function (liste, nom, champ, valeur) {
      var cle = String(nom || "").trim() || "?";
      liste[cle] = liste[cle] || { nom: cle, a: 0, b: 0, c: 0 };
      liste[cle][champ] += valeur;
    };
  var parJoueur = chassesParJoueur(
      lignesDePeriode(tables.chasse, COLONNES_CHASSE, debut, fin, fuseau),
    ),
    miennes = parJoueur[moi] ? parJoueur[moi].chasses : [],
    groupes = multiChasses(miennes),
    ratios = groupes
      .filter(function (g) {
        return g.terrain > 0;
      })
      .map(function (g) {
        return g.pertes / g.terrain;
      }),
    moyenne = ratios.length
      ? ratios.reduce(function (a, b) {
          return a + b;
        }, 0) / ratios.length
      : null,
    ecart =
      moyenne == null
        ? null
        : Math.sqrt(
            ratios.reduce(function (a, r) {
              return a + (r - moyenne) * (r - moyenne);
            }, 0) / ratios.length,
          );
  miennes.forEach(function (c) {
    var p = periode(c);
    chasses.nombre++;
    chasses.terrain += c.terrain;
    chasses.nourriture += c.nourriture;
    chasses.pertes += c.pertes;
    p.chasse += c.terrain;
    p.nourriture += c.nourriture;
    p.pertes += c.pertes;
  });
  lignesDePeriode(tables.attaques, COLONNES_COMBATS, debut, fin, fuseau).forEach(function (l) {
    if (nomJoueur(l["Exporté par"]) != moi) return;
    if (l["Type"] == "Prise") {
      var terrain = nombre(l["Terrain (cm²)"]);
      attaques.butins++;
      attaques.terrain += terrain;
      attaques.nourriture += nombre(l["Nourriture"]);
      attaques.materiaux += nombre(l["Matériaux"]);
      periode(l).pris += terrain;
      compter(cibles, l["Défenseur"], "a", 1);
      compter(cibles, l["Défenseur"], "b", terrain);
    } else {
      attaques.combats++;
      attaques.pertes += nombre(l["Pertes attaquant"]);
      attaques.tuees += nombre(l["Pertes défenseur"]);
      compter(cibles, l["Défenseur"], "c", 1);
    }
  });
  lignesDePeriode(tables.defenses, COLONNES_COMBATS, debut, fin, fuseau).forEach(function (l) {
    if (nomJoueur(l["Exporté par"]) != moi) return;
    if (l["Type"] == "Prise") {
      var terrain = nombre(l["Terrain (cm²)"]);
      defenses.vols++;
      defenses.terrain += terrain;
      periode(l).perdu += terrain;
      compter(attaquants, l["Attaquant"], "a", 1);
      compter(attaquants, l["Attaquant"], "b", terrain);
    } else {
      defenses.combats++;
      defenses.pertes += nombre(l["Pertes défenseur"]);
      defenses.tuees += nombre(l["Pertes attaquant"]);
      compter(attaquants, l["Attaquant"], "c", 1);
    }
  });
  lignesDePeriode(tables.internes, COLONNES_COMBATS, debut, fin, fuseau).forEach(function (l) {
    if (l["Type"] != "Prise") return;
    var terrain = nombre(l["Terrain (cm²)"]);
    if (nomJoueur(l["Attaquant"]) == moi) {
      internes.terrainRecu += terrain;
      periode(l).internes += terrain;
      compter(allies, l["Défenseur"], "a", terrain);
    } else if (nomJoueur(l["Défenseur"]) == moi) {
      internes.terrainDonne += terrain;
      periode(l).internes -= terrain;
      compter(allies, l["Attaquant"], "b", terrain);
    }
  });
  var parCm2 = function (pertes, terrain) {
      return terrain > 0 ? arrondi(pertes / terrain, 4) : "";
    },
    tendanceChasses = tendance(
      periodes.map(function (p) {
        return parPeriode[p.cle].chasse;
      }),
    ),
    // du plus grand au plus petit, champ après champ, puis par nom
    tri = function (liste, champs) {
      return Object.keys(liste)
        .map(function (k) {
          return liste[k];
        })
        .sort(function (x, y) {
          for (var i = 0; i < champs.length; i++)
            if (y[champs[i]] != x[champs[i]]) return y[champs[i]] - x[champs[i]];
          return x.nom < y.nom ? -1 : x.nom > y.nom ? 1 : 0;
        })
        .slice(0, STATS_TOP);
    };
  return {
    joueur: String(joueur || "").trim(),
    debut: debut,
    fin: fin,
    pas: pas,
    resume: [
      ["Chasses", ""],
      ["Chasses (RC)", chasses.nombre],
      ["Multi-chasses", groupes.length],
      ["Terrain conquis (cm²)", chasses.terrain],
      ["Fourmis perdues", chasses.pertes],
      ["Pertes par cm² chassé", parCm2(chasses.pertes, chasses.terrain)],
      ["Pertes par cm², moyenne des multi-chasses", moyenne == null ? "" : arrondi(moyenne, 4)],
      ["Pertes par cm², écart-type", ecart == null ? "" : arrondi(ecart, 4)],
      ["Nourriture rapportée", chasses.nourriture],
      [
        "Nourriture par chasse",
        chasses.nombre ? Math.round(chasses.nourriture / chasses.nombre) : "",
      ],
      [
        "Terrain moyen par chasse (cm²)",
        chasses.nombre ? Math.round(chasses.terrain / chasses.nombre) : "",
      ],
      ["Attaques hors alliance", ""],
      ["Butins", attaques.butins],
      ["Terrain pris (cm²)", attaques.terrain],
      ["Nourriture pillée", attaques.nourriture],
      ["Matériaux pillés", attaques.materiaux],
      ["Combats", attaques.combats],
      ["Fourmis perdues", attaques.pertes],
      ["Fourmis tuées", attaques.tuees],
      ["Défenses hors alliance", ""],
      ["Vols subis", defenses.vols],
      ["Terrain perdu (cm²)", defenses.terrain],
      ["Combats", defenses.combats],
      ["Fourmis perdues", defenses.pertes],
      ["Fourmis tuées", defenses.tuees],
      ["Floods internes", ""],
      ["Terrain reçu des alliés (cm²)", internes.terrainRecu],
      ["Terrain donné aux alliés (cm²)", internes.terrainDonne],
      ["Bilan", ""],
      [
        "Terrain gagné (cm²)",
        chasses.terrain +
          attaques.terrain +
          internes.terrainRecu -
          defenses.terrain -
          internes.terrainDonne,
      ],
    ],
    evolution: {
      titres: [
        "Période",
        "Chasses (cm²)",
        "Pris (cm²)",
        "Floods internes (cm²)",
        "Perdu (cm²)",
        "Nourriture",
        "Pertes / cm²",
        "Tendance des chasses (cm²)",
      ],
      lignes: periodes.map(function (p, i) {
        var v = parPeriode[p.cle];
        // perte en négatif, sans « -0 » les jours sans perte
        return [
          p.libelle,
          v.chasse,
          v.pris,
          v.internes,
          v.perdu ? -v.perdu : 0,
          v.nourriture,
          parCm2(v.pertes, v.chasse),
          tendanceChasses[i],
        ];
      }),
    },
    cibles: {
      titres: ["Cible", "Butins", "Terrain pris (cm²)", "Combats"],
      lignes: tri(cibles, ["b", "a", "c"]).map(function (c) {
        return [c.nom, c.a, c.b, c.c];
      }),
    },
    attaquants: {
      titres: ["Attaquant", "Vols", "Terrain perdu (cm²)", "Combats"],
      lignes: tri(attaquants, ["b", "a", "c"]).map(function (c) {
        return [c.nom, c.a, c.b, c.c];
      }),
    },
    internes: {
      titres: ["Allié", "Terrain reçu (cm²)", "Terrain donné (cm²)", "Solde (cm²)"],
      lignes: tri(allies, ["a", "b"]).map(function (c) {
        return [c.nom, c.a, c.b, c.a - c.b];
      }),
    },
    // chaque multi-chasse est supposée emmener toute l'armée
    armee: blocArmee(groupes),
    comparaison: {
      titres: [
        "Chasseur",
        "Chasses (RC)",
        "Multi-chasses",
        "Terrain (cm²)",
        "Pertes / cm²",
        "Nourriture par chasse",
      ],
      lignes: comparaisonChasseurs(parJoueur),
    },
    multiChasses: {
      titres: [
        "Retour",
        "Expéditions",
        "Terrain (cm²)",
        "Pertes",
        "Pertes / cm²",
        "Moyenne",
        "Moyenne + écart-type",
        "Moyenne − écart-type",
      ].concat(
        UNITES.map(function (u) {
          return u.nom;
        }),
      ),
      instants: groupes.map(function (g) {
        return g.instant;
      }),
      lignes: groupes.map(function (g) {
        return [
          libelleMinute(g.minute),
          g.nombre,
          g.terrain,
          g.pertes,
          parCm2(g.pertes, g.terrain),
          moyenne == null ? "" : arrondi(moyenne, 4),
          moyenne == null ? "" : arrondi(moyenne + ecart, 4),
          moyenne == null ? "" : arrondi(moyenne - ecart, 4),
        ].concat(g.unites);
      }),
    },
    chasses: {
      titres: ["Chasse", "Retour", "Terrain (cm²)", "Nourriture"],
      lignes: miennes.map(function (c, i) {
        return [i + 1, libelleMinute(c.minute), c.terrain, c.nourriture];
      }),
    },
    // tous les chasseurs du fichier, toujours dans le même ordre : une couleur chacun
    chasseurs: chasseursDe(tables.chasse),
    autres: autres ? autresChasseurs(parJoueur, moi, periodes, pas) : [],
  };
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
      jour: l.jour,
      minute: l.minute,
      instant: instantDe(l.minute),
      terrain: nombre(l["Terrain conquis (cm²)"]),
      nourriture: nombre(l["Nourriture"]),
      pertes: nombre(l["Fourmis perdues"]),
      unites: unitesDe(l["Troupes en attaque"]),
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
        instant: c.instant,
        dernier: c.instant,
        nombre: 0,
        terrain: 0,
        nourriture: 0,
        pertes: 0,
        unites: UNITES.map(function () {
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
    c.unites.forEach(function (n, i) {
      g.unites[i] += n;
    });
  });
  return groupes;
}

// nombre de chaque unité d'une liste de troupes de RC (« 1 000 Jeunes Soldates Naines, … »)
function unitesDe(texte) {
  var unites = UNITES.map(function () {
    return 0;
  });
  String(texte || "")
    .split(",")
    .forEach(function (morceau) {
      var m = /^\s*(\d[\d\s\u00a0\u202f]*)\s+(.+?)\s*\.?\s*$/.exec(morceau);
      if (!m) return;
      var cle = m[2]
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[’‘]/g, "'")
          .toLowerCase()
          .split(/\s+/)
          .map(function (mot) {
            return mot.length > 3 && /s$/.test(mot) ? mot.slice(0, -1) : mot;
          })
          .join(" "),
        i = UNITES.map(function (u) {
          return u.cle;
        }).indexOf(cle);
      if (i != -1) unites[i] += Number(m[1].replace(/\D/g, ""));
    });
  return unites;
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

// armée de la première et de la dernière multi-chasse de la période
function blocArmee(groupes) {
  var debut = groupes.length ? forcesDe(groupes[0].unites) : null,
    fin = groupes.length ? forcesDe(groupes[groupes.length - 1].unites) : null,
    ligne = function (libelle, cle) {
      var a = debut ? debut[cle] : "",
        b = fin ? fin[cle] : "";
      return [libelle, a, b, debut && a > 0 ? arrondi(((b - a) / a) * 100, 1) : ""];
    };
  return {
    titres: [
      "Armée (hors bonus)",
      "Première multi-chasse",
      "Dernière multi-chasse",
      "Variation (%)",
    ],
    lignes: [
      ligne("Unités (capacité de flood)", "unites"),
      ligne("FdF", "att"),
      ligne("Défense", "def"),
      ligne("Vie", "vie"),
    ],
  };
}

// chasseurs du fichier (colonne « Exporté par » de « BDD chasse »), triés
function chasseursDe(table) {
  return joueursDesTables({ chasse: table });
}

// chiffres de chaque chasseur de la période, du plus grand terrain chassé au plus petit
function comparaisonChasseurs(parJoueur) {
  return Object.keys(parJoueur)
    .map(function (k) {
      var c = parJoueur[k].chasses,
        somme = function (champ) {
          return c.reduce(function (a, x) {
            return a + x[champ];
          }, 0);
        },
        terrain = somme("terrain");
      return [
        parJoueur[k].joueur,
        c.length,
        multiChasses(c).length,
        terrain,
        terrain > 0 ? arrondi(somme("pertes") / terrain, 4) : "",
        c.length ? Math.round(somme("nourriture") / c.length) : "",
      ];
    })
    .sort(function (a, b) {
      return b[3] - a[3] || (a[0].toLowerCase() < b[0].toLowerCase() ? -1 : 1);
    });
}

// courbes des autres chasseurs de la période : pertes par cm² de chaque
// multi-chasse, terrain chassé par période, nourriture de chaque chasse
function autresChasseurs(parJoueur, moi, periodes, pas) {
  return Object.keys(parJoueur)
    .sort()
    .filter(function (k) {
      return k != moi;
    })
    .map(function (k) {
      var chasses = parJoueur[k].chasses,
        terrain = {};
      chasses.forEach(function (c) {
        var cle = clePeriode(c.jour, pas);
        terrain[cle] = (terrain[cle] || 0) + c.terrain;
      });
      return {
        joueur: parJoueur[k].joueur,
        multiChasses: multiChasses(chasses)
          .filter(function (g) {
            return g.terrain > 0;
          })
          .map(function (g) {
            return [g.instant, arrondi(g.pertes / g.terrain, 4)];
          }),
        terrain: periodes.map(function (p) {
          return terrain[p.cle] || 0;
        }),
        nourriture: chasses.map(function (c) {
          return c.nourriture;
        }),
      };
    });
}

// droite des moindres carrés : valeur ajustée de chaque période, arrondie
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
    // « || 0 » : pas de « -0 »
    return Math.round(my + (sxx ? sxy / sxx : 0) * (x - mx)) || 0;
  });
}

function arrondi(v, decimales) {
  var f = Math.pow(10, decimales);
  return Math.round(v * f) / f;
}

// "AAAA-MM-JJ HH:mm" lu comme UTC : écarts exacts et heure du fichier sur un axe de dates
function instantDe(minute) {
  var m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/.exec(minute) || [];
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
}

function libelleMinute(minute) {
  return minute.slice(8, 10) + "/" + minute.slice(5, 7) + " " + minute.slice(11, 16);
}

// lignes d'un onglet datées de la période, en objets {titre: valeur, jour}
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
    var l = { jour: jour, minute: minute };
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

function pasEvolution(debut, fin) {
  var jours = joursEntre(debut, fin) + 1;
  return jours <= STATS_JOURS_PAR_JOUR
    ? "jour"
    : jours <= STATS_JOURS_PAR_SEMAINE
      ? "semaine"
      : "mois";
}

// période d'un jour : lui-même, le lundi de sa semaine, ou son mois
function clePeriode(jour, pas) {
  if (pas == "jour") return jour;
  if (pas == "mois") return jour.slice(0, 7);
  var d = dateDuJour(jour);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function libellePeriode(cle, pas) {
  var p = cle.split("-");
  if (pas == "mois") return MOIS_COURTS[Number(p[1]) - 1] + " " + p[0];
  return (pas == "semaine" ? "sem. " : "") + p[2] + "/" + p[1];
}

// toutes les périodes, même sans activité : les graphiques gardent l'échelle du temps
function periodesEntre(debut, fin, pas) {
  var liste = [],
    vues = {};
  for (
    var d = dateDuJour(debut);
    d.toISOString().slice(0, 10) <= fin;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    var cle = clePeriode(d.toISOString().slice(0, 10), pas);
    if (vues[cle]) continue;
    vues[cle] = true;
    liste.push({ cle: cle, libelle: libellePeriode(cle, pas) });
  }
  return liste;
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

// requête de l'extension : seules les colonnes utiles des onglets sont lues
function statistiquesDemandees(classeur, d) {
  try {
    return {
      statistiques: statistiques(
        tablesDuFichier(classeur),
        d.joueur,
        d.debut,
        d.fin,
        classeur.getSpreadsheetTimeZone(),
        d.autres === true,
      ),
    };
  } catch (err) {
    return { erreur: "statistiques impossibles : " + (err && err.message ? err.message : err) };
  }
}

// les quatre onglets de données, lus de la même façon pour les deux vues
function tablesDuFichier(classeur) {
  return {
    chasse: lireColonnes(classeur, "BDD chasse", COLONNES_CHASSE),
    attaques: lireColonnes(classeur, "BDD attaques", COLONNES_COMBATS),
    defenses: lireColonnes(classeur, "BDD défenses", COLONNES_COMBATS),
    internes: lireColonnes(classeur, ONGLET_INTERNE, COLONNES_COMBATS),
  };
}

// valeurs de l'onglet jusqu'à sa dernière colonne utile (pas les RC)
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

// joueurs présents dans les onglets, pour la liste de la case « Joueur »
function joueursDesTables(tables) {
  var vus = {};
  [
    [tables.chasse, ["Exporté par"]],
    [tables.attaques, ["Exporté par"]],
    [tables.defenses, ["Exporté par"]],
    [tables.internes, ["Attaquant", "Défenseur"]],
  ].forEach(function (t) {
    var table = t[0];
    if (!table || table.length < 2) return;
    var titres = table[0].map(function (x) {
      return String(x).trim();
    });
    t[1].forEach(function (c) {
      var k = titres.indexOf(c);
      if (k == -1) return;
      for (var i = 1; i < table.length; i++) {
        var nom = String(table[i][k] || "").trim();
        if (nom && !vus[nom.toLowerCase()]) vus[nom.toLowerCase()] = nom;
      }
    });
  });
  return Object.keys(vus)
    .sort()
    .map(function (k) {
      return vus[k];
    });
}

/**
 * Statistiques d'un joueur sur une période, pour l'onglet « Statistiques » :
 * résumé, évolution, classements, armée, chasseurs, multi-chasses et chasses
 * côte à côte. Un
 * seul argument, B3:B6 (joueur, premier et dernier jour, contrôle des
 * données) : une formule sans séparateur d'arguments se lit pareil dans tous
 * les paramètres régionaux (« , » ou « ; »). La case de contrôle change avec
 * les onglets de données : la fonction est recalculée quand ils changent.
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
    tables = tablesDuFichier(classeur),
    jours = [jourDe(p[1], fuseau), jourDe(p[2], fuseau)],
    message = !String(joueur || "").trim()
      ? "Choisis un joueur (case B3)."
      : !jours[0] || !jours[1]
        ? "Indique le premier et le dernier jour (cases B4 et B5)."
        : jours[0] > jours[1]
          ? "Le premier jour est après le dernier."
          : joursEntre(jours[0], jours[1]) > STATS_JOURS_MAX
            ? "Période trop longue : trois ans au plus."
            : "",
    s = message ? null : statistiques(tables, joueur, jours[0], jours[1], fuseau),
    vide = { titres: [], lignes: [] },
    blocs = {
      resume: { titres: ["Indicateur", "Valeur"], lignes: s ? s.resume : [[message, ""]] },
      joueurs: {
        titres: ["Pseudo"],
        lignes: joueursDesTables(tables).map(function (j) {
          return [j];
        }),
      },
    },
    titres = {},
    hauteur = 2,
    sortie = [];
  [
    "evolution",
    "cibles",
    "attaquants",
    "internes",
    "armee",
    "comparaison",
    "multiChasses",
    "chasses",
  ].forEach(function (nom) {
    blocs[nom] = s ? s[nom] : vide;
  });
  // listes plus longues que l'onglet : les plus récentes, titre complété
  BLOCS_STATISTIQUES.forEach(function (b) {
    var lignes = blocs[b.nom].lignes,
      place = LIGNES_STATISTIQUES - 2;
    titres[b.nom] = b.titre;
    if (lignes.length > place) {
      blocs[b.nom] = { titres: blocs[b.nom].titres, lignes: lignes.slice(-place) };
      titres[b.nom] = b.titre + " (les " + place + " dernières lignes)";
    }
  });
  BLOCS_STATISTIQUES.forEach(function (b) {
    hauteur = Math.max(hauteur, 2 + blocs[b.nom].lignes.length);
  });
  var largeur = colonneBloc("joueurs") + 1;
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

// change dès qu'une ligne est ajoutée, retirée ou modifiée dans un onglet de
// données ; « + » et fonctions à un argument : aucun séparateur d'arguments
function formuleControle() {
  return (
    "=" +
    ONGLETS_EXPORT.map(function (nom) {
      var fin = nom == "BDD chasse" ? "F" : "L";
      return "COUNTA('" + nom + "'!A:A)+SUM('" + nom + "'!C:" + fin + ")";
    }).join("+")
  );
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
  // la formule cite les quatre onglets : ils doivent exister, même vides
  ONGLETS_EXPORT.forEach(function (nom) {
    if (!classeur.getSheetByName(nom)) classeur.insertSheet(nom);
  });
  var f = classeur.insertSheet(ONGLET_STATISTIQUES, 0),
    c0 = COLONNE_STATISTIQUES,
    // colonne (à partir de 1) de la k-ième colonne d'un bloc
    colonne = function (bloc, k) {
      return c0 + colonneBloc(bloc) + (k || 0);
    },
    cJoueurs = colonne("joueurs"),
    donnees = LIGNES_STATISTIQUES - 2,
    // libellés du résumé (ils ne dépendent pas des données) : graphiques dessous
    resume = statistiques({}, "?", "2000-01-01", "2000-01-01", "UTC").resume;
  // résultat de STATS_OUAF plus large que les 26 colonnes d'un nouvel onglet
  agrandir(f, LIGNES_STATISTIQUES, cJoueurs);
  f.getRange(1, 1).setValue("Statistiques d'un joueur (Extension OUAF)").setFontWeight("bold");
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
  // contrôle des données (ligne cachée), lu avec les paramètres
  f.getRange(6, 1).setValue("Contrôle");
  f.getRange(6, 2).setFormula(formuleControle());
  f.hideRows(6);
  f.getRange(1, c0).setFormula("=STATS_OUAF(B3:B6)");
  f.getRange(1, c0, 2, cJoueurs - c0 + 1).setFontWeight("bold");
  f.getRange(3, c0 + 1, donnees, cJoueurs - c0).setNumberFormat("#,##0");
  // pertes par cm² : quatre décimales ; variation de l'armée en % : une
  resume.forEach(function (l, i) {
    if (/par cm²/.test(l[0])) f.getRange(3 + i, c0 + 1).setNumberFormat("0.0000");
  });
  [
    [colonne("evolution", 6), 1],
    [colonne("comparaison", 4), 1],
    [colonne("multiChasses", 4), 4],
  ].forEach(function (c) {
    f.getRange(3, c[0], donnees, c[1]).setNumberFormat("0.0000");
  });
  f.getRange(3, colonne("armee", 3), donnees, 1).setNumberFormat("0.0");
  f.setColumnWidth(1, 110);
  f.setColumnWidth(2, 110);
  f.setColumnWidth(c0, 260);
  f.hideColumns(cJoueurs);
  // titres en ligne 2, valeurs dessous ; première plage : l'axe horizontal
  var plage = function (bloc, k, n) {
      return f.getRange(
        2,
        colonne(bloc, k),
        bloc == "evolution" ? STATS_JOURS_PAR_JOUR + 2 : LIGNES_STATISTIQUES - 1,
        n || 1,
      );
    },
    premiere = resume.length + 5;
  [
    {
      type: Charts.ChartType.LINE,
      titre: "Terrain chassé (cm²) et sa tendance",
      plages: [plage("evolution", 0), plage("evolution", 1), plage("evolution", 7)],
      options: { series: { 1: { lineDashStyle: [6, 4] } } },
    },
    {
      type: Charts.ChartType.LINE,
      titre: "Pertes par cm² de chaque multi-chasse (moyenne ± écart-type)",
      plages: [plage("multiChasses", 0), plage("multiChasses", 4, 4)],
    },
    {
      type: Charts.ChartType.AREA,
      titre: "Armée envoyée en multi-chasse (unités, hors bonus)",
      plages: [plage("multiChasses", 0), plage("multiChasses", 8, UNITES.length)],
      options: { isStacked: true },
    },
    {
      type: Charts.ChartType.LINE,
      titre: "Nourriture rapportée par chasse",
      plages: [plage("chasses", 1), plage("chasses", 3)],
      options: { legend: { position: "none" } },
    },
    {
      type: Charts.ChartType.COLUMN,
      titre: "Terrain gagné ou perdu (cm²)",
      plages: [plage("evolution", 0), plage("evolution", 1, 4)],
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
