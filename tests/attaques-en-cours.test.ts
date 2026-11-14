import { beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { creerPage } from "./harnais";

/**
 * Bloc « Mes attaques en cours » de la page Armée (1.105.0, demande du
 * mainteneur) : le contenu de la page d'un membre, pour moi. Mes attaques
 * (liste du jeu), mes chasses (Ressources.php) et les floods partagés sur moi
 * (forum), dans l'ordre, avec la variation de mon TdC et mon TdC après chacun.
 * « Partager » pour mes floods et mes chasses ; « Annuler » annule l'ordre du
 * jeu, puis le partage du forum est retiré par la page rechargée : un flood ne
 * quitte le forum que s'il est réellement annulé (pas de bouton « Retirer »,
 * 1.106.0). Le replacement de l'armée passe avant les lectures du bloc, dont
 * l'avancement s'affiche dans le titre. Le bloc « Floods en cours sur … »
 * n'existe plus. Joueurs inventés.
 */
const page = creerPage(
  [
    "js/lib/moment-duration-format.js",
    "js/class/Utils.js",
    "js/class/Armee.js",
    "js/page/PartageChasses.js",
    "js/class/AttaqueLancee.js",
    "js/page/Ressource.js",
    "js/content.js",
  ],
  // constantes du jeu (content.js) ; l'encart « Connexion » empêche le démarrage
  `var chrome = { runtime: { getManifest: () => ({ version: "0" }), getURL: (p) => p } };
   document.body.innerHTML = "<div class='boite_connexion_titre'>Connexion</div>";
   var heure = moment("2026-11-12 10:00:00", "YYYY-MM-DD HH:mm:ss").valueOf();
   var Horloge = { maintenant: () => heure, serveur: () => moment(heure), clic: () => moment(heure), serveurA: () => moment(heure) };
   var monProfil = { pseudo: "Moi", getTempsParcours2: () => 3600 };
   var Joueur = class {
     constructor(o) { this.pseudo = o.pseudo; }
     getProfil() { JEU.lues.push("/Membre.php?Pseudo=" + this.pseudo); return new Promise((r) => setTimeout(() => r(""), 5)); }
     chargerProfil() { this.terrain = JEU.profils[this.pseudo]; return !!this.terrain; }
   };
   var TroupesDehors = { synchroniserAttaques: () => {}, ajouterAttaque: () => {}, charger: () => [] };
   var CommerceFzzz = { copier: (texte) => (window.COPIE = texte) };`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);
// remis en place avant chaque test (un test les remplace)
lire(
  `window.ORIGINE = { simuler: PartageChasses.simuler, erreur: console.error, charger: PartageChasses.charger, sujets: PartageChasses.sujets, texteSujet: PartageChasses._texteSujet, instant: performance.now }`,
);
const attendre = () => new Promise((r) => setTimeout(r, 20));
const espaces = (t: string) => t.replace(/[\s  ]+/g, " ").trim();

// ligne d'attaque de la page Armée, comme le jeu l'écrit ; détails en Compte+
const attaque = (id: number, cible: string, secondes: number, details = "") =>
  `- Vous allez attaquer <span class="gras"><a href="Membre.php?Pseudo=${cible}">${cible}</a>(<a href="classementAlliance.php?alliance=OUAF">OUAF</a>)</span> dans <span class="gras" id="attaque_${id}">…</span><script language="JavaScript">reste(${secondes}, "attaque_${id}");</script> - <a href="/Armee.php?annuler=${id}">Annuler</a><br />${details}<br/>`;
const armee = (...attaques: string[]) =>
  `<span id='tag_alliance'>OUAF</span><span id='quantite_tdc'>100000</span><div id='centre'><h3>Attaque(s) en cours</h3>${attaques.join("")}</div>`;
// attaque lancée d'ici il y a 5 min (délai d'annulation du jeu passé) : sa capture,
// datée dans la page sur l'horloge simulée
type Capture = { id: number; cible: string; secondes: number; jsn: number; terrain: number };
const capture = (id: number, cible: string, secondes: number, jsn: number, terrain: number) => ({
  id,
  cible,
  secondes,
  jsn,
  terrain,
});
const ligneMembre = (pseudo: string, terrain: string) =>
  `<tr><td></td><td>1</td><td>Membre</td><td><a href="Membre.php?Pseudo=${pseudo}">${pseudo}</a></td><td></td><td>${terrain}</td></tr>`;
// mon TdC y est en retard : celui de la page ouverte (100 000) fait foi
const MEMBRES = `<table id="tabMembresAlliance">${ligneMembre("Moi", "99 000")}${ligneMembre("Autre", "150 000")}${ligneMembre("Cible", "60 000")}</table>`;
// forum : mon flood 501 et ma chasse de 10h21 déjà partagés, un flood d'Autre sur moi
const MA_CHASSE = { moi: [{ date: "2026-11-12 10:21", terrain: 3000 }] };
const flood = (id: number, date: string, lanceur: string, cible: string, unites: number) => ({
  date: "2026-11-12 " + date,
  cible,
  unites,
  terrain: unites,
  tdcCible: cible == "Moi" ? 100000 : 60000,
  id,
  lanceur,
});
const FORUM = {
  chasses: MA_CHASSE as Record<string, object[]>,
  floods: [flood(700, "10:25", "Autre", "Moi", 30000), flood(501, "10:31", "Moi", "Cible", 5000)],
};
// chasses de Ressources.php : deux à des minutes voisines (un groupe), une plus tard
const CHASSES = [
  ["10:20", 1000, 400],
  ["10:21", 2000, 600],
  ["11:00", 1000, 500],
];

beforeEach(() => {
  lire(`(() => {
    localStorage.clear(); sessionStorage.clear();
    heure = moment("2026-11-12 10:00:00", "YYYY-MM-DD HH:mm:ss").valueOf();
    window.TOASTS = []; $.toast = (o) => { TOASTS.push(o.text); return {}; };
    window.COPIE = null;
    window.JEU = { lues: [], ressources: true, annulation: "", rechargements: 0, profils: { Dehors: 55000 } };
    window.FORUM = ${JSON.stringify(FORUM)};
    window.ECRITS = { floods: [], chasses: [], retraits: [], partage: true, illisible: false };
    PartageChasses.simuler = ORIGINE.simuler; console.error = ORIGINE.erreur;
    PartageChasses.sujets = ORIGINE.sujets; PartageChasses._texteSujet = ORIGINE.texteSujet; performance.now = ORIGINE.instant;
    AttaqueLancee.recharger = () => JEU.rechargements++;
    PartageChasses.charger = (de = null, avecFloods = true) => {
      if (ECRITS.illisible) return Promise.reject(new Error("forum"));
      let voulus = de && de.map((p) => p.toLowerCase()), chasses = {};
      for (let p in FORUM.chasses) if (!voulus || voulus.includes(p)) chasses[p] = FORUM.chasses[p];
      return Promise.resolve({ chasses, floods: avecFloods ? FORUM.floods : [] });
    };
    PartageChasses.partagerFloods = (captures, $b) => { ECRITS.floods.push(captures.map((c) => c.id)); return Promise.resolve(true); };
    PartageChasses.partager = (groupes, $b) => { ECRITS.chasses.push(groupes.map((g) => g.impact.format("HH:mm") + " " + g.terrain)); return Promise.resolve(ECRITS.partage); };
    PartageChasses.retirerFloods = (ids) => { ECRITS.retraits.push(ids); return Promise.resolve(); };
    PageRessource.lireChasses = () => ${JSON.stringify(CHASSES)}.map(([h, terrain, jsn]) => ({
      impact: moment("2026-11-12 " + h, "YYYY-MM-DD HH:mm"), terrain, unites: { "Jeunes Soldates Naines": jsn }, duree: 3600, estime: false, pertes: 0 }));
    let lire = (url) => {
      let adresse = String(url);
      JEU.lues.push(adresse.replace(location.origin, ""));
      if (adresse.endsWith("/Ressources.php")) return Promise.resolve(JEU.ressources ? "<div id='boite_tdc'></div>" : "<div class='boite_connexion_titre'>Connexion</div>");
      if (adresse.endsWith("/alliance.php?Membres")) return Promise.resolve(${JSON.stringify(MEMBRES)});
      if (adresse.includes("annuler=")) return Promise.resolve(JEU.annulation);
      return Promise.reject({ status: 404 });
    };
    $.get = lire;
    $.ajax = (o) => lire(o.url);
  })()`);
});

// page Armée ouverte : deux attaques capturées sur Cible, arrivées à 10h30:30 et 10h30:32
const DEUX = [attaque(501, "Cible", 1830), attaque(502, "Cible", 1832)];
const CAPTURES = [
  capture(501, "Cible", 1830, 5000, 60000),
  capture(502, "Cible", 1832, 4000, 60000),
];
const ouvrir = async (attaques = DEUX, captures: Capture[] = CAPTURES) => {
  lire(`(() => {
    localStorage.setItem("outiiil_attaquesLancees", JSON.stringify(${JSON.stringify(captures)}.map((c) => ({
      id: c.id, cible: c.cible, lieu: "Terrain de chasse", unite: { "Jeune Soldate Naine": c.jsn },
      lancee: heure - 300000, arrivee: heure + c.secondes * 1000,
      terrainDepart: c.terrain, terrainCible: c.terrain - c.jsn, terrainConnu: c.terrain,
    }))));
    document.body.innerHTML = ${JSON.stringify(armee(...attaques))};
    AttaqueLancee.afficherTableaux();
  })()`);
  await attendre();
};
// cases du bloc : # | arrivée | lanceur → cible | unités | variation | TdC après | actions
const cases = () =>
  lire<string[][]>(
    `$("#o_attaquesLancees tbody tr").map((i, tr) => [$(tr).children().map((k, c) => $(c).text()).get()]).get()`,
  ).map((ligne) => ligne.map(espaces));
const lignes = () => cases().map((ligne) => ligne.join(" | ").trim());

describe("contenu : mes attaques, mes chasses et les floods partagés sur moi, dans l'ordre", () => {
  test("variation et TdC après chaque mouvement, comme sur la page d'un membre", async () => {
    await ouvrir();
    // 100 000 + 3 000 (chasses), − 20 600 (Autre : 20 % de 103 000), + 5 000, + 4 000, + 1 000
    expect(lignes()).toEqual([
      "1 | 12/11 10h21 | Chasse × 2 | 1 000 | +3 000 | 103 000 | Partagée ✓",
      "2 | 12/11 10h25 | Autre → moi | 30 000 | −20 600 (20 %) | 82 400 |",
      "3 | 12/11 10h30:30 | moi → Cible(OUAF) | 5 000 | +5 000 | 87 400 | CopierPartagé ✓",
      "4 | 12/11 10h30:32 | moi → Cible(OUAF) | 4 000 | +4 000 | 91 400 | CopierPartager",
      "5 | 12/11 11h00 | Chasse | 500 | +1 000 | 92 400 | Partager",
    ]);
    expect(lire(`$("#o_attaquesLancees .o_attaquesCompte").text()`)).toBe("(5)");
    expect(lire(`$("#o_attaquesLancees thead th").map((i, th) => th.textContent).get()`)).toEqual([
      "#",
      "Arrivée",
      "Lanceur → cible",
      "Unités",
      "Variation",
      "TdC après",
      "",
    ]);
  });

  test("pages lues à l'ouverture : forum, Ressources.php, puis la page Membres (un autre joueur est relié à moi)", async () => {
    await ouvrir();
    expect(lire(`JEU.lues`)).toEqual(["/Ressources.php", "/alliance.php?Membres"]);
  });

  test("unités d'une attaque et d'une chasse : détail au survol ; plus de colonne ni de bloc « Floods en cours sur … »", async () => {
    await ouvrir();
    // troupes et lieu attaqué (il n'a plus de colonne)
    expect(
      lire(`$("#o_attaquesLancees tr.o_ligneAttaque .o_troupesCourtes").first().attr("title")`),
    ).toBe("Terrain de chasse : 5 000 Jeunes Soldates Naines.");
    expect(
      lire(`$("#o_attaquesLancees tr.o_ligneChasse .o_troupesCourtes").first().attr("title")`),
    ).toBe("1 000 Jeunes Soldates Naines");
    expect(lire(`[$("#o_floodsRecus").length, typeof PartageChasses.afficherArmee]`)).toEqual([
      0,
      "undefined",
    ]);
  });

  test("aucune attaque à moi : le bloc montre quand même mes chasses et les floods sur moi", async () => {
    await ouvrir([], []);
    expect(cases().map((ligne) => ligne.slice(1, 6).join(" | "))).toEqual([
      "12/11 10h21 | Chasse × 2 | 1 000 | +3 000 | 103 000",
      "12/11 10h25 | Autre → moi | 30 000 | −20 600 (20 %) | 82 400",
      "12/11 11h00 | Chasse | 500 | +1 000 | 83 400",
    ]);
  });

  test("une chasse seule, ou un flood reçu seul : le bloc est là", async () => {
    lire(`FORUM = { chasses: {}, floods: [] }`);
    await ouvrir([], []);
    expect(cases().map((ligne) => ligne[2])).toEqual(["Chasse × 2", "Chasse"]);
    lire(`(() => {
      FORUM = { chasses: {}, floods: ${JSON.stringify([flood(700, "10:25", "Autre", "Moi", 30000)])} };
      PageRessource.lireChasses = () => [];
    })()`);
    await ouvrir([], []);
    expect(cases().map((ligne) => ligne[2])).toEqual(["Autre → moi"]);
  });

  test("même minute : les chasses d'abord, puis les floods par numéro d'attaque, comme la simulation", async () => {
    lire(`(() => {
      FORUM.floods.push(${JSON.stringify(flood(500, "10:31", "Autre", "Moi", 1000))}, ${JSON.stringify(flood(600, "10:31", "Autre", "Moi", 1000))});
      PageRessource.lireChasses = () => [{ impact: moment("2026-11-12 10:31", "YYYY-MM-DD HH:mm"), terrain: 2000, unites: {}, duree: 3600, estime: false, pertes: 0 }];
      FORUM.chasses = {};
    })()`);
    await ouvrir();
    expect(cases().map((ligne) => ligne.slice(1, 6).join(" | "))).toEqual([
      "12/11 10h25 | Autre → moi | 30 000 | −20 000 (20 %) | 80 000",
      // chasse sans détail des troupes (compte sans Compte+) : unités inconnues
      "12/11 10h31 | Chasse | — | +2 000 | 82 000",
      // n° 500 : à 82 000 je suis sous la moitié du TdC d'Autre (170 000), hors de sa portée
      "12/11 10h31 | Autre → moi | 1 000 | 0 (hors portée) | 82 000",
      "12/11 10h30:30 | moi → Cible(OUAF) | 5 000 | +5 000 | 87 000",
      "12/11 10h30:32 | moi → Cible(OUAF) | 4 000 | +4 000 | 91 000",
      // n° 600, après mes deux floods : de nouveau à portée
      "12/11 10h31 | Autre → moi | 1 000 | −1 000 | 90 000",
    ]);
  });

  test("arrivée capturée une seconde avant celle lue sur la page : la ligne est rangée à la minute de la simulation", async () => {
    // capture : 10h30:00 pile (rapport à 10h30) ; page : 10h30:01 (rapport à 10h31)
    lire(`FORUM.floods.push(${JSON.stringify(flood(900, "10:30", "Autre", "Moi", 1000))})`);
    await ouvrir([attaque(501, "Cible", 1801)], [capture(501, "Cible", 1800, 5000, 60000)]);
    expect(cases().map((ligne) => ligne.slice(1, 6).join(" | "))).toEqual([
      "12/11 10h21 | Chasse × 2 | 1 000 | +3 000 | 103 000",
      "12/11 10h25 | Autre → moi | 30 000 | −20 600 (20 %) | 82 400",
      "12/11 10h30:01 | moi → Cible(OUAF) | 5 000 | +5 000 | 87 400",
      "12/11 10h30 | Autre → moi | 1 000 | −1 000 | 86 400",
      "12/11 11h00 | Chasse | 500 | +1 000 | 87 400",
    ]);
  });

  test("chasses et floods des autres joueurs : comptés dans la simulation, jamais listés", async () => {
    lire(`(() => {
      FORUM.chasses.autre = [{ date: "2026-11-12 10:22", terrain: 9999 }];
      FORUM.floods.push(${JSON.stringify(flood(800, "10:23", "Autre", "Cible", 7777))});
    })()`);
    await ouvrir();
    expect(cases().map((ligne) => ligne[2])).toEqual([
      "Chasse × 2",
      "Autre → moi",
      "moi → Cible(OUAF)",
      "moi → Cible(OUAF)",
      "Chasse",
    ]);
    // Cible a perdu 7 777 avant mes floods : 60 000 − 7 777 = 52 223, mes 5 000 et 4 000 passent
    expect(lignes()[2]).toBe(
      "3 | 12/11 10h30:30 | moi → Cible(OUAF) | 5 000 | +5 000 | 87 400 | CopierPartagé ✓",
    );
  });

  test("mes attaques seules, ni chasse ni flood sur moi : le bloc reste, avec ses lignes", async () => {
    lire(
      `(() => { FORUM = { chasses: {}, floods: [] }; PageRessource.lireChasses = () => []; })()`,
    );
    await ouvrir();
    expect(lignes()).toEqual([
      "1 | 12/11 10h30:30 | moi → Cible(OUAF) | 5 000 | +5 000 | 105 000 | CopierPartager",
      "2 | 12/11 10h30:32 | moi → Cible(OUAF) | 4 000 | +4 000 | 109 000 | CopierPartager",
    ]);
  });

  test("rien en cours : pas de bloc", async () => {
    lire(
      `(() => { FORUM = { chasses: {}, floods: [] }; PageRessource.lireChasses = () => []; })()`,
    );
    await ouvrir([], []);
    expect(lire(`$("#o_attaquesLancees").length`)).toBe(0);
  });

  test("page Ressources illisible : mes chasses sont celles du forum, déjà partagées", async () => {
    lire(`JEU.ressources = false`);
    await ouvrir();
    expect(lignes().filter((l) => l.includes("Chasse"))).toEqual([
      "1 | 12/11 10h21 | Chasse | — | +3 000 | 103 000 | Partagée ✓",
    ]);
  });

  test("forum illisible : mes attaques et mes chasses restent, avec leurs boutons", async () => {
    lire(`ECRITS.illisible = true`);
    await ouvrir();
    expect(lignes()).toEqual([
      "1 | 12/11 10h21 | Chasse × 2 | 1 000 | +3 000 | 103 000 | Partager",
      "2 | 12/11 10h30:30 | moi → Cible(OUAF) | 5 000 | +5 000 | 108 000 | CopierPartager",
      "3 | 12/11 10h30:32 | moi → Cible(OUAF) | 4 000 | +4 000 | 112 000 | CopierPartager",
      "4 | 12/11 11h00 | Chasse | 500 | +1 000 | 113 000 | Partager",
    ]);
  });

  test("attaque lancée ailleurs, sans détail du jeu ni partage : listée, variation et TdC inconnus, annulable", async () => {
    await ouvrir([attaque(503, "Cible", 600)], []);
    expect(lignes().find((l) => l.includes("moi → Cible"))).toBe(
      "1 | 12/11 10h10:00 | moi → Cible(OUAF) | ? | — | ? | CopierPartagerAnnuler",
    );
  });

  test("attaque lancée ailleurs et partagée de là-bas : sa ligne du forum donne unités, variation et TdC", async () => {
    lire(`FORUM.floods.push(${JSON.stringify(flood(503, "10:11", "Moi", "Cible", 2000))})`);
    await ouvrir([attaque(503, "Cible", 600)], []);
    // mon flood 501 du forum n'est plus dans la liste du jeu : il ne compte pas
    expect(lignes()).toEqual([
      "1 | 12/11 10h10:00 | moi → Cible(OUAF) | 2 000 | +2 000 | 102 000 | CopierPartagé ✓Annuler",
      "2 | 12/11 10h21 | Chasse × 2 | 1 000 | +3 000 | 105 000 | Partagée ✓",
      "3 | 12/11 10h25 | Autre → moi | 30 000 | −21 000 (20 %) | 84 000 |",
      "4 | 12/11 11h00 | Chasse | 500 | +1 000 | 85 000 | Partager",
    ]);
  });

  test("attaque lancée ailleurs, détail du jeu (Compte+) : la page de la cible est lue d'abord, la simulation part de son TdC", async () => {
    const details =
      "<small><em> Troupes en attaques : 12 000 Jeunes Soldates Naines.<br /> Arrivée à 10h10</em></small><br/>";
    await ouvrir(
      [
        attaque(503, "Dehors", 600, details).replace(
          "</span> dans",
          "</span> (Terrain de chasse) dans",
        ),
      ],
      [],
    );
    expect(lire(`JEU.lues`)).toEqual([
      "/Membre.php?Pseudo=Dehors",
      "/Ressources.php",
      "/alliance.php?Membres",
    ]);
    // 20 % de 55 000 : la cible, hors alliance, n'est connue que par sa page
    expect(lignes().find((l) => l.includes("moi → Dehors"))).toBe(
      "1 | 12/11 10h10:00 | moi → Dehors(OUAF) | 12 000 | +11 000 (20 %) | 111 000 | CopierPartagerAnnuler",
    );
    expect(lire(`$("#o_attaquesLancees tr.o_ligneAttaque .o_troupesCourtes").attr("title")`)).toBe(
      "Terrain de chasse : 12 000 Jeunes Soldates Naines.",
    );
  });

  test("calcul en échec : le bloc n'attend pas, mes attaques restent avec leurs boutons", async () => {
    lire(
      `(() => { PartageChasses.simuler = () => { throw new Error("essai"); }; window.ERREURS = []; console.error = (...a) => ERREURS.push(String(a[0])); })()`,
    );
    await ouvrir();
    expect(lignes()).toEqual([
      "1 | 12/11 10h30:30 | moi → Cible(OUAF) | 5 000 | 5 000 | ? | CopierPartagé ✓",
      "2 | 12/11 10h30:32 | moi → Cible(OUAF) | 4 000 | 4 000 | ? | CopierPartager",
    ]);
    expect(lire(`ERREURS.length`)).toBe(1);
  });

  test("case « Mes attaques en cours » décochée : ni bloc ni lecture", async () => {
    lire(`localStorage.setItem("fzzz_affichage_listeAttaques", "0")`);
    lire(
      `(() => { document.body.innerHTML = ${JSON.stringify(armee(...DEUX))}; AttaqueLancee.afficherTableaux(); })()`,
    );
    await attendre();
    expect(lire(`[$("#o_attaquesLancees").length, JEU.lues]`)).toEqual([0, []]);
  });
});

describe("« Partager » : floods et chasses", () => {
  test("chasse non partagée : son bouton la publie, puis « Partagée ✓ » ; refus du forum : le bouton reste", async () => {
    await ouvrir();
    lire(`ECRITS.partage = false; $("#o_attaquesLancees .o_chassePartager").trigger("click")`);
    await attendre();
    expect(lire(`[ECRITS.chasses, $("#o_attaquesLancees .o_chassePartager").length]`)).toEqual([
      [["11:00 1000"]],
      1,
    ]);
    lire(`ECRITS.partage = true; $("#o_attaquesLancees .o_chassePartager").trigger("click")`);
    await attendre();
    expect(lire(`$("#o_attaquesLancees .o_chassePartager").length`)).toBe(0);
    expect(lignes()[4]).toEndWith("| Partagée ✓");
  });

  test("« Partager tous » : mes floods pas encore partagés, puis mes chasses pas encore partagées", async () => {
    await ouvrir();
    expect(lire(`$("#o_attaquesLanceesPartagerTout").text()`)).toBe("Partager tous");
    lire(`$("#o_attaquesLanceesPartagerTout").trigger("click")`);
    await attendre();
    expect(lire(`ECRITS`)).toMatchObject({ floods: [[502]], chasses: [["11:00 1000"]] });
    expect(lire(`$("#o_attaquesLancees .o_chassePartager").length`)).toBe(0);
  });

  test("« Partager tous » : le forum refuse les floods, les chasses ne sont pas tentées", async () => {
    await ouvrir();
    lire(
      `PartageChasses.partagerFloods = (captures) => { ECRITS.floods.push(captures.map((c) => c.id)); return Promise.resolve(false); }`,
    );
    lire(`$("#o_attaquesLanceesPartagerTout").trigger("click")`);
    await attendre();
    expect(lire(`ECRITS`)).toMatchObject({ floods: [[502]], chasses: [] });
  });

  test("« Partager tous » : plus de flood à partager, la chasse seule est publiée ; puis « Tous partagés ✓ »", async () => {
    lire(`FORUM.floods.push(${JSON.stringify(flood(502, "10:31", "Moi", "Cible", 4000))})`);
    await ouvrir();
    lire(`$("#o_attaquesLanceesPartagerTout").trigger("click")`);
    await attendre();
    expect(lire(`ECRITS`)).toMatchObject({ floods: [], chasses: [["11:00 1000"]] });
    expect(
      lire(
        `[$("#o_attaquesLanceesPartagerTout").text(), $("#o_attaquesLanceesPartagerTout").prop("disabled")]`,
      ),
    ).toEqual(["Tous partagés ✓", true]);
  });

  test("flood : « Partager » et « Copier » de sa ligne, comme avant", async () => {
    await ouvrir();
    lire(`$("#o_attaquesLancees .o_attaquePartager").first().trigger("click")`);
    lire(`$("#o_attaquesLancees .o_attaqueCopier").first().trigger("click")`);
    expect(lire(`ECRITS.floods`)).toEqual([[502]]);
    expect(lire<string>(`COPIE`)).toContain("- Vous allez attaquer Cible (Terrain de chasse)");
  });
});

describe("un flood ne quitte le forum que s'il est réellement annulé : pas de « Retirer »", () => {
  test("ni bouton « Retirer » sur une ligne partagée, ni « Retirer mes partages » dans le titre", async () => {
    await ouvrir();
    expect(lire<string>(`$("#o_attaquesLancees").text()`)).not.toContain("Retirer");
    expect(
      lire(
        `[$("#o_attaquesLancees .o_attaqueRetirer").length, $("#o_attaquesLanceesRetirerTout").length, typeof PartageChasses.mesFloodsForum]`,
      ),
    ).toEqual([0, 0, "undefined"]);
    expect(
      lire(`$("#o_attaquesLancees .o_attaquesEnTete button").map((i, b) => b.textContent).get()`),
    ).toEqual(["Partager tous", "Tout annuler"]);
  });

  test("flood noté partagé ici mais absent du forum (retiré d'un autre appareil) : « Partager » revient", async () => {
    lire(`localStorage.setItem("fzzz_floodsPartages", JSON.stringify({ 502: Date.now() }))`);
    lire(`(() => {
      localStorage.setItem("outiiil_attaquesLancees", "[]");
      document.body.innerHTML = ${JSON.stringify(armee(...DEUX))};
      AttaqueLancee.afficherTableaux();
    })()`);
    // avant la lecture du forum : l'état noté dans ce navigateur
    expect(cases().map((l) => l[6])).toEqual(["CopierPartagerAnnuler", "CopierPartagé ✓Annuler"]);
    await attendre();
    expect(
      cases()
        .filter((l) => String(l[2]).startsWith("moi"))
        .map((l) => l[6]),
    ).toEqual(["CopierPartagé ✓Annuler", "CopierPartagerAnnuler"]);
  });
});

describe("chargement : avancement dans le titre du bloc", () => {
  const etat = () => lire<string | null>(`$("#o_attaquesLancees .o_attaquesChargement").text()`);
  // lectures du forum et de la page Ressources terminées à la main ; horloge des durées simulée
  const differer = () =>
    lire(`(() => {
      window.T = 0; performance.now = () => T;
      window.FINIR = {};
      let differe = (cle, valeur) => new Promise((r) => (FINIR[cle] = () => r(valeur)));
      PartageChasses.charger = ORIGINE.charger;
      // sujets communs : les floods de chaque membre (Autre me floode), les chasses (les miennes, celles de Lassie)
      PartageChasses.sujets = () => differe("liste", { historiques: [], communs: {
        Floods: { type: "Floods", id: "10", dernier: "", modifie: null },
        Chasses: { type: "Chasses", id: "11", dernier: "", modifie: null } } });
      PartageChasses._texteSujet = (id) => differe("sujet" + id, id == "10"
        ? ["--- Autre · 2026-11-12 09:00:00 ---", PartageChasses._ligne("Floods", ${JSON.stringify({ ...flood(700, "10:25", "Autre", "Moi", 30000), lanceur: undefined })})].join("\\n")
        : ["--- Moi · 2026-11-12 09:00:00 ---", ...FORUM.chasses.moi.map((c) => PartageChasses._ligne("Chasses", c)),
           "--- Lassie · 2026-11-12 09:00:00 ---", "12/11/26 12:00 | 700 cm²"].join("\\n"));
      let get = $.get;
      $.get = (url) => String(url).endsWith("/Ressources.php") ? (JEU.lues.push("/Ressources.php"), differe("ressources", "<div id='boite_tdc'></div>")) : get(url);
    })()`);
  const finir = async (cle: string, temps: number) => {
    lire(`T = ${temps}; FINIR[${JSON.stringify(cle)}]()`);
    await attendre();
  };

  test("lectures faites sur lectures prévues, puis temps restant d'après leur durée moyenne ; retiré à la fin", async () => {
    differer();
    await ouvrir();
    // page Ressources et liste des sujets du forum
    expect(etat()).toBe("chargement 0 / 2");
    // « TdC après » de mes attaques en attente
    expect(cases().map((l) => l[5])).toEqual(["…", "…"]);
    await finir("liste", 1000);
    // 2 sujets à lire : le sujet commun des floods et celui des chasses
    expect(etat()).toBe("chargement 1 / 4");
    await finir("ressources", 2000);
    // 2 lectures en 2 s, il en reste 2
    expect(etat()).toBe("chargement 2 / 4, encore ≈ 2 s");
    await finir("sujet10", 2500);
    expect(etat()).toBe("chargement 3 / 4, encore ≈ 1 s");
    await finir("sujet11", 3000);
    // Autre me floode : ses chasses (liste des sujets relue, sujet commun gardé) et la page Membres en plus
    expect(etat()).toBe("chargement 5 / 6, encore ≈ 1 s");
    await finir("liste", 4000);
    expect(lire(`$("#o_attaquesLancees .o_attaquesChargement").length`)).toBe(0);
    expect(cases().map((l) => l[5])).toEqual(["103 000", "82 400", "87 400", "91 400", "92 400"]);
    expect(lire(`$("#o_attaquesLancees .o_attaquesCompte").text()`)).toBe("(5)");
  });

  test("replacement fini avant la fin du chargement : le titre repasse de l'attente à l'avancement", async () => {
    differer();
    lire(`window.FIN = null; AttaqueLancee.laisserPasser(new Promise((r) => (FIN = r)))`);
    await ouvrir();
    expect(etat()).toBe("en attente : le replacement de l'armée passe d'abord");
    lire(`FIN()`);
    await attendre();
    expect(etat()).toBe("chargement 0 / 2");
    for (const [cle, t] of [
      ["liste", 100],
      ["ressources", 200],
      ["sujet10", 300],
      ["sujet11", 400],
      ["liste", 600],
    ] as [string, number][])
      await finir(cle, t);
    expect(lignes()).toHaveLength(5);
  });

  test("pages des cibles des attaques lancées ailleurs : comptées dans l'avancement", async () => {
    const compte = await lire<Promise<string[]>>(`(() => {
      let vus = [], suivi = { prevoir: (n) => vus.push("prévues " + n), faite: () => vus.push("faite") };
      JEU.profils.Ailleurs = 30000;
      let ligne = (id, cible) => ({ ligne: { id, cible, lieuNatif: "Terrain de chasse", troupesNatif: "10 Jeunes Soldates Naines", arrivee: moment(heure + 600000) }, capture: null });
      return AttaqueLancee.reconstituer([ligne(1, "Dehors"), ligne(2, "Dehors"), ligne(3, "Ailleurs")], suivi).then(() => vus);
    })()`);
    expect(compte).toEqual(["prévues 2", "faite", "faite"]);
  });

  test("temps restant : l'attente d'un replacement ne compte pas dans la durée moyenne d'une lecture", () => {
    const textes = lire<string[]>(`(() => {
      let T = 0, vus = [];
      performance.now = () => T;
      document.body.innerHTML = "<div id='o_attaquesLancees'><span class='o_attaquesChargement'></span></div>";
      let suivi = AttaqueLancee.suiviChargement($("#o_attaquesLancees")), note = () => vus.push($(".o_attaquesChargement").text());
      note();
      suivi.prevoir(4); T = 500; suivi.faite(); note();
      T = 1000; suivi.faite(); note();
      suivi.attente(true); note();
      T = 11000; suivi.attente(false); note();
      T = 11500; suivi.faite(); note();
      suivi.faite(); note();
      suivi.fin(); vus.push(String($(".o_attaquesChargement").length));
      return vus;
    })()`);
    expect(textes).toEqual([
      "chargement…",
      "chargement 1 / 4",
      "chargement 2 / 4, encore ≈ 1 s",
      "en attente : le replacement de l'armée passe d'abord",
      "chargement 2 / 4, encore ≈ 1 s",
      "chargement 3 / 4, encore ≈ 1 s",
      "chargement 4 / 4",
      "0",
    ]);
  });

  test("aucune attaque : le titre seul avec « chargement », dès l'ouverture ; retiré s'il n'y a rien à montrer", async () => {
    differer();
    lire(`FORUM.chasses.moi = []; PageRessource.lireChasses = () => [];`);
    lire(`(() => {
      // personne ne me floode : le sujet commun des floods est vide
      PartageChasses._texteSujet = ((lire) => (id) => (id == "10" ? (FINIR.sujet10 = () => {}, Promise.resolve("")) : lire(id)))(PartageChasses._texteSujet);
      document.body.innerHTML = ${JSON.stringify(armee())};
      AttaqueLancee.afficherTableaux();
    })()`);
    // sans attendre : le bloc est là, réduit à son titre
    expect(
      lire(
        `[$("#o_attaquesLancees").length, $("#o_attaquesLancees").hasClass("o_attaquesVide"), $("#o_attaquesLancees .o_attaquesTitre").text().replace(/\\s+/g, " ").trim(), $("#o_attaquesLancees tbody tr").length]`,
      ),
    ).toEqual([1, true, "▼ Mes attaques en cours chargement…", 0]);
    await attendre();
    expect(etat()).toBe("chargement 0 / 2");
    await finir("liste", 500);
    await finir("ressources", 600);
    await finir("sujet11", 800);
    expect(lire(`$("#o_attaquesLancees").length`)).toBe(0);
    const css = readFileSync(join(import.meta.dir, "..", "public", "css", "outiiil.css"), "utf8");
    expect(css).toMatch(
      /#o_attaquesLancees\.o_attaquesVide \.o_spoilerCorps \{\s*display: none !important;\s*\}/,
    );
  });

  test("aucune attaque mais une chasse en cours : le bloc se remplit, sans boutons groupés", async () => {
    lire(`FORUM = { chasses: {}, floods: [] }`);
    lire(
      `(() => { document.body.innerHTML = ${JSON.stringify(armee())}; AttaqueLancee.afficherTableaux(); })()`,
    );
    expect(lire(`$("#o_attaquesLancees").hasClass("o_attaquesVide")`)).toBe(true);
    await attendre();
    expect(
      lire(
        `[$("#o_attaquesLancees").hasClass("o_attaquesVide"), $("#o_attaquesLancees .o_attaquesChargement").length, $("#o_attaquesLancees .o_attaquesEnTete").length, $("#o_attaquesLancees .o_attaquesCompte").text()]`,
      ),
    ).toEqual([false, 0, 0, "(2)"]);
    expect(cases().map((l) => l[2])).toEqual(["Chasse × 2", "Chasse"]);
  });
});

describe("le replacement de l'armée passe avant les lectures du bloc", () => {
  const etat = () => lire<string | null>(`$("#o_attaquesLancees .o_attaquesChargement").text()`);
  // forum compté ; replacements terminés à la main
  const compter = () =>
    lire(`(() => {
      window.FORUM_LU = 0; window.FIN = [];
      PartageChasses.charger = ((charger) => (...a) => { FORUM_LU++; return charger(...a); })(PartageChasses.charger);
      window.replacement = () => AttaqueLancee.laisserPasser(new Promise((r) => FIN.push(r)));
    })()`);

  test("replacement attendu à l'ouverture (fin de flood) : aucune lecture avant sa fin, le titre le dit", async () => {
    compter();
    lire(`replacement()`);
    await ouvrir();
    expect(lire(`[JEU.lues, FORUM_LU]`)).toEqual([[], 0]);
    expect(etat()).toBe("en attente : le replacement de l'armée passe d'abord");
    // mes attaques sont déjà listées, d'après la page
    expect(cases().map((l) => l.slice(2, 6).join(" | "))).toEqual([
      "moi → Cible(OUAF) | 5 000 | 5 000 | …",
      "moi → Cible(OUAF) | 4 000 | 4 000 | …",
    ]);
    lire(`FIN[0]()`);
    await attendre();
    expect(lire(`[JEU.lues, FORUM_LU > 0]`)).toEqual([
      ["/Ressources.php", "/alliance.php?Membres"],
      true,
    ]);
    expect(lire(`$("#o_attaquesLancees .o_attaquesChargement").length`)).toBe(0);
    expect(lignes()).toHaveLength(5);
  });

  test("attaque lancée ailleurs : la page de sa cible attend aussi", async () => {
    const details =
      "<small><em> Troupes en attaques : 12 000 Jeunes Soldates Naines.<br /> Arrivée à 10h10</em></small><br/>";
    compter();
    lire(`replacement()`);
    await ouvrir(
      [
        attaque(503, "Dehors", 600, details).replace(
          "</span> dans",
          "</span> (Terrain de chasse) dans",
        ),
      ],
      [],
    );
    expect(lire(`JEU.lues`)).toEqual([]);
    lire(`FIN[0]()`);
    await attendre();
    expect(lire(`JEU.lues`)).toEqual([
      "/Membre.php?Pseudo=Dehors",
      "/Ressources.php",
      "/alliance.php?Membres",
    ]);
  });

  test("replacement lancé pendant le chargement : la lecture suivante (page Membres) attend sa fin", async () => {
    compter();
    // forum en cours de lecture quand le joueur clique sur « Replacer l'armée »
    lire(`(() => {
      let charger = PartageChasses.charger, premiere = true;
      PartageChasses.charger = (...a) => {
        if (!premiere) return charger(...a);
        premiere = false;
        return new Promise((r) => (window.FORUM_FINI = () => r(charger(...a))));
      };
    })()`);
    await ouvrir();
    expect(lire(`JEU.lues`)).toEqual(["/Ressources.php"]);
    expect(etat()).toBe("chargement 1 / 1");
    lire(`replacement()`);
    expect(etat()).toBe("en attente : le replacement de l'armée passe d'abord");
    lire(`FORUM_FINI()`);
    await attendre();
    expect(lire(`JEU.lues`)).toEqual(["/Ressources.php"]);
    // second replacement lancé avant la fin du premier : les deux sont attendus
    lire(`replacement(); FIN[0]()`);
    await attendre();
    expect(lire(`JEU.lues`)).toEqual(["/Ressources.php"]);
    expect(etat()).toBe("en attente : le replacement de l'armée passe d'abord");
    lire(`FIN[1]()`);
    await attendre();
    expect(lire(`JEU.lues`)).toEqual(["/Ressources.php", "/alliance.php?Membres"]);
    expect(lignes()).toHaveLength(5);
  });

  test("replacement lancé pendant la lecture de la page d'une cible : forum et page Ressources attendent sa fin", async () => {
    const details =
      "<small><em> Troupes en attaques : 12 000 Jeunes Soldates Naines.<br /> Arrivée à 10h10</em></small><br/>";
    compter();
    lire(`(() => {
      localStorage.setItem("outiiil_attaquesLancees", "[]");
      document.body.innerHTML = ${JSON.stringify(armee(attaque(503, "Dehors", 600, details).replace("</span> dans", "</span> (Terrain de chasse) dans")))};
      AttaqueLancee.afficherTableaux();
      replacement();
    })()`);
    await attendre();
    expect(lire(`[JEU.lues, FORUM_LU]`)).toEqual([["/Membre.php?Pseudo=Dehors"], 0]);
    lire(`FIN[0]()`);
    await attendre();
    expect(lire(`JEU.lues`)).toEqual([
      "/Membre.php?Pseudo=Dehors",
      "/Ressources.php",
      "/alliance.php?Membres",
    ]);
  });

  test("replacement en échec : le bloc se charge quand même", async () => {
    compter();
    lire(`AttaqueLancee.laisserPasser(Promise.reject(new Error("jeu muet")))`);
    await ouvrir();
    expect(lignes()).toHaveLength(5);
  });
});

describe("« Annuler » : l'ordre du jeu d'abord, le partage du forum ensuite", () => {
  // deux attaques lancées ailleurs (le jeu donne leur lien Annuler), partagées dans le forum
  const ANNULEES = [attaque(503, "Cible", 600), attaque(504, "Cible", 700)];
  const partagees = () =>
    lire(`(() => {
      FORUM = { chasses: {}, floods: ${JSON.stringify([flood(503, "10:10", "Moi", "Cible", 2000), flood(504, "10:12", "Moi", "Cible", 2000)])} };
      PageRessource.lireChasses = () => [];
      localStorage.setItem("fzzz_floodsPartages", JSON.stringify({ 503: Date.now(), 504: Date.now() }));
    })()`);

  test("écrit en noir gras", () => {
    const css = readFileSync(join(import.meta.dir, "..", "public", "css", "outiiil.css"), "utf8");
    const regles = [...css.matchAll(/#o_attaquesLancees \.o_attaqueAnnuler a \{([^}]*)\}/g)].map(
      (r) => String(r[1]).replace(/\s+/g, " "),
    );
    expect(regles.filter((r) => r.includes("color:"))).toEqual([
      " padding: 0; border: 0; color: #000 !important; font-weight: bold; ",
    ]);
  });

  test("clic : seule la demande d'annulation part au jeu ; rien n'est écrit dans le forum ; la page est relue", async () => {
    partagees();
    await ouvrir(ANNULEES, []);
    expect(
      lire(`$("#o_attaquesLancees .o_attaqueAnnuler a").map((i, a) => a.textContent).get()`),
    ).toEqual(["Annuler", "Annuler"]);
    // le lien du jeu (qui mène à une autre page) n'est pas suivi : envoi en arrière-plan
    expect(
      lire(`(() => {
        JEU.lues = [];
        let clic = $.Event("click");
        $("#o_attaquesLancees .o_attaqueAnnuler a").first().trigger(clic);
        return clic.isDefaultPrevented();
      })()`),
    ).toBe(true);
    // second clic pendant l'envoi : sans effet
    lire(`$("#o_attaquesLancees .o_attaqueAnnuler a").first().trigger("click")`);
    await attendre();
    expect(
      lire(
        `[JEU.lues, ECRITS.retraits, JEU.rechargements, sessionStorage.getItem("outiiil_annulationEchec")]`,
      ),
    ).toEqual([["/Armee.php?annuler=503"], [], 1, null]);
  });

  test("page relue sans l'attaque : son partage est retiré du forum ; celui de l'autre reste", async () => {
    partagees();
    await ouvrir(ANNULEES, []);
    expect(lire(`ECRITS.retraits`)).toEqual([]);
    // le jeu a annulé la 503
    await ouvrir(ANNULEES.slice(1), []);
    expect(lire(`ECRITS.retraits`)).toEqual([[503]]);
    expect(lignes()).toEqual([
      "1 | 12/11 10h11:40 | moi → Cible(OUAF) | 2 000 | +2 000 | 102 000 | CopierPartagé ✓Annuler",
    ]);
  });

  test("le jeu refuse (délai dépassé) : l'attaque est encore dans sa réponse, le joueur est prévenu et le partage reste", async () => {
    partagees();
    await ouvrir(ANNULEES, []);
    lire(`JEU.annulation = ${JSON.stringify(armee(...ANNULEES))}`);
    lire(`$("#o_attaquesLancees .o_attaqueAnnuler a").first().trigger("click")`);
    await attendre();
    expect(lire(`[sessionStorage.getItem("outiiil_annulationEchec"), JEU.rechargements]`)).toEqual([
      "1",
      1,
    ]);
    // page relue : l'attaque est toujours là
    await ouvrir(ANNULEES, []);
    expect(
      lire(`[TOASTS, ECRITS.retraits, sessionStorage.getItem("outiiil_annulationEchec")]`),
    ).toEqual([
      ["1 attaque n'a pas pu être annulée : le délai d'annulation du jeu est dépassé."],
      [],
      null,
    ]);
  });

  test("le jeu ne répond pas : la page est relue quand même, sans message d'échec", async () => {
    partagees();
    await ouvrir(ANNULEES, []);
    lire(`$.get = () => Promise.reject({ status: 0 })`);
    lire(`$("#o_attaquesLancees .o_attaqueAnnuler a").first().trigger("click")`);
    await attendre();
    expect(lire(`[sessionStorage.getItem("outiiil_annulationEchec"), JEU.rechargements]`)).toEqual([
      null,
      1,
    ]);
  });

  test("attaque lancée d'ici il y a plus de 2 min : le jeu n'annule plus, pas de lien", async () => {
    await ouvrir();
    expect(lire(`$("#o_attaquesLancees .o_attaqueAnnuler a").length`)).toBe(0);
  });
});
