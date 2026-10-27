/*
 * Util.js
 * Hraesvelg
 **********************************************************************/

/**
 * Comptes à rebours en cours (cf. Utils.decreaseTime) : id de l'élément →
 * {fin (timestamp ms), format, chaqueSeconde, aZero}.
 */
const COMPTES_A_REBOURS = {};
let intervalleComptesARebours = null;

/**
 * Données globales du projet, de fourmizzz et des fonctions utilisables partout dans le code.
 *
 * @class Utils
 */
// Fzzz : nom de l'extension affiché aux joueurs (le nom technique, Fzzz, reste
// celui du dépôt, des clés de stockage et de l'identifiant Firefox)
const NOM_EXTENSION = "Extension OUAF";
// titre de l'encadré de synthèse recréé hors Compte+ (et de son bascule radar)
const TITRE_SYNTHESE = "Synthèse OUAF";

// Fzzz : affichages ajoutés par l'extension, désactivables dans Paramètres (onglets : ONGLETS_PARAMETRE)
const AFFICHAGES_FZZZ = {
  horloge: "Horloge du serveur au-dessus de l'encart « S5 pseudo »",
  rentabilite:
    "Bandeaux « rentabilité du niveau supérieur » (et Étable à pucerons dans Construction)",
  messagerieCouleurs: "Couleurs des titres par type de message",
  messagerieCopie: "Icônes de copie des rapports",
  messagerieAnalyse: "Boutons « Analyser » sous les rapports",
  trajet: "Temps de trajet",
  syntheseChasses: "Synthèse des chasses en cours",
  lanceurChasse: "Lanceur de chasses",
  listeAttaques: "Liste des attaques en cours (pages Armée et Attaque)",
  floodsRecus: "Floods en cours sur moi",
  profilPartages: "Chasses, floods et évolution du TdC partagés",
};

// Fzzz : couleur des titres de la messagerie par type de message, réglable
// dans Paramètres → Messagerie (couleur vide : celle du jeu)
const COULEURS_MESSAGES = {
  defense: { libelle: "Combat en défense", classe: "o_titreDefense", defaut: "#b42318" },
  attaque: { libelle: "Combat en attaque", classe: "o_titreAttaque", defaut: "#287a36" },
  chasse: { libelle: "Chasse", classe: "o_titreChasse", defaut: "#000000" },
  convoi: { libelle: "Convoi", classe: "o_titreConvoi", defaut: "#7137a8" },
  autre: { libelle: "Autres messages", classe: "o_titreAutre", defaut: "#ffffff" },
};

// Fzzz : affichages de la page Convois, réglables dans Paramètres → Convois
const AFFICHAGES_CONVOIS = {
  convoisInfoEtable: "Ligne « Niveau d'étable, 1 ouvrière peut transporter… »",
  convoisArrondir: "Liens « arrondir… » des quantités de nourriture et de matériaux",
  convoisRetour: "Heure de retour de chaque convoi en cours (hors Compte+)",
  convoisRecherche: "Recherche du destinataire pendant la saisie (hors Compte+)",
  convoisMembres:
    "Tableau « Joueur à livrer » sous les convois en cours (trajet, retour, reste à livrer)",
  convoisSuiviLignes:
    "Suivi OUAF devant chaque convoi : « ✅ Enregistré » ou bouton « 📤 Envoyer au suivi »",
};

// Fzzz : seuils (s) du paramètre « alertePonte », dans l'ordre de ses choix
const SEUILS_ALERTE_PONTE = [0, 900, 1800, 3600, 7200, 14400, 28800];
// « me le rappeler plus tard » : alerte de ponte muette jusqu'à cette date (ms)
const CLE_ALERTE_PONTE_MUETTE = "fzzz_alertePonteMuette";
// fin de la file de ponte lue sur la page Reine : {fin, lu} (ms)
const CLE_FIN_PONTE = "fzzz_finPonteReine";
// une fin de file lue il y a moins de 10 min est crue sans relire la page Reine
const VALIDITE_FIN_PONTE = 10 * 60000;

class Utils {
  /**
   * Renvoie le serveur sur lequel joue le joueur.
   *
   * @static
   * @method serveur
   * @return {String} le serveur en cours.
   */
  static get serveur() {
    return location.hostname.split(".")[0].toUpperCase();
  }
  /**
   * AntLeaks ne référence que le serveur s4 : ailleurs, ses liens mèneraient
   * à des joueurs/alliances homonymes d'un autre serveur.
   *
   * @static
   * @method antleaksDisponible
   * @return {Boolean}
   */
  static get antleaksDisponible() {
    return Utils.serveur === "S4";
  }
  /**
   *
   */
  static get alliance() {
    return $("#tag_alliance").text();
  }
  /**
   * Renvoie si le joueur à du compte plus.
   *
   * @static
   * @method comptePlus
   * @return {Boolean} Vrai si le joueur a du compte plus, faux sinon.
   */
  static get comptePlus() {
    return $("#menuComptePlus a.boutonStatJoueur").length &&
      $("#menuComptePlus a.boutonStatJoueur").text() == "Stat"
      ? true
      : false;
  }
  /**
   * Renvoie le terrain du joueur en cm².
   *
   * @static
   * @method tag
   * @return {Integer} le de nombre de cm².
   */
  static get terrain() {
    return parseInt($("#quantite_tdc").text());
  }
  /**
   * Échappe un texte venu du jeu, du forum ou d'un autre joueur avant de
   * l'insérer comme HTML : sans cela, une ligne de forum contenant une balise
   * serait exécutée dans la page de chaque lecteur.
   *
   * @static
   * @method echapper
   */
  static echapper(texte) {
    return String(texte ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  }
  /**
   * Valeur JSON du localStorage, ou `defaut` si elle est absente, vide ou
   * illisible (une valeur abîmée ne doit pas bloquer l'extension).
   *
   * @static
   * @method lireStockage
   */
  static lireStockage(cle, defaut = {}) {
    try {
      return JSON.parse(localStorage.getItem(cle)) || defaut;
    } catch (e) {
      return defaut;
    }
  }
  /**
   * Renvoie le nombre d'ouvrières.
   *
   * @static
   * @method ouvrieres
   * @return {Integer} le nombre d'ouvriére.
   */
  static get ouvrieres() {
    return parseInt($("#nb_ouvrieres").text());
  }
  /**
   * Renvoie le nombre de nourritures en stock dans l'entrepot.
   *
   * @static
   * @method nourriture
   * @return {Integer} le quantité de nourritures.
   */
  static get nourriture() {
    return parseInt($("#nb_nourriture").text());
  }
  /**
   * Renvoie le nombre de materiaux en stock dans l'entrepot.
   *
   * @static
   * @method materiaux
   * @return {Integer} le quantité de materiaux.
   */
  static get materiaux() {
    return parseInt($("#nb_materiaux").text());
  }
  /**
   * Calcul des quantités de ressources commandées - fdthierry
   */
  static calculQuantite(evo_commande) {
    switch (true) {
      // cas Champi
      case evo_commande == 0:
        return [
          0,
          COUT_CONSTUCTION[evo_commande] *
            Math.pow(1.85, monProfil.niveauConstruction[evo_commande]),
        ];
      // cas construction
      case evo_commande > 0 && evo_commande < 13:
        return [
          0,
          COUT_CONSTUCTION[evo_commande] * Math.pow(2, monProfil.niveauConstruction[evo_commande]),
        ];
      // cas recherche
      case evo_commande >= 13 && evo_commande < 23:
        return [
          COUT_RECHERCHE_POM[evo_commande - 13] *
            Math.pow(2, monProfil.niveauRecherche[evo_commande - 13]),
          COUT_RECHERCHE_BOI[evo_commande - 13] *
            Math.pow(2, monProfil.niveauRecherche[evo_commande - 13]),
        ];
      default:
        return [0, 0];
    }
  }
  /**
   *
   */
  static arrondiQuantite(val) {
    if (val > 10000000000) return Math.floor(val / 1000000000) * 1000000000;
    if (val > 10000000) return Math.floor(val / 1000000) * 1000000;
    if (val > 1000) return Math.floor(val / 1000) * 1000;
    return val;
  }
  /**
   * Formate un nombre en version courte : 950, 12,3k, 1,5M, 2G, 3,2T, puis P et
   * E, que numeral ne connaît pas (il afficherait 1000T).
   *
   * @static
   * @method nombreCourt
   * @param {Number} val
   * @return {String} La chaine formatée.
   */
  static nombreCourt(val) {
    if (Math.abs(val) >= 1e18) return numeral(val / 1e18).format("0.[0]") + "E";
    if (Math.abs(val) >= 1e15) return numeral(val / 1e15).format("0.[0]") + "P";
    return numeral(val).format("0.[0]a");
  }
  /**
   * Durée avec les secondes, toujours affichées : « 8h 05m 03s ».
   *
   * @static
   * @method duree
   * @param {Number} secondes
   * @return {String}
   */
  static duree(secondes) {
    let s = Math.round(secondes),
      j = Math.floor(s / 86400),
      h = Math.floor((s % 86400) / 3600),
      m = Math.floor((s % 3600) / 60),
      deux = (n) => String(n).padStart(2, "0");
    return `${j ? j + "J " : ""}${h}h ${deux(m)}m ${deux(s % 60)}s`;
  }
  /**
   * Formate un nombre entier en temps.
   *
   * @static
   * @method intToTime
   * @param {Integer} val
   * @return {String} La chaine formatée.
   */
  static intToTime(val) {
    if (!val) return "0 sec";
    let temps = moment
      .duration(val, "s")
      .format("Y[A ]d[J ]h[h ]m[m ]s[s]")
      .split(" ")
      .filter((elt) => {
        return parseInt(elt);
      })
      .join(" ");
    // Sous la seconde (une unité rapide avec un haut niveau de ponte) tous les
    // morceaux valent 0 et sont filtrés, ce qui laissait le temps de ponte vide.
    return temps || numeral(val).format("0.[00]") + "s";
  }
  /**
   * Convertit une chaine de caractere en entier.
   *
   * @static
   * @method timeToInt
   * @param {String} val
   * @return {Integer} le nombre de seconde correspondant la chaine.
   */
  static timeToInt(val) {
    let regexp = new RegExp("((\\d+)J ?)?\\s*((\\d+)h ?)?\\s*((\\d+)m ?)?\\s*((\\d+)s)?\\s*", "i"),
      duree = 0,
      sec,
      minute,
      heure,
      jour;
    if ((sec = val.replace(regexp, "$8"))) duree += ~~sec;
    if ((minute = val.replace(regexp, "$6"))) duree += ~~minute * 60;
    if ((heure = val.replace(regexp, "$4"))) duree += ~~heure * 3600;
    if ((jour = val.replace(regexp, "$2"))) duree += ~~jour * 86400;
    return duree;
  }
  /**
   * Minute du RC d'un événement dans `temps` secondes, compté depuis `depart`
   * (par défaut l'heure du serveur ; Horloge.clic() pour une action lancée
   * maintenant, latence comprise).
   *
   * @static
   * @method roundMinute
   * @param {Number} temps secondes
   * @param {Object} depart moment de départ
   * @return {Object} minute du RC
   */
  static roundMinute(temps, depart = Horloge.serveur()) {
    return Utils.minuteRC(moment(depart).add(temps, "s"));
  }
  /**
   * Fzzz : un affichage ajouté par l'extension est-il activé ? Tous le sont
   * par défaut ; le joueur peut les couper dans Paramètres.
   *
   * @static
   * @method affichage
   * @param {String} cle clé de AFFICHAGES_FZZZ
   */
  static affichage(cle) {
    try {
      return localStorage.getItem("fzzz_affichage_" + cle) != "0";
    } catch (e) {
      return true;
    }
  }
  /**
   * Fzzz : couleur des titres d'un type de message (clé de COULEURS_MESSAGES),
   * "" pour garder celle du jeu.
   *
   * @static
   * @method couleurMessage
   * @param {String} type
   */
  static couleurMessage(type) {
    let lue = null;
    try {
      lue = localStorage.getItem("fzzz_couleurMessage_" + type);
    } catch (e) {}
    return lue ?? COULEURS_MESSAGES[type].defaut;
  }
  /**
   * Fzzz : encart repliable. Renvoie le HTML d'un titre cliquable (flèche
   * ▶/▼) suivi de son contenu, replié par défaut ; l'état ouvert/fermé est
   * mémorisé par clé dans le navigateur.
   *
   * @static
   * @method spoiler
   */
  static spoiler(titre, corps, cle, classeTitre = "") {
    let ouvert = false;
    try {
      // déplié par défaut : seul un repli choisi par le joueur est mémorisé
      // (clé « spoiler2 » : les états enregistrés quand les encarts étaient
      // repliés par défaut, en 1.16, sont ignorés)
      ouvert = localStorage.getItem("fzzz_spoiler2_" + cle) != "0";
    } catch (e) {}
    if (!Utils._spoilersActifs) {
      Utils._spoilersActifs = true;
      $(document).on("click", ".o_spoilerTitre", (e) => {
        let $t = $(e.currentTarget),
          $c = $t.next(".o_spoilerCorps"),
          ouvrir = !$c.is(":visible");
        $c.toggle(ouvrir);
        $t.find(".o_spoilerFleche").text(ouvrir ? "▼" : "▶");
        try {
          localStorage.setItem("fzzz_spoiler2_" + $t.data("spoiler"), ouvrir ? "1" : "0");
        } catch (err) {}
      });
    }
    return `<div class='o_spoilerTitre ${classeTitre}' data-spoiler='${cle}'><span class='o_spoilerFleche'>${ouvert ? "▼" : "▶"}</span> ${titre}</div><div class='o_spoilerCorps'${ouvert ? "" : " style='display:none;'"}>${corps}</div>`;
  }
  /**
   * Fzzz : bandeau « Estimer le niveau de rentabilité du niveau supérieur »
   * sous une ligne de Laboratoire ou de Construction, replié par défaut.
   *
   * @static
   * @method ajouterSpoilerRentabilite
   * @param {Object} $ligne ligne .ligneAmelioration du jeu
   * @param {String} id identifiant de la ligne ajoutée
   * @param {String|Function} contenu HTML, ou fonction rendant une promesse de
   *   HTML, appelée à la première ouverture
   */
  static ajouterSpoilerRentabilite($ligne, id, contenu) {
    let charger = typeof contenu == "function" ? contenu : null;
    if (!Utils.affichage("rentabilite")) return;
    $("#" + id).remove();
    $ligne.after(`
      <tr id='${id}' class='o_spoilerLigne'><td colspan='${$ligne.children("td").length || 4}'>
        <div class='o_spoilerCadre'>
          <div class='o_spoilerBandeau'><span class='o_fleche'>▶</span> Estimer le niveau de rentabilité du niveau supérieur</div>
          <div class='o_spoilerContenu' style='display:none'>${charger ? "<p class='small'>Chargement…</p>" : contenu}</div>
        </div>
      </td></tr>`);
    $(`#${id} .o_spoilerBandeau`).click((e) => {
      let $contenu = $(`#${id} .o_spoilerContenu`),
        ouvert = !$contenu.is(":visible");
      $contenu.toggle(ouvert);
      if (ouvert && charger) {
        charger().then((html) => $contenu.html(html));
        charger = null;
      }
      $(e.currentTarget)
        .toggleClass("o_ouvert", ouvert)
        .find(".o_fleche")
        .text(ouvert ? "▼" : "▶");
    });
  }
  /**
   * Données de la page Reine : ouvrières totales (#armee_initial, convois
   * compris) et armée complète par unité (#armee_initial1 à 14, dans l'ordre
   * de NOM_UNITE : garnison et troupes parties comprises).
   *
   * Une seule lecture par chargement de page, partagée (Laboratoire :
   * rentabilité Armes et Étable), ou directement dans la page Reine.
   *
   * @static
   * @method lireReine
   * @return {Promise} {ouvrieres, brut, reine, raison}
   */
  static lireReine() {
    if (Utils._reine) return Utils._reine;
    let defaut = (raison) => ({ ouvrieres: null, brut: null, reine: false, raison: raison }),
      analyser = ($page) => Utils.analyserReine($page);
    if (/^\/Reine\.php/i.test(location.pathname)) {
      try {
        Utils._reine = Promise.resolve(analyser($(document.body)));
      } catch (e) {
        Utils._reine = Promise.resolve(defaut(e.message));
      }
      return Utils._reine;
    }
    Utils._reine = Promise.resolve($.get(location.origin + "/Reine.php")).then(
      (html) => {
        try {
          return analyser(Utils.parseHtml(html));
        } catch (e) {
          return defaut(e.message);
        }
      },
      (jqXHR) =>
        defaut(
          jqXHR && jqXHR.status == 503
            ? "le jeu traitait une autre action"
            : jqXHR && jqXHR.statusText == "timeout"
              ? "pas de réponse du jeu"
              : `erreur ${(jqXHR && jqXHR.status) || "réseau"}`,
        ),
    );
    return Utils._reine;
  }
  /**
   * @static
   * @method analyserReine
   * @param {Object} $page page Reine (jQuery)
   * @return {Object} {ouvrieres, brut: [{nombre, unite}], reine: true}
   */
  static analyserReine($page) {
    let nombre = (id) =>
        parseInt(
          $page
            .find("#" + id)
            .text()
            .replace(/\D/g, ""),
        ),
      ouvrieres = nombre("armee_initial");
    if (isNaN(ouvrieres)) throw new Error("nombre d'ouvrières absent de la page");
    // Les champs armee_initial1, 2… suivent les unités débloquées dans l'ordre
    // du jeu : le Concierge d'élite et le Tank d'élite, débloqués plus tard,
    // sont sautés tant qu'ils ne le sont pas (12 champs au lieu de 14). Le
    // numéro ne désigne donc pas une unité fixe : on garde les valeurs dans
    // l'ordre, et le nom de l'unité quand la ligne le donne.
    let brut = [];
    for (let i = 1; $page.find("#armee_initial" + i).length; i++)
      brut.push({
        nombre: nombre("armee_initial" + i) || 0,
        unite: Utils.uniteDepuisLibelle(
          $page
            .find("#armee_initial" + i)
            .closest("tr")
            .text(),
        ),
      });
    return { ouvrieres: ouvrieres, brut: brut, reine: true };
  }
  /**
   * Indice (dans NOM_UNITE) de l'unité nommée dans un texte, ou -1. Le nom
   * le plus long l'emporte (« Artilleuse d'élite » avant « Artilleuse »).
   *
   * @static
   * @method uniteDepuisLibelle
   * @param {String} texte
   * @return {Number}
   */
  static uniteDepuisLibelle(texte) {
    let t = String(texte)
        .toLowerCase()
        .replace(/[’`]/g, "'")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""),
      noms = [
        "jeune soldate naine",
        "soldate naine",
        "naine d'elite",
        "jeune soldate",
        "soldate",
        "concierge",
        "concierge d'elite",
        "artilleuse",
        "artilleuse d'elite",
        "soldate d'elite",
        "tank",
        "tank d'elite",
        "tueuse",
        "tueuse d'elite",
      ],
      meilleur = -1;
    noms.forEach((nom, i) => {
      // pluriel accepté (« Tanks d'élites »), mots entiers
      let motif = new RegExp(
        "(^|[^a-z])" +
          nom
            .split(" ")
            .map((m) => m + "s?")
            .join(" ") +
          "($|[^a-z])",
      );
      if (motif.test(t) && (meilleur < 0 || nom.length > noms[meilleur - 1].length))
        meilleur = i + 1;
    });
    return meilleur;
  }
  /**
   * Armée complète par unité (14 valeurs, ordre d'Armee.unite) d'après la
   * page Reine. Chaque champ est attribué à une unité : par le nom lu sur sa
   * ligne, sinon par rang parmi les unités débloquées (lignes d'Armee.php,
   * dans l'ordre du jeu), sinon, avec 14 champs, par numéro.
   *
   * @static
   * @method armeeReine
   * @param {Array} brut voir analyserReine
   * @param {Array} debloquees indices NOM_UNITE des lignes d'Armee.php, ou null
   * @return {Array|null} null si l'attribution est impossible
   */
  static armeeReine(brut, debloquees) {
    if (!brut || !brut.length) return null;
    let unites = new Array(14).fill(0),
      valides = (liste) =>
        liste &&
        liste.length == brut.length &&
        liste.every((n) => n > 0) &&
        new Set(liste).size == liste.length,
      parNom = brut.map((b) => b.unite),
      indices = valides(parNom)
        ? parNom
        : valides(debloquees)
          ? debloquees
          : brut.length == 14
            ? brut.map((b, i) => i + 1)
            : null;
    if (!indices) return null;
    brut.forEach((b, k) => (unites[indices[k] - 1] += b.nombre));
    return unites;
  }
  /**
   * Nombre total d'ouvrières, y compris celles parties en convoi, que le
   * compteur de l'en-tête ne compte pas : lu dans la page Reine. À défaut,
   * compteur de l'en-tête, avec la raison de l'échec.
   *
   * @static
   * @method ouvrieresTotales
   * @return {Promise} {total, reine, raison}
   */
  static ouvrieresTotales() {
    return Utils.lireReine().then((r) =>
      r.reine
        ? { total: r.ouvrieres, reine: true }
        : { total: Utils.ouvrieres || 0, reine: false, raison: r.raison },
    );
  }
  /**
   * Bandeau de rentabilité de l'Étable : la page Reine est lue au chargement,
   * le contenu est affiché à l'ouverture du bandeau.
   *
   * @static
   * @method ajouterRentabiliteEtable
   */
  static ajouterRentabiliteEtable($ligne) {
    if (!Utils.affichage("rentabilite")) return;
    let html = Utils.ouvrieresTotales().then(Utils.htmlRentabiliteEtable);
    Utils.ajouterSpoilerRentabilite($ligne, "o_rentabiliteEtableLigne", () => html);
  }
  /**
   * Contenu du bandeau de rentabilité de l'Étable à pucerons, affiché sous
   * l'Étable (Construction) et sous Communication avec les animaux (Laboratoire).
   *
   * Le niveau n exige Communication avec les animaux au niveau n + 2 ; les
   * ouvrières sacrifiées (Cₙ) sont celles des niveaux de Communication qui
   * manquent (80 × 2^(k−1) pour le niveau k). Chaque ouvrière disponible pour
   * les convois transporte 10 + 0,5 × n ressources. Avec O ouvrières
   * disponibles pour les convois (ouvrières − TdC exploité) :
   *
   *   ΔK = 0,5 × O − Cₙ × (10 + 0,5 × n)   rentable si ΔK > 0,
   *   soit au moins Cₙ × (20 + n) + 1 ouvrières disponibles.
   *
   * Sur plusieurs niveaux, chaque sacrifice est déduit de O avant le suivant.
   *
   * @static
   * @method htmlRentabiliteEtable
   * @param {Object} ouvrieres {total, reine} (voir ouvrieresTotales)
   * @return {String} HTML
   */
  static htmlRentabiliteEtable({ total, reine, raison = "" }) {
    let tdc = Math.min(total, Utils.terrain || 0),
      dispo = total - tdc,
      niveau = monProfil.niveauConstruction[11] || 0,
      communication = parseInt(monProfil.niveauRecherche[4]),
      coutComm = (k) => 80 * Math.pow(2, k - 1),
      capacite = (o, n) => o * (10 + 0.5 * n),
      fmt = (n) => numeral(Math.round(n)).format(),
      lignes = [],
      o = dispo;
    // niveau de Communication inconnu : on suppose le minimum requis aujourd'hui
    if (isNaN(communication)) communication = niveau ? niveau + 2 : 0;
    for (let k = 0, n = niveau + 1; k < 20; k++, n++) {
      let requis = n + 2,
        sacrifiees = 0;
      for (let c = communication + 1; c <= requis; c++) sacrifiees += coutComm(c);
      let gain = 0.5 * o - sacrifiees * (10 + 0.5 * n),
        minimum = sacrifiees * (20 + n) + 1,
        rentable = gain > 0;
      lignes.push(`<tr><td class='left'>Étable ${n} <span class='small'>(Communication ${requis})</span></td>
        <td class='right'>${fmt(sacrifiees)}</td>
        <td class='right'>${fmt(capacite(Math.max(0, o - sacrifiees), n))}</td>
        <td class='right ${rentable ? "green" : "red"}'>${gain >= 0 ? "+" : ""}${fmt(gain)}</td>
        <td class='right ${rentable ? "green" : "red"}'>${rentable ? "rentable" : fmt(minimum - o) + " ouvrières"}</td></tr>`);
      if (!rentable) break;
      o -= sacrifiees;
      communication = Math.max(communication, requis);
    }
    return `<p><strong>Ouvrières : ${fmt(total)}</strong>${
      reine
        ? ""
        : ` <span class='small red'>(Reine.php illisible${raison ? ` : ${Utils.echapper(raison)}` : ""} ; ouvrières en convoi non comptées)</span>`
    } · exploitées sur le TdC : ${fmt(tdc)} ·
        <strong>disponibles pour les convois : ${fmt(dispo)}</strong></p>
      <p class='small'>Capacité de convoi actuelle (étable ${niveau}) : ${fmt(capacite(dispo, niveau))} ressources par convoi.</p>
      <table cellspacing='0'>
        <tr class='gras'><td class='left'>Niveau visé</td><td class='right'>Ouvrières sacrifiées</td><td class='right'>Capacité de convoi après</td><td class='right'>Gain de capacité</td><td class='right'>Il manque</td></tr>
        ${lignes.join("")}
      </table>`;
  }
  /**
   * Variation « +1 234 (+5,2 %) » colorée : vert si elle est favorable au
   * joueur, rouge sinon. `inverse` pour les stats de l'ennemi, dont une baisse
   * est favorable.
   *
   * @static
   * @method variation
   * @param {Number} diff écart
   * @param {Number} base valeur de départ
   * @param {Boolean} inverse vrai si une baisse est favorable
   * @return {String} HTML
   */
  static variation(diff, base, inverse = false) {
    let signe = diff > 0 ? 1 : diff < 0 ? -1 : 0,
      classe = (inverse ? -signe : signe) > 0 ? "o_varPos" : signe ? "o_varNeg" : "",
      // pourcentage calculé ici : le format « % » de numeral est faux en français
      p = base ? (diff / base) * 100 : 0,
      pct = base ? ` (${p > 0 ? "+" : ""}${p.toFixed(1).replace(".", ",")} %)` : "";
    return `<span class='${classe}'>${numeral(diff).format("+0,0")}${pct}</span>`;
  }
  /**
   * Le RC est daté de la minute qui suit l'impact, à la seconde près :
   * 17h23:12 → 17h24, et 17h23:00 pile → 17h23.
   *
   * @static
   * @method minuteRC
   * @param {Object} impact moment de l'impact
   * @return {Object} minute du RC
   */
  static minuteRC(impact) {
    return moment(Math.ceil(Math.floor(moment(impact).valueOf() / 1000) / 60) * 60000);
  }
  /**
   * Sur construction.php / laboratoire.php, remplace les blocs natifs
   * `<strong>…</strong><br><small>…</small>` qui annoncent les évolutions
   * en cours par un petit tableau récap (Nom / Temps restant / Terminé le
   * / Annuler).
   *
   * Le span de countdown natif est *déplacé* dans la nouvelle cellule, pas
   * recréé, pour que le `setTimeout` natif de Fourmizzz (cf. fonction `reste()`
   * du jeu) continue à mettre l'élément à jour en temps réel — il accède le
   * span par son ID, qui reste valide tant qu'il est dans le DOM.
   *
   * @static
   * @method tableauEvolution
   * @param {String} typeLabel Texte de l'entête de la 1re colonne (ex. "Recherche").
   * @param {String} [sectionH2] Texte du h2 affiché au-dessus du tableau
   *                             (ex. "Construction" / "Laboratoire"). Omis = pas de h2.
   */
  static tableauEvolution(typeLabel, sectionH2) {
    let $strongs = $("#centre > strong");
    if (!$strongs.length) return;
    // `tableau_leger` = classe native Fourmizzz utilisée par le tableau des
    // pontes sur Reine.php — donne le même look visuel que le récap ponte.
    let $table = $(
      `<table id='o_evolutionEnCours' class='tableau_leger o_maxWidth' cellspacing='0'>
        <caption class='gras left'>${typeLabel}(s) en cours:</caption>
        <thead><tr>
          <th class='left'>${typeLabel}</th>
          <th>Temps restant</th>
          <th>Terminé le</th>
          <th></th>
        </tr></thead>
        <tbody></tbody>
      </table>`,
    );
    // Container caché pour les spans natifs : la chaîne setTimeout du jeu
    // les met à jour via getElementById, on les déplace ici pour qu'elle
    // continue à tourner sans erreur (au lieu de les supprimer avec le strong
    // → null.innerHTML → throw). Le contenu de ces spans n'est plus affiché.
    let $hidden = $("#o_resteHidden");
    if (!$hidden.length)
      $hidden = $("<div id='o_resteHidden' style='display:none'></div>").appendTo("body");
    let toastErrors = [],
      validRows = 0;
    $strongs.each((_, elt) => {
      let $strong = $(elt),
        $nativeSpan = $strong.children("span").first(),
        $link = $strong.children("a").last(),
        // `.clone()` puis `.children().remove()` pour récupérer le préfixe
        // "- Name level (terminé|se termine) dans:" sans contaminer avec le
        // contenu du <script> inline (sinon `.text()` récursif renvoie le
        // body du script, ex. `reste(22, "batiment_…");`)
        $cloneText = $strong.clone(),
        scriptText = $strong.children("script").text(),
        secMatch = scriptText.match(/reste\((\d+),/);
      $cloneText.children().remove();
      // Pas de chrono `reste(N, …)` = ce n'est pas une évolution réelle mais
      // un message d'erreur du jeu (ex. "Prerequis non valide." quand la file
      // d'attente C+ tente de lancer une construction dont les prérequis ne
      // sont pas remplis). On évite la ligne 0s/maintenant dans le tableau,
      // on relaye le texte en toast à la fin.
      if (!secMatch) {
        let errText = $cloneText
          .text()
          .replace(/^\s*-\s*/, "")
          .trim();
        if (errText) toastErrors.push(errText);
        return;
      }
      let seconds = parseInt(secMatch[1]),
        endDate = Utils.roundMinute(seconds).format("D MMM YYYY à HH[h]mm");
      // Construction = "...se termine dans :" ; Recherche = "...terminé dans:".
      let name = $cloneText
        .text()
        .replace(/^\s*-\s*/, "")
        .replace(/\s+(?:terminé|se\s+termine).*$/i, "")
        .trim();
      // On déplace le span natif dans le container caché (préserve l'ID) et
      // on monte notre propre span avec un format compact via Utils.intToTime.
      $nativeSpan.appendTo($hidden);
      let toolzzzId = "o_evoTime_" + ($nativeSpan.attr("id") || Date.now());
      let $row = $(
        `<tr>
          <td class='left'>${name}</td>
          <td><span id='${toolzzzId}'>${Utils.intToTime(seconds)}</span></td>
          <td class='reduce'>${endDate}</td>
          <td></td>
        </tr>`,
      );
      // Native `appendChild` (au lieu de jQuery `.append()`) pour bypass
      // `domManip` qui collecte les `<script>` descendants et les passe à
      // `DOMEval` → bloqué par la CSP MV3 de l'extension. Le `<a>Annuler</a>`
      // natif est juste déplacé, son flag HTML "already-started" est préservé.
      if ($link.length) $row.find("td:last")[0].appendChild($link[0]);
      $table.find("tbody")[0].appendChild($row[0]);
      validRows++;
      // Countdown isolated-world, basé sur `Date.now()` pour ne pas dériver.
      let start = Date.now();
      let intervalId = setInterval(() => {
        let $el = $("#" + toolzzzId);
        if (!$el.length) {
          clearInterval(intervalId);
          return;
        }
        let remaining = seconds - Math.floor((Date.now() - start) / 1000);
        if (remaining <= 0) {
          $el.text("0s");
          clearInterval(intervalId);
          return;
        }
        $el.text(Utils.intToTime(remaining));
      }, 1000);
    });
    let $first = $strongs.first();
    // Cas "que des erreurs" (typique : file d'attente C+ qui échoue alors qu'il
    // n'y a rien en construction) → pas de h2 ni de tableau vide, juste le toast.
    if (validRows) {
      if (sectionH2) $first.before(`<h2 class='o_marginT15 o_evolutionH2'>${sectionH2}</h2>`);
      // Native `insertBefore` : $table contient le `<a>Annuler</a>` natif déplacé
      // ; un append jQuery scanne ses descendants pour `DOMEval` → bloqué par CSP.
      $first[0].parentNode.insertBefore($table[0], $first[0]);
    }
    // Cleanup : retire les <strong>, <small> et <br> entre la table et le
    // séparateur natif `.Bas` (qui marque la fin de la zone évolutions).
    $first.nextUntil(".Bas").addBack().filter("strong, small, br").remove();
    // Dedup du toast : le serveur garde le message d'erreur ~2 min sur la page.
    // Sur un simple reload (F5) on évite de re-spam le toast tant que le même
    // message est encore là. En revanche pour toute autre navigation (clic
    // "Construire", clic dans le menu…), on considère que l'utilisateur a
    // agi et qu'il faut le notifier à nouveau si l'erreur persiste.
    let toastKey = "o_evoErrSeen_" + location.pathname;
    if (toastErrors.length) {
      let signature = toastErrors.join("|"),
        navType = performance.getEntriesByType("navigation")[0]?.type,
        skip = navType === "reload" && sessionStorage.getItem(toastKey) === signature;
      sessionStorage.setItem(toastKey, signature);
      if (!skip) $.toast({ ...TOAST_WARNING, text: toastErrors.join("<br>") });
    } else {
      sessionStorage.removeItem(toastKey);
    }
    // Sur la page de confirmation d'annulation, Fourmizzz ajoute :
    //  - non-C+ : un `<p>` contenant strong+Je confirme (tout dans le même p).
    //  - C+ : un `<p>` contenant juste strong, et `<a>Je confirme</a>` en
    //    sibling direct de #centre. Notre `<a>Retour</a>` (cf. confirmationAnnuler)
    //    est ajouté juste après "Je confirme", donc aussi sibling en C+.
    // On déplace le tout sous le tableau. DocumentFragment pour préserver
    // l'ordre DOM (jQuery `.after()` avec une collection insère en reverse).
    let $warning = $("#centre > p").has("strong");
    if ($warning.length) {
      let $confAnnuler = $("#centre > a[href*='confAnnuler']"),
        $retour = $confAnnuler.next("a"),
        $wrapper = $("<div class='o_annulationGroup'></div>");
      // En C+, "Je confirme" + "Retour" sont siblings du `<p>` (qui ne contient
      // que le `<strong>` + un `<br>`). On les déplace DANS le `<p>` pour
      // qu'ils restent collés au texte — sinon le `margin-bottom` natif du
      // `<p>` crée un gap entre le warning et les liens. En non-C+, les liens
      // sont déjà dans le `<p>`, donc $confAnnuler.length = 0 → no-op.
      if ($confAnnuler.length) {
        $warning[0].appendChild(document.createTextNode(" "));
        $warning[0].appendChild($confAnnuler[0]);
        $warning[0].appendChild(document.createTextNode(" "));
        $warning[0].appendChild($retour[0]);
      }
      $wrapper[0].appendChild($warning[0]);
      // Native insertion : $wrapper porte le `<strong>` natif qui contient un
      // `<script>reste(…)>` inline → un append jQuery déclencherait `DOMEval`,
      // bloqué par CSP MV3.
      $table[0].parentNode.insertBefore($wrapper[0], $table[0].nextSibling);
    }
  }
  /**
   * Bandeau d'alerte sous le menu du jeu : la reine ne pond plus, ou sa file
   * se termine sous le seuil (Paramètres → Général). La file vient de la page
   * Reine, relue au chargement d'une page au plus toutes les 10 min (ouvrir la
   * page Reine la met aussi à jour). Rien sur la page Reine, ni pendant les
   * 30 min qui suivent la fermeture du bandeau.
   *
   * @static
   * @method alertePonte
   */
  static alertePonte() {
    let seuil = SEUILS_ALERTE_PONTE[parseInt(monProfil.parametre["alertePonte"].valeur)] || 0;
    if (!seuil || /^\/Reine\.php/i.test(location.pathname)) return;
    let muette = 0;
    try {
      muette = parseInt(localStorage.getItem(CLE_ALERTE_PONTE_MUETTE)) || 0;
    } catch (e) {}
    if (Date.now() < muette) return;
    let connue = Utils.finPonteConnue(),
      fin =
        connue && Date.now() - connue.lu < VALIDITE_FIN_PONTE
          ? Promise.resolve(connue.fin)
          : Promise.resolve($.get(location.origin + "/Reine.php")).then((html) => {
              let $page = Utils.parseHtml(html);
              // pas la page Reine (session expirée…) : pas d'alerte plutôt qu'une fausse
              if (!Utils.estPageReine($page)) return null;
              return Date.now() + Utils.noterFinPonte(Utils.pontesReine($page)) * 1000;
            });
    fin
      .then((f) => {
        if (f == null) return;
        let reste = Math.max(0, Math.round((f - Date.now()) / 1000));
        if (reste <= seuil) Utils.bandeauPonte(reste);
      })
      .catch(() => {});
  }
  /**
   * La page contient le formulaire de ponte de la page Reine.
   *
   * @static
   * @method estPageReine
   */
  static estPageReine($page) {
    return $page.find(".icones_unite, span[id^='bouton_cout_nombre']").length > 0;
  }
  /**
   * Pontes de la file d'une page Reine. Les secondes restantes de chacune sont
   * lues dans l'appel reste(secondes, …) que le jeu place juste après sa ligne
   * (même source que la colonne « Terminé le »).
   *
   * @static
   * @method pontesReine
   * @param {Object} $racine page Reine (jQuery)
   * @return {Array} [{unite, nombre, secondes}]
   */
  static pontesReine($racine) {
    let pontes = [];
    $racine
      .find(".tableau_leger")
      .first()
      .find("tr:gt(0)")
      .each((i, tr) => {
        let apres = "";
        for (let n = tr.nextSibling; n && n.nodeName != "TR"; n = n.nextSibling)
          apres += n.textContent;
        let m = (apres || $(tr).next().text()).match(/\(\s*(\d+)\s*,/);
        if (!m) return;
        let texte = $(tr).find("td:eq(0)").text();
        pontes.push({
          unite: texte.replace(/[0-9]+/g, "").trim(),
          nombre: parseInt(texte.replace(/\D+/g, "")) || 0,
          secondes: parseInt(m[1]),
        });
      });
    return pontes;
  }
  /**
   * Mémorise la fin de file lue sur la page Reine ; renvoie les secondes restantes.
   *
   * @static
   * @method noterFinPonte
   */
  static noterFinPonte(pontes) {
    let reste = Math.max(0, ...pontes.map((p) => p.secondes));
    try {
      localStorage.setItem(
        CLE_FIN_PONTE,
        JSON.stringify({ fin: Date.now() + reste * 1000, lu: Date.now() }),
      );
    } catch (e) {}
    return reste;
  }
  /**
   * @static
   * @method finPonteConnue
   * @return {Object|null} {fin, lu} en ms
   */
  static finPonteConnue() {
    try {
      let v = JSON.parse(localStorage.getItem(CLE_FIN_PONTE));
      return v && v.fin && v.lu ? v : null;
    } catch (e) {
      return null;
    }
  }
  /**
   * Bandeau d'alerte de ponte, sous le menu principal du jeu ; sa croix le
   * masque 30 min.
   *
   * @static
   * @method bandeauPonte
   * @param {Number} reste secondes de ponte restantes
   */
  static bandeauPonte(reste) {
    $("#o_alertePonte").remove();
    let texte =
        reste <= 0
          ? "<strong>La reine ne pond plus</strong> : aucune ponte en cours."
          : `<strong>Ponte bientôt terminée</strong> : fin de la file dans ${Utils.intToTime(reste)} (vers ${Horloge.serveur().add(reste, "s").format("HH[h]mm")}).`,
      $bandeau =
        $(`<div id="o_alertePonte" class="${reste <= 0 ? "o_alertePonteArretee" : ""}" role="alert">
        <span class="o_alertePonteSymbole" aria-hidden="true">⚠</span>
        <span class="o_alertePonteTexte">${texte} <a href="/Reine.php">Relancer la ponte</a></span>
        <button type="button" class="o_alertePonteFermer" title="Masquer pendant 30 min" aria-label="Masquer pendant 30 min">×</button>
      </div>`);
    $bandeau.find(".o_alertePonteFermer").on("click", () => {
      try {
        localStorage.setItem(CLE_ALERTE_PONTE_MUETTE, String(Date.now() + 30 * 60000));
      } catch (e) {}
      $bandeau.remove();
    });
    if ($("#menu").length) $bandeau.insertAfter("#menu");
    else if ($("#centre").length) $bandeau.prependTo("#centre");
    else $bandeau.prependTo("body");
  }
  /**
   * Largeur minimale d'un bouton : celle de son plus long libellé possible,
   * pour qu'un changement de texte au clic ne décale rien autour.
   *
   * @static
   * @method figerLargeur
   * @param {Object} $bouton (jQuery)
   * @param {Array<String>} libelles autres libellés possibles
   */
  static figerLargeur($bouton, libelles) {
    if (!$bouton.length) return;
    let initial = $bouton.text(),
      largeur = $bouton.outerWidth();
    libelles.forEach((l) => {
      $bouton.text(l);
      largeur = Math.max(largeur, $bouton.outerWidth());
    });
    $bouton.text(initial).css({ minWidth: largeur + "px", boxSizing: "border-box" });
  }
  /**
   * Après un rechargement provoqué par un clic (lancement, annulation…),
   * l'élément cliqué (ou son plus proche parent identifiable) revient à la
   * même hauteur à l'écran : rien ne bouge à part les données mises à jour.
   *
   * @static
   * @method garderPosition
   * @param {String} cle clé de stockage (une par page)
   */
  static garderPosition(cle) {
    let lire = () => {
        try {
          return JSON.parse(sessionStorage.getItem(cle));
        } catch (e) {
          return null;
        }
      },
      ecrire = (v) => {
        try {
          sessionStorage.setItem(cle, JSON.stringify(v));
        } catch (e) {}
      },
      p = lire();
    // Page de confirmation du jeu (« Je confirme », annulation d'une
    // construction ou d'une recherche) : simple étape. La position d'avant le
    // premier clic est gardée pour la page qui suit la confirmation.
    if ($("a:contains('Je confirme')").length) {
      if (p && p.page === location.pathname)
        window.addEventListener("pagehide", () => ecrire({ ...p, t: Date.now() }));
      return;
    }
    // dernier clic : l'élément cliqué et sa position à l'écran
    let dernier = null,
      moment = 0;
    document.addEventListener(
      "click",
      (e) => {
        dernier = e.target;
        moment = Date.now();
      },
      true,
    );
    window.addEventListener("pagehide", () => {
      if (!dernier || Date.now() - moment > 10000) return;
      // ancres : ancêtres ayant un id, les id stables (sans numéro final,
      // souvent un rang de ligne qui change au rechargement) d'abord
      let ancres = [];
      for (let e = dernier; e && e !== document.body; e = e.parentElement)
        if (e.id && !/^ui-/.test(e.id))
          ancres.push({ id: e.id, haut: e.getBoundingClientRect().top });
      ancres.sort((a, b) => /\d$/.test(a.id) - /\d$/.test(b.id));
      ecrire({ ancres, y: window.scrollY, page: location.pathname, t: Date.now() });
    });
    try {
      sessionStorage.removeItem(cle);
    } catch (e) {}
    if (!p || Date.now() - p.t > 60000 || p.page !== location.pathname) return;
    // ni le navigateur (restauration, ancrage du défilement) ni la page ne
    // doivent déplacer la vue pendant le recalage
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    let racine = document.documentElement,
      ancrage = racine.style.overflowAnchor;
    racine.style.overflowAnchor = "none";
    // dernier défilement fait par Fzzz : les autres (barre de défilement,
    // script de la page…) arrêtent le recalage, l'ancrage du navigateur étant
    // coupé pendant ce temps
    let notreDefilement = 0,
      placer = () => {
        let a = (p.ancres || []).find((x) => document.getElementById(x.id)),
          y = a
            ? window.scrollY + document.getElementById(a.id).getBoundingClientRect().top - a.haut
            : p.y;
        if (Math.abs(y - window.scrollY) < 1) return;
        notreDefilement = Date.now();
        window.scrollTo(0, y);
      };
    // La page continue de se construire après coup (lectures en arrière-plan,
    // tableaux, images) : on recale à chaque changement de mise en page
    // pendant quelques secondes, et on s'arrête dès que le joueur agit
    // (molette, doigt, clavier, souris).
    let actif = true,
      attente = null,
      evenements = ["wheel", "touchstart", "keydown", "mousedown", "pointerdown"],
      recaler = () => {
        if (!actif) return;
        cancelAnimationFrame(attente);
        attente = requestAnimationFrame(placer);
      },
      arreter = () => {
        if (!actif) return;
        actif = false;
        observateurs.forEach((o) => o.disconnect());
        evenements.forEach((t) => window.removeEventListener(t, arreter, true));
        window.removeEventListener("scroll", defilement);
        racine.style.overflowAnchor = ancrage;
      },
      defilement = () => {
        if (Date.now() - notreDefilement > 150) arreter();
      },
      observateurs = [new MutationObserver(recaler)];
    observateurs[0].observe(document.body, { childList: true, subtree: true, attributes: true });
    if (window.ResizeObserver) {
      observateurs.push(new ResizeObserver(recaler));
      observateurs[1].observe(document.body);
    }
    evenements.forEach((t) => window.addEventListener(t, arreter, true));
    window.addEventListener("scroll", defilement, { passive: true });
    placer();
    $(window).one("load", recaler);
    setTimeout(arreter, 5000);
  }

  /**
   * Sur la page de confirmation d'annulation d'une recherche ou construction
   * (`?confAnnuler=ID&t=TOKEN`), ajoute un lien "Retour" à côté du "Je confirme"
   * natif (sinon l'utilisateur n'a aucun moyen évident de revenir en arrière)
   * et nettoie l'URL via `history.replaceState` pour qu'un Ctrl+R ramène sur
   * la page normale au lieu de re-afficher la confirmation.
   *
   * @static
   * @method confirmationAnnuler
   * @param {String} retourUrl URL de retour (ex. "construction.php").
   */
  static confirmationAnnuler(retourUrl) {
    let $confirmer = $("a:contains('Je confirme')");
    if (!$confirmer.length) return;
    $confirmer.after(
      ` <a href='${retourUrl}' class='o_retourAnnuler' style='margin-left:12px;'>Retour</a>`,
    );
    if (location.search.includes("confAnnuler")) history.replaceState({}, "", retourUrl);
  }
  /**
   * Compte à rebours dans l'élément id. Le temps restant est recalculé depuis
   * l'heure de fin à chaque tick (et au retour sur l'onglet) : un onglet en
   * arrière-plan, où le navigateur espace les timers, ou une mise en veille
   * ne le font pas dériver. Un seul intervalle sert tous les comptes, et
   * relancer un compte sur le même id remplace le précédent au lieu de
   * l'empiler.
   *
   * @static
   * @method decreaseTime
   * @param {Number} time secondes restantes
   * @param {String} id
   * @param {Object} options
   *   - format(secondes) : texte affiché, Utils.intToTime par défaut
   *   - chaqueSeconde(secondes) : appelé à chaque mise à jour
   *   - aZero() : appelé une fois le compte arrivé à 0 (s'il ne l'était pas au départ)
   */
  static decreaseTime(time, id, options = {}) {
    COMPTES_A_REBOURS[id] = { ...options, fin: Date.now() + time * 1000 };
    if (time <= 0) delete COMPTES_A_REBOURS[id].aZero;
    if (intervalleComptesARebours === null) {
      intervalleComptesARebours = setInterval(Utils.majComptesARebours, 1000);
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) Utils.majComptesARebours();
      });
    }
    Utils.majComptesARebours();
  }
  /**
   * Arrête le compte à rebours de l'élément id (le texte reste en place).
   *
   * @static
   * @method arreterTime
   * @param {String} id
   */
  static arreterTime(id) {
    delete COMPTES_A_REBOURS[id];
  }
  /**
   * Met à jour tous les comptes à rebours ; ceux à 0 ou dont l'élément a
   * disparu sont retirés.
   *
   * @static
   * @method majComptesARebours
   */
  static majComptesARebours() {
    for (let id in COMPTES_A_REBOURS) {
      let compte = COMPTES_A_REBOURS[id],
        elt = document.getElementById(id);
      if (!elt) {
        delete COMPTES_A_REBOURS[id];
        continue;
      }
      let reste = Math.max(0, Math.ceil((compte.fin - Date.now()) / 1000));
      elt.textContent = compte.format ? compte.format(reste) : Utils.intToTime(reste);
      if (compte.chaqueSeconde) compte.chaqueSeconde(reste);
      if (!reste) {
        delete COMPTES_A_REBOURS[id];
        if (compte.aZero) compte.aZero();
      }
    }
  }
  /**
   * Incremente un chrono dynamique toutes les secondes.
   *
   * @static
   * @method incrementTime
   * @param {Integer} time
   * @param {String} id
   * @param {String} idRound
   * @return L'affichage du contenue de l'id est incrementé d'une seconde.
   */
  static incrementTime(time, id, idRound = "") {
    // élément retiré de la page : la mise à jour s'arrête
    if (!document.getElementById(id)) return;
    let retour = Horloge.clic().add(time, "s");
    $("#" + id).text(retour.format("D MMM à HH[h]mm[m]ss[s]"));
    if (idRound)
      $("#" + idRound).text(Utils.roundMinute(time, Horloge.clic()).format("D MMM à HH[h]mm"));
    setTimeout(() => {
      Utils.incrementTime(time, id, idRound);
    }, 1000);
  }
  /**
   * Réduit la taille d'une chaine de caractére qui représente une durée.
   *
   * @static
   * @method shortcutTime
   * @param {String} time
   * @return {String} La chaine coupée.
   */
  static shortcutTime(time) {
    let tmp = this.intToTime(time).split(" ");
    if (tmp.length > 4) return tmp.splice(0, tmp.length - 3).join(" ");
    else if (tmp.length > 3) return tmp.splice(0, tmp.length - 2).join(" ");
    else if (tmp.length > 2) return tmp.splice(0, tmp.length - 1).join(" ");
    else return tmp.join(" ");
  }
  /**
   * Extrait les paramétres d'une URL.
   *
   * @static
   * @method extractUrlParams
   * @return {Array} La liste associatives des paramétres.
   */
  static extractUrlParams() {
    let f = new Array(),
      t = location.search.substring(1).split("&");
    if (t != "") {
      for (let elt of t) {
        let x = elt.split("=");
        f["" + x[0]] = "" + x[1];
      }
    }
    return f;
  }
  /**
   *
   */
  static extraitRecherche(data, joueur = true, alliance = true) {
    let element = new Array(),
      cptJ = alliance ? 3 : 6,
      cptA = joueur ? 3 : 6;
    // si la recherche renvoi ne renvoi qu'un resultat on tombe sur un profil de joueur
    if ($(data).find("h2").length) {
      let pseudo = $(data).find("h2").text();
      element.push({ value: pseudo, value_avec_html: pseudo, url: "Membre.php?Pseudo=" + pseudo });
    } else {
      $(data)
        .find(".simulateur:eq(0) tr")
        .each((i, elt) => {
          // les joueurs et les alli ont 6 cellules
          if ($(elt).find("td").length == 6) {
            let cellule = $(elt).find("td:eq(1) a"),
              lien = cellule.attr("href"),
              nom = cellule.text();
            // c'est un joueur si on trouve un lien de profil cellule 2
            if (joueur && lien.includes("Membre.php") && cptJ) {
              element.push({ value: nom, value_avec_html: nom, url: "Membre.php?Pseudo=" + nom });
              cptJ--;
            }
            // c'est une alliance
            if (alliance && lien.includes("classementAlliance.php") && cptA) {
              let tag = $(elt).find("td:eq(0)").text();
              element.push({
                value: nom,
                value_avec_html: `<span style="white-space:nowrap;"><strong>${tag}</strong> ${nom}</span>`,
                tag: tag,
                url: "classementAlliance.php?alliance=" + tag,
              });
              cptA--;
            }
          }
        });
    }
    return element;
  }
  /**
   * Coordonnées d'un joueur lues sur sa page de profil (lien « x=.. et y=.. »
   * vers la carte). Le lien mène à carte2.php sur s4 mais à carte.php sur s5 :
   * on accepte les deux.
   *
   * @static
   * @method coordonnees
   * @param {jQuery} page la page de profil, ou un conteneur qui la contient
   * @return {Object} {x, y}, -1 / -1 si le lien est introuvable
   */
  static coordonnees(page) {
    let m = $(page)
      .find("a[href^='carte2.php?'], a[href^='carte.php?']")
      .first()
      .text()
      .match(/x=(\d+) et y=(\d+)/);
    return m ? { x: parseInt(m[1]), y: parseInt(m[2]) } : { x: -1, y: -1 };
  }
  /**
   * Page de la carte sur le serveur courant, lue dans le menu du jeu :
   * carte2.php sur s4, carte.php sur s5.
   *
   * @static
   * @method pageCarte
   * @return {String}
   */
  static get pageCarte() {
    return $("a[href='carte.php']").length && !$("a[href='carte2.php']").length
      ? "carte.php"
      : "carte2.php";
  }
  /**
   * Parse une chaîne HTML reçue d'une page Fourmizzz sans exécuter ses scripts
   * inline. À utiliser à la place de `$("<div/>").append(html)` qui, sur Chrome,
   * exécute les `<script>` du HTML reçu et propage leurs ReferenceError jusqu'à
   * casser la suite du callback (cf. `envoyerFlood` / `_mfEnvoyerAttaqueSuivante`).
   *
   * @static
   * @method parseHtml
   * @param {String} html
   * @return {jQuery} wrapper jQuery du `<body>` parsé, prêt pour `.find()`.
   */
  static parseHtml(html) {
    return $(new DOMParser().parseFromString(html, "text/html").body);
  }
}
