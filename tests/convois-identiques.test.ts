import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Deux convois identiques (même joueur, même montant, même arrivée) dont un
 * seul a été transmis au site de suivi : chaque envoi noté (forum, ce
 * navigateur, historique du site) ne vaut que pour un convoi.
 */
const page = creerPage(
  ["js/class/Utils.js", "js/class/Horloge.js", "js/class/OuafSuivi.js", "js/page/CommerceFzzz.js"],
  `var TOAST_INFO = {}, TOAST_WARNING = {}, TOAST_ERROR = {}, FORUM_SECTIONS_CHASSES = ["BDD"];`,
);

const maintenant = Date.now();
const A = {
  cle: "id101",
  id: 101,
  vers: "Kwhwwymwn",
  montant: 466945,
  arrivee: maintenant + 3600000,
  depart: maintenant - 600000,
};
const B = { ...A, cle: "id102", id: 102 };
// historique du site : un envoi noté vers ce joueur, il y a une minute
const envoi = (minutes: number) => ({
  quand: new Date(maintenant - minutes * 60000).toISOString(),
  action: "avance",
  de: "Moi",
  vers: "Kwhwwymwn",
  montant: 466945,
  detail: "",
  sens: "envoye",
});
const apparier = (convois: object[], hist: object[], connus: string[] = []) =>
  page
    .lire<string[]>(
      `[...OuafSuivi.apparier(${JSON.stringify(convois)}, OuafSuivi.transmissions(${JSON.stringify(hist)}, "Moi"), new Set(${JSON.stringify(connus)}))]`,
    )
    .sort();

describe("convois identiques, un seul transmis", () => {
  test("transmis depuis ce navigateur : son envoi ne valide pas l'autre", () => {
    page.lire(`localStorage.clear(); OuafSuivi.marquerTransmis("id101")`);
    expect(apparier([A, B], [envoi(1)])).toEqual(["id101"]);
  });

  test("noté dans le forum (autre appareil) : son envoi ne valide pas l'autre", () => {
    page.lire(`localStorage.clear()`);
    // l'autre arrive une seconde plus tôt : il passait en premier
    const plusTot = { ...B, arrivee: A.arrivee - 1000 };
    expect(apparier([A, plusTot], [envoi(1)], ["id101"])).toEqual(["id101"]);
  });

  test("deux envois notés sur le site : les deux convois validés", () => {
    page.lire(`localStorage.clear()`);
    expect(apparier([A, B], [envoi(1), envoi(5)])).toEqual(["id101", "id102"]);
  });

  test("clic « Envoyer au suivi » sur le second : il est envoyé, pas pris pour déjà transmis", async () => {
    page.lire(`(() => {
      localStorage.clear();
      OuafSuivi.marquerTransmis("id101");
      window.ecritures = [];
      window.chrome = {
        storage: { local: { get: () => Promise.resolve({ fzzz_ouafCode: "x" }) } },
        runtime: {
          sendMessage: (m) => {
            let r = { ok: true, donnees: {} };
            if (m.chemin == "/api/session") r.donnees = { connecte: true, pseudo: "Moi" };
            else if (m.chemin == "/api/historique") r.donnees = { lignes: ${JSON.stringify([envoi(1)])} };
            else if (m.methode == "GET" && m.chemin == "/api/mes")
              r.donnees = { pseudo: "Moi", membres: ["Kwhwwymwn"], lignes: [] };
            else if (m.methode == "GET") r.donnees = { lignes: [] };
            else ecritures.push(m.methode + " " + m.chemin);
            return Promise.resolve(r);
          },
        },
      };
      window.statuts = [];
      OuafSuivi.envoyer([${JSON.stringify(B)}], (c, s) => statuts.push(s), ${JSON.stringify([A, B])}, new Set(["id101"]));
    })()`);
    await new Promise((r) => setTimeout(r, 50));
    expect(page.lire(`statuts`)).toEqual(["envoye"]);
    expect(page.lire(`ecritures`)).toEqual(["PUT /api/avances"]);
  });

  test("sans numéro (lien Annuler absent) : clés distinctes, marquer l'un ne marque pas l'autre", () => {
    const ligne = `<strong>- Vous allez livrer 0 nourriture et 466 945 matériaux à <a href="Membre.php?Pseudo=Kwhwwymwn">Kwhwwymwn</a> dans 1h 00m 00s</strong> - Retour<br/>`;
    const [premiere, seconde] = page.lire<[string, string]>(`(() => {
      localStorage.clear();
      document.body.innerHTML = '<div id="centre"><h3>Convois en cours:</h3>${ligne}${ligne}<h3>Fin</h3></div>';
      return OuafSuivi.convoisJeu().map((c) => c.cle);
    })()`);
    expect(premiere).not.toBe(seconde);
    page.lire(`OuafSuivi.marquerTransmis(${JSON.stringify(premiere)})`);
    expect(page.lire<string[]>(`[...OuafSuivi.apparier(OuafSuivi.convoisJeu(), [])]`)).toEqual([
      premiere,
    ]);
  });
});

describe("page Convois : deux convois identiques, un seul transmis", () => {
  // site de suivi simulé : l'envoi de A est dans l'historique ; écritures comptées
  const site = `window.ecritures = [];
    window.chrome = {
      storage: { local: { get: () => Promise.resolve({ fzzz_ouafCode: "x" }) } },
      runtime: {
        sendMessage: (m) => {
          let r = { ok: true, donnees: {} };
          if (m.chemin == "/api/session") r.donnees = { connecte: true, pseudo: "Moi" };
          else if (m.chemin == "/api/historique") r.donnees = { lignes: ${JSON.stringify([envoi(1)])} };
          else if (m.methode == "GET" && m.chemin == "/api/mes")
            r.donnees = { pseudo: "Moi", membres: ["Kwhwwymwn"], lignes: [] };
          else if (m.methode == "GET") r.donnees = { lignes: [] };
          else ecritures.push(m.methode + " " + m.chemin);
          return Promise.resolve(r);
        },
      },
    };`;
  const ligne = (id: number) =>
    `<strong>- Vous allez livrer 0 nourriture et 466 945 matériaux à <a href="Membre.php?Pseudo=Kwhwwymwn">Kwhwwymwn</a> dans 1h 00m 00s</strong> - <a href="commerce.php?annuler=${id}">Annuler</a><br/>`;
  const etats = () =>
    page.lire<string[]>(
      `$(".o_ouafLigne").map((i, l) => $(l).find(".o_ouafOui")[0].style.display == "none" ? "📤" : "✅").get()`,
    );
  const attendre = () => new Promise((r) => setTimeout(r, 50));

  test("ouverture : seul A est « Enregistré », rien n'est ajouté au forum ; clic sur B : B est envoyé", async () => {
    page.lire(`(() => {
      localStorage.clear();
      OuafSuivi.marquerTransmis("id101");
      window.forum = [{ id: 101, vers: "Kwhwwymwn", montant: 466945, arrivee: Date.now() + 3600000 }];
      window.ajoutsForum = [];
      window.ConvoisForum = {
        notes: () => Promise.resolve(forum),
        noter: (liste) => { ajoutsForum.push(...liste.map((c) => c.id)); return Promise.resolve(); },
      };
      ${site}
      $.toast = () => {};
      document.body.innerHTML = '<div id="centre"><h3>Convois en cours:</h3>${ligne(101)}${ligne(102)}<h3>Fin</h3></div>';
      CommerceFzzz.suiviOuaf();
    })()`);
    await attendre();
    expect(etats()).toEqual(["✅", "📤"]);
    expect(page.lire(`ajoutsForum`)).toEqual([]);
    page.lire(`$(".o_ouafEnvoyer").eq(1).trigger("click")`);
    await attendre();
    expect(etats()).toEqual(["✅", "✅"]);
    expect(page.lire(`ecritures`)).toEqual(["PUT /api/avances"]);
    expect(page.lire(`ajoutsForum`)).toEqual([102]);
  });
});

describe("historique du site : deux envois identiques coup sur coup", () => {
  const debut = maintenant - 10 * 60000;
  const ligne = (action: string, montant: number, secondes: number, detail = "") => ({
    quand: new Date(debut + secondes * 1000).toISOString(),
    action,
    de: "Moi",
    vers: "Kwhwwymwn",
    montant,
    detail,
    sens: "envoye",
  });
  const nets = (hist: object[]) =>
    page
      .lire<{ net: number }[]>(`OuafSuivi.transmissions(${JSON.stringify(hist)}, "Moi")`)
      .map((g) => g.net);

  test("deux envois notés à 30 s d'écart : deux envois, pas un du double", () => {
    expect(
      nets([
        ligne("convoi", 466945, 0, "Envoyé : 0 → 466945"),
        ligne("convoi", 466945, 30, "Envoyé : 466945 → 933890"),
      ]),
    ).toEqual([466945, 466945]);
  });

  test("deux avances à 30 s d'écart : deux envois", () => {
    expect(nets([ligne("avance", 466945, 0), ligne("avance", 466945, 30)])).toEqual([
      466945, 466945,
    ]);
  });

  test("envoi noté + avance, deux fois : deux envois", () => {
    expect(
      nets([
        ligne("convoi", 300000, 0, "Envoyé : 0 → 300000"),
        ligne("avance", 166945, 2),
        ligne("convoi", 300000, 30, "Envoyé : 300000 → 600000"),
        ligne("avance", 166945, 32),
      ]),
    ).toEqual([466945, 466945]);
  });

  test("avance remplacée dans la même seconde, dans un ordre ou dans l'autre : un seul envoi", () => {
    const envoiNote = ligne("convoi", 1500, 0, "Envoyé : 500 → 1500");
    expect(nets([envoiNote, ligne("avance_annule", 100, 4), ligne("avance", 600, 4)])).toEqual([
      1500,
    ]);
    expect(nets([envoiNote, ligne("avance", 600, 4), ligne("avance_annule", 100, 4)])).toEqual([
      1500,
    ]);
  });

  test("deux convois identiques, rien dans le forum ni dans ce navigateur : les deux validés", () => {
    page.lire(`localStorage.clear()`);
    expect(apparier([A, B], [ligne("avance", 466945, 0), ligne("avance", 466945, 30)])).toEqual([
      "id101",
      "id102",
    ]);
  });
});

describe("deux clics « Envoyer au suivi » rapprochés", () => {
  test("le second part après le premier : rien d'écrasé, convoi prévu compté une fois", async () => {
    page.lire(`(() => {
      localStorage.clear();
      // site simulé avec son état : convoi prévu de 466 945 vers ce joueur
      let etat = { envoye: 0, avances: [], historique: [] },
        noter = (action, montant, detail = "") =>
          etat.historique.push({ quand: new Date().toISOString(), action, de: "Moi", vers: "Kwhwwymwn", montant, detail, sens: "envoye" }),
        reponse = (donnees) => new Promise((r) => setTimeout(() => r({ ok: true, donnees }), 5)),
        mes = () => ({ pseudo: "Moi", membres: ["Kwhwwymwn"], lignes: [{ de: "Moi", vers: "Kwhwwymwn", demande: 466945, envoye: etat.envoye }] });
      window.etatSite = etat;
      window.chrome = {
        storage: { local: { get: () => Promise.resolve({ fzzz_ouafCode: "x" }) } },
        runtime: {
          sendMessage: (m) => {
            if (m.chemin == "/api/session") return reponse({ connecte: true, pseudo: "Moi" });
            if (m.chemin == "/api/historique") return reponse({ lignes: etat.historique.slice() });
            if (m.chemin == "/api/mes" && m.methode == "GET") return reponse(mes());
            if (m.chemin == "/api/mes") {
              let avant = etat.envoye;
              etat.envoye += m.corps.lignes[0].ajout;
              noter("convoi", m.corps.lignes[0].ajout, "Envoyé : " + avant + " → " + etat.envoye);
              return reponse(mes());
            }
            if (m.methode == "GET") return reponse({ lignes: etat.avances.slice() });
            etat.avances = m.corps.lignes;
            noter("avance", m.corps.lignes[m.corps.lignes.length - 1].montant);
            return reponse({});
          },
        },
      };
      window.statuts = [];
      let page = ${JSON.stringify([A, B])}, connus = new Set(),
        suivi = (c, s) => { statuts.push(c.cle + " " + s); if (s == "envoye") connus.add(c.cle); };
      OuafSuivi.envoyer([page[0]], suivi, page, connus);
      OuafSuivi.envoyer([page[1]], suivi, page, connus);
    })()`);
    await new Promise((r) => setTimeout(r, 200));
    expect(page.lire(`statuts`)).toEqual(["id101 envoye", "id102 envoye"]);
    // le premier remplit le convoi prévu, le second part en avance
    expect(page.lire(`etatSite.envoye`)).toBe(466945);
    expect(page.lire(`etatSite.avances.map((l) => l.montant)`)).toEqual([466945]);
  });
});
