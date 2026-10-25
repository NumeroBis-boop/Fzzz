import {
  meilleureUnite,
  planEtable,
  rentabilite,
  UNITES,
  UNITES_PONDABLES,
  type Carac,
  type CodeUnite,
  type Effectifs,
} from "@fzzz/core";
import { el, STYLE_ALERTE, STYLE_INFO } from "./ui";

const nombre = (n: number) => Math.round(n).toLocaleString("fr-FR");
const nomUnite = (code: string) => UNITES.find((u) => u.code === code)?.nom ?? code;
const LIBELLE: Record<Carac, string> = { att: "attaque", def: "défense", vie: "vie" };

export function additionner(...armees: Effectifs[]): Effectifs {
  const total: Effectifs = {};
  for (const a of armees) {
    for (const [code, n] of Object.entries(a) as [keyof Effectifs, number][]) total[code] = (total[code] ?? 0) + n;
  }
  return total;
}

/** Unité de comparaison choisie par le joueur, mémorisée par caractéristique. */
async function uniteChoisie(carac: Carac): Promise<CodeUnite> {
  const { unitesProduites } = (await browser.storage.local.get("unitesProduites")) as {
    unitesProduites?: Partial<Record<Carac, CodeUnite>>;
  };
  return unitesProduites?.[carac] ?? meilleureUnite(carac);
}

async function memoriserUnite(carac: Carac, code: CodeUnite): Promise<void> {
  const { unitesProduites = {} } = (await browser.storage.local.get("unitesProduites")) as {
    unitesProduites?: Partial<Record<Carac, CodeUnite>>;
  };
  await browser.storage.local.set({ unitesProduites: { ...unitesProduites, [carac]: code } });
}

/**
 * Ligne « Armes 10 (attaque) : seuil Sₙ HB en ponte de [unité ▾] — armée H HB → rentable ».
 * Le sélecteur d'unité recalcule la ligne sur place.
 */
export async function ligneSeuil(armee: Effectifs, carac: Carac, niveauActuel: number, titre: string): Promise<HTMLElement> {
  const conteneur = el("div");
  const select = el("select", { style: "font-size:inherit" });
  for (const u of UNITES) {
    if (!UNITES_PONDABLES.has(u.code) || u.code === "ouvriere" || u[carac] <= 0) continue;
    const option = el("option", {}, u.nom);
    option.value = u.code;
    select.append(option);
  }
  select.value = await uniteChoisie(carac);

  const resultat = el("span");
  const maj = () => {
    const r = rentabilite(armee, carac, niveauActuel, select.value as CodeUnite);
    resultat.replaceChildren(
      ` : seuil ${nombre(r.seuil)} HB — ton armée : ${nombre(r.total)} HB → `,
      r.rentable
        ? el("span", { style: STYLE_INFO }, "rentable")
        : el("span", { style: STYLE_ALERTE }, `pas rentable (il manque ${nombre(r.manquant)} HB)`),
    );
    resultat.title = `${nombre(r.ouvrieres)} ouvrières sacrifiées = autant de temps de ponte que ${nomUnite(r.unite)} (Sₙ = ⌈Cₙ × 60 / tᵤ × cᵤ × (n + 9)⌉)`;
  };
  select.addEventListener("change", () => {
    maj();
    void memoriserUnite(carac, select.value as CodeUnite);
  });
  maj();
  conteneur.append(el("strong", {}, `${titre} ${niveauActuel + 1} (${LIBELLE[carac]})`), " comparé à la ponte de ", select, resultat);
  return conteneur;
}

export async function blocRentabilite(armee: Effectifs, niveaux: { bouclier: number; armes: number }): Promise<HTMLElement> {
  const total = Object.values(armee).reduce((s, n) => s + (n ?? 0), 0);
  return el(
    "div",
    { style: "margin:8px auto;max-width:640px;text-align:left" },
    el("h3", {}, "Rentabilité (Fzzz)"),
    el("div", { style: "font-size:0.9em;opacity:.8" }, `Armée totale : ${nombre(total)} unités (garnison, chasses et attaques vues).`),
    await ligneSeuil(armee, "att", niveaux.armes, "Armes"),
    await ligneSeuil(armee, "def", niveaux.armes, "Armes"),
    await ligneSeuil(armee, "vie", niveaux.bouclier, "Bouclier"),
  );
}

/**
 * Bloc de l'étable à pucerons : champ « ouvrières disponibles pour les convois »
 * (prérempli : ouvrières − TDC) et plan des passages rentables.
 */
export function blocEtable(ouvrieresParDefaut: number, niveauEtable: number, niveauCommunication: number): HTMLElement {
  const champ = el("input", { style: "width:9em;font-size:inherit" });
  champ.type = "number";
  champ.min = "0";
  champ.value = String(ouvrieresParDefaut);
  const resultat = el("div");
  const maj = () => {
    const o = Math.max(0, Math.floor(Number(champ.value) || 0));
    const plan = planEtable(o, niveauEtable, niveauCommunication);
    resultat.replaceChildren(
      ...plan.map((p) =>
        el(
          "div",
          { style: p.rentable ? STYLE_INFO : STYLE_ALERTE },
          `Étable ${p.niveauVise} : ${nombre(p.ouvrieresSacrifiees)} ouvrières sacrifiées, ` +
            `capacité de convoi ${p.gainCapacite >= 0 ? "+" : ""}${nombre(p.gainCapacite)} → ` +
            (p.rentable ? "rentable" : `pas rentable (minimum ${nombre(p.minimum)} ouvrières disponibles)`),
        ),
      ),
    );
  };
  champ.addEventListener("input", maj);
  maj();
  return el(
    "div",
    {},
    el("strong", {}, "Fzzz — étable à pucerons : "),
    "ouvrières disponibles pour les convois ",
    champ,
    resultat,
  );
}
