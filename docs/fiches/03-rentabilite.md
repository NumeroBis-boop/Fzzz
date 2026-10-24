# Fiche 03 : rentabilité d'un niveau d'Armes, de Bouclier ou d'Étable à pucerons

Statut : **critère à valider par le joueur**

## Coûts (données Toolzzz, non vérifiées sur s5)

| Niveau n | Nourriture | Matériaux | Ouvrières |
|---|---|---|---|
| Armes | 300 × 2ⁿ⁻¹ | 200 × 2ⁿ⁻¹ | 80 × 2ⁿ⁻¹ |
| Bouclier | 200 × 2ⁿ⁻¹ | 300 × 2ⁿ⁻¹ | 80 × 2ⁿ⁻¹ |
| Étable à pucerons | 0 | 1500 × 2ⁿ⁻¹ | **0** |

## Armes et Bouclier : critère proposé

Un niveau ajoute +10 % de la valeur **de base** de l'armée : attaque et défense pour Armes, vie pour Bouclier. Le gain absolu est donc constant d'un niveau à l'autre, alors que le coût double.

Le niveau est rentable si son coût total est inférieur au coût de pondre 10 % d'armée en plus :

- **coût du niveau** = nourriture + matériaux + ouvrières × valeur d'une ouvrière ;
- **coût de l'équivalent pondu** = 10 % × (coût en nourriture de l'armée) **et** 10 % × (temps de ponte de l'armée).

Le temps de ponte est souvent le facteur limitant, plus que la nourriture. L'autre conversation l'omettait : je propose d'afficher les deux comparaisons séparément plutôt que de les fusionner.

Valeur d'une ouvrière = 5 (coût de ponte) + récolte perdue sur un horizon H. Une ouvrière récolte 48 ressources par jour, **si elle a de la place sur le TDC** ; au-delà du TDC, la récolte perdue est nulle. H est un paramètre réglable, 30 jours par défaut.

## Étable à pucerons : à préciser

Son effet est d'une autre nature : +1 % de pillage par niveau, et +1 % sur les ressources prélevées sur un colonisé. Il ne se compare pas à une taille d'armée. Le gain dépend :

- du volume pillé par jour ;
- des ressources qui arrivent chez ton ou tes colonisés.

**Question** : qu'entends-tu par « pondre des ouvrières pour passer un niveau de puceron » ? D'après les données disponibles, ce bâtiment ne coûte pas d'ouvrières.
