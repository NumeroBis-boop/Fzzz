import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

const page = creerPage(
  ["js/class/Utils.js", "js/page/CommerceFzzz.js"],
  "var monProfil = { niveauConstruction: { 11: 20 } };",
);

// formulaire du jeu : champs visibles et cachés, stock dans #nb_materiaux
const formulaire = (stock: string, pseudo = "") =>
  page.lire(`document.body.innerHTML = '<div id="nb_materiaux">${stock}</div>' +
    '<input id="pseudo_convoi" value="${pseudo}"><input id="input_nbNourriture" value="1 000"><input id="nbNourriture" value="1000">' +
    '<input id="input_nbMateriaux"><input id="nbMateriaux"><input id="input_nbOuvriere"><input id="nbOuvriere">'`);
const champs = () =>
  page.lire<string[]>(
    `["#input_nbMateriaux", "#nbMateriaux", "#input_nbOuvriere", "#nbNourriture"].map((s) => $(s).val())`,
  );

describe("clic sur un montant du Récapitulatif", () => {
  test("montant dû plafonné au stock, chiffres seuls", () => {
    expect(page.lire(`CommerceFzzz.montantMateriaux(353765, 3460273)`)).toBe("353765");
    expect(page.lire(`CommerceFzzz.montantMateriaux(353765, 120000)`)).toBe("120000");
    expect(page.lire(`CommerceFzzz.montantMateriaux(353765.6, NaN)`)).toBe("353765");
  });

  test("matériaux écrits sans espace, ouvrières recalculées, nourriture inchangée", () => {
    formulaire("3460273");
    page.lire(`CommerceFzzz.remplirMateriaux(353765)`);
    // étable 20 : 20 ressources par ouvrière ; (353 765 + 1 000) / 20
    expect(champs()).toEqual(["353765", "353765", "17738", "1000"]);
  });

  test("stock plus faible : réduit au stock", () => {
    formulaire("5000");
    page.lire(`CommerceFzzz.remplirMateriaux(353765)`);
    expect(champs()[0]).toBe("5000");
  });

  test("après rechargement : appliqué une fois, seulement pour le bon destinataire", () => {
    formulaire("3460273", "Missyl");
    page.lire(
      `sessionStorage.setItem("fzzz_montantConvoi", JSON.stringify({ pseudo: "missyl", montant: 353765, quand: Date.now() })); CommerceFzzz.appliquerMontant()`,
    );
    expect(champs()[0]).toBe("353765");
    formulaire("3460273", "Missyl");
    page.lire(`CommerceFzzz.appliquerMontant()`);
    expect(champs()[0]).toBe("");
    formulaire("3460273", "Grim");
    page.lire(
      `sessionStorage.setItem("fzzz_montantConvoi", JSON.stringify({ pseudo: "Missyl", montant: 353765, quand: Date.now() })); CommerceFzzz.appliquerMontant()`,
    );
    expect(champs()[0]).toBe("");
  });
});
