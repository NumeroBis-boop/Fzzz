import { defineConfig } from "wxt";

export default defineConfig({
  manifestVersion: 3,
  zip: {
    artifactTemplate: "fzzz-{{version}}-{{browser}}.zip",
    sourcesTemplate: "fzzz-{{version}}-sources.zip",
    // Les sources pour addons.mozilla.org doivent permettre de tout reconstruire,
    // cœur de calcul compris : on part de la racine du dépôt.
    sourcesRoot: "../..",
    excludeSources: ["**/node_modules/**", "**/.output/**", "**/.wxt/**", ".git/**", ".github/**"],
  },
  manifest: {
    name: "Fzzz",
    description: "Outils pour Fourmizzz : heure serveur, arrivées à la seconde, trajets, flood, rentabilité.",
    homepage_url: "https://github.com/NumeroBis-boop/fzzz",
    // storage : réglages et niveaux lus sur les pages ; webRequest : lecture passive
    // de l'en-tête Date des pages chargées par le joueur (aucune requête émise).
    permissions: ["storage", "webRequest"],
    host_permissions: ["*://*.fourmizzz.fr/*"],
    browser_specific_settings: {
      gecko: {
        id: "fzzz@numerobis-boop.github.io",
        strict_min_version: "128.0",
        data_collection_permissions: { required: ["none"] },
      },
      gecko_android: { strict_min_version: "128.0" },
    },
  },
});
