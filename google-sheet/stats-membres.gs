/*
 * Script du Google Sheet « Stats membres » de l'alliance (Apps Script) : reçoit
 * le relevé que l'extension fait pour chaque joueur (Préférences → Partage de
 * données) et le range dans l'onglet « Dernier relevé » : une ligne par joueur,
 * son relevé le plus récent, dont la date dit de quand datent ses valeurs. Pas
 * d'historique (règle du mainteneur) : un onglet « Suivi » créé par une version
 * précédente n'est plus écrit et peut être supprimé à la main.
 * Le fond d'une case dit si le joueur partage cette information : vert, il la
 * partage ; rouge, il a décoché sa case (la case garde la dernière valeur lue
 * avant, ou reste vide s'il ne l'a jamais partagée).
 *
 * Installation, par le propriétaire du fichier :
 *  1. Dans le fichier : Extensions → Apps Script ; remplacer le contenu de
 *     Code.gs par ce fichier.
 *  2. Déployer → Nouveau déploiement → type « Application Web » ;
 *     « Exécuter en tant que : moi », « Qui a accès : Tout le monde ».
 *  3. Autoriser, puis copier l'adresse de l'application (…/exec) et la poster
 *     dans le forum de l'alliance, section « BDD partagée cachée », dans le
 *     premier message d'un sujet « Stats membres » : l'extension de chaque
 *     membre la lit toute seule. Pas de réponse dans ce sujet : elle
 *     empêcherait de modifier le message.
 * Après une modification de ce code : Enregistrer, puis Déployer → Gérer les
 * déploiements → modifier → Version : Nouvelle version (l'adresse ne change
 * pas). L'adresse ouverte dans le navigateur montre alors la nouvelle
 * « version », et crée l'onglet s'il manque.
 *
 * Les colonnes se repèrent par leur titre : elles peuvent être déplacées, et
 * d'autres ajoutées à la main. Un joueur se retrouve par son pseudo : les
 * lignes peuvent être triées.
 */

var ONGLET = "Dernier relevé";
var COLONNE_JOUEUR = "Joueur";
var COLONNE_DATE = "Date";
var COLONNE_VERSION = "Version";
// informations relevées : clé envoyée par l'extension (DONNEES_PARTAGEES de
// public/js/class/SuiviMembres.js), titre de sa colonne
var DONNEES = [
  ["tdp", "TdP"],
  ["cdf", "CdF"],
  ["fdfHB", "FdF HB"],
  ["fdfAB", "FdF AB"],
  ["va", "VA"],
  ["vc", "VC"],
  ["puceron", "Puceron"],
  ["champignonniere", "Champignonnière"],
];
var COULEUR_PARTAGE = "#d9ead3";
var COULEUR_REFUS = "#f4cccc";
var LEGENDE = [
  ["partagé", COULEUR_PARTAGE],
  ["non partagé", COULEUR_REFUS],
];
// l'heure du jeu et celle de Google peuvent différer autour de minuit
var JOURS_ECART_MAX = 1;
var VALEUR_MAX = 1e15;

// rendue par doGet : ouvrir l'adresse du script dans le navigateur montre le code déployé
var VERSION_SCRIPT = "stats-membres 2026-11-12.3";

function doGet() {
  var classeur = SpreadsheetApp.getActiveSpreadsheet();
  avecVerrou(function () {
    preparer(classeur);
  });
  return reponseJson({
    ok: true,
    fichier: classeur.getName(),
    version: VERSION_SCRIPT,
    suivi: true,
  });
}

function doPost(e) {
  var d;
  try {
    d = JSON.parse(e.postData.contents);
  } catch (err) {
    return reponseJson({ erreur: "requête illisible" });
  }
  var classeur = SpreadsheetApp.getActiveSpreadsheet(),
    refus =
      d && d.suivi && typeof d.suivi == "object"
        ? refusDuReleve(d.suivi, classeur.getSpreadsheetTimeZone())
        : "requête invalide";
  if (refus) return reponseJson({ erreur: refus });
  // deux joueurs qui envoient en même temps : l'un après l'autre
  return reponseJson(
    avecVerrou(function () {
      return enregistrer(classeur, d.suivi);
    }),
  );
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

function reponseJson(o) {
  var sortie = ContentService.createTextOutput(JSON.stringify(o));
  return sortie.setMimeType(ContentService.MimeType.JSON);
}

/**
 * Pourquoi un relevé est refusé, ou "" : {joueur, jour "AAAA-MM-JJ", donnees
 * {clé: nombre}, partages {clé: vrai ou faux}, version}.
 */
function refusDuReleve(s, fuseau) {
  if (
    typeof s.joueur != "string" ||
    s.joueur != s.joueur.trim() ||
    !/^[^<>&"'|;\\\/\x00-\x1f]{1,30}$/.test(s.joueur)
  )
    return "pseudo invalide";
  if (typeof s.jour != "string" || !jourValide(s.jour)) return "jour invalide";
  var aujourdhui = Utilities.formatDate(new Date(), fuseau, "yyyy-MM-dd");
  if (Math.abs(instantDuJour(s.jour) - instantDuJour(aujourdhui)) > JOURS_ECART_MAX * 86400000)
    return "jour trop éloigné d'aujourd'hui";
  if (s.version != null && !/^[\w.-]{1,30}$/.test(String(s.version))) return "version invalide";
  var donnees = s.donnees == null ? {} : s.donnees,
    partages = s.partages == null ? {} : s.partages;
  if (typeof donnees != "object" || typeof partages != "object") return "informations invalides";
  for (var i = 0; i < DONNEES.length; i++) {
    var v = donnees[DONNEES[i][0]],
      p = partages[DONNEES[i][0]];
    if (v != null && !(typeof v == "number" && isFinite(v) && v >= 0 && v <= VALEUR_MAX))
      return "valeur invalide : " + DONNEES[i][1];
    if (p != null && typeof p != "boolean") return "partage invalide : " + DONNEES[i][1];
  }
  return "";
}

function jourValide(jour) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(jour);
  if (!m) return false;
  var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() == +m[1] && d.getUTCMonth() == +m[2] - 1 && d.getUTCDate() == +m[3];
}

function instantDuJour(jour) {
  var p = jour.split("-");
  return Date.UTC(+p[0], +p[1] - 1, +p[2]);
}

/** L'onglet des relevés, créé s'il manque : titres, formats et légende des couleurs. */
function preparer(classeur) {
  var feuille = classeur.getSheetByName(ONGLET);
  if (feuille) return feuille;
  feuille = classeur.insertSheet(ONGLET, 0);
  var titres = [COLONNE_JOUEUR, COLONNE_DATE].concat(
      DONNEES.map(function (d) {
        return d[1];
      }),
      [COLONNE_VERSION],
    ),
    lignes = feuille.getMaxRows() - 1;
  feuille.getRange(1, 1, 1, titres.length).setValues([titres]).setFontWeight("bold");
  feuille.setFrozenRows(1);
  feuille.getRange(2, titres.indexOf(COLONNE_DATE) + 1, lignes, 1).setNumberFormat("dd/MM/yyyy");
  feuille.getRange(2, 3, lignes, DONNEES.length).setNumberFormat("#,##0");
  LEGENDE.forEach(function (l, i) {
    feuille
      .getRange(1, titres.length + 2 + i)
      .setValue(l[0])
      .setBackground(l[1]);
  });
  return feuille;
}

/**
 * Range un relevé dans la ligne du joueur : remplacée si le relevé n'est pas
 * plus ancien que le sien, ajoutée s'il n'en a pas. Une information que le
 * joueur ne partage pas garde sa dernière valeur lue, celle de sa ligne, sur
 * fond rouge.
 */
function enregistrer(classeur, s) {
  var feuille = preparer(classeur),
    fuseau = classeur.getSpreadsheetTimeZone(),
    joueur = s.joueur,
    valeurs = {},
    fonds = {},
    refusees = [],
    donnees = s.donnees || {},
    partages = s.partages || {};
  // dans l'ordre des titres : un titre absent de l'onglet y est ajouté dans cet ordre
  valeurs[COLONNE_JOUEUR] = valeurCellule(joueur);
  valeurs[COLONNE_DATE] = Utilities.parseDate(s.jour, fuseau, "yyyy-MM-dd");
  DONNEES.forEach(function (d) {
    var refuse = partages[d[0]] === false,
      v = refuse ? null : donnees[d[0]];
    valeurs[d[1]] = v == null ? "" : v;
    if (refuse) refusees.push(d[1]);
    // sans valeur ni refus (page du jeu illisible ce jour-là) : pas de couleur
    fonds[d[1]] = refuse ? COULEUR_REFUS : v == null ? null : COULEUR_PARTAGE;
  });
  valeurs[COLONNE_VERSION] = s.version == null ? "" : String(s.version);
  var sort = ecrireLigne(
    feuille,
    valeurs,
    fonds,
    function (l) {
      if (cleJoueur(l[COLONNE_JOUEUR]) != cleJoueur(joueur)) return "";
      return jourCellule(l[COLONNE_DATE], fuseau) > s.jour ? "garder" : "remplacer";
    },
    function (remplacee) {
      refusees.forEach(function (t) {
        if (remplacee) valeurs[t] = valeurCellule(remplacee[t]);
      });
    },
  );
  return { ok: true, nouveau: sort == "ajoutée", dernier: sort != "gardée" };
}

function cleJoueur(v) {
  return String(v == null ? "" : v)
    .replace(/^'/, "")
    .trim()
    .toLowerCase();
}

/** Jour "AAAA-MM-JJ" d'une case : date, numéro de série, ou jour tapé à la main. */
function jourCellule(v, fuseau) {
  if (Object.prototype.toString.call(v) == "[object Date]")
    return isNaN(v.getTime()) ? "" : Utilities.formatDate(v, fuseau, "yyyy-MM-dd");
  if (typeof v == "number" && v > 0)
    return new Date(Date.UTC(1899, 11, 30) + Math.round(v * 86400000)).toISOString().slice(0, 10);
  var t = String(v == null ? "" : v).trim(),
    fr = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (fr) return fr[3] + "-" + ("0" + fr[2]).slice(-2) + "-" + ("0" + fr[1]).slice(-2);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : "";
}

/**
 * Écrit `valeurs` (par titre de colonne) dans la première ligne que `choisir`
 * désigne ("remplacer"), sinon dans une nouvelle ligne ; "garder" : rien n'est
 * écrit. Seules les colonnes de `valeurs` sont touchées. `completer(remplacee)`
 * peut changer `valeurs` d'après la ligne qui va être remplacée (par titre ;
 * null pour une nouvelle ligne).
 *
 * @return {String} "remplacée", "ajoutée" ou "gardée"
 */
function ecrireLigne(feuille, valeurs, fonds, choisir, completer) {
  var titres = Object.keys(valeurs),
    colonnes = colonnesDe(feuille, titres),
    derniere = feuille.getLastRow(),
    ligne = 0,
    sort = "ajoutée",
    remplacee = null;
  if (derniere > 1) {
    var lues = feuille.getRange(2, 1, derniere - 1, feuille.getLastColumn()).getValues();
    for (var i = 0; i < lues.length && !ligne; i++) {
      var l = {};
      titres.forEach(function (t) {
        l[t] = lues[i][colonnes[t] - 1];
      });
      var choix = choisir(l);
      if (choix == "garder") return "gardée";
      if (choix == "remplacer") {
        ligne = i + 2;
        sort = "remplacée";
        remplacee = l;
      }
    }
  }
  completer(remplacee);
  if (!ligne) {
    ligne = Math.max(derniere, 1) + 1;
    if (ligne > feuille.getMaxRows())
      feuille.insertRowsAfter(feuille.getMaxRows(), ligne - feuille.getMaxRows());
  }
  // colonnes voisines écrites ensemble ; le fond des colonnes sans couleur
  // (joueur, date, version) n'est pas touché : il peut avoir été mis à la main
  blocsDeColonnes(titres, colonnes, fonds).forEach(function (bloc) {
    var plage = feuille.getRange(ligne, colonnes[bloc[0]], 1, bloc.length);
    plage.setValues([
      bloc.map(function (t) {
        return valeurs[t];
      }),
    ]);
    if (bloc[0] in fonds)
      plage.setBackgrounds([
        bloc.map(function (t) {
          return fonds[t];
        }),
      ]);
  });
  return sort;
}

/**
 * Titres rangés par colonne, découpés en suites de colonnes voisines qui ont
 * toutes une couleur de fond à écrire, ou toutes aucune.
 */
function blocsDeColonnes(titres, colonnes, fonds) {
  var tries = titres.slice().sort(function (a, b) {
      return colonnes[a] - colonnes[b];
    }),
    blocs = [];
  tries.forEach(function (t, i) {
    var avant = tries[i - 1];
    if (i && colonnes[t] == colonnes[avant] + 1 && t in fonds == avant in fonds)
      blocs[blocs.length - 1].push(t);
    else blocs.push([t]);
  });
  return blocs;
}

/**
 * Colonne (à partir de 1) de chaque titre, lue dans la première ligne ; un
 * titre absent (colonne supprimée, nouvelle information) est ajouté au bout.
 */
function colonnesDe(feuille, titres) {
  var largeur = Math.max(feuille.getLastColumn(), 1),
    lus = feuille.getRange(1, 1, 1, largeur).getValues()[0],
    colonnes = {};
  lus.forEach(function (t, i) {
    var titre = String(t == null ? "" : t).trim();
    if (titre && !colonnes[titre]) colonnes[titre] = i + 1;
  });
  titres.forEach(function (t) {
    if (colonnes[t]) return;
    largeur = Math.max(largeur, feuille.getLastColumn()) + 1;
    if (largeur > feuille.getMaxColumns())
      feuille.insertColumnsAfter(feuille.getMaxColumns(), largeur - feuille.getMaxColumns());
    feuille.getRange(1, largeur).setValue(t).setFontWeight("bold");
    colonnes[t] = largeur;
  });
  return colonnes;
}

/** Texte écrit par un joueur : jamais lu comme une formule. */
function valeurCellule(v) {
  if (v === null || v === undefined) return "";
  if (typeof v == "string" && /^[=+\-@]/.test(v)) return "'" + v;
  return v;
}
