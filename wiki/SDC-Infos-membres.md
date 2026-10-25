## SDC — Infos membres

En plus des [commandes de ressources](SDC-Commandes-de-ressources), le SDC gère un **annuaire partagé des membres de l'alliance** : coordonnées de chaque fourmilière et rangs personnalisés. C'est ce qui alimente les colonnes **Grade / Tdt / Retour** du tableau des membres, la [Carte d'alliance](Carte-d-alliance) (remplie sans charger les profils), et quelques autres enrichissements.

Comme pour les commandes, tout est stocké dans une **section cachée du forum d'alliance** (`Toolzzz_Membre`) : chaque membre a sa **fiche**, un sujet du forum dont le titre contient son pseudo, son identifiant, ses coordonnées, et éventuellement son rang. Rien ne sort du jeu.

## Mise en place

La section `Toolzzz_Membre` est créée en même temps que `Toolzzz_Commande` par le bouton **Préparer le forum pour un SDC** (voir [SDC — Commandes de ressources](SDC-Commandes-de-ressources#mise-en-place-une-fois-par-alliance)) :

> ![Préparer le forum pour un SDC](assets/wiki/sdc-preparer-forum.png)

Ensuite, un **chef** doit remplir l'annuaire : sur la page **Membres** de l'alliance, un bouton **Actualiser l'alliance** apparaît dans la barre de boutons du tableau. Il récupère le profil de chaque membre qui n'a pas encore de fiche (pour obtenir ses coordonnées), et crée les fiches manquantes — grade du jeu inclus.

<!-- TODO screenshot : bouton « Actualiser l'alliance » sur le tableau des membres (vue chef)
> ![Bouton Actualiser l'alliance](assets/wiki/sdc-actualiser-alliance.png)
-->

À refaire de temps en temps : à chaque nouvelle recrue, un coup d'**Actualiser l'alliance** crée sa fiche. Il repère aussi les fiches des joueurs qui ont quitté l'alliance et propose de les supprimer du forum, après confirmation.

## Les colonnes ajoutées au tableau des membres

Une fois l'annuaire en place, chaque membre (qui a visité le forum une fois pour l'auto-configuration) voit trois colonnes en plus sur la page Membres :

- **Grade** : le rang du membre — le rang personnalisé SDC s'il a été attribué, sinon le grade natif du jeu.
- **Tdt** : **ton** temps de trajet jusqu'à ce membre, calculé depuis les coordonnées partagées.
- **Retour** : la date et l'heure d'arrivée correspondantes, arrondies à la minute — pratique à copier dans un rapport ou un message.

<!-- TODO screenshot : tableau des membres avec les colonnes Grade / Tdt / Retour
> ![Colonnes Grade, Tdt et Retour](assets/wiki/sdc-colonnes-membres.png)
-->

## Attribuer des rangs personnalisés (chefs)

Les chefs voient une petite icône en début de chaque ligne du tableau : elle ouvre la boîte **Attribuer un rang**, avec deux champs :

- **Rang** : le libellé affiché dans la colonne Grade (remplace le grade natif du jeu pour ce membre).
- **Priorité dans la chaîne** : la place du membre dans la chaîne de son rang, 1 étant le bout de la chaîne (Passeur 1 est le dernier passeur). Elle s'affiche après le rang dans la colonne Grade, et sert à l'ordre SDC de la [chaîne sous la carte](Carte-d-alliance#chaîne-entre-plus-proches-voisins). Laisse 0 pour les membres hors chaîne, comme les chasseurs : rien ne s'affiche.

<!-- TODO screenshot : boîte « Attribuer un rang »
> ![Boîte Attribuer un rang](assets/wiki/sdc-attribuer-rang.png)
-->

## Ailleurs dans l'extension

L'annuaire sert aussi à d'autres fonctionnalités :

- **Messagerie** : les messages de type _Vol par…_ / _Invasion de…_ sont colorés en **vert** si l'autre joueur est un allié de l'annuaire, en **rouge** sinon.

## Bon à savoir

- **Sans SDC**, tu peux quand même avoir les colonnes Tdt / Retour : le bouton **Synchroniser** du tableau des membres (lié à la [Carte d'alliance](Carte-d-alliance)) récupère les coordonnées et les met en cache localement — mais elles ne sont alors ni partagées ni assorties des rangs.
- **Si un membre déménage**, sa fiche n'est pas mise à jour automatiquement (Actualiser l'alliance crée les fiches manquantes et supprime celles des anciens membres, mais ne touche pas aux autres). Un chef peut corriger les coordonnées en éditant directement le titre de son sujet dans la section `Toolzzz_Membre` du forum.
- Comme pour les commandes, la configuration est **locale à chaque joueur** (un passage sur le forum suffit) et il faut avoir **accès en lecture** à la section — voir [Boîte Paramètres → Utilitaire](Boite-Parametres#onglet-utilitaire).
- Les anciennes sections `Outiiil_Membre` sont reconnues, inutile de les recréer.
