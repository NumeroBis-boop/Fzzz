import { beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { creerPage } from "./harnais";
import { classeurSimule, feuille } from "./sheet-simule";

/**
 * Onglet « Synthèse » des « Outils pour Chasseur » (boite/Synthese.js) et sa
 * requête au script du Google Sheet (ExportRapports.statistiques) : les
 * chiffres de chasse demandés, puis les graphiques chasse par chasse. Les
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
// statistiques telles que le script les renvoie : deux chasses de DoggyBag,
// d'autres chasseurs (« Alpha » avant DoggyBag dans la liste du fichier)
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
      ["k5", "Bravo", "2026-11-02 08:00", 5000, 20000, 250, "1 Tank"],
      ["k6", "Alpha", "2026-11-02 09:00", 4000, 30000, 100, "1 Tank"],
      ["k7", "Alpha", "2026-11-04 09:00", 2000, 15000, 100, "1 Tank"],
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

  test("script d'avant la synthèse, ou d'avant les chasses seules : « pas à jour »", async () => {
    reponse = { ok: true, statut: 200, donnees: { erreur: "requête invalide" } };
    expect(
      await erreurDe(lire(`ExportRapports.statistiques("2026-11-01", "2026-11-07")`)),
    ).toContain("le script du Google Sheet n'est pas à jour");
    const { format, ...ancien } = STATS;
    reponse = { ok: true, statut: 200, donnees: { statistiques: ancien } };
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

  test("seulement les chiffres de chasse demandés, puis les graphiques", () => {
    const html = lire<string>(`SyntheseChasse.html(${JSON.stringify(STATS)})`);
    expect(html).toContain("Synthèse de DoggyBag du 01/11/2026 au 07/11/2026");
    expect(lire(`SyntheseChasse.cartes(${JSON.stringify(STATS)})`)).toEqual([
      { libelle: "Chasses", texte: "2", classe: "" },
      { libelle: "Multi-chasses", texte: "2", classe: "" },
      { libelle: "Terrain chassé", texte: "20 000 cm²", classe: "" },
      { libelle: "Pertes", texte: "1 000", classe: "" },
      { libelle: "Pertes / cm² chassé", texte: "0,0500", classe: "" },
      { libelle: "Nourriture rapportée", texte: "150 000", classe: "" },
      { libelle: "Nourriture / chasse", texte: "75 000", classe: "" },
    ]);
    // première chasse : 10 000 JSN et 2 000 artilleuses ; dernière : 9 000 et 2 500
    expect(lire(`SyntheseChasse.cartesArmee(${JSON.stringify(STATS)})`)).toEqual([
      { libelle: "FdF", texte: "90 000 → 102 000", detail: "+13,3 %", classe: "o_syntheseGain" },
      { libelle: "Défense", texte: "50 000 → 55 500", detail: "+11,0 %", classe: "o_syntheseGain" },
      { libelle: "Vie", texte: "100 000 → 97 000", detail: "-3,0 %", classe: "o_synthesePerte" },
      {
        libelle: "Capacité de flood",
        texte: "12 000 → 11 500",
        detail: "-4,2 %",
        classe: "o_synthesePerte",
      },
    ]);
    expect(html).toContain("<span>FdF</span><b>90 000 → 102 000</b><small>+13,3 %</small>");
    expect(html.match(/class='o_syntheseCarte /g)).toHaveLength(11);
    expect(html.match(/class='o_syntheseGraphique'/g)).toHaveLength(4);
    // plus rien d'autre : ni floods internes, attaques, classements, tableaux ou sections
    for (const absent of [
      "Floods internes",
      "Terrain gagné",
      "Détail",
      "Classements",
      "Cibles",
      "Données des graphiques",
      "o_spoiler",
      "<table",
    ])
      expect(html).not.toContain(absent);
  });

  test("pseudo et heures venus du fichier échappés", () => {
    const s = { ...STATS, joueur: "<img src=x onerror=alert(1)>" };
    expect(lire<string>(`SyntheseChasse.html(${JSON.stringify(s)})`)).toContain(
      "Synthèse de &lt;img src=x onerror=alert(1)&gt;",
    );
    const bulle = lire<string>(
      `SyntheseChasse.graphiques(${JSON.stringify(STATS)})[0].tooltip.pointFormatter.call({ color: "#000", series: { name: "<b>X</b>" }, y: 12000, retour: "<i>01/11</i>" })`,
    );
    expect(bulle).toContain(
      "&lt;b&gt;X&lt;/b&gt; : <b>12 000</b> (retour &lt;i&gt;01/11&lt;/i&gt;)",
    );
  });

  test("graphiques chasse par chasse (« Chasse 1 », « Chasse 2 »…), mêmes valeurs que l'onglet « Statistiques »", () => {
    const g = lire<any[]>(`SyntheseChasse.graphiques(${JSON.stringify(STATS)})`);
    expect(g.map((x) => [x.chart.type, x.title.text])).toEqual([
      ["column", "Terrain chassé à chaque chasse (cm²) et tendance"],
      ["line", "Pertes par cm² de chaque chasse"],
      ["area", "Armée envoyée à chaque chasse : nombre d'unités"],
      ["line", "Nourriture rapportée à chaque chasse"],
    ]);
    const [terrain, pertes, armee, nourriture] = g;
    expect(
      lire(
        `SyntheseChasse.graphiques(${JSON.stringify(STATS)})[0].xAxis.labels.formatter.call({ value: 3 })`,
      ),
    ).toBe("Chasse 3");
    expect(terrain.xAxis.allowDecimals).toBe(false);
    expect(terrain.series.map((x: any) => [x.name, x.data])).toEqual([
      [
        "DoggyBag",
        [
          { x: 1, y: 12000, retour: "01/11 10:00" },
          { x: 2, y: 8000, retour: "03/11 10:00" },
        ],
      ],
      [
        "Tendance",
        [
          [1, 12000],
          [2, 8000],
        ],
      ],
    ]);
    expect(terrain.series[1].dashStyle).toBe("Dash");
    expect(
      lire(
        `SyntheseChasse.graphiques(${JSON.stringify(STATS)})[3].yAxis.labels.formatter.call({ value: 300000 })`,
      ),
    ).toBe("300 000");
    // moyenne en tirets, sans écart-type
    expect(pertes.series[0].data.map((p: any) => p.y)).toEqual([0.05, 0.05]);
    expect(pertes.yAxis.plotLines).toHaveLength(1);
    expect(pertes.yAxis.plotLines[0].value).toBe(0.05);
    expect(pertes.yAxis.plotBands).toBeUndefined();
    expect(pertes.subtitle.text).toBe("Moyenne : 0,0500 (tirets)");
    expect(JSON.stringify(g)).not.toContain("écart");
    expect(nourriture.series[0].data.map((p: any) => [p.x, p.y])).toEqual([
      [1, 90000],
      [2, 60000],
    ]);
    // comme la page Statistiques du jeu : unités empilées, légende « clic pour cacher »
    expect(armee.plotOptions.area.stacking).toBe("normal");
    expect(armee.legend.title.text).toBe("Armée (clic pour cacher)");
    expect(armee.series.map((x: any) => [x.name, x.data])).toEqual([
      [
        "Jeune Soldate Naine",
        [
          [1, 10000],
          [2, 9000],
        ],
      ],
      [
        "Artilleuse",
        [
          [1, 2000],
          [2, 2500],
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
    expect(mesure(4).title.text).toBe("Armée envoyée à chaque chasse : temps de ponte (jours)");
  });

  test("armée de plus de huit unités : les plus petites regroupées, couleurs inchangées d'une mesure à l'autre", () => {
    const s = JSON.parse(JSON.stringify(STATS));
    // dix unités présentes, de plus en plus nombreuses
    s.chasses.lignes = s.chasses.lignes.map((l: unknown[]) =>
      l.slice(0, 9).concat([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0, 0, 0, 0]),
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

  test("autres chasseurs : leurs courbes chasse par chasse, une couleur chacun, la même partout", () => {
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
    expect(avec[0].series[2].data).toEqual([4000, 2000]);
    expect(avec[1].series[1].data).toEqual([0.025, 0.05]);
    expect(avec[3].series[1].data).toEqual([30000, 15000]);
    expect(avec[1].series[1].pointStart).toBe(1);
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
  const periode = () =>
    lire(`$("#o_syntheseDebut").val("2026-11-01"); $("#o_syntheseFin").val("2026-11-07")`);
  const avecHighcharts = () =>
    lire(`window.CREES = []; window.DETRUITS = 0;
      window.Highcharts = { chart: (el, o) => { CREES.push([el.className, o.title.text, o.series.map((s) => s.name)]); return { destroy: () => DETRUITS++, reflow: () => {} }; } };`);

  test("30 derniers jours par défaut (horloge du serveur), résultats à la demande", async () => {
    ouvrir();
    expect(lire(`[$("#o_syntheseDebut").val(), $("#o_syntheseFin").val()]`)).toEqual([
      "2026-10-10",
      "2026-11-08",
    ]);
    expect(envois).toEqual([]);
    periode();
    await lire(`SYNTHESE.charger()`);
    expect(envois[0].corps).toEqual({ ...demande, autres: false });
    expect(lire(`$("#o_syntheseResultat").text()`)).toContain("Synthèse de DoggyBag");
    expect(lire(`$("#o_syntheseAfficher").prop("disabled")`)).toBe(false);
  });

  test("page sans Highcharts : chiffres et lien vers la Messagerie ; avec : quatre graphiques, remplacés au clic suivant", async () => {
    ouvrir();
    await lire(`SYNTHESE.charger()`);
    expect(lire(`$(".o_syntheseGraphiques a").attr("href")`)).toBe("/messagerie.php");
    expect(lire(`$(".o_syntheseCarte").length`)).toBe(11);
    avecHighcharts();
    await lire(`SYNTHESE.charger()`);
    expect(lire(`CREES.map((c) => c[0])`)).toEqual(Array(4).fill("o_syntheseTrace"));
    expect(lire(`$(".o_syntheseGraphique").length`)).toBe(4);
    await lire(`SYNTHESE.charger()`);
    expect(lire(`DETRUITS`)).toBe(4);
    expect(lire(`$(".o_syntheseGraphique").length`)).toBe(4);
  });

  test("« Comparer aux autres chasseurs » : une requête si leurs courbes manquent, sinon redessiné sans requête ; choix retenu", async () => {
    ouvrir();
    avecHighcharts();
    periode();
    await lire(`SYNTHESE.charger()`);
    expect(envois).toHaveLength(1);
    lire(`$("#o_syntheseAutres").prop("checked", true).trigger("change")`);
    await new Promise((r) => setTimeout(r, 0));
    expect(envois).toHaveLength(2);
    expect(envois[1].corps).toEqual({ ...demande, autres: true });
    expect(lire(`CREES.at(-4)[2]`)).toEqual(["DoggyBag", "Tendance", "Alpha", "Bravo"]);
    // décochée puis recochée : les courbes sont déjà là
    lire(`$("#o_syntheseAutres").prop("checked", false).trigger("change")`);
    expect(lire(`CREES.at(-4)[2]`)).toEqual(["DoggyBag", "Tendance"]);
    lire(`$("#o_syntheseAutres").prop("checked", true).trigger("change")`);
    expect(envois).toHaveLength(2);
    expect(lire(`CREES.at(-4)[2]`)).toEqual(["DoggyBag", "Tendance", "Alpha", "Bravo"]);
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
    expect(lire(`CREES.at(-2)[1]`)).toBe("Armée envoyée à chaque chasse : vie");
    expect(lire(`$(".o_syntheseMesureActive").text()`)).toBe("Vie");
    expect(lire(`$(".o_syntheseMesure[data-mesure='1']").attr("aria-pressed")`)).toBe("true");
  });

  test("période invalide : message, aucune requête ; erreur du script : message échappé", async () => {
    ouvrir();
    lire(`$("#o_syntheseDebut").val("2026-11-09")`);
    await lire(`SYNTHESE.charger()`);
    expect(lire(`$("#o_syntheseResultat").text()`)).toBe("Le premier jour est après le dernier.");
    expect(envois).toEqual([]);
    periode();
    // une synthèse affichée, puis une erreur au clic suivant
    await lire(`SYNTHESE.charger()`);
    expect(lire(`$("#o_syntheseResultat").text()`)).toContain("Synthèse de DoggyBag");
    reponse = {
      ok: true,
      statut: 200,
      donnees: { erreur: "statistiques impossibles : colonne « <b>Date</b> » introuvable" },
    };
    await lire(`SYNTHESE.charger()`);
    expect(lire(`$("#o_syntheseResultat").html()`)).toContain("&lt;b&gt;Date&lt;/b&gt;");
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
