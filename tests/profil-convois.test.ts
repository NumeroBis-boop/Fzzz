import { beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { creerPage } from "./harnais";

/**
 * Profil du site de suivi des convois (1.138.0, demande du mainteneur du
 * 19/11/2026) : une fois par jour, avec le relevé des stats membres, et quand
 * le niveau de la Champignonnière ou de l'Étable à pucerons change, la page
 * « Mon profil » du site reçoit ces deux niveaux et le nombre total
 * d'ouvrières. Site, joueurs et nombres inventés ; le vrai site n'est jamais
 * appelé : son API est simulée d'après les scripts de sa page (GET puis PUT
 * /api/profil, champs envoyés en texte comme ceux de la page).
 */
const page = creerPage(
  [
    "js/class/Utils.js",
    "js/class/ExportRapports.js",
    "js/class/Armee.js",
    "js/page/PartageChasses.js",
    "js/class/OuafSuivi.js",
    "js/class/SuiviMembres.js",
    "js/class/ProfilConvois.js",
    "js/content.js",
  ],
  // constantes du jeu (content.js) ; l'encart « Connexion » empêche le démarrage
  `var chrome = { runtime: { getManifest: () => ({ version: "1.138.0" }), getURL: (p) => p } };
   document.body.innerHTML = "<div class='boite_connexion_titre'>Connexion</div>";
   var heure = moment("2026-11-19 08:03", "YYYY-MM-DD HH:mm").valueOf();
   var Horloge = { maintenant: () => heure, serveur: () => moment(heure) };
   var monProfil = { pseudo: "Alpha" };
   var BoiteParametre = { ouvrirOnglet: (id) => (window.ONGLET_OUVERT = id) };`,
  "https://s5.fourmizzz.fr/Ressources.php",
);
const lire = <T = any>(e: string) => page.lire<T>(e);

const SITE = "http://convois.example.org";
const FEUILLE =
  "Google Sheet des stats membres : https://script.google.com/macros/s/AKfycbInvente123/exec";
const REGLAGES = `Site de suivi des convois : ${SITE}\n${FEUILLE}`;
const ligne = (nom: string, niveau: number) =>
  `<tr class="ligneAmelioration"><td><h2>${nom}</h2><span class="niveau_amelioration">niveau ${niveau}</span></td></tr>`;
const construction = (puceron = 2, champi = 17) =>
  `<div id="centre"><table>${[
    ["Champignonnière", champi],
    ["Couveuse", 14],
    ["Solarium", 12],
    ["Etable à pucerons", puceron],
  ]
    .map(([n, v]) => ligne(String(n), Number(v)))
    .join("")}</table></div>`;
const LABORATOIRE = `<table>${[
  ["Technique de ponte", 12],
  ["Armes", 9],
  ["Vitesse de chasse", 8],
  ["Vitesse d'attaque", 7],
]
  .map(([n, v]) => ligne(String(n), Number(v)))
  .join("")}</table>`;
// page Reine : toutes les ouvrières, celles parties en convoi comprises
const REINE = `<table><tr class="ligneAmelioration"><td><h2>Ouvrière</h2><span id="armee_initial">70 481</span></td></tr><tr class="ligneAmelioration"><td><h2>Jeune Soldate Naine</h2><span id="armee_initial1">1 000</span></td></tr></table>`;
const PAGE_ARMEE = `<table class="simulateur"><tr align="center"><td><span class="pas_sur_telephone">Jeune Soldate Naine</span></td></tr></table>`;
// encart Compte+ du jeu, présent sur chaque page : ligne de la construction en cours
const encart = (nom = "Aucune construction", secondes = 0) =>
  `<table><tr id="ligne_construction"><td></td><td><a href="construction.php">${nom}</a></td><td>${
    secondes
      ? `<a id="temps_construction"></a><script>$(function() { resteTemps(${secondes},"temps_construction"); });</script>`
      : ""
  }</td></tr></table>`;

beforeEach(() => {
  lire(`(() => {
    localStorage.clear();
    heure = moment("2026-11-19 08:03", "YYYY-MM-DD HH:mm").valueOf();
    monProfil.pseudo = "Alpha";
    document.documentElement.classList.remove("o_origineGenerale");
    window.TOASTS = [];
    $.toast = (o) => { TOASTS.push(o); return {}; };
    window.NOTES = [];
    Journal.info = (source, message, detail) => NOTES.push([source, message, detail]);
    Journal.erreur = (source, message, detail) => NOTES.push([source, message, detail]);
    // le joueur a déjà vu l'annonce du relevé des stats membres
    localStorage.setItem("fzzz_suiviMembres", JSON.stringify({ alpha: { annonce: true } }));
    window.JEU = { lues: [], pages: { "/construction.php": ${JSON.stringify(construction())}, "/laboratoire.php": ${JSON.stringify(LABORATOIRE)},
      "/Reine.php": ${JSON.stringify(REINE)}, "/Armee.php": ${JSON.stringify(PAGE_ARMEE)} } };
    $.get = (url) => {
      let chemin = new URL(url).pathname;
      JEU.lues.push(chemin);
      return JEU.panne == chemin ? Promise.reject({ status: 503 }) : Promise.resolve(JEU.pages[chemin]);
    };
    // forum : sujet des réglages de l'alliance dans la section cachée
    window.FORUM = { sujets: [{ id: "31", titre: "Réglages de l'extension", messages: [${JSON.stringify(REGLAGES)}] }] };
    PartageChasses.idSection = null;
    PartageChasses.oublierCache();
    PartageChasses._html = (d) => d;
    PartageChasses._xajax = (f, args) => {
      if (f == "callGetForum" && !args) return Promise.resolve('<span class="forum7">BDD partagée cachée</span>');
      if (f == "callGetForum")
        return Promise.resolve('<form id="form_cat"><table>' + FORUM.sujets.map((s) => '<tr><td><input name="topic[]" value="' + s.id + '"/></td><td>' + s.titre + '</td></tr>').join("") + "</table></form>");
      const s = FORUM.sujets.find((s) => s.id == args);
      return Promise.resolve(s ? s.messages.map((m) => '<div class="messageForum">' + m + "</div>").join("") : "");
    };
    // stockage de l'extension : site accepté, mot de passe enregistré
    window.STOCKAGE = { fzzz_ouafCode: "mdp-invente", fzzz_siteConvoisAccepte: ${JSON.stringify(SITE)} };
    chrome.storage = { local: {
      get: (c) => Promise.resolve(c in STOCKAGE ? { [c]: STOCKAGE[c] } : {}),
      set: (o) => { Object.assign(STOCKAGE, o); return Promise.resolve(); },
      remove: (c) => { delete STOCKAGE[c]; return Promise.resolve(); },
    } };
    // site de suivi simulé : la réponse d'un PUT est le profil enregistré, comme le lit sa page
    window.SITE = { requetes: [], corps: [], mdp: "mdp-invente", panne: false, refus: "",
      profil: { pseudo: "Alpha", etable_puceron: 0, champi: 20, ouvriere: 0, champi_max: 36, ouvrieres_actives: false, sans_reception: true } };
    window.SHEET = [];
    chrome.runtime.sendMessage = (m) => {
      if (m.type == "fzzz_sheet") { SHEET.push(m.corps); return Promise.resolve({ ok: true, statut: 200, donnees: { ok: true } }); }
      SITE.requetes.push(m.methode + " " + m.chemin);
      if (m.site != ${JSON.stringify(SITE)}) return Promise.resolve({ erreur: "requete" });
      if (SITE.panne) return Promise.resolve({ erreur: "reseau" });
      const ok = (d) => Promise.resolve({ ok: true, statut: 200, donnees: d });
      if (m.chemin == "/api/session")
        return ok(m.corps.mot_de_passe == SITE.mdp ? { connecte: true, pseudo: SITE.profil.pseudo } : { connecte: false, erreur: "Ce mot de passe ne correspond à personne." });
      if (m.chemin == "/api/profil" && m.methode == "GET")
        return SITE.refus ? Promise.resolve({ ok: false, statut: 403, donnees: { detail: SITE.refus } }) : ok({ ...SITE.profil });
      if (m.chemin == "/api/profil" && m.methode == "PUT") {
        SITE.corps.push(m.corps);
        SITE.profil = { ...SITE.profil, etable_puceron: Number(m.corps.etable_puceron),
          champi: Math.min(Number(m.corps.champi), SITE.profil.champi_max), ouvriere: Number(m.corps.ouvriere),
          sans_reception: m.corps.sans_reception };
        return ok({ ...SITE.profil });
      }
      return Promise.resolve({ ok: false, statut: 404, donnees: { detail: "Not Found" } });
    };
  })()`);
});

// comme content.js : les deux observer() avant le module de la page, puis le
// relevé, puis le profil du site ; chaque page repart sans lecture ni connexion
const ouvrirPage = async (chemin = "/Ressources.php", html = "") => {
  lire(`(() => {
    history.replaceState(null, "", ${JSON.stringify(chemin)});
    document.body.innerHTML = "<span id='tag_alliance'>OUAF</span>" + ${JSON.stringify(html)};
    Utils._reine = null; Utils._pageReine = null; SuiviMembres._lues = {};
    connexionOuaf = null; ouafPanne = 0;
    ProfilConvois.observer();
    SuiviMembres.observer();
  })()`);
  const releve = await lire<Promise<string>>(`SuiviMembres.lancer()`);
  return { releve, profil: await lire<Promise<string>>(`ProfilConvois.lancer()`) };
};
const requetes = () => lire<string[]>(`SITE.requetes.splice(0)`);
const corps = () => lire<any[]>(`SITE.corps.slice()`);
const lues = () => lire<string[]>(`JEU.lues.splice(0)`);
// texte affiché des notifications (leur texte est du HTML)
const toasts = () => lire<string[]>(`TOASTS.map((t) => $("<div>").html(t.text).text())`);
const avancer = (minutes: number) => lire(`heure += ${minutes} * 60000`);
const etat = () => lire<any>(`ProfilConvois.etat()`);
const reglages = (texte: string) =>
  lire(`FORUM.sujets[0].messages = [${JSON.stringify(texte)}]; PartageChasses.oublierCache()`);
const resume = () =>
  lire<Promise<string>>(
    `Promise.all([OuafSuivi.siteAccepte(), OuafSuivi.codeEnregistre()]).then(([a, c]) => ProfilConvois.resume(a, c))`,
  );
const PROFIL = { etable_puceron: "2", champi: "17", ouvriere: "70481", sans_reception: true };
const MISE_A_JOUR = ["POST /api/session", "GET /api/profil", "PUT /api/profil"];

describe("une fois par jour, avec le relevé des stats membres", () => {
  test("pages Construction et Reine lues une fois pour le fichier et le site ; profil écrit comme « Enregistrer »", async () => {
    expect(await ouvrirPage()).toEqual({ releve: "envoyé", profil: "envoyé" });
    expect(lues()).toEqual(["/construction.php", "/laboratoire.php", "/Reine.php"]);
    expect(requetes()).toEqual(MISE_A_JOUR);
    // en texte comme les champs de la page du site ; la case « Je ne souhaite
    // pas recevoir de convois » renvoyée telle que le site la donne
    expect(corps()).toEqual([PROFIL]);
    expect(lire(`SHEET.length`)).toBe(1);
    expect(etat()).toMatchObject({
      jour: "2026-11-19",
      fait: true,
      envoi: { site: SITE, ecrit: true, puceron: 2, champignonniere: 17, ouvrieres: 70481 },
    });
    expect(await resume()).toBe(
      "Profil du site mis à jour le 19/11 à 08h03 : étable 2, champi 17, ouvrières 70 481.",
    );
    // pages suivantes du même jour : ni lecture du jeu, ni requête au site
    avancer(90);
    expect((await ouvrirPage()).profil).toBe("attente");
    expect([lues(), requetes()]).toEqual([[], []]);
    // le lendemain : de nouveau, case gardée décochée sur le site
    lire(`SITE.profil.sans_reception = false`);
    avancer(24 * 60);
    expect((await ouvrirPage()).profil).toBe("à jour");
    expect(requetes()).toEqual(["POST /api/session", "GET /api/profil"]);
    expect(corps()).toHaveLength(1);
    expect(await resume()).toBe(
      "Profil du site vérifié, déjà à jour, le 20/11 à 09h33 : étable 2, champi 17, ouvrières 70 481.",
    );
  });

  test("case « Je ne souhaite pas recevoir de convois » décochée sur le site : renvoyée décochée", async () => {
    lire(`SITE.profil.sans_reception = false`);
    await ouvrirPage();
    expect(corps()).toEqual([{ ...PROFIL, sans_reception: false }]);
    expect(lire(`SITE.profil.sans_reception`)).toBe(false);
  });

  test("« Ov » et l'armée décochées pour le fichier : le site reçoit quand même les ouvrières (page Reine lue pour lui)", async () => {
    lire(
      `["ouvrieres", "cdf", "fdfHB", "fdfAB"].forEach((c) => { localStorage.setItem("fzzz_partage_" + c, "0"); localStorage.setItem("fzzz_partageAutres_" + c, "0"); })`,
    );
    await ouvrirPage();
    expect(lire(`SHEET[0].suivi.donnees.ouvrieres`)).toBeUndefined();
    expect(lues()).toEqual(["/construction.php", "/laboratoire.php", "/Reine.php"]);
    expect(corps()).toEqual([PROFIL]);
  });

  test("sans fichier « Stats membres » dans les réglages : le profil du site est quand même mis à jour", async () => {
    reglages(`Site de suivi des convois : ${SITE}`);
    expect(await ouvrirPage()).toEqual({ releve: "sans sujet", profil: "envoyé" });
    expect(lues()).toEqual(["/construction.php", "/Reine.php"]);
    expect(corps()).toEqual([PROFIL]);
  });

  test("relevé du jour déjà fait (mise à jour de l'extension) : le site reçoit son premier profil ce jour-là", async () => {
    // réglages lus par ce relevé, plus tôt dans la journée
    await lire(`ReglagesAlliance.charger()`);
    lire(
      `localStorage.setItem("fzzz_suiviMembres", JSON.stringify({ alpha: { annonce: true, jour: "2026-11-19", fait: true, essais: 1, essai: heure } }))`,
    );
    expect(await ouvrirPage()).toEqual({ releve: "attente", profil: "envoyé" });
    expect(lues()).toEqual(["/construction.php", "/Reine.php"]);
  });

  test("pas de site de suivi dans les réglages : rien n'est lu ni envoyé, personne n'est prévenu", async () => {
    reglages(FEUILLE);
    expect((await ouvrirPage()).profil).toBe("sans site");
    expect(requetes()).toEqual([]);
    expect(toasts()).toEqual([]);
  });

  test("page Armée ou d'attaque : la mise à jour attend la page suivante", async () => {
    expect((await ouvrirPage("/Armee.php")).profil).toBe("attente");
    expect(requetes()).toEqual([]);
    lues();
    expect((await ouvrirPage("/ennemie.php?Attaquer=123")).profil).toBe("attente");
    expect((await ouvrirPage()).profil).toBe("envoyé");
  });

  test("réglages qui donnent un autre site, accepté : profil écrit sur ce site le jour même", async () => {
    await ouvrirPage();
    requetes();
    const autre = "http://autre.example.org";
    lire(`STOCKAGE.fzzz_siteConvoisAccepte = ${JSON.stringify(autre)}`);
    reglages(`Site de suivi des convois : ${autre}\n${FEUILLE}`);
    // les réglages relus par le relevé (plus d'une minute après la lecture d'avant)
    avancer(2);
    await lire(`ReglagesAlliance.charger({}, "tout")`);
    expect((await ouvrirPage()).profil).toBe("échec");
    // le site simulé ne répond qu'à son adresse : la requête est bien partie vers l'autre
    expect(requetes()).toEqual(["POST /api/session"]);
    expect(etat().envoi.site).toBe(SITE);
  });
});

describe("Champignonnière ou Étable à pucerons qui change de niveau", () => {
  test("page Construction ouverte avec un autre niveau que celui envoyé : profil refait sur cette page", async () => {
    await ouvrirPage();
    requetes();
    avancer(120);
    lire(`JEU.pages["/construction.php"] = ${JSON.stringify(construction(3))}`);
    expect((await ouvrirPage("/construction.php", construction(3))).profil).toBe("envoyé");
    expect(corps()[1]).toEqual({ ...PROFIL, etable_puceron: "3" });
    expect(
      lire(`NOTES.filter((n) => n[0] == "Profil du site de suivi").map((n) => n[1])`),
    ).toContain("niveau changé depuis la mise à jour du profil : à refaire");
    // même niveau affiché ensuite : rien
    avancer(5);
    expect((await ouvrirPage("/construction.php", construction(3))).profil).toBe("attente");
  });

  test("ailleurs : construction suivie terminée (encart Compte+ du jeu)", async () => {
    await ouvrirPage("/Ressources.php", encart());
    requetes();
    // la Champignonnière 18 est lancée, finie dans 10 minutes
    avancer(30);
    expect((await ouvrirPage("/Ressources.php", encart("Champignonnière", 600))).profil).toBe(
      "attente",
    );
    avancer(11);
    lire(`JEU.pages["/construction.php"] = ${JSON.stringify(construction(2, 18))}`);
    expect((await ouvrirPage("/Ressources.php", encart())).profil).toBe("envoyé");
    expect(corps()[1]).toEqual({ ...PROFIL, champi: "18" });
  });

  test("niveau changé avant la mise à jour du jour : une seule mise à jour, avec le nouveau niveau", async () => {
    lire(`JEU.pages["/construction.php"] = ${JSON.stringify(construction(4))}`);
    await ouvrirPage("/construction.php", construction(4));
    expect(corps()).toEqual([{ ...PROFIL, etable_puceron: "4" }]);
  });
});

describe("réglages du joueur manquants : il est prévenu, une fois par jour", () => {
  test("site pas accepté : rien n'est lu pour le site ni envoyé", async () => {
    lire(`delete STOCKAGE.fzzz_siteConvoisAccepte`);
    expect((await ouvrirPage()).profil).toBe("à régler");
    expect(requetes()).toEqual([]);
    expect(lues()).toEqual(["/construction.php", "/laboratoire.php", "/Reine.php"]);
    expect(toasts()).toEqual([
      "Ton profil sur le site de suivi des convois n'est pas mis à jour : tu n'as pas encore accepté le site convois.example.org. À régler dans Préférences → Convois.",
    ]);
    expect(lire(`$("<div>").html(TOASTS[0].text).find("a.o_ouvrirConvois").text()`)).toBe(
      "Préférences → Convois",
    );
    expect(await resume()).toBe(
      "Ton profil sur le site (Étable à pucerons, Champignonnière, ouvrières) n'est mis à jour qu'une fois ce site accepté.",
    );
    // pages suivantes du jour : plus d'avertissement
    avancer(10);
    expect((await ouvrirPage()).profil).toBe("à régler");
    expect(toasts()).toHaveLength(1);
    // le lien ouvre l'onglet Convois des Préférences
    lire(
      `$("body").append("<a href='#' class='o_ouvrirConvois'>x</a>"); $(".o_ouvrirConvois").last().trigger("click")`,
    );
    expect(lire(`window.ONGLET_OUVERT`)).toBe("Convois");
    // le lendemain : de nouveau
    avancer(24 * 60);
    await ouvrirPage();
    expect(toasts()).toHaveLength(2);
  });

  test("aucun mot de passe dans ce navigateur ; enregistré ensuite : profil écrit à la page suivante", async () => {
    lire(`delete STOCKAGE.fzzz_ouafCode`);
    expect((await ouvrirPage()).profil).toBe("à régler");
    expect(requetes()).toEqual([]);
    expect(toasts()[0]).toContain("aucun mot de passe du site n'est enregistré dans ce navigateur");
    lire(`STOCKAGE.fzzz_ouafCode = "mdp-invente"`);
    avancer(1);
    expect((await ouvrirPage()).profil).toBe("envoyé");
    expect(requetes()).toEqual(MISE_A_JOUR);
  });

  test("« Toutes les pages » décochée dans Préférences → Pages : pas d'avertissement affiché", async () => {
    lire(
      `delete STOCKAGE.fzzz_ouafCode; document.documentElement.classList.add("o_origineGenerale")`,
    );
    expect((await ouvrirPage()).profil).toBe("à régler");
    expect(toasts()).toEqual([]);
    lire(`document.documentElement.classList.remove("o_origineGenerale")`);
    await ouvrirPage();
    expect(toasts()).toHaveLength(1);
  });

  test("mot de passe refusé : prévenu, nouvel essai une heure plus tard, trois par jour ; corrigé : page suivante", async () => {
    lire(`SITE.mdp = "autre"`);
    expect((await ouvrirPage()).profil).toBe("échec");
    expect(requetes()).toEqual(["POST /api/session"]);
    expect(toasts()).toEqual([
      "Ton profil sur le site de suivi des convois n'est pas mis à jour : le site convois.example.org refuse le mot de passe enregistré dans ce navigateur. À régler dans Préférences → Convois.",
    ]);
    avancer(30);
    expect((await ouvrirPage()).profil).toBe("attente");
    avancer(31);
    expect((await ouvrirPage()).profil).toBe("échec");
    avancer(61);
    expect((await ouvrirPage()).profil).toBe("échec");
    expect(await resume()).toBe(
      "Aujourd'hui, ton profil sur le site n'a pas pu être mis à jour : mot de passe refusé par le site de suivi. Nouvel essai demain.",
    );
    avancer(61);
    expect((await ouvrirPage()).profil).toBe("attente");
    expect(toasts()).toHaveLength(1);
    // mot de passe corrigé dans les Préférences : sans attendre le lendemain
    lire(`SITE.mdp = "mdp-invente"; ProfilConvois.reprendre()`);
    requetes();
    expect((await ouvrirPage()).profil).toBe("envoyé");
    expect(requetes()).toEqual(MISE_A_JOUR);
  });
});

describe("le site n'est modifié que s'il le faut, et jamais à tort", () => {
  test("mot de passe d'un autre joueur sur le site : son profil n'est pas touché", async () => {
    lire(`SITE.profil.pseudo = "Bravo"`);
    expect((await ouvrirPage()).profil).toBe("échec");
    expect(requetes()).toEqual(["POST /api/session", "GET /api/profil"]);
    expect(corps()).toEqual([]);
    expect(toasts()[0]).toContain(
      "le mot de passe enregistré dans ce navigateur est celui de Bravo sur le site, pas le tien",
    );
  });

  test("pseudo du site écrit autrement (casse) : c'est bien le joueur", async () => {
    lire(`SITE.profil.pseudo = "ALPHA"`);
    expect((await ouvrirPage()).profil).toBe("envoyé");
  });

  test("joueur absent de l'équipe du site : échec avec la réponse du site, sans avertissement", async () => {
    lire(`SITE.refus = "Tu n’es pas encore dans l’équipe."`);
    expect((await ouvrirPage()).profil).toBe("échec");
    expect(etat().raison).toBe("Tu n’es pas encore dans l’équipe.");
    expect(toasts()).toEqual([]);
  });

  test("profil sans la case « Je ne souhaite pas recevoir de convois » : rien n'est écrit", async () => {
    lire(`delete SITE.profil.sans_reception`);
    expect((await ouvrirPage()).profil).toBe("échec");
    expect(corps()).toEqual([]);
  });

  test("valeur que le site ne garde pas (champi au-dessus de son maximum) : échec, repris plus tard", async () => {
    lire(`SITE.profil.champi_max = 16`);
    expect((await ouvrirPage()).profil).toBe("échec");
    expect(etat().raison).toBe("le site a gardé champi 16 au lieu de 17");
  });

  test("site sans réponse : échec, nouvel essai à une page ouverte une heure plus tard", async () => {
    lire(`SITE.panne = true`);
    expect((await ouvrirPage()).profil).toBe("échec");
    expect(etat()).toMatchObject({ fait: false, essais: 1 });
    lire(`SITE.panne = false`);
    avancer(61);
    expect((await ouvrirPage()).profil).toBe("envoyé");
  });

  test("page Construction illisible : rien n'est écrit (jamais un niveau inventé)", async () => {
    reglages(`Site de suivi des convois : ${SITE}`);
    lire(`JEU.pages["/construction.php"] = "<div id='centre'>Connexion</div>"`);
    expect((await ouvrirPage()).profil).toBe("échec");
    expect(requetes()).toEqual(["POST /api/session", "GET /api/profil"]);
    expect(corps()).toEqual([]);
    expect(etat().raison).toBe("niveau introuvable sur la page Construction : etable a pucerons");
  });

  test("page du jeu sans réponse : échec lisible dans les Préférences, rien d'écrit", async () => {
    reglages(`Site de suivi des convois : ${SITE}`);
    lire(`JEU.panne = "/construction.php"`);
    expect((await ouvrirPage()).profil).toBe("échec");
    expect(corps()).toEqual([]);
    expect(await resume()).toBe(
      "Aujourd'hui, ton profil sur le site n'a pas pu être mis à jour : page du jeu sans réponse (erreur 503). Nouvel essai à une page ouverte au moins une heure plus tard (3 essais par jour au plus).",
    );
  });

  test("site injoignable ou mot de passe refusé : aucune page du jeu lue pour lui", async () => {
    // sans fichier « Stats membres », le relevé ne lit rien : seules les lectures du profil comptent
    reglages(`Site de suivi des convois : ${SITE}`);
    lire(`SITE.panne = true`);
    expect((await ouvrirPage()).profil).toBe("échec");
    expect([requetes(), lues()]).toEqual([["POST /api/session"], []]);
    lire(`SITE.panne = false; SITE.mdp = "autre"`);
    avancer(61);
    expect((await ouvrirPage()).profil).toBe("échec");
    expect([requetes(), lues()]).toEqual([["POST /api/session"], []]);
  });
});

describe("règles s5", () => {
  test("aucune minuterie ; une seule mise à jour automatique, au démarrage de la page, après le relevé", () => {
    const source = (f: string) => readFileSync(join(import.meta.dir, "..", "public", f), "utf8");
    expect(source("js/class/ProfilConvois.js")).not.toMatch(
      /setTimeout|setInterval|requestAnimationFrame/,
    );
    const demarrage = source("js/content.js");
    expect(demarrage.match(/ProfilConvois\.\w+\(/g)).toEqual([
      "ProfilConvois.observer(",
      "ProfilConvois.lancer(",
    ]);
    // observer() avant celui du relevé, qui oublie la construction finie, et avant le module de la page
    expect(demarrage.indexOf("ProfilConvois.observer()")).toBeLessThan(
      demarrage.indexOf("SuiviMembres.observer()"),
    );
    expect(demarrage.indexOf("SuiviMembres.observer()")).toBeLessThan(
      demarrage.indexOf("switch (true)"),
    );
    expect(demarrage.indexOf("ProfilConvois.lancer()")).toBeGreaterThan(
      demarrage.indexOf("SuiviMembres.lancer()"),
    );
    // ailleurs : seulement la reprise après un réglage des Préférences, sans requête
    for (const f of ["js/boite/Parametres.js", "js/page/CommerceFzzz.js", "js/class/OuafSuivi.js"])
      expect(source(f)).not.toMatch(/ProfilConvois\.(lancer|observer|lireProfil|ecrire)\(/);
  });
});

describe("Préférences → Convois", () => {
  test("ligne d'état sous le mot de passe ; mot de passe enregistré : mise à jour à la page suivante", async () => {
    const p = creerPage(
      [
        "js/class/Utils.js",
        "js/class/OuafSuivi.js",
        "js/class/SuiviMembres.js",
        "js/class/ProfilConvois.js",
        "js/boite/Boite.js",
        "js/boite/Parametres.js",
        "js/content.js",
      ],
      `var STOCKAGE = { fzzz_ouafCode: "mdp-invente", fzzz_siteConvoisAccepte: ${JSON.stringify(SITE)} };
       var chrome = { runtime: { getManifest: () => ({ version: "1.138.0" }), getURL: (p) => p },
         storage: { local: {
           get: (c) => Promise.resolve(c in STOCKAGE ? { [c]: STOCKAGE[c] } : {}),
           set: (o) => { Object.assign(STOCKAGE, o); return Promise.resolve(); },
           remove: (c) => { delete STOCKAGE[c]; return Promise.resolve(); } } } };
       document.body.innerHTML = "<div class='boite_connexion_titre'>Connexion</div>";
       var ROLES = ["Aucun"];
       var heure = moment("2026-11-19 08:03", "YYYY-MM-DD HH:mm").valueOf();
       var Horloge = { maintenant: () => heure, serveur: () => moment(heure) };
       var monProfil = { pseudo: "Alpha", parametre: { role: { valeur: 0 }, convoisAvantRecolte: { getForm: () => "" } } };`,
    );
    const attendre = () => new Promise((r) => setTimeout(r, 0));
    p.lire(`(() => {
      localStorage.setItem("fzzz_reglagesAlliance", JSON.stringify({ lu: 0, section: true, sujet: true, reglages: { siteConvois: ${JSON.stringify(SITE)} } }));
      localStorage.setItem("fzzz_profilConvois", JSON.stringify({ alpha: { jour: "2026-11-19", fait: true, essais: 1, essai: heure,
        envoi: { instant: heure, site: ${JSON.stringify(SITE)}, ecrit: true, puceron: 6, champignonniere: 20, ouvrieres: 68031 } } }));
      document.body.innerHTML = '<div id="o_tabsParametreConvois"></div>';
      BoiteParametre.prototype.ongletConvois.call(BoiteParametre.prototype);
    })()`);
    await attendre();
    await attendre();
    expect(p.lire<string>(`$("#o_ouafCodeEtat").next().attr("id")`)).toBe("o_profilSiteEtat");
    expect(p.lire<string>(`$("#o_profilSiteEtat").text()`)).toBe(
      "Profil du site mis à jour le 19/11 à 08h03 : étable 6, champi 20, ouvrières 68 031.",
    );
    p.lire(`$("#o_ouafCode").val("nouveau-mdp"); $("#o_ouafCodeEnregistrer").trigger("click")`);
    await attendre();
    await attendre();
    await attendre();
    expect(p.lire(`STOCKAGE.fzzz_ouafCode`)).toBe("nouveau-mdp");
    expect(p.lire(`ProfilConvois.etat()`)).toMatchObject({ fait: false, essais: 0, essai: 0 });
    expect(p.lire<string>(`$("#o_profilSiteEtat").text()`)).toBe(
      "Profil du site mis à jour le 19/11 à 08h03 : étable 6, champi 20, ouvrières 68 031. Ton profil sur le site (Étable à pucerons, Champignonnière, ouvrières) sera mis à jour à ta prochaine page.",
    );
  });
});
