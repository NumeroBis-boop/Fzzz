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
    version: "1.60.4",
    notes: [
      "Convois : la liste de suggestions ne s'ouvre plus quand un pseudo est mis en destinataire depuis le Récapitulatif.",
    ],
  },
  {
    version: "1.60.3",
    notes: [
      "Convois → Récapitulatif : cliquer sur un pseudo l'écrit dans « Destinataire du convoi » (Ctrl+clic : page du joueur).",
    ],
  },
  {
    version: "1.60.2",
    notes: [
      "Convois → Récapitulatif : cliquer sur un pseudo prépare de nouveau un convoi vers ce joueur (retour au fonctionnement de la 1.59).",
    ],
  },
  {
    version: "1.60.1",
    notes: ["Convois → Récapitulatif : le pseudo mène à la page du joueur."],
  },
  {
    version: "1.60.0",
    notes: [
      "Chasses partagées puis annulées (en masse ou une par une) : retirées du forum à l'ouverture de la page Ressources, la page membre reste juste.",
    ],
  },
  {
    version: "1.59.4",
    notes: [
      "Convois envoyés au suivi en avance : une ligne par convoi, au lieu d'additionner à l'avance déjà notée vers ce joueur.",
    ],
  },
  {
    version: "1.59.3",
    notes: [
      "Lanceur « Budget de pertes » : ne fige plus la page Ressources en attendant le jeu.",
      "Console (F12) : une ligne par page indique où passe le temps de chargement (jeu ou extension).",
    ],
  },
  {
    version: "1.59.2",
    notes: ["Préférences : réglage « Couleurs des boîtes » retiré (couleurs par défaut)."],
  },
  {
    version: "1.59.1",
    notes: [
      "« Rétablir l'affichage d'origine » : les styles de l'extension ne touchent plus non plus les pages concernées (messagerie, attaque, laboratoire…), et l'onglet Général coupe aussi le thème des fenêtres, l'encadré Compte+ refait et le radar.",
    ],
  },
  {
    version: "1.59.0",
    notes: [
      "Préférences : chaque onglet a une case « Rétablir l'affichage d'origine » qui laisse ses pages telles que le jeu les affiche.",
    ],
  },
  {
    version: "1.58.0",
    notes: [
      "Pages plus rapides : la page Reine n'est plus relue à chaque page quand la fin de ponte est loin du seuil d'alerte (relue au moins toutes les 30 min), ni deux fois sur Construction et Laboratoire.",
      "Horloge et encadrés de gauche : moins de calculs au chargement et au défilement.",
      "Script utilisateur : Highcharts et le simulateur de Calystène ne sont exécutés que sur les pages qui s'en servent.",
      "Alliance → Membres : petites épées retirées de la colonne Rang.",
    ],
  },
  {
    version: "1.57.2",
    notes: ["Notification des nouveautés : croix de fermeture plus grande."],
  },
  {
    version: "1.57.1",
    notes: ["Mes attaques en cours : bandeau du titre de la couleur du menu principal."],
  },
  {
    version: "1.57.0",
    notes: [
      "Mes attaques en cours : nouvel habillage (parchemin, cadre bois, bandeau vert, boutons en onglets).",
      "« Annuler » affiche le délai d'annulation restant (attaques lancées depuis cet appareil).",
    ],
  },
  {
    version: "1.56.1",
    notes: [
      "Mes attaques en cours : fond plus marqué, encadré, plus large que « Troupes en garnison » sans dépasser le menu.",
    ],
  },
  {
    version: "1.56.0",
    notes: [
      "Mes attaques en cours : collé sous le menu et toujours visible en faisant défiler la page.",
    ],
  },
  {
    version: "1.55.3",
    notes: [
      "Page Armée : « Mes attaques en cours » et « Floods en cours sur toi » à la largeur de « Troupes en garnison ».",
    ],
  },
  {
    version: "1.55.2",
    notes: [
      "Mes attaques en cours : arrivée au format 29/10 04h20:58.",
      "Déplacer son armée : « De » et « Vers » en colonnes (TdC, Dôme, Loge), côte à côte.",
    ],
  },
  {
    version: "1.55.1",
    notes: [
      "Page Armée : TdC, Dôme et Loge au lieu des noms longs ; blocs à égale distance ; Statistiques dans le bloc « Troupes en garnison ».",
      "Page Armée : la liste « Attaque(s) en cours » du jeu retrouve son affichage d'origine, hors cadre.",
    ],
  },
  {
    version: "1.55.0",
    notes: [
      "Page Armée : textes d'aide du jeu retirés, « Déplacer son armée » plus compact, « Statistiques » et « Floods en cours sur toi » repliés par défaut.",
      "Page Armée : « Mes attaques en cours » et la liste « Attaque(s) en cours » du jeu encadrés comme les autres blocs.",
    ],
  },
  {
    version: "1.54.1",
    notes: [
      "Mes attaques en cours : en haut de la page, plus compact (boutons groupés sur la ligne du titre).",
    ],
  },
  {
    version: "1.54.0",
    notes: [
      "Mes attaques en cours : arrivée à la seconde (jj/mm hh:mm:ss), calculée à partir de l'instant où le serveur a produit la page ; minute du RC au survol.",
      "La liste d'attaques du jeu sous « Attaque(s) en cours » est de nouveau affichée telle quelle.",
      "Synchroniser : le cadre rouge entoure aussi « Lancer + partager ».",
    ],
  },
  {
    version: "1.53.3",
    notes: [
      "Synchroniser / Sonder : l'arrivée tombe de nouveau sur la seconde 00 (le temps de trajet était calculé avec la vitesse d'attaque de la cible au lieu de la tienne).",
    ],
  },
  {
    version: "1.53.2",
    notes: ["Boutons « + partager » en haut de la pile, au-dessus du bouton de lancement."],
  },
  {
    version: "1.53.1",
    notes: ["Boutons « + partager » placés sous le bouton de lancement, à la même largeur."],
  },
  {
    version: "1.53.0",
    notes: [
      "Boutons « Lancer + partager » (attaque au terrain de chasse, lanceur de flood, multi-flood) et « Envoyer + partager » (lanceur de chasses) : lancement puis partage dans le forum, en un clic.",
      "Un flood partagé puis annulé est retiré du forum au chargement suivant de la page Armée ou Attaquer.",
    ],
  },
  {
    version: "1.52.12",
    notes: ["Rentabilité de l'étable : niveaux notés « Puceron 1, 2… » au lieu de « Étable »."],
  },
  {
    version: "1.52.11",
    notes: ["Récapitulatif : titre en rouge, comme les titres des cadres du jeu."],
  },
  {
    version: "1.52.10",
    notes: ["Convois à faire devient « Récapitulatif », titre écrit comme « Convois » au-dessus."],
  },
  {
    version: "1.52.9",
    notes: [
      "Convois à faire : cadre de la même largeur que le cadre « Convoi » du jeu, juste au-dessus.",
    ],
  },
  {
    version: "1.52.8",
    notes: [
      "Convois à faire : le tri choisi est conservé tant que tu restes sur la page Convois (même après un envoi).",
    ],
  },
  {
    version: "1.52.7",
    notes: ["Convois à faire : cadre moins large (85 %), centré."],
  },
  {
    version: "1.52.6",
    notes: [
      "Convois à faire : colonnes Joueur, Convoi à faire, Temps de trajet, Horaire de retour ; tableau moins large.",
    ],
  },
  {
    version: "1.52.5",
    notes: [
      "Convois à faire : icône de tri ⇅ dans chaque en-tête ; 1er clic croissant, 2e décroissant, 3e ordre d'origine.",
    ],
  },
  {
    version: "1.52.4",
    notes: [
      "Convois à faire : retour au tableau de la version 1.52.0 (sélecteur de membre dans le tableau, sans tri).",
    ],
  },
  {
    version: "1.52.3",
    notes: [
      "Convois à faire : icône de tri ⇅ sur chaque en-tête ; 1er clic croissant, 2e décroissant, 3e ordre d'origine.",
    ],
  },
  {
    version: "1.52.2",
    notes: [
      "Convois à faire : sélecteur de membre sous le tableau (« + Suivre »), qui ne se réinitialise plus pendant le choix ; noms à gauche, chiffres alignés à droite.",
    ],
  },
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
