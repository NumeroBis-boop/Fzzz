import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

const page = creerPage(
  ["js/class/Utils.js", "js/page/CommerceFzzz.js"],
  "var monProfil = { niveauConstruction: { 11: 20 } }; var TOAST_INFO = {};",
);

// encart « S5 Pseudo » du jeu : nourriture et matériaux affichés
const encart = (materiaux: string) =>
  `<div id="boiteInfo" class="boite_info"><table><tr><td class="lien tooltip_boite_info"><a class="ligne_boite_info" href="Reine.php"><div class="jauge"></div><img class="icone_nourriture_boite_info" alt="Nourriture"/><div class="texte_ligne_boite_info" >10 271 725</div></a></td></tr><tr><td class="lien tooltip_boite_info"><a class="ligne_boite_info" href="construction.php"><div class="jauge"></div><img class="icone_materiaux_boite_info" alt="Materiaux"/> <div class="texte_ligne_boite_info">${materiaux}</div> </a></td></tr></table></div>`;
// formulaire du jeu : champs visibles et cachés, stock dans #nb_materiaux et,
// si `affiche` est donné, dans l'encart
const formulaire = (
  stock: string,
  pseudo = "",
  ouvrieres = "100000",
  tdc = "19095",
  affiche?: string,
) =>
  page.lire(`window.TOASTS = []; $.toast = (o) => TOASTS.push(o.text); document.body.innerHTML = ${JSON.stringify(affiche == null ? "" : encart(affiche))} + '<div id="nb_materiaux">${stock}</div><div id="nb_ouvrieres">${ouvrieres}</div><div id="quantite_tdc">${tdc}</div>' +
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

  // signalé par un joueur, 12/11/2026 : encart 2 207 990, champ rempli à 2 207 991
  test("stock à virgule : le nombre caché de la page dépasse de 1 celui de l'encart, c'est celui de l'encart qui est écrit", () => {
    formulaire("2207991", "Staffie", "3014663", "2760000", "2\u00a0207\u00a0990");
    page.lire(`CommerceFzzz.remplirMateriaux(12604640)`);
    expect(champs().slice(0, 2)).toEqual(["2207990", "2207990"]);
    expect(page.lire(`TOASTS`)).toEqual(["Matériaux réduits à 2 207 990 sur 12 604 640 : stock."]);
  });

  test("stock lu : le plus petit du nombre caché et de l'encart ; l'un des deux illisible : l'autre", () => {
    const stock = (cache: string, affiche?: string) => {
      formulaire(cache, "", "100000", "19095", affiche);
      return page.lire<number>(`Utils.materiaux`);
    };
    expect(stock("3460273", "3 460 273")).toBe(3460273);
    expect(stock("3460274", "3 460 273")).toBe(3460273);
    expect(stock("3460272", "3 460 273")).toBe(3460272);
    expect(stock("3460273")).toBe(3460273);
    expect(stock("3460273", "")).toBe(3460273);
    expect(stock("", "3 460 273")).toBe(3460273);
    expect(stock("")).toBeNaN();
    // la nourriture de l'encart n'est pas prise pour des matériaux
    expect(stock("20000000", "3 460 273")).toBe(3460273);
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
