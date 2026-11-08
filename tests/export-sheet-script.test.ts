import { beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

/**
 * Script Apps Script du Google Sheet (google-sheet/export-rapports.gs), exécuté
 * contre un classeur simulé en mémoire : création de l'onglet, ajout sans
 * doublon, colonnes retrouvées par leur titre, texte jamais pris pour une formule.
 */
const CODE = readFileSync(
  join(import.meta.dir, "..", "google-sheet", "export-rapports.gs"),
  "utf8",
);

type Grille = unknown[][];

function feuille(nom: string, grille: Grille = []) {
  const f: any = {
    nom,
    grille,
    getLastRow: () => {
      for (let r = grille.length; r > 0; r--)
        if (grille[r - 1]!.some((v) => v !== "" && v != null)) return r;
      return 0;
    },
    getLastColumn: () =>
      Math.max(
        0,
        ...grille.map((l) => {
          for (let c = l.length; c > 0; c--) if (l[c - 1] !== "" && l[c - 1] != null) return c;
          return 0;
        }),
      ),
    setFrozenRows: () => {},
    getRange: (r: number, c: number, nl = 1, nc = 1) => {
      const plage: any = {
        getValues: () =>
          Array.from({ length: nl }, (_, i) =>
            Array.from({ length: nc }, (_, j) => grille[r - 1 + i]?.[c - 1 + j] ?? ""),
          ),
        setValues: (v: Grille) => {
          v.forEach((l, i) =>
            l.forEach((x, j) => {
              while (grille.length < r + i) grille.push([]);
              grille[r - 1 + i]![c - 1 + j] = x;
            }),
          );
          return plage;
        },
        setValue: (x: unknown) => plage.setValues([[x]]),
        setFontWeight: () => plage,
      };
      return plage;
    },
  };
  return f;
}

let onglets: Record<string, any>;
function charger() {
  const classeur = {
    getName: () => "Extension OUAF",
    getSheetByName: (n: string) => onglets[n] || null,
    insertSheet: (n: string) => (onglets[n] = feuille(n)),
  };
  const ctx: any = {
    SpreadsheetApp: { getActiveSpreadsheet: () => classeur },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (t: string) => ({ setMimeType: () => JSON.parse(t) }),
    },
  };
  vm.createContext(ctx);
  vm.runInContext(CODE, ctx);
  return ctx;
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
    onglets["BDD RC"] = feuille("BDD RC", [["Note", "Date", "Clé", "Exporté par"]]);
    const ctx = charger();
    poster(ctx, {
      onglet: "BDD RC",
      entetes: ["Clé", "Exporté par", "Date", "Type"],
      lignes: [["k1", "Alpha", "2026-11-07 21:07", "Combat"]],
    });
    expect(onglets["BDD RC"].grille).toEqual([
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

  test("requêtes refusées : autre onglet, sans clé, illisible", () => {
    const ctx = charger();
    expect(poster(ctx, { onglet: "Feuille 1", entetes: ENTETES, lignes: [] })).toEqual({
      erreur: "requête invalide",
    });
    expect(poster(ctx, { onglet: "BDD chasse", entetes: ["Date", "Clé"], lignes: [] }).erreur).toBe(
      "requête invalide",
    );
    expect(ctx.doPost({ postData: { contents: "pas du JSON" } })).toEqual({
      erreur: "requête illisible",
    });
    expect(Object.keys(onglets)).toEqual([]);
  });
});
