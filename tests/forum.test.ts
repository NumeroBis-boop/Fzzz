import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

const page = creerPage(["js/class/Utils.js", "js/page/PartageChasses.js"]);

/** Lit un sujet dont le premier message est `html`, sans requête. */
function lireSujet(html: string) {
  page.lire(`PartageChasses._xajax = () => Promise.resolve(null);
    PartageChasses._html = () => ${JSON.stringify(html)};`);
  return page.lire(`PartageChasses.lireSujet(1).then((r) => JSON.stringify(r))`).then(JSON.parse);
}

describe("PartageChasses.lireSujet", () => {
  test("format actuel : chasses et floods complets", async () => {
    const r = await lireSujet(
      "01/12/26 10:00 | 777 cm²<br>26/12/26 02:46 | DoggyBag | 3 000 unités | 3 000 cm² | TdC 19 095 | #50",
    );
    expect(r.chasses).toEqual([{ date: "2026-12-01 10:00", terrain: 777 }]);
    expect(r.floods).toEqual([
      {
        date: "2026-12-26 02:46",
        cible: "DoggyBag",
        unites: 3000,
        terrain: 3000,
        tdcCible: 19095,
        id: 50,
      },
    ]);
  });

  test("corrections à la main tolérées : 02h46, année sur 4 chiffres, sans unités", async () => {
    const r = await lireSujet("6/1/2027 02h46 | Bob | 1 200 cm²");
    expect(r.floods).toEqual([
      {
        date: "2027-01-06 02:46",
        cible: "Bob",
        unites: null,
        terrain: 1200,
        tdcCible: null,
        id: null,
      },
    ]);
  });

  test("anciens codes FZC / FZF lus si aucune ligne au format actuel", async () => {
    const r = await lireSujet("FZC|2026-11-01 05:00|500|<br>FZF|2026-11-02 06:00|Calme|42|");
    expect(r.chasses).toEqual([{ date: "2026-11-01 05:00", terrain: 500 }]);
    expect(r.floods).toEqual([{ date: "2026-11-02 06:00", cible: "Calme", terrain: 42 }]);
  });

  test("une balise écrite dans le forum ne survit pas dans la cible", async () => {
    const r = await lireSujet(
      "27/12/26 03:00 | &lt;img src=x onerror=&quot;a()&quot;&gt; | 1 unités | 1 cm²",
    );
    expect(r.floods[0].cible).not.toMatch(/[<>"'&]/);
  });
});

describe("partages de floods entre appareils", () => {
  test("le forum fait foi : publiés ailleurs → partagés, retirés ailleurs → à partager", () => {
    page.lire(
      `localStorage.setItem("fzzz_floodsPartages", JSON.stringify({ 11: Date.now(), 12: Date.now() }))`,
    );
    // forum : 12 et 13 publiés (13 depuis l'autre appareil) ; 11 retiré ailleurs
    page.lire(`PartageChasses.recalerFloods([12, 13], [11, 12, 13])`);
    const etat = page.lire<string>(`Object.keys(PartageChasses.floodsPartages()).sort().join(",")`);
    expect(etat).toBe("12,13");
  });
  test("attaques non affichées : leur état n'est pas touché", () => {
    page.lire(`localStorage.setItem("fzzz_floodsPartages", JSON.stringify({ 50: Date.now() }))`);
    page.lire(`PartageChasses.recalerFloods([], [11])`);
    expect(page.lire<string>(`Object.keys(PartageChasses.floodsPartages()).join(",")`)).toBe("50");
  });
});

describe("section cachée du forum", () => {
  test("nouveau nom reconnu, et créé par l'extension", () => {
    expect(page.lire(`PartageChasses.estSection(" BDD partagée  cachée ")`)).toBe(true);
    expect(page.lire(`PartageChasses.estSection("bdd partagée cachée")`)).toBe(true);
    expect(page.lire(`FORUM_SECTIONS_CHASSES[0]`)).toBe("BDD partagée cachée");
  });
  test("anciens noms toujours reconnus, autres sections non", () => {
    expect(page.lire(`PartageChasses.estSection("Fzzz-Chasses")`)).toBe(true);
    expect(page.lire(`PartageChasses.estSection("Fzzz_Chasses")`)).toBe(true);
    expect(page.lire(`PartageChasses.estSection("Discussions")`)).toBe(false);
  });
});

describe("retrait automatique des floods disparus de la liste", () => {
  // sujet « Floods | Moi » : un flood à venir (#20) et un arrivé (#21)
  const sujet = (ecrits: string[]) => {
    page.lire(`var ECRITS = []; var monProfil = { pseudo: "Moi" };
      var Horloge = { serveur: () => moment("2026-11-03 12:00", "YYYY-MM-DD HH:mm"), maintenant: () => moment("2026-11-03 12:00", "YYYY-MM-DD HH:mm").valueOf() };
      var AttaqueLancee = { majPartages() {} };
      $.toast = () => {}; var TOAST_SUCCESS = {}, TOAST_ERROR = {}, TOAST_INFO = {};
      PartageChasses.sujets = () => Promise.resolve({ "Floods | moi": 5 });
      PartageChasses._xajax = (fn, q) => { if (fn == "envoiEditTopic") ECRITS.push(decodeURIComponent(q)); return Promise.resolve(); };
      PartageChasses.lireSujet = () => Promise.resolve({ chasses: [], floods: [
        { date: "2026-11-03 18:00", cible: "A", terrain: 100, id: 20 },
        { date: "2026-11-03 10:00", cible: "B", terrain: 100, id: 21 },
      ] });`);
    return ecrits;
  };
  test("flood à venir annulé : retiré du sujet", async () => {
    sujet([]);
    await page.lire(`PartageChasses.retirerFloods([20], null, true)`);
    const ecrits = page.lire<string[]>("ECRITS");
    expect(ecrits).toHaveLength(1);
    expect(ecrits[0]).not.toContain("#20");
  });
  test("aucun de ces floods dans le sujet : rien n'est écrit", async () => {
    sujet([]);
    await page.lire(`PartageChasses.retirerFloods([99], null, true)`);
    expect(page.lire<string[]>("ECRITS")).toHaveLength(0);
  });
});

describe("retraits repris après une page quittée trop tôt", () => {
  const preparer = (ecritureOk: boolean) =>
    page.lire(`var ECRITS = []; var monProfil = { pseudo: "Moi" };
      var Horloge = { serveur: () => moment("2026-11-03 12:00", "YYYY-MM-DD HH:mm"), maintenant: () => moment("2026-11-03 12:00", "YYYY-MM-DD HH:mm").valueOf() };
      var PARTAGES_REPRIS = 0;
      var AttaqueLancee = { majPartages() {}, partagerMarquees() { PARTAGES_REPRIS++; return Promise.resolve(); } };
      $.toast = () => {}; var TOAST_SUCCESS = {}, TOAST_ERROR = {}, TOAST_INFO = {};
      PartageChasses.sujets = () => Promise.resolve({ "Floods | moi": 5 });
      PartageChasses._xajax = (fn, q) => {
        if (fn != "envoiEditTopic") return Promise.resolve();
        if (!${ecritureOk}) return Promise.reject(new Error("réseau"));
        ECRITS.push(decodeURIComponent(q)); return Promise.resolve();
      };
      PartageChasses.lireSujet = () => Promise.resolve({ chasses: [], floods: [
        { date: "2026-11-03 18:00", cible: "A", terrain: 100, id: 20 } ] });
      localStorage.removeItem("fzzz_floodsARetirer");`);
  const enAttente = () => page.lire<number[]>(`Utils.lireStockage("fzzz_floodsARetirer", [])`);

  test("noté avant l'écriture, effacé une fois le forum modifié", async () => {
    preparer(true);
    const fin = page.lire(`PartageChasses.retirerFloods([20], null, true)`);
    expect(enAttente()).toEqual([20]);
    await fin;
    expect(enAttente()).toEqual([]);
  });
  test("écriture échouée : gardé, puis repris au chargement d'une autre page", async () => {
    preparer(false);
    await page.lire(`PartageChasses.retirerFloods([20], null, true)`);
    expect(enAttente()).toEqual([20]);
    preparer(true);
    page.lire(`localStorage.setItem("fzzz_floodsARetirer", "[20]")`);
    await page.lire(`PartageChasses.reprendre()`);
    expect(page.lire<string[]>("ECRITS")).toHaveLength(1);
    expect(enAttente()).toEqual([]);
    expect(page.lire("PARTAGES_REPRIS")).toBe(1);
  });
});

describe("attaques en dôme ou en loge partagées", () => {
  const page2 = creerPage(
    ["js/class/Utils.js", "js/class/AttaqueLancee.js", "js/page/PartageChasses.js"],
    `var Horloge = { serveur: () => moment("2026-11-04 12:00", "YYYY-MM-DD HH:mm"), maintenant: () => moment("2026-11-04 12:00", "YYYY-MM-DD HH:mm").valueOf() };`,
  );
  test("ligne sans « cm² », relue avec sa zone, sans TdC pris", async () => {
    const ligne = page2.lire<string>(
      `PartageChasses._ligne("Floods", { date: "2026-11-04 21:30", cible: "Spike", unites: 20000, terrain: 0, tdcCible: 93059, id: 77, lieu: "Loge" })`,
    );
    expect(ligne).toBe("04/11/26 21:30 | Spike | Loge | 20 000 unités | TdC 93 059 | #77");
    page2.lire(`PartageChasses._xajax = () => Promise.resolve(null);
      PartageChasses._html = () => ${JSON.stringify(
        ligne +
          "<br>04/11/26 21:40 | Spike | Dôme | 1 unités<br>04/11/26 22:00 | Spike | 3 000 unités | 3 000 cm² | #78<br>05/11/26 08:00 | 500 cm²",
      )};`);
    const r = await page2
      .lire<Promise<string>>(`PartageChasses.lireSujet(1).then((r) => JSON.stringify(r))`)
      .then(JSON.parse);
    expect(r.chasses).toEqual([{ date: "2026-11-05 08:00", terrain: 500 }]);
    expect(
      r.floods.map((f: { lieu?: string; id: number | null; terrain: number }) => [
        f.lieu || "TdC",
        f.id,
        f.terrain,
      ]),
    ).toEqual([
      ["TdC", 78, 3000],
      ["Loge", 77, 0],
      ["Dôme", null, 0],
    ]);
    const sim = page2.lire<{ evenements: { lieu?: string; prise: number; statut: string }[] }>(
      `PartageChasses.simuler({ chasses: {}, floods: ${JSON.stringify(r.floods.map((f: object) => ({ ...f, lanceur: "Moi" })))} }, { Moi: 50000, Spike: 93059 })`,
    );
    expect(sim.evenements.map((e) => [e.lieu || "TdC", e.prise, e.statut])).toEqual([
      ["Loge", 0, "lieu"],
      ["Dôme", 0, "lieu"],
      ["TdC", 3000, "ok"],
    ]);
  });
  test("ancienne lecture (regex des floods au terrain) : ligne de zone ignorée", () => {
    // reF des versions sans zones : « date | cible | [unités |] N cm² … »
    const ancien =
      /(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2})[:hH](\d{2})\s*\|\s*([^|\n]+?)\s*\|\s*(?:(\d[\d   .]*)\s*unit[ée]s?\s*\|\s*)?(\d[\d   .]*)\s*cm/;
    expect(ancien.test("04/11/26 21:30 | Spike | Loge | 20 000 unités | TdC 93 059 | #77")).toBe(
      false,
    );
  });
  test("partage d'une capture en loge : zone, unités, aucun TdC", () => {
    const entrees = page2.lire(`(() => {
      let notees = null;
      Utils.minuteRC = (m) => m;
      PartageChasses._avecBouton = (b, type, e) => (notees = e);
      PartageChasses._partagerFloods([
        { id: 77, cible: "Spike", lieu: "Loge Impériale", arrivee: moment("2026-11-04 21:30", "YYYY-MM-DD HH:mm").valueOf(), unite: { "Jeune Soldate Naine": 20000 }, terrainConnu: 93059 },
        { id: 78, cible: "Spike", lieu: "Fourmilière", arrivee: moment("2026-11-04 21:31", "YYYY-MM-DD HH:mm").valueOf(), unite: {} },
      ], null);
      return notees;
    })()`);
    expect(entrees).toEqual([
      {
        date: "2026-11-04 21:30",
        cible: "Spike",
        unites: 20000,
        terrain: 0,
        tdcCible: 93059,
        id: 77,
        lieu: "Loge",
      },
    ]);
  });
  test("capture en loge : le TdC estimé de la cible ne baisse pas", () => {
    expect(
      page2.lire(`[
        AttaqueLancee.estimerTerrain({ lieu: "Loge Impériale", unite: { a: 5000 } }, 10000),
        AttaqueLancee.estimerTerrain({ lieu: "Fourmilière", unite: { a: 5000 } }, 10000),
        AttaqueLancee.estimerTerrain({ lieu: "Terrain de Chasse", unite: { a: 5000 } }, 10000),
      ]`),
    ).toEqual([10000, 10000, 8000]);
  });
});
