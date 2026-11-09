import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Lanceur de Flood : TdC de moi et de la cible à l'impact d'un flood lancé
 * maintenant, d'après les floods et chasses partagés, mes attaques en cours
 * (liste du jeu) et mes chasses (Ressources.php). Joueurs inventés.
 */
const page = creerPage(
  [
    "js/lib/jquery-ui_1.12.1.js",
    "js/lib/moment-duration-format.js",
    "js/lib/globalize_0.1.1.js",
    "js/lib/globalize-locale-fr.js",
    "js/class/Utils.js",
    "js/class/Parametre.js",
    "js/class/Joueur.js",
    "js/class/Armee.js",
    "js/class/UnitesGardees.js",
    "js/page/PartageChasses.js",
    "js/page/Attaquer.js",
  ],
  `var METHODE_FLOOD = ["Standard", "Optimisée", "Uniforme", "Dégressive"],
     AFFECTATION_RESSOURCE = [], RATIO_RECOLTE = {}, TOAST_WARNING = {};
   var NOM_UNITE = ["Ouvrière", "Jeune Soldate Naine"], NOM_UNITES = ["Ouvrières", "Jeunes Soldates Naines"];
   var heure = moment("2026-11-09 10:00:20", "YYYY-MM-DD HH:mm:ss").valueOf();
   var Horloge = { maintenant: () => heure, serveur: () => moment(heure), clic: () => moment(heure), latence: 0 };
   var AttaqueLancee = { zoneLieu: () => "Terrain" };
   var PageRessource = {
     lireChasses: () => ["chasses lues"],
     grouperChasses: (c) => c,
     aPartager: () => [{ impact: moment("2026-11-09 10:50", "YYYY-MM-DD HH:mm"), terrain: 700 }],
   };`,
);

// partages du forum : une chasse et un flood de moi déjà partagés (remplacés
// par la page), un flood d'Alpha sur la cible, un flood de Beta sur moi
const PARTAGES = {
  chasses: { moi: [{ date: "2026-11-09 10:30", terrain: 1000 }] },
  floods: [
    {
      date: "2026-11-09 10:40",
      cible: "Cible",
      unites: 5000,
      terrain: 5000,
      tdcCible: 100000,
      id: 7,
      lanceur: "Alpha",
    },
    {
      date: "2026-11-09 11:30",
      cible: "Moi",
      unites: 2000,
      terrain: 2000,
      tdcCible: 60000,
      id: 8,
      lanceur: "Beta",
    },
    {
      date: "2026-11-09 10:35",
      cible: "Cible",
      unites: 999,
      terrain: 999,
      tdcCible: 100000,
      id: 3,
      lanceur: "Moi",
    },
  ],
};
const CONNUS = { Moi: 60000, Cible: 100000 };
const simuler = (partages: object, depuis = "null") =>
  `PartageChasses.simuler(${JSON.stringify(partages)}, ${JSON.stringify(CONNUS)}, ${depuis})`;

describe("TdC à l'impact : calcul", () => {
  test("TdC de départ + variations arrivées à la minute d'impact ou avant", () => {
    const impact = (cle: string) =>
      page.lire(
        `PageAttaquer.tdcImpact(${simuler({ ...PARTAGES, floods: PARTAGES.floods.slice(0, 2) })}, "Moi", "Cible", "${cle}")`,
      );
    expect(impact("2026-11-09 10:20")).toEqual({
      moi: { tdc: 60000, ecart: 0 },
      cible: { tdc: 100000, ecart: 0 },
    });
    // la chasse de 10h30 et le flood d'Alpha de 10h40 (minute égale comptée)
    expect(impact("2026-11-09 10:40")).toEqual({
      moi: { tdc: 61000, ecart: 1000 },
      cible: { tdc: 95000, ecart: -5000 },
    });
    // le flood de Beta sur moi à 11h30 : 2 000 pris
    expect(impact("2026-11-09 12:00")).toEqual({
      moi: { tdc: 59000, ecart: -1000 },
      cible: { tdc: 95000, ecart: -5000 },
    });
  });

  test("relecture plus tard : les mouvements arrivés depuis l'ouverture restent comptés", () => {
    const apres = (depuis: string) =>
      page.lire(`(() => {
        heure = moment("2026-11-09 10:50", "YYYY-MM-DD HH:mm").valueOf();
        let r = PageAttaquer.tdcImpact(${simuler({ ...PARTAGES, floods: PARTAGES.floods.slice(0, 2) }, depuis)}, "Moi", "Cible", "2026-11-09 11:00");
        heure = moment("2026-11-09 10:00:20", "YYYY-MM-DD HH:mm:ss").valueOf();
        return r;
      })()`);
    // TdC de la page lus à 10h00 : la chasse de 10h30 et le flood de 10h40 sont rejoués
    expect(apres(`moment("2026-11-09 10:00", "YYYY-MM-DD HH:mm")`)).toEqual({
      moi: { tdc: 61000, ecart: 1000 },
      cible: { tdc: 95000, ecart: -5000 },
    });
    // sans heure de lecture, ils seraient perdus
    expect(apres("null")).toEqual({
      moi: { tdc: 60000, ecart: 0 },
      cible: { tdc: 100000, ecart: 0 },
    });
  });

  test("mes floods : ceux de la liste du jeu ; mes chasses : celles de Ressources.php si lues", () => {
    const d = page.lire<{
      chasses: Record<string, object[]>;
      floods: { id: number; lanceur: string }[];
    }>(
      `PageAttaquer.avecMesMouvements(${JSON.stringify(PARTAGES)}, "Moi", [{ date: "2026-11-09 10:45", cible: "Cible", terrain: 4000, id: 9 }], [{ date: "2026-11-09 10:50", terrain: 700 }])`,
    );
    expect(d.floods.map((f) => [f.id, f.lanceur])).toEqual([
      [7, "Alpha"],
      [8, "Beta"],
      [9, "Moi"],
    ]);
    expect(d.chasses.moi).toEqual([{ date: "2026-11-09 10:50", terrain: 700 }]);
    // Ressources.php illisible : les chasses partagées restent
    expect(
      page.lire(
        `PageAttaquer.avecMesMouvements(${JSON.stringify(PARTAGES)}, "Moi", [], null).chasses.moi`,
      ),
    ).toEqual([{ date: "2026-11-09 10:30", terrain: 1000 }]);
  });
});

// lanceur ouvert sur Cible (100 000 cm²), moi à 60 000 cm², 1 h de trajet
function ouvrir() {
  page.lire(`(() => {
    localStorage.clear();
    localStorage.setItem("outiiil_parametre", JSON.stringify({ reserveFlood: 0, reserveFloodAuto: false, methodeFlood: 0 }));
    window.monProfil = new Joueur({ pseudo: "Moi" }).getParametre();
    monProfil.getTempsParcours2 = () => 3600;
    document.body.innerHTML = '<span id="quantite_tdc">60000</span><table class="simulateur"></table>';
    window.p = Object.create(PageAttaquer.prototype);
    p._cible = { pseudo: "Cible", terrain: 100000, x: 0, y: 0, id: 5 };
    p._armee = new Armee({ unite: { "Jeune Soldate Naine": 1000000 } });
    p._armee.envoyerFlood = () => {};
    p._nbAttaque = 4;
    p._ouverture = moment(heure);
    window.preparations = 0;
    let preparer = p.preparerFlood;
    p.preparerFlood = function () { preparations++; return preparer.apply(this, arguments); };
    // mon flood en cours (liste du jeu de la page) : 4 000 cm² sur Cible à 10h45
    AttaqueLancee.extraireLignes = () => [{ cible: "Cible", id: 9 }];
    AttaqueLancee.charger = () => [{ id: 9, cible: "Cible", lieu: "Terrain de Chasse", arrivee: moment("2026-11-09 10:44:30", "YYYY-MM-DD HH:mm:ss").valueOf(), unite: { "Jeune Soldate Naine": 4000 }, terrainDepart: 100000, terrainCible: 96000, terrainConnu: 100000 }];
    AttaqueLancee.pourPartage = (a) => ({ ...a.capture });
    PartageChasses.charger = () => Promise.resolve(${JSON.stringify(PARTAGES)});
    $.get = () => Promise.resolve("<html></html>");
    p.formulaireFlood();
  })()`);
}
const attendre = () => new Promise((r) => setTimeout(r, 30));
const texte = (s: string) =>
  page
    .lire<string>(`$(${JSON.stringify(s)}).text()`)
    .replace(/[\s  ]+/g, " ")
    .trim();

describe("TdC à l'impact : lanceur de flood", () => {
  test("boutons à gauche des TdC à l'impact, sous « Supprimer / Ajouter une attaque »", () => {
    ouvrir();
    expect(page.lire(`$("#o_simulationFlood tr:last").prev().hasClass("o_floodImpactLigne")`)).toBe(
      true,
    );
    expect(page.lire(`$("#o_floodActions").next().hasClass("o_floodImpactLigne")`)).toBe(true);
    expect(page.lire(`$(".o_floodBoutonsCase .o_floodBoutons #o_lanceFlood").length`)).toBe(1);
    // le flood part toujours sur le TdC : les deux boutons en vert « terrain »
    expect(page.lire(`$("#o_lanceFlood, #o_lanceFloodPartager").filter(".o_lieu1").length`)).toBe(
      2,
    );
    expect(texte(".o_floodImpact")).toBe("Calculer le TdC à l'impact");
    // une attaque ajoutée passe avant « Supprimer / Ajouter », pas après les TdC à l'impact
    const lignes = page.lire<number>(`$("input[id^='o_attaque']").length`);
    page.lire(`p.ajouterAttaque()`);
    expect(page.lire(`$("input[id^='o_attaque']").length`)).toBe(lignes + 1);
    expect(page.lire(`$("#o_floodActions").prev().find("input[id^='o_attaque']").length`)).toBe(1);
    expect(page.lire(`$("#o_simulationFlood tr:last").hasClass("o_floodImpactLigne")`)).toBe(true);
  });

  test("clic sur « Calculer » : TdC à l'impact et écart, mes mouvements compris", async () => {
    ouvrir();
    page.lire(`$(".o_floodImpactLire").click()`);
    await attendre();
    // impact à 11h01 : ma chasse de Ressources (10h50, +700), mon flood (10h45, 4 000 pris),
    // le flood d'Alpha (10h40, 5 000) ; mon ancien flood partagé #3 n'est plus compté
    expect(page.lire(`$(".o_tdcImpact").map((i, e) => e.dataset.valeur).get()`)).toEqual([
      "64700",
      "91000",
    ]);
    expect(texte(".o_floodImpact")).toBe("64 700 (+4 700)91 000 (-9 000)");
    expect(texte(".o_floodImpactInfo")).toBe("TdC à l'impact (09/11 11h01) · Relire");
    // une minute plus tard, l'impact suit l'horloge, sans nouvelle lecture
    page.lire(`heure += 60000; p.afficherImpact();`);
    expect(texte(".o_floodImpactInfo")).toContain("(09/11 11h02)");
    page.lire(`heure -= 60000;`);
  });

  test("clic sur un TdC : il va dans son champ et la simulation se recalcule", async () => {
    ouvrir();
    page.lire(`$(".o_floodImpactLire").click()`);
    await attendre();
    const avant = page.lire<number>(`preparations`);
    page.lire(`$(".o_tdcImpact[data-champ='o_floodTDCB']").click()`);
    expect(page.lire(`$("#o_floodTDCB").spinner("value")`)).toBe(91000);
    page.lire(`$(".o_tdcImpact[data-champ='o_floodTDCA']").click()`);
    expect(page.lire(`$("#o_floodTDCA").spinner("value")`)).toBe(64700);
    expect(page.lire<number>(`preparations`)).toBe(avant + 2);
  });

  test("au lancement, le forum garde le TdC de la cible connu au lancement", async () => {
    ouvrir();
    page.lire(`$(".o_floodImpactLire").click()`);
    await attendre();
    page.lire(`$(".o_tdcImpact[data-champ='o_floodTDCB']").click(); $("#o_lanceFlood").click();`);
    expect(page.lire(`AttaqueLancee.contexteFlood.terrain`)).toBe(100000);
    // valeur tapée à la main : elle compte comme TdC plus frais au lancement
    ouvrir();
    page.lire(`$("#o_floodTDCB").spinner("value", 98000); $("#o_lanceFlood").click();`);
    expect(page.lire(`AttaqueLancee.contexteFlood.terrain`)).toBe(98000);
  });

  test("cible hors portée à l'impact : mention en rouge", async () => {
    ouvrir();
    page.lire(`p._cible.terrain = 25000; $(".o_floodImpactLire").click()`);
    await attendre();
    expect(texte(".o_floodHorsPortee")).toBe(
      "Hors portée à l'impact : le flood ne prendrait rien.",
    );
  });

  test("case décochée : ni lien ni lignes, boutons sous le tableau", () => {
    page.lire(`localStorage.setItem("fzzz_affichage_floodImpact", "0")`);
    ouvrir();
    page.lire(`localStorage.setItem("fzzz_affichage_floodImpact", "0")`);
    page.lire(`$("#o_prepaFlood").remove(); p.formulaireFlood();`);
    expect(page.lire(`$(".o_floodImpactLigne").length`)).toBe(0);
    expect(page.lire(`$("#o_simulationFlood").next().hasClass("o_floodBoutons")`)).toBe(true);
  });
});
