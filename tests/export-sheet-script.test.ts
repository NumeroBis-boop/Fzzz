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

  test("onglets acceptés : chasses, attaques, défenses", () => {
    const ctx = charger();
    for (const onglet of ["BDD chasse", "BDD attaques", "BDD défenses"])
      expect(
        poster(ctx, { onglet, entetes: ENTETES, lignes: [["k1", "Alpha", "d", 1, "a"]] }),
      ).toEqual({
        ajoutees: 1,
        deja: 0,
      });
    expect(Object.keys(onglets)).toEqual(["BDD chasse", "BDD attaques", "BDD défenses"]);
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
