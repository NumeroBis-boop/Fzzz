import { describe, expect, it } from "vitest";
import {
  coutOuvrieresEtable,
  meilleureUnite,
  passageEtable,
  planEtable,
  rentabilite,
  seuilRentabilite,
} from "../src/rentabilite.js";
import { arrivee, concordeAvecMinuteAffichee, formaterDuree, formaterHeure, formaterMinuteRC } from "../src/arrivee.js";

describe("rentabilité Armes / Bouclier (règle du joueur)", () => {
  it("reproduit l'exemple : Armes 5 avec des JS → 14 530 HB", () => {
    // 1 280 × 60 / 740 × 10 × 14 = 14 529,7 → 14 530
    expect(seuilRentabilite("att", 5, "js")).toBe(14530);
  });

  it("décide sur H ≥ Sₙ et donne les HB manquants", () => {
    const r = rentabilite({ js: 1453 }, "att", 4, "js");
    expect(r).toMatchObject({ niveauVise: 5, total: 14530, seuil: 14530, manquant: 0, rentable: true });
    expect(rentabilite({ js: 1452 }, "att", 4, "js")).toMatchObject({ manquant: 10, rentable: false });
  });

  it("applique la même formule à la défense (Armes) et à la vie (Bouclier)", () => {
    // Bouclier 9 en JSN : 20 480 × 60 / 300 × 8 × 18
    expect(seuilRentabilite("vie", 9, "jsn")).toBe(589824);
    expect(seuilRentabilite("def", 10, "tue")).toBe(Math.ceil((40960 * 60 * 55 * 19) / 2740));
  });

  it("choisit par défaut l'unité pondable au meilleur rendement", () => {
    expect(meilleureUnite("att")).toBe("tk");
    expect(meilleureUnite("vie")).toBe("jsn");
    expect(meilleureUnite("def")).toBe("tue");
  });
});

describe("rentabilité Étable à pucerons (règle du joueur)", () => {
  it("retrouve les coûts du modèle : 560 pour l'étable 1, puis 320 × 2^(n−1)", () => {
    expect(coutOuvrieresEtable(1)).toBe(560);
    expect(coutOuvrieresEtable(2)).toBe(640);
    expect(coutOuvrieresEtable(3)).toBe(1280);
    // Communication déjà au niveau 2 : seul le niveau 3 manque pour l'étable 1
    expect(coutOuvrieresEtable(1, 2)).toBe(320);
  });

  it("reproduit l'exemple : étable 1 → 2 rentable dès 14 081 ouvrières", () => {
    expect(passageEtable(14081, 1)).toMatchObject({ ouvrieresSacrifiees: 640, minimum: 14081, rentable: true });
    // À égalité (ΔK = 0), le passage n'est pas rentable
    expect(passageEtable(14080, 1).rentable).toBe(false);
  });

  it("enchaîne les passages en déduisant chaque sacrifice", () => {
    const plan = planEtable(48936, 0, 2);
    expect(plan.map((p) => [p.niveauVise, p.ouvrieresSacrifiees, p.rentable])).toEqual([
      [1, 320, true],
      [2, 640, true],
      [3, 1280, true],
      [4, 2560, false],
    ]);
    expect(plan[1]?.ouvrieresAvant).toBe(48936 - 320);
  });
});

describe("arrivées", () => {
  it("additionne le reste à l'instant de génération et formate en heure de Paris", () => {
    const generation = Date.UTC(2026, 9, 20, 22, 23, 10); // 00:23:10 à Paris (UTC+2, avant le changement d’heure)
    const a = arrivee(generation, 70427);
    expect(formaterHeure(a)).toBe("19:56:57");
    expect(concordeAvecMinuteAffichee(a, "19h56")).toBe(true);
    expect(concordeAvecMinuteAffichee(a, "19h57")).toBe(false);
  });

  it("date le RC à la minute qui suit l'impact, sauf impact pile", () => {
    const base = Date.UTC(2026, 9, 20, 15, 23, 0); // 17:23:00 à Paris
    expect(formaterMinuteRC(base + 12_000)).toBe("17h24");
    expect(formaterMinuteRC(base)).toBe("17h23");
  });

  it("formate les durées", () => {
    expect(formaterDuree(70436)).toBe("19:33:56");
    expect(formaterDuree(90061)).toBe("1j 01:01:01");
  });
});
