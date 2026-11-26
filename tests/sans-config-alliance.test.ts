import { beforeEach, describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { creerPage } from "./harnais";

/**
 * Case « Sans config alliance » (Préférences → Partage de données, demande du
 * mainteneur, 26/11/2026, idée de SerPounce pour les autres serveurs) : gardée
 * dans le localStorage du jeu, donc par serveur. Cochée, l'extension ne lit ni
 * n'écrit rien dans le forum de l'alliance, n'utilise pas ses réglages et ne
 * montre aucun partage. Joueurs et adresses inventés.
 */
const page = creerPage(
  [
    "js/lib/jquery-ui_1.12.1.js",
    "js/class/Utils.js",
    "js/class/Parametre.js",
    "js/class/Joueur.js",
    "js/class/ExportRapports.js",
    "js/class/OuafSuivi.js",
    "js/page/PartageChasses.js",
    "js/page/ChatGif.js",
  ],
  `var METHODE_FLOOD = ["Standard", "Optimisée", "Uniforme", "Dégressive"],
     AFFECTATION_RESSOURCE = [], RATIO_RECOLTE = {}, TOAST_INFO = {}, TOAST_ERROR = {}, TOAST_SUCCESS = {};
   var NOM_UNITE = ["Ouvrière", "Jeune Soldate Naine"], NOM_UNITES = ["Ouvrières", "Jeunes Soldates Naines"];
   var VERSION = "1.159.0";
   var heure = 1763450000000;
   var Horloge = { maintenant: () => heure, serveur: () => moment(heure) };
   var monProfil = { pseudo: "Alpha" };`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);

const SITE = "http://convois.example.org";
const SHEET_RC = "https://script.google.com/macros/s/AKfycbRcInvente_1/exec";
// lecture gardée d'une alliance réglée : site, fichiers et listes
const GARDEE = {
  lu: 1763450000000,
  version: "1.159.0",
  alliance: "TAG",
  section: true,
  sujet: true,
  reglages: {
    siteConvois: SITE,
    feuilleRc: SHEET_RC,
    autorisesRc: ["Alpha"],
    feuilleStats: "https://script.google.com/macros/s/AKfycbStatsInvente_2/exec",
    chefs: ["Alpha"],
    chasseurs: ["Alpha"],
    greniers: ["Alpha"],
    journal: ["Alpha"],
  },
};

beforeEach(() => {
  lire(`(() => {
    localStorage.clear();
    sessionStorage.clear();
    history.replaceState(null, "", "/Ressources.php");
    document.body.innerHTML = "<span id='tag_alliance'>TAG</span>";
    localStorage.setItem("fzzz_reglagesAlliance", ${JSON.stringify(JSON.stringify(GARDEE))});
    // section mémorisée et liste des sujets gardée : rien ne doit les servir
    PartageChasses.idSection = "7";
    window.AJAX = [];
    $.ajax = (o) => { AJAX.push(o.url + " " + ((o.data && o.data.xajax) || "")); return $.Deferred().resolve("").promise(); };
    $.get = (u) => { AJAX.push(String(u)); return $.Deferred().resolve("").promise(); };
    window.NOTES = [];
    Journal.info = (source, message) => NOTES.push(source + " : " + message);
  })()`);
});
const cocher = () => lire(`Utils.choisirSansConfigAlliance(true)`);
const ajax = () => lire<string[]>(`AJAX.slice()`);

describe("la case, par serveur", () => {
  test("décochée par défaut ; cochée : « 1 » dans le localStorage du jeu ; décochée : la clé disparaît", () => {
    expect(lire(`Utils.sansConfigAlliance()`)).toBe(false);
    cocher();
    expect(
      lire(`[Utils.sansConfigAlliance(), localStorage.getItem("fzzz_sansConfigAlliance")]`),
    ).toEqual([true, "1"]);
    lire(`Utils.choisirSansConfigAlliance(false)`);
    expect(
      lire(`[Utils.sansConfigAlliance(), localStorage.getItem("fzzz_sansConfigAlliance")]`),
    ).toEqual([false, null]);
  });
});

describe("forum de l'alliance : aucune requête", () => {
  test("décochée, la requête part (témoin) ; cochée, rejetée « absente » sans requête, section mémorisée ou non", async () => {
    await lire<Promise<any>>(`PartageChasses._xajax("callGetForum", "7")`);
    expect(ajax()).toEqual([location() + "/alliance.php?forum_menu callGetForum"]);
    lire(`AJAX.length = 0`);
    cocher();
    for (const appel of [
      `PartageChasses._xajax("callGetTopic", "40")`,
      `PartageChasses._xajax("envoiNouveauMessage", ["40", "x"])`,
      `PartageChasses.trouverSection()`,
      `PartageChasses.sujets(true)`,
    ])
      expect(await lire<Promise<any>>(`${appel}.then(() => "lu", (e) => e.message)`)).toBe(
        "absente",
      );
    expect(ajax()).toEqual([]);
  });

  test("partages lus : rien de partagé, sans requête (TdC à l'impact et Multi-flood avec mes seuls mouvements)", async () => {
    cocher();
    expect(await lire<Promise<any>>(`PartageChasses.charger(["Alpha"])`)).toEqual({
      chasses: {},
      floods: [],
    });
    expect(ajax()).toEqual([]);
  });

  test("écritures : ni partage, ni retrait, ni recalage ; l'état des partages de ce navigateur reste", async () => {
    lire(`(() => {
      localStorage.setItem("fzzz_finChassesPartagees", "2026-11-18 10:00");
      PartageChasses.enFile = () => { AJAX.push("file"); return Promise.resolve(true); };
    })()`);
    cocher();
    const avant = lire<string>(`JSON.stringify(localStorage)`);
    expect(
      await lire<Promise<any>>(`Promise.all([
        PartageChasses.partager([{ impact: moment(heure), terrain: 1000, unites: "" }], null),
        PartageChasses.partagerFloods([], null),
        PartageChasses.retirerFloods([501]),
        PartageChasses.recalerChasses([]),
      ])`),
    ).toEqual([false, false, undefined, undefined]);
    expect(ajax()).toEqual([]);
    expect(lire<string>(`JSON.stringify(localStorage)`)).toBe(avant);
  });
});

describe("réglages de l'alliance : ni lus ni utilisés", () => {
  test("la lecture gardée ne sert plus : site, fichiers, listes et rôles vides ; décochée, elle revient", async () => {
    expect(
      lire(`[OuafSuivi.site() && OuafSuivi.site().url, Joueur.chasseurParDefaut("Alpha")]`),
    ).toEqual([SITE, true]);
    cocher();
    expect(lire(`ReglagesAlliance.garde()`)).toBeNull();
    expect(lire(`ReglagesAlliance.reglages()`)).toEqual(lire(`ReglagesAlliance.vides()`));
    expect(
      lire(`[OuafSuivi.site(), Joueur.chasseurParDefaut("Alpha"), Joueur.grenierParDefaut("Alpha"),
        Journal.pourCeJoueur(), ReglagesAlliance.contient("chefs", "Alpha"), ReglagesAlliance.fichier("feuilleRc")]`),
    ).toEqual([null, false, false, false, false, false]);
    expect(lire<string>(`ReglagesAlliance.resume()`)).toContain(
      "case « Sans config alliance » cochée",
    );
    lire(`Utils.choisirSansConfigAlliance(false)`);
    expect(lire(`OuafSuivi.site().url`)).toBe(SITE);
  });

  test("ni lecture à la demande, ni relecture de l'heure, ni lecture du bouton « Relire les réglages »", async () => {
    cocher();
    lire(
      `localStorage.setItem("fzzz_reglagesAlliance", JSON.stringify({ ...${JSON.stringify(GARDEE)}, lu: 0 }))`,
    );
    for (const lecture of ["garde", "sujet", "tout"])
      expect(await lire<Promise<any>>(`ReglagesAlliance.charger({}, "${lecture}")`)).toEqual({
        section: false,
        sujet: false,
        reglages: lire(`ReglagesAlliance.vides()`),
      });
    await lire<Promise<any>>(`ReglagesAlliance.actualiser()`);
    expect(ajax()).toEqual([]);
    // rien noté : ce n'est pas un essai de lecture
    expect(lire(`JSON.parse(localStorage.getItem("fzzz_reglagesAlliance")).essai`)).toBeUndefined();
  });

  test("export des RC : comme un joueur hors liste (son propre Google Sheet), sans lire le forum", async () => {
    cocher();
    expect(await lire<Promise<any>>(`ExportRapports.reglageAlliance()`)).toEqual({
      autorise: false,
      adresse: "",
    });
    expect(ajax()).toEqual([]);
  });
});

describe("GIF et smileys de l'alliance", () => {
  test("cochée : les listes de l'alliance retirées, « Mes GIF » garde la sienne", () => {
    const sections = { mes: true, alliance: true, smileys: true, gif: true };
    expect(lire(`ChatGif.sansAlliance(${JSON.stringify(sections)})`)).toEqual(sections);
    cocher();
    expect(lire(`ChatGif.sansAlliance(${JSON.stringify(sections)})`)).toEqual({
      mes: true,
      alliance: false,
      smileys: false,
      gif: true,
    });
  });
});

function location() {
  return lire<string>(`location.origin`);
}

// boutons qui publient dans le forum : chacun disparaît avec la case
describe("chaque bouton de partage suit la case", () => {
  const dossier = join(import.meta.dir, "..", "public", "js");
  const fichiers = ["class", "page", "boite"].flatMap((d) =>
    readdirSync(join(dossier, d))
      .filter((f) => f.endsWith(".js"))
      .map((f) => join(d, f)),
  );
  // un bouton dont le texte partage, écrit dans un gabarit
  const BOUTON = /<button[^>]*>[^<]*(?:[Pp]artager|\+ partager)[^<]*<\/button>/;
  // remplacés seulement là où un bouton de partage existe déjà sur la page
  const SANS_CASE = new Map([["class/AttaqueLancee.js", ["$essai", "o_floodPartage"]]]);

  test("toute ligne qui écrit un tel bouton lit Utils.sansConfigAlliance() (elle ou les 4 d'avant)", () => {
    const fautifs: string[] = [];
    for (const f of fichiers) {
      readFileSync(join(dossier, f), "utf8")
        .split("\n")
        .forEach((ligne, i, lignes) => {
          if (!BOUTON.test(ligne)) return;
          // la condition peut ouvrir le gabarit quelques lignes plus haut
          const contexte = lignes.slice(Math.max(0, i - 4), i + 1).join("\n");
          if (contexte.includes("Utils.sansConfigAlliance()")) return;
          if ((SANS_CASE.get(f) || []).some((m) => contexte.includes(m))) return;
          fautifs.push(`${f}:${i + 1}`);
        });
    }
    expect(fautifs).toEqual([]);
  });

  test("le scan trouve un bouton ajouté sans la case", () => {
    expect(BOUTON.test(`<button type='button' class='o_button'>Partager mes floods</button>`)).toBe(
      true,
    );
    expect(BOUTON.test(`<button id="x" class="o_button">Lancer + partager</button>`)).toBe(true);
  });

  test("une seule requête au forum de l'alliance dans le code : PartageChasses._xajax", () => {
    const requetes = fichiers.filter((f) =>
      /url:\s*[^,\n]*forum_menu/.test(readFileSync(join(dossier, f), "utf8")),
    );
    expect(requetes).toEqual(["page/PartageChasses.js"]);
  });
});
