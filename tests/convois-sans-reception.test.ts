import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { creerPage } from "./harnais";

/**
 * Récapitulatif de la page Convois : un destinataire qui a coché « Je ne
 * souhaite pas recevoir de convois » sur le site de suivi (demande du
 * mainteneur, 19/11/2026). Le site le donne sur chaque ligne de « Mes
 * convois » (`sans_reception`, réponses relevées par le mainteneur le
 * 19/11/2026) ; le Récapitulatif le montre au choix des Préférences : ligne
 * barrée (défaut), ligne en rouge, ou colonne « Statut des stocks ». Joueurs
 * et montants inventés.
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
const attendre = () => new Promise((r) => setTimeout(r, 20));

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

/** Page Convois ouverte, Alpha, Bravo et Charlie suivis (Charlie : aucun convoi prévu vers lui). */
async function ouvrir(marque: number, code = "secret") {
  lire(`(() => {
    localStorage.clear();
    localStorage.setItem("fzzz_convoisMembres", JSON.stringify(["Alpha", "Bravo", "Charlie"]));
    localStorage.setItem("fzzz_reglagesAlliance", JSON.stringify({ lu: 0, section: true, sujet: true, reglages: { siteConvois: "http://convois.invalid" } }));
    $.toast = () => {};
    window.monProfil = new Joueur({ pseudo: "Moi", x: 10, y: 10, niveauRecherche: [0, 0, 0, 0, 0, 0, 5, 0, 0, 0] });
    monProfil.parametre["convoisSansReception"].valeur = ${marque};
    OuafSuivi.lireCode = () => Promise.resolve(${JSON.stringify(code)});
    OuafSuivi.connecter = () => Promise.resolve();
    OuafSuivi.requete = (methode, chemin) => Promise.resolve(chemin == "/api/mes" ? ${JSON.stringify(MES)} : {});
    document.body.innerHTML = '<div id="data"><div id="pseudo">Moi</div><div id="tag_alliance">TAG</div></div><div id="centre"><h3>Convois en cours:</h3><p>Aucun convoi</p></div>';
    CommerceFzzz.membresSuivis();
  })()`);
  await attendre();
}
const classe = (pseudo: string) =>
  lire<string>(`$("#o_convoisMembres tr[data-pseudo='${pseudo}']").attr("class") || ""`);
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

describe("Récapitulatif : joueur qui ne veut pas de convois", () => {
  test("par défaut, sa ligne barrée avec une info-bulle ; montant et clic inchangés ; pas de colonne", async () => {
    await ouvrir(0);
    expect(classe("Alpha")).toBe("o_convoisBarree");
    expect(lire(`$("#o_convoisMembres tr[data-pseudo='Alpha']").attr("title")`)).toContain(
      "Ne veut pas de convois",
    );
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
  });

  test("ligne en rouge", async () => {
    await ouvrir(1);
    expect(classe("Alpha")).toBe("o_convoisRouge");
    expect(classe("Bravo")).toBe("");
  });

  test("colonne « Statut des stocks » : ⚠️ Plein ⚠️, ✅, — quand le site ne le dit pas ; ligne ni barrée ni rouge", async () => {
    await ouvrir(2);
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

  test("site non lu (pas de mot de passe) : rien n'est affirmé", async () => {
    await ouvrir(2, "");
    expect(cellules("Alpha")[2]).toBe("—");
    expect(
      lire(`$("#o_convoisMembres tr[data-pseudo='Alpha'] td:eq(2) span").attr("title")`),
    ).toContain("Mot de passe du site de suivi");
    await ouvrir(0, "");
    expect(classe("Alpha")).toBe("");
  });

  test("styles : la croix « ne plus suivre » jamais barrée ; le rouge aussi sur les liens (pseudo, montant)", () => {
    const css = readFileSync(join(import.meta.dir, "..", "public", "css", "outiiil.css"), "utf8");
    expect(css).toContain(
      ".o_convoisMembres tr.o_convoisBarree td:not(:last-child) {\n  text-decoration: line-through;",
    );
    expect(css).toContain(".o_convoisMembres tr.o_convoisRouge a {\n  color: var(--fzzz-erreur);");
    // la colonne se replie sur téléphone (« ⚠️ Plein ⚠️ » sur deux lignes)
    expect(css).toContain(".o_convoisMembres td.o_convoisMembreStatut {\n  white-space: normal;");
  });
});
