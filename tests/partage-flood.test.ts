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

describe("attaque non capturée : reconstituée", () => {
  const p = creerPage(
    ["js/class/Utils.js", "js/class/AttaqueLancee.js"],
    `var NOM_UNITE = ["Ouvrière", "Jeune Soldate Naine", "Soldate Naine", "Naine d’Elite", "Jeune Soldate", "Soldate"];
     var Horloge = { serveur: () => moment() };
     var monProfil = { getTempsParcours2: () => 3600 };
     var TroupesDehors = { ajouterAttaque() {} };
     var Armee = class { constructor() { this.unite = []; } };
     var LECTURES = 0;
     var Joueur = class {
       constructor(p) { this.pseudo = p.pseudo; }
       getProfil() { LECTURES++; return Promise.resolve(""); }
       chargerProfil() { this.terrain = 100000; return true; }
     };`,
  );
  test("troupes lues dans le texte du jeu", () => {
    expect(
      p.lire(
        `AttaqueLancee.uniteNatif("30 000 Jeunes Soldates Naines, 2 000 Soldates et 5 Soldate Naine")`,
      ),
    ).toEqual({ "Jeune Soldate Naine": 30000, Soldate: 2000, "Soldate Naine": 5 });
  });
  test("TdC de la cible lu sur son profil, prises enchaînées, un profil par cible", async () => {
    p.lire(`localStorage.clear();
      var arrivee = moment().add(2, "h");
      var ATT = [1, 2].map((k) => ({ capture: null, ligne: { id: k, cible: "Callisto", lieuNatif: "Terrain de Chasse",
        arrivee: arrivee.clone().add(k, "m"), troupesNatif: "30 000 Jeunes Soldates Naines" } }));
      AttaqueLancee.reconstituer(ATT);`);
    await new Promise((r) => setTimeout(r, 20));
    // 100 000 → −20 000 (20 %) → 80 000 → −16 000 → 64 000
    expect(p.lire(`ATT.map((a) => [a.capture.terrainDepart, a.capture.terrainCible])`)).toEqual([
      [100000, 80000],
      [80000, 64000],
    ]);
    expect(p.lire("LECTURES")).toBe(1);
    expect(p.lire(`AttaqueLancee.charger().length`)).toBe(2);
  });
});
