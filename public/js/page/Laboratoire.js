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
  }
  /**
   *
   */
  executer() {
    // Préservation du scroll à travers les redirects "Rechercher prereq invalide"
    // — la restauration se fait à la fin d'executer() (après les manipulations DOM).
    let scrollY = Utils.preserveScroll("o_laboratoireScroll");
    // verification des niveaux
    let niveau = new Array(10);
    $(".ligneAmelioration").each((i, elt) => {
      niveau[i] = parseInt($(elt).find(".niveau_amelioration").text().split(" ")[1]);
    });
    if (niveau.join(",") != monProfil.niveauRecherche.join(",")) {
      monProfil.niveauRecherche = niveau;
      monProfil.sauvegarder();
    }
    // ajout title evolution
    this._armee.getArmee().then((data) => {
      this._armee.chargeData(data);
      // Affichage de la rentabilité du bouclier et de la rentabilité de l'armes
      this.titleBouclier().titleArmes();
    });
    // Sauvegarde recherche AVANT le remplacement (saveRecherche lit $("#centre strong"))
    if (!Utils.comptePlus) this.plus();
    // ⚠️ Ordre : confirmationAnnuler AVANT tableauEvolution — la 1re ajoute le
    // <a>Retour</a> juste après "Je confirme", et la 2nde le déplace en même
    // temps que le warning sous le tableau récap. Sinon en C+ le Retour
    // resterait orphelin à sa position d'injection.
    Utils.confirmationAnnuler("laboratoire.php");
    Utils.tableauEvolution("Recherche", "Laboratoire");
    // Restauration du scroll APRÈS toutes les manipulations DOM (sinon le
    // tableau évolutions décale la mise en page après).
    if (scrollY !== null) requestAnimationFrame(() => window.scrollTo(0, scrollY));
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
        (10 + (10 * monProfil.niveauRecherche[1]) / 10),
    );
    let apportPonteTk = Math.round(
      parseInt(tOuv / (TEMPS_UNITE[11] * Math.pow(0.9, monProfil.getTDP()))) *
        (55 + (55 * monProfil.niveauRecherche[1]) / 10),
    );
    let attABSupp = this._armee.getTotalAtt(monProfil.niveauRecherche[2] + 1);
    let bLigneGrasJS = attAB + apportPonteJS >= attABSupp ? true : false;
    let bLigneGrasTk = attAB + apportPonteTk >= attABSupp ? true : false;

    let defAB = this._armee.getTotalDef(monProfil.niveauRecherche[2]);
    let apportPonteTuE = Math.round(
      parseInt(tOuv / (TEMPS_UNITE[14] * Math.pow(0.9, monProfil.getTDP()))) *
        (55 + (55 * monProfil.niveauRecherche[1]) / 10),
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
