import { beforeEach, describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * « Replacer l'armée » sans Compte+ (message de Boursouf, 22/11/2026 : « Replacement
 * interrompu : le jeu n'a pas répondu » à chaque fois, l'armée pourtant replacée).
 * Hors Compte+ le jeu écrit chaque troupe dans un span « (282,'unite1',3) » sans
 * flèches : l'extension les ajoute (fleches), à l'ouverture puis dans le tableau
 * redessiné après le replacement, où le dépliant « Statistiques » est remis avec
 * ses cases de nombres sans span. Armées inventées.
 */
const page = creerPage(
  [
    "js/class/Utils.js",
    "js/class/Parametre.js",
    "js/class/Joueur.js",
    "js/class/Armee.js",
    "js/page/Armee.js",
    "js/content.js",
  ],
  // constantes du jeu (content.js) ; l'encart « Connexion » empêche le démarrage
  `var chrome = { runtime: { getManifest: () => ({ version: "1" }), getURL: (p) => p } };
   document.body.innerHTML = "<div class='boite_connexion_titre'>Connexion</div>";
   var NOMS = ["Jeune Soldate Naine", "Soldate Naine"];
   // page Armée hors Compte+ : un lieu occupé fait trois cases (flèche, nombre, flèche)
   function pageArmee(l, jeton) {
     let lieu = (n, k, origine) => n
       ? "<td style='width:20px'></td><td style='width:120px'><span id=\\"(" + n + ",'unite" + (k + 1) + "'," + origine + ")\\">" + numeral(n).format() + "</span></td><td style='width:20px'></td>"
       : "<td colspan=3></td>";
     return "<div id='centre'><table class='simulateur'><tr><td colspan=10><h3> Troupes en Garnison </h3></td></tr>" +
       "<tr class='ligne_paire'><td>Unités</td><td colspan=3>Terrain de Chasse</td><td colspan=3><span>Dôme (3)</span></td><td colspan=3><span>Loge (3)</span></td></tr>" +
       NOMS.map((nom, k) => "<tr align='center'><td><div class='pas_sur_telephone'>" + nom + "</div></td>" +
         lieu(l.tdc[k], k, 1) + lieu(l.dome[k], k, 2) + lieu(l.loge[k], k, 3) + "</tr>").join("") +
       "</table><form action='Armee.php' method='post'><input type='hidden' name='t' id='t' value='" + jeton + "'/>" +
       "<select name='ChoixUnite' id='ChoixUnite'>" + NOMS.map((nom, k) => "<option value='unite" + (k + 1) + "'>" + nom + "</option>").join("") + "</select></form></div>";
   }`,
);

const DEPART = { tdc: [0, 0], dome: [0, 0], loge: [500, 300] };

beforeEach(() => {
  page.lire(`(() => {
    localStorage.clear();
    // réglage de Boursouf : 0 en TdC, 50 000 000 en dôme, même unité
    localStorage.setItem("outiiil_parametre", JSON.stringify({ uniteAntisondeTerrain: 0, uniteAntisondeDome: 50000000, uniteAntisondeTerrainType: 1, uniteAntisondeDomeType: 1 }));
    window.monProfil = new Joueur({ pseudo: "Moi" }).getParametre();
    monProfil.niveauRecherche = [0, 0, 0, 0, 0, 0, 0];
    document.body.innerHTML = pageArmee(${JSON.stringify(DEPART)}, "j0");
    window.etat = ${JSON.stringify(DEPART)};
    window.TOASTS = [];
    window.NOTES = [];
    window.RECHARGES = [];
    $.toast = (o) => TOASTS.push([o.icon, o.text]);
    Journal.info = (src, m, d) => NOTES.push(["info", src, m, d]);
    Journal.erreur = (src, m, d) => NOTES.push(["erreur", src, m, d]);
    PageArmee.attendre = () => Promise.resolve();
    let lieu = { 1: "tdc", 2: "dome", 3: "loge" }, jeton = 0;
    $.get = () => Promise.resolve(pageArmee(etat, "j" + ++jeton));
    $.post = (url, d) => {
      let k = Number(String(d.ChoixUnite).replace("unite", "")) - 1;
      etat[lieu[d.LieuOrigine]][k] -= d.nbTroupes;
      etat[lieu[d.LieuDestination]][k] += d.nbTroupes;
      return Promise.resolve(pageArmee(etat, "j" + ++jeton));
    };
    // ouverture de la page comme executer() : flèches et lignes, puis le dépliant « Statistiques »
    window.p = Object.create(PageArmee.prototype);
    p.recupererArmee();
    p.flechesEtLignes();
    p.afficherStatistique();
  })()`);
});

/** Replacement lancé ; setTimeout du rechargement de la page relevé au lieu d'être exécuté. */
async function replacer() {
  page.lire(`(() => {
    window.minuterie = window.setTimeout;
    window.setTimeout = (f, ms) => RECHARGES.push(ms);
    window.fin = p.placementPrevu()(false);
  })()`);
  try {
    await page.lire(`fin`);
  } finally {
    page.lire(`window.setTimeout = minuterie`);
  }
  return {
    toasts: page.lire<[string, string][]>(`TOASTS`),
    notes: page.lire<string[][]>(`NOTES`),
    recharges: page.lire<number[]>(`RECHARGES`),
  };
}

describe("« Replacer l'armée » sans Compte+", () => {
  test("dépliant « Statistiques » remis dans le tableau : armée replacée, flèches refaites, aucune erreur", async () => {
    const r = await replacer();
    expect(r.toasts).toEqual([
      [
        "success",
        "Armée replacée : 0 Jeune Soldate Naine en TdC, 500 Jeune Soldate Naine en dôme, le reste en loge.",
      ],
    ]);
    expect(r.notes.filter((n) => n[0] == "erreur")).toEqual([]);
    expect(r.recharges).toEqual([]);
    expect(page.lire(`etat`)).toEqual({ tdc: [0, 0], dome: [500, 0], loge: [0, 300] });
    // flèches posées autour des troupes du nouveau tableau, statistiques gardées
    expect(page.lire<number>(`$(".simulateur:first a[href*='Transferer']").length`)).toBe(3);
    expect(page.lire<number>(`$("#o_statArmee").length`)).toBe(1);
  });

  test("erreur de l'extension pendant le replacement : dite comme telle et notée au journal", async () => {
    page.lire(`p.remplacerGarnison = () => { throw new TypeError("essai"); }`);
    const r = await replacer();
    expect(r.toasts).toEqual([
      [
        "error",
        "Replacement interrompu par une erreur de l'extension (notée dans le journal de débug). La page Armée va être rechargée.",
      ],
    ]);
    const erreur = r.notes.find((n) => n[0] == "erreur")!;
    expect(erreur.slice(1, 3)).toEqual(["Replacement de l'armée", "erreur de l'extension"]);
    expect(erreur[3]).toContain("essai");
    expect(r.recharges).toEqual([2500]);
  });

  test("le jeu ne répond pas : même message qu'avant, statut noté au journal", async () => {
    page.lire(`$.post = () => Promise.reject({ status: 0, readyState: 0 })`);
    const r = await replacer();
    expect(r.toasts).toEqual([
      [
        "error",
        "Replacement interrompu : le jeu n'a pas répondu. La page Armée va être rechargée.",
      ],
    ]);
    expect(r.notes.find((n) => n[0] == "erreur")!.slice(1)).toEqual([
      "Replacement de l'armée",
      "le jeu n'a pas répondu",
      "HTTP 0",
    ]);
  });
});
