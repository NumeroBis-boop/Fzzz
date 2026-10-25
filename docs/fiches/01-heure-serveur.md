# Fiche 01 : heure serveur et heures d'arrivée

Statut : **implémentée (v0.5), à tester en jeu**

## Ce que fait l'extension

- **Heure serveur** à la seconde, à côté de « S5 Pseudo » dans l'encart d'information (badge en bas à droite si l'encart manque). Deux boutons − et + corrigent la latence par pas de 0,1 s ; le décalage choisi est mémorisé. La précision n'est pas affichée.
- Chaque page se base sur l'heure réelle du serveur au moment où elle a été générée (en-tête `Date`).
- **Arrivée à la seconde** de chaque attaque, sur Armée et sur Attaquer, à côté du compte à rebours. Les attaques sont aussi numérotées dans leur ordre d'arrivée, puisque les combats sont résolus dans cet ordre à la seconde. Comme Toolzzz, l'heure du RC suit : `→ 17:23:12 · RC 17h24 (n° 1)`.
- **Heure du RC** : le RC est daté de la minute suivant l'impact (17h23:12 → 17h24) ; un impact à 17h23:00 pile donne 17h23.
- **Page Ennemies** : en haut, les attaques en cours mémorisées depuis Armée et Attaquer.
- **Chasses à la seconde** sur Ressources, et **rappel des chasses sur la page Armée**. La liste vue sur Ressources est mémorisée avec ses heures de retour exactes. Si la boîte Compte+ compte un autre nombre de chasses, la page Armée invite à rouvrir Ressources. Sans visite de Ressources, la page Armée se rabat sur la boîte Compte+, à la minute près.

## Méthode

1. Le script d'arrière-plan lit passivement l'en-tête HTTP `Date` des pages que tu charges. **Aucune requête n'est émise**, conformément à la règle C2.
2. Le jeu donne, pour chaque attaque, les secondes restantes au moment où il a généré la page : `reste(70427, "attaque_98500")`. L'arrivée vaut l'en-tête `Date` de cette page + ce reste, à ±1 s.
3. Si l'en-tête de la page n'est pas disponible, l'extension se rabat sur l'horloge estimée (`core/horloge.ts`).
4. **Garde-fou** : l'heure calculée doit tomber dans la minute affichée par le jeu (« Arrivée à 19h56 »). Sinon, elle s'affiche en rouge avec la mention « à vérifier ».

Le fuseau est Europe/Paris. Le passage à l'heure d'hiver du 25 octobre est géré.

## Limites

- La précision de ±1 s vient de la troncature de `Date` à la seconde.
