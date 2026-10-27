import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/** Page Reine du jeu : une ligne par ponte, suivie de son appel reste(secondes, …). */
function pageReine(secondes: number[]): string {
  const lignes = secondes
    .map(
      (s, i) =>
        `<tr><td>4 679 Jeunes Soldates Naines</td><td></td><td></td><td id="p${i}"></td></tr><script>reste(${s},"p${i}");</script>`,
    )
    .join("");
  return `<html><body><table class="tableau_leger"><tr><td>Unité</td></tr>${lignes}</table><div class="icones_unite"></div></body></html>`;
}

function creer(reine: string) {
  return creerPage(
    ["js/class/Utils.js"],
    `var monProfil = { parametre: { alertePonte: { valeur: 3 } } };
     var Horloge = { serveur: () => moment() };
     moment.duration.fn.format = moment.duration.fn.format || function () { return this.asSeconds() + "s"; };
     var REINE = ${JSON.stringify(reine)}, LECTURES = 0;
     document.body.innerHTML = "<div id='centre'><nav id='menu'></nav><p>page</p></div>";`,
  );
}

const attendre = () => new Promise((r) => setTimeout(r, 20));

function lancer(p: ReturnType<typeof creer>) {
  p.lire(`$.get = () => { LECTURES++; return Promise.resolve(REINE); }; Utils.alertePonte();`);
}

describe("page Reine : file de ponte", () => {
  test("secondes restantes de chaque ponte, lues dans reste(…)", () => {
    const p = creer("");
    expect(
      p.lire(
        `JSON.stringify(Utils.pontesReine(Utils.parseHtml(${JSON.stringify(pageReine([3324, 90000]))})))`,
      ),
    ).toBe(
      JSON.stringify([
        { unite: "Jeunes Soldates Naines", nombre: 4679, secondes: 3324 },
        { unite: "Jeunes Soldates Naines", nombre: 4679, secondes: 90000 },
      ]),
    );
  });
});

describe("bandeau d'alerte de ponte", () => {
  test("pontes jusqu'à demain : pas de bandeau, page Reine relue au plus toutes les 10 min", async () => {
    const p = creer(pageReine([3000, 90000]));
    lancer(p);
    await attendre();
    expect(p.lire(`$("#o_alertePonte").length`)).toBe(0);
    lancer(p);
    await attendre();
    expect(p.lire("LECTURES")).toBe(1);
  });

  test("fin de file sous le seuil : bandeau sous le menu, la croix le masque 30 min", async () => {
    const p = creer(pageReine([1200]));
    lancer(p);
    await attendre();
    expect(p.lire(`$("#menu").next().attr("id")`)).toBe("o_alertePonte");
    expect(p.lire(`$("#o_alertePonte a").attr("href")`)).toBe("/Reine.php");
    p.lire(`$(".o_alertePonteFermer").trigger("click")`);
    expect(p.lire(`$("#o_alertePonte").length`)).toBe(0);
    lancer(p);
    await attendre();
    expect(p.lire(`$("#o_alertePonte").length`)).toBe(0);
  });

  test("aucune ponte en cours : bandeau « la reine ne pond plus »", async () => {
    const p = creer(pageReine([]));
    lancer(p);
    await attendre();
    expect(p.lire(`$("#o_alertePonte").hasClass("o_alertePonteArretee")`)).toBe(true);
  });

  test("réponse qui n'est pas la page Reine : pas de fausse alerte", async () => {
    const p = creer("<html><body>Vous avez été déconnecté</body></html>");
    lancer(p);
    await attendre();
    expect(p.lire(`$("#o_alertePonte").length`)).toBe(0);
  });
});
