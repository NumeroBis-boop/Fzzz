import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { creerPage } from "./harnais";

/**
 * Portée d'une attaque : TdC de la cible de la moitié au triple de celui du
 * lanceur, les deux compris (choix du mainteneur du 19/11/2026 : la moitié
 * vérifiée sur un RC le 05/11, le triple comme la page « Flood TdC » du
 * Compte+). Une seule définition, Utils.aPortee / bornesPortee.
 */
const page = creerPage(["js/class/Utils.js"]);

describe("bornes de la portée", () => {
  test("moitié et triple compris, juste au-delà hors de portée", () => {
    const cas: [number, number, boolean][] = [
      [50000, 100000, true],
      [49999, 100000, false],
      [300000, 100000, true],
      [300001, 100000, false],
      // relevé du 05/11 : 54 865 face à 109 730, conquis
      [54865, 109730, true],
      // TdC impair : la moitié 9 547,5 n'est pas un TdC
      [9548, 19095, true],
      [9547, 19095, false],
      [57285, 19095, true],
      [57286, 19095, false],
    ];
    expect(cas.map(([c, l]) => page.lire<boolean>(`Utils.aPortee(${c}, ${l})`))).toEqual(
      cas.map(([, , r]) => r),
    );
    expect(page.lire(`Utils.bornesPortee(19095)`)).toEqual({ min: 9547.5, max: 57285 });
  });
});

describe("une seule définition de la portée", () => {
  const RACINE = join(import.meta.dir, "..", "public", "js");
  const fichiers = (dossier: string): string[] =>
    readdirSync(join(RACINE, dossier), { withFileTypes: true }).flatMap((e) =>
      e.isDirectory()
        ? e.name == "lib"
          ? []
          : fichiers(join(dossier, e.name))
        : e.name.endsWith(".js")
          ? [join(dossier, e.name)]
          : [],
    );
  // ce qu'une borne réécrite à la main ressemble : triple − 1, « > 3 * », « 0.5 * », TdC × 3
  const MOTIFS = [
    /\*\s*3\s*-\s*1\b/,
    /[<>]=?\s*(?:3|0\.5)\s*\*/,
    /\b(?:tdc\w*|terrain\w*|t0|ti)\s*\*\s*(?:3|0\.5)\b/i,
    /\b(?:3|0\.5)\s*\*\s*(?:tdc\w*|terrain\w*|t0|ti)\b/i,
    /SEUIL_TROP_(?:HAUT|BAS)/,
  ];

  test("aucune borne de portée écrite ailleurs que dans Utils.js", () => {
    const trouves = fichiers(".")
      .filter((f) => !f.endsWith("Utils.js"))
      .flatMap((f) =>
        readFileSync(join(RACINE, f), "utf8")
          .split("\n")
          .flatMap((ligne, i) =>
            MOTIFS.some((m) => m.test(ligne)) ? [`${f}:${i + 1} ${ligne.trim()}`] : [],
          ),
      );
    expect(trouves).toEqual([]);
  });

  test("les motifs reconnaissent les anciennes écritures de la règle", () => {
    for (const ancienne of [
      "return tdcCible >= tdcLanceur / 2 && tdcCible <= tdcLanceur * 3 - 1;",
      'if (ti > 3 * t0) return { ...r, hors: "haut" };',
      'if (ti < 0.5 * t0) return { ...r, hors: "bas" };',
      "if (cible.terrain > mfTerrain * SEUIL_TROP_HAUT) {",
      "if (tdcCible >= tdcAtt * 0.5 && tdcCible <= tdcAtt * 3) {",
    ])
      expect(MOTIFS.some((m) => m.test(ancienne))).toBe(true);
  });
});
