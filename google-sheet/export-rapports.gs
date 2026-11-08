/*
 * Script du Google Sheet de l'alliance (Apps Script) : reçoit les rapports
 * exportés par l'extension (boutons « Exporter mes chasses » et « Exporter mes
 * RC » de la messagerie) et les ajoute à leur onglet, sans doublon : une ligne
 * dont la « Clé » est déjà dans l'onglet n'est pas ajoutée.
 *
 * Installation, par le propriétaire du fichier :
 *  1. Extensions → Apps Script ; remplacer le contenu de Code.gs par ce fichier.
 *  2. Déployer → Nouveau déploiement → type « Application Web » ;
 *     « Exécuter en tant que : moi », « Qui a accès : Tout le monde ».
 *  3. Autoriser, puis copier l'adresse de l'application (…/exec) et la coller
 *     une fois dans l'extension (Préférences → Messagerie → « Enregistrer pour
 *     l'alliance ») : elle est rangée dans le forum caché et l'extension de
 *     chaque membre la lit toute seule.
 * Après une modification de ce code : Déployer → Gérer les déploiements →
 * modifier → Nouvelle version (l'adresse ne change pas).
 *
 * Le fichier doit rester réservé à l'alliance : publier des RC est interdit
 * par le règlement du s5.
 */

// onglets que l'extension peut remplir
var ONGLETS_EXPORT = ["BDD chasse", "BDD attaques", "BDD défenses"];

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
  if (
    !d ||
    ONGLETS_EXPORT.indexOf(d.onglet) == -1 ||
    !Array.isArray(d.entetes) ||
    d.entetes[0] != "Clé" ||
    !Array.isArray(d.lignes)
  )
    return reponseJson({ erreur: "requête invalide" });
  // deux joueurs qui exportent en même temps : l'un après l'autre
  var verrou = LockService.getScriptLock();
  verrou.waitLock(30000);
  try {
    return reponseJson(
      ajouterLignes(SpreadsheetApp.getActiveSpreadsheet(), d.onglet, d.entetes, d.lignes)
    );
  } finally {
    verrou.releaseLock();
  }
}

/**
 * Ajoute à l'onglet `nom` (créé au besoin, avec ses titres) les lignes dont la
 * clé (première valeur) n'y est pas encore. Une colonne inconnue de l'onglet
 * est ajoutée à la fin ; les colonnes ajoutées à la main sont laissées vides.
 */
function ajouterLignes(classeur, nom, entetes, lignes) {
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
    feuille
      .getRange(1, titres.indexOf(t) + 1)
      .setValue(t)
      .setFontWeight("bold");
  });
  var colonneCle = titres.indexOf("Clé"),
    derniere = feuille.getLastRow(),
    cles = {};
  if (derniere > 1)
    feuille
      .getRange(2, colonneCle + 1, derniere - 1, 1)
      .getValues()
      .forEach(function (r) {
        cles[String(r[0])] = true;
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
  if (nouvelles.length)
    feuille.getRange(derniere + 1, 1, nouvelles.length, titres.length).setValues(nouvelles);
  return { ajoutees: nouvelles.length, deja: lignes.length - nouvelles.length };
}

// un texte qui commence par = + - @ reste du texte (pas une formule)
function valeurCellule(v) {
  if (v === null || v === undefined) return "";
  if (typeof v == "string" && /^[=+\-@]/.test(v)) return "'" + v;
  return v;
}

function reponseJson(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(
    ContentService.MimeType.JSON
  );
}
