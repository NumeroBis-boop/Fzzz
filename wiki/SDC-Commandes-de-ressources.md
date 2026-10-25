## SDC — Commandes de ressources

Le **SDC** (Système de Commandement) permet à une alliance d'organiser ses **commandes de ressources** : un membre demande de la nourriture ou des matériaux pour financer une évolution, un chef valide, et les autres membres livrent — le tout directement dans le jeu, sans tableur externe ni Discord.

Toute la donnée est stockée dans une **section cachée du forum d'alliance** (`Toolzzz_Commande`) : chaque commande est un sujet du forum, chaque livraison un message dedans. Rien ne sort du jeu — Toolzzz ne transmet aucune donnée à un serveur externe, et les droits d'accès sont ceux du forum de ton alliance.

Le SDC a un second volet, l'annuaire partagé des membres — voir [SDC — Infos membres](SDC-Infos-membres).

## Mise en place (une fois par alliance)

C'est le **chef d'alliance** qui initialise le SDC :

1. Va sur le **forum d'alliance**.
2. Clique sur l'icône Toolzzz en haut des catégories, puis **Préparer le forum pour un SDC**.
3. Les sections cachées `Toolzzz_Commande` et `Toolzzz_Membre` sont créées et protégées automatiquement.

> ![Préparer le forum pour un SDC](assets/wiki/sdc-preparer-forum.png)

Ensuite, **chaque membre** doit simplement **visiter le forum une fois** : Toolzzz détecte la section et se configure tout seul (voir [Boîte Paramètres → Utilitaire](Boite-Parametres#onglet-utilitaire) si l'auto-détection échoue). À partir de là, les outils SDC apparaissent sur la page **Commerce** (celle d'envoi des convois).

## Passer une commande

Sur la page Commerce, un tableau **Commandes** apparaît. Le bouton **Commander** (dans la barre de boutons du tableau) ouvre le formulaire :

- **Évolution** : la construction ou recherche visée — les quantités de nourriture et matériaux se pré-remplissent automatiquement selon son coût.
- **Pour le** : la date à laquelle tu souhaites être livré.
- **À partir du** (optionnel) : pour ne pas être livré avant une certaine date (par exemple si tu n'as pas encore la place).

> ![Le bouton Commander sur la page Commerce](assets/wiki/sdc-bouton-commander.png)

> ![Formulaire de commande](assets/wiki/sdc-boite-commande.png)

Ta commande est créée à l'état **Nouvelle** : tant qu'un chef ne l'a pas validée, **tu es le seul à la voir** dans le tableau. Tu peux la modifier ou la supprimer à tout moment via les icônes en bout de ligne (uniquement tes propres commandes).

## Valider les commandes (chefs)

Les commandes suivent une **file d'attente** gérée par les chefs, avec ces états : `Nouvelle` → `En attente` → `En cours` → `Terminée` (ou `Annulée` / `Supprimée`).

Pour valider : sur le forum, ouvre la section `Toolzzz_Commande` — Toolzzz y ajoute un sélecteur d'état. Coche les commandes, choisis le nouvel état, clique **Modifier l'état**.

<!-- TODO screenshot : sélecteur d'état des commandes dans la section Toolzzz_Commande
> ![Changer l'état des commandes sur le forum](assets/wiki/sdc-changer-etat.png)
-->

Le principe de la file : les livreurs se concentrent sur la commande **En cours**, les **En attente** patientent derrière. Quand la commande En cours est intégralement livrée, **la plus ancienne En attente passe automatiquement En cours** — la file avance toute seule, pas besoin de repasser par un chef.

## Livrer une commande

Sur la page Commerce, chaque membre voit les commandes validées avec :

- le **demandeur** (cliquable), les **quantités restantes** à livrer, la date souhaitée ;
- un **feu de priorité** : vert (dans les temps), orange (échéance à moins de 3 jours), rouge (en retard) — ou une croix si la date « à partir du » n'est pas encore atteinte ;
- **ton temps de trajet** jusqu'au demandeur.

<!-- TODO screenshot : tableau Commandes côté livreur (feux de priorité, temps de trajet, icône livrer)
> ![Tableau des commandes côté livreur](assets/wiki/sdc-tableau-commandes.png)
-->

L'icône **livrer** (visible sur les commandes En cours) **pré-remplit le formulaire de convoi** : pseudo du demandeur, matériaux d'abord, puis nourriture, dans la limite de ta charge maximale (calculée selon tes ouvrières disponibles et ton niveau d'Étable). Ajuste si besoin, puis envoie le convoi normalement.

À l'envoi, Toolzzz met tout à jour automatiquement : les quantités restantes sont décomptées, la livraison est journalisée dans le sujet forum de la commande, et la commande passe **Terminée** quand tout est livré.

## Suivre sa commande

Le demandeur voit sur sa page Commerce les **convois en route** vers lui pour ses commandes En cours (et jusqu'à un jour après la fin pour les Terminées), avec leur date d'arrivée.

<!-- TODO screenshot : convois en route affichés côté demandeur
> ![Convois en route vers le demandeur](assets/wiki/sdc-convois-en-route.png)
-->

## Bon à savoir

- La configuration (l'ID de la section forum) est **locale à chaque joueur et chaque navigateur** — chaque membre doit passer une fois sur le forum pour activer le SDC chez lui.
- Il faut avoir **accès en lecture** à la section `Toolzzz_Commande` : si le chef l'a protégée à un rang que tu n'as pas, le SDC restera invisible pour toi.
- Les alliances qui utilisaient Outiiil à l'époque conservent leurs anciennes sections `Outiiil_Commande` / `Outiiil_Membre` : Toolzzz les reconnaît, inutile de les recréer.
