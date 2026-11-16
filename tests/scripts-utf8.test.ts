import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fichiersManifeste } from "../scripts/userscript";

// Chrome refuse toute l'extension quand un script ou une feuille de style du
// manifeste n'est pas de l'UTF-8 valide pour lui, non-caractères Unicode compris
// (U+FFFE, U+FFFF…) : oxfmt en a écrit à la place des échappements ￾￿
// d'une expression régulière, et plus rien ne se chargeait.
const RACINE = join(import.meta.dir, "..");

function nonCaracteres(texte: string) {
  const trouves: string[] = [];
  for (const c of texte) {
    const n = c.codePointAt(0) ?? 0;
    if ((n >= 0xfdd0 && n <= 0xfdef) || (n & 0xfffe) == 0xfffe)
      trouves.push("U+" + n.toString(16).toUpperCase());
  }
  return trouves;
}

describe("fichiers du manifeste lisibles par Chrome", () => {
  const { js, css } = fichiersManifeste(readFileSync(join(RACINE, "wxt.config.ts"), "utf8"));
  const decodeur = new TextDecoder("utf-8", { fatal: true });

  test("UTF-8 valide, sans non-caractère", () => {
    expect(js.length).toBeGreaterThan(40);
    const fautifs: Record<string, string[]> = {};
    for (const f of [...js, ...css]) {
      let texte = "";
      try {
        texte = decodeur.decode(readFileSync(join(RACINE, "public", f)));
      } catch (e) {
        fautifs[f] = ["UTF-8 invalide"];
        continue;
      }
      const trouves = nonCaracteres(texte);
      if (trouves.length) fautifs[f] = trouves;
    }
    expect(fautifs).toEqual({});
  });

  test("le contrôle reconnaît les non-caractères", () => {
    expect(nonCaracteres("a" + String.fromCodePoint(0xfffe, 0xfdd0, 0x1ffff) + "é«")).toEqual([
      "U+FFFE",
      "U+FDD0",
      "U+1FFFF",
    ]);
  });
});
