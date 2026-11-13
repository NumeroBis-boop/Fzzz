/*
 * AttaqueLancee.js
 **********************************************************************/

/**
 * Capture des attaques au moment de leur lancement (page Attaquer) pour
 * afficher un récapitulatif par cible (lieu, troupes, arrivée, terrain estimé
 * de la cible à l'arrivée) avec export texte pour le forum.
 *
 * Le serveur n'envoie ni le lieu visé ni la composition des troupes aux
 * comptes gratuits : on les mémorise donc en localStorage à l'envoi, puis on
 * les lie à la ligne que le jeu affiche. La liaison ne s'appuie pas sur un
 * temps de trajet estimé (la formule peut diverger du jeu) mais sur l'id
 * d'attaque : une attaque fraîchement lancée porte toujours l'id le plus
 * élevé de la liste pour sa cible. En flood la réponse du POST contient déjà
 * la liste, on lie immédiatement ; en envoi de formulaire on lie au premier
 * rendu de la page suivante. Une attaque lancée hors de ce navigateur reste
 * sans capture — seule l'heure d'arrivée, calculée depuis le compte à
 * rebours du jeu, est affichée pour toutes (non-C+, le C+ l'a nativement).
 *
 * @class AttaqueLancee
 */
const CLE_ATTAQUES_LANCEES = "outiiil_attaquesLancees";
// délai (s) au-delà duquel une capture jamais retrouvée dans la liste du jeu
// est abandonnée (envoi refusé par le serveur, page jamais rechargée…)
const DUREE_VIE_CAPTURE = 600;
// délai (s) après l'envoi au-delà duquel une capture toujours sans ligne est un envoi refusé
const MARGE_REFUS = 5;
// fenêtre (s) pendant laquelle le jeu accepte d'annuler une attaque après son lancement
const DELAI_ANNULATION = 120;
// nombre d'attaques qu'un « Tout annuler » n'a pas pu annuler, affiché après rechargement
const CLE_ANNULATION_ECHEC = "outiiil_annulationEchec";
// recalcul de la taille du tableau au redimensionnement, installé une fois
let ajustementTailleActif = false;
// replacements de l'armée attendus ou en cours : le bloc « Mes attaques en
// cours » n'envoie aucune lecture avant leur fin
let replacementsArmee = new Set();
// avancement affiché du chargement de ce bloc (suiviChargement)
let chargementBloc = null;

class AttaqueLancee {
  /**
   * Charge la liste des captures en purgeant les attaques déjà arrivées et
   * les captures jamais liées à une ligne du jeu.
   */
  static charger() {
    let liste;
    try {
      liste = JSON.parse(localStorage.getItem(CLE_ATTAQUES_LANCEES)) || [];
    } catch (e) {
      liste = [];
    }
    return liste.filter((a) =>
      a.id
        ? moment(a.arrivee).isAfter(Horloge.serveur())
        : a.lancee && Horloge.serveur().diff(a.lancee, "s") < DUREE_VIE_CAPTURE,
    );
  }
  /**
   *
   */
  static sauvegarder(liste) {
    localStorage.setItem(CLE_ATTAQUES_LANCEES, JSON.stringify(liste));
  }
  /**
   * Mémorise une attaque au moment de l'envoi.
   *
   * @param {String} cible pseudo du joueur attaqué
   * @param {String} lieu libellé du lieu visé (tel qu'affiché dans le formulaire)
   * @param {Object} unite composition {nom d'unité: nombre}
   * @param {Object} options
   *   - html : réponse du serveur si l'envoi est fait en AJAX (flood), permet
   *            de lier tout de suite l'id et l'arrivée exacte
   *   - terrain : terrain de la cible connu au lancement, pour estimer celui
   *               qu'elle aura à l'arrivée
   *   - partager : publiée dans le forum dès qu'elle est liée (boutons « + partager »)
   */
  static enregistrer(cible, lieu, unite, options = {}) {
    // clic à vide (aucune unité) : le jeu refusera l'envoi, rien à mémoriser
    if (!Object.values(unite).some((nb) => nb)) return;
    let liste = AttaqueLancee.charger(),
      capture = {
        id: null,
        cible: cible,
        lieu: lieu,
        unite: unite,
        lancee: Horloge.maintenant(),
        arrivee: null,
        // terrain de la cible avant cette attaque puis estimé après : on
        // repart de l'estimation de la dernière attaque encore en vol sur
        // cette cible s'il y en a une — le terrain du profil ne les reflète
        // pas encore — sinon du terrain connu au lancement
        terrainDepart: null,
        terrainCible: null,
        // Fzzz : TdC de la cible connu au lancement (profil, ou valeur saisie
        // dans le lanceur de flood), avant toute estimation enchaînée
        terrainConnu: options.terrain > 0 ? options.terrain : null,
      },
      precedente = liste
        .filter((a) => a.cible == cible && a.terrainCible != null)
        .sort((a, b) => a.lancee - b.lancee)
        .pop();
    capture.terrainDepart = precedente
      ? precedente.terrainCible
      : options.terrain > 0
        ? options.terrain
        : null;
    AttaqueLancee.estimerTerrain(capture, capture.terrainDepart);
    if (options.partager) capture.partager = true;
    if (options.html) {
      let ligne = AttaqueLancee.extraireLignes(Utils.parseHtml(options.html))
        .filter((l) => l.cible == cible)
        .pop();
      if (ligne) {
        capture.id = ligne.id;
        capture.arrivee = ligne.arrivee.valueOf();
        AttaqueLancee.noterDehors(capture);
      }
    }
    liste.push(capture);
    AttaqueLancee.sauvegarder(liste);
  }
  /**
   * Extrait les lignes « Vous allez attaquer » / « Des renforts arrivent »
   * d'un document, triées par id d'attaque croissant (= ordre de lancement).
   *
   * @param {jQuery} racine document (ou fragment) à parcourir
   * @return {Array} liste {elt, id, cible (null pour un renfort), cibleHtml, secondes, arrivee,
   *   minuteJeu (ms ou null), incertaine (arrivée à la minute du jeu, horloge décalée)}
   */
  static extraireLignes(racine = $(document)) {
    // le compteur du jeu est un nombre entier de secondes restantes au moment
    // où le serveur a produit la page : arrivée = cette seconde + compteur
    let produite = Horloge.serveurA(
        racine[0] === document ? AttaqueLancee.receptionPage() : Date.now(),
      ).valueOf(),
      secondeProduite = Math.floor(produite / 1000) * 1000,
      lignes = [];
    racine.find("span[id^='attaque_']").each((i, elt) => {
      // le compteur du jeu est alimenté par un script voisin : reste(secondes, "attaque_<id>")
      let secondes = parseInt($(elt).nextAll("script").first().text().split("(")[1]);
      if (isNaN(secondes)) return;
      // C+ : le jeu écrit le lieu entre parenthèses après le pseudo et les
      // troupes dans un bloc après le lien Annuler — on les lit pour les
      // attaques qu'on n'a pas capturées (lancées ailleurs)
      let natifs = AttaqueLancee.noeudsLigne(elt),
        texte = natifs.map((n) => n.textContent).join(" "),
        lieu = texte.match(/\((terrain de chasse|fourmilière|loge impériale)\)/i),
        troupes = texte.match(/Troupes en attaques?\s*:\s*(.+?)\s*(?:Arrivée|$)/i),
        arrivee = moment(secondeProduite + secondes * 1000),
        minuteJeu = AttaqueLancee.minuteJeu(texte, arrivee),
        // l'horloge du navigateur peut être décalée (veille, cache) : la minute
        // écrite par le serveur fait foi, les secondes sont alors inconnues
        incertaine = minuteJeu != null && !AttaqueLancee.memeMinute(arrivee, minuteJeu);
      if (incertaine) arrivee = moment(minuteJeu + 30000);
      lignes.push({
        elt: elt,
        id: parseInt($(elt).attr("id").split("_")[1]),
        // attaque normale (la cible est un lien) — un renfort n'a pas de cible
        cible: $(elt).prev().find("a").length ? $(elt).prev().find("a:first").text() : null,
        // HTML natif du bloc cible (lien vers le profil, et vers l'alliance
        // entre parenthèses quand le jeu l'affiche), réutilisé tel quel dans
        // le titre du tableau pour garder les pseudos cliquables (issue #25)
        cibleHtml: $(elt).prev().find("a").length ? $(elt).prev().html() : null,
        secondes: secondes,
        arrivee: arrivee,
        minuteJeu: minuteJeu,
        incertaine: incertaine,
        lieuNatif: lieu ? lieu[1] : null,
        troupesNatif: troupes ? troupes[1] : null,
      });
    });
    return lignes.sort((a, b) => a.id - b.id);
  }
  /**
   * Minute d'arrivée écrite par le jeu (« Arrivée à 17h59 », C+), placée au
   * jour le plus proche de l'arrivée calculée ; null si absente.
   *
   * @static
   * @method minuteJeu
   * @param {String} texte texte de la ligne d'attaque
   * @param {Object} arrivee moment, arrivée calculée
   * @return {Number|null} ms
   */
  static minuteJeu(texte, arrivee) {
    let m = String(texte).match(/Arrivée à (\d{1,2})h(\d{2})/i);
    if (!m) return null;
    let minute = arrivee.clone().hours(parseInt(m[1])).minutes(parseInt(m[2])).startOf("minute"),
      ecart = minute.diff(arrivee, "hours", true);
    if (ecart > 12) minute.subtract(1, "day");
    else if (ecart < -12) minute.add(1, "day");
    return minute.valueOf();
  }
  /**
   * L'arrivée calculée correspond-elle à la minute du jeu ? Tolérance d'une
   * minute de chaque côté : le jeu peut tronquer ou arrondir.
   *
   * @static
   * @method memeMinute
   */
  static memeMinute(arrivee, minuteJeu) {
    let ecart = arrivee.valueOf() - minuteJeu;
    return ecart >= -60000 && ecart < 120000;
  }
  /**
   * Instant (horloge du PC, ms) où la page courante a commencé d'arriver,
   * juste après sa production par le serveur ; à défaut, maintenant.
   *
   * @static
   * @method receptionPage
   */
  static receptionPage() {
    try {
      let nav = /** @type {PerformanceNavigationTiming} */ (
        performance.getEntriesByType("navigation")[0]
      );
      // délai écoulé mesuré sur l'horloge de performance, sans timeOrigin : sur
      // téléphone, cette horloge s'arrête pendant la veille et timeOrigin peut
      // retarder de la durée de veille sur l'heure du PC
      if (nav && nav.responseStart > 0)
        return Date.now() - Math.max(0, performance.now() - nav.responseStart);
    } catch (e) {}
    return Date.now();
  }
  /**
   * Lie les captures encore orphelines aux lignes affichées : pour une cible
   * donnée, les N captures les plus récentes correspondent aux N lignes aux
   * ids les plus élevés qui ne sont pas déjà liées.
   *
   * @param {Array} liste captures chargées
   * @param {Array} lignes lignes extraites de la page
   * @return {Boolean} true si au moins une liaison a été faite
   */
  static lier(liste, lignes) {
    let modifie = false,
      idsLies = liste.filter((a) => a.id).map((a) => a.id);
    new Set(liste.filter((a) => !a.id).map((a) => a.cible)).forEach((cible) => {
      let captures = liste
          .filter((a) => !a.id && a.cible == cible)
          .sort((a, b) => a.lancee - b.lancee),
        candidates = lignes.filter((l) => l.cible == cible && idsLies.indexOf(l.id) == -1),
        nb = Math.min(captures.length, candidates.length);
      // aucune ligne libre (envoi refusé…) : slice(-0) renverrait toutes les captures
      if (!nb) return;
      captures.slice(-nb).forEach((capture, i) => {
        let ligne = candidates[candidates.length - nb + i];
        capture.id = ligne.id;
        capture.arrivee = ligne.arrivee.valueOf();
        AttaqueLancee.noterDehors(capture);
        modifie = true;
      });
    });
    return modifie;
  }
  /**
   * Ajoute une attaque liée au registre des troupes dehors, jusqu'à son
   * arrivée : les survivantes sont alors de nouveau en garnison.
   *
   * @param {Object} capture capture liée (id et arrivée connus)
   */
  static noterDehors(capture) {
    TroupesDehors.ajouterAttaque(
      capture.id,
      new Armee({ unite: capture.unite }).unite,
      capture.arrivee,
    );
  }
  /**
   * Terrain estimé de la cible après une attaque : même règle que la
   * simulation de flood, une unité prend 1 de terrain, plafonné à 20 % du
   * terrain de la cible avant l'attaque, quel que soit le lieu attaqué.
   *
   * @param {Object} capture
   * @param {Integer|null} base terrain de la cible avant l'attaque
   * @return {Integer|null} terrain après, aussi écrit dans la capture
   */
  static estimerTerrain(capture, base) {
    capture.terrainDepart = base > 0 ? base : null;
    if (capture.terrainDepart === null) return (capture.terrainCible = null);
    let nb = Object.values(capture.unite).reduce((somme, n) => somme + (n || 0), 0);
    return (capture.terrainCible = base - Math.min(nb, Math.floor(base * 0.2)));
  }
  /**
   * Recalcule la chaîne des terrains estimés d'une cible à partir de la plus
   * ancienne capture encore en vol : nécessaire quand une attaque du milieu
   * de la chaîne disparaît (annulation).
   *
   * @param {Array} liste captures
   * @return {Boolean} true si une estimation a changé
   */
  static recalculerTerrains(liste) {
    let modifie = false;
    new Set(liste.map((a) => a.cible)).forEach((cible) => {
      let base = null;
      liste
        .filter((a) => a.cible == cible)
        .sort((a, b) => a.lancee - b.lancee)
        .forEach((a) => {
          if (base === null) base = a.terrainDepart;
          let avant = a.terrainCible;
          base = AttaqueLancee.estimerTerrain(a, base);
          if (a.terrainCible !== avant) modifie = true;
        });
    });
    return modifie;
  }
  /**
   * Met les captures en phase avec les lignes affichées : liaison des
   * orphelines, purge de celles dont l'attaque a été annulée, recalcul des
   * terrains estimés.
   *
   * @param {Array} lignes lignes extraites de la page
   * @param {Boolean} retirer retirer du forum les floods partagés annulés
   *   (faux si la page lue n'est peut-être pas celle du jeu : session expirée)
   * @return {Array} captures à jour
   */
  static synchroniser(lignes, retirer = true) {
    let liste = AttaqueLancee.charger(),
      modifie = AttaqueLancee.lier(liste, lignes),
      // les pages qui listent les attaques en cours les listent toutes : une
      // capture liée dont la ligne a disparu correspond à une attaque annulée.
      annulees = liste.filter((a) => a.id && !lignes.some((l) => l.id == a.id)),
      // envoi refusé par le jeu (troupes insuffisantes…) : aucune ligne ne l'a
      // lié sur une page chargée après lui ; la marge couvre une page d'un
      // autre onglet servie avant que le jeu n'enregistre l'envoi
      refusees = retirer
        ? liste.filter((a) => !a.id && a.lancee < Horloge.maintenant() - MARGE_REFUS * 1000)
        : [];
    // Elle rend le terrain qu'elle aurait pris aux attaques lancées après elle.
    [...annulees, ...refusees].forEach((annulee) => {
      let prise = annulee.terrainDepart - annulee.terrainCible;
      if (prise > 0)
        liste
          .filter(
            (a) => a.cible == annulee.cible && a.lancee > annulee.lancee && a.terrainDepart != null,
          )
          .forEach((a) => (a.terrainDepart += prise));
      modifie = true;
    });
    liste = liste.filter((a) => (a.id ? lignes.some((l) => l.id == a.id) : !refusees.includes(a)));
    // arrivée capturée avec une horloge décalée : celle de la page la remplace
    liste.forEach((a) => {
      let l = a.id && lignes.find((x) => x.id == a.id);
      if (l && l.minuteJeu != null && a.arrivee && Math.abs(a.arrivee - l.arrivee) > 90000) {
        a.arrivee = l.arrivee.valueOf();
        AttaqueLancee.noterDehors(a);
        modifie = true;
      }
    });
    TroupesDehors.synchroniserAttaques(lignes);
    if (AttaqueLancee.recalculerTerrains(liste)) modifie = true;
    if (modifie) AttaqueLancee.sauvegarder(liste);
    // flood partagé dont la ligne a disparu (annulé, ou arrivé) : retiré du
    // forum, qu'il ait été capturé ou partagé à la main ou depuis un autre appareil
    let affiches = new Set(lignes.map((l) => l.id)),
      aRetirer = Object.keys(PartageChasses.floodsPartages())
        .map(Number)
        .filter((id) => id && !affiches.has(id));
    if (retirer && aRetirer.length) PartageChasses.retirerFloods(aRetirer);
    return liste;
  }
  /**
   * Attaques lancées avec un bouton « + partager » et déjà liées à leur ligne
   * du jeu : publiées dans le sujet « Floods » du joueur, une seule fois.
   *
   * @static
   * @method partagerMarquees
   * @return {Promise}
   */
  static partagerMarquees() {
    // déjà lancé sur cette page (reprise au chargement et liste des attaques)
    if (AttaqueLancee.partageEnCours) return AttaqueLancee.partageEnCours;
    let marquees = AttaqueLancee.charger().filter((a) => a.partager && a.id);
    if (!marquees.length) return Promise.resolve();
    // la marque n'est retirée qu'une fois le flood présent dans le forum : un
    // partage interrompu (page quittée, forum injoignable) est refait plus tard
    return (AttaqueLancee.partageEnCours = PartageChasses.partagerFloods(marquees, null)
      .then(() => {
        let partages = PartageChasses.floodsPartages(),
          liste = AttaqueLancee.charger();
        liste.forEach((a) => {
          if (a.partager && partages[a.id]) delete a.partager;
        });
        AttaqueLancee.sauvegarder(liste);
      })
      .finally(() => (AttaqueLancee.partageEnCours = null)));
  }
  /**
   * Floods dont le forum a refusé le partage : plus repris à chaque page.
   *
   * @param {Array<Number>} ids numéros d'attaque
   */
  static oublierPartage(ids) {
    let liste = AttaqueLancee.charger();
    liste.forEach((a) => {
      if (ids.includes(a.id)) delete a.partager;
    });
    AttaqueLancee.sauvegarder(liste);
  }
  /**
   * Heure d'arrivée arrondie à la minute, avec la date si ce n'est pas
   * aujourd'hui (rendu calqué sur le natif C+).
   */
  static formatArrivee(secondes) {
    let rArrivee = Utils.roundMinute(secondes);
    return `${rArrivee.isSame(Horloge.serveur(), "day") ? "à" : "le " + rArrivee.format("D MMM à")} ${rArrivee.format("HH[h]mm")}`;
  }
  /**
   * Non-C+ : ajoute l'heure d'arrivée sous chaque ligne « Des renforts
   * arrivent » (les attaques, elles, passent dans les tableaux par cible).
   *
   * @return {Array} liste {cible, exp} des attaques normales, pour la boite C+
   */
  static enrichirLignes() {
    let listeAttaque = [];
    AttaqueLancee.extraireLignes().forEach((ligne) => {
      if (ligne.cible) {
        listeAttaque.push({ cible: ligne.cible, exp: ligne.arrivee });
        return;
      }
      if (!Utils.affichage("arriveeRenforts")) return;
      $(ligne.elt)
        .nextAll("script")
        .first()
        .after(
          `<br/><small><em>Arrivée ${AttaqueLancee.formatArrivee(ligne.secondes)}</em></small>`,
        );
    });
    return listeAttaque;
  }
  static get ENTETE() {
    return `<thead><tr><th>#</th><th>Arrivée</th><th>Lanceur → cible</th><th>Unités</th><th title="Chasse : TdC conquis. Flood : estimé à l'impact, au plus 20 % du TdC de la cible à ce moment, rien hors de portée, d'après les TdC actuels et les mouvements en cours">Variation</th><th title="Mon TdC après ce mouvement">TdC après</th><th></th></tr></thead>`;
  }
  /**
   * Bloc « Mes attaques en cours » en haut de la page : sous le menu du jeu
   * (dans #centre), épinglé ; à défaut en tête de #centre.
   *
   * @static
   * @method placer
   */
  static placer($bloc) {
    let $menu = $("#centre > #menu");
    if ($menu.length) {
      $bloc.insertAfter($menu);
      AttaqueLancee.epingler($bloc[0]);
      // bandeau de ponte déjà affiché : il passe sous le bloc
      $("#o_alertePonte").insertAfter($bloc);
      $(window).trigger("resize");
    } else $bloc.prependTo("#centre");
    // bloc créé après la mise en page allégée de l'Armée : mêmes marges que ses blocs
    if ($(".o_blocArmee").length) $bloc.addClass("o_blocArmee");
  }
  /**
   * Mes mouvements à venir et les floods partagés sur moi, rejoués dans l'ordre
   * comme sur la page d'un membre (PartageChasses.simuler). Pour moi, la liste
   * des attaques du jeu (cette page) et mes chasses de Ressources.php font foi,
   * partagées ou non ; le forum de l'alliance donne les floods des autres
   * membres, les chasses des joueurs que ces floods relient à moi et, avec la
   * page Membres, leurs TdC. Forum ou page Ressources illisible : le reste est
   * quand même rendu (mes chasses sont alors celles du forum).
   *
   * @static
   * @method lireMouvements
   * @param {Array} attaques {ligne, capture} de la liste du jeu
   * @param {Object|null} [suivi] suiviChargement, prévenu de chaque lecture
   * @return {Promise<{floods: Object, chasses: Array, recus: Array}>} floods :
   *   événement de la simulation par numéro d'attaque ; chasses : {evenement,
   *   groupe (Ressources.php, ou null), partagee} ; recus : floods sur moi
   */
  static lireMouvements(attaques, suivi = null) {
    let moi = monProfil.pseudo,
      m = String(moi || "").toLowerCase();
    if (!moi) return Promise.resolve({ floods: {}, chasses: [], recus: [] });
    if (suivi) suivi.prevoir(1);
    return Promise.all([
      PartageChasses.enFile(() => PartageChasses.charger([moi], true, suivi)).catch(() => null),
      Promise.resolve($.get(location.origin + "/Ressources.php"))
        .then(
          (html) => {
            let $page = Utils.parseHtml(String(html));
            // autre page que Ressources (connexion) : chasses inconnues, pas « aucune »
            return $page.find("#boite_tdc").length ? PageRessource.lireChasses($page) : null;
          },
          () => null,
        )
        .then((chasses) => {
          if (suivi) suivi.faite();
          return chasses;
        }),
    ]).then(([forum, chasses]) => {
      let d = forum || { chasses: {}, floods: [] },
        partagees = d.chasses[m] || [],
        groupes = chasses ? PageRessource.grouperChasses(chasses) : null,
        minute = (/** @type {any} */ instant) => instant.format("YYYY-MM-DD HH:mm"),
        mesChasses = groupes
          ? PageRessource.aPartager(groupes).map((g) => ({
              date: minute(g.impact),
              terrain: g.terrain,
            }))
          : null,
        mesFloods = PartageChasses.entreesFloods(attaques.map(AttaqueLancee.pourPartage));
      if (forum) {
        // mes floods publiés ou retirés depuis un autre appareil
        PartageChasses.recalerFloods(
          forum.floods.filter((f) => f.id && String(f.lanceur).toLowerCase() == m).map((f) => f.id),
          AttaqueLancee.idsAffiches(),
        );
      }
      return AttaqueLancee.apresReplacement()
        .then(() =>
          PartageChasses.completer(
            PartageChasses.avecMesMouvements(
              d,
              moi,
              mesFloods,
              mesChasses,
              attaques.map((a) => a.ligne.id),
            ),
            [moi],
            suivi,
          ),
        )
        .then(({ d: complet, tdc }) => {
          let sim = PartageChasses.simuler(
              complet,
              PartageChasses.tdcConnus(tdc, { [moi]: Utils.terrain }),
            ),
            maintenant = minute(Horloge.serveur()),
            mouvements = { floods: {}, chasses: [], recus: [] };
          sim.evenements.forEach((e) => {
            if (e.type == "chasse") {
              if (e.joueur != m) return;
              let g = groupes ? groupes.find((x) => minute(x.impact) == e.date) || null : null;
              mouvements.chasses.push({
                evenement: e,
                groupe: g,
                // sans la page Ressources, mes chasses connues sont celles du forum
                partagee: groupes
                  ? !!g &&
                    PartageChasses.recalerListeChasses(
                      partagees,
                      [{ debut: minute(g.chasses[0].impact), fin: e.date, terrain: e.terrain }],
                      maintenant,
                    ).lignes.length > 0
                  : true,
              });
            } else if (String(e.lanceur).toLowerCase() == m) {
              if (e.id) mouvements.floods[e.id] = e;
            } else if (String(e.cible).toLowerCase() == m) mouvements.recus.push(e);
          });
          return mouvements;
        });
    });
  }
  /**
   * lireMouvements, qui ne laisse pas le bloc en attente si le calcul échoue.
   *
   * @static
   * @method mouvements
   * @param {Array} attaques
   * @param {Object|null} [suivi] suiviChargement
   * @return {Promise<{floods: Object, chasses: Array, recus: Array}>}
   */
  static mouvements(attaques, suivi = null) {
    return AttaqueLancee.lireMouvements(attaques, suivi).catch((e) => {
      console.error(`[${NOM_EXTENSION}] mouvements en cours`, e);
      return { floods: {}, chasses: [], recus: [] };
    });
  }
  /**
   * Le replacement de l'armée passe avant l'affichage des mouvements (règle du
   * mainteneur) : tant que `replacement` n'est pas fini, le bloc « Mes attaques
   * en cours » n'envoie aucune nouvelle lecture. Celles déjà en file attendent
   * derrière les déplacements (Requetes.js).
   *
   * @static
   * @method laisserPasser
   * @param {Promise} replacement
   */
  static laisserPasser(replacement) {
    let fin = Promise.resolve(replacement)
      .catch(() => {})
      .then(() => {
        replacementsArmee.delete(fin);
        if (chargementBloc) chargementBloc.attente(replacementsArmee.size > 0);
      });
    replacementsArmee.add(fin);
    if (chargementBloc) chargementBloc.attente(true);
  }
  /**
   * @static
   * @method apresReplacement
   * @return {Promise} tenue quand aucun replacement de l'armée n'est attendu ni en cours
   */
  static apresReplacement() {
    return replacementsArmee.size
      ? Promise.all([...replacementsArmee]).then(() => AttaqueLancee.apresReplacement())
      : Promise.resolve();
  }
  /**
   * Avancement du chargement du bloc, écrit dans son titre (visible même
   * replié, et sans ligne de plus) : lectures faites sur lectures prévues et
   * temps restant estimé d'après leur durée moyenne, ou attente du replacement.
   *
   * @static
   * @method suiviChargement
   * @param {jQuery} $bloc
   * @return {{prevoir: (n: Number) => void, faite: () => void, attente: (oui: Boolean) => void, fin: () => void}}
   */
  static suiviChargement($bloc) {
    let $etat = $bloc.find(".o_attaquesChargement"),
      prevues = 0,
      faites = 0,
      debut = 0,
      pause = 0,
      enAttente = replacementsArmee.size > 0,
      ecrire = () => {
        let reste =
          faites >= 2 && faites < prevues
            ? Math.ceil(((prevues - faites) * (performance.now() - debut)) / faites / 1000)
            : 0;
        $etat.text(
          enAttente
            ? "en attente : le replacement de l'armée passe d'abord"
            : prevues
              ? `chargement ${numeral(faites).format()} / ${numeral(prevues).format()}${reste ? `, encore ≈ ${numeral(reste).format()} s` : ""}`
              : "chargement…",
        );
      },
      suivi = {
        prevoir: (/** @type {Number} */ n) => {
          if (!prevues) debut = performance.now();
          prevues += n;
          ecrire();
        },
        faite: () => {
          faites++;
          ecrire();
        },
        attente: (/** @type {Boolean} */ oui) => {
          // l'attente d'un replacement ne compte pas dans la durée moyenne d'une lecture
          if (oui && !enAttente) pause = performance.now();
          if (!oui && enAttente && prevues) debut += performance.now() - pause;
          enAttente = oui;
          ecrire();
        },
        fin: () => {
          if (chargementBloc === suivi) chargementBloc = null;
          $etat.remove();
        },
      };
    chargementBloc = suivi;
    ecrire();
    return suivi;
  }
  /**
   * Charge ce que la page ne donne pas : troupes des attaques lancées ailleurs,
   * mes chasses, les floods partagés sur moi et les TdC, puis complète le bloc.
   * Rien n'est lu tant qu'un replacement de l'armée est attendu ou en cours.
   * Sans attaque, le bloc n'est qu'un titre pendant le chargement, et il est
   * retiré s'il n'y a ni chasse ni flood sur moi.
   *
   * @static
   * @method chargerMouvements
   * @param {jQuery} $bloc
   * @param {Array} attaques {ligne, capture} de la liste du jeu
   * @return {Promise}
   */
  static chargerMouvements($bloc, attaques) {
    let suivi = AttaqueLancee.suiviChargement($bloc),
      mesure = { fin: () => {} };
    return AttaqueLancee.apresReplacement()
      .then(() => {
        // l'attente d'un replacement de l'armée n'est pas mesurée
        mesure = Journal.mesurer("Bloc « Mes attaques en cours »");
        return AttaqueLancee.reconstituer(attaques, suivi).catch(() => []);
      })
      .then((faites) => {
        faites.forEach((a) => {
          let $ligne = $bloc.find(`tr.o_ligneAttaque[data-id='${a.ligne.id}']`);
          $ligne.find(".o_priseAttaque").html(AttaqueLancee.priseEstimee(a));
          $ligne.find(".o_troupesCourtes").attr("title", AttaqueLancee.detail(a));
        });
        return AttaqueLancee.apresReplacement();
      })
      .then(() => AttaqueLancee.mouvements(attaques, suivi))
      .then((m) => {
        suivi.fin();
        mesure.fin();
        if (!attaques.length && !m.chasses.length && !m.recus.length) return void $bloc.remove();
        $bloc.removeClass("o_attaquesVide");
        AttaqueLancee.insererMouvements($bloc, m);
      });
  }
  /**
   * @private
   * @static
   * @param {Number|null|undefined} tdc
   * @return {String} TdC écrit, « ? » s'il est inconnu
   */
  static _tdc(tdc) {
    return tdc == null ? "?" : numeral(tdc).format();
  }
  /**
   * Complète le tableau de mes attaques : variation et TdC de chacune d'après
   * la simulation, lignes de mes chasses (bouton « Partager » si elle n'est pas
   * dans le forum) et des floods partagés sur moi, le tout dans l'ordre de la
   * simulation (minute du rapport, chasses d'abord, puis floods par numéro).
   *
   * @static
   * @method insererMouvements
   * @param {jQuery} $bloc bloc « Mes attaques en cours »
   * @param {Object} mouvements voir lireMouvements
   */
  static insererMouvements($bloc, mouvements) {
    let $corps = $bloc.find("table.o_attaquesLancees tbody"),
      tag = Utils.echapper(Utils.alliance || "l'alliance"),
      heure = (/** @type {String} */ date) =>
        moment(date, "YYYY-MM-DD HH:mm").format("DD/MM HH[h]mm");
    $corps.children("tr.o_ligneAttaque").each((i, tr) => {
      let e = mouvements.floods[tr.dataset.id];
      if (e) {
        // même minute que la simulation : la ligne est rangée où son TdC a été calculé
        tr.dataset.date = e.date;
        // attaque que cette page ne sait pas décrire : unités de sa ligne du forum
        let $unites = $(tr).find(".o_troupesCourtes");
        if ($unites.text() == "?" && e.unites != null) $unites.text(numeral(e.unites).format());
        $(tr)
          .find(".o_priseAttaque")
          .html(
            PartageChasses.libellePrise(
              { delta: e.prise, statut: e.statut, lieu: e.lieu || null },
              "",
            ),
          );
      }
      $(tr)
        .find(".o_tdcApres")
        .text(AttaqueLancee._tdc(e ? e.tdcLanceurApres : null));
    });
    mouvements.chasses.forEach((c) => {
      // unités : « — » quand le jeu ne détaille pas les troupes (hors Compte+) ou sans la page Ressources
      let e = c.evenement,
        s = c.groupe ? PageRessource.sommeChasses(c.groupe.chasses) : null,
        nb = c.groupe ? c.groupe.chasses.length : 1,
        $tr = $(
          `<tr class="o_ligneChasse" data-date="${e.date}" data-id="0" title="Chasse en cours : heure du rapport, à la minute"><td></td>
          <td>${heure(e.date)}</td><td>Chasse${nb > 1 ? ` <small>× ${numeral(nb).format()}</small>` : ""}</td>
          <td class="o_troupesCourtes">${s && s.total ? numeral(s.total).format() : "—"}</td>
          <td class="o_priseAttaque">${PartageChasses.libellePrise({ delta: e.prise }, "")}</td>
          <td class="o_tdcApres">${AttaqueLancee._tdc(e.tdcApres)}</td>
          <td class="o_attaqueActions">${
            c.partagee
              ? `<span class="o_attaquePartage" title="Déjà publiée dans le forum de la ${tag}">Partagée ✓</span>`
              : `<button type="button" class="o_button f_info o_chassePartager" title="Partager cette chasse avec la ${tag}">Partager</button>`
          }</td></tr>`,
        );
      if (s && s.detail) $tr.find(".o_troupesCourtes").attr("title", s.detail);
      $tr.find(".o_chassePartager").data("o_groupe", c.groupe);
      $corps.append($tr);
    });
    mouvements.recus.forEach((e) => {
      $corps.append(
        `<tr class="o_ligneRecue" data-date="${e.date}" data-id="${e.id || 0}" title="Flood partagé dans le forum de l'alliance : heure du rapport, à la minute"><td></td>
        <td>${heure(e.date)}</td>
        <td class="o_cibleAttaque"><a href="Membre.php?Pseudo=${encodeURIComponent(e.lanceur)}">${Utils.echapper(e.lanceur)}</a> → moi</td>
        <td class="o_troupesCourtes">${e.unites != null ? numeral(e.unites).format() : "?"}</td>
        <td class="o_priseAttaque">${PartageChasses.libellePrise({ delta: -e.prise, statut: e.statut, lieu: e.lieu || null }, "")}</td>
        <td class="o_tdcApres">${AttaqueLancee._tdc(e.tdcCibleApres)}</td>
        <td class="o_attaqueActions"></td></tr>`,
      );
    });
    // comme simuler : à minute égale, les chasses (numéro 0) puis les floods par numéro d'attaque
    let cle = (/** @type {HTMLElement} */ tr) =>
      `${tr.dataset.date}|${String(tr.dataset.id).padStart(12, "0")}`;
    $corps.append(
      $corps
        .children("tr")
        .get()
        .sort((a, b) => (cle(a) < cle(b) ? -1 : cle(a) > cle(b) ? 1 : 0)),
    );
    $corps.children("tr").each((i, tr) => {
      $(tr).toggleClass("ligne_paire", i % 2 == 1);
      tr.cells[0].textContent = String(i + 1);
    });
    $bloc.find(".o_attaquesCompte").text(`(${$corps.children("tr").length})`);
    $bloc.off("click.o_chasses").on("click.o_chasses", ".o_chassePartager", (e) => {
      AttaqueLancee.partagerChasses($(e.currentTarget));
    });
    AttaqueLancee.majPartages();
    AttaqueLancee.figerActions();
    AttaqueLancee.ajusterTaille();
  }
  /**
   * Publie dans le sujet « Chasses » du joueur les chasses de ces boutons
   * « Partager » ; ils deviennent « Partagée ✓ » quand le forum les a.
   *
   * @static
   * @method partagerChasses
   * @param {jQuery} $boutons boutons .o_chassePartager
   * @return {Promise}
   */
  static partagerChasses($boutons) {
    let groupes = $boutons
      .get()
      .map((b) => $(b).data("o_groupe"))
      .filter(Boolean);
    if (!groupes.length) return Promise.resolve();
    return PartageChasses.partager(PageRessource.aPartager(groupes), $boutons).then((fait) => {
      if (!fait) return;
      $boutons.replaceWith(
        `<span class="o_attaquePartage" title="Déjà publiée dans le forum de la ${Utils.echapper(Utils.alliance || "l'alliance")}">Partagée ✓</span>`,
      );
      AttaqueLancee.majPartages();
    });
  }
  /**
   * Bloc « Mes attaques en cours » : mes attaques de la liste du jeu, puis,
   * une fois le forum et la page Ressources lus, mes chasses et les floods
   * partagés sur moi, dans l'ordre, avec la variation de mon TdC et mon TdC
   * après chacun (le contenu de la page d'un membre, pour moi). Chaque attaque
   * a ses boutons : copie au format du jeu, partage dans le forum, annulation
   * (copie du lien Annuler du jeu), unitaire ou groupée ; chaque chasse, son
   * partage.
   *
   * La liste du jeu reste telle quelle sous « Attaque(s) en cours ». Pour une
   * attaque non capturée, troupes et lieu viennent du texte du jeu quand il les
   * donne (C+), sinon « ? ».
   *
   * @param {Boolean} afficher false : captures et partages suivis, sans le bloc
   */
  static afficherTableaux(afficher = true) {
    let echecs = sessionStorage.getItem(CLE_ANNULATION_ECHEC);
    if (echecs) {
      sessionStorage.removeItem(CLE_ANNULATION_ECHEC);
      $.toast({
        ...TOAST_WARNING,
        text: `${echecs} attaque${echecs > 1 ? "s" : ""} n'${echecs > 1 ? "ont" : "a"} pas pu être annulée${echecs > 1 ? "s" : ""} : le délai d'annulation du jeu est dépassé.`,
      });
    }
    let lignes = AttaqueLancee.extraireLignes(),
      liste = AttaqueLancee.synchroniser(lignes),
      attaques = lignes
        .filter((l) => l.cible)
        .map((l) => ({
          ligne: l,
          capture: liste.find((a) => a.id == l.id) || null,
          annuler: $(l.elt).nextAll(`a[href$='annuler=${l.id}']`).first(),
        }));
    AttaqueLancee.partagerMarquees();
    // les captures restent synchronisées (partage des floods) même sans la liste
    if (!afficher || !Utils.affichage("listeAttaques")) return;
    // une seule liste, dans l'ordre d'arrivée : # | Arrivée | moi → cible (tag
    // coloré) | Unités (détail et lieu au survol) | Variation | TdC après | boutons
    let id = "o_attaquesLancees",
      tag = Utils.alliance || "l'alliance";
    attaques.sort((a, b) => a.ligne.arrivee - b.ligne.arrivee);
    let annulables = attaques.filter((a) => a.annuler.length),
      // type="button" : un <button> nu soumettrait un formulaire englobant
      html = `<table class="o_attaquesLancees o_maxWidth centre" cellspacing="0">
        ${AttaqueLancee.ENTETE}
        <tbody>`;
    attaques.forEach((a, i) => {
      // data-date, data-id : place de la ligne parmi les chasses et les floods reçus
      html += `<tr class="o_ligneAttaque${i % 2 ? " ligne_paire" : ""}" data-id="${a.ligne.id}" data-date="${Utils.minuteRC(a.ligne.arrivee).format("YYYY-MM-DD HH:mm")}"><td>${i + 1}</td>
        ${
          a.ligne.incertaine
            ? `<td class="o_arriveeIncertaine" title="Heure du jeu, à la minute : l'horloge de ce navigateur est décalée (mise en veille, cache). Recharge la page pour retrouver les secondes.">${a.ligne.arrivee.format("DD/MM HH[h]mm")}</td>`
            : `<td title="RC à ${Utils.minuteRC(a.ligne.arrivee).format("HH[h]mm")}">${a.ligne.arrivee.format("DD/MM HH[h]mm:ss")}</td>`
        }
        <td class="o_cibleAttaque">moi → ${a.ligne.cibleHtml || a.ligne.cible}</td>
        <td class="o_troupesCourtes" title="${AttaqueLancee.detail(a)}">${AttaqueLancee.quantite(a)}</td>
        <td class="o_priseAttaque">${AttaqueLancee.priseEstimee(a)}</td>
        <td class="o_tdcApres">…</td>
        <td class="o_attaqueActions"><button type="button" class="o_button o_attaqueCopier" data-i="${i}" title="Copier le détail de l'attaque">Copier</button><button type="button" class="o_button f_info o_attaquePartager" data-i="${i}" data-id="${a.ligne.id}" title="Partager cette attaque avec la ${tag}">Partager</button><span id="${id}Annuler${i}" class="o_attaqueAnnuler"></span></td></tr>`;
    });
    html += `</tbody></table>`;
    // boutons groupés sur la ligne du titre : une rangée de moins
    let boutons = attaques.length
      ? `<span class="o_attaquesBoutons o_attaquesEnTete"><button type="button" id="${id}PartagerTout" class="o_button f_info" title="Partager tous mes floods et toutes mes chasses avec la ${tag}">Partager tous</button>${annulables.length > 1 ? `<button type="button" id="${id}ToutAnnuler" class="o_button f_error">Tout annuler</button>` : ""}</span>`
      : "";
    // en haut de la page ; la liste du jeu sous « Attaque(s) en cours » reste telle
    // quelle. Armée et Attaquer visent le premier .simulateur qui n'est pas un
    // .o_blocAttaques (tableau de l'armée, formulaire d'attaque)
    // sans attaque : seulement le titre et l'avancement, le temps de savoir s'il y a
    // une chasse ou un flood sur moi à montrer
    let $bloc = $(
      `<div id="${id}" class="boite_amelioration simulateur centre o_blocAttaques${attaques.length ? "" : " o_attaquesVide"}">` +
        Utils.spoiler(
          `Mes attaques en cours <span class="o_attaquesCompte">${attaques.length ? `(${attaques.length})` : ""}</span><span class="o_attaquesChargement" role="status"></span>${boutons}`,
          html,
          "attaquesEnCours",
          "o_attaquesTitre",
        ) +
        "</div>",
    );
    AttaqueLancee.placer($bloc);
    AttaqueLancee.colorerTags($(`#${id}`));
    AttaqueLancee.chargerMouvements($bloc, attaques);
    if (!attaques.length) return;
    // un clic sur ces boutons ne replie pas l'encart (titre cliquable)
    $(`#${id} .o_attaquesEnTete`).on("click", (e) => e.stopPropagation());
    // lien Annuler du jeu copié dans le tableau. Pour une attaque capturée on
    // connaît l'heure de lancement : la copie est retirée dès que la fenêtre
    // d'annulation du jeu est passée.
    let majToutAnnuler = () => {
      if (attaques.filter((a) => $(a.cellule).find("a").length).length < 2)
        $(`#${id}ToutAnnuler`).hide();
    };
    attaques.forEach((a, i) => {
      let restant =
        a.capture && !a.capture.reconstituee
          ? a.capture.lancee + DELAI_ANNULATION * 1000 - Horloge.maintenant()
          : null;
      a.cellule = `#${id}Annuler${i}`;
      if (a.annuler.length && !(restant !== null && restant <= 0)) {
        let $lien = a.annuler.clone().text("Annuler").appendTo(a.cellule);
        // délai d'annulation restant affiché à côté du lien (affichage seul)
        if (restant !== null) {
          let fin = Date.now() + restant,
            $reste = $("<span class='o_annulerReste'></span>").appendTo($lien),
            tic = () => {
              let s = Math.ceil((fin - Date.now()) / 1000);
              if (s <= 0) {
                $(a.cellule).empty();
                majToutAnnuler();
                return;
              }
              $reste.text(` ${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`);
              setTimeout(tic, 250);
            };
          tic();
        }
      }
    });
    majToutAnnuler();
    AttaqueLancee.majPartages();
    $(`#${id} .o_attaqueCopier`).on("click", (e) => {
      let a = attaques[parseInt(e.currentTarget.dataset.i)];
      CommerceFzzz.copier(
        AttaqueLancee.formatForum(a.ligne.cible, [a]),
        "Attaque copiée dans le presse-papier.",
      );
    });
    // délégué : « Partagé ✓ » redevient un bouton si le forum n'a plus le flood
    $(`#${id}`).on("click", ".o_attaquePartager", (e) =>
      PartageChasses.partagerFloods(
        [AttaqueLancee.pourPartage(attaques[parseInt(e.currentTarget.dataset.i)])],
        $(e.currentTarget),
      ),
    );
    $(`#${id}PartagerTout`).on("click", (e) => {
      let restants = $(`#${id} .o_attaquePartager`)
          .map((i, b) => parseInt(b.dataset.id))
          .get(),
        floods = attaques
          .filter((a) => restants.includes(a.ligne.id))
          .map(AttaqueLancee.pourPartage)
          .filter((c) => PartageChasses.entreesFloods([c]).length),
        $chasses = $(`#${id} .o_chassePartager`);
      // rien à partager : partagerFloods le dit ; un refus du forum pour les
      // floods vaudrait aussi pour les chasses, qui ne sont alors pas tentées
      (floods.length || !$chasses.length
        ? PartageChasses.partagerFloods(floods, $(e.currentTarget))
        : Promise.resolve(true)
      ).then((fait) => (fait ? AttaqueLancee.partagerChasses($chasses) : null));
    });
    // annulation groupée : les liens Annuler du jeu, appelés l'un après
    // l'autre. Le jeu n'autorise l'annulation que peu de temps après le
    // lancement : la dernière réponse (page complète) dit quelles attaques
    // sont encore là, le compte est signalé après rechargement.
    $(`#${id}ToutAnnuler`).click(() => {
      let encore = attaques.filter((a) => $(a.cellule).find("a").length);
      if (!encore.length || !confirm(`Annuler les ${encore.length} attaques ?`)) return;
      $(`#${id}ToutAnnuler`).prop("disabled", true).text("Annulation…");
      encore
        .reduce(
          (suite, a) => suite.then(() => $.get($(a.cellule).find("a").attr("href"))),
          Promise.resolve(),
        )
        .then((html) => {
          let restantes = AttaqueLancee.extraireLignes(Utils.parseHtml(html)).map((l) => l.id),
            echecs = encore.filter((a) => restantes.indexOf(a.ligne.id) != -1).length;
          if (echecs) sessionStorage.setItem(CLE_ANNULATION_ECHEC, echecs);
        })
        .finally(() => AttaqueLancee.recharger());
    });
    $(`#${id}`).on("click", ".o_attaqueAnnuler a", (e) => {
      e.preventDefault();
      AttaqueLancee.annulerSurPlace($(e.currentTarget));
    });
    AttaqueLancee.figerActions();
    AttaqueLancee.ajusterTaille();
  }
  /**
   * Annuler : le lien du jeu (…?annuler=id) renvoie sur la page Ennemies ;
   * l'annulation est donc envoyée en arrière-plan puis la page courante est
   * rechargée, au même endroit (Utils.garderPosition). L'ordre du jeu est
   * annulé d'abord ; le partage du forum, s'il y en a un, est retiré ensuite,
   * par la page rechargée, quand l'attaque n'est plus dans la liste du jeu
   * (synchroniser) : un flood que le jeu a refusé d'annuler reste partagé.
   *
   * @static
   * @method annulerSurPlace
   * @param {Object} $lien (jQuery) lien Annuler
   */
  static annulerSurPlace($lien) {
    if ($lien.hasClass("o_enCours")) return;
    $lien.addClass("o_enCours").css("pointer-events", "none");
    let id = parseInt((String($lien.attr("href")).match(/annuler=(\d+)/) || [])[1]);
    // passe devant les lectures du forum encore en attente (REQUETES_ACTION)
    Promise.resolve($.get($lien.attr("href")))
      .then((html) => {
        // la réponse du jeu liste les attaques en cours : celle-ci y est encore
        // si le jeu a refusé (délai d'annulation dépassé), signalé après rechargement
        let restantes = AttaqueLancee.extraireLignes(Utils.parseHtml(String(html))).map(
          (l) => l.id,
        );
        if (id && restantes.includes(id)) sessionStorage.setItem(CLE_ANNULATION_ECHEC, "1");
      })
      .catch(() => null)
      .then(() => AttaqueLancee.recharger());
  }
  /**
   * Relit la page courante par une navigation GET et non reload() : elle peut
   * être la réponse du POST de lancement, qu'un reload rejouerait.
   *
   * @static
   * @method recharger
   */
  static recharger() {
    location.replace(location.pathname + location.search);
  }
  /**
   * Bloc collé sous le menu du jeu et qui le reste en faisant défiler la
   * page, comme le menu.
   *
   * @static
   * @method epingler
   * @param {HTMLElement} bloc
   */
  static epingler(bloc) {
    let menu = document.getElementById("menu_horizontal") || document.getElementById("menu");
    if (!menu) return;
    // bandeau du titre aux couleurs du menu principal
    let titre = bloc.querySelector(".o_attaquesTitre");
    for (let m of [menu, document.getElementById("menu")]) {
      if (!m || !titre) continue;
      let cs = getComputedStyle(m),
        couleur = cs.backgroundColor != "transparent" && !/,\s*0\)$/.test(cs.backgroundColor);
      if (cs.backgroundImage != "none" || couleur) {
        titre.style.background = "none";
        titre.style.backgroundColor = couleur ? cs.backgroundColor : "";
        titre.style.backgroundImage = cs.backgroundImage;
        break;
      }
    }
    let z = parseInt(getComputedStyle(document.getElementById("menu") || menu).zIndex);
    bloc.style.zIndex = String(isNaN(z) ? 50 : Math.max(1, z - 1));
    bloc.classList.add("o_epingle");
    let caler = () => {
      // plus large que le premier cadre du jeu (« Troupes en garnison »,
      // formulaire d'attaque), sans dépasser le menu : à mi-chemin des deux
      let cadre = $(".simulateur:not(.o_blocAttaques):first")[0],
        largeurMenu = menu.getBoundingClientRect().width,
        largeurCadre = cadre ? cadre.getBoundingClientRect().width : 0;
      if (largeurCadre && largeurMenu > largeurCadre)
        bloc.style.width = Math.round((largeurCadre + largeurMenu) / 2) + "px";
      // la barre visible (#menu_horizontal) est dans #menu, qui peut être celui fixé
      let porteur = [menu, document.getElementById("menu")].find(
          (m) => m && /fixed|sticky/.test(getComputedStyle(m).position),
        ),
        bas = menu.getBoundingClientRect().bottom;
      // position d'origine mesurée hors défilement collant
      bloc.style.position = "static";
      Utils.calerSousMenu(bloc, 0);
      // les marges des blocs sont en !important dans la feuille de style
      bloc.style.setProperty("margin-top", bloc.style.marginTop, "important");
      bloc.style.position = "";
      bloc.style.top =
        (!porteur
          ? 0
          : getComputedStyle(porteur).position == "fixed"
            ? bas
            : (parseFloat(getComputedStyle(porteur).top) || 0) +
              bas -
              porteur.getBoundingClientRect().top) + "px";
    };
    caler();
    $(window).on("load resize", caler);
  }
  /**
   * Colonne des actions : largeur réservée pour le plus large de « Partager »
   * et « Partagé ✓ », pour que partager un flood ne fasse pas bouger le tableau.
   *
   * @static
   * @method figerActions
   */
  static figerActions() {
    let $table = $(".o_attaquesLancees").first(),
      $cellules = $table.find("td.o_attaqueActions");
    if (!$cellules.length) return;
    let $essai = $(
        `<span class="o_attaquePartage">Partagé ✓</span><button type="button" class="o_button f_info o_attaquePartager">Partager</button>`,
      ),
      $cadre = $("<span style='position:absolute;visibility:hidden;white-space:nowrap'></span>")
        .append($essai)
        .appendTo($cellules.first()),
      surplus = Math.max(
        0,
        $cadre.children().eq(0).outerWidth() - $cadre.children().eq(1).outerWidth(),
      ),
      largeur = 0;
    $cadre.remove();
    $cellules.each((i, td) => {
      largeur = Math.max(
        largeur,
        $(td).outerWidth() + ($(td).find(".o_attaquePartager").length ? surplus : 0),
      );
    });
    $cellules.css("min-width", largeur + "px");
  }
  /**
   * Une attaque par ligne : si le tableau dépasse son cadre, la police
   * rétrécit (jusqu'à 60 %), recalculé quand la fenêtre change de taille.
   *
   * @static
   * @method ajusterTaille
   */
  static ajusterTaille() {
    let $t = $(".o_attaquesLancees").first();
    if (!$t.length) return;
    let cadre = $t.closest(".o_blocAttaques")[0] || $t.parent()[0],
      ajuster = () => {
        let taille = 100;
        $t.css("font-size", "");
        while (taille > 60 && $t[0].scrollWidth > cadre.clientWidth) {
          taille -= 5;
          $t.css("font-size", taille + "%");
        }
      };
    ajuster();
    if (!ajustementTailleActif) {
      ajustementTailleActif = true;
      let attente = null;
      $(window).on("resize", () => {
        clearTimeout(attente);
        attente = setTimeout(ajuster, 150);
      });
    }
  }
  /**
   * Numéros des attaques affichées qui ont un bouton de partage.
   *
   * @static
   * @method idsAffiches
   * @return {Array<Number>}
   */
  static idsAffiches() {
    return $(".o_attaquePartager, .o_floodPartage")
      .map((i, b) => parseInt(b.dataset.id))
      .get()
      .filter(Boolean);
  }
  /**
   * Floods déjà publiés dans le forum de l'alliance : « Partagé ✓ » à la place
   * du bouton, et bouton « Partager TOUS » désactivé s'il ne reste rien.
   *
   * @static
   * @method majPartages
   */
  static majPartages() {
    let partages = PartageChasses.floodsPartages(),
      tag = Utils.echapper(Utils.alliance || "l'alliance");
    $(".o_attaquePartager").each((i, bouton) => {
      if (partages[bouton.dataset.id])
        $(bouton).replaceWith(
          `<span class="o_attaquePartage o_floodPartage" data-i="${bouton.dataset.i}" data-id="${bouton.dataset.id}" title="Déjà publié dans le forum de la ${tag}">Partagé ✓</span>`,
        );
    });
    // le forum n'a plus ce flood (retiré depuis un autre appareil) : à partager de nouveau
    $(".o_floodPartage").each((i, marque) => {
      if (!partages[marque.dataset.id])
        $(marque).replaceWith(
          `<button type="button" class="o_button f_info o_attaquePartager" data-i="${marque.dataset.i}" data-id="${marque.dataset.id}" title="Partager ce flood avec la ${tag}">Partager</button>`,
        );
    });
    let reste = $(".o_attaquePartager").length + $(".o_chassePartager").length;
    $("#o_attaquesLanceesPartagerTout")
      .prop("disabled", !reste)
      .text(reste ? "Partager tous" : "Tous partagés ✓");
  }

  /**
   * Composition {nom d'unité: nombre} d'après le texte du jeu
   * (« 30 000 Jeunes Soldates Naines, 2 000 Soldates »).
   *
   * @static
   * @method uniteNatif
   */
  static uniteNatif(texte) {
    let unite = {};
    String(texte || "")
      .split(/,|\bet\b/)
      .forEach((morceau) => {
        let m = morceau.trim().match(/^(\d[\d\s\u00a0\u202f]*)\s+(.+)$/),
          i = m ? Utils.uniteDepuisLibelle(m[2]) : -1;
        if (i > 0)
          unite[NOM_UNITE[i]] = (unite[NOM_UNITE[i]] || 0) + parseInt(m[1].replace(/\D/g, ""));
      });
    return unite;
  }
  /**
   * Attaques (terrain, dôme ou loge) affichées sans capture (lancées sur un
   * autre appareil, ou capture perdue) : capture reconstituée avec les données
   * du jeu (arrivée, lieu, troupes) et le TdC de la cible lu sur sa page
   * joueur, une lecture par cible. Le départ est déduit du trajet : pour une
   * même cible, l'ordre des arrivées est celui des lancements.
   *
   * @static
   * @method reconstituer
   * @param {Array} attaques {ligne, capture}
   * @param {Object|null} [suivi] suiviChargement, prévenu de chaque page lue
   * @return {Promise<Array>} attaques complétées
   */
  static reconstituer(attaques, suivi = null) {
    let manquantes = attaques.filter(
      (a) =>
        !a.capture &&
        a.ligne.cible &&
        AttaqueLancee.zoneLieu(a.ligne.lieuNatif) &&
        Object.keys(AttaqueLancee.uniteNatif(a.ligne.troupesNatif)).length,
    );
    if (!manquantes.length) return Promise.resolve([]);
    let cibles = [...new Set(manquantes.map((a) => a.ligne.cible))];
    if (suivi) suivi.prevoir(cibles.length);
    let profils = cibles.map((pseudo) => {
      let j = new Joueur({ pseudo });
      return Promise.resolve(j.getProfil())
        .then((html) => (j.chargerProfil(html) ? j : null))
        .catch(() => null)
        .then((lu) => {
          if (suivi) suivi.faite();
          return lu;
        });
    });
    return Promise.all(profils).then((joueurs) => {
      let liste = AttaqueLancee.charger();
      manquantes
        .sort((a, b) => a.ligne.arrivee - b.ligne.arrivee)
        .forEach((a) => {
          let l = a.ligne,
            j = joueurs.find((x) => x && x.pseudo == l.cible),
            capture = {
              id: l.id,
              cible: l.cible,
              lieu: l.lieuNatif,
              unite: AttaqueLancee.uniteNatif(l.troupesNatif),
              lancee: l.arrivee.valueOf() - (j ? monProfil.getTempsParcours2(j) * 1000 : 0),
              arrivee: l.arrivee.valueOf(),
              terrainDepart: null,
              terrainCible: null,
              terrainConnu: j && j.terrain > 0 ? j.terrain : null,
              reconstituee: true,
            },
            precedente = liste
              .filter(
                (x) => x.cible == l.cible && x.terrainCible != null && x.arrivee < capture.arrivee,
              )
              .sort((x, y) => x.arrivee - y.arrivee)
              .pop();
          AttaqueLancee.estimerTerrain(
            capture,
            precedente ? precedente.terrainCible : capture.terrainConnu,
          );
          liste.push(capture);
          AttaqueLancee.noterDehors(capture);
          a.capture = capture;
        });
      AttaqueLancee.sauvegarder(liste);
      return manquantes;
    });
  }
  /**
   * Attaque à partager : la capture, ou à défaut les données du jeu (date
   * d'arrivée, cible, lieu et troupes affichés en C+) pour une attaque lancée
   * sans que l'extension la capture (autre appareil, formulaire du jeu).
   *
   * @static
   * @method pourPartage
   */
  static pourPartage(a) {
    let l = a.ligne,
      natif = {
        id: l.id,
        cible: l.cible,
        lieu: l.lieuNatif,
        arrivee: l.arrivee ? l.arrivee.valueOf() : null,
        unite: { total: parseInt(String(AttaqueLancee.quantite(a)).replace(/\D/g, "")) || 0 },
      };
    return a.capture
      ? { ...natif, ...a.capture, arrivee: a.capture.arrivee || natif.arrivee }
      : natif;
  }
  /**
   * Fzzz : TdC que l'attaque prendra (règle des 20 %, estimée au lancement,
   * la même au terrain, au dôme et en loge), « — » si le lieu est inconnu,
   * « ? » si le TdC de la cible était inconnu.
   */
  static priseEstimee(a) {
    let c = a.capture;
    if (!AttaqueLancee.zoneLieu(AttaqueLancee.lieu(a))) return "—";
    if (!c || c.terrainDepart == null || c.terrainCible == null) return "?";
    let prise = c.terrainDepart - c.terrainCible,
      unites = Object.values(c.unite || {}).reduce((t, n) => t + (n || 0), 0);
    return `${numeral(prise).format()}${prise < unites ? " <small class='o_priseNote'>(20 %)</small>" : ""}`;
  }
  /**
   * Nombre total d'unités envoyées (« 2 111 »), « ? » si inconnu.
   */
  static quantite(a) {
    if (a.capture)
      return numeral(Object.values(a.capture.unite).reduce((t, n) => t + (n || 0), 0)).format();
    let t = a.ligne.troupesNatif;
    if (!t) return "?";
    return numeral(
      (t.match(/\d[\d \u00a0\u202f]*/g) || []).reduce(
        (s, n) => s + parseInt(n.replace(/\D/g, "")),
        0,
      ),
    ).format();
  }
  /**
   * Tag d'alliance de la cible : vert pour sa propre alliance, sinon la couleur
   * que le jeu donne à l'alliance (règles .pacte_… de la page : bleu pour un
   * pacte, rouge pour une guerre quand le jeu la marque), noir à défaut.
   */
  static colorerTags($zone) {
    let couleurs = {};
    $("style").each((i, st) => {
      let re = /\.([\w-]+)\s*(?:,[^{]*)?\{\s*color\s*:\s*(#[0-9a-fA-F]{3,6})/g,
        m;
      while ((m = re.exec(st.textContent))) couleurs[m[1]] = m[2];
    });
    $zone.find(".o_cibleAttaque").each((i, td) => {
      let $tag = $(td).find("a[href*='alliance']").first();
      if (!$tag.length) return;
      let classes = ($tag.attr("class") || "") + " " + ($tag.parent().attr("class") || ""),
        couleur =
          $tag.text().trim() == Utils.alliance
            ? "#287A36"
            : classes
                .split(/\s+/)
                .map((c) => couleurs[c])
                .find(Boolean) || "#000000";
      $tag.css("color", couleur);
    });
  }
  /**
   * Nœuds natifs d'une ligne « Vous allez attaquer » (lus pour le C+, puis
   * retirés une fois le contenu déplacé dans un tableau) : les frères du span
   * de compte à rebours, jusqu'au saut de ligne précédent (ou au titre) et
   * jusqu'au saut de ligne suivant inclus — plus, en C+, le bloc de détail
   * (troupes, arrivée) qui suit ce saut de ligne jusqu'au suivant. Le span
   * lui-même et le lien Annuler sont exclus (déplacés, pas supprimés).
   *
   * @param {Element} elt span du compte à rebours
   * @return {Array} nœuds à supprimer
   */
  static noeudsLigne(elt) {
    let noeuds = [],
      estArret = (n) => n.nodeType == 1 && ["BR", "H3"].indexOf(n.tagName) != -1,
      n = elt.previousSibling;
    while (n && !estArret(n)) {
      noeuds.push(n);
      n = n.previousSibling;
    }
    n = elt.nextSibling;
    let detailVu = false;
    while (n) {
      if (!(n.nodeType == 1 && n.tagName == "A" && /annuler=/.test(n.getAttribute("href") || "")))
        noeuds.push(n);
      if (estArret(n)) {
        let suivant = n.nextSibling;
        if (detailVu || !(suivant && suivant.nodeType == 1 && suivant.tagName == "SMALL")) break;
        detailVu = true;
      }
      n = n.nextSibling;
    }
    return noeuds;
  }
  /**
   * Lieu d'une attaque : capture, sinon texte du jeu.
   */
  static lieu(a) {
    return a.capture ? a.capture.lieu : a.ligne.lieuNatif;
  }
  /**
   * Zone d'un libellé de lieu du jeu (« Loge Impériale », « Fourmilière »…).
   *
   * @static
   * @method zoneLieu
   * @param {String} lieu
   * @return {String|null} "TdC", "Dôme", "Loge", ou null si inconnu
   */
  static zoneLieu(lieu) {
    lieu = lieu || "";
    if (/terrain/i.test(lieu)) return "TdC";
    if (/d[ôo]me|fourmili/i.test(lieu)) return "Dôme";
    if (/loge/i.test(lieu)) return "Loge";
    return null;
  }
  /**
   * Info-bulle des unités d'une attaque : ses troupes et le lieu attaqué.
   *
   * @static
   * @method detail
   * @return {String}
   */
  static detail(a) {
    let troupes = AttaqueLancee.troupes(a),
      lieu = AttaqueLancee.lieu(a);
    return troupes
      ? `${lieu ? `${lieu} : ` : ""}${troupes}`
      : "Détail inconnu (attaque lancée depuis un autre navigateur)";
  }
  /**
   * Troupes d'une attaque : capture, sinon texte du jeu (C+), sinon null.
   */
  static troupes(a) {
    return a.capture ? new Armee({ unite: a.capture.unite }).toString() : a.ligne.troupesNatif;
  }
  /**
   * Texte à coller sur le forum : une entrée par attaque au format des lignes
   * du jeu, puis le terrain estimé de la cible après la dernière.
   */
  static formatForum(cible, groupe) {
    let texte = groupe
        .map((a) => {
          let secondes = Math.max(0, a.ligne.arrivee.diff(Horloge.serveur(), "s")),
            lieu = AttaqueLancee.lieu(a),
            troupes = AttaqueLancee.troupes(a),
            lignes = [
              `- Vous allez attaquer ${cible}${lieu ? ` (${lieu})` : ""} dans ${Utils.intToTime(secondes)}`,
            ];
          if (troupes) lignes.push(`Troupes en attaques : ${troupes}`);
          lignes.push(`Arrivée ${AttaqueLancee.formatArrivee(secondes)}`);
          return lignes.join("\n");
        })
        .join("\n\n"),
      derniere = groupe
        .filter((a) => a.capture && a.capture.terrainCible != null)
        .sort((a, b) => a.capture.lancee - b.capture.lancee)
        .pop();
    if (derniere)
      texte += `\n\nTerrain estimé de ${cible} à l'arrivée : ${numeral(derniere.capture.terrainCible).format()}`;
    return texte;
  }
}
