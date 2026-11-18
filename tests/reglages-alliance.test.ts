import { beforeEach, describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Réglages de l'alliance (ReglagesAlliance, 18/11/2026) : rien de l'alliance
 * n'est écrit dans le code ; un chef note dans le premier message du sujet
 * caché « Réglages de l'extension » une ligne « Nom : valeur » par réglage
 * (adresses de ses sites et de ses fichiers, listes de joueurs). Lecture
 * gardée dans le navigateur, propre au serveur ; relue au plus une fois par
 * heure à l'ouverture d'une page, jamais sur les pages Armée et d'attaque.
 * Joueurs et adresses inventés.
 */
const page = creerPage(
  [
    "js/lib/jquery-ui_1.12.1.js",
    "js/class/Utils.js",
    "js/class/Parametre.js",
    "js/class/Joueur.js",
    "js/class/ExportRapports.js",
    "js/page/PartageChasses.js",
  ],
  `var METHODE_FLOOD = ["Standard", "Optimisée", "Uniforme", "Dégressive"],
     AFFECTATION_RESSOURCE = [], RATIO_RECOLTE = {}, TOAST_INFO = {};
   var NOM_UNITE = ["Ouvrière", "Jeune Soldate Naine"], NOM_UNITES = ["Ouvrières", "Jeunes Soldates Naines"];
   var VERSION = "1.127.0";
   var heure = 1763450000000;
   var Horloge = { maintenant: () => heure, serveur: () => moment(heure) };
   var monProfil = { pseudo: "Alpha" };`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);
const attendre = () => new Promise((r) => setTimeout(r, 0));

const SHEET_RC = "https://script.google.com/macros/s/AKfycbRcInvente_1/exec";
const SHEET_STATS = "https://script.google.com/macros/s/AKfycbStatsInvente_2/exec";
const SITE = "http://convois.example.org";
// premier message tel que le forum le sert : lignes séparées par <br>,
// adresse changée en lien au texte raccourci
const MESSAGE = [
  `Site de suivi des convois : ${SITE}`,
  `Google Sheet des RC : <a href="${SHEET_RC}">https://script.google.com/macros/s/AKfy...</a>`,
  "Joueurs autorisés à partager des RC : Alpha, Bravo",
  `Google Sheet des stats membres : ${SHEET_STATS}`,
  "Joueurs autorisés à partager des stats membres : Bravo, Echo",
  "Chasseurs : Alpha ; Charlie",
  "Greniers : Delta",
  "Journal : Alpha",
].join("<br/>");

const reglages = (html: string) => lire<any>(`ReglagesAlliance.lire(${JSON.stringify(html)})`);
const texte = (t: string) => lire<any>(`ReglagesAlliance.lireTexte(${JSON.stringify(t)})`);

describe("lecture du premier message", () => {
  beforeEach(() => lire(`PartageChasses._html = (d) => d`));

  test("une ligne par réglage ; adresse d'un lien lue dans son href ; les réponses ignorées", () => {
    const r = reglages(
      `<div class="messageForum">${MESSAGE}</div><div class="messageForum">Journal : Intrus</div>`,
    );
    expect(r).toEqual({
      siteConvois: SITE,
      feuilleRc: SHEET_RC,
      autorisesRc: ["Alpha", "Bravo"],
      feuilleStats: SHEET_STATS,
      autorisesStats: ["Bravo", "Echo"],
      chasseurs: ["Alpha", "Charlie"],
      greniers: ["Delta"],
      journal: ["Alpha"],
      lignes: [
        "siteConvois",
        "feuilleRc",
        "autorisesRc",
        "feuilleStats",
        "autorisesStats",
        "chasseurs",
        "greniers",
        "journal",
      ],
      fichiers: [],
    });
  });

  test("message en blocs titrés, proposé au mainteneur le 18/11/2026 : tout est lu, titres et consigne ignorés", () => {
    // tel que le forum le sert (lignes séparées par <br>), pseudos et adresses inventés
    const r = reglages(
      `<div class="messageForum">${[
        "RÉGLAGES DE L'EXTENSION OUAF",
        "Ne rien répondre dans ce sujet. Ne changer que ce qui suit les deux-points, et garder une ligne vide avant chaque titre.",
        "",
        "===== CONVOIS =====",
        `Site de suivi des convois : ${SITE}`,
        "",
        "===== RAPPORTS DE COMBAT (RC) =====",
        `Google Sheet des RC : ${SHEET_RC}`,
        "Joueurs autorisés à partager des RC : Alpha, Bravo, Charlie",
        "",
        "===== STATS MEMBRES =====",
        `Google Sheet des stats membres : ${SHEET_STATS}`,
        "Joueurs autorisés à partager des stats membres : Alpha, Charlie",
        "",
        "===== RÔLES PAR DÉFAUT =====",
        "Chasseurs : Alpha, Delta",
        "Greniers : Bravo, Echo",
        "",
        "===== JOURNAL DE L'EXTENSION =====",
        "Journal : Alpha",
      ].join("<br/>")}</div>`,
    );
    expect(r).toEqual({
      siteConvois: SITE,
      feuilleRc: SHEET_RC,
      autorisesRc: ["Alpha", "Bravo", "Charlie"],
      feuilleStats: SHEET_STATS,
      autorisesStats: ["Alpha", "Charlie"],
      chasseurs: ["Alpha", "Delta"],
      greniers: ["Bravo", "Echo"],
      journal: ["Alpha"],
      lignes: [
        "siteConvois",
        "feuilleRc",
        "autorisesRc",
        "feuilleStats",
        "autorisesStats",
        "chasseurs",
        "greniers",
        "journal",
      ],
      fichiers: [],
    });
  });

  test("adresse du fichier (docs.google.com) au lieu de celle de son script : ligne non lue, et dite à corriger (erreur du 18/11/2026)", async () => {
    const r = texte(
      [
        "Google Sheet des RC : https://docs.google.com/spreadsheets/d/FichierInvente1/edit?usp=sharing",
        "Joueurs autorisés à partager des RC : Alpha",
        "Google Sheet des stats membres :https://docs.google.com/spreadsheets/d/FichierInvente2/edit?usp=sharing",
      ].join("\n"),
    );
    expect([r.feuilleRc, r.feuilleStats, r.fichiers, r.autorisesRc]).toEqual([
      "",
      "",
      ["feuilleRc", "feuilleStats"],
      ["Alpha"],
    ]);
    // une ligne au nom différent garde le lien du fichier pour les membres
    expect(
      texte("Fichier des RC à consulter : https://docs.google.com/spreadsheets/d/F/edit").fichiers,
    ).toEqual([]);
    // dernière lecture gardée de ce sujet
    lire(`localStorage.setItem("fzzz_reglagesAlliance", JSON.stringify({ lu: heure, version: VERSION, alliance: "", section: true, sujet: true,
      reglages: { ...ReglagesAlliance.vides(), autorisesRc: ["Alpha"], fichiers: ["feuilleRc", "feuilleStats"] } }))`);
    expect(lire(`ReglagesAlliance.fichier("feuilleRc")`)).toBe(true);
    expect(lire<string>(`ReglagesAlliance.resume()`)).toContain(
      "Google Sheet des RC à corriger : adresse du fichier au lieu de celle de son script (…/exec) (1 joueur(s) autorisé(s)) ; Google Sheet des stats membres à corriger",
    );
    expect(lire<string>(`ExportRapports.sansAdresse(true)`)).toBe(
      "la ligne « Google Sheet des RC » du sujet « Réglages de l'extension » donne l'adresse du fichier (docs.google.com) au lieu de celle de son script, qui finit par /exec (dans le fichier : Extensions → Apps Script → Déployer → Gérer les déploiements)",
    );
    // lecture d'une version d'avant (sans « fichiers ») : rien à corriger signalé
    lire(
      `(() => { let g = JSON.parse(localStorage.getItem("fzzz_reglagesAlliance")); delete g.reglages.fichiers; localStorage.setItem("fzzz_reglagesAlliance", JSON.stringify(g)); })()`,
    );
    expect(lire(`ReglagesAlliance.fichier("feuilleRc")`)).toBe(false);
    lire(`localStorage.clear()`);
  });

  test("noms sans tenir compte de la casse, des accents ni des espaces ; lignes inconnues ignorées", () => {
    const r = texte(
      "Bienvenue : NE RIEN RÉPONDRE ICI\n  JOUEURS AUTORISES A PARTAGER DES RC   :   Alpha\nchasseurs: bravo\nCouleur préférée : bleu",
    );
    expect([r.autorisesRc, r.chasseurs, r.lignes]).toEqual([
      ["Alpha"],
      ["bravo"],
      ["autorisesRc", "chasseurs"],
    ]);
  });

  test("liste : virgules, points-virgules ou espaces ; suite sur les lignes suivantes jusqu'à une ligne vide ou un autre réglage", () => {
    const r = texte(
      "Chasseurs :\nAlpha, Bravo ;Charlie\nDelta.\n\nMerci de ne rien répondre\nGreniers : Echo\nFoxtrot\nJournal : Golf",
    );
    expect(r.chasseurs).toEqual(["Alpha", "Bravo", "Charlie", "Delta"]);
    expect(r.greniers).toEqual(["Echo", "Foxtrot"]);
    expect(r.journal).toEqual(["Golf"]);
  });

  test("doublons retirés (casse ignorée), mise en forme du forum ignorée", () => {
    const r = reglages(
      `<div class="messageForum">Greniers : Alpha, <b>alpha</b>, <i>Bravo</i></div>`,
    );
    expect(r.greniers).toEqual(["Alpha", "Bravo"]);
  });

  test("Google Sheet : seulement une adresse de script Google ; adresse sur la ligne suivante acceptée", () => {
    expect(texte("Google Sheet des RC : https://evil.example/macros/s/AKfy/exec").feuilleRc).toBe(
      "",
    );
    expect(texte(`Google Sheet des RC :\n${SHEET_RC}`).feuilleRc).toBe(SHEET_RC);
    // ligne présente sans adresse lisible : notée, valeur vide
    const r = texte("Google Sheet des stats membres : bientôt");
    expect([r.feuilleStats, r.lignes]).toEqual(["", ["feuilleStats"]]);
  });

  test("site de suivi : adresse http ou https seulement, la première de la ligne", () => {
    expect(texte("Site de suivi des convois : javascript:alert(1)").siteConvois).toBe("");
    expect(texte("Site de suivi des convois : ftp://convois.example.org").siteConvois).toBe("");
    expect(
      texte(
        "Site de suivi des convois : https://convois.example.org/suivi, ou http://autre.example",
      ).siteConvois,
    ).toBe("https://convois.example.org/suivi");
  });
});

// forum simulé : section cachée et sujets {id, titre, messages}
function forum(sujets: { id: string; titre: string; messages: string[] }[], section = true) {
  lire(`(() => {
    window.FORUM = { section: ${section}, sujets: ${JSON.stringify(sujets)}, appels: [], echoue: false };
    PartageChasses.idSection = null;
    PartageChasses.oublierCache();
    PartageChasses._html = (d) => d;
    PartageChasses._xajax = (f, args, options) => {
      FORUM.appels.push([args ? f + " " + args : f, !!(options && options.fond)]);
      if (FORUM.echoue) return Promise.reject(new Error("forum"));
      if (f == "callGetForum" && !args)
        return Promise.resolve(FORUM.section ? '<span class="forum7">BDD partagée cachée</span>' : '<span class="forum2">Général</span>');
      if (f == "callGetForum")
        return Promise.resolve('<form id="form_cat"><table>' + FORUM.sujets.map((s) => '<tr><td><input name="topic[]" value="' + s.id + '"/></td><td>' + s.titre + '</td></tr>').join("") + "</table></form>");
      const s = FORUM.sujets.find((s) => s.id == args);
      return Promise.resolve(s ? s.messages.map((m) => '<div class="messageForum">' + m + "</div>").join("") : "");
    };
  })()`);
}
const appels = () => lire<[string, boolean][]>(`FORUM.appels.slice()`);
const charger = (lecture = "garde") =>
  lire<Promise<any>>(`ReglagesAlliance.charger({}, ${JSON.stringify(lecture)})`);
const SUJET = { id: "40", titre: "Réglages de l'extension", messages: [MESSAGE] };

beforeEach(() => {
  lire(`(() => {
    localStorage.clear();
    heure = 1763450000000;
    history.replaceState(null, "", "/Ressources.php");
    document.body.innerHTML = "<span id='tag_alliance'>TAG</span>";
    window.NOTES = [];
    Journal.info = (source, message, detail) => NOTES.push([source, message, detail]);
  })()`);
  forum([{ id: "4", titre: "GIF de l'alliance", messages: ["x"] }, SUJET]);
});

describe("lecture dans le forum, gardée dans le navigateur", () => {
  test("liste des sujets puis le sujet ; lecture gardée et réutilisée moins d'une minute", async () => {
    const r = await charger();
    expect([r.section, r.sujet, r.reglages.chasseurs]).toEqual([true, true, ["Alpha", "Charlie"]]);
    expect(appels().map(([a]) => a)).toEqual(["callGetForum", "callGetForum 7", "callGetTopic 40"]);
    expect(lire(`ReglagesAlliance.garde()`)).toMatchObject({
      lu: 1763450000000,
      version: "1.127.0",
      section: true,
      sujet: true,
    });
    lire(`heure += 50000`);
    await charger();
    expect(appels()).toHaveLength(3);
    // clic d'un export : sujet relu, liste des sujets de la minute écoulée
    await charger("sujet");
    expect(
      appels()
        .slice(3)
        .map(([a]) => a),
    ).toEqual(["callGetTopic 40"]);
    // au-delà d'une minute, ou bouton « Relire les réglages » : relue, la
    // section trouvée restant connue pendant la page
    lire(`heure += 61000; PartageChasses.oublierCache()`);
    await charger();
    await charger("tout");
    expect(
      appels()
        .slice(4)
        .map(([a]) => a),
    ).toEqual(["callGetForum 7", "callGetTopic 40", "callGetForum 7", "callGetTopic 40"]);
  });

  test("gardée par une autre version du script : relue", async () => {
    await charger();
    lire(`(() => {
      let g = JSON.parse(localStorage.getItem("fzzz_reglagesAlliance"));
      g.version = "1.126.0";
      localStorage.setItem("fzzz_reglagesAlliance", JSON.stringify(g));
      FORUM.appels = [];
      PartageChasses.oublierCache();
    })()`);
    await charger();
    expect(appels().map(([a]) => a)).toContain("callGetTopic 40");
  });

  test("sujet créé deux fois : le plus ancien fait foi ; titre écrit à la main (casse, apostrophe typographique)", async () => {
    forum([
      { id: "52", titre: "Réglages de l'extension", messages: ["Chasseurs : Intrus"] },
      { id: "41", titre: "  réglages de l’Extension ", messages: ["Chasseurs : Bravo"] },
    ]);
    expect((await charger()).reglages.chasseurs).toEqual(["Bravo"]);
  });

  test("section cachée absente ou invisible pour le grade, ou sujet absent : réglages vides, gardés, pas une panne", async () => {
    forum([SUJET], false);
    expect(await charger()).toMatchObject({
      section: false,
      sujet: false,
      reglages: { chasseurs: [] },
    });
    lire(`localStorage.clear()`);
    forum([{ id: "4", titre: "GIF de l'alliance", messages: ["x"] }]);
    expect(await charger()).toMatchObject({ section: true, sujet: false });
    expect(lire(`ReglagesAlliance.garde().sujet`)).toBe(false);
  });

  test("section déjà lue pour cette alliance, absente d'une réponse du forum : une panne, les réglages restent", async () => {
    await charger();
    lire(
      `FORUM.section = false; heure += 120000; PartageChasses.idSection = null; PartageChasses.oublierCache()`,
    );
    expect(
      await charger().then(
        () => "lu",
        (e: Error) => e.message,
      ),
    ).toBe("section cachée introuvable");
    expect(lire(`ReglagesAlliance.reglages().chasseurs`)).toEqual(["Alpha", "Charlie"]);
    // jamais trouvée pour cette alliance : pas une panne, réglages vides
    lire(`localStorage.clear()`);
    expect(await charger()).toMatchObject({ section: false, sujet: false });
  });

  test("lecture faite pour une autre alliance (le joueur en a changé) : ignorée", async () => {
    await charger();
    expect(lire(`ReglagesAlliance.garde().alliance`)).toBe("TAG");
    lire(`$("#tag_alliance").text("AUTRE")`);
    expect(lire(`ReglagesAlliance.garde()`)).toBeNull();
    expect(lire(`ReglagesAlliance.contient("chasseurs", "Alpha")`)).toBe(false);
    lire(`$("#tag_alliance").text("tag")`);
    expect(lire(`ReglagesAlliance.contient("chasseurs", "Alpha")`)).toBe(true);
  });

  test("forum illisible : rejetée, la lecture gardée d'avant reste", async () => {
    await charger();
    lire(`FORUM.echoue = true; heure += 120000; PartageChasses.oublierCache()`);
    expect(
      await charger().then(
        () => "lu",
        (e: Error) => e.message,
      ),
    ).toBe("forum");
    expect(lire(`ReglagesAlliance.reglages().chasseurs`)).toEqual(["Alpha", "Charlie"]);
  });

  test("listes : casse ignorée, rien sans lecture", async () => {
    expect(lire(`ReglagesAlliance.contient("greniers", "Delta")`)).toBe(false);
    await charger();
    expect(lire(`ReglagesAlliance.contient("greniers", " delta ")`)).toBe(true);
    expect(lire(`ReglagesAlliance.contient("greniers", "Delt")`)).toBe(false);
    expect(lire(`ReglagesAlliance.contient("journal", "")`)).toBe(false);
  });
});

describe("relecture à l'ouverture d'une page", () => {
  test("au plus une fois par heure, à la priorité la plus faible ; jamais sur les pages Armée et d'attaque", async () => {
    await lire(`ReglagesAlliance.actualiser()`);
    expect(appels()).toEqual([
      ["callGetForum", true],
      ["callGetForum 7", true],
      ["callGetTopic 40", true],
    ]);
    lire(`FORUM.appels = []; heure += 59 * 60000; PartageChasses.oublierCache()`);
    await lire(`ReglagesAlliance.actualiser()`);
    expect(appels()).toEqual([]);
    lire(`heure += 2 * 60000`);
    for (const adresse of ["/Armee.php", "/ennemie.php?Attaquer=Bravo&lieu=1"]) {
      lire(`history.replaceState(null, "", ${JSON.stringify(adresse)})`);
      await lire(`ReglagesAlliance.actualiser()`);
      expect(appels()).toEqual([]);
    }
    lire(`history.replaceState(null, "", "/construction.php")`);
    await lire(`ReglagesAlliance.actualiser()`);
    expect(appels().map(([a]) => a)).toContain("callGetTopic 40");
  });

  test("joueur sans alliance : pas de forum, rien n'est lu", async () => {
    lire(`$("#tag_alliance").text("")`);
    await lire(`ReglagesAlliance.actualiser()`);
    expect(appels()).toEqual([]);
  });

  test("échec : noté au journal, sans erreur ; pas de nouvel essai avant une heure", async () => {
    lire(`FORUM.echoue = true`);
    await lire(`ReglagesAlliance.actualiser()`);
    expect(lire(`NOTES`)).toEqual([
      ["Réglages de l'alliance", "sujet des réglages non relu", "forum"],
    ]);
    lire(`FORUM.appels = []; heure += 30 * 60000`);
    await lire(`ReglagesAlliance.actualiser()`);
    expect(appels()).toEqual([]);
    lire(`FORUM.echoue = false; heure += 31 * 60000`);
    await lire(`ReglagesAlliance.actualiser()`);
    expect(appels().map(([a]) => a)).toContain("callGetTopic 40");
  });
});

describe("ce qu'en montrent les Préférences", () => {
  test("résumé : jamais les adresses des Google Sheet ; ce qui manque", async () => {
    expect(lire(`ReglagesAlliance.resume()`)).toBe(
      "Réglages de l'alliance pas encore lus dans ce navigateur.",
    );
    await charger();
    lire(`heure += 3 * 60000`);
    const resume = lire<string>(`ReglagesAlliance.resume()`);
    expect(resume).toBe(
      "Lus il y a 3 min : site de suivi des convois convois.example.org ; Google Sheet des RC renseigné (2 joueur(s) autorisé(s)) ; Google Sheet des stats membres renseigné (2 joueur(s) autorisé(s)) ; 2 chasseur(s), 1 grenier(s), 1 au journal.",
    );
    expect(resume).not.toContain("script.google.com");
    lire(`localStorage.clear()`);
    forum([], false);
    await charger();
    expect(lire(`ReglagesAlliance.resume()`)).toBe(
      "Lus à l'instant : section cachée « BDD partagée cachée » introuvable ou invisible pour ton grade.",
    );
    lire(`localStorage.clear()`);
    forum([]);
    await charger();
    expect(lire(`ReglagesAlliance.resume()`)).toBe(
      "Lus à l'instant : pas de sujet « Réglages de l'extension » dans la section cachée.",
    );
  });
});

describe("greniers de la liste : rôle et réglages des greniers, une fois par navigateur", () => {
  // réglages de l'alliance déjà lus, puis page ouverte par ce pseudo
  const ouvrir = (pseudo: string, enregistres: Record<string, unknown> | null = null) =>
    lire<any>(`(() => {
      localStorage.setItem("fzzz_reglagesAlliance", JSON.stringify({ lu: 0, section: true, sujet: true, reglages: { greniers: ["Delta"], chasseurs: ["Alpha"] } }));
      localStorage.setItem("fzzz_reserveEnPlus", "1");
      localStorage.setItem("fzzz_methodeDegressive", "1");
      ${enregistres ? `localStorage.setItem("outiiil_parametre", ${JSON.stringify(JSON.stringify(enregistres))});` : ""}
      let p = new Joueur({ pseudo: ${JSON.stringify(pseudo)} }).getParametre().parametre;
      return { role: parseInt(p.role.valeur), cases: ["floodImpactAuto", "replacerArmeeAuto", "convoisAvantRecolte"].map((c) => p[c].valeur) };
    })()`);
  const affichages = () =>
    lire<Record<string, boolean>>(
      `Object.fromEntries(Object.keys(AFFICHAGES_REGLABLES).map((c) => [c, Utils.affichageCoche(c)]))`,
    );

  test("tout coché sauf la liste du mainteneur ; rôle Grenier", () => {
    lire(`localStorage.clear()`);
    expect(ouvrir("delta")).toEqual({ role: 2, cases: [true, true, true] });
    const a = affichages(),
      decoches = Object.keys(a).filter((c) => !a[c]);
    expect(decoches.sort()).toEqual(
      [
        "messagerieRanger",
        "messagerieCompacte",
        "messagerieNonLus",
        "messagerieCouleurs",
        "messagerieCopie",
        "messagerieAnalyse",
        "messagerieExport",
        "membresFloodsRang",
        "membresFloodsProchain",
        "membresFloodsVariation",
        "membresFloodsTrajet",
        "membresFloodsRetour",
        "membresFloodsEtat",
        "lanceurChasse",
      ].sort(),
    );
    // chaque clé de la liste est bien un affichage réglable
    expect(lire(`GRENIER_DECOCHES.every((c) => c in AFFICHAGES_REGLABLES)`)).toBe(true);
    // seuls les affichages qui changent de leur état par défaut sont écrits
    expect(lire(`localStorage.getItem("fzzz_affichage_lanceurChasse")`)).toBe("0");
    expect(lire(`localStorage.getItem("fzzz_affichage_membresFloodsRang")`)).toBeNull();
  });

  test("une seule fois : ce que le grenier change ensuite reste ; une case déjà réglée par lui garde son choix", () => {
    lire(`localStorage.clear(); localStorage.setItem("fzzz_affichage_lanceurChasse", "1")`);
    ouvrir("Delta", { role: 0, floodImpactAuto: false });
    expect(affichages().lanceurChasse).toBe(true);
    expect(lire(`localStorage.getItem("fzzz_profilGrenier")`)).toBe("1");
    // il décoche ensuite un réglage et choisit « Aucun » : rien n'est reposé
    expect(ouvrir("Delta", { role: 0, floodImpactAuto: false })).toEqual({
      role: 0,
      cases: [false, false, false],
    });
  });

  test("Passeur ou Chasseur déjà choisi : rôle gardé ; joueur hors liste : rien", () => {
    lire(`localStorage.clear()`);
    expect(ouvrir("Delta", { role: 1 }).role).toBe(1);
    lire(`localStorage.clear()`);
    expect(ouvrir("Echo")).toEqual({ role: 0, cases: [false, false, false] });
    expect(lire(`localStorage.getItem("fzzz_profilGrenier")`)).toBeNull();
    expect(affichages().lanceurChasse).toBe(true);
  });
});

describe("journal : joueurs de la ligne « Journal »", () => {
  test("lecture gardée de ce serveur", async () => {
    expect(lire(`Journal.pourCeJoueur("Alpha")`)).toBe(false);
    await charger();
    await attendre();
    expect(lire(`Journal.pourCeJoueur("alpha")`)).toBe(true);
    expect(lire(`Journal.pourCeJoueur("Bravo")`)).toBe(false);
  });
});
