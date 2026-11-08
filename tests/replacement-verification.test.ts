import { beforeEach, describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

// page Armée au format du jeu (armées inventées) : un lieu vide est une case,
// un lieu occupé trois (flèche, nombre, flèche) ; serveur simulé qui applique,
// retarde ou refuse les déplacements
const page = creerPage(
  [
    "js/class/Utils.js",
    "js/class/Parametre.js",
    "js/class/Joueur.js",
    "js/class/Armee.js",
    "js/page/Armee.js",
  ],
  `var METHODE_FLOOD = [], AFFECTATION_RESSOURCE = [], RATIO_RECOLTE = {};
   var NOM_UNITE = ["Ouvrière", "Jeune Soldate Naine", "Soldate Naine", "Naine d’Elite"];
   var TOAST_SUCCESS = { icon: "success" }, TOAST_WARNING = { icon: "warning" },
     TOAST_INFO = { icon: "info" }, TOAST_ERROR = { icon: "error" };
   var COURTS = [["Jeune Soldate Naine", "JSN"], ["Soldate Naine", "SN"], ["Naine d’Elite", "NE"]];
   function pageArmee(l, jeton, message) {
     let lieu = (n, k, origine) => n
       ? "<td style='width:20px'><a href='#'><img/></a></td><td style='width:120px'><span class='cliquable' onclick=\\"remplirFormulaire(" + n + ",'unite" + (k + 1) + "'," + origine + ",3);\\">" + numeral(n).format() + "</span></td><td style='width:20px'></td>"
       : "<td colspan=3></td>";
     let lignes = COURTS.map(([nom, court], k) =>
       "<tr align='center'><td><div class='pas_sur_telephone'>" + nom + "</div><div class='que_sur_telephone'>" + court + "</div></td>" +
       lieu(l.tdc[k], k, 1) + lieu(l.dome[k], k, 2) + lieu(l.loge[k], k, 3) + "</tr>").join("");
     return "<div id='centre'>" + (message ? "<p><strong>" + message + "</strong></p>" : "") +
       "<table class='simulateur' style='text-align:center'><tr><td colspan=10><h3> Troupes en Garnison </h3></td></tr>" +
       "<tr class='ligne_paire'><td>Unités</td><td colspan=3>Terrain de Chasse</td><td colspan=3>Dôme (3)</td><td colspan=3>Loge (3)</td></tr>" +
       lignes + "<tr align='center'><td><span class='cliquable'>Vie</span></td><td colspan=3>0</td><td colspan=3>32</td><td colspan=3>5 752</td></tr></table>" +
       "<form action='Armee.php' method='post'><input type='hidden' name='t' id='t' value='" + jeton + "'/>" +
       "<select name='ChoixUnite' id='ChoixUnite'>" + COURTS.map(([nom], k) => "<option value='unite" + (k + 1) + "'>" + nom + "</option>").join("") + "</select></form></div>";
   }
   function installerServeur(etat, mode) {
     let s = (window.serveur = { etat, mode, jeton: 0, requetes: [] }),
       lieu = { 1: "tdc", 2: "dome", 3: "loge" },
       copie = () => JSON.parse(JSON.stringify(s.etat)),
       reponse = (affiche, message) => pageArmee(affiche, "j" + ++s.jeton, message);
     window.toasts = [];
     window.notes = [];
     $.toast = (o) => toasts.push(o);
     Journal.info = (src, m, d) => notes.push(["info", src, m, d]);
     Journal.erreur = (src, m, d) => notes.push(["erreur", src, m, d]);
     $.get = (url, data) => {
       s.requetes.push(["GET", url, data || null]);
       if (data && data.deplacement == 3 && s.mode != "loge refusée")
         for (let k = 0; k < 3; k++) {
           s.etat.loge[k] += s.etat.tdc[k] + s.etat.dome[k];
           s.etat.tdc[k] = s.etat.dome[k] = 0;
         }
       return Promise.resolve(reponse(copie()));
     };
     $.post = (url, d) => {
       s.requetes.push(["POST", url, d]);
       let avant = copie(),
         k = Number(String(d.ChoixUnite).replace("unite", "")) - 1,
         dernier = s.requetes.filter((r) => r[0] == "POST").length == s.postes;
       if (s.mode == "dôme refusé" && d.LieuDestination == 2)
         return Promise.resolve(reponse(avant, "Vous n'avez pas assez d'unités à déplacer."));
       s.etat[lieu[d.LieuOrigine]][k] -= d.nbTroupes;
       s.etat[lieu[d.LieuDestination]][k] += d.nbTroupes;
       // réponse en retard : l'armée d'avant ce dernier déplacement
       return Promise.resolve(reponse(s.mode == "retard" && dernier ? avant : copie()));
     };
   }`,
);

type Lieux = { tdc: number[]; dome: number[]; loge: number[] };
const DEPART: Lieux = { tdc: [120, 5, 0], dome: [0, 0, 0], loge: [500, 300, 0] };
const ETAPES = [
  { toutEnLoge: true },
  { i: 0, de: 3, vers: 1, nb: 2 },
  { i: 0, de: 3, vers: 2, nb: 2 },
];

/** Page Armée affichée, armée lue, puis replacement vers 2 JSN en TdC et 2 en dôme. */
async function replacer(mode: string, depart: Lieux = DEPART) {
  page.lire(`(() => {
    document.body.innerHTML = "<div id='menuComptePlus'><a class='boutonStatJoueur'>Stat</a></div>" + pageArmee(${JSON.stringify(depart)}, "j0");
    installerServeur(${JSON.stringify(depart)}, ${JSON.stringify(mode)});
    serveur.postes = 2;
    window.p = Object.create(PageArmee.prototype);
    p.recupererArmee();
    window.fin = p.replacer(0, 2, 0, 2, ${JSON.stringify(ETAPES)});
  })()`);
  await page.lire(`fin`);
  return {
    toasts: page.lire(`toasts.map((t) => [t.icon, t.text])`) as [string, string][],
    notes: page.lire(`notes`) as string[][],
    requetes: page.lire(`serveur.requetes`) as [string, string, Record<string, unknown> | null][],
    armee: page.lire(
      `[p._armeeTdc.unite[0], p._armeeDome.unite[0], p._armeeLoge.unite[0], p.uniteTransferables()]`,
    ),
  };
}

describe("garnison lue dans son tableau", () => {
  test("lieux vides ou occupés, milliers, lignes hors du tableau ou sans unité ignorées", () => {
    const lieux = page.lire(`(() => {
      let html = "<table class='simulateur'><tr align='center'><td><div class='pas_sur_telephone'>Jeune Soldate Naine</div></td><td></td><td><span>999</span></td></tr></table>" +
        pageArmee({ tdc: [1234, 0, 5], dome: [0, 7, 0], loge: [282, 0, 3] }, "j");
      let g = PageArmee.garnisonDe(html);
      return [g.tdc.unite.slice(0, 3), g.dome.unite.slice(0, 3), g.loge.unite.slice(0, 3)];
    })()`);
    expect(lieux).toEqual([
      [1234, 0, 5],
      [0, 7, 0],
      [282, 0, 3],
    ]);
    expect(page.lire(`PageArmee.garnisonDe("<p>Une autre action est en cours</p>")`)).toBeNull();
  });
});

describe("vérification du replacement", () => {
  beforeEach(() => page.lire(`localStorage.clear()`));

  test("jeu qui déplace comme demandé : armée replacée, sans relecture, jeton de chaque réponse repris", async () => {
    const r = await replacer("normal");
    expect(r.toasts).toEqual([
      [
        "success",
        "Armée replacée : 2 Jeune Soldate Naine en TdC, 2 Jeune Soldate Naine en dôme, le reste en loge.",
      ],
    ]);
    expect(r.requetes.map((q) => [q[0], q[2]?.t])).toEqual([
      ["GET", "j0"],
      ["POST", "j1"],
      ["POST", "j2"],
    ]);
    expect(r.notes).toEqual([]);
    expect(r.armee).toEqual([2, 2, 616, 925]);
    // flèches refaites dans le tableau : attribut du jeton à jour aussi
    expect(page.lire(`[$("#t").val(), $("#t").attr("value")]`)).toEqual(["j3", "j3"]);
  });

  test("réponse d'avant le dernier déplacement : la page relue fait foi, sans alerte", async () => {
    const r = await replacer("retard");
    expect(r.toasts.map((t) => t[0])).toEqual(["success"]);
    // une relecture d'Armee.php, sans action
    expect(r.requetes.map((q) => [q[0], q[2]])).toEqual([
      ["GET", { deplacement: 3, t: "j0" }],
      ["POST", expect.objectContaining({ LieuDestination: 1, t: "j1" })],
      ["POST", expect.objectContaining({ LieuDestination: 2, t: "j2" })],
      ["GET", null],
    ]);
    expect(r.armee).toEqual([2, 2, 616, 925]);
    expect(r.notes.map((n) => [n[0], n[2]])).toEqual([
      ["info", "Réponse du jeu d'avant le déplacement : armée bien placée à la relecture"],
    ]);
  });

  test("déplacement refusé par le jeu : alerte qui dit ce qui manque, étapes au journal", async () => {
    const r = await replacer("dôme refusé");
    expect(r.toasts).toEqual([
      [
        "warning",
        "Le jeu n'a pas déplacé l'armée comme prévu (dôme : 0 Jeune Soldate Naine au lieu de 2) : vérifie le tableau.",
      ],
    ]);
    expect(r.notes).toEqual([
      [
        "erreur",
        "Replacement de l'armée",
        "Armée pas placée comme prévu",
        "attendu : TdC 2 Jeune Soldate Naine, dôme 2 Jeune Soldate Naine\n" +
          "1. tout en loge → TdC 0, dôme 0, autres hors loge 0\n" +
          "2. 2 Jeune Soldate Naine loge → TdC → TdC 2, dôme 0, autres hors loge 0\n" +
          "3. 2 Jeune Soldate Naine loge → dôme → TdC 2, dôme 0, autres hors loge 0 (message du jeu : « Vous n'avez pas assez d'unités à déplacer. »)\n" +
          "page relue → TdC 2, dôme 0, autres hors loge 0",
      ],
    ]);
    // tableau affiché : celui de la page relue
    expect(r.armee).toEqual([2, 0, 618, 925]);
  });

  test("« tout en loge » sans effet : les unités restées dehors sont signalées", async () => {
    const r = await replacer("loge refusée");
    expect(r.toasts).toEqual([
      [
        "warning",
        "Le jeu n'a pas déplacé l'armée comme prévu (TdC : 122 Jeune Soldate Naine au lieu de 2 ; 5 autre(s) unité(s) hors de la loge) : vérifie le tableau.",
      ],
    ]);
    expect(r.notes[0]![0]).toBe("erreur");
  });
});
