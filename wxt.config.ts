import { defineConfig } from "wxt";

// https://wxt.dev/api/reference/wxt/interfaces/InlineConfig.html
export default defineConfig({
  srcDir: ".",
  manifestVersion: 3,
  zip: {
    // Depuis WXT 0.21 le zip sources (AMO) est une allowlist stricte : tout ce
    // qui n'est pas listé ici n'est pas envoyé au reviewer. AMO doit pouvoir
    // rebuilder à l'identique → sources + lockfile + config + README (commandes).
    includeSources: [
      "public/**",
      "entrypoints/**",
      "package.json",
      "bun.lock",
      "tsconfig.json",
      "wxt.config.ts",
      "README.md",
      "LICENSE",
    ],
  },
  manifest: {
    // nom affiché ; le nom technique (Fzzz) reste celui du dépôt et de l'identifiant Firefox
    name: "Extension OUAF",
    description: "Outils de l'alliance OUAF pour Fourmizzz (s5), d'après Toolzzz et Outiiil.",
    // version : pas déclarée ici — WXT reprend celle de package.json (source unique,
    // le bump de release ne doit toucher qu'un seul fichier).
    // @ts-expect-error AMO refuse la forme objet; Chrome accepte la string. On s'aligne sur Firefox.
    author: "NumeroBis-boop, d'après Toolzzz (GuiEpi) et Outiiil (Hraesvelg)",
    homepage_url: "https://github.com/NumeroBis-boop/fzzz",
    browser_specific_settings: {
      gecko: {
        id: "fzzz@numerobis-boop.github.io",
        strict_min_version: "142.0",
        // Mises à jour automatiques de la version auto-distribuée (signée par
        // AMO en « non listée ») : Firefox consulte ce fichier, publié avec
        // chaque release GitHub par release-firefox.yml. Adresse figée : les
        // installations existantes gardent celle de la version installée.
        update_url: "https://github.com/NumeroBis-boop/Fzzz/releases/latest/download/updates.json",
        data_collection_permissions: {
          required: ["none"],
          // suivi des convois OUAF (optionnel, au clic) : code de connexion et
          // convois envoyés transmis à ouafchaine.fr
          optional: ["authenticationInfo", "websiteContent"],
        },
      },
      // Déclare la compatibilité Firefox for Android pour qu'AMO marque
      // automatiquement chaque nouvelle version comme dispo sur Android,
      // sans avoir à cocher la case à la main à chaque upload.
      gecko_android: {
        strict_min_version: "142.0",
      },
    },
    icons: {
      48: "images/icons/48.png",
      96: "images/icons/96.png",
      128: "images/icons/128.png",
    },
    action: {
      default_icon: "images/icons/48.png",
    },
    permissions: ["webRequest", "storage"],
    host_permissions: ["*://s5.fourmizzz.fr/*"],
    // site de suivi des convois de la OUAF : accès demandé au premier envoi
    // (page ouaf-autorisation.html), pas à l'installation
    optional_host_permissions: ["http://ouafchaine.fr/*"],
    content_scripts: [
      // Bootstrap au document_start : pose des classes CSS sur <html> dès
      // l'arrivée du HTML, avant le parsing du body. Permet d'éviter le flash
      // de contenu natif (sur construction.php#cout notamment) en laissant
      // outiiil.css cacher la simulation pendant le parse.
      {
        matches: ["*://s5.fourmizzz.fr/*"],
        js: ["js/bootstrap.js"],
        run_at: "document_start",
      },
      {
        matches: ["*://s5.fourmizzz.fr/*"],
        css: ["css/outiiil.css", "css/toasts.css", "css/datatables.css"],
        js: [
          "js/lib/jquery_3.2.1.js",
          "js/lib/jquery-ui_1.12.1.js",
          "js/lib/jquery-ui-touch-punch_0.2.3.js",
          "js/lib/jquery-datetimepicker_1.6.3.js",
          "js/lib/jquery-toast_1.3.1.js",
          "js/lib/globalize_0.1.1.js",
          "js/lib/globalize-locale-fr.js",
          "js/lib/clipboard_1.7.1.js",
        ],
      },
      // Fzzz : bibliothèques lourdes injectées seulement sur les pages qui s'en
      // servent (les blocs sont injectés dans l'ordre du manifeste, avant le code
      // Fzzz/Toolzzz du dernier bloc). Highcharts (~2 Mo) : graphiques de la
      // carte d'alliance, des coûts (construction.php#cout) et des chasses
      // (messagerie).
      {
        matches: [
          "*://s5.fourmizzz.fr/alliance.php*",
          "*://s5.fourmizzz.fr/construction.php*",
          "*://s5.fourmizzz.fr/messagerie.php*",
        ],
        js: [
          "js/lib/highcharts_6.0.7.js",
          "js/lib/highcharts-more.js",
          "js/lib/highcharts-data.js",
          "js/lib/highcharts-stock.js",
        ],
      },
      {
        matches: ["*://s5.fourmizzz.fr/*"],
        js: [
          "js/lib/datatables_1.10.16.js",
          "js/lib/numeral_2.0.6.js",
          "js/lib/numeral-locale-fr.js",
          "js/lib/moment_2.19.1.js",
          "js/lib/moment-locale-fr.js",
          "js/lib/moment-duration-format.js",
        ],
      },
      // simulateur de Calystène (lanceur « Budget de pertes ») : page Ressources seulement
      {
        matches: ["*://s5.fourmizzz.fr/Ressources.php*", "*://s5.fourmizzz.fr/ressources.php*"],
        js: ["js/lib/calystene-chs2_2.00.35.03.js"],
      },
      {
        matches: ["*://s5.fourmizzz.fr/*"],
        js: [
          "js/class/Requetes.js",
          "js/data/couts.js",
          "js/data/menuRapide.js",
          "js/class/Utils.js",
          "js/class/Alliance.js",
          "js/class/Armee.js",
          "js/class/AttaqueLancee.js",
          "js/class/Chasse.js",
          "js/class/Combat.js",
          "js/class/Horloge.js",
          "js/class/Joueur.js",
          "js/class/Nouveautes.js",
          "js/class/OuafSuivi.js",
          "js/class/Parametre.js",
          "js/class/SimulationChasse.js",
          "js/class/TroupesDehors.js",
          "js/boite/ComptePlus.js",
          "js/boite/Radar.js",
          "js/boite/Dock.js",
          "js/boite/Boite.js",
          "js/boite/ImportArmee.js",
          "js/boite/Chasse.js",
          "js/boite/Combat.js",
          "js/boite/Parametres.js",
          "js/boite/Rapport.js",
          "js/page/AllianceFzzz.js",
          "js/page/Alliance.js",
          "js/page/Armee.js",
          "js/page/Attaquer.js",
          "js/page/Chat.js",
          "js/page/CommerceFzzz.js",
          "js/page/Commerce.js",
          "js/page/Compte.js",
          "js/page/Construction.js",
          "js/page/Description.js",
          "js/page/Laboratoire.js",
          "js/page/MessagerieFzzz.js",
          "js/page/Messagerie.js",
          "js/page/PartageChasses.js",
          "js/page/ConvoisForum.js",
          "js/page/Profil.js",
          "js/page/Reine.js",
          "js/page/Ressource.js",
          "js/content.js",
        ],
      },
    ],
    web_accessible_resources: [
      {
        resources: ["images/*", "images/**", "css/*", "css/**", "ouaf-autorisation.html"],
        matches: ["*://s5.fourmizzz.fr/*"],
      },
    ],
  },
});
