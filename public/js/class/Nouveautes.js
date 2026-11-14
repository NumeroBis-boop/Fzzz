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
    version: "1.112.0",
    notes: [
      "Forum de l'alliance : boutons « GIF » et « Smileys » sous le message que tu écris (nouveau sujet, réponse, modification), avec les mêmes listes que dans les chats. Les codes des smileys deviennent des images à l'envoi.",
      "Deux cases dans Préférences → Affichage pour les masquer.",
    ],
  },
  {
    version: "1.111.0",
    notes: [
      "Préférences réorganisées : Options, Partage de données, Mise en page, Armée et floods, Messagerie, Affichage, Chasseur, Grenier, Pages et À propos. Seuls les réglages choisis par l'alliance restent modifiables ; les autres ajouts de l'extension sont toujours affichés.",
      "Nouvel onglet « Pages » : décoche une page pour la voir telle que le jeu l'affiche, sans l'extension. Il remplace les cases « Rétablir l'affichage d'origine » ; tes choix sont gardés.",
      "Messagerie : les ajouts de l'extension sont décochés par défaut, sauf les smileys. Les boutons « Exporter mes chasses » et « Exporter mes RC » sont dans Préférences → Partage de données, utilisables de n'importe quelle page ; le rappel d'export y mène.",
    ],
  },
  {
    version: "1.110.3",
    notes: [
      "Rôle Chasseur : le rappel « Export des chasses à faire » ne s'affiche plus quand l'export automatique est actif. Il revient seulement si un essai d'export échoue, ou si tu décoches l'export automatique (Préférences → Partage de données).",
      "L'export automatique part seulement après un clic sur « Envoyer » ou « Envoyer + partager » du lanceur de chasses : avec le formulaire du jeu, tes chasses ne sont pas exportées automatiquement.",
    ],
  },
  {
    version: "1.110.2",
    notes: [
      "Page d'un membre : le bloc « Chasses et floods en cours partagés » ne montre plus que l'évolution du TdC, où chaque chasse et chaque flood a sa ligne. Les tableaux séparés des chasses et des floods sont retirés.",
    ],
  },
  {
    version: "1.110.1",
    notes: [
      "Rôle Chasseur : l'export automatique des chasses part après ton clic sur « Envoyer » ou « Envoyer + partager » du lanceur de chasses (deux fois par semaine au plus, après le mercredi et le dimanche 22h). Le formulaire du jeu ne le déclenche plus.",
      "L'export automatique passe après toutes les autres demandes de l'extension au jeu : il ne retarde ni l'envoi des chasses, ni leur partage, ni le reste.",
      "Jusqu'à ce clic, le rappel « Export des chasses à faire » s'affiche de nouveau : tu peux aussi exporter tout de suite avec le bouton de la messagerie.",
    ],
  },
  {
    version: "1.110.0",
    notes: [
      "Rôle Chasseur : l'export automatique des chasses ne part plus à la première page ouverte après le mercredi et le dimanche 22h, mais quand tu lances une chasse après ces dates (deux fois par semaine au plus). Sans chasse lancée, rien n'est lu ni envoyé ; le bouton « Exporter mes chasses » reste.",
      "Les chasseurs de l'alliance (liste tenue par DoggyBag) ont le rôle « Chasseur » par défaut. Tu peux le changer dans Préférences → Rôle.",
    ],
  },
  {
    version: "1.109.0",
    notes: [
      "Rôle Chasseur : tes rapports de chasse sont maintenant exportés automatiquement vers le Google Sheet, deux fois par semaine, à la première page que tu ouvres après le mercredi et le dimanche à 22h (jamais sur les pages Armée et d'attaque). Tu es prévenu avant le premier export ; les rapports que tu n'avais pas lus restent marqués non lus. Le bouton « Exporter mes chasses » de la messagerie reste, pour un export immédiat. Case dans Préférences → Partage de données.",
      "Outils pour Chasseur → Synthèse : tout en bas, un « Tableau récapitulatif » liste chacune de tes chasses de la période (retour, terrain, pertes, pertes par M cm², nourriture, expéditions, troupes envoyées, difficulté par cm²), puis leur total.",
      "Horloge : une croix la masque pendant 1 h. Elle revient dès que tu ouvres une page d'attaque, ou par le lien « La remettre » de la notification.",
    ],
  },
  {
    version: "1.108.2",
    notes: [
      "Convois : en cliquant sur un montant du Récapitulatif, les matériaux pouvaient être remplis avec 1 de trop par rapport au stock affiché dans l'encart. Le montant ne dépasse plus ce stock.",
    ],
  },
  {
    version: "1.108.1",
    notes: [
      "Firefox sur Android : correction d'une erreur qui empêchait les curseurs (ponte, récolte, coûts, Préférences…) de réagir au doigt.",
      "Partage de données : juste après une mise à jour, le sujet « Stats membres » pouvait ne pas être trouvé et le relevé du jour était sauté. C'est corrigé ; si le sujet existe mais que son adresse est illisible, un nouvel essai est fait plus tard dans la journée.",
    ],
  },
  {
    version: "1.108.0",
    notes: [
      "Page d'attaque : la liste déroulante du lieu visé prend la couleur du lieu choisi, comme les boutons (vert terrain, orange dôme, rouge loge), et ses choix sont colorés aussi. Sur téléphone, seule la liste fermée est colorée : la fenêtre de choix est celle du téléphone. Case dans Préférences → Attaque.",
    ],
  },
  {
    version: "1.107.0",
    notes: [
      "Partage de données : quand le niveau de ta Champignonnière ou de ton Étable à pucerons change, tes statistiques sont renvoyées au fichier de l'alliance à la première page que tu ouvres ensuite, sans attendre le lendemain (seulement si tu partages ce niveau ; cases dans Préférences → Partage de données).",
    ],
  },
  {
    version: "1.106.0",
    notes: [
      "Page Armée : le replacement de l'armée passe toujours avant le chargement du bloc « Mes attaques en cours ». Après un flood, le bloc attend la fin du replacement ; si tu cliques sur « Replacer l'armée » pendant qu'il se charge, il se met en pause.",
      "« Mes attaques en cours » : le titre indique le chargement (lectures faites, temps restant estimé).",
      "« Mes attaques en cours » : plus de bouton « Retirer » ni « Retirer mes partages ». Un flood partagé ne quitte le forum que s'il est réellement annulé.",
      "Smileys de l'alliance : la mention sous les smileys est retirée, le code de chaque smiley reste dans son info-bulle.",
    ],
  },
  {
    version: "1.105.1",
    notes: [
      "Page Armée, « Mes attaques en cours » : pour une chasse dont le jeu ne détaille pas les troupes (compte sans Compte+), la colonne « Unités » affiche « — » au lieu de 0.",
    ],
  },
  {
    version: "1.105.0",
    notes: [
      "Page Armée : le bloc « Mes attaques en cours » liste maintenant tous tes mouvements dans l'ordre — tes attaques, tes chasses (partagées ou non) et les floods partagés sur toi — avec la variation de ton TdC et ton TdC après chacun, comme sur la page d'un membre.",
      "« Mes attaques en cours » : bouton « Partager » pour chaque chasse, et « Partager tous » publie aussi tes chasses. « Annuler » est écrit en noir gras : l'ordre du jeu est annulé d'abord, le partage du forum retiré ensuite.",
      "Page Armée : le bloc « Floods en cours sur … » est supprimé, ses lignes sont dans « Mes attaques en cours ».",
    ],
  },
  {
    version: "1.104.0",
    notes: [
      "Partage de données (nouvel onglet des Préférences) : une fois par jour, à ta première page, l'extension envoie au Google Sheet « Stats membres » de l'alliance tes TdP, CdF, FdF HB, FdF AB, VA, VC, Puceron et Champignonnière. Tu es prévenu avant le premier envoi et tu choisis, case par case, ce que tu partages. Rien n'est envoyé tant que l'alliance n'a pas mis son fichier en place.",
    ],
  },
  {
    version: "1.103.0",
    notes: [
      "Smileys de l'alliance : ils s'écrivent comme ceux du jeu, avec un code entre accolades. Un clic sur un smiley écrit son code (par exemple {colley}), que tu peux aussi taper ; il devient son image quand tu envoies le message, visible de tous.",
      "Smileys de l'alliance : ils sont rangés sous les titres écrits dans le sujet « Smileys de l'alliance » (« Membres », « Génériques »…).",
      "Messagerie : bouton « Smileys OUAF » pour écrire un nouveau message ou une réponse. Une case dans Préférences → Messagerie.",
    ],
  },
  {
    version: "1.102.0",
    notes: [
      "Page Membres de l'alliance : ta ligne est mise en surbrillance. Une case dans Préférences → Page membre.",
    ],
  },
  {
    version: "1.101.6",
    notes: [
      "Correction : l'heure d'une chasse partagée est maintenant la minute où le TdC change (celle du rapport), une minute après l'« Arrivée à » affichée par le jeu. Une synchro calée sur l'heure affichée arrivait trop tôt. Les chasses déjà partagées sont corrigées quand le chasseur, à jour, ouvre sa page Ressources.",
    ],
  },
  {
    version: "1.101.5",
    notes: [
      "Attaques au dôme ou en loge : l'info-bulle de « (dôme) » ou « (loge) » indique seulement que le TdC est pris comme au terrain de chasse.",
    ],
  },
  {
    version: "1.101.4",
    notes: [
      "Correction : une attaque au dôme ou en loge prend du TdC avec la même règle qu'au terrain de chasse (au plus 20 % du TdC de la cible, rien hors de portée). Elle compte maintenant dans « Mes attaques en cours », les floods partagés, la page Membres, la page Armée, la page d'un membre et le TdC à l'impact, avec « (dôme) » ou « (loge) » à côté de la prise.",
    ],
  },
  {
    version: "1.101.3",
    notes: [
      "Correction : avec « Envoyer + partager » sur la page Ressources, le partage pouvait ne jamais se faire, sans aucun message (page relue trop tard, ou demande du navigateur de renvoyer un formulaire). La page est maintenant relue sans renvoyer de formulaire, et si le partage n'a pas pu se faire, un message le dit et indique le bouton « Partager mes chasses ».",
    ],
  },
  {
    version: "1.101.2",
    notes: [
      "Correction : un flood d'un autre membre hors de portée à l'impact comptait quand même 20 % sur la page Armée (« Floods en cours sur … »), dans le TdC à l'impact du lanceur de Flood et sur la page d'un membre. Comme la page Membres, ces calculs connaissent maintenant le TdC de chaque membre et les chasses des joueurs liés par des floods.",
    ],
  },
  {
    version: "1.101.1",
    notes: [
      "Chat : le panneau « Smileys OUAF » se ferme après le choix d'un smiley, comme celui des GIF.",
    ],
  },
  {
    version: "1.101.0",
    notes: [
      "Chat : bouton « Smileys OUAF » à côté de « GIF ». Il montre les smileys du premier message du sujet « Smileys de l'alliance » du forum caché (à créer, avec les adresses des images). Un clic met le smiley dans ton message ; le panneau reste ouvert pour en ajouter d'autres. Une case dans Préférences → Chat.",
    ],
  },
  {
    version: "1.100.3",
    notes: [
      "Chat, bouton « GIF » : un clic sur le titre « Mes GIF » ou « GIF de l'alliance » replie ou déplie sa liste, qui reste comme tu l'as laissée. Le bouton « Relire » disparaît : la liste de l'alliance est relue à chaque ouverture de la page du chat.",
      "Page Armée : « Replacer l'armée » est plus rapide, environ 1 à 2 s au lieu de 4 à 7 s : une courte pause entre deux déplacements évite que le jeu en ignore un.",
    ],
  },
  {
    version: "1.100.2",
    notes: [
      "Chat : la liste « GIF de l'alliance » est relue à chaque ouverture de la page du chat. Un GIF ajouté au sujet du forum apparaît sans cliquer sur « Relire », qui reste pour une page laissée ouverte.",
    ],
  },
  {
    version: "1.100.1",
    notes: [
      "Correction : l'encart Compte+ pouvait rester vide (sans les pontes, constructions, recherches…) quand la vue radar avait été choisie et que le radar ne s'affichait plus. Le tableau n'est plus caché que par le radar affiché à sa place.",
      "Partage des chasses et des floods : après l'envoi, le forum est relu. Si le sujet n'a pas été créé ou modifié (grade sans droit d'écriture, réponse qui bloque le premier message), un message rouge le dit au lieu d'annoncer le partage. « Section « BDD partagée cachée » introuvable » rappelle qu'elle peut exister mais être cachée à ton grade : demande à un chef.",
    ],
  },
  {
    version: "1.100.0",
    notes: [
      "Lanceur de Flood : option « TdC à l'impact dès l'ouverture » dans Préférences → Attaque (décochée par défaut). Cochée, le TdC à l'impact est calculé sans clic à l'ouverture de la page d'attaque et mis dans « Mon Terrain » et le champ de la cible : le flood est calculé au TdC à l'impact. Une valeur que tu tapes est gardée.",
      "Chat : le bouton « GIF » est aussi sur le chat général. Correction : avec le Compte+, il pouvait se retrouver caché dans la liste des couleurs du jeu ; il est au bout de la ligne d'« Envoyer » et passe à la ligne sur téléphone au lieu d'élargir la page.",
    ],
  },
  {
    version: "1.99.0",
    notes: [
      "Page Membres (info-bulle de la vue « Floods et chasses en cours ») et page d'un membre : après le pseudo, « à portée le 10/11 à 12h45 », l'heure à partir de laquelle tu pourras le flooder d'après les floods et chasses partagés (son TdC et le tien). Sinon « déjà à portée », avec « jusqu'au … » s'il doit en sortir, ou « hors de portée ».",
    ],
  },
  {
    version: "1.98.1",
    notes: [
      "Chat d'alliance : le bouton « GIF » est au bout de la ligne d'« Envoyer », après les boutons de mise en forme, avec le même aspect que « Envoyer » et « Actualiser ».",
    ],
  },
  {
    version: "1.98.0",
    notes: [
      "Chat d'alliance : bouton « GIF ». « Mes GIF » garde dans ton navigateur les GIF que tu envoies avec [img]adresse du GIF[/img] ; « GIF de l'alliance » montre ceux du premier message du sujet « GIF de l'alliance » du forum caché. Un clic met le GIF dans ton message, tu l'envoies toi-même ; tous les membres le voient, même sans l'extension. Une case pour chaque liste dans Préférences → Chat.",
    ],
  },
  {
    version: "1.97.2",
    notes: [
      "Convois : les convois arrivés ne sont plus recopiés dans les sujets « Historique Convois » du forum, ils sont seulement retirés du sujet « Convois | pseudo ». Les sujets « Historique Convois » déjà créés ne servent plus : ils peuvent être supprimés à la main.",
    ],
  },
  {
    version: "1.97.1",
    notes: [
      "Rappel « Export des chasses à faire » : un export fait dans les 24 h avant le mercredi ou le dimanche 22h compte, le bandeau ne revient plus juste après. Il en faut deux par semaine : le jeu supprime les conversations lues au bout de 7 jours.",
    ],
  },
  {
    version: "1.97.0",
    notes: [
      "Préférences → Rôle : choisis ton rôle dans l'alliance (passeur, grenier ou chasseur).",
      "Chasseur : à partir du mercredi et du dimanche 22h (heure du serveur), un bandeau « Export des chasses à faire » mène à la messagerie, où « Exporter mes chasses » est encadré, jusqu'à ce que tu exportes tes chasses. La croix le masque une heure ; case dans l'onglet Général.",
    ],
  },
  {
    version: "1.96.3",
    notes: [
      "Lanceur de Flood : « Flooder + partager » et « Flooder » sont en vert, la couleur du TdC (les floods partent toujours sur le terrain de chasse), comme « Lancer + partager » vers le TdC.",
    ],
  },
  {
    version: "1.96.2",
    notes: [
      "Lanceur de Flood : la méthode par défaut devient « Dégressive ». Si « Optimisée » (l'ancien défaut) était enregistrée, elle passe en Dégressive ; « Standard » et « Uniforme » restent. Elle se change dans Préférences → Attaque, « Méthode de flood par défaut ».",
    ],
  },
  {
    version: "1.96.1",
    notes: [
      "Préférences → Page membre : l'onglet couvre aussi la page Membres de l'alliance. « Rétablir l'affichage d'origine » s'y applique, et une case pour le nombre de membres par état, les épées de portée, le tableau triable (vues « Standard » et « Temps de trajet »), la vue « Floods et chasses en cours » et la Carte de l'alliance.",
    ],
  },
  {
    version: "1.96.0",
    notes: [
      "Préférences : cinq nouveaux onglets, Reine, Classement (page d'une alliance), Chat, Forum et Compte, chacun avec « Rétablir l'affichage d'origine » et une case par ajout. Toutes cochées : rien ne change tant que vous ne décochez pas.",
    ],
  },
  {
    version: "1.95.12",
    notes: [
      "Préférences : une case aussi pour chaque ajout des onglets Général (menus « Carte » et « Coûts », info-bulles de la barre d'infos, jauge du TdC, radar, style des champs, encadrés rapprochés, notes de version), Ressources, Laboratoire, Messagerie et Page membre. Toutes cochées : rien ne change tant que vous ne décochez pas.",
    ],
  },
  {
    version: "1.95.11",
    notes: [
      "Lanceur de Flood : « Flooder + partager » et « Flooder » passent à gauche. À leur droite, « Calculer le TdC à l'impact » donne ton TdC et celui de la cible à l'arrivée d'un flood lancé maintenant (floods et chasses partagés, plus tes propres attaques et chasses en cours), avec l'écart à maintenant ; une cible hors portée à l'impact est signalée en rouge.",
      "Un clic sur l'un de ces TdC le met dans « Mon Terrain » ou dans le champ de la cible, et les attaques se recalculent. Case dans Préférences → Attaque.",
    ],
  },
  {
    version: "1.95.10",
    notes: [
      "Page d'un membre, tableau « Évolution du TdC » : la ligne du TdC qu'il aurait à l'arrivée d'une attaque lancée à l'ouverture de la page (votre Vitesse d'attaque) est surlignée, comme dans la page Membres.",
      "Préférences : une case pour chaque ajout de la page d'attaque (« Lancer + partager », « Sonder », « Synchroniser », couleur du bouton « Attaquer », ligne de retour, info-bulle de l'armée, Lanceur de Flood), de la liste des Ennemies (colonne « Temps ») et de la page Armée (mise en page, « Replacer l'armée », temps HOF, Statistiques, nombres dans les titres, ajouts hors Compte+). Toutes cochées : rien ne change tant que vous ne décochez pas.",
    ],
  },
  {
    version: "1.95.9",
    notes: [
      "Alliance → Membres, vue « Floods et chasses en cours » : les colonnes « Prochaine variation » et « TdC (estimé) » deviennent « Date dernier mouvement » (dernier flood ou dernière chasse en cours) et « Variation totale de TdC » (gain ou perte après tous les mouvements).",
      "Dans l'info-bulle d'un membre, la ligne du TdC qu'il aurait à l'arrivée d'une attaque lancée à l'ouverture de la page (temps de trajet à votre Vitesse d'attaque) est surlignée.",
    ],
  },
  {
    version: "1.95.8",
    notes: [
      "Export des chasses et des RC sur téléphone : la date des rapports, que le jeu écrit sur deux lignes (« 07/11/26 » puis « 23h35 »), est lue ; plus besoin de passer en mode ordinateur.",
    ],
  },
  {
    version: "1.95.7",
    notes: [
      "Préférences : nouvelles cases pour masquer les boutons « Exporter mes chasses » / « Exporter mes RC » et le rangement automatique des messages (Messagerie), le bloc « Filtrer la liste » de la page Ennemies (Attaque) et la mise en page en deux colonnes des convois en cours (Convois).",
    ],
  },
  {
    version: "1.95.6",
    notes: [
      "Export des chasses et des RC : dates lues aussi en toutes lettres, en français ou en anglais (« 7 nov. 2026 à 21h07 », « Nov 7 2026 at 9:07 PM ») ; l'heure exportée est toujours celle du serveur, même pour un joueur qui voit l'heure de chez lui.",
    ],
  },
  {
    version: "1.95.5",
    notes: [
      "Export des chasses et des RC : la date des rapports est lue même écrite autrement (année absente, « 21:07 », « aujourd'hui », « hier ») ; un rapport dont la date reste illisible n'est plus envoyé sans date : le message le dit et cite la date lue.",
      "Export : les rapports envoyés sans date par une version d'avant sont relus et renvoyés avec leur date au prochain export.",
      "Google Sheet : un nouveau chasseur entre tout seul dans l'onglet « Statistiques » et son graphique des terrains, sans recréer l'onglet (script à recoller et redéployer une fois).",
      "Synthèse : pas d'écart à la moyenne pour un joueur qui n'a pas chassé dans la période.",
    ],
  },
  {
    version: "1.95.4",
    notes: [
      "Convois : le « - » et l'état de suivi (« ✅ Enregistré », « 📤 Envoyer au suivi ») dans leur colonne, le texte du convoi replié à côté : « Annuler » n'est plus jamais au-dessus ou en dessous d'un bouton d'envoi.",
      "Synthèse : la ligne en tirets des pertes par M cm² est la moyenne de la période (pertes totales ÷ terrain total), le même chiffre que la carte.",
      "Synthèse : du 7e au 12e autre chasseur, une nuance plus claire ou plus foncée des six couleurs, toujours en pointillés.",
      "Google Sheet : la même moyenne et les mêmes nuances dans l'onglet « Statistiques » (la personne qui gère le fichier recolle le script, le redéploie et recrée l'onglet).",
    ],
  },
  {
    version: "1.95.3",
    notes: [
      "Synthèse : sous « Pertes » et « Pertes / M cm² », un écart au-dessus de la moyenne des chasseurs est en rouge (plus de pertes, c'est moins bien), en dessous en vert.",
      "Google Sheet, onglet « Statistiques » : l'écart de chaque chiffre à la moyenne des chasseurs et le tableau des chasseurs de la période, comme dans la Synthèse (la personne qui gère le fichier recolle le script, le redéploie et recrée l'onglet).",
    ],
  },
  {
    version: "1.95.2",
    notes: [
      "Armée : une unité pondue pendant le replacement ne fausse plus le nouvel essai quand le jeu ignore un déplacement (il restait 2 unités en dôme au lieu de 1).",
    ],
  },
  {
    version: "1.95.1",
    notes: [
      "Synthèse, terrain chassé à chaque chasse : tous les chasseurs en pointillés, une couleur chacun (toi en vert) ; plus de courbe moyenne, seulement sa tendance (rouge), qui suit les chasseurs affichés ; ta tendance en vert ; les tendances en tirets, différents des pointillés.",
    ],
  },
  {
    version: "1.95.0",
    notes: [
      "Synthèse : sous chacun des 7 chiffres de chasse, l'écart en % avec la moyenne des chasseurs de la période (au-dessus en vert, en dessous en rouge).",
      "Synthèse : à la fin, un tableau par chasseur — terrain, terrain par multi-chasse, pertes, pertes par M cm², nourriture, nourriture par multi-chasse — et leur moyenne.",
      "Synthèse : plus de courbe épaisse ; les chiffres rangés en lignes égales selon la largeur de la boîte.",
      "Google Sheet : le tableau et les écarts demandent le script à jour (la personne qui gère le fichier le recolle et le redéploie).",
    ],
  },
  {
    version: "1.94.0",
    notes: [
      "Synthèse : terrain (colonnes), nourriture et pertes de chaque chasse, chacune son axe ; « Chasse 1 (01/11) »… en abscisse.",
      "Synthèse : ton terrain chassé (vert) face aux autres chasseurs (pointillés, leurs chasses étirées sur les tiennes) et à leur moyenne (rouge), avec les deux tendances ; un clic sur un nom de la légende le cache ou le montre, et la moyenne suit.",
      "Synthèse : nourriture selon le terrain, terrain selon la difficulté par cm² (faune rencontrée), pertes par M cm² dans le temps ; « Comparer aux autres chasseurs » y ajoute leurs points.",
      "Google Sheet : l'onglet « Statistiques » a les mêmes graphiques, une fois le script mis à jour par la personne qui gère le fichier et l'onglet recréé.",
    ],
  },
  {
    version: "1.93.3",
    notes: [
      "Armée : « Replacer l'armée » vérifie chaque déplacement dans la réponse du jeu, qui en ignore parfois un envoyé juste après un autre : la page est relue et ce qui manque est renvoyé (trois fois au plus). Et moins de déplacements : deux au plus par unité.",
    ],
  },
  {
    version: "1.93.2",
    notes: [
      "Armée : « Replacer l'armée » passe par le dôme pour aller de la loge au TdC (le jeu refusait le déplacement direct), et refait une fois un déplacement refusé, d'après la page relue.",
    ],
  },
  {
    version: "1.93.1",
    notes: [
      "Armée : après « Replacer l'armée », quand la réponse du jeu montre encore l'armée d'avant le déplacement, la page est relue avant de conclure (plus de fausse alerte) ; quand un déplacement n'est vraiment pas fait, l'alerte dit ce qui manque (TdC, dôme, unités restées hors de la loge).",
    ],
  },
  {
    version: "1.93.0",
    notes: [
      "Synthèse : pertes par million de cm² chassés (carte et graphique), nourriture par multi-chasse (une chasse seule compte pour une multi-chasse).",
      "Synthèse : l'armée (FdF, défense, vie, capacité de flood) ne compte plus tes pontes : on part de ta première multi-chasse et chaque chasse y applique ses pertes et l'expérience gagnée, lues dans ses RC.",
      "Google Sheet : l'onglet « Statistiques » suit, une fois le script mis à jour par la personne qui gère le fichier.",
    ],
  },
  {
    version: "1.92.0",
    notes: [
      "Synthèse : seulement les chasses — les 11 chiffres demandés (chasses, multi-chasses, terrain, pertes, pertes par cm², nourriture, armée de la première à la dernière multi-chasse), puis les graphiques. Plus d'attaques, de défenses ni de floods internes.",
      "Synthèse : les graphiques suivent tes chasses dans l'ordre (« Chasse 1 », « Chasse 2 »…, une multi-chasse comptant pour une chasse, résultats additionnés), sans écart-type.",
      "Boîtes « Outils pour Chasseur », « Combat » et Préférences : déplace-les par leur titre et change leur taille en tirant un bord ou un coin, comme une fenêtre ; la taille est retenue (sur téléphone, seule la hauteur se règle).",
    ],
  },
  {
    version: "1.91.1",
    notes: [
      "Synthèse : la tendance du terrain chassé ne tient compte que des jours où tu as chassé (un jour sans chasse, ou d'avant tes premiers exports, ne la tire plus vers le bas) et n'est jamais négative.",
      "Google Sheet, onglet « Statistiques » : la 4e ligne de chaque tableau n'est plus masquée (après mise à jour du script, ouvre son adresse une fois).",
    ],
  },
  {
    version: "1.91.0",
    notes: [
      "Synthèse : nombre de multi-chasses (chasses rentrées à moins de 5 minutes l'une de l'autre), pertes par cm² chassé, nourriture par chasse, et ton armée hors bonus (capacité de flood, FdF, défense, vie) de la première à la dernière multi-chasse, avec sa variation en %.",
      "Synthèse : nouveaux graphiques — terrain chassé par jour et sa tendance, pertes par cm² de chaque multi-chasse avec la moyenne et l'écart-type, armée envoyée en multi-chasse (comme la page Statistiques du jeu : unités, vie, dégâts, temps de ponte), nourriture de chaque chasse.",
      "Synthèse : case « Comparer aux autres chasseurs » pour ajouter leurs courbes (une couleur par chasseur) et un tableau comparatif.",
      "Google Sheet : l'onglet « Statistiques » montre les mêmes chiffres et graphiques, une fois le script mis à jour par la personne qui gère le fichier.",
    ],
  },
  {
    version: "1.90.1",
    notes: [
      "Boîtes « Outils pour Chasseur », « Combat » et Préférences : elles restent dans l'écran ; un contenu plus haut défile à l'intérieur de la boîte, et on la déplace par son titre ou par n'importe quel bord.",
      "Synthèse : chiffres clés en tête, puis « Détail », « Évolution » et « Classements » à déplier ou replier (le choix est retenu) ; mise en page plus compacte.",
    ],
  },
  {
    version: "1.90.0",
    notes: [
      "« Outils pour Chasseur » : nouvel onglet « Synthèse ». Choisis une période : tes chasses (terrain, nourriture, pertes par million de cm²), tes attaques et défenses hors alliance, tes floods internes et le terrain gagné, avec leurs graphiques. Les résultats viennent du Google Sheet où tu exportes tes rapports.",
      "Google Sheet : onglet « Statistiques » avec les mêmes résultats pour le joueur et la période choisis (après mise à jour du script par la personne qui gère le fichier).",
    ],
  },
  {
    version: "1.89.0",
    notes: [
      "Forum caché : les chasses, floods et convois passés ne sont plus effacés de tes sujets « Chasses | pseudo », « Floods | pseudo » et « Convois | pseudo ». Ils sont rangés dans « Historique Chasses 1 | pseudo » (de même pour Floods et Convois), puis dans la page 2, 3… quand une page est pleine. Les sujets de suivi ne gardent que ce qui est en cours.",
    ],
  },
  {
    version: "1.88.0",
    notes: [
      "Messagerie : boutons « Exporter mes chasses » et « Exporter mes RC » vers le Google Sheet de l'alliance (joueurs de la liste du sujet « Export Google Sheet » du forum caché ; les autres renseignent leur propre fichier dans Préférences → Messagerie). Les floods entre membres de l'alliance vont dans « Flood internes », une seule ligne quel que soit le camp qui exporte.",
      "Dans « BDD attaques » et « BDD défenses », colonnes « Arme », « Bouclier », « Dôme » et « Loge » de l'ennemi, tirées du RC. Dans sa fourmilière ou sa loge, le RC ne donne que son bonus de vie total : la case indique le niveau possible pour chaque bouclier proche de son arme. Une case reste vide quand le RC ne permet pas de le savoir (flood, armée tuée d'un coup).",
    ],
  },
  {
    version: "1.87.1",
    notes: [
      "La boîte « Journal » n'est plus affichée : elle sert seulement au suivi des problèmes de l'extension.",
    ],
  },
  {
    version: "1.87.0",
    notes: [
      "Nouvelle boîte « Journal » sous « Extension OUAF » : elle garde ce que fait l'extension et ses erreurs. En cas de problème, « Copier » prend tout le texte (versions, page, erreurs) à coller dans un message ; les adresses et les codes y sont masqués. Masquable dans Préférences → Général.",
    ],
  },
  {
    version: "1.86.4",
    notes: [
      "Bouton « CSV » des tableaux : le fichier s'ouvre correctement dans Excel en français (une colonne par donnée, accents corrects).",
    ],
  },
  {
    version: "1.86.3",
    notes: [
      "Tableaux en français : bouton « Copier » (au lieu de « Copy ») et ses messages, « Aucune donnée » quand un tableau est vide (Temps de trajet pendant le calcul). Sur téléphone, la fenêtre « Copie du tableau » tient dans l'écran.",
    ],
  },
  {
    version: "1.86.2",
    notes: [
      "Nombres écrits à la française partout (« 12,5 % » et non « 12.5% ») : analyses de combat et de chasse, lanceur de chasses (ratios, réplique, ratio plancher), sonde et vitesse d'attaque estimée, info-bulle des entrepôts, page Reine, ressources par ouvrière (page Convois), carte de l'alliance.",
    ],
  },
  {
    version: "1.86.1",
    notes: [
      "Convois annulés : si le site de suivi ou le forum échoue en cours de retrait, le nouvel essai reprend là où il s'était arrêté (rien de perdu, rien de retiré deux fois).",
    ],
  },
  {
    version: "1.86.0",
    notes: [
      "Convois, suivi OUAF : un convoi enregistré puis annulé avec le lien « Annuler » du jeu est retiré du suivi au chargement suivant de la page Convois : sa part sur le site de suivi (convoi prévu et avance) et sa ligne du forum. Seulement les siennes : un convoi identique resté en cours garde les siennes.",
      "Un convoi enregistré avant cette version est retiré du forum, mais pas du site de suivi : retire-le à la main sur le site.",
    ],
  },
  {
    version: "1.85.9",
    notes: [
      "Convois : quand le site de suivi OUAF ne répond pas, la page le dit en clair (au lieu de « ? »), l'attente est plus courte et un nouveau clic répond tout de suite. Pendant un envoi, le bouton affiche « ⏳ Envoi au suivi… ».",
    ],
  },
  {
    version: "1.85.8",
    notes: [
      "Convois, suivi OUAF : « ✅ Enregistré » vient seulement de ton sujet « Convois » dans le forum de l'alliance, plus de l'historique du site de suivi. Un convoi envoyé au site mais que le forum n'a pas pu noter affiche « 📝 Noter dans le forum » : ce bouton le note sans le renvoyer au site.",
    ],
  },
  {
    version: "1.85.7",
    notes: [
      "Convois, suivi OUAF : deux clics rapprochés sur « 📤 Envoyer au suivi » partent l'un après l'autre ; le convoi prévu n'est plus compté deux fois. Deux envois identiques faits à moins de 2 minutes d'intervalle sont reconnus tous les deux, même depuis un autre appareil.",
    ],
  },
  {
    version: "1.85.6",
    notes: [
      "Convois, suivi OUAF : deux convois identiques (même joueur, même montant, même arrivée) ne passent plus tous les deux « ✅ Enregistré » quand un seul a été envoyé au suivi ; chaque envoi noté ne compte que pour un convoi. Un convoi marqué à tort avant cette version : retire sa ligne de ton sujet « Convois » du forum pour pouvoir l'envoyer.",
    ],
  },
  {
    version: "1.85.5",
    notes: [
      "Convois : « arrondir… » compte les ouvrières à l'arrondi supérieur ; il n'en manque plus une quand le total ne tombe pas juste.",
      "Préférences → Convois : la case du bloc « Récapitulatif » porte son nom (elle s'appelait encore « Joueur à livrer »).",
    ],
  },
  {
    version: "1.85.4",
    notes: [
      "Chasses et Préférences (correction de Grim) : dans un navigateur en français, les flèches ne multiplient plus le ratio par dix, et une virgule tapée n'est plus effacée. Les champs de nombres s'affichent à la française (« 1 804 000 », « 9,1 ») quelle que soit la langue du navigateur ; virgule ou point acceptés.",
      "Multi-flood : un « Terrain Final » ou une « Prise Max » modifié est relu en entier (« 1 900 000 » était lu 1).",
    ],
  },
  {
    version: "1.85.3",
    notes: [
      "Page d'attaque sur téléphone en mode « site pour ordinateur » : « Lancer + partager » et « Synchroniser » sont de nouveau juste sous le bouton « Attaquer … ! », qui ne bouge pas.",
    ],
  },
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
