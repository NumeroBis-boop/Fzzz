import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Relevé du haut de page dans le journal de débug (21/11/2026) : la bande vide
 * au-dessus du menu sur téléphone, sans Compte+, serait un bandeau de pub
 * bloqué par le navigateur (d'après le mainteneur) ; son code HTML n'est pas
 * connu. Une note par jour décrit les éléments placés avant le menu, sans
 * requête. happy-dom n'a pas de mise en page : les tailles sont simulées.
 */
const page = creerPage(
  ["js/class/Utils.js"],
  `var jour = "2026-11-21";
   var Horloge = { serveur: () => moment(jour + " 10:00", "YYYY-MM-DD HH:mm"), maintenant: () => moment(jour + " 10:00", "YYYY-MM-DD HH:mm").valueOf() };`,
);

const relever = () =>
  page.lire<string[][]>(`(() => {
    localStorage.removeItem(CLE_JOURNAL);
    document.body.innerHTML = '<div id="haut"><iframe src="https://pub.example.org/bandeau?id=1"></iframe></div><div id="centre"><br><nav id="menu">Menu</nav><p>Page</p></div>';
    let tailles = { haut: [360, 37, 0], menu: [412, 45, 37] };
    HTMLElement.prototype.getBoundingClientRect = function () {
      let t = tailles[this.id] || [0, 0, 0];
      return { width: t[0], height: t[1], top: t[2], left: 0, right: t[0], bottom: t[2] + t[1] };
    };
    Journal.installer();
    Journal.noterHautDePage();
    return Journal.entrees().filter((e) => e.s == "Haut de page").map((e) => [e.m, e.d]);
  })()`);

describe("relevé du haut de page", () => {
  test("éléments avant le menu, avec leur taille et l'hôte de leurs iframes", () => {
    page.lire(`localStorage.removeItem(CLE_RELEVE_HAUT_PAGE)`);
    const notes = relever();
    expect(notes.length).toBe(1);
    expect(notes[0]![0]).toContain("1 élément(s) avant le menu, menu à 37 px");
    expect(notes[0]![1]).toBe("div#haut 360×37 à 0 px, texte 0 car., iframes pub.example.org");
  });

  test("une seule fois par jour", () => {
    page.lire(`localStorage.removeItem(CLE_RELEVE_HAUT_PAGE)`);
    relever();
    expect(relever().length).toBe(0);
    page.lire(`jour = "2026-11-22"`);
    expect(relever().length).toBe(1);
  });
});
