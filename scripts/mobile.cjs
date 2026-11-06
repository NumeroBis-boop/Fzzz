/**
 * Affichage sur téléphone : chaque page du jeu enregistrée est ouverte avec et
 * sans l'extension, en Android, en iPhone, en mode « site pour ordinateur »
 * des téléphones (page de 980 px) et sur PC. Si l'extension élargit la page
 * (défilement horizontal ajouté), liste les éléments qui débordent ; enregistre
 * une capture de chaque page pour la relecture.
 *
 *   bun run build
 *   node scripts/mobile.cjs <dossier de pages du jeu> [page.php,…]
 *
 * Mettre aussi dans le dossier la feuille de style du jeu (design7.css) :
 * sans elle, la mise en page n'est pas celle du jeu. Chromium imite la taille,
 * le toucher et la page des téléphones, pas les moteurs de Safari et Firefox.
 */
const { chromium } = require("playwright");
const fs = require("fs"),
  path = require("path");

const EXTENSION = path.join(__dirname, "..", ".output", "chrome-mv3"),
  [dossier, liste] = process.argv.slice(2);
if (!dossier) {
  console.error("usage : node scripts/mobile.cjs <dossier de pages du jeu> [pages]");
  process.exit(1);
}
const PAGES = (
    liste ||
    "messagerie.php,Armee.php,Ressources.php,laboratoire.php,construction.php,commerce.php,Membre.php?Pseudo=X,ennemie.php?Attaquer=1"
  ).split(","),
  ANDROID =
    "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  IPHONE =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  // « site pour ordinateur » : la balise viewport du jeu est ignorée, la page fait 980 px
  APPAREILS = {
    android: { viewport: { width: 412, height: 915 }, isMobile: true, userAgent: ANDROID },
    iphone: { viewport: { width: 390, height: 844 }, isMobile: true, userAgent: IPHONE },
    "telephone-980": { viewport: { width: 980, height: 2000 }, isMobile: false },
    pc: { viewport: { width: 1300, height: 900 }, isMobile: false },
  },
  CAPTURES = path.join(dossier, "captures-mobile"),
  CSS_JEU = path.join(dossier, "design7.css");
if (!fs.existsSync(CSS_JEU))
  console.warn("design7.css absent du dossier : mise en page sans la feuille du jeu");
fs.mkdirSync(CAPTURES, { recursive: true });

// éléments qui dépassent `limite`, les plus profonds, avec l'élément de
// l'extension qui les contient s'il y en a un
function depassements(limite) {
  const aExtension = (e) =>
      /^o_/.test(e.id) || (typeof e.className == "string" && /(^|\s)o_/.test(e.className)),
    nom = (e) =>
      e.tagName.toLowerCase() +
      (e.id ? "#" + e.id : "") +
      (typeof e.className == "string" && e.className.trim()
        ? "." + e.className.trim().split(/\s+/).join(".")
        : ""),
    trop = [...document.querySelectorAll("body *")].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width && r.right + scrollX > limite + 2;
    });
  return trop
    .filter((e) => !trop.some((f) => f != e && e.contains(f)))
    .map((e) => {
      const r = e.getBoundingClientRect();
      let x = e;
      while (x && x != document.body && !aExtension(x)) x = x.parentElement;
      return `${nom(e)} : ${Math.round(r.left + scrollX)} → ${Math.round(r.right + scrollX)} px${x && x != document.body ? (x == e ? " (extension)" : ` (dans ${nom(x)})`) : " (jeu)"}`;
    });
}

(async () => {
  const largeurs = {};
  let total = 0;
  for (const avecExtension of [false, true])
    for (const [nom, appareil] of Object.entries(APPAREILS)) {
      const ctx = await chromium.launchPersistentContext("", {
        channel: "chromium",
        headless: true,
        hasTouch: nom != "pc",
        ...appareil,
        args: avecExtension
          ? [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`]
          : [],
      });
      // pages et feuille du jeu servies depuis le dossier, sans requête au jeu
      await ctx.route("**://s5.fourmizzz.fr/**", (route) => {
        const chemin = new URL(route.request().url()).pathname;
        if (/\/design7\.css$/.test(chemin))
          return route.fulfill({
            status: fs.existsSync(CSS_JEU) ? 200 : 404,
            headers: { "content-type": "text/css" },
            body: fs.existsSync(CSS_JEU) ? fs.readFileSync(CSS_JEU, "utf8") : "",
          });
        const f = path.join(
            dossier,
            chemin
              .replace(/^\//, "")
              .replace(/\.php$/i, "")
              .toLowerCase() + ".html",
          ),
          body = !/^\/[^/]+$/.test(chemin) || !fs.existsSync(f) ? "" : fs.readFileSync(f, "utf8");
        return route.fulfill({
          status: body ? 200 : 404,
          headers: { "content-type": "text/html; charset=utf-8" },
          body,
        });
      });
      await ctx.addInitScript(() => localStorage.setItem("outiiil_lastSeenVersion", "9.9.9"));
      for (const p of PAGES) {
        const page = await ctx.newPage();
        await page.goto("http://s5.fourmizzz.fr/" + p);
        await page.waitForTimeout(3000);
        if (avecExtension && !(await page.$("#o_boiteExtension"))) {
          console.error(`${p} (${nom}) : l'extension ne s'est pas chargée`);
          process.exit(2);
        }
        const largeur = await page.evaluate(() => document.documentElement.scrollWidth);
        if (!avecExtension) (largeurs[p] ||= {})[nom] = largeur;
        else {
          const sans = largeurs[p][nom],
            trop = largeur > sans + 2 ? await page.evaluate(depassements, sans) : [];
          total += trop.length;
          console.log(
            `${p} (${nom}) : page de ${largeur} px (${sans} sans l'extension)` +
              (trop.length ? `, élargie par :` : ""),
          );
          trop.slice(0, 10).forEach((t) => console.log("  " + t));
          await page.screenshot({
            path: path.join(CAPTURES, `${p.replace(/[^\w.-]+/g, "_")}-${nom}.png`),
            fullPage: true,
          });
        }
        await page.close();
      }
      await ctx.close();
    }
  console.log(`\ncaptures : ${CAPTURES}`);
  process.exit(total ? 1 : 0);
})();
