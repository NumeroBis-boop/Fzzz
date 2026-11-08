import { beforeEach, describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";
import { classeurSimule, feuille } from "./sheet-simule";

/**
 * Onglet « Synthèse » des « Outils pour Chasseur » (boite/Synthese.js) et sa
 * requête au script du Google Sheet (ExportRapports.statistiques). Les
 * statistiques affichées sont celles que renvoie le vrai script
 * (google-sheet/export-rapports.gs) sur des données inventées.
 */
const page = creerPage(
  [
    "js/class/Utils.js",
    "js/class/ExportRapports.js",
    "js/page/MessagerieFzzz.js",
    "js/page/PartageChasses.js",
    "js/boite/Synthese.js",
  ],
  `var monProfil = { pseudo: "DoggyBag", parametre: {} };
   var TOAST_INFO = {}, TOAST_ERROR = {}, TOAST_SUCCESS = {};
   var Horloge = { serveur: () => moment("2026-11-08 10:00", "YYYY-MM-DD HH:mm"), maintenant: () => moment("2026-11-08 10:00", "YYYY-MM-DD HH:mm").valueOf() };`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);
const fenetre = page.window as any;
const URL_SCRIPT = "https://script.google.com/macros/s/AKfycbSynthese_1/exec";

const CHASSE = [
  "Clé",
  "Exporté par",
  "Date",
  "Terrain conquis (cm²)",
  "Nourriture",
  "Fourmis perdues",
];
const COMBATS = [
  "Clé",
  "Exporté par",
  "Date",
  "Type",
  "Attaquant",
  "Défenseur",
  "Lieu",
  "Terrain (cm²)",
  "Nourriture",
  "Matériaux",
  "Pertes attaquant",
  "Pertes défenseur",
];
// statistiques telles que le script les renvoie (cible au pseudo piégé)
const fichier = () =>
  classeurSimule({
    "BDD chasse": feuille("BDD chasse", [
      CHASSE,
      ["k1", "DoggyBag", "2026-11-01 10:00", 12000, 90000, 600],
      ["k2", "DoggyBag", "2026-11-03 10:00", 8000, 60000, 400],
    ]),
    "BDD attaques": feuille("BDD attaques", [
      COMBATS,
      [
        "k3",
        "DoggyBag",
        "2026-11-02 10:00",
        "Prise",
        "DoggyBag",
        "<img src=x onerror=alert(1)>",
        "",
        1500,
        0,
        0,
        "",
        "",
      ],
    ]),
  });
const STATS = fichier().doPost({
  statistiques: true,
  joueur: "DoggyBag",
  debut: "2026-11-01",
  fin: "2026-11-07",
}).statistiques;

// requêtes vers le script : relais du background simulé
let envois: any[] = [];
let reponse: any = null;
beforeEach(() => {
  envois = [];
  reponse = { ok: true, statut: 200, donnees: { statistiques: STATS } };
  fenetre.__envoyer = (m: any) => {
    envois.push(m);
    return reponse;
  };
  lire(`(() => {
    monProfil.pseudo = "DoggyBag";
    window.chrome = { runtime: { sendMessage: (m) => Promise.resolve(__envoyer(m)) } };
    ExportRapports.cible = () => Promise.resolve({ url: "${URL_SCRIPT}", alliance: true });
    delete window.Highcharts;
  })()`);
});
const erreurDe = (p: Promise<unknown>) =>
  p.then(
    () => "",
    (e: Error) => e.message,
  );

describe("requête au script (ExportRapports.statistiques)", () => {
  test("joueur et période envoyés ; statistiques du script rendues telles quelles", async () => {
    const s = await lire(`ExportRapports.statistiques("2026-11-01", "2026-11-07")`);
    expect(envois).toEqual([
      {
        type: "fzzz_sheet",
        url: URL_SCRIPT,
        methode: "POST",
        corps: { statistiques: true, joueur: "DoggyBag", debut: "2026-11-01", fin: "2026-11-07" },
      },
    ]);
    expect(s).toEqual(STATS);
  });

  test("script d'avant la synthèse : « pas à jour », comme pour l'export", async () => {
    reponse = { ok: true, statut: 200, donnees: { erreur: "requête invalide" } };
    expect(
      await erreurDe(lire(`ExportRapports.statistiques("2026-11-01", "2026-11-07")`)),
    ).toContain("le script du Google Sheet n'est pas à jour");
  });

  test("sans adresse de fichier, réponse inattendue, pseudo inconnu : raison expliquée, sans requête", async () => {
    lire(`ExportRapports.cible = () => Promise.resolve({ url: "", alliance: true })`);
    expect(
      await erreurDe(lire(`ExportRapports.statistiques("2026-11-01", "2026-11-07")`)),
    ).toContain("l'adresse du Google Sheet de l'alliance n'est pas encore postée");
    expect(envois).toEqual([]);
    lire(`ExportRapports.cible = () => Promise.resolve({ url: "${URL_SCRIPT}", alliance: true })`);
    reponse = { ok: true, statut: 200, donnees: { autre: 1 } };
    expect(await erreurDe(lire(`ExportRapports.statistiques("2026-11-01", "2026-11-07")`))).toBe(
      "réponse inattendue du script",
    );
    lire(`monProfil.pseudo = ""`);
    expect(await erreurDe(lire(`ExportRapports.statistiques("2026-11-01", "2026-11-07")`))).toBe(
      "pseudo du joueur introuvable",
    );
  });
});

describe("affichage", () => {
  test("période : jours valides, dans l'ordre, trois ans au plus", () => {
    expect(lire(`SyntheseChasse.erreurPeriode("2026-11-01", "2026-11-07")`)).toBe("");
    expect(lire(`SyntheseChasse.erreurPeriode("", "2026-11-07")`)).toBe(
      "Choisis le premier et le dernier jour.",
    );
    expect(lire(`SyntheseChasse.erreurPeriode("2026-11-07", "2026-11-01")`)).toBe(
      "Le premier jour est après le dernier.",
    );
    expect(lire(`SyntheseChasse.erreurPeriode("2023-11-01", "2026-11-07")`)).toBe(
      "Période trop longue : trois ans au plus.",
    );
  });

  test("résumé et classements : nombres à la française, cases vides en « — », pseudos échappés", () => {
    const html = lire<string>(`SyntheseChasse.html(${JSON.stringify(STATS)})`);
    expect(html).toContain("Synthèse de DoggyBag du 01/11/2026 au 07/11/2026");
    expect(html).toContain(
      "<td class='left'>Terrain conquis (cm²)</td><td class='right'>20 000</td>",
    );
    expect(html).toContain(
      "<td class='left'>Pertes par million de cm²</td><td class='right'>50 000</td>",
    );
    expect(html).toContain(
      "<tr class='gras o_syntheseSection'><td colspan='2' class='left'>Attaques hors alliance</td></tr>",
    );
    expect(html).toContain("Évolution par jour");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img src=x");
    // aucune défense ni flood interne sur la période
    expect(html.match(/<em>Aucun\.<\/em>/g)).toHaveLength(2);
  });

  test("graphiques : mêmes séries et mêmes périodes que l'onglet « Statistiques »", () => {
    const g = lire<any[]>(`SyntheseChasse.graphiques(${JSON.stringify(STATS)})`);
    expect(g.map((x) => [x.chart.type, x.title.text])).toEqual([
      ["column", "Terrain gagné ou perdu (cm²)"],
      ["column", "Nourriture rapportée par les chasses"],
      ["line", "Pertes par million de cm² chassés"],
    ]);
    expect(g[0].xAxis.categories).toEqual(STATS.evolution.lignes.map((l: unknown[]) => l[0]));
    expect(g[0].series.map((s: any) => s.name)).toEqual(STATS.evolution.titres.slice(1, 5));
    expect(g[0].plotOptions.column.stacking).toBe("normal");
    expect(
      lire(
        `SyntheseChasse.graphiques(${JSON.stringify(STATS)})[1].yAxis.labels.formatter.call({ value: 300000 })`,
      ),
    ).toBe("300 000");
    expect(g[0].series[1].data.slice(0, 3)).toEqual([0, 1500, 0]);
    // jours sans chasse : pas de point (null), pas un zéro trompeur
    expect(g[2].series[0].data.slice(0, 3)).toEqual([50000, null, 50000]);
  });
});

describe("onglet dans la boîte", () => {
  const ouvrir = () =>
    lire(`(() => {
      document.body.innerHTML = "<div id='panneau'></div>";
      window.SYNTHESE = new SyntheseChasse($("#panneau")).afficher();
    })()`);

  test("30 derniers jours par défaut (horloge du serveur), résultats à la demande", async () => {
    ouvrir();
    expect(lire(`[$("#o_syntheseDebut").val(), $("#o_syntheseFin").val()]`)).toEqual([
      "2026-10-10",
      "2026-11-08",
    ]);
    expect(envois).toEqual([]);
    lire(`$("#o_syntheseDebut").val("2026-11-01"); $("#o_syntheseFin").val("2026-11-07")`);
    await lire(`SYNTHESE.charger()`);
    expect(envois[0].corps).toEqual({
      statistiques: true,
      joueur: "DoggyBag",
      debut: "2026-11-01",
      fin: "2026-11-07",
    });
    expect(lire(`$("#o_syntheseResultat").text()`)).toContain("Synthèse de DoggyBag");
    expect(lire(`$("#o_syntheseAfficher").prop("disabled")`)).toBe(false);
  });

  test("page sans Highcharts : tableaux et lien vers la Messagerie ; avec : trois graphiques, remplacés au clic suivant", async () => {
    ouvrir();
    await lire(`SYNTHESE.charger()`);
    expect(lire(`$(".o_syntheseGraphiques a").attr("href")`)).toBe("/messagerie.php");
    lire(`window.CREES = []; window.DETRUITS = 0;
      window.Highcharts = { chart: (el, o) => { CREES.push(o.title.text); return { destroy: () => DETRUITS++ }; } };`);
    await lire(`SYNTHESE.charger()`);
    expect(lire(`CREES`)).toHaveLength(3);
    expect(lire(`$(".o_syntheseGraphique").length`)).toBe(3);
    await lire(`SYNTHESE.charger()`);
    expect(lire(`DETRUITS`)).toBe(3);
    expect(lire(`$(".o_syntheseGraphique").length`)).toBe(3);
  });

  test("période invalide : message, aucune requête ; erreur du script : message échappé", async () => {
    ouvrir();
    lire(`$("#o_syntheseDebut").val("2026-11-09")`);
    await lire(`SYNTHESE.charger()`);
    expect(lire(`$("#o_syntheseResultat").text()`)).toBe("Le premier jour est après le dernier.");
    expect(envois).toEqual([]);
    lire(`$("#o_syntheseDebut").val("2026-11-01")`);
    reponse = {
      ok: true,
      statut: 200,
      donnees: { erreur: "statistiques impossibles : colonne « <b>Type</b> » introuvable" },
    };
    await lire(`SYNTHESE.charger()`);
    expect(lire(`$("#o_syntheseResultat").html()`)).toContain("&lt;b&gt;Type&lt;/b&gt;");
    expect(lire(`$("#o_syntheseResultat").text()`)).toContain(
      "Synthèse impossible : le script refuse : statistiques impossibles",
    );
  });
});
