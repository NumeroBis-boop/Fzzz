import { describe, expect, it } from "vitest";
import {
  coutNiveauPuceron,
  gainJournalierPuceron,
  rentabiliteArmes,
  rentabiliteBouclier,
} from "../src/rentabilite.js";
import { arrivee, concordeAvecMinuteAffichee, formaterDuree, formaterHeure } from "../src/arrivee.js";

describe("rentabilité", () => {
  const ctx = { effectifs: { jsn: 10_000 }, niveauArmes: 9, niveauBouclier: 8, niveauxPonte: 0 };

  it("compare le niveau de Bouclier à la ponte d'unités pendant le temps des ouvrières", () => {
    const r = rentabiliteBouclier(ctx);
    // Bouclier 9 : 80 × 2^8 = 20 480 ouvrières × 60 s = 1 228 800 s
    expect(r.cout.ouvrieres).toBe(20_480);
    expect(r.tempsPonteOuvrieres).toBe(1_228_800);
    expect(r.gainNiveau).toBe(8_000); // 10 % de 80 000 PV de base
    // Meilleure alternative en vie : JSN, 4 096 × 8 × 1,8 = 58 982 PV
    expect(r.alternatives[0]).toMatchObject({ unite: "jsn", nombre: 4096 });
    expect(r.rentable).toBe(false);
  });

  it("devient rentable avec une grosse armée", () => {
    const r = rentabiliteArmes({ ...ctx, effectifs: { jsn: 1_000_000 } });
    expect(r.attaque.rentable).toBe(true);
  });

  it("ajoute les niveaux de Communication requis pour l'étable", () => {
    // Étable 0 → 1 : Communication 3 requise
    const c = coutNiveauPuceron(0, 1, 0);
    expect(c.niveauxCommunication).toEqual([2, 3]);
    expect(c.cout.ouvrieres).toBe(160 + 320);
    expect(c.cout.materiaux).toBe(1500 + 1000 + 2000);
    // Déjà au niveau requis : rien à rechercher
    expect(coutNiveauPuceron(4, 7, 0).niveauxCommunication).toEqual([]);
  });

  it("estime le gain journalier d'un niveau d'étable", () => {
    // Étable 10 → 11 : capacité commerce × 1,55 / 1,5
    expect(gainJournalierPuceron(10, { convois: 1_500_000 })).toBeCloseTo(50_000);
    expect(gainJournalierPuceron(0, { pillage: 100_000 })).toBeCloseTo(1_000);
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

  it("formate les durées", () => {
    expect(formaterDuree(70436)).toBe("19:33:56");
    expect(formaterDuree(90061)).toBe("1j 01:01:01");
  });
});
