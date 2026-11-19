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
 * Préférences, cumulables (demande du même jour) : ligne barrée (seule cochée
 * par défaut), ligne en rouge, colonne « Statut des stocks ». Pour voir ces
 * marques sans attendre qu'un joueur coche la case, un joueur de la ligne
 * « Journal » des réglages peut en simuler (demande du mainteneur, qui n'est
 * pas grenier). Joueurs et montants inventés.
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
const rappel = () => lire<string>(`$("#o_convoisMembres .o_convoisSimulation").text()`);

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
  test("par défaut, sa ligne barrée seule, avec une info-bulle ; montant et clic inchangés ; pas de colonne", async () => {
    await ouvrir();
    expect(classe("Alpha")).toBe("o_convoisBarree");
    expect(titre("Alpha")).toContain("Ne veut pas de convois");
    expect(classe("Bravo")).toBe("");
    // aucun convoi prévu vers lui : le site ne donne pas son choix
    expect(classe("Charlie")).toBe("");
    expect(
      lire(
        `$("#o_convoisMembres tr[data-pseudo='Alpha'] .o_convoisMembreMontant").data("montant")`,
      ),
    ).toBe(6452503);
    expect(enTetes()).not.toContain("Statut des stocks");
    expect(cellules("Alpha").length).toBe(5);
    expect(rappel()).toBe("");
  });

  test("ligne en rouge seule", async () => {
    await ouvrir({ barree: false, rouge: true });
    expect(classe("Alpha")).toBe("o_convoisRouge");
    expect(classe("Bravo")).toBe("");
  });

  test("barrée et rouge ensemble", async () => {
    await ouvrir({ rouge: true });
    expect(classe("Alpha").split(" ").sort()).toEqual(["o_convoisBarree", "o_convoisRouge"]);
    expect(titre("Alpha")).toContain("Ne veut pas de convois");
  });

  test("colonne « Statut des stocks » seule : ⚠️ Plein ⚠️, ✅, — quand le site ne le dit pas ; ligne ni barrée ni rouge", async () => {
    await ouvrir({ barree: false, colonne: true });
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

  test("les trois ensemble : ligne barrée et rouge, et la colonne", async () => {
    await ouvrir({ rouge: true, colonne: true });
    expect(classe("Alpha").split(" ").sort()).toEqual(["o_convoisBarree", "o_convoisRouge"]);
    expect(cellules("Alpha")[2]).toBe("⚠️ Plein ⚠️");
    expect(classe("Bravo")).toBe("");
    expect(cellules("Bravo")[2]).toBe("✅");
  });

  test("aucune case : rien n'est signalé", async () => {
    await ouvrir({ barree: false });
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
  });
});

describe("test du mainteneur : joueur compté comme ne voulant pas de convois", () => {
  test("joueur de la ligne « Journal » : le pseudo simulé est marqué comme si le site le disait, avec un rappel", async () => {
    await ouvrir({ colonne: true }, "secret", { journal: true, simule: "bravo" });
    // le site dit que Bravo accepte : la simulation l'emporte
    expect(classe("Bravo")).toBe("o_convoisBarree");
    expect(titre("Bravo")).toContain("Test : compté comme ne voulant pas de convois");
    expect(cellules("Bravo")[2]).toBe("⚠️ Plein ⚠️");
    // le vrai refus garde son info-bulle
    expect(titre("Alpha")).toContain("case « Je ne souhaite pas recevoir de convois » cochée");
    expect(classe("Charlie")).toBe("");
    expect(rappel()).toBe(
      "Test : Bravo compté comme ne voulant pas de convois (Préférences → Convois).",
    );
  });

  test("plusieurs pseudos, casse et doublons ignorés ; un joueur absent du tableau est signalé", async () => {
    await ouvrir({}, "secret", { journal: true, simule: "charlie, Delta ; CHARLIE" });
    expect(classe("Charlie")).toBe("o_convoisBarree");
    expect(rappel()).toBe(
      "Test : Charlie, Delta (pas dans ce tableau) comptés comme ne voulant pas de convois (Préférences → Convois).",
    );
  });

  test("un autre joueur que ceux de la ligne « Journal » : la simulation est ignorée", async () => {
    await ouvrir({}, "secret", { journal: false, simule: "Bravo" });
    expect(classe("Bravo")).toBe("");
    expect(rappel()).toBe("");
    expect(lire(`OuafSuivi.simulesSansReception()`)).toEqual([]);
  });

  test("site sans réponse ou pas de mot de passe : rien n'est simulé", async () => {
    await ouvrir({}, "", { journal: true, simule: "Bravo" });
    expect(classe("Bravo")).toBe("");
    expect(rappel()).toBe("");
  });
});

describe("choix unique de 1.142.0 et 1.142.1 repris dans les cases", () => {
  const reprendre = (sauve: Record<string, unknown>, cases: Record<string, string> = {}) =>
    lire<Record<string, string | null>>(`(() => {
      localStorage.clear();
      localStorage.setItem("outiiil_parametre", JSON.stringify(${JSON.stringify(sauve)}));
      Object.entries(${JSON.stringify(cases)}).forEach(([k, v]) => localStorage.setItem(k, v));
      new Joueur({ pseudo: "Moi" }).getParametre();
      return Object.fromEntries(MARQUES_SANS_RECEPTION.map((c) => [c, localStorage.getItem("fzzz_affichage_" + c)]));
    })()`);

  test("ligne en rouge (1) ou colonne (2) choisie : cette case seule cochée ; barrée (0) : rien à reprendre", () => {
    expect(reprendre({ convoisSansReception: "1" })).toEqual({
      convoisSansReceptionBarree: "0",
      convoisSansReceptionRouge: "1",
      convoisSansReceptionColonne: null,
    });
    expect(reprendre({ convoisSansReception: 2 })).toEqual({
      convoisSansReceptionBarree: "0",
      convoisSansReceptionRouge: null,
      convoisSansReceptionColonne: "1",
    });
    expect(reprendre({ convoisSansReception: "0" })).toEqual({
      convoisSansReceptionBarree: null,
      convoisSansReceptionRouge: null,
      convoisSansReceptionColonne: null,
    });
  });

  test("une case déjà réglée dans les nouvelles cases : rien n'est repris", () => {
    expect(
      reprendre({ convoisSansReception: "2" }, { fzzz_affichage_convoisSansReceptionRouge: "1" }),
    ).toEqual({
      convoisSansReceptionBarree: null,
      convoisSansReceptionRouge: "1",
      convoisSansReceptionColonne: null,
    });
  });
});
