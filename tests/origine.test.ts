import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

const page = creerPage(["js/class/Utils.js"]);

describe("« Rétablir l'affichage d'origine »", () => {
  test("onglet non coché : affichages selon leur propre case", () => {
    page.lire(`localStorage.clear(); localStorage.setItem("fzzz_affichage_trajet", "0")`);
    expect(page.lire(`Utils.origine("General")`)).toBe(false);
    expect(page.lire(`Utils.affichage("horloge")`)).toBe(true);
    expect(page.lire(`Utils.affichage("trajet")`)).toBe(false);
  });
  test("onglet Général coché : l'horloge est coupée, sa case reste mémorisée", () => {
    page.lire(`localStorage.clear(); localStorage.setItem("fzzz_origine_General", "1")`);
    expect(page.lire(`Utils.origine("General")`)).toBe(true);
    expect(page.lire(`Utils.affichage("horloge")`)).toBe(false);
    expect(page.lire(`localStorage.getItem("fzzz_affichage_horloge")`)).toBeNull();
    page.lire(`localStorage.removeItem("fzzz_origine_General")`);
    expect(page.lire(`Utils.affichage("horloge")`)).toBe(true);
  });
});
