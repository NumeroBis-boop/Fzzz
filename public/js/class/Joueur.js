/*
 * Joueur.js
 * Hraesvelg
 **********************************************************************/

// Compte+ : recherche en cours lue dans l'encart du jeu, {nom, fin (ms)}
const CLE_RECHERCHE_EN_COURS = "fzzz_rechercheEnCours";
// présent : reserveFlood compte les unités gardées en plus des antisondes (voir getParametre)
const CLE_RESERVE_EN_PLUS = "fzzz_reserveEnPlus";

/**
 * Classe pour creer et gérer un joueur
 *
 * @class Joueur
 */
class Joueur {
  constructor(parametres) {
    /**
     * id du joueur
     */
    this._id = parametres["id"] || -1;
    /**
     * pseudo du joueur
     */
    this._pseudo = parametres["pseudo"];
    /**
     * abscisse du joueur
     */
    this._x = parametres["x"] ?? -1;
    /**
     * ordonnée du joueur
     */
    this._y = parametres["y"] ?? -1;
    /**
     *
     */
    this._terrain = parametres["terrain"] || -1;
    /**
     *
     */
    this._niveauRecherche = parametres["niveauRecherche"] || new Array(10).fill(-1);
    /**
     *
     */
    this._technologie = parametres["technologie"] || -1;
    /**
     *
     */
    this._niveauConstruction = parametres["niveauConstruction"] || new Array(13).fill(-1);
    /**
     *
     */
    this._fourmiliere = parametres["fourmiliere"] || -1;
    /**
     *
     */
    this._mv = parametres["mv"] || false;
    /**
     *
     */
    this._ordreRadar = parametres["ordreRadar"] || 0;
    /**
     *
     */
    this._sujetForum = parametres["sujetForum"] || 0;
    /**
     *
     */
    this._rang = parametres["rang"] || "";
    /**
     *
     */
    this._ordreRang = parametres["ordreRang"] || 0;
    /**
     * Préférence du joueur.
     *
     * @private
     * @property _parametre
     * @type Object
     */
    this._parametre = {};
    // parametres style des boites
    this._parametre["couleur1"] = new Parametre("couleur1", "Couleur de fond", "color", "#d7c384");
    this._parametre["couleur2"] = new Parametre(
      "couleur2",
      "Couleur secondaire",
      "color",
      "#c9ad63",
    );
    this._parametre["couleur3"] = new Parametre("couleur3", "Couleur bordure", "color", "#bd8d46");
    this._parametre["couleurTexte"] = new Parametre(
      "couleurTexte",
      "Couleur du texte",
      "color",
      "#000000",
    );
    this._parametre["couleurTitre"] = new Parametre(
      "couleurTitre",
      "Couleur des titres",
      "color",
      "#787423",
    );
    // parametres armée
    this._parametre["methodeFlood"] = new Parametre(
      "methodeFlood",
      "Méthode de flood",
      "select",
      1,
      METHODE_FLOOD,
    );
    this._parametre["floodAttaques"] = new Parametre(
      "floodAttaques",
      "Nombre d'attaques proposées au flood",
      "number",
      3,
    );
    this._parametre["degressifBase"] = new Parametre(
      "degressifBase",
      "Flood dégressif : 1re attaque (% du TdC de la cible)",
      "number",
      20,
    );
    this._parametre["degressifRegle"] = new Parametre(
      "degressifRegle",
      "Flood dégressif : attaques suivantes",
      "select",
      0,
      [
        "Même part du TdC restant (× 0,8 par attaque dès 20 %)",
        "Écart fixe de 5 points (ex. 25 %, 20 %, 15 % du TdC de départ)",
      ],
    );
    this._parametre["uniteAntisondeTerrain"] = new Parametre(
      "uniteAntisondeTerrain",
      "Antisonde max en terrain",
      "number",
      1,
    );
    this._parametre["uniteAntisondeDome"] = new Parametre(
      "uniteAntisondeDome",
      "Antisonde max en dôme",
      "number",
      0,
    );
    // liste des unités posée à l'affichage des préférences (NOM_UNITE, content.js)
    this._parametre["sondeUnite"] = new Parametre("sondeUnite", "Unité de sonde", "select", 0, []);
    this._parametre["sondeQuantite"] = new Parametre("sondeQuantite", "Sonde", "number", 1);
    this._parametre["sondeLieu"] = new Parametre("sondeLieu", "Lieu de sonde", "select", 0, [
      "Celui de la liste Lieu",
      "Terrain de chasse",
      "Fourmilière (dôme)",
      "Loge impériale",
    ]);
    // unités gardées au flood en plus des antisondes (case reserveFloodAuto) :
    // première ligne, son unité dans reserveFloodType, les suivantes dans
    // reserveFloodAutres (voir Armee.gardeesParDefaut)
    this._parametre["reserveFlood"] = new Parametre(
      "reserveFlood",
      "Autres unités gardées au flood",
      "number",
      0,
    );
    this._parametre["reserveFloodAuto"] = new Parametre(
      "reserveFloodAuto",
      "Antisondes gardées au flood",
      "checkbox",
      true,
    );
    // unité de la première ligne : 0 = dernières unités de l'armée, sinon indice de NOM_UNITE
    this._parametre["reserveFloodType"] = new Parametre(
      "reserveFloodType",
      "Unité des autres unités gardées au flood",
      "select",
      0,
      [],
    );
    // [[nombre, unité], …] : lignes suivantes des autres unités gardées au flood
    this._parametre["reserveFloodAutres"] = new Parametre(
      "reserveFloodAutres",
      "Autres unités gardées au flood, lignes suivantes",
      "",
      [],
    );
    // listes des unités posées à l'affichage des préférences (NOM_UNITE, content.js)
    this._parametre["uniteAntisondeTerrainType"] = new Parametre(
      "uniteAntisondeTerrainType",
      "Unité de l'antisonde en terrain",
      "select",
      0,
      [],
    );
    this._parametre["uniteAntisondeDomeType"] = new Parametre(
      "uniteAntisondeDomeType",
      "Unité de l'antisonde en dôme",
      "select",
      0,
      [],
    );
    this._parametre["vueMembres"] = new Parametre(
      "vueMembres",
      "Vue par défaut de la page Membres de l'alliance",
      "select",
      0,
      ["Standard", "Temps de trajet", "Floods et chasses en cours"],
    );
    this._parametre["replacerArmeeAuto"] = new Parametre(
      "replacerArmeeAuto",
      "Signaler l'armée à replacer (ouverture d'Armée)",
      "checkbox",
      false,
    );
    // parametre divers
    this._parametre["couleurChat"] = new Parametre(
      "couleurChat",
      "Couleur chat",
      "color",
      "#000000",
    );
    this._parametre["couleurMessagerie"] = new Parametre(
      "couleurMessagerie",
      "Couleur messagerie",
      "color",
      "#000000",
    );
    // Fzzz : fenêtre d'alerte quand la file de ponte se vide (seuils : SEUILS_ALERTE_PONTE)
    this._parametre["alertePonte"] = new Parametre(
      "alertePonte",
      "Alerte quand la ponte se termine dans moins de",
      "select",
      6,
      ["Désactivée", "15 min", "30 min", "1 h", "2 h", "4 h", "8 h", "12 h", "16 h", "24 h"],
    );
    this._parametre["affectationRessource"] = new Parametre(
      "affectationRessource",
      "Affectation des ressources",
      "select",
      0,
      ["Non", "Materiaux", "Nourriture", "Ratio"],
    );
    // part des ouvrières affectée à la nourriture en mode Ratio (le reste va
    // aux matériaux) : curseur de 10 en 10, champ au pourcent près
    this._parametre["ratioRecolte"] = new Parametre(
      "ratioRecolte",
      "Part en nourriture",
      "slider",
      50,
      {
        min: 0,
        max: 100,
        step: 10,
        unite: " %",
      },
    );
    // Fzzz : TdC à l'arrivée proposé par le lanceur de chasses = le TdC courant,
    // au plus cette valeur : au-delà les chasses durent trop longtemps pour que
    // le TdC du moment soit une prévision sensée, à renseigner soi-même
    this._parametre["tdcArriveeMax"] = new Parametre(
      "tdcArriveeMax",
      "TdC à l'arrivée proposé, au plus",
      "number",
      2000000,
    );
    // Fzzz : ratio en dessous duquel le lanceur ne descend pas de lui-même
    // quand le ratio est libre (pertes acceptées fixées). 7,2 :
    // plus aucune chance de réplique à 50 % ; 6 : l'ancien plancher du lanceur
    // par budget, où 65 % des chasses subissent 30 % de réplique
    this._parametre["ratioPlancher"] = new Parametre(
      "ratioPlancher",
      "Ratio plancher",
      "slider",
      7.2, // SimulationChasse.RATIO_PLANCHER (classe chargée après celle-ci)
      { min: 3, max: 10, step: 0.1 },
    );
    return this;
  }
  /**
   *
   */
  get id() {
    return this._id;
  }
  /**
   *
   */
  set id(newId) {
    this._id = newId;
  }
  /**
   *
   */
  get pseudo() {
    return this._pseudo;
  }
  /**
   *
   */
  set pseudo(newPseudo) {
    this._pseudo = newPseudo;
  }
  /**
   *
   */
  get x() {
    return this._x;
  }
  /**
   *
   */
  set x(newX) {
    this._x = newX;
  }
  /**
   *
   */
  get y() {
    return this._y;
  }
  /**
   *
   */
  set y(newY) {
    this._y = newY;
  }
  /**
   *
   */
  get terrain() {
    return this._terrain;
  }
  /**
   *
   */
  set terrain(newTerrain) {
    this._terrain = newTerrain;
  }
  /**
   *
   */
  get niveauRecherche() {
    return this._niveauRecherche;
  }
  /**
   *
   */
  set niveauRecherche(newNiveau) {
    this._niveauRecherche = newNiveau;
  }
  /**
   *
   */
  get technologie() {
    return this._technologie;
  }
  /**
   *
   */
  set technologie(newTechnologie) {
    this._technologie = newTechnologie;
  }
  /**
   *
   */
  get niveauConstruction() {
    return this._niveauConstruction;
  }
  /**
   *
   */
  set niveauConstruction(newNiveau) {
    this._niveauConstruction = newNiveau;
  }
  /**
   *
   */
  get fourmiliere() {
    return this._fourmiliere;
  }
  /**
   *
   */
  set fourmiliere(newFourmiliere) {
    this._fourmiliere = newFourmiliere;
  }
  /**
   *
   */
  get ordreRadar() {
    return this._ordreRadar;
  }
  /**
   *
   */
  set ordreRadar(newOrdre) {
    this._ordreRadar = newOrdre;
  }
  /**
   *
   */
  get mv() {
    return this._mv;
  }
  /**
   *
   */
  set mv(newMV) {
    this._mv = newMV;
  }
  /**
   *
   */
  get sujetForum() {
    return this._sujetForum;
  }
  /**
   *
   */
  set sujetForum(newSujet) {
    this._sujetForum = newSujet;
  }
  /**
   *
   */
  get rang() {
    return this._rang;
  }
  /**
   *
   */
  set rang(newRang) {
    this._rang = newRang;
  }
  /**
   *
   */
  get ordreRang() {
    return this._ordreRang;
  }
  /**
   *
   */
  set ordreRang(newOrdre) {
    this._ordreRang = newOrdre;
  }
  /**
   * Renvoie les joueurs et les alliances sous surveillance.
   *
   * @method Radar
   * @return {Object} les joueurs et alliances format JSON.
   */
  get parametre() {
    return this._parametre;
  }
  /**
   *
   */
  toJSON() {
    return {
      id: this._id,
      pseudo: this._pseudo,
      x: this._x,
      y: this._y,
      terrain: this._terrain,
      mv: this._mv,
      ordreRadar: this._ordreRadar,
      rang: this._rang,
      niveauConstruction: this._niveauConstruction,
      niveauRecherche: this._niveauRecherche,
    };
  }
  /**
   *
   */
  estJoueurCourant() {
    return this._pseudo == monProfil.pseudo;
  }
  /**
   *
   */
  estAttaquable() {
    return Utils.aPortee(this._terrain, Utils.terrain);
  }
  /**
   *
   */
  estAttaquant() {
    return Utils.aPortee(Utils.terrain, this._terrain);
  }
  /**
   *
   */
  getTDP() {
    return this._niveauConstruction[3] + this._niveauConstruction[4] + this._niveauRecherche[0];
  }
  /**
   *
   */
  getTempsParcours(x = monProfil.x, y = monProfil.y) {
    // arrondi au plus proche, comme le jeu (vérifié sur des trajets réels du s5)
    return Math.round(
      Math.pow(0.9, this._niveauRecherche[6]) *
        637200 *
        (1 - Math.exp(-(Math.sqrt(Math.pow(x - this._x, 2) + Math.pow(y - this._y, 2)) / 350))),
    );
  }
  /**
   *
   */
  getTempsParcours2(joueur) {
    return Math.round(
      Math.pow(0.9, this._niveauRecherche[6]) *
        637200 *
        (1 -
          Math.exp(
            -(Math.sqrt(Math.pow(joueur.x - this._x, 2) + Math.pow(joueur.y - this._y, 2)) / 350),
          )),
    );
  }
  /**
   *
   */
  getLienFourmizzz() {
    return this._pseudo != "Vous" || this._pseudo != "Ennemie"
      ? `<a href="Membre.php?Pseudo=${this._pseudo}" class='o_lien'>${this._pseudo}</a>`
      : this._pseudo;
  }
  /**
   *
   */
  attenteSynchro() {
    // Attente (s, au dixième) avant de cliquer pour que l'attaque arrive sur
    // une minute pleine (seconde :00), en heure serveur + latence. Le clic vise
    // le milieu de la seconde de lancement : ±0,5 s de marge de réaction.
    let maintenant = Horloge.clic().valueOf(),
      // trajet depuis ma fourmilière, à MA vitesse d'attaque (pas celle de la cible)
      trajet = monProfil.getTempsParcours2(this) * 1000,
      arrivee = Math.ceil((maintenant + trajet) / 60000) * 60000,
      lancement = arrivee - trajet + 500;
    if (lancement - maintenant < 2000) lancement += 60000;
    return (lancement - maintenant) / 1000;
  }
  /**
   *
   */
  getParametre() {
    let data = Utils.lireStockage("outiiil_parametre");
    // couleurs des boîtes : plus réglables, valeurs par défaut même si un
    // ancien choix est enregistré
    const COULEURS_FIXES = ["couleurTitre", "couleur1", "couleur2", "couleur3", "couleurTexte"];
    for (let cle in data)
      if (this._parametre[cle] && !COULEURS_FIXES.includes(cle))
        this._parametre[cle].valeur = data[cle];
    // une seule unité d'antisonde (1.76 à 1.78) : reprise pour le terrain et le dôme
    if (data && data.uniteReplacement != null)
      ["uniteAntisondeTerrainType", "uniteAntisondeDomeType"].forEach((cle) => {
        if (data[cle] == null) this._parametre[cle].valeur = data.uniteReplacement;
      });
    // case « antisondes » cochée, reserveFlood recopiait leur nombre ; il compte
    // maintenant les unités gardées en plus : remis à 0, une fois par navigateur
    try {
      if (!localStorage.getItem(CLE_RESERVE_EN_PLUS)) {
        if (this._parametre["reserveFloodAuto"].valeur) {
          this._parametre["reserveFlood"].valeur = 0;
          localStorage.setItem("outiiil_parametre", JSON.stringify(this._parametre));
        }
        localStorage.setItem(CLE_RESERVE_EN_PLUS, "1");
      }
    } catch (e) {
      /* stockage indisponible : rien n'est enregistré non plus */
    }
    return this;
  }
  /**
   *
   */
  sauvegarder() {
    return localStorage.setItem(
      "outiiil_joueur",
      JSON.stringify(this, ["id", "x", "y", "niveauConstruction", "niveauRecherche"]),
    );
  }
  /**
   *
   */
  getProfil() {
    return $.ajax({
      url: location.origin + "/Membre.php?Pseudo=" + encodeURIComponent(this._pseudo),
    });
  }
  /**
   * Épée « Attaquer cette Fourmilière », comme dans les tableaux de membres
   * en Compte+. Le tableau ne donne que le pseudo et la page d'attaque veut
   * l'id du joueur : le lien mène au profil, et au clic l'id y est lu pour
   * ouvrir directement la page d'attaque (cf. Joueur.activerLiensAttaque).
   *
   * @static
   * @method lienAttaque
   * @param {String} pseudo
   * @return {String} html
   */
  static lienAttaque(pseudo) {
    return `<a href="Membre.php?Pseudo=${encodeURIComponent(pseudo)}" class="o_lienAttaque" data-pseudo="${pseudo}"><img src="images/icone/icone_degat_attaque.gif" title="Attaquer cette Fourmilière" alt="Attaquer" width="18" height="18"></a>`;
  }
  /**
   * Épées de portée de flood dans les colonnes qui entourent le terrain, comme
   * celles que le jeu affiche avec le Compte+ : bleue à gauche si ce joueur
   * peut me flooder, rouge à droite (lien d'attaque) si je peux le flooder.
   * Les cellules déjà remplies par le jeu ne sont pas touchées.
   *
   * @static
   * @method epeesPortee
   * @param {Joueur} joueur
   * @param {jQuery} $gauche cellule à gauche du terrain
   * @param {jQuery} $droite cellule à droite du terrain
   */
  static epeesPortee(joueur, $gauche, $droite) {
    if (joueur.estJoueurCourant() || !(Utils.terrain > 0)) return;
    let vide = ($c) => $c.length && !$c.children().length && !$c.text().trim();
    if (vide($gauche) && joueur.estAttaquant())
      $gauche.html(`<span class="o_epee o_epeeBleue" title="Peut te flooder">⚔\uFE0E</span>`);
    if (vide($droite) && joueur.estAttaquable())
      $droite.html(
        `<a href="Membre.php?Pseudo=${encodeURIComponent(joueur.pseudo)}" class="o_lienAttaque o_epee o_epeeRouge" data-pseudo="${Utils.echapper(joueur.pseudo)}" title="Tu peux le flooder (clic : attaquer)">⚔\uFE0E</a>`,
      );
  }
  /**
   * Clic sur une épée de Joueur.lienAttaque : lit l'id sur le profil puis
   * ouvre la page d'attaque. En cas d'échec, le lien mène au profil.
   *
   * @static
   * @method activerLiensAttaque
   */
  static activerLiensAttaque() {
    $(document)
      .off("click.o_lienAttaque")
      .on("click.o_lienAttaque", ".o_lienAttaque", (e) => {
        e.preventDefault();
        let lien = e.currentTarget,
          joueur = new Joueur({ pseudo: $(lien).data("pseudo") });
        joueur.getProfil().then(
          (html) => {
            try {
              joueur.chargerProfil(html);
            } catch (erreur) {}
            location.href =
              joueur.id != -1 ? `ennemie.php?Attaquer=${joueur.id}&lieu=1` : lien.href;
          },
          () => (location.href = lien.href),
        );
      });
  }
  /**
   *
   */
  getProfilCourant() {
    // si on est le joueur courant on a peut etre les infos dans le storage
    if (monProfil.pseudo == this._pseudo) {
      // si on est le joueur courant on regarde dans le localstorage
      let data = Utils.lireStockage("outiiil_joueur");
      // Si des données sont deja presente et à jour on les charges
      if (data.hasOwnProperty("id") && data.hasOwnProperty("x") && data.hasOwnProperty("y")) {
        this._id = data.id;
        this._x = data.x;
        this._y = data.y;
      }
    }
    // sinon. 0 / 0 compte comme inconnu : c'est ce qu'enregistraient les versions
    // qui ne lisaient pas le lien carte.php de s5, et le profil n'était alors
    // jamais relu (temps de trajet faux)
    if (this._x == -1 || this._y == -1 || this._id == -1 || (this._x == 0 && this._y == 0))
      return this.getProfil();
    return null;
  }
  /**
   *
   */
  chargerProfil(html) {
    if (html.includes("Aucun joueurs avec le pseudo")) return false;
    else {
      // Strip `<img>` avant le parseHTML de jQuery — sinon `$(html)` crée un
      // fragment où le navigateur tente de charger toutes les images du profil
      // (avatars, signatures), dont des hôtes morts type skyrock.net qui
      // spamment `ERR_NAME_NOT_RESOLVED` dans la console. On lit que du texte
      // et de la structure ici, jamais les images.
      let stripped = html.replace(/<img\b[^>]*>/gi, ""),
        // -1 / -1 si les coordonnées sont introuvables : la carte d'alliance
        // écarte alors le joueur au lieu de le placer en 0 / 0
        $page = $(stripped),
        coordonnees = Utils.coordonnees($page.find(".boite_membre")),
        // lien commerce absent (page inattendue) : on garde l'id connu au lieu
        // de planter tout le démarrage de l'extension
        idLu = (($page.find("a[href^='commerce.php?ID=']").attr("href") || "").match(/\d+/) ||
          [])[0];
      if (idLu) this._id = idLu;
      this._x = coordonnees.x;
      this._y = coordonnees.y;
      this._mv = $page.find("table:eq(0) tr:eq(0) td:eq(0)").text().includes("Joueur en vacances");
      this._terrain = numeral($page.find(".tableau_score tr:eq(1) td:eq(1)").text()).value();
      if (monProfil.pseudo == this._pseudo) this.sauvegarder();
    }
    return true;
  }
  /**
   * Récupére les niveaux des constructions du joueur ainsi que la construction en cours.
   *
   * @method getConstruction
   */
  getConstruction() {
    // si on est le joueur courant on regarde dans le localstorage
    let data = Utils.lireStockage("outiiil_joueur");
    // Si des données sont deja presente et à jour on les charges
    if (data.hasOwnProperty("niveauConstruction"))
      this._niveauConstruction = data.niveauConstruction;
    // si on pas les infos en localstorage
    if (
      this._niveauConstruction.every((elt) => {
        return elt == -1;
      })
    )
      return $.ajax({ url: location.origin + "/construction.php" });
    return null;
  }
  /**
   *
   */
  chargerConstruction(html) {
    let parsed = Utils.parseHtml(html);
    // Niveau des batiments
    parsed.find(".ligneAmelioration").each((i, elt) => {
      this._niveauConstruction[i] = parseInt(
        $(elt).find(".niveau_amelioration").text().split(" ")[1],
      );
    });
    // Construction en cours ?!
    let ligne = parsed.find("#centre strong").text(),
      construction = ligne.substring(2, ligne.indexOf("se termine") - 1),
      time = parseInt(ligne.split(",")[0].split("(")[1]);
    // si il y a une construction en cours les données expirent à la fin de cette construction
    if (construction) {
      let dataEvo = Utils.lireStockage("outiiil_evolution");
      // si on a pas de donné ou que la consutrction n'est pas deja enregistré
      if (!dataEvo.hasOwnProperty("construction")) {
        // si on pas les infos en localstorage
        dataEvo.construction = construction.substr(0, 1).toUpperCase() + construction.substr(1);
        dataEvo.expConstruction = Horloge.serveur().add(time, "s");
        dataEvo.startConstruction = Horloge.serveur();
        localStorage.setItem("outiiil_evolution", JSON.stringify(dataEvo));
      }
    }
    this.sauvegarder();
    return this;
  }
  /**
   * Récupére les niveaux des recherches du joueur ainsi que la recherche en cours.
   *
   * @method getLaboratoire
   */
  getLaboratoire() {
    // si on est le joueur courant on regarde dans le localstorage
    let data = Utils.lireStockage("outiiil_joueur");
    // Si des données sont deja presente et à jour on les charges
    if (data.hasOwnProperty("niveauRecherche")) this._niveauRecherche = data.niveauRecherche;
    // niveaux inconnus, ou recherche terminée depuis la dernière lecture
    if (
      Joueur.rechercheTerminee() ||
      this._niveauRecherche.every((elt) => {
        return elt == -1;
      })
    )
      return $.ajax({ url: location.origin + "/laboratoire.php" });
    return null;
  }
  /**
   * Compte+ : suit la recherche en cours affichée dans l'encart du jeu (nom et
   * secondes restantes), sans requête. Vrai au premier chargement de page
   * après la fin d'une recherche : ses niveaux (Vitesse d'attaque pour les
   * temps de trajet…) sont alors à relire. Une recherche annulée ne compte pas.
   * Sans Compte+, l'encart refait par l'extension suit la recherche
   * (BoiteComptePlus.verifierDonnees).
   *
   * @static
   * @method rechercheTerminee
   * @return {Boolean}
   */
  static rechercheTerminee() {
    let $ligne = $("#ligne_recherche");
    if (!$ligne.length) return false;
    let avant = Utils.lireStockage(CLE_RECHERCHE_EN_COURS),
      maintenant = Horloge.maintenant(),
      secondes = parseInt(
        ($ligne
          .find("script")
          .text()
          .match(/resteTemps\((\d+)/) || [])[1],
      ),
      nom = $ligne.find("td").eq(1).text().trim();
    try {
      if (secondes > 0 && nom)
        localStorage.setItem(
          CLE_RECHERCHE_EN_COURS,
          JSON.stringify({ nom, fin: maintenant + secondes * 1000 }),
        );
      else localStorage.removeItem(CLE_RECHERCHE_EN_COURS);
    } catch (e) {}
    return avant.fin > 0 && avant.fin <= maintenant;
  }
  /**
   *
   */
  chargerRecherche(html) {
    let parsed = Utils.parseHtml(html);
    // Niveau des recherches
    parsed.find(".ligneAmelioration").each((i, elt) => {
      this._niveauRecherche[i] = parseInt($(elt).find(".niveau_amelioration").text().split(" ")[1]);
    });
    // Recherche en cours ?!
    let ligne = parsed.find("#centre strong").text();
    let recherche = ligne.substring(2, ligne.indexOf("termin") - 1),
      time = parseInt(ligne.split(",")[0].split("(")[1]);
    // si il y a une recherche en cours les données expirent à la fin de cette construction
    if (recherche) {
      let dataEvo = Utils.lireStockage("outiiil_evolution");
      // si on a pas de donné ou que la recherche n'est pas deja enregistré
      if (!dataEvo.hasOwnProperty("recherche")) {
        // si on pas les infos en localstorage
        dataEvo.recherche = recherche;
        dataEvo.expRecherche = Horloge.serveur().add(time, "s");
        dataEvo.startRecherche = Horloge.serveur();
        localStorage.setItem("outiiil_evolution", JSON.stringify(dataEvo));
      }
    }
    this.sauvegarder();
    return this;
  }
  /**
   *
   */
  getLigneRadar(radar, id, indice) {
    let cellTerrain = this.estAttaquable()
      ? `<a class="gras ${this._mv ? "blue_light" : ""}" href="/ennemie.php?Attaquer=${this._id}&lieu=1">${numeral(this._terrain).format()}</a>`
      : `<span ${this._mv ? `class="blue_light" title="En vacances"` : ""}>${numeral(this._terrain).format()}</span>`;
    $(id).append(
      `<tr id="o_item_${indice}" class="lien"><td><a id="o_maj_${this._id}" class='o_actualiser' href=""><img src="${IMG_ACTUALISER}" alt="rang" height="20"/></a></td><td id="o_nom_${this._id}" class="left" title=""><a class="gras ${this._mv ? "blue_light" : ""}" href="Membre.php?Pseudo=${this._pseudo}">${this._pseudo}</a></td><td id="o_terrain_${this._id}" class="right reduce" title="">${cellTerrain}</td></tr>`,
    );
    // event
    $("#o_maj_" + this._id).click((e) => {
      this.refreshDansRadar(radar).then((res) => {
        if (res.removed) {
          $.toast({ ...TOAST_WARNING, text: `Le joueur ${this._pseudo} n'existe plus.` });
          radar.supprimeJoueur(this).sauvegarder().actualiser();
        } else if (res.changed) {
          radar.sauvegarder();
        }
      });
      return false;
    });
    // tooltip vacance...
    $("#o_terrain_" + this._id).tooltip({
      position: { my: "left+10 center", at: "right center" },
      tooltipClass: "warning-tooltip",
    });
    // creation du tooltip sur les joueurs pour avoir le temps de trajet
    $("#o_nom_" + this._id).tooltip({
      position: { my: "left+10 bottom", at: "right center" },
      content: "NC",
      open: (e, ui) => {
        if (radar.joueurs.hasOwnProperty(this._pseudo)) {
          $(e.currentTarget).tooltip({
            position: { my: "left+10 center", at: "right center" },
            content: `<table><tr><td>Temps de trajet</td><td class="right">${Utils.intToTime(monProfil.getTempsParcours2(radar.joueurs[this._pseudo]))}</td></tr><td>Retour le</td><td class="right">${Horloge.clic().add(monProfil.getTempsParcours2(radar.joueurs[this._pseudo]), "s").format("D MMM à HH[h]mm[m]ss[s]")}</td><tr></tr></table>`,
            hide: { effect: "fade", duration: 10 },
            tooltipClass: "warning-tooltip ui-tooltip-right",
          });
        }
      },
      hide: { effect: "fade", duration: 10 },
      tooltipClass: "warning-tooltip ui-tooltip-right",
    });
  }
  /**
   * Rafraîchit le joueur dans le contexte de la boite radar : spin de l'icône,
   * fetch du profil, mise à jour du terrain et de l'état MV, highlight du diff.
   * Ne sauvegarde pas et ne touche pas la collection du radar — c'est au caller
   * (click single, ou batch "Tout actualiser") de décider quoi faire selon le
   * résultat ({ removed, changed }).
   *
   * @method refreshDansRadar
   * @param {BoiteRadar} radar
   * @return {Promise<{ removed: boolean, changed: boolean }>}
   */
  refreshDansRadar(radar) {
    let oldTerrain = numeral($("#o_terrain_" + this._id).text()).value(),
      oldMV = this._mv,
      $icon = $("#o_maj_" + this._id);
    $({ deg: 0 }).animate(
      { deg: 360 },
      {
        duration: 600,
        step: (now) => $icon.find("img").css({ transform: "rotate(" + now + "deg)" }),
      },
    );
    return this.getProfil().then((data) => {
      if (!this.chargerProfil(data)) return { removed: true, changed: false };
      let diff = this._terrain - oldTerrain,
        changed = false,
        cellTerrain = this.estAttaquable()
          ? `<a class="gras ${this._mv ? "blue_light" : ""}" href="/ennemie.php?Attaquer=${this._id}&lieu=1">${numeral(this._terrain).format()}</a>`
          : `<span ${this._mv ? `class="blue_light" title="En vacances"` : ""}>${numeral(this._terrain).format()}</span>`;
      if (oldMV != this._mv) {
        $("#o_terrain_" + this._id).html(cellTerrain);
        if (this._mv) $("#o_nom_" + this._id + " a").addClass("blue_light");
        else $("#o_nom_" + this._id + " a").removeClass("blue_light");
        changed = true;
      }
      if (diff) {
        $("#o_terrain_" + this._id)
          .html(cellTerrain)
          .effect("highlight", { color: diff > 0 ? "#458D58" : "#8D4545" }, 1000)
          .attr("title", numeral(diff).format())
          .tooltip({
            position: { my: "left+10 center", at: "right center" },
            content: `<span class='${diff > 0 ? "green_light" : "red_xlight"}'>${diff > 0 ? "+ " + $("#o_terrain_" + this._id).attr("title") : $("#o_terrain_" + this._id).attr("title")} cm²</span>`,
            hide: { effect: "fade", duration: 10 },
            tooltipClass: "warning-tooltip ui-tooltip-right",
          })
          .tooltip("open");
        changed = true;
      }
      return { removed: false, changed };
    });
  }
  /**
   *
   */
  static rechercher(elt) {
    return $.ajax({
      type: "post",
      url: location.origin + "/classementAlliance.php",
      data: {
        requete: elt,
        recherche: 1,
        prioriteRecherche: "joueur",
      },
    });
  }
}
