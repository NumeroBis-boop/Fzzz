import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Synthèse des chasses en cours (page Ressources) : TdC et JSN perdues par
 * heure, durée réelle pour une chasse lancée d'ici (TroupesDehors), estimée
 * sinon.
 */
const page = creerPage(
  [
    "js/lib/globalize_0.1.1.js",
    "js/lib/globalize-locale-fr.js",
    "js/lib/moment-duration-format.js",
    "js/lib/jquery-ui_1.12.1.js",
    "js/class/Utils.js",
    "js/class/Parametre.js",
    "js/class/Joueur.js",
    "js/class/Armee.js",
    "js/class/Combat.js",
    "js/class/SimulationChasse.js",
    "js/class/TroupesDehors.js",
    "js/page/PartageChasses.js",
    "js/page/Ressource.js",
    "js/content.js",
  ],
  `var chrome = { runtime: { getManifest: () => ({ version: "0" }), getURL: (p) => p } };
   var Horloge = { serveur: () => moment(), maintenant: () => Date.now() };
   var CommerceFzzz = { copier: (t) => { window.copie = t; } };
   document.body.innerHTML = "<div class='boite_connexion_titre'>Connexion</div><span id='pseudo'>Test</span><span id='quantite_tdc'>1000000</span>"
     + "<div id='boite_tdc'><span class='titre'>Chasse en cours</span>"
     + "<div><span id='chasse_12'></span>- Vos chasseuses vont conquérir 100 000 cm²</div><small>Troupes en chasse : 1 000 000 Jeunes Soldates Naines, 10 000 Artilleuses. Arrivée à 13h00</small><script>reste(3600,\\"chasse_12\\")</script>"
     + "<div><span id='chasse_13'></span>- Vos chasseuses vont conquérir 50 000 cm²</div><small>Troupes en chasse : 500 000 Jeunes Soldates Naines. Arrivée à 16h00</small><script>reste(14400,\\"chasse_13\\")</script>"
     + "</div>";`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);

describe("synthèse des chasses : TdC et JSN perdues par heure", () => {
  test("durée réelle avec TroupesDehors, estimée sinon ; pertes d'après l'armée envoyée", () => {
    lire(`
      var monProfil = new Joueur({ pseudo: "Test", niveauRecherche: [15, 8, 10, 0, 0, 8, 0, 0, 0, 0], niveauConstruction: new Array(13).fill(0) });
      PartageChasses.recalerChasses = () => {};
      // chasse 12 lancée d'ici il y a 3 h, 1 h restante : 4 h en tout
      var unite = new Array(14).fill(0); unite[0] = 1000000; unite[7] = 10000;
      localStorage.setItem("outiiil_troupesDehors", JSON.stringify([
        { type: "chasse", id: 12, unite, lancee: Date.now() - 3 * 3600 * 1000, retour: Date.now() + 3600 * 1000 },
      ]));
      new PageRessource(null).syntheseChasses();
    `);
    const lignes = lire<string[]>(
      `$("#o_syntheseChasses tr").map((i, tr) => $(tr).children().map((j, td) => $(td).text()).get().join("|")).get()`,
    );
    expect(lignes[0]!).toBe(
      "Heure d'impact|Chasses|TdC chassé|TdC / h|JSN / h|Unités mises en chasse",
    );
    // chasse 12 : 100 000 cm² en 4 h
    const nb = (s: string) => Number(s.replace(/\D/g, "")),
      cellules = lignes.map((l) => l.split("|")),
      c12 = cellules.find((c) => nb(c[2]!) == 100000)!;
    expect(nb(c12[3]!)).toBe(25000);
    expect(c12[3]!).not.toContain("~");
    // pertes estimées avec l'armée enregistrée : même calcul que SimulationChasse
    const attendu = lire<number>(`(() => {
      let d = SimulationChasse.difficulte(1000000, 100000), a = SimulationChasse.attaqueArmee(unite, 10);
      return Math.round(SimulationChasse.pertes(a / d, d, 8).AVG / 4);
    })()`);
    expect(nb(c12[4]!)).toBe(attendu);
    expect(c12[4]!).toContain("≈");
    // chasse 13 : pas lancée d'ici, durée estimée (comme si elle partait maintenant), marquée ~
    const c13 = cellules.find((c) => nb(c[2]!) == 50000)!;
    expect(c13[3]!).toMatch(/^~/);
    const duree = lire<number>(`SimulationChasse.duree(1000000, 50000, 8)`);
    expect(nb(c13[3]!)).toBe(Math.round((50000 / duree) * 3600));
    expect(nb(c13[4]!)).toBeGreaterThan(0);
    // texte copié
    lire(`$("#o_copierSynthese").trigger("click")`);
    const copie = lire<string>(`window.copie`);
    const lignesCopie = copie.split("\n");
    expect(lignesCopie.length).toBe(3); // deux groupes + total
    // débits seulement quand la durée est connue : chasse 12 oui, chasse 13 et le total non
    expect(lignesCopie[0]).toContain("25 000 cm²/h");
    expect(lignesCopie[0]).toContain("JSN/h perdues");
    expect(lignesCopie[1]).not.toContain("cm²/h");
    expect(lignesCopie[2]).not.toContain("cm²/h");
  });

  test("armée d'après les noms du jeu, apostrophes comprises", () => {
    const armee = lire<number[]>(
      `PageRessource._armeeDepuisNoms({ "Jeunes Soldates Naines": 10, "Artilleuses d'élites": 2, "Tanks d’élites": 1, "Inconnues": 5 })`,
    );
    expect(armee[0]).toBe(10);
    expect(armee[8]).toBe(2);
    expect(armee[11]).toBe(1);
    expect(armee.reduce((s, n) => s + n, 0)).toBe(13);
  });
});

describe("bouton « Annuler toutes les chasses »", () => {
  test("compte les chasses que le jeu propose encore d'annuler (ses liens), rien sans lien", () => {
    lire(`
      $("#o_annulerChasses").parent().remove();
      $("#boite_tdc").append("<div><span id='chasse_14'></span>- Vos chasseuses vont conquérir 10 cm² <a href='Ressources.php?annuler=14'>Annuler</a></div>");
      new PageRessource(null).boutonAnnulerChasses();
    `);
    expect(lire(`$("#o_annulerChasses").text()`)).toBe("Annuler toutes les chasses (1)");
    lire(`
      $("#o_annulerChasses").parent().remove();
      $("#boite_tdc a[href*='annuler=']").remove();
      new PageRessource(null).boutonAnnulerChasses();
    `);
    expect(lire(`$("#o_annulerChasses").length`)).toBe(0);
  });
});

describe("partage depuis une autre page (boîte Chasse)", () => {
  test("partagerChassesDe : lit les chasses d'une page Ressources reçue et publie les groupes", () => {
    const html = lire<string>(`document.body.innerHTML`);
    lire(`
      window.partages = null;
      PartageChasses.partager = (groupes) => { window.partages = groupes; };
      PageRessource.partagerChassesDe(${JSON.stringify("<html><body>")} + document.body.innerHTML + "</body></html>");
    `);
    const groupes = lire(`window.partages && window.partages.map((g) => [g.terrain, g.unites])`);
    expect(groupes.length).toBe(2);
    expect(groupes[0][0]).toBe(100000);
    expect(groupes[0][1]).toContain("Jeunes Soldates Naines");
    expect(groupes[1][0]).toBe(50000);
    expect(html).toContain("chasse_12");
  });
});
