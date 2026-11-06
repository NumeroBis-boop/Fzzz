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
    version: "1.85.2",
    notes: [
      "Boîte « Extension OUAF » : « Nouvelle version v… : mettre à jour » s'affiche dès qu'une mise à jour est publiée (vérifié au plus une fois par heure, sur GitHub). Le lien l'ouvre dans Violentmonkey ou Tampermonkey : clique « Mettre à jour », puis recharge la page.",
    ],
  },
  {
    version: "1.85.1",
    notes: ["Préférences → À propos : développement DoggyBag, chasses Grim."],
  },
  {
    version: "1.85.0",
    notes: [
      "Chasses (travail de Grim) : un seul lanceur, sur la page Ressources et dans l'onglet « Lancer » de la boîte Chasse. Tu fixes ce que tu veux (nombre de chasses, terrain ou heure de retour, ratio, pertes acceptées, rendement) et le lanceur calcule le reste. Il remplace le simulateur de Calystène.",
      "Pertes des chasses estimées par un modèle du mécanisme du jeu, vérifié sur plus de 5 000 tirages de son simulateur, à la place des anciens paliers. Un encart permet de simuler avec une autre armée ou d'autres niveaux, et « Envoyer + partager » marche aussi depuis la boîte Chasse.",
      "Synthèse des chasses : TdC gagné et JSN perdues par heure. Préférences → Ressources : TdC à l'arrivée proposé et ratio plancher réglables. « Annuler toutes les chasses » ne compte plus que les chasses encore annulables.",
    ],
  },
  {
    version: "1.84.0",
    notes: [
      "Lanceur de flood : unités gardées affichées sous le lanceur et modifiables pour l'attaque en cours : les antisondes, plus d'autres unités, une ligne par unité (« + ajouter une unité »). Les Préférences (onglet Attaque) en donnent les valeurs par défaut. Une unité choisie garde au plus ce que l'armée en a, et aucune unité gardée ne part.",
      "Multi-flood : mêmes unités gardées, modifiables pour chaque multi-flood ; rien ne part si les attaques en entameraient.",
      "Méthode « Dégressive » réglable dans les Préférences : 1re attaque en % du TdC de la cible, puis même part du TdC restant ou écart fixe de 5 points. Le nombre d'attaques proposées est réglable, et les Préférences n'affichent que les réglages de la méthode choisie.",
      "Corrections du lanceur : « Reste » sur une ligne sans attaque calculée n'est plus perdu, et une attaque sans unité n'est plus envoyée.",
    ],
  },
  {
    version: "1.83.0",
    notes: [
      "Heures : toutes les heures de l'extension (attaques, chasses, convois, pontes, constructions, recherches, partages dans le forum) sont prises sur l'heure du serveur. Un PC ou un téléphone mal réglé ne les décale plus.",
      "Fuseau horaire : elles restent à l'heure de Paris, celle du jeu, même si ton appareil est réglé sur un autre fuseau. Dans ce cas, ton heure locale s'affiche sous l'horloge de l'extension, par exemple « Chez toi : 18:01 (−6 h) ».",
    ],
  },
  {
    version: "1.82.0",
    notes: [
      "Boîte Combat, temps de trajet : les coordonnées viennent de l'export public des joueurs, gardé une heure dans le navigateur, au lieu de lire la page de chaque joueur. Avec toi en joueur 1, les temps partaient d'une mauvaise position : corrigé. Un pseudo inconnu est signalé au lieu de donner une ligne fausse.",
    ],
  },
  {
    version: "1.81.1",
    notes: [
      "Actualiser une page ouverte par un lien d'action du jeu (construire, rechercher, déplacer des troupes avec les flèches de la page Armée, annuler un convoi) ne refait plus l'action : la page est simplement rechargée.",
    ],
  },
  {
    version: "1.81.0",
    notes: [
      "Temps de trajet de la page Membres et carte de l'alliance : les coordonnées viennent de l'export public des joueurs du jeu (une seule requête), au lieu de lire la page de chaque membre. Seuls les membres arrivés depuis le dernier export sont lus un par un.",
      "Boîte « Extension OUAF » : message si Optizzz est aussi active, avec les fonctions à y couper pour que les deux extensions ne se gênent pas.",
    ],
  },
  {
    version: "1.80.3",
    notes: [
      "Lanceur de flood, méthode « Optimisée » : l'attaque « limite » amène la cible à exactement la moitié de ton TdC (encore à portée) au lieu de garder 1 cm² de marge : 1 cm² de plus par flood optimisé.",
    ],
  },
  {
    version: "1.80.2",
    notes: [
      "Floods partagés : une cible à exactement la moitié du TdC du lanceur est à portée (vérifié sur un rapport de combat). La prise de ces floods n'est plus comptée à tort comme « hors portée » ; les épées de la page Membres suivent la même règle.",
    ],
  },
  {
    version: "1.80.1",
    notes: [
      "Retour au lanceur de chasse d'avant la 1.80.0 (page Ressources, onglet « Simuler » de la boîte Chasse) et au simulateur de Calystène : le nouveau lanceur est retiré en attendant d'être mis au point.",
    ],
  },
  {
    version: "1.80.0",
    notes: [
      "Chasses (travail de Grim) : un seul lanceur, sur la page Ressources et dans l'onglet « Simuler » de la boîte Chasse. Tu fixes ce que tu veux (nombre de chasses, terrain ou heure de retour, difficulté, pertes acceptées, rendement en cm²/h) et le lanceur calcule le reste. Le simulateur de Calystène est remplacé par ce lanceur.",
      "Chasses : le TdC à l'arrivée proposé n'est plus plafonné à 1 000 000 cm² ; plafond réglable dans Préférences → Ressources (2 000 000 par défaut).",
      "Synthèse des chasses : TdC gagné et JSN perdues par heure.",
    ],
  },
  {
    version: "1.79.3",
    notes: [
      "Script utilisateur sur iPhone et iPad (app Userscripts dans Safari) : la mise en forme de l'extension s'affiche, les réglages enregistrés (position de l'horloge, code du site OUAF…) sont gardés, et les graphiques et le simulateur de Calystène se chargent.",
    ],
  },
  {
    version: "1.79.2",
    notes: [
      "Plus d'alerte de fin de ponte sur la page d'attaque ni sur la page Armée : affichée après coup, elle décalait les boutons sous le doigt. Elle reste sur les autres pages.",
    ],
  },
  {
    version: "1.79.1",
    notes: [
      "Page d'attaque : le bouton « Sonder » indique sa destination : « Sonder (TdC) », « Sonder (Dôme) » ou « Sonder (Loge) ».",
    ],
  },
  {
    version: "1.79.0",
    notes: [
      "Lanceur de flood : la colonne « Supp.* » s'appelle « Reste ».",
      "Préférences → Armée : unité de l'antisonde au choix pour le terrain et pour le dôme séparément.",
      "Préférences → Page membre : vue par défaut de la page Membres de l'alliance (Standard, Temps de trajet ou Floods et chasses en cours).",
      "Page d'attaque : l'info-bulle de l'armée (HB/AB) n'apparaît que quand le pointeur est sur le tableau Armée.",
    ],
  },
  {
    version: "1.78.1",
    notes: [
      "Page d'attaque : « Annuler » dans la liste du jeu n'envoie plus sur la page Ennemies ; l'attaque est annulée et tu restes sur la page d'attaque.",
    ],
  },
  {
    version: "1.78.0",
    notes: [
      "Affichages plus rapides : les sujets du forum partagé lus pour les floods et chasses en cours (pages Armée, Membres, joueur) sont réutilisés pendant une minute d'une page à l'autre. Un nouveau partage d'un allié ou d'un autre appareil peut donc apparaître jusqu'à une minute plus tard ; les partages et retraits relisent toujours le forum.",
    ],
  },
  {
    version: "1.77.0",
    notes: [
      "Plus rapide : attaques, sondes, floods, chasses, annulations et replacement de l'armée passent devant les lectures automatiques de l'extension (forum, profils…), qui attendent la fin de l'action.",
      "« Replacer l'armée » : si seules les antisondes sont hors de la loge, seule la différence est déplacée (1 ou 2 requêtes au lieu de 3), et rien pour un lieu déjà dans ses bornes.",
      "Compte+ : à la fin d'une recherche, ses niveaux sont relus automatiquement (Vitesse d'attaque juste pour les temps de trajet), sans passer par la page Laboratoire.",
    ],
  },
  {
    version: "1.76.1",
    notes: [
      "« Replacer l'armée » : si l'unité choisie pour les antisondes manque, la première unité disponible est utilisée ; s'il n'y a pas assez d'unités pour les deux maximums, 1 en TdC et le maximum possible en dôme (dans la limite de son maximum).",
    ],
  },
  {
    version: "1.76.0",
    notes: [
      "Alerte de fin de ponte : nouveaux choix 12 h, 16 h et 24 h.",
      "« Replacer l'armée » sans recharger la page : tout en loge, puis les antisondes (90 à 100 % des maximums des préférences) vers le TdC puis le dôme ; le tableau se met à jour. Unité des antisondes au choix dans Préférences → Armée (par défaut la première disponible).",
    ],
  },
  {
    version: "1.75.0",
    notes: [
      "« Lancer + partager » sur chaque lieu, de la couleur du lieu choisi : l'attaque est publiée avec sa zone (Dôme ou Loge), affichée sans TdC pris dans les chronologies, la page Membres et les floods reçus. « Partager » aussi pour ces attaques dans « Mes attaques en cours ».",
      "« Synchro sonde » garde la couleur de « Synchroniser » (aucun des deux n'envoie d'attaque).",
      "Une attaque en dôme ou en loge ne baisse plus le TdC estimé de la cible pour les floods suivants.",
    ],
  },
  {
    version: "1.74.0",
    notes: [
      "Page d'attaque : le bouton « Attaquer » prend la couleur du lieu choisi (vert terrain, orange dôme, rouge loge).",
      "Boutons « Sonder » (envoi immédiat) et « Synchro sonde » (compte à rebours, c'est toi qui cliques sur Sonder). Ils ne changent jamais la liste Lieu : la sonde part vers le lieu réglé dans Préférences → Attaque → Sonder, ou à défaut celui de la liste. Unité et nombre réglables (par défaut 1 Jeune Soldate Naine) ; sans cette unité, 1 unité de la moins chère disponible.",
    ],
  },
  {
    version: "1.73.1",
    notes: [
      "Lanceur de flood, méthode « Optimisée » : plus d'attaque de 0 ou −1 unité quand la cible est déjà à la limite de portée, ni de petite attaque inutile quand le reste de l'armée ne dépasse pas 20 % du terrain de la cible (tout part d'un coup, même terrain pris).",
    ],
  },
  {
    version: "1.73.0",
    notes: [
      "Page d'attaque : bloc « Mes attaques en cours » retiré (il apparaissait après coup au-dessus du formulaire et déplaçait le bouton « Attaquer »). Il reste sur la page Armée ; le partage des floods fonctionne comme avant.",
    ],
  },
  {
    version: "1.72.0",
    notes: [
      "Page d'attaque : boutons « Sonder » et « Sonder direct » retirés (ils passaient le lieu en Loge Impériale). Le bouton du jeu « Attaquer » ne bouge plus : « Lancer + partager » et « Synchroniser » s'affichent dessous dès l'ouverture de la page.",
      "« Lancer + partager » n'envoie que sur le Terrain de chasse (vérifié au clic) et une seule fois par clic.",
    ],
  },
  {
    version: "1.71.0",
    notes: [
      "Boîte « Extension OUAF » : message en rouge si Toolzzz ou Outiiil est active en même temps (les deux extensions se gênent).",
    ],
  },
  {
    version: "1.70.3",
    notes: [
      "Partage des floods : un partage ou un retrait du forum interrompu par un changement de page est repris automatiquement au chargement de la page suivante, quelle qu'elle soit.",
    ],
  },
  {
    version: "1.70.2",
    notes: [
      "« Flooder + partager » : le partage n'est plus perdu quand l'armée se replace après le flood (le replacement attend la fin du partage) ; un partage interrompu est refait à la page suivante.",
      "Flood annulé : retiré du forum même s'il a été partagé à la main, depuis un autre appareil, ou sans être capturé par l'extension.",
    ],
  },
  {
    version: "1.70.1",
    notes: [
      "Horloge flottante : à sa place d'origine au-dessus de l'encart S5 tant qu'elle n'est pas déplacée ; une fois déplacée, même position sur toutes les pages et tous les onglets.",
    ],
  },
  {
    version: "1.70.0",
    notes: [
      "Horloge flottante : toujours visible, déplaçable en la faisant glisser ; sa position est retenue.",
    ],
  },
  {
    version: "1.69.1",
    notes: ["Page Ennemies : bouton « Charger toutes les pages » au style des boutons du jeu."],
  },
  {
    version: "1.69.0",
    notes: [
      "Page Ennemies : bouton « Charger toutes les pages » dans Filtrer la liste, qui ajoute au tableau les pages suivantes de la recherche (le filtre porte alors sur tous les joueurs).",
    ],
  },
  {
    version: "1.68.2",
    notes: ["Page Ennemies : case « tous les joueurs » collée à son texte, à gauche."],
  },
  {
    version: "1.68.1",
    notes: [
      "Page Ennemies : Filtrer la liste aligné à gauche, option « tous les joueurs » en bas, en italique.",
    ],
  },
  {
    version: "1.68.0",
    notes: [
      "Page Ennemies, Filtrer la liste : case « Afficher tous les joueurs, même hors de portée », qui relance la recherche du jeu sans limite de terrain.",
    ],
  },
  {
    version: "1.67.1",
    notes: ["Convois : lien vers le site de suivi plus discret (italique, couleur atténuée)."],
  },
  {
    version: "1.67.0",
    notes: [
      "Convois → Récapitulatif : lien « Ouvrir le site de suivi OUAF », qui ouvre le site déjà connecté avec le mot de passe enregistré.",
    ],
  },
  {
    version: "1.66.4",
    notes: ["Page Ennemies : « Filtrer la liste » vraiment sous l'encadré Cibles."],
  },
  {
    version: "1.66.3",
    notes: ["Page Ennemies : « Filtrer la liste » placé juste sous l'encadré Cibles."],
  },
  {
    version: "1.66.2",
    notes: ["Bouton « Mettre à jour l'extension » déplacé dans Préférences → Général."],
  },
  {
    version: "1.66.1",
    notes: [
      "Alliance → Membres, vue Floods : rang, pseudo et terrain au plus juste, les colonnes Prochaine variation, TdC (estimé) et TdC final se partagent la place restante.",
    ],
  },
  {
    version: "1.66.0",
    notes: [
      "Page Ennemies : champ « Filtrer la liste » sous l'encadré Cibles, qui ne garde que les fourmilières dont le pseudo ou l'alliance contient le texte tapé (plusieurs termes séparés par « ; »).",
    ],
  },
  {
    version: "1.65.1",
    notes: [
      "Alliance → Membres : les épées de portée encadrent au plus près la valeur du terrain.",
    ],
  },
  {
    version: "1.65.0",
    notes: [
      "Case « Désactiver l'extension » sous le titre de la boîte Extension OUAF : chaque page s'affiche comme sans extension, sans aucun calcul ni requête ; seule la boîte reste, pour la réactiver.",
      "Préférences → À propos → « Mettre à jour l'extension » : avec le script utilisateur, ouvre directement la dernière version dans Violentmonkey ou Tampermonkey.",
    ],
  },
  {
    version: "1.64.0",
    notes: [
      "Alliance → Membres : épées de portée affichées même sans Compte+ (bleue : peut te flooder, rouge : tu peux le flooder) ; vue Floods sans la colonne « Unités envoyées ».",
      "Évolution du TdC : une chasse s'affiche simplement « Chasse ».",
    ],
  },
  {
    version: "1.63.1",
    notes: [
      "Mes attaques en cours : un envoi refusé par le jeu (troupes insuffisantes…) n'est plus compté dans le TdC estimé des floods suivants sur la même cible.",
    ],
  },
  {
    version: "1.63.0",
    notes: [
      "Mes attaques en cours : tes chasses partagées dans le forum apparaissent avec tes floods, dans l'ordre d'arrivée (heure à la minute).",
      "Alliance → Membres : la colonne « Avec » de l'évolution du TdC devient « Lanceur → cible » (aussi sur la page d'un membre) ; colonne « Joueur cible » retirée ; épées de portée dans la vue Floods ; tableau resserré pour tenir dans le cadre.",
      "Messagerie sur téléphone : l'analyse des chasses ne dépasse plus du cadre.",
      "Alerte de fin de ponte : 8 h par défaut (un réglage déjà enregistré est gardé). Version installée affichée à côté du titre « Extension OUAF ».",
    ],
  },
  {
    version: "1.62.2",
    notes: [
      "Convois → Récapitulatif : le clic sur un montant garde à la fourmilière les ouvrières qui exploitent ton terrain ; le montant est réduit à ce que les autres peuvent porter (un message l'indique).",
    ],
  },
  {
    version: "1.62.1",
    notes: [
      "Convois → Récapitulatif : un clic sur un pseudo ou un montant écrit directement le destinataire (et les matériaux) dans le bloc Convoi, sans recharger la page.",
    ],
  },
  {
    version: "1.62.0",
    notes: [
      "Convois → Récapitulatif : cliquer sur le montant d'un convoi à faire prépare le convoi vers ce joueur avec ce montant en matériaux (au plus ton stock). Tu valides toi-même.",
    ],
  },
  {
    version: "1.61.3",
    notes: [
      "Mes attaques en cours : l'heure d'arrivée est vérifiée avec celle qu'écrit le jeu (« Arrivée à … »). Si l'horloge du navigateur est décalée, l'heure du jeu s'affiche, à la minute (en italique), et c'est elle qui est partagée.",
    ],
  },
  {
    version: "1.61.2",
    notes: [
      "Mes attaques en cours : l'heure d'arrivée n'est plus en avance sur téléphone après une mise en veille (écart égal à la durée de veille).",
    ],
  },
  {
    version: "1.61.1",
    notes: [
      "Convois : un convoi envoyé au suivi reste « Enregistré » après la disparition de son lien Annuler, et sur un autre appareil.",
      "Convois : un avertissement s'affiche si le convoi n'a pas pu être noté dans le forum de l'alliance ; un convoi retrouvé sur le site de suivi mais absent du forum y est ajouté.",
    ],
  },
  {
    version: "1.61.0",
    notes: [
      "Alliance → Membres : la page s'ouvre toujours sur la vue Standard, sans lecture du forum ; les floods et chasses partagés ne sont chargés qu'au clic sur leur vue.",
    ],
  },
  {
    version: "1.60.6",
    notes: [
      "Partage (chasses, floods, convois) : la section cachée du forum s'appelle désormais « BDD partagée cachée » ; l'ancien nom reste reconnu.",
    ],
  },
  {
    version: "1.60.5",
    notes: [
      "Convois → Récapitulatif : cliquer sur un pseudo ouvre de nouveau la page Convois avec ce joueur en destinataire, comme en 1.59, y compris quand la carte d'alliance n'a pas son numéro.",
    ],
  },
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
