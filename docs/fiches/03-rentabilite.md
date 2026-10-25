# Fiche 03 : rentabilité d'un niveau d'Armes, de Bouclier ou d'Étable à pucerons

Statut : **affiché sur la page Armée (v0.2) pour Armes et Bouclier ; étable à pucerons à afficher**

## Critère retenu

Les ouvrières sacrifiées viennent du stock des convois et ne récoltaient rien (réponse du joueur). Leur vrai coût est donc le **temps de ponte** qu'elles ont demandé. Pendant ce temps, la reine aurait pu pondre des unités de combat.

Pour un niveau d'Armes ou de Bouclier :

- **gain du niveau** = 10 % de la caractéristique de base de l'armée (vie pour Bouclier, attaque et défense pour Armes) ;
- **gain de l'alternative** = unités pondables pendant le temps de ponte des ouvrières × caractéristique × (1 + 0,1 × niveau actuel). L'outil retient la meilleure unité **disponible sur le s5** ;
- le niveau est rentable si son gain dépasse celui de la meilleure alternative.

Nourriture, matériaux et temps de recherche sont affichés à côté, sans entrer dans le critère.

C'est l'idée de Toolzzz, avec deux corrections :

- Toolzzz appliquait le bonus de Bouclier aux dégâts des unités pondues ;
- Toolzzz comparait seulement avec JS, Tank et TuE, au lieu de la meilleure unité.

## Étable à pucerons

Le niveau n exige Communication avec les animaux au niveau n + 2.

**Coût du niveau** = étable (matériaux) + chaque niveau de Communication manquant, dont les ouvrières entraînent un temps de ponte.

**Gain journalier** = pillage du jour / (30 + n) + prélèvement de colonie / (20 + n). Il suppose que la limite « 1 ressource par point d'attaque survivant » ne bride pas le pillage. Le pillage et le prélèvement de colonie sont saisis par le joueur.

## Données utilisées

- **Armée totale** : garnison (page Armée) + chasses mémorisées (page Ressources) + attaques en cours.
- **Bouclier et Armes** : page Armée.
- **Bonus de ponte** : déduit du rythme de la file (boîte Compte+).

## Hypothèses

- Une seule file de ponte, partagée entre ouvrières et unités.
- Toutes les unités du s5 se pondent directement. **À confirmer** : si les élites ne s'obtiennent que par l'expérience, l'alternative en défense (aujourd'hui la Tueuse d'élite) doit être restreinte.
