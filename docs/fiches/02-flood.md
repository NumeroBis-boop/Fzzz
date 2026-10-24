# Fiche 02 : floods optimisés et floods d'alliance

Statut : **cœur de calcul écrit (`core/flood.ts`) ; interface et partage à valider**

## Règles utilisées

| Règle | Source | Statut |
|---|---|---|
| Prise = 20 % du TDC cible, 1 cm² max par unité | Tutoriel | officiel |
| Portée : cible entre ½ et 3× le TDC de l'attaquant, vérifiée **à l'arrivée** | Règlement (lexique) + tutoriel | officiel |
| Arrondi de la prise à l'entier inférieur | Toolzzz | hypothèse |
| Bornes de portée inclusives | Toolzzz | hypothèse |

## Optiflood (un attaquant)

`planifierFlood` prend le maximum à chaque attaque, sauf quand cela ferait sortir la cible de portée alors qu'il reste des attaques. Dans ce cas, il prend la « prise limite » ⌊(2·cible − att)/3⌋, puis une dernière attaque à 20 %.

Une recherche exhaustive dans les tests confirme que ce plan atteint le maximum possible.

Exemple pour 1000 contre 1000 et 10 attaques : `[200, 133, 133]` = 466 cm². L'enchaînement 200 puis 160 laisse la cible hors de portée et plafonne à 360.

## Floods d'alliance

`simulerSequence` rejoue toutes les attaques connues sur une cible, quel que soit l'attaquant, dans l'ordre d'arrivée. Chaque arrivée recalcule la prise et la portée.

C'est la base du tableau d'alliance : quand un allié prépare un flood, l'outil tient compte des floods déjà annoncés sur la même cible. Il signale aussi les attaques qui arriveront hors de portée.

Données partagées, uniquement des **floods alliés saisis ou lancés via l'extension** :

- attaquant ;
- cible ;
- nombre d'unités ;
- heure d'arrivée (serveur) ;
- TDC de l'attaquant et de la cible au lancement.

## À trancher

- **Stockage** : Supabase avec connexion Discord, comme recommandé, ou autre ? Cela suppose un projet Supabase à ton nom.
- **Preuve d'identité** (pseudo du jeu ↔ compte Discord) : code temporaire dans la description du profil en jeu.
- **Limite connue** : les attaques des autres alliances et les chasses modifient les TDC pendant le flood. La simulation l'ignore ; l'interface doit le dire.
