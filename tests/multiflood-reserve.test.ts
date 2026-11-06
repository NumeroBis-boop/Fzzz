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
    "js/boite/Combat.js",
  ],
  `var METHODE_FLOOD = [], AFFECTATION_RESSOURCE = [], RATIO_RECOLTE = {},
     TOAST_ERROR = {}, TOAST_SUCCESS = {};
   var NOM_UNITE = ["Ouvrière", "Jeune Soldate Naine", "Soldate Naine", "Naine d’Elite", "Jeune Soldate"],
     NOM_UNITES = ["Ouvrières", "Jeunes Soldates Naines", "Soldates Naines", "Naines d’Elite", "Jeunes Soldates"];
   var AttaqueLancee = { enregistrer() {}, partagerMarquees() {} };`,
);

/**
 * Onglet Multi-flood avec une armée lue de 1 000 JSN et 500 JS, et une cible
 * dont les attaques prévues sont `prises`. Le jeu est simulé : `envois` reçoit
 * les unités de chaque attaque postée, `toasts` les messages affichés.
 */
function ouvrir(reglages: object, prises: number[]) {
  page.lire(`(() => {
    localStorage.setItem("outiiil_parametre", JSON.stringify(${JSON.stringify({
      reserveFlood: 0,
      reserveFloodAuto: false,
      ...reglages,
    })}));
    localStorage.setItem("fzzz_reserveEnPlus", "1");
    window.monProfil = new Joueur({ pseudo: "Moi" }).getParametre();
    document.body.innerHTML = '<div id="o_multiFlood"><p id="o_mfRecap"></p><button id="o_mfLancer"></button><button id="o_mfLancerPartager"></button></div>';
    window.boite = Object.create(BoiteCombat.prototype);
    // bloc « Unités gardées pour ce multi-flood », comme dans multiFlood()
    boite._mfUnitesGardees = new UnitesGardees("o_mfGardees", () => boite._mfGardeesChangees());
    $("#o_mfRecap").after(boite._mfUnitesGardees.html());
    boite._mfUnitesGardees.brancher();
    boite._mfArmee = new Armee({ unite: { "Jeune Soldate Naine": 1000, "Jeune Soldate": 500 } });
    boite._mfArmee.gardees = boite._mfUnitesGardees.reglage;
    boite._mfTotalUnites = 1500;
    boite._mfResultats = [{
      cible: { pseudo: "X", id: 7, terrain: 100000, tempsParcours: 60 },
      attaques: ${JSON.stringify(prises)}.map((prise) => ({ prise, checked: true })),
    }];
    boite._mfEcouterReserve();
    boite.afficherRecapMultiFlood(boite._mfResultats);
    window.envois = [];
    window.toasts = [];
    window.confirm = () => true;
    window.setTimeout = (f) => (f(), 0);
    $.toast = (o) => toasts.push(o.text);
    $.get = () => $.Deferred().resolve('<input id="t" name="t" value="1"/>').promise();
    $.post = (url, donnees, retour) => {
      envois.push([donnees.unite1, donnees.unite4]);
      retour("<center>Vos troupes sont en marche</center>");
      return { fail() {} };
    };
  })()`);
}
const recap = () => page.lire<string>(`$("#o_mfRecap").text()`);
const bloque = () => page.lire<boolean>(`$("#o_mfLancer").prop("disabled")`);
// 1re ligne d'autres unités gardées, ajoutée si besoin : n unités
const garderEnPlus = (n: number) =>
  page.lire(`(() => {
    let $b = $("#o_mfGardees");
    if (!$b.find(".o_gardeesLigne").length) $b.find(".o_gardeesAjouter").trigger("click");
    $b.find(".o_gardeesNombre:first").spinner("value", ${n});
  })()`);
async function lancer() {
  page.lire(`boite._mfLancer(false)`);
  await new Promise((r) => setTimeout(r, 20));
  return page.lire<[number, number][]>(`envois`);
}

describe("multi-flood : unités gardées", () => {
  test("unités gardées affichées, récapitulatif sur les unités disponibles", () => {
    // préférences : les 500 dernières unités (les JS) restent ; 1 000 disponibles
    ouvrir({ reserveFlood: 500 }, [600, 300]);
    expect(page.lire<number>(`$("#o_mfGardees .o_gardeesNombre:first").spinner("value")`)).toBe(
      500,
    );
    expect(page.lire<string>(`$("#o_mfGardees .o_gardeesTexte").text()`)).toBe(
      "500 Jeunes Soldates",
    );
    expect(recap()).toContain("90% de votre armée en garnison hors unités gardées");
    expect(bloque()).toBe(false);
    ouvrir({ reserveFlood: 500 }, [800, 400]);
    expect(recap()).toContain("120%");
    expect(bloque()).toBe(true);
  });

  test("lancement : les unités gardées ne partent pas", async () => {
    // JS gardées : seules des JSN partent
    ouvrir({ reserveFlood: 500 }, [600, 300]);
    expect(await lancer()).toEqual([
      [600, 0],
      [300, 0],
    ]);
    // JSN gardées : les JS partent d'abord après les JSN disponibles
    ouvrir({ reserveFlood: 800, reserveFloodType: 1 }, [500, 200]);
    expect(await lancer()).toEqual([
      [200, 300],
      [0, 200],
    ]);
  });

  test("sans réserve : même envoi qu'avant (premières unités d'abord)", async () => {
    ouvrir({}, [1200, 300]);
    expect(await lancer()).toEqual([
      [1000, 200],
      [0, 300],
    ]);
  });

  test("unités gardées agrandies sans nouveau récapitulatif : rien ne part", async () => {
    ouvrir({ reserveFlood: 0 }, [600, 300]);
    expect(bloque()).toBe(false);
    page.lire(`boite._mfUnitesGardees.reglage.autres.push({ nombre: 1000, unite: 0 })`);
    expect(await lancer()).toEqual([]);
    expect(page.lire<string[]>(`toasts`)[0]).toContain("Rien n'est parti");
    expect(bloque()).toBe(true);
  });

  test("unités gardées changées pour ce multi-flood : récapitulatif refait, préférences inchangées", async () => {
    ouvrir({ reserveFlood: 0 }, [600, 300]);
    garderEnPlus(1000);
    expect(bloque()).toBe(true);
    garderEnPlus(0);
    expect(bloque()).toBe(false);
    expect(page.lire<number>(`monProfil.parametre.reserveFlood.valeur`)).toBe(0);
    expect(
      page.lire<number>(`JSON.parse(localStorage.getItem("outiiil_parametre")).reserveFlood`),
    ).toBe(0);
    await lancer();
    // après le lancement : champs bloqués, boutons aussi (pas de second envoi)
    expect(
      page.lire<boolean>(`$("#o_mfGardees .o_gardeesNombre:first").spinner("option", "disabled")`),
    ).toBe(true);
    page.lire(`monProfil.parametre.reserveFlood.sauvegarde()`);
    expect(bloque()).toBe(true);
  });

  test("deux lignes : 300 JSN et 200 JS restent, le reste part", async () => {
    ouvrir({}, [600, 300]);
    page.lire(`(() => {
      let $b = $("#o_mfGardees");
      $b.find(".o_gardeesAjouter").trigger("click");
      $b.find(".o_gardeesUnite:eq(0)").val("1").trigger("change");
      $b.find(".o_gardeesNombre:eq(0)").spinner("value", 300);
      $b.find(".o_gardeesAjouter").trigger("click");
      $b.find(".o_gardeesUnite:eq(1)").val("4").trigger("change");
      $b.find(".o_gardeesNombre:eq(1)").spinner("value", 200);
    })()`);
    expect(page.lire<string>(`$("#o_mfGardees .o_gardeesTexte").text()`)).toBe(
      "300 Jeunes Soldates Naines, 200 Jeunes Soldates",
    );
    // 700 JSN et 300 JS disponibles : 600 JSN, puis 100 JSN + 200 JS
    expect(await lancer()).toEqual([
      [600, 0],
      [100, 200],
    ]);
  });

  test("unités gardées pour ce multi-flood seulement : les JSN restent", async () => {
    ouvrir({}, [500, 200]);
    garderEnPlus(800);
    page.lire(`$("#o_mfGardees .o_gardeesUnite:first").val("1").trigger("change")`);
    expect(await lancer()).toEqual([
      [200, 300],
      [0, 200],
    ]);
    expect(page.lire<number>(`monProfil.parametre.reserveFloodType.valeur`)).toBe(0);
  });
});
