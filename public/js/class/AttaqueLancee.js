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
// fenêtre (s) pendant laquelle le jeu accepte d'annuler une attaque après son lancement
const DELAI_ANNULATION = 120;
// nombre d'attaques qu'un « Tout annuler » n'a pas pu annuler, affiché après rechargement
const CLE_ANNULATION_ECHEC = "outiiil_annulationEchec";

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
        : a.lancee && moment().diff(a.lancee, "s") < DUREE_VIE_CAPTURE,
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
        lancee: moment().valueOf(),
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
   * @return {Array} liste {elt, id, cible (null pour un renfort), cibleHtml, secondes, arrivee}
   */
  static extraireLignes(racine = $(document)) {
    let lignes = [];
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
        troupes = texte.match(/Troupes en attaques?\s*:\s*(.+?)\s*(?:Arrivée|$)/i);
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
        arrivee: Horloge.serveur().add(secondes, "s"),
        lieuNatif: lieu ? lieu[1] : null,
        troupesNatif: troupes ? troupes[1] : null,
      });
    });
    return lignes.sort((a, b) => a.id - b.id);
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
   * terrain de la cible avant l'attaque.
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
   * @return {Array} captures à jour
   */
  static synchroniser(lignes) {
    let liste = AttaqueLancee.charger(),
      modifie = AttaqueLancee.lier(liste, lignes);
    // les pages qui listent les attaques en cours les listent toutes : une
    // capture liée dont la ligne a disparu correspond à une attaque annulée.
    // Elle rend le terrain qu'elle aurait pris aux attaques lancées après elle.
    liste
      .filter((a) => a.id && !lignes.some((l) => l.id == a.id))
      .forEach((annulee) => {
        let prise = annulee.terrainDepart - annulee.terrainCible;
        if (prise > 0)
          liste
            .filter(
              (a) =>
                a.cible == annulee.cible && a.lancee > annulee.lancee && a.terrainDepart != null,
            )
            .forEach((a) => (a.terrainDepart += prise));
        modifie = true;
      });
    liste = liste.filter((a) => !a.id || lignes.some((l) => l.id == a.id));
    TroupesDehors.synchroniserAttaques(lignes);
    if (AttaqueLancee.recalculerTerrains(liste)) modifie = true;
    if (modifie) AttaqueLancee.sauvegarder(liste);
    return liste;
  }
  /**
   * Heure d'arrivée arrondie à la minute, avec la date si ce n'est pas
   * aujourd'hui (rendu calqué sur le natif C+).
   */
  static formatArrivee(secondes) {
    let rArrivee = Utils.roundMinute(secondes);
    return `${rArrivee.isSame(moment(), "day") ? "à" : "le " + rArrivee.format("D MMM à")} ${rArrivee.format("HH[h]mm")}`;
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
      $(ligne.elt)
        .nextAll("script")
        .first()
        .after(
          `<br/><small><em>Arrivée ${AttaqueLancee.formatArrivee(ligne.secondes)}</em></small>`,
        );
    });
    return listeAttaque;
  }
  /**
   * Un tableau récapitulatif par cible : lieu, troupes, temps restant,
   * arrivée, terrain estimé, annulation unitaire ou groupée, et copie au
   * format texte du jeu pour le forum.
   *
   * Les tableaux remplacent les lignes natives « Vous allez attaquer »
   * (toutes les attaques, capturées ou non). Le span du compte à rebours et
   * le lien Annuler du jeu sont déplacés dans le tableau, pas recréés : le
   * compteur natif (fonction reste() du jeu) retrouve le span par son id et
   * continue de le mettre à jour. Pour une attaque non capturée, lieu et
   * troupes viennent du texte du jeu quand il les donne (C+), sinon « ? ».
   */
  static afficherTableaux() {
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
    // les captures restent synchronisées (partage des floods) même sans la liste
    if (!attaques.length || !Utils.affichage("listeAttaques")) return;
    // Fzzz : une seule liste, dans l'ordre d'arrivée : # | Arrivée | Cible (tag
    // coloré) | Troupes (quantité, détail au survol) | Lieu | Copier | Partager
    let conteneur = $(lignes[lignes.length - 1].elt).parent(),
      id = "o_attaquesLancees",
      tag = Utils.alliance || "l'alliance";
    attaques.sort((a, b) => a.ligne.arrivee - b.ligne.arrivee);
    let annulables = attaques.filter((a) => a.annuler.length),
      // type="button" obligatoire : sur la page Attaquer ce bloc est dans le
      // formulaire de lancement du jeu, un <button> nu le soumettrait
      html = `<table class="o_attaquesLancees o_maxWidth centre" cellspacing="0">
        <thead><tr><th>#</th><th>Arrivée</th><th>Cible</th><th>Unités envoyées</th><th>Lieu</th><th title="Au plus 20 % du TdC de la cible à l'impact, d'après le TdC connu au lancement et tes attaques précédentes sur elle">TdC pris (estimé)</th><th></th></tr></thead>
        <tbody>`;
    attaques.forEach((a, i) => {
      html += `<tr${i % 2 ? " class='ligne_paire'" : ""}><td>${i + 1}</td>
        <td>${Utils.roundMinute(a.ligne.secondes).format("DD/MM HH[h]mm")}</td>
        <td class="o_cibleAttaque">${a.ligne.cibleHtml || a.ligne.cible}</td>
        <td class="o_troupesCourtes" title="${AttaqueLancee.troupes(a) || "Détail inconnu (attaque lancée depuis un autre navigateur)"}">${AttaqueLancee.quantite(a)}</td>
        <td class="o_lieuAttaque">${AttaqueLancee.lieu(a) || "?"}</td>
        <td>${AttaqueLancee.priseEstimee(a)}</td>
        <td class="o_attaqueActions"><button type="button" class="o_button o_attaqueCopier" data-i="${i}" title="Copier le détail de l'attaque">Copier</button>${
          /terrain/i.test(AttaqueLancee.lieu(a) || "")
            ? `<button type="button" class="o_button f_info o_attaquePartager" data-i="${i}" data-id="${a.ligne.id}" title="Partager ce flood avec la ${tag}">Partager</button>`
            : ""
        }<span id="${id}Annuler${i}" class="o_attaqueAnnuler"></span><span id="${id}Reste${i}" style="display:none;"></span></td></tr>`;
    });
    html += `</tbody></table>
      ${annulables.length > 1 ? `<div class="o_attaquesBoutons"><button type="button" id="${id}ToutAnnuler" class="o_button f_error">Tout annuler</button></div>` : ""}`;
    conteneur.append(
      `<div id="${id}" class="boite_amelioration simulateur centre o_blocAttaques">` +
        Utils.spoiler(
          `Mes attaques en cours (${attaques.length})`,
          html,
          "attaquesEnCours",
          "o_attaquesTitre",
        ) +
        "</div>",
    );
    AttaqueLancee.colorerTags($(`#${id}`));
    // « Partager TOUS mes floods » sous la ligne « Attaque(s) en cours … » du jeu
    let bouton = `<div class="o_attaquesBoutons o_partagerToutBloc"><button type="button" id="${id}PartagerTout" class="o_button f_info">Partager TOUS mes floods avec la ${tag}</button></div>`,
      $compte = $("#centre *")
        .filter((k, e) => !e.children.length && /Attaque\(s\) en cours/.test(e.textContent))
        .first();
    if ($compte.length) {
      // les sauts de ligne du jeu sous le compteur creusaient un grand vide
      let n = $compte[0].nextSibling;
      while (n && (n.nodeName == "BR" || (n.nodeType == 3 && !n.textContent.trim()))) {
        let suivant = n.nextSibling;
        if (n.nodeName == "BR") n.parentNode.removeChild(n);
        n = suivant;
      }
      $compte.after(bouton);
    } else $(`#${id}`).before(bouton);
    // compteur et lien Annuler natifs : déplacés dans le tableau (compteur masqué).
    // Pour une attaque capturée on connaît l'heure de lancement : le lien
    // est retiré dès que la fenêtre d'annulation du jeu est passée.
    let majToutAnnuler = () => {
      if (attaques.filter((a) => $(a.cellule).find("a").length).length < 2)
        $(`#${id}ToutAnnuler`).hide();
    };
    attaques.forEach((a, i) => {
      let natifs = AttaqueLancee.noeudsLigne(a.ligne.elt),
        restant = a.capture ? a.capture.lancee + DELAI_ANNULATION * 1000 - Date.now() : null;
      a.cellule = `#${id}Annuler${i}`;
      $(a.ligne.elt).appendTo(`#${id}Reste${i}`);
      if (a.annuler.length) {
        if (restant !== null && restant <= 0) a.annuler.remove();
        else {
          a.annuler.appendTo(a.cellule);
          if (restant !== null)
            setTimeout(() => {
              $(a.cellule).empty();
              majToutAnnuler();
            }, restant);
        }
      }
      natifs.forEach((n) => n.parentNode && n.parentNode.removeChild(n));
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
    $(`#${id} .o_attaquePartager`).on("click", (e) =>
      PartageChasses.partagerFloods(
        [attaques[parseInt(e.currentTarget.dataset.i)].capture],
        $(e.currentTarget),
      ),
    );
    $(`#${id}PartagerTout`).on("click", (e) =>
      PartageChasses.partagerFloods(
        attaques.map((a) => a.capture),
        $(e.currentTarget),
      ),
    );
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
        // navigation GET et non reload() : sur la page Attaquer, la page
        // courante est la réponse du POST de lancement, un reload le rejouerait
        .finally(() => location.replace(location.pathname + location.search));
    });
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
          `<span class="o_attaquePartage" title="Déjà publié dans le forum de la ${tag}">Partagé ✓</span>`,
        );
    });
    let reste = $(".o_attaquePartager").length;
    $("#o_attaquesLanceesPartagerTout")
      .prop("disabled", !reste)
      .text(
        reste
          ? `Partager TOUS mes floods avec la ${Utils.alliance || "l'alliance"}`
          : `Tous mes floods sont partagés avec la ${Utils.alliance || "l'alliance"} ✓`,
      );
  }
  /**
   * Fzzz : TdC que l'attaque prendra (règle des 20 %, estimée au lancement),
   * « — » hors terrain de chasse, « ? » si le TdC de la cible était inconnu.
   */
  static priseEstimee(a) {
    let c = a.capture;
    if (!/terrain/i.test(AttaqueLancee.lieu(a) || "")) return "—";
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
