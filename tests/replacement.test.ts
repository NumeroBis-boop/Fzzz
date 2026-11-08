import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

const page = creerPage(
  [
    "js/class/Utils.js",
    "js/class/Parametre.js",
    "js/class/Joueur.js",
    "js/class/Armee.js",
    "js/page/Armee.js",
  ],
  `var METHODE_FLOOD = [], AFFECTATION_RESSOURCE = [], RATIO_RECOLTE = {};
   var NOM_UNITE = ["Ouvrière", "Jeune Soldate Naine", "Soldate Naine", "Naine d’Elite"];`,
);

/** Replacement prévu : [indice d'unité, terrain, dôme] ou null si déjà placé. */
function prevu(
  armee: { tdc?: object; dome?: object; loge?: object },
  parametres: { terrain: number; dome: number; unite: number; uniteDome?: number },
) {
  return page.lire(`(() => {
    localStorage.setItem("outiiil_parametre", JSON.stringify({ uniteAntisondeTerrain: ${parametres.terrain}, uniteAntisondeDome: ${parametres.dome}, uniteAntisondeTerrainType: ${parametres.unite}, uniteAntisondeDomeType: ${parametres.uniteDome ?? parametres.unite} }));
    window.monProfil = new Joueur({ pseudo: "Moi" }).getParametre();
    let p = Object.create(PageArmee.prototype), appel = null;
    p._armeeTdc = new Armee({ unite: ${JSON.stringify(armee.tdc || {})} });
    p._armeeDome = new Armee({ unite: ${JSON.stringify(armee.dome || {})} });
    p._armeeLoge = new Armee({ unite: ${JSON.stringify(armee.loge || {})} });
    p.replacer = (iT, t, iD, d, etapes) => {
      appel = [iT, t, d];
      window.uniteDome = iD;
      window.etapes = etapes.filter((e) => e.toutEnLoge || e.nb > 0);
    };
    let f = p.placementPrevu();
    if (f) f();
    return [p.indiceUnite("uniteAntisondeTerrainType"), appel];
  })()`);
}

describe("replacement de l'armée", () => {
  test("nombres tirés entre 90 % et 100 % des maximums des préférences", () => {
    for (let k = 0; k < 50; k++) {
      const [, appel] = prevu(
        { loge: { "Jeune Soldate Naine": 1000 } },
        { terrain: 100, dome: 50, unite: 0 },
      ) as [number, number[]];
      expect(appel[0]).toBe(0);
      expect(appel[1]).toBeGreaterThanOrEqual(90);
      expect(appel[1]).toBeLessThanOrEqual(100);
      expect(appel[2]).toBeGreaterThanOrEqual(45);
      expect(appel[2]).toBeLessThanOrEqual(50);
    }
  });
  test("unité choisie dans les préférences, sinon la première disponible", () => {
    const armee = { loge: { "Jeune Soldate Naine": 1000, "Naine d’Elite": 500 } };
    expect((prevu(armee, { terrain: 10, dome: 0, unite: 3 }) as [number, number[]])[1][0]).toBe(2);
    expect((prevu(armee, { terrain: 10, dome: 0, unite: 0 }) as [number, number[]])[1][0]).toBe(0);
  });
  test("unité choisie absente : première unité disponible", () => {
    const [, appel] = prevu(
      { loge: { "Soldate Naine": 1000 } },
      { terrain: 10, dome: 0, unite: 1 },
    ) as [number, number[]];
    expect(appel[0]).toBe(1);
  });
  test("déjà placée : rien ; pas assez d'unités : 1 en terrain, le maximum possible en dôme", () => {
    expect(
      prevu(
        {
          tdc: { "Jeune Soldate Naine": 95 },
          dome: { "Jeune Soldate Naine": 48 },
          loge: { "Jeune Soldate Naine": 900, "Soldate Naine": 50 },
        },
        { terrain: 100, dome: 50, unite: 0 },
      ),
    ).toEqual([0, null]);
    expect(
      prevu(
        { tdc: { "Jeune Soldate Naine": 1 }, dome: { "Jeune Soldate Naine": 39 } },
        { terrain: 100, dome: 50, unite: 0 },
      ),
    ).toEqual([0, null]);
    const peu = { loge: { "Jeune Soldate Naine": 40 } };
    expect(prevu(peu, { terrain: 100, dome: 50, unite: 0 })).toEqual([0, [0, 1, 39]]);
    expect(prevu(peu, { terrain: 100, dome: 20, unite: 0 })).toEqual([0, [0, 1, 20]]);
    expect(
      prevu({ loge: { "Jeune Soldate Naine": 1 } }, { terrain: 100, dome: 20, unite: 0 }),
    ).toEqual([0, [0, 1, 0]]);
  });
  test("seules les antisondes dehors : seulement la différence, entre lieux voisins", () => {
    const parametres = { terrain: 100, dome: 50, unite: 0 },
      etapes = () => page.lire(`window.etapes`);
    // terrain déjà dans ses bornes : seul le dôme est complété
    prevu(
      {
        tdc: { "Jeune Soldate Naine": 95 },
        dome: { "Jeune Soldate Naine": 10 },
        loge: { "Jeune Soldate Naine": 900 },
      },
      parametres,
    );
    let e = etapes();
    expect(e.length).toBe(1);
    expect([e[0].de, e[0].vers]).toEqual([3, 2]);
    expect(e[0].nb).toBeGreaterThanOrEqual(35);
    expect(e[0].nb).toBeLessThanOrEqual(40);
    // trop en terrain, rien en dôme : le surplus du TdC passe au dôme, et ce
    // que le dôme a de trop va en loge (rien si terrain + dôme = 150 tout juste)
    const [, appel] = prevu(
      { tdc: { "Jeune Soldate Naine": 150 }, loge: { "Jeune Soldate Naine": 10 } },
      parametres,
    ) as [number, number[]];
    e = etapes();
    const [, t, d] = appel as [number, number, number];
    expect(e).toEqual(
      [
        { i: 0, de: 1, vers: 2, nb: 150 - t },
        { i: 0, de: 2, vers: 3, nb: 150 - t - d },
      ].filter((x) => x.nb > 0),
    );
  });
  test("d'autres unités hors de la loge : tout en loge d'abord", () => {
    prevu(
      {
        tdc: { "Soldate Naine": 5, "Jeune Soldate Naine": 95 },
        loge: { "Jeune Soldate Naine": 900 },
      },
      { terrain: 100, dome: 50, unite: 0 },
    );
    const e = page.lire(`window.etapes`);
    expect(e[0]).toEqual({ toutEnLoge: true });
    // même unité : les deux antisondes ensemble de la loge au dôme, puis celle du TdC
    expect(e.slice(1).map((x: { de: number; vers: number }) => [x.de, x.vers])).toEqual([
      [3, 2],
      [2, 1],
    ]);
  });
  test("unités différentes en terrain et en dôme", () => {
    const armee = { loge: { "Jeune Soldate Naine": 1000, "Naine d’Elite": 30 } };
    const [, appel] = prevu(armee, { terrain: 100, dome: 50, unite: 1, uniteDome: 3 }) as [
      number,
      number[],
    ];
    expect(appel[0]).toBe(0);
    expect(page.lire(`window.uniteDome`)).toBe(2);
    expect(appel[1]).toBeGreaterThanOrEqual(90);
    // 30 Naines d'Elite seulement : toutes en dôme
    expect(appel[2]).toBe(30);
    const e = page.lire(`window.etapes`);
    // d'abord tout ce qui entre au dôme, puis ce qui en sort vers le TdC
    expect(e.map((x: { i: number; de: number; vers: number }) => [x.i, x.de, x.vers])).toEqual([
      [0, 3, 2],
      [2, 3, 2],
      [0, 2, 1],
    ]);
  });
  test("ancien réglage unique repris pour le terrain et le dôme", () => {
    expect(
      page.lire(`(() => {
        localStorage.setItem("outiiil_parametre", JSON.stringify({ uniteReplacement: 3 }));
        let p = new Joueur({ pseudo: "Moi" }).getParametre().parametre;
        return [p.uniteAntisondeTerrainType.valeur, p.uniteAntisondeDomeType.valeur];
      })()`),
    ).toEqual([3, 3]);
  });
});
