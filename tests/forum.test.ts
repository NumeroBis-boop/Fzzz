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
