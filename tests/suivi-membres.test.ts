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
    Utils._reine = null; Utils._pageReine = null;
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
    window.FORUM = { section: true, sujets: [{ id: "31", titre: "Stats membres", messages: [${JSON.stringify(ADRESSE)}] }], appels: [], echoue: false };
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
    `(() => { history.replaceState(null, "", ${JSON.stringify(chemin)}); Utils._reine = null; Utils._pageReine = null; SuiviMembres.observer(); })()`,
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
      "Une fois par jour, l'extension envoie au Google Sheet « Stats membres » de ton alliance tes statistiques : TdP, CdF, FdF HB, FdF AB, VA, VC, Puceron et Champignonnière. Elle les renvoie quand le niveau de ta Champignonnière ou de ton Étable à pucerons change. Le premier envoi se fera à ta prochaine page.",
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

  test("sans sujet « Stats membres » : ni annonce, ni lecture, ni envoi, et pas de nouvel essai ce jour-là", async () => {
    lire(`FORUM.sujets = [{ id: "4", titre: "GIF de l'alliance", messages: ["x"] }]`);
    expect(await ouvrirPage()).toBe("sans sujet");
    avancer(120);
    expect(await ouvrirPage()).toBe("attente");
    expect([lire(`TOASTS.length`), lues(), recus(), forum().length]).toEqual([0, [], [], 2]);
    // sujet créé : pris en compte le lendemain
    lire(
      `FORUM.sujets.push({ id: "31", titre: "stats  Membres", messages: [${JSON.stringify(ADRESSE)}] })`,
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
        "pas de sujet « Stats membres » dans la section cachée du forum : rien n'est relevé aujourd'hui",
        undefined,
      ],
    ]);
    lire(`(() => { localStorage.clear(); FORUM.appels = []; $("#tag_alliance").text(""); })()`);
    expect(await ouvrirPage()).toBe("sans alliance");
    expect([forum(), lues(), recus(), lire(`TOASTS.length`)]).toEqual([[], [], [], 0]);
  });

  test("sujet présent mais sans adresse lisible : un échec, repris une heure plus tard quand l'adresse y est", async () => {
    lire(`FORUM.sujets[0].messages = ["bientôt"]`);
    expect(await ouvrirPage()).toBe("échec");
    expect(lire<(string | undefined)[][]>(`NOTES`)).toEqual([
      [
        "relevé du 2026-11-12 non envoyé",
        "pas d'adresse de script lisible dans le sujet « Stats membres »",
      ],
    ]);
    expect([lues(), recus(), lire(`TOASTS.length`), etat().fait]).toEqual([[], [], 0, false]);
    lire(`FORUM.sujets[0].messages = [${JSON.stringify(ADRESSE)}]`);
    avancer(20);
    expect(await ouvrirPage()).toBe("attente");
    // une heure après : les lectures gardées une minute sont périmées
    lire(`(() => { heure += 41 * 60000; PartageChasses.oublierCache(); })()`);
    expect(await ouvrirPage()).toBe("annonce");
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
  });

  test("liste des sujets gardée par une autre version du script (mise à jour dans la minute) : relue, le sujet est trouvé", async () => {
    annonceVue();
    // gardée il y a 5 s par une version qui ne retenait pas le sujet « Stats membres »
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
    lire(`(() => { localStorage.removeItem("fzzz_suiviMembres"); FORUM.appels = []; })()`);
    annonceVue();
    garder({ version: "1.101.0" });
    expect(await ouvrirPage()).toBe("envoyé");
    expect(forum()).toEqual(["callGetForum 7", "callGetTopic 31"]);
    // gardée par cette version : réutilisée, le forum n'est pas relu
    lire(
      `(() => { localStorage.removeItem("fzzz_suiviMembres"); FORUM.appels = []; NOTES = []; })()`,
    );
    annonceVue();
    garder({ version: "1.104.0" });
    expect(await ouvrirPage()).toBe("sans sujet");
    expect(forum()).toEqual([]);
  });
});

describe("cases de Préférences → Partage de données", () => {
  test("information décochée : sa page n'est pas lue, sa valeur n'est pas envoyée, le fichier sait qu'elle n'est pas partagée", async () => {
    annonceVue();
    decocher("cdf", "fdfHB", "fdfAB");
    await ouvrirPage();
    // plus aucune information de l'armée : la page Reine n'est pas lue
    expect(lues()).toEqual(["/construction.php", "/laboratoire.php"]);
    const s = recus()[0].corps.suivi;
    expect(s.donnees).toEqual({ tdp: 38, va: 7, vc: 8, puceron: 2, champignonniere: 17 });
    expect(s.partages).toEqual({ ...TOUT, cdf: false, fdfHB: false, fdfAB: false });
  });

  test("tout décoché : aucune page du jeu lue, seul le fait de ne rien partager est envoyé", async () => {
    annonceVue();
    decocher(...CLES);
    expect(await ouvrirPage()).toBe("envoyé");
    expect(lues()).toEqual([]);
    const s = recus()[0].corps.suivi;
    expect([s.donnees, Object.values(s.partages).every((p) => p === false)]).toEqual([{}, true]);
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

  test("état affiché dans l'onglet", async () => {
    expect(lire(`SuiviMembres.resume()`)).toBe("Aucun envoi depuis ce navigateur pour l'instant.");
    annonceVue();
    decocher("puceron", "champignonniere", "fdfHB", "fdfAB", "va", "vc");
    await ouvrirPage();
    expect(lire(`SuiviMembres.resume()`)).toBe(
      "Dernier envoi depuis ce navigateur : le 12/11/2026 à 08h03 (TdP et CdF).",
    );
    lire(`SuiviMembres.choisir("va", true)`);
    expect(lire<string>(`SuiviMembres.resume()`)).toEndWith(
      "Le prochain envoi se fera à ta prochaine page.",
    );
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
    expect(lire<string>(`SuiviMembres.resume()`)).toContain(
      "Aujourd'hui, le relevé n'a pas pu être envoyé : forum. Nouvel essai à une page ouverte plus tard (3 essais par jour au plus).",
    );
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

  test("niveaux inchangés, autre bâtiment monté, information décochée : rien de refait", async () => {
    await releveDuJour();
    avancer(60);
    expect(await visiter("/construction.php", pageConstruction())).toBe("attente");
    expect(await visiter("/construction.php", pageConstruction({ Couveuse: 15 }))).toBe("attente");
    decocher("puceron");
    expect(await visiter("/construction.php", pageConstruction({ "Etable à pucerons": 3 }))).toBe(
      "attente",
    );
    expect([recus().length, forum().length]).toEqual([1, 3]);
    // niveaux affichés ailleurs que sur la page Construction du joueur : jamais comparés
    expect(await visiter("/Membre.php", pageConstruction({ Champignonnière: 21 }))).toBe("attente");
    // la Champignonnière reste partagée
    expect(await visiter("/construction.php", pageConstruction({ Champignonnière: 18 }))).toBe(
      "envoyé",
    );
    expect(recus()[1].corps.suivi.donnees).toMatchObject({ champignonniere: 18 });
    expect(recus()[1].corps.suivi.donnees.puceron).toBeUndefined();
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

  test("information décochée : la fin de sa construction ne refait rien", async () => {
    await releveDuJour();
    await visiter("/construction.php", pageConstruction({}, ["Etable à pucerons 3", 2 * H]));
    decocher("puceron");
    avancer(150);
    expect(await visiter("/Armee.php")).toBe("attente");
    expect([recus().length, etat().chantier]).toEqual([1, undefined]);
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

  test("annonce : le renvoi au changement de niveau n'est dit que si l'un des deux niveaux est partagé", async () => {
    decocher("puceron", "champignonniere");
    expect(await visiter("/Armee.php")).toBe("annonce");
    expect(lire<string>(`TOASTS[0].text`)).toContain(
      "tes statistiques : TdP, CdF, FdF HB, FdF AB, VA et VC. Le premier envoi se fera à ta prochaine page.",
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
      "js/class/SuiviMembres.js",
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
  const cases = () =>
    preferences.lire<[string, boolean][]>(
      `$("#o_tabsParametrePartage input[data-partage]").map((i, c) => [[c.dataset.partage, c.checked]]).get()`,
    );

  test("un onglet « Partage de données », une case par information, toutes cochées par défaut", () => {
    preferences.lire(`localStorage.clear()`);
    ouvrir();
    expect(
      preferences.lire(`ONGLETS_PARAMETRE.filter((o) => o.id == "Partage").map((o) => o.titre)`),
    ).toEqual(["Partage de données"]);
    expect(cases()).toEqual(CLES.map((c) => [c, true]));
    expect(
      preferences.lire<string[]>(
        `$("#o_tabsParametrePartage label.o_affichageFzzz").map((i, l) => l.textContent.trim()).get()`,
      ),
    ).toEqual([
      "TdP : Couveuse + Solarium + Technique de ponte",
      "CdF : nombre total d'unités de ton armée, ouvrières non comptées",
      "FdF HB : force de frappe de ton armée, hors bonus",
      "FdF AB : force de frappe avec le bonus de la recherche Armes",
      "VA : niveau de Vitesse d'attaque",
      "VC : niveau de Vitesse de chasse",
      "Puceron : niveau de l'Étable à pucerons",
      "Champignonnière : niveau",
    ]);
    // ce qui est envoyé, où, et ce que devient une case décochée : dit dans l'onglet
    const texte = preferences.lire<string>(`$("#o_tabsParametrePartage").text()`);
    for (const dit of [
      "Une fois par jour, à la première page que tu ouvres",
      "Elle le refait à la première page ouverte après un changement de niveau de ta Champignonnière ou de ton Étable à pucerons, si tu partages ce niveau.",
      "Google Sheet « Stats membres » de ton alliance, avec ton pseudo et la version de l'extension",
      "sans ce sujet, rien n'est relevé ni envoyé",
      "le fichier indique seulement que tu ne la partages pas",
      "Aucun envoi depuis ce navigateur pour l'instant.",
    ])
      expect(texte).toContain(dit);
  });

  test("case décochée : gardée dans ce navigateur, relue à la réouverture, envoyée à la page suivante", () => {
    preferences.lire(`localStorage.clear()`);
    preferences.lire(
      `localStorage.setItem("fzzz_suiviMembres", JSON.stringify({ doggybag: { jour: "2026-11-12", fait: true, essais: 1, essai: heure, raison: "sans sujet" } }))`,
    );
    ouvrir();
    preferences.lire(`$("input[data-partage='fdfAB']").prop("checked", false).trigger("change")`);
    expect(preferences.lire(`localStorage.getItem("fzzz_partage_fdfAB")`)).toBe("0");
    expect(preferences.lire(`SuiviMembres.etat()`)).toMatchObject({ fait: false, essais: 0 });
    expect(preferences.lire<string>(`$("#o_partageEtat").text()`)).toEndWith(
      "Le prochain envoi se fera à ta prochaine page.",
    );
    ouvrir();
    expect(cases().filter(([, coche]) => !coche)).toEqual([["fdfAB", false]]);
    preferences.lire(`$("input[data-partage='fdfAB']").prop("checked", true).trigger("change")`);
    expect(preferences.lire(`SuiviMembres.partage("fdfAB")`)).toBe(true);
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
    expect(preferences.lire(`$("#o_partageEnvoyer").prop("disabled")`)).toBe(false);
  });
});
