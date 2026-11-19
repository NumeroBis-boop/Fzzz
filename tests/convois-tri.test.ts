import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { creerPage } from "./harnais";

/**
 * Tri du « Récapitulatif » de la page Convois gardé d'une visite à l'autre
 * (demande du mainteneur, 19/11/2026 : « si j'ai fait un tri par ordre
 * croissant de dette, alors quand je me reconnecterai 24h plus tard j'aurais
 * encore la même vue » ; sans tri choisi, l'ordre d'ajout reste). Joueurs et
 * montants inventés.
 */
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
   var NOW = moment("2026-11-19T16:00:00").valueOf();
   var Horloge = { serveur: () => moment(NOW), maintenant: () => NOW, clic: () => moment(NOW) };
   var PartageChasses = {};`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);

/** « Mes convois » : Delta suivi sans convoi prévu (montant inconnu). */
const MES = {
  vide: false,
  lignes: [
    { de: "Moi", vers: "Alpha", demande: 6452503, envoye: 0, sans_reception: false },
    { de: "Moi", vers: "Bravo", demande: 1231594, envoye: 0, sans_reception: false },
    { de: "Moi", vers: "Charlie", demande: 300000, envoye: 0, sans_reception: false },
  ],
  membres: ["Alpha", "Bravo", "Charlie", "Delta", "Moi"],
  mode: "envois",
  pseudo: "Moi",
};
const AJOUT = ["Bravo", "Delta", "Charlie", "Alpha"];

/** Réglages et joueurs suivis, comme dans le navigateur du joueur ; le tri gardé n'est pas touché. */
function preparer() {
  lire(`(() => {
    localStorage.setItem("fzzz_convoisMembres", JSON.stringify(${JSON.stringify(AJOUT)}));
    localStorage.setItem("fzzz_reglagesAlliance", JSON.stringify({ lu: 0, section: true, sujet: true, reglages: { siteConvois: "http://convois.invalid" } }));
    $.toast = () => {};
    window.monProfil = new Joueur({ pseudo: "Moi", x: 10, y: 10, niveauRecherche: [0, 0, 0, 0, 0, 0, 5, 0, 0, 0] });
    OuafSuivi.connecter = () => Promise.resolve();
    OuafSuivi.requete = (methode, chemin) => Promise.resolve(chemin == "/api/mes" ? ${JSON.stringify(MES)} : {});
  })()`);
}

const ordre = () =>
  lire<string[]>(
    `$("#o_convoisMembres tbody tr[data-pseudo]").map((i, tr) => String($(tr).data("pseudo"))).get()`,
  );
const icone = (col: string) =>
  lire<string>(`$("#o_convoisMembres th[data-tri='${col}'] .o_triIcone").text()`);
const cliquer = (col: string) =>
  lire(`$("#o_convoisMembres th[data-tri='${col}'] .o_triIcone").trigger("click")`);
const garde = () => lire<string | null>(`localStorage.getItem("fzzz_triConvoisMembres")`);

/** Ouverture (ou rechargement) de la page Convois, montants du site lus. */
async function ouvrir(code = "secret") {
  lire(`(() => {
    OuafSuivi.lireCode = () => Promise.resolve(${JSON.stringify(code)});
    document.body.innerHTML = '<div id="data"><div id="pseudo">Moi</div><div id="tag_alliance">TAG</div></div><div id="centre"><h3>Convois en cours:</h3><p>Aucun convoi</p></div>';
    CommerceFzzz.membresSuivis();
  })()`);
  const lu = code
    ? `$("#o_convoisMembres .o_convoisMembreMontant").length == 3`
    : `$("#o_convoisMembres tr[data-pseudo='Alpha'] td:eq(1)").text().trim() == "—"`;
  for (let i = 0; i < 100 && !lire<boolean>(lu); i++) await new Promise((r) => setTimeout(r, 5));
  expect(lire<boolean>(lu)).toBe(true);
}

describe("tri du Récapitulatif gardé d'une visite à l'autre", () => {
  test("aucun tri choisi : ordre d'ajout des joueurs, rien de gardé", async () => {
    lire(`localStorage.clear(); sessionStorage.clear()`);
    preparer();
    await ouvrir();
    expect(ordre()).toEqual(AJOUT);
    for (const col of ["joueur", "reste", "trajet", "retour"]) expect(icone(col)).toBe("⇅");
    expect(garde()).toBeNull();
  });

  test("Convoi à faire croissant : gardé au rechargement, montants inconnus en bas", async () => {
    lire(`localStorage.clear(); sessionStorage.clear()`);
    preparer();
    await ouvrir();
    cliquer("reste");
    expect(ordre()).toEqual(["Charlie", "Bravo", "Alpha", "Delta"]);
    expect(JSON.parse(garde()!)).toEqual({ col: "reste", sens: 1 });
    // le lendemain : autre onglet, sessionStorage vide, autres pages ouvertes avant
    lire(`sessionStorage.clear()`);
    await ouvrir();
    expect(ordre()).toEqual(["Charlie", "Bravo", "Alpha", "Delta"]);
    expect(icone("reste")).toBe("▲");
    expect(icone("joueur")).toBe("⇅");
  });

  test("décroissant gardé ; troisième clic : ordre d'ajout et plus rien de gardé", async () => {
    lire(`localStorage.clear(); sessionStorage.clear()`);
    preparer();
    await ouvrir();
    cliquer("reste");
    cliquer("reste");
    expect(ordre()).toEqual(["Alpha", "Bravo", "Charlie", "Delta"]);
    await ouvrir();
    expect(ordre()).toEqual(["Alpha", "Bravo", "Charlie", "Delta"]);
    expect(icone("reste")).toBe("▼");
    cliquer("reste");
    expect(ordre()).toEqual(AJOUT);
    expect(garde()).toBeNull();
    await ouvrir();
    expect(ordre()).toEqual(AJOUT);
    expect(icone("reste")).toBe("⇅");
  });

  test("un autre tri remplace le précédent", async () => {
    lire(`localStorage.clear(); sessionStorage.clear()`);
    preparer();
    await ouvrir();
    cliquer("reste");
    cliquer("joueur");
    await ouvrir();
    expect(ordre()).toEqual(["Alpha", "Bravo", "Charlie", "Delta"]);
    expect(icone("joueur")).toBe("▲");
    expect(icone("reste")).toBe("⇅");
  });

  test("site non lu : tri gardé, ordre d'ajout tant que les montants sont inconnus", async () => {
    lire(`localStorage.clear(); sessionStorage.clear()`);
    preparer();
    lire(
      `localStorage.setItem("fzzz_triConvoisMembres", JSON.stringify({ col: "reste", sens: 1 }))`,
    );
    await ouvrir("");
    expect(ordre()).toEqual(AJOUT);
    expect(icone("reste")).toBe("▲");
    expect(JSON.parse(garde()!)).toEqual({ col: "reste", sens: 1 });
  });

  test("tri gardé illisible ou sur une colonne absente : ordre d'ajout", async () => {
    for (const valeur of [
      `JSON.stringify({ col: "statut", sens: 1 })`,
      `JSON.stringify({ col: "reste", sens: 0 })`,
      `JSON.stringify("reste")`,
      `"pas du json"`,
    ]) {
      lire(`localStorage.clear(); sessionStorage.clear()`);
      preparer();
      lire(`localStorage.setItem("fzzz_triConvoisMembres", ${valeur})`);
      await ouvrir();
      expect(ordre()).toEqual(AJOUT);
      for (const col of ["joueur", "reste", "trajet", "retour"]) expect(icone(col)).toBe("⇅");
    }
  });

  test("aucune autre page n'efface le tri (avant 1.142.1 : oublié hors de la page Convois)", () => {
    const racine = join(import.meta.dir, "..", "public", "js");
    const fichiers = (dossier: string): string[] =>
      readdirSync(join(racine, dossier), { withFileTypes: true }).flatMap((f) =>
        f.isDirectory()
          ? f.name == "lib"
            ? []
            : fichiers(join(dossier, f.name))
          : f.name.endsWith(".js")
            ? [join(dossier, f.name)]
            : [],
      );
    const utilisent = fichiers("")
      .filter((f) =>
        /CLE_TRI_CONVOIS|fzzz_triConvoisMembres/.test(readFileSync(join(racine, f), "utf8")),
      )
      .sort();
    expect(utilisent).toEqual([join("page", "CommerceFzzz.js")]);
    const commerce = readFileSync(join(racine, "page", "CommerceFzzz.js"), "utf8");
    expect(commerce).not.toMatch(/sessionStorage\.\w+\(CLE_TRI_CONVOIS/);
  });
});
