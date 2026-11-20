import { describe, expect, test } from "bun:test";
import { classeurSimule, feuille } from "./sheet-simule";

/**
 * Script du Google Sheet « Stats membres » (google-sheet/stats-membres.gs,
 * 1.104.0, demande du mainteneur) : le relevé d'un joueur va dans sa ligne de
 * l'onglet « Dernier relevé », une ligne par joueur, sans historique (règle du
 * mainteneur, 12/11/2026 : un seul onglet, la date et l'heure disent de quand
 * datent les valeurs) ; le fond d'une case dit si le joueur partage cette information
 * (vert) ou a décoché sa case (rouge : la dernière valeur lue y reste, règle
 * du mainteneur ; case vide s'il ne l'a jamais partagée).
 */
const VERT = "#d9ead3",
  ROUGE = "#f4cccc";
const TITRES = [
  "TdP",
  "CdF",
  "FdF HB",
  "FdF AB",
  "VA",
  "VC",
  "Puceron",
  "Champignonnière",
  "Ouvrières",
];
const CLES = [
  "tdp",
  "cdf",
  "fdfHB",
  "fdfAB",
  "va",
  "vc",
  "puceron",
  "champignonniere",
  "ouvrieres",
];

// jour de Paris, décalé de n jours : le script refuse un jour loin d'aujourd'hui
const jour = (n = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(
    new Date(Date.now() + n * 86400000),
  );
const fichier = (onglets: Record<string, any> = {}) =>
  classeurSimule(onglets, "Europe/Paris", "stats-membres.gs");
const DONNEES = {
  tdp: 38,
  cdf: 250000,
  fdfHB: 3100000,
  fdfAB: 5890000,
  va: 7,
  vc: 8,
  puceron: 2,
  champignonniere: 17,
  ouvrieres: 412000,
};
const TOUT = Object.fromEntries(CLES.map((c) => [c, true]));
const releve = (plus: Record<string, unknown> = {}) => ({
  suivi: {
    joueur: "DoggyBag",
    jour: jour(),
    donnees: DONNEES,
    partages: TOUT,
    version: "1.104.0",
    ...plus,
  },
});
// lignes de l'onglet : dates rendues en jours de Paris
const ONGLET = "Dernier relevé";
const AUTRES = "Partagé avec les autres";
const lignes = (f: ReturnType<typeof fichier>) =>
  f.onglets[ONGLET].grille.map((l: unknown[]) =>
    l.map((v) =>
      v instanceof Date
        ? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(v)
        : v,
    ),
  );
const fonds = (f: ReturnType<typeof fichier>, ligne: number, colonnes: number[]) =>
  colonnes.map((c) => f.onglets[ONGLET].fonds[`${ligne},${c}`]);

describe("premier relevé : un seul onglet, une ligne par joueur", () => {
  test("titres, valeurs, version, jour du relevé", () => {
    const f = fichier();
    expect(f.doPost(releve())).toEqual({ ok: true, nouveau: true, dernier: true });
    expect(f.ordre).toEqual([ONGLET]);
    expect(lignes(f).map((l: unknown[]) => l.slice(0, 13))).toEqual([
      ["Joueur", "Date", ...TITRES, AUTRES, "Version"],
      ["DoggyBag", jour(), 38, 250000, 3100000, 5890000, 7, 8, 2, 17, 412000, "", "1.104.0"],
    ]);
  });

  test("légende des couleurs à droite des titres ; cases partagées en vert, joueur et date sans couleur", () => {
    const f = fichier();
    f.doPost(releve());
    expect(f.onglets[ONGLET].grille[0].slice(14, 16)).toEqual(["partagé", "non partagé"]);
    expect(fonds(f, 1, [15, 16])).toEqual([VERT, ROUGE]);
    expect(fonds(f, 2, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])).toEqual([
      undefined,
      undefined,
      ...TITRES.map(() => VERT),
      undefined,
      undefined,
    ]);
  });

  test("adresse ouverte dans le navigateur : version du script, onglet créé", () => {
    const f = fichier();
    expect(f.doGet()).toMatchObject({ ok: true, suivi: true });
    expect(String(f.doGet().version)).toMatch(/^stats-membres \d{4}-\d{2}-\d{2}\.\d+$/);
    expect(f.ordre).toEqual([ONGLET]);
    expect(f.onglets[ONGLET].grille).toHaveLength(1);
  });

  test("fichier qui a déjà d'autres onglets : celui des relevés est créé en premier", () => {
    const f = fichier({ "Feuille 1": feuille("Feuille 1") });
    f.doPost(releve());
    expect(f.ordre).toEqual([ONGLET, "Feuille 1"]);
    expect(f.onglets["Feuille 1"].grille).toEqual([]);
  });

  test("pas d'historique : les relevés de plusieurs jours tiennent dans la ligne du joueur, dont la date suit", () => {
    const f = fichier();
    f.doPost(releve({ jour: jour(-1) }));
    f.doPost(releve({ donnees: { ...DONNEES, tdp: 39 } }));
    f.doPost(releve({ jour: jour(1), donnees: { ...DONNEES, tdp: 40 } }));
    expect(f.ordre).toEqual([ONGLET]);
    expect(lignes(f).map((l: unknown[]) => l.slice(0, 3))).toEqual([
      ["Joueur", "Date", "TdP"],
      ["DoggyBag", jour(1), 40],
    ]);
  });

  test("onglet « Suivi » créé par une version précédente du script : ni écrit, ni supprimé", () => {
    const ancien = [
      ["Date", "Joueur", "TdP"],
      ["11/11/2026", "DoggyBag", 37],
    ];
    const f = fichier({
      "Dernier relevé": feuille("Dernier relevé", [
        ["Joueur", "Date", "TdP"],
        ["DoggyBag", jour(-1).split("-").reverse().join("/"), 37],
      ]),
      Suivi: feuille(
        "Suivi",
        ancien.map((l) => [...l]),
      ),
    });
    f.doGet();
    f.doPost(releve());
    f.doPost(releve({ joueur: "Lassie" }));
    expect(f.ordre).toEqual([ONGLET, "Suivi"]);
    expect(f.onglets["Suivi"].grille).toEqual(ancien);
    expect(lignes(f).map((l: unknown[]) => l.slice(0, 3))).toEqual([
      ["Joueur", "Date", "TdP"],
      ["DoggyBag", jour(), 38],
      ["Lassie", jour(), 38],
    ]);
  });
});

describe("colonne « Date » : le jour du relevé et l'heure du jeu à sa réception (demande du mainteneur)", () => {
  // instant d'une case, lu dans un fuseau
  const instant = (v: unknown, fuseau = "Europe/Paris") =>
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: fuseau,
      dateStyle: "short",
      timeStyle: "medium",
    }).format(v as Date);
  const date = (f: ReturnType<typeof fichier>, ligne = 1, fuseau?: string) =>
    instant(f.onglets[ONGLET].grille[ligne][1], fuseau);
  // heure de Google au moment où le script reçoit le relevé
  const recuA = (f: ReturnType<typeof fichier>, utc: string) => f.horloge(utc);

  test("heure de Paris à la réception, au format jj/mm/aaaa hh:mm sur la case écrite ; elle suit à chaque relevé", () => {
    const f = fichier();
    recuA(f, "2026-11-12T13:35:20Z");
    f.doPost(releve({ jour: "2026-11-12" }));
    expect(date(f)).toBe("2026-11-12 14:35:20");
    expect(f.onglets[ONGLET].formats["2,2"]).toBe("dd/MM/yyyy HH:mm");
    recuA(f, "2026-11-12T20:05:00Z");
    f.doPost(releve({ jour: "2026-11-12" }));
    expect([lignes(f).length, date(f)]).toEqual([2, "2026-11-12 21:05:00"]);
    // l'été, Paris est à UTC + 2
    recuA(f, "2026-07-01T08:00:00Z");
    f.doPost(releve({ jour: "2026-07-01", joueur: "Lassie" }));
    expect(date(f, 2)).toBe("2026-07-01 10:00:00");
  });

  test("relevé reçu juste après minuit pour la veille, ou juste avant minuit pour le lendemain : daté du bord de son jour", () => {
    const f = fichier();
    // 13/11 à 00h00min01 à Paris
    recuA(f, "2026-11-12T23:00:01Z");
    f.doPost(releve({ jour: "2026-11-12" }));
    expect(date(f)).toBe("2026-11-12 23:59:59");
    // 13/11 à 23h59min58 à Paris
    recuA(f, "2026-11-13T22:59:58Z");
    f.doPost(releve({ jour: "2026-11-14" }));
    expect(date(f)).toBe("2026-11-14 00:00:00");
  });

  test("ligne écrite par une version précédente (date sans heure) : remplacée avec l'heure ; celle d'un autre joueur n'est pas touchée", () => {
    const minuit = () => new Date("2026-11-11T23:00:00Z");
    const f = fichier({
      "Dernier relevé": feuille("Dernier relevé", [
        ["Joueur", "Date", "TdP"],
        ["Lassie", minuit(), 20],
        ["DoggyBag", minuit(), 37],
      ]),
    });
    f.onglets[ONGLET].formats["2,2"] = "dd/MM/yyyy";
    f.onglets[ONGLET].formats["3,2"] = "dd/MM/yyyy";
    recuA(f, "2026-11-12T09:15:00Z");
    f.doPost(releve({ jour: "2026-11-12" }));
    expect([date(f, 1), date(f, 2)]).toEqual(["2026-11-12 00:00:00", "2026-11-12 10:15:00"]);
    expect([f.onglets[ONGLET].formats["2,2"], f.onglets[ONGLET].formats["3,2"]]).toEqual([
      "dd/MM/yyyy",
      "dd/MM/yyyy HH:mm",
    ]);
    // seule la case de la date reçoit ce format ; les colonnes ajoutées, celui des nombres
    const formats = Object.entries(f.onglets[ONGLET].formats as Record<string, string>);
    expect(formats.filter(([, v]) => v.startsWith("dd/")).map(([k]) => k)).toEqual(["2,2", "3,2"]);
    expect(formats.filter(([, v]) => v == "#,##0").map(([k]) => k)).toEqual(
      expect.arrayContaining([4, 5, 6, 7, 8, 9, 10, 11].map((c) => `2,${c}`)),
    );
  });

  test("relevé plus ancien que la ligne : la date et l'heure de la ligne ne bougent pas", () => {
    const f = fichier();
    recuA(f, "2026-11-12T09:15:00Z");
    f.doPost(releve({ jour: "2026-11-12" }));
    recuA(f, "2026-11-12T09:20:00Z");
    expect(f.doPost(releve({ jour: "2026-11-11" })).dernier).toBe(false);
    expect(date(f)).toBe("2026-11-12 10:15:00");
  });

  test("fichier réglé sur un autre fuseau : la case affiche quand même le jour du relevé à l'heure du jeu, et un second relevé du jour la remplace", () => {
    const f = classeurSimule({}, "Asia/Tokyo", "stats-membres.gs");
    // 12/11 à 20h30 à Paris, déjà le 13 à Tokyo
    recuA(f, "2026-11-12T19:30:00Z");
    expect(f.doPost(releve({ jour: "2026-11-12" }))).toEqual({
      ok: true,
      nouveau: true,
      dernier: true,
    });
    expect(date(f, 1, "Asia/Tokyo")).toBe("2026-11-12 20:30:00");
    recuA(f, "2026-11-12T20:00:00Z");
    expect(f.doPost(releve({ jour: "2026-11-12", donnees: { ...DONNEES, tdp: 39 } }))).toEqual({
      ok: true,
      nouveau: false,
      dernier: true,
    });
    expect([date(f, 1, "Asia/Tokyo"), lignes(f)[1][2]]).toEqual(["2026-11-12 21:00:00", 39]);
  });
});

describe("information décochée par le joueur", () => {
  test("jamais partagée : case vide sur fond rouge, même si une valeur est envoyée ; les autres en vert", () => {
    const f = fichier();
    f.doPost(
      releve({
        donnees: { ...DONNEES, fdfAB: 999 },
        partages: { ...TOUT, fdfAB: false, puceron: false },
      }),
    );
    expect(lignes(f)[1].slice(2, 10)).toEqual([38, 250000, 3100000, "", 7, 8, "", 17]);
    expect(fonds(f, 2, [3, 4, 5, 6, 7, 8, 9, 10])).toEqual([
      VERT,
      VERT,
      VERT,
      ROUGE,
      VERT,
      VERT,
      ROUGE,
      VERT,
    ]);
  });

  test("décochée après un relevé : la dernière valeur lue reste, sur fond rouge ; le reste est mis à jour", () => {
    const f = fichier();
    f.doPost(releve());
    // la valeur envoyée malgré la case décochée n'est pas écrite
    f.doPost(
      releve({
        donnees: { ...DONNEES, tdp: 39, fdfAB: 999 },
        partages: { ...TOUT, fdfAB: false, puceron: false },
      }),
    );
    expect(lignes(f)).toHaveLength(2);
    expect(lignes(f)[1].slice(2, 10)).toEqual([39, 250000, 3100000, 5890000, 7, 8, 2, 17]);
    expect(fonds(f, 2, [3, 6, 9, 10])).toEqual([VERT, ROUGE, ROUGE, VERT]);
  });

  test("toujours décochée les jours suivants : la dernière valeur lue reste dans la ligne du joueur, en rouge", () => {
    const f = fichier();
    f.doPost(releve({ jour: jour(-1) }));
    f.doPost(releve({ donnees: { ...DONNEES, tdp: 39 }, partages: { ...TOUT, cdf: false } }));
    f.doPost(
      releve({ jour: jour(1), donnees: { tdp: 40 }, partages: { ...TOUT, cdf: false, va: false } }),
    );
    expect(lignes(f)).toHaveLength(2);
    // FdF HB et FdF AB : partagées mais non lues ce jour-là, vides et sans couleur
    expect(lignes(f)[1].slice(1, 7)).toEqual([jour(1), 40, 250000, "", "", 7]);
    expect(fonds(f, 2, [3, 4, 5, 7])).toEqual([VERT, ROUGE, null, ROUGE]);
  });

  test("valeur d'un autre joueur, ou case vidée à la main : rien n'est repris", () => {
    const f = fichier();
    f.doPost(releve({ joueur: "Lassie" }));
    f.doPost(releve({ partages: { ...TOUT, va: false } }));
    expect([lignes(f)[2][0], lignes(f)[2][6]]).toEqual(["DoggyBag", ""]);
    f.doPost(releve());
    f.onglets[ONGLET].grille[2][6] = "";
    f.doPost(releve({ partages: { ...TOUT, va: false } }));
    expect(lignes(f)[2].slice(0, 7)).toEqual([
      "DoggyBag",
      jour(),
      38,
      250000,
      3100000,
      5890000,
      "",
    ]);
    expect(fonds(f, 3, [7])).toEqual([ROUGE]);
    // la ligne de l'autre joueur n'a pas bougé
    expect([lignes(f)[1][0], lignes(f)[1][6]]).toEqual(["Lassie", 7]);
  });

  test("dernière valeur tapée à la main comme une formule : réécrite comme du texte", () => {
    const f = fichier();
    f.doPost(releve());
    f.onglets[ONGLET].grille[1][6] = "=1+1";
    f.doPost(releve({ partages: { ...TOUT, va: false } }));
    expect(lignes(f)[1][6]).toBe("'=1+1");
  });

  test("tout décoché dès le premier relevé : la ligne du joueur existe, tout en rouge, sans aucune valeur", () => {
    const f = fichier();
    f.doPost(releve({ donnees: {}, partages: Object.fromEntries(CLES.map((c) => [c, false])) }));
    expect(lignes(f)[1].slice(0, 13)).toEqual([
      "DoggyBag",
      jour(),
      ...TITRES.map(() => ""),
      "",
      "1.104.0",
    ]);
    expect(fonds(f, 2, [3, 11])).toEqual([ROUGE, ROUGE]);
  });

  test("recochée : la nouvelle valeur remplace l'ancienne, en vert ; valeur partagée mais illisible ce jour-là : sans couleur", () => {
    const f = fichier();
    f.doPost(releve({ jour: jour(-1) }));
    f.doPost(releve({ partages: { ...TOUT, va: false } }));
    expect([lignes(f)[1][6], fonds(f, 2, [7])]).toEqual([7, [ROUGE]]);
    f.doPost(releve({ donnees: { ...DONNEES, va: 9, cdf: undefined } }));
    expect(lignes(f)[1].slice(2, 7)).toEqual([38, "", 3100000, 5890000, 9]);
    expect(fonds(f, 2, [3, 4, 7])).toEqual([VERT, null, VERT]);
  });
});

describe("une ligne par joueur", () => {
  test("même joueur, autre appareil ou autre jour : sa ligne est remplacée, pseudo comparé sans la casse", () => {
    const f = fichier();
    f.doPost(releve({ jour: jour(-1) }));
    expect(f.doPost(releve({ joueur: "doggybag", donnees: { ...DONNEES, tdp: 39 } }))).toEqual({
      ok: true,
      nouveau: false,
      dernier: true,
    });
    expect(lignes(f)).toHaveLength(2);
    expect(lignes(f)[1].slice(0, 3)).toEqual(["doggybag", jour(), 39]);
    // même jour, de nouveau
    f.doPost(releve({ donnees: { ...DONNEES, tdp: 40 } }));
    expect(lignes(f).map((l: unknown[]) => l[2])).toEqual(["TdP", 40]);
  });

  test("joueurs différents : une ligne chacun, dans l'ordre d'arrivée", () => {
    const f = fichier();
    f.doPost(releve({ jour: jour(-1) }));
    expect(f.doPost(releve({ joueur: "Lassie", donnees: { ...DONNEES, tdp: 20 } }))).toEqual({
      ok: true,
      nouveau: true,
      dernier: true,
    });
    f.doPost(releve({ donnees: { ...DONNEES, tdp: 39 } }));
    expect(lignes(f).map((l: unknown[]) => l.slice(0, 3))).toEqual([
      ["Joueur", "Date", "TdP"],
      ["DoggyBag", jour(), 39],
      ["Lassie", jour(), 20],
    ]);
  });

  test("relevé plus ancien que celui de la ligne du joueur : rien n'est écrit", () => {
    const f = fichier();
    f.doPost(releve({ donnees: { ...DONNEES, tdp: 39 } }));
    const avant = JSON.stringify([lignes(f), f.onglets[ONGLET].fonds]);
    expect(
      f.doPost(releve({ jour: jour(-1), partages: { ...TOUT, va: false }, version: "1.0.0" })),
    ).toEqual({
      ok: true,
      nouveau: false,
      dernier: false,
    });
    expect(JSON.stringify([lignes(f), f.onglets[ONGLET].fonds])).toBe(avant);
  });

  test("ligne du joueur en double (copiée à la main) : la première est remplacée, l'autre n'est pas touchée", () => {
    const f = fichier();
    f.doPost(releve());
    const grille = f.onglets[ONGLET].grille;
    grille.push([...grille[1]]);
    grille[2][2] = 1;
    f.doPost(releve({ donnees: { ...DONNEES, tdp: 39 }, partages: { ...TOUT, va: false } }));
    expect(lignes(f).map((l: unknown[]) => [l[2], l[6]])).toEqual([
      ["TdP", "VA"],
      [39, 7],
      [1, 7],
    ]);
    expect([fonds(f, 2, [7]), fonds(f, 3, [7])]).toEqual([[ROUGE], [undefined]]);
  });

  test("plus de joueurs que de lignes dans l'onglet : des lignes sont ajoutées", () => {
    const f = fichier({ "Dernier relevé": feuille("Dernier relevé", [["Joueur", "Date"]], 2) });
    f.doPost(releve());
    f.doPost(releve({ joueur: "Lassie" }));
    expect(lignes(f)).toHaveLength(3);
    expect(f.onglets[ONGLET].getMaxRows()).toBe(3);
  });
});

describe("fichier modifié à la main", () => {
  test("colonnes déplacées, colonne ajoutée, colonne vide, lignes triées, date tapée : chaque valeur va sous son titre, les autres cases restent sous le leur", () => {
    const f = fichier({
      "Dernier relevé": feuille("Dernier relevé", [
        ["Note", "", "TdP", "Joueur", "Date"],
        ["chef", "", 1, "Lassie", "01/11/2026"],
        ["à relancer", "x", 30, "DoggyBag", jour(-1).split("-").reverse().join("/")],
      ]),
    });
    // fonds mis à la main : sur une colonne ajoutée, et sur le pseudo du joueur
    f.onglets["Dernier relevé"].fonds["3,1"] = "#ffff00";
    f.onglets["Dernier relevé"].fonds["3,4"] = "#00ffff";
    f.doPost(releve());
    const [titres, lassie, moi] = lignes(f);
    // titre manquant inséré après celui qui le précède dans la liste (TdP, CdF…)
    expect(titres).toEqual([
      "Note",
      "",
      "TdP",
      ...TITRES.filter((t) => t != "TdP"),
      AUTRES,
      "Version",
      "Joueur",
      "Date",
    ]);
    // les cases glissent avec leur colonne : chacune reste sous son titre
    expect(lassie).toEqual([
      "chef",
      "",
      1,
      ...TITRES.slice(1).map(() => ""),
      "",
      "",
      "Lassie",
      "01/11/2026",
    ]);
    const colonne = (titre: string) => titres.indexOf(titre) + 1;
    expect(
      ["Note", "", "TdP", "Joueur", "Date", "CdF", "Ouvrières"].map((t, i) =>
        i == 1 ? moi[1] : moi[colonne(t) - 1],
      ),
    ).toEqual(["à relancer", "x", 38, "DoggyBag", jour(), 250000, 412000]);
    // seules les cases des informations sont colorées ; un fond mis à la main suit sa case
    expect(fonds(f, 3, [1, 2, 3, colonne("Joueur"), colonne("Date"), colonne("CdF")])).toEqual([
      "#ffff00",
      undefined,
      VERT,
      "#00ffff",
      undefined,
      VERT,
    ]);
    expect(lignes(f)).toHaveLength(3);
  });

  test("nouvelle information (Ouvrières, 1.129.0) dans un onglet créé avant : colonne insérée après Champignonnière, sans couleur pour les autres joueurs", () => {
    const anciens = TITRES.filter((t) => t != "Ouvrières");
    const f = fichier({
      "Dernier relevé": feuille("Dernier relevé", [
        ["Joueur", "Date", ...anciens, "Version", "", "partagé", "non partagé"],
        ["Lassie", jour(-1), 30, 1000, 2000, 3000, 5, 6, 1, 15, "1.128.0"],
      ]),
    });
    // Lassie partage tout sauf sa Champignonnière : fonds verts et un rouge
    anciens.forEach((t, i) => (f.onglets[ONGLET].fonds[`2,${i + 3}`] = i == 7 ? ROUGE : VERT));
    f.onglets[ONGLET].fonds["1,13"] = VERT;
    f.onglets[ONGLET].fonds["1,14"] = ROUGE;
    f.doPost(releve());
    const [titres, lassie, moi] = lignes(f);
    expect(titres).toEqual([
      "Joueur",
      "Date",
      ...TITRES,
      AUTRES,
      "Version",
      "",
      "partagé",
      "non partagé",
    ]);
    expect(lassie).toEqual([
      "Lassie",
      jour(-1),
      30,
      1000,
      2000,
      3000,
      5,
      6,
      1,
      15,
      "",
      "",
      "1.128.0",
    ]);
    expect(moi.slice(10, 13)).toEqual([412000, "", "1.104.0"]);
    // la case insérée ne prend pas le rouge de sa voisine : rien n'y dit « non partagé »
    expect(fonds(f, 2, [10, 11, 12])).toEqual([ROUGE, null, null]);
    expect(fonds(f, 3, [10, 11])).toEqual([VERT, VERT]);
    expect(fonds(f, 1, [15, 16])).toEqual([VERT, ROUGE]);
    expect(f.onglets[ONGLET].formats["2,11"]).toBe("#,##0");
    const { releves } = f.doPost({ releves: true });
    expect(releves.map((r: any) => [r.joueur, r.valeurs.ouvrieres, r.partages.ouvrieres])).toEqual([
      ["Lassie", null, null],
      ["DoggyBag", 412000, true],
    ]);
  });

  test("pseudo qui commencerait une formule : écrit comme du texte, retrouvé ensuite", () => {
    const f = fichier();
    f.doPost(releve({ joueur: "-Alpha-" }));
    f.doPost(releve({ joueur: "-Alpha-", donnees: { ...DONNEES, tdp: 40 } }));
    expect(lignes(f).map((l: unknown[]) => l.slice(0, 3))).toEqual([
      ["Joueur", "Date", "TdP"],
      ["'-Alpha-", jour(), 40],
    ]);
  });
});

describe("relevés refusés : rien n'est écrit", () => {
  const refus = (plus: Record<string, unknown>) => {
    const f = fichier(),
      r = f.doPost(releve(plus));
    return [r.erreur, Object.keys(f.onglets).length];
  };
  test("pseudo, jour, valeur ou partage invalides", () => {
    expect(refus({ joueur: "" })).toEqual(["pseudo invalide", 0]);
    expect(refus({ joueur: "a<b" })).toEqual(["pseudo invalide", 0]);
    expect(refus({ joueur: " Alpha" })).toEqual(["pseudo invalide", 0]);
    expect(refus({ joueur: "x".repeat(31) })).toEqual(["pseudo invalide", 0]);
    expect(refus({ jour: "12/11/2026" })).toEqual(["jour invalide", 0]);
    expect(refus({ jour: "2026-02-30" })).toEqual(["jour invalide", 0]);
    expect(refus({ donnees: { ...DONNEES, cdf: "250000" } })).toEqual(["valeur invalide : CdF", 0]);
    expect(refus({ donnees: { ...DONNEES, va: -1 } })).toEqual(["valeur invalide : VA", 0]);
    expect(refus({ partages: { ...TOUT, vc: "oui" } })).toEqual(["partage invalide : VC", 0]);
    expect(refus({ version: "<script>" })).toEqual(["version invalide", 0]);
  });

  test("jour à plus d'un jour d'aujourd'hui ; la veille et le lendemain passent (minuit du jeu et de Google)", () => {
    expect(refus({ jour: jour(-3) })).toEqual(["jour trop éloigné d'aujourd'hui", 0]);
    expect(refus({ jour: jour(3) })).toEqual(["jour trop éloigné d'aujourd'hui", 0]);
    expect(refus({ jour: jour(-1) })[0]).toBeUndefined();
    expect(refus({ jour: jour(1) })[0]).toBeUndefined();
  });

  test("requête d'un autre script (export des RC) ou illisible", () => {
    const f = fichier();
    expect(f.doPost({ onglet: "BDD chasse", entetes: ["Clé"], lignes: [] })).toEqual({
      erreur: "requête invalide",
    });
    expect(f.doPost({ suivi: "tout" })).toEqual({ erreur: "requête invalide" });
    expect(f.doPostBrut("{pas du json")).toEqual({ erreur: "requête illisible" });
    expect(Object.keys(f.onglets)).toHaveLength(0);
  });
});

describe("lecture des niveaux de champignonnière (colonies d'un seigneur, 1.123.0)", () => {
  test("niveau et jour de chaque joueur demandé, pseudo sans les majuscules ; rien d'écrit", () => {
    const f = fichier();
    f.doPost(releve({ joueur: "Vassal Un" }));
    f.doPost(releve({ joueur: "Autre", donnees: { ...DONNEES, champignonniere: 21 } }));
    const avant = JSON.stringify(f.onglets[ONGLET].grille);
    expect(f.doPost({ niveaux: { joueurs: ["vassal un", "Autre", "Inconnu"] } })).toEqual({
      ok: true,
      niveaux: {
        "vassal un": { champignonniere: 17, jour: jour() },
        Autre: { champignonniere: 21, jour: jour() },
      },
    });
    expect(JSON.stringify(f.onglets[ONGLET].grille)).toBe(avant);
  });

  test("case vide (jamais partagée) : niveau inconnu ; colonnes déplacées à la main", () => {
    const f = fichier({
      "Dernier relevé": feuille("Dernier relevé", [
        ["Champignonnière", "Joueur", "Date"],
        ["", "Vassal", "16/11/2026"],
        ["18", "Deux", "16/11/2026"],
      ]),
    });
    expect(f.doPost({ niveaux: { joueurs: ["Vassal", "Deux"] } })).toEqual({
      ok: true,
      niveaux: {
        Vassal: { champignonniere: null, jour: "2026-11-16" },
        Deux: { champignonniere: 18, jour: "2026-11-16" },
      },
    });
  });

  test("demande invalide refusée ; fichier vide : aucun niveau", () => {
    const f = fichier();
    expect(f.doPost({ niveaux: { joueurs: "Vassal" } })).toEqual({ erreur: "joueurs invalides" });
    expect(f.doPost({ niveaux: { joueurs: Array(51).fill("A") } })).toEqual({
      erreur: "joueurs invalides",
    });
    expect(f.doPost({ niveaux: { joueurs: ["Vassal"] } })).toEqual({ ok: true, niveaux: {} });
    expect(f.doGet()).toMatchObject({ niveaux: true });
  });
});

describe("lecture de tout l'onglet pour la vue « Stats membres » (1.127.0)", () => {
  test("une entrée par joueur : date et heure, valeurs ; une information non partagée sans sa valeur ; rien d'écrit", () => {
    const f = fichier();
    f.doPost(releve({ joueur: "Alpha" }));
    f.doPost(releve({ joueur: "Bravo", donnees: { ...DONNEES, va: 9 } }));
    // Bravo décoche ensuite la CdF : la case garde sa valeur, sur fond rouge
    f.doPost(
      releve({
        joueur: "Bravo",
        donnees: { ...DONNEES, va: 10, cdf: undefined },
        partages: { ...TOUT, cdf: false },
      }),
    );
    const avant = JSON.stringify([f.onglets[ONGLET].grille, f.onglets[ONGLET].fonds]);
    const r = f.doPost({ releves: true });
    expect(JSON.stringify([f.onglets[ONGLET].grille, f.onglets[ONGLET].fonds])).toBe(avant);
    expect(r.ok).toBe(true);
    expect(r.releves.map((x: any) => x.joueur)).toEqual(["Alpha", "Bravo"]);
    const [alpha, bravo] = r.releves;
    expect(alpha.date).toMatch(new RegExp(`^${jour()} \\d{2}:\\d{2}$`));
    expect(alpha.valeurs).toEqual(DONNEES);
    expect(alpha.partages).toEqual(TOUT);
    expect(bravo.valeurs).toEqual({ ...DONNEES, va: 10, cdf: null });
    expect(bravo.partages).toEqual({ ...TOUT, cdf: false });
    // la case garde la valeur pour le fichier
    expect(lignes(f)[2][3]).toBe(250000);
  });

  test("colonnes déplacées ou absentes, ligne écrite à la main, jour sans heure ; onglet vide ou absent", () => {
    const f = fichier({
      "Dernier relevé": feuille("Dernier relevé", [
        ["VA", "Joueur", "Date", "TdP"],
        ["7", "'Alpha", "16/11/2026", 38],
        ["", "Bravo", "16/11/2026", "1 234"],
        ["5", "", "16/11/2026", 1],
      ]),
    });
    expect(f.doPost({ releves: true })).toEqual({
      ok: true,
      releves: [
        {
          joueur: "Alpha",
          date: "2026-11-16",
          valeurs: { ...Object.fromEntries(CLES.map((c) => [c, null])), va: 7, tdp: 38 },
          partages: Object.fromEntries(CLES.map((c) => [c, null])),
        },
        {
          joueur: "Bravo",
          date: "2026-11-16",
          valeurs: { ...Object.fromEntries(CLES.map((c) => [c, null])), tdp: 1234 },
          partages: Object.fromEntries(CLES.map((c) => [c, null])),
        },
      ],
    });
    expect(fichier().doPost({ releves: true })).toEqual({ ok: true, releves: [] });
    expect(fichier().doGet()).toMatchObject({
      releves: true,
      relevesPublics: true,
      version: "stats-membres 2026-11-20.1",
      journal: true,
    });
  });
});

describe("partage avec les autres membres (1.136.0) : colonne « Partagé avec les autres », lecture des non-chefs", () => {
  const AUCUN = Object.fromEntries(CLES.map((c) => [c, false]));
  const colonneAutres = (f: ReturnType<typeof fichier>) => {
    const [titres, ...rangs] = lignes(f);
    return rangs.map((l: unknown[]) => [l[titres.indexOf("Joueur")], l[titres.indexOf(AUTRES)]]);
  };

  test("le relevé liste les informations partagées avec les autres, jamais une information décochée pour les chefs ; extension d'avant : rien", () => {
    const f = fichier();
    f.doPost(releve({ joueur: "Alpha", publics: { ...AUCUN, tdp: true, va: true } }));
    f.doPost(
      releve({
        joueur: "Bravo",
        donnees: { ...DONNEES, cdf: undefined },
        partages: { ...TOUT, cdf: false },
        publics: { ...AUCUN, cdf: true, champignonniere: true },
      }),
    );
    f.doPost(releve({ joueur: "Charlie" }));
    expect(colonneAutres(f)).toEqual([
      ["Alpha", "TdP, VA"],
      ["Bravo", "Champignonnière"],
      ["Charlie", ""],
    ]);
    // plus rien partagé avec les autres au relevé suivant : la case est vidée
    f.doPost(releve({ joueur: "Alpha", publics: AUCUN }));
    expect(colonneAutres(f)[0]).toEqual(["Alpha", ""]);
  });

  test("lecture d'un non-chef : seulement les joueurs qui partagent au moins une information avec les autres, et celles-là ; rien d'écrit", () => {
    const f = fichier();
    f.doPost(releve({ joueur: "Alpha", publics: { ...AUCUN, tdp: true, va: true } }));
    f.doPost(releve({ joueur: "Bravo", publics: AUCUN }));
    f.doPost(releve({ joueur: "Charlie" }));
    // TdP listé à la main mais décoché ensuite pour les chefs (fond rouge) : pas rendu
    f.doPost(
      releve({
        joueur: "Delta",
        donnees: { ...DONNEES, tdp: undefined },
        partages: { ...TOUT, tdp: false },
        publics: { ...AUCUN, ouvrieres: true },
      }),
    );
    const [titres] = lignes(f);
    f.onglets[ONGLET].grille[4][titres.indexOf(AUTRES)] = "Ouvrières, TdP";
    const avant = JSON.stringify([f.onglets[ONGLET].grille, f.onglets[ONGLET].fonds]);
    const r = f.doPost({ relevesPublics: true });
    expect(JSON.stringify([f.onglets[ONGLET].grille, f.onglets[ONGLET].fonds])).toBe(avant);
    expect(r.releves.map((x: any) => x.joueur)).toEqual(["Alpha", "Delta"]);
    const [alpha, delta] = r.releves;
    expect(alpha.partages).toEqual({ ...AUCUN, tdp: true, va: true });
    expect(alpha.valeurs).toEqual({
      ...Object.fromEntries(CLES.map((c) => [c, null])),
      tdp: 38,
      va: 7,
    });
    expect(delta.partages).toEqual({ ...AUCUN, ouvrieres: true });
    expect(delta.valeurs.tdp).toBe(null);
    // la lecture d'un chef rend toujours tout ce qui est partagé avec les chefs
    expect(f.doPost({ releves: true }).releves.map((x: any) => x.joueur)).toEqual([
      "Alpha",
      "Bravo",
      "Charlie",
      "Delta",
    ]);
  });

  test("onglet d'avant cette colonne : aucun joueur pour un non-chef ; partage avec les autres invalide refusé", () => {
    const f = fichier({
      "Dernier relevé": feuille("Dernier relevé", [
        ["Joueur", "Date", "TdP"],
        ["Alpha", "16/11/2026", 38],
      ]),
    });
    expect(f.doPost({ relevesPublics: true })).toEqual({ ok: true, releves: [] });
    expect(f.doPost(releve({ publics: { tdp: "oui" } }))).toEqual({
      erreur: "partage invalide : TdP",
    });
    expect(f.doPost(releve({ publics: "tout" }))).toEqual({ erreur: "informations invalides" });
  });
});

describe("journal de débug : onglet « Journal » (1.145.0, demande du mainteneur, 20/11/2026)", () => {
  const TITRES_JOURNAL = [
    "Reçu le",
    "Joueur",
    "Serveur",
    "Appareil",
    "Note du",
    "Niveau",
    "Source",
    "Page",
    "Version",
    "Répétitions",
    "Message",
    "Détail",
    "Clé",
  ];
  const note = (t: number, plus: Record<string, unknown> = {}) => ({
    t,
    niveau: "erreur",
    source: "Export Google Sheet",
    message: "le script ne répond pas",
    detail: "statut 502",
    page: "Ressources.php",
    version: "1.145.0",
    x: 1,
    ...plus,
  });
  const journal = (notes: object[], plus: Record<string, unknown> = {}) => ({
    journal: {
      joueur: "Alpha",
      serveur: "s5.fourmizzz.fr",
      appareil: "Violentmonkey 2.30 | Mozilla/5.0 (Android)",
      version: "1.145.0",
      notes,
      ...plus,
    },
  });
  const T = Date.UTC(2026, 10, 20, 9, 0, 0);

  test("une ligne par note, onglet créé au premier envoi, à la largeur de ses colonnes ; relevés intacts", () => {
    const f = fichier();
    f.doPost(releve());
    expect(
      f.doPost(
        journal([note(T, { niveau: "info", message: "sujets lus", detail: "" }), note(T + 1000)]),
      ),
    ).toEqual({ ok: true, ajoutees: 2, deja: 0 });
    expect(f.ordre).toEqual([ONGLET, "Journal"]);
    const j = f.onglets.Journal;
    expect(j.grille[0]).toEqual(TITRES_JOURNAL);
    expect(j.getMaxColumns()).toBe(TITRES_JOURNAL.length);
    const [l1, l2] = j.grille.slice(1);
    expect(l1[0]).toBeInstanceOf(Date);
    expect((l1[4] as Date).getTime()).toBe(T);
    expect(l1.slice(1, 4)).toEqual([
      "Alpha",
      "s5.fourmizzz.fr",
      "Violentmonkey 2.30 | Mozilla/5.0 (Android)",
    ]);
    expect(l1.slice(5)).toEqual([
      "INFO",
      "Export Google Sheet",
      "Ressources.php",
      "1.145.0",
      1,
      "sujets lus",
      "",
      `alpha|${T}|info|Export Google Sheet`,
    ]);
    expect(l2.slice(5, 12)).toEqual([
      "ERREUR",
      "Export Google Sheet",
      "Ressources.php",
      "1.145.0",
      1,
      "le script ne répond pas",
      "statut 502",
    ]);
    // dates à la seconde, textes gardés tels quels, une ligne de haut par note
    expect(j.formats["2,1"]).toBe("dd/MM/yyyy HH:mm:ss");
    expect(j.formats["2,5"]).toBe("dd/MM/yyyy HH:mm:ss");
    expect(j.formats["2,11"]).toBe("@");
    expect(j.hauteurs[2]).toBe(21);
    // le relevé du joueur n'a pas bougé
    expect(lignes(f)[1][0]).toBe("DoggyBag");
  });

  test("envoi repris (réponse perdue) : une note déjà reçue n'est pas recopiée", () => {
    const f = fichier();
    f.doPost(journal([note(T), note(T + 1000)]));
    expect(f.doPost(journal([note(T), note(T + 1000), note(T + 2000)]))).toEqual({
      ok: true,
      ajoutees: 1,
      deja: 2,
    });
    expect(f.onglets.Journal.grille).toHaveLength(4);
    // un autre joueur au même instant : ses lignes à lui
    expect(f.doPost(journal([note(T)], { joueur: "Bravo" }))).toMatchObject({ ajoutees: 1 });
  });

  test("conservé sans limite : les lignes s'ajoutent sous les autres, la grille s'agrandit", () => {
    const f = fichier({ Journal: feuille("Journal", [TITRES_JOURNAL], 3) });
    const notes = Array.from({ length: 5 }, (_, i) => note(T + i * 1000));
    expect(f.doPost(journal(notes))).toMatchObject({ ajoutees: 5 });
    expect(f.onglets.Journal.getMaxRows()).toBe(6);
    expect(f.doPost(journal([note(T + 9000)]))).toMatchObject({ ajoutees: 1 });
    expect(f.onglets.Journal.grille).toHaveLength(7);
  });

  test("colonnes déplacées à la main : chaque valeur sous son titre", () => {
    const melange = [...TITRES_JOURNAL].reverse();
    const f = fichier({ Journal: feuille("Journal", [melange]) });
    f.doPost(journal([note(T)]));
    const l = f.onglets.Journal.grille[1];
    expect(l[melange.indexOf("Joueur")]).toBe("Alpha");
    expect(l[melange.indexOf("Message")]).toBe("le script ne répond pas");
  });

  test("texte qui commence par = + - @ : jamais une formule", () => {
    const f = fichier();
    f.doPost(journal([note(T, { message: "=IMPORTXML(x)", detail: "-5" })]));
    expect(f.onglets.Journal.grille[1].slice(10, 12)).toEqual(["'=IMPORTXML(x)", "'-5"]);
  });

  test("fichier presque plein : le journal n'est plus écrit, les relevés le sont toujours", () => {
    const f = fichier({
      Gros: feuille("Gros", [["x"]], 400000),
      Journal: feuille("Journal", [TITRES_JOURNAL], 1),
    });
    expect(f.doPost(journal([note(T)]))).toEqual({
      erreur: "fichier presque plein : supprimer d'anciennes lignes de l'onglet « Journal »",
    });
    expect(f.onglets.Journal.grille).toHaveLength(1);
    expect(f.doPost(releve())).toMatchObject({ ok: true });
  });

  test("journaux refusés", () => {
    const f = fichier();
    const refus = (corps: object) => f.doPost(corps).erreur;
    expect(refus(journal([note(T)], { joueur: "" }))).toBe("joueur invalide");
    expect(refus(journal([]))).toBe("notes invalides");
    expect(refus(journal(Array.from({ length: 201 }, (_, i) => note(T + i))))).toBe(
      "notes invalides",
    );
    expect(refus(journal([note(T, { niveau: "panique" })]))).toBe("note 1 invalide");
    expect(refus(journal([note(T), note(Number.NaN)]))).toBe("note 2 invalide");
    expect(refus(journal([note(T, { x: 0 })]))).toBe("note 1 invalide");
    expect(refus(journal([note(T, { message: "a".repeat(2001) })]))).toBe(
      "note 1 invalide (message)",
    );
    expect(refus(journal([note(T)], { appareil: "a".repeat(401) }))).toBe("appareil invalide");
    expect(f.onglets.Journal).toBeUndefined();
  });
});
