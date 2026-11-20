import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { creerPage } from "./harnais";

/**
 * Jeton « jt » que le jeu ajoute à l'adresse (signalé le 20/11/2026 : « Multi-flood
 * opti » ouvrait « ennemie.php?jt=1.8413570ba0aa85dd#multiflood » sans sa vue) :
 * l'extension reconnaît ses pages par leurs paramètres sans lui.
 */
const page = creerPage(["js/class/Utils.js"]);
const requete = (recherche: string) =>
  page.lire<string>(`Utils.requete(${JSON.stringify(recherche)})`);
const lire = (fichier: string) =>
  readFileSync(join(import.meta.dir, "..", "public", "js", fichier), "utf8");

describe("paramètres de l'adresse sans le jeton « jt »", () => {
  test("seul, avant ou après les autres paramètres ; un autre paramètre reste", () => {
    expect(requete("")).toBe("");
    expect(requete("?jt=1.8413570ba0aa85dd")).toBe("");
    expect(requete("?JT=1.84")).toBe("");
    expect(requete("?Membres&jt=1.84")).toBe("?Membres");
    expect(requete("?jt=1.84&Membres")).toBe("?Membres");
    expect(requete("?jt=1.84&Attaquer=12&lieu=1")).toBe("?Attaquer=12&lieu=1");
    expect(requete("?forum_menu")).toBe("?forum_menu");
    expect(requete("?jtx=1")).toBe("?jtx=1");
    expect(requete("?alliance=TAG&jt=")).toBe("?alliance=TAG");
  });

  test("par défaut, l'adresse de la page", () => {
    page.lire(`history.replaceState(null, "", "/ennemie.php?jt=1.84#multiflood")`);
    expect(page.lire(`Utils.requete()`)).toBe("");
  });

  test("le routage de content.js ne compare plus l'adresse brute", () => {
    const routage = (lire("content.js").split("switch (true) {")[1] ?? "").split("default:")[0];
    expect(routage).not.toContain("location.search");
    expect(routage).not.toContain("location.href");
    expect(lire("content.js")).toContain("requete = Utils.requete()");
    expect(routage).toContain(`case uri == "/ennemie.php" && requete == "":`);
  });

  test("bootstrap.js et l'export de la messagerie lisent l'adresse sans le jeton", () => {
    const bootstrap = lire("bootstrap.js");
    expect(bootstrap).toContain("location.pathname + requete");
    expect(bootstrap).not.toContain("location.pathname + location.search");
    expect(lire("class/ExportRapports.js")).toContain("!Utils.requete() && !location.hash");
  });
});
