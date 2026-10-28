// ==UserScript==
// @name           Fzzz
// @name:fr        Extension OUAF
// @namespace      https://github.com/NumeroBis-boop/Fzzz
// @version        1.56.0
// @description    Outils de l'alliance OUAF pour Fourmizzz (serveur s5).
// @description:fr Outils de l'alliance OUAF pour Fourmizzz (serveur s5).
// @author         Hraesvelg (Outiiil), GuiEpi (Toolzzz), NumeroBis-boop (Fzzz)
// @license        GPL-3.0
// @homepageURL    https://github.com/NumeroBis-boop/Fzzz
// @supportURL     https://github.com/NumeroBis-boop/Fzzz/issues
// @updateURL      https://raw.githubusercontent.com/NumeroBis-boop/Fzzz/main/fzzz.user.js
// @downloadURL    https://raw.githubusercontent.com/NumeroBis-boop/Fzzz/main/fzzz.user.js
// @match          *://s5.fourmizzz.fr/*
// @run-at         document-end
// @noframes
// @grant          GM_info
// @grant          GM_getValue
// @grant          GM_setValue
// @grant          GM_deleteValue
// @grant          GM_listValues
// @grant          GM_xmlhttpRequest
// @grant          GM_addStyle
// @grant          GM_getResourceText
// @connect        ouafchaine.fr
// @resource       fzzzBase https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/ouaf-autorisation.html
// @resource       fzzzCss0 https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/css/outiiil.css
// @resource       fzzzCss1 https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/css/toasts.css
// @resource       fzzzCss2 https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/css/datatables.css
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/userscript/shim.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/bootstrap.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/lib/jquery_3.2.1.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/lib/jquery-ui_1.12.1.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/lib/jquery-ui-touch-punch_0.2.3.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/lib/jquery-datetimepicker_1.6.3.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/lib/jquery-toast_1.3.1.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/lib/globalize_0.1.1.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/lib/globalize-locale-fr.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/lib/clipboard_1.7.1.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/lib/highcharts_6.0.7.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/lib/highcharts-more.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/lib/highcharts-data.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/lib/highcharts-stock.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/lib/datatables_1.10.16.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/lib/numeral_2.0.6.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/lib/numeral-locale-fr.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/lib/moment_2.19.1.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/lib/moment-locale-fr.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/lib/moment-duration-format.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/lib/calystene-chs2_2.00.35.03.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/class/Requetes.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/data/couts.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/data/menuRapide.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/class/Utils.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/class/Alliance.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/class/Armee.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/class/AttaqueLancee.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/class/Chasse.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/class/Combat.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/class/Horloge.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/class/Joueur.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/class/Nouveautes.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/class/OuafSuivi.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/class/Parametre.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/class/SimulationChasse.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/class/TroupesDehors.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/boite/ComptePlus.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/boite/Radar.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/boite/Dock.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/boite/Boite.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/boite/ImportArmee.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/boite/Chasse.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/boite/Combat.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/boite/Parametres.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/boite/Rapport.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/page/AllianceFzzz.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/page/Alliance.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/page/Armee.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/page/Attaquer.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/page/Chat.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/page/CommerceFzzz.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/page/Commerce.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/page/Compte.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/page/Construction.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/page/Description.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/page/Laboratoire.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/page/MessagerieFzzz.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/page/Messagerie.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/page/PartageChasses.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/page/ConvoisForum.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/page/Profil.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/page/Reine.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/page/Ressource.js
// @require        https://cdn.jsdelivr.net/gh/NumeroBis-boop/Fzzz@a5e9f8a0ba8e56b18d7f892ab0ce5bc1f61f2220/public/js/content.js
// ==/UserScript==

// Fichier généré par scripts/userscript.ts : ne pas modifier à la main.
// Le code de Fzzz est dans les @require ci-dessus ; ici, seulement ses feuilles de style.
GM_addStyle(GM_getResourceText("fzzzCss0"));
GM_addStyle(GM_getResourceText("fzzzCss1"));
GM_addStyle(GM_getResourceText("fzzzCss2"));
