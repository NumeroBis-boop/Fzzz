import {
  arrivee,
  concordeAvecMinuteAffichee,
  dureeTrajet,
  formaterDuree,
  formaterHeure,
  lireAttaquesEnCours,
  lireChassesBoite,
  lireNiveauxRecherche,
  lireTableauEnnemie,
} from "@fzzz/core";
import { estimationHorloge, generationPage, initialiserHorloge, maintenantServeur } from "../src/horloge";
import { lireProfil, majProfil } from "../src/reglages";
import { creerBadge, el, STYLE_ALERTE, STYLE_INFO } from "../src/ui";

export default defineContentScript({
  matches: ["*://*.fourmizzz.fr/*"],
  runAt: "document_end",
  async main() {
    await initialiserHorloge();
    afficherHorloge();

    const page = location.pathname.toLowerCase();
    const params = new URLSearchParams(location.search);
    if (page === "/armee.php") {
      await afficherArrivees();
      await afficherChasses();
    } else if (page === "/ennemie.php" && (params.has("Attaquer") || params.has("annuler"))) {
      await afficherArrivees();
    } else if (page === "/ennemie.php") {
      await afficherTrajets();
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

/** Attend l'enregistrement de l'en-tête Date par l'arrière-plan (écriture asynchrone). */
async function generation() {
  const g = await generationPage();
  if (g?.source === "date") return g;
  await new Promise((r) => setTimeout(r, 400));
  return (await generationPage()) ?? g;
}

async function afficherArrivees(): Promise<void> {
  const attaques = lireAttaquesEnCours(document);
  if (attaques.length === 0) return;
  const g = await generation();
  if (!g) return;
  const triees = attaques
    .map((a) => ({ a, t: arrivee(g.ms, a.reste) }))
    .sort((x, y) => x.t - y.t);
  triees.forEach(({ a, t }, rang) => {
    const ok = a.arriveeAffichee === null || concordeAvecMinuteAffichee(t, a.arriveeAffichee);
    const precision = g.source === "date" ? "±1 s" : "estimée";
    const info = el(
      "span",
      {
        style: ok ? STYLE_INFO : STYLE_ALERTE,
        title: ok
          ? `Heure serveur d'arrivée (${precision}). Les combats sont résolus dans l'ordre d'arrivée à la seconde.`
          : "L'heure calculée ne tombe pas dans la minute affichée par le jeu : horloge à recaler, rechargez la page.",
      },
      ` → ${formaterHeure(t)} (n° ${rang + 1}${ok ? "" : ", à vérifier"})`,
    );
    a.element.after(info);
  });
}

async function afficherChasses(): Promise<void> {
  const boite = lireChassesBoite(document);
  if (!boite || boite.nombre === 0) return;
  const titre = Array.from(document.querySelectorAll("h3")).find((h) => /Attaque\(s\) en cours/.test(h.textContent ?? ""));
  const ancre = titre ?? document.querySelector("#centre center");
  if (!ancre) return;
  const g = await generation();
  const lignes = boite.chasses.map((c, i) => {
    // Seule la première chasse à finir a un compte à rebours à la seconde.
    const premiere = i === 0 && boite.restePremiere !== null && g;
    const fin = premiere ? formaterHeure(arrivee(g.ms, boite.restePremiere!)) : c.finAffichee;
    return el("div", {}, `- Chasse de ${c.surface.toLocaleString("fr-FR")} cm², retour à `, el("strong", {}, fin));
  });
  const bloc = el("div", { style: "margin:8px 0" }, el("h3", {}, "Chasse(s) en cours"), ...lignes);
  if (titre) titre.before(bloc);
  else ancre.prepend(bloc);
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
