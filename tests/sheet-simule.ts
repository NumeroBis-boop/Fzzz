import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

/**
 * Google Sheet simulé en mémoire, piloté par le vrai script du fichier
 * (google-sheet/export-rapports.gs) : SpreadsheetApp, LockService,
 * ContentService, Utilities et Charts réduits à ce que le script utilise. Les
 * formules, formats, validations et graphiques sont notés, pas calculés.
 */
const CODE = readFileSync(
  join(import.meta.dir, "..", "google-sheet", "export-rapports.gs"),
  "utf8",
);

type Grille = unknown[][];

/**
 * Onglet simulé. Comme Google Sheets : grille de `lignesMax` × 26 au départ,
 * écriture hors de la grille refusée, suppression de toutes les lignes non
 * figées refusée.
 */
export function feuille(nom: string, grille: Grille = [], lignesMax = 1000) {
  let colonnesMax = 26,
    figees = 0;
  const f: any = {
    nom,
    grille,
    getMaxRows: () => lignesMax,
    getMaxColumns: () => colonnesMax,
    insertRowsAfter: (r: number, n: number) => {
      lignesMax += n;
    },
    insertColumnsAfter: (c: number, n: number) => {
      colonnesMax += n;
    },
    // mise en forme demandée par le script : hauteur forcée et alignement par ligne
    hauteurs: {} as Record<number, number>,
    alignements: {} as Record<number, string>,
    // onglet « Statistiques » : formules et formats par case « ligne,colonne »
    formules: {} as Record<string, string>,
    formats: {} as Record<string, string>,
    validations: [] as { r: number; c: number; nl: number; nc: number; regle: any }[],
    graphiques: [] as any[],
    largeurs: {} as Record<number, number>,
    cachees: [] as number[],
    setColumnWidth: (c: number, l: number) => {
      f.largeurs[c] = l;
    },
    hideColumns: (c: number) => {
      f.cachees.push(c);
    },
    lignesCachees: [] as number[],
    hideRows: (r: number) => {
      f.lignesCachees.push(r);
    },
    newChart: () => {
      const g: any = { plages: [], options: {} },
        b: any = {
          setChartType: (t: string) => ((g.type = t), b),
          addRange: (p: any) => (g.plages.push(p.adresse), b),
          setNumHeaders: (n: number) => ((g.titres = n), b),
          setPosition: (r: number, c: number) => ((g.position = [r, c]), b),
          setOption: (k: string, v: unknown) => ((g.options[k] = v), b),
          build: () => g,
        };
      return b;
    },
    insertChart: (g: any) => {
      f.graphiques.push(g);
    },
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
    setFrozenRows: (n: number) => {
      figees = n;
    },
    deleteRows: (r: number, n: number) => {
      if (lignesMax - n <= figees)
        throw new Error("Sorry, it is not possible to delete all non-frozen rows.");
      grille.splice(r - 1, n);
      lignesMax -= n;
    },
    setRowHeightsForced: (r: number, n: number, h: number) => {
      for (let i = 0; i < n; i++) f.hauteurs[r + i] = h;
    },
    getRange: (r: number, c: number, nl = 1, nc = 1) => {
      if (r + nl - 1 > lignesMax || c + nc - 1 > colonnesMax)
        throw new Error("The coordinates of the range are outside the dimensions of the sheet.");
      const plage: any = {
        adresse: { r, c, nl, nc },
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
        setFormula: (x: string) => ((f.formules[`${r},${c}`] = x), plage),
        setNumberFormat: (x: string) => ((f.formats[`${r},${c}`] = x), plage),
        setDataValidation: (regle: any) => (f.validations.push({ r, c, nl, nc, regle }), plage),
        setVerticalAlignment: (a: string) => {
          for (let i = 0; i < nl; i++) f.alignements[r + i] = a;
          return plage;
        },
      };
      return plage;
    },
  };
  return f;
}

/** Fichier simulé : onglets {nom: feuille}, doGet / doPost du script. */
export function classeurSimule(onglets: Record<string, any> = {}, fuseau = "Europe/Paris") {
  // ordre des onglets : insertSheet(nom, 0) le met en premier
  const ordre = Object.keys(onglets);
  const classeur = {
    getName: () => "Extension OUAF",
    getSpreadsheetTimeZone: () => fuseau,
    getSheetByName: (n: string) => onglets[n] || null,
    insertSheet: (n: string, position?: number) => {
      ordre.splice(position ?? ordre.length, 0, n);
      return (onglets[n] = feuille(n));
    },
  };
  const avertissements: string[] = [];
  const regle = (): any => {
    const v: any = { regle: {} },
      b: any = {
        requireDate: () => ((v.regle.date = true), b),
        requireValueInRange: (p: any, liste: boolean) => (
          (v.regle.plage = p.adresse),
          (v.regle.liste = liste),
          b
        ),
        setAllowInvalid: (x: boolean) => ((v.regle.invalideAcceptee = x), b),
        build: () => v.regle,
      };
    return b;
  };
  const ctx: any = {
    console: { warn: (m: string) => avertissements.push(m) },
    SpreadsheetApp: { getActiveSpreadsheet: () => classeur, newDataValidation: regle },
    // formats utilisés par le script : jour ou minute d'une date dans le fuseau du fichier
    Utilities: {
      formatDate: (d: Date, tz: string, format: string) => {
        if (format != "yyyy-MM-dd" && format != "yyyy-MM-dd HH:mm")
          throw new Error("format non simulé : " + format);
        const p = Object.fromEntries(
          new Intl.DateTimeFormat("en-CA", {
            timeZone: tz,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
          })
            .formatToParts(d)
            .map((x) => [x.type, x.value]),
        );
        const jour = `${p.year}-${p.month}-${p.day}`;
        return format == "yyyy-MM-dd" ? jour : `${jour} ${p.hour}:${p.minute}`;
      },
    },
    Charts: {
      ChartType: {
        AREA: "AREA",
        COLUMN: "COLUMN",
        COMBO: "COMBO",
        LINE: "LINE",
        SCATTER: "SCATTER",
      },
    },
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
    ordre,
    /** Fonctions du script, pour les appeler directement (STATS_OUAF, statistiques…). */
    script: ctx,
    /** Messages du journal d'Apps Script (console.warn). */
    avertissements,
    doGet: () => ctx.doGet(),
    doPost: (corps: object) => ctx.doPost({ postData: { contents: JSON.stringify(corps) } }),
    /** Corps tel quel (requête illisible). */
    doPostBrut: (contenu: string) => ctx.doPost({ postData: { contents: contenu } }),
    /** Clés (colonne A) d'un onglet, titres exclus. */
    cles: (nom: string): string[] =>
      onglets[nom] ? onglets[nom].grille.slice(1).map((l: unknown[]) => String(l[0])) : [],
  };
}
