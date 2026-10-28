import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

const page = creerPage(
  ["js/class/Utils.js", "js/page/PartageChasses.js"],
  `var Horloge = { serveur: () => moment("2026-10-29 10:00", "YYYY-MM-DD HH:mm") };
   var monProfil = { pseudo: "DoggyBag" };
   var ECRIT = null, LECTURES = 0;`,
);
const recaler = (anciennes: object[], groupes: object[]) =>
  page.lire(
    `PartageChasses.recalerListeChasses(${JSON.stringify(anciennes)}, ${JSON.stringify(groupes)}, "2026-10-29 10:00")`,
  );

describe("chasses annulées : sujet « Chasses » recalé", () => {
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
  test("tout annulé : sujet vidé, une chasse non partagée n'y entre pas", async () => {
    page.lire(`localStorage.clear(); ECRIT = null; LECTURES = 0;
      $.toast = () => {};
      PartageChasses.sujets = () => Promise.resolve({ "Chasses | doggybag": 42 });
      PartageChasses.lireSujet = () => { LECTURES++; return Promise.resolve({ chasses: ${JSON.stringify(sujet)}, floods: [] }); };
      PartageChasses._xajax = (f, q) => { ECRIT = decodeURIComponent(q); return Promise.resolve(""); };`);
    await page.lire(
      `PartageChasses.recalerChasses([{ debut: "2026-10-29 15:00", fin: "2026-10-29 15:00", terrain: 999 }])`,
    );
    expect(page.lire("ECRIT")).toContain("Aucune chasse en cours.");
    expect(page.lire("ECRIT")).not.toContain("999");
    // plus rien à venir dans le sujet : le forum n'est plus relu
    await page.lire(`PartageChasses.recalerChasses([])`);
    expect(page.lire("LECTURES")).toBe(1);
  });
});
