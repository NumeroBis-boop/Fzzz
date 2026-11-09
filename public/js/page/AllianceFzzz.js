/*
 * AllianceFzzz.js
 * NumeroBis-boop
 **********************************************************************/

// vue à rouvrir après le rechargement qui suit « Temps de trajet » synchronisé
const CLE_VUE_APRES_SYNCHRO = "fzzz_vueMembresApresSynchro";
// vues de la page Membres, dans l'ordre du réglage « vueMembres »
const VUES_MEMBRES = ["reset", "trajet", "floods"];
// colonnes ajoutées en fin de ligne au tableau des membres
const ALLIANCE_COLONNES_FZZZ = [
  "Date dernier<br/>mouvement",
  "Variation<br/>totale de TdC",
  "TdC<br/>final",
];
// membre sans mouvement en cours : après les autres dans le tri croissant des dates
const ALLIANCE_SANS_MOUVEMENT = 9999999999;

/**
 * Page Membres de l'alliance : vues « Standard » (tableau du jeu, à
 * l'ouverture), « Temps de trajet » et « Floods et chasses en cours ». Les
 * chasses et floods partagés dans le forum (PartageChasses) ne sont lus qu'au
 * premier choix de cette dernière vue ; ils remplissent ses colonnes et
 * l'infobulle de l'évolution future du TdC au survol d'une ligne, où est
 * surlignée la ligne du TdC à l'arrivée d'une attaque lancée à l'ouverture.
 *
 * @class AllianceFzzz
 */
class AllianceFzzz {
  /**
   * Ajoute les colonnes Fzzz (vides) avant l'initialisation de DataTable.
   *
   * @static
   * @method colonnes
   */
  static colonnes() {
    let $t = $("#tabMembresAlliance");
    AllianceFzzz.avecFloods = Utils.affichage("membresFloods");
    if (AllianceFzzz.avecFloods)
      $t.find("thead tr").append(
        ALLIANCE_COLONNES_FZZZ.map((c, i) => `<th class='o_allCol${i}'>${c}</th>`).join(""),
      );
    // rang : largeur au plus juste (le libellé ne passe plus sur toute la ligne)
    $t.find("thead th:eq(2)").addClass("o_allRang");
    $t.find("tbody tr").each((i, tr) => $(tr).find("td:eq(2)").addClass("o_allRang"));
    if (AllianceFzzz.avecFloods)
      $t.find("tbody tr").each((i, tr) => {
        $(tr).append(
          `<td class='o_allVar o_allCol0' data-order='${ALLIANCE_SANS_MOUVEMENT}'>…</td><td class='o_allMontant o_allCol1' data-order='0'></td><td class='o_allFinal o_allCol2' data-order='0'></td>`,
        );
      });
    // ligne des totaux (pied fusionné sur toutes les colonnes) déplacée sous le
    // tableau : l'extension Responsive de DataTables plante sur un pied fusionné
    // dès qu'on masque ou affiche une colonne
    let $pied = $t.find("tfoot");
    if ($pied.length) {
      $(`<div id='o_allTotaux' class='centre gras'></div>`)
        .html($pied.find("td").first().html())
        .insertAfter($t);
      $pied.remove();
    }
  }
  /**
   * Boutons de vue ; partages du forum lus au premier choix de leur vue.
   *
   * @static
   * @method installer
   * @param {Function} synchroniser récupère les coordonnées (ancien « Synchroniser »)
   * @param {Boolean} avecTrajet colonnes Tdt / Retour présentes (coordonnées en cache)
   * @param {Function} [tempsTrajet] pseudo → temps de trajet (s) à ma vitesse d'attaque, null si inconnu
   */
  static installer(synchroniser, avecTrajet, tempsTrajet = () => null) {
    let api = $("#tabMembresAlliance").DataTable(),
      // heure d'une attaque lancée à l'ouverture de la page, comme la colonne « Retour »
      ouverture = Horloge.clic(),
      // nombre de colonnes lu dans les réglages : columns() sans sélecteur plante en 1.10.16
      n = api.settings()[0].aoColumns.length,
      // colonnes de la vue « Floods et chasses en cours », sans elles si sa case est décochée
      k = AllianceFzzz.avecFloods === false ? 0 : ALLIANCE_COLONNES_FZZZ.length,
      fzzz = [...Array(k).keys()].map((i) => n - k + i),
      trajet = avecTrajet ? [9, 10] : [],
      // colonne de numérotation du jeu (1, 2, 3…) : masquée dans toutes les vues
      numero = [0, 1].find((c) =>
        api.rows()[0].every((r) => /^\s*\d+\s*$/.test($(api.cell(r, c).node()).text())),
      ),
      autres = [...Array(n).keys()].filter((i) => !fzzz.includes(i) && !trajet.includes(i)),
      entete = (i) => $(api.column(i).header()).text().trim(),
      terrain = [...Array(n).keys()].find((i) => entete(i) == "Terrain") ?? 5,
      // épées de portée du jeu (Compte+) : colonnes sans titre de part et d'autre du terrain
      epees = [terrain - 1, terrain + 1].filter((i) => i >= 0 && i < n && entete(i).length <= 1),
      vues = {
        trajet: (i) => !fzzz.includes(i) && i !== numero,
        reset: (i) => autres.includes(i) && i !== numero,
        floods: (i) => [2, 3, terrain, ...epees].includes(i) || fzzz.includes(i),
      },
      courante = "reset",
      // partages du forum (une requête par sujet de membre) : lus seulement
      // quand la vue qui les affiche est choisie
      partagesLus = false,
      appliquer = (vue) => {
        courante = vue;
        for (let i = 0; i < n; i++) api.column(i).visible(vues[vue](i), false);
        $("#tabMembresAlliance").toggleClass("o_allVueFloods", vue == "floods");
        api.columns.adjust().draw(false);
        $(".o_allVue").removeClass("o_allVueActive");
        $(`.o_allVue[data-vue='${vue}']`).addClass("o_allVueActive");
        if (vue == "floods" && !partagesLus) {
          partagesLus = true;
          AllianceFzzz._charger(api, tempsTrajet, ouverture);
        }
      };
    let $boutons = $("#tabMembresAlliance_wrapper .dt-buttons");
    if (!$boutons.length)
      $boutons = $("<div class='dt-buttons'></div>").prependTo("#tabMembresAlliance_wrapper");
    $boutons.prepend(
      `<a class='dt-button o_allVue' data-vue='reset' href='#'><span>Standard</span></a>
       <a class='dt-button o_allVue' data-vue='trajet' href='#'><span>Temps de trajet</span></a>
       ${k ? `<a class='dt-button o_allVue' data-vue='floods' href='#'><span>Floods et chasses en cours</span></a>` : ""}`,
    );
    $boutons.find(".o_allVue").on("click", (e) => {
      e.preventDefault();
      let vue = e.currentTarget.dataset.vue,
        $b = $(e.currentTarget);
      if ($b.hasClass("disabled")) return false;
      // temps de trajet sans coordonnées en cache : on les récupère, puis on recharge
      if (vue == "trajet" && !avecTrajet) {
        $b.addClass("disabled").find("span").text("Temps de trajet…");
        // après le rechargement qui suit, la page s'ouvre sur cette vue
        try {
          sessionStorage.setItem(CLE_VUE_APRES_SYNCHRO, "trajet");
        } catch (err) {}
        synchroniser((faits, total) => $b.find("span").text(`Temps de trajet… (${faits}/${total})`))
          .then(() => location.reload())
          .catch((err) => {
            $b.removeClass("disabled").find("span").text("Temps de trajet");
            $.toast({ ...TOAST_ERROR, text: err.message || "Erreur de synchronisation." });
          });
        return false;
      }
      appliquer(vue);
      return false;
    });
    // vue choisie dans les préférences (« Temps de trajet » seulement si les
    // coordonnées sont en cache : sinon il faudrait les lire), ou celle qui
    // suit une synchronisation des temps de trajet
    let parDefaut = VUES_MEMBRES[parseInt(monProfil.parametre["vueMembres"].valeur) || 0],
      initiale =
        (parDefaut == "trajet" && !avecTrajet) || (parDefaut == "floods" && !k)
          ? "reset"
          : parDefaut;
    try {
      initiale = sessionStorage.getItem(CLE_VUE_APRES_SYNCHRO) || initiale;
      sessionStorage.removeItem(CLE_VUE_APRES_SYNCHRO);
    } catch (e) {}
    // largeur commune : celle de la vue la plus large, pour que l'encart ne
    // change pas de taille d'une vue à l'autre (les colonnes se répartissent)
    let vuesAffichees = k ? VUES_MEMBRES : VUES_MEMBRES.filter((v) => v != "floods"),
      fixerLargeur = () => {
        // écran étroit (mobile) : le tableau défile dans son cadre, pas de largeur fixe
        if (window.matchMedia && window.matchMedia("(max-width: 760px)").matches) return;
        let $t = $("#tabMembresAlliance"),
          $w = $("#tabMembresAlliance_wrapper"),
          vue = courante,
          max = 0;
        $w.css("width", "");
        $t.addClass("o_allMesure");
        vuesAffichees.forEach((v) => {
          for (let i = 0; i < n; i++) api.column(i).visible(vues[v](i), false);
          max = Math.max(max, $t.outerWidth());
        });
        $t.removeClass("o_allMesure");
        $w.css("width", max + "px");
        // second passage à la largeur fixée : une vue dont le contenu déborde
        // (rang à largeur fixe, en-têtes) agrandit la largeur commune
        vuesAffichees.forEach((v) => {
          for (let i = 0; i < n; i++) api.column(i).visible(vues[v](i), false);
          max = Math.max(max, $t.outerWidth());
        });
        // jamais plus large que le cadre de la page : les colonnes se resserrent
        let cadre = $w.parent().closest("#centre, center, div").innerWidth();
        if (cadre) max = Math.min(max, cadre);
        $w.css("width", max + "px");
        appliquer(vue);
      };
    AllianceFzzz._fixerLargeur = fixerLargeur;
    appliquer(initiale);
    fixerLargeur();
  }
  /**
   * Lit les sujets « Chasses » et « Floods » de la section du forum, remplit
   * les colonnes Fzzz et prépare l'infobulle de chaque ligne.
   *
   * @private
   */
  static _charger(api, tempsTrajet, ouverture) {
    PartageChasses.charger()
      .then((d) => AllianceFzzz._remplir(api, d, tempsTrajet, ouverture))
      .catch(() => {
        let n = api.settings()[0].aoColumns.length;
        api
          .rows()[0]
          .forEach((r) => $(api.cell(r, n - ALLIANCE_COLONNES_FZZZ.length).node()).text("—"));
      });
  }
  /**
   * Variation signée et colorée ; « ~ » si une prise n'est qu'estimée au lancement.
   *
   * @private
   */
  static _signe(v, estimee = false) {
    if (v == 0) return `<span>0</span>`;
    return `<span class='${v > 0 ? "o_varPos" : "o_varNeg"}'>${v > 0 ? "+" : "−"}${estimee ? "~" : ""}${numeral(Math.abs(v)).format()}</span>`;
  }
  /**
   * @private
   * @param {Function} tempsTrajet pseudo → temps de trajet (s), null si inconnu
   * @param {Object} ouverture heure (moment) d'une attaque lancée à l'ouverture de la page
   */
  static _remplir(api, d, tempsTrajet = () => null, ouverture = Horloge.clic()) {
    let $info = $("#o_allInfobulle");
    if (!$info.length) $info = $("<div id='o_allInfobulle'></div>").appendTo("body").hide();
    // cellules lues par l'API : celles des colonnes masquées ne sont pas dans la page
    let n = api.settings()[0].aoColumns.length,
      k = ALLIANCE_COLONNES_FZZZ.length,
      cellule = (r, c) => $(api.cell(r, c).node()),
      connus = {};
    // TdC actuels des membres (tableau du jeu) : base de la simulation des prises
    api.rows()[0].forEach((r) => {
      connus[cellule(r, 3).text().trim()] = numeral(cellule(r, 5).text()).value() || 0;
    });
    let sim = PartageChasses.simuler(d, connus),
      tactile = window.matchMedia && window.matchMedia("(hover: none)").matches,
      // infobulle près du pointeur, sans sortir de l'écran (mobile)
      placer = (x, y) => {
        let largeur = $info.outerWidth(),
          gauche = window.scrollX + 8,
          droite = window.scrollX + document.documentElement.clientWidth - largeur - 8;
        $info.css({ left: Math.max(gauche, Math.min(x + 16, droite)), top: y + 12 });
      };
    api.rows()[0].forEach((r) => {
      let $tr = $(api.row(r).node()),
        pseudo = cellule(r, 3).text().trim(),
        terrain = connus[pseudo],
        vars = PartageChasses.chronologie(sim, pseudo),
        total = vars.reduce((t, v) => t + v.delta, 0),
        final = terrain + total,
        dernier = vars[vars.length - 1],
        // on ne s'attaque pas soi-même
        moi = pseudo.toLowerCase() == String(monProfil.pseudo).toLowerCase(),
        arrivee = moi ? null : PartageChasses.arriveeAttaque(vars, tempsTrajet(pseudo), ouverture);
      cellule(r, n - k)
        .attr(
          "data-order",
          dernier ? moment(dernier.date, "YYYY-MM-DD HH:mm").unix() : ALLIANCE_SANS_MOUVEMENT,
        )
        .toggleClass("o_allVide", !dernier)
        .html(dernier ? moment(dernier.date, "YYYY-MM-DD HH:mm").format("DD/MM HH:mm") : "—");
      cellule(r, n - k + 1)
        .attr("data-order", total)
        .toggleClass("o_allVide", !dernier)
        .html(
          dernier
            ? AllianceFzzz._signe(
                total,
                vars.some((v) => v.statut == "inconnu"),
              )
            : "—",
        );
      cellule(r, n - 1)
        .attr("data-order", final)
        .html(numeral(final).format());
      // infobulle : TdC après chaque variation, comme la synthèse de la page membre
      let html = `<div class='gras'>${Utils.echapper(pseudo)}</div>${
        vars.length
          ? `<table cellspacing='0'>${PartageChasses.lignesEvolution(terrain, vars, arrivee ? arrivee.ligne : null, "gras")}</table>` +
            PartageChasses.noteArrivee(
              arrivee,
              moi
                ? ""
                : "TdC à l'arrivée d'une attaque : temps de trajet inconnu (vue « Temps de trajet »).",
            )
          : "<em>Aucune variation partagée en cours.</em>"
      }`;
      // souris : au survol ; écran tactile (pas de survol) : au toucher de la ligne
      if (tactile)
        $tr.on("click", (e) => {
          if ($(e.target).closest("a, button, input").length) return;
          if ($info.is(":visible") && $info.data("ligne") === r) return $info.hide();
          $info.html(html).data("ligne", r).show();
          placer(e.pageX, e.pageY);
        });
      else
        $tr
          .on("mouseenter", () => $info.html(html).data("ligne", r).show())
          .on("mousemove", (e) => placer(e.pageX, e.pageY))
          .on("mouseleave", () => $info.hide());
    });
    if (tactile)
      $(document).on("click", (e) => {
        if (!$(e.target).closest("#tabMembresAlliance tbody tr, #o_allInfobulle").length)
          $info.hide();
      });
    api.rows().invalidate("dom").draw(false);
    // les colonnes remplies ont pu élargir la vue « Floods et chasses »
    if (AllianceFzzz._fixerLargeur) AllianceFzzz._fixerLargeur();
  }
}
