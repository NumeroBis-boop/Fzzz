import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * « Rétablir l'affichage d'origine » des onglets Reine, Classement, Chat,
 * Forum et Compte (1.96.0) : bootstrap.js reconnaît la page, paramètres de
 * l'adresse compris pour alliance.php (chat, forum ou page Membres).
 */
function originePage(chemin: string, onglet: string): boolean {
  const page = creerPage(
    ["js/bootstrap.js"],
    `history.replaceState(null, "", ${JSON.stringify(chemin)});
     localStorage.setItem("fzzz_origine_${onglet}", "1");`,
  );
  return page.lire<boolean>(`document.documentElement.classList.contains("o_originePage")`);
}

describe("pages des nouveaux onglets", () => {
  test("chaque page suit la case de son onglet", () => {
    expect(originePage("/Reine.php", "Reine")).toBe(true);
    expect(originePage("/classementAlliance.php?alliance=OUAF", "Classement")).toBe(true);
    expect(originePage("/compte.php", "Compte")).toBe(true);
    expect(originePage("/chat.php", "Chat")).toBe(true);
  });

  test("alliance.php : chat sans paramètre, forum avec forum_menu, Membres avec « Page membre »", () => {
    expect(originePage("/alliance.php", "Chat")).toBe(true);
    expect(originePage("/alliance.php?forum_menu", "Forum")).toBe(true);
    expect(originePage("/alliance.php?forum_menu", "Chat")).toBe(false);
    expect(originePage("/alliance.php?Membres", "Membre")).toBe(true);
    expect(originePage("/alliance.php?Membres", "Chat")).toBe(false);
    expect(originePage("/alliance.php?Membres", "Forum")).toBe(false);
    // et la page d'un membre reste sur le même onglet
    expect(originePage("/Membre.php?Pseudo=X", "Membre")).toBe(true);
  });

  test("l'onglet d'une autre page ne change rien", () => {
    expect(originePage("/Reine.php", "Chat")).toBe(false);
    expect(originePage("/Armee.php", "Reine")).toBe(false);
  });
});

const page = creerPage(
  ["js/class/Utils.js", "js/page/Chat.js", "js/page/Reine.js"],
  `
  var AFFICHAGES_ONGLET = {};
  var LISTESMILEY1 = "<img class='s1'>", LISTESMILEY2 = "", LISTESMILEY3 = "", LISTESMILEY4 = "",
    LISTESMILEY5 = "", LISTESMILEY6 = "";
  var monProfil = { couleur1: "#fff", niveauRecherche: [0, 0, 0, 0, 0, 0, 0], getTDP: () => 0,
    parametre: { couleurChat: { valeur: "#000000" } } };
  var NOM_UNITE = ["Jeune Soldate Naine"], VIE_UNITE = [8], ATT_UNITE = [3], DEF_UNITE = [2],
    TEMPS_UNITE = [300], COUT_UNITE = [16], IMG_VIE = "", IMG_ATT = "", IMG_DEF = "";
  var Horloge = { serveur: () => moment() };
`,
);
const decocher = (cles: string[]) =>
  page.lire(`(() => {
    localStorage.clear();
    ${JSON.stringify(cles)}.forEach((c) => localStorage.setItem("fzzz_affichage_" + c, "0"));
  })()`);

describe("Chat hors Compte+ : mise en forme et smileys, chacun sa case", () => {
  const chat = (cles: string[]) => {
    decocher(cles);
    return page.lire<number[]>(`(() => {
      document.body.innerHTML = "<form id='formulaireChat'></form><span id='smileyPrecedent0'></span><span id='smileySuivant0'></span><div id='tousLesSmiley0'><div id='listeSmiley20'></div></div>";
      Object.create(PageChat.prototype).plus();
      return [$("#o_msgB").length, $("#listeSmiley20 .s1").length, $("#smileySuivant0 img").length];
    })()`);
  };
  test("chaque case retire sa partie", () => {
    expect(chat([])).toEqual([1, 1, 1]);
    expect(chat(["chatMiseEnForme"])).toEqual([0, 1, 1]);
    expect(chat(["chatSmileys"])).toEqual([1, 0, 0]);
  });
});

describe("Reine hors Compte+ : « Avec bonus » et formulaire de ponte, chacun sa case", () => {
  const reine = (cles: string[]) => {
    decocher(cles);
    return page.lire<number[]>(`(() => {
      document.body.innerHTML = "<div><h2>Jeune Soldate Naine</h2><div class='icones_unite'></div></div>" +
        "<form><table><tbody></tbody></table><span id='bouton_cout_temps'><span id='cout_temps'>0</span></span></form>";
      Utils.pontesReine = () => [];
      let p = Object.create(PageReine.prototype);
      p.plus();
      return [$(".tab_stat").length, $("#input_cout_temps").length];
    })()`);
  };
  test("chaque case retire sa partie", () => {
    expect(reine([])).toEqual([1, 1]);
    expect(reine(["reineBonus"])).toEqual([0, 1]);
    expect(reine(["reinePonte"])).toEqual([1, 0]);
  });
});
