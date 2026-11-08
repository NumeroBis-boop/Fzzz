import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

/**
 * Google Sheet simulé en mémoire, piloté par le vrai script du fichier
 * (google-sheet/export-rapports.gs) : SpreadsheetApp, LockService et
 * ContentService réduits à ce que le script utilise.
 */
const CODE = readFileSync(
  join(import.meta.dir, "..", "google-sheet", "export-rapports.gs"),
  "utf8",
);

type Grille = unknown[][];

export function feuille(nom: string, grille: Grille = []) {
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

/** Fichier simulé : onglets {nom: feuille}, doGet / doPost du script. */
export function classeurSimule(onglets: Record<string, any> = {}) {
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
  return {
    onglets,
    doGet: () => ctx.doGet(),
    doPost: (corps: object) => ctx.doPost({ postData: { contents: JSON.stringify(corps) } }),
    /** Corps tel quel (requête illisible). */
    doPostBrut: (contenu: string) => ctx.doPost({ postData: { contents: contenu } }),
    /** Clés (colonne A) d'un onglet, titres exclus. */
    cles: (nom: string): string[] =>
      onglets[nom] ? onglets[nom].grille.slice(1).map((l: unknown[]) => String(l[0])) : [],
  };
}
