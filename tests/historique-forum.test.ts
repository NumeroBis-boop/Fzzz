import { beforeEach, describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Historique des actions passées (floods, chasses) dans des sujets à part,
 * « Historique <type> N | pseudo » : une réponse dans un sujet empêche de
 * modifier son premier message, le suivi ne peut donc pas garder un second
 * message. Le suivi ne lit que le premier message de ses sujets. Les convois
 * arrivés sont seulement retirés de leur sujet (1.97.2, règle du mainteneur).
 */
const page = creerPage(
  ["js/class/Utils.js", "js/page/PartageChasses.js", "js/page/ConvoisForum.js"],
  `var Horloge = { serveur: () => moment("2026-10-29 10:00", "YYYY-MM-DD HH:mm"), maintenant: () => moment("2026-10-29 10:00", "YYYY-MM-DD HH:mm").valueOf() };
   var monProfil = { pseudo: "DoggyBag" };
   var TOAST_INFO = {}, TOAST_ERROR = {}, TOAST_SUCCESS = {};
   var OUAF_ECART_ARRIVEE = 120000;`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);

// forum simulé : sujets {id, titre, messages}, appels xajax notés dans l'ordre
beforeEach(() => {
  lire(`(() => {
    localStorage.clear();
    console.warn = () => {};
    $.toast = () => ({});
    window.FORUM = { sujets: [], appels: [], prochain: 500, echoue: null };
    PartageChasses.idSection = "7";
    PartageChasses._html = (d) => d;
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
});
const sujet = (id: string, titre: string, ...messages: string[]) =>
  lire(`FORUM.sujets.push(${JSON.stringify({ id, titre, messages })})`);
const message = (titre: string) =>
  lire<string | null>(
    `(FORUM.sujets.find((s) => s.titre == ${JSON.stringify(titre)}) || { messages: [null] }).messages[0]`,
  );

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

describe("suivi : premier message seulement", () => {
  test("une réponse dans un sujet n'est jamais lue comme du suivi", async () => {
    sujet("1", "Floods | DoggyBag", A_VENIR, "29/10/26 14:00 | Bravo | 9 unités | 9 cm² | #99");
    const r = await lire<Promise<any>>(`PartageChasses.lireSujet("1")`);
    expect(r.floods.map((f: any) => f.id)).toEqual([12]);
    sujet(
      "2",
      "Convois | DoggyBag",
      "29/10/26 12:00 | Bravo | 1 000 | #5",
      "29/10/26 13:00 | Bravo | 9 | #9",
    );
    const c = await lire<Promise<any[]>>(`ConvoisForum._contenu("2")`);
    expect(c.map((x) => x.id)).toEqual([5]);
  });

  test("pages d'historique repérées à part, jamais prises pour un sujet de suivi", async () => {
    sujet("1", "Floods | DoggyBag", A_VENIR);
    sujet("2", "Historique Floods 1 | DoggyBag", PASSE);
    sujet("3", "Historique Convois 2 | DoggyBag", "x");
    sujet("4", "Export Google Sheet", "https://script.google.com/macros/s/x/exec");
    const s = await lire<Promise<any>>(`PartageChasses.sujets()`);
    expect(s.exportSheet).toBe("4");
    expect(s["Floods | doggybag"]).toBe("1");
    expect(s.liste.map((t: any) => t.id)).toEqual(["1"]);
    expect(s.historiques).toEqual([{ type: "Floods", page: 1, pseudo: "DoggyBag", id: "2" }]);
    // ancien historique des convois (avant 1.97.2) : ignoré
    expect(s["Convois | doggybag"]).toBeUndefined();
  });
});

describe("floods passés vers l'historique", () => {
  test("historique écrit d'abord, puis le sujet de suivi sans le flood passé", async () => {
    sujet("1", "Floods | DoggyBag", `${A_VENIR}\n${PASSE}`);
    expect(await partager()).toBe(1);
    expect(lire(`FORUM.appels`)).toEqual([
      "callGetForum",
      "callGetTopic",
      "envoiNouveauSujet Historique Floods 1 | DoggyBag",
      "envoiEditTopic Floods | DoggyBag",
      // relecture : le forum ne signale pas une écriture refusée
      "callGetTopic",
    ]);
    expect(message("Historique Floods 1 | DoggyBag")).toBe(PASSE);
    expect(message("Floods | DoggyBag")).toBe(
      `29/10/26 13:00 | Bravo | 3 000 unités | 3 000 cm² | #13\n${A_VENIR}`,
    );
  });

  test("page existante : ligne ajoutée à la suite, sans doublon lors d'un nouvel essai", async () => {
    const autre = "29/10/26 08:00 | Calme | 500 unités | 500 cm² | #10";
    sujet("1", "Floods | DoggyBag", `${A_VENIR}\n${PASSE}`);
    sujet("2", "Historique Floods 1 | DoggyBag", `${autre}\n${PASSE}`);
    await partager();
    expect(message("Historique Floods 1 | DoggyBag")).toBe(`${autre}\n${PASSE}`);
    expect(lire<string[]>(`FORUM.appels`)).not.toContain(
      "envoiEditTopic Historique Floods 1 | DoggyBag",
    );
    expect(message("Floods | DoggyBag")).not.toContain("#11");
  });

  test("page pleine : la suite part dans une nouvelle page", async () => {
    const plein = Array.from(
      { length: 300 },
      (_, i) => `28/10/26 08:00 | Calme | 500 unités | 500 cm² | #${1000 + i}`,
    ).join("\n");
    sujet("1", "Floods | DoggyBag", `${A_VENIR}\n${PASSE}`);
    sujet("2", "Historique Floods 1 | DoggyBag", plein);
    await partager();
    expect(message("Historique Floods 1 | DoggyBag")).toBe(plein);
    expect(message("Historique Floods 2 | DoggyBag")).toBe(PASSE);
  });

  test("historique impossible à écrire : le flood passé reste dans le suivi, repris ensuite", async () => {
    sujet("1", "Floods | DoggyBag", `${A_VENIR}\n${PASSE}`);
    lire(`FORUM.echoue = (f, args) => f == "envoiNouveauSujet";`);
    await partager();
    expect(message("Floods | DoggyBag")).toContain("#11");
    expect(message("Historique Floods 1 | DoggyBag")).toBeNull();
    lire(`FORUM.echoue = null;`);
    await partager();
    expect(message("Historique Floods 1 | DoggyBag")).toBe(PASSE);
    expect(message("Floods | DoggyBag")).not.toContain("#11");
  });

  test("flood annulé (à venir) retiré : pas dans l'historique ; flood arrivé : dedans", async () => {
    sujet("1", "Floods | DoggyBag", `${A_VENIR}\n${PASSE}`);
    lire(`AttaqueLancee = { majPartages() {} };`);
    await lire(`PartageChasses._retirerFloods([12], "DoggyBag", "Floods | DoggyBag")`);
    expect(message("Historique Floods 1 | DoggyBag")).toBe(PASSE);
    expect(message("Floods | DoggyBag")).toBe("Aucun flood en cours.");
  });
});

describe("chasses passées vers l'historique, convois arrivés retirés", () => {
  test("chasses : la passée part dans l'historique, l'annulée disparaît", async () => {
    sujet("1", "Chasses | DoggyBag", "29/10/26 12:00 | 20 000 cm²\n29/10/26 09:00 | 10 000 cm²");
    await lire(`PartageChasses.recalerChasses([])`);
    expect(message("Historique Chasses 1 | DoggyBag")).toBe("29/10/26 09:00 | 10 000 cm²");
    expect(message("Chasses | DoggyBag")).toBe("Aucune chasse en cours.");
  });

  test("convois : l'annulé et l'arrivé retirés du sujet, sans historique", async () => {
    sujet(
      "1",
      "Convois | DoggyBag",
      "29/10/26 12:00 | Bravo | 2 000 | #6\n29/10/26 09:00 | Bravo | 1 000 | #5 | prévu 600 | avance 400",
    );
    await lire(
      `ConvoisForum.retirer({ id: 6, vers: "Bravo", montant: 2000, arrivee: moment("2026-10-29 12:00", "YYYY-MM-DD HH:mm").valueOf() })`,
    );
    expect(message("Convois | DoggyBag")).toBe("");
    expect(lire(`FORUM.sujets.map((s) => s.titre)`)).toEqual(["Convois | DoggyBag"]);
  });

  test("convoi noté : les arrivés sortent du suivi ; un ancien historique des convois n'est ni lu ni modifié", async () => {
    sujet("1", "Convois | DoggyBag", "29/10/26 09:00 | Bravo | 1 000 | #5");
    sujet("2", "Historique Convois 1 | DoggyBag", "28/10/26 09:00 | Bravo | 500 | #4");
    await lire(
      `ConvoisForum.noter([{ id: 7, vers: "Bravo", montant: 3000, arrivee: moment("2026-10-29 15:00", "YYYY-MM-DD HH:mm").valueOf() }])`,
    );
    expect(message("Convois | DoggyBag")).toBe("29/10/26 15:00 | Bravo | 3 000 | #7");
    expect(message("Historique Convois 1 | DoggyBag")).toBe("28/10/26 09:00 | Bravo | 500 | #4");
    expect(lire(`FORUM.appels`)).toEqual([
      "callGetForum",
      "callGetTopic",
      "envoiEditTopic Convois | DoggyBag",
    ]);
  });
});
