import { describe, expect, test } from "bun:test";
import { classeurSimule, feuille } from "./sheet-simule";

/**
 * Script du Google Sheet « Stats membres » (google-sheet/stats-membres.gs,
 * 1.104.0, demande du mainteneur) : le relevé quotidien d'un joueur va dans
 * « Dernier relevé » (une ligne par joueur) et dans « Suivi » (une ligne par
 * joueur et par jour) ; le fond d'une case dit si le joueur partage cette
 * information (vert) ou a décoché sa case (rouge : la dernière valeur lue y
 * reste, règle du mainteneur ; case vide s'il ne l'a jamais partagée).
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
// lignes d'un onglet : dates rendues en jours de Paris
const lignes = (f: ReturnType<typeof fichier>, nom: string) =>
  f.onglets[nom].grille.map((l: unknown[]) =>
    l.map((v) =>
      v instanceof Date
        ? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(v)
        : v,
    ),
  );
const fonds = (f: ReturnType<typeof fichier>, nom: string, ligne: number, colonnes: number[]) =>
  colonnes.map((c) => f.onglets[nom].fonds[`${ligne},${c}`]);

describe("premier relevé : onglets créés, une ligne dans chacun", () => {
  test("titres, valeurs, version ; la date est celle du jour dans le fuseau du fichier, à minuit", () => {
    const f = fichier();
    expect(f.doPost(releve())).toEqual({ ok: true, nouveau: true, dernier: true });
    expect(f.ordre).toEqual(["Dernier relevé", "Suivi"]);
    expect(lignes(f, "Dernier relevé").map((l: unknown[]) => l.slice(0, 11))).toEqual([
      ["Joueur", "Date", ...TITRES, "Version"],
      ["DoggyBag", jour(), 38, 250000, 3100000, 5890000, 7, 8, 2, 17, "1.104.0"],
    ]);
    expect(lignes(f, "Suivi").map((l: unknown[]) => l.slice(0, 11))).toEqual([
      ["Date", "Joueur", ...TITRES, "Version"],
      [jour(), "DoggyBag", 38, 250000, 3100000, 5890000, 7, 8, 2, 17, "1.104.0"],
    ]);
    const date = f.onglets["Suivi"].grille[1][0] as Date;
    expect(
      new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", timeStyle: "short" }).format(
        date,
      ),
    ).toBe("00:00");
  });

  test("légende des couleurs à droite des titres ; cases partagées en vert, joueur et date sans couleur", () => {
    const f = fichier();
    f.doPost(releve());
    for (const nom of ["Dernier relevé", "Suivi"]) {
      expect(f.onglets[nom].grille[0].slice(12, 14)).toEqual(["partagé", "non partagé"]);
      expect(fonds(f, nom, 1, [13, 14])).toEqual([VERT, ROUGE]);
      expect(fonds(f, nom, 2, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])).toEqual([
        undefined,
        undefined,
        ...TITRES.map(() => VERT),
        undefined,
      ]);
    }
  });

  test("adresse ouverte dans le navigateur : version du script, onglets créés", () => {
    const f = fichier();
    expect(f.doGet()).toMatchObject({ ok: true, suivi: true });
    expect(String(f.doGet().version)).toMatch(/^stats-membres \d{4}-\d{2}-\d{2}\.\d+$/);
    expect(f.ordre).toEqual(["Dernier relevé", "Suivi"]);
    expect(f.onglets["Suivi"].grille).toHaveLength(1);
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
    for (const nom of ["Dernier relevé", "Suivi"]) {
      expect(lignes(f, nom)[1].slice(2, 10)).toEqual([38, 250000, 3100000, "", 7, 8, "", 17]);
      expect(fonds(f, nom, 2, [3, 4, 5, 6, 7, 8, 9, 10])).toEqual([
        VERT,
        VERT,
        VERT,
        ROUGE,
        VERT,
        VERT,
        ROUGE,
        VERT,
      ]);
    }
  });

  test("décochée après un relevé du jour : la dernière valeur lue reste, sur fond rouge, dans les deux onglets", () => {
    const f = fichier();
    f.doPost(releve());
    // la valeur envoyée malgré la case décochée n'est pas écrite ; le reste est mis à jour
    f.doPost(
      releve({
        donnees: { ...DONNEES, tdp: 39, fdfAB: 999 },
        partages: { ...TOUT, fdfAB: false, puceron: false },
      }),
    );
    for (const nom of ["Dernier relevé", "Suivi"]) {
      expect(lignes(f, nom)).toHaveLength(2);
      expect(lignes(f, nom)[1].slice(2, 10)).toEqual([39, 250000, 3100000, 5890000, 7, 8, 2, 17]);
      expect(fonds(f, nom, 2, [3, 6, 9, 10])).toEqual([VERT, ROUGE, ROUGE, VERT]);
    }
  });

  test("toujours décochée les jours suivants : la dernière valeur lue suit dans « Suivi », en rouge", () => {
    const f = fichier();
    f.doPost(releve({ jour: jour(-1) }));
    f.doPost(releve({ donnees: { ...DONNEES, tdp: 39 }, partages: { ...TOUT, cdf: false } }));
    f.doPost(
      releve({ jour: jour(1), donnees: { tdp: 40 }, partages: { ...TOUT, cdf: false, va: false } }),
    );
    expect(lignes(f, "Suivi").map((l: unknown[]) => [l[0], l[2], l[3], l[6]])).toEqual([
      ["Date", "TdP", "CdF", "VA"],
      [jour(-1), 38, 250000, 7],
      [jour(), 39, 250000, 7],
      [jour(1), 40, 250000, 7],
    ]);
    expect([2, 3, 4].map((l) => fonds(f, "Suivi", l, [4, 7]))).toEqual([
      [VERT, VERT],
      [ROUGE, VERT],
      [ROUGE, ROUGE],
    ]);
    expect(lignes(f, "Dernier relevé")[1].slice(1, 7)).toEqual([jour(1), 40, 250000, "", "", 7]);
    expect(fonds(f, "Dernier relevé", 2, [3, 4, 5, 7])).toEqual([VERT, ROUGE, null, ROUGE]);
  });

  test("relevé de la veille reçu après celui du jour : sa case non partagée prend la valeur lue avant la veille", () => {
    const f = fichier();
    f.doPost(releve({ jour: jour(-1), donnees: { ...DONNEES, va: 6 } }));
    f.doPost(releve({ jour: jour(1), donnees: { ...DONNEES, va: 8 } }));
    f.doPost(releve({ partages: { ...TOUT, va: false } }));
    expect(lignes(f, "Suivi").map((l: unknown[]) => [l[0], l[6]])).toEqual([
      ["Date", "VA"],
      [jour(-1), 6],
      [jour(1), 8],
      [jour(), 6],
    ]);
    // « Dernier relevé » garde le plus récent, partagé
    expect(
      lignes(f, "Dernier relevé")[1].slice(1, 2).concat(lignes(f, "Dernier relevé")[1][6]),
    ).toEqual([jour(1), 8]);
    expect(fonds(f, "Dernier relevé", 2, [7])).toEqual([VERT]);
  });

  test("lignes triées à la main (la plus récente en premier) : c'est bien la valeur du relevé le plus récent qui est reprise", () => {
    const f = fichier();
    f.doPost(releve({ jour: jour(-1), donnees: { ...DONNEES, va: 5 } }));
    f.doPost(releve());
    const grille = f.onglets["Suivi"].grille;
    [grille[1], grille[2]] = [grille[2], grille[1]];
    f.doPost(releve({ jour: jour(1), partages: { ...TOUT, va: false } }));
    expect(lignes(f, "Suivi").map((l: unknown[]) => [l[0], l[6]])).toEqual([
      ["Date", "VA"],
      [jour(), 7],
      [jour(-1), 5],
      [jour(1), 7],
    ]);
  });

  test("relevé précédent sans cette valeur (page illisible ce jour-là) : la valeur lue avant lui est reprise", () => {
    const f = fichier();
    f.doPost(releve({ jour: jour(-1), donnees: { ...DONNEES, va: 5 } }));
    f.doPost(releve({ donnees: { ...DONNEES, va: undefined } }));
    f.doPost(releve({ jour: jour(1), partages: { ...TOUT, va: false } }));
    expect(lignes(f, "Suivi").map((l: unknown[]) => [l[0], l[6]])).toEqual([
      ["Date", "VA"],
      [jour(-1), 5],
      [jour(), ""],
      [jour(1), 5],
    ]);
  });

  test("ligne du jour sans cette valeur, placée avant celle de la veille : la valeur de la veille est reprise", () => {
    const f = fichier();
    f.doPost(releve({ jour: jour(-1), donnees: { ...DONNEES, va: 5 } }));
    f.doPost(releve({ donnees: { ...DONNEES, va: undefined } }));
    const grille = f.onglets["Suivi"].grille;
    [grille[1], grille[2]] = [grille[2], grille[1]];
    f.doPost(releve({ partages: { ...TOUT, va: false } }));
    expect(lignes(f, "Suivi").map((l: unknown[]) => [l[0], l[6]])).toEqual([
      ["Date", "VA"],
      [jour(), 5],
      [jour(-1), 5],
    ]);
  });

  test("ligne du jour en double (copiée à la main) : la première est remplacée, l'autre n'est pas touchée", () => {
    const f = fichier();
    f.doPost(releve());
    const grille = f.onglets["Suivi"].grille;
    grille.push([...grille[1]]);
    grille[2][2] = 1;
    f.doPost(releve({ donnees: { ...DONNEES, tdp: 39 }, partages: { ...TOUT, va: false } }));
    expect(lignes(f, "Suivi").map((l: unknown[]) => l[2])).toEqual(["TdP", 39, 1]);
  });

  test("« Suivi » vidé à la main : la valeur de « Dernier relevé » est reprise", () => {
    const f = fichier();
    f.doPost(releve({ jour: jour(-1) }));
    f.onglets["Suivi"].grille.length = 1;
    f.doPost(releve({ partages: { ...TOUT, va: false } }));
    expect(lignes(f, "Suivi")[1].slice(0, 2).concat(lignes(f, "Suivi")[1][6])).toEqual([
      jour(),
      "DoggyBag",
      7,
    ]);
    expect(fonds(f, "Suivi", 2, [7])).toEqual([ROUGE]);
  });

  test("valeur d'un autre joueur, ou case vidée à la main : rien n'est repris", () => {
    const f = fichier();
    f.doPost(releve({ joueur: "Lassie", jour: jour(-1) }));
    f.doPost(releve({ jour: jour(-1) }));
    f.onglets["Suivi"].grille[2][6] = "";
    f.onglets["Dernier relevé"].grille[2][6] = "";
    f.doPost(releve({ partages: { ...TOUT, va: false } }));
    expect(lignes(f, "Suivi")[3].slice(0, 7)).toEqual([
      jour(),
      "DoggyBag",
      38,
      250000,
      3100000,
      5890000,
      "",
    ]);
    expect(fonds(f, "Suivi", 4, [7])).toEqual([ROUGE]);
  });

  test("dernière valeur tapée à la main comme une formule : réécrite comme du texte", () => {
    const f = fichier();
    f.doPost(releve());
    f.onglets["Dernier relevé"].grille[1][6] = "=1+1";
    f.onglets["Suivi"].grille[1][6] = "=1+1";
    f.doPost(releve({ partages: { ...TOUT, va: false } }));
    expect([lignes(f, "Dernier relevé")[1][6], lignes(f, "Suivi")[1][6]]).toEqual([
      "'=1+1",
      "'=1+1",
    ]);
  });

  test("tout décoché dès le premier relevé : la ligne du joueur existe, tout en rouge, sans aucune valeur", () => {
    const f = fichier();
    f.doPost(releve({ donnees: {}, partages: Object.fromEntries(CLES.map((c) => [c, false])) }));
    expect(lignes(f, "Dernier relevé")[1].slice(0, 11)).toEqual([
      "DoggyBag",
      jour(),
      ...TITRES.map(() => ""),
      "1.104.0",
    ]);
    expect(fonds(f, "Dernier relevé", 2, [3, 10])).toEqual([ROUGE, ROUGE]);
  });

  test("recochée le lendemain : la case redevient verte ; valeur partagée mais illisible ce jour-là : sans couleur", () => {
    const f = fichier();
    f.doPost(releve({ jour: jour(-1), partages: { ...TOUT, va: false } }));
    f.doPost(releve({ donnees: { ...DONNEES, cdf: undefined } }));
    expect(lignes(f, "Dernier relevé")[1].slice(2, 7)).toEqual([38, "", 3100000, 5890000, 7]);
    expect(fonds(f, "Dernier relevé", 2, [3, 4, 7])).toEqual([VERT, null, VERT]);
    // l'historique garde le jour d'avant tel quel
    expect(fonds(f, "Suivi", 2, [7])).toEqual([ROUGE]);
  });

  test("recochée après avoir été décochée : la nouvelle valeur remplace l'ancienne, en vert", () => {
    const f = fichier();
    f.doPost(releve({ jour: jour(-1) }));
    f.doPost(releve({ partages: { ...TOUT, va: false } }));
    f.doPost(releve({ donnees: { ...DONNEES, va: 9 } }));
    for (const nom of ["Dernier relevé", "Suivi"]) {
      const derniere = lignes(f, nom).length;
      expect(lignes(f, nom)[derniere - 1][6]).toBe(9);
      expect(fonds(f, nom, derniere, [7])).toEqual([VERT]);
    }
  });
});

describe("une ligne par joueur et par jour", () => {
  test("même joueur, même jour (autre appareil) : sa ligne du jour est remplacée, pseudo comparé sans la casse", () => {
    const f = fichier();
    f.doPost(releve());
    expect(f.doPost(releve({ joueur: "doggybag", donnees: { ...DONNEES, tdp: 39 } }))).toEqual({
      ok: true,
      nouveau: false,
      dernier: true,
    });
    expect(lignes(f, "Suivi")).toHaveLength(2);
    expect(lignes(f, "Suivi")[1].slice(1, 3)).toEqual(["doggybag", 39]);
    expect(lignes(f, "Dernier relevé")).toHaveLength(2);
  });

  test("jours et joueurs différents : « Suivi » s'allonge, « Dernier relevé » garde une ligne par joueur", () => {
    const f = fichier();
    f.doPost(releve({ jour: jour(-1) }));
    f.doPost(releve({ joueur: "Lassie", donnees: { ...DONNEES, tdp: 20 } }));
    f.doPost(releve({ donnees: { ...DONNEES, tdp: 39 } }));
    expect(lignes(f, "Suivi").map((l: unknown[]) => l.slice(0, 3))).toEqual([
      ["Date", "Joueur", "TdP"],
      [jour(-1), "DoggyBag", 38],
      [jour(), "Lassie", 20],
      [jour(), "DoggyBag", 39],
    ]);
    expect(lignes(f, "Dernier relevé").map((l: unknown[]) => l.slice(0, 3))).toEqual([
      ["Joueur", "Date", "TdP"],
      ["DoggyBag", jour(), 39],
      ["Lassie", jour(), 20],
    ]);
  });

  test("relevé plus ancien que celui de « Dernier relevé » : ajouté au suivi, sans remplacer le plus récent", () => {
    const f = fichier();
    f.doPost(releve({ donnees: { ...DONNEES, tdp: 39 } }));
    expect(f.doPost(releve({ jour: jour(-1) }))).toEqual({
      ok: true,
      nouveau: true,
      dernier: false,
    });
    expect(lignes(f, "Dernier relevé")[1].slice(1, 3)).toEqual([jour(), 39]);
    expect(lignes(f, "Suivi")).toHaveLength(3);
  });

  test("suivi plus long que l'onglet : des lignes sont ajoutées", () => {
    const f = fichier({ Suivi: feuille("Suivi", [["Date", "Joueur"]], 2) });
    f.doPost(releve({ jour: jour(-1) }));
    f.doPost(releve());
    expect(lignes(f, "Suivi")).toHaveLength(3);
    expect(f.onglets["Suivi"].getMaxRows()).toBe(3);
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
    const [titres, lassie, moi] = lignes(f, "Dernier relevé");
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
    expect(fonds(f, "Dernier relevé", 3, [1, 2, 3, 4, 5, 6])).toEqual([
      "#ffff00",
      undefined,
      VERT,
      "#00ffff",
      undefined,
      VERT,
    ]);
    expect(lignes(f, "Dernier relevé")).toHaveLength(3);
  });

  test("pseudo qui commencerait une formule : écrit comme du texte, retrouvé ensuite", () => {
    const f = fichier();
    f.doPost(releve({ joueur: "-Alpha-" }));
    f.doPost(releve({ joueur: "-Alpha-", donnees: { ...DONNEES, tdp: 40 } }));
    expect(lignes(f, "Dernier relevé").map((l: unknown[]) => l.slice(0, 3))).toEqual([
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
