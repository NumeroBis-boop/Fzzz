import { beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { creerPage } from "./harnais";

/**
 * Page Ressources : les floods partagés sur le joueur qui arrivent d'ici le
 * délai de Préférences → Ressources (1 h par défaut) s'affichent à droite des
 * boutons d'envoi du lanceur de chasses (demande du mainteneur, 20/11/2026) ;
 * sans flood dans le délai, la page ne change pas. Lus à l'ouverture de la
 * page, le texte refait chaque minute sans lecture. Joueurs inventés.
 */
const page = creerPage(
  [
    "js/class/Utils.js",
    "js/class/Parametre.js",
    "js/class/Joueur.js",
    "js/page/PartageChasses.js",
    "js/page/Ressource.js",
    "js/class/AlerteFloods.js",
  ],
  `var heure = moment("2026-11-12 10:00:00", "YYYY-MM-DD HH:mm:ss").valueOf();
   var Horloge = { maintenant: () => heure, serveur: () => moment(heure), clic: () => moment(heure) };
   var monProfil = { pseudo: "Moi", parametre: {} };`,
  "https://s5.fourmizzz.fr/Ressources.php",
);
const lire = <T = any>(e: string) => page.lire<T>(e);
lire(`window.ORIGINE = { charger: PartageChasses.charger }`);
const attendre = () => new Promise((r) => setTimeout(r, 20));
const espaces = (t: string) => t.replace(/[\s  ]+/g, " ").trim();

const ligneMembre = (pseudo: string, terrain: string) =>
  `<tr><td></td><td>1</td><td>Membre</td><td><a href="Membre.php?Pseudo=${pseudo}">${pseudo}</a></td><td></td><td>${terrain}</td></tr>`;
const MEMBRES = `<table id="tabMembresAlliance">${ligneMembre("Moi", "99 000")}${ligneMembre("Autre", "150 000")}${ligneMembre("Loin", "1 000 000")}</table>`;
const flood = (id: number, date: string, lanceur: string, cible: string, unites: number) => ({
  date: "2026-11-12 " + date,
  cible,
  unites,
  terrain: unites,
  tdcCible: 100000,
  id,
  lanceur,
});
// boutons d'envoi du lanceur, comme LanceurChasse les écrit sur la page Ressources
const BOUTONS = `<div id='o_prepaChasse' class='centre'><div class='o_pile o_marginT15'><button id='o_chasseEnvoyer'>Envoyer</button><button id='o_chasseEnvoyerPartager'>Envoyer + partager</button></div></div>`;

beforeEach(() => {
  lire(`(() => {
    localStorage.clear();
    heure = moment("2026-11-12 10:00:00", "YYYY-MM-DD HH:mm:ss").valueOf();
    monProfil.parametre = {};
    document.body.innerHTML = "<span id='tag_alliance'>OUAF</span><span id='quantite_tdc'>100000</span><div id='boite_tdc'></div>" + ${JSON.stringify(BOUTONS)};
    window.JEU = { lues: [], chargements: 0, illisible: false };
    // essais du mainteneur : joueur de la ligne « Journal » des réglages ou non
    window.ESSAI = false;
    Journal.pourCeJoueur = () => ESSAI;
    window.FORUM = { chasses: {}, floods: [] };
    PartageChasses.charger = (de = null, avecFloods = true) => {
      JEU.chargements++;
      if (JEU.illisible) return Promise.reject(new Error("forum"));
      return Promise.resolve({ chasses: {}, floods: avecFloods ? FORUM.floods : [] });
    };
    // une chasse de la page à 10h21 (+ 3 000) : elle passe avant le flood de 10h25
    PageRessource.lireChasses = () => [{
      impact: moment("2026-11-12 10:21", "YYYY-MM-DD HH:mm"), arrivee: moment("2026-11-12 10:20:30", "YYYY-MM-DD HH:mm:ss"),
      terrain: 3000, unites: { "Jeunes Soldates Naines": 400 }, duree: 3600, estime: false, pertes: 0 }];
    let lirePage = (url) => {
      let adresse = String(url);
      JEU.lues.push(adresse.replace(location.origin, ""));
      if (adresse.endsWith("/alliance.php?Membres")) return Promise.resolve(${JSON.stringify(MEMBRES)});
      return Promise.reject({ status: 404 });
    };
    $.get = lirePage;
    $.ajax = (o) => lirePage(o.url);
    // minuterie de l'alerte : gardée pour la déclencher à la main
    window.MAJ = null;
    window.setInterval = (f) => { window.MAJ = f; return 1; };
  })()`);
});

const installer = async (floods: object[], parametre: unknown = null) => {
  lire(`FORUM.floods = ${JSON.stringify(floods)};`);
  if (parametre != null)
    lire(`monProfil.parametre.alerteFloods = { valeur: ${JSON.stringify(parametre)} };`);
  await lire(`AlerteFloods.installer()`);
  await attendre();
};
// titre et lignes : un bloc chacun
const alerte = () =>
  espaces(
    lire<string[]>(
      `$("#o_alerteFloods:not([hidden])").children().map((i, e) => e.textContent).get()`,
    ).join(" "),
  );

describe("floods sur moi d'ici le délai : à droite des boutons d'envoi", () => {
  test("un flood d'ici 1 h : titre, lanceur, heure du rapport, délai et prise estimée", async () => {
    await installer([flood(700, "10:25", "Autre", "Moi", 30000)]);
    // 100 000 + 3 000 (chasse de 10h21) : 20 % de 103 000
    expect(alerte()).toBe(
      "⚠️ 1 flood arrive sur toi d'ici 1 h Autre à 10h25 (dans 25 min) : −20 600 cm² (20 %)",
    );
    expect(lire(`$("#o_alerteFloods a").attr("href")`)).toBe("Membre.php?Pseudo=Autre");
    // à côté des boutons, dans la même grille ; la marge passe au cadre commun
    expect(
      lire(
        `$(".o_chasseActions > .o_chasseActionsGrille").children().map((i, e) => e.id || e.className).get()`,
      ),
    ).toEqual(["o_pile", "o_alerteFloods"]);
  });

  test("plusieurs floods : le titre au pluriel, une ligne chacun dans l'ordre d'arrivée, ni mes floods ni ceux des autres ; un flood que la portée annule à l'impact reste signalé", async () => {
    await installer([
      flood(701, "10:40", "Autre", "Moi", 5000),
      flood(700, "10:25", "Autre", "Moi", 30000),
      flood(702, "10:30", "Moi", "Autre", 1000),
      flood(703, "10:35", "Autre", "Loin", 1000),
    ]);
    expect(alerte()).toBe(
      // à 10h40, 83 400 (après 10h25 et mon flood de 10h30) est sous la moitié des 170 600 d'Autre
      "⚠️ 2 floods arrivent sur toi d'ici 1 h Autre à 10h25 (dans 25 min) : −20 600 cm² (20 %) Autre à 10h40 (dans 40 min) : 0 cm² (hors portée)",
    );
  });

  test("hors du délai, ou à la minute en cours (déjà arrivé) : la page ne change pas", async () => {
    const avant = lire<string>(`document.body.innerHTML`);
    await installer([
      flood(700, "11:02", "Autre", "Moi", 30000),
      flood(701, "10:00", "Autre", "Moi", 1),
    ]);
    expect(lire<string>(`document.body.innerHTML`)).toBe(avant);
  });

  test("délai choisi : 30 min laisse le flood de 10h40 dehors, 24 h le compte", async () => {
    await installer(
      [flood(700, "10:25", "Autre", "Moi", 30000), flood(701, "10:40", "Autre", "Moi", 5000)],
      "0",
    );
    expect(alerte()).toStartWith("⚠️ 1 flood arrive sur toi d'ici 30 min Autre à 10h25");
    lire(`$("#o_alerteFloods").remove()`);
    await installer([flood(701, "21:40", "Autre", "Moi", 5000)], "8");
    expect(alerte()).toBe(
      "⚠️ 1 flood arrive sur toi d'ici 24 h Autre à 21h40 (dans 11 h 40) : −5 000 cm²",
    );
  });

  test("le texte suit l'heure chaque minute, sans nouvelle lecture ; l'alerte part une fois le flood arrivé", async () => {
    await installer([flood(700, "11:30", "Autre", "Moi", 30000)]);
    expect(alerte()).toBe("");
    const lectures = lire<number>(`JEU.chargements + JEU.lues.length`);
    lire(`heure = moment("2026-11-12 10:45:10", "YYYY-MM-DD HH:mm:ss").valueOf(); MAJ();`);
    expect(alerte()).toBe(
      "⚠️ 1 flood arrive sur toi d'ici 1 h Autre à 11h30 (dans 45 min) : −20 600 cm² (20 %)",
    );
    lire(`heure = moment("2026-11-12 11:30:05", "YYYY-MM-DD HH:mm:ss").valueOf(); MAJ();`);
    expect(alerte()).toBe("");
    expect(lire(`$("#o_alerteFloods").prop("hidden")`)).toBe(true);
    expect(lire<number>(`JEU.chargements + JEU.lues.length`)).toBe(lectures);
  });
});

describe("essais du mainteneur (ligne « Journal » des réglages)", () => {
  test("sans flood dans le délai : un flood fictif, signalé, sans lien vers un joueur", async () => {
    lire(`ESSAI = true`);
    await installer([flood(700, "11:30", "Autre", "Moi", 30000)]);
    expect(alerte()).toBe(
      "⚠️ 1 flood arrive sur toi d'ici 1 h (test : flood fictif) Exemple à 10h20 (dans 20 min) : −12 345 cm²",
    );
    expect(lire(`$("#o_alerteFloods a").length`)).toBe(0);
  });

  test("un vrai flood dans le délai : lui seul, sans flood fictif", async () => {
    lire(`ESSAI = true`);
    await installer([flood(700, "10:25", "Autre", "Moi", 30000)]);
    expect(alerte()).toBe(
      "⚠️ 1 flood arrive sur toi d'ici 1 h Autre à 10h25 (dans 25 min) : −20 600 cm² (20 %)",
    );
  });

  test("un autre joueur : pas de flood fictif, la page ne change pas", async () => {
    const avant = lire<string>(`document.body.innerHTML`);
    await installer([]);
    expect(lire<string>(`document.body.innerHTML`)).toBe(avant);
  });
});

describe("lectures", () => {
  test("à l'ouverture : le forum, et la page Membres quand un autre joueur est concerné", async () => {
    await installer([flood(700, "10:25", "Autre", "Moi", 30000)]);
    // le forum deux fois : mes partages, puis les chasses du lanceur (sujet
    // gardé une minute dans le vrai forum : pas relu)
    expect(lire(`[JEU.chargements, JEU.lues]`)).toEqual([2, ["/alliance.php?Membres"]]);
  });

  test("forum illisible : rien ne s'affiche ; sans alliance : rien n'est lu", async () => {
    lire(`JEU.illisible = true`);
    await installer([flood(700, "10:25", "Autre", "Moi", 30000)]);
    expect(lire(`$("#o_alerteFloods").length`)).toBe(0);
    lire(`JEU.illisible = false; JEU.chargements = 0; $("#tag_alliance").remove()`);
    await installer([flood(700, "10:25", "Autre", "Moi", 30000)]);
    expect(lire(`[JEU.chargements, $("#o_alerteFloods").length]`)).toEqual([0, 0]);
  });
});

describe("réglage et branchement", () => {
  test("délai : rang du choix de Préférences, 1 h par défaut ou pour une valeur inconnue", () => {
    expect(lire(`AlerteFloods.heures()`)).toBe(1);
    lire(`monProfil.parametre.alerteFloods = { valeur: "3" }`);
    expect(lire(`AlerteFloods.heures()`)).toBe(3);
    lire(`monProfil.parametre.alerteFloods = { valeur: "99" }`);
    expect(lire(`AlerteFloods.heures()`)).toBe(1);
    // les choix de Préférences (Joueur.js), au rang près
    expect(lire(`ALERTE_FLOODS_HEURES.map((h) => (h < 1 ? h * 60 + " min" : h + " h"))`)).toEqual([
      "30 min",
      "1 h",
      "2 h",
      "3 h",
      "4 h",
      "6 h",
      "8 h",
      "12 h",
      "24 h",
    ]);
    expect(lire(`ALERTE_FLOODS_HEURES[ALERTE_FLOODS_DEFAUT]`)).toBe(1);
  });

  test("la page Ressources l'installe après le lanceur, dont les boutons d'envoi forment la pile attendue", () => {
    const source = (f: string) =>
      readFileSync(join(import.meta.dir, "..", "public", "js", f), "utf8");
    expect(source("page/Ressource.js")).toMatch(
      /new LanceurChasse\(this\._armee, this\._nbChasse\)\.afficher\(\$\("#boite_tdc"\)\);\s*AlerteFloods\.installer\(\)/,
    );
    expect(source("class/LanceurChasse.js")).toMatch(
      /<div class='o_pile o_marginT15'><button [^>]*id='\$\{this\._p\}o_chasseEnvoyer'>/,
    );
    // une seule minuterie, sans lecture : pas de requête dans le module
    expect(source("class/AlerteFloods.js")).not.toMatch(/\$\.(get|ajax|post)\(/);
  });
});
