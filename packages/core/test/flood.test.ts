import { describe, expect, it } from "vitest";
import { estAPortee, planifierFlood, prise, priseLimitePortee, simulerSequence } from "../src/flood.js";

/** Meilleur total pris, par recherche exhaustive sur toutes les tailles d'attaque. */
function meilleurTotal(att: number, cible: number, unites: number, attaques: number): number {
  if (attaques === 0 || unites === 0 || !estAPortee(att, cible)) return 0;
  let best = 0;
  for (let u = 1; u <= unites; u++) {
    const p = prise(cible, u);
    if (p < u) break; // envoyer plus d'unités que la prise ne sert à rien
    best = Math.max(best, p + meilleurTotal(att + p, cible - p, unites - u, attaques - 1));
  }
  return best;
}

const somme = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("portée et prise", () => {
  it("borne la portée entre la moitié et le triple", () => {
    expect(estAPortee(1000, 500)).toBe(true);
    expect(estAPortee(1000, 499)).toBe(false);
    expect(estAPortee(1000, 2999)).toBe(true);
    expect(estAPortee(1000, 3000)).toBe(false);
    // Bornes affichées par la page Ennemies pour 19 095 cm² : 9 548 à 57 284
    expect(estAPortee(19095, 9548)).toBe(true);
    expect(estAPortee(19095, 9547)).toBe(false);
    expect(estAPortee(19095, 57284)).toBe(true);
    expect(estAPortee(19095, 57285)).toBe(false);
  });

  it("prend 20 % du TDC cible, limité par les unités", () => {
    expect(prise(1000, 5000)).toBe(200);
    expect(prise(1000, 150)).toBe(150);
  });

  it("la prise limite laisse la cible exactement à portée", () => {
    const att = 1000;
    const cible = 700;
    const l = priseLimitePortee(att, cible);
    expect(estAPortee(att + l, cible - l)).toBe(true);
    expect(estAPortee(att + l + 1, cible - l - 1)).toBe(false);
  });
});

describe("simulerSequence", () => {
  it("annule une attaque arrivée hors de portée", () => {
    const r = simulerSequence(1000, { A: 1000 }, [
      { attaquant: "A", unites: 200 },
      { attaquant: "A", unites: 160 },
      { attaquant: "A", unites: 128 },
    ]);
    // 1000→800 (A 1200), 800→640 (A 1360), 640 < 1360/2 : annulée
    expect(r.map((x) => x.prise)).toEqual([200, 160, 0]);
    expect(r[2]?.aPortee).toBe(false);
  });

  it("gère plusieurs attaquants sur la même cible", () => {
    const r = simulerSequence(1000, { A: 1000, B: 600 }, [
      { attaquant: "A", unites: 200 },
      { attaquant: "B", unites: 200 },
    ]);
    // B prend 20 % de 800, pas de 1000
    expect(r.map((x) => x.prise)).toEqual([200, 160]);
    expect(r[1]?.tdcAttaquantApres).toBe(760);
  });
});

describe("planifierFlood", () => {
  it("respecte la portée à chaque arrivée", () => {
    const plan = planifierFlood({ tdcAttaquant: 1000, tdcCible: 1000, unites: 10_000, attaquesMax: 10 });
    const r = simulerSequence(
      1000,
      { A: 1000 },
      plan.map((u) => ({ attaquant: "A", unites: u })),
    );
    expect(r.every((x) => x.aPortee && x.prise === x.unites)).toBe(true);
  });

  it("est optimal sur une grille de petits cas", () => {
    for (const att of [20, 35, 50, 80]) {
      for (const cible of [15, 30, 50, 90, 140]) {
        if (!estAPortee(att, cible)) continue;
        for (const unites of [5, 20, 60]) {
          for (const attaques of [1, 2, 3, 4]) {
            const plan = planifierFlood({ tdcAttaquant: att, tdcCible: cible, unites, attaquesMax: attaques });
            expect(somme(plan), JSON.stringify({ att, cible, unites, attaques, plan })).toBe(
              meilleurTotal(att, cible, unites, attaques),
            );
          }
        }
      }
    }
  });
});
