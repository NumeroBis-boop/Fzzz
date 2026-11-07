import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

const page = creerPage(["js/class/Utils.js", "js/class/OuafSuivi.js", "js/class/Horloge.js"]);

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
