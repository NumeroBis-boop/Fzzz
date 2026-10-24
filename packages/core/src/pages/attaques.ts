/**
 * Attaques en cours, telles qu'affichées sur Armee.php et ennemie.php?Attaquer=… :
 *
 *   - Vous allez attaquer <span class="gras"><a href="Membre.php?Pseudo=X">X</a>(<a>TAG</a>)</span>
 *     (Terrain de chasse) dans <span id="attaque_98500">…</span>
 *     <script>reste(70427, "attaque_98500");</script> - <a>Annuler</a><br/>
 *     <small><em> Troupes en attaques : 1 Jeune Soldate Naine.<br/> Arrivée à 19h56</em></small>
 */

export interface AttaqueEnCours {
  id: string;
  cible: string;
  allianceCible: string | null;
  /** « Terrain de chasse », « Fourmilière », « Loge Impériale »… tel qu'affiché. */
  lieu: string | null;
  /** Secondes restantes au moment de la génération de la page. */
  reste: number;
  troupes: string | null;
  /** Minute d'arrivée affichée par le jeu (« 19h56 »). */
  arriveeAffichee: string | null;
  /** Élément du compte à rebours, pour y accrocher l'affichage. */
  element: Element;
}

export function lireAttaquesEnCours(doc: ParentNode): AttaqueEnCours[] {
  const res: AttaqueEnCours[] = [];
  for (const span of Array.from(doc.querySelectorAll('span[id^="attaque_"]'))) {
    const id = span.id.slice("attaque_".length);
    let reste: number | null = null;
    let small: Element | null = null;
    for (let n = span.nextElementSibling; n; n = n.nextElementSibling) {
      if (n.tagName === "SCRIPT" && reste === null) {
        const m = /reste\(\s*(\d+)\s*,\s*["']attaque_(\d+)["']\s*\)/.exec(n.textContent ?? "");
        if (m && m[2] === id) reste = Number(m[1]);
      }
      if (n.tagName === "SMALL") {
        small = n;
        break;
      }
      if (n.tagName === "SPAN" && n.id.startsWith("attaque_")) break;
    }
    if (reste === null) continue;

    const gras = span.previousElementSibling;
    const liens = gras ? Array.from(gras.querySelectorAll("a")) : [];
    const cible = liens[0]?.textContent?.trim() ?? "";
    const lieu = /\(([^)]+)\)\s*dans\s*$/.exec(span.previousSibling?.textContent ?? "")?.[1] ?? null;
    const texte = small?.textContent ?? "";
    res.push({
      id,
      cible,
      allianceCible: liens[1]?.textContent?.trim() ?? null,
      lieu,
      reste,
      troupes: /Troupes en attaques\s*:\s*([^\n]+?)\.?\s*(?:Arrivée|$)/.exec(texte)?.[1]?.trim() ?? null,
      arriveeAffichee: /Arrivée à\s*(\d{1,2}h\d{2})/.exec(texte)?.[1] ?? null,
      element: span,
    });
  }
  return res;
}
