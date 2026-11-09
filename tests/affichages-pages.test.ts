import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Une case par ajout dans les Préférences (onglets Attaque et Armée) : décochée,
 * seul son élément disparaît. Le rendu des vraies pages se vérifie dans Chromium.
 */
const page = creerPage(
  ["js/class/Utils.js", "js/page/Attaquer.js", "js/page/Armee.js"],
  `var AFFICHAGES_ONGLET = {}, TOAST_ERROR = {};
   var monProfil = { getTempsParcours2: () => 600, parametre: { sondeUnite: { valeur: 0 }, sondeQuantite: { valeur: 1 }, sondeLieu: { valeur: 0 } } };
   var Horloge = { clic: () => moment(), serveur: () => moment(), maintenant: () => Date.now(), libelleLatence: () => "" };
   var AttaqueLancee = { enregistrer: () => {} };`,
);
page.lire(`Utils.incrementTime = () => {};`);

const decocher = (cles: string[]) =>
  page.lire(`(() => {
    localStorage.clear();
    ${JSON.stringify(cles)}.forEach((c) => localStorage.setItem("fzzz_affichage_" + c, "0"));
  })()`);

// formulaire d'attaque du jeu, boutons de l'extension posés dessous
function boutons(cles: string[] = []) {
  decocher(cles);
  return page.lire<Record<string, number | boolean>>(`(() => {
    document.body.innerHTML = \`<form id="formulaireChoixArmee"><fieldset><select id="lieu"><option value="2">Fourmilière</option></select></fieldset>
      <fieldset><table id="tabChoixArmee"></table><center><input type="submit" name="ChoixArmee" value="Attaquer X !"/></center></fieldset></form>\`;
    let p = Object.create(PageAttaquer.prototype);
    p._cible = { pseudo: "X", terrain: 1000 };
    p.ajouterBoutons();
    let n = (s) => $(s).length;
    return {
      lancerPartager: n("#o_lancerPartager"), sonder: n("#o_sonder"), synchroSonde: n("#o_synchroSonde"),
      synchroniser: n("#o_synchro"), bloc: n("#o_btnLancer"), compteARebours: n("#o_syncA"),
      trajet: n("#o_tempsTrajet"), retour: n("#o_retourArmee"),
      couleurJeu: $("input[name='ChoixArmee']").hasClass("o_lieu2"),
      couleurLancer: $("#o_lancerPartager").hasClass("o_lieu2"),
    };
  })()`);
}

describe("page d'attaque : une case par bouton ou ligne", () => {
  test("tout coché : boutons, lignes et couleur du bouton du jeu", () => {
    expect(boutons()).toEqual({
      lancerPartager: 1,
      sonder: 1,
      synchroSonde: 1,
      synchroniser: 1,
      bloc: 1,
      compteARebours: 1,
      trajet: 1,
      retour: 1,
      couleurJeu: true,
      couleurLancer: true,
    });
  });

  test("chaque case retire son seul élément", () => {
    expect(boutons(["lancerPartager"])).toMatchObject({
      lancerPartager: 0,
      sonder: 1,
      synchroniser: 1,
    });
    // « Synchro sonde » prépare la sonde : il part avec « Sonder »
    expect(boutons(["sonder"])).toMatchObject({
      sonder: 0,
      synchroSonde: 0,
      synchroniser: 1,
      compteARebours: 1,
    });
    expect(boutons(["synchroniser"])).toMatchObject({
      synchroniser: 0,
      sonder: 1,
      compteARebours: 1,
    });
    expect(boutons(["retourArmee"])).toMatchObject({ retour: 0, trajet: 1 });
    // couleur : seul le bouton du jeu redevient celui du jeu
    expect(boutons(["couleurAttaquer"])).toMatchObject({ couleurJeu: false, couleurLancer: true });
  });

  test("sans aucun bouton : ni bloc vide ni ligne de compte à rebours", () => {
    expect(boutons(["lancerPartager", "sonder", "synchroniser"])).toMatchObject({
      bloc: 0,
      compteARebours: 0,
      trajet: 1,
    });
  });

  test("info-bulle de l'armée et Lanceur de Flood", async () => {
    for (const [cles, attendu] of [
      [[], [true, true]],
      [["statArmee"], [false, true]],
      [["lanceurFlood"], [true, false]],
    ] as [string[], boolean[]][]) {
      decocher(cles);
      page.lire(`(() => {
        window.vus = [false, false];
        document.body.innerHTML = "<table id='tabChoixArmee'></table>";
        let p = Object.create(PageAttaquer.prototype);
        p._cible = { getProfil: () => Promise.resolve(""), chargerProfil() {} };
        p.extraitArmee = () => ({});
        p.majStatistique = () => (vus[0] = true);
        p.formulaireFlood = () => (vus[1] = true);
        p.ajouterBoutons = p.activerBoutons = p.plus = () => {};
        window.Armee = function () {};
        AttaqueLancee.afficherTableaux = () => {};
        Utils.garderPosition = () => {};
        p.executer();
      })()`);
      await new Promise((r) => setTimeout(r, 10));
      expect(page.lire<boolean[]>(`vus`)).toEqual(attendu);
    }
  });
});

describe("page Armée hors Compte+ : flèches et lignes Vie / Attaque / Défense / Consommation", () => {
  test("chaque case garde ou retire sa partie", () => {
    const appels = (cles: string[]) => {
      decocher(cles);
      return page.lire<string[]>(`(() => {
        let p = Object.create(PageArmee.prototype), vus = [];
        p.fleches = () => vus.push("flèches");
        ["afficherLigneVie", "afficherLigneAttaque", "afficherLigneDefense", "afficherLigneConsommation"].forEach((m) => (p[m] = () => vus.push(m)));
        p.flechesEtLignes();
        return vus;
      })()`);
    };
    expect(appels([])).toEqual([
      "flèches",
      "afficherLigneVie",
      "afficherLigneAttaque",
      "afficherLigneDefense",
      "afficherLigneConsommation",
    ]);
    expect(appels(["armeeFleches"])).toEqual([
      "afficherLigneVie",
      "afficherLigneAttaque",
      "afficherLigneDefense",
      "afficherLigneConsommation",
    ]);
    expect(appels(["armeeLignes"])).toEqual(["flèches"]);
  });
});
