import { beforeEach, describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";
import { FORUM_SIMULE } from "./forum-simule";

/**
 * Le suivi ne garde que les entrées en cours : la réponse de chaque joueur
 * dans les sujets communs « BDD générale … », le premier message de
 * « Convois | pseudo ». Les entrées passées sont seulement retirées, sans
 * historique (règles du mainteneur : convois 1.97.2, floods 15/11/2026,
 * chasses 19/11/2026) ; les pages « Historique … » d'avant ne sont ni lues ni
 * modifiées.
 */
const page = creerPage(
  ["js/class/Utils.js", "js/page/PartageChasses.js", "js/page/ConvoisForum.js"],
  `var Horloge = { serveur: () => moment("2026-10-29 10:00", "YYYY-MM-DD HH:mm"), maintenant: () => moment("2026-10-29 10:00", "YYYY-MM-DD HH:mm").valueOf() };
   var monProfil = { pseudo: "DoggyBag" };
   var TOAST_INFO = {}, TOAST_ERROR = {}, TOAST_SUCCESS = {};
   var OUAF_ECART_ARRIVEE = 120000;`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);
lire(FORUM_SIMULE);

// forum simulé : sujets {id, titre, messages: [premier message], reponses}, appels xajax notés dans l'ordre
beforeEach(() => {
  lire(`(() => {
    localStorage.clear();
    console.warn = () => {};
    $.toast = () => ({});
    window.FORUM = { sujets: [], appels: [], prochain: 500, echoue: null };
    PartageChasses.idSection = "7";
    PartageChasses._html = (d) => d;
    const q = SIM.q;
    PartageChasses._xajax = (f, args) => {
      FORUM.appels.push(f + (f.startsWith("envoi") && q(args, "sujet") ? " " + q(args, "sujet") : ""));
      if (FORUM.echoue && FORUM.echoue(f, args)) return Promise.reject(new Error("forum"));
      if (f == "callGetForum")
        return Promise.resolve('<form id="form_cat"><table>' + FORUM.sujets.map((s) => '<tr><td><input name="topic[]" value="' + s.id + '"/></td><td>' + s.titre + '</td></tr>').join("") + '</table></form>');
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
      return SIM.traiter(FORUM.sujets, f, args, monProfil.pseudo) || Promise.resolve("");
    };
  })()`);
});
/** Sujet : son premier message, puis des réponses d'« Intrus ». */
const sujet = (id: string, titre: string, premier: string, ...suite: string[]) =>
  lire(
    `FORUM.sujets.push(${JSON.stringify({ id, titre, messages: [premier], reponses: suite.map((texte, i) => ({ id: 900 + i, auteur: "Intrus", texte })) })})`,
  );
const message = (titre: string) =>
  lire<string | null>(
    `(FORUM.sujets.find((s) => s.titre == ${JSON.stringify(titre)}) || { messages: [null] }).messages[0]`,
  );
const FLOODS = "BDD générale flood - NE RIEN ÉCRIRE";
const CHASSES = "BDD générale chasse - NE RIEN ÉCRIRE";
/** Sujet commun du type, avec ma réponse (ses lignes) puis celles d'« Intrus ». */
const commun = (type: "Floods" | "Chasses", lignes: string[] | null, ...suite: string[]) =>
  lire(
    `FORUM.sujets.push(${JSON.stringify({
      id: type == "Floods" ? "10" : "11",
      titre: type == "Floods" ? FLOODS : CHASSES,
      messages: [""],
      reponses: [
        ...(lignes ? [{ id: 700, auteur: "DoggyBag", texte: lignes.join("\n") }] : []),
        ...suite.map((texte, i) => ({ id: 900 + i, auteur: "Intrus", texte })),
      ],
    })})`,
  );
/** Texte de ma réponse dans le sujet commun du type, ou null sans réponse. */
const maReponse = (type: "Floods" | "Chasses") =>
  lire<string | null>(`(() => {
    const r = (FORUM.sujets.find((s) => s.id == ${JSON.stringify(type == "Floods" ? "10" : "11")}).reponses || []).find((r) => r.auteur == "DoggyBag");
    return r ? r.texte : null;
  })()`);

const PASSE = "29/10/26 09:00 | Bravo | 1 000 unités | 1 000 cm² | #11";
const A_VENIR = "29/10/26 12:00 | Bravo | 2 000 unités | 2 000 cm² | #12";
const NOUVEAU = {
  date: "2026-10-29 13:00",
  cible: "Bravo",
  unites: 3000,
  terrain: 3000,
  tdcCible: null,
  id: 13,
};
const partager = () =>
  lire<Promise<number>>(`PartageChasses._partager("Floods", [${JSON.stringify(NOUVEAU)}])`);

describe("suivi : réponses des joueurs dans les sujets communs, premier message des anciens sujets de convois", () => {
  test("sujet commun : la réponse de chaque joueur est lue ; ancien sujet des convois : jamais ses réponses", async () => {
    commun("Floods", [A_VENIR], "29/10/26 14:00 | Bravo | 9 unités | 9 cm² | #99");
    commun("Chasses", null);
    const r = await lire<Promise<any>>(`PartageChasses.charger()`);
    expect(r.floods.map((f: any) => [f.lanceur, f.id])).toEqual([
      ["DoggyBag", 12],
      ["Intrus", 99],
    ]);
    sujet(
      "2",
      "Convois | DoggyBag",
      "29/10/26 12:00 | Bravo | 1 000 | #5",
      "29/10/26 13:00 | Bravo | 9 | #9",
    );
    // sujet commun des convois : ma réponse seulement, jamais son premier message
    sujet(
      "3",
      "BDD générale convoi - NE RIEN ÉCRIRE",
      "29/10/26 12:00 | Bravo | 1 pommes | 1 bois | #8 | prévu 1 | avance 1",
      "29/10/26 12:00 | Bravo | 2 pommes | 2 bois | #10 | prévu 2 | avance 2",
    );
    const c = await lire<Promise<any[]>>(`ConvoisForum.notes()`);
    expect(c.map((x) => x.id)).toEqual([5]);
  });

  test("pages d'historique repérées à part, jamais prises pour un sujet de suivi", async () => {
    sujet("1", "Floods | DoggyBag", A_VENIR);
    sujet("2", "Historique Floods 1 | DoggyBag", PASSE);
    sujet("3", "Historique Convois 2 | DoggyBag", "x");
    sujet("4", "Réglages de l'extension", "Journal : Alpha");
    const s = await lire<Promise<any>>(`PartageChasses.sujets()`);
    expect(s.reglages).toBe("4");
    // ancien sujet de suivi des floods : plus lu, les floods sont dans le sujet commun
    expect(s["Floods | doggybag"]).toBeUndefined();
    expect(s.historiques).toEqual([{ type: "Floods", page: 1, pseudo: "DoggyBag", id: "2" }]);
    // ancien historique des convois (avant 1.97.2) : ignoré
    expect(s["Convois | doggybag"]).toBeUndefined();
  });
});

describe("floods arrivés : retirés, sans historique", () => {
  test("partage : le flood passé quitte ma réponse ; ni page d'historique, ni relecture avant l'écriture", async () => {
    commun("Floods", [A_VENIR, PASSE]);
    expect(await partager()).toBe(1);
    expect(lire(`FORUM.appels`)).toEqual(["callGetForum", "callGetTopic", "envoiEditMessage"]);
    expect(message("Historique Floods 1 | DoggyBag")).toBeNull();
    expect(maReponse("Floods")).toBe(
      `29/10/26 13:00 | Bravo | 3 000 unités | 3 000 cm² | #13\n${A_VENIR}`,
    );
  });

  test("une page « Historique Floods » d'avant n'est ni lue ni modifiée", async () => {
    const autre = "29/10/26 08:00 | Calme | 500 unités | 500 cm² | #10";
    commun("Floods", [A_VENIR, PASSE]);
    sujet("2", "Historique Floods 1 | DoggyBag", autre);
    await partager();
    expect(message("Historique Floods 1 | DoggyBag")).toBe(autre);
    expect(lire(`FORUM.appels`)).toEqual(["callGetForum", "callGetTopic", "envoiEditMessage"]);
    expect(maReponse("Floods")).not.toContain("#11");
  });

  test("flood annulé (à venir) et flood arrivé retirés, sans historique", async () => {
    commun("Floods", [A_VENIR, PASSE]);
    lire(`AttaqueLancee = { majPartages() {} };`);
    await lire(`PartageChasses._retirerFloods([12])`);
    expect(message("Historique Floods 1 | DoggyBag")).toBeNull();
    // plus rien à venir : un message ne peut pas être vide
    expect(maReponse("Floods")).toBe("Aucun flood en cours.");
  });
});

describe("chasses passées : retirées, sans historique", () => {
  const PASSEE = "29/10/26 09:00 | 1 000 cm²";
  const A_VENIR_C = "29/10/26 12:00 | 2 000 cm²";
  const partagerChasse = () =>
    lire<Promise<number>>(
      `PartageChasses._partager("Chasses", [{ date: "2026-10-29 13:00", terrain: 3000 }])`,
    );

  test("partage : la chasse passée quitte ma réponse ; ni page d'historique, ni relecture avant l'écriture", async () => {
    commun("Chasses", [A_VENIR_C, PASSEE]);
    expect(await partagerChasse()).toBe(1);
    expect(lire(`FORUM.appels`)).toEqual(["callGetForum", "callGetTopic", "envoiEditMessage"]);
    expect(message("Historique Chasses 1 | DoggyBag")).toBeNull();
    expect(maReponse("Chasses")).toBe(`29/10/26 13:00 | 3 000 cm²\n${A_VENIR_C}`);
  });

  test("une page « Historique Chasses » d'avant n'est ni lue ni modifiée", async () => {
    const autre = "29/10/26 08:00 | 500 cm²";
    commun("Chasses", [A_VENIR_C, PASSEE]);
    sujet("2", "Historique Chasses 1 | DoggyBag", autre);
    await partagerChasse();
    expect(message("Historique Chasses 1 | DoggyBag")).toBe(autre);
    expect(lire(`FORUM.appels`)).toEqual(["callGetForum", "callGetTopic", "envoiEditMessage"]);
    expect(maReponse("Chasses")).not.toContain("09:00");
  });
});

describe("chasses annulées, convois arrivés retirés", () => {
  test("chasses : la passée et l'annulée retirées, sans historique", async () => {
    commun("Chasses", ["29/10/26 12:00 | 20 000 cm²", "29/10/26 09:00 | 10 000 cm²"]);
    await lire(`PartageChasses.recalerChasses([])`);
    expect(message("Historique Chasses 1 | DoggyBag")).toBeNull();
    expect(lire<string[]>(`FORUM.appels`).filter((a) => a.startsWith("envoiNouveauSujet"))).toEqual(
      [],
    );
    expect(maReponse("Chasses")).toBe("Aucune chasse en cours.");
  });

  /** Sujet commun des convois avec ma réponse (ses lignes). */
  const convois = (lignes: string[]) =>
    lire(
      `FORUM.sujets.push(${JSON.stringify({
        id: "12",
        titre: "BDD générale convoi - NE RIEN ÉCRIRE",
        messages: [""],
        reponses: [{ id: 701, auteur: "DoggyBag", texte: lignes.join("\n") }],
      })})`,
    );
  const maReponseConvois = () =>
    lire<string>(
      `FORUM.sujets.find((s) => s.id == "12").reponses.find((r) => r.auteur == "DoggyBag").texte`,
    );

  test("convois : l'annulé et l'arrivé retirés de ma réponse, sans historique", async () => {
    convois([
      "29/10/26 12:00 | Bravo | 0 pommes | 2 000 bois | #6",
      "29/10/26 09:00 | Bravo | 0 pommes | 1 000 bois | #5 | prévu 600 | avance 400",
    ]);
    await lire(
      `ConvoisForum.retirer({ id: 6, vers: "Bravo", montant: 2000, arrivee: moment("2026-10-29 12:00", "YYYY-MM-DD HH:mm").valueOf() })`,
    );
    expect(maReponseConvois()).toBe("Aucun convoi en cours.");
    expect(lire(`FORUM.sujets.map((s) => s.titre)`)).toEqual([
      "BDD générale convoi - NE RIEN ÉCRIRE",
    ]);
  });

  test("convoi noté : les arrivés sortent de ma réponse ; un ancien historique des convois n'est ni lu ni modifié", async () => {
    convois(["29/10/26 09:00 | Bravo | 0 pommes | 1 000 bois | #5"]);
    sujet("2", "Historique Convois 1 | DoggyBag", "28/10/26 09:00 | Bravo | 500 | #4");
    await lire(
      `ConvoisForum.noter([{ id: 7, vers: "Bravo", nou: 0, mat: 3000, montant: 3000, prevu: 3000, avance: 0, arrivee: moment("2026-10-29 15:00", "YYYY-MM-DD HH:mm").valueOf() }])`,
    );
    expect(maReponseConvois()).toBe(
      "29/10/26 15:00 | Bravo | 0 pommes | 3 000 bois | #7 | prévu 3 000 | avance 0",
    );
    expect(message("Historique Convois 1 | DoggyBag")).toBe("28/10/26 09:00 | Bravo | 500 | #4");
    expect(lire(`FORUM.appels`)).toEqual(["callGetForum", "callGetTopic", "envoiEditMessage"]);
  });
});
