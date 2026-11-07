import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

// étable 20 : 20 ressources par ouvrière
const page = creerPage(
  ["js/class/Utils.js", "js/page/Commerce.js"],
  "var monProfil = { niveauConstruction: { 11: 20 } };",
);

// formulaire « Organiser un convoi » du jeu : champs visibles et cachés
function formulaire(nourriture: number, materiaux: number) {
  page.lire(`(() => {
    document.body.innerHTML = '<span id="bouton_nourriture_max"></span><span id="bouton_materiaux_max"></span>' +
      '<input id="input_nbNourriture" value="${nourriture}"><input id="nbNourriture" value="${nourriture}">' +
      '<input id="input_nbMateriaux" value="${materiaux}"><input id="nbMateriaux" value="${materiaux}">' +
      '<input id="input_nbOuvriere"><input id="nbOuvriere">';
    new PageCommerce({}).arrondir();
  })()`);
}
const valeurs = () =>
  page.lire<string[]>(`["#nbNourriture", "#nbMateriaux", "#nbOuvriere"].map((s) => $(s).val())`);

describe("convois : liens « arrondir… »", () => {
  test("ouvrières arrondies au-dessus : aucune ressource sans porteuse", () => {
    formulaire(12345, 345);
    page.lire(`$("#o_arrondirNou").trigger("click")`);
    // 12 000 + 345 = 12 345 ressources, 617,25 ouvrières : 617 n'en porteraient que 12 340
    expect(valeurs()).toEqual(["12000", "345", "618"]);
  });

  test("total qui tombe juste : pas d'ouvrière en trop", () => {
    formulaire(1000, 20999);
    page.lire(`$("#o_arrondirMat").trigger("click")`);
    // 1 000 + 20 000 = 21 000 ressources : 1 050 ouvrières
    expect(valeurs()).toEqual(["1000", "20000", "1050"]);
  });
});
