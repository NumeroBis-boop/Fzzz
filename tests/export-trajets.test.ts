import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

// Carte de l'alliance, « Exporter en Excel » : coordonnées des membres affichés,
// temps de trajet entre eux et formule, dans un .xlsx écrit sans bibliothèque
// (Classeur.js). Joueurs inventés.
const page = creerPage(
  [
    "js/class/Utils.js",
    "js/class/Parametre.js",
    "js/class/Joueur.js",
    "js/class/Classeur.js",
    "js/page/Alliance.js",
  ],
  `var TOAST_SUCCESS = { type: "succes" }, TOAST_ERROR = { type: "erreur" }, TOAST_INFO = {}, TOAST_WARNING = { type: "attention" };
   var METHODE_FLOOD = ["Standard", "Optimisée", "Uniforme", "Dégressive"], AFFECTATION_RESSOURCE = [], RATIO_RECOLTE = {};
   var NOM_UNITE = ["Ouvrière", "Jeune Soldate Naine"];
   var Horloge = { serveur: () => moment("2026-11-16T18:30:00") };
   var TOASTS = [], FICHIERS = [];
   var Clipboard = function () { this.on = () => {}; };
   $.toast = (o) => TOASTS.push(o);`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);

const MEMBRES = [
  { pseudo: "Zorro", x: 10, y: 5, id: 3, terrain: 100 },
  { pseudo: "alpha", x: 12, y: 5, id: 1, terrain: 200 },
  { pseudo: "Émile", x: 40, y: 30, id: 2, terrain: 300 },
];

/** Fichiers d'un zip, relus d'après son répertoire central, CRC vérifié. */
function dezipper(source: ArrayLike<number>) {
  const octets = Uint8Array.from(source),
    vue = new DataView(octets.buffer),
    fin = octets.length - 22,
    texte = new TextDecoder(),
    fichiers = new Map<string, string>();
  expect(vue.getUint32(fin, true)).toBe(0x06054b50);
  let p = vue.getUint32(fin + 16, true);
  for (let k = vue.getUint16(fin + 10, true); k > 0; k--) {
    expect(vue.getUint32(p, true)).toBe(0x02014b50);
    const longueur = vue.getUint16(p + 28, true),
      nom = texte.decode(octets.subarray(p + 46, p + 46 + longueur)),
      local = vue.getUint32(p + 42, true),
      taille = vue.getUint32(p + 24, true);
    expect(vue.getUint16(p + 10, true)).toBe(0); // sans compression
    expect(vue.getUint32(local, true)).toBe(0x04034b50);
    expect(vue.getUint32(local + 14, true)).toBe(vue.getUint32(p + 16, true));
    const debut = local + 30 + vue.getUint16(local + 26, true) + vue.getUint16(local + 28, true),
      donnees = octets.subarray(debut, debut + taille);
    expect(Bun.hash.crc32(donnees)).toBe(vue.getUint32(p + 16, true));
    fichiers.set(nom, texte.decode(donnees));
    p += 46 + longueur + vue.getUint16(p + 30, true) + vue.getUint16(p + 32, true);
  }
  expect(p).toBe(fin);
  return {
    noms: [...fichiers.keys()],
    partie: (nom: string) => fichiers.get(nom) ?? "",
  };
}

const desechapper = (t: string) =>
  t
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

type Cellule = { s?: string; f?: string; v?: number; texte?: string };

/** Cellules d'une feuille : style, formule, valeur, texte. */
function cellules(xml: string) {
  const toutes = new Map<string, Cellule>();
  for (const m of xml.matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>(.*?)<\/c>)/g)) {
    const contenu = m[3] ?? "",
      s = (m[2] ?? "").match(/ s="(\d+)"/)?.[1],
      f = contenu.match(/<f>(.*?)<\/f>/)?.[1],
      v = contenu.match(/<v>(.*?)<\/v>/)?.[1],
      t = contenu.match(/<t[^>]*>(.*?)<\/t>/)?.[1];
    toutes.set(m[1] ?? "", {
      ...(s !== undefined && { s }),
      ...(f !== undefined && { f: desechapper(f) }),
      ...(v !== undefined && { v: Number(v) }),
      ...(t !== undefined && { texte: desechapper(t) }),
    });
  }
  return {
    de: (ref: string): Cellule => toutes.get(ref) ?? {},
    toutes: () => [...toutes.entries()],
    textes: () => [...toutes.values()].map((c) => c.texte),
  };
}

/** Calcule une formule de la feuille comme le tableur, avec ses cellules. */
function evaluer(formule: string, valeurs: Record<string, number>) {
  const js = formule
    .replace(/\$?([A-Z]+)\$?(\d+)/g, (_, col, ligne) => `(${valeurs[col + ligne]})`)
    .replace(/^ROUND\((.*),0\)/, "Math.round($1)")
    .replace(/EXP/g, "Math.exp")
    .replace(/SQRT/g, "Math.sqrt")
    .replace(/\^/g, "**");
  return Function(`return ${js}`)() as number;
}

type Export = {
  toasts: { type: string; text: string }[];
  fichiers: { nom: string; octets: number[] }[];
};

function exporter(membres: object[] | null, masques: string[] = []) {
  return lire<Export>(`(() => {
    localStorage.clear();
    TOASTS.length = 0;
    FICHIERS.length = 0;
    document.body.innerHTML = "<span id='tag_alliance'>TAG</span>";
    ${
      membres
        ? `localStorage.setItem("outiiil_carteAlliance_S5_TAG", JSON.stringify({ timestamp: moment("2026-11-16T17:05:00").valueOf(), members: ${JSON.stringify(membres)} }));`
        : ""
    }
    localStorage.setItem("outiiil_carteFiltres_S5_TAG", JSON.stringify({ joueurs: ${JSON.stringify(masques)} }));
    Classeur.telecharger = (octets, nom) => FICHIERS.push({ nom, octets: Array.from(octets) });
    const p = Object.create(PageAlliance.prototype);
    p._gradesNatifs = {};
    p._carteMembres = null;
    p._exporterCarteExcel();
    return { toasts: TOASTS.map((t) => ({ type: t.type, text: t.text })), fichiers: FICHIERS.slice() };
  })()`);
}

/** Le seul fichier d'un export, dézippé. */
function fichierUnique(e: Export) {
  expect(e.fichiers.length).toBe(1);
  return dezipper(e.fichiers[0]?.octets ?? []);
}

describe("Classeur : fichier .xlsx sans bibliothèque", () => {
  test("CRC-32 des zip et lettres des colonnes", () => {
    expect(lire("Classeur.crc32(new TextEncoder().encode('123456789'))")).toBe(0xcbf43926);
    expect(lire("[1, 26, 27, 52, 53, 702, 703].map((n) => Classeur.colonne(n))")).toEqual([
      "A",
      "Z",
      "AA",
      "AZ",
      "BA",
      "ZZ",
      "AAA",
    ]);
  });
  test("parties du format Office Open XML, textes échappés", () => {
    const xlsx = dezipper(
      lire(
        `Array.from(Classeur.xlsx([{ nom: "A & B", lignes: [["Tom & \\"Jerry\\" <3", 1.5, null, { v: "x", s: "gras" }]] }]))`,
      ),
    );
    expect(xlsx.noms.sort()).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/_rels/workbook.xml.rels",
      "xl/styles.xml",
      "xl/workbook.xml",
      "xl/worksheets/sheet1.xml",
    ]);
    expect(xlsx.partie("[Content_Types].xml")).toContain('PartName="/xl/worksheets/sheet1.xml"');
    expect(xlsx.partie("xl/workbook.xml")).toContain(
      '<sheet name="A &amp; B" sheetId="1" r:id="rId1"/>',
    );
    expect(xlsx.partie("xl/workbook.xml")).toContain('<calcPr fullCalcOnLoad="1"/>');
    expect(xlsx.partie("xl/_rels/workbook.xml.rels")).toContain(
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
    );
    expect(cellules(xlsx.partie("xl/worksheets/sheet1.xml")).toutes()).toEqual([
      ["A1", { texte: 'Tom & "Jerry" <3' }],
      ["B1", { v: 1.5 }],
      ["D1", { s: "1", texte: "x" }],
    ]);
    // un caractère de contrôle rendrait le fichier illisible
    expect(lire(`Classeur.echapper("a\\u0001b\\u000bc")`)).toBe("abc");
  });
});

describe("Joueur.tempsTrajet : la formule des temps de trajet", () => {
  test("arrondi à la seconde, comme getTempsParcours et getTempsParcours2", () => {
    // d = √2 en VA 10 : 0:14:56
    expect(lire("Joueur.tempsTrajet({ x: 0, y: 0 }, { x: 1, y: 1 }, 10)")).toBe(896);
    const attendu = Math.round(Math.pow(0.9, 7) * 637200 * (1 - Math.exp(-5 / 350)));
    expect(lire("Joueur.tempsTrajet({ x: 0, y: 0 }, { x: 3, y: 4 }, 7)")).toBe(attendu);
    const joueur = "new Joueur({ x: 3, y: 4, niveauRecherche: [0, 0, 0, 0, 0, 0, 7] })";
    expect(lire(`${joueur}.getTempsParcours2({ x: 0, y: 0 })`)).toBe(attendu);
    expect(lire(`${joueur}.getTempsParcours(0, 0)`)).toBe(attendu);
  });
});

describe("Carte de l'alliance : « Exporter en Excel »", () => {
  test("le bouton suit « Exporter pour le forum » ; sans carte chargée, un message et pas de fichier", () => {
    const bouton = lire<{ texte: string; avant: string }>(`(() => {
      localStorage.clear();
      document.body.innerHTML = "<span id='tag_alliance'>TAG</span><div id='alliance'></div>";
      // le profil du joueur, lu par sa ligne « ta fourmilière » de la Carte
      window.monProfil = { pseudo: "Moi", x: 0, y: 0, niveauRecherche: [] };
      Object.assign(Object.create(PageAlliance.prototype), { _gradesNatifs: {} }).carte();
      return { texte: $("#o_carteAllianceExportExcel").text(), avant: $("#o_carteAllianceExportExcel").prev().attr("id") };
    })()`);
    expect(bouton).toEqual({ texte: "Exporter en Excel", avant: "o_carteAllianceExportForum" });
    expect(exporter(null)).toEqual({
      toasts: [
        {
          type: "attention",
          text: "Charge d'abord la carte avant de pouvoir l'exporter en Excel.",
        },
      ],
      fichiers: [],
    });
    expect(exporter(MEMBRES, ["Zorro", "alpha", "Émile"]).toasts).toEqual([
      { type: "attention", text: "Aucun membre affiché : élargis les filtres avant d'exporter." },
    ]);
  });

  test("trois feuilles : coordonnées, matrice des trajets en VA 10, formule et source", () => {
    const e = exporter(MEMBRES);
    expect(e.toasts).toEqual([
      {
        type: "succes",
        text: "Fichier Excel créé : 3 membres, vitesse d'attaque 10 (modifiable dans la feuille « Trajets »).",
      },
    ]);
    expect(e.fichiers.map((f) => f.nom)).toEqual(["trajets-TAG-2026-11-16.xlsx"]);
    const xlsx = fichierUnique(e);
    expect(xlsx.partie("xl/workbook.xml")).toContain(
      '<sheet name="Coordonnées" sheetId="1" r:id="rId1"/><sheet name="Trajets" sheetId="2" r:id="rId2"/><sheet name="Formule" sheetId="3" r:id="rId3"/>',
    );

    // pseudos triés à la française, sans la casse ni les accents
    const coord = cellules(xlsx.partie("xl/worksheets/sheet1.xml"));
    expect(
      [1, 2, 3, 4].map((l) =>
        ["A", "B", "C"].map((c) => coord.de(c + l).texte ?? coord.de(c + l).v),
      ),
    ).toEqual([
      ["Pseudo", "X", "Y"],
      ["alpha", 12, 5],
      ["Émile", 40, 30],
      ["Zorro", 10, 5],
    ]);
    expect(xlsx.partie("xl/worksheets/sheet1.xml")).toContain(
      '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>',
    );

    const trajets = cellules(xlsx.partie("xl/worksheets/sheet2.xml"));
    expect(trajets.de("B1")).toEqual({ s: "6", v: 10 });
    expect(["D3", "E3", "F3"].map((ref) => trajets.de(ref).texte)).toEqual([
      "alpha",
      "Émile",
      "Zorro",
    ]);
    expect(trajets.de("D4")).toEqual({ s: "5", texte: "—" });
    expect(trajets.de("E4").f).toBe(
      "ROUND(0.9^$B$1*637200*(1-EXP(-SQRT(($B$4-$B$5)^2+($C$4-$C$5)^2)/350)),0)/86400",
    );
    expect(xlsx.partie("xl/worksheets/sheet2.xml")).toContain(
      '<pane xSplit="3" ySplit="3" topLeftCell="D4" activePane="bottomRight" state="frozen"/>',
    );
    // chaque formule redonne sa valeur gardée, et suit la case B1
    const valeurs: Record<string, number> = {};
    for (const [ref, c] of trajets.toutes()) if (typeof c.v == "number") valeurs[ref] = c.v;
    const positions = [
      { x: 12, y: 5 },
      { x: 40, y: 30 },
      { x: 10, y: 5 },
    ];
    positions.forEach((a, i) =>
      positions.forEach((b, j) => {
        if (i == j) return;
        const c = trajets.de("DEF".charAt(j) + (4 + i)),
          temps = (va: number) =>
            lire<number>(`Joueur.tempsTrajet(${JSON.stringify(a)}, ${JSON.stringify(b)}, ${va})`) /
            86400;
        expect(c.s).toBe("2");
        expect(c.v).toBe(temps(10));
        expect(evaluer(c.f ?? "", valeurs)).toBe(temps(10));
        expect(evaluer(c.f ?? "", { ...valeurs, B1: 0 })).toBe(temps(0));
      }),
    );
    // alpha → Zorro : 2 de distance en VA 10, 0:21:06
    expect(Math.round((trajets.de("F4").v ?? 0) * 86400)).toBe(1266);

    const formule = cellules(xlsx.partie("xl/worksheets/sheet3.xml")).textes();
    expect(formule).toContain("temps (secondes) = ARRONDI(0,9^VA × 637 200 × (1 − e^(−d / 350)))");
    expect(formule).toContain(
      "Positions : Carte de l'alliance TAG, chargées le 16/11/2026 à 17h05 ; 3 membres.",
    );
    expect(formule).toContain("Fichier créé le 16/11/2026 à 18h30 par l'Extension OUAF.");
  });

  test("les membres masqués par les filtres de la carte n'y sont pas, et c'est dit", () => {
    const e = exporter(MEMBRES, ["Zorro"]);
    expect(e.toasts.map((t) => t.text)).toEqual([
      "Fichier Excel créé : 2 membres, vitesse d'attaque 10 (modifiable dans la feuille « Trajets »), sans le membre masqué par les filtres.",
    ]);
    const xlsx = fichierUnique(e);
    expect(cellules(xlsx.partie("xl/worksheets/sheet1.xml")).textes()).not.toContain("Zorro");
    expect(cellules(xlsx.partie("xl/worksheets/sheet3.xml")).textes()).toContain(
      "Positions : Carte de l'alliance TAG, chargées le 16/11/2026 à 17h05 ; 2 membres, sans le membre masqué par les filtres de la carte.",
    );
    expect(exporter(MEMBRES, ["Zorro", "alpha"]).toasts.map((t) => t.text)).toEqual([
      "Fichier Excel créé : 1 membre, vitesse d'attaque 10 (modifiable dans la feuille « Trajets »), sans les 2 membres masqués par les filtres.",
    ]);
  });
});
