import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

const page = creerPage(["js/page/MessagerieFzzz.js"]);

function categorie(titre: string, participants = "Fourmizzz"): string | null {
  return page.lire(
    `(MessagerieFzzz.categorie($("<tr><td class='td_participants'>${participants}</td><td><a class='intitule_message'>${titre}</a></td></tr>")) || {}).nom || null`,
  );
}

describe("catégorie des messages", () => {
  test("invasion du terrain de chasse : RC de combat, pas de chasse", () => {
    expect(
      categorie("Invasion de Canaille : votre armée a été vaincue sur le Terrain de chasse"),
    ).toBe("combat");
  });
  test("rapports courants", () => {
    expect(categorie("Vos chasseuses ont conquis 16 278 cm² en 2 expéditions")).toBe("chasse");
    expect(categorie("Chasse réussie : vos chasseuses ont conquis 15 367 cm²")).toBe("chasse");
    expect(categorie("Vol par Canaille : 13 349 cm²")).toBe("combat");
    expect(categorie("Butin chez Missyl : 2 111 cm²")).toBe("combat");
    expect(categorie("Convoi reçu de Maddog : 1 915 113")).toBe("convoi");
    expect(categorie("Salut", "Issras [SDF], Moi")).toBe("conversation");
  });
});

describe("durée avec les secondes (temps de trajet)", () => {
  const utils = creerPage(["js/class/Utils.js"]);
  test("format « 8h 05m 03s », jours au-delà de 24 h", () => {
    expect(utils.lire("Utils.duree(8 * 3600 + 5 * 60 + 3)")).toBe("8h 05m 03s");
    expect(utils.lire("Utils.duree(90061)")).toBe("1J 1h 01m 01s");
  });
});
