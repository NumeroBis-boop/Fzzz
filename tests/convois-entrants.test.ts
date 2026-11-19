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
   var CommerceFzzz = { suivi() {}, partageConvois() {} };`,
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
});
