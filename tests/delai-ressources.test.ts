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
   var APPELS = [], REPONSE = null, JOURNAL = [];`,
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
/** Encart « S5 Pseudo » et données cachées du jeu. */
function encart(stock: [number, number]) {
  return `<div id="data" style="display:none"><div id="pseudo">Moi</div><div id="nb_ouvrieres">68031</div><div id="nb_materiaux">${stock[1]}</div><div id="nb_nourriture">${stock[0]}.21851002632</div><div id="quantite_tdc">19095</div></div>
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
    expect(lignes(0)).toEqual([
      "Matériaux suffisants dans 6j21h (Le 25/11 à 07h33)",
      "Production TdC : +916 560 bois/jour",
    ]);
    expect(gras(0)).toEqual(["Matériaux suffisants dans 6j21h (Le 25/11 à 07h33)"]);
    expect(couleurs(0)).toEqual([["+916 560 bois/jour", "o_delaiPlus"]]);
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
    expect(lignes(0)).toEqual([
      "Pommes suffisantes dans 1j10h (Le 19/11 à 20h33)",
      "Matériaux suffisants",
      "Champi : +595 612 pommes/jour",
      "Armée : −42 173 pommes/jour",
    ]);
    expect(gras(0)).toEqual(["Pommes suffisantes dans 1j10h (Le 19/11 à 20h33)"]);
    expect(couleurs(0)).toEqual([
      ["+595 612 pommes/jour", "o_delaiPlus"],
      ["−42 173 pommes/jour", "o_delaiMoins"],
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
    expect(lignes(0)).toEqual([
      "Matériaux suffisants dans 1j15h (Le 20/11 à 01h03)",
      "Pommes suffisantes dans 3h04 (Le 18/11 à 13h03)",
      "Production TdC : +916 560 bois/jour",
      "Champi : +595 612 pommes/jour",
      "Armée : −42 173 pommes/jour",
    ]);
    expect(gras(0)).toEqual(["Matériaux suffisants dans 1j15h (Le 20/11 à 01h03)"]);
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
    expect(lignes(0)).toEqual([
      "Pommes suffisantes dans 2j3h (Le 20/11 à 13h03)",
      "Matériaux suffisants",
      "Pillage : −178 684 pommes/jour",
      "Champi : +595 612 pommes/jour",
      "Armée : −42 173 pommes/jour",
    ]);
  });

  test("plus que ne contient l'entrepôt : jamais, sans détail", async () => {
    await ouvrir(
      encart([220554, 3498463]) +
        INFOBULLE +
        tableau(recherche("Poison", "250 000", "40 000 000", "15 000 000")),
    );
    expect(lignes(0)).toEqual([
      "Pommes jamais suffisantes : entrepôt trop petit (1 229 300)",
      "Matériaux jamais suffisants : entrepôt trop petit (9 830 900)",
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
    expect(lignes(0)).toEqual([
      "Pommes jamais suffisantes avec la production actuelle",
      "Matériaux suffisants",
      "Armée : −42 173 pommes/jour",
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
      "Matériaux suffisants dans 5j19h (Le 24/11 à 05h33)",
      "Production TdC : +916 560 bois/jour",
      "Convoi : +1 000 000 bois",
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
      "Matériaux suffisants dans 6j21h (Le 25/11 à 07h33)",
      "Production TdC : +916 560 bois/jour",
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
      "Production TdC : +916 560 bois/jour",
      "Convoi : +500 000 bois",
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
    expect(lire(`$(".o_delaiInfobulle").last().text()`)).toContain("Matériaux suffisants dans");
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
