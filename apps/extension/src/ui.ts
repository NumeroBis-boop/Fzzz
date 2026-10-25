/** Petits éléments injectés dans les pages du jeu. Préfixe `fzzz-` pour éviter les collisions. */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: { class?: string; title?: string; style?: string } = {},
  ...enfants: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (attrs.class) e.className = attrs.class;
  if (attrs.title) e.title = attrs.title;
  if (attrs.style) e.setAttribute("style", attrs.style);
  e.append(...enfants);
  return e;
}

const COULEUR = "#7a4b12";

export const STYLE_INFO = `color:${COULEUR};font-weight:bold;`;
export const STYLE_ALERTE = "color:#b00020;font-weight:bold;";

export interface Horloge {
  maj: (texte: string) => void;
}

/**
 * Horloge serveur, à côté de « S5 Pseudo » dans l'encart d'information
 * (`#boiteInfo .titre_ressource`), avec deux boutons pour corriger la
 * latence par pas de 0,1 s. Sans cet encart, badge fixe en bas à droite.
 */
export function creerHorloge(latence: { valeur: () => number; ajuster: (deltaMs: number) => void }): Horloge {
  const heure = el("span", { style: "font-variant-numeric:tabular-nums" });
  const reglage = el("span", { style: "font-size:0.8em;opacity:.8" });
  const bouton = (texte: string, delta: number, titre: string) => {
    const b = el("button", { title: titre, style: "font-size:0.8em;padding:0 4px;margin-left:2px;cursor:pointer" }, texte);
    b.type = "button";
    b.addEventListener("click", (e) => {
      // L'encart est cliquable (lien vers le profil) : on ne laisse pas passer le clic.
      e.preventDefault();
      e.stopPropagation();
      latence.ajuster(delta);
      afficherReglage();
    });
    return b;
  };
  const afficherReglage = () => {
    const v = latence.valeur() / 1000;
    reglage.textContent = v === 0 ? "" : ` ${v > 0 ? "+" : ""}${v.toFixed(1)} s`;
  };
  afficherReglage();
  const boutons = [bouton("−", -100, "Retarder l'horloge de 0,1 s"), bouton("+", 100, "Avancer l'horloge de 0,1 s")];

  const titre = document.querySelector("#boiteInfo .titre_ressource");
  if (titre) {
    titre.after(el("span", { style: `${STYLE_INFO}margin-left:6px` }, heure, reglage, ...boutons));
  } else {
    const hote = el("div", {
      style: `position:fixed;right:8px;bottom:8px;z-index:2147483647;background:#f6ecd2;color:${COULEUR};border:1px solid #c9ad63;border-radius:6px;padding:4px 8px;font:600 14px/1.2 monospace`,
    });
    hote.append(heure, reglage, ...boutons);
    document.body.append(hote);
  }
  return { maj: (texte) => (heure.textContent = texte) };
}
