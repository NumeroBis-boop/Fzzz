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
// Ratios de référence : la liste déroulante du lanceur (ceux des tables de Calystène)
const RATIO_CHASSE = [1, 2, 3, 4, 5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10];
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
// Tables de pertes, engendrées par ModeleChasse.tables() (modèle du mécanisme
// de chasse reconstruit sur 5 425 tirages du simulateur du jeu, avec sa marge
// de sécurité) : pour chaque ratio de `de` par pas de `pas`, JSN perdues par
// point de difficulté de Calystène (bouclier 0), min, moyenne, max, et part
// des tirages à 10 % de réplique. tests/pertes-chasse.test.ts les régénère :
// ne pas modifier à la main. Lecture : SimulationChasse.table (interpolation
// linéaire entre deux pas, constante au-delà).
const PERTES_CHASSE = {
  de: 1,
  pas: 0.05,
  min: [
    0.0464888, 0.0464888, 0.0464888, 0.0464888, 0.0464888, 0.0464888, 0.0464888, 0.0464888,
    0.0464888, 0.0464888, 0.0464888, 0.0464888, 0.0464888, 0.0464888, 0.0464888, 0.0464888,
    0.0464888, 0.0464888, 0.0464888, 0.0464888, 0.0464888, 0.0464888, 0.0464888, 0.0464888,
    0.0464888, 0.0464888, 0.0464888, 0.0447856, 0.0437986, 0.0429591, 0.0424452, 0.042381,
    0.0407779, 0.039184, 0.0390194, 0.0387996, 0.0358503, 0.0352492, 0.0352492, 0.0347573,
    0.0167229, 0.0167229, 0.0167229, 0.0162857, 0.0162857, 0.0162857, 0.0162857, 0.0157938,
    0.0157938, 0.0157938, 0.0149285, 0.0145987, 0.0145987, 0.0145987, 0.0143197, 0.0141484,
    0.014127, 0.0137119, 0.0135258, 0.0134257, 0.0129836, 0.0129836, 0.0129247, 0.0124237,
    0.0119137, 0.0119137, 0.0117497, 0.0117497, 0.0115858, 0.0115858, 0.0113375, 0.0113375,
    0.0109846, 0.0108207, 0.0108207, 0.00981057, 0.00981057, 0.00981057, 0.00944662, 0.00944662,
    0.009423, 0.00926825, 0.00916472, 0.00905635, 0.00905635, 0.00899609, 0.00889626, 0.00867372,
    0.00856441, 0.00853845, 0.00853845, 0.00835987, 0.00829658, 0.00814283, 0.00807925, 0.00802999,
    0.00794777, 0.00794777, 0.00781493, 0.00781168, 0.00768295, 0.00761373, 0.00759633, 0.00751366,
    0.00746816, 0.00737773, 0.00736539, 0.00729688, 0.0071941, 0.00715653, 0.00709133, 0.00704984,
    0.00698856, 0.00698856, 0.00698856, 0.00691321, 0.00691321, 0.00681302, 0.00681302, 0.00678301,
    0.00671283, 0.00671283, 0.00671283, 0.00666729, 0.00666729, 0.00666729, 0.00638363, 0.00638363,
    0.00638363, 0.00637192, 0.00629775, 0.00629775, 0.00626915, 0.00617544, 0.00615462, 0.00615462,
    0.00604011, 0.00599509, 0.0059113, 0.00589231, 0.00589231, 0.00589231, 0.0058111, 0.00571091,
    0.00571091, 0.00571091, 0.00571091, 0.00571091, 0.00571091, 0.00571091, 0.00571091, 0.00571091,
    0.00566185, 0.00566185, 0.00554974, 0.00551053, 0.00551053, 0.00546759, 0.00546499, 0.00535309,
    0.00535309, 0.00535309, 0.00535309, 0.00535309, 0.00535309, 0.00535309, 0.00500161, 0.00500161,
    0.00500161, 0.00500161, 0.00500161, 0.00500161, 0.00500161, 0.00500161, 0.00490938, 0.00490938,
    0.00490938, 0.00480919, 0.00475194, 0.00475194, 0.00475194, 0.00475194, 0.00475194, 0.00475194,
    0.00475194, 0.00475194, 0.00475194, 0.00475194, 0.00475194, 0.00475194, 0.00475194, 0.00475194,
    0.00475194, 0.00460881, 0.00460881, 0.00460881, 0.00460881, 0.00460881, 0.00460881, 0.00460881,
    0.00460881,
  ],
  moy: [
    0.0845257, 0.0845257, 0.0845257, 0.0845257, 0.0845257, 0.0845257, 0.0845257, 0.0845257,
    0.0845257, 0.0845257, 0.0845038, 0.0843074, 0.0842821, 0.0842151, 0.0842095, 0.0841829,
    0.084116, 0.0840211, 0.0838579, 0.0836049, 0.0832526, 0.0828002, 0.0823557, 0.0818959,
    0.0814231, 0.0809851, 0.08057, 0.0801756, 0.0797813, 0.0793396, 0.0786948, 0.0780981, 0.0773688,
    0.0764162, 0.0753742, 0.0741489, 0.0726703, 0.0710742, 0.0693863, 0.0673294, 0.0651372,
    0.0628444, 0.0605309, 0.0583444, 0.0561939, 0.0542253, 0.0522835, 0.0505964, 0.0493023,
    0.0479624, 0.0469629, 0.0460109, 0.0453169, 0.0445509, 0.0438563, 0.0430631, 0.0422387,
    0.0413431, 0.0403749, 0.0393066, 0.0382822, 0.0371616, 0.036057, 0.0349651, 0.0339722,
    0.0330321, 0.0321733, 0.031358, 0.0305917, 0.0298881, 0.0292346, 0.028692, 0.0280532, 0.0276149,
    0.0272163, 0.0268443, 0.0265727, 0.0262775, 0.0260255, 0.0257574, 0.0255262, 0.025278, 0.025049,
    0.0247843, 0.0245166, 0.0242251, 0.0239375, 0.0236205, 0.0232971, 0.0228928, 0.0225836, 0.02223,
    0.021858, 0.0214896, 0.0211348, 0.0207626, 0.0204067, 0.0199885, 0.0195425, 0.0190664,
    0.0186261, 0.0181663, 0.0176841, 0.0171926, 0.0167155, 0.0162641, 0.0158184, 0.0153621,
    0.0149479, 0.0145618, 0.0141709, 0.013794, 0.013434, 0.0131269, 0.012814, 0.0125527, 0.0123457,
    0.0121185, 0.0118772, 0.0117009, 0.0115674, 0.0114285, 0.0112916, 0.0111929, 0.0111242,
    0.0110048, 0.0109404, 0.0108779, 0.0108149, 0.0107533, 0.0106863, 0.0106109, 0.0105425,
    0.0104676, 0.0103855, 0.0103053, 0.0102343, 0.010162, 0.0100812, 0.0100102, 0.00993907,
    0.00985513, 0.00977585, 0.00969604, 0.00962001, 0.00954847, 0.00948085, 0.00941724, 0.00936139,
    0.0093098, 0.00926737, 0.00922429, 0.00918329, 0.00914949, 0.00911601, 0.00908558, 0.00905338,
    0.00902214, 0.0089888, 0.0089581, 0.0089248, 0.00889374, 0.0088572, 0.00882295, 0.00878051,
    0.00875458, 0.00872965, 0.00870483, 0.00868357, 0.00865812, 0.00863844, 0.00862009, 0.00860204,
    0.00858621, 0.0085695, 0.00855428, 0.00854111, 0.00853055, 0.00852316, 0.00851893, 0.00851388,
    0.00850957, 0.00850499, 0.00850004, 0.00849642, 0.00849049, 0.0084883, 0.00848602, 0.00848166,
    0.00847837, 0.00847808, 0.0084776, 0.00847605, 0.00846968, 0.00846968, 0.0084694, 0.00846327,
    0.00844523, 0.00844523, 0.00844523, 0.00844523,
  ],
  max: [
    0.172769, 0.172769, 0.172769, 0.172769, 0.172769, 0.172769, 0.172769, 0.172769, 0.172769,
    0.172769, 0.172769, 0.170726, 0.167789, 0.163786, 0.162808, 0.160006, 0.160006, 0.155206,
    0.152853, 0.150488, 0.150488, 0.150488, 0.145353, 0.145353, 0.145353, 0.143222, 0.142825,
    0.141184, 0.141184, 0.141184, 0.140914, 0.139377, 0.137468, 0.136123, 0.134473, 0.132259,
    0.131212, 0.129563, 0.127937, 0.126355, 0.124879, 0.123002, 0.12148, 0.120045, 0.118409,
    0.116568, 0.114984, 0.113308, 0.111999, 0.109927, 0.108572, 0.107064, 0.105476, 0.103783,
    0.102331, 0.10058, 0.0985861, 0.0974389, 0.0957343, 0.0941008, 0.092567, 0.09102, 0.0891384,
    0.087494, 0.0861252, 0.0840947, 0.0827842, 0.0810862, 0.0796901, 0.0777121, 0.0713363,
    0.0705348, 0.0624659, 0.0616055, 0.0603256, 0.0579275, 0.0579, 0.0556008, 0.0552383, 0.0552383,
    0.0528155, 0.0515048, 0.0512961, 0.0500957, 0.0499682, 0.048693, 0.0486458, 0.0478915,
    0.0472988, 0.0447686, 0.0441897, 0.0436356, 0.0430626, 0.0424169, 0.0418414, 0.0411806,
    0.0405355, 0.0398451, 0.0393367, 0.0376726, 0.0374595, 0.0371517, 0.0368947, 0.0366721,
    0.0364439, 0.0362595, 0.0360132, 0.0357509, 0.0355104, 0.0351815, 0.0349703, 0.0347959,
    0.0344952, 0.0342502, 0.0339918, 0.0338169, 0.0335995, 0.0333149, 0.0329674, 0.0328491,
    0.0325717, 0.0323725, 0.0321188, 0.0318927, 0.0316371, 0.0313475, 0.0311287, 0.0307966,
    0.0306984, 0.0304009, 0.0301663, 0.0299395, 0.0295725, 0.0294723, 0.0292312, 0.0289888,
    0.0287201, 0.0284649, 0.0282283, 0.0280057, 0.0277699, 0.0274872, 0.0273044, 0.0268589,
    0.0267414, 0.0265137, 0.0262421, 0.0260109, 0.0258371, 0.0254908, 0.0252254, 0.0251037,
    0.0248344, 0.0245632, 0.0243182, 0.024106, 0.0239065, 0.0236053, 0.0232809, 0.0213408,
    0.0213408, 0.0211404, 0.0211404, 0.0188991, 0.0187391, 0.0185999, 0.0184818, 0.0182621,
    0.0180972, 0.0176292, 0.0173782, 0.0173782, 0.0173698, 0.0173698, 0.0172768, 0.0172768,
    0.0172768, 0.0172768, 0.0172768, 0.0172768, 0.0172768, 0.0172768, 0.0172768, 0.0172768,
    0.0172768, 0.0172768, 0.0172768, 0.0172768, 0.0172768, 0.0172768, 0.0172768, 0.0172768,
    0.0172768, 0.0172768, 0.0172768, 0.0172768, 0.0172768, 0.0172768, 0.0172768, 0.0172768,
    0.0172768,
  ],
  rep10: [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0.00026, 0.00228, 0.00254, 0.00273, 0.00284, 0.00358, 0.00364, 0.00366,
    0.00371, 0.00398, 0.00404, 0.00451, 0.00491, 0.00542, 0.00617, 0.00728, 0.00837, 0.01003,
    0.01184, 0.01398, 0.01663, 0.01909, 0.02196, 0.02511, 0.02826, 0.03149, 0.03486, 0.03821,
    0.04169, 0.04501, 0.04839, 0.05169, 0.0547, 0.05774, 0.06082, 0.06384, 0.0669, 0.07009, 0.07385,
    0.07967, 0.08459, 0.08972, 0.09437, 0.10002, 0.10675, 0.11491, 0.12361, 0.1332, 0.14249,
    0.15499, 0.16542, 0.17884, 0.19417, 0.21013, 0.2261, 0.2435, 0.26057, 0.28164, 0.30441, 0.32905,
    0.35194, 0.37601, 0.40161, 0.42784, 0.45432, 0.47977, 0.50487, 0.53132, 0.55554, 0.57813,
    0.60156, 0.62437, 0.64674, 0.66617, 0.68609, 0.7028, 0.716, 0.73057, 0.74651, 0.75778, 0.7667,
    0.77607, 0.78482, 0.79147, 0.79562, 0.80255, 0.80688, 0.81107, 0.81534, 0.81953, 0.82417,
    0.82941, 0.83417, 0.83947, 0.84534, 0.8511, 0.85624, 0.86151, 0.86747, 0.87271, 0.878, 0.88425,
    0.89023, 0.89627, 0.9021, 0.90759, 0.91283, 0.91774, 0.92209, 0.9261, 0.92943, 0.93281, 0.93605,
    0.93869, 0.94135, 0.94377, 0.94635, 0.94888, 0.95159, 0.9541, 0.95686, 0.95946, 0.96255,
    0.96545, 0.96913, 0.97134, 0.97348, 0.97562, 0.97747, 0.9797, 0.98145, 0.98309, 0.98472,
    0.98617, 0.98771, 0.98913, 0.99037, 0.99137, 0.99208, 0.99249, 0.99298, 0.9934, 0.99385,
    0.99434, 0.9947, 0.99529, 0.99551, 0.99574, 0.99618, 0.99651, 0.99654, 0.99659, 0.99675,
    0.99741, 0.99741, 0.99744, 0.99809, 1, 1, 1, 1,
  ],
};
// Part des tirages à 10 % de réplique aux ratios de référence (libellés de la liste)
const REPLIQUE_CHASSE = RATIO_CHASSE.map(
  (r) => PERTES_CHASSE.rep10[Math.round((r - PERTES_CHASSE.de) / PERTES_CHASSE.pas)],
);
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
const IMG_ACTUALISER = chrome.runtime.getURL("images/actualize_on_01.png");
const IMG_COPIER = chrome.runtime.getURL("images/copy.png");
const IMG_HISTORIQUE = chrome.runtime.getURL("images/historique.png");
const IMG_RADAR = chrome.runtime.getURL("images/radar.png");
const IMG_SPRITE_MENU = chrome.runtime.getURL("images/sprite_menu.png");
const IMG_DOWN = chrome.runtime.getURL("images/down.png");
const IMG_UP = chrome.runtime.getURL("images/up.png");

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
  const debutExtension = performance.now();
  // si l'utilisateur est identifié
  if ($(".boite_connexion_titre:first").text() != "Connexion") {
    // extension désactivée : seule la boîte « Extension OUAF » (pour la réactiver)
    if (document.documentElement.classList.contains("o_desactivee")) {
      new Dock(true).afficher();
      return;
    }
    // Modification du theme jquery humanity
    // Fzzz : thème jQuery UI « humanity » embarqué (paquet npm jquery-ui-themes 1.12.0,
    // MIT) au lieu de code.jquery.com : aucune requête vers un site tiers. Il
    // recouvre celui du jeu (infobulles…) : pas de thème en affichage d'origine
    if (!document.documentElement.classList.contains("o_origineGenerale"))
      $("head").append(
        `<link rel='stylesheet' href='${chrome.runtime.getURL("css/lib/jquery-ui-humanity/jquery-ui.min.css")}'/>`,
      );
    // Chargement du language francais
    numeral.locale("fr");
    moment.locale("fr");
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
    // heure du serveur, puis horloge à la seconde au-dessus de l'encart « S5 Pseudo ».
    // Les pages l'attendent : sinon, sur un PC à l'heure fausse, leurs heures
    // (attaques, chasses partagées) seraient calculées avec l'horloge du PC.
    const horlogePrete = Horloge.initialiser().catch(() => {});
    // « Rétablir l'affichage d'origine » (onglet Général, voir bootstrap.js) : ni
    // thème, ni horloge, ni alerte de ponte, ni encadré Compte+ refait ou radar,
    // ni onglets ajoutés aux menus, ni infobulles des entrepôts
    const origineGenerale = document.documentElement.classList.contains("o_origineGenerale");
    if (Utils.affichage("horloge")) Horloge.afficher();
    // des qu'on les inos constructions/recherches et profil on affiches les outils
    Promise.all([
      monProfil.getConstruction(),
      monProfil.getLaboratoire(),
      monProfil.getProfilCourant(),
    ])
      // lecture impossible (réseau, jeu indisponible) : les outils s'affichent
      // quand même avec les données déjà connues
      .catch((e) => {
        console.error("Fzzz : lecture du profil impossible", e);
        return [null, null, null];
      })
      .then((values) => horlogePrete.then(() => values))
      .then((values) => {
        // Highcharts n'est chargé que sur les pages à graphiques (wxt.config.ts) ;
        // le script utilisateur ne l'exécute qu'après ce fichier
        if (typeof Highcharts !== "undefined")
          Highcharts.setOptions({
            lang: {
              months: MOIS_FR,
              shortMonths: MOIS_RAC_FR,
              weekdays: JOUR_FR,
              decimalPoint: ",",
              thousandsSep: " ",
            },
          });
        // chargement des données du joueur ; une page reçue inattendue ne doit
        // pas empêcher le reste de l'extension de démarrer
        [
          () => values[0] && monProfil.chargerConstruction(values[0]),
          () => values[1] && monProfil.chargerRecherche(values[1]),
          () => values[2] && monProfil.chargerProfil(values[2]),
        ].forEach((charger) => {
          try {
            charger();
          } catch (e) {
            console.error("Fzzz : données du joueur illisibles", e);
          }
        });

        // boite compte plus (recréée par Fzzz hors C+)
        let boiteComptePlus = new BoiteComptePlus();
        if (!origineGenerale) boiteComptePlus.afficher();
        // Fzzz : alerte si la reine ne pond plus ou presque plus
        try {
          if (!origineGenerale) Utils.alertePonte();
        } catch (e) {
          console.error("Fzzz : alerte de ponte", e);
        }
        // Ajout des outils, sous l'encadré Compte+
        let boite = new Dock();
        boite.afficher();
        // Boite radar
        let boiteRadar = new BoiteRadar();
        if (!origineGenerale) boiteRadar.afficher();

        // Onglet "Carte" dans le menu d'alliance — injecté sur toutes les pages
        // tant que le joueur a une alliance (présence du lien Membres = preuve).
        // Lien réel vers ?Membres#carte : sur cette page, PageAlliance intercepte
        // le clic pour un toggle client-side ; depuis ailleurs, navigation normale.
        if (!origineGenerale && $("#menuAlliance .boutonMembres").length) {
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
        if (!origineGenerale && $("#menuFourmiliere").length && !$("#o_ongletCouts").length) {
          $("#menuFourmiliere").append(
            `<li><a id='o_ongletCouts' class='boutonDescription' href='construction.php#cout'><span></span>Coûts</a></li>`,
          );
        }

        // Nouveautés au premier chargement après une mise à jour
        const LAST_SEEN_VERSION_KEY = "outiiil_lastSeenVersion";
        let versionVue = localStorage.getItem(LAST_SEEN_VERSION_KEY);
        if (versionVue !== VERSION) {
          // vue dès l'affichage : la notification ne revient pas à chaque page
          localStorage.setItem(LAST_SEEN_VERSION_KEY, VERSION);
          $.toast({
            heading: `${NOM_EXTENSION} mise à jour`,
            text: Nouveautes.html(versionVue, VERSION),
            hideAfter: false,
            allowToastClose: true,
            showHideTransition: "slide",
            position: { top: 30, right: 100 },
            icon: "info",
          });
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
        $(origineGenerale ? [] : ".tooltip_boite_info").each(function () {
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
            html = `<b>${type}</b><br/>Actuel : ${numeral(value).format()}<br/>Maximum : ${numeral(max).format()} (${percentReel}%)<br/><b class="o_succesClair">Place libre : ${numeral(restant).format()}</b>`;
          } else if (percentAffiche > 0 && value > 0) {
            // Fallback : type non reconnu (ni Nourriture ni Matériaux) ou
            // niveauConstruction non chargé. On retombe sur l'ancien ratio.
            const max = Math.round(value / (percentAffiche / 100));
            const restant = Math.max(0, max - value);
            html = `<b>${type}</b><br/>Actuel : ${numeral(value).format()}<br/>Maximum : ${numeral(max).format()} (${percentAffiche}%)<br/><b class="o_succesClair">Place libre : ${numeral(restant).format()}</b>`;
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
        if (uri != "/commerce.php")
          try {
            sessionStorage.removeItem(CLE_TRI_CONVOIS);
          } catch (e) {}
        // Routing ; une erreur dans le module d'une page reste confinée à cette page.
        // Page dont l'onglet des préférences est réglé sur l'affichage d'origine
        // (classe posée par bootstrap.js) : laissée au jeu
        try {
          switch (true) {
            case document.documentElement.classList.contains("o_originePage"):
              break;
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
              PageAttaquer.ajouterFiltreEnnemis();
              $("#tabEnnemie tr:eq(0) th:eq(5)").after("<th class='centre'>Temps</th>");
              PageAttaquer.tempsEnnemis($("#tabEnnemie tr:gt(0)"));
              break;
            default:
              break;
          }
        } catch (e) {
          console.error("Fzzz : erreur sur cette page", e);
          $.toast({
            ...TOAST_ERROR,
            text: `${NOM_EXTENSION} : une erreur a empêché certains outils de s'afficher sur cette page.`,
          });
        }
        // partages et retraits de floods laissés en suspens par une page quittée trop tôt
        try {
          PartageChasses.reprendre();
        } catch (e) {
          console.error("Fzzz : reprise des partages", e);
        }
        Utils.noterChargement(debutExtension);
      });
  }
})();
