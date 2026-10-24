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

/**
 * Badge d'heure serveur, fixé en bas à droite. Isolé dans un Shadow DOM pour
 * ne pas hériter du CSS du jeu ; compact pour rester lisible sur mobile.
 */
export function creerBadge(): { maj: (texte: string, detail: string) => void } {
  const hote = el("div");
  const racine = hote.attachShadow({ mode: "open" });
  const style = el(
    "style",
    {},
    `.b{position:fixed;right:8px;bottom:8px;z-index:2147483647;font:600 14px/1.2 ui-monospace,monospace;
      background:#f6ecd2;color:${COULEUR};border:1px solid #c9ad63;border-radius:6px;padding:4px 8px;
      box-shadow:0 1px 4px rgba(0,0,0,.25);cursor:default;user-select:none}
     .d{display:block;font-size:10px;font-weight:400;opacity:.8}`,
  );
  const heure = el("span");
  const detail = el("span", { class: "d" });
  const badge = el("div", { class: "b", title: "Heure du serveur Fourmizzz (Fzzz)" }, heure, detail);
  racine.append(style, badge);
  document.body.append(hote);
  return {
    maj(texte, d) {
      heure.textContent = texte;
      detail.textContent = d;
    },
  };
}
