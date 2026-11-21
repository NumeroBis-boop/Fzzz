import { beforeEach, describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { creerPage } from "./harnais";
import { classeurSimule } from "./sheet-simule";

/**
 * Réglages de l'extension de chaque joueur, sur chacun de ses appareils, à
 * l'onglet « Réglages extension » du Google Sheet des stats membres
 * (EnvoiReglages, demande du mainteneur, 20/11/2026 : une ligne par réglage,
 * une colonne par joueur et appareil, une fois par jour, sans case dans les
 * Préférences). Les requêtes vont au vrai script (google-sheet/stats-membres.gs)
 * sur un fichier simulé. Joueurs et adresses inventés.
 */
const page = creerPage(
  [
    "js/lib/jquery-ui_1.12.1.js",
    "js/class/Utils.js",
    "js/class/Parametre.js",
    "js/class/Joueur.js",
    "js/class/ExportRapports.js",
    "js/class/SuiviMembres.js",
    "js/class/EnvoiJournal.js",
    "js/class/ExportAuto.js",
    "js/boite/Boite.js",
    "js/boite/Parametres.js",
    "js/class/EnvoiReglages.js",
  ],
  `var chrome = { runtime: { getManifest: () => ({ version: "1.148.0" }), getURL: (p) => p, sendMessage: (m) => ENVOYER(m) } };
   var METHODE_FLOOD = ["Standard", "Optimisée", "Uniforme", "Dégressive"], AFFECTATION_RESSOURCE = [], RATIO_RECOLTE = {};
   var NOM_UNITE = ["Ouvrière", "Jeune Soldate Naine", "Soldate Naine", "Naine Kamikaze"];
   var VERSION = "1.148.0";
   var heure = moment("2026-11-21 10:00", "YYYY-MM-DD HH:mm").valueOf();
   var Horloge = { maintenant: () => heure, serveur: () => moment(heure) };`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);
const ADRESSE = "https://script.google.com/macros/s/AKfycbInventeReglages123/exec";
const H = 3600000;
const ONGLET = "Réglages extension";

let fichier: ReturnType<typeof classeurSimule>;
let recus: any[];
let panne: boolean;
beforeEach(() => {
  fichier = classeurSimule({}, "Europe/Paris", "stats-membres.gs");
  recus = [];
  panne = false;
  // le background rend la réponse du script, ou « réseau » quand il ne répond pas
  (page.window as any).ENVOYER = (m: any) => {
    recus.push(JSON.parse(JSON.stringify(m.corps)));
    return Promise.resolve(
      panne ? { erreur: "reseau" } : { ok: true, statut: 200, donnees: fichier.doPost(m.corps) },
    );
  };
  lire(`(() => {
    localStorage.clear();
    heure = moment("2026-11-21 10:00", "YYYY-MM-DD HH:mm").valueOf();
    VERSION = "1.148.0";
    history.replaceState(null, "", "/Ressources.php");
    document.body.innerHTML = "<span id='tag_alliance'>OUAF</span>";
    window.monProfil = new Joueur({ pseudo: "Alpha" }).getParametre();
    window.GM_info = { scriptHandler: "Violentmonkey", version: "2.31.0" };
    SuiviMembres.adresse = () => Promise.resolve({ url: ${JSON.stringify(ADRESSE)}, manque: "" });
  })()`);
});
const lancer = () => lire<Promise<string>>(`EnvoiReglages.lancer()`);
const avancer = (ms: number) => lire(`heure += ${ms}`);
const grille = () => fichier.onglets[ONGLET]?.grille || [];
// valeur d'un réglage (par sa clé) dans la colonne d'un appareil
const valeur = (cle: string, colonne: number) =>
  grille().find((l: unknown[]) => l[2] == cle)?.[colonne - 1];

describe("ce qui est envoyé", () => {
  test("une ligne par réglage : appareil, pages, affichages, paramètres, partage ; textes « oui » / « non »", () => {
    lire(`(() => {
      localStorage.setItem("fzzz_origine_Messagerie", "1");
      localStorage.setItem("fzzz_affichage_horloge", "0");
      localStorage.setItem("fzzz_partage_cdf", "0");
      monProfil.parametre.methodeFlood.valeur = 1;
      monProfil.parametre.floodImpactAuto.valeur = true;
      monProfil.parametre.uniteAntisondeDomeType.valeur = 2;
      monProfil.parametre.sondeUnite.valeur = 0;
      monProfil.parametre.degressifBase.valeur = 17.5;
    })()`);
    const v = lire<any[]>(`EnvoiReglages.valeurs()`);
    const par = (cle: string) => v.find((x) => x.cle == cle);
    expect(v.slice(0, 7).map((x) => x.cle)).toEqual([
      "version",
      "script",
      "gestionnaire",
      "navigateur",
      "fenetre",
      "comptePlus",
      "serveur",
    ]);
    expect(par("version")).toEqual({
      groupe: "Appareil",
      cle: "version",
      libelle: "Version de l'extension",
      valeur: "1.148.0",
    });
    expect(par("gestionnaire").valeur).toBe("Violentmonkey 2.31.0");
    expect(par("page.General")).toMatchObject({ libelle: "Toutes les pages", valeur: "oui" });
    expect(par("page.Messagerie")).toMatchObject({ groupe: "Pages", valeur: "non" });
    expect(par("affichage.horloge")).toMatchObject({
      groupe: "Affichages · Général",
      valeur: "non",
    });
    expect(par("affichage.lanceurChasse")).toMatchObject({
      groupe: "Affichages · Ressources",
      valeur: "oui",
    });
    // choix d'une liste : son texte ; unités des listes posées à l'ouverture des Préférences
    expect(par("parametre.methodeFlood")).toMatchObject({
      libelle: "Méthode de flood",
      valeur: "Optimisée",
    });
    expect(par("parametre.floodImpactAuto").valeur).toBe("oui");
    expect(par("parametre.uniteAntisondeDomeType").valeur).toBe("Soldate Naine");
    expect(par("parametre.sondeUnite").valeur).toBe("Jeune Soldate Naine");
    expect(par("parametre.degressifBase").valeur).toBe("17,5");
    expect(par("partage.cdf")).toMatchObject({ groupe: "Partage de données", valeur: "non" });
    expect(par("partage.champignonniere").valeur).toBe("oui");
    expect(par("partage.journal").valeur).toBe("oui");
    // chaque affichage réglable et chaque groupe de pages une fois
    expect(v.filter((x) => x.cle.startsWith("affichage.")).length).toBe(
      lire<number>(`Object.keys(AFFICHAGES_REGLABLES).length`),
    );
    expect(v.filter((x) => x.cle.startsWith("page.")).length).toBe(
      lire<number>(`PAGES_EXTENSION.length`),
    );
    expect(new Set(v.map((x) => x.cle)).size).toBe(v.length);
  });

  test("jamais d'adresse ni de mot de passe : ni l'adresse du Google Sheet personnel, ni celle du fichier", async () => {
    lire(
      `localStorage.setItem("fzzz_exportSheet", "https://script.google.com/macros/s/AKfycbPersonnel999/exec")`,
    );
    expect(await lancer()).toBe("envoyé");
    const texte = JSON.stringify(recus[0]);
    expect(texte).not.toMatch(/script\.google|AKfycb|macros\/s\//);
    expect(texte).not.toMatch(/fzzz_ouafCode|mot de passe/i);
  });

  test("appareil : navigateur, système, gestionnaire et un identifiant gardé, sans versions", () => {
    const a = lire<string>(`EnvoiReglages.appareil()`);
    expect(a).toMatch(/ · Violentmonkey · [0-9a-f]{4}$/);
    expect(a).not.toMatch(/2\.31/);
    // le même à chaque envoi, d'un autre une fois le stockage vidé
    expect(lire(`EnvoiReglages.appareil()`)).toBe(a);
    expect(
      lire<string[]>(`[
        "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0",
      ].map((ua) => {
        Object.defineProperty(navigator, "userAgent", { value: ua, configurable: true });
        return EnvoiReglages.appareil().split(" · ")[0];
      })`),
    ).toEqual(["Chrome Android", "Safari iOS", "Firefox Windows", "Opera Windows"]);
  });
});

describe("une fois par jour, sans case dans les Préférences", () => {
  test("premier envoi de la journée ; pas d'autre le même jour ; le lendemain de nouveau", async () => {
    expect(await lancer()).toBe("envoyé");
    expect(recus).toHaveLength(1);
    expect(recus[0].reglages).toMatchObject({ joueur: "Alpha", version: "1.148.0" });
    avancer(2 * H);
    expect(await lancer()).toBe("attente");
    avancer(24 * H);
    expect(await lancer()).toBe("envoyé");
    expect(recus).toHaveLength(2);
  });

  test("version changée dans la journée : envoyé de nouveau, une fois", async () => {
    await lancer();
    lire(`VERSION = "1.148.1"`);
    expect(await lancer()).toBe("envoyé");
    expect(await lancer()).toBe("attente");
    expect(recus.map((r) => r.reglages.version)).toEqual(["1.148.0", "1.148.1"]);
  });

  test("échec : repris à une page ouverte une heure plus tard, trois fois par jour au plus", async () => {
    panne = true;
    expect(await lancer()).toBe("échec");
    expect(await lancer()).toBe("attente");
    avancer(H);
    expect(await lancer()).toBe("échec");
    avancer(H);
    expect(await lancer()).toBe("échec");
    avancer(H);
    expect(await lancer()).toBe("attente");
    expect(recus).toHaveLength(3);
    panne = false;
    avancer(24 * H);
    expect(await lancer()).toBe("envoyé");
  });

  test("script d'avant cette requête : la raison dit de le redéployer", async () => {
    (page.window as any).ENVOYER = (m: any) => {
      recus.push(m.corps);
      return Promise.resolve({ ok: true, statut: 200, donnees: { erreur: "requête invalide" } });
    };
    expect(await lancer()).toBe("échec");
    expect(lire(`EnvoiReglages.etat().raison`)).toBe(
      "le script du Google Sheet des stats membres n'est pas à jour (nouvelle version à déployer)",
    );
  });

  test("sans alliance, page d'attaque ou de l'armée, pas de ligne du fichier : rien n'est envoyé", async () => {
    lire(`$("#tag_alliance").remove()`);
    expect(await lancer()).toBe("sans alliance");
    lire(
      `$("body").append("<span id='tag_alliance'>OUAF</span>"); history.replaceState(null, "", "/Armee.php")`,
    );
    expect(await lancer()).toBe("page");
    lire(
      `history.replaceState(null, "", "/Ressources.php"); SuiviMembres.adresse = () => Promise.resolve({ url: "", manque: "ligne" })`,
    );
    expect(await lancer()).toBe("sans sujet");
    expect(await lancer()).toBe("attente");
    expect(recus).toEqual([]);
  });

  test("règles s5 : ni minuterie ni requête au jeu ; lancé une fois par page, après le journal", () => {
    const source = (f: string) =>
      readFileSync(join(import.meta.dir, "..", "public", "js", f), "utf8");
    const module = source("class/EnvoiReglages.js");
    expect(module).not.toMatch(/setTimeout|setInterval|\$\.(get|ajax|post)\(/);
    const appels = readdirSync(join(import.meta.dir, "..", "public", "js"), { recursive: true })
      .map(String)
      .filter((f) => f.endsWith(".js") && !f.startsWith("lib"))
      .filter((f) => /EnvoiReglages\.lancer\(/.test(source(f)));
    expect(appels).toEqual(["content.js"]);
    expect(source("content.js")).toMatch(
      /\.then\(\(\) => EnvoiJournal\.lancer\(\)\)[\s\S]{0,120}\.then\(\(\) => EnvoiReglages\.lancer\(\)\)/,
    );
    // aucune case dans les Préférences
    expect(source("boite/Parametres.js")).not.toMatch(/EnvoiReglages|o_partageReglages/);
  });
});

describe("onglet « Réglages extension » du fichier", () => {
  test("une ligne par réglage, une colonne par joueur et appareil ; clé cachée ; reçu le …", async () => {
    await lancer();
    const [titres, recu, version] = grille();
    const appareil = lire<string>(`EnvoiReglages.appareil()`);
    expect(titres).toEqual(["Groupe", "Réglage", "Clé", `Alpha · ${appareil}`]);
    expect(recu.slice(0, 3)).toEqual(["Relevé", "Reçu le", "releve"]);
    expect(String(recu[3])).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    expect(version).toEqual(["Appareil", "Version de l'extension", "version", "1.148.0"]);
    expect(grille()).toHaveLength(1 + 1 + lire<number>(`EnvoiReglages.valeurs().length`));
    expect(fichier.onglets[ONGLET].cachees).toEqual([3]);
    // un seul onglet de plus : les relevés n'y sont pas
    expect(fichier.ordre).toContain(ONGLET);
  });

  test("autre appareil ou autre joueur : une colonne de plus ; même appareil : sa colonne est remplacée", async () => {
    await lancer();
    // autre appareil du même joueur (identifiant tiré à nouveau)
    lire(
      `localStorage.removeItem("fzzz_idAppareil"); localStorage.removeItem("fzzz_envoiReglages")`,
    );
    await lancer();
    lire(
      `monProfil = new Joueur({ pseudo: "Bravo" }).getParametre(); localStorage.removeItem("fzzz_envoiReglages")`,
    );
    await lancer();
    expect(
      grille()[0]
        .slice(3)
        .map((t: string) => t.split(" · ")[0]),
    ).toEqual(["Alpha", "Alpha", "Bravo"]);
    // Bravo décoche l'horloge et renvoie le lendemain : seule sa colonne change
    lire(`localStorage.setItem("fzzz_affichage_horloge", "0")`);
    avancer(24 * H);
    await lancer();
    expect(grille()[0]).toHaveLength(6);
    expect([valeur("affichage.horloge", 4), valeur("affichage.horloge", 6)]).toEqual([
      "oui",
      "non",
    ]);
  });

  test("réglage nouveau : une ligne ajoutée en bas ; réglage plus envoyé : vide dans cette colonne", async () => {
    await lancer();
    const n = grille().length;
    lire(
      `EnvoiReglages.valeurs = ((v) => () => [...v().filter((x) => x.cle != "partage.journal"), { groupe: "Essai", cle: "nouveau", libelle: "Nouveau réglage", valeur: "oui" }])(EnvoiReglages.valeurs)`,
    );
    avancer(24 * H);
    await lancer();
    expect(grille()).toHaveLength(n + 1);
    expect(grille().at(-1)).toEqual(["Essai", "Nouveau réglage", "nouveau", "oui"]);
    expect(valeur("partage.journal", 4)).toBe("");
  });

  test("textes jamais lus comme une formule ; libellé changé : la ligne suit", async () => {
    const r = fichier.doPost({
      reglages: {
        joueur: "Alpha",
        appareil: "=Firefox Linux · Violentmonkey · 1a2b",
        version: "1.148.0",
        valeurs: [{ groupe: "Paramètres", cle: "parametre.x", libelle: "+x", valeur: "=1+1" }],
      },
    });
    expect(r).toMatchObject({ ok: true });
    expect(grille()[0][3]).toBe("Alpha · =Firefox Linux · Violentmonkey · 1a2b");
    expect(grille()[2]).toEqual(["Paramètres", "'+x", "parametre.x", "'=1+1"]);
    fichier.doPost({
      reglages: {
        joueur: "Alpha",
        appareil: "=Firefox Linux · Violentmonkey · 1a2b",
        valeurs: [{ groupe: "Paramètres", cle: "parametre.x", libelle: "Réglage x", valeur: "2" }],
      },
    });
    expect(grille()[2]).toEqual(["Paramètres", "Réglage x", "parametre.x", "2"]);
    expect(grille()).toHaveLength(3);
  });

  test("réglages refusés : rien n'est écrit", () => {
    const valeurs = [{ groupe: "A", cle: "a", libelle: "a", valeur: "oui" }];
    const r = (reglages: any) => fichier.doPost({ reglages });
    expect(r({ joueur: "Al|pha", appareil: "x", valeurs })).toEqual({ erreur: "pseudo invalide" });
    expect(r({ joueur: "Alpha", appareil: "", valeurs })).toEqual({ erreur: "appareil invalide" });
    expect(r({ joueur: "Alpha", appareil: "x", valeurs: [] })).toEqual({
      erreur: "réglages invalides",
    });
    expect(r({ joueur: "Alpha", appareil: "x", valeurs: [{ ...valeurs[0], valeur: 3 }] })).toEqual({
      erreur: "réglage 1 invalide (valeur)",
    });
    expect(r({ joueur: "Alpha", appareil: "x", valeurs: [valeurs[0], valeurs[0]] })).toEqual({
      erreur: "réglage 2 invalide (cle)",
    });
    expect(
      r({ joueur: "Alpha", appareil: "x", valeurs: [{ ...valeurs[0], cle: "releve" }] }),
    ).toEqual({
      erreur: "réglage 1 invalide (cle)",
    });
    expect(fichier.onglets[ONGLET]).toBeUndefined();
    expect(fichier.doGet()).toMatchObject({ reglages: true });
  });
});
