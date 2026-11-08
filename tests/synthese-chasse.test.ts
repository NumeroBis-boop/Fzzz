import { beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { creerPage } from "./harnais";
import { classeurSimule, feuille } from "./sheet-simule";

/**
 * Onglet « Synthèse » des « Outils pour Chasseur » (boite/Synthese.js) et sa
 * requête au script du Google Sheet (ExportRapports.statistiques). Les
 * statistiques affichées sont celles que renvoie le vrai script
 * (google-sheet/export-rapports.gs) sur des données inventées.
 */
// unités de l'extension (content.js), recopiées telles quelles : mesures de l'armée
const CONTENT = readFileSync(join(import.meta.dir, "..", "public", "js", "content.js"), "utf8");
const UNITES_EXTENSION = ["NOM_UNITE", "VIE_UNITE", "ATT_UNITE", "DEF_UNITE", "TEMPS_UNITE"]
  .map((nom) => new RegExp(`const ${nom} = \\[[^\\]]*\\];`).exec(CONTENT)![0])
  .join("\n");
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
   var Horloge = { serveur: () => moment("2026-11-08 10:00", "YYYY-MM-DD HH:mm"), maintenant: () => moment("2026-11-08 10:00", "YYYY-MM-DD HH:mm").valueOf() };
   ${UNITES_EXTENSION}`,
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
  "Troupes en attaque",
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
      [
        "k1",
        "DoggyBag",
        "2026-11-01 10:00",
        12000,
        90000,
        600,
        "10 000 Jeunes Soldates Naines, 2 000 Artilleuses",
      ],
      [
        "k2",
        "DoggyBag",
        "2026-11-03 10:00",
        8000,
        60000,
        400,
        "9 000 Jeunes Soldates Naines, 2 500 Artilleuses",
      ],
      // autres chasseurs (« Alpha » avant DoggyBag dans la liste du fichier)
      ["k5", "Bravo", "2026-11-02 08:00", 5000, 20000, 250, "1 Tank"],
      ["k6", "Alpha", "2026-11-02 09:00", 4000, 30000, 100, "1 Tank"],
      ["k7", "Alpha", "2026-11-04 09:00", 2000, 15000, 100, "1 Tank"],
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
const demande = { statistiques: true, joueur: "DoggyBag", debut: "2026-11-01", fin: "2026-11-07" };
const STATS = fichier().doPost(demande).statistiques;
const STATS_AUTRES = fichier().doPost({ ...demande, autres: true }).statistiques;

// requêtes vers le script : relais du background simulé
let envois: any[] = [];
let reponse: any = null;
beforeEach(() => {
  envois = [];
  reponse = { ok: true, statut: 200, donnees: { statistiques: STATS } };
  fenetre.__envoyer = (m: any) => {
    envois.push(m);
    // le script simulé répond aux courbes des autres si elles sont demandées
    return m.corps?.autres && reponse.donnees.statistiques == STATS
      ? { ...reponse, donnees: { statistiques: STATS_AUTRES } }
      : reponse;
  };
  lire(`(() => {
    monProfil.pseudo = "DoggyBag";
    window.chrome = { runtime: { sendMessage: (m) => Promise.resolve(__envoyer(m)) } };
    ExportRapports.cible = () => Promise.resolve({ url: "${URL_SCRIPT}", alliance: true });
    delete window.Highcharts;
    localStorage.clear();
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
        corps: { ...demande, autres: false },
      },
    ]);
    expect(s).toEqual(STATS);
    await lire(`ExportRapports.statistiques("2026-11-01", "2026-11-07", true)`);
    expect(envois[1].corps).toEqual({ ...demande, autres: true });
  });

  test("script d'avant les multi-chasses : « pas à jour » plutôt qu'une synthèse incomplète", async () => {
    const { multiChasses, ...ancien } = STATS;
    reponse = { ok: true, statut: 200, donnees: { statistiques: ancien } };
    expect(
      await erreurDe(lire(`ExportRapports.statistiques("2026-11-01", "2026-11-07")`)),
    ).toContain("le script du Google Sheet n'est pas à jour");
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

  test("chiffres clés en tête, détail replié, graphiques et classements ouverts", () => {
    const html = lire<string>(`SyntheseChasse.html(${JSON.stringify(STATS)})`);
    expect(html).toContain("Synthèse de DoggyBag du 01/11/2026 au 07/11/2026");
    expect(lire(`SyntheseChasse.cartes(${JSON.stringify(STATS)})`)).toEqual([
      { libelle: "Chasses", texte: "2", classe: "" },
      { libelle: "Multi-chasses", texte: "2", classe: "" },
      { libelle: "Terrain conquis", texte: "20 000 cm²", classe: "" },
      { libelle: "Fourmis perdues", texte: "1 000", classe: "" },
      { libelle: "Pertes / cm²", texte: "0,0500", classe: "" },
      { libelle: "Nourriture rapportée", texte: "150 000", classe: "" },
      { libelle: "Nourriture / chasse", texte: "75 000", classe: "" },
      { libelle: "Floods internes", texte: "0 cm²", classe: "" },
      { libelle: "Terrain gagné", texte: "+21 500 cm²", classe: "o_syntheseGain" },
    ]);
    // première multi-chasse : 10 000 JSN et 2 000 artilleuses ; dernière : 9 000 et 2 500
    expect(lire(`SyntheseChasse.cartesArmee(${JSON.stringify(STATS)})`)).toEqual([
      {
        libelle: "Capacité de flood",
        texte: "12\u00a0000 → 11\u00a0500",
        detail: "-4,2 %",
        classe: "o_synthesePerte",
      },
      {
        libelle: "FdF",
        texte: "90\u00a0000 → 102\u00a0000",
        detail: "+13,3 %",
        classe: "o_syntheseGain",
      },
      {
        libelle: "Défense",
        texte: "50\u00a0000 → 55\u00a0500",
        detail: "+11,0 %",
        classe: "o_syntheseGain",
      },
      {
        libelle: "Vie",
        texte: "100\u00a0000 → 97\u00a0000",
        detail: "-3,0 %",
        classe: "o_synthesePerte",
      },
    ]);
    expect(html).toContain(
      "<span>FdF</span><b>90\u00a0000 → 102\u00a0000</b><small>+13,3 %</small>",
    );
    // sections repliables (état retenu par le navigateur), « Détail » replié au départ
    expect(html).toContain(
      "data-spoiler='syntheseDetail'><span class='o_spoilerFleche'>▶</span> Détail",
    );
    expect(html).toContain(
      "data-spoiler='syntheseEvolution'><span class='o_spoilerFleche'>▼</span> Évolution par jour",
    );
    expect(html).toContain(
      "data-spoiler='syntheseClassements'><span class='o_spoilerFleche'>▼</span> Classements",
    );
    // valeurs des graphiques en tableaux, repliés au départ
    expect(html).toContain(
      "data-spoiler='syntheseDonnees'><span class='o_spoilerFleche'>▶</span> Données des graphiques",
    );
    expect(html).toContain(
      "<tr><td class='left'>01/11 10:00</td><td class='right'>1</td><td class='right'>12 000</td><td class='right'>600</td><td class='right'>0,0500</td><td class='right'>12 000</td></tr>",
    );
    // chasseurs comparés seulement avec les autres
    expect(html).not.toContain("Chasseurs de la période");
    expect(lire<string>(`SyntheseChasse.html(${JSON.stringify(STATS_AUTRES)}, true)`)).toContain(
      "<td class='left'>DoggyBag</td><td class='right'>2</td><td class='right'>2</td><td class='right'>20 000</td><td class='right'>0,0500</td><td class='right'>75 000</td>",
    );
  });

  test("détail et classements : nombres à la française, pseudos échappés", () => {
    const html = lire<string>(`SyntheseChasse.html(${JSON.stringify(STATS)})`);
    expect(html).toContain("<td colspan='2' class='left'>Attaques hors alliance</td>");
    expect(html).toContain(
      "<td class='left'>Terrain conquis (cm²)</td><td class='right'>20 000</td>",
    );
    expect(html).toContain(
      "<td class='left'>Pertes par cm² chassé</td><td class='right'>0,0500</td>",
    );
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img src=x");
    // aucune défense ni flood interne sur la période
    expect(html.match(/<em>Aucun\.<\/em>/g)).toHaveLength(2);
  });

  test("terrain perdu sur la période : carte en rouge, signe moins", () => {
    const s = JSON.parse(JSON.stringify(STATS));
    s.resume = s.resume.map((l: [string, unknown]) =>
      l[0] == "Terrain gagné (cm²)" ? [l[0], -1234] : l,
    );
    const c = lire<any[]>(`SyntheseChasse.cartes(${JSON.stringify(s)})`).at(-1);
    expect(c).toEqual({ libelle: "Terrain gagné", texte: "-1 234 cm²", classe: "o_synthesePerte" });
  });

  test("graphiques : mêmes séries et mêmes périodes que l'onglet « Statistiques »", () => {
    const g = lire<any[]>(`SyntheseChasse.graphiques(${JSON.stringify(STATS)})`);
    expect(g.map((x) => [x.chart.type, x.title.text])).toEqual([
      ["column", "Terrain chassé par jour (cm²) et tendance"],
      ["line", "Pertes par cm² de chaque multi-chasse"],
      ["area", "Armée envoyée en multi-chasse : nombre d'unités"],
      ["line", "Nourriture rapportée par chasse"],
      ["column", "Terrain gagné ou perdu (cm²)"],
    ]);
    const [terrain, pertes, armee, nourriture, gagne] = g;
    expect(terrain.xAxis.categories).toEqual(STATS.evolution.lignes.map((l: unknown[]) => l[0]));
    expect(terrain.series.map((s: any) => [s.name, s.data.slice(0, 3)])).toEqual([
      ["DoggyBag", [12000, 0, 8000]],
      ["Tendance", STATS.evolution.lignes.slice(0, 3).map((l: unknown[]) => l[7])],
    ]);
    expect(terrain.series[1].dashStyle).toBe("Dash");
    // une multi-chasse par point (heure du fichier), moyenne et écart-type du script
    expect(pertes.xAxis.type).toBe("datetime");
    expect(pertes.series[0].data).toEqual([
      [Date.UTC(2026, 10, 1, 10, 0), 0.05],
      [Date.UTC(2026, 10, 3, 10, 0), 0.05],
    ]);
    expect(pertes.yAxis.plotLines[0].value).toBe(0.05);
    expect(pertes.subtitle.text).toBe(
      "Moyenne des multi-chasses 0,0500 (tirets), écart-type 0,0000 (bande grise)",
    );
    expect(pertes.xAxis.dateTimeLabelFormats.day).toBe("%d/%m");
    expect([pertes.yAxis.plotBands[0].from, pertes.yAxis.plotBands[0].to]).toEqual([0.05, 0.05]);
    expect(pertes.legend.enabled).toBe(false);
    expect(nourriture.series[0].data).toEqual([90000, 60000]);
    expect(nourriture.series[0].pointStart).toBe(1);
    expect(gagne.series.map((s: any) => s.name)).toEqual(STATS.evolution.titres.slice(1, 5));
    expect(gagne.plotOptions.column.stacking).toBe("normal");
    expect(gagne.series[1].data.slice(0, 3)).toEqual([0, 1500, 0]);
    expect(
      lire(
        `SyntheseChasse.graphiques(${JSON.stringify(STATS)})[3].yAxis.labels.formatter.call({ value: 300000 })`,
      ),
    ).toBe("300 000");
    // comme la page Statistiques du jeu : unités empilées, légende « clic pour cacher »
    expect(armee.plotOptions.area.stacking).toBe("normal");
    expect(armee.legend.title.text).toBe("Armée (clic pour cacher)");
    expect(armee.series.map((s: any) => [s.name, s.data])).toEqual([
      [
        "Jeune Soldate Naine",
        [
          [Date.UTC(2026, 10, 1, 10, 0), 10000],
          [Date.UTC(2026, 10, 3, 10, 0), 9000],
        ],
      ],
      [
        "Artilleuse",
        [
          [Date.UTC(2026, 10, 1, 10, 0), 2000],
          [Date.UTC(2026, 10, 3, 10, 0), 2500],
        ],
      ],
    ]);
  });

  test("armée : vie, dégâts et temps de ponte hors bonus (unités de l'extension)", () => {
    const mesure = (m: number) =>
      lire<any>(`SyntheseChasse.graphiqueArmee(${JSON.stringify(STATS)}, ${m})`);
    // JSN : vie 8, attaque 3, défense 2, ponte 300 s ; artilleuse : 10, 30, 15, 1 440 s
    expect(mesure(1).series.map((s: any) => s.data[0][1])).toEqual([80000, 20000]);
    expect(mesure(2).series.map((s: any) => s.data[0][1])).toEqual([30000, 60000]);
    expect(mesure(3).series.map((s: any) => s.data[0][1])).toEqual([20000, 30000]);
    expect(mesure(4).series.map((s: any) => s.data[0][1])).toEqual([
      (10000 * 300) / 86400,
      (2000 * 1440) / 86400,
    ]);
    expect(mesure(4).title.text).toBe("Armée envoyée en multi-chasse : temps de ponte (jours)");
  });

  test("armée de plus de huit unités : les plus petites regroupées, couleurs inchangées d'une mesure à l'autre", () => {
    const s = JSON.parse(JSON.stringify(STATS));
    // dix unités présentes, de plus en plus nombreuses
    s.multiChasses.lignes = s.multiChasses.lignes.map((l: unknown[]) =>
      l.slice(0, 8).concat([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0, 0, 0, 0]),
    );
    const noms = (m: number) =>
      lire<any>(`SyntheseChasse.graphiqueArmee(${JSON.stringify(s)}, ${m})`).series.map(
        (x: any) => [x.name, x.color],
      );
    expect(noms(0)).toHaveLength(8);
    expect(noms(0).at(-1)).toEqual(["Autres unités", "#898781"]);
    // sept tracées une à une dans l'ordre du jeu, les trois plus petites (JSN, SN, NE) regroupées
    expect(noms(0)[0][0]).toBe("Jeune Soldate");
    expect(noms(1)).toEqual(noms(0));
  });

  test("autres chasseurs : leurs courbes en plus, une couleur chacun, la même partout", () => {
    const sans = lire<any[]>(`SyntheseChasse.graphiques(${JSON.stringify(STATS_AUTRES)})`);
    const avec = lire<any[]>(`SyntheseChasse.graphiques(${JSON.stringify(STATS_AUTRES)}, true)`);
    // ordre du fichier : Alpha, Bravo, DoggyBag
    expect(STATS_AUTRES.chasseurs).toEqual(["Alpha", "Bravo", "DoggyBag"]);
    expect(sans[0].series.map((x: any) => x.name)).toEqual(["DoggyBag", "Tendance"]);
    for (const i of [0, 1, 3])
      expect(avec[i].series.map((x: any) => [x.name, x.color])).toEqual([
        ["DoggyBag", "#1baf7a"],
        ...(i == 0 ? [["Tendance", "#52514e"]] : []),
        ["Alpha", "#2a78d6"],
        ["Bravo", "#eb6834"],
      ]);
    expect(avec[0].series[2].data).toEqual([0, 4000, 0, 2000, 0, 0, 0]);
    expect(avec[1].series[1].data).toEqual([
      [Date.UTC(2026, 10, 2, 9, 0), 0.025],
      [Date.UTC(2026, 10, 4, 9, 0), 0.05],
    ]);
    expect(avec[3].series[1].data).toEqual([30000, 15000]);
    expect(avec[1].legend.enabled).toBe(true);
    // pas de courbes des autres dans le graphique de l'armée
    expect(avec[2].series).toEqual(sans[2].series);
    // au-delà de huit chasseurs : mêmes couleurs, en pointillés
    const s = { ...STATS_AUTRES, chasseurs: Array.from({ length: 10 }, (_, i) => `J${i}`) };
    expect(lire(`SyntheseChasse.style(${JSON.stringify(s)}, "j9")`)).toEqual({
      color: "#eb6834",
      dashStyle: "ShortDash",
    });
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
    expect(envois[0].corps).toEqual({ ...demande, autres: false });
    expect(lire(`$("#o_syntheseResultat").text()`)).toContain("Synthèse de DoggyBag");
    expect(lire(`$("#o_syntheseAfficher").prop("disabled")`)).toBe(false);
  });

  const avecHighcharts = () =>
    lire(`window.CREES = []; window.DETRUITS = 0;
      window.Highcharts = { chart: (el, o) => { CREES.push([el.className, o.title.text, o.series.map((s) => s.name)]); return { destroy: () => DETRUITS++, reflow: () => {} }; } };`);

  test("page sans Highcharts : tableaux et lien vers la Messagerie ; avec : cinq graphiques, remplacés au clic suivant", async () => {
    ouvrir();
    await lire(`SYNTHESE.charger()`);
    expect(lire(`$(".o_syntheseGraphiques a").attr("href")`)).toBe("/messagerie.php");
    expect(lire(`$(".o_syntheseDonnees").length`)).toBe(3);
    avecHighcharts();
    await lire(`SYNTHESE.charger()`);
    expect(lire(`CREES.map((c) => c[0])`)).toEqual(Array(5).fill("o_syntheseTrace"));
    expect(lire(`$(".o_syntheseGraphique").length`)).toBe(5);
    await lire(`SYNTHESE.charger()`);
    expect(lire(`DETRUITS`)).toBe(5);
    expect(lire(`$(".o_syntheseGraphique").length`)).toBe(5);
  });

  test("« Comparer aux autres chasseurs » : une requête si leurs courbes manquent, sinon redessiné sans requête ; choix retenu", async () => {
    ouvrir();
    avecHighcharts();
    lire(`$("#o_syntheseDebut").val("2026-11-01"); $("#o_syntheseFin").val("2026-11-07")`);
    await lire(`SYNTHESE.charger()`);
    expect(envois).toHaveLength(1);
    lire(`$("#o_syntheseAutres").prop("checked", true).trigger("change")`);
    await new Promise((r) => setTimeout(r, 0));
    expect(envois).toHaveLength(2);
    expect(envois[1].corps).toEqual({ ...demande, autres: true });
    expect(lire(`CREES.at(-5)[2]`)).toEqual(["DoggyBag", "Tendance", "Alpha", "Bravo"]);
    expect(lire(`$("#o_syntheseResultat").text()`)).toContain("Chasseurs de la période");
    // décochée puis recochée : les courbes sont déjà là
    lire(`$("#o_syntheseAutres").prop("checked", false).trigger("change")`);
    expect(lire(`CREES.at(-5)[2]`)).toEqual(["DoggyBag", "Tendance"]);
    expect(lire(`$("#o_syntheseResultat").text()`)).not.toContain("Chasseurs de la période");
    lire(`$("#o_syntheseAutres").prop("checked", true).trigger("change")`);
    expect(envois).toHaveLength(2);
    expect(lire(`CREES.at(-5)[2]`)).toEqual(["DoggyBag", "Tendance", "Alpha", "Bravo"]);
    expect(lire(`localStorage.getItem("fzzz_syntheseAutres")`)).toBe("1");
    ouvrir();
    expect(lire(`$("#o_syntheseAutres").prop("checked")`)).toBe(true);
  });

  test("boutons de l'armée : la mesure choisie, sans requête", async () => {
    ouvrir();
    avecHighcharts();
    await lire(`SYNTHESE.charger()`);
    lire(`$(".o_syntheseMesure[data-mesure='1']").trigger("click")`);
    expect(envois).toHaveLength(1);
    expect(lire(`CREES.at(-3)[1]`)).toBe("Armée envoyée en multi-chasse : vie");
    expect(lire(`$(".o_syntheseMesureActive").text()`)).toBe("Vie");
    expect(lire(`$(".o_syntheseMesure[data-mesure='1']").attr("aria-pressed")`)).toBe("true");
  });

  test("période invalide : message, aucune requête ; erreur du script : message échappé", async () => {
    ouvrir();
    lire(`$("#o_syntheseDebut").val("2026-11-09")`);
    await lire(`SYNTHESE.charger()`);
    expect(lire(`$("#o_syntheseResultat").text()`)).toBe("Le premier jour est après le dernier.");
    expect(envois).toEqual([]);
    lire(`$("#o_syntheseDebut").val("2026-11-01")`);
    // une synthèse affichée, puis une erreur au clic suivant
    await lire(`SYNTHESE.charger()`);
    expect(lire(`$("#o_syntheseResultat").text()`)).toContain("Synthèse de DoggyBag");
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
    // case décochée après l'erreur : l'ancienne synthèse ne revient pas, aucune requête
    const n = envois.length;
    lire(`$("#o_syntheseAutres").prop("checked", false).trigger("change")`);
    expect(lire(`$("#o_syntheseResultat").text()`)).toContain("Synthèse impossible");
    expect(envois).toHaveLength(n);
  });
});
