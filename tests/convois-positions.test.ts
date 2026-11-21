import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

// Récapitulatif de la page Convois : un membre arrivé après la dernière lecture
// des positions n'a pas de temps de trajet ; « Actualiser les positions » les
// relit au clic, comme « Charger / Actualiser » de la Carte. Joueurs inventés.
const page = creerPage(
  [
    "js/class/Utils.js",
    "js/class/Parametre.js",
    "js/class/Joueur.js",
    "js/class/ExportJoueurs.js",
    "js/class/OuafSuivi.js",
    "js/page/Alliance.js",
    "js/page/CommerceFzzz.js",
  ],
  `var TOAST_SUCCESS = {}, TOAST_ERROR = {}, TOAST_INFO = {}, TOAST_WARNING = {};
   var METHODE_FLOOD = ["Standard", "Optimisée", "Uniforme", "Dégressive"], AFFECTATION_RESSOURCE = [], RATIO_RECOLTE = {};
   var NOM_UNITE = ["Ouvrière", "Jeune Soldate Naine"];
   var NOW = moment("2026-11-14T21:00:00").valueOf();
   var Horloge = { serveur: () => moment(NOW), maintenant: () => NOW, clic: () => moment(NOW) };
   var PartageChasses = {};`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);
const CLE = "outiiil_carteAlliance_S5_TAG";
const PROFIL_XATAK =
  "<div><div class='boite_membre'><a href='carte.php?x=20&y=30'>x=20 et y=30</a></div><a href='commerce.php?ID=77'>Convoi</a>" +
  "<table class='tableau_score'><tr><td>Score</td></tr><tr><td>Terrain</td><td>50</td></tr></table></div>";
const attendre = () => new Promise((r) => setTimeout(r, 20));

/** Page Convois ouverte : Alpha a une position gardée, XaTaK (nouveau) non. */
function ouvrir() {
  lire(`(() => {
    localStorage.clear();
    localStorage.setItem("fzzz_convoisMembres", JSON.stringify(["Alpha", "XaTaK"]));
    // sans la colonne « Statut des stocks » (cochée par défaut) : cellules lues par position
    localStorage.setItem("fzzz_affichage_convoisSansReceptionColonne", "0");
    localStorage.setItem(${JSON.stringify(CLE)}, JSON.stringify({ timestamp: 1, members: [{ pseudo: "Alpha", id: 1, x: 12, y: 10, terrain: 1000 }] }));
    window.TOASTS = []; window.APPELS = { membres: 0, profils: [] };
    $.toast = (o) => TOASTS.push(o.text);
    window.monProfil = new Joueur({ pseudo: "Moi", x: 10, y: 10, niveauRecherche: [0, 0, 0, 0, 0, 0, 5, 0, 0, 0] });
    OuafSuivi.lireCode = () => Promise.resolve("");
    // réglages de l'alliance déjà lus : site de suivi des convois inventé
    localStorage.setItem("fzzz_reglagesAlliance", JSON.stringify({ lu: 0, section: true, sujet: true, reglages: { siteConvois: "http://convois.invalid" } }));
    PartageChasses.tdcMembres = () => { APPELS.membres++; return Promise.resolve({ Alpha: 1000, XaTaK: 50, Moi: 2000 }); };
    ExportJoueurs.lire = () => Promise.resolve(new Map([["Alpha", { id: 1, x: 12, y: 10, terrain: 1000 }], ["Moi", { id: 2, x: 10, y: 10, terrain: 2000 }]]));
    Joueur.prototype.getProfil = function () { APPELS.profils.push(this.pseudo); return Promise.resolve(${JSON.stringify(PROFIL_XATAK)}); };
    document.body.innerHTML = '<div id="data"><div id="pseudo">Moi</div><div id="tag_alliance">TAG</div></div><div id="centre"><h3>Convois en cours:</h3><p>Aucun convoi</p></div>';
    CommerceFzzz.membresSuivis();
  })()`);
}
// lien et note masqués par jQuery (style display: none), affichés sinon
const lienAffiche = () =>
  lire<string>(`$("#o_convoisMembres .o_convoisPositions")[0].style.display`) != "none";
const ligne = (pseudo: string) =>
  lire<string[]>(
    `$("#o_convoisMembres tr[data-pseudo='${pseudo}'] td").map((i, td) => $(td).text().trim()).get()`,
  );

describe("Récapitulatif : « Actualiser les positions »", () => {
  test("lien discret en bas du tableau ; rien n'est lu à l'ouverture", async () => {
    ouvrir();
    await attendre();
    const $lien = `$("#o_convoisMembres tfoot .o_convoisPositions")`;
    expect(lire(`${$lien}.text()`)).toBe("Actualiser les positions");
    // XaTaK sans position : le lien est montré
    expect(lienAffiche()).toBe(true);
    expect(lire(`${$lien}.attr("title")`)).toContain("comme « Charger / Actualiser » de la Carte");
    expect(lire(`APPELS`)).toEqual({ membres: 0, profils: [] });
    // nouveau membre : temps de trajet inconnu, l'info-bulle dit quoi faire
    expect(ligne("XaTaK").slice(2, 4)).toEqual(["?", "—"]);
    expect(lire(`$("#o_convoisMembres tr[data-pseudo='XaTaK'] td:eq(2) span").attr("title")`)).toBe(
      "Position inconnue : « Actualiser les positions » en bas de ce tableau",
    );
    expect(ligne("Alpha")[2]).toMatch(/^\d\d:\d\d:\d\d$/);
  });

  test("au clic : membres, export, page du membre absent de l'export ; temps de trajet affiché sans recharger", async () => {
    ouvrir();
    await attendre();
    lire(`$("#o_convoisMembres .o_convoisPositions").trigger("click")`);
    await attendre();
    expect(lire(`APPELS`)).toEqual({ membres: 1, profils: ["XaTaK"] });
    expect(lire(`JSON.parse(localStorage.getItem(${JSON.stringify(CLE)})).members`)).toEqual([
      { pseudo: "Alpha", id: 1, x: 12, y: 10, terrain: 1000 },
      { pseudo: "XaTaK", id: "77", x: 20, y: 30, terrain: 50 },
      { pseudo: "Moi", id: 2, x: 10, y: 10, terrain: 2000 },
    ]);
    const xatak = ligne("XaTaK");
    expect(xatak[2]).toMatch(/^\d\d:\d\d:\d\d$/);
    expect(xatak[3]).toMatch(/^\d\d\/\d\d \d\d:\d\d$/);
    // même calcul que la Carte et la page Membres : coordonnées et Vitesse d'attaque
    const attendu = lire<number>(`monProfil.getTempsParcours2({ x: 20, y: 30 })`);
    const [h, m, s] = xatak[2]!.split(":").map(Number);
    expect(h! * 3600 + m! * 60 + s!).toBe(attendu);
    // plus de notification des convois, hors réduction faute d'ouvrières (mainteneur, 21/11/2026)
    expect(lire(`TOASTS`)).toEqual([]);
    expect(lire(`$("#o_convoisMembres .o_convoisPositions").text()`)).toBe(
      "Actualiser les positions",
    );
    expect(lire(`$("#o_convoisMembres .o_convoisPositions").hasClass("o_enCours")`)).toBe(false);
    // plus aucun temps inconnu : le lien disparaît
    expect(lienAffiche()).toBe(false);
  });

  test("tous les temps de trajet connus : pas de lien ; il revient avec un membre sans position", async () => {
    ouvrir();
    lire(`(() => {
      localStorage.setItem("fzzz_convoisMembres", JSON.stringify(["Alpha"]));
      $("#o_convoisMembres").remove();
      CommerceFzzz.membresSuivis();
    })()`);
    await attendre();
    expect(ligne("Alpha")[2]).toMatch(/^\d\d:\d\d:\d\d$/);
    expect(lienAffiche()).toBe(false);
    // XaTaK choisi dans la liste : temps inconnu, le lien apparaît
    lire(`(() => {
      $("#o_convoisMembreAjouter").trigger("click");
      $(".o_convoisMembreChoix").append("<option value='XaTaK'>XaTaK</option>").val("XaTaK").trigger("change");
    })()`);
    expect(ligne("XaTaK")[2]).toBe("?");
    expect(lienAffiche()).toBe(true);
    // retiré : plus rien d'inconnu
    lire(`$("#o_convoisMembres tr[data-pseudo='XaTaK'] .o_convoisMembreRetirer").trigger("click")`);
    expect(lienAffiche()).toBe(false);
  });

  test("membre suivi introuvable après la lecture : il est nommé, le lien reste", async () => {
    ouvrir();
    lire(`(() => {
      localStorage.setItem("fzzz_convoisMembres", JSON.stringify(["Alpha", "XaTaK", "Ancien"]));
      $("#o_convoisMembres").remove();
      CommerceFzzz.membresSuivis();
    })()`);
    await attendre();
    lire(`$("#o_convoisMembres .o_convoisPositions").trigger("click")`);
    await attendre();
    expect(lire(`TOASTS`)).toEqual([]);
    expect(ligne("XaTaK")[2]).toMatch(/^\d\d:\d\d:\d\d$/);
    expect(ligne("Ancien")[2]).toBe("?");
    expect(lienAffiche()).toBe(true);
  });

  test("clic répété pendant la lecture : une seule lecture", async () => {
    ouvrir();
    await attendre();
    lire(`(() => {
      let $l = $("#o_convoisMembres .o_convoisPositions");
      $l.trigger("click"); $l.trigger("click");
    })()`);
    await attendre();
    expect(lire(`APPELS.membres`)).toBe(1);
  });

  test("liste des membres illisible : message, positions gardées, lien rendu", async () => {
    ouvrir();
    await attendre();
    lire(`PartageChasses.tdcMembres = () => Promise.resolve({})`);
    lire(`$("#o_convoisMembres .o_convoisPositions").trigger("click")`);
    await attendre();
    expect(lire(`TOASTS`)).toEqual([
      "Positions non mises à jour : Aucun membre détecté dans l&#39;alliance.",
    ]);
    expect(
      lire<any[]>(`JSON.parse(localStorage.getItem(${JSON.stringify(CLE)})).members`).length,
    ).toBe(1);
    expect(lire(`$("#o_convoisMembres .o_convoisPositions").text()`)).toBe(
      "Actualiser les positions",
    );
  });

  test("aucune position gardée : la note renvoie au lien, et disparaît une fois les positions lues", async () => {
    ouvrir();
    lire(`(() => {
      localStorage.removeItem(${JSON.stringify(CLE)});
      $("#o_convoisMembres").remove();
      CommerceFzzz.membresSuivis();
    })()`);
    await attendre();
    expect(lire(`$(".o_convoisPositionsInconnues").text()`)).toBe(
      "Positions des membres inconnues : « Actualiser les positions » en bas de ce tableau.",
    );
    lire(`$("#o_convoisMembres .o_convoisPositions").trigger("click")`);
    await attendre();
    expect(lire(`$(".o_convoisPositionsInconnues").length`)).toBe(0);
    expect(ligne("Alpha")[2]).toMatch(/^\d\d:\d\d:\d\d$/);
  });
});
