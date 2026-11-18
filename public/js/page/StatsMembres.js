// @ts-check
/*
 * StatsMembres.js
 * Vue « Stats membres » de la page Membres (menu Alliance → Stats membres) :
 * le dernier relevé de chaque joueur, lu dans le Google Sheet « Stats membres »
 * de l'alliance, et son TdC actuel, avec en haut les cases du partage du
 * joueur, la mise en couleur au choix et l'export CSV.
 **********************************************************************/

// mise en couleur du tableau : "1" cochée ; choix gardé dans ce navigateur
const CLE_STATS_COULEURS = "fzzz_statsMembresCouleurs";
// une seule teinte (OKLCH 145°), du vert très clair (valeur la plus faible de
// la colonne) au vert marqué (la plus élevée), clarté décroissante ; texte
// blanc à partir de VERT_TEXTE_BLANC, plus lisible d'après le contraste APCA
const VERTS_STATS = [
  "#e6fae5",
  "#cde8cc",
  "#b4d6b4",
  "#9bc49c",
  "#83b284",
  "#6ba06d",
  "#538f56",
  "#3a7e3e",
  "#1c6d26",
];
const VERT_TEXTE_BLANC = 5;
const HASH_STATS_MEMBRES = "#statsMembres";
// ordre des colonnes de la vue (mainteneur, 18/11/2026) ; une information
// partagée qui n'y est pas va à la fin
const ORDRE_STATS = [
  "tdp",
  "ouvrieres",
  "cdf",
  "fdfHB",
  "fdfAB",
  "va",
  "vc",
  "champignonniere",
  "puceron",
];
const TITRES_COURTS_STATS = { ouvrieres: "Ov", champignonniere: "Champi" };
// grands nombres écrits avec trois chiffres, tronqués : « 3,67m », « 150k »
const STATS_ABREGEES = ["cdf", "fdfHB", "fdfAB"];
/** @type {Array<[string, number]>} */
const UNITES_STATS = [
  ["", 1],
  ["k", 1e3],
  ["m", 1e6],
  ["g", 1e9],
  ["t", 1e12],
];
// TdC lus il y a plus longtemps : relus sur la page Membres, à l'affichage de
// la vue et à l'export (la date de l'export date les TdC)
const MS_TDC_STATS = 60000;
const TYPE_CSV = "text/csv;charset=utf-8";
// lecture du fichier de la page, faite une fois, au premier affichage de la vue
/** @type {Promise<void>|null} */
let lectureStatsMembres = null;
// relevés du fichier et heure de leur lecture, gardés pour refaire le tableau
// quand les TdC sont relus
/** @type {Array<any>|null} */
let relevesStatsMembres = null;
let fichierLuStats = 0;
// TdC des membres : {valeurs: {pseudo en minuscules: TdC}, heure: ms à l'horloge du serveur}
/** @type {{valeurs: Object<string, number>, heure: number}|null} */
let tdcStatsMembres = null;
// lecture des TdC montrée dans le tableau
/** @type {{valeurs: Object<string, number>, heure: number}|null} */
let tdcTableauStats = null;
// police du tableau réduite par pas de 5 % tant qu'il dépasse du cadre, pas
// en dessous (comme « Mes attaques en cours ») : au-delà, il défile en largeur
const TAILLE_MIN_STATS = 60;
let ajustementStatsActif = false;

/**
 * @class StatsMembres
 */
class StatsMembres {
  /**
   * Le tableau est réservé aux chefs de l'alliance, la vue restant ouverte à
   * tous (règle du mainteneur, 18/11/2026) : ligne « Chefs » de la dernière
   * lecture des réglages, sans requête.
   *
   * @static
   * @method autorise
   * @return {Boolean}
   */
  static autorise() {
    return ReglagesAlliance.contient("chefs", monProfil.pseudo);
  }
  /**
   * @static
   * @method reservee
   * @return {String} ce que voit, à la place du tableau, un joueur qui n'est pas chef
   */
  static reservee() {
    return `Le tableau des stats est réservé aux chefs de l'alliance (ligne « ${REGLAGES_ALLIANCE.chefs.nom} » du sujet « ${TITRE_REGLAGES} »).`;
  }
  /**
   * Entrée « Stats membres » du menu Alliance, après « Carte » (sinon après
   * « Membres ») : elle mène à la vue de la page Membres.
   *
   * @static
   * @method ajouterMenu
   */
  static ajouterMenu() {
    let $membres = $("#menuAlliance .boutonMembres");
    if (!$membres.length || $("#o_ongletStatsMembres").length) return;
    ($("#o_ongletCarte").length ? $("#o_ongletCarte") : $membres)
      .parent()
      .after(
        `<li><a id='o_ongletStatsMembres' class='boutonStatJoueur' href='alliance.php?Membres${HASH_STATS_MEMBRES}'><span></span>Stats membres</a></li>`,
      );
  }
  /**
   * Page Membres : vue montrée au clic sur l'entrée du menu, sans recharger la
   * page, ou à l'arrivée par son adresse (aussi tapée sur la page déjà
   * ouverte). Rien n'est demandé avant ; les TdC du tableau du jeu sont notés
   * tout de suite, avant que l'extension ne le modifie.
   *
   * @static
   * @method installer
   */
  static installer() {
    if (!$("#alliance").length) return;
    StatsMembres.noterTdc(PartageChasses.lireTdcMembres($(document), 3, 5));
    $("#o_ongletStatsMembres").on("click", (e) => {
      e.preventDefault();
      StatsMembres.afficher();
    });
    window.addEventListener("hashchange", () => {
      if (location.hash == HASH_STATS_MEMBRES) StatsMembres.afficher();
    });
    if (location.hash == HASH_STATS_MEMBRES) StatsMembres.afficher();
  }
  /**
   * Cache le contenu du jeu (et la Carte), montre la vue et lit le fichier la
   * première fois.
   *
   * @static
   * @method afficher
   * @return {Promise<void>} fin de la lecture du fichier
   */
  static afficher() {
    if (!$("#o_statsMembres").length) StatsMembres._construire();
    $("#alliance, #o_carteAlliance").hide();
    $("#o_statsMembres").show();
    // tableau mesuré visible : caché, il n'a pas de largeur
    StatsMembres.ajusterTaille();
    if (!lectureStatsMembres) lectureStatsMembres = StatsMembres.charger();
    return lectureStatsMembres;
  }
  /**
   * Police du tableau réduite, par pas de 5 % jusqu'à TAILLE_MIN_STATS, tant
   * qu'il dépasse du cadre ; refait quand la fenêtre change de taille.
   *
   * @static
   * @method ajusterTaille
   */
  static ajusterTaille() {
    let $t = $("#o_statsMembresTable"),
      cadre = $t.closest(".o_statsMembresTableau")[0];
    if (!cadre) return;
    let taille = 100;
    $t.css("font-size", "");
    // vue cachée : rien à mesurer, la police reste entière jusqu'au prochain affichage
    if (!cadre.clientWidth) return;
    while (taille > TAILLE_MIN_STATS && cadre.scrollWidth > cadre.clientWidth) {
      taille -= 5;
      $t.css("font-size", taille + "%");
    }
    if (!ajustementStatsActif) {
      ajustementStatsActif = true;
      /** @type {any} */
      let attente = null;
      $(window).on("resize", () => {
        clearTimeout(attente);
        attente = setTimeout(() => StatsMembres.ajusterTaille(), 150);
      });
    }
  }
  /**
   * @static
   * @method couleurs
   * @return {Boolean} mise en couleur cochée
   */
  static couleurs() {
    try {
      return localStorage.getItem(CLE_STATS_COULEURS) == "1";
    } catch (e) {
      return false;
    }
  }
  /**
   * @static
   * @method donnees
   * @return {Array<{cle: String, titre: String, libelle: String}>} DONNEES_PARTAGEES dans l'ordre des colonnes de la vue
   */
  static donnees() {
    let rang = (/** @type {{cle: String}} */ d) => {
      let i = ORDRE_STATS.indexOf(d.cle);
      return i < 0 ? ORDRE_STATS.length : i;
    };
    return [...DONNEES_PARTAGEES].sort((a, b) => rang(a) - rang(b));
  }
  /**
   * @static
   * @method titre
   * @param {{cle: String, titre: String}} d
   * @return {String} titre de sa colonne
   */
  static titre(d) {
    return TITRES_COURTS_STATS[d.cle] || d.titre;
  }
  /**
   * @private
   * @static
   */
  static _construire() {
    let donnees = StatsMembres.donnees(),
      cases = donnees
        .map(
          (d) =>
            `<label class='o_statsMembresCase' title='${Utils.echapper(d.libelle)}'><input type='checkbox' data-stats-partage='${d.cle}' ${SuiviMembres.partage(d.cle) ? "checked" : ""}/> ${StatsMembres.titre(d)}</label>`,
        )
        .join(""),
      titres = donnees
        .map((d) => `<th title='${Utils.echapper(d.libelle)}'>${StatsMembres.titre(d)}</th>`)
        .join(""),
      // tableau, sa couleur, son export et sa légende : pour les chefs (revu après la relecture des réglages)
      cache = StatsMembres.autorise() ? "" : "style='display:none'";
    $("#alliance")
      .after(`<div id='o_statsMembres' class='boite_amelioration simulateur centre' style='display:none'>
        <h2>Stats membres</h2>
        <div class='o_statsMembresReglages'><span class='gras'>Je partage :</span>${cases}</div>
        <div class='o_statsMembresReglages o_statsChefs' ${cache}><label title='Par colonne : vert clair pour la valeur la plus faible, vert foncé pour la plus élevée'><input type='checkbox' id='o_statsMembresCouleurs' ${StatsMembres.couleurs() ? "checked" : ""}/> Mise en couleur du tableau</label></div>
        <div class='o_statsMembresReglages'><button id='o_statsMembresCsv' class='o_button f_success o_statsChefs' ${cache} disabled title='${Utils.echapper("Le tableau dans un fichier CSV pour Excel, avec la date de l'export")}'>Exporter en CSV</button><span id='o_statsMembresEtat' class='reduce'></span></div>
        <div class='o_statsMembresTableau o_statsChefs' ${cache}><table id='o_statsMembresTable' cellspacing='0'><thead><tr><th>Joueur</th><th>Relevé</th>${titres}<th title='${Utils.echapper("TdC actuel, lu sur la page Membres de l'alliance")}'>TdC</th></tr></thead><tbody></tbody></table></div>
        <p class='reduce left o_statsChefs' ${cache}>Dernier relevé de chaque joueur dans le Google Sheet « Stats membres » de l'alliance. TdC : TdC actuel, lu sur la page Membres (vide pour un joueur qui n'est plus membre). CdF et FdF : k mille, m million, g milliard, t mille milliards, tronqués ; valeur exacte au survol et dans l'export CSV. <span class='o_statsNonPartage o_statsLegende'>—</span> case rouge : information que le joueur ne partage pas. Case vide : information pas relevée ce jour-là (relevé fait avec une version plus ancienne de l'extension, par exemple).</p>
      </div>`);
    $("#o_statsMembres input[data-stats-partage]").on("change", (e) => {
      let caseCochee = /** @type {HTMLInputElement} */ (e.currentTarget),
        cle = String(caseCochee.dataset.statsPartage);
      SuiviMembres.choisir(cle, caseCochee.checked);
      // la même case dans Préférences → Partage de données, si elle est ouverte
      $(`input[data-partage='${cle}']`).prop("checked", caseCochee.checked);
    });
    $("#o_statsMembresCouleurs").on("change", (e) => {
      let coche = /** @type {HTMLInputElement} */ (e.currentTarget).checked;
      try {
        localStorage.setItem(CLE_STATS_COULEURS, coche ? "1" : "0");
      } catch (err) {}
      StatsMembres.colorier(coche);
    });
    $("#o_statsMembresCsv").on("click", () => StatsMembres.exporter());
  }
  /**
   * Lit le dernier relevé de chaque joueur dans le fichier de l'alliance
   * (adresse du forum caché) et remplit le tableau, avec les TdC.
   *
   * @static
   * @method charger
   * @return {Promise<void>}
   */
  static charger() {
    let chef = StatsMembres.autorise(),
      $etat = $("#o_statsMembresEtat")
        .removeClass("red")
        .text(
          chef
            ? "Lecture du Google Sheet « Stats membres »…"
            : "Lecture des réglages de l'alliance…",
        ),
      // TdC lus en même temps que les réglages pour un chef d'après la dernière lecture
      tdc = chef ? StatsMembres.tdc() : null;
    return SuiviMembres.adresse()
      .then(
        ({ url, manque }) => {
          if (manque == "section" || manque == "sujet")
            throw new Error(SuiviMembres.sansAdresse(manque));
          // réglages relus si la dernière lecture a plus d'une minute : la ligne « Chefs » fait foi
          chef = StatsMembres.autorise();
          $("#o_statsMembres .o_statsChefs").toggle(chef);
          if (!chef) throw new Error(StatsMembres.reservee());
          if (!url) throw new Error(SuiviMembres.sansAdresse(manque));
          return ExportRapports.requete(url, "POST", { releves: true });
        },
        () => {
          throw new Error("le forum de l'alliance n'a pas pu être lu, réessaie dans un instant");
        },
      )
      .then((/** @type {any} */ donnees) => {
        if (!donnees || !Array.isArray(donnees.releves))
          throw new Error("réponse inattendue du script du Google Sheet");
        fichierLuStats = Horloge.maintenant();
        return (tdc || StatsMembres.tdc()).then((t) => {
          StatsMembres.remplir(donnees.releves, t);
          StatsMembres._etat();
        });
      })
      .catch((e) => {
        let message = String((e && e.message) || e);
        if (message == StatsMembres.reservee()) {
          $etat.text(message);
          return;
        }
        // script d'avant cette lecture : la requête lui est inconnue
        if (/requête invalide/.test(message))
          message =
            "le script du Google Sheet « Stats membres » n'est pas à jour, son propriétaire doit le redéployer (nouvelle version)";
        $etat.addClass("red").text(`Stats illisibles : ${message}.`);
      });
  }
  /**
   * @static
   * @method noterTdc
   * @param {Object<string, number>} lu {pseudo: TdC} ; vide (lecture ratée) : rien n'est noté
   */
  static noterTdc(lu) {
    /** @type {Object<string, number>} */
    let valeurs = {};
    for (let p in lu) valeurs[p.trim().toLowerCase()] = lu[p];
    if (Object.keys(valeurs).length) tdcStatsMembres = { valeurs, heure: Horloge.maintenant() };
  }
  /**
   * TdC des membres, relus sur la page Membres quand la dernière lecture a
   * plus d'une minute.
   *
   * @static
   * @method tdc
   * @return {Promise<{valeurs: Object<string, number>, heure: number}|null>} la dernière lecture réussie ; null sans aucune
   */
  static tdc() {
    if (tdcStatsMembres && Horloge.maintenant() - tdcStatsMembres.heure < MS_TDC_STATS)
      return Promise.resolve(tdcStatsMembres);
    return PartageChasses.tdcMembres(true).then(
      (lu) => {
        StatsMembres.noterTdc(lu);
        return tdcStatsMembres;
      },
      () => tdcStatsMembres,
    );
  }
  /**
   * @private
   * @static
   */
  static _etat() {
    let n = relevesStatsMembres ? relevesStatsMembres.length : 0;
    $("#o_statsMembresEtat")
      .removeClass("red")
      .text(
        `${numeral(n).format()} joueur(s), fichier lu ${StatsMembres.quand(fichierLuStats)}, ${tdcTableauStats ? `TdC lus ${StatsMembres.quand(tdcTableauStats.heure)}` : "TdC illisibles (page Membres)"}.`,
      );
  }
  /**
   * @static
   * @method quand
   * @param {Number} ms heure du serveur
   * @return {String} « à 09h30 » aujourd'hui, sinon « le 17/11 à 23h50 »
   */
  static quand(ms) {
    let m = moment(ms);
    return m.isSame(Horloge.serveur(), "day")
      ? m.format("[à] HH[h]mm")
      : m.format("[le] DD/MM [à] HH[h]mm");
  }
  /**
   * Une ligne par joueur, triable par colonne ; refait (tri gardé) quand les
   * TdC sont relus.
   *
   * @static
   * @method remplir
   * @param {Array<any>} releves réponse du script : {joueur, date, valeurs, partages}
   * @param {{valeurs: Object<string, number>, heure: number}|null} [tdc] TdC des membres
   */
  static remplir(releves, tdc = tdcStatsMembres) {
    relevesStatsMembres = releves;
    tdcTableauStats = tdc;
    let donnees = StatsMembres.donnees(),
      moi = String(monProfil.pseudo || "")
        .trim()
        .toLowerCase(),
      $table = $("#o_statsMembresTable"),
      ordre = [[0, "asc"]];
    if ($.fn.dataTable.isDataTable($table[0])) {
      let api = $table.DataTable();
      ordre = api.order();
      api.destroy();
    }
    let lignes = releves.map((r) => {
      let joueur = String(r.joueur || ""),
        cle = joueur.trim().toLowerCase(),
        [jour, heure] = String(r.date || "").split(" "),
        m = moment(jour, "YYYY-MM-DD", true),
        date = m.isValid() ? m.format("DD/MM") + (heure ? " " + heure.replace(":", "h") : "") : "",
        cellules = donnees.map((d) => StatsMembres.cellule(d.cle, r)).join("");
      return `<tr data-joueur='${Utils.echapper(joueur)}' data-releve='${Utils.echapper(String(r.date || ""))}'${cle == moi ? " class='o_statsMoi'" : ""}>
          <td data-order='${Utils.echapper(cle)}'><a href='Membre.php?Pseudo=${encodeURIComponent(joueur)}'>${Utils.echapper(joueur)}</a></td>
          <td data-order='${Utils.echapper(String(r.date || ""))}'>${date}</td>${cellules}${StatsMembres.celluleNombre("tdc", tdc ? tdc.valeurs[cle] : undefined)}</tr>`;
    });
    $table.find("tbody").html(lignes.join(""));
    let couleur2 = monProfil.parametre && monProfil.parametre["couleur2"];
    $table.DataTable({
      dom: "t",
      paging: false,
      info: false,
      searching: false,
      autoWidth: false,
      order: ordre,
      // une statistique se trie d'abord de la plus élevée à la plus faible
      columnDefs: [
        {
          targets: [...donnees.map((d, i) => i + 2), donnees.length + 2],
          orderSequence: ["desc", "asc"],
        },
      ],
      rowCallback: (
        /** @type {Element} */ ligne,
        /** @type {any} */ valeurs,
        /** @type {Number} */ i,
      ) => {
        $(ligne).css("background-color", i % 2 && couleur2 ? couleur2.valeur : "");
      },
    });
    StatsMembres.colorier(StatsMembres.couleurs());
    StatsMembres.ajusterTaille();
    $("#o_statsMembresCsv").prop("disabled", false);
  }
  /**
   * @static
   * @method cellule
   * @param {String} cle clé de DONNEES_PARTAGEES
   * @param {any} r relevé du joueur
   * @return {String} sa case
   */
  static cellule(cle, r) {
    if (r.partages && r.partages[cle] === false)
      return `<td class='o_statsNonPartage' data-cle='${cle}' data-order='-1' title='non partagé'>—</td>`;
    return StatsMembres.celluleNombre(cle, r.valeurs ? r.valeurs[cle] : null);
  }
  /**
   * @static
   * @method celluleNombre
   * @param {String} cle
   * @param {any} v nombre ; autre chose : case vide
   * @return {String}
   */
  static celluleNombre(cle, v) {
    if (typeof v != "number" || !isFinite(v)) return `<td data-cle='${cle}' data-order='-1'></td>`;
    let complet = numeral(v).format("0,0");
    return STATS_ABREGEES.includes(cle)
      ? `<td data-cle='${cle}' data-order='${v}' data-valeur='${v}' title='${complet}'>${StatsMembres.abreger(v)}</td>`
      : `<td data-cle='${cle}' data-order='${v}' data-valeur='${v}'>${complet}</td>`;
  }
  /**
   * Nombre écrit avec trois chiffres, tronqué (mainteneur, 18/11/2026 :
   * 3 678 837 → « 3,67m », 150 000 → « 150k », 999 999 → « 999k », jamais
   * arrondi au-dessus) : dès 1 000, en k, m, g ou t, les zéros de fin de la
   * partie décimale retirés (« 2,4m », « 15k ») ; sous 1 000, le nombre entier.
   *
   * @static
   * @method abreger
   * @param {Number} v positif ou nul
   * @return {String}
   */
  static abreger(v) {
    let n = Math.max(0, Math.round(v)),
      [lettre, unite] = UNITES_STATS[0];
    for (let u of UNITES_STATS) if (n >= u[1]) [lettre, unite] = u;
    if (unite == 1) return Utils.decimal(n);
    let decimales = n < 10 * unite ? 2 : n < 100 * unite ? 1 : 0,
      dixiemes = Math.pow(10, decimales);
    return Utils.decimal(Math.floor(n / (unite / dixiemes)) / dixiemes, decimales, true) + lettre;
  }
  /**
   * Mise en couleur, par colonne, des valeurs partagées : vert très clair pour
   * la plus faible, vert marqué pour la plus élevée ; décochée : couleurs du
   * tableau.
   *
   * @static
   * @method colorier
   * @param {Boolean} actif
   */
  static colorier(actif) {
    let $cellules = $("#o_statsMembresTable tbody td[data-cle]").css({
      backgroundColor: "",
      color: "",
    });
    if (!actif) return;
    [...StatsMembres.donnees().map((d) => d.cle), "tdc"].forEach((cle) => {
      let $colonne = $cellules.filter(`[data-cle='${cle}'][data-valeur]`),
        valeurs = $colonne.map((i, td) => Number(td.dataset.valeur)).get(),
        min = Math.min(...valeurs),
        max = Math.max(...valeurs);
      $colonne.each((i, td) => {
        let n = StatsMembres.niveau(Number(td.dataset.valeur), min, max);
        $(td).css({
          backgroundColor: VERTS_STATS[n],
          color: n >= VERT_TEXTE_BLANC ? "#ffffff" : "#1a1a1a",
        });
      });
    });
  }
  /**
   * @static
   * @method niveau
   * @param {Number} valeur
   * @param {Number} min plus faible valeur de la colonne
   * @param {Number} max plus élevée
   * @return {Number} indice dans VERTS_STATS : 0 pour la plus faible, le dernier
   *   pour la plus élevée, proportionnel à la valeur entre les deux
   */
  static niveau(valeur, min, max) {
    if (!(max > min)) return 0;
    return Math.round(((valeur - min) / (max - min)) * (VERTS_STATS.length - 1));
  }
  /**
   * Fichier CSV du tableau, dans l'ordre affiché : TdC relus d'abord s'ils
   * ont plus d'une minute, puisque la date de l'export les date.
   *
   * @static
   * @method exporter
   * @return {Promise<void>}
   */
  static exporter() {
    let $bouton = $("#o_statsMembresCsv").prop("disabled", true);
    return StatsMembres.tdc()
      .then((tdc) => {
        if (tdc !== tdcTableauStats && relevesStatsMembres) {
          StatsMembres.remplir(relevesStatsMembres, tdc);
          StatsMembres._etat();
        }
        let maintenant = Horloge.serveur();
        Classeur.telecharger(
          new TextEncoder().encode("﻿" + StatsMembres.csv(maintenant)),
          StatsMembres.nomCsv(maintenant),
          TYPE_CSV,
        );
      })
      .catch((e) => {
        console.error("Fzzz : export CSV des stats membres", e);
        $.toast({ ...TOAST_ERROR, text: "Le fichier CSV n'a pas pu être créé." });
      })
      .then(() => {
        $bouton.prop("disabled", false);
      });
  }
  /**
   * Pour Excel en français : « ; » entre les colonnes, nombres sans séparateur
   * des milliers et virgule décimale ; la date de l'export en première ligne.
   *
   * @static
   * @method csv
   * @param {Object} maintenant moment de l'export, heure du jeu
   * @return {String} lignes séparées par CRLF, sans la marque UTF-8
   */
  static csv(maintenant) {
    let champ = (/** @type {String} */ s) =>
        /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s,
      // un texte qu'Excel lirait comme une formule (= + - @ en tête) reste du texte
      texte = (/** @type {String} */ s) => champ(/^[=+\-@]/.test(s) ? "'" + s : s),
      jour = (/** @type {Number} */ ms) => moment(ms).format("DD/MM/YYYY [à] HH[h]mm"),
      titre = `Stats membres${Utils.alliance ? " " + Utils.alliance : ""}, export du ${maintenant.format("DD/MM/YYYY [à] HH[h]mm")} (heure du jeu), ${tdcTableauStats ? "TdC lus le " + jour(tdcTableauStats.heure) : "TdC non lus"}`,
      entete = ["Joueur", "Relevé", ...StatsMembres.donnees().map(StatsMembres.titre), "TdC"],
      lignes = $("#o_statsMembresTable tbody tr[data-joueur]")
        .map((i, tr) =>
          [
            texte(String(tr.dataset.joueur)),
            StatsMembres.dateCsv(String(tr.dataset.releve)),
            ...$(tr)
              .children("td[data-cle]")
              .map((j, td) => StatsMembres.valeurCsv(td))
              .get(),
          ].join(";"),
        )
        .get();
    return [champ(titre), "", entete.map(champ).join(";"), ...lignes].join("\r\n") + "\r\n";
  }
  /**
   * @static
   * @method dateCsv
   * @param {String} date du fichier : « 2026-11-18 08:03 » ou « 2026-11-16 »
   * @return {String} « 18/11/2026 08:03 », « 16/11/2026 » ; vide si illisible
   */
  static dateCsv(date) {
    let [jour, heure] = date.split(" "),
      m = moment(jour, "YYYY-MM-DD", true);
    if (!m.isValid()) return "";
    return m.format("DD/MM/YYYY") + (/^\d{1,2}:\d{2}$/.test(heure || "") ? " " + heure : "");
  }
  /**
   * @static
   * @method valeurCsv
   * @param {HTMLElement} td case d'une statistique ou du TdC
   * @return {String}
   */
  static valeurCsv(td) {
    if ($(td).hasClass("o_statsNonPartage")) return "non partagé";
    let v = Number(td.dataset.valeur);
    return td.dataset.valeur !== undefined && isFinite(v) ? numeral(v).format("0.[00]") : "";
  }
  /**
   * @static
   * @method nomCsv
   * @param {Object} maintenant moment de l'export
   * @return {String}
   */
  static nomCsv(maintenant) {
    return `stats-membres-${Utils.alliance.replace(/[^\w-]/g, "") || "alliance"}-${maintenant.format("YYYY-MM-DD-HH[h]mm")}.csv`;
  }
}
