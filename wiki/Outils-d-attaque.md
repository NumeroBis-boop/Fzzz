## Outils d'attaque

La boîte **Outils d'Attaque** s'ouvre depuis la troisième icône de la toolbar. C'est l'outil le plus complet de Toolzzz : il regroupe quatre onglets couvrant l'analyse de rapport, la simulation de combat, la préparation d'attaques multiples et le calcul de temps de trajet.

## Onglet _Analyser_

> ![Onglet Analyser](assets/wiki/outils-d-attaque-analyser.png)

Colle un **rapport de combat** ou un **rapport de sonde** dans le champ texte. Toolzzz extrait :

- Le résultat (victoire / défaite / égalité)
- Les **pertes** côté attaquant et défenseur
- Les **survivants** envoyés en retour
- Un **bilan multi-combat** cumulé si tu colles plusieurs rapports d'affilée

### Cas spécial : le rapport de sonde

Quand tu colles un rapport de sonde (et pas un RC complet), un panneau supplémentaire **Analyse de la sonde** apparaît sous le tableau. Il calcule le multiplicateur de vie effectif du défenseur (combinaison du lieu et du bouclier ennemi) et la **FdF nécessaire** pour one-shot la cible en encaissant la réplique 10%.

Le panneau te propose un formulaire interactif où tu saisis ton armée d'attaque envisagée, et il te dit :

- Combien d'unités il manque pour atteindre la FdF cible
- Si ta JSN (réplique) tient le coup contre la défense ennemie

> Calculs basés sur le tableur [XP v1.04](http://alliancead2.free.fr/Outils/Repository/XP%20v1.04.xls) de Calystène (zone B26-K54 de la feuille _Auto sur sonde_). C'est la référence de la communauté pour les calculs anti-sonde — Toolzzz reprend exactement la même logique.

> ![Calcul d'attaque à lancer sur sonde](assets/wiki/outils-d-attaque-sonde.png)

## Onglet _Simuler_

> ![Onglet Simuler](assets/wiki/outils-d-attaque-simuler.png)

Calcule les **dégâts théoriques** d'un combat sans avoir à l'envoyer. Tu saisis :

- Ton armée d'**attaquant** (par unité)
- L'armée du **défenseur**
- Tes niveaux de **recherche** (Bouclier, Armes, etc.) et ceux du défenseur

Toolzzz applique les formules du jeu (mêmes que celles utilisées par le serveur) et te donne un aperçu de l'issue probable. Utile pour évaluer un raid avant de mobiliser tes troupes.

## Onglet _Multi-flood_

> ![Onglet Multi-flood](assets/wiki/outils-d-attaque-multi-flood.png)

Le générateur d'**attaques groupées sur plusieurs cibles**. Tu saisis une liste de pseudos cibles et le nombre d'attaques que tu veux envoyer sur chacun, et Toolzzz prépare le plan complet : ordre d'envoi, délais, choix de méthode.

Quatre **méthodes de flood** sont disponibles (configurable par défaut dans _Paramètres → Général_) :

- **Standard** — délais réguliers entre chaque attaque
- **Optimisée** — concentre les attaques pour un débordement rapide
- **Uniforme** — étale uniformément sur la fenêtre de temps
- **Dégressive** — démarre serré puis espace progressivement

## Onglet _Temps de trajet_

> ![Onglet Temps de trajet](assets/wiki/outils-d-attaque-temps-de-trajet.png)

Calculatrice de trajets et d'horaires. Tu saisis un **Joueur 1** (le joueur qui lance, identifié par son pseudo), sa **vitesse d'attaque**, et une liste de **cibles** séparées par des virgules. Toolzzz récupère les profils via le jeu et calcule, pour chaque cible, le terrain et le temps de trajet `Joueur 1 → cible`.

Astuce : la **flèche** au-dessus de _Joueur 1_ auto-remplit le champ avec ton pseudo et ta va, pratique quand c'est toi qui lances. Re-cliquer vide les champs.

### Intercepter un ennemi à son retour en loge

Le scénario : un ennemi enchaîne des raids chez ton alliance et tu veux le toucher pendant sa courte fenêtre en loge entre deux attaques. Pour ça, mets l'**ennemi** en Joueur 1 (pas toi), puis remplis :

- **Dernier mouvement** = l'heure à laquelle il a touché un membre de ton alliance pour la dernière fois — vu qu'il relance dans la foulée, c'est aussi à peu près son heure de redépart.
- **Délai capture (min)** = combien de temps après son retour en loge tu veux arriver pour le toucher (défaut 1 min).

Le tableau ajoute alors deux infos par cible potentielle qu'il pourrait attaquer ensuite :

- **Retour le** = heure à laquelle l'ennemi rentre en loge s'il attaque cette cible (`Dernier mouvement + temps de trajet ennemi → cible`).
- **Lancer à** = heure à laquelle **tu** dois lancer depuis ta loge pour arriver `Délai` minutes après son retour. La ligne est colorée **vert** si c'est encore jouable, **rouge** si l'heure de lancement est déjà passée.

> ![Colonnes Retour le et Lancer à](assets/wiki/outils-d-attaque-temps-de-trajet-interception.png)

**Subtilités à connaître** :

- Si "Dernier mouvement" est vide, **Retour le** et **Lancer à** restent vides (rien à calculer).
- Si "Joueur 1" = ton pseudo, **Lancer à** reste vide : viser soi-même n'a pas de sens. Pour intercepter, mets bien le pseudo de l'**ennemi** en Joueur 1 (n'utilise pas la flèche d'auto-remplissage).

### Bloc _Estimer la vitesse d'attaque_

> ![Estimateur de vitesse d'attaque](assets/wiki/outils-d-attaque-estimateur-va.png)

L'interception a besoin de la va de l'ennemi pour calculer juste. Si tu ne la connais pas, ce bloc l'estime à partir de **deux attaques consécutives** qu'il a effectuées sur deux membres différents de ton alliance. Saisis :

- **Ennemi** : son pseudo.
- **1ère cible touchée** + son **heure de touche**.
- **2ème cible touchée** + son **heure de touche**.
- **Temps en loge (s)** : optionnel, à remplir uniquement si tu sais qu'il a attendu un peu entre les deux raids (défaut 0s = relance instantanée).

Le bloc affiche la va estimée (valeur précise + arrondi). Le bouton **"Utiliser cette va"** copie la valeur arrondie dans le champ _Vitesse d'attaque_ du calculateur du dessus, et préremplit _Joueur 1_ avec le pseudo de l'ennemi si ce champ est vide — tu enchaînes directement sur le calcul de capture.

> Hypothèse : entre les deux touches, l'ennemi a fait `cible1 → loge → cible2` sans pause. Si Toolzzz affiche "données incohérentes", c'est que les heures et les distances ne se combinent pas en une va valide (vérifie les pseudos et les horaires).

## Lien avec les autres pages

Une grande partie de cette logique est aussi exposée **directement dans le jeu** :

- Sur la page **Attaquer** d'un ennemi, le formulaire de flood et les stats d'armée live sont injectés à côté du formulaire natif. Voir [Enrichissements de pages](Enrichissements-de-pages#ennemiephp-page-attaquer).
- Sur la **Messagerie**, les RC sont parsés au clic.
- Sur le **profil** d'un joueur, le temps de trajet vers cette cible est affiché en permanence.

La boîte d'attaque reste utile pour les analyses libres, les simulations exploratoires, et les multi-floods.
