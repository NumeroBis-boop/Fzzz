import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

const page = creerPage(
  ["js/class/Utils.js", "js/page/PartageChasses.js"],
  `var Horloge = { serveur: () => moment("2026-10-29 10:00", "YYYY-MM-DD HH:mm"), maintenant: () => moment("2026-10-29 10:00", "YYYY-MM-DD HH:mm").valueOf() };
   var monProfil = { pseudo: "DoggyBag" };
   var ECRIT = null, LECTURES = 0;`,
);
const recaler = (anciennes: object[], groupes: object[]) =>
  page.lire(
    `PartageChasses.recalerListeChasses(${JSON.stringify(anciennes)}, ${JSON.stringify(groupes)}, "2026-10-29 10:00")`,
  );

describe("chasses annulées : ma section du sujet commun des chasses recalée", () => {
  const sujet = [
    { date: "2026-10-29 13:07", terrain: 30000 },
    { date: "2026-10-29 12:00", terrain: 10000 },
  ];
  test("rien d'annulé : rien à réécrire", () => {
    expect(
      recaler(sujet, [
        { debut: "2026-10-29 13:05", fin: "2026-10-29 13:07", terrain: 30000 },
        { debut: "2026-10-29 12:00", fin: "2026-10-29 12:00", terrain: 10000 },
      ]),
    ).toEqual({ lignes: sujet, change: false });
  });
  test("groupe entièrement annulé : retiré", () => {
    expect(
      recaler(sujet, [{ debut: "2026-10-29 13:05", fin: "2026-10-29 13:07", terrain: 30000 }]),
    ).toEqual({ lignes: [sujet[0]], change: true });
  });
  test("dernière chasse d'un groupe annulée : minute et TdC du reste du groupe", () => {
    expect(
      recaler(sujet, [
        { debut: "2026-10-29 13:05", fin: "2026-10-29 13:06", terrain: 20000 },
        { debut: "2026-10-29 12:00", fin: "2026-10-29 12:00", terrain: 10000 },
      ]),
    ).toEqual({
      lignes: [{ date: "2026-10-29 13:06", terrain: 20000 }, sujet[1]],
      change: true,
    });
  });
  test("tout annulé : ma section retirée, une chasse non partagée n'y entre pas", async () => {
    page.lire(`(() => {
      localStorage.clear(); ECRIT = null; LECTURES = 0;
      $.toast = () => {};
      window.TEXTE = ["Autres membres :", "--- DoggyBag · 2026-10-29 09:00:00 ---", "29/10/26 13:07 | 30 000 cm²", "29/10/26 12:00 | 10 000 cm²"].join("\\n");
      PartageChasses.sujets = () => Promise.resolve({ communs: { Chasses: { type: "Chasses", id: "11" } }, historiques: [] });
      PartageChasses._attendre = () => Promise.resolve();
      PartageChasses._texteSujet = () => { LECTURES++; return Promise.resolve(TEXTE); };
      PartageChasses._xajax = (f, q) => { ECRIT = TEXTE = decodeURIComponent(/message=([^&]*)/.exec(q)[1]); return Promise.resolve(""); };
    })()`);
    await page.lire(
      `PartageChasses.recalerChasses([{ debut: "2026-10-29 15:00", fin: "2026-10-29 15:00", terrain: 999 }])`,
    );
    // le texte écrit à la main avant les sections reste
    expect(page.lire("ECRIT")).toBe("Autres membres :");
    // plus rien à venir dans ma section : le forum n'est plus relu
    const lues = page.lire<number>("LECTURES");
    await page.lire(`PartageChasses.recalerChasses([])`);
    expect(page.lire("LECTURES")).toBe(lues);
  });
});
