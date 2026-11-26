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
    "js/class/EnvoiJournal.js",
    "js/class/ProfilConvois.js",
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

describe("Partage de données : case « Sans config alliance » (demande du mainteneur, 26/11/2026)", () => {
  test("dans « Fonctionnement sur les autres serveurs », décochée par défaut, gardée par serveur ; cochée : « Relire les réglages » bloqué", () => {
    construire();
    const $case = `$("#o_tabsParametrePartage #o_sansConfigAlliance")`;
    expect(lire(`${$case}.closest(".o_sectionParam").find(".o_titreParam").text()`)).toBe(
      "Fonctionnement sur les autres serveurs",
    );
    expect(lire(`${$case}.closest("label").text().trim()`)).toStartWith(
      "Sans config alliance sur ce serveur (",
    );
    expect(lire(`[${$case}.prop("checked"), $(".o_reglagesRelire").prop("disabled")]`)).toEqual([
      false,
      false,
    ]);
    lire(`${$case}.prop("checked", true).trigger("change")`);
    expect(
      lire(
        `[localStorage.getItem("fzzz_sansConfigAlliance"), $(".o_reglagesRelire").prop("disabled")]`,
      ),
    ).toEqual(["1", true]);
    expect(lire<string>(`$("#o_reglagesEtat").text()`)).toContain(
      "« Sans config alliance » cochée",
    );
    construire({ fzzz_sansConfigAlliance: "1" });
    expect(lire(`${$case}.prop("checked")`)).toBe(true);
    lire(`${$case}.prop("checked", false).trigger("change")`);
    expect(lire(`localStorage.getItem("fzzz_sansConfigAlliance")`)).toBeNull();
  });
});

describe("Général : « Journal de débug » (demande du mainteneur, 20/11/2026)", () => {
  test("Partage de données : envoi du journal les jours avec une erreur, case cochée par défaut", () => {
    construire();
    const $case = `$("#o_tabsParametrePartage #o_partageJournal")`;
    expect(lire(`${$case}.closest(".o_sectionParam").find(".o_titreParam").text()`)).toBe(
      "Journal de débug",
    );
    expect(lire(`${$case}.prop("checked")`)).toBe(true);
    lire(`${$case}.prop("checked", false).trigger("change")`);
    expect(lire(`localStorage.getItem("fzzz_partage_journal")`)).toBe("0");
    construire({ fzzz_partage_journal: "0" });
    expect(lire(`${$case}.prop("checked")`)).toBe(false);
    // l'aide du bouton de copie dit que le journal part, et où le décocher
    const aide = lire<string>(
      `$("#o_copierJournal").closest(".o_sectionParam").find(".o_aideParam").html()`,
    );
    expect(aide).toContain("Google Sheet des stats membres");
    expect(aide).toContain('data-onglet="Partage"');
    expect(aide).not.toContain("Rien n'est envoyé");
  });

  test("un bouton copie tout le journal, sans le montrer ; pour tous les joueurs", async () => {
    construire();
    lire(
      `Journal.installer(); Journal.erreur("Export", "échec de l'envoi", "statut 500"); Journal.info("Forum", "lu")`,
    );
    const $section = `$("#o_copierJournal").closest(".o_sectionParam")`;
    expect(lire(`${$section}.find(".o_titreParam").text()`)).toBe("Journal de débug");
    expect(lire(`$("#o_copierJournal").text()`)).toBe("Copier le journal de débug");
    // le journal n'est pas affiché : ni ses entrées ni une liste
    expect(lire<string>(`${$section}.text()`)).not.toContain("échec de l'envoi");
    expect(lire(`${$section}.find("textarea, ul, .o_journalListe").length`)).toBe(0);
    lire(`window.COPIE = null; Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: (t) => { COPIE = t; return Promise.resolve(); } } });
      $("#o_copierJournal").trigger("click")`);
    await lire(`new Promise((r) => setTimeout(r, 0))`);
    expect(lire<string>(`COPIE`)).toBe(lire<string>(`Journal.texte()`));
    expect(lire<string>(`COPIE`)).toContain("échec de l'envoi");
    expect(lire(`$("#o_copierJournalEtat").text()`)).toBe(
      "Journal copié (2 entrées) : colle-le dans ton message.",
    );
    // trouvé par la recherche des Préférences
    expect(lire<string[]>(`boite.chercher("debug").map((r) => r.section)`)).toContain(
      "Journal de débug",
    );
  });
});

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

  test("Convois : marques cumulables du Récapitulatif dans leur section", () => {
    construire();
    const section = (selecteur: string) =>
      lire<string>(
        `$("#o_tabsParametreConvois ${selecteur}").closest(".o_sectionParam").find(".o_titreParam").text()`,
      );
    expect(
      lire<string[]>(
        `$("#o_tabsParametreConvois input[data-affichage^='convoisSansReception']").map((i, c) => c.dataset.affichage).get()`,
      ),
    ).toEqual(lire<string[]>(`MARQUES_SANS_RECEPTION`));
    for (const cle of lire<string[]>(`MARQUES_SANS_RECEPTION`))
      expect(section(`input[data-affichage='${cle}']`)).toContain(
        "Récapitulatif : joueur qui ne veut pas de convois",
      );
    expect(section("input[data-affichage='convoisSuiviLignes']")).toContain(
      "Suivi des convois de l'alliance",
    );
    // Entrée dans un champ : le formulaire n'est pas envoyé (la page se rechargerait)
    expect(
      lire(`(() => {
        let e = new Event("submit", { bubbles: true, cancelable: true });
        $("#o_tabsParametreConvois form")[0].dispatchEvent(e);
        return e.defaultPrevented;
      })()`),
    ).toBe(true);
  });

  test("textes et sections retirés (demande du mainteneur, 1.143.2), même pour la ligne « Journal » des réglages", () => {
    construire({
      fzzz_reglagesAlliance: JSON.stringify({
        lu: 0,
        section: true,
        sujet: true,
        reglages: { journal: ["Moi"] },
      }),
    });
    lire(`(() => {
      $("body").append("<div id='pseudo'>Moi</div>");
      for (const id of ["General", "Convois", "Partage"]) {
        $("#o_tabsParametre" + id).empty();
        boite["onglet" + id]();
      }
    })()`);
    expect(lire(`Journal.pourCeJoueur()`)).toBe(true);
    const texte = (id: string) => lire<string>(`$("#o_tabsParametre${id}").text()`);
    // le site des réglages est en http : plus d'avertissement
    expect(lire(`OuafSuivi.site().url`)).toStartWith("http:");
    const retires: [string, string][] = [
      ["General", "Les réglages propres à un rôle"],
      ["General", "Le jeu supprime les conversations lues"],
      ["Convois", "n'est pas chiffré"],
      ["Convois", "Test, pour toi seul"],
      ["Convois", "Sur le site de suivi, un joueur peut cocher"],
      ["Partage", "Une fois par jour, à la première page que tu ouvres"],
      ["Partage", "Décochée pour les chefs"],
      ["Partage", "Ranger le forum"],
      ["Partage", "Sujets de floods inutiles"],
    ];
    for (const [id, retire] of retires) expect(texte(id)).not.toContain(retire);
    expect(
      lire(`$("#o_sansReceptionSimule, .o_partageRanger, .o_partageSupprimerFloods").length`),
    ).toBe(0);
    // ce qui reste : le détail replié du Récapitulatif
    expect(texte("Convois")).toContain(
      "Ligne barrée, ligne en rouge, colonne « Statut des stocks »",
    );
  });

  test("chaque réglage de la liste dans son onglet", () => {
    construire();
    const dans = (id: string) =>
      lire<string[]>(`$("#o_tabsParametre${id}").find("[id]").map((i, e) => e.id).get()`);
    expect(dans("General")).toEqual(
      expect.arrayContaining(["alertePonte", "role", "o_majFzzz", "o_copierJournal"]),
    );
    expect(dans("Ressources")).toEqual(
      expect.arrayContaining([
        "affectationRessource",
        "tdcArriveeMax",
        "ratioPlancher",
        "alerteFloods",
      ]),
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
    // une case par information du partage des stats (un seul niveau depuis 1.148.0)
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
    // le réglage d'abord, puis la section dont l'aide a les deux mots (unités de la CdF, « ni envoyé »)
    expect(resultats("UNITÉ envoyé")).toEqual([
      "Attaque › Sonder › Unité envoyée en sonde",
      "Partage de données › Statistiques des membres",
    ]);
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
    // convois : suivi, Récapitulatif (joueur qui ne veut pas de convois), convoi avant la récolte
    expect(lire<number>(`$("#o_tabsParametre .o_etiquetteRole[data-role='Grenier']").length`)).toBe(
      3,
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
