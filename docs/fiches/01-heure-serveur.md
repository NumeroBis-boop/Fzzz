# Fiche 01 : heure serveur et heures d'arrivée

Statut : **implémentée (v0.1), à tester en jeu**

## Ce que fait l'extension

- **Badge d'heure serveur**, en bas à droite de toutes les pages, à la seconde, avec sa précision (par exemple « ±0,2 s »).
- **Arrivée à la seconde** de chaque attaque, sur Armée et sur Attaquer, à côté du compte à rebours. Les attaques sont aussi numérotées dans leur ordre d'arrivée, puisque les combats sont résolus dans cet ordre à la seconde.
- **Chasses en cours sur la page Armée**. Elles sont lues dans la boîte Compte+ : la première à se terminer est donnée à la seconde, les autres à la minute.

## Méthode

1. Le script d'arrière-plan lit passivement l'en-tête HTTP `Date` des pages que tu charges. **Aucune requête n'est émise**, conformément à la règle C2.
2. Le jeu donne, pour chaque attaque, les secondes restantes au moment où il a généré la page : `reste(70427, "attaque_98500")`. L'arrivée vaut l'en-tête `Date` de cette page + ce reste, à ±1 s.
3. Si l'en-tête de la page n'est pas disponible, l'extension se rabat sur l'horloge estimée (`core/horloge.ts`).
4. **Garde-fou** : l'heure calculée doit tomber dans la minute affichée par le jeu (« Arrivée à 19h56 »). Sinon, elle s'affiche en rouge avec la mention « à vérifier ».

Le fuseau est Europe/Paris. Le passage à l'heure d'hiver du 25 octobre est géré.

## Limites

- Les chasses ne sont visibles que si la boîte Compte+ est présente dans la page. Sans Compte+, rien ne s'affiche.
- La précision de ±1 s vient de la troncature de `Date` à la seconde.
