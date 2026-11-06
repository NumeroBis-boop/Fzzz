import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Modèle du mécanisme de chasse (ModeleChasse) : règles unitaires, puis
 * comparaison des tirages avec les mesures de la note « Mécanisme de chasse
 * Fourmizzz » (5 425 tirages du simulateur du jeu, octobre 2026), à graine
 * fixée.
 */
const page = creerPage(
  [
    "js/class/Utils.js",
    "js/class/Parametre.js",
    "js/class/Joueur.js",
    "js/class/Armee.js",
    "js/class/Combat.js",
    "js/class/SimulationChasse.js",
    "js/class/ModeleChasse.js",
    "js/content.js",
  ],
  `var chrome = { runtime: { getManifest: () => ({ version: "0" }), getURL: (p) => p } };
   document.body.innerHTML = "<div class='boite_connexion_titre'>Connexion</div>";`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);
const armeeJsn = (n: number) => {
  const a = new Array(14).fill(0);
  a[0] = n;
  return a;
};
// chasse de la note : 2 000 cm² sur 20 000 cm², B = 6 099
const TDC = 20000,
  TERRAIN = 2000;

describe("ModeleChasse : règles", () => {
  test("prédateurs par réplique croissante, puissance √(réplique × vie)", () => {
    const P = lire(`ModeleChasse.PREDATEURS`);
    expect(P.length).toBe(17);
    expect(P[0].nom).toBe("Petite araignée");
    expect(P[0].puissance).toBeCloseTo(25.5, 1);
    for (let i = 1; i < P.length; i++)
      expect(P[i].replique).toBeGreaterThanOrEqual(P[i - 1].replique);
    expect(P.map((p: any) => p.nom).indexOf("Dionée")).toBeLessThan(
      P.map((p: any) => p.nom).indexOf("Abeille"),
    );
  });

  test("palier de réplique : seuils inclusifs 3, 2, 1,5", () => {
    expect(lire(`ModeleChasse.palier(300, 100)`)).toBe(0.1);
    expect(lire(`ModeleChasse.palier(299, 100)`)).toBe(0.3);
    expect(lire(`ModeleChasse.palier(200, 100)`)).toBe(0.3);
    expect(lire(`ModeleChasse.palier(150, 100)`)).toBe(0.5);
    expect(lire(`ModeleChasse.palier(149, 100)`)).toBe(1);
  });

  test("prédateurs tués dans l'ordre, chacun coûtant sa vie", () => {
    // 2 petites araignées (50) puis 1 araignée (75) : attaque 180 tue 2 + 1 ; 120 tue 2 seulement
    const nombres = new Array(17).fill(0);
    nombres[0] = 2;
    nombres[1] = 1;
    expect(lire(`ModeleChasse.tues(${JSON.stringify(nombres)}, 180)`).slice(0, 2)).toEqual([2, 1]);
    expect(lire(`ModeleChasse.tues(${JSON.stringify(nombres)}, 120)`).slice(0, 2)).toEqual([2, 0]);
  });

  test("unités perdues : JSN d'abord, puis SN, bouclier sur la vie, entiers tronqués", () => {
    const armee = [3, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    // 3 JSN (8) = 24, puis 2 SN (10) = 20 : 47 de dégâts tuent 3 JSN et 2 SN
    expect(lire(`ModeleChasse.perdues(${JSON.stringify(armee)}, 47, 0)`).slice(0, 2)).toEqual([
      3, 2,
    ]);
    // bouclier 10 : vie × 2, 47 tue 2 JSN (32) et 1 SN (20) ? non : reste 15 < 20
    expect(lire(`ModeleChasse.perdues(${JSON.stringify(armee)}, 47, 10)`).slice(0, 2)).toEqual([
      2, 0,
    ]);
  });

  test("graine : mêmes tirages", () => {
    const a = lire(`JSON.stringify(ModeleChasse.tirer(${TDC}, ${TERRAIN}, ModeleChasse.alea(42)))`);
    const b = lire(`JSON.stringify(ModeleChasse.tirer(${TDC}, ${TERRAIN}, ModeleChasse.alea(42)))`);
    const c = lire(`JSON.stringify(ModeleChasse.tirer(${TDC}, ${TERRAIN}, ModeleChasse.alea(43)))`);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("ModeleChasse : tirages contre les mesures de la note", () => {
  const tirages = lire(`(() => {
    let alea = ModeleChasse.alea(2026), B = ModeleChasse.difficulte(${TDC}, ${TERRAIN}), r = [];
    for (let i = 0; i < 3000; i++) { let t = ModeleChasse.tirer(${TDC}, ${TERRAIN}, alea); r.push([t.puissance / B, t.replique / B, t.vie / B]); }
    return r; })()`) as number[][];
  const moyenne = (k: number) => tirages.reduce((s, t) => s + t[k]!, 0) / tirages.length;

  test("difficulté B de la chasse de référence", () => {
    expect(lire(`ModeleChasse.difficulte(${TDC}, ${TERRAIN})`)).toBeCloseTo(6099, 0);
  });

  test("puissance dépensée : 3,45 × B × marge en moyenne, jamais au-delà de l'allouée", () => {
    const marge = lire<number>(`ModeleChasse.MARGE_BUDGET`);
    expect(marge).toBe(1.005);
    expect(moyenne(0)).toBeGreaterThan(3.43 * marge);
    expect(moyenne(0)).toBeLessThan(3.465 * marge);
    expect(Math.max(...tirages.map((t) => t[0]!))).toBeLessThan(3.475 * marge);
  });

  test("réplique 2,01 × B et vie 6,44 × B en moyenne", () => {
    expect(moyenne(1)).toBeGreaterThan(1.94);
    expect(moyenne(1)).toBeLessThan(2.08);
    expect(moyenne(2)).toBeGreaterThan(6.25);
    expect(moyenne(2)).toBeLessThan(6.65);
  });

  test("JSN perdues par point de difficulté de Calystène, par ratio (±8 %, marge comprise)", () => {
    // mesures de la note (JSN pures, bouclier 0, 40 à 240 tirages par point :
    // ±2 % de bruit) ; le modèle est donné à ±3 % dans la zone 6–8
    const mesures: [number, number][] = [
      [4, 0.0374],
      [6, 0.0185],
      [7, 0.0117],
      [8, 0.0093],
      [10, 0.008],
      [20, 0.0083],
    ];
    for (const [ratio, mesure] of mesures) {
      const perte = lire<number>(`(() => {
        let B = ModeleChasse.difficulte(${TDC}, ${TERRAIN}), alea = ModeleChasse.alea(7), somme = 0, n = 3000,
          unites = ${JSON.stringify(armeeJsn(0))};
        unites[0] = Math.round(${ratio} * B);
        for (let i = 0; i < n; i++) somme += ModeleChasse.chasse({ tdc: ${TDC}, terrain: ${TERRAIN}, unites, armes: 0, bouclier: 0 }, alea).jsn;
        return somme / n / (3 * B); })()`);
      expect(Math.abs(perte / mesure - 1)).toBeLessThan(0.08);
    }
  });

  test("part des tirages à 10 % de réplique au ratio 7 : 0,74 mesuré (±0,05)", () => {
    const part = lire<number>(`(() => {
      let B = ModeleChasse.difficulte(${TDC}, ${TERRAIN}), alea = ModeleChasse.alea(11), dix = 0, n = 3000,
        unites = ${JSON.stringify(armeeJsn(0))};
      unites[0] = Math.round(7 * B);
      for (let i = 0; i < n; i++) if (ModeleChasse.chasse({ tdc: ${TDC}, terrain: ${TERRAIN}, unites, armes: 0, bouclier: 0 }, alea).palier == 0.1) dix++;
      return dix / n; })()`);
    expect(Math.abs(part - 0.74)).toBeLessThan(0.05);
  });
});

describe("ModeleChasse.salve", () => {
  test("statistiques par chasse et pour la salve, armées propres à chaque chasse", () => {
    const res = lire(`JSON.parse(JSON.stringify(ModeleChasse.salve({
      tdcArrivee: ${TDC}, terrain: ${TERRAIN}, armes: 0, bouclier: 0,
      chasses: [{ unites: ${JSON.stringify(armeeJsn(60000))} }, { unites: ${JSON.stringify(armeeJsn(30000))} }],
    }, 200, 5)))`);
    expect(res.tirages).toBe(200);
    expect(res.chasses.length).toBe(2);
    for (const c of res.chasses) {
      const p = Object.values(c.paliers as Record<string, number>).reduce((s, x) => s + x, 0);
      expect(p).toBeCloseTo(1, 6);
      expect(c.jsn.min).toBeLessThanOrEqual(c.jsn.mediane);
      expect(c.jsn.mediane).toBeLessThanOrEqual(c.jsn.p95);
      expect(c.jsn.p95).toBeLessThanOrEqual(c.jsn.max);
      expect(c.perdues[0]).toBeCloseTo(c.jsn.moyenne, 6); // JSN pures : perdues = équivalent JSN
    }
    // la seconde chasse, deux fois moins armée (ratio ~4,9 contre ~9,8), perd davantage
    expect(res.chasses[1].jsn.moyenne).toBeGreaterThan(res.chasses[0].jsn.moyenne);
    expect(res.total.jsn.moyenne).toBeCloseTo(
      res.chasses[0].jsn.moyenne + res.chasses[1].jsn.moyenne,
      6,
    );
    expect(res.total.pire[0]).toBeGreaterThanOrEqual(res.total.jsn.p95 * 0.99);
  });
});
