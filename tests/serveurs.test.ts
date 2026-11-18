import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { creerPage, type Page } from "./harnais";

/**
 * Extension sur les serveurs s1 à s5 (17/11/2026), pour toute alliance
 * (18/11/2026) : rien de l'alliance n'est écrit dans le code, ses réglages
 * sont lus dans son forum (tests/reglages-alliance.test.ts). Le stockage de
 * l'extension, commun à tous les serveurs au contraire du localStorage du jeu,
 * est rangé par serveur. Joueurs et sites inventés.
 */
const S1 = "https://s1.fourmizzz.fr/commerce.php";
const S5 = "https://s5.fourmizzz.fr/commerce.php";
const SITE = "http://convois.example.org";
const AUTRE_SITE = "https://autre.example.org";
const RACINE = join(import.meta.dir, "..");

// stockage de l'extension (ou du gestionnaire de scripts) : le même pour les
// pages de tous les serveurs
function stockageCommun() {
  const valeurs: Record<string, unknown> = {};
  return {
    valeurs,
    storage: {
      local: {
        get: (c: string) => Promise.resolve(c in valeurs ? { [c]: valeurs[c] } : {}),
        set: (o: Record<string, unknown>) => (Object.assign(valeurs, o), Promise.resolve()),
        remove: (c: string) => (delete valeurs[c], Promise.resolve()),
      },
    },
  };
}
function avecStockage(page: Page, chrome: ReturnType<typeof stockageCommun>) {
  (page.window as any).chrome = { storage: chrome.storage };
  return page;
}
// réglages de l'alliance déjà lus sur cette page (localStorage du jeu, propre au serveur)
const reglagesLus = (page: Page, reglages: Record<string, unknown>) =>
  page.lire(
    `localStorage.setItem("fzzz_reglagesAlliance", ${JSON.stringify(JSON.stringify({ lu: 0, section: true, sujet: true, reglages }))})`,
  );

describe("stockage commun à tous les serveurs", () => {
  test("clés : celles d'avant sur le s5, une par serveur ailleurs", () => {
    expect(
      creerPage(["js/class/Utils.js"], "", S5).lire(`Utils.cleServeur("fzzz_exportSheet")`),
    ).toBe("fzzz_exportSheet");
    expect(
      creerPage(["js/class/Utils.js"], "", S1).lire(`Utils.cleServeur("fzzz_exportSheet")`),
    ).toBe("fzzz_exportSheet_s1");
  });

  test("feuilles Google : un même pseudo sur deux serveurs ne mélange pas les adresses", async () => {
    const commun = stockageCommun(),
      scripts = ["js/class/Utils.js", "js/class/ExportRapports.js"],
      s5 = avecStockage(creerPage(scripts, "", S5), commun),
      s1 = avecStockage(creerPage(scripts, "", S1), commun),
      adresse = (n: string) => `https://script.google.com/macros/s/${n}/exec`;
    await s5.lire(`ExportRapports.enregistrerAdresse("${adresse("AAA")}")`);
    expect(await s1.lire(`ExportRapports.adressePersonnelle()`)).toBe("");
    await s1.lire(`ExportRapports.enregistrerAdresse("${adresse("BBB")}")`);
    expect(await s5.lire(`ExportRapports.adressePersonnelle()`)).toBe(adresse("AAA"));
    expect(await s1.lire(`ExportRapports.adressePersonnelle()`)).toBe(adresse("BBB"));
    // dernière lecture du forum de l'alliance (adresse de son fichier) : par serveur aussi
    await s1.lire(`ExportRapports._garder(CLE_EXPORT_SHEET_ALLIANCE, "{}")`);
    expect(Object.keys(commun.valeurs).sort()).toEqual([
      "fzzz_exportSheet",
      "fzzz_exportSheetAlliance_s1",
      "fzzz_exportSheet_s1",
    ]);
  });
});

describe("site de suivi des convois : celui des réglages, accepté par le joueur", () => {
  const SCRIPTS = ["js/class/Utils.js", "js/class/OuafSuivi.js"];

  test("sans site dans les réglages : aucun site, rien n'est demandé au site", async () => {
    const p = avecStockage(creerPage(SCRIPTS, "", S1), stockageCommun());
    expect(p.lire(`OuafSuivi.site()`)).toBeNull();
    expect(
      await p.lire(`OuafSuivi.requete("GET", "/api/mes").then(() => "ok", (e) => e.name)`),
    ).toBe("site");
  });

  test("mot de passe envoyé seulement au site accepté ; accord et mot de passe propres au serveur", async () => {
    const commun = stockageCommun(),
      s5 = avecStockage(creerPage(SCRIPTS, "", S5), commun),
      s1 = avecStockage(creerPage(SCRIPTS, "", S1), commun);
    reglagesLus(s5, { siteConvois: SITE + "/" });
    reglagesLus(s1, { siteConvois: SITE });
    expect(s5.lire(`OuafSuivi.site()`)).toEqual({
      url: SITE + "/",
      origine: SITE,
      hote: "convois.example.org",
    });
    await s5.lire(`OuafSuivi.enregistrerCode("code-invente")`);
    // pas encore accepté : le mot de passe reste, mais n'est pas donné pour un envoi
    expect(await s5.lire(`OuafSuivi.lireCode()`)).toBe("");
    expect(await s5.lire(`OuafSuivi.codeEnregistre()`)).toBe("code-invente");
    await s5.lire(`OuafSuivi.accepterSite()`);
    expect(await s5.lire(`OuafSuivi.lireCode()`)).toBe("code-invente");
    // l'autre serveur : ni l'accord ni le mot de passe du s5
    expect(await s1.lire(`OuafSuivi.siteAccepte()`)).toBe(false);
    expect(await s1.lire(`OuafSuivi.codeEnregistre()`)).toBe("");
    expect(Object.keys(commun.valeurs).sort()).toEqual([
      "fzzz_ouafCode",
      "fzzz_siteConvoisAccepte",
    ]);
  });

  test("réglages changés pour un autre site : plus accepté ; l'accepter efface le mot de passe", async () => {
    const commun = stockageCommun(),
      p = avecStockage(creerPage(SCRIPTS, "", S5), commun);
    reglagesLus(p, { siteConvois: SITE });
    await p.lire(`OuafSuivi.accepterSite().then(() => OuafSuivi.enregistrerCode("code-invente"))`);
    reglagesLus(p, { siteConvois: AUTRE_SITE });
    expect(await p.lire(`OuafSuivi.siteAccepte()`)).toBe(false);
    expect(await p.lire(`OuafSuivi.lireCode()`)).toBe("");
    await p.lire(`OuafSuivi.accepterSite()`);
    expect(await p.lire(`OuafSuivi.siteAccepte()`)).toBe(true);
    expect(await p.lire(`OuafSuivi.codeEnregistre()`)).toBe("");
    // revenu au même site : rien n'est effacé
    await p.lire(`OuafSuivi.enregistrerCode("nouveau")`);
    await p.lire(`OuafSuivi.accepterSite()`);
    expect(await p.lire(`OuafSuivi.codeEnregistre()`)).toBe("nouveau");
  });

  test("requête : vers l'origine du site accepté, jamais vers un site non accepté", async () => {
    const commun = stockageCommun(),
      p = avecStockage(creerPage(SCRIPTS, "", S5), commun);
    p.lire(
      `window.ENVOIS = []; chrome.runtime = { sendMessage: (m) => { ENVOIS.push(m); return Promise.resolve({ ok: true, statut: 200, donnees: {} }); } }`,
    );
    reglagesLus(p, { siteConvois: SITE + "/suivi/" });
    expect(
      await p.lire(`OuafSuivi.requete("GET", "/api/mes").then(() => "ok", (e) => e.name)`),
    ).toBe("site");
    await p.lire(`OuafSuivi.accepterSite()`);
    expect(await p.lire(`OuafSuivi.requete("GET", "/api/mes").then(() => "ok")`)).toBe("ok");
    expect(p.lire(`ENVOIS`)).toEqual([
      { type: "fzzz_ouaf", site: SITE, methode: "GET", chemin: "/api/mes", corps: undefined },
    ]);
  });

  const page = (url: string, reglages: Record<string, unknown> | null, accepte = "") => {
    const p = creerPage(
      ["js/class/Utils.js", "js/class/OuafSuivi.js", "js/page/CommerceFzzz.js"],
      "var TOAST_INFO = {}; var Horloge = { maintenant: () => 0 };",
      url,
    );
    const commun = stockageCommun();
    if (accepte)
      commun.valeurs[url == S5 ? "fzzz_siteConvoisAccepte" : "fzzz_siteConvoisAccepte_s1"] =
        accepte;
    avecStockage(p, commun);
    if (reglages) reglagesLus(p, reglages);
    p.lire(`(() => {
      window.lus = [];
      document.body.innerHTML = '<div id="centre"><h3>Convois en cours:</h3><p>Aucun convoi</p></div>';
      OuafSuivi.convoisJeu = () => (lus.push("convois"), []);
      CommerceFzzz.membresSuivis = () => lus.push("récapitulatif");
      ReglagesAlliance.charger = () => (lus.push("forum"), Promise.resolve(ReglagesAlliance.garde() || { section: true, sujet: false, reglages: ReglagesAlliance.vides() }));
    })()`);
    return p;
  };
  const attendre = () => new Promise((r) => setTimeout(r, 0));

  test("page Convois : rien sans site ; site pas accepté : la demande d'accord, sans suivi ; accepté : le suivi", async () => {
    const sans = page(S1, {});
    await sans.lire(`CommerceFzzz.suivi()`);
    expect(sans.lire(`lus`)).toEqual([]);
    expect(sans.lire(`$(".o_convoisSite, .o_ouafLigne, #o_convoisMembres").length`)).toBe(0);
    // réglages jamais lus dans ce navigateur : lus d'abord
    const jamais = page(S1, null);
    await jamais.lire(`CommerceFzzz.suivi()`);
    expect(jamais.lire(`lus`)).toEqual(["forum"]);

    const propose = page(S1, { siteConvois: SITE });
    await propose.lire(`CommerceFzzz.suivi()`);
    expect(propose.lire(`lus`)).toEqual([]);
    expect(propose.lire<string>(`$(".o_convoisSite").text()`)).toContain(
      "ses réglages donnent le site convois.example.org",
    );
    propose.lire(`$(".o_convoisSite button").trigger("click")`);
    await attendre();
    await attendre();
    expect(propose.lire(`lus`)).toEqual(["convois", "récapitulatif"]);
    expect(propose.lire(`$(".o_convoisSite").length`)).toBe(0);

    const accepte = page(S5, { siteConvois: SITE }, SITE);
    await accepte.lire(`CommerceFzzz.suivi()`);
    expect(accepte.lire(`lus`)).toEqual(["convois", "récapitulatif"]);
  });

  test("Préférences → Convois : sans site, une phrase qui renvoie aux réglages de l'alliance", () => {
    const p = creerPage(
      ["js/class/Utils.js", "js/class/OuafSuivi.js", "js/boite/Boite.js", "js/boite/Parametres.js"],
      "",
      S1,
    );
    p.lire(`document.body.innerHTML = '<div id="o_tabsParametreConvois"></div>';
      BoiteParametre.prototype.ongletConvois.call(BoiteParametre.prototype)`);
    expect(p.lire<string>(`$("#o_tabsParametreConvois").text()`)).toBe(
      "Aucun site de suivi des convois dans les réglages de ton alliance : un chef l'écrit sur la ligne « Site de suivi des convois » du sujet « Réglages de l'extension » (onglet Partage de données, section « Fonctionnement sur les autres serveurs »).",
    );
    expect(p.lire(`$("#o_ouafCode").length`)).toBe(0);
  });
});

describe("aucune information de l'alliance dans le code publié", () => {
  // fichiers injectés dans le jeu ou qui construisent le script publié
  const fichiers = (dossier: string): string[] =>
    readdirSync(join(RACINE, dossier), { withFileTypes: true }).flatMap((e) =>
      e.isDirectory()
        ? e.name == "lib"
          ? []
          : fichiers(join(dossier, e.name))
        : /\.(js|ts|html|css)$/.test(e.name)
          ? [join(dossier, e.name)]
          : [],
    );
  const PUBLIES = [
    ...fichiers("public"),
    ...fichiers("userscript"),
    ...fichiers("entrypoints"),
    "scripts/userscript.ts",
    "wxt.config.ts",
  ];

  test("ni le site de suivi d'une alliance, ni l'adresse d'un script Google, ni une liste de joueurs", () => {
    const trouves = PUBLIES.flatMap((f) => {
      const texte = readFileSync(join(RACINE, f), "utf8");
      return [
        /ouafchaine/i,
        /macros\/s\/AKfy[\w-]{8,}/,
        /CHASSEURS_PAR_DEFAUT|JOURNAL_JOUEURS|SERVEUR_OUAF/,
      ]
        .filter((motif) => motif.test(texte))
        .map((motif) => `${f} : ${motif}`);
    });
    expect(trouves).toEqual([]);
  });
});
