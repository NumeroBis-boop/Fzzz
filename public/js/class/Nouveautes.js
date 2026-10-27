// @ts-check
/*
 * Nouveautes.js
 * Nouveautés de chaque version, montrées dans le jeu après une mise à jour :
 * la page des versions de GitHub ne liste que les versions Firefox signées,
 * souvent plus anciennes que le script utilisateur.
 **********************************************************************/

/** Plus récente en premier ; une entrée par version publiée (vérifié par tests/nouveautes.test.ts). */
const NOUVEAUTES = [
  {
    version: "1.52.1",
    notes: [
      "Convois à faire : tableau resserré (tient sur téléphone), tri au clic sur les en-têtes.",
    ],
  },
  {
    version: "1.52.0",
    notes: [
      "Convois : chaque envoi au suivi est noté avec son numéro dans le forum (sujet « Convois | pseudo ») ; un convoi déjà envoyé est reconnu sur tous tes appareils, sans erreur.",
    ],
  },
  {
    version: "1.51.4",
    notes: [
      "Convois : un convoi déjà enregistré sur le site est de nouveau reconnu (tolérance sur le temps de trajet).",
    ],
  },
  {
    version: "1.51.3",
    notes: [
      "Convois : plus d'erreur à l'ouverture de la page si le site de suivi est injoignable ; l'explication s'affiche à l'envoi.",
    ],
  },
  {
    version: "1.51.2",
    notes: [
      "Notification de mise à jour : affichée une seule fois, tient dans l'écran du téléphone, croix plus grande.",
      "Page Reine : colonne « Terminé le » retirée (doublon de « Ponte finie » du jeu, elle élargissait le tableau sur téléphone).",
    ],
  },
  {
    version: "1.51.0",
    notes: [
      "Attaque lancée sans l'extension : TdC de la cible lu sur sa page, prise estimée et partage possibles.",
      "Convois : un nouveau convoi n'est plus marqué « Enregistré » à cause d'un envoi précédent du même montant.",
      "Notifications lisibles sur téléphone.",
    ],
  },
  {
    version: "1.50.1",
    notes: [
      "Partage des floods : marche aussi pour une attaque lancée depuis un autre appareil ou le formulaire du jeu.",
    ],
  },
  {
    version: "1.50.0",
    notes: ["« Voir les nouveautés » s'affiche dans le jeu au lieu d'ouvrir GitHub."],
  },
  {
    version: "1.49.4",
    notes: [
      "Bandeau de ponte : fin, cadre rouge, à la même place sous le menu sur toutes les pages.",
      "Sa croix le masque 10 min ; il revient si la ponte n'est toujours pas relancée.",
    ],
  },
  {
    version: "1.49.1",
    notes: [
      "Page Reine relue à chaque page pour l'alerte de ponte.",
      "Relancer la ponte lève le masquage du bandeau.",
    ],
  },
  {
    version: "1.48.1",
    notes: [
      "Alliance → Membres : rang limité à 12 caractères, épée rouge (peut te flooder) ou bleue (tu peux le flooder).",
    ],
  },
  {
    version: "1.47.0",
    notes: ["Alerte de ponte en bandeau sous le menu du jeu, au lieu d'une fenêtre."],
  },
  {
    version: "1.46.0",
    notes: [
      "Préférences plus compactes, sans animation d'ouverture ; alerte de ponte réglable jusqu'à 8 h.",
    ],
  },
  {
    version: "1.45.0",
    notes: [
      "Préférences : un onglet par page du jeu ; la croix reste toujours visible.",
      "Noms sous les icônes de l'encadré Extension OUAF.",
    ],
  },
  {
    version: "1.44.0",
    notes: ["Option pour masquer le lanceur de chasses (Préférences → Ressources)."],
  },
  {
    version: "1.43.0",
    notes: ["Messagerie : couleurs des titres réglables, séparées des icônes de copie."],
  },
  {
    version: "1.42.0",
    notes: ["L'extension ne fonctionne plus que sur le serveur s5."],
  },
];

class Nouveautes {
  /**
   * Comparaison de deux numéros de version « 1.49.4 ».
   *
   * @static
   * @method comparer
   */
  static comparer(a, b) {
    let x = String(a).split(".").map(Number),
      y = String(b).split(".").map(Number);
    for (let i = 0; i < 3; i++) if ((x[i] || 0) != (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
    return 0;
  }
  /**
   * Entrées publiées après `vue` (dernière version vue par le joueur), jusqu'à
   * `actuelle` ; sans version vue : seulement la version actuelle.
   *
   * @static
   * @method depuis
   * @param {String|null} vue
   * @param {String} actuelle
   * @param {Number} max nombre d'entrées au plus
   */
  static depuis(vue, actuelle, max = 3) {
    return NOUVEAUTES.filter(
      (n) =>
        Nouveautes.comparer(n.version, actuelle) <= 0 &&
        (vue ? Nouveautes.comparer(n.version, vue) > 0 : n.version == actuelle),
    ).slice(0, max);
  }
  /**
   * Texte du toast « mise à jour » : nouveautés depuis la version vue.
   *
   * @static
   * @method html
   */
  static html(vue, actuelle) {
    let entrees = Nouveautes.depuis(vue, actuelle);
    if (!entrees.length) return `Nouvelle version <b>v${actuelle}</b>.`;
    return entrees
      .map(
        (n) =>
          `<b>v${n.version}</b><ul class='o_nouveautes'>${n.notes.map((t) => `<li>${t}</li>`).join("")}</ul>`,
      )
      .join("");
  }
}
