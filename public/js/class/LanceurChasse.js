// @ts-check
/*
 * LanceurChasse.js
 * Lanceur de chasses de Fzzz : sur Ressources.php (sous le terrain de chasse)
 * et dans l'onglet « Simuler » de la boîte Chasse, le même formulaire. Le
 * joueur fixe ce qu'il veut, SimulationChasse.resoudre calcule le reste.
 **********************************************************************/

/**
 * Clé (localStorage) des réglages du lanceur de chasses.
 */
const CLE_LANCEUR_CHASSE = "fzzz_lanceurChasse";

/**
 * @class LanceurChasse
 */
class LanceurChasse {
  /**
   * @param {Armee} armee garnison du joueur (Armee.php)
   * @param {Number} nbChasse places de chasse libres
   */
  constructor(armee, nbChasse) {
    this._armee = armee;
    this._nbChasse = Math.max(0, nbChasse || 0);
    /**
     * Dernière simulation
     */
    this._simu = null;
    /**
     * Heure de retour affichée par la simulation (champ « Retour le ») : seule
     * une autre valeur est une saisie du joueur
     */
    this._dateAffichee = null;
    /**
     * Armée et niveaux de la dernière simulation
     */
    this._parametresSimu = null;
  }
  /**
   * Réglages mémorisés du lanceur : ce qui ne dépend pas de la salve du moment,
   * pour n'avoir rien à retoucher d'une fois sur l'autre : difficulté et pertes
   * acceptées (fixées ou Auto, et leur valeur), intervalle, marge de JSN max,
   * rééquilibrage et JSN gardées. Nombre, terrain, retour et rendement
   * repartent en Auto.
   */
  get reglagesLanceur() {
    let r = {};
    try {
      r = JSON.parse(localStorage.getItem(CLE_LANCEUR_CHASSE)) || {};
    } catch (e) {
      r = {};
    }
    return {
      auto: {
        ratio: r.auto && r.auto.ratio != null ? !!r.auto.ratio : false,
        budget: r.auto && r.auto.budget != null ? !!r.auto.budget : true,
      },
      ratio: r.ratio >= 1 ? r.ratio : 9,
      budget: r.budget > 0 ? r.budget : 30,
      intervalle: [2, 30, 60, 120].includes(r.intervalle) ? r.intervalle : 2,
      marge: r.marge >= 0 ? r.marge : SimulationChasse.FACTEUR_SECURITE,
      reequilibrer: r.reequilibrer == null ? true : !!r.reequilibrer,
      jsn: r.jsn > 0 ? r.jsn : 0,
    };
  }
  set reglagesLanceur(r) {
    try {
      localStorage.setItem(CLE_LANCEUR_CHASSE, JSON.stringify(r));
    } catch (e) {}
  }
  /**
   * Formulaire de lancement pour les chasses. Deux choses à décider, le nombre
   * de chasses et le terrain par chasse ; le joueur fixe ce qu'il veut (case
   * « Auto » décochée) parmi le nombre, le terrain (ou l'heure de retour, ce
   * qui revient au même), la difficulté, les pertes acceptées et le rendement,
   * et le lanceur calcule le reste (SimulationChasse.resoudre). Par défaut la
   * difficulté est fixée et le reste calculé, comme le lanceur a toujours fait.
   *
   * @method afficher
   * @param {jQuery} $ancre élément à côté (ou dans) lequel le lanceur s'insère
   * @param {String} position méthode jQuery : "after" (page Ressources) ou "append" (boîte)
   */
  afficher($ancre, position = "after") {
    let R = this.reglagesLanceur,
      ratios = RATIO_CHASSE.map(
        (r, i) =>
          `<option value='${r}' label='${r.toFixed(1)} → Rep10% : ${this._replique(i)}'></option>`,
      ).join(""),
      auto = (id, coche, titre = "") =>
        `<input id='${id}' type='checkbox' class='o_chasseAuto'${coche ? " checked='checked'" : ""}/><label for='${id}'${titre ? ` title='${titre}'` : ""}>Auto</label>`;
    $ancre[
      position
    ](`<br/><div id='o_prepaChasse' class='boite_amelioration simulateur centre'><h2>Lanceur de Chasses</h2>
            <div class='o_spoilerCadre o_marginT15' id='o_chasseParamCadre'>
              <div class='o_spoilerBandeau' id='o_chasseParamToggle' title='Voir ou modifier l&#39;armée et les niveaux que le lanceur utilise'><span class='o_fleche'>▶</span> Armée et niveaux utilisés <span class='small o_chasseParamAide'>(cliquer pour voir ou modifier)</span></div>
              <div class='o_spoilerContenu'>Garder des JSN <input value='0' size='12' id='o_chasseJSN'/> <span class='small'>max : <span id='o_chasseJSNMax'>${numeral(this._armee.nbrJSN).format()}</span></span></div>
              <div id='o_chasseParam' style='display:none' class='o_spoilerContenu'>
                <table class='o_maxWidth'><tr><td valign='top'>
                  <table id='o_chasseParamArmee'>
                    <tr class='gras entete'><td>Armée <span id='o_chasseParamImporter' class='cursor' title='Importer une armée (texte collé : page Armée, rapport, « 30 jsn et 27 artilleuses »…)'>${IMG_COPY}</span></td><td></td></tr>
                    ${NOM_UNITE.slice(1)
                      .map(
                        (nom, i) =>
                          `<tr><td><input name='o_cpUnite' data-i='${i}' value='0' size='12'/></td><td class='left'>${nom}</td></tr>`,
                      )
                      .join("")}
                  </table>
                </td><td valign='top'>
                  <table id='o_chasseParamNiveau'>
                    <tr class='gras entete'><td colspan='2'>Niveaux</td></tr>
                    ${[
                      ["o_cpArmes", "Armes"],
                      ["o_cpBouclier", "Bouclier thoracique"],
                      ["o_cpVitesse", "Vitesse de chasse"],
                      ["o_cpCouveuse", "Couveuse"],
                      ["o_cpSolarium", "Solarium"],
                      ["o_cpPonte", "Technique de ponte"],
                    ]
                      .map(
                        ([id, nom]) =>
                          `<tr><td><input id='${id}' value='0' size='6'/></td><td class='left'>${nom}</td></tr>`,
                      )
                      .join("")}
                    <tr class='gras entete'><td colspan='2'>Chasse</td></tr>
                    <tr><td><input id='o_cpTdcLancement' value='0' size='12' title='Fixe la durée des chasses'/></td><td class='left'>TdC au lancement</td></tr>
                    <tr><td><input id='o_cpPlaces' value='0' size='6'/></td><td class='left'>Places de chasse libres</td></tr>
                    <tr><td colspan='2'><button type='button' id='o_chasseParamRetablir' class='o_button'>Rétablir mes valeurs</button></td></tr>
                  </table>
                  <p class='small'><em>Modifiés, ces paramètres servent à simuler : le lancement est alors désactivé.</em></p>
                </td></tr></table>
              </div>
            </div>
            <table id='o_lanceurChasse' class='o_maxWidth o_marginT15' cellspacing=0>
			<tr class='ligne_paire'><td>Terrain à l'arrivée</td><td><input value='${Math.min(Utils.terrain || 0, monProfil.parametre["tdcArriveeMax"].valeur || Infinity)}' size='21' id='o_chasseTDCDep'/></td><td></td></tr>
			<tr><td>Nombre de chasse</td><td><input value='0' size='21' id='o_chasseNbr'/></td><td>${auto("o_chasseNbrAuto", true)}</td></tr>
			<tr class='ligne_paire'><td>Terrain par chasse</td><td><input value='0' size='21' id='o_chasseTDCRep'/></td><td>${auto("o_chasseTDCRepAuto", true, "Calculé, ou fixé ici ou par l&#39;heure de retour")}</td></tr>
			<tr><td>Retour le</td><td><input value='' size='21' id='o_chasseDateArrivee' placeholder='JJ-MM-AAAA HH:mm'/></td><td class='small'>= terrain par chasse</td></tr>
			<tr class='ligne_paire'><td>Difficulté</td><td><input value='9' size='21' id='o_chasseDiff' list='o_chasseDiffListe' title='Ratio (Attaque de votre Armée) / (Difficulté de chasse) : détermine les pertes et taux de réplique de votre chasse. Les valeurs de la liste sont celles des tables de pertes ; entre deux, les pertes estimées sont celles de la valeur du dessous.'/><datalist id='o_chasseDiffListe'>${ratios}</datalist></td><td>${auto("o_chasseDiffAuto", false, `Difficulté la plus basse que les pertes acceptées permettent, jamais sous ${SimulationChasse.RATIO_PLANCHER}`)} <span id='o_chasseDiffInfo' class='small'></span></td></tr>
			<tr><td title='Part du temps de ponte de JSN consacrée à remplacer les pertes moyennes'>Pertes acceptées (% de la ponte) <span class='o_chasseCible' id='o_chasseCiblePertes' title='Ce que le lanceur minimise : la salve la moins coûteuse qui atteint le rendement fixé'>🎯</span></td><td><input value='${R.budget}' size='21' id='o_chasseBudget'/></td><td>${auto("o_chasseBudgetAuto", true)} <span id='o_chasseBudgetInfo' class='small'></span></td></tr>
			<tr class='ligne_paire'><td title='TdC chassé par heure de chasse'>Rendement (cm² / h) <span class='o_chasseCible' id='o_chasseCibleRendement' title='Ce que le lanceur maximise, dans les limites fixées'>🎯</span></td><td><input value='0' size='21' id='o_chasseRendement'/></td><td>${auto("o_chasseRendementAuto", true, "Fixé : la salve la moins coûteuse qui l&#39;atteint")} <span id='o_chasseRendementInfo' class='small'></span></td></tr>
			<tr><td colspan='3'><em>Basé sur le lanceur de <a href='http://alliancead2.free.fr/Outils/Repository/HuntSimv2.00/Simulator_2.00.00.html' class='violet' target='_blank' rel='noopener'>Calystene</a></em> · <a id='o_chasseReglagesDefaut' class='cursor souligne small' title='Oublie les réglages mémorisés (difficulté, pertes acceptées, intervalle, marge, rééquilibrage, JSN gardées)'>réglages par défaut</a></td></tr>
			</table>
            <p id='o_chasseAlerte' class='o_marginT15'></p>
            <div class='o_marginT15'><span title='Au plus marge × pertes max de JSN partent en tampon avec chaque chasse ; au-delà, les JSN sont des attaquantes. Si le stock ne permet pas ce tampon à toutes les chasses, il est réduit pour toutes. Dès × 1, les pertes max sont couvertes.'>Marge JSN max <input value='${R.marge}' size='12' id='o_chasseMarge'/> × pertes max</span> &nbsp; <input id='o_chasseReequilibrer' type='checkbox'${R.reequilibrer ? " checked='checked'" : ""}/><label for='o_chasseReequilibrer' title='Redistribue les JSN au prorata des pertes max de chaque chasse, puis complète avec les SN et les NE (totaux inchangés).'>Rééquilibrer JSN → SN → NE</label></div>
            <div id='o_simuChasse'><table id='o_simulationChasse' cellspacing=0 class='o_maxWidth'></table></div>
            <div class='o_marginT15'>Intervalle entre les chasses <select id='o_chasseInt' title='Intervalle entre les chasses'><option value='2' selected>2 secondes</option><option value='30'>30 secondes</option><option value='60'>1 minute</option><option value='120'>2 minutes</option></select></div>
            <div class='o_pile o_marginT15'><button class='o_button f_success' type='button' id='o_chasseEnvoyer'>Envoyer</button>
            <button class='o_button f_info' type='button' id='o_chasseEnvoyerPartager' title='Lance les chasses, puis publie toutes tes chasses en cours dans le forum de la ${Utils.echapper(Utils.alliance || "l'alliance")}'>Envoyer + partager</button></div>
            <p class='o_marginT0'><em class='small'>Veuillez rester sur cette page le temps du lancement !</em></p>
            <table id='o_recapChasse' cellspacing=0>
			<tr class='ligne_paire'><td colspan='3' class='gras'>Récapitulatif</td></tr>
			<tr><td>Chasse(s)</td><td>:</td><td id='o_chasseTotal'></td><td></td></tr>
			<tr class='ligne_paire'><td>Temps requis</td><td>:</td><td id='o_chasseTemps'></td></tr>
			<tr><td>Retour</td><td>:</td><td id='o_chasseRetour'></td></tr>
			<tr class='ligne_paire'><td>Rentabilité</td><td>:</td><td id='o_chasseRentabilite'></td></tr>
			<tr><td>Difficulté</td><td>:</td><td id='o_chasseRefDiff'></td></tr>
			<tr class='ligne_paire'><td>Perte estimé</td><td>:</td><td id='o_chassePerte'></td></tr>
			<tr><td>Limité par</td><td>:</td><td id='o_chasseLimite'></td></tr>
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
    $("#o_chasseTDCRep").spinner({ min: 1, numberFormat: "i" });
    $("#o_chasseNbr").spinner({ min: 1, max: this._nbChasse, numberFormat: "i" });
    $("#o_chasseBudget").spinner({ min: 0.1, step: 0.1, numberFormat: "i" });
    $("#o_chasseRendement").spinner({ min: 1, numberFormat: "i" });
    // le widget pose autocomplete=off, qui peut cacher la liste des ratios de référence
    $("#o_chasseDiff").spinner({ min: 1, step: 0.1, numberFormat: "i" }).removeAttr("autocomplete");
    $("#o_chasseMarge").spinner({ min: 0, step: 0.1, numberFormat: "i" });
    $("input[name='o_cpUnite'], #o_cpTdcLancement").spinner({ min: 0, numberFormat: "i" });
    $("#o_cpArmes, #o_cpBouclier, #o_cpVitesse, #o_cpCouveuse, #o_cpSolarium, #o_cpPonte").spinner({
      min: 0,
      max: 50,
      numberFormat: "i",
    });
    $("#o_cpPlaces").spinner({ min: 0, max: 20, numberFormat: "i" });
    this._remplirParametres();
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
    this._restaurerReglages();
    this._majVerrous();
    this.preparerChasse();
    // Event
    $(
      "#o_chasseTDCDep, #o_chasseNbr, #o_chasseTDCRep, #o_chasseBudget, #o_chasseRendement, #o_chasseDiff",
    ).on("input spin", (e, ui) => {
      // champs décimaux : la virgule française vaut le point (Globalize est en
      // culture par défaut, où « 7,2 » se lirait 72) ; pas les entiers, que
      // Globalize affiche avec une virgule de milliers (« 1,804 »)
      if (
        !ui &&
        ["o_chasseDiff", "o_chasseBudget"].includes(e.currentTarget.id) &&
        /^\d+,\d{1,2}$/.test(e.currentTarget.value)
      )
        e.currentTarget.value = e.currentTarget.value.replace(",", ".");
      let nombre = ui ? ui.value : $(e.currentTarget).spinner("value");
      $(e.currentTarget).spinner("value", nombre);
      if (e.currentTarget.id == "o_chasseDiff") this._majCouleurDiff();
      this._sauverReglages();
      this.preparerChasse();
    });
    $(".o_chasseAuto").on("change", (e) => {
      this._majVerrous(e.currentTarget.id);
      this._sauverReglages();
      this.preparerChasse();
    });
    // un clic (ou le clavier) sur un champ calculé le fixe, à la valeur affichée
    let cases = {
      o_chasseNbr: "#o_chasseNbrAuto",
      o_chasseTDCRep: "#o_chasseTDCRepAuto",
      o_chasseBudget: "#o_chasseBudgetAuto",
      o_chasseRendement: "#o_chasseRendementAuto",
      o_chasseDiff: "#o_chasseDiffAuto",
    };
    $("#o_chasseNbr, #o_chasseTDCRep, #o_chasseBudget, #o_chasseRendement, #o_chasseDiff")
      .parent(".ui-spinner")
      .on("click", (e) => this._fixerAuClic($(e.currentTarget).find("input").attr("id"), cases));
    $("#o_chasseNbr, #o_chasseTDCRep, #o_chasseBudget, #o_chasseRendement, #o_chasseDiff").on(
      "focus",
      (e) => this._fixerAuClic(e.currentTarget.id, cases),
    );
    $("#o_chasseInt").change(() => this._sauverReglages());
    $("#o_chasseReglagesDefaut").click(() => {
      try {
        localStorage.removeItem(CLE_LANCEUR_CHASSE);
      } catch (e) {}
      $("#o_chasseReequilibrer").prop("checked", this.reglagesLanceur.reequilibrer);
      $("#o_chasseMarge").spinner("value", this.reglagesLanceur.marge);
      this._restaurerReglages();
      this._majVerrous();
      this.preparerChasse();
    });
    $("#o_chasseJSN").on("input spin", (e, ui) => {
      let nombre = ui ? ui.value : $(e.currentTarget).spinner("value");
      $(e.currentTarget).spinner("value", nombre);
      this._sauverReglages();
      this.preparerChasse();
    });
    $("#o_chasseDateArrivee").on("change", () => this.terrainDepuisDate());
    $("#o_chasseMarge").on("input spin", (e, ui) => {
      if (!ui && /^\d+,\d{1,2}$/.test(e.currentTarget.value))
        e.currentTarget.value = e.currentTarget.value.replace(",", ".");
      let nombre = ui ? ui.value : $(e.currentTarget).spinner("value");
      $(e.currentTarget).spinner("value", nombre);
      this._sauverReglages();
      this.preparerChasse();
    });
    $("#o_chasseParam input").on("input spin", (e, ui) => {
      let nombre = ui ? ui.value : $(e.currentTarget).spinner("value");
      $(e.currentTarget).spinner("value", nombre);
      this._majParametres();
      this.preparerChasse();
    });
    $("#o_chasseParamImporter").click(() =>
      ouvrirImportArmee((armee) => {
        $("input[name='o_cpUnite']").each((_, elt) =>
          $(elt).spinner("value", armee.unite[$(elt).data("i")] || 0),
        );
        this._majParametres();
        this.preparerChasse();
      }),
    );
    $("#o_chasseParamRetablir").click(() => {
      this._remplirParametres();
      this.preparerChasse();
    });
    $("#o_chasseParamToggle").click(() => {
      let ouvert = !$("#o_chasseParam").is(":visible");
      $("#o_chasseParam").toggle(ouvert);
      $("#o_chasseParamToggle")
        .toggleClass("o_ouvert", ouvert)
        .find(".o_fleche")
        .text(ouvert ? "▼" : "▶");
    });
    $("#o_chasseReequilibrer").on("change", () => {
      this._sauverReglages();
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
    $("#o_chasseEnvoyer, #o_chasseEnvoyerPartager").click((e) => {
      if (this._armee.getSommeUnite() && this._simu && !this._parametresModifies()) {
        // désactivés dès le premier clic : un double clic enverrait chaque chasse deux fois
        $("#o_chasseEnvoyer, #o_chasseEnvoyerPartager").prop("disabled", true);
        $(e.currentTarget).text("Envoi en cours…");
        let terrainChasse = this._simu.terrain,
          nbChasse = this._simu.nombre,
          intervalle = $("#o_chasseInt").val() * 1000;
        // partage au rechargement qui suit la dernière chasse ; sans rechargement
        // (page quittée en route), l'ordre expire
        if (e.currentTarget.id == "o_chasseEnvoyerPartager")
          try {
            sessionStorage.setItem(
              CLE_PARTAGE_CHASSES_APRES,
              String(Date.now() + nbChasse * intervalle + 5 * 60000),
            );
          } catch (err) {}
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
   * Mémorise les pertes acceptées, la marge de JSN et le rééquilibrage.
   *
   * @private
   * @method _sauverReglages
   */
  _sauverReglages() {
    let R = this.reglagesLanceur,
      auto = (id) => $(id).is(":checked"),
      valeur = (id) => $(id).spinner("value") || 0,
      cases = { ratio: auto("#o_chasseDiffAuto"), budget: auto("#o_chasseBudgetAuto") };
    this.reglagesLanceur = {
      auto: cases,
      ratio: cases.ratio ? R.ratio : valeur("#o_chasseDiff"),
      budget: cases.budget ? R.budget : valeur("#o_chasseBudget"),
      intervalle: parseInt($("#o_chasseInt").val()) || 2,
      marge: Math.max(0, valeur("#o_chasseMarge")),
      reequilibrer: $("#o_chasseReequilibrer").is(":checked"),
      jsn: valeur("#o_chasseJSN"),
    };
  }
  /**
   * Applique les réglages mémorisés au formulaire (avant le premier calcul).
   *
   * @private
   * @method _restaurerReglages
   */
  _restaurerReglages() {
    let R = this.reglagesLanceur;
    $("#o_chasseDiffAuto").prop("checked", R.auto.ratio);
    $("#o_chasseBudgetAuto").prop("checked", R.auto.budget);
    $("#o_chasseDiff").spinner("value", R.ratio);
    this._majCouleurDiff();
    $("#o_chasseBudget").spinner("value", R.budget);
    $("#o_chasseInt").val(String(R.intervalle));
    $("#o_chasseJSN").spinner("value", Math.min(R.jsn, $("#o_chasseJSN").spinner("option", "max")));
    return this;
  }
  /**
   * Armée et niveaux du compte : garnison, recherches, ponte, TdC, places.
   *
   * @private
   * @method _parametresReels
   */
  _parametresReels() {
    // un niveau inconnu vaut -1 dans le profil : compté 0, comme les champs
    let niveau = (n) => Math.max(0, n || 0);
    return {
      unites: this._armee.unite.slice(),
      armes: niveau(monProfil.niveauRecherche[2]),
      bouclier: niveau(monProfil.niveauRecherche[1]),
      vitesse: niveau(monProfil.niveauRecherche[5]),
      couveuse: niveau(monProfil.niveauConstruction[3]),
      solarium: niveau(monProfil.niveauConstruction[4]),
      ponte: niveau(monProfil.niveauRecherche[0]),
      tdcLancement: niveau(Utils.terrain),
      nombreMax: Math.max(0, this._nbChasse || 0),
    };
  }
  /**
   * Remplit la section « Armée et niveaux » avec les valeurs du compte.
   *
   * @private
   * @method _remplirParametres
   */
  _remplirParametres() {
    let P = this._parametresReels();
    $("input[name='o_cpUnite']").each((_, elt) =>
      $(elt).spinner("value", P.unites[$(elt).data("i")]),
    );
    for (let [id, cle] of [
      ["#o_cpArmes", "armes"],
      ["#o_cpBouclier", "bouclier"],
      ["#o_cpVitesse", "vitesse"],
      ["#o_cpCouveuse", "couveuse"],
      ["#o_cpSolarium", "solarium"],
      ["#o_cpPonte", "ponte"],
      ["#o_cpTdcLancement", "tdcLancement"],
      ["#o_cpPlaces", "nombreMax"],
    ])
      $(id).spinner("value", P[cle]);
    this._majParametres();
    return this;
  }
  /**
   * Armée et niveaux saisis dans la section « Armée et niveaux ».
   *
   * @private
   * @method _parametres
   */
  _parametres() {
    let valeur = (id) => $(id).spinner("value") || 0,
      unites = new Array(14).fill(0);
    $("input[name='o_cpUnite']").each((_, elt) => (unites[$(elt).data("i")] = valeur(elt)));
    return {
      unites,
      armes: valeur("#o_cpArmes"),
      bouclier: valeur("#o_cpBouclier"),
      vitesse: valeur("#o_cpVitesse"),
      couveuse: valeur("#o_cpCouveuse"),
      solarium: valeur("#o_cpSolarium"),
      ponte: valeur("#o_cpPonte"),
      tdcLancement: valeur("#o_cpTdcLancement"),
      nombreMax: valeur("#o_cpPlaces"),
    };
  }
  /**
   * Vrai quand la section « Armée et niveaux » ne reflète plus le compte :
   * la salve calculée ne peut pas partir.
   *
   * @private
   * @method _parametresModifies
   */
  _parametresModifies() {
    return JSON.stringify(this._parametres()) != JSON.stringify(this._parametresReels());
  }
  /**
   * Après un changement de paramètres : JSN à garder bornées par l'armée saisie.
   *
   * @private
   * @method _majParametres
   */
  _majParametres() {
    let jsn = this._parametres().unites[0];
    $("#o_chasseJSN").spinner("option", "max", jsn);
    if ($("#o_chasseJSN").spinner("value") > jsn) $("#o_chasseJSN").spinner("value", jsn);
    $("#o_chasseJSNMax").text(numeral(jsn).format());
    $("#o_chasseNbr").spinner("option", "max", Math.max(1, this._parametres().nombreMax));
    return this;
  }
  /**
   * Un champ calculé qu'on touche devient fixé (sauf verrouillé par nombre et
   * terrain fixés) : sa case Auto se décoche, la valeur affichée reste.
   *
   * @private
   * @method _fixerAuClic
   * @param {String} id du champ
   * @param {Object} cases id du champ → sélecteur de sa case Auto
   */
  _fixerAuClic(id, cases) {
    let $case = $(cases[id]);
    if (!$case.length || !$case.is(":checked") || $case.prop("disabled")) return;
    $case.prop("checked", false);
    this._majVerrous(cases[id].slice(1));
    this._sauverReglages();
    this.preparerChasse();
  }
  /**
   * Cases « Auto », champs et cible 🎯 : ce qui est fixé se saisit, le reste
   * s'affiche, et la cible marque ce que le lanceur optimise (le rendement, ou
   * les pertes quand le rendement est fixé).
   * Nombre et terrain fixés déterminent tout, le reste passe en Auto ; la
   * difficulté ne peut être libre que si un coût est fixé (pertes acceptées ou
   * rendement), sinon le lanceur descendrait au plancher quoi qu'il en coûte.
   *
   * @private
   * @method _majVerrous
   * @param {String} declencheur id de la case qui vient de changer
   */
  _majVerrous(declencheur = "") {
    let auto = (id) => $(id).is(":checked"),
      tout = !auto("#o_chasseNbrAuto") && !auto("#o_chasseTDCRepAuto");
    for (let id of ["#o_chasseDiffAuto", "#o_chasseBudgetAuto", "#o_chasseRendementAuto"]) {
      if (tout) $(id).prop("checked", true);
      $(id).prop("disabled", tout);
    }
    if (
      !tout &&
      auto("#o_chasseDiffAuto") &&
      auto("#o_chasseBudgetAuto") &&
      auto("#o_chasseRendementAuto")
    ) {
      if (declencheur == "o_chasseDiffAuto") {
        $("#o_chasseBudgetAuto").prop("checked", false);
        $("#o_chasseBudget").spinner("value", this.reglagesLanceur.budget);
      } else $("#o_chasseDiffAuto").prop("checked", false);
    }
    // calculé : en lecture seule et grisé, mais cliquable (un clic le fixe)
    for (let [champ, id] of [
      ["#o_chasseNbr", "#o_chasseNbrAuto"],
      ["#o_chasseTDCRep", "#o_chasseTDCRepAuto"],
      ["#o_chasseBudget", "#o_chasseBudgetAuto"],
      ["#o_chasseRendement", "#o_chasseRendementAuto"],
      ["#o_chasseDiff", "#o_chasseDiffAuto"],
    ])
      $(champ)
        .prop("readonly", auto(id))
        .parent(".ui-spinner")
        .toggleClass("o_chasseCalcule", auto(id));
    // la cible : le rendement, ou les pertes quand le rendement est fixé
    $("#o_chasseCibleRendement").toggle(!tout && auto("#o_chasseRendementAuto"));
    $("#o_chasseCiblePertes").toggle(!tout && !auto("#o_chasseRendementAuto"));
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
      auto = (id) => $(id).is(":checked"),
      valeur = (id) => $(id).spinner("value") || 0,
      autoNb = auto("#o_chasseNbrAuto"),
      autoTerrain = auto("#o_chasseTDCRepAuto"),
      autoRatio = auto("#o_chasseDiffAuto"),
      autoBudget = auto("#o_chasseBudgetAuto"),
      autoRendement = auto("#o_chasseRendementAuto"),
      ratioChoisi = valeur("#o_chasseDiff"),
      R = this.reglagesLanceur,
      P = (this._parametresSimu = this._parametres()),
      tempsPonte = SimulationChasse.tempsPonte(P.couveuse + P.solarium + P.ponte),
      fmt = (v, d = 0) => numeral(v).format(d ? "0,0." + "0".repeat(d) : "0,0"),
      unites = P.unites.slice();
    if (!tdcArrivee) return;
    // JSN gardées à la fourmilière
    unites[0] = Math.max(0, unites[0] - valeur("#o_chasseJSN"));
    let p = {
        unites,
        armes: P.armes,
        bouclier: P.bouclier,
        tdcLancement: P.tdcLancement,
        tdcArrivee,
        nombreMax: P.nombreMax,
        vitesse: P.vitesse,
        tempsPonte,
        nombre: autoNb ? 0 : valeur("#o_chasseNbr"),
        terrain: autoTerrain ? 0 : valeur("#o_chasseTDCRep"),
        ratio: autoRatio ? 0 : ratioChoisi,
        budget: autoBudget ? 0 : valeur("#o_chasseBudget") / 100,
        rendement: autoRendement ? 0 : valeur("#o_chasseRendement") / 3600,
        facteur: R.marge,
        reequilibrer: R.reequilibrer,
      },
      plan = this._armee.resoudreChasse(p),
      alertes = [];
    // difficulté choisie hors de portée : comme avant, on redescend à ce que
    // l'armée peut tenir (une chasse de 1 cm²), la liste suit
    if (plan && plan.erreur == "ratio" && !autoRatio)
      plan = this._armee.resoudreChasse({
        ...p,
        ratio: 0,
        nombre: p.nombre || 1,
        terrain: p.terrain || 1,
      });
    this._simu = plan && !plan.erreur ? plan : null;
    $("#o_chasseEnvoyer, #o_chasseEnvoyerPartager").prop(
      "disabled",
      !this._simu || this._parametresModifies(),
    );
    if (!this._simu) {
      this._alerter([
        !plan
          ? P.nombreMax < 1
            ? "Aucune chasse possible pour l'instant (toutes les places sont prises)."
            : "Aucune unité d'attaque à envoyer."
          : plan.erreur == "budget"
            ? "Pertes acceptées trop faibles : même 1 cm² coûte davantage."
            : plan.erreur == "plancher"
              ? `Armée trop faible pour ce TdC : la difficulté ${SimulationChasse.RATIO_PLANCHER} ne tient même pas sur 1 cm².`
              : "Rien ne borne le coût : fixe la difficulté, les pertes acceptées ou le rendement.",
      ]);
      $("#o_simulationChasse").empty();
      $("#o_chasseLimite").text("");
      return;
    }
    if (autoNb) $("#o_chasseNbr").spinner("value", plan.nombre);
    if (autoTerrain) $("#o_chasseTDCRep").spinner("value", plan.terrain);
    if (autoBudget) $("#o_chasseBudget").spinner("value", Math.round(plan.budget * 1000) / 10);
    if (autoRendement) $("#o_chasseRendement").spinner("value", Math.round(plan.rendement * 3600));
    // l'heure de retour suit le terrain par chasse
    this._dateAffichee = Utils.roundMinute(plan.duree).format("DD-MM-YYYY HH:mm");
    $("#o_chasseDateArrivee").val(this._dateAffichee);
    $("#o_chasseBudgetInfo").text(`≈ ${fmt((plan.budget * 86400) / tempsPonte)} JSN / jour`);
    $("#o_chasseRendementInfo").text(`≈ ${fmt(plan.rendement * 86400)} cm² / jour`);
    this.majSimulation(this._armee.repartition, unites);
    this.majRecapitulatif(plan);
    // Difficulté calculée (ratio atteint), ou redescendue si l'armée ne tient
    // pas celle choisie (ou si nombre et terrain sont fixés à la main) ; sinon
    // la valeur saisie reste
    if (autoRatio || plan.ratio < ratioChoisi - 0.0001) {
      $("#o_chasseDiff").spinner("value", Math.round(plan.ratio * 100) / 100);
      this._majCouleurDiff();
    }
    this._majInfoDiff(plan, tdcArrivee, ratioChoisi, autoNb && autoTerrain, autoRatio);
    this.mettreAjourPertesTdc();
    let infos = [];
    if (plan.plafonne)
      alertes.push(
        `Difficulté plafonnée à ${SimulationChasse.RATIO_PLANCHER} : pertes ${fmt(100 * plan.budget, 1)} % seulement.`,
      );
    if (plan.infaisable)
      alertes.push(`Rendement inatteignable : au mieux ${fmt(plan.rendement * 3600)} cm² / h.`);
    // tampon de chaque chasse en multiples de ses pertes max, JSN seules puis
    // avec les SN et NE (ordre de mort JSN → SN → NE → JS…) : sous × 1 avec
    // tout, les unités chères sont exposées ; sous × 1 en JSN seules, ce sont
    // des SN ou NE qui peuvent mourir ; sous la marge, simple information
    let pv = (u) => VIE_UNITE[u + 1] / VIE_UNITE[1],
      couvJsn = plan.chasses.map((c) => (c.pertes.MAX > 0 ? c.unites[0] / c.pertes.MAX : Infinity)),
      couvTout = plan.chasses.map((c) =>
        c.pertes.MAX > 0
          ? (c.unites[0] + c.unites[1] * pv(1) + c.unites[2] * pv(2)) / c.pertes.MAX
          : Infinity,
      ),
      liste = (couv) =>
        couv
          .map((x, i) => (x < 0.995 ? `${i + 1} (× ${fmt(x, 2)})` : null))
          .filter(Boolean)
          .join(", "),
      exposees = liste(couvTout),
      entamees = liste(couvJsn);
    if (exposees)
      alertes.push(`Unités chères exposées (JSN + SN + NE < pertes max) : chasses ${exposees}.`);
    else if (entamees)
      infos.push(
        `SN/NE exposées (JSN < pertes max) : chasses ${entamees}. Avec SN et NE : × ${fmt(Math.min(...couvTout), 2)} au moins.`,
      );
    else if (Math.min(...couvJsn) < R.marge - 0.005)
      infos.push(
        `Tampon JSN × ${fmt(Math.min(...couvJsn), 2)} des pertes max (max × ${fmt(R.marge, 2)} : ${fmt(unites[0])} JSN pour ${fmt(plan.pertes.MAX)} de pertes max).`,
      );
    if (this._parametresModifies())
      alertes.push(
        "Simulation seulement : armée ou niveaux modifiés (« Rétablir mes valeurs » pour lancer).",
      );
    this._alerter(alertes, infos);
  }
  /**
   * Affiche les alertes (en rouge) et les informations sous le formulaire.
   *
   * @private
   * @method _alerter
   */
  _alerter(alertes, infos = []) {
    $("#o_chasseAlerte").html(
      [
        ...alertes.map((t) => `<span class='red gras'>${t}</span>`),
        ...infos.map((t) => `<span class='small'>${t}</span>`),
      ].join("<br/>"),
    );
  }
  /**
   * Taux de réplique à 10 % d'un ratio de référence, pour les libellés.
   *
   * @private
   * @method _replique
   */
  _replique(i) {
    return REPLIQUE_CHASSE[i] >= 0.2 ? (100 * REPLIQUE_CHASSE[i]).toFixed(2) + "%" : "< 20%";
  }
  /**
   * À côté de la difficulté : le ratio de référence des tables (celui du
   * dessous) et son taux de réplique à 10 %, et pourquoi la valeur a changé.
   * Même une chasse de 1 cm² a une difficulté minimale, qui croît avec le TdC
   * (formule de Calystene) : au-delà de attaque / difficulté minimale, aucun
   * nombre ni aucun terrain ne tient le ratio.
   *
   * @private
   * @method _majInfoDiff
   * @param {Object} plan résultat de la simulation
   * @param {Number} tdcArrivee TdC à l'arrivée des chasses
   * @param {Number} choisi ratio saisi avant le calcul
   * @param {Boolean} auto nombre et terrain calculés par le lanceur
   * @param {Boolean} libre difficulté calculée elle aussi (pertes acceptées ou rendement fixés)
   */
  _majInfoDiff(plan, tdcArrivee, choisi, auto, libre = false) {
    let max = plan.attArmee / SimulationChasse.difficulte(Math.max(1, tdcArrivee), 1),
      info = `réf. ${RATIO_CHASSE[plan.indexRef].toFixed(1)}, Rep10% : ${this._replique(plan.indexRef)}`;
    if (libre) info += " — au plus bas que les pertes acceptées ou le rendement permettent.";
    else if (!auto) info += " — nombre ou terrain fixé : la difficulté en découle.";
    else if (choisi > max + 0.0001)
      info += ` — ${numeral(choisi).format("0.0")} impossible, max ${numeral(max).format("0.00")} avec cette armée (une chasse de 1 cm²).`;
    $("#o_chasseDiffInfo").text(info);
  }
  /**
   * Met à jour la couleur du champ Difficulté selon le seuil de ratio.
   *
   * @private
   * @method _majCouleurDiff
   */
  _majCouleurDiff() {
    let value = $("#o_chasseDiff").spinner("value") || 0,
      color = value <= 4 ? "black" : value <= 6 ? "red" : value <= 7.5 ? "orange" : "green";
    $("#o_chasseDiff").css("color", color);
  }
  /**
   * Fixe le terrain par chasse pour qu'une chasse parte maintenant et revienne
   * à la date saisie. Inverse de `temps = (Utils.terrain + terrain) × 0.9^niveau`
   * (SimulationChasse.duree).
   *
   * @private
   * @method terrainDepuisDate
   */
  terrainDepuisDate() {
    let raw = $("#o_chasseDateArrivee").val();
    // datetimepicker redéclenche `change` au blur : seule une valeur différente
    // de celle affichée par la simulation est une saisie
    if (!raw || raw === this._dateAffichee) return;
    let target = moment(raw, "DD-MM-YYYY HH:mm");
    if (!target.isValid()) return;
    let secondsLeft = target.diff(Horloge.serveur(), "seconds"),
      P = this._parametres(),
      terrain = Math.round(secondsLeft / Math.pow(0.9, P.vitesse) - P.tdcLancement);
    if (terrain <= 0) {
      this._alerter([secondsLeft <= 0 ? "Date de retour passée." : "Retour trop tôt."]);
      return;
    }
    $("#o_chasseTDCRepAuto").prop("checked", false);
    $("#o_chasseTDCRep").spinner("enable").spinner("value", terrain);
    this._majVerrous("o_chasseTDCRepAuto");
    this.preparerChasse();
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
          (this._parametresSimu || this._parametresReels()).bouclier,
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
   * @param {Array} unites armée simulée (colonnes affichées)
   */
  majSimulation(repartition, unites = this._armee.unite) {
    let simulation = `<tr class='gras'><td>Chasse</td>${NOM_RAC_UNITE.slice(1)
      .map((nom, j) => (unites[j] ? `<td>${nom}</td>` : ""))
      .join("")}</tr>`;
    for (let i = 0, l = repartition.length; i < l; i++) {
      simulation += `<tr><td>${i + 1}</td>`;
      for (
        let j = -1;
        ++j < 14;
        simulation += unites[j]
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
   * @param {Object} plan résultat d'Armee.resoudreChasse
   */
  majRecapitulatif(plan) {
    let nbChasse = plan.nombre,
      terrainChasse = plan.terrain,
      temps = plan.duree;
    $("#o_chasseTotal").html(
      nbChasse +
        " x " +
        numeral(terrainChasse).format() +
        " = <span class='green'>" +
        numeral(nbChasse * terrainChasse).format() +
        "</span> cm²",
    );
    $("#o_chasseTemps").text(Utils.intToTime(temps));
    let dateLong = Utils.roundMinute(temps).format("dddd D MMM YYYY [à] HH[h]mm");
    $("#o_chasseRetour").text(dateLong.charAt(0).toUpperCase() + dateLong.slice(1));
    $("#o_chasseRentabilite").text(
      numeral(Math.round(plan.rendement * 3600)).format() +
        " cm² / h (" +
        numeral(Math.round(plan.rendement * 86400)).format() +
        " / jour)",
    );
    $("#o_chasseRefDiff").text(
      numeral(plan.ratio).format("0.00") + " ~ " + RATIO_CHASSE[plan.indexRef].toFixed(1),
    );
    $("#o_chassePerte").text(
      numeral(Math.round(plan.pertes.AVG)).format() +
        " JSN (max : " +
        numeral(Math.round(plan.pertes.MAX)).format() +
        "), " +
        numeral(100 * plan.budget).format("0.0") +
        " % du temps de ponte",
    );
    $("#o_chasseLimite").text(
      {
        fixe: "nombre et terrain fixés",
        ratio: "la difficulté choisie",
        budget: "les pertes acceptées",
        plancher: `la difficulté plancher ${SimulationChasse.RATIO_PLANCHER}`,
        rendement: "le rendement demandé",
      }[plan.limite] || "",
    );
  }
}
