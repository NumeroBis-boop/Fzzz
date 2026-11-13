import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Page d'un membre, bloc des chasses et floods partagés : seul le tableau
 * « Évolution du TdC de … » (la synthèse, règle du mainteneur), où la ligne du
 * TdC qu'une attaque lancée à l'ouverture de la page trouverait est surlignée,
 * comme dans l'info-bulle de la page Membres (même calcul,
 * PartageChasses.arriveeAttaque). Joueurs inventés.
 */
const page = creerPage(
  ["js/class/Utils.js", "js/page/PartageChasses.js"],
  `
  var heure = moment("2026-11-09 10:00:20", "YYYY-MM-DD HH:mm:ss").valueOf();
  var Horloge = { maintenant: () => heure, serveur: () => moment(heure), clic: () => moment(heure) };
  var monProfil = { pseudo: "Moi" };
`,
);

const PARTAGES = {
  chasses: { alpha: [{ date: "2026-11-09 11:30", terrain: 1500 }] },
  floods: [
    {
      date: "2026-11-09 10:30",
      cible: "Alpha",
      unites: 10000,
      terrain: 10000,
      tdcCible: 200000,
      id: 1,
      lanceur: "Beta",
    },
    {
      date: "2026-11-09 12:00",
      cible: "Alpha",
      unites: 5000,
      terrain: 5000,
      tdcCible: 190000,
      id: 2,
      lanceur: "Gamma",
    },
  ],
};
const espaces = (t: string) => t.replace(/[\s  ]+/g, " ").trim();

// attaque : {secondes} vers Alpha, ou null (son propre profil)
async function afficher(
  attaque: { secondes: number | null } | null,
  terrain = 200000,
  partages: unknown = PARTAGES,
  pseudo = "Alpha",
) {
  page.lire(`(() => {
    localStorage.clear();
    document.body.innerHTML = "<span id='tag_alliance'>OUAF</span><span id='quantite_tdc'>150000</span><div class='boite_membre'>Action</div>";
    PartageChasses.charger = () => Promise.resolve(${JSON.stringify(partages)});
    // pages Membres et classement illisibles : TdC des autres lanceurs inconnus
    $.get = () => Promise.resolve("<html></html>");
    let a = ${JSON.stringify(attaque)};
    PartageChasses.afficherProfil(${JSON.stringify(pseudo)}, ${terrain}, a && { secondes: a.secondes, depart: Horloge.clic() });
  })()`);
  await new Promise((r) => setTimeout(r, 20));
  return page.lire<{ lignes: string[]; surlignee: number; note: string; titre: string }>(`(() => {
    let $t = $("#o_chassesPartagees .o_partageSynthese table tr");
    return {
      titre: $("#o_chassesPartagees .o_partageSynthese .o_partageTitre").text(),
      lignes: $t.map((i, l) => $(l).children().first().text()).get(),
      surlignee: $t.index($t.filter(".o_ligneArrivee")),
      note: $("#o_chassesPartagees .o_partageSynthese .o_note").text(),
    };
  })()`);
}

describe("page d'un membre : la synthèse seule", () => {
  const bloc = () =>
    page.lire<{ titre: string; tableaux: number; titres: string[]; texte: string }>(`({
      titre: $("#o_chassesPartagees .o_partageSpoiler").first().text(),
      tableaux: $("#o_chassesPartagees table").length,
      titres: $("#o_chassesPartagees h3").map((i, h) => h.textContent.replace(/\\s+/g, " ").trim()).get(),
      texte: $("#o_chassesPartagees").text().replace(/\\s+/g, " ").trim(),
    })`);

  test("un seul tableau, « Évolution du TdC » : ni le tableau des chasses ni celui des floods", async () => {
    await afficher({ secondes: 4500 });
    const b = bloc();
    expect(espaces(b.titre)).toBe("▼ Chasses et floods en cours partagés avec la OUAF");
    expect(b.tableaux).toBe(1);
    expect(b.titres.map(espaces)).toEqual(["Évolution du TdC de Alpha déjà à portée"]);
    for (const absent of [
      "Chasses en cours partagées",
      "Floods en cours depuis ou vers",
      "Total (",
    ])
      expect(b.texte).not.toContain(absent);
    // chaque chasse et chaque flood y a sa ligne, avec son lanceur et ses unités
    expect(b.texte).toContain("Beta → Alpha");
    expect(b.texte).toContain("Gamma → Alpha");
    expect(b.texte).toContain("Chasse");
    expect(b.texte).toContain("10 000");
  });

  test("rien de partagé : une phrase, pas de tableau", async () => {
    await afficher({ secondes: 4500 }, 200000, { chasses: {}, floods: [] });
    expect(bloc()).toMatchObject({
      tableaux: 0,
      titres: [],
    });
    expect(page.lire(`$("#o_chassesPartagees p").text()`)).toBe(
      "Aucune chasse ni aucun flood en cours partagé.",
    );
  });

  test("TdC du joueur illisible sur la page : pas d'évolution, une phrase qui le dit", async () => {
    await afficher({ secondes: 4500 }, NaN);
    expect(bloc().tableaux).toBe(0);
    expect(bloc().texte).toContain("TdC de Alpha illisible sur la page : évolution impossible.");
  });

  test("pseudo de la page écrit comme du texte, pas comme du HTML", async () => {
    const pseudo = "<img src=x onerror=alert(1)>";
    const partages = JSON.parse(
      JSON.stringify(PARTAGES).replace(/Alpha/g, pseudo).replace(/alpha/g, pseudo.toLowerCase()),
    );
    await afficher({ secondes: 4500 }, 200000, partages, pseudo);
    expect(page.lire(`$("#o_chassesPartagees img").length`)).toBe(0);
    expect(bloc().titres[0]).toContain("Évolution du TdC de <img src=x onerror=alert(1)>");
    await afficher({ secondes: 4500 }, NaN, partages, pseudo);
    expect(page.lire(`$("#o_chassesPartagees img").length`)).toBe(0);
    expect(bloc().texte).toContain("TdC de <img src=x onerror=alert(1)> illisible");
  });

  test("case « Évolution du TdC avec les chasses et floods partagés » décochée : rien", async () => {
    page.lire(`localStorage.setItem("fzzz_affichage_profilPartages", "0")`);
    page.lire(`(() => {
      document.body.innerHTML = "<span id='tag_alliance'>OUAF</span><div class='boite_membre'>Action</div>";
      PartageChasses.charger = () => Promise.resolve(${JSON.stringify(PARTAGES)});
      PartageChasses.afficherProfil("Alpha", 200000, null);
    })()`);
    await new Promise((r) => setTimeout(r, 20));
    expect(page.lire(`$("#o_chassesPartagees").length`)).toBe(0);
    page.lire(`localStorage.removeItem("fzzz_affichage_profilPartages")`);
  });
});

describe("page d'un membre : « à portée » après le titre", () => {
  test("mon TdC 150 000 (portée de 75 000 à 449 999) : déjà à portée, ou heure d'entrée", async () => {
    expect(espaces((await afficher({ secondes: 4500 })).titre)).toBe(
      "Évolution du TdC de Alpha déjà à portée",
    );
    // 460 000, puis 450 000 (10h30), 451 500 (chasse de 11h30), 446 500 (12h00)
    expect(espaces((await afficher({ secondes: 4500 }, 460000)).titre)).toBe(
      "Évolution du TdC de Alpha à portée le 09/11 à 12h00",
    );
    // son propre profil : pas de mention
    expect(espaces((await afficher(null)).titre)).toBe("Évolution du TdC de Alpha");
  });
});

describe("page d'un membre : TdC à l'arrivée d'une attaque lancée à l'ouverture", () => {
  test("ligne surlignée d'après le temps de trajet, note avec l'heure du RC", async () => {
    // 1 h 15 de trajet : RC à 11h16, après le flood de 10h30, avant la chasse de 11h30
    const r = await afficher({ secondes: 4500 });
    expect(r.lignes).toEqual(["", "Actuellement", "09/11 10h30", "09/11 11h30", "09/11 12h00"]);
    expect(r.surlignee).toBe(2);
    expect(espaces(r.note)).toBe(
      "Surligné : TdC à l'arrivée d'une attaque lancée à l'ouverture de la page (09/11 11h16).",
    );
    // 20 min : avant tout mouvement ; 3 h : après le dernier
    expect((await afficher({ secondes: 1200 })).surlignee).toBe(1);
    expect((await afficher({ secondes: 10800 })).surlignee).toBe(4);
    // arrivée à 11h30:00 pile : la chasse de 11h30 est comptée
    expect((await afficher({ secondes: 5380 })).surlignee).toBe(3);
  });

  test("son propre profil : rien de surligné ; trajet inconnu : une note", async () => {
    expect(await afficher(null)).toMatchObject({ surlignee: -1, note: "" });
    const r = await afficher({ secondes: null });
    expect(r.surlignee).toBe(-1);
    expect(espaces(r.note)).toBe("TdC à l'arrivée d'une attaque : temps de trajet inconnu.");
  });
});
