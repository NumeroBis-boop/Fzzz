import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

const page = creerPage(["js/class/Utils.js", "js/page/PartageChasses.js"]);

describe("Utils.echapper", () => {
  test("neutralise les caractères de balisage", () => {
    expect(page.lire(`Utils.echapper("<img src=x onerror='a()'>&\\"")`)).toBe(
      "&lt;img src=x onerror=&#39;a()&#39;&gt;&amp;&quot;",
    );
  });
  test("texte ordinaire, null et nombres", () => {
    expect(page.lire(`Utils.echapper("DoggyBag")`)).toBe("DoggyBag");
    expect(page.lire(`Utils.echapper(null)`)).toBe("");
    expect(page.lire(`Utils.echapper(42)`)).toBe("42");
  });
});

describe("PartageChasses.nettoyer", () => {
  test("retire le balisage d'un pseudo lu dans le forum", () => {
    expect(page.lire(`PartageChasses.nettoyer(" Bob<img src=x onerror=\\"a()\\"> ")`)).toBe(
      "Bobimg src=x onerror=a()",
    );
  });
  test("laisse un pseudo normal intact", () => {
    expect(page.lire(`PartageChasses.nettoyer("  Sacapuces ")`)).toBe("Sacapuces");
  });
});

describe("Utils.lireStockage", () => {
  test("valeur absente ou abîmée : valeur par défaut", () => {
    page.lire(`localStorage.setItem("t_abime", "{pas du json")`);
    expect(page.lire(`JSON.stringify(Utils.lireStockage("t_abime"))`)).toBe("{}");
    expect(page.lire(`JSON.stringify(Utils.lireStockage("t_absent", []))`)).toBe("[]");
  });
  test("valeur lisible", () => {
    page.lire(`localStorage.setItem("t_ok", JSON.stringify({ a: 1 }))`);
    expect(page.lire(`Utils.lireStockage("t_ok").a`)).toBe(1);
  });
});
