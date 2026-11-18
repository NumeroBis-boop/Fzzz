import { beforeEach, describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Vue « Stats membres » (menu Alliance → Stats membres, page Membres,
 * 1.127.0, demande du mainteneur) : le dernier relevé de chaque joueur lu dans
 * le Google Sheet « Stats membres », les cases du partage du joueur en haut
 * (les mêmes que Préférences → Partage de données) et des couleurs par colonne
 * au choix, du vert très clair (valeur la plus faible) au vert marqué (la plus
 * élevée). Rien n'est lu avant que la vue soit montrée. Joueurs inventés.
 */
const page = creerPage(
  [
    "js/lib/datatables_1.10.16.js",
    "js/class/Utils.js",
    "js/class/ExportRapports.js",
    "js/page/PartageChasses.js",
    "js/class/SuiviMembres.js",
    "js/page/StatsMembres.js",
  ],
  `var heure = moment("2026-11-18 09:30", "YYYY-MM-DD HH:mm").valueOf();
   var Horloge = { maintenant: () => heure, serveur: () => moment(heure) };
   var monProfil = { pseudo: "Bravo", parametre: { couleur2: { valeur: "#f0e0c0" } } };`,
  "https://s5.fourmizzz.fr/alliance.php?Membres",
);
const lire = <T = any>(e: string) => page.lire<T>(e);

const ADRESSE = "https://script.google.com/macros/s/AKfycbInventeStats/exec";
const CLES = [
  "tdp",
  "cdf",
  "fdfHB",
  "fdfAB",
  "va",
  "vc",
  "puceron",
  "champignonniere",
  "ouvrieres",
];
const tous = (v: unknown) => Object.fromEntries(CLES.map((c) => [c, v]));
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
    lectureStatsMembres = null;
    history.replaceState(null, "", "/alliance.php?Membres");
    document.body.innerHTML =
      "<ul id='menuAlliance'><li><a class='boutonMembres' href='alliance.php?Membres'><span></span>Membres</a></li>" +
      "<li><a class='boutonCandidature' href='alliance.php?voirCandidature'>Candidatures</a></li></ul>" +
      "<div id='alliance'><table id='tabMembresAlliance'></table></div>";
    window.APPELS = [];
    window.ADRESSE = { url: ${JSON.stringify(ADRESSE)}, manque: "" };
    window.REPONSE = { ok: true, releves: ${JSON.stringify(RELEVES)} };
    SuiviMembres.adresse = () => (APPELS.push("forum"), ADRESSE instanceof Error ? Promise.reject(ADRESSE) : Promise.resolve(ADRESSE));
    ExportRapports.requete = (url, methode, corps) => {
      APPELS.push([url, methode, corps]);
      return REPONSE instanceof Error ? Promise.reject(REPONSE) : Promise.resolve(REPONSE);
    };
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
const etat = () => lire<string>(`$("#o_statsMembresEtat").text()`);

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
  test("contenu de la page caché ; une ligne par joueur, nombres en français, non partagé « — » en rouge, pas lu vide", async () => {
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
      "CdF",
      "FdF HB",
      "FdF AB",
      "VA",
      "VC",
      "Puceron",
      "Champignonnière",
      "Ouvrières",
    ]);
    // trié par pseudo ; les pseudos viennent du fichier : échappés
    expect(cellules()).toEqual([
      ["Alpha", "18/11 08h03", "30", "1 000", "50 000", "1", "5", "1", "1", "1", "350 000"],
      ["Bravo", "17/11 22h10", "40", "—", "150 000", "1", "9", "1", "1", "1", "—"],
      ["Char<lie>", "16/11", "35", "", "1 234 567", "", "", "", "", "", ""],
    ]);
    // information non partagée : case rouge (classe), dite par la légende
    expect(
      lire(`$("#o_statsMembresTable td.o_statsNonPartage").map((i, td) => td.dataset.cle).get()`),
    ).toEqual(["cdf", "ouvrieres"]);
    expect(lire(`$("#o_statsMembres > p:last .o_statsNonPartage").text()`)).toBe("—");
    expect(lire<string>(`$("#o_statsMembres > p:last").text()`)).toContain(
      "— case rouge : information que le joueur ne partage pas. Case vide : information pas relevée ce jour-là",
    );
    expect(lire(`$("#o_statsMembresTable tbody a").last().attr("href")`)).toBe(
      "Membre.php?Pseudo=Char%3Clie%3E",
    );
    expect(lire(`$("#o_statsMembresTable script, #o_statsMembresTable lie").length`)).toBe(0);
    // ligne du joueur en gras
    expect(lire(`$("#o_statsMembresTable tr.o_statsMoi td:first").text()`)).toBe("Bravo");
    expect(etat()).toBe("3 joueur(s), lu à 09h30.");
  });

  test("tri par une statistique : de la plus élevée à la plus faible d'abord", async () => {
    await ouvrir();
    lire(`$("#o_statsMembresTable thead th").eq(4).trigger("click")`);
    expect(cellules().map((l) => l[0])).toEqual(["Char<lie>", "Bravo", "Alpha"]);
  });
});

describe("cases du partage, comme dans Préférences → Partage de données", () => {
  test("état de ce navigateur ; décochée ici : gardée, relevé à refaire, case des Préférences suivie", async () => {
    lire(`localStorage.setItem("fzzz_partage_vc", "0")`);
    lire(`$("body").append("<input type='checkbox' data-partage='cdf' checked/>")`);
    await ouvrir();
    expect(
      lire(
        `$("#o_statsMembres input[data-stats-partage]").map((i, c) => [[c.dataset.statsPartage, c.checked]]).get()`,
      ),
    ).toEqual(CLES.map((c) => [c, c != "vc"]));
    expect(lire(`$("#o_statsMembres .o_statsMembresReglages").first().text()`)).toContain(
      "Je partage : TdP CdF FdF HB FdF AB VA VC Puceron Champignonnière Ouvrières(envoyé au fichier à ta prochaine page)",
    );
    lire(
      `$("#o_statsMembres input[data-stats-partage='cdf']").prop("checked", false).trigger("change")`,
    );
    expect(lire(`localStorage.getItem("fzzz_partage_cdf")`)).toBe("0");
    expect(lire(`SuiviMembres.etat().fait`)).toBe(false);
    expect(lire(`$("body > input[data-partage='cdf']").prop("checked")`)).toBe(false);
  });
});

describe("couleurs par colonne", () => {
  const rgb = (hex: string) =>
    `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;
  // happy-dom garde l'hexadécimal écrit, un navigateur le rend en rgb()
  const couleur = (c: string) => (c.startsWith("#") ? rgb(c) : c);
  const fonds = (colonne: number) =>
    lire<string[][]>(
      `$("#o_statsMembresTable tbody tr").map((i, tr) => [[$(tr).children().eq(${colonne}).prop("style").backgroundColor, $(tr).children().eq(${colonne}).prop("style").color]]).get()`,
    ).map((l) => l.map(couleur));
  const vert = (i: number) => lire<string>(`VERTS_STATS[${i}]`);

  test("décochées par défaut ; cochées : vert très clair pour la plus faible, vert marqué pour la plus élevée ; choix gardé", async () => {
    await ouvrir();
    expect(lire(`$("#o_statsMembresCouleurs").prop("checked")`)).toBe(false);
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
    // CdF : une seule valeur partagée ; « — » et case vide sans couleur
    expect(fonds(3)).toEqual([
      [rgb(vert(0)), "rgb(26, 26, 26)"],
      ["", ""],
      ["", ""],
    ]);
    lire(`$("#o_statsMembresCouleurs").prop("checked", false).trigger("change")`);
    expect(fonds(2)).toEqual([
      ["", ""],
      ["", ""],
      ["", ""],
    ]);
  });

  test("gardées cochées : appliquées dès la lecture", async () => {
    lire(`localStorage.setItem("fzzz_statsMembresCouleurs", "1")`);
    await ouvrir();
    expect(fonds(6)[1]?.[0]).toBe(rgb(vert(8)));
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
