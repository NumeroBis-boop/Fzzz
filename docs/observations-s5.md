# Observations relevées sur le s5

Chaque ligne indique ce qui a été observé, sur quelle page, et ce que cela confirme ou infirme.

## Confirmé

| Observation (2026-10-24) | Conclusion |
|---|---|
| 173 JSN en loge 3, Bouclier 8 : vie 1 384 + 1 107 + 1 038 = 3 529 | Vie = base × (1 + 0,1 × Bouclier) + base × (n + 2) × 15 % en loge |
| 378 JSN au dôme 3 : vie 3 024 + 2 419 + 756 = 6 199 | Dôme = (n + 2) × 5 % de la vie de base |
| Armes 9 : attaque 1 134 + 1 020 (1 020,6) ; 105 + 94 (94,5) | Dégâts = base × (1 + 0,1 × Armes), **arrondi par défaut** |
| Consommation : 415 en loge (173 JSN), 604 au dôme (378 JSN, 604,8), 84 en loge (35 JSN) | Entretien : dôme 10 %, loge 15 %, arrondi par défaut |
| File de ponte (boîte Compte+) : 5 relevés donnent 300 s × 0,9^38,0 par JSN | Couveuse + Solarium + Technique de ponte = 38 ; déductible automatiquement |
| Page Ennemies : bornes 9 548 à 57 284 pour 19 095 cm² | Portée : cible ≥ moitié et < triple (borne haute stricte) |
| Ressources.php, fonction du jeu `calculTempsChasse` | Durée de chasse = ⌈(TDC + surface) × 0,9^bonus⌉ (Toolzzz arrondit au plus proche) |
| Terrain 19 095 cm² → 916 560 matériaux / jour | 48 ressources / cm² / jour |
| Pages Armée et Attaquer : 12 unités listées | Pas de Concierge d'élite ni de Tank d'élite sur le s5 |
| Combats résolus dans l'ordre d'arrivée à la seconde | Observation du joueur |
| Étable à pucerons niveau n : Communication avec les animaux niveau n + 2 | Règle donnée par le joueur |

## À recaler

| Observation | Ce qu'il manque |
|---|---|
| Attaque juste lancée vers un membre de l'alliance : 70 436 s de trajet | Distance exacte et niveau de VA pour recaler la formule de trajet |
| Champignonnière : 595 612 nourriture / jour | Niveau de la Champignonnière (au niveau 17, la formule Toolzzz donne 593 676, soit −0,3 %) |
| Page Ennemies : distances entières | La durée calculée à partir d'une distance arrondie peut s'écarter de plusieurs minutes ; il faudra passer par les coordonnées de l'API |

## Non vérifié

- Lecture des niveaux du Laboratoire : sélecteurs de Toolzzz, faute d'échantillon HTML du s5.
- Le bonus de `calculTempsChasse` (8) est supposé égal au niveau de Vitesse de chasse.
- Unités pondables directement : la rentabilité suppose que toutes les unités du s5 le sont, y compris les élites.
