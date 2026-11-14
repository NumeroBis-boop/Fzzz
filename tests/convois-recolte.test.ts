import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

// Convoi avant la récolte (idée de KWHWWYMWN) : les ouvrières qui reviennent de
// convoi ou sont pondues avant une récolte peuvent partir, le terrain restant
// exploité à chaque récolte. Joueurs et montants inventés.
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
    "js/class/ExportRapports.js",
    "js/page/PartageChasses.js",
    "js/page/Ressource.js",
    "js/page/CommerceFzzz.js",
    "js/content.js",
  ],
  `var chrome = { runtime: { getManifest: () => ({ version: "0" }), getURL: (p) => p } };
   var NOW = moment("2026-11-14T14:00:00").valueOf();
   var Horloge = { serveur: () => moment(NOW), maintenant: () => NOW };
   document.body.innerHTML = "<div class='boite_connexion_titre'>Connexion</div>";`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);
// instant du jour de test (heure du serveur)
const a = (hhmmss: string) => lire<number>(`moment("2026-11-14T${hhmmss}").valueOf()`);
const espaces = (t: string) => t.replace(/[\s  ]+/g, " ");

const calcul = (d: object) =>
  lire<{ libres: number; recolte: number; revenues: number; pondues: number; gagne: number }>(
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

  test("pontes : une à une, comptées si leur minute est entière avant la récolte", () => {
    // 60 ouvrières de 14h00 à 14h10 : une toutes les 10 s, la k-ième à 14h00 + 10k s
    const pondues = (recolte: string) =>
      calcul({
        presentes: 15000,
        terrain: 15000,
        recolte: a(recolte),
        pontes: [{ debut: a("14:00:00"), fin: a("14:10:00"), ouvrieres: 60 }],
      }).pondues;
    // récolte à 14h05:30 ou 14h05:00 : celles arrivées avant 14h05:00 (la 30e, à 14h05:00 pile, non)
    expect(pondues("14:05:30")).toBe(29);
    expect(pondues("14:05:00")).toBe(29);
    // récolte à 14h04:59 : la minute 14h04 n'est pas finie, celles d'avant 14h04:00
    expect(pondues("14:04:59")).toBe(23);
    expect(pondues("14:00:30")).toBe(0);
    expect(pondues("14:11:00")).toBe(60);
    // terrain plein au départ : libres = pondues comptées
    expect(
      calcul({
        presentes: 15000,
        terrain: 15000,
        recolte: a("14:05:30"),
        pontes: [{ debut: a("14:00:00"), fin: a("14:10:00"), ouvrieres: 60 }],
      }).libres,
    ).toBe(29);
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

  test("la récolte qui limite : une chasse après la première récolte peut réduire le convoi", () => {
    const r = calcul({
      presentes: 15000,
      terrain: 14000,
      recolte: a("14:30:00"),
      retours: [
        { minute: a("14:20:00"), ouvrieres: 10000 },
        { minute: a("14:30:00"), ouvrieres: 7500 },
      ],
      pontes: [{ debut: a("14:00:00"), fin: a("14:20:00"), ouvrieres: 600 }],
      chasses: [{ impact: a("14:41:00"), terrain: 10000 }],
    });
    // 14h30 : 15 000 + 10 000 + 600 − 14 000 = 11 600 ; 15h00 : + 7 500, − 10 000 cm² = 9 100
    expect(r).toEqual({
      libres: 9100,
      recolte: a("15:00:00"),
      revenues: 17500,
      pondues: 600,
      gagne: 10000,
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

  test("ponte longue : toutes les récoltes jusqu'à la fin des arrivées examinées, pas au-delà", () => {
    const r = calcul({
      presentes: 15000,
      terrain: 15000,
      recolte: a("14:30:00"),
      pontes: [{ debut: a("14:00:00"), fin: moment_jours(3), ouvrieres: 100000 }],
      chasses: [{ impact: moment_jours(2), terrain: 1 }],
    });
    // la récolte de 14h30 limite ; la chasse dans deux jours ne change rien
    expect(r.recolte).toBe(a("14:30:00"));
    expect(r.libres).toBe(r.pondues);
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
  const ALPHA = `<strong>- Vous allez livrer 200 000 <img alt="nourritures" src="n.gif"/> et 0 <img alt="materiaux" src="m.gif"/> à  <a href="Membre.php?Pseudo=Alpha">Alpha</a> dans 1H 05m 20s  </strong> - <small><em>Retour le 14 nov. à 14h20</em></small> - <a href="commerce.php?annuler=1&amp;t=x">Annuler</a><br />`;
  const BRAVO = `<strong>- Vous allez livrer 0 <img alt="nourritures" src="n.gif"/> et 150 001 <img alt="materiaux" src="m.gif"/> à  <a href="Membre.php?Pseudo=Bravo">Bravo</a> dans 2H 03m 10s  </strong> - <small><em>Retour le 14 nov. à 14h30</em></small><br />`;
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

  test("lignes en deux colonnes : le retour du jeu est toujours lu", () => {
    convois(ALPHA + BRAVO);
    lire(`CommerceFzzz.colonnes(CommerceFzzz.lignes().get())`);
    expect(lire(`$(".o_convoi").length`)).toBe(2);
    expect(lire<any[]>(`CommerceFzzz.retoursConvois(NOW, 20)`).length).toBe(2);
  });

  test("sans Compte+ : l'heure ajoutée par l'extension (celle de l'arrivée) n'est pas lue", () => {
    convois(
      `<strong>- Vous allez livrer 200 000 <img alt="nourritures" src="n.gif"/> et 0 <img alt="materiaux" src="m.gif"/> à  <a href="Membre.php?Pseudo=Alpha">Alpha</a> dans 1H 05m 20s  </strong><span class='small'>- Retour le 14 nov. 2026 à 15h06</span><br />`,
    );
    expect(lire(`CommerceFzzz.retoursConvois(NOW, 20)`)).toEqual([]);
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

describe("pages Ressources et Reine lues au clic", () => {
  const analyser = (ressources: string, reine: string) =>
    lire(
      `(() => { try { return CommerceFzzz.analyserRecolte({ html: ${JSON.stringify(ressources)}, avant: NOW, apres: NOW + 300 }, { html: ${JSON.stringify(reine)}, avant: NOW + 300, apres: NOW + 600 }); } catch (e) { return e.message; } })()`,
    );

  test("récolte au plus tôt, pontes d'ouvrières au plus tard, ouvrières en convoi", () => {
    lire(
      `var monProfil = new Joueur({ pseudo: "Test", niveauRecherche: [15, 8, 10, 0, 0, 8, 0, 0, 0, 0], niveauConstruction: Object.assign(new Array(13).fill(0), { 11: 20 }) });`,
    );
    expect(analyser(RESSOURCES(), REINE())).toEqual({
      recolte: a("14:30:00"),
      presentes: 15000,
      enConvoi: 17500,
      terrain: 14000,
      pontes: [
        { debut: a("14:00:00") + 600, fin: a("14:20:00") + 600, ouvrieres: 600 },
        { debut: a("16:20:00") + 600, fin: a("17:20:00") + 600, ouvrieres: 3000 },
      ],
      chasses: [],
      automatique: true,
      instant: a("14:00:00") + 600,
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
  const ouvrirConvois = (attaques = 0) =>
    lire(`(() => {
      window.TOASTS = []; window.LECTURES = [];
      $.toast = (o) => TOASTS.push(o.text);
      CommerceFzzz._recolteLue = null; CommerceFzzz._recolteEnCours = null;
      document.body.innerHTML = '<div id="data"><div id="nb_ouvrieres">15000</div><div id="nb_materiaux">3460273</div><div id="quantite_tdc">14000</div></div>'
        + ${attaques ? `'<table><tr id="ligne_attaque"><td><a href="Armee.php"><strong>${attaques}</strong> attaque</a></td></tr></table>'` : "''"}
        + '<div id="centre"><h3>Convois en cours:</h3>'
        + '<strong>- Vous allez livrer 200 000 <img alt="nourritures"/> et 0 <img alt="materiaux"/> à  <a href="Membre.php?Pseudo=Alpha">Alpha</a> dans 1H 05m 20s  </strong> - <small><em>Retour le 14 nov. à 14h20</em></small><br />'
        + '<strong>- Vous allez livrer 0 <img alt="nourritures"/> et 150 000 <img alt="materiaux"/> à  <a href="Membre.php?Pseudo=Bravo">Bravo</a> dans 2H 03m 10s  </strong> - <small><em>Retour le 14 nov. à 14h30</em></small><br />'
        + '</div><input id="pseudo_convoi"><input id="input_nbNourriture" value="1 000"><input id="nbNourriture" value="1000">'
        + '<input id="input_nbMateriaux"><input id="nbMateriaux"><input id="input_nbOuvriere"><input id="nbOuvriere">';
    })()`);
  const pages = (ressources: string, reine: string, echec = false) =>
    lire(`(() => {
      $.get = (url) => {
        LECTURES.push(url);
        if (${echec}) return $.Deferred().reject({ status: 503 });
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

  test("option cochée : Ressources puis Reine lues, ouvrières de retour et pondues avant la récolte ajoutées", async () => {
    option(true);
    ouvrirConvois();
    pages(RESSOURCES(), REINE());
    lire(`CommerceFzzz.remplirMateriaux(300000)`);
    // d'abord le remplissage habituel, sans message
    expect(champs()).toEqual(["19000", "19000", "1000", "1000"]);
    await attendre();
    expect(lire(`LECTURES`)).toEqual(["/Ressources.php", "/Reine.php"]);
    // récolte de 14h30 : 15 000 + 10 000 (Alpha, retour 14h20) + 600 pondues − 14 000 ;
    // Bravo (retour 14h30) ne compte qu'à la récolte de 15h00
    expect(champs()).toEqual(["231000", "231000", "11600", "11600"]);
    expect(espaces(lire<string[]>(`TOASTS`)[0]!)).toBe(
      "Récolte de 14h30 : 10 600 ouvrières de plus pour le convoi (comptées : 10 000 de retour de convoi, 600 pondues d'ici là). Matériaux réduits à 231 000 sur 300 000 : ouvrières à garder pour exploiter le terrain.",
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
    expect(champs()).toEqual(["31000", "31000", "1600", "1600"]);
  });

  test("sans affectation automatique, ou avec des attaques en cours : le message le dit", async () => {
    option(true);
    ouvrirConvois(2);
    pages(RESSOURCES(1800, "rien"), REINE());
    lire(`CommerceFzzz.remplirMateriaux(100000)`);
    await attendre();
    const texte = espaces(lire<string[]>(`TOASTS`)[0]!);
    expect(texte).toContain(
      "Sans affectation automatique des ouvrières (Compte+ réglé sur Nourriture ou Matériaux, page Ressources), affecte toi-même celles qui arrivent avant chaque récolte.",
    );
    expect(texte).toContain("Le terrain que prendront tes 2 attaques en cours n'est pas compté.");
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
    expect(lire(`LECTURES`).length).toBe(2);
    // une minute plus tard : relues
    lire(`NOW += 60000; CommerceFzzz.remplirMateriaux(300000)`);
    await attendre();
    expect(lire(`LECTURES`).length).toBe(4);
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
