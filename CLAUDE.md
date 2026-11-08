# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project context

Fzzz (shown to players as « Extension OUAF » since 1.41: `NOM_EXTENSION` / `TITRE_SYNTHESE` in `Utils.js`, manifest `name`, userscript `@name:fr`; the technical name Fzzz stays for the repo, gecko id, storage keys and userscript `@name`; the hidden forum section is « BDD partagée cachée » since 1.60.6, old names `Fzzz-Chasses` / `Fzzz_Chasses` still recognized, see `FORUM_SECTIONS_CHASSES`) is a fork of [GuiEpi/toolzzz](https://github.com/GuiEpi/toolzzz) (itself a fork of [Hraesvelg/Outiiil](https://github.com/Hraesvelg/Outiiil), GPL-3.0), tuned for an alliance on the s5 server. Toolzzz's history is merged into this repo: pull upstream fixes with `git fetch toolzzz master && git merge toolzzz/master`. Keep the diff with upstream small (rename only user-visible "Toolzzz" strings; keep `outiiil_*` storage keys). Toolzzz is the 3.0+ line of Outiiil, migrated from MV2 to MV3 and bundled with [WXT](https://wxt.dev) for dual Chrome + Firefox publication. Below, "Toolzzz" describes the shared code base; Fzzz's own gecko id is `fzzz@numerobis-boop.github.io` and its default branch is `main`.

### s5 rules — mandatory (see `docs/conformite.md`)

"L'optimisation est autorisée, pas l'automatisation." Never add: a timer that clicks or sends a game action by itself (the player's click is always final — a countdown is fine), periodic requests to the game (they keep the 30-min session alive), automatic re-login, or background page polling. A single click may chain several sends (multi-flood, multi-chasse).

All user-facing strings are in French (game domain vocabulary: ponte, chasse, convoi, alliance, etc.). DataTables tables get the library's texts and export buttons in French by default (`Utils.js`, `tests/tableaux-francais.test.ts`); a table only sets its own wording in `language`. Their CSV export uses « ; » and a UTF-8 BOM, so French Excel opens it in columns with correct accents.

### Maintainer vocabulary

The maintainer describes changes with these words (full guide: the « Lexique Extension OUAF » page shared with the maintainer):

- **page** = a game URL (`commerce.php` = Convois, `alliance.php?Membres` = Membres de l'alliance, `Membre.php?Pseudo=…` = page d'un membre); « page membre » is ambiguous, ask which one.
- **bloc** = a bordered box with a title, from the game (« Convoi ») or the extension (« Récapitulatif », « Mes attaques en cours », pinned under the menu); **titre de bloc** = its title, quoted exactly.
- **bandeau** = a full-width alert line (ponte alert); the maintainer may also say it for a bloc or for table rows, so check.
- **cadre de la page** = the beige central area; « dépasse du cadre » = overflows it to the right.
- **vues** = the buttons switching a table's columns (Standard / Temps de trajet / Floods et chasses en cours).
- **info-bulle** = shown on hover (or tap on phone); **notification** / toast = message that disappears by itself; « pop-up » is ambiguous.
- **encart « S5 Pseudo »**, **encart Compte +**, **boîte « Extension OUAF »** = the left column boxes; **Préférences** = the settings window and its tabs.
- **Lanceur → cible** = direction of a flood (same text on both players' timelines; the sign and colour of the variation do not change).
- When the place or the expected effect is unclear, ask for: page, bloc, element, what happens (click, hover, load), and what must not change. Never infer « comme avant » without checking what « avant » did.
- **lien de l'extension** / « lien pour mettre à jour l'extension » = the userscript link to share with players, https://raw.githubusercontent.com/NumeroBis-boop/Fzzz/main/fzzz.user.js (installs or updates it in Violentmonkey/Tampermonkey). Give it directly, without correcting the term. The Firefox `.xpi` is no longer maintained (see Release pipeline): if it is asked for, say so and give this link.
- When the maintainer uses a wrong or inexact term (menu for onglet, extension for script utilisateur except in the update link above, « pull » for a branch without pull request…), say so at the start of the answer, briefly, with the right term — the maintainer asked for it.

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

**Page-scoped library blocks (Fzzz).** The libs are split across several `content_scripts` entries, injected in manifest order before the last entry (classes → content.js): Highcharts (~2 MB) only on `alliance.php*`, `construction.php*` and `messagerie.php*`; everything else on every page. Code that may run on other pages must not assume `Highcharts` exists (`content.js` guards `Highcharts.setOptions`). If you add a chart elsewhere, add its page to the Highcharts block. This cut the JS injected on most pages from 4.9 MB to 2.6 MB.

### Single domain

`*://s5.fourmizzz.fr/*` (http + https) is the only host in `host_permissions`, `content_scripts.matches` and `web_accessible_resources.matches` (Fzzz 1.42: s5 only; the userscript `@match`, the background clock filter and the shim's clock sampling are restricted the same way, checked by `tests/userscript.test.ts`). The upstream Outiiil v2 also relied on a companion backend at `outiiil.fr` (crowdsourced map data, player/alliance historique, Traceur POST endpoint). That backend is dead — the fork removes all of it in 3.0. If you see mentions of outiiil.fr in old branches, PRs, or issue history, they are stale and should not be re-introduced.

The `data_collection_permissions.required: ["none"]` declaration in the manifest depends on this: the extension no longer transmits any data anywhere, only reads fourmizzz.fr pages locally.

**Exception (Fzzz 1.28) — OUAF convoy tracking.** `http://ouafchaine.fr/*` is an `optional_host_permissions` entry, granted by the player from `public/ouaf-autorisation.html` (permissions.request needs a click in an extension page; opened from the Convois page). Requests to that site go through `entrypoints/background.ts` (`fzzz_ouaf` message: `/api/...` paths only, GET/POST/PUT, refused without the permission) because an https game page cannot call an http site. The player's site password is kept in `chrome.storage.local` (`fzzz_ouafCode`), never in the page's localStorage. The manifest declares `data_collection_permissions.optional: ["authenticationInfo", "websiteContent"]` for this. Logic lives in `public/js/class/OuafSuivi.js` (tested in `tests/ouaf.test.ts`). A convoy's « ✅ Enregistré » state depends only on the forum topic « Convois | pseudo » (maintainer rule, 1.85.8): each convoy sent to the site is noted there with its game id (`#0` when unknown) and, since 1.86, how it was split (`| prévu N | avance N`: part on the planned convoy, part in advance), one line per convoy (`public/js/page/ConvoisForum.js`, `tests/convois-forum.test.ts`, `tests/convois-identiques.test.ts`); the site keeps no game convoy id and its history is never read to decide a state. Sends to the site run one after the other (each reads « Mes convois » and the advances, then writes them). Cancelling a noted convoy with the game's « Annuler » link (Convois page) is remembered (`fzzz_ouafAnnules`); at the next load, if it is gone before its arrival, its own part is removed from the site (« Mes convois »: the site can only reset the sent amount, like its « Annuler l'envoi » button, so the rest is noted again; one advance line of that amount), then its forum line, one only; kept for a retry on failure with each step's progress (a retry neither loses the rest to note again nor removes a second identical line), dropped after 24 h (`tests/convois-annules.test.ts`). Site without answer: a read is dropped after 10 s (a write waits, it may have succeeded), a 5xx counts as an outage, then requests fail at once for a minute, and the Convois page says so in plain text (`tests/ouaf-panne.test.ts`). The site is plain http by design (accepted by the maintainer, shown in Paramètres → Convois).

**Exception — RC export to the alliance's Google Sheet (TEST, maintainer request).** Messagerie buttons « Exporter mes chasses » / « Exporter mes RC » (`public/js/class/ExportRapports.js`, `tests/export-rapports.test.ts`): on click, the listed conversations not yet exported are read one by one (like opening them, « messages précédents » followed), one RC per row (a multi-hunt has one message per expedition), each keyed by its minute and the armies that fought (identical loot lines get a rank). Hunts go to « BDD chasse »; combats and loot lines (« Vol par » / « Butin chez ») to « BDD attaques » or « BDD défenses » by the exporting player's side (maintainer choice: a combat between two members exported by both sides gives one row in each tab). Rows go to the sheet's Apps Script web app (`google-sheet/export-rapports.gs`, `tests/export-sheet-script.test.ts`; it creates the tabs on first use and skips a key already in the tab). Players of `JOUEURS_EXPORT_ALLIANCE` (maintainer list, case ignored) have nothing to set (maintainer rule): whoever manages the sheet pastes the script address once in Préférences → Messagerie (« Enregistrer pour l'alliance »), which stores it in the hidden forum section, topic « Export Google Sheet » (`TITRE_EXPORT_SHEET`; the oldest one if created twice); their extension reads it there at click time (the forum is authoritative when readable; a copy in `chrome.storage.local`, `fzzz_exportSheetAlliance`, serves when it is not), and the field shows it as filled but never displays it. Other players may enter their own sheet's script address, kept only in their browser (`fzzz_exportSheet`). Repeated clicks, a reload during a send, another device, both sides of a combat and a failed batch never duplicate a row (`tests/robustesse-export-historique.test.ts`, with the real script on a simulated sheet, `tests/sheet-simule.ts`). The address is a write capability: never in the code. Requests go through the background (`fzzz_sheet`, optional host permissions script.google.com and script.googleusercontent.com) or the shim (`GM_xmlhttpRequest`, or `GM.xmlHttpRequest` on iOS; `@connect`). The sheet must stay private to the alliance: publishing RCs is forbidden by the s5 rules. Never commit a player's real RC (armies) to this public repo: tests use invented ones.

**Forum tracking topics and their history (TEST).** « Chasses | pseudo », « Floods | pseudo » and « Convois | pseudo » keep only current entries, in their single message: once a topic has a reply its first message can no longer be edited (maintainer observation), so the extension never replies there and the tracking reads only the first message (`PartageChasses.premierMessage`). Past entries (arrived; cancelled ones are not history) move to « Historique <Chasses|Floods|Convois> N | pseudo » topics, one message each, next page past `HISTORIQUE_MAX_CARACTERES`, written before the tracking topic; if that write fails they stay in the tracking topic for the next write (`tests/historique-forum.test.ts`).

### Userscript build (Fzzz)

`fzzz.user.js` (repo root, generated by `bun run userscript`, never edited by hand) is the Tampermonkey/Violentmonkey/Userscripts (Safari iOS) distribution: a header whose `@require` list is every `js/...` entry of `wxt.config.ts`'s `content_scripts`, in order, served by jsDelivr at a fixed commit (`cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@<sha>/public/...`), preceded by `userscript/shim.js`, which reimplements the `chrome.*` calls used by the scripts with `GM_*` APIs (getURL → jsDelivr, storage.local → GM_getValue, OUAF → GM_xmlhttpRequest, passive `Date` header sampling for the clock). Workflow: commit and push the code, then run `bun run userscript` (refuses uncommitted changes in public/, userscript/, wxt.config.ts) and commit `fzzz.user.js` separately. If a script starts using a new `chrome.*` API, add it to the shim (tested in `tests/userscript.test.ts`). Userscripts (iOS) has no `@resource`/`GM_getResourceText`/`GM_addStyle` and only async `GM.getValue`…: the shim then links the CSS from jsDelivr and stores with `GM.*`, and the page-scoped libs are read by synchronous XHR from jsDelivr; keep both paths working.

**Test version « Extension OUAF - TEST »**: a separate userscript (`@name` « Fzzz TEST », own `@namespace`) built from the `test` branch to try changes (Grim's branches included) before release: on `test`, commit and push, then `bun run userscript:test` writes `fzzz-test.user.js` (version = package version + `.AAAAMMJJHHmm`) to commit and push on `test`. The game box shows its name (`FZZZ_NOM_EXTENSION`, read by the shim from `@name:fr`). It shares the game's localStorage and the forum with the released script: players disable « Extension OUAF » while testing. Never merge `fzzz-test.user.js` into `main`.

**Default target = final version (maintainer rule since 1.85.2, replaces « TEST by default » of 1.82.0).** Unless the maintainer says otherwise (« en test », « sur la version TEST »…), every change goes straight to `main` with the usual release steps (version bump, `NOUVEAUTES` entry, checks, diff review, push, `bun run userscript`, commit and push `fzzz.user.js`), then `test` follows main (below). For a change the maintainer wants tried first: commit it on `test`, run the checks, `bun run userscript:test`, commit `fzzz-test.user.js`, push `test`, give the link https://raw.githubusercontent.com/NumeroBis-boop/Fzzz/test/fzzz-test.user.js; no version bump and no `NOUVEAUTES` entry there (the timestamp suffix already makes each build an update). It reaches `main` only on request, by cherry-picking its commits — never merge `test` into `main` (it may hold work not yet released).

**Updates of installed scripts.** Violentmonkey checks once a day (12:00, `DEFAULT_UPDATE_CRON` in its source) and by default only enabled scripts, so a script disabled during a test is not updated; Tampermonkey's interval is in its settings (« Userscript Update »). Since 1.85.2 the « Extension OUAF » box shows « Nouvelle version vX : mettre à jour » (`public/js/class/MiseAJour.js`, `tests/mise-a-jour.test.ts`): it reads the `@version` at the script's own `@downloadURL` on GitHub, at most once an hour, never the game.

**Test follows main (maintainer rule, 1.85.1).** After every publication on `main`, bring `test` up to date right away: merge `main` into `test`, keeping `main`'s version of every file (`test` only adds `fzzz-test.user.js`; work still being tried on `test` goes back on top), then `bun run userscript:test`, commit and push `test`.

### Game time — server clock and Paris time (Fzzz 1.83)

- Every game time (arrival, return, end of a ponte, construction, research, convoy or hunt; any time displayed or shared in the forum) uses the server clock: `Horloge.serveur()` (moment) or `Horloge.maintenant()` (ms), never `moment()` or `Date.now()`, because the PC clock can be wrong. `content.js` starts the page modules only once the stored clock offset is read.
- The PC clock is kept only for local durations measured on that same clock, ids, caches and request pacing. `tests/horloge-pc.test.ts` counts every PC clock read per file: a new one fails until it is classified there, with its reason.
- Times are Paris time: `public/js/class/Fuseau.js` makes it moment-timezone's default zone when the PC is set to another zone (`tests/fuseau.test.ts`).

### Numbers shown to players — French (Fzzz 1.86.2)

- Every number a player sees is written the French way (« 1 234 », « 12,5 % », « 7,2 »): `numeral(n).format(…)` (fr locale set at the top of `content.js`) or `Utils.decimal(n, decimales, facultatives)`. Never `toFixed()`, `String()` or a raw decimal in a template (« 7.2 »), nor `toLocaleString()` / `Intl.NumberFormat()` without a language (they follow the browser's). jQuery UI spinners display and read French by themselves (`Utils.js`).
- `toFixed` only rounds a number kept as a number (`Number(x.toFixed(n))`). `tests/nombres-francais.test.ts` fails on any other `toFixed()`, `toLocaleString()` or `Intl.NumberFormat()` without a language; a raw decimal in a template is not caught by it, so check new displays by hand.

### « Rétablir l'affichage d'origine » — mandatory for every change (Fzzz 1.59)

Each preferences tab (`ONGLETS_PARAMETRE` in `public/js/boite/Parametres.js`) has a « Rétablir l'affichage d'origine » checkbox (`fzzz_origine_<tab>` in localStorage). When it is checked, the pages of that tab must look exactly as the game displays them, and the « Général » tab does the same for everything the extension changes on all pages. The maintainer requires this for every update and new feature:

- **Page → tab mapping**: `ONGLET_PAGE` in `public/js/bootstrap.js`. Before the page is drawn, it sets `o_originePage` (current page's tab checked) and `o_origineGenerale` (Général checked) on `<html>`. A new page that the extension modifies gets a line there and a tab (or joins an existing one), with its `origine` description in `ONGLETS_PARAMETRE`.
- **JS**: page modules are skipped in `content.js` routing when `o_originePage` is set. Anything done on all pages (boxes, menus, tooltips, theme, banners) is gated by `origineGenerale`. Only the « Extension OUAF » box stays, to reopen the preferences.
- **CSS**: a rule whose selector reaches a game element without one of the extension's own classes/ids (`o_…`) must be prefixed `html:not(.o_originePage)` (page-specific) or `html:not(.o_origineGenerale)` (all pages). `tests/origine.test.ts` fails otherwise; its allow-list only holds the extension's utility classes and the pages without a tab yet (alliance members, chat).
- **Check before release**: `bun run build && node scripts/diff-origine.cjs <saved game pages dir>` renders each page without the extension and with every tab on « origine », and lists every game element whose text or style differs (exit 1 if any). Saved pages are not in the repo (player data). Report the result to the maintainer; the game's own stylesheet is missing from saved pages, so a style difference that the game CSS would cover is a false positive to explain, not to hide.

### Phones (Android and iPhone) — mandatory for every change (maintainer rule, 1.85.3)

Players also play on phones: Android (a browser with Violentmonkey or Tampermonkey, e.g. Firefox) and iPhone (Safari with the Userscripts app). Every change must work and look right there too.

- **Two page widths on a phone**: the game's phone layout (its meta viewport is `width=device-width`; `design7.css` switches at 61em/980px and 41em/656px; page about 360–430 px), or « site pour ordinateur » (viewport tag ignored, page of 980 px: the PC layout with its narrowest central frame, about 655 px). A media query on the viewport cannot tell the latter from a PC: size the extension's blocks from their container (`minmax(0, 1fr)`, percentages, `clamp`, `max-width: 100%`), never assume a frame wider than about 650 px.
- **Touch**: no hover (an info-bulle also opens on tap; nothing only reachable by hover, right-click, double-click or keyboard); buttons that send something keep a gap from the game's buttons against mis-taps.
- **iPhone (Userscripts)**: no `@resource`/`GM_addStyle`, async `GM.*` only (see Userscript build).
- **Check**: `bun run build && node scripts/mobile.cjs <saved game pages dir>` (put the game's `design7.css` in that folder) opens each page as Android 412 px, iPhone 390 px, phone 980 px and PC 1300 px, with and without the extension, lists the elements that make the page wider (exit 1 if any) and saves screenshots in `<dir>/captures-mobile` to look at. Compare with the result before the change: a new or wider overflow belongs to the change. Chromium only imitates phones (size, touch, viewport), not the Safari and Firefox engines: say so in the report, and ask the maintainer to try it on a phone when an engine difference matters.

### Release notes in the game (Fzzz 1.50)

After an update, a toast lists the notes of the versions released since the last one the player saw, from `NOUVEAUTES` in `public/js/class/Nouveautes.js` (player-facing French, short). Every version bump needs a new first entry: `tests/nouveautes.test.ts` fails if `NOUVEAUTES[0].version` differs from `package.json`. Do not link the toast to GitHub releases: the latest release there is the signed Firefox build, usually older than the userscript.

## MV3 CSP constraints

The migration from MV2 to MV3 tightened CSP. Two non-obvious patches exist:

- **`public/js/lib/jquery-datetimepicker_1.6.3.js`** replaces the library's original `eval(attrValue)` call with a local `__outiiil_safeParseAttr()` helper (JSON.parse with raw-string fallback). Any future update of this vendored lib must re-apply the patch.
- **`public/js/content.js`** uses `chrome.runtime.getURL` (not the MV2 `chrome.extension.getURL`) and reads `VERSION` dynamically from `chrome.runtime.getManifest().version` instead of hardcoding it.

Firefox exposes `chrome.*` as an alias for `browser.*`, so `chrome.runtime.*` works on both targets without polyfill.

## Firefox publication specifics

Kept for reference: the Firefox build is no longer published (see Release pipeline).

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

**The Firefox build is no longer published (maintainer decision, 1.83.0).** Every player uses the userscript, Firefox included. Do not run `release-firefox.yml` or propose a Firefox release; the last signed build (1.80.3, the GitHub release marked _latest_) stays as it is. The rest of this section describes the former pipeline.

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

## Comments

Other developers read this code and find verbose AI-style comments noisy, and stale ones misleading. Rules:

- Write a comment only for a **why** the code cannot say: a game constraint or quirk, an s5 rule, a workaround for a browser or game bug, a non-obvious formula source. Never paraphrase what the next line does, never narrate the change history ("Fzzz :", "écart avec…", "avant on faisait…") unless it explains a constraint still true today.
- Prefer putting the information in the code: a well-named constant, function or variable over a comment.
- One or two lines; JSDoc only on methods called from other files, with accurate `@param` types.
- When you change code, re-read the comments around it in the same commit: update or delete any that no longer match. A wrong comment is worse than none.
- Cleanups go one file or folder per commit (reviewable diff), tests green at each step; no repo-wide comment rewrite in one go.

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

## Contributing (branches and pull requests)

Two people now change the code: the maintainer (with Claude) and contributors such as Grim (GitHub `GrimLefourbe`).

- Start every session with `git pull origin main`; another person may have pushed since.
- Contributors work on a branch (`feat/…`, `fix/…`) and open a pull request to `main`; CI (`format:check`, `compile`, `check:js`, `test`) must pass. One topic per pull request.
- Pull requests are merged with « Squash and merge », the title in Conventional Commits form (e.g. `feat(chasse): hunt launcher and page rework (#1)`); the contributor then starts the next branch from the updated `main`.
- A contributor's pull request does **not** touch the version (`package.json`), `NOUVEAUTES` (`public/js/class/Nouveautes.js`) or `fzzz.user.js`: the maintainer does these after merging, so two branches never conflict on them. It may add a note in the description to reuse in the release notes.
- Every change still follows the s5 rules and « Rétablir l'affichage d'origine » above, with a test for any calculation it changes.
- **Cross-cutting change** (clock, time zone, a storage key or format, the forum line format, a helper used in many files): search every use first, change them all in the same change, add a test that catches a missed or new use, and tell the maintainer what was changed and what was deliberately left as is (maintainer rule).
- Publishing (maintainer, after merge): bump version + new `NOUVEAUTES` entry, run the checks, commit, push, `bun run userscript`, commit and push `fzzz.user.js`.
- **Before every publication** (final or TEST): review the whole diff since the last published commit (`git diff <last published>..HEAD`, file list then hunks) and check that every changed file and hunk belongs to the intended change; report the result, and anything else found, to the maintainer (maintainer rule).
- Template: `.github/pull_request_template.md`. Body: only `## Summary` (2-3 concise bullets), no « Test plan » section; checks are discussed with the maintainer.

## License

GPL-3.0, inherited from upstream. Any derivative work (including further forks) must remain GPL-3.0 and preserve attribution to the original author (Hraesvelg / Freddy) in the manifest's `author` field and in the README credits.
