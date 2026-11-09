import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Page d'un membre, tableau « Évolution du TdC de … » : la ligne du TdC qu'une
 * attaque lancée à l'ouverture de la page trouverait est surlignée, comme dans
 * l'info-bulle de la page Membres (même calcul, PartageChasses.arriveeAttaque).
 * Joueurs inventés.
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
async function afficher(attaque: { secondes: number | null } | null) {
  page.lire(`(() => {
    localStorage.clear();
    document.body.innerHTML = "<span id='tag_alliance'>OUAF</span><span id='quantite_tdc'>150000</span><div class='boite_membre'>Action</div>";
    PartageChasses.charger = () => Promise.resolve(${JSON.stringify(PARTAGES)});
    let a = ${JSON.stringify(attaque)};
    PartageChasses.afficherProfil("Alpha", 200000, a && { secondes: a.secondes, depart: Horloge.clic() });
  })()`);
  await new Promise((r) => setTimeout(r, 20));
  return page.lire<{ lignes: string[]; surlignee: number; note: string }>(`(() => {
    let $t = $("#o_chassesPartagees .o_partageSynthese table tr");
    return {
      lignes: $t.map((i, l) => $(l).children().first().text()).get(),
      surlignee: $t.index($t.filter(".o_ligneArrivee")),
      note: $("#o_chassesPartagees .o_partageSynthese .o_note").text(),
    };
  })()`);
}

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
