import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { creerPage } from "./harnais";

/**
 * Récapitulatif de la page Convois : un destinataire qui a coché « Je ne
 * souhaite pas recevoir de convois » sur le site de suivi (demande du
 * mainteneur, 19/11/2026). Le site le donne sur chaque ligne de « Mes
 * convois » (`sans_reception`, réponses relevées par le mainteneur le
 * 19/11/2026) ; le Récapitulatif le montre avec les marques cochées dans les
 * Préférences, cumulables (demande du même jour) : ligne barrée, ligne en
 * rouge, colonne « Statut des stocks », les trois cochées par défaut (demande
 * du 20/11/2026). Joueurs et montants inventés.
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

/** Réponse de « Mes convois » (/api/mes), de la forme relevée sur le site. */
const MES = {
  vide: false,
  lignes: [
    // Alpha a coché la case : le site garde son montant
    {
      de: "Moi",
      vers: "Alpha",
      demande: 6452503,
      envoye: 0,
      sans_reception: true,
      restant: 6452503,
      etat: "À recevoir",
    },
    {
      de: "Moi",
      vers: "Bravo",
      demande: 1231594,
      envoye: 1231594,
      sans_reception: false,
      restant: 0,
      etat: "reçu",
    },
  ],
  membres: ["Alpha", "Bravo", "Charlie", "Moi"],
  receptions: [],
  mode: "envois",
  pseudo: "Moi",
};

type Marques = { barree?: boolean; rouge?: boolean; colonne?: boolean };
const CASES: [keyof Marques, string][] = [
  ["barree", "convoisSansReceptionBarree"],
  ["rouge", "convoisSansReceptionRouge"],
  ["colonne", "convoisSansReceptionColonne"],
];

/**
 * Page Convois ouverte, Alpha, Bravo et Charlie suivis (Charlie : aucun convoi
 * prévu vers lui) ; une marque non donnée garde l'état par défaut de sa case.
 */
async function ouvrir(
  marques: Marques = {},
  code = "secret",
  test: { journal?: boolean; simule?: string } = {},
) {
  const cases = CASES.filter(([m]) => marques[m] !== undefined).map(([m, cle]) => [
    "fzzz_affichage_" + cle,
    marques[m] ? "1" : "0",
  ]);
  lire(`(() => {
    localStorage.clear();
    localStorage.setItem("fzzz_convoisMembres", JSON.stringify(["Alpha", "Bravo", "Charlie"]));
    localStorage.setItem("fzzz_reglagesAlliance", JSON.stringify({ lu: 0, section: true, sujet: true, reglages: { siteConvois: "http://convois.invalid", journal: ${JSON.stringify(test.journal ? ["moi"] : [])} } }));
    ${JSON.stringify(cases)}.forEach(([k, v]) => localStorage.setItem(k, v));
    if (${JSON.stringify(test.simule != null)}) localStorage.setItem("fzzz_sansReceptionSimule", ${JSON.stringify(test.simule ?? "")});
    $.toast = () => {};
    window.monProfil = new Joueur({ pseudo: "Moi", x: 10, y: 10, niveauRecherche: [0, 0, 0, 0, 0, 0, 5, 0, 0, 0] });
    OuafSuivi.lireCode = () => Promise.resolve(${JSON.stringify(code)});
    OuafSuivi.connecter = () => Promise.resolve();
    OuafSuivi.requete = (methode, chemin) => Promise.resolve(chemin == "/api/mes" ? ${JSON.stringify(MES)} : {});
    document.body.innerHTML = '<div id="data"><div id="pseudo">Moi</div><div id="tag_alliance">TAG</div></div><div id="centre"><h3>Convois en cours:</h3><p>Aucun convoi</p></div>';
    CommerceFzzz.membresSuivis();
  })()`);
  // « … » tant que le site n'a pas répondu (ou que le mot de passe n'est pas lu)
  const lu = `$("#o_convoisMembres tr[data-pseudo='Alpha'] td:eq(1)").text().trim() != "…"`;
  for (let i = 0; i < 100 && !lire<boolean>(lu); i++) await new Promise((r) => setTimeout(r, 5));
  expect(lire<boolean>(lu)).toBe(true);
}
const classe = (pseudo: string) =>
  lire<string>(`$("#o_convoisMembres tr[data-pseudo='${pseudo}']").attr("class") || ""`);
const titre = (pseudo: string) =>
  lire<string>(`$("#o_convoisMembres tr[data-pseudo='${pseudo}']").attr("title") || ""`);
const cellules = (pseudo: string) =>
  lire<string[]>(
    `$("#o_convoisMembres tr[data-pseudo='${pseudo}'] td").map((i, td) => $(td).text().trim()).get()`,
  );
const enTetes = () =>
  lire<string[]>(
    `$("#o_convoisMembres thead th").map((i, th) => $(th).text().replace(/\\s+/g, " ").trim()).get()`,
  );

describe("choix des destinataires lu dans « Mes convois »", () => {
  test("sans_reception de chaque ligne ; casse du pseudo ignorée ; un « oui » suffit ; sans le champ : inconnu", () => {
    expect(
      lire(`[...OuafSuivi.sansReception([
        { vers: "Alpha", sans_reception: true },
        { vers: "bravo", sans_reception: false },
        { vers: "Charlie" },
        { vers: "ALPHA", sans_reception: false },
      ])]`),
    ).toEqual([
      ["alpha", true],
      ["bravo", false],
    ]);
    expect(lire(`OuafSuivi.sansReception(undefined).size`)).toBe(0);
  });
});

describe("Récapitulatif : marques d'un joueur qui ne veut pas de convois, cumulables", () => {
  test("par défaut, les trois marques : ligne barrée et rouge, avec une info-bulle, et la colonne ; montant et clic inchangés", async () => {
    await ouvrir();
    expect(classe("Alpha").split(" ").sort()).toEqual(["o_convoisBarree", "o_convoisRouge"]);
    expect(titre("Alpha")).toContain("Ne veut pas de convois");
    expect(classe("Bravo")).toBe("");
    // aucun convoi prévu vers lui : le site ne donne pas son choix
    expect(classe("Charlie")).toBe("");
    expect(
      lire(
        `$("#o_convoisMembres tr[data-pseudo='Alpha'] .o_convoisMembreMontant").data("montant")`,
      ),
    ).toBe(6452503);
    expect(enTetes()).toContain("Statut des stocks");
    expect(cellules("Alpha")[2]).toBe("⚠️ Plein ⚠️");
    expect(cellules("Bravo")[2]).toBe("✅");
  });

  test("ligne en rouge seule", async () => {
    await ouvrir({ barree: false, rouge: true, colonne: false });
    expect(classe("Alpha")).toBe("o_convoisRouge");
    expect(classe("Bravo")).toBe("");
  });

  test("barrée et rouge ensemble, sans colonne", async () => {
    await ouvrir({ barree: true, rouge: true, colonne: false });
    expect(classe("Alpha").split(" ").sort()).toEqual(["o_convoisBarree", "o_convoisRouge"]);
    expect(titre("Alpha")).toContain("Ne veut pas de convois");
    expect(enTetes()).not.toContain("Statut des stocks");
    expect(cellules("Alpha").length).toBe(5);
  });

  test("colonne « Statut des stocks » seule : ⚠️ Plein ⚠️, ✅, — quand le site ne le dit pas ; ligne ni barrée ni rouge", async () => {
    await ouvrir({ barree: false, rouge: false, colonne: true });
    expect(enTetes()).toEqual([
      "Joueur ⇅",
      "Convoi à faire ⇅",
      "Statut des stocks",
      "Temps de trajet ⇅",
      "Horaire de retour ⇅",
      "",
    ]);
    expect(cellules("Alpha")[2]).toBe("⚠️ Plein ⚠️");
    expect(cellules("Bravo")[2]).toBe("✅");
    expect(cellules("Charlie")[2]).toBe("—");
    expect(classe("Alpha")).toBe("");
    expect(cellules("Alpha").length).toBe(6);
    // ligne vide (+ Ajouter un membre à suivre) et pied du tableau à la même largeur
    lire(`$("#o_convoisMembreAjouter").trigger("click")`);
    expect(lire(`$("#o_convoisMembres .o_convoisMembreVide td").length`)).toBe(6);
    expect(lire(`$("#o_convoisMembres tfoot td").attr("colspan")`)).toBe("6");
  });

  test("aucune case : rien n'est signalé", async () => {
    await ouvrir({ barree: false, rouge: false, colonne: false });
    expect(classe("Alpha")).toBe("");
    expect(titre("Alpha")).toBe("");
    expect(enTetes()).not.toContain("Statut des stocks");
  });

  test("site non lu (pas de mot de passe) : rien n'est affirmé", async () => {
    await ouvrir({ colonne: true }, "");
    expect(cellules("Alpha")[2]).toBe("—");
    expect(
      lire(`$("#o_convoisMembres tr[data-pseudo='Alpha'] td:eq(2) span").attr("title")`),
    ).toContain("Mot de passe du site de suivi");
    expect(classe("Alpha")).toBe("");
  });

  test("styles : la croix « ne plus suivre » et « ⚠️ Plein ⚠️ » jamais barrées ; le rouge aussi sur les liens (pseudo, montant)", () => {
    const css = readFileSync(join(import.meta.dir, "..", "public", "css", "outiiil.css"), "utf8");
    expect(css).toContain(
      ".o_convoisMembres tr.o_convoisBarree td:not(:last-child):not(.o_convoisMembreStatut) {\n  text-decoration: line-through;",
    );
    expect(css).toContain(".o_convoisMembres tr.o_convoisRouge a {\n  color: var(--fzzz-erreur);");
    // la colonne se replie sur téléphone (« ⚠️ Plein ⚠️ » sur deux lignes)
    expect(css).toContain(".o_convoisMembres td.o_convoisMembreStatut {\n  white-space: normal;");
    // plus large que le cadre (téléphone, colonne cochée par défaut) : le tableau défile, la page ne s'élargit pas
    expect(css).toContain(".o_convoisMembresDefile {\n  max-width: 100%;\n  overflow-x: auto;");
    expect(css).not.toMatch(/#o_convoisMembres \{[^}]*min-width: min-content/);
  });

  test("le tableau est dans son conteneur qui défile", async () => {
    await ouvrir();
    expect(
      lire(`$("#o_convoisMembres .o_convoisMembresDefile > table.o_convoisMembres").length`),
    ).toBe(1);
  });
});

describe("plus de simulation pour le mainteneur (retirée en 1.143.2)", () => {
  test("pseudo laissé dans ce navigateur par 1.143.0 ou 1.143.1, joueur de la ligne « Journal » : ignoré", async () => {
    await ouvrir({ barree: true, rouge: false, colonne: true }, "secret", {
      journal: true,
      simule: "Bravo",
    });
    // le site dit que Bravo accepte : rien ne le contredit
    expect(classe("Bravo")).toBe("");
    expect(cellules("Bravo")[2]).toBe("✅");
    expect(classe("Alpha")).toBe("o_convoisBarree");
    expect(titre("Alpha")).toContain("case « Je ne souhaite pas recevoir de convois » cochée");
    expect(lire<string>(`$("#o_convoisMembres").text()`)).not.toContain("Test");
  });
});

describe("les trois marques recochées une fois par navigateur (mainteneur, 21/11/2026)", () => {
  const charger = (
    sauve: Record<string, unknown>,
    cases: Record<string, string> = {},
    vider = true,
  ) =>
    lire<Record<string, string | null>>(`(() => {
      if (${vider}) localStorage.clear();
      localStorage.setItem("outiiil_parametre", JSON.stringify(${JSON.stringify(sauve)}));
      Object.entries(${JSON.stringify(cases)}).forEach(([k, v]) => localStorage.setItem(k, v));
      new Joueur({ pseudo: "Moi" }).getParametre();
      return Object.fromEntries(MARQUES_SANS_RECEPTION.map((c) => [c, localStorage.getItem("fzzz_affichage_" + c)]));
    })()`);
  const TOUTES = {
    convoisSansReceptionBarree: "1",
    convoisSansReceptionRouge: "1",
    convoisSansReceptionColonne: "1",
  };

  test("décochées par la reprise de la 1.142 ou par le joueur : toutes recochées au premier chargement", () => {
    expect(
      charger(
        { convoisSansReception: "1" },
        {
          fzzz_affichage_convoisSansReceptionBarree: "0",
          fzzz_affichage_convoisSansReceptionRouge: "1",
          fzzz_affichage_convoisSansReceptionColonne: "0",
        },
      ),
    ).toEqual(TOUTES);
    expect(charger({})).toEqual(TOUTES);
  });

  test("une seule fois : une marque décochée ensuite le reste", () => {
    charger({});
    expect(charger({}, { fzzz_affichage_convoisSansReceptionColonne: "0" }, false)).toEqual({
      ...TOUTES,
      convoisSansReceptionColonne: "0",
    });
  });
});
