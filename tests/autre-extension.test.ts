import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

const page = creerPage(["js/boite/Dock.js"]);

const detecte = (html: string) =>
  page.lire<string[]>(
    `(() => { document.documentElement.className = ""; document.body.innerHTML = ${JSON.stringify(html)}; return Dock.autresExtensions(); })()`,
  ).length > 0;

describe("Toolzzz ou Outiiil active en même temps", () => {
  test("notre barre seule : rien", () => {
    expect(detecte(`<div id="o_boiteExtension"><div id="o_toolbarOutiiil"></div></div>`)).toBe(
      false,
    );
    expect(detecte(`<div id="o_boiteExtension"></div>`)).toBe(false);
  });
  test("barre de Toolzzz/Outiiil hors de notre encadré, même masquée ou avant la nôtre", () => {
    expect(
      detecte(
        `<div id="o_toolbarOutiiil" style="display:none"></div><div id="o_boiteExtension"><div id="o_toolbarOutiiil"></div></div>`,
      ),
    ).toBe(true);
    expect(detecte(`<div id="o_boiteExtension"></div><div id="o_toolbarOutiiil"></div>`)).toBe(
      true,
    );
  });
});

describe("Optizzz active en même temps", () => {
  const noms = (classeHtml: string, corps: string) =>
    page.lire<string[]>(
      `(() => { document.documentElement.className = ${JSON.stringify(classeHtml)}; document.body.innerHTML = ${JSON.stringify(corps)}; return Dock.autresExtensions(); })()`,
    );
  test("classe sur <html> ou bouton dans le menu du jeu", () => {
    expect(noms("optizzz-game-look", "")).toEqual(["Optizzz"]);
    expect(noms("", `<ul id="menu"><li data-optizzz-bar-button></li></ul>`)).toEqual(["Optizzz"]);
    expect(noms("", `<ul id="menu"><li></li></ul>`)).toEqual([]);
  });
  test("les deux à la fois", () => {
    expect(noms("optizzz-game-look", `<div id="o_toolbarOutiiil"></div>`)).toEqual([
      "Toolzzz ou Outiiil",
      "Optizzz",
    ]);
  });
});
