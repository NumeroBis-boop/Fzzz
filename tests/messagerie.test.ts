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

describe("couleurs et copie de la messagerie", () => {
  const ligne = (titre: string) =>
    `<tr class='en_tete_message' id='conversation_1'><td class='td_coche'></td><td class='td_participants'>Fourmizzz</td><td class='td_objet'><a class='intitule_message'>${titre}</a></td></tr>`;
  const decorer = (reglages: Record<string, string>, titre: string) => {
    const p = creerPage(
      ["js/class/Utils.js", "js/page/MessagerieFzzz.js"],
      "var IMG_COPIER = 'copier.png';",
    );
    p.lire(
      `localStorage.clear(); Object.entries(${JSON.stringify(reglages)}).forEach(([k, v]) => localStorage.setItem(k, v));
       document.body.innerHTML = "<table>${ligne(titre).replace(/"/g, '\\"')}</table>";
       MessagerieFzzz.decorer();`,
    );
    return {
      classe: p.lire(`$(".intitule_message").attr("class")`) as string,
      copie: p.lire(`$(".o_copierRapport").length`) as number,
      variable: p.lire(
        `document.documentElement.style.getPropertyValue("--fzzz-msg-defense")`,
      ) as string,
    };
  };

  test("type de couleur : défense, attaque, autres", () => {
    expect(
      page.lire(`MessagerieFzzz.typeCouleur($(\`${ligne("Vol par Canaille : 13 349 cm²")}\`))`),
    ).toBe("defense");
    expect(
      page.lire(`MessagerieFzzz.typeCouleur($(\`${ligne("Butin chez Missyl : 2 111 cm²")}\`))`),
    ).toBe("attaque");
    expect(page.lire(`MessagerieFzzz.typeCouleur($(\`${ligne("Bienvenue")}\`))`)).toBe("autre");
  });

  test("couleurs coupées : l'icône de copie reste", () => {
    const r = decorer({ fzzz_affichage_messagerieCouleurs: "0" }, "Vol par Canaille");
    expect(r.copie).toBe(1);
    expect(r.classe).not.toContain("o_titreDefense");
  });

  test("copie coupée : les couleurs restent", () => {
    const r = decorer({ fzzz_affichage_messagerieCopie: "0" }, "Vol par Canaille");
    expect(r.copie).toBe(0);
    expect(r.classe).toContain("o_titreDefense");
    expect(r.variable).toBe("#b42318");
  });

  test("couleur choisie, ou couleur du jeu pour un type", () => {
    expect(decorer({ fzzz_couleurMessage_defense: "#123456" }, "Vol par Canaille").variable).toBe(
      "#123456",
    );
    expect(decorer({ fzzz_couleurMessage_autre: "" }, "Bienvenue").classe).not.toContain(
      "o_titreAutre",
    );
  });
});

describe("durée avec les secondes (temps de trajet)", () => {
  const utils = creerPage(["js/class/Utils.js"]);
  test("format « 8h 05m 03s », jours au-delà de 24 h", () => {
    expect(utils.lire("Utils.duree(8 * 3600 + 5 * 60 + 3)")).toBe("8h 05m 03s");
    expect(utils.lire("Utils.duree(90061)")).toBe("1J 1h 01m 01s");
  });
});
