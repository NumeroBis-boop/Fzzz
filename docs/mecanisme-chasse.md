# Mécanisme de chasse

Ce que fait le jeu quand une chasse arrive, mesuré sur 5 425 tirages du simulateur de chasse (Compte+) en octobre 2026, et ce que l'extension en fait : le modèle `public/js/class/ModeleChasse.js`, les tables de pertes `PERTES_CHASSE` de `public/js/content.js` et le lanceur `public/js/class/LanceurChasse.js`. Les tirages bruts et l'analyse complète sont chez Grim (note « Mécanisme de chasse Fourmizzz »).

## Une chasse en six étapes

`H` est le TdC au moment de l'impact, `M` la surface chassée (cm²), `A` l'attaque de l'armée envoyée (base × (1 + 0,1 × Armes)). Une seule étape est aléatoire, la troisième ; tout le reste est déterministe, ce qui permet de rejouer un tirage enregistré contre n'importe quelle armée.

1. **Difficulté.** `B = (M + 0,01 × H) × 1,04^round(10 × log10(H / 50))` : un forfait de 1 % du TdC par chasse, et des paliers de +4 % tous les ×1,259 de TdC, pris sur le TdC initial même pour une chasse de 1 000 × le TdC. La « difficulté » de Calystène vaut `3 × B` ; son ratio vaut `A / (3 × B)`. Vérifié de 1 cm² à 1 000 × le TdC, de 3 162 à 10 M de TdC.
2. **Budget de puissance.** Le jeu alloue `3,466 × B` points de puissance aux prédateurs, la puissance d'un prédateur étant `√(réplique × vie)`. Dépensé à 0,8 % près (arrondis des effectifs) ; jamais dépassé.
3. **Génération des prédateurs.** Une escorte de petites araignées (un lot de 4,8 % du budget, puis 37 % de chance d'un lot de plus à chaque fois), un créneau principal (type tiré uniformément parmi les 17, qui prend une part uniforme entre 25 et 75 % du reste, retiré quand il n'y tient pas), un complément (type uniforme, tout le reste), puis les reliquats : tant qu'il reste de quoi payer une petite araignée, un type est tiré ; abordable, il est pris au maximum ; sinon, s'il reste plus d'un lot d'escorte le type est retiré, sinon le tirage s'arrête. Les types identiques fusionnent. Résultat typique : trois types, le dominant à ~60 % du budget.
4. **Palier de réplique.** Avec `V` la vie totale des prédateurs (survivants compris), réplique subie : 10 % si `A ≥ 3 V`, 30 % si `A ≥ 2 V`, 50 % si `A ≥ 1,5 V`, 100 % sinon. Seuils inclusifs, vérifiés sans exception sur 2 212 tirages.
5. **Prédateurs tués.** Par réplique croissante (l'ordre d'affichage), chacun coûtant sa vie à l'attaque, jusqu'à épuisement.
6. **Pertes.** Dégâts = réplique totale de tous les prédateurs × palier. Les unités meurent dans l'ordre JSN → SN → NE → JS → S → C → CE → A → AE → SE → Tk → TkE → Tu → TuE, chacune absorbant `vie × (1 + 0,1 × Bouclier)`, effectifs tronqués à l'entier.

Durée : `⌈(H + M) × 0,9^VC⌉` secondes (`calculTempsChasse` du jeu). Les chasses d'une salve partent ensemble et arrivent l'une après l'autre : la i-ème arrive sur `H + i × M`.

## Prédateurs

| prédateur        | réplique  | vie       | puissance |
| ---------------- | --------- | --------- | --------- |
| Petite araignée  | 13        | 50        | 25,5      |
| Araignée         | 19        | 75        | 37,7      |
| Chenille         | 30        | 100       | 54,8      |
| Criquet          | 42        | 100       | 64,8      |
| Guêpe            | 50        | 140       | 83,7      |
| Cigale           | 70        | 200       | 118       |
| Dionée           | 70        | 700       | 221       |
| Abeille          | 115       | 220       | 159       |
| Hanneton         | 140       | 450       | 251       |
| Scarabée         | 230       | 1 000     | 480       |
| Lézard           | 700       | 5 000     | 1 871     |
| Mante religieuse | 1 200     | 800       | 980       |
| Souris           | 1 400     | 5 000     | 2 646     |
| Mulot            | 3 000     | 8 000     | 4 899     |
| Alouette         | 10 000    | 30 000    | 17 321    |
| Rat              | 50 000    | 100 000   | 70 711    |
| Tamanoir         | 1 000 000 | 5 000 000 | 2 236 068 |

Réplique = dégâts au palier 100 % (le simulateur affiche la valeur déjà réduite), exacte à 0,2 % par régression. Vie : exacte pour les quatorze premiers (tués partiels), à ±2 % pour les trois derniers (conservation du budget). Ce sont les `fdf` et `vie` de `FAUNE` (`content.js`).

## Ce que ça donne

- Réplique totale : 2,01 × B en moyenne (cv 0,23) ; vie : 6,44 × B (cv 0,19) ; anticorrélées (−0,88), le budget étant fixe.
- La vie ne dépend pas de l'armée : la part des chasses à 10 % de réplique au ratio `r` est simplement la probabilité que `V / B ≤ r`. La vie la plus haute possible (dionées seules, une escorte) est 10,76 × B : plus aucune chance de 50 % dès le ratio 7,17, ni de 30 % dès 10,8.
- Pertes par point de difficulté de Calystène (JSN, bouclier 0), rejeu des 5 405 tirages : 0,0641 au ratio 3, 0,0249 à 5, 0,0183 à 6, 0,0114 à 7, 0,0098 à 8, 0,0088 à 9, 0,0084 à 10, puis constant à 0,00835. Au-dessus de 10, monter le ratio ne réduit plus les pertes.
- Les chasses de moins de 5 000 de difficulté perdent 2 à 4 % de moins par point ; au-dessus, la courbe ne dépend plus de la taille.

## Le modèle (`ModeleChasse`)

Les six étapes, avec un générateur à graine (tirages reproductibles). Confronté aux 5 405 tirages, à tailles de chasse identiques : présence de chaque prédateur à ±1,1 point, part du budget à ±1,5 point, nombre de types par tirage à ±1,5 point, réplique à ±1 % dans chaque tranche de vie ; pertes moyennes de −0,4 % à +1,0 % du jeu à tous les ratios.

Il tire les chasses avec `MARGE_BUDGET = 1,005` (0,5 % de puissance en plus) : ses pertes sont alors au-dessus ou au niveau du jeu à tous les ratios (+0,3 % en zone plate, +3,3 % au plus, au ratio 6,5). Chaque surestimation coûte de l'optimisation : c'est la plus petite marge qui couvre le bruit des mesures.

Approché, sans effet visible : les bornes [0,25 ; 0,75] du créneau principal, le 37 % de l'escorte et son arrondi. Non vérifié : l'ordre de mort des trois gros prédateurs face à une armée faible ; la règle « unité blessée à plus de la moitié = perdue » citée par l'outil « chasse zéro perte » (le modèle tronque).

## Les tables (`PERTES_CHASSE`)

`ModeleChasse.tables()` tire 100 000 chasses (TdC de 20 000 à 1 000 000, chasses de 5 à 20 % du TdC) et les rejoue contre une armée de JSN à chaque ratio de 1 à 11 par pas de 0,05 : min, moyenne, max des pertes par point de difficulté, et part des tirages à 10 %. `SimulationChasse.table(nom, ratio)` lit la valeur par interpolation linéaire entre deux pas (0,04 % d'écart en moyenne, 0,35 % au pire, d'après la courbe fine du modèle), constante au-delà des bornes. `tests/pertes-chasse.test.ts` régénère les tables et exige que `content.js` en soit la copie exacte (quand le modèle change, le test échoue en affichant les nouvelles valeurs), les compare au rejeu du jeu, et vérifie l'interpolation.

Les 13 ratios de `RATIO_CHASSE` ne servent plus qu'à la liste déroulante du lanceur. Lire les anciennes tables de 2016 par paliers donnait jusqu'à 22 % d'écart entre deux ratios ; les interpoler passait sous le jeu de 1,8 à 3,6 % selon la méthode.

## Le lanceur

Deux inconnues, le nombre de chasses `n` et le terrain `M` par chasse ; tout le reste en découle : difficulté de la salve `D = Σ 3 B(H + i M, M)`, ratio `A / D`, pertes `table(ratio) × D × 10 / (10 + Bouclier)`, durée, part du temps de ponte `pertes × 300 × 0,9^ponte / durée`, rendement `n M / durée`. Pour `n` donné tout varie dans un seul sens avec `M` (le ratio baisse, le reste monte) : chaque valeur fixée est une borne sur `M` trouvée par dichotomie, le meilleur `M` est à une borne, et `n` est choisi au meilleur rendement (ou au moindre coût quand le rendement est fixé). Sans coût fixé (difficulté ou pertes), le lanceur refuse : il descendrait au plancher quoi qu'il en coûte. Quand le ratio est libre, il ne descend pas sous le plancher réglé dans Paramètres → Ressources (7,2 par défaut). La marge de JSN (× pertes max) est un plafond, pas un minimum ; dès × 1 les pertes max sont couvertes.
