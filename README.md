# Fzzz

Outils pour [Fourmizzz](https://s5.fourmizzz.fr) : calculateurs (trajet, flood, chasse, rentabilité), analyse de RC et extension navigateur (Firefox PC et Android, navigateurs Chromium).

## Structure

```
packages/core     formules et analyseurs en TypeScript pur, testés (Vitest)
apps/extension    extension WXT (Chrome MV3, Firefox PC et Android)
docs/             règles de conformité et fiches de conception
```

Chaque formule déclare sa source et son niveau de confiance (`officiel`, `communaute`, `verifie-s5`, `hypothese`) : voir `packages/core/src/statut.ts`.

## Développement

```bash
pnpm install
pnpm test
pnpm typecheck
```

## Installer la version de développement

```bash
pnpm install
pnpm --filter @fzzz/extension build           # Chrome, Edge, Brave… → apps/extension/.output/chrome-mv3
pnpm --filter @fzzz/extension build:firefox   # Firefox → apps/extension/.output/firefox-mv3
```

- **Chrome / Edge** : `chrome://extensions`, activer le mode développeur, « Charger l'extension non empaquetée », choisir `.output/chrome-mv3`.
- **Firefox PC** : `about:debugging#/runtime/this-firefox`, « Charger un module complémentaire temporaire », choisir `manifest.json` dans `.output/firefox-mv3`.
- **Firefox Android** : nécessite une publication sur addons.mozilla.org (ou une collection personnalisée) ; prévu plus tard.

Fonctions de la v0.1 : heure serveur à la seconde, arrivées des attaques à la seconde et dans l'ordre, chasses sur la page Armée, durées de trajet sur la page Ennemies (après une visite du Laboratoire).

## Règlement

L'extension suit le principe du règlement : l'optimisation est autorisée, pas l'automatisation. Voir [docs/conformite.md](docs/conformite.md).

## Crédits et licence

Les formules et données de jeu proviennent en partie de [Toolzzz](https://github.com/GuiEpi/toolzzz) (GuiEpi), fork d'[Outiiil](https://github.com/Hraesvelg/Outiiil) (Hraesvelg), et des outils de Calystène. Ces projets sont sous GPL-3.0. Fzzz l'est aussi : voir [LICENSE](LICENSE).
