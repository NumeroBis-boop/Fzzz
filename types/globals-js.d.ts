/**
 * Bibliothèques chargées en variables globales par le manifeste (public/js/lib),
 * pour la vérification des scripts de l'extension (tsconfig.js.json). Typées
 * `any` : la vérification porte sur le code de Fzzz, pas sur ces bibliothèques.
 */
declare const $: any;
declare const jQuery: any;
declare const moment: any;
declare const numeral: any;
declare const Highcharts: any;
declare const Globalize: any;
declare const ClipboardJS: any;
declare const Clipboard: any;
declare const chrome: any;
/** Profil du joueur connecté, créé par content.js au démarrage. */
declare var monProfil: any;
/** Simulateur de Calystène (public/js/lib), lancé par la page Ressources. */
declare function fzzzLancerCHS2(): void;
/** Noms de types utilisés dans les commentaires JSDoc hérités d'Outiiil. */
type Integer = number;
type integer = number;
type Class = any;
