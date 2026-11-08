import { beforeEach, describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Boîtes d'outils (boite/Boite.js : Chasse, Combat, Préférences…) : elles
 * restent dans la fenêtre, leur contenu défile à l'intérieur ; elles se
 * déplacent par leur titre et se redimensionnent par leurs bords et leurs
 * coins, comme une fenêtre. La mise en page réelle est vérifiée dans Chromium
 * (tirer un bord, défilement) ; ici, la structure, les calculs et le
 * recalage, avec des mesures simulées.
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
    localStorage.clear();
  })()`),
);
// cadre d'une boîte (getBoundingClientRect simulé)
const cadre = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});

describe("boîte d'outils", () => {
  test("bords, coins, titre, croix et contenu défilant ; déplaçable par le titre seul", () => {
    lire(`new Boite("o_boiteEssai", "Essai", "<p id='o_dedans'>contenu</p>").afficher()`);
    expect(
      lire(`$("#o_boiteEssai > .o_bord").map((i, e) => e.className + " " + e.dataset.sens).get()`),
    ).toEqual([
      "o_bord o_bordHaut n",
      "o_bord o_bordBas s",
      "o_bord o_bordGauche w",
      "o_bord o_bordDroite e",
      "o_bord o_bordHautGauche nw",
      "o_bord o_bordHautDroite ne",
      "o_bord o_bordBasGauche sw",
      "o_bord o_bordBasDroite se",
    ]);
    expect(lire(`$("#o_boiteEssai > .o_titre").text()`)).toBe("Essai");
    expect(lire(`$("#o_boiteEssaiClose").length`)).toBe(1);
    expect(lire(`$("#o_boiteEssai > .o_corps > #o_dedans").length`)).toBe(1);
    // les bords redimensionnent : seul le titre déplace
    expect(lire(`OPTIONS_DEPLACEMENT.handle`)).toBe(".o_titre");
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

  test("tirer une poignée : le bord opposé ne bouge pas, taille lisible, boîte dans la fenêtre", () => {
    const tirer = (sens: string, dx: number, dy: number) =>
      lire(
        `Boite.cadreRedimensionne("${sens}", ${JSON.stringify(cadre(200, 100, 500, 400))}, ${dx}, ${dy}, 1024, 768)`,
      );
    expect(tirer("e", 100, 50)).toEqual({ left: 200, top: 100, width: 600, height: 400 });
    expect(tirer("s", 100, 50)).toEqual({ left: 200, top: 100, width: 500, height: 450 });
    // bord gauche ou haut : le bord droit ou bas reste en place
    expect(tirer("w", -50, 0)).toEqual({ left: 150, top: 100, width: 550, height: 400 });
    expect(tirer("n", 0, 60)).toEqual({ left: 200, top: 160, width: 500, height: 340 });
    expect(tirer("se", 30, 40)).toEqual({ left: 200, top: 100, width: 530, height: 440 });
    expect(tirer("nw", 20, 10)).toEqual({ left: 220, top: 110, width: 480, height: 390 });
    // trop petite : 280 × 180 au moins
    expect(tirer("se", -1000, -1000)).toEqual({ left: 200, top: 100, width: 280, height: 180 });
    expect(tirer("nw", 1000, 1000)).toEqual({ left: 420, top: 320, width: 280, height: 180 });
    // hors de la fenêtre (1 024 × 768, marge 8) : arrêtée au bord
    expect(tirer("se", 1000, 1000)).toEqual({ left: 200, top: 100, width: 816, height: 660 });
    expect(tirer("nw", -1000, -1000)).toEqual({ left: 8, top: 8, width: 692, height: 492 });
  });

  test("redimensionnée au coin bas droit (souris ou doigt) : taille appliquée puis retenue pour cette boîte", () => {
    lire(`new Boite("o_boiteEssai", "Essai", "<p>contenu</p>").afficher()`);
    lire(`(() => {
      const $b = $("#o_boiteEssai");
      $b[0].getBoundingClientRect = () => (${JSON.stringify(cadre(200, 100, 500, 400))});
      // mesures après le redimensionnement (pas de mise en page ici)
      $b.outerWidth = () => 600; $b.outerHeight = () => 450;
      const coin = $b.children(".o_bordBasDroite")[0];
      const ev = (type, x, y) => coin.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, pointerType: "touch", bubbles: true }));
      ev("pointerdown", 700, 500);
      ev("pointermove", 800, 550);
      ev("pointerup", 800, 550);
    })()`);
    expect(
      lire(
        `["left", "top", "width", "height"].map((p) => document.getElementById("o_boiteEssai").style[p])`,
      ),
    ).toEqual(["200px", "100px", "600px", "450px"]);
    expect(lire(`$("#o_boiteEssai").hasClass("o_boiteRedimensionnee")`)).toBe(true);
    expect(JSON.parse(lire(`localStorage.getItem("fzzz_tailleBoite_o_boiteEssai")`))).toEqual({
      largeur: 600,
      hauteur: 450,
    });
    // poignée relâchée : la boîte ne suit plus le pointeur
    lire(
      `$("#o_boiteEssai .o_bordBasDroite")[0].dispatchEvent(new PointerEvent("pointermove", { clientX: 900, clientY: 700, pointerId: 1, bubbles: true }))`,
    );
    expect(lire(`document.getElementById("o_boiteEssai").style.width`)).toBe("600px");
    // clic droit : rien
    lire(`(() => {
      const coin = $("#o_boiteEssai .o_bordBasDroite")[0];
      coin.dispatchEvent(new PointerEvent("pointerdown", { clientX: 700, clientY: 500, pointerId: 2, pointerType: "mouse", button: 2, bubbles: true }));
      coin.dispatchEvent(new PointerEvent("pointermove", { clientX: 750, clientY: 520, pointerId: 2, bubbles: true }));
    })()`);
    expect(lire(`document.getElementById("o_boiteEssai").style.width`)).toBe("600px");
  });

  test("taille retenue : reprise à la création de la boîte (page suivante)", () => {
    lire(
      `localStorage.setItem("fzzz_tailleBoite_o_boiteEssai", JSON.stringify({ largeur: 640, hauteur: 520 }))`,
    );
    lire(`new Boite("o_boiteEssai", "Essai", "<p>contenu</p>").afficher()`);
    expect(lire(`$("#o_boiteEssai").hasClass("o_boiteRedimensionnee")`)).toBe(true);
    expect(
      lire(`["width", "height"].map((p) => document.getElementById("o_boiteEssai").style[p])`),
    ).toEqual(["640px", "520px"]);
    // taille illisible : ignorée
    lire(
      `document.body.innerHTML = ""; localStorage.setItem("fzzz_tailleBoite_o_boiteAutre", "{")`,
    );
    lire(`new Boite("o_boiteAutre", "Autre", "<p>contenu</p>").afficher()`);
    expect(lire(`$("#o_boiteAutre").hasClass("o_boiteRedimensionnee")`)).toBe(false);
  });

  test("boîte redimensionnée : le contenu remplit le reste et défile ; plus haute que la fenêtre, ramenée", () => {
    lire(`new Boite("o_boiteEssai", "Essai", "<p>contenu</p>").afficher()`);
    lire(`(() => {
      const $b = $("#o_boiteEssai").addClass("o_boiteRedimensionnee");
      let hauteur = 900;
      // 900 px demandés pour une fenêtre de 768 : 768 − 2 × 8 au plus
      $b.outerHeight = () => hauteur; $b.outerWidth = () => 500; $b.height = () => hauteur - 26;
      $b.css = ((f) => function (p, v) { if (p == "height") hauteur = parseFloat(v); return f.apply(this, arguments); })($b.css);
      $b.children = ((f) => function (sel) { const r = f.call(this, sel); if (sel == ".o_titre") r.outerHeight = () => 40; return r; })($b.children);
      $b[0].getBoundingClientRect = () => ({ top: 8, left: 10, width: 500, height: hauteur, bottom: 8 + hauteur, right: 510 });
      Boite.ajuster($b);
    })()`);
    expect(lire(`document.getElementById("o_boiteEssai").style.height`)).toBe("752px");
    // 752 − 26 (marges et cadre) − 40 (titre)
    expect(lire(`$("#o_boiteEssai .o_corps")[0].style.height`)).toBe("686px");
    expect(lire(`$("#o_boiteEssai .o_corps")[0].style.maxHeight`)).toBe("none");
  });
});
