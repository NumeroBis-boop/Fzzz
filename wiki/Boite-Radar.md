## Boîte Radar

Le **Radar** te permet de garder une liste de joueurs et d'alliances qui t'intéressent : un ennemi historique, un voisin de coordonnées, une alliance rivale… Toolzzz garde leurs coordonnées localement et te donne un tooltip de trajet au survol depuis le panneau.

> ![Radar](assets/wiki/boite-radar.png)

## Ouvrir le Radar

Le Radar n'a pas d'icône dédiée dans la toolbar : il vit **à l'intérieur du panneau de gauche Toolzzz** (l'[Overlay Compte+](Overlay-Compte-Plus)), côté à côté des barres ponte / construction / recherche / chasse / attaque / convoi.

Pour basculer entre la vue Compte+ et la vue Radar, **clique sur le titre du panneau** (▼ Toolzzz X.x.x ▼). Le choix est mémorisé entre les sessions.

> ![Bandeau-titre du panneau](assets/wiki/overlay-compte-plus-navigation-titre.png)

Tant que tu n'as ajouté aucun joueur ou alliance au Radar, le panneau reste sur la vue Compte+ par défaut.

## Ajouter quelqu'un au radar

Deux manières d'ajouter une cible :

- **Depuis le profil d'un joueur** (page Membre) : un bouton **Surveiller ce joueur** apparaît à côté de son pseudo. Clique pour ajouter / retirer du radar (toggle).

  > ![Bouton Surveiller ce joueur](assets/wiki/boite-radar-surveiller-joueur.png)

- **Depuis la fiche d'une alliance** (`classementAlliance.php`) : pareillement, un bouton **Surveiller** est injecté pour suivre l'alliance entière.

  > ![Bouton Surveiller sur la fiche d'alliance](assets/wiki/boite-radar-surveiller-alliance.png)

Ajouter une alliance ne suit pas individuellement chacun de ses membres — elle marque l'alliance comme entité, et toute interaction (attaque entrante, message…) provenant d'un joueur de cette alliance est mise en valeur.

## Organisation

Les joueurs et alliances ajoutés peuvent être réordonnés par glisser-déposer dans la liste du panneau Radar. Cela te permet de prioriser visuellement certains ennemis ou alliés à surveiller de près.

## Au survol d'un joueur

Au survol d'un joueur dans la liste du Radar, un tooltip affiche le **temps de trajet** depuis ta fourmilière vers sa position et la **date de retour** d'un éventuel aller-retour. Pratique pour estimer rapidement si une cible est à portée sans avoir à ouvrir son profil.

> ![Tooltip de trajet au survol](assets/wiki/boite-radar-tooltip-distance.png)

## Persistance

Les listes de joueurs et d'alliances surveillés sont stockées dans le `localStorage` de ton navigateur, par serveur Fourmizzz. Elles restent disponibles entre tes sessions, et survivent aux mises à jour de l'extension.

Si tu changes de navigateur ou nettoies tes données de site, la liste sera réinitialisée — Toolzzz n'a pas de synchronisation cloud (tout reste local par design).

## Retirer quelqu'un

Joueur :

- Cliquer sur le bouton **Supprimer la surveillance** depuis le profil (toggle off)

  > ![Bouton Supprimer la surveillance](assets/wiki/boite-radar-supprimer-surveillance.png)

Alliance :

- Cliquer sur le bouton **Ignorer** depuis la fiche de l'alliance (toggle off)

  > ![Bouton Ignorer sur la fiche d'alliance](assets/wiki/boite-radar-ignorer.png)
