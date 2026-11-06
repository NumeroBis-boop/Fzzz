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
    "js/class/Armee.js",
    "js/class/UnitesGardees.js",
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
    $("#methodeFlood").val(String(monProfil.parametre.methodeFlood.valeur));
    $("#o_gardeesDefaut .o_gardeesUnite").each((i, s) => $(s).val($(s).find("option[selected]").val() || "0"));
    boite.event();
  })()`);
}
const visibles = () =>
  page.lire<string[]>(`["floodAttaques", "degressifBase", "degressifRegle", "o_gardeesDefaut"]
    .filter((id) => {
      let el = $("#" + id), ligne = el.closest(".o_ligneParam");
      return el[0].style.display != "none" && (!ligne.length || ligne[0].style.display != "none");
    })`);
// un choix dans une liste déclenche « input » (enregistrement) puis « change »
const choisir = (id: string, valeur: string) =>
  page.lire(`$("#${id}").val("${valeur}").trigger("input").trigger("change")`);
// bloc des unités gardées par défaut
const ajouter = () => page.lire(`$("#o_gardeesDefaut .o_gardeesAjouter").trigger("click")`);
const garder = (ligne: number, nombre: number, unite: number) =>
  page.lire(`(() => {
    let $l = $("#o_gardeesDefaut .o_gardeesLigne").eq(${ligne});
    $l.find(".o_gardeesUnite").val("${unite}").trigger("change");
    $l.find(".o_gardeesNombre").spinner("value", ${nombre});
  })()`);
const enregistre = () =>
  page.lire<
    Record<string, unknown>
  >(`(({ reserveFloodAuto, reserveFlood, reserveFloodType, reserveFloodAutres }) =>
    ({ reserveFloodAuto, reserveFlood, reserveFloodType, reserveFloodAutres }))(JSON.parse(localStorage.getItem("outiiil_parametre")))`);

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
    expect(visibles()).toEqual(["o_gardeesDefaut"]);
    choisir("methodeFlood", "0");
    expect(visibles()).toEqual(["floodAttaques", "o_gardeesDefaut"]);
    choisir("methodeFlood", "2");
    expect(visibles()).toEqual(["floodAttaques", "o_gardeesDefaut"]);
    choisir("methodeFlood", "3");
    expect(visibles()).toEqual([
      "floodAttaques",
      "degressifBase",
      "degressifRegle",
      "o_gardeesDefaut",
    ]);
  });

  test("à l'ouverture, réglages de la méthode enregistrée", () => {
    ouvrir({ methodeFlood: 3 });
    expect(visibles()).toContain("degressifBase");
    ouvrir({ methodeFlood: 1 });
    expect(visibles()).not.toContain("floodAttaques");
  });
});

describe("préférences du flood : unités gardées par défaut", () => {
  test("« + ajouter une unité » : une ligne de plus, le bouton reste dessous", () => {
    ouvrir({ reserveFloodAuto: true });
    expect(page.lire<number>(`$("#o_gardeesDefaut .o_gardeesLigne").length`)).toBe(0);
    ajouter();
    ajouter();
    expect(page.lire<number>(`$("#o_gardeesDefaut .o_gardeesLigne").length`)).toBe(2);
    // le bouton est sous la dernière ligne
    expect(
      page.lire<boolean>(
        `$("#o_gardeesDefaut .o_gardeesLignes").next().find(".o_gardeesAjouter").length == 1`,
      ),
    ).toBe(true);
    expect(
      page.lire<string[]>(
        `$("#o_gardeesDefaut .o_gardeesLigne:first .o_gardeesUnite option").map((i, o) => o.textContent).get()`,
      ),
    ).toEqual(["Dernières unités de l'armée", "Jeune Soldate Naine", "Jeune Soldate", "Tank"]);
  });

  test("chaque ligne enregistrée : la 1re dans reserveFlood, les suivantes à part", () => {
    ouvrir({ reserveFloodAuto: true });
    ajouter();
    garder(0, 300, 2);
    ajouter();
    garder(1, 200, 3);
    expect(enregistre()).toEqual({
      reserveFloodAuto: true,
      reserveFlood: 300,
      reserveFloodType: 2,
      reserveFloodAutres: [[200, 3]],
    });
    // 1re ligne retirée : la suivante prend sa place
    page.lire(`$("#o_gardeesDefaut .o_gardeesRetirer:first").trigger("click")`);
    expect(enregistre()).toEqual({
      reserveFloodAuto: true,
      reserveFlood: 200,
      reserveFloodType: 3,
      reserveFloodAutres: [],
    });
    // antisondes décochées : les autres unités restent
    page.lire(
      `$("#o_gardeesDefaut .o_gardeesAntisondes").prop("checked", false).trigger("change")`,
    );
    expect(enregistre()).toMatchObject({ reserveFloodAuto: false, reserveFlood: 200 });
  });

  test("à l'ouverture : les lignes enregistrées sont affichées", () => {
    ouvrir({ reserveFlood: 300, reserveFloodType: 2, reserveFloodAutres: [[200, 3]] });
    expect(
      page.lire<[number, string][]>(
        `$("#o_gardeesDefaut .o_gardeesLigne").map((i, l) => [[$(l).find(".o_gardeesNombre").spinner("value"), $(l).find(".o_gardeesUnite").val()]]).get()`,
      ),
    ).toEqual([
      [300, "2"],
      [200, "3"],
    ]);
  });

  test("antisondes changées dans l'onglet Armée : leur nombre suit", () => {
    ouvrir({ uniteAntisondeTerrain: 2, uniteAntisondeDome: 5 });
    expect(page.lire<string>(`$("#o_gardeesDefaut .o_gardeesNbAntisondes").text()`)).toBe(
      "(2 en terrain + 5 en dôme, onglet Armée)",
    );
    page.lire(`$("#uniteAntisondeDome").spinner("value", 1000)`);
    expect(page.lire<string>(`$("#o_gardeesDefaut .o_gardeesNbAntisondes").text()`)).toBe(
      `(2 en terrain + ${page.lire<string>(`numeral(1000).format()`)} en dôme, onglet Armée)`,
    );
  });
});
