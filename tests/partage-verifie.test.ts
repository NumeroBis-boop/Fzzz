import { beforeEach, describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Partage des chasses et des floods : le forum ne signale pas une écriture
 * refusée (grade sans droit d'écrire dans la section, premier message bloqué
 * par une réponse). Après l'écriture, le forum est relu : sujet créé absent de
 * la liste, ou entrées absentes du sujet modifié, le joueur est prévenu en
 * rouge au lieu d'un succès (1.100.1, joueur sans sujet après « partagé »).
 */
const page = creerPage(
  ["js/class/Utils.js", "js/page/PartageChasses.js"],
  `var Horloge = { serveur: () => moment("2026-11-10 10:00", "YYYY-MM-DD HH:mm"), maintenant: () => moment("2026-11-10 10:00", "YYYY-MM-DD HH:mm").valueOf() };
   var monProfil = { pseudo: "LabraDrungor" };
   var TOAST_INFO = { t: "info" }, TOAST_ERROR = { t: "erreur" }, TOAST_SUCCESS = { t: "succes" };
   var NOM_EXTENSION = "Extension OUAF";
   var AttaqueLancee = { majPartages() {}, oublierPartage(ids) { OUBLIES.push(...ids); } };`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);

// forum simulé : la section 7, ses sujets ; `refuse` : écriture acceptée par
// le jeu sans effet (comme un grade sans droit d'écriture)
beforeEach(() => {
  lire(`(() => {
    localStorage.clear();
    console.warn = () => {};
    window.TOASTS = []; window.OUBLIES = [];
    $.toast = (o) => TOASTS.push(o);
    window.FORUM = { sections: ["BDD partagée cachée"], sujets: [], appels: [], prochain: 500, refuse: () => false, illisible: false };
    PartageChasses.idSection = null;
    PartageChasses._html = (d) => d;
    const q = (args, k) => { const m = new RegExp("[&>]" + k + "=([^&<]*)").exec(args); return m ? decodeURIComponent(m[1]) : null; };
    PartageChasses._xajax = (f, args) => {
      FORUM.appels.push(f + (args === undefined ? " sections" : ""));
      if (FORUM.illisible) return Promise.reject(new Error("réseau"));
      if (f == "callGetForum" && args === undefined)
        return Promise.resolve(FORUM.sections.map((s, i) => '<span class="forum' + (7 + i) + '">' + s + "</span>").join(""));
      if (f == "callGetForum")
        return Promise.resolve('<form id="form_cat"><table>' + FORUM.sujets.map((s) => '<tr><td><input name="topic[]" value="' + s.id + '"/></td><td>' + s.titre + '</td></tr>').join("") + '</table></form>');
      if (f == "callGetTopic") {
        const s = FORUM.sujets.find((s) => s.id == args);
        return Promise.resolve(s ? s.messages.map((m) => '<div class="messageForum">' + m.replace(/\\n/g, "<br/>") + "</div>").join("") : "");
      }
      if (FORUM.refuse(f)) return Promise.resolve("");
      if (f == "envoiNouveauSujet")
        FORUM.sujets.push({ id: String(FORUM.prochain++), titre: q(args, "sujet"), messages: [q(args, "message")] });
      if (f == "envoiEditTopic") FORUM.sujets.find((s) => s.id == q(args, "IDTopic")).messages[0] = q(args, "message");
      return Promise.resolve("");
    };
  })()`);
});

const CHASSE = { date: "2026-11-10 12:00", terrain: 25000 };
const FLOOD = {
  date: "2026-11-10 12:30",
  cible: "Bravo",
  unites: 3000,
  terrain: 3000,
  tdcCible: null,
  id: 13,
};
const partager = async (type: "Chasses" | "Floods", entree: object) => {
  await lire(
    `PartageChasses._avecBouton(null, ${JSON.stringify(type)}, [${JSON.stringify(entree)}])`,
  );
  return lire<{ t: string; text: string }[]>(`TOASTS.map((o) => ({ t: o.t, text: o.text }))`);
};

describe("sujet à créer (premier partage)", () => {
  test("créé : relecture de la liste, succès", async () => {
    const toasts = await partager("Chasses", CHASSE);
    expect(lire(`FORUM.appels`)).toEqual([
      "callGetForum sections",
      "callGetForum",
      "envoiNouveauSujet",
      "callGetForum",
    ]);
    expect(toasts.map((t) => t.t)).toEqual(["succes"]);
    expect(toasts[0]?.text).toStartWith("1 chasse partagée avec la ");
  });

  test("création refusée en silence : erreur en rouge, aucun succès", async () => {
    lire(`FORUM.refuse = (f) => f == "envoiNouveauSujet"`);
    const toasts = await partager("Chasses", CHASSE);
    expect(toasts).toEqual([
      {
        t: "erreur",
        text: "Partage non enregistré : le sujet « Chasses | LabraDrungor » n'apparaît pas dans le forum après l'envoi. Ton grade n'a peut-être pas le droit d'écrire dans la section « BDD partagée cachée » : demande à un chef.",
      },
    ]);
  });
});

describe("sujet existant", () => {
  const existant = (titre: string, message: string) =>
    lire(
      `FORUM.sujets.push({ id: "40", titre: ${JSON.stringify(titre)}, messages: [${JSON.stringify(message)}] })`,
    );

  test("modifié : relecture du sujet, succès", async () => {
    existant("Chasses | LabraDrungor", "10/11/26 11:00 | 20 000 cm²");
    const toasts = await partager("Chasses", CHASSE);
    expect(lire(`FORUM.appels`)).toEqual([
      "callGetForum sections",
      "callGetForum",
      "callGetTopic",
      "envoiEditTopic",
      "callGetTopic",
    ]);
    expect(toasts.map((t) => t.t)).toEqual(["succes"]);
  });

  test("modification refusée en silence (réponse dans le sujet) : erreur en rouge", async () => {
    existant("Floods | LabraDrungor", "10/11/26 11:00 | Bravo | 1 000 unités | 1 000 cm² | #12");
    lire(`FORUM.refuse = (f) => f == "envoiEditTopic"`);
    const toasts = await partager("Floods", FLOOD);
    expect(toasts).toEqual([
      {
        t: "erreur",
        text: "Partage non enregistré : le sujet « Floods | LabraDrungor » n'a pas été modifié. Si quelqu'un y a répondu, son premier message n'est plus modifiable (un chef peut supprimer la réponse) ; sinon, ton grade n'a peut-être pas le droit d'y écrire : demande à un chef.",
      },
    ]);
  });

  test("rien de nouveau : ni écriture ni relecture", async () => {
    existant("Chasses | LabraDrungor", "10/11/26 12:00 | 25 000 cm²");
    const toasts = await partager("Chasses", CHASSE);
    expect(lire(`FORUM.appels`)).toEqual(["callGetForum sections", "callGetForum", "callGetTopic"]);
    expect(toasts.map((t) => t.text)).toEqual(["Ces chasses étaient déjà partagées."]);
  });
});

describe("section introuvable", () => {
  test("inexistante ou cachée au grade : le message le dit", async () => {
    lire(`FORUM.sections = ["Discussions"]`);
    const toasts = await partager("Chasses", CHASSE);
    expect(toasts).toEqual([
      {
        t: "erreur",
        text: "Section « BDD partagée cachée » introuvable : elle n'existe pas encore, ou ton grade ne la voit pas. Demande à un chef.",
      },
    ]);
  });
});

describe("floods marqués « à partager » (Flooder + partager)", () => {
  test("refus du forum : plus repris à chaque page", async () => {
    lire(`FORUM.refuse = (f) => f == "envoiNouveauSujet"`);
    await partager("Floods", FLOOD);
    expect(lire(`OUBLIES`)).toEqual([13]);
    lire(
      `OUBLIES = []; FORUM.refuse = () => false; FORUM.sections = ["Discussions"]; PartageChasses.idSection = null`,
    );
    await partager("Floods", FLOOD);
    expect(lire(`OUBLIES`)).toEqual([13]);
  });

  test("forum injoignable : repris à la page suivante", async () => {
    lire(`FORUM.illisible = true`);
    const toasts = await partager("Floods", FLOOD);
    expect(lire(`OUBLIES`)).toEqual([]);
    expect(toasts.map((t) => t.text)).toEqual([
      "Partage impossible : le forum de l'alliance n'a pas pu être lu ou modifié.",
    ]);
  });
});
