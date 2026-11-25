import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * « Supprimer une attaque » du Lanceur de Flood (page d'attaque) : signalé le
 * 24/11/2026, deux lignes retirées en Dégressive pour n'envoyer que 2 attaques,
 * 4 sont parties. Le flood part du dernier calcul, que le retrait d'une ligne
 * ne refaisait pas. Les envois sont ceux du vrai Armee.envoyerFlood, jeu simulé.
 */
const page = creerPage(
  [
    "js/lib/jquery-ui_1.12.1.js",
    "js/lib/moment-duration-format.js",
    "js/lib/globalize_0.1.1.js",
    "js/lib/globalize-locale-fr.js",
    "js/class/Utils.js",
    "js/class/Parametre.js",
    "js/class/Joueur.js",
    "js/class/Armee.js",
    "js/class/UnitesGardees.js",
    "js/page/Attaquer.js",
  ],
  `var METHODE_FLOOD = ["Standard", "Optimisée", "Uniforme", "Dégressive"],
     AFFECTATION_RESSOURCE = [], RATIO_RECOLTE = {}, TOAST_WARNING = {}, TOAST_ERROR = {},
     AttaqueLancee = { enregistrer: () => {} };
   var NOM_UNITE = ["Ouvrière", "Jeune Soldate Naine"],
     NOM_UNITES = ["Ouvrières", "Jeunes Soldates Naines"];`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);

// cible à 100 000 cm², 5 créneaux libres, 4 attaques proposées, armée largement suffisante
function ouvrir(methode: number, antisonde = 0) {
  lire(`(() => {
    localStorage.setItem("outiiil_parametre", JSON.stringify({ reserveFlood: 0, reserveFloodAuto: false, methodeFlood: ${methode}, floodAttaques: 4 }));
    localStorage.setItem("fzzz_reserveEnPlus", "1");
    localStorage.setItem("fzzz_methodeDegressive", "1");
    window.monProfil = new Joueur({ pseudo: "Moi" }).getParametre();
    document.body.innerHTML = '<span id="quantite_tdc">100000</span><table class="simulateur"></table>';
    window.p = Object.create(PageAttaquer.prototype);
    p._cible = { pseudo: "X", terrain: 100000, x: 0, y: 0 };
    p._armee = new Armee({ unite: { "Jeune Soldate Naine": 1000000 } });
    p._nbAttaque = 5;
    p.formulaireFlood();
    // happy-dom renvoie toujours la 2e option : la liste est remise sur la méthode réglée
    $("#o_methodeFlood").val("${methode}").trigger("change");
    if (${antisonde}) $("#o_floodAntiSonde").spinner("value", ${antisonde}).trigger("input");
  })()`);
}
const lignes = () => lire<number>(`$("input[id^='o_attaque']").length`);
const saisir = (ligne: number, valeur: number) =>
  lire(`$("#o_attaque${ligne}").spinner("value", ${valeur}).trigger("input")`);
const supprimer = (fois: number) =>
  lire(`for (let i = 0; i < ${fois}; i++) $("#o_supprimeAttaque").trigger("click")`);
/** Clic sur « Flooder » : unités de chaque attaque postée au jeu, dans l'ordre. */
const envoyer = () =>
  lire<number[]>(`(() => {
    let envois = [], attente = setTimeout, a = p._armee;
    window.setTimeout = (f) => (f(), 0);
    $.post = (url, donnees, retour) => {
      envois.push(Object.keys(donnees).filter((k) => /^unite\\d+$/.test(k)).reduce((s, k) => s + donnees[k], 0));
      retour("<center>Vos troupes sont en marche</center>");
      return { fail() {} };
    };
    // sans la page Armée de la fin du flood
    a.envoyerFlood = ((envoi) => function (id, i, s) {
      if (i < this.floods.length) envoi.call(this, id, i, s);
    })(a.envoyerFlood);
    $("#o_lanceFlood").trigger("click");
    window.setTimeout = attente;
    return envois;
  })()`);

describe("« Supprimer une attaque » : seules les lignes restantes partent", () => {
  test("Dégressive, 4 attaques, 2 lignes retirées : 2 attaques envoyées", () => {
    ouvrir(3);
    expect(lignes()).toBe(4);
    supprimer(2);
    expect(lignes()).toBe(2);
    expect(envoyer()).toEqual([20000, 16000]);
  });

  test("Uniforme et Standard aussi", () => {
    ouvrir(2);
    supprimer(2);
    expect(envoyer()).toEqual([20000, 20000]);
    ouvrir(0);
    for (const i of [1, 2, 3, 4]) saisir(i, 10000 + i);
    supprimer(1);
    expect(envoyer()).toEqual([10001, 10002, 10003]);
  });

  test("Dégressive avec une attaque saisie : les valeurs des lignes restantes partent telles quelles", () => {
    ouvrir(3);
    saisir(2, 22222);
    supprimer(2);
    expect(envoyer()).toEqual([20000, 22222]);
  });

  test("ligne retirée puis rajoutée : recalculée et envoyée", () => {
    ouvrir(3);
    supprimer(2);
    lire(`$("#o_ajouteAttaque").trigger("click")`);
    expect(envoyer()).toEqual([20000, 16000, 12800]);
  });
});

test("antisonde envoyée : une attaque par ligne en Dégressive et en Uniforme", () => {
  // avant : 4 lignes et 3 attaques calculées, la dernière ligne restait à 0
  ouvrir(3, 50);
  expect(lignes()).toBe(4);
  expect(envoyer()).toEqual([50, 19990, 15992, 12793, 10235]);
  ouvrir(2, 50);
  expect(envoyer()).toEqual([50, 20000, 20000, 20000, 20000]);
});

/**
 * Optimisée (demande du mainteneur, 25/11/2026) : retirer, ajouter une attaque
 * ou en changer le montant comme dans les autres méthodes. Cible à 100 000
 * contre 100 000 : 20 000, l'attaque « limite » 13 333, puis 13 333.
 */
describe("Optimisée : attaques retirées, ajoutées ou modifiées", () => {
  const liens = () =>
    lire<boolean[]>(
      `[$("#o_supprimeAttaque").css("display"), $("#o_ajouteAttaque").css("display")].map((d) => d != "none")`,
    );
  const montants = () =>
    lire<number[]>(`$("input[id^='o_attaque']").map((i, e) => $(e).spinner("value")).get()`);

  test("les liens « Supprimer » et « Ajouter une attaque » restent affichés", () => {
    ouvrir(1);
    expect(liens()).toEqual([true, true]);
    lire(`$("#o_methodeFlood").val("3").trigger("change")`);
    lire(`$("#o_methodeFlood").val("1").trigger("change")`);
    expect(liens()).toEqual([true, true]);
  });

  test("une attaque retirée : les autres sont recalculées pour ce nombre, seules elles partent", () => {
    ouvrir(1);
    expect(montants()).toEqual([20000, 13333, 13333]);
    supprimer(1);
    // deux attaques : plus besoin de l'attaque « limite », 20 % chacune
    expect(montants()).toEqual([20000, 16000]);
    expect(envoyer()).toEqual([20000, 16000]);
  });

  test("une attaque ajoutée : à 0 quand Optimisée n'en voit pas l'utilité, envoyée au montant saisi", () => {
    ouvrir(1);
    lire(`$("#o_ajouteAttaque").trigger("click")`);
    expect(montants()).toEqual([20000, 13333, 13333, 0]);
    // ligne gardée même quand les TdC changent
    lire(`$("#o_floodTDCB").spinner("value", 90000).trigger("input")`);
    expect(lignes()).toBe(4);
    saisir(4, 5000);
    expect(envoyer()).toEqual([18000, 8666, 12666, 5000]);
  });

  test("une attaque retirée puis rajoutée : recalculée pour ce nombre", () => {
    ouvrir(1);
    supprimer(1);
    lire(`$("#o_ajouteAttaque").trigger("click")`);
    expect(montants()).toEqual([20000, 13333, 13333]);
    expect(envoyer()).toEqual([20000, 13333, 13333]);
  });

  test("une attaque ajoutée sous la limite de créneaux seulement", () => {
    ouvrir(1);
    lire(`$.toast = (o) => (window.avis = o.text)`);
    for (const _ of [1, 2, 3]) lire(`$("#o_ajouteAttaque").trigger("click")`);
    // 5 créneaux libres
    expect(lignes()).toBe(5);
    expect(lire<string>(`window.avis`)).toContain("vitesse d'attaque");
  });

  test("un montant saisi est gardé, les attaques suivantes recalculées depuis les TdC qu'il laisse", () => {
    ouvrir(1);
    saisir(1, 10000);
    // 110 000 contre 90 000 : 20 % (18 000), puis la limite et un dernier 20 %
    expect(montants()).toEqual([10000, 18000, 5333, 13333]);
    // les TdC changent : la saisie reste, la suite est recalculée
    lire(`$("#o_floodTDCB").spinner("value", 90000).trigger("input")`);
    expect(montants()[0]).toBe(10000);
    expect(envoyer()[0]).toBe(10000);
  });

  test("attaque 2 saisie : l'attaque 1 garde son montant aussi, même après un changement de TdC", () => {
    ouvrir(1);
    saisir(2, 1000);
    lire(`$("#o_floodTDCB").spinner("value", 90000).trigger("input")`);
    const [a, b] = montants();
    expect([a, b]).toEqual([20000, 1000]);
  });

  test("attaque saisie arrivant hors de portée : elle ne prend rien, la suite en tient compte", () => {
    ouvrir(1);
    saisir(1, 20000);
    saisir(2, 20000);
    // 136 000 contre 64 000 : la cible est sous la moitié, l'attaque 3 ne prend rien
    saisir(3, 1000);
    expect(montants()).toEqual([20000, 20000, 1000, 12800]);
  });

  test("toute l'armée dans l'attaque 1 : l'attaque 2 saisie avant reste, à 0", () => {
    ouvrir(1);
    saisir(2, 5000);
    saisir(1, 1000000);
    expect(montants()).toEqual([1000000, 0]);
    expect(envoyer()).toEqual([1000000]);
  });

  test("attaque saisie puis retirée : la saisie disparaît avec la ligne", () => {
    ouvrir(1);
    saisir(3, 7000);
    // la cible reste à portée : Optimisée ajoute une attaque après la saisie
    expect(montants()).toEqual([20000, 13333, 7000, 11933]);
    supprimer(1);
    expect(montants()).toEqual([20000, 13333, 7000]);
    supprimer(1);
    // plus de saisie : les deux attaques restantes sont recalculées
    expect(montants()).toEqual([20000, 16000]);
    expect(envoyer()).toEqual([20000, 16000]);
  });

  test("changement de méthode puis retour en Optimisée : son propre calcul revient", () => {
    ouvrir(1);
    saisir(1, 10000);
    supprimer(1);
    lire(`$("#o_methodeFlood").val("2").trigger("change")`);
    lire(`$("#o_methodeFlood").val("1").trigger("change")`);
    expect(montants()).toEqual([20000, 13333, 13333]);
  });
});
