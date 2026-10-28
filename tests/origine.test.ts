import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { creerPage } from "./harnais";

const page = creerPage(["js/class/Utils.js"]);

describe("« Rétablir l'affichage d'origine »", () => {
  test("onglet non coché : affichages selon leur propre case", () => {
    page.lire(`localStorage.clear(); localStorage.setItem("fzzz_affichage_trajet", "0")`);
    expect(page.lire(`Utils.origine("General")`)).toBe(false);
    expect(page.lire(`Utils.affichage("horloge")`)).toBe(true);
    expect(page.lire(`Utils.affichage("trajet")`)).toBe(false);
  });
  test("onglet Général coché : l'horloge est coupée, sa case reste mémorisée", () => {
    page.lire(`localStorage.clear(); localStorage.setItem("fzzz_origine_General", "1")`);
    expect(page.lire(`Utils.origine("General")`)).toBe(true);
    expect(page.lire(`Utils.affichage("horloge")`)).toBe(false);
    expect(page.lire(`localStorage.getItem("fzzz_affichage_horloge")`)).toBeNull();
    page.lire(`localStorage.removeItem("fzzz_origine_General")`);
    expect(page.lire(`Utils.affichage("horloge")`)).toBe(true);
  });
});

/** Sélecteurs de outiiil.css, y compris dans les @media. */
function selecteurs(css: string): string[] {
  const texte = css.replace(/\/\*[\s\S]*?\*\//g, ""),
    out: string[] = [];
  const parcourir = (t: string) => {
    let i = 0;
    for (;;) {
      const m = /([^{}]+)\{/.exec(t.slice(i));
      if (!m) return;
      const sel = m[1]!.trim(),
        debut = i + m.index + m[0].length;
      let prof = 1,
        j = debut;
      while (prof) {
        prof += t[j] == "{" ? 1 : t[j] == "}" ? -1 : 0;
        j++;
      }
      if (/^@(media|supports)/.test(sel)) parcourir(t.slice(debut, j - 1));
      else if (!sel.startsWith("@")) out.push(...sel.split(",").map((s) => s.trim()));
      i = j;
    }
  };
  parcourir(texte);
  return [...new Set(out)];
}

describe("styles de l'extension et affichage d'origine", () => {
  // classes utilitaires de l'extension (seul « gras » existe aussi dans le jeu,
  // avec le même sens) et pages sans onglet dans les préférences (Membres
  // d'alliance, chat) : à retirer d'ici le jour où ces pages ont un onglet
  const AUTORISES = new Set([
    ...[".black", ".blue", ".blue_light", ".centre", ".clear", ".cursor", ".cursor_copy"],
    ...[".f_error", ".f_info", ".f_success", ".f_warning", ".gras", ".green", ".green_light"],
    ...[".group", ".highlight_error", ".highlight_success", ".left", ".marron", ".marron_dark"],
    ...[".orange", ".red", ".red_light", ".red_xlight", ".reduce", ".right", ".small"],
    ...[".souligne:hover", ".violet"],
    ...["#tabMembresAlliance", "#tabMembresAlliance td", "#tabMembresAlliance th"],
    ...["#tabMembresAlliance thead td", "#tabMembresAlliance thead th"],
    ...["#tabMembresAlliance_wrapper", "center > div > #tabMembresAlliance", "#color"],
  ]);

  test("toute règle qui touche le jeu se coupe avec « Rétablir l'affichage d'origine »", () => {
    const css = readFileSync(join(import.meta.dir, "..", "public", "css", "outiiil.css"), "utf8"),
      // un élément de l'extension (o_…, bibliothèques) dans le sélecteur, ou le préfixe
      // html:not(.o_originePage) / html:not(.o_origineGenerale) : rien à couper
      jeu = selecteurs(css).filter(
        (s) => !/o_|toolzzz|jq-|xdsoft|ui-|dataTable|dt-|CHS2|:root/.test(s),
      );
    expect(jeu.filter((s) => !AUTORISES.has(s))).toEqual([]);
  });
});
