import { describe, expect, test } from "bun:test";
import { classeurSimule, feuille } from "./sheet-simule";

/**
 * Statistiques du script du Google Sheet (google-sheet/export-rapports.gs) :
 * un seul calcul (statistiques) pour l'onglet « Statistiques » du fichier
 * (STATS_OUAF) et pour l'onglet « Synthèse » de l'extension (requête
 * statistiques). Données inventées (aucun RC réel dans le dépôt public).
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
  "Arme",
  "Bouclier",
  "Dôme",
  "Loge",
  "Troupes en attaque",
  "Troupes en défense",
  "RC",
];
// une ligne d'onglet de combats d'après ses colonnes nommées
const combat = (v: Record<string, unknown>) => COMBATS.map((t) => v[t] ?? "");
let n = 0;
const cle = () => `k${++n}`;

const chasse = (par: string, date: string, terrain: number, nourriture: number, pertes: number) => [
  cle(),
  par,
  date,
  terrain,
  nourriture,
  pertes,
  "1 000 Jeunes Soldates Naines",
  "10 Criquets",
  "RC (texte long, jamais lu par les statistiques)",
];

function donnees() {
  return {
    chasse: [
      CHASSE,
      chasse("Alpha", "2026-10-31 23:59", 999, 999, 999), // la veille : hors période
      chasse("Alpha", "2026-11-01 00:10", 4000, 30000, 200),
      chasse("Alpha", "2026-11-01 18:00", 6000, 50000, 300),
      chasse("alpha", "2026-11-03 09:00", 10000, 80000, 500), // casse différente : même joueur
      chasse("Bravo", "2026-11-02 10:00", 7777, 7777, 7777), // autre joueur
      chasse("Alpha", "2026-11-08 08:00", 5000, 40000, 0), // après la période
    ],
    attaques: [
      COMBATS,
      combat({
        Clé: cle(),
        "Exporté par": "Alpha",
        Date: "2026-11-01 12:00",
        Type: "Combat",
        Attaquant: "Alpha",
        Défenseur: "Ennemi",
        "Pertes attaquant": 50,
        "Pertes défenseur": 400,
      }),
      combat({
        Clé: cle(),
        "Exporté par": "Alpha",
        Date: "2026-11-01 12:00",
        Type: "Prise",
        Attaquant: "Alpha",
        Défenseur: "Ennemi",
        "Terrain (cm²)": 1500,
        Nourriture: 900,
        Matériaux: 300,
      }),
      combat({
        Clé: cle(),
        "Exporté par": "Alpha",
        Date: "2026-11-02 12:00",
        Type: "Prise",
        Attaquant: "Alpha",
        Défenseur: "Autre",
        "Terrain (cm²)": 1500,
      }),
      combat({
        Clé: cle(),
        "Exporté par": "Alpha",
        Date: "2026-11-03 12:00",
        Type: "Prise",
        Attaquant: "Alpha",
        Défenseur: "Ennemi",
        "Terrain (cm²)": 500,
      }),
      combat({
        Clé: cle(),
        "Exporté par": "Bravo",
        Date: "2026-11-02 12:00",
        Type: "Prise",
        Attaquant: "Bravo",
        Défenseur: "Ennemi",
        "Terrain (cm²)": 99999,
      }),
    ],
    defenses: [
      COMBATS,
      combat({
        Clé: cle(),
        "Exporté par": "Alpha",
        Date: "2026-11-02 20:00",
        Type: "Prise",
        Attaquant: "Méchant",
        Défenseur: "Alpha",
        "Terrain (cm²)": 700,
      }),
      combat({
        Clé: cle(),
        "Exporté par": "Alpha",
        Date: "2026-11-02 20:00",
        Type: "Combat",
        Attaquant: "Méchant",
        Défenseur: "Alpha",
        "Pertes attaquant": 30,
        "Pertes défenseur": 10,
      }),
    ],
    internes: [
      COMBATS,
      combat({
        Clé: cle(),
        "Exporté par": "Bravo",
        Date: "2026-11-01 08:00",
        Type: "Prise",
        Attaquant: "Alpha",
        Défenseur: "Bravo",
        "Terrain (cm²)": 2000,
      }),
      combat({
        Clé: cle(),
        "Exporté par": "Alpha",
        Date: "2026-11-03 08:00",
        Type: "Prise",
        Attaquant: "Charlie",
        Défenseur: "Alpha",
        "Terrain (cm²)": 800,
      }),
      combat({
        Clé: cle(),
        "Exporté par": "Alpha",
        Date: "2026-11-03 08:00",
        Type: "Combat",
        Attaquant: "Charlie",
        Défenseur: "Alpha",
        "Pertes attaquant": 1,
        "Pertes défenseur": 1,
      }),
    ],
  };
}

const script = () => classeurSimule({}).script;
const valeur = (resume: [string, unknown][], libelle: string, rang = 0) =>
  resume.filter((l) => l[0] == libelle)[rang]?.[1];

describe("calcul des statistiques", () => {
  const s = script().statistiques(donnees(), "Alpha", "2026-11-01", "2026-11-07", "Europe/Paris");

  test("chasses du joueur (casse ignorée), jours compris, autres joueurs et autres jours exclus", () => {
    expect(valeur(s.resume, "Chasses (RC)")).toBe(3);
    expect(valeur(s.resume, "Terrain conquis (cm²)")).toBe(20000);
    expect(valeur(s.resume, "Nourriture rapportée")).toBe(160000);
    expect(valeur(s.resume, "Fourmis perdues")).toBe(1000);
    // 1 000 pertes pour 20 000 cm² : 50 000 par million de cm²
    expect(valeur(s.resume, "Pertes par million de cm²")).toBe(50000);
    expect(valeur(s.resume, "Terrain moyen par chasse (cm²)")).toBe(6667);
  });

  test("attaques et défenses hors alliance, floods internes, bilan du terrain", () => {
    expect(valeur(s.resume, "Butins")).toBe(3);
    expect(valeur(s.resume, "Terrain pris (cm²)")).toBe(3500);
    expect(valeur(s.resume, "Nourriture pillée")).toBe(900);
    expect(valeur(s.resume, "Matériaux pillés")).toBe(300);
    expect(valeur(s.resume, "Combats", 0)).toBe(1);
    expect(valeur(s.resume, "Fourmis perdues", 1)).toBe(50);
    expect(valeur(s.resume, "Fourmis tuées", 0)).toBe(400);
    expect(valeur(s.resume, "Vols subis")).toBe(1);
    expect(valeur(s.resume, "Terrain perdu (cm²)")).toBe(700);
    expect(valeur(s.resume, "Fourmis perdues", 2)).toBe(10);
    expect(valeur(s.resume, "Fourmis tuées", 1)).toBe(30);
    expect(valeur(s.resume, "Terrain reçu des alliés (cm²)")).toBe(2000);
    expect(valeur(s.resume, "Terrain donné aux alliés (cm²)")).toBe(800);
    // 20 000 + 3 500 + 2 000 − 700 − 800
    expect(valeur(s.resume, "Terrain gagné (cm²)")).toBe(24000);
  });

  test("évolution jour par jour, jours sans activité compris", () => {
    expect(s.pas).toBe("jour");
    expect(s.evolution.lignes.map((l: unknown[]) => l[0])).toEqual([
      "01/11",
      "02/11",
      "03/11",
      "04/11",
      "05/11",
      "06/11",
      "07/11",
    ]);
    expect(s.evolution.lignes[0]).toEqual(["01/11", 10000, 1500, 2000, 0, 80000, 50000]);
    expect(s.evolution.lignes[1]).toEqual(["02/11", 0, 1500, 0, -700, 0, ""]);
    expect(s.evolution.lignes[2]).toEqual(["03/11", 10000, 500, -800, 0, 80000, 50000]);
    expect(s.evolution.lignes[3]).toEqual(["04/11", 0, 0, 0, 0, 0, ""]);
  });

  test("cibles, attaquants et alliés classés par terrain", () => {
    // Ennemi et Autre à 1 500… Ennemi a 2 000 (1 500 + 500) : premier
    expect(s.cibles.lignes).toEqual([
      ["Ennemi", 2, 2000, 1],
      ["Autre", 1, 1500, 0],
    ]);
    expect(s.attaquants.lignes).toEqual([["Méchant", 1, 700, 1]]);
    expect(s.internes.lignes).toEqual([
      ["Bravo", 2000, 0, 2000],
      ["Charlie", 0, 800, -800],
    ]);
  });

  test("premier et dernier jours compris, pas au-delà", () => {
    const r = (fin: string) =>
      valeur(
        script().statistiques(donnees(), "Alpha", "2026-11-01", fin, "Europe/Paris").resume,
        "Chasses (RC)",
      );
    // chasse du 03/11 à 09:00 : comptée jusqu'au 03/11, pas jusqu'au 02/11
    expect(r("2026-11-03")).toBe(3);
    expect(r("2026-11-02")).toBe(2);
    expect(
      valeur(
        script().statistiques(donnees(), "Alpha", "2026-11-03", "2026-11-03", "Europe/Paris")
          .resume,
        "Chasses (RC)",
      ),
    ).toBe(1);
  });

  test("dates du fichier (objets Date) : le jour est celui du fuseau du fichier", () => {
    const d = donnees();
    // 01/11 00:10 à Paris = 31/10 23:10 UTC ; 31/10 23:59 à Paris = 31/10 22:59 UTC
    (d.chasse[1] as unknown[])[2] = new Date(Date.UTC(2026, 9, 31, 22, 59));
    (d.chasse[2] as unknown[])[2] = new Date(Date.UTC(2026, 9, 31, 23, 10));
    const r = script().statistiques(d, "Alpha", "2026-11-01", "2026-11-07", "Europe/Paris");
    expect(valeur(r.resume, "Chasses (RC)")).toBe(3);
    expect(valeur(r.resume, "Terrain conquis (cm²)")).toBe(20000);
  });

  test("par semaine (lundi) au-delà de deux mois, par mois au-delà d'un an", () => {
    const sem = script().statistiques(
      donnees(),
      "Alpha",
      "2026-09-01",
      "2026-11-30",
      "Europe/Paris",
    );
    expect(sem.pas).toBe("semaine");
    // le 01/09/2026 est un mardi : sa semaine commence le lundi 31/08
    expect(sem.evolution.lignes[0][0]).toBe("sem. 31/08");
    const novembre = sem.evolution.lignes.find((l: unknown[]) => l[0] == "sem. 26/10");
    // 31/10 et 01/11 (samedi et dimanche) : semaine du 26/10
    expect(novembre[1]).toBe(10999);
    const mois = script().statistiques(
      donnees(),
      "Alpha",
      "2025-11-01",
      "2026-12-31",
      "Europe/Paris",
    );
    expect(mois.pas).toBe("mois");
    expect(mois.evolution.lignes.map((l: unknown[]) => l[0]).slice(-3)).toEqual([
      "oct. 2026",
      "nov. 2026",
      "déc. 2026",
    ]);
    expect(mois.evolution.lignes.find((l: unknown[]) => l[0] == "nov. 2026")[1]).toBe(25000);
  });

  test("aucune donnée, onglets absents ou jamais remplis : des zéros, pas d'erreur", () => {
    const vide = script().statistiques(
      {
        chasse: [],
        attaques: [[""]],
        defenses: [],
        internes: [
          ["", ""],
          ["", ""],
        ],
      },
      "Alpha",
      "2026-11-01",
      "2026-11-02",
      "Europe/Paris",
    );
    expect(valeur(vide.resume, "Chasses (RC)")).toBe(0);
    expect(valeur(vide.resume, "Pertes par million de cm²")).toBe("");
    expect(valeur(vide.resume, "Terrain gagné (cm²)")).toBe(0);
    expect(vide.cibles.lignes).toEqual([]);
  });

  test("colonne renommée à la main : erreur explicite plutôt qu'un chiffre faux", () => {
    const d = donnees();
    d.chasse[0] = CHASSE.map((t) => (t == "Nourriture" ? "Bouffe" : t));
    expect(() =>
      script().statistiques(d, "Alpha", "2026-11-01", "2026-11-07", "Europe/Paris"),
    ).toThrow("colonne « Nourriture » introuvable");
  });

  test("dix lignes au plus par classement", () => {
    const d = donnees();
    for (let i = 0; i < 15; i++)
      d.attaques.push(
        combat({
          Clé: cle(),
          "Exporté par": "Alpha",
          Date: "2026-11-04 10:00",
          Type: "Prise",
          Défenseur: `Cible${i}`,
          "Terrain (cm²)": 100 + i,
        }),
      );
    const r = script().statistiques(d, "Alpha", "2026-11-01", "2026-11-07", "Europe/Paris");
    expect(r.cibles.lignes).toHaveLength(10);
    expect(r.cibles.lignes[2][0]).toBe("Cible14");
  });
});

describe("onglet « Statistiques » du fichier (STATS_OUAF)", () => {
  const d = donnees();
  // B3:B6 (joueur, premier et dernier jour, contrôle) ; onglets lus dans le fichier
  const sortie = (joueur: unknown, debut: unknown, fin: unknown) =>
    classeurSimule({
      "BDD chasse": feuille("BDD chasse", donnees().chasse),
      "BDD attaques": feuille("BDD attaques", donnees().attaques),
      "BDD défenses": feuille("BDD défenses", donnees().defenses),
      "Flood internes": feuille("Flood internes", donnees().internes),
    }).script.STATS_OUAF([[joueur], [debut], [fin], [123]]) as unknown[][];
  // colonne de départ de chaque bloc (à partir de D : 0)
  const blocs = { resume: 0, evolution: 3, cibles: 11, attaquants: 16, internes: 21, joueurs: 26 };

  test("mêmes résultats que la synthèse de l'extension, blocs côte à côte", () => {
    const o = sortie(
      "Alpha",
      new Date(Date.UTC(2026, 9, 31, 23)),
      new Date(Date.UTC(2026, 10, 7, 12)),
    );
    const s = script().statistiques(d, "Alpha", "2026-11-01", "2026-11-07", "Europe/Paris");
    expect(o[0]![blocs.resume]).toBe("Résumé");
    expect(o[1]!.slice(blocs.resume, blocs.resume + 2)).toEqual(["Indicateur", "Valeur"]);
    expect(o.slice(2, 2 + s.resume.length).map((l) => l.slice(0, 2))).toEqual(s.resume);
    expect(o[0]![blocs.evolution]).toBe("Évolution");
    expect(o[1]!.slice(blocs.evolution, blocs.evolution + 7)).toEqual(s.evolution.titres);
    expect(o[2]!.slice(blocs.evolution, blocs.evolution + 7)).toEqual(s.evolution.lignes[0]);
    expect(o[2]!.slice(blocs.cibles, blocs.cibles + 4)).toEqual(s.cibles.lignes[0]);
    expect(o[2]!.slice(blocs.attaquants, blocs.attaquants + 4)).toEqual(s.attaquants.lignes[0]);
    expect(o[2]!.slice(blocs.internes, blocs.internes + 4)).toEqual(s.internes.lignes[0]);
    // tableau rectangulaire (exigé par le tableur)
    expect(new Set(o.map((l) => l.length)).size).toBe(1);
  });

  test("liste des joueurs de la case « Joueur » : tous les onglets, sans doublon de casse", () => {
    const o = sortie("Alpha", "2026-11-01", "2026-11-07");
    const liste = o
      .slice(2)
      .map((l) => l[blocs.joueurs])
      .filter(Boolean);
    expect(liste).toEqual(["Alpha", "Bravo", "Charlie"]);
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
  const fichier = () => {
    const d = donnees();
    return classeurSimule({
      "BDD chasse": feuille("BDD chasse", d.chasse),
      "BDD attaques": feuille("BDD attaques", d.attaques),
      "BDD défenses": feuille("BDD défenses", d.defenses),
      "Flood internes": feuille("Flood internes", d.internes),
    });
  };

  test("résultats identiques au calcul direct, sans verrou ni écriture", () => {
    const f = fichier();
    const r = f.doPost({
      statistiques: true,
      joueur: "Alpha",
      debut: "2026-11-01",
      fin: "2026-11-07",
    });
    expect(r.statistiques).toEqual(
      script().statistiques(donnees(), "Alpha", "2026-11-01", "2026-11-07", "Europe/Paris"),
    );
    expect(Object.keys(f.onglets)).not.toContain("Statistiques");
  });

  test("onglets lus jusqu'à leur dernière colonne utile : pas les RC", () => {
    const f = fichier();
    const lues = f.script.lireColonnes(
      f.script.SpreadsheetApp.getActiveSpreadsheet(),
      "BDD chasse",
      f.script.COLONNES_CHASSE,
    );
    expect(lues[0]).toEqual(CHASSE.slice(0, 6));
  });

  test("onglet absent : zéros ; colonne renommée : erreur expliquée", () => {
    const f = classeurSimule({});
    const r = f.doPost({
      statistiques: true,
      joueur: "Alpha",
      debut: "2026-11-01",
      fin: "2026-11-07",
    });
    expect(r.statistiques.resume[1]).toEqual(["Chasses (RC)", 0]);
    const d = donnees();
    d.attaques[0] = COMBATS.map((t) => (t == "Type" ? "Genre" : t));
    const g = classeurSimule({ "BDD attaques": feuille("BDD attaques", d.attaques) });
    expect(
      g.doPost({ statistiques: true, joueur: "Alpha", debut: "2026-11-01", fin: "2026-11-07" }),
    ).toEqual({
      erreur: "statistiques impossibles : colonne « Type » introuvable",
    });
  });

  test("requêtes refusées : joueur absent ou trop long, dates mal écrites, inversées, plus de trois ans", () => {
    const f = fichier();
    for (const corps of [
      { statistiques: true, debut: "2026-11-01", fin: "2026-11-07" },
      { statistiques: true, joueur: " ", debut: "2026-11-01", fin: "2026-11-07" },
      { statistiques: true, joueur: "x".repeat(41), debut: "2026-11-01", fin: "2026-11-07" },
      { statistiques: true, joueur: "Alpha", debut: "01/11/2026", fin: "2026-11-07" },
      { statistiques: true, joueur: "Alpha", debut: "2026-11-07", fin: "2026-11-01" },
      { statistiques: true, joueur: "Alpha", debut: "2020-01-01", fin: "2026-11-07" },
    ])
      expect(f.doPost(corps)).toEqual({ erreur: "requête invalide" });
  });
});

describe("création de l'onglet « Statistiques » (adresse du script ouverte)", () => {
  test("premier onglet : cases à choisir, formule, liste des joueurs, trois graphiques", () => {
    const f = classeurSimule({ "BDD chasse": feuille("BDD chasse", donnees().chasse) });
    expect(f.doGet().ok).toBe(true);
    const s = f.onglets["Statistiques"];
    expect(f.ordre[0]).toBe("Statistiques");
    // la formule cite les quatre onglets : créés vides s'ils manquaient
    expect(Object.keys(f.onglets).sort()).toEqual([
      "BDD attaques",
      "BDD chasse",
      "BDD défenses",
      "Flood internes",
      "Statistiques",
    ]);
    expect(s.grille[2].slice(0, 1)).toEqual(["Joueur"]);
    expect(s.formules["4,2"]).toBe("=TODAY()-30");
    expect(s.formules["5,2"]).toBe("=TODAY()");
    expect(s.formules["1,4"]).toBe("=STATS_OUAF(B3:B6)");
    // contrôle des données : compte et somme de chaque onglet, ligne cachée
    expect(s.formules["6,2"]).toBe(
      "=COUNTA('BDD chasse'!A:A)+SUM('BDD chasse'!C:F)+COUNTA('BDD attaques'!A:A)+SUM('BDD attaques'!C:L)+COUNTA('BDD défenses'!A:A)+SUM('BDD défenses'!C:L)+COUNTA('Flood internes'!A:A)+SUM('Flood internes'!C:L)",
    );
    expect(s.lignesCachees).toEqual([6]);
    // paramètres régionaux du fichier (fr_FR : « ; » entre arguments, « , » décimale) :
    // aucune formule ne doit dépendre du séparateur
    for (const formule of Object.values(s.formules) as string[])
      expect(formule).not.toMatch(/[,;]/);
    // liste de la case B3 : colonne des joueurs du résultat (AD = 30), cachée
    const liste = s.validations.find((v: any) => v.r == 3 && v.c == 2).regle;
    expect(liste.plage).toEqual({ r: 3, c: 30, nl: 998, nc: 1 });
    expect(s.cachees).toEqual([30]);
    expect(s.getMaxColumns()).toBeGreaterThanOrEqual(30);
    expect(s.validations.find((v: any) => v.r == 4 && v.c == 2).regle.date).toBe(true);
    // graphiques : périodes (G) puis séries de l'évolution, titres en ligne 2
    expect(
      s.graphiques.map((g: any) => [
        g.type,
        g.options.title,
        g.plages.map((p: any) => [p.c, p.nc]),
      ]),
    ).toEqual([
      [
        "COLUMN",
        "Terrain gagné ou perdu (cm²)",
        [
          [7, 1],
          [8, 4],
        ],
      ],
      [
        "COLUMN",
        "Nourriture rapportée par les chasses",
        [
          [7, 1],
          [12, 1],
        ],
      ],
      [
        "LINE",
        "Pertes par million de cm² chassés",
        [
          [7, 1],
          [13, 1],
        ],
      ],
    ]);
    expect(
      s.graphiques.every((g: any) => g.plages.every((p: any) => p.r == 2) && g.titres == 1),
    ).toBe(true);
    expect(s.graphiques[0].options.isStacked).toBe(true);
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
      lignes: [chasse("Alpha", "2026-11-01 10:00", 1, 1, 1)],
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
