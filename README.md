# Fzzz

Outils pour [Fourmizzz](https://s5.fourmizzz.fr) : calculateurs (trajet, flood, chasse, rentabilité), analyse de RC et extension navigateur (Firefox PC et Android, navigateurs Chromium).

## Structure

```
packages/core     formules et analyseurs en TypeScript pur, testés (Vitest)
apps/extension    extension WXT (à venir)
docs/             règles de conformité et fiches de conception
```

Chaque formule déclare sa source et son niveau de confiance (`officiel`, `communaute`, `verifie-s5`, `hypothese`) : voir `packages/core/src/statut.ts`.

## Développement

```bash
pnpm install
pnpm test
pnpm typecheck
```

## Règlement

L'extension suit le principe du règlement : l'optimisation est autorisée, pas l'automatisation. Voir [docs/conformite.md](docs/conformite.md).

## Crédits et licence

Les formules et données de jeu proviennent en partie de [Toolzzz](https://github.com/GuiEpi/toolzzz) (GuiEpi), fork d'[Outiiil](https://github.com/Hraesvelg/Outiiil) (Hraesvelg), et des outils de Calystène. Ces projets sont sous GPL-3.0. Fzzz l'est aussi : voir [LICENSE](LICENSE).
