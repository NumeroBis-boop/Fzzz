import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Site de suivi OUAF sans réponse ou en panne : lectures abandonnées après un
 * délai, requêtes refusées tout de suite pendant une minute, et message clair
 * sur la page Convois (pas seulement un « ? » ou une info-bulle).
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

// site simulé : `reponse(m)` donne la réponse du script d'arrière-plan, chaque requête est comptée
const site = (reponse: string) =>
  page.lire(`(() => {
    ouafPanne = 0;
    window.requetes = [];
    window.toasts = [];
    $.toast = (o) => toasts.push(o.text);
    // réglages de l'alliance déjà lus : site de suivi des convois inventé
    localStorage.setItem("fzzz_reglagesAlliance", JSON.stringify({ lu: 0, section: true, sujet: true, reglages: { siteConvois: "http://convois.invalid" } }));
    window.chrome = {
      storage: { local: { get: () => Promise.resolve({ fzzz_ouafCode: "x", fzzz_siteConvoisAccepte: "http://convois.invalid" }) } },
      runtime: { sendMessage: (m) => { requetes.push(m.methode + " " + m.chemin); return (${reponse})(m); } },
    };
  })()`);
const erreur = (expression: string) =>
  page.lire<Promise<string>>(`${expression}.then(() => "ok", (e) => e.name + " : " + e.message)`);

describe("requêtes au site de suivi", () => {
  test("lecture sans réponse : abandonnée après le délai, puis refus immédiat pendant la pause", async () => {
    site(`() => new Promise(() => {})`);
    expect(await erreur(`OuafSuivi.requete("GET", "/api/mes", undefined, 30)`)).toBe(
      "reseau : site de suivi sans réponse",
    );
    expect(await erreur(`OuafSuivi.requete("GET", "/api/mes")`)).toBe(
      "reseau : site de suivi sans réponse il y a moins d'une minute",
    );
    expect(page.lire(`requetes`)).toEqual(["GET /api/mes"]);
  });

  test("erreur 503 du site : panne", async () => {
    site(`() => Promise.resolve({ ok: false, statut: 503, donnees: {} })`);
    expect(await erreur(`OuafSuivi.requete("GET", "/api/mes")`)).toBe(
      "reseau : site de suivi en panne (erreur 503)",
    );
  });

  test("écriture lente : attendue jusqu'au bout (elle a pu aboutir)", async () => {
    site(
      `() => new Promise((r) => setTimeout(() => r({ ok: true, statut: 200, donnees: { fait: 1 } }), 80))`,
    );
    expect(
      await page.lire<Promise<object>>(`OuafSuivi.requete("PUT", "/api/avances", {}, 30)`),
    ).toEqual({ fait: 1 });
  });
});

describe("page Convois : site de suivi sans réponse", () => {
  const ligne = `<strong>- Vous allez livrer 0 nourriture et 466 945 matériaux à <a href="Membre.php?Pseudo=Kwhwwymwn">Kwhwwymwn</a> dans 1h 00m 00s</strong> - <a href="commerce.php?annuler=101">Annuler</a><br/>`;
  const attendre = () => new Promise((r) => setTimeout(r, 50));

  test("clic sur « Envoyer au suivi » : visible tout de suite, puis message clair sur la page", async () => {
    site(`() => Promise.resolve({ erreur: "reseau" })`);
    page.lire(`(() => {
      ConvoisForum.notes = () => Promise.resolve([]);
      document.body.innerHTML = '<div id="centre"><h3>Convois en cours:</h3>${ligne}<h3>Fin</h3></div>';
      CommerceFzzz.suiviOuaf();
    })()`);
    await attendre();
    page.lire(`$(".o_ouafEnvoyer").trigger("click")`);
    expect(page.lire<string>(`$(".o_ouafEnvoyer").text()`)).toBe("⏳ Envoi au suivi…");
    await attendre();
    expect(page.lire<string>(`$(".o_ouafEnvoyer").text()`)).toBe("📤 Envoyer au suivi");
    expect(page.lire<string>(`$(".o_convoisOuafPanne").text()`)).toContain("ne répond pas");
    expect(page.lire<string[]>(`toasts`).join(" ")).toContain("rien n'a été envoyé");
    // second clic pendant la pause : pas de nouvelle attente
    page.lire(`requetes.length = 0; toasts.length = 0; $(".o_ouafEnvoyer").trigger("click")`);
    await attendre();
    expect(page.lire(`requetes`)).toEqual([]);
    expect(page.lire<string[]>(`toasts`).join(" ")).toContain("rien n'a été envoyé");
  });

  test("message dans le Récapitulatif quand il est affiché", () => {
    page.lire(`(() => {
      document.body.innerHTML = '<div id="centre"><div id="o_convoisMembres"><table class="o_convoisMembres"></table></div></div>';
      CommerceFzzz.signalerSuiviOuaf(OUAF_PANNE);
    })()`);
    expect(
      page.lire<boolean>(`$("#o_convoisMembres .o_convoisOuafPanne").next().is("table")`),
    ).toBe(true);
  });
});

describe("session du site non gardée par le navigateur (Userscripts sur iPhone, journal du 20 au 22/11/2026)", () => {
  const connexion = `{ ok: true, statut: 200, donnees: { connecte: true, pseudo: "Alpha" } }`;
  const refus = `{ ok: false, statut: 401, donnees: { detail: "Entre ton mot de passe pour continuer." } }`;
  const lire = `OuafSuivi.connecter().then(() => OuafSuivi.requete("GET", "/api/mes"))`;
  const neuf = () =>
    page.lire(
      `(() => { connexionOuaf = null; sessionOuaf = false; localStorage.removeItem("fzzz_ouafSessionPrevenu"); })()`,
    );

  test("refus après une connexion acceptée : reconnexion et nouvel essai ; refusé encore : erreur claire, joueur prévenu une fois", async () => {
    site(`(m) => Promise.resolve(m.chemin == "/api/session" ? ${connexion} : ${refus})`);
    neuf();
    page.lire(`(() => {
      window.NIVEAUX = [];
      Journal.info = () => NIVEAUX.push("info");
      Journal.erreur = () => NIVEAUX.push("erreur");
    })()`);
    expect(await erreur(lire)).toBe(
      "session : Le site de suivi ne garde pas ta connexion dans ce navigateur (cela arrive avec Userscripts sur iPhone) : le Récapitulatif et ton profil du site n'y fonctionnent pas",
    );
    expect(page.lire(`requetes`)).toEqual([
      "POST /api/session",
      "GET /api/mes",
      "POST /api/session",
      "GET /api/mes",
    ]);
    expect(page.lire<string[]>(`toasts`)).toHaveLength(1);
    expect(page.lire<string[]>(`toasts`)[0]).toContain("Note tes convois directement sur le site");
    // cause connue et joueur prévenu : rien qui fasse partir le journal au fichier
    expect(page.lire<string[]>(`NIVEAUX`)).not.toContain("erreur");
    // déjà prévenu dans ce navigateur : plus de message
    await erreur(lire);
    expect(page.lire<string[]>(`toasts`)).toHaveLength(1);
  });

  test("session perdue (site redémarré) : la reconnexion suffit, sans message", async () => {
    site(
      `(m) => Promise.resolve(m.chemin == "/api/session" ? ${connexion} : ++window.lectures == 1 ? ${refus} : { ok: true, statut: 200, donnees: { lignes: 2 } })`,
    );
    page.lire(`window.lectures = 0`);
    neuf();
    expect(await page.lire<Promise<object>>(lire)).toEqual({ lignes: 2 });
    expect(page.lire<string[]>(`toasts`)).toEqual([]);
  });

  test("deux lectures refusées ensemble : une seule reconnexion", async () => {
    site(
      `(m) => Promise.resolve(m.chemin == "/api/session" ? ${connexion} : ++window.lectures <= 2 ? ${refus} : { ok: true, statut: 200, donnees: { lignes: 1 } })`,
    );
    page.lire(`window.lectures = 0`);
    neuf();
    expect(
      await page.lire<Promise<object[]>>(
        `OuafSuivi.connecter().then(() => Promise.all([OuafSuivi.requete("GET", "/api/mes"), OuafSuivi.requete("GET", "/api/avances")]))`,
      ),
    ).toEqual([{ lignes: 1 }, { lignes: 1 }]);
    expect(page.lire<string[]>(`requetes`).filter((r) => r == "POST /api/session")).toHaveLength(2);
  });

  test("refus sans connexion acceptée sur cette page : pas de nouvel essai, le message du site", async () => {
    site(`() => Promise.resolve(${refus})`);
    neuf();
    expect(await erreur(`OuafSuivi.requete("GET", "/api/mes")`)).toBe(
      "Error : Entre ton mot de passe pour continuer.",
    );
    expect(page.lire(`requetes`)).toEqual(["GET /api/mes"]);
  });
});

describe("page Convois : session non gardée", () => {
  test("« Envoyer au suivi » : rien n'est envoyé, et le joueur sait pourquoi", async () => {
    site(
      `(m) => Promise.resolve(m.chemin == "/api/session" ? { ok: true, statut: 200, donnees: { connecte: true, pseudo: "Alpha" } } : { ok: false, statut: 401, donnees: { detail: "Entre ton mot de passe pour continuer." } })`,
    );
    page.lire(`(() => {
      connexionOuaf = null; sessionOuaf = false; localStorage.removeItem("fzzz_ouafSessionPrevenu");
      ConvoisForum.notes = () => Promise.resolve([]);
      document.body.innerHTML = '<div id="centre"><h3>Convois en cours:</h3><strong>- Vous allez livrer 0 nourriture et 466 945 matériaux à <a href="Membre.php?Pseudo=Kwhwwymwn">Kwhwwymwn</a> dans 1h 00m 00s</strong> - <a href="commerce.php?annuler=101">Annuler</a><br/><h3>Fin</h3></div>';
      CommerceFzzz.suiviOuaf();
    })()`);
    await new Promise((r) => setTimeout(r, 50));
    page.lire(`$(".o_ouafEnvoyer").trigger("click")`);
    await new Promise((r) => setTimeout(r, 50));
    // texte affiché des notifications (leur texte est du HTML)
    const textes = page.lire<string[]>(`toasts.map((t) => $("<div>").html(t).text())`);
    expect(textes).toHaveLength(2);
    expect(textes[1]).toBe(
      "Le site de suivi ne garde pas ta connexion dans ce navigateur (cela arrive avec Userscripts sur iPhone) : le Récapitulatif et ton profil du site n'y fonctionnent pas. Rien n'a été envoyé.",
    );
    expect(
      page.lire(`requetes`).filter((r: string) => r.startsWith("P") && r != "POST /api/session"),
    ).toEqual([]);
  });
});
