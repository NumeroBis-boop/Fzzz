import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";
import { FORUM_SIMULE, SUJET_RELEVE } from "./forum-simule";

/**
 * Sujets communs « BDD générale flood » et « BDD générale chasse » : une
 * réponse par joueur, postée puis modifiée par son extension, que lui seul
 * écrit (demande du mainteneur, 14/11/2026) ; le premier message (ancien
 * format, une section par joueur) n'est plus lu, « Ranger le forum » le vide
 * et supprime les anciens sujets des joueurs. HTML du forum relevé le 14/11
 * (tests/forum-simule.ts). Joueurs inventés.
 */
const page = creerPage(
  ["js/class/Utils.js", "js/class/Requetes.js", "js/page/PartageChasses.js"],
  `var VERSION = "1.114.0";
   var heure = moment("2026-11-14 12:00:00", "YYYY-MM-DD HH:mm:ss").valueOf();
   var Horloge = { maintenant: () => heure, serveur: () => moment(heure), clic: () => moment(heure) };
   var monProfil = { pseudo: "Alpha" };
   var TOAST_INFO = {}, TOAST_SUCCESS = {}, TOAST_ERROR = {};
   var AttaqueLancee = { majPartages() {}, oublierPartage() {} };
   var FORUM = {};`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);
lire(FORUM_SIMULE);
lire(`(() => {
  PartageChasses._html = (d) => d;
  PartageChasses._xajax = (f, args) => {
    FORUM.ordre.push(f + (f == "callGetTopic" ? " " + args : ""));
    // comme le vrai _xajax : une écriture rend les lectures gardées périmées
    if (/^envoi/.test(f)) PartageChasses.oublierCache();
    if (f == "callGetForum")
      return Promise.resolve('<form id="form_cat"><table>' + FORUM.sujets.map((s) =>
        '<tr><td><input name="topic[]" value="' + s.id + '"/></td><td>' + s.titre + '</td><td><b>X</b><br/>' + (s.dernier || "13 nov. à 22h03") + '</td></tr>').join("") + '</table></form>');
    if (f == "callGetTopic" && FORUM.echoue.includes(String(args))) return Promise.reject(new Error("forum"));
    // écriture acceptée par le jeu sans effet (grade sans droit d'écrire)
    if (FORUM.refuse.includes(f)) return Promise.resolve("");
    if (f == "envoiEditTopic") {
      const id = SIM.q(args, "IDTopic"), s = FORUM.sujets.find((s) => s.id == id), sujet = SIM.q(args, "sujet");
      if (FORUM.historiqueEchoue && /^Historique/.test(sujet)) return Promise.reject(new Error("forum"));
      FORUM.premiers.push({ id, sujet, message: SIM.q(args, "message"), modifiable: /modifiable=envoyer/.test(args) });
      if (s) { s.titre = sujet; s.texte = SIM.q(args, "message"); }
      return Promise.resolve("<xjx></xjx>");
    }
    if (f == "envoiNouveauSujet") {
      if (FORUM.historiqueEchoue) return Promise.reject(new Error("forum"));
      FORUM.sujets.push({ id: String(200 + FORUM.sujets.length), titre: SIM.q(args, "sujet"), texte: SIM.q(args, "message") });
      return Promise.resolve("<xjx></xjx>");
    }
    if (f == "callSupprimer") {
      const ids = [...String(args[0]).matchAll(/topic\\[\\]=(\\d+)/g)].map((m) => m[1]);
      FORUM.suppressions.push(ids);
      if (!FORUM.refuseSuppression) FORUM.sujets = FORUM.sujets.filter((s) => !ids.includes(s.id));
      return Promise.resolve("<xjx></xjx>");
    }
    const r = SIM.traiter(FORUM.sujets, f, args, monProfil.pseudo);
    if (r) return FORUM.reponseVide && /^envoi/.test(f) ? r.then(() => "") : r;
    return Promise.reject(new Error("inattendu " + f));
  };
  $.toast = () => {};
})()`);

const ligne = (type: string, e: any) =>
  lire<string>(`PartageChasses._ligne(${JSON.stringify(type)}, ${JSON.stringify(e)})`);
const flood = (date: string, cible: string, id: number) => ({
  date,
  cible,
  unites: 1000,
  terrain: 1000,
  id,
});
const COMMUN_F = "BDD générale flood - NE RIEN ÉCRIRE";
const COMMUN_C = "BDD générale chasse - NE RIEN ÉCRIRE";
const A1 = flood("2026-11-14 13:00", "Gamma", 11);
const B1 = flood("2026-11-14 13:10", "Alpha", 21);
const PASSE = flood("2026-11-14 11:00", "Gamma", 8);
const regler = (quand: string) =>
  lire(`(() => { heure = moment(${JSON.stringify(quand)}, "YYYY-MM-DD HH:mm:ss").valueOf(); })()`);
const section = (pseudo: string, ecrit: string, lignes: string[]) =>
  [`--- ${pseudo} · ${ecrit} ---`, ...lignes].join("\n");

/**
 * Section « BDD partagée cachée » : les sujets communs, dont le premier
 * message garde des sections de l'ancien format ; Beta a sa réponse dans
 * celui des floods ; anciens sujets « Floods | … » ; convois d'Alpha.
 */
function preparer() {
  const sujets = [
    {
      id: "1",
      titre: "Floods | Alpha",
      texte: [ligne("Floods", A1), ligne("Floods", PASSE)].join("\n"),
    },
    { id: "2", titre: "Floods | Beta", texte: ligne("Floods", B1) },
    {
      id: "3",
      titre: "Chasses | Alpha",
      texte: ligne("Chasses", { date: "2026-11-14 13:30", terrain: 1500 }),
    },
    { id: "4", titre: "Convois | Alpha", texte: "rien" },
    {
      id: "10",
      titre: COMMUN_F,
      texte: [
        "NE RIEN ÉCRIRE ICI",
        section("Alpha", "2026-11-14 00:02:59", [ligne("Floods", A1), ligne("Floods", PASSE)]),
        section("Gamma", "2026-11-14 00:02:59", [
          ligne("Floods", flood("2026-11-14 14:00", "Beta", 31)),
        ]),
      ].join("\n"),
      reponses: [{ id: 501, auteur: "Beta", texte: ligne("Floods", B1) }],
    },
    { id: "11", titre: COMMUN_C, texte: "", reponses: [] },
  ];
  lire(`(() => {
    localStorage.clear();
    PartageChasses.idSection = "7";
    heure = moment("2026-11-14 12:00:00", "YYYY-MM-DD HH:mm:ss").valueOf();
    monProfil.pseudo = "Alpha";
    journalInstalle = true;
    Object.keys(COMPTE_REQUETES).forEach((k) => (COMPTE_REQUETES[k] = 0));
    FORUM = { sujets: ${JSON.stringify(sujets)}, ordre: [], echoue: [], refuse: [], premiers: [], suppressions: [],
      reponseVide: false, historiqueEchoue: false, refuseSuppression: false };
  })()`);
}
const sujet = (id: string) => lire<any>(`FORUM.sujets.find((s) => s.id == ${JSON.stringify(id)})`);
const ordre = () => lire<string[]>(`FORUM.ordre.slice()`);
const titres = () => lire<string[]>(`FORUM.sujets.map((s) => s.titre)`);
const notes = (source = "Forum") =>
  lire<string[]>(
    `Journal.entrees().filter((e) => e.s == ${JSON.stringify(source)}).map((e) => e.m)`,
  );
/** Réponses d'un sujet : [auteur, texte]. */
const reponses = (id: string) =>
  lire<[string, string][]>(
    `(FORUM.sujets.find((s) => s.id == ${JSON.stringify(id)}).reponses || []).map((r) => [r.auteur, r.texte])`,
  );
async function charger(args = "") {
  lire(`(() => { PartageChasses.oublierCache(); FORUM.ordre.length = 0; })()`);
  return lire<Promise<any>>(
    `PartageChasses.charger(${args}).then((d) => JSON.parse(JSON.stringify(d)))`,
  );
}

describe("format", () => {
  test("titre reconnu sans tenir compte de la casse, des accents et de la suite", () => {
    const est = (titre: string, type: string) =>
      lire<boolean>(`PartageChasses.estCommun(${JSON.stringify(titre)}, ${JSON.stringify(type)})`);
    expect(est(COMMUN_F, "Floods")).toBe(true);
    expect(est("bdd GENERALE  flood (ne rien écrire)", "Floods")).toBe(true);
    expect(est(COMMUN_C, "Chasses")).toBe(true);
    expect(est(COMMUN_C, "Floods")).toBe(false);
    expect(est("Floods | BDD générale flood", "Floods")).toBe(false);
  });

  test("la liste des sujets donne les sujets communs ; deux du même type : le plus ancien", async () => {
    preparer();
    lire(
      `(() => { FORUM.sujets.push({ id: "9", titre: "BDD générale flood - bis", dernier: "13 nov. à 22h00", texte: "" }); })()`,
    );
    const s = await lire<Promise<any>>(
      `PartageChasses.sujets().then((s) => JSON.parse(JSON.stringify(s.communs)))`,
    );
    expect([s.Floods.id, s.Floods.dernier, s.Chasses.id]).toEqual(["9", "X 13 nov. à 22h00", "11"]);
  });

  test("messages d'un sujet (HTML du forum) : auteur, numéro, texte sans les liens « Modifier » et « Effacer »", () => {
    preparer();
    lire(`(() => { FORUM.sujets.find((s) => s.id == "10").reponses.push(
      { id: 502, auteur: "Alpha", texte: "vieux" }, { id: 503, auteur: "Gamma", texte: "g" }, { id: 504, auteur: "Alpha", texte: "ligne 1\\nligne 2" }); })()`);
    const html = lire<string>(`SIM.html(FORUM.sujets.find((s) => s.id == "10"), "Alpha")`);
    // la réponse 504 d'Alpha, dernière du sujet, a « Modifier » et « Effacer »
    expect(html).toContain("remove_message(504)");
    const messages = lire<any[]>(`PartageChasses.messages(${JSON.stringify(html)})`);
    expect(messages.map((m) => [m.auteur, m.id])).toEqual([
      ["DoggyBag", null],
      ["Beta", 501],
      ["Alpha", 502],
      ["Gamma", 503],
      ["Alpha", 504],
    ]);
    expect(messages[4].texte).toBe("ligne 1\nligne 2");
    expect(messages[0].texte.split("\n")[0]).toBe("NE RIEN ÉCRIRE ICI");
    // la dernière réponse de chaque joueur ; le premier message n'en est pas une
    const r = lire<any>(`PartageChasses.reponses(${JSON.stringify(messages)})`);
    expect(Object.keys(r).sort()).toEqual(["alpha", "beta", "gamma"]);
    expect([r.alpha.id, r.beta.floods.map((f: any) => f.id)]).toEqual([504, [21]]);
  });

  test("sujet relevé sur le forum le 14/11 : chaque message, son auteur, son numéro, son texte", () => {
    const messages = lire<any[]>(`PartageChasses.messages(${JSON.stringify(SUJET_RELEVE)})`);
    expect(messages).toEqual([
      { auteur: "Alpha", id: null, texte: "" },
      { auteur: "Beta", id: 501, texte: "texte de Beta" },
      { auteur: "Alpha", id: 502, texte: "texte d'Alpha" },
      { auteur: "Alpha", id: 503, texte: "dernier texte d'Alpha" },
    ]);
    lire(`(() => { monProfil.pseudo = "Alpha"; })()`);
    expect(lire<any>(`PartageChasses._maReponse(${JSON.stringify(messages)}).id`)).toBe(503);
  });

  test("sections de l'ancien format (lues par « Ranger le forum ») : en-tête, lignes, texte d'en-tête gardé", () => {
    preparer();
    const lu = lire<any>(`PartageChasses.sections(${JSON.stringify(sujet("10").texte)})`);
    expect(lu.preambule).toBe("NE RIEN ÉCRIRE ICI");
    expect(
      lu.sections.map((s: any) => [s.pseudo, s.ecrit, s.floods.map((f: any) => f.id)]),
    ).toEqual([
      ["Alpha", "2026-11-14 00:02:59", [11, 8]],
      ["Gamma", "2026-11-14 00:02:59", [31]],
    ]);
    expect(
      lire<string>(`PartageChasses.texteCommun("En-tête", ${JSON.stringify([lu.sections[1]])})`),
    ).toBe(
      [
        "En-tête",
        section("Gamma", "2026-11-14 00:02:59", [
          ligne("Floods", flood("2026-11-14 14:00", "Beta", 31)),
        ]),
      ].join("\n"),
    );
    // jamais vide
    expect(lire<string>(`PartageChasses.texteCommun("", [])`)).toBe(
      "Une réponse par joueur, écrite et modifiée par son Extension OUAF. NE RIEN ÉCRIRE ICI.",
    );
  });
});

describe("affichage : la dernière réponse de chaque joueur", () => {
  test("floods de tous les joueurs ; ni le premier message (ancien format) ni les anciens sujets des joueurs", async () => {
    preparer();
    const d = await charger();
    expect(ordre()).toEqual(["callGetForum", "callGetTopic 10", "callGetTopic 11"]);
    // Alpha et Gamma n'ont qu'une section de l'ancien format : absents
    expect(d.floods.map((f: any) => [f.lanceur, f.id])).toEqual([["Beta", 21]]);
    expect(d.chasses).toEqual({});
  });

  test("chasses seulement des joueurs suivis ; deux réponses d'un joueur : la plus récente", async () => {
    preparer();
    lire(`(() => {
      FORUM.sujets.find((s) => s.id == "11").reponses = [
        { id: 601, auteur: "Gamma", texte: ${JSON.stringify(ligne("Chasses", { date: "2026-11-14 13:55", terrain: 900 }))} },
        { id: 602, auteur: "Beta", texte: "x" },
        { id: 603, auteur: "Gamma", texte: ${JSON.stringify(ligne("Chasses", { date: "2026-11-14 14:05", terrain: 950 }))} },
      ];
    })()`);
    const d = await charger();
    expect(d.chasses.gamma).toEqual([{ date: "2026-11-14 14:05", terrain: 950 }]);
    expect(Object.keys(d.chasses).sort()).toEqual(["beta", "gamma"]);
    const suivi = await charger(`["Beta"]`);
    expect(Object.keys(suivi.chasses)).toEqual(["beta"]);
    expect(suivi.floods.map((f: any) => f.id)).toEqual([21]);
  });

  test("sujet commun illisible : la lecture échoue (il manquerait des joueurs)", async () => {
    preparer();
    lire(`(() => { FORUM.echoue.push("10"); })()`);
    expect(
      await lire<Promise<string>>(
        `PartageChasses.charger().then(() => "lu", (e) => "échec : " + e.message)`,
      ),
    ).toBe("échec : forum");
  });

  test("pas de sujet commun d'un type dans la section : l'affichage échoue sans rien lire, noté au journal", async () => {
    preparer();
    lire(`(() => { FORUM.sujets = FORUM.sujets.filter((s) => s.id != "11"); })()`);
    expect(
      await lire<Promise<string>>(
        `PartageChasses.charger().then(() => "lu", (e) => e.message + " : " + e.titre)`,
      ),
    ).toBe(`sans sujet commun : ${COMMUN_C}`);
    expect(ordre()).toEqual(["callGetForum"]);
    expect(notes()).toContain(`pas de sujet « ${COMMUN_C} » dans la section : partages illisibles`);
  });

  test("chasses seules d'un joueur : seul le sujet commun des chasses est lu", async () => {
    preparer();
    await charger(`["Alpha"], false`);
    expect(ordre()).toEqual(["callGetForum", "callGetTopic 11"]);
  });

  test("sujet sur plusieurs pages (jamais vu) : noté au journal, les réponses de la première lues", async () => {
    preparer();
    lire(`(() => {
      const html = SIM.html;
      SIM.html = (s, moi) => html(s, moi) + '<a href="#" onclick="xajax_callGetTopic(10, 2); return false;">2</a>';
      FORUM.restaurer = () => (SIM.html = html);
    })()`);
    const d = await charger();
    lire(`FORUM.restaurer()`);
    expect(d.floods.map((f: any) => f.id)).toEqual([21]);
    expect(notes()).toContain(
      `« ${COMMUN_F} » : sujet sur plusieurs pages, seules les réponses de la première sont lues`,
    );
  });
});

describe("écriture de ma réponse", () => {
  const A2 = flood("2026-11-14 13:40", "Delta", 12);
  const A3 = flood("2026-11-14 13:50", "Delta", 13);
  /** Partage de floods : nombre de floods nouveaux, ou le code de l'erreur. */
  const partager = (entrees: any[]) =>
    lire<Promise<number | string>>(
      `PartageChasses._partager("Floods", ${JSON.stringify(entrees)}).then((n) => n, (e) => "échec : " + e.message)`,
    );
  const mesFloods = () =>
    lire<number[]>(
      `(() => { const r = PartageChasses.reponses(PartageChasses.messages(SIM.html(FORUM.sujets.find((s) => s.id == "10"), "Alpha"))).alpha;
        return r ? r.floods.map((f) => f.id).sort((a, b) => a - b) : []; })()`,
    );

  test("premier partage : ma réponse postée, vérifiée dans la réponse du forum sans relecture ; premier message et réponse de Beta intacts", async () => {
    preparer();
    const premier = sujet("10").texte;
    expect(await partager([A1, A2])).toBe(2);
    expect(ordre()).toEqual(["callGetForum", "callGetTopic 10", "envoiNouveauMessage"]);
    expect(reponses("10")).toEqual([
      ["Beta", ligne("Floods", B1)],
      // la plus tardive d'abord
      ["Alpha", [ligne("Floods", A2), ligne("Floods", A1)].join("\n")],
    ]);
    expect(sujet("10").texte).toBe(premier);
  });

  test("partage suivant : ma réponse modifiée (son numéro), mes lignes fusionnées sans doublon", async () => {
    preparer();
    await partager([A1]);
    const id = lire<number>(`FORUM.sujets.find((s) => s.id == "10").reponses[1].id`);
    lire(`(() => { FORUM.ordre.length = 0; })()`);
    expect(await partager([A1, A3])).toBe(1);
    expect(ordre()).toEqual(["callGetForum", "callGetTopic 10", "envoiEditMessage"]);
    expect(reponses("10").length).toBe(2);
    expect(lire<number>(`FORUM.sujets.find((s) => s.id == "10").reponses[1].id`)).toBe(id);
    expect(mesFloods()).toEqual([11, 13]);
  });

  test("ma réponse suivie de celles d'autres joueurs : modifiée en place, jamais une deuxième", async () => {
    preparer();
    await partager([A1]);
    lire(
      `(() => { FORUM.sujets.find((s) => s.id == "10").reponses.push({ id: 900, auteur: "Gamma", texte: "g" }); })()`,
    );
    expect(await partager([A2])).toBe(1);
    expect(reponses("10").map((r) => r[0])).toEqual(["Beta", "Alpha", "Gamma"]);
    expect(mesFloods()).toEqual([11, 12]);
  });

  test("Beta partage : seule sa réponse change", async () => {
    preparer();
    await partager([A1]);
    const alpha = reponses("10")[1];
    lire(`(() => { monProfil.pseudo = "Beta"; })()`);
    expect(await partager([flood("2026-11-14 13:20", "Alpha", 22)])).toBe(1);
    expect(reponses("10")[1]).toEqual(alpha);
    expect(reponses("10")[0]?.[1]).toContain("#22");
  });

  test("rien de nouveau à partager : ni écriture ni relecture", async () => {
    preparer();
    await partager([A1]);
    lire(`(() => { FORUM.ordre.length = 0; })()`);
    expect(await partager([A1])).toBe(0);
    expect(ordre()).toEqual(["callGetForum", "callGetTopic 10"]);
  });

  test("floods arrivés : vers mon historique, puis ma réponse relue avant l'écriture", async () => {
    preparer();
    await partager([A1, PASSE]);
    // PASSE (11:00) est déjà passé : jamais écrit dans la réponse, mis dans l'historique
    expect(
      lire<string>(`FORUM.sujets.find((s) => s.titre == "Historique Floods 1 | Alpha").texte`),
    ).toBe(ligne("Floods", PASSE));
    expect(mesFloods()).toEqual([11]);
    regler("2026-11-14 13:05:00");
    lire(`(() => { FORUM.ordre.length = 0; })()`);
    expect(await partager([A2])).toBe(1);
    expect(mesFloods()).toEqual([12]);
    const o = ordre();
    expect(o.slice(0, 2)).toEqual(["callGetForum", "callGetTopic 10"]);
    expect(o.slice(-2)).toEqual(["callGetTopic 10", "envoiEditMessage"]);
  });

  test("historique pas écrit et rien de nouveau : les floods arrivés restent, rien n'est écrit", async () => {
    preparer();
    await partager([A1]);
    regler("2026-11-14 13:05:00");
    lire(
      `(() => { FORUM.historiqueEchoue = true; FORUM.ordre.length = 0; console.warn = () => {}; })()`,
    );
    expect(await partager([A1])).toBe(0);
    expect(ordre().filter((o) => /^envoi(Edit|Nouveau)Message/.test(o))).toEqual([]);
    expect(mesFloods()).toEqual([11]);
  });

  test("tout retiré : « Aucun flood en cours. » ; puis plus de réponse à créer pour rien", async () => {
    preparer();
    await partager([A1]);
    expect(
      await lire<Promise<any>>(
        `PartageChasses._modifierMessage("Floods", (anciennes) => anciennes.filter((e) => e.id != 11))`,
      ),
    ).toEqual([]);
    expect(reponses("10")[1]).toEqual(["Alpha", "Aucun flood en cours."]);
    // Gamma, sans réponse, retire un flood qu'il n'a pas partagé : rien n'est posté
    lire(`(() => { monProfil.pseudo = "Gamma"; FORUM.ordre.length = 0; })()`);
    await lire(`PartageChasses._modifierMessage("Floods", () => [])`);
    expect(ordre().filter((o) => /^envoi/.test(o))).toEqual([]);
  });

  test("écriture refusée par le forum (grade) : réponse du forum sans mon changement, sujet relu une fois, erreur", async () => {
    preparer();
    lire(`(() => { FORUM.refuse = ["envoiNouveauMessage"]; })()`);
    expect(await partager([A1])).toBe("échec : refusée");
    expect(ordre()).toEqual([
      "callGetForum",
      "callGetTopic 10",
      "envoiNouveauMessage",
      "callGetTopic 10",
    ]);
    expect(notes()).toContain(`« ${COMMUN_F} » : ma réponse n'a pas été écrite (refusée)`);
  });

  test("réponse du forum sans le sujet : relu une fois, l'écriture est prise", async () => {
    preparer();
    lire(`(() => { FORUM.reponseVide = true; })()`);
    expect(await partager([A1])).toBe(1);
    expect(ordre().slice(-2)).toEqual(["envoiNouveauMessage", "callGetTopic 10"]);
  });

  test("pas de sujet commun : ni lu ni écrit", async () => {
    preparer();
    lire(`(() => { FORUM.sujets = FORUM.sujets.filter((s) => s.id != "10"); })()`);
    expect(await partager([A1])).toBe("échec : sans sujet commun");
    expect(ordre()).toEqual(["callGetForum"]);
  });

  test("réponse trop longue pour un message : rien n'est écrit", async () => {
    preparer();
    const long = Array.from({ length: 100 }, (_, i) =>
      flood("2026-11-14 13:00", "C" + "x".repeat(400), 1000 + i),
    );
    expect(await partager(long)).toBe("échec : trop long");
    expect(ordre().filter((o) => /^envoi/.test(o))).toEqual([]);
  });

  test("plus de 100 floods à venir : les 100 plus proches partagés, comptés ; noté au journal", async () => {
    preparer();
    const beaucoup = Array.from({ length: 105 }, (_, i) =>
      flood(
        lire<string>(
          `moment("2026-11-14 14:00", "YYYY-MM-DD HH:mm").add(${i}, "minutes").format("YYYY-MM-DD HH:mm")`,
        ),
        "Cible",
        100 + i,
      ),
    );
    await partager([A1]);
    // A1 (13:00) et les 99 premiers : les 6 derniers restent hors du forum
    expect(await partager(beaucoup)).toBe(99);
    const ids = mesFloods();
    expect([ids.length, ids[0], ids[ids.length - 1]]).toEqual([100, 11, 198]);
    expect(notes()).toContain("106 floods à venir : les 100 plus proches partagés");
  });

  test("deux partages d'une page : l'un après l'autre, le second lit ce que le premier a écrit", async () => {
    preparer();
    const p1 = lire<Promise<number>>(
      `PartageChasses.enFile(() => PartageChasses._partager("Floods", [${JSON.stringify(A2)}]))`,
    );
    const p2 = lire<Promise<number>>(
      `PartageChasses.enFile(() => PartageChasses._partager("Floods", [${JSON.stringify(A3)}]))`,
    );
    expect([await p1, await p2]).toEqual([1, 1]);
    expect(ordre().filter((o) => o != "callGetForum")).toEqual([
      "callGetTopic 10",
      "envoiNouveauMessage",
      "callGetTopic 10",
      "envoiEditMessage",
    ]);
    expect(mesFloods()).toEqual([12, 13]);
  });

  test("après mon écriture, l'affichage relit le sujet : la lecture gardée d'avant est oubliée", async () => {
    preparer();
    lire(`(() => { PartageChasses.oublierCache(); })()`);
    await lire(`PartageChasses.charger()`);
    await partager([A1]);
    lire(`(() => { FORUM.ordre.length = 0; })()`);
    const d = await lire<Promise<any>>(
      `PartageChasses.charger().then((d) => JSON.parse(JSON.stringify(d)))`,
    );
    expect(ordre()).toContain("callGetTopic 10");
    expect(d.floods.map((f: any) => [f.lanceur, f.id])).toEqual([
      ["Alpha", 11],
      ["Beta", 21],
    ]);
  });

  test("lignes écrites relues à l'identique : flood avec unités, sans unités, au dôme, avec TdC ; chasse", () => {
    const entrees: [string, any][] = [
      [
        "Floods",
        { date: "2026-11-13 23:00", cible: "Gamma", unites: 12345, terrain: 6789, id: 11 },
      ],
      ["Floods", { date: "2026-11-13 23:01", cible: "Gamma", terrain: 6789 }],
      ["Floods", { date: "2026-11-13 23:02", cible: "Gamma", lieu: "Dôme", unites: 500, id: 12 }],
      [
        "Floods",
        {
          date: "2026-11-13 23:03",
          cible: "Gamma",
          unites: 1,
          terrain: 2,
          tdcCible: 345678,
          id: 13,
        },
      ],
      ["Chasses", { date: "2026-11-13 23:04", terrain: 1500000 }],
    ];
    for (const [type, e] of entrees) {
      const l = ligne(type, e);
      const relue = lire<string>(
        `(() => { const d = PartageChasses.lireEntrees(${JSON.stringify(l)}); return PartageChasses._ligne(${JSON.stringify(type)}, (${JSON.stringify(type)} == "Chasses" ? d.chasses : d.floods)[0]); })()`,
      );
      expect(relue).toBe(l);
    }
  });
});

describe("« Ranger le forum » (mainteneur) : les anciens formats retirés", () => {
  const ranger = () =>
    lire<Promise<string>>(
      `(() => { window.ETATS = []; return PartageChasses.rangerForum((t) => ETATS.push(t)); })()`,
    );
  const historique = (pseudo: string) =>
    lire<string | null>(
      `(() => { const s = FORUM.sujets.find((s) => s.titre == "Historique Floods 1 | " + ${JSON.stringify(pseudo)}); return s ? s.texte : null; })()`,
    );

  test("premiers messages vidés (texte d'en-tête gardé), entrées passées dans l'historique, anciens sujets supprimés en une fois ; réponses et convois gardés ; bilan", async () => {
    preparer();
    const bilan = await ranger();
    expect(bilan).toBe(
      `« ${COMMUN_F} » : 2 sections de l'ancien format retirées, 1 entrée passée ajoutée à l'historique de leur joueur. « ${COMMUN_C} » : premier message déjà rangé. Anciens sujets : 3 supprimés.`,
    );
    expect(sujet("10").texte).toBe("NE RIEN ÉCRIRE ICI");
    // titre et case « modifiable » réécrits comme avant
    expect(lire<any>(`FORUM.premiers.find((p) => p.id == "10")`)).toMatchObject({
      sujet: COMMUN_F,
      modifiable: true,
    });
    expect(reponses("10")).toEqual([["Beta", ligne("Floods", B1)]]);
    // PASSE : dans la section d'Alpha et dans son ancien sujet, une seule fois dans son historique
    expect(historique("Alpha")).toBe(ligne("Floods", PASSE));
    expect(lire(`FORUM.suppressions`)).toEqual([["1", "2", "3"]]);
    expect(titres()).toEqual([
      "Convois | Alpha",
      COMMUN_F,
      COMMUN_C,
      "Historique Floods 1 | Alpha",
    ]);
    expect(notes()).toContain("Anciens sujets : 3 supprimés.");
    // l'affichage n'en voit rien : seule la réponse de Beta compte
    const d = await charger();
    expect(d.floods.map((f: any) => [f.lanceur, f.id])).toEqual([["Beta", 21]]);
  });

  test("premier message sans texte d'en-tête : le texte par défaut", async () => {
    preparer();
    lire(
      `(() => { const s = FORUM.sujets.find((s) => s.id == "10"); s.texte = s.texte.replace("NE RIEN ÉCRIRE ICI\\n", ""); })()`,
    );
    await ranger();
    expect(sujet("10").texte).toBe(
      "Une réponse par joueur, écrite et modifiée par son Extension OUAF. NE RIEN ÉCRIRE ICI.",
    );
  });

  test("historique pas écrit : sections et anciens sujets gardés, le bilan le dit", async () => {
    preparer();
    lire(`(() => { FORUM.historiqueEchoue = true; console.warn = () => {}; })()`);
    const bilan = await ranger();
    expect(bilan).toBe(
      `« ${COMMUN_F} » : 1 section de l'ancien format retirée, 0 entrée passée ajoutée à l'historique de leur joueur, 1 gardée (historique du joueur pas écrit). « ${COMMUN_C} » : premier message déjà rangé. Anciens sujets : 2 supprimés, 1 gardé (historique du joueur pas écrit).`,
    );
    // la section d'Alpha (une entrée passée) reste ; celle de Gamma (rien de passé) part
    const lu = lire<any>(`PartageChasses.sections(${JSON.stringify(sujet("10").texte)})`);
    expect(lu.sections.map((s: any) => s.pseudo)).toEqual(["Alpha"]);
    expect(titres()).toContain("Floods | Alpha");
  });

  test("suppression refusée par le forum (droits de gestion) : vue à la relecture de la liste", async () => {
    preparer();
    lire(`(() => { FORUM.refuseSuppression = true; })()`);
    expect(await ranger()).toEndWith(
      "Anciens sujets : 0 supprimé, 3 pas supprimés : le forum les montre encore (droits de gestion du forum ?).",
    );
  });

  test("premier message pas modifié (droits de la section) : le bilan le dit", async () => {
    preparer();
    lire(`(() => { FORUM.refuse = ["envoiEditTopic"]; })()`);
    expect(await ranger()).toStartWith(
      `« ${COMMUN_F} » : premier message pas modifié (droits de la section ?), réessaie plus tard.`,
    );
  });

  test("ancien sujet illisible : gardé, jamais supprimé", async () => {
    preparer();
    lire(`(() => { FORUM.echoue.push("2"); })()`);
    expect(await ranger()).toEndWith("Anciens sujets : 2 supprimés, 1 gardé (sujet illisible).");
    expect(lire(`FORUM.suppressions`)).toEqual([["1", "3"]]);
  });

  test("tout est déjà rangé : rien n'est écrit ni supprimé", async () => {
    preparer();
    await ranger();
    lire(`(() => { FORUM.premiers.length = 0; FORUM.suppressions.length = 0; })()`);
    expect(await ranger()).toBe(
      `« ${COMMUN_F} » : premier message déjà rangé. « ${COMMUN_C} » : premier message déjà rangé. Aucun ancien sujet « Floods | … » ou « Chasses | … » à supprimer.`,
    );
    expect(lire(`[FORUM.premiers.length, FORUM.suppressions.length]`)).toEqual([0, 0]);
  });

  test("pas de sujet commun : le bilan le dit, les anciens sujets sont quand même supprimés", async () => {
    preparer();
    lire(`(() => { FORUM.sujets = FORUM.sujets.filter((s) => !["10", "11"].includes(s.id)); })()`);
    expect(await ranger()).toBe(
      `Aucun sujet « ${COMMUN_F} » ni « ${COMMUN_C} » dans la section. Anciens sujets : 3 supprimés.`,
    );
  });
});
