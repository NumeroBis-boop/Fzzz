import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { creerPage } from "./harnais";

const FINALE = "https://raw.githubusercontent.com/NumeroBis-boop/Fzzz/main/fzzz.user.js";
const TEST = "https://raw.githubusercontent.com/NumeroBis-boop/Fzzz/test/fzzz-test.user.js";

const page = creerPage(
  [
    "js/class/Utils.js",
    "js/class/MiseAJour.js",
    "js/boite/Boite.js",
    "js/boite/Dock.js",
    "js/boite/Parametres.js",
  ],
  `var VERSION = "1.85.1", NOM_EXTENSION = "Extension OUAF";
   // GitHub simulé : version publiée, lectures comptées
   var publiee = "1.85.2", lectures = 0, enPanne = false;
   window.fetch = (url) => {
     lectures++;
     if (enPanne) return Promise.reject(new Error("réseau"));
     return Promise.resolve({ ok: true, text: () => Promise.resolve("// ==UserScript==\\n// @name           Fzzz\\n// @version        " + publiee + "\\n// ==/UserScript==\\n") });
   };`,
);
const verifier = (adresse: string, installee: string) =>
  page.lire<Promise<string | null>>(
    `MiseAJour.verifier(${JSON.stringify(adresse)}, ${JSON.stringify(installee)})`,
  );
const remettre = (publiee: string) =>
  page.lire(
    `localStorage.clear(); lectures = 0; enPanne = false; publiee = ${JSON.stringify(publiee)}`,
  );
const lectures = () => page.lire<number>(`lectures`);

describe("nouvelle version publiée du script utilisateur", () => {
  test("version lue dans l'en-tête du script, TEST compris", () => {
    expect(
      page.lire(`MiseAJour.versionPubliee("// ==UserScript==\\n// @version        1.85.2\\n")`),
    ).toBe("1.85.2");
    expect(page.lire(`MiseAJour.versionPubliee("// @version 1.85.1.202611061519")`)).toBe(
      "1.85.1.202611061519",
    );
    expect(page.lire(`MiseAJour.versionPubliee("<html>introuvable</html>")`)).toBeNull();
  });

  test("versions comparées partie par partie, horodatage de TEST compris", () => {
    expect(page.lire<number>(`MiseAJour.comparer("1.85.2", "1.85.1")`)).toBeGreaterThan(0);
    expect(page.lire<number>(`MiseAJour.comparer("1.10.0", "1.9.9")`)).toBeGreaterThan(0);
    expect(
      page.lire<number>(`MiseAJour.comparer("1.85.1.202611061519", "1.85.1.202611061517")`),
    ).toBeGreaterThan(0);
    expect(page.lire<number>(`MiseAJour.comparer("1.85.1", "1.85.1")`)).toBe(0);
  });

  test("plus récente : signalée ; une seule lecture par 24 h", async () => {
    remettre("1.85.2");
    expect(await verifier(FINALE, "1.85.1")).toBe("1.85.2");
    expect(await verifier(FINALE, "1.85.1")).toBe("1.85.2");
    expect(lectures()).toBe(1);
    let reculer = (ms: number) =>
      page.lire(`(() => {
        let lu = JSON.parse(localStorage.getItem("fzzz_majVerification"));
        lu.t -= ${ms};
        localStorage.setItem("fzzz_majVerification", JSON.stringify(lu));
      })()`);
    // une heure plus tard : pas de nouvelle lecture (une par heure jusqu'en 1.136)
    reculer(3600001);
    await verifier(FINALE, "1.85.1");
    expect(lectures()).toBe(1);
    // 24 h après la lecture : nouvelle lecture
    reculer(23 * 3600000);
    await verifier(FINALE, "1.85.1");
    expect(lectures()).toBe(2);
  });

  test("même version ou plus ancienne : rien", async () => {
    remettre("1.85.1");
    expect(await verifier(FINALE, "1.85.1")).toBeNull();
    remettre("1.85.0");
    expect(await verifier(FINALE, "1.85.1")).toBeNull();
  });

  test("autre adresse (TEST après la version finale) : relue tout de suite", async () => {
    remettre("1.85.1.202611061519");
    await verifier(FINALE, "1.85.1.202611061517");
    expect(await verifier(TEST, "1.85.1.202611061517")).toBe("1.85.1.202611061519");
    expect(lectures()).toBe(2);
  });

  test("GitHub injoignable : rien, et pas de nouvel essai avant 24 h", async () => {
    remettre("1.85.2");
    page.lire(`enPanne = true`);
    expect(await verifier(FINALE, "1.85.1")).toBeNull();
    expect(await verifier(FINALE, "1.85.1")).toBeNull();
    expect(lectures()).toBe(1);
  });
});

describe("encadré « Extension OUAF »", () => {
  const encadre = async (scriptUtilisateur: boolean, gestionnaire: string | null = null) => {
    page.lire(`(() => {
      ${scriptUtilisateur ? "window.FZZZ_USERSCRIPT = true;" : "delete window.FZZZ_USERSCRIPT;"}
      ${gestionnaire ? `window.GM_info = { scriptHandler: ${JSON.stringify(gestionnaire)} };` : "delete window.GM_info;"}
      window.chrome = { runtime: { sendMessage: () => Promise.resolve({ statut: "userscript", url: ${JSON.stringify(FINALE)} }) } };
      document.body.innerHTML = '<div id="o_boiteExtension" class="boite_compte_plus"><div class="titre_colonne_cliquable"><span class="o_versionExtension" title="Version installée">v1.85.1</span></div><div class="contenu_boite_compte_plus"></div></div>';
      Dock.signalerMiseAJour($("#o_boiteExtension"));
    })()`);
    await new Promise((r) => setTimeout(r, 20));
    return page.lire<{ texte: string; lien: string | undefined }>(
      `({ texte: $(".o_majDisponible").text(), lien: $(".o_majDisponible a").attr("href") })`,
    );
  };

  test("nouvelle version : toute la ligne est le lien du script", async () => {
    remettre("1.85.2");
    expect(await encadre(true)).toEqual({
      texte: "Nouvelle version v1.85.2 : mettre à jour",
      lien: FINALE,
    });
    expect(page.lire(`$(".o_majDisponible a").text()`)).toBe(
      "Nouvelle version v1.85.2 : mettre à jour",
    );
  });

  const cible = () => page.lire<string | undefined>(`$(".o_majDisponible a").attr("target")`);

  /**
   * Clic sur le lien, onglet ouvert simulé (`onglet` : expression de l'onglet
   * que window.open rend) ; minuteries relevées puis exécutées.
   */
  const cliquer = (onglet = `{ location: { href: "about:blank" } }`) =>
    page.lire<{
      empeche: boolean;
      ouverts: string[][];
      delais: number[];
      ferme: boolean;
      opener: unknown;
    }>(`(() => {
      let decrit = ${onglet},
        ongletOuvert = decrit && Object.assign(decrit, { closed: false, opener: window, close() { this.closed = true; } }),
        ouverts = [], minuteries = [], minuterie = window.setTimeout, ouvrir = window.open, empeche;
      window.open = (url, cible) => { ouverts.push([url, cible]); return ongletOuvert; };
      window.setTimeout = (f, ms) => minuteries.push([f, ms]);
      // après le gestionnaire du lien : le clic n'ouvre rien dans la page de test
      document.addEventListener("click", (e) => { empeche = e.defaultPrevented; e.preventDefault(); }, { once: true });
      try {
        $(".o_majDisponible a")[0].click();
      } finally {
        window.setTimeout = minuterie;
        window.open = ouvrir;
      }
      minuteries.forEach(([f]) => f());
      return { empeche, ouverts, delais: minuteries.map(([, ms]) => ms), ferme: !!ongletOuvert && ongletOuvert.closed, opener: ongletOuvert && ongletOuvert.opener };
    })()`);

  test("Violentmonkey : nouvel onglet au premier plan, que sa page d'installation remplace ; resté vide, il est refermé (Firefox Android, 22/11/2026)", async () => {
    remettre("1.85.2");
    expect((await encadre(true, "Violentmonkey")).lien).toBe(FINALE);
    expect(cible()).toBe("_blank");
    expect(cliquer()).toEqual({
      empeche: true,
      ouverts: [[FINALE, "_blank"]],
      delais: [3000],
      ferme: true,
      opener: null,
    });
  });

  test("Violentmonkey : onglet passé sur une autre page (gestionnaire, script) gardé ; ouverture refusée : le lien s'ouvre seul", async () => {
    remettre("1.85.2");
    await encadre(true, "Violentmonkey");
    // une page d'une autre origine refuse la lecture de son adresse
    const autre = cliquer(`{ location: { get href() { throw new Error("SecurityError"); } } }`);
    expect([autre.empeche, autre.ferme]).toEqual([true, false]);
    expect(cliquer(`{ location: { href: "moz-extension://vm/confirm/index.html#1" } }`).ferme).toBe(
      false,
    );
    const refuse = cliquer(`null`);
    expect([refuse.empeche, refuse.delais]).toEqual([false, []]);
  });

  test("Tampermonkey, Userscripts (iPhone) ou gestionnaire inconnu : le lien ouvre un nouvel onglet, rien n'est refermé", async () => {
    for (const gestionnaire of ["Tampermonkey", "Userscripts", null]) {
      remettre("1.85.2");
      await encadre(true, gestionnaire);
      expect(cible()).toBe("_blank");
      const r = cliquer();
      expect([r.empeche, r.ouverts, r.delais]).toEqual([false, [], []]);
    }
  });

  test("Préférences → Général, « Mettre à jour l'extension » : même ouverture, l'onglet vide refermé seulement avec Violentmonkey", async () => {
    for (const [gestionnaire, delais] of [
      ["Violentmonkey", [3000]],
      ["Tampermonkey", []],
    ] as [string, number[]][]) {
      const r = await page.lire<
        Promise<{ ouverts: string[][]; delais: number[]; etat: string }>
      >(`(() => {
        window.GM_info = { scriptHandler: ${JSON.stringify(gestionnaire)} };
        window.chrome = { runtime: { sendMessage: () => Promise.resolve({ statut: "userscript", url: ${JSON.stringify(FINALE)} }) } };
        document.body.innerHTML = "<button id='b'></button><p id='e'></p>";
        let ouverts = [], minuteries = [], minuterie = window.setTimeout, ouvrir = window.open;
        window.open = (url, cible) => { ouverts.push([url, cible]); return { closed: false, location: { href: "about:blank" }, close() {} }; };
        window.setTimeout = (f, ms) => minuteries.push(ms);
        BoiteParametre.mettreAJour($("#b"), $("#e"));
        return Promise.resolve().then(() => new Promise((r) => minuterie(r, 0))).then(() => {
          window.setTimeout = minuterie;
          window.open = ouvrir;
          return { ouverts, delais: minuteries, etat: $("#e").text() };
        });
      })()`);
      expect(r.ouverts).toEqual([[FINALE, "_blank"]]);
      expect(r.delais).toEqual(delais);
      expect(r.etat).toContain("La dernière version du script s'ouvre");
    }
  });

  test("déjà à jour, ou extension de navigateur : pas de ligne de mise à jour", async () => {
    remettre("1.85.1");
    expect((await encadre(true)).texte).toBe("");
    remettre("1.85.2");
    expect((await encadre(false)).texte).toBe("");
    expect(lectures()).toBe(0);
  });

  const version = () =>
    page.lire<{ classes: string; titre: string }>(
      `({ classes: $(".o_versionExtension").attr("class"), titre: $(".o_versionExtension").attr("title") })`,
    );

  test("numéro de version : vert à jour, rouge quand une version plus récente est publiée", async () => {
    remettre("1.85.1");
    await encadre(true);
    expect(version()).toEqual({
      classes: "o_versionExtension o_versionAJour",
      titre: "Version installée : à jour",
    });
    // version publiée plus ancienne (TEST plus récente installée) : à jour aussi
    remettre("1.85.0");
    await encadre(true);
    expect(version().classes).toBe("o_versionExtension o_versionAJour");
    remettre("1.85.2");
    await encadre(true);
    expect(version()).toEqual({
      classes: "o_versionExtension o_versionAncienne",
      titre: "Version installée ; la v1.85.2 est publiée",
    });
  });

  test("version publiée inconnue (GitHub injoignable) ou extension de navigateur : couleur d'origine", async () => {
    remettre("1.85.2");
    page.lire(`enPanne = true`);
    await encadre(true);
    expect(version().classes).toBe("o_versionExtension");
    remettre("1.85.2");
    await encadre(false);
    expect(version().classes).toBe("o_versionExtension");
  });

  test("couleurs, et lien de mise à jour rouge et en gras, plus forts que le style des encadrés du jeu", () => {
    const css = readFileSync(join(import.meta.dir, "..", "public", "css", "outiiil.css"), "utf8"),
      regle = (selecteur: string) =>
        new RegExp(`${selecteur.replace(/[.]/g, "\\.")} \\{([^}]*)\\}`).exec(css)?.[1] ?? "";
    expect(regle(".o_versionExtension.o_versionAJour")).toContain("color: #7ddc6f");
    expect(regle(".o_versionExtension.o_versionAncienne")).toContain("color: #ff8a80");
    // le jeu : .boite_compte_plus a { font-weight: normal } ; plus précis que lui, lien visité compris
    const lien = regle(".boite_compte_plus .o_majDisponible a:visited");
    expect(lien).toContain("font-weight: bold");
    expect(lien).toContain("color: #ff8a80");
    expect(css).toContain(
      ".boite_compte_plus .o_majDisponible a,\n.boite_compte_plus .o_majDisponible a:visited {",
    );
  });
});
