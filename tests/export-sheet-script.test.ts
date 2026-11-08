import { beforeEach, describe, expect, test } from "bun:test";
import { classeurSimule, feuille } from "./sheet-simule";

let onglets: Record<string, any>;
function charger() {
  const c = classeurSimule(onglets);
  return { doGet: c.doGet, doPost: (e: any) => c.doPost(JSON.parse(e.postData.contents)) };
}
const ENTETES = ["Clé", "Exporté par", "Date", "Terrain conquis (cm²)", "RC"];
const poster = (ctx: any, corps: object) =>
  ctx.doPost({ postData: { contents: JSON.stringify(corps) } });

beforeEach(() => {
  onglets = {};
});

describe("script du Google Sheet", () => {
  test("doGet : script joignable et nom du fichier", () => {
    expect(charger().doGet()).toEqual({ ok: true, fichier: "Extension OUAF" });
  });

  test("premier export : onglet créé avec ses titres, lignes ajoutées", () => {
    const ctx = charger();
    expect(
      poster(ctx, {
        onglet: "BDD chasse",
        entetes: ENTETES,
        lignes: [
          ["k1", "Alpha", "2026-11-07 21:07", 7000, "RC 1"],
          ["k2", "Alpha", "2026-11-07 21:07", 7000, "RC 2"],
        ],
      }),
    ).toEqual({ ajoutees: 2, deja: 0 });
    expect(onglets["BDD chasse"].grille).toEqual([
      ENTETES,
      ["k1", "Alpha", "2026-11-07 21:07", 7000, "RC 1"],
      ["k2", "Alpha", "2026-11-07 21:07", 7000, "RC 2"],
    ]);
  });

  test("clé déjà présente : pas ajoutée, même en double dans un même envoi", () => {
    const ctx = charger();
    poster(ctx, { onglet: "BDD chasse", entetes: ENTETES, lignes: [["k1", "Alpha", "d", 1, "a"]] });
    expect(
      poster(ctx, {
        onglet: "BDD chasse",
        entetes: ENTETES,
        lignes: [
          ["k1", "Bravo", "d", 1, "a"],
          ["k3", "Bravo", "d", 2, "b"],
          ["k3", "Bravo", "d", 2, "b"],
        ],
      }),
    ).toEqual({ ajoutees: 1, deja: 2 });
    expect(onglets["BDD chasse"].grille.map((l: unknown[]) => l[0])).toEqual(["Clé", "k1", "k3"]);
  });

  test("colonnes déplacées ou ajoutées à la main : valeurs sous le bon titre", () => {
    onglets["BDD attaques"] = feuille("BDD attaques", [["Note", "Date", "Clé", "Exporté par"]]);
    const ctx = charger();
    poster(ctx, {
      onglet: "BDD attaques",
      entetes: ["Clé", "Exporté par", "Date", "Type"],
      lignes: [["k1", "Alpha", "2026-11-07 21:07", "Combat"]],
    });
    expect(onglets["BDD attaques"].grille).toEqual([
      ["Note", "Date", "Clé", "Exporté par", "Type"],
      ["", "2026-11-07 21:07", "k1", "Alpha", "Combat"],
    ]);
  });

  test("texte qui commence par = + - @ : gardé comme texte", () => {
    const ctx = charger();
    poster(ctx, {
      onglet: "BDD chasse",
      entetes: ENTETES,
      lignes: [["k1", "=HYPERLINK(1)", "d", 1, "+ 300 dégâts"]],
    });
    expect(onglets["BDD chasse"].grille[1]).toEqual([
      "k1",
      "'=HYPERLINK(1)",
      "d",
      1,
      "'+ 300 dégâts",
    ]);
  });

  test("onglets acceptés : chasses, attaques, défenses, floods internes", () => {
    const ctx = charger();
    for (const onglet of ["BDD chasse", "BDD attaques", "BDD défenses", "Flood internes"])
      expect(
        poster(ctx, { onglet, entetes: ENTETES, lignes: [["k1", "Alpha", "d", 1, "a"]] }),
      ).toEqual({
        ajoutees: 1,
        deja: 0,
      });
    expect(Object.keys(onglets)).toEqual([
      "BDD chasse",
      "BDD attaques",
      "BDD défenses",
      "Flood internes",
    ]);
    expect(poster(ctx, { onglet: "BDD RC", entetes: ENTETES, lignes: [] }).erreur).toBe(
      "requête invalide",
    );
  });

  test("requêtes refusées : autre onglet, sans clé, illisible", () => {
    const ctx = charger();
    expect(poster(ctx, { onglet: "Feuille 1", entetes: ENTETES, lignes: [] })).toEqual({
      erreur: "requête invalide",
    });
    expect(poster(ctx, { onglet: "BDD chasse", entetes: ["Date", "Clé"], lignes: [] }).erreur).toBe(
      "requête invalide",
    );
    expect(classeurSimule(onglets).doPostBrut("pas du JSON")).toEqual({
      erreur: "requête illisible",
    });
    expect(Object.keys(onglets)).toEqual([]);
  });
});

describe("floods internes : une seule ligne, jamais dans les onglets des camps", () => {
  const COMBAT = ["Clé", "Exporté par", "Date", "Type"];
  const cles = (nom: string) => onglets[nom].grille.slice(1).map((l: unknown[]) => l[0]);

  test("arrivé dans « Flood internes » : retiré de « BDD attaques » et « BDD défenses »", () => {
    onglets["BDD attaques"] = feuille("BDD attaques", [
      COMBAT,
      ["a", "Alpha", "d", "Combat"],
      ["k1", "Alpha", "d", "Combat"],
      ["k2", "Alpha", "d", "Prise"],
      ["b", "Alpha", "d", "Combat"],
      ["k3", "Alpha", "d", "Combat"],
    ]);
    onglets["BDD défenses"] = feuille("BDD défenses", [COMBAT, ["k1", "Bravo", "d", "Combat"]]);
    const ctx = charger();
    expect(
      poster(ctx, {
        onglet: "Flood internes",
        entetes: COMBAT,
        lignes: [
          ["k1", "Alpha", "d", "Combat"],
          ["k2", "Alpha", "d", "Prise"],
          ["k3", "Alpha", "d", "Combat"],
        ],
      }),
    ).toEqual({ ajoutees: 3, deja: 0 });
    expect(cles("BDD attaques")).toEqual(["a", "b"]);
    expect(cles("BDD défenses")).toEqual([]);
    expect(cles("Flood internes")).toEqual(["k1", "k2", "k3"]);
  });

  test("le même flood exporté par l'autre camp : déjà présent ; vers un onglet de camp : refusé", () => {
    const ctx = charger();
    poster(ctx, {
      onglet: "Flood internes",
      entetes: COMBAT,
      lignes: [["k1", "Alpha", "d", "Combat"]],
    });
    expect(
      poster(ctx, {
        onglet: "Flood internes",
        entetes: COMBAT,
        lignes: [["k1", "Bravo", "d", "Combat"]],
      }),
    ).toEqual({ ajoutees: 0, deja: 1 });
    expect(
      poster(ctx, {
        onglet: "BDD défenses",
        entetes: COMBAT,
        lignes: [
          ["k1", "Bravo", "d", "Combat"],
          ["k9", "Bravo", "d", "Combat"],
        ],
      }),
    ).toEqual({ ajoutees: 1, deja: 1 });
    expect(cles("Flood internes")).toEqual(["k1"]);
    expect(cles("BDD défenses")).toEqual(["k9"]);
  });

  test("ligne sans clé : rien n'est retiré des autres onglets", () => {
    onglets["BDD attaques"] = feuille("BDD attaques", [
      COMBAT,
      ["", "note à la main", "", ""],
      ["a", "Alpha", "d", "Combat"],
    ]);
    const ctx = charger();
    poster(ctx, {
      onglet: "Flood internes",
      entetes: COMBAT,
      lignes: [["", "Alpha", "d", "Combat"]],
    });
    expect(onglets["BDD attaques"].grille).toHaveLength(3);
  });
});

describe("grille de l'onglet", () => {
  test("onglet plein (grille de 1 000 lignes atteinte) : agrandi, lignes ajoutées", () => {
    onglets["BDD chasse"] = feuille("BDD chasse", [ENTETES, ["k0", "Alpha", "d", 1, "a"]], 2);
    const ctx = charger();
    expect(
      poster(ctx, {
        onglet: "BDD chasse",
        entetes: [...ENTETES, "Nouvelle colonne"],
        lignes: [
          ["k1", "Alpha", "d", 1, "a", "x"],
          ["k2", "Alpha", "d", 1, "b", "y"],
        ],
      }),
    ).toEqual({ ajoutees: 2, deja: 0 });
    expect(onglets["BDD chasse"].grille.map((l: unknown[]) => l[0])).toEqual([
      "Clé",
      "k0",
      "k1",
      "k2",
    ]);
  });

  test("toutes les lignes d'un onglet de camp retirées, grille juste à la taille : sans erreur", () => {
    const COMBAT = ["Clé", "Exporté par"];
    onglets["BDD attaques"] = feuille(
      "BDD attaques",
      [COMBAT, ["k1", "Alpha"], ["k2", "Alpha"]],
      3,
    );
    onglets["BDD attaques"].setFrozenRows(1);
    const ctx = charger();
    expect(
      poster(ctx, {
        onglet: "Flood internes",
        entetes: COMBAT,
        lignes: [
          ["k1", "Alpha"],
          ["k2", "Alpha"],
        ],
      }),
    ).toEqual({ ajoutees: 2, deja: 0 });
    expect(onglets["BDD attaques"].grille).toEqual([COMBAT]);
  });
});

describe("lignes compactes", () => {
  test("toutes les lignes de l'onglet : hauteur d'une ligne, texte en haut ; titres intacts", () => {
    onglets["BDD chasse"] = feuille("BDD chasse", [
      ENTETES,
      ["k0", "Alpha", "d", 1, "RC\nsur\nplusieurs lignes"],
    ]);
    const ctx = charger();
    poster(ctx, {
      onglet: "BDD chasse",
      entetes: ENTETES,
      lignes: [["k1", "Alpha", "d", 1, "RC\n2"]],
    });
    const f = onglets["BDD chasse"];
    expect(f.hauteurs).toEqual({ 2: 21, 3: 21 });
    expect(f.alignements).toEqual({ 2: "top", 3: "top" });
  });

  test("mise en forme impossible : les lignes sont ajoutées quand même", () => {
    onglets["BDD chasse"] = feuille("BDD chasse", [ENTETES]);
    delete onglets["BDD chasse"].setRowHeightsForced;
    const ctx = charger();
    expect(
      poster(ctx, {
        onglet: "BDD chasse",
        entetes: ENTETES,
        lignes: [["k1", "Alpha", "d", 1, "a"]],
      }),
    ).toEqual({ ajoutees: 1, deja: 0 });
  });
});
