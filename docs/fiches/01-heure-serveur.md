# Fiche 01 : heure serveur et heures d'arrivée

Statut : **à valider par le joueur**

## Besoin

- Afficher l'heure du serveur à la seconde, sur toutes les pages du jeu.
- Afficher l'heure d'arrivée des attaques en heure serveur, à la seconde.

## Méthode

Le script d'arrière-plan écoute (`webRequest`, sans blocage) les pages `*.fourmizzz.fr` que le joueur charge. Pour chacune, il note :

- l'heure locale au départ de la requête ;
- l'heure locale à la réception des en-têtes ;
- l'en-tête `Date` du serveur.

`core/horloge.ts` en déduit un intervalle pour le décalage serveur − local. Il croise ensuite les intervalles de toutes les pages chargées. La précision attendue est de ±0,5 s ou mieux après quelques pages ; elle est affichée.

**Aucune requête supplémentaire.** Interroger le serveur à intervalle régulier prolongerait la session, ce que la règle C2 interdit.

## Heures d'arrivée

Arrivée = heure serveur au moment de l'affichage + durée restante lue sur la page. Si la page donne une heure absolue, on l'affiche telle quelle.

## Hypothèse à tester en jeu (bloquante pour l'affichage)

Toolzzz affiche deux heures : l'arrivée à la seconde, et l'heure du RC arrondie à la minute suivante. Si les combats sont résolus à la minute pleine, la seconde d'arrivée ne sert qu'à **ordonner** les attaques d'une même minute.

**Test** : lancer deux sondes sur la même cible à environ 20 s d'écart dans la même minute, puis noter les heures exactes affichées pour l'arrivée et pour les deux RC.

## Données dont j'ai besoin

Ce conteneur ne peut pas accéder à `s5.fourmizzz.fr`. Il me faut :

- le HTML des pages Armée et Attaquer avec une attaque en cours (Ctrl+S, « page web, HTML uniquement ») ;
- le résultat du test des deux sondes.
