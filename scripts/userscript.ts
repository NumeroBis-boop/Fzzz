/**
 * Génère fzzz.user.js, la version « script utilisateur » de Fzzz
 * (Tampermonkey, Violentmonkey) : un en-tête qui déclare en @require, dans
 * l'ordre du manifeste, tous les scripts de l'extension servis par jsDelivr à
 * un commit précis (le cache de jsDelivr est permanent pour un commit).
 *
 *   bun scripts/userscript.ts          → commit HEAD (doit être poussé)
 *   bun scripts/userscript.ts <sha>    → commit donné
 *
 * La liste des fichiers est lue dans wxt.config.ts : rien à mettre à jour ici
 * quand un script est ajouté à l'extension.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const DEPOT = "NumeroBis-boop/Fzzz";
const RACINE = new URL("..", import.meta.url).pathname;

/** Scripts et feuilles de style des content_scripts, dans l'ordre d'injection. */
export function fichiersManifeste(config: string): { js: string[]; css: string[] } {
  const bloc = config.slice(
    config.indexOf("content_scripts"),
    config.indexOf("web_accessible_resources"),
  );
  const lister = (re: RegExp) => [...new Set([...bloc.matchAll(re)].map((m) => m[1]!))];
  return { js: lister(/"(js\/[^"*]+\.js)"/g), css: lister(/"(css\/[^"*]+\.css)"/g) };
}

const TOUTES_LES_PAGES = "*://s5.fourmizzz.fr/*";

/**
 * Scripts réservés à certaines pages (bloc dont `matches` n'est pas toutes les
 * pages), avec les débuts de chemin de ces pages, en minuscules.
 */
export function scriptsDePages(config: string): { js: string; pages: string[] }[] {
  const bloc = config.slice(
    config.indexOf("content_scripts"),
    config.indexOf("web_accessible_resources"),
  );
  return bloc
    .split(/\bmatches:/)
    .slice(1)
    .flatMap((segment) => {
      const matches = [...(segment.match(/\[([^\]]*)\]/)?.[1] ?? "").matchAll(/"([^"]+)"/g)].map(
        (m) => m[1]!,
      );
      if (matches.every((m) => m == TOUTES_LES_PAGES)) return [];
      const pages = [
        ...new Set(
          matches.map((m) => m.replace("*://s5.fourmizzz.fr", "").replace(/\*$/, "").toLowerCase()),
        ),
      ];
      return [...segment.matchAll(/"(js\/[^"*]+\.js)"/g)].map((m) => ({ js: m[1]!, pages }));
    });
}

/**
 * Déclarations en début de ligne d'un script (candidates globales) : exécuté
 * par eval, il attache à `window` celles qui sont bien globales, comme un
 * script chargé normalement.
 */
export function globales(source: string): string[] {
  return [
    ...new Set(
      [...source.matchAll(/^(?:function|var|let|const|class)\s+([A-Za-z_$][\w$]*)/gm)].map(
        (m) => m[1]!,
      ),
    ),
  ];
}

export function entete(
  sha: string,
  version: string,
  config: string,
  lire: (fichier: string) => string = (f) => readFileSync(`${RACINE}public/${f}`, "utf8"),
): string {
  const cdn = `https://cdn.jsdelivr.net/gh/${DEPOT}@${sha}`;
  const { css } = fichiersManifeste(config);
  // Le gestionnaire de scripts ne peut pas choisir ses @require selon la page :
  // les bibliothèques lourdes réservées à certaines pages (Highcharts,
  // simulateur de Calystène) sont des @resource, exécutées seulement là
  const dePages = scriptsDePages(config),
    js = fichiersManifeste(config).js.filter((f) => !dePages.some((d) => d.js == f)),
    groupes = [...new Set(dePages.map((d) => JSON.stringify(d.pages)))].map((cle) => ({
      pages: JSON.parse(cle) as string[],
      fichiers: dePages.filter((d) => JSON.stringify(d.pages) == cle).map((d) => d.js),
    }));
  const brut = `https://raw.githubusercontent.com/${DEPOT}/main/fzzz.user.js`;
  const lignes = [
    // @name + @namespace identifient le script chez Violentmonkey/Tampermonkey :
    // les changer créerait un second script. Le nom affiché (navigateur en
    // français) est donné par @name:fr.
    ["@name", "Fzzz"],
    ["@name:fr", "Extension OUAF"],
    ["@namespace", `https://github.com/${DEPOT}`],
    ["@version", version],
    ["@description", "Outils de l'alliance OUAF pour Fourmizzz (serveur s5)."],
    ["@description:fr", "Outils de l'alliance OUAF pour Fourmizzz (serveur s5)."],
    ["@author", "Hraesvelg (Outiiil), GuiEpi (Toolzzz), NumeroBis-boop (Fzzz)"],
    ["@license", "GPL-3.0"],
    ["@homepageURL", `https://github.com/${DEPOT}`],
    ["@supportURL", `https://github.com/${DEPOT}/issues`],
    ["@updateURL", brut],
    ["@downloadURL", brut],
    ["@match", "*://s5.fourmizzz.fr/*"],
    ["@run-at", "document-end"],
    ["@noframes", ""],
    ...[
      "GM_info",
      "GM_getValue",
      "GM_setValue",
      "GM_deleteValue",
      "GM_listValues",
      "GM_xmlhttpRequest",
      "GM_addStyle",
      "GM_getResourceText",
    ].map((g) => ["@grant", g]),
    ["@connect", "ouafchaine.fr"],
    // adresse de base des images et feuilles de style (voir userscript/shim.js)
    ["@resource", `fzzzBase ${cdn}/public/ouaf-autorisation.html`],
    ...css.map((f, i) => ["@resource", `fzzzCss${i} ${cdn}/public/${f}`]),
    ...dePages.map((d, i) => ["@resource", `fzzzJs${i} ${cdn}/public/${d.js}`]),
    ["@require", `${cdn}/userscript/shim.js`],
    ...js.map((f) => ["@require", `${cdn}/public/${f}`]),
  ];
  const largeur = Math.max(...lignes.map(([cle]) => cle!.length)) + 1;
  return [
    "// ==UserScript==",
    ...lignes.map(([cle, val]) => `// ${cle!.padEnd(largeur)}${val}`.trimEnd()),
    "// ==/UserScript==",
    "",
    "// Fichier généré par scripts/userscript.ts : ne pas modifier à la main.",
    "// Le code de Fzzz est dans les @require ci-dessus ; ici, seulement ses feuilles de style.",
    `${css.map((_, i) => `GM_addStyle(GM_getResourceText("fzzzCss${i}"));`).join("\n")}`,
    "",
    "// Bibliothèques réservées à certaines pages (voir wxt.config.ts), exécutées seulement là.",
    ...groupes.flatMap((g) => [
      `if (${JSON.stringify(g.pages)}.some((p) => location.pathname.toLowerCase().startsWith(p))) {`,
      ...g.fichiers.map((f) => {
        // typeof : un nom repéré en début de ligne peut être une fonction interne
        let exports = globales(lire(f))
          .map((n) => `if (typeof ${n} != "undefined") window.${n} = ${n};`)
          .join(" ");
        return `  eval(GM_getResourceText("fzzzJs${dePages.findIndex((d) => d.js == f)}") + ${JSON.stringify("\n;" + exports)}); // ${f}`;
      }),
      "}",
    ]),
    "",
  ].join("\n");
}

if (import.meta.main) {
  const sha = process.argv[2] ?? execSync("git rev-parse HEAD", { cwd: RACINE }).toString().trim();
  const sale = execSync("git status --porcelain public userscript wxt.config.ts", { cwd: RACINE })
    .toString()
    .trim();
  if (!process.argv[2] && sale) {
    console.error("Modifications non commitées dans public/, userscript/ ou wxt.config.ts :");
    console.error(sale);
    process.exit(1);
  }
  const config = readFileSync(`${RACINE}wxt.config.ts`, "utf8");
  const version = JSON.parse(readFileSync(`${RACINE}package.json`, "utf8")).version;
  const manquants = fichiersManifeste(config)
    .js.concat(fichiersManifeste(config).css)
    .filter((f) => !existsSync(`${RACINE}public/${f}`));
  if (manquants.length) {
    console.error("Fichiers du manifeste introuvables :", manquants);
    process.exit(1);
  }
  writeFileSync(`${RACINE}fzzz.user.js`, entete(sha, version, config));
  console.log(`fzzz.user.js généré (v${version}, commit ${sha.slice(0, 7)})`);
}
