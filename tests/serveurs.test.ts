import { describe, expect, test } from "bun:test";
import { creerPage, type Page } from "./harnais";

/**
 * Extension sur les serveurs s1 à s5 (choix du mainteneur, 17/11/2026) : ce
 * qui est propre à la OUAF reste sur le s5 (site de suivi des convois, liste
 * des chasseurs, droits du mainteneur), et le stockage de l'extension, commun
 * à tous les serveurs au contraire du localStorage du jeu, est rangé par
 * serveur. Joueurs inventés, sauf les listes du mainteneur.
 */
const S1 = "https://s1.fourmizzz.fr/commerce.php";
const S5 = "https://s5.fourmizzz.fr/commerce.php";

const SCRIPTS_JOUEUR = [
  "js/lib/jquery-ui_1.12.1.js",
  "js/class/Utils.js",
  "js/class/Parametre.js",
  "js/class/Joueur.js",
];
const CONSTANTES = `var METHODE_FLOOD = ["Standard", "Optimisée", "Uniforme", "Dégressive"],
   AFFECTATION_RESSOURCE = [], RATIO_RECOLTE = {}, TOAST_INFO = {};
 var NOM_UNITE = ["Ouvrière", "Jeune Soldate Naine"], NOM_UNITES = ["Ouvrières", "Jeunes Soldates Naines"];`;

// stockage de l'extension (ou du gestionnaire de scripts) : le même pour les
// pages de tous les serveurs
function stockageCommun() {
  const valeurs: Record<string, unknown> = {};
  return {
    valeurs,
    storage: {
      local: {
        get: (c: string) => Promise.resolve(c in valeurs ? { [c]: valeurs[c] } : {}),
        set: (o: Record<string, unknown>) => (Object.assign(valeurs, o), Promise.resolve()),
        remove: (c: string) => (delete valeurs[c], Promise.resolve()),
      },
    },
  };
}
function avecStockage(page: Page, chrome: ReturnType<typeof stockageCommun>) {
  (page.window as any).chrome = { storage: chrome.storage };
  return page;
}

describe("droits propres à la OUAF : sur le s5 seulement", () => {
  test("journal et boutons du mainteneur : son compte du s5, pas un homonyme ailleurs", () => {
    const s5 = creerPage(["js/class/Utils.js"], "", S5),
      s1 = creerPage(["js/class/Utils.js"], "", S1);
    expect(s5.lire(`Journal.pourCeJoueur("DoggyBag")`)).toBe(true);
    expect(s5.lire(`Journal.pourCeJoueur("Bidule")`)).toBe(false);
    expect(s1.lire(`Journal.pourCeJoueur("DoggyBag")`)).toBe(false);
    // le compte du mainteneur est sur le serveur de la OUAF
    expect(s5.lire(`JOURNAL_SERVEUR == SERVEUR_OUAF`)).toBe(true);
  });

  test("chasseurs par défaut : ceux de la OUAF, pas un homonyme d'un autre serveur", () => {
    const role = (url: string) =>
      creerPage(SCRIPTS_JOUEUR, CONSTANTES, url).lire<number>(`(() => {
        localStorage.setItem("fzzz_methodeDegressive", "1");
        return parseInt(new Joueur({ pseudo: "Grim" }).getParametre().parametre.role.valeur);
      })()`);
    expect(role(S5)).toBe(3);
    expect(role(S1)).toBe(0);
    expect(creerPage(SCRIPTS_JOUEUR, CONSTANTES, S1).lire(`Joueur.chasseurParDefaut("Grim")`)).toBe(
      false,
    );
  });
});

describe("stockage commun à tous les serveurs", () => {
  test("clés : celles d'avant sur le s5, une par serveur ailleurs", () => {
    expect(
      creerPage(["js/class/Utils.js"], "", S5).lire(`Utils.cleServeur("fzzz_exportSheet")`),
    ).toBe("fzzz_exportSheet");
    expect(
      creerPage(["js/class/Utils.js"], "", S1).lire(`Utils.cleServeur("fzzz_exportSheet")`),
    ).toBe("fzzz_exportSheet_s1");
  });

  test("feuilles Google : un même pseudo sur deux serveurs ne mélange pas les adresses", async () => {
    const commun = stockageCommun(),
      scripts = ["js/class/Utils.js", "js/class/ExportRapports.js"],
      s5 = avecStockage(creerPage(scripts, "", S5), commun),
      s1 = avecStockage(creerPage(scripts, "", S1), commun),
      adresse = (n: string) => `https://script.google.com/macros/s/${n}/exec`;
    await s5.lire(`ExportRapports.enregistrerAdresse("${adresse("AAA")}")`);
    expect(await s1.lire(`ExportRapports.adressePersonnelle()`)).toBe("");
    await s1.lire(`ExportRapports.enregistrerAdresse("${adresse("BBB")}")`);
    expect(await s5.lire(`ExportRapports.adressePersonnelle()`)).toBe(adresse("AAA"));
    expect(await s1.lire(`ExportRapports.adressePersonnelle()`)).toBe(adresse("BBB"));
    // dernière lecture du forum de l'alliance (adresse de son fichier) : par serveur aussi
    await s1.lire(`ExportRapports._garder(CLE_EXPORT_SHEET_ALLIANCE, "{}")`);
    expect(Object.keys(commun.valeurs).sort()).toEqual([
      "fzzz_exportSheet",
      "fzzz_exportSheetAlliance_s1",
      "fzzz_exportSheet_s1",
    ]);
  });
});

describe("suivi des convois de la OUAF : sur le s5 seulement", () => {
  test("mot de passe du site : jamais lu sur un autre serveur", async () => {
    const commun = stockageCommun(),
      scripts = ["js/class/Utils.js", "js/class/OuafSuivi.js"];
    commun.valeurs.fzzz_ouafCode = "code-invente";
    expect(
      await avecStockage(creerPage(scripts, "", S5), commun).lire(`OuafSuivi.lireCode()`),
    ).toBe("code-invente");
    expect(
      await avecStockage(creerPage(scripts, "", S1), commun).lire(`OuafSuivi.lireCode()`),
    ).toBe("");
  });

  test("page Convois : ni état de suivi ni Récapitulatif hors du s5", () => {
    const ouvrir = (url: string) => {
      const p = creerPage(
        ["js/class/Utils.js", "js/class/OuafSuivi.js", "js/page/CommerceFzzz.js"],
        "var TOAST_INFO = {}; var Horloge = { maintenant: () => 0 };",
        url,
      );
      p.lire(`window.lus = [];
        OuafSuivi.convoisJeu = () => (lus.push("convois"), []);
        OuafSuivi.lireCode = () => (lus.push("code"), Promise.resolve(""));
        CommerceFzzz.suiviOuaf();`);
      return p;
    };
    const s1 = ouvrir(S1);
    s1.lire(`CommerceFzzz.membresSuivis()`);
    expect(s1.lire(`lus`)).toEqual([]);
    expect(s1.lire(`$("#o_convoisMembres, .o_ouafLigne").length`)).toBe(0);
    // sur le s5, le suivi lit les convois de la page
    expect(ouvrir(S5).lire(`lus`)).toEqual(["convois"]);
  });

  test("Préférences → Convois : une phrase au lieu du suivi hors du s5", () => {
    const p = creerPage(
      ["js/class/Utils.js", "js/boite/Boite.js", "js/boite/Parametres.js"],
      "",
      S1,
    );
    p.lire(`document.body.innerHTML = '<div id="o_tabsParametreConvois"></div>';
      BoiteParametre.prototype.ongletConvois.call(BoiteParametre.prototype)`);
    expect(p.lire<string>(`$("#o_tabsParametreConvois").text()`)).toBe(
      "Le suivi des convois de la OUAF (site de suivi, Récapitulatif de la page Convois, convoi avant la récolte) ne fonctionne que sur le serveur s5.",
    );
    expect(p.lire(`$("#o_ouafCode").length`)).toBe(0);
  });
});
