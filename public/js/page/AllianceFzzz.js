/*
 * AllianceFzzz.js
 * NumeroBis-boop
 **********************************************************************/

// vue à rouvrir après le rechargement qui suit « Temps de trajet » synchronisé
const CLE_VUE_APRES_SYNCHRO = "fzzz_vueMembresApresSynchro";
// vues de la page Membres, dans l'ordre du réglage « vueMembres »
const VUES_MEMBRES = ["reset", "trajet", "floods"];
// police du tableau des membres réduite jusqu'à ce pourcentage pour qu'il tienne en entier
const TAILLE_MIN_MEMBRES = 60;
let ajustementMembresActif = false;
// membre sans mouvement en cours, ou sans temps de trajet connu : après les autres dans le tri croissant
const ALLIANCE_SANS_MOUVEMENT = 9999999999;
// colonnes ajoutées en fin de ligne au tableau des membres, montrées dans la vue
// « Floods et chasses en cours » quand leur case des Préférences est cochée ;
// forum : remplie d'après les partages du forum, lus au premier choix de la vue
const ALLIANCE_COLONNES_FZZZ = [
  {
    cle: "membresFloodsDernier",
    titre: "Date dernier<br/>mouvement",
    forum: true,
    ordre: ALLIANCE_SANS_MOUVEMENT,
  },
  { cle: "membresFloodsTotal", titre: "Variation<br/>totale de TdC", forum: true, ordre: 0 },
  {
    cle: "membresFloodsProchain",
    titre: "Date du prochain<br/>mouvement",
    forum: true,
    ordre: ALLIANCE_SANS_MOUVEMENT,
  },
  { cle: "membresFloodsVariation", titre: "Prochaine<br/>variation de TdC", forum: true, ordre: 0 },
  { cle: "membresFloodsFinal", titre: "TdC<br/>final", forum: true, ordre: 0 },
  {
    cle: "membresFloodsTrajet",
    titre: "Temps de<br/>trajet",
    forum: false,
    ordre: ALLIANCE_SANS_MOUVEMENT,
  },
  // rapport d'une attaque lancée à l'ouverture de la page, comme la colonne
  // « Retour » de la vue « Temps de trajet »
  { cle: "membresFloodsRetour", titre: "Retour", forum: false, ordre: ALLIANCE_SANS_MOUVEMENT },
  // copie des cellules « Etat » du jeu : sa colonne ne peut pas passer après
  // celles de l'extension sans changer l'ordre de la vue « Standard »
  { cle: "membresFloodsEtat", titre: "État de<br/>la colonie", forum: false, ordre: "" },
];

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
        ALLIANCE_COLONNES_FZZZ.map(
          (c, i) => `<th class='o_allColFzzz o_allCol${i}'>${c.titre}</th>`,
        ).join(""),
      );
    // rang : largeur au plus juste (le libellé ne passe plus sur toute la ligne)
    $t.find("thead th:eq(2)").addClass("o_allRang");
    $t.find("tbody tr").each((i, tr) => $(tr).find("td:eq(2)").addClass("o_allRang"));
    if (AllianceFzzz.avecFloods)
      $t.find("tbody tr").each((i, tr) => {
        $(tr).append(
          ALLIANCE_COLONNES_FZZZ.map(
            (c, j) =>
              `<td class='o_allColFzzz o_allCol${j}' data-order='${c.ordre}'>${c.forum ? "…" : ""}</td>`,
          ).join(""),
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
    // coordonnées de la Carte, sinon celles de l'export des joueurs gardé
    let tempsVers = (pseudo) => AllianceFzzz.trajet(pseudo, tempsTrajet);
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
      // les deux cellules du jeu sous l'en-tête « Etat » (fusionné : header() n'y mène pas)
      etat = [...Array(n).keys()].filter(
        (i) => $(api.settings()[0].aoHeader[0]?.[i]?.cell).text().trim() == "Etat",
      ),
      // vue « Floods » : les colonnes cochées dans les Préférences ; aucune : le pseudo
      choisies = [
        ...(Utils.affichage("membresFloodsRang") ? [2] : []),
        ...(Utils.affichage("membresFloodsPseudo") ? [3] : []),
        ...(Utils.affichage("membresFloodsTdc") ? [terrain, ...epees] : []),
        ...fzzz.filter((c, j) => Utils.affichage(ALLIANCE_COLONNES_FZZZ[j].cle)),
      ],
      floods = choisies.length ? choisies : [3],
      vues = {
        trajet: (i) => !fzzz.includes(i) && i !== numero,
        reset: (i) => autres.includes(i) && i !== numero,
        floods: (i) => floods.includes(i),
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
        AllianceFzzz.ajusterTaille();
        $(".o_allVue").removeClass("o_allVueActive");
        $(`.o_allVue[data-vue='${vue}']`).addClass("o_allVueActive");
        if (vue == "floods" && !partagesLus) {
          partagesLus = true;
          AllianceFzzz._charger(api, tempsVers, ouverture);
          if (
            k &&
            (Utils.affichage("membresFloodsTrajet") || Utils.affichage("membresFloodsRetour"))
          )
            AllianceFzzz._completerTrajets(api, tempsTrajet, ouverture);
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
        // écran étroit (mobile) : le cadre suit le tableau jusqu'à la largeur de
        // l'écran, pas de largeur fixe ; la police se réduit s'il ne tient pas
        if (window.matchMedia && window.matchMedia("(max-width: 760px)").matches)
          return AllianceFzzz.ajusterTaille();
        let $t = $("#tabMembresAlliance"),
          $w = $("#tabMembresAlliance_wrapper"),
          vue = courante,
          max = 0;
        // mesuré à la police entière : réduite, la largeur commune rétrécirait à chaque passage
        $t.css("font-size", "");
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
    // une colonne illisible ne doit pas empêcher les vues de s'installer
    if (k)
      try {
        AllianceFzzz._remplirTrajets(api, tempsVers, ouverture);
      } catch (e) {
        console.error("Fzzz : temps de trajet des membres", e);
      }
    if (k && Utils.affichage("membresFloodsEtat"))
      try {
        AllianceFzzz._copierEtats(api, etat);
      } catch (e) {
        console.error("Fzzz : état de la colonie des membres", e);
      }
    appliquer(initiale);
    fixerLargeur();
  }
  /**
   * Police du tableau des membres réduite par pas de 5 %, jusqu'à
   * TAILLE_MIN_MEMBRES, tant qu'il dépasse de son cadre ; refaite quand la
   * fenêtre change de taille (affichage seulement).
   *
   * @static
   * @method ajusterTaille
   */
  static ajusterTaille() {
    let t = document.getElementById("tabMembresAlliance"),
      w = document.getElementById("tabMembresAlliance_wrapper");
    if (!t || !w) return;
    t.style.fontSize = "";
    // tableau caché (Carte, Stats membres) : rien à mesurer
    if (!w.clientWidth) return;
    let base = parseFloat(getComputedStyle(t).fontSize),
      taille = 100,
      deborde = () => Math.max(w.scrollWidth, t.offsetWidth) > w.clientWidth + 1;
    while (taille > TAILLE_MIN_MEMBRES && deborde()) {
      taille -= 5;
      t.style.fontSize = (base * taille) / 100 + "px";
    }
    if (!ajustementMembresActif) {
      ajustementMembresActif = true;
      /** @type {any} */
      let attente = null;
      $(window).on("resize", () => {
        clearTimeout(attente);
        attente = setTimeout(
          () => (AllianceFzzz._fixerLargeur || AllianceFzzz.ajusterTaille)(),
          150,
        );
      });
    }
  }
  /**
   * Temps de trajet jusqu'à un membre, à ma Vitesse d'attaque (niveau lu sur
   * la page Laboratoire, relu après chaque recherche) : coordonnées de la
   * Carte de l'alliance (vue « Temps de trajet »), sinon celles de l'export
   * des joueurs gardé dans le navigateur (ExportJoueurs).
   *
   * @static
   * @method trajet
   * @param {String} pseudo
   * @param {Function} tempsTrajet celui de la page (coordonnées de la Carte)
   * @return {Number|null} secondes, null si inconnu
   */
  static trajet(pseudo, tempsTrajet = () => null) {
    let s = tempsTrajet(pseudo);
    if (s != null) return s;
    if (!((monProfil.niveauRecherche || [])[6] >= 0)) return null;
    let base = Utils.lireStockage(ExportJoueurs.cle).joueurs || {},
      cle =
        pseudo in base
          ? pseudo
          : Object.keys(base).find((p) => p.toLowerCase() == String(pseudo).toLowerCase()),
      c = cle ? base[cle] : null;
    return c ? monProfil.getTempsParcours2({ x: c[0], y: c[1] }) : null;
  }
  /**
   * Colonnes « Temps de trajet » et « Retour » de la vue « Floods »
   * (AllianceFzzz.trajet) : le retour est celui de la vue « Temps de
   * trajet », départ à l'ouverture de la page, à la minute du rapport.
   * Sans requête.
   *
   * @private
   * @static
   * @param {Function} trajet pseudo → temps de trajet (s), null si inconnu
   * @param {Object} ouverture heure (moment) de l'ouverture de la page
   * @return {Number} nombre de membres sans temps de trajet
   */
  static _remplirTrajets(api, trajet, ouverture = Horloge.clic()) {
    let c = AllianceFzzz._colonne(api, "membresFloodsTrajet"),
      cr = AllianceFzzz._colonne(api, "membresFloodsRetour"),
      inconnus = 0;
    api.rows()[0].forEach((r) => {
      let s = trajet($(api.cell(r, 3).node()).text().trim()),
        retour = s != null ? Utils.roundMinute(s, ouverture) : null;
      if (s == null) inconnus++;
      $(api.cell(r, c).node())
        .attr("data-order", s != null ? s : ALLIANCE_SANS_MOUVEMENT)
        .toggleClass("o_allVide", s == null)
        .text(s != null ? Utils.intToTime(s) : "N/C");
      $(api.cell(r, cr).node())
        .attr("data-order", retour ? retour.unix() : ALLIANCE_SANS_MOUVEMENT)
        .toggleClass("o_allVide", !retour)
        .text(retour ? retour.format("D MMM à HH[h]mm") : "N/C");
    });
    api.rows().invalidate("dom");
    return inconnus;
  }
  /**
   * Colonne « État de la colonie » de la vue « Floods » : copie du contenu des
   * cellules « Etat » du jeu, sans leurs id (uniques dans la page), triée sur
   * leur texte et celui de leurs images. Sans requête.
   *
   * @private
   * @static
   * @param {Number[]} etat indices des cellules « Etat » du jeu
   */
  static _copierEtats(api, etat) {
    let c = AllianceFzzz._colonne(api, "membresFloodsEtat");
    api.rows()[0].forEach((r) => {
      let $copie = $(api.cell(r, c).node()).empty(),
        textes = [];
      etat.forEach((i) => {
        let $td = $(api.cell(r, i).node()),
          texte = [
            $td.text().trim(),
            ...$td
              .find("img")
              .map((j, img) => img.alt || img.title)
              .get(),
          ]
            .filter(Boolean)
            .join(" ");
        if (!texte && !$td.children().length) return;
        if (textes.length) $copie.append(" ");
        $copie.append($td.contents().clone());
        textes.push(texte);
      });
      $copie.find("[id]").removeAttr("id");
      $copie.attr("data-order", textes.filter(Boolean).join(" "));
    });
    api.rows().invalidate("dom");
  }
  /**
   * Membres sans coordonnées connues : l'export public des joueurs (une
   * requête, relue au plus une fois par heure, ExportJoueurs.base), lu au
   * premier choix de la vue « Floods » quand sa colonne « Temps de trajet »
   * ou « Retour » est cochée, puis les colonnes refaites.
   *
   * @private
   * @static
   * @param {Function} tempsTrajet celui de la page (coordonnées de la Carte)
   * @param {Object} ouverture heure (moment) de l'ouverture de la page
   */
  static _completerTrajets(api, tempsTrajet, ouverture = Horloge.clic()) {
    let trajet = (p) => AllianceFzzz.trajet(p, tempsTrajet);
    if (
      !((monProfil.niveauRecherche || [])[6] >= 0) ||
      !AllianceFzzz._remplirTrajets(api, trajet, ouverture)
    )
      return Promise.resolve();
    return ExportJoueurs.base()
      .then(() => {
        AllianceFzzz._remplirTrajets(api, trajet, ouverture);
        api.draw(false);
      })
      .catch((e) => Journal.info("Membres", "temps de trajet : export des joueurs illisible", e));
  }
  /**
   * Indice dans le tableau d'une colonne ajoutée (ALLIANCE_COLONNES_FZZZ).
   *
   * @private
   * @static
   * @param {String} cle
   * @return {Number}
   */
  static _colonne(api, cle) {
    return (
      api.settings()[0].aoColumns.length -
      ALLIANCE_COLONNES_FZZZ.length +
      ALLIANCE_COLONNES_FZZZ.findIndex((c) => c.cle == cle)
    );
  }
  /**
   * Lit les sujets communs des chasses et des floods du forum, remplit
   * les colonnes Fzzz et prépare l'infobulle de chaque ligne.
   *
   * @private
   */
  static _charger(api, tempsTrajet, ouverture) {
    let mesure = Journal.mesurer("Page Membres, vue « Floods et chasses en cours »");
    PartageChasses.charger()
      .then((d) => AllianceFzzz._remplir(api, d, tempsTrajet, ouverture))
      .catch(() =>
        ALLIANCE_COLONNES_FZZZ.filter((c) => c.forum).forEach((c) => {
          let col = AllianceFzzz._colonne(api, c.cle);
          api.rows()[0].forEach((r) => $(api.cell(r, col).node()).text("—"));
        }),
      )
      .then(mesure.fin);
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
    let cellule = (r, c) => $(api.cell(r, c).node()),
      colonne = (cle) => AllianceFzzz._colonne(api, cle),
      connus = {};
    // TdC actuels des membres (tableau du jeu) : base de la simulation des prises
    api.rows()[0].forEach((r) => {
      connus[cellule(r, 3).text().trim()] = numeral(cellule(r, 5).text()).value() || 0;
    });
    let sim = PartageChasses.simuler(d, connus),
      monPseudo = String(monProfil.pseudo || "").toLowerCase(),
      monTerrain =
        Object.entries(connus).find(([p]) => p.toLowerCase() == monPseudo)?.[1] || Utils.terrain,
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
        // prochain mouvement : la première minute où son TdC change, avec tous
        // ses mouvements (un multi-flood compte pour un) ; une minute dont les
        // prises sont nulles (hors portée) ne compte pas (règle du mainteneur)
        somme = (lignes) => lignes.reduce((t, v) => t + v.delta, 0),
        minute = vars.map((v) => v.date).find((d) => somme(vars.filter((v) => v.date == d)) != 0),
        prochains = vars.filter((v) => v.date == minute),
        prochaine = somme(prochains),
        // on ne s'attaque pas soi-même
        moi = pseudo.toLowerCase() == String(monProfil.pseudo).toLowerCase(),
        trajet = moi ? null : tempsTrajet(pseudo),
        arrivee = moi ? null : PartageChasses.arriveeAttaque(vars, trajet, ouverture),
        synchro = moi
          ? null
          : {
              secondes: trajet,
              maintenant: ouverture,
              portee: PartageChasses.porteeParMinute(sim, pseudo, terrain, monTerrain),
            },
        date = (v, cle) =>
          cellule(r, colonne(cle))
            .attr(
              "data-order",
              v ? moment(v.date, "YYYY-MM-DD HH:mm").unix() : ALLIANCE_SANS_MOUVEMENT,
            )
            .toggleClass("o_allVide", !v)
            .html(v ? moment(v.date, "YYYY-MM-DD HH:mm").format("DD/MM HH:mm") : "—"),
        variation = (lignes, somme, cle) =>
          cellule(r, colonne(cle))
            .attr("data-order", somme)
            .toggleClass("o_allVide", !lignes.length)
            .html(
              lignes.length
                ? AllianceFzzz._signe(
                    somme,
                    lignes.some((v) => v.statut == "inconnu"),
                  )
                : "—",
            );
      date(dernier, "membresFloodsDernier");
      variation(vars, total, "membresFloodsTotal");
      date(prochains[0], "membresFloodsProchain");
      variation(prochains, prochaine, "membresFloodsVariation");
      cellule(r, colonne("membresFloodsFinal"))
        .attr("data-order", final)
        .html(numeral(final).format());
      // infobulle : TdC après chaque variation, comme la synthèse de la page membre
      let html = `<div class='gras'>${Utils.echapper(pseudo)}${PartageChasses.mentionPortee(PartageChasses.portee(sim, pseudo, terrain, monTerrain))}</div>${
        vars.length
          ? `<table cellspacing='0'>${PartageChasses.lignesEvolution(terrain, vars, arrivee ? arrivee.ligne : null, "gras", synchro)}</table>` +
            PartageChasses.noteArrivee(
              arrivee,
              moi
                ? ""
                : "TdC à l'arrivée d'une attaque : temps de trajet inconnu (vue « Temps de trajet »).",
            ) +
            PartageChasses.noteSynchro(vars, synchro)
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
