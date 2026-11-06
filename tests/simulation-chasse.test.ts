import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

// constantes du jeu (content.js) ; l'encart « Connexion » empêche le démarrage
const page = creerPage(
  [
    "js/class/Utils.js",
    "js/class/Parametre.js",
    "js/class/Joueur.js",
    "js/class/Armee.js",
    "js/class/Combat.js",
    "js/class/SimulationChasse.js",
    "js/content.js",
  ],
  `var chrome = { runtime: { getManifest: () => ({ version: "0" }), getURL: (p) => p } };
   document.body.innerHTML = "<div class='boite_connexion_titre'>Connexion</div>";`,
);

// ordre d'Armee.unite : JSN, SN, NE, JS, S, C, CE, A, AE, SE, Tk, TkE, Tu, TuE
const ARMEE = [20000, 3000, 1000, 500, 200, 100, 0, 50, 0, 0, 10, 0, 5, 0];
const BASE = {
  unites: ARMEE,
  armes: 2,
  bouclier: 1,
  vitesse: 3,
  tdcLancement: 15917,
  tdcArrivee: 15917,
  nombreMax: 5,
  tempsPonte: 300 * Math.pow(0.9, 10),
};

const appel = (methode: string, ...args: unknown[]) =>
  page.lire(
    `JSON.parse(JSON.stringify(SimulationChasse.${methode}(${args.map((a) => JSON.stringify(a)).join(",")})))`,
  );
const resoudre = (p: object) => appel("resoudre", { ...BASE, ...p });
const evaluer = (nombre: number, terrain: number, p: object = {}) =>
  appel("evaluer", { ...BASE, ...p }, nombre, terrain);
/** Plus grand terrain au ratio `ratio` pour `nombre` chasses, par la recherche historique. */
const terrainHistorique = (ratio: number, nombre: number) =>
  page.lire<number>(
    `SimulationChasse.calculerChasses(${ratio}, SimulationChasse.attaqueArmee(${JSON.stringify(ARMEE)}, ${BASE.armes}), ${BASE.nombreMax}, ${BASE.tdcArrivee}, ${Math.round(BASE.tdcLancement / 4)}, ${nombre}, 0).terrain`,
  );
const nombres = [1, 2, 3, 4, 5];
const argmax = <T>(liste: T[], cle: (x: T) => number) =>
  liste.reduce((m, x) => (cle(x) > cle(m) ? x : m));

describe("SimulationChasse : dichotomies", () => {
  test("plus grand terrain qui vérifie une borne", () => {
    expect(page.lire(`SimulationChasse.plusGrandTerrain((t) => t <= 1000)`)).toBe(1000);
    expect(page.lire(`SimulationChasse.plusGrandTerrain((t) => t <= 1000, 500)`)).toBe(500);
    expect(page.lire(`SimulationChasse.plusGrandTerrain((t) => t <= 700, 1000)`)).toBe(700);
    expect(page.lire(`SimulationChasse.plusGrandTerrain((t) => t <= 0)`)).toBe(0);
  });

  test("plus petit terrain qui atteint un seuil", () => {
    expect(page.lire(`SimulationChasse.plusPetitTerrain((t) => t >= 700, 1000)`)).toBe(700);
    expect(page.lire(`SimulationChasse.plusPetitTerrain((t) => t >= 1, 1000)`)).toBe(1);
    expect(page.lire(`SimulationChasse.plusPetitTerrain((t) => t >= 1001, 1000)`)).toBe(0);
  });
});

describe("SimulationChasse.resoudre : ce que le joueur fixe", () => {
  test("ratio et nombre fixés : le terrain de la recherche historique", () => {
    for (const [ratio, nombre] of [
      [9, 3],
      [7.5, 1],
      [10, 5],
    ] as [number, number][]) {
      const plan = resoudre({ ratio, nombre });
      expect(plan.nombre).toBe(nombre);
      expect(plan.terrain).toBe(terrainHistorique(ratio, nombre));
      expect(plan.ratio).toBeGreaterThanOrEqual(ratio);
      expect(plan.limite).toBe("ratio");
    }
  });

  test("terrain et ratio fixés : autant de chasses que la difficulté permet", () => {
    const terrain = 300;
    const plan = resoudre({ ratio: 9, terrain });
    const historique = page.lire<number>(
      `SimulationChasse.calculerChasses(9, SimulationChasse.attaqueArmee(${JSON.stringify(ARMEE)}, ${BASE.armes}), ${BASE.nombreMax}, ${BASE.tdcArrivee}, 0, 0, ${terrain}).nombre`,
    );
    expect(plan.terrain).toBe(terrain);
    expect(plan.nombre).toBe(historique);
    expect(plan.limite).toBe("terrain");
    expect(plan.ratio).toBeGreaterThanOrEqual(9);
    expect(evaluer(plan.nombre + 1, terrain).ratio).toBeLessThan(9.0001);
  });

  test("terrain fixé trop grand pour la difficulté : signalé", () => {
    expect(resoudre({ ratio: 9, terrain: 1000000 })).toEqual({ erreur: "ratio" });
  });

  test("ratio fixé seul : le nombre qui rend le plus par seconde", () => {
    const plan = resoudre({ ratio: 9 });
    const attendu = argmax(
      nombres.map((n) => evaluer(n, terrainHistorique(9, n))),
      (s) => s.rendement,
    );
    expect(plan.nombre).toBe(attendu.nombre);
    expect(plan.terrain).toBe(attendu.terrain);
    expect(plan.limite).toBe("ratio");
  });

  test("budget fixé : pertes au plus juste, ratio au moins au plancher", () => {
    const budget = 0.3;
    const plan = resoudre({ budget });
    expect(plan.limite).toBe("budget");
    expect(plan.plafonne).toBe(false);
    expect(plan.budget).toBeLessThanOrEqual(budget);
    expect(evaluer(plan.nombre, plan.terrain + 1).budget).toBeGreaterThan(budget);
    expect(plan.ratio).toBeGreaterThanOrEqual(7.2);
    // meilleur rendement parmi les nombres possibles
    for (const n of nombres) {
      const t = page.lire<number>(
        `SimulationChasse.plusGrandTerrain((t) => SimulationChasse.evaluer(${JSON.stringify(BASE)}, ${n}, t).budget <= ${budget})`,
      );
      expect(plan.rendement).toBeGreaterThanOrEqual(evaluer(n, t).rendement);
    }
  });

  test("budget trop large : plafonné au ratio plancher", () => {
    // cette armée perd 2 × son temps de ponte au ratio plancher : 5 × ne borne rien
    const plan = resoudre({ budget: 5 });
    expect(plan.plafonne).toBe(true);
    expect(plan.limite).toBe("plancher");
    expect(plan.ratio).toBeGreaterThanOrEqual(7.2);
    expect(evaluer(plan.nombre, plan.terrain + 1).ratio).toBeLessThan(7.2001);
  });

  test("ratio fixé sous le plancher : le plancher ne s'applique pas", () => {
    const plan = resoudre({ ratio: 6, budget: 5 });
    expect(plan.limite).toBe("ratio");
    expect(plan.plafonne).toBe(false);
    expect(plan.ratio).toBeLessThan(7.2);
  });

  test("nombre et terrain fixés : la salve est entièrement déterminée", () => {
    const plan = resoudre({ nombre: 2, terrain: 1234 });
    expect(plan.nombre).toBe(2);
    expect(plan.terrain).toBe(1234);
    expect(plan.limite).toBe("fixe");
    expect(plan.ratio).toBeCloseTo(evaluer(2, 1234).ratio, 10);
    expect(plan.chasses.length).toBe(2);
  });

  test("rendement fixé : la salve la moins coûteuse qui l'atteint", () => {
    const rendement = resoudre({ ratio: 9 }).rendement * 0.8;
    const plan = resoudre({ rendement });
    expect(plan.limite).toBe("rendement");
    expect(plan.infaisable).toBe(false);
    expect(plan.rendement).toBeGreaterThanOrEqual(rendement);
    expect(evaluer(plan.nombre, plan.terrain - 1).rendement).toBeLessThan(rendement);
    for (const n of nombres) {
      const t = page.lire<number>(
        `SimulationChasse.plusPetitTerrain((t) => SimulationChasse.evaluer(${JSON.stringify(BASE)}, ${n}, t).rendement >= ${rendement})`,
      );
      if (t && evaluer(n, t).ratio >= 7.2001)
        expect(plan.budget).toBeLessThanOrEqual(evaluer(n, t).budget + 1e-12);
    }
  });

  test("rendement hors d'atteinte dans les bornes : signalé", () => {
    const plan = resoudre({ rendement: resoudre({ ratio: 7.2 }).rendement * 2 });
    expect(plan.infaisable).toBe(true);
  });

  test("rien ne borne le coût : refusé", () => {
    expect(resoudre({})).toEqual({ erreur: "cout" });
    expect(resoudre({ nombre: 3 })).toEqual({ erreur: "cout" });
  });

  test("ratio impossible même sur 1 cm² : signalé", () => {
    expect(resoudre({ ratio: 9, tdcArrivee: 500000000 })).toEqual({ erreur: "ratio" });
  });

  test("sans armée ou sans place : rien", () => {
    expect(resoudre({ ratio: 9, nombreMax: 0 })).toBeNull();
    expect(resoudre({ ratio: 9, unites: new Array(14).fill(0) })).toBeNull();
  });
});

describe("SimulationChasse.plan : marge de JSN", () => {
  // 10 JSN et 50 Tueuses sur un petit TdC : les JSN ne couvrent pas 2 × pertes max
  const PEU = {
    unites: [10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 50, 0],
    tdcLancement: 1000,
    tdcArrivee: 1000,
  };

  test("stock insuffisant : marge réduite uniformément", () => {
    const plan = resoudre({ ...PEU, ratio: 9, nombre: 3 });
    expect(plan.facteur).toBeLessThan(2);
    expect(plan.facteur).toBeCloseTo(10 / plan.pertes.MAX, 10);
    // chaque chasse part avec sa part (la première prend le reste des arrondis)
    for (const c of plan.chasses)
      expect(Math.abs(c.unites[0] - c.pertes.MAX * plan.facteur)).toBeLessThanOrEqual(1);
    expect(plan.chasses.reduce((s: number, c: any) => s + c.unites[0], 0)).toBe(10);
  });
});

describe("SimulationChasse.reequilibrer", () => {
  const chasses = (jsn: number[], sn: number[], max: number[]) =>
    jsn.map((j, i) => ({
      unites: [j, sn[i], 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      pertes: { MAX: max[i] },
    }));

  test("assez de JSN : besoin couvert, surplus rendu au prorata, totaux inchangés", () => {
    const c = chasses([100, 300], [50, 10], [40, 10]);
    const residuel = appel("reequilibrer", c, 2);
    // la méthode modifie son argument : on la rejoue pour lire le résultat
    const apres = page.lire(
      `(() => { let c = ${JSON.stringify(c)}; SimulationChasse.reequilibrer(c, 2); return c.map((x) => x.unites.slice(0, 2)); })()`,
    );
    expect(apres).toEqual([
      [155, 50],
      [245, 10],
    ]);
    expect(residuel).toEqual([0, 0]);
  });

  test("JSN insuffisantes : les SN complètent, converties par leurs PV", () => {
    const c = chasses([30, 30], [50, 10], [40, 10]);
    const apres = page.lire(
      `(() => { let c = ${JSON.stringify(c)}; let r = SimulationChasse.reequilibrer(c, 2); return { u: c.map((x) => x.unites.slice(0, 2)), r }; })()`,
    );
    // JSN au prorata du besoin (80, 20) : 48 et 12 ; déficit 32 et 8 JSN,
    // soit 25,6 et 6,4 SN (PV 10 contre 8), surplus de SN rendu au prorata
    expect(apres.u).toEqual([
      [48, 49],
      [12, 11],
    ]);
    expect(apres.r).toEqual([0, 0]);
  });

  test("arrondis : jamais de négatif, totaux conservés (4 chasses, 2 SN)", () => {
    const c = chasses([0, 0, 0, 0], [1, 1, 0, 0], [1, 1, 1, 1]);
    const apres = page.lire(
      `(() => { let c = ${JSON.stringify(c)}; SimulationChasse.reequilibrer(c, 0.7); return c.map((x) => x.unites[1]); })()`,
    );
    expect(apres.every((n: number) => n >= 0)).toBe(true);
    expect(apres.reduce((s: number, n: number) => s + n, 0)).toBe(2);
  });

  test("tampon impossible même avec SN et NE : déficit renvoyé", () => {
    const c = chasses([8, 8], [0, 0], [40, 10]);
    const r = appel("reequilibrer", c, 2);
    // besoin 80 et 20, JSN 13 et 3 (16 au prorata, arrondi) : reste 67 et 17
    expect(r).toEqual([67, 17]);
  });
});

describe("SimulationChasse.duree", () => {
  test("(TdC + terrain) × 0,9^VC, arrondie au supérieur comme le jeu", () => {
    expect(appel("duree", 1000, 1, 1)).toBe(901); // 900,9
    expect(appel("duree", 1000, 0, 2)).toBe(810); // exact
    // 812,43 : 813 au supérieur, 812 au plus proche (l'arrondi de Calystène)
    expect(appel("duree", 1000, 3, 2)).toBe(813);
  });
});

describe("SimulationChasse.tempsPonte", () => {
  test("300 s × 0,9 par niveau de ponte", () => {
    expect(appel("tempsPonte", 0)).toBe(300);
    expect(appel("tempsPonte", 10)).toBeCloseTo(300 * Math.pow(0.9, 10), 9);
  });
});

describe("SimulationChasse.resoudre : invariants sur des salves tirées au hasard", () => {
  // générateur déterministe (LCG) : les cas sont les mêmes à chaque exécution
  let graine = 12345;
  const alea = () => (graine = (graine * 1103515245 + 12345) % 2147483648) / 2147483648;
  const entier = (min: number, max: number) => min + Math.floor(alea() * (max - min + 1));
  // armées à l'échelle du TdC : chasser quelques % du TdC au ratio 9 demande
  // une attaque de l'ordre de 5 à 20 fois le TdC
  const cas = () => {
    const unites = new Array(14).fill(0),
      tdc = entier(1000, 20000000);
    unites[0] = Math.round(tdc * (0.5 + 15 * alea()));
    unites[1] = Math.round(unites[0] * 0.1 * alea());
    unites[2] = Math.round(unites[0] * 0.03 * alea());
    for (const u of [3, 4, 5, 7, 10, 12])
      if (alea() < 0.5) unites[u] = Math.round((tdc * alea()) / ATT[u]!);
    return {
      unites,
      armes: entier(0, 12),
      bouclier: entier(0, 12),
      vitesse: entier(0, 10),
      tdcLancement: tdc,
      tdcArrivee: Math.round(tdc * (0.8 + 0.4 * alea())),
      nombreMax: entier(1, 7),
      tempsPonte: 300 * Math.pow(0.9, entier(0, 30)),
    };
  };
  const ATT = [3, 5, 7, 10, 15, 1, 1, 30, 35, 24, 55, 80, 50, 55];
  const somme = (plan: any, u: number) =>
    plan.chasses.reduce((s: number, c: any) => s + c.unites[u], 0);

  test("ratio fixé : respecté, nombre dans les places, armée jamais dépassée", () => {
    let plans = 0;
    for (let i = 0; i < 150; i++) {
      const base = cas(),
        ratio = [6, 7.5, 9, 10][entier(0, 3)]!,
        plan = appel("resoudre", { ...base, ratio });
      if (!plan || plan.erreur) {
        if (plan) expect(plan.erreur).toBe("ratio");
        continue;
      }
      plans++;
      expect(plan.ratio).toBeGreaterThanOrEqual(ratio);
      expect(plan.nombre).toBeGreaterThanOrEqual(1);
      expect(plan.nombre).toBeLessThanOrEqual(base.nombreMax);
      expect(plan.terrain).toBeGreaterThanOrEqual(1);
      expect(plan.chasses.length).toBe(plan.nombre);
      for (let u = 0; u < 14; u++) expect(somme(plan, u)).toBeLessThanOrEqual(base.unites[u]!);
      // au plus juste : 1 cm² de plus par chasse passerait sous le ratio
      expect(evaluer(plan.nombre, plan.terrain + 1, base).ratio).toBeLessThan(ratio + 0.0001);
    }
    expect(plans).toBeGreaterThan(100);
  });

  test("budget fixé : respecté sauf plafonné, ratio jamais sous le plancher", () => {
    let plans = 0,
      plafonnes = 0;
    for (let i = 0; i < 150; i++) {
      const base = cas(),
        budget = [0.05, 0.2, 0.5, 1][entier(0, 3)]!,
        plan = appel("resoudre", { ...base, budget });
      if (!plan || plan.erreur) {
        if (plan) expect(["budget", "plancher"]).toContain(plan.erreur);
        continue;
      }
      plans++;
      if (plan.plafonne) plafonnes++;
      expect(plan.ratio).toBeGreaterThanOrEqual(7.2);
      if (plan.plafonne) expect(plan.limite).toBe("plancher");
      else {
        expect(plan.budget).toBeLessThanOrEqual(budget);
        expect(evaluer(plan.nombre, plan.terrain + 1, base).budget).toBeGreaterThan(budget);
      }
      for (let u = 0; u < 14; u++) expect(somme(plan, u)).toBeLessThanOrEqual(base.unites[u]!);
      expect(plan.facteur).toBeLessThanOrEqual(2);
      expect(plan.facteur).toBeGreaterThanOrEqual(0);
    }
    // les deux issues sont représentées
    expect(plans).toBeGreaterThan(100);
    expect(plafonnes).toBeGreaterThan(5);
    expect(plans - plafonnes).toBeGreaterThan(5);
  });

  test("rééquilibrage : totaux par unité inchangés", () => {
    for (let i = 0; i < 50; i++) {
      const base = cas(),
        sans = appel("resoudre", { ...base, ratio: 9, reequilibrer: false }),
        avec = appel("resoudre", { ...base, ratio: 9, reequilibrer: true });
      if (!sans || sans.erreur) continue;
      for (let u = 0; u < 14; u++) expect(somme(avec, u)).toBe(somme(sans, u));
    }
  });
});
