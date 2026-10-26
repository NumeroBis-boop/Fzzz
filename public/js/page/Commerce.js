// @ts-check
/*
 * Commerce.js
 * Hraesvelg
 **********************************************************************/

/**
 * Classe de fonction pour la page /commerce.php.
 *
 * @class PageCommerce
 * @constructor
 */
class PageCommerce {
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
    // ajout d'information
    $("form table").append(
      `<tr class='centre'><td colspan=6>Info : Niveau d'étable <strong>${monProfil.niveauConstruction[11]}</strong>, 1 ouvrière peut transporter : <strong>${10 + monProfil.niveauConstruction[11] / 2}</strong> ressources.</td></tr>`,
    );
    // ajout des boutons pour arrondir les quantités
    $("#bouton_nourriture_max").html(
      `Nourriture donnée <span id="o_arrondirNou" class="gras small">arrondir...</span>`,
    );
    $("#o_arrondirNou").click((e) => {
      e.preventDefault();
      let value = Math.floor($("#nbNourriture").val()),
        nbMat = Math.floor($("#nbMateriaux").val()),
        newValue = Utils.arrondiQuantite(value);
      $("#input_nbNourriture").val(numeral(newValue).format());
      $("#nbNourriture").val(newValue);
      // mise à jour des ouvrieres
      $("#input_nbOuvriere").val(
        numeral(
          Math.floor((newValue + nbMat) / (10 + monProfil.niveauConstruction[11] / 2)),
        ).format(),
      );
      $("#nbOuvriere").val(
        Math.floor((newValue + nbMat) / (10 + monProfil.niveauConstruction[11] / 2)),
      );
      return false;
    });
    // materiaux
    $("#bouton_materiaux_max").html(
      `Matériaux donnés <span id="o_arrondirMat" class="gras small">arrondir...</span>`,
    );
    $("#o_arrondirMat").click((e) => {
      e.preventDefault();
      let value = Math.floor($("#nbMateriaux").val()),
        nbNou = Math.floor($("#nbNourriture").val()),
        newValue = Utils.arrondiQuantite(value);
      $("#input_nbMateriaux").val(numeral(newValue).format());
      $("#nbMateriaux").val(newValue);
      // mise à jour des ouvrieres
      $("#input_nbOuvriere").val(
        numeral(
          Math.floor((newValue + nbNou) / (10 + monProfil.niveauConstruction[11] / 2)),
        ).format(),
      );
      $("#nbOuvriere").val(
        Math.floor((newValue + nbNou) / (10 + monProfil.niveauConstruction[11] / 2)),
      );
      return false;
    });
    // option c+
    if (!Utils.comptePlus) this.plus();
    CommerceFzzz.decorer();
    return this;
  }
  /**
   * Affiche les retours, et sauvegarde les convois en cours pour la boite compte plus.
   *
   * @private
   * @method plus
   */
  plus() {
    // autocomplete sur le champs pseudo
    $("#pseudo_convoi").autocomplete({
      source: (request, response) => {
        // requete pour autocomplete
        Joueur.rechercher(request.term).then((data) => {
          response(Utils.extraitRecherche(data, true, false));
        });
      },
      position: { my: "left top-5", at: "left bottom" },
      delay: 0,
      minLength: 3,
    });
    // sauvegarde des convois
    let listeConvoi = new Array(),
      nombres = new Array();
    $("#centre > strong").each((i, elt) => {
      // seules les lignes de convoi (« … dans 1h 02m ») sont lues : un autre
      // message en gras du jeu faisait échouer toute la page
      if (!/\bdans\b/.test($(elt).text()) || !/\d/.test($(elt).text().split("dans")[0])) return;
      // Affichage du retour des convois
      if ($(elt).next().text().indexOf("Retour") == -1)
        $(elt).after(
          `<span class='small'>- Retour le ${Utils.roundMinute(Utils.timeToInt($(elt).text().split("dans")[1].trim())).format("D MMM YYYY à HH[h]mm")}</span>`,
        );
      nombres = $(elt)
        .text()
        .replace(/ /g, "")
        .split("dans")[0]
        .match(/^\d+|\d+\b|\d+(?=\w)/g);
      listeConvoi.push({
        cible: $(elt).find("a").text(),
        sens: $(elt).text().includes("livrer"),
        nou: nombres[0],
        mat: nombres[1],
        exp: moment().add(Utils.timeToInt($(elt).text().split("dans")[1].trim()), "s"),
      });
    });
    // tri les convois par ordre d'arrivée
    listeConvoi.sort((a, b) => {
      return moment(a.exp).diff(moment(b.exp));
    });
    // Verification si les données sont deja enregistrées
    if (listeConvoi.length) this.saveConvoi(listeConvoi);
    return this;
  }
  /**
   * Sauvegarde les convois en cours.
   *
   * @private
   * @method saveConvoi
   * @param {Array} liste des convois en cours.
   */
  saveConvoi(liste) {
    if (
      !this._boiteComptePlus.hasOwnProperty("convoi") ||
      this._boiteComptePlus.convoi.length != liste.length ||
      this._boiteComptePlus.convoi[0]["cible"] != liste[0]["cible"] ||
      (liste[0]["exp"].diff(this._boiteComptePlus.convoi[0]["exp"], "s") > 1 &&
        !Utils.comptePlus &&
        $("#boiteComptePlus").length)
    ) {
      this._boiteComptePlus.convoi = liste;
      this._boiteComptePlus.startConvoi = moment();
      this._boiteComptePlus.sauvegarder().majConvoi();
    }
    return this;
  }
}
