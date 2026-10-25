## Boîte Paramètres

La **Boîte Paramètres** s'ouvre depuis la quatrième icône de la toolbar (engrenage). Elle regroupe en un seul endroit tous les réglages personnalisables de Toolzzz, organisés en quatre onglets.

## Onglet _Général_

> ![Onglet Général](assets/wiki/parametres-general.png)

Les options qui touchent au comportement de l'extension :

- **Affectation des ressources** — sur la page Ressources, auto-affecte les ouvrières disponibles vers Matériaux, Nourriture, ou rien (la valeur _Non_ désactive l'auto-affectation). En C+, le jeu propose déjà nativement Matériaux / Nourriture : l'intérêt de l'option est alors le mode Ratio ci-dessous.
- **Ratio** (quatrième valeur de l'option précédente) — répartit _toutes_ les ouvrières entre nourriture et matériaux selon la **Part en nourriture** choisie au curseur, de 10 en 10, ou tapée au pourcent près dans le champ à côté (le reste va aux matériaux). Contrairement aux modes Matériaux / Nourriture qui ne font que compléter les ouvrières inutilisées, le ratio est réappliqué à chaque consultation de la page Ressources : la répartition est donc conservée après une chasse, un flood ou une perte de terrain. Le curseur est aussi disponible directement sur la page Ressources, où un changement s'applique immédiatement.
- **Méthode de flood par défaut** — choix de l'algorithme utilisé par défaut dans la [boîte Multi-flood](Outils-d-attaque#onglet-multi-flood) et le formulaire flood injecté sur la page Attaquer. Quatre méthodes : Standard, Optimisée, Uniforme, Dégressive.
- **Antisonde max en terrain / en dôme** — nombre maximum d'antisondes que le formulaire flood pré-remplit. La quantité réellement envoyée est tirée aléatoirement entre 90 % et ce max, pour rester non prédictible. Configurable séparément pour terrain et pour dôme parce que les contraintes de placement diffèrent.
- **Sonde vers l'ennemi** — nombre d'unités envoyées au clic sur les boutons _Sonder_ / _Sonder direct_ de la page Attaquer. L'espèce envoyée est automatiquement la première sonde disponible dans ton armée (Sonde, puis Sonde élite si débloquée).

## Onglet _Utilitaire_

> ![Onglet Utilitaire](assets/wiki/parametre-utilitaire.png)

Cet onglet expose deux champs : les **identifiants des sections cachées du forum d'alliance** que Toolzzz utilise comme stockage partagé pour les fonctionnalités d'utilitaire d'alliance (commandes, infos membres, rangs, coordonnées).

Tu n'as **pas besoin de remplir ces champs à la main** dans la majorité des cas — Toolzzz les auto-détecte quand tu visites le forum de ton alliance, à condition que les sections existent. Les sections sont créées par le chef d'alliance via le bouton **Préparer le forum pour un SDC** sur la page forum d'alliance (voir [SDC — Commandes de ressources](SDC-Commandes-de-ressources)).

Modifie ici uniquement si :

- L'auto-détection a échoué
- Ton chef t'a communiqué les IDs directement

L'extension supporte les noms `Toolzzz_Commande` / `Toolzzz_Membre` ainsi que les anciens noms `Outiiil_Commande` / `Outiiil_Membre` pour les alliances qui ont préparé leur forum à l'époque d'Outiiil.

## Onglet _Apparence_

> ![Onglet Apparence](assets/wiki/parametres-apparence.png)

C'est l'onglet le plus visuel — il personnalise les couleurs et la position de l'interface.

- **Couleur 1 / 2 / 3** — la palette de fond et d'accents des boîtes flottantes. La couleur 2 est notamment utilisée pour les lignes paires des tableaux (effet zébré).
- **Couleur titre** — bandeau supérieur des boîtes.
- **Couleur texte** — couleur principale du texte et des liens dans les boîtes Toolzzz.
- **Position du dock** — _Droite_ (par défaut) ou _Bas_. Sur écran étroit, _Bas_ est forcé automatiquement.
- **Toolbar visible** — _Affichée_ (toujours visible) ou _Auto-cacher_ (apparaît au survol du bord).
- **Animation apparition / disparition** — durée en ms du fade des boîtes. Mets à 0 pour désactiver.

Les changements sont appliqués en temps réel : tu peux ouvrir une autre boîte en parallèle et voir les couleurs se mettre à jour pendant que tu joues avec les sélecteurs.

## Onglet _À propos_

Affiche la version courante de Toolzzz et quatre liens utiles : le **Wiki** (cette page), le **code source** sur GitHub, et deux raccourcis pour **signaler un bug** ou **proposer une fonctionnalité**. Pied de page : la mention du projet original Outiiil (Hraesvelg / Freddy) sous licence GPL-3.0. Pas de réglages dans cet onglet — c'est un récap pratique pour retrouver les bons liens.
