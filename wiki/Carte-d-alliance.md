## Carte d'alliance

Toolzzz injecte une **carte interactive** dans le menu d'alliance pour visualiser les positions de tous tes membres en un seul écran.

> ![Carte d'alliance](assets/wiki/carte-d-alliance.png)

## Comment l'ouvrir

Quand tu as une alliance, Toolzzz ajoute un onglet **Carte** dans le menu d'alliance (à côté de Forum, Membres, Diplomatie, etc.). Clique dessus pour ouvrir la carte.

> ![Onglet Carte dans le menu d'alliance](assets/wiki/carte-d-alliance-menu.png)

Tu peux aussi y accéder via le hash `#carte` dans l'URL de la page Membres : Toolzzz détecte le hash au chargement et déplie automatiquement le widget Carte. Pratique pour partager un lien direct dans le chat d'alliance.

## Charger / actualiser les données

Si ton alliance utilise le [SDC](SDC-Infos-membres), la carte se remplit toute seule à l'ouverture de la page Membres, avec les coordonnées partagées dans les fiches des membres : aucun profil à charger.

Sinon, au premier ouvrage, la carte est vide — clique sur **Charger / Actualiser** pour récupérer les positions et stats de tous les membres. Cette opération prend quelques secondes (Toolzzz doit visiter le profil de chaque membre pour récupérer ses coordonnées et ses ressources).

Les données sont **mises en cache localement** : la prochaine fois que tu ouvres la carte, elle s'affiche instantanément depuis le cache. Re-clique sur Actualiser quand tu veux remettre à jour (par exemple après l'arrivée de nouveaux membres ou un déménagement).

Quand les deux existent, les positions chargées depuis les profils passent devant celles du SDC (elles sont plus récentes), et le SDC complète les membres qui manquent. La ligne d'état sous les boutons indique combien de positions viennent du SDC.

## Interaction

La carte est interactive (basée sur Highcharts) :

- **Survol** d'un point membre — affiche un tooltip avec son pseudo, ses coordonnées et le **temps de trajet** depuis ta fourmilière (calculé pour chaque type d'unité).
- **Drag** pour zoomer sur une zone — sélectionne un rectangle pour zoomer dessus.
- **Clic** sur un point — zoom 4× centré sur ce point. Très utile dans les clusters denses où plusieurs membres sont voisins.
- **Bouton Reset zoom** (apparaît après le premier zoom) — revient à la vue d'ensemble.

## Filtrer ce qui s'affiche

Sous les boutons, un bloc de filtres permet de choisir qui apparaît sur la carte. Chaque section est repliée par défaut, clique sur _Afficher la liste_ pour la déplier. Le titre d'une section indique combien d'entrées y sont masquées, pour qu'un filtre actif reste visible même section fermée.

- **Grades affichés** — une case par grade de l'alliance, avec le nombre de membres concernés. Décoche un grade pour retirer tous ses membres de la carte. Pratique pour ne garder que les passeurs, ou pour sortir les VIP d'une carte qui sert à préparer une attaque. Les grades les plus portés sont en tête de liste. Un grade long est raccourci pour garder les cases alignées, son libellé complet reste visible au survol. Si chaque membre a un grade différent, Toolzzz te renvoie vers la liste des joueurs, plus adaptée.
- **Rangs SDC affichés** — même principe, sur les rangs saisis dans le [SDC](SDC-Infos-membres). Cette section n'apparaît que si ton alliance en utilise. Un membre sans rang saisi n'est jamais masqué par ce filtre.
- **Joueurs** — la liste complète des membres, pour cocher ou décocher un joueur en particulier. Les liens _Tout cocher_ et _Tout décocher_ font le tri en un clic.

Le titre de la carte rappelle combien de membres sont affichés sur l'effectif total, et l'export pour le forum reprend exactement la même sélection.

Ta sélection est **mémorisée par alliance et par serveur** : tu la retrouves telle quelle à la prochaine ouverture de la carte. Toolzzz mémorise ce qui est masqué, donc un membre qui rejoint l'alliance plus tard apparaît sur la carte au lieu d'être oublié en silence.

## Chaîne entre plus proches voisins

Sous la carte, la section **Chaîne entre plus proches voisins** calcule l'ordre de passage qui relie les membres affichés avec le moins de temps de trajet possible : chacun envoie au suivant, du premier au dernier, sans revenir au départ. Seuls les membres affichés comptent : décocher un joueur, un grade ou un rang dans les filtres le retire de la chaîne, qui se recalcule aussitôt.

- **Départ** — par défaut _Le plus court (départ libre)_ : Toolzzz essaie chaque membre comme départ et garde la chaîne la plus courte, présentée du bas vers le haut de la carte. Tu peux aussi imposer le premier joueur.
- **Ordre** — _Le plus court_ calcule la chaîne. _SDC (rang puis priorité)_ suit plutôt les rangs et priorités saisis par les chefs dans le [SDC](SDC-Infos-membres) : rangs par ordre alphabétique, puis priorités décroissantes (la priorité 1 est le bout de la chaîne), et les membres sans priorité (chasseurs…) à la fin. Pratique pour vérifier qu'une chaîne prévue colle aux positions, et comparer son temps cumulé à celui de la chaîne calculée. Cette option n'est disponible que si des rangs ont été saisis.
- **Tracer sur la carte** — relie les membres dans l'ordre de la chaîne et numérote les points. Les liens habituels entre voisins sont masqués tant que la chaîne est tracée.
- **Tableau** — pour chaque étape, le joueur (avec son rang SDC et sa priorité s'il en a), sa position, à qui il envoie et le temps de trajet, avec le temps cumulé et la plus longue étape.
- **Copier pour le forum** — copie la chaîne, une étape par ligne.
- **Numéroter dans le SDC** (chefs uniquement) — écrit la place de chacun dans la chaîne affichée comme priorité de sa fiche SDC, rang par rang en partant de la fin : le dernier passeur de la chaîne devient Passeur 1, celui d'avant Passeur 2, etc. Par exemple, ne coche que les passeurs, laisse _Le plus court_, puis numérote. Le rang n'est pas modifié, les membres sans rang SDC sont ignorés, et une confirmation liste les fiches qui vont changer avant d'écrire quoi que ce soit.

Les temps sont ceux du jeu **sans amélioration de Vitesse d'attaque**, puisque chaque membre envoie avec son propre niveau. L'ordre, le départ et le tracé sont mémorisés par alliance et par serveur.

## Exporter pour le forum

Le bouton **Exporter pour le forum** génère un PNG de la carte zoomée comme tu la vois actuellement, prêt à être partagé sur le forum d'alliance ou un Discord. C'est une capture simple, sans interactivité — pour discuter de stratégie collective sans demander à chaque membre de venir voir la carte sur son écran.

## Cache et confidentialité

Le cache de la carte est stocké dans le `localStorage` de ton navigateur, par couple `(serveur, alliance)`. Si tu changes d'alliance, l'ancien cache reste mais n'est plus affiché.

**Aucune donnée n'est envoyée à un serveur externe.** Toutes les positions et stats viennent des pages Fourmizzz que tu visites toi-même via l'extension, et restent sur ta machine.
