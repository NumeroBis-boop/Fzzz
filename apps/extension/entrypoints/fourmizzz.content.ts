import {
  arrivee,
  concordeAvecMinuteAffichee,
  dureeTrajet,
  estimerNiveauxPonte,
  formaterDuree,
  formaterHeure,
  lireAttaquesEnCours,
  lireBonusChasse,
  lireChassesBoite,
  lireChassesEnCours,
  lireNiveauxRecherche,
  lirePageArmee,
  lirePonteBoite,
  lireTableauEnnemie,
  type Effectifs,
} from "@fzzz/core";
import { estimationHorloge, generationPage, initialiserHorloge, maintenantServeur } from "../src/horloge";
import { lireProfil, majProfil, type ChasseMemorisee } from "../src/reglages";
import { additionner, blocRentabilite } from "../src/rentabilite";
import { creerBadge, el, STYLE_ALERTE, STYLE_INFO } from "../src/ui";

export default defineContentScript({
  matches: ["*://*.fourmizzz.fr/*"],
  runAt: "document_end",
  async main() {
    await initialiserHorloge();
    afficherHorloge();
    await memoriserPonte();

    const page = location.pathname.toLowerCase();
    const params = new URLSearchParams(location.search);
    if (page === "/armee.php") {
      await afficherArrivees(lireAttaquesEnCours(document));
      await pageArmee();
    } else if (page === "/ennemie.php" && (params.has("Attaquer") || params.has("annuler"))) {
      await afficherArrivees(lireAttaquesEnCours(document));
    } else if (page === "/ennemie.php") {
      await afficherTrajets();
    } else if (page === "/ressources.php") {
      await pageRessources();
    } else if (page === "/laboratoire.php") {
      const recherches = lireNiveauxRecherche(document);
      if (Object.keys(recherches).length > 0) await majProfil({ recherches, majRecherches: Date.now() });
    }
  },
});

function afficherHorloge(): void {
  const badge = creerBadge();
  const tic = () => {
    const now = maintenantServeur();
    const est = estimationHorloge();
    if (now === null || !est) {
      badge.maj("--:--:--", "rechargez une page");
    } else {
      badge.maj(formaterHeure(now), `serveur ±${(est.incertitude / 1000).toFixed(1)} s`);
    }
    // Recale le tic sur le changement de seconde serveur.
    setTimeout(tic, now === null ? 1000 : 1000 - (now % 1000) + 5);
  };
  tic();
}

/** Le rythme de la file de ponte (boîte Compte+) donne la somme des bonus de ponte. */
async function memoriserPonte(): Promise<void> {
  const ponte = lirePonteBoite(document);
  const total = ponte?.file.reduce((s, f) => s + f.nombre, 0) ?? 0;
  const n = ponte && total >= 100 ? estimerNiveauxPonte(ponte) : null;
  if (n !== null && n >= 0) await majProfil({ niveauxPonte: n });
}

/** Attend l'enregistrement de l'en-tête Date par l'arrière-plan (écriture asynchrone). */
async function generation() {
  const g = await generationPage();
  if (g?.source === "date") return g;
  await new Promise((r) => setTimeout(r, 400));
  return (await generationPage()) ?? g;
}

interface AvecArrivee {
  reste: number;
  arriveeAffichee: string | null;
  element: Element;
}

/** Ajoute l'heure serveur d'arrivée à la seconde et le rang d'arrivée. */
async function afficherArrivees(mouvements: AvecArrivee[]): Promise<number | null> {
  if (mouvements.length === 0) return null;
  const g = await generation();
  if (!g) return null;
  const tries = mouvements.map((m) => ({ m, t: arrivee(g.ms, m.reste) })).sort((x, y) => x.t - y.t);
  tries.forEach(({ m, t }, rang) => {
    const ok = m.arriveeAffichee === null || concordeAvecMinuteAffichee(t, m.arriveeAffichee);
    const precision = g.source === "date" ? "±1 s" : "estimée";
    m.element.after(
      el(
        "span",
        {
          style: ok ? STYLE_INFO : STYLE_ALERTE,
          title: ok
            ? `Heure serveur d'arrivée (${precision}). Les combats sont résolus dans l'ordre d'arrivée à la seconde.`
            : "L'heure calculée ne tombe pas dans la minute affichée par le jeu : horloge à recaler, rechargez la page.",
        },
        ` → ${formaterHeure(t)} (n° ${rang + 1}${ok ? "" : ", à vérifier"})`,
      ),
    );
  });
  return g.ms;
}

async function pageRessources(): Promise<void> {
  const chasses = lireChassesEnCours(document);
  const generationMs = await afficherArrivees(chasses);
  const bonus = lireBonusChasse(document);
  const memo: ChasseMemorisee[] | undefined =
    generationMs === null
      ? undefined
      : chasses.map((c) => ({ id: c.id, surface: c.surface, fin: arrivee(generationMs, c.reste), effectifs: c.effectifs }));
  await majProfil({
    ...(memo ? { chasses: memo } : {}),
    ...(bonus ? { vitesseChasse: bonus.bonus } : {}),
  });
}

async function pageArmee(): Promise<void> {
  const armee = lirePageArmee(document);
  if (armee.niveauBouclier !== null && armee.niveauArmes !== null) {
    await majProfil({ niveauBouclier: armee.niveauBouclier, niveauArmes: armee.niveauArmes });
  }
  const profil = await lireProfil();
  const now = maintenantServeur() ?? Date.now();
  const chasses = (profil.chasses ?? []).filter((c) => c.fin > now).sort((a, b) => a.fin - b.fin);

  const titre = Array.from(document.querySelectorAll("h3")).find((h) => /Attaque\(s\) en cours/.test(h.textContent ?? ""));
  const ancre = titre ?? document.querySelector("#centre center");
  if (!ancre) return;
  const placer = (bloc: HTMLElement) => (titre ? titre.before(bloc) : ancre.append(bloc));

  // Chasses : la liste mémorisée sur Ressources (à la seconde) est la plus précise ;
  // la boîte Compte+ sert à repérer qu'elle n'est plus à jour.
  const boite = lireChassesBoite(document);
  if (chasses.length > 0 || (boite && boite.nombre > 0)) {
    const lignes =
      chasses.length > 0
        ? chasses.map((c) =>
            el("div", {}, `- Chasse de ${c.surface.toLocaleString("fr-FR")} cm², retour à `, el("strong", {}, formaterHeure(c.fin))),
          )
        : (boite?.chasses ?? []).map((c) =>
            el("div", {}, `- Chasse de ${c.surface.toLocaleString("fr-FR")} cm², retour à `, el("strong", {}, c.finAffichee)),
          );
    const perimee = boite !== null && boite.nombre !== chasses.length;
    placer(
      el(
        "div",
        { style: "margin:8px 0" },
        el("h3", {}, "Chasse(s) en cours"),
        ...lignes,
        ...(perimee ? [el("div", { style: STYLE_ALERTE }, "Ouvrez la page Ressources pour mettre à jour les chasses.")] : []),
      ),
    );
  }

  // Rentabilité sur l'armée totale : garnison + chasses mémorisées + attaques en cours.
  if (armee.niveauBouclier !== null && armee.niveauArmes !== null && profil.niveauxPonte !== undefined) {
    const enChasse: Effectifs[] = chasses.map((c) => c.effectifs);
    const enAttaque: Effectifs[] = lireAttaquesEnCours(document).map((a) => a.effectifs);
    const total = additionner(armee.troupes.terrain, armee.troupes.dome, armee.troupes.loge, ...enChasse, ...enAttaque);
    placer(blocRentabilite(total, { bouclier: armee.niveauBouclier, armes: armee.niveauArmes, ponte: profil.niveauxPonte }));
  }
}

async function afficherTrajets(): Promise<void> {
  const lignes = lireTableauEnnemie(document);
  if (lignes.length === 0) return;
  const va = (await lireProfil()).recherches?.vitesseAttaque;
  const entete = document.querySelector("#tabEnnemie tr")?.children[5];
  entete?.after(
    el("th", { title: "Durée de trajet estimée (distance affichée arrondie par le jeu)" }, "Trajet"),
    el("th", { title: "Heure serveur d'arrivée si l'attaque part maintenant" }, "Arrivée"),
  );
  const now = maintenantServeur();
  for (const l of lignes) {
    const cellule = l.ligne.children[5];
    if (!cellule) continue;
    if (va === undefined) {
      cellule.after(el("td", { title: "Ouvrez la page Laboratoire pour que Fzzz connaisse votre Vitesse d'attaque" }, "VA ?"), el("td"));
      continue;
    }
    const d = dureeTrajet(l.distance, va);
    cellule.after(
      el("td", { title: `VA ${va}, distance ${l.distance}` }, `≈ ${formaterDuree(d)}`),
      el("td", {}, now === null ? "" : formaterHeure(now + d * 1000, false)),
    );
  }
}
