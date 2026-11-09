import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Page Membres de l'alliance, onglet « Page membre » (1.96.1) : nombre de
 * membres par état et tableau triable, chacun sa case. Joueurs inventés.
 */
const page = creerPage(
  ["js/class/Utils.js", "js/page/Alliance.js"],
  `var AFFICHAGES_ONGLET = {};
   var Joueur = function (p) { Object.assign(this, p); };
   Joueur.activerLiensAttaque = () => {};
   Joueur.epeesPortee = () => {};`,
);

function traiter(cles: string[]) {
  return page.lire<{ etats: string; tableau: boolean; rang: string }>(`(() => {
    localStorage.clear();
    ${JSON.stringify(cles)}.forEach((c) => localStorage.setItem("fzzz_affichage_" + c, "0"));
    document.body.innerHTML =
      "<div class='simulateur'><table class='ligne_paire'><tr><td>a</td><td>Actifs</td></tr></table></div>" +
      "<table id='tabMembresAlliance'><tr><th>x</th></tr><tr><td></td><td><img alt='Actif'/></td><td>Grade très très long</td><td>Alpha</td><td></td><td>1 000</td><td></td><td>1</td><td>2</td></tr></table>";
    let p = Object.create(PageAlliance.prototype), tableau = false;
    p._alliance = { calculTerrain: () => 0, calculFourmiliere: () => 0, calculTechnologie: () => 0 };
    p._gradesNatifs = {};
    p.tableauAvecCarteCache = () => (tableau = true);
    p.traitementMembre();
    return { etats: $(".simulateur td:eq(1)").text(), tableau, rang: $("#tabMembresAlliance td:eq(2)").text() };
  })()`);
}

describe("page Membres de l'alliance : une case par ajout", () => {
  test("tout coché : nombre par état, tableau triable, rang raccourci", () => {
    expect(traiter([])).toEqual({ etats: "Actifs (1)", tableau: true, rang: "Grade très t…" });
  });
  test("chaque case retire sa partie", () => {
    expect(traiter(["membresEtats"])).toMatchObject({ etats: "Actifs", tableau: true });
    expect(traiter(["membresTableau"])).toEqual({
      etats: "Actifs (1)",
      tableau: false,
      rang: "Grade très très long",
    });
  });
});
