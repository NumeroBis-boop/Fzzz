import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { creerPage } from "./harnais";

// Recherche du jeu (Joueur.rechercher, Alliance.rechercher) dans les champs de
// l'extension (Multi-flood opti, convois, radar, boîte Combat…) : le jeu trouve
// le texte n'importe où dans le nom ; ceux qui commencent par lui passent
// d'abord (idée de SerPounce, 23/11/2026), sans requête de plus. Noms inventés.
const page = creerPage(["js/class/Utils.js"]);

/** Réponse de la recherche du jeu : une ligne de 6 cases par joueur ou alliance, dans l'ordre du jeu. */
const reponse = (lignes: [string, string][]) =>
  "<div><table class='simulateur'><tr><th>Tag</th><th>Nom</th><th></th><th></th><th></th><th></th></tr>" +
  lignes
    .map(([type, nom]) =>
      type == "j"
        ? `<tr><td></td><td><a href='Membre.php?Pseudo=${nom}'>${nom}</a></td><td></td><td></td><td></td><td></td></tr>`
        : `<tr><td>${type}</td><td><a href='classementAlliance.php?alliance=${type}'>${nom}</a></td><td></td><td></td><td></td><td></td></tr>`,
    )
    .join("") +
  "</table></div>";
const extraire = (html: string, joueur: boolean, alliance: boolean, terme?: string) =>
  page.lire<string[]>(
    `Utils.extraitRecherche(${JSON.stringify(html)}, ${joueur}, ${alliance}${terme === undefined ? "" : `, ${JSON.stringify(terme)}`}).map((e) => e.value)`,
  );

const JOUEURS = reponse(
  ["Banane", "Ananas", "Cabane", "Annie", "Manon", "Anatole", "Zana"].map(
    (n) => ["j", n] as [string, string],
  ),
);

describe("recherche du jeu : ceux qui commencent par la saisie d'abord", () => {
  test("joueurs : début du nom d'abord, l'ordre du jeu gardé dans chaque groupe, 6 au plus", () => {
    expect(extraire(JOUEURS, true, false, "an")).toEqual([
      "Ananas",
      "Annie",
      "Anatole",
      "Banane",
      "Cabane",
      "Manon",
    ]);
    // casse et accents ignorés
    expect(
      extraire(
        reponse([
          ["j", "Hélène"],
          ["j", "Éléonore"],
        ]),
        true,
        false,
        "ELE",
      ),
    ).toEqual(["Éléonore", "Hélène"]);
  });

  test("sans texte saisi : l'ordre du jeu, comme avant", () => {
    expect(extraire(JOUEURS, true, false)).toEqual([
      "Banane",
      "Ananas",
      "Cabane",
      "Annie",
      "Manon",
      "Anatole",
    ]);
  });

  test("joueurs et alliances : 3 de chaque, une alliance commence par son nom ou son tag", () => {
    const html = reponse([
      ["j", "Toto"],
      ["XYZ", "Les Tortues"],
      ["j", "Ottoman"],
      ["OTO", "Grand Nord"],
      ["j", "Otto"],
      ["ABC", "Pot au feu"],
      ["j", "Otarie"],
    ]);
    expect(extraire(html, true, true, "ot")).toEqual([
      "Ottoman",
      "Grand Nord",
      "Otto",
      "Otarie",
      "Les Tortues",
      "Pot au feu",
    ]);
  });

  test("un seul résultat : le jeu ouvre la page du joueur", () => {
    expect(extraire("<div><h2>Solo</h2></div>", true, false, "so")).toEqual(["Solo"]);
  });

  test("chaque champ de recherche de l'extension donne le texte saisi", () => {
    const fichiers: string[] = [];
    const parcourir = (dossier: string) => {
      for (const nom of readdirSync(dossier)) {
        const chemin = join(dossier, nom);
        if (statSync(chemin).isDirectory()) {
          if (nom != "lib") parcourir(chemin);
        } else if (nom.endsWith(".js")) fichiers.push(chemin);
      }
    };
    parcourir(join(import.meta.dir, "..", "public", "js"));
    const appels = fichiers.flatMap((f) =>
      [...readFileSync(f, "utf8").matchAll(/extraitRecherche\(([^)]*)\)/g)]
        .filter((m) => !/^data, joueur = true/.test(m[1] ?? ""))
        .map((m) => [f.split("public/js/")[1], m[1]?.split(",").length]),
    );
    expect(appels.length).toBe(8);
    expect(appels.filter(([, n]) => n != 4)).toEqual([]);
  });
});
