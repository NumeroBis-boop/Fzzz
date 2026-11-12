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
const TITRES = ["TdP", "CdF", "FdF HB", "FdF AB", "VA", "VC", "Puceron", "Champignonnière"];
const CLES = ["tdp", "cdf", "fdfHB", "fdfAB", "va", "vc", "puceron", "champignonniere"];

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
    expect(lignes(f).map((l: unknown[]) => l.slice(0, 11))).toEqual([
      ["Joueur", "Date", ...TITRES, "Version"],
      ["DoggyBag", jour(), 38, 250000, 3100000, 5890000, 7, 8, 2, 17, "1.104.0"],
    ]);
  });

  test("légende des couleurs à droite des titres ; cases partagées en vert, joueur et date sans couleur", () => {
    const f = fichier();
    f.doPost(releve());
    expect(f.onglets[ONGLET].grille[0].slice(12, 14)).toEqual(["partagé", "non partagé"]);
    expect(fonds(f, 1, [13, 14])).toEqual([VERT, ROUGE]);
    expect(fonds(f, 2, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])).toEqual([
      undefined,
      undefined,
      ...TITRES.map(() => VERT),
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
    // seule la case de la date reçoit ce format
    expect(Object.keys(f.onglets[ONGLET].formats).sort()).toEqual(["2,2", "3,2"]);
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
    expect(lignes(f)[1].slice(0, 11)).toEqual([
      "DoggyBag",
      jour(),
      ...TITRES.map(() => ""),
      "1.104.0",
    ]);
    expect(fonds(f, 2, [3, 10])).toEqual([ROUGE, ROUGE]);
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
  test("colonnes déplacées, colonne ajoutée, colonne vide, lignes triées, date tapée : chaque valeur va sous son titre, les autres cases ne sont pas touchées", () => {
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
    // titres manquants ajoutés au bout
    expect(titres).toEqual([
      "Note",
      "",
      "TdP",
      "Joueur",
      "Date",
      ...TITRES.filter((t) => t != "TdP"),
      "Version",
    ]);
    expect(lassie).toEqual(["chef", "", 1, "Lassie", "01/11/2026"]);
    expect(moi.slice(0, 7)).toEqual(["à relancer", "x", 38, "DoggyBag", jour(), 250000, 3100000]);
    // seules les cases des informations sont colorées
    expect(fonds(f, 3, [1, 2, 3, 4, 5, 6])).toEqual([
      "#ffff00",
      undefined,
      VERT,
      "#00ffff",
      undefined,
      VERT,
    ]);
    expect(lignes(f)).toHaveLength(3);
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
