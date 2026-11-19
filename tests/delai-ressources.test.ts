import { beforeEach, describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Pages Construction et Laboratoire : heure où la nourriture et les matériaux
 * suffiront, au survol du coût (demande du mainteneur, 18/11/2026). HTML des
 * lignes, de l'encart et de la page Convois relevé sur des pages enregistrées ;
 * joueurs et nombres inventés.
 */
const page = creerPage(
  [
    "js/lib/jquery-ui_1.12.1.js",
    "js/class/Utils.js",
    "js/class/Entrepots.js",
    "js/class/DelaiRessources.js",
  ],
  `var heure = moment("2026-11-18 10:00:00", "YYYY-MM-DD HH:mm:ss").valueOf();
   var Horloge = { maintenant: () => heure, serveur: () => moment(heure) };
   var monProfil = { pseudo: "Moi", niveauConstruction: [-1, 10, 13] };
   var APPELS = [], REPONSE = null, JOURNAL = [], RECUS = null;
   // sans Compte+ : convois qui arrivent lus dans le sujet commun du forum
   var ConvoisForum = { recus: () => RECUS() };
   var FORUM_SECTIONS_CHASSES = ["BDD partagée cachée"];`,
  "https://s5.fourmizzz.fr/construction.php",
);
const lire = <T = any>(e: string) => page.lire<T>(e);
const HEURE = lire<number>(`heure`);
const H = 3600000;
const MIN = 60000;

/** Info-bulle de la ligne du TdC de l'encart, telle que le jeu l'écrit. */
function infobulle(
  total: [string, string],
  terrain: [string, string],
  champi: string,
  armee: string,
) {
  return `<script language="JavaScript">$(function() {
		$("#boite_info_tdc").tooltip({
	    tooltipClass: "warning-tooltip",
	    content:"<table id='tooltip_conso' style='white-space: nowrap;'><tr style='text-align:center'><td></td><td><img src='images/icone/icone_pomme.png' width='28' height='28'/></td><td><img src='images/icone/icone_bois.png' width='28' /></td></tr><tr style='font-weight:bold'><td>Total par Jour</td><td style='padding:0px 20px;'><span>+<span style='display:none;'>_</span>${total[0]}</span></td><td>${total[1]}</td></tr><tr><td>Terrain</td><td style='padding:0px 20px;' >${terrain[0]}</td><td>${terrain[1]}</td></tr><tr><td>Champignon</td><td style='padding:0px 20px;' >${champi}</td><td></td></tr><tr><td>Armée</td><td style='padding:0px 20px;' >${armee}</td><td></td></tr></table>"
		});
		});</script>`;
}
const INFOBULLE = infobulle(["553 439", "+916 560"], ["0", "916 560"], "595 612", "-42 173");
/** Menu Compte+ du jeu (Utils.comptePlus le reconnaît à son lien « Stat »). */
const MENU_COMPTE_PLUS = `<ul id="menuComptePlus"><li><a class="boutonStatJoueur" href="statJoueur.php">Stat</a></li></ul>`;
/** Encart « S5 Pseudo » et données cachées du jeu ; avec le Compte+ par défaut (page Convois relue). */
function encart(stock: [number, number], comptePlus = true) {
  return `${comptePlus ? MENU_COMPTE_PLUS : ""}<div id="data" style="display:none"><div id="pseudo">Moi</div><div id="nb_ouvrieres">68031</div><div id="nb_materiaux">${stock[1]}</div><div id="nb_nourriture">${stock[0]}.21851002632</div><div id="quantite_tdc">19095</div></div>
<div id="boiteInfo" class="boite_info"><table id="tableau_boite_info">
<tr><td class="lien tooltip_boite_info" title="Votre entrepôt de nourriture est rempli à 18%"><a class="ligne_boite_info" href="Reine.php"><img class="icone_nourriture_boite_info" alt="Nourriture" src="images/icone/icone_pomme.png"/><div class="texte_ligne_boite_info">${stock[0]}</div></a></td></tr>
<tr><td class="lien tooltip_boite_info" title="Votre entrepôt de matériaux est rempli à 36%"><a class="ligne_boite_info" href="construction.php"><img class="icone_materiaux_boite_info" alt="Materiaux" src="images/icone/icone_bois.png" width="28" /><div class="texte_ligne_boite_info">${stock[1]}</div></a></td></tr>
</table></div>`;
}
/** Ligne d'un bâtiment de la page Construction (coût en matériaux seulement). */
function batiment(nom: string, materiaux: string, manquant = "") {
  return `<tr class="ligneAmelioration" ><td style="vertical-align:middle"><div class="photo_batiment" id="photo2" ></div></td>
<td class="desciption_amelioration"><h2>${nom}</h2><span class="niveau_amelioration">niveau 12</span><br/></td>
<td class="cout_amelioration"><table style="display:inline-block">
	<tr title="Temps de Construction"><td><img alt="Temps :" src="/images/icone/icone_sablier.gif" width="17" height="18" /></td><td  class="temps">11H 18m 22s  </td></tr>
	<tr title="Materiaux" ><td><img alt="Materiaux :" src="/images/icone/icone_bois.png" width="18" height="17" /></td><td class="materiaux${manquant ? " rouge" : ""}">${materiaux}</td></tr>
	${manquant ? `<tr title="Temps pour récolter les matériaux manquants"><td><img src="images/icone/horloge.png" width="18" height="18"/></td><td>${manquant}</td></tr>` : ""}
	</table></td><td style="vertical-align:middle;"></td></tr><tr><td class="separateur" colspan="4"></td></tr>`;
}
/** Ligne d'une recherche de la page Laboratoire. */
function recherche(nom: string, ouvrieres: string, nourriture: string, materiaux: string) {
  return `<tr class="ligneAmelioration" ><td style="vertical-align:middle"><div class="photo_recherche" id="photo1" ></div></td>
<td class="desciption_amelioration"><h2>${nom}</h2><span class="niveau_amelioration">niveau 8</span><br/></td>
<td class="cout_amelioration"><table style="display:inline-block;vertical-align:middle;">
	<tr><td><div class="icone_temps"><img alt="Temps :" src="/images/icone/icone_sablier.gif" width="17" height="18" title="Temps" /></div></td><td><div class="temps" style= "min-width:70px">10H 19m 16s </div></td></tr>
	<tr><td><div class="icone_ouvirere"><img alt="Ouvrière :" src="/images/icone/icone_ouvriere.png" width="30" height="18" title="Ouvrière" /></div></td><td style= "min-width:70px"><div class="ouvriere" >${ouvrieres} </div></td></tr>
	<tr><td><div class="icone_nourriture"><img alt="Nourriture :" src="/images/icone/icone_pomme.png" width="18" height="18" title="Nourriture" /></div></td><td style= "min-width:70px"><div class="nourriture" >${nourriture} </div></td></tr>
	<tr><td><div class="icone_materiaux"><img alt="Materiaux :" src="/images/icone/icone_bois.png" width="18" height="17" title="Materiaux" /></div></td><td style= "min-width:70px"><div class="materiaux" >${materiaux} </div></td></tr>
</table></td><td style="vertical-align:middle;"></td></tr><tr><td class="separateur" colspan="4"></td></tr>`;
}
const tableau = (lignes: string) =>
  `<div id="centre"><table style="border-collapse: collapse;">${lignes}</table></div>`;
/** Page Convois du jeu : un convoi qui part, un qui arrive. */
const PAGE_CONVOIS = `<div id="data" style="display:none"><div id="quantite_tdc">19095</div></div><div id="centre">
<h3>Convois en cours:</h3><strong>- Vous allez livrer 200 000 <img alt="nourritures" src="images/icone/nourriture.gif"/> et 0 <img alt="materiaux" src="images/icone/materiaux.gif"/> à  <a href="Membre.php?Pseudo=Bravo">Bravo</a> dans 8H 55m 20s  </strong> - <small><em>Retour le 25 oct. à 15h32</em></small> - <a href="commerce.php?annuler=1&amp;t=x">Annuler</a><br />
<strong>- Vous allez recevoir 50 000 <img alt="nourritures" src="images/icone/nourriture.gif"/> et 1 000 000 <img alt="materiaux" src="images/icone/materiaux.gif"/> de  <a href="Membre.php?Pseudo=Alpha">Alpha</a> dans 2H 00m 00s  </strong><br />
</div>`;
/** Page Convois sans convoi qui arrive. */
const SANS_CONVOI = `<div id="data" style="display:none"><div id="quantite_tdc">19095</div></div><div id="centre"><h3>Convois en cours:</h3></div>`;
const noterRecolte = (lecture: object) =>
  lire(
    `localStorage.setItem("fzzz_recolte", JSON.stringify({ moi: Object.assign({ lu: heure, pille: [0, 0], taux: 0 }, ${JSON.stringify(lecture)}) }))`,
  );
/** Ouvre la page et pose les info-bulles ; attend la lecture de la page Convois. */
const ouvrir = async (html: string) => {
  lire(`(() => { document.body.innerHTML = ${JSON.stringify(html)}; })()`);
  await lire(`DelaiRessources.installer()`);
};
/** Lignes de l'info-bulle d'une ligne de la page (rang), espaces réduits. */
const lignes = (rang: number) =>
  lire<string[]>(`(() => {
    let d = $("<div>").html(DelaiRessources._contenu.call($(".o_delaiRessources")[${rang}]));
    d.find("br").replaceWith("\\n");
    d.find("div").before("\\n").after("\\n");
    return d.text().split("\\n").map((l) => l.replace(/\\s+/g, " ").trim()).filter(Boolean);
  })()`);
/** Lignes en gras. */
const gras = (rang: number) =>
  lire<string[]>(
    `$("<div>").html(DelaiRessources._contenu.call($(".o_delaiRessources")[${rang}])).find("b").map((i, b) => $(b).text()).get()`,
  );
/** Valeurs colorées : [texte, classe]. */
const couleurs = (rang: number) =>
  lire<string[][]>(
    `$("<div>").html(DelaiRessources._contenu.call($(".o_delaiRessources")[${rang}])).find(".o_delaiPlus, .o_delaiMoins").map((i, e) => [[$(e).text(), e.className]]).get()`,
  );
/** Texte de l'info-bulle d'une ligne (rang dans la page), espaces réduits. */
const bulle = (rang: number) =>
  lire<string>(
    `$("<div>").html(DelaiRessources._contenu.call($(".o_delaiRessources")[${rang}])).text().replace(/\\s+/g, " ")`,
  );

beforeEach(() =>
  lire(`(() => {
    localStorage.clear();
    heure = ${HEURE};
    monProfil.niveauConstruction = [-1, 10, 13];
    APPELS = [];
    JOURNAL = [];
    REPONSE = () => $.Deferred().resolve(${JSON.stringify(SANS_CONVOI)}).promise();
    RECUS = () => Promise.resolve([]);
    Journal.info = (s, m, d) => JOURNAL.push(m + " : " + d);
    Entrepots.convoisLus = null;
    $.ajax = (o) => (APPELS.push(o.url), REPONSE(o));
  })()`),
);

describe("coût des lignes", () => {
  test("bâtiment : matériaux seuls ; recherche : nourriture et matériaux, pas les ouvrières", () => {
    lire(
      `(() => { document.body.innerHTML = ${JSON.stringify(
        tableau(
          batiment("Couveuse", "9 830 400", "6J 21h ") +
            recherche("Acide", "10 000", "200 000", "600 000"),
        ),
      )}; })()`,
    );
    expect(
      lire(`$(".ligneAmelioration").map((i, e) => [DelaiRessources.cout($(e))]).get()`),
    ).toEqual([
      [0, 9830400],
      [200000, 600000],
    ]);
  });
});

describe("heure où les ressources suffisent", () => {
  test("matériaux d'un bâtiment : à une récolte du jeu, comme le temps du jeu (6J 21h)", async () => {
    noterRecolte({ recolte: HEURE + 227000 });
    await ouvrir(
      encart([220554, 3498463]) + INFOBULLE + tableau(batiment("Couveuse", "9 830 400", "6J 21h ")),
    );
    // 6 331 937 qui manquent, 19 095 à chaque récolte : 332 récoltes, la 1re à 10h03m47
    let r = lire(`DelaiRessources.calculer([0, 9830400], Entrepots.etat(heure))[1]`);
    expect(r.manque).toBe(6331937);
    expect(r.atteint).toBe(HEURE + 227000 + 331 * 30 * MIN);
    // 332 × 19 095 = 6 339 540 ; durée en minutes de l'horloge : 10h00 → 07h33
    expect(lignes(0)).toEqual([
      "Matériaux dispo dans 6j 21h 33m (Le 25/11 à 07h33)",
      "332 cycles : les 332 récoltes du jeu (une toutes les 30 min) de 10h03 au 25/11 à 07h33",
      "Prod TdC : +6 339 540 bois en 332 cycles",
    ]);
    expect(gras(0)).toEqual(["Matériaux dispo dans 6j 21h 33m (Le 25/11 à 07h33)"]);
    expect(couleurs(0)).toEqual([["+6 339 540 bois", "o_delaiPlus"]]);
  });

  test("recherche : une ligne par ressource ; seul ce qui compte pour les pommes qui manquent est détaillé", async () => {
    noterRecolte({ recolte: HEURE + 227000 });
    await ouvrir(
      encart([220554, 3498463]) +
        INFOBULLE +
        tableau(recherche("Vitesse de chasse", "12 800", "1 024 000", "640 000")),
    );
    // pommes : champignonnière et armée à chaque récolte, 553 439 ÷ 48 = 11 529,98 ;
    // 803 446 qui manquent : 70 récoltes, la dernière le 19/11 à 20h33 ; le bois est déjà là
    // 595 612 ÷ 48 × 70 = 868 601 ; −42 173 ÷ 48 × 70 = −61 502 ; ensemble 807 099
    expect(lignes(0)).toEqual([
      "Pommes dispo dans 1j 10h 33m (Le 19/11 à 20h33)",
      "70 cycles : les 70 récoltes du jeu (une toutes les 30 min) de 10h03 au 19/11 à 20h33",
      "Champi : +868 601 pommes en 70 cycles",
      "Armée : −61 502 pommes en 70 cycles",
      "Matériaux suffisants",
    ]);
    expect(gras(0)).toEqual(["Pommes dispo dans 1j 10h 33m (Le 19/11 à 20h33)"]);
    expect(couleurs(0)).toEqual([
      ["+868 601 pommes", "o_delaiPlus"],
      ["−61 502 pommes", "o_delaiMoins"],
    ]);
  });

  test("les deux manquent : la plus restrictive (la plus tardive) en premier et en gras", async () => {
    noterRecolte({ recolte: HEURE + 227000 });
    await ouvrir(
      encart([220554, 3498463]) +
        INFOBULLE +
        tableau(recherche("Bouclier", "20 480", "300 000", "5 000 000")),
    );
    // bois : 1 501 537 qui manquent, 79 récoltes ; pommes : 79 446, 7 récoltes
    // chaque ressource a son nombre de cycles
    expect(lignes(0)).toEqual([
      "Matériaux dispo dans 1j 15h 03m (Le 20/11 à 01h03)",
      "79 cycles : les 79 récoltes du jeu (une toutes les 30 min) de 10h03 au 20/11 à 01h03",
      "Prod TdC : +1 508 505 bois en 79 cycles",
      "Pommes dispo dans 3h 03m (Le 18/11 à 13h03)",
      "7 cycles : les 7 récoltes du jeu (une toutes les 30 min) de 10h03 à 13h03",
      "Champi : +86 860 pommes en 7 cycles",
      "Armée : −6 150 pommes en 7 cycles",
    ]);
    expect(gras(0)).toEqual(["Matériaux dispo dans 1j 15h 03m (Le 20/11 à 01h03)"]);
  });

  test("vassal : la part du seigneur est prise à chaque récolte sur le terrain et la champignonnière", async () => {
    noterRecolte({ recolte: HEURE + 227000, pille: [178684, 274968], taux: 0.3 });
    await ouvrir(
      encart([220554, 3498463]) +
        INFOBULLE +
        tableau(recherche("Vitesse de chasse", "12 800", "1 024 000", "640 000")),
    );
    let r = lire(`DelaiRessources.calculer([1024000, 0], Entrepots.etat(heure))[0]`);
    // (595 612 × 0,7 − 42 173) ÷ 48 = 7 807,4 par récolte : 103 récoltes
    expect(r.atteint).toBe(HEURE + 227000 + 102 * 30 * MIN);
    // pillage : 30 % de 595 612 par jour, ÷ 48 × 103 = −383 425
    expect(lignes(0)).toEqual([
      "Pommes dispo dans 2j 3h 03m (Le 20/11 à 13h03)",
      "103 cycles : les 103 récoltes du jeu (une toutes les 30 min) de 10h03 au 20/11 à 13h03",
      "Champi : +1 278 084 pommes en 103 cycles",
      "Armée : −90 496 pommes en 103 cycles",
      "Pillage : −383 425 pommes en 103 cycles",
      "Matériaux suffisants",
    ]);
  });

  test("plus que ne contient l'entrepôt : le niveau d'entrepôt requis, sans détail", async () => {
    await ouvrir(
      encart([220554, 3498463]) +
        INFOBULLE +
        tableau(recherche("Poison", "250 000", "40 000 000", "15 000 000")),
    );
    // 500 + 1 200 × 2^16 = 78 643 700 (2^15 : 39 322 100) ; 500 + 1 200 × 2^14 = 19 661 300
    expect(lignes(0)).toEqual([
      "REQUIS : Entrepôt de Nourriture niveau 16",
      "REQUIS : Entrepôt de Matériaux niveau 14",
    ]);
  });

  test("déjà en stock : suffisants, rien d'autre", async () => {
    await ouvrir(encart([220554, 3498463]) + INFOBULLE + tableau(batiment("Dôme", "28 000")));
    expect(lignes(0)).toEqual(["Matériaux suffisants"]);
    expect(gras(0)).toEqual([]);
  });

  test("production qui baisse sans convoi : jamais", async () => {
    lire(
      `REPONSE = () => $.Deferred().resolve('<div id="data"><div id="quantite_tdc">1</div></div><div id="centre"></div>').promise()`,
    );
    await ouvrir(
      encart([220554, 3498463]) +
        infobulle(["-42 173", "+0"], ["0", "0"], "0", "-42 173") +
        tableau(recherche("Armes", "40 960", "300 000", "102 400")),
    );
    // jamais : pas de cycles, ce que le calcul compte par jour
    expect(lignes(0)).toEqual([
      "Pommes jamais suffisantes avec la production actuelle",
      "Armée : −42 173 pommes/jour",
      "Matériaux suffisants",
      "Heure des récoltes inconnue : ouvre la page Ressources.",
    ]);
  });

  test("heure des récoltes inconnue : production étalée, et l'info-bulle le dit", async () => {
    await ouvrir(
      encart([220554, 3498463]) + INFOBULLE + tableau(batiment("Couveuse", "9 830 400")),
    );
    expect(lignes(0)).toContain("Heure des récoltes inconnue : ouvre la page Ressources.");
  });
});

describe("convois qui arrivent : page Convois relue à l'ouverture", () => {
  test("une lecture de la page Convois ; le convoi qui arrive est compté, pas celui qui part", async () => {
    noterRecolte({ recolte: HEURE + 227000 });
    lire(`REPONSE = () => $.Deferred().resolve(${JSON.stringify(PAGE_CONVOIS)}).promise()`);
    await ouvrir(
      encart([220554, 3498463]) + INFOBULLE + tableau(batiment("Couveuse", "9 830 400")),
    );
    expect(lire(`APPELS`)).toEqual(["/commerce.php"]);
    expect(lire(`Entrepots.convoisLus`)).toEqual([
      { de: "Alpha", t: HEURE + 2 * H, q: [50000, 1000000] },
    ]);
    // 1 000 000 de plus dans 2 h : 5 331 937 à récolter, 280 récoltes
    expect(lire(`DelaiRessources.calculer([0, 9830400], Entrepots.etat(heure))[1].atteint`)).toBe(
      HEURE + 227000 + 279 * 30 * MIN,
    );
    // un bâtiment ne coûte pas de pommes : seule la part en bois du convoi est montrée
    expect(lignes(0)).toEqual([
      "Matériaux dispo dans 5j 19h 33m (Le 24/11 à 05h33)",
      "280 cycles : les 280 récoltes du jeu (une toutes les 30 min) de 10h03 au 24/11 à 05h33",
      "Prod TdC : +5 346 600 bois en 280 cycles",
      "1 convoi : +1 000 000 bois",
    ]);
  });

  test("ligne en <span> (forme réelle inconnue, 19/11/2026) : comptée ; ligne illisible : dite, pas comptée", async () => {
    noterRecolte({ recolte: HEURE + 227000 });
    const page = (lignes: string) =>
      `<div id="data" style="display:none"><div id="quantite_tdc">19095</div></div><div id="centre"><h3>Convois en cours:</h3>${lignes}</div>`;
    lire(
      `REPONSE = () => $.Deferred().resolve(${JSON.stringify(
        page(
          `<span>- Vous allez recevoir 0 <img alt="nourritures" src="n.gif"/> et 1 000 000 <img alt="materiaux" src="m.gif"/> de <a href="Membre.php?Pseudo=Alpha">Alpha</a> dans <span id="convoi_3">2H 00m 00s </span></span><script>reste(7200, "convoi_3");</script><br />`,
        ),
      )}).promise()`,
    );
    await ouvrir(
      encart([220554, 3498463]) + INFOBULLE + tableau(batiment("Couveuse", "9 830 400")),
    );
    expect(lignes(0)).toEqual([
      "Matériaux dispo dans 5j 19h 33m (Le 24/11 à 05h33)",
      "280 cycles : les 280 récoltes du jeu (une toutes les 30 min) de 10h03 au 24/11 à 05h33",
      "Prod TdC : +5 346 600 bois en 280 cycles",
      "1 convoi : +1 000 000 bois",
    ]);

    lire(
      `REPONSE = () => $.Deferred().resolve(${JSON.stringify(
        page(
          `<span>- Vous allez recevoir 0 et 1 000 000 de Alpha, arrivée le 18/11 à 12h00</span><br />`,
        ),
      )}).promise()`,
    );
    await ouvrir(
      encart([220554, 3498463]) + INFOBULLE + tableau(batiment("Couveuse", "9 830 400")),
    );
    expect(lignes(0)).toEqual([
      "Matériaux dispo dans 6j 21h 33m (Le 25/11 à 07h33)",
      "332 cycles : les 332 récoltes du jeu (une toutes les 30 min) de 10h03 au 25/11 à 07h33",
      "Prod TdC : +6 339 540 bois en 332 cycles",
      "Un convoi qui arrive n'a pas pu être lu sur la page Convois : pas compté.",
    ]);
    expect(lire(`JOURNAL`)).toEqual([
      expect.stringContaining("1 convoi(s) qui arrive(nt) illisible(s) sur la page Convois : "),
    ]);
  });

  test("convoi qui arrive après que la ressource suffit : pas compté", async () => {
    noterRecolte({ recolte: HEURE + 227000 });
    lire(
      `REPONSE = () => $.Deferred().resolve(${JSON.stringify(PAGE_CONVOIS.replace("2H 00m 00s", "9J 0H 00m 00s"))}).promise()`,
    );
    await ouvrir(
      encart([220554, 3498463]) + INFOBULLE + tableau(batiment("Couveuse", "9 830 400")),
    );
    expect(lignes(0)).toEqual([
      "Matériaux dispo dans 6j 21h 33m (Le 25/11 à 07h33)",
      "332 cycles : les 332 récoltes du jeu (une toutes les 30 min) de 10h03 au 25/11 à 07h33",
      "Prod TdC : +6 339 540 bois en 332 cycles",
    ]);
  });

  test("page Convois sans réponse : convois de la dernière visite, et l'info-bulle le dit", async () => {
    lire(`REPONSE = () => $.Deferred().reject({ status: 0, statusText: "timeout" }).promise()`);
    lire(`localStorage.setItem("outiiil_evolution", JSON.stringify({ convoi: [
      { cible: "Charlie", sens: false, nou: "0", mat: "500000", exp: moment(heure + ${3 * H}).toISOString() },
      { cible: "Bravo", sens: true, nou: "0", mat: "90000", exp: moment(heure + ${H}).toISOString() },
    ] }))`);
    noterRecolte({ recolte: HEURE + 227000 });
    await ouvrir(
      encart([220554, 3498463]) + INFOBULLE + tableau(batiment("Couveuse", "9 830 400")),
    );
    expect(lignes(0).slice(1)).toEqual([
      "306 cycles : les 306 récoltes du jeu (une toutes les 30 min) de 10h03 au 24/11 à 18h33",
      "Prod TdC : +5 843 070 bois en 306 cycles",
      "1 convoi : +500 000 bois",
      "Page Convois pas relue (pas de réponse en 5 s) : convois de ta dernière visite.",
    ]);
    expect(lire(`JOURNAL`)).toEqual(["page Convois non relue : pas de réponse en 5 s"]);
  });

  test("réponse qui n'est pas une page du jeu (connexion perdue) : échec, pas « aucun convoi »", async () => {
    lire(
      `REPONSE = () => $.Deferred().resolve("<html><body><form id='login'></form></body></html>").promise()`,
    );
    await ouvrir(
      encart([220554, 3498463]) + INFOBULLE + tableau(batiment("Couveuse", "9 830 400")),
    );
    expect(lignes(0)).toContain(
      "Page Convois pas relue (la réponse n'est pas la page Convois) : convois de ta dernière visite.",
    );
  });

  test("page sans coût (aucune ligne) : aucune requête", async () => {
    await ouvrir(encart([220554, 3498463]) + INFOBULLE + `<div id="centre"></div>`);
    expect(lire(`APPELS`)).toEqual([]);
  });
});

/** Ligne horloge de la cellule du coût d'une ligne (rang) : la nôtre, et celle du Compte+. */
const ligneHorloge = (rang: number) =>
  lire<{ valeur: string | null; requis: boolean; jeu: string | null; derniere: boolean }>(`(() => {
    const td = $(".o_delaiRessources").eq(${rang}),
      l = td.find("tr.o_delaiLigne"),
      jeu = td.find("tr[title^='Temps pour récolter']");
    const v = l.find(".o_delaiValeur"), requis = v.find(".o_delaiRequis");
    return {
      valeur: !l.length ? null : requis.length ? requis.map((i, e) => $(e).text()).get().join(" / ") : v.text(),
      requis: requis.length > 0,
      jeu: jeu.length ? jeu.css("display") : null,
      derniere: td.find("table tr").last().hasClass("o_delaiLigne"),
    };
  })()`);

describe("cellule du coût : notre délai à la place de celui du Compte+", () => {
  test("Compte+ : sa ligne cachée, la nôtre juste après, comptée depuis l'ouverture de la page", async () => {
    noterRecolte({ recolte: HEURE + 227000 });
    await ouvrir(
      encart([220554, 3498463]) + INFOBULLE + tableau(batiment("Couveuse", "9 830 400", "6J 21h ")),
    );
    expect(ligneHorloge(0)).toEqual({
      valeur: "dispo dans 6j 21h 33m",
      requis: false,
      jeu: "none",
      derniere: true,
    });
    // la durée d'un seul tenant : la cellule se replie après « dispo dans », pas au milieu
    expect(lire(`$(".o_delaiValeur .o_delaiDuree").first().text()`)).toBe("6j 21h 33m");
  });

  test("sans Compte+ et au Laboratoire (le jeu n'a pas de ligne) : la nôtre ajoutée sous le coût", async () => {
    noterRecolte({ recolte: HEURE + 227000 });
    await ouvrir(
      encart([220554, 3498463]) +
        INFOBULLE +
        tableau(
          batiment("Couveuse", "9 830 400") +
            recherche("Bouclier", "20 480", "300 000", "5 000 000"),
        ),
    );
    expect(ligneHorloge(0)).toEqual({
      valeur: "dispo dans 6j 21h 33m",
      requis: false,
      jeu: null,
      derniere: true,
    });
    // la ressource la plus tardive : le bois (79 cycles), les pommes suffisent avant
    expect(ligneHorloge(1).valeur).toBe("dispo dans 1j 15h 03m");
  });

  test("convoi qui arrive : compté dans la ligne, relue après la page Convois", async () => {
    noterRecolte({ recolte: HEURE + 227000 });
    lire(`REPONSE = () => $.Deferred().resolve(${JSON.stringify(PAGE_CONVOIS)}).promise()`);
    await ouvrir(
      encart([220554, 3498463]) + INFOBULLE + tableau(batiment("Couveuse", "9 830 400", "6J 21h ")),
    );
    expect(ligneHorloge(0).valeur).toBe("dispo dans 5j 19h 33m");
    // gardé pour les autres pages (encart « Plein dans … »)
    expect(lire(`Entrepots.convoisGardes()`)).toEqual([
      { de: "Alpha", t: HEURE + 2 * H, q: [50000, 1000000] },
    ]);
  });

  test("entrepôt trop petit : le niveau requis, en rouge ; jamais ; plus d'un an", async () => {
    noterRecolte({ recolte: HEURE + 227000 });
    await ouvrir(
      encart([220554, 3498463]) +
        INFOBULLE +
        tableau(recherche("Poison", "250 000", "40 000 000", "15 000 000")),
    );
    expect(ligneHorloge(0)).toMatchObject({
      valeur:
        "REQUIS : Entrepôt de Nourriture niveau 16 / REQUIS : Entrepôt de Matériaux niveau 14",
      requis: true,
    });
    await ouvrir(
      encart([220554, 3498463]) +
        infobulle(["-42 173", "+48"], ["0", "48"], "0", "-42 173") +
        tableau(
          recherche("Armes", "40 960", "300 000", "102 400") + batiment("Couveuse", "9 830 400"),
        ),
    );
    expect(ligneHorloge(0)).toMatchObject({ valeur: "jamais", requis: false });
    // 1 bois par récolte : pas d'ici un an
    expect(ligneHorloge(1)).toMatchObject({ valeur: "> 1 an", requis: false });
  });

  test("rien ne manque : pas de ligne ; production inconnue : « ? »", async () => {
    await ouvrir(encart([220554, 3498463]) + INFOBULLE + tableau(batiment("Dôme", "28 000")));
    expect(ligneHorloge(0).valeur).toBeNull();
    await ouvrir(
      encart([220554, 3498463]) +
        tableau(batiment("Couveuse", "9 830 400", "6J 21h ") + batiment("Dôme", "28 000")),
    );
    expect(ligneHorloge(0)).toMatchObject({ valeur: "?", jeu: "none" });
    expect(ligneHorloge(1).valeur).toBeNull();
  });
});

describe("cycles de récolte", () => {
  test("récoltes comptées comme simuler : la première pas avant l'ouverture, toutes les 30 min", () => {
    const r = (prochaine: number, debut: number, fin: number) =>
      lire(`Entrepots.recoltes(${prochaine}, ${debut}, ${fin})`);
    expect(r(HEURE - 10 * MIN, HEURE, HEURE + 50 * MIN)).toEqual({
      nombre: 2,
      premiere: HEURE + 20 * MIN,
      derniere: HEURE + 50 * MIN,
    });
    // une récolte à l'instant même compte, comme dans simuler
    expect(r(HEURE, HEURE, HEURE)).toEqual({ nombre: 1, premiere: HEURE, derniere: HEURE });
    expect(r(HEURE + 10 * MIN, HEURE, HEURE + 5 * MIN)).toEqual({
      nombre: 0,
      premiere: null,
      derniere: null,
    });
    // 100 par récolte : 250 de plus à la 3e récolte
    const atteint = lire<number>(
      `Entrepots.simuler({ stock: 0, capacite: 1000, parJour: 4800, prochaine: ${HEURE - 10 * MIN}, convois: [], maintenant: ${HEURE}, objectif: 250 }).atteint`,
    );
    expect(lire(`Entrepots.recoltes(${HEURE - 10 * MIN}, ${HEURE}, ${atteint}).nombre`)).toBe(3);
  });

  test("une seule récolte ; atteint par un convoi avant la première récolte : pas de cycle", async () => {
    noterRecolte({ recolte: HEURE + 227000 });
    await ouvrir(encart([220554, 3498463]) + INFOBULLE + tableau(batiment("Remise", "3 508 463")));
    expect(lignes(0)).toEqual([
      "Matériaux dispo dans 3m (Le 18/11 à 10h03)",
      "1 cycle : la récolte du jeu de 10h03",
      "Prod TdC : +19 095 bois en 1 cycle",
    ]);
    lire(
      `REPONSE = () => $.Deferred().resolve(${JSON.stringify(PAGE_CONVOIS.replace("2H 00m 00s", "1m 00s"))}).promise()`,
    );
    await ouvrir(encart([220554, 3498463]) + INFOBULLE + tableau(batiment("Silo", "3 998 463")));
    expect(lignes(0)).toEqual([
      "Matériaux dispo dans 1m (Le 18/11 à 10h01)",
      "1 convoi : +1 000 000 bois",
    ]);
  });

  test("heure des récoltes inconnue : cycles estimés (durée ÷ 30 min), production étalée", async () => {
    await ouvrir(
      encart([220554, 3498463]) + INFOBULLE + tableau(batiment("Couveuse", "9 830 400")),
    );
    // 6 331 937 ÷ 916 560 = 6,908 jours, × 48 = 331,6 cycles
    expect(lignes(0).slice(1, 3)).toEqual([
      "≈ 332 cycles de 30 min (heure des récoltes inconnue)",
      "Prod TdC : +6 331 937 bois en ≈ 332 cycles",
    ]);
  });

  test("durée en minutes de l'horloge", () => {
    const d = (min: number, debut = HEURE) =>
      lire(`DelaiRessources.duree(${debut}, ${debut + min * MIN})`);
    expect([d(0), d(5), d(3 * 60 + 7), d(24 * 60), d(24 * 60 + 5), d(34 * 60 + 12)]).toEqual([
      "1m",
      "5m",
      "3h 07m",
      "1j",
      "1j 5m",
      "1j 10h 12m",
    ]);
    // de 10h00m50 à 10h01m10 : une minute de l'horloge
    expect(lire(`DelaiRessources.duree(${HEURE + 50000}, ${HEURE + 70000})`)).toBe("1m");
  });
});

describe("sans Compte+ : convois qui arrivent lus dans le forum", () => {
  test("le sujet commun des convois remplace la page Convois, que le jeu ne montre qu'avec le Compte+", async () => {
    noterRecolte({ recolte: HEURE + 227000 });
    lire(
      `RECUS = () => Promise.resolve([{ de: "Alpha", t: heure + ${2 * H}, q: [50000, 1000000] }])`,
    );
    await ouvrir(
      encart([220554, 3498463], false) + INFOBULLE + tableau(batiment("Couveuse", "9 830 400")),
    );
    expect(lire(`APPELS`)).toEqual([]);
    // même calcul qu'avec la page Convois : 1 000 000 de plus dans 2 h
    expect(ligneHorloge(0).valeur).toBe("5j 19h 33m");
    expect(lignes(0)).toContain("1 convoi : +1 000 000 bois");
    expect(lire(`Entrepots.convoisGardes()`)).toEqual([
      { de: "Alpha", t: HEURE + 2 * H, q: [50000, 1000000] },
    ]);
  });

  test("forum illisible : convois de la dernière lecture, et l'info-bulle le dit", async () => {
    noterRecolte({ recolte: HEURE + 227000 });
    lire(`RECUS = () => Promise.reject(new Error("absente"))`);
    await ouvrir(
      encart([220554, 3498463], false) + INFOBULLE + tableau(batiment("Couveuse", "9 830 400")),
    );
    expect(lignes(0)).toContain(
      "Convois du forum pas relus (section « BDD partagée cachée » introuvable) : ceux de la dernière lecture.",
    );
    expect(lire(`JOURNAL`)).toEqual([
      "convois du forum non relus : section « BDD partagée cachée » introuvable",
    ]);
  });
});

describe("survol", () => {
  test("les title du jeu sont retirés pendant le survol puis remis", async () => {
    await ouvrir(
      encart([220554, 3498463]) + INFOBULLE + tableau(batiment("Couveuse", "9 830 400", "6J 21h ")),
    );
    const titres = () => lire<number>(`$(".o_delaiRessources [title]").length`);
    expect(titres()).toBe(3);
    lire(
      `$(".o_delaiRessources tr[title]")[1].dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))`,
    );
    expect(titres()).toBe(0);
    lire(`$(".o_delaiRessources")[0].dispatchEvent(new MouseEvent("mouseleave"))`);
    expect(titres()).toBe(3);
    expect(lire(`$(".o_delaiRessources tr").first().attr("title")`)).toBe("Temps de Construction");
  });
});

describe("toucher (téléphone)", () => {
  test("un clic ouvre l'info-bulle sans survol ; un clic ailleurs la ferme et remet les title", async () => {
    await ouvrir(
      encart([220554, 3498463]) +
        INFOBULLE +
        tableau(batiment("Couveuse", "9 830 400", "6J 21h ") + batiment("Dôme", "28 000")),
    );
    const ouvertes = () => lire<number>(`$(".o_delaiRessources[aria-describedby]").length`);
    lire(`$(".o_delaiRessources").eq(0).trigger("click")`);
    expect(ouvertes()).toBe(1);
    expect(lire(`$(".o_delaiInfobulle").last().text()`)).toContain("Matériaux dispo dans");
    expect(lire<number>(`$(".o_delaiRessources").eq(0).find("[title]").length`)).toBe(0);
    // une autre cellule : la première se ferme
    lire(`$(".o_delaiRessources").eq(1).trigger("click")`);
    expect(
      lire(
        `$(".o_delaiRessources[aria-describedby]").map((i, e) => $(".o_delaiRessources").index(e)).get()`,
      ),
    ).toEqual([1]);
    expect(lire<number>(`$(".o_delaiRessources").eq(0).find("[title]").length`)).toBe(3);
    lire(`$("#boiteInfo").trigger("click")`);
    expect(ouvertes()).toBe(0);
    expect(lire<number>(`$(".o_delaiRessources [title]").length`)).toBe(5);
  });
});
