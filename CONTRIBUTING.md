# Contribuer à Toolzzz

Merci de l'intérêt que tu portes au projet. Ce document décrit comment mettre en place l'environnement de développement.

## Prérequis

[Bun](https://bun.com/docs/installation)

```bash
bun install
```

## Démarrage

```bash
bun run dev            # Chrome
bun run dev:firefox    # Firefox
```

Cette commande build l'extension, lance un navigateur avec l'extension déjà chargée, et surveille les fichiers sources. À chaque modification, elle rebuild automatiquement — il suffit de rafraîchir la page du jeu (F5) pour voir tes changements.

## Scripts

| Commande                | Description                                            |
| ----------------------- | ------------------------------------------------------ |
| `bun run dev`           | Mode dev avec auto-reload (Chrome)                     |
| `bun run dev:firefox`   | Mode dev avec auto-reload (Firefox)                    |
| `bun run build`         | Build de production (Chrome)                           |
| `bun run build:firefox` | Build de production (Firefox)                          |
| `bun run zip`           | Génère le zip à distribuer pour Chrome                 |
| `bun run zip:firefox`   | Génère le zip à signer sur AMO                         |
| `bun run compile`       | Vérification TypeScript                                |
| `bun run format`        | Formate tous les fichiers avec [oxfmt](https://oxc.rs) |
| `bun run format:check`  | Vérifie le formatage sans modifier les fichiers        |

## Formatage

Le projet utilise [oxfmt](https://oxc.rs) pour le formatage. La config est dans `.oxfmtrc.json` et les libs vendorées (`public/js/lib/`) sont exclues.

**Hook pre-commit** : [husky](https://typicode.github.io/husky/) + [lint-staged](https://github.com/lint-staged/lint-staged) formatent automatiquement les fichiers stagés à chaque `git commit`. Rien à installer manuellement — le hook est posé à l'exécution de `bun install` (via le script `prepare`).

Pour le formatage à la sauvegarde dans ton éditeur, consulte la [doc officielle d'oxfmt](https://oxc.rs/docs/guide/usage/formatter/editors.html). Sinon, lance `bun run format` manuellement.

Côté CI, chaque push et PR sur `main` lance `bun run format:check` — un PR non formaté échoue.

## Assistants IA

Le projet est annoté pour [Claude Code](https://docs.claude.com/claude-code) :

- **`CLAUDE.md`** à la racine — instructions générales du projet (architecture WXT, convention de commit, pipeline release, etc.).
- **`.claude/skills/`** — skills déclenchés conditionnellement (`analyze-fourmizzz`, `ui-primitives`, `release-notes`).

Si tu utilises un autre assistant IA (Codex, GitHub Copilot, Cursor, Windsurf...), tu peux pointer son fichier d'instructions vers `CLAUDE.md` via un symlink local — pas besoin de dupliquer le contenu :

```bash
# OpenAI Codex CLI / standard agents.md
ln -s CLAUDE.md AGENTS.md

# GitHub Copilot (instructions custom du repo)
ln -s CLAUDE.md .github/copilot-instructions.md

# Cursor (format legacy, toujours supporté)
ln -s CLAUDE.md .cursorrules

# Windsurf
ln -s CLAUDE.md .windsurfrules
```

Pour les skills (`.claude/skills/`), le format **SKILL.md** s'est généralisé et plusieurs outils savent désormais les déclencher :

- **opencode** et **GitHub Copilot** lisent directement `.claude/skills/` — rien à faire.
- **Codex CLI** utilise `.codex/skills/` ; symlinke `.claude/skills/<skill>` vers `.codex/skills/<skill>` pour partager.
- Les autres outils qui ne supportent pas SKILL.md peuvent toujours scanner les `.md` du repo manuellement, ou symlinker un skill précis vers leur fichier d'instructions.

Ces symlinks sont **personnels** — ne les commit pas (le projet ne ship aucun fichier d'instruction non-Claude officiellement). Si tu veux les masquer de `git status`, ajoute-les à `.git/info/exclude` (local, jamais commit), pas au `.gitignore` versionné.

## Wiki

Le wiki public ([github.com/GuiEpi/toolzzz/wiki](https://github.com/GuiEpi/toolzzz/wiki)) est rédigé pour les joueurs Fourmizzz francophones (pas devs). Les sources vivent dans le repo, pas dans le wiki GitHub directement :

- **`wiki/*.md`** — une page par fichier. `Home.md` est la page d'accueil, `_Sidebar.md` la barre latérale.
- **`assets/wiki/`** — captures d'écran et autres médias référencés depuis les pages.

À chaque push sur `master` qui touche `wiki/**` ou `assets/wiki/**`, le workflow `.github/workflows/wiki-sync.yml` mirror le contenu vers le wiki GitHub. Ne pas éditer le wiki directement sur GitHub — les changements seraient écrasés au prochain sync.

Pour ajouter une page :

1. Crée `wiki/Nom-De-La-Page.md` (les tirets remplacent les espaces dans l'URL).
2. Référence-la depuis `_Sidebar.md` et/ou `Home.md`.
3. Place les images dans `assets/wiki/` et référence-les en `assets/wiki/...` (le workflow met `wiki/*.md` et `assets/wiki/*` côte-à-côte dans le wiki publié).

## Tester un build de production

`bun run dev` charge toujours le build de développement. Pour valider un build de production avant une release (ou reproduire un bug qui n'apparaît qu'en prod), fais un build puis charge-le manuellement.

```bash
bun run build            # Chrome  →  .output/chrome-mv3/
bun run build:firefox    # Firefox →  .output/firefox-mv3/
```

**Chrome** : `chrome://extensions` → activer le mode développeur → _Charger l'extension non empaquetée_ → sélectionner `.output/chrome-mv3/`.

**Firefox** : `about:debugging#/runtime/this-firefox` → _Charger un module complémentaire temporaire_ → sélectionner `.output/firefox-mv3/manifest.json`.
