import { beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { creerPage } from "./harnais";
import { classeurSimule } from "./sheet-simule";

/**
 * Partage de données (1.104.0, demande du mainteneur) : une fois par jour, à
 * la première page ouverte, les informations cochées dans Préférences →
 * Partage de données sont relevées (pages Construction, Laboratoire et Reine)
 * et envoyées au script du Google Sheet « Stats membres » de l'alliance, dont
 * l'adresse est dans le sujet caché du même nom. Règles s5 : tout part d'une
 * page ouverte par le joueur ; rien de répété ni de minuté.
 *
 * 1.107.0 (demande du mainteneur) : le relevé du jour est refait à la première
 * page ouverte après un changement de niveau de la Champignonnière ou de
 * l'Étable à pucerons.
 */
const page = creerPage(
  [
    "js/class/Utils.js",
    "js/class/ExportRapports.js",
    "js/class/Armee.js",
    "js/page/PartageChasses.js",
    "js/class/SuiviMembres.js",
    "js/content.js",
  ],
  // constantes du jeu (content.js) ; l'encart « Connexion » empêche le démarrage
  `var chrome = { runtime: { getManifest: () => ({ version: "1.104.0" }), getURL: (p) => p } };
   document.body.innerHTML = "<div class='boite_connexion_titre'>Connexion</div>";
   var heure = moment("2026-11-12 08:03", "YYYY-MM-DD HH:mm").valueOf();
   var Horloge = { maintenant: () => heure, serveur: () => moment(heure) };
   var monProfil = { pseudo: "DoggyBag" };
   var BoiteParametre = { ouvrirOnglet: (id) => (window.ONGLET_OUVERT = id) };`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);
const attendre = () => new Promise((r) => setTimeout(r, 0));

const ADRESSE = "https://script.google.com/macros/s/AKfycbInvente123/exec";
// premier message du sujet des réglages de l'alliance, écrit à la main
const REGLAGE = `Google Sheet des stats membres : ${ADRESSE}`;
const ligne = (nom: string, niveau: number) =>
  `<tr class="ligneAmelioration"><td><div class="desciption_amelioration"><h2>${nom}</h2><span class="niveau_amelioration">niveau ${niveau}</span></div></td></tr>`;
const BATIMENTS: [string, number][] = [
  ["Champignonnière", 17],
  ["Entrepôt de Nourriture", 10],
  ["Entrepôt de Matériaux", 13],
  ["Couveuse", 14],
  ["Solarium", 12],
  ["Laboratoire", 12],
  ["Salle d'analyse", 6],
  ["Salle de combat", 11],
  ["Caserne", 0],
  ["Dôme", 3],
  ["Loge Impériale", 3],
  ["Etable à pucerons", 2],
  ["Etable à cochenilles", 0],
];
const CONSTRUCTION = `<table>${BATIMENTS.map(([n, v]) => ligne(n, v)).join("")}</table>`;
// page Construction du jeu : niveaux (ceux de BATIMENTS sauf mention) et
// construction en cours [nom affiché, secondes restantes]
const pageConstruction = (niveaux: Record<string, number> = {}, enCours?: [string, number]) =>
  `<div id="centre">${
    enCours
      ? `<strong>- ${enCours[0]} se termine dans : <span id="batiment_3"></span><script type="text/javascript">reste(${enCours[1]}, "batiment_3");</script> - <a href="construction.php?annuler=3&amp;t=1c34">Annuler</a></strong><br/>`
      : ""
  }<table>${BATIMENTS.map(([n, v]) => ligne(n, niveaux[n] ?? v)).join("")}</table></div>`;
// encart Compte+ du jeu, présent sur chaque page : ligne de la construction en cours
const encart = (nom = "Aucune construction", secondes = 0) =>
  `<table><tr id="ligne_construction" onclick="document.location.href='construction.php'" class="lien tooltip_compte_plus" title=""> <td><a href="construction.php"><div class="mini_icone_construction"></div></a></td> <td> <a href="construction.php" >${nom}</a></td> <td style="text-align:right;">${
    secondes
      ? `<a href="construction.php" id="temps_construction"></a> <script language="JavaScript">$(function() { resteTemps(${secondes},"temps_construction"); });</script>`
      : ""
  }<script language="JavaScript">$(function() { $("#ligne_construction").tooltip({ tooltipClass: "warning-tooltip", content:"" }); });</script></td></tr></table>`;
const LABORATOIRE = `<table>${[
  ["Technique de ponte", 12],
  ["Bouclier Thoracique", 8],
  ["Armes", 9],
  ["Architecture", 11],
  ["Communication avec les animaux", 4],
  ["Vitesse de chasse", 8],
  ["Vitesse d'attaque", 7],
  ["Génétique", 4],
  ["Acide", 1],
  ["Poison", 0],
]
  .map(([n, v]) => ligne(String(n), Number(v)))
  .join("")}</table>`;
// armée inventée : 12 unités débloquées (ni Concierge d'élite ni Tank d'élite)
const ARMEE: [string, number][] = [
  ["Jeune Soldate Naine", 1000],
  ["Soldate Naine", 0],
  ["Naine d'Elite", 0],
  ["Jeune Soldate", 500],
  ["Soldate", 200],
  ["Concierge", 0],
  ["Artilleuse", 300],
  ["Artilleuse d'élite", 0],
  ["Soldate d'élite", 50],
  ["Tank", 10],
  ["Tueuse", 5],
  ["Tueuse d'élite", 0],
];
const reine = (noms = true) =>
  `<table><tr class="ligneAmelioration"><td><h2>Ouvrière</h2><span id="armee_initial">70 481</span></td></tr>${ARMEE.map(
    ([nom, n], i) =>
      `<tr class="ligneAmelioration"><td>${noms ? `<h2>${nom}</h2>` : ""}<span id="armee_initial${i + 1}">${n}</span></td></tr>`,
  ).join("")}</table>`;
const PAGE_ARMEE = `<table class="simulateur">${ARMEE.map(
  ([nom]) => `<tr align="center"><td><span class="pas_sur_telephone">${nom}</span></td></tr>`,
).join("")}</table>`;
// 1 000 JSN × 3 + 500 JS × 10 + 200 S × 15 + 300 A × 30 + 50 SE × 24 + 10 Tk × 55 + 5 Tu × 50
const FDF_HB = 22000,
  CDF = 2065;
const DONNEES = {
  tdp: 38,
  cdf: CDF,
  fdfHB: FDF_HB,
  // Armes 9 : + 90 %
  fdfAB: 41800,
  va: 7,
  vc: 8,
  puceron: 2,
  champignonniere: 17,
  // page Reine : toutes les ouvrières, celles parties en convoi comprises
  ouvrieres: 70481,
};
const CLES = Object.keys(DONNEES);
const TOUT = Object.fromEntries(CLES.map((c) => [c, true]));

beforeEach(() => {
  lire(`(() => {
    localStorage.clear();
    heure = moment("2026-11-12 08:03", "YYYY-MM-DD HH:mm").valueOf();
    monProfil.pseudo = "DoggyBag";
    history.replaceState(null, "", "/Armee.php");
    document.body.innerHTML = "<span id='tag_alliance'>OUAF</span>";
    Utils._reine = null; Utils._pageReine = null; SuiviMembres._lues = {};
    window.TOASTS = [];
    $.toast = (o) => { TOASTS.push(o); return {}; };
    // ce que le module note au journal, et ses écritures de l'état
    window.NOTES = [];
    Journal.info = (source, message, detail) => NOTES.push([message, detail]);
    Journal.erreur = (source, message, detail) => NOTES.push([message, detail]);
    window.ECRITURES = 0;
    window.GARDER = window.GARDER || SuiviMembres._garder;
    SuiviMembres._garder = (e) => { ECRITURES++; GARDER(e); };
    window.JEU = { lues: [], pages: { "/construction.php": ${JSON.stringify(CONSTRUCTION)}, "/laboratoire.php": ${JSON.stringify(LABORATOIRE)},
      "/Reine.php": ${JSON.stringify(reine())}, "/Armee.php": ${JSON.stringify(PAGE_ARMEE)} }, pannes: {} };
    $.get = (url) => {
      let chemin = new URL(url).pathname;
      JEU.lues.push(chemin);
      return JEU.pannes[chemin] ? Promise.reject({ status: 500 }) : Promise.resolve(JEU.pages[chemin]);
    };
    // forum simulé : sujets {id, titre, messages} de la section cachée
    window.FORUM = { section: true, sujets: [{ id: "31", titre: "Réglages de l'extension", messages: [${JSON.stringify(REGLAGE)}] }], appels: [], echoue: false };
    PartageChasses.idSection = null;
    PartageChasses.oublierCache();
    PartageChasses._html = (d) => d;
    PartageChasses._xajax = (f, args) => {
      FORUM.appels.push(args ? f + " " + args : f);
      if (FORUM.echoue) return Promise.reject(new Error("forum"));
      if (f == "callGetForum" && !args)
        return Promise.resolve(FORUM.section ? '<span class="forum7">BDD partagée cachée</span>' : '<span class="forum2">Général</span>');
      if (f == "callGetForum")
        return Promise.resolve('<form id="form_cat"><table>' + FORUM.sujets.map((s) => '<tr><td><input name="topic[]" value="' + s.id + '"/></td><td>' + s.titre + '</td></tr>').join("") + "</table></form>");
      const s = FORUM.sujets.find((s) => s.id == args);
      return Promise.resolve(s ? s.messages.map((m) => '<div class="messageForum">' + m + "</div>").join("") : "");
    };
    // script du fichier : ce qu'il reçoit, ce qu'il répond
    window.SHEET = { recus: [], reponse: { ok: true, statut: 200, donnees: { ok: true, nouveau: true } } };
    chrome.runtime.sendMessage = (m) => { SHEET.recus.push(m); return Promise.resolve(SHEET.reponse); };
  })()`);
});

// le joueur a déjà vu l'annonce (cas courant)
const annonceVue = () =>
  lire(
    `localStorage.setItem("fzzz_suiviMembres", JSON.stringify({ doggybag: { annonce: true } }))`,
  );
// comme content.js : observer() avant le module de la page, lancer() après
const ouvrirPage = async (chemin = "/Armee.php") => {
  lire(
    `(() => { history.replaceState(null, "", ${JSON.stringify(chemin)}); Utils._reine = null; Utils._pageReine = null; SuiviMembres._lues = {}; SuiviMembres.observer(); })()`,
  );
  const resultat = await lire<Promise<string>>(`SuiviMembres.lancer()`);
  await attendre();
  return resultat;
};
// page ouverte avec son contenu (page Construction, encart Compte+)
const visiter = (chemin: string, html = "") => {
  lire(`document.body.innerHTML = "<span id='tag_alliance'>OUAF</span>" + ${JSON.stringify(html)}`);
  return ouvrirPage(chemin);
};
// ce que le jeu répond à la lecture de sa page Construction
const jeuConstruction = (niveaux: Record<string, number> = {}, enCours?: [string, number]) =>
  lire(`JEU.pages["/construction.php"] = ${JSON.stringify(pageConstruction(niveaux, enCours))}`);
const envoyes = () =>
  recus().map((r) => [r.corps.suivi.donnees.puceron, r.corps.suivi.donnees.champignonniere]);
// lignes du journal « niveau changé… » : une par relevé refait, avec l'information concernée
const changements = () =>
  lire<[string, string][]>(`NOTES.slice()`)
    .filter(([message]) => message.startsWith("niveau changé"))
    .map(([, detail]) => detail);
const recus = () => lire<any[]>(`SHEET.recus.slice()`);
const lues = () => lire<string[]>(`JEU.lues.slice()`);
const forum = () => lire<string[]>(`FORUM.appels.slice()`);
const avancer = (minutes: number) => lire(`heure += ${minutes} * 60000`);
const decocher = (...cles: string[]) =>
  lire(`${JSON.stringify(cles)}.forEach((c) => localStorage.setItem("fzzz_partage_" + c, "0"))`);
const etat = () => lire<any>(`SuiviMembres.etat()`);
const AUCUN = Object.fromEntries(CLES.map((c) => [c, false]));

describe("première page du jour", () => {
  test("adresse lue dans le sujet caché, pages Construction, Laboratoire et Reine lues une fois chacune, relevé envoyé au script", async () => {
    annonceVue();
    expect(await ouvrirPage()).toBe("envoyé");
    expect(forum()).toEqual(["callGetForum", "callGetForum 7", "callGetTopic 31"]);
    expect(lues()).toEqual(["/construction.php", "/laboratoire.php", "/Reine.php"]);
    expect(recus()).toEqual([
      {
        type: "fzzz_sheet",
        url: ADRESSE,
        methode: "POST",
        corps: {
          suivi: {
            joueur: "DoggyBag",
            jour: "2026-11-12",
            donnees: DONNEES,
            partages: TOUT,
            publics: TOUT,
            version: "1.104.0",
          },
        },
      },
    ]);
    expect(etat()).toMatchObject({ jour: "2026-11-12", fait: true, envoi: { cles: CLES } });
  });

  test("le script du fichier accepte ce relevé tel quel et colore les cases", async () => {
    annonceVue();
    decocher("fdfAB");
    await ouvrirPage();
    const corps = recus()[0].corps;
    // jour d'aujourd'hui pour le script, qui refuse un jour éloigné
    corps.suivi.jour = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(
      new Date(),
    );
    const f = classeurSimule({}, "Europe/Paris", "stats-membres.gs");
    expect(f.doPost(corps)).toEqual({ ok: true, nouveau: true, dernier: true });
    expect(f.onglets["Dernier relevé"].grille[1].slice(2, 10)).toEqual([
      38,
      CDF,
      FDF_HB,
      "",
      7,
      8,
      2,
      17,
    ]);
    expect([5, 6].map((c) => f.onglets["Dernier relevé"].fonds[`2,${c}`])).toEqual([
      "#d9ead3",
      "#f4cccc",
    ]);
  });

  test("une fois par jour : les pages suivantes ne lisent ni n'envoient rien ; le lendemain, de nouveau", async () => {
    annonceVue();
    await ouvrirPage();
    for (const chemin of ["/Ressources.php", "/construction.php", "/alliance.php"]) {
      avancer(90);
      expect(await ouvrirPage(chemin)).toBe("attente");
    }
    expect([recus().length, lues().length, forum().length]).toEqual([1, 3, 3]);
    lire(`heure = moment("2026-11-13 00:01", "YYYY-MM-DD HH:mm").valueOf()`);
    expect(await ouvrirPage()).toBe("envoyé");
    expect(recus().map((r) => r.corps.suivi.jour)).toEqual(["2026-11-12", "2026-11-13"]);
  });

  test("le jour est celui du serveur, pas celui du PC", async () => {
    annonceVue();
    lire(`heure = moment("2026-12-31 23:59", "YYYY-MM-DD HH:mm").valueOf()`);
    await ouvrirPage();
    expect(recus()[0].corps.suivi.jour).toBe("2026-12-31");
  });

  test("page ouverte : lue dans la page, sans requête", async () => {
    annonceVue();
    lire(`document.body.insertAdjacentHTML("beforeend", ${JSON.stringify(CONSTRUCTION)})`);
    await ouvrirPage("/construction.php");
    expect(lues()).toEqual(["/laboratoire.php", "/Reine.php"]);
    expect(recus()[0].corps.suivi.donnees).toEqual(DONNEES);
  });

  test("lignes de la page Reine sans nom d'unité : rangs lus dans la page Armée", async () => {
    annonceVue();
    lire(`JEU.pages["/Reine.php"] = ${JSON.stringify(reine(false))}`);
    await ouvrirPage();
    expect(lues()).toEqual(["/construction.php", "/laboratoire.php", "/Reine.php", "/Armee.php"]);
    expect(recus()[0].corps.suivi.donnees).toMatchObject({ cdf: CDF, fdfHB: FDF_HB });
  });
});

describe("annonce avant le premier envoi", () => {
  test("première page : le joueur est prévenu, rien n'est lu dans le jeu ni envoyé ; page suivante : envoi", async () => {
    expect(await ouvrirPage()).toBe("annonce");
    expect([lues(), recus()]).toEqual([[], []]);
    const annonce = lire<any>(`TOASTS[0]`);
    expect(annonce.hideAfter).toBe(false);
    expect(annonce.text).toContain(
      "Une fois par jour, l'extension envoie au Google Sheet des stats membres de ton alliance tes statistiques : TdP, CdF, FdF HB, FdF AB, VA, VC, Puceron, Champignonnière et Ouvrières. Elle les renvoie quand le niveau de ta Champignonnière ou de ton Étable à pucerons change. Le premier envoi se fera à ta prochaine page.",
    );
    expect(annonce.text).toContain("Préférences → Partage de données");
    // la page suivante, quelques secondes après
    expect(await ouvrirPage("/Ressources.php")).toBe("envoyé");
    expect(recus()).toHaveLength(1);
    expect(lire(`TOASTS.length`)).toBe(1);
  });

  test("le lien de l'annonce ouvre l'onglet des Préférences ; une case décochée avant la page suivante n'est jamais envoyée", async () => {
    await ouvrirPage();
    lire(`(() => {
      document.body.insertAdjacentHTML("beforeend", "<a href='#' class='o_ouvrirPartage'>Préférences</a>");
      $(".o_ouvrirPartage").trigger("click");
      SuiviMembres.choisir("cdf", false);
    })()`);
    expect(lire(`ONGLET_OUVERT`)).toBe("Partage");
    await ouvrirPage();
    const s = recus()[0].corps.suivi;
    expect([s.donnees.cdf, s.partages.cdf, s.donnees.tdp]).toEqual([undefined, false, 38]);
  });

  test("sans sujet des réglages : ni annonce, ni lecture, ni envoi, et pas de nouvel essai ce jour-là", async () => {
    lire(`FORUM.sujets = [{ id: "4", titre: "GIF de l'alliance", messages: ["x"] }]`);
    expect(await ouvrirPage()).toBe("sans sujet");
    avancer(120);
    expect(await ouvrirPage()).toBe("attente");
    expect([lire(`TOASTS.length`), lues(), recus(), forum().length]).toEqual([0, [], [], 2]);
    // sujet créé : pris en compte le lendemain
    lire(
      `FORUM.sujets.push({ id: "31", titre: "réglages de l’Extension", messages: [${JSON.stringify(REGLAGE)}] })`,
    );
    // le lendemain : la liste des sujets gardée une minute est périmée
    lire(`(() => { heure += 24 * 3600000; PartageChasses.oublierCache(); })()`);
    expect(await ouvrirPage()).toBe("annonce");
  });

  test("section cachée absente ou invisible pour le grade, joueur sans alliance : rien, et le journal dit ce qui manque", async () => {
    lire(`FORUM.section = false`);
    expect(await ouvrirPage()).toBe("sans sujet");
    expect(lire<(string | undefined)[][]>(`NOTES`)).toEqual([
      [
        "section cachée du forum introuvable ou invisible pour ton grade : rien n'est relevé aujourd'hui",
        undefined,
      ],
    ]);
    // section visible, sans le sujet
    lire(
      `(() => { localStorage.clear(); NOTES = []; FORUM.section = true; FORUM.sujets = []; PartageChasses.idSection = null; })()`,
    );
    expect(await ouvrirPage()).toBe("sans sujet");
    expect(lire<(string | undefined)[][]>(`NOTES`)).toEqual([
      [
        "pas de sujet « Réglages de l'extension » dans la section cachée du forum : rien n'est relevé aujourd'hui",
        undefined,
      ],
    ]);
    lire(`(() => { localStorage.clear(); FORUM.appels = []; $("#tag_alliance").text(""); })()`);
    expect(await ouvrirPage()).toBe("sans alliance");
    expect([forum(), lues(), recus(), lire(`TOASTS.length`)]).toEqual([[], [], [], 0]);
  });

  test("sujet sans la ligne du fichier : rien ce jour-là, et le journal le dit", async () => {
    lire(`FORUM.sujets[0].messages = ["Chasseurs : Alpha, Bravo"]`);
    expect(await ouvrirPage()).toBe("sans sujet");
    expect(lire<(string | undefined)[][]>(`NOTES`)).toEqual([
      [
        "pas de ligne « Google Sheet des stats membres » dans le sujet « Réglages de l'extension » : rien n'est relevé aujourd'hui",
        undefined,
      ],
    ]);
    expect([lues(), recus(), lire(`TOASTS.length`)]).toEqual([[], [], 0]);
  });

  test("ligne présente mais sans adresse lisible : un échec, repris une heure plus tard quand l'adresse y est", async () => {
    lire(`FORUM.sujets[0].messages = ["Google Sheet des stats membres : bientôt"]`);
    expect(await ouvrirPage()).toBe("échec");
    expect(lire<(string | undefined)[][]>(`NOTES`)).toEqual([
      [
        "relevé du 2026-11-12 non envoyé",
        "pas d'adresse de script lisible à la ligne « Google Sheet des stats membres » du sujet « Réglages de l'extension »",
      ],
    ]);
    expect([lues(), recus(), lire(`TOASTS.length`), etat().fait]).toEqual([[], [], 0, false]);
    lire(`FORUM.sujets[0].messages = [${JSON.stringify(REGLAGE)}]`);
    avancer(20);
    expect(await ouvrirPage()).toBe("attente");
    // une heure après : les lectures gardées une minute sont périmées
    lire(`(() => { heure += 41 * 60000; PartageChasses.oublierCache(); })()`);
    expect(await ouvrirPage()).toBe("annonce");
  });

  test("adresse du fichier (docs.google.com) au lieu de celle de son script : l'échec dit quoi corriger", async () => {
    lire(
      `FORUM.sujets[0].messages = ["Google Sheet des stats membres : https://docs.google.com/spreadsheets/d/FichierInvente/edit?usp=sharing"]`,
    );
    expect(await ouvrirPage()).toBe("échec");
    expect(lire<(string | undefined)[][]>(`NOTES`)).toEqual([
      [
        "relevé du 2026-11-12 non envoyé",
        "la ligne « Google Sheet des stats membres » du sujet « Réglages de l'extension » donne l'adresse du fichier (docs.google.com) au lieu de celle de son script, qui finit par /exec (dans le fichier : Extensions → Apps Script → Déployer → Gérer les déploiements)",
      ],
    ]);
    expect([lues(), recus(), etat().fait]).toEqual([[], [], false]);
  });

  test("« rien aujourd'hui » conclu par une autre version du script : revu à la page suivante ; par cette version : pas avant demain", async () => {
    const conclu = (plus: object) =>
      lire(
        `localStorage.setItem("fzzz_suiviMembres", JSON.stringify({ doggybag: { annonce: true, jour: "2026-11-12", fait: true, essais: 1, essai: heure, raison: "sans sujet", ...${JSON.stringify(plus)} } }))`,
      );
    conclu({});
    expect(await ouvrirPage()).toBe("envoyé");
    conclu({ version: "1.103.0" });
    expect(await ouvrirPage()).toBe("envoyé");
    conclu({ version: "1.104.0" });
    expect(await ouvrirPage()).toBe("attente");
    expect(recus()).toHaveLength(2);
    // joueur hors de la liste d'envoi de la 1.134.0 (supprimée depuis) : revu de même
    conclu({ raison: "non autorisé", version: "1.134.0" });
    expect(await ouvrirPage()).toBe("envoyé");
    expect(recus()).toHaveLength(3);
  });

  test("liste des sujets gardée par une autre version du script (mise à jour dans la minute) : relue, le sujet est trouvé", async () => {
    annonceVue();
    // gardée il y a 5 s par une version qui ne retenait pas le sujet des réglages
    const garder = (plus: object) =>
      lire(
        `localStorage.setItem("fzzz_cacheForum", JSON.stringify({ sujets: { t: Date.now() - 5000, v: { liste: [], historiques: [] }, ...${JSON.stringify(plus)} } }))`,
      );
    garder({});
    expect(await ouvrirPage()).toBe("envoyé");
    expect(forum()).toEqual(["callGetForum", "callGetForum 7", "callGetTopic 31"]);
    // la liste que cette version vient de lire et de garder : réutilisée dans la minute
    await lire(`PartageChasses.sujets(true)`);
    expect(forum()).toHaveLength(3);
    // réglages lus il y a moins d'une minute par cette version : servent tels quels
    lire(`(() => { localStorage.removeItem("fzzz_suiviMembres"); FORUM.appels = []; })()`);
    annonceVue();
    expect(await ouvrirPage()).toBe("envoyé");
    expect(forum()).toEqual([]);
    // sans eux, la liste des sujets gardée par une autre version est relue
    const oublier = () =>
      lire(
        `(() => { ["fzzz_suiviMembres", "fzzz_reglagesAlliance"].forEach((c) => localStorage.removeItem(c)); FORUM.appels = []; NOTES = []; })()`,
      );
    oublier();
    annonceVue();
    garder({ version: "1.101.0" });
    expect(await ouvrirPage()).toBe("envoyé");
    expect(forum()).toEqual(["callGetForum 7", "callGetTopic 31"]);
    // gardée par cette version : réutilisée, le forum n'est pas relu
    oublier();
    annonceVue();
    garder({ version: "1.104.0" });
    expect(await ouvrirPage()).toBe("sans sujet");
    expect(forum()).toEqual([]);
  });
});

describe("cases de Préférences → Partage de données", () => {
  test("information décochée : sa page n'est pas lue, sa valeur n'est pas envoyée, le fichier sait qu'elle n'est pas partagée", async () => {
    annonceVue();
    decocher("cdf", "fdfHB", "fdfAB", "ouvrieres");
    await ouvrirPage();
    // plus aucune information de la page Reine : elle n'est pas lue
    expect(lues()).toEqual(["/construction.php", "/laboratoire.php"]);
    const s = recus()[0].corps.suivi;
    expect(s.donnees).toEqual({ tdp: 38, va: 7, vc: 8, puceron: 2, champignonniere: 17 });
    expect(s.partages).toEqual({
      ...TOUT,
      cdf: false,
      fdfHB: false,
      fdfAB: false,
      ouvrieres: false,
    });
  });

  test("Ouvrières seule cochée (avec Champignonnière et Puceron, toujours partagés) : pages Reine et Construction lues, pas Laboratoire ni Armée", async () => {
    annonceVue();
    decocher(...CLES.filter((c) => c != "ouvrieres"));
    await ouvrirPage();
    expect(lues()).toEqual(["/construction.php", "/Reine.php"]);
    expect(recus()[0].corps.suivi.donnees).toEqual({
      ouvrieres: 70481,
      puceron: 2,
      champignonniere: 17,
    });
  });

  test("tout décoché : seules Champignonnière et Puceron, toujours partagés avec les chefs, sont relevés ; rien avec les autres membres", async () => {
    annonceVue();
    decocher(...CLES);
    expect(await ouvrirPage()).toBe("envoyé");
    expect(lues()).toEqual(["/construction.php"]);
    const s = recus()[0].corps.suivi;
    expect(s.donnees).toEqual({ puceron: 2, champignonniere: 17 });
    expect(s.partages).toEqual({ ...AUCUN, puceron: true, champignonniere: true });
    expect(s.publics).toEqual(AUCUN);
  });

  test("case changée dans la journée : le fichier le sait à la page suivante, sans attendre le lendemain", async () => {
    annonceVue();
    await ouvrirPage();
    lire(`SuiviMembres.choisir("vc", false)`);
    expect(lire(`SuiviMembres.partage("vc")`)).toBe(false);
    expect(await ouvrirPage()).toBe("envoyé");
    expect(recus().map((r) => r.corps.suivi.partages.vc)).toEqual([true, false]);
    expect(await ouvrirPage()).toBe("attente");
  });

  test("« Envoyer maintenant » : relevé refait même si celui du jour est parti, sans annonce", async () => {
    expect(await lire<Promise<string>>(`SuiviMembres.lancer(true)`)).toBe("envoyé");
    expect(await lire<Promise<string>>(`SuiviMembres.lancer(true)`)).toBe("envoyé");
    expect([recus().length, lire(`TOASTS.length`), etat().annonce]).toEqual([2, 0, true]);
  });

  test("onglet : rien à dire tant que le relevé n'a pas échoué (ni dernier envoi, ni prochain)", async () => {
    expect(lire(`SuiviMembres.probleme()`)).toBe("");
    annonceVue();
    await ouvrirPage();
    expect(etat().fait).toBe(true);
    expect(lire(`SuiviMembres.probleme()`)).toBe("");
    lire(`SuiviMembres.choisir("va", false)`);
    expect(lire(`SuiviMembres.probleme()`)).toBe("");
  });
});

describe("relevé impossible : jamais relancé à chaque page", () => {
  const essais = async () => {
    const r = [];
    // pages ouvertes toutes les 20 minutes pendant 5 heures
    for (let i = 0; i < 15; i++) {
      r.push(await ouvrirPage());
      avancer(20);
    }
    return r.filter((x) => x != "attente");
  };

  test("forum illisible : un essai par heure au plus, trois par jour ; la raison est gardée", async () => {
    annonceVue();
    lire(`FORUM.echoue = true`);
    expect(await essais()).toEqual(["échec", "échec", "échec"]);
    expect([recus(), lues()]).toEqual([[], []]);
    expect(etat()).toMatchObject({ fait: false, essais: 3 });
    expect(lire<string>(`SuiviMembres.probleme()`)).toBe(
      "Aujourd'hui, le relevé n'a pas pu être envoyé : forum. Nouvel essai à une page ouverte plus tard (3 essais par jour au plus).",
    );
    // le lendemain, l'échec de la veille n'est plus montré
    avancer(24 * 60);
    expect(lire(`SuiviMembres.probleme()`)).toBe("");
  });

  test("page du jeu illisible : rien d'envoyé, pas de relevé partiel ; nouvel essai une heure après, réussi", async () => {
    annonceVue();
    lire(`JEU.pannes["/laboratoire.php"] = true`);
    expect(await ouvrirPage()).toBe("échec");
    expect(recus()).toEqual([]);
    avancer(30);
    expect(await ouvrirPage()).toBe("attente");
    lire(`JEU.pannes = {}`);
    avancer(31);
    expect(await ouvrirPage()).toBe("envoyé");
    expect(recus()).toHaveLength(1);
  });

  test("niveau introuvable dans la page (mise en page du jeu changée) : rien d'envoyé", async () => {
    annonceVue();
    lire(
      `JEU.pages["/construction.php"] = ${JSON.stringify(CONSTRUCTION.replace("Couveuse", "Nurserie"))}`,
    );
    expect(await ouvrirPage()).toBe("échec");
    expect([recus(), etat().raison]).toEqual([[], "niveau introuvable : couveuse"]);
  });

  test("le script refuse ou ne répond pas : essai compté, puis repris", async () => {
    annonceVue();
    lire(`SHEET.reponse = { ok: true, statut: 200, donnees: { erreur: "jour invalide" } }`);
    expect(await ouvrirPage()).toBe("échec");
    expect(etat().raison).toBe("le script refuse : jour invalide");
    // réponse d'une autre application que le script du fichier
    lire(`SHEET.reponse = { ok: true, statut: 200, donnees: { message: "bonjour" } }`);
    avancer(61);
    expect(await ouvrirPage()).toBe("échec");
    expect(etat().raison).toBe("réponse inattendue du script");
    lire(`SHEET.reponse = { ok: true, statut: 200, donnees: { ok: true } }`);
    avancer(61);
    expect(await ouvrirPage()).toBe("envoyé");
    expect(etat()).toMatchObject({ fait: true, essais: 3 });
  });

  test("deux joueurs sur le même navigateur : chacun son relevé du jour", async () => {
    annonceVue();
    await ouvrirPage();
    lire(`monProfil.pseudo = "Lassie"`);
    expect(await ouvrirPage()).toBe("annonce");
    expect(await ouvrirPage()).toBe("envoyé");
    expect(recus().map((r) => r.corps.suivi.joueur)).toEqual(["DoggyBag", "Lassie"]);
  });
});

describe("niveau de la Champignonnière ou de l'Étable à pucerons changé : relevé refait sans attendre le lendemain", () => {
  const H = 3600;
  // relevé du jour parti à 08h03 (Étable 2, Champignonnière 17)
  const releveDuJour = async (html = "") => {
    annonceVue();
    expect(await visiter("/Armee.php", html)).toBe("envoyé");
  };

  test("page Construction : niveau affiché différent du dernier envoyé → relevé refait sur cette page, lue sur place", async () => {
    await releveDuJour();
    expect(etat().envoi.niveaux).toEqual({ champignonniere: 17, puceron: 2 });
    avancer(180);
    expect(await visiter("/construction.php", pageConstruction({ "Etable à pucerons": 3 }))).toBe(
      "envoyé",
    );
    // la page Construction n'est pas relue : elle est ouverte
    expect(lues().slice(3)).toEqual(["/laboratoire.php", "/Reine.php"]);
    expect(recus().map((r) => r.corps.suivi.jour)).toEqual(["2026-11-12", "2026-11-12"]);
    expect(envoyes()).toEqual([
      [2, 17],
      [3, 17],
    ]);
    expect(etat()).toMatchObject({
      fait: true,
      envoi: { niveaux: { champignonniere: 17, puceron: 3 } },
    });
    // rouverte : plus rien ; la Champignonnière qui monte ensuite : de nouveau
    avancer(5);
    expect(await visiter("/construction.php", pageConstruction({ "Etable à pucerons": 3 }))).toBe(
      "attente",
    );
    avancer(5);
    expect(
      await visiter(
        "/construction.php",
        pageConstruction({ "Etable à pucerons": 3, Champignonnière: 18 }),
      ),
    ).toBe("envoyé");
    expect(envoyes()[2]).toEqual([3, 18]);
    expect(changements()).toEqual(["Puceron", "Champignonnière"]);
  });

  test("niveaux inchangés, autre bâtiment monté : rien de refait ; niveaux vus ailleurs que sur la page Construction : jamais comparés", async () => {
    await releveDuJour();
    avancer(60);
    expect(await visiter("/construction.php", pageConstruction())).toBe("attente");
    expect(await visiter("/construction.php", pageConstruction({ Couveuse: 15 }))).toBe("attente");
    expect([recus().length, forum().length]).toEqual([1, 3]);
    expect(await visiter("/Membre.php", pageConstruction({ Champignonnière: 21 }))).toBe("attente");
    expect(await visiter("/construction.php", pageConstruction({ Champignonnière: 18 }))).toBe(
      "envoyé",
    );
    expect(recus()[1].corps.suivi.donnees).toMatchObject({ champignonniere: 18 });
  });

  test("Champignonnière et Puceron décochés avant cette règle : toujours partagés avec les chefs (pas avec les autres), leur changement de niveau refait le relevé", async () => {
    decocher("puceron", "champignonniere");
    await releveDuJour();
    expect(recus()[0].corps.suivi.partages).toMatchObject({ puceron: true, champignonniere: true });
    expect(recus()[0].corps.suivi.publics).toMatchObject({
      puceron: false,
      champignonniere: false,
    });
    avancer(60);
    expect(await visiter("/construction.php", pageConstruction({ "Etable à pucerons": 3 }))).toBe(
      "envoyé",
    );
    expect(recus()[1].corps.suivi.donnees.puceron).toBe(3);
  });

  test("relevé du jour pas encore parti (annonce, échec) ou sans sujet : rien de forcé, les essais gardent leur rythme", async () => {
    // annonce montrée à la première page : l'envoi attend la suivante, comme avant
    expect(await visiter("/construction.php", pageConstruction())).toBe("annonce");
    expect(await visiter("/construction.php", pageConstruction())).toBe("envoyé");
    // le lendemain, forum illisible : essai raté, pas de nouvel essai avant une heure
    lire(
      `(() => { heure += 24 * 3600000; PartageChasses.oublierCache(); FORUM.echoue = true; })()`,
    );
    expect(await visiter("/Armee.php")).toBe("échec");
    avancer(20);
    expect(await visiter("/construction.php", pageConstruction({ "Etable à pucerons": 3 }))).toBe(
      "attente",
    );
    expect(etat()).toMatchObject({ fait: false, essais: 1 });
    // jour sans sujet « Stats membres » : le forum n'est pas relu
    lire(
      `(() => { heure += 24 * 3600000; PartageChasses.oublierCache(); FORUM.echoue = false; FORUM.sujets = []; FORUM.appels = []; })()`,
    );
    expect(await visiter("/Armee.php")).toBe("sans sujet");
    const appels = forum().length;
    avancer(20);
    expect(await visiter("/construction.php", pageConstruction({ "Etable à pucerons": 3 }))).toBe(
      "attente",
    );
    expect([recus().length, forum().length]).toEqual([1, appels]);
  });

  test("relevé du jour interrompu (page quittée pendant les lectures) : le changement de niveau ne le relance pas avant une heure", async () => {
    lire(
      `localStorage.setItem("fzzz_suiviMembres", JSON.stringify({ doggybag: { annonce: true, jour: "2026-11-12", fait: false, essais: 1, essai: heure, raison: "", envoi: { instant: heure - 86400000, cles: ["puceron"], niveaux: { puceron: 2 } } } }))`,
    );
    avancer(10);
    expect(await visiter("/construction.php", pageConstruction({ "Etable à pucerons": 3 }))).toBe(
      "attente",
    );
    expect([etat().essais, recus().length, changements()]).toEqual([1, 0, []]);
    avancer(51);
    expect(await visiter("/construction.php", pageConstruction({ "Etable à pucerons": 3 }))).toBe(
      "envoyé",
    );
  });

  test("dernier envoi fait par une version qui ne gardait pas les niveaux : pas de comparaison", async () => {
    lire(
      `localStorage.setItem("fzzz_suiviMembres", JSON.stringify({ doggybag: { annonce: true, jour: "2026-11-12", fait: true, essais: 1, essai: heure, raison: "", envoi: { instant: heure, cles: ["puceron", "champignonniere"] } } }))`,
    );
    expect(await visiter("/construction.php", pageConstruction({ "Etable à pucerons": 3 }))).toBe(
      "attente",
    );
    expect(recus()).toEqual([]);
  });

  test("sans Compte+ : construction vue sur la page Construction, relevé refait à la première page ouverte après sa fin", async () => {
    await releveDuJour();
    avancer(10);
    // 08h13 : l'Étable passe au niveau 3 dans 2 h
    expect(
      await visiter("/construction.php", pageConstruction({}, ["Etable à pucerons 3", 2 * H])),
    ).toBe("attente");
    const fin = lire<number>(`heure`) + 2 * H * 1000;
    expect(etat().chantier).toEqual({ cle: "puceron", fin });
    avancer(60);
    expect(await visiter("/Ressources.php")).toBe("attente");
    // 10 s après l'heure prévue : pas encore (heure de fin estimée)
    lire(`heure = ${fin + 10000}`);
    expect(await visiter("/Armee.php")).toBe("attente");
    expect(etat().chantier).toEqual({ cle: "puceron", fin });
    expect([recus().length, lues().length]).toEqual([1, 3]);
    // 1 min après : la page Construction est relue, le nouveau niveau envoyé
    jeuConstruction({ "Etable à pucerons": 3 });
    lire(`heure = ${fin + 60000}`);
    expect(await visiter("/Armee.php")).toBe("envoyé");
    expect(lues().slice(3)).toEqual(["/construction.php", "/laboratoire.php", "/Reine.php"]);
    expect(envoyes()).toEqual([
      [2, 17],
      [3, 17],
    ]);
    expect(etat().chantier).toBeUndefined();
    // une seule fois
    avancer(1);
    expect(await visiter("/Reine.php")).toBe("attente");
    expect(await visiter("/construction.php", pageConstruction({ "Etable à pucerons": 3 }))).toBe(
      "attente",
    );
    expect(recus()).toHaveLength(2);
  });

  test("construction annulée avant sa fin : oubliée, rien à l'heure prévue", async () => {
    await releveDuJour();
    await visiter("/construction.php", pageConstruction({}, ["Champignonnière 18", 2 * H]));
    expect(etat().chantier).toMatchObject({ cle: "champignonniere" });
    avancer(30);
    expect(await visiter("/construction.php", pageConstruction())).toBe("attente");
    expect(etat().chantier).toBeUndefined();
    avancer(120);
    expect(await visiter("/Armee.php")).toBe("attente");
    expect(recus()).toHaveLength(1);
  });

  test("autre construction en cours, message d'erreur du jeu sans chrono : rien de suivi", async () => {
    await releveDuJour();
    await visiter("/construction.php", pageConstruction({}, ["Couveuse 15", 2 * H]));
    expect(etat().chantier).toBeUndefined();
    await visiter(
      "/construction.php",
      `<div id="centre"><strong>- Etable à pucerons : Prerequis non valide.</strong>${CONSTRUCTION}</div>`,
    );
    expect(etat().chantier).toBeUndefined();
  });

  test("page Construction rouverte après la fin : le niveau affiché fait foi (construction annulée ailleurs : rien)", async () => {
    await releveDuJour();
    await visiter("/construction.php", pageConstruction({}, ["Etable à pucerons 3", 2 * H]));
    avancer(150);
    expect(await visiter("/construction.php", pageConstruction())).toBe("attente");
    expect([recus().length, etat().chantier]).toEqual([1, undefined]);
  });

  test("Puceron décoché avant cette règle : la fin de sa construction refait quand même le relevé", async () => {
    await releveDuJour();
    await visiter("/construction.php", pageConstruction({}, ["Etable à pucerons 3", 2 * H]));
    decocher("puceron");
    avancer(150);
    jeuConstruction({ "Etable à pucerons": 3 });
    expect(await visiter("/Armee.php")).toBe("envoyé");
    expect([recus().length, recus()[1].corps.suivi.donnees.puceron]).toEqual([2, 3]);
  });

  test("construction lancée ailleurs : vue par le relevé du jour qui lit la page Construction, puis relevé refait après sa fin", async () => {
    jeuConstruction({}, ["Etable à pucerons 3", 3 * H]);
    await releveDuJour();
    const fin = lire<number>(`heure`) + 3 * H * 1000;
    expect(etat().chantier).toEqual({ cle: "puceron", fin });
    jeuConstruction({ "Etable à pucerons": 3 });
    lire(`heure = ${fin + 5 * 60000}`);
    expect(await visiter("/alliance.php")).toBe("envoyé");
    expect(envoyes()).toEqual([
      [2, 17],
      [3, 17],
    ]);
    expect(etat().chantier).toBeUndefined();
  });

  test("construction finie avant le relevé du lendemain : un seul relevé ce jour-là", async () => {
    await releveDuJour();
    await visiter("/construction.php", pageConstruction({}, ["Etable à pucerons 3", 20 * H]));
    // le lendemain 07h00, l'Étable est finie depuis 04h03
    jeuConstruction({ "Etable à pucerons": 3 });
    lire(`heure = moment("2026-11-13 07:00", "YYYY-MM-DD HH:mm").valueOf()`);
    expect(await visiter("/Armee.php")).toBe("envoyé");
    avancer(10);
    expect(await visiter("/Ressources.php")).toBe("attente");
    expect(envoyes()).toEqual([
      [2, 17],
      [3, 17],
    ]);
    // c'est le relevé du jour, pas un relevé refait
    expect(changements()).toEqual([]);
  });

  test("construction encore en cours le lendemain : gardée d'un jour à l'autre, relevé refait après sa fin", async () => {
    await releveDuJour();
    await visiter("/construction.php", pageConstruction({}, ["Etable à pucerons 3", 30 * H]));
    const fin = lire<number>(`heure`) + 30 * H * 1000;
    // le lendemain 07h00 : relevé du jour, la page Construction lue affiche encore la construction
    lire(`heure = moment("2026-11-13 07:00", "YYYY-MM-DD HH:mm").valueOf()`);
    jeuConstruction({}, ["Etable à pucerons 3", (fin - lire<number>(`heure`)) / 1000]);
    expect(await visiter("/Armee.php")).toBe("envoyé");
    expect(etat().chantier).toEqual({ cle: "puceron", fin });
    jeuConstruction({ "Etable à pucerons": 3 });
    lire(`heure = ${fin + 2 * 60000}`);
    expect(await visiter("/Armee.php")).toBe("envoyé");
    expect(envoyes()).toEqual([
      [2, 17],
      [2, 17],
      [3, 17],
    ]);
  });

  test("relevé refait qui échoue : repris une heure plus tard, pas à chaque page", async () => {
    await releveDuJour();
    await visiter("/construction.php", pageConstruction({}, ["Etable à pucerons 3", 2 * H]));
    jeuConstruction({ "Etable à pucerons": 3 });
    lire(`JEU.pannes["/laboratoire.php"] = true`);
    avancer(125);
    expect(await visiter("/Armee.php")).toBe("échec");
    lire(`JEU.pannes = {}`);
    avancer(20);
    expect(await visiter("/Ressources.php")).toBe("attente");
    avancer(41);
    expect(await visiter("/Ressources.php")).toBe("envoyé");
    expect(envoyes()).toEqual([
      [2, 17],
      [3, 17],
    ]);
    avancer(61);
    expect(await visiter("/Ressources.php")).toBe("attente");
  });

  describe("Compte+ : encart du jeu, sur chaque page", () => {
    test("construction suivie sans passer par la page Construction, relevé refait à la première page ouverte après sa fin", async () => {
      await releveDuJour(encart());
      expect(etat().chantier).toBeUndefined();
      avancer(30);
      expect(await visiter("/Ressources.php", encart("Champignonnière", 90 * 60))).toBe("attente");
      const fin = lire<number>(`heure`) + 90 * 60000;
      expect(etat().chantier).toEqual({ cle: "champignonniere", fin });
      avancer(60);
      expect(await visiter("/alliance.php", encart("Champignonnière", 30 * 60))).toBe("attente");
      expect(etat().chantier).toEqual({ cle: "champignonniere", fin });
      jeuConstruction({ Champignonnière: 18 });
      avancer(31);
      expect(await visiter("/Armee.php", encart())).toBe("envoyé");
      expect(envoyes()).toEqual([
        [2, 17],
        [2, 18],
      ]);
      expect(etat().chantier).toBeUndefined();
      avancer(1);
      expect(await visiter("/Armee.php", encart())).toBe("attente");
    });

    test("annulée (l'encart ne l'affiche plus avant l'heure prévue) : oubliée", async () => {
      await releveDuJour(encart());
      await visiter("/Ressources.php", encart("Etable à pucerons", 2 * H));
      avancer(60);
      expect(await visiter("/Armee.php", encart())).toBe("attente");
      expect(etat().chantier).toBeUndefined();
      avancer(90);
      expect(await visiter("/Armee.php", encart())).toBe("attente");
      expect(recus()).toHaveLength(1);
    });

    test("heure de fin estimée : encore affichée à l'heure prévue → pas finie ; plus affichée juste avant → finie", async () => {
      await releveDuJour(encart());
      await visiter("/Ressources.php", encart("Etable à pucerons", 2 * H));
      const fin = lire<number>(`heure`) + 2 * H * 1000;
      // page ouverte 2 s après l'heure estimée, où le jeu affiche encore 3 s
      lire(`heure = ${fin + 2000}`);
      expect(await visiter("/Armee.php", encart("Etable à pucerons", 3))).toBe("attente");
      expect(etat().chantier).toEqual({ cle: "puceron", fin: fin + 5000 });
      jeuConstruction({ "Etable à pucerons": 3 });
      lire(`heure = ${fin + 8000}`);
      expect(await visiter("/Armee.php", encart())).toBe("envoyé");
      expect(envoyes()[1]).toEqual([3, 17]);
      // autre construction, que l'encart n'affiche plus 10 s avant l'heure estimée
      await visiter("/Ressources.php", encart("Champignonnière", H));
      jeuConstruction({ "Etable à pucerons": 3, Champignonnière: 18 });
      lire(`heure += ${H * 1000 - 10000}`);
      expect(await visiter("/Armee.php", encart())).toBe("envoyé");
      expect(envoyes()[2]).toEqual([3, 18]);
    });

    test("file d'attente : la construction suivante est affichée à la fin de la première", async () => {
      await releveDuJour(encart());
      await visiter("/Ressources.php", encart("Etable à pucerons", H));
      // à la fin, l'encart affiche la suite de la file ; il fait foi, pas la page
      // Construction que lit le relevé
      jeuConstruction({ "Etable à pucerons": 3 });
      avancer(61);
      expect(await visiter("/Armee.php", encart("Champignonnière", 5 * H))).toBe("envoyé");
      const fin = lire<number>(`heure`) + 5 * H * 1000;
      expect(etat().chantier).toEqual({ cle: "champignonniere", fin });
      // puis de nouveau la Champignonnière, pour 6 h : la première est finie
      jeuConstruction({ "Etable à pucerons": 3, Champignonnière: 18 }, ["Couveuse 15", H]);
      lire(`heure = ${fin + 60000}`);
      expect(await visiter("/Armee.php", encart("Champignonnière", 6 * H))).toBe("envoyé");
      expect(envoyes()).toEqual([
        [2, 17],
        [3, 17],
        [3, 18],
      ]);
      expect(etat().chantier).toEqual({ cle: "champignonniere", fin: fin + 60000 + 6 * H * 1000 });
    });

    test("autre construction ou aucune : rien de suivi, aucun état écrit", async () => {
      await releveDuJour(encart());
      lire(`ECRITURES = 0`);
      await visiter("/Ressources.php", encart("Couveuse", H));
      await visiter("/Ressources.php", encart());
      expect([lire(`ECRITURES`), etat().chantier]).toEqual([0, undefined]);
      // construction suivie : notée une fois, pas réécrite à chaque page
      await visiter("/Ressources.php", encart("Etable à pucerons", H));
      await visiter("/Armee.php", encart("Etable à pucerons", H));
      expect(lire(`ECRITURES`)).toBe(1);
    });

    test("« Envoyer maintenant » après la fin, sans changer de page : pas de second relevé à la page suivante", async () => {
      await releveDuJour(encart());
      await visiter("/Ressources.php", encart("Etable à pucerons", H));
      jeuConstruction({ "Etable à pucerons": 3 });
      avancer(70);
      expect(await lire<Promise<string>>(`SuiviMembres.lancer(true)`)).toBe("envoyé");
      avancer(1);
      expect(await visiter("/Armee.php", encart())).toBe("attente");
      expect([envoyes(), etat().chantier, changements()]).toEqual([
        [
          [2, 17],
          [3, 17],
        ],
        undefined,
        [],
      ]);
    });

    test("construction encore en cours le lendemain : gardée par le relevé du jour, relevé refait après sa fin", async () => {
      await releveDuJour(encart());
      await visiter("/Ressources.php", encart("Etable à pucerons", 30 * H));
      const fin = lire<number>(`heure`) + 30 * H * 1000;
      lire(`heure = moment("2026-11-13 07:00", "YYYY-MM-DD HH:mm").valueOf()`);
      const reste = (fin - lire<number>(`heure`)) / 1000;
      expect(await visiter("/Armee.php", encart("Etable à pucerons", reste))).toBe("envoyé");
      expect(etat().chantier).toEqual({ cle: "puceron", fin });
      jeuConstruction({ "Etable à pucerons": 3 });
      lire(`heure = ${fin + 60000}`);
      expect(await visiter("/Armee.php", encart())).toBe("envoyé");
      expect(envoyes()[2]).toEqual([3, 17]);
    });
  });

  test("règles s5 : observer() ne lit rien dans le jeu ni le forum et n'envoie rien ; il marque seulement le relevé à refaire", async () => {
    await releveDuJour();
    await visiter("/construction.php", pageConstruction({}, ["Etable à pucerons 3", 2 * H]));
    avancer(125);
    const avant = [lues().length, forum().length, recus().length];
    lire(
      `(() => { history.replaceState(null, "", "/Armee.php"); document.body.innerHTML = "<span id='tag_alliance'>OUAF</span>"; SuiviMembres.observer(); })()`,
    );
    await attendre();
    expect([lues().length, forum().length, recus().length]).toEqual(avant);
    expect(etat()).toMatchObject({ fait: false, essais: 0, essai: 0 });
    // joueur sans alliance : rien n'est suivi
    lire(
      `(() => { localStorage.clear(); history.replaceState(null, "", "/construction.php"); document.body.innerHTML = ${JSON.stringify(pageConstruction({}, ["Etable à pucerons 3", 2 * H]))}; SuiviMembres.observer(); })()`,
    );
    expect(lire(`localStorage.getItem("fzzz_suiviMembres")`)).toBeNull();
  });

  test("annonce : Champignonnière et Puceron, toujours partagés, y sont même décochés, avec leur renvoi au changement de niveau", async () => {
    decocher("puceron", "champignonniere");
    expect(await visiter("/Armee.php")).toBe("annonce");
    expect(lire<string>(`TOASTS[0].text`)).toContain(
      "tes statistiques : TdP, CdF, FdF HB, FdF AB, VA, VC, Puceron, Champignonnière et Ouvrières. Elle les renvoie quand le niveau de ta Champignonnière ou de ton Étable à pucerons change.",
    );
    expect(lire<string>(`TOASTS[0].text`)).toContain(
      "Tu choisis ce que tu partages avec les chefs et avec les autres membres dans",
    );
  });
});

describe("lecture des niveaux et règles s5", () => {
  test("niveaux par nom : accents, apostrophe typographique et espaces tolérés", () => {
    expect(
      lire(
        `SuiviMembres.niveaux(Utils.parseHtml(${JSON.stringify(
          `<table>${ligne("Vitesse d’attaque", 7)}${ligne("  Étable   à pucerons ", 3)}${ligne("Sans niveau", NaN)}</table>`,
        )}))`,
      ),
    ).toEqual({ "vitesse d'attaque": 7, "etable a pucerons": 3 });
  });

  /**
   * Niveaux gardés du joueur (pages Construction et Laboratoire) : rangés par
   * nom. Lus par position, une page sans la liste les effaçait (« Niveau
   * d'étable null » sur la page Convois d'un joueur, 19/11/2026).
   */
  test("niveaux du joueur rangés par nom ; une page sans la liste n'efface rien", () => {
    const ranger = (html: string, liste: string, anciens: unknown[]) =>
      lire(
        `SuiviMembres.ranger(SuiviMembres.niveaux(Utils.parseHtml(${JSON.stringify(html)})), ${liste}, ${JSON.stringify(anciens)})`,
      );
    const avant = BATIMENTS.map(([, v]) => v);
    expect(ranger(CONSTRUCTION, "CONSTRUCTION", new Array(13).fill(-1))).toEqual(avant);
    expect(ranger(`<p>Je confirme</p>`, "CONSTRUCTION", avant)).toEqual(avant);
    // une seule ligne : le bon bâtiment, pas le premier de la liste
    const seule = ranger(`<table>${ligne("Etable à pucerons", 7)}</table>`, "CONSTRUCTION", avant);
    expect(seule[11]).toBe(7);
    expect(seule.filter((v: number, i: number) => v != avant[i])).toEqual([7]);
    // niveaux effacés par une version précédente : inconnus (-1) tant que la page n'est pas lue
    expect(ranger(`<p></p>`, "CONSTRUCTION", new Array(13).fill(null))).toEqual(
      new Array(13).fill(-1),
    );
    expect(ranger(LABORATOIRE, "RECHERCHE", [])).toEqual([12, 8, 9, 11, 4, 8, 7, 4, 1, 0]);
  });

  test("étable inconnue : ni « null » ni capacité fausse ; colonies non comptées", () => {
    const etable = (niveaux: unknown) =>
      lire(
        `(() => { monProfil.niveauConstruction = ${JSON.stringify(niveaux)}; return [Utils.niveauEtable(), Utils.parOuvriere()]; })()`,
      );
    expect(etable(BATIMENTS.map(([n, v]) => (n == "Etable à pucerons" ? 6 : v)))).toEqual([6, 13]);
    expect(etable(BATIMENTS.map(([n, v]) => (n == "Etable à pucerons" ? 0 : v)))).toEqual([0, 10]);
    expect(etable(new Array(13).fill(null))).toEqual([null, 10]);
    expect(etable(new Array(13).fill(-1))).toEqual([null, 10]);
    expect(etable(undefined)).toEqual([null, 10]);
    lire(`delete monProfil.niveauConstruction`);
    const source = (f: string) => readFileSync(join(import.meta.dir, "..", "public", f), "utf8");
    // plus aucune lecture par position des niveaux du joueur, ni du niveau d'étable gardé
    for (const f of ["js/page/Construction.js", "js/page/Laboratoire.js"])
      expect(source(f)).toContain("SuiviMembres.ranger(");
    for (const f of [
      "js/page/Commerce.js",
      "js/page/CommerceFzzz.js",
      "js/class/Utils.js",
      "js/class/Entrepots.js",
    ])
      expect(source(f).match(/niveauConstruction\[11\]/g) || []).toEqual([]);
  });

  test("aucune minuterie ni requête répétée dans le module ; le relevé part d'une page ouverte ou d'un clic", () => {
    const source = (f: string) => readFileSync(join(import.meta.dir, "..", "public", f), "utf8");
    expect(source("js/class/SuiviMembres.js")).not.toMatch(
      /setTimeout|setInterval|requestAnimationFrame/,
    );
    // un seul appel automatique, au démarrage de la page ; l'autre est le bouton des Préférences
    const appels = ["js/content.js", "js/boite/Parametres.js"].map(
      (f) => source(f).match(/SuiviMembres\.lancer\([^)]*\)/g) || [],
    );
    expect(appels).toEqual([["SuiviMembres.lancer()"], ["SuiviMembres.lancer(true)"]]);
    // observer() : une fois par page, avant le module de la page qui la modifie ; lancer() après
    const demarrage = source("js/content.js");
    expect(demarrage.match(/SuiviMembres\.\w+\(/g)).toEqual([
      "SuiviMembres.observer(",
      "SuiviMembres.lancer(",
    ]);
    expect(demarrage.indexOf("SuiviMembres.observer()")).toBeLessThan(
      demarrage.indexOf("switch (true)"),
    );
    expect(demarrage.indexOf("SuiviMembres.lancer()")).toBeGreaterThan(
      demarrage.indexOf("PartageChasses.reprendre()"),
    );
  });

  test("les informations du module et du script du fichier sont les mêmes, dans le même ordre", () => {
    const f = classeurSimule({}, "Europe/Paris", "stats-membres.gs");
    expect(lire(`DONNEES_PARTAGEES.map((d) => [d.cle, d.titre])`)).toEqual(f.script.DONNEES);
  });
});

describe("Préférences → Partage de données", () => {
  const preferences = creerPage(
    [
      "js/lib/jquery-ui_1.12.1.js",
      "js/lib/globalize_0.1.1.js",
      "js/lib/globalize-locale-fr.js",
      "js/class/Utils.js",
      "js/class/Parametre.js",
      "js/class/Joueur.js",
      "js/class/Armee.js",
      "js/class/UnitesGardees.js",
      "js/page/PartageChasses.js",
      "js/class/RappelExport.js",
      "js/class/SuiviMembres.js",
      "js/class/ExportRapports.js",
      "js/class/ExportAuto.js",
      "js/boite/Boite.js",
      "js/boite/Parametres.js",
    ],
    `var METHODE_FLOOD = [], AFFECTATION_RESSOURCE = [], RATIO_RECOLTE = {};
     var NOM_UNITE = ["Ouvrière", "Jeune Soldate Naine"];
     var heure = moment("2026-11-12 08:03", "YYYY-MM-DD HH:mm").valueOf();
     var Horloge = { maintenant: () => heure, serveur: () => moment(heure) };`,
  );
  const ouvrir = () =>
    preferences.lire(`(() => {
      window.monProfil = new Joueur({ pseudo: "DoggyBag" }).getParametre();
      document.body.innerHTML = "<div id='o_boiteParametre'><div id='o_tabsParametrePartage'></div></div>";
      window.boite = new BoiteParametre();
      boite.ajusterTaille = () => boite;
      boite.ongletPartage();
    })()`);
  // chaque information, dans l'ordre de la vue : [clé, avec les chefs, verrouillée, avec les autres]
  const cases = () =>
    preferences.lire<[string, boolean, boolean, boolean][]>(
      `$("#o_tabsParametrePartage input[data-partage-chefs]").map((i, c) => [[c.dataset.partageChefs, c.checked, c.disabled,
        $("#o_tabsParametrePartage input[data-partage-autres='" + c.dataset.partageChefs + "']").prop("checked")]]).get()`,
    );
  const cocher = (niveau: string, cle: string, coche: boolean) =>
    preferences.lire(
      `$("#o_tabsParametrePartage input[data-partage-${niveau}='${cle}']").prop("checked", ${coche}).trigger("change")`,
    );
  const ORDRE = [
    "tdp",
    "ouvrieres",
    "cdf",
    "fdfHB",
    "fdfAB",
    "va",
    "vc",
    "champignonniere",
    "puceron",
  ];

  test("un onglet « Partage de données », une case par information, toutes cochées par défaut", () => {
    preferences.lire(`localStorage.clear()`);
    ouvrir();
    expect(
      preferences.lire(`ONGLETS_PARAMETRE.filter((o) => o.id == "Partage").map((o) => o.titre)`),
    ).toEqual(["Partage de données"]);
    // tout partagé avec les autres par défaut : les cases des chefs, cochées, en sont verrouillées
    expect(cases()).toEqual(ORDRE.map((c) => [c, true, true, true]));
    expect(
      preferences.lire<string[]>(
        `$("#o_tabsParametrePartage .o_partageLigne").map((i, l) => l.textContent.replace(/\\s+/g, " ").trim()).get()`,
      ),
    ).toEqual([
      "Partagé avec les chefs : TdP Ov CdF FdF HB FdF AB VA VC Champi Puceron",
      "Partagé avec les autres : TdP Ov CdF FdF HB FdF AB VA VC Champi Puceron",
    ]);
    // l'info-bulle dit l'information, et pourquoi une case des chefs est verrouillée
    expect(
      preferences.lire<string[]>(
        `["cdf", "champignonniere"].map((c) => $("#o_tabsParametrePartage input[data-partage-chefs='" + c + "']").parent().attr("title"))`,
      ),
    ).toEqual([
      "CdF : nombre total d'unités de ton armée, ouvrières non comptées (partagé avec les chefs puisque partagé avec les autres)",
      "Champignonnière : niveau (toujours partagé avec les chefs)",
    ]);
    // le détail, replié sous « En savoir plus »
    const texte = preferences.lire<string>(`$("#o_tabsParametrePartage").text()`);
    for (const dit of [
      "Partager une information avec les autres, c'est aussi la partager avec les chefs.",
      "Champignonnière et Puceron sont toujours partagés avec les chefs.",
      "Elle refait le relevé à la première page ouverte après un changement de niveau de ta Champignonnière ou de ton Étable à pucerons.",
      "ligne « Google Sheet des stats membres » du sujet « Réglages de l'extension »",
      "sans elle, rien n'est relevé ni envoyé ; les chefs sont ceux de la ligne « Chefs » de ce sujet.",
      "TdP : Couveuse + Solarium + Technique de ponte ; CdF : nombre total d'unités de ton armée, ouvrières non comptées",
      "« Chefs : … » : pseudos des chefs : dans la vue « Stats membres » (menu Alliance), ils voient tout ce que les joueurs partagent avec les chefs ; les autres membres, ce qu'ils partagent avec les autres",
    ])
      expect(texte).toContain(dit);
    // retirés à la demande du mainteneur (1.143.2) : l'annonce du premier envoi le dit
    for (const retire of [
      "Une fois par jour",
      "avec ton pseudo et la version de l'extension",
      "Les chefs voient dans la vue",
      "Décochée pour les chefs",
      "Dernier envoi",
      "Aucun envoi depuis ce navigateur",
      "prochain envoi",
      "Ranger le forum",
      "Sujets de floods inutiles",
    ])
      expect(texte).not.toContain(retire);
    expect(preferences.lire(`$("#o_partageEtat").text()`)).toBe("");
  });

  test("case décochée : gardée dans ce navigateur, relue à la réouverture, envoyée à la page suivante", () => {
    preferences.lire(`localStorage.clear()`);
    preferences.lire(
      `localStorage.setItem("fzzz_suiviMembres", JSON.stringify({ doggybag: { jour: "2026-11-12", fait: true, essais: 1, essai: heure, raison: "sans sujet" } }))`,
    );
    ouvrir();
    expect(preferences.lire(`$("#o_partageEtat").text()`)).toBe(
      "Aujourd'hui, rien n'a été envoyé : pas de ligne « Google Sheet des stats membres » dans le sujet « Réglages de l'extension » du forum caché de ton alliance.",
    );
    // vue « Stats membres » construite ensuite, qui rebranche les cases : l'état de l'onglet suit quand même
    preferences.lire(`SuiviMembres.brancherCases()`);
    // plus partagée avec les autres : la case des chefs se déverrouille, toujours cochée
    cocher("autres", "fdfAB", false);
    expect(preferences.lire(`localStorage.getItem("fzzz_partageAutres_fdfAB")`)).toBe("0");
    expect(cases().find(([c]) => c == "fdfAB")).toEqual(["fdfAB", true, false, false]);
    expect(preferences.lire(`SuiviMembres.etat()`)).toMatchObject({ fait: false, essais: 0 });
    // relevé à refaire à la page suivante : plus rien à signaler
    expect(preferences.lire(`$("#o_partageEtat").text()`)).toBe("");
    // plus partagée avec les chefs non plus : gardé, relu à la réouverture
    cocher("chefs", "fdfAB", false);
    expect(preferences.lire(`localStorage.getItem("fzzz_partage_fdfAB")`)).toBe("0");
    ouvrir();
    expect(cases().filter(([, chefs, , autres]) => !chefs || !autres)).toEqual([
      ["fdfAB", false, false, false],
    ]);
    // de nouveau partagée avec les autres : aussi avec les chefs, case verrouillée
    cocher("autres", "fdfAB", true);
    expect(cases().find(([c]) => c == "fdfAB")).toEqual(["fdfAB", true, true, true]);
    expect(
      preferences.lire(
        `[SuiviMembres.partage("fdfAB"), localStorage.getItem("fzzz_partage_fdfAB")]`,
      ),
    ).toEqual([true, "1"]);
  });

  test("Champignonnière et Puceron : case des chefs toujours cochée et verrouillée, même décochée avant ; celle des autres au choix", () => {
    preferences.lire(`(() => {
      localStorage.clear();
      localStorage.setItem("fzzz_partage_puceron", "0");
    })()`);
    ouvrir();
    expect(cases().filter(([c]) => c == "champignonniere" || c == "puceron")).toEqual([
      ["champignonniere", true, true, true],
      // décoché avant : partagé avec les chefs, pas avec les autres
      ["puceron", true, true, false],
    ]);
    cocher("autres", "champignonniere", false);
    expect(cases().find(([c]) => c == "champignonniere")).toEqual([
      "champignonniere",
      true,
      true,
      false,
    ]);
    // une case verrouillée qu'on ferait changer quand même : rien n'est gardé
    cocher("chefs", "champignonniere", false);
    expect(preferences.lire(`SuiviMembres.partage("champignonniere")`)).toBe(true);
    expect(cases().find(([c]) => c == "champignonniere")?.[1]).toBe(true);
  });

  test("export automatique des chasses : une case cochée par défaut, gardée dans ce navigateur, et où en est l'export", () => {
    preferences.lire(`localStorage.clear()`);
    ouvrir();
    const chasses = () =>
      preferences.lire<[boolean, string]>(
        `[$("#o_partageChasses").prop("checked"), $("#o_partageChassesEtat").text()]`,
      );
    const role = (r: string) =>
      preferences.lire(`(() => {
        monProfil.parametre.role.valeur = ${r};
        $("#o_tabsParametrePartage").empty();
        boite.ongletPartage();
      })()`);
    // un autre rôle que Chasseur : rien n'est exporté automatiquement, l'onglet le dit
    role("0");
    expect(chasses()).toEqual([
      true,
      "Ton rôle n'est pas « Chasseur » (Préférences → Général) : tes chasses ne sont pas exportées automatiquement.",
    ]);
    const texte = preferences.lire<string>(`$("#o_tabsParametrePartage").text()`);
    for (const dit of [
      "Rapports de chasse et de combat",
      "Exporter mes chasses automatiquement",
      "Deux fois par semaine au plus : à ton premier clic sur « Envoyer » ou « Envoyer + partager » du lanceur de chasses après le mercredi ou le dimanche 22h (heure du serveur)",
      "une fois les chasses envoyées et après toutes ses autres demandes au jeu",
      "Sans ce clic (chasses lancées avec le formulaire du jeu), rien n'est exporté automatiquement.",
      "Le rappel « Export des chasses à faire » ne s'affiche que si un essai échoue.",
      "Décochée : rien n'est lu ni envoyé sans ton clic sur ce bouton, et le rappel s'affiche dès le mercredi et le dimanche 22h.",
      "ceux que tu n'avais pas lus restent marqués non lus",
      "Le bouton « Exporter mes chasses » ci-dessous reste, pour un export immédiat.",
      "Décochée : rien n'est lu ni envoyé sans ton clic",
    ])
      expect(texte).toContain(dit);
    const chasseur = () => role("ROLE_CHASSEUR");
    chasseur();
    expect(chasses()).toEqual([
      true,
      "Aucun export des chasses mené au bout depuis ce navigateur pour l'instant. Le prochain export se fera après ton prochain clic sur « Envoyer » du lanceur de chasses.",
    ]);
    preferences.lire(`$("#o_partageChasses").prop("checked", false).trigger("change")`);
    expect(preferences.lire(`localStorage.getItem("fzzz_partage_exportChasses")`)).toBe("0");
    expect(preferences.lire(`ExportAuto.actif()`)).toBe(false);
    expect(chasses()).toEqual([
      false,
      "Aucun export des chasses mené au bout depuis ce navigateur pour l'instant.",
    ]);
    // rouverte : la case reste décochée ; recochée : l'export automatique reprend
    ouvrir();
    chasseur();
    expect(chasses()[0]).toBe(false);
    preferences.lire(`$("#o_partageChasses").prop("checked", true).trigger("change")`);
    expect(preferences.lire(`ExportAuto.actif()`)).toBe(true);
    // les cases des statistiques ne sont pas touchées par celle des chasses
    expect(cases()).toEqual(ORDRE.map((c) => [c, true, true, true]));
  });

  test("bouton « Envoyer maintenant » : un relevé forcé, l'état mis à jour", async () => {
    preferences.lire(`localStorage.clear()`);
    ouvrir();
    preferences.lire(`(() => {
      window.FORCES = [];
      SuiviMembres.lancer = (force) => { FORCES.push(force); return Promise.resolve("envoyé"); };
      $("#o_partageEnvoyer").trigger("click");
    })()`);
    expect(
      preferences.lire(
        `[FORCES, $("#o_partageEnvoyer").prop("disabled"), $("#o_partageEtat").text()]`,
      ),
    ).toEqual([[true], true, "Relevé et envoi en cours…"]);
    await attendre();
    expect(
      preferences.lire(`[$("#o_partageEnvoyer").prop("disabled"), $("#o_partageEtat").text()]`),
    ).toEqual([false, "Relevé envoyé."]);
    // échec : la raison gardée par le relevé
    preferences.lire(`(() => {
      SuiviMembres.lancer = () => {
        SuiviMembres._garder({ jour: SuiviMembres.jour(), fait: false, essais: 1, essai: heure, raison: "page Armée illisible" });
        return Promise.resolve("échec");
      };
      $("#o_partageEnvoyer").trigger("click");
    })()`);
    await attendre();
    expect(preferences.lire(`$("#o_partageEtat").text()`)).toBe(
      "Aujourd'hui, le relevé n'a pas pu être envoyé : page Armée illisible. Nouvel essai à une page ouverte plus tard (3 essais par jour au plus).",
    );
    preferences.lire(`(() => {
      SuiviMembres.lancer = () => Promise.resolve("sans alliance");
      $("#o_partageEnvoyer").trigger("click");
    })()`);
    await attendre();
    expect(preferences.lire(`$("#o_partageEtat").text()`)).toBe(
      "Sans alliance, rien n'est relevé.",
    );
    // dernier essai du jour, armée incomplète : envoyé sans CdF ni FdF, et dit
    preferences.lire(`(() => {
      SuiviMembres.lancer = () => {
        SuiviMembres._garder({ jour: SuiviMembres.jour(), fait: true, essais: 3, essai: heure, raison: "", incomplet: ["cdf", "fdfHB", "fdfAB"] });
        return Promise.resolve("envoyé");
      };
      $("#o_partageEnvoyer").trigger("click");
    })()`);
    await attendre();
    expect(preferences.lire<string>(`$("#o_partageEtat").text()`)).toStartWith(
      "Aujourd'hui, relevé envoyé sans CdF, FdF HB et FdF AB :",
    );
  });

  test("boutons « Exporter mes chasses » et « Exporter mes RC » : l'export de la boîte de réception, de n'importe quelle page", async () => {
    preferences.lire(`localStorage.clear()`);
    ouvrir();
    expect(
      preferences.lire(
        `$("#o_tabsParametrePartage .o_exporterRapports").map((i, b) => b.textContent + " " + b.dataset.quoi).get()`,
      ),
    ).toEqual(["Exporter mes chasses chasse", "Exporter mes RC combat"]);
    const exports = await preferences.lire<Promise<any[]>>(`(() => {
      let vus = [];
      ExportRapports.boiteDeReception = (type) => Promise.resolve(["liste " + type]);
      ExportRapports.exporter = (type, $bouton, lister) =>
        Promise.resolve(lister()).then((liste) => vus.push([type, $bouton.text(), liste]));
      $(".o_exporterRapports[data-quoi='chasse']").trigger("click");
      $(".o_exporterRapports[data-quoi='combat']").trigger("click");
      return new Promise((r) => setTimeout(() => r(vus), 0));
    })()`);
    expect(exports).toEqual([
      ["chasse", "Exporter mes chasses", ["liste chasse"]],
      ["combat", "Exporter mes RC", ["liste combat"]],
    ]);
  });
});
