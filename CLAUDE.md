# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project context

Fzzz is a fork of [GuiEpi/toolzzz](https://github.com/GuiEpi/toolzzz) (itself a fork of [Hraesvelg/Outiiil](https://github.com/Hraesvelg/Outiiil), GPL-3.0), tuned for an alliance on the s5 server. Toolzzz's history is merged into this repo: pull upstream fixes with `git fetch toolzzz master && git merge toolzzz/master`. Keep the diff with upstream small (rename only user-visible "Toolzzz" strings; keep `outiiil_*` storage keys and forum section names). Toolzzz is the 3.0+ line of Outiiil, migrated from MV2 to MV3 and bundled with [WXT](https://wxt.dev) for dual Chrome + Firefox publication. Below, "Toolzzz" describes the shared code base; Fzzz's own gecko id is `fzzz@numerobis-boop.github.io` and its default branch is `main`.

### s5 rules — mandatory (see `docs/conformite.md`)

"L'optimisation est autorisée, pas l'automatisation." Never add: a timer that clicks or sends a game action by itself (the player's click is always final — a countdown is fine), periodic requests to the game (they keep the 30-min session alive), automatic re-login, or background page polling. A single click may chain several sends (multi-flood, multi-chasse).

All user-facing strings are in French (game domain vocabulary: ponte, chasse, convoi, alliance, etc.).

## Commands

```bash
bun install               # postinstall runs `wxt prepare` + installs husky hook
bun run dev               # dev mode, Chrome
bun run dev:firefox       # dev mode, Firefox
bun run build             # production build → .output/chrome-mv3/
bun run build:firefox     # production build → .output/firefox-mv3/
bun run zip               # zip for Chrome Web Store
bun run zip:firefox       # zip for Firefox AMO
bun run compile           # tsc --noEmit (typecheck only, no emitted files)
bun run check:js          # tsc -p tsconfig.js.json — checks public/js files marked // @ts-check
bun run test              # bun test tests/ — unit tests in a happy-dom window
bun run format            # oxfmt — writes changes in place
bun run format:check      # oxfmt --check — CI uses this
```

There is no linter configured. Formatting is handled by oxfmt.

### Tests and JS checking

- `tests/harnais.ts` loads the real vendored libs and extension scripts into a happy-dom window (node `vm` context), the way the browser injects them; classes declared at script top level are read with `page.lire("Expression")`. Stub globals the code needs (`Horloge`, `monProfil`, DOM) via the `avant` argument. Tests cover the flood simulation (20 % rule, range, ordering), forum topic parsing, étable profitability, escaping and storage reads. Add a test with any change to these calculations.
- `tsconfig.js.json` checks `public/js` (libs excluded) **opt-in**: only files starting with `// @ts-check` are checked; the rest still provide global class declarations. Non-strict on purpose (looks for unknown names and bad calls, not missing annotations). Library globals are declared `any` in `types/globals-js.d.ts`. Many legacy files fail mainly because of inaccurate JSDoc (`@private` on methods called from other classes, wrong `@param` types): fix the JSDoc before adding `// @ts-check` to a file.
- CI runs `format:check`, `compile`, `check:js` and `test`.

## Architecture — read this before touching WXT or the manifest

This project uses WXT unconventionally. **Do not assume standard WXT conventions apply.**

### srcDir is the repo root, not `src/`

`wxt.config.ts` sets `srcDir: "."`. The actual extension source lives in `public/` (served verbatim by WXT as static assets) and `entrypoints/`.

### Manifest is hand-written, not generated from entrypoints

The standard WXT workflow is to put `entrypoints/content.ts` + `defineContentScript()` and let WXT build the manifest. This project does the opposite: the entire `content_scripts` block (40+ libraries and modules) is declared manually in `wxt.config.ts` under `manifest.content_scripts`. When adding/removing a script, edit `wxt.config.ts` — there is no entrypoint file to update.

### `entrypoints/background.ts` is a required no-op stub

WXT refuses to build without at least one entrypoint (`ERROR No entrypoints found`). Since the real content scripts are declared in the manifest directly, `entrypoints/background.ts` exists only as `defineBackground(() => {})` to satisfy WXT. **Do not delete it** — the build breaks. Deleting it and migrating to entrypoint-style content scripts would be a sizable refactor given the strict load order of the 40+ libs.

### Content script load order matters

Files under `public/js/` are concatenated in the order listed in `wxt.config.ts`. The order is:

1. `js/lib/*` — vendored libraries (jQuery, Highcharts, DataTables, moment, numeral, globalize, clipboard — all loaded as non-module globals)
2. `js/class/*` — domain model classes (`Joueur`, `Alliance`, `Armee`, `Combat`, `Convoi`, `Utils`, etc.)
3. `js/boite/*` — UI widget ("boîte") modules that render the in-game panels
4. `js/page/*` — per-page entry points that hook into specific Fourmizzz URLs (`Attaquer.js`, `Messagerie.js`, `Profil.js`, etc.)
5. `js/content.js` — final bootstrap, declares game-wide constants and wires everything together

Each tier depends on everything above it being present as globals. Reordering will break runtime references.

**Page-scoped library blocks (Fzzz).** The libs are split across several `content_scripts` entries, injected in manifest order before the last entry (classes → content.js): Highcharts (~2 MB) only on `alliance.php*`, `construction.php*` and `messagerie.php*`; Calystène's simulator only on `Ressources.php*`; everything else on every page. Code that may run on other pages must not assume `Highcharts` exists (`content.js` guards `Highcharts.setOptions`). If you add a chart elsewhere, add its page to the Highcharts block. This cut the JS injected on most pages from 4.9 MB to 2.6 MB.

### Single domain

`*://*.fourmizzz.fr/*` (http + https) is the only host in both `host_permissions` and `content_scripts.matches`. The upstream Outiiil v2 also relied on a companion backend at `outiiil.fr` (crowdsourced map data, player/alliance historique, Traceur POST endpoint). That backend is dead — the fork removes all of it in 3.0. If you see mentions of outiiil.fr in old branches, PRs, or issue history, they are stale and should not be re-introduced.

The `data_collection_permissions.required: ["none"]` declaration in the manifest depends on this: the extension no longer transmits any data anywhere, only reads fourmizzz.fr pages locally.

**Exception (Fzzz 1.28) — OUAF convoy tracking.** `http://ouafchaine.fr/*` is an `optional_host_permissions` entry, granted by the player from `public/ouaf-autorisation.html` (permissions.request needs a click in an extension page; opened from the Convois page). Requests to that site go through `entrypoints/background.ts` (`fzzz_ouaf` message: `/api/...` paths only, GET/POST/PUT, refused without the permission) because an https game page cannot call an http site. The player's site password is kept in `chrome.storage.local` (`fzzz_ouafCode`), never in the page's localStorage. The manifest declares `data_collection_permissions.optional: ["authenticationInfo", "websiteContent"]` for this. Logic lives in `public/js/class/OuafSuivi.js` (tested in `tests/ouaf.test.ts`); the site is plain http by design (accepted by the maintainer, shown in Paramètres → Convoi).

## MV3 CSP constraints

The migration from MV2 to MV3 tightened CSP. Two non-obvious patches exist:

- **`public/js/lib/jquery-datetimepicker_1.6.3.js`** replaces the library's original `eval(attrValue)` call with a local `__outiiil_safeParseAttr()` helper (JSON.parse with raw-string fallback). Any future update of this vendored lib must re-apply the patch.
- **`public/js/content.js`** uses `chrome.runtime.getURL` (not the MV2 `chrome.extension.getURL`) and reads `VERSION` dynamically from `chrome.runtime.getManifest().version` instead of hardcoding it.

Firefox exposes `chrome.*` as an alias for `browser.*`, so `chrome.runtime.*` works on both targets without polyfill.

## Firefox publication specifics

- `browser_specific_settings.gecko.id` is `fzzz@numerobis-boop.github.io` — this ID must stay stable across uploads to AMO (changing it breaks updates for installed users).
- `strict_min_version: "142.0"` — Firefox **142** is when `data_collection_permissions` is honored on **Firefox for Android** (desktop got it earlier, but AMO's review surfaces an Android-specific warning if `strict_min_version` is below 142). Lower values let AMO accept the upload but warn that the privacy declaration is ignored on older Firefox/Android.
- AMO requires non-minified sources for review — keep the vendored libs in `public/js/lib/` readable (they currently are).
- AMO requires `browser_specific_settings.gecko.data_collection_permissions` since November 2025 (will be enforced for all extensions in 2026). Currently declared as `required: ["none"]` which is accurate — the extension only reads fourmizzz.fr pages locally. If you add a feature that transmits data to an external server, you MUST update this declaration (values like `websiteContent`, `websiteActivity`, etc.) or AMO will reject the submission.
- `manifest.author` must be a **string** on AMO (not the `{ email: string }` object form that Chrome accepts). WXT's TS types enforce the object form, so the config has a targeted `@ts-expect-error` directive on that line.

## Formatting

oxfmt (Rust-based, Prettier-compatible output) is configured via `.oxfmtrc.json`. Key points:

- **`public/css/lib/` is excluded** too: vendored jQuery UI « humanity » theme (from npm `jquery-ui-themes` 1.12.0), linked by `content.js` from the extension (`chrome.runtime.getURL`) instead of code.jquery.com, so Fzzz makes no third-party request.
- **`public/js/lib/` is excluded** — vendored upstream code (jQuery, Highcharts, DataTables, etc.) must not be reformatted. This ties into the AMO requirement for non-minified, auditable sources and preserves the `__outiiil_safeParseAttr` patch in `jquery-datetimepicker_1.6.3.js`.
- **Pre-commit hook** (husky + lint-staged, config in `package.json`) auto-formats staged files on `git commit`. Installed automatically via the `prepare` script when contributors run `bun install`.
- **CI** (`.github/workflows/ci.yml`) runs `format:check` + `compile` on every push and PR to `main`. Unformatted code fails the check and blocks merge (if branch protection is enabled).

If you modify files that oxfmt would reformat, let the pre-commit hook handle it — don't skip it with `--no-verify`.

Note: oxfmt's `.ts` config loader used to break in CI on Node 20 (version-check bug: 20.20.2 read as not matching `^20.19.0`). CI now runs Node 22 (required by WXT 0.21) so that bug is moot, but there is no reason to switch — stay on `.oxfmtrc.json`.

## Release pipeline

Releasing is split into two independent workflows that both trigger on `v*.*.*` tag push and on `workflow_dispatch` (version read from `package.json`, release `vX.Y.Z` created by the workflow):

- **Firefox auto-update (Fzzz)**: `release-firefox.yml` signs the build as **unlisted** on AMO with `web-ext sign` (secrets `FIREFOX_JWT_ISSUER` / `FIREFOX_JWT_SECRET`), then attaches `fzzz-X.Y.Z.xpi` and `updates.json` to the release. `browser_specific_settings.gecko.update_url` points to `https://github.com/NumeroBis-boop/Fzzz/releases/latest/download/updates.json`: never change this URL (installed copies keep the one they were installed with). The release must stay marked _latest_.
- **Chrome**: the CWS submission step only runs when `CHROME_EXTENSION_ID` is set; otherwise the workflow only attaches the zip.

Inherited Toolzzz description:

- `.github/workflows/release-chrome.yml` builds the Chrome zip, submits it to the Chrome Web Store, and attaches the Chrome zip to the GitHub Release.
- `.github/workflows/release-firefox.yml` builds the Firefox zip, submits it (with the sources zip) to AMO, and attaches the Firefox zip + sources zip to the GitHub Release.

Both run in parallel and upload to the **same** GitHub Release for the tag (`softprops/action-gh-release@v2` upserts), so a failure in one store doesn't block the other and each can be re-run independently.

Submission uses **`wxt submit`** (a thin wrapper around the `publish-extension` package). Both extensions are published as **listed** store entries — users install from the official stores, not from GitHub Releases. The GitHub Release is kept as an archive of the exact artefacts uploaded to the stores (useful for audit and rollback context).

To regenerate credentials locally without committing them, run `bun run wxt submit init` — it walks through the OAuth/JWT flow and writes to `.env.submit` (gitignored). Then copy each value into the corresponding GitHub Secret.

Required GitHub Secrets:

**Chrome Web Store** — API **v2**, with a service account (Google Cloud Console → IAM → Service accounts, JSON key), added to the publisher in the Chrome Web Store developer dashboard.

- `CHROME_EXTENSION_ID` — the public store ID (visible in the store URL)
- `CHROME_PUBLISHER_ID`
- `CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL`
- `CHROME_SERVICE_ACCOUNT_PRIVATE_KEY` — multi-line PEM, keep the quotes in `.env.submit`

**AMO** — from https://addons.mozilla.org/developers/addon/api/key/.

- `FIREFOX_EXTENSION_ID` — the gecko ID (`fzzz@numerobis-boop.github.io`)
- `FIREFOX_JWT_ISSUER`
- `FIREFOX_JWT_SECRET`

(Secret names match the env-var names that `publish-extension` expects, and what `wxt submit init` writes to `.env.submit`.)

Note: the release moved from the CWS v1 API (OAuth refresh token, shut down on 15 October 2026) to v2 in October 2026. `CHROME_API_VERSION: v2` is set in the workflow's env block. To set every secret from `.env.submit` at once: `gh secret set -f .env.submit`.

## Project-specific Claude skills

Trois skills sont versionnés dans `.claude/skills/` et s'auto-chargent quand pertinent :

- **`analyze-fourmizzz`** — méthodologie pour analyser un scénario du jeu via capture HAR : guide la capture côté navigateur, puis génère un rapport structuré du protocole client/serveur. À déclencher quand tu veux comprendre comment une feature du jeu communique avec le backend.
- **`ui-primitives`** — inventaire des classes CSS et patterns réutilisables (tableaux, boutons, jQuery UI widgets, toasts, données globales `monProfil`/`Utils`/`Joueur.rechercher`). À consulter avant d'écrire du HTML/CSS dans une Boite ou une Page — la plupart des choses qu'on serait tenté d'ajouter existent déjà.
- **`release-notes`** — format et méthodologie pour rédiger les release notes Toolzzz (audience joueurs FR, pas devs). Structure 3 sections (Nouveautés / Corrections / Sous le capot), template footer avec liens stores. À consulter avant `gh release create` ou `gh release edit`.

Le dossier `docs/` est gitignored (workspace personnel d'exploration : HAR, scenario reports). Tout ce qui a une valeur durable est promu en skill ou intégré ici.

## AI-assisted work on WXT

WXT publishes LLM-friendly documentation dumps:

- https://wxt.dev/llms.txt — indexed pointer file
- https://wxt.dev/llms-full.txt — full documentation in a single file, optimized for LLM context windows

When a WXT-specific question comes up (config options, CLI flags, lifecycle, module APIs), prefer fetching `llms-full.txt` over scraping individual doc pages — it's the authoritative source in one shot and avoids the cost of multiple fetches.

## Commit Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/).

Format: `<type>(<optional scope>): <description>`

**Types:** `feat` (new feature), `fix` (bug fix), `refactor`, `perf`, `style`, `test`, `docs`, `build`, `ops`, `chore`

**Rules:**

- Use imperative present tense: "add" not "added"
- Do not capitalize first letter
- No period at the end
- Breaking changes: add `!` before `:` (e.g., `feat!: remove endpoint`) and `BREAKING CHANGE:` in footer

**Examples:**

- `feat: add email notifications on new direct messages`
- `fix(popup): prevent save when not connected`
- `build: update dependencies`
- `chore: init`
- `build(release): bump version to 0.2.2`

## Pull request body

Solo project — pas de section « Test plan » dans le body. Les vérifs se font de vive voix entre Claude et le mainteneur avant l'ouverture de la PR. Garder uniquement la section `## Summary` (2-3 bullets concis).

## License

GPL-3.0, inherited from upstream. Any derivative work (including further forks) must remain GPL-3.0 and preserve attribution to the original author (Hraesvelg / Freddy) in the manifest's `author` field and in the README credits.
