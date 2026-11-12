# Privacy Policy — Fzzz (« Extension OUAF »)

**Last updated:** November 2026

Fzzz is a fork of Toolzzz. Unlike Toolzzz (its policy is kept below), Fzzz can send data outside the browser in three cases, all tied to the player's alliance. Nothing is sent to the authors of the extension, and there is no analytics or telemetry.

- **Member statistics (since 1.104.0, on by default).** Once a day, at the first game page the player opens, the extension sends the items checked in Préférences → « Partage de données » (TdP, CdF, FdF HB, FdF AB, VA, VC, Puceron, Champignonnière), with the player's pseudo, the day and the extension version, to the Google Apps Script of the alliance's « Stats membres » Google Sheet; since 1.107.0 it sends them again at the first page opened after the level of the player's Champignonnière or Étable à pucerons changes, when that level is shared. The address of that script is read in the alliance's hidden forum topic « Stats membres »: without this topic, nothing is read or sent. The player is told before the first send. An unchecked item is no longer read nor sent; the sheet only learns that the player does not share it.
- **Combat and hunt reports (since 1.88).** When the player clicks « Exporter mes chasses » or « Exporter mes RC » in the Messagerie and, since 1.109.0, without a click for the hunt reports of a player whose role is « Chasseur » (twice a week, at the first game page opened after Wednesday and Sunday 22:00; on by default, announced before the first export, turned off in Préférences → « Partage de données »): the reports of the listed conversations are sent to the Google Apps Script of the alliance's sheet (players listed in the hidden forum topic « Export Google Sheet ») or of the player's own sheet (address kept in the browser).
- **Convoy tracking (since 1.28).** Only for a player who granted access to `ouafchaine.fr` and entered their password of that site on the Convois page: their convoys are sent to that site, over plain http.

## Toolzzz policy (upstream)

## Data Collection

Toolzzz does **not** collect, store, or transmit any personal data to external servers.

## What the extension accesses

- **Fourmizzz game pages**: The extension reads the DOM of pages on `*.fourmizzz.fr` to display its in-game tools (chasse, combat, convoi, alliance, radar, etc.). All processing happens locally in your browser.
- **Local preferences and caches**: Toolzzz stores user settings and gameplay caches in the browser's `localStorage`, scoped to the `fourmizzz.fr` origin. Keys used:
  - `outiiil_parametre` — UI preferences (colors, dock position, toggles)
  - `outiiil_joueur` — local cache of player data viewed in-game
  - `outiiil_evolution` — local history of player stats over time
  - `outiiil_radar` — local radar tracking data
  - `outiiil_boiteActive` — which panel was last open
- **Network requests**: The only requests Toolzzz initiates are to `*.fourmizzz.fr` itself (e.g. `classementAlliance.php`), to fetch in-game data the user is already authenticated to access. No request is sent to any other domain.

## Third-party services

Toolzzz does **not** use any third-party services, analytics, or telemetry.

## Data sharing

We do **not** sell, transfer, or share any user data with third parties. No data ever leaves your browser.

## Source code

Toolzzz is open source under GPL-3.0. The full source is available at <https://github.com/GuiEpi/toolzzz>.

## Contact

If you have questions about this privacy policy, please [open an issue](https://github.com/GuiEpi/toolzzz/issues).
