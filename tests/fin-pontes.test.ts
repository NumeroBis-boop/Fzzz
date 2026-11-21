import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Page Reine, tableau « Pontes en cours » : date et heure de fin de chaque
 * ponte (demande du mainteneur, 21/11/2026, toujours affichées). En Compte+ le
 * jeu a une colonne « Ponte finie » avec l'heure seule (page enregistrée du
 * mainteneur) : la date y est ajoutée ; sans Compte+ (capture d'un joueur,
 * quatre colonnes) la colonne est ajoutée après « Temps total restant ».
 */
const page = creerPage(
  ["js/class/Utils.js", "js/page/Reine.js"],
  `var Horloge = { serveur: () => moment("2026-11-21 10:00:00", "YYYY-MM-DD HH:mm:ss") };`,
  "https://s5.fourmizzz.fr/Reine.php",
);

const ligne = (id: number, unites: string, reste: number, finie: string | null) =>
  `<tr><td><span>${unites}</span></td> <td> Fourmilière</td> <td><span>17m 17s</span></td> <td><span id="ponte_${id}">x</span></td>${finie == null ? "" : ` <td>${finie}</td>`} <td><a href="Reine.php?AnnulerPonte=${id}">Annuler</a></td></tr><script type="text/javascript">reste(${reste}, "ponte_${id}");</script>`;

const tableau = (comptePlus: boolean, lignes: string) =>
  `<table class="tableau_leger"><tr><td><strong>Unités</strong></td><td><strong>Garnison</strong></td><td><strong>Temps requis</strong></td><td><strong>Temps total restant</strong></td>${comptePlus ? "<td><strong>Ponte finie</strong></td>" : ""}<td></td></tr>${lignes}</table>`;

const afficher = (html: string) =>
  page.lire<string[][]>(`(() => {
    document.body.innerHTML = ${JSON.stringify(html)};
    PageReine.finPontes();
    return [...document.querySelectorAll(".tableau_leger tr")].map((tr) =>
      [...tr.children].map((td) => td.textContent.trim()));
  })()`);

describe("fin de chaque ponte", () => {
  test("Compte+ : la date s'ajoute à l'heure du jeu, au bon jour", () => {
    const t = afficher(
      tableau(
        true,
        ligne(1, "1 170 ouvrières", 3600, "11h00") + ligne(2, "500 JSN", 72000, "06h00"),
      ),
    );
    expect(t[0]![4]).toBe("Ponte finie");
    expect(t[1]![4]).toBe("21 nov. à 11h00");
    expect(t[2]![4]).toBe("22 nov. à 06h00");
    // pas de colonne en plus
    expect(t.map((r) => r.length)).toEqual([6, 6, 6]);
  });

  test("heure du jeu près de minuit : jour de la fin calculée", () => {
    const t = afficher(tableau(true, ligne(1, "10 JSN", 50390, "00h00")));
    // 10:00 + 13 h 59 min 50 s = 23:59:50 ; le jeu écrit 00h00 : le lendemain
    expect(t[1]![4]).toBe("22 nov. à 00h00");
  });

  test("sans Compte+ : colonne « Ponte finie » ajoutée après « Temps total restant »", () => {
    const t = afficher(
      tableau(false, ligne(1, "1 170 ouvrières", 3600, null) + ligne(2, "500 JSN", 90000, null)),
    );
    expect(t[0]).toEqual([
      "Unités",
      "Garnison",
      "Temps requis",
      "Temps total restant",
      "Ponte finie",
      "",
    ]);
    expect(t[1]![4]).toBe("21 nov. à 11h00");
    expect(t[2]![4]).toBe("22 nov. à 11h00");
    expect(t[1]![5]).toBe("Annuler");
  });

  test("sans tableau de pontes : rien", () => {
    expect(afficher("<p>Aucune ponte</p>")).toEqual([]);
  });
});
