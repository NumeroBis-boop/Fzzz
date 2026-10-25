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
| Ressources.php, fonction du jeu `calculTempsChasse` (bonus 8 = Vitesse de chasse 8) | Durée de chasse = ⌈(TDC + surface) × 0,9^VC⌉ (Toolzzz arrondit au plus proche) |
| Terrain 19 095 cm² → 916 560 matériaux / jour | 48 ressources / cm² / jour |
| Pages Armée et Attaquer : 12 unités listées | Concierge d'élite et Tank d'élite existent mais ne s'obtiennent que par l'expérience (joueur) ; toutes les autres unités se pondent |
| Laboratoire : les 10 coûts du niveau suivant | Coûts = base × 2^(n−1), données Toolzzz exactes |
| Laboratoire : les 10 temps du niveau suivant | t × 1,7^(n−1) × 0,9^6 (Salle d'analyse 6) ; Acide t = 10 000 s et Poison t = 50 000 s (Toolzzz : 2 800 et 3 200, faux) |
| Champignonnière 17 : 595 612 / jour | Production = ⌊72 × 1,7^n⌋ (Toolzzz : 122 × 1,7^(n−1), −0,3 %) |
| (9, 36) → Missyl (99, 17), VA 7 : 19 h 33 min 56 s (70 436 s), distance affichée 92 | Trajet = ⌊0,9^VA × 637 200 × (1 − e^(−d/350))⌋ avec d = 91,984 : valeur brute 70 436,32, **tronquée** (Toolzzz arrondit au supérieur : +1 s) |
| Construction : coûts et temps des 13 bâtiments | Temps = t × 1,6^(n−1) × 0,9^Architecture (11), arrondi au plus proche ; coûts tronqués (Champignonnière 18 : 3 134 453,94 → 3 134 453) |
| Couveuse 14 + Solarium 12 + Technique de ponte 12 | = 38, le bonus de ponte déduit de la file : confirmé |
| Description de l'Étable à pucerons | +1 % de capacité de transport en pillage et +5 % en commerce par niveau (le tutoriel parlait de « 30 % + 1 % » de pillage : la description du bâtiment fait foi) |
| Description du Dôme et de la Loge | « 10 % de base puis 5 % par évolution » et « 30 % puis 15 % » : cohérent avec (n + 2) × 5 % et (n + 2) × 15 % |
| Étable à cochenilles | +10 % d'expérience par niveau, exige Communication 10 |
| Message « Vol par X » | Ne contient que « X vous a pris N cm² » et la minute : pas de détail du combat |
| RC daté 17h23 pour une arrivée à 17:23:00 | Le RC porte la minute d'arrivée (le combat se résout à la seconde d'arrivée) |
| Combats résolus dans l'ordre d'arrivée à la seconde | Observation du joueur |
| Étable à pucerons niveau n : Communication avec les animaux niveau n + 2 | Règle donnée par le joueur |

## À recaler

| Observation | Ce qu'il manque |
|---|---|
| Rapport de combat complet (attaquant) | HTML d'un « Butin chez X » ou d'un RC d'attaque ouvert |
| Page Ennemies : distances entières | La durée calculée à partir d'une distance arrondie peut s'écarter de plusieurs minutes ; il faudra passer par les coordonnées de l'API |

## Non vérifié

- Abréviations des pages pour le Concierge d'élite et le Tank d'élite (aucune ligne vue).
