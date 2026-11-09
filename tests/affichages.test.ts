import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Chaque affichage que l'extension ajoute aux pages du jeu a sa case dans les
 * Préférences (demande du mainteneur) : une clé lue par Utils.affichage est
 * déclarée dans AFFICHAGES_FZZZ ou AFFICHAGES_CONVOIS, et chaque clé déclarée
 * figure dans l'onglet de sa page (ONGLETS_PARAMETRE).
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

describe("affichages ajoutés : une case chacun dans les Préférences", () => {
  const declarees = [...cles("AFFICHAGES_FZZZ"), ...cles("AFFICHAGES_CONVOIS")];
  const parametres = lire("boite/Parametres.js");
  const dansOnglets = new Set([
    ...[...parametres.matchAll(/affichages: \[([^\]]*)\]/g)].flatMap((m) =>
      [...m[1]!.matchAll(/"(\w+)"/g)].map((x) => x[1]!),
    ),
    ...(parametres.includes("affichages: Object.keys(AFFICHAGES_CONVOIS)")
      ? cles("AFFICHAGES_CONVOIS")
      : []),
  ]);

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
      "profilRetour",
      "profilTrajet",
      "profilSurveiller",
    ])
      expect(lues.has(c)).toBe(true);
  });

  test("toute clé déclarée a sa case dans un onglet des Préférences", () => {
    expect(declarees.filter((c) => !dansOnglets.has(c))).toEqual([]);
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
