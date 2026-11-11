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
const CONSTRUCTION = `<table>${[
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
]
  .map(([n, v]) => ligne(String(n), Number(v)))
  .join("")}</table>`;
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
const ouvrirPage = async (chemin = "/Armee.php") => {
  lire(
    `(() => { history.replaceState(null, "", ${JSON.stringify(chemin)}); Utils._reine = null; Utils._pageReine = null; })()`,
  );
  const resultat = await lire<Promise<string>>(`SuiviMembres.lancer()`);
  await attendre();
  return resultat;
};
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
      "Une fois par jour, l'extension envoie au Google Sheet « Stats membres » de ton alliance tes statistiques : TdP, CdF, FdF HB, FdF AB, VA, VC, Puceron et Champignonnière. Le premier envoi se fera à ta prochaine page.",
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

  test("section cachée absente ou invisible pour le grade, sujet sans adresse, joueur sans alliance : rien", async () => {
    lire(`FORUM.section = false`);
    expect(await ouvrirPage()).toBe("sans sujet");
    lire(
      `(() => { localStorage.clear(); FORUM.section = true; FORUM.sujets[0].messages = ["bientôt"]; })()`,
    );
    expect(await ouvrirPage()).toBe("sans sujet");
    lire(`(() => { localStorage.clear(); FORUM.appels = []; $("#tag_alliance").text(""); })()`);
    expect(await ouvrirPage()).toBe("sans alliance");
    expect([forum(), lues(), recus(), lire(`TOASTS.length`)]).toEqual([[], [], [], 0]);
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
