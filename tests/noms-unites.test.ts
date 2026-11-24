import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { creerPage } from "./harnais";

/**
 * Noms d'unités écrits par le jeu : il a écrit « d’élite », « d'élite » puis
 * « d’Élite » selon les pages et les dates (Grim, 24/11/2026 : ses unités
 * d'élite manquaient au lanceur de chasses, lues au caractère près). Tout nom
 * lu dans une page passe par Utils.indexUnite (casse, accents, apostrophe et
 * pluriel ignorés). Armées inventées.
 */
/** Listes d'unités de content.js, sans lancer son démarrage. */
function listesUnites() {
  const contenu = readFileSync(join(__dirname, "..", "public", "js", "content.js"), "utf8");
  return ["NOM_UNITE", "NOM_UNITES", "VIE_UNITE"]
    .map((nom) => {
      const debut = contenu.indexOf(`const ${nom} = [`);
      return "var " + contenu.slice(debut + 6, contenu.indexOf("];", debut) + 2);
    })
    .join("\n");
}
const page = creerPage(
  [
    "js/lib/globalize_0.1.1.js",
    "js/lib/globalize-locale-fr.js",
    "js/lib/moment-duration-format.js",
    "js/lib/jquery-ui_1.12.1.js",
    "js/lib/datatables_1.10.16.js",
    "js/class/Utils.js",
    "js/class/Parametre.js",
    "js/class/Joueur.js",
    "js/class/Armee.js",
    "js/class/Combat.js",
    "js/class/SimulationChasse.js",
    "js/class/TroupesDehors.js",
    "js/page/PartageChasses.js",
    "js/page/Ressource.js",
    "js/page/Armee.js",
    "js/page/Attaquer.js",
    "js/page/Reine.js",
    "js/class/Chasse.js",
    "js/class/AttaqueLancee.js",
  ],
  `var chrome = { runtime: { getManifest: () => ({ version: "0" }), getURL: (p) => p } };
   var Horloge = { serveur: () => moment(), maintenant: () => Date.now() };
   ${listesUnites()}`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);

describe("Utils.indexUnite", () => {
  test("toutes les écritures du jeu d'une unité d'élite donnent son rang", () => {
    const cas: [string, number][] = [
      ["Ouvrière", 0],
      ["Ouvrières", 0],
      ["Jeune Soldate Naine", 1],
      ["Jeunes Soldates Naines", 1],
      ["Naine d’Elite", 3],
      ["Naine d’Élite", 3],
      ["Naines d'Élites", 3],
      ["Concierge d’élite", 7],
      ["Artilleuse d’Élite", 9],
      ["Soldate d’élite", 10],
      ["Soldate d’Élite", 10],
      ["SOLDATE D'ÉLITE", 10],
      ["  Soldates   d’Élites ", 10],
      ["Soldate", 5],
      ["Tank d’Élite", 12],
      ["Tueuses d’Élites", 14],
      ["Tueuse", 13],
      ["Consommation Journalière", -1],
      ["Unités", -1],
      ["", -1],
    ];
    for (const [nom, rang] of cas)
      expect([nom, lire(`Utils.indexUnite(${JSON.stringify(nom)})`)]).toEqual([nom, rang]);
  });

  test("le nom entier, pas un nom contenu dans une phrase", () => {
    expect(lire(`Utils.indexUnite("Les Soldates d'Elites, la crème de la crème")`)).toBe(-1);
    expect(lire(`Utils.indexUnite("Soldate et Tank")`)).toBe(-1);
  });
});

// ligne de la garnison comme le jeu l'écrit avec le Compte+ (page Armée)
const ligne = (nom: string, dome: number, loge: number) =>
  `<tr align="center"><td><div class="pas_sur_telephone">${nom}</div><div class="que_sur_telephone">X</div></td><td colspan="3"></td>` +
  `<td></td><td><span class="cliquable">${dome.toLocaleString("fr-FR")}</span></td><td></td>` +
  `<td></td><td><span class="cliquable">${loge.toLocaleString("fr-FR")}</span></td><td></td></tr>`;
const pageArmee = (lignes: string) =>
  `<table class="simulateur"><tr align="center"><td><div class="pas_sur_telephone">Unités</div></td></tr>${lignes}</table>`;

describe("garnison de la page Armée (lanceur de chasses, Multi-flood, replacement)", () => {
  test("« d’Élite » : les unités d'élite sont comptées", () => {
    const html = pageArmee(
      ligne("Jeune Soldate Naine", 1000, 200) +
        ligne("Naine d’Élite", 30, 0) +
        ligne("Soldate d’Élite", 0, 450) +
        ligne("Tueuse d’Élite", 12, 3),
    );
    const unite = lire<number[]>(`new Armee().chargeData(${JSON.stringify(html)}).unite`);
    expect(unite).toEqual([1200, 0, 30, 0, 0, 0, 0, 0, 0, 450, 0, 0, 0, 15]);
  });

  test("une ligne de troupes au nom inconnu est notée dans le journal", () => {
    lire(`localStorage.removeItem("fzzz_journal"); Journal.installer()`);
    const html = pageArmee(ligne("Garde d’Élite", 5, 5));
    lire(`new Armee().chargeData(${JSON.stringify(html)})`);
    // niveau erreur : le journal part dans le fichier du mainteneur ce jour-là
    expect(
      lire(`Journal.entrees().filter((e) => /Garde d’Élite/.test(e.m)).map((e) => e.n)`),
    ).toEqual(["erreur"]);
  });
});

/** Écritures d'un nom de NOM_UNITE : celles déjà vues dans le jeu et les plus probables ensuite. */
const ecritures = (nom: string) => [
  nom,
  nom.replace(/d’[ée]lite|d’Elite/i, "d’Élite"),
  nom.replace(/d’[ée]lite|d’Elite/i, "d'élite"),
  nom.toUpperCase(),
  nom.replace(/’/g, "`"),
  nom.replace(/’/g, "‘"),
  nom.replace(/’/g, "ʼ"),
  nom.replace(/’/g, "´"),
  nom.replace(/(\S+)/g, "$1s"),
  nom.replace(/ /g, "\u00a0"),
  nom.replace(/ /g, "  "),
  nom.normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
];
const NOMS = lire<string[]>(`NOM_UNITE`);

describe("chaque lecture, pour toutes les écritures d'un nom d'unité", () => {
  test("nom seul (indexUnite) et nom dans un texte (uniteDepuisLibelle)", () => {
    const faux: string[] = [];
    NOMS.forEach((nom, rang) => {
      for (const e of ecritures(nom)) {
        if (lire(`Utils.indexUnite(${JSON.stringify(e)})`) != rang) faux.push(`indexUnite ${e}`);
        if (
          rang &&
          lire(`Utils.uniteDepuisLibelle(${JSON.stringify(`Troupes : 1 000 ${e}.`)})`) != rang
        )
          faux.push(`uniteDepuisLibelle ${e}`);
      }
    });
    expect(faux).toEqual([]);
  });

  test("constructeur d'Armee (armée par lieu de la page Armée, page d'attaque) et texte d'un RC (parseArmee)", () => {
    const faux: string[] = [];
    NOMS.slice(1).forEach((nom, u) => {
      for (const e of ecritures(nom)) {
        if (lire(`new Armee({ unite: { ${JSON.stringify(e)}: 7 } }).unite[${u}]`) != 7)
          faux.push(`Armee ${e}`);
        if (
          lire(
            `(() => { let a = new Armee(); a.parseArmee(${JSON.stringify(`1 000 ${e}`)}); return a.unite[${u}]; })()`,
          ) != 1000
        )
          faux.push(`parseArmee ${e}`);
      }
    });
    expect(faux).toEqual([]);
  });

  test("Statistiques et replacement de la page Armée : armée par lieu avec « d’Élite »", () => {
    // signalé le 24/11/2026 : les unités d'élite manquaient encore aux statistiques
    const html = pageArmee(
      ligne("Jeune Soldate Naine", 1000, 200) +
        ligne("Naine d’Élite", 30, 0) +
        ligne("Soldate d’Élite", 0, 450) +
        ligne("Tueuse d’Élite", 12, 3),
    );
    const lieux = lire<{ dome: number[]; loge: number[]; vie: number }>(`(() => {
      let l = PageArmee.lieuxDe($(${JSON.stringify(html)}));
      return { dome: l.dome.unite, loge: l.loge.unite, vie: l.tdc.getBaseVie() + l.dome.getBaseVie() + l.loge.getBaseVie() };
    })()`);
    expect(lieux.dome).toEqual([1000, 0, 30, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12]);
    expect(lieux.loge).toEqual([200, 0, 0, 0, 0, 0, 0, 0, 0, 450, 0, 0, 0, 3]);
    const [, v1, , v3, , , , , , , v10, , , , v14] = lire<number[]>(`VIE_UNITE`);
    expect(lieux.vie).toBe(1200 * v1! + 30 * v3! + 450 * v10! + 15 * v14!);
  });

  test("page d'attaque : armée du Lanceur de Flood et de ses statistiques", () => {
    lire(
      `document.body.innerHTML = "<table id='tabChoixArmee'><tr><td>Jeune Soldate Naine</td><td>100</td><td>0</td><td>0</td><td><input id='unite1' value='100'></td></tr><tr><td>Tank d’Élite</td><td>4</td><td>0</td><td>0</td><td><input id='unite14' value='4'></td></tr></table>"`,
    );
    expect(lire(`new Armee({ unite: PageAttaquer.prototype.extraitArmee() }).unite`)).toEqual([
      100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0,
    ]);
  });
});

describe("un nom inconnu lu dans une page est noté dans le journal (erreur, envoyée au fichier du mainteneur)", () => {
  const notes = (motif: string) =>
    lire<{ n: string; d: string }[]>(
      `Journal.entrees().filter((e) => e.m.includes(${JSON.stringify(motif)})).map((e) => ({ n: e.n, d: e.d }))`,
    );
  const vider = () => lire(`localStorage.removeItem("fzzz_journal"); Journal.installer()`);

  test("garnison par lieu, page d'attaque, chasses, pontes, XP des rapports", () => {
    vider();
    lire(`PageArmee.lieuxDe($(${JSON.stringify(pageArmee(ligne("Garde Ʃ", 5, 5)))}))`);
    lire(
      `document.body.innerHTML = "<table id='tabChoixArmee'><tr><td>Garde Ω</td><td>1</td><td>0</td><td>0</td><td><input id='unite3' value='1'></td></tr></table>"; PageAttaquer.prototype.extraitArmee()`,
    );
    lire(`PageRessource._armeeDepuisNoms({ "Garde ß": 3 })`);
    lire(
      `Utils.pontesReine($("<div><table class='tableau_leger'><tr><td>Unité</td><td>reste(60, 'ponte_1')</td></tr><tr><td>12 Garde Ŧ</td><td></td><td></td><td><span id='ponte_1'></span></td></tr></table></div>"))`,
    );
    lire(
      `(() => { let c = Object.create(Chasse.prototype); c._rc = "x - 5 Gardes Ŋ sont devenues des Gardes"; c._xp = new Array(14).fill(0); c.ajouteXP(new Armee()); })()`,
    );
    for (const nom of ["Garde Ʃ", "Garde Ω", "Garde ß", "Garde Ŧ", "Gardes Ŋ"])
      expect([nom, notes(nom).map((n) => n.n)]).toEqual([nom, ["erreur"]]);
    // le code des caractères : une autre apostrophe ou lettre ne se voit pas à l'œil
    expect(notes("Garde Ω").map((n) => n.d)).toEqual(["Ω U+03A9"]);
  });

  test("troupes d'une attaque en cours (« Mes attaques en cours », page Armée)", () => {
    vider();
    const nom = lire<string>(`NOM_UNITE[12]`);
    expect(lire(`AttaqueLancee.uniteNatif("3 Gardes Ж, 2 Tanks d’Élites et 5 Tanks")`)).toEqual({
      [nom]: 2,
      [lire<string>(`NOM_UNITE[11]`)]: 5,
    });
    expect(notes("Gardes Ж").map((n) => n.n)).toEqual(["erreur"]);
  });

  test("un nom connu, l'en-tête « Unités » ou une ligne sans troupes ne sont pas notés", () => {
    vider();
    lire(`PageArmee.lieuxDe($(${JSON.stringify(pageArmee(ligne("Soldate d’Élite", 5, 5)))}))`);
    lire(`new Armee().chargeData(${JSON.stringify(pageArmee(ligne("Tank d’élite", 1, 1)))})`);
    expect(lire(`Journal.entrees().filter((e) => /unité/.test(e.m)).length`)).toBe(0);
  });
});

describe("autres lectures de noms d'unités", () => {
  test("chasses en cours de la page Ressources", () => {
    expect(
      lire(
        `PageRessource._armeeDepuisNoms({ "Naines d’Élites": 7, "Tanks d’Élites": 2, "Ouvrières": 9 })`,
      ),
    ).toEqual([0, 0, 7, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0]);
  });

  test("formulaire « Déplacer » de la page Armée : l'option de l'unité d'élite", () => {
    lire(
      `document.body.innerHTML = "<select id='ChoixUnite'><option value='unite1'>Jeune Soldate Naine</option><option value='unite9'>Soldate d’Élite</option></select>"`,
    );
    // rang 9 dans Armee.unite : Soldate d'élite
    expect(lire(`PageArmee.valeurUnite(9)`)).toBe("unite9");
  });

  test("page d'attaque : troupes disponibles rangées sous le nom de l'extension", () => {
    lire(
      `document.body.innerHTML = "<table id='tabChoixArmee'><tr><td>Soldate d’Élite</td><td>3</td><td>0</td><td>0</td><td><input id='unite9'></td></tr></table>"`,
    );
    expect(lire(`PageAttaquer.unitesDisponibles()`)).toEqual({
      [lire<string>(`NOM_UNITE[10]`)]: { id: "unite9", nb: 3 },
    });
  });
});

/**
 * Tout nom d'unité lu dans une page passe par Utils (indexUnite, uniteLue,
 * uniteDepuisLibelle, le constructeur d'Armee) : une nouvelle écriture du jeu
 * se corrige dans Utils.texteUnite. Ce test trouve les comparaisons au
 * caractère près, sous toutes les formes déjà rencontrées (24/11/2026 : le
 * constructeur d'Armee, avec hasOwnProperty, avait échappé à la 1re version).
 */
const COMPARAISONS_INTERDITES: [string, RegExp][] = [
  [
    // aussi sur une copie de la liste (`[...NOM_UNITES, ...NOM_UNITE].findIndex(…)`)
    "recherche dans NOM_UNITE",
    /NOM_UNITES?\b[^;\n]*?\.(indexOf|lastIndexOf|findIndex|find|includes|some|every|filter)\(/,
  ],
  ["égalité avec un nom de NOM_UNITE", /[=!]==?\s*NOM_UNITES?\[|NOM_UNITES?\[[^\]]*\]\s*[=!]==?/],
  [
    "clé NOM_UNITE cherchée dans un objet",
    /hasOwnProperty\(\s*NOM_UNITES?\[|NOM_UNITES?\[[^\]]*\]\s+in\s/,
  ],
  // objet lu par une clé de NOM_UNITE (écrire une clé reste permis : `x[NOM_UNITE[i]] = …`)
  ["objet lu par un nom de NOM_UNITE", /\w\[NOM_UNITES?\[[^\]]*\]\](?!\s*=[^=])/],
  [
    "nom d'unité écrit en dur et comparé",
    /[=!]==?\s*["'`][^"'`]*(Soldate|Tank|Tueuse|Artilleuse|Concierge|Naine)|["'`][^"'`]*(Soldate|Tank|Tueuse|Artilleuse|Concierge|Naine)[^"'`]*["'`]\s*[=!]==?|\.(indexOf|includes|startsWith|endsWith|split)\(\s*["'`][^"'`]*(Soldate|Tank|Tueuse|Artilleuse|Concierge|Naine)/,
  ],
  ["CLES_UNITES hors de Utils.js", /\bCLES_UNITES\b/],
];

test("aucun nom d'unité lu dans une page n'est comparé au caractère près", () => {
  const racine = join(__dirname, "..", "public", "js"),
    fichiers = [
      "content.js",
      ...["class", "page", "boite"].flatMap((d) =>
        readdirSync(join(racine, d))
          .filter((f) => f.endsWith(".js"))
          .map((f) => join(d, f)),
      ),
    ],
    trouves: string[] = [];
  for (const f of fichiers) {
    const lignes = readFileSync(join(racine, f), "utf8").split("\n");
    lignes.forEach((ligne, i) => {
      if (/^\s*(\/\/|\*)/.test(ligne)) return;
      for (const [quoi, motif] of COMPARAISONS_INTERDITES)
        if (
          motif.test(ligne) &&
          !(quoi.startsWith("CLES_UNITES") && f == join("class", "Utils.js"))
        )
          trouves.push(`${f}:${i + 1} ${quoi} : ${ligne.trim()}`);
    });
  }
  expect(trouves).toEqual([]);
});

test("le filet attrape bien chaque forme déjà rencontrée", () => {
  const exemples = [
    `this._unite[NOM_UNITE.indexOf(label) - 1] += n;`,
    `if (o.textContent == NOM_UNITE[i + 1]) return;`,
    `if (parametres.unite.hasOwnProperty(NOM_UNITE[i + 1]))`,
    `this._unite[i] = parametres.unite[NOM_UNITE[i + 1]];`,
    `let r = [...NOM_UNITES, ...NOM_UNITE].findIndex((n) => n.toLowerCase() == nom);`,
    `if (nom === "Tank d’élite") x++;`,
  ];
  for (const e of exemples)
    expect([e, COMPARAISONS_INTERDITES.some(([, m]) => m.test(e))]).toEqual([e, true]);
  // une clé écrite avec le nom de l'extension reste permise
  expect(COMPARAISONS_INTERDITES.some(([, m]) => m.test(`unite[NOM_UNITE[i]] = n;`))).toBe(false);
});
