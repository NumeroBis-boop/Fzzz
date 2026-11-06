import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

const page = creerPage(
  [
    "js/lib/jquery-ui_1.12.1.js",
    "js/lib/globalize_0.1.1.js",
    "js/lib/globalize-locale-fr.js",
    "js/class/Utils.js",
    "js/class/Parametre.js",
    "js/class/Joueur.js",
    "js/boite/Boite.js",
    "js/boite/Parametres.js",
  ],
  `var METHODE_FLOOD = ["Standard", "Optimisée", "Uniforme", "Dégressive"],
     AFFECTATION_RESSOURCE = [], RATIO_RECOLTE = {};
   var NOM_UNITE = ["Ouvrière", "Jeune Soldate Naine", "Jeune Soldate", "Tank"];`,
);

// onglets Armée et Attaque des préférences, ouverts avec ces réglages enregistrés
function ouvrir(reglages: Record<string, unknown>) {
  page.lire(`(() => {
    localStorage.setItem("outiiil_parametre", JSON.stringify(${JSON.stringify(reglages)}));
    localStorage.setItem("fzzz_reserveEnPlus", "1");
    window.monProfil = new Joueur({ pseudo: "Moi" }).getParametre();
    document.body.innerHTML = "<div id='o_boiteParametre'><div id='o_tabsParametreArmee'></div><div id='o_tabsParametreAttaque'></div></div>";
    window.boite = new BoiteParametre();
    boite.ongletArmee().ongletAttaque();
    // happy-dom ignore l'option marquée selected (il renvoie toujours la 2e) :
    // les listes sont remises sur la valeur enregistrée, comme dans un navigateur
    ["methodeFlood", "reserveFloodType"].forEach((id) => $("#" + id).val(String(monProfil.parametre[id].valeur)));
    boite.event();
  })()`);
}
const visibles = () =>
  page.lire<
    string[]
  >(`["floodAttaques", "degressifBase", "degressifRegle", "reserveFloodAuto", "reserveFlood", "reserveFloodType", "o_reserveComplement"]
    .filter((id) => {
      let el = $("#" + id), ligne = el.closest(".o_ligneParam");
      return el[0].style.display != "none" && ligne[0].style.display != "none";
    })`);
// un choix dans une liste déclenche « input » (enregistrement) puis « change »
const choisir = (id: string, valeur: string) =>
  page.lire(`$("#${id}").val("${valeur}").trigger("input").trigger("change")`);
const cocher = (coche: boolean) =>
  page.lire(`$("#reserveFloodAuto").prop("checked", ${coche}).trigger("change")`);

describe("préférences du flood : réglages selon la méthode choisie", () => {
  test("plus de réglage d'écart : la règle « écart fixe » est de 5 points", () => {
    ouvrir({ methodeFlood: 3 });
    expect(page.lire<number>(`$("#degressifEcart").length`)).toBe(0);
    expect(page.lire<string>(`$("#degressifRegle option:eq(1)").text()`)).toContain(
      "Écart fixe de 5 points",
    );
  });

  test("chaque méthode n'affiche que ses réglages, les unités gardées toujours", () => {
    ouvrir({ methodeFlood: 1 });
    // Optimisée : le nombre d'attaques vient du calcul
    expect(visibles()).toEqual(["reserveFloodAuto", "reserveFlood"]);
    choisir("methodeFlood", "0");
    expect(visibles()).toEqual(["floodAttaques", "reserveFloodAuto", "reserveFlood"]);
    choisir("methodeFlood", "2");
    expect(visibles()).toEqual(["floodAttaques", "reserveFloodAuto", "reserveFlood"]);
    choisir("methodeFlood", "3");
    expect(visibles()).toEqual([
      "floodAttaques",
      "degressifBase",
      "degressifRegle",
      "reserveFloodAuto",
      "reserveFlood",
    ]);
  });

  test("à l'ouverture, réglages de la méthode enregistrée", () => {
    ouvrir({ methodeFlood: 3 });
    expect(visibles()).toContain("degressifBase");
    ouvrir({ methodeFlood: 1 });
    expect(visibles()).not.toContain("floodAttaques");
  });

  test("antisondes cochées : d'autres unités peuvent être gardées en plus", () => {
    ouvrir({
      methodeFlood: 1,
      reserveFloodAuto: true,
      uniteAntisondeTerrain: 2,
      uniteAntisondeDome: 5,
    });
    expect(page.lire<string>(`$("#o_reserveAntisondes").text()`)).toBe(
      "2 en terrain + 5 en dôme (onglet Armée)",
    );
    // le nombre d'autres unités reste libre, la case cochée
    expect(page.lire<number>(`$("#reserveFlood").spinner("value")`)).toBe(0);
    expect(page.lire<boolean>(`$("#reserveFlood").spinner("option", "disabled")`)).toBe(false);
    page.lire(`$("#reserveFlood").spinner("value", 300)`);
    expect(page.lire<number>(`monProfil.parametre.reserveFlood.valeur`)).toBe(300);
    expect(page.lire<boolean>(`monProfil.parametre.reserveFloodAuto.valeur`)).toBe(true);
    // des unités en plus : on choisit lesquelles ; une unité choisie : précision sur le manque
    expect(visibles()).toEqual(["reserveFloodAuto", "reserveFlood", "reserveFloodType"]);
    choisir("reserveFloodType", "2");
    expect(visibles()).toEqual([
      "reserveFloodAuto",
      "reserveFlood",
      "reserveFloodType",
      "o_reserveComplement",
    ]);
    expect(page.lire<string>(`String(monProfil.parametre.reserveFloodType.valeur)`)).toBe("2");
    // case décochée : les autres unités gardées restent
    cocher(false);
    expect(page.lire<number>(`$("#reserveFlood").spinner("value")`)).toBe(300);
    expect(page.lire<boolean>(`monProfil.parametre.reserveFloodAuto.valeur`)).toBe(false);
  });

  test("antisondes changées dans l'onglet Armée : leur nombre suit", () => {
    ouvrir({ uniteAntisondeTerrain: 2, uniteAntisondeDome: 5 });
    page.lire(`$("#uniteAntisondeDome").spinner("value", 1000)`);
    expect(page.lire<string>(`$("#o_reserveAntisondes").text()`)).toBe(
      `2 en terrain + ${page.lire<string>(`numeral(1000).format()`)} en dôme (onglet Armée)`,
    );
  });

  test("liste des unités gardées : les dernières unités par défaut, puis chaque unité", () => {
    ouvrir({});
    expect(
      page.lire<string[]>(`$("#reserveFloodType option").map((i, o) => o.textContent).get()`),
    ).toEqual(["Dernières unités de l'armée", "Jeune Soldate Naine", "Jeune Soldate", "Tank"]);
    expect(page.lire<number>(`monProfil.parametre.reserveFloodType.valeur`)).toBe(0);
  });
});
