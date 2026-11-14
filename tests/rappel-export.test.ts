import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Rappel « Export des chasses à faire » (rôle Chasseur, 1.97.0) : à partir du
 * mercredi et du dimanche 22h, heure du serveur, jusqu'à l'export des chasses ;
 * un export des 24 h d'avant compte (1.97.1 : deux exports par semaine, le jeu
 * supprime les conversations lues au bout de 7 jours). Aucune requête au jeu :
 * un bandeau avec un lien vers le bouton « Exporter mes chasses », dans la
 * messagerie s'il y est affiché, sinon dans les Préférences (14/11/2026).
 */
const page = creerPage(
  [
    "js/lib/jquery-ui_1.12.1.js",
    "js/class/Utils.js",
    "js/class/Parametre.js",
    "js/class/Joueur.js",
    "js/class/RappelExport.js",
    "js/class/ExportRapports.js",
  ],
  `var METHODE_FLOOD = ["Standard", "Optimisée", "Uniforme", "Dégressive"],
     AFFECTATION_RESSOURCE = [], RATIO_RECOLTE = {}, TOAST_INFO = {};
   var NOM_UNITE = ["Ouvrière", "Jeune Soldate Naine"], NOM_UNITES = ["Ouvrières", "Jeunes Soldates Naines"];
   var heure = 0;
   var Horloge = { maintenant: () => heure, serveur: () => moment(heure) };
   var ONGLETS_OUVERTS = [], BoiteParametre = { ouvrirOnglet: (id) => ONGLETS_OUVERTS.push(id) };`,
);
page.lire(`$.toast = () => {}`);

const regler = (quand: string) =>
  page.lire(`heure = moment(${JSON.stringify(quand)}, "YYYY-MM-DD HH:mm").valueOf()`);
const dernier = (quand: string) => {
  regler(quand);
  return page.lire<string>(`RappelExport.dernier(Horloge.serveur()).format("ddd DD/MM HH:mm")`);
};
// joueur au rôle donné, rien d'exporté
const profil = (role: number) =>
  page.lire(`(() => {
    localStorage.clear();
    localStorage.setItem("fzzz_reserveEnPlus", "1");
    localStorage.setItem("fzzz_methodeDegressive", "1");
    window.monProfil = new Joueur({ pseudo: "Moi" }).getParametre();
    monProfil.parametre.role.valeur = ${role};
  })()`);
const aRappeler = () => page.lire<boolean>(`RappelExport.aRappeler()`);

describe("rôle Chasseur par défaut pour les chasseurs de l'alliance (liste du mainteneur)", () => {
  // réglages enregistrés par ce navigateur (tous ensemble), puis page ouverte par ce pseudo
  const ouvrir = (pseudo: string, enregistres: Record<string, unknown> | null = null) =>
    page.lire<number>(`(() => {
      localStorage.setItem("fzzz_reserveEnPlus", "1");
      localStorage.setItem("fzzz_methodeDegressive", "1");
      ${enregistres ? `localStorage.setItem("outiiil_parametre", ${JSON.stringify(JSON.stringify(enregistres))});` : ""}
      window.monProfil = new Joueur({ pseudo: ${JSON.stringify(pseudo)} }).getParametre();
      return parseInt(monProfil.parametre.role.valeur);
    })()`);
  const enregistre = () =>
    page.lire<any>(`JSON.parse(localStorage.getItem("outiiil_parametre") || "null")`);

  test("les neuf joueurs de la liste, casse ignorée ; les autres restent sans rôle", () => {
    expect(page.lire(`CHASSEURS_PAR_DEFAUT`)).toEqual([
      "DoggyBag",
      "Grim",
      "Harkonnen",
      "Staffie",
      "Madakai",
      "LabraDrungor",
      "Cocop",
      "Daek",
      "Vegas",
    ]);
    for (const pseudo of ["DoggyBag", "grim", "HARKONNEN", " Vegas "]) {
      page.lire(`localStorage.clear()`);
      expect(ouvrir(pseudo)).toBe(3);
    }
    for (const pseudo of ["Canaille", "Doggy", "DoggyBag2", ""]) {
      page.lire(`localStorage.clear()`);
      expect(ouvrir(pseudo)).toBe(0);
      expect(page.lire(`localStorage.getItem("fzzz_roleChasseurDefaut")`)).toBeNull();
    }
  });

  test("« Aucun » enregistré sans avoir été choisi : passé en Chasseur, enregistré, une seule fois", () => {
    page.lire(`localStorage.clear()`);
    expect(ouvrir("Staffie", { role: 0, methodeFlood: 2 })).toBe(3);
    expect(enregistre()).toMatchObject({ role: 3, methodeFlood: 2 });
    // page suivante : le rôle enregistré est gardé
    expect(ouvrir("Staffie")).toBe(3);
    // le joueur choisit ensuite « Aucun » : son choix reste
    expect(ouvrir("Staffie", { role: 0 })).toBe(0);
    expect(ouvrir("Staffie")).toBe(0);
  });

  test("Passeur ou Grenier déjà choisi : pas touché, ni plus tard", () => {
    for (const role of [1, 2]) {
      page.lire(`localStorage.clear()`);
      expect(ouvrir("Madakai", { role })).toBe(role);
      expect(page.lire(`localStorage.getItem("fzzz_roleChasseurDefaut")`)).toBe("1");
      expect(ouvrir("Madakai", { role: 0 })).toBe(0);
    }
  });

  test("devenu Chasseur par défaut : le rappel d'export le concerne", () => {
    regler("2026-11-11 22:30");
    page.lire(`localStorage.clear()`);
    ouvrir("Cocop");
    expect(aRappeler()).toBe(true);
    page.lire(`localStorage.clear()`);
    ouvrir("Canaille");
    expect(aRappeler()).toBe(false);
  });
});

describe("rendez-vous d'export : mercredi et dimanche à 22h", () => {
  test("dernier rendez-vous passé", () => {
    expect(page.lire(`[moment("2026-11-11").day(), moment("2026-11-15").day()]`)).toEqual([3, 0]);
    expect(dernier("2026-11-11 21:59")).toBe("dim. 08/11 22:00");
    expect(dernier("2026-11-11 22:00")).toBe("mer. 11/11 22:00");
    expect(dernier("2026-11-12 09:00")).toBe("mer. 11/11 22:00");
    expect(dernier("2026-11-15 21:00")).toBe("mer. 11/11 22:00");
    expect(dernier("2026-11-15 23:30")).toBe("dim. 15/11 22:00");
    expect(dernier("2026-11-16 08:00")).toBe("dim. 15/11 22:00");
  });
});

describe("rappel : rôle Chasseur seulement, jusqu'à l'export", () => {
  test("Chasseur sans export : rappel ; Passeur, Grenier ou sans rôle : rien", () => {
    regler("2026-11-11 22:30");
    profil(3);
    expect(aRappeler()).toBe(true);
    for (const role of [0, 1, 2]) {
      profil(role);
      expect(aRappeler()).toBe(false);
    }
  });

  test("export fait : plus de rappel jusqu'au rendez-vous suivant", () => {
    regler("2026-11-11 22:30");
    profil(3);
    page.lire(`RappelExport.noterExport()`);
    expect(aRappeler()).toBe(false);
    regler("2026-11-15 21:59");
    expect(aRappeler()).toBe(false);
    regler("2026-11-15 22:00");
    expect(aRappeler()).toBe(true);
  });

  const exporterA = (quand: string) => {
    regler(quand);
    page.lire(`RappelExport.noterExport()`);
  };

  test("export dans les 24 h avant le rendez-vous : il compte", () => {
    profil(3);
    exporterA("2026-11-11 21:50");
    expect(aRappeler()).toBe(false);
    regler("2026-11-11 22:30");
    expect(aRappeler()).toBe(false);
    // le rendez-vous suivant demande son propre export
    regler("2026-11-15 22:00");
    expect(aRappeler()).toBe(true);
    profil(3);
    exporterA("2026-11-10 22:00");
    regler("2026-11-11 22:00");
    expect(aRappeler()).toBe(false);
    profil(3);
    exporterA("2026-11-10 21:59");
    regler("2026-11-11 22:00");
    expect(aRappeler()).toBe(true);
  });

  test("deux exports par semaine : un export juste après dimanche 22h ne vaut pas pour mercredi", () => {
    profil(3);
    exporterA("2026-11-08 22:05");
    regler("2026-11-11 21:59");
    expect(aRappeler()).toBe(false);
    regler("2026-11-11 22:00");
    expect(aRappeler()).toBe(true);
  });

  test("boutons de la messagerie décochés ou messagerie désactivée : le rappel reste (bouton des Préférences)", () => {
    regler("2026-11-11 22:30");
    profil(3);
    page.lire(`localStorage.setItem("fzzz_affichage_messagerieExport", "0")`);
    expect(aRappeler()).toBe(true);
    expect(page.lire(`RappelExport.boutonMessagerie()`)).toBe(false);
    profil(3);
    page.lire(
      `localStorage.setItem("fzzz_affichage_messagerieExport", "1"); localStorage.setItem("fzzz_origine_Messagerie", "1")`,
    );
    expect(aRappeler()).toBe(true);
    expect(page.lire(`RappelExport.boutonMessagerie()`)).toBe(false);
  });

  test("croix : masqué une heure ; case décochée ou Général d'origine : rien", () => {
    regler("2026-11-11 22:30");
    profil(3);
    page.lire(`localStorage.setItem("fzzz_rappelExportMasque", String(heure + 3600000))`);
    expect(aRappeler()).toBe(false);
    regler("2026-11-11 23:31");
    expect(aRappeler()).toBe(true);
    page.lire(`localStorage.setItem("fzzz_affichage_rappelExport", "0")`);
    expect(aRappeler()).toBe(false);
    page.lire(
      `localStorage.removeItem("fzzz_affichage_rappelExport"); localStorage.setItem("fzzz_origine_General", "1")`,
    );
    expect(aRappeler()).toBe(false);
  });
});

describe("bandeau du rappel", () => {
  const afficher = (chemin: string, boutonMessagerie = true) => {
    regler("2026-11-11 22:30");
    profil(3);
    if (boutonMessagerie) page.lire(`localStorage.setItem("fzzz_affichage_messagerieExport", "1")`);
    return page.lire<{ texte: string; lien: string | null }>(`(() => {
      history.replaceState(null, "", ${JSON.stringify(chemin)});
      document.body.innerHTML = "<div id='menu'></div><div id='centre'></div>";
      RappelExport.afficher();
      let $b = $("#o_rappelExport");
      return $b.length ? { texte: $b.find(".o_rappelExportTexte").text(), lien: $b.find("a").attr("href") || null } : null;
    })()`);
  };

  test("bouton de la messagerie décoché (par défaut) : un clic ouvre les Préférences sur « Partage de données »", () => {
    const preferences = {
      texte:
        "Export des chasses à faire : ouvre les Préférences (onglet « Partage de données ») et clique sur « Exporter mes chasses ».",
      lien: "#",
    };
    expect(afficher("/Ressources.php", false)).toEqual(preferences);
    expect(afficher("/messagerie.php", false)).toEqual(preferences);
    page.lire(`(() => { ONGLETS_OUVERTS.length = 0; $(".o_rappelExportTexte").click(); })()`);
    expect(page.lire(`ONGLETS_OUVERTS`)).toEqual(["Partage"]);
  });

  test("bouton de la messagerie affiché : lien vers la messagerie ; dans la messagerie, le bouton à cliquer", () => {
    expect(afficher("/Ressources.php")).toEqual({
      texte:
        "Export des chasses à faire : ouvre la messagerie et clique sur « Exporter mes chasses ».",
      lien: "/messagerie.php",
    });
    expect(afficher("/messagerie.php")).toEqual({
      texte: "Export des chasses à faire : clique sur « Exporter mes chasses ».",
      lien: null,
    });
  });

  test("pas sur les pages Armée et d'attaque (les boutons bougeraient sous le doigt)", () => {
    expect(afficher("/Armee.php")).toBeNull();
    expect(afficher("/ennemie.php?Attaquer=12")).toBeNull();
  });

  test("export fait : bandeau et cadre du bouton retirés", () => {
    afficher("/messagerie.php");
    page.lire(
      `$("body").append("<div id='o_partageAlliance'><button data-quoi='chasse' class='o_synchroPret'></button></div><button class='o_exporterRapports o_synchroPret' data-quoi='chasse'></button>")`,
    );
    page.lire(`RappelExport.noterExport()`);
    expect(page.lire(`[$("#o_rappelExport").length, $(".o_synchroPret").length]`)).toEqual([0, 0]);
  });

  test("croix : bandeau retiré et masqué une heure", () => {
    afficher("/Ressources.php");
    page.lire(`$(".o_rappelExportFermer").click()`);
    expect(page.lire(`$("#o_rappelExport").length`)).toBe(0);
    expect(page.lire(`Number(localStorage.getItem("fzzz_rappelExportMasque")) - heure`)).toBe(
      3600000,
    );
  });
});

describe("l'export des chasses note l'heure, pas celui des RC", () => {
  test("rien de nouveau à exporter : export des chasses fait", async () => {
    regler("2026-11-11 22:30");
    profil(3);
    await page.lire(`ExportRapports._exporterListees("combat", [], "x")`);
    expect(aRappeler()).toBe(true);
    await page.lire(`ExportRapports._exporterListees("chasse", [], "x")`);
    expect(page.lire(`Number(localStorage.getItem("fzzz_exportChassesFait"))`)).toBe(
      page.lire<number>(`heure`),
    );
    expect(aRappeler()).toBe(false);
  });
});
