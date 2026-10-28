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

/** Un chargement de page : la lecture de la page Reine n'est partagée que dans une même page. */
function lancer(p: ReturnType<typeof creer>) {
  p.lire(
    `Utils._pageReine = null; $.get = () => { LECTURES++; return Promise.resolve(REINE); }; Utils.alertePonte();`,
  );
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

/** Extrait réel de la page Reine (C+, une ponte ; jetons retirés). */
const REINE_REELLE = `<h4 style="display:inline">Pontes en cours:</h4><table class="tableau_leger"><tr><td><strong>Unités</strong></td><td><strong>Garnison</strong></td><td><strong>Temps requis</strong></td><td><strong>Temps total restant</strong></td><td><strong>Ponte finie</strong></td><td></td></tr><tr><td><span id="unites_restantes_premiere_ponte">1 170 ouvrières</td>
			<td>  Fourmilière</td>
			<td><span id="temps_restant_premiere_ponte">17m 17s </span></td>
			<td><span id="ponte_373023">17m 17s </span></td>
				<td>15h00</td>
				<td><a href="Reine.php?AnnulerPonte=373023" style="font-size:0.8em">Annuler</a></td></tr><script type="text/javascript">reste_unite(1037, "unites_restantes_premiere_ponte" ,"ouvrières","1170");</script><script type="text/javascript">reste(1037, "temps_restant_premiere_ponte");</script><script type="text/javascript">reste(1037, "ponte_373023");</script>__SUITE__</table><td class="icones_unite cliquable3"></td>`;

describe("page Reine réelle", () => {
  const lire = (html: string) =>
    creer("").lire<string>(
      `JSON.stringify(Utils.pontesReine(Utils.parseHtml(${JSON.stringify(html)})).map((p) => [p.unite, p.nombre, p.secondes]))`,
    );
  test("une ponte : 1 170 ouvrières, 1 037 s", () => {
    expect(lire(REINE_REELLE.replace("__SUITE__", ""))).toBe(
      JSON.stringify([["ouvrières", 1170, 1037]]),
    );
  });
  test("ponte suivante : son temps total restant, pas son temps requis", () => {
    const suite = `<tr><td>5 000 Jeunes Soldates Naines</td><td>Loge</td><td><span id="temps_ponte_2">2H 0m</span></td><td><span id="ponte_373024">2H 17m 17s</span></td><td>17h17</td><td></td></tr><script type="text/javascript">reste(7200, "temps_ponte_2");</script><script type="text/javascript">reste(8237, "ponte_373024");</script>`;
    expect(lire(REINE_REELLE.replace("__SUITE__", suite))).toBe(
      JSON.stringify([
        ["ouvrières", 1170, 1037],
        ["Jeunes Soldates Naines", 5000, 8237],
      ]),
    );
  });
});

describe("bandeau d'alerte de ponte", () => {
  test("pontes jusqu'à demain : pas de bandeau, page Reine pas relue tant que la fin est loin", async () => {
    const p = creer(pageReine([3000, 90000]));
    lancer(p);
    await attendre();
    expect(p.lire(`$("#o_alertePonte").length`)).toBe(0);
    lancer(p);
    await attendre();
    expect(p.lire("LECTURES")).toBe(1);
    // fin connue lue il y a plus de 30 min (ponte annulée ailleurs ?) : relue
    p.lire(
      `localStorage.setItem("fzzz_finPonte", JSON.stringify({ fin: Date.now() + 86000e3, lu: Date.now() - 31 * 60000 }))`,
    );
    lancer(p);
    await attendre();
    expect(p.lire("LECTURES")).toBe(2);
  });

  test("fin de file proche du seuil : page Reine relue à chaque chargement", async () => {
    const p = creer(pageReine([3900]));
    lancer(p);
    await attendre();
    lancer(p);
    await attendre();
    expect(p.lire("LECTURES")).toBe(2);
  });

  test("fin de file sous le seuil : bandeau sous le menu, la croix le masque 10 min", async () => {
    const p = creer(pageReine([1200]));
    lancer(p);
    await attendre();
    expect(p.lire(`$("#menu").next().attr("id")`)).toBe("o_alertePonte");
    expect(p.lire(`$("#o_alertePonte .o_alertePonteTexte").attr("href")`)).toBe("/Reine.php");
    p.lire(`$(".o_alertePonteFermer").trigger("click")`);
    expect(p.lire(`$("#o_alertePonte").length`)).toBe(0);
    expect(
      p.lire(
        `Math.round((parseInt(localStorage.getItem("fzzz_alertePonteMuette")) - Date.now()) / 60000)`,
      ),
    ).toBe(10);
    lancer(p);
    await attendre();
    expect(p.lire(`$("#o_alertePonte").length`)).toBe(0);
  });

  test("ponte relancée au-delà du seuil : le masquage est levé pour la fin suivante", async () => {
    const p = creer(pageReine([1200]));
    lancer(p);
    await attendre();
    p.lire(`$(".o_alertePonteFermer").trigger("click")`);
    // file relancée : 5 h restantes, pas de bandeau, masquage levé
    p.lire(`REINE = ${JSON.stringify(pageReine([18000]))}`);
    lancer(p);
    await attendre();
    expect(p.lire(`localStorage.getItem("fzzz_alertePonteMuette")`)).toBeNull();
    // la nouvelle file arrive à son tour en fin de course (4 h plus tard) : bandeau
    p.lire(`REINE = ${JSON.stringify(pageReine([900]))}`);
    p.lire(
      `localStorage.setItem("fzzz_finPonte", JSON.stringify({ fin: Date.now() + 900e3, lu: Date.now() }))`,
    );
    lancer(p);
    await attendre();
    expect(p.lire(`$("#o_alertePonte").length`)).toBe(1);
  });

  test("aucune ponte en cours : bandeau « la reine ne pond plus »", async () => {
    const p = creer(pageReine([]));
    lancer(p);
    await attendre();
    expect(p.lire(`$("#o_alertePonte").hasClass("o_alertePonteArretee")`)).toBe(true);
  });

  test("masquage écoulé, ponte toujours pas relancée : le bandeau revient", async () => {
    const p = creer(pageReine([1200]));
    lancer(p);
    await attendre();
    p.lire(`$(".o_alertePonteFermer").trigger("click")`);
    p.lire(`localStorage.setItem("fzzz_alertePonteMuette", String(Date.now() - 1000))`);
    lancer(p);
    await attendre();
    expect(p.lire(`$("#o_alertePonte").length`)).toBe(1);
  });

  test("réponse qui n'est pas la page Reine : pas de fausse alerte", async () => {
    const p = creer("<html><body>Vous avez été déconnecté</body></html>");
    lancer(p);
    await attendre();
    expect(p.lire(`$("#o_alertePonte").length`)).toBe(0);
  });
});
