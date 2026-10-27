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
  return `<html><body><table class="tableau_leger"><tr><td>Unité</td></tr>${lignes}</table></body></html>`;
}

function creer(reine: string) {
  return creerPage(
    ["js/class/Utils.js"],
    `var monProfil = { parametre: { alertePonte: { valeur: 3 } } };
     var Horloge = { serveur: () => moment() };
     moment.duration.fn.format = moment.duration.fn.format || function () { return this.asSeconds() + "s"; };
     var REINE = ${JSON.stringify(reine)}, LECTURES = 0;`,
  );
}

const attendre = () => new Promise((r) => setTimeout(r, 20));

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

describe("alerte de ponte", () => {
  const lancer = (p: ReturnType<typeof creer>, reste: number) =>
    p.lire(`localStorage.clear(); $("#o_alertePonte").remove();
      $.get = () => { LECTURES++; return Promise.resolve(REINE); };
      Utils.alertePonte(${reste});`);

  test("file mémorisée trop courte mais pontes jusqu'à demain : pas d'alerte", async () => {
    const p = creer(pageReine([3000, 90000]));
    lancer(p, 3324);
    await attendre();
    expect(p.lire(`$("#o_alertePonte").length`)).toBe(0);
    expect(p.lire("LECTURES")).toBe(1);
    // fin connue depuis moins de 10 min : pas de nouvelle lecture
    p.lire(
      `$.get = () => { LECTURES++; return Promise.resolve(REINE); }; Utils.alertePonte(3324);`,
    );
    await attendre();
    expect(p.lire("LECTURES")).toBe(1);
  });

  test("fin de file confirmée : alerte, fermée par la croix", async () => {
    const p = creer(pageReine([1200]));
    lancer(p, 1200);
    await attendre();
    expect(p.lire(`$("#o_alertePonte").length`)).toBe(1);
    p.lire(`$(".o_alertePonteFermer").trigger("click")`);
    expect(p.lire(`$("#o_alertePonte").length`)).toBe(0);
    expect(p.lire(`parseInt(localStorage.getItem("fzzz_alertePonteMuette")) > Date.now()`)).toBe(
      true,
    );
  });

  test("« Me le rappeler » ferme aussi, le lien mène à la Reine", async () => {
    const p = creer(pageReine([1200]));
    lancer(p, 1200);
    await attendre();
    expect(p.lire(`$("#o_alertePonte a").attr("href")`)).toBe("/Reine.php");
    p.lire(`$(".o_alertePontePlusTard").trigger("click")`);
    expect(p.lire(`$("#o_alertePonte").length`)).toBe(0);
  });

  test("page Reine illisible : pas de fausse alerte", async () => {
    const p = creer("<html><body>maintenance</body></html>");
    lancer(p, 600);
    await attendre();
    expect(p.lire(`$("#o_alertePonte").length`)).toBe(0);
  });
});
