import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * « à portée le … » après le pseudo, dans l'info-bulle de la page Membres et
 * sur la page d'un membre (1.99.0, demande du mainteneur) : quand je peux le
 * flooder (Utils.aPortee de son TdC face au mien, de la moitié au triple − 1),
 * d'après les mouvements partagés à venir, les siens et les miens ; l'état est
 * pris à la fin de chaque minute. Joueurs inventés.
 */
const page = creerPage(
  ["js/class/Utils.js", "js/page/PartageChasses.js"],
  `var Horloge = { maintenant: () => 0, serveur: () => moment("2026-11-09 10:00", "YYYY-MM-DD HH:mm") };
   var monProfil = { pseudo: "Moi" };`,
);

const flood = (id: number, date: string, lanceur: string, cible: string, unites: number) => ({
  id,
  date: `2026-11-09 ${date}`,
  lanceur,
  cible,
  unites,
  terrain: unites,
  tdcCible: null,
});
// moi : 100 000 cm², donc à portée de 50 000 à 299 999 cm²
function portee(cible: number, floods: object[] = [], chasses: object = {}, moi = 100000) {
  return page.lire(`(() => {
    let connus = { Moi: ${moi}, Cible: ${cible}, Alpha: 200000, Beta: 200000 },
      sim = PartageChasses.simuler(${JSON.stringify({ floods, chasses })}, connus, moment("2026-11-09 10:00", "YYYY-MM-DD HH:mm"));
    return PartageChasses.portee(sim, "Cible", ${cible}, ${moi});
  })()`);
}

describe("quand je peux le flooder", () => {
  test("hors portée maintenant : heure où il y entre", () => {
    expect(portee(320000, [flood(1, "11:00", "Alpha", "Cible", 30000)])).toEqual({
      deja: false,
      date: "2026-11-09 11:00",
    });
  });

  test("état à la fin de la minute : un instant à portée entre deux floods ne compte pas", () => {
    expect(
      portee(300000, [
        flood(1, "11:00", "Alpha", "Cible", 10000),
        flood(2, "11:00", "Cible", "Beta", 20000),
        flood(3, "12:00", "Alpha", "Cible", 20000),
      ]),
    ).toEqual({ deja: false, date: "2026-11-09 12:00" });
  });

  test("déjà à portée : heure où il en sort, sinon aucune", () => {
    expect(portee(290000, [flood(1, "11:00", "Cible", "Beta", 20000)])).toEqual({
      deja: true,
      date: "2026-11-09 11:00",
    });
    expect(portee(150000)).toEqual({ deja: true, date: null });
    // bornes : la moitié comprise, le triple − 1 compris
    expect(portee(50000)).toEqual({ deja: true, date: null });
    expect(portee(299999)).toEqual({ deja: true, date: null });
  });

  test("jamais à portée d'après les mouvements connus", () => {
    expect(portee(300000)).toEqual({ deja: false, date: null });
    expect(portee(400000, [flood(1, "11:00", "Alpha", "Cible", 10000)])).toEqual({
      deja: false,
      date: null,
    });
  });

  test("mon TdC compte aussi : flooder, je sors de ma portée ; floodé, j'y entre", () => {
    // un flood reçu me fait descendre à 80 000 : 40 000 est alors à portée
    expect(portee(40000, [flood(1, "11:00", "Alpha", "Moi", 20000)])).toEqual({
      deja: false,
      date: "2026-11-09 11:00",
    });
    // ma chasse me fait monter à 120 000 : 55 000 n'est plus à portée
    expect(portee(55000, [], { moi: [{ date: "2026-11-09 11:30", terrain: 20000 }] })).toEqual({
      deja: true,
      date: "2026-11-09 11:30",
    });
  });

  test("moi-même ou TdC inconnu : pas de mention", () => {
    expect(
      page.lire(`(() => {
        let sim = PartageChasses.simuler({ floods: [], chasses: {} }, {});
        return [PartageChasses.portee(sim, "moi", 100000, 100000), PartageChasses.portee(sim, "Cible", 0, 100000), PartageChasses.portee(sim, "Cible", 100000, 0)];
      })()`),
    ).toEqual([null, null, null]);
  });
});

describe("mention après le pseudo, l'heure mise en évidence", () => {
  const mention = (p: object | null) =>
    page.lire<string>(`PartageChasses.mentionPortee(${JSON.stringify(p)})`);
  test("quatre formes", () => {
    expect(mention({ deja: false, date: "2026-11-10 12:45" })).toBe(
      " <span class='o_portee'>à portée le <span class='o_porteeHeure'>10/11 à 12h45</span></span>",
    );
    expect(mention({ deja: true, date: "2026-11-10 11:33" })).toBe(
      " <span class='o_portee'>déjà à portée jusqu'au <span class='o_porteeHeure'>10/11 à 11h33</span></span>",
    );
    expect(mention({ deja: true, date: null })).toBe(
      " <span class='o_portee'>déjà à portée</span>",
    );
    expect(mention({ deja: false, date: null })).toBe(
      " <span class='o_portee'>hors de portée</span>",
    );
    expect(mention(null)).toBe("");
  });
});
