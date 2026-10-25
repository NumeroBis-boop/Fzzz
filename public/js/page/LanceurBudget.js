/*
 * LanceurBudget.js
 * Fzzz — d'après le greffon « pilotage par budget de pertes » (CHS2B) du
 * simulateur de chasse de Calystene.
 **********************************************************************/

/**
 * Clé (localStorage) des réglages du lanceur par budget.
 */
const CLE_LANCEUR_BUDGET = "fzzz_lanceurBudget";
/**
 * Bornes de la recherche du ratio : en dessous de 6 on est en zone rouge.
 */
const RATIO_BUDGET_MIN = 6;
const RATIO_BUDGET_MAX = 15;

/**
 * Lanceur de chasses piloté par un budget de pertes, sur Ressources.php.
 *
 * Le joueur fixe la part du temps de ponte de JSN qu'il accepte de consacrer à
 * remplacer les pertes de chasse :
 *
 *   budget = (pertes moyennes en JSN × temps de ponte d'une JSN) / durée de la salve
 *
 * Pour chaque nombre de chasses n possible, on cherche le plus petit ratio
 * (entre 6 et 15) qui tient ce budget, puis la taille M des chasses qui donne
 * ce ratio ; on garde le découpage qui maximise le TdC chassé par jour.
 * Difficulté, pertes, durée et répartition des unités viennent de
 * SimulationChasse (portage du simulateur de Calystene 2.00.38).
 *
 * Le lancement récupère un jeton de sécurité neuf avant chaque chasse, vérifie
 * le message « La chasse est lancée » et s'arrête au premier échec. Tout part
 * d'un clic du joueur (salve entière, ou chasse par chasse dans l'ordre).
 *
 * @class LanceurBudget
 */
class LanceurBudget {
  constructor(armee, nbChasse) {
    /**
     * Armée en garnison (Armee.php), ordre d'Armee.unite.
     */
    this._armee = armee;
    /**
     * Nombre de chasses encore possibles.
     */
    this._nbChasse = Math.max(0, nbChasse);
    /**
     * Plan courant : {n, M, D, r, t, ...} et répartition.
     */
    this._plan = null;
    /**
     * Prochaine chasse à lancer, et vrai pendant un envoi.
     */
    this._prochaine = 0;
    this._envoi = false;
  }
  /**
   * Réglages mémorisés.
   */
  get reglages() {
    let r = {};
    try {
      r = JSON.parse(localStorage.getItem(CLE_LANCEUR_BUDGET)) || {};
    } catch (e) {
      r = {};
    }
    return {
      budget: r.budget ?? 30,
      marge: r.marge ?? SimulationChasse.FACTEUR_SECURITE,
      reequilibrer: r.reequilibrer ?? true,
      intervalle: r.intervalle ?? 2,
    };
  }
  set reglages(r) {
    try {
      localStorage.setItem(CLE_LANCEUR_BUDGET, JSON.stringify(r));
    } catch (e) {}
  }
  /**
   * Paramètres de calcul : armée, TdC, niveaux.
   *
   * @private
   */
  _parametres() {
    let vc = monProfil.niveauRecherche[5] || 0;
    return {
      unites: this._armee.unite.slice(),
      A: SimulationChasse.attaqueArmee(this._armee.unite, monProfil.niveauRecherche[2] || 0),
      tdcLancement: Math.max(1, Utils.terrain || 1),
      tdcArrivee: Math.max(1, numeral($("#o_lbTdcArrivee").val()).value() || Utils.terrain || 1),
      vc: vc,
      bouclier: monProfil.niveauRecherche[1] || 0,
      tJsn: TEMPS_UNITE[1] * Math.pow(0.9, monProfil.getTDP()),
      jsn: this._armee.unite[0],
    };
  }
  /**
   * Taille M des chasses pour que n chasses aient le ratio r (recherche dichotomique).
   *
   * @private
   */
  _taille(P, r, n) {
    let cible = P.A / r,
      lo = 0,
      hi = Math.max(2, Math.ceil(cible));
    while (hi - lo > 1) {
      let m = Math.floor((lo + hi) / 2);
      if (SimulationChasse.difficulteTotale(P.tdcArrivee, m, n) < cible) lo = m;
      else hi = m;
    }
    return lo;
  }
  /**
   * Plan pour n chasses de M cm² : difficulté, ratio, durée, pertes, budget, rendement.
   *
   * @private
   */
  _evaluer(P, n, M) {
    let D = SimulationChasse.difficulteTotale(P.tdcArrivee, M, n),
      r = P.A / D,
      indexRef = SimulationChasse.indexRatioRef(r),
      pertes = SimulationChasse.pertes(indexRef, D, P.bouclier),
      t = SimulationChasse.duree(P.tdcLancement, M, P.vc);
    return {
      n,
      M,
      D,
      r,
      indexRef,
      t,
      pertes,
      budget: (pertes.AVG * P.tJsn) / t,
      rendement: (n * M) / t,
    };
  }
  /**
   * Meilleur découpage (rendement maximal) pour le ratio r.
   *
   * @private
   */
  _planRatio(P, r, nFixe, mFixe) {
    let meilleur = null,
      de = nFixe || 1,
      a = nFixe || this._nbChasse;
    for (let n = de; n <= a; n++) {
      let M = mFixe || this._taille(P, r, n);
      if (M < 1) continue;
      let p = this._evaluer(P, n, M);
      if (!meilleur || p.rendement > meilleur.rendement) meilleur = p;
    }
    return meilleur;
  }
  /**
   * Plus petit ratio qui tient le budget X pour n chasses.
   *
   * @private
   */
  _planBudget(P, X, n, mFixe) {
    let lo = RATIO_BUDGET_MIN,
      hi = RATIO_BUDGET_MAX,
      pLo = this._planRatio(P, lo, n, mFixe);
    if (!pLo) return null;
    // même au ratio le plus risqué autorisé, les pertes restent sous le budget
    if (pLo.budget < X) return { ...pLo, plafonne: true };
    for (let i = 0; i < 50; i++) {
      let mid = (lo + hi) / 2,
        p = this._planRatio(P, mid, n, mFixe);
      if (!p || p.budget > X) lo = mid;
      else hi = mid;
    }
    let p = this._planRatio(P, hi, n, mFixe);
    return p ? { ...p, plafonne: false } : null;
  }
  /**
   * Plan complet : découpage, puis répartition des unités et tampon de JSN.
   *
   * @private
   */
  _calculer() {
    let R = this.reglages,
      P = this._parametres(),
      X = R.budget / 100,
      nFixe = $("#o_lbNbrAuto").is(":checked") ? 0 : parseInt($("#o_lbNbr").val()) || 0,
      mFixe = $("#o_lbTerrainAuto").is(":checked")
        ? 0
        : numeral($("#o_lbTerrain").val()).value() || 0;
    if (!(P.A > 0) || !this._nbChasse || X <= 0) return null;
    nFixe = Math.min(nFixe, this._nbChasse);
    let plan = null;
    for (let n = nFixe || 1; n <= (nFixe || this._nbChasse); n++) {
      let p = this._planBudget(P, X, n, mFixe);
      if (p && (!plan || p.rendement > plan.rendement)) plan = p;
    }
    if (!plan) return null;
    // marge de JSN : réduite uniformément si le stock ne la permet pas
    let facteur = plan.pertes.MAX > 0 ? Math.min(R.marge, P.jsn / plan.pertes.MAX) : R.marge;
    plan.facteur = facteur;
    plan.chasses = SimulationChasse.repartir(
      P.unites,
      P.tdcArrivee,
      plan.M,
      plan.n,
      plan.indexRef,
      P.bouclier,
      facteur,
    );
    plan.residuel = R.reequilibrer ? this._reequilibrer(plan.chasses, R.marge) : null;
    plan.chasses.forEach((c) => {
      c.att = SimulationChasse.attaqueArmee(c.unites, monProfil.niveauRecherche[2] || 0);
      c.ratio = c.att / c.difficulte;
    });
    plan.P = P;
    plan.X = X;
    return plan;
  }
  /**
   * Tampon de pertes par chasse : objectif marge × pertes max, en équivalent JSN.
   * Les JSN sont redistribuées au prorata des pertes max, puis un déficit est
   * comblé par les SN et les NE (ordre de mort), à points de vie égaux. Les
   * totaux ne changent pas. Renvoie le déficit restant par chasse.
   *
   * @private
   */
  _reequilibrer(chasses, marge) {
    let n = chasses.length,
      besoin = chasses.map((c) => marge * c.pertes.MAX);
    for (let k of [0, 1, 2]) {
      let stock = chasses.reduce((s, c) => s + c.unites[k], 0);
      if (stock <= 0) continue;
      let pv = VIE_UNITE[k + 1] / VIE_UNITE[1],
        voulu = besoin.map((b) => Math.max(0, b) / pv),
        somme = voulu.reduce((s, v) => s + v, 0);
      if (somme <= 0) continue;
      let alloc =
        somme <= stock
          ? voulu.map((v, i) => v + ((stock - somme) * chasses[i].unites[k]) / stock)
          : voulu.map((v) => (stock * v) / somme);
      let donne = 0;
      for (let i = 0; i < n - 1; i++) {
        alloc[i] = Math.round(alloc[i]);
        donne += alloc[i];
      }
      alloc[n - 1] = stock - donne;
      chasses.forEach((c, i) => {
        c.unites[k] = alloc[i];
        besoin[i] -= alloc[i] * pv;
      });
    }
    return besoin.map((b) => Math.max(0, Math.round(b)));
  }
  /**
   * Insère le lanceur après `$apres`.
   *
   * @method afficher
   */
  afficher($apres) {
    let R = this.reglages,
      intervalles = [
        [2, "2 secondes"],
        [30, "30 secondes"],
        [60, "1 minute"],
        [120, "2 minutes"],
      ]
        .map(
          ([v, l]) => `<option value='${v}'${v == R.intervalle ? " selected" : ""}>${l}</option>`,
        )
        .join("");
    $apres.after(`<div id='o_lanceurBudget' class='boite_amelioration simulateur centre' style='display:none'>
      <h2>Lanceur de Chasses — budget de pertes</h2>
      <p class='small'>Fixe la part de ta ponte de JSN que tu acceptes de perdre en chasse : le lanceur en déduit le ratio, puis le nombre et la taille des chasses qui maximisent le TdC chassé par jour.</p>
      <table id='o_lbParametres' class='o_maxWidth o_marginT15' cellspacing='0'>
        <tr class='ligne_paire'><td>Terrain à l'arrivée</td><td><input id='o_lbTdcArrivee' size='21' value='${numeral(Utils.terrain || 0).format()}'/></td><td></td></tr>
        <tr><td>JSN sacrifiées</td><td><input id='o_lbBudget' size='6' value='${R.budget}'/> % du temps de ponte</td><td id='o_lbParJour' class='small'></td></tr>
        <tr class='ligne_paire'><td>Nombre de chasses</td><td><input id='o_lbNbr' size='21' value='0' disabled/></td><td><label><input id='o_lbNbrAuto' type='checkbox' checked/> Auto</label></td></tr>
        <tr><td>Terrain par chasse</td><td><input id='o_lbTerrain' size='21' value='0' disabled/></td><td><label><input id='o_lbTerrainAuto' type='checkbox' checked/> Auto</label></td></tr>
        <tr class='ligne_paire'><td title="Chaque chasse emporte marge × pertes max en JSN. Si le stock ne suffit pas, la marge est réduite pour toutes les chasses.">Marge JSN</td><td><input id='o_lbMarge' size='6' value='${R.marge}'/> × pertes max</td><td><label title="Redistribue les JSN au prorata des pertes max de chaque chasse, puis complète avec les SN et les NE (totaux inchangés)."><input id='o_lbReequilibrer' type='checkbox'${R.reequilibrer ? " checked" : ""}/> Rééquilibrer JSN / SN / NE</label></td></tr>
        <tr><td>Intervalle entre les chasses</td><td><select id='o_lbIntervalle'>${intervalles}</select></td><td></td></tr>
      </table>
      <p id='o_lbResultat' class='o_marginT15'></p>
      <p id='o_lbAlertes' class='red gras'></p>
      <table id='o_lbChasses' class='o_maxWidth' cellspacing='0'></table>
      <button id='o_lbLancer' class='o_button o_marginT15 f_success' type='button'>Lancer la salve</button>
      <p class='o_marginT0'><em class='small'>Un jeton de sécurité neuf est demandé avant chaque chasse ; la salve s'arrête au premier refus. Reste sur cette page pendant le lancement.</em></p>
      <p id='o_lbMessage' class='red gras'></p>
    </div>`);
    let sauver = () => {
      this.reglages = {
        budget: parseFloat(String($("#o_lbBudget").val()).replace(",", ".")) || 0,
        marge: Math.max(0, parseFloat(String($("#o_lbMarge").val()).replace(",", ".")) || 0),
        reequilibrer: $("#o_lbReequilibrer").is(":checked"),
        intervalle: parseInt($("#o_lbIntervalle").val()) || 2,
      };
      this.majPlan();
    };
    $("#o_lbBudget, #o_lbMarge, #o_lbTdcArrivee, #o_lbNbr, #o_lbTerrain").on("input", sauver);
    $("#o_lbReequilibrer, #o_lbIntervalle").on("change", sauver);
    $("#o_lbNbrAuto, #o_lbTerrainAuto").on("change", (e) => {
      let champ = e.currentTarget.id == "o_lbNbrAuto" ? "#o_lbNbr" : "#o_lbTerrain";
      $(champ).prop("disabled", e.currentTarget.checked);
      this.majPlan();
    });
    $("#o_lbLancer").click(() => this._lancerSalve());
    this.majPlan();
    return this;
  }
  /**
   * Recalcule et affiche le plan (sauf pendant ou après un lancement).
   *
   * @method majPlan
   */
  majPlan() {
    if (this._envoi || this._prochaine) return this;
    let fmt = (v, d = 0) => numeral(v).format(d ? "0,0." + "0".repeat(d) : "0,0"),
      duree = (s) => Utils.intToTime(Math.round(s)),
      p = (this._plan = this._calculer()),
      P = this._parametres(),
      R = this.reglages;
    $("#o_lbParJour").text(
      R.budget > 0 && P.tJsn > 0 ? `≈ ${fmt(((R.budget / 100) * 86400) / P.tJsn)} JSN / jour` : "",
    );
    if (!p) {
      $("#o_lbResultat").text("");
      // ratio maximal : une seule chasse de 1 cm²
      let rMax = P.A / SimulationChasse.difficulte(P.tdcArrivee, 1);
      $("#o_lbAlertes").text(
        !this._nbChasse
          ? "Aucune chasse possible pour l'instant (toutes les places sont prises)."
          : !(P.A > 0)
            ? "Aucune unité d'attaque en garnison."
            : rMax < RATIO_BUDGET_MIN
              ? `Armée trop faible pour ce TdC : ratio maximal ${fmt(rMax, 2)}, il faut au moins ${RATIO_BUDGET_MIN}.`
              : "Indique un budget de JSN sacrifiées supérieur à 0 %.",
      );
      $("#o_lbChasses").empty();
      $("#o_lbLancer").prop("disabled", true);
      return this;
    }
    if ($("#o_lbNbrAuto").is(":checked")) $("#o_lbNbr").val(p.n);
    if ($("#o_lbTerrainAuto").is(":checked")) $("#o_lbTerrain").val(fmt(p.M));
    $("#o_lbResultat").html(
      `Ratio <b>${fmt(p.r, 2)}</b> → <b>${p.n} × ${fmt(p.M)} cm²</b> (${fmt(p.n * p.M)} cm², ${fmt((100 * p.n * p.M) / P.tdcLancement)} % du TdC), salve ${duree(p.t)}, pertes moy. <b>${fmt(p.pertes.AVG)}</b> JSN (max ${fmt(p.pertes.MAX)}), budget réel ${fmt(100 * p.budget, 1)} %, <b>${fmt(p.rendement * 86400)} cm² / jour</b>`,
    );
    let alertes = [];
    if (p.facteur < R.marge - 0.005)
      alertes.push(
        `Marge JSN réduite à × ${fmt(p.facteur, 2)} (stock ${fmt(P.jsn)} JSN pour ${fmt(p.pertes.MAX)} de pertes max).`,
      );
    if (p.residuel) {
      let exposees = p.residuel
        .map((d, i) => (d > 2 ? `${i + 1} (${fmt(d)})` : null))
        .filter(Boolean);
      if (exposees.length)
        alertes.push(
          `Tampon incomplet même avec SN et NE, unités chères exposées sur les chasses : ${exposees.join(", ")} (déficit en équivalent JSN).`,
        );
    }
    if (p.plafonne)
      alertes.push(
        `Budget non atteignable sans descendre sous le ratio ${RATIO_BUDGET_MIN} : plafonné, budget consommé ${fmt(100 * p.budget, 1)} %.`,
      );
    $("#o_lbAlertes").html(alertes.join("<br/>"));
    // tableau des chasses : seules les unités envoyées ont une colonne
    let utilisees = new Array(14).fill(0).map((_, u) => p.chasses.some((c) => c.unites[u] > 0));
    let entete = utilisees
      .map((u, i) => (u ? `<th class='right'>${NOM_RAC_UNITE[i + 1]}</th>` : ""))
      .join("");
    let lignes = p.chasses
      .map(
        (c, i) =>
          `<tr id='o_lbChasse${i}'><td>${i + 1}</td>${utilisees.map((u, k) => (u ? `<td class='right'>${c.unites[k] ? fmt(c.unites[k]) : ""}</td>` : "")).join("")}<td class='right'>${fmt(c.pertes.AVG)}</td><td class='right'>${fmt(c.pertes.MAX)}</td><td class='right'>${fmt(c.difficulte)}</td><td class='right'>${fmt(c.ratio, 2)}</td><td class='o_lbEtat'><button type='button' class='o_button o_lbLancerUne' data-i='${i}'>Lancer</button></td></tr>`,
      )
      .join("");
    $("#o_lbChasses").html(
      `<thead><tr><th>N°</th>${entete}<th class='right'>Pertes moy.</th><th class='right'>Pertes max</th><th class='right'>Difficulté</th><th class='right'>Ratio</th><th></th></tr></thead><tbody>${lignes}</tbody>`,
    );
    $("#o_lbChasses tbody tr:even").css("background-color", monProfil.parametre["couleur2"].valeur);
    $(".o_lbLancerUne").click((e) => this._lancerUne(parseInt($(e.currentTarget).data("i"))));
    this._majBoutons();
    return this;
  }
  /**
   * Seule la prochaine chasse peut partir à l'unité : l'ordre est imposé.
   *
   * @private
   */
  _majBoutons() {
    let fini = !this._plan || this._prochaine >= this._plan.n;
    $("#o_lbLancer").prop("disabled", this._envoi || fini);
    $(".o_lbLancerUne").each((i, b) =>
      $(b).prop("disabled", this._envoi || parseInt($(b).data("i")) != this._prochaine),
    );
    // une fois la première chasse partie, le plan est figé
    $("#o_lbParametres input, #o_lbParametres select").prop(
      "disabled",
      this._envoi || this._prochaine > 0,
    );
  }
  /**
   * Envoie la chasse i : jeton neuf, puis POST ; résout vrai si le jeu confirme.
   *
   * @private
   */
  _envoyer(i) {
    let c = this._plan.chasses[i];
    return Promise.resolve($.ajax({ url: location.origin + "/AcquerirTerrain.php", cache: false }))
      .then((page) => {
        // id="t" est à la fois la table principale et l'input du jeton : on vise l'input
        let jeton = Utils.parseHtml(page).find("input[name='t']");
        if (!jeton.attr("name")) throw new Error("jeton introuvable");
        return $.post(
          location.origin + "/AcquerirTerrain.php",
          Armee.donneesChasse(
            this._plan.M,
            c.unites,
            jeton.attr("name") + "=" + jeton.attr("value"),
          ),
        );
      })
      .then((reponse) => {
        let ok = String(reponse).indexOf("La chasse est lancée") > -1;
        if (ok) TroupesDehors.enregistrerChasse(c.unites);
        return ok;
      })
      .catch(() => false);
  }
  /**
   * Marque la ligne d'une chasse lancée ou refusée.
   *
   * @private
   */
  _marquer(i, ok) {
    $(`#o_lbChasse${i}`)
      .removeClass("green red")
      .addClass(ok ? "green" : "red");
    if (ok) $(`#o_lbChasse${i} .o_lbEtat`).text("✓ lancée");
    else {
      // la chasse refusée peut être relancée, seule ou avec la suite de la salve
      $(`#o_lbChasse${i} .o_lbEtat`).html(
        `✗ refusée <button type='button' class='o_button o_lbLancerUne' data-i='${i}'>Relancer</button>`,
      );
      $(`#o_lbChasse${i} .o_lbLancerUne`).click(() => this._lancerUne(i));
      $("#o_lbMessage").text(`La chasse ${i + 1} n'a pas pu être lancée : lancement interrompu.`);
    }
  }
  /**
   * Fin : toutes les chasses sont parties, la page est rechargée.
   *
   * @private
   */
  _terminer() {
    $.toast({ ...TOAST_SUCCESS, text: `${this._plan.n} chasse(s) lancée(s).` });
    setTimeout(() => location.reload(), 1500);
  }
  /**
   * Lance la prochaine chasse seule (dans l'ordre).
   *
   * @private
   */
  _lancerUne(i) {
    if (this._envoi || i != this._prochaine) return;
    this._envoi = true;
    this._majBoutons();
    this._envoyer(i).then((ok) => {
      this._envoi = false;
      this._marquer(i, ok);
      if (ok) this._prochaine++;
      this._majBoutons();
      if (ok && this._prochaine >= this._plan.n) this._terminer();
    });
  }
  /**
   * Lance toutes les chasses restantes, une par une, à l'intervalle choisi.
   *
   * @private
   */
  _lancerSalve() {
    if (this._envoi || !this._plan) return;
    let attente = (parseInt($("#o_lbIntervalle").val()) || 2) * 1000;
    this._envoi = true;
    $("#o_lbMessage").text("");
    this._majBoutons();
    let suivante = () => {
      let i = this._prochaine;
      this._envoyer(i).then((ok) => {
        this._marquer(i, ok);
        if (!ok) {
          this._envoi = false;
          return this._majBoutons();
        }
        this._prochaine++;
        if (this._prochaine >= this._plan.n) {
          this._envoi = false;
          this._majBoutons();
          return this._terminer();
        }
        setTimeout(suivante, attente);
      });
    };
    suivante();
  }
}
