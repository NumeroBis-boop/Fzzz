# Fzzz

Extension navigateur pour [Fourmizzz](http://www.fourmizzz.fr) (serveur s5), pour Chrome, Edge, Brave et Firefox (PC et Android).

Fzzz est un fork de [Toolzzz](https://github.com/GuiEpi/toolzzz) (GuiEpi), lui-même fork et maintenance d'[Outiiil](https://github.com/Hraesvelg/Outiiil) (Hraesvelg). La base est celle de Toolzzz 3.12.3, que nous améliorons pour l'alliance.

## Différences avec Toolzzz

- Nom, identifiant Firefox (`fzzz@numerobis-boop.github.io`) et liens propres : Fzzz peut être installé à côté de Toolzzz, mais **il faut désactiver l'un des deux**, sinon les deux s'injectent dans les mêmes pages.
- **Conformité au règlement du s5** (voir [docs/conformite.md](docs/conformite.md)) :
  - « Synchroniser » et « Sonder » n'envoient plus l'attaque tout seuls à la fin du compte à rebours. Ils affichent le décompte, puis mettent en évidence le bouton Lancer : **le clic final appartient au joueur**.
  - L'actualisation automatique du chat (une requête toutes les 5 s) est retirée.

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
