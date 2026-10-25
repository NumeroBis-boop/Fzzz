# Fzzz

Extension navigateur pour [Fourmizzz](http://www.fourmizzz.fr) (serveur s5), pour Chrome, Edge, Brave et Firefox (PC et Android).

Fzzz est un fork de [Toolzzz](https://github.com/GuiEpi/toolzzz) (GuiEpi), lui-même fork et maintenance d'[Outiiil](https://github.com/Hraesvelg/Outiiil) (Hraesvelg). La base est celle de Toolzzz 3.12.3, que nous améliorons pour l'alliance.

## Différences avec Toolzzz

- Nom, identifiant Firefox (`fzzz@numerobis-boop.github.io`) et liens propres : Fzzz peut être installé à côté de Toolzzz, mais **il faut désactiver l'un des deux**, sinon les deux s'injectent dans les mêmes pages.
- **Conformité au règlement du s5** (voir [docs/conformite.md](docs/conformite.md)) :
  - « Synchroniser » et « Sonder » n'envoient plus l'attaque tout seuls à la fin du compte à rebours. Ils affichent le décompte, puis mettent en évidence le bouton Lancer : **le clic final appartient au joueur**.
  - L'actualisation automatique du chat (une requête toutes les 5 s) est retirée.
- **Retiré** : l'utilitaire d'alliance (stockage partagé dans le forum : commandes de convois, rangs et fiches SDC, onglet « Utilitaire » des paramètres), le lanceur de ponte de la barre d'outils, et les boutons Colonne, Copier, Copie simple, CSV et Excel de la liste des membres (seul « Synchroniser » reste).
- **Ajouté** :
  - horloge à la seconde **sur l'heure du serveur** au-dessus de l'encart « S5 Pseudo », avec une **latence** réglable par pas de 0,1 s (boutons − et +, mémorisée). L'heure du serveur est déduite de l'en-tête HTTP `Date` des pages déjà chargées (permission `webRequest`, en lecture seule) : aucune requête supplémentaire vers le jeu. L'heure serveur + latence sert aux outils de synchronisation : « Synchroniser » et « Sonder » (compte à rebours au dixième), heures de retour et de RC, « Lancer à » de la boîte Combat ;
  - temps de trajet arrondis au plus proche, comme le jeu (Toolzzz arrondissait au supérieur : 1 s d'écart possible) ; minute du RC selon la règle du jeu (impact à hh:mm:00 pile → hh:mm) ;
  - au Laboratoire, dans une extension sous la ligne Armes : FdF hors bonus de l'armée, FdF HB requise pour que le niveau suivant soit rentable face à la ponte de JS, d'Artilleuses, de Tanks ou de Tueuses d'élite, FdF HB manquante et nombre d'unités à pondre ;
  - en Construction, dans un bandeau sous l'Étable à pucerons : ouvrières totales, exploitées sur le TdC et disponibles pour les convois, puis pour chaque niveau suivant les ouvrières sacrifiées (niveaux de Communication manquants), la capacité de convoi, le gain et les ouvrières qui manquent (ΔK = 0,5 × O − Cₙ × (10 + 0,5n), sur les ouvrières disponibles pour les convois) ;
  - lanceur de chasses : les difficultés que l'armée ne peut pas tenir sont grisées, avec le maximum possible.

## Installer

Voir [docs/installation.md](docs/installation.md).

## Développer

```bash
bun install
bun run dev            # Chrome, rechargement automatique
bun run dev:firefox
bun run compile        # vérification TypeScript
bun run format         # formatage (oxfmt)
bun run zip && bun run zip:firefox
```

L'architecture (scripts déclarés à la main dans `wxt.config.ts`, ordre de chargement, contraintes MV3) est décrite dans [CLAUDE.md](CLAUDE.md) et [CONTRIBUTING.md](CONTRIBUTING.md).

Pour récupérer les corrections de Toolzzz : `git fetch toolzzz master && git merge toolzzz/master` (remote `toolzzz` = https://github.com/GuiEpi/toolzzz.git). L'historique de Toolzzz est conservé dans celui de Fzzz, les fusions restent donc simples.

L'ancienne version de Fzzz (0.5, écrite de zéro) est archivée dans la branche `archive/fzzz-0.5`. Ses formules vérifiées sur le s5 sont résumées dans [docs/observations-s5.md](docs/observations-s5.md).

## Crédits et licence

- Projet original : [Outiiil](https://github.com/Hraesvelg/Outiiil) par Hraesvelg
- Fork maintenu : [Toolzzz](https://github.com/GuiEpi/toolzzz) par GuiEpi
- Fzzz : NumeroBis-boop

[GPL-3.0](LICENSE), conformément à la licence des projets d'origine.
