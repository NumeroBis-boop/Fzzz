import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

// Convoi avant la récolte (idée de KWHWWYMWN, formule du mainteneur du
// 15/11/2026) : ouvrières disponibles = A + B − E − F à chaque récolte où le
// convoi envoyé est dehors, A les présentes, B celles d'un convoi qui rentre au
// moins une minute avant la récolte, E le TdC, F le terrain de mes chasses et de
// mes floods arrivés avant la récolte ; ni les floods reçus ni les pontes.
// Joueurs et montants inventés.
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
const espaces = (t: string) => t.replace(/[\s  ]+/g, " ");
function moment_jours(n: number) {
  return lire<number>(`moment(NOW).add(${n}, "days").valueOf()`);
}

const calcul = (d: object) =>
  lire<{
    libres: number;
    recolte: number | null;
    revenues: number;
    gagne: number;
    attaques: number;
  }>(`CommerceFzzz.libresAvantRecolte(${JSON.stringify(d)})`);

describe("ouvrières disponibles : A + B − E − F à chaque récolte où le convoi envoyé est dehors", () => {
  test("rien n'arrive : A − E, comme le remplissage habituel", () => {
    expect(calcul({ presentes: 15000, terrain: 14000, recolte: a("14:30:00") })).toEqual({
      libres: 1000,
      recolte: a("14:30:00"),
      revenues: 0,
      gagne: 0,
      attaques: 0,
    });
    // plus de terrain que d'ouvrières : aucune
    expect(calcul({ presentes: 9000, terrain: 14000, recolte: a("14:30:00") }).libres).toBe(0);
  });

  test("B : un convoi compte s'il rentre au moins une minute avant la récolte (t)", () => {
    const avec = (retour: string) =>
      calcul({
        presentes: 15000,
        terrain: 14000,
        recolte: a("14:30:00"),
        retourConvoi: a("14:40:00"),
        retours: [{ retour: a(retour), ouvrieres: 500 }],
      }).libres;
    // récolte à 14h30 : t = 14h29:00
    expect(avec("14:28:59")).toBe(1500);
    expect(avec("14:29:00")).toBe(1000);
    expect(avec("14:29:40")).toBe(1000);
  });

  test("F : terrain de mes chasses et de mes floods arrivés avant la récolte", () => {
    const r = calcul({
      presentes: 20000,
      terrain: 14000,
      recolte: a("14:30:20"),
      retourConvoi: a("14:40:00"),
      chasses: [
        { arrivee: a("14:29:50"), terrain: 300 },
        { arrivee: a("14:30:20"), terrain: 700 },
      ],
      attaques: [
        { arrivee: a("14:30:19"), terrain: 2000 },
        { arrivee: a("14:31:00"), terrain: 5000 },
      ],
    });
    // avant la récolte de 14h30:20 : la chasse de 14h29:50 et le flood de 14h30:19
    expect(r).toEqual({
      libres: 3700,
      recolte: a("14:30:20"),
      revenues: 0,
      gagne: 300,
      attaques: 2000,
    });
  });

  test("jusqu'au retour du convoi envoyé : chaque récolte où il est dehors, le plus petit résultat", () => {
    const d = {
      presentes: 20000,
      terrain: 14000,
      recolte: a("14:30:00"),
      retours: [{ retour: a("15:20:00"), ouvrieres: 9000 }],
      attaques: [{ arrivee: a("14:50:00"), terrain: 5000 }],
    };
    // 14h30 : 6 000 ; 15h00 : 6 000 − 5 000 = 1 000 ; 15h30 : 1 000 + 9 000
    expect(calcul({ ...d, retourConvoi: a("15:10:00") })).toMatchObject({
      libres: 1000,
      recolte: a("15:00:00"),
      attaques: 5000,
    });
    // de retour à 14h45 : seule la récolte de 14h30 compte
    expect(calcul({ ...d, retourConvoi: a("14:45:00") })).toMatchObject({
      libres: 6000,
      recolte: a("14:30:00"),
    });
    // rentré pile une minute avant 15h00 : pas assez tôt, 15h00 compte encore
    expect(calcul({ ...d, retourConvoi: a("14:59:00") })).toMatchObject({
      libres: 1000,
      recolte: a("15:00:00"),
    });
  });

  test("convoi envoyé de retour au moins une minute avant la prochaine récolte : toutes les présentes", () => {
    expect(
      calcul({
        presentes: 20000,
        terrain: 14000,
        recolte: a("14:30:00"),
        retourConvoi: a("14:28:59"),
        attaques: [{ arrivee: a("14:20:00"), terrain: 5000 }],
      }),
    ).toEqual({ libres: 20000, recolte: null, revenues: 0, gagne: 0, attaques: 0 });
  });

  test("retour du convoi envoyé inconnu : les récoltes jusqu'à la dernière arrivée connue", () => {
    const r = calcul({
      presentes: 20000,
      terrain: 15000,
      recolte: a("14:30:00"),
      attaques: [{ arrivee: moment_jours(2), terrain: 1000 }],
    });
    // le flood arrive pile à une récolte : compté à la suivante
    expect(r).toMatchObject({ libres: 4000, attaques: 1000, recolte: moment_jours(2) + 1800000 });
  });

  test("jamais plus que les présentes, jamais moins que 0", () => {
    expect(
      calcul({
        presentes: 5000,
        terrain: 4000,
        recolte: a("14:30:00"),
        retours: [{ retour: a("14:10:00"), ouvrieres: 50000 }],
      }).libres,
    ).toBe(5000);
    expect(
      calcul({
        presentes: 5000,
        terrain: 4000,
        recolte: a("14:30:00"),
        chasses: [{ arrivee: a("14:10:00"), terrain: 9000 }],
      }).libres,
    ).toBe(0);
  });

  test("récolte déjà passée : la suivante", () => {
    const r = calcul({
      presentes: 15000,
      terrain: 14000,
      recolte: a("13:59:00"),
      maintenant: a("14:00:00"),
      retours: [{ retour: a("14:10:00"), ouvrieres: 700 }],
    });
    expect(r).toMatchObject({ recolte: a("14:29:00"), libres: 1700 });
  });
});

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

  test("convois livrés : retour à la fin du compte à rebours, ouvrières qui les portent ; reçus ignorés", () => {
    convois(ALPHA + BRAVO + RECU);
    // étable 20 : 20 ressources par ouvrière ; 150 001 → 7 501
    expect(lire(`CommerceFzzz.retoursConvois(NOW, 20)`)).toEqual([
      { retour: a("14:20:30"), ouvrieres: 10000 },
      { retour: a("14:30:10"), ouvrieres: 7501 },
    ]);
    // page Ressources lue à 14h25 : Alpha est déjà parmi les présentes
    expect(lire(`CommerceFzzz.retoursConvois(${a("14:25:00")}, 20)`)).toEqual([
      { retour: a("14:30:10"), ouvrieres: 7501 },
    ]);
  });

  test("convoi qui revient dans la minute de la lecture : compté (signalé par KWHWWYMWN)", () => {
    // « dans 33s », « Retour le … à 14h00 », page lue à 14h00:14 : le convoi
    // revient à 14h00:48, ses ouvrières ne sont pas parmi les présentes
    convois(
      `<strong>- Vous allez livrer 0 <img alt="nourritures" src="n.gif"/> et 222 000 <img alt="materiaux" src="m.gif"/> à  <a href="Membre.php?Pseudo=Delta">Delta</a> dans 33s  </strong> - <small><em>Retour le 14 nov. à 14h00</em></small><br />`,
    );
    expect(lire(`CommerceFzzz.retoursConvois(${a("14:00:14")}, 13.5, ${a("14:00:15")})`)).toEqual([
      { retour: a("14:00:48"), ouvrieres: 16445 },
    ]);
    // compte à rebours à 1 s quand la page est lue : déjà parmi les présentes
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

  test("lignes en deux colonnes : toujours lues", () => {
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
      { retour: a("15:05:20"), ouvrieres: 10000 },
    ]);
  });
});

// pages du jeu lues au clic, d'après les pages enregistrées (structure réelle,
// valeurs inventées) ; le bloc du joueur (#data) donne A et E
const RESSOURCES = (
  secondes = 1800,
  choix = "materiaux",
  chasses = "",
  tdc = "14000",
  ouvrieres = "15000",
) =>
  `<div id="data" style="display:none"><div id="nb_ouvrieres">${ouvrieres}</div><div id="quantite_tdc">${tdc}</div></div>` +
  `<table id="boite_ouvriere"><tr><td><span class="titre">Récoltes</span> <strong>Les ouvrières rentreront dans : </strong> <strong id="retour_ouvrieres">30m 0s </strong><br /> <script type="text/javascript">reste(${secondes}, "retour_ouvrieres");</script></td></tr>` +
  `<tr><td><label><input type="radio" name="choixOuvriere" value="nourriture"${choix == "nourriture" ? ' checked="checked"' : ""}/></label><label><input type="radio" name="choixOuvriere" value="materiaux"${choix == "materiaux" ? ' checked="checked"' : ""}/></label><label><input type="radio" name="choixOuvriere" value="rien"${choix == "rien" ? ' checked="checked"' : ""}/></label></td></tr></table>` +
  `<div id="boite_tdc">${chasses}</div>`;
const CHASSE = (id: number, cm2: string, secondes: number) =>
  `<span class="titre">Chasse en cours<br /> </span><span>- Vos chasseuses vont conquérir ${cm2} cm² dans <span id="chasse_${id}">1H 30m 0s </span></span><script language="JavaScript">reste(${secondes}, "chasse_${id}");</script> - <a href="/Ressources.php?annuler=${id}">Annuler</a><br /><small><em> Troupes en chasses : 384 Jeunes Soldates Naines.</em></small><br />`;
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

// synthèse des floods (AttaqueLancee.mouvements) remplacée : prises données par le test
const synthese = (floods: object = {}) =>
  lire(`(() => {
    window.MOUV = { appels: [], floods: ${JSON.stringify(floods)} };
    AttaqueLancee.mouvements = (attaques, suivi, chasses) => {
      MOUV.appels.push({ ids: attaques.map((x) => x.ligne.id), chasses: Array.isArray(chasses) });
      return Promise.resolve({ floods: MOUV.floods, chasses: [], recus: [] });
    };
  })()`);

describe("page Ressources lue au clic", () => {
  const analyser = (ressources: string) =>
    lire(
      `(() => { try { let r = CommerceFzzz.analyserRecolte({ html: ${JSON.stringify(ressources)}, avant: NOW, apres: NOW + 300 }); delete r.chassesLues; return r; } catch (e) { return e.message; } })()`,
    );

  test("récolte au plus tôt, A et E du bloc du joueur de la page lue", () => {
    lire(
      `var monProfil = new Joueur({ pseudo: "Test", niveauRecherche: [15, 8, 10, 0, 0, 8, 0, 0, 0, 0], niveauConstruction: Object.assign(new Array(13).fill(0), { 11: 20 }) });`,
    );
    expect(analyser(RESSOURCES())).toEqual({
      recolte: a("14:30:00"),
      presentes: 15000,
      terrain: 14000,
      chasses: [],
      automatique: true,
      instant: a("14:00:00") + 300,
    });
    expect(analyser(RESSOURCES(1800, "materiaux", "", "14 500", "16 000"))).toMatchObject({
      presentes: 16000,
      terrain: 14500,
    });
  });

  test("affectation automatique : Nourriture ou Matériaux ; la croix (ou « Ratio »), ou pas de Compte+ : non", () => {
    expect(analyser(RESSOURCES(1800, "nourriture")).automatique).toBe(true);
    expect(analyser(RESSOURCES(1800, "rien")).automatique).toBe(false);
    expect(analyser(RESSOURCES(1800, "")).automatique).toBe(false);
  });

  test("chasses en cours : terrain et arrivée à la seconde", () => {
    expect(analyser(RESSOURCES(1800, "materiaux", CHASSE(5, "10 000", 2410))).chasses).toEqual([
      { arrivee: a("14:40:10"), terrain: 10000 },
    ]);
  });

  test("page illisible : erreur plutôt qu'un calcul faux", () => {
    expect(analyser("<html>connexion</html>")).toBe(
      "heure de la récolte absente de la page Ressources",
    );
    expect(analyser(RESSOURCES().replace(/<div id="data"[\s\S]*?<\/div><\/div>/, ""))).toBe(
      "ouvrières ou TdC absents de la page Ressources",
    );
    // une chasse que la lecture ne trouve pas : refusé
    expect(
      analyser(
        RESSOURCES(1800, "materiaux", "") + "<p>- Vos chasseuses vont conquérir 5 cm² dans 1H</p>",
      ),
    ).toBe("chasses en cours illisibles");
  });
});

describe("mes floods : la prise de la synthèse, sinon les troupes", () => {
  const floods = (html: string) =>
    lire(
      `CommerceFzzz.attaquesArmee(${JSON.stringify(html)}, ["chasses déjà lues"]).then((r) => (window.FLOODS = r))`,
    );
  const attendre = () => new Promise((r) => setTimeout(r, 20));

  test("prise de la synthèse ; sans elle, les troupes (le plus qu'il puisse prendre) ; renforts ignorés", async () => {
    synthese({ 501: { prise: 4000 } });
    floods(
      ARMEE(
        ATTAQUE(501, "Cible", 1830, TROUPES("5 000 Jeunes Soldates Naines", "14h30")) +
          ATTAQUE(502, "Autre", 3010, TROUPES("20 000 Jeunes Soldates Naines", "14h50")) +
          RENFORT(503, 600) +
          ATTAQUE(504, "Golf", 4000),
      ),
    );
    await attendre();
    expect(lire(`FLOODS`)).toEqual({
      liste: [
        { arrivee: a("14:30:30"), terrain: 4000 },
        { arrivee: a("14:50:10"), terrain: 20000 },
      ],
      inconnues: 1,
      lue: true,
    });
    // la synthèse reçoit mes attaques et les chasses déjà lues (pas de nouvelle lecture)
    expect(lire(`MOUV.appels`)).toEqual([{ ids: [501, 502, 504], chasses: true }]);
  });

  test("flood hors de portée à l'impact : 0 cm²", async () => {
    synthese({ 501: { prise: 0 } });
    floods(ARMEE(ATTAQUE(501, "Cible", 1830, TROUPES("5 000 Jeunes Soldates Naines", "14h30"))));
    await attendre();
    expect(lire(`FLOODS.liste`)).toEqual([{ arrivee: a("14:30:30"), terrain: 0 }]);
  });

  test("pas une page Armée (connexion) : signalé ; aucune attaque : synthèse pas calculée", async () => {
    synthese();
    floods("<html>connexion</html>");
    await attendre();
    expect(lire(`FLOODS`)).toEqual({ liste: [], inconnues: 0, lue: false });
    floods(ARMEE(RENFORT(503, 600)));
    await attendre();
    expect(lire(`[FLOODS, MOUV.appels.length]`)).toEqual([
      { liste: [], inconnues: 0, lue: true },
      0,
    ]);
  });
});

describe("clic sur un montant du Récapitulatif", () => {
  // page Convois : bloc du joueur (15 000 ouvrières, TdC 14 000), convois en
  // cours (Alpha de retour à 14h20:30, Bravo à 14h30:10), encadré Compte+ et formulaire
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
  const pages = (ressources: string, echec = false, armee: string | false = ARMEE()) =>
    lire(`(() => {
      $.get = (url) => {
        LECTURES.push(url);
        if (${echec}) return $.Deferred().reject({ status: 503 });
        if (/Armee/.test(url)) return ${armee === false ? "$.Deferred().reject({ status: 503 })" : `$.Deferred().resolve(${JSON.stringify(armee)})`};
        return $.Deferred().resolve(${JSON.stringify(ressources)});
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
  const toast = () => espaces(lire<string[]>(`TOASTS`)[0]!);
  const attendre = () => new Promise((r) => setTimeout(r, 30));

  test("option décochée (par défaut) : remplissage habituel, aucune page lue", async () => {
    option(false);
    expect(lire(`new Joueur({ pseudo: "X" }).parametre["convoisAvantRecolte"].valeur`)).toBe(false);
    ouvrirConvois();
    pages(RESSOURCES());
    lire(`CommerceFzzz.remplirMateriaux(300000, 2400)`);
    await attendre();
    // 1 000 libres × 20 = 20 000, moins 1 000 de nourriture
    expect(champs()).toEqual(["19000", "19000", "1000", "1000"]);
    expect(lire(`LECTURES`)).toEqual([]);
    expect(toast()).toBe(
      "Matériaux réduits à 19 000 sur 300 000 : ouvrières à garder pour exploiter le terrain.",
    );
  });

  test("option cochée : Ressources puis Armée lues, A + B − E à la récolte de 14h30, valable 5 min", async () => {
    option(true);
    ouvrirConvois();
    synthese();
    pages(RESSOURCES());
    // destinataire à 40 min : convoi lancé d'ici 14h05, de retour à 14h45
    lire(`CommerceFzzz.remplirMateriaux(300000, 2400)`);
    // d'abord le remplissage habituel, sans message
    expect(champs()).toEqual(["19000", "19000", "1000", "1000"]);
    await attendre();
    expect(lire(`LECTURES`)).toEqual(["/Ressources.php", "/Armee.php"]);
    // 15 000 + 10 000 (Alpha, de retour à 14h20:30) − 14 000 ; Bravo (14h30:10) trop tard
    expect(champs()).toEqual(["219000", "219000", "11000", "11000"]);
    expect(toast()).toBe(
      "Récolte de 14h30 : 10 000 ouvrières de plus pour le convoi (comptées : 10 000 de retour de convoi). Matériaux réduits à 219 000 sur 300 000 : ouvrières à garder pour exploiter le terrain. Valable si tu lances le convoi d'ici 14h05.",
    );
  });

  test("convoi long : les récoltes suivantes aussi, un flood qui tombe après la première réduit le convoi", async () => {
    option(true);
    ouvrirConvois(1);
    synthese({ 501: { prise: 9000 } });
    pages(
      RESSOURCES(),
      false,
      ARMEE(ATTAQUE(501, "Cible", 2400, TROUPES("9 000 Jeunes Soldates Naines", "14h40"))),
    );
    // destinataire à 2 h : récoltes de 14h30 à 16h00
    lire(`CommerceFzzz.remplirMateriaux(300000, 7200)`);
    await attendre();
    // 15h00 : 15 000 + 17 500 − 14 000 − 9 000 (flood de 14h40)
    expect(champs()).toEqual(["189000", "189000", "9500", "9500"]);
    expect(toast()).toBe(
      "Récolte de 15h00 : 8 500 ouvrières de plus pour le convoi (comptées : 17 500 de retour de convoi ; terrain gagné d'ici là : 9 000 cm² de tes floods). Matériaux réduits à 189 000 sur 300 000 : ouvrières à garder pour exploiter le terrain. Valable si tu lances le convoi d'ici 14h05.",
    );
    // destinataire à 40 min : de retour avant 15h00, le flood ne change rien
    lire(`CommerceFzzz.remplirMateriaux(300000, 2400)`);
    await attendre();
    expect(champs()).toEqual(["219000", "219000", "11000", "11000"]);
  });

  test("convoi de retour au moins une minute avant la prochaine récolte : toutes les ouvrières présentes", async () => {
    option(true);
    ouvrirConvois();
    synthese();
    pages(RESSOURCES());
    // destinataire à 10 min : de retour à 14h15
    lire(`CommerceFzzz.remplirMateriaux(300000, 600)`);
    await attendre();
    expect(champs()).toEqual(["299000", "299000", "15000", "15000"]);
    expect(toast()).toBe(
      "Le convoi revient au moins une minute avant la prochaine récolte : toutes tes ouvrières présentes peuvent partir. Matériaux réduits à 299 000 sur 300 000 : pas assez d'ouvrières. Valable si tu lances le convoi d'ici 14h05.",
    );
  });

  test("temps de trajet inconnu : toutes les récoltes jusqu'à la dernière arrivée connue, sans délai", async () => {
    option(true);
    ouvrirConvois();
    synthese();
    pages(RESSOURCES());
    lire(`CommerceFzzz.remplirMateriaux(300000)`);
    await attendre();
    expect(champs()).toEqual(["219000", "219000", "11000", "11000"]);
    expect(toast()).not.toContain("Valable si");
  });

  test("sans affectation automatique, ou avec un flood aux troupes inconnues : le message le dit", async () => {
    option(true);
    ouvrirConvois(2);
    synthese();
    pages(RESSOURCES(1800, "rien"), false, ARMEE(ATTAQUE(504, "Golf", 4000)));
    lire(`CommerceFzzz.remplirMateriaux(100000, 2400)`);
    await attendre();
    const texte = toast();
    expect(texte).toContain(
      "Sans affectation automatique des ouvrières (Compte+ réglé sur Nourriture ou Matériaux, page Ressources), affecte toi-même celles qui arrivent avant chaque récolte.",
    );
    expect(texte).toContain(
      "1 flood en cours sans troupes connues : son terrain n'est pas compté.",
    );
  });

  test("Compte+ sans attaque dans son encart : la page Armée n'est pas lue ; avec, elle l'est", async () => {
    option(true);
    synthese();
    ouvrirConvois(0, true);
    pages(RESSOURCES());
    lire(`CommerceFzzz.remplirMateriaux(300000, 2400)`);
    await attendre();
    expect(lire(`LECTURES`)).toEqual(["/Ressources.php"]);
    ouvrirConvois(1, true);
    pages(RESSOURCES());
    lire(`CommerceFzzz.remplirMateriaux(300000, 2400)`);
    await attendre();
    expect(lire(`LECTURES`)).toEqual(["/Ressources.php", "/Armee.php"]);
  });

  test("page Armée illisible : le calcul se fait sans les floods, le message le dit", async () => {
    option(true);
    ouvrirConvois(1);
    synthese();
    pages(RESSOURCES(), false, false);
    lire(`CommerceFzzz.remplirMateriaux(300000, 2400)`);
    await attendre();
    expect(champs()).toEqual(["219000", "219000", "11000", "11000"]);
    expect(toast()).toContain(
      "Page Armée illisible : le terrain de tes floods en cours n'est pas compté.",
    );
  });

  test("une chasse rapporte du terrain avant la récolte : moins d'ouvrières que d'habitude", async () => {
    option(true);
    ouvrirConvois();
    synthese();
    // plus de convoi en cours : seule la chasse compte (arrivée à 14h10)
    lire(`$("#centre strong, #centre small").remove()`);
    pages(RESSOURCES(1800, "materiaux", CHASSE(7, "500", 600)));
    lire(`CommerceFzzz.remplirMateriaux(300000, 2400)`);
    await attendre();
    expect(champs()).toEqual(["9000", "9000", "500", "500"]);
    expect(toast()).toBe(
      "Récolte de 14h30 : 500 ouvrières de moins pour le convoi, gardées pour exploiter ton terrain (500 cm² de chasses compris). Matériaux réduits à 9 000 sur 300 000 : ouvrières à garder pour exploiter le terrain. Valable si tu lances le convoi d'ici 14h05.",
    );
  });

  test("lecture impossible : le remplissage habituel reste, avec la raison", async () => {
    option(true);
    ouvrirConvois();
    synthese();
    pages(RESSOURCES(), true);
    lire(`CommerceFzzz.remplirMateriaux(300000, 2400)`);
    await attendre();
    expect(champs()).toEqual(["19000", "19000", "1000", "1000"]);
    expect(toast()).toBe(
      "Ouvrières d'avant la récolte non comptées (le jeu traitait une autre action) : remplissage habituel. Matériaux réduits à 19 000 sur 300 000 : ouvrières à garder pour exploiter le terrain.",
    );
  });

  test("champs changés par le joueur pendant la lecture : pas réécrits", async () => {
    option(true);
    ouvrirConvois();
    synthese();
    pages(RESSOURCES());
    lire(`CommerceFzzz.remplirMateriaux(300000, 2400); $("#input_nbMateriaux").val("5000")`);
    await attendre();
    expect(champs()[0]).toBe("5000");
    expect(toast()).toContain("Champs du convoi changés entre-temps : non réécrits.");
  });

  test("deux clics de suite : seul le dernier s'applique, pages lues une fois pour la minute", async () => {
    option(true);
    ouvrirConvois();
    synthese();
    pages(RESSOURCES());
    lire(`CommerceFzzz.remplirMateriaux(300000, 2400); CommerceFzzz.remplirMateriaux(50000, 2400)`);
    await attendre();
    expect(lire<string[]>(`TOASTS`).length).toBe(1);
    expect(champs()).toEqual(["50000", "50000", "2550", "2550"]);
    lire(`CommerceFzzz.remplirMateriaux(300000, 2400)`);
    await attendre();
    expect(lire(`LECTURES`).length).toBe(2);
    // une minute plus tard : relues
    lire(`NOW += 60000; CommerceFzzz.remplirMateriaux(300000, 2400)`);
    await attendre();
    expect(lire(`LECTURES`).length).toBe(4);
    lire(`NOW -= 60000`);
  });
});

describe("Préférences → Convois", () => {
  test("case décochée par défaut", () => {
    const p = lire<{ type: string; valeur: boolean }>(
      `(() => { let x = new Joueur({ pseudo: "X" }).parametre["convoisAvantRecolte"]; return { type: x._type, valeur: x.valeur }; })()`,
    );
    expect(p).toEqual({ type: "checkbox", valeur: false });
  });
});
