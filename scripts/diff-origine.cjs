/**
 * Vérifie « Rétablir l'affichage d'origine » : chaque page du jeu est affichée
 * sans l'extension, puis avec l'extension et toutes les cases d'origine
 * cochées ; tout élément du jeu dont le texte ou le style diffère est listé.
 *
 *   bun run build
 *   node scripts/diff-origine.cjs <dossier de pages du jeu> [page.php,…]
 *
 * Le dossier contient des pages enregistrées du jeu (armee.html,
 * messagerie.html…, nom de la page en minuscules) : elles ne sont pas dans le
 * dépôt (données de joueurs). Chromium et Playwright doivent être installés.
 */
const { chromium } = require("playwright");
const fs = require("fs"),
  path = require("path");

const EXTENSION = path.join(__dirname, "..", ".output", "chrome-mv3"),
  [dossier, liste] = process.argv.slice(2);
if (!dossier) {
  console.error("usage : node scripts/diff-origine.cjs <dossier de pages du jeu> [pages]");
  process.exit(1);
}
const PAGES = (
    liste ||
    "messagerie.php,Armee.php,Ressources.php,laboratoire.php,construction.php,commerce.php,Membre.php?Pseudo=X,ennemie.php?Attaquer=1"
  ).split(","),
  ONGLETS = [
    "General",
    "Ressources",
    "Armee",
    "Attaque",
    "Laboratoire",
    "Messagerie",
    "Convois",
    "Membre",
  ],
  PROPRIETES = [
    "display",
    "visibility",
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "color",
    "background-color",
    "background-image",
    "line-height",
    "text-align",
    "white-space",
    "width",
    "margin-top",
    "margin-bottom",
    "padding-top",
    "padding-left",
    "border-top-width",
    "border-top-color",
    "text-decoration-line",
    "letter-spacing",
    "opacity",
    "position",
    "float",
    "vertical-align",
    "cursor",
  ];

// relevé dans la page : éléments du jeu seulement (ceux de l'extension sont ignorés)
function relever(proprietes) {
  const deLExtension = (x) =>
      (x.id && /^o_|^ui-/.test(x.id)) ||
      /(^|\s)(o_|jq-toast|ui-helper|ui-tooltip|ui-dialog|xdsoft)/.test(
        typeof x.className == "string" ? x.className : "",
      ) ||
      ["SCRIPT", "STYLE", "LINK"].includes(x.tagName),
    chemin = (e) => {
      let p = [];
      for (let x = e; x && x != document.documentElement; x = x.parentElement) {
        let i = 1;
        for (let s = x.previousElementSibling; s; s = s.previousElementSibling)
          if (s.tagName == x.tagName && !deLExtension(s)) i++;
        p.unshift(x.tagName.toLowerCase() + (x.id ? "#" + x.id : "") + "[" + i + "]");
      }
      return p.join(">");
    },
    out = {};
  for (const e of document.querySelectorAll("body *")) {
    let ignorer = false;
    for (let x = e; x && x != document.body; x = x.parentElement)
      if (deLExtension(x)) ignorer = true;
    if (ignorer) continue;
    const cs = getComputedStyle(e),
      st = {
        // classe « gras » : aussi celle du jeu, qui la met en gras (sa feuille
        // de style manque aux pages enregistrées)
        gras: !!e.closest(".gras"),
        texte: [...e.childNodes]
          .filter((n) => n.nodeType == 3)
          .map((n) => n.textContent.trim())
          .join("|"),
      };
    for (const p of proprietes) st[p] = cs.getPropertyValue(p);
    out[chemin(e)] = st;
  }
  return out;
}

(async () => {
  const releves = {};
  for (const avecExtension of [false, true]) {
    // channel "chromium" : le mode sans fenêtre qui charge les extensions
    const ctx = await chromium.launchPersistentContext("", {
      channel: "chromium",
      headless: true,
      viewport: { width: 1300, height: 900 },
      args: avecExtension
        ? [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`]
        : [],
    });
    // pages servies depuis le dossier, sans requête au jeu
    await ctx.route("**://s5.fourmizzz.fr/**", (route) => {
      const nom = new URL(route.request().url()).pathname
          .replace(/^\//, "")
          .replace(/\.php$/i, "")
          .toLowerCase(),
        f = path.join(dossier, nom + ".html"),
        body = fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "";
      return route.fulfill({
        status: body ? 200 : 404,
        headers: { "content-type": "text/html; charset=utf-8" },
        body,
      });
    });
    await ctx.addInitScript((onglets) => {
      localStorage.setItem("outiiil_lastSeenVersion", "9.9.9");
      for (const o of onglets) localStorage.setItem("fzzz_origine_" + o, "1");
    }, ONGLETS);
    for (const p of PAGES) {
      const page = await ctx.newPage();
      await page.goto("http://s5.fourmizzz.fr/" + p);
      await page.waitForTimeout(3500);
      // encadré « Extension OUAF » : toujours affiché, preuve que l'extension tourne
      if (avecExtension && !(await page.$("#o_boiteExtension"))) {
        console.error(`${p} : l'extension ne s'est pas chargée, comparaison impossible`);
        process.exit(2);
      }
      (releves[p] ||= {})[avecExtension ? "avec" : "sans"] = await page.evaluate(
        relever,
        PROPRIETES,
      );
      await page.close();
    }
    await ctx.close();
  }
  let total = 0;
  for (const p of PAGES) {
    const { sans, avec } = releves[p],
      ecarts = [];
    for (const k of Object.keys(sans)) {
      if (!avec[k]) ecarts.push(`disparu : ${k}`);
      else
        for (const prop in sans[k])
          if (sans[k][prop] !== avec[k][prop] && !(prop == "font-weight" && sans[k].gras))
            ecarts.push(`${prop} : ${k} : ${sans[k][prop]} → ${avec[k][prop]}`);
    }
    for (const k of Object.keys(avec)) if (!sans[k]) ecarts.push(`ajouté : ${k}`);
    total += ecarts.length;
    console.log(`\n${p} : ${ecarts.length} écart(s)`);
    ecarts.slice(0, 30).forEach((e) => console.log("  " + e));
  }
  process.exit(total ? 1 : 0);
})();
