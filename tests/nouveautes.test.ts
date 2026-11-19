import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { creerPage } from "./harnais";

const page = creerPage(["js/class/Nouveautes.js"]);
const version = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
).version;
const depuis = (vue: string | null, actuelle: string) =>
  page.lire<string[]>(
    `Nouveautes.depuis(${JSON.stringify(vue)}, ${JSON.stringify(actuelle)}, 99).map((n) => n.version)`,
  );

describe("nouveautés affichées après une mise à jour", () => {
  test("la version de package.json a ses nouveautés", () => {
    expect(page.lire(`NOUVEAUTES[0].version`)).toBe(version);
  });
  test("versions vues depuis la dernière visite, sans les futures", () => {
    expect(depuis("1.46.0", "1.48.1")).toEqual(["1.48.1", "1.47.0"]);
    expect(depuis("1.48.1", "1.48.1")).toEqual([]);
  });
  test("première installation : la version actuelle seulement", () => {
    expect(depuis(null, "1.49.4")).toEqual(["1.49.4"]);
  });
  test("ordre : 1.10 après 1.9", () => {
    expect(page.lire(`Nouveautes.comparer("1.10.0", "1.9.9") > 0`)).toBe(true);
  });
});

/**
 * Phrases d'une note : un point, un point d'exclamation ou d'interrogation, ou
 * des points de suspension suivis d'un blanc ou de la fin ; « 1.141.0 » ou
 * « 1,5 % » n'en coupent pas.
 */
const phrases = (texte: string) => texte.split(/[.!?…]+(?=\s|$)/).filter((p) => p.trim()).length;

describe("notes courtes (règle du mainteneur, 19/11/2026 : « deux phrases uniquement »)", () => {
  test("compte des phrases", () => {
    expect(phrases("Une. Deux.")).toBe(2);
    expect(phrases("Version 1.141.0, 1,5 % de plus : une phrase")).toBe(1);
    expect(phrases("Quoi ? Oui !")).toBe(2);
  });
  test("chaque version depuis la 1.141.0 : deux phrases au plus, toutes notes comprises", () => {
    const longues = page
      .lire<{ version: string; notes: string[] }[]>(
        `NOUVEAUTES.filter((n) => Nouveautes.comparer(n.version, "1.141.0") >= 0)`,
      )
      .map((n) => ({ version: n.version, phrases: phrases(n.notes.join(" ")) }))
      .filter((n) => n.phrases > 2);
    expect(longues).toEqual([]);
  });
});
