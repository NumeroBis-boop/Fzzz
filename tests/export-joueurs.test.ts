import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

const page = creerPage(["js/class/ExportJoueurs.js"]);

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
});
