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
