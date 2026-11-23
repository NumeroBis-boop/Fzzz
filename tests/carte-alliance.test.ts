import { beforeEach, describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

// Carte de l'alliance (menu Alliance → Carte) : même échelle en X et en Y,
// dessinée seulement quand on l'affiche, chaîne calculée à la demande, et
// joueurs ou alliances ajoutés par le joueur (liste à lui), lus dans l'export
// public des joueurs. Proposition de KWHWWYMWN, 23/11/2026. Joueurs inventés.
const page = creerPage(
  [
    "js/lib/moment-duration-format.js",
    "js/class/Utils.js",
    "js/class/Parametre.js",
    "js/class/Joueur.js",
    "js/class/Classeur.js",
    "js/class/ExportJoueurs.js",
    "js/page/Alliance.js",
  ],
  `var TOAST_SUCCESS = { type: "succes" }, TOAST_ERROR = { type: "erreur" }, TOAST_INFO = { type: "info" }, TOAST_WARNING = { type: "attention" };
   var METHODE_FLOOD = ["Standard", "Optimisée", "Uniforme", "Dégressive"], AFFECTATION_RESSOURCE = [], RATIO_RECOLTE = {};
   var NOM_UNITE = ["Ouvrière", "Jeune Soldate Naine"];
   var Clipboard = function () { this.on = () => {}; };
   var TOASTS = [], CARTES = [];
   $.toast = (o) => TOASTS.push(o);
   var Highcharts = {
     seriesTypes: { line: { prototype: {} } },
     chart: (id, options) => (CARTES.push(options), {}),
   };`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);

const MEMBRES = [
  { pseudo: "Alpha", x: 10, y: 10, terrain: 100000 },
  { pseudo: "Bravo", x: 30, y: 12, terrain: 200000 },
  { pseudo: "Charlie", x: 50, y: 40, terrain: 300000 },
  { pseudo: "Delta", x: 12, y: 50, terrain: 150000 },
];
// export public : [x, y, terrain, id, seigneur, alliance]
const BASE = {
  Alpha: [10, 10, 100000, 1, null, "TAG"],
  Bravo: [30, 12, 200000, 2, null, "TAG"],
  Echo: [80, 5, 120000, 5, null, "ENN"],
  Foxtrot: [85, 9, 400000, 6, null, "ENN"],
  Golf: [60, 60, 90000, 7, null, null],
};

beforeEach(() => {
  lire(`(() => {
    localStorage.clear();
    TOASTS.length = 0;
    CARTES.length = 0;
    location.hash = "";
    document.body.innerHTML = "<span id='tag_alliance'>TAG</span><span id='quantite_tdc'>100000</span><a id='o_ongletCarte' href='#'>Carte</a><div id='alliance'></div>";
    window.monProfil = { pseudo: "Alpha", x: 10, y: 10, niveauRecherche: [0, 0, 0, 0, 0, 0, 5], parametre: { couleur2: { valeur: "#eee" } } };
    ExportJoueurs.avecAlliances = () => Promise.resolve(${JSON.stringify(BASE)});
  })()`);
});

/** Positions gardées par « Charger / Actualiser », comme sur la page Membres. */
const garderPositions = (membres = MEMBRES) =>
  lire(
    `localStorage.setItem("outiiil_carteAlliance_S5_TAG", ${JSON.stringify(JSON.stringify({ timestamp: Date.now(), members: membres }))})`,
  );
/** Page Membres ouverte : bloc de la carte posé, vue pas encore affichée. */
const ouvrirPage = () =>
  lire(`(() => {
    window.p = Object.create(PageAlliance.prototype);
    p._gradesNatifs = {};
    p._alliance = { joueurs: {} };
    p._carteMembres = null;
    p.carte().ongletCarte();
    window.calculs = 0;
    let calculer = p._calculerChaine;
    p._calculerChaine = function (...a) { calculs++; return calculer.apply(this, a); };
  })()`);
const afficherCarte = () => lire(`$("#o_ongletCarte").trigger("click")`);
const series = (k = -1) =>
  lire<{ name: string; data: any[] }[]>(
    `CARTES.at(${k}).series.map((s) => ({ name: s.name, data: s.data }))`,
  );

describe("même échelle sur les deux axes", () => {
  test("cadre centré sur les positions, autant d'unités par pixel en X qu'en Y", () => {
    const c = lire(
      `PageAlliance.cadreOrthonorme({ xMin: 0, xMax: 100, yMin: 0, yMax: 60 }, 500, 600)`,
    );
    expect(c).toEqual({ xMin: 0, xMax: 100, yMin: -30, yMax: 90 });
    expect((c.xMax - c.xMin) / 500).toBeCloseTo((c.yMax - c.yMin) / 600, 9);
    // positions plus hautes que larges : c'est X qui s'élargit
    const d = lire(
      `PageAlliance.cadreOrthonorme({ xMin: 0, xMax: 10, yMin: 0, yMax: 100 }, 400, 300)`,
    );
    expect([d.yMin, d.yMax]).toEqual([0, 100]);
    expect((d.xMax - d.xMin) / 400).toBeCloseTo((d.yMax - d.yMin) / 300, 9);
    expect(d.xMin).toBeLessThan(0);
    expect(d.xMax).toBeGreaterThan(10);
  });

  test("hauteur d'après la largeur (proportions des positions), entre 320 et 900 px", () => {
    const b = `{ xMin: 0, xMax: 100, yMin: 0, yMax: 60 }`;
    // 600 px de large : tracé de 530 px, 318 px de haut, plus titres et axes
    expect(lire(`PageAlliance.hauteurCarte(${b}, 600)`)).toBe(453);
    expect(lire(`PageAlliance.hauteurCarte({ xMin: 0, xMax: 100, yMin: 0, yMax: 5 }, 600)`)).toBe(
      320,
    );
    expect(lire(`PageAlliance.hauteurCarte({ xMin: 0, xMax: 10, yMin: 0, yMax: 2000 }, 600)`)).toBe(
      900,
    );
    expect(lire(`PageAlliance.bornesCarte([{ x: 10, y: 5 }, { x: 110, y: 45 }])`)).toEqual({
      xMin: 4,
      xMax: 116,
      yMin: -1,
      yMax: 51,
    });
    // carte de 600 px : tracé estimé de 530 × 246 px (hauteur arrondie au pixel), 52 unités
    // sur 246 px ; 20 px au-dessus des points du haut pour leur nom
    const avecNoms = lire(`PageAlliance.bornesCarte([{ x: 10, y: 5 }, { x: 110, y: 45 }], 600)`);
    expect(avecNoms.yMax).toBeCloseTo(51 + (20 * 52) / 246, 9);
    expect([avecNoms.xMin, avecNoms.xMax, avecNoms.yMin]).toEqual([4, 116, -1]);
  });

  test("axes mis au cadre du tracé réel, zoom par glisser élargi pour garder l'échelle", () => {
    const r = lire(`(() => {
      let faits = [],
        axe = (nom) => ({
          update: (o) => faits.push([nom, "update", o.min, o.max]),
          setExtremes: (min, max) => faits.push([nom, "setExtremes", min, max]),
        }),
        chart = { plotWidth: 500, plotHeight: 250, xAxis: [axe("x")], yAxis: [axe("y")], redraw: () => {}, showResetZoom: () => faits.push(["reset"]) };
      PageAlliance.cadrer(chart, { xMin: 0, xMax: 100, yMin: 0, yMax: 60 });
      let rendu = PageAlliance.zoomOrthonorme(chart, { xAxis: [{ min: 0, max: 10 }], yAxis: [{ min: 0, max: 10 }] });
      let remise = PageAlliance.zoomOrthonorme(chart, { resetSelection: true });
      return { faits, rendu, remise };
    })()`);
    expect(r.faits).toEqual([
      ["x", "update", -10, 110],
      ["y", "update", 0, 60],
      // zone de 10 × 10 sur un tracé deux fois plus large que haut : 20 × 10
      ["x", "setExtremes", -5, 15],
      ["y", "setExtremes", 0, 10],
      ["reset"],
    ]);
    expect(r.rendu).toBe(false);
    expect(r.remise).toBe(true);
  });

  test("carte dessinée au cadre orthonormé, sans étirement automatique, grille carrée", () => {
    garderPositions();
    ouvrirPage();
    afficherCarte();
    const o = lire(`(() => {
      let o = CARTES[0];
      return { reflow: o.chart.reflow, x: o.xAxis, y: o.yAxis, hauteur: $("#o_carteAllianceChart").css("height") };
    })()`);
    expect(o.reflow).toBe(false);
    expect([o.x.tickPixelInterval, o.y.tickPixelInterval]).toEqual([50, 50]);
    expect([o.x.startOnTick, o.x.endOnTick, o.y.startOnTick, o.y.endOnTick]).toEqual([
      false,
      false,
      false,
      false,
    ]);
    // zoom par glisser branché sur le zoom qui garde l'échelle
    const zoom = lire(`(() => {
      let faits = [], axe = { setExtremes: (min, max) => faits.push([min, max]) },
        chart = { plotWidth: 500, plotHeight: 250, xAxis: [axe], yAxis: [axe], redraw: () => {}, showResetZoom: () => {} },
        rendu = CARTES[0].chart.events.selection.call(chart, { xAxis: [{ min: 0, max: 10 }], yAxis: [{ min: 0, max: 10 }] });
      return { rendu, faits };
    })()`);
    expect(zoom).toEqual({
      rendu: false,
      faits: [
        [-5, 15],
        [0, 10],
      ],
    });
    // largeur inconnue hors navigateur : 600 px ; tracé estimé 530 × hauteur − 135
    const hauteur = parseInt(o.hauteur);
    expect((o.x.max - o.x.min) / 530).toBeCloseTo((o.y.max - o.y.min) / (hauteur - 135), 9);
  });

  test("image pour le forum : même échelle en X et en Y, graduations d'au moins 40 px", () => {
    expect(lire(`PageAlliance.echelleImage(90, 60)`)).toBe(10);
    expect(lire(`PageAlliance.echelleImage(2, 1)`)).toBe(20);
    expect(lire(`PageAlliance.echelleImage(100, 2000)`)).toBe(0.45);
    expect(lire(`[10, 20, 9, 0.45, 3].map((px) => PageAlliance.pasGrille(px))`)).toEqual([
      5, 2, 5, 100, 20,
    ]);
  });
});

describe("carte dessinée à l'affichage, chaîne à la demande", () => {
  test("page Membres ouverte : rien de dessiné ni calculé ; la carte au clic sur « Carte »", () => {
    garderPositions();
    ouvrirPage();
    expect(lire(`CARTES.length`)).toBe(0);
    expect(lire(`$("#o_carteAllianceStatus").text()`)).toBe("Données à l'instant");
    afficherCarte();
    expect(lire(`CARTES.length`)).toBe(1);
    expect(lire(`calculs`)).toBe(0);
    expect(lire(`$("#o_chaineListe").text()`)).toContain("« Calculer la chaîne »");
    expect(series().find((s) => s.name == "Chaîne")?.data).toEqual([]);
    // vue cachée puis remontrée : pas redessinée
    afficherCarte();
    expect(lire(`CARTES.length`)).toBe(1);
  });

  test("adresse #carte : dessinée à l'ouverture de la page", () => {
    garderPositions();
    lire(`location.hash = "#carte"`);
    ouvrirPage();
    expect(lire(`CARTES.length`)).toBe(1);
  });

  test("« Calculer la chaîne » : calculée pour les membres affichés, puis suit les filtres", () => {
    garderPositions();
    ouvrirPage();
    afficherCarte();
    lire(`$("#o_chaineCalculer").trigger("click")`);
    // départ libre : chaque membre essayé comme départ
    expect(lire(`calculs`)).toBe(4);
    expect(lire(`$("#o_chaineListe tbody tr").length`)).toBe(5);
    expect(lire(`CARTES.length`)).toBe(1);
    // un membre décoché : la chaîne demandée est refaite sans lui
    lire(
      `$(".o_filtreJoueur").filter((i, e) => $(e).parent().text().includes("Delta")).prop("checked", false).trigger("change")`,
    );
    expect(lire(`calculs`)).toBe(7);
    expect(lire(`$("#o_chaineListe").text()`)).not.toContain("Delta");
    // même membres affichés : la chaîne gardée sert
    lire(`p._redessiner()`);
    expect(lire(`calculs`)).toBe(7);
  });

  test("« Tracer sur la carte » gardé coché : chaîne calculée et tracée à l'affichage", () => {
    garderPositions();
    lire(
      `localStorage.setItem("outiiil_carteChaine_S5_TAG", JSON.stringify({ depart: "Bravo", tracer: true }))`,
    );
    ouvrirPage();
    afficherCarte();
    // départ choisi : un seul calcul
    expect(lire(`calculs`)).toBe(1);
    const chaine = series().find((s) => s.name == "Chaîne")?.data ?? [];
    expect(chaine.length).toBe(4);
    expect(chaine[0]).toEqual([30, 12]);
  });

  test("chaîne plus rapide (temps calculés une fois) : même résultat que l'ancien calcul", () => {
    // ancien calcul (1.150.4), temps recalculés à chaque comparaison
    const temps = (a: any, b: any) =>
      Math.round(637200 * (1 - Math.exp(-Math.hypot(a.x - b.x, a.y - b.y) / 350)));
    const ancien = (membres: any[], depart: any) => {
      let ordre = [depart];
      const restants = membres.filter((m) => m !== depart);
      while (restants.length) {
        const dernier = ordre[ordre.length - 1];
        let i = 0;
        restants.forEach((m, j) => {
          if (temps(dernier, m) < temps(dernier, restants[i])) i = j;
        });
        ordre.push(restants.splice(i, 1)[0]);
      }
      const n = ordre.length,
        t = (a: any, b: any) => (a && b ? temps(a, b) : 0),
        suivant = (k: number) => (k + 1 < n ? ordre[k + 1] : null);
      let ameliore = n > 3;
      while (ameliore) {
        ameliore = false;
        for (let i = 1; i < n - 1; i++)
          for (let k = i + 1; k < n; k++) {
            const avant = t(ordre[i - 1], ordre[i]) + t(ordre[k], suivant(k)),
              apres = t(ordre[i - 1], ordre[k]) + t(ordre[i], suivant(k));
            if (apres < avant) {
              ordre = [
                ...ordre.slice(0, i),
                ...ordre.slice(i, k + 1).reverse(),
                ...ordre.slice(k + 1),
              ];
              ameliore = true;
            }
          }
      }
      return ordre.map((m) => m.pseudo);
    };
    let graine = 11;
    const hasard = () => (graine = (graine * 16807) % 2147483647) / 2147483647;
    for (const n of [5, 12, 33]) {
      const membres = Array.from({ length: n }, (_, k) => ({
        pseudo: "J" + k,
        x: Math.round(hasard() * 100),
        y: Math.round(hasard() * 60),
      }));
      const nouveaux = lire<string[][]>(`(() => {
        let p = Object.create(PageAlliance.prototype), m = ${JSON.stringify(membres)};
        return m.map((d) => p._calculerChaine(m, d).ordre.map((x) => x.pseudo));
      })()`);
      expect(nouveaux).toEqual(membres.map((d) => ancien(membres, d)));
    }
  });
});

describe("autres joueurs et alliances ajoutés", () => {
  test("placés d'après l'export : joueur seul prioritaire sur son alliance, jamais un membre", () => {
    const r = lire(
      `PageAlliance.resoudreAutres([
        { type: "alliance", nom: "enn", couleur: "#7b3fb0" },
        { type: "joueur", nom: "foxtrot", couleur: "#2a78d6" },
        { type: "joueur", nom: "golf", couleur: "#8a8a8a" },
        { type: "joueur", nom: "Bravo", couleur: "#e75fa3" },
        { type: "joueur", nom: "Inconnu", couleur: "#e75fa3" },
        { type: "alliance", nom: "VIDE", couleur: "#e75fa3" },
        { type: "alliance", nom: "tag", couleur: "#e75fa3" },
      ], ${JSON.stringify(BASE)}, "TAG", ["Alpha"])`,
    );
    expect(r.points).toEqual([
      {
        pseudo: "Foxtrot",
        x: 85,
        y: 9,
        terrain: 400000,
        alliance: "ENN",
        couleur: "#2a78d6",
      },
      { pseudo: "Golf", x: 60, y: 60, terrain: 90000, alliance: "", couleur: "#8a8a8a" },
      { pseudo: "Echo", x: 80, y: 5, terrain: 120000, alliance: "ENN", couleur: "#7b3fb0" },
    ]);
    expect(r.etats).toEqual([
      "1 joueur",
      "ENN · 400 000 cm²",
      "sans alliance · 90 000 cm²",
      "membre de ton alliance",
      "introuvable dans la liste publique des joueurs",
      "aucun joueur dans la liste publique",
      "aucun joueur dans la liste publique",
    ]);
  });

  test("ajout d'une alliance et d'un joueur : orthographe du jeu, gardés, losanges à leur couleur", async () => {
    garderPositions();
    ouvrirPage();
    afficherCarte();
    const ajouter = (type: string, nom: string, couleur?: string) =>
      lire<Promise<void>>(`(() => {
        $("#o_carteAutreType").val("${type}");
        $("#o_carteAutreNom").val("${nom}");
        ${couleur ? `$("#o_carteAutreCouleur").val("${couleur}");` : ""}
        return p._ajouterAutre();
      })()`);
    await ajouter("alliance", "enn");
    // couleur proposée ensuite : la première libre
    expect(lire(`$("#o_carteAutreCouleur").val()`)).toBe("#7b3fb0");
    await ajouter("joueur", "golf", "#8a8a8a");
    expect(lire(`JSON.parse(localStorage.getItem("fzzz_carteAutres"))`)).toEqual([
      { type: "alliance", nom: "ENN", couleur: "#2a78d6", forme: "losange", taille: "moyenne" },
      { type: "joueur", nom: "Golf", couleur: "#8a8a8a", forme: "losange", taille: "moyenne" },
    ]);
    expect(lire(`$("#o_carteAutreNom").val()`)).toBe("");
    // mon alliance en tête, sans ✕ ; puis les ajoutés
    expect(
      lire(
        `$("#o_carteAutresListe li").map((i, e) => [[$(e).children("b").text(), $(e).children(".reduce").text(), $(e).find(".o_carteAutreRetirer").length]]).get()`,
      ),
    ).toEqual([
      ["TAG", "ton alliance · 4 membres", 0],
      ["ENN", "alliance · 2 joueurs", 1],
      ["Golf", "joueur · sans alliance · 90 000 cm²", 1],
    ]);
    const autres = series().find((s) => s.name == "Autres")?.data ?? [];
    expect(autres.map((d) => [d.name, d.marker.symbol, d.marker.fillColor, d.autre])).toEqual([
      ["Golf", "diamond", "#8a8a8a", true],
      ["Echo", "diamond", "#2a78d6", true],
      ["Foxtrot", "diamond", "#2a78d6", true],
    ]);
    expect(lire(`CARTES.at(-1).title.text`)).toContain("4 membres • 3 autres •");
    // ni dans les liens ni dans la chaîne
    expect(lire(`$("#o_chaineDepart option").length`)).toBe(5);

    // info-bulle : alliance, TdC de l'export, portée dans les deux sens
    const info = lire<string>(`(() => {
      let d = CARTES.at(-1).series.find((s) => s.name == "Autres").data[2];
      return CARTES.at(-1).tooltip.formatter.call({ point: d });
    })()`);
    expect(info).toContain("<b>Foxtrot</b> [ENN]");
    expect(info).toContain("Terrain : 400 000 cm²");
    // 100 000 cm² contre 400 000 : hors de portée dans les deux sens
    expect(info).toContain("Tu peux l'attaquer : non · il peut t'attaquer : non");
    expect(info).toContain("Temps de trajet");
    const echo = lire<string>(`(() => {
      let d = CARTES.at(-1).series.find((s) => s.name == "Autres").data[1];
      return CARTES.at(-1).tooltip.formatter.call({ point: d });
    })()`);
    expect(echo).toContain("<b>Echo</b> [ENN]");
    expect(echo).toContain("Tu peux l'attaquer : oui · il peut t'attaquer : oui");

    // couleur changée puis retrait
    lire(
      `$("#o_carteAutresListe li:eq(1) .o_carteStyle[data-champ=couleur]").val("#e75fa3").trigger("change")`,
    );
    expect(lire(`JSON.parse(localStorage.getItem("fzzz_carteAutres"))[0].couleur`)).toBe("#e75fa3");
    expect(
      (series().find((s) => s.name == "Autres")?.data ?? []).map((d) => d.marker.fillColor),
    ).toEqual(["#8a8a8a", "#e75fa3", "#e75fa3"]);
    lire(`$("#o_carteAutresListe li:eq(1) .o_carteAutreRetirer").trigger("click")`);
    expect(lire(`JSON.parse(localStorage.getItem("fzzz_carteAutres"))`)).toEqual([
      { type: "joueur", nom: "Golf", couleur: "#8a8a8a", forme: "losange", taille: "moyenne" },
    ]);
    expect((series().find((s) => s.name == "Autres")?.data ?? []).map((d) => d.name)).toEqual([
      "Golf",
    ]);
  });

  test("refus : déjà ajouté, mon alliance, un membre, introuvable, liste publique illisible", async () => {
    garderPositions();
    lire(
      `localStorage.setItem("fzzz_carteAutres", JSON.stringify([{ type: "joueur", nom: "Golf", couleur: "#8a8a8a" }]))`,
    );
    ouvrirPage();
    const essai = (type: string, nom: string) =>
      lire<Promise<string>>(`(() => {
        TOASTS.length = 0;
        $("#o_carteAutreType").val("${type}");
        $("#o_carteAutreNom").val("${nom}");
        return p._ajouterAutre().then(() => TOASTS.map((t) => t.text).join(" | "));
      })()`);
    expect(await essai("joueur", "GOLF")).toBe("« GOLF » est déjà sur la carte.");
    expect(await essai("alliance", "tag")).toBe(
      "Ton alliance est déjà sur la carte : ce sont les membres.",
    );
    expect(await essai("joueur", "bravo")).toBe(
      "Bravo est membre de ton alliance : il est déjà sur la carte.",
    );
    expect(await essai("joueur", "Zoulou")).toBe(
      "Joueur « Zoulou » introuvable dans la liste publique des joueurs (le jeu la refait chaque heure).",
    );
    lire(`ExportJoueurs.avecAlliances = () => Promise.reject(new Error("503"))`);
    expect(await essai("alliance", "ENN")).toBe(
      "Liste publique des joueurs illisible pour l'instant : réessaie plus tard.",
    );
    expect(lire(`JSON.parse(localStorage.getItem("fzzz_carteAutres")).length`)).toBe(1);
    expect(lire(`$("#o_carteAutreAjouter").prop("disabled")`)).toBe(false);
  });

  test("à l'affichage : liste publique gardée à jour lue sans requête, sinon lue puis carte redessinée", async () => {
    garderPositions();
    lire(
      `localStorage.setItem("fzzz_carteAutres", JSON.stringify([{ type: "alliance", nom: "ENN", couleur: "#7b3fb0" }]))`,
    );
    // copie gardée de moins d'une heure, avec les alliances : un seul dessin
    lire(
      `localStorage.setItem("fzzz_joueurs_S5", JSON.stringify({ t: Date.now(), joueurs: ${JSON.stringify(BASE)} }))`,
    );
    lire(
      `window.lectures = 0; ExportJoueurs.avecAlliances = () => (lectures++, Promise.resolve({}))`,
    );
    ouvrirPage();
    afficherCarte();
    expect(lire(`[CARTES.length, lectures]`)).toEqual([1, 0]);
    expect((series().find((s) => s.name == "Autres")?.data ?? []).length).toBe(2);

    // copie trop vieille : la carte d'abord, les ajoutés après la lecture
    // nouvelle page : copie de la liste publique trop vieille
    lire(`localStorage.removeItem("fzzz_joueurs_S5"); CARTES.length = 0;
      document.body.innerHTML = "<span id='tag_alliance'>TAG</span><a id='o_ongletCarte' href='#'>Carte</a><div id='alliance'></div>"`);
    lire(
      `ExportJoueurs.avecAlliances = () => (lectures++, Promise.resolve(${JSON.stringify(BASE)}))`,
    );
    ouvrirPage();
    afficherCarte();
    await lire(`Promise.resolve()`);
    await lire(`new Promise((r) => setTimeout(r, 0))`);
    expect(lire(`[CARTES.length, lectures]`)).toEqual([2, 1]);
    expect((series(0).find((s) => s.name == "Autres")?.data ?? []).length).toBe(0);
    expect((series(1).find((s) => s.name == "Autres")?.data ?? []).length).toBe(2);
  });

  test("portée dans les deux sens ; couleur gardée hors de la liste proposée remplacée", () => {
    garderPositions();
    lire(`localStorage.setItem("fzzz_carteAutres", JSON.stringify([
      { type: "joueur", nom: "Kilo", couleur: "red;background:url(x)" },
    ]))`);
    lire(
      `localStorage.setItem("fzzz_joueurs_S5", JSON.stringify({ t: Date.now(), joueurs: { ...${JSON.stringify(BASE)}, Kilo: [70, 70, 250000, 8, null, "AUT"] } }))`,
    );
    ouvrirPage();
    afficherCarte();
    const d = lire(`CARTES[0].series.find((s) => s.name == "Autres").data[0]`);
    expect([d.name, d.marker.fillColor]).toEqual(["Kilo", "#2a78d6"]);
    expect(lire(`$("#o_carteAutresListe li:eq(1) .o_carteSymbole").attr("style")`)).toBe(
      "color:#2a78d6;",
    );
    // 100 000 cm² contre 250 000 : je peux l'attaquer (jusqu'au triple), pas lui (pas sous sa moitié)
    expect(
      lire(
        `CARTES[0].tooltip.formatter.call({ point: CARTES[0].series.find((s) => s.name == "Autres").data[0] })`,
      ),
    ).toContain("Tu peux l'attaquer : oui · il peut t'attaquer : non");
  });

  test("dix couleurs au choix ; gris de la 1.151.0 gardé gris ; aperçu de la couleur proposée", () => {
    lire(`localStorage.setItem("fzzz_carteAutres", JSON.stringify([
      { type: "joueur", nom: "Golf", couleur: "#6b6b6b" },
      { type: "alliance", nom: "ENN", couleur: "#0b6e2f" },
    ]))`);
    ouvrirPage();
    expect(lire(`$("#o_carteAutreCouleur option").map((i, o) => o.textContent).get()`)).toEqual([
      "Rouge",
      "Bleu",
      "Violet",
      "Rose",
      "Vert",
      "Orange",
      "Noir",
      "Bleu marine",
      "Bordeaux",
      "Gris",
    ]);
    expect(lire(`PageAlliance.autresGardes().map((e) => e.couleur)`)).toEqual([
      "#8a8a8a",
      "#0b6e2f",
    ]);
    // première couleur libre (le rouge est celle de mon alliance), et son aperçu
    expect(lire(`$("#o_carteAutreCouleur").val()`)).toBe("#2a78d6");
    expect(lire(`$("#o_carteAutreApercu").css("color")`)).toBe("#2a78d6");
    expect(lire(`$("#o_carteAutreApercu").text()`)).toBe("◆");
    lire(`$("#o_carteAutreCouleur").val("#e8590c").trigger("change")`);
    expect(lire(`$("#o_carteAutreApercu").css("color")`)).toBe("#e8590c");
  });

  test("marqueurs : forme, taille, case de plusieurs joueurs cerclée de noir, ma case en vert, croix en traits", () => {
    const m = (style: object, cas = "{}") =>
      lire(`PageAlliance.marqueur(${JSON.stringify(style)}, ${cas})`);
    expect(m({ couleur: "#2a78d6", forme: "carre", taille: "grande" })).toEqual({
      symbol: "square",
      radius: 7,
      fillColor: "#2a78d6",
      lineColor: "#fff",
      lineWidth: 1.5,
    });
    expect(m({ couleur: "#2a78d6", forme: "triangleBas", taille: "petite" }, "{ n: 3 }")).toEqual({
      symbol: "triangle-down",
      radius: 7,
      fillColor: "#2a78d6",
      lineColor: "#222",
      lineWidth: 2,
    });
    expect(m({ couleur: "#c0392b", forme: "rond", taille: "moyenne" }, "{ moi: true }")).toEqual({
      symbol: "circle",
      radius: 5,
      fillColor: "#27ae60",
      lineColor: "#196f3d",
      lineWidth: 2,
    });
    expect(m({ couleur: "#1a1a1a", forme: "croix", taille: "tresGrande" }, "{ n: 9 }")).toEqual({
      symbol: "fzzzCroix",
      radius: 13,
      fillColor: "#1a1a1a",
      lineColor: "#1a1a1a",
      lineWidth: 3.5,
    });
    // la croix ajoutée aux formes de Highcharts : deux traits
    const croix = lire(`(() => {
      window.Highcharts.SVGRenderer = { prototype: { symbols: {} } };
      PageAlliance.formeCroix();
      let s = Highcharts.SVGRenderer.prototype.symbols.fzzzCroix(0, 0, 10, 10);
      delete window.Highcharts.SVGRenderer;
      return s;
    })()`);
    expect(croix).toEqual(["M", 0, 0, "L", 10, 10, "M", 10, 0, "L", 0, 10]);
  });

  test("ligne de mon alliance : couleur, forme et taille des membres, gardées ; légende à jour", () => {
    garderPositions();
    ouvrirPage();
    afficherCarte();
    expect(lire(`$("#o_carteAutresListe li:first .reduce").text()`)).toBe(
      "ton alliance · 4 membres",
    );
    const membres = () => series().find((s) => s.name == "Membres")?.data ?? [];
    // par défaut : rond rouge moyen, ma case en vert
    expect(
      membres().map((d) => [d.name, d.marker.symbol, d.marker.fillColor, d.marker.radius]),
    ).toEqual([
      ["Alpha", "circle", "#27ae60", 5],
      ["Bravo", "circle", "#c0392b", 5],
      ["Charlie", "circle", "#c0392b", 5],
      ["Delta", "circle", "#c0392b", 5],
    ]);
    const regler = (champ: string, valeur: string) =>
      lire(
        `$("#o_carteAutresListe li:eq(0) .o_carteStyle[data-champ=${champ}]").val("${valeur}").trigger("change")`,
      );
    regler("couleur", "#1c3f94");
    regler("forme", "carre");
    regler("taille", "grande");
    expect(lire(`JSON.parse(localStorage.getItem("fzzz_carteStyleMembres"))`)).toEqual({
      couleur: "#1c3f94",
      forme: "carre",
      taille: "grande",
    });
    expect(membres().map((d) => [d.marker.symbol, d.marker.fillColor, d.marker.radius])).toEqual([
      ["square", "#27ae60", 7],
      ["square", "#1c3f94", 7],
      ["square", "#1c3f94", 7],
      ["square", "#1c3f94", 7],
    ]);
    expect(lire(`$("#o_carteAutresListe li:eq(0) .o_carteSymbole").attr("style")`)).toBe(
      "color:#1c3f94;",
    );
    expect(lire(`$("#o_carteLegende .o_carteSymbole:first").text()`)).toBe("■");
    // couleur de mon alliance prise : proposée ensuite la première libre
    regler("couleur", "#2a78d6");
    expect(lire(`$("#o_carteAutreCouleur").val()`)).toBe("#c0392b");
  });

  test("« Masquer » sur la ligne de mon alliance : les ajoutés seuls, cadrés sur eux ; gardé ; « Afficher » la remet", () => {
    garderPositions();
    lire(
      `localStorage.setItem("fzzz_carteAutres", JSON.stringify([{ type: "alliance", nom: "ENN", couleur: "#7b3fb0" }]))`,
    );
    lire(
      `localStorage.setItem("fzzz_joueurs_S5", JSON.stringify({ t: Date.now(), joueurs: ${JSON.stringify(BASE)} }))`,
    );
    lire(
      `localStorage.setItem("outiiil_carteChaine_S5_TAG", JSON.stringify({ depart: "Bravo", tracer: true }))`,
    );
    ouvrirPage();
    afficherCarte();
    const bouton = `$("#o_carteAutresListe li:first .o_carteMasquer")`;
    const donnees = (nom: string) => series().find((s) => s.name == nom)?.data ?? [];
    // info-bulle d'un ajouté (temps de trajet depuis moi), avant et après
    const bulle = () =>
      lire<string>(`(() => {
        let s = CARTES.at(-1).series.find((s) => s.name == "Autres"),
          d = s.data.find((d) => d.name == "Echo");
        return CARTES.at(-1).tooltip.formatter.call({ point: d });
      })()`);
    expect(lire(`[${bouton}.text(), ${bouton}.attr("aria-pressed")]`)).toEqual([
      "Masquer",
      "false",
    ]);
    expect(donnees("Membres").length).toBe(4);
    const avant = bulle();
    expect(avant).toContain("Temps de trajet");

    lire(`${bouton}.trigger("click")`);
    expect(lire(`localStorage.getItem("fzzz_carteMembresMasques")`)).toBe("true");
    expect(donnees("Membres")).toEqual([]);
    expect([donnees("Liens"), donnees("Liens vers toi"), donnees("Chaîne")]).toEqual([[], [], []]);
    expect(donnees("Autres").map((d) => d.name)).toEqual(["Echo", "Foxtrot"]);
    expect(bulle()).toBe(avant);
    const o = lire(`(() => {
      let c = CARTES.at(-1), li = $("#o_carteAutresListe li:first");
      return { x: c.xAxis, titre: c.title.text, sous: c.subtitle.text, legende: $("#o_carteLegende").text(),
        ligne: li.find(".reduce").text(), pale: li.hasClass("o_carteLigneMasquee"),
        bouton: [li.find(".o_carteMasquer").text(), li.find(".o_carteMasquer").attr("aria-pressed")] };
    })()`);
    // cadre sur Echo (80, 5) et Foxtrot (85, 9), plus sur les membres (x de 10 à 50)
    expect(o.x.min).toBeGreaterThan(50);
    expect(o.x.max).toBeGreaterThan(85);
    expect(o.titre).toBe("Ton alliance masquée • 2 autres • 2 cases");
    expect(o.sous).toBe("");
    expect(o.legende).toBe(
      "Ton alliance est masquée (« Afficher » sur sa ligne) · les autres : forme et couleur de leur ligne",
    );
    expect([o.ligne, o.pale, o.bouton]).toEqual([
      "ton alliance · 4 membres · masquée",
      true,
      ["Afficher", "true"],
    ]);
    // un réglage de la ligne ne la remet pas ; exports : les membres toujours
    lire(
      `$("#o_carteAutresListe li:eq(0) .o_carteStyle[data-champ=couleur]").val("#1c3f94").trigger("change")`,
    );
    expect(donnees("Membres")).toEqual([]);
    expect(lire(`p._membresCarte("l'exporter").members.length`)).toBe(4);

    // nouvelle page : toujours masquée
    lire(`CARTES.length = 0;
      document.body.innerHTML = "<span id='tag_alliance'>TAG</span><span id='quantite_tdc'>100000</span><a id='o_ongletCarte' href='#'>Carte</a><div id='alliance'></div>"`);
    ouvrirPage();
    afficherCarte();
    expect(donnees("Membres")).toEqual([]);
    lire(`${bouton}.trigger("click")`);
    expect(lire(`localStorage.getItem("fzzz_carteMembresMasques")`)).toBe(null);
    expect(donnees("Membres").length).toBe(4);
    expect(donnees("Chaîne").length).toBe(4);
    expect(lire(`${bouton}.text()`)).toBe("Masquer");
  });

  test("alliance masquée sans joueur ajouté : carte vide autour de moi, titre qui le dit", () => {
    garderPositions();
    lire(`localStorage.setItem("fzzz_carteMembresMasques", "true")`);
    ouvrirPage();
    afficherCarte();
    const o = lire(
      `({ titre: CARTES.at(-1).title.text, x: CARTES.at(-1).xAxis, points: CARTES.at(-1).series.reduce((n, s) => n + s.data.length, 0) })`,
    );
    expect(o.titre).toBe("Ton alliance masquée • aucun joueur ajouté à montrer");
    expect(o.points).toBe(0);
    // cadre autour de ma fourmilière (10, 10)
    expect(o.x.min).toBeLessThan(10);
    expect(o.x.max).toBeGreaterThan(10);
  });

  test("forme, taille ou couleur gardées hors des choix proposés : celles par défaut", () => {
    lire(
      `localStorage.setItem("fzzz_carteAutres", JSON.stringify([{ type: "joueur", nom: "Golf", couleur: "#2a78d6", forme: "javascript:x", taille: "énorme" }]))`,
    );
    lire(
      `localStorage.setItem("fzzz_carteStyleMembres", JSON.stringify({ couleur: "red", forme: "etoile", taille: "grande" }))`,
    );
    expect(lire(`PageAlliance.autresGardes()[0]`)).toEqual({
      type: "joueur",
      nom: "Golf",
      couleur: "#2a78d6",
      forme: "losange",
      taille: "moyenne",
    });
    expect(lire(`PageAlliance.styleMembres()`)).toEqual({
      couleur: "#c0392b",
      forme: "rond",
      taille: "grande",
    });
  });

  test("un appui sur une suggestion laisse le champ actif (mousedown annulé)", () => {
    ouvrirPage();
    expect(
      lire(
        `(() => { let e = $.Event("mousedown"); $("#o_carteSuggestions").trigger(e); return e.isDefaultPrevented(); })()`,
      ),
    ).toBe(true);
  });

  test("forme et taille d'un ajouté réglées sur sa ligne", async () => {
    garderPositions();
    lire(
      `localStorage.setItem("fzzz_carteAutres", JSON.stringify([{ type: "joueur", nom: "Golf", couleur: "#1a1a1a" }]))`,
    );
    lire(
      `localStorage.setItem("fzzz_joueurs_S5", JSON.stringify({ t: Date.now(), joueurs: ${JSON.stringify(BASE)} }))`,
    );
    ouvrirPage();
    afficherCarte();
    lire(
      `$("#o_carteAutresListe li:eq(1) .o_carteStyle[data-champ=forme]").val("croix").trigger("change")`,
    );
    lire(
      `$("#o_carteAutresListe li:eq(1) .o_carteStyle[data-champ=taille]").val("tresGrande").trigger("change")`,
    );
    expect(lire(`JSON.parse(localStorage.getItem("fzzz_carteAutres"))`)).toEqual([
      { type: "joueur", nom: "Golf", couleur: "#1a1a1a", forme: "croix", taille: "tresGrande" },
    ]);
    const d = (series().find((s) => s.name == "Autres")?.data ?? [])[0];
    expect([d.name, d.marker.symbol, d.marker.radius, d.marker.lineColor]).toEqual([
      "Golf",
      "fzzzCroix",
      10,
      "#1a1a1a",
    ]);
    expect(lire(`$("#o_carteAutresListe li:eq(1) .o_carteSymbole").text()`)).toBe("✕");
  });

  test("suggestions : contient le texte, début d'abord, casse ignorée ; sans mon alliance ni le déjà ajouté", () => {
    const index = `PageAlliance.indexSuggestions({
      Alpha: [1, 1, 1000, 1, null, "TAG"],
      Albatros: [1, 1, 2000, 2, null, "ENN"],
      Calamar: [1, 1, 3000, 3, null, null],
      Alix: [1, 1, 4000, 4, null, "ALL"],
      Bal: [1, 1, 5000, 5, null, "ALL"],
    })`;
    expect(
      lire(`PageAlliance.suggestions(${index}, "joueur", "al", { tag: "tag", deja: ["alix"] })`),
    ).toEqual([
      { valeur: "Albatros", detail: "[ENN] · 2 000 cm²" },
      { valeur: "Bal", detail: "[ALL] · 5 000 cm²" },
      { valeur: "Calamar", detail: "sans alliance · 3 000 cm²" },
    ]);
    expect(
      lire(`PageAlliance.suggestions(${index}, "alliance", "a", { tag: "TAG", deja: [] })`),
    ).toEqual([{ valeur: "ALL", detail: "2 joueurs" }]);
    expect(
      lire(`PageAlliance.suggestions(${index}, "alliance", "n", { tag: "TAG", deja: [] })`),
    ).toEqual([{ valeur: "ENN", detail: "1 joueur" }]);
    expect(
      lire(`PageAlliance.suggestions(${index}, "joueur", "  ", { tag: "TAG", deja: [] })`),
    ).toEqual([]);
    // « ba » : Bal commence par le texte, passe avant Albatros qui le contient seulement
    expect(
      lire<{ valeur: string }[]>(
        `PageAlliance.suggestions(${index}, "joueur", "ba", { tag: "TAG", deja: [] })`,
      ).map((p) => p.valeur),
    ).toEqual(["Bal", "Albatros"]);
    expect(
      lire(`PageAlliance.suggestions(${index}, "joueur", "a", { tag: "", deja: [] }, 2)`).length,
    ).toBe(2);
  });

  test("suggestions sous le champ : liste publique lue au premier passage, un clic remplit le champ", async () => {
    garderPositions();
    lire(
      `window.lectures = 0; ExportJoueurs.avecAlliances = () => (lectures++, Promise.resolve(${JSON.stringify(BASE)}))`,
    );
    ouvrirPage();
    afficherCarte();
    const proposees = () =>
      lire<string[]>(
        `$("#o_carteSuggestions li").map((i, e) => $(e).text().replace(/\\s+/g, " ").trim()).get()`,
      );
    lire(`$("#o_carteAutreNom").trigger("focus").val("o").trigger("input")`);
    expect(proposees()).toEqual(["Chargement de la liste publique des joueurs…"]);
    await lire(`Promise.resolve()`);
    await lire(`new Promise((r) => setTimeout(r, 0))`);
    // les membres de mon alliance ne sont pas proposés
    expect(proposees()).toEqual([
      "Echo [ENN] · 120 000 cm²",
      "Foxtrot [ENN] · 400 000 cm²",
      "Golf sans alliance · 90 000 cm²",
    ]);
    lire(`$("#o_carteAutreType").val("alliance").trigger("change")`);
    expect(proposees()).toEqual(["Aucune alliance ne correspond."]);
    lire(`$("#o_carteAutreNom").val("e").trigger("input")`);
    expect(proposees()).toEqual(["ENN 2 joueurs"]);
    lire(`$("#o_carteSuggestions li:first").trigger("click")`);
    expect(lire(`$("#o_carteAutreNom").val()`)).toBe("ENN");
    expect(lire(`$("#o_carteSuggestions").css("display")`)).toBe("none");
    lire(`$("#o_carteAutreNom").val("zzz").trigger("input")`);
    expect(proposees()).toEqual(["Aucune alliance ne correspond."]);
    // une seule lecture pour toute la page
    lire(`$("#o_carteAutreNom").trigger("blur").trigger("focus")`);
    expect(lire(`lectures`)).toBe(1);
  });

  test("suggestions : liste publique illisible, le nom se saisit en entier", async () => {
    garderPositions();
    lire(`ExportJoueurs.avecAlliances = () => Promise.reject(new Error("503"))`);
    ouvrirPage();
    lire(`$("#o_carteAutreNom").trigger("focus").val("ab").trigger("input")`);
    await lire(`new Promise((r) => setTimeout(r, 0))`);
    expect(lire(`$("#o_carteSuggestions").text()`)).toBe(
      "Liste publique des joueurs illisible pour l'instant : saisis le nom en entier.",
    );
  });

  test("exports Excel et forum : les membres seulement", () => {
    garderPositions();
    lire(
      `localStorage.setItem("fzzz_carteAutres", JSON.stringify([{ type: "joueur", nom: "Golf", couleur: "#8a8a8a" }]))`,
    );
    ouvrirPage();
    expect(lire(`p._membresCarte("l'exporter").members.map((m) => m.pseudo)`)).toEqual([
      "Alpha",
      "Bravo",
      "Charlie",
      "Delta",
    ]);
  });
});
