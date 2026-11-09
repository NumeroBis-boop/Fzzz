import { beforeEach, describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

// page Armée au format du jeu (armées inventées) : un lieu vide est une case,
// un lieu occupé trois (flèche, nombre, flèche) ; serveur simulé qui applique,
// ignore, retarde ou refuse les déplacements
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
   // modes : normal ; rafale (action juste après une autre ignorée, comme le
   // journal du 08/11) ; retard (réponse au dernier déplacement d'avant lui) ;
   // dôme refusé ; loge refusée (« tout en loge » sans effet) ; moitié (le
   // premier déplacement n'en fait que la moitié) ; ponte (une JSN pondue
   // arrive en loge avant chaque requête, comme le journal du 09/11), seule ou
   // avec rafale
   function installerServeur(etat, mode, postes) {
     let s = (window.serveur = { etat, mode, jeton: 0, requetes: [], derniere: "lecture" }),
       lieu = { 1: "tdc", 2: "dome", 3: "loge" },
       copie = () => JSON.parse(JSON.stringify(s.etat)),
       reponse = (affiche, message) => pageArmee(affiche, "j" + ++s.jeton, message),
       pondre = () => {
         if (s.mode.includes("ponte")) s.etat.loge[0]++;
       },
       ignoree = () => {
         let rafale = s.mode.includes("rafale") && s.derniere == "action";
         s.derniere = "action";
         return rafale;
       };
     window.toasts = [];
     window.notes = [];
     $.toast = (o) => toasts.push(o);
     Journal.info = (src, m, d) => notes.push(["info", src, m, d]);
     Journal.erreur = (src, m, d) => notes.push(["erreur", src, m, d]);
     $.get = (url, data) => {
       s.requetes.push(["GET", url, data || null]);
       pondre();
       if (!data) {
         s.derniere = "lecture";
         return Promise.resolve(reponse(copie()));
       }
       if (!ignoree() && s.mode != "loge refusée")
         for (let k = 0; k < 3; k++) {
           s.etat.loge[k] += s.etat.tdc[k] + s.etat.dome[k];
           s.etat.tdc[k] = s.etat.dome[k] = 0;
         }
       return Promise.resolve(reponse(copie()));
     };
     $.post = (url, d) => {
       s.requetes.push(["POST", url, d]);
       pondre();
       let avant = copie(),
         k = Number(String(d.ChoixUnite).replace("unite", "")) - 1,
         n = s.requetes.filter((r) => r[0] == "POST").length,
         nb = s.mode == "moitié" && n == 1 ? Math.floor(d.nbTroupes / 2) : d.nbTroupes;
       if (ignoree()) return Promise.resolve(reponse(avant));
       if (s.mode == "dôme refusé" && d.LieuDestination == 2)
         return Promise.resolve(reponse(avant, "Déplacement impossible."));
       if (s.etat[lieu[d.LieuOrigine]][k] < nb)
         return Promise.resolve(reponse(avant, "Vous n'avez pas assez d'unités à déplacer."));
       s.etat[lieu[d.LieuOrigine]][k] -= nb;
       s.etat[lieu[d.LieuDestination]][k] += nb;
       return Promise.resolve(reponse(s.mode == "retard" && n == postes ? avant : copie()));
     };
   }`,
);

type Lieux = { tdc: number[]; dome: number[]; loge: number[] };
type Requete = [string, string, Record<string, any> | null];
// 120 JSN et 5 SN sur le TdC : tout en loge, 4 JSN loge → dôme, 2 dôme → TdC
const DEPART: Lieux = { tdc: [120, 5, 0], dome: [0, 0, 0], loge: [500, 300, 0] };

/** Page Armée affichée, armée lue, replacement prévu (JSN, `terrain` en TdC et `dome` en dôme) et lancé. */
async function replacer(mode: string, depart: Lieux = DEPART, terrain = 2, dome = 2, postes = 2) {
  page.lire(`(() => {
    localStorage.setItem("outiiil_parametre", JSON.stringify({ uniteAntisondeTerrain: ${terrain}, uniteAntisondeDome: ${dome}, uniteAntisondeTerrainType: 1, uniteAntisondeDomeType: 1 }));
    window.monProfil = new Joueur({ pseudo: "Moi" }).getParametre();
    document.body.innerHTML = "<div id='menuComptePlus'><a class='boutonStatJoueur'>Stat</a></div>" + pageArmee(${JSON.stringify(depart)}, "j0");
    installerServeur(${JSON.stringify(depart)}, ${JSON.stringify(mode)}, ${postes});
    window.p = Object.create(PageArmee.prototype);
    p.recupererArmee();
    window.fin = p.placementPrevu()();
  })()`);
  await page.lire(`fin`);
  return {
    toasts: page.lire(`toasts.map((t) => [t.icon, t.text])`) as [string, string][],
    notes: page.lire(`notes`) as string[][],
    requetes: page.lire(`serveur.requetes`) as Requete[],
    armee: page.lire(
      `[p._armeeTdc.unite[0], p._armeeDome.unite[0], p._armeeLoge.unite[0], p.uniteTransferables()]`,
    ),
  };
}
/** Requêtes envoyées : « tout en loge », « relue », ou [origine, destination, nombre]. */
const envois = (r: { requetes: Requete[] }) =>
  r.requetes.map((q) =>
    !q[2]
      ? "relue"
      : q[0] == "GET"
        ? "tout en loge"
        : [q[2].LieuOrigine, q[2].LieuDestination, q[2].nbTroupes],
  );
const REUSSI: [string, string] = [
  "success",
  "Armée replacée : 2 Jeune Soldate Naine en TdC, 2 Jeune Soldate Naine en dôme, le reste en loge.",
];
const REUSSI_1: [string, string] = [
  "success",
  "Armée replacée : 1 Jeune Soldate Naine en TdC, 1 Jeune Soldate Naine en dôme, le reste en loge.",
];

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

describe("déplacements prévus", () => {
  test("entre lieux voisins seulement, deux au plus par unité, sans jamais vider un lieu en trop", () => {
    // 3 000 états et cibles tirés au hasard (graine fixe), exécutés à la suite
    const echecs = page.lire(`(() => {
      let graine = 7, alea = () => ((graine = (graine * 16807) % 2147483647) / 2147483647),
        n = () => [0, 0, 1, 2, 5, 40, 1790][Math.floor(alea() * 7)], echecs = [];
      for (let essai = 0; essai < 3000; essai++) {
        let tdc = [n(), n(), n()], dome = [n(), n(), n()], loge = [n(), n(), n()],
          ct = [0, 0, 0], cd = [0, 0, 0], iT = Math.floor(alea() * 3), iD = Math.floor(alea() * 3),
          total = (k) => tdc[k] + dome[k] + loge[k];
        ct[iT] = Math.min(total(iT), n());
        cd[iD] = Math.min(total(iD) - (iT == iD ? ct[iT] : 0), n());
        let etat = { 1: tdc.slice(), 2: dome.slice(), 3: loge.slice() },
          m = PageArmee.mouvements(tdc, dome, ct, cd),
          parUnite = [0, 0, 0];
        for (let e of m) {
          parUnite[e.i]++;
          if (Math.abs(e.de - e.vers) != 1 || !(e.nb > 0) || etat[e.de][e.i] < e.nb) echecs.push([essai, "déplacement", e]);
          etat[e.de][e.i] -= e.nb;
          etat[e.vers][e.i] += e.nb;
        }
        if (parUnite.some((x) => x > 2)) echecs.push([essai, "plus de deux"]);
        if ([0, 1, 2].some((k) => etat[1][k] != ct[k] || etat[2][k] != cd[k])) echecs.push([essai, "cible", etat]);
      }
      return echecs;
    })()`);
    expect(echecs).toEqual([]);
  });
});

describe("replacement vérifié déplacement par déplacement", () => {
  beforeEach(() => page.lire(`localStorage.clear()`));

  test("jeu qui fait tout : trois requêtes, jeton de chaque réponse repris, sans relecture", async () => {
    const r = await replacer("normal");
    expect(r.toasts).toEqual([REUSSI]);
    expect(envois(r)).toEqual(["tout en loge", [3, 2, 4], [2, 1, 2]]);
    expect(r.requetes.map((q) => q[2]?.t)).toEqual(["j0", "j1", "j2"]);
    expect(r.notes).toEqual([]);
    expect(r.armee).toEqual([2, 2, 616, 925]);
    // flèches refaites dans le tableau : attribut du jeton à jour aussi
    expect(page.lire(`[$("#t").val(), $("#t").attr("value")]`)).toEqual(["j3", "j3"]);
  });

  test("jeu qui ignore une action envoyée juste après une autre : relue, renvoyée, armée replacée", async () => {
    const r = await replacer("rafale");
    expect(r.toasts).toEqual([REUSSI]);
    expect(envois(r)).toEqual([
      "tout en loge",
      [3, 2, 4],
      "relue",
      [3, 2, 4],
      [2, 1, 2],
      "relue",
      [2, 1, 2],
    ]);
    // chaque requête avec le jeton de la réponse précédente, relectures comprises
    expect(r.requetes.map((q) => q[2]?.t ?? "relue")).toEqual([
      "j0",
      "j1",
      "relue",
      "j3",
      "j4",
      "relue",
      "j6",
    ]);
    expect(r.notes).toEqual([
      [
        "info",
        "Replacement de l'armée",
        "Armée placée après relecture de la page",
        "attendu : TdC 2 Jeune Soldate Naine, dôme 2 Jeune Soldate Naine\n" +
          "tout en loge → TdC 0, dôme 0, autres hors loge 0\n" +
          "4 Jeune Soldate Naine loge → dôme → TdC 0, dôme 0, autres hors loge 0\n" +
          "  page relue → TdC 0, dôme 0, autres hors loge 0\n" +
          "4 Jeune Soldate Naine loge → dôme → TdC 0, dôme 4, autres hors loge 0\n" +
          "2 Jeune Soldate Naine dôme → TdC → TdC 0, dôme 4, autres hors loge 0\n" +
          "  page relue → TdC 0, dôme 4, autres hors loge 0\n" +
          "2 Jeune Soldate Naine dôme → TdC → TdC 2, dôme 2, autres hors loge 0",
      ],
    ]);
    expect(r.armee).toEqual([2, 2, 616, 925]);
  });

  test("cas du journal : 1 791 en dôme, antisondes de 1 : deux déplacements, le second renvoyé", async () => {
    const r = await replacer(
      "rafale",
      { tdc: [0, 0, 0], dome: [1791, 0, 0], loge: [500, 300, 0] },
      1,
      1,
    );
    expect(r.toasts).toEqual([
      [
        "success",
        "Armée replacée : 1 Jeune Soldate Naine en TdC, 1 Jeune Soldate Naine en dôme, le reste en loge.",
      ],
    ]);
    expect(envois(r)).toEqual([[2, 1, 1], [2, 3, 1789], "relue", [2, 3, 1789]]);
  });

  test("unités pondues en loge pendant le replacement : le dôme compte, rien n'est relu", async () => {
    const r = await replacer(
      "ponte",
      { tdc: [0, 0, 0], dome: [3114, 0, 0], loge: [500, 300, 0] },
      1,
      1,
    );
    expect(r.toasts).toEqual([REUSSI_1]);
    expect(envois(r)).toEqual([
      [2, 1, 1],
      [2, 3, 3112],
    ]);
    expect(r.notes).toEqual([]);
  });

  test("cas du journal du 09/11 : action ignorée, ponte avant la relecture, tout ce qui manque renvoyé", async () => {
    // compté en loge, le renvoi faisait 3 114 au lieu de 3 115 : 2 en dôme
    const r = await replacer(
      "rafale ponte",
      { tdc: [3117, 0, 0], dome: [0, 0, 0], loge: [500, 300, 0] },
      1,
      1,
    );
    expect(r.toasts).toEqual([REUSSI_1]);
    expect(envois(r)).toEqual([[1, 2, 3116], [2, 3, 3115], "relue", [2, 3, 3115]]);
    expect(r.notes.map((n) => n[2])).toEqual(["Armée placée après relecture de la page"]);
    expect((r.armee as number[]).slice(0, 2)).toEqual([1, 1]);
  });

  test("réponse d'avant le déplacement : la page relue le montre fait, rien n'est renvoyé", async () => {
    const r = await replacer("retard");
    expect(r.toasts).toEqual([REUSSI]);
    expect(envois(r)).toEqual(["tout en loge", [3, 2, 4], [2, 1, 2], "relue"]);
    expect(r.notes.map((n) => n[2])).toEqual(["Armée placée après relecture de la page"]);
    expect(r.armee).toEqual([2, 2, 616, 925]);
  });

  test("déplacement fait en partie : seulement ce qui manque est renvoyé", async () => {
    const r = await replacer("moitié");
    expect(r.toasts).toEqual([REUSSI]);
    expect(envois(r)).toEqual(["tout en loge", [3, 2, 4], "relue", [3, 2, 2], [2, 1, 2]]);
  });

  test("déplacement toujours refusé : trois envois, la suite arrêtée, l'alerte dit ce qui manque", async () => {
    const r = await replacer("dôme refusé");
    expect(envois(r)).toEqual([
      "tout en loge",
      [3, 2, 4],
      "relue",
      [3, 2, 4],
      "relue",
      [3, 2, 4],
      "relue",
    ]);
    expect(r.toasts).toEqual([
      [
        "warning",
        "Le jeu n'a pas déplacé l'armée comme prévu (TdC : 0 Jeune Soldate Naine au lieu de 2 ; dôme : 0 Jeune Soldate Naine au lieu de 2) : vérifie le tableau.",
      ],
    ]);
    expect(r.notes.map((n) => [n[0], n[2]])).toEqual([["erreur", "Armée pas placée comme prévu"]]);
    expect(r.notes[0]![3]).toContain("(message du jeu : « Déplacement impossible. »)");
    // tableau affiché : celui de la dernière page relue
    expect(r.armee).toEqual([0, 0, 620, 925]);
  });

  test("« tout en loge » sans effet : renvoyé, puis les unités restées dehors sont signalées", async () => {
    const r = await replacer("loge refusée");
    expect(envois(r)).toEqual([
      "tout en loge",
      "relue",
      "tout en loge",
      "relue",
      "tout en loge",
      "relue",
    ]);
    expect(r.toasts).toEqual([
      [
        "warning",
        "Le jeu n'a pas déplacé l'armée comme prévu (TdC : 120 Jeune Soldate Naine au lieu de 2 ; dôme : 0 Jeune Soldate Naine au lieu de 2 ; 5 autre(s) unité(s) hors de la loge) : vérifie le tableau.",
      ],
    ]);
    expect(r.notes.map((n) => n[0])).toEqual(["erreur"]);
  });
});
