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
    let niveau = SuiviMembres.ranger(
      SuiviMembres.niveaux($(document.body)),
      RECHERCHE,
      monProfil.niveauRecherche,
    );
    if (niveau.join(",") != monProfil.niveauRecherche.join(",")) {
      monProfil.niveauRecherche = niveau;
      monProfil.sauvegarder();
    }
    // heure où les ressources suffiront, au survol des coûts : la page Convois
    // passe avant les lectures de ce module (page Reine, armée) ; une erreur
    // n'empêche pas le reste de la page
    try {
      DelaiRessources.installer();
    } catch (e) {
      console.error("Fzzz : ressources manquantes", e);
    }
    // avant que tableauEvolution range les recherches en cours
    let lignes = ["bouclier", "armes"]
      .map((r) => this.ligneRecherche(/** @type {RechercheConseil} */ (r)))
      .filter(Boolean);
    // Armée complète (page Reine : garnison et troupes parties comprises),
    // à défaut garnison d'Armee.php plus les troupes parties d'ici
    Promise.all([
      Utils.lireReine(),
      Promise.resolve(this._armee.getArmee()).catch(() => null),
      Utils.pageReine().catch(() => null),
    ]).then(([reine, html, $reine]) => {
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
      if (Utils.affichage("laboInfobulles"))
        lignes.forEach((ligne) => this.conseil(ligne, html != null, $reine));
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
    if (Utils.affichage("retourAnnuler")) Utils.confirmationAnnuler("laboratoire.php");
    if (Utils.affichage("evolutionEnCours")) Utils.tableauEvolution("Recherche", "Laboratoire");
    // Après un clic qui recharge la page (rechercher, annuler et sa
    // confirmation, redirections du jeu) : même position à l'écran
    Utils.garderPosition("fzzz_positionLaboratoire");
    return this;
  }
  /**
   * Ligne d'une recherche conseillée : sa description, le niveau dont part son
   * coût et les ouvrières qu'il demande ; null sans elle.
   *
   * @method ligneRecherche
   * @param {RechercheConseil} recherche
   * @return {{recherche: RechercheConseil, $description: any, niveau: Number, ouvrieres: Number}|null}
   */
  ligneRecherche(recherche) {
    let nom = RECHERCHES_CONSEIL[recherche].nom,
      $ligne = $(".ligneAmelioration").filter(
        (i, tr) => Utils.texteUnite($(tr).find("h2").first().text()) == Utils.texteUnite(nom),
      );
    if (!$ligne.length) return null;
    let affiche = /\d+/.exec($ligne.find(".niveau_amelioration").first().text()),
      ouvrieres = numeral($ligne.find(".cout_amelioration .ouvriere").first().text()).value();
    if (!affiche || !(ouvrieres > 0)) return null;
    return {
      recherche,
      $description: $ligne.find(".desciption_amelioration").first(),
      niveau: ConseilRecherche.niveauDepart($(document), nom, Number(affiche[0])),
      ouvrieres: ouvrieres,
    };
  }
  /**
   * Conseil d'Optizzz sous une recherche : son niveau suivant, ou les unités
   * pondues pendant le temps de repondre ses ouvrières.
   *
   * @method conseil
   * @param {{recherche: RechercheConseil, $description: any, niveau: Number, ouvrieres: Number}} ligne
   * @param {Boolean} armeeLue page Armée lue (garnison) quand la page Reine ne donne pas l'armée
   * @param {any} $reine page Reine, ou null
   */
  conseil(ligne, armeeLue, $reine) {
    // sans l'armée complète de la page Reine : la garnison, plus les troupes
    // parties en chasse ou en attaque depuis ce navigateur
    let dehors = this._armeeComplete ? [] : TroupesDehors.total(),
      armee = this._armee.unite.map((n, i) => n + (dehors[i] || 0)),
      niveaux = [
        monProfil.niveauConstruction[3],
        monProfil.niveauConstruction[4],
        monProfil.niveauRecherche[0],
      ],
      vitesse = niveaux.every((n) => n >= 0) ? Math.pow(0.9, monProfil.getTDP()) : null,
      // une page de connexion n'est pas « aucune unité à pondre »
      reineLue = !!$reine && $reine.find("input[name='typeUnite']").length > 0,
      pondables = reineLue ? ConseilRecherche.pondables($reine) : [],
      manque =
        !this._armeeComplete && !armeeLue
          ? "Armée inconnue : ni la page Reine ni la page Armée n'ont pu être lues."
          : !armee.some((n) => n > 0)
            ? "Aucune unité dans ton armée : rien à renforcer pour l'instant."
            : !reineLue
              ? "Unités à pondre inconnues : la page Reine n'a pas pu être lue."
              : "";
    let $bloc = ConseilRecherche.afficher(
        ligne.$description,
        ligne,
        manque ? { manque } : { armee, complete: this._armeeComplete, vitesse, pondables },
      ),
      attente = 0,
      evenement = "resize.o_conseil_" + ligne.recherche;
    // fenêtre tournée ou redimensionnée : affichage seulement
    $(window)
      .off(evenement)
      .on(evenement, () => {
        clearTimeout(attente);
        attente = setTimeout(() => ConseilRecherche.placer($bloc, ligne.$description), 200);
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
        Horloge.serveur().diff(moment(this._boiteComptePlus.expRecherche), "s") > 0) &&
      !Utils.comptePlus &&
      $("#boiteComptePlus").length
    ) {
      this._boiteComptePlus.recherche = recherche.substr(0, 1).toUpperCase() + recherche.substr(1);
      this._boiteComptePlus.expRecherche = Horloge.serveur().add(
        parseInt(str.split(",")[0].split("(")[1]),
        "s",
      );
      this._boiteComptePlus.startRecherche = Horloge.serveur();
      this._boiteComptePlus.sauvegarder().majRecherche();
    }
    return this;
  }
}
