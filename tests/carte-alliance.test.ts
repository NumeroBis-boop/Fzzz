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
        { type: "joueur", nom: "golf", couleur: "#6b6b6b" },
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
      { pseudo: "Golf", x: 60, y: 60, terrain: 90000, alliance: "", couleur: "#6b6b6b" },
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
    await ajouter("joueur", "golf", "#6b6b6b");
    expect(lire(`JSON.parse(localStorage.getItem("fzzz_carteAutres"))`)).toEqual([
      { type: "alliance", nom: "ENN", couleur: "#2a78d6" },
      { type: "joueur", nom: "Golf", couleur: "#6b6b6b" },
    ]);
    expect(lire(`$("#o_carteAutreNom").val()`)).toBe("");
    expect(
      lire(
        `$("#o_carteAutresListe li").map((i, e) => $(e).text().replace(/\\s+/g, " ").trim()).get()`,
      ),
    ).toEqual([
      "ENN alliance · 2 joueurs BleuVioletRoseGris ✕",
      "Golf joueur · sans alliance · 90 000 cm² BleuVioletRoseGris ✕",
    ]);
    const autres = series().find((s) => s.name == "Autres")?.data ?? [];
    expect(autres.map((d) => [d.name, d.marker.symbol, d.marker.fillColor, d.autre])).toEqual([
      ["Golf", "diamond", "#6b6b6b", true],
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
      `$("#o_carteAutresListe li:eq(0) .o_carteAutreCouleurDe").val("#e75fa3").trigger("change")`,
    );
    expect(lire(`JSON.parse(localStorage.getItem("fzzz_carteAutres"))[0].couleur`)).toBe("#e75fa3");
    expect(
      (series().find((s) => s.name == "Autres")?.data ?? []).map((d) => d.marker.fillColor),
    ).toEqual(["#6b6b6b", "#e75fa3", "#e75fa3"]);
    lire(`$("#o_carteAutresListe li:eq(0) .o_carteAutreRetirer").trigger("click")`);
    expect(lire(`JSON.parse(localStorage.getItem("fzzz_carteAutres"))`)).toEqual([
      { type: "joueur", nom: "Golf", couleur: "#6b6b6b" },
    ]);
    expect((series().find((s) => s.name == "Autres")?.data ?? []).map((d) => d.name)).toEqual([
      "Golf",
    ]);
  });

  test("refus : déjà ajouté, mon alliance, un membre, introuvable, liste publique illisible", async () => {
    garderPositions();
    lire(
      `localStorage.setItem("fzzz_carteAutres", JSON.stringify([{ type: "joueur", nom: "Golf", couleur: "#6b6b6b" }]))`,
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
    expect(lire(`$("#o_carteAutresListe .o_carteAutrePastille").attr("style")`)).toBe(
      "background:#2a78d6;",
    );
    // 100 000 cm² contre 250 000 : je peux l'attaquer (jusqu'au triple), pas lui (pas sous sa moitié)
    expect(
      lire(
        `CARTES[0].tooltip.formatter.call({ point: CARTES[0].series.find((s) => s.name == "Autres").data[0] })`,
      ),
    ).toContain("Tu peux l'attaquer : oui · il peut t'attaquer : non");
  });

  test("exports Excel et forum : les membres seulement", () => {
    garderPositions();
    lire(
      `localStorage.setItem("fzzz_carteAutres", JSON.stringify([{ type: "joueur", nom: "Golf", couleur: "#6b6b6b" }]))`,
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
