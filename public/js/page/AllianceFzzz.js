/*
 * AllianceFzzz.js
 * NumeroBis-boop
 **********************************************************************/

// colonnes ajoutées en fin de ligne au tableau des membres
const ALLIANCE_COLONNES_FZZZ = [
  "Prochaine<br/>variation",
  "Unités<br/>envoyées",
  "TdC<br/>(estimé)",
  "Joueur cible",
  "TdC<br/>final",
];

/**
 * Page Membres de l'alliance : vues « Temps de trajet », « Reset » (tableau
 * du jeu) et « Floods et chasses en cours », et infobulle de l'évolution
 * future du TdC au survol d'une ligne, à partir des chasses et floods
 * partagés dans le forum (PartageChasses).
 *
 * @class AllianceFzzz
 */
class AllianceFzzz {
  /**
   * Ajoute les 4 colonnes Fzzz (vides) avant l'initialisation de DataTable.
   *
   * @static
   * @method colonnes
   */
  static colonnes() {
    let $t = $("#tabMembresAlliance");
    $t.find("thead tr").append(
      ALLIANCE_COLONNES_FZZZ.map((c, i) => `<th class='o_allCol${i}'>${c}</th>`).join(""),
    );
    // rang : largeur au plus juste (le libellé ne passe plus sur toute la ligne)
    $t.find("thead th:eq(2)").addClass("o_allRang");
    $t.find("tbody tr").each((i, tr) => $(tr).find("td:eq(2)").addClass("o_allRang"));
    $t.find("tbody tr").each((i, tr) => {
      $(tr).append(
        `<td class='o_allVar o_allCol0' data-order='99999999'>…</td><td class='o_allUnites o_allCol1' data-order='0'></td><td class='o_allMontant o_allCol2' data-order='0'></td><td class='o_allCible o_allCol3'></td><td class='o_allFinal o_allCol4' data-order='0'></td>`,
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
   * Boutons de vue, chargement des partages et infobulle.
   *
   * @static
   * @method installer
   * @param {Function} synchroniser récupère les coordonnées (ancien « Synchroniser »)
   * @param {Boolean} avecTrajet colonnes Tdt / Retour présentes (coordonnées en cache)
   */
  static installer(synchroniser, avecTrajet) {
    let api = $("#tabMembresAlliance").DataTable(),
      // nombre de colonnes lu dans les réglages : columns() sans sélecteur plante en 1.10.16
      n = api.settings()[0].aoColumns.length,
      k = ALLIANCE_COLONNES_FZZZ.length,
      fzzz = [...Array(k).keys()].map((i) => n - k + i),
      trajet = avecTrajet ? [9, 10] : [],
      // colonne de numérotation du jeu (1, 2, 3…) : masquée dans toutes les vues
      numero = [0, 1].find((c) =>
        api.rows()[0].every((r) => /^\s*\d+\s*$/.test($(api.cell(r, c).node()).text())),
      ),
      autres = [...Array(n).keys()].filter((i) => !fzzz.includes(i) && !trajet.includes(i)),
      vues = {
        trajet: (i) => !fzzz.includes(i) && i !== numero,
        reset: (i) => autres.includes(i) && i !== numero,
        floods: (i) => [2, 3, 5].includes(i) || fzzz.includes(i),
      },
      appliquer = (vue) => {
        for (let i = 0; i < n; i++) api.column(i).visible(vues[vue](i), false);
        api.columns.adjust().draw(false);
        $(".o_allVue").removeClass("o_allVueActive");
        $(`.o_allVue[data-vue='${vue}']`).addClass("o_allVueActive");
        try {
          sessionStorage.setItem("fzzz_vueMembres", vue);
        } catch (e) {}
      };
    let $boutons = $("#tabMembresAlliance_wrapper .dt-buttons");
    if (!$boutons.length)
      $boutons = $("<div class='dt-buttons'></div>").prependTo("#tabMembresAlliance_wrapper");
    $boutons.prepend(
      `<a class='dt-button o_allVue' data-vue='reset' href='#'><span>Standard</span></a>
       <a class='dt-button o_allVue' data-vue='trajet' href='#'><span>Temps de trajet</span></a>
       <a class='dt-button o_allVue' data-vue='floods' href='#'><span>Floods et chasses en cours</span></a>`,
    );
    $boutons.find(".o_allVue").on("click", (e) => {
      e.preventDefault();
      let vue = e.currentTarget.dataset.vue,
        $b = $(e.currentTarget);
      if ($b.hasClass("disabled")) return false;
      // temps de trajet sans coordonnées en cache : on les récupère, puis on recharge
      if (vue == "trajet" && !avecTrajet) {
        $b.addClass("disabled").find("span").text("Temps de trajet…");
        try {
          sessionStorage.setItem("fzzz_vueMembres", "trajet");
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
    let initiale = "trajet";
    try {
      initiale = sessionStorage.getItem("fzzz_vueMembres") || "trajet";
    } catch (e) {}
    // largeur commune : celle de la vue la plus large, pour que l'encart ne
    // change pas de taille d'une vue à l'autre (les colonnes se répartissent)
    let fixerLargeur = () => {
      // écran étroit (mobile) : le tableau défile dans son cadre, pas de largeur fixe
      if (window.matchMedia && window.matchMedia("(max-width: 760px)").matches) return;
      let $t = $("#tabMembresAlliance"),
        $w = $("#tabMembresAlliance_wrapper"),
        courante = sessionStorage.getItem("fzzz_vueMembres") || initiale,
        max = 0;
      $w.css("width", "");
      $t.addClass("o_allMesure");
      ["reset", "trajet", "floods"].forEach((v) => {
        for (let i = 0; i < n; i++) api.column(i).visible(vues[v](i), false);
        max = Math.max(max, $t.outerWidth());
      });
      $t.removeClass("o_allMesure");
      $w.css("width", max + "px");
      // second passage à la largeur fixée : une vue dont le contenu déborde
      // (rang à largeur fixe, en-têtes) agrandit la largeur commune
      ["reset", "trajet", "floods"].forEach((v) => {
        for (let i = 0; i < n; i++) api.column(i).visible(vues[v](i), false);
        max = Math.max(max, $t.outerWidth());
      });
      $w.css("width", max + "px");
      appliquer(courante);
    };
    AllianceFzzz._fixerLargeur = fixerLargeur;
    appliquer(initiale);
    fixerLargeur();
    AllianceFzzz._charger(api);
  }
  /**
   * Lit les sujets « Chasses » et « Floods » de la section du forum, remplit
   * les colonnes Fzzz et prépare l'infobulle de chaque ligne.
   *
   * @private
   */
  static _charger(api) {
    PartageChasses.charger()
      .then((d) => AllianceFzzz._remplir(api, d))
      .catch(() => {
        let n = api.settings()[0].aoColumns.length;
        api
          .rows()[0]
          .forEach((r) => $(api.cell(r, n - ALLIANCE_COLONNES_FZZZ.length).node()).text("—"));
      });
  }
  /**
   * @private
   */
  static _signe(v) {
    return `<span class='${v >= 0 ? "o_varPos" : "o_varNeg"}'>${v >= 0 ? "+" : "−"}${numeral(Math.abs(v)).format()}</span>`;
  }
  /**
   * @private
   */
  static _remplir(api, d) {
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
        final = terrain + vars.reduce((t, v) => t + v.delta, 0),
        p = vars[0];
      cellule(r, n - k)
        .attr("data-order", p ? moment(p.date, "YYYY-MM-DD HH:mm").unix() : 99999999)
        .toggleClass("o_allVide", !p)
        .html(p ? moment(p.date, "YYYY-MM-DD HH:mm").format("DD/MM HH:mm") : "—");
      cellule(r, n - k + 1)
        .attr("data-order", p && p.flood && p.unites != null ? p.unites : 0)
        .toggleClass("o_allVide", !(p && p.flood))
        .html(p && p.flood ? (p.unites != null ? numeral(p.unites).format() : "?") : "—");
      cellule(r, n - k + 2)
        .attr("data-order", p ? p.delta : 0)
        .toggleClass("o_allVide", !p)
        .html(p ? PartageChasses.libellePrise(p, "") : "—");
      cellule(r, n - k + 3)
        .toggleClass("o_allVide", !p)
        .html(p ? p.autre : "—");
      cellule(r, n - 1)
        .attr("data-order", final)
        .html(numeral(final).format());
      // infobulle : TdC après chaque variation, comme la synthèse de la page membre
      let tdc = terrain,
        lignes = [
          `<tr class='gras'><td></td><td>TdC</td><td>Variation</td><td>Unités</td><td>Avec</td></tr>`,
          `<tr><td>Actuellement</td><td>${numeral(tdc).format()} cm²</td><td></td><td></td><td></td></tr>`,
        ];
      vars.forEach((v) => {
        tdc += v.delta;
        lignes.push(
          `<tr><td>${moment(v.date, "YYYY-MM-DD HH:mm").format("DD/MM HH[h]mm")}</td><td>${numeral(tdc).format()} cm²</td><td class='o_partageVariation'>${PartageChasses.libellePrise(v, "")}</td><td class='o_partageVariation'>${v.flood && v.unites != null ? numeral(v.unites).format() : ""}</td><td class='o_allInfoCible'>${v.autre}</td></tr>`,
        );
      });
      let html = `<div class='gras'>${pseudo}</div>${
        vars.length
          ? `<table cellspacing='0'>${lignes.join("")}</table>`
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
