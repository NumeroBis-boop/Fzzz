import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { creerPage } from "./harnais";

/**
 * Mesure du chargement des vues des mouvements en cours, notée au journal du
 * mainteneur (version TEST) : durée, requêtes au jeu, dont celles du forum,
 * et lectures servies par le cache d'une minute. Elle sert à comparer les
 * façons de ranger les partages dans le forum ; elle n'envoie aucune requête.
 */
const page = creerPage(
  ["js/class/Utils.js", "js/class/Requetes.js", "js/page/PartageChasses.js"],
  `var enAttente = [], T = 0;
   var monProfil = { pseudo: "Moi" };
   var Horloge = { maintenant: () => 1763000000000, serveur: () => moment(1763000000000), clic: () => moment(1763000000000) };
   performance.now = () => T;
   $.ajax = (o) => {
     let d = $.Deferred();
     // hors du jeu : pas dans la file (Requetes.js)
     if (/^https:\\/\\/script/.test(o.url)) return d.resolve("ok").promise();
     enAttente.push(d);
     return d.promise();
   };
   function terminer() { enAttente.shift().resolve("ok", "success", {}); }
   function echouer() { enAttente.shift().reject({ status: 500, responseText: "" }, "error", "panne"); }`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);
const attendre = () => new Promise((r) => setTimeout(r, 0));
const compte = () =>
  lire<number[]>(
    `[COMPTE_REQUETES.nombre, COMPTE_REQUETES.duree, COMPTE_REQUETES.forum, COMPTE_REQUETES.dureeForum, COMPTE_REQUETES.cache]`,
  );
const mesures = () =>
  lire<string[]>(`Journal.entrees().filter((e) => e.s == "Mesure").map((e) => e.m)`);
/** Remet à zéro compteurs, journal et horloge ; journal installé (joueur du mainteneur) ou non. */
function preparer(installe = true) {
  lire(`(() => {
    localStorage.clear();
    enAttente.length = 0;
    T = 0;
    Object.keys(COMPTE_REQUETES).forEach((k) => (COMPTE_REQUETES[k] = 0));
    journalInstalle = ${installe};
  })()`);
}
/** Trois requêtes au jeu, une à la fois : 300 ms et 300 ms au forum, 500 ms ailleurs. */
async function troisRequetes() {
  lire(`$.post("/alliance.php?forum_menu", { xajax: "callGetForum" });
    $.get("/Ressources.php");
    $.post(location.origin + "/alliance.php?forum_menu", { xajax: "callGetTopic" });`);
  for (const fin of [300, 800, 1100]) {
    await attendre();
    lire(`T = ${fin}; terminer()`);
  }
  await attendre();
}

describe("requêtes au jeu comptées", () => {
  test("à leur fin, de l'envoi à la réponse ; celles du forum à part", async () => {
    preparer();
    await troisRequetes();
    expect(compte()).toEqual([3, 1100, 2, 600, 0]);
  });

  test("l'attente dans la file n'est pas comptée : la durée part de l'envoi", async () => {
    preparer();
    lire(`$.get("/Reine.php"); $.get("/Armee.php");`);
    await attendre();
    // la seconde attend la première : 1 s dans la file
    lire(`T = 1000; terminer()`);
    await attendre();
    lire(`T = 1200; terminer()`);
    await attendre();
    expect(compte()).toEqual([2, 1200, 0, 0, 0]);
  });

  test("une requête en échec compte aussi ; une requête hors du jeu ne compte pas", async () => {
    preparer();
    lire(
      `$.ajax({ url: "https://script.google.com/macros/s/x/exec" }); $.get("/Reine.php").fail(() => {});`,
    );
    await attendre();
    lire(`T = 400; echouer()`);
    await attendre();
    expect(compte()).toEqual([1, 400, 0, 0, 0]);
  });

  test("lecture servie par le cache d'une minute du forum : comptée, sans requête", async () => {
    preparer();
    await lire(`PartageChasses._enCache("sujet 5", true, () => Promise.resolve(1))`);
    await lire(`PartageChasses._enCache("sujet 5", true, () => Promise.resolve(2))`);
    // lecture neuve demandée (avant une écriture) : pas le cache
    await lire(`PartageChasses._enCache("sujet 5", false, () => Promise.resolve(3))`);
    expect(compte()).toEqual([0, 0, 0, 0, 1]);
  });
});

describe("mesure notée au journal", () => {
  test("durée, requêtes au jeu, forum avec sa moyenne, cache : en français", async () => {
    preparer();
    lire(`window.M = Journal.mesurer("Page d'un membre")`);
    await troisRequetes();
    await lire(`PartageChasses._enCache("sujets", true, () => Promise.resolve({}))`);
    await lire(`PartageChasses._enCache("sujets", true, () => Promise.resolve({}))`);
    lire(`T = 1234; M.fin()`);
    expect(mesures()).toEqual([
      "Page d'un membre : 1,2 s ; 3 requêtes au jeu (1,1 s), dont 2 au forum (0,6 s, 0,30 s chacune en moyenne) ; 1 lecture servie par le cache d'une minute",
    ]);
  });

  test("seulement ce qui s'est passé pendant la mesure ; notée une seule fois", async () => {
    preparer();
    await troisRequetes();
    lire(`window.M = Journal.mesurer("Bloc « Mes attaques en cours »")`);
    lire(`$.get("/Ressources.php")`);
    await attendre();
    lire(`T = 1600; terminer()`);
    await attendre();
    lire(`T = 2100; M.fin(); M.fin()`);
    expect(mesures()).toEqual([
      "Bloc « Mes attaques en cours » : 1,0 s ; 1 requête au jeu (0,5 s), dont 0 au forum (0,0 s) ; 0 lecture servie par le cache d'une minute",
    ]);
    // une entrée revenue dans la minute serait comptée deux fois dans la même ligne
    expect(
      lire<number[]>(`Journal.entrees().filter((e) => e.s == "Mesure").map((e) => e.x)`),
    ).toEqual([1]);
  });

  test("journal d'un autre joueur que le mainteneur : rien n'est noté", async () => {
    preparer(false);
    lire(`window.M = Journal.mesurer("Page d'un membre")`);
    await troisRequetes();
    lire(`M.fin()`);
    expect(mesures()).toEqual([]);
    // les compteurs, eux, ne coûtent rien et ne changent rien aux requêtes
    expect(compte()[0]).toBe(3);
  });

  test("sans la file des requêtes (Requetes.js) : la durée seule", () => {
    const seule = creerPage([], `performance.now = () => 0;`);
    seule.lire(`journalInstalle = true; window.M = Journal.mesurer("Page d'un membre")`);
    seule.lire(`performance.now = () => 2500; M.fin()`);
    expect(
      seule.lire<string[]>(`Journal.entrees().filter((e) => e.s == "Mesure").map((e) => e.m)`),
    ).toEqual(["Page d'un membre : 2,5 s"]);
  });
});

describe("vues mesurées", () => {
  test("page d'un membre : une mesure à la fin de l'affichage du bloc des partages", async () => {
    preparer();
    lire(`(() => {
      document.body.innerHTML = "<span id='tag_alliance'>OUAF</span><div class='boite_membre'>Action</div>";
      PartageChasses.charger = () => Promise.resolve({ chasses: {}, floods: [] });
      PartageChasses.afficherProfil("Alpha", 200000);
    })()`);
    for (let i = 0; i < 5; i++) await attendre();
    expect(lire<number>(`$("#o_chassesPartagees").length`)).toBe(1);
    expect(mesures()).toEqual([
      "Page d'un membre : 0,0 s ; 0 requête au jeu (0,0 s), dont 0 au forum (0,0 s) ; 0 lecture servie par le cache d'une minute",
    ]);
  });

  test("chaque vue des mouvements en cours et chaque écriture des partages a sa mesure", () => {
    const source = (f: string) =>
      readFileSync(join(import.meta.dir, "..", "public", "js", f), "utf8");
    const attendues: [string, string[]][] = [
      ["class/AttaqueLancee.js", [`Journal.mesurer("Bloc « Mes attaques en cours »")`]],
      [
        "page/AllianceFzzz.js",
        [`Journal.mesurer("Page Membres, vue « Floods et chasses en cours »")`],
      ],
      ["page/Attaquer.js", [`Journal.mesurer("Page d'attaque, TdC à l'impact")`]],
      [
        "page/PartageChasses.js",
        [
          `Journal.mesurer("Page d'un membre")`,
          "Journal.mesurer(`Partage des ${libelle}s`)",
          `Journal.mesurer("Retrait de floods partagés")`,
        ],
      ],
    ];
    for (const [fichier, appels] of attendues) {
      const texte = source(fichier);
      for (const appel of appels) expect(texte).toContain(appel);
      // chaque mesure est close
      expect((texte.match(/mesure\.fin/g) || []).length).toBe(appels.length);
    }
  });
});
