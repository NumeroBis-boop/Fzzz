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
    "js/class/Utils.js",
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

// tableau du jeu tel que Alliance.js le laisse (sans coordonnées en cache) ;
// le forum répond après que l'horloge a avancé de 5 minutes
async function ouvrir() {
  page.lire(`(() => {
    heure = moment("2026-11-09 10:00:20", "YYYY-MM-DD HH:mm:ss").valueOf();
    window.matchMedia = () => ({ matches: false });
    $("#o_allInfobulle").remove();
    document.body.innerHTML = "<div id='centre'><table id='tabMembresAlliance'><thead><tr><th></th><th></th><th>Rang</th><th class='o_allPseudo'>Pseudo</th><th class='o_allEpeeG'></th><th class='o_allTerrain'>Terrain</th><th class='o_allEpeeD'></th></tr></thead><tbody>" +
      ${JSON.stringify(MEMBRES)}.map(([p, t], i) => "<tr><td>" + (i + 1) + "</td><td></td><td>Membre</td><td> " + p + " </td><td></td><td>" + numeral(t).format() + "</td><td></td></tr>").join("") +
      "</tbody></table></div>";
    AllianceFzzz.colonnes();
    $("#tabMembresAlliance").DataTable({ dom: "Bfrti", buttons: [], order: [], bPaginate: false, bInfo: false });
    let reponse;
    PartageChasses.charger = () => new Promise((r) => (reponse = r));
    let trajets = new Map(${JSON.stringify(MEMBRES.map(([p, , s]) => [p, s]))});
    AllianceFzzz.installer(() => Promise.resolve(), false, (p) => trajets.get(p));
    heure += 5 * 60000;
    // vue « Floods » décochée : le forum n'est pas lu
    if (reponse) reponse(${JSON.stringify(PARTAGES)});
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
      note: $i.find(".o_note").text(),
      texte: $i.text(),
      entete: $i.children().first().text(),
    };
  })()`);
}

describe("page Membres, vue « Floods et chasses en cours »", () => {
  test("en-têtes : Date dernier mouvement, Variation totale de TdC, TdC final", async () => {
    await ouvrir();
    expect(
      page.lire(
        `$("#tabMembresAlliance thead th").slice(-3).map((i, th) => $(th).html().replace(/<br\\s*\\/?>/g, " ")).get()`,
      ),
    ).toEqual(["Date dernier mouvement", "Variation totale de TdC", "TdC final"]);
  });

  test("date du dernier mouvement, variation totale signée, TdC final", async () => {
    await ouvrir();
    const cellules = page
      .lire<string[][]>(`(() => {
      let api = $("#tabMembresAlliance").DataTable(), n = api.settings()[0].aoColumns.length;
      return api.rows()[0].map((r) => [
        $(api.cell(r, 3).node()).text().trim(),
        ...[n - 3, n - 2, n - 1].map((c) => $(api.cell(r, c).node()).text()),
      ]);
    })()`)
      .map((l) => l.map(espaces));
    expect(cellules).toEqual([
      ["Moi", "09/11 10:30", "+10 000", "110 000"],
      ["Alpha", "09/11 12:00", "−15 000", "185 000"],
      ["Beta", "09/11 12:00", "+7 000", "157 000"],
      ["Gamma", "—", "—", "50 000"],
      ["Delta", "09/11 15:00", "+500", "80 500"],
      ["Epsilon", "09/11 10:31", "+2 000", "62 000"],
      // prise sur une cible au TdC inconnu : estimée
      ["Eta", "09/11 11:00", "+~3 000", "93 000"],
    ]);
    // tri : dernier mouvement à sa date, membre sans mouvement après les autres ;
    // variation totale à sa valeur
    const ordres = page.lire<string[][]>(`(() => {
      let api = $("#tabMembresAlliance").DataTable(), n = api.settings()[0].aoColumns.length;
      return api.rows()[0].map((r) => [n - 3, n - 2].map((c) => $(api.cell(r, c).node()).attr("data-order")));
    })()`);
    expect(ordres[1]).toEqual([
      String(page.lire(`moment("2026-11-09 12:00", "YYYY-MM-DD HH:mm").unix()`)),
      "-15000",
    ]);
    expect(ordres[3]).toEqual(["9999999999", "0"]);
    expect(Number(ordres[3]?.[0])).toBeGreaterThan(Number(ordres[1]?.[0]));
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
