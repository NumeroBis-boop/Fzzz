import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { creerPage } from "./harnais";

/**
 * Noms d'unités écrits par le jeu : il a écrit « d’élite », « d'élite » puis
 * « d’Élite » selon les pages et les dates (Grim, 24/11/2026 : ses unités
 * d'élite manquaient au lanceur de chasses, lues au caractère près). Tout nom
 * lu dans une page passe par Utils.indexUnite (casse, accents, apostrophe et
 * pluriel ignorés). Armées inventées.
 */
/** NOM_UNITE et NOM_UNITES de content.js, sans lancer son démarrage. */
function listesUnites() {
  const contenu = readFileSync(join(__dirname, "..", "public", "js", "content.js"), "utf8");
  return ["NOM_UNITE", "NOM_UNITES"]
    .map((nom) => {
      const debut = contenu.indexOf(`const ${nom} = [`);
      return "var " + contenu.slice(debut + 6, contenu.indexOf("];", debut) + 2);
    })
    .join("\n");
}
const page = creerPage(
  [
    "js/lib/globalize_0.1.1.js",
    "js/lib/globalize-locale-fr.js",
    "js/lib/moment-duration-format.js",
    "js/lib/jquery-ui_1.12.1.js",
    "js/lib/datatables_1.10.16.js",
    "js/class/Utils.js",
    "js/class/Parametre.js",
    "js/class/Joueur.js",
    "js/class/Armee.js",
    "js/class/Combat.js",
    "js/class/SimulationChasse.js",
    "js/class/TroupesDehors.js",
    "js/page/PartageChasses.js",
    "js/page/Ressource.js",
    "js/page/Armee.js",
    "js/page/Attaquer.js",
  ],
  `var chrome = { runtime: { getManifest: () => ({ version: "0" }), getURL: (p) => p } };
   var Horloge = { serveur: () => moment(), maintenant: () => Date.now() };
   ${listesUnites()}`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);

describe("Utils.indexUnite", () => {
  test("toutes les écritures du jeu d'une unité d'élite donnent son rang", () => {
    const cas: [string, number][] = [
      ["Ouvrière", 0],
      ["Ouvrières", 0],
      ["Jeune Soldate Naine", 1],
      ["Jeunes Soldates Naines", 1],
      ["Naine d’Elite", 3],
      ["Naine d’Élite", 3],
      ["Naines d'Élites", 3],
      ["Concierge d’élite", 7],
      ["Artilleuse d’Élite", 9],
      ["Soldate d’élite", 10],
      ["Soldate d’Élite", 10],
      ["SOLDATE D'ÉLITE", 10],
      ["  Soldates   d’Élites ", 10],
      ["Soldate", 5],
      ["Tank d’Élite", 12],
      ["Tueuses d’Élites", 14],
      ["Tueuse", 13],
      ["Consommation Journalière", -1],
      ["Unités", -1],
      ["", -1],
    ];
    for (const [nom, rang] of cas)
      expect([nom, lire(`Utils.indexUnite(${JSON.stringify(nom)})`)]).toEqual([nom, rang]);
  });

  test("le nom entier, pas un nom contenu dans une phrase", () => {
    expect(lire(`Utils.indexUnite("Les Soldates d'Elites, la crème de la crème")`)).toBe(-1);
    expect(lire(`Utils.indexUnite("Soldate et Tank")`)).toBe(-1);
  });
});

// ligne de la garnison comme le jeu l'écrit avec le Compte+ (page Armée)
const ligne = (nom: string, dome: number, loge: number) =>
  `<tr align="center"><td><div class="pas_sur_telephone">${nom}</div><div class="que_sur_telephone">X</div></td><td colspan="3"></td>` +
  `<td></td><td><span class="cliquable">${dome.toLocaleString("fr-FR")}</span></td><td></td>` +
  `<td></td><td><span class="cliquable">${loge.toLocaleString("fr-FR")}</span></td><td></td></tr>`;
const pageArmee = (lignes: string) =>
  `<table class="simulateur"><tr align="center"><td><div class="pas_sur_telephone">Unités</div></td></tr>${lignes}</table>`;

describe("garnison de la page Armée (lanceur de chasses, Multi-flood, replacement)", () => {
  test("« d’Élite » : les unités d'élite sont comptées", () => {
    const html = pageArmee(
      ligne("Jeune Soldate Naine", 1000, 200) +
        ligne("Naine d’Élite", 30, 0) +
        ligne("Soldate d’Élite", 0, 450) +
        ligne("Tueuse d’Élite", 12, 3),
    );
    const unite = lire<number[]>(`new Armee().chargeData(${JSON.stringify(html)}).unite`);
    expect(unite).toEqual([1200, 0, 30, 0, 0, 0, 0, 0, 0, 450, 0, 0, 0, 15]);
  });

  test("une ligne de troupes au nom inconnu est notée dans le journal", () => {
    lire(`localStorage.removeItem("fzzz_journal"); Journal.installer()`);
    const html = pageArmee(ligne("Garde d’Élite", 5, 5));
    lire(`new Armee().chargeData(${JSON.stringify(html)})`);
    // niveau erreur : le journal part dans le fichier du mainteneur ce jour-là
    expect(
      lire(`Journal.entrees().filter((e) => /Garde d’Élite/.test(e.m)).map((e) => e.n)`),
    ).toEqual(["erreur"]);
  });
});

describe("autres lectures de noms d'unités", () => {
  test("chasses en cours de la page Ressources", () => {
    expect(
      lire(
        `PageRessource._armeeDepuisNoms({ "Naines d’Élites": 7, "Tanks d’Élites": 2, "Ouvrières": 9 })`,
      ),
    ).toEqual([0, 0, 7, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0]);
  });

  test("formulaire « Déplacer » de la page Armée : l'option de l'unité d'élite", () => {
    lire(
      `document.body.innerHTML = "<select id='ChoixUnite'><option value='unite1'>Jeune Soldate Naine</option><option value='unite9'>Soldate d’Élite</option></select>"`,
    );
    // rang 9 dans Armee.unite : Soldate d'élite
    expect(lire(`PageArmee.valeurUnite(9)`)).toBe("unite9");
  });

  test("page d'attaque : troupes disponibles rangées sous le nom de l'extension", () => {
    lire(
      `document.body.innerHTML = "<table id='tabChoixArmee'><tr><td>Soldate d’Élite</td><td>3</td><td>0</td><td>0</td><td><input id='unite9'></td></tr></table>"`,
    );
    expect(lire(`PageAttaquer.unitesDisponibles()`)).toEqual({
      [lire<string>(`NOM_UNITE[10]`)]: { id: "unite9", nb: 3 },
    });
  });
});

test("aucun nom d'unité lu dans une page n'est plus comparé au caractère près", () => {
  const dossiers = ["class", "page", "boite"].map((d) => join(__dirname, "..", "public", "js", d));
  for (const dossier of dossiers)
    for (const f of readdirSync(dossier).filter((f) => f.endsWith(".js"))) {
      const code = readFileSync(join(dossier, f), "utf8");
      expect([
        f,
        code.match(/NOM_UNITES?\.(indexOf|findIndex|includes)\(|==\s*NOM_UNITES?\[/g),
      ]).toEqual([f, null]);
    }
});
