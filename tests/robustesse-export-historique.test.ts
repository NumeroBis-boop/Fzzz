import { beforeEach, describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";
import { classeurSimule } from "./sheet-simule";

/**
 * Robustesse face aux « bêtises » : double clic, deux boutons à la suite, page
 * rechargée pendant un envoi (réponse perdue), rapports déjà exportés depuis un
 * autre appareil, même combat exporté par les deux camps, panne au milieu d'un
 * envoi, deux onglets qui écrivent l'historique au même instant. Le fichier est
 * simulé avec le vrai script (google-sheet/export-rapports.gs) : un doublon
 * dans un onglet ferait échouer ces tests.
 */
const page = creerPage(
  [
    "js/class/Utils.js",
    "js/class/ExportRapports.js",
    "js/page/MessagerieFzzz.js",
    "js/page/PartageChasses.js",
    "js/page/ConvoisForum.js",
  ],
  `var Horloge = { serveur: () => moment("2026-10-29 10:00", "YYYY-MM-DD HH:mm"), maintenant: () => moment("2026-10-29 10:00", "YYYY-MM-DD HH:mm").valueOf() };
   var monProfil = { pseudo: "DoggyBag", parametre: {} };
   var TOAST_INFO = {}, TOAST_ERROR = {}, TOAST_SUCCESS = {};
   var OUAF_ECART_ARRIVEE = 120000;
   var AttaqueLancee = { majPartages() {} };`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);
const fenetre = page.window as any;
const URL_SCRIPT = "https://script.google.com/macros/s/AKfycbRobuste_1/exec";

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

/** Messagerie listée, conversations servies par le « jeu », fichier vide. */
function messagerie(conversations: Record<number, { titre: string; html: string }>) {
  fichier = classeurSimule({});
  mode = {};
  lots = 0;
  fenetre.__envoyer = (m: any) => {
    if (m.methode == "GET") return { ok: true, statut: 200, donnees: fichier.doGet() };
    lots++;
    if (mode.panne || lots === mode.panneAuLot) return { erreur: "reseau" };
    const r = fichier.doPost(JSON.parse(JSON.stringify(m.corps)));
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
  forum([{ id: "1", titre: "Export Google Sheet", messages: [URL_SCRIPT] }]);
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
    expect(dernierMessage()).toContain("Aucun nouveau rapport de chasse");
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

  test("joueur hors liste : jamais l'adresse du forum, seulement la sienne", async () => {
    messagerie(CHASSES);
    lire(`monProfil.pseudo = "Inconnu"; FORUM.appels.length = 0;`);
    await exporter("chasse");
    expect(dernierMessage()).toContain("renseigne d'abord l'adresse du script de ton Google Sheet");
    expect(lire(`FORUM.appels`)).toEqual([]);
    expect(lire(`LECTURES`)).toEqual([]);
    await lire(`ExportRapports.enregistrerAdresse("${URL_SCRIPT}")`);
    expect(lire(`FORUM.appels`)).toEqual([]);
    await exporter("chasse");
    expect(fichier.cles("BDD chasse")).toHaveLength(4);
    lire(`monProfil.pseudo = "DoggyBag"`);
  });

  test("liste des joueurs : casse ignorée, pseudo partiel refusé", () => {
    expect(lire(`ExportRapports.alliance("doggybag")`)).toBe(true);
    expect(lire(`ExportRapports.alliance("DOGGYBAG")`)).toBe(true);
    expect(lire(`ExportRapports.alliance("Doggy")`)).toBe(false);
    expect(lire(`ExportRapports.alliance("")`)).toBe(false);
    expect(lire<number>(`JOUEURS_EXPORT_ALLIANCE.length`)).toBe(32);
  });

  test("sujet « Export Google Sheet » créé deux fois : le plus ancien fait foi", async () => {
    messagerie(CHASSES);
    forum([
      {
        id: "9",
        titre: "Export Google Sheet",
        messages: ["https://script.google.com/macros/s/AKfyRecent/exec"],
      },
      { id: "4", titre: "Export Google Sheet", messages: [URL_SCRIPT] },
    ]);
    expect(await lire<Promise<string>>(`ExportRapports.adresse()`)).toBe(URL_SCRIPT);
  });
});

describe("historique du forum : clics répétés, pages rechargées, deux onglets", () => {
  const PASSE = "29/10/26 09:00 | 10 000 cm²";
  const message1 = (titre: string) =>
    lire<string | null>(
      `(FORUM.sujets.find((s) => s.titre == ${JSON.stringify(titre)}) || { messages: [null] }).messages[0]`,
    );
  const sujetsDe = (titre: string) =>
    lire<number>(`FORUM.sujets.filter((s) => s.titre == ${JSON.stringify(titre)}).length`);
  const groupe = `[{ impact: moment("2026-10-29 12:00", "YYYY-MM-DD HH:mm"), terrain: 20000 }]`;

  beforeEach(() => {
    lire(
      `localStorage.clear(); window.TOASTS = []; $.toast = (o) => { TOASTS.push(o.text); return {}; }; monProfil.pseudo = "DoggyBag";`,
    );
    forum([{ id: "1", titre: "Chasses | DoggyBag", messages: [PASSE] }]);
  });

  test("partage des chasses en double (double clic, page rechargée) : historique sans doublon", async () => {
    await Promise.all([
      lire(`PartageChasses.partager(${groupe}, null)`),
      lire(`PartageChasses.partager(${groupe}, null)`),
    ]);
    expect(sujetsDe("Historique Chasses 1 | DoggyBag")).toBe(1);
    expect(message1("Historique Chasses 1 | DoggyBag")).toBe(PASSE);
    expect(message1("Chasses | DoggyBag")).toBe("29/10/26 12:00 | 20 000 cm²");
    expect(lire<string[]>(`TOASTS`).at(-1)).toContain("déjà partagées");
  });

  test("sujet de suivi non réécrit après l'historique (page fermée) : au nouvel essai, pas de doublon", async () => {
    lire(
      `FORUM.echoue = (f, args) => f == "envoiEditTopic" && decodeURIComponent(args).includes("sujet=Chasses | DoggyBag");`,
    );
    await lire(`PartageChasses.partager(${groupe}, null)`);
    expect(message1("Historique Chasses 1 | DoggyBag")).toBe(PASSE);
    expect(message1("Chasses | DoggyBag")).toBe(PASSE);
    lire(`FORUM.echoue = null;`);
    await lire(`PartageChasses.partager(${groupe}, null)`);
    expect(message1("Historique Chasses 1 | DoggyBag")).toBe(PASSE);
    expect(message1("Chasses | DoggyBag")).toBe("29/10/26 12:00 | 20 000 cm²");
  });

  test("page d'historique créée deux fois (deux onglets) : suite dans la plus ancienne, sans répéter de ligne", async () => {
    const DEJA = "28/10/26 08:00 | 5 000 cm²";
    forum([
      { id: "1", titre: "Chasses | DoggyBag", messages: [`${PASSE}\n28/10/26 08:00 | 5 000 cm²`] },
      { id: "3", titre: "Historique Chasses 1 | DoggyBag", messages: [DEJA] },
      {
        id: "2",
        titre: "Historique Chasses 1 | DoggyBag",
        messages: ["27/10/26 07:00 | 1 000 cm²"],
      },
    ]);
    await lire(`PartageChasses.partager(${groupe}, null)`);
    expect(lire(`FORUM.sujets.find((s) => s.id == "2").messages[0]`)).toBe(
      `27/10/26 07:00 | 1 000 cm²\n${PASSE}`,
    );
    expect(lire(`FORUM.sujets.find((s) => s.id == "3").messages[0]`)).toBe(DEJA);
  });

  test("convois notés deux fois de suite (double clic) : chaque convoi arrivé une seule fois dans l'historique", async () => {
    forum([
      {
        id: "1",
        titre: "Convois | DoggyBag",
        messages: ["29/10/26 09:00 | Canaille | 1 000 | #5"],
      },
    ]);
    const convoi = `[{ id: 7, vers: "Canaille", montant: 3000, arrivee: moment("2026-10-29 15:00", "YYYY-MM-DD HH:mm").valueOf() }]`;
    await Promise.all([
      lire(`ConvoisForum.noter(${convoi})`),
      lire(`ConvoisForum.noter(${convoi})`),
    ]);
    expect(message1("Historique Convois 1 | DoggyBag")).toBe(
      "29/10/26 09:00 | Canaille | 1 000 | #5",
    );
    expect(sujetsDe("Historique Convois 1 | DoggyBag")).toBe(1);
    expect(message1("Convois | DoggyBag")).toBe("29/10/26 15:00 | Canaille | 3 000 | #7");
  });
});
