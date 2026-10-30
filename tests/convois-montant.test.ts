import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

const page = creerPage(
  ["js/class/Utils.js", "js/page/CommerceFzzz.js"],
  "var monProfil = { niveauConstruction: { 11: 20 } }; var TOAST_INFO = {};",
);

// formulaire du jeu : champs visibles et cachés, stock dans #nb_materiaux
const formulaire = (stock: string, pseudo = "", ouvrieres = "100000", tdc = "19095") =>
  page.lire(`$.toast = () => {}; document.body.innerHTML = '<div id="nb_materiaux">${stock}</div><div id="nb_ouvrieres">${ouvrieres}</div><div id="quantite_tdc">${tdc}</div>' +
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
    // étable 20 : 20 ressources par ouvrière ; (353 765 + 1 000) / 20 arrondi au-dessus
    expect(champs()).toEqual(["353765", "353765", "17739", "1000"]);
  });

  test("stock plus faible : réduit au stock", () => {
    formulaire("5000");
    page.lire(`CommerceFzzz.remplirMateriaux(353765)`);
    expect(champs()[0]).toBe("5000");
  });

  test("ouvrières du terrain gardées : montant réduit à ce que portent les autres", () => {
    // 30 000 ouvrières, TdC 19 095 : 10 905 libres × 20 = 218 100, moins 1 000 de nourriture
    formulaire("3460273", "", "30000", "19095");
    page.lire(`CommerceFzzz.remplirMateriaux(353765)`);
    expect(champs()).toEqual(["217100", "217100", "10905", "1000"]);
  });

  test("plus d'ouvrières que de terrain : rien n'est écrit en trop", () => {
    formulaire("3460273", "", "19000", "19095");
    page.lire(`CommerceFzzz.remplirMateriaux(353765)`);
    expect(champs()[0]).toBe("0");
  });

  test("destinataire écrit sans focus ni événement (pas de liste de suggestions)", () => {
    formulaire("3460273");
    const r = page.lire<{ val: string; focus: boolean; evts: number }>(`(() => {
      let n = 0, $c = $("#pseudo_convoi").on("focus input change keyup keydown", () => n++);
      CommerceFzzz.remplirDestinataire("Missyl");
      return { val: $c.val(), focus: document.activeElement === $c[0], evts: n };
    })()`);
    expect(r).toEqual({ val: "Missyl", focus: false, evts: 0 });
  });
});
