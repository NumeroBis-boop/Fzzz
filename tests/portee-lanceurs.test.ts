import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { creerPage } from "./harnais";

/**
 * Floods d'un autre membre sur un joueur suivi : à l'impact, la portée dépend
 * du TdC de ce lanceur (page Membres du jeu) et de ses chasses. L'Armée et la
 * page d'un membre (comme le lanceur de Flood) le lisent maintenant, comme la
 * page Membres : avant, ce flood comptait 20 % même hors portée.
 * Cas signalé (10/11/2026), joueurs inventés : moi à 130 008, ma chasse de
 * +40 433 à 23h00, trois floods de Lanceur (232 643) sur moi à 23h26 de 39 002,
 * 31 202 et 24 961 unités. Après les deux premiers (−34 088, −27 270), je suis à
 * 109 083 et Lanceur à 294 001 : sous la moitié de son TdC, le troisième ne
 * prend rien. Compté à 20 % (−21 816), il donnait 87 267.
 */
const page = creerPage(
  ["js/class/Utils.js", "js/page/PartageChasses.js"],
  `
  var heure = moment("2026-11-10 22:08:27", "YYYY-MM-DD HH:mm:ss").valueOf();
  var Horloge = { maintenant: () => heure, serveur: () => moment(heure), clic: () => moment(heure) };
  var monProfil = { pseudo: "Moi" };
  var AttaqueLancee = { idsAffiches: () => [], majPartages: () => {} };
`,
);

const ligne = (pseudo: string, terrain: string) =>
  `<tr><td><img alt="Actif"></td><td>1</td><td>Membre</td><td><a href="Membre.php?Pseudo=${pseudo}">${pseudo}</a></td><td></td><td>${terrain}</td><td></td><td>50</td><td>90</td><td>ok</td><td></td><td></td></tr>`;
// page Membres du jeu : pseudo en 4e colonne, terrain en 6e
const MEMBRES = `<html><body><div id="alliance"><table id="tabMembresAlliance"><tr><th></th><th></th><th>Rang</th><th>Pseudo</th><th></th><th>Terrain</th><th></th><th>Technologie</th><th>Fourmilière</th><th>Etat</th><th></th><th></th></tr>${ligne("Moi", "130 008")}${ligne("Lanceur", "232 643")}${ligne("Autre", "50 000")}</table></div></body></html>`;
// page de l'alliance au classement : pseudo en 3e colonne, terrain en 5e
const ligneClassement = (pseudo: string, terrain: string) =>
  `<tr><td>1</td><td>Membre</td><td><a href="Membre.php?Pseudo=${pseudo}">${pseudo}</a></td><td></td><td>${terrain}</td><td></td><td>50</td><td>90</td></tr>`;
const CLASSEMENT = `<html><body><div id="centre"><table id="tabMembresAlliance"><tr><th></th><th>Rang</th><th>Pseudo</th><th></th><th>Terrain</th><th></th><th>Technologie</th><th>Fourmilière</th></tr>${ligneClassement("Moi", "130 008")}${ligneClassement("Lanceur", "232 643")}</table></div></body></html>`;
// le jeu remplit peut-être le tableau de la page Membres après coup
const MEMBRES_SANS_TABLEAU = `<html><body><div id="alliance"></div></body></html>`;
const ILLISIBLE = "<html><body>Connexion</body></html>";

const flood = (unites: number, id: number, cible = "Moi") => ({
  date: "2026-11-10 23:26",
  cible,
  unites,
  terrain: unites,
  tdcCible: 130008,
  id,
  lanceur: "Lanceur",
});
const FORUM = {
  chasses: { moi: [{ date: "2026-11-10 23:00", terrain: 40433 }] } as Record<string, object[]>,
  floods: [flood(39002, 101), flood(31202, 102), flood(24961, 103)],
};
const espaces = (t: string) => t.replace(/[\s  ]+/g, " ").trim();

// forum simulé : charger() rend les chasses demandées, et les floods sauf avecFloods = false
function preparer(forum: object, membres: string, classement = ILLISIBLE) {
  page.lire(`(() => {
    localStorage.clear();
    window.FORUM = ${JSON.stringify(forum)};
    window.lus = [];
    window.pagesMembres = 0;
    window.pagesClassement = 0;
    PartageChasses.charger = (de = null, avecFloods = true) => {
      lus.push([de, avecFloods]);
      let voulus = de && de.map((p) => p.toLowerCase()), chasses = {};
      for (let p in FORUM.chasses) if (!voulus || voulus.includes(p)) chasses[p] = FORUM.chasses[p];
      return Promise.resolve({ chasses, floods: avecFloods ? FORUM.floods : [] });
    };
    PartageChasses.recalerFloods = () => {};
    $.get = (url) => {
      if (String(url).endsWith("/alliance.php?Membres")) {
        pagesMembres++;
        return Promise.resolve(${JSON.stringify(membres)});
      }
      if (String(url).includes("/classementAlliance.php")) {
        pagesClassement++;
        if (String(url).endsWith("?alliance=OUAF")) return Promise.resolve(${JSON.stringify(classement)});
      }
      return Promise.reject({ status: 404 });
    };
  })()`);
}
const attendre = () => new Promise((r) => setTimeout(r, 20));

async function armee(forum: object = FORUM, membres = MEMBRES, classement = ILLISIBLE) {
  preparer(forum, membres, classement);
  page.lire(`(() => {
    document.body.innerHTML = "<span id='tag_alliance'>OUAF</span><span id='quantite_tdc'>130008</span><div id='centre'><table><tr><td><h3>Troupes en Garnison (3 792)</h3></td></tr></table></div>";
    PartageChasses.afficherArmee();
  })()`);
  await attendre();
  return page
    .lire<string[]>(
      `$("#o_floodsRecus tbody tr").map((i, tr) => $(tr).children().eq(3).text()).get()`,
    )
    .map(espaces);
}

describe("Armée : floods d'un autre membre sur moi", () => {
  test("le 3e flood de Lanceur est hors portée à l'impact : il ne prend rien", async () => {
    expect(await armee()).toEqual([
      "−34 088 cm² (20 %)",
      "−27 270 cm² (20 %)",
      "0 cm² (hors portée)",
      "−61 358 cm²",
    ]);
    // ma chasse lue avec les floods, puis les chasses de Lanceur seules
    expect(page.lire(`lus`)).toEqual([
      [["Moi"], true],
      [["lanceur"], false],
    ]);
    expect(page.lire(`pagesMembres`)).toBe(1);
  });

  test("les chasses de Lanceur comptent : +10 000 à 23h10, le 2e flood sort aussi de portée", async () => {
    const forum = {
      ...FORUM,
      chasses: { ...FORUM.chasses, lanceur: [{ date: "2026-11-10 23:10", terrain: 10000 }] },
    };
    // 242 643 à 23h26 : −34 088 (moi 136 353, lui 276 731), puis moi sous 138 365,5
    expect(await armee(forum)).toEqual([
      "−34 088 cm² (20 %)",
      "0 cm² (hors portée)",
      "0 cm² (hors portée)",
      "−34 088 cm²",
    ]);
  });

  test("page Membres sans tableau : TdC lus sur la page de l'alliance au classement", async () => {
    expect(await armee(FORUM, MEMBRES_SANS_TABLEAU, CLASSEMENT)).toEqual([
      "−34 088 cm² (20 %)",
      "−27 270 cm² (20 %)",
      "0 cm² (hors portée)",
      "−61 358 cm²",
    ]);
    expect(page.lire(`[pagesMembres, pagesClassement]`)).toEqual([1, 1]);
  });

  test("aucune des deux pages lisible : TdC de Lanceur inconnu, chaque flood compte comme avant", async () => {
    expect(await armee(FORUM, ILLISIBLE, ILLISIBLE)).toEqual([
      "−34 088 cm² (20 %)",
      "−27 270 cm² (20 %)",
      "−21 816 cm² (20 %)",
      "−83 174 cm²",
    ]);
  });

  test("aucun flood d'un autre joueur : ni page Membres ni autres chasses lues", async () => {
    expect(await armee({ ...FORUM, floods: [] })).toEqual([]);
    expect(page.lire(`lus`)).toEqual([[["Moi"], true]]);
    expect(page.lire(`[pagesMembres, pagesClassement]`)).toEqual([0, 0]);
  });
});

describe("page d'un membre : floods d'un autre membre sur lui", () => {
  test("même calcul que l'Armée et la page Membres", async () => {
    // Victime (130 008) suivie depuis le profil ; moi : 150 000
    const forum = {
      chasses: { victime: [{ date: "2026-11-10 23:00", terrain: 40433 }] },
      floods: [
        flood(39002, 101, "Victime"),
        flood(31202, 102, "Victime"),
        flood(24961, 103, "Victime"),
      ],
    };
    preparer(forum, MEMBRES.replace(ligne("Moi", "130 008"), ligne("Victime", "130 008")));
    page.lire(`(() => {
      document.body.innerHTML = "<span id='tag_alliance'>OUAF</span><span id='quantite_tdc'>150000</span><div class='boite_membre'>Action</div>";
      PartageChasses.afficherProfil("Victime", 130008, null);
    })()`);
    await attendre();
    const lignes = page
      .lire<string[]>(
        `$("#o_chassesPartagees .o_partageSynthese table tr").map((i, l) => $(l).children().slice(0, 3).map((k, c) => $(c).text()).get().join(" | ")).get()`,
      )
      .map(espaces);
    expect(lignes.slice(1)).toEqual([
      "Actuellement | 130 008 cm² |",
      "10/11 23h00 | 170 441 cm² | +40 433",
      "10/11 23h26 | 136 353 cm² | −34 088 (20 %)",
      "10/11 23h26 | 109 083 cm² | −27 270 (20 %)",
      "10/11 23h26 | 109 083 cm² | 0 (hors portée)",
    ]);
  });
});

describe("TdC des membres et joueurs reliés", () => {
  test("relies : de proche en proche, sans les joueurs suivis ni les autres", () => {
    const relies = page.lire<string[]>(
      `PartageChasses.relies([
        { lanceur: "B", cible: "a" },
        { lanceur: "A", cible: "Moi" },
        { lanceur: "C", cible: "D" },
        { lanceur: "moi", cible: "E" },
        { lanceur: "D", cible: "F" },
      ], ["Moi"])`,
    );
    expect([...relies].sort()).toEqual(["a", "b", "e"]);
  });

  test("lireTdcMembres : pseudo et terrain du tableau du jeu", () => {
    expect(
      page.lire(`PartageChasses.lireTdcMembres(Utils.parseHtml(${JSON.stringify(MEMBRES)}), 3, 5)`),
    ).toEqual({ Moi: 130008, Lanceur: 232643, Autre: 50000 });
    expect(
      page.lire(
        `PartageChasses.lireTdcMembres(Utils.parseHtml(${JSON.stringify(CLASSEMENT)}), 2, 4)`,
      ),
    ).toEqual({ Moi: 130008, Lanceur: 232643 });
  });

  test("tdcMembres : page Membres, gardée une minute", async () => {
    preparer(FORUM, MEMBRES, CLASSEMENT);
    page.lire(`document.body.innerHTML = "<span id='tag_alliance'>OUAF</span>"`);
    expect(await page.lire(`PartageChasses.tdcMembres()`)).toEqual({
      Moi: 130008,
      Lanceur: 232643,
      Autre: 50000,
    });
    await page.lire(`PartageChasses.tdcMembres()`);
    expect(page.lire(`[pagesMembres, pagesClassement]`)).toEqual([1, 0]);
  });

  test("tdcMembres : sans tableau ou refusée, la page au classement ; illisibles : {} et rien de gardé", async () => {
    page.lire(`document.body.innerHTML = "<span id='tag_alliance'>OUAF</span>"`);
    preparer(FORUM, MEMBRES_SANS_TABLEAU, CLASSEMENT);
    expect(await page.lire(`PartageChasses.tdcMembres()`)).toEqual({
      Moi: 130008,
      Lanceur: 232643,
    });
    await page.lire(`PartageChasses.tdcMembres()`);
    expect(page.lire(`[pagesMembres, pagesClassement]`)).toEqual([1, 1]);
    // page Membres refusée par le jeu
    preparer(FORUM, MEMBRES, CLASSEMENT);
    page.lire(
      `let get = $.get; $.get = (url) => String(url).endsWith("?Membres") ? (pagesMembres++, Promise.reject({ status: 503 })) : get(url)`,
    );
    expect(await page.lire(`PartageChasses.tdcMembres()`)).toMatchObject({ Lanceur: 232643 });
    expect(page.lire(`[pagesMembres, pagesClassement]`)).toEqual([1, 1]);
    // aucune lisible : rien de gardé, la lecture suivante recommence
    preparer(FORUM, ILLISIBLE, ILLISIBLE);
    expect(await page.lire(`PartageChasses.tdcMembres()`)).toEqual({});
    await page.lire(`PartageChasses.tdcMembres()`);
    expect(page.lire(`[pagesMembres, pagesClassement]`)).toEqual([2, 2]);
    // sans alliance : pas de page au classement
    page.lire(`document.body.innerHTML = ""`);
    preparer(FORUM, ILLISIBLE, CLASSEMENT);
    expect(await page.lire(`PartageChasses.tdcMembres()`)).toEqual({});
    expect(page.lire(`[pagesMembres, pagesClassement]`)).toEqual([1, 0]);
  });

  test("tdcConnus : les TdC de la page ouverte remplacent ceux des membres, sauf absents", () => {
    expect(
      page.lire(
        `PartageChasses.tdcConnus({ Moi: 1, Lanceur: 2 }, { Moi: 5, Cible: 0, Autre: undefined, Lanceur: NaN })`,
      ),
    ).toEqual({ Moi: 5, Lanceur: 2 });
  });
});

describe("chaque simulation hors page Membres reçoit les TdC des membres", () => {
  test("PartageChasses.simuler(…) avec PartageChasses.tdcConnus(…)", () => {
    const racine = join(import.meta.dir, "..", "public", "js"),
      fichiers = readdirSync(racine, { recursive: true })
        .map(String)
        .filter((f) => f.endsWith(".js") && !f.startsWith("lib"));
    let appels = 0;
    for (const f of fichiers) {
      const texte = readFileSync(join(racine, f), "utf8");
      // la page Membres a déjà le TdC de chaque membre et lit toutes les chasses
      if (f.endsWith("AllianceFzzz.js")) continue;
      for (const m of texte.matchAll(/PartageChasses\.simuler\((?!\))/g)) {
        appels++;
        expect(`${f} : ${texte.slice(m.index, m.index + 160)}`).toMatch(
          /PartageChasses\.tdcConnus\(/,
        );
      }
    }
    expect(appels).toBe(3);
  });
});
