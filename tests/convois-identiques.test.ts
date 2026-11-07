import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * État « ✅ Enregistré » des convois de la page Convois : lu dans le sujet
 * « Convois » du forum seulement. Chaque ligne du sujet ne vaut que pour un
 * convoi ; le site de suivi n'est jamais lu pour cet état.
 */
const page = creerPage(
  [
    "js/class/Utils.js",
    "js/class/Horloge.js",
    "js/class/OuafSuivi.js",
    "js/page/PartageChasses.js",
    "js/page/ConvoisForum.js",
    "js/page/CommerceFzzz.js",
  ],
  `var TOAST_INFO = {}, TOAST_WARNING = {}, TOAST_ERROR = {};`,
);

const maintenant = Date.now();
const A = { id: 101, vers: "Kwhwwymwn", montant: 466945, arrivee: maintenant + 3600000 };
const B = { ...A, id: 102 };
const note = (c: object, id: number, decalage = 0) => ({
  ...c,
  id,
  arrivee: (c as typeof A).arrivee + decalage,
});
const trouves = (convois: object[], notes: object[]) =>
  page.lire<number[]>(
    `(() => { let c = ${JSON.stringify(convois)}; let t = ConvoisForum.trouves(c, ${JSON.stringify(notes)}); return c.map((x, i) => t.has(x) ? i : -1).filter((i) => i >= 0); })()`,
  );

describe("convois notés dans le forum, ligne par ligne", () => {
  test("deux convois identiques, un seul noté : un seul reconnu", () => {
    expect(trouves([A, B], [note(A, 101)])).toEqual([0]);
  });

  test("noté sans numéro (#0) depuis un autre appareil : reconnu par joueur, montant et arrivée", () => {
    expect(trouves([A], [note(A, 0, 45000)])).toEqual([0]);
  });

  test("deux convois identiques sans numéro, une seule ligne : un seul reconnu", () => {
    expect(
      trouves(
        [
          { ...A, id: null },
          { ...B, id: null },
        ],
        [note(A, 0)],
      ),
    ).toEqual([0]);
  });

  test("ligne au numéro inconnu ici : pour le convoi sans numéro, pas pour celui qui a le sien", () => {
    expect(trouves([A, { ...B, id: null }], [note(A, 555)])).toEqual([1]);
  });

  test("arrivée trop différente : pas reconnu", () => {
    expect(trouves([{ ...A, id: null }], [note(A, 0, 5 * 60000)])).toEqual([]);
  });

  test("numéro inconnu écrit « #0 », gardé même en double, relu avec le numéro 0", () => {
    const ligne = { arrivee: "2099-01-01 10:00", vers: "Kwhwwymwn", montant: 466945, id: 0 };
    const texte = page.lire<string>(
      `ConvoisForum.ecrire(${JSON.stringify([ligne, ligne])}, "2026-01-01 00:00")`,
    );
    expect(texte.split("\n")).toEqual([
      "01/01/99 10:00 | Kwhwwymwn | 466 945 | #0",
      "01/01/99 10:00 | Kwhwwymwn | 466 945 | #0",
    ]);
    expect(
      page.lire<{ id: number }[]>(`ConvoisForum.lire(${JSON.stringify(texte)})`).map((n) => n.id),
    ).toEqual([0, 0]);
  });
});

describe("page Convois : état d'après le forum seul", () => {
  const ligne = (id: number) =>
    `<strong>- Vous allez livrer 0 nourriture et 466 945 matériaux à <a href="Membre.php?Pseudo=Kwhwwymwn">Kwhwwymwn</a> dans 1h 00m 00s</strong> - <a href="commerce.php?annuler=${id}">Annuler</a><br/>`;
  const etats = () =>
    page.lire<string[]>(
      `$(".o_ouafLigne").map((i, l) => $(l).find(".o_ouafOui")[0].style.display != "none" ? "✅" : $(l).find(".o_ouafNoter")[0].style.display != "none" ? "📝" : "📤").get()`,
    );
  const attendre = () => new Promise((r) => setTimeout(r, 50));
  // site simulé : chaque requête est notée ; le forum aussi
  const ouvrir = (forum: string, noterEchoue = 0) =>
    page.lire(`(() => {
      localStorage.clear();
      window.requetes = [];
      window.notes = [];
      window.toasts = [];
      window.chrome = {
        storage: { local: { get: () => Promise.resolve({ fzzz_ouafCode: "x" }) } },
        runtime: {
          sendMessage: (m) => {
            requetes.push(m.methode + " " + m.chemin);
            let r = { ok: true, donnees: {} };
            if (m.chemin == "/api/session") r.donnees = { connecte: true, pseudo: "Moi" };
            else if (m.methode == "GET" && m.chemin == "/api/mes")
              r.donnees = { pseudo: "Moi", membres: ["Kwhwwymwn"], lignes: [] };
            else if (m.methode == "GET") r.donnees = { lignes: [] };
            return Promise.resolve(r);
          },
        },
      };
      let echecs = ${noterEchoue};
      ConvoisForum.notes = () => ${forum};
      ConvoisForum.noter = (liste) => {
        if (echecs-- > 0) return Promise.reject(new Error("réseau"));
        notes.push(...liste.map((c) => c.id));
        return Promise.resolve();
      };
      $.toast = (o) => toasts.push(o.text);
      document.body.innerHTML = '<div id="centre"><h3>Convois en cours:</h3>${ligne(101)}${ligne(102)}<h3>Fin</h3></div>';
      CommerceFzzz.suiviOuaf();
    })()`);
  const forumAvecA = `Promise.resolve([{ id: 101, vers: "Kwhwwymwn", montant: 466945, arrivee: Date.now() + 3600000 }])`;

  test("ouverture : seul le convoi noté est « Enregistré », sans aucune requête au site", async () => {
    ouvrir(forumAvecA);
    await attendre();
    expect(etats()).toEqual(["✅", "📤"]);
    expect(page.lire(`requetes`)).toEqual([]);
  });

  test("clic sur le second : transmis au site, puis noté dans le forum", async () => {
    ouvrir(forumAvecA);
    await attendre();
    page.lire(`$(".o_ouafEnvoyer").eq(1).trigger("click")`);
    await attendre();
    expect(etats()).toEqual(["✅", "✅"]);
    expect(page.lire(`requetes`)).toEqual([
      "POST /api/session",
      "GET /api/mes",
      "GET /api/avances",
      "PUT /api/avances",
    ]);
    expect(page.lire(`notes`)).toEqual([102]);
  });

  test("forum en échec après l'envoi : « 📝 Noter dans le forum », qui ne renvoie rien au site", async () => {
    ouvrir(`Promise.resolve([])`, 1);
    await attendre();
    page.lire(`$(".o_ouafEnvoyer").eq(0).trigger("click")`);
    await attendre();
    expect(etats()).toEqual(["📝", "📤"]);
    expect(page.lire<string[]>(`toasts`).join(" ")).toContain("📝 Noter dans le forum");
    const ecritures = () =>
      page.lire<string[]>(`requetes`).filter((r) => r.startsWith("PUT")).length;
    const avant = ecritures();
    page.lire(`$(".o_ouafNoter").eq(0).trigger("click")`);
    await attendre();
    expect(etats()).toEqual(["✅", "📤"]);
    expect(ecritures()).toBe(avant);
    expect(page.lire(`notes`)).toEqual([101]);
  });

  test("forum illisible à l'ouverture : état inconnu, signalé", async () => {
    ouvrir(`Promise.reject(new Error("absente"))`);
    await attendre();
    expect(etats()).toEqual(["📤", "📤"]);
    expect(page.lire<string>(`$(".o_ouafEnvoyer").attr("title")`)).toContain("état inconnu");
    expect(page.lire<string[]>(`toasts`).join(" ")).toContain("n'a pas pu être lu");
  });
});

describe("deux clics « Envoyer au suivi » rapprochés", () => {
  test("le second part après le premier : convoi prévu compté une fois", async () => {
    page.lire(`(() => {
      // site simulé avec son état : convoi prévu de 466 945 vers ce joueur
      let etat = { envoye: 0, avances: [] },
        reponse = (donnees) => new Promise((r) => setTimeout(() => r({ ok: true, donnees }), 5)),
        mes = () => ({ pseudo: "Moi", membres: ["Kwhwwymwn"], lignes: [{ de: "Moi", vers: "Kwhwwymwn", demande: 466945, envoye: etat.envoye }] });
      window.etatSite = etat;
      window.chrome = {
        storage: { local: { get: () => Promise.resolve({ fzzz_ouafCode: "x" }) } },
        runtime: {
          sendMessage: (m) => {
            if (m.chemin == "/api/session") return reponse({ connecte: true, pseudo: "Moi" });
            if (m.chemin == "/api/mes" && m.methode == "GET") return reponse(mes());
            if (m.chemin == "/api/mes") {
              etat.envoye += m.corps.lignes[0].ajout;
              return reponse(mes());
            }
            if (m.methode == "GET") return reponse({ lignes: etat.avances.slice() });
            etat.avances = m.corps.lignes;
            return reponse({});
          },
        },
      };
      window.statuts = [];
      let suivi = (c, s) => statuts.push(c.id + " " + s);
      OuafSuivi.envoyer([${JSON.stringify(A)}], suivi);
      OuafSuivi.envoyer([${JSON.stringify(B)}], suivi);
    })()`);
    await new Promise((r) => setTimeout(r, 200));
    expect(page.lire(`statuts`)).toEqual(["101 envoye", "102 envoye"]);
    // le premier remplit le convoi prévu, le second part en avance
    expect(page.lire(`etatSite.envoye`)).toBe(466945);
    expect(page.lire(`etatSite.avances.map((l) => l.montant)`)).toEqual([466945]);
  });
});
