/*
 * AllianceFzzz.js
 * NumeroBis-boop
 **********************************************************************/

// colonnes ajoutées en fin de ligne au tableau des membres
const ALLIANCE_COLONNES_FZZZ = [
  "Prochaine<br/>variation",
  "Montant",
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
        `<td class='o_allVar o_allCol0' data-order='99999999'>…</td><td class='o_allMontant o_allCol1' data-order='0'></td><td class='o_allCible o_allCol2'></td><td class='o_allFinal o_allCol3' data-order='0'></td>`,
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
      fzzz = [n - 4, n - 3, n - 2, n - 1],
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
    appliquer(initiale);
    AllianceFzzz._charger(api);
  }
  /**
   * Lit les sujets « Chasses » et « Floods » de la section du forum, remplit
   * les colonnes Fzzz et prépare l'infobulle de chaque ligne.
   *
   * @private
   */
  static _charger(api) {
    PartageChasses.sujets()
      .then((sujets) => {
        let chasses = {},
          floods = [],
          liste = sujets.liste,
          lirePaquet = (k) =>
            k >= liste.length
              ? Promise.resolve()
              : Promise.all(
                  liste.slice(k, k + 4).map((t) =>
                    PartageChasses.lireSujet(t.id)
                      .then((d) => {
                        if (t.type == "Chasses") chasses[t.pseudo.toLowerCase()] = d.chasses;
                        else d.floods.forEach((e) => floods.push({ ...e, lanceur: t.pseudo }));
                      })
                      .catch(() => {}),
                  ),
                ).then(() => lirePaquet(k + 4));
        return lirePaquet(0).then(() => ({ chasses: chasses, floods: floods }));
      })
      .then((d) => AllianceFzzz._remplir(api, d))
      .catch(() => {
        let n = api.settings()[0].aoColumns.length;
        api.rows()[0].forEach((r) => $(api.cell(r, n - 4).node()).text("—"));
      });
  }
  /**
   * Variations futures d'un joueur, regroupées par minute :
   * [{date, delta, autres: [libellés]}], dans l'ordre.
   *
   * @static
   * @method variations
   */
  static variations(pseudo, d) {
    let p = pseudo.toLowerCase(),
      maintenant = Horloge.serveur().format("YYYY-MM-DD HH:mm"),
      evts = [];
    (d.chasses[p] || []).forEach((e) =>
      evts.push({ date: e.date, delta: e.terrain, autre: "Chasse" }),
    );
    d.floods.forEach((e) => {
      let vers = e.cible.toLowerCase() == p,
        depuis = e.lanceur.toLowerCase() == p;
      if (vers == depuis) return;
      // flood envoyé : la cible ; flood reçu : le lanceur
      evts.push({
        date: e.date,
        delta: vers ? -e.terrain : e.terrain,
        autre: vers ? e.lanceur : e.cible,
      });
    });
    let parMinute = {};
    evts
      .filter((e) => e.date >= maintenant)
      .forEach((e) => {
        let m = (parMinute[e.date] = parMinute[e.date] || { date: e.date, delta: 0, autres: [] });
        m.delta += e.delta;
        if (!m.autres.includes(e.autre)) m.autres.push(e.autre);
      });
    return Object.values(parMinute).sort((a, b) => (a.date < b.date ? -1 : 1));
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
      cellule = (r, c) => $(api.cell(r, c).node());
    api.rows()[0].forEach((r) => {
      let $tr = $(api.row(r).node()),
        pseudo = cellule(r, 3).text().trim(),
        terrain = numeral(cellule(r, 5).text()).value() || 0,
        vars = AllianceFzzz.variations(pseudo, d),
        final = terrain + vars.reduce((t, v) => t + v.delta, 0),
        p = vars[0];
      cellule(r, n - 4)
        .attr("data-order", p ? moment(p.date, "YYYY-MM-DD HH:mm").unix() : 99999999)
        .toggleClass("o_allVide", !p)
        .html(p ? moment(p.date, "YYYY-MM-DD HH:mm").format("DD/MM HH:mm") : "—");
      cellule(r, n - 3)
        .attr("data-order", p ? p.delta : 0)
        .toggleClass("o_allVide", !p)
        .html(p ? AllianceFzzz._signe(p.delta) : "—");
      cellule(r, n - 2)
        .toggleClass("o_allVide", !p)
        .html(p ? p.autres.join(", ") : "—");
      cellule(r, n - 1)
        .attr("data-order", final)
        .html(numeral(final).format());
      // infobulle : TdC après chaque variation, comme la synthèse de la page membre
      let tdc = terrain,
        lignes = [`<tr><td>Actuellement</td><td>${numeral(tdc).format()} cm²</td><td></td></tr>`];
      vars.forEach((v) => {
        tdc += v.delta;
        lignes.push(
          `<tr><td>${moment(v.date, "YYYY-MM-DD HH:mm").format("DD/MM HH[h]mm")}</td><td>${numeral(tdc).format()} cm²</td><td class='o_partageVariation'>(${AllianceFzzz._signe(v.delta)})</td></tr>`,
        );
      });
      let html = `<div class='gras'>${pseudo}</div>${
        vars.length
          ? `<table cellspacing='0'>${lignes.join("")}</table>`
          : "<em>Aucune variation partagée en cours.</em>"
      }`;
      $tr
        .on("mouseenter", () => $info.html(html).show())
        .on("mousemove", (e) => $info.css({ left: e.pageX + 16, top: e.pageY + 12 }))
        .on("mouseleave", () => $info.hide());
    });
    api.rows().invalidate("dom").draw(false);
  }
}
