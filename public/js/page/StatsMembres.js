// @ts-check
/*
 * StatsMembres.js
 * Vue « Stats membres » de la page Membres (menu Alliance → Stats membres) :
 * le dernier relevé de chaque joueur, lu dans le Google Sheet « Stats membres »
 * de l'alliance, avec en haut les cases du partage du joueur et des couleurs
 * par colonne au choix.
 **********************************************************************/

// couleurs par colonne : "1" cochée ; choix gardé dans ce navigateur
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
// lecture du fichier de la page, faite une fois, au premier affichage de la vue
/** @type {Promise<void>|null} */
let lectureStatsMembres = null;

/**
 * @class StatsMembres
 */
class StatsMembres {
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
   * ouverte). Rien n'est lu avant.
   *
   * @static
   * @method installer
   */
  static installer() {
    if (!$("#alliance").length) return;
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
    if (!lectureStatsMembres) lectureStatsMembres = StatsMembres.charger();
    return lectureStatsMembres;
  }
  /**
   * @static
   * @method couleurs
   * @return {Boolean} couleurs par colonne cochées
   */
  static couleurs() {
    try {
      return localStorage.getItem(CLE_STATS_COULEURS) == "1";
    } catch (e) {
      return false;
    }
  }
  /**
   * @private
   * @static
   */
  static _construire() {
    let cases = DONNEES_PARTAGEES.map(
        (d) =>
          `<label class='o_statsMembresCase' title='${Utils.echapper(d.libelle)}'><input type='checkbox' data-stats-partage='${d.cle}' ${SuiviMembres.partage(d.cle) ? "checked" : ""}/> ${d.titre}</label>`,
      ).join(""),
      titres = DONNEES_PARTAGEES.map(
        (d) => `<th title='${Utils.echapper(d.libelle)}'>${d.titre}</th>`,
      ).join("");
    $("#alliance")
      .after(`<div id='o_statsMembres' class='boite_amelioration simulateur centre' style='display:none'>
        <h2>Stats membres</h2>
        <div class='o_statsMembresReglages'><span class='gras'>Je partage :</span>${cases}<span class='reduce o_secondaire'>(envoyé au fichier à ta prochaine page)</span></div>
        <div class='o_statsMembresReglages'><label><input type='checkbox' id='o_statsMembresCouleurs' ${StatsMembres.couleurs() ? "checked" : ""}/> Couleurs par colonne : vert clair pour la valeur la plus faible, vert foncé pour la plus élevée</label></div>
        <p id='o_statsMembresEtat' class='reduce'></p>
        <div class='o_statsMembresTableau'><table id='o_statsMembresTable' cellspacing='0'><thead><tr><th>Joueur</th><th>Relevé</th>${titres}</tr></thead><tbody></tbody></table></div>
        <p class='reduce left'>Dernier relevé de chaque joueur dans le Google Sheet « Stats membres » de l'alliance. <span class='o_statsNonPartage o_statsLegende'>—</span> case rouge : information que le joueur ne partage pas. Case vide : information pas relevée ce jour-là (relevé fait avec une version plus ancienne de l'extension, par exemple).</p>
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
  }
  /**
   * Lit le dernier relevé de chaque joueur dans le fichier de l'alliance
   * (adresse du forum caché) et remplit le tableau.
   *
   * @static
   * @method charger
   * @return {Promise<void>}
   */
  static charger() {
    let $etat = $("#o_statsMembresEtat")
      .removeClass("red")
      .text("Lecture du Google Sheet « Stats membres »…");
    return SuiviMembres.adresse()
      .then(
        ({ url, manque }) => {
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
        StatsMembres.remplir(donnees.releves);
        $etat.text(
          `${numeral(donnees.releves.length).format()} joueur(s), lu à ${Horloge.serveur().format("HH[h]mm")}.`,
        );
      })
      .catch((e) => {
        let message = String((e && e.message) || e);
        // script d'avant cette lecture : la requête lui est inconnue
        if (/requête invalide/.test(message))
          message =
            "le script du Google Sheet « Stats membres » n'est pas à jour, son propriétaire doit le redéployer (nouvelle version)";
        $etat.addClass("red").text(`Stats illisibles : ${message}.`);
      });
  }
  /**
   * Une ligne par joueur, triable par colonne.
   *
   * @static
   * @method remplir
   * @param {Array<any>} releves réponse du script : {joueur, date, valeurs, partages}
   */
  static remplir(releves) {
    let moi = String(monProfil.pseudo || "")
        .trim()
        .toLowerCase(),
      lignes = releves.map((r) => {
        let joueur = String(r.joueur || ""),
          [jour, heure] = String(r.date || "").split(" "),
          m = moment(jour, "YYYY-MM-DD", true),
          date = m.isValid()
            ? m.format("DD/MM") + (heure ? " " + heure.replace(":", "h") : "")
            : "",
          cellules = DONNEES_PARTAGEES.map((d) => {
            let v = r.valeurs ? r.valeurs[d.cle] : null;
            if (r.partages && r.partages[d.cle] === false)
              return `<td class='o_statsNonPartage' data-cle='${d.cle}' data-order='-1' title='non partagé'>—</td>`;
            if (typeof v != "number" || !isFinite(v))
              return `<td data-cle='${d.cle}' data-order='-1'></td>`;
            return `<td data-cle='${d.cle}' data-order='${v}' data-valeur='${v}'>${numeral(v).format("0,0")}</td>`;
          }).join("");
        return `<tr${joueur.trim().toLowerCase() == moi ? " class='o_statsMoi'" : ""}>
          <td data-order='${Utils.echapper(joueur.toLowerCase())}'><a href='Membre.php?Pseudo=${encodeURIComponent(joueur)}'>${Utils.echapper(joueur)}</a></td>
          <td data-order='${Utils.echapper(String(r.date || ""))}'>${date}</td>${cellules}</tr>`;
      });
    $("#o_statsMembresTable tbody").html(lignes.join(""));
    let couleur2 = monProfil.parametre && monProfil.parametre["couleur2"];
    $("#o_statsMembresTable").DataTable({
      dom: "t",
      paging: false,
      info: false,
      searching: false,
      autoWidth: false,
      order: [[0, "asc"]],
      // une statistique se trie d'abord de la plus élevée à la plus faible
      columnDefs: [
        {
          targets: DONNEES_PARTAGEES.map((d, i) => i + 2),
          orderSequence: ["desc", "asc"],
        },
      ],
      rowCallback: (
        /** @type {Element} */ ligne,
        /** @type {any} */ donnees,
        /** @type {Number} */ i,
      ) => {
        $(ligne).css("background-color", i % 2 && couleur2 ? couleur2.valeur : "");
      },
    });
    StatsMembres.colorier(StatsMembres.couleurs());
  }
  /**
   * Couleurs par colonne, sur les valeurs partagées : vert très clair pour la
   * plus faible, vert marqué pour la plus élevée ; décochées : couleurs du
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
    DONNEES_PARTAGEES.forEach((d) => {
      let $colonne = $cellules.filter(`[data-cle='${d.cle}'][data-valeur]`),
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
}
