# Fiche 03 : rentabilité d'un niveau d'Armes, de Bouclier ou d'Étable à pucerons

Statut : **implémentée (v0.5) selon les formules du joueur ; affichée au Laboratoire (et à l'Armée pour Armes et Bouclier)**

## Critère retenu (décision du joueur)

Seule compte la comparaison en **temps de ponte**. Les ouvrières sacrifiées viennent du stock des convois et ne récoltaient rien : aucune récolte perdue n'est comptée.

## Armes et Bouclier

Pour le niveau visé n, avec Cₙ ouvrières sacrifiées (60 s de ponte de base chacune) et une unité de comparaison de temps de ponte tᵤ et de caractéristique cᵤ (hors bonus) :

> Sₙ = ⌈ Cₙ × 60 / tᵤ × cᵤ × (n + 9) ⌉

- H = caractéristique totale de l'armée **hors bonus** (attaque et défense pour Armes, vie pour Bouclier).
- Rentable si **H ≥ Sₙ**. Sinon il manque max(0, Sₙ − H) HB.
- Les bonus de ponte (Couveuse, Solarium, Technique de ponte) réduisent ouvrières et unités dans la même proportion : ils n'interviennent pas.
- Unité de comparaison : par défaut la pondable au meilleur rendement (caractéristique par seconde de ponte) ; le joueur peut en choisir une autre, le choix est mémorisé.

Exemples vérifiés par les tests : Armes 5 contre la JS = 14 530 HB ; Bouclier 9 contre la JSN = 589 824 HB.

## Étable à pucerons

- Le niveau n exige Communication avec les animaux au niveau n + 2.
- Cₙ = ouvrières des niveaux de Communication manquants : 560 pour l'étable 1 depuis zéro, puis 320 × 2^(n−1).
- Capacité de convoi : 10 + 0,5 × n ressources par ouvrière.
- O = ouvrières disponibles pour les convois (saisies au Laboratoire, préremplies avec ouvrières − TDC).

> ΔK = 0,5 × O − Cₙ × (10 + 0,5 n)   rentable si ΔK > 0 (pas à égalité), soit O ≥ Cₙ (20 + n) + 1

Sur plusieurs niveaux, chaque sacrifice est déduit de O avant de tester le passage suivant.

## Données utilisées

- **Armée totale** : garnison (page Armée) + chasses mémorisées (page Ressources) + attaques en cours.
- **Niveaux** : pages Laboratoire et Armée.
- Sur le Laboratoire, l'armée utilisée est la dernière armée totale vue sur la page Armée.
