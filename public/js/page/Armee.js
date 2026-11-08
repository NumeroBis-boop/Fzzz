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
    this.recupererArmee();
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
   * Armée en terrain, en dôme et en loge, lue dans le tableau de la garnison affiché.
   *
   * @private
   * @method recupererArmee
   */
  recupererArmee() {
    let lieux = PageArmee.lieuxDe(PageArmee.tableauGarnison($(document)));
    this._armeeTdc = lieux.tdc;
    this._armeeDome = lieux.dome;
    this._armeeLoge = lieux.loge;
  }
  /**
   * Tableau « Troupes en Garnison » d'une page Armée, affichée ou reçue.
   *
   * @static
   * @method tableauGarnison
   * @param {JQuery} $racine
   * @return {JQuery} vide s'il manque
   */
  static tableauGarnison($racine) {
    return $racine
      .find("table.simulateur")
      .filter((k, t) => /Troupes en Garnison/.test(t.textContent))
      .first();
  }
  /**
   * Unités du tableau de la garnison, par lieu. Dans une ligne du jeu, un lieu
   * vide est une case et un lieu occupé trois (flèche, nombre, flèche) : le
   * nombre du terrain est en 3e case, celui de la loge en avant-dernière,
   * celui du dôme entre les deux.
   *
   * @static
   * @method lieuxDe
   * @param {JQuery} $tableau
   * @return {{tdc: Armee, dome: Armee, loge: Armee}}
   */
  static lieuxDe($tableau) {
    let lieux = { tdc: {}, dome: {}, loge: {} },
      nombre = (e) => numeral($(e).text()).value();
    $tableau
      .find("tr[align=center]")
      .slice(0, 14)
      .each((i, ligne) => {
        let unite = $(ligne).find(".pas_sur_telephone").text(),
          $cases = $(ligne).find("td");
        if (!unite) return;
        let tdc = nombre($(ligne).find("td:nth-child(3) span")),
          loge = nombre($(ligne).find("td:nth-last-child(2)"));
        if (tdc) lieux.tdc[unite] = tdc;
        $cases.slice(3, $cases.length - 2).each((k, c) => {
          let n = nombre(c);
          if (n) lieux.dome[unite] = n;
        });
        if (loge) lieux.loge[unite] = loge;
      });
    return {
      tdc: new Armee({ unite: lieux.tdc }),
      dome: new Armee({ unite: lieux.dome }),
      loge: new Armee({ unite: lieux.loge }),
    };
  }
  /**
   * Garnison d'une page Armée reçue, ou null si elle n'en a pas.
   *
   * @static
   * @method garnisonDe
   * @param {String} html
   * @return {{tdc: Armee, dome: Armee, loge: Armee}|null}
   */
  static garnisonDe(html) {
    let $tableau = PageArmee.tableauGarnison(Utils.parseHtml(html || ""));
    return $tableau.length ? PageArmee.lieuxDe($tableau) : null;
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
   * @param {Integer} [passe] 2 pour le nouvel essai après un déplacement refusé
   * @return {Function|null}
   */
  placementPrevu(passe = 1) {
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
        this.replacer(
          iT,
          t,
          iD,
          d,
          [
            { toutEnLoge: true },
            { i: iT, de: LIEU_ARMEE.LOGE, vers: LIEU_ARMEE.TERRAIN, nb: t },
            { i: iD, de: LIEU_ARMEE.LOGE, vers: LIEU_ARMEE.DOME, nb: d },
          ],
          passe,
        );
    // seules les antisondes sont dehors : on ne déplace que la différence, et
    // rien pour un lieu déjà dans ses bornes (90 % à 100 % du maximum)
    let ecart = (i, lieu, avant, apres) =>
        apres < avant
          ? { i, de: lieu, vers: LIEU_ARMEE.LOGE, nb: avant - apres }
          : { i, de: LIEU_ARMEE.LOGE, vers: lieu, nb: apres - avant },
      etapes = [ecart(iT, LIEU_ARMEE.TERRAIN, t0, t), ecart(iD, LIEU_ARMEE.DOME, d0, d)]
        // les retours en loge d'abord : la loge a alors de quoi fournir l'autre lieu
        .sort((x, y) => (y.vers == LIEU_ARMEE.LOGE) - (x.vers == LIEU_ARMEE.LOGE));
    return () => this.replacer(iT, t, iD, d, etapes, passe);
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
   * dernière réponse, ou de la page relue quand cette réponse ne montre pas
   * l'armée attendue. Un déplacement refusé par le jeu vaut un seul nouvel
   * essai, calculé d'après la page relue.
   *
   * @method replacer
   * @param {Integer} iT indice dans Armee.unite de l'antisonde en terrain
   * @param {Integer} terrain unités attendues en terrain à la fin
   * @param {Integer} iD indice dans Armee.unite de l'antisonde en dôme
   * @param {Integer} dome unités attendues en dôme à la fin
   * @param {Array<Object>} deplacements {toutEnLoge: true} ou {i, de, vers, nb}
   * @param {Integer} [passe] 2 pour le nouvel essai
   * @return {Promise}
   */
  replacer(iT, terrain, iD, dome, deplacements, passe = 1) {
    let jeton = () => ({ [$("#t").attr("name")]: $("#t").val() }),
      ecarts = (html) =>
        PageArmee.ecartsPlacement(PageArmee.garnisonDe(html), iT, terrain, iD, dome),
      reponses = [],
      aFaire = PageArmee.parVoisins(deplacements.filter((e) => e.toutEnLoge || e.nb > 0)),
      // pour le journal : chaque déplacement avec ce que le jeu a répondu
      detail = (page) =>
        `${passe > 1 ? "nouvel essai, " : ""}attendu : TdC ${numeral(terrain).format()} ${NOM_UNITE[iT + 1]}, dôme ${numeral(dome).format()} ${NOM_UNITE[iD + 1]}\n` +
        aFaire
          .map(
            (e, k) =>
              `${k + 1}. ${PageArmee.libelleEtape(e)} → ${PageArmee.etatGarnison(reponses[k], iT, iD)}`,
          )
          .join("\n") +
        (page == null ? "" : `\npage relue → ${PageArmee.etatGarnison(page, iT, iD)}`),
      source = "Replacement de l'armée",
      etapes = aFaire.map((e) =>
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
              reponses.push(html);
              PageArmee.reprendreJeton(html);
            }),
          ),
        Promise.resolve(),
      )
      .then(() => {
        let reponse = reponses[reponses.length - 1];
        if (!ecarts(reponse).length) {
          if (passe > 1) Journal.info(source, "Armée placée au nouvel essai", detail(null));
          return this.finReplacement(reponse, iT, terrain, iD, dome, []);
        }
        // une réponse peut montrer l'armée d'avant le dernier déplacement (le jeu
        // traite les actions d'un compte une à une) : la page relue fait foi
        return Promise.resolve($.get("/Armee.php")).then((page) => {
          PageArmee.reprendreJeton(page);
          let restants = ecarts(page);
          if (!restants.length) {
            Journal.info(
              source,
              "Réponse du jeu d'avant le déplacement : armée bien placée à la relecture",
              detail(page),
            );
            return this.finReplacement(page, iT, terrain, iD, dome, []);
          }
          if (passe == 1 && this.remplacerGarnison(page)) {
            Journal.info(
              source,
              "Déplacement refusé par le jeu : nouvel essai d'après la page relue",
              detail(page),
            );
            let suite = this.placementPrevu(2);
            // page relue dans les bornes des préférences : rien à refaire
            return suite
              ? suite()
              : this.finReplacement(
                  null,
                  iT,
                  this._armeeTdc.unite[iT],
                  iD,
                  this._armeeDome.unite[iD],
                  [],
                );
          }
          Journal.erreur(source, "Armée pas placée comme prévu", detail(page));
          return this.finReplacement(page, iT, terrain, iD, dome, restants);
        });
      })
      .catch(() => this.echecReplacement());
  }
  /**
   * Déplacements entre lieux voisins seulement : le jeu a refusé un
   * déplacement direct de la loge vers le TdC, et ses flèches ne vont que du
   * TdC au dôme et du dôme à la loge. La loge et le TdC passent par le dôme.
   *
   * @static
   * @method parVoisins
   * @param {Array<Object>} etapes {toutEnLoge: true} ou {i, de, vers, nb}
   * @return {Array<Object>}
   */
  static parVoisins(etapes) {
    return etapes.flatMap((e) =>
      !e.toutEnLoge && Math.abs(e.de - e.vers) == 2
        ? [
            { ...e, vers: LIEU_ARMEE.DOME },
            { ...e, de: LIEU_ARMEE.DOME },
          ]
        : [e],
    );
  }
  /**
   * Jeton du formulaire d'une page reçue (le jeu en donne un nouveau à chaque
   * page) : repris pour la requête suivante et pour les flèches refaites dans
   * le tableau, qui lisent l'attribut.
   *
   * @static
   * @method reprendreJeton
   * @param {String} html
   */
  static reprendreJeton(html) {
    let nouveau = Utils.parseHtml(html || "")
      .find("#t")
      .val();
    if (nouveau) $("#t").val(nouveau).attr("value", nouveau);
  }
  /**
   * Tableau de la garnison remplacé par celui de `html` (null : déjà fait), et
   * message du résultat.
   *
   * @private
   * @method finReplacement
   * @param {String|null} html
   * @param {Array<String>} ecarts écarts restants avec le placement prévu
   */
  finReplacement(html, iT, terrain, iD, dome, ecarts) {
    if (html != null && !this.remplacerGarnison(html)) {
      location = "/Armee.php";
      return;
    }
    $.toast(
      ecarts.length
        ? {
            ...TOAST_WARNING,
            text: `Le jeu n'a pas déplacé l'armée comme prévu (${ecarts.join(" ; ")}) : vérifie le tableau.`,
          }
        : {
            ...TOAST_SUCCESS,
            text: `Armée replacée : ${numeral(terrain).format()} ${NOM_UNITE[iT + 1]} en TdC, ${numeral(dome).format()} ${NOM_UNITE[iD + 1]} en dôme, le reste en loge.`,
          },
    );
  }
  /**
   * Différences entre une garnison et le placement prévu : antisonde du
   * terrain, du dôme, et autres unités hors de la loge.
   *
   * @static
   * @method ecartsPlacement
   * @param {{tdc: Armee, dome: Armee, loge: Armee}|null} lieux
   * @return {Array<String>} vide si l'armée est placée comme prévu
   */
  static ecartsPlacement(lieux, iT, terrain, iD, dome) {
    if (!lieux) return ["pas de tableau de la garnison dans la réponse du jeu"];
    let t = lieux.tdc.unite[iT],
      d = lieux.dome.unite[iD],
      autres = lieux.tdc.getSommeUnite() + lieux.dome.getSommeUnite() - t - d,
      liste = [];
    if (t != terrain)
      liste.push(
        `TdC : ${numeral(t).format()} ${NOM_UNITE[iT + 1]} au lieu de ${numeral(terrain).format()}`,
      );
    if (d != dome)
      liste.push(
        `dôme : ${numeral(d).format()} ${NOM_UNITE[iD + 1]} au lieu de ${numeral(dome).format()}`,
      );
    if (autres) liste.push(`${numeral(autres).format()} autre(s) unité(s) hors de la loge`);
    return liste;
  }
  /**
   * Déplacement en une ligne, pour le journal.
   *
   * @static
   * @method libelleEtape
   * @param {Object} e {toutEnLoge: true} ou {i, de, vers, nb}
   * @return {String}
   */
  static libelleEtape(e) {
    let lieu = {
      [LIEU_ARMEE.TERRAIN]: "TdC",
      [LIEU_ARMEE.DOME]: "dôme",
      [LIEU_ARMEE.LOGE]: "loge",
    };
    return e.toutEnLoge
      ? "tout en loge"
      : `${numeral(e.nb).format()} ${NOM_UNITE[e.i + 1]} ${lieu[e.de]} → ${lieu[e.vers]}`;
  }
  /**
   * Antisondes et autres unités hors de la loge dans une page Armée reçue,
   * avec le message du jeu s'il en affiche un, pour le journal.
   *
   * @static
   * @method etatGarnison
   * @param {String} html
   * @return {String}
   */
  static etatGarnison(html, iT, iD) {
    let lieux = PageArmee.garnisonDe(html),
      message = Utils.parseHtml(html || "")
        .find("#centre")
        .find("p, div, span, font, strong, b")
        .filter(
          (k, e) =>
            e.textContent.trim().length < 200 &&
            /impossible|erreur|pas assez|insuffisant|invalide|ne pouvez|interdit/i.test(
              e.textContent,
            ),
        )
        .first()
        .text()
        .trim();
    if (!lieux)
      return `pas de tableau de la garnison${message ? ` (message du jeu : « ${message} »)` : ""}`;
    let t = lieux.tdc.unite[iT],
      d = lieux.dome.unite[iD],
      autres = lieux.tdc.getSommeUnite() + lieux.dome.getSommeUnite() - t - d;
    return (
      `TdC ${numeral(t).format()}, dôme ${numeral(d).format()}, autres hors loge ${numeral(autres).format()}` +
      (message ? ` (message du jeu : « ${message} »)` : "")
    );
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
    let $nouvelle = PageArmee.tableauGarnison(Utils.parseHtml(html || "")),
      $actuelle = $(".simulateur:not(.o_blocAttaques):first");
    if (!$nouvelle.length || !$actuelle.length) return false;
    let $bouton = $("#o_replaceArmee").closest("tr").detach(),
      $hof = $actuelle.find(".o_ligneHof").detach(),
      $stat = $("#o_statArmee").closest("tr").detach();
    $nouvelle = $(document.importNode($nouvelle[0], true)).addClass("o_blocArmee");
    $actuelle.replaceWith($nouvelle);
    $nouvelle.find("tr:eq(0)").after($bouton);
    $nouvelle.append($hof, $stat);
    this.recupererArmee();
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
