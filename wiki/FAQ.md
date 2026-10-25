## FAQ

Quelques questions fréquentes. Cette page est amenée à grandir au fil des retours — n'hésite pas à proposer une question via [GitHub Issues](https://github.com/GuiEpi/toolzzz/issues) si la tienne n'y figure pas.

## Comment changer la couleur de l'extension ?

Ouvre la **Boîte Paramètres** depuis la toolbar (icône engrenage), puis l'onglet **Apparence**. Tu peux y modifier la couleur du titre, trois couleurs de fond/accent, et la couleur du texte. Les changements sont appliqués en temps réel à toutes les fenêtres ouvertes — pas besoin de recharger la page. Plus de détails sur [Boîte Paramètres](Boite-Parametres).

## Pourquoi je ne vois pas le panneau Toolzzz à droite ?

Plusieurs causes possibles :

- Ton navigateur est en mode étroit (largeur ≤ 768px) : la toolbar bascule automatiquement en bas. Élargis la fenêtre ou regarde en bas de l'écran.
- L'option **Auto-cacher** est activée (_Paramètres → Apparence_) : approche ton curseur du bord droit (ou bas) pour la faire apparaître.
- L'extension n'a pas chargé : recharge la page Fourmizzz, et vérifie que Toolzzz est bien activé dans la liste des extensions de ton navigateur.

## Est-ce que ça fonctionne en Compte+ ?

**Oui**, Toolzzz fonctionne identiquement avec ou sans Compte+. La principale différence : si tu as un Compte+, Toolzzz **ne remplace pas** le panneau de droite natif (puisqu'il existe déjà). Tous les autres outils (boîte d'attaque, carte d'alliance, courbes de coûts, parsing de rapports, radar, enrichissements de pages…) sont disponibles dans les deux cas.

## Mes données sont-elles envoyées quelque part ?

**Non.** Toolzzz ne transmet rien à un serveur externe. Toutes les données (paramètres, radar, cache de la carte d'alliance, sauvegardes d'armée, rapports collés…) restent dans le `localStorage` de ton navigateur, sur ta machine. L'extension ne demande aucune permission réseau au-delà du domaine `fourmizzz.fr` lui-même. Voir [PRIVACY.md](https://github.com/GuiEpi/toolzzz/blob/master/PRIVACY.md) pour le détail.

## Comment surveiller un joueur ?

Va sur le profil du joueur (page Membre) et clique sur **Surveiller ce joueur**. Il apparaît dans la [Boîte Radar](Boite-Radar), et ses messages dans ta Messagerie sont colorés différemment. Pour le retirer du radar, re-clique sur le bouton (toggle) ou supprime-le directement depuis la boîte Radar.

## L'extension marche sur mobile ?

**Oui**, sur **Firefox pour Android** uniquement (Chrome Android ne supporte pas les extensions). La toolbar est automatiquement repositionnée en bas de l'écran sur les écrans étroits, et les boîtes flottantes sont scrollables au touch grâce à `jquery-ui-touch-punch`. La version 142 ou supérieure de Firefox est recommandée pour bénéficier de la déclaration de confidentialité.

## Toolzzz est-il toujours maintenu si Outiiil est mort ?

Oui — Toolzzz est un fork actif d'Outiiil, repris à partir du moment où le projet original n'était plus maintenu. Le code est sur [GitHub](https://github.com/GuiEpi/toolzzz), les releases sont taggées régulièrement, et les bugs sont traités via les issues. Crédit du projet original conservé dans l'extension (manifest + onglet _À propos_).

## Que faire si je trouve un bug ?

Ouvre une issue sur [GitHub](https://github.com/GuiEpi/toolzzz/issues) avec :

- Une description du problème (qu'est-ce qui ne fonctionne pas comme attendu)
- La page concernée (URL Fourmizzz)
- Ton navigateur et sa version
- Une capture d'écran si possible

Plus c'est précis, plus le fix est rapide.
