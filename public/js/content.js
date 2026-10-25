/*
 * main.js
 * Hraesvelg
 **********************************************************************/

/**
 * CONSTANTE
 */
const VERSION = chrome.runtime.getManifest().version;
// Classe `o_chrome` posée sur <html> pour scoper les règles CSS qui doivent
// uniquement s'appliquer sous Chromium (cf. radar du Compte+ — Firefox et
// Chrome divergent sur la distribution de largeur en `table-layout: auto`).
if (!navigator.userAgent.includes("Firefox")) document.documentElement.classList.add("o_chrome");
const CONSTRUCTION = [
  "Champignonnière",
  "Entrepôt de Nourriture",
  "Entrepôt de Matériaux",
  "Couveuse",
  "Solarium",
  "Laboratoire",
  "Salle d'analyse",
  "Salle de combat",
  "Caserne",
  "Dôme",
  "Loge Impériale",
  "Etable à pucerons",
  "Etable à cochenilles",
];
const RECHERCHE = [
  "Technique de ponte",
  "Bouclier Thoracique",
  "Armes",
  "Architecture",
  "Communication avec les animaux",
  "Vitesse de chasse",
  "Vitesse d'attaque",
  "Génétique",
  "Acide",
  "Poison",
];
const COUT_CONSTUCTION = [90, 600, 600, 600, 2000, 1400, 1400, 300, 800, 3500, 5000, 1500, 10000];
const COUT_RECHERCHE_POM = [120, 200, 300, 100, 200, 4000, 3000, 3000, 100000, 40000000];
const COUT_RECHERCHE_BOI = [120, 300, 200, 200, 500, 2500, 1000, 10000, 300000, 15000000];
const NOM_UNITE = [
  "Ouvrière",
  "Jeune Soldate Naine",
  "Soldate Naine",
  "Naine d’Elite",
  "Jeune Soldate",
  "Soldate",
  "Concierge",
  "Concierge d’élite",
  "Artilleuse",
  "Artilleuse d’élite",
  "Soldate d’élite",
  "Tank",
  "Tank d’élite",
  "Tueuse",
  "Tueuse d’élite",
];
const NOM_UNITES = [
  "Ouvrières",
  "Jeunes Soldates Naines",
  "Soldates Naines",
  "Naines d’Elites",
  "Jeunes Soldates",
  "Soldates",
  "Concierges",
  "Concierges d’élites",
  "Artilleuses",
  "Artilleuses d’élites",
  "Soldates d’élites",
  "Tanks",
  "Tanks d’élites",
  "Tueuses",
  "Tueuses d’élites",
];
const NOM_RAC_UNITE = [
  "Ouvrière",
  "JSN",
  "SN",
  "NE",
  "JS",
  "S",
  "C",
  "CE",
  "A",
  "AE",
  "SE",
  "Tk",
  "TkE",
  "Tu",
  "TuE",
];
const TEMPS_UNITE = [
  60, 300, 450, 570, 740, 1000, 1410, 1410, 1440, 1520, 1450, 1860, 1860, 2740, 2740,
];
const COUT_UNITE = [5, 16, 20, 26, 30, 36, 70, 100, 30, 34, 44, 100, 150, 80, 90];
const VIE_UNITE = [-1, 8, 10, 13, 16, 20, 30, 40, 10, 12, 27, 35, 50, 50, 55];
const ATT_UNITE = [-1, 3, 5, 7, 10, 15, 1, 1, 30, 35, 24, 55, 80, 50, 55];
const DEF_UNITE = [-1, 2, 4, 6, 9, 14, 25, 35, 15, 18, 23, 1, 1, 50, 55];
const RATIO_CHASSE = [1, 2, 3, 4, 5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10];
const PERTE_MIN_CHASSE = [
  0.103971824, 0.066805442, 0.036854146, 0.014477073, 0.010067247, 0.008361713, 0.00751662,
  0.007060666, 0.006692853, 0.006402339, 0.006090569, 0.0057788, 0.005080623,
];
const PERTE_MOY_CHASSE = [
  0.14183641, 0.089382202, 0.065595625, 0.037509208, 0.024982573, 0.018532185, 0.014281932,
  0.011725921, 0.010437083, 0.009834768, 0.009339662, 0.008844556, 0.008502895,
];
const PERTE_MAX_CHASSE = [
  0.33333334, 0.176739357, 0.113191158, 0.08245817, 0.051342954, 0.036955988, 0.03395735,
  0.032083615, 0.026461955, 0.024588162, 0.021774264, 0.018960366, 0.017190797,
];
// Ordre d'envoi en chasse (indices d'Armee.unite, soit NOM_UNITE moins un) :
// d'abord les unités qui prennent de l'XP — Tu, Tk, A, C, S, JS, SN — puis les
// autres, les JSN en dernier pour combler l'attaque manquante (Calystene 2.00.38).
const ORDRE_XP_CHASSE = [12, 10, 7, 5, 4, 3, 1];
const ORDRE_UNITE_CHASSE = [...ORDRE_XP_CHASSE, 13, 11, 9, 8, 6, 2, 0];
// Faune (cibles de chasse) — stats par espèce, source : http://alliancead2.free.fr/Bestiaire.html (2017).
// `slug` = nom de fichier image dans public/images/faune/, `fdf` = force de frappe (= attaque),
// `vie` = points de vie, `diff` = points de difficulté (cumul utilisé par le serveur pour
// composer la rencontre lors d'une chasse).
const FAUNE = [
  { nom: "Petite araignée", slug: "petite_araignee", fdf: 13, vie: 50, diff: 23.2 },
  { nom: "Araignée", slug: "araignee", fdf: 19, vie: 75, diff: 34.3 },
  { nom: "Chenille", slug: "chenille", fdf: 30, vie: 100, diff: 49.8 },
  { nom: "Criquet", slug: "criquet", fdf: 42, vie: 100, diff: 58.9 },
  { nom: "Guèpe", slug: "guepe", fdf: 50, vie: 140, diff: 76.05 },
  { nom: "Cigale", slug: "cigale", fdf: 70, vie: 200, diff: 107.55 },
  { nom: "Abeille", slug: "abeille", fdf: 115, vie: 220, diff: 144.6 },
  { nom: "Dionée", slug: "dionee", fdf: 70, vie: 700, diff: 201.25 },
  { nom: "Hanneton", slug: "hanneton", fdf: 140, vie: 450, diff: 228.2 },
  { nom: "Scarabée", slug: "scarabee", fdf: 230, vie: 1000, diff: 436 },
  { nom: "Mante religieuse", slug: "mante_religieuse", fdf: 1200, vie: 800, diff: 890.7 },
  { nom: "Lézard", slug: "lezard", fdf: 700, vie: 5000, diff: 1700.75 },
  { nom: "Souris", slug: "souris", fdf: 1400, vie: 5000, diff: 2405.25 },
  { nom: "Mulot", slug: "mulot", fdf: 3000, vie: 8000, diff: 4453.6 },
  { nom: "Alouette", slug: "alouette", fdf: 10000, vie: 30000, diff: 15745.9 },
  { nom: "Rat", slug: "rat", fdf: 50000, vie: 100000, diff: 64282.5 },
  { nom: "Tamanoir", slug: "tamanoir", fdf: 1000000, vie: 5000000, diff: 2032789 },
];
const REPLIQUE_CHASSE = [
  0, 0, 0, 0.016, 0.093, 0.345, 0.577777778, 0.753, 0.837, 0.874, 0.937, 0.96, 0.989,
];
// Image chat, messagerie de fourmizzz
const LISTESMILEY1 = `<img src='images/carte/rien.gif' width='1' height='39'>
      <img src='images/smiley/ant_pouce.gif' onclick='addRaccourciSmiley("message","ant_pouce")'>
       <img src='images/smiley/ant_smile.gif' onclick='addRaccourciSmiley("message","ant_smile")'>
       <img src='images/smiley/ant_biggrin.gif' onclick='addRaccourciSmiley("message","ant_biggrin")'>
       <img src='images/smiley/ant_laugh.gif' onclick='addRaccourciSmiley("message","ant_laugh")'>
       <img src='images/smiley/ant_tongue.gif' onclick='addRaccourciSmiley("message","ant_tongue")'>
       <img src='images/smiley/ant_bye.gif' onclick='addRaccourciSmiley("message","ant_bye")'>
       <img src='images/smiley/ant_cool.gif' onclick='addRaccourciSmiley("message","ant_cool")'>
       <img src='images/smiley/ant_interest.gif' onclick='addRaccourciSmiley("message","ant_interest")'>
       <img src='images/smiley/ant_angel.gif' onclick='addRaccourciSmiley("message","ant_angel")'>
       <img src='images/smiley/ant_smug.gif' onclick='addRaccourciSmiley("message","ant_smug")'>
       <img src='images/smiley/ant_nudgewink.gif' onclick='addRaccourciSmiley("message","ant_nudgewink")'>
       <img src='images/smiley/ant_blink.gif' onclick='addRaccourciSmiley("message","ant_blink")'>
       <img src='images/smiley/ant_unsure.gif' onclick='addRaccourciSmiley("message","ant_unsure")'>
       <img src='images/smiley/ant_shy.gif' onclick='addRaccourciSmiley("message","ant_shy")'>
       <img src='images/smiley/ant_oh.gif' onclick='addRaccourciSmiley("message","ant_oh")'>
       <img src='images/smiley/ant_sleep.gif' onclick='addRaccourciSmiley("message","ant_sleep")'>
       <img src='images/smiley/ant_sad.gif' onclick='addRaccourciSmiley("message","ant_sad")'>
       <img src='images/smiley/ant_mad.gif' onclick='addRaccourciSmiley("message","ant_mad")'>
       <img src='images/smiley/ant_doctor.gif' onclick='addRaccourciSmiley("message","ant_doctor")'>`;
const LISTESMILEY2 = `<img src='images/carte/rien.gif' width='1' height='39'>
      <img onclick='addRaccourciSmiley("message","doctor")' src='images/smiley/doctor.gif'>
       <img onclick='addRaccourciSmiley("message","borg")' src='images/smiley/borg.gif'>
       <img onclick='addRaccourciSmiley("message","pirate")' src='images/smiley/pirate.gif'>
       <img onclick='addRaccourciSmiley("message","sick2")' src='images/smiley/sick2.gif'>
       <img onclick='addRaccourciSmiley("message","asian")' src='images/smiley/asian.gif'>
       <img onclick='addRaccourciSmiley("message","dunce")' src='images/smiley/dunce.gif'>
       <img onclick='addRaccourciSmiley("message","canadian")' src='images/smiley/canadian.gif'>
       <img onclick='addRaccourciSmiley("message","captain")' src='images/smiley/captain.gif'>
       <img onclick='addRaccourciSmiley("message","police")' src='images/smiley/police.gif'>
       <img onclick='addRaccourciSmiley("message","santa")' src='images/smiley/santa.gif'>
       <img onclick='addRaccourciSmiley("message","cook")' src='images/smiley/cook.gif'>
       <img onclick='addRaccourciSmiley("message","farmer")' src='images/smiley/farmer.gif'>
       <img onclick='addRaccourciSmiley("message","smurf")' src='images/smiley/smurf.gif'>
       <img onclick='addRaccourciSmiley("message","gangster")' src='images/smiley/gangster.gif'>
       <img onclick='addRaccourciSmiley("message","king")' src='images/smiley/king.gif'>
       <img onclick='addRaccourciSmiley("message","king2")' src='images/smiley/king2.gif'>
       <img onclick='addRaccourciSmiley("message","pixie")' src='images/smiley/pixie.gif'>
       <img onclick='addRaccourciSmiley("message","pirate2")' src='images/smiley/pirate2.gif'>
       <img onclick='addRaccourciSmiley("message","pirate3")' src='images/smiley/pirate3.gif'>
       <img onclick='addRaccourciSmiley("message","warrior")' src='images/smiley/warrior.gif'>
       <img onclick='addRaccourciSmiley("message","card")' src='images/smiley/card.gif'>
       <img onclick='addRaccourciSmiley("message","egypt")' src='images/smiley/egypt.gif'>
       <img onclick='addRaccourciSmiley("message","fool")' src='images/smiley/fool.gif'>
       <img onclick='addRaccourciSmiley("message","hat")' src='images/smiley/hat.gif'>`;
const LISTESMILEY3 = `<img src='images/carte/rien.gif' width='1' height='39'>
      <img onclick='addRaccourciSmiley("message","dead")' src='images/smiley/dead.gif'>
       <img onclick='addRaccourciSmiley("message","inv")' src='images/smiley/inv.gif'>
       <img onclick='addRaccourciSmiley("message","stretcher")' src='images/smiley/stretcher.gif'>
       <img onclick='addRaccourciSmiley("message","blue")' src='images/smiley/blue.gif'>
       <img onclick='addRaccourciSmiley("message","sick")' src='images/smiley/sick.gif'>
       <img onclick='addRaccourciSmiley("message","love")' src='images/smiley/love.gif'>
       <img onclick='addRaccourciSmiley("message","cupid")' src='images/smiley/cupid.gif'>
       <img onclick='addRaccourciSmiley("message","diablo")' src='images/smiley/diablo.gif'>
       <img onclick='addRaccourciSmiley("message","crossbones")' src='images/smiley/crossbones.gif'>
       <img onclick='addRaccourciSmiley("message","fish")' src='images/smiley/fish.gif'>
       <img onclick='addRaccourciSmiley("message","cupid2")' src='images/smiley/cupid2.gif'>
       <img onclick='addRaccourciSmiley("message","construction")' src='images/smiley/construction.gif'>
       <img onclick='addRaccourciSmiley("message","flower")' src='images/smiley/flower.gif'>
       <img onclick='addRaccourciSmiley("message","drinks")' src='images/smiley/drinks.gif'>
       <img onclick='addRaccourciSmiley("message","burp")' src='images/smiley/burp.gif'>
       <img onclick='addRaccourciSmiley("message","rain")' src='images/smiley/rain.gif'>
       <img onclick='addRaccourciSmiley("message","surf")' src='images/smiley/surf.gif'>
       <img onclick='addRaccourciSmiley("message","baloon")' src='images/smiley/baloon.gif'>
       <img onclick='addRaccourciSmiley("message","sleep2")' src='images/smiley/sleep2.gif'>
       <img onclick='addRaccourciSmiley("message","rip")' src='images/smiley/rip.gif'>
       <img onclick='addRaccourciSmiley("message","scooter")' src='images/smiley/scooter.gif'>
       <img onclick='addRaccourciSmiley("message","moto")' src='images/smiley/moto.gif'>`;
const LISTESMILEY4 = `<img src='images/carte/rien.gif' width='1' height='39'>
      <img onclick='addRaccourciSmiley("message","whip")' src='images/smiley/whip.gif'>
      <img onclick='addRaccourciSmiley("message","shades")' src='images/smiley/shades.gif'>
      <img onclick='addRaccourciSmiley("message","kiss")' src='images/smiley/kiss.gif'>
      <img onclick='addRaccourciSmiley("message","boxer")' src='images/smiley/boxer.gif'>
      <img onclick='addRaccourciSmiley("message","gun")' src='images/smiley/gun.gif'>
      <img onclick='addRaccourciSmiley("message","bross")' src='images/smiley/bross.gif'>
      <img onclick='addRaccourciSmiley("message","whistling")' src='images/smiley/whistling.gif'>
      <img onclick='addRaccourciSmiley("message","showoff")' src='images/smiley/showoff.gif'>
      <img onclick='addRaccourciSmiley("message","noel_vache")' src='images/smiley/noel_vache.gif'>
      <img onclick='addRaccourciSmiley("message","app")' src='images/smiley/app.gif'>
      <img onclick='addRaccourciSmiley("message","book")' src='images/smiley/book.gif'>
      <img onclick='addRaccourciSmiley("message","cake")' src='images/smiley/cake.gif'>
      <img onclick='addRaccourciSmiley("message","dance")' src='images/smiley/dance.gif'>
      <img onclick='addRaccourciSmiley("message","harhar")' src='images/smiley/harhar.gif'>
      <img onclick='addRaccourciSmiley("message","juggle")' src='images/smiley/juggle.gif'>
      <img onclick='addRaccourciSmiley("message","worthy")' src='images/smiley/worthy.gif'>
      <img onclick='addRaccourciSmiley("message","fishing")' src='images/smiley/fishing.gif'>
      <img onclick='addRaccourciSmiley("message","stereo")' src='images/smiley/stereo.gif'>
      <img onclick='addRaccourciSmiley("message","music")' src='images/smiley/music.gif'>
      <img onclick='addRaccourciSmiley("message","prison")' src='images/smiley/prison.gif'>
      <img onclick='addRaccourciSmiley("message","piece")' src='images/smiley/piece.gif'>`;
const LISTESMILEY5 = `<img src='images/carte/rien.gif' width='1' height='39'>
      <img onclick='addRaccourciSmiley("message","noel_etoile")' src='images/smiley/noel_etoile.gif'>
       <img onclick='addRaccourciSmiley("message","noel_snowman10")' src='images/smiley/noel_snowman10.gif'>
       <img onclick='addRaccourciSmiley("message","noel_snowman11")' src='images/smiley/noel_snowman11.gif'>
       <img onclick='addRaccourciSmiley("message","noel_cadeau3")' src='images/smiley/noel_cadeau3.gif'>
       <img onclick='addRaccourciSmiley("message","noel_vache")' src='images/smiley/noel_vache.gif'>
       <img onclick='addRaccourciSmiley("message","santa")' src='images/smiley/santa.gif'>
       <img onclick='addRaccourciSmiley("message","noel_pere")' src='images/smiley/noel_pere.gif'>
       <img onclick='addRaccourciSmiley("message","noel_santa")' src='images/smiley/noel_santa.gif'>
       <img onclick='addRaccourciSmiley("message","noel_bougie")' src='images/smiley/noel_bougie.gif'>
       <img onclick='addRaccourciSmiley("message","noel_chien2")' src='images/smiley/noel_chien2.gif'>
       <img onclick='addRaccourciSmiley("message","noel_chapeau")' src='images/smiley/noel_chapeau.gif'>
       <img onclick='addRaccourciSmiley("message","noel_cadeau")' src='images/smiley/noel_cadeau.gif'>
       <img onclick='addRaccourciSmiley("message","noel_sapin3")' src='images/smiley/noel_sapin3.gif'>
       <img onclick='addRaccourciSmiley("message","noel_snowman4")' src='images/smiley/noel_snowman4.gif'>
       <img onclick='addRaccourciSmiley("message","noel_snowman3")' src='images/smiley/noel_snowman3.gif'>
       <img onclick='addRaccourciSmiley("message","noel_chaussette")' src='images/smiley/noel_chaussette.gif'>
       <img onclick='addRaccourciSmiley("message","noel_flocon")' src='images/smiley/noel_flocon.gif'>
       <img onclick='addRaccourciSmiley("message","noel_snowman5")' src='images/smiley/noel_snowman5.gif'>
       <img onclick='addRaccourciSmiley("message","noel_sapin2")' src='images/smiley/noel_sapin2.gif'>
       <img onclick='addRaccourciSmiley("message","noel_snowman8")' src='images/smiley/noel_snowman8.gif'>
       <img onclick='addRaccourciSmiley("message","noel_bonnet")' src='images/smiley/noel_bonnet.gif'>
       <img onclick='addRaccourciSmiley("message","noel_renne")' src='images/smiley/noel_renne.gif'>
       <img onclick='addRaccourciSmiley("message","noel_renne3")' src='images/smiley/noel_renne3.gif'>`;
const LISTESMILEY6 = `<img src='images/carte/rien.gif' width='1' height='39'>
      <img src='images/smiley/dollar.gif' onclick='addRaccourciSmiley("message","dollar")'>
       <img src='images/smiley/ninja.gif' onclick='addRaccourciSmiley("message","ninja")'>
       <img src='images/smiley/bat.gif' onclick='addRaccourciSmiley("message","bat")'>
       <img src='images/smiley/whistles.gif' onclick='addRaccourciSmiley("message","whistles")'>
       <img src='images/smiley/showoff2.gif' onclick='addRaccourciSmiley("message","showoff2")'>
       <img src='images/smiley/barbarian.gif' onclick='addRaccourciSmiley("message","barbarian")'>
       <img src='images/smiley/magi.gif' onclick='addRaccourciSmiley("message","magi")'>
       <img src='images/smiley/prof.gif' onclick='addRaccourciSmiley("message","prof")'>
       <img src='images/smiley/witch.gif' onclick='addRaccourciSmiley("message","witch")'>
       <img src='images/smiley/pirate4.gif' onclick='addRaccourciSmiley("message","pirate4")'>
       <img src='images/smiley/bicycle.gif' onclick='addRaccourciSmiley("message","bicycle")'>
       <img src='images/smiley/scooter2.gif' onclick='addRaccourciSmiley("message","scooter2")'>
       <img src='images/smiley/police2.gif' onclick='addRaccourciSmiley("message","police2")'>
       <img src='images/smiley/dragon.gif' onclick='addRaccourciSmiley("message","dragon")'>
       <img src='images/smiley/panic.gif' onclick='addRaccourciSmiley("message","panic")'>
       <img src='images/smiley/dog.gif' onclick='addRaccourciSmiley("message","dog")'>
       <img src='images/smiley/plane.gif' onclick='addRaccourciSmiley("message","plane")'>`;
// Image diverses de fourmizzz
const IMG_FLECHE =
  "<img src='images/icone/fleche-bas-claire.png' style='vertical-align:1px;' alt='changer' height='8'>";
const IMG_POMME =
  "<img src='images/icone/icone_pomme.gif' alt='Nourriture' class='o_vAlign' height='18' title='Consommation Journalière' />";
const IMG_MAT = "<img src='images/icone/icone_bois.gif' alt='Materiaux' height='18'/>";
const IMG_VIE = "<img src='images/icone/icone_coeur.gif' class='o_vAlign' height='18' width='18'/>";
const IMG_ATT =
  "<img src='images/icone/icone_degat_attaque.gif'  alt='Dégâts en attaque :' class='o_vAlign'height='18' title='Dégâts en attaque :' />";
const IMG_DEF =
  "<img src='images/icone/icone_degat_defense.gif' alt='Dégâts en défense :' class='o_vAlign' height='18' title='Dégâts en défense :' />";
const IMG_GAUCHE =
  "<img src='images/bouton/fleche-champs-gauche.gif' width='9' height='15' class='o_vAlign'/>";
const IMG_DROITE =
  "<img src='images/bouton/fleche-champs-droite.gif' width='9' height='15' class='o_vAlign'/>";
const IMG_COPY =
  "<img src='images/icone/feuille.gif' class='cliquable' title='Copier/Coller une armée' style='position:relative;top:3px' width='14' height='17'>";
// Image pour l'extension
const IMG_CHANGE = chrome.runtime.getURL("images/change.png");
const IMG_ACTUALISER = chrome.runtime.getURL("images/actualize_on_01.png");
const IMG_CRAYON = chrome.runtime.getURL("images/crayon.gif");
const IMG_CROIX = chrome.runtime.getURL("images/croix.png");
const IMG_COPIER = chrome.runtime.getURL("images/copy.png");
const IMG_HISTORIQUE = chrome.runtime.getURL("images/historique.png");
const IMG_LIVRAISON = chrome.runtime.getURL("images/livraison.png");
const IMG_RADAR = chrome.runtime.getURL("images/radar.png");
const IMG_SPRITE_MENU = chrome.runtime.getURL("images/sprite_menu.png");
const IMG_UTILITY = chrome.runtime.getURL("images/utility.png");
const IMG_DOWN = chrome.runtime.getURL("images/down.png");
const IMG_UP = chrome.runtime.getURL("images/up.png");
const IMG_TOOLZZZ = chrome.runtime.getURL("images/toolzzz.png");

const TOAST_ERROR = {
  heading: "Erreur",
  hideAfter: 3500,
  showHideTransition: "slide",
  position: { top: 30, right: 100 },
  icon: "error",
};
const TOAST_SUCCESS = {
  heading: "Succès",
  hideAfter: 3500,
  showHideTransition: "slide",
  position: { top: 30, right: 100 },
  icon: "success",
};
const TOAST_WARNING = {
  heading: "Attention",
  hideAfter: 3500,
  showHideTransition: "slide",
  position: { top: 30, right: 100 },
  icon: "warning",
};
const TOAST_INFO = {
  heading: "Information",
  hideAfter: 3500,
  showHideTransition: "slide",
  position: { top: 30, right: 100 },
  icon: "info",
};
const EVOLUTION = [...CONSTRUCTION, ...RECHERCHE, "Nourriture", "Materiaux"];
const EFFET = [
  "",
  "Blind",
  "Bounce",
  "Clip",
  "Drop",
  "Explode",
  "Fade",
  "Fold",
  "Highlight",
  "Puff",
  "Pulsate",
  "Scale",
  "Shake",
  "Size",
  "Slide",
];
const METHODE_FLOOD = ["Standard", "Optimisée", "Uniforme", "Dégressive"];
const LIEU = { TERRAIN: 0, DOME: 1, LOGE: 2 };
const LIBELLE_LIEU = ["Terrain de Chasse", "fourmilière", "Loge Impériale"];
const MOIS_FR = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];
const MOIS_RAC_FR = [
  "Janv.",
  "Févr.",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juil.",
  "Août",
  "Sept.",
  "Oct.",
  "Nov.",
  "Déc.",
];
const JOUR_FR = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const DATEPICKER_OPTION = {
  closeText: "Fermer",
  prevText: "Précédent",
  nextText: "Suivant",
  currentText: "Aujourd'hui",
  monthNames: MOIS_FR,
  monthNamesShort: MOIS_RAC_FR,
  dayNames: JOUR_FR,
  dayNamesShort: ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."],
  dayNamesMin: ["D", "L", "M", "M", "J", "V", "S"],
  weekHeader: "Sem.",
  dateFormat: "dd-mm-yy",
  firstDay: "1",
  changeYear: true,
  changeMonth: true,
};

/**
 * Classe principale du projet : appelle les classes en fonction de la route.
 *
 * @class Main
 */
!(function () {
  // si l'utilisateur est identifié
  if ($(".boite_connexion_titre:first").text() != "Connexion") {
    // Modification du theme jquery humanity
    $("head").append(
      "<link rel='stylesheet' href='https://code.jquery.com/ui/1.12.1/themes/humanity/jquery-ui.min.css'/>",
    );
    // Chargement du language francais
    numeral.locale("fr");
    moment.locale("fr");
    Highcharts.setOptions({
      lang: {
        months: MOIS_FR,
        shortMonths: MOIS_RAC_FR,
        weekdays: JOUR_FR,
        decimalPoint: ",",
        thousandsSep: " ",
      },
    });
    // Ajout du tri pour les nombres
    $.fn.dataTable.ext.type.order["quantite-grade-pre"] = (d) => {
      return parseInt(d.replace(/\s/g, ""));
    };
    $.fn.dataTable.ext.type.order["moment-D MMM YYYY-pre"] = (d) => {
      return moment(d.replace(".", ""), "D MMM YYYY", "fr", true).unix();
    };
    $.fn.dataTable.ext.type.order["time-unformat-pre"] = (d) => {
      return Utils.timeToInt(d);
    };

    // Initialisation du profil du joueur en cours
    monProfil = new Joueur({ pseudo: $("#pseudo").text() });
    // chargement des parametre
    monProfil.getParametre();
    // heure du serveur, puis horloge à la seconde au-dessus de l'encart « S5 Pseudo »
    Horloge.initialiser();
    Horloge.afficher();
    // des qu'on les inos constructions/recherches et profil on affiches les outils
    Promise.all([
      monProfil.getConstruction(),
      monProfil.getLaboratoire(),
      monProfil.getProfilCourant(),
    ]).then((values) => {
      // chargement des données du joueur
      if (values[0]) monProfil.chargerConstruction(values[0]);
      if (values[1]) monProfil.chargerRecherche(values[1]);
      if (values[2]) monProfil.chargerProfil(values[2]);

      // Ajout des outils
      let boite = new Dock();
      boite.afficher();
      // boite compte plus
      let boiteComptePlus = new BoiteComptePlus();
      boiteComptePlus.afficher();
      // Boite radar
      let boiteRadar = new BoiteRadar();
      boiteRadar.afficher();

      // Onglet "Carte" dans le menu d'alliance — injecté sur toutes les pages
      // tant que le joueur a une alliance (présence du lien Membres = preuve).
      // Lien réel vers ?Membres#carte : sur cette page, PageAlliance intercepte
      // le clic pour un toggle client-side ; depuis ailleurs, navigation normale.
      if ($("#menuAlliance .boutonMembres").length) {
        $("#menuAlliance .boutonMembres")
          .parent()
          .after(
            `<li><a id='o_ongletCarte' class='boutonCarte' href='alliance.php?Membres#carte'><span></span>Carte</a></li>`,
          );
      }

      // Onglet "Coûts" dans le menu colonie (Fourmilière) — injecté en bout de
      // liste, sur toutes les pages où le menu existe. La feature vit sur
      // construction.php (#cout) ; PageConstruction intercepte le hash pour
      // masquer la simulation native et n'afficher que les courbes. Classe
      // `boutonDescription` réutilisée pour le look graphique cohérent.
      if ($("#menuFourmiliere").length && !$("#o_ongletCouts").length) {
        $("#menuFourmiliere").append(
          `<li><a id='o_ongletCouts' class='boutonDescription' href='construction.php#cout'><span></span>Coûts</a></li>`,
        );
      }

      // Notification "Nouveautés" — toast sticky au 1er chargement après une mise à jour.
      // hideAfter: false → reste visible tant que l'user ne ferme pas / ne clique pas le lien.
      // La version est marquée vue dans les deux cas (close X ou clic lien) pour ne pas
      // ré-apparaître. Si la clé est absente (install avant cette feature), on montre quand
      // même : un nouvel utilisateur a aussi intérêt à voir le changelog une fois.
      const LAST_SEEN_VERSION_KEY = "outiiil_lastSeenVersion";
      if (localStorage.getItem(LAST_SEEN_VERSION_KEY) !== VERSION) {
        // Pointe sur la page des releases (la dernière est en haut), histoire que
        // l'utilisateur puisse aussi parcourir les versions précédentes qu'il aurait
        // potentiellement ratées.
        const releaseUrl = `https://github.com/NumeroBis-boop/fzzz/releases`;
        const markSeen = () => localStorage.setItem(LAST_SEEN_VERSION_KEY, VERSION);
        $.toast({
          heading: "Fzzz mis à jour",
          text: `Nouvelle version <b>v${VERSION}</b>. <a href='${releaseUrl}' target='_blank' rel='noopener' id='o_changelogLink'>Voir les nouveautés</a>`,
          hideAfter: false,
          allowToastClose: true,
          showHideTransition: "slide",
          position: { top: 30, right: 100 },
          icon: "info",
          afterHidden: markSeen,
        });
        $(document).on("click", "#o_changelogLink", markSeen);
      }

      // Enrichit les tooltips Nourriture / Matériaux du bandeau d'info avec la capacité
      // max estimée et la place libre — répond directement à "il me reste combien pour
      // un convoi". Le serveur expose juste le % rempli (arrondi entier) et la valeur
      // courante ; on remonte le max via current / (percent/100), précis à ±0.5%.
      //
      // Approche : on vide le `title` du td (le tooltip natif de la page lit ce title
      // via une content function par défaut, qui retournera donc une chaîne vide → pas
      // de tooltip rendu côté page) et on attache notre propre popover sur mouseenter
      // pour afficher le HTML riche. Tout reste dans l'isolated world, pas d'injection
      // de script main-world.
      // On réutilise les classes du widget jQuery UI tooltip + warning-tooltip de la
      // page pour hériter automatiquement de leur style (couleur, bordure, ombre).
      const $tip = $(
        `<div id='o_boiteInfoTooltip' class='ui-tooltip ui-corner-all ui-widget-shadow ui-widget ui-widget-content warning-tooltip' role='tooltip' style='position:absolute;display:none;z-index:99999;pointer-events:none;'><div class='ui-tooltip-content'></div></div>`,
      ).appendTo("body");
      // Capacité d'entrepôt = 500 + 1200 × 2^niveau (formule identique pour
      // Nourriture et Matériaux, vérifiée sur s1/s2/s3/test via la table de
      // référence toolzzz.fr/couts.php). On préfère la formule au ratio
      // current/percent, qui est inutilisable à 0% affiché et imprécis à
      // bas niveau de remplissage.
      const maxEntrepot = (niveau) => 500 + 1200 * Math.pow(2, niveau);
      const niveauEntrepot = (type) => {
        if (type === "Nourriture") return monProfil.niveauConstruction[1];
        if (type === "Matériaux") return monProfil.niveauConstruction[2];
        return undefined;
      };
      $(".tooltip_boite_info").each(function () {
        const $td = $(this);
        const original = $td.attr("title") || $td.attr("data-tooltip-original-title");
        if (!original || !/rempli à \d+\s*%/.test(original)) return;
        const $val = $td.find(".texte_ligne_boite_info");
        if (!$val.length) return;
        const value = numeral($val.text().trim()).value() ?? 0;
        const match = original.match(/rempli à (\d+)\s*%/);
        if (!match) return;
        const percentAffiche = parseInt(match[1], 10);
        const type = /nourriture/i.test(original)
          ? "Nourriture"
          : /matériaux|materiaux/i.test(original)
            ? "Matériaux"
            : "Stock";
        const niveau = niveauEntrepot(type);
        let html;
        if (niveau !== undefined) {
          const max = maxEntrepot(niveau);
          const restant = Math.max(0, max - value);
          const percentReel = max > 0 ? Math.round((value / max) * 1000) / 10 : 0;
          html = `<b>${type}</b><br/>Actuel : ${numeral(value).format()}<br/>Maximum : ${numeral(max).format()} (${percentReel}%)<br/><b style="color:#27ae60">Place libre : ${numeral(restant).format()}</b>`;
        } else if (percentAffiche > 0 && value > 0) {
          // Fallback : type non reconnu (ni Nourriture ni Matériaux) ou
          // niveauConstruction non chargé. On retombe sur l'ancien ratio.
          const max = Math.round(value / (percentAffiche / 100));
          const restant = Math.max(0, max - value);
          html = `<b>${type}</b><br/>Actuel : ${numeral(value).format()}<br/>Maximum : ${numeral(max).format()} (${percentAffiche}%)<br/><b style="color:#27ae60">Place libre : ${numeral(restant).format()}</b>`;
        } else {
          html = `<b>${type}</b><br/>Actuel : ${numeral(value).format()}`;
        }
        // Vide le title pour neutraliser le tooltip jQuery UI de la page (sa content
        // fn par défaut retourne attr("title") = "" → pas de rendu).
        $td.attr("title", "");
        $td.attr("data-tooltip-original-title", "");
        $td
          .on("mouseenter.toolzzzInfo", () => {
            $tip.find(".ui-tooltip-content").html(html);
            $tip.show();
            const offset = $td.offset();
            $tip.css({
              top: offset.top + $td.outerHeight() / 2 - $tip.outerHeight() / 2,
              left: offset.left + $td.outerWidth() + 10,
            });
          })
          .on("mouseleave.toolzzzInfo", () => {
            $tip.hide();
          });
      });

      let uri = location.pathname,
        page = null;
      // Routing
      switch (true) {
        case uri == "/Reine.php":
          page = new PageReine(boiteComptePlus);
          // Le Compte+ affiche déjà le nombre d'unités. nombreUnites() passe
          // après plus(), qui lit le texte brut des <h2>.
          if (!Utils.comptePlus) page.plus().nombreUnites();
          break;
        case uri == "/construction.php":
          page = new PageConstruction(boiteComptePlus);
          page.executer();
          break;
        case uri == "/laboratoire.php":
          page = new PageLaboratoire(boiteComptePlus);
          page.executer();
          break;
        case uri == "/Ressources.php":
          page = new PageRessource(boiteComptePlus);
          page.executer();
          break;
        case uri == "/Armee.php":
          page = new PageArmee(boiteComptePlus);
          page.executer();
          break;
        case uri == "/commerce.php":
          page = new PageCommerce(boiteComptePlus);
          page.executer();
          break;
        case uri == "/compte.php":
          page = new PageCompte(boiteComptePlus);
          page.executer();
          break;
        case uri == "/messagerie.php":
          page = new PageMessagerie();
          page.executer();
          break;
        case uri == "/alliance.php" && location.search == "":
        case uri == "/chat.php":
          page = new PageChat();
          page.executer();
          break;
        case location.href.indexOf("/alliance.php?forum_menu") > 0:
          // Fzzz : repère la section du forum qui stocke les chasses partagées
          PartageChasses.observerForum();
          break;
        case location.href.indexOf("/alliance.php?Membres") > 0:
          page = new PageAlliance();
          page.executer();
          break;
        case location.href.indexOf("/Membre.php?Pseudo") > 0:
        case uri == "/Membre.php":
          page = new PageProfil(boiteRadar);
          page.executer();
          break;
        case uri == "/classementAlliance.php" &&
          Utils.extractUrlParams()["alliance"] != "" &&
          Utils.extractUrlParams()["alliance"] != undefined:
          page = new PageDescription(boiteRadar);
          page.executer();
          break;
        case location.href.indexOf("/ennemie.php?Attaquer") > 0:
        case location.href.indexOf("/ennemie.php?annuler") > 0:
          page = new PageAttaquer(boiteComptePlus);
          page.executer();
          break;
        case uri == "/ennemie.php" && location.search == "":
          // Affichage des temps de trajet
          $("#tabEnnemie tr:eq(0) th:eq(5)").after("<th class='centre'>Temps</th>");
          $("#tabEnnemie tr:gt(0)").each((i, elt) => {
            let distance = parseInt($(elt).find("td:eq(5)").text());
            $(elt)
              .find("td:eq(5)")
              .after(
                `<td class='centre'>${Utils.intToTime(Math.round(Math.pow(0.9, monProfil.niveauRecherche[6]) * 637200 * (1 - Math.exp(-(distance / 350)))))}</td>`,
              );
          });
          break;
        default:
          break;
      }
    });
  }
})();
