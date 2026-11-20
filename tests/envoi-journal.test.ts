import { beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { creerPage } from "./harnais";
import { classeurSimule } from "./sheet-simule";

/**
 * Envoi du journal de débug au Google Sheet des stats membres (EnvoiJournal,
 * demande du mainteneur, 20/11/2026) : seulement les jours avec une erreur
 * notée depuis le dernier envoi, une fois par jour du serveur, toutes les
 * notes depuis cet envoi ; case cochée par défaut, sans annonce au joueur ;
 * onglet « Journal » du fichier des stats membres, rien n'y est supprimé.
 * Les requêtes vont au vrai script (google-sheet/stats-membres.gs) sur un
 * fichier simulé. Joueurs et adresses inventés.
 */
const page = creerPage(
  [
    "js/class/Utils.js",
    "js/class/ExportRapports.js",
    "js/class/SuiviMembres.js",
    "js/class/EnvoiJournal.js",
  ],
  `var chrome = { runtime: { getManifest: () => ({ version: "1.145.0" }), getURL: (p) => p, sendMessage: (m) => ENVOYER(m) } };
   var VERSION = "1.145.0";
   var heure = moment("2026-11-20 10:00", "YYYY-MM-DD HH:mm").valueOf();
   var Horloge = { maintenant: () => heure, serveur: () => moment(heure) };
   var monProfil = { pseudo: "Alpha" };`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);
const ADRESSE = "https://script.google.com/macros/s/AKfycbInventeJournal123/exec";
const H = 3600000;

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
    heure = moment("2026-11-20 10:00", "YYYY-MM-DD HH:mm").valueOf();
    history.replaceState(null, "", "/Ressources.php");
    document.body.innerHTML = "<span id='tag_alliance'>OUAF</span>";
    Journal.installer();
    SuiviMembres.adresse = () => Promise.resolve({ url: ${JSON.stringify(ADRESSE)}, manque: "" });
  })()`);
});
const lancer = () => lire<Promise<string>>(`EnvoiJournal.lancer()`);
const avancer = (ms: number) => lire(`heure += ${ms}`);
const noter = (niveau: string, source: string, message: string, detail = "") => {
  lire(
    `Journal.noter(${JSON.stringify(niveau)}, ${JSON.stringify(source)}, ${JSON.stringify(message)}, ${JSON.stringify(detail)})`,
  );
  avancer(1000);
};
const lignes = () =>
  (fichier.onglets.Journal?.grille || []).slice(1).map((l: unknown[]) => l.slice(2, 13));

describe("seulement les jours avec une erreur", () => {
  test("sans erreur : rien n'est envoyé, et l'erreur notée plus tard le même jour part", async () => {
    noter("info", "Forum", "sujets lus");
    noter("alerte", "Console", "réponse lente");
    expect(await lancer()).toBe("rien");
    expect(recus).toEqual([]);
    noter("erreur", "Export Google Sheet", "le script ne répond pas");
    expect(await lancer()).toBe("envoyé");
    expect(recus).toHaveLength(1);
  });

  test("une erreur : toutes les notes depuis le dernier envoi, de la plus ancienne à la plus récente", async () => {
    noter("info", "Forum", "sujets lus");
    noter("erreur", "Export Google Sheet", "le script ne répond pas", "statut 502");
    noter("succes", "Notification", "Partage effectué");
    expect(await lancer()).toBe("envoyé");
    const j = recus[0].journal;
    expect(j).toMatchObject({ joueur: "Alpha", serveur: "s5.fourmizzz.fr", version: "1.145.0" });
    expect(j.appareil).toContain("extension du navigateur | ");
    expect(j.notes.map((n: any) => [n.niveau, n.source, n.message, n.detail, n.page, n.x])).toEqual(
      [
        ["info", "Forum", "sujets lus", "", "Ressources.php", 1],
        [
          "erreur",
          "Export Google Sheet",
          "le script ne répond pas",
          "statut 502",
          "Ressources.php",
          1,
        ],
        ["succes", "Notification", "Partage effectué", "", "Ressources.php", 1],
      ],
    );
    // une ligne par note, sous les titres, à l'onglet « Journal »
    expect(fichier.ordre).toEqual(["Journal"]);
    expect(lignes().map((l: unknown[]) => [l[0], l[4], l[5], l[9], l[10]])).toEqual([
      ["Alpha", "INFO", "Forum", "sujets lus", ""],
      ["Alpha", "ERREUR", "Export Google Sheet", "le script ne répond pas", "statut 502"],
      ["Alpha", "OK", "Notification", "Partage effectué", ""],
    ]);
  });

  test("une fois par jour : le lendemain, seulement les notes d'après l'envoi, s'il y a une nouvelle erreur", async () => {
    noter("erreur", "Forum", "écriture refusée");
    expect(await lancer()).toBe("envoyé");
    noter("erreur", "Forum", "écriture refusée encore");
    expect(await lancer()).toBe("attente");
    avancer(24 * H);
    noter("info", "Convois", "page lue");
    expect(await lancer()).toBe("envoyé");
    // la note « journal envoyé » du premier envoi, puis celles de la veille et du jour
    expect(recus[1].journal.notes.map((n: any) => n.message)).toEqual([
      "journal envoyé au Google Sheet des stats membres : 1 note(s)",
      "écriture refusée encore",
      "page lue",
    ]);
    expect(lignes()).toHaveLength(4);
    // jour suivant sans nouvelle erreur : rien
    avancer(24 * H);
    noter("info", "Forum", "sujets lus");
    expect(await lancer()).toBe("rien");
    expect(recus).toHaveLength(2);
  });
});

describe("quand rien ne part", () => {
  test("case décochée (Préférences → Partage de données)", async () => {
    noter("erreur", "Forum", "écriture refusée");
    expect(lire(`EnvoiJournal.coche()`)).toBe(true);
    lire(`EnvoiJournal.choisir(false)`);
    expect(await lancer()).toBe("décoché");
    lire(`EnvoiJournal.choisir(true)`);
    expect(await lancer()).toBe("envoyé");
  });

  test("pages Armée et d'attaque, joueur sans alliance", async () => {
    noter("erreur", "Forum", "écriture refusée");
    lire(`history.replaceState(null, "", "/Armee.php")`);
    expect(await lancer()).toBe("page");
    lire(`history.replaceState(null, "", "/ennemie.php?Attaquer=12")`);
    expect(await lancer()).toBe("page");
    lire(`history.replaceState(null, "", "/Ressources.php"); document.body.innerHTML = ""`);
    expect(await lancer()).toBe("sans alliance");
    expect(recus).toEqual([]);
  });

  test("pas de ligne « Google Sheet des stats membres » : rien ce jour-là, sans nouvel essai", async () => {
    lire(`SuiviMembres.adresse = () => Promise.resolve({ url: "", manque: "ligne" })`);
    noter("erreur", "Forum", "écriture refusée");
    expect(await lancer()).toBe("sans sujet");
    avancer(2 * H);
    expect(await lancer()).toBe("attente");
    expect(recus).toEqual([]);
  });
});

describe("échecs", () => {
  test("repris à une page ouverte une heure plus tard, trois fois par jour au plus ; rien de perdu", async () => {
    noter("erreur", "Forum", "écriture refusée");
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
    // le lendemain : tout part, échecs notés compris
    panne = false;
    avancer(24 * H);
    expect(await lancer()).toBe("envoyé");
    const messages = recus[3].journal.notes.map((n: any) => n.message);
    expect(messages[0]).toBe("écriture refusée");
    expect(messages.filter((m: string) => m.includes("ne répond pas"))).toHaveLength(3);
  });

  test("réponse perdue après l'écriture : le nouvel essai ne recopie aucune ligne", async () => {
    noter("info", "Forum", "sujets lus");
    noter("erreur", "Forum", "écriture refusée");
    const ecrire = (page.window as any).ENVOYER;
    // le script écrit, mais sa réponse n'arrive pas
    (page.window as any).ENVOYER = (m: any) => (ecrire(m), Promise.resolve({ erreur: "reseau" }));
    expect(await lancer()).toBe("échec");
    expect(lignes()).toHaveLength(2);
    (page.window as any).ENVOYER = ecrire;
    avancer(H);
    expect(await lancer()).toBe("envoyé");
    // seules les notes nouvelles (l'échec noté) sont ajoutées
    expect(lignes().map((l: unknown[]) => l[9])).toEqual([
      "sujets lus",
      "écriture refusée",
      "envoi du journal de débug : le script du Google Sheet ne répond pas",
    ]);
  });
});

test("script du fichier d'avant cette version : l'échec le dit, l'envoi est repris", async () => {
  // ce que le script d'avant répond à une requête qu'il ne connaît pas
  (page.window as any).ENVOYER = () =>
    Promise.resolve({ ok: true, statut: 200, donnees: { erreur: "requête invalide" } });
  noter("erreur", "Forum", "écriture refusée");
  expect(await lancer()).toBe("échec");
  expect(lire(`EnvoiJournal.etat().raison`)).toBe(
    "le script du Google Sheet des stats membres n'est pas à jour (nouvelle version à déployer)",
  );
});

test("adresses de script Google et mots de passe masqués dans ce qui part", async () => {
  noter("erreur", "Export Google Sheet", `refus de ${ADRESSE}`, '{"mot_de_passe":"secret"}');
  expect(await lancer()).toBe("envoyé");
  const texte = JSON.stringify(recus[0]);
  expect(texte).not.toContain("AKfycbInventeJournal123");
  expect(texte).not.toContain("secret");
  expect(texte).toContain("[adresse du script masquée]");
});

describe("règles s5 et branchement", () => {
  const source = (f: string) =>
    readFileSync(join(import.meta.dir, "..", "public", "js", f), "utf8");

  test("aucun minuteur, aucune requête au jeu ; lancé seulement par content.js, après le relevé", () => {
    const module = source("class/EnvoiJournal.js");
    expect(module).not.toMatch(/setTimeout|setInterval|\$\.(ajax|get|post)\(/);
    const appels = (f: string) => (source(f).match(/EnvoiJournal\.lancer\(/g) || []).length;
    expect(appels("content.js")).toBe(1);
    expect(appels("class/SuiviMembres.js") + appels("class/Journal.js")).toBe(0);
    expect(source("content.js")).toMatch(
      /releve\s*\.catch\(\(\) => \{\}\)\s*\.then\(\(\) => EnvoiJournal\.lancer\(\)\)/,
    );
  });

  test("dans le manifeste, après le relevé des stats", () => {
    const config = readFileSync(join(import.meta.dir, "..", "wxt.config.ts"), "utf8");
    expect(config.indexOf('"js/class/EnvoiJournal.js"')).toBeGreaterThan(
      config.indexOf('"js/class/SuiviMembres.js"'),
    );
  });

  test("niveaux des notes : les mêmes dans l'extension et dans le script", () => {
    expect(fichier.script.NIVEAUX_JOURNAL).toEqual(lire(`NIVEAUX_JOURNAL`));
  });
});
