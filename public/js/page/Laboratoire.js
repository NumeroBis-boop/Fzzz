/*
 * Laboratoire.js
 * Hraesvelg
 **********************************************************************/

/**
 * Classe de fonction pour la page /laboratoire.php.
 *
 * @class PageLaboratoire
 * @constructor
 */
class PageLaboratoire {
  constructor(boiteComptePlus) {
    /**
     * Accés à la boite compte+
     */
    this._boiteComptePlus = boiteComptePlus;
    /**
     * Armée du joueur pour calculer le rentabilité Armes et Bouclier
     */
    this._armee = new Armee();
    /**
     * Vrai si l'armée vient de la page Reine (complète), faux si estimée
     */
    this._armeeComplete = false;
    /**
     * Raison de l'échec de lecture de la page Reine, le cas échéant
     */
    this._raisonReine = "";
  }
  /**
   *
   */
  executer() {
    // verification des niveaux
    let niveau = new Array(10);
    $(".ligneAmelioration").each((i, elt) => {
      niveau[i] = parseInt($(elt).find(".niveau_amelioration").text().split(" ")[1]);
    });
    if (niveau.join(",") != monProfil.niveauRecherche.join(",")) {
      monProfil.niveauRecherche = niveau;
      monProfil.sauvegarder();
    }
    // Armée complète (page Reine : garnison et troupes parties comprises),
    // à défaut garnison d'Armee.php plus les troupes parties d'ici
    Promise.all([
      Utils.lireReine(),
      Promise.resolve(this._armee.getArmee()).catch(() => null),
    ]).then(([reine, html]) => {
      let complete = reine.reine
        ? Utils.armeeReine(reine.brut, html ? Armee.debloquees(html) : null)
        : null;
      if (complete) {
        this._armee.unite = complete;
        this._armeeComplete = true;
      } else {
        this._raisonReine = reine.raison || "unités de la page Reine non reconnues";
        if (html) this._armee.chargeData(html);
      }
      // Affichage de la rentabilité du bouclier et de la rentabilité de l'armes
      this.titleBouclier().titleArmes().fdfArmes();
    });
    // Rentabilité de l'étable à pucerons, aussi sous Communication avec les animaux
    let $communication = $(".ligneAmelioration").filter((i, elt) =>
      /communication avec les animaux/i.test($(elt).find("h2").text()),
    );
    if ($communication.length) Utils.ajouterRentabiliteEtable($communication);
    // Sauvegarde recherche AVANT le remplacement (saveRecherche lit $("#centre strong"))
    if (!Utils.comptePlus) this.plus();
    // ⚠️ Ordre : confirmationAnnuler AVANT tableauEvolution — la 1re ajoute le
    // <a>Retour</a> juste après "Je confirme", et la 2nde le déplace en même
    // temps que le warning sous le tableau récap. Sinon en C+ le Retour
    // resterait orphelin à sa position d'injection.
    Utils.confirmationAnnuler("laboratoire.php");
    Utils.tableauEvolution("Recherche", "Laboratoire");
    // Après un clic qui recharge la page (rechercher, annuler et sa
    // confirmation, redirections du jeu) : même position à l'écran
    Utils.garderPosition("fzzz_positionLaboratoire");
    return this;
  }
  /**
   * Ajoute un title detaillé pour connaitre la rentabilité du niveau bouclier.
   *
   * @private
   * @method titleBouclier
   */
  titleBouclier() {
    let vieAB = this._armee.getBaseVie() + this._armee.getBonusVie(monProfil.niveauRecherche[1]);
    let tOuv =
      numeral($(".ligneAmelioration:eq(1)").find(".ouvriere").text()).value() *
      (TEMPS_UNITE[0] * Math.pow(0.9, monProfil.getTDP()));
    let apportPonte = Math.round(
      parseInt(tOuv / (TEMPS_UNITE[1] * Math.pow(0.9, monProfil.getTDP()))) *
        (8 + (8 * monProfil.niveauRecherche[1]) / 10),
    );
    let vieABSupp =
      this._armee.getBaseVie() + this._armee.getBonusVie(monProfil.niveauRecherche[1] + 1);
    let bLigneGras = vieAB + apportPonte >= vieABSupp ? true : false;
    let title = `<table>
            <tr><td>Vie AB actuelle</td><td class='right'>${numeral(vieAB).format()}</td></tr>
            <tr${bLigneGras ? " class='gras' " : ""}><td>Vie AB + ponte JSN</td><td class='right' style='padding-left:10px'>${numeral(vieAB + apportPonte).format()} (+ ${numeral(apportPonte).format()})</td></tr>
            <tr${!bLigneGras ? " class='gras' " : ""}><td>Vie AB niveau ${monProfil.niveauRecherche[1] + 1}</td><td class='right'>${numeral(vieABSupp).format()} (+ ${numeral(vieABSupp - vieAB).format()})</td></tr>
            </table>`;
    $(".desciption_amelioration:eq(1) h2")
      .attr("title", title)
      .tooltip({
        position: { my: "left+5 top", at: "right top" },
        content: title,
        tooltipClass: "ui-tooltip-brown ui-tooltip-lightBrown",
      });
    return this;
  }
  /**
   * Détail de l'armée prise en compte dans la FdF (bulle au survol) : une
   * ligne par unité, nombre × attaque HB.
   *
   * @method detailArmee
   * @param {Array} unites nombres, ordre d'Armee.unite
   * @return {String}
   */
  detailArmee(unites) {
    let lignes = unites
      .map((n, i) =>
        n
          ? `${numeral(n).format()} ${n > 1 ? NOM_UNITES[i + 1] : NOM_UNITE[i + 1]} × ${ATT_UNITE[i + 1]} = ${numeral(n * ATT_UNITE[i + 1]).format()}`
          : "",
      )
      .filter(Boolean);
    return lignes.length
      ? `Armée prise en compte (${this._armeeComplete ? "complète, page Reine" : "estimée"}) :\n${lignes.join("\n")}`
      : "Aucune unité de combat";
  }
  /**
   * Ajoute un title detaillé pour connaitre la rentabilité du niveau d'armes.
   *
   * @private
   * @method titleArmes
   */
  titleArmes() {
    let attAB = this._armee.getTotalAtt(monProfil.niveauRecherche[2]);
    let tOuv =
      numeral($(".ligneAmelioration:eq(2)").find(".ouvriere").text()).value() *
      (TEMPS_UNITE[0] * Math.pow(0.9, monProfil.getTDP()));
    let apportPonteJS = Math.round(
      parseInt(tOuv / (TEMPS_UNITE[4] * Math.pow(0.9, monProfil.getTDP()))) *
        (10 + (10 * monProfil.niveauRecherche[2]) / 10),
    );
    let apportPonteTk = Math.round(
      parseInt(tOuv / (TEMPS_UNITE[11] * Math.pow(0.9, monProfil.getTDP()))) *
        (55 + (55 * monProfil.niveauRecherche[2]) / 10),
    );
    let attABSupp = this._armee.getTotalAtt(monProfil.niveauRecherche[2] + 1);
    let bLigneGrasJS = attAB + apportPonteJS >= attABSupp ? true : false;
    let bLigneGrasTk = attAB + apportPonteTk >= attABSupp ? true : false;

    let defAB = this._armee.getTotalDef(monProfil.niveauRecherche[2]);
    let apportPonteTuE = Math.round(
      parseInt(tOuv / (TEMPS_UNITE[14] * Math.pow(0.9, monProfil.getTDP()))) *
        (55 + (55 * monProfil.niveauRecherche[2]) / 10),
    );
    let defABSupp = this._armee.getTotalDef(monProfil.niveauRecherche[2] + 1);
    let bLigneGrasTuE = defAB + apportPonteTuE >= defABSupp ? true : false;

    let title = `<table>
            <tr><td>Attaque AB actuelle</td><td class='right'>${numeral(attAB).format()}</td></tr>
            <tr${bLigneGrasJS ? " class='gras' " : ""}><td>Attaque AB + ponte JS</td><td class='right' style='padding-left:10px'>${numeral(attAB + apportPonteJS).format()} (+ ${numeral(apportPonteJS).format()})</td></tr>
            <tr${bLigneGrasTk ? " class='gras' " : ""}><td>Attaque AB + ponte Tank</td><td class='right' style='padding-left:10px'>${numeral(attAB + apportPonteTk).format()} (+ ${numeral(apportPonteTk).format()})</td></tr>
            <tr${!bLigneGrasTk ? " class='gras' " : ""}><td>Attaque AB niveau ${monProfil.niveauRecherche[2] + 1}</td><td class='right'>${numeral(attABSupp).format()} (+ ${numeral(attABSupp - attAB).format()})</td></tr></table><hr/><table>
            <tr><td>Défense AB actuelle</td><td class='right'>${numeral(defAB).format()}</td></tr>
            <tr${bLigneGrasTuE ? " class='gras' " : ""}><td>Défense AB + ponte TuE</td><td class='right' style='padding-left:10px'>${numeral(defAB + apportPonteTuE).format()} (+ ${numeral(apportPonteTuE).format()})</td></tr>
            <tr${!bLigneGrasTuE ? " class='gras' " : ""}><td>Défense AB niveau ${monProfil.niveauRecherche[2] + 1}</td><td class='right'>${numeral(defABSupp).format()} (+ ${numeral(defABSupp - defAB).format()})</td></tr>
            </table>`;
    $(".desciption_amelioration:eq(2) h2")
      .attr("title", title)
      .tooltip({
        position: { my: "left+5 top", at: "right top" },
        content: title,
        tooltipClass: "ui-tooltip-brown ui-tooltip-lightBrown",
      });
    return this;
  }
  /**
   * Extension sous la ligne Armes (la ligne du jeu reste intacte) : FdF hors
   * bonus (HB) de l'armée, FdF HB requise pour que le niveau suivant rapporte
   * autant que la ponte de JS, d'Artilleuses, de Tanks ou de Tueuses d'élite pendant le temps de
   * ponte des ouvrières sacrifiées, ce qu'il manque, et le nombre d'unités de
   * chaque sorte qui comblerait ce manque.
   *
   *   Sₙ = ⌈Cₙ × 60 / tᵤ × aᵤ × (n + 9)⌉, rentable si FdF HB ≥ Sₙ
   *
   * n = niveau visé, Cₙ = ouvrières du niveau (lues sur la page), tᵤ et aᵤ =
   * temps de ponte et attaque de base de l'unité. Les bonus de ponte
   * (Couveuse, Solarium, Technique de ponte) touchent ouvrières et unités de
   * la même façon : ils s'annulent.
   *
   * @private
   * @method fdfArmes
   */
  fdfArmes() {
    let $ligne = $(".ligneAmelioration:eq(2)"),
      ouvrieres = numeral($ligne.find(".ouvriere").text()).value(),
      niveau = monProfil.niveauRecherche[2] + 1;
    if (!$ligne.length || !ouvrieres || isNaN(niveau)) return this;
    // armée complète (Reine), sinon garnison (Armee.php) + troupes parties en
    // chasse ou en attaque depuis ce navigateur
    let dehors = this._armeeComplete ? [] : TroupesDehors.total(),
      unites = this._armee.unite.map((n, i) => n + (dehors[i] || 0)),
      fdf = unites.reduce((s, n, i) => s + n * ATT_UNITE[i + 1], 0),
      // calcul entier exact, arrondi supérieur à la fin
      seuil = (u) =>
        Number(
          (BigInt(ouvrieres) * 60n * BigInt(ATT_UNITE[u]) * BigInt(niveau + 9) +
            BigInt(TEMPS_UNITE[u]) -
            1n) /
            BigInt(TEMPS_UNITE[u]),
        ),
      lignes = [4, 8, 11, 14]
        .map((u) => {
          let s = seuil(u),
            manque = Math.max(0, s - fdf),
            // unités de cette sorte (attaque HB aᵤ chacune) qui combleraient le manque
            nombre = Math.ceil(manque / ATT_UNITE[u]);
          return `<tr><td class='left'>${NOM_UNITES[u]}</td><td class='right'>${numeral(s).format()}</td>
            <td class='right ${manque ? "red" : "green"}'>${manque ? numeral(manque).format() : "rentable"}</td>
            <td class='right'>${manque ? numeral(nombre).format() + " " + NOM_RAC_UNITE[u] : "—"}</td></tr>`;
        })
        .join("");
    Utils.ajouterSpoilerRentabilite(
      $ligne,
      "o_fdfArmesLigne",
      `<p><strong class='o_fdfDetail' title="${Utils.echapper(this.detailArmee(unites))}">FdF HB actuelle : ${numeral(fdf).format()}</strong>
        ${
          this._armeeComplete
            ? `<span class='small' title="Lue dans la page Reine : garnison et troupes parties en chasse ou en attaque">(armée complète)</span>`
            : `<span class='small' title="Page Reine illisible (${Utils.echapper(this._raisonReine || "")}) : garnison de la page Armée, plus les chasses et attaques lancées depuis ce navigateur et encore en cours">(armée estimée)</span>`
        }</p>
      <table cellspacing='0'>
        <tr class='gras'><td class='left'>Armes ${niveau} contre la ponte de</td><td class='right'>FdF HB requise</td><td class='right'>FdF HB manquante</td><td class='right'>Unités à pondre</td></tr>
        ${lignes}
      </table>`,
    );
    return this;
  }
  /**
   * Sauvegarde la recherche en cours.
   *
   * @private
   * @method plus
   */
  plus() {
    // La mention "Terminé le X" est désormais affichée par
    // `Utils.tableauEvolution()` pour tous (C+ comme non-C+), plus besoin de
    // la dupliquer ici.
    // Sauvegarde de la recherche en cours
    this.saveRecherche();
    // Suppresion de la recherche en cours si on annule
    if ($("a:contains('Je confirme')").length)
      $("a:contains('Je confirme')").click((e) => {
        this._boiteComptePlus.expRecherche = 0;
        this._boiteComptePlus.recherche = "";
        this._boiteComptePlus.startRecherche = 0;
        this._boiteComptePlus.sauvegarder();
      });
    return this;
  }
  /**
   * Sauvegarde la recherche en cours.
   *
   * @private
   * @method saveRecherche
   * @return
   */
  saveRecherche() {
    let str = $("#centre strong").text();
    let recherche = str.substring(2, str.indexOf("termin") - 1);
    if (
      recherche &&
      (!this._boiteComptePlus.recherche ||
        moment().diff(moment(this._boiteComptePlus.expRecherche), "s") > 0) &&
      !Utils.comptePlus &&
      $("#boiteComptePlus").length
    ) {
      this._boiteComptePlus.recherche = recherche.substr(0, 1).toUpperCase() + recherche.substr(1);
      this._boiteComptePlus.expRecherche = moment().add(
        parseInt(str.split(",")[0].split("(")[1]),
        "s",
      );
      this._boiteComptePlus.startRecherche = moment();
      this._boiteComptePlus.sauvegarder().majRecherche();
    }
    return this;
  }
}
