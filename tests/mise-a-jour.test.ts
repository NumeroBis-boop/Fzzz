import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

const FINALE = "https://raw.githubusercontent.com/NumeroBis-boop/Fzzz/main/fzzz.user.js";
const TEST = "https://raw.githubusercontent.com/NumeroBis-boop/Fzzz/test/fzzz-test.user.js";

const page = creerPage(
  ["js/class/Utils.js", "js/class/MiseAJour.js", "js/boite/Dock.js"],
  `var VERSION = "1.85.1";
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

  test("plus récente : signalée ; une seule lecture par heure", async () => {
    remettre("1.85.2");
    expect(await verifier(FINALE, "1.85.1")).toBe("1.85.2");
    expect(await verifier(FINALE, "1.85.1")).toBe("1.85.2");
    expect(lectures()).toBe(1);
    // une heure plus tard : nouvelle lecture
    page.lire(`(() => {
      let lu = JSON.parse(localStorage.getItem("fzzz_majVerification"));
      lu.t -= 3600001;
      localStorage.setItem("fzzz_majVerification", JSON.stringify(lu));
    })()`);
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

  test("GitHub injoignable : rien, et pas de nouvel essai avant une heure", async () => {
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
      document.body.innerHTML = '<div id="o_boiteExtension"><div class="contenu_boite_compte_plus"></div></div>';
      Dock.signalerMiseAJour($("#o_boiteExtension"));
    })()`);
    await new Promise((r) => setTimeout(r, 20));
    return page.lire<{ texte: string; lien: string | undefined }>(
      `({ texte: $(".o_majDisponible").text(), lien: $(".o_majDisponible a").attr("href") })`,
    );
  };

  test("nouvelle version : ligne avec le lien du script", async () => {
    remettre("1.85.2");
    expect(await encadre(true)).toEqual({
      texte: "Nouvelle version v1.85.2 : mettre à jour",
      lien: FINALE,
    });
  });

  const cible = () => page.lire<string | undefined>(`$(".o_majDisponible a").attr("target")`);

  test("Violentmonkey : le lien s'ouvre dans l'onglet du jeu, sa page d'installation dans un nouvel onglet (sinon un onglet vide de plus sur Firefox Android)", async () => {
    remettre("1.85.2");
    expect((await encadre(true, "Violentmonkey")).lien).toBe(FINALE);
    expect(cible()).toBeUndefined();
  });

  test("Tampermonkey, Userscripts (iPhone) ou gestionnaire inconnu : nouvel onglet, le jeu garde le sien", async () => {
    for (const gestionnaire of ["Tampermonkey", "Userscripts", null]) {
      remettre("1.85.2");
      await encadre(true, gestionnaire);
      expect(cible()).toBe("_blank");
    }
  });

  test("déjà à jour, ou extension de navigateur : rien", async () => {
    remettre("1.85.1");
    expect((await encadre(true)).texte).toBe("");
    remettre("1.85.2");
    expect((await encadre(false)).texte).toBe("");
    expect(lectures()).toBe(0);
  });
});
