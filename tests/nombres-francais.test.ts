import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { creerPage } from "./harnais";

/**
 * Nombres écrits à la française (« 1 234,5 », « 12,5 % ») : toFixed(),
 * String() et toLocaleString() sans langue donnent « 1234.5 » ou suivent la
 * langue du navigateur.
 */
const page = creerPage(["js/class/Utils.js"]);
// étable 11 : 15,5 ressources par ouvrière
const convois = creerPage(
  ["js/class/Utils.js", "js/page/Commerce.js"],
  "var monProfil = { niveauConstruction: { 11: 11 } };",
);
const JS = join(import.meta.dir, "..", "public", "js");

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return nom == "lib" ? [] : fichiers(chemin);
    return nom.endsWith(".js") ? [chemin] : [];
  });
}
// commentaires retirés (les « // » d'une adresse http:// restent)
const code = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.replace(/(^|[^:"'])\/\/.*$/, "$1"));

describe("nombres à la française", () => {
  test("Utils.decimal : virgule décimale, espace des milliers, décimales facultatives", () => {
    const d = (expression: string) =>
      page.lire<string>(`Utils.decimal(${expression})`).replace(/\s/g, " ");
    expect(d("1234.5, 1")).toBe("1 234,5");
    expect(d("7.2, 1")).toBe("7,2");
    expect(d("0.5, 2")).toBe("0,50");
    expect(d("12, 1, true")).toBe("12");
    expect(d("12.46, 1, true")).toBe("12,5");
    expect(d("1804000")).toBe("1 804 000");
  });

  test("page Convois : charge d'une ouvrière à la virgule", () => {
    convois.lire(`(() => {
      document.body.innerHTML = "<form><table></table></form>";
      Utils.affichage = (cle) => cle == "convoisInfoEtable";
      Utils.garderPosition = () => {};
      PageCommerce.prototype.plus = () => {};
      window.CommerceFzzz = { suiviOuaf() {}, membresSuivis() {} };
      new PageCommerce({}).executer();
    })()`);
    expect(convois.lire<string>(`$("form table").text()`)).toContain(
      "1 ouvrière peut transporter : 15,5 ressources",
    );
  });

  test("aucun nombre écrit par toFixed(), toLocaleString() ou Intl sans langue", () => {
    const fautifs = fichiers(JS).flatMap((f) =>
      code(readFileSync(f, "utf8")).flatMap((ligne, i) =>
        // toFixed seulement pour arrondir un nombre gardé en nombre : Number(x.toFixed(n))
        (/\.toFixed\(/.test(ligne) && !/Number\([^;]*\.toFixed\(/.test(ligne)) ||
        /\.toLocaleString\(\s*\)|Intl\.NumberFormat\(\s*\)/.test(ligne)
          ? [`${relative(JS, f)}:${i + 1}`]
          : [],
      ),
    );
    expect(fautifs).toEqual([]);
  });
});
