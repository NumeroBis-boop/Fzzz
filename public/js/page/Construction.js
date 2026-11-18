// @ts-check
/*
 * Construction.js
 * Hraesvelg
 **********************************************************************/

/**
 * Classe de fonction pour la page /construction.php.
 *
 * @class PageConstruction
 * @constructor
 */
class PageConstruction {
  constructor(boiteComptePlus) {
    /**
     * Accés à la boite compte+
     */
    this._boiteComptePlus = boiteComptePlus;
  }
  /**
   *
   */
  executer() {
    // verification des niveaux
    let niveau = new Array(13);
    $(".ligneAmelioration").each((i, elt) => {
      niveau[i] = parseInt($(elt).find(".niveau_amelioration").text().split(" ")[1]);
    });
    if (niveau.join(",") != monProfil.niveauConstruction.join(",")) {
      monProfil.niveauConstruction = niveau;
      monProfil.sauvegarder();
    }
    // heure où les ressources suffiront, au survol des coûts (page Convois relue) ;
    // une erreur n'empêche pas le reste de la page
    try {
      DelaiRessources.installer();
    } catch (e) {
      console.error("Fzzz : ressources manquantes", e);
    }
    // Rentabilité du niveau suivant de l'étable à pucerons
    this.rentabiliteEtable();
    // Sauvegarde construction AVANT le remplacement (saveConstruction lit le strong)
    if (!Utils.comptePlus) this.plus();
    // ⚠️ Ordre : confirmationAnnuler AVANT tableauEvolution — la 1re ajoute le
    // <a>Retour</a> juste après "Je confirme", et la 2nde le déplace en même
    // temps que le warning sous le tableau récap. Sinon en C+ le Retour
    // resterait orphelin à sa position d'injection.
    if (Utils.affichage("retourAnnuler")) Utils.confirmationAnnuler("construction.php");
    if (Utils.affichage("evolutionEnCours")) Utils.tableauEvolution("Construction", "Construction");
    // Après un clic qui recharge la page (construire, annuler et sa
    // confirmation, redirections du jeu) : même position à l'écran, une fois
    // toutes les manipulations DOM faites
    Utils.garderPosition("fzzz_positionConstruction");
    return this;
  }
  /**
   * Bandeau sous l'Étable à pucerons : rentabilité des niveaux suivants
   * (voir Utils.htmlRentabiliteEtable).
   *
   * @private
   * @method rentabiliteEtable
   */
  rentabiliteEtable() {
    let $ligne = $(".ligneAmelioration").filter((i, elt) =>
      /table à pucerons/i.test($(elt).find("h2").text()),
    );
    if ($ligne.length) Utils.ajouterRentabiliteEtable($ligne);
    return this;
  }
  /**
   * Sauvegarde la construction en cours.
   *
   * @private
   * @method plus
   */
  plus() {
    // La mention "Terminé le X" est désormais affichée par
    // `Utils.tableauEvolution()` pour tous (C+ comme non-C+), plus besoin de
    // la dupliquer ici.
    // Sauvegarde de la construction en cours
    this.saveConstruction();
    // Suppresion de la construction en cours si on annule
    if ($("a:contains('Annuler')").length)
      $("a:contains('Annuler')").click((e) => {
        this._boiteComptePlus.expConstruction = 0;
        this._boiteComptePlus.construction = "";
        this._boiteComptePlus.startConstruction = 0;
        this._boiteComptePlus.sauvegarder();
      });
    return this;
  }
  /**
   * Sauvegarde la construction en cours.
   *
   * @private
   * @method saveConstruction
   */
  saveConstruction() {
    let str = $("#centre > strong").text();
    let construction = str.substring(2, str.indexOf("se termine") - 1);
    if (
      construction &&
      (!this._boiteComptePlus.construction ||
        Horloge.serveur().diff(moment(this._boiteComptePlus.expConstruction), "s") > 0) &&
      !Utils.comptePlus &&
      $("#boiteComptePlus").length
    ) {
      this._boiteComptePlus.construction =
        construction.substr(0, 1).toUpperCase() + construction.substr(1);
      this._boiteComptePlus.expConstruction = Horloge.serveur().add(
        parseInt(str.split(",")[0].split("(")[1]),
        "s",
      );
      this._boiteComptePlus.startConstruction = Horloge.serveur();
      this._boiteComptePlus.sauvegarder().majConstruction();
    }
    return this;
  }
}
