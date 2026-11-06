import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

const NOM_UNITE = [
  "Ouvrière",
  "Jeune Soldate Naine",
  "Soldate Naine",
  "Naine d’Elite",
  "Jeune Soldate",
  "Soldate",
  "Concierge",
  "Concierge d’élite",
  "Artilleuse",
  "Artilleuse d’élite",
  "Soldate d’élite",
  "Tank",
  "Tank d’élite",
  "Tueuse",
  "Tueuse d’élite",
];
// indices de Armee.unite (NOM_UNITE sans l'ouvrière)
const JSN = 0,
  JS = 3,
  TANK = 10;
// valeur d'une liste d'unités des préférences : 0 = « Dernières unités » ou « Première disponible »
const choix = (i: number) => i + 1;

const NOM_UNITES = [
  "Ouvrières",
  "Jeunes Soldates Naines",
  "Soldates Naines",
  "Naines d’Elite",
  "Jeunes Soldates",
  "Soldates",
  "Concierges",
  "Concierges d’élite",
  "Artilleuses",
  "Artilleuses d’élite",
  "Soldates d’élite",
  "Tanks",
  "Tanks d’élite",
  "Tueuses",
  "Tueuses d’élite",
];
const page = creerPage(
  ["js/class/Utils.js", "js/class/Parametre.js", "js/class/Joueur.js", "js/class/Armee.js"],
  `var METHODE_FLOOD = [], AFFECTATION_RESSOURCE = [], RATIO_RECOLTE = {};
   var NOM_UNITE = ${JSON.stringify(NOM_UNITE)}, NOM_UNITES = ${JSON.stringify(NOM_UNITES)};`,
);

function regler(reglages: object) {
  page.lire(`localStorage.setItem("outiiil_parametre", JSON.stringify(${JSON.stringify({
    reserveFlood: 0,
    reserveFloodAuto: false,
    ...reglages,
  })}));
    localStorage.setItem("fzzz_reserveEnPlus", "1");
    window.monProfil = new Joueur({ pseudo: "Moi" }).getParametre();`);
}

type Flood = { floods: number[]; envoyees: number[]; gardees: number[] };
/**
 * Flood simulé sur une cible à 100 000 cm² (mon TdC aussi) ; `envoyees` : unités
 * qui partiraient au clic, par type ; `gardees` : celles qui restent.
 */
function flood(
  unites: Record<number, number>,
  methode: string,
  attaques: number[],
  creneaux: number,
  { ligneReste = -1, degressif = null as object | null, armee = "new Armee()" } = {},
): Flood {
  return page.lire<Flood>(`(() => {
    let a = ${armee};
    a.unite = new Array(14).fill(0);
    Object.entries(${JSON.stringify(unites)}).forEach(([i, n]) => (a.unite[i] = n));
    window.armee = a;
    let floods = a.simulerFlood(100000, 100000, ${JSON.stringify(methode)}, ${JSON.stringify(attaques)}, 0, ${creneaux}, ${JSON.stringify(ligneReste)}, ${JSON.stringify(degressif)});
    let envoyees = new Array(14).fill(0);
    a.repartition.forEach((r, k) => { if (floods[k]) r.forEach((n, j) => (envoyees[j] += n)); });
    return { floods: floods.slice(), envoyees, gardees: a.unite.map((n, j) => n - envoyees[j]) };
  })()`);
}
const parType = (r: Record<number, number>) => {
  const t = new Array(14).fill(0);
  for (const [i, n] of Object.entries(r)) t[Number(i)] = n;
  return t;
};

describe("flood : unités gardées (réserve)", () => {
  test("par défaut, les dernières unités de l'armée : entre JSN et JS, les JS restent", () => {
    regler({ reserveFlood: 1000 });
    const r = flood({ [JSN]: 3000, [JS]: 1000 }, "0", [0, 100000], 3);
    expect(r.floods).toEqual([0, 3000]);
    expect(r.gardees).toEqual(parType({ [JS]: 1000 }));
  });

  test("unité choisie : ce sont elles qui restent", () => {
    regler({ reserveFlood: 1000, reserveFloodType: choix(JSN) });
    const r = flood({ [JSN]: 3000, [JS]: 1000 }, "0", [0, 100000], 3);
    expect(r.floods).toEqual([0, 3000]);
    expect(r.gardees).toEqual(parType({ [JSN]: 1000 }));
  });

  test("pas assez de l'unité choisie : complétée par les dernières unités", () => {
    regler({ reserveFlood: 1000, reserveFloodType: choix(JSN) });
    const r = flood({ [JSN]: 300, [JS]: 1000, [TANK]: 2000 }, "0", [0, 100000], 3);
    expect(r.gardees).toEqual(parType({ [JSN]: 300, [TANK]: 700 }));
    expect(r.floods).toEqual([0, 2300]);
  });

  test("unité choisie absente de l'armée : les dernières unités, comme par défaut", () => {
    regler({ reserveFlood: 1000, reserveFloodType: choix(TANK) });
    const r = flood({ [JSN]: 3000, [JS]: 1000 }, "0", [0, 100000], 3);
    expect(r.gardees).toEqual(parType({ [JS]: 1000 }));
  });

  test("« = antisondes terrain + dôme » : les unités des antisondes restent, pas les dernières", () => {
    regler({
      reserveFloodAuto: true,
      reserveFloodType: choix(TANK), // sans autres unités gardées (0), sans effet
      uniteAntisondeTerrain: 1,
      uniteAntisondeTerrainType: choix(JSN),
      uniteAntisondeDome: 500,
      uniteAntisondeDomeType: choix(JS),
    });
    const r = flood({ [JSN]: 3000, [JS]: 1000, [TANK]: 200 }, "0", [0, 100000], 3);
    expect(r.gardees).toEqual(parType({ [JSN]: 1, [JS]: 500 }));
    expect(r.floods).toEqual([0, 3699]);
  });

  test("antisondes cochées et autres unités en plus : les deux restent", () => {
    regler({
      reserveFloodAuto: true,
      uniteAntisondeTerrain: 1,
      uniteAntisondeTerrainType: choix(JSN),
      uniteAntisondeDome: 500,
      uniteAntisondeDomeType: choix(JS),
      reserveFlood: 200,
      reserveFloodType: choix(TANK),
    });
    const r = flood({ [JSN]: 3000, [JS]: 1000, [TANK]: 300 }, "0", [0, 100000], 3);
    expect(r.gardees).toEqual(parType({ [JSN]: 1, [JS]: 500, [TANK]: 200 }));
    expect(r.floods).toEqual([0, 3599]);
    // autres unités sans unité choisie : les dernières de l'armée, après les antisondes
    regler({
      reserveFloodAuto: true,
      uniteAntisondeTerrain: 1,
      uniteAntisondeTerrainType: choix(JSN),
      uniteAntisondeDome: 500,
      uniteAntisondeDomeType: choix(JS),
      reserveFlood: 200,
    });
    expect(flood({ [JSN]: 3000, [JS]: 1000 }, "0", [0, 100000], 3).gardees).toEqual(
      parType({ [JSN]: 1, [JS]: 700 }),
    );
  });

  test("réglage de l'attaque en cours : il remplace celui des préférences", () => {
    regler({
      reserveFloodAuto: true,
      uniteAntisondeTerrain: 1,
      uniteAntisondeTerrainType: choix(JSN),
      reserveFlood: 1000,
    });
    const r = flood({ [JSN]: 3000, [JS]: 1000 }, "0", [0, 100000], 3, {
      armee: `Object.assign(new Armee(), { gardees: { antisondes: false, plus: 300, plusType: ${choix(JSN)} } })`,
    });
    expect(r.gardees).toEqual(parType({ [JSN]: 300 }));
  });

  test("anciens réglages : le nombre recopié des antisondes n'est pas gardé en plus", () => {
    const lire = (reglages: object, reprise: boolean) =>
      page.lire<[number, number]>(`(() => {
        localStorage.setItem("outiiil_parametre", JSON.stringify(${JSON.stringify(reglages)}));
        if (${reprise}) localStorage.removeItem("fzzz_reserveEnPlus");
        let p = new Joueur({ pseudo: "Moi" }).getParametre().parametre;
        return [p.reserveFlood.valeur, JSON.parse(localStorage.getItem("outiiil_parametre")).reserveFlood];
      })()`);
    // case cochée : reserveFlood valait leur somme, remis à 0 et enregistré
    expect(lire({ reserveFloodAuto: true, reserveFlood: 1001 }, true)).toEqual([0, 0]);
    // une seule fois : ensuite c'est un vrai nombre d'unités en plus
    expect(lire({ reserveFloodAuto: true, reserveFlood: 300 }, false)).toEqual([300, 300]);
    // case décochée : la réserve saisie reste, comptée en plus de rien
    expect(lire({ reserveFloodAuto: false, reserveFlood: 5000 }, true)).toEqual([5000, 5000]);
  });

  test("antisondes en « Première disponible » : la première unité de l'armée reste", () => {
    regler({
      reserveFloodAuto: true,
      uniteAntisondeTerrain: 1,
      uniteAntisondeTerrainType: 0,
      uniteAntisondeDome: 10,
      uniteAntisondeDomeType: 0,
    });
    const r = flood({ [JSN]: 3000, [JS]: 1000 }, "0", [0, 100000], 3);
    expect(r.gardees).toEqual(parType({ [JSN]: 11 }));
  });

  test("unité d'antisonde absente de l'armée : la première disponible, comme le replacement", () => {
    regler({
      reserveFloodAuto: true,
      uniteAntisondeTerrain: 1,
      uniteAntisondeTerrainType: choix(TANK),
      uniteAntisondeDome: 0,
    });
    const r = flood({ [JSN]: 3000, [JS]: 1000 }, "0", [0, 100000], 3);
    expect(r.gardees).toEqual(parType({ [JSN]: 1 }));
  });

  test("toutes les méthodes et « Reste » respectent la réserve", () => {
    regler({ reserveFlood: 1000, reserveFloodType: choix(JSN) });
    const armee = { [JSN]: 30000, [JS]: 10000, [TANK]: 5000 };
    const cas: [string, number[], object | null][] = [
      ["0", [0, 20000, 20000, 20000], null],
      ["1", [0], null],
      ["2", [0], null],
      ["3", [0], { base: 25, regle: "ecart" }],
    ];
    for (const [methode, attaques, degressif] of cas)
      for (const ligneReste of [-1, 1, 3]) {
        const r = flood(armee, methode, attaques, 4, { ligneReste, degressif });
        expect(r.gardees[JSN]).toBeGreaterThanOrEqual(1000);
        if (ligneReste != -1) expect(r.gardees).toEqual(parType({ [JSN]: 1000 }));
      }
  });

  test("« Reste » sur une ligne au-delà des attaques calculées : pas de NaN, tout part sur elle", () => {
    regler({});
    // écart fixe de 5 points depuis 10 % : 10 %, 5 %, puis plus rien
    const r = flood({ [JSN]: 1000000 }, "3", [0], 4, {
      ligneReste: 4,
      degressif: { base: 10, regle: "ecart" },
    });
    expect(r.floods).toEqual([0, 10000, 5000, 0, 985000]);
    expect(r.gardees).toEqual(parType({}));
  });

  test("réserve plus grande que l'armée : rien ne part, même la ligne Antisonde", () => {
    regler({ reserveFlood: 0 });
    // une simulation précédente sans réserve ne doit pas partir au clic
    flood({ [JSN]: 500 }, "0", [100, 200], 3);
    page.lire(`monProfil.parametre.reserveFlood.valeur = 1000`);
    const r = flood({ [JSN]: 500 }, "0", [100, 200], 3, { armee: "window.armee" });
    expect(r.floods).toEqual([0]);
    expect(r.envoyees).toEqual(parType({}));
  });

  test("ligne Antisonde plus grande que les unités disponibles : au plus celles-ci", () => {
    regler({ reserveFlood: 100 });
    const r = flood({ [JSN]: 500 }, "0", [1000, 200], 3);
    expect(r.floods).toEqual([400]);
    expect(r.gardees).toEqual(parType({ [JSN]: 100 }));
  });

  test("texte des unités gardées, affiché sous le lanceur et le multi-flood", () => {
    regler({
      reserveFloodAuto: true,
      uniteAntisondeTerrain: 1,
      uniteAntisondeTerrainType: choix(JSN),
      uniteAntisondeDome: 1500,
      uniteAntisondeDomeType: choix(TANK),
    });
    const texte = (unites: Record<number, number>) =>
      page.lire<string>(`(() => {
        let a = new Armee();
        a.unite = ${JSON.stringify(parType(unites))};
        return Armee.texteGardees(a.gardeesFlood());
      })()`);
    const dome = page.lire<string>(`numeral(1500).format()`);
    expect(texte({ [JSN]: 3000, [TANK]: 2000 })).toBe(`1 Jeune Soldate Naine, ${dome} Tanks`);
    regler({});
    expect(texte({ [JSN]: 3000 })).toBe("aucune");
  });

  test("dernières unités : même répartition que l'ancien calcul (réserve ôtée du total)", () => {
    // avant : floods calculés sur total − réserve, répartis sur toute l'armée en
    // commençant par la première unité, les dernières restaient
    for (const reserve of [0, 1, 999, 25000, 70000])
      for (const armee of <Record<number, number>[]>[
        { [JSN]: 30000, [JS]: 10000, [TANK]: 5000 },
        { [JS]: 40000, 13: 3 },
        { 1: 7, 2: 7, 5: 20000, 9: 1, 12: 15000 },
      ]) {
        regler({ reserveFlood: reserve });
        // « Reste » : tout ce qui n'est pas gardé part
        const r = flood(armee, "1", [0], 5, { ligneReste: 1 });
        const total = Object.values(armee).reduce((s, n) => s + n, 0);
        let aGarder = Math.min(reserve, total);
        const attendu = parType({});
        for (let i = 13; i >= 0 && aGarder > 0; i--) {
          attendu[i] = Math.min(parType(armee)[i], aGarder);
          aGarder -= attendu[i];
        }
        expect(r.gardees).toEqual(attendu);
      }
  });
});
