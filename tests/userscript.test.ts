import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { entete, fichiersManifeste } from "../scripts/userscript";

const RACINE = join(import.meta.dir, "..");
const config = readFileSync(join(RACINE, "wxt.config.ts"), "utf8");

describe("en-tête du script utilisateur", () => {
  const { js, css } = fichiersManifeste(config);

  test("reprend tous les scripts du manifeste, dans l'ordre", () => {
    expect(js[0]).toBe("js/bootstrap.js");
    expect(js.at(-1)).toBe("js/content.js");
    expect(js.indexOf("js/lib/jquery_3.2.1.js")).toBeLessThan(js.indexOf("js/class/Utils.js"));
    expect(js.indexOf("js/class/Utils.js")).toBeLessThan(js.indexOf("js/class/OuafSuivi.js"));
    expect(js).toContain("js/lib/highcharts_6.0.7.js");
    expect(js).toContain("js/lib/calystene-chs2_2.00.35.03.js");
    expect(css).toEqual(["css/outiiil.css", "css/toasts.css", "css/datatables.css"]);
    for (const f of [...js, ...css]) expect(existsSync(join(RACINE, "public", f))).toBe(true);
  });

  test("charge la couche GM avant tout le reste, à un commit fixe", () => {
    const requires = entete("abc123", "9.9.9", config)
      .split("\n")
      .filter((l) => l.startsWith("// @require"))
      .map((l) => l.split(/\s+/).at(-1));
    expect(requires[0]).toBe(
      "https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@abc123/userscript/shim.js",
    );
    expect(requires).toHaveLength(js.length + 1);
    expect(requires.every((u) => u!.includes("@abc123/"))).toBe(true);
  });
});

describe("couche GM (userscript/shim.js)", () => {
  function charger() {
    const valeurs = new Map<string, unknown>();
    const contexte = vm.createContext({
      location: { hostname: "s5.fourmizzz.fr" },
      GM_info: {
        script: {
          version: "9.9.9",
          resources: [
            { name: "fzzzBase", url: "https://cdn.test/gh/x@abc/public/ouaf-autorisation.html" },
          ],
        },
      },
      GM_getValue: (c: string) => valeurs.get(c),
      GM_setValue: (c: string, v: unknown) => valeurs.set(c, v),
      GM_deleteValue: (c: string) => valeurs.delete(c),
      GM_listValues: () => [...valeurs.keys()],
    });
    vm.runInContext(readFileSync(join(RACINE, "userscript/shim.js"), "utf8"), contexte);
    return vm.runInContext("chrome", contexte);
  }

  test("adresses des fichiers statiques à la version installée", () => {
    const chrome = charger();
    expect(chrome.runtime.getURL("images/copy.png")).toBe(
      "https://cdn.test/gh/x@abc/public/images/copy.png",
    );
    expect(chrome.runtime.getManifest().version).toBe("9.9.9");
  });

  test("stockage et écouteurs de changement", async () => {
    const chrome = charger();
    const vus: unknown[] = [];
    chrome.storage.onChanged.addListener((ch: any, zone: string) =>
      vus.push([zone, ch.a.newValue]),
    );
    await chrome.storage.local.set({ a: [1, 2] });
    expect(await chrome.storage.local.get("a")).toEqual({ a: [1, 2] });
    expect(vus).toEqual([["local", [1, 2]]]);
    await chrome.storage.local.remove("a");
    expect(await chrome.storage.local.get("a")).toEqual({});
  });

  test("messages : mise à jour gérée par le gestionnaire, API OUAF seulement", async () => {
    const chrome = charger();
    expect(await chrome.runtime.sendMessage({ type: "fzzz_majVerifier" })).toEqual({
      statut: "userscript",
    });
    expect(
      await chrome.runtime.sendMessage({
        type: "fzzz_ouaf",
        methode: "DELETE",
        chemin: "/api/mes",
      }),
    ).toEqual({ erreur: "requete" });
    expect(
      await chrome.runtime.sendMessage({ type: "fzzz_ouaf", methode: "GET", chemin: "/admin" }),
    ).toEqual({ erreur: "requete" });
  });
});
