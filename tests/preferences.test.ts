import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { creerPage } from "./harnais";

/**
 * Préférences réduites à la liste du mainteneur (14/11/2026) : ses
 * sous-catégories en onglets, puis Chasseur et Grenier (montrés à tous), les
 * pages où l'extension agit (une case chacune, à la place des « Rétablir
 * l'affichage d'origine » de chaque onglet) et « À propos ».
 */
const page = creerPage(
  [
    "js/lib/jquery-ui_1.12.1.js",
    "js/lib/globalize_0.1.1.js",
    "js/lib/globalize-locale-fr.js",
    "js/class/Utils.js",
    "js/class/Parametre.js",
    "js/class/Joueur.js",
    "js/class/Armee.js",
    "js/class/UnitesGardees.js",
    "js/page/PartageChasses.js",
    "js/class/RappelExport.js",
    "js/class/SuiviMembres.js",
    "js/class/ExportRapports.js",
    "js/class/ExportAuto.js",
    "js/boite/Boite.js",
    "js/boite/Parametres.js",
  ],
  `var METHODE_FLOOD = ["Standard", "Optimisée", "Uniforme", "Dégressive"], AFFECTATION_RESSOURCE = [], RATIO_RECOLTE = {};
   var NOM_UNITE = ["Ouvrière", "Jeune Soldate Naine"], VERSION = "1.111.0", OUAF_SITE = "http://ouaf.invalid/";
   var OuafSuivi = { lireCode: () => Promise.resolve(""), enregistrerCode: () => Promise.resolve() };
   var heure = moment("2026-11-14 10:00", "YYYY-MM-DD HH:mm").valueOf();
   var Horloge = { maintenant: () => heure, serveur: () => moment(heure) };`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);

/** Tous les onglets des Préférences, construits comme à l'ouverture de la boîte. */
function construire(stockage: Record<string, string> = {}) {
  lire(`(() => {
    localStorage.clear();
    Object.entries(${JSON.stringify(stockage)}).forEach(([k, v]) => localStorage.setItem(k, v));
    ExportRapports.reglageAlliance = () => Promise.resolve({ autorise: true });
    window.monProfil = new Joueur({ pseudo: "Moi" }).getParametre();
    document.body.innerHTML = "<div id='o_boiteParametre'><div id='o_tabsParametre'>" +
      ONGLETS_PARAMETRE.map((o) => "<div id='o_tabsParametre" + o.id + "'></div>").join("") + "</div></div>";
    window.boite = new BoiteParametre();
    boite.ajusterTaille = () => boite;
    boite.ongletOptions().ongletPartage().ongletMiseEnPage().ongletArmeeFloods().ongletMessagerie()
      .ongletAffichage().ongletChasseur().ongletGrenier().ongletPages().apropos();
    boite.event();
  })()`);
}

describe("onglets de la liste du mainteneur", () => {
  test("ses sous-catégories, puis Chasseur, Grenier, Pages et À propos", () => {
    expect(lire(`ONGLETS_PARAMETRE.map((o) => o.titre)`)).toEqual([
      "Options",
      "Partage de données",
      "Mise en page",
      "Armée et floods",
      "Messagerie",
      "Affichage",
      "Chasseur",
      "Grenier",
      "Pages",
      "À propos",
    ]);
  });

  test("une case par affichage réglable, à sa place ; la messagerie décochée par défaut sauf les smileys", () => {
    construire();
    const cases = lire<[string, string, boolean][]>(
      `$("input[data-affichage]").map((i, c) => [[$(c).closest("[id^='o_tabsParametre']").attr("id").replace("o_tabsParametre", ""), c.dataset.affichage, c.checked]]).get()`,
    );
    expect(cases.map((c) => c[1]).sort()).toEqual(
      lire<string[]>(`Object.keys(AFFICHAGES_REGLABLES).sort()`),
    );
    expect(cases.filter((c) => !c[2]).map((c) => c[1])).toEqual([
      "messagerieCouleurs",
      "messagerieCopie",
      "messagerieAnalyse",
      "messagerieExport",
      "messagerieRanger",
      "messagerieCompacte",
      "messagerieNonLus",
      "messagerieMiseEnForme",
    ]);
    expect(Object.fromEntries(cases.map((c) => [c[1], c[0]]))).toMatchObject({
      horloge: "Options",
      nouveautes: "Options",
      affectationOuvrieres: "Options",
      armeeMiseEnPage: "MiseEnPage",
      replacerArmee: "ArmeeFloods",
      lanceurFlood: "ArmeeFloods",
      membresMoi: "Affichage",
      chatSmileysAlliance: "Affichage",
      rappelExport: "Chasseur",
      lanceurChasse: "Chasseur",
      convoisSuiviLignes: "Grenier",
    });
  });

  test("chaque réglage de la liste dans son onglet", () => {
    construire();
    const dans = (id: string) =>
      lire<string[]>(`$("#o_tabsParametre${id}").find("[id]").map((i, e) => e.id).get()`);
    expect(dans("Options")).toEqual(
      expect.arrayContaining(["alertePonte", "role", "affectationRessource", "o_majFzzz"]),
    );
    expect(dans("ArmeeFloods")).toEqual(
      expect.arrayContaining([
        "replacerArmeeAuto",
        "uniteAntisondeTerrain",
        "uniteAntisondeDome",
        "methodeFlood",
        "floodAttaques",
        "degressifBase",
        "degressifRegle",
        "floodImpactAuto",
        "o_gardeesDefaut",
        "sondeUnite",
        "sondeQuantite",
        "sondeLieu",
      ]),
    );
    expect(dans("Affichage")).toContain("vueMembres");
    expect(dans("Chasseur")).toEqual(expect.arrayContaining(["tdcArriveeMax", "ratioPlancher"]));
    expect(dans("Grenier")).toEqual(
      expect.arrayContaining(["o_ouafCode", "o_ouafCodeEnregistrer"]),
    );
    expect(dans("Partage")).toEqual(
      expect.arrayContaining(["o_partageEnvoyer", "o_partageChasses"]),
    );
    expect(lire(`$("#o_tabsParametrePartage .o_exporterRapports").length`)).toBe(2);
    // une case changée est gardée : « 1 » cochée, « 0 » décochée
    lire(`$("input[data-affichage='messagerieCopie']").prop("checked", true).trigger("change")`);
    lire(`$("input[data-affichage='horloge']").prop("checked", false).trigger("change")`);
    expect(
      lire(
        `[localStorage.getItem("fzzz_affichage_messagerieCopie"), localStorage.getItem("fzzz_affichage_horloge")]`,
      ),
    ).toEqual(["1", "0"]);
    expect(lire(`$("#o_tabsParametreApropos #o_resetParametres").length`)).toBe(1);
    expect(lire(`$("#o_boiteParametre").text()`)).not.toContain("Rétablir l'affichage d'origine");
  });
});

describe("onglet « Pages » : où l'extension agit", () => {
  test("une case par page modifiée par l'extension, la même liste que bootstrap.js", () => {
    const bootstrap = readFileSync(
        join(import.meta.dir, "..", "public", "js", "bootstrap.js"),
        "utf8",
      ),
      pages = new Set(
        [
          ...bootstrap.match(/const ONGLET_PAGE = \[([\s\S]*?)\n  \];/)![1]!.matchAll(/, "(\w+)"/g),
        ].map((m) => m[1]!),
      );
    expect([...pages, "General"].sort()).toEqual(
      lire<string[]>(`PAGES_EXTENSION.map((p) => p.id).sort()`),
    );
  });

  test("cochées par défaut ; décochée : la page reste au jeu (même clé qu'avant), recochée : l'extension revient", () => {
    // un « Rétablir l'affichage d'origine » coché avant reste valable
    construire({ fzzz_origine_Reine: "1" });
    const cochees = () =>
      lire<Record<string, boolean>>(
        `Object.fromEntries($("#o_tabsParametrePages input[data-page]").map((i, c) => [[c.dataset.page, c.checked]]).get())`,
      );
    expect(Object.keys(cochees()).length).toBe(lire(`PAGES_EXTENSION.length`));
    expect(Object.entries(cochees()).filter(([, c]) => !c)).toEqual([["Reine", false]]);
    lire(
      `$("#o_tabsParametrePages input[data-page='Messagerie']").prop("checked", false).trigger("change")`,
    );
    expect(lire(`localStorage.getItem("fzzz_origine_Messagerie")`)).toBe("1");
    expect(lire(`Utils.origine("Messagerie")`)).toBe(true);
    lire(
      `$("#o_tabsParametrePages input[data-page='Reine']").prop("checked", true).trigger("change")`,
    );
    expect(lire(`localStorage.getItem("fzzz_origine_Reine")`)).toBeNull();
  });
});

describe("réglages qui ne sont plus modifiables : valeur par défaut", () => {
  test("le choix enregistré d'un affichage sans case est oublié au chargement, celui d'un réglable gardé", () => {
    lire(`(() => {
      localStorage.clear();
      ["armeeHof", "radar", "messagerieRanger", "horloge"].forEach((c) => localStorage.setItem("fzzz_affichage_" + c, "0"));
      localStorage.setItem("fzzz_affichage_messagerieCopie", "1");
      localStorage.setItem("fzzz_autre", "0");
      Utils.oublierAffichagesFixes();
    })()`);
    expect(
      lire(
        `["armeeHof", "radar", "messagerieRanger", "horloge", "messagerieCopie", "messagerieAnalyse"].map((c) => Utils.affichage(c))`,
      ),
    ).toEqual([true, true, false, false, true, false]);
    expect(
      lire(`[localStorage.getItem("fzzz_affichage_armeeHof"), localStorage.getItem("fzzz_autre")]`),
    ).toEqual([null, "0"]);
  });
});

describe("bootstrap.js : les cases de la messagerie décochées par défaut, dès le chargement", () => {
  const classes = (stockage: Record<string, string>) =>
    creerPage(
      ["js/bootstrap.js"],
      `Object.entries(${JSON.stringify(stockage)}).forEach(([k, v]) => localStorage.setItem(k, v));`,
    ).lire<boolean[]>(
      `["messagerieCompacte", "messagerieNonLus", "styleFormulaires"].map((c) => document.documentElement.classList.contains("o_sans_" + c))`,
    );

  test("rien d'enregistré : liste compacte et pastille coupées, style des champs gardé", () => {
    expect(classes({})).toEqual([true, true, false]);
  });

  test("case cochée par le joueur : la règle reste", () => {
    expect(classes({ fzzz_affichage_messagerieCompacte: "1" })).toEqual([false, true, false]);
  });
});

describe("boutons d'export des Préférences : la liste donnée remplace celle de la page", () => {
  test("rappel d'export en cours : « Exporter mes chasses » des Préférences encadré", () => {
    construire();
    expect(lire(`$(".o_exporterRapports.o_synchroPret").length`)).toBe(0);
    lire(
      `(() => { let vrai = RappelExport.aRappeler; RappelExport.aRappeler = () => true; $("#o_tabsParametrePartage").empty(); boite.ongletPartage(); RappelExport.aRappeler = vrai; })()`,
    );
    expect(
      lire(`$(".o_exporterRapports.o_synchroPret").map((i, b) => b.dataset.quoi).get()`),
    ).toEqual(["chasse"]);
  });

  test("ExportRapports.exporter lit les conversations rendues par `lister`", async () => {
    const lu = await lire<Promise<any>>(`(() => {
      let vu = null;
      monProfil = { pseudo: "Moi" };
      ExportRapports.cible = () => Promise.resolve({ url: "https://script.google.com/macros/s/x/exec", alliance: true });
      ExportRapports.aLire = (type, listees) => { vu = [type, listees]; return Promise.resolve({ aLire: [], connues: 0, absentes: 0 }); };
      ExportRapports._exporterListees = () => Promise.resolve();
      document.body.innerHTML = "";
      return ExportRapports.exporter("combat", null, () => Promise.resolve([{ id: 7 }])).then(() => vu);
    })()`);
    expect(lu).toEqual(["combat", [{ id: 7 }]]);
  });
});
