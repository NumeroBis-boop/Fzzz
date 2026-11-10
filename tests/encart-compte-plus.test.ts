import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Encart Compte+ et radar : le tableau de l'encart (pontes, constructions…)
 * ne cède sa place qu'au radar affiché. La vue radar choisie la dernière fois
 * (`outiiil_boiteActive` « R ») laissait l'encart vide quand le radar ne
 * s'affichait pas (case décochée, rien de surveillé) : 1.100.0, Compte+.
 */
const page = creerPage(
  [
    "js/lib/jquery-ui_1.12.1.js",
    "js/class/Utils.js",
    "js/boite/ComptePlus.js",
    "js/boite/Radar.js",
  ],
  `var IMG_FLECHE = "<img class='o_fleche'/>", IMG_ACTUALISER = "actualiser.png";
   var MENU_RAPIDE = [], ECART_ENCADRES = 0;
   var Dock = { suivre() {} };
   var Joueur = { rechercher: () => Promise.resolve("") };`,
);

// encart du jeu en Compte+ (structure d'une page enregistrée)
const ENCART_JEU =
  "<div id='menuComptePlus'><a class='boutonStatJoueur'>Stat</a></div>" +
  "<div id='boiteComptePlus' class='boite_compte_plus'><div class='titre_colonne_cliquable'>" +
  "<a href='comptePlus.php' class='titre_compte_plus'>Compte +</a></div>" +
  "<div class='contenu_boite_compte_plus'><div id='lien_compte'><a href='simulateurChasse.php'></a></div>" +
  "<table id='tableau_jeu'><tr id='ligne_ponte'><td>Jeunes Soldates Naines</td></tr></table></div></div>";

/**
 * Charge une page avec l'encart, puis l'affiche comme content.js : l'encart,
 * puis le radar si sa case est cochée.
 */
const afficher = ({
  comptePlus = true,
  vue = null as string | null,
  surveilles = false,
  radar = true,
} = {}) =>
  page.lire<{ tableau: string; radar: string | null; titre: string }>(`(() => {
    localStorage.clear();
    ${vue ? `localStorage.setItem("outiiil_boiteActive", ${JSON.stringify(vue)});` : ""}
    ${surveilles ? `localStorage.setItem("outiiil_radar", JSON.stringify({ separateurs: [{ id: "s1", texte: "Amis", ordreRadar: 1 }] }));` : ""}
    ${radar ? "" : `localStorage.setItem("fzzz_affichage_radar", "0");`}
    document.body.innerHTML = ${comptePlus ? JSON.stringify(ENCART_JEU) : JSON.stringify("<div id='boiteInfo'></div>")};
    let encart = new BoiteComptePlus();
    if (!${comptePlus}) {
      // remplissage des lignes : hors sujet ici
      for (let m of ["verifierDonnees", "majPonte", "majConstruction", "majRecherche", "majAttaque", "majConvoi", "majChasse"])
        encart[m] = function () { return this; };
    }
    encart.afficher();
    if (Utils.affichage("radar")) new BoiteRadar().afficher();
    let $tableau = $("#boiteComptePlus .contenu_boite_compte_plus table:eq(0)");
    return {
      tableau: $tableau[0].style.display,
      radar: $("#o_radar").length ? $("#o_radar")[0].style.display : null,
      titre: $("#boiteComptePlus .titre_colonne_cliquable").text().trim(),
    };
  })()`);

describe("Compte+ : vue radar mémorisée", () => {
  test("sans rien de surveillé : le tableau reste, pas de radar", () => {
    expect(afficher({ vue: "R" })).toEqual({ tableau: "", radar: null, titre: "Compte +" });
  });

  test("case du radar décochée : le tableau reste", () => {
    expect(afficher({ vue: "R", surveilles: true, radar: false })).toEqual({
      tableau: "",
      radar: null,
      titre: "Compte +",
    });
  });

  test("radar affiché : il prend la place du tableau", () => {
    expect(afficher({ vue: "R", surveilles: true })).toEqual({
      tableau: "none",
      radar: "",
      titre: "Synthèse OUAF",
    });
  });

  test("vue encart (ou jamais choisie) : le tableau, radar replié", () => {
    for (const vue of ["C", null])
      expect(afficher({ vue, surveilles: true })).toEqual({
        tableau: "",
        radar: "none",
        titre: "Synthèse OUAF",
      });
  });
});

describe("hors Compte+ : encart recréé par l'extension", () => {
  test("vue radar mémorisée sans radar affiché : le tableau reste", () => {
    expect(afficher({ comptePlus: false, vue: "R" })).toEqual({
      tableau: "",
      radar: null,
      titre: "Synthèse OUAF",
    });
  });

  test("radar affiché : il prend la place du tableau", () => {
    expect(afficher({ comptePlus: false, vue: "R", surveilles: true })).toMatchObject({
      tableau: "none",
      radar: "",
    });
  });
});
