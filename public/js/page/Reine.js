/*
 * Reine.js
 * Hraesvelg
 **********************************************************************/

/**
 * Classe de fonction pour la page /reine.php.
 *
 * @class PageReine
 * @constructor
 * @extends Page
 */
class PageReine {
  constructor(boiteComptePlus) {
    /**
     * Accés à la boite compte+
     */
    this._boiteComptePlus = boiteComptePlus;
  }
  /**
   * Modifie les champs de saisie, sauvegarde la ponte en cours.
   * @method plus
   */
  plus() {
    // Affichage de la fin des pontes
    $(".tableau_leger tr:eq(0)").append("<td><strong>Terminé le</strong></td>");
    $(".tableau_leger tr:gt(0)").each((i, elt) => {
      $(elt).append(
        `<td>${Utils.roundMinute($(elt).next().text().split(",")[0].split("(")[1]).format("D MMM YYYY à HH[h]mm")}</td>`,
      );
    });
    $(
      "span[id^='bouton_cout_nombre'], span[id^='bouton_cout_temps'], span[id^='bouton_cout_nourriture'], .icones_unite",
    ).addClass("cliquable3");
    $(".icones_unite").attr("onclick", "$('.tab_stat').toggle();");
    // Ajout des statistiques des unités avec bonus
    $(".icones_unite").each((i, elt) => {
      let index = NOM_UNITE.indexOf($(elt).parent().find("h2").text());
      $(elt).append(
        `<table class="tab_stat" style="display: none;"><tbody><tr><td style="text-align:center;font-size:0.8em;height:30px;" colspan="2"> Avec Bonus</td></tr><tr title="Vie avec Bouclier niveau ${monProfil.niveauRecherche[1]}"><td class="icone_vie" style="position:relative; top:4px">${IMG_VIE}</td><td class="vie" style="white-space:nowrap">${VIE_UNITE[index] + ((VIE_UNITE[index] / 10) * monProfil.niveauRecherche[1]).toFixed(1) / 1}</td></tr><tr title="Dégâts en Attaque avec Armes niveau ${monProfil.niveauRecherche[2]}"><td class="icone_degat_attaque" style="position:relative;top:3px">${IMG_ATT}</td><td class="degat_defense" style="white-space:nowrap">${ATT_UNITE[index] + ((ATT_UNITE[index] / 10) * monProfil.niveauRecherche[2]).toFixed(1) / 1}</td></tr><tr title="Dégâts en Défense avec Armes niveau ${monProfil.niveauRecherche[2]}"><td class="icone_degat_defense" style="position:relative;top:3px">${IMG_DEF}</td><td class="degat_defense" style="white-space:nowrap">${DEF_UNITE[index] + ((DEF_UNITE[index] / 10) * monProfil.niveauRecherche[2]).toFixed(1) / 1}</td></tr><tr><td style="height:30px;" colspan="2"></td></tr></tbody></table>`,
      );
    });
    // Switch entre les inputs : clic sur un bouton-span → on ouvre son input
    // (et on referme les autres). Les natifs Fourmizzz appellent
    // `ouvrir_input` / `fermer_input` via des inline `onclick` / `onblur`,
    // mais ces fonctions semblent C+-only — chez nous elles peuvent throw
    // silencieusement et bloquer le reste. On vire les attributs inline pour
    // que seuls nos handlers jQuery (plus bas) prennent la main.
    $(
      "span[id^='bouton_cout_nombre'], span[id^='bouton_cout_temps'], span[id^='bouton_cout_nourriture']",
    ).removeAttr("onclick");
    $(
      "input[id^='input_cout_nombre'], input[id^='input_cout_temps'], input[id^='input_cout_nourriture']",
    )
      .removeAttr("onblur")
      .removeAttr("onkeyup");
    // Le HTML natif non-C+ oublie height/width sur #cout_nombre alors que
    // cout_temps et cout_nourriture les ont — du coup le span fourmi se
    // redimensionne au contenu et casse l'alignement visuel avec les deux
    // autres. On aligne ici.
    $("span[id^='cout_nombre']").css({ height: "20px", width: "85px" });
    // État initial forcé : tous les spans visibles, tous les inputs cachés.
    // Sans ça, l'input nombre de la page native peut apparaître ouvert dès le
    // chargement (au lieu d'être en mode display compact comme côté C+).
    $("span[id^='cout_nombre'], span[id^='cout_temps'], span[id^='cout_nourriture']").css(
      "display",
      "inline-block",
    );
    $(
      "input[id^='input_cout_nombre'], input[id^='input_cout_temps'], input[id^='input_cout_nourriture']",
    ).hide();
    let element = ["cout_nombre", "cout_temps", "cout_nourriture"];
    for (let i = 0; i < 3; i++) {
      $("span[id^='bouton_" + element[i] + "']").click((e) => {
        let j = $(e.currentTarget).attr("id").match(/\d+/)
          ? $(e.currentTarget).attr("id").match(/\d+/)
          : "";

        $("#input_" + element[i] + j).val($("#" + element[i] + j).text());
        $("#input_" + element[i] + j)
          .show()
          .focus();

        $("#" + element[(i + 1) % 3] + j + ", #" + element[(i + 2) % 3] + j).css(
          "display",
          "inline-block",
        );
        $(
          "#" +
            element[i] +
            j +
            ", #input_" +
            element[(i + 1) % 3] +
            j +
            ", #input_" +
            element[(i + 2) % 3] +
            j,
        ).hide();
      });
    }
    // Blur handler : referme l'input et restaure le span quand l'utilisateur
    // sort du champ (clic ailleurs, Tab, etc.). Délégué via document pour
    // couvrir aussi les inputs créés dynamiquement plus bas (cout_temps /
    // cout_nourriture).
    $(document).on(
      "blur",
      "input[id^='input_cout_nombre'], input[id^='input_cout_temps'], input[id^='input_cout_nourriture']",
      (e) => {
        let id = $(e.currentTarget).attr("id"),
          m = id.match(/^input_(cout_(?:nombre|temps|nourriture))(\d*)$/);
        if (!m) return;
        $(e.currentTarget).hide();
        $("#" + m[1] + m[2]).css("display", "inline-block");
      },
    );
    // Gestion du temps pour la ponte
    $("span[id^='bouton_cout_temps']").each((i, elt) => {
      $(elt).append(
        `<input id="input_cout_temps${i == 0 ? "" : i}" class="tooltip_droite" type="text" style="height: 20px; width: 85px;display:none;" title="Ex: 1.5 jour, 1j 12h, 36h" value="${$(elt).find("span[id^='cout_temps']").text()}"/>`,
      );
    });
    $("input[id^='input_cout_temps']").on("input", (e) => {
      let i = $(e.currentTarget).attr("id").match(/\d+/)
          ? $(e.currentTarget).attr("id").match(/\d+/)
          : "",
        nombre = parseInt(
          Utils.timeToInt(e.currentTarget.value) /
            (TEMPS_UNITE[i == "" ? 0 : i] * Math.pow(0.9, monProfil.getTDP())),
        );
      $("#cout_nombre" + i).text(numeral(nombre).format());
      $("#nombre_de_ponte" + i).attr("value", nombre);
      $("#cout_temps" + i).text(e.currentTarget.value);
      $("#cout_nourriture" + i).text(numeral(nombre * COUT_UNITE[i == "" ? 0 : i]).format("0 a"));
    });
    // Gestion de la consommation pour la ponte
    $("span[id^='bouton_cout_nourriture']").each((i, elt) => {
      $(elt).append(
        `<input id="input_cout_nourriture${i == 0 ? "" : i}" class="tooltip_droite" type="tel" style="height: 20px; width: 85px; display: none;" title="Ex: 100 000, 100k, 0.1M" value="${$(elt).find("span[id^='cout_nourriture']").text()}"/>`,
      );
    });
    $("input[id^='input_cout_nourriture']").on("input", (e) => {
      let i = $(e.currentTarget).attr("id").match(/\d+/)
          ? $(e.currentTarget).attr("id").match(/\d+/)
          : "",
        nombre = Math.floor(numeral(e.currentTarget.value).value() / COUT_UNITE[i == "" ? 0 : i]);
      $("#cout_nombre" + i).text(numeral(nombre).format());
      $("#nombre_de_ponte" + i).attr("value", nombre);
      $("#cout_temps" + i).text(
        // durée de ponte de `nombre` unités (l'ancienne écriture `(a, nombre)`
        // affichait `nombre` secondes)
        Utils.intToTime(
          nombre * (TEMPS_UNITE[i == "" ? 0 : i] * Math.pow(0.9, monProfil.getTDP())),
        ),
      );
      $("#cout_nourriture" + i).text(e.currentTarget.value);
    });
    // Slider de ponte (équivalent du slider natif Compte+) — uniquement
    // pour les unités déverrouillées, identifiées par la présence du champ
    // input_cout_nombre. Plage 1 → max sur 7 jours, comme en Compte+.
    const SECONDES_7J = 7 * 24 * 3600;
    $("input[id^='input_cout_nombre']").each((idx, input) => {
      let suffix = $(input).attr("id").replace("input_cout_nombre", ""),
        iUnite = suffix === "" ? 0 : parseInt(suffix),
        tempsParUnite = TEMPS_UNITE[iUnite] * Math.pow(0.9, monProfil.getTDP()),
        max7j = Math.floor(SECONDES_7J / tempsParUnite),
        sliderId = "o_sliderPonte" + suffix,
        step = 0,
        slidMax = 0;
      // Met à jour les affichages et le champ caché que le jeu soumet. L'input
      // n'est réécrit que si la valeur ne vient pas de lui (saisie en cours).
      let sync = (nombre, depuisSaisie = false) => {
        $("#cout_nombre" + suffix).text(numeral(nombre).format());
        if (!depuisSaisie) $("#input_cout_nombre" + suffix).val(nombre);
        $("#nombre_de_ponte" + suffix)
          .val(nombre)
          .attr("value", nombre);
        $("#cout_temps" + suffix).text(Utils.intToTime(nombre * tempsParUnite));
        $("#cout_nourriture" + suffix).text(numeral(nombre * COUT_UNITE[iUnite]).format("0 a"));
      };
      // Saisie clavier du nombre : le onkeyup natif a été retiré plus haut,
      // sans ce relais le champ caché garderait la valeur du curseur et le
      // jeu pondrait ce nombre-là (issue #24). Accepte 30 000, 30k, 0.5M.
      $(input).on("input", (e) => {
        let nombre = Math.max(0, Math.floor(numeral(e.currentTarget.value).value() || 0));
        sync(nombre, true);
        if (slidMax)
          $("#" + sliderId).slider("value", nombre >= max7j ? slidMax : Math.max(1, nombre));
      });
      if (max7j < 1) return;
      $(input)
        .closest("form")
        .find("table:first tbody")
        .prepend(
          `<tr><td colspan="2"><div id="${sliderId}" class="slider tooltip_haut" title="Vous pouvez aussi cliquer sur les nombres." style="margin:3px;margin-right:12px;"></div></td></tr>`,
        );
      // 20 paliers visibles le long de la course. jQuery UI exige que
      // (max - min) soit un multiple exact de step pour snapper proprement,
      // donc on aligne `slidMax` sur `1 + 20*step`, et on remappe la
      // dernière position vers `max7j` pour atteindre exactement 7 jours.
      const PALIERS = 20;
      step = Math.max(1, Math.floor((max7j - 1) / PALIERS));
      slidMax = 1 + PALIERS * step;
      $("#" + sliderId).slider({
        min: 1,
        max: slidMax,
        value: 1,
        step: step,
        // Snap vers max7j dès qu'on est dans le dernier cran (pas seulement à
        // la valeur exacte) : sur Firefox la barre s'arrête parfois un palier
        // avant slidMax, ce qui empêchait l'égalité stricte de matcher et
        // affichait ~6j au lieu de 7j sur le dernier cran.
        slide: (event, ui) => sync(ui.value >= slidMax - step ? max7j : ui.value),
      });
      // Sync initial : sans cet appel, les displays nombre/temps/nourriture
      // gardent l'état natif (typiquement 0 ou la valeur courante de la ponte
      // en cours) alors que le slider est posé à 1 — incohérence visuelle.
      sync(1);
    });
    // Sauvegarde de la ponte en cours
    let listePonte = new Array();
    for (let i = 1, l = $(".tableau_leger:eq(0) tr").length; i < l; i++) {
      let unite = $(".tableau_leger:eq(0) tr:eq(" + i + ") td:eq(0)")
          .text()
          .replace(/[0-9]+/g, "")
          .trim(),
        nombre = parseInt(
          $(".tableau_leger:eq(0) tr:eq(" + i + ") td:eq(0)")
            .text()
            .replace(/\D+/g, ""),
        ),
        temps = Utils.timeToInt($(".tableau_leger:eq(0) tr:eq(" + i + ") td:eq(3)").text());
      listePonte.push({
        unite: unite.substr(0, 1).toUpperCase() + unite.substr(1),
        nombre: nombre,
        exp: moment().add(temps, "s"),
      });
    }
    // Verification si les données sont deja enregistré
    if (listePonte.length) this.savePonte(listePonte);
    return this;
  }
  /**
   * Affiche le nombre d'unités possédées à côté de leur nom (dans un span
   * après le <h2>, pas dedans, pour qu'il reste petit), en version courte
   * (12,3k, 1,5M, 2G… cf. Utils.nombreCourt) avec le nombre exact au survol.
   * Les ouvrières viennent de l'entête, l'armée d'Armee.php plus les
   * troupes parties en chasse ou en attaque (cf. TroupesDehors), qu'Armee.php
   * ne montre pas : on resynchronise leur registre avec les listes du jeu.
   * @method nombreUnites
   */
  nombreUnites() {
    let afficher = (index, nombre) => {
      $("h2")
        .filter((i, elt) => $(elt).text().trim() == NOM_UNITE[index])
        .after(
          `<span class="o_nbUnite" title="${numeral(nombre).format()} ${nombre > 1 ? NOM_UNITES[index] : NOM_UNITE[index]}">${Utils.nombreCourt(nombre)}</span>`,
        );
    };
    afficher(0, Utils.ouvrieres || 0);
    let armee = new Armee();
    Promise.all([armee.getArmee(), $.ajax({ url: location.origin + "/Ressources.php" })]).then(
      ([htmlArmee, htmlRessources]) => {
        armee.chargeData(htmlArmee);
        AttaqueLancee.synchroniser(AttaqueLancee.extraireLignes(Utils.parseHtml(htmlArmee)));
        TroupesDehors.synchroniserChasses(Utils.parseHtml(htmlRessources));
        let dehors = TroupesDehors.total();
        armee.unite.forEach((nombre, i) => afficher(i + 1, nombre + dehors[i]));
      },
    );
    return this;
  }
  /**
   * Sauvegarde la ponte en cours.
   * @method savePonte
   */
  savePonte(listePonte) {
    if (
      !this._boiteComptePlus.ponte ||
      this._boiteComptePlus.ponte.length != listePonte.length ||
      (listePonte[0]["exp"].diff(this._boiteComptePlus.ponte[0]["exp"], "s") > 1 &&
        !Utils.comptePlus &&
        $("#boiteComptePlus").length)
    ) {
      this._boiteComptePlus.ponte = listePonte;
      this._boiteComptePlus.startPonte = moment();
      this._boiteComptePlus.sauvegarder().majPonte();
    }
    return this;
  }
}
