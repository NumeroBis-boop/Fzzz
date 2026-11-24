/**
 * Boîtes de l'extension sur téléphone (affichage mobile du jeu, Android 412 px
 * et iPhone 390 px) : ouvre Préférences, Chasse et Combat depuis l'encadré
 * « Extension OUAF » d'une page enregistrée, passe chaque onglet, liste ce qui
 * dépasse de la boîte ou de l'écran et enregistre une capture par onglet.
 *
 *   bun run build
 *   node scripts/mobile-boites.cjs <dossier de pages du jeu> [page.php]
 *
 * Même dossier que mobile.cjs (noms : scripts/pages-enregistrees.cjs).
 */
const { chromium } = require("playwright");
const fs = require("fs"),
  path = require("path"),
  { servir } = require("./pages-enregistrees.cjs");

const EXTENSION = path.join(__dirname, "..", ".output", "chrome-mv3"),
  [dossier, adresse = "Ressources.php"] = process.argv.slice(2);
if (!dossier) {
  console.error("usage : node scripts/mobile-boites.cjs <dossier de pages du jeu> [page.php]");
  process.exit(1);
}
const APPAREILS = {
    android: {
      viewport: { width: 412, height: 915 },
      isMobile: true,
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
    },
    iphone: {
      viewport: { width: 390, height: 844 },
      isMobile: true,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    },
  },
  BOITES = [
    ["Préférences", "#o_toolbarItem6", "#o_boiteParametre"],
    ["Chasse", "#o_toolbarItem2", "#o_boiteChasse"],
    ["Combat", "#o_toolbarItem3", "#o_boiteCombat"],
  ],
  CAPTURES = path.join(dossier, "captures-boites");
fs.mkdirSync(CAPTURES, { recursive: true });

// éléments visibles de la boîte qui dépassent de son bord droit ou de l'écran,
// les plus profonds ; un élément dans un conteneur qui défile n'est pas compté
function depassements(selecteur) {
  const boite = document.querySelector(selecteur);
  if (!boite) return ["boîte absente"];
  const cadre = boite.getBoundingClientRect(),
    droite = Math.min(cadre.right, document.documentElement.clientWidth),
    defile = (e) => {
      for (let x = e.parentElement; x && x != boite; x = x.parentElement) {
        const o = getComputedStyle(x).overflowX;
        if ((o == "auto" || o == "scroll") && x.scrollWidth > x.clientWidth) return true;
      }
      return false;
    },
    nom = (e) =>
      e.tagName.toLowerCase() +
      (e.id ? "#" + e.id : "") +
      (typeof e.className == "string" && e.className.trim()
        ? "." + e.className.trim().split(/\s+/).slice(0, 3).join(".")
        : ""),
    trop = [...boite.querySelectorAll("*")].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width && r.height && e.offsetParent !== null && r.right > droite + 1 && !defile(e);
    });
  return trop
    .filter((e) => !trop.some((f) => f != e && e.contains(f)))
    .slice(0, 12)
    .map((e) => {
      const r = e.getBoundingClientRect();
      return `${nom(e)} « ${(e.textContent || "").trim().slice(0, 40)} » : ${Math.round(r.left)} → ${Math.round(r.right)} px (bord ${Math.round(droite)})`;
    });
}

(async () => {
  let total = 0;
  for (const [nomAppareil, appareil] of Object.entries(APPAREILS)) {
    const ctx = await chromium.launchPersistentContext("", {
      channel: "chromium",
      headless: true,
      // un joueur en France : sans ça, l'horloge ajoute la ligne « Chez toi »
      timezoneId: "Europe/Paris",
      locale: "fr-FR",
      hasTouch: true,
      ...appareil,
      args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
    });
    await ctx.route("**://s5.fourmizzz.fr/**", (route) => servir(route, dossier));
    await ctx.addInitScript(() => localStorage.setItem("outiiil_lastSeenVersion", "9.9.9"));
    const page = await ctx.newPage();
    await page.goto("http://s5.fourmizzz.fr/" + adresse);
    await page.waitForTimeout(3000);
    for (const [nomBoite, bouton, boite] of BOITES) {
      if (!(await page.$(bouton))) {
        console.log(`${nomAppareil} ${nomBoite} : bouton absent`);
        continue;
      }
      // affichage mobile du jeu : ses encadrés (et celui de l'extension) ne
      // s'affichent qu'après un appui sur la première icône du menu
      const horsEcran = await page.$eval(
        bouton,
        (b) => b.getBoundingClientRect().bottom + scrollY < 0,
      );
      if (horsEcran && (await page.$("#boutonBoite"))) {
        await page.click("#boutonBoite");
        await page.waitForTimeout(500);
      }
      const visible = await page.$eval(bouton, (b) => {
        const r = b.getBoundingClientRect();
        return r.bottom + scrollY > 0 && r.right > 0 && r.left < innerWidth;
      });
      if (!visible) {
        console.log(`${nomAppareil} ${nomBoite} : bouton hors de l'écran, même menu ouvert`);
        total++;
        continue;
      }
      await page.click(bouton);
      await page.waitForTimeout(800);
      const onglets = await page.$$eval(`${boite} .ui-tabs-nav a`, (as) =>
        as.map((a) => a.getAttribute("href")),
      );
      for (const [i, href] of (onglets.length ? onglets : [null]).entries()) {
        if (href) {
          await page.click(`${boite} .ui-tabs-nav a[href='${href}']`);
          await page.waitForTimeout(500);
        }
        const nomOnglet = href ? href.replace(/^#/, "") : "boite",
          trop = await page.evaluate(depassements, boite),
          largeur = await page.evaluate(() => document.documentElement.scrollWidth);
        total += trop.length;
        console.log(
          `${nomAppareil} ${nomBoite} › ${nomOnglet} : page de ${largeur} px` +
            (trop.length ? ", dépasse :" : ""),
        );
        trop.forEach((t) => console.log("  " + t));
        const $boite = await page.$(boite);
        if ($boite)
          await $boite.screenshot({
            path: path.join(
              CAPTURES,
              `${nomAppareil}-${nomBoite}-${i}-${nomOnglet}.png`.replace(/[^\w.-]+/g, "_"),
            ),
          });
      }
      // ferme la boîte avant la suivante
      await page
        .evaluate(
          (b) => $(b).find(".o_fermer, .ui-dialog-titlebar-close").first().trigger("click"),
          boite,
        )
        .catch(() => {});
      await page.evaluate((b) => $(b).hide(), boite).catch(() => {});
    }
    await ctx.close();
  }
  console.log(`\ncaptures : ${CAPTURES}`);
  process.exit(total ? 1 : 0);
})();
