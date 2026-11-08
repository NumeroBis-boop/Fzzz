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
 * Après une modification de ce code : Déployer → Gérer les déploiements →
 * modifier → Nouvelle version (l'adresse ne change pas).
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

function doGet() {
  return reponseJson({ ok: true, fichier: SpreadsheetApp.getActiveSpreadsheet().getName() });
}

function doPost(e) {
  var d;
  try {
    d = JSON.parse(e.postData.contents);
  } catch (err) {
    return reponseJson({ erreur: "requête illisible" });
  }
  if (!d || !(d.verifier ? verificationValide(d) : ajoutValide(d)))
    return reponseJson({ erreur: "requête invalide" });
  // deux joueurs qui exportent en même temps : l'un après l'autre
  var verrou = LockService.getScriptLock();
  verrou.waitLock(30000);
  try {
    var classeur = SpreadsheetApp.getActiveSpreadsheet(),
      reponse = d.verifier ? clesAbsentes(classeur, d.onglets, d.cles) : ajouter(classeur, d);
    return reponseJson(reponse);
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
