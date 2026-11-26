import { beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { creerPage } from "./harnais";

/**
 * Conseil sous « Bouclier Thoracique » du Laboratoire (demande du mainteneur,
 * 26/11/2026 : « l'affichage et le même calcul que ce qui était fait sur
 * optizzz »), méthode d'Optizzz (github.com/Achaak/Optizzz, MIT) : le niveau
 * suivant contre les unités que la Reine pondrait pendant le temps de repondre
 * les ouvrières qu'il coûte. Le cas de référence est celui des tests d'Optizzz
 * (2 560 ouvrières, Bouclier 5 → 6, 15 000 JSN et 1 282 SN).
 */
const CONTENT = readFileSync(join(import.meta.dir, "..", "public", "js", "content.js"), "utf8");
const constante = (nom: string) => new RegExp(`const ${nom} = \\[[^\\]]*\\];`).exec(CONTENT)![0];
const UNITES = [
  "NOM_UNITE",
  "NOM_UNITES",
  "TEMPS_UNITE",
  "COUT_UNITE",
  "VIE_UNITE",
  "ATT_UNITE",
  "DEF_UNITE",
];
const page = creerPage(
  [
    "js/class/Utils.js",
    "js/class/Armee.js",
    "js/class/ConseilBouclier.js",
    "js/page/Laboratoire.js",
  ],
  `${UNITES.map(constante).join("\n")}
   var monProfil = { niveauConstruction: [0, 0, 0, 10, 9], niveauRecherche: [9, 5], getTDP() { return 28; } };`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);
// la Reine du cas de référence : 2 560 ouvrières repondues en 7 235 s
const VITESSE = 7235 / (2560 * 60);
// armée dans l'ordre de NOM_UNITE sans l'ouvrière
const armee = (unites: Record<number, number>) =>
  Array.from({ length: 14 }, (_, i) => unites[i + 1] || 0);
const ARMEE = armee({ 1: 15000, 2: 1282 });
const calculer = (e: Record<string, unknown>) =>
  lire<any>(
    `ConseilBouclier.calculer(${JSON.stringify({ niveau: 5, ouvrieres: 2560, armee: ARMEE, vitesse: VITESSE, pondables: [1, 2, 3], ...e })})`,
  );
const verdict = (e: Record<string, unknown>) =>
  lire<string>(`ConseilBouclier.texteVerdict(${JSON.stringify(calculer(e))})`);
const espaces = (t: string) => t.replace(/[\s ]+/g, " ").trim();

describe("calcul (celui d'Optizzz)", () => {
  test("recherche contre la meilleure unité pondue pendant le temps de repondre les ouvrières", () => {
    const c = calculer({});
    expect(c.secondes).toBeCloseTo(7235);
    expect(c.base).toBe(132820);
    expect(c.gainRecherche).toBeCloseTo(13282);
    // 2 560 × 60 s ÷ 300 s : 512 JSN, 8 de vie × bonus du niveau 5 (+50 %)
    expect(c.meilleure).toMatchObject({ unite: 1, nombre: 512, gain: 6144 });
    expect(c.ecart).toBeCloseTo(13282 / 6144 - 1);
    // la recherche l'emporte dès 10 fois le gain de la meilleure unité
    expect(c.seuil).toBeCloseTo(61440);
    expect(verdict({})).toBe("Recherche préférable · +116 % de vie que la ponte");
  });

  test("toutes les unités qu'elle peut pondre, la meilleure d'abord ; sans unité possible, la recherche", () => {
    const c = calculer({ niveau: 0, pondables: [1, 8, 11] });
    // JSN 512 × 8 ; Tank ⌊153 600 ÷ 1 860⌋ = 82 × 35 ; Artilleuse 106 × 10
    expect(c.options.map((o: any) => [o.unite, o.nombre, o.gain])).toEqual([
      [1, 512, 4096],
      [11, 82, 2870],
      [8, 106, 1060],
    ]);
    // Concierge d'élite et Tank d'élite : les temps du jeu (1 560 s et 2 150 s)
    expect(
      calculer({ niveau: 0, pondables: [12, 7] }).options.map((o: any) => [
        o.unite,
        o.nombre,
        o.gain,
      ]),
    ).toEqual([
      [7, 98, 98 * 40],
      [12, 71, 71 * 50],
    ]);
    expect(calculer({ ouvrieres: 1 }).meilleure).toBeNull();
    expect(verdict({ ouvrieres: 1 })).toBe(
      "Recherche préférable : ce temps ne suffit à pondre aucune unité",
    );
  });

  test("ponte préférable, de combien ; un multiple à partir du triple ; à 5 % près, ils se valent", () => {
    // 3 000 JSN : 24 000 de vie de base, +2 400 contre +6 144
    expect(verdict({ armee: armee({ 1: 3000 }) })).toBe(
      "Ponte préférable · Jeunes Soldates Naines : +156 % de vie",
    );
    expect(verdict({ armee: armee({ 1: 100 }) })).toBe(
      "Ponte préférable · Jeunes Soldates Naines : 77 × plus de vie",
    );
    expect(verdict({ armee: armee({ 1: 1800 }) })).toBe(
      "Ponte préférable · Jeunes Soldates Naines : 4,3 × plus de vie",
    );
    // 61 440 de vie de base : exactement le gain des JSN
    expect(verdict({ armee: armee({ 1: 7680 }) })).toBe(
      "Recherche et ponte se valent (à 5 % près)",
    );
    expect(
      lire(
        `[ConseilBouclier.verdict(0.06), ConseilBouclier.verdict(-0.06), ConseilBouclier.verdict(0.05)]`,
      ),
    ).toEqual(["recherche", "ponte", "egal"]);
  });

  test("durée écrite comme Optizzz", () => {
    expect(
      lire(
        `[ConseilBouclier.duree(7235), ConseilBouclier.duree(2700), ConseilBouclier.duree(277200)]`,
      ),
    ).toEqual(["2 h 01", "45 min", "3 j 5 h"]);
  });
});

// lignes de la page Reine telles que le jeu les écrit (25/11/2026) : un
// prérequis manquant enlève le champ de quantité
const ligneReine = (nom: string, i: number, pondable: boolean, champ = pondable) =>
  `<tr class="ligneAmelioration"><td class="desciption_amelioration"><h2>${nom}</h2>
    <span id="armee_initial${i}" style="display:none">5608</span>
    ${pondable ? "" : `<a class="cliquable3 verificationNonOK">Caserne niveau 4</a>`}</td>
    <td class="cout_amelioration"><input type="hidden" name="typeUnite" value="unite${i}"/>${champ ? `<input type="tel" id="input_cout_nombre${i}"/>` : ""}</td></tr>`;
const REINE = `<table>${ligneReine("Ouvrière", 0, true).replace("input_cout_nombre0", "input_cout_nombre")}${ligneReine("Jeune Soldate Naine", 1, true)}${ligneReine("Soldate Naine", 2, true)}${ligneReine("Naine d’Elite", 3, false)}${ligneReine("Soldate", 5, false, true)}${ligneReine("Concierge", 6, true, false)}${ligneReine("Artilleuse", 7, true)}${ligneReine("Tank d’élite", 13, true)}</table>`;

describe("lectures des pages du jeu", () => {
  // Soldate : un prérequis manquant malgré un champ ; Concierge : sans champ
  test("unités à pondre : celles qui ont leur champ de quantité et aucun prérequis manquant, l'ouvrière exclue", () => {
    expect(lire(`ConseilBouclier.pondables(Utils.parseHtml(${JSON.stringify(REINE)}))`)).toEqual([
      1, 2, 8, 12,
    ]);
  });

  test("recherche du Bouclier en cours : le coût affiché part du niveau en file", () => {
    const depart = (html: string) =>
      lire<number>(`ConseilBouclier.niveauDepart(Utils.parseHtml(${JSON.stringify(html)}), 10)`);
    expect(
      depart(`<div id="centre"><strong>- Armes 12 terminé dans: <span>1h</span></strong></div>`),
    ).toBe(10);
    expect(
      depart(
        `<div id="centre"><strong>- Bouclier Thoracique 11 terminé dans: <span>1h</span></strong></div>`,
      ),
    ).toBe(11);
    expect(depart(`<div id="centre"></div>`)).toBe(10);
  });
});

// ligne « Bouclier Thoracique » du Laboratoire, comme le jeu l'écrit (24/11/2026)
const LABO = `<div id="centre"><table>
  <tr class="ligneAmelioration"><td class="desciption_amelioration"><h2>Technique de ponte</h2><span class="niveau_amelioration">niveau 9</span></td>
    <td class="cout_amelioration"><div class="ouvriere">0 </div></td></tr>
  <tr class="ligneAmelioration"><td class="desciption_amelioration"><h2>Bouclier Thoracique</h2> <span class="niveau_amelioration">niveau 5</span><br/>
    <div class="pas_sur_telephone">Le Bouclier Thoracique est une véritable armure.</div></td>
    <td class="cout_amelioration"><div class="ouvriere">2 560 </div><div class="nourriture">7 864 320 </div></td></tr>
</table></div>`;

describe("bloc « Conseil » de la ligne", () => {
  beforeEach(() =>
    lire(`(() => {
      localStorage.clear();
      document.body.innerHTML = ${JSON.stringify(LABO)};
      window.p = Object.create(PageLaboratoire.prototype);
      p._armee = new Armee(); p._armee.unite = ${JSON.stringify(ARMEE)}; p._armeeComplete = true;
      window.REINE = Utils.parseHtml(${JSON.stringify(REINE)});
    })()`),
  );
  const bloc = () => lire<string>(`$(".o_conseil").text()`);

  test("à la fin de la description, replié sur son verdict ; le détail du calcul dans le bloc", () => {
    const ligne = lire<any>(
      `(() => { let l = p.ligneBouclier(); return { niveau: l.niveau, ouvrieres: l.ouvrieres }; })()`,
    );
    expect(ligne).toEqual({ niveau: 5, ouvrieres: 2560 });
    lire(
      `(() => { monProfil.getTDP = () => Math.log(${VITESSE}) / Math.log(0.9); p.conseilBouclier(p.ligneBouclier(), true, REINE); })()`,
    );
    expect(
      lire(
        `[$(".o_conseil").parent().find("h2").text(), $(".o_conseil").prop("open"), $(".o_conseil").attr("data-verdict"), $(".o_conseil").length]`,
      ),
    ).toEqual(["Bouclier Thoracique", false, "recherche", 1]);
    expect(espaces(lire(`$(".o_conseil > summary").text()`))).toBe(
      "Conseil Recherche préférable · +116 % de vie que la ponte Détails",
    );
    expect(
      lire<[string, string][]>(
        `$(".o_conseilBarre").map((i, b) => [[$(b).find(".o_conseilBarreTete span").map((k, s) => s.textContent).get().join(" | "), $(b).find(".o_conseilPiste span")[0].style.width]]).get()`,
      ).map(([t, l]) => [espaces(t), l]),
    ).toEqual([
      ["Recherche niveau 6 | +13 282 points de vie", "100%"],
      ["ou 512 Jeunes Soldates Naines | +6 144 points de vie", `${(6144 / 13282) * 100}%`],
    ]);
    const texte = espaces(bloc());
    expect(texte).toContain(
      "La recherche coûte 2 560 ouvrières : les repondre prend 2 h 01, le temps de pondre 512 Jeunes Soldates Naines à la place.",
    );
    expect(texte).toContain(
      "La recherche l'emporte dès 61 440 points de vie de base dans l'armée ; la tienne en a 132 820.",
    );
    expect(texte).toContain("Repondre les ouvrières coûte aussi 12 800 nourriture");
    expect(texte).toContain("armée complète (page Reine");
    expect(
      lire(
        `$(".o_conseilUnites tbody tr").map((i, tr) => $(tr).children().map((k, td) => td.textContent).get().join(" | ")).get()`,
      ).map(espaces),
    ).toEqual([
      "Jeune Soldate Naine | 512 | +6 144 | +116 %",
      "Tank d’élite | 71 | +5 325 | +149 %",
      "Soldate Naine | 341 | +5 115 | +160 %",
      "Artilleuse | 106 | +1 590 | +735 %",
    ]);
    // gardé ouvert ou fermé par le joueur
    lire(`$(".o_conseil").prop("open", true)[0].dispatchEvent(new Event("toggle"))`);
    expect(lire(`localStorage.getItem("fzzz_conseilBouclierOuvert")`)).toBe("1");
    lire(`p.conseilBouclier(p.ligneBouclier(), true, REINE)`);
    expect(lire(`[$(".o_conseil").length, $(".o_conseil").prop("open")]`)).toEqual([1, true]);
  });

  test("description trop étroite (téléphone) : sur une ligne de toute la largeur, sous celle du Bouclier", () => {
    const place = (largeur: number) =>
      lire(`(() => {
        let l = p.ligneBouclier();
        l.$description[0].getBoundingClientRect = () => ({ width: ${largeur} });
        p.conseilBouclier(l, true, REINE);
        let $b = $(".o_conseil");
        return [$b.closest("td").attr("class") || "", $b.closest("td").attr("colspan") || "",
          $b.closest("tr").find("h2").text() || "dessous de " + $b.closest("tr").prev().find("h2").text(), $(".o_conseilLigne").length, $b.length];
      })()`);
    expect(place(115)).toEqual(["", "2", "dessous de Bouclier Thoracique", 1, 1]);
    // redessiné : une seule ligne ; assez large : dans la description, la ligne retirée
    expect(place(115)).toEqual(["", "2", "dessous de Bouclier Thoracique", 1, 1]);
    expect(place(500)).toEqual(["desciption_amelioration", "", "Bouclier Thoracique", 0, 1]);
  });

  test("ponte préférable : le bloc le dit, l'armée sous le seuil", () => {
    lire(
      `(() => { p._armee.unite = ${JSON.stringify(armee({ 1: 3000 }))}; p.conseilBouclier(p.ligneBouclier(), true, REINE); })()`,
    );
    expect(lire(`$(".o_conseil").attr("data-verdict")`)).toBe("ponte");
    expect(espaces(bloc())).toContain(
      "La recherche l'emporte dès 61 440 points de vie de base dans l'armée ; la tienne n'en a que 24 000.",
    );
  });

  test("garnison seule : la note le dit ; niveaux de ponte inconnus : pas de durée", () => {
    lire(`(() => {
      p._armeeComplete = false; monProfil.niveauConstruction = [0, 0, 0, -1, 9];
      p.conseilBouclier(p.ligneBouclier(), true, REINE);
      monProfil.niveauConstruction = [0, 0, 0, 10, 9];
    })()`);
    const texte = espaces(bloc());
    expect(texte).toContain(
      "garnison de la page Armée, troupes en chasse ou en attaque non comptées",
    );
    expect(texte).toContain(
      "La recherche coûte 2 560 ouvrières, le temps de pondre 512 Jeunes Soldates Naines",
    );
    expect(texte).toContain("vitesse de ponte inconnue");
  });

  test("ce qui manque plutôt qu'un calcul faux", () => {
    const manque = (js: string) => {
      lire(`(() => { ${js}; p.conseilBouclier(p.ligneBouclier(), ARMEE_LUE, PAGE_REINE); })()`);
      return [
        espaces(lire(`$(".o_conseil > summary").text()`)),
        lire(`$(".o_conseil").attr("data-verdict")`),
      ];
    };
    expect(
      manque(`window.ARMEE_LUE = false; window.PAGE_REINE = REINE; p._armeeComplete = false`),
    ).toEqual([
      "Conseil Armée inconnue : ni la page Reine ni la page Armée n'ont pu être lues.",
      undefined,
    ]);
    expect(manque(`window.ARMEE_LUE = true; p._armee.unite = new Array(14).fill(0)`)[0]).toBe(
      "Conseil Aucune unité dans ton armée : rien à renforcer pour l'instant.",
    );
    expect(manque(`window.PAGE_REINE = null; p._armee.unite = ${JSON.stringify(ARMEE)}`)[0]).toBe(
      "Conseil Unités à pondre inconnues : la page Reine n'a pas pu être lue.",
    );
    // une page de connexion à la place de la page Reine
    expect(
      manque(
        `window.PAGE_REINE = Utils.parseHtml("<div class='boite_connexion_titre'>Connexion</div>")`,
      )[0],
    ).toBe("Conseil Unités à pondre inconnues : la page Reine n'a pas pu être lue.");
  });
});

// tcaste, ncaste, vcaste, acaste et dcaste du util.js du jeu (page Reine
// enregistrée le 24/11/2026), dans l'ordre du jeu : les 12 premières unités de
// la page Reine, puis le Tank d'élite et le Concierge d'élite, ajoutés après
const JEU = {
  noms: [
    "Jeune Soldate Naine",
    "Soldate Naine",
    "Naine d’Elite",
    "Jeune Soldate",
    "Soldate",
    "Concierge",
    "Artilleuse",
    "Artilleuse d’élite",
    "Soldate d’élite",
    "Tank",
    "Tueuse",
    "Tueuse d’élite",
    "Tank d’élite",
    "Concierge d’élite",
  ],
  TEMPS_UNITE: [300, 450, 570, 740, 1000, 1410, 1440, 1520, 1450, 1860, 2740, 2740, 2150, 1560],
  COUT_UNITE: [16, 20, 26, 30, 36, 70, 30, 34, 44, 100, 80, 90, 100, 70],
  VIE_UNITE: [8, 10, 13, 16, 20, 30, 10, 12, 27, 35, 50, 55, 50, 40],
  ATT_UNITE: [3, 5, 7, 10, 15, 1, 30, 35, 24, 55, 50, 55, 80, 1],
  DEF_UNITE: [2, 4, 6, 9, 14, 25, 15, 18, 23, 1, 50, 55, 1, 35],
};

describe("caractéristiques des unités : celles du jeu", () => {
  for (const nom of ["TEMPS_UNITE", "COUT_UNITE", "VIE_UNITE", "ATT_UNITE", "DEF_UNITE"] as const)
    test(`${nom} suit le script du jeu, unité par unité`, () => {
      const ecarts = JEU.noms
        .map((n, k) => {
          const u = lire<number>(`Utils.indexUnite(${JSON.stringify(n)})`);
          const nous = lire<number>(`${nom}[${u}]`);
          return nous == JEU[nom][k] ? "" : `${n} : ${nous} au lieu de ${JEU[nom][k]}`;
        })
        .filter(Boolean);
      expect(ecarts).toEqual([]);
    });
  test("ouvrière : 60 s et 5 de nourriture (trouver_max_ponte du jeu)", () => {
    expect(lire(`[TEMPS_UNITE[0], COUT_UNITE[0]]`)).toEqual([60, 5]);
  });
});
