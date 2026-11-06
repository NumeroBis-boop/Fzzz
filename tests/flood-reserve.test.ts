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
  `var METHODE_FLOOD = [], AFFECTATION_RESSOURCE = [], RATIO_RECOLTE = {}, TOAST_ERROR = {};
   var NOM_UNITE = ${JSON.stringify(NOM_UNITE)}, NOM_UNITES = ${JSON.stringify(NOM_UNITES)};
   var AttaqueLancee = { contexteFlood: null };`,
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
      armee: `Object.assign(new Armee(), { gardees: { antisondes: false, autres: [{ nombre: 300, unite: ${choix(JSN)} }] } })`,
    });
    expect(r.gardees).toEqual(parType({ [JSN]: 300 }));
  });

  test("plusieurs autres unités gardées (préférences) : chacune reste", () => {
    regler({
      reserveFloodAuto: true,
      uniteAntisondeTerrain: 1,
      uniteAntisondeTerrainType: choix(JSN),
      uniteAntisondeDome: 0,
      reserveFlood: 100,
      reserveFloodType: choix(JS),
      reserveFloodAutres: [
        [200, choix(TANK)],
        [50, 0],
      ],
    });
    // 50 « dernières unités » : prises sous les Tanks gardés, dans ce qui reste en bas
    const r = flood({ [JSN]: 3000, [JS]: 1000, [TANK]: 300 }, "0", [0, 100000], 3);
    expect(r.gardees).toEqual(parType({ [JSN]: 1, [JS]: 100, [TANK]: 250 }));
    expect(r.floods).toEqual([0, 4300 - 351]);
  });

  test("100 JS gardées : l'attaque 2 ne les compte ni ne les envoie", () => {
    regler({ reserveFlood: 100, reserveFloodType: choix(JS) });
    const r = page.lire<{ floods: number[]; rep: number[][] }>(`(() => {
      let a = new Armee({ unite: { "Jeune Soldate Naine": 1000, "Jeune Soldate": 300 } });
      let floods = a.simulerFlood(100000, 100000, "0", [0, 1000, 300], 0, 3, -1);
      return { floods: floods.slice(), rep: a.repartition.map((r) => [r[${JSN}], r[${JS}]]) };
    })()`);
    // 1 300 unités, 100 gardées : l'attaque 2 n'a que 200 JS, et c'est sur 200 que sa prise est calculée
    expect(r.floods).toEqual([0, 1000, 200]);
    expect(r.rep).toEqual([
      [0, 0],
      [1000, 0],
      [0, 200],
    ]);
  });

  test("unités gardées changées après la simulation : au clic, aucune ne part", () => {
    regler({});
    const envois = page.lire<number[][]>(`(() => {
      let a = new Armee({ unite: { "Jeune Soldate Naine": 900, "Jeune Soldate": 300 } }), envois = [];
      a.simulerFlood(100000, 100000, "0", [0, 1000, 200], 0, 3, -1);
      // 100 JS gardées sans nouvelle simulation (cible hors de portée, par exemple)
      a.gardees = { antisondes: false, autres: [{ nombre: 100, unite: ${choix(JS)} }] };
      let attente = setTimeout;
      window.setTimeout = (f) => (f(), 0);
      // jeu simulé : la 2e attaque postée n'a pas de réponse (fin du test, pas de rechargement)
      $.post = (url, donnees, retour) => {
        envois.push([donnees.unite1, donnees.unite4]);
        if (envois.length < 2) retour("<center>Vos troupes sont en marche</center>");
        return { fail() {} };
      };
      a.envoyerFlood(1, 0, "t=1");
      window.setTimeout = attente;
      return envois;
    })()`);
    expect(envois).toEqual([
      [900, 100],
      [0, 100],
    ]);
  });

  test("au clic, une attaque qui n'a plus d'unité n'est pas envoyée", () => {
    regler({});
    const envois = page.lire<number[][]>(`(() => {
      let a = new Armee({ unite: { "Jeune Soldate Naine": 900, "Jeune Soldate": 300 } }), envois = [];
      a.simulerFlood(100000, 100000, "0", [0, 1000, 200], 0, 3, -1);
      // 200 JS gardées : la 2e attaque n'a plus rien
      a.gardees = { antisondes: false, autres: [{ nombre: 200, unite: ${choix(JS)} }] };
      let attente = setTimeout;
      window.setTimeout = (f) => (f(), 0);
      $.post = (url, donnees, retour) => {
        envois.push([donnees.unite1, donnees.unite4]);
        retour("<center>Vos troupes sont en marche</center>");
        return { fail() {} };
      };
      // toutes les attaques passées en revue, sans le rechargement de fin de flood
      a.envoyerFlood = ((envoyer) => function (id, i, s) {
        if (i < this.floods.length) envoyer.call(this, id, i, s);
      })(a.envoyerFlood);
      a.envoyerFlood(1, 0, "t=1");
      window.setTimeout = attente;
      return envois;
    })()`);
    expect(envois).toEqual([[900, 100]]);
  });

  test("calculs justes pour tout réglage : unités gardées jamais envoyées ni comptées", () => {
    // tirages reproductibles (mulberry32)
    let graine = 20261106;
    const alea = () => {
      graine = (graine + 0x6d2b79f5) | 0;
      let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const entier = (min: number, max: number) => min + Math.floor(alea() * (max - min + 1));
    const cas = Array.from({ length: 400 }, () => {
      const tdcAtt = entier(10000, 200000),
        methode = String(entier(0, 3)),
        creneaux = entier(2, 8);
      return {
        armee: Array.from({ length: 14 }, () => (alea() < 0.5 ? entier(0, 5000) : 0)),
        antisondes: alea() < 0.6,
        terrain: entier(0, 300),
        terrainType: entier(0, 14),
        dome: entier(0, 3000),
        domeType: entier(0, 14),
        autres: Array.from({ length: entier(0, 3) }, () => ({
          nombre: entier(0, 4000),
          unite: entier(0, 14),
        })),
        tdcAtt,
        tdcCible: entier(Math.ceil(tdcAtt * 0.5), tdcAtt * 3),
        methode,
        attaques: [entier(0, 500), ...Array.from({ length: entier(1, 6) }, () => entier(0, 20000))],
        uniforme: entier(0, 20000),
        creneaux,
        reste: alea() < 0.5 ? -1 : entier(1, creneaux),
        degressif: { base: entier(1, 40), regle: alea() < 0.5 ? "ecart" : "restant" },
      };
    });
    const echecs = page.lire<string[]>(`(() => {
      let echecs = [], p = monProfil.parametre;
      ${JSON.stringify(cas)}.forEach((c, n) => {
        p.uniteAntisondeTerrain.valeur = c.terrain;
        p.uniteAntisondeTerrainType.valeur = c.terrainType;
        p.uniteAntisondeDome.valeur = c.dome;
        p.uniteAntisondeDomeType.valeur = c.domeType;
        let a = new Armee();
        a.unite = c.armee.slice();
        a.gardees = { antisondes: c.antisondes, autres: c.autres };
        let floods = a.simulerFlood(c.tdcAtt, c.tdcCible, c.methode, c.attaques, c.uniforme, c.creneaux, c.reste, c.degressif),
          dispo = a.disponibleFlood(),
          gardees = a.gardeesFlood(),
          rep = a.repartition,
          total = c.armee.reduce((s, x) => s + x, 0),
          demandees = (c.antisondes ? c.terrain + c.dome : 0) + c.autres.reduce((s, l) => s + l.nombre, 0),
          envoyees = new Array(14).fill(0),
          faux = (msg) => echecs.push("cas " + n + " : " + msg);
        // gardées + disponibles = armée, jamais négatif
        c.armee.forEach((x, j) => {
          if (dispo[j] < 0 || gardees[j] < 0 || dispo[j] + gardees[j] != x) faux("type " + j);
        });
        // autant d'unités gardées que demandé, dans la limite de l'armée
        if (gardees.reduce((s, x) => s + x, 0) != Math.min(demandees, total)) faux("total gardé");
        // unités choisies (et antisondes) : gardées en priorité sur les dernières unités
        let voulues = new Array(14).fill(0),
          premiere = c.armee.findIndex((x) => x > 0),
          type = (choisi) => (choisi > 0 && c.armee[choisi - 1] > 0 ? choisi - 1 : premiere);
        if (c.antisondes) {
          if (type(c.terrainType) >= 0) voulues[type(c.terrainType)] += c.terrain;
          if (type(c.domeType) >= 0) voulues[type(c.domeType)] += c.dome;
        }
        c.autres.forEach((l) => { if (l.unite > 0) voulues[l.unite - 1] += l.nombre; });
        voulues.forEach((v, j) => { if (gardees[j] < Math.min(v, c.armee[j])) faux("priorité type " + j); });
        // chaque attaque reçoit exactement ses unités, prises sur les disponibles
        floods.forEach((f, k) => {
          let somme = rep[k] ? rep[k].reduce((s, x) => s + x, 0) : 0;
          if (f > 0 && somme != f) faux("attaque " + k + " : " + somme + " pour " + f);
          if (f > 0) rep[k].forEach((x, j) => (envoyees[j] += x));
        });
        envoyees.forEach((x, j) => { if (x > dispo[j]) faux("envoi type " + j); });
        // prises : celles des unités réellement envoyées, attaque par attaque
        let cible = c.tdcCible, cible2 = c.tdcCible;
        floods.forEach((f, k) => {
          if (!f) return;
          let u = rep[k].reduce((s, x) => s + x, 0);
          cible -= Math.min(f, Math.floor(cible * 0.2));
          cible2 -= Math.min(u, Math.floor(cible2 * 0.2));
        });
        if (cible != cible2) faux("prises");
      });
      return echecs;
    })()`);
    expect(echecs).toEqual([]);
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
