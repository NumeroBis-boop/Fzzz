import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

// Convoi avant la récolte (idée de KWHWWYMWN) : les ouvrières qui reviennent de
// convoi avant une récolte peuvent partir, celles du terrain de mes chasses et
// de mes attaques arrivées d'ici là restent ; les pondues ne comptent pas (essai
// de KWHWWYMWN, 15/11/2026). Joueurs et montants inventés.
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
    "js/class/AttaqueLancee.js",
    "js/class/ExportRapports.js",
    "js/page/PartageChasses.js",
    "js/page/Ressource.js",
    "js/page/CommerceFzzz.js",
    "js/content.js",
  ],
  `var chrome = { runtime: { getManifest: () => ({ version: "0" }), getURL: (p) => p } };
   var NOW = moment("2026-11-14T14:00:00").valueOf();
   var Horloge = { serveur: () => moment(NOW), maintenant: () => NOW, serveurA: () => moment(NOW) };
   document.body.innerHTML = "<div class='boite_connexion_titre'>Connexion</div>";`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);
// instant du jour de test (heure du serveur)
const a = (hhmmss: string) => lire<number>(`moment("2026-11-14T${hhmmss}").valueOf()`);
const espaces = (t: string) => t.replace(/[\s  ]+/g, " ");

const calcul = (d: object) =>
  lire<{ libres: number; recolte: number; revenues: number; gagne: number; attaques: number }>(
    `CommerceFzzz.libresAvantRecolte(${JSON.stringify(d)})`,
  );

describe("ouvrières libres avant la récolte : le calcul", () => {
  test("rien n'arrive : les présentes moins le terrain, comme le remplissage habituel", () => {
    expect(calcul({ presentes: 15000, terrain: 14000, recolte: a("14:30:00") }).libres).toBe(1000);
    // plus de terrain que d'ouvrières : aucune
    expect(calcul({ presentes: 9000, terrain: 14000, recolte: a("14:30:00") }).libres).toBe(0);
  });

  test("convoi compté seulement si sa minute de retour est entière avant la récolte", () => {
    const avec = (minute: string, recolte: string) =>
      calcul({
        presentes: 15000,
        terrain: 14000,
        recolte: a(recolte),
        retours: [{ minute: a(minute), ouvrieres: 500 }],
      });
    // récolte à 14h30 : retour à 14h29 compté, à 14h30 non (compté à la suivante)
    expect(avec("14:29:00", "14:30:00").libres).toBe(1500);
    expect(avec("14:30:00", "14:30:00").libres).toBe(1000);
    // récolte à 14h30:20 : la minute 14h30 n'est pas finie
    expect(avec("14:29:00", "14:30:20").libres).toBe(1500);
    expect(avec("14:30:00", "14:30:20").libres).toBe(1000);
  });

  test("terrain des chasses : compté s'il change jusqu'à deux minutes après la récolte", () => {
    const avec = (impact: string) =>
      calcul({
        presentes: 15000,
        terrain: 14000,
        recolte: a("14:30:00"),
        retours: [{ minute: a("14:10:00"), ouvrieres: 3000 }],
        chasses: [{ impact: a(impact), terrain: 2500 }],
      });
    expect(avec("14:32:00")).toMatchObject({ libres: 1500, gagne: 2500, recolte: a("14:30:00") });
    // RC à 14h33 : pas pour la récolte de 14h30, mais pour celle de 15h00
    expect(avec("14:33:00")).toMatchObject({ libres: 1500, recolte: a("15:00:00"), gagne: 2500 });
  });

  test("terrain de mes attaques : compté comme celui des chasses, à part dans le résultat", () => {
    const avec = (impact: string) =>
      calcul({
        presentes: 15000,
        terrain: 14000,
        recolte: a("14:30:00"),
        retours: [{ minute: a("14:10:00"), ouvrieres: 3000 }],
        chasses: [{ impact: a("14:20:00"), terrain: 500 }],
        attaques: [{ impact: a(impact), terrain: 2000 }],
      });
    // 15 000 + 3 000 − (14 000 + 500 + 2 000)
    expect(avec("14:32:00")).toEqual({
      libres: 1500,
      recolte: a("14:30:00"),
      revenues: 3000,
      gagne: 500,
      attaques: 2000,
    });
    // RC à 14h33 : pour la récolte de 15h00
    expect(avec("14:33:00")).toMatchObject({
      libres: 1500,
      recolte: a("15:00:00"),
      attaques: 2000,
    });
  });

  test("la récolte qui limite : une chasse après la première récolte peut réduire le convoi", () => {
    const r = calcul({
      presentes: 15000,
      terrain: 14000,
      recolte: a("14:30:00"),
      retours: [
        { minute: a("14:20:00"), ouvrieres: 10000 },
        { minute: a("14:30:00"), ouvrieres: 7500 },
      ],
      chasses: [{ impact: a("14:41:00"), terrain: 10000 }],
    });
    // 14h30 : 15 000 + 10 000 − 14 000 = 11 000 ; 15h00 : + 7 500, − 10 000 cm² = 8 500
    expect(r).toEqual({
      libres: 8500,
      recolte: a("15:00:00"),
      revenues: 17500,
      gagne: 10000,
      attaques: 0,
    });
  });

  test("jamais plus que les présentes, jamais moins que 0", () => {
    expect(
      calcul({
        presentes: 5000,
        terrain: 4000,
        recolte: a("14:30:00"),
        retours: [{ minute: a("14:10:00"), ouvrieres: 50000 }],
      }).libres,
    ).toBe(5000);
    expect(
      calcul({
        presentes: 5000,
        terrain: 4000,
        recolte: a("14:30:00"),
        chasses: [{ impact: a("14:10:00"), terrain: 9000 }],
      }).libres,
    ).toBe(0);
  });

  test("récolte déjà passée ignorée : la suivante compte", () => {
    const r = calcul({
      presentes: 15000,
      terrain: 14000,
      recolte: a("13:59:00"),
      maintenant: a("14:00:00"),
      retours: [{ minute: a("14:10:00"), ouvrieres: 700 }],
    });
    expect(r).toMatchObject({ recolte: a("14:29:00"), libres: 1700 });
  });

  test("attaque lointaine : les récoltes sont examinées jusqu'à elle", () => {
    const r = calcul({
      presentes: 20000,
      terrain: 15000,
      recolte: a("14:30:00"),
      attaques: [{ impact: moment_jours(2), terrain: 1000 }],
    });
    expect(r).toMatchObject({ recolte: moment_jours(2), libres: 4000, attaques: 1000 });
  });
});

function moment_jours(n: number) {
  return lire<number>(`moment(NOW).add(${n}, "days").valueOf()`);
}

describe("retour des convois lu sur la page Convois", () => {
  const convois = (lignes: string) =>
    lire(
      `document.body.innerHTML = '<div id="centre"><h3>Convois en cours:</h3>' + ${JSON.stringify(lignes)} + '</div>'`,
    );
  // le compte à rebours du jeu finit au « Retour le » (Compte+)
  const ALPHA = `<strong>- Vous allez livrer 200 000 <img alt="nourritures" src="n.gif"/> et 0 <img alt="materiaux" src="m.gif"/> à  <a href="Membre.php?Pseudo=Alpha">Alpha</a> dans 20m 30s  </strong> - <small><em>Retour le 14 nov. à 14h20</em></small> - <a href="commerce.php?annuler=1&amp;t=x">Annuler</a><br />`;
  const BRAVO = `<strong>- Vous allez livrer 0 <img alt="nourritures" src="n.gif"/> et 150 001 <img alt="materiaux" src="m.gif"/> à  <a href="Membre.php?Pseudo=Bravo">Bravo</a> dans 30m 10s  </strong> - <small><em>Retour le 14 nov. à 14h30</em></small><br />`;
  const RECU = `<strong>- Vous allez recevoir 50 000 <img alt="nourritures" src="n.gif"/> et 25 000 <img alt="materiaux" src="m.gif"/> de  <a href="Membre.php?Pseudo=Charlie">Charlie</a> dans 45m 02s  </strong><br />`;

  test("minute « Retour le » : jour, mois en lettres, année au plus près", () => {
    const minute = (texte: string, maintenant: string) =>
      lire<number | null>(
        `CommerceFzzz.minuteRetour(${JSON.stringify(texte)}, moment(${JSON.stringify(maintenant)}).valueOf())`,
      );
    const date = (iso: string) => lire<number>(`moment(${JSON.stringify(iso)}).valueOf()`);
    expect(minute("Retour le 14 nov. à 14h20", "2026-11-14T14:00:00")).toBe(
      date("2026-11-14T14:20:00"),
    );
    // fin d'année : le 2 janvier est l'an prochain
    expect(minute("Retour le 2 janv. à 01h05", "2026-12-31T23:00:00")).toBe(
      date("2027-01-02T01:05:00"),
    );
    expect(minute("Retour le 25 oct. 2026 à 15h32", "2026-11-14T14:00:00")).toBe(
      date("2026-10-25T15:32:00"),
    );
    expect(minute("Retour le 3 août à 09h07", "2026-08-01T10:00:00")).toBe(
      date("2026-08-03T09:07:00"),
    );
    expect(minute("Retour le 14 brumaire à 14h20", "2026-11-14T14:00:00")).toBeNull();
    expect(minute("Arrivée à 14h20", "2026-11-14T14:00:00")).toBeNull();
  });

  test("convois livrés : ouvrières qui les portent, au-dessus ; reçus et revenus ignorés", () => {
    convois(ALPHA + BRAVO + RECU);
    // étable 20 : 20 ressources par ouvrière ; 150 001 → 7 501
    expect(lire(`CommerceFzzz.retoursConvois(NOW, 20)`)).toEqual([
      { minute: a("14:20:00"), ouvrieres: 10000 },
      { minute: a("14:30:00"), ouvrieres: 7501 },
    ]);
    // lecture de la page Reine à 14h25 : Alpha est déjà parmi les présentes
    expect(lire(`CommerceFzzz.retoursConvois(${a("14:25:00")}, 20)`)).toEqual([
      { minute: a("14:30:00"), ouvrieres: 7501 },
    ]);
  });

  test("convoi qui revient dans la minute de la lecture de la page Reine : compté (signalé par KWHWWYMWN)", () => {
    // « dans 33s », « Retour le … à 14h00 », page Reine lue à 14h00:14 : le
    // convoi revient à 14h00:48, ses ouvrières ne sont pas parmi les présentes
    convois(
      `<strong>- Vous allez livrer 0 <img alt="nourritures" src="n.gif"/> et 222 000 <img alt="materiaux" src="m.gif"/> à  <a href="Membre.php?Pseudo=Delta">Delta</a> dans 33s  </strong> - <small><em>Retour le 14 nov. à 14h00</em></small><br />`,
    );
    expect(lire(`CommerceFzzz.retoursConvois(${a("14:00:14")}, 13.5, ${a("14:00:15")})`)).toEqual([
      { minute: a("14:00:00"), ouvrieres: 16445 },
    ]);
    // compte à rebours à 1 s quand la page Reine est lue : déjà parmi les présentes
    convois(
      `<strong>- Vous allez livrer 0 <img alt="nourritures" src="n.gif"/> et 222 000 <img alt="materiaux" src="m.gif"/> à  <a href="Membre.php?Pseudo=Delta">Delta</a> dans 1s  </strong> - <small><em>Retour le 14 nov. à 14h00</em></small><br />`,
    );
    expect(lire(`CommerceFzzz.retoursConvois(${a("14:00:47")}, 13.5, ${a("14:00:47")})`)).toEqual(
      [],
    );
  });

  test("compte à rebours figé (page mise en pause) : une minute « Retour le » passée l'écarte", () => {
    convois(
      `<strong>- Vous allez livrer 0 <img alt="nourritures" src="n.gif"/> et 20 000 <img alt="materiaux" src="m.gif"/> à  <a href="Membre.php?Pseudo=Echo">Echo</a> dans 5m 00s  </strong> - <small><em>Retour le 14 nov. à 13h50</em></small><br />`,
    );
    expect(lire(`CommerceFzzz.retoursConvois(NOW, 20)`)).toEqual([]);
  });

  test("lignes en deux colonnes : le retour du jeu est toujours lu", () => {
    convois(ALPHA + BRAVO);
    lire(`CommerceFzzz.colonnes(CommerceFzzz.lignes().get())`);
    expect(lire(`$(".o_convoi").length`)).toBe(2);
    expect(lire<any[]>(`CommerceFzzz.retoursConvois(NOW, 20)`).length).toBe(2);
  });

  test("sans Compte+ : le compte à rebours du jeu suffit, l'heure ajoutée par l'extension n'est pas lue", () => {
    convois(
      `<strong>- Vous allez livrer 200 000 <img alt="nourritures" src="n.gif"/> et 0 <img alt="materiaux" src="m.gif"/> à  <a href="Membre.php?Pseudo=Alpha">Alpha</a> dans 1H 05m 20s  </strong><span class='small'>- Retour le 14 nov. 2026 à 15h06</span><br />`,
    );
    expect(lire(`CommerceFzzz.retoursConvois(NOW, 20)`)).toEqual([
      { minute: a("15:05:00"), ouvrieres: 10000 },
    ]);
  });

  test("plafond : pas plus d'ouvrières comptées que d'ouvrières en convoi, les premiers retours retirés", () => {
    expect(
      lire(
        `CommerceFzzz.plafonnerRetours([{ minute: 1, ouvrieres: 10000 }, { minute: 2, ouvrieres: 7500 }], 12000)`,
      ),
    ).toEqual([
      { minute: 2, ouvrieres: 7500 },
      { minute: 1, ouvrieres: 4500 },
    ]);
    expect(lire(`CommerceFzzz.plafonnerRetours([{ minute: 1, ouvrieres: 10 }], 0)`)).toEqual([]);
  });
});

// pages du jeu lues au clic, d'après les pages enregistrées (structure réelle,
// valeurs inventées)
const RESSOURCES = (secondes = 1800, choix = "materiaux", chasses = "", tdc = "14000") =>
  `<div id="data" style="display:none"><div id="nb_ouvrieres">15000</div><div id="quantite_tdc">${tdc}</div></div>` +
  `<table id="boite_ouvriere"><tr><td><span class="titre">Récoltes</span> <strong>Les ouvrières rentreront dans : </strong> <strong id="retour_ouvrieres">30m 0s </strong><br /> <script type="text/javascript">reste(${secondes}, "retour_ouvrieres");</script></td></tr>` +
  `<tr><td><label><input type="radio" name="choixOuvriere" value="nourriture"${choix == "nourriture" ? ' checked="checked"' : ""}/></label><label><input type="radio" name="choixOuvriere" value="materiaux"${choix == "materiaux" ? ' checked="checked"' : ""}/></label><label><input type="radio" name="choixOuvriere" value="rien"${choix == "rien" ? ' checked="checked"' : ""}/></label></td></tr></table>` +
  `<div id="boite_tdc">${chasses}</div>`;
const CHASSE = (id: number, cm2: string, secondes: number) =>
  `<span class="titre">Chasse en cours<br /> </span><span>- Vos chasseuses vont conquérir ${cm2} cm² dans <span id="chasse_${id}">1H 30m 0s </span></span><script language="JavaScript">reste(${secondes}, "chasse_${id}");</script> - <a href="/Ressources.php?annuler=${id}">Annuler</a><br /><small><em> Troupes en chasses : 384 Jeunes Soldates Naines.</em></small><br />`;
const REINE = (presentes = "15 000", total = "32 500") =>
  `<div id="data" style="display:none"><div id="nb_ouvrieres">${presentes}</div><div id="quantite_tdc">14000</div></div>` +
  `<h4 style="display:inline">Pontes en cours:</h4><table class="tableau_leger"><tr><td><strong>Unités</strong></td><td><strong>Garnison</strong></td><td><strong>Temps requis</strong></td><td><strong>Temps total restant</strong></td><td><strong>Ponte finie</strong></td><td></td></tr>` +
  `<tr><td><span id="unites_restantes_premiere_ponte">600 ouvrières</td><td>  Fourmilière</td><td><span id="temps_restant_premiere_ponte">20m 0s </span></td><td><span id="ponte_1">20m 0s </span></td><td>14h20</td><td></td></tr><script type="text/javascript">reste_unite(1200, "unites_restantes_premiere_ponte" ,"ouvrières","600");</script><script type="text/javascript">reste(1200, "temps_restant_premiere_ponte");</script><script type="text/javascript">reste(1200, "ponte_1");</script>` +
  `<tr><td>5 000 Jeunes Soldates Naines</td><td>Loge</td><td><span id="temps_ponte_2">2H 0m</span></td><td><span id="ponte_2">2H 20m 0s</span></td><td>16h20</td><td></td></tr><script type="text/javascript">reste(7200, "temps_ponte_2");</script><script type="text/javascript">reste(8400, "ponte_2");</script>` +
  `<tr><td>3 000 Ouvrières</td><td>Fourmilière</td><td><span id="temps_ponte_3">1H 0m</span></td><td><span id="ponte_3">3H 20m 0s</span></td><td>17h20</td><td></td></tr><script type="text/javascript">reste(3600, "temps_ponte_3");</script><script type="text/javascript">reste(12000, "ponte_3");</script>` +
  `</table><span id="armee_initial">${total}</span><div class="icones_unite cliquable3"></div>`;
// page Armée : mes attaques comme le jeu les écrit (Compte+ : troupes et minute
// d'arrivée), un renfort, la garnison
const ATTAQUE = (id: number, cible: string, secondes: number, details = "") =>
  `- Vous allez attaquer <span class="gras"><a href="Membre.php?Pseudo=${cible}">${cible}</a>(<a href="classementAlliance.php?alliance=OUAF">OUAF</a>)</span> (Terrain de chasse) dans <span class="gras" id="attaque_${id}">…</span><script language="JavaScript">reste(${secondes}, "attaque_${id}");</script> - <a href="/Armee.php?annuler=${id}">Annuler</a><br />${details}<br/>`;
const TROUPES = (unites: string, arrivee: string) =>
  `<small><em> Troupes en attaques : ${unites}.<br /> Arrivée à ${arrivee}</em></small>`;
const RENFORT = (id: number, secondes: number) =>
  `- Des renforts arrivent dans <span class="gras" id="attaque_${id}">…</span><script language="JavaScript">reste(${secondes}, "attaque_${id}");</script><br/>`;
const ARMEE = (attaques = "") =>
  `<div id="centre"><h3>Attaque(s) en cours</h3>${attaques}<h3>Troupes en Garnison</h3><table></table></div>`;

describe("pages Ressources et Reine lues au clic", () => {
  const analyser = (ressources: string, reine: string, armee?: string | false) =>
    lire(
      `(() => { try { return CommerceFzzz.analyserRecolte({ html: ${JSON.stringify(ressources)}, avant: NOW, apres: NOW + 300 }, { html: ${JSON.stringify(reine)}, avant: NOW + 300, apres: NOW + 600 }${armee === undefined ? "" : armee === false ? ", false" : `, { html: ${JSON.stringify(armee)}, avant: NOW + 600, apres: NOW + 900 }`}); } catch (e) { return e.message; } })()`,
    );

  test("récolte au plus tôt, ouvrières présentes et en convoi ; les pontes ne comptent pas", () => {
    lire(
      `var monProfil = new Joueur({ pseudo: "Test", niveauRecherche: [15, 8, 10, 0, 0, 8, 0, 0, 0, 0], niveauConstruction: Object.assign(new Array(13).fill(0), { 11: 20 }) });`,
    );
    expect(analyser(RESSOURCES(), REINE())).toEqual({
      recolte: a("14:30:00"),
      presentes: 15000,
      enConvoi: 17500,
      terrain: 14000,
      chasses: [],
      attaques: [],
      attaquesInconnues: 0,
      armee: null,
      automatique: true,
      instant: a("14:00:00") + 600,
    });
  });

  test("page Armée : mes attaques à la minute du RC, prise estimée au lancement d'ici, sinon troupes du jeu ; renforts ignorés", () => {
    lire(
      `localStorage.setItem("outiiil_attaquesLancees", JSON.stringify([{ id: 502, cible: "Autre", lieu: "Terrain de chasse", unite: { "Jeune Soldate Naine": 20000 }, lancee: NOW - 300000, arrivee: NOW + 3010000, terrainDepart: 60000, terrainCible: 57000 }]))`,
    );
    const r = analyser(
      RESSOURCES(),
      REINE(),
      ARMEE(
        ATTAQUE(501, "Cible", 1830, TROUPES("5 000 Jeunes Soldates Naines", "14h30")) +
          ATTAQUE(502, "Autre", 3010, TROUPES("20 000 Jeunes Soldates Naines", "14h50")) +
          RENFORT(503, 600) +
          ATTAQUE(504, "Golf", 4000),
      ),
    );
    lire(`localStorage.removeItem("outiiil_attaquesLancees")`);
    // 501 : troupes du jeu (lancée ailleurs) ; 502 : prise estimée à son lancement
    // (20 % du TdC de la cible), pas ses troupes ; 504 : ni capture ni troupes
    expect([r.attaques, r.attaquesInconnues, r.armee]).toEqual([
      [
        { impact: a("14:31:00"), terrain: 5000 },
        { impact: a("14:51:00"), terrain: 3000 },
      ],
      1,
      true,
    ]);
  });

  test("page Armée illisible, ou autre page (connexion) : signalée, aucune attaque comptée", () => {
    expect(analyser(RESSOURCES(), REINE(), false)).toMatchObject({
      attaques: [],
      attaquesInconnues: 0,
      armee: false,
    });
    expect(analyser(RESSOURCES(), REINE(), "<html>connexion</html>")).toMatchObject({
      attaques: [],
      armee: false,
    });
  });

  test("TdC : le plus grand des deux pages (une chasse arrivée entre les deux lectures)", () => {
    expect(analyser(RESSOURCES(1800, "materiaux", "", "14500"), REINE()).terrain).toBe(14500);
  });

  test("affectation automatique : Nourriture ou Matériaux ; la croix (ou « Ratio »), ou pas de Compte+ : non", () => {
    expect(analyser(RESSOURCES(1800, "nourriture"), REINE()).automatique).toBe(true);
    expect(analyser(RESSOURCES(1800, "rien"), REINE()).automatique).toBe(false);
    expect(analyser(RESSOURCES(1800, ""), REINE()).automatique).toBe(false);
  });

  test("chasses en cours : terrain et minute du RC", () => {
    const r = analyser(RESSOURCES(1800, "materiaux", CHASSE(5, "10 000", 2410)), REINE());
    // arrivée à 14h40:10 : TdC changé à 14h41
    expect(r.chasses).toEqual([{ impact: a("14:41:00"), terrain: 10000 }]);
  });

  test("page illisible : erreur plutôt qu'un calcul faux", () => {
    expect(analyser("<html>connexion</html>", REINE())).toBe(
      "heure de la récolte absente de la page Ressources",
    );
    expect(analyser(RESSOURCES(), "<html>connexion</html>")).toBe("page Reine illisible");
    // une chasse que la lecture ne trouve pas : refusé
    expect(
      analyser(
        RESSOURCES(1800, "materiaux", "") + "<p>- Vos chasseuses vont conquérir 5 cm² dans 1H</p>",
        REINE(),
      ),
    ).toBe("chasses en cours illisibles");
  });
});

describe("clic sur un montant du Récapitulatif", () => {
  // page Convois : en-tête du jeu (15 000 ouvrières, TdC 14 000), convois en
  // cours, encadré Compte+ et formulaire
  const ouvrirConvois = (attaques = 0, comptePlus = false) =>
    lire(`(() => {
      window.TOASTS = []; window.LECTURES = [];
      $.toast = (o) => TOASTS.push(o.text);
      CommerceFzzz._recolteLue = null; CommerceFzzz._recolteEnCours = null;
      document.body.innerHTML = '<div id="data"><div id="nb_ouvrieres">15000</div><div id="nb_materiaux">3460273</div><div id="quantite_tdc">14000</div></div>'
        + ${comptePlus ? `'<div id="menuComptePlus"><a class="boutonStatJoueur">Stat</a></div>'` : "''"}
        + ${attaques ? `'<table><tr id="ligne_attaque"><td><a href="Armee.php"><strong>${attaques}</strong> attaque</a></td></tr></table>'` : "''"}
        + '<div id="centre"><h3>Convois en cours:</h3>'
        + '<strong>- Vous allez livrer 200 000 <img alt="nourritures"/> et 0 <img alt="materiaux"/> à  <a href="Membre.php?Pseudo=Alpha">Alpha</a> dans 20m 30s  </strong> - <small><em>Retour le 14 nov. à 14h20</em></small><br />'
        + '<strong>- Vous allez livrer 0 <img alt="nourritures"/> et 150 000 <img alt="materiaux"/> à  <a href="Membre.php?Pseudo=Bravo">Bravo</a> dans 30m 10s  </strong> - <small><em>Retour le 14 nov. à 14h30</em></small><br />'
        + '</div><input id="pseudo_convoi"><input id="input_nbNourriture" value="1 000"><input id="nbNourriture" value="1000">'
        + '<input id="input_nbMateriaux"><input id="nbMateriaux"><input id="input_nbOuvriere"><input id="nbOuvriere">';
    })()`);
  const pages = (
    ressources: string,
    reine: string,
    echec = false,
    armee: string | false = ARMEE(),
  ) =>
    lire(`(() => {
      $.get = (url) => {
        LECTURES.push(url);
        if (${echec}) return $.Deferred().reject({ status: 503 });
        if (/Armee/.test(url)) return ${armee === false ? "$.Deferred().reject({ status: 503 })" : `$.Deferred().resolve(${JSON.stringify(armee)})`};
        return $.Deferred().resolve(/Ressources/.test(url) ? ${JSON.stringify(ressources)} : ${JSON.stringify(reine)});
      };
    })()`);
  const option = (coche: boolean) =>
    lire(`(() => {
      var p = new Joueur({ pseudo: "Test", niveauRecherche: [15, 8, 10, 0, 0, 8, 0, 0, 0, 0], niveauConstruction: Object.assign(new Array(13).fill(0), { 11: 20 }) });
      window.monProfil = p;
      monProfil.parametre["convoisAvantRecolte"].valeur = ${coche};
    })()`);
  const champs = () =>
    lire<string[]>(
      `["#input_nbMateriaux", "#nbMateriaux", "#input_nbOuvriere", "#nbOuvriere"].map((s) => String($(s).val()))`,
    );
  const attendre = () => new Promise((r) => setTimeout(r, 30));

  test("option décochée (par défaut) : remplissage habituel, aucune page lue", async () => {
    option(false);
    expect(lire(`new Joueur({ pseudo: "X" }).parametre["convoisAvantRecolte"].valeur`)).toBe(false);
    ouvrirConvois();
    pages(RESSOURCES(), REINE());
    lire(`CommerceFzzz.remplirMateriaux(300000)`);
    await attendre();
    // 1 000 libres × 20 = 20 000, moins 1 000 de nourriture
    expect(champs()).toEqual(["19000", "19000", "1000", "1000"]);
    expect(lire(`LECTURES`)).toEqual([]);
    expect(espaces(lire<string[]>(`TOASTS`)[0]!)).toBe(
      "Matériaux réduits à 19 000 sur 300 000 : ouvrières à garder pour exploiter le terrain.",
    );
  });

  test("option cochée : Ressources, Reine puis Armée lues, ouvrières de retour de convoi ajoutées, pas les pondues", async () => {
    option(true);
    ouvrirConvois();
    pages(RESSOURCES(), REINE());
    lire(`CommerceFzzz.remplirMateriaux(300000)`);
    // d'abord le remplissage habituel, sans message
    expect(champs()).toEqual(["19000", "19000", "1000", "1000"]);
    await attendre();
    expect(lire(`LECTURES`)).toEqual(["/Ressources.php", "/Reine.php", "/Armee.php"]);
    // récolte de 14h30 : 15 000 + 10 000 (Alpha, retour 14h20) − 14 000, les 600
    // ouvrières pondues d'ici là non comptées ; Bravo (retour 14h30) ne compte
    // qu'à la récolte de 15h00
    expect(champs()).toEqual(["219000", "219000", "11000", "11000"]);
    expect(espaces(lire<string[]>(`TOASTS`)[0]!)).toBe(
      "Récolte de 14h30 : 10 000 ouvrières de plus pour le convoi (comptées : 10 000 de retour de convoi). Matériaux réduits à 219 000 sur 300 000 : ouvrières à garder pour exploiter le terrain.",
    );
  });

  test("une de mes attaques arrive avant la récolte : les ouvrières pour son terrain restent", async () => {
    option(true);
    ouvrirConvois(1);
    pages(
      RESSOURCES(),
      REINE(),
      false,
      ARMEE(ATTAQUE(501, "Cible", 1500, TROUPES("5 000 Jeunes Soldates Naines", "14h25"))),
    );
    lire(`CommerceFzzz.remplirMateriaux(300000)`);
    await attendre();
    // 14h30 : 15 000 + 10 000 − (14 000 + 5 000 cm² de l'attaque, RC à 14h25)
    expect(champs()).toEqual(["119000", "119000", "6000", "6000"]);
    expect(espaces(lire<string[]>(`TOASTS`)[0]!)).toBe(
      "Récolte de 14h30 : 5 000 ouvrières de plus pour le convoi (comptées : 10 000 de retour de convoi ; terrain gagné d'ici là : 5 000 cm² de tes attaques). Matériaux réduits à 119 000 sur 300 000 : ouvrières à garder pour exploiter le terrain.",
    );
  });

  test("Compte+ sans attaque dans son encart : la page Armée n'est pas lue ; avec, elle l'est", async () => {
    option(true);
    ouvrirConvois(0, true);
    pages(RESSOURCES(), REINE());
    lire(`CommerceFzzz.remplirMateriaux(300000)`);
    await attendre();
    expect(lire(`LECTURES`)).toEqual(["/Ressources.php", "/Reine.php"]);
    ouvrirConvois(1, true);
    pages(RESSOURCES(), REINE());
    lire(`CommerceFzzz.remplirMateriaux(300000)`);
    await attendre();
    expect(lire(`LECTURES`)).toEqual(["/Ressources.php", "/Reine.php", "/Armee.php"]);
  });

  test("page Armée illisible : le calcul se fait sans les attaques, le message le dit", async () => {
    option(true);
    ouvrirConvois(1);
    pages(RESSOURCES(), REINE(), false, false);
    lire(`CommerceFzzz.remplirMateriaux(300000)`);
    await attendre();
    expect(champs()).toEqual(["219000", "219000", "11000", "11000"]);
    expect(espaces(lire<string[]>(`TOASTS`)[0]!)).toContain(
      "Page Armée illisible : le terrain de tes attaques en cours n'est pas compté.",
    );
  });

  test("moins d'ouvrières en convoi que n'en portent les convois lus : les premiers retours ne comptent pas", async () => {
    option(true);
    ouvrirConvois();
    // page Reine : 20 000 ouvrières dont 15 000 présentes, 5 000 en convoi
    pages(RESSOURCES(), REINE("15 000", "20 000"));
    lire(`CommerceFzzz.remplirMateriaux(300000)`);
    await attendre();
    // Alpha (14h20) ne compte plus, Bravo (14h30) pour 5 000 à 15h00 : 14h30 limite
    expect(champs()).toEqual(["19000", "19000", "1000", "1000"]);
  });

  test("sans affectation automatique, ou avec une attaque aux troupes inconnues : le message le dit", async () => {
    option(true);
    ouvrirConvois(2);
    pages(RESSOURCES(1800, "rien"), REINE(), false, ARMEE(ATTAQUE(504, "Golf", 4000)));
    lire(`CommerceFzzz.remplirMateriaux(100000)`);
    await attendre();
    const texte = espaces(lire<string[]>(`TOASTS`)[0]!);
    expect(texte).toContain(
      "Sans affectation automatique des ouvrières (Compte+ réglé sur Nourriture ou Matériaux, page Ressources), affecte toi-même celles qui arrivent avant chaque récolte.",
    );
    expect(texte).toContain(
      "1 attaque en cours sans troupes connues : son terrain n'est pas compté.",
    );
    expect(texte).not.toContain("tes 2 attaques");
  });

  test("une chasse rapporte du terrain avant la récolte : moins d'ouvrières que d'habitude", async () => {
    option(true);
    lire(`document.body.innerHTML = ""`);
    ouvrirConvois();
    // plus de convoi en cours ni de ponte : seule la chasse compte
    lire(`$("#centre strong, #centre small").remove()`);
    pages(
      RESSOURCES(1800, "materiaux", CHASSE(7, "500", 600)),
      REINE().replace(/<tr><td><span id="unites[\s\S]*?<\/table>/, "</table>"),
    );
    lire(`CommerceFzzz.remplirMateriaux(300000)`);
    await attendre();
    expect(champs()).toEqual(["9000", "9000", "500", "500"]);
    expect(espaces(lire<string[]>(`TOASTS`)[0]!)).toBe(
      "Récolte de 14h30 : 500 ouvrières de moins pour le convoi, gardées pour exploiter ton terrain (500 cm² de chasses compris). Matériaux réduits à 9 000 sur 300 000 : ouvrières à garder pour exploiter le terrain.",
    );
  });

  test("lecture impossible : le remplissage habituel reste, avec la raison", async () => {
    option(true);
    ouvrirConvois();
    pages(RESSOURCES(), REINE(), true);
    lire(`CommerceFzzz.remplirMateriaux(300000)`);
    await attendre();
    expect(champs()).toEqual(["19000", "19000", "1000", "1000"]);
    expect(espaces(lire<string[]>(`TOASTS`)[0]!)).toBe(
      "Ouvrières d'avant la récolte non comptées (le jeu traitait une autre action) : remplissage habituel. Matériaux réduits à 19 000 sur 300 000 : ouvrières à garder pour exploiter le terrain.",
    );
  });

  test("champs changés par le joueur pendant la lecture : pas réécrits", async () => {
    option(true);
    ouvrirConvois();
    pages(RESSOURCES(), REINE());
    lire(`CommerceFzzz.remplirMateriaux(300000); $("#input_nbMateriaux").val("5000")`);
    await attendre();
    expect(champs()[0]).toBe("5000");
    expect(espaces(lire<string[]>(`TOASTS`)[0]!)).toContain(
      "Champs du convoi changés entre-temps : non réécrits.",
    );
  });

  test("deux clics de suite : seul le dernier s'applique, pages lues une fois pour la minute", async () => {
    option(true);
    ouvrirConvois();
    pages(RESSOURCES(), REINE());
    lire(`CommerceFzzz.remplirMateriaux(300000); CommerceFzzz.remplirMateriaux(50000)`);
    await attendre();
    expect(lire<string[]>(`TOASTS`).length).toBe(1);
    expect(champs()).toEqual(["50000", "50000", "2550", "2550"]);
    lire(`CommerceFzzz.remplirMateriaux(300000)`);
    await attendre();
    expect(lire(`LECTURES`).length).toBe(3);
    // une minute plus tard : relues
    lire(`NOW += 60000; CommerceFzzz.remplirMateriaux(300000)`);
    await attendre();
    expect(lire(`LECTURES`).length).toBe(6);
    lire(`NOW -= 60000`);
  });
});

describe("Préférences → Grenier", () => {
  test("case décochée par défaut, aide qui dit qu'elle ne sert qu'avec le Compte+", () => {
    const p = lire<{ type: string; valeur: boolean }>(
      `(() => { let x = new Joueur({ pseudo: "X" }).parametre["convoisAvantRecolte"]; return { type: x._type, valeur: x.valeur }; })()`,
    );
    expect(p).toEqual({ type: "checkbox", valeur: false });
  });
});
