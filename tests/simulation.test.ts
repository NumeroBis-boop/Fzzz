import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

// heure serveur figée : les événements antérieurs sont écartés
const page = creerPage(
  ["js/class/Utils.js", "js/page/PartageChasses.js"],
  `var Horloge = { serveur: () => moment("2026-10-26 12:00", "YYYY-MM-DD HH:mm") };`,
);

/** Simule `d` avec les TdC `connus` et renvoie les événements. */
function simuler(d: object, connus: object = {}) {
  return page.lire(
    `JSON.parse(JSON.stringify(PartageChasses.simuler(${JSON.stringify(d)}, ${JSON.stringify(connus)})))`,
  );
}

const flood = (o: object) => ({ date: "2026-10-26 13:00", terrain: 0, unites: null, id: 1, ...o });

describe("PartageChasses.simuler : règle des 20 % et portée", () => {
  test("prise plafonnée à 20 % du TdC de la cible", () => {
    const sim = simuler(
      { chasses: {}, floods: [flood({ lanceur: "A", cible: "B", unites: 5000, terrain: 5000 })] },
      { A: 10000, B: 10000 },
    );
    const e = sim.evenements[0];
    expect(e.prise).toBe(2000);
    expect(e.statut).toBe("plafond");
    expect(e.tdcCibleApres).toBe(8000);
    expect(e.tdcLanceurApres).toBe(12000);
  });

  test("unités sous le plafond : prise = unités envoyées", () => {
    const e = simuler(
      { chasses: {}, floods: [flood({ lanceur: "A", cible: "B", unites: 1000, terrain: 1000 })] },
      { A: 10000, B: 10000 },
    ).evenements[0];
    expect(e.prise).toBe(1000);
    expect(e.statut).toBe("ok");
  });

  test("cible hors portée à l'impact (< 50 % + 1 du lanceur) : aucune prise", () => {
    const e = simuler(
      { chasses: {}, floods: [flood({ lanceur: "A", cible: "B", unites: 1000, terrain: 1000 })] },
      { A: 10000, B: 5000 },
    ).evenements[0];
    expect(e.prise).toBe(0);
    expect(e.statut).toBe("portee");
  });

  test("cible hors portée (> 300 % − 1 du lanceur) : aucune prise", () => {
    const e = simuler(
      { chasses: {}, floods: [flood({ lanceur: "A", cible: "B", unites: 1000, terrain: 1000 })] },
      { A: 10000, B: 30000 },
    ).evenements[0];
    expect(e.statut).toBe("portee");
  });

  test("TdC de la cible inconnu : prise estimée au lancement gardée", () => {
    const e = simuler(
      { chasses: {}, floods: [flood({ lanceur: "A", cible: "B", unites: 900, terrain: 777 })] },
      { A: 10000 },
    ).evenements[0];
    expect(e.prise).toBe(777);
    expect(e.statut).toBe("inconnu");
  });

  test("sans TdC connu, celui relevé au lancement le plus récent sert de base", () => {
    const sim = simuler({
      chasses: {},
      floods: [
        flood({ lanceur: "A", cible: "B", unites: 100, id: 1, tdcCible: 9000 }),
        flood({ lanceur: "A", cible: "B", unites: 100, id: 2, tdcCible: 10000 }),
      ],
    });
    expect(sim.depart.b).toBe(10000);
  });
});

describe("PartageChasses.simuler : ordre des événements", () => {
  test("à minute égale, la chasse passe avant le flood", () => {
    const sim = simuler(
      {
        chasses: { b: [{ date: "2026-10-26 13:00", terrain: 5000 }] },
        floods: [flood({ lanceur: "A", cible: "B", unites: 10000, terrain: 2000 })],
      },
      { A: 10000, B: 10000 },
    );
    expect(sim.evenements.map((e: any) => e.type)).toEqual(["chasse", "flood"]);
    // 20 % de 15 000 (TdC après la chasse)
    expect(sim.evenements[1].prise).toBe(3000);
  });

  test("floods de la même minute : dans l'ordre d'envoi, chacun sur le TdC laissé par le précédent", () => {
    const sim = simuler(
      {
        chasses: {},
        floods: [
          flood({ lanceur: "A", cible: "B", unites: 10000, id: 2 }),
          flood({ lanceur: "A", cible: "B", unites: 10000, id: 1 }),
        ],
      },
      { A: 10000, B: 10000 },
    );
    expect(sim.evenements.map((e: any) => e.id)).toEqual([1, 2]);
    expect(sim.evenements.map((e: any) => e.prise)).toEqual([2000, 1600]);
  });

  test("les événements passés sont écartés", () => {
    const sim = simuler(
      { chasses: {}, floods: [flood({ lanceur: "A", cible: "B", date: "2026-10-26 11:59" })] },
      { A: 10000, B: 10000 },
    );
    expect(sim.evenements.length).toBe(0);
  });
});

describe("PartageChasses.chronologie", () => {
  test("une ligne par flood, signée selon le côté du joueur", () => {
    const lignes = page.lire(`JSON.parse(JSON.stringify(PartageChasses.chronologie(
      PartageChasses.simuler({ chasses: {}, floods: [
        { date: "2026-10-26 13:00", lanceur: "A", cible: "B", unites: 1000, terrain: 1000, id: 1 },
      ] }, { A: 10000, B: 10000 }), "B")))`);
    expect(lignes).toHaveLength(1);
    expect(lignes[0].delta).toBe(-1000);
    expect(lignes[0].autre).toBe("A");
  });
});
