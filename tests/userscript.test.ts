import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { entete, fichiersManifeste, globales, scriptsDePages } from "../scripts/userscript";

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

  test("ne s'exécute que sur le serveur s5", () => {
    const matches = entete("abc123", "9.9.9", config)
      .split("\n")
      .filter((l) => /^\/\/ @(match|include)/.test(l))
      .map((l) => l.split(/\s+/).at(-1));
    expect(matches).toEqual(["*://s5.fourmizzz.fr/*"]);
  });

  test("manifeste : pages et autorisations limitées au serveur s5", () => {
    const hotes = [...config.matchAll(/"(\*:\/\/[^"]*fourmizzz[^"]*)"/g)].map((m) => m[1] ?? "");
    expect(hotes.length).toBeGreaterThan(5);
    expect(hotes.every((h) => h.startsWith("*://s5.fourmizzz.fr/"))).toBe(true);
  });

  test("charge la couche GM avant tout le reste, à un commit fixe", () => {
    const requires = entete("abc123", "9.9.9", config)
      .split("\n")
      .filter((l) => l.startsWith("// @require"))
      .map((l) => l.split(/\s+/).at(-1));
    expect(requires[0]).toBe(
      "https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@abc123/userscript/shim.js",
    );
    expect(requires).toHaveLength(js.length - scriptsDePages(config).length + 1);
    expect(requires.every((u) => u!.includes("@abc123/"))).toBe(true);
  });

  test("bibliothèques de certaines pages : ressources exécutées seulement sur ces pages", () => {
    const script = entete("abc123", "9.9.9", config),
      dePages = scriptsDePages(config);
    expect(dePages.map((d) => d.js)).toContain("js/lib/highcharts_6.0.7.js");
    expect(dePages.find((d) => d.js.includes("calystene"))!.pages).toEqual(["/ressources.php"]);
    expect(script).not.toMatch(/@require\s+\S*highcharts/);
    expect(script).toMatch(
      /@resource\s+fzzzJs0 \S*@abc123\/public\/js\/lib\/highcharts_6\.0\.7\.js/,
    );
    expect(script).toContain('["/alliance.php","/construction.php","/messagerie.php"].some(');
    expect(script).toContain(
      'if (typeof fzzzLancerCHS2 != \\"undefined\\") window.fzzzLancerCHS2 = fzzzLancerCHS2;',
    );
  });

  test("eval d'une bibliothèque : ses déclarations restent accessibles ensuite", () => {
    const ctx: any = { window: {} };
    vm.createContext(ctx);
    const code = "function lancer() { return 42; }\nvar donnee = 1;",
      exports = globales(code)
        .map((n) => `window.${n} = ${n};`)
        .join(" ");
    // eval direct dans une fonction stricte : les déclarations n'en sortent pas, sauf par window
    vm.runInContext(
      `(function () { "use strict"; eval(${JSON.stringify(code + "\n;" + exports)}); })()`,
      ctx,
    );
    expect(ctx.window.lancer()).toBe(42);
    expect(ctx.window.donnee).toBe(1);
    expect(ctx.window.interne).toBeUndefined();
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
