import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

const page = creerPage(
  ["js/class/Utils.js", "js/class/AttaqueLancee.js"],
  `var CLE_FIN_CHASSES_PARTAGEES = "fzzz_finChassesPartagees";
   var monProfil = { pseudo: "DoggyBag" };
   var Horloge = { serveur: () => moment("2026-11-01 10:00", "YYYY-MM-DD HH:mm"), maintenant: () => moment("2026-11-01 10:00", "YYYY-MM-DD HH:mm").valueOf() };
   var LECTURES = 0, CHASSES = [];
   var PartageChasses = {
     enFile: (f) => f(),
     sujets: () => { LECTURES++; return Promise.resolve({ "Chasses | doggybag": 7 }); },
     lireSujet: () => Promise.resolve({ chasses: CHASSES, floods: [] }),
   };`,
);

const lire = (repere: string | null, chasses: object[]) =>
  page.lire<Promise<{ dates: string[]; lectures: number; repere: string }>>(`(() => {
    localStorage.clear(); LECTURES = 0; CHASSES = ${JSON.stringify(chasses)};
    ${repere == null ? "" : `localStorage.setItem("fzzz_finChassesPartagees", ${JSON.stringify(repere)});`}
    return AttaqueLancee.chassesPartagees().then((c) => ({
      dates: c.map((x) => x.date), lectures: LECTURES, repere: localStorage.getItem("fzzz_finChassesPartagees"),
    }));
  })()`);

describe("chasses partagées dans « Mes attaques en cours »", () => {
  test("aucune chasse partagée à venir (repère « - » ou passé) : aucune requête", async () => {
    expect((await lire("-", [])).lectures).toBe(0);
    expect((await lire("2026-11-01 09:59", [])).lectures).toBe(0);
  });

  test("chasses à venir lues dans le forum, passées masquées, triées ; repère mis à jour", async () => {
    const r = await lire("2026-11-01 12:00", [
      { date: "2026-11-01 12:00", terrain: 500 },
      { date: "2026-11-01 09:00", terrain: 100 },
      { date: "2026-11-01 11:00", terrain: 300 },
    ]);
    expect(r).toEqual({
      dates: ["2026-11-01 11:00", "2026-11-01 12:00"],
      lectures: 1,
      repere: "2026-11-01 12:00",
    });
  });

  test("insérées à leur place parmi les floods, numérotées, compteur du titre", () => {
    const r = page.lire<{ lignes: string[]; titre: string }>(`(() => {
      let t = (h, m) => moment("2026-11-01 " + h + ":" + m, "YYYY-MM-DD HH:mm").valueOf(),
        $bloc = $('<div><span class="o_attaquesCompte">(2)</span><table class="o_attaquesLancees"><tbody>' +
          '<tr data-arrivee="' + (t("10", "30") + 15000) + '"><td>1</td><td>flood A</td></tr>' +
          '<tr data-arrivee="' + (t("11", "30") + 15000) + '"><td>2</td><td>flood B</td></tr></tbody></table></div>');
      AttaqueLancee.insererChasses($bloc, [{ date: "2026-11-01 11:00", terrain: 300 }, { date: "2026-11-01 12:00", terrain: 500 }], 2);
      return {
        lignes: $bloc.find("tbody tr").map((i, tr) => tr.cells[0].textContent + " " + tr.cells[1].textContent).get(),
        titre: $bloc.find(".o_attaquesCompte").text(),
      };
    })()`);
    expect(r.lignes).toEqual(["1 flood A", "2 01/11 11h00", "3 flood B", "4 01/11 12h00"]);
    expect(r.titre).toBe("(2 + 2 chasses)");
  });
});
