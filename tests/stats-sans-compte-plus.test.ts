import { beforeEach, describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Relevé des stats membres d'un joueur sans Compte+ (19/11/2026 : « page Reine
 * illisible (nombre d'ouvrières absent de la page) » pour un joueur sans
 * Compte+) : sa page Reine n'a pas les champs cachés armee_initial* que le
 * relevé y lisait. Ouvrières : celles de l'en-tête de la page Convois et
 * celles de ses convois en cours ; armée : garnison de la page Armée et
 * troupes parties connues de ce navigateur, jamais une armée comptée en
 * moins ; au dernier essai du jour, le reste part sans l'armée (réponse du
 * mainteneur, 20/11/2026). Pages, joueurs et nombres inventés.
 */
const page = creerPage(
  [
    "js/class/Utils.js",
    "js/class/DelaiRessources.js",
    "js/class/ExportRapports.js",
    "js/class/Armee.js",
    "js/class/TroupesDehors.js",
    "js/class/AttaqueLancee.js",
    "js/page/PartageChasses.js",
    "js/page/CommerceFzzz.js",
    "js/class/SuiviMembres.js",
    "js/content.js",
  ],
  // constantes du jeu (content.js) ; l'encart « Connexion » empêche le démarrage
  `var chrome = { runtime: { getManifest: () => ({ version: "1.143.1" }), getURL: (p) => p } };
   document.body.innerHTML = "<div class='boite_connexion_titre'>Connexion</div>";
   var heure = moment("2026-11-19 20:00", "YYYY-MM-DD HH:mm").valueOf();
   var Horloge = { maintenant: () => heure, serveur: () => moment(heure), serveurA: (t) => moment(t) };
   var monProfil = { pseudo: "Alpha" };`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);

// en-tête de chaque page du jeu : ouvrières présentes et TdC
const entete = (ouvrieres = "1 000") =>
  `<div id="data" style="display:none"><div id="nb_ouvrieres">${ouvrieres}</div><div id="quantite_tdc">5 000</div></div>`;
const ligne = (nom: string, niveau: number) =>
  `<tr class="ligneAmelioration"><td><div class="desciption_amelioration"><h2>${nom}</h2><span class="niveau_amelioration">niveau ${niveau}</span></div></td></tr>`;
// Étable à pucerons 2 : une ouvrière porte 11 ressources
const CONSTRUCTION = `<div id="centre"><table>${[
  ["Champignonnière", 17],
  ["Couveuse", 14],
  ["Solarium", 12],
  ["Etable à pucerons", 2],
]
  .map(([n, v]) => ligne(String(n), Number(v)))
  .join("")}</table></div>`;
const LABORATOIRE = `<div id="centre"><table>${[
  ["Technique de ponte", 3],
  ["Armes", 6],
  ["Vitesse d'attaque", 5],
  ["Vitesse de chasse", 4],
]
  .map(([n, v]) => ligne(String(n), Number(v)))
  .join("")}</table></div>`;
// page Reine sans Compte+ : ni nombre à côté des noms, ni champs cachés
const REINE_SANS = `${entete("4 967 437")}<div id="centre"><table><tr class="ligneAmelioration"><td><h2>Ouvrière</h2></td></tr><tr class="ligneAmelioration"><td><h2>Jeune Soldate Naine</h2></td></tr></table></div>`;
const REINE_AVEC = `${entete()}<div id="centre"><table><tr class="ligneAmelioration"><td><h2>Ouvrière</h2><span id="armee_initial">70 481</span></td></tr></table></div>`;
const convoi = (nourriture: string, materiaux: string, id: number) =>
  `<strong>- Vous allez livrer ${nourriture} <img alt="nourritures" src="n.gif"/> et ${materiaux} <img alt="materiaux" src="m.gif"/> à  <a href="Membre.php?Pseudo=Bravo">Bravo</a> dans 8H 55m 20s  </strong> - <a href="commerce.php?annuler=${id}&amp;t=x">Annuler</a><br />\n`;
// deux convois envoyés, un convoi reçu (pas des ouvrières du joueur)
const COMMERCE =
  `${entete()}<div id="centre"><h3>Convois en cours:</h3>` +
  convoi("200 000", "0", 1) +
  convoi("0", "466 945", 2) +
  `<strong>- Vous allez recevoir 50 000 <img alt="nourritures" src="n.gif"/> et 0 <img alt="materiaux" src="m.gif"/> de <a href="Membre.php?Pseudo=Charlie">Charlie</a> dans 1H 00m 00s</strong><br />\n<h3>Organiser un convoi</h3></div>`;
// 1 000 + ⌈200 000 / 11⌉ + ⌈466 945 / 11⌉
const OUVRIERES = 1000 + 18182 + 42450;
// page Armée : garnison (Jeune Soldate Naine et Soldate, sur deux lieux)
const garnison = (attaques = "") =>
  `${entete()}<div id="centre"><h3>Attaque(s) en cours</h3>${attaques}<h3>Troupes en Garnison</h3><table class="simulateur">` +
  `<tr align="center"><td><div class="pas_sur_telephone">Jeune Soldate Naine</div></td><td><span>1 000</span></td><td><span>500</span></td></tr>` +
  `<tr align="center"><td><div class="pas_sur_telephone">Soldate</div></td><td><span>200</span></td><td></td></tr></table></div>`;
const ATTAQUE = (id: number) =>
  `- Vous allez attaquer <span class="gras"><a href="Membre.php?Pseudo=Delta">Delta</a>(<a href="classementAlliance.php?alliance=TAG">TAG</a>)</span> (Terrain de chasse) dans <span class="gras" id="attaque_${id}">…</span><script language="JavaScript">reste(3600, "attaque_${id}");</script> - <a href="/Armee.php?annuler=${id}">Annuler</a><br/>`;
const RENFORT = (id: number) =>
  `- Des renforts arrivent dans <span class="gras" id="attaque_${id}">…</span><script language="JavaScript">reste(600, "attaque_${id}");</script><br/>`;
const ressources = (chasses: number[] = []) =>
  `${entete()}<div id="centre"><div id="boite_tdc">${chasses
    .map(
      (id) =>
        `<span class="titre">Chasse en cours<br /> </span><span>- Vos chasseuses vont conquérir 1 000 cm² dans <span id="chasse_${id}">1H 0m 0s </span></span><script language="JavaScript">reste(3600, "chasse_${id}");</script> - <a href="/Ressources.php?annuler=${id}">Annuler</a><br />`,
    )
    .join("")}</div></div>`;
const unites = (jsn: number, soldates = 0) => {
  const u = new Array(14).fill(0);
  u[0] = jsn;
  u[4] = soldates;
  return u;
};

beforeEach(() => {
  lire(`(() => {
    localStorage.clear();
    history.replaceState(null, "", "/Messagerie.php");
    Utils._reine = null; Utils._pageReine = null; SuiviMembres._lues = {}; DelaiRessources._pageConvois = null;
    monProfil.niveauConstruction = Object.assign([], { 11: 2 });
    monProfil.niveauRecherche = Object.assign([], { 4: 4 });
    window.JEU = { lues: [], pages: { "/construction.php": ${JSON.stringify(CONSTRUCTION)}, "/Reine.php": ${JSON.stringify(REINE_SANS)},
      "/commerce.php": ${JSON.stringify(COMMERCE)}, "/Armee.php": ${JSON.stringify(garnison())}, "/Ressources.php": ${JSON.stringify(ressources())} } };
    $.get = (url) => {
      let chemin = new URL(url).pathname;
      JEU.lues.push(chemin);
      return Promise.resolve(JEU.pages[chemin]);
    };
    // lecture de la page Convois à l'ouverture de Construction (DelaiRessources)
    $.ajax = (o) => {
      let chemin = new URL(o.url, location.origin).pathname;
      JEU.lues.push(chemin);
      return Promise.resolve(JEU.pages[chemin]);
    };
  })()`);
});
const lues = () => lire<string[]>(`JEU.lues`);
const registre = (entrees: object[]) =>
  lire(`localStorage.setItem("outiiil_troupesDehors", ${JSON.stringify(JSON.stringify(entrees))})`);
const relever = (partages: object) =>
  lire<Promise<any>>(
    `SuiviMembres.relever(${JSON.stringify(partages)}).then((d) => ({ ok: d }), (e) => ({ erreur: e.message }))`,
  );

describe("page Reine sans les champs du Compte+", () => {
  test("repérée comme telle ; une page de connexion ne l'est pas", async () => {
    expect(
      await lire(`Utils.lireReine().then((r) => [r.reine, r.sansComptePlus, r.raison])`),
    ).toEqual([false, true, "nombre d'ouvrières absent de la page"]);
    lire(
      `(() => { Utils._reine = null; Utils._pageReine = null; JEU.pages["/Reine.php"] = "<form>Connexion</form>"; })()`,
    );
    expect(await lire(`Utils.lireReine().then((r) => [r.reine, r.sansComptePlus])`)).toEqual([
      false,
      false,
    ]);
  });

  test("ouvrières : en-tête de la page Convois + ouvrières des convois envoyés (Étable 2 : 11 par ouvrière), pas des convois reçus", async () => {
    expect(await relever({ ouvrieres: true })).toEqual({ ok: { ouvrieres: OUVRIERES } });
    expect(lues()).toEqual(["/Reine.php", "/construction.php", "/commerce.php"]);
    // le profil du site de suivi lit le même nombre, sans relire les pages
    expect(await lire(`SuiviMembres.ouvrieres()`)).toBe(OUVRIERES);
    expect(lues().length).toBe(3);
  });

  test("Compte+ : la page Reine fait foi, aucune autre page lue", async () => {
    lire(`JEU.pages["/Reine.php"] = ${JSON.stringify(REINE_AVEC)}`);
    expect(await relever({ ouvrieres: true })).toEqual({ ok: { ouvrieres: 70481 } });
    expect(lues()).toEqual(["/Reine.php"]);
  });

  test("page de connexion au lieu de la page Reine : échec comme avant, rien d'autre lu", async () => {
    lire(`JEU.pages["/Reine.php"] = "<form>Connexion</form>"`);
    expect(await relever({ ouvrieres: true })).toEqual({
      erreur: "page Reine illisible (nombre d'ouvrières absent de la page)",
    });
    expect(lues()).toEqual(["/Reine.php"]);
  });

  test("page Convois illisible : échec, réessayé plus tard comme une page illisible", async () => {
    lire(`JEU.pages["/commerce.php"] = "<form>Connexion</form>"`);
    expect((await relever({ ouvrieres: true })).erreur).toContain("page Convois illisible");
  });
});

describe("armée sans Compte+ : garnison de la page Armée et troupes parties connues", () => {
  test("rien dehors : la garnison, sur tous ses lieux", async () => {
    expect(await relever({ cdf: true })).toEqual({ ok: { cdf: 1700 } });
    expect(lues()).toEqual(["/Reine.php", "/Armee.php", "/Ressources.php"]);
  });

  test("chasse et attaque lancées depuis ce navigateur : leurs troupes comptées ; un renfort reçu ignoré", async () => {
    lire(`(() => {
      JEU.pages["/Armee.php"] = ${JSON.stringify(garnison(ATTAQUE(901) + RENFORT(902)))};
      JEU.pages["/Ressources.php"] = ${JSON.stringify(ressources([55]))};
    })()`);
    registre([
      { type: "chasse", id: 55, unite: unites(300), lancee: 0, retour: 4102444800000 },
      { type: "attaque", id: 901, unite: unites(0, 40), lancee: 0, retour: 4102444800000 },
    ]);
    expect(await relever({ cdf: true })).toEqual({ ok: { cdf: 1700 + 300 + 40 } });
  });

  test("chasse lancée ailleurs (troupes inconnues) : pas d'armée comptée en moins, le relevé échoue", async () => {
    lire(`JEU.pages["/Ressources.php"] = ${JSON.stringify(ressources([77]))}`);
    expect((await relever({ cdf: true })).erreur).toContain(
      "1 chasse(s) ou attaque(s) en cours aux troupes inconnues sans Compte+",
    );
  });

  test("attaque lancée ailleurs : même chose", async () => {
    lire(`JEU.pages["/Armee.php"] = ${JSON.stringify(garnison(ATTAQUE(903)))}`);
    expect((await relever({ fdfHB: true })).erreur).toContain("armée incomplète");
  });

  test("page Armée illisible (connexion) : échec, jamais une armée vide", async () => {
    lire(`JEU.pages["/Armee.php"] = "<form>Connexion</form>"`);
    expect((await relever({ cdf: true })).erreur).toContain("page Armée illisible");
  });
});

describe("dernier essai du jour : une chasse lancée ailleurs n'empêche plus le reste de partir", () => {
  // une page ouverte du jeu, puis la suivante une heure plus tard (pause entre deux essais)
  const essai = async () => {
    lire(`(() => { SuiviMembres._lues = {}; Utils._reine = null; Utils._pageReine = null; })()`);
    const r = await lire<Promise<string>>(`SuiviMembres.lancer()`);
    lire(`heure += 61 * 60000`);
    return r;
  };
  const envois = () => lire<any[]>(`JSON.parse(JSON.stringify(ENVOIS))`);
  const etat = () => lire<any>(`SuiviMembres.etat()`);
  beforeEach(() => {
    lire(`(() => {
      heure = moment("2026-11-19 12:00", "YYYY-MM-DD HH:mm").valueOf();
      JEU.pages["/laboratoire.php"] = ${JSON.stringify(LABORATOIRE)};
      JEU.pages["/Ressources.php"] = ${JSON.stringify(ressources([77]))};
      if (!document.getElementById("tag_alliance"))
        document.body.insertAdjacentHTML("beforeend", "<div id='tag_alliance'>TAG</div>");
      localStorage.setItem("fzzz_suiviMembres", JSON.stringify({ alpha: { annonce: true } }));
      window.ENVOIS = [];
      SuiviMembres.adresse = () => Promise.resolve({ url: "https://script.invalid/exec" });
      SuiviMembres.envoyer = (url, jour, donnees, partages) => {
        ENVOIS.push({ jour, donnees, partages });
        return Promise.resolve({ ok: true });
      };
    })()`);
  });

  test("deux échecs, puis au 3e essai tout part sauf CdF et FdF, toujours partagés (cases vides dans le fichier)", async () => {
    expect([await essai(), await essai()]).toEqual(["échec", "échec"]);
    expect(envois()).toEqual([]);
    expect(etat().raison).toContain("armée incomplète");
    expect(await essai()).toBe("envoyé");
    const [envoi] = envois();
    expect(envoi.donnees).toEqual({
      tdp: 14 + 12 + 3,
      va: 5,
      vc: 4,
      puceron: 2,
      champignonniere: 17,
      ouvrieres: OUVRIERES,
    });
    expect([envoi.partages.cdf, envoi.partages.fdfHB, envoi.partages.fdfAB]).toEqual([
      true,
      true,
      true,
    ]);
    expect(etat()).toMatchObject({ fait: true, raison: "", incomplet: ["cdf", "fdfHB", "fdfAB"] });
    expect(lire(`SuiviMembres.probleme()`)).toBe(
      "Aujourd'hui, relevé envoyé sans CdF, FdF HB et FdF AB : une chasse ou une attaque lancée depuis un autre appareil ou navigateur était en cours (troupes inconnues sans Compte+).",
    );
    // le relevé du jour est fait : plus d'essai
    expect(await essai()).toBe("attente");
    expect(envois().length).toBe(1);
  });

  test("CdF décochée : seules les FdF manquent", async () => {
    lire(`localStorage.setItem("fzzz_partage_cdf", "0")`);
    await essai();
    await essai();
    expect(await essai()).toBe("envoyé");
    expect(envois()[0].partages.cdf).toBe(false);
    expect(etat().incomplet).toEqual(["fdfHB", "fdfAB"]);
    expect(lire<string>(`SuiviMembres.probleme()`)).toStartWith(
      "Aujourd'hui, relevé envoyé sans FdF HB et FdF AB :",
    );
  });

  test("la chasse est rentrée avant le 3e essai : relevé complet, rien à signaler", async () => {
    await essai();
    await essai();
    lire(`JEU.pages["/Ressources.php"] = ${JSON.stringify(ressources())}`);
    expect(await essai()).toBe("envoyé");
    const { donnees } = envois()[0];
    expect(donnees.cdf).toBe(1700);
    expect(Object.keys(donnees)).toEqual(expect.arrayContaining(["fdfHB", "fdfAB"]));
    expect(etat().incomplet).toBeUndefined();
    expect(lire(`SuiviMembres.probleme()`)).toBe("");
  });

  test("3e essai, page Armée illisible : échec, jamais d'envoi partiel (seules les troupes inconnues le permettent)", async () => {
    await essai();
    await essai();
    lire(`JEU.pages["/Armee.php"] = "<form>Connexion</form>"`);
    expect(await essai()).toBe("échec");
    expect(envois()).toEqual([]);
    expect(etat().raison).toContain("page Armée illisible");
  });

  test("3e essai, une autre information illisible : rien n'est envoyé, tout ou rien pour le reste", async () => {
    await essai();
    await essai();
    lire(`JEU.pages["/laboratoire.php"] = "<form>Connexion</form>"`);
    expect(await essai()).toBe("échec");
    expect(envois()).toEqual([]);
    expect(etat().raison).toBe("niveau introuvable : technique de ponte");
  });

  test("le lendemain, un relevé complet efface la mention", async () => {
    await essai();
    await essai();
    await essai();
    expect(etat().incomplet).toEqual(["cdf", "fdfHB", "fdfAB"]);
    lire(`(() => {
      heure = moment("2026-11-20 09:00", "YYYY-MM-DD HH:mm").valueOf();
      JEU.pages["/Ressources.php"] = ${JSON.stringify(ressources())};
    })()`);
    expect(await essai()).toBe("envoyé");
    expect(etat().incomplet).toBeUndefined();
    expect(lire(`SuiviMembres.probleme()`)).toBe("");
  });
});

describe("bloc « rentabilité de l'étable » sans Compte+ (mainteneur, 21/11/2026)", () => {
  // capture d'un joueur sans Compte+ : « Reine.php illisible … ouvrières en convoi non comptées »
  test("ouvrières présentes + celles des convois en cours ÷ ce que porte une ouvrière, avec la page Convois lue à l'ouverture", async () => {
    lire(
      `history.replaceState(null, "", "/construction.php"); DelaiRessources.pageConvois().catch(() => {})`,
    );
    const o = await lire(`Utils.ouvrieresTotales()`);
    expect(o).toEqual({ total: OUVRIERES, reine: false, convois: true });
    // une seule lecture de la page Convois pour les deux
    expect(lues().filter((c) => c == "/commerce.php")).toHaveLength(1);
    const texte = lire<string>(`Utils.htmlRentabiliteEtable(${JSON.stringify(o)})`).replace(
      /<[^>]+>/g,
      " ",
    );
    expect(texte).toContain("(sans Compte+ : présentes et parties en convoi)");
    expect(texte).not.toContain("non comptées");
  });

  test("niveau d'étable inconnu ou page Convois illisible : l'en-tête, avec la raison", async () => {
    lire(
      `monProfil.niveauConstruction = []; document.body.insertAdjacentHTML("beforeend", "<div id='nb_ouvrieres'>1 000</div>")`,
    );
    expect(await lire(`Utils.ouvrieresTotales()`)).toMatchObject({
      reine: false,
      raison: "niveau d'étable inconnu",
    });
    lire(
      `Utils._reine = null; Utils._pageReine = null; monProfil.niveauConstruction = Object.assign([], { 11: 2 }); JEU.pages["/commerce.php"] = "<form>Connexion</form>"`,
    );
    expect(await lire(`Utils.ouvrieresTotales()`)).toMatchObject({
      reine: false,
      raison: "page Convois illisible : la réponse n'est pas la page Convois",
    });
  });
});
