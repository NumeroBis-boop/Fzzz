import { beforeEach, describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";
import { FORUM_SIMULE } from "./forum-simule";

/**
 * Partage des chasses et des floods dans la réponse du joueur des sujets
 * communs « BDD générale … » : le forum ne signale pas une écriture refusée
 * (grade sans droit d'écrire dans la section). Il répond par le sujet à jour :
 * sans le changement (après une relecture si sa réponse n'a pas le sujet), le
 * joueur est prévenu en rouge au lieu d'un succès (1.100.1, joueur sans sujet
 * après « partagé »).
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
lire(FORUM_SIMULE);
const FLOODS = "BDD générale flood - NE RIEN ÉCRIRE";
const CHASSES = "BDD générale chasse - NE RIEN ÉCRIRE";

// forum simulé : la section 7, ses sujets communs ; `refuse` : écriture
// acceptée par le jeu sans effet (grade sans droit)
beforeEach(() => {
  lire(`(() => {
    localStorage.clear();
    console.warn = () => {};
    window.TOASTS = []; window.OUBLIES = [];
    $.toast = (o) => TOASTS.push(o);
    window.FORUM = {
      sections: ["BDD partagée cachée"],
      sujets: [
        { id: "10", titre: ${JSON.stringify(FLOODS)}, messages: ["NE RIEN ÉCRIRE"] },
        { id: "11", titre: ${JSON.stringify(CHASSES)}, messages: ["NE RIEN ÉCRIRE"] },
      ],
      appels: [], refuse: () => false, illisible: false,
    };
    PartageChasses.idSection = null;
    PartageChasses._html = (d) => d;
    PartageChasses._xajax = (f, args) => {
      FORUM.appels.push(f + (args === undefined ? " sections" : ""));
      if (FORUM.illisible) return Promise.reject(new Error("réseau"));
      if (f == "callGetForum" && args === undefined)
        return Promise.resolve(FORUM.sections.map((s, i) => '<span class="forum' + (7 + i) + '">' + s + "</span>").join(""));
      if (f == "callGetForum")
        return Promise.resolve('<form id="form_cat"><table>' + FORUM.sujets.map((s) => '<tr><td><input name="topic[]" value="' + s.id + '"/></td><td>' + s.titre + '</td></tr>').join("") + '</table></form>');
      if (FORUM.refuse(f)) return Promise.resolve("");
      return SIM.traiter(FORUM.sujets, f, args, monProfil.pseudo) || Promise.resolve("");
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
/** Réponses d'un sujet commun : [auteur, texte]. */
const reponses = (id: string) =>
  lire<[string, string][]>(
    `(FORUM.sujets.find((s) => s.id == "${id}").reponses || []).map((r) => [r.auteur, r.texte])`,
  );

describe("partage dans ma réponse du sujet commun", () => {
  test("première réponse : postée après le premier message, vérifiée dans la réponse du forum, succès", async () => {
    const toasts = await partager("Chasses", CHASSE);
    // rien à archiver : le sujet lu sert à l'écriture ; la réponse du forum, sujet à jour, sert de vérification
    expect(lire(`FORUM.appels`)).toEqual([
      "callGetForum sections",
      "callGetForum",
      "callGetTopic",
      "envoiNouveauMessage",
    ]);
    expect(reponses("11")).toEqual([["LabraDrungor", "10/11/26 12:00 | 25 000 cm²"]]);
    expect(lire(`FORUM.sujets[1].messages[0]`)).toBe("NE RIEN ÉCRIRE");
    expect(toasts.map((t) => t.t)).toEqual(["succes"]);
    expect(toasts[0]?.text).toStartWith("1 chasse partagée avec la ");
  });

  test("réponses des autres joueurs gardées telles quelles ; la mienne fusionnée", async () => {
    lire(`FORUM.sujets[0].reponses = [
      { id: 5, auteur: "Alpha", texte: "10/11/26 13:00 | Charlie | 1 000 cm² | #5" },
      { id: 6, auteur: "LabraDrungor", texte: "10/11/26 11:00 | Bravo | 1 000 unités | 1 000 cm² | #12" },
    ]`);
    await partager("Floods", FLOOD);
    expect(lire(`FORUM.appels`)).toContain("envoiEditMessage");
    expect(reponses("10")).toEqual([
      ["Alpha", "10/11/26 13:00 | Charlie | 1 000 cm² | #5"],
      [
        "LabraDrungor",
        [
          "10/11/26 12:30 | Bravo | 3 000 unités | 3 000 cm² | #13",
          "10/11/26 11:00 | Bravo | 1 000 unités | 1 000 cm² | #12",
        ].join("\n"),
      ],
    ]);
  });

  test("écriture refusée en silence (grade) : sujet relu une fois, puis erreur en rouge", async () => {
    lire(`FORUM.refuse = (f) => f == "envoiNouveauMessage"`);
    const toasts = await partager("Floods", FLOOD);
    expect(lire<string[]>(`FORUM.appels.filter((a) => a == "envoiNouveauMessage")`).length).toBe(1);
    expect(lire<string[]>(`FORUM.appels.slice(-1)`)).toEqual(["callGetTopic"]);
    expect(toasts).toEqual([
      {
        t: "erreur",
        text: `Partage non enregistré : ta réponse dans le sujet « ${FLOODS} » n'a pas été écrite. Ton grade n'a peut-être pas le droit d'écrire dans la section « BDD partagée cachée » : demande à un chef.`,
      },
    ]);
  });

  test("pas de sujet commun : rien n'est écrit, l'erreur dit de le créer", async () => {
    lire(`FORUM.sujets = FORUM.sujets.filter((s) => s.id != "11")`);
    const toasts = await partager("Chasses", CHASSE);
    expect(lire<string[]>(`FORUM.appels`)).not.toContain("envoiNouveauMessage");
    expect(toasts).toEqual([
      {
        t: "erreur",
        text: `Partage impossible : pas de sujet « ${CHASSES} » dans la section « BDD partagée cachée » du forum. Demande à un chef de le créer.`,
      },
    ]);
  });

  test("réponse trop longue pour un message du forum : rien n'est écrit, erreur en rouge", async () => {
    const longs = Array.from({ length: 100 }, (_, i) => ({
      ...FLOOD,
      cible: "B" + "x".repeat(400),
      id: 100 + i,
    }));
    await lire(`PartageChasses._avecBouton(null, "Floods", ${JSON.stringify(longs)})`);
    expect(lire<string[]>(`FORUM.appels`)).not.toContain("envoiNouveauMessage");
    expect(lire<string[]>(`TOASTS.map((o) => o.text)`)).toEqual([
      `Partage non enregistré : ta réponse dans le sujet « ${FLOODS} » dépasserait la taille d'un message du forum.`,
    ]);
  });

  test("rien de nouveau : ni écriture ni relecture", async () => {
    lire(
      `FORUM.sujets[1].reponses = [{ id: 7, auteur: "LabraDrungor", texte: "10/11/26 12:00 | 25 000 cm²" }]`,
    );
    const toasts = await partager("Chasses", CHASSE);
    expect(lire(`FORUM.appels`)).toEqual(["callGetForum sections", "callGetForum", "callGetTopic"]);
    expect(toasts.map((t) => t.text)).toEqual(["Ces chasses étaient déjà partagées."]);
  });
});

describe("résultat rendu au bloc « Mes attaques en cours » (« Partagée ✓ », « Partager tous »)", () => {
  const fait = (type: "Chasses" | "Floods", entrees: object[]) =>
    lire<Promise<boolean>>(
      `PartageChasses._avecBouton(null, ${JSON.stringify(type)}, ${JSON.stringify(entrees)})`,
    );

  test("vrai : écrit dans le forum, ou déjà partagé", async () => {
    expect(await fait("Chasses", [CHASSE])).toBe(true);
    expect(await fait("Chasses", [CHASSE])).toBe(true);
    expect(
      await lire(
        `PartageChasses.partager([{ impact: moment("2026-11-10 13:00", "YYYY-MM-DD HH:mm"), terrain: 500 }], null)`,
      ),
    ).toBe(true);
  });

  test("faux : refus du forum, forum injoignable, rien à partager", async () => {
    lire(`FORUM.refuse = (f) => f == "envoiNouveauMessage"`);
    expect(await fait("Floods", [FLOOD])).toBe(false);
    lire(`FORUM.refuse = () => false; FORUM.illisible = true`);
    expect(await fait("Floods", [FLOOD])).toBe(false);
    lire(`FORUM.illisible = false`);
    expect(await fait("Floods", [])).toBe(false);
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
  test("refus du forum, sujet commun absent, section cachée : plus repris à chaque page", async () => {
    lire(`FORUM.refuse = (f) => f == "envoiNouveauMessage"`);
    await partager("Floods", FLOOD);
    expect(lire(`OUBLIES`)).toEqual([13]);
    lire(
      `OUBLIES = []; FORUM.refuse = () => false; FORUM.sujets = FORUM.sujets.filter((s) => s.id != "10")`,
    );
    await partager("Floods", FLOOD);
    expect(lire(`OUBLIES`)).toEqual([13]);
    lire(`OUBLIES = []; FORUM.sections = ["Discussions"]; PartageChasses.idSection = null`);
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
