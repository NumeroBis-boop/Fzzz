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
  estimerSalleAnalyse,
  formaterMinuteRC,
  lireLaboratoire,
  lirePageArmee,
  lirePonteBoite,
  lireTableauEnnemie,
  distance,
  lireConstructions,
  lireDonneesJoueur,
  lirePageMembre,
  type Effectifs,
} from "@fzzz/core";
import { generationPage, initialiserHorloge, maintenantServeur } from "../src/horloge";
import { bonusPonteConnu, lireProfil, majProfil, type AttaqueMemorisee, type ChasseMemorisee } from "../src/reglages";
import { additionner, blocEtable, blocRentabilite, ligneSeuil } from "../src/rentabilite";
import { creerHorloge, el, STYLE_ALERTE, STYLE_INFO } from "../src/ui";

export default defineContentScript({
  matches: ["*://*.fourmizzz.fr/*"],
  runAt: "document_end",
  async main() {
    await initialiserHorloge();
    await afficherHorloge();
    await memoriserPonte();

    const page = location.pathname.toLowerCase();
    const params = new URLSearchParams(location.search);
    if (page === "/armee.php") {
      await memoriserAttaques(await afficherArrivees(lireAttaquesEnCours(document)));
      await pageArmee();
    } else if (page === "/ennemie.php" && (params.has("Attaquer") || params.has("annuler"))) {
      await memoriserAttaques(await afficherArrivees(lireAttaquesEnCours(document)));
    } else if (page === "/ennemie.php") {
      await afficherMesAttaques();
      await afficherTrajets();
    } else if (page === "/ressources.php") {
      await pageRessources();
    } else if (page === "/laboratoire.php") {
      await pageLaboratoire();
    } else if (page === "/construction.php") {
      await pageConstruction();
    } else if (page === "/membre.php") {
      await pageMembre();
    }
  },
});

/**
 * Horloge serveur dans l'encart « S5 Pseudo ». L'heure vient uniquement du
 * serveur (en-têtes Date des pages chargées) ; le joueur peut la décaler par
 * pas de 0,1 s pour compenser sa latence.
 */
async function afficherHorloge(): Promise<void> {
  let latence = (await lireProfil()).latence ?? 0;
  const horloge = creerHorloge({
    valeur: () => latence,
    ajuster: (delta) => {
      latence = Math.round((latence + delta) / 100) * 100;
      void majProfil({ latence });
    },
  });
  const tic = () => {
    const brut = maintenantServeur();
    const now = brut === null ? null : brut + latence;
    horloge.maj(now === null ? "--:--:--" : formaterHeure(now));
    // Recale le tic sur le changement de seconde affiché.
    setTimeout(tic, now === null ? 1000 : 1000 - (now % 1000) + 5);
  };
  tic();
}

/** Le rythme de la file de ponte (boîte Compte+) donne la somme des bonus de ponte. */
async function memoriserPonte(): Promise<void> {
  const ponte = lirePonteBoite(document);
  const total = ponte?.file.reduce((s, f) => s + f.nombre, 0) ?? 0;
  // Les niveaux lus sur Construction et Laboratoire priment sur l'estimation.
  const exact = bonusPonteConnu(await lireProfil());
  const n = exact ?? (ponte && total >= 100 ? estimerNiveauxPonte(ponte) : null);
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

/**
 * Ajoute l'heure serveur d'arrivée à la seconde, la minute du RC (minute qui
 * suit l'impact) et le rang d'arrivée.
 */
async function afficherArrivees<M extends AvecArrivee>(mouvements: M[]): Promise<{ ms: number; mouvements: M[] } | null> {
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
        ` → ${formaterHeure(t)} · RC ${formaterMinuteRC(t)} (n° ${rang + 1}${ok ? "" : ", à vérifier"})`,
      ),
    );
  });
  return { ms: g.ms, mouvements };
}

/** Les pages Armée et Attaquer listent toutes les attaques en cours : on remplace la liste mémorisée. */
async function memoriserAttaques(r: { ms: number; mouvements: ReturnType<typeof lireAttaquesEnCours> } | null): Promise<void> {
  if (!r) return;
  const attaques: AttaqueMemorisee[] = r.mouvements.map((a) => ({
    id: a.id,
    cible: a.cible,
    lieu: a.lieu,
    arrivee: arrivee(r.ms, a.reste),
    effectifs: a.effectifs,
  }));
  await majProfil({ attaques });
}

/** En haut de la page Ennemies : les attaques en cours mémorisées. */
async function afficherMesAttaques(): Promise<void> {
  const now = maintenantServeur() ?? Date.now();
  const attaques = ((await lireProfil()).attaques ?? []).filter((a) => a.arrivee > now).sort((a, b) => a.arrivee - b.arrivee);
  const ancre = document.querySelector("#centre table.simulateur");
  if (!ancre || attaques.length === 0) return;
  ancre.before(
    el(
      "div",
      { style: "margin:8px auto;max-width:640px;text-align:left" },
      el("h3", {}, "Mes attaques en cours (Fzzz)"),
      ...attaques.map((a) =>
        el(
          "div",
          {},
          `- ${a.cible}${a.lieu ? ` (${a.lieu})` : ""} : arrivée `,
          el("strong", {}, formaterHeure(a.arrivee)),
          ` · RC ${formaterMinuteRC(a.arrivee)}`,
        ),
      ),
    ),
  );
}

async function pageRessources(): Promise<void> {
  const chasses = lireChassesEnCours(document);
  const generationMs = (await afficherArrivees(chasses))?.ms ?? null;
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
  if (armee.niveauBouclier !== null && armee.niveauArmes !== null) {
    const enChasse: Effectifs[] = chasses.map((c) => c.effectifs);
    const enAttaque: Effectifs[] = lireAttaquesEnCours(document).map((a) => a.effectifs);
    const total = additionner(armee.troupes.terrain, armee.troupes.dome, armee.troupes.loge, ...enChasse, ...enAttaque);
    await majProfil({ armee: total, majArmee: Date.now() });
    placer(await blocRentabilite(total, { bouclier: armee.niveauBouclier, armes: armee.niveauArmes }));
  }
}

async function afficherTrajets(): Promise<void> {
  const lignes = lireTableauEnnemie(document);
  if (lignes.length === 0) return;
  const profil = await lireProfil();
  const va = profil.recherches?.vitesseAttaque;
  const entete = document.querySelector("#tabEnnemie tr")?.children[5];
  entete?.after(
    el("th", { title: "Durée de trajet : exacte si le profil du joueur a été consulté, sinon estimée (≈) depuis la distance arrondie" }, "Trajet"),
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
    const c = profil.coordonnees?.[l.pseudo];
    const exacte = c !== undefined && profil.moi !== undefined;
    const d = dureeTrajet(exacte ? distance(profil.moi!, c!) : l.distance, va);
    cellule.after(
      el(
        "td",
        { title: exacte ? `VA ${va}, coordonnées (${c!.x}, ${c!.y})` : `VA ${va}, distance arrondie ${l.distance}` },
        `${exacte ? "" : "≈ "}${formaterDuree(d)}`,
      ),
      el("td", {}, now === null ? "" : formaterHeure(now + d * 1000, false)),
    );
  }
}

async function pageLaboratoire(): Promise<void> {
  const lignes = lireLaboratoire(document);
  if (lignes.length === 0) return;
  const recherches = Object.fromEntries(lignes.map((l) => [l.cle, l.niveau]));
  const salleAnalyse = estimerSalleAnalyse(lignes);
  await majProfil({ recherches, majRecherches: Date.now(), ...(salleAnalyse !== null ? { salleAnalyse } : {}) });

  const profil = await lireProfil();
  const sous = (cle: string, ...contenu: HTMLElement[]) => {
    const cellule = lignes.find((l) => l.cle === cle)?.ligne.querySelector(".desciption_amelioration");
    cellule?.append(el("div", { style: "margin-top:6px;font-size:0.9em" }, ...contenu));
  };
  const { bouclier, armes, communication } = recherches;

  if (profil.armee && bouclier !== undefined && armes !== undefined) {
    sous("bouclier", await ligneSeuil(profil.armee, "vie", bouclier, "Bouclier"));
    sous("armes", await ligneSeuil(profil.armee, "att", armes, "Armes"), await ligneSeuil(profil.armee, "def", armes, "Armes"));
  } else {
    sous("bouclier", el("em", {}, "Fzzz : ouvrez la page Armée (et Ressources) pour calculer la rentabilité."));
  }

  // Ouvrières disponibles pour les convois : dernière saisie, sinon ouvrières − TDC exploité.
  const joueur = lireDonneesJoueur(document);
  const parDefaut = profil.ouvrieresConvoi ?? (joueur ? Math.max(0, joueur.ouvrieres - joueur.tdc) : 0);
  if (communication !== undefined) {
    const bloc = blocEtable(parDefaut, profil.constructions?.etablePucerons ?? Math.max(0, communication - 2), communication);
    bloc.querySelector("input")?.addEventListener("change", (e) => {
      void majProfil({ ouvrieresConvoi: Number((e.target as HTMLInputElement).value) || 0 });
    });
    sous("communication", bloc);
  }
}

async function pageConstruction(): Promise<void> {
  const lignes = lireConstructions(document);
  if (lignes.length === 0) return;
  await majProfil({ constructions: Object.fromEntries(lignes.map((l) => [l.cle, l.niveau])) });
  const exact = bonusPonteConnu(await lireProfil());
  if (exact !== undefined) await majProfil({ niveauxPonte: exact });
}

/** Mémorise les coordonnées du profil affiché (le sien ou celui d'un autre joueur). */
async function pageMembre(): Promise<void> {
  const m = lirePageMembre(document);
  if (!m) return;
  const profil = await lireProfil();
  const coordonnees = { ...profil.coordonnees, [m.pseudo]: { x: m.x, y: m.y, maj: Date.now() } };
  const moi = lireDonneesJoueur(document)?.pseudo === m.pseudo ? { x: m.x, y: m.y } : profil.moi;
  await majProfil({ coordonnees, ...(moi ? { moi } : {}) });

  const now = maintenantServeur();
  if (m.trajet && now !== null) {
    const ligne = Array.from(document.querySelectorAll(".boite_membre tr")).find((tr) =>
      tr.firstElementChild?.textContent?.includes("Temps de trajet"),
    );
    ligne?.lastElementChild?.append(
      el("span", { style: STYLE_INFO, title: "Heure serveur d'arrivée si l'attaque part maintenant" }, ` → arrivée ${formaterHeure(now + m.trajet * 1000)}`),
    );
  }
}
