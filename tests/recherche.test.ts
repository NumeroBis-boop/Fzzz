import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

const page = creerPage(
  ["js/class/Utils.js", "js/class/Parametre.js", "js/class/Joueur.js", "js/class/Horloge.js"],
  "var METHODE_FLOOD = [], AFFECTATION_RESSOURCE = [], RATIO_RECOLTE = {};",
);

// encart Compte+ du jeu : ligne de la recherche en cours (secondes restantes)
const encart = (nom: string, secondes: number | null) =>
  page.lire(
    `document.body.innerHTML = ${JSON.stringify(
      `<table><tr id="ligne_recherche"><td></td><td> <a>${nom}</a></td><td><a id="temps_recherche"></a>${
        secondes == null
          ? ""
          : `<script>$(function() { resteTemps(${secondes},"temps_recherche"); });</script>`
      }</td></tr></table>`,
    )}`,
  );
const terminee = (decalage = 0) =>
  page.lire<boolean>(`(() => { let vrai = Date.now; Date.now = () => vrai() + ${decalage};
    try { return Joueur.rechercheTerminee(); } finally { Date.now = vrai; } })()`);

describe("Compte+ : fin de recherche détectée sans requête", () => {
  test("recherche en cours puis terminée : à relire une fois", () => {
    page.lire(`localStorage.clear()`);
    encart("Vitesse d'attaque", 600);
    expect(terminee()).toBe(false);
    encart("Aucune recherche", null);
    expect(terminee(601000)).toBe(true);
    expect(terminee(602000)).toBe(false);
  });
  test("recherche annulée avant sa fin : rien à relire", () => {
    page.lire(`localStorage.clear()`);
    encart("Vitesse d'attaque", 600);
    terminee();
    encart("Aucune recherche", null);
    expect(terminee(100000)).toBe(false);
  });
  test("sans Compte+ (pas d'encart du jeu) : jamais", () => {
    page.lire(`localStorage.clear(); document.body.innerHTML = ""`);
    expect(terminee()).toBe(false);
  });
});
