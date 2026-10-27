import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

const page = creerPage(["js/class/Utils.js", "js/class/AttaqueLancee.js"]);
const partage = (capture: string) =>
  page.lire<string>(
    `JSON.stringify(AttaqueLancee.pourPartage({
      capture: ${capture},
      ligne: { id: 42, cible: "Callisto", lieuNatif: "Terrain de Chasse", arrivee: moment(1761595020000), troupesNatif: "30 000 Jeunes Soldates Naines" },
    }))`,
  );

describe("partage d'un flood", () => {
  test("attaque non capturée (lancée ailleurs) : données affichées par le jeu", () => {
    expect(JSON.parse(partage("null"))).toEqual({
      id: 42,
      cible: "Callisto",
      lieu: "Terrain de Chasse",
      arrivee: 1761595020000,
      unite: { total: 30000 },
    });
  });
  test("attaque capturée : la capture prime, l'arrivée du jeu à défaut", () => {
    const r = JSON.parse(
      partage(
        `{ id: 42, cible: "Callisto", lieu: "Terrain de Chasse", arrivee: null, unite: { 0: 1000 }, terrainDepart: 50000, terrainCible: 45000 }`,
      ),
    );
    expect(r.unite).toEqual({ 0: 1000 });
    expect(r.terrainDepart).toBe(50000);
    expect(r.arrivee).toBe(1761595020000);
  });
});
