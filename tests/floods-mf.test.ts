import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

const page = creerPage(
  ["js/class/Utils.js", "js/class/AttaqueLancee.js"],
  `var Horloge = { serveurA: (t) => moment(t), serveur: () => moment(), maintenant: () => Date.now() };
   var DEHORS = [];
   var TroupesDehors = { ajouterAttaque: (id) => DEHORS.push(id), synchroniserAttaques() {} };
   class Armee { constructor(o) { this.unite = o.unite; } }
   var PartageChasses = { floodsPartages: () => ({}), retirerFloods() {} };`,
);

// liste « Attaque(s) en cours » telle que le jeu la renvoie : une ligne par attaque
const reponse = (attaques: { id: number; cible: string; s: number }[]) =>
  "<h3>Attaque(s) en cours</h3>" +
  attaques
    .map(
      (a) =>
        `- Vous allez attaquer <span class="gras"><a href="Membre.php?Pseudo=${a.cible}">${a.cible}</a></span> (Terrain de chasse) dans <span class="gras" id="attaque_${a.id}">1H</span><script>reste(${a.s}, "attaque_${a.id}");</script> - <a href="/ennemie.php?annuler=${a.id}">Annuler</a><br />`,
    )
    .join("");

type Capture = { id: number | null; terrainDepart: number; terrainCible: number };
const captures = () =>
  page.lire<Capture[]>(
    `AttaqueLancee.charger().map((a) => ({ id: a.id, terrainDepart: a.terrainDepart, terrainCible: a.terrainCible }))`,
  );

describe("multi-flood : plusieurs envois du même montant vers la même cible", () => {
  test("chaque envoi AJAX est lié à sa propre attaque, terrain enchaîné", () => {
    page.lire(`localStorage.clear()`);
    const lignes: { id: number; cible: string; s: number }[] = [];
    for (const id of [501, 502, 503]) {
      lignes.push({ id, cible: "Canaille", s: 3600 + id });
      page.lire(
        `AttaqueLancee.enregistrer("Canaille", "Terrain de chasse", { JSN: 5000 }, { html: ${JSON.stringify(reponse(lignes))}, terrain: 100000 })`,
      );
    }
    expect(captures()).toEqual([
      { id: 501, terrainDepart: 100000, terrainCible: 95000 },
      { id: 502, terrainDepart: 95000, terrainCible: 90000 },
      { id: 503, terrainDepart: 90000, terrainCible: 85000 },
    ]);
  });

  test("une autre attaque en cours (autre cible, id plus grand) ne prend pas la place", () => {
    page.lire(`localStorage.clear()`);
    page.lire(
      `AttaqueLancee.enregistrer("Canaille", "Terrain de chasse", { JSN: 5000 }, { html: ${JSON.stringify(
        reponse([
          { id: 601, cible: "Canaille", s: 4000 },
          { id: 650, cible: "Spike", s: 3000 },
        ]),
      )}, terrain: 100000 })`,
    );
    expect(captures().map((c) => c.id)).toEqual([601]);
  });
});

describe("envoi direct depuis le formulaire du jeu (page rechargée)", () => {
  test("captures sans numéro liées dans l'ordre d'envoi aux lignes de la cible", () => {
    page.lire(`localStorage.clear()`);
    // deux envois du même montant : capturés au submit, sans numéro
    page.lire(
      `AttaqueLancee.enregistrer("Canaille", "Terrain de chasse", { JSN: 5000 }, { terrain: 100000 })`,
    );
    page.lire(
      `AttaqueLancee.enregistrer("Canaille", "Terrain de chasse", { JSN: 5000 }, { terrain: 100000 })`,
    );
    expect(captures().map((c) => c.id)).toEqual([null, null]);
    const lignes = page.lire(
      `AttaqueLancee.extraireLignes(Utils.parseHtml(${JSON.stringify(
        reponse([
          { id: 700, cible: "Spike", s: 2000 },
          { id: 701, cible: "Canaille", s: 4000 },
          { id: 702, cible: "Canaille", s: 4001 },
        ]),
      )})).map((l) => ({ id: l.id, cible: l.cible, secondes: l.secondes }))`,
    );
    page.lire(
      `(() => { let liste = AttaqueLancee.charger(), lignes = AttaqueLancee.extraireLignes(Utils.parseHtml(${JSON.stringify(
        reponse([
          { id: 700, cible: "Spike", s: 2000 },
          { id: 701, cible: "Canaille", s: 4000 },
          { id: 702, cible: "Canaille", s: 4001 },
        ]),
      )})); AttaqueLancee.lier(liste, lignes); AttaqueLancee.sauvegarder(liste); })()`,
    );
    expect(lignes).toHaveLength(3);
    expect(captures()).toEqual([
      { id: 701, terrainDepart: 100000, terrainCible: 95000 },
      { id: 702, terrainDepart: 95000, terrainCible: 90000 },
    ]);
  });

  test("envoi refusé par le jeu : la capture orpheline ne vole pas une attaque plus ancienne déjà liée", () => {
    page.lire(`localStorage.clear()`);
    page.lire(
      `AttaqueLancee.enregistrer("Canaille", "Terrain de chasse", { JSN: 5000 }, { terrain: 100000 })`,
    );
    page.lire(
      `(() => { let liste = AttaqueLancee.charger(), lignes = AttaqueLancee.extraireLignes(Utils.parseHtml(${JSON.stringify(
        reponse([{ id: 801, cible: "Canaille", s: 4000 }]),
      )})); AttaqueLancee.lier(liste, lignes); AttaqueLancee.sauvegarder(liste); })()`,
    );
    // second envoi refusé (pas de nouvelle ligne) : reste sans numéro
    page.lire(
      `AttaqueLancee.enregistrer("Canaille", "Terrain de chasse", { JSN: 5000 }, { terrain: 100000 })`,
    );
    page.lire(
      `(() => { let liste = AttaqueLancee.charger(), lignes = AttaqueLancee.extraireLignes(Utils.parseHtml(${JSON.stringify(
        reponse([{ id: 801, cible: "Canaille", s: 3990 }]),
      )})); AttaqueLancee.lier(liste, lignes); AttaqueLancee.sauvegarder(liste); })()`,
    );
    expect(captures().map((c) => c.id)).toEqual([801, null]);
  });
});

describe("envoi refusé par le jeu entre deux floods réussis", () => {
  const vieillir = () =>
    page.lire(
      `localStorage.setItem("outiiil_attaquesLancees", JSON.stringify(AttaqueLancee.charger().map((a) => ({ ...a, lancee: a.lancee - 10000 }))))`,
    );
  const synchroniser = (lignes: { id: number; cible: string; s: number }[]) =>
    page.lire(
      `AttaqueLancee.synchroniser(AttaqueLancee.extraireLignes(Utils.parseHtml(${JSON.stringify(reponse(lignes))}))).map((a) => [a.id, a.terrainDepart, a.terrainCible])`,
    );

  test("la capture refusée est retirée et rend sa prise : le flood suivant repart du bon TdC", () => {
    page.lire(`localStorage.clear()`);
    page.lire(
      `AttaqueLancee.enregistrer("Canaille", "Terrain de chasse", { JSN: 5000 }, { terrain: 100000 })`,
    );
    synchroniser([{ id: 801, cible: "Canaille", s: 4000 }]);
    // envoi refusé : la page suivante ne montre pas de nouvelle attaque
    page.lire(
      `AttaqueLancee.enregistrer("Canaille", "Terrain de chasse", { JSN: 5000 }, { terrain: 100000 })`,
    );
    vieillir();
    expect(synchroniser([{ id: 801, cible: "Canaille", s: 3990 }])).toEqual([[801, 100000, 95000]]);
    page.lire(
      `AttaqueLancee.enregistrer("Canaille", "Terrain de chasse", { JSN: 5000 }, { terrain: 100000 })`,
    );
    expect(
      synchroniser([
        { id: 801, cible: "Canaille", s: 3980 },
        { id: 802, cible: "Canaille", s: 4100 },
      ]),
    ).toEqual([
      [801, 100000, 95000],
      [802, 95000, 90000],
    ]);
  });

  test("page relue peut-être hors du jeu (retirer = false) : la capture est gardée", () => {
    page.lire(`localStorage.clear()`);
    page.lire(
      `AttaqueLancee.enregistrer("Canaille", "Terrain de chasse", { JSN: 5000 }, { terrain: 100000 })`,
    );
    vieillir();
    expect(page.lire(`AttaqueLancee.synchroniser([], false).map((a) => a.id)`)).toEqual([null]);
  });
});
