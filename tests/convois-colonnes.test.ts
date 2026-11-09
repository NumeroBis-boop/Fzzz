import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Page Convois : le « - » du jeu et l'état de suivi (« ✅ Enregistré »,
 * « 📤 Envoyer au suivi ») dans une colonne, le reste de chaque convoi dans
 * l'autre, replié sous « Vous allez… » : « Annuler » n'est jamais sous ou sur
 * un bouton d'envoi. happy-dom n'a pas de rendu : la mise en page elle-même
 * se vérifie dans Chromium (scripts/mobile.cjs).
 */
const page = creerPage(
  [
    "js/class/Utils.js",
    "js/class/Horloge.js",
    "js/class/OuafSuivi.js",
    "js/page/PartageChasses.js",
    "js/page/ConvoisForum.js",
    "js/page/CommerceFzzz.js",
  ],
  `var TOAST_INFO = {}, TOAST_WARNING = {}, TOAST_ERROR = {};`,
);

// lignes au format du jeu (joueurs inventés)
const livrer = (id: number) =>
  `<strong>- Vous allez livrer 200 000 <img alt="nourritures" src="n.gif"/> et 0 <img alt="materiaux" src="m.gif"/> à  <a href="Membre.php?Pseudo=Kwhwwymwn">Kwhwwymwn</a> dans 8H 55m 20s  </strong> - <small><em>Retour le 25 oct. à 15h32</em></small> - <a href="commerce.php?annuler=${id}&amp;t=x">Annuler</a><br />\n`;
const recevoir = `<strong>- Vous allez recevoir 50 000 <img alt="nourritures" src="n.gif"/> et 25 000 <img alt="materiaux" src="m.gif"/> de  <a href="Membre.php?Pseudo=Alpha">Alpha</a> dans 45m 02s  </strong><br />\n`;
const attendre = () => new Promise((r) => setTimeout(r, 50));

// page Convois ; le forum note le premier convoi
function ouvrir(suivi = true, colonnes = true) {
  page.lire(`(() => {
    localStorage.clear();
    if (!${suivi}) localStorage.setItem("fzzz_affichage_convoisSuiviLignes", "0");
    if (!${colonnes}) localStorage.setItem("fzzz_affichage_convoisColonnes", "0");
    window.chrome = {
      storage: { local: { get: () => Promise.resolve({}) } },
      runtime: { sendMessage: () => Promise.resolve({ ok: true, donnees: {} }) },
    };
    ConvoisForum.notes = () =>
      Promise.resolve([{ id: 101, vers: "Kwhwwymwn", montant: 200000, arrivee: Date.now() + 32120000 }]);
    $.toast = () => {};
    document.body.innerHTML = ${JSON.stringify(
      `<div id="centre"><h3>Convois en cours:</h3>${livrer(101)}${livrer(102)}${recevoir}<h3>Autre</h3><p>fin</p></div>`,
    )};
    CommerceFzzz.suiviOuaf();
  })()`);
}

describe("page Convois : état de suivi dans sa colonne", () => {
  test("le « - » et l'état à gauche, le texte, « Retour » et « Annuler » à droite", async () => {
    ouvrir();
    await attendre();
    expect(page.lire(`$("#centre > h3").first().next().is(".o_convois")`)).toBe(true);
    expect(
      page.lire(`$(".o_convois > .o_convoi").map((i, l) => [[
        $(l).children(".o_convoiEtat")[0].firstChild.data,
        $(l).find(".o_convoiEtat .o_ouafLigne").length,
        $(l).find(".o_convoiTexte > strong:first-child").text().trim().slice(0, 17),
        $(l).find(".o_convoiTexte small").length,
        $(l).find(".o_convoiTexte a[href*='annuler']").length,
      ]]).get()`),
    ).toEqual([
      ["- ", 1, "Vous allez livrer", 1, 1],
      ["- ", 1, "Vous allez livrer", 1, 1],
      ["- ", 0, "Vous allez recevo", 0, 0],
    ]);
    // jamais « Annuler » dans la colonne des états ; plus de <br> entre les lignes
    expect(page.lire(`$(".o_convoiEtat a").length`)).toBe(0);
    expect(page.lire(`$("#centre br").length`)).toBe(0);
    // le reste de la page ne bouge pas
    expect(page.lire(`$("#centre").children().map((i, e) => e.tagName).get()`)).toEqual([
      "H3",
      "DIV",
      "H3",
      "P",
    ]);
    // états d'après le forum : le premier noté, le second à envoyer
    expect(
      page.lire(
        `$(".o_ouafLigne").map((i, l) => $(l).find(".o_ouafOui")[0].style.display != "none" ? "✅" : "📤").get()`,
      ),
    ).toEqual(["✅", "📤"]);
  });

  test("les convois se relisent pareil une fois rangés ; un second passage ne change rien", async () => {
    ouvrir();
    await attendre();
    expect(page.lire(`CommerceFzzz.lignes().length`)).toBe(3);
    expect(page.lire(`OuafSuivi.convoisJeu().map((c) => [c.id, c.vers, c.montant])`)).toEqual([
      [101, "Kwhwwymwn", 200000],
      [102, "Kwhwwymwn", 200000],
    ]);
    const texte = page.lire<string>(`CommerceFzzz.texte(CommerceFzzz.lignes()[0])`);
    expect(texte).toContain("Vous allez livrer 200 000");
    expect(texte).toContain("Retour le 25 oct.");
    expect(texte).not.toContain("Annuler");
    expect(page.lire(`OuafSuivi.lienAnnuler(CommerceFzzz.lignes()[1]).getAttribute("href")`)).toBe(
      "commerce.php?annuler=102&t=x",
    );
    page.lire(`CommerceFzzz.suiviOuaf()`);
    await attendre();
    expect(
      page.lire(`[$(".o_convois").length, $(".o_convoi").length, $(".o_ouafLigne").length]`),
    ).toEqual([1, 3, 2]);
  });

  test("colonnes coupées (Préférences) : l'état après le « - » du jeu, dans la ligne, comme avant", async () => {
    ouvrir(true, false);
    await attendre();
    expect(page.lire(`$(".o_convois").length`)).toBe(0);
    expect(page.lire(`$("#centre > strong").length + $("#centre br").length`)).toBe(6);
    expect(
      page.lire(
        `$("#centre > strong").map((i, s) => [[s.firstChild.data, $(s).children(".o_ouafLigne").length]]).get()`,
      ),
    ).toEqual([
      ["- ", 1],
      ["- ", 1],
      ["- Vous allez recevoir 50 000 ", 0],
    ]);
  });

  test("suivi des convois masqué (Préférences) : la page reste celle du jeu", async () => {
    ouvrir(false);
    await attendre();
    expect(page.lire(`$(".o_convois").length + $(".o_ouafLigne").length`)).toBe(0);
    expect(page.lire(`$("#centre > strong").length + $("#centre br").length`)).toBe(6);
  });
});
