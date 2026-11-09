import { beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { creerPage } from "./harnais";
import { classeurSimule, feuille } from "./sheet-simule";

/**
 * Onglet « Synthèse » des « Outils pour Chasseur » (boite/Synthese.js) et sa
 * requête au script du Google Sheet (ExportRapports.statistiques) : les
 * chiffres de chasse demandés, puis les graphiques. Les statistiques affichées
 * sont celles que renvoie le vrai script (google-sheet/export-rapports.gs) sur
 * des données inventées.
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
  "Troupes en défense",
  "RC",
];
const appris = (ligne: string) =>
  `Troupes en attaque : …\n\nLes unités survivantes ont appris de cette bataille :\n- ${ligne}\n\nVos chasseuses ont conquis …`;
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
        "1 000 Criquets, 100 Abeilles",
        appris("100 Artilleuses sont devenues des Artilleuses d’élites"),
      ],
      [
        "k2",
        "DoggyBag",
        "2026-11-03 10:00",
        8000,
        60000,
        400,
        "9 000 Jeunes Soldates Naines, 2 500 Artilleuses",
        "700 Criquets, 50 Abeilles",
        "",
      ],
      ["k5", "Bravo", "2026-11-02 08:00", 5000, 20000, 250, "1 Tank", "300 Criquets", ""],
      ["k6", "Alpha", "2026-11-02 09:00", 4000, 30000, 100, "1 Tank", "400 Criquets", ""],
      ["k7", "Alpha", "2026-11-04 09:00", 2000, 15000, 100, "1 Tank", "200 Criquets", ""],
    ]),
  });
const demande = { statistiques: true, joueur: "DoggyBag", debut: "2026-11-01", fin: "2026-11-07" };
// la synthèse demande toujours les autres chasseurs, au format 4
const STATS = fichier().doPost({ ...demande, autres: true, format: 5 }).statistiques;
const json = (x: unknown) => JSON.stringify(x);

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
    localStorage.clear();
  })()`);
});
const erreurDe = (p: Promise<unknown>) =>
  p.then(
    () => "",
    (e: Error) => e.message,
  );

describe("requête au script (ExportRapports.statistiques)", () => {
  test("joueur, période et format envoyés ; statistiques du script rendues telles quelles", async () => {
    const s = await lire(`ExportRapports.statistiques("2026-11-01", "2026-11-07")`);
    expect(envois).toEqual([
      {
        type: "fzzz_sheet",
        url: URL_SCRIPT,
        methode: "POST",
        corps: { ...demande, autres: false, format: 5 },
      },
    ]);
    expect(s).toEqual(STATS);
    await lire(`ExportRapports.statistiques("2026-11-01", "2026-11-07", true)`);
    expect(envois[1].corps).toEqual({ ...demande, autres: true, format: 5 });
  });

  test("script d'avant ce format : « script pas à jour » ; plus récent : « extension pas à jour »", async () => {
    const message = () => erreurDe(lire(`ExportRapports.statistiques("2026-11-01", "2026-11-07")`));
    reponse = { ok: true, statut: 200, donnees: { erreur: "requête invalide" } };
    expect(await message()).toContain("le script du Google Sheet n'est pas à jour");
    const { format, ...sans } = STATS;
    for (const ancien of [sans, { ...STATS, format: 3 }]) {
      reponse = { ok: true, statut: 200, donnees: { statistiques: ancien } };
      expect(await message()).toContain("le script du Google Sheet n'est pas à jour");
    }
    reponse = { ok: true, statut: 200, donnees: { statistiques: { ...STATS, format: 6 } } };
    expect(await message()).toContain("l'extension n'est pas à jour");
    // script au format 4 (sans le tableau des chasseurs) : lu quand même
    const { comparaison, ...format4 } = { ...STATS, format: 4 };
    reponse = { ok: true, statut: 200, donnees: { statistiques: format4 } };
    expect(await message()).toBe("");
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

  test("seulement les chiffres de chasse demandés, puis six graphiques", () => {
    const html = lire<string>(`SyntheseChasse.html(${json(STATS)})`);
    expect(html).toContain("Synthèse de DoggyBag du 01/11/2026 au 07/11/2026");
    // écart à la moyenne des trois chasseurs de la période (DoggyBag, Alpha,
    // Bravo) : 2 chasses contre 1,7 en moyenne, 20 000 cm² contre 10 333,3… ;
    // plus de pertes que la moyenne : moins bien, en rouge
    const plus = "o_syntheseEcartMieux",
      moinsBien = "o_syntheseEcartMoinsBien";
    expect(lire(`SyntheseChasse.cartes(${json(STATS)})`)).toEqual([
      { libelle: "Chasses", texte: "2", classe: "", detail: "+17,6 %", classeDetail: plus },
      { libelle: "Multi-chasses", texte: "2", classe: "", detail: "+17,6 %", classeDetail: plus },
      {
        libelle: "Terrain chassé",
        texte: "20 000 cm²",
        classe: "",
        detail: "+93,5 %",
        classeDetail: plus,
      },
      {
        libelle: "Pertes",
        texte: "1 000",
        classe: "",
        detail: "+106,9 %",
        classeDetail: moinsBien,
      },
      {
        libelle: "Pertes / M cm² chassé",
        texte: "50 000",
        classe: "",
        detail: "+12,5 %",
        classeDetail: moinsBien,
      },
      {
        libelle: "Nourriture rapportée",
        texte: "150 000",
        classe: "",
        detail: "+109,3 %",
        classeDetail: plus,
      },
      {
        libelle: "Nourriture / multi-chasse",
        texte: "75 000",
        classe: "",
        detail: "+91,5 %",
        classeDetail: plus,
      },
    ]);
    expect(html).toContain(
      "Sous chaque chiffre : l'écart avec la moyenne des 3 chasseurs de la période",
    );
    expect(html).toContain(
      "<span>Terrain chassé</span><b>20 000 cm²</b><small class='o_syntheseEcartMieux'>+93,5 %</small>",
    );
    // première chasse : 10 000 JSN et 2 000 artilleuses ; puis l'effet en % de
    // chaque chasse (600 JSN mortes et 100 artilleuses devenues d'élite sur
    // 12 000 unités, puis 400 JSN mortes sur 11 500) : les pontes ne comptent pas
    expect(lire(`SyntheseChasse.cartesArmee(${json(STATS)})`)).toEqual([
      {
        libelle: "FdF",
        texte: "90 000 → 87 656",
        detail: "-2,6 %",
        classe: "o_synthesePerte",
      },
      {
        libelle: "Défense",
        texte: "50 000 → 48 392",
        detail: "-3,2 %",
        classe: "o_synthesePerte",
      },
      {
        libelle: "Vie",
        texte: "100 000 → 92 253",
        detail: "-7,7 %",
        classe: "o_synthesePerte",
      },
      {
        libelle: "Capacité de flood",
        texte: "12 000 → 11 003",
        detail: "-8,3 %",
        classe: "o_synthesePerte",
      },
    ]);
    expect(html).toContain("<span>FdF</span><b>90 000 → 87 656</b><small>-2,6 %</small>");
    expect(html).toContain("sans les pontes");
    expect(html.match(/class='o_syntheseCarte /g)).toHaveLength(11);
    expect(html.match(/class='o_syntheseGraphique'/g)).toHaveLength(6);
    // boutons des mesures de l'armée : sur le dernier graphique
    expect(html.lastIndexOf("o_syntheseMesures")).toBeGreaterThan(
      html.lastIndexOf("o_syntheseGraphique'"),
    );
    // le tableau des chasseurs à la fin, seul tableau
    expect(html.match(/<table/g)).toHaveLength(1);
    expect(html.indexOf("o_syntheseComparaison")).toBeGreaterThan(
      html.lastIndexOf("o_syntheseTrace"),
    );
    // plus rien d'autre : ni floods internes, attaques, classements ou sections
    for (const absent of [
      "Floods internes",
      "Terrain gagné",
      "Classements",
      "Cibles",
      "Données des graphiques",
      "o_spoiler",
    ])
      expect(html).not.toContain(absent);
  });

  test("écart à la moyenne : mieux en vert, moins bien en rouge (sous la moyenne pour les pertes), rien sans autre chasseur", () => {
    const s = JSON.parse(json(STATS));
    const k = (t: string) => s.comparaison.titres.indexOf(t);
    s.comparaison.moyenne[k("Chasses (RC)")] = 4;
    s.comparaison.moyenne[k("Multi-chasses")] = 2;
    s.comparaison.moyenne[k("Fourmis perdues")] = 0;
    s.comparaison.moyenne[k("Pertes par M cm² chassé")] = 100000;
    const cartes = lire<any[]>(`SyntheseChasse.cartes(${json(s)})`);
    // 2 contre 4 : -50,0 % en rouge ; égal : 0,0 % sans couleur ; moyenne nulle : pas d'écart
    expect([cartes[0].detail, cartes[0].classeDetail]).toEqual([
      "-50,0 %",
      "o_syntheseEcartMoinsBien",
    ]);
    // pertes : 50 000 par M cm² contre 100 000, deux fois moins : en vert
    expect([cartes[4].detail, cartes[4].classeDetail]).toEqual(["-50,0 %", "o_syntheseEcartMieux"]);
    expect([cartes[1].detail, cartes[1].classeDetail]).toEqual(["0,0 %", ""]);
    expect([cartes[3].detail, cartes[3].classeDetail]).toEqual(["", ""]);
    // joueur sans chasse dans la période (absent du tableau) : pas d'écart
    const sans = JSON.parse(json(STATS));
    sans.comparaison.lignes = sans.comparaison.lignes.filter(
      (l: any[]) => String(l[0]).toLowerCase() != "doggybag",
    );
    expect(lire<any[]>(`SyntheseChasse.cartes(${json(sans)})`).every((c) => c.detail == "")).toBe(
      true,
    );
    // seul chasseur de la période, ou script au format 4 : chiffres sans écart
    s.comparaison.lignes = s.comparaison.lignes.slice(0, 1);
    expect(lire<any[]>(`SyntheseChasse.cartes(${json(s)})`).every((c) => c.detail == "")).toBe(
      true,
    );
    const { comparaison, ...format4 } = STATS;
    const html = lire<string>(`SyntheseChasse.html(${json(format4)})`);
    expect(html).not.toContain("Sous chaque chiffre");
    expect(html).toContain("Tableau des chasseurs : le script du Google Sheet n'est pas à jour.");
  });

  test("tableau des chasseurs : du plus grand terrain au plus petit, le joueur en gras, leur moyenne", () => {
    const html = lire<string>(`SyntheseChasse.tableau(${json(STATS)})`);
    const lignes = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) =>
      [...m[1]!.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) =>
        c[1]!.replace(/<[^>]+>/g, "").trim(),
      ),
    );
    expect(lignes).toEqual([
      [
        "Chasseur",
        "Terrain chassé (cm²)",
        "Terrain / multi-chasse",
        "Pertes",
        "Pertes / M cm² chassé",
        "Nourriture rapportée",
        "Nourriture / multi-chasse",
      ],
      ["● DoggyBag", "20 000", "10 000", "1 000", "50 000", "150 000", "75 000"],
      ["● Alpha", "6 000", "3 000", "200", "33 333", "45 000", "22 500"],
      ["● Bravo", "5 000", "5 000", "250", "50 000", "20 000", "20 000"],
      ["Moyenne des chasseurs", "10 333", "6 000", "483", "44 444", "71 667", "39 167"],
    ]);
    expect(html).toContain(
      "<tr class='o_syntheseMoi'><td><span style=\"color:#008300\">●</span> DoggyBag</td>",
    );
    // chaque chasseur avec sa couleur des graphiques
    expect(html).toContain('<span style="color:#2a78d6">●</span> Alpha');
    const s = JSON.parse(json(STATS));
    s.comparaison.lignes[0][0] = "<b>Alpha</b>";
    expect(lire<string>(`SyntheseChasse.tableau(${json(s)})`)).toContain(
      "&lt;b&gt;Alpha&lt;/b&gt;",
    );
  });

  test("pseudo, chasses et heures venus du fichier échappés", () => {
    const s = JSON.parse(json(STATS));
    s.joueur = "<img src=x onerror=alert(1)>";
    s.chasses.lignes[0][0] = "<i>Chasse 1</i>";
    expect(lire<string>(`SyntheseChasse.html(${json(s)})`)).toContain(
      "Synthèse de &lt;img src=x onerror=alert(1)&gt;",
    );
    const bulle = lire<string>(
      `SyntheseChasse.graphiques(${json(s)})[0].tooltip.formatter.call({ points: [{ point: { index: 0 }, color: "#000", series: { name: "<b>X</b>" }, y: 12000 }] })`,
    );
    expect(bulle).toBe(
      '<b>&lt;i&gt;Chasse 1&lt;/i&gt;</b> (retour 01/11 10:00)<br/><span style="color:#000">●</span> &lt;b&gt;X&lt;/b&gt; : <b>12 000</b>',
    );
    const point = lire<string>(
      `SyntheseChasse.graphiques(${json(s)})[2].tooltip.formatter.call({ series: { name: "<b>Y</b>" }, point: { name: "<u>p</u>" }, x: 12000, y: 90000 })`,
    );
    expect(point).toContain("&lt;b&gt;Y&lt;/b&gt;</b> · &lt;u&gt;p&lt;/u&gt;");
  });

  test("terrain, nourriture et pertes de chaque chasse : colonnes, deux courbes, trois axes", () => {
    const g = lire<any[]>(`SyntheseChasse.graphiques(${json(STATS)})`);
    expect(g.map((x) => [x.chart.type, x.title.text])).toEqual([
      [undefined, "Terrain, nourriture et pertes de chaque chasse"],
      [
        "line",
        "Terrain chassé à chaque chasse : toi, les autres chasseurs et la tendance de leur moyenne",
      ],
      ["scatter", "Nourriture selon le terrain chassé (un point par chasse)"],
      ["scatter", "Terrain chassé selon la difficulté par cm² (un point par chasse)"],
      ["line", "Pertes par M cm² de chaque chasse dans le temps"],
      ["area", "Armée envoyée à chaque chasse : nombre d'unités"],
    ]);
    const [triple] = g;
    // abscisse : « Chasse N (jj/mm) »
    expect(triple.xAxis.categories).toEqual(["Chasse 1 (01/11)", "Chasse 2 (03/11)"]);
    expect(triple.yAxis.map((a: any) => [a.title.text, !!a.opposite])).toEqual([
      ["Terrain (cm²)", false],
      ["Nourriture", true],
      ["Pertes", true],
    ]);
    expect(triple.series.map((x: any) => [x.type, x.name, x.yAxis, x.data])).toEqual([
      ["column", "Terrain chassé (cm²)", 0, [12000, 8000]],
      ["line", "Nourriture", 1, [90000, 60000]],
      ["line", "Pertes", 2, [600, 400]],
    ]);
    expect(
      lire(
        `SyntheseChasse.graphiques(${json(STATS)})[0].yAxis[1].labels.formatter.call({ value: 300000 })`,
      ),
    ).toBe("300 000");
  });

  test("terrain chassé : chaque chasseur en pointillés de sa couleur, les deux tendances en tirets", () => {
    const g = lire<any>(`SyntheseChasse.graphiques(${json(STATS)})[1]`);
    expect(g.title.text).toBe(
      "Terrain chassé à chaque chasse : toi, les autres chasseurs et la tendance de leur moyenne",
    );
    expect(g.xAxis.categories).toEqual(["Chasse 1 (01/11)", "Chasse 2 (03/11)"]);
    const series = Object.fromEntries(g.series.map((x: any) => [x.name, x]));
    // plus de courbe de la moyenne : seulement sa tendance
    expect(g.series.map((x: any) => x.name)).toEqual([
      "DoggyBag",
      "Alpha",
      "Bravo",
      "Tendance de la moyenne",
      "Ta tendance",
    ]);
    // les chasseurs : tous le même pointillé, la même épaisseur, sans points,
    // chacun sa couleur (le joueur en vert) ; les autres étirés sur ses deux chasses
    const chasseurs = ["DoggyBag", "Alpha", "Bravo"].map((n) => series[n]);
    expect(chasseurs.map((c: any) => [c.dashStyle, c.lineWidth, c.marker.enabled])).toEqual(
      Array(3).fill(["ShortDot", 2, false]),
    );
    expect(chasseurs.map((c: any) => c.data)).toEqual([
      [12000, 8000],
      [4000, 2000],
      [5000, 5000],
    ]);
    expect(series.DoggyBag.color).toBe("#008300");
    expect(new Set(chasseurs.map((c: any) => c.color)).size).toBe(3);
    expect(chasseurs.map((c: any) => c.color)).not.toContain("#e34948");
    // les tendances : en tirets longs, autres que les pointillés des chasseurs ;
    // la sienne en vert comme sa courbe, celle de la moyenne en rouge
    expect([series["Ta tendance"].color, series["Ta tendance"].dashStyle]).toEqual([
      "#008300",
      "LongDash",
    ]);
    expect([
      series["Tendance de la moyenne"].color,
      series["Tendance de la moyenne"].dashStyle,
    ]).toEqual(["#e34948", "LongDash"]);
    // mêmes valeurs que l'onglet du Sheet
    const colonne = (t: string) => lire(`SyntheseChasse.colonne(${json(STATS)}, ${json(t)})`);
    expect(series["Tendance de la moyenne"].data).toEqual(colonne("Tendance de la moyenne (cm²)"));
    expect(series["Ta tendance"].data).toEqual(colonne("Tendance (cm²)"));
    // aucune courbe épaisse (illisible, demande du mainteneur)
    expect(g.series.every((x: any) => x.lineWidth == 2)).toBe(true);
    // la légende cache ou montre un chasseur : la tendance de la moyenne suit
    expect(g.legend.enabled).toBe(true);
    expect(typeof g.plotOptions.series.events.hide).toBe("function");
  });

  test("chasseur caché par la légende : tendance de la moyenne recalculée sur ceux qui restent", () => {
    // trois chasseurs sur quatre chasses, et la tendance (pas un chasseur)
    const recalcul = (visibles: string[]) =>
      lire(`(() => {
        let faits = {}, redessine = 0,
          courbes = { A: [10, 20, 30, 40], B: [30, 30, 30, 30], C: [0, 0, 0, 100] },
          series = Object.keys(courbes).map((n) => ({ name: n, userOptions: { chasseur: true, data: courbes[n] }, visible: ${json(visibles)}.includes(n) }));
        series.push({ name: "Tendance de la moyenne", userOptions: { data: [9, 9, 9, 9] }, visible: true });
        SyntheseChasse.recalculer({
          series,
          get: (id) => ({ setData: (d) => (faits[id] = d) }),
          redraw: () => redessine++,
        });
        return [faits, redessine];
      })()`);
    // A et B : moyenne 20, 25, 30, 35, déjà une droite
    expect(recalcul(["A", "B"])).toEqual([{ o_tendanceMoyenne: [20, 25, 30, 35] }, 1]);
    // A et C : moyenne 5, 10, 15, 70 ; droite 25 + 20 × (x − 1,5), ramenée à 0 au départ
    expect(recalcul(["A", "C"])).toEqual([{ o_tendanceMoyenne: [0, 15, 35, 55] }, 1]);
    // personne : plus de tendance
    expect(recalcul([])).toEqual([{ o_tendanceMoyenne: [] }, 1]);
    // moyenne et tendance comme le script (arrondis, jamais négative)
    expect(lire(`SyntheseChasse.moyenne([[1, 2], [2, null], [4, 5]])`)).toEqual([2, 4]);
    expect(lire(`SyntheseChasse.tendance([100, 100, 100, 100000])`)).toEqual([
      0, 10090, 40060, 70030,
    ]);
  });

  test("nuages de points : nourriture selon le terrain, terrain selon la difficulté par cm²", () => {
    const [, , nourriture, difficulte] = lire<any[]>(`SyntheseChasse.graphiques(${json(STATS)})`);
    // sans « Comparer » : le joueur seul, un point par chasse
    expect(nourriture.series.map((x: any) => [x.name, x.color, x.data])).toEqual([
      [
        "DoggyBag",
        "#008300",
        [
          { x: 12000, y: 90000, name: "Chasse 1 (01/11)" },
          { x: 8000, y: 60000, name: "Chasse 2 (03/11)" },
        ],
      ],
    ]);
    expect(nourriture.legend.enabled).toBe(false);
    expect([nourriture.xAxis.title.text, nourriture.yAxis.title.text]).toEqual([
      "Terrain chassé (cm²)",
      "Nourriture",
    ]);
    // 1 000 criquets et 100 abeilles (73 360 points) sur 12 000 cm² : 6,11
    expect(difficulte.series[0].data).toEqual([
      { x: 6.11, y: 12000, name: "Chasse 1 (01/11)" },
      { x: 6.06, y: 8000, name: "Chasse 2 (03/11)" },
    ]);
    expect(difficulte.xAxis.title.text).toBe("Difficulté par cm² (faune rencontrée)");
    // axe des difficultés à partir de la plus petite (proches les unes des autres), pas de 0
    expect(difficulte.xAxis.min).toBeNull();
    expect(nourriture.xAxis.min).toBe(0);
    expect(
      lire(
        `SyntheseChasse.graphiques(${json(STATS)})[3].xAxis.labels.formatter.call({ value: 6.5 })`,
      ),
    ).toBe("6,5");
    expect(
      lire(
        `SyntheseChasse.graphiques(${json(STATS)})[3].tooltip.formatter.call({ series: { name: "DoggyBag" }, point: { name: "Chasse 1 (01/11)" }, x: 6.11, y: 12000 })`,
      ),
    ).toContain("Difficulté par cm² (faune rencontrée) : <b>6,11</b>");
    // avec : les leurs, à leur couleur, avec la date de leur chasse
    const avec = lire<any[]>(`SyntheseChasse.graphiques(${json(STATS)}, true)`);
    expect(avec[2].series.map((x: any) => x.name)).toEqual(["DoggyBag", "Alpha", "Bravo"]);
    expect(avec[2].series[1].data).toEqual([
      { x: 4000, y: 30000, name: "Chasse 1 (02/11)" },
      { x: 2000, y: 15000, name: "Chasse 2 (04/11)" },
    ]);
    expect(avec[3].series[2].data).toEqual([{ x: 3.53, y: 5000, name: "Chasse 1 (02/11)" }]);
    expect(avec[2].legend.enabled).toBe(true);
  });

  test("pertes par M cm² dans le temps : heure de retour en abscisse, moyenne en tirets", () => {
    const g = lire<any>(`SyntheseChasse.graphiques(${json(STATS)})[4]`);
    expect(g.xAxis.type).toBe("datetime");
    // heure du fichier, affichée telle quelle (Highcharts en UTC)
    expect(g.series[0].data).toEqual([
      [Date.UTC(2026, 10, 1, 10, 0), 50000],
      [Date.UTC(2026, 10, 3, 10, 0), 50000],
    ]);
    expect(g.yAxis.plotLines).toHaveLength(1);
    expect(g.yAxis.plotLines[0].value).toBe(50000);
    expect(g.yAxis.plotLines[0].dashStyle).toBe("Dash");
    // celle de la carte « Pertes / M cm² chassé » : pertes totales ÷ terrain total
    expect(g.subtitle.text).toBe("Moyenne de la période : 50 000 (tirets, le chiffre de la carte)");
    expect(
      lire(
        `SyntheseChasse.graphiques(${json(STATS)})[4].tooltip.formatter.call({ series: { name: "DoggyBag" }, x: ${Date.UTC(2026, 10, 1, 10, 0)}, y: 50000 })`,
      ),
    ).toBe("<b>DoggyBag</b> · 01/11 10:00<br/>Pertes par M cm² : <b>50 000</b>");
    const avec = lire<any>(`SyntheseChasse.graphiques(${json(STATS)}, true)[4]`);
    expect(avec.series[1].data).toEqual([
      [Date.UTC(2026, 10, 2, 9, 0), 25000],
      [Date.UTC(2026, 10, 4, 9, 0), 50000],
    ]);
    expect(JSON.stringify(g)).not.toContain("écart");
  });

  test("armée : unités empilées comme la page Statistiques du jeu, gardée telle quelle", () => {
    const armee = lire<any>(`SyntheseChasse.graphiques(${json(STATS)})[5]`);
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
    // pas de courbes des autres chasseurs dans le graphique de l'armée
    expect(lire(`SyntheseChasse.graphiques(${json(STATS)}, true)[5].series`)).toEqual(armee.series);
  });

  test("armée : vie, dégâts et temps de ponte hors bonus (unités de l'extension)", () => {
    const mesure = (m: number) => lire<any>(`SyntheseChasse.graphiqueArmee(${json(STATS)}, ${m})`);
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
    const s = JSON.parse(json(STATS));
    const debut = s.chasses.titres.indexOf("Nourriture") + 1;
    // dix unités présentes, de plus en plus nombreuses
    s.chasses.lignes = s.chasses.lignes.map((l: unknown[]) =>
      l.slice(0, debut).concat([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0, 0, 0, 0]),
    );
    const noms = (m: number) =>
      lire<any>(`SyntheseChasse.graphiqueArmee(${json(s)}, ${m})`).series.map((x: any) => [
        x.name,
        x.color,
      ]);
    expect(noms(0)).toHaveLength(8);
    expect(noms(0).at(-1)).toEqual(["Autres unités", "#898781"]);
    // sept tracées une à une dans l'ordre du jeu, les trois plus petites (JSN, SN, NE) regroupées
    expect(noms(0)[0][0]).toBe("Jeune Soldate");
    expect(noms(1)).toEqual(noms(0));
  });

  test("couleurs : le joueur en vert, chaque autre chasseur la sienne, la même partout", () => {
    // ordre du fichier sans le joueur : Alpha, Bravo
    expect(STATS.chasseurs).toEqual(["Alpha", "Bravo", "DoggyBag"]);
    const style = (s: unknown, j: string) => lire(`SyntheseChasse.style(${json(s)}, ${json(j)})`);
    expect(style(STATS, "doggybag")).toEqual({ color: "#008300", dashStyle: "Solid" });
    expect(style(STATS, "Alpha")).toEqual({ color: "#2a78d6", dashStyle: "ShortDot" });
    expect(style(STATS, "Bravo")).toEqual({ color: "#eb6834", dashStyle: "ShortDot" });
    const avec = lire<any[]>(`SyntheseChasse.graphiques(${json(STATS)}, true)`);
    for (const g of [avec[1], avec[2], avec[3], avec[4]]) {
      const couleurs = Object.fromEntries(g.series.map((x: any) => [x.name, x.color]));
      expect([couleurs.DoggyBag, couleurs.Alpha, couleurs.Bravo]).toEqual([
        "#008300",
        "#2a78d6",
        "#eb6834",
      ]);
    }
    // du 7e au 12e autre chasseur : une nuance de chaque couleur, même pointillé ;
    // au-delà, les mêmes couleurs avec un autre pointillé
    const s = { ...STATS, chasseurs: Array.from({ length: 14 }, (_, i) => `J${i}`) };
    expect(style(s, "j6")).toEqual({ color: "#65a8ff", dashStyle: "ShortDot" });
    expect(style(s, "j9")).toEqual({ color: "#9d6a06", dashStyle: "ShortDot" });
    expect(style(s, "j12")).toEqual({ color: "#2a78d6", dashStyle: "ShortDashDot" });
    const couleurs = Array.from({ length: 12 }, (_, i) => (style(s, `j${i}`) as any).color);
    expect(new Set(couleurs).size).toBe(12);
    expect(couleurs).not.toContain("#008300");
    expect(couleurs).not.toContain("#e34948");
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

  test("30 derniers jours par défaut (horloge du serveur), résultats à la demande, avec les autres chasseurs", async () => {
    ouvrir();
    expect(lire(`[$("#o_syntheseDebut").val(), $("#o_syntheseFin").val()]`)).toEqual([
      "2026-10-10",
      "2026-11-08",
    ]);
    expect(envois).toEqual([]);
    periode();
    await lire(`SYNTHESE.charger()`);
    expect(envois[0].corps).toEqual({ ...demande, autres: true, format: 5 });
    expect(lire(`$("#o_syntheseResultat").text()`)).toContain("Synthèse de DoggyBag");
    expect(lire(`$("#o_syntheseAfficher").prop("disabled")`)).toBe(false);
  });

  test("page sans Highcharts : chiffres et lien vers la Messagerie ; avec : six graphiques, remplacés au clic suivant", async () => {
    ouvrir();
    await lire(`SYNTHESE.charger()`);
    expect(lire(`$(".o_syntheseGraphiques a").attr("href")`)).toBe("/messagerie.php");
    expect(lire(`$(".o_syntheseCarte").length`)).toBe(11);
    avecHighcharts();
    await lire(`SYNTHESE.charger()`);
    expect(lire(`CREES.map((c) => c[0])`)).toEqual(Array(6).fill("o_syntheseTrace"));
    expect(lire(`$(".o_syntheseGraphique").length`)).toBe(6);
    await lire(`SYNTHESE.charger()`);
    expect(lire(`DETRUITS`)).toBe(6);
    expect(lire(`$(".o_syntheseGraphique").length`)).toBe(6);
  });

  test("« Comparer aux autres chasseurs » : leurs points ajoutés sans requête ; choix retenu", async () => {
    ouvrir();
    avecHighcharts();
    periode();
    await lire(`SYNTHESE.charger()`);
    expect(envois).toHaveLength(1);
    // le graphique du terrain les montre toujours, les nuages et les pertes pas encore
    expect(lire(`CREES.at(-5)[2]`)).toContain("Alpha");
    expect(lire(`CREES.at(-4)[2]`)).toEqual(["DoggyBag"]);
    lire(`$("#o_syntheseAutres").prop("checked", true).trigger("change")`);
    expect(envois).toHaveLength(1);
    expect(lire(`CREES.at(-4)[2]`)).toEqual(["DoggyBag", "Alpha", "Bravo"]);
    expect(lire(`CREES.at(-2)[2]`)).toEqual(["DoggyBag", "Alpha", "Bravo"]);
    lire(`$("#o_syntheseAutres").prop("checked", false).trigger("change")`);
    expect(lire(`CREES.at(-4)[2]`)).toEqual(["DoggyBag"]);
    expect(envois).toHaveLength(1);
    lire(`$("#o_syntheseAutres").prop("checked", true).trigger("change")`);
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
    expect(lire(`CREES.at(-1)[1]`)).toBe("Armée envoyée à chaque chasse : vie");
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
