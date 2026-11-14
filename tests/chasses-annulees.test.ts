import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";
import { FORUM_SIMULE } from "./forum-simule";

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

describe("chasses annulées : ma réponse du sujet commun des chasses recalée", () => {
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
  test("tout annulé : ma réponse vidée, une chasse non partagée n'y entre pas", async () => {
    page.lire(FORUM_SIMULE);
    page.lire(`(() => {
      localStorage.clear(); ECRIT = null; LECTURES = 0;
      $.toast = () => {};
      window.TEXTE = ["29/10/26 13:07 | 30 000 cm²", "29/10/26 12:00 | 10 000 cm²"].join("\\n");
      const sujet = () => ({ id: "11", titre: "BDD générale chasse", texte: "", reponses: [{ id: 700, auteur: "DoggyBag", texte: TEXTE }] });
      PartageChasses._html = (d) => d;
      PartageChasses.sujets = () => Promise.resolve({ communs: { Chasses: { type: "Chasses", id: "11" } }, historiques: [] });
      PartageChasses._lireSujet = () => { LECTURES++; return Promise.resolve(SIM.html(sujet(), "DoggyBag")); };
      PartageChasses._xajax = (f, q) => { ECRIT = TEXTE = SIM.q(q, "message"); return Promise.resolve(SIM.html(sujet(), "DoggyBag")); };
    })()`);
    await page.lire(
      `PartageChasses.recalerChasses([{ debut: "2026-10-29 15:00", fin: "2026-10-29 15:00", terrain: 999 }])`,
    );
    expect(page.lire("ECRIT")).toBe("Aucune chasse en cours.");
    // plus rien à venir dans ma réponse : le forum n'est plus relu
    const lues = page.lire<number>("LECTURES");
    await page.lire(`PartageChasses.recalerChasses([])`);
    expect(page.lire("LECTURES")).toBe(lues);
  });
});
