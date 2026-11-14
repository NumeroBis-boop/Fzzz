import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Ajouts réservés aux comptes sans Compte+ (le jeu les a pour les autres) :
 * chacun a sa case dans les Préférences. Les pages enregistrées pour les
 * vérifications dans Chromium sont celles d'un compte Compte+ : ces ajouts
 * n'y apparaissent pas, d'où ce test.
 */
const page = creerPage(
  ["js/class/Utils.js", "js/page/Messagerie.js", "js/page/Ressource.js"],
  `var AFFICHAGES_ONGLET = {};
   var monProfil = { parametre: { couleurMessagerie: { valeur: "#000000" } } };
   var LISTESMILEY1 = "<img class='s1'>", LISTESMILEY2 = "", LISTESMILEY3 = "", LISTESMILEY4 = "",
     LISTESMILEY5 = "", LISTESMILEY6 = "";`,
);

const decocher = (cles: string[]) =>
  page.lire(`(() => {
    localStorage.clear();
    ${JSON.stringify(cles)}.forEach((c) => localStorage.setItem("fzzz_affichage_" + c, "0"));
  })()`);

describe("messagerie hors Compte+ : mise en forme et smileys, chacun sa case", () => {
  const ecrire = (cles: string[], cochees: string[] = ["messagerieMiseEnForme"]) => {
    decocher(cles);
    page.lire(
      `${JSON.stringify(cochees.filter((c) => !cles.includes(c)))}.forEach((c) => localStorage.setItem("fzzz_affichage_" + c, "1"))`,
    );
    return page.lire<number[]>(`(() => {
      document.body.innerHTML = "<span id='smileyPrecedent0'></span><span id='smileySuivant0'></span>" +
        "<div id='tousLesSmiley0'><div id='listeSmiley20'></div><div id='listeSmiley30'></div></div>" +
        "<textarea id='message_envoi'></textarea><button id='bt_envoi_message'></button>";
      Object.create(PageMessagerie.prototype).plus(0);
      return [$("#o_colorMessmessage_envoi").length, $("#listeSmiley20 .s1").length, $("#smileySuivant0 img").length];
    })()`);
  };
  test("tout coché : couleur, boutons, smileys et flèches", () => {
    expect(ecrire([])).toEqual([1, 1, 1]);
  });
  test("par défaut : smileys et flèches seulement, la mise en forme décochée (liste du mainteneur)", () => {
    expect(ecrire([], [])).toEqual([0, 1, 1]);
  });
  test("chaque case retire sa partie", () => {
    expect(ecrire(["messagerieMiseEnForme"])).toEqual([0, 1, 1]);
    expect(ecrire(["messagerieSmileys"])).toEqual([1, 0, 0]);
  });
});

describe("Ressources hors Compte+ : flèches « max »", () => {
  test("présentes cochée, absentes décochée", () => {
    for (const [cles, attendu] of [
      [[], 2],
      [["ressourcesMax"], 0],
    ] as [string[], number][]) {
      decocher(cles);
      expect(
        page.lire(`(() => {
          document.body.innerHTML = "<input id='RecolteNourriture'/><input id='RecolteMateriaux'/><form action='AcquerirTerrain.php'></form>";
          let p = Object.create(PageRessource.prototype);
          p.saveChasse = () => {};
          p.plus();
          return $(".button_max").length;
        })()`),
      ).toBe(attendu);
    }
  });
});
