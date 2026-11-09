import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { classeurSimule, feuille } from "./sheet-simule";

/**
 * Statistiques de chasse du script du Google Sheet
 * (google-sheet/export-rapports.gs) : un seul calcul (statistiques) pour
 * l'onglet « Statistiques » du fichier (STATS_OUAF) et pour l'onglet
 * « Synthèse » de l'extension (requête statistiques). Données inventées
 * (aucun RC réel dans le dépôt public).
 */
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
let n = 0;
const cle = () => `k${++n}`;
const chasse = (
  par: string,
  date: string,
  terrain: number,
  nourriture: number,
  pertes: number,
  troupes: string,
  experience: string[] = [],
) => [
  cle(),
  par,
  date,
  terrain,
  nourriture,
  pertes,
  troupes,
  "10 Criquets",
  rc(troupes, pertes, experience),
];
// texte d'un RC de chasse, avec l'expérience gagnée par les survivantes
function rc(troupes: string, morts: number, experience: string[]) {
  return (
    `Troupes en attaque : ${troupes}.\nTroupes en défense : 10 Criquets.\n\n` +
    `L’ennemie inflige 1 (+ 0) dégâts à vos fourmis et en tue ${morts}.\n\nVous avez gagné cette bataille !\n\n` +
    (experience.length
      ? `Les unités survivantes ont appris de cette bataille :\n${experience.map((e) => `- ${e}`).join("\n")}\n\n`
      : "") +
    "Vos chasseuses ont conquis 1 cm²"
  );
}

// trois chasses d'Alpha (une multi-chasse de trois expéditions, une chasse
// seule, une multi-chasse en chaîne), deux de Bravo, une de Charlie
function donnees() {
  return {
    chasse: [
      CHASSE,
      chasse("Delta", "2026-10-15 10:00", 1, 1, 1, "1 Tank"), // hors période
      chasse("Alpha", "2026-10-31 23:59", 999, 999, 999, "1 Tank"), // la veille
      // retours à 12:44, 12:44 et 12:46 : une multi-chasse
      chasse(
        "Alpha",
        "2026-11-01 12:44",
        8000,
        60000,
        400,
        "3 000 Jeunes Soldates Naines, 800 Naines d’Elites",
        ["60 Jeunes Soldates Naines sont devenues des Soldates Naines"],
      ),
      chasse(
        "Alpha",
        "2026-11-01 12:44",
        8000,
        62000,
        400,
        "2 000 Soldates Naines, 1 Naine d’Elite, 6 000 Jeunes Soldates",
        [
          "33 Soldates Naines sont devenues des Naines d’Elites",
          "49 Jeunes Soldates sont devenues des Soldates",
        ],
      ),
      chasse("Alpha", "2026-11-01 12:46", 8000, 64000, 400, "10 000 Artilleuses d’élites"),
      // six minutes après la précédente : une autre chasse, seule
      chasse("Alpha", "2026-11-01 12:52", 6000, 45000, 600, "1 000 Tanks d’élites, 500 Tueuses", [
        "1 Tueuse est devenue une Tueuse d’élite",
      ]),
      // 20:00, 20:04, 20:08 : chacune à moins de cinq minutes de la précédente
      // (« alpha » : même joueur, casse ignorée)
      chasse("alpha", "2026-11-02 20:00", 5000, 40000, 100, "4 000 Jeunes Soldates Naines", [
        "2 Jeunes Soldates Naines sont devenues des Soldates Naines",
      ]),
      chasse("Alpha", "2026-11-02 20:04", 5000, 41000, 100, "100 Concierges"),
      // 100 morts pour 10 Soldates envoyées : 10 comptées
      chasse("Alpha", "2026-11-02 20:08", 5000, 42000, 100, "10 Soldates, 10 Criquets"),
      chasse("Alpha", "2026-11-08 08:00", 5000, 40000, 0, "1 Tank"), // après la période
      chasse("Bravo", "2026-11-01 10:00", 7000, 50000, 700, "1 Tueuse"),
      chasse("bravo", "2026-11-01 10:03", 3000, 20000, 300, "1 Tueuse"),
      chasse("Bravo", "2026-11-02 09:00", 2000, 10000, 100, "1 Tueuse"),
      chasse("Charlie", "2026-11-02 11:00", 1000, 5000, 10, "1 Tank"),
    ],
  };
}

const script = () => classeurSimule({}).script;
const calcul = (
  d: { chasse: unknown[][] } = donnees(),
  debut = "2026-11-01",
  fin = "2026-11-07",
  autres = false,
) => script().statistiques(d, "Alpha", debut, fin, "Europe/Paris", autres);
const valeur = (resume: [string, unknown][], libelle: string) =>
  resume.find((l) => l[0] == libelle)?.[1];

describe("calcul des statistiques de chasse", () => {
  const s = calcul();

  test("chasses du joueur (casse ignorée), jours compris, autres joueurs et autres jours exclus", () => {
    expect(s.resume).toEqual([
      ["Chasses (RC)", 7],
      ["Multi-chasses", 3],
      ["Terrain chassé (cm²)", 45000],
      ["Fourmis perdues", 2100],
      // 2 100 pertes pour 45 000 cm² : 46 667 par million de cm²
      ["Pertes par M cm² chassé", 46667],
      ["Nourriture rapportée", 354000],
      // trois multi-chasses (une chasse seule en est une)
      ["Nourriture par multi-chasse", 118000],
    ]);
  });

  test("une ligne par chasse (simple ou multi-chasse, résultats additionnés), « Chasse 1 (01/11) »…", () => {
    expect(s.chasses.titres.slice(0, 13)).toEqual([
      "Chasse",
      "Retour",
      "Date",
      "Expéditions",
      "Terrain (cm²)",
      "Tendance (cm²)",
      "Moyenne des chasseurs (cm²)",
      "Tendance de la moyenne (cm²)",
      "Pertes",
      "Pertes / M cm²",
      "Moyenne (pertes / M cm²)",
      "Difficulté / cm²",
      "Nourriture",
    ]);
    // pertes par million de cm² 50 000, 100 000 et 20 000 ; moyenne de la période
    // celle du résumé : 2 100 pertes ÷ 45 000 cm² = 46 667 ;
    // tendance du terrain (24 000, 6 000, 15 000) : 19 500, 15 000, 10 500 ;
    // moyenne avec Bravo (10 000 et 2 000, étirés en 10 000, 6 000, 2 000) et
    // Charlie (1 000) : 11 667, 4 333, 6 000, sa tendance 10 167, 7 333, 4 500 ;
    // difficulté : dix criquets (58,9 points) par expédition, divisés par le terrain
    expect(s.chasses.lignes.map((l: unknown[]) => l.slice(0, 13))).toEqual([
      [
        "Chasse 1 (01/11)",
        "01/11 12:44",
        46327 + (12 * 60 + 44) / 1440,
        3,
        24000,
        19500,
        11667,
        10167,
        1200,
        50000,
        46667,
        0.07,
        186000,
      ],
      [
        "Chasse 2 (01/11)",
        "01/11 12:52",
        46327 + (12 * 60 + 52) / 1440,
        1,
        6000,
        15000,
        4333,
        7333,
        600,
        100000,
        46667,
        0.1,
        45000,
      ],
      [
        "Chasse 3 (02/11)",
        "02/11 20:00",
        46328 + 20 / 24,
        3,
        15000,
        10500,
        6000,
        4500,
        300,
        20000,
        46667,
        0.12,
        123000,
      ],
    ]);
  });

  test("courbes étirées sur les chasses du joueur, moyenne point par point", () => {
    const sc = script();
    // même début et même fin, valeurs intermédiaires interpolées
    expect(sc.etirer([10000, 2000], 3)).toEqual([10000, 6000, 2000]);
    expect(sc.etirer([0, 100, 50, 200], 7)).toEqual([0, 50, 100, 75, 50, 125, 200]);
    // plus de chasses que le joueur : resserrée ; une seule chasse : le milieu
    expect(sc.etirer([10, 20, 30, 40, 50], 3)).toEqual([10, 30, 50]);
    expect(sc.etirer([10, 20, 30], 1)).toEqual([20]);
    expect(sc.etirer([7], 4)).toEqual([7, 7, 7, 7]);
    expect(sc.etirer([], 3)).toEqual([]);
    expect(sc.etirer([5], 0)).toEqual([]);
    expect(
      sc.moyenneDesCourbes([
        [24000, 6000, 15000],
        [10000, 6000, 2000],
        [1000, 1000, 1000],
      ]),
    ).toEqual([11667, 4333, 6000]);
    expect(sc.moyenneDesCourbes([[3, 4]])).toEqual([3, 4]);
  });

  test("difficulté d'une chasse : points de la faune rencontrée, noms au singulier ou au pluriel", () => {
    const sc = script();
    // 1 234 × 58,9 + 2 × 890,7 + 1 × 23,2
    expect(sc.difficulteDe("1 234 Criquets, 2 Mantes religieuses, 1 Petite araignée")).toBeCloseTo(
      74487.2,
      6,
    );
    expect(sc.difficulteDe("3 Souris, 1 Souris")).toBe(4 * 2405.25);
    expect(sc.difficulteDe("2 Guèpes.")).toBe(152.1);
    expect(sc.difficulteDe("5 Dragons")).toBe(0);
    expect(sc.difficulteDe(undefined)).toBe(0);
    expect(sc.difficulteParCm2({ terrain: 0, difficulte: 10 })).toBe("");
  });

  test("troupes de chaque chasse par unité (après « Nourriture »), noms au singulier ou au pluriel", () => {
    const debut = s.chasses.titres.indexOf("Nourriture") + 1,
      unites = s.chasses.titres.slice(debut);
    expect(unites).toHaveLength(14);
    const armee = (i: number) =>
      Object.fromEntries(
        unites
          .map((u: string, k: number) => [u, s.chasses.lignes[i][debut + k]])
          .filter((x: unknown[]) => x[1]),
      );
    expect(armee(0)).toEqual({
      "Jeune Soldate Naine": 3000,
      "Soldate Naine": 2000,
      "Naine d'Elite": 801,
      "Jeune Soldate": 6000,
      "Artilleuse d'élite": 10000,
    });
    expect(armee(1)).toEqual({ "Tank d'élite": 1000, Tueuse: 500 });
    // unité inconnue (« Criquets ») ignorée
    expect(armee(2)).toEqual({ "Jeune Soldate Naine": 4000, Soldate: 10, Concierge: 100 });
  });

  test("armée : la première multi-chasse, puis ses pertes et son expérience aux chasses, sans les pontes", () => {
    expect(s.armee.titres.slice(1, 3)).toEqual([
      "Première multi-chasse",
      "Après les chasses, sans les pontes",
    ]);
    // morts (dans l'ordre de l'armée) et expérience de chaque chasse, rapportées
    // à ses troupes, puis appliquées à la suite : unités 1 − 1 200 / 21 801,
    // 1 − 600 / 1 500, 1 − 210 / 4 110 ; FdF 1 − 16 769 / 434 607,
    // 1 − 47 995 / 105 000, 1 − 546 / 12 250
    expect(s.armee.lignes).toEqual([
      // 3 000 × 3 + 2 000 × 5 + 801 × 7 + 6 000 × 10 + 10 000 × 35
      ["FdF", 434607, 216735, -50.1],
      ["Défense", 252806, 174608, -30.9],
      ["Vie", 270413, 137682, -49.1],
      ["Capacité de flood (unités)", 21801, 11729, -46.2],
    ]);
  });

  test("armée : plus de morts dans la période que d'unités au départ (pontes entre-temps), jamais négative", () => {
    const d = donnees();
    // dix chasses de 1 000 JSN qui en perdent chacune 900
    for (let i = 0; i < 10; i++)
      d.chasse.push(
        chasse(
          "Echo",
          `2026-11-0${1 + (i % 6)} 1${i}:00`,
          100,
          100,
          900,
          "1 000 Jeunes Soldates Naines",
        ),
      );
    const e = script().statistiques(d, "Echo", "2026-11-01", "2026-11-07", "Europe/Paris");
    // 1 000 × 0,1¹⁰ : il ne reste rien, sans passer sous zéro
    expect(e.armee.lignes[3]).toEqual(["Capacité de flood (unités)", 1000, 0, -100]);
  });

  test("armée : baisse plus petite que l'arrondi, variation 0 et pas -0", () => {
    const d = donnees();
    d.chasse.push(chasse("Echo", "2026-11-01 10:00", 100, 100, 1, "10 000 Jeunes Soldates Naines"));
    const e = script().statistiques(d, "Echo", "2026-11-01", "2026-11-07", "Europe/Paris");
    // 9 999 sur 10 000 : -0,01 %, arrondi au dixième
    expect(e.armee.lignes[3]).toEqual(["Capacité de flood (unités)", 10000, 9999, 0]);
    expect(Object.is(e.armee.lignes[3][3], -0)).toBe(false);
  });

  test("effet d'une chasse sur l'armée : morts dans l'ordre de l'armée, puis expérience du RC", () => {
    const sc = script();
    const texte = rc("3 000 Jeunes Soldates Naines, 800 Naines d’Elites", 3100, [
      "60 Naines d’Elites sont devenues des Soldates",
      "1 Naine d’Elite est devenue une Jeune Soldate",
      "5 Criquets sont devenus des Lézards",
    ]);
    expect(sc.experienceDe(texte)).toEqual([
      { nombre: 60, de: 2, vers: 4 },
      { nombre: 1, de: 2, vers: 3 },
    ]);
    // 3 100 morts : les 3 000 JSN, puis 100 NE ; ensuite l'expérience
    const v = sc.variationDe("3 000 Jeunes Soldates Naines, 800 Naines d’Elites", 3100, texte);
    expect(v.slice(0, 5)).toEqual([-3000, 0, -161, 1, 60]);
    expect(sc.experienceDe("")).toEqual([]);
    expect(sc.experienceDe(undefined)).toEqual([]);
    expect(sc.rangUnite("Artilleuses d’élites")).toBe(8);
    expect(sc.rangUnite("Fourmi volante")).toBe(-1);
  });

  test("tendance : droite des moindres carrés des chasses dans l'ordre, jamais négative", () => {
    const t = script().tendance;
    expect(t([])).toEqual([]);
    expect(t([5])).toEqual([5]);
    expect(t([0, 10, 20])).toEqual([0, 10, 20]);
    expect(t([30, 20, 10, 0])).toEqual([30, 20, 10, 0]);
    // forte hausse à la dernière chasse : la droite passerait sous 0 à la
    // première (25 075 − 1,5 × 29 970), ramenée à 0
    const r = t([100, 100, 100, 100000]);
    expect(r).toEqual([0, 10090, 40060, 70030]);
    expect(r.some((v: number) => Object.is(v, -0))).toBe(false);
  });

  test("premier et dernier jours compris, pas au-delà", () => {
    const rc = (debut: string, fin: string) =>
      valeur(calcul(donnees(), debut, fin).resume, "Chasses (RC)");
    // chasses du 02/11 à 20:00 : comptées jusqu'au 02/11, pas jusqu'au 01/11
    expect(rc("2026-11-01", "2026-11-02")).toBe(7);
    expect(rc("2026-11-01", "2026-11-01")).toBe(4);
    expect(rc("2026-11-02", "2026-11-02")).toBe(3);
  });

  test("dates du fichier (objets Date) : le jour et la minute sont ceux du fuseau du fichier", () => {
    const d = donnees();
    // 31/10 23:59 à Paris = 31/10 22:59 UTC ; 01/11 12:44 à Paris = 01/11 11:44 UTC
    (d.chasse[2] as unknown[])[2] = new Date(Date.UTC(2026, 9, 31, 22, 59));
    (d.chasse[3] as unknown[])[2] = new Date(Date.UTC(2026, 10, 1, 11, 44));
    const r = calcul(d);
    expect(valeur(r.resume, "Chasses (RC)")).toBe(7);
    expect(r.chasses.lignes[0].slice(0, 4)).toEqual([
      "Chasse 1 (01/11)",
      "01/11 12:44",
      46327 + (12 * 60 + 44) / 1440,
      3,
    ]);
  });

  test("aucune donnée, onglet absent ou jamais rempli : des zéros, pas d'erreur", () => {
    for (const chasses of [
      [],
      [[""]],
      [
        ["", ""],
        ["", ""],
      ],
    ]) {
      const vide = calcul({ chasse: chasses as unknown[][] });
      expect(valeur(vide.resume, "Chasses (RC)")).toBe(0);
      expect(valeur(vide.resume, "Pertes par M cm² chassé")).toBe("");
      expect(valeur(vide.resume, "Nourriture par multi-chasse")).toBe("");
      expect(vide.armee.lignes.map((l: unknown[]) => l.slice(1))).toEqual([
        ["", "", ""],
        ["", "", ""],
        ["", "", ""],
        ["", "", ""],
      ]);
      expect(vide.chasses.lignes).toEqual([]);
    }
  });

  test("colonne renommée à la main : erreur explicite plutôt qu'un chiffre faux", () => {
    const d = donnees();
    d.chasse[0] = CHASSE.map((t) => (t == "Nourriture" ? "Bouffe" : t));
    expect(() => calcul(d)).toThrow("colonne « Nourriture » introuvable");
  });

  test("courbes des autres chasseurs seulement si demandées, chasse par chasse", () => {
    expect(s.autres).toEqual([]);
    const a = calcul(donnees(), "2026-11-01", "2026-11-07", true);
    // « bravo » : même chasseur ; 10:00 et 10:03 : une multi-chasse
    expect(a.autres).toEqual([
      {
        joueur: "Bravo",
        terrain: [10000, 2000],
        pertes: [100000, 50000],
        nourriture: [70000, 10000],
        // 20 criquets sur 10 000 cm², 10 sur 2 000
        difficulte: [0.12, 0.29],
        dates: [46327 + 10 / 24, 46328 + 9 / 24],
        // terrain étiré sur les trois chasses d'Alpha
        etire: [10000, 6000, 2000],
      },
      {
        joueur: "Charlie",
        terrain: [1000],
        pertes: [10000],
        nourriture: [5000],
        difficulte: [0.59],
        dates: [46328 + 11 / 24],
        etire: [1000, 1000, 1000],
      },
    ]);
    // le reste ne change pas
    expect({ ...a, autres: [] }).toEqual(s);
  });

  test("chasseurs de la période : leurs chiffres et la moyenne entre eux (chacun compte autant)", () => {
    expect(s.comparaison.titres).toEqual([
      "Chasseur",
      "Chasses (RC)",
      "Multi-chasses",
      "Terrain chassé (cm²)",
      "Terrain par multi-chasse (cm²)",
      "Fourmis perdues",
      "Pertes par M cm² chassé",
      "Nourriture rapportée",
      "Nourriture par multi-chasse",
    ]);
    // Delta n'a pas chassé dans la période ; Bravo : 10:00 et 10:03 font une multi-chasse
    expect(s.comparaison.lignes).toEqual([
      ["Alpha", 7, 3, 45000, 15000, 2100, 46667, 354000, 118000],
      ["Bravo", 3, 2, 12000, 6000, 1100, 91667, 80000, 40000],
      ["Charlie", 1, 1, 1000, 1000, 10, 10000, 5000, 5000],
    ]);
    // au dixième : (7 + 3 + 1) / 3 = 3,7 ; (46 667 + 91 667 + 10 000) / 3 = 49 444,7
    expect(s.comparaison.moyenne).toEqual([
      "Moyenne des chasseurs",
      3.7,
      2,
      19333.3,
      7333.3,
      1070,
      49444.7,
      146333.3,
      54333.3,
    ]);
    // aucun chasseur dans la période : pas de moyenne
    expect(calcul(donnees(), "2026-12-01", "2026-12-07").comparaison).toEqual({
      titres: s.comparaison.titres,
      lignes: [],
      moyenne: ["Moyenne des chasseurs", "", "", "", "", "", "", "", ""],
    });
  });

  test("chasseurs du fichier, période ou pas, toujours dans le même ordre : une couleur chacun", () => {
    expect(s.chasseurs).toEqual(["Alpha", "Bravo", "Charlie", "Delta"]);
    expect(s.format).toBe(5);
  });

  test("faune du script : celle de l'extension (noms, points de difficulté)", () => {
    const content = readFileSync(join(import.meta.dir, "..", "public", "js", "content.js"), "utf8");
    const faune = [
      ...content.matchAll(
        /\{ nom: "([^"]+)", slug: "[^"]+", fdf: [\d.]+, vie: [\d.]+, diff: ([\d.]+) \}/g,
      ),
    ].map((m) => ({ nom: m[1], diff: Number(m[2]) }));
    expect(faune).toHaveLength(17);
    expect(script().FAUNE).toEqual(faune);
  });

  test("unités du script : celles de l'extension (noms, vie, attaque, défense)", () => {
    const content = readFileSync(join(import.meta.dir, "..", "public", "js", "content.js"), "utf8");
    const tableau = (nom: string) =>
      JSON.parse(
        new RegExp(`const ${nom} = (\\[[^\\]]*\\])`).exec(content)![1]!.replace(/,\s*\]$/, "]"),
      );
    const [noms, pluriels, vie, att, def] = [
      "NOM_UNITE",
      "NOM_UNITES",
      "VIE_UNITE",
      "ATT_UNITE",
      "DEF_UNITE",
    ].map(tableau);
    const sc = script();
    expect(sc.UNITES).toHaveLength(14);
    sc.UNITES.forEach((u: any, i: number) => {
      // indice 0 de l'extension : les ouvrières, qui ne chassent pas
      expect([u.vie, u.att, u.def]).toEqual([vie[i + 1], att[i + 1], def[i + 1]]);
      const un = sc.unitesDe(`1 ${noms[i + 1]}`),
        deux = sc.unitesDe(`2 ${pluriels[i + 1]}`);
      expect([un[i], un.reduce((a: number, b: number) => a + b)]).toEqual([1, 1]);
      expect([deux[i], deux.reduce((a: number, b: number) => a + b)]).toEqual([2, 2]);
    });
    expect(sc.unitesDe("").every((x: number) => x == 0)).toBe(true);
    expect(sc.unitesDe(undefined).every((x: number) => x == 0)).toBe(true);
  });
});

describe("onglet « Statistiques » du fichier (STATS_OUAF)", () => {
  // B3:B6 (joueur, premier et dernier jour, contrôle) ; onglet lu dans le fichier
  const sortie = (
    joueur: unknown,
    debut: unknown,
    fin: unknown,
    grille: unknown[][] = donnees().chasse,
  ) =>
    classeurSimule({ "BDD chasse": feuille("BDD chasse", grille, 2000) }).script.STATS_OUAF([
      [joueur],
      [debut],
      [fin],
      [123],
    ]) as unknown[][];
  // colonne de départ de chaque bloc (à partir de D : 0)
  const blocs = { resume: 0, comparaison: 4, armee: 12, chasses: 17, joueurs: 45, autres: 47 };

  test("mêmes résultats que la synthèse de l'extension, blocs côte à côte", () => {
    const o = sortie(
      "Alpha",
      new Date(Date.UTC(2026, 9, 31, 23)),
      new Date(Date.UTC(2026, 10, 7, 12)),
    );
    const s = calcul();
    expect(o[0]![blocs.resume]).toBe("Résumé");
    expect(o[1]!.slice(blocs.resume, blocs.resume + 3)).toEqual([
      "Indicateur",
      "Valeur",
      "Écart à la moyenne des chasseurs",
    ]);
    expect(o.slice(2, 2 + s.resume.length).map((l) => l.slice(0, 2))).toEqual(s.resume);
    // écart à la moyenne d'Alpha, Bravo et Charlie, en % au dixième : 7 chasses
    // contre 3,7 (+89,2 %), 46 667 pertes par M cm² contre 49 444,7 (-5,6 %)…
    expect(o.slice(2, 2 + s.resume.length).map((l) => l[2])).toEqual([
      89.2, 50, 132.8, 96.3, -5.6, 141.9, 117.2,
    ]);
    // tableau des chasseurs, celui de la synthèse : du plus grand terrain au
    // plus petit, puis leur moyenne
    expect(o[0]![blocs.comparaison]).toBe("Chasseurs de la période");
    expect(o.slice(1, 6).map((l) => l.slice(blocs.comparaison, blocs.comparaison + 7))).toEqual([
      [
        "Chasseur",
        "Terrain chassé (cm²)",
        "Terrain / multi-chasse",
        "Pertes",
        "Pertes / M cm² chassé",
        "Nourriture rapportée",
        "Nourriture / multi-chasse",
      ],
      ["Alpha", 45000, 15000, 2100, 46667, 354000, 118000],
      ["Bravo", 12000, 6000, 1100, 91667, 80000, 40000],
      ["Charlie", 1000, 1000, 10, 10000, 5000, 5000],
      ["Moyenne des chasseurs", 19333.3, 7333.3, 1070, 49444.7, 146333.3, 54333.3],
    ]);
    expect(o[6]![blocs.comparaison]).toBe("");
    expect(o[0]![blocs.armee]).toBe("Armée (hors bonus)");
    expect(o.slice(2, 6).map((l) => l.slice(blocs.armee, blocs.armee + 4))).toEqual(s.armee.lignes);
    expect(o[0]![blocs.chasses]).toBe("Chasses");
    expect(o[1]!.slice(blocs.chasses, blocs.chasses + 27)).toEqual(s.chasses.titres);
    expect(o.slice(2, 5).map((l) => l.slice(blocs.chasses, blocs.chasses + 27))).toEqual(
      s.chasses.lignes,
    );
    expect(o[0]![blocs.joueurs]).toBe("Chasseurs");
    // une colonne par autre chasseur du fichier, son terrain étiré sur les
    // chasses d'Alpha ; vide pour Delta, qui n'a pas chassé dans la période
    expect(o[0]![blocs.autres]).toBe("Autres chasseurs : terrain étiré sur tes chasses (cm²)");
    expect(o.slice(1, 5).map((l) => l.slice(blocs.autres))).toEqual([
      ["Bravo", "Charlie", "Delta"],
      [10000, 1000, ""],
      [6000, 1000, ""],
      [2000, 1000, ""],
    ]);
    // tableau rectangulaire (exigé par le tableur), rien après les autres chasseurs
    expect(new Set(o.map((l) => l.length)).size).toBe(1);
    expect(o[0]).toHaveLength(blocs.autres + 3);
  });

  test("seul chasseur de la période : pas d'écart, son tableau et la moyenne (lui)", () => {
    const seul = donnees().chasse.filter((l, i) => i == 0 || String(l[1]).toLowerCase() == "alpha");
    const o = sortie("Alpha", "2026-11-01", "2026-11-07", seul);
    expect(o.slice(2, 9).every((l) => l[blocs.resume + 2] === "")).toBe(true);
    expect(o.slice(2, 5).map((l) => l.slice(blocs.comparaison, blocs.comparaison + 2))).toEqual([
      ["Alpha", 45000],
      ["Moyenne des chasseurs", 45000],
      ["", ""],
    ]);
    // aucun joueur choisi : message, ni écart ni tableau
    const vide = sortie("", "2026-11-01", "2026-11-07");
    expect(vide[2]!.slice(0, 3)).toEqual(["Choisis un joueur (case B3).", "", ""]);
    expect(vide.slice(1, 4).map((l) => l[blocs.comparaison])).toEqual(["", "", ""]);
  });

  test("liste des joueurs de la case « Joueur » : les chasseurs du fichier, sans doublon de casse", () => {
    const liste = sortie("Alpha", "2026-11-01", "2026-11-07")
      .slice(2)
      .map((l) => l[blocs.joueurs])
      .filter(Boolean);
    expect(liste).toEqual(["Alpha", "Bravo", "Charlie", "Delta"]);
  });

  test("plus de chasses que de lignes dans l'onglet : les plus récentes, et le titre le dit", () => {
    const grille: unknown[][] = [CHASSE];
    // 1 000 chasses à dix minutes d'écart : autant de chasses distinctes
    for (let i = 0; i < 1000; i++) {
      const t = new Date(Date.UTC(2026, 10, 1) + i * 600000).toISOString();
      grille.push(chasse("Alpha", `${t.slice(0, 10)} ${t.slice(11, 16)}`, 10, i, 1, "1 Tank"));
    }
    const o = sortie("Alpha", "2026-11-01", "2026-11-07", grille);
    expect(o).toHaveLength(1000);
    expect(o[0]![blocs.chasses]).toBe("Chasses (les 998 dernières lignes)");
    // dernière ligne : la 1 000e chasse (nourriture 999), première affichée : la 3e
    expect(o[999]!.slice(blocs.chasses, blocs.chasses + 2)).toEqual([
      "Chasse 1000 (07/11)",
      "07/11 22:30",
    ]);
    // « Nourriture » : 13e colonne du bloc
    expect(o[999]![blocs.chasses + 12]).toBe(999);
    expect(o[2]![blocs.chasses]).toBe("Chasse 3 (01/11)");
    expect(o[0]![blocs.resume]).toBe("Résumé");
  });

  test("joueur ou jours manquants, jours inversés : message à la place du résumé", () => {
    expect(sortie("", "2026-11-01", "2026-11-07")[2]![0]).toBe("Choisis un joueur (case B3).");
    expect(sortie("Alpha", "", "2026-11-07")[2]![0]).toContain("premier et le dernier jour");
    expect(sortie("Alpha", "2026-11-07", "2026-11-01")[2]![0]).toBe(
      "Le premier jour est après le dernier.",
    );
    expect(sortie("Alpha", "2020-01-01", "2026-11-01")[2]![0]).toContain("trois ans au plus");
  });
});

describe("requête « statistiques » de l'extension", () => {
  const fichier = () => classeurSimule({ "BDD chasse": feuille("BDD chasse", donnees().chasse) });
  const corps = { statistiques: true, joueur: "Alpha", debut: "2026-11-01", fin: "2026-11-07" };

  test("résultats identiques au calcul direct, courbes des autres sur demande, sans écriture", () => {
    const f = fichier();
    expect(f.doPost({ ...corps, format: 5 }).statistiques).toEqual(calcul());
    expect(f.doPost({ ...corps, format: 5, autres: true }).statistiques).toEqual(
      calcul(donnees(), "2026-11-01", "2026-11-07", true),
    );
    expect(Object.keys(f.onglets)).toEqual(["BDD chasse"]);
  });

  test("extension 1.94 : réponse au format 4 qu'elle demande, le tableau des chasseurs en plus", () => {
    const r = fichier().doPost({ ...corps, autres: true, format: 4 }).statistiques;
    expect(r.format).toBe(4);
    expect({ ...r, format: 5 }).toEqual(calcul(donnees(), "2026-11-01", "2026-11-07", true));
  });

  test("extension d'avant le format 4 : réponse au format 3, qu'elle lit toujours", () => {
    const r = fichier().doPost({ ...corps, autres: true }).statistiques;
    expect(r.format).toBe(3);
    // ses colonnes, par leur titre ; les unités juste après « Nourriture »
    const titres = r.chasses.titres;
    for (const t of [
      "Retour",
      "Terrain (cm²)",
      "Tendance (cm²)",
      "Pertes / M cm²",
      "Moyenne (pertes / M cm²)",
      "Nourriture",
    ])
      expect(titres).toContain(t);
    expect(titres.slice(titres.indexOf("Nourriture") + 1)).toEqual(
      script().UNITES.map((u: { nom: string }) => u.nom),
    );
    expect(r.chasses.lignes[0][titres.indexOf("Retour")]).toBe("01/11 12:44");
    expect(Object.keys(r.autres[0])).toEqual(
      expect.arrayContaining(["terrain", "pertes", "nourriture"]),
    );
  });

  test("RC lus seulement pour les chasses du joueur dans la période, d'un seul bloc", () => {
    const f = fichier();
    const onglet = f.onglets["BDD chasse"],
      getRange = onglet.getRange;
    const lectures: number[][] = [];
    onglet.getRange = (r: number, c: number, nl = 1, nc = 1) => {
      lectures.push([r, c, nl, nc]);
      return getRange(r, c, nl, nc);
    };
    expect(f.doPost({ ...corps, format: 5 }).statistiques).toEqual(calcul());
    // colonne RC (I = 9) : les lignes 4 à 10 (chasses d'Alpha du 01/11 au
    // 07/11), d'une lecture ; pas celles de la veille (3), du lendemain (11),
    // ni celles des autres chasseurs
    expect(lectures.filter((l) => l[1] == 9)).toEqual([[4, 9, 7, 1]]);
    // les autres lectures s'arrêtent aux troupes (H), sauf la ligne des titres
    expect(lectures.filter(([r, c, , nc]) => c != 9 && c! + nc! - 1 >= 9 && r != 1)).toEqual([]);
  });

  test("onglet lu jusqu'aux troupes, le texte des RC seulement là où il sert", () => {
    const f = fichier();
    const t = f.script.tablesDuFichier(
      f.script.SpreadsheetApp.getActiveSpreadsheet(),
      "alpha",
      "2026-11-01",
      "2026-11-07",
      "Europe/Paris",
    ).chasse;
    expect(t[0]).toEqual(CHASSE.slice(0, 8).concat("RC"));
    expect(t.map((l: unknown[]) => (l[8] ? 1 : 0))).toEqual([
      1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0,
    ]);
    expect(t[4][8]).toBe(donnees().chasse[4]![8]);
    // lignes séparées d'au plus 20 autres lues d'un coup, plus éloignées à part
    expect(f.script.blocsDeLignes([4, 5, 6, 28, 29, 60], 20)).toEqual([
      [4, 6],
      [28, 29],
      [60, 60],
    ]);
    expect(f.script.blocsDeLignes([6, 27], 20)).toEqual([[6, 27]]);
    expect(f.script.blocsDeLignes([], 20)).toEqual([]);
  });

  test("chasses du joueur entre celles des autres : chaque RC à sa ligne, en un ou plusieurs blocs", () => {
    const d = donnees().chasse,
      bravo = Array.from({ length: 25 }, () => [...d[11]!]),
      // Alpha en lignes 2, 28 et 30 : 25 chasses de Bravo après la première,
      // une de Charlie entre les deux dernières
      lignes = [CHASSE, d[3]!, ...bravo, d[6]!, d[14]!, d[7]!];
    const f = classeurSimule({ "BDD chasse": feuille("BDD chasse", lignes) });
    const lues: number[][] = [],
      onglet = f.onglets["BDD chasse"],
      getRange = onglet.getRange;
    onglet.getRange = (r: number, c: number, nl = 1, nc = 1) => {
      if (c == 9) lues.push([r, nl]);
      return getRange(r, c, nl, nc);
    };
    const t = f.script.tablesDuFichier(
      f.script.SpreadsheetApp.getActiveSpreadsheet(),
      "Alpha",
      "2026-11-01",
      "2026-11-07",
      "Europe/Paris",
    ).chasse;
    // 25 lignes d'écart : lue à part ; une seule : lue avec la suivante
    expect(lues).toEqual([
      [2, 1],
      [28, 3],
    ]);
    expect(t.slice(1).map((l: unknown[]) => l[8])).toEqual(
      lignes.slice(1).map((l, i) => ([0, 26, 28].includes(i) ? l[8] : "")),
    );
  });

  test("joueur absent ou sans chasse, période illisible ou trop longue : aucun RC lu", () => {
    const f = fichier();
    const onglet = f.onglets["BDD chasse"],
      getRange = onglet.getRange;
    const colonnes: number[] = [];
    onglet.getRange = (r: number, c: number, nl = 1, nc = 1) => {
      colonnes.push(c);
      return getRange(r, c, nl, nc);
    };
    f.doPost({ ...corps, joueur: "Zoulou" });
    f.script.STATS_OUAF([["Alpha"], [""], ["2026-11-07"], [1]]);
    f.script.STATS_OUAF([[""], ["2026-11-01"], ["2026-11-07"], [1]]);
    const long = f.script.STATS_OUAF([["Alpha"], ["2020-01-01"], ["2026-11-07"], [1]]);
    expect(long[2][0]).toBe("Période trop longue : trois ans au plus.");
    expect(colonnes).not.toContain(9);
  });

  test("onglet absent : zéros ; colonne renommée : erreur expliquée", () => {
    expect(classeurSimule({}).doPost(corps).statistiques.resume[0]).toEqual(["Chasses (RC)", 0]);
    const d = donnees();
    d.chasse[0] = CHASSE.map((t) => (t == "Date" ? "Jour" : t));
    expect(classeurSimule({ "BDD chasse": feuille("BDD chasse", d.chasse) }).doPost(corps)).toEqual(
      { erreur: "statistiques impossibles : colonne « Date » introuvable" },
    );
  });

  test("requêtes refusées : joueur absent ou trop long, dates mal écrites, inversées, plus de trois ans", () => {
    const f = fichier();
    for (const c of [
      { statistiques: true, debut: "2026-11-01", fin: "2026-11-07" },
      { ...corps, joueur: " " },
      { ...corps, joueur: "x".repeat(41) },
      { ...corps, debut: "01/11/2026" },
      { ...corps, debut: "2026-11-07", fin: "2026-11-01" },
      { ...corps, debut: "2020-01-01" },
    ])
      expect(f.doPost(c)).toEqual({ erreur: "requête invalide" });
  });
});

describe("création de l'onglet « Statistiques » (adresse du script ouverte)", () => {
  test("premier onglet : cases à choisir, formule, liste des chasseurs, six graphiques", () => {
    const f = classeurSimule({ "BDD chasse": feuille("BDD chasse", donnees().chasse) });
    expect(f.doGet().ok).toBe(true);
    const s = f.onglets["Statistiques"];
    expect(f.ordre[0]).toBe("Statistiques");
    // seul l'onglet des chasses compte : aucun autre n'est créé
    expect(Object.keys(f.onglets).sort()).toEqual(["BDD chasse", "Statistiques"]);
    expect(s.grille[0][0]).toBe("Statistiques de chasse (Extension OUAF)");
    expect(s.grille[2].slice(0, 1)).toEqual(["Joueur"]);
    expect(s.formules["4,2"]).toBe("=TODAY()-30");
    expect(s.formules["5,2"]).toBe("=TODAY()");
    expect(s.formules["1,4"]).toBe("=STATS_OUAF(B3:B6)");
    // contrôle : compte et somme de l'onglet des chasses ; ligne visible
    // (cachée, elle masquerait une ligne de chaque bloc), valeur invisible
    expect(s.formules["6,2"]).toBe("=COUNTA('BDD chasse'!A:A)+SUM('BDD chasse'!C:F)");
    expect(s.lignesCachees).toEqual([]);
    expect(s.formats["6,2"]).toBe(";;;");
    expect(s.grille[5][0]).toBe("Contrôle (ne pas effacer)");
    // paramètres régionaux du fichier (fr_FR : « ; » entre arguments, « , » décimale) :
    // aucune formule ne doit dépendre du séparateur
    for (const formule of Object.values(s.formules) as string[])
      expect(formule).not.toMatch(/[,;]/);
    // liste de la case B3 : colonne des chasseurs du résultat (AW = 49), cachée
    const liste = s.validations.find((v: any) => v.r == 3 && v.c == 2).regle;
    expect(liste.plage).toEqual({ r: 3, c: 49, nl: 998, nc: 1 });
    expect(s.cachees).toEqual([49]);
    // jusqu'au bloc des autres chasseurs (AY = 51), un par autre chasseur du fichier
    expect(s.getMaxColumns()).toBeGreaterThanOrEqual(53);
    expect(s.validations.find((v: any) => v.r == 4 && v.c == 2).regle.date).toBe(true);
    // entiers, sauf l'écart du résumé (F = 6, en % signé), la variation de
    // l'armée en % (S = 19, une décimale), la date de retour (W = 23) et la
    // difficulté par cm² (AF = 32)
    expect(s.formats["3,5"]).toBe("#,##0");
    expect(s.formats["3,6"]).toBe('+0.0" %";-0.0" %";0.0" %"');
    expect(s.formats["3,19"]).toBe("0.0");
    expect(s.formats["3,23"]).toBe("dd/mm hh:mm");
    expect(s.formats["3,32"]).toBe("0.00");
    expect(s.largeurs[6]).toBe(200);
    // écart du résumé (F, lignes 3 à 9) : mieux que la moyenne en vert, moins
    // bien en rouge ; pour les pertes (lignes 6 et 7), au-dessus est moins bien
    const regles = s.reglesConditionnelles;
    expect(
      regles
        .slice(0, 4)
        .map((r: any) => [r.condition, r.couleur, r.plages.map((p: any) => [p.r, p.c])]),
    ).toEqual([
      [
        [">", 0],
        "#2e7d32",
        [
          [3, 6],
          [4, 6],
          [5, 6],
          [8, 6],
          [9, 6],
        ],
      ],
      [
        ["<", 0],
        "#b03a2e",
        [
          [3, 6],
          [4, 6],
          [5, 6],
          [8, 6],
          [9, 6],
        ],
      ],
      [
        [">", 0],
        "#b03a2e",
        [
          [6, 6],
          [7, 6],
        ],
      ],
      [
        ["<", 0],
        "#2e7d32",
        [
          [6, 6],
          [7, 6],
        ],
      ],
    ]);
    // tableau des chasseurs (H = 8, 7 colonnes) : le joueur de B3 en gras, la
    // moyenne en italique ; formules sans séparateur d'arguments
    const tableau = { r: 3, c: 8, nl: 998, nc: 7 };
    expect(regles.slice(4)).toEqual([
      {
        condition: ["formule", "=LOWER(TRIM($H3))=LOWER(TRIM($B$3))"],
        gras: true,
        plages: [tableau],
      },
      {
        condition: ["formule", '=$H3="Moyenne des chasseurs"'],
        italique: true,
        plages: [tableau],
      },
    ]);
    // bloc des chasses à partir de U (21) : Chasse, Retour, Date (W = 23),
    // Expéditions, Terrain (Y = 25), Tendance, Moyenne des chasseurs, Tendance
    // de la moyenne (AB = 28), Pertes (AC = 29), Pertes / M cm² (AD = 30),
    // Moyenne, Difficulté / cm² (AF = 32), Nourriture (AG = 33), unités (AH =
    // 34) ; titres en ligne 2
    expect(
      s.graphiques.map((g: any) => [
        g.type,
        g.options.title,
        g.plages.map((p: any) => [p.c, p.nc]),
      ]),
    ).toEqual([
      [
        "COMBO",
        "Terrain (barres), nourriture et pertes (courbes, échelle log) de chaque chasse",
        [
          [21, 1],
          [25, 1],
          [33, 1],
          [29, 1],
        ],
      ],
      [
        "LINE",
        "Terrain chassé à chaque chasse : toi, les autres chasseurs (étirés sur tes chasses) et la tendance de leur moyenne",
        [
          [21, 1],
          [25, 2],
          [28, 1],
          [51, 3],
        ],
      ],
      [
        "SCATTER",
        "Nourriture selon le terrain chassé (un point par chasse)",
        [
          [25, 1],
          [33, 1],
        ],
      ],
      [
        "SCATTER",
        "Terrain chassé selon la difficulté par cm² (un point par chasse)",
        [
          [32, 1],
          [25, 1],
        ],
      ],
      [
        "LINE",
        "Pertes par M cm² de chaque chasse dans le temps, et la moyenne de la période (pertes totales ÷ terrain total)",
        [
          [23, 1],
          [30, 2],
        ],
      ],
      [
        "AREA",
        "Armée envoyée à chaque chasse (unités, hors bonus)",
        [
          [21, 1],
          [34, 14],
        ],
      ],
    ]);
    expect(
      s.graphiques.every(
        (g: any) => g.plages.every((p: any) => p.r == 2 && p.nl == 999) && g.titres == 1,
      ),
    ).toBe(true);
    // terrain en barres (axe de gauche), nourriture et pertes en courbes sur
    // l'axe de droite, logarithmique (Google Sheets n'a que deux axes)
    const combo = s.graphiques[0].options;
    expect(combo.seriesType).toBe("bars");
    expect([combo.series[1].type, combo.series[1].targetAxisIndex]).toEqual(["line", 1]);
    expect([combo.series[2].type, combo.series[2].targetAxisIndex]).toEqual(["line", 1]);
    expect(combo.vAxes[1].logScale).toBe(true);
    // chaque chasseur en pointillés (le joueur en vert, les autres d'autres
    // couleurs), sans courbe épaisse ; la tendance du joueur en vert, celle de
    // la moyenne en rouge, en tirets autres que les pointillés ; plus de courbe moyenne
    const lignes = s.graphiques[1].options.series;
    expect(lignes[0]).toEqual({ color: "#008300", lineWidth: 2, lineDashStyle: [2, 3] });
    expect(lignes[1]).toEqual({ color: "#008300", lineWidth: 2, lineDashStyle: [10, 5] });
    expect(lignes[2]).toEqual({ color: "#e34948", lineWidth: 2, lineDashStyle: [10, 5] });
    const autres = [3, 4, 5].map((k) => lignes[k]);
    expect(autres.every((a: any) => String(a.lineDashStyle) == "2,3" && a.lineWidth == 2)).toBe(
      true,
    );
    expect(new Set(autres.map((a: any) => a.color)).size).toBe(3);
    expect(autres.map((a: any) => a.color)).not.toContain("#008300");
    expect(autres.map((a: any) => a.color)).not.toContain("#e34948");
    expect(lignes[6]).toBeUndefined();
    expect(s.graphiques[2].options.legend).toEqual({ position: "none" });
    expect(s.graphiques[5].options.isStacked).toBe(true);
    // sous le résumé, l'un sous l'autre
    expect(s.graphiques.map((g: any) => g.position)).toEqual([
      [12, 1],
      [30, 1],
      [48, 1],
      [66, 1],
      [84, 1],
      [102, 1],
    ]);
  });

  test("autres chasseurs : six couleurs, leurs nuances, puis un autre pointillé ; celles de l'extension", () => {
    const grille: unknown[][] = [CHASSE];
    for (let i = 0; i < 14; i++)
      grille.push(chasse(`J${i}`, "2026-11-01 10:00", 1, 1, 1, "1 Tank"));
    const f = classeurSimule({ "BDD chasse": feuille("BDD chasse", grille) });
    f.doGet();
    const series = f.onglets["Statistiques"].graphiques[1].options.series;
    // 13 autres chasseurs (le joueur de la case B3 est l'un des 14) : séries 3 à 15
    const autres = Array.from({ length: 13 }, (_, k) => series[3 + k]);
    expect(new Set(autres.slice(0, 12).map((a: any) => a.color)).size).toBe(12);
    expect(autres.slice(0, 12).every((a: any) => String(a.lineDashStyle) == "2,3")).toBe(true);
    expect([autres[12].color, String(autres[12].lineDashStyle)]).toEqual(["#2a78d6", "6,3,2,3"]);
    // mêmes couleurs, dans le même ordre, que la synthèse de l'extension
    const synthese = readFileSync(
      join(import.meta.dir, "..", "public", "js", "boite", "Synthese.js"),
      "utf8",
    );
    const extension = [
      ...synthese.match(/const COULEURS_AUTRES = \[([^\]]*)\]/)![1]!.matchAll(/#[0-9a-f]{6}/g),
    ].map((m) => m[0]);
    expect(extension).toEqual([...f.script.COULEURS_AUTRES_CHASSEURS]);
  });

  test("déjà là : rien n'est recréé ; jamais créé par un export", () => {
    const f = classeurSimule({});
    f.doGet();
    f.onglets["Statistiques"].graphiques.push("marque");
    f.doGet();
    expect(f.onglets["Statistiques"].graphiques).toContain("marque");
    const g = classeurSimule({});
    g.doPost({
      onglet: "BDD chasse",
      entetes: CHASSE,
      lignes: [chasse("Alpha", "2026-11-01 10:00", 1, 1, 1, "1 Tank")],
    });
    g.doPost({ verifier: true, onglets: ["BDD chasse"], cles: ["x"] });
    expect(Object.keys(g.onglets)).toEqual(["BDD chasse"]);
  });

  test("création impossible : l'adresse répond quand même, la raison va au journal", () => {
    const f = classeurSimule({});
    f.script.SpreadsheetApp.newDataValidation = () => {
      throw new Error("service indisponible");
    };
    expect(f.doGet().ok).toBe(true);
    expect(f.avertissements[0]).toContain("Onglet Statistiques non créé");
  });
});
