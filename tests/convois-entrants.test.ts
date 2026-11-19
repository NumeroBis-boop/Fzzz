import { beforeEach, describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Page Convois : les convois qui arrivent (« Vous allez recevoir … », que le
 * jeu ne montre qu'avec le Compte+, constat du mainteneur du 19/11/2026) sont
 * gardés pour les entrepôts quel que soit le compte. Avant 1.141.0, seul
 * Commerce.js les gardait, et seulement sans Compte+ : l'encart « Plein
 * dans … » n'en comptait donc aucun. Joueurs et nombres inventés.
 */
const page = creerPage(
  [
    "js/lib/jquery-ui_1.12.1.js",
    "js/class/Utils.js",
    "js/class/Entrepots.js",
    "js/page/Commerce.js",
  ],
  `var heure = moment("2026-11-19 14:00:00", "YYYY-MM-DD HH:mm:ss").valueOf();
   var Horloge = { maintenant: () => heure, serveur: () => moment(heure) };
   var monProfil = { pseudo: "Moi", niveauConstruction: [-1, 10, 13, 0, 0, 0, 0, 0, 0, 0, 0, 4] };
   var CommerceFzzz = { suivi() {} };
   var JOURNAL = [];`,
  "https://s5.fourmizzz.fr/commerce.php",
);
const lire = <T = any>(e: string) => page.lire<T>(e);
const HEURE = lire<number>(`heure`);
const H = 3600000;

/** Menu Compte+ du jeu (Utils.comptePlus le reconnaît à son lien « Stat »). */
const MENU_COMPTE_PLUS = `<ul id="menuComptePlus"><li><a class="boutonStatJoueur" href="statJoueur.php">Stat</a></li></ul>`;
const LIVRER = `<strong>- Vous allez livrer 200 000 <img alt="nourritures" src="images/icone/nourriture.gif"/> et 0 <img alt="materiaux" src="images/icone/materiaux.gif"/> à <a href="Membre.php?Pseudo=Bravo">Bravo</a> dans 8H 55m 20s </strong> - <small><em>Retour le 20 nov. à 07h50</em></small> - <a href="commerce.php?annuler=1&amp;t=x">Annuler</a><br />`;
const RECEVOIR = `<strong>- Vous allez recevoir 4 <img alt="nourritures" src="images/icone/nourriture.gif"/> et 25 000 <img alt="materiaux" src="images/icone/materiaux.gif"/> de <a href="Membre.php?Pseudo=Alpha">Alpha</a> dans 1H 30m 00s </strong> - <small><em>Retour le 19 nov. à 15h30</em></small><br />`;
const ouvrir = (lignes: string, comptePlus: boolean) =>
  lire(`(() => {
    document.body.innerHTML = ${JSON.stringify(
      `<div id="data"><div id="pseudo">Moi</div></div>${comptePlus ? MENU_COMPTE_PLUS : ""}<div id="centre"><h3>Convois en cours:</h3>${lignes}</div>`,
    )};
    new PageCommerce({ convoi: [], sauvegarder() { return this; }, majConvoi() {} }).executer();
  })()`);

beforeEach(() => lire(`localStorage.clear(); Entrepots.convoisLus = null;`));

describe("convois qui arrivent, gardés à chaque visite de la page Convois", () => {
  test("Compte+ : le convoi qui arrive est gardé, pas celui qui part", () => {
    ouvrir(LIVRER + RECEVOIR, true);
    expect(lire(`Utils.comptePlus`)).toBe(true);
    expect(lire(`Entrepots.convoisGardes()`)).toEqual([
      { de: "Alpha", t: HEURE + 1.5 * H, q: [4, 25000] },
    ]);
    // la page ouverte compte avec eux (lignes « Plein dans … » de l'encart)
    expect(lire(`Entrepots.convoisLus.length`)).toBe(1);
  });

  test("sans Compte+ : gardés aussi s'ils sont affichés", () => {
    ouvrir(RECEVOIR, false);
    expect(lire(`Entrepots.convoisGardes().map((c) => c.de)`)).toEqual(["Alpha"]);
  });

  test("plus aucun convoi qui arrive : la lecture fait foi, l'ancienne sauvegarde de Commerce.js n'est plus lue", () => {
    lire(`localStorage.setItem("outiiil_evolution", JSON.stringify({ convoi: [
      { cible: "Charlie", sens: false, nou: "0", mat: "500000", exp: moment(heure + ${3 * H}).toISOString() },
    ] }))`);
    expect(lire(`Entrepots.convoisGardes().length`)).toBe(1);
    ouvrir(LIVRER, true);
    expect(lire(`Entrepots.convoisGardes()`)).toEqual([]);
  });

  test("sans Compte+, page sans convoi qui arrive : ceux lus dans le forum restent", () => {
    lire(`Entrepots.garderConvois([{ de: "Alpha", t: heure + ${H}, q: [0, 500] }], heure)`);
    ouvrir(LIVRER, false);
    expect(lire(`Entrepots.convoisGardes()`)).toEqual([{ de: "Alpha", t: HEURE + H, q: [0, 500] }]);
  });

  test("gardés par joueur : un autre compte du même navigateur n'en hérite pas", () => {
    ouvrir(RECEVOIR, true);
    lire(`monProfil.pseudo = "Autre";`);
    expect(lire(`Entrepots.convoisGardes()`)).toEqual([]);
    lire(`monProfil.pseudo = "Moi";`);
  });

  test("ligne en <span> comme les chasses de la page Ressources : lue sur la page ouverte", () => {
    ouvrir(
      `<span>- Vous allez recevoir 0 <img alt="nourritures" src="n.gif"/> et 1 500 000 <img alt="materiaux" src="m.gif"/> de <a href="Membre.php?Pseudo=Alpha">Alpha</a> dans <span id="convoi_7">1J 2H 03m 10s </span></span><script language="JavaScript">reste(93790, "convoi_7");</script><br />`,
      true,
    );
    expect(lire(`Entrepots.convoisGardes()`)).toEqual([
      { de: "Alpha", t: HEURE + 93790 * 1000, q: [0, 1500000] },
    ]);
  });
});

describe("ligne « Info : Niveau d'étable » du formulaire", () => {
  const info = (niveaux: unknown) =>
    lire(`(() => {
      monProfil.niveauConstruction = ${JSON.stringify(niveaux)};
      document.body.innerHTML = '<div id="data"><div id="pseudo">Moi</div></div><div id="centre"><form><table><tr><td>formulaire</td></tr></table></form></div>';
      new PageCommerce({ convoi: [], sauvegarder() { return this; }, majConvoi() {} }).executer();
      return $("form table tr.centre").text().replace(/\\s+/g, " ").trim();
    })()`);
  const etable = (n: unknown) => [-1, 10, 13, 0, 0, 0, 0, 0, 0, 0, 0, n, 0];

  test("niveau connu : la capacité d'une ouvrière", () => {
    expect(info(etable(6))).toBe(
      "Info : Niveau d'étable 6, 1 ouvrière peut transporter : 13 ressources.",
    );
  });

  test("niveau inconnu (jamais lu, ou effacé par une version précédente) : dit, avec le lien, jamais « null »", () => {
    for (const n of [null, -1]) {
      expect(info(etable(n))).toBe(
        "Info : Niveau d'étable inconnu, ouvre la page Construction pour qu'il soit lu ; d'ici là, 1 ouvrière est comptée pour 10 ressources.",
      );
      expect(lire(`$("form table tr.centre a").attr("href")`)).toBe("construction.php");
    }
    lire(`monProfil.niveauConstruction = [-1, 10, 13, 0, 0, 0, 0, 0, 0, 0, 0, 4]`);
  });
});

/**
 * Balise des lignes « Vous allez recevoir » inconnue (le mainteneur, Compte+,
 * 19/11/2026 : deux convois affichés, aucun lu par l'ancienne lecture des
 * seuls <strong>) : lues dans le texte du cadre, quelle que soit leur forme.
 */
describe("lignes des convois qui arrivent, quelle que soit leur forme", () => {
  const lireConvois = (centre: string) =>
    lire(
      `Entrepots.lireConvois(Utils.parseHtml(${JSON.stringify(`<div id="centre"><h3>Convois en cours:</h3>${centre}</div>`)}), heure)`,
    );
  const journal = () => lire<string[]>(`JOURNAL`);
  beforeEach(() =>
    lire(`JOURNAL = []; Journal.info = (s, m, d) => JOURNAL.push(s + " : " + m + " : " + d);`),
  );

  test("<span>, texte nu dans le cadre, cellule de tableau", () => {
    expect(
      lireConvois(
        `<span>- Vous allez recevoir 0 <img alt="nourritures" src="n.gif"/> et 1 500 000 <img alt="materiaux" src="m.gif"/> de <a href="Membre.php?Pseudo=Alpha">Alpha</a> dans <span id="convoi_7">1J 2H 03m 10s </span></span><script>reste(93790, "convoi_7");</script><br />
         - Vous allez recevoir 4 <img alt="nourritures"/> et 0 <img alt="materiaux"/> de <a href="Membre.php?Pseudo=Bravo">Bravo</a> dans <span id="convoi_8">45m 02s</span><br />
         <table><tr><td><b>- Vous allez recevoir 10 et 20 de Charlie dans 3H</b></td></tr></table>`,
      ),
    ).toEqual([
      { de: "Bravo", t: HEURE + 2702 * 1000, q: [4, 0] },
      { de: "Charlie", t: HEURE + 3 * H, q: [10, 20] },
      { de: "Alpha", t: HEURE + 93790 * 1000, q: [0, 1500000] },
    ]);
    expect(lire(`Entrepots.convoisIllisibles`)).toBe(0);
    expect(journal()).toEqual([]);
  });

  test("compte à rebours écrit seulement par le script du jeu : ses secondes", () => {
    expect(
      lireConvois(
        `<strong>- Vous allez recevoir 0 <img alt="nourritures"/> et 300 <img alt="materiaux"/> de <a href="Membre.php?Pseudo=Delta">Delta</a> dans <span id="convoi_9"></span></strong><script language="JavaScript">reste(600, "convoi_9");</script><br />`,
      ),
    ).toEqual([{ de: "Delta", t: HEURE + 600 * 1000, q: [0, 300] }]);
    // forme de l'encart Compte+ du jeu
    expect(
      lireConvois(
        `<span>- Vous allez recevoir 0 et 300 de <a>Delta</a> dans <a id="temps_convoi"></a></span><script>$(function() { resteTemps(900,"temps_convoi"); });</script><br />`,
      ),
    ).toEqual([{ de: "Delta", t: HEURE + 900 * 1000, q: [0, 300] }]);
  });

  test("la ressource suit le nom de l'icône, pas l'ordre ; un seul montant", () => {
    expect(
      lireConvois(
        `<strong>- Vous allez recevoir 300 <img alt="materiaux"/> et 7 <img alt="nourritures"/> de <a>Echo</a> dans 1H</strong><br />
         <strong>- Vous allez recevoir 50 <img alt="materiaux"/> de <a>Fox</a> dans 2H</strong><br />`,
      ),
    ).toEqual([
      { de: "Echo", t: HEURE + H, q: [7, 300] },
      { de: "Fox", t: HEURE + 2 * H, q: [0, 50] },
    ]);
  });

  test("ligne illisible : pas comptée, ne prend pas le compte à rebours de la suivante, notée avec son HTML", () => {
    expect(
      lireConvois(
        `<strong>- Vous allez recevoir 5 et 6 de <a>Golf</a> - arrivée le 20 nov. à 10h00</strong><br />
         <strong>- Vous allez livrer 7 et 8 à <a>Hotel</a> dans 1H</strong><br />
         <strong>- Vous allez recevoir 9 et 10 de <a>India</a> dans 2H</strong><br />`,
      ),
    ).toEqual([{ de: "India", t: HEURE + 2 * H, q: [9, 10] }]);
    expect(lire(`Entrepots.convoisIllisibles`)).toBe(1);
    let [note, ...autres] = journal();
    expect(autres).toEqual([]);
    expect(note).toContain("1 convoi(s) qui arrive(nt) illisible(s) sur la page Convois");
    expect(note).toContain("Vous allez recevoir 5 et 6 de Golf - arrivée le 20 nov.");
    expect(note).toContain(`HTML : <strong>- Vous allez recevoir 5 et 6 de <a>Golf</a>`);
  });

  test("convois qui partent seulement : aucun", () => {
    expect(lireConvois(LIVRER)).toEqual([]);
    expect(lire(`Entrepots.convoisIllisibles`)).toBe(0);
  });
});
