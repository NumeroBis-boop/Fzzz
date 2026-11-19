import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Page Membres de l'alliance, vue « Floods et chasses en cours » : date du
 * dernier mouvement, variation totale et TdC final de chaque membre ; dans
 * l'info-bulle, la ligne du TdC à l'arrivée d'une attaque lancée à
 * l'ouverture de la page (temps de trajet à ma Vitesse d'attaque) est
 * surlignée. Joueurs inventés.
 */
const page = creerPage(
  [
    "js/lib/datatables_1.10.16.js",
    "js/lib/moment-duration-format.js",
    "js/class/Utils.js",
    "js/class/ExportJoueurs.js",
    "js/page/PartageChasses.js",
    "js/page/AllianceFzzz.js",
  ],
  `var heure = moment("2026-11-09 10:00:20", "YYYY-MM-DD HH:mm:ss").valueOf();
   var Horloge = {
     maintenant: () => heure,
     serveur: () => moment(heure),
     clic: () => moment(heure),
   };
   var monProfil = { pseudo: "Moi", parametre: { vueMembres: { valeur: "2" } } };
   var TOAST_ERROR = {};`,
);

// pseudo, TdC, temps de trajet (s) à ma vitesse d'attaque (null : inconnu)
const MEMBRES: [string, number, number | null][] = [
  ["Moi", 100000, 0],
  ["Alpha", 200000, 3600],
  ["Beta", 150000, null],
  ["Gamma", 50000, 3600],
  ["Delta", 80000, 600],
  ["Epsilon", 60000, 1780],
  ["Eta", 90000, 7200],
];
const PARTAGES = {
  chasses: {
    beta: [{ date: "2026-11-09 10:10", terrain: 2000 }],
    delta: [{ date: "2026-11-09 15:00", terrain: 500 }],
    epsilon: [
      { date: "2026-11-09 10:30", terrain: 1000 },
      { date: "2026-11-09 10:31", terrain: 1000 },
    ],
  },
  floods: [
    {
      date: "2026-11-09 10:30",
      cible: "Alpha",
      unites: 10000,
      terrain: 10000,
      tdcCible: 200000,
      id: 1,
      lanceur: "Moi",
    },
    {
      date: "2026-11-09 12:00",
      cible: "Alpha",
      unites: 5000,
      terrain: 5000,
      tdcCible: 190000,
      id: 2,
      lanceur: "Beta",
    },
    // cible hors alliance, TdC inconnu : prise estimée au lancement
    {
      date: "2026-11-09 11:00",
      cible: "Zeta",
      unites: 3000,
      terrain: 3000,
      tdcCible: null,
      id: 3,
      lanceur: "Eta",
    },
  ],
};
const espaces = (t: string) => t.replace(/[\s  ]+/g, " ").trim();

// colonnes ajoutées lues par les tests, dans l'ordre de la vue
const COLONNES = [
  "membresFloodsDernier",
  "membresFloodsTotal",
  "membresFloodsProchain",
  "membresFloodsVariation",
  "membresFloodsFinal",
  "membresFloodsTrajet",
  "membresFloodsRetour",
];

// tableau du jeu tel que Alliance.js le laisse (sans coordonnées en cache) ;
// le forum répond après que l'horloge a avancé de 5 minutes. « complet » : ses
// colonnes Technologie, Fourmilière, les deux cellules sous l'en-tête fusionné
// « Etat » et la dernière ; « trajet » : avec aussi les colonnes Tdt et Retour
// de la vue « Temps de trajet » (Carte en cache), placées avant « Etat »
async function ouvrir(
  partages: object = PARTAGES,
  avant = "",
  tableau: "court" | "complet" | "trajet" = "court",
) {
  const complet = tableau != "court",
    trajet = tableau == "trajet";
  page.lire(`(() => {
    heure = moment("2026-11-09 10:00:20", "YYYY-MM-DD HH:mm:ss").valueOf();
    ${avant}
    window.matchMedia = () => ({ matches: false });
    $("#o_allInfobulle").remove();
    document.body.innerHTML = "<div id='centre'><table id='tabMembresAlliance'><thead><tr><th></th><th></th><th>Rang</th><th class='o_allPseudo'>Pseudo</th><th class='o_allEpeeG'></th><th class='o_allTerrain'>Terrain</th><th class='o_allEpeeD'></th>" +
      (${complet} ? "<th>Technologie</th><th>Fourmiliere</th>" + (${trajet} ? "<th>Tdt</th><th>Retour</th>" : "") + "<th colspan='2'>Etat</th><th></th>" : "") +
      "</tr></thead><tbody>" +
      ${JSON.stringify(MEMBRES)}.map(([p, t], i) => "<tr><td>" + (i + 1) + "</td><td></td><td>Membre</td><td> " + p + " </td><td></td><td>" + numeral(t).format() + "</td><td></td>" +
        (${complet} ? "<td>50</td><td>90</td>" + (${trajet} ? "<td>1h</td><td>9 nov. à 11h01</td>" : "") + "<td><span id='etat_" + p + "'>état " + p + "</span></td><td>" + (p == "Beta" ? "<img alt='Colonisé'>" : "colonie " + p) + "</td><td></td>" : "") +
        "</tr>").join("") +
      "</tbody></table></div>";
    AllianceFzzz.colonnes();
    // comme Alliance.js : sans calcul des largeurs, qui plante sur l'en-tête fusionné « Etat »
    $("#tabMembresAlliance").DataTable({ dom: "Bfrti", buttons: [], order: [], bPaginate: false, bInfo: false, bAutoWidth: false });
    let reponse;
    PartageChasses.charger = () => new Promise((r) => (reponse = r));
    let trajets = new Map(${JSON.stringify(MEMBRES.map(([p, , s]) => [p, s]))});
    AllianceFzzz.installer(() => Promise.resolve(), ${trajet}, (p) => trajets.get(p));
    heure += 5 * 60000;
    // vue « Floods » décochée : le forum n'est pas lu
    if (reponse) reponse(${JSON.stringify(partages)});
  })()`);
  await new Promise((r) => setTimeout(r, 30));
}

// info-bulle d'un membre : lignes du tableau, ligne surlignée, note
function infobulle(pseudo: string) {
  return page.lire<{
    lignes: string[];
    surlignee: number;
    note: string;
    texte: string;
    entete: string;
  }>(`(() => {
    let api = $("#tabMembresAlliance").DataTable(),
      r = api.rows()[0].find((r) => $(api.cell(r, 3).node()).text().trim() == ${JSON.stringify(pseudo)});
    $(api.row(r).node()).trigger("mouseenter");
    let $i = $("#o_allInfobulle"),
      $tr = $i.find("tr");
    return {
      lignes: $tr.map((i, l) => $(l).children().first().text()).get(),
      surlignee: $tr.index($i.find("tr.o_ligneArrivee")),
      note: $i.find(".o_note").not(":contains('Synchro')").text(),
      texte: $i.text(),
      entete: $i.children().first().text(),
    };
  })()`);
}

describe("page Membres, vue « Floods et chasses en cours »", () => {
  test("en-têtes des colonnes ajoutées, dans l'ordre de la liste du mainteneur", async () => {
    await ouvrir();
    expect(
      page.lire(
        `$($("#tabMembresAlliance").DataTable().columns().header()).slice(-8).map((i, th) => $(th).html().replace(/<br\\s*\\/?>/g, " ")).get()`,
      ),
    ).toEqual([
      "Date dernier mouvement",
      "Variation totale de TdC",
      "Date du prochain mouvement",
      "Prochaine variation de TdC",
      "TdC final",
      "Temps de trajet",
      "Retour",
      "État de la colonie",
    ]);
  });

  test("dernier et prochain mouvement, variations signées, TdC final, temps de trajet, retour", async () => {
    await ouvrir();
    const cellules = page
      .lire<string[][]>(`(() => {
      let api = $("#tabMembresAlliance").DataTable(), COLONNES = ${JSON.stringify(COLONNES)};
      return api.rows()[0].map((r) => [
        $(api.cell(r, 3).node()).text().trim(),
        ...COLONNES.map((c) => $(api.cell(r, AllianceFzzz._colonne(api, c)).node()).text()),
      ]);
    })()`)
      .map((l) => l.map(espaces));
    // retour : ouverture à 10h00:20 + temps de trajet, à la minute du rapport,
    // comme la vue « Temps de trajet » (l'heure de l'ouverture, pas celle de la
    // réponse du forum 5 minutes plus tard)
    expect(cellules).toEqual([
      [
        "Moi",
        "09/11 10:30",
        "+10 000",
        "09/11 10:30",
        "+10 000",
        "110 000",
        "0 sec",
        "9 nov. à 10h01",
      ],
      [
        "Alpha",
        "09/11 12:00",
        "−15 000",
        "09/11 10:30",
        "−10 000",
        "185 000",
        "1h",
        "9 nov. à 11h01",
      ],
      ["Beta", "09/11 12:00", "+7 000", "09/11 10:10", "+2 000", "157 000", "N/C", "N/C"],
      ["Gamma", "—", "—", "—", "—", "50 000", "1h", "9 nov. à 11h01"],
      ["Delta", "09/11 15:00", "+500", "09/11 15:00", "+500", "80 500", "10m", "9 nov. à 10h11"],
      // deux chasses à des minutes différentes : la prochaine est la première seule ;
      // 10h00:20 + 29 min 40 s = 10h30:00 pile : rapport à 10h30
      [
        "Epsilon",
        "09/11 10:31",
        "+2 000",
        "09/11 10:30",
        "+1 000",
        "62 000",
        "29m 40s",
        "9 nov. à 10h30",
      ],
      // prise sur une cible au TdC inconnu : estimée
      ["Eta", "09/11 11:00", "+~3 000", "09/11 11:00", "+~3 000", "93 000", "2h", "9 nov. à 12h01"],
    ]);
    // tri : mouvements à leur date, membre sans mouvement après les autres ;
    // variations à leur valeur ; temps de trajet en secondes et retour à sa
    // date, inconnus après les autres
    const ordres = page.lire<string[][]>(`(() => {
      let api = $("#tabMembresAlliance").DataTable(), COLONNES = ${JSON.stringify(COLONNES)};
      return api.rows()[0].map((r) => COLONNES.filter((c) => c != "membresFloodsFinal").map((c) => $(api.cell(r, AllianceFzzz._colonne(api, c)).node()).attr("data-order")));
    })()`);
    const unix = (d: string) =>
      String(page.lire(`moment(${JSON.stringify(d)}, "YYYY-MM-DD HH:mm").unix()`));
    expect(ordres[1]).toEqual([
      unix("2026-11-09 12:00"),
      "-15000",
      unix("2026-11-09 10:30"),
      "-10000",
      "3600",
      unix("2026-11-09 11:01"),
    ]);
    expect(ordres[2]?.slice(4)).toEqual(["9999999999", "9999999999"]);
    expect(ordres[3]).toEqual([
      "9999999999",
      "0",
      "9999999999",
      "0",
      "3600",
      unix("2026-11-09 11:01"),
    ]);
    expect(Number(ordres[3]?.[0])).toBeGreaterThan(Number(ordres[1]?.[0]));
  });

  test("prochain mouvement : les floods d'une même minute comptés ensemble (multi-flood)", async () => {
    const flood = (date: string, id: number) => ({
      date,
      cible: "Alpha",
      unites: 10000,
      terrain: 10000,
      tdcCible: 200000,
      id,
      lanceur: "Moi",
    });
    await ouvrir({
      chasses: {},
      floods: [
        flood("2026-11-09 10:30", 1),
        flood("2026-11-09 10:30", 2),
        flood("2026-11-09 11:00", 3),
      ],
    });
    const lignes = page
      .lire<string[][]>(`(() => {
      let api = $("#tabMembresAlliance").DataTable(), COLONNES = ${JSON.stringify(COLONNES)};
      return api.rows()[0].slice(0, 2).map((r) => COLONNES.slice(0, 4).map((c) => $(api.cell(r, AllianceFzzz._colonne(api, c)).node()).text()));
    })()`)
      .map((l) => l.map(espaces));
    expect(lignes).toEqual([
      ["09/11 11:00", "+30 000", "09/11 10:30", "+20 000"],
      ["09/11 11:00", "−30 000", "09/11 10:30", "−20 000"],
    ]);
  });

  test("info-bulle : TdC à l'arrivée d'une attaque lancée à l'ouverture surligné", async () => {
    await ouvrir();
    // 1 h de trajet : RC à 11h01, après le flood de 10h30, avant celui de 12h00
    const alpha = infobulle("Alpha");
    expect(alpha.lignes).toEqual(["", "Actuellement", "09/11 10h30", "09/11 12h00"]);
    expect(alpha.surlignee).toBe(2);
    expect(espaces(alpha.note)).toBe(
      "Surligné : TdC à l'arrivée d'une attaque lancée à l'ouverture de la page (09/11 11h01).",
    );
    // 10 min : avant tout mouvement, la ligne « Actuellement »
    expect(infobulle("Delta").surlignee).toBe(1);
    // ouverture 10h00:20 + 29 min 40 s = 10h30:00 pile : RC à 10h30, la chasse de
    // 10h30 comptée, pas celle de 10h31 ; l'heure est celle de l'ouverture, pas
    // celle de la réponse du forum (5 min plus tard)
    const epsilon = infobulle("Epsilon");
    expect(epsilon.surlignee).toBe(2);
    expect(espaces(epsilon.note)).toContain("(09/11 10h30)");
    expect(infobulle("Eta").surlignee).toBe(2);
  });

  test("info-bulle : « à portée » après le pseudo, d'après son TdC et le mien", async () => {
    await ouvrir();
    // moi : 100 000, puis 110 000 après mon flood de 10h30 (portée dès 55 000)
    expect(espaces(infobulle("Gamma").entete)).toBe("Gamma déjà à portée jusqu'au 09/11 à 10h30");
    expect(espaces(infobulle("Alpha").entete)).toBe("Alpha déjà à portée");
    expect(espaces(infobulle("Moi").entete)).toBe("Moi");
    expect(
      page.lire(`(() => {
        let api = $("#tabMembresAlliance").DataTable(),
          r = api.rows()[0].find((r) => $(api.cell(r, 3).node()).text().trim() == "Gamma");
        $(api.row(r).node()).trigger("mouseenter");
        return $("#o_allInfobulle > div").first().find(".o_porteeHeure").text();
      })()`),
    ).toBe("09/11 à 10h30");
  });

  test("info-bulle : colonne « Synchro » sur les lignes de chasse", async () => {
    await ouvrir();
    const synchro = (p: string) =>
      page.lire<string[] | null>(`(() => {
        let api = $("#tabMembresAlliance").DataTable(),
          r = api.rows()[0].find((r) => $(api.cell(r, 3).node()).text().trim() == ${JSON.stringify(p)});
        $(api.row(r).node()).trigger("mouseenter");
        let $tr = $("#o_allInfobulle tr");
        return $tr.first().children().last().text() == "Synchro" ? $tr.map((i, l) => $(l).children().last().text()).get() : null;
      })()`);
    // 10 min de trajet : chasse de 15h00 (minute du RC), lancer à 14h50:00
    expect(synchro("Delta")).toEqual(["Synchro", "", "14h50m00s"]);
    // 29 min 40 s : chasses de 10h30 et 10h31, page ouverte à 10h00:20
    expect(synchro("Epsilon")).toEqual(["Synchro", "", "10h00m20s", "10h01m20s"]);
    // trajet inconnu : « ? » sur la chasse, rien sur son flood
    expect(synchro("Beta")).toEqual(["Synchro", "", "?", ""]);
    expect(espaces(infobulle("Beta").texte)).toContain(
      "Synchro : lancer à cette seconde pour arriver au début de la minute du retour de chasse, donc après la chasse (temps de trajet inconnu : ?).",
    );
    // pas de chasse, ou ma propre ligne : pas de colonne
    expect(synchro("Alpha")).toBeNull();
    expect(synchro("Moi")).toBeNull();
  });

  test("info-bulle : rien de surligné pour soi, ni sans temps de trajet", async () => {
    await ouvrir();
    const moi = infobulle("Moi");
    expect(moi.lignes.length).toBe(3);
    expect([moi.surlignee, moi.note]).toEqual([-1, ""]);
    const beta = infobulle("Beta");
    expect(beta.surlignee).toBe(-1);
    expect(espaces(beta.note)).toBe(
      "TdC à l'arrivée d'une attaque : temps de trajet inconnu (vue « Temps de trajet »).",
    );
    const gamma = infobulle("Gamma");
    expect(gamma.surlignee).toBe(-1);
    expect(gamma.texte).toContain("Aucune variation partagée en cours.");
    expect(gamma.note).toBe("");
  });
});

describe("page Membres, prochain mouvement et temps de trajet", () => {
  const colonnes = (pseudos: string[]) =>
    page
      .lire<string[][]>(`(() => {
      let api = $("#tabMembresAlliance").DataTable(), COLONNES = ${JSON.stringify(COLONNES)};
      return api.rows()[0]
        .filter((r) => ${JSON.stringify(pseudos)}.includes($(api.cell(r, 3).node()).text().trim()))
        .map((r) => [$(api.cell(r, 3).node()).text().trim(), ...COLONNES.filter((c) => c != "membresFloodsFinal").map((c) => $(api.cell(r, AllianceFzzz._colonne(api, c)).node()).text())]);
    })()`)
      .map((l) => l.map(espaces));

  test("une minute où le TdC ne change pas (prises hors portée) est sautée", async () => {
    const flood = (date: string, lanceur: string, id: number) => ({
      date,
      cible: "Gamma",
      unites: 5000,
      terrain: 5000,
      tdcCible: 50000,
      id,
      lanceur,
    });
    // Alpha (200 000) est trop gros pour Gamma (50 000) : prise nulle à 10h20
    await ouvrir({
      chasses: {},
      floods: [flood("2026-11-09 10:20", "Alpha", 1), flood("2026-11-09 10:40", "Moi", 2)],
    });
    expect(colonnes(["Alpha", "Gamma"])).toEqual([
      ["Alpha", "09/11 10:20", "0", "—", "—", "1h", "9 nov. à 11h01"],
      ["Gamma", "09/11 10:40", "−5 000", "09/11 10:40", "−5 000", "1h", "9 nov. à 11h01"],
    ]);
  });

  test("temps de trajet sans la Carte : coordonnées de l'export des joueurs gardé, à ma Vitesse d'attaque", async () => {
    await ouvrir(
      PARTAGES,
      `monProfil.niveauRecherche = [0, 0, 0, 0, 0, 0, 5];
       monProfil.getTempsParcours2 = (j) => j.x * 1000 + j.y;
       localStorage.setItem(ExportJoueurs.cle, JSON.stringify({ t: 0, joueurs: { beta: [4, 242, 1000] } }));`,
    );
    page.lire(
      `delete monProfil.niveauRecherche; delete monProfil.getTempsParcours2; localStorage.removeItem(ExportJoueurs.cle)`,
    );
    // pseudo de l'export sans les majuscules du tableau : trouvé quand même ;
    // retour : 10h00:20 + 1 h 10 min 42 s = 11h11:02, rapport à 11h12
    expect(colonnes(["Beta"])[0]?.slice(5)).toEqual(["1h 10m 42s", "9 nov. à 11h12"]);
    // l'info-bulle sait alors où tombe une attaque lancée à l'ouverture
    expect(infobulle("Beta").note).not.toContain("temps de trajet inconnu");
  });

  test.each(["membresFloodsTrajet", "membresFloodsRetour"])(
    "sans coordonnées gardées, %s coché : l'export public est lu une fois, au premier choix de la vue",
    async (cle) => {
      page.lire(`localStorage.setItem("fzzz_affichage_${cle}", "1"); window.LECTURES = 0;`);
      await ouvrir(
        PARTAGES,
        `monProfil.niveauRecherche = [0, 0, 0, 0, 0, 0, 5];
         monProfil.getTempsParcours2 = (j) => j.x * 1000 + j.y;
         ExportJoueurs.base = () => {
           LECTURES++;
           localStorage.setItem(ExportJoueurs.cle, JSON.stringify({ t: Date.now(), joueurs: { Beta: [4, 242, 1000] } }));
           return Promise.resolve({ Beta: [4, 242, 1000] });
         };`,
      );
      page.lire(
        `delete monProfil.niveauRecherche; delete monProfil.getTempsParcours2; localStorage.removeItem(ExportJoueurs.cle); localStorage.removeItem("fzzz_affichage_${cle}");`,
      );
      expect(page.lire(`LECTURES`)).toBe(1);
      expect(colonnes(["Beta"])[0]?.slice(5)).toEqual(["1h 10m 42s", "9 nov. à 11h12"]);
    },
  );

  test("ni temps de trajet ni retour cochés : l'export public n'est pas lu", async () => {
    page.lire(`window.LECTURES = 0;`);
    await ouvrir(
      PARTAGES,
      `monProfil.niveauRecherche = [0, 0, 0, 0, 0, 0, 5];
       monProfil.getTempsParcours2 = (j) => j.x * 1000 + j.y;
       ExportJoueurs.base = () => (LECTURES++, Promise.resolve({}));`,
    );
    page.lire(`delete monProfil.niveauRecherche; delete monProfil.getTempsParcours2;`);
    expect(page.lire(`LECTURES`)).toBe(0);
  });

  test("sans coordonnées gardées : la vue quittée puis reprise ne relit pas l'export", async () => {
    page.lire(
      `localStorage.setItem("fzzz_affichage_membresFloodsTrajet", "1"); window.LECTURES = 0;`,
    );
    await ouvrir(
      PARTAGES,
      `monProfil.niveauRecherche = [0, 0, 0, 0, 0, 0, 5];
       monProfil.getTempsParcours2 = (j) => j.x * 1000 + j.y;
       ExportJoueurs.base = () => {
         LECTURES++;
         localStorage.setItem(ExportJoueurs.cle, JSON.stringify({ t: Date.now(), joueurs: { Beta: [4, 242, 1000] } }));
         return Promise.resolve({ Beta: [4, 242, 1000] });
       };`,
    );
    expect(page.lire(`LECTURES`)).toBe(1);
    // vue quittée puis reprise : pas de nouvelle lecture
    page.lire(
      `$(".o_allVue[data-vue='reset']").trigger("click"); $(".o_allVue[data-vue='floods']").trigger("click");`,
    );
    expect(page.lire(`LECTURES`)).toBe(1);
    page.lire(
      `delete monProfil.niveauRecherche; delete monProfil.getTempsParcours2; localStorage.removeItem(ExportJoueurs.cle); localStorage.removeItem("fzzz_affichage_membresFloodsTrajet");`,
    );
  });
});

describe("page Membres, colonnes de la vue « Floods » choisies dans les Préférences", () => {
  // titres des colonnes visibles dans la vue courante
  const visibles = () =>
    page.lire<string[]>(`(() => {
      let api = $("#tabMembresAlliance").DataTable();
      return api.columns().indexes().toArray().filter((i) => api.column(i).visible())
        .map((i) => $(api.column(i).header()).html().replace(/<br\\s*\\/?>/g, " ").trim());
    })()`);
  const avec = async (cases: Record<string, boolean>) => {
    page.lire(
      `Object.entries(${JSON.stringify(cases)}).forEach(([c, v]) => localStorage.setItem("fzzz_affichage_" + c, v ? "1" : "0"))`,
    );
    await ouvrir();
    page.lire(
      `Object.keys(${JSON.stringify(cases)}).forEach((c) => localStorage.removeItem("fzzz_affichage_" + c))`,
    );
    return visibles();
  };

  test("par défaut : pseudo, TdC actuel (avec ses épées), dernier mouvement, variation totale, TdC final", async () => {
    expect(await avec({})).toEqual([
      "Pseudo",
      "",
      "Terrain",
      "",
      "Date dernier mouvement",
      "Variation totale de TdC",
      "TdC final",
    ]);
  });

  test("cases changées : rang, prochain mouvement et sa variation, temps de trajet ; sans pseudo ni variation totale", async () => {
    expect(
      await avec({
        membresFloodsRang: true,
        membresFloodsPseudo: false,
        membresFloodsTotal: false,
        membresFloodsProchain: true,
        membresFloodsVariation: true,
        membresFloodsTrajet: true,
      }),
    ).toEqual([
      "Rang",
      "",
      "Terrain",
      "",
      "Date dernier mouvement",
      "Date du prochain mouvement",
      "Prochaine variation de TdC",
      "TdC final",
      "Temps de trajet",
    ]);
    // les autres vues ne montrent jamais les colonnes ajoutées
    page.lire(`$(".o_allVue[data-vue='reset']").trigger("click")`);
    expect(visibles().filter((t) => /mouvement|TdC final|Temps de trajet/.test(t))).toEqual([]);
  });

  // en-têtes et cellules d'Alpha dans la page : DataTables retire du DOM ceux
  // des colonnes masquées ; « Etat » est un en-tête fusionné sur deux cellules
  const affiche = () =>
    page.lire<{ entetes: string[]; alpha: string[] }>(`(() => ({
      entetes: $("#tabMembresAlliance thead th").map((i, th) =>
        $(th).html().replace(/<br\\s*\\/?>/g, " ").trim() + (th.colSpan > 1 ? " ×" + th.colSpan : "")).get(),
      alpha: $("#tabMembresAlliance tbody tr").filter((i, tr) => $(tr).text().includes("Alpha"))
        .children("td").map((i, td) => $(td).text().trim()).get(),
    }))()`);
  const cocher = (cases: Record<string, boolean>) =>
    page.lire(
      `Object.entries(${JSON.stringify(cases)}).forEach(([c, v]) => localStorage.setItem("fzzz_affichage_" + c, v ? "1" : "0"))`,
    );
  const decocher = (cases: Record<string, boolean>) =>
    page.lire(
      `Object.keys(${JSON.stringify(cases)}).forEach((c) => localStorage.removeItem("fzzz_affichage_" + c))`,
    );

  test("état de la colonie : copie des deux cellules « Etat » du jeu en dernière colonne, décochée par défaut", async () => {
    await ouvrir(PARTAGES, "", "complet");
    expect(affiche().entetes).toEqual([
      "Pseudo",
      "",
      "Terrain",
      "",
      "Date dernier mouvement",
      "Variation totale de TdC",
      "TdC final",
    ]);
    const cases = { membresFloodsEtat: true };
    cocher(cases);
    await ouvrir(PARTAGES, "", "complet");
    decocher(cases);
    expect(affiche()).toEqual({
      entetes: [
        "Pseudo",
        "",
        "Terrain",
        "",
        "Date dernier mouvement",
        "Variation totale de TdC",
        "TdC final",
        "État de la colonie",
      ],
      alpha: [
        "Alpha",
        "",
        "200 000",
        "",
        "09/11 12:00",
        "−15 000",
        "185 000",
        "état Alpha colonie Alpha",
      ],
    });
    // la copie garde les images, perd les id (uniques dans la page) ; tri sur le
    // texte et celui des images ; la cellule du jeu ne change pas
    expect(
      page.lire(`(() => {
        let api = $("#tabMembresAlliance").DataTable(),
          c = AllianceFzzz._colonne(api, "membresFloodsEtat"),
          jeu = api.settings()[0].aoHeader[0].findIndex((h) => $(h.cell).text().trim() == "Etat"),
          beta = api.rows()[0].find((r) => $(api.cell(r, 3).node()).text().trim() == "Beta"),
          $copie = $(api.cell(beta, c).node());
        return {
          idJeu: $(api.cell(beta, jeu).node()).find("[id='etat_Beta']").length,
          idCopie: $copie.find("[id]").length,
          image: $copie.find("img").attr("alt"),
          ordre: $copie.attr("data-order"),
        };
      })()`),
    ).toEqual({ idJeu: 1, idCopie: 0, image: "Colonisé", ordre: "état Beta Colonisé" });
    // la vue « Standard » reste celle du jeu, « Etat » compris, sans la copie
    page.lire(`$(".o_allVue[data-vue='reset']").trigger("click")`);
    expect(affiche().entetes).toContain("Etat ×2");
    expect(affiche().entetes).not.toContain("État de la colonie");
  });

  test("état et retour cochés avec les colonnes Tdt / Retour de la vue « Temps de trajet »", async () => {
    const cases = { membresFloodsEtat: true, membresFloodsRetour: true };
    cocher(cases);
    await ouvrir(PARTAGES, "", "trajet");
    decocher(cases);
    // les cellules « Etat » sont après Tdt et Retour : trouvées quand même ;
    // le retour de la vue est la colonne de l'extension, l'état tout au bout
    expect(affiche()).toEqual({
      entetes: [
        "Pseudo",
        "",
        "Terrain",
        "",
        "Date dernier mouvement",
        "Variation totale de TdC",
        "TdC final",
        "Retour",
        "État de la colonie",
      ],
      alpha: [
        "Alpha",
        "",
        "200 000",
        "",
        "09/11 12:00",
        "−15 000",
        "185 000",
        "9 nov. à 11h01",
        "état Alpha colonie Alpha",
      ],
    });
    // vue « Temps de trajet » : ses colonnes Tdt et Retour et l'« Etat » du jeu,
    // sans celles de l'extension
    page.lire(`$(".o_allVue[data-vue='trajet']").trigger("click")`);
    const trajet = affiche().entetes;
    expect(trajet.filter((t) => t == "Retour").length).toBe(1);
    expect(trajet).toContain("Tdt");
    expect(trajet).toContain("Etat ×2");
    expect(trajet).not.toContain("TdC final");
    expect(trajet).not.toContain("État de la colonie");
  });

  test("aucune case cochée : le pseudo seul", async () => {
    expect(
      await avec(
        Object.fromEntries(page.lire<string[]>(`MEMBRES_COLONNES_FLOODS`).map((c) => [c, false])),
      ),
    ).toEqual(["Pseudo"]);
  });
});

describe("page Membres, vue « Floods et chasses en cours » décochée", () => {
  test("ni colonnes ni bouton, la vue par défaut « Floods » devient « Standard », aucun partage lu", async () => {
    page.lire(`localStorage.setItem("fzzz_affichage_membresFloods", "0")`);
    await ouvrir();
    page.lire(`localStorage.removeItem("fzzz_affichage_membresFloods")`);
    expect(
      page.lire(`$("#tabMembresAlliance th.o_allCol0, #tabMembresAlliance td.o_allCol0").length`),
    ).toBe(0);
    expect(page.lire(`$(".o_allVue").map((i, a) => a.dataset.vue).get()`)).toEqual([
      "reset",
      "trajet",
    ]);
    expect(page.lire(`$(".o_allVueActive").data("vue")`)).toBe("reset");
    expect(page.lire(`$("#o_allInfobulle").length`)).toBe(0);
  });
});
