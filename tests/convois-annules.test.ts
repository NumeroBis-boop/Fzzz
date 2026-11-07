import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Convoi transmis puis annulé dans le jeu : sa part est retirée du site de
 * suivi (convoi prévu et avance) et sa ligne du forum, une seule, même quand
 * un convoi identique reste en cours.
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
  `var TOAST_INFO = {}, TOAST_WARNING = { t: "attention" }, TOAST_ERROR = {}, TOAST_SUCCESS = { t: "ok" };
   var monProfil = { pseudo: "Moi" };`,
);
const attendre = (ms = 60) => new Promise((r) => setTimeout(r, ms));

// site de suivi simulé avec son état ; chaque écriture est notée
const site = (envoye: number, avances: number[]) =>
  page.lire(`(() => {
    ouafPanne = 0;
    localStorage.removeItem("fzzz_ouafAnnules");
    let etat = (window.etatSite = {
      envoye: ${envoye},
      avances: ${JSON.stringify(avances)}.map((montant) => ({ de: "Moi", vers: "Kwhwwymwn", montant })),
      ecritures: [],
    });
    window.chrome = {
      storage: { local: { get: () => Promise.resolve({ fzzz_ouafCode: "x" }) } },
      runtime: {
        sendMessage: (m) => {
          let ok = (donnees) => Promise.resolve({ ok: true, statut: 200, donnees });
          if (window.sitePanne) return Promise.resolve({ erreur: "reseau" });
          if (m.chemin == "/api/session") return ok({ connecte: true, pseudo: "Moi" });
          let mes = () => ({ pseudo: "Moi", membres: ["Kwhwwymwn"], lignes: [{ de: "Moi", vers: "Kwhwwymwn", demande: 2000000, envoye: etat.envoye }] });
          if (m.chemin == "/api/mes" && m.methode == "GET") return ok(mes());
          if (m.chemin == "/api/avances" && m.methode == "GET") return ok({ lignes: etat.avances.slice() });
          etat.ecritures.push(m.methode + " " + m.chemin + " " + JSON.stringify(m.corps));
          if (m.chemin == "/api/mes") {
            let l = m.corps.lignes[0];
            if (l.reprendre) etat.envoye = 0;
            else etat.envoye += l.ajout;
            return ok(mes());
          }
          etat.avances = m.corps.lignes;
          return ok({});
        },
      },
    };
  })()`);

describe("répartition notée dans le forum", () => {
  test("écrite après le numéro, relue ; une ligne d'avant 1.86 n'en a pas", () => {
    const ligne = {
      arrivee: "2099-01-01 10:00",
      vers: "Kwhwwymwn",
      montant: 466945,
      id: 101,
      prevu: 300000,
      avance: 166945,
    };
    const texte = page.lire<string>(
      `ConvoisForum.ecrire(${JSON.stringify([ligne])}, "2026-01-01 00:00")`,
    );
    expect(texte).toBe(
      "01/01/99 10:00 | Kwhwwymwn | 466 945 | #101 | prévu 300 000 | avance 166 945",
    );
    expect(
      page.lire(
        `ConvoisForum.lire(${JSON.stringify(texte + "\n01/01/99 11:00 | Grim | 1 000 | #102")})`,
      ),
    ).toEqual([
      { ...ligne },
      { arrivee: "2099-01-01 11:00", vers: "Grim", montant: 1000, id: 102 },
    ]);
  });
});

describe("ligne du forum retirée, une seule", () => {
  // sujet simulé : ses lignes, et le texte écrit
  const sujet = (lignes: string[]) =>
    page.lire(`(() => {
      window.ecrit = null;
      ConvoisForum._sujet = () => Promise.resolve({ titre: "Convois | Moi", id: 5 });
      ConvoisForum._contenu = () => Promise.resolve(ConvoisForum.lire(${JSON.stringify(lignes.join("\n"))}));
      PartageChasses._xajax = (f, q) => {
        window.ecrit = decodeURIComponent(q.match(/message=([^&]*)/)[1]).split("\\n");
        return Promise.resolve();
      };
    })()`);
  const retirer = (c: object) =>
    page.lire<Promise<boolean>>(`ConvoisForum.retirer(${JSON.stringify(c)})`);
  const arrivee = Date.parse("2099-01-01T10:00:00");

  test("par numéro : la ligne de ce convoi, pas celle du convoi identique", async () => {
    sujet([
      "01/01/99 10:00 | Kwhwwymwn | 466 945 | #101",
      "01/01/99 10:00 | Kwhwwymwn | 466 945 | #102",
    ]);
    expect(await retirer({ id: 101, vers: "Kwhwwymwn", montant: 466945, arrivee })).toBe(true);
    expect(page.lire(`ecrit`)).toEqual(["01/01/99 10:00 | Kwhwwymwn | 466 945 | #102"]);
  });

  test("numéro inconnu (#0), deux lignes identiques : une seule retirée", async () => {
    sujet([
      "01/01/99 10:00 | Kwhwwymwn | 466 945 | #0",
      "01/01/99 10:00 | Kwhwwymwn | 466 945 | #0",
    ]);
    expect(await retirer({ id: 101, vers: "Kwhwwymwn", montant: 466945, arrivee })).toBe(true);
    expect(page.lire(`ecrit`)).toEqual(["01/01/99 10:00 | Kwhwwymwn | 466 945 | #0"]);
  });

  test("absente du sujet : rien n'est écrit", async () => {
    sujet(["01/01/99 10:00 | Grim | 1 000 | #7"]);
    expect(await retirer({ id: 101, vers: "Kwhwwymwn", montant: 466945, arrivee })).toBe(false);
    expect(page.lire(`ecrit`)).toBeNull();
  });
});

describe("part retirée du site de suivi", () => {
  test("convoi prévu et avance : sa part seulement, une seule avance parmi deux identiques", async () => {
    site(933890, [166945, 166945]);
    const bilan = await page.lire<Promise<object>>(
      `OuafSuivi.retirer({ vers: "Kwhwwymwn", prevu: 300000, avance: 166945 })`,
    );
    expect(bilan).toEqual({ prevu: 300000, avance: 166945, manque: [] });
    // le site ne sait que remettre l'envoyé à zéro : le reste est noté de nouveau
    expect(page.lire(`etatSite.envoye`)).toBe(633890);
    expect(page.lire(`etatSite.avances.map((l) => l.montant)`)).toEqual([166945]);
  });

  test("avance introuvable : signalée, rien d'autre retiré", async () => {
    site(0, []);
    const bilan = await page.lire<Promise<{ manque: string[] }>>(
      `OuafSuivi.retirer({ vers: "Kwhwwymwn", prevu: 0, avance: 1000 })`,
    );
    expect(bilan.manque).toHaveLength(1);
    expect(bilan.manque[0]).toMatch(/^avance de 1\D000 vers Kwhwwymwn introuvable$/);
    expect(page.lire(`etatSite.ecritures`)).toEqual([]);
  });
});

describe("page Convois : annulation d'un des deux convois identiques", () => {
  const ligne = (id: number) =>
    `<strong>- Vous allez livrer 0 nourriture et 466 945 matériaux à <a href="Membre.php?Pseudo=Kwhwwymwn">Kwhwwymwn</a> dans 1h 00m 00s</strong> - <a href="commerce.php?annuler=${id}">Annuler</a><br/>`;
  // page Convois avec ces convois ; forum simulé (deux convois notés), retraits comptés
  const ouvrir = (ids: number[], forum: string) =>
    page.lire(`(() => {
      window.toasts = [];
      window.retraitsForum = [];
      $.toast = (o) => toasts.push((o.t || "") + " " + o.text);
      ConvoisForum.notes = () => Promise.resolve(${forum});
      ConvoisForum.retirer = (c) => { retraitsForum.push(c.id); return Promise.resolve(true); };
      document.body.innerHTML = ${JSON.stringify(
        `<div id="centre"><h3>Convois en cours:</h3>${ids.map(ligne).join("")}<h3>Fin</h3></div>`,
      )};
      CommerceFzzz.suiviOuaf();
    })()`);
  const notes = (avecRepartition: boolean) =>
    `[101, 102].map((id) => ({ id, vers: "Kwhwwymwn", montant: 466945, arrivee: Date.now() + 3600000${avecRepartition ? ", prevu: 466945, avance: 0" : ""} }))`;

  test("clic sur « Annuler » de l'un : au chargement suivant, sa part et sa ligne seulement", async () => {
    site(933890, []);
    ouvrir([101, 102], notes(true));
    await attendre();
    page.lire(
      `document.querySelector('a[href="commerce.php?annuler=101"]').dispatchEvent(new MouseEvent("click", { bubbles: true }))`,
    );
    expect(page.lire<number[]>(`OuafSuivi.annulations().map((a) => a.id)`)).toEqual([101]);
    // le jeu recharge la page : le convoi annulé n'y est plus
    ouvrir([102], notes(true));
    await attendre(150);
    expect(page.lire(`etatSite.envoye`)).toBe(466945);
    expect(page.lire(`retraitsForum`)).toEqual([101]);
    expect(page.lire(`OuafSuivi.annulations()`)).toEqual([]);
    expect(page.lire<string[]>(`toasts`).join(" ")).toContain("retiré du site de suivi");
  });

  test("annulation refusée : le convoi est toujours là, rien n'est retiré", async () => {
    site(933890, []);
    ouvrir([101, 102], notes(true));
    await attendre();
    page.lire(
      `document.querySelector('a[href="commerce.php?annuler=101"]').dispatchEvent(new MouseEvent("click", { bubbles: true }))`,
    );
    ouvrir([101, 102], notes(true));
    await attendre(150);
    expect(page.lire(`etatSite.ecritures`)).toEqual([]);
    expect(page.lire(`retraitsForum`)).toEqual([]);
    expect(page.lire(`OuafSuivi.annulations()`)).toEqual([]);
  });

  test("site en panne : annulation gardée, reportée au chargement suivant, sans double retrait", async () => {
    site(933890, []);
    ouvrir([101, 102], notes(true));
    await attendre();
    page.lire(
      `document.querySelector('a[href="commerce.php?annuler=101"]').dispatchEvent(new MouseEvent("click", { bubbles: true }))`,
    );
    page.lire(`window.sitePanne = true`);
    ouvrir([102], notes(true));
    await attendre(150);
    expect(page.lire<number[]>(`OuafSuivi.annulations().map((a) => a.id)`)).toEqual([101]);
    expect(page.lire<string[]>(`toasts`).join(" ")).toContain("Nouvel essai");
    page.lire(`window.sitePanne = false; ouafPanne = 0`);
    ouvrir([102], notes(true));
    await attendre(150);
    expect(page.lire(`etatSite.envoye`)).toBe(466945);
    expect(page.lire(`OuafSuivi.annulations()`)).toEqual([]);
  });

  test("convoi noté avant 1.86 (sans répartition) : retiré du forum, le site est signalé à corriger", async () => {
    site(933890, []);
    ouvrir([101, 102], notes(false));
    await attendre();
    page.lire(
      `document.querySelector('a[href="commerce.php?annuler=101"]').dispatchEvent(new MouseEvent("click", { bubbles: true }))`,
    );
    ouvrir([102], notes(false));
    await attendre(150);
    expect(page.lire(`etatSite.ecritures`)).toEqual([]);
    expect(page.lire(`retraitsForum`)).toEqual([101]);
    expect(page.lire<string[]>(`toasts`).join(" ")).toContain("à la main du site de suivi");
  });
});
