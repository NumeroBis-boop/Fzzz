import type { Effectifs } from "../data/unites.js";
import { lireTroupes } from "./commun.js";

/**
 * Mouvements en cours (attaques sur Armee.php et ennemie.php?Attaquer=…,
 * chasses sur Ressources.php). Le jeu écrit, pour chacun :
 *
 *   - Vous allez attaquer <span class="gras"><a>X</a>(<a>TAG</a>)</span> (Dôme) dans
 *     <span id="attaque_98593">…</span><script>reste(14440, "attaque_98593");</script> …
 *   - <span>- Vos chasseuses vont conquérir 1 cm² dans <span id="chasse_232614">…</span></span>
 *     <script>reste(8204, "chasse_232614");</script> …
 *
 * suivi de <small><em> Troupes en … : … <br/> Arrivée à 02h59</em></small>.
 */

interface Mouvement {
  id: string;
  /** Secondes restantes au moment de la génération de la page. */
  reste: number;
  /** Texte brut des troupes engagées (« 1 Jeune Soldate Naine »). */
  troupes: string | null;
  effectifs: Effectifs;
  /** Minute d'arrivée affichée par le jeu (« 19h56 »). */
  arriveeAffichee: string | null;
  /** Élément du compte à rebours, pour y accrocher l'affichage. */
  element: Element;
}

export interface AttaqueEnCours extends Mouvement {
  cible: string;
  allianceCible: string | null;
  /** « Terrain de chasse », « Dôme », « Loge Impériale », tel qu'affiché. */
  lieu: string | null;
}

export interface ChasseEnCours extends Mouvement {
  surface: number;
}

function restes(doc: ParentNode, type: string): Map<string, number> {
  const res = new Map<string, number>();
  const motif = new RegExp(`reste\\(\\s*(\\d+)\\s*,\\s*["']${type}_(\\d+)["']\\s*\\)`, "g");
  for (const s of Array.from(doc.querySelectorAll("script"))) {
    for (const m of (s.textContent ?? "").matchAll(motif)) res.set(m[2]!, Number(m[1]));
  }
  return res;
}

/** Premier <small> qui suit `el` dans le document, sans dépasser `limite`. */
function smallSuivant(el: Element, limite: Element | undefined, doc: ParentNode): Element | null {
  for (const small of Array.from(doc.querySelectorAll("small"))) {
    const apres = el.compareDocumentPosition(small) & Node.DOCUMENT_POSITION_FOLLOWING;
    const avantLimite = !limite || small.compareDocumentPosition(limite) & Node.DOCUMENT_POSITION_FOLLOWING;
    if (apres && avantLimite) return small;
  }
  return null;
}

function lireMouvements(doc: ParentNode, type: "attaque" | "chasse"): (Mouvement & { span: Element })[] {
  const r = restes(doc, type);
  const spans = Array.from(doc.querySelectorAll(`span[id^="${type}_"]`));
  return spans.flatMap((span, i) => {
    const id = span.id.slice(type.length + 1);
    const reste = r.get(id);
    if (reste === undefined) return [];
    const texte = smallSuivant(span, spans[i + 1], doc)?.textContent ?? "";
    const troupes = /Troupes en \w+\s*:\s*([\s\S]+?)\.?\s*(?:Arrivée|$)/.exec(texte)?.[1]?.replace(/\s+/g, " ").trim() ?? null;
    return [
      {
        id,
        reste,
        troupes,
        effectifs: troupes ? lireTroupes(troupes) : {},
        arriveeAffichee: /Arrivée à\s*(\d{1,2}h\d{2})/.exec(texte)?.[1] ?? null,
        element: span,
        span,
      },
    ];
  });
}

export function lireAttaquesEnCours(doc: ParentNode): AttaqueEnCours[] {
  return lireMouvements(doc, "attaque").map(({ span, ...m }) => {
    const gras = span.previousElementSibling;
    const liens = gras ? Array.from(gras.querySelectorAll("a")) : [];
    return {
      ...m,
      cible: liens[0]?.textContent?.trim() ?? "",
      allianceCible: liens[1]?.textContent?.trim() ?? null,
      lieu: /\(([^)]+)\)\s*dans\s*$/.exec(span.previousSibling?.textContent ?? "")?.[1] ?? null,
    };
  });
}

export function lireChassesEnCours(doc: ParentNode): ChasseEnCours[] {
  return lireMouvements(doc, "chasse").map(({ span, ...m }) => {
    const avant = span.previousSibling?.textContent ?? "";
    const surface = /conquérir\s+([\d\s ]+)\s*cm²/.exec(avant)?.[1];
    return { ...m, surface: surface ? Number(surface.replace(/\D/g, "")) : 0 };
  });
}
