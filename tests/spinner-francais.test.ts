import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Extension du spinner jQuery UI (Utils.js) : affichage et relecture à la
 * française quelle que soit la langue du navigateur, autant de décimales que le
 * nombre en a, virgule ou point acceptés à la saisie, numberFormat explicite
 * respecté.
 */
const page = creerPage([
  "js/lib/jquery-ui_1.12.1.js",
  "js/lib/globalize_0.1.1.js",
  "js/lib/globalize-locale-fr.js",
  "js/class/Utils.js",
]);
const lire = <T = any>(e: string) => page.lire<T>(e);

function champ(options: string, langue = "fr-FR") {
  lire(`
    Number.prototype.toLocaleString = function () { return new Intl.NumberFormat(${JSON.stringify(langue)}).format(this); };
    document.body.innerHTML = "<input id='s'/>";
    $("#s").spinner(${options});`);
}
const affiche = (v: number | string) =>
  lire<string>(`$("#s").spinner("value", ${JSON.stringify(v)}); $("#s").val()`);
const relit = (texte: string) =>
  lire<number | null>(`$("#s").val(${JSON.stringify(texte)}); $("#s").spinner("value")`);

describe("spinner à la française", () => {
  for (const langue of ["fr-FR", "de-DE", "de-CH", "en-US"]) {
    test(`${langue} : entiers avec espace des milliers, décimaux à la virgule, sans zéro inutile`, () => {
      champ("{ min: 0, step: 0.1 }", langue);
      expect(affiche(9)).toBe("9");
      expect(affiche(9.1)).toBe("9,1");
      expect(affiche(1804000)).toBe("1 804 000");
      lire(`$("#s").spinner("value", 1804000); $("#s").spinner("stepUp")`);
      expect(lire(`$("#s").spinner("value")`)).toBeCloseTo(1804000.1, 5);
    });
  }

  test("relecture : virgule, point, espace des milliers, saisie en cours, vide", () => {
    champ("{ min: 0, step: 0.1 }");
    expect(relit("9,1")).toBe(9.1);
    expect(relit("9.1")).toBe(9.1);
    expect(relit("1 804 000")).toBe(1804000);
    expect(relit("7,")).toBe(7);
    expect(relit("7.")).toBe(7);
    expect(relit("")).toBeNull();
    expect(relit("abc")).toBeNull();
  });

  test("numberFormat explicite respecté : « d2 » affiche les niveaux sur deux chiffres", () => {
    champ('{ min: 0, max: 50, numberFormat: "d2" }');
    expect(affiche(7)).toBe("07");
    expect(relit("07")).toBe(7);
  });
});
