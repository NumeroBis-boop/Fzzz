import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { creerPage } from "./harnais";

/**
 * Préférences de la liste du mainteneur (14/11/2026), rangées par page du jeu
 * (réorganisation approuvée le 14/11/2026) : « Général », un onglet par page
 * dans l'ordre du menu du jeu, « Partage de données », les pages où
 * l'extension agit (une case chacune) et « À propos ».
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
   var NOM_UNITE = ["Ouvrière", "Jeune Soldate Naine"], VERSION = "1.111.0";
   // site de suivi des convois donné par les réglages de l'alliance, accepté par le joueur
   var OuafSuivi = {
     site: () => ({ url: "http://convois.invalid/", origine: "http://convois.invalid", hote: "convois.invalid" }),
     siteAccepte: () => Promise.resolve(true),
     accepterSite: () => Promise.resolve(),
     codeEnregistre: () => Promise.resolve(""),
     enregistrerCode: () => Promise.resolve(),
   };
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
    boite.construireOnglets();
    boite.event();
  })()`);
}

describe("onglets de la liste du mainteneur", () => {
  test("Général, les pages du jeu dans l'ordre de son menu, Partage de données, Pages et À propos", () => {
    expect(lire(`ONGLETS_PARAMETRE.map((o) => o.titre)`)).toEqual([
      "Général",
      "Ressources",
      "Armée",
      "Attaque",
      "Convois",
      "Messagerie",
      "Alliance",
      "Partage de données",
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
      "messagerieRanger",
      "messagerieCompacte",
      "messagerieNonLus",
      "messagerieCouleurs",
      "messagerieCopie",
      "messagerieAnalyse",
      "messagerieExport",
      "messagerieMiseEnForme",
      "membresFloodsRang",
      "membresFloodsProchain",
      "membresFloodsVariation",
      "membresFloodsTrajet",
      "membresFloodsRetour",
      "membresFloodsEtat",
    ]);
    expect(Object.fromEntries(cases.map((c) => [c[1], c[0]]))).toMatchObject({
      horloge: "General",
      nouveautes: "General",
      remplissageEntrepots: "Ressources",
      bilanRecolte: "Ressources",
      affectationOuvrieres: "Ressources",
      lanceurChasse: "Ressources",
      armeeMiseEnPage: "Armee",
      replacerArmee: "Armee",
      listeAttaques: "Armee",
      couleurAttaquer: "Attaque",
      lanceurFlood: "Attaque",
      convoisSuiviLignes: "Convois",
      messagerieExport: "Messagerie",
      membresMoi: "Alliance",
      membresFloodsRang: "Alliance",
      membresFloodsTrajet: "Alliance",
      membresFloodsEtat: "Alliance",
      membresFloodsRetour: "Alliance",
      chatSmileysAlliance: "Alliance",
      forumGif: "Alliance",
      rappelExport: "Partage",
    });
    // chaque case dans l'onglet qui la déclare
    expect(
      cases.filter(
        ([onglet, cle]) =>
          !lire<string[]>(`ONGLETS_PARAMETRE.find((o) => o.id == "${onglet}").affichages`).includes(
            cle,
          ),
      ),
    ).toEqual([]);
  });

  test("chaque réglage de la liste dans son onglet", () => {
    construire();
    const dans = (id: string) =>
      lire<string[]>(`$("#o_tabsParametre${id}").find("[id]").map((i, e) => e.id).get()`);
    expect(dans("General")).toEqual(expect.arrayContaining(["alertePonte", "role", "o_majFzzz"]));
    expect(dans("Ressources")).toEqual(
      expect.arrayContaining(["affectationRessource", "tdcArriveeMax", "ratioPlancher"]),
    );
    expect(dans("Armee")).toEqual(
      expect.arrayContaining(["replacerArmeeAuto", "uniteAntisondeTerrain", "uniteAntisondeDome"]),
    );
    expect(dans("Attaque")).toEqual(
      expect.arrayContaining([
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
    expect(dans("Alliance")).toContain("vueMembres");
    // colonnes de la vue « Floods et chasses en cours » : dans l'ordre de la liste du mainteneur
    expect(
      lire<string[]>(
        `$("#o_tabsParametreAlliance input[data-affichage^='membresFloods']").map((i, c) => c.dataset.affichage).get().filter((c) => c != "membresFloods")`,
      ),
    ).toEqual(lire<string[]>(`MEMBRES_COLONNES_FLOODS`));
    expect(lire(`$("#o_tabsParametreAlliance").text()`)).toContain(
      "Colonnes de la vue « Floods et chasses en cours »",
    );
    expect(dans("Convois")).toEqual(
      expect.arrayContaining(["o_ouafCode", "o_ouafCodeEnregistrer", "convoisAvantRecolte"]),
    );
    expect(lire(`$("#convoisAvantRecolte").prop("checked")`)).toBe(false);
    expect(dans("Partage")).toEqual(
      expect.arrayContaining(["o_partageEnvoyer", "o_partageChasses", "o_exportSheetReglage"]),
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

describe("Préférences rangées par page : recherche, renvois, aides", () => {
  test("chaque réglage une seule fois, dans un onglet", () => {
    construire();
    const ids = lire<string[]>(`boite._paramGeneral`);
    expect(
      ids.filter((id) => lire<number>(`$("#o_tabsParametre [id='${id}']").length`) != 1),
    ).toEqual([]);
    expect(lire<number>(`$("#o_tabsParametre input[data-partage]").length`)).toBe(
      lire<number>(`DONNEES_PARTAGEES.length`),
    );
  });

  test("tout renvoi « Préférences → … » des textes de l'extension nomme un onglet qui existe", () => {
    const titres = lire<string[]>(`ONGLETS_PARAMETRE.map((o) => o.titre)`),
      racine = join(import.meta.dir, "..", "public", "js"),
      fichiers = (dossier: string): string[] =>
        readdirSync(dossier, { withFileTypes: true }).flatMap((e) =>
          e.isDirectory()
            ? e.name == "lib"
              ? []
              : fichiers(join(dossier, e.name))
            : e.name.endsWith(".js") && e.name != "Nouveautes.js"
              ? [join(dossier, e.name)]
              : [],
        ),
      faux: string[] = [];
    for (const f of fichiers(racine))
      for (const m of readFileSync(f, "utf8")
        // un renvoi coupé sur deux lignes de commentaire est recollé
        .replace(/\n\s*(?:\*|\/\/)\s*/g, " ")
        .matchAll(/Préférences\s*→\s*([^\n]{0,40})/g))
        if (!titres.some((t) => m[1]!.startsWith(t))) faux.push(`${f.split("/js/")[1]} : ${m[0]}`);
    expect(faux).toEqual([]);
  });

  test("recherche : accents et majuscules ignorés, onglet et section donnés ; un clic ouvre l'onglet", () => {
    construire();
    const resultats = (texte: string) =>
      lire<string[]>(
        `(() => { boite.afficherRecherche(${JSON.stringify(texte)}); return $("#o_rechercheResultats a").map((i, a) => a.textContent).get(); })()`,
      );
    lire(
      `$("#o_boiteParametre").prepend("<input id='o_rechercheParam'/><ul id='o_rechercheResultats' hidden></ul>")`,
    );
    expect(resultats("UNITÉ envoyée")).toEqual(["Attaque › Sonder › Unité envoyée en sonde"]);
    expect(resultats("ratio plancher")).toEqual([
      "Ressources › Lanceur de chasses › Ratio plancher",
    ]);
    // un mot de l'aide seulement : la section
    expect(resultats("Compte+ Nourriture")).toContain("Convois › Convoi avant la récolte");
    expect(resultats("zzz introuvable")).toEqual([]);
    expect(lire(`$("#o_rechercheResultats").text()`)).toBe("Aucun réglage trouvé.");
    expect(lire(`$("#o_rechercheResultats").prop("hidden")`)).toBe(false);
    resultats("");
    expect(lire(`$("#o_rechercheResultats").prop("hidden")`)).toBe(true);
    // clic sur un résultat : son onglet ouvert, la ligne signalée
    resultats("unité envoyée");
    lire(`(() => {
      window.OUVERT = null;
      let vrai = BoiteParametre.ouvrirOnglet;
      BoiteParametre.ouvrirOnglet = (id) => (OUVERT = id);
      $("#o_rechercheResultats a").first().trigger("click");
      BoiteParametre.ouvrirOnglet = vrai;
    })()`);
    expect(lire(`OUVERT`)).toBe("Attaque");
    expect(lire(`$("#sondeUnite").closest(".o_ligneParam").hasClass("o_reglageTrouve")`)).toBe(
      true,
    );
  });

  test("chaque case d'affichage se trouve par son libellé", () => {
    construire();
    const libelles = lire<Record<string, string>>(
        `({ ...AFFICHAGES_FZZZ, ...AFFICHAGES_CONVOIS })`,
      ),
      reglables = lire<string[]>(`Object.keys(AFFICHAGES_REGLABLES)`),
      introuvables = reglables.filter(
        (cle) =>
          !lire<boolean>(
            `boite.chercher(${JSON.stringify(libelles[cle]!.slice(0, 40))}).some((r) => $(r.element).find("input[data-affichage='${cle}']").length)`,
          ),
      );
    expect(introuvables).toEqual([]);
  });

  test("page décochée dans « Pages » : signalée en haut de son onglet, tout de suite", () => {
    construire({ fzzz_origine_Armee: "1" });
    const note = (onglet: string) =>
      lire<string>(`$("#o_tabsParametre${onglet} .o_pageDesactivee:not([hidden])").text()`);
    expect(note("Armee")).toBe(
      "L'extension est désactivée sur : Armée (onglet « Pages ») : ces réglages y sont sans effet.",
    );
    expect(note("Attaque")).toBe("");
    lire(
      `$("#o_tabsParametrePages input[data-page='Chat']").prop("checked", false).trigger("change")`,
    );
    expect(note("Alliance")).toContain("Chats (alliance et général)");
    lire(
      `$("#o_tabsParametrePages input[data-page='General']").prop("checked", false).trigger("change")`,
    );
    expect(note("Convois")).toContain("désactivée sur toutes les pages");
    // le lien ouvre l'onglet « Pages »
    expect(lire(`$("#o_tabsParametreArmee .o_pageDesactivee .o_lienOnglet").data("onglet")`)).toBe(
      "Pages",
    );
  });

  test("étiquettes de rôle : en couleur pour le rôle choisi, suivent le changement", () => {
    construire();
    const miennes = () =>
      lire<string[]>(
        `$("#o_tabsParametre .o_etiquetteRole.o_etiquetteMienne").map((i, e) => e.dataset.role).get()`,
      );
    expect(
      lire<number>(`$("#o_tabsParametre .o_etiquetteRole[data-role='Chasseur']").length`),
    ).toBe(2);
    expect(lire<number>(`$("#o_tabsParametre .o_etiquetteRole[data-role='Grenier']").length`)).toBe(
      2,
    );
    lire(`$("#role").val("3").trigger("change")`);
    expect([...new Set(miennes())]).toEqual(["Chasseur"]);
    lire(`$("#role").val("2").trigger("change")`);
    expect([...new Set(miennes())]).toEqual(["Grenier"]);
  });

  test("aides longues repliées derrière « En savoir plus » ; une seule mention du rechargement", () => {
    construire();
    expect(lire<number>(`$("#o_tabsParametre details.o_aidePlus").length`)).toBeGreaterThan(5);
    expect(lire<string>(`$("#o_tabsParametre").text()`)).not.toContain(
      "au prochain chargement de la page)",
    );
  });

  test("onglet Ressources : remplissage des entrepôts et bilan, deux cases, méthode de calcul repliée", () => {
    construire();
    const section = lire<string[]>(
      `$("#o_tabsParametreRessources input[data-affichage]").map((i, e) => e.dataset.affichage).get()`,
    );
    expect(section).toEqual(expect.arrayContaining(["remplissageEntrepots", "bilanRecolte"]));
    expect(lire<string>(`$("#o_tabsParametreRessources details > summary").last().text()`)).toBe(
      "Méthode de calcul",
    );
    const methode = lire<string>(`$("#o_tabsParametreRessources details").last().text()`);
    expect(methode).toContain("toutes les 30 min");
    expect(methode).toContain("20 % + 1 % par niveau de ton Étable à pucerons");
    // règle du mainteneur, 16/11/2026 : dit dans les Préférences
    expect(methode).toContain(
      "pas compté : le terrain que rapporteront tes chasses et tes floods en cours",
    );
    // demande du mainteneur, 16/11/2026
    expect(methode).toContain("un entrepôt en construction");
    expect(
      lire(`$("#o_tabsParametreGeneral input[data-affichage='remplissageEntrepots']").length`),
    ).toBe(0);
  });

  test("chaque ouverture des Préférences montre l'onglet « Général » (règle du mainteneur, 16/11/2026)", () => {
    const actif = () =>
      lire<string>(`ONGLETS_PARAMETRE[$("#o_tabsParametre").tabs("option", "active")].id`);
    lire(`(() => {
      localStorage.clear();
      // onglet retenu par les versions 1.117.0 à 1.123.0 : ignoré
      localStorage.setItem("fzzz_ongletParametre", "Convois");
      window.monProfil = new Joueur({ pseudo: "Moi" }).getParametre();
      document.body.innerHTML = "";
      window.boite = new BoiteParametre();
      boite.ajusterTaille = () => boite;
      boite.afficher();
    })()`);
    expect(actif()).toBe("General");
    // un autre onglet, la boîte fermée puis rouverte : de nouveau « Général »
    lire(
      `$("#o_tabsParametre").tabs("option", "active", ONGLETS_PARAMETRE.findIndex((o) => o.id == "Convois"))`,
    );
    expect(actif()).toBe("Convois");
    lire(`(() => { boite.masquer(); boite.afficher(); })()`);
    expect(actif()).toBe("General");
    expect(lire(`$("#o_boiteParametre").length`)).toBe(1);
  });

  test("« Réinitialiser » dit ce qu'il remet et ce qu'il garde", () => {
    construire();
    const texte = lire<string>(`$("#o_tabsParametreApropos").text()`);
    expect(texte).toContain("Remet les réglages chiffrés ou à choix à leur valeur par défaut");
    expect(texte).toContain(
      "Les cases d'affichage, de pages et de partage et les couleurs des messages ne changent pas.",
    );
  });
});
