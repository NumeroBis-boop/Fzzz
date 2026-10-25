# Privacy Policy — Toolzzz

**Last updated:** April 2026

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
