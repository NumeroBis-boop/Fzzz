import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

const page = creerPage(["js/class/Utils.js", "js/class/ExportJoueurs.js"]);

const HEURE = 3600000;
// export simulé : renvoie [adresses demandées, résultat]
const avecExport = (code: string, joueurs = "[{ id: 1, pseudo: 'B', x: 5, y: 6, field: 7 }]") =>
  page.lire<Promise<[string[], any]>>(`(() => {
    let appels = [];
    $.ajax = (o) => {
      appels.push(o.url);
      return $.Deferred().resolve(o.url.endsWith("/api/exports/")
        ? { players: ["202611051500"], alliances: [] }
        : ${joueurs}).promise();
    };
    return (${code}).then((r) => [appels, r]);
  })()`);
const garderBase = (age: number, joueurs: object) =>
  page.lire(
    `localStorage.setItem("fzzz_joueurs_S5", ${JSON.stringify(
      JSON.stringify({ t: Date.now() - age, joueurs }),
    )})`,
  );

describe("export public des joueurs", () => {
  test("indexé par pseudo, entrées incomplètes ignorées", () => {
    const index = page.lire<Record<string, unknown>>(`Object.fromEntries(ExportJoueurs.indexer([
      { id: 12, pseudo: "SerPounce", alliance: "OUAF", x: 10, y: 22, field: 81975 },
      { id: 13, pseudo: "Sans coordonnées", alliance: null, field: 5 },
      null,
    ]))`);
    expect(index).toEqual({
      SerPounce: { id: 12, pseudo: "SerPounce", x: 10, y: 22, terrain: 81975, alliance: "OUAF" },
    });
  });
  test("dernière version demandée, puis ses joueurs", async () => {
    page.lire("localStorage.clear()");
    const r = await page.lire<Promise<[string[], number]>>(`(() => {
      let appels = [];
      $.ajax = (o) => {
        appels.push(o.url);
        return $.Deferred().resolve(o.url.endsWith("/api/exports/")
          ? { players: ["202611051500", "202611051400"], alliances: [] }
          : [{ id: 1, pseudo: "A", x: 1, y: 2, field: 3, alliance: null }]).promise();
      };
      return ExportJoueurs.lire().then((index) => [appels, index.size]);
    })()`);
    expect(r[0]).toEqual([
      "https://s5.fourmizzz.fr/api/exports/",
      "https://s5.fourmizzz.fr/api/exports/players/?version=202611051500",
    ]);
    expect(r[1]).toBe(1);
  });

  test("base de moins d'une heure : aucune requête", async () => {
    garderBase(HEURE / 2, { A: [1, 2, 3] });
    const [appels, base] = await avecExport("ExportJoueurs.base()");
    expect(appels).toEqual([]);
    expect(base).toEqual({ A: [1, 2, 3] });
  });

  test("base de plus d'une heure : export relu et base renouvelée", async () => {
    garderBase(2 * HEURE, { A: [1, 2, 3] });
    const [appels, base] = await avecExport("ExportJoueurs.base()");
    expect(appels.length).toBe(2);
    expect(base).toEqual({ B: [5, 6, 7] });
    const gardee = page.lire<any>(`JSON.parse(localStorage.getItem("fzzz_joueurs_S5"))`);
    expect(gardee.joueurs).toEqual({ B: [5, 6, 7] });
    expect(Date.now() - gardee.t).toBeLessThan(HEURE);
  });

  test("export indisponible ou vide : l'ancienne base sert, sans être écrasée", async () => {
    garderBase(30 * HEURE, { A: [1, 2, 3] });
    const [, vide] = await avecExport("ExportJoueurs.base()", "[]");
    expect(vide).toEqual({ A: [1, 2, 3] });
    const enPanne = await page.lire<Promise<object>>(`(() => {
      $.ajax = () => $.Deferred().reject({ status: 503 }).promise();
      return ExportJoueurs.base();
    })()`);
    expect(enPanne).toEqual({ A: [1, 2, 3] });
    expect(page.lire(`JSON.parse(localStorage.getItem("fzzz_joueurs_S5")).joueurs`)).toEqual({
      A: [1, 2, 3],
    });
  });

  test("completer : base (casse ignorée), sinon page du joueur", async () => {
    garderBase(0, { SerPounce: [10, 22, 81975] });
    const [appels, r] = await avecExport(`(() => {
      let lus = [],
        joueur = (pseudo, page) => ({
          pseudo,
          getProfil: () => (lus.push(pseudo), Promise.resolve(page)),
          chargerProfil(html) {
            if (html.includes("Aucun joueurs avec le pseudo")) return false;
            [this.x, this.y, this.terrain] = [3, 4, 500];
            return true;
          },
        }),
        joueurs = [
          joueur("serpounce"),
          joueur("Nouveau", "<div class='boite_membre'></div>"),
          joueur("Fantome", "Aucun joueurs avec le pseudo"),
        ];
      return ExportJoueurs.completer(joueurs).then((introuvables) => ({
        introuvables: introuvables.map((j) => j.pseudo),
        lus,
        positions: joueurs.map((j) => [j.x, j.y, j.terrain]),
      }));
    })()`);
    expect(appels).toEqual([]);
    expect(r.introuvables).toEqual(["Fantome"]);
    expect(r.lus).toEqual(["Nouveau", "Fantome"]);
    expect(r.positions.slice(0, 2)).toEqual([
      [10, 22, 81975],
      [3, 4, 500],
    ]);
  });
});
