import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

const ADRESSE = "location.pathname + location.search + location.hash";

// Adresse gardée dans l'historique par bootstrap.js pour une page du jeu
function adresseGardee(chemin: string, desactivee = false): string {
  const page = creerPage(
    ["js/bootstrap.js"],
    `history.replaceState(null, "", ${JSON.stringify(chemin)});` +
      (desactivee ? `localStorage.setItem("fzzz_desactivee", "1");` : ""),
  );
  page.window.document.dispatchEvent(new page.window.Event("DOMContentLoaded"));
  return page.lire<string>(ADRESSE);
}

describe("rechargement sans refaire l'action", () => {
  test("un lien d'action (jeton t) laisse la page sans paramètres", () => {
    expect(adresseGardee("/Armee.php?deplacement=3&t=a1b2c3#bas")).toBe("/Armee.php#bas");
    expect(adresseGardee("/construction.php?Construire=5&t=a1b2c3")).toBe("/construction.php");
    expect(
      adresseGardee(
        "/Armee.php?Transferer&nbTroupes=10&ChoixUnite=unite1&LieuOrigine=1&LieuDestination=3&t=a1b2c3",
      ),
    ).toBe("/Armee.php");
  });

  test("pendant le chargement, les scripts du jeu lisent encore l'adresse d'origine", () => {
    const page = creerPage(
      ["js/bootstrap.js"],
      `history.replaceState(null, "", "/laboratoire.php?Rechercher=2&t=a1b2c3");
       Object.defineProperty(document, "readyState", { get: () => "loading", configurable: true });`,
    );
    expect(page.lire<string>(ADRESSE)).toBe("/laboratoire.php?Rechercher=2&t=a1b2c3");
    page.window.document.dispatchEvent(new page.window.Event("DOMContentLoaded"));
    expect(page.lire<string>(ADRESSE)).toBe("/laboratoire.php");
  });

  test("les autres adresses sont gardées telles quelles", () => {
    expect(adresseGardee("/ennemie.php?Attaquer=305&lieu=1")).toBe(
      "/ennemie.php?Attaquer=305&lieu=1",
    );
    expect(adresseGardee("/Membre.php?Pseudo=Tom&st=2")).toBe("/Membre.php?Pseudo=Tom&st=2");
  });

  test("extension désactivée : adresse inchangée", () => {
    expect(adresseGardee("/construction.php?Construire=5&t=a1b2c3", true)).toBe(
      "/construction.php?Construire=5&t=a1b2c3",
    );
  });
});
