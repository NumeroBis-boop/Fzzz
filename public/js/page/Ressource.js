/*
 * Ressource.js
 * Hraesvelg
 **********************************************************************/

/**
 * Classe de fonction pour la page /Ressource.php.
 *
 * @class PageRessource
 * @constructor
 * @extends Page
 */
class PageRessource {
  constructor(boiteComptePlus) {
    /**
     * Accés à la boite compte+
     */
    this._boiteComptePlus = boiteComptePlus;
    /**
     * Nombre de chasse restante
     */
    this._nbChasse =
      monProfil.niveauRecherche[5] +
      2 -
      $("#boite_tdc")
        .text()
        .split(/- Vos chasseuses vont conquérir/g).length;
    /**
     * Armée du joueur pour envoyer des chasses
     */
    this._armee = new Armee();
    /**
     * Dernière simulation du lanceur
     */
    this._simu = null;
    /**
     * Vrai quand l'affectation des ouvrières a soumis le formulaire du jeu
     */
    this._rechargement = false;
  }
  /**
   *
   */
  executer() {
    this._armee.getArmee().then((data) => {
      // la page va se recharger (affectation des ouvrières) : un lancement de
      // chasses commencé maintenant serait coupé en route
      if (this._rechargement) return;
      this._armee.chargeData(data);
      // Ajout du lanceur de chasse
      this.lanceur();
      // Fzzz : second lanceur (budget de pertes) et sélecteur entre les deux
      this.selecteurLanceur();
    });
    // Lie les chasses lancées aux lignes du jeu (compte des troupes dehors)
    TroupesDehors.synchroniserChasses();
    // Sauvegarde les chasses en cours et ajoute les boutons max recolte
    if (!Utils.comptePlus) this.plus();
    // Affectation automatique des ouvrières (tous comptes)
    this.affectation();
    // Fzzz : synthèse des chasses en cours par minute d'impact
    this.syntheseChasses();
    // Bouton "Annuler toutes les chasses" si au moins une est en cours
    this.boutonAnnulerChasses();
    return this;
  }
  /**
   * Fzzz : synthèse des chasses en cours par minute d'impact. Les chasses qui
   * arrivent sur des minutes consécutives (13h05, 13h06, 13h07…) forment un
   * seul groupe, affiché à la minute la plus tardive. Pour chaque groupe :
   * heure d'impact, TdC chassé et unités mises en chasse (détail au survol).
   *
   * @private
   * @method syntheseChasses
   */
  syntheseChasses() {
    let chasses = [];
    $("#boite_tdc span[id^='chasse_']").each((i, elt) => {
      let $ligne = $(elt).parent(),
        secondes = parseInt($ligne.nextAll("script").first().text().split("(")[1]),
        terrain = numeral(($ligne.text().match(/conquérir\s+([\d\s ]+)\s*cm/) || [])[1]).value(),
        details = $ligne.nextAll("small").first().text(),
        troupes =
          (details.match(/Troupes en chasses?\s*:\s*([^\n]+?)\.?\s*(?:Arrivée|$)/i) || [])[1] || "",
        libelle = details.match(/Arrivée à (\d+)h(\d+)/i);
      if (isNaN(secondes)) return;
      // minute d'impact : celle qu'affiche le jeu (« Arrivée à 02h59 »), placée
      // au jour le plus proche de l'arrivée calculée ; sinon l'arrivée calculée
      let arrivee = Horloge.serveur().add(secondes, "s"),
        impact = arrivee.clone().startOf("minute");
      if (libelle) {
        impact = arrivee
          .clone()
          .hours(parseInt(libelle[1]))
          .minutes(parseInt(libelle[2]))
          .startOf("minute");
        let ecart = impact.diff(arrivee, "hours", true);
        if (ecart > 12) impact.subtract(1, "day");
        else if (ecart < -12) impact.add(1, "day");
      }
      let unites = {};
      troupes.split(",").forEach((morceau) => {
        let m = morceau.trim().match(/^([\d\s ]+)\s+(.+)$/);
        if (m) unites[m[2].trim()] = numeral(m[1]).value();
      });
      chasses.push({ impact: impact, terrain: terrain || 0, unites: unites });
    });
    if (!chasses.length) return;
    chasses.sort((a, b) => a.impact - b.impact);
    let groupes = [];
    chasses.forEach((c) => {
      let dernier = groupes[groupes.length - 1];
      if (dernier && c.impact.diff(dernier.impact, "minutes") <= 1) {
        dernier.impact = c.impact;
        dernier.chasses.push(c);
      } else groupes.push({ impact: c.impact, chasses: [c] });
    });
    let somme = (liste) => {
        let terrain = 0,
          unites = {};
        liste.forEach((c) => {
          terrain += c.terrain;
          // singulier et pluriel (« 1 Tank », « 3 Tanks ») sous la même clé
          for (let nom in c.unites) {
            let cle = nom.toLowerCase().replace(/s\b/g, "");
            if (!unites[cle]) unites[cle] = { nom: nom, nb: 0 };
            unites[cle].nb += c.unites[nom];
            // forme plurielle (la plus longue) pour l'affichage
            if (nom.length > unites[cle].nom.length) unites[cle].nom = nom;
          }
        });
        // ordre des unités du jeu (JSN, SN, NE, JS, S…), inconnues en dernier
        let rang = (nom) => {
            let r = [...NOM_UNITES, ...NOM_UNITE].findIndex(
              (n) => n.toLowerCase() == nom.toLowerCase(),
            );
            return r == -1 ? 99 : r % NOM_UNITES.length;
          },
          detail = Object.values(unites).sort((a, b) => rang(a.nom) - rang(b.nom)),
          total = detail.reduce((t, u) => t + u.nb, 0);
        return {
          terrain: terrain,
          total: total,
          detail: detail.map((u) => `${numeral(u.nb).format()} ${u.nom}`).join(", "),
        };
      },
      textes = [],
      ligne = (libelle, liste, classe) => {
        let s = somme(liste),
          unites = s.detail ? s.detail + "." : "";
        textes.push(
          `${libelle} : ${liste.length} chasse${liste.length > 1 ? "s" : ""}, ${numeral(s.terrain).format()} cm², ${unites}`,
        );
        return `<tr class='${classe}'><td>${libelle}</td><td>${liste.length}</td><td>${numeral(s.terrain).format()} cm²</td><td class='o_syntheseUnites'>${unites}</td></tr>`;
      },
      html = `<table class='o_maxWidth centre' cellspacing='0'>
        <tr class='gras'><td>Heure d'impact</td><td>Chasses</td><td>TdC chassé</td><td>Unités mises en chasse</td></tr>`;
    groupes.forEach((g, i) => {
      html += ligne(g.impact.format("D MMM [à] HH[h]mm"), g.chasses, i % 2 ? "" : "ligne_paire");
    });
    if (groupes.length > 1) html += ligne("Total", chasses, "gras o_syntheseTotal");
    html += `</table><div class='o_syntheseBoutons'>
        <button type='button' id='o_copierSynthese' class='o_button f_info'>Copier la synthèse</button>
        <button type='button' id='o_partagerChasses' class='o_button f_info'>Partager mes chasses avec la ${Utils.alliance || "l'alliance"}</button>
      </div>`;
    html =
      "<div id='o_syntheseChasses'>" +
      Utils.spoiler(
        `Synthèse des chasses en cours (${chasses.length})`,
        html,
        "ressourcesSynthese",
        "gras",
      ) +
      "</div>";
    // sous le titre « Chasse en cours », au-dessus des lignes de chasse
    let $titre = $("#boite_tdc span.titre").filter((i, e) =>
      $(e).text().includes("Chasse en cours"),
    );
    if ($titre.length) $titre.first().after(html);
    else $("#boite_tdc").append(html);
    $("#o_copierSynthese").on("click", () =>
      CommerceFzzz.copier(textes.join("\n"), "Synthèse des chasses copiée dans le presse-papier."),
    );
    $("#o_partagerChasses").on("click", (e) =>
      PartageChasses.partager(
        groupes.map((g) => {
          let s = somme(g.chasses);
          return { impact: g.impact, terrain: s.terrain, unites: s.detail ? s.detail + "." : "" };
        }),
        $(e.currentTarget),
      ),
    );
  }
  /**
   * Ajoute un bouton "Annuler toutes les chasses" dans la boîte de chasse en cours.
   * Le serveur expose `Ressources.php?annuler=<chasseId>` pour annuler une chasse —
   * on itère sur tous les spans `chasse_<id>` présents dans `#boite_tdc`.
   *
   * @private
   * @method boutonAnnulerChasses
   */
  boutonAnnulerChasses() {
    let chasses = $("#boite_tdc span[id^='chasse_']");
    if (!chasses.length) return;
    $("#boite_tdc").append(
      `<div class="o_marginT15 centre"><button id="o_annulerChasses" class="o_button f_error" type="button">Annuler toutes les chasses (${chasses.length})</button></div>`,
    );
    $("#o_annulerChasses").click(() => {
      if (!confirm(`Annuler les ${chasses.length} chasse(s) en cours ? Action irréversible.`))
        return;
      $("#o_annulerChasses").prop("disabled", true).text("Annulation…");
      let promesses = chasses
        .map((_, span) => $(span).attr("id").replace("chasse_", ""))
        .get()
        .map((id) => $.get(`${location.origin}/Ressources.php?annuler=${id}`));
      Promise.all(promesses).then(
        () => {
          location.reload();
        },
        () => {
          $.toast({
            ...TOAST_ERROR,
            text: "Au moins une annulation a échoué — rechargement quand même.",
          });
          setTimeout(() => location.reload(), 1500);
        },
      );
    });
  }
  /**
   * Fzzz : sélecteur entre le lanceur standard et le lanceur par budget de
   * pertes. Seul le lanceur choisi est affiché ; le choix est mémorisé.
   *
   * @private
   * @method selecteurLanceur
   */
  selecteurLanceur() {
    if (!$("#o_prepaChasse").length) return this;
    const CLE = "fzzz_lanceurChasse";
    let choix = "standard";
    try {
      choix = localStorage.getItem(CLE) || "standard";
    } catch (e) {}
    $("#o_prepaChasse").before(
      `<div id='o_choixLanceur' class='boite_amelioration simulateur centre'>
        <label class='gras'>Lanceur de chasses :
          <select id='o_choixLanceurSelect'>
            <option value='standard'>Standard (ratio choisi)</option>
            <option value='budget'>Budget de pertes (JSN sacrifiées)</option>
          </select>
        </label>
      </div>`,
    );
    // Budget de pertes : simulateur de Calystène d'origine avec son greffon CHS2B
    // (lib/calystene-chs2), construit au premier choix puis placé sous le sélecteur
    let appliquer = (v) => {
      if (v == "budget" && !$("#CHS2_MainFrame").length) {
        try {
          fzzzLancerCHS2();
        } catch (e) {
          console.error("[Fzzz] simulateur de Calystène :", e);
          $.toast({ ...TOAST_ERROR, text: "Le simulateur de Calystène n'a pas pu démarrer." });
        }
        $("#CHS2_MainFrame").insertAfter("#o_choixLanceur");
      }
      $("#o_prepaChasse").toggle(v == "standard");
      $("#CHS2_MainFrame").toggle(v == "budget");
    };
    $("#o_choixLanceurSelect")
      .val(choix)
      .on("change", (e) => {
        try {
          localStorage.setItem(CLE, e.currentTarget.value);
        } catch (err) {}
        appliquer(e.currentTarget.value);
      });
    appliquer(choix);
    return this;
  }
  /**
   * Formulaire de lancement pour les chasses.
   *
   * @private
   * @method lanceur
   */
  lanceur() {
    $("#boite_tdc")
      .after(`<br/><div id='o_prepaChasse' class='boite_amelioration simulateur centre'><h2>Lanceur de Chasses</h2>
            <table id='o_lanceurChasse' class='o_maxWidth o_marginT15' cellspacing=0>
			<tr class='ligne_paire'><td>Terrain à l'arrivée</td><td><input value='${Utils.terrain > 1000000 ? 1000000 : Utils.terrain}' size='21' id='o_chasseTDCDep'/></td><td></td></tr>
			<tr><td>Nombre de chasse</td><td><input value='0' size='21' id='o_chasseNbr'/></td><td><input id='o_chasseNbrAuto' type='checkbox' checked='checked' name='optionAuto'/><label for='o_chasseNbrAuto'>Auto</label></td></tr>
			<tr class='ligne_paire'><td>Terrain par chasse</td><td><input value='0' size='21' id='o_chasseTDCRep'/></td><td><input id='o_chasseTDCRepAuto' type='checkbox' checked='checked' name='optionAuto'/><label for='o_chasseTDCRepAuto'>Auto</label></td></tr>
			<tr><td>Difficulté</td><td><select id='o_chasseDiff' title='Ratio (Attaque de votre Armée) / (Difficulté de chasse) : détermine les pertes et taux de réplique de votre chasse...'><option value='1' class='black'>${RATIO_CHASSE[0].toFixed(1)} → Rep10% : ${REPLIQUE_CHASSE[0] >= 0.2 ? (100 * REPLIQUE_CHASSE[0]).toFixed(2) + "%" : "< 20%"}</option><option value='2' class='black'>${RATIO_CHASSE[1].toFixed(1)} → Rep10% : ${REPLIQUE_CHASSE[1] >= 0.2 ? (100 * REPLIQUE_CHASSE[1]).toFixed(2) + "%" : "< 20%"}</option><option value='3' class='black'>${RATIO_CHASSE[2].toFixed(1)} → Rep10% : ${REPLIQUE_CHASSE[2] >= 0.2 ? (100 * REPLIQUE_CHASSE[2]).toFixed(2) + "%" : "< 20%"}</option><option value='4' class='black'>${RATIO_CHASSE[3].toFixed(1)} → Rep10% : ${REPLIQUE_CHASSE[3] >= 0.2 ? (100 * REPLIQUE_CHASSE[3]).toFixed(2) + "%" : "< 20%"}</option><option value='5' class='red'>${RATIO_CHASSE[4].toFixed(1)} → Rep10% : ${REPLIQUE_CHASSE[4] >= 0.2 ? (100 * REPLIQUE_CHASSE[4]).toFixed(2) + "%" : "< 20%"}</option><option value='6' class='red'>${RATIO_CHASSE[5].toFixed(1)} → Rep10% : ${REPLIQUE_CHASSE[5] >= 0.2 ? (100 * REPLIQUE_CHASSE[5]).toFixed(2) + "%" : "< 20%"}</option><option value='6.5' class='orange'>${RATIO_CHASSE[6].toFixed(1)} → Rep10% : ${REPLIQUE_CHASSE[6] >= 0.2 ? (100 * REPLIQUE_CHASSE[6]).toFixed(2) + "%" : "< 20%"}</option><option value='7' class='orange'>${RATIO_CHASSE[7].toFixed(1)} → Rep10% : ${REPLIQUE_CHASSE[7] >= 0.2 ? (100 * REPLIQUE_CHASSE[7]).toFixed(2) + "%" : "< 20%"}</option><option value='7.5' class='orange'>${RATIO_CHASSE[8].toFixed(1)} → Rep10% : ${REPLIQUE_CHASSE[8] >= 0.2 ? (100 * REPLIQUE_CHASSE[8]).toFixed(2) + "%" : "< 20%"}</option><option value='8' class='green'>${RATIO_CHASSE[9].toFixed(1)} → Rep10% : ${REPLIQUE_CHASSE[9] >= 0.2 ? (100 * REPLIQUE_CHASSE[9]).toFixed(2) + "%" : "< 20%"}</option><option value='8.5' class='green'>${RATIO_CHASSE[10].toFixed(1)} → Rep10% : ${REPLIQUE_CHASSE[10] >= 0.2 ? (100 * REPLIQUE_CHASSE[10]).toFixed(2) + "%" : "< 20%"}</option><option value='9' class='green' selected>${RATIO_CHASSE[11].toFixed(1)} → Rep10% : ${REPLIQUE_CHASSE[11] >= 0.2 ? (100 * REPLIQUE_CHASSE[11]).toFixed(2) + "%" : "< 20%"}</option><option value='10' class='green'>${RATIO_CHASSE[12].toFixed(1)} → Rep10% : ${REPLIQUE_CHASSE[12] >= 0.2 ? (100 * REPLIQUE_CHASSE[12]).toFixed(2) + "%" : "< 20%"}</option></select></td><td id='o_chasseDiffInfo' class='small'></td></tr>
			<tr class='ligne_paire'><td>Garder des JSN</td><td><input value='0' size='21' id='o_chasseJSN'/></td><td>max : ${numeral(this._armee.nbrJSN).format()}</td></tr>
			<tr><td>Intervalle entre les chasses</td><td><select id='o_chasseInt' title='Intervalle entre les chasses'><option value='2' selected>2 secondes</option><option value='30'>30 secondes</option><option value='60'>1 minute</option><option value='120'>2 minutes</option></select></td><td></td></tr>
			<tr class='ligne_paire'><td>Date d'arrivée souhaitée</td><td><input value='' size='21' id='o_chasseDateArrivee' placeholder='JJ-MM-AAAA HH:mm'/></td><td>Terrain par chasse suggéré : <span id='o_chasseDateArriveeTdc' class='gras'>—</span> <button type='button' id='o_chasseDateArriveeApply' disabled>Appliquer</button></td></tr>
			<tr><td colspan='3'><em>Basé sur le lanceur de <a href='http://alliancead2.free.fr/Outils/Repository/HuntSimv2.00/Simulator_2.00.00.html' class='violet' target='_blank' rel='noopener'>Calystene</a></em></td></tr>
			</table>
            <br/><div id='o_simuChasse'><table id='o_simulationChasse' cellspacing=0 class='o_maxWidth'></table></div>
            <button class='o_button o_marginT15 f_success' type='button' id='o_chasseEnvoyer'>Envoyer</button>
            <p class='o_marginT0'><em class='small'>Veuillez rester sur cette page le temps du lancement !</em></p>
            <table id='o_recapChasse' cellspacing=0>
			<tr class='ligne_paire'><td colspan='3' class='gras'>Récapitulatif</td></tr>
			<tr><td>Chasse(s)</td><td>:</td><td id='o_chasseTotal'></td><td></td></tr>
			<tr class='ligne_paire'><td>Temps requis</td><td>:</td><td id='o_chasseTemps'></td></tr>
			<tr><td>Retour</td><td>:</td><td id='o_chasseRetour'></td></tr>
			<tr class='ligne_paire'><td>Rentabilité</td><td>:</td><td id='o_chasseRentabilite'></td></tr>
			<tr><td>Difficulté</td><td>:</td><td id='o_chasseRefDiff'></td></tr>
			<tr class='ligne_paire'><td>Perte estimé</td><td>:</td><td id='o_chassePerte'></td></tr>
			</table>
            <div class='o_marginT15'>
              <a id='o_chassePertesTdcToggle' class='cursor souligne'>▼ Pertes selon le niveau de TdC à l'arrivée ▼</a>
              <div id='o_chassePertesTdc' style='display:none' class='o_marginT15'>
                <table id='o_chassePertesTdcTable' class='o_maxWidth' cellspacing='0'>
                  <thead>
                    <tr class='gras ligne_paire'>
                      <td>TdC à l'arrivée</td>
                      <td class='right'>Pertes Min</td>
                      <td class='right'>Pertes Avg</td>
                      <td class='right'>Pertes Max</td>
                      <td class='right'>Variation moy.</td>
                    </tr>
                  </thead>
                  <tbody>
                    <tr class='gras'><td><span id='o_otherHfRefValue'>—</span> cm² <span class='small'>(Terrain à l'arrivée)</span></td><td class='right o_otherHfMin' data-idx='0'>—</td><td class='right o_otherHfAvg' data-idx='0'>—</td><td class='right o_otherHfMax' data-idx='0'>—</td><td class='right'>—</td></tr>
                    ${[
                      1000000, 5000000, 10000000, 15000000, 20000000, 30000000, 40000000, 50000000,
                      75000000, 100000000,
                    ]
                      .map((v, k) => {
                        let i = k + 1;
                        return `<tr ${i % 2 ? "class='ligne_paire'" : ""}><td><input class='o_otherHfInputAlt' data-idx='${i}' value='${v}' size='15'/> cm²</td><td class='right o_otherHfMin' data-idx='${i}'>—</td><td class='right o_otherHfAvg' data-idx='${i}'>—</td><td class='right o_otherHfMax' data-idx='${i}'>—</td><td class='right o_otherHfVar' data-idx='${i}'>—</td></tr>`;
                      })
                      .join("")}
                  </tbody>
                </table>
              </div>
            </div></div>`);
    $("#o_chasseTDCDep").spinner({ min: 0, numberFormat: "i" });
    $("#o_chasseJSN").spinner({
      min: 0,
      max: this._armee.nbrJSN,
      numberFormat: "i",
    });
    $("#o_chasseTDCRep").spinner({
      min: 1,
      numberFormat: "i",
      disabled: true,
    });
    $("#o_chasseNbr").spinner({
      min: 1,
      max: this._nbChasse,
      numberFormat: "i",
      disabled: true,
    });
    $("#o_chasseDiff, #o_chasseInt").outerWidth($("#o_chasseTDCDep").parent().width() + 4);
    $("#o_chasseDiff, #o_chasseInt").outerHeight($("#o_chasseTDCDep").parent().height());
    $("#o_chasseDiff").css("color", "green");
    $("#o_chasseDateArrivee").datetimepicker({
      ...DATEPICKER_OPTION,
      dateFormat: "dd-mm-yy",
      timeFormat: "HH:mm",
      timeText: "Horaire",
      hourText: "Heure",
      minuteText: "Minute",
      minDate: 0,
    });
    $(".o_otherHfInputAlt").spinner({ min: 0, numberFormat: "i" });
    // Completion des valeurs
    this.preparerChasse();
    // Event
    $("#o_chasseTDCDep, #o_chasseNbr, #o_chasseTDCRep").on("input spin", (e, ui) => {
      let nombre = ui ? ui.value : $(e.currentTarget).spinner("value");
      $(e.currentTarget).spinner("value", nombre);
      this.preparerChasse();
    });
    $("#o_chasseNbrAuto").click((e) => {
      if (!$(e.currentTarget).is(":checked")) $("#o_chasseNbr").spinner("enable");
      else {
        $("#o_chasseNbr").spinner("disable");
        this.preparerChasse();
      }
    });
    $("#o_chasseTDCRepAuto").click((e) => {
      if (!$(e.currentTarget).is(":checked")) $("#o_chasseTDCRep").spinner("enable");
      else {
        $("#o_chasseTDCRep").spinner("disable");
        this.preparerChasse();
      }
    });
    $("#o_chasseDiff").change(() => {
      this._majCouleurDiff();
      this.preparerChasse();
    });
    $("#o_chasseJSN").on("input spin", (e, ui) => {
      let nombre = ui ? ui.value : $(e.currentTarget).spinner("value");
      $(e.currentTarget).spinner("value", nombre);
      this._armee.setJSN(nombre);
      this.preparerChasse();
    });
    $("#o_chasseDateArrivee").on("change", () => this.calculerTdcDate());
    $("#o_chasseDateArriveeApply").click(() => {
      let tdc = $("#o_chasseDateArrivee").data("tdc");
      if (tdc == null) return;
      if ($("#o_chasseTDCRepAuto").is(":checked")) {
        $("#o_chasseTDCRepAuto").prop("checked", false);
        $("#o_chasseTDCRep").spinner("enable");
      }
      $("#o_chasseTDCRep").spinner("value", tdc);
      this.preparerChasse();
    });
    $("#o_chassePertesTdcToggle").click(() => {
      let $div = $("#o_chassePertesTdc");
      $div.toggle();
      let arrow = $div.is(":visible") ? "▲" : "▼";
      $("#o_chassePertesTdcToggle").text(
        `${arrow} Pertes selon le niveau de TdC à l'arrivée ${arrow}`,
      );
    });
    $(".o_otherHfInputAlt").on("input spin", () => this.mettreAjourPertesTdc());
    // Lancement des chasses
    $("#o_chasseEnvoyer").click((e) => {
      if (this._armee.getSommeUnite()) {
        // désactivé dès le premier clic : un double clic enverrait chaque chasse deux fois
        $(e.currentTarget).prop("disabled", true).text("Envoi en cours…");
        let terrainChasse = $("#o_chasseTDCRep").spinner("value"),
          nbChasse = $("#o_chasseNbr").spinner("value"),
          intervalle = $("#o_chasseInt").val() * 1000;
        // chaque chasse relit un jeton neuf (Armee.posterChasse)
        this._armee.envoyerChasse(terrainChasse, nbChasse, 0, intervalle);
      } else
        $.toast({
          ...TOAST_ERROR,
          text: "Vous n'avez pas d'armée à envoyer.",
        });
      return false;
    });
    return this;
  }
  /**
   * Calcule les données de la chasse en fonction des valeurs souhaitées par le joueur.
   *
   * @private
   * @method preparerChasse
   */
  preparerChasse() {
    let tdcArrivee = $("#o_chasseTDCDep").spinner("value"),
      nbChasse = $("#o_chasseNbr").spinner("value"),
      terrainChasse = $("#o_chasseTDCRep").spinner("value"),
      autoNb = $("#o_chasseNbrAuto").is(":checked"),
      autoTerrain = $("#o_chasseTDCRepAuto").is(":checked");
    // Si une chasse peut être calculée
    if (tdcArrivee) {
      let simu = this._armee.simulerChasse({
        tdcLancement: Utils.terrain,
        tdcArrivee: tdcArrivee,
        ratio: parseFloat($("#o_chasseDiff").val()),
        nombreMax: this._nbChasse,
        nombreFixe: autoNb ? 0 : nbChasse,
        terrainFixe: autoTerrain ? 0 : terrainChasse,
      });
      if (autoNb) $("#o_chasseNbr").spinner("value", simu.nombre);
      if (autoTerrain) $("#o_chasseTDCRep").spinner("value", simu.terrain);
      this._simu = simu;
      this.majSimulation(this._armee.repartition);
      this.majRecapitulatif(simu);
      // Sync la dropdown Difficulté sur le ratio de référence réellement atteint
      // (plus bas que celui sélectionné si l'armée ne peut pas le tenir, ou si
      // le nombre et le terrain sont fixés à la main).
      this._majDifficultesAccessibles(
        simu,
        tdcArrivee,
        parseFloat($("#o_chasseDiff").val()),
        autoNb && autoTerrain,
      );
      let computed = String(RATIO_CHASSE[simu.indexRef]);
      if ($("#o_chasseDiff").val() !== computed) {
        $("#o_chasseDiff").val(computed);
        this._majCouleurDiff();
      }
      this.mettreAjourPertesTdc();
    }
  }
  /**
   * Grise les difficultés que l'armée ne peut pas tenir et dit pourquoi la
   * liste change de valeur. Même une chasse de 1 cm² a une difficulté
   * minimale, qui croît avec le TdC (formule de Calystene) : au-delà de
   * attaque / difficulté minimale, aucun nombre ni aucun terrain ne tient le
   * ratio, et la liste redescendait sans explication.
   *
   * @private
   * @method _majDifficultesAccessibles
   * @param {Object} simu résultat de la simulation
   * @param {Number} tdcArrivee TdC à l'arrivée des chasses
   * @param {Number} choisi ratio sélectionné avant la synchronisation
   * @param {Boolean} auto nombre et terrain calculés par le lanceur
   */
  _majDifficultesAccessibles(simu, tdcArrivee, choisi, auto) {
    let max = simu.attArmee / SimulationChasse.difficulte(Math.max(1, tdcArrivee), 1),
      info = "";
    $("#o_chasseDiff option").each((i, elt) => {
      $(elt).prop("disabled", auto && RATIO_CHASSE[i] > max + 0.0001);
    });
    if (!auto) info = "Nombre ou terrain fixé : la difficulté en découle.";
    else if (max < RATIO_CHASSE[RATIO_CHASSE.length - 1])
      info =
        (choisi > max + 0.0001 ? `Difficulté ${choisi} impossible. ` : "") +
        `Max : ${numeral(max).format("0.00")} avec cette armée (une chasse de 1 cm²).`;
    $("#o_chasseDiffInfo").text(info);
  }
  /**
   * Met à jour la couleur de la dropdown Difficulté selon le seuil de ratio.
   *
   * @private
   * @method _majCouleurDiff
   */
  _majCouleurDiff() {
    let value = parseFloat($("#o_chasseDiff").val()),
      color = value <= 4 ? "black" : value <= 6 ? "red" : value <= 7.5 ? "orange" : "green";
    $("#o_chasseDiff").css("color", color);
  }
  /**
   * Calcule le terrain par chasse suggéré pour qu'une chasse parte maintenant et
   * revienne à la date saisie. Inverse de `temps = (Utils.terrain + tdc) × 0.9^niveau`
   * (ligne 286 de majRecapitulatif).
   *
   * @private
   * @method calculerTdcDate
   */
  calculerTdcDate() {
    let raw = $("#o_chasseDateArrivee").val(),
      reset = (msg) => {
        $("#o_chasseDateArrivee").removeData("tdc").removeData("tdcRaw");
        $("#o_chasseDateArriveeTdc").text(msg || "—");
        $("#o_chasseDateArriveeApply").prop("disabled", true);
      };
    if (!raw) return reset();
    // datetimepicker redéclenche `change` au blur avec la même valeur — sans ce
    // garde-fou le tdc dérive d'~1 unité à chaque firing (diff vs moment() avance)
    if ($("#o_chasseDateArrivee").data("tdcRaw") === raw) return;
    let target = moment(raw, "DD-MM-YYYY HH:mm");
    if (!target.isValid()) return reset();
    let secondsLeft = target.diff(moment(), "seconds");
    if (secondsLeft <= 0) return reset("date passée");
    let niveau = monProfil.niveauRecherche[5],
      tdc = Math.round(secondsLeft / Math.pow(0.9, niveau) - Utils.terrain);
    if (tdc <= 0) return reset("trop court");
    $("#o_chasseDateArrivee").data("tdc", tdc).data("tdcRaw", raw);
    $("#o_chasseDateArriveeTdc").text(numeral(tdc).format() + " cm²");
    $("#o_chasseDateArriveeApply").prop("disabled", false);
  }
  /**
   * Met à jour la table "Pertes selon TdC à l'arrivée" en réutilisant les paramètres
   * courants (nb chasses, terrain par chasse, difficulté) mais en faisant varier
   * uniquement le tdcDep sur les valeurs saisies par l'utilisateur. Affiche aussi
   * la variation moyenne par rapport au tdcDep courant.
   *
   * @private
   * @method mettreAjourPertesTdc
   */
  mettreAjourPertesTdc() {
    let simu = this._simu,
      tdcCourant = $("#o_chasseTDCDep").spinner("value");
    if (!simu) return;
    let pertesA = (tdc) =>
        SimulationChasse.pertesAutreTdc(
          simu.attArmee,
          tdcCourant,
          tdc,
          simu.terrain,
          simu.nombre,
          simu.indexRef,
          monProfil.niveauRecherche[1],
        ),
      curPertes = simu.pertes;
    // Ligne 0 = référence (TdC courant, miroir live de #o_chasseTDCDep)
    $("#o_otherHfRefValue").text(numeral(tdcCourant).format());
    $(".o_otherHfMin[data-idx='0']").text(numeral(Math.round(curPertes.MIN)).format());
    $(".o_otherHfAvg[data-idx='0']").text(numeral(Math.round(curPertes.AVG)).format());
    $(".o_otherHfMax[data-idx='0']").text(numeral(Math.round(curPertes.MAX)).format());
    // Lignes 1..10 = alternatives, variation calculée vs ligne 0
    $(".o_otherHfInputAlt").each((_, el) => {
      let $el = $(el),
        i = $el.data("idx"),
        p = pertesA($el.spinner("value") || 0);
      $(`.o_otherHfMin[data-idx='${i}']`).text(numeral(Math.round(p.MIN)).format());
      $(`.o_otherHfAvg[data-idx='${i}']`).text(numeral(Math.round(p.AVG)).format());
      $(`.o_otherHfMax[data-idx='${i}']`).text(numeral(Math.round(p.MAX)).format());
      let varAvg = curPertes.AVG > 0 ? ((p.AVG - curPertes.AVG) / curPertes.AVG) * 100 : 0,
        sign = varAvg >= 0 ? "+" : "",
        cls = varAvg > 0.5 ? "red" : varAvg < -0.5 ? "green" : "";
      $(`.o_otherHfVar[data-idx='${i}']`).html(
        `<span class='${cls}'>${sign}${varAvg.toFixed(1)} %</span>`,
      );
    });
  }
  /**
   * Affiche la répartition des unités pour les chasses.
   *
   * @private
   * @method majSimulation
   * @param {Array} repartition
   */
  majSimulation(repartition) {
    let simulation = `<tr class='gras'><td>Chasse</td>
            ${this._armee.unite[0] ? "<td>JSN</td>" : ""}
            ${this._armee.unite[1] ? "<td>SN</td>" : ""}
            ${this._armee.unite[2] ? "<td>NE</td>" : ""}
            ${this._armee.unite[3] ? "<td>JS</td>" : ""}
            ${this._armee.unite[4] ? "<td>S</td>" : ""}
            ${this._armee.unite[5] ? "<td>C</td>" : ""}
            ${this._armee.unite[6] ? "<td>CE</td>" : ""}
            ${this._armee.unite[7] ? "<td>A</td>" : ""}
            ${this._armee.unite[8] ? "<td>AE</td>" : ""}
            ${this._armee.unite[9] ? "<td>SE</td>" : ""}
            ${this._armee.unite[10] ? "<td>Tk</td>" : ""}
            ${this._armee.unite[11] ? "<td>TkE</td>" : ""}
            ${this._armee.unite[12] ? "<td>Tu</td>" : ""}
            ${this._armee.unite[13] ? "<td>TuE</td>" : ""}
            </tr>`;
    for (let i = 0, l = repartition.length; i < l; i++) {
      simulation += `<tr><td>${i + 1}</td>`;
      for (
        let j = -1;
        ++j < 14;
        simulation += this._armee.unite[j]
          ? "<td class='small' nowrap>" +
            (repartition[i][j] ? numeral(repartition[i][j]).format() : "") +
            "</td>"
          : ""
      );
      simulation += `</tr>`;
    }
    $("#o_simulationChasse").html(simulation);
    $("#o_simulationChasse tr:even").addClass("ligne_paire");
  }
  /**
   * Affiche le compte rendu de la simulation.
   *
   * @private
   * @method majRecapitulatif
   * @param {Object} simu résultat d'Armee.simulerChasse
   */
  majRecapitulatif(simu) {
    let nbChasse = simu.nombre,
      terrainChasse = simu.terrain;
    $("#o_chasseTotal").html(
      nbChasse +
        " x " +
        numeral(terrainChasse).format() +
        " = <span class='green'>" +
        numeral(nbChasse * terrainChasse).format() +
        "</span> cm²",
    );
    let temps = SimulationChasse.duree(Utils.terrain, terrainChasse, monProfil.niveauRecherche[5]);
    $("#o_chasseTemps").text(Utils.intToTime(temps));
    let dateLong = Utils.roundMinute(temps).format("dddd D MMM YYYY [à] HH[h]mm");
    $("#o_chasseRetour").text(dateLong.charAt(0).toUpperCase() + dateLong.slice(1));
    $("#o_chasseRentabilite").text(
      numeral(Math.round(((nbChasse * terrainChasse) / temps) * 86400)).format() + " cm² / jour",
    );
    $("#o_chasseRefDiff").text(
      numeral(simu.ratio).format("0.00") + " ~ " + RATIO_CHASSE[simu.indexRef].toFixed(1),
    );
    $("#o_chassePerte").text(
      numeral(Math.round(simu.pertes.AVG)).format() +
        " JSN (max : " +
        numeral(Math.round(simu.pertes.MAX)).format() +
        ")",
    );
  }
  /**
   * Ajoute les boutons "max", sauvegarde la chasse en cours.
   *
   * @private
   * @method plus
   */
  plus() {
    // Ajout des boutons pour l'affectation max
    $("#RecolteNourriture").after(
      "<a title='Affecter un maximum d’ouvrière à la nourriture' class='button_max' onclick='javascript:maxNourriture();' href='#max'><img class='o_vAlign' width='23' height='23' src='images/bouton/fleche_haut.gif'/></a>",
    );
    $("#RecolteMateriaux").after(
      "<a title='Affecter un maximum d’ouvrière aux matériaux' class='button_max' onclick='javascript:maxMateriaux();' href='#max'><img class='o_vAlign' width='23' height='23' src='images/bouton/fleche_haut.gif'/></a>",
    );
    // Hors C+ le formulaire du jeu envoie chasser toute l'armée du terrain de
    // chasse : on la mémorise pour la compter tant qu'elle est dehors. Elle
    // est relue juste avant l'envoi (elle a pu bouger depuis le chargement de
    // la page, une valeur périmée compterait des troupes fantômes), puis le
    // formulaire est renvoyé tel quel, quoi qu'il arrive à la lecture.
    let formChasse = $("form[action='AcquerirTerrain.php']"),
      armeeLue = false;
    formChasse.on("submit", (e) => {
      if (armeeLue || !(numeral($("#AcquerirTerrain").val()).value() > 0)) return;
      e.preventDefault();
      armeeLue = true;
      let bouton = e.originalEvent && e.originalEvent.submitter;
      Promise.resolve(new Armee().getArmee())
        .then((data) => TroupesDehors.enregistrerChasse(new Armee().chargeData(data, 1).unite))
        .catch(() => {})
        .finally(() => formChasse[0].requestSubmit(bouton || undefined));
    });
    // Affichage du retour des chasses
    let listeChasse = new Array();
    $("span[id^=chasse_]").each((i, elt) => {
      listeChasse.push({
        quantite: numeral($(elt).parent().text().split("conquérir")[1].split("cm²")[0]).value(),
        exp: moment().add($(elt).parent().next().text().split("reste(")[1].split(",")[0], "s"),
      });
      $(elt)
        .parent()
        .next()
        .after(
          "<span class='small'> Retour le " +
            Utils.roundMinute($(elt).parent().next().text().split(",")[0].split("(")[1]).format(
              "D MMM YYYY à HH[h]mm",
            ) +
            "</span>",
        );
    });
    // Sauvegarde de la chasse en cours, y compris quand il n'y en a plus
    // (annulée) pour vider la boîte
    this.saveChasse(listeChasse);
  }
  /**
   * Choix du mode d'affectation automatique des ouvrières sur la page, et
   * application du mode enregistré. Pour tous les comptes : en C+ le jeu
   * propose nativement Matériaux / Nourriture, mais pas le ratio.
   *
   * @private
   * @method affectation
   */
  affectation() {
    let affection = parseInt(monProfil.parametre["affectationRessource"].valeur),
      ratio = parseInt(monProfil.parametre["ratioRecolte"].valeur),
      // la part en nourriture est saisissable au clavier, celle en matériaux
      // en découle ; les deux suivent le curseur
      libelleRatio = (r) =>
        `<input id="o_ratioRecoltePart" class="o_sliderValeur" type="text" value="${r}"/> % <img alt="nourriture" src="images/icone/icone_pomme.png" height="14" class="o_vAlign"/> nourriture, <span id="o_ratioRecolteReste" class="gras">${100 - r} %</span> <img alt="matériaux" src="images/icone/icone_bois.png" height="13" class="o_vAlign"/> matériaux`,
      majRatio = (r) => {
        $("#o_ratioRecoltePart").spinner("value", r);
        $("#o_ratioRecolteReste").text(`${100 - r} %`);
      };
    // Ajout de la pref pour l'affectation auto.
    // C+ : le jeu a déjà sa rangée « Affectation automatique des ouvrières »
    // (radios choixOuvriere, envoyées au serveur). On y ajoute un choix
    // « Ratio » dans le même groupe pour garder une seule sélection. Sa valeur
    // est « rien », comme la croix : le jeu enregistre « pas d'affectation
    // automatique » (sinon il replacerait les ouvrières libres d'un seul côté
    // entre deux visites) et Toolzzz garde le mode Ratio de son côté. Le
    // radio est reconnu par son id, pas par sa valeur.
    // Non-C+ : rangée Toolzzz complète, avec un nom de groupe qui lui est propre.
    let ligneRatio = `<tr id="o_ratioRecolte" style="display:none;">
            <td><span class="text"><img src="images/icone/favicon.gif" height="16"> Répartition : <span id="o_ratioRecolteValeur">${libelleRatio(ratio)}</span></span></td>
            <td><div id="o_ratioRecolteCurseur" class="slider" style="width:150px;margin:6px 0;"></div></td>
        </tr>`;
    if (Utils.comptePlus) {
      // état enregistré côté serveur, lu avant d'ajouter notre radio
      let natifCoche = $("input[name=choixOuvriere]:checked").val();
      $("input[name=choixOuvriere][value=rien]")
        .closest("label")
        .before(
          `<label title="Répartir les ouvrières entre nourriture et matériaux selon une part fixe, refaite à chaque consultation de la page (Fzzz)"><input type="radio" name="choixOuvriere" value="rien" id="o_ratioRadio"> Ratio</label> `,
        );
      // L'exclusion mutuelle des radios se fait par formulaire propriétaire, pas
      // par position dans le DOM : inséré dynamiquement, notre radio n'en a
      // aucun (le HTML du jeu ferme son <form> avant cette cellule) et forme
      // donc un groupe à part, où il reste coché en même temps qu'un choix
      // natif. On le rattache explicitement au formulaire des radios du jeu,
      // ce qui rétablit l'exclusion et l'envoi de sa valeur (« rien »).
      let formNatif = $("input[name=choixOuvriere]").not("#o_ratioRadio")[0].form;
      if (formNatif) {
        if (!formNatif.id) formNatif.id = "o_formRessource";
        $("#o_ratioRadio").attr("form", formNatif.id);
      }
      // Le mode Ratio soumet toujours « rien » au jeu : si le serveur a
      // enregistré autre chose, c'est que l'affectation native a été choisie
      // depuis, on abandonne le ratio. Sans ce recalage, un ratio mémorisé
      // recocherait Ratio à chaque chargement et rendrait les autres choix
      // impossibles à conserver.
      if (affection == 3 && natifCoche && natifCoche != "rien") {
        affection = 0;
        monProfil.parametre["affectationRessource"].valeur = 0;
        monProfil.parametre["affectationRessource"].sauvegarde();
      }
      if (affection == 3) $("#o_ratioRadio").prop("checked", true);
      $("input[name=choixOuvriere]").closest("tr").after(ligneRatio);
    } else
      $("#ChangeRessource").parent().parent().before(`<tr>
            <td><span class="text"><img src="images/icone/favicon.gif" height="16"> Affectation des ouvrières lors de la consultation de la page : </span></td>
            <td style="white-space:nowrap;"><label><input type="radio" name="o_choixOuvriere" value="nourriture" ${affection == 2 ? 'checked="checked"' : ""}><img alt="nourritures" src="images/icone/icone_pomme.png" height="18" title="Nourriture"></label>
            <label><input type="radio" name="o_choixOuvriere" value="materiaux" ${affection == 1 ? 'checked="checked"' : ""}> <img alt="materiaux" src="images/icone/icone_bois.png" height="17" title="Materiaux"></label>
            <label title="Répartir les ouvrières entre nourriture et matériaux selon une part fixe, conservée après une chasse ou un flood"><input type="radio" name="o_choixOuvriere" value="ratio" ${affection == 3 ? 'checked="checked"' : ""}> Ratio</label>
            <label><input type="radio" name="o_choixOuvriere" value="rien" ${affection == 0 ? 'checked="checked"' : ""}> <img alt="rien" src="images/croix.gif" height="23" title="Pas d'affectation automatique"></label>
        </td></tr>${ligneRatio}`);
    $("#o_ratioRecolte").toggle(affection == 3);
    $("#o_ratioRecoltePart").spinner({ min: 0, max: 100, numberFormat: "i" });
    // Un réglage du ratio n'est qu'un aperçu dans les champs du jeu : il est
    // enregistré avec eux par le bouton du jeu, qui recharge la page. Appliqué
    // à chaque changement, il rechargeait la page à chaque clic sur une flèche.
    let apercuRatio = (r) => {
      ratio = r;
      majRatio(ratio);
      let repartition = this.repartitionRatio(ratio);
      $("#RecolteMateriaux").val(repartition.materiaux);
      $("#RecolteNourriture").val(repartition.nourriture);
    };
    $("#ChangeRessource").on("click", () => {
      if (monProfil.parametre["affectationRessource"].valeur != 3) return;
      monProfil.parametre["ratioRecolte"].valeur = ratio;
      monProfil.parametre["ratioRecolte"].sauvegarde();
    });
    // Le pas jQuery UI reste à 1 : avec un pas de 10, une valeur fine posée
    // depuis le champ serait arrondie. Le glissement à la souris est filtré
    // sur les multiples de 10 pour garder un curseur rapide ; le clavier sur
    // la poignée garde la précision.
    $("#o_ratioRecolteCurseur").slider({
      min: 0,
      max: 100,
      step: 1,
      value: ratio,
      slide: (e, ui) => {
        if (ui.value % 10 && !(e.originalEvent && e.originalEvent.type == "keydown")) return false;
        majRatio(ui.value);
      },
      // seulement sur action de l'utilisateur : une valeur posée depuis le
      // champ est appliquée par le champ
      change: (e, ui) => {
        if (e.originalEvent) apercuRatio(ui.value);
      },
    });
    // saisie au clavier : prise en compte à la sortie du champ ou avec les flèches
    $("#o_ratioRecoltePart").on("spinstop change", (e) => {
      let v = Math.min(100, Math.max(0, parseInt($(e.currentTarget).val()) || 0));
      $("#o_ratioRecolteCurseur").slider("value", v);
      apercuRatio(v);
    });
    if (Utils.comptePlus)
      // sur "click" et non "change" : le jeu peut réagir au changement en
      // rechargeant la page, l'écriture du paramètre doit être faite avant.
      // On identifie notre radio par son id, sa valeur étant « rien » comme
      // celle de la croix native.
      $("input[name=choixOuvriere]").on("click", (e) => {
        let actif = e.currentTarget.id == "o_ratioRadio";
        // un choix natif (nourriture, matériaux, rien) désactive le ratio Toolzzz
        monProfil.parametre["affectationRessource"].valeur = actif ? 3 : 0;
        monProfil.parametre["affectationRessource"].sauvegarde();
        $("#o_ratioRecolte").toggle(actif);
        // soumission même si la répartition est déjà bonne : le jeu doit
        // enregistrer « rien » pour son affectation automatique
        if (actif) this.affecterOuvrieres(3, ratio, true);
      });
    else
      $("input[name=o_choixOuvriere]").change(() => {
        switch ($("input[name=o_choixOuvriere]:checked").val()) {
          case "nourriture":
            monProfil.parametre["affectationRessource"].valeur = 2;
            break;
          case "materiaux":
            monProfil.parametre["affectationRessource"].valeur = 1;
            break;
          case "ratio":
            monProfil.parametre["affectationRessource"].valeur = 3;
            break;
          default:
            monProfil.parametre["affectationRessource"].valeur = 0;
            break;
        }
        monProfil.parametre["affectationRessource"].sauvegarde();
        $("#o_ratioRecolte").toggle(monProfil.parametre["affectationRessource"].valeur == 3);
        // le ratio s'affiche dans les champs du jeu, à enregistrer avec son
        // bouton ; les autres modes agissent à la prochaine consultation
        if (monProfil.parametre["affectationRessource"].valeur == 3) apercuRatio(ratio);
        return false;
      });
    // Affectation des ouvriéres inutilisé si on a la pref
    if (affection) this.affecterOuvrieres(affection, ratio);
  }
  /**
   * Affecte les ouvrières selon le mode choisi et soumet le formulaire du jeu
   * si quelque chose change. Matériaux / Nourriture complètent seulement les
   * ouvrières inutilisées ; Ratio impose la répartition.
   *
   * @private
   * @method affecterOuvrieres
   * @param {Integer} mode 1 matériaux, 2 nourriture, 3 ratio
   * @param {Integer} ratio part en nourriture (%) pour le mode 3
   * @param {Boolean} forcer soumettre même si la répartition ne change pas
   */
  affecterOuvrieres(mode, ratio, forcer = false) {
    const CLE_TENTATIVE = "outiiil_affectationTentee";
    let materiaux = numeral($("#RecolteMateriaux").val()).value(),
      nourriture = numeral($("#RecolteNourriture").val()).value(),
      affectables = Math.min(Utils.ouvrieres, Utils.terrain),
      nouveauMateriaux = materiaux,
      nouvelleNourriture = nourriture;
    if (mode == 3) {
      let repartition = this.repartitionRatio(ratio);
      nouvelleNourriture = repartition.nourriture;
      nouveauMateriaux = repartition.materiaux;
    } else if (materiaux + nourriture < affectables) {
      // si on ne couvre pas le terrain et qu'on a assez d'ouvrières
      if (mode == 1) nouveauMateriaux = affectables - nourriture;
      else if (mode == 2) nouvelleNourriture = affectables - materiaux;
    }
    if (nouveauMateriaux == materiaux && nouvelleNourriture == nourriture && !forcer) {
      sessionStorage.removeItem(CLE_TENTATIVE);
      return;
    }
    // la soumission recharge la page : si le jeu n'a pas appliqué la valeur
    // demandée on ne retente pas, sinon la page rechargerait en boucle
    if (sessionStorage.getItem(CLE_TENTATIVE)) {
      sessionStorage.removeItem(CLE_TENTATIVE);
      $.toast({
        ...TOAST_WARNING,
        text: "L'affectation automatique des ouvrières n'a pas été appliquée par le jeu.",
      });
      return;
    }
    sessionStorage.setItem(CLE_TENTATIVE, "1");
    this._rechargement = true;
    $("#RecolteMateriaux").val(nouveauMateriaux);
    $("#RecolteNourriture").val(nouvelleNourriture);
    $("#ChangeRessource").click();
  }
  /**
   * Ouvrières en nourriture et en matériaux pour une part `ratio` (%) en nourriture.
   *
   * @private
   * @method repartitionRatio
   */
  repartitionRatio(ratio) {
    let affectables = Math.min(Utils.ouvrieres, Utils.terrain),
      nourriture = Math.round((affectables * ratio) / 100);
    return { nourriture: nourriture, materiaux: affectables - nourriture };
  }
  /**
   * Sauvegarde la chasse en cours.
   *
   * @private
   * @method saveChasse
   */
  saveChasse(listeChasse) {
    if (!listeChasse.length) {
      if (this._boiteComptePlus.chasse.length) {
        this._boiteComptePlus.chasse = [];
        this._boiteComptePlus.startChasse = 0;
        this._boiteComptePlus.sauvegarder().majChasse();
      }
      return this;
    }
    if (
      !this._boiteComptePlus.hasOwnProperty("chasse") ||
      this._boiteComptePlus.chasse.length != listeChasse.length ||
      this._boiteComptePlus.chasse[0]["quantite"] != listeChasse[0]["quantite"] ||
      (listeChasse[0]["exp"].diff(this._boiteComptePlus.chasse[0]["exp"], "s") > 1 &&
        !Utils.comptePlus &&
        $("#boiteComptePlus").length)
    ) {
      this._boiteComptePlus.chasse = listeChasse;
      this._boiteComptePlus.startChasse = moment();
      this._boiteComptePlus.sauvegarder().majChasse();
    }
    return this;
  }
}
