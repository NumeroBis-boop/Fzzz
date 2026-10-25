import {
  formaterDuree,
  rentabiliteArmes,
  rentabiliteBouclier,
  UNITES,
  type Effectifs,
  type Rentabilite,
} from "@fzzz/core";
import { el, STYLE_INFO } from "./ui";

const nombre = (n: number) => Math.round(n).toLocaleString("fr-FR");
const nomUnite = (code: string) => UNITES.find((u) => u.code === code)?.nom ?? code;

export function additionner(...armees: Effectifs[]): Effectifs {
  const total: Effectifs = {};
  for (const a of armees) {
    for (const [code, n] of Object.entries(a) as [keyof Effectifs, number][]) total[code] = (total[code] ?? 0) + n;
  }
  return total;
}

function ligne(titre: string, r: Rentabilite, carac: string): HTMLElement {
  const alt = r.alternatives[0];
  const verdict = r.rentable ? "rentable" : "pas rentable";
  return el(
    "div",
    {},
    el("strong", {}, `${titre} ${r.niveauVise} : `),
    `+${nombre(r.gainNiveau)} ${carac} pour ${nombre(r.cout.ouvrieres)} ouvrières (${formaterDuree(r.tempsPonteOuvrieres)} de ponte). `,
    alt
      ? `Le même temps de ponte donne ${nombre(alt.nombre)} ${nomUnite(alt.unite)} : +${nombre(alt.gain)} ${carac}. `
      : "",
    el("span", { style: STYLE_INFO }, `→ ${verdict}`),
  );
}

export function blocRentabilite(
  armee: Effectifs,
  niveaux: { bouclier: number; armes: number; ponte: number },
): HTMLElement {
  const ctx = { effectifs: armee, niveauArmes: niveaux.armes, niveauBouclier: niveaux.bouclier, niveauxPonte: niveaux.ponte };
  const b = rentabiliteBouclier(ctx);
  const a = rentabiliteArmes(ctx);
  const total = Object.values(armee).reduce((s, n) => s + (n ?? 0), 0);
  return el(
    "div",
    { style: "margin:8px auto;max-width:640px;text-align:left" },
    el("h3", {}, "Rentabilité (Fzzz)"),
    el(
      "div",
      { style: "font-size:0.9em;opacity:.8" },
      `Armée totale : ${nombre(total)} unités (garnison, chasses et attaques vues). Bonus de ponte : ${niveaux.ponte}.`,
    ),
    ligne("Bouclier", b, "PV"),
    ligne("Armes (attaque)", a.attaque, "att"),
    ligne("Armes (défense)", a.defense, "déf"),
  );
}
