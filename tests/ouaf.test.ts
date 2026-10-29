import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

const page = creerPage(["js/class/Utils.js", "js/class/OuafSuivi.js"]);

const JOUR = 86400000;
const maintenant = Date.parse("2026-10-26T18:00:00Z");

/** Historique du site, au format de /api/historique. */
const historique = [
  // avance hors convoi prévu, notée à la main
  {
    quand: "2026-10-26T14:34:11+00:00",
    action: "avance",
    de: "Moi",
    vers: "Alpha",
    montant: 280000,
    detail: "",
    sens: "envoye",
  },
  // convoi transmis par Fzzz : part du convoi prévu + surplus en avance (avance remplacée)
  {
    quand: "2026-10-26T15:00:00+00:00",
    action: "convoi",
    de: "Moi",
    vers: "Beta",
    montant: 1500,
    detail: "Envoyé : 500 → 1500",
    sens: "envoye",
  },
  {
    quand: "2026-10-26T15:00:04+00:00",
    action: "avance_annule",
    de: "Moi",
    vers: "Beta",
    montant: 100,
    detail: "Remplacée par 600",
    sens: "envoye",
  },
  {
    quand: "2026-10-26T15:00:04+00:00",
    action: "avance",
    de: "Moi",
    vers: "Beta",
    montant: 600,
    detail: "",
    sens: "envoye",
  },
  // avance corrigée à la baisse : pas un envoi
  {
    quand: "2026-10-25T09:00:00+00:00",
    action: "avance_annule",
    de: "Moi",
    vers: "Alpha",
    montant: 200000,
    detail: "Remplacée par 150000",
    sens: "envoye",
  },
  {
    quand: "2026-10-25T09:00:00+00:00",
    action: "avance",
    de: "Moi",
    vers: "Alpha",
    montant: 150000,
    detail: "",
    sens: "envoye",
  },
  // réception : ignorée
  {
    quand: "2026-10-26T16:00:00+00:00",
    action: "convoi",
    de: "Gamma",
    vers: "Moi",
    montant: 1020,
    detail: "Envoyé : 0 → 1020",
    sens: "recu",
  },
];

function apparier(convois: object[], hist: object[] = historique) {
  return page.lire<string[]>(`[...OuafSuivi.apparier(${JSON.stringify(convois)},
    OuafSuivi.transmissions(${JSON.stringify(hist)}, "Moi"))]`);
}

describe("OuafSuivi.transmissions", () => {
  test("net par destinataire et par moment, annulations déduites", () => {
    const g = page.lire<any[]>(`OuafSuivi.transmissions(${JSON.stringify(historique)}, "moi")`);
    // Alpha : 280 000 (le 26) ; 150 000 − 200 000 = −50 000 le 25, écarté ; Beta : 1 000 + 600 − 100
    expect(g.map((x) => [x.vers, x.net])).toEqual([
      ["alpha", 280000],
      ["beta", 1500],
    ]);
  });
});

describe("OuafSuivi.apparier", () => {
  test("convoi retrouvé dans l'historique (autre appareil)", () => {
    page.lire(`localStorage.clear()`);
    const t = apparier([
      { cle: "id1", vers: "Alpha", montant: 280000, arrivee: maintenant + 5 * 3600000 },
      { cle: "id2", vers: "Beta", montant: 1500, arrivee: maintenant + 3600000 },
      { cle: "id3", vers: "Alpha", montant: 280000, arrivee: maintenant + 6 * 3600000 },
    ]);
    // un seul envoi de 280 000 vers Alpha dans l'historique : un seul convoi apparié
    expect(t.sort()).toEqual(["id1", "id2"]);
  });

  test("envoi trop ancien pour ce convoi : non apparié", () => {
    const t = apparier([
      { cle: "id9", vers: "Alpha", montant: 280000, arrivee: maintenant + 9 * JOUR },
    ]);
    expect(t).toEqual([]);
  });

  test("même montant vers le même joueur, noté avant le départ de ce convoi : non apparié", () => {
    page.lire(`localStorage.clear()`);
    // l'historique contient 280 000 vers Alpha noté le 26 à 10h ; ce convoi est parti après
    const arrivee = Date.parse("2026-10-27T12:00:00Z");
    expect(
      apparier([
        {
          cle: "id5",
          vers: "Alpha",
          montant: 280000,
          arrivee,
          depart: Date.parse("2026-10-27T08:00:00Z"),
        },
      ]),
    ).toEqual([]);
  });

  test("envoi noté peu avant le départ estimé (trajet réel plus long, heure décalée) : apparié", () => {
    page.lire(`localStorage.clear()`);
    // 280 000 vers Alpha noté le 26 à 14h34 ; départ estimé à 16h00 (trajet calculé de 9 h)
    const depart = Date.parse("2026-10-26T16:00:00Z");
    expect(
      apparier([
        { cle: "id6", vers: "Alpha", montant: 280000, arrivee: depart + 9 * 3600000, depart },
      ]),
    ).toEqual(["id6"]);
  });

  test("marquage local", () => {
    page.lire(`OuafSuivi.marquerTransmis("id7")`);
    expect(apparier([{ cle: "id7", vers: "Zeta", montant: 5, arrivee: maintenant }], [])).toEqual([
      "id7",
    ]);
  });
});

describe("OuafSuivi.repartir", () => {
  const lignes = [{ vers: "Beta", demande: 10000, envoye: 4000 }];
  test("convoi prévu, sans dépassement : tout sur le convoi", () => {
    expect(
      page.lire(`JSON.stringify(OuafSuivi.repartir(5000, ${JSON.stringify(lignes)}, "beta"))`),
    ).toBe(JSON.stringify({ ligne: lignes[0], convoi: 5000, avance: 0 }));
  });
  test("dépassement : ce qui manque sur le convoi, le reste en avance", () => {
    const r = JSON.parse(
      page.lire(`JSON.stringify(OuafSuivi.repartir(8000, ${JSON.stringify(lignes)}, "Beta"))`),
    );
    expect([r.convoi, r.avance]).toEqual([6000, 2000]);
  });
  test("convoi non prévu : tout en avance", () => {
    const r = JSON.parse(
      page.lire(`JSON.stringify(OuafSuivi.repartir(3000, ${JSON.stringify(lignes)}, "Alpha"))`),
    );
    expect([r.ligne, r.convoi, r.avance]).toEqual([null, 0, 3000]);
  });
});

describe("reste à livrer par joueur", () => {
  test("demandé − envoyé, cumulé, jamais négatif, sans tenir compte de la casse", () => {
    const lignes = [
      { de: "DoggyBag", vers: "Beta", demande: 10000, envoye: 4000 },
      { de: "DoggyBag", vers: "beta", demande: 5000, envoye: 0 },
      { de: "DoggyBag", vers: "Gamma", demande: 1000, envoye: 3000 },
    ];
    expect(page.lire(`JSON.stringify([...OuafSuivi.restants(${JSON.stringify(lignes)})])`)).toBe(
      JSON.stringify([
        ["beta", 11000],
        ["gamma", 0],
      ]),
    );
    expect(page.lire("OuafSuivi.restants(undefined).size")).toBe(0);
  });
});

describe("avance notée sur le site", () => {
  test("une ligne de plus, l'avance précédente vers le même joueur reste telle quelle", () => {
    expect(
      page.lire(
        `OuafSuivi.ajouterAvance([{ de: "DoggyBag", vers: "Kwhwwymwn", montant: "224164", id: 7 }], "DoggyBag", "Kwhwwymwn", 127239)`,
      ),
    ).toEqual([
      { de: "DoggyBag", vers: "Kwhwwymwn", montant: 224164 },
      { de: "DoggyBag", vers: "Kwhwwymwn", montant: 127239 },
    ]);
  });
  test("aucune avance encore : la seule ligne envoyée", () => {
    expect(page.lire(`OuafSuivi.ajouterAvance(undefined, "A", "B", 10)`)).toEqual([
      { de: "A", vers: "B", montant: 10 },
    ]);
  });
});

describe("numéro d'un convoi dont le lien Annuler a disparu", () => {
  const arrivee = Date.now() + 3 * 3600000;
  const numeroter = (convois: object[]) =>
    page.lire<{ id: number | null }[]>(
      `(() => { let c = ${JSON.stringify(convois)}; OuafSuivi.numeroter(c); return c; })()`,
    );

  test("numéro rendu au même convoi, pas à un autre montant ni à un autre joueur", () => {
    page.lire(`localStorage.clear()`);
    numeroter([{ id: 777, vers: "Alpha", montant: 280000, arrivee }]);
    expect(
      numeroter([
        { id: null, vers: "beta", montant: 280000, arrivee },
        { id: null, vers: "alpha", montant: 280001, arrivee },
        { id: null, vers: "alpha", montant: 280000, arrivee: arrivee + 1000 },
      ]).map((c) => c.id),
    ).toEqual([null, null, 777]);
  });

  test("deux convois identiques : le numéro ne sert qu'une fois", () => {
    page.lire(`localStorage.clear()`);
    numeroter([{ id: 5, vers: "Alpha", montant: 100, arrivee }]);
    expect(
      numeroter([
        { id: null, vers: "Alpha", montant: 100, arrivee },
        { id: null, vers: "Alpha", montant: 100, arrivee },
      ]).map((c) => c.id),
    ).toEqual([5, null]);
  });

  test("arrivée trop différente ou convoi déjà arrivé : pas de numéro", () => {
    page.lire(`localStorage.clear()`);
    numeroter([
      { id: 6, vers: "Alpha", montant: 100, arrivee },
      { id: 7, vers: "Gamma", montant: 100, arrivee: Date.now() - 60000 },
    ]);
    expect(
      numeroter([
        { id: null, vers: "Alpha", montant: 100, arrivee: arrivee + 5 * 60000 },
        { id: null, vers: "Gamma", montant: 100, arrivee: Date.now() - 60000 },
      ]).map((c) => c.id),
    ).toEqual([null, null]);
  });
});
