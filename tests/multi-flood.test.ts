import { beforeEach, describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * « Multi-flood opti » (menu Fourmilière, 18/11/2026, demande du mainteneur) :
 * le Flood TdC du Compte+ (page simulateurFlood.php) pour tous les joueurs,
 * avec le TdC de chacun à l'impact et autant de cibles que voulu, dans la
 * forme de la page du jeu (1.132.0). Les cas « capture » reprennent les
 * captures de la page du jeu envoyées par le mainteneur (TdC et pseudos du
 * jeu de la capture, armée inventée ou déduite de la capture).
 */
const page = creerPage(
  [
    "js/lib/jquery-ui_1.12.1.js",
    "js/lib/globalize_0.1.1.js",
    "js/lib/globalize-locale-fr.js",
    "js/lib/moment-duration-format.js",
    "js/class/Utils.js",
    "js/class/Parametre.js",
    "js/class/Joueur.js",
    "js/class/Armee.js",
    "js/class/UnitesGardees.js",
    "js/page/MultiFlood.js",
  ],
  `var METHODE_FLOOD = [], AFFECTATION_RESSOURCE = [], RATIO_RECOLTE = {},
     TOAST_ERROR = {}, TOAST_SUCCESS = {}, TOAST_WARNING = {}, TOAST_INFO = {};
   var NOM_UNITE = ["Ouvrière", "Jeune Soldate Naine", "Soldate Naine", "Naine d’Elite", "Jeune Soldate"],
     NOM_UNITES = ["Ouvrières", "Jeunes Soldates Naines", "Soldates Naines", "Naines d’Elite", "Jeunes Soldates"];
   var LIEU_JEU_TERRAIN = 1;
   var heure = Date.UTC(2026, 10, 18, 9, 0, 0);
   var Horloge = { maintenant: () => heure, serveur: () => moment(heure), clic: () => moment(heure), serveurA: (t) => moment(t) };
   var ENREGISTRES = [];
   var AttaqueLancee = { extraireLignes: () => [], charger: () => [], pourPartage: (x) => x,
     enregistrer: (...a) => ENREGISTRES.push(a) };
   var PageRessource = { lireChasses: () => [], grouperChasses: (c) => c, aPartager: () => [] };
   var PartageChasses = { charger: () => Promise.reject(new Error("sans sujet commun")),
     completer: (d) => Promise.resolve({ d, tdc: {} }), tdcMembres: () => Promise.resolve({}),
     entreesFloods: () => [], avecMesMouvements: (d) => d, simuler: () => ({}), tdcConnus: (a, b) => ({ ...a, ...b }) };
   var PageAttaquer = { tdcImpact: () => ({ moi: { tdc: null }, cible: { tdc: null } }) };`,
  "https://s5.fourmizzz.fr/ennemie.php",
);
const lire = <T = any>(e: string) => page.lire<T>(e);
const cible = (t0: number, ti: number, o: object = {}) =>
  lire<any>(`MultiFlood.attaquesCible(${t0}, ${ti}, ${JSON.stringify(o)})`);
const prises = (r: any) => r.attaques.map((a: any) => [a.prise, a.pct, a.moi, a.cible]);

describe("attaques sur une cible : celles de la page Flood TdC du jeu", () => {
  test("capture 2 : Cocop puis Grim, Staffie trop bas", () => {
    const cocop = cible(73254, 75253);
    expect(prises(cocop)).toEqual([
      [15050, 20, 73254, 75253],
      [10700, 18, 88304, 60203],
      [9900, 20, 99004, 49503],
    ]);
    expect([cocop.total, cocop.moiFin, cocop.cibleFin]).toEqual([35650, 108904, 39603]);
    const grim = cible(108904, 171672);
    expect(prises(grim)).toEqual([
      [34334, 20, 108904, 171672],
      [27467, 20, 143238, 137338],
      [16345, 15, 170705, 109871],
      [18705, 20, 187050, 93526],
    ]);
    expect([grim.total, grim.moiFin, grim.cibleFin]).toEqual([96851, 205755, 74821]);
    expect(cible(205755, 62427).hors).toBe("bas");
  });

  test("capture 1 : attaque d'appoint de 3 % pour finir à la limite de portée", () => {
    const cocop = cible(143072, 75253);
    expect(prises(cocop)).toEqual([
      [2478, 3, 143072, 75253],
      [14555, 20, 145550, 72775],
    ]);
    expect([cocop.total, cocop.moiFin, cocop.cibleFin]).toEqual([17033, 160105, 58220]);
    expect(prises(cible(160105, 141428))).toEqual([
      [28285, 20, 160105, 141428],
      [12632, 11, 188390, 113143],
      [20102, 20, 201022, 100511],
    ]);
    expect(cible(221124, 92671).hors).toBe("bas");
  });

  test("portée du jeu : plus de trois fois mon TdC, ou moins de la moitié ; TdC inconnu", () => {
    expect(cible(100000, 300001).hors).toBe("haut");
    expect(cible(100000, 300000).hors).toBeNull();
    expect(cible(100000, 49999).hors).toBe("bas");
    expect(cible(100000, 50000).hors).toBeNull();
    expect(cible(0, 50000).hors).toBe("inconnu");
  });

  test("trajet écrit comme la page du jeu : deux unités au plus", () => {
    expect([13740, 56202, 90061, 61, 59, 0].map((s) => lire(`MultiFlood.duree(${s})`))).toEqual([
      "3h 49m",
      "15h 36m",
      "1j 1h",
      "1m 1s",
      "59s",
      "0s",
    ]);
  });

  test("arrondir : Fort, Normal, Faible, sur la prise totale", () => {
    const arrondi = (prise: number, n: number) => lire(`MultiFlood.arrondir(${prise}, ${n})`);
    expect([1, 2, 3, 4].map((n) => arrondi(35650, n))).toEqual([25000, 35000, 35500, 35650]);
    expect(arrondi(17033, 2)).toBe(17000);
    expect(arrondi(96851, 1)).toBe(50000);
    const r = cible(73254, 75253, { arrondi: 2 });
    expect([r.priseMax, r.total, r.attaques.length]).toEqual([35000, 35000, 3]);
  });

  test("options : terrain final et prise max de la cible ou de moi ; déjà atteints, rien", () => {
    expect(prises(cible(73254, 75253, { terrainFinal: 60000 })).map((a: number[]) => a[0])).toEqual(
      [15050, 203],
    );
    expect(cible(73254, 75253, { terrainFinal: 80000 }).attaques).toEqual([]);
    expect(
      prises(cible(73254, 75253, { terrainFinalMoi: 80000 })).map((a: number[]) => a[0]),
    ).toEqual([6746]);
    expect(cible(73254, 75253, { terrainFinalMoi: 70000 }).attaques).toEqual([]);
    expect(prises(cible(73254, 75253, { priseMax: 10000 })).map((a: number[]) => a[0])).toEqual([
      10000,
    ]);
    // prise max d'une cible ou de tout le multi-flood : la plus petite ; pas d'arrondi alors
    const r = cible(73254, 75253, { priseMax: 30000, priseGlobale: 20000, arrondi: 1 });
    expect([r.priseMax, r.total]).toEqual([20000, 20000]);
  });
});

describe("plan sur plusieurs cibles", () => {
  const cibles = (liste: object[]) => JSON.stringify(liste);
  const plan = (a: object, liste: object[]) =>
    lire<any[]>(`MultiFlood.plan(${JSON.stringify(a)}, ${cibles(liste)})`);
  const C = (pseudo: string, trajet: number, tdc: number, plus: object = {}) => ({
    pseudo,
    trajet,
    tdcMoi: 73254,
    tdc,
    attaquable: true,
    choix: {},
    ...plus,
  });

  test("plus proche d'abord, cochées tant que l'armée et les créneaux suffisent (capture 2)", () => {
    const r = plan({ armee: 65136, attaquesDispo: 10 }, [
      C("Grim", 14820, 171672),
      C("Staffie", 19020, 62427),
      C("Cocop", 13740, 75253),
    ]);
    expect(r.map((x) => x.pseudo)).toEqual(["Cocop", "Grim", "Staffie"]);
    expect(r[0].attaques.map((a: any) => a.coche)).toEqual([true, true, true]);
    // la page du jeu : plus rien de coché après une attaque qui ne tient pas
    expect(r[1].attaques.map((a: any) => a.coche)).toEqual([false, false, false, false]);
    // mon TdC à l'impact de Staffie : avec les seules attaques cochées (Cocop),
    // Staffie est donc à portée (la page du jeu comptait aussi celles de Grim)
    expect([r[2].t0, r[2].hors]).toEqual([108904, null]);
    expect(r[2].attaques.every((a: any) => !a.coche)).toBe(true);
  });

  test("capture 3 (18/11) : avec les TdC actuels, les attaques et les « Résultat » de la page du jeu", () => {
    // 5 attaques sur 9 libres (55 %), 57 946 fourmis pour 89 % de l'armée : 65 000 JSN
    const r = plan({ armee: 65000, attaquesDispo: 9 }, [
      C("Staffie", 19020, 62427),
      C("Grim", 14820, 87897),
      C("Cocop", 13740, 75253),
    ]);
    const lignes = (x: any) =>
      x.attaques.map((a: any) => [a.prise, a.pct, a.moi, a.cible, a.coche]);
    expect(r.map((x) => x.pseudo)).toEqual(["Cocop", "Grim", "Staffie"]);
    expect(lignes(r[0])).toEqual([
      [15050, 20, 73254, 75253, true],
      [10700, 18, 88304, 60203, true],
      [9900, 20, 99004, 49503, true],
    ]);
    expect([r[0].moiFin, r[0].cibleFin, r[0].total]).toEqual([108904, 39603, 35650]);
    // l'attaque 3 ne tient plus dans l'armée : décochée, comme sur la page du jeu
    expect(lignes(r[1])).toEqual([
      [17579, 20, 108904, 87897, true],
      [4717, 7, 126483, 70318, true],
      [13120, 20, 131200, 65601, false],
    ]);
    // « Résultat » de Grim : toutes ses attaques calculées, comme la page du jeu
    expect([r[1].moiFin, r[1].cibleFin, r[1].total]).toEqual([144320, 52481, 35416]);
    // Staffie trop bas ; la cible suivante part des seules attaques cochées (le jeu : 144 320)
    expect([r[2].hors, r[2].t0, r[2].total]).toEqual(["bas", 131200, 0]);
    const cochees = r.flatMap((x) => x.attaques.filter((a: any) => a.coche));
    expect([cochees.length, cochees.reduce((t: number, a: any) => t + a.prise, 0)]).toEqual([
      5, 57946,
    ]);
  });

  test("créneaux d'attaque : pas plus que les libres", () => {
    const r = plan({ armee: 1e9, attaquesDispo: 2 }, [C("Cocop", 100, 75253)]);
    expect(r[0].attaques.map((a: any) => a.coche)).toEqual([true, true, false]);
  });

  test("choix du joueur gardé, sans changer les autres cases ; une cible en vacances n'a pas de case", () => {
    const r = plan({ armee: 65136, attaquesDispo: 10 }, [
      C("Cocop", 100, 75253, { choix: { 0: false } }),
      C("Bravo", 200, 80000, { attaquable: false }),
    ]);
    expect(r[0].attaques.map((a: any) => a.coche)).toEqual([false, true, true]);
    expect([r[0].lance, r[1].t0]).toEqual([20600, 73254 + 20600]);
    expect(r[1].attaques.some((a: any) => a.coche)).toBe(false);
  });

  test("TdC à l'impact : celui de chaque cible, plus les prises cochées sur les plus proches", () => {
    const r = plan({ armee: 1e9, attaquesDispo: 10 }, [
      C("Cocop", 100, 75253),
      // une chasse de 20 000 cm² arrive entre les deux impacts
      C("Grim", 200, 171672, { tdcMoi: 93254 }),
    ]);
    expect(r[1].t0).toBe(93254 + 35650);
  });

  test("TdC à l'impact simulé avec les attaques cochées des plus proches : passées dans l'ordre d'envoi", () => {
    lire(`(() => {
      window.DEMANDES = [];
      window.IMPACT = (c, precedentes) => {
        DEMANDES.push([c.pseudo, precedentes.map((p) => [p.c.pseudo, p.prise])]);
        // la simulation compte les prises, et un flood sur moi entre deux impacts
        return { partages: true, moi: c.tdcMoi + precedentes.reduce((n, p) => n + p.prise, 0) - 1000, cible: c.tdc };
      };
    })()`);
    const r = lire<any[]>(
      `MultiFlood.plan({ armee: 1e9, attaquesDispo: 10 }, ${cibles([C("Grim", 200, 171672), C("Cocop", 100, 75253)])}, IMPACT)`,
    );
    // Cocop calculée sur mon TdC simulé (73 254 − 1 000), Grim avec ses attaques
    const cocop = cible(72254, 75253).attaques.map((a: any) => a.prise);
    expect(cocop).toEqual([15050, 11034, 9833]);
    expect(lire(`DEMANDES`)).toEqual([
      ["Cocop", []],
      ["Grim", cocop.map((p: number) => ["Cocop", p])],
    ]);
    expect([r[0].t0, r[0].ti, r[1].t0, r[1].ti]).toEqual([
      72254,
      75253,
      73254 + 15050 + 11034 + 9833 - 1000,
      171672,
    ]);
    // sans simulation (partages : false) : les prises cochées ajoutées, comme avant
    const sans = lire<any[]>(
      `MultiFlood.plan({ armee: 1e9, attaquesDispo: 10 }, ${cibles([C("Cocop", 100, 75253), C("Grim", 200, 171672)])}, () => ({ partages: false }))`,
    );
    expect(sans[1].t0).toBe(73254 + 35650);
  });

  test("prise max de tout le multi-flood : partagée entre les cibles", () => {
    const r = plan({ armee: 1e9, attaquesDispo: 10, priseMax: 40000 }, [
      C("Cocop", 100, 75253),
      C("Grim", 200, 171672),
    ]);
    expect([r[0].total, r[1].total]).toEqual([35650, 4350]);
  });
});

/** Page Armée inventée : 65 136 JSN en garnison. */
const ARMEE =
  "<table class='simulateur'><tr><td colspan=10><h3> Troupes en Garnison </h3></td></tr>" +
  "<tr align='center'><td><div class='pas_sur_telephone'>Jeune Soldate Naine</div></td><td><span class='cliquable'>50 000</span></td><td><span class='cliquable'>15 136</span></td></tr></table>";
/** Page d'un membre inventée : id, coordonnées, TdC ; mon TdC dans la boîte du jeu. */
const membre = (pseudo: string, id: number, x: number, tdc: number) =>
  `<div><div id='quantite_tdc'>73254</div><h2>${pseudo}</h2><div class='boite_membre'><a href='carte.php?x=${x}&y=36'>x=${x} et y=36</a></div>` +
  `<a href='commerce.php?ID=${id}'>Convoi</a><table class='tableau_score'><tr><td></td></tr><tr><td>Terrain</td><td>${tdc}</td></tr></table></div>`;
const ATTAQUE = (pseudo: string) =>
  `<form><input type='hidden' name='pseudoCible' value='${pseudo}'/><input type='hidden' id='t' name='t' value='jeton'/><table id='tabChoixArmee'></table></form>`;

describe("vue de la page Ennemies", () => {
  beforeEach(() => {
    lire(`(() => {
      localStorage.clear();
      localStorage.setItem("outiiil_parametre", JSON.stringify({ reserveFlood: 0, reserveFloodAuto: false }));
      window.monProfil = new Joueur({ pseudo: "Moi" }).getParametre();
      monProfil.niveauRecherche[6] = 9;
      monProfil.getTempsParcours2 = (j) => ({ Cocop: 13740, Grim: 14820 })[j.pseudo] ?? 20000;
      etatMultiFlood = null;
      history.replaceState(null, "", "/ennemie.php");
      document.body.innerHTML = "<div id='data'><div id='quantite_tdc'>73254</div></div>" +
        "<div id='centre'><nav id='menu'><ul id='menuFourmiliere'><li><a class='boutonReine' href='Reine.php'>Reine</a></li></ul></nav>" +
        "<table id='tabEnnemie'><tr><td>liste du jeu</td></tr></table><div class='Bas'></div></div>";
      window.ENREGISTRES = [];
      window.ENVOIS = [];
      window.OUVERT = [];
      window.confirm = () => true;
      window.setTimeout = (f) => (f(), 0);
      $.toast = () => {};
      MultiFlood.ouvrir = (u) => OUVERT.push(u);
      const pages = {
        "/Armee.php": ${JSON.stringify(ARMEE)},
        "/Ressources.php": "<div></div>",
        "/Membre.php?Pseudo=Cocop": ${JSON.stringify(membre("Cocop", 41, 20, 75253))},
        "/Membre.php?Pseudo=Grim": ${JSON.stringify(membre("Grim", 42, 30, 171672))},
        "/Membre.php?Pseudo=Staffie": ${JSON.stringify(membre("Staffie", 43, 40, 62427))},
        "/ennemie.php?Attaquer=41": ${JSON.stringify(ATTAQUE("Cocop"))},
        "/ennemie.php?Attaquer=42": ${JSON.stringify(ATTAQUE("Grim"))},
      };
      const repondre = (url) => {
        const chemin = String(url).replace(location.origin, "");
        return pages[chemin] !== undefined ? $.Deferred().resolve(pages[chemin]).promise() : $.Deferred().reject({ status: 404 }).promise();
      };
      $.get = repondre;
      $.ajax = (o) => repondre(o.url);
      $.post = (url, donnees) => {
        ENVOIS.push([String(url).replace(location.origin, ""), donnees]);
        return $.Deferred().resolve("<center>Vos troupes sont en marche !</center>").promise();
      };
    })()`);
  });
  const ouvrir = async () => {
    lire(`MultiFlood.ajouterMenu(); MultiFlood.installer()`);
    lire(`$("#o_ongletMultiFlood").trigger("click")`);
    await lire(`etatMultiFlood.lecture`);
    // aucune unité gardée, comme la page du jeu
    lire(
      `(() => { const r = etatMultiFlood.gardees.reglage; r.antisondes = false; r.autres = []; })()`,
    );
  };
  const ajouter = async (pseudo: string) => {
    await lire(`MultiFlood.ajouter(${JSON.stringify(pseudo)})`);
  };

  test("entrée du menu Fourmilière ; contenu du jeu caché, armée et créneaux lus", async () => {
    await ouvrir();
    expect(lire(`$("#menuFourmiliere a:last").attr("id")`)).toBe("o_ongletMultiFlood");
    expect(lire(`$("#menuFourmiliere a:last").text()`)).toBe("Multi-flood opti");
    expect(lire(`$("#tabEnnemie").hasClass("o_mfoCache")`)).toBe(true);
    expect(lire(`$("nav#menu").hasClass("o_mfoCache")`)).toBe(false);
    expect(lire(`$("#o_multiFlood").css("display")`)).toBe("block");
    expect([lire(`MultiFlood.disponibles()`), lire(`MultiFlood.attaquesDispo()`)]).toEqual([
      65136, 10,
    ]);
    expect(lire<string>(`$("#o_mfoEtat").text()`)).toBe(
      "Partages illisibles : les TdC actuels sont utilisés.",
    );
  });

  test("cibles ajoutées, résultats du plus proche au plus lointain, récapitulatif du jeu", async () => {
    await ouvrir();
    await ajouter("Grim");
    await ajouter("Cocop");
    expect(lire(`$("#o_mfoForm .o_mfoCiblePseudo").map((i, el) => el.value).get()`)).toEqual([
      "Grim",
      "Cocop",
      "",
    ]);
    expect(lire(`$(".o_mfoCible").map((i, t) => t.dataset.pseudo).get()`)).toEqual([
      "Cocop",
      "Grim",
    ]);
    // un seul tableau : colonnes et cases alignées d'une cible à l'autre, un espace entre deux
    expect(
      lire(
        `[$(".o_mfoCible").closest("table").length, $("#o_mfoCibles tbody.o_mfoEspace").length]`,
      ),
    ).toEqual([1, 1]);

    // partages illisibles : TdC actuels, dits une fois dans la ligne d'état
    expect(lire(`$(".o_mfoNote").length`)).toBe(0);
    expect(
      lire(`$(".o_mfoCible:first tr").eq(1).find("td").map((i, td) => $(td).text().trim()).get()`),
    ).toEqual(["Attaque 1 (20 %)", "73 254", "75 253", "15 050"]);
    expect(lire(`$(".o_mfoCoche:checked").length`)).toBe(3);
    expect(lire<string>(`$("#o_mfoRecap").text()`)).toBe(
      "Ce flood demande 3 attaques et 35 650 fourmis,soit 30 % de tes attaques disponibles et 54 % de ton armée sans les unités gardées.",
    );
    expect(lire(`$("#o_mfoLancerPartager").prop("disabled")`)).toBe(false);
  });

  test("lancer : armée relue, page d'attaque de chaque cible, attaques postées dans l'ordre, puis page Armée", async () => {
    await ouvrir();
    await ajouter("Cocop");
    await ajouter("Grim");
    // une attaque de Grim cochée en plus : 65 136 JSN ne suffisent plus, bouton bloqué
    lire(
      `$(".o_mfoCoche[data-pseudo='Grim'][data-i='0']").prop("checked", true).trigger("change")`,
    );
    expect(lire(`$("#o_mfoLancerPartager").prop("disabled")`)).toBe(true);
    lire(
      `$(".o_mfoCoche[data-pseudo='Grim'][data-i='0']").prop("checked", false).trigger("change")`,
    );
    await lire(`MultiFlood.lancer(true)`);
    const envois = lire<any[]>(`ENVOIS`);
    expect(
      envois.map(([url, d]) => [url, d.t, d.ChoixArmee, d.lieu, d.pseudoCible, d.unite1]),
    ).toEqual([
      ["/ennemie.php?Attaquer=41", "jeton", "1", "1", "Cocop", 15050],
      ["/ennemie.php?Attaquer=41", "jeton", "1", "1", "Cocop", 10700],
      ["/ennemie.php?Attaquer=41", "jeton", "1", "1", "Cocop", 9900],
    ]);
    expect(Object.keys(envois[0][1]).filter((k) => k.startsWith("unite")).length).toBe(14);
    expect(
      lire(
        `ENREGISTRES.map(([c, lieu, u, o]) => [c, lieu, u["Jeune Soldate Naine"], o.terrain, o.partager])`,
      ),
    ).toEqual([
      ["Cocop", "Terrain de chasse", 15050, 75253, true],
      ["Cocop", "Terrain de chasse", 10700, 75253, true],
      ["Cocop", "Terrain de chasse", 9900, 75253, true],
    ]);
    expect([lire(`sessionStorage.getItem("outiiil_floodPuisReplacer")`), lire(`OUVERT`)]).toEqual([
      "1",
      ["/Armee.php"],
    ]);
  });

  test("le jeu ne répond pas : arrêt sans nouvel essai, les boutons restent bloqués", async () => {
    await ouvrir();
    await ajouter("Cocop");
    lire(
      `(() => { let n = 0; $.post = (url, d) => { ENVOIS.push(d); return ++n == 2 ? $.Deferred().reject({}).promise() : $.Deferred().resolve("<center>Vos troupes sont en marche !</center>").promise(); }; })()`,
    );
    await lire(`MultiFlood.lancer(false)`);
    expect(lire(`ENVOIS.length`)).toBe(2);
    expect(lire(`OUVERT`)).toEqual([]);
    expect(lire(`$("#o_mfoLancerPartager").prop("disabled")`)).toBe(true);
    expect(lire<string>(`$("#o_mfoEtat").text()`)).toContain("recharge la page");
  });

  test("TdC à l'impact lu dans les partages : ligne sous le titre et attaques calculées dessus ; case décochée : TdC actuels", async () => {
    lire(`(() => {
      window.chargerAvant = PartageChasses.charger;
      window.impactAvant = PageAttaquer.tdcImpact;
      PartageChasses.charger = () => Promise.resolve({ chasses: {}, floods: [] });
      PageAttaquer.tdcImpact = () => ({ moi: { tdc: 80000 }, cible: { tdc: 70000 } });
    })()`);
    try {
      lire(
        `MultiFlood.ajouterMenu(); MultiFlood.installer(); $("#o_ongletMultiFlood").trigger("click")`,
      );
      await lire(`etatMultiFlood.lecture`);
      await lire(`MultiFlood.ajouter("Cocop")`);
      const ligne = (i: number) =>
        lire(
          `$(".o_mfoCible:first tr").eq(${i}).find("td").map((i, td) => $(td).text().trim()).get()`,
        );
      expect(ligne(2)).toEqual(["Attaque 1 (20 %)", "80 000", "70 000", "14 000"]);
      const note = lire<string>(`$(".o_mfoCible:first .o_mfoNote").text()`);
      expect(note).toContain("À l'impact le 18/11 à");
      expect(note).toContain(
        ": toi 80 000 (+6 746 des chasses et floods en cours), Cocop 70 000 (-5 253 des chasses et floods en cours)",
      );
      // décochée : les TdC actuels, sans ligne d'impact, comme la page du jeu ; choix gardé
      lire(`$("#o_mfoImpact").prop("checked", false).trigger("change")`);
      expect(lire(`localStorage.getItem("fzzz_multiFloodImpact")`)).toBe("0");
      expect(lire(`$(".o_mfoNote").length`)).toBe(0);
      expect(ligne(1)).toEqual(["Attaque 1 (20 %)", "73 254", "75 253", "15 050"]);
      lire(`$("#o_mfoImpact").prop("checked", true).trigger("change")`);
      expect(ligne(2)).toEqual(["Attaque 1 (20 %)", "80 000", "70 000", "14 000"]);
    } finally {
      lire(`PartageChasses.charger = chargerAvant; PageAttaquer.tdcImpact = impactAvant;`);
    }
  });

  test("forme de la page du jeu : attaquant, cases « Pseudo », options repliées (Terrain, Terrain final, Prise max, Arrondir, unités gardées)", async () => {
    await ouvrir();
    expect(lire(`$("#o_mfoForm thead th").map((i, th) => $(th).text().trim()).get()`)).toEqual([
      "Attaquant",
      "",
      "Cibles",
      "Options ▼",
    ]);
    expect(
      lire(
        `$("#o_mfoForm tbody tr:first td").map((i, td) => $(td).find("input").attr("placeholder") || $(td).text()).get()`,
      ),
    ).toEqual(["", "Pseudo", "Pseudo1", "Pseudo2", "Pseudo3"]);
    expect(lire(`[$(".o_mfoAttaquant").val(), $(".o_mfoAttaquant").prop("readOnly")]`)).toEqual([
      "Moi",
      true,
    ]);
    expect(
      lire(`$("#o_mfoForm tr.o_mfoOpt").map((i, tr) => $(tr).children().eq(1).text()).get()`),
    ).toEqual(["Terrain", "Terrain final", "Prise max", "Arrondir"]);
    // unités gardées en bas, sous un trait fin, sans lien vers les Préférences
    expect(lire(`$("#o_mfoGardees").closest(".o_mfoBas").length`)).toBe(1);
    expect(lire(`$(".o_mfoBas").children().first().is("hr.o_mfoSeparateur")`)).toBe(true);
    expect(lire(`$("#o_mfoRecap").nextAll(".o_mfoBas").length`)).toBe(1);
    expect(lire(`$("#o_mfoGardees .o_gardeesDefaut").length`)).toBe(0);
    expect(lire(`$("#o_multiFlood").hasClass("o_mfoOptions")`)).toBe(false);
    lire(`$(".o_mfoBoutonOptions").trigger("click")`);
    expect(lire(`[$("#o_multiFlood").hasClass("o_mfoOptions"), $(".o_mfoFleche").text()]`)).toEqual(
      [true, "▲"],
    );
    // un seul bouton, au vert du terrain : un flood va toujours au terrain de chasse
    expect(
      lire(`$(".o_mfoBoutons button").map((i, b) => b.id + " " + b.textContent).get()`),
    ).toEqual(["o_mfoLancerPartager Lancer + partager"]);
    expect(lire(`$("#o_mfoLancerPartager").hasClass("o_lieu1")`)).toBe(true);
  });

  test("cases « Pseudo » : Entrée ajoute la cible, une case de plus quand toutes sont prises ; vidée, la cible part ; changée, elle est remplacée", async () => {
    await ouvrir();
    const taper = async (i: number, pseudo: string) => {
      lire(`(() => {
        const champ = $("#o_mfoForm .o_mfoCiblePseudo").eq(${i});
        champ.val(${JSON.stringify(pseudo)});
        champ.trigger($.Event("keydown", { key: "Enter" }));
      })()`);
      await lire(`etatMultiFlood.enLecture[${JSON.stringify(pseudo.toLowerCase())}]`);
    };
    const cases = () =>
      lire<string[]>(`$("#o_mfoForm .o_mfoCiblePseudo").map((i, el) => el.value).get()`);
    await taper(0, "Cocop");
    await taper(1, "Grim");
    expect(cases()).toEqual(["Cocop", "Grim", ""]);
    await taper(2, "Staffie");
    expect(cases()).toEqual(["Cocop", "Grim", "Staffie", ""]);
    expect(lire(`$(".o_mfoCible").map((i, t) => t.dataset.pseudo).get()`)).toEqual([
      "Cocop",
      "Grim",
      "Staffie",
    ]);
    // déjà dans la liste : case vidée
    await taper(3, "grim");
    expect(cases()).toEqual(["Cocop", "Grim", "Staffie", ""]);
    // vidée : la cible part
    lire(`$("#o_mfoForm .o_mfoCiblePseudo").eq(1).val("").trigger("change")`);
    expect(cases()).toEqual(["Cocop", "Staffie", ""]);
    // changée : remplacée à sa place
    await taper(0, "Grim");
    expect(cases()).toEqual(["Grim", "Staffie", ""]);
    expect(lire(`etatMultiFlood.cibles.map((c) => c.pseudo)`)).toEqual(["Grim", "Staffie"]);
  });

  test("cible plus attaquable au lancement : ses attaques ne partent pas, les autres oui", async () => {
    await ouvrir();
    await ajouter("Cocop");
    await ajouter("Grim");
    // chaque case changée refait les tableaux : une case à la fois, comme au doigt
    for (const i of [0, 1, 2])
      lire(
        `$(".o_mfoCoche[data-pseudo='Cocop'][data-i='${i}']").prop("checked", false).trigger("change")`,
      );
    lire(
      `$(".o_mfoCoche[data-pseudo='Grim'][data-i='0']").prop("checked", true).trigger("change")`,
    );
    lire(
      `(() => { const get = $.get; $.get = (url) => String(url).includes("Attaquer=42") ? $.Deferred().resolve("<p>Ce joueur n'est pas attaquable</p>").promise() : get(url); })()`,
    );
    await lire(`MultiFlood.lancer(false)`);
    expect(lire(`ENVOIS.length`)).toBe(0);
    expect(lire(`OUVERT`)).toEqual(["/Armee.php"]);
  });
});

describe("champs du formulaire d'attaque", () => {
  test("unite1 à unite14 : même ordre que le jeu", () => {
    expect(lire(`Armee.champsAttaque([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14])`)).toEqual({
      unite1: 1,
      unite2: 2,
      unite3: 3,
      unite4: 4,
      unite5: 5,
      unite6: 6,
      unite7: 8,
      unite8: 9,
      unite9: 10,
      unite10: 11,
      unite11: 13,
      unite12: 14,
      unite13: 12,
      unite14: 7,
    });
  });
});
