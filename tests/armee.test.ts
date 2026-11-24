import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

// constantes du jeu (content.js) ; l'encart « Connexion » empêche le démarrage
const page = creerPage(
  [
    "js/class/Utils.js",
    "js/class/Parametre.js",
    "js/class/Joueur.js",
    "js/class/Armee.js",
    "js/class/Combat.js",
    "js/content.js",
  ],
  `var chrome = { runtime: { getManifest: () => ({ version: "0" }), getURL: (p) => p } };
   document.body.innerHTML = "<div class='boite_connexion_titre'>Connexion</div>";`,
);

describe("Armee.parseArmee", () => {
  test("abréviations : jsn, tk, tu (Tueuses), tue", () => {
    const unites = page.lire<number[]>(
      `new Armee().parseArmee("30 jsn, 2 tk, 7 tu et 4 tue").unite.slice()`,
    );
    // index : 0 JSN … 10 Tank, 12 Tueuse, 13 Tueuse d'élite
    expect(unites[0]).toBe(30);
    expect(unites[10]).toBe(2);
    expect(unites[12]).toBe(7);
    expect(unites[13]).toBe(4);
  });

  test("texte d'une armée du jeu", () => {
    const unites = page.lire<number[]>(
      `new Armee().parseArmee("1 919 Jeunes Soldates Naines, 50 Soldates Naines, 3 Tanks").unite.slice()`,
    );
    expect(unites[0]).toBe(1919);
    expect(unites[1]).toBe(50);
    expect(unites[10]).toBe(3);
  });
});

describe("Utils.timeToInt", () => {
  test("jours, heures, minutes, secondes, espaces multiples", () => {
    expect(page.lire(`Utils.timeToInt("1J 2h 3m 4s")`)).toBe(86400 + 7200 + 180 + 4);
    expect(page.lire(`Utils.timeToInt("2h  05m")`)).toBe(7500);
  });
});

describe("Combat.simuler", () => {
  test("s'arrête même avec des niveaux non numériques", () => {
    const tours = page.lire<number>(`(() => {
      let c = new Combat({});
      c.armee1.unite[0] = 1000;
      c.armee2.unite[0] = 1000;
      c.attaquant.niveauRecherche[1] = NaN; c.attaquant.niveauRecherche[2] = NaN;
      c.defenseur.niveauRecherche[1] = NaN; c.defenseur.niveauRecherche[2] = NaN;
      c.simuler();
      return c._tour.length;
    })()`);
    expect(tours).toBeLessThanOrEqual(1000);
  });
});

describe("Armee.envoyerChasse", () => {
  // jeu simulé : un seul jeton courant, remplacé quand une chasse l'utilise ;
  // une chasse envoyée avec un autre jeton est refusée (essais du 24/11/2026)
  const jeu = (refus: string, autre = "") => `
    var monProfil = { niveauRecherche: [0, 0, 0, 0, 0, 0] };
    var TroupesDehors = { enregistrerChasse() {} };
    window.jeu = { courant: 1, lectures: 0, envois: [], lancees: 0, bilan: null };
    var pageChasse = (texte) => "<table id='t'></table><form><input type='hidden' name='t' id='t' value='j" + window.jeu.courant + "'/></form>" + texte;
    $.ajax = () => { window.jeu.lectures++; ${autre} return Promise.resolve(pageChasse("")); };
    $.post = (url, d) => {
      let j = window.jeu;
      j.envois.push(d.t);
      if (${refus}) return Promise.resolve(REPONSE_REFUS(j));
      if (d.t != "j" + j.courant) return Promise.resolve(pageChasse("Erreur"));
      j.courant++; j.lancees++;
      return Promise.resolve(pageChasse("La chasse est lancée."));
    };
    var REPONSE_REFUS = (j) => pageChasse("Erreur");
    var a = new Armee(); a._repartition = [[1], [1], [1], [1]];
  `;
  const etat = () =>
    JSON.parse(page.lire<string>(`JSON.stringify(window.jeu)`)) as {
      lectures: number;
      envois: string[];
      lancees: number;
      bilan: number[] | null;
    };

  test('jetonChasse : l\'input du jeton, pas la table de même id ; "" sans jeton', () => {
    expect(
      page.lire(`[
        Armee.jetonChasse("<table id='t'></table><input type='hidden' name='t' id='t' value='lb20'/>"),
        Armee.jetonChasse("<table id='t'></table><p>La chasse est lancée.</p>"),
        Armee.jetonChasse(""),
        Armee.jetonChasse("<input name='t' value=''/>"),
      ]`),
    ).toEqual(["t=lb20", "", "", ""]);
  });

  test("une seule lecture de la page : chaque chasse part avec le jeton de la réponse précédente", async () => {
    page.lire(
      jeu("false") + `a.envoyerChasse(10, 4, 0, 0, (l, t) => { window.jeu.bilan = [l, t]; });`,
    );
    await new Promise((r) => setTimeout(r, 60));
    expect(etat()).toMatchObject({
      lectures: 1,
      envois: ["j1", "j2", "j3", "j4"],
      lancees: 4,
      bilan: [4, 4],
    });
  });

  test("jeton périmé entre deux chasses : relu une fois, la chasse repart et la suite continue", async () => {
    // une autre action du joueur change le jeton après la 2e chasse
    page.lire(
      jeu("false") +
        `let post = $.post; $.post = (url, d) => { if (window.jeu.envois.length == 2 && !window.jeu.autre) { window.jeu.autre = true; window.jeu.courant = 50; } return post(url, d); };
         a.envoyerChasse(10, 4, 0, 0, (l, t) => { window.jeu.bilan = [l, t]; });`,
    );
    await new Promise((r) => setTimeout(r, 60));
    expect(etat()).toMatchObject({
      lectures: 2,
      envois: ["j1", "j2", "j3", "j50", "j51"],
      lancees: 4,
      bilan: [4, 4],
    });
  });

  test("refus du jeu (plus de place) : un seul nouvel essai avec le jeton relu, puis arrêt", async () => {
    page.lire(
      jeu("j.lancees >= 2") +
        `a.envoyerChasse(10, 4, 0, 0, (l, t) => { window.jeu.bilan = [l, t]; });`,
    );
    await new Promise((r) => setTimeout(r, 60));
    expect(etat()).toMatchObject({
      lectures: 2,
      envois: ["j1", "j2", "j3", "j3"],
      lancees: 2,
      bilan: [2, 4],
    });
  });

  test("pas de réponse du jeu : rien n'est renvoyé (la chasse est peut-être partie)", async () => {
    page.lire(
      jeu("j.lancees >= 1") +
        `REPONSE_REFUS = () => ""; a.envoyerChasse(10, 4, 0, 0, (l, t) => { window.jeu.bilan = [l, t]; });`,
    );
    await new Promise((r) => setTimeout(r, 60));
    expect(etat()).toMatchObject({ lectures: 1, envois: ["j1", "j2"], lancees: 1, bilan: [1, 4] });
  });

  test("page sans jeton à la première lecture : rien n'est envoyé", async () => {
    page.lire(
      jeu("false") +
        `$.ajax = () => { window.jeu.lectures++; return Promise.resolve("<p>Connexion</p>"); };
         a.envoyerChasse(10, 4, 0, 0, (l, t) => { window.jeu.bilan = [l, t]; });`,
    );
    await new Promise((r) => setTimeout(r, 60));
    expect(etat()).toMatchObject({ lectures: 1, envois: [], lancees: 0, bilan: [0, 4] });
  });

  // remplace Armee.posterChasse pour la suite : dernier test du bloc
  test("s'arrête au premier refus et appelle `fin` avec le compte", async () => {
    page.lire(`
      var monProfil = { niveauRecherche: [0, 0, 0, 0, 0, 0] };
      var TroupesDehors = { enregistrerChasse() {} };
      window.reponses = ["La chasse est lancée.", "Erreur", "La chasse est lancée."]; window.postes = 0;
      Armee.posterChasse = () => Promise.resolve(window.reponses[window.postes++]);
      window.bilan = null;
      var a = new Armee(); a._repartition = [[1], [1], [1]];
      a.envoyerChasse(10, 3, 0, 0, (lancees, total) => { window.bilan = [lancees, total]; });
    `);
    await new Promise((r) => setTimeout(r, 30));
    expect(page.lire(`JSON.stringify(window.bilan)`)).toBe("[1,3]");
    expect(page.lire(`window.postes`)).toBe(2);
  });
});
