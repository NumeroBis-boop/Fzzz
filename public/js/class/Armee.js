/*
 * Armee.js
 * Hraesvelg
 **********************************************************************/

/**
 * Classe de gestion de l'armée.
 *
 * @class Armee
 * @constructor
 */
class Armee {
  constructor(parametres = {}) {
    /**
     * Tableau du nombre des unités.
     *
     * @private
     * @property unite
     * @type array
     */
    this._unite = new Array(14).fill(0);
    if (parametres.hasOwnProperty("unite"))
      for (let i = 0; i < 14; i++)
        if (parametres.unite.hasOwnProperty(NOM_UNITE[i + 1]))
          this._unite[i] = parametres.unite[NOM_UNITE[i + 1]];
    /**
     * Sauvegarde du nombre de JSN pour le lancement des chasses.
     *
     * @private
     * @property nbrJSN
     * @type integer
     */
    this._nbrJSN = 0;
    /**
     * tableau de la repartition des floods.
     *
     * @private
     * @property floods
     * @type array
     */
    this._floods = new Array();
    /**
     * Repartition de l'armée en fonction des floods ou des chasses.
     *
     * @private
     * @property repartition
     * @type array
     */
    this._repartition = new Array();
    /**
     * Unités gardées au flood pour l'attaque en cours (voir gardeesParDefaut) ;
     * null : celles des préférences.
     *
     * @private
     * @property gardees
     * @type object
     */
    this._gardees = null;
  }
  /**
   *
   */
  get unite() {
    return this._unite;
  }
  /**
   *
   */
  set unite(newUnite) {
    this._unite = newUnite;
  }
  /**
   *
   */
  get nbrJSN() {
    return this._nbrJSN;
  }
  /**
   *
   */
  set nbrJSN(nbr) {
    this._nbrJSN = nbr;
  }
  /**
   *
   */
  get floods() {
    return this._floods;
  }
  /**
   *
   */
  set floods(newFloods) {
    this._floods = newFloods;
  }
  /**
   *
   */
  get repartition() {
    return this._repartition;
  }
  /**
   * @param {{antisondes: Boolean, autres: Array<{nombre: Number, unite: Number}>}} reglage voir gardeesParDefaut
   */
  set gardees(reglage) {
    this._gardees = reglage;
  }
  /**
   * Unités gardées au flood par défaut, réglées dans les préférences (onglet
   * Attaque) : les antisondes ou non, et d'autres unités, une ligne par unité :
   * `nombre` de NOM_UNITE[unite] (unite 0 : les dernières unités de l'armée).
   * Un nouvel objet à chaque appel : le modifier ne change pas les préférences.
   *
   * @static
   * @method gardeesParDefaut
   * @return {{antisondes: Boolean, autres: Array<{nombre: Number, unite: Number}>}}
   */
  static gardeesParDefaut() {
    let p = monProfil.parametre,
      suivantes = Array.isArray(p["reserveFloodAutres"].valeur)
        ? p["reserveFloodAutres"].valeur
        : [];
    return {
      antisondes: !!p["reserveFloodAuto"].valeur,
      autres: [[p["reserveFlood"].valeur, p["reserveFloodType"].valeur], ...suivantes]
        .map(([nombre, unite]) => ({
          nombre: Math.max(0, parseInt(nombre) || 0),
          unite: parseInt(unite) || 0,
        }))
        .filter((ligne) => ligne.nombre > 0),
    };
  }
  /**
   * Enregistre `reglage` comme unités gardées par défaut (préférences) : la
   * première ligne dans reserveFlood / reserveFloodType, les suivantes dans
   * reserveFloodAutres.
   *
   * @static
   * @method enregistrerGardees
   * @param {{antisondes: Boolean, autres: Array<{nombre: Number, unite: Number}>}} reglage
   */
  static enregistrerGardees(reglage) {
    let p = monProfil.parametre,
      [premiere, ...suivantes] = reglage.autres;
    p["reserveFloodAuto"].valeur = !!reglage.antisondes;
    p["reserveFlood"].valeur = premiere ? premiere.nombre : 0;
    p["reserveFloodType"].valeur = premiere ? premiere.unite : 0;
    p["reserveFloodAutres"].valeur = suivantes.map((ligne) => [ligne.nombre, ligne.unite]);
    p["reserveFloodAutres"].sauvegarde();
  }
  /**
   * Récupére l'armée du joueur via un appel ajax.
   *
   * @private
   * @method getArmee
   */
  getArmee() {
    return $.ajax({ url: location.origin + "/Armee.php" });
  }
  /**
   * Lit la garnison d'Armee.php, tous lieux confondus ou pour un seul lieu.
   *
   * @param {String} html Armee.php
   * @param {Integer} lieu 1 terrain de chasse, 2 dôme, 3 loge ; 0 pour tous
   */
  chargeData(html, lieu = 0) {
    // DOMParser : $(html) créait les <img> de la page (une requête d'image
    // par icône à chaque lecture d'Armee.php)
    Utils.parseHtml(html)
      .find(".simulateur tr[align='center']:lt(14)")
      .each((i, elt) => {
        let label = $(elt).find(".pas_sur_telephone").text();
        if (label)
          $(elt)
            .find("td span")
            .each((i2, elt2) => {
              // id du jeu : (nombre,'uniteX',lieu)
              if (lieu && !($(elt2).attr("id") || "").endsWith("," + lieu + ")")) return;
              this._unite[NOM_UNITE.indexOf(label) - 1] += parseInt(
                $(elt2)
                  .text()
                  .replace(/[^0-9]/g, ""),
              );
            });
      });
    this._nbrJSN = this._unite[0];
    return this;
  }
  /**
   * Unités débloquées, dans l'ordre des lignes d'Armee.php (indices NOM_UNITE).
   *
   * @param {String} html Armee.php
   * @return {Array<Number>}
   */
  static debloquees(html) {
    return Utils.parseHtml(html)
      .find(".simulateur tr[align='center']")
      .map((i, elt) => Utils.uniteDepuisLibelle($(elt).find(".pas_sur_telephone").first().text()))
      .get()
      .filter((n) => n > 0);
  }
  /**
   * Donne le compte rendu de l'armée.
   *
   * @private
   * @method toString
   * @return {String} description
   */
  toString() {
    let s = "";
    this._unite.forEach((elt, ind) => {
      return (s += elt
        ? numeral(elt).format() + " " + (elt > 1 ? NOM_UNITES[ind + 1] : NOM_UNITE[ind + 1]) + ", "
        : "");
    });
    return s.slice(0, -2) + ".";
  }
  /**
   * Convertie une armée sous forme de chaine de caractére en l'objet Armee.
   *
   * @private
   * @method toString
   * @param {String} armee au format string.
   */
  parseArmee(texte) {
    let RegExpToutSaufChiffre = new RegExp("[^0-9]", "g"); //Capture tout sauf les chiffres
    let unite0 = new RegExp(
      "(\\bgs\\b)|(Goules? Sauvages?)|(\\bjsn\\b)|(Jeunes? Soldates? Naines?)|(Young dwarf)|(Young dwarves)",
      "gi",
    );
    let unite1 = new RegExp(
      "(\\bg\\b)|(Goules?)|(\\bsn\\b)|(Soldates? Naines?)|(Dwarf)|(Dwarves)",
      "gi",
    );
    let unite2 = new RegExp(
      "(\\bcd?g\\b)|(Chefs? des Goules?)|(\\bne\\b)|(Naines? d')|(Naines? d’)|(Top dwarf)|(Top dwarves)",
      "gi",
    );
    let unite3 = new RegExp(
      "(\\bmer?\\b)|(Mercenaires?)|(\\bjs\\b)|(Jeunes? Soldates?)|(Young soldiers?)",
      "gi",
    );
    let unite4 = new RegExp("(\\bpil?\\b)|(Pillards?)|(\\bs\\b)|(Soldates?)|(Soldiers?)", "gi");
    let unite5 = new RegExp(
      "(\\bpro?\\b)|(Protectrons?)|(\\bc\\b)|(Concierges?)|(doorkeepers?)",
      "gi",
    );
    let unite6 = new RegExp(
      "(\\bce\\b)|(Concierges? d')|(Concierges? d’)|(Top doorkeepers?)",
      "gi",
    );
    let unite7 = new RegExp("(\\bmut?\\b)|(Mutants?)|(\\ba\\b)|(Artilleuses?)|(Fire ants?)", "gi");
    let unite8 = new RegExp(
      "(\\bsm\\b)|(\\bsmut?\\b)|(Supers? Mutants?)|(\\bae\\b)|(Artilleuses? d')|(Artilleuses? d’)|(Top fire ants?)",
      "gi",
    );
    let unite9 = new RegExp(
      "(\\bcom?\\b)|(Commandos?)|(\\bse\\b)|(Soldates? d')|(Soldates? d’)|(Top soldiers?)",
      "gi",
    );
    let unite10 = new RegExp("(\\bnu?\\b)|(Nucleotrons?)|(\\bta\\b)|(\\btk\\b)|(Tanks?)", "gi");
    let unite11 = new RegExp("(\\btae\\b)|(\\btke\\b)|(Tanks? d')|(Tanks? d’)|(Top tanks?)", "gi");
    let unite12 = new RegExp("(\\bche?\\b)|(Chevaliers?)|(\\btu\\b)|(Tueuses?)|(Killers?)", "gi");
    let unite13 = new RegExp(
      "(\\bpa?\\b)|(Paladins?)|(\\btue\\b)|(Tueuses? d'?)|(Tueuses? d’?)|(Top killers?)",
      "gi",
    );
    let unite = new Array(
      unite0,
      unite1,
      unite2,
      unite3,
      unite4,
      unite5,
      unite6,
      unite7,
      unite8,
      unite9,
      unite10,
      unite11,
      unite12,
      unite13,
    );
    let interdit = new RegExp(
      "(Vos raiders.*secondes?)|(Vos chasseuses.*secondes?)|(Vous allez attaquer.*secondes?)|(inflige.*\.)|(Arriv.*[0-9]{2}h[0-9]{2})|(\\(s\\))",
      "gi",
    );
    let kilo = new RegExp("([0-9]+)k\\b|(kilos?)", "gi");
    let mega = new RegExp("([0-9]+)m\\b|(megas?)", "gi");
    let giga = new RegExp("([0-9]+)g\\b|(gigas?)", "gi");
    let tera = new RegExp("([0-9]+)t\\b|(teras?)", "gi");
    // L'ordre est important car sans lui �a va remplacer Top soldiers par Top unite5 qui est le soldier.
    let ordre = new Array(0, 2, 1, 3, 9, 4, 8, 7, 6, 5, 11, 10, 13, 12);
    // initialistion du nombre d'unité
    this._unite = new Array(14).fill(0);
    // on match le texte d'entrée
    texte = texte.replace(interdit, "");
    for (let i = 0; i < unite.length; i++)
      texte = texte.replace(unite[ordre[i]], "{separateur}unite" + ordre[i] + "{separateur}");
    texte = texte.replace(kilo, "$1 000");
    texte = texte.replace(mega, "$1 000 000");
    texte = texte.replace(giga, "$1 000 000 000");
    texte = texte.replace(tera, "$1 000 000 000 000");

    let texteSplit = texte.split("{separateur}");
    // On regarde si il y a des chiffres dans le premier split
    let decalage = texteSplit[0].replace(RegExpToutSaufChiffre, "").length > 0 ? -1 : 1;

    let temp = "";
    for (let i = 0; i < texteSplit.length; i++) {
      for (let j = unite.length - 1; j >= 0; j--) {
        if (texteSplit[i].indexOf("unite" + j) >= 0) {
          if (texteSplit[i + decalage].indexOf("\t") < 0) {
            temp = parseInt(texteSplit[i + decalage].replace(RegExpToutSaufChiffre, ""));
            if (isNaN(temp)) temp = 0;
            this._unite[j] += temp;
          } else {
            let splitQuantite = texteSplit[i + decalage].split("\t");
            for (let k = 0; k < splitQuantite.length; k++) {
              temp = parseInt(splitQuantite[k].replace(RegExpToutSaufChiffre, ""), 10);
              if (isNaN(temp)) temp = 0;
              this._unite[j] += temp;
            }
          }
          break;
        }
      }
    }
    return this;
  }
  /**
   * calcul le nombre d'unité de l'armee.
   *
   * @method getSommeUnite
   * @return {Integer} la somme des unités
   */
  getSommeUnite() {
    return this._unite.reduce((acc, val) => {
      return acc + Math.ceil(val);
    }, 0);
  }
  /**
   * calcul le temps de ponte de l'armée en fonction de la vitesse de ponte.
   *
   * @private
   * @method getTemps
   * @param {Integer} vitesse de ponte
   * @return {Integer} nombre de secondes
   */
  getTemps(tdp) {
    return this._unite.reduce((acc, val, i) => {
      return acc + val * TEMPS_UNITE[i + 1] * Math.pow(0.9, tdp);
    }, 0);
  }
  /**
   * calcul le nombre de point de vie de base.
   *
   * @private
   * @method getBaseVie
   * @return {Integer} Points de vie hors bonus.
   */
  getBaseVie() {
    return this._unite.reduce((acc, val, i) => {
      return acc + val * VIE_UNITE[i + 1];
    }, 0);
  }
  /**
   * calcul le nombre de point de vie bonus.
   *
   * @private
   * @method getBonusVie
   * @param {Integer} bonus
   * @return {Integer} Points de vie avec bonus bouclier
   */
  getBonusVie(bonus) {
    return Math.round((this.getBaseVie() * bonus) / 10);
  }
  /**
   * calcul le nombre de point de vie bonus du lieu.
   *
   * @private
   * @method getBonusLieuVie
   * @param {Integer} bonus
   * @param {Integer} lieu
   * @return {Integer} Points de vie avec bonus bouclier et dome ou loge.
   */
  getBonusLieuVie(bonus, lieu) {
    if (lieu == LIEU.DOME) return Math.round(this.getBaseVie() * ((bonus + 2) / 20));
    if (lieu == LIEU.LOGE) return Math.round(this.getBaseVie() * (((bonus + 2) * 3) / 20));
    else return 0;
  }
  /**
   * calcul le nombre de point de vie total de l'armée.
   *
   * @private
   * @method getTotalVie
   * @param {Integer} bonus
   * @param {Integer} lieu
   * @param {Integer} bonusLieu
   * @return {Integer} Somme des points de vie de l'armée.
   */
  getTotalVie(bonus, lieu = LIEU.TERRAIN, bonusLieu = 0) {
    return this.getBaseVie() + this.getBonusVie(bonus) + this.getBonusLieuVie(bonusLieu, lieu);
  }
  /**
   *
   */
  getNonXpBaseVie() {
    let tabNonXp = [1, 2, 4, 5, 6, 8, 11, 13];
    return this._unite.reduce((acc, val, i) => {
      return tabNonXp.includes(i + 1) ? acc + val * VIE_UNITE[i + 1] : acc;
    }, 0);
  }
  /**
   *
   */
  getNonXPBonusVie(bonus) {
    return Math.round((this.getNonXpBaseVie() * bonus) / 10);
  }
  /**
   *
   */
  getNonXpTotalVie(bonus) {
    return this.getNonXpBaseVie() + this.getNonXPBonusVie(bonus);
  }
  /**
   * calcul le nombre de point d'attaque de base.
   *
   * @private
   * @method getBaseAtt
   * @return {Integer} Points de combat hors bonus.
   */
  getBaseAtt() {
    return this._unite.reduce((acc, val, i) => {
      return acc + val * ATT_UNITE[i + 1];
    }, 0);
  }
  /**
   * calcul le nombre de point d'attaque avec bonus.
   *
   * @private
   * @method getBonusAtt
   * @param {Integer} bonus
   * @return {Integer} Points de combat avec bonus.
   */
  getBonusAtt(bonus) {
    return Math.round((this.getBaseAtt() * bonus) / 10);
  }
  /**
   * calcul le nombre de point d'attaque total de l'armée.
   *
   * @private
   * @method getTotalAtt
   * @param {Integer} bonus
   * @return {Integer} Somme des points de combat de l'armée.
   */
  getTotalAtt(bonus) {
    return this.getBaseAtt() + this.getBonusAtt(bonus);
  }
  /**
   *
   */
  getNonXpBaseAtt() {
    let tabNonXp = [1, 2, 4, 5, 6, 8, 11, 13];
    return this._unite.reduce((acc, val, i) => {
      return tabNonXp.includes(i + 1) ? acc + val * ATT_UNITE[i + 1] : acc;
    }, 0);
  }
  /**
   *
   */
  getNonXPBonusAtt(bonus) {
    return Math.round((this.getNonXpBaseAtt() * bonus) / 10);
  }
  /**
   *
   */
  getNonXpTotalAtt(bonus) {
    return this.getNonXpBaseAtt() + this.getNonXPBonusAtt(bonus);
  }
  /**
   * calcul le nombre de point en défense de base.
   *
   * @private
   * @method getBaseDef
   * @return {Integer} Points de défense hors bonus.
   */
  getBaseDef() {
    return this._unite.reduce((acc, val, i) => {
      return acc + val * DEF_UNITE[i + 1];
    }, 0);
  }
  /**
   * calcul le nombre de point en défense avec bonus.
   *
   * @private
   * @method getBonusDef
   * @param {Integer} bonus
   * @return {Integer} Points de défense avec bonus.
   */
  getBonusDef(bonus) {
    return Math.round((this.getBaseDef() * bonus) / 10);
  }
  /**
   * calcul le nombre de point en défense total de l'armée.
   *
   * @private
   * @method getTotalDef
   * @param {Integer} bonus
   * @return {Integer} Somme des points de défense de l'armée.
   */
  getTotalDef(bonus) {
    return this.getBaseDef() + this.getBonusDef(bonus);
  }
  /**
   *
   */
  getNonXpBaseDef() {
    let tabNonXp = [1, 2, 4, 5, 6, 8, 11, 13];
    return this._unite.reduce((acc, val, i) => {
      return tabNonXp.includes(i + 1) ? acc + val * DEF_UNITE[i + 1] : acc;
    }, 0);
  }
  /**
   *
   */
  getNonXPBonusDef(bonus) {
    return Math.round((this.getNonXpBaseDef() * bonus) / 10);
  }
  /**
   *
   */
  getNonXpTotalDef(bonus) {
    return this.getNonXpBaseDef() + this.getNonXPBonusDef(bonus);
  }
  /**
   * calcul la consommation en nourriture de l'armée.
   *
   * @private
   * @method getConsommation
   * @param {Integer} lieu
   * @return {Integer} Consommation de l'armée.
   */
  getConsommation(lieu) {
    return this._unite.reduce((acc, val, i) => {
      return acc + val * COUT_UNITE[i + 1] * 0.05 * lieu;
    }, 0);
  }
  /**
   * Modifier le nombre de JSN de l'armée.
   *
   * @private
   * @method setJSN
   * @param {Integer} nbr
   * @return
   */
  setJSN(nbr) {
    this._unite[0] = this._nbrJSN - nbr;
  }

  /* ------------------------------------------------------------------ */
  /* ---- Méthode pour chasser ---------------------------------------- */
  /* ------------------------------------------------------------------ */

  /**
   * Salve d'après ce que le joueur fixe (SimulationChasse.resoudre), avec
   * l'armée et les niveaux du joueur ; mémorise la répartition pour l'envoi.
   *
   * @method resoudreChasse
   * @param {Object} p tout ce que SimulationChasse.resoudre attend ; sans
   *   unites, armes ou bouclier, ceux du joueur
   * @return {Object|null} le plan, { erreur } ou null
   */
  resoudreChasse(p) {
    let plan = SimulationChasse.resoudre({
      unites: this._unite,
      armes: monProfil.niveauRecherche[2],
      bouclier: monProfil.niveauRecherche[1],
      ...p,
    });
    this._repartition = plan && plan.chasses ? plan.chasses.map((c) => c.unites) : [];
    return plan;
  }
  /**
   * Champs du formulaire d'AcquerirTerrain.php pour une chasse. Le jeu numérote
   * ses unités dans son propre ordre, pas celui de NOM_UNITE utilisé par Armee.unite.
   *
   * @static
   * @method donneesChasse
   * @param {Integer} terrainChasse
   * @param {Array} unites nombre par unité, ordre d'Armee.unite
   * @param {String} securite jeton du formulaire, "nom=valeur"
   * @return {Object}
   */
  static donneesChasse(terrainChasse, unites, securite) {
    let donnees = {};
    donnees["" + securite.split("=")[0]] = securite.split("=")[1];
    donnees["ChoixArmee"] = "1";
    donnees["AcquerirTerrain"] = terrainChasse;
    [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 12, 13, 11, 6].forEach(
      (u, i) => (donnees["unite" + (i + 1)] = unites[u]),
    );
    return donnees;
  }
  /**
   * Lance une chasse avec un jeton de sécurité neuf : le jeu n'accepte chaque
   * jeton qu'une fois, réutiliser celui de la première chasse faisait refuser
   * toutes les suivantes. Résout le texte de la réponse ("" en cas d'échec).
   *
   * @static
   * @method posterChasse
   * @param {Integer} terrainChasse
   * @param {Array} unites nombre par unité, ordre d'Armee.unite
   * @return {Promise<String>}
   */
  static posterChasse(terrainChasse, unites) {
    return Promise.resolve($.ajax({ url: location.origin + "/AcquerirTerrain.php", cache: false }))
      .then((page) => {
        // id="t" est à la fois la table principale et l'input du jeton : on vise l'input
        let jeton = Utils.parseHtml(page).find("input[name='t']");
        if (!jeton.attr("name")) throw new Error("jeton introuvable");
        return $.post(
          location.origin + "/AcquerirTerrain.php",
          Armee.donneesChasse(
            terrainChasse,
            unites,
            jeton.attr("name") + "=" + jeton.attr("value"),
          ),
        );
      })
      .then((data) => String(data))
      .catch(() => "");
  }
  /**
   * Envoie une chasse.
   *
   * @method envoyerChasse
   * @param {Function} fin appelée à la fin (chasses lancées, demandées) ;
   *   par défaut, rechargement de la page
   * @param {Integer} indice
   */
  envoyerChasse(terrainChasse, nbChasse, indice, intervalle, fin = () => location.reload()) {
    if (indice < nbChasse) {
      Armee.posterChasse(terrainChasse, this._repartition[indice]).then((data) => {
        if (data.indexOf("La chasse est lancée.") > -1) {
          TroupesDehors.enregistrerChasse(this._repartition[indice]);
          $("#o_simulationChasse tr:eq(" + (indice + 1) + ")").html(
            `<td class='green'>${indice + 1}</td><td colspan='14' class='green'>La chasse est lancée.</td>`,
          );
          setTimeout(() => {
            this.envoyerChasse(terrainChasse, nbChasse, ++indice, intervalle, fin);
          }, intervalle);
        } else {
          // refusée (plus de place, d'unités…) : les suivantes le seraient aussi
          $("#o_simulationChasse tr:eq(" + (indice + 1) + ")").html(
            `<td class='red'>${indice + 1}</td><td colspan='14' class='red'>La chasse n'a pas pu être lancée.</td>`,
          );
          fin(indice, nbChasse);
        }
      });
    } else fin(nbChasse, nbChasse);
  }

  /* ------------------------------------------------------------------ */
  /* ---- Méthode pour Flooder ---------------------------------------- */
  /* ------------------------------------------------------------------ */

  /**
   *
   */
  placeAntisonde(donneesFlood) {
    // au plus les unités disponibles : la réserve ne part pas
    let envoi = Math.min(donneesFlood.attaques[0] || 0, Math.max(0, donneesFlood.unite));
    if (envoi) {
      let priseMax = Math.floor(donneesFlood.tdcCible * 0.2);
      priseMax = envoi > priseMax ? priseMax : envoi;
      donneesFlood.tdcAtt += priseMax;
      donneesFlood.tdcCible -= priseMax;
      donneesFlood.unite -= envoi;
      donneesFlood.reste--;
    }
    // on place l'antisonde quand même pour garder l'ordre
    this._floods.push(envoi);
  }
  /**
   *
   */
  standardFlood(donneesFlood) {
    let prise = 0,
      priseMax = 0;
    for (let i = 1; i < donneesFlood.attaques.length; i++) {
      prise =
        donneesFlood.unite >= donneesFlood.attaques[i]
          ? donneesFlood.attaques[i]
          : donneesFlood.unite;
      priseMax = Math.floor(donneesFlood.tdcCible * 0.2);
      priseMax = prise > priseMax ? priseMax : prise;
      this._floods.push(prise);
      donneesFlood.tdcAtt += priseMax;
      donneesFlood.tdcCible -= priseMax;
      donneesFlood.unite -= prise;
      donneesFlood.reste--;
      if (donneesFlood.unite <= 0 || donneesFlood.reste == 0) break;
    }
  }
  /**
   * Optimisation de la prise de terrain sur une cible en fonction du nombre d'unité et du nombre d'attaque.
   *
   * @private
   * @method optimiserFlood
   * @param {Integer} tdcAtt
   * @param {Integer} tdcCible
   * @param {Integer} unite
   * @param {Integer} reste
   */
  optimiserFlood(donneesFlood) {
    let prise = 0;
    // -20% -20% -20%
    while (
      donneesFlood.tdcAtt < Math.floor(donneesFlood.tdcCible * 1.4) &&
      donneesFlood.reste > 0
    ) {
      prise = Math.floor(donneesFlood.tdcCible * 0.2);
      prise = donneesFlood.unite >= prise ? prise : donneesFlood.unite;
      this._floods.push(prise);
      donneesFlood.tdcAtt += prise;
      donneesFlood.tdcCible -= prise;
      donneesFlood.unite -= prise;
      donneesFlood.reste--;
      if (donneesFlood.unite <= 0) return;
    }
    // attaque « limite » : prend le plus possible en laissant la cible à la
    // moitié de mon terrain, encore à portée (Utils.aPortee) pour la dernière.
    // Inutile si elle y est déjà (0 unité), ou si le reste ne dépasse pas
    // 20 % : tout envoyer d'un coup prend alors autant
    let limite = Math.floor((donneesFlood.tdcCible * 2 - donneesFlood.tdcAtt) / 3);
    if (
      donneesFlood.reste > 1 &&
      limite > 0 &&
      donneesFlood.unite > Math.floor(donneesFlood.tdcCible * 0.2)
    ) {
      limite = Math.min(limite, donneesFlood.unite);
      this._floods.push(limite);
      donneesFlood.tdcAtt += limite;
      donneesFlood.tdcCible -= limite;
      donneesFlood.unite -= limite;
      donneesFlood.reste--;
      if (donneesFlood.unite <= 0) return;
    }
    if (donneesFlood.reste > 0) {
      // dernier
      prise = Math.floor(donneesFlood.tdcCible * 0.2);
      prise = donneesFlood.unite >= prise ? prise : donneesFlood.unite;
      this._floods.push(prise);
      donneesFlood.tdcAtt += prise;
      donneesFlood.tdcCible -= prise;
      donneesFlood.unite -= prise;
      donneesFlood.reste--;
    }
  }
  /**
   * 1re attaque : valeur saisie, sinon `base` % du TdC de la cible ; suivantes :
   * même part du TdC restant, ou `ecart` (5) points de % du TdC de départ en moins.
   */
  degressifFlood(donneesFlood) {
    let d = { base: 20, regle: "restant", ecart: 5, premiere: null, ...donneesFlood.degressif },
      depart = donneesFlood.tdcCible,
      premiere = d.premiere > 0 ? d.premiere : Math.floor((depart * d.base) / 100),
      part = d.premiere > 0 ? d.premiere / depart : d.base / 100,
      pas = (depart * d.ecart) / 100,
      nbFlood = donneesFlood.reste;
    for (let i = 0; i < nbFlood; i++) {
      let voulu =
        d.regle == "ecart"
          ? Math.floor(premiere - i * pas)
          : i == 0 && d.premiere > 0
            ? premiere
            : Math.floor(donneesFlood.tdcCible * part);
      if (d.regle == "ecart" && voulu <= 0) break;
      let prise = Math.min(voulu, donneesFlood.unite),
        // le jeu ne prend jamais plus de 20 % du TdC de la cible
        gain = Math.min(prise, Math.floor(donneesFlood.tdcCible * 0.2));
      this._floods.push(prise);
      donneesFlood.tdcAtt += gain;
      donneesFlood.tdcCible -= gain;
      donneesFlood.unite -= prise;
      donneesFlood.reste--;
      if (donneesFlood.unite <= 0) break;
    }
  }
  /**
   *
   */
  uniformeFlood(donneesFlood) {
    let prise = 0,
      priseMax = 0,
      nbFlood = donneesFlood.reste;
    for (let i = 0; i < nbFlood; i++) {
      prise =
        donneesFlood.unite >= donneesFlood.tdcUniforme
          ? donneesFlood.tdcUniforme
          : donneesFlood.unite;
      priseMax = Math.floor(donneesFlood.tdcCible * 0.2);
      priseMax = prise > priseMax ? priseMax : prise;
      this._floods.push(prise);
      donneesFlood.tdcAtt += priseMax;
      donneesFlood.tdcCible -= priseMax;
      donneesFlood.unite -= prise;
      donneesFlood.reste--;
      if (donneesFlood.unite <= 0) break;
    }
  }
  /**
   * Unités que le flood peut envoyer, par type. Les unités gardées restent à
   * la maison : les antisondes si elles sont gardées (unités de l'onglet
   * Armée), plus chaque ligne d'autres unités. Une unité choisie : au plus ce
   * que l'armée en a, sans compléter avec d'autres ; une ligne « dernières
   * unités de l'armée » : prises en bas de l'armée, après les unités choisies.
   *
   * @method disponibleFlood
   * @return {Array<Number>} nombre par type, dans l'ordre de Armee.unite
   */
  disponibleFlood() {
    let p = monProfil.parametre,
      g = this._gardees || Armee.gardeesParDefaut(),
      dispo = this._unite.map((n) => Math.ceil(n) || 0),
      // comme le replacement de la page Armée : l'unité choisie si l'armée en a,
      // sinon la première disponible
      uniteAntisonde = (cle) => {
        let i = (parseInt(p[cle].valeur) || 0) - 1;
        return i >= 0 && dispo[i] ? i : dispo.findIndex((n) => n > 0);
      },
      gardes = [
        ...(g.antisondes
          ? [
              [uniteAntisonde("uniteAntisondeTerrainType"), p["uniteAntisondeTerrain"].valeur],
              [uniteAntisonde("uniteAntisondeDomeType"), p["uniteAntisondeDome"].valeur],
            ]
          : []),
        ...g.autres.map((ligne) => [ligne.unite - 1, ligne.nombre]),
      ],
      reste = gardes.reduce(
        (somme, [i, nombre]) => somme + (i < 0 ? Math.max(0, nombre || 0) : 0),
        0,
      );
    gardes.forEach(([i, nombre]) => {
      if (i >= 0) dispo[i] -= Math.min(dispo[i], Math.max(0, nombre || 0));
    });
    for (let i = dispo.length - 1; i >= 0 && reste > 0; i--) {
      let garde = Math.min(dispo[i], reste);
      dispo[i] -= garde;
      reste -= garde;
    }
    return dispo;
  }
  /**
   * @method gardeesFlood
   * @return {Array<Number>} unités gardées au flood par type (voir disponibleFlood)
   */
  gardeesFlood() {
    let dispo = this.disponibleFlood();
    return this._unite.map((n, i) => (Math.ceil(n) || 0) - dispo[i]);
  }
  /**
   * @static
   * @method texteGardees
   * @param {Array<Number>} gardees nombre par type, dans l'ordre de Armee.unite
   * @return {String} « 1 Jeune Soldate Naine, 1 000 Tanks », ou « aucune »
   */
  static texteGardees(gardees) {
    let liste = gardees
      .map((n, i) =>
        n > 0 ? `${numeral(n).format()} ${n > 1 ? NOM_UNITES[i + 1] : NOM_UNITE[i + 1]}` : "",
      )
      .filter(Boolean);
    return liste.length ? liste.join(", ") : "aucune";
  }
  /**
   * Répartit les unités sur les floods prévus, en prenant les premières unités
   * de l'armée d'abord.
   *
   * @method repartirUniteFlood
   * @param {Array<Number>} [disponibles] unités utilisables par type, toute l'armée par défaut
   */
  repartirUniteFlood(disponibles = this._unite) {
    this._repartition = new Array();
    let iTabAvailableUnits = disponibles.slice(),
      floods = this._floods.slice();
    floods.forEach((f, i, tabFloods) => {
      this._repartition[i] = new Array(14).fill(0);
      iTabAvailableUnits.forEach((unite, j, tabUnite) => {
        if (unite) {
          this._repartition[i][j] = tabUnite[j] >= tabFloods[i] ? tabFloods[i] : tabUnite[j];
          tabFloods[i] -= this._repartition[i][j];
          tabUnite[j] -= this._repartition[i][j];
          if (!tabFloods[i]) return false;
        }
      });
    });
  }
  /**
   * Simule le placement des unités pour une methode de flood choisie.
   *
   * @private
   * @method calculeFlood
   */
  simulerFlood(tdcAtt, tdcCible, methode, attaques, tdcUniforme, reste, indSupp, degressif = null) {
    this._floods = new Array();
    let dispo = this.disponibleFlood(),
      ligneReste = parseInt(indSupp);
    // on a besoin d'un objet pour le passer au différentes fonctions
    let data = {
      attaques: attaques,
      tdcUniforme: tdcUniforme,
      tdcAtt: tdcAtt,
      tdcCible: tdcCible,
      unite: dispo.reduce((somme, n) => somme + n, 0),
      reste: reste,
      degressif: degressif,
    };
    // Placement de l'antisonde
    this.placeAntisonde(data);
    if (data.unite <= 0) {
      // refaite quand même : sinon le clic enverrait celle d'une simulation précédente
      this.repartirUniteFlood(dispo);
      return this._floods;
    }
    // Placement selon la méthode
    switch (methode) {
      case "0": // defini manuellement
        this.standardFlood(data);
        break;
      case "1": // Opti
        this.optimiserFlood(data);
        break;
      case "2": // uniforme
        this.uniformeFlood(data);
        break;
      case "3": // Degressive
        this.degressifFlood(data);
        break;
      default:
        break;
    }
    // « Reste » : sur la ligne cochée, même au-delà des attaques calculées
    // (écart fixe arrivé à 0 %, méthode Optimisée)
    if (ligneReste >= 0 && data.unite > 0) {
      while (this._floods.length <= ligneReste) this._floods.push(0);
      this._floods[ligneReste] += data.unite;
    }
    // des qu'on simule on prepare la repartition des unités pour le lancement
    this.repartirUniteFlood(dispo);
    return this._floods;
  }
  /**
   * Envoie un flood.
   *
   * @private
   * @method envoyerFlood
   * @param {Integer} indice
   * @param {String} securite
   */
  envoyerFlood(idCible, indice, securite) {
    // unités de chaque attaque refaites au départ, avec les unités gardées
    // actuelles : même une simulation ancienne n'enverrait pas d'unité gardée
    if (indice == 0) this.repartirUniteFlood(this.disponibleFlood());
    // si on a encore des attaques à lancer
    if (indice < this._floods.length) {
      // une attaque sans unité n'est pas envoyée (plus d'unité disponible)
      if (this._floods[indice] && this._repartition[indice].some((n) => n > 0)) {
        let donnees = {};
        donnees["" + securite.split("=")[0]] = securite.split("=")[1];
        donnees["ChoixArmee"] = "1";
        donnees["lieu"] = "1"; //$("input[name=o_domeFlood]:checked").val() == "Oui" ? "2" : "1";
        donnees["pseudoCible"] = $("input[name=pseudoCible]").val();
        donnees["unite1"] = this._repartition[indice][0];
        donnees["unite2"] = this._repartition[indice][1];
        donnees["unite3"] = this._repartition[indice][2];
        donnees["unite4"] = this._repartition[indice][3];
        donnees["unite5"] = this._repartition[indice][4];
        donnees["unite6"] = this._repartition[indice][5];
        donnees["unite7"] = this._repartition[indice][7];
        donnees["unite8"] = this._repartition[indice][8];
        donnees["unite9"] = this._repartition[indice][9];
        donnees["unite10"] = this._repartition[indice][10];
        donnees["unite11"] = this._repartition[indice][12];
        donnees["unite12"] = this._repartition[indice][13];
        donnees["unite13"] = this._repartition[indice][11];
        donnees["unite14"] = this._repartition[indice][6];
        // Requete
        $.post(location.origin + "/ennemie.php?Attaquer=" + idCible, donnees, (data) => {
          let res = Utils.parseHtml(data).find("center:last").text();
          $("#o_simulationFlood tr:eq(" + (indice + 2) + ")").addClass(
            res.indexOf("Vos troupes sont en marche") == -1 ? "red" : "green",
          );
          // capture de l'attaque confirmée pour le récapitulatif par cible
          // (lieu toujours le terrain : le flood envoie lieu=1)
          if (res.indexOf("Vos troupes sont en marche") != -1 && AttaqueLancee.contexteFlood) {
            let unite = {};
            this._repartition[indice].forEach((nb, ind) => {
              if (nb) unite[NOM_UNITE[ind + 1]] = nb;
            });
            AttaqueLancee.enregistrer(
              AttaqueLancee.contexteFlood.cible,
              "Terrain de chasse",
              unite,
              {
                html: data,
                terrain: AttaqueLancee.contexteFlood.terrain,
                partager: AttaqueLancee.contexteFlood.partager,
              },
            );
          }
          setTimeout(() => {
            this.envoyerFlood(idCible, ++indice, securite);
          }, 1000);
        }).fail(() => {
          // pas de réponse (réseau, jeu occupé) : on s'arrête, sans renvoyer
          // une attaque peut-être déjà partie
          $("#o_simulationFlood tr:eq(" + (indice + 2) + ")").addClass("red");
          $("#o_lanceFlood").text("Flood interrompu");
          $.toast({
            ...TOAST_ERROR,
            hideAfter: false,
            text: `Flood interrompu à l'attaque ${indice + 1} : le jeu n'a pas répondu. Vérifie tes attaques en cours avant de relancer.`,
          });
        });
      } else // on passe à l'attaque suivante
      this.envoyerFlood(idCible, ++indice, securite);
    } else {
      // Fin du flood : on enchaîne sur Armee.php pour replacer l'antisonde
      // (PageArmee détecte ce flag et appelle replacerArmee() automatiquement).
      sessionStorage.setItem("outiiil_floodPuisReplacer", "1");
      location = "/Armee.php";
    }
  }

  /* ------------------------------------------------------------------ */
  /* ---- Méthode pour les combats ------------------------------------ */
  /* ------------------------------------------------------------------ */

  /**
   *
   */
  retirerPerte(nbUnite) {
    // Tant que le total n'est pas 0 on retire les unites
    this._unite.every((elt, ind) => {
      if (elt >= nbUnite) {
        this._unite[ind] -= nbUnite;
        return false;
      } else {
        nbUnite -= elt;
        this._unite[ind] = 0;
        return true;
      }
    });
    return this;
  }
}
