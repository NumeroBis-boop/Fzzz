import { beforeEach, describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Journal de l'extension (Journal) et sa boîte sous « Extension OUAF »
 * (BoiteJournal) : entrées gardées, masquage des adresses et des codes, texte
 * à copier, notes prises sur les notifications, la console et les erreurs
 * JavaScript.
 */
const page = creerPage(
  ["js/class/Journal.js", "js/boite/Dock.js", "js/boite/Journal.js"],
  `var VERSION = "1.87.0", NOM_EXTENSION = "Extension OUAF";
   var Horloge = { maintenant: () => 1762600000000, serveur: () => moment(1762600000000) };
   var AFFICHES = [];
   $.toast = function (o) { AFFICHES.push(o); return {}; };
   $.toast.options = { position: "top-right" };`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);
const SCRIPT = "https://script.google.com/macros/s/AKfycbVraieAdresse_123-abc/exec";

beforeEach(() => lire(`localStorage.clear(); document.body.innerHTML = ""; AFFICHES.length = 0;`));

describe("entrées du journal", () => {
  test("de la plus récente à la plus ancienne ; répétition comptée au lieu d'être recopiée", () => {
    lire(`Journal.info("Export", "début"); Journal.erreur("Export", "échec", new Error("panne"));
      Journal.erreur("Export", "échec");`);
    const e = lire<any[]>(`Journal.entrees()`);
    expect(e.map((x) => [x.n, x.m, x.x])).toEqual([
      ["erreur", "échec", 2],
      ["info", "début", 1],
    ]);
    expect(e[0].d).toContain("Error: panne");
    expect(e[0].v).toBe("1.87.0");
    expect(e[0].p).toBe("Armee.php");
  });

  test("au-delà de 200 entrées, les plus anciennes partent, les erreurs en dernier", () => {
    lire(`for (let i = 0; i < 150; i++) Journal.erreur("A", "erreur " + i);
      for (let i = 0; i < 100; i++) Journal.info("B", "info " + i);`);
    const e = lire<any[]>(`Journal.entrees()`);
    expect(e).toHaveLength(200);
    expect(e.filter((x) => x.n == "erreur")).toHaveLength(150);
    expect(e[0].m).toBe("info 99");
    expect(e.filter((x) => x.n == "info").at(-1).m).toBe("info 50");
  });

  test("message long raccourci ; « Effacer » vide le journal", () => {
    lire(`Journal.info("A", "x".repeat(2000))`);
    expect(lire<string>(`Journal.entrees()[0].m`).length).toBe(400);
    lire(`Journal.vider()`);
    expect(lire(`Journal.entrees()`)).toEqual([]);
  });
});

describe("masquage : le texte copié peut être envoyé tel quel", () => {
  test("adresse et identifiant du script Google, codes et jetons d'adresse, mot de passe JSON", () => {
    const m = (t: string) => lire<string>(`Journal.masquer(${JSON.stringify(t)})`);
    expect(m(`POST ${SCRIPT} : erreur`)).toBe("POST [adresse du script masquée] : erreur");
    expect(m("https://script.googleusercontent.com/macros/echo?user_content_key=abc")).toBe(
      "[adresse du script masquée]",
    );
    expect(m("déploiement AKfycbVraieAdresse_123-abc")).toBe("déploiement [identifiant masqué]");
    expect(m("deconnexion.php?t=cgx4&code=secret")).toBe("deconnexion.php?t=…&code=…");
    expect(m(`{"mot_de_passe":"secret","ok":1}`)).toBe(`{"mot_de_passe":"…","ok":1}`);
  });

  test("masqué dès l'entrée, et dans le texte copié", () => {
    lire(`Journal.erreur("Export", "refus de ${SCRIPT}", { url: "${SCRIPT}" })`);
    expect(lire(`localStorage.getItem("fzzz_journal")`)).not.toContain("AKfycb");
    expect(lire<string>(`Journal.texte()`)).not.toContain("script.google.com/macros");
  });
});

describe("texte à copier", () => {
  test("versions, navigateur, page, puis chaque entrée avec son détail", () => {
    lire(`Journal.info("Export", "début"); Journal.erreur("Export", "échec", "statut 500")`);
    const t = lire<string>(`Journal.texte()`);
    expect(t).toContain("Journal Extension OUAF v1.87.0");
    expect(t).toContain("Navigateur :");
    expect(t).toContain("Page : https://s5.fourmizzz.fr/Armee.php");
    expect(t).toContain("2 entrée(s)");
    expect(t).toMatch(
      /\[ERREUR\] Export \(Armee\.php, v1\.87\.0\)\n {2}échec\n {2}Détail : statut 500/,
    );
    expect(t.indexOf("échec")).toBeLessThan(t.indexOf("début"));
  });
});

describe("notes prises toutes seules", () => {
  test("notifications : niveau d'après l'icône, texte sans balises, notification toujours affichée", () => {
    lire(`Journal.installer();
      $.toast({ heading: "Erreur", icon: "error", text: "Export <b>impossible</b> : panne." });
      $.toast({ heading: "Extension OUAF mise à jour", icon: "info", text: "<ul><li>Nouveau</li></ul>" });`);
    const e = lire<any[]>(`Journal.entrees()`);
    expect(e.map((x) => [x.n, x.s, x.m])).toEqual([
      ["info", "Extension OUAF mise à jour", "Nouveau"],
      ["erreur", "Notification", "Export impossible : panne."],
    ]);
    expect(lire(`AFFICHES.length`)).toBe(2);
    expect(lire(`$.toast.options.position`)).toBe("top-right");
  });

  test("erreurs et avertissements écrits dans la console, toujours écrits", () => {
    lire(
      `window.ECRITS = []; console.error = (...a) => ECRITS.push(a); console.warn = (...a) => ECRITS.push(a);`,
    );
    const p = creerPage(["js/class/Journal.js"], `var Horloge = { maintenant: () => 1 };`);
    p.lire(`window.ECRITS = []; console.error = (...a) => ECRITS.push(a); console.warn = () => {};
      $.toast = undefined; Journal.installer();
      console.error("Fzzz : erreur sur cette page", new TypeError("x is undefined"));`);
    const e = p.lire<any[]>(`Journal.entrees()`);
    expect(e[0].n).toBe("erreur");
    expect(e[0].s).toBe("Console");
    expect(e[0].m).toBe("Fzzz : erreur sur cette page");
    expect(e[0].d).toContain("TypeError: x is undefined");
    expect(p.lire(`ECRITS.length`)).toBe(1);
  });

  test("erreur JavaScript non rattrapée : du jeu ou non, fichier et ligne", () => {
    const p = creerPage(["js/class/Journal.js"], `var Horloge = { maintenant: () => 1 };`);
    p.lire(`$.toast = undefined; Journal.installer();
      window.dispatchEvent(new ErrorEvent("error", { message: "creerMenu is not defined", filename: "https://s5.fourmizzz.fr/script/util.js?v=1", lineno: 12 }));
      const rejet = new Event("unhandledrejection"); rejet.reason = { status: 503, statusText: "Service Unavailable" };
      window.dispatchEvent(rejet);`);
    const e = p.lire<any[]>(`Journal.entrees()`);
    expect(e.map((x) => [x.s, x.m, x.d])).toEqual([
      ["JavaScript", "promesse rejetée sans traitement", "requête HTTP 503 Service Unavailable"],
      ["JavaScript du jeu", "creerMenu is not defined", "util.js?v=1:12"],
    ]);
  });
});

describe("boîte « Journal » sous « Extension OUAF »", () => {
  const afficher = () =>
    lire(`document.body.innerHTML = '<div id="o_boiteExtension" class="boite_compte_plus"><div class="titre_colonne_cliquable"><span class="titre_compte_plus">Extension OUAF</span></div><div class="contenu_boite_compte_plus"></div></div>';
      window.BOITE = new BoiteJournal().afficher();`);

  test("3 dernières entrées et nombre d'erreurs ; « Tout voir » montre tout, détails compris, et s'en souvient", () => {
    lire(
      `["a", "b", "c", "d"].forEach((m) => Journal.info("Export", m)); Journal.erreur("Export", "échec", "statut 500");`,
    );
    afficher();
    // heure du serveur, dans le fuseau de la machine qui lance les tests
    expect(
      lire<string[]>(
        `$("#o_boiteJournal .o_journalListe li").map((i, e) => $(e).text().slice(9)).get()`,
      ),
    ).toEqual(["· Export : échec", "· Export : d", "· Export : c"]);
    expect(lire<string>(`$("#o_boiteJournal .o_journalListe li").first().text()`)).toMatch(
      /^\d\d:\d\d:\d\d · /,
    );
    expect(lire(`$("#o_boiteJournal .o_journalCompte").text()`)).toBe("1 erreur");
    lire(`$("#o_boiteJournal .o_journalVoir").trigger("click")`);
    expect(lire(`$("#o_boiteJournal .o_journalListe li").length`)).toBe(5);
    expect(lire(`$("#o_boiteJournal .o_journalDetail").text()`)).toBe("statut 500");
    expect(lire(`$("#o_boiteJournal .o_journalVoir").text()`)).toBe("Réduire");
    expect(lire(`localStorage.getItem("fzzz_journalOuvert")`)).toBe("1");
  });

  test("entrée notée après l'affichage : la boîte suit ; « Effacer » la vide", () => {
    afficher();
    expect(lire(`$("#o_boiteJournal .o_journalListe").text()`)).toBe("Rien à signaler.");
    lire(`Journal.erreur("Forum", "écriture impossible")`);
    expect(lire(`$("#o_boiteJournal .o_journalListe li").first().text()`)).toContain(
      "Forum : écriture impossible",
    );
    lire(`$("#o_boiteJournal .o_journalEffacer").trigger("click")`);
    expect(lire(`Journal.entrees()`)).toEqual([]);
    expect(lire(`$("#o_boiteJournal .o_journalCompte").text()`)).toBe("");
  });

  test("« Copier » : tout le texte dans le presse-papiers, sinon sélectionné pour une copie à la main", async () => {
    lire(`Journal.erreur("Export", "échec")`);
    afficher();
    lire(`window.COPIE = null; Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: (t) => { COPIE = t; return Promise.resolve(); } } });
      $("#o_boiteJournal .o_journalCopier").trigger("click")`);
    await lire(`new Promise((r) => setTimeout(r, 0))`);
    expect(lire<string>(`COPIE`)).toBe(lire<string>(`Journal.texte()`));
    expect(lire(`$("#o_boiteJournal .o_journalEtat").text()`)).toContain("Journal copié");
    lire(`Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
      $("#o_boiteJournal .o_journalCopier").trigger("click")`);
    expect(lire<string>(`$("#o_boiteJournal .o_journalCopie").val()`)).toBe(
      lire<string>(`Journal.texte()`),
    );
  });

  test("une seule boîte, et aucune sans encadré « Extension OUAF »", () => {
    lire(`new BoiteJournal().afficher()`);
    expect(lire(`$("#o_boiteJournal").length`)).toBe(0);
    afficher();
    lire(`new BoiteJournal().afficher()`);
    expect(lire(`$("[id='o_boiteJournal']").length`)).toBe(1);
  });
});
