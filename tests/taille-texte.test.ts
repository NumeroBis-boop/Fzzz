import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { creerPage } from "./harnais";

/**
 * Un navigateur de téléphone grossit le texte d'un bloc large qui en contient
 * beaucoup (Firefox Android : environ 1,5 fois ; info-bulle des délais
 * 20/11/2026, Préférences 21/11, conseil du Bouclier 28/11). Une seule règle
 * le refuse pour tous les éléments de l'extension, jamais pour ceux du jeu.
 */
const CSS = readFileSync(join(import.meta.dir, "..", "public", "css", "outiiil.css"), "utf8");
const page = creerPage([]);
const lire = <T = any>(e: string) => page.lire<T>(e);

const regles = [...CSS.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^}]*)\}/g)];
const avecTaille = regles.filter(([, , corps]) => /text-size-adjust/.test(String(corps)));

describe("taille du texte de l'extension sur téléphone", () => {
  test("une seule règle, ses trois écritures (Firefox, Chromium et Safari, standard)", () => {
    expect(avecTaille.length).toBe(1);
    for (const propriete of [
      "-moz-text-size-adjust",
      "-webkit-text-size-adjust",
      "text-size-adjust",
    ])
      expect(avecTaille[0]![2]).toMatch(new RegExp(`(^|[\\s;])${propriete}: none;`));
  });

  test("les éléments de l'extension, par classe ou par identifiant ; ni <html> ni ceux du jeu", () => {
    const selecteur = String(avecTaille[0]![1]).trim();
    const touche = (html: string) =>
      lire<boolean>(
        `(() => { let t = document.createElement("template"); t.innerHTML = ${JSON.stringify(html)}; return t.content.firstElementChild.matches(${JSON.stringify(selecteur)}); })()`,
      );
    for (const html of [
      `<details class="o_conseil"></details>`,
      `<div id="o_boiteParametre"></div>`,
      `<div class="ui-tooltip o_delaiInfobulle"></div>`,
      `<tr class="o_conseilLigne"></tr>`,
      `<div class="boite_amelioration simulateur centre o_blocAttaques"></div>`,
    ])
      expect([html, touche(html)]).toEqual([html, true]);
    for (const html of [
      `<td class="desciption_amelioration"></td>`,
      `<div class="pas_sur_telephone"></div>`,
      `<div class="foo_o_bar"></div>`,
    ])
      expect([html, touche(html)]).toEqual([html, false]);
    // <html> porte des classes o_ (o_chrome, o_originePage, o_sans_…) : la page du jeu entière
    lire(`document.documentElement.className = "o_chrome o_originePage"`);
    expect(lire(`document.documentElement.matches(${JSON.stringify(selecteur)})`)).toBe(false);
  });
});
