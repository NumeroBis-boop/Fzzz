import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { creerPage } from "./harnais";
import { classeurSimule } from "./sheet-simule";

/**
 * Export automatique des chasses (demandes du mainteneur) : après un clic sur
 * « Envoyer » ou « Envoyer + partager » du lanceur de chasses alors qu'un
 * export est dû (après le mercredi et le dimanche 22h, donc deux fois par
 * semaine au plus), les rapports de chasse de la messagerie pas encore dans le
 * fichier sont lus et envoyés, en requêtes de la priorité la plus faible, pour
 * le rôle Chasseur ; le bouton reste. Le jeu et le forum sont simulés, le
 * fichier l'est avec le vrai script (google-sheet/export-rapports.gs).
 * Rapports inventés.
 */
const page = creerPage(
  [
    "js/lib/jquery-ui_1.12.1.js",
    "js/class/Utils.js",
    "js/class/Parametre.js",
    "js/class/Joueur.js",
    "js/class/ExportRapports.js",
    "js/class/RappelExport.js",
    "js/class/SuiviMembres.js",
    "js/class/ExportAuto.js",
    "js/page/MessagerieFzzz.js",
    "js/page/PartageChasses.js",
  ],
  `var METHODE_FLOOD = ["Standard", "Optimisée", "Uniforme", "Dégressive"],
     AFFECTATION_RESSOURCE = [], RATIO_RECOLTE = {};
   var NOM_UNITE = ["Ouvrière", "Jeune Soldate Naine"], NOM_UNITES = ["Ouvrières", "Jeunes Soldates Naines"];
   var TOAST_INFO = { icon: "info" }, TOAST_ERROR = { icon: "error" }, TOAST_SUCCESS = { icon: "success" }, TOAST_WARNING = { icon: "warning" };
   var heure = 0;
   var Horloge = { maintenant: () => heure, serveur: () => moment(heure) };`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);
const fenetre = page.window as any;
const URL_SCRIPT = "https://script.google.com/macros/s/AKfycbAuto_1/exec";
const reglage = (adresse = URL_SCRIPT, joueurs = "Canaille, DoggyBag, Grim") =>
  `Adresse du script qui reçoit les rapports exportés par l'extension :\n${adresse}\n\nJoueurs autorisés à partager des RC :\n${joueurs}`;

const chasse = (n: number) =>
  `Troupes en attaque : ${n} 000 Jeunes Soldates Naines.<br/>Troupes en défense : ${n} Petites araignées.<br/><br/>Vous infligez 9 000 (+ 9 000) dégâts et tuez ${n} ennemies.<br/>L’ennemie inflige 30 (+ 0) dégâts à vos fourmis et en tue ${n}.<br/><br/>Vos chasseuses ont conquis 1 000 cm², les carcasses des prédateurs vous rapportent 500 de nourriture`;
const ATTAQUE = `Vous attaquez la fourmilière de Canaille<br/>Troupes en attaque : 20 000 Jeunes Soldates Naines.<br/>Troupes en défense : 5 000 Jeunes Soldates Naines.<br/>Vous infligez 9 (+ 9) dégâts et tuez 4 000 ennemies.<br/>La troupe ennemie inflige 9 (+ 9) dégâts à vos fourmis et en tue 900.<br/>Vous avez gagné cette bataille !`;
const message = (id: number, texte: string, date = "11/11/26 à 21h00") =>
  `<tr id="message_${id}"><td class="expe">${date}</td><td class="message">${texte}</td></tr>`;

type Conversation = { titre: string; html: string; nonLue?: boolean };
const CHASSES: Record<number, Conversation> = {
  11: {
    titre: "Vos chasseuses ont conquis 3 000 cm² en 3 expéditions",
    html: message(101, chasse(1)) + message(102, chasse(2)) + message(103, chasse(3)),
  },
  12: {
    titre: "Chasse réussie : vos chasseuses ont conquis 1 000 cm² en 1 expédition",
    html: message(104, chasse(4)),
    nonLue: true,
  },
  // un combat : pas une chasse, jamais lu par l'export des chasses
  13: { titre: "Butin chez Canaille", html: message(105, ATTAQUE) },
};
// n conversations d'une chasse chacune, numérotées à partir de 201
const beaucoup = (n: number, nonLue = false) =>
  Object.fromEntries(
    Array.from({ length: n }, (_, k) => [
      201 + k,
      {
        titre: `Chasse réussie : vos chasseuses ont conquis ${k + 1} cm²`,
        html: message(900 + k, chasse(10 + k)),
        nonLue,
      },
    ]),
  ) as Record<number, Conversation>;

let fichier: ReturnType<typeof classeurSimule>;

// jeudi 12/11/2026, lendemain du rendez-vous du mercredi 22h
const JEUDI = "2026-11-12 08:00";
const regler = (quand: string) =>
  lire(`heure = moment(${JSON.stringify(quand)}, "YYYY-MM-DD HH:mm").valueOf()`);

/**
 * Compte, jeu, forum et fichier simulés. JEU.conversations : la messagerie du
 * joueur ; demander une conversation la marque lue, comme le fait le jeu.
 * Sauf `chasse: false`, le joueur vient de lancer une chasse (jeudi 8h).
 */
function preparer(
  conversations: Record<number, Conversation> = CHASSES,
  { role = 3, annonce = true, chasse = true } = {},
) {
  fichier = classeurSimule({});
  fenetre.__envoyer = (m: any) => {
    const jeu = lire<any>(`JEU`);
    jeu.fichier.push(m.corps && m.corps.verifier ? "verifier" : m.corps ? m.corps.onglet : "GET");
    if (jeu.panneFichier && jeu.panneFichier(m)) return { erreur: "reseau" };
    if (m.methode == "GET") return { ok: true, statut: 200, donnees: fichier.doGet() };
    return {
      ok: true,
      statut: 200,
      donnees: fichier.doPost(JSON.parse(JSON.stringify(m.corps))),
    };
  };
  fenetre.__conversations = JSON.parse(JSON.stringify(conversations));
  lire(`(() => {
    localStorage.clear();
    localStorage.setItem("fzzz_reserveEnPlus", "1");
    localStorage.setItem("fzzz_methodeDegressive", "1");
    console.warn = () => {};
    window.monProfil = new Joueur({ pseudo: "DoggyBag" }).getParametre();
    monProfil.parametre.role.valeur = ${role};
    window.TOASTS = [];
    window.SANS_ALLIANCE = false;
    $.toast = (o) => { TOASTS.push(o); return {}; };
    window.NOTES = [];
    Journal.noter = (niveau, source, message) => { NOTES.push(niveau + " : " + message); };
    window.JEU = {
      conversations: __conversations,
      // requêtes au jeu, dans l'ordre : page de la messagerie, conversations lues, marquages
      requetes: [], lues: [], marquages: [],
      // celles qui ne sont pas de fond (Requetes.js : priorité la plus faible)
      normales: [],
      illisibles: [], session: true, marquageRefuse: false, enAttente: null,
      fichier: [], panneFichier: null,
    };
    window.listeMessagerie = () =>
      '<div id="liste_conversations"><table id="table_liste_conversations">' +
      Object.entries(JEU.conversations).map(([id, c]) =>
        '<tr id="conversation_' + id + '" class="en_tete_message"><td class="td_participants"><a>Fourmizzz</a></td><td class="td_objet"><span>21:00</span> <a class="intitule_message">' + c.titre + "</a>" + (c.nonLue ? '<span class="nbr_mess_non_lus_conv"></span>' : "") + "</td></tr>").join("") +
      "</table></div>";
    const lireJeu = (url, fond) => {
      JEU.requetes.push("GET " + url.replace(location.origin, ""));
      if (!fond) JEU.normales.push(JEU.requetes.at(-1));
      return Promise.resolve(JEU.session ? "<html><body><div id='centre'>" + listeMessagerie() + "</div></body></html>" : "<html><body><form id='loginForm'></form></body></html>");
    };
    const posterJeu = (url, d, fond) => {
      if (!fond) JEU.normales.push(d.traitement == "lecture" ? "lecture" : "conversation " + d.conversation);
      if (d.traitement == "lecture") {
        JEU.requetes.push("lecture");
        JEU.marquages.push({ ids: d.id_conversations.slice(), est_lu: d.est_lu });
        if (JEU.marquageRefuse) return Promise.resolve("<div class='action_invalide'></div>");
        d.id_conversations.forEach((id) => (JEU.conversations[id].nonLue = d.est_lu == 0));
        return Promise.resolve("<div class='action_valide'></div>");
      }
      JEU.requetes.push("conversation " + d.conversation);
      JEU.lues.push(d.conversation);
      // page quittée pendant cette lecture : la réponse n'arrive jamais
      if (JEU.enAttente == d.conversation) return new Promise(() => {});
      if (JEU.illisibles.includes(d.conversation)) return Promise.reject(new Error("jeu"));
      JEU.conversations[d.conversation].nonLue = false;
      return Promise.resolve(JEU.conversations[d.conversation].html);
    };
    $.get = (url) => lireJeu(url, false);
    $.post = (url, d) => posterJeu(url, d, false);
    $.ajax = (o) => (String(o.type).toLowerCase() == "post" ? posterJeu(o.url, o.data, !!o.fond) : lireJeu(o.url, !!o.fond));
    window.GARDE = {};
    window.chrome = {
      storage: { local: {
        get: (k) => Promise.resolve(k in GARDE ? { [k]: GARDE[k] } : {}),
        set: (o) => { Object.assign(GARDE, o); return Promise.resolve(); },
        remove: (k) => { delete GARDE[k]; return Promise.resolve(); },
      } },
      runtime: { sendMessage: (m) => Promise.resolve(__envoyer(m)) },
    };
    ExportRapports.enCours = false;
    ${annonce ? `localStorage.setItem("fzzz_exportAuto", JSON.stringify({ doggybag: { annonce: true } }));` : ""}
  })()`);
  forum([{ id: "1", titre: "Export Google Sheet", messages: [reglage()] }]);
  if (chasse) lancerChasse();
}
/** Clic sur « Envoyer » ou « Envoyer + partager » du lanceur de chasses (LanceurChasse). */
function lancerChasse(quand = JEUDI) {
  regler(quand);
  lire(`ExportAuto.noterChasse()`);
}

/** Forum caché simulé : sujets {id, titre, messages}, appels xajax notés. */
function forum(sujets: { id: string; titre: string; messages: string[] }[]) {
  fenetre.__sujets = sujets;
  lire(`(() => {
    window.FORUM = { sujets: __sujets, appels: [], normaux: [], echoue: false };
    PartageChasses.idSection = "7";
    PartageChasses._html = (d) => d;
    PartageChasses.oublierCache();
    PartageChasses._xajax = (f, args, options) => {
      FORUM.appels.push(f);
      if (!(options && options.fond)) FORUM.normaux.push(f);
      if (FORUM.echoue) return Promise.reject(new Error("forum"));
      // liste des sections (section cachée pas encore connue), puis sujets de la section
      if (f == "callGetForum" && args === undefined)
        return Promise.resolve('<div id="cat_forum"><span class="forum7">BDD partagée cachée</span></div>');
      if (f == "callGetForum")
        return Promise.resolve('<form id="form_cat"><table>' + FORUM.sujets.map((s) => '<tr><td><input name="topic[]" value="' + s.id + '"/></td><td>' + s.titre + '</td></tr>').join("") + '</table></form>');
      const s = FORUM.sujets.find((s) => s.id == args);
      return Promise.resolve(s ? s.messages.map((m) => '<div class="messageForum">' + m.replace(/\\n/g, "<br/>") + "</div>").join("") : "");
    };
  })()`);
}

/** Le joueur ouvre une page : comme content.js, l'export automatique y est lancé une fois. */
const ouvrir = (chemin = "/Ressources.php", quand = JEUDI, centre = "") => {
  regler(quand);
  return lire<Promise<string>>(`(() => {
    history.replaceState(null, "", ${JSON.stringify(chemin)});
    // nouvelle page : aucun export en cours, forum relu
    ExportRapports.enCours = false;
    PartageChasses.oublierCache();
    document.body.innerHTML = (window.SANS_ALLIANCE ? "" : "<span id='tag_alliance'>OUAF</span>") + (/^\\/messagerie\\.php/.test(${JSON.stringify(chemin)}) ? "<div id='messagerie'>" + listeMessagerie() + "</div>" : "<div id='centre'>" + ${JSON.stringify(centre)} + "</div>");
    return ExportAuto.lancer();
  })()`);
};
const jeu = <T = any>(champ: string) => lire<T>(`JSON.parse(JSON.stringify(JEU.${champ}))`);
const etat = () => lire<any>(`JSON.parse(JSON.stringify(ExportAuto.etat()))`);
const toasts = () => lire<{ text: string; hideAfter: any; icon: string }[]>(`TOASTS`);
const lignesChasse = () => (fichier.onglets["BDD chasse"]?.grille.length ?? 1) - 1;
const exportFait = () => lire<number>(`RappelExport.exportFait()`);
const aRappeler = () => lire<boolean>(`RappelExport.aRappeler()`);
const requetesAuJeu = () => jeu<string[]>("requetes");

describe("déclencheur : une chasse lancée alors qu'un export est dû", () => {
  const riendEnvoye = () =>
    expect([requetesAuJeu(), lire(`FORUM.appels`), jeu("fichier")]).toEqual([[], [], []]);

  test("export dû mais aucun clic sur « Envoyer » : rien, à aucune page, et pas de rappel (règle du mainteneur)", async () => {
    preparer(CHASSES, { chasse: false });
    for (const chemin of ["/Ressources.php", "/Reine.php", "/messagerie.php", "/construction.php"])
      expect(await ouvrir(chemin)).toBe("sans chasse");
    riendEnvoye();
    expect(etat().essais).toBeUndefined();
    // l'export partira tout seul au prochain clic : pas de bandeau en attendant
    expect(aRappeler()).toBe(false);
    // clic sur « Envoyer » du lanceur : l'export se fait à la page qui suit
    lancerChasse("2026-11-12 08:10");
    expect(etat().chasse).toBe(lire<number>(`heure`));
    expect(aRappeler()).toBe(false);
    expect(await ouvrir("/Ressources.php", "2026-11-12 08:10")).toBe("exporté");
    expect(lignesChasse()).toBe(4);
    expect(etat().chasse).toBe(0);
  });

  test("chasse lancée quand rien n'est dû : elle ne compte pas ; après le rendez-vous, il faut un nouveau lancement", async () => {
    preparer(CHASSES, { chasse: false });
    // export fait le mardi : rien n'est dû avant mercredi 22h
    regler("2026-11-10 12:00");
    lire(`RappelExport.noterExport()`);
    lancerChasse("2026-11-11 10:00");
    expect(etat().chasse).toBeUndefined();
    expect(await ouvrir("/Ressources.php", "2026-11-11 10:00")).toBe("à jour");
    // mercredi 22h passé : la première page n'exporte pas
    expect(await ouvrir("/Reine.php", "2026-11-11 22:30")).toBe("sans chasse");
    expect(await ouvrir("/Reine.php", "2026-11-12 07:00")).toBe("sans chasse");
    riendEnvoye();
    lancerChasse("2026-11-12 07:30");
    expect(await ouvrir("/Ressources.php", "2026-11-12 07:30")).toBe("exporté");
    expect(lignesChasse()).toBe(4);
  });

  test("plusieurs chasses d'un même lancement : un seul export, daté de la première", async () => {
    preparer(CHASSES, { chasse: false });
    lancerChasse("2026-11-12 08:00");
    const premiere = lire<number>(`heure`);
    lancerChasse("2026-11-12 08:01");
    lancerChasse("2026-11-12 08:02");
    expect(etat().chasse).toBe(premiere);
    expect(await ouvrir("/Ressources.php", "2026-11-12 08:02")).toBe("exporté");
    lire(`JEU.requetes = []`);
    expect(await ouvrir("/Ressources.php", "2026-11-12 08:03")).toBe("à jour");
    expect(requetesAuJeu()).toEqual([]);
  });

  test("chasse lancée avec le formulaire du jeu : rien, même sur la page « La chasse est lancée. » (détection au clic du lanceur seulement)", async () => {
    for (const chemin of ["/AcquerirTerrain.php", "/Ressources.php"]) {
      preparer(CHASSES, { chasse: false });
      expect(await ouvrir(chemin, JEUDI, "<p>La chasse est lancée.</p>")).toBe("sans chasse");
      riendEnvoye();
    }
  });

  test("export fait au bouton pendant qu'un lancement attendait : le rendez-vous suivant attend une nouvelle chasse", async () => {
    preparer();
    expect(etat().chasse).toBe(lire<number>(`heure`));
    lire(`RappelExport.noterExport()`);
    expect(await ouvrir("/Reine.php", "2026-11-12 08:05")).toBe("à jour");
    expect(etat().chasse).toBe(0);
    expect(await ouvrir("/Reine.php", "2026-11-15 22:10")).toBe("sans chasse");
    riendEnvoye();
  });

  test("autre rôle ou case décochée : un lancement n'est pas retenu", () => {
    preparer(CHASSES, { role: 1 });
    expect(etat().chasse).toBeUndefined();
    preparer(CHASSES, { chasse: false });
    lire(`ExportAuto.choisir(false)`);
    lancerChasse();
    expect(etat().chasse).toBeUndefined();
  });
});

describe("export automatique des chasses : à la page qui suit le lancement", () => {
  test("rôle Chasseur, rendez-vous passé : les chasses de la messagerie sont lues et envoyées, sans clic", async () => {
    preparer();
    expect(await ouvrir()).toBe("exporté");
    // la page de la messagerie une fois, puis les seules conversations de chasse
    expect(requetesAuJeu()).toEqual([
      "GET /messagerie.php",
      "conversation 11",
      "conversation 12",
      "lecture",
    ]);
    expect(lignesChasse()).toBe(4);
    expect(exportFait()).toBe(lire<number>(`heure`));
    expect(toasts().map((t) => [t.icon, t.text, t.hideAfter])).toEqual([
      ["success", "Export automatique des chasses : 4 lignes ajoutées dans « BDD chasse ».", 6000],
    ]);
    expect(etat().dernier).toEqual({ instant: lire<number>(`heure`), ajoutees: 4 });
    expect(lire(`ExportRapports.enCours`)).toBe(false);
    // chaque étape au journal, pour comprendre un export qui n'arrive pas
    expect(lire<string[]>(`NOTES`).filter((n) => /automatique/i.test(n))).toEqual([
      "info : Export automatique des chasses vers le fichier de l'alliance : 2 conversation(s) listée(s), 0 RC déjà exporté(s) dont 0 absent(s) du fichier, 2 conversation(s) à lire",
      "info : export automatique des chasses mené au bout : 2 conversation(s) lue(s), 4 ligne(s) ajoutée(s), 0 déjà présente(s)",
    ]);
  });

  test("déjà dans le fichier (exportées depuis un autre appareil) : lues, rien d'ajouté, aucun message", async () => {
    preparer();
    await ouvrir();
    // autre navigateur : rien de retenu, export pas noté
    lire(
      `Object.keys(localStorage).filter((k) => /^fzzz_exportCles_|^fzzz_exportChassesFait$/.test(k)).forEach((k) => localStorage.removeItem(k)); TOASTS = []; NOTES = []`,
    );
    lancerChasse("2026-11-12 09:00");
    expect(await ouvrir("/Reine.php", "2026-11-12 09:00")).toBe("exporté");
    expect(lignesChasse()).toBe(4);
    expect(toasts()).toEqual([]);
    expect(lire<string[]>(`NOTES`).at(-1)).toBe(
      "info : export automatique des chasses mené au bout : 2 conversation(s) lue(s), 0 ligne(s) ajoutée(s), 4 déjà présente(s)",
    );
  });

  test("export fait : plus rien avant le rendez-vous suivant, puis seulement les nouvelles chasses", async () => {
    preparer();
    await ouvrir();
    lire(`JEU.requetes = []; FORUM.appels = []; JEU.fichier = []; TOASTS = []`);
    expect(await ouvrir("/Reine.php", "2026-11-12 09:30")).toBe("à jour");
    expect(await ouvrir("/Reine.php", "2026-11-15 21:59")).toBe("à jour");
    // ni le jeu, ni le forum, ni le fichier
    expect([requetesAuJeu(), lire(`FORUM.appels`), jeu("fichier")]).toEqual([[], [], []]);
    // dimanche 22h passé : une chasse de plus dans la messagerie
    lire(
      `JEU.conversations[14] = { titre: "Chasse réussie : vos chasseuses ont conquis 9 cm²", html: ${JSON.stringify(message(106, chasse(5), "15/11/26 à 20h00"))} }`,
    );
    // rien tant qu'une chasse n'est pas lancée
    expect(await ouvrir("/Reine.php", "2026-11-15 22:05")).toBe("sans chasse");
    expect(requetesAuJeu()).toEqual([]);
    lancerChasse("2026-11-15 22:10");
    expect(await ouvrir("/Reine.php", "2026-11-15 22:10")).toBe("exporté");
    expect(requetesAuJeu()).toEqual(["GET /messagerie.php", "conversation 14"]);
    expect(lignesChasse()).toBe(5);
    expect(toasts().map((t) => t.text)).toEqual([
      "Export automatique des chasses : 1 ligne ajoutée dans « BDD chasse ».",
    ]);
  });

  test("rien de nouveau : export noté, aucun message", async () => {
    preparer();
    await ouvrir();
    lire(`TOASTS = []; JEU.requetes = []`);
    lancerChasse("2026-11-15 22:10");
    expect(await ouvrir("/Reine.php", "2026-11-15 22:10")).toBe("exporté");
    expect(requetesAuJeu()).toEqual(["GET /messagerie.php"]);
    expect(toasts()).toEqual([]);
    expect(exportFait()).toBe(lire<number>(`heure`));
  });

  test("un export au bouton dans les 24 h avant le rendez-vous compte : rien à faire", async () => {
    preparer();
    regler("2026-11-11 21:00");
    lire(`RappelExport.noterExport()`);
    expect(await ouvrir()).toBe("à jour");
    expect([requetesAuJeu(), lire(`FORUM.appels`)]).toEqual([[], []]);
  });

  test("autre rôle, ou case décochée : rien n'est lu ni envoyé", async () => {
    for (const role of [0, 1, 2]) {
      preparer(CHASSES, { role });
      expect(await ouvrir()).toBe("inactif");
      expect([requetesAuJeu(), lire(`FORUM.appels`), jeu("fichier")]).toEqual([[], [], []]);
    }
    preparer();
    lire(`ExportAuto.choisir(false)`);
    expect(lire(`localStorage.getItem("fzzz_partage_exportChasses")`)).toBe("0");
    expect(await ouvrir()).toBe("inactif");
    expect([requetesAuJeu(), lire(`FORUM.appels`), jeu("fichier")]).toEqual([[], [], []]);
    // recochée : l'export dû se fait à la page suivante
    lire(`ExportAuto.choisir(true)`);
    expect(await ouvrir()).toBe("exporté");
  });

  test("pas sur les pages Armée et d'attaque, où l'armée se lance à la seconde près", async () => {
    preparer();
    expect(await ouvrir("/Armee.php")).toBe("page");
    expect(await ouvrir("/ennemie.php?Attaquer=12&lieu=1")).toBe("page");
    expect([requetesAuJeu(), lire(`FORUM.appels`)]).toEqual([[], []]);
    expect(etat().essais).toBeUndefined();
    expect(await ouvrir("/ennemie.php")).toBe("exporté");
  });

  test("la première fois : le joueur est prévenu, rien n'est lu dans sa messagerie ; l'export se fait à la page suivante", async () => {
    preparer(CHASSES, { annonce: false });
    expect(await ouvrir()).toBe("annonce");
    expect(requetesAuJeu()).toEqual([]);
    expect(jeu("fichier")).toEqual([]);
    const annonce = toasts()[0]!;
    expect(toasts().length).toBe(1);
    expect(annonce.hideAfter).toBe(false);
    for (const dit of [
      "Tes rapports de chasse sont maintenant exportés automatiquement vers le Google Sheet de ton alliance",
      "deux fois par semaine au plus, à ton premier clic sur « Envoyer » ou « Envoyer + partager » du lanceur de chasses après le mercredi ou le dimanche 22h, une fois les chasses envoyées et après toutes les autres demandes de l'extension au jeu",
      "Le premier export se fera à ta prochaine page.",
      "Le bouton « Exporter mes chasses » de la messagerie reste",
      "class='o_ouvrirPartage'>Préférences → Partage de données</a>",
    ])
      expect(annonce.text).toContain(dit);
    // page suivante, sans attendre une heure : l'annonce n'est pas un essai
    expect(await ouvrir("/Reine.php", "2026-11-12 08:01")).toBe("exporté");
    expect(lignesChasse()).toBe(4);
    expect(toasts().length).toBe(2);
  });

  test("joueur hors de la liste avec son propre fichier : annonce et export vers ce fichier", async () => {
    preparer(CHASSES, { annonce: false });
    forum([{ id: "1", titre: "Export Google Sheet", messages: [reglage(URL_SCRIPT, "Canaille")] }]);
    lire(`GARDE.fzzz_exportSheet = ${JSON.stringify(URL_SCRIPT)}`);
    expect(await ouvrir()).toBe("annonce");
    expect(toasts()[0]!.text).toContain("exportés automatiquement vers ton Google Sheet :");
    expect(await ouvrir("/Reine.php", "2026-11-12 08:01")).toBe("exporté");
    expect(lignesChasse()).toBe(4);
  });
});

describe("liste des conversations", () => {
  test("sur la messagerie (boîte de réception) : la liste de la page, sans la relire", async () => {
    preparer();
    expect(await ouvrir("/messagerie.php")).toBe("exporté");
    expect(requetesAuJeu()).toEqual(["conversation 11", "conversation 12", "lecture"]);
    expect(lignesChasse()).toBe(4);
  });

  test("messagerie ouverte sur un autre dossier (ancre) ou avec des paramètres : la boîte de réception est lue", async () => {
    for (const chemin of ["/messagerie.php#Envoi", "/messagerie.php?defaut=Ecrire"]) {
      preparer();
      expect(await ouvrir(chemin)).toBe("exporté");
      expect(requetesAuJeu()[0]).toBe("GET /messagerie.php");
      expect(lignesChasse()).toBe(4);
    }
  });

  test("page reçue sans liste (session finie) : un échec, pas « rien à exporter »", async () => {
    preparer();
    lire(`JEU.session = false`);
    expect(await ouvrir()).toBe("échec");
    expect(etat().raison).toBe("liste des conversations de la messagerie illisible");
    expect(exportFait()).toBe(0);
    expect(lire<string[]>(`NOTES`).at(-1)).toBe(
      "erreur : export automatique des chasses non mené au bout",
    );
  });
});

describe("conversations non lues : le joueur retrouve sa messagerie comme il l'a laissée", () => {
  test("celles qui n'étaient pas lues le redeviennent, par la requête « lecture » du jeu, elles seules", async () => {
    preparer();
    await ouvrir();
    expect(jeu("marquages")).toEqual([{ ids: [12], est_lu: 0 }]);
    expect(lire(`[JEU.conversations[11].nonLue, JEU.conversations[12].nonLue]`)).toEqual([
      false,
      true,
    ]);
    expect(etat().aRemettre).toEqual([]);
  });

  test("toutes déjà lues : aucune requête de marquage", async () => {
    preparer({ 11: CHASSES[11]! });
    await ouvrir();
    expect(requetesAuJeu()).toEqual(["GET /messagerie.php", "conversation 11"]);
  });

  test("le jeu refuse le marquage : noté au journal, l'export est mené au bout", async () => {
    preparer();
    lire(`JEU.marquageRefuse = true`);
    expect(await ouvrir()).toBe("exporté");
    expect(lire<string[]>(`NOTES`)).toContain(
      "alerte : 1 conversation(s) de chasse lue(s) par l'export automatique pas remise(s) « non lues »",
    );
    expect(exportFait()).toBe(lire<number>(`heure`));
  });

  test("fichier en panne après les lectures : les conversations redeviennent non lues quand même", async () => {
    preparer();
    lire(`JEU.panneFichier = (m) => m.corps && m.corps.onglet`);
    expect(await ouvrir()).toBe("échec");
    expect(jeu("marquages")).toEqual([{ ids: [12], est_lu: 0 }]);
    expect(lire(`JEU.conversations[12].nonLue`)).toBe(true);
  });

  test("page quittée pendant la lecture : à la page suivante, une requête les remet non lues, une seule fois ; l'export reprend une heure plus tard", async () => {
    preparer({ ...CHASSES, 11: { ...CHASSES[11]!, nonLue: true } });
    lire(`JEU.enAttente = 12`);
    // jamais finie : la page est quittée pendant la lecture de la conversation 12
    ouvrir();
    await new Promise((r) => setTimeout(r, 20));
    expect(requetesAuJeu()).toEqual(["GET /messagerie.php", "conversation 11", "conversation 12"]);
    expect(etat().aRemettre).toEqual([11, 12]);
    expect(lire(`JEU.conversations[11].nonLue`)).toBe(false);
    // page suivante, une minute plus tard : pas de nouvel essai, mais les non lues le redeviennent
    lire(`JEU.enAttente = null; JEU.requetes = []`);
    expect(await ouvrir("/Reine.php", "2026-11-12 08:01")).toBe("attente");
    expect(requetesAuJeu()).toEqual(["lecture"]);
    expect(jeu("marquages")).toEqual([{ ids: [11, 12], est_lu: 0 }]);
    expect(lire(`JEU.conversations[11].nonLue`)).toBe(true);
    // et pas une seconde fois
    expect(await ouvrir("/Reine.php", "2026-11-12 08:02")).toBe("attente");
    expect(requetesAuJeu()).toEqual(["lecture"]);
    // une heure après l'essai interrompu : l'export est mené au bout
    lire(`JEU.requetes = []`);
    expect(await ouvrir("/Reine.php", "2026-11-12 09:00")).toBe("exporté");
    expect(lignesChasse()).toBe(4);
    expect(lire(`[JEU.conversations[11].nonLue, JEU.conversations[12].nonLue]`)).toEqual([
      true,
      true,
    ]);
  });

  test("page quittée, puis case décochée : les conversations redeviennent non lues quand même", async () => {
    preparer();
    lire(`JEU.enAttente = 12`);
    ouvrir();
    await new Promise((r) => setTimeout(r, 20));
    lire(`JEU.enAttente = null; ExportAuto.choisir(false)`);
    expect(await ouvrir("/Reine.php", "2026-11-12 08:01")).toBe("inactif");
    expect(jeu("marquages")).toEqual([{ ids: [12], est_lu: 0 }]);
  });
});

describe("échecs : nouvel essai à une page ouverte plus tard, jamais à chaque page", () => {
  test("fichier sans réponse : rien de noté, un essai par heure, trois par jour, de nouveau le lendemain", async () => {
    preparer();
    lire(`JEU.panneFichier = () => true`);
    expect(await ouvrir()).toBe("échec");
    expect(etat().raison).toBe("le script du Google Sheet ne répond pas");
    expect(exportFait()).toBe(0);
    expect(toasts()).toEqual([]);
    // 59 minutes plus tard : pas de nouvel essai, aucune requête
    lire(`JEU.requetes = []; FORUM.appels = []; JEU.fichier = []`);
    expect(await ouvrir("/Reine.php", "2026-11-12 08:59")).toBe("attente");
    expect([requetesAuJeu(), lire(`FORUM.appels`), jeu("fichier")]).toEqual([[], [], []]);
    expect(await ouvrir("/Reine.php", "2026-11-12 09:00")).toBe("échec");
    expect(await ouvrir("/Reine.php", "2026-11-12 10:00")).toBe("échec");
    expect(etat().essais).toBe(3);
    // trois essais ce jour-là : plus rien jusqu'au lendemain
    expect(await ouvrir("/Reine.php", "2026-11-12 23:00")).toBe("attente");
    expect(await ouvrir("/Reine.php", "2026-11-13 00:05")).toBe("échec");
    // le fichier répond de nouveau
    lire(`JEU.panneFichier = null`);
    expect(await ouvrir("/Reine.php", "2026-11-13 01:05")).toBe("exporté");
    expect(lignesChasse()).toBe(4);
    expect(etat().raison).toBe("");
  });

  test("rendez-vous suivant : les essais repartent de zéro, sans attendre une heure", async () => {
    preparer();
    lire(`JEU.panneFichier = () => true`);
    // dimanche : trois essais en échec pour le rendez-vous du mercredi
    for (const h of ["19:00", "20:00", "21:30"])
      expect(await ouvrir("/Reine.php", `2026-11-15 ${h}`)).toBe("échec");
    expect(await ouvrir("/Reine.php", "2026-11-15 21:59")).toBe("attente");
    // dimanche 22h : nouveau rendez-vous, un essai tout de suite
    lire(`JEU.panneFichier = null`);
    expect(await ouvrir("/Reine.php", "2026-11-15 22:00")).toBe("exporté");
    expect(etat()).toMatchObject({ essais: 1, raison: "" });
  });

  test("case décochée puis recochée après un échec : nouvel essai à la page suivante", async () => {
    preparer();
    lire(`JEU.panneFichier = () => true`);
    expect(await ouvrir()).toBe("échec");
    lire(`JEU.panneFichier = null; ExportAuto.choisir(false); ExportAuto.choisir(true)`);
    expect(await ouvrir("/Reine.php", "2026-11-12 08:05")).toBe("exporté");
  });

  test("conversation illisible : les autres sont exportées, l'export n'est pas noté, elle seule est relue à l'essai suivant", async () => {
    preparer();
    lire(`JEU.illisibles = [11]`);
    expect(await ouvrir()).toBe("échec");
    expect(lignesChasse()).toBe(1);
    expect(exportFait()).toBe(0);
    expect(etat().raison).toBe("1 conversation(s) de chasse illisible(s)");
    expect(toasts().map((t) => t.text)).toEqual([
      "Export automatique des chasses : 1 ligne ajoutée dans « BDD chasse ».",
    ]);
    lire(`JEU.illisibles = []; JEU.requetes = []`);
    expect(await ouvrir("/Reine.php", "2026-11-12 09:00")).toBe("exporté");
    expect(requetesAuJeu()).toEqual(["GET /messagerie.php", "conversation 11"]);
    expect(lignesChasse()).toBe(4);
  });

  test("par lots de 10 : une panne du fichier au 2e lot garde le 1er ; l'essai suivant ne lit que le reste", async () => {
    preparer(beaucoup(25, true));
    lire(
      `JEU.panneFichier = (m) => m.corps && m.corps.onglet && ++JEU.envois == 2; JEU.envois = 0`,
    );
    expect(await ouvrir()).toBe("échec");
    expect(lire<number>(`JEU.envois`)).toBe(2);
    // 20 conversations lues (deux lots), le 3e lot n'a pas été commencé
    expect(jeu<number[]>("lues").length).toBe(20);
    expect(lignesChasse()).toBe(10);
    // chaque lot rend ses non lues, panne ou pas
    expect(jeu<{ ids: number[] }[]>("marquages").map((m) => m.ids.length)).toEqual([10, 10]);
    lire(`JEU.panneFichier = null; JEU.lues = []`);
    expect(await ouvrir("/Reine.php", "2026-11-12 09:00")).toBe("exporté");
    expect(jeu<number[]>("lues")).toEqual(Array.from({ length: 15 }, (_, k) => 211 + k));
    expect(lignesChasse()).toBe(25);
    expect(toasts().map((t) => t.text)).toEqual([
      "Export automatique des chasses : 15 lignes ajoutées dans « BDD chasse ».",
    ]);
  });

  test("aucun fichier où exporter (hors liste, sans adresse) : pas d'annonce, un seul essai par jour", async () => {
    preparer(CHASSES, { annonce: false });
    forum([{ id: "1", titre: "Export Google Sheet", messages: [reglage(URL_SCRIPT, "Canaille")] }]);
    expect(await ouvrir()).toBe("sans fichier");
    expect(toasts()).toEqual([]);
    expect(requetesAuJeu()).toEqual([]);
    expect(etat().raison).toContain("ton pseudo n'est pas dans la liste des joueurs autorisés");
    lire(`FORUM.appels = []`);
    expect(await ouvrir("/Reine.php", "2026-11-12 12:00")).toBe("attente");
    expect(lire(`FORUM.appels`)).toEqual([]);
    expect(await ouvrir("/Reine.php", "2026-11-13 08:00")).toBe("sans fichier");
  });

  test("forum illisible, sans lecture gardée : un échec comme un autre, repris une heure plus tard", async () => {
    preparer();
    lire(`FORUM.echoue = true`);
    expect(await ouvrir()).toBe("échec");
    expect(etat().raison).toContain("le forum de l'alliance n'a pas pu être lu");
    expect(etat().essais).toBe(1);
    lire(`FORUM.echoue = false`);
    expect(await ouvrir("/Reine.php", "2026-11-12 09:00")).toBe("exporté");
  });

  test("joueur sans alliance ni fichier à lui : un seul essai par jour, le forum n'est pas relu ; avec son fichier : exporté", async () => {
    preparer(CHASSES, { annonce: false });
    lire(`SANS_ALLIANCE = true; FORUM.echoue = true`);
    expect(await ouvrir()).toBe("sans fichier");
    expect(etat().raison).toBe(
      "tu n'as pas d'alliance et aucune adresse de Google Sheet n'est renseignée dans Préférences → Messagerie",
    );
    expect(toasts()).toEqual([]);
    expect(await ouvrir("/Reine.php", "2026-11-12 12:00")).toBe("attente");
    lire(`GARDE.fzzz_exportSheet = ${JSON.stringify(URL_SCRIPT)}`);
    expect(await ouvrir("/Reine.php", "2026-11-13 08:00")).toBe("annonce");
    expect(await ouvrir("/Reine.php", "2026-11-13 08:01")).toBe("exporté");
    expect(lignesChasse()).toBe(4);
  });

  test("RC sans date lisible : message qui reste, avec la date lue", async () => {
    preparer({
      15: {
        titre: "Chasse réussie : vos chasseuses ont conquis 2 cm²",
        html: message(107, chasse(6), "date illisible"),
      },
    });
    expect(await ouvrir()).toBe("exporté");
    expect(toasts().map((t) => [t.icon, t.hideAfter])).toEqual([["warning", false]]);
    expect(toasts()[0]!.text).toBe(
      "Export automatique des chasses : 0 ligne ajoutée dans « BDD chasse ». 1 rapport sans date lisible, pas exporté : envoie ce message à la personne qui gère l'extension (date lue : « date illisible »).",
    );
  });
});

describe("le bouton reste : un seul export à la fois", () => {
  test("un export au bouton en cours : l'automatique attend, sans compter un essai", async () => {
    preparer();
    regler(JEUDI);
    lire(`history.replaceState(null, "", "/messagerie.php"); ExportRapports.enCours = true`);
    expect(await lire<Promise<string>>(`ExportAuto.lancer()`)).toBe("attente");
    expect(etat().essais).toBeUndefined();
    expect(requetesAuJeu()).toEqual([]);
  });

  test("pendant l'export automatique, le bouton répond qu'un export est en cours ; ensuite il marche", async () => {
    preparer();
    lire(`JEU.enAttente = 11`);
    ouvrir("/messagerie.php");
    await new Promise((r) => setTimeout(r, 20));
    expect(lire(`ExportRapports.enCours`)).toBe(true);
    await lire(`ExportRapports.exporter("chasse")`);
    expect(toasts().at(-1)!.text).toBe("Un export est déjà en cours, patiente un instant.");
    // l'export automatique fini ou la page rechargée : le bouton exporte tout de suite
    lire(`JEU.enAttente = null; ExportRapports.enCours = false; TOASTS = []`);
    await lire(`ExportRapports.exporter("chasse")`);
    expect(lignesChasse()).toBe(4);
    expect(toasts().at(-1)!.text).toBe(
      "Export des chasses : 4 lignes ajoutées dans « BDD chasse ».",
    );
    expect(exportFait()).toBe(lire<number>(`heure`));
  });
});

describe("rappel « Export des chasses à faire »", () => {
  test("pas de bandeau tant que l'export automatique s'en charge ; après un essai en échec, il revient", async () => {
    preparer();
    regler(JEUDI);
    expect(aRappeler()).toBe(false);
    lire(`JEU.panneFichier = () => true`);
    await ouvrir();
    expect(aRappeler()).toBe(true);
    // l'essai suivant réussit : plus de rappel
    lire(`JEU.panneFichier = null`);
    await ouvrir("/Reine.php", "2026-11-12 09:00");
    expect(aRappeler()).toBe(false);
  });

  test("essai en cours ou interrompu : pas de bandeau", async () => {
    preparer();
    lire(`JEU.enAttente = 11`);
    ouvrir();
    await new Promise((r) => setTimeout(r, 20));
    expect(aRappeler()).toBe(false);
  });

  test("bandeau : aucun en attendant le clic sur « Envoyer » ; après un essai en échec ou case décochée, le bouton de la messagerie", async () => {
    preparer(CHASSES, { chasse: false });
    regler(JEUDI);
    const bandeau = (chemin: string) =>
      lire<string | null>(`(() => {
        history.replaceState(null, "", ${JSON.stringify(chemin)});
        document.body.innerHTML = "<div id='menu'></div><div id='centre'></div>";
        RappelExport.afficher();
        return $("#o_rappelExport").length ? $("#o_rappelExport .o_rappelExportTexte").text() : null;
      })()`);
    const ouvreLaMessagerie =
      "Export des chasses à faire : ouvre la messagerie et clique sur « Exporter mes chasses ».";
    expect([bandeau("/Reine.php"), bandeau("/messagerie.php")]).toEqual([null, null]);
    lancerChasse();
    lire(`JEU.panneFichier = () => true`);
    expect(await ouvrir()).toBe("échec");
    expect(bandeau("/Reine.php")).toBe(ouvreLaMessagerie);
    expect(bandeau("/messagerie.php")).toBe(
      "Export des chasses à faire : clique sur « Exporter mes chasses ».",
    );
    lire(`JEU.panneFichier = null`);
    expect(await ouvrir("/Reine.php", "2026-11-12 09:00")).toBe("exporté");
    expect(bandeau("/Reine.php")).toBeNull();
    // case décochée : rien ne part tout seul, le bandeau revient au rendez-vous suivant
    lire(`ExportAuto.choisir(false)`);
    regler("2026-11-15 22:05");
    expect(bandeau("/Reine.php")).toBe(ouvreLaMessagerie);
  });

  test("case décochée : le rappel revient, comme avant", () => {
    preparer();
    regler(JEUDI);
    lire(`ExportAuto.choisir(false)`);
    expect(aRappeler()).toBe(true);
  });

  test("échec d'un rendez-vous passé : le rendez-vous suivant repart sans bandeau", async () => {
    preparer();
    lire(`JEU.panneFichier = () => true`);
    await ouvrir();
    regler("2026-11-15 22:05");
    expect(aRappeler()).toBe(false);
  });
});

describe("Préférences : où en est l'export", () => {
  test("rôle, dernier export, essai qui n'a pas abouti", async () => {
    preparer(CHASSES, { role: 1 });
    regler(JEUDI);
    expect(lire(`ExportAuto.resume()`)).toBe(
      "Ton rôle n'est pas « Chasseur » (Préférences → Rôle) : tes chasses ne sont pas exportées automatiquement.",
    );
    preparer(CHASSES, { chasse: false });
    regler(JEUDI);
    expect(lire(`ExportAuto.resume()`)).toBe(
      "Aucun export des chasses mené au bout depuis ce navigateur pour l'instant. Le prochain export se fera après ton prochain clic sur « Envoyer » du lanceur de chasses.",
    );
    lancerChasse();
    expect(lire(`ExportAuto.resume()`)).toBe(
      "Aucun export des chasses mené au bout depuis ce navigateur pour l'instant. Le prochain export se fera à ta prochaine page.",
    );
    lire(`JEU.panneFichier = () => true`);
    await ouvrir();
    expect(lire(`ExportAuto.resume()`)).toBe(
      "Aucun export des chasses mené au bout depuis ce navigateur pour l'instant. Le dernier essai automatique n'a pas abouti : le script du Google Sheet ne répond pas. Nouvel essai à une page ouverte plus tard (3 essais par jour au plus) ; le bouton « Exporter mes chasses » de la messagerie marche aussi.",
    );
    lire(`JEU.panneFichier = null`);
    await ouvrir("/Reine.php", "2026-11-12 09:00");
    expect(lire(`ExportAuto.resume()`)).toBe(
      "Dernier export des chasses mené au bout depuis ce navigateur : le 12/11/2026 à 09h00.",
    );
  });
});

describe("règles du s5", () => {
  const source = (f: string) => readFileSync(join(import.meta.dir, "..", "public", f), "utf8");

  test("aucune minuterie dans le module : tout part d'une chasse que le joueur lance", () => {
    expect(source("js/class/ExportAuto.js")).not.toMatch(
      /setTimeout|setInterval|requestAnimationFrame/,
    );
  });

  test("deux appels seulement : au démarrage de la page, après le relevé du jour, et à la fin d'un lancement fait dans la boîte d'outils", () => {
    const fichiers = readdirSync(join(import.meta.dir, "..", "public", "js"), {
      recursive: true,
    }) as string[];
    const appels = fichiers
      .filter((f) => f.endsWith(".js") && !f.startsWith("lib"))
      .map((f) => [
        f.replace(/\\/g, "/"),
        (source("js/" + f).match(/ExportAuto\.lancer\(/g) || []).length,
      ])
      .filter(([, n]) => n)
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    expect(appels).toEqual([
      ["class/LanceurChasse.js", 1],
      ["content.js", 1],
    ]);
    const demarrage = source("js/content.js");
    expect(demarrage.indexOf("ExportAuto.lancer()")).toBeGreaterThan(
      demarrage.indexOf("SuiviMembres.lancer()"),
    );
    // dans la boîte : à la fin de l'envoi des chasses demandé par le clic du joueur
    const lanceur = source("js/class/LanceurChasse.js");
    const fin = lanceur.slice(lanceur.indexOf("_finLancement(lancees, total, partager = false) {"));
    expect(fin.slice(0, fin.indexOf("\n  }\n"))).toContain("ExportAuto.lancer();");
  });

  test("un lancement n'est noté qu'au clic sur « Envoyer » ou « Envoyer + partager » du lanceur", () => {
    const fichiers = readdirSync(join(import.meta.dir, "..", "public", "js"), {
      recursive: true,
    }) as string[];
    const signalements = fichiers
      .filter((f) => f.endsWith(".js") && !f.startsWith("lib"))
      .map((f) => [
        f.replace(/\\/g, "/"),
        (source("js/" + f).match(/ExportAuto\.noterChasse\(\)/g) || []).length,
      ])
      .filter(([, n]) => n)
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    expect(signalements).toEqual([["class/LanceurChasse.js", 1]]);
    // dans le gestionnaire du clic des deux boutons, avant l'envoi des chasses
    const lanceur = source("js/class/LanceurChasse.js");
    const clic = lanceur.slice(
      lanceur.indexOf(`this.$("#o_chasseEnvoyer, #o_chasseEnvoyerPartager").click(`),
    );
    expect(clic.indexOf("ExportAuto.noterChasse()")).toBeGreaterThan(0);
    expect(clic.indexOf("ExportAuto.noterChasse()")).toBeLessThan(
      clic.indexOf("this._armee.envoyerChasse("),
    );
  });

  test("priorité la plus faible de toutes : chaque requête de l'export automatique au jeu et au forum est de fond", async () => {
    preparer(CHASSES, { annonce: false });
    // section cachée pas encore connue : la liste des sections est lue aussi
    lire(`PartageChasses.idSection = null`);
    // annonce (forum lu), puis export (forum, messagerie, conversations, non lues)
    expect(await ouvrir()).toBe("annonce");
    expect(lire(`FORUM.appels.slice(0, 2)`)).toEqual(["callGetForum", "callGetForum"]);
    expect(await ouvrir("/Reine.php", "2026-11-12 08:01")).toBe("exporté");
    expect(requetesAuJeu()).toEqual([
      "GET /messagerie.php",
      "conversation 11",
      "conversation 12",
      "lecture",
    ]);
    expect(lire(`FORUM.appels.length`)).toBeGreaterThan(0);
    expect([jeu("normales"), lire(`FORUM.normaux`)]).toEqual([[], []]);
    // conversations remises « non lues » à la page suivante (page quittée en route) : de fond aussi
    preparer({ ...CHASSES, 11: { ...CHASSES[11]!, nonLue: true } });
    lire(`JEU.enAttente = 12`);
    ouvrir();
    await new Promise((r) => setTimeout(r, 20));
    lire(`JEU.enAttente = null`);
    await ouvrir("/Reine.php", "2026-11-12 08:01");
    expect(jeu("marquages").length).toBe(1);
    expect(jeu("normales")).toEqual([]);
  });

  test("le bouton « Exporter mes chasses » garde la priorité normale : tout de suite", async () => {
    preparer(CHASSES, { chasse: false });
    // sur la messagerie, sans clic sur « Envoyer » : seul le bouton exporte
    expect(await ouvrir("/messagerie.php")).toBe("sans chasse");
    await lire(`ExportRapports.exporter("chasse")`);
    expect(lignesChasse()).toBe(4);
    expect(jeu("normales")).toEqual(["conversation 11", "conversation 12"]);
    expect(lire(`FORUM.normaux.length`)).toBeGreaterThan(0);
  });
});
