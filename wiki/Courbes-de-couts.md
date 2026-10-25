## Courbes de coûts

Toolzzz injecte un widget de **visualisation graphique** des coûts et temps de toutes les constructions et recherches du jeu, accessible depuis la page Construction. C'est l'outil typique pour décider quoi monter en priorité, ou pour évaluer l'effort d'un objectif long terme (passer la Fourmilière niveau 30, par exemple).

> ![Courbes de coûts](assets/wiki/courbes-de-couts.png)

## Comment l'ouvrir

Va sur **construction.php** (ta colonie active) puis clique sur l'onglet **Coûts** que Toolzzz ajoute dans la barre de navigation des onglets natifs. L'URL passe sur le hash `#cout`, et la simulation native est masquée pour laisser place au widget.

> ![Onglet Coûts dans la navigation](assets/wiki/courbes-de-couts-menu.png)

Pour revenir à la simulation native de Fourmizzz, clique sur un autre onglet (par exemple Construction).

## Sélectionner une construction et une recherche

Le widget propose deux sélecteurs :

- **Construction** — choix parmi les 13 constructions du jeu (Fourmilière, Salle de ponte, Cocon, Mine de matériaux, Champ de pommes, Étable, Dôme, Loge, etc.)
- **Recherche** — choix parmi les 10 recherches (Bouclier, Armes, Vitesse, Architecture, Cartographie, etc.)

Les deux courbes s'affichent en parallèle, ce qui permet de comparer immédiatement le coût d'une construction face à celui d'une recherche du même tier.

## Plage de niveaux

Un **slider double** sous les sélecteurs te laisse définir la plage de niveaux à tracer (par défaut 1 → 20). Tu peux étendre la plage jusqu'aux niveaux maximum du jeu pour voir la progression complète, ou la resserrer sur les 5 niveaux qui t'intéressent.

Les courbes se redessinent en temps réel dès que tu bouges le slider.

## Architecture & Salle d'analyse

Deux champs sous le slider sont **pré-remplis avec tes propres niveaux** d'Architecture et de Salle d'analyse. Ces deux niveaux influencent les temps (-10% par niveau d'Architecture pour les constructions, -10% par niveau de Salle d'analyse pour les recherches).

Tu peux **modifier ces valeurs pour simuler** un autre profil :

- Voir combien de temps tu gagnerais en montant Architecture de 5 niveaux
- Comparer ton profil avec celui d'un membre d'alliance plus avancé
- Estimer le coût total d'un objectif long terme dans ta progression future

Les courbes se mettent à jour à chaque modification.

## Ce que les courbes montrent

Pour chaque tier sélectionné (construction ou recherche), Toolzzz trace :

- **Temps** de construction ou de recherche par niveau
- **Coût en matériaux**
- **Coût en pommes** (nourriture)
- **Coût en ouvrières** (selon ta recherche Cartographie)
- **Capacité ou production** quand applicable (Étable, Mine, Champ, Dôme, Loge…)

Les axes sont libellés en français et utilisent le format de nombres FR (espaces comme séparateur de milliers).

## Rentabilité de l'Étable à pucerons

Spécificité Toolzzz : sur la page Construction (en mode natif, pas dans le widget Coûts), une **info de rentabilité** est ajoutée dans la description de l'Étable à pucerons. Le tooltip détaille les ouvrières disponibles, la capacité de livraison actuelle et au niveau suivant, la perte d'ouvrières induite par la construction, et le seuil de rentabilité ouvrière. Utile pour décider si tu en montes une nouvelle ou si tu attends.
