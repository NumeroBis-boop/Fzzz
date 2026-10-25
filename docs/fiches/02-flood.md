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

## Décisions (v0.5)

- Hypothèses validées : 20 %, portée vérifiée à l'arrivée, arrondi à l'entier inférieur, bornes inclusives.
- **Marge de 1 cm²** sur la prise limite, comme Toolzzz (le cœur garde 0 par défaut ; l'interface passera 1).
- **Prise de TDC estimée** à afficher selon les attaques prévues et le TDC des deux joueurs.
- Les TDC modifiés par d'autres attaques ou chasses pendant le flood ne sont pas simulés : **un avertissement suffit**.
- **Stockage** : Supabase, accès réservé à un rôle Discord de l'alliance (pas de code dans le profil en jeu).
- Les chasses en cours d'un allié s'afficheront sur son profil.
