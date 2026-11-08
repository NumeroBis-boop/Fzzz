import { beforeEach, describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Boîtes d'outils (boite/Boite.js : Chasse, Combat, Préférences…) : elles
 * restent dans la fenêtre, leur contenu défile à l'intérieur, et elles se
 * déplacent par leur titre ou par leurs bords. La mise en page réelle est
 * vérifiée dans Chromium (glisser par un bord, défilement) ; ici, la structure
 * et le recalage, avec des mesures simulées.
 */
const page = creerPage(
  ["js/class/Utils.js", "js/boite/Boite.js"],
  `var monProfil = { parametre: { couleur1: { valeur: "#d7c384" }, couleur2: { valeur: "#c4ad65" }, couleur3: { valeur: "#7a6a3a" }, couleurTitre: { valeur: "#000" }, couleurTexte: { valeur: "#000" } } };`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);

beforeEach(() =>
  lire(`(() => {
    document.body.innerHTML = "";
    window.OPTIONS_DEPLACEMENT = null;
    // jQuery UI n'est pas chargé ici : déplacement noté, pas exécuté
    $.fn.draggable = function (o) { OPTIONS_DEPLACEMENT = o; return this; };
    window.innerWidth = 1024; window.innerHeight = 768;
  })()`),
);

describe("boîte d'outils", () => {
  test("bords, titre, croix et contenu défilant ; déplaçable par le titre et par les bords", () => {
    lire(`new Boite("o_boiteEssai", "Essai", "<p id='o_dedans'>contenu</p>").afficher()`);
    expect(lire(`$("#o_boiteEssai > .o_bord").map((i, e) => e.className).get()`)).toEqual([
      "o_bord o_bordHaut",
      "o_bord o_bordBas",
      "o_bord o_bordGauche",
      "o_bord o_bordDroite",
    ]);
    expect(lire(`$("#o_boiteEssai > .o_titre").text()`)).toBe("Essai");
    expect(lire(`$("#o_boiteEssaiClose").length`)).toBe(1);
    expect(lire(`$("#o_boiteEssai > .o_corps > #o_dedans").length`)).toBe(1);
    expect(lire(`OPTIONS_DEPLACEMENT.handle`)).toBe(".o_titre, .o_bord");
    expect(lire(`OPTIONS_DEPLACEMENT.containment`)).toBe("window");
    // recalée à la fin d'un déplacement (sous l'horloge, dans la fenêtre)
    expect(lire(`typeof OPTIONS_DEPLACEMENT.stop`)).toBe("function");
  });

  test("contenu limité à la hauteur de la fenêtre (titre et marges déduits)", () => {
    lire(`new Boite("o_boiteEssai", "Essai", "<p>contenu</p>").afficher()`);
    lire(`(() => {
      const $b = $("#o_boiteEssai");
      // boîte de 900 px de haut, dont 820 px de contenu : 80 px de titre et de bords
      $b.outerHeight = () => 900;
      $b.children(".o_corps").outerHeight = () => 820;
      $b.children = ((f) => function (sel) { const r = f.call(this, sel); if (sel == ".o_corps") r.outerHeight = () => 820; return r; })($b.children);
      Boite.ajuster($b);
    })()`);
    // 768 − 2 × 8 (marges) − 80 (titre et bords)
    expect(lire(`$("#o_boiteEssai .o_corps")[0].style.maxHeight`)).toBe("672px");
  });

  test("boîte sortie de la fenêtre (en haut et à droite) : replacée dedans, titre visible", () => {
    lire(`new Boite("o_boiteEssai", "Essai", "<p>contenu</p>").afficher()`);
    lire(`(() => {
      const $b = $("#o_boiteEssai");
      $b[0].getBoundingClientRect = () => ({ top: -200, left: 900, width: 400, height: 300, bottom: 100, right: 1300 });
      Boite.ajuster($b);
    })()`);
    expect(lire(`$("#o_boiteEssai").css("top")`)).toBe("8px");
    // 1 024 − 400 − 8
    expect(lire(`$("#o_boiteEssai").css("left")`)).toBe("616px");
  });

  test("horloge de l'extension en haut, au-dessus des boîtes : le titre reste sous elle", () => {
    lire(`new Boite("o_boiteEssai", "Essai", "<p>contenu</p>").afficher()`);
    lire(`(() => {
      document.body.insertAdjacentHTML("beforeend", "<div id='o_horloge'>12:00</div>");
      const h = document.getElementById("o_horloge");
      h.getBoundingClientRect = () => ({ top: 4, left: 15, width: 280, height: 40, bottom: 44, right: 295 });
      const $b = $("#o_boiteEssai");
      $b[0].getBoundingClientRect = () => ({ top: 8, left: 10, width: 370, height: 300, bottom: 308, right: 380 });
      Boite.ajuster($b);
    })()`);
    // 44 (bas de l'horloge) + 8
    expect(lire(`$("#o_boiteEssai").css("top")`)).toBe("52px");
  });

  test("boîte déjà dans la fenêtre : pas déplacée", () => {
    lire(`new Boite("o_boiteEssai", "Essai", "<p>contenu</p>").afficher()`);
    lire(`(() => {
      const $b = $("#o_boiteEssai").css({ top: "120px", left: "200px" });
      $b[0].getBoundingClientRect = () => ({ top: 120, left: 200, width: 400, height: 300, bottom: 420, right: 600 });
      Boite.ajuster($b);
    })()`);
    expect(lire(`[$("#o_boiteEssai").css("top"), $("#o_boiteEssai").css("left")]`)).toEqual([
      "120px",
      "200px",
    ]);
  });
});
