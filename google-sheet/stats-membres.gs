/*
 * Script du Google Sheet « Stats membres » de l'alliance (Apps Script) : reçoit
 * le relevé que l'extension fait pour chaque joueur (Préférences → Partage de
 * données) et le range dans l'onglet « Dernier relevé » : une ligne par joueur,
 * son relevé le plus récent, dont la date et l'heure disent de quand datent ses
 * valeurs. Pas d'historique (règle du mainteneur) : un onglet « Suivi » créé
 * par une version précédente n'est plus écrit et peut être supprimé à la main.
 * Le fond d'une case dit si le joueur partage cette information avec les
 * chefs : vert, il la partage ; rouge, il a décoché sa case (la case garde la
 * dernière valeur lue avant, ou reste vide s'il ne l'a jamais partagée). La
 * colonne « Partagé avec les autres » liste celles qu'il partage aussi avec
 * les autres membres.
 *
 * Installation, par le propriétaire du fichier :
 *  1. Dans le fichier : Extensions → Apps Script ; remplacer le contenu de
 *     Code.gs par ce fichier.
 *  2. Déployer → Nouveau déploiement → type « Application Web » ;
 *     « Exécuter en tant que : moi », « Qui a accès : Tout le monde ».
 *  3. Autoriser, puis copier l'adresse de l'application (…/exec) et l'écrire
 *     dans le forum de l'alliance, section « BDD partagée cachée », sujet
 *     « Réglages de l'extension », à la ligne « Google Sheet des stats
 *     membres : … » de son premier message : l'extension de chaque membre la
 *     lit toute seule (Préférences → Partage de données, section
 *     « Fonctionnement sur les autres serveurs »).
 * Après une modification de ce code : Enregistrer, puis Déployer → Gérer les
 * déploiements → modifier → Version : Nouvelle version (l'adresse ne change
 * pas). L'adresse ouverte dans le navigateur montre alors la nouvelle
 * « version », et crée l'onglet s'il manque.
 *
 * Les colonnes se repèrent par leur titre : elles peuvent être déplacées, et
 * d'autres ajoutées à la main. Une colonne qui manque (nouvelle information
 * relevée par l'extension) est insérée après celle qui la précède dans la
 * liste. Un joueur se retrouve par son pseudo : les lignes peuvent être
 * triées.
 *
 * L'extension lit aussi le niveau de champignonnière des colonies d'un
 * seigneur (requête « niveaux », sans écriture), pour calculer ce qu'il pille,
 * et l'onglet pour la vue « Stats membres » du menu Alliance, sans écriture :
 * tout pour un chef (requête « releves »), une information sur fond rouge (non
 * partagée) n'y étant pas rendue ; pour les autres membres (requête
 * « relevesPublics »), seulement les joueurs qui partagent au moins une
 * information avec les autres, et ces informations-là.
 *
 * Il reçoit aussi le journal de débug de l'extension d'un joueur, les jours où
 * il contient une erreur (requête « journal ») : une ligne par note dans
 * l'onglet « Journal », créé au premier envoi, jamais vidé (règle du
 * mainteneur) ; une note déjà reçue (même joueur, instant, niveau et source)
 * n'est pas recopiée. Quand le fichier approche de la limite de cellules de
 * Google Sheets, le journal n'est plus écrit (les relevés le sont toujours) :
 * supprimer alors d'anciennes lignes de « Journal ».
 */

var ONGLET = "Dernier relevé";
var COLONNE_JOUEUR = "Joueur";
var COLONNE_DATE = "Date";
var COLONNE_VERSION = "Version";
// informations aussi partagées avec les autres membres : leurs titres, séparés par « , »
var COLONNE_AUTRES = "Partagé avec les autres";
var FORMAT_DATE = "dd/MM/yyyy HH:mm";
// l'extension date ses relevés à l'heure du jeu, celle de Paris
var FUSEAU_JEU = "Europe/Paris";
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
  ["ouvrieres", "Ouvrières"],
];
var FORMAT_NOMBRE = "#,##0";
var COULEUR_PARTAGE = "#d9ead3";
var COULEUR_REFUS = "#f4cccc";
var LEGENDE = [
  ["partagé", COULEUR_PARTAGE],
  ["non partagé", COULEUR_REFUS],
];
// l'heure du jeu et celle de Google peuvent différer autour de minuit
var JOURS_ECART_MAX = 1;
// requête « niveaux » : les colonies d'un seigneur, quelques joueurs
var JOUEURS_LUS_MAX = 50;
var VALEUR_MAX = 1e15;
// journal de débug envoyé par l'extension (EnvoiJournal) : une ligne par note
var ONGLET_JOURNAL = "Journal";
var TITRES_JOURNAL = [
  "Reçu le",
  "Joueur",
  "Serveur",
  "Appareil",
  "Note du",
  "Niveau",
  "Source",
  "Page",
  "Version",
  "Répétitions",
  "Message",
  "Détail",
  "Clé",
];
// niveaux des notes : NIVEAUX_JOURNAL de public/js/class/Journal.js
var NIVEAUX_JOURNAL = { erreur: "ERREUR", alerte: "ALERTE", succes: "OK", info: "INFO" };
// l'extension garde 200 notes ; textes un peu plus longs que les siens
var NOTES_JOURNAL_MAX = 200;
var LONGUEURS_JOURNAL = {
  source: 100,
  message: 2000,
  detail: 5000,
  page: 200,
  version: 40,
};
var FORMAT_INSTANT = "dd/MM/yyyy HH:mm:ss";
var TITRES_NON_TEXTE_JOURNAL = ["Reçu le", "Note du", "Répétitions"];
// Google Sheets refuse au-delà de 10 millions de cellules par fichier : de quoi garder les relevés
var LIMITE_CELLULES_JOURNAL = 9000000;

// rendue par doGet : ouvrir l'adresse du script dans le navigateur montre le code déployé
var VERSION_SCRIPT = "stats-membres 2026-11-20.1";

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
    niveaux: true,
    releves: true,
    relevesPublics: true,
    journal: true,
  });
}

function doPost(e) {
  var d;
  try {
    d = JSON.parse(e.postData.contents);
  } catch (err) {
    return reponseJson({ erreur: "requête illisible" });
  }
  var classeur = SpreadsheetApp.getActiveSpreadsheet();
  if (d && d.releves === true) return reponseJson(lireReleves(classeur, false));
  if (d && d.relevesPublics === true) return reponseJson(lireReleves(classeur, true));
  if (d && d.niveaux && typeof d.niveaux == "object") {
    var joueurs = d.niveaux.joueurs;
    if (
      !Array.isArray(joueurs) ||
      joueurs.length > JOUEURS_LUS_MAX ||
      joueurs.some(function (j) {
        return typeof j != "string" || !j.trim() || j.length > 40;
      })
    )
      return reponseJson({ erreur: "joueurs invalides" });
    return reponseJson(lireNiveaux(classeur, joueurs));
  }
  if (d && d.journal && typeof d.journal == "object") {
    var refusJournal = refusDuJournal(d.journal);
    if (refusJournal) return reponseJson({ erreur: refusJournal });
    return reponseJson(
      avecVerrou(function () {
        return enregistrerJournal(classeur, d.journal);
      }),
    );
  }
  var refus =
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

/**
 * Niveau de champignonnière de chaque joueur demandé, d'après sa ligne de
 * « Dernier relevé » : {pseudo demandé: {champignonniere: nombre ou null,
 * jour: "AAAA-MM-JJ"}}, rien pour un joueur sans ligne. Lecture seule.
 */
function lireNiveaux(classeur, joueurs) {
  var feuille = classeur.getSheetByName(ONGLET),
    niveaux = {};
  if (!feuille || feuille.getLastRow() < 2) return { ok: true, niveaux: niveaux };
  var lignes = feuille
      .getRange(1, 1, feuille.getLastRow(), Math.max(feuille.getLastColumn(), 1))
      .getValues(),
    colonnes = {},
    voulus = {},
    fuseau = classeur.getSpreadsheetTimeZone();
  lignes[0].forEach(function (t, i) {
    var titre = String(t == null ? "" : t).trim();
    if (titre && colonnes[titre] === undefined) colonnes[titre] = i;
  });
  if (colonnes[COLONNE_JOUEUR] === undefined) return { ok: true, niveaux: niveaux };
  joueurs.forEach(function (j) {
    voulus[cleJoueur(j)] = j;
  });
  lignes.slice(1).forEach(function (l) {
    var demande = voulus[cleJoueur(l[colonnes[COLONNE_JOUEUR]])];
    if (demande === undefined) return;
    var brut = colonnes["Champignonnière"] === undefined ? "" : l[colonnes["Champignonnière"]],
      chiffres = String(brut == null ? "" : brut).replace(/[^\d]/g, "");
    niveaux[demande] = {
      champignonniere: chiffres === "" ? null : Number(chiffres),
      jour:
        colonnes[COLONNE_DATE] === undefined ? "" : jourCellule(l[colonnes[COLONNE_DATE]], fuseau),
    };
  });
  return { ok: true, niveaux: niveaux };
}

/**
 * Dernier relevé de chaque joueur de « Dernier relevé », pour la vue « Stats
 * membres » : [{joueur, date "AAAA-MM-JJ HH:mm" (ou "AAAA-MM-JJ" d'une ligne
 * sans heure), valeurs {clé: nombre ou null}, partages {clé: vrai, faux ou
 * null}}]. Une information sur fond rouge (décochée par le joueur) est rendue
 * sans sa valeur, que la case garde pour le fichier seulement. Avec `publics`
 * (membre qui n'est pas chef) : seulement les informations de la colonne
 * « Partagé avec les autres », les autres rendues non partagées, et seulement
 * les joueurs qui en partagent au moins une. Lecture seule.
 */
function lireReleves(classeur, publics) {
  var feuille = classeur.getSheetByName(ONGLET),
    releves = [];
  if (!feuille || feuille.getLastRow() < 2) return { ok: true, releves: releves };
  var plage = feuille.getRange(1, 1, feuille.getLastRow(), Math.max(feuille.getLastColumn(), 1)),
    lignes = plage.getValues(),
    fonds = plage.getBackgrounds(),
    colonnes = {},
    fuseau = classeur.getSpreadsheetTimeZone();
  lignes[0].forEach(function (t, i) {
    var titre = String(t == null ? "" : t).trim();
    if (titre && colonnes[titre] === undefined) colonnes[titre] = i;
  });
  if (colonnes[COLONNE_JOUEUR] === undefined) return { ok: true, releves: releves };
  lignes.slice(1).forEach(function (l, n) {
    var joueur = String(l[colonnes[COLONNE_JOUEUR]] == null ? "" : l[colonnes[COLONNE_JOUEUR]])
      .replace(/^'/, "")
      .trim();
    if (!joueur) return;
    var releve = {
        joueur: joueur,
        date:
          colonnes[COLONNE_DATE] === undefined
            ? ""
            : dateCellule(l[colonnes[COLONNE_DATE]], fuseau),
        valeurs: {},
        partages: {},
      },
      autres =
        colonnes[COLONNE_AUTRES] === undefined ? [] : titresAutres(l[colonnes[COLONNE_AUTRES]]);
    DONNEES.forEach(function (d) {
      var c = colonnes[d[1]];
      if (c === undefined) {
        releve.valeurs[d[0]] = null;
        releve.partages[d[0]] = publics ? false : null;
        return;
      }
      var fond = String(fonds[n + 1][c] || "").toLowerCase(),
        partage = fond == COULEUR_REFUS ? false : fond == COULEUR_PARTAGE ? true : null;
      // partagée avec les autres : listée dans leur colonne, et pas décochée pour les chefs
      if (publics) partage = partage !== false && autres.indexOf(d[1]) >= 0;
      releve.partages[d[0]] = partage;
      releve.valeurs[d[0]] = partage === false ? null : nombreCellule(l[c]);
    });
    if (
      publics &&
      !DONNEES.some(function (d) {
        return releve.partages[d[0]] === true;
      })
    )
      return;
    releves.push(releve);
  });
  return { ok: true, releves: releves };
}

/** Titres de la colonne « Partagé avec les autres » : « TdP, CdF » → ["TdP", "CdF"]. */
function titresAutres(v) {
  return String(v == null ? "" : v)
    .split(",")
    .map(function (t) {
      return t.trim();
    })
    .filter(function (t) {
      return t;
    });
}

/** Nombre d'une case : nombre, ou chiffres d'un texte tapé à la main ; null si vide. */
function nombreCellule(v) {
  if (typeof v == "number") return isFinite(v) ? v : null;
  var chiffres = String(v == null ? "" : v).replace(/[^\d]/g, "");
  return chiffres === "" ? null : Number(chiffres);
}

/** Date et heure d'une case, à l'heure du fichier : "AAAA-MM-JJ HH:mm", ou le jour seul. */
function dateCellule(v, fuseau) {
  if (Object.prototype.toString.call(v) == "[object Date]")
    return isNaN(v.getTime()) ? "" : Utilities.formatDate(v, fuseau, "yyyy-MM-dd HH:mm");
  return jourCellule(v, fuseau);
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
 * {clé: nombre}, partages {clé: vrai ou faux} (avec les chefs), publics {clé:
 * vrai ou faux} (avec les autres membres ; absent d'une extension d'avant), version}.
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
    partages = s.partages == null ? {} : s.partages,
    publics = s.publics == null ? {} : s.publics;
  if (typeof donnees != "object" || typeof partages != "object" || typeof publics != "object")
    return "informations invalides";
  for (var i = 0; i < DONNEES.length; i++) {
    var v = donnees[DONNEES[i][0]],
      p = partages[DONNEES[i][0]],
      a = publics[DONNEES[i][0]];
    if (v != null && !(typeof v == "number" && isFinite(v) && v >= 0 && v <= VALEUR_MAX))
      return "valeur invalide : " + DONNEES[i][1];
    if (p != null && typeof p != "boolean") return "partage invalide : " + DONNEES[i][1];
    if (a != null && typeof a != "boolean") return "partage invalide : " + DONNEES[i][1];
  }
  return "";
}

/**
 * Valeur de la colonne « Date » : le jour du relevé, à l'heure du jeu où il est
 * reçu. Reçu un autre jour que le sien (autour de minuit), il est daté du bord
 * le plus proche de son jour.
 */
function dateDuReleve(jour, fuseau) {
  var recu = new Date(),
    jourRecu = Utilities.formatDate(recu, FUSEAU_JEU, "yyyy-MM-dd"),
    heure =
      jourRecu == jour
        ? Utilities.formatDate(recu, FUSEAU_JEU, "HH:mm:ss")
        : jourRecu > jour
          ? "23:59:59"
          : "00:00:00";
  return Utilities.parseDate(jour + " " + heure, fuseau, "yyyy-MM-dd HH:mm:ss");
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
      [COLONNE_AUTRES, COLONNE_VERSION],
    ),
    lignes = feuille.getMaxRows() - 1;
  feuille.getRange(1, 1, 1, titres.length).setValues([titres]).setFontWeight("bold");
  feuille.setFrozenRows(1);
  feuille.getRange(2, 3, lignes, DONNEES.length).setNumberFormat(FORMAT_NOMBRE);
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
    formats = {},
    refusees = [],
    donnees = s.donnees || {},
    partages = s.partages || {},
    publics = s.publics || {};
  // dans l'ordre des titres : un titre absent de l'onglet y est ajouté dans cet ordre
  valeurs[COLONNE_JOUEUR] = valeurCellule(joueur);
  valeurs[COLONNE_DATE] = dateDuReleve(s.jour, fuseau);
  // sur la case écrite : une ligne d'une version précédente garde sa date sans heure
  formats[COLONNE_DATE] = FORMAT_DATE;
  DONNEES.forEach(function (d) {
    var refuse = partages[d[0]] === false,
      v = refuse ? null : donnees[d[0]];
    valeurs[d[1]] = v == null ? "" : v;
    if (refuse) refusees.push(d[1]);
    // sans valeur ni refus (page du jeu illisible ce jour-là) : pas de couleur
    fonds[d[1]] = refuse ? COULEUR_REFUS : v == null ? null : COULEUR_PARTAGE;
  });
  // extension d'avant ce partage : rien avec les autres membres
  valeurs[COLONNE_AUTRES] = DONNEES.filter(function (d) {
    return publics[d[0]] === true && partages[d[0]] !== false;
  })
    .map(function (d) {
      return d[1];
    })
    .join(", ");
  valeurs[COLONNE_VERSION] = s.version == null ? "" : String(s.version);
  var sort = ecrireLigne(
    feuille,
    valeurs,
    fonds,
    formats,
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
 * écrit. Seules les colonnes de `valeurs` sont touchées, avec leur fond
 * (`fonds`) et leur format de nombre (`formats`), par titre.
 * `completer(remplacee)` peut changer `valeurs` d'après la ligne qui va être
 * remplacée (par titre ; null pour une nouvelle ligne).
 *
 * @return {String} "remplacée", "ajoutée" ou "gardée"
 */
function ecrireLigne(feuille, valeurs, fonds, formats, choisir, completer) {
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
  Object.keys(formats).forEach(function (t) {
    feuille.getRange(ligne, colonnes[t]).setNumberFormat(formats[t]);
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
 * Colonne (à partir de 1) de chaque titre, lue dans la première ligne. Un
 * titre absent (colonne supprimée, nouvelle information) est inséré après la
 * colonne du titre qui le précède dans la liste, sinon ajouté au bout : une
 * nouvelle information va avant « Version » et la légende des couleurs.
 */
function colonnesDe(feuille, titres) {
  var colonnes = titresLus(feuille),
    lignes = feuille.getMaxRows() - 1;
  titres.forEach(function (t, k) {
    if (colonnes[t]) return;
    var avant = 0,
      colonne;
    for (var j = k - 1; j >= 0 && !avant; j--) avant = colonnes[titres[j]] || 0;
    if (avant) {
      feuille.insertColumnAfter(avant);
      colonne = avant + 1;
      // une colonne insérée prend la mise en forme de sa voisine : ses fonds
      // verts et rouges diraient partagé ou non une information jamais relevée
      if (lignes > 0) feuille.getRange(2, colonne, lignes, 1).setBackground(null);
    } else {
      colonne = Math.max(feuille.getLastColumn(), 1) + 1;
      if (colonne > feuille.getMaxColumns())
        feuille.insertColumnsAfter(feuille.getMaxColumns(), colonne - feuille.getMaxColumns());
    }
    feuille.getRange(1, colonne).setValue(t).setFontWeight("bold");
    var donnee = DONNEES.some(function (d) {
      return d[1] == t;
    });
    if (donnee && lignes > 0)
      feuille.getRange(2, colonne, lignes, 1).setNumberFormat(FORMAT_NOMBRE);
    colonnes = titresLus(feuille);
  });
  return colonnes;
}

/** Colonne (à partir de 1) de chaque titre de la première ligne. */
function titresLus(feuille) {
  var lus = feuille.getRange(1, 1, 1, Math.max(feuille.getLastColumn(), 1)).getValues()[0],
    colonnes = {};
  lus.forEach(function (t, i) {
    var titre = String(t == null ? "" : t).trim();
    if (titre && !colonnes[titre]) colonnes[titre] = i + 1;
  });
  return colonnes;
}

/** Texte écrit par un joueur : jamais lu comme une formule. */
function valeurCellule(v) {
  if (v === null || v === undefined) return "";
  if (typeof v == "string" && /^[=+\-@]/.test(v)) return "'" + v;
  return v;
}

/**
 * Pourquoi un journal est refusé, ou "" : {joueur, serveur, appareil, version,
 * notes [{t (instant en ms), niveau, source, message, detail, page, version, x}]}.
 */
function refusDuJournal(j) {
  if (typeof j.joueur != "string" || !j.joueur.trim() || j.joueur.length > 40)
    return "joueur invalide";
  if (!Array.isArray(j.notes) || !j.notes.length || j.notes.length > NOTES_JOURNAL_MAX)
    return "notes invalides";
  var enTete = { serveur: 60, appareil: 400, version: 40 };
  for (var k in enTete)
    if (j[k] != null && (typeof j[k] != "string" || j[k].length > enTete[k]))
      return k + " invalide";
  for (var i = 0; i < j.notes.length; i++) {
    var n = j.notes[i];
    if (
      !n ||
      typeof n != "object" ||
      typeof n.t != "number" ||
      !isFinite(n.t) ||
      !NIVEAUX_JOURNAL.hasOwnProperty(n.niveau) ||
      !(n.x == null || (Math.floor(n.x) === n.x && n.x >= 1 && n.x <= 1e9))
    )
      return "note " + (i + 1) + " invalide";
    for (var c in LONGUEURS_JOURNAL)
      if (n[c] != null && (typeof n[c] != "string" || n[c].length > LONGUEURS_JOURNAL[c]))
        return "note " + (i + 1) + " invalide (" + c + ")";
  }
  return "";
}

/** L'onglet du journal, créé s'il manque, à la largeur de ses colonnes (moins de cellules). */
function preparerJournal(classeur) {
  var feuille = classeur.getSheetByName(ONGLET_JOURNAL);
  if (feuille) return feuille;
  feuille = classeur.insertSheet(ONGLET_JOURNAL);
  feuille
    .getRange(1, 1, 1, TITRES_JOURNAL.length)
    .setValues([TITRES_JOURNAL])
    .setFontWeight("bold");
  feuille.setFrozenRows(1);
  if (feuille.getMaxColumns() > TITRES_JOURNAL.length)
    feuille.deleteColumns(
      TITRES_JOURNAL.length + 1,
      feuille.getMaxColumns() - TITRES_JOURNAL.length,
    );
  return feuille;
}

/** Cellules de tout le fichier (grilles des onglets, remplies ou non). */
function cellulesDuFichier(classeur) {
  return classeur.getSheets().reduce(function (somme, f) {
    return somme + f.getMaxRows() * f.getMaxColumns();
  }, 0);
}

/** Ajoute les notes pas encore reçues, une ligne chacune, sous les autres. */
function enregistrerJournal(classeur, j) {
  var feuille = preparerJournal(classeur),
    colonnes = colonnesDe(feuille, TITRES_JOURNAL),
    derniere = Math.max(feuille.getLastRow(), 1),
    connues = {};
  if (derniere > 1)
    feuille
      .getRange(2, colonnes["Clé"], derniere - 1, 1)
      .getValues()
      .forEach(function (l) {
        connues[String(l[0])] = true;
      });
  var joueur = j.joueur.trim(),
    recu = new Date(),
    nouvelles = j.notes.filter(function (n) {
      var cle = cleNote(joueur, n);
      if (connues[cle]) return false;
      connues[cle] = true;
      return true;
    });
  if (!nouvelles.length) return { ok: true, ajoutees: 0, deja: j.notes.length };
  var manque = derniere + nouvelles.length - feuille.getMaxRows();
  if (
    manque > 0 &&
    cellulesDuFichier(classeur) + manque * feuille.getMaxColumns() > LIMITE_CELLULES_JOURNAL
  )
    return {
      erreur:
        "fichier presque plein : supprimer d'anciennes lignes de l'onglet « " +
        ONGLET_JOURNAL +
        " »",
    };
  if (manque > 0) feuille.insertRowsAfter(feuille.getMaxRows(), manque);
  var largeur = Math.max.apply(
      null,
      TITRES_JOURNAL.map(function (t) {
        return colonnes[t];
      }),
    ),
    lignes = nouvelles.map(function (n) {
      var l = [];
      for (var c = 0; c < largeur; c++) l.push("");
      var valeurs = {
        "Reçu le": recu,
        Joueur: valeurCellule(joueur),
        Serveur: valeurCellule(j.serveur || ""),
        Appareil: valeurCellule(j.appareil || ""),
        "Note du": new Date(n.t),
        Niveau: NIVEAUX_JOURNAL[n.niveau],
        Source: valeurCellule(n.source || ""),
        Page: valeurCellule(n.page || ""),
        Version: valeurCellule(n.version || j.version || ""),
        Répétitions: n.x || 1,
        Message: valeurCellule(n.message || ""),
        Détail: valeurCellule(n.detail || ""),
        Clé: valeurCellule(cleNote(joueur, n)),
      };
      TITRES_JOURNAL.forEach(function (t) {
        l[colonnes[t] - 1] = valeurs[t];
      });
      return l;
    }),
    debut = derniere + 1;
  // textes gardés tels quels : « 12/11 » ou « 1.5 » ne deviennent ni date ni nombre
  TITRES_JOURNAL.forEach(function (t) {
    if (TITRES_NON_TEXTE_JOURNAL.indexOf(t) == -1)
      feuille.getRange(debut, colonnes[t], lignes.length, 1).setNumberFormat("@");
  });
  feuille.getRange(debut, 1, lignes.length, largeur).setValues(lignes).setVerticalAlignment("top");
  ["Reçu le", "Note du"].forEach(function (t) {
    feuille.getRange(debut, colonnes[t], lignes.length, 1).setNumberFormat(FORMAT_INSTANT);
  });
  // une ligne par note, même quand son détail tient sur plusieurs lignes
  feuille.setRowHeightsForced(debut, lignes.length, 21);
  return { ok: true, ajoutees: lignes.length, deja: j.notes.length - lignes.length };
}

/** Une note reçue deux fois (réponse perdue, envoi repris) n'est écrite qu'une fois. */
function cleNote(joueur, n) {
  return [cleJoueur(joueur), n.t, n.niveau, n.source || ""].join("|");
}
