import { beforeEach, describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Partage des chasses et des floods dans la section du joueur des sujets
 * communs « BDD générale … » : le forum ne signale pas une écriture refusée
 * (grade sans droit d'écrire dans la section, premier message bloqué par une
 * réponse). Après l'écriture, le sujet est relu ; la section absente ou plus
 * ancienne, l'écriture est refaite, puis le joueur est prévenu en rouge au
 * lieu d'un succès (1.100.1, joueur sans sujet après « partagé »).
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
const FLOODS = "BDD générale flood - NE RIEN ÉCRIRE";
const CHASSES = "BDD générale chasse - NE RIEN ÉCRIRE";

// forum simulé : la section 7, ses sujets communs ; `refuse` : écriture
// acceptée par le jeu sans effet (grade sans droit, message verrouillé)
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
    PartageChasses._attendre = () => Promise.resolve();
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
const message = (id: string) =>
  lire<string>(`FORUM.sujets.find((s) => s.id == "${id}").messages[0]`);
const section = (titre: string, lignes: string[]) => [`--- ${titre} ---`, ...lignes].join("\n");

describe("partage dans ma section du sujet commun", () => {
  test("première section : écrite sous le texte du sujet, relue après la pause, succès", async () => {
    const toasts = await partager("Chasses", CHASSE);
    // rien à archiver : le sujet lu sert à l'écriture, sans être relu avant
    expect(lire(`FORUM.appels`)).toEqual([
      "callGetForum sections",
      "callGetForum",
      "callGetTopic",
      "envoiEditTopic",
      "callGetTopic",
    ]);
    expect(message("11")).toBe(
      [
        "NE RIEN ÉCRIRE",
        section("LabraDrungor · 2026-11-10 10:00:00", ["10/11/26 12:00 | 25 000 cm²"]),
      ].join("\n"),
    );
    expect(toasts.map((t) => t.t)).toEqual(["succes"]);
    expect(toasts[0]?.text).toStartWith("1 chasse partagée avec la ");
  });

  test("sections des autres joueurs gardées telles quelles ; la mienne fusionnée", async () => {
    lire(
      `FORUM.sujets[0].messages[0] = ${JSON.stringify(
        [
          section("Alpha · 2026-11-10 09:00:00", ["10/11/26 13:00 | Charlie | 1 000 cm² | #5"]),
          section("LabraDrungor · 2026-11-10 09:30:00", [
            "10/11/26 11:00 | Bravo | 1 000 unités | 1 000 cm² | #12",
          ]),
        ].join("\n"),
      )}`,
    );
    await partager("Floods", FLOOD);
    expect(message("10")).toBe(
      [
        section("Alpha · 2026-11-10 09:00:00", ["10/11/26 13:00 | Charlie | 1 000 cm² | #5"]),
        section("LabraDrungor · 2026-11-10 10:00:00", [
          "10/11/26 12:30 | Bravo | 3 000 unités | 3 000 cm² | #13",
          "10/11/26 11:00 | Bravo | 1 000 unités | 1 000 cm² | #12",
        ]),
      ].join("\n"),
    );
  });

  test("écriture refusée en silence (réponse dans le sujet, grade) : trois essais, puis erreur en rouge", async () => {
    lire(`FORUM.refuse = (f) => f == "envoiEditTopic"`);
    const toasts = await partager("Floods", FLOOD);
    expect(lire<string[]>(`FORUM.appels.filter((a) => a == "envoiEditTopic")`).length).toBe(3);
    expect(toasts).toEqual([
      {
        t: "erreur",
        text: `Partage non enregistré : le sujet « ${FLOODS} » n'a pas été modifié. Si quelqu'un y a répondu, son premier message n'est plus modifiable (un chef peut supprimer la réponse) ; sinon, ton grade n'a peut-être pas le droit d'y écrire (demande à un chef), ou d'autres membres l'écrivaient au même moment : réessaie.`,
      },
    ]);
  });

  test("pas de sujet commun : rien n'est écrit, l'erreur dit de le créer", async () => {
    lire(`FORUM.sujets = FORUM.sujets.filter((s) => s.id != "11")`);
    const toasts = await partager("Chasses", CHASSE);
    expect(lire<string[]>(`FORUM.appels`)).not.toContain("envoiEditTopic");
    expect(toasts).toEqual([
      {
        t: "erreur",
        text: `Partage impossible : pas de sujet « ${CHASSES} » dans la section « BDD partagée cachée » du forum. Demande à un chef de le créer, avec un premier message modifiable par tous les membres.`,
      },
    ]);
  });

  test("sujet plein (taille maximale d'un message) : rien n'est écrit, erreur en rouge", async () => {
    lire(`FORUM.sujets[1].messages[0] = "x".repeat(40000)`);
    const toasts = await partager("Chasses", CHASSE);
    expect(lire<string[]>(`FORUM.appels`)).not.toContain("envoiEditTopic");
    expect(toasts.map((t) => t.text)).toEqual([
      `Partage non enregistré : le sujet « ${CHASSES} » est plein (un message du forum a une taille maximale) : préviens un chef.`,
    ]);
  });

  test("rien de nouveau : ni écriture ni relecture", async () => {
    lire(
      `FORUM.sujets[1].messages[0] = ${JSON.stringify(section("LabraDrungor · 2026-11-10 09:00:00", ["10/11/26 12:00 | 25 000 cm²"]))}`,
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
    lire(`FORUM.refuse = (f) => f == "envoiEditTopic"`);
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
    lire(`FORUM.refuse = (f) => f == "envoiEditTopic"`);
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
