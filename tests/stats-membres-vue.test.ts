import { beforeEach, describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Vue « Stats membres » (menu Alliance → Stats membres, page Membres,
 * 1.127.0, demande du mainteneur) : le dernier relevé de chaque joueur lu dans
 * le Google Sheet « Stats membres », les cases du partage du joueur en haut
 * (les mêmes que Préférences → Partage de données) et la mise en couleur au
 * choix, du vert très clair (valeur la plus faible) au vert marqué (la plus
 * élevée). Depuis 1.131.0 : colonnes dans l'ordre du mainteneur (« Ov » après
 * TdP, « Champi » avant Puceron), CdF et FdF abrégés (k, m, g, t, deux
 * chiffres au plus), TdC actuel de chaque membre en dernière colonne (tableau
 * de la page Membres) et export CSV daté. Depuis 1.148.0 : un seul niveau de
 * partage ; un membre qui n'est pas chef voit les mêmes relevés sans pseudo,
 * sauf le sien, ni TdC. Rien n'est lu avant que la vue soit montrée. Joueurs
 * inventés.
 */
const page = creerPage(
  [
    "js/lib/datatables_1.10.16.js",
    "js/class/Utils.js",
    "js/class/Classeur.js",
    "js/class/ExportRapports.js",
    "js/page/PartageChasses.js",
    "js/class/SuiviMembres.js",
    "js/page/StatsMembres.js",
  ],
  `var DEBUT = moment("2026-11-18 09:30", "YYYY-MM-DD HH:mm").valueOf();
   var heure = DEBUT;
   var Horloge = { maintenant: () => heure, serveur: () => moment(heure) };
   var monProfil = { pseudo: "Bravo", parametre: { couleur2: { valeur: "#f0e0c0" } } };`,
  "https://s5.fourmizzz.fr/alliance.php?Membres",
);
const lire = <T = any>(e: string) => page.lire<T>(e);

const ADRESSE = "https://script.google.com/macros/s/AKfycbInventeStats/exec";
// ordre des colonnes de la vue
const CLES = [
  "tdp",
  "ouvrieres",
  "cdf",
  "fdfHB",
  "fdfAB",
  "va",
  "vc",
  "champignonniere",
  "puceron",
];
const tous = (v: unknown) => Object.fromEntries(CLES.map((c) => [c, v]));
// tableau Membres du jeu : rang en 3e colonne, pseudo en 4e, TdC en 6e ; Delta
// n'a pas de relevé, Char<lie> n'est plus membre
const ligneMembre = (n: number, pseudo: string, tdc: string) =>
  `<tr><td>${n}</td><td></td><td>Membre</td><td><a href='Membre.php?Pseudo=${pseudo}'>${pseudo}</a></td><td></td><td>${tdc}</td><td></td><td>12</td><td>14</td><td></td><td></td></tr>`;
const TABLEAU_MEMBRES =
  "<table id='tabMembresAlliance'><tr class='alt'><th></th><th></th><th>Rang</th><th>Pseudo</th><th></th><th>Terrain</th><th></th><th>Technologie</th><th>Fourmiliere</th><th colspan='2'>Etat</th></tr>" +
  ligneMembre(1, "Alpha", "2 345 678") +
  ligneMembre(2, "bravo", "987 654") +
  ligneMembre(3, "Delta", "5 000") +
  "</table>";
const RELEVES = [
  {
    joueur: "Alpha",
    date: "2026-11-18 08:03",
    valeurs: { ...tous(1), tdp: 30, cdf: 1000, fdfHB: 50000, va: 5, ouvrieres: 350000 },
    partages: tous(true),
  },
  {
    joueur: "Bravo",
    date: "2026-11-17 22:10",
    valeurs: { ...tous(1), tdp: 40, cdf: null, fdfHB: 150000, va: 9, ouvrieres: null },
    partages: { ...tous(true), cdf: false, ouvrieres: false },
  },
  {
    joueur: "Char<lie>",
    date: "2026-11-16",
    valeurs: { ...tous(null), tdp: 35, fdfHB: 1234567 },
    partages: tous(null),
  },
];

beforeEach(() => {
  lire(`(() => {
    localStorage.clear();
    // le joueur de la page (Bravo) est chef : le tableau est réservé aux chefs
    localStorage.setItem("fzzz_reglagesAlliance", JSON.stringify({ lu: 0, alliance: "OUAF", section: true, sujet: true, reglages: { chefs: ["Alpha", "Bravo"] } }));
    lectureStatsMembres = null;
    relevesStatsMembres = null;
    tdcStatsMembres = null;
    tdcTableauStats = null;
    heure = DEBUT;
    history.replaceState(null, "", "/alliance.php?Membres");
    document.body.innerHTML =
      "<span id='tag_alliance'>OUAF</span>" +
      "<ul id='menuAlliance'><li><a class='boutonMembres' href='alliance.php?Membres'><span></span>Membres</a></li>" +
      "<li><a class='boutonCandidature' href='alliance.php?voirCandidature'>Candidatures</a></li></ul>" +
      ${JSON.stringify(`<div id='alliance'>${TABLEAU_MEMBRES}</div>`)};
    window.APPELS = [];
    window.FICHIERS = [];
    window.ADRESSE = { url: ${JSON.stringify(ADRESSE)}, manque: "" };
    window.REPONSE = { ok: true, releves: ${JSON.stringify(RELEVES)} };
    window.TDC = { Alpha: 3000000, bravo: 990000, Delta: 6000 };
    SuiviMembres.adresse = () => (APPELS.push("forum"), ADRESSE instanceof Error ? Promise.reject(ADRESSE) : Promise.resolve(ADRESSE));
    ExportRapports.requete = (url, methode, corps) => {
      APPELS.push([url, methode, corps]);
      return REPONSE instanceof Error ? Promise.reject(REPONSE) : Promise.resolve(REPONSE);
    };
    PartageChasses.tdcMembres = (frais) => (APPELS.push(["tdcMembres", frais]), Promise.resolve(TDC));
    Classeur.telecharger = (octets, nom, type) => FICHIERS.push({ octets: Array.from(octets), nom, type });
  })()`);
});
const ouvrir = async () => {
  lire(`StatsMembres.ajouterMenu(); StatsMembres.installer()`);
  lire(`$("#o_ongletStatsMembres").trigger("click")`);
  await lire(`lectureStatsMembres`);
};
const cellules = () =>
  lire<string[][]>(
    `$("#o_statsMembresTable tbody tr").map((i, tr) => [$(tr).children().map((j, td) => $(td).text().trim()).get()]).get()`,
  );
const colonne = (i: number) => cellules().map((l) => l[i]);
const etat = () => lire<string>(`$("#o_statsMembresEtat").text()`);
const minutes = (n: number) => lire(`heure += ${n * 60000}`);
// fichier CSV du dernier export : nom, type, marque UTF-8, lignes
const exporte = () => {
  const f = lire<{ octets: number[]; nom: string; type: string }[]>(`FICHIERS`).at(-1)!;
  const texte = new TextDecoder("utf-8", { ignoreBOM: true }).decode(Uint8Array.from(f.octets));
  return {
    nom: f.nom,
    type: f.type,
    bom: texte.startsWith("\ufeff"),
    lignes: texte.slice(1).split("\r\n"),
  };
};

describe("entrée du menu Alliance", () => {
  test("après « Carte », sinon après « Membres » ; une seule fois ; rien sans alliance", () => {
    lire(`StatsMembres.ajouterMenu(); StatsMembres.ajouterMenu()`);
    expect(lire(`$("#menuAlliance a").map((i, a) => $(a).text()).get()`)).toEqual([
      "Membres",
      "Stats membres",
      "Candidatures",
    ]);
    expect(lire(`$("#o_ongletStatsMembres").attr("href")`)).toBe(
      "alliance.php?Membres#statsMembres",
    );
    expect(lire(`$("#o_ongletStatsMembres").attr("class")`)).toBe("boutonStatJoueur");
    lire(`(() => {
      $("#o_ongletStatsMembres").parent().remove();
      $("#menuAlliance .boutonMembres").parent().after("<li><a id='o_ongletCarte' class='boutonCarte'>Carte</a></li>");
      StatsMembres.ajouterMenu();
    })()`);
    expect(lire(`$("#menuAlliance a").map((i, a) => $(a).text()).get()`)).toEqual([
      "Membres",
      "Carte",
      "Stats membres",
      "Candidatures",
    ]);
    lire(`document.body.innerHTML = "<ul id='menuAlliance'></ul>"; StatsMembres.ajouterMenu()`);
    expect(lire(`$("#o_ongletStatsMembres").length`)).toBe(0);
  });

  test("rien n'est lu avant que la vue soit montrée ; l'adresse de la vue la montre à l'arrivée", async () => {
    lire(`StatsMembres.ajouterMenu(); StatsMembres.installer()`);
    expect([lire(`APPELS`), lire(`$("#o_statsMembres").length`)]).toEqual([[], 0]);
    lire(
      `(() => { lectureStatsMembres = null; history.replaceState(null, "", "/alliance.php?Membres#statsMembres"); })()`,
    );
    lire(`StatsMembres.installer()`);
    await lire(`lectureStatsMembres`);
    expect(lire(`APPELS`)).toEqual(["forum", [ADRESSE, "POST", { releves: true }]]);
    // montrée de nouveau (clic sur l'entrée) : pas de nouvelle lecture
    await lire(`StatsMembres.afficher()`);
    expect(lire(`APPELS`)).toHaveLength(2);
  });

  test("adresse de la vue tapée sur la page Membres déjà ouverte : montrée sans recharger", async () => {
    lire(`StatsMembres.installer()`);
    expect(lire(`$("#o_statsMembres").length`)).toBe(0);
    lire(
      `(() => { location.hash = "statsMembres"; window.dispatchEvent(new HashChangeEvent("hashchange")); })()`,
    );
    await lire(`lectureStatsMembres`);
    expect(lire(`$("#o_statsMembres").css("display")`)).toBe("block");
    expect(lire(`APPELS`)).toHaveLength(2);
  });
});

describe("tableau du dernier relevé de chaque joueur", () => {
  test("contenu de la page caché ; une ligne par joueur, colonnes dans l'ordre demandé, non partagé « — » en rouge, pas lu vide", async () => {
    lire(`$("#alliance").after("<div id='o_carteAlliance'>carte</div>")`);
    await ouvrir();
    expect(
      lire(
        `[$("#alliance").css("display"), $("#o_carteAlliance").css("display"), $("#o_statsMembres").css("display")]`,
      ),
    ).toEqual(["none", "none", "block"]);
    expect(lire(`$("#o_statsMembresTable thead th").map((i, th) => $(th).text()).get()`)).toEqual([
      "Joueur",
      "Relevé",
      "TdP",
      "Ov",
      "CdF",
      "FdF HB",
      "FdF AB",
      "VA",
      "VC",
      "Champi",
      "Puceron",
      "TdC",
    ]);
    // titre court, libellé complet en info-bulle
    expect(lire<string>(`$("#o_statsMembresTable thead th").eq(3).attr("title")`)).toContain(
      "Ouvrières",
    );
    // trié par pseudo ; les pseudos viennent du fichier : échappés ; CdF et FdF
    // abrégés ; TdC de la page Membres, vide pour un ancien membre
    expect(cellules()).toEqual([
      [
        "Alpha",
        "18/11 08h03",
        "30",
        "350 000",
        "1\u00a0k",
        "50\u00a0k",
        "1",
        "5",
        "1",
        "1",
        "1",
        "2 345 678",
      ],
      ["Bravo", "17/11 22h10", "40", "—", "—", "150\u00a0k", "1", "9", "1", "1", "1", "987 654"],
      ["Char<lie>", "16/11", "35", "", "", "1,23\u00a0M", "", "", "", "", "", ""],
    ]);
    // information non partagée : case rouge (classe), dite par la légende
    expect(
      lire(`$("#o_statsMembresTable td.o_statsNonPartage").map((i, td) => td.dataset.cle).get()`),
    ).toEqual(["ouvrieres", "cdf"]);
    expect(lire(`$("#o_statsMembres > p:last .o_statsNonPartage").text()`)).toBe("—");
    expect(lire<string>(`$("#o_statsMembres > p:last").text()`)).toContain(
      "— case rouge : information que le joueur ne partage pas. Case vide : information pas relevée ce jour-là",
    );
    expect(lire(`$("#o_statsMembresTable tbody a").last().attr("href")`)).toBe(
      "Membre.php?Pseudo=Char%3Clie%3E",
    );
    expect(lire(`$("#o_statsMembresTable script, #o_statsMembresTable lie").length`)).toBe(0);
    // ligne du joueur mise en valeur (classe du surlignage)
    expect(lire(`$("#o_statsMembresTable tr.o_statsMoi td:first").text()`)).toBe("Bravo");
    expect(etat()).toBe("3 joueur(s), fichier lu à 09h30, TdC lus à 09h30.");
    // TdC du tableau du jeu, lus à l'ouverture de la page : aucune requête
    expect(lire(`APPELS`)).toEqual(["forum", [ADRESSE, "POST", { releves: true }]]);
  });

  test("CdF et FdF : valeur exacte au survol ; les autres colonnes en entier", async () => {
    await ouvrir();
    expect(
      lire(
        `$("#o_statsMembresTable tbody tr:last td").map((i, td) => [[td.dataset.cle || "", td.title]]).get()`,
      ).filter(([, titre]: string[]) => titre),
    ).toEqual([["fdfHB", "1 234 567"]]);
    expect(lire(`$("#o_statsMembresTable td[data-cle='fdfHB']").first().attr("data-order")`)).toBe(
      "50000",
    );
  });

  test("police réduite par pas de 5 % tant que le tableau dépasse du cadre, pas sous 60 % (il défile alors)", async () => {
    await ouvrir();
    // pas de mise en page ici : un tableau de 1 000 px à 100 %, proportionnel à sa police
    const taille = (cadre: number) =>
      lire<string>(`(() => {
        const cadre = document.querySelector(".o_statsMembresTableau"),
          t = document.getElementById("o_statsMembresTable");
        Object.defineProperty(cadre, "clientWidth", { configurable: true, get: () => ${cadre} });
        Object.defineProperty(cadre, "scrollWidth", {
          configurable: true,
          get: () => Math.max(${cadre}, Math.round((1000 * (parseFloat(t.style.fontSize) || 100)) / 100)),
        });
        StatsMembres.ajusterTaille();
        return t.style.fontSize;
      })()`);
    expect([taille(1200), taille(850), taille(700), taille(400), taille(1200)]).toEqual([
      "",
      "85%",
      "70%",
      "60%",
      "",
    ]);
  });

  test("tri par une statistique ou par le TdC : de la plus élevée à la plus faible d'abord", async () => {
    await ouvrir();
    lire(`$("#o_statsMembresTable thead th").eq(5).trigger("click")`);
    expect(colonne(0)).toEqual(["Char<lie>", "Bravo", "Alpha"]);
    lire(`$("#o_statsMembresTable thead th").eq(11).trigger("click")`);
    expect(colonne(0)).toEqual(["Alpha", "Bravo", "Char<lie>"]);
  });
});

describe("nombres abrégés : préfixes du Système international k, M, G, T, trois chiffres, tronqués", () => {
  test("dès 1 000 dans la plus grande unité, trois chiffres tronqués (3 678 837 → 3,67M, 999 999 → 999k)", () => {
    const abreger = (v: number) => lire<string>(`StatsMembres.abreger(${v})`);
    expect(
      [0, 7, 50, 99, 100, 200, 949, 999, 1000, 1050, 1234, 1500, 9999, 12345, 15000].map(abreger),
    ).toEqual([
      "0",
      "7",
      "50",
      "99",
      "100",
      "200",
      "949",
      "999",
      "1\u00a0k",
      "1,05\u00a0k",
      "1,23\u00a0k",
      "1,5\u00a0k",
      "9,99\u00a0k",
      "12,3\u00a0k",
      "15\u00a0k",
    ]);
    expect(
      [
        99600, 150000, 250000, 999999, 1999999, 2400000, 3678837, 4860000, 25000000, 3e9, 45e8,
        4.5e12, 77e12,
      ].map(abreger),
    ).toEqual([
      "99,6\u00a0k",
      "150\u00a0k",
      "250\u00a0k",
      "999\u00a0k",
      "1,99\u00a0M",
      "2,4\u00a0M",
      "3,67\u00a0M",
      "4,86\u00a0M",
      "25\u00a0M",
      "3\u00a0G",
      "4,5\u00a0G",
      "4,5\u00a0T",
      "77\u00a0T",
    ]);
    // une espace insécable entre le nombre et le préfixe, jamais une espace simple
    expect(abreger(3678837)).toBe("3,67\u00a0M");
    expect(abreger(3678837)).not.toContain(" ");
    // jamais plus de trois chiffres
    const valeurs = [
      0,
      1,
      999,
      1000,
      1001,
      9999,
      10001,
      123456,
      999999,
      1e6 + 1,
      987654321,
      5e11 + 7,
      999e12,
    ];
    expect(valeurs.map(abreger).filter((t) => t.replace(/\D/g, "").length > 3)).toEqual([]);
  });
});

describe("colonne TdC : TdC actuel de chaque membre, page Membres", () => {
  test("pseudo sans tenir compte des majuscules ; un membre sans relevé n'a pas de ligne", async () => {
    await ouvrir();
    expect(colonne(0)).toEqual(["Alpha", "Bravo", "Char<lie>"]);
    expect(
      lire(
        `$("#o_statsMembresTable td[data-cle='tdc']").map((i, td) => td.dataset.valeur || "").get()`,
      ),
    ).toEqual(["2345678", "987654", ""]);
  });

  test("page Membres ouverte depuis plus d'une minute : TdC relus à l'affichage de la vue", async () => {
    lire(`StatsMembres.ajouterMenu(); StatsMembres.installer()`);
    minutes(2);
    lire(`$("#o_ongletStatsMembres").trigger("click")`);
    await lire(`lectureStatsMembres`);
    expect(lire(`APPELS`)).toContainEqual(["tdcMembres", true]);
    expect(colonne(11)).toEqual(["3 000 000", "990 000", ""]);
    expect(etat()).toBe("3 joueur(s), fichier lu à 09h32, TdC lus à 09h32.");
  });

  test("tableau du jeu pas encore là à l'ouverture : TdC lus sur la page Membres", async () => {
    lire(`$("#tabMembresAlliance").remove()`);
    await ouvrir();
    expect(lire(`APPELS`)).toContainEqual(["tdcMembres", true]);
    expect(colonne(11)).toEqual(["3 000 000", "990 000", ""]);
  });

  test("page Membres illisible : colonne vide, dit dans l'état", async () => {
    lire(`(() => { $("#tabMembresAlliance").remove(); TDC = {}; })()`);
    await ouvrir();
    expect(colonne(11)).toEqual(["", "", ""]);
    expect(etat()).toBe("3 joueur(s), fichier lu à 09h30, TdC illisibles (page Membres).");
  });
});

describe("cases du partage, les mêmes que dans Préférences → Partage de données", () => {
  // chaque information, dans l'ordre des colonnes : [clé, cochée, verrouillée]
  const cases = () =>
    lire<[string, boolean, boolean][]>(
      `$("#o_statsMembres input[data-partage]").map((i, c) => [[c.dataset.partage, c.checked, c.disabled]]).get()`,
    );

  test("une ligne, dans l'ordre et avec les titres des colonnes ; état de ce navigateur ; Champi et Puceron verrouillés", async () => {
    lire(`(() => {
      localStorage.setItem("fzzz_partage_vc", "0");
      // choix « avec les autres » des versions 1.136.0 à 1.147.0 : plus lu
      localStorage.setItem("fzzz_partageAutres_tdp", "0");
      localStorage.setItem("fzzz_partage_champignonniere", "0");
    })()`);
    await ouvrir();
    expect(
      lire<string>(
        `$("#o_statsMembres .o_statsMembresReglages").first().text().replace(/\\s+/g, " ").trim()`,
      ),
    ).toBe("Partagé : TdP Ov CdF FdF HB FdF AB VA VC Champi Puceron");
    expect(
      lire(
        `$("#o_statsMembres input[data-partage-autres], #o_statsMembres input[data-partage-chefs]").length`,
      ),
    ).toBe(0);
    expect(cases()).toEqual(
      CLES.map((c) =>
        c == "vc"
          ? [c, false, false]
          : c == "champignonniere" || c == "puceron"
            ? [c, true, true]
            : [c, true, false],
      ),
    );
  });

  test("choix gardés, relevé à refaire, et la même case des Préférences ouvertes suit", async () => {
    // cases des Préférences ouvertes en même temps
    lire(
      `$("body").append(SuiviMembres.casesPartage("o_partageLigne").replace(/<div /g, "<div data-pref ")); SuiviMembres.majCases()`,
    );
    await ouvrir();
    lire(`$("#o_statsMembres input[data-partage='cdf']").prop("checked", false).trigger("change")`);
    expect(lire(`localStorage.getItem("fzzz_partage_cdf")`)).toBe("0");
    expect(lire(`SuiviMembres.etat().fait`)).toBe(false);
    expect(lire(`$("[data-pref] input[data-partage='cdf']").prop("checked")`)).toBe(false);
    lire(`$("[data-pref]").remove()`);
  });
});

describe("ce que voit un membre qui n'est pas chef : les mêmes relevés, sans pseudo sauf le sien (mainteneur, 21/11/2026)", () => {
  const garder = (chefs: string[]) =>
    `localStorage.setItem("fzzz_reglagesAlliance", JSON.stringify({ lu: 0, alliance: "OUAF", section: true, sujet: true, reglages: { chefs: ${JSON.stringify(chefs)} } }))`;
  // réglages relus à l'affichage de la vue (SuiviMembres.adresse) : cette liste de chefs
  const relus = (chefs: string[]) =>
    lire(`SuiviMembres.adresse = () => {
      APPELS.push("forum");
      ${garder(chefs)};
      return Promise.resolve(ADRESSE);
    }`);
  const demandes = () =>
    lire<any[]>(`APPELS`)
      .filter((a) => Array.isArray(a) && a[0] == ADRESSE)
      .map((a) => a[2]);
  // réponse de la requête « relevesAnonymes » : pseudos vides sauf celui du
  // joueur (Bravo), lignes rangées par TdP ; un pseudo rendu quand même est effacé
  const ANONYMES = [
    { ...RELEVES[0], joueur: "Alpha" },
    { ...RELEVES[2], joueur: "" },
    { ...RELEVES[1], joueur: "bravo" },
  ];

  test("non chef : relevés sans pseudo sauf le sien, sans TdC, rangés par TdP ; même partage que les chefs", async () => {
    lire(garder(["Alpha"]));
    relus(["Alpha"]);
    lire(`REPONSE = { ok: true, releves: ${JSON.stringify(ANONYMES)} }`);
    await ouvrir();
    expect(demandes()).toEqual([{ relevesAnonymes: { joueur: "Bravo" } }]);
    expect(lire(`$("#o_statsMembresTable thead th").map((i, th) => $(th).text()).get()`)).toEqual([
      "Joueur",
      "Relevé",
      "TdP",
      "Ov",
      "CdF",
      "FdF HB",
      "FdF AB",
      "VA",
      "VC",
      "Champi",
      "Puceron",
    ]);
    // TdP décroissant ; ni pseudo ni lien sur les autres lignes ; aucun TdC lu
    expect(cellules()).toEqual([
      ["bravo", "17/11 22h10", "40", "—", "—", "150\u00a0k", "1", "9", "1", "1", "1"],
      ["", "16/11", "35", "", "", "1,23\u00a0M", "", "", "", "", ""],
      ["", "18/11 08h03", "30", "350 000", "1\u00a0k", "50\u00a0k", "1", "5", "1", "1", "1"],
    ]);
    expect(lire(`$("#o_statsMembresTable tbody a").map((i, a) => a.textContent).get()`)).toEqual([
      "bravo",
    ]);
    expect(lire(`$("#o_statsMembresTable tr.o_statsMoi").length`)).toBe(1);
    expect(lire(`APPELS.filter((a) => Array.isArray(a) && a[0] == "tdcMembres").length`)).toBe(0);
    expect(etat()).toBe("3 joueur(s), fichier lu à 09h30.");
    const legende = lire<string>(`$("#o_statsMembres > p:last").text()`);
    expect(legende).toContain(
      "Dernier relevé de chaque joueur dans le Google Sheet « Stats membres » de l'alliance : pseudos masqués, sauf le tien.",
    );
    expect(lire(`$("#o_statsMembresLegendeTdc").css("display")`)).toBe("none");
    // pas de tri par pseudo (il ne mettrait que le sien en tête)
    lire(`$("#o_statsMembresTable thead th").eq(0).trigger("click")`);
    expect(cellules().map((l) => l[2])).toEqual(["40", "35", "30"]);
    // ses propres cases du partage restent là, avec la couleur et l'export
    expect(
      lire(
        `[$("#o_statsMembres input[data-partage]").length, $("#o_statsMembresCouleurs").length, $("#o_statsMembresCsv").prop("disabled")]`,
      ),
    ).toEqual([CLES.length, 1, false]);
  });

  test("non chef : export CSV sans pseudo sauf le sien, sans TdC", async () => {
    lire(garder(["Alpha"]));
    relus(["Alpha"]);
    lire(`REPONSE = { ok: true, releves: ${JSON.stringify(ANONYMES)} }`);
    await ouvrir();
    await lire(`StatsMembres.exporter()`);
    const { lignes } = exporte();
    expect(lignes[0]).toBe(
      "Stats membres OUAF, export du 18/11/2026 à 09h30 (heure du jeu), pseudos masqués sauf le tien",
    );
    expect(lignes[2]).toBe("Joueur;Relevé;TdP;Ov;CdF;FdF HB;FdF AB;VA;VC;Champi;Puceron");
    expect(lignes.slice(3, 6).map((l) => l.split(";")[0])).toEqual(["bravo", "", ""]);
    expect(lignes.slice(3, 6).every((l) => l.split(";").length == 11)).toBe(true);
    expect(lire(`APPELS.filter((a) => Array.isArray(a) && a[0] == "tdcMembres").length`)).toBe(0);
  });

  test("chef (pseudo écrit avec une autre casse) : les pseudos et les TdC", async () => {
    lire(garder(["BRAVO"]));
    relus(["BRAVO"]);
    await ouvrir();
    expect(demandes()).toEqual([{ releves: true }]);
    expect(lire(`$("#o_statsMembresTable tbody tr").length`)).toBe(RELEVES.length);
    expect(etat()).toMatch(/^3 joueur\(s\), fichier lu à 09h30, TdC lus à/);
    expect(lire<string>(`$("#o_statsMembres > p:last").text()`)).not.toContain("pseudos masqués");
  });

  test("chef retiré depuis la dernière lecture des réglages : relu à l'affichage, il demande les relevés sans pseudo", async () => {
    lire(garder(["Bravo"]));
    relus(["Alpha"]);
    lire(`REPONSE = { ok: true, releves: ${JSON.stringify(ANONYMES)} }`);
    await ouvrir();
    expect(demandes()).toEqual([{ relevesAnonymes: { joueur: "Bravo" } }]);
    expect(cellules().map((l) => l[0])).toEqual(["bravo", "", ""]);
  });

  test("script pas encore redéployé : il refuse la requête, rien n'est montré au non-chef", async () => {
    lire(garder(["Alpha"]));
    relus(["Alpha"]);
    lire(`REPONSE = new Error("le script refuse : requête invalide")`);
    await ouvrir();
    expect([lire(`$("#o_statsMembresTable tbody tr").length`), etat()]).toEqual([
      0,
      "Stats illisibles : le script du Google Sheet « Stats membres » n'est pas à jour, son propriétaire doit le redéployer (nouvelle version).",
    ]);
  });
});

describe("mise en couleur du tableau", () => {
  const rgb = (hex: string) =>
    `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;
  // happy-dom garde l'hexadécimal écrit, un navigateur le rend en rgb()
  const couleur = (c: string) => (c.startsWith("#") ? rgb(c) : c);
  const fonds = (colonne: number) =>
    lire<string[][]>(
      `$("#o_statsMembresTable tbody tr").map((i, tr) => [[$(tr).children().eq(${colonne}).prop("style").backgroundColor, $(tr).children().eq(${colonne}).prop("style").color]]).get()`,
    ).map((l) => l.map(couleur));
  const vert = (i: number) => lire<string>(`VERTS_STATS[${i}]`);

  test("décochée par défaut ; cochée : vert très clair pour la plus faible, vert marqué pour la plus élevée ; choix gardé", async () => {
    await ouvrir();
    expect(lire(`$("#o_statsMembresCouleurs").prop("checked")`)).toBe(false);
    expect(lire<string>(`$("#o_statsMembresCouleurs").parent().text().trim()`)).toBe(
      "Mise en couleur du tableau",
    );
    expect(fonds(2)).toEqual([
      ["", ""],
      ["", ""],
      ["", ""],
    ]);
    lire(`$("#o_statsMembresCouleurs").prop("checked", true).trigger("change")`);
    expect(lire(`localStorage.getItem("fzzz_statsMembresCouleurs")`)).toBe("1");
    // TdP 30, 40, 35 : la plus faible, la plus élevée, le milieu
    expect(fonds(2)).toEqual([
      [rgb(vert(0)), "rgb(26, 26, 26)"],
      [rgb(vert(8)), "rgb(255, 255, 255)"],
      [rgb(vert(4)), "rgb(26, 26, 26)"],
    ]);
    // Ov : une seule valeur partagée ; « — » et case vide sans couleur
    expect(fonds(3)).toEqual([
      [rgb(vert(0)), "rgb(26, 26, 26)"],
      ["", ""],
      ["", ""],
    ]);
    // TdC compris
    expect(fonds(11)).toEqual([
      [rgb(vert(8)), "rgb(255, 255, 255)"],
      [rgb(vert(0)), "rgb(26, 26, 26)"],
      ["", ""],
    ]);
    lire(`$("#o_statsMembresCouleurs").prop("checked", false).trigger("change")`);
    expect(fonds(2)).toEqual([
      ["", ""],
      ["", ""],
      ["", ""],
    ]);
  });

  test("gardée cochée : appliquée dès la lecture", async () => {
    lire(`localStorage.setItem("fzzz_statsMembresCouleurs", "1")`);
    await ouvrir();
    expect(fonds(7)[1]?.[0]).toBe(rgb(vert(8)));
  });

  test("teinte proportionnelle à la valeur entre la plus faible et la plus élevée de la colonne", () => {
    const niveau = (v: number, min: number, max: number) =>
      lire<number>(`StatsMembres.niveau(${v}, ${min}, ${max})`);
    expect([
      niveau(10, 10, 90),
      niveau(50, 10, 90),
      niveau(90, 10, 90),
      niveau(15, 10, 90),
    ]).toEqual([0, 4, 8, 1]);
    expect(niveau(7, 7, 7)).toBe(0);
    expect(lire(`VERTS_STATS.length`)).toBe(9);
  });
});

describe("export CSV du tableau, daté", () => {
  const ENTETE = "Joueur;Relevé;TdP;Ov;CdF;FdF HB;FdF AB;VA;VC;Champi;Puceron;TdC";

  test("bouton actif une fois le tableau rempli ; un clic lance l'export", async () => {
    lire(`StatsMembres.ajouterMenu(); StatsMembres.installer()`);
    lire(
      `(() => { window.ATTENTE = new Promise((r) => (window.LIBERER = r)); ExportRapports.requete = () => ATTENTE; })()`,
    );
    lire(`$("#o_ongletStatsMembres").trigger("click")`);
    expect(lire(`$("#o_statsMembresCsv").prop("disabled")`)).toBe(true);
    lire(`LIBERER(REPONSE)`);
    await lire(`lectureStatsMembres`);
    expect(lire(`$("#o_statsMembresCsv").prop("disabled")`)).toBe(false);
    lire(`(() => {
      let exporter = StatsMembres.exporter;
      window.CLICS = 0;
      StatsMembres.exporter = () => (CLICS++, Promise.resolve());
      $("#o_statsMembresCsv").trigger("click");
      StatsMembres.exporter = exporter;
    })()`);
    expect(lire(`CLICS`)).toBe(1);
  });

  test("pour Excel en français : « ; », marque UTF-8, nombres bruts, date de l'export et des TdC en tête", async () => {
    await ouvrir();
    await lire(`StatsMembres.exporter()`);
    const f = exporte();
    expect([f.nom, f.type, f.bom]).toEqual([
      "stats-membres-OUAF-2026-11-18-09h30.csv",
      "text/csv;charset=utf-8",
      true,
    ]);
    expect(f.lignes).toEqual([
      "Stats membres OUAF, export du 18/11/2026 à 09h30 (heure du jeu), TdC lus le 18/11/2026 à 09h30",
      "",
      ENTETE,
      "Alpha;18/11/2026 08:03;30;350000;1000;50000;1;5;1;1;1;2345678",
      "Bravo;17/11/2026 22:10;40;non partagé;non partagé;150000;1;9;1;1;1;987654",
      "Char<lie>;16/11/2026;35;;;1234567;;;;;;",
      "",
    ]);
    expect(lire(`$("#o_statsMembresCsv").prop("disabled")`)).toBe(false);
  });

  test("dans l'ordre du tableau ; TdC de plus d'une minute relus d'abord, tri gardé", async () => {
    await ouvrir();
    lire(`$("#o_statsMembresTable thead th").eq(11).trigger("click")`);
    minutes(2);
    lire(`TDC = { Alpha: 2400000, bravo: 990000, "Char<lie>": 3000000 }`);
    await lire(`StatsMembres.exporter()`);
    expect(lire(`APPELS`)).toContainEqual(["tdcMembres", true]);
    expect(colonne(0)).toEqual(["Char<lie>", "Alpha", "Bravo"]);
    expect(lire(`$("#o_statsMembresTable thead th").eq(11).hasClass("sorting_desc")`)).toBe(true);
    expect(etat()).toBe("3 joueur(s), fichier lu à 09h30, TdC lus à 09h32.");
    const f = exporte();
    expect(f.nom).toBe("stats-membres-OUAF-2026-11-18-09h32.csv");
    expect(f.lignes[0]).toBe(
      "Stats membres OUAF, export du 18/11/2026 à 09h32 (heure du jeu), TdC lus le 18/11/2026 à 09h32",
    );
    expect(f.lignes.slice(3, 6).map((l) => [l.split(";")[0], l.split(";").at(-1)])).toEqual([
      ["Char<lie>", "3000000"],
      ["Alpha", "2400000"],
      ["Bravo", "990000"],
    ]);
  });

  test("TdC pas relus (page Membres illisible) : ceux du tableau, avec leur heure", async () => {
    await ouvrir();
    minutes(2);
    lire(`TDC = {}`);
    await lire(`StatsMembres.exporter()`);
    const f = exporte();
    expect(f.lignes[0]).toBe(
      "Stats membres OUAF, export du 18/11/2026 à 09h32 (heure du jeu), TdC lus le 18/11/2026 à 09h30",
    );
    expect(f.lignes[3]).toBe("Alpha;18/11/2026 08:03;30;350000;1000;50000;1;5;1;1;1;2345678");
  });

  test("champ avec « ; » ou guillemets entre guillemets ; une formule reste du texte", async () => {
    lire(
      `REPONSE = { ok: true, releves: [{ joueur: "=SOMME(A1)", date: "2026-11-18 =1+1", valeurs: { tdp: 1 }, partages: {} }, { joueur: 'Pied;"Nu"', date: "", valeurs: {}, partages: {} }] }`,
    );
    await ouvrir();
    await lire(`StatsMembres.exporter()`);
    expect(exporte().lignes.slice(3, 5)).toEqual([
      "'=SOMME(A1);18/11/2026;1;;;;;;;;;",
      '"Pied;""Nu""";;;;;;;;;;;',
    ]);
  });
});

describe("fichier introuvable ou illisible : la raison, en rouge", () => {
  const messageDe = async (preparer: string) => {
    lire(preparer);
    await ouvrir();
    return [lire<boolean>(`$("#o_statsMembresEtat").hasClass("red")`), etat()];
  };

  test("sujet des réglages absent du forum, ou sans la ligne du fichier", async () => {
    expect(await messageDe(`ADRESSE = { url: "", manque: "sujet" }`)).toEqual([
      true,
      "Stats illisibles : pas de sujet « Réglages de l'extension » dans la section cachée du forum.",
    ]);
    expect(lire(`APPELS`)).toEqual(["forum"]);
    lire(`(() => { lectureStatsMembres = null; $("#o_statsMembres").remove(); })()`);
    expect(await messageDe(`ADRESSE = { url: "", manque: "ligne" }`)).toEqual([
      true,
      "Stats illisibles : pas de ligne « Google Sheet des stats membres » dans le sujet « Réglages de l'extension ».",
    ]);
  });

  test("forum illisible", async () => {
    expect(await messageDe(`ADRESSE = new Error("forum")`)).toEqual([
      true,
      "Stats illisibles : le forum de l'alliance n'a pas pu être lu, réessaie dans un instant.",
    ]);
  });

  test("script d'avant cette lecture : il refuse la requête, son propriétaire doit le redéployer", async () => {
    expect(await messageDe(`REPONSE = new Error("le script refuse : requête invalide")`)).toEqual([
      true,
      "Stats illisibles : le script du Google Sheet « Stats membres » n'est pas à jour, son propriétaire doit le redéployer (nouvelle version).",
    ]);
  });
});
