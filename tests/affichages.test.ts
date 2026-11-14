import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Affichages que l'extension ajoute aux pages du jeu : une clé lue par
 * Utils.affichage est déclarée dans AFFICHAGES_FZZZ ou AFFICHAGES_CONVOIS ;
 * seuls ceux de la liste du mainteneur (14/11/2026, AFFICHAGES_REGLABLES) ont
 * une case dans les Préférences, une seule chacun, les autres sont toujours
 * montrés.
 */
const JS = join(import.meta.dir, "..", "public", "js");
const lire = (f: string) => readFileSync(join(JS, f), "utf8");
const fichiers = (dossier: string): string[] =>
  readdirSync(dossier).flatMap((n) => {
    const p = join(dossier, n);
    if (statSync(p).isDirectory()) return n == "lib" ? [] : fichiers(p);
    return p.endsWith(".js") ? [p] : [];
  });
const cles = (objet: string) => {
  const m = new RegExp(`const ${objet} = \\{([\\s\\S]*?)\\n\\};`).exec(lire("class/Utils.js"));
  return [...m![1]!.matchAll(/^\s+(\w+):/gm)].map((x) => x[1]!);
};

describe("affichages ajoutés : seuls ceux de la liste du mainteneur ont leur case", () => {
  const declarees = [...cles("AFFICHAGES_FZZZ"), ...cles("AFFICHAGES_CONVOIS")];
  const parametres = lire("boite/Parametres.js");
  const dansOnglets = [...parametres.matchAll(/affichages: \[([^\]]*)\]/g)].flatMap((m) =>
    [...m[1]!.matchAll(/"(\w+)"/g)].map((x) => x[1]!),
  );
  const reglables = cles("AFFICHAGES_REGLABLES");

  test("toute clé lue par le code est déclarée avec son libellé", () => {
    const lues = new Set(
      fichiers(JS).flatMap((f) =>
        [...readFileSync(f, "utf8").matchAll(/Utils\.affichage\("(\w+)"\)/g)].map((m) => m[1]!),
      ),
    );
    expect([...lues].filter((c) => !declarees.includes(c))).toEqual([]);
    // les ajouts qui n'avaient pas de case (1.95.7, puis pages d'attaque et Armée en 1.95.10)
    for (const c of [
      "messagerieExport",
      "messagerieRanger",
      "ennemisFiltre",
      "convoisColonnes",
      "lancerPartager",
      "sonder",
      "synchroniser",
      "couleurAttaquer",
      "retourArmee",
      "statArmee",
      "lanceurFlood",
      "ennemisTemps",
      "armeeMiseEnPage",
      "armeeTotalUnites",
      "replacerArmee",
      "armeeHof",
      "armeeStatistiques",
      "armeeAttaquesRestantes",
      "armeeFleches",
      "armeeLignes",
      "arriveeRenforts",
      "rapprocherEncadres",
      "radar",
      "jaugeTdc",
      "infobulleRessources",
      "menuCarte",
      "menuCouts",
      "nouveautes",
      "chassesAnnulerTout",
      "affectationOuvrieres",
      "ressourcesMax",
      "chassesRetour",
      "evolutionEnCours",
      "retourAnnuler",
      "coutsDeveloppement",
      "laboInfobulles",
      "messagerieCompacte",
      "messagerieMiseEnForme",
      "messagerieSmileys",
      "messagerieSmileysAlliance",
      "profilRetour",
      "profilTrajet",
      "profilSurveiller",
      "reineBonus",
      "reinePonte",
      "reineNombre",
      "classementTableau",
      "classementIcones",
      "classementSurveiller",
      "chatCiter",
      "chatCouleur",
      "chatMiseEnForme",
      "chatSmileys",
      "chatMesGif",
      "chatGifAlliance",
      "chatSmileysAlliance",
      "forumSection",
      "menuRapide",
      "membresEtats",
      "membresEpees",
      "membresTableau",
      "membresFloods",
      "membresCarte",
      "rappelExport",
    ])
      expect(lues.has(c)).toBe(true);
  });

  test("les cases des onglets sont les affichages réglables, une fois chacun, tous déclarés", () => {
    expect([...dansOnglets].sort()).toEqual([...reglables].sort());
    expect(new Set(dansOnglets).size).toBe(dansOnglets.length);
    expect(reglables.filter((c) => !declarees.includes(c))).toEqual([]);
    // la liste du mainteneur : 29 affichages, dont la messagerie décochée par défaut sauf les smileys
    expect(reglables.length).toBe(29);
    const decoches = [
      ...lire("class/Utils.js")
        .match(/const AFFICHAGES_REGLABLES = \{([\s\S]*?)\n\};/)![1]!
        .matchAll(/^\s+(\w+): false,/gm),
    ].map((m) => m[1]!);
    expect(decoches).toEqual([
      "messagerieCouleurs",
      "messagerieCopie",
      "messagerieAnalyse",
      "messagerieExport",
      "messagerieRanger",
      "messagerieCompacte",
      "messagerieNonLus",
      "messagerieMiseEnForme",
    ]);
  });

  test("règle CSS d'un affichage décoché par défaut : bootstrap.js le sait avant le rendu", () => {
    const amorce =
        /\[([^\]]*)\]\.forEach\(\(cle\) =>\s*document\.documentElement\.classList\.toggle\("o_sans_"/.exec(
          lire("bootstrap.js"),
        ),
      posees = [...amorce![1]!.matchAll(/"(\w+)"/g)].map((m) => m[1]!),
      decochesBootstrap = [
        .../const DECOCHES_PAR_DEFAUT = \[([^\]]*)\]/
          .exec(lire("bootstrap.js"))![1]!
          .matchAll(/"(\w+)"/g),
      ].map((m) => m[1]!),
      utils = lire("class/Utils.js").match(/const AFFICHAGES_REGLABLES = \{([\s\S]*?)\n\};/)![1]!;
    expect(decochesBootstrap).toEqual(
      posees.filter((c) => new RegExp(`^\\s+${c}: false,`, "m").test(utils)),
    );
  });

  test("règle CSS coupée par sa case : classe o_sans_<clé> posée dès le chargement", () => {
    const css = readFileSync(join(JS, "..", "css", "outiiil.css"), "utf8"),
      dansCss = new Set([...css.matchAll(/o_sans_(\w+)/g)].map((m) => m[1]!)),
      amorce =
        /\[([^\]]*)\]\.forEach\(\(cle\) =>\s*document\.documentElement\.classList\.toggle\("o_sans_"/.exec(
          lire("bootstrap.js"),
        ),
      posees = [...amorce![1]!.matchAll(/"(\w+)"/g)].map((m) => m[1]!);
    expect([...dansCss].sort()).toEqual([...posees].sort());
    expect(posees.filter((c) => !declarees.includes(c))).toEqual([]);
  });
});
