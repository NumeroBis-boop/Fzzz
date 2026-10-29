import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

const page = creerPage(
  ["js/class/Utils.js", "js/class/AttaqueLancee.js"],
  // heure serveur = heure du PC + DECALAGE (horloge de l'extension faussée si non nul)
  "var DECALAGE = 0; var Horloge = { serveurA: (t) => moment(t + DECALAGE) };",
);
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

describe("« + partager » et annulation", () => {
  const p = creerPage(
    ["js/class/Utils.js", "js/class/AttaqueLancee.js"],
    `var Horloge = { serveur: () => moment() };
     var TroupesDehors = { ajouterAttaque() {}, synchroniserAttaques() {} };
     var Armee = class { constructor() { this.unite = []; } };
     var PARTAGES = [], RETIRES = [];
     var PartageChasses = {
       floodsPartages: () => ({ 7: 1 }),
       partagerFloods(c) { PARTAGES.push(...c.map((x) => x.id)); return Promise.resolve(); },
       retirerFloods(ids) { RETIRES.push(...ids); return Promise.resolve(); },
     };`,
  );
  const captures = (liste: string) =>
    p.lire(`localStorage.setItem(CLE_ATTAQUES_LANCEES, JSON.stringify(${liste}));
      PARTAGES = []; RETIRES = [];`);
  const futur = "moment().add(1, 'h').valueOf()";

  test("seules les attaques marquées et liées sont partagées, une seule fois", () => {
    captures(`[
      { id: 5, cible: "A", lieu: "Terrain de Chasse", unite: {}, arrivee: ${futur}, partager: true },
      { id: 6, cible: "A", lieu: "Terrain de Chasse", unite: {}, arrivee: ${futur} },
      { id: null, cible: "B", lieu: "Terrain de Chasse", unite: {}, lancee: Date.now(), partager: true },
    ]`);
    p.lire("AttaqueLancee.partagerMarquees()");
    expect(p.lire("PARTAGES")).toEqual([5]);
    p.lire("AttaqueLancee.partagerMarquees()");
    expect(p.lire("PARTAGES")).toEqual([5]);
    expect(p.lire(`AttaqueLancee.charger().filter((a) => a.partager).length`)).toBe(1);
  });
  test("marque posée à l'enregistrement", () => {
    captures("[]");
    p.lire(`AttaqueLancee.enregistrer("C", "Terrain de Chasse", { x: 10 }, { partager: true })`);
    expect(p.lire(`AttaqueLancee.charger()[0].partager`)).toBe(true);
  });
  test("flood partagé puis annulé : retiré du forum", () => {
    captures(`[
      { id: 7, cible: "A", lieu: "Terrain de Chasse", unite: {}, arrivee: ${futur} },
      { id: 8, cible: "A", lieu: "Terrain de Chasse", unite: {}, arrivee: ${futur} },
    ]`);
    p.lire("AttaqueLancee.synchroniser([])");
    expect(p.lire("RETIRES")).toEqual([7]);
  });
  test("page relue peut-être hors du jeu : rien n'est retiré", () => {
    captures(`[{ id: 7, cible: "A", lieu: "Terrain de Chasse", unite: {}, arrivee: ${futur} }]`);
    p.lire("AttaqueLancee.synchroniser([], false)");
    expect(p.lire("RETIRES")).toEqual([]);
  });
});

describe("arrivée d'une attaque", () => {
  // décalage serveur : +2,7 s sur l'horloge du PC
  const p = creerPage(
    ["js/class/Utils.js", "js/class/AttaqueLancee.js"],
    `var Horloge = { serveurA: (ms) => moment(ms + 2700) };`,
  );
  test("seconde où le serveur a produit la page + compteur du jeu", () => {
    const r = p.lire<number[]>(`(() => {
      var avant = Date.now();
      var l = AttaqueLancee.extraireLignes($("<div>- Vous allez attaquer <span><a href='#'>Bob</a></span> dans <span id='attaque_9'>1m</span><script>reste(75, \\"attaque_9\\");</script></div>"))[0];
      return [l.arrivee.valueOf(), Math.floor((avant + 2700) / 1000) * 1000 + 75000];
    })()`);
    expect(r[0]! % 1000).toBe(0);
    expect(Math.abs(r[0]! - r[1]!)).toBeLessThanOrEqual(1000);
  });
});

describe("heure de réception de la page", () => {
  test("timeOrigin en retard (téléphone sorti de veille) : ignoré", () => {
    // horloge de performance arrêtée 20 min pendant la veille : timeOrigin + responseStart
    // retarde de 20 min, l'écart now() − responseStart reste juste
    const ecart = page.lire<number>(`(() => {
      let vrais = [performance.getEntriesByType, performance.now], maintenant = 60000;
      performance.getEntriesByType = () => [{ responseStart: maintenant - 3000 }];
      performance.now = () => maintenant;
      Object.defineProperty(performance, "timeOrigin", { value: Date.now() - maintenant - 20 * 60000, configurable: true });
      let r = AttaqueLancee.receptionPage();
      [performance.getEntriesByType, performance.now] = vrais;
      return Date.now() - r;
    })()`);
    expect(ecart).toBeGreaterThanOrEqual(3000);
    expect(ecart).toBeLessThan(3500);
  });
});

describe("arrivée d'une attaque, minute écrite par le jeu", () => {
  const S = 13711;
  // page du jeu (C+) : compte à rebours en secondes et « Arrivée à HHhMM »
  const lire = (decalage: number) =>
    page.lire<{ arrivee: number; incertaine: boolean; reelle: number }>(`(() => {
      DECALAGE = ${decalage};
      let reelle = Date.now() + ${S} * 1000,
        html = '<h3>Attaque(s) en cours</h3>- Vous allez attaquer <span class="gras"><a href="Membre.php?Pseudo=Callisto">Callisto</a></span> (Terrain de chasse) dans <span class="gras" id="attaque_98529">3H 48m 31s</span><script>reste(${S}, "attaque_98529");</script> - <a href="/ennemie.php?annuler=98529">Annuler</a><br /><small><em> Troupes en attaques : 1 Jeune Soldate Naine.<br />Arrivée à ' + moment(reelle).format("HH[h]mm") + '</em></small><br/>',
        l = AttaqueLancee.extraireLignes(Utils.parseHtml(html))[0];
      return { arrivee: l.arrivee.valueOf(), incertaine: l.incertaine, reelle };
    })()`);

  test("horloge juste : arrivée calculée à la seconde", () => {
    const r = lire(0);
    expect(r.incertaine).toBe(false);
    expect(Math.abs(r.arrivee - r.reelle)).toBeLessThan(1000);
  });
  test("horloge en retard de 20 min : minute du jeu, sans secondes", () => {
    const r = lire(-20 * 60000);
    expect(r.incertaine).toBe(true);
    expect(r.arrivee % 60000).toBe(30000);
    expect(Math.floor(r.arrivee / 60000)).toBe(Math.floor(r.reelle / 60000));
  });
  test("minute du jeu au jour le plus proche (arrivée après minuit)", () => {
    const calcule = page.lire<number>(
      `AttaqueLancee.minuteJeu("Arrivée à 00h05", moment("2026-10-29T23:58:00"))`,
    );
    expect(calcule).toBe(page.lire<number>(`moment("2026-10-30T00:05:00").valueOf()`));
  });
});
