import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { creerPage } from "./harnais";

/**
 * Croix de l'horloge (demande du mainteneur) : l'horloge se ferme au besoin,
 * pendant une heure ou jusqu'à l'ouverture (ou au rechargement) d'une page
 * d'attaque d'un ennemi, où elle sert à lancer à la seconde.
 */
const page = creerPage(
  ["js/class/Utils.js", "js/class/Horloge.js"],
  `var TOAST_INFO = { icon: "info" };
   var heure = moment("2026-11-13 10:00", "YYYY-MM-DD HH:mm").valueOf();`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);
const HEURE = 3600000;

/** Stockage de l'extension simulé, partagé par les pages et suivi en direct. */
function preparer() {
  lire(`(() => {
    heure = moment("2026-11-13 10:00", "YYYY-MM-DD HH:mm").valueOf();
    Date.now = () => heure;
    // tic de l'horloge : appelé à la main (Horloge._majAffichage)
    setTimeout = () => 0;
    localStorage.clear();
    window.GARDE = {};
    window.ECOUTEURS = [];
    const prevenir = (cle, ancien, nouveau) =>
      ECOUTEURS.forEach((f) => f({ [cle]: { oldValue: ancien, newValue: nouveau } }, "local"));
    window.chrome = {
      storage: {
        local: {
          get: (cles) => Promise.resolve(Object.fromEntries([].concat(cles).filter((c) => c in GARDE).map((c) => [c, GARDE[c]]))),
          set: (o) => { for (const c in o) { const ancien = GARDE[c]; GARDE[c] = o[c]; prevenir(c, ancien, o[c]); } return Promise.resolve(); },
          remove: (c) => { const ancien = GARDE[c]; delete GARDE[c]; prevenir(c, ancien, undefined); return Promise.resolve(); },
        },
        onChanged: { addListener: (f) => ECOUTEURS.push(f) },
      },
    };
    window.TOASTS = [];
    $.toast = (o) => { TOASTS.push(o); return {}; };
    $(document).off("click.o_horlogeRevoir");
  })()`);
}
/** Le joueur ouvre une page : l'horloge y est affichée comme au démarrage de l'extension. */
const ouvrir = async (chemin: string) => {
  lire(`(() => {
    history.replaceState(null, "", ${JSON.stringify(chemin)});
    document.body.innerHTML = "";
    // une page neuve n'a que ses propres écouteurs
    ECOUTEURS.length = 0;
    Horloge.afficher();
  })()`);
  await new Promise((r) => setTimeout(r, 0));
};
const masquee = () => lire<boolean>(`$("#o_horloge").hasClass("o_horlogeMasquee")`);
const gardee = () => lire<number | undefined>(`GARDE.fzzz_horlogeMasquee`);
const avancer = (ms: number) => lire(`heure += ${ms}; Horloge._majAffichage()`);
const fermer = () => lire(`$("#o_horlogeFermer").trigger("click")`);

describe("croix de l'horloge", () => {
  test("une croix dans l'horloge ; un clic la masque une heure et le dit, avec de quoi la remettre", async () => {
    preparer();
    await ouvrir("/Ressources.php");
    expect(lire(`$("#o_horloge #o_horlogeFermer").length`)).toBe(1);
    expect(lire(`$("#o_horlogeFermer").attr("title")`)).toBe(
      "Masquer l’horloge pendant 1 h ; elle revient dès qu’une page d’attaque est ouverte",
    );
    expect(masquee()).toBe(false);
    fermer();
    expect(masquee()).toBe(true);
    expect(gardee()).toBe(lire<number>(`heure`) + HEURE);
    expect(lire(`TOASTS.map((t) => [t.icon, t.text])`)).toEqual([
      [
        "info",
        "Horloge masquée pendant 1 h ; elle revient dès que tu ouvres une page d'attaque. <a href='#' class='o_horlogeRevoir'>La remettre</a>",
      ],
    ]);
    // la croix ne touche pas à la latence
    expect(lire(`Horloge.latence`)).toBe(0);
  });

  test("masquée sur les pages suivantes pendant une heure, puis de retour sans recharger", async () => {
    preparer();
    await ouvrir("/Ressources.php");
    fermer();
    for (const chemin of ["/Reine.php", "/Armee.php", "/ennemie.php", "/messagerie.php"]) {
      await ouvrir(chemin);
      expect(masquee()).toBe(true);
    }
    avancer(HEURE - 1000);
    expect(masquee()).toBe(true);
    avancer(1000);
    expect(masquee()).toBe(false);
    await ouvrir("/Reine.php");
    expect(masquee()).toBe(false);
  });

  test("page d'attaque d'un ennemi : l'horloge y revient, et sur les pages suivantes aussi", async () => {
    preparer();
    await ouvrir("/Ressources.php");
    fermer();
    await ouvrir("/ennemie.php?Attaquer=12&lieu=1");
    expect(masquee()).toBe(false);
    expect(gardee()).toBeUndefined();
    await ouvrir("/Ressources.php");
    expect(masquee()).toBe(false);
  });

  test("fermée sur la page d'attaque : masquée jusqu'à son rechargement", async () => {
    preparer();
    await ouvrir("/ennemie.php?Attaquer=12&lieu=1");
    fermer();
    expect(masquee()).toBe(true);
    await ouvrir("/ennemie.php?Attaquer=12&lieu=1");
    expect(masquee()).toBe(false);
  });

  test("clic involontaire : le lien « La remettre » la montre tout de suite", async () => {
    preparer();
    await ouvrir("/Ressources.php");
    fermer();
    lire(`(() => {
      $("body").append(TOASTS[0].text);
      $(".o_horlogeRevoir").trigger("click");
    })()`);
    expect(masquee()).toBe(false);
    expect(gardee()).toBeUndefined();
    await ouvrir("/Reine.php");
    expect(masquee()).toBe(false);
  });

  test("fermée ou remise dans un autre onglet : cette page suit, sans recharger", async () => {
    preparer();
    await ouvrir("/Ressources.php");
    lire(`chrome.storage.local.set({ fzzz_horlogeMasquee: heure + ${HEURE} })`);
    expect(masquee()).toBe(true);
    lire(`chrome.storage.local.remove("fzzz_horlogeMasquee")`);
    expect(masquee()).toBe(false);
  });

  test("stockage de l'extension indisponible : l'horloge s'affiche, la croix la masque sur cette page", async () => {
    preparer();
    lire(`window.chrome = {}`);
    await ouvrir("/Ressources.php");
    expect(masquee()).toBe(false);
    fermer();
    expect(masquee()).toBe(true);
  });

  test("la croix est un bouton : elle ne déplace pas l'horloge ; l'horloge masquée ne prend aucune place", () => {
    const css = readFileSync(join(import.meta.dir, "..", "public", "css", "outiiil.css"), "utf8");
    expect(css).toMatch(/#o_horloge\.o_horlogeMasquee \{\s*display: none !important;\s*\}/);
    const source = readFileSync(
      join(import.meta.dir, "..", "public", "js", "class", "Horloge.js"),
      "utf8",
    );
    // le glisser ignore les boutons (latence, croix)
    expect(source).toContain(`if (e.target.closest("button")) return;`);
    expect(source).toContain(`<button type='button' id='o_horlogeFermer'`);
  });
});

describe("page d'attaque d'un ennemi", () => {
  test("ennemie.php avec Attaquer : oui ; liste des ennemis, Armée et autres pages : non", () => {
    const attaque = (pathname: string, search = "") =>
      lire<boolean>(`Utils.pageAttaque(${JSON.stringify({ pathname, search })})`);
    expect(attaque("/ennemie.php", "?Attaquer=12&lieu=1")).toBe(true);
    expect(attaque("/ennemie.php", "?lieu=1&Attaquer=12")).toBe(true);
    expect(attaque("/ennemie.php")).toBe(false);
    expect(attaque("/Armee.php")).toBe(false);
    expect(attaque("/Membre.php", "?Pseudo=Attaquer=1")).toBe(false);
    expect(attaque("/Armee.php", "?Attaquer=12")).toBe(false);
    // les pages sans alerte de ponte restent l'Armée et la page d'attaque
    const sans = (pathname: string, search = "") =>
      lire<boolean>(`Utils.pageSansAlertePonte(${JSON.stringify({ pathname, search })})`);
    expect([
      sans("/Armee.php"),
      sans("/ennemie.php", "?Attaquer=12"),
      sans("/ennemie.php"),
      sans("/Reine.php"),
    ]).toEqual([true, true, false, false]);
  });
});
