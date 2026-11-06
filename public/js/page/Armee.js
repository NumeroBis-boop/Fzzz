/*
 * Armee.js
 * Hraesvelg
 **********************************************************************/

/**
 * Classe de fonction pour la page /Armee.php.
 *
 * @class PageArmee
 * @constructor
 */
// valeurs des lieux dans le formulaire « Déplacer » du jeu
const LIEU_ARMEE = { TERRAIN: 1, DOME: 2, LOGE: 3 };
// numéro du jeu (uniteN) de chaque unité, dans l'ordre d'Armee.unite
const CHOIX_UNITE_JEU = [1, 2, 3, 4, 5, 6, 14, 7, 8, 9, 10, 13, 11, 12];

class PageArmee {
  constructor(boiteComptePlus) {
    /**
     * Accés à la boite compte+
     */
    this._boiteComptePlus = boiteComptePlus;
    /**
     * Armée sur le terrain.
     *
     * @private
     * @property armeeTdc
     * @type Class
     */
    this._armeeTdc = null;
    /**
     * Armée en dome.
     *
     * @private
     * @property armeeDome
     * @type Class
     */
    this._armeeDome = null;
    /**
     * Armée en loge.
     *
     * @private
     * @property armeeLoge
     * @type Class
     */
    this._armeeLoge = null;
    /**
     * Nombre d'attaque en cours.
     *
     * @private
     * @property nbAttaque
     * @type Integer
     */
    this._nbAttaque =
      $("#centre")
        .text()
        .split(/- Vous allez attaquer|- Des renforts arrivent/g).length - 1;
  }
  /**
   *
   */
  executer() {
    this.recupereArmeeTdc();
    this.recupereArmeeDome();
    this.recupereArmeeLoge();
    // Fzzz : floods partagés en cours sur le joueur
    PartageChasses.afficherArmee();
    // Affichage du nombre d'attaque restante
    $("h3:eq(2)").append(
      ` ${this._nbAttaque}, reste : ${monProfil.niveauRecherche[6] + 1 - this._nbAttaque}.</p>`,
    );
    // Affichage du nombre total d'unité
    $("h3:first").append(
      ` (${numeral(this._armeeTdc.getSommeUnite() + this._armeeDome.getSommeUnite() + this._armeeLoge.getSommeUnite()).format()})</p>`,
    );
    // Bouton antisonde
    $(".simulateur:not(.o_blocAttaques):first tr:eq(0)").after(
      `<tr><td colspan="10" class='right'><button id='o_replaceArmee' class='o_button f_success'>Replacer l'armée</button></td></tr>`,
    );
    $("#o_replaceArmee").click(() => {
      this.replacerArmee();
      return false;
    });

    if (!Utils.comptePlus) this.plus();
    AttaqueLancee.afficherTableaux();
    // Affichage du temps Hof de votre armée
    $(".simulateur:not(.o_blocAttaques):first").append(
      "<tr class='o_ligneHof'><td colspan=10>Temps <span class='gras' title='Hall Of Fame' >HOF : " +
        Utils.shortcutTime(
          this._armeeTdc.getTemps(0) + this._armeeDome.getTemps(0) + this._armeeLoge.getTemps(0),
        ) +
        "</span>, Temps relatif : <span class='gras'>" +
        Utils.shortcutTime(
          this._armeeTdc.getTemps(monProfil.getTDP()) +
            this._armeeDome.getTemps(monProfil.getTDP()) +
            this._armeeLoge.getTemps(monProfil.getTDP()),
        ) +
        "</span></td></tr>",
    );
    // Affichage des statistiques detaillés
    this.afficherStatistique();
    this.alleger();
    // Auto-replacer : déclenché en sortie de flood (flag sessionStorage) ou par le param utilisateur.
    let floodFlag = sessionStorage.getItem("outiiil_floodPuisReplacer") === "1";
    if (floodFlag) sessionStorage.removeItem("outiiil_floodPuisReplacer");
    // Fin de flood : le replacement fait partie de l'enchaînement lancé par le
    // clic du joueur. L'option « Replacer l'armée automatiquement » ne peut en
    // revanche rien envoyer à la simple ouverture de la page (règlement du s5) :
    // elle met en évidence le bouton de replacement, le joueur clique.
    // rechargement après un clic (Annuler, transfert…) : même position à l'écran
    Utils.garderPosition("fzzz_positionArmee");
    // fin de flood : le replacement attend que le partage des floods
    // (« Flooder + partager ») soit écrit dans le forum
    if (floodFlag)
      Promise.resolve(AttaqueLancee.partageEnCours)
        .catch(() => {})
        .then(() => this.replacerArmee(true));
    else if (
      monProfil.parametre["replacerArmeeAuto"].valeur &&
      this.uniteTransferables() &&
      this.placementPrevu()
    ) {
      $("#o_replaceArmee").addClass("o_synchroPret");
      $.toast({
        ...TOAST_INFO,
        text: "Armée à replacer : clique sur le bouton de replacement mis en évidence.",
      });
    }
    return this;
  }
  /**
   * Initialise l'armée en terrain de chasse.
   *
   * @private
   * @method getArmeeTdc
   */
  recupereArmeeTdc() {
    let unites = {};
    $(".simulateur tr[align=center]:lt(14)").each((i, elt) => {
      let unite = $(elt).find(".pas_sur_telephone").text(),
        nbr = numeral($(elt).find("td:nth-child(3) span").text()).value();
      if (unite && nbr) unites[unite] = nbr;
    });
    this._armeeTdc = new Armee({ unite: unites });
  }
  /**
   * Initialise l'armée en dome.
   *
   * @private
   * @method getArmeeDome
   */
  recupereArmeeDome() {
    let unites = {};
    $(".simulateur tr[align=center]:lt(14)").each((i, elt) => {
      let unite = $(elt).find(".pas_sur_telephone").text();
      $(elt)
        .find("td")
        .slice(3, $(elt).find("td").length - 2)
        .each((i2, elt2) => {
          let nbr = numeral($(elt2).text()).value();
          if (unite && nbr) unites[unite] = nbr;
        });
    });
    this._armeeDome = new Armee({ unite: unites });
  }
  /**
   * Initialise l'armée en loge.
   *
   * @private
   * @method getArmeeLoge
   */
  recupereArmeeLoge() {
    let unites = {};
    $(".simulateur tr[align=center]:lt(14)").each((i, elt) => {
      let unite = $(elt).find(".pas_sur_telephone").text(),
        nbr = numeral($(elt).find("td:nth-last-child(2)").text()).value();
      if (unite && nbr) unites[unite] = nbr;
    });
    this._armeeLoge = new Armee({ unite: unites });
  }
  /**
   * Replace l'armée : tout en loge (flèche « Tout déplacer ici » de la loge),
   * puis les antisondes de la loge vers le terrain et vers le dôme, avec
   * l'unité choisie dans les préférences. Requêtes du formulaire « Déplacer »
   * du jeu, sans recharger la page : le tableau est mis à jour avec la réponse.
   * Quand auto=true (en sortie de flood, enchaîné au clic du joueur),
   * les toasts informatifs sont supprimés pour ne pas spammer à chaque visite.
   */
  replacerArmee(auto = false) {
    if (!this.uniteTransferables()) {
      if (!auto) $.toast({ ...TOAST_ERROR, text: "Aucune unité n'est transférable." });
      return this;
    }
    let placer = this.placementPrevu();
    if (placer) this.lancerReplacement(placer);
    else if (!auto) $.toast({ ...TOAST_INFO, text: "Votre armée est déjà placée correctement." });
    return this;
  }
  /**
   * @method uniteTransferables
   * @return {Integer} unités en loge, dôme et terrain
   */
  uniteTransferables() {
    return (
      this._armeeLoge.getSommeUnite() +
      this._armeeDome.getSommeUnite() +
      this._armeeTdc.getSommeUnite()
    );
  }
  /**
   * Replacement à faire pour respecter les bornes d'antisonde des paramètres,
   * ou null si l'armée est déjà bien placée. N'envoie rien.
   *
   * @method placementPrevu
   * @return {Function|null}
   */
  placementPrevu() {
    let iT = this.indiceUnite("uniteAntisondeTerrainType"),
      iD = this.indiceUnite("uniteAntisondeDomeType");
    if (iT == -1) return null;
    let total = (k) =>
        this._armeeLoge.unite[k] + this._armeeDome.unite[k] + this._armeeTdc.unite[k],
      terrain = monProfil.parametre["uniteAntisondeTerrain"].valeur,
      dome = monProfil.parametre["uniteAntisondeDome"].valeur,
      tirerT = true,
      tirerD = true;
    if (iT == iD) {
      // même unité, pas assez pour les deux antisondes : 1 en terrain, le
      // reste en dôme dans la limite de son maximum
      if (total(iT) < terrain + dome) {
        terrain = Math.min(1, terrain);
        dome = Math.max(0, Math.min(dome, total(iT) - terrain));
        tirerT = tirerD = false;
      }
    } else {
      // unités différentes : chaque lieu au plus ce que l'armée a de son unité
      if (total(iT) < terrain) [terrain, tirerT] = [total(iT), false];
      if (total(iD) < dome) [dome, tirerD] = [total(iD), false];
    }
    if (this.estPlacePourAntiSonde(iT, terrain, iD, dome)) return null;
    let t0 = this._armeeTdc.unite[iT],
      d0 = this._armeeDome.unite[iD],
      dans = (n, max) => n <= max && n >= max * 0.9,
      autres =
        this._armeeTdc.unite.some((n, k) => n > 0 && k != iT) ||
        this._armeeDome.unite.some((n, k) => n > 0 && k != iD),
      t = !autres && dans(t0, terrain) ? t0 : tirerT ? PageArmee.tirer(terrain) : terrain,
      d = !autres && dans(d0, dome) ? d0 : tirerD ? PageArmee.tirer(dome) : dome;
    // d'autres unités hors de la loge : tout en loge, puis les antisondes
    if (autres)
      return () =>
        this.replacer(iT, t, iD, d, [
          { toutEnLoge: true },
          { i: iT, de: LIEU_ARMEE.LOGE, vers: LIEU_ARMEE.TERRAIN, nb: t },
          { i: iD, de: LIEU_ARMEE.LOGE, vers: LIEU_ARMEE.DOME, nb: d },
        ]);
    // seules les antisondes sont dehors : on ne déplace que la différence, et
    // rien pour un lieu déjà dans ses bornes (90 % à 100 % du maximum)
    let ecart = (i, lieu, avant, apres) =>
        apres < avant
          ? { i, de: lieu, vers: LIEU_ARMEE.LOGE, nb: avant - apres }
          : { i, de: LIEU_ARMEE.LOGE, vers: lieu, nb: apres - avant },
      etapes = [ecart(iT, LIEU_ARMEE.TERRAIN, t0, t), ecart(iD, LIEU_ARMEE.DOME, d0, d)]
        // les retours en loge d'abord : la loge a alors de quoi fournir l'autre lieu
        .sort((x, y) => (y.vers == LIEU_ARMEE.LOGE) - (x.vers == LIEU_ARMEE.LOGE));
    return () => this.replacer(iT, t, iD, d, etapes);
  }
  /**
   * Nombre tiré entre 90 % du maximum et le maximum (antisonde moins prévisible).
   *
   * @static
   * @method tirer
   * @param {Number} max
   * @return {Number}
   */
  static tirer(max) {
    return Math.round(max * 0.9 + Math.random() * max * 0.1);
  }
  /**
   * Un transfert du replacement n'a pas eu de réponse (réseau, jeu occupé) :
   * on s'arrête et on recharge la page Armée pour afficher l'état réel.
   *
   * @method echecReplacement
   */
  echecReplacement() {
    if (this._echecReplacement) return;
    this._echecReplacement = true;
    $.toast({
      ...TOAST_ERROR,
      text: "Replacement interrompu : le jeu n'a pas répondu. La page Armée va être rechargée.",
    });
    setTimeout(() => (location = "/Armee.php"), 2500);
  }
  /**
   * Un seul replacement à la fois : un double clic (ou un clic pendant le
   * replacement automatique) déplaçait les troupes deux fois.
   *
   * @private
   * @method lancerReplacement
   * @param {Function} placer renvoie une promesse
   */
  lancerReplacement(placer) {
    if (this._replacementEnCours) return;
    this._replacementEnCours = true;
    $("#o_replaceArmee").prop("disabled", true).removeClass("o_synchroPret").text("Replacement…");
    Promise.resolve(placer()).finally(() => {
      this._replacementEnCours = false;
      $("#o_replaceArmee").prop("disabled", false).text("Replacer l'armée");
    });
  }
  /**
   *
   */
  indicePremiereUnite() {
    // on trouve d'abord la premiere unite dispo c'est elle qui sert d'antisonde
    for (let i = 0; i < this._armeeTdc.unite.length; i++)
      if (this._armeeTdc.unite[i] + this._armeeDome.unite[i] + this._armeeLoge.unite[i]) return i;
    return -1;
  }
  /**
   * Unité d'une antisonde : celle des préférences si l'armée en a, sinon la
   * première disponible.
   *
   * @method indiceUnite
   * @param {String} cle réglage « uniteAntisondeTerrainType » ou « uniteAntisondeDomeType »
   * @return {Integer} indice dans Armee.unite, -1 si l'armée est vide
   */
  indiceUnite(cle) {
    let i = (parseInt(monProfil.parametre[cle].valeur) || 0) - 1;
    return i >= 0 && this._armeeTdc.unite[i] + this._armeeDome.unite[i] + this._armeeLoge.unite[i]
      ? i
      : this.indicePremiereUnite();
  }
  /**
   * Armée bien placée : seulement l'unité `iT` en terrain et `iD` en dôme,
   * chacune entre 90 % et 100 % de son nombre prévu.
   *
   * @method estPlacePourAntiSonde
   * @return {Boolean}
   */
  estPlacePourAntiSonde(iT, terrain, iD, dome) {
    if (iT == -1) return false;
    let dans = (n, max) => n <= max && n >= max * 0.9;
    return (
      this._armeeTdc.unite.every((n, k) => !n || k == iT) &&
      this._armeeDome.unite.every((n, k) => !n || k == iD) &&
      dans(this._armeeTdc.unite[iT], terrain) &&
      dans(this._armeeDome.unite[iD], dome)
    );
  }
  /**
   * Valeur de l'unité dans la liste « Déplacer » du jeu (unite1…unite14,
   * numérotation du jeu différente de l'ordre des unités).
   *
   * @static
   * @method valeurUnite
   * @param {Integer} i indice dans Armee.unite
   * @return {String}
   */
  static valeurUnite(i) {
    let option = $("#ChoixUnite option").filter((k, o) => o.textContent.trim() == NOM_UNITE[i + 1]);
    return option.length ? option.val() : "unite" + CHOIX_UNITE_JEU[i];
  }
  /**
   * Déplacements du formulaire « Déplacer » du jeu, l'un après l'autre, pour
   * finir avec `terrain` unités d'indice `iT` en terrain et `dome` unités
   * d'indice `iD` en dôme ; tableau de la garnison remplacé par celui de la
   * dernière réponse.
   *
   * @method replacer
   * @param {Integer} iT indice dans Armee.unite de l'antisonde en terrain
   * @param {Integer} terrain unités attendues en terrain à la fin
   * @param {Integer} iD indice dans Armee.unite de l'antisonde en dôme
   * @param {Integer} dome unités attendues en dôme à la fin
   * @param {Array<Object>} deplacements {toutEnLoge: true} ou {i, de, vers, nb}
   * @return {Promise}
   */
  replacer(iT, terrain, iD, dome, deplacements) {
    let jeton = () => ({ [$("#t").attr("name")]: $("#t").val() }),
      reponse = null,
      etapes = deplacements
        .filter((e) => e.toutEnLoge || e.nb > 0)
        .map((e) =>
          e.toutEnLoge
            ? () => $.get("/Armee.php", { deplacement: LIEU_ARMEE.LOGE, ...jeton() })
            : () =>
                $.post("/Armee.php", {
                  ...jeton(),
                  nbTroupes: e.nb,
                  ChoixUnite: PageArmee.valeurUnite(e.i),
                  LieuOrigine: e.de,
                  LieuDestination: e.vers,
                  Transferer: "Envoyer",
                }),
        );
    if (!etapes.length) return Promise.resolve();
    return etapes
      .reduce(
        (suite, etape) =>
          suite.then(() =>
            Promise.resolve(etape()).then((html) => {
              reponse = html;
              // jeton du formulaire renouvelé par le jeu : repris pour la suite
              let nouveau = Utils.parseHtml(html).find("#t").val();
              if (nouveau) $("#t").val(nouveau);
            }),
          ),
        Promise.resolve(),
      )
      .then(() => {
        if (!this.remplacerGarnison(reponse)) {
          location = "/Armee.php";
          return;
        }
        let place =
          this._armeeTdc.unite[iT] == terrain &&
          this._armeeDome.unite[iD] == dome &&
          this.uniteTransferables() == this._armeeLoge.getSommeUnite() + terrain + dome;
        $.toast(
          place
            ? {
                ...TOAST_SUCCESS,
                text: `Armée replacée : ${numeral(terrain).format()} ${NOM_UNITE[iT + 1]} en TdC, ${numeral(dome).format()} ${NOM_UNITE[iD + 1]} en dôme, le reste en loge.`,
              }
            : {
                ...TOAST_WARNING,
                text: "Le jeu n'a pas déplacé l'armée comme prévu : vérifie le tableau.",
              },
        );
      })
      .catch(() => this.echecReplacement());
  }
  /**
   * Remplace le tableau de la garnison par celui d'une page Armée reçue, et
   * refait ce que l'extension y ajoute. Les lignes de l'extension qui ne
   * dépendent pas du lieu (bouton, temps HOF, statistiques) sont reprises.
   *
   * @method remplacerGarnison
   * @param {String} html page Armee.php
   * @return {Boolean} false si la réponse n'a pas de tableau de garnison
   */
  remplacerGarnison(html) {
    let $nouvelle = Utils.parseHtml(html || "")
        .find("table.simulateur")
        .filter((k, t) => /Troupes en Garnison/.test(t.textContent))
        .first(),
      $actuelle = $(".simulateur:not(.o_blocAttaques):first");
    if (!$nouvelle.length || !$actuelle.length) return false;
    let $bouton = $("#o_replaceArmee").closest("tr").detach(),
      $hof = $actuelle.find(".o_ligneHof").detach(),
      $stat = $("#o_statArmee").closest("tr").detach();
    $nouvelle = $(document.importNode($nouvelle[0], true)).addClass("o_blocArmee");
    $actuelle.replaceWith($nouvelle);
    $nouvelle.find("tr:eq(0)").after($bouton);
    $nouvelle.append($hof, $stat);
    this.recupereArmeeTdc();
    this.recupereArmeeDome();
    this.recupereArmeeLoge();
    $nouvelle.find("h3:first").append(` (${numeral(this.uniteTransferables()).format()})`);
    if (!Utils.comptePlus) this.flechesEtLignes();
    this.libellesCourts((n) => $nouvelle[0].contains(n));
    PageArmee.calerLargeurs();
    return true;
  }
  /**
   * Ajoute les fonctionnalités du compte+. Affiche les infos sur l'armée et les fléches dans le tableau des unités.
   *
   * @private
   * @method plus
   */
  plus() {
    this.flechesEtLignes();
    // Affichage de l'arrivée + sauvegarde des attaques en cours
    let listeAttaque = AttaqueLancee.enrichirLignes();
    // Verification si les données sont deja enregistré
    this.saveAttaque(listeAttaque);
  }
  /**
   * Hors Compte+ : flèches de déplacement et lignes vie, attaque, défense et
   * consommation par lieu, dans le tableau de la garnison.
   *
   * @private
   * @method flechesEtLignes
   */
  flechesEtLignes() {
    $(".simulateur:not(.o_blocAttaques) td").each((i, elt) => {
      if (/^[0-9,]+$/.test($(elt).text().replace(/ /g, ""))) {
        let info = $(elt).find("span").attr("id").replace(/\(|\)/g, "");
        let nbUnit = info.split(",")[0],
          nomUnit = info.split(",")[1].replace(/\'/g, ""),
          lieuDep = info.split(",")[2];
        if (lieuDep != 3) {
          let lien =
            "Armee.php?Transferer&nbTroupes=" +
            nbUnit +
            "&ChoixUnite=" +
            nomUnit +
            "&LieuOrigine=" +
            lieuDep +
            "&LieuDestination=" +
            (~~lieuDep + 1) +
            "&" +
            $("#t").attr("name") +
            "=" +
            $("#t").attr("value");
          $(elt)
            .next()
            .html(
              `<a href="${lien}" class='cursor'><img width='9' height='15' src='images/bouton/fleche-champs-droite.gif'/></a>`,
            );
        }
        if (lieuDep != 1) {
          let lien =
            "Armee.php?Transferer&nbTroupes=" +
            nbUnit +
            "&ChoixUnite=" +
            nomUnit +
            "&LieuOrigine=" +
            lieuDep +
            "&LieuDestination=" +
            (~~lieuDep - 1) +
            "&" +
            $("#t").attr("name") +
            "=" +
            $("#t").attr("value");
          $(elt)
            .prev()
            .html(
              `<a href="${lien}" class='cursor'><img width='9' height='15' src='images/bouton/fleche-champs-gauche.gif'/></a>`,
            );
        }
      }
    });
    // Affichage des infos sur l'armée selon son placement
    this.afficherLigneVie();
    this.afficherLigneAttaque();
    this.afficherLigneDefense();
    this.afficherLigneConsommation();
  }
  /**
   * Affiche les informations supplémentaires sur la vie des armées.
   *
   * @private
   * @method afficherLigneVie
   */
  afficherLigneVie() {
    let bouclier = monProfil.niveauRecherche[1];
    let line = `<tr align='center' class='vie cursor'>
			 <td>Vie (AB)</td>
			 <td colspan=3>${IMG_VIE} ${numeral(this._armeeTdc.getTotalVie(bouclier)).format()}</td>
			 <td colspan=3>${IMG_VIE} ${numeral(this._armeeDome.getTotalVie(bouclier, LIEU.DOME, ~~$('span:contains("Dôme")').text().replace(/\D/g, ""))).format()}</td>
			 <td colspan=3>${IMG_VIE} ${numeral(this._armeeLoge.getTotalVie(bouclier, LIEU.LOGE, ~~$('span:contains("Loge")').text().replace(/\D/g, ""))).format()}</td>
			 </tr>
			 <tr align='center' class='vie cursor' style='display:none;'>
			 <td>Vie (HB)</td>
			 <td colspan=3>${IMG_VIE} ${numeral(this._armeeTdc.getBaseVie()).format()}</td>
			 <td colspan=3>${IMG_VIE} ${numeral(this._armeeDome.getBaseVie()).format()}</td>
			 <td colspan=3>${IMG_VIE} ${numeral(this._armeeLoge.getBaseVie()).format()}</td>
			 </tr>`;
    $(".simulateur tr[align=center]:last").after(line);
    $(".vie").click(() => {
      $(".vie").toggle();
    });
  }
  /**
   * Affiche les informations supplémentaires sur l'attaque des armées.
   *
   * @private
   * @method afficherLigneAttaque
   */
  afficherLigneAttaque() {
    let armes = monProfil.niveauRecherche[2];
    let line = `<tr align="center" class="att ligne_paire cursor">
			 <td>Dégâts en Attaque (AB)</td>
			 <td colspan=3>${IMG_ATT} ${numeral(this._armeeTdc.getTotalAtt(armes)).format()}</td>
			 <td colspan=3>${IMG_ATT} ${numeral(this._armeeDome.getTotalAtt(armes)).format()}</td>
			 <td colspan=3>${IMG_ATT} ${numeral(this._armeeLoge.getTotalAtt(armes)).format()}</td>
			 </tr>
			 <tr align="center" class="att ligne_paire cursor" style="display:none;">
			 <td>Dégâts en Attaque (HB)</td>
			 <td colspan=3>${IMG_ATT} ${numeral(this._armeeTdc.getBaseAtt()).format()}</td>
			 <td colspan=3>${IMG_ATT} ${numeral(this._armeeDome.getBaseAtt()).format()}</td>
			 <td colspan=3>${IMG_ATT} ${numeral(this._armeeLoge.getBaseAtt()).format()}</td>
			 </tr>`;
    $(".simulateur tr[align=center]:last").after(line);
    $(".att").click(() => {
      $(".att").toggle();
    });
  }
  /**
   * Affiche les informations supplémentaires sur la defense des armées.
   *
   * @private
   * @method afficherLigneDefense
   */
  afficherLigneDefense() {
    let armes = monProfil.niveauRecherche[2];
    let line = `<tr align="center" class="def cursor">
			 <td>Dégâts en Défense (AB)</td>
			 <td colspan=3>${IMG_DEF} ${numeral(this._armeeTdc.getTotalDef(armes)).format()}</td>
			 <td colspan=3>${IMG_DEF} ${numeral(this._armeeDome.getTotalDef(armes)).format()}</td>
			 <td colspan=3>${IMG_DEF} ${numeral(this._armeeLoge.getTotalDef(armes)).format()}</td>
			 </tr>
			 <tr align="center" class="def cursor" style="display:none;">
			 <td>Dégâts en Défense (HB)</td>
			 <td colspan=3>${IMG_DEF} ${numeral(this._armeeTdc.getBaseDef()).format()}</td>
			 <td colspan=3>${IMG_DEF} ${numeral(this._armeeDome.getBaseDef()).format()}</td>
			 <td colspan=3>${IMG_DEF} ${numeral(this._armeeLoge.getBaseDef()).format()}</td>
			 </tr>`;
    $(".simulateur tr[align=center]:last").after(line);
    $(".def").click(() => {
      $(".def").toggle();
    });
  }
  /**
   * Affiche les informations supplémentaires sur la consommation des armées.
   *
   * @private
   * @method afficherLigneConsommation
   */
  afficherLigneConsommation() {
    let line = `<tr align='center' class='ligne_paire'>
			 <td>Consommation Journalière</td>
			 <td colspan=3>${IMG_POMME} ${numeral(this._armeeTdc.getConsommation(1)).format()}</td>
			 <td colspan=3>${IMG_POMME} ${numeral(this._armeeDome.getConsommation(2)).format()}</td>
			 <td colspan=3>${IMG_POMME} ${numeral(this._armeeLoge.getConsommation(3)).format()}</td>
			 </tr>`;
    $(".simulateur tr[align=center]:last").after(line);
  }
  /**
   * Textes d'aide du jeu retirés, déplacement d'armée resserré.
   *
   * @private
   * @method alleger
   */
  alleger() {
    $("#centre p")
      .filter((i, e) =>
        /Vous pouvez répartir vos troupes|Cliquez sur la taille d.une troupe/.test(e.textContent),
      )
      .remove();
    let $deplacer = $("#centre h3")
      .filter((i, e) => /Déplacer son armée/.test(e.textContent))
      .closest("table");
    $deplacer.addClass("o_deplacerArmee");
    // « De » et « Vers » en tête de leur colonne de lieux, côte à côte
    $deplacer
      .find("input[type=radio]")
      .parent()
      .each((i, td) => {
        let $libelle = $(td).prev("td");
        if (!/^\s*(De|Vers)\s*$/.test($libelle.text())) return;
        $(td).prepend(`<span class="gras">${$libelle.text().trim()}</span><br/>`).addClass("left");
        $libelle.remove();
      });
    // la liste du jeu « Attaque(s) en cours » garde son affichage d'origine
    let titre = $("#centre h3").filter((i, e) => /Attaque\(s\) en cours/.test(e.textContent))[0],
      horsListe = (n) =>
        !titre ||
        !(titre === n || titre.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING);
    this.libellesCourts(horsListe);
    // blocs à égale distance : sauts de ligne du jeu entre eux retirés
    $("#o_attaquesLancees").addClass("o_blocArmee");
    $(".simulateur:not(.o_blocAttaques):first").addClass("o_blocArmee");
    $deplacer.addClass("o_blocArmee");
    $(window).on("resize", PageArmee.calerLargeurs);
    // textes raccourcis : largeurs recalculées (blocs épinglé et des floods)
    $(window).trigger("resize");
    $(".o_blocArmee").each((i, bloc) => {
      for (let sens of ["previousSibling", "nextSibling"]) {
        let n = bloc[sens];
        while (n && (n.nodeName == "BR" || (n.nodeType == 3 && !n.textContent.trim()))) {
          let suivant = n[sens];
          if (n.nodeName == "BR" && horsListe(n)) n.parentNode.removeChild(n);
          n = suivant;
        }
      }
    });
  }
  /**
   * Bloc « Floods en cours sur … » à la largeur du bloc « Troupes en garnison ».
   *
   * @static
   * @method calerLargeurs
   */
  static calerLargeurs() {
    let garnison = $(".simulateur:not(.o_blocAttaques):first")[0];
    if (!garnison) return;
    $("#o_floodsRecus").css("width", garnison.getBoundingClientRect().width + "px");
  }
  /**
   * Noms courts des lieux (TdC, Dôme, Loge) dans les textes et infobulles de
   * la page, hors des nœuds que `garder` exclut.
   *
   * @private
   * @method libellesCourts
   * @param {(n: Node) => Boolean} garder
   */
  libellesCourts(garder) {
    const COURTS = [
      [/la Fourmili[èe]re/g, "le Dôme"],
      [/la Loge Imp[ée]riale/gi, "la Loge"],
      [/Terrain de [Cc]hasse/g, "TdC"],
      [/Fourmili[èe]re/g, "Dôme"],
      [/Loge [Ii]mp[ée]riale/g, "Loge"],
    ];
    let raccourcir = (t) => COURTS.reduce((r, [re, court]) => r.replace(re, court), t),
      centre = document.getElementById("centre");
    if (!centre) return;
    let parcours = document.createTreeWalker(centre, NodeFilter.SHOW_TEXT),
      n;
    while ((n = parcours.nextNode()))
      if (
        n.parentNode &&
        n.parentNode.nodeName != "SCRIPT" &&
        !$(n.parentNode).closest("#menu, nav").length &&
        garder(n)
      ) {
        let court = raccourcir(n.textContent);
        if (court != n.textContent) n.textContent = court;
      }
    $("#centre [title]").each((i, e) => {
      if (garder(e) && !$(e).closest("#menu, nav").length)
        e.setAttribute("title", raccourcir(e.getAttribute("title")));
    });
  }
  /**
   * Statistiques de l'armée, repliées, en dernière ligne du bloc « Troupes en garnison ».
   */
  afficherStatistique() {
    let bouclier = monProfil.niveauRecherche[1],
      armes = monProfil.niveauRecherche[2];
    $(".simulateur:not(.o_blocAttaques):first").append(
      `<tr><td colspan="10" id="o_statArmee">${Utils.spoiler(
        "Statistiques",
        `<table class="centre o_maxWidth" cellspacing=0>
                <tr class="ligne_paire gras"><td></td><td colspan="2">Non XP</td><td colspan="2">Total</td></tr>
                <tr class="gras"><td></td><td>HB</td><td>AB</td><td>HB</td><td>AB</td></tr>
                <tr class="ligne_paire"><td class="left">${IMG_VIE} Vie</td><td>${numeral(this._armeeTdc.getNonXpBaseVie() + this._armeeDome.getNonXpBaseVie() + this._armeeLoge.getNonXpBaseVie()).format()}</td><td>${numeral(this._armeeTdc.getNonXpTotalVie(bouclier) + this._armeeDome.getNonXpTotalVie(bouclier) + this._armeeLoge.getNonXpTotalVie(bouclier)).format()}</td><td>${numeral(this._armeeTdc.getBaseVie() + this._armeeDome.getBaseVie() + this._armeeLoge.getBaseVie()).format()}</td><td>${numeral(this._armeeTdc.getTotalVie(bouclier) + this._armeeDome.getTotalVie(bouclier) + this._armeeLoge.getTotalVie(bouclier)).format()}</td></tr>
                <tr><td class="left">${IMG_ATT} Attaque</td><td>${numeral(this._armeeTdc.getNonXpBaseAtt() + this._armeeDome.getNonXpBaseAtt() + this._armeeLoge.getNonXpBaseAtt()).format()}</td><td>${numeral(this._armeeTdc.getNonXpTotalAtt(armes) + this._armeeDome.getNonXpTotalAtt(armes) + this._armeeLoge.getNonXpTotalAtt(armes)).format()}</td><td>${numeral(this._armeeTdc.getBaseAtt() + this._armeeDome.getBaseAtt() + this._armeeLoge.getBaseAtt()).format()}</td><td>${numeral(this._armeeTdc.getTotalAtt(armes) + this._armeeDome.getTotalAtt(armes) + this._armeeLoge.getTotalAtt(armes)).format()}</td></tr>
                <tr class="ligne_paire"><td class="left">${IMG_DEF} Défense</td><td>${numeral(this._armeeTdc.getNonXpBaseDef() + this._armeeDome.getNonXpBaseDef() + this._armeeLoge.getNonXpBaseDef()).format()}</td><td>${numeral(this._armeeTdc.getNonXpTotalDef(armes) + this._armeeDome.getNonXpTotalDef(armes) + this._armeeLoge.getNonXpTotalDef(armes)).format()}</td><td>${numeral(this._armeeTdc.getBaseDef() + this._armeeDome.getBaseDef() + this._armeeLoge.getBaseDef()).format()}</td><td>${numeral(this._armeeTdc.getTotalDef(armes) + this._armeeDome.getTotalDef(armes) + this._armeeLoge.getTotalDef(armes)).format()}</td></tr>
            </table>`,
        "armeeStatistiques",
        "gras",
        false,
      )}</td></tr>`,
    );
  }
  /**
   * Verifie les attaques en cours avec ce qui est sauvegarder.
   *
   * @private
   * @method saveAttaque
   */
  saveAttaque(listeAttaque) {
    if (
      !this._boiteComptePlus.hasOwnProperty("attaque") ||
      this._boiteComptePlus.attaque.length != listeAttaque.length ||
      (listeAttaque.length &&
        (this._boiteComptePlus.attaque[0]["cible"] != listeAttaque[0]["cible"] ||
          (listeAttaque[0]["exp"].diff(this._boiteComptePlus.attaque[0]["exp"], "s") > 1 &&
            !Utils.comptePlus &&
            $("#boiteComptePlus").length)))
    ) {
      this._boiteComptePlus.attaque = listeAttaque;
      this._boiteComptePlus.startAttaque = Horloge.serveur();
      this._boiteComptePlus.sauvegarder().majAttaque();
    }
    return this;
  }
}
