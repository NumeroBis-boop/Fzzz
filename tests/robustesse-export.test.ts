import { beforeEach, describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";
import { classeurSimule, feuille } from "./sheet-simule";

/**
 * Robustesse de l'export face aux « bêtises » : double clic, deux boutons à la
 * suite, page rechargée pendant un envoi (réponse perdue), rapports déjà
 * exportés depuis un autre appareil, même combat exporté par les deux camps,
 * panne au milieu d'un envoi. Le fichier est simulé avec le vrai script
 * (google-sheet/export-rapports.gs) : un doublon dans un onglet ferait échouer
 * ces tests.
 */
const page = creerPage(
  [
    "js/class/Utils.js",
    "js/class/ExportRapports.js",
    "js/page/MessagerieFzzz.js",
    "js/page/PartageChasses.js",
  ],
  `var Horloge = { serveur: () => moment("2026-10-29 10:00", "YYYY-MM-DD HH:mm"), maintenant: () => moment("2026-10-29 10:00", "YYYY-MM-DD HH:mm").valueOf() };
   var monProfil = { pseudo: "DoggyBag", parametre: {} };
   var TOAST_INFO = {}, TOAST_ERROR = {}, TOAST_SUCCESS = {}, TOAST_WARNING = {};`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);
const fenetre = page.window as any;
const URL_SCRIPT = "https://script.google.com/macros/s/AKfycbRobuste_1/exec";
// premier message du sujet « Export Google Sheet », écrit à la main dans le forum
const reglage = (adresse = URL_SCRIPT, joueurs = "Kwhwwymwn, Canaille, DoggyBag, Grim") =>
  `Adresse du script qui reçoit les rapports exportés par l'extension :\n${adresse}\n\nJoueurs autorisés à partager des RC :\n${joueurs}`;

// rapports inventés au format du jeu
const chasse = (n: number) =>
  `Troupes en attaque : ${n} 000 Jeunes Soldates Naines.<br/>Troupes en défense : ${n} Petites araignées.<br/><br/>Vous infligez 9 000 (+ 9 000) dégâts et tuez ${n} ennemies.<br/>L’ennemie inflige 30 (+ 0) dégâts à vos fourmis et en tue ${n}.<br/><br/>Vos chasseuses ont conquis 1 000 cm², les carcasses des prédateurs vous rapportent 500 de nourriture`;
const ARMEES = `Troupes en attaque : 20 000 Jeunes Soldates Naines.<br/>Troupes en défense : 5 000 Jeunes Soldates Naines.<br/>`;
const ATTAQUE = `Vous attaquez la fourmilière de Canaille<br/>${ARMEES}Vous infligez 9 (+ 9) dégâts et tuez 4 000 ennemies.<br/>La troupe ennemie inflige 9 (+ 9) dégâts à vos fourmis et en tue 900.<br/>Vous avez gagné cette bataille !`;
const DEFENSE = `DoggyBag attaque votre fourmilière<br/>${ARMEES}Vous infligez 9 (+ 9) dégâts et tuez 900 ennemies.<br/>La troupe ennemie inflige 9 (+ 9) dégâts à vos fourmis et en tue 4 000.`;
const message = (id: number, texte: string) =>
  `<tr id="message_${id}"><td class="expe">29/10/26 à 09h00</td><td class="message">${texte}</td></tr>`;
const entete = (id: number, titre: string) =>
  `<tr class="en_tete_message" id="conversation_${id}"><td class="td_participants">Fourmizzz</td><td class="td_objet"><span class="intitule_message">${titre}</span></td></tr>`;

let fichier: ReturnType<typeof classeurSimule>;
// mode du script : normal, réponse perdue (page rechargée), panne, panne au lot n
let mode: { perdue?: boolean; panne?: boolean; panneAuLot?: number } = {};
let lots = 0;
// adresses où le script a été appelé ; vérifications des clés déjà exportées
let urls: string[] = [];
let verifications = 0;

/** Messagerie listée, conversations servies par le « jeu », fichier vide. */
function messagerie(conversations: Record<number, { titre: string; html: string }>) {
  fichier = classeurSimule({});
  mode = {};
  lots = 0;
  urls = [];
  verifications = 0;
  fenetre.__envoyer = (m: any) => {
    urls.push(m.url);
    if (m.methode == "GET") return { ok: true, statut: 200, donnees: fichier.doGet() };
    if (mode.panne) return { erreur: "reseau" };
    const corps = JSON.parse(JSON.stringify(m.corps));
    // vérification des clés déjà exportées : pas un lot de lignes
    if (corps.verifier) {
      verifications++;
      return { ok: true, statut: 200, donnees: fichier.doPost(corps) };
    }
    lots++;
    if (lots === mode.panneAuLot) return { erreur: "reseau" };
    const r = fichier.doPost(corps);
    return mode.perdue ? { erreur: "reseau" } : { ok: true, statut: 200, donnees: r };
  };
  fenetre.__conversations = conversations;
  lire(`(() => {
    localStorage.clear();
    console.warn = () => {};
    window.TOASTS = []; window.LECTURES = []; window.ILLISIBLES = [];
    document.body.innerHTML = "<table>" + Object.entries(__conversations).map(([id, c]) => ${JSON.stringify(entete(0, "")).replace("conversation_0", 'conversation_" + id + "').replace('<span class=\\"intitule_message\\"></span>', '<span class=\\"intitule_message\\">" + c.titre + "</span>')}).join("") + "</table>";
    $.toast = (o) => { TOASTS.push(o.text); return {}; };
    $.post = (url, d) => {
      LECTURES.push(d.conversation);
      if (ILLISIBLES.includes(d.conversation)) return Promise.reject(new Error("jeu"));
      return Promise.resolve((__conversations[d.conversation] || { html: "" }).html);
    };
    window.GARDE = {};
    window.chrome = {
      storage: { local: {
        get: (k) => Promise.resolve(k in GARDE ? { [k]: GARDE[k] } : {}),
        set: (o) => { Object.assign(GARDE, o); return Promise.resolve(); },
        remove: (k) => { delete GARDE[k]; return Promise.resolve(); },
      } },
      runtime: { sendMessage: (m) => Promise.resolve(__envoyer(m)) },
    };
  })()`);
  forum([{ id: "1", titre: "Export Google Sheet", messages: [reglage()] }]);
}

/** Forum caché simulé : sujets {id, titre, messages}, appels xajax notés. */
function forum(sujets: { id: string; titre: string; messages: string[] }[]) {
  fenetre.__sujets = sujets;
  lire(`(() => {
    window.FORUM = { sujets: __sujets, appels: [], prochain: 500, echoue: null };
    PartageChasses.idSection = "7";
    PartageChasses._html = (d) => d;
    PartageChasses.oublierCache();
    const q = (args, k) => { const m = new RegExp("[&>]" + k + "=([^&<]*)").exec(args); return m ? decodeURIComponent(m[1]) : null; };
    PartageChasses._xajax = (f, args) => {
      FORUM.appels.push(f + (f.startsWith("envoi") ? " " + q(args, "sujet") : ""));
      if (FORUM.echoue && FORUM.echoue(f, args)) return Promise.reject(new Error("forum"));
      if (f == "callGetForum")
        return Promise.resolve('<form id="form_cat"><table>' + FORUM.sujets.map((s) => '<tr><td><input name="topic[]" value="' + s.id + '"/></td><td>' + s.titre + '</td></tr>').join("") + '</table></form>');
      if (f == "callGetTopic") {
        const s = FORUM.sujets.find((s) => s.id == args);
        return Promise.resolve(s ? s.messages.map((m) => '<div class="messageForum">' + m.replace(/\\n/g, "<br/>") + "</div>").join("") : "");
      }
      if (f == "envoiNouveauSujet") {
        FORUM.sujets.push({ id: String(FORUM.prochain++), titre: q(args, "sujet"), messages: [q(args, "message")] });
        return Promise.resolve("");
      }
      if (f == "envoiEditTopic") {
        const s = FORUM.sujets.find((s) => s.id == q(args, "IDTopic"));
        s.titre = q(args, "sujet");
        s.messages[0] = q(args, "message");
        return Promise.resolve("");
      }
      return Promise.resolve("");
    };
  })()`);
}
const exporter = (type: string) => lire<Promise<void>>(`ExportRapports.exporter("${type}")`);
const dernierMessage = () => lire<string[]>(`TOASTS`).at(-1) || "";
const sansDoublon = (cles: string[]) => expect(new Set(cles).size).toBe(cles.length);

const CHASSES = {
  11: {
    titre: "Vos chasseuses ont conquis 3 000 cm² en 3 expéditions",
    html: message(101, chasse(1)) + message(102, chasse(2)) + message(103, chasse(3)),
  },
  12: {
    titre: "Chasse réussie : vos chasseuses ont conquis 1 000 cm² en 1 expédition",
    html: message(104, chasse(4)),
  },
};

describe("export : date des rapports", () => {
  test("RC exportés sans date par une version d'avant : retirés, puis renvoyés datés au clic suivant, sans doublon", async () => {
    messagerie(CHASSES);
    // état laissé par une version d'avant : quatre lignes sans date, leurs clés gardées
    const entetes = lire<string[]>(`EXPORTS_RAPPORTS.chasse.entetes`);
    const sansDate = (k: string) =>
      entetes.map((t) => (t == "Clé" ? k : t == "Exporté par" ? "DoggyBag" : t == "Date" ? "" : 1));
    fichier.onglets["BDD chasse"] = feuille("BDD chasse", [
      entetes,
      ...["|a1", "|a2", "|a3", "|a4"].map(sansDate),
    ]);
    lire(
      `localStorage.setItem(ExportRapports._cleMemoire("chasse"), ${JSON.stringify(JSON.stringify({ 11: ["|a1", "|a2", "|a3"], 12: ["|a4"] }))})`,
    );
    await exporter("chasse");
    expect(lire(`LECTURES`)).toEqual([11, 12]);
    const cles = fichier.cles("BDD chasse");
    expect(cles).toHaveLength(4);
    expect(cles.every((c) => c.startsWith("2026-10-29 09:00|"))).toBe(true);
    sansDoublon(cles);
    // clic suivant : tout est là, rien à relire
    lire(`LECTURES.length = 0`);
    await exporter("chasse");
    expect(lire(`LECTURES`)).toEqual([]);
  });

  test("date illisible : rapport pas envoyé, le message cite l'en-tête lu ; sa conversation relue au clic suivant", async () => {
    messagerie({
      ...CHASSES,
      13: {
        titre: "Chasse réussie : vos chasseuses ont conquis 1 000 cm² en 1 expédition",
        html: `<tr id="message_105"><td class="expe">Fourmizzz il y a 3 heures</td><td class="message">${chasse(5)}</td></tr>`,
      },
    });
    await exporter("chasse");
    expect(fichier.cles("BDD chasse")).toHaveLength(4);
    expect(dernierMessage()).toContain("1 rapport sans date lisible, pas exporté");
    expect(dernierMessage()).toContain("« Fourmizzz il y a 3 heures »");
    lire(`LECTURES.length = 0`);
    await exporter("chasse");
    expect(lire(`LECTURES`)).toEqual([13]);
    expect(fichier.cles("BDD chasse")).toHaveLength(4);
  });
});

describe("export : clics répétés et pages rechargées", () => {
  beforeEach(() => messagerie(CHASSES));

  test("double clic : un seul export, chaque conversation lue une fois, aucun doublon", async () => {
    await Promise.all([exporter("chasse"), exporter("chasse")]);
    expect(lire(`LECTURES`)).toEqual([11, 12]);
    expect(lire<string[]>(`TOASTS`)).toContain("Un export est déjà en cours, patiente un instant.");
    expect(fichier.cles("BDD chasse")).toHaveLength(4);
    sansDoublon(fichier.cles("BDD chasse"));
  });

  test("« Exporter mes chasses » puis « Exporter mes RC » aussitôt : le second attend, rien ne se mélange", async () => {
    await Promise.all([exporter("chasse"), exporter("combat")]);
    expect(lire<string[]>(`TOASTS`)).toContain("Un export est déjà en cours, patiente un instant.");
    expect(Object.keys(fichier.onglets)).toEqual(["BDD chasse"]);
  });

  test("page rechargée pendant l'envoi (réponse perdue) : le clic suivant n'ajoute aucun doublon", async () => {
    mode = { perdue: true };
    await exporter("chasse");
    expect(dernierMessage()).toContain("ne répond pas");
    expect(fichier.cles("BDD chasse")).toHaveLength(4);
    mode = {};
    await exporter("chasse");
    expect(dernierMessage()).toContain("0 ligne ajoutée dans « BDD chasse » (4 déjà présentes)");
    expect(fichier.cles("BDD chasse")).toHaveLength(4);
  });

  test("rapports déjà exportés depuis un autre appareil (mémoire vide) : tout est « déjà présent »", async () => {
    await exporter("chasse");
    lire(`localStorage.clear()`);
    await exporter("chasse");
    expect(dernierMessage()).toContain("(4 déjà présentes)");
    expect(fichier.cles("BDD chasse")).toHaveLength(4);
  });

  test("troisième clic sans rien de nouveau : aucune lecture, aucun envoi", async () => {
    await exporter("chasse");
    lire(`LECTURES.length = 0`);
    const avant = lots;
    await exporter("chasse");
    await exporter("chasse");
    expect(lire(`LECTURES`)).toEqual([]);
    expect(lots).toBe(avant);
    expect(verifications).toBe(2);
    expect(dernierMessage()).toContain("Aucun nouveau rapport de chasse");
  });

  test("onglet vidé à la main : le clic suivant renvoie tout, le suivant plus rien", async () => {
    await exporter("chasse");
    fichier.onglets["BDD chasse"].grille.length = 1;
    lire(`LECTURES.length = 0`);
    await exporter("chasse");
    expect(lire(`LECTURES`)).toEqual([11, 12]);
    expect(fichier.cles("BDD chasse")).toHaveLength(4);
    lire(`LECTURES.length = 0`);
    await exporter("chasse");
    expect(lire(`LECTURES`)).toEqual([]);
    sansDoublon(fichier.cles("BDD chasse"));
  });

  test("une ligne effacée à la main : seule sa conversation est relue, la ligne revient", async () => {
    await exporter("chasse");
    const grille = fichier.onglets["BDD chasse"].grille,
      effacee = grille.splice(grille.length - 1, 1)[0][0];
    lire(`LECTURES.length = 0`);
    await exporter("chasse");
    expect(lire(`LECTURES`)).toEqual([12]);
    expect(fichier.cles("BDD chasse")).toContain(effacee);
    expect(fichier.cles("BDD chasse")).toHaveLength(4);
  });

  test("conversation illisible : signalée, les autres exportées, elle seule relue au clic suivant", async () => {
    lire(`ILLISIBLES.push(12)`);
    await exporter("chasse");
    expect(dernierMessage()).toContain("1 conversation(s) n'ont pas pu être lues");
    expect(fichier.cles("BDD chasse")).toHaveLength(3);
    lire(`ILLISIBLES.length = 0; LECTURES.length = 0`);
    await exporter("chasse");
    expect(lire(`LECTURES`)).toEqual([12]);
    expect(fichier.cles("BDD chasse")).toHaveLength(4);
  });

  test("panne du script au deuxième lot de 200 : rien de perdu ni de doublé au nouvel essai", async () => {
    const grosse: Record<number, { titre: string; html: string }> = {};
    for (let c = 0; c < 250; c++)
      grosse[1000 + c] = {
        titre: "Chasse réussie : vos chasseuses ont conquis 1 000 cm² en 1 expédition",
        html: message(5000 + c, chasse(10 + c)),
      };
    messagerie(grosse);
    mode = { panneAuLot: 2 };
    await exporter("chasse");
    expect(dernierMessage()).toContain("ne répond pas");
    expect(fichier.cles("BDD chasse")).toHaveLength(200);
    mode = {};
    await exporter("chasse");
    expect(fichier.cles("BDD chasse")).toHaveLength(250);
    sansDoublon(fichier.cles("BDD chasse"));
    expect(dernierMessage()).toContain(
      "50 lignes ajoutées dans « BDD chasse » (200 déjà présentes)",
    );
  });
});

describe("export : RC des deux camps et joueurs hors liste", () => {
  test("même combat exporté par l'attaquant puis par le défenseur, deux fois : une ligne par onglet", async () => {
    messagerie({ 21: { titre: "Attaque réussie", html: message(201, ATTAQUE) } });
    const commun = fichier;
    await exporter("combat");
    // le défenseur (autre joueur de la liste), sur son appareil, exporte deux fois
    lire(`monProfil.pseudo = "Canaille"`);
    messagerie({ 31: { titre: "Invasion de DoggyBag", html: message(301, DEFENSE) } });
    fichier = commun;
    await exporter("combat");
    lire(`localStorage.clear()`);
    await exporter("combat");
    lire(`monProfil.pseudo = "DoggyBag"`);
    expect(fichier.cles("BDD attaques")).toHaveLength(1);
    expect(fichier.cles("BDD défenses")).toHaveLength(1);
    expect(fichier.cles("BDD attaques")[0]).toBe(fichier.cles("BDD défenses")[0]);
  });

  // alliance OUAF dans la page, membres d'après l'export public des joueurs (simulé)
  const allianceOuaf = () =>
    lire(`document.body.insertAdjacentHTML("beforeend", '<div id="tag_alliance">OUAF</div>');
      window.ExportJoueurs = { lire: () => Promise.resolve(new Map([["DoggyBag", { alliance: "OUAF" }], ["Canaille", { alliance: "OUAF" }], ["Grim", { alliance: "OUAF" }]])) };`);

  test("flood interne exporté par les deux camps, deux fois chacun : une seule ligne, dans « Flood internes »", async () => {
    messagerie({ 21: { titre: "Attaque réussie", html: message(201, ATTAQUE) } });
    allianceOuaf();
    const commun = fichier;
    await exporter("combat");
    lire(`localStorage.clear()`);
    await exporter("combat");
    lire(`monProfil.pseudo = "Canaille"`);
    messagerie({ 31: { titre: "Invasion de DoggyBag", html: message(301, DEFENSE) } });
    allianceOuaf();
    fichier = commun;
    await exporter("combat");
    lire(`localStorage.clear()`);
    await exporter("combat");
    lire(`monProfil.pseudo = "DoggyBag"`);
    expect(fichier.cles("Flood internes")).toHaveLength(1);
    expect(fichier.cles("BDD attaques")).toEqual([]);
    expect(fichier.cles("BDD défenses")).toEqual([]);
    expect(dernierMessage()).toContain("0 ligne ajoutée dans « Flood internes » (1 déjà présente)");
  });

  test("RC internes déjà rangés dans les onglets des camps : déplacés dans « Flood internes » au clic suivant", async () => {
    messagerie({
      21: { titre: "Attaque réussie", html: message(201, ATTAQUE) },
      22: {
        titre: "Butin chez Canaille : 1 000 cm²",
        html: message(221, "Vos fourmis ont conquis 1 000 cm² qui appartenaient à Canaille."),
      },
    });
    // rangés sans alliance connue (version précédente)
    await exporter("combat");
    expect(fichier.cles("BDD attaques")).toHaveLength(2);
    // mémoire de la version précédente (numéros seuls) : conversations relues une fois
    lire(`(() => {
      const k = Object.keys(localStorage).find((k) => k.startsWith("fzzz_exportCles_combat_"));
      localStorage.setItem(k.replace("fzzz_exportCles_combat_", "fzzz_exportees_combat2_"), JSON.stringify(Object.keys(JSON.parse(localStorage.getItem(k))).map(Number)));
      localStorage.removeItem(k);
    })()`);
    allianceOuaf();
    await exporter("combat");
    expect(fichier.cles("BDD attaques")).toEqual([]);
    expect(fichier.cles("Flood internes")).toHaveLength(2);
    sansDoublon(fichier.cles("Flood internes"));
  });

  test("joueur hors liste : jamais l'adresse du forum, seulement la sienne", async () => {
    const PERSO = "https://script.google.com/macros/s/AKfyPerso_2/exec";
    messagerie(CHASSES);
    lire(`monProfil.pseudo = "Inconnu"`);
    await exporter("chasse");
    expect(dernierMessage()).toContain("ton pseudo n'est pas dans la liste des joueurs autorisés");
    expect(lire(`LECTURES`)).toEqual([]);
    await lire(`ExportRapports.enregistrerAdresse("${PERSO}")`);
    await exporter("chasse");
    expect(fichier.cles("BDD chasse")).toHaveLength(4);
    expect(new Set(urls)).toEqual(new Set([PERSO]));
    // rien d'écrit dans le forum, rien gardé de l'adresse de l'alliance
    expect(lire<string[]>(`FORUM.appels`).filter((a) => a.startsWith("envoi"))).toEqual([]);
    expect(lire(`"fzzz_exportSheetAlliance" in GARDE`)).toBe(false);
    lire(`monProfil.pseudo = "DoggyBag"`);
  });

  test("liste modifiée dans le forum : prise en compte au clic suivant, sans nouvelle version", async () => {
    messagerie(CHASSES);
    const message = (joueurs: string) =>
      lire(`FORUM.sujets[0].messages[0] = ${JSON.stringify(reglage(URL_SCRIPT, joueurs))};`);
    // retiré de la liste : plus d'export vers le fichier de l'alliance
    message("Kwhwwymwn, Canaille");
    await exporter("chasse");
    expect(dernierMessage()).toContain("ton pseudo n'est pas dans la liste");
    expect(lots).toBe(0);
    // ajouté (casse différente, sur la ligne du titre) : export sans rien régler
    lire(
      `FORUM.sujets[0].messages[0] = ${JSON.stringify(`${URL_SCRIPT}\nJoueurs autorisés : Kwhwwymwn DOGGYBAG`)};`,
    );
    await exporter("chasse");
    expect(fichier.cles("BDD chasse")).toHaveLength(4);
    expect(new Set(urls)).toEqual(new Set([URL_SCRIPT]));
  });

  test("forum injoignable au clic : la dernière lecture faite pour ce joueur sert", async () => {
    messagerie(CHASSES);
    await exporter("chasse");
    lire(`localStorage.clear(); FORUM.echoue = () => true;`);
    await exporter("chasse");
    expect(dernierMessage()).toContain("(4 déjà présentes)");
    // un autre pseudo sur ce navigateur ne profite pas de cette lecture
    lire(`localStorage.clear(); monProfil.pseudo = "Grim";`);
    await exporter("chasse");
    expect(dernierMessage()).toContain("le forum de l'alliance n'a pas pu être lu");
    lire(`monProfil.pseudo = "DoggyBag"; FORUM.echoue = null;`);
  });

  test("sujet « Export Google Sheet » créé deux fois : le plus ancien fait foi", async () => {
    messagerie(CHASSES);
    forum([
      {
        id: "9",
        titre: "Export Google Sheet",
        messages: [reglage("https://script.google.com/macros/s/AKfyRecent/exec", "Inconnu")],
      },
      { id: "4", titre: "Export Google Sheet", messages: [reglage()] },
    ]);
    expect(await lire(`ExportRapports.cible()`)).toEqual({ url: URL_SCRIPT, alliance: true });
  });
});
