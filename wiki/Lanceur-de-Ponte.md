## Lanceur de Ponte

Le **Lanceur de Ponte** s'ouvre depuis la première icône de la toolbar. C'est une boîte flottante qui te donne un tableau de saisie pour toutes les unités du jeu, de l'Ouvrière à la Tueuse d'élite, en passant par les Soldates, Sondes, Maîtresses et leurs versions élite.

> ![Lanceur de Ponte](assets/wiki/lanceur-de-ponte.png)

## Ce que la boîte permet

- Saisir un **nombre d'unités** ou un **temps cible** (jours, heures, minutes, secondes), Toolzzz calcule l'autre automatiquement.
- Visualiser la **durée unitaire** par espèce, déjà ajustée selon ton niveau de Temps de Ponte (TDP) : `temps_de_base × 0,9 ^ TDP`.
- Lancer une ponte **directement depuis la boîte** sans passer par la page Reine, à condition que tes niveaux de construction et de recherche autorisent l'unité.

Les unités que tu n'as pas encore débloquées (niveau de Salle de ponte / Cocon de combat / recherche associée insuffisant) sont affichées dans le tableau mais sans bouton de lancement.

## Saisir un objectif

Deux façons de remplir une ligne :

- **Par nombre** — tape le nombre d'unités voulu dans la colonne _Nombre_. Les colonnes _Jour / Heure / Minute / Seconde_ se mettent à jour automatiquement avec le temps total que prendra la ponte.
- **Par temps** — tape une durée dans une ou plusieurs des colonnes _Jour / Heure / Minute / Seconde_. La colonne _Nombre_ affiche alors combien d'unités tu peux pondre dans ce délai.

La synchronisation est bidirectionnelle : tu peux ajuster en allers-retours sans réinitialiser. Si tu saisis un nombre supérieur à la limite que ta fourmilière peut produire en une fois (limite serveur Fourmizzz), Toolzzz le borne automatiquement.

## Destination

Au-dessus du slider TDP, trois radios choisissent où la ponte est livrée : **Terrain**, **Fourmilière** (par défaut) ou **Loge**. Le choix est lu au moment du lancement et reproduit le sélecteur natif de la page Reine.

## Le slider TDP

Le champ **Temps de ponte** en bas de la boîte est pré-rempli avec ton niveau actuel de TDP. Tu peux le modifier pour **simuler** une autre situation : par exemple, voir combien de temps prendrait la même ponte si tu montais de 5 niveaux de TDP, ou inversement combien d'unités en plus tu pourrais pondre dans le même créneau.

Modifier cette valeur recalcule toutes les lignes du tableau, mais ne change évidemment pas ton vrai niveau dans le jeu.

## Lancer une ponte

Quand tu cliques sur l'icône fourmi à droite d'une ligne, Toolzzz envoie la requête de ponte au serveur Fourmizzz exactement comme la page Reine native le ferait. Tu peux enchaîner plusieurs pontes depuis la même boîte sans rouvrir Reine.
