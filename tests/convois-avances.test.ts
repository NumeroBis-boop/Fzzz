import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { creerPage } from "./harnais";

/**
 * Récapitulatif de la page Convois : les demandes d'avance du site de suivi
 * (page Avances, « Demandes d'avance ») après le convoi à faire, « (+montant) »
 * en vert, et « (+avance) » en vert et en gras dans la colonne « Statut des
 * stocks » (demandes du mainteneur, 26/11/2026). Le site les donne dans le champ
 * `demandes` de /api/avances (réponse relevée par le mainteneur le
 * 26/11/2026). Joueurs et montants inventés.
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
   var NOW = moment("2026-11-26T09:00:00").valueOf();
   var Horloge = { serveur: () => moment(NOW), maintenant: () => NOW, clic: () => moment(NOW) };
   var PartageChasses = {};`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);

const MES = {
  vide: false,
  lignes: [
    { de: "Moi", vers: "Alpha", demande: 6452503, envoye: 0, sans_reception: false },
    { de: "Moi", vers: "Bravo", demande: 1231594, envoye: 0, sans_reception: false },
  ],
  membres: ["Alpha", "Bravo", "Charlie", "Delta", "Moi"],
  pseudo: "Moi",
};

/** Réponse de /api/avances, de la forme relevée sur le site. */
const AVANCES = {
  vide: false,
  lignes: [],
  membres: ["Alpha", "Bravo", "Charlie", "Delta", "Moi"],
  suggestions: [{ pseudo: "Bravo", solde: -7888174.05, besoin: 7888174.05 }],
  // casse du site différente de celle du Récapitulatif ; Delta n'est pas suivi
  demandes: [
    { pseudo: "alpha", montant: 31000000.0 },
    { pseudo: "Charlie", montant: 1500.0 },
    { pseudo: "Delta", montant: 2000.0 },
    { pseudo: "Moi", montant: 1.0 },
  ],
  totaux: { lignes: 0, montant: 0, recues: 0, recu: 0 },
  recues: [],
  pseudo: "Moi",
  ma_demande: { pseudo: "Moi", montant: 1.0 },
};

/**
 * Page Convois ouverte, Alpha, Bravo et Charlie suivis (Charlie : aucun convoi
 * prévu vers lui). `avances` : réponse de /api/avances, ou "erreur" (refusée).
 */
async function ouvrir(
  avances: object | "erreur" = AVANCES,
  mesEnAttente = false,
  { mes = MES as object, colonne = true } = {},
) {
  lire(`(() => {
    localStorage.clear();
    localStorage.setItem("fzzz_convoisMembres", JSON.stringify(["Alpha", "Bravo", "Charlie"]));
    if (!${colonne}) localStorage.setItem("fzzz_affichage_convoisSansReceptionColonne", "0");
    localStorage.setItem("fzzz_reglagesAlliance", JSON.stringify({ lu: 0, section: true, sujet: true, reglages: { siteConvois: "http://convois.invalid" } }));
    $.toast = () => {};
    // une page par test : pas les écouteurs des pages d'avant
    $(document).off(EVENEMENT_CONVOI_ENREGISTRE);
    window.lectures = [];
    window.notes = [];
    Journal.info = (source, message) => notes.push(source + " : " + message);
    window.monProfil = new Joueur({ pseudo: "Moi", x: 10, y: 10, niveauRecherche: [0, 0, 0, 0, 0, 0, 5, 0, 0, 0] });
    OuafSuivi.lireCode = () => Promise.resolve("secret");
    OuafSuivi.connecter = () => Promise.resolve();
    OuafSuivi.requete = (methode, chemin) => {
      lectures.push(methode + " " + chemin);
      if (chemin == "/api/mes")
        return ${mesEnAttente} ? new Promise(() => {}) : Promise.resolve(${JSON.stringify(mes)});
      if (chemin == "/api/avances")
        return ${JSON.stringify(avances)} == "erreur"
          ? Promise.reject(Object.assign(new Error("HTTP 500"), { name: "reseau" }))
          : Promise.resolve(${JSON.stringify(avances)});
      return Promise.resolve({});
    };
    document.body.innerHTML = '<div id="data"><div id="pseudo">Moi</div><div id="tag_alliance">TAG</div></div><div id="centre"><h3>Convois en cours:</h3><p>Aucun convoi</p></div>';
    CommerceFzzz.membresSuivis();
  })()`);
  // les deux lectures du site finies (succès ou refus)
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 5));
  if (!mesEnAttente)
    expect(
      lire<string>(`$("#o_convoisMembres tr[data-pseudo='Alpha'] td:eq(1)").text().trim()`),
    ).not.toBe("…");
}
const cellule = (pseudo: string) =>
  lire<string>(
    `$("#o_convoisMembres tr[data-pseudo='${pseudo}'] td:eq(1)").text().replace(/\\s+/g, " ").trim()`,
  );
const avance = (pseudo: string) =>
  lire<string | null>(
    `$("#o_convoisMembres tr[data-pseudo='${pseudo}'] .o_convoisAvance").text() || null`,
  );
/** Colonne « Statut des stocks » (3e colonne quand elle est cochée). */
const statut = (pseudo: string) =>
  lire<string>(
    `$("#o_convoisMembres tr[data-pseudo='${pseudo}'] td:eq(2)").text().replace(/\s+/g, " ").trim()`,
  );
const nombre = (n: number) => lire<string>(`numeral(${n}).format()`).replace(/\s+/g, " ");

describe("demandes d'avance lues dans /api/avances", () => {
  test("montant par joueur, casse du pseudo ignorée ; montant nul, négatif ou absent ignoré", () => {
    expect(
      lire(`[...OuafSuivi.demandesAvance([
        { pseudo: "Alpha", montant: 31000000.0 },
        { pseudo: "bravo", montant: 0 },
        { pseudo: "Charlie", montant: -5 },
        { pseudo: "Delta" },
        { montant: 12 },
        null,
        { pseudo: "Echo", montant: "2500" },
      ])]`),
    ).toEqual([
      ["alpha", 31000000],
      ["echo", 2500],
    ]);
    expect(lire(`OuafSuivi.demandesAvance(undefined).size`)).toBe(0);
    expect(lire(`OuafSuivi.demandesAvance({}).size`)).toBe(0);
  });
});

describe("Récapitulatif : « (+montant) » en vert après le convoi à faire", () => {
  test("convoi à faire puis l'avance demandée ; sans demande, rien ; sans convoi prévu, « — » puis l'avance", async () => {
    await ouvrir();
    expect(lire(`lectures.slice().sort()`)).toEqual(["GET /api/avances", "GET /api/mes"]);
    expect(cellule("Alpha")).toBe(`${nombre(6452503)} (+${nombre(31000000)})`);
    expect(avance("Alpha")).toBe(`(+${lire<string>(`numeral(31000000).format()`)})`);
    expect(cellule("Bravo")).toBe(nombre(1231594));
    expect(avance("Bravo")).toBeNull();
    expect(cellule("Charlie")).toBe(`— (+${nombre(1500)})`);
    // un joueur qui n'est pas suivi n'ajoute pas de ligne
    expect(lire<number>(`$("#o_convoisMembres tr[data-pseudo]").length`)).toBe(3);
  });

  test("info-bulle de l'avance ; le clic sur le convoi à faire garde son montant, pas celui de l'avance", async () => {
    await ouvrir();
    const $a = `$("#o_convoisMembres tr[data-pseudo='Alpha'] .o_convoisAvance")`;
    expect(lire<string>(`${$a}.attr("title")`)).toContain("Avance demandée par Alpha");
    expect(
      lire<number>(
        `$("#o_convoisMembres tr[data-pseudo='Alpha'] .o_convoisMembreMontant").data("montant")`,
      ),
    ).toBe(6452503);
    // l'avance n'est pas un lien
    expect(lire<number>(`${$a}.closest("a").length`)).toBe(0);
  });

  test("cellule qui peut passer à la ligne entre le montant et l'avance, sans couper un montant", async () => {
    await ouvrir();
    expect(
      lire<string>(`$("#o_convoisMembres tr[data-pseudo='Alpha'] td:eq(1)").attr("class")`),
    ).toBe("o_convoisAvecAvance");
    expect(
      lire<string>(`$("#o_convoisMembres tr[data-pseudo='Bravo'] td:eq(1)").attr("class") || ""`),
    ).toBe("");
    const css = readFileSync(join(__dirname, "..", "public", "css", "outiiil.css"), "utf8");
    expect(css).toMatch(/\.o_convoisMembres td\.o_convoisAvecAvance \{\s*white-space: normal;/);
    expect(css).toMatch(
      /\.o_convoisMembres \.o_convoisReste,\s*\.o_convoisMembres \.o_convoisAvance \{\s*white-space: nowrap;/,
    );
    expect(css).toMatch(/\.o_convoisMembres \.o_convoisAvance \{\s*color: var\(--fzzz-succes\);/);
  });

  test("colonne « Statut des stocks » : « (+avance) » en vert et en gras, à la place de « ✅ » ou de « — »", async () => {
    await ouvrir();
    // forme demandée par le mainteneur le 26/11/2026 : « (+avance) »
    expect(statut("Alpha")).toBe("(+avance)");
    expect(statut("Charlie")).toBe("(+avance)");
    expect(statut("Bravo")).toBe("✅");
    const $mot = `$("#o_convoisMembres tr[data-pseudo='Alpha'] .o_convoisAvanceStatut")`;
    expect(lire<string>(`${$mot}.attr("title")`)).toContain(
      `avance de ${lire<string>(`numeral(31000000).format()`)}`,
    );
    const css = readFileSync(join(__dirname, "..", "public", "css", "outiiil.css"), "utf8");
    expect(css).toMatch(
      /\.o_convoisMembres \.o_convoisAvanceStatut \{\s*color: var\(--fzzz-succes\);\s*font-weight: bold;/,
    );
    expect(lire<string>(`$("#o_convoisMembres thead th:eq(2)").attr("title")`)).toContain(
      "(+avance) : a demandé une avance",
    );
  });

  test("ne veut pas de convois et a demandé une avance : « ⚠️ Plein ⚠️ » puis « (+avance) »", async () => {
    const mes = {
      ...MES,
      lignes: MES.lignes.map((l) => (l.vers == "Alpha" ? { ...l, sans_reception: true } : l)),
    };
    await ouvrir(AVANCES, false, { mes });
    expect(statut("Alpha")).toBe("⚠️ Plein ⚠️ (+avance)");
    expect(
      lire<number>(`$("#o_convoisMembres tr[data-pseudo='Alpha'] .o_convoisPlein").length`),
    ).toBe(1);
  });

  test("colonne décochée dans les Préférences : pas de colonne, le « (+montant) » reste", async () => {
    await ouvrir(AVANCES, false, { colonne: false });
    expect(lire<number>(`$("#o_convoisMembres .o_convoisAvanceStatut").length`)).toBe(0);
    expect(cellule("Alpha")).toBe(`${nombre(6452503)} (+${nombre(31000000)})`);
  });

  test("demandes illisibles : le convoi à faire s'affiche quand même, sans avance, et le journal le note", async () => {
    await ouvrir("erreur");
    expect(cellule("Alpha")).toBe(nombre(6452503));
    expect(avance("Alpha")).toBeNull();
    expect(statut("Alpha")).toBe("✅");
    expect(lire<string[]>(`notes`)).toEqual(["Convois : demandes d'avance du site non lues"]);
  });

  test("demandes lues avant « Mes convois » : « … » seul tant que le convoi à faire n'est pas lu", async () => {
    await ouvrir(AVANCES, true);
    expect(cellule("Alpha")).toBe("…");
    expect(
      lire<string>(`$("#o_convoisMembres tr[data-pseudo='Alpha'] td:eq(1)").attr("class") || ""`),
    ).toBe("");
  });

  test("site sans champ « demandes » : rien d'ajouté", async () => {
    await ouvrir({ vide: false, lignes: [] });
    expect(cellule("Alpha")).toBe(nombre(6452503));
    expect(avance("Charlie")).toBeNull();
  });

  test("relues avec « Mes convois » après un convoi enregistré", async () => {
    await ouvrir();
    lire(`lectures = []; $(document).trigger(EVENEMENT_CONVOI_ENREGISTRE)`);
    for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 5));
    expect(lire(`lectures.slice().sort()`)).toEqual(["GET /api/avances", "GET /api/mes"]);
  });
});
