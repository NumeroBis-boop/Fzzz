## Overlay Compte+

Si tu joues **sans Compte+**, Fourmizzz n'affiche pas le panneau de gauche qui montre l'état de tes pontes, constructions, recherches, attaques et convois en cours. Toolzzz comble ce manque avec un **panneau de remplacement** qui reproduit ce que les Comptes+ voient nativement, et y ajoute quelques tooltips utiles.

> Si tu as déjà un Compte+, ce panneau n'est **pas affiché** : Toolzzz détecte la présence du panneau natif et ne le double pas. Le reste de l'extension fonctionne identiquement quel que soit ton statut C+.

> ![Panneau Compte+ Toolzzz](assets/wiki/overlay-compte-plus.png)

## Bandeau de navigation

En haut du panneau, le **bandeau titre** (`▼ Toolzzz X.x.x ▼`) sert aussi de bouton de bascule vers la vue [Radar](Boite-Radar). Clique dessus pour passer de la vue Compte+ à la vue Radar et inversement — le choix est mémorisé entre les sessions.

> ![Bandeau de navigation du panneau](assets/wiki/overlay-compte-plus-navigation-titre.png)

## Les 6 barres

Le panneau affiche en permanence l'état de tes 6 activités principales. Chaque barre se met à jour en temps réel (la progress bar tourne, le temps restant décrémente).

### Ponte

> ![Barre Ponte](assets/wiki/overlay-compte-plus-ponte.png)

- Unité actuellement en ponte
- Nombre d'unités restantes
- Progress bar du pond en cours
- Temps restant
- **Tooltip multi-pontes** au survol : si tu as enchaîné plusieurs pondes, le tooltip détaille la liste complète et les durées de chacune.

### Construction

> ![Barre Construction](assets/wiki/overlay-compte-plus-construction.png)

- Bâtiment en cours de construction
- Progress bar
- Temps restant
- Tooltip avec détails (niveau cible, ressources investies)

### Recherche

> ![Barre Recherche](assets/wiki/overlay-compte-plus-recherche.png)

- Technologie en cours de recherche
- Progress bar
- Temps restant
- Tooltip avec détails

### Chasse

> ![Barre Chasse](assets/wiki/overlay-compte-plus-chasse.png)

- Terrain de chasse conquis (si chasse en cours)
- Retour dynamique : le timer du retour démarre dès que la chasse est terminée
- **Tooltip multi-chasses** : liste de toutes les chasses en cours / en retour, par terrain.

### Attaque

> ![Barre Attaque](assets/wiki/overlay-compte-plus-attaque.png)

- Cible en cours
- Retour
- **Tooltip multi-attaques** au survol : si tu as plusieurs attaques en cours (flood), le tooltip liste chaque attaque avec sa cible et sa date de retour.

> ![Tooltip multi-attaques](assets/wiki/overlay-compte-plus-attaque-tooltip.png)

### Convoi

> ![Barre Convoi](assets/wiki/overlay-compte-plus-convoi.png)

- **Sens** : envoi ou réception
- Cible (joueur source ou destinataire)
- Quantités (nourriture, matériaux)
- Retour (pour les envois)
- **Tooltip multi-convois** : tableau complet de tous les convois en cours, avec leurs cibles, contenus et ETAs.

Toutes ces données viennent du `localStorage` que Toolzzz alimente quand tu interagis avec les pages concernées (Reine, Construction, Laboratoire, Ressources, Attaquer, Commerce). Le panneau lui-même se contente de les afficher de manière lisible.

## Recherche joueur / alliance

> ![Champ de recherche joueur / alliance](assets/wiki/overlay-compte-plus-joueur-alliance.png)

Sous les barres, un **champ de recherche avec autocomplete** te permet de chercher un joueur ou une alliance par pseudo / tag et d'aller directement sur sa page. C'est une convenience qui évite de passer par le menu Communauté → Membres.

## Menu rapide

> ![Menu rapide dans le panneau](assets/wiki/menu-rapide-overlay-compte-plus.png)

Tout en bas du panneau, le **menu rapide** est une grille de raccourcis vers les pages courantes du jeu, regroupés en trois sections : **Fourmilière**, **Alliance**, **Communauté**.

Les raccourcis affichés sont **personnalisables** : pour activer / désactiver chaque lien, va sur la page **Mon compte** du jeu (`compte.php`). Toolzzz y injecte un formulaire _Menu rapide_ avec une case à cocher par raccourci, organisée selon les mêmes trois sections. Ta sélection est sauvegardée en `localStorage` et le panneau Compte+ se met à jour automatiquement.

> ![Formulaire de personnalisation du menu rapide](assets/wiki/menu-rapide.png)
