import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

const page = creerPage(
  [
    "js/class/Utils.js",
    "js/class/Parametre.js",
    "js/class/Joueur.js",
    "js/class/Armee.js",
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
    window.monProfil = new Joueur({ pseudo: "Moi" }).getParametre();
    document.body.innerHTML = '<div id="o_multiFlood"><p id="o_mfRecap"></p><p id="o_mfGardees"></p><button id="o_mfLancer"></button><button id="o_mfLancerPartager"></button></div>';
    window.boite = Object.create(BoiteCombat.prototype);
    boite._mfArmee = new Armee({ unite: { "Jeune Soldate Naine": 1000, "Jeune Soldate": 500 } });
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
async function lancer() {
  page.lire(`boite._mfLancer(false)`);
  await new Promise((r) => setTimeout(r, 20));
  return page.lire<[number, number][]>(`envois`);
}

describe("multi-flood : unités gardées (réserve des préférences)", () => {
  test("unités gardées affichées, récapitulatif sur les unités disponibles", () => {
    // les 500 dernières unités (les JS) restent : 1 000 disponibles
    ouvrir({ reserveFlood: 500 }, [600, 300]);
    expect(page.lire<string>(`$("#o_mfGardees").text()`)).toContain("500 Jeunes Soldates");
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

  test("réserve agrandie après le récapitulatif : rien ne part", async () => {
    ouvrir({ reserveFlood: 0 }, [600, 300]);
    expect(bloque()).toBe(false);
    page.lire(`monProfil.parametre.reserveFlood.valeur = 1000`);
    expect(await lancer()).toEqual([]);
    expect(page.lire<string[]>(`toasts`)[0]).toContain("Rien n'est parti");
    expect(bloque()).toBe(true);
  });

  test("réserve changée dans les préférences : récapitulatif refait, sauf après un lancement", async () => {
    ouvrir({ reserveFlood: 0 }, [600, 300]);
    page.lire(`monProfil.parametre.reserveFlood.valeur = 1000;
      monProfil.parametre.reserveFlood.sauvegarde()`);
    expect(bloque()).toBe(true);
    page.lire(`monProfil.parametre.reserveFlood.valeur = 0;
      monProfil.parametre.reserveFlood.sauvegarde()`);
    expect(bloque()).toBe(false);
    await lancer();
    // après le lancement, les boutons restent bloqués : pas de second envoi
    page.lire(`monProfil.parametre.reserveFlood.sauvegarde()`);
    expect(bloque()).toBe(true);
  });
});
