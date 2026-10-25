## La toolbar

La toolbar (parfois appelée _dock_) est le point d'entrée principal de Toolzzz. C'est une petite barre flottante qui te donne accès à tous les outils de l'extension, peu importe la page Fourmizzz sur laquelle tu te trouves.

> ![Toolbar Toolzzz](assets/wiki/la-toolbar-horizontal.png)

## Les 4 icônes

| Icône        | Outil          | Détail                                                                                           |
| ------------ | -------------- | ------------------------------------------------------------------------------------------------ |
| Fourmi (œuf) | **Ponte**      | Ouvre le [Lanceur de Ponte](Lanceur-de-Ponte)                                                    |
| Insecte      | **Chasse**     | Ouvre les [Outils pour Chasseur](Outils-pour-Chasseur) (Analyser + Bestiaire)                    |
| Épée         | **Combat**     | Ouvre les [Outils d'attaque](Outils-d-attaque) (Analyser, Simuler, Multi-flood, Temps de trajet) |
| Engrenage    | **Paramètres** | Ouvre la [Boîte Paramètres](Boite-Parametres)                                                    |

Chaque icône a un tooltip explicatif au survol. Cliquer sur une icône ouvre la boîte correspondante au centre de l'écran ; tu peux ensuite la déplacer, la redimensionner légèrement ou la fermer comme une fenêtre.

## Position du dock

Par défaut la toolbar est **à droite** sur desktop. Tu peux changer ça depuis _Paramètres → Apparence → Position du dock_ :

- **Droite** : barre verticale collée au bord droit (par défaut sur desktop).
- **Bas** : barre horizontale collée au bord inférieur de l'écran.

Sur écran étroit (largeur ≤ 768px, typiquement mobile et tablette portrait), la toolbar est **forcée en bas** même si ton réglage est sur "droite". Cette bascule est dynamique : si tu redimensionnes la fenêtre du navigateur ou tournes ton mobile, la toolbar suit le breakpoint sans que tu aies à recharger.

## Mode auto-cacher

Toujours dans _Paramètres → Apparence_, l'option **Toolbar visible** propose deux comportements :

- **Affichée en permanence** (par défaut) — la toolbar reste à l'écran tant que tu navigues.
- **Auto-cacher** — la toolbar disparaît et ne réapparaît que lorsque ton curseur s'approche du bord où elle est ancrée (à droite ou en bas selon ta config). Utile si tu veux maximiser la place utile à l'écran sur les pages denses (rapports de combat, listes ennemies longues, etc.).

L'animation d'apparition / disparition utilise un `slide` de 500 ms.

## Animations des boîtes

Les boîtes ouvertes depuis la toolbar utilisent par défaut une animation `fade` à l'ouverture et à la fermeture. Tu peux régler la durée (ou la mettre à 0 pour désactiver) dans _Paramètres → Apparence → Animation_.

## Personnaliser les couleurs

Trois couleurs principales peuvent être personnalisées (toujours dans _Paramètres → Apparence_) :

- **Couleur 1 / 2 / 3** : la palette utilisée pour les fonds et accents des boîtes
- **Couleur titre** : le bandeau supérieur des boîtes
- **Couleur texte** : la couleur principale du texte et des liens

Ces couleurs sont appliquées en temps réel à toutes les fenêtres ouvertes — pas besoin de recharger la page.
