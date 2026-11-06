import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { creerPage } from "./harnais";

const JS = join(import.meta.dir, "..", "public", "js");

// Une heure de jeu (arrivée, retour, fin de ponte, de construction…) passe par
// Horloge.serveur() / Horloge.maintenant() : l'horloge du PC peut être fausse.
// Restent sur l'horloge du PC, en nombre connu par fichier : les durées mesurées
// sur cette même horloge, les identifiants, les caches et la cadence des requêtes.
const LECTURES_PC: Record<string, number> = {
  "boite/Combat.js": 1, // identifiant de combat
  "boite/Radar.js": 1, // identifiant de séparateur
  "class/AttaqueLancee.js": 5, // réception de la page (convertie par Horloge.serveurA), décompte d'annulation
  "class/ExportJoueurs.js": 2, // âge de la base des joueurs
  "class/Horloge.js": 1, // heure du serveur = heure du PC + décalage mesuré
  "class/MiseAJour.js": 1, // cadence de la lecture de la version publiée (une par heure)
  "class/LanceurChasse.js": 1, // délai de partage après l'envoi des chasses, posé (relu dans Ressource.js)
  "class/OuafSuivi.js": 2, // âge des convois transmis
  "class/Requetes.js": 2, // cadence des requêtes
  "class/Utils.js": 12, // identifiant, comptes à rebours, défilement de la page
  "page/Alliance.js": 3, // âge de la carte, nom du fichier exporté
  "page/MessagerieFzzz.js": 5, // durée estimée de lecture des rapports
  "page/PartageChasses.js": 6, // anti-cache des requêtes du forum, cache d'une minute, floods partagés
  "page/Ressource.js": 1, // délai de partage après l'envoi des chasses, relu (posé dans LanceurChasse.js)
};

const LECTURE = /\bmoment\(\s*\)|Date\.now\(\)|new Date\(\s*\)|performance\.timeOrigin/g;

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return nom == "lib" ? [] : fichiers(chemin);
    return nom.endsWith(".js") ? [chemin] : [];
  });
}

// commentaires retirés (les « // » d'une adresse http:// restent)
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.replace(/(^|[^:"'])\/\/.*$/, "$1"))
    .join("\n");
}

describe("horloge du PC", () => {
  test("aucune heure de jeu n'est lue sur l'horloge du PC", () => {
    const lues: Record<string, number> = {};
    for (const f of fichiers(JS)) {
      const n = (code(readFileSync(f, "utf8")).match(LECTURE) || []).length;
      if (n) lues[relative(JS, f)] = n;
    }
    // un écart : nouvelle lecture de l'horloge du PC. Heure de jeu → Horloge.serveur()
    // ou Horloge.maintenant() ; durée locale → l'ajouter à LECTURES_PC, avec sa raison
    expect(lues).toEqual(LECTURES_PC);
  });

  test("PC en avance d'1 h : une attaque encore en vol reste dehors", () => {
    const page = creerPage(
      ["js/class/TroupesDehors.js"],
      `var Horloge = { maintenant: () => Date.now() - 3600000 };`,
    );
    const dehors = page.lire<number>(`(() => {
      // retour dans 30 min à l'heure du serveur, déjà passé à l'heure du PC
      TroupesDehors.ajouterAttaque(42, [0, 0, 0, 0, 0, 0, 10], Horloge.maintenant() + 1800000);
      return TroupesDehors.charger().filter((t) => t.id == 42).length;
    })()`);
    expect(dehors).toBe(1);
  });
});
