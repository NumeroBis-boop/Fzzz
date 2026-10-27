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
