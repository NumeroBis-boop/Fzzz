import { beforeEach, describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * « Multi-flood opti » avec la vraie simulation des partages
 * (PartageChasses.simuler, PageAttaquer.tdcImpact) : le cas de la capture du
 * mainteneur du 19/11/2026 (TdC, trajets et mouvements de la capture, joueurs
 * renommés), et un flood déjà lancé que ce multi-flood fait sortir de portée.
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
    "js/page/MultiFlood.js",
  ],
  `var METHODE_FLOOD = ["Standard", "Optimisée", "Uniforme", "Dégressive"],
     AFFECTATION_RESSOURCE = [], RATIO_RECOLTE = {},
     TOAST_ERROR = {}, TOAST_SUCCESS = {}, TOAST_WARNING = {}, TOAST_INFO = {};
   var NOM_UNITE = ["Ouvrière", "Jeune Soldate Naine"], NOM_UNITES = ["Ouvrières", "Jeunes Soldates Naines"];
   var LIEU_JEU_TERRAIN = 1;
   var heure = moment("2026-11-19 00:30:00", "YYYY-MM-DD HH:mm:ss").valueOf();
   var Horloge = { maintenant: () => heure, serveur: () => moment(heure), clic: () => moment(heure), latence: 0 };
   var AttaqueLancee = { zoneLieu: () => "Terrain", extraireLignes: () => [], charger: () => [], pourPartage: (x) => x };
   var PageRessource = { lireChasses: () => [], grouperChasses: (c) => c, aPartager: () => [] };`,
  "https://s5.fourmizzz.fr/ennemie.php",
);
const lire = <T = any>(e: string) => page.lire<T>(e);

/** Page Armée inventée : 150 000 JSN en garnison. */
const ARMEE =
  "<table class='simulateur'><tr><td colspan=10><h3> Troupes en Garnison </h3></td></tr>" +
  "<tr align='center'><td><div class='pas_sur_telephone'>Jeune Soldate Naine</div></td><td><span class='cliquable'>150 000</span></td></tr></table>";

/**
 * Capture : moi 59 812, mes chasses à 06h05 (+61 648) ; Alpha 62 583 (impact
 * 04h21, sa chasse à 08h11), Bravo 55 418 (04h38), Charlie 45 002 (05h38),
 * Delta 65 633 (09h07, sa chasse à 04h45 : +49 004).
 */
const PARTAGES = {
  chasses: {
    moi: [{ date: "2026-11-19 06:05", terrain: 61648 }],
    alpha: [{ date: "2026-11-19 08:11", terrain: 94950 }],
    delta: [{ date: "2026-11-19 04:45", terrain: 49004 }],
  },
  floods: [] as object[],
};

// mon flood déjà lancé sur Echo (40 000), à 05h00 : à portée de mes 59 812, plus
// de mes 106 460 après les attaques cochées sur Alpha et Bravo
const ECHO = {
  id: 500,
  date: "2026-11-19 05:00",
  lanceur: "Moi",
  cible: "Echo",
  unites: 9000,
  terrain: 8000,
  tdcCible: 40000,
};

const ouvrir = (partages: object | null, tdcMembres: object = {}) =>
  lire(`(() => {
    localStorage.clear();
    localStorage.setItem("outiiil_parametre", JSON.stringify({ reserveFlood: 0, reserveFloodAuto: false }));
    window.monProfil = new Joueur({ pseudo: "Moi" }).getParametre();
    monProfil.niveauRecherche[6] = 9;
    document.body.innerHTML = "<div id='data'><div id='quantite_tdc'>59812</div></div><div id='centre'></div>";
    MultiFlood._construire();
    const r = etatMultiFlood.gardees.reglage;
    r.antisondes = false;
    r.autres = [];
    MultiFlood.lireArmee(${JSON.stringify(ARMEE)});
    const cible = (pseudo, tdc, trajet) => ({ pseudo, id: 1, mv: false, tdcLu: tdc, moiLu: 59812,
      lu: moment(heure), trajet, tdcSaisi: null, saisiA: null, terrainFinal: null, priseMax: null,
      arrondi: 4, choix: {} });
    etatMultiFlood.cibles = [
      cible("Delta", 65633, 31020),
      cible("Alpha", 62583, 13860),
      cible("Charlie", 45002, 18480),
      cible("Bravo", 55418, 14880),
    ];
    etatMultiFlood.partages = ${partages ? `{ d: ${JSON.stringify(partages)}, tdc: ${JSON.stringify(tdcMembres)} }` : "null"};
    MultiFlood.rendre();
  })()`);
const avertissement = () => lire<string>(`$("#o_mfoAvertissement").text()`);
const notes = () =>
  lire<string[]>(`$(".o_mfoNote").map((i, e) => $(e).text().replace(/\\s+/g, " ")).get()`);
const lignes = (pseudo: string) =>
  lire<string[][]>(
    `$(".o_mfoCible[data-pseudo='${pseudo}'] tr").filter((i, tr) => $(tr).children("td").length && !$(tr).find(".o_mfoNote").length).map((i, tr) => [$(tr).children("td").map((j, td) => $(td).text().trim().replace(/\\s+/g, " ")).get()]).get()`,
  );

beforeEach(() => lire(`heure = moment("2026-11-19 00:30:00", "YYYY-MM-DD HH:mm:ss").valueOf()`));

describe("capture du 19/11 : chaque cible à son TdC à l'impact", () => {
  test("mêmes attaques que la capture ; la ligne sous chaque titre donne les TdC d'où partent ses attaques", () => {
    ouvrir(PARTAGES);
    expect(lignes("Alpha")).toEqual([
      ["Attaque 1 (20 %)", "59 812", "62 583", "12 516"],
      ["Attaque 2 (19 %)", "72 328", "50 067", "9 268"],
      ["Attaque 3 (20 %)", "81 596", "40 799", "8 159"],
      ["Résultat", "89 755", "32 640", "29 943"],
    ]);
    expect(lignes("Bravo")).toEqual([
      ["Attaque 1 (13 %)", "89 755", "55 418", "7 027"],
      ["Attaque 2 (20 %)", "96 782", "48 391", "9 678"],
      ["Résultat", "106 460", "38 713", "16 705"],
    ]);
    expect(lignes("Charlie")).toEqual([
      ["Le terrain de la cible est trop bas à l'impact"],
      ["Résultat", "106 460", "45 002", "0"],
    ]);
    // mes chasses (06h05) arrivent avant l'impact sur Delta : comptées
    expect(lignes("Delta")).toEqual([
      ["Attaque 1 (18 %)", "168 108", "114 637", "20 388"],
      ["Attaque 2 (20 %)", "188 496", "94 249", "18 849"],
      ["Résultat", "207 345", "75 400", "39 237"],
    ]);
    expect(notes()).toEqual([
      // la chasse d'Alpha (08h11) arrive après l'impact : pas comptée
      "À l'impact le 19/11 à 04h21 : toi 59 812, Alpha 62 583",
      "À l'impact le 19/11 à 04h38 : toi 89 755 (+29 943 de ce multi-flood), Bravo 55 418",
      "À l'impact le 19/11 à 05h38 : toi 106 460 (+46 648 de ce multi-flood), Charlie 45 002",
      "À l'impact le 19/11 à 09h07 : toi 168 108 (+61 648 des chasses et floods en cours, +46 648 de ce multi-flood), Delta 114 637 (+49 004 des chasses et floods en cours)",
    ]);
    expect(lire<string>(`$("#o_mfoRecap").text()`)).toContain(
      "Ce flood demande 7 attaques et 85 885 fourmis",
    );
  });

  test("un flood déjà lancé que ce multi-flood fait sortir de portée ne prend rien (l'ancien calcul le comptait)", () => {
    // mon flood sur Echo (40 000) arrive à 05h00 : à portée de mes 59 812, plus
    // de mes 106 460 après les attaques sur Alpha et Bravo
    const avecFlood = { ...PARTAGES, floods: [ECHO] };
    ouvrir(avecFlood);
    // sans ce multi-flood, le flood prendrait 8 000 ; avec, rien : Delta part de
    // 59 812 + 46 648 + 61 648, et non de 176 108 (prises ajoutées après coup)
    expect(lignes("Delta")[0]).toEqual(["Attaque 1 (18 %)", "168 108", "114 637", "20 388"]);
    expect(notes()[2]).toBe(
      "À l'impact le 19/11 à 05h38 : toi 106 460 (+8 000 des chasses et floods en cours, +38 648 de ce multi-flood), Charlie 45 002",
    );
    expect(notes()[3]).toBe(
      "À l'impact le 19/11 à 09h07 : toi 168 108 (+69 648 des chasses et floods en cours, +38 648 de ce multi-flood), Delta 114 637 (+49 004 des chasses et floods en cours)",
    );
    // les partages lus ne sont pas touchés par la simulation
    expect(lire(`etatMultiFlood.partages.d.floods`)).toEqual(avecFlood.floods);
  });

  test("avertissement : un flood déjà lancé que les attaques cochées font sortir de portée, au-dessus du bouton et dans la confirmation", async () => {
    ouvrir({ ...PARTAGES, floods: [ECHO] });
    expect(avertissement()).toBe(
      "⚠ Avec les attaques cochées, ton flood déjà lancé sur Echo (impact le 19/11 à 05h00) serait hors de portée : il ne prendrait rien au lieu de 8 000.",
    );
    // avant le bouton « Lancer + partager »
    expect(lire(`$("#o_mfoAvertissement").next().hasClass("o_mfoBoutons")`)).toBe(true);
    // la confirmation le répète ; refusée, rien ne part
    lire(`window.CONFIRMATIONS = []; window.confirm = (t) => (CONFIRMATIONS.push(t), false)`);
    await lire(`MultiFlood.lancer(true)`);
    expect(lire<string[]>(`CONFIRMATIONS`)[0]).toContain(
      "Attention : Avec les attaques cochées, ton flood déjà lancé sur Echo (impact le 19/11 à 05h00) serait hors de portée",
    );
    expect(lire(`etatMultiFlood.lance`)).toBe(false);
  });

  test("avertissement retiré quand plus aucune attaque cochée n'arrive avant ce flood, ou sans TdC à l'impact", () => {
    ouvrir({ ...PARTAGES, floods: [ECHO] });
    // attaques sur Alpha (04h21) et Bravo (04h38) décochées : mon TdC n'a pas encore monté à 05h00
    lire(
      `etatMultiFlood.cibles.filter((c) => ["Alpha", "Bravo"].includes(c.pseudo)).forEach((c) => { c.choix = { 0: false, 1: false, 2: false }; }); MultiFlood.rendre()`,
    );
    expect(avertissement()).toBe("");
    lire(`etatMultiFlood.cibles.forEach((c) => { c.choix = {}; }); MultiFlood.rendre()`);
    expect(avertissement()).not.toBe("");
    // case « TdC à l'impact » décochée : pas de simulation, pas d'avertissement
    lire(`localStorage.setItem("fzzz_multiFloodImpact", "0"); MultiFlood.rendre()`);
    expect(avertissement()).toBe("");
    lire(`localStorage.removeItem("fzzz_multiFloodImpact")`);
  });

  test("pas d'avertissement quand les attaques cochées ne changent la portée d'aucun de mes floods", () => {
    ouvrir(PARTAGES);
    expect(avertissement()).toBe("");
    // mon flood sur Golf (20 000) : déjà hors de portée de mes 59 812, ce multi-flood n'y change rien
    ouvrir({ ...PARTAGES, floods: [{ ...ECHO, id: 503, cible: "Golf", tdcCible: 20000 }] });
    expect(avertissement()).toBe("");
    // Foxtrot (35 000) me floode à 05h00 : à sa portée avec mes 59 812, plus avec mes
    // 106 460 ; son flood ne prend plus rien, c'est un gain pour moi, pas un avertissement
    ouvrir(
      {
        ...PARTAGES,
        floods: [{ ...ECHO, id: 501, lanceur: "Foxtrot", cible: "Moi", tdcCible: null }],
      },
      { foxtrot: 35000 },
    );
    // les attaques cochées du plan, rejouées comme floodsPerdus() le fait
    expect(
      lire(`(() => {
        let att = etatMultiFlood.resultats.filter((r) => r.impact.partages).flatMap((r) =>
          r.attaques.filter((a) => a.coche).map((a) => ({ pseudo: r.cible.pseudo, cle: r.impact.cle, prise: a.prise, tdc: r.cible.tdcLu })));
        return MultiFlood._simuler(etatMultiFlood.cibles[0], att).evenements.find((e) => e.id == 501).statut;
      })()`),
    ).toBe("portee");
    expect(avertissement()).toBe("");
  });

  test("mon flood déjà lancé sur une cible du multi-flood, après ses attaques : avertissement, avec le TdC lu sur sa page", () => {
    // lancé quand Bravo avait 20 000 ; sa page en donne 55 418 : sans ce multi-flood,
    // il prend 9 000 à 06h00 (à portée de mes 59 812) ; avec, Bravo n'a plus que 38 713
    // face à mes 106 460
    ouvrir({
      ...PARTAGES,
      floods: [{ ...ECHO, id: 502, date: "2026-11-19 06:00", cible: "Bravo", tdcCible: 20000 }],
    });
    expect(avertissement()).toBe(
      "⚠ Avec les attaques cochées, ton flood déjà lancé sur Bravo (impact le 19/11 à 06h00) serait hors de portée : il ne prendrait rien au lieu de 9 000.",
    );
  });

  test("partages illisibles : TdC lus plus les prises cochées des plus proches, sans ligne d'impact", () => {
    ouvrir(null);
    expect(lignes("Bravo")[0]).toEqual(["Attaque 1 (13 %)", "89 755", "55 418", "7 027"]);
    expect(lignes("Delta")[0]?.[1]).toBe("106 460");
    expect(notes()).toEqual([]);
  });

  test("case « TdC à l'impact » décochée : TdC actuels plus les prises cochées, comme la page du Compte+", () => {
    lire(`localStorage.setItem("fzzz_multiFloodImpact", "0")`);
    ouvrir(PARTAGES);
    lire(`localStorage.setItem("fzzz_multiFloodImpact", "0"); MultiFlood.rendre()`);
    // 106 460 = 59 812 + les prises cochées sur Alpha et Bravo ; limite des deux
    // tiers de (65 633 + 106 460) : 114 728, d'où une première attaque de 8 268
    expect(lignes("Delta")[0]).toEqual(["Attaque 1 (13 %)", "106 460", "65 633", "8 268"]);
    expect(notes()).toEqual([]);
    lire(`localStorage.removeItem("fzzz_multiFloodImpact")`);
  });
});
