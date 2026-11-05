/*
 * Attaquer.js
 * Hraesvelg
 **********************************************************************/

/**
 * Classe de fonction pour les pages d'attaques.
 *
 * @class PageAttaquer
 * @constructor
 */
// garde-fou : pages de résultats chargées au plus par « Charger toutes les pages »
const PAGES_ENNEMIS_MAX = 40;
// valeur de l'option « Terrain de Chasse » dans la liste Lieu du jeu (2 dôme, 3 loge)
const LIEU_JEU_TERRAIN = 1;
// nom court de chaque valeur de la liste Lieu, pour le bouton « Sonder »
const ZONES_LIEU_JEU = { 1: "TdC", 2: "Dôme", 3: "Loge" };

class PageAttaquer {
  constructor(boiteComptePlus) {
    /**
     * Accés à la boite compte+
     */
    this._boiteComptePlus = boiteComptePlus;
    /**
     *
     */
    this._nbAttaque =
      monProfil.niveauRecherche[6] +
      2 -
      $("#centre")
        .text()
        .split(/- Vous allez attaquer|- Des renforts arrivent/g).length;
    /**
     *
     */
    this._cible = new Joueur({ pseudo: $("input[name=pseudoCible]").val() });
    /**
     * Armee.
     */
    this._armee = null;
  }
  /**
   *
   */
  /**
   * Page Ennemies (ennemie.php) : champ sous l'encadré « Cibles » qui filtre,
   * pendant la frappe, la liste affichée (pseudo ou alliance, plusieurs termes
   * séparés par « ; »). Aucune requête : seule la page de résultats affichée.
   *
   * @static
   * @method ajouterFiltreEnnemis
   */
  static ajouterFiltreEnnemis() {
    let $cibles = $("#formulairePageEnnemie fieldset")
      .filter((i, f) => $(f).children("legend").text().trim() == "Cibles")
      .first();
    if (!$cibles.length || !$("#tabEnnemie").length || $("#o_filtreEnnemis").length) return;
    // hors du formulaire du jeu, dont la feuille de style aligne les encadrés
    // côte à côte : juste après lui, dans la même cellule, sous « Cibles »
    let $form = $cibles.closest("form"),
      tous = ["#terrain_max", "#terrain_min"].every(
        (c) => $(c).length && !parseInt(String($(c).val()).replace(/\D/g, "")),
      ),
      $bloc =
        $(`<div id="o_filtreEnnemisZone"><fieldset id="o_filtreEnnemis"><legend><h2 style="display:inline">Filtrer la liste</h2></legend>
        <input type="text" id="o_filtreEnnemisTexte" placeholder="Pseudo ou alliance (Sam;Max)" autocomplete="off"/>
        <span id="o_filtreEnnemisCompte" class="small"></span>
        <p class="o_ennemisPages"><input type="button" id="o_ennemisToutes" value="Charger toutes les pages" title="Le jeu affiche les joueurs page par page : charge les pages suivantes de cette recherche dans ce tableau (une requête par page)"/> <span id="o_ennemisPagesEtat" class="small"></span></p>
        <label class="o_filtreEnnemisTous" title="Relance la recherche du jeu sans limite de terrain (Terrain Max et Min à 0)"><input type="checkbox" id="o_filtreEnnemisTous" ${tous ? "checked" : ""}/> Afficher tous les joueurs, même hors de portée</label></fieldset></div>`);
    if ($form.length && $form.parent().is("td")) $bloc.insertAfter($form);
    else $bloc.insertAfter($cibles);
    $bloc
      .find("#o_ennemisToutes")
      .on("click", (e) => PageAttaquer.chargerToutesPagesEnnemis($(e.currentTarget)));
    // un clic du joueur relance la recherche du jeu (une requête, page rechargée)
    $bloc.find("#o_filtreEnnemisTous").on("change", (e) => {
      PageAttaquer.preparerTousEnnemis(e.currentTarget.checked);
      $("input[name='boutonRecherchePageEnnemie']").trigger("click");
    });
    $bloc
      .find("#o_filtreEnnemisTexte")
      // Entrée ne doit jamais soumettre la recherche du jeu
      .on("keydown", (e) => {
        if (e.key == "Enter") e.preventDefault();
      })
      .on("input", (e) => {
        let { visibles, total } = PageAttaquer.filtrerEnnemis(e.currentTarget.value);
        $("#o_filtreEnnemisCompte").text(
          e.currentTarget.value.trim() ? `${visibles} / ${total}` : "",
        );
      });
  }
  /**
   * Colonne « Temps » (trajet jusqu'à la fourmilière) après la distance.
   *
   * @static
   * @method tempsEnnemis
   * @param {jQuery} $lignes lignes du tableau #tabEnnemie
   */
  static tempsEnnemis($lignes) {
    $lignes.each((i, elt) => {
      let distance = parseInt($(elt).find("td:eq(5)").text());
      $(elt)
        .find("td:eq(5)")
        .after(
          `<td class='centre'>${Utils.intToTime(Math.round(Math.pow(0.9, monProfil.niveauRecherche[6]) * 637200 * (1 - Math.exp(-(distance / 350)))))}</td>`,
        );
    });
  }
  /**
   * Lignes de joueurs d'une page de résultats (sans l'en-tête).
   *
   * @static
   * @method lignesEnnemis
   * @param {jQuery} $racine page ou document
   * @return {jQuery}
   */
  static lignesEnnemis($racine) {
    return $racine.find("#tabEnnemie tr").filter((i, tr) => $(tr).children("td").length > 0);
  }
  /**
   * Au clic : pages suivantes de la recherche affichée, demandées l'une après
   * l'autre avec les critères du formulaire, et leurs joueurs ajoutés au
   * tableau ; s'arrête à la première page sans joueur nouveau.
   *
   * @static
   * @method chargerToutesPagesEnnemis
   * @param {jQuery} $bouton
   */
  static chargerToutesPagesEnnemis($bouton) {
    let $form = $("#formulairePageEnnemie"),
      $etat = $("#o_ennemisPagesEtat"),
      $corps = PageAttaquer.lignesEnnemis($(document)).first().parent(),
      vus = new Set(
        PageAttaquer.lignesEnnemis($(document))
          .map((i, tr) => $(tr).children("td").eq(1).text().trim())
          .get(),
      ),
      page = (parseInt($("#page").val()) || 1) + 1,
      ajoutes = 0,
      suivante = () => {
        if (page > PAGES_ENNEMIS_MAX) return Promise.resolve();
        $etat.text(`page ${page}…`);
        let donnees = $form
          .serializeArray()
          .map((c) => (c.name == "page" ? { ...c, value: page } : c));
        return Promise.resolve($.post(location.origin + "/ennemie.php", $.param(donnees))).then(
          (html) => {
            let nouvelles = PageAttaquer.lignesEnnemis(Utils.parseHtml(html)).filter(
              (i, tr) => !vus.has($(tr).children("td").eq(1).text().trim()),
            );
            if (!nouvelles.length) return;
            nouvelles.each((i, tr) => vus.add($(tr).children("td").eq(1).text().trim()));
            PageAttaquer.tempsEnnemis(nouvelles);
            $corps.append(nouvelles);
            ajoutes += nouvelles.length;
            page++;
            return suivante();
          },
        );
      };
    $bouton.prop("disabled", true);
    suivante()
      .then(
        () => $etat.text(`${vus.size} joueurs (${ajoutes} ajoutés)`),
        () => {
          $bouton.prop("disabled", false);
          $etat.text(`page ${page} illisible : ${vus.size} joueurs affichés`);
        },
      )
      // le filtre en cours s'applique aussi aux lignes ajoutées
      .finally(() => $("#o_filtreEnnemisTexte").trigger("input"));
  }
  /**
   * Prépare le formulaire de recherche du jeu : tous les joueurs (Terrain Max
   * et Min à 0, cases de portée décochées) ou ceux à portée (case « je peux
   * attaquer » cochée : le jeu recalcule alors les limites de terrain).
   * Les cases sont cliquées pour que le jeu réagisse comme à la main.
   *
   * @static
   * @method preparerTousEnnemis
   * @param {Boolean} tous
   */
  static preparerTousEnnemis(tous) {
    let attaquable = $("#fourmiliere_attaquable")[0],
      attaquante = $("#fourmiliere_attaquante")[0];
    if (tous) {
      if (attaquable && attaquable.checked) attaquable.click();
      if (attaquante && attaquante.checked) attaquante.click();
      $("#terrain_max, #terrain_min").val("0");
    } else if (attaquable && !attaquable.checked) attaquable.click();
    $("#page").val("1");
  }
  /**
   * Masque les lignes de #tabEnnemie dont ni l'alliance ni le pseudo ne
   * contient l'un des termes (casse ignorée).
   *
   * @static
   * @method filtrerEnnemis
   * @param {String} texte termes séparés par « ; » (vide : tout afficher)
   * @return {{visibles: Number, total: Number}}
   */
  static filtrerEnnemis(texte) {
    let termes = String(texte)
        .toLowerCase()
        .split(";")
        .map((t) => t.trim())
        .filter(Boolean),
      $lignes = $("#tabEnnemie tr").filter((i, tr) => $(tr).children("td").length > 0),
      visibles = 0;
    $lignes.each((i, tr) => {
      let cellules = $(tr).children("td"),
        nom = (cellules.eq(0).text() + " " + cellules.eq(1).text()).toLowerCase(),
        garder = !termes.length || termes.some((t) => nom.includes(t));
      $(tr).toggle(garder);
      if (garder) visibles++;
    });
    return { visibles, total: $lignes.length };
  }
  executer() {
    // liste « Attaque(s) en cours » du jeu : annuler sans quitter la page d'attaque
    $(document).on("click", "a[href*='ennemie.php?annuler=']", (e) => {
      e.preventDefault();
      AttaqueLancee.annulerSurPlace($(e.currentTarget));
    });
    if ($("#tabChoixArmee").length) {
      // récupération de l'armée
      this._armee = new Armee({ unite: this.extraitArmee() });
      this.majStatistique(this._armee);
      // ajoute event
      $("input[id^=unite]").on("input", (e) => {
        this.majStatistique();
      });
      this.ajouterBoutons();
      // on recupére le profil du joueur pour les coordonnées
      this._cible.getProfil().then((data) => {
        this._cible.chargerProfil(data);
        this.activerBoutons();
        // ajoute des outils de floods
        this.formulaireFlood();
      });
    }
    if (!Utils.comptePlus) this.plus();
    // pas de bloc « Mes attaques en cours » : il s'afficherait après coup
    // au-dessus du formulaire et déplacerait le bouton du jeu sous le doigt
    AttaqueLancee.afficherTableaux(false);
    // rechargement après un clic (Lancer, Annuler…) : même position à l'écran
    Utils.garderPosition("fzzz_positionAttaquer");
    return this;
  }
  /**
   *
   */
  extraitArmee() {
    let unites = {};
    $("input[id^='unite']").each((i, elt) => {
      unites[$(elt).parent().parent().find("td:first").text()] = numeral($(elt).val()).value();
    });
    return unites;
  }
  /**
   * Affiche les données de l'armée selectionné.
   *
   * @private
   * @method majStatistique
   */
  majStatistique(armee = null) {
    let tmp = armee ? armee : new Armee({ unite: this.extraitArmee() }),
      html = `<table id="o_tableStatArmee" cellspacing=0>
            <tr class="gras centre"><td></td><td>HB</td><td>AB</td></tr>
            <tr><td>${IMG_VIE}</td><td>${numeral(tmp.getBaseVie()).format()}</td><td>${numeral(tmp.getTotalVie(monProfil.niveauRecherche[1])).format()}</td></tr>
            <tr><td>${IMG_ATT}</td><td>${numeral(tmp.getBaseAtt()).format()}</td><td>${numeral(tmp.getTotalAtt(monProfil.niveauRecherche[2])).format()}</td></tr>
            <tr><td>${IMG_DEF}</td><td>${numeral(tmp.getBaseDef()).format()}</td><td>${numeral(tmp.getTotalDef(monProfil.niveauRecherche[2])).format()}</td></tr>
            <tr><td><img alt="Nombre" src="images/icone/fourmi.png" height="18"/></td><td colspan="2" class="centre">${numeral(tmp.getSommeUnite()).format()}</td></tr>
            </table>`;
    // info-bulle visible seulement quand le pointeur est sur le tableau Armée
    let $tableau = $("#tabChoixArmee"),
      $info = $("#o_statArmeeInfo"),
      placer = () => $info.position({ my: "left+10 center", at: "right center", of: $tableau });
    if (!$info.length) {
      $info = $(
        `<div id="o_statArmeeInfo" class="ui-tooltip ui-widget ui-corner-all ui-widget-content ui-tooltip-right ui-tooltip-brown ui-tooltip-lightBrown" style="display:none;position:absolute"><div class="ui-tooltip-content"></div></div>`,
      ).appendTo("body");
      $tableau
        .on("mouseenter", () => {
          $info.show();
          placer();
        })
        .on("mouseleave", () => $info.hide());
    }
    $info.find(".ui-tooltip-content").html(html);
    if ($info.is(":visible")) placer();
  }
  /**
   * Boutons de l'extension posés sous « Attaquer X ! » dès l'ouverture, et
   * inactifs jusqu'au profil de la cible : rien n'apparaît ensuite au-dessus
   * ou à la place du bouton du jeu, un doigt qui le vise ne peut pas tomber
   * sur un autre bouton. Aucun bouton ne change le lieu choisi par le joueur.
   *
   * @private
   * @method ajouterBoutons
   */
  ajouterBoutons() {
    const titrePartager = `Lance l'attaque comme le bouton du jeu, vers le lieu de la liste (couleur : vert terrain, orange dôme, rouge loge), puis la publie avec ce lieu dans le forum de la ${Utils.alliance || "l'alliance"}.`;
    const titreSonder = `Envoie tout de suite la sonde réglée dans Préférences → Attaque (par défaut 1 Jeune Soldate Naine), vers le lieu de sonde des préférences ou, à défaut, celui de la liste. Couleur : vert terrain, orange dôme, rouge loge.`;
    const titreSynchroSonde = `Prépare la sonde dans le formulaire et affiche le compte à rebours jusqu'à la minute pleine. À zéro, c'est à toi de cliquer sur Sonder.`;
    const titreSync = `Affiche le compte à rebours, au dixième de seconde et en heure du serveur + latence, jusqu'au moment où l'attaque arrivera sur une minute pleine (utile pour synchroniser plusieurs attaques avec des alliés). À zéro, c'est à toi de cliquer sur le bouton du jeu.`;
    $("input[name='ChoixArmee']")
      .first()
      .after(
        `<div id="o_btnLancer"><button type="button" id="o_lancerPartager" class="o_button" title="${Utils.echapper(titrePartager)}" disabled>Lancer + partager</button><button type="button" id="o_sonder" class="o_button" title="${Utils.echapper(titreSonder)}" disabled>Sonder</button><button type="button" id="o_synchro" class="o_button f_info" title="${Utils.echapper(titreSync)}" disabled>Synchroniser</button><button type="button" id="o_synchroSonde" class="o_button f_info" title="${Utils.echapper(titreSynchroSonde)}" disabled>Synchro sonde</button></div>${Utils.affichage("trajet") ? `<p class="centre reduce">Temps de trajet : <span id="o_tempsTrajet" class="gras">…</span></p>` : ""}<p class="centre reduce ligne_paire">Votre armée rentrera le <span id="o_retourArmee" class="gras">…</span> (RC : <span id="o_retourArmeeRC" class="gras">…</span>).</p>`,
      );
    // ligne du compte à rebours réservée dès l'affichage : la lancer ne
    // décale pas le reste de la page
    if (!$("#o_syncA").length)
      $("#formulaireChoixArmee fieldset:eq(1)").append(
        "<p id='o_syncA' class='centre o_syncReserve'>&nbsp;</p>",
      );
    $("#lieu").on("change", () => this.majCouleurs());
    this.majCouleurs();
    $("#o_lancerPartager").on("click", (e) => {
      if (e.currentTarget.disabled) return;
      // couleur recalée au clic : le navigateur peut remettre une ancienne
      // valeur dans la liste sans événement « change »
      this.majCouleurs();
      // un seul envoi par clic, même en double-cliquant
      $(e.currentTarget).prop("disabled", true);
      // le submit part pendant click() : la capture lit l'option à ce moment
      this._partagerEnvoi = true;
      $("input[name='ChoixArmee']")[0].click();
      this._partagerEnvoi = false;
    });
    // page reprise par « Précédent » : le bouton désactivé par le clic revient actif
    window.addEventListener("pageshow", (e) => {
      if (e.persisted && this._pret) $("#o_lancerPartager").prop("disabled", false);
    });
    $("#o_synchro").on("click", (e) => {
      e.preventDefault();
      $("#o_synchro").prop("disabled", true);
      this.lancerSynchro(this._cible.attenteSynchro());
      return false;
    });
    $("#o_sonder").on("click", (e) => {
      if (!e.currentTarget.disabled) this.sonder();
    });
    $("#o_synchroSonde").on("click", (e) => {
      if (e.currentTarget.disabled || !this.preparerSonde()) return;
      $("#o_synchro, #o_synchroSonde").prop("disabled", true);
      this.lancerSynchro(this._cible.attenteSynchro(), $("#o_sonder"), "Sonder");
    });
  }
  /**
   * Lieu où part la sonde : celui des préférences, sinon celui de la liste.
   * La liste du jeu n'est jamais modifiée.
   *
   * @private
   * @method lieuSonde
   * @return {Number} 1 terrain, 2 dôme, 3 loge
   */
  lieuSonde() {
    return (
      parseInt(monProfil.parametre["sondeLieu"].valeur) ||
      parseInt($("#lieu").val()) ||
      LIEU_JEU_TERRAIN
    );
  }
  /**
   * Couleur du lieu visé par les boutons qui envoient : vert terrain, orange
   * dôme, rouge loge. Bouton du jeu et « Lancer + partager » d'après la liste,
   * « Sonder » d'après le lieu de sonde.
   *
   * @private
   * @method majCouleurs
   */
  majCouleurs() {
    let colorer = ($b, lieu) => $b.removeClass("o_lieu1 o_lieu2 o_lieu3").addClass("o_lieu" + lieu);
    colorer(
      $("input[name='ChoixArmee']:first, #o_lancerPartager"),
      parseInt($("#lieu").val()) || LIEU_JEU_TERRAIN,
    );
    let lieuSonde = this.lieuSonde();
    colorer($("#o_sonder"), lieuSonde).text(`Sonder (${ZONES_LIEU_JEU[lieuSonde]})`);
  }
  /**
   * Unités présentes chez moi, d'après les colonnes Terrain, Fourmilière et
   * Loge du formulaire (le champ Armée peut avoir été modifié).
   *
   * @static
   * @method unitesDisponibles
   * @return {Object} {nom d'unité: {id du champ, nb}}
   */
  static unitesDisponibles() {
    let dispo = {};
    $("#tabChoixArmee tr").each((i, tr) => {
      let $td = $(tr).children("td"),
        $champ = $(tr).find("input[id^='unite']");
      if (!$champ.length || $td.length < 4) return;
      let nb = [1, 2, 3].reduce(
        (somme, k) => somme + (parseInt($td.eq(k).text().replace(/\D/g, "")) || 0),
        0,
      );
      if (nb > 0) dispo[$td.eq(0).text().trim()] = { id: $champ.attr("id"), nb };
    });
    return dispo;
  }
  /**
   * Sonde à envoyer : l'unité des préférences, au plus la quantité réglée ;
   * si je n'en ai pas, une seule unité de la moins chère à produire.
   *
   * @static
   * @method compositionSonde
   * @param {Object} dispo résultat de unitesDisponibles
   * @param {String} nom unité choisie dans les préférences
   * @param {Number} quantite quantité choisie dans les préférences
   * @return {{nom: String, id: String, nb: Number}|null} null : aucune troupe
   */
  static compositionSonde(dispo, nom, quantite) {
    if (dispo[nom])
      return { nom, id: dispo[nom].id, nb: Math.max(1, Math.min(quantite, dispo[nom].nb)) };
    let rang = (n) => NOM_UNITE.indexOf(n),
      noms = Object.keys(dispo)
        .filter((n) => rang(n) > 0)
        .sort(
          (a, b) =>
            COUT_UNITE[rang(a)] - COUT_UNITE[rang(b)] || VIE_UNITE[rang(a)] - VIE_UNITE[rang(b)],
        );
    return noms.length ? { nom: noms[0], id: dispo[noms[0]].id, nb: 1 } : null;
  }
  /**
   * Remplit le formulaire avec la sonde seule, sans toucher à la liste Lieu.
   *
   * @private
   * @method preparerSonde
   * @return {{nom: String, id: String, nb: Number}|null}
   */
  preparerSonde() {
    let p = monProfil.parametre,
      sonde = PageAttaquer.compositionSonde(
        PageAttaquer.unitesDisponibles(),
        NOM_UNITE[(parseInt(p["sondeUnite"].valeur) || 0) + 1],
        parseInt(p["sondeQuantite"].valeur) || 1,
      );
    if (!sonde) {
      $.toast({ ...TOAST_ERROR, text: "Pas de troupe disponible : aucune sonde envoyée." });
      return null;
    }
    $("#tabChoixArmee input[id^='unite']").each((i, champ) => {
      champ.value = champ.id == sonde.id ? String(sonde.nb) : "0";
    });
    this.majStatistique();
    this.majCouleurs();
    return sonde;
  }
  /**
   * Envoie la sonde vers le lieu de sonde (la liste du jeu reste telle
   * quelle), puis recharge la page pour l'afficher dans la liste du jeu.
   *
   * @private
   * @method sonder
   */
  sonder() {
    let sonde = this.preparerSonde();
    if (!sonde) return;
    let lieu = this.lieuSonde(),
      $boutons = $("#o_sonder, #o_synchroSonde").prop("disabled", true),
      jeton = $("#t:last"),
      donnees = {
        [jeton.attr("name")]: jeton.val(),
        ChoixArmee: "1",
        lieu: String(lieu),
        pseudoCible: $("input[name=pseudoCible]").val(),
      };
    $("#tabChoixArmee input[id^='unite']").each((i, champ) => {
      donnees[champ.name] = champ.id == sonde.id ? sonde.nb : 0;
    });
    // adresse absolue : une adresse relative ne passerait pas par la file des
    // requêtes (Requetes.js), et le jeu refuse deux requêtes simultanées
    $.post(`${location.origin}/${$("#formulaireChoixArmee").attr("action")}`, donnees)
      .done((data) => {
        let reponse = Utils.parseHtml(data).find("center:last").text().trim();
        if (reponse.indexOf("Vos troupes sont en marche") == -1) {
          $boutons.prop("disabled", false);
          $.toast({ ...TOAST_ERROR, text: reponse || "Le jeu a refusé la sonde." });
          return;
        }
        AttaqueLancee.enregistrer(
          this._cible.pseudo,
          $(`#lieu option[value='${lieu}']`).text().trim(),
          { [sonde.nom]: sonde.nb },
          { html: data, terrain: this._cible.terrain },
        );
        location.href = location.pathname + location.search;
      })
      // sans réponse, la sonde est peut-être partie : pas de nouvel essai
      .fail(() =>
        $.toast({
          ...TOAST_ERROR,
          hideAfter: false,
          text: "Le jeu n'a pas répondu : vérifie tes attaques en cours avant de sonder à nouveau.",
        }),
      );
  }
  /**
   * Profil de la cible lu : trajet, retour, capture des envois et boutons actifs.
   *
   * @private
   * @method activerBoutons
   */
  activerBoutons() {
    let trajet = monProfil.getTempsParcours2(this._cible);
    $("#o_tempsTrajet").text(Utils.duree(trajet));
    $("#o_retourArmee").text(Horloge.clic().add(trajet, "s").format("D MMM à HH[h]mm[m]ss[s]"));
    $("#o_retourArmeeRC").text(Utils.roundMinute(trajet, Horloge.clic()).format("D MMM à HH[h]mm"));
    Utils.incrementTime(trajet, "o_retourArmee", "o_retourArmeeRC");
    // Capture de l'attaque au moment de l'envoi pour le récapitulatif par
    // cible : bouton du jeu, « Lancer + partager » et touche Entrée.
    $("input[name='ChoixArmee']")
      .closest("form")
      .on("submit", () => {
        AttaqueLancee.enregistrer(
          this._cible.pseudo,
          $("#lieu option:selected").text().trim(),
          this.extraitArmee(),
          { terrain: this._cible.terrain, partager: this._partagerEnvoi },
        );
      });
    this._pret = true;
    $("#o_btnLancer button").prop("disabled", false);
  }
  /**
   * @param {Number} attente secondes avant de cliquer
   * @param {Object} $bouton (jQuery) bouton à cliquer à zéro ; défaut : ceux du jeu et « Lancer + partager »
   * @param {String} libelle nom de ce bouton dans le texte du compte à rebours
   */
  lancerSynchro(
    attente,
    $bouton = $("input[name='ChoixArmee']:first, #o_lancerPartager"),
    libelle = "Lancer",
  ) {
    // Règlement du s5 : le clic final appartient au joueur. L'extension affiche
    // seulement le compte à rebours et signale le moment de cliquer.
    // Compte à rebours au dixième, en heure serveur + latence : un réglage de
    // la latence pendant le décompte est pris en compte.
    let cible = Horloge.clic().valueOf() + attente * 1000,
      arrivee = Horloge.clic().add(attente, "s").add(monProfil.getTempsParcours2(this._cible), "s");
    let texte = `Clique sur <b>${libelle}</b> dans : <span id='o_decSyncA' class='gras'></span> (arrivée ${arrivee.format("HH[h]mm[m]ss[s]")}, latence ${Horloge.libelleLatence()}).`;
    if ($("#o_syncA").length) $("#o_syncA").removeClass("red").html(texte);
    else
      $("#formulaireChoixArmee fieldset:eq(1)").append(
        `<p id="o_syncA" class="centre o_syncReserve">${texte}</p>`,
      );
    let tic = () => {
      let reste = cible - Horloge.clic().valueOf();
      if (reste > 0) {
        $("#o_decSyncA").text((reste / 1000).toFixed(1).replace(".", ",") + " s");
        setTimeout(tic, Math.min(100, reste));
      } else {
        $("#o_syncA").html(`<b>Clique sur ${libelle} maintenant.</b>`).addClass("red");
        // cadre autour du ou des boutons à cliquer ; focus sans faire défiler la page
        $bouton.addClass("o_synchroPret");
        $bouton.first()[0]?.focus({ preventScroll: true });
      }
    };
    tic();
  }
  /**
   * Formulaire de lancemenet de flood.
   *
   * @private
   * @method formulaireFlood
   */
  formulaireFlood() {
    let methode = monProfil.parametre["methodeFlood"].valeur,
      // créneaux d'attaques simultanées encore libres (VA + 1 au total)
      creneaux = Math.max(0, this._nbAttaque);
    $(".simulateur:not(.o_blocAttaques):first")
      .append(`<fieldset id='o_prepaFlood' class='centre'><legend><span class='titre'>Lanceur de Flood</span> <span class='reduce'>(${creneaux} créneau${creneaux > 1 ? "x" : ""} libre${creneaux > 1 ? "s" : ""} sur ${monProfil.niveauRecherche[6] + 1})</span></legend>
            <table id='o_simulationFlood' class='o_maxWidth' cellspacing=0>
			<tr class='gras'><td>Etape</td><td>Troupes</td><td>Reste</td><td>Mon Terrain</td><td>${this._cible.pseudo} (${Utils.intToTime(monProfil.getTempsParcours2(this._cible))})</td></tr>
			<tr><td><select id='o_methodeFlood'><option value='0' ${methode == 0 ? "selected" : ""}>${METHODE_FLOOD[0]}</option><option value='1' ${methode == 1 ? "selected" : ""}>${METHODE_FLOOD[1]}</option><option value='2' ${methode == 2 ? "selected" : ""}>${METHODE_FLOOD[2]}</option><option value='3' ${methode == 3 ? "selected" : ""}>${METHODE_FLOOD[3]}</option></select></td><td colspan="2"></td><td><input value='${Utils.terrain}' size='12' id='o_floodTDCA'/></td><td><input value='${this._cible.terrain}' size='12' id='o_floodTDCB'/></td></tr>
			<tr><td>Antisonde (<span id="o_pourcentAttaque0">0</span>%)</td><td><input value='0' size='12' id='o_floodAntiSonde'/></td><td></td><td>${numeral(Utils.terrain).format()}</td><td>${numeral(this._cible.terrain).format()}</td></tr>
            <tr class="gras reduce"><td colspan="3"></td><td><span id="o_supprimeAttaque" class="souligne cursor" ${methode == 1 ? "style=display:none;" : ""}>Supprimer une attaque</span></td><td><span id="o_ajouteAttaque" class="souligne cursor" ${methode == 1 ? "style=display:none;" : ""}>Ajouter une attaque</span></td></tr>
            </table>
            <div class='o_pile'><button id='o_lanceFlood' class='o_button f_success'>Flooder</button>
            <button type='button' id='o_lanceFloodPartager' class='o_button f_info' title='Flood, puis publication des attaques dans le forum de la ${Utils.echapper(Utils.alliance || "l'alliance")}'>Flooder + partager</button></div>
            <p class="reduce left">Reste : place les unités restantes sur l'attaque sélectionnée.</p>
            </fieldset>`);
    $("#o_floodTDCA, #o_floodTDCB, #o_floodAntiSonde, input[id^='o_attaque']").spinner({
      min: 0,
      numberFormat: "i",
    });
    $("#o_simulationFlood tr:even").addClass("ligne_paire");
    for (let i = 1; i < Math.min(4, this._nbAttaque); i++) this.ajouterAttaque();
    // Si la methode par defaut est par standard on prepare
    if (methode)
      this.preparerFlood($("#o_floodTDCA").spinner("value"), $("#o_floodTDCB").spinner("value"));
    // event
    $("#o_methodeFlood").change((e) => {
      this.preparerFlood($("#o_floodTDCA").spinner("value"), $("#o_floodTDCB").spinner("value"));
      if (e.currentTarget.value == "1")
        // en optimisee on peut ni ajouter ni supprimer d'attaques
        $("#o_ajouteAttaque, #o_supprimeAttaque").hide();
      else $("#o_ajouteAttaque, #o_supprimeAttaque").show();
    });
    $("#o_floodTDCA").on("input spin", (e, ui) => {
      let nombre = ui ? ui.value : $(e.currentTarget).spinner("value");
      $(e.currentTarget).spinner("value", nombre);
      this.preparerFlood(
        ui ? ui.value : $(e.currentTarget).spinner("value"),
        $("#o_floodTDCB").spinner("value"),
      );
    });
    $("#o_floodTDCB").on("input spin", (e, ui) => {
      let nombre = ui ? ui.value : $(e.currentTarget).spinner("value");
      $(e.currentTarget).spinner("value", nombre);
      this.preparerFlood(
        $("#o_floodTDCA").spinner("value"),
        ui ? ui.value : $(e.currentTarget).spinner("value"),
      );
    });
    $("#o_floodAntiSonde").on("input spin", (e, ui) => {
      let nombre = ui ? ui.value : $(e.currentTarget).spinner("value");
      $(e.currentTarget).spinner("value", nombre);
      this.preparerFlood($("#o_floodTDCA").spinner("value"), $("#o_floodTDCB").spinner("value"));
    });
    // largeur fixe : « Flood en cours… » ne décale rien
    Utils.figerLargeur($("#o_lanceFlood"), ["Flood en cours…", "Flood interrompu"]);
    $("#o_lanceFlood, #o_lanceFloodPartager").click((e) => {
      // désactivés dès le premier clic : un double clic lançait deux floods en
      // parallèle (chaque attaque partait deux fois)
      $("#o_lanceFlood, #o_lanceFloodPartager").prop("disabled", true);
      $("#o_lanceFlood").text("Flood en cours…");
      // contexte pour que envoyerFlood capture chaque attaque confirmée. Le
      // terrain de départ est celui saisi dans la simulation (par défaut celui
      // du profil, modifiable si on connaît une valeur plus fraîche)
      AttaqueLancee.contexteFlood = {
        cible: this._cible.pseudo,
        terrain: $("#o_floodTDCB").spinner("value"),
        partager: e.currentTarget.id == "o_lanceFloodPartager",
      };
      this._armee.envoyerFlood(
        this._cible.id,
        0,
        $("#t:last").attr("name") + "=" + $("#t:last").attr("value"),
      );
    });
    $("#o_ajouteAttaque").click((e) => {
      this.ajouterAttaque();
    });
    $("#o_supprimeAttaque").click((e) => {
      this.supprimerAttaque();
    });
  }
  /**
   * Lance une simulation si les données saisies sont correctes.
   *
   * @private
   * @method compileDataFlood
   */
  preparerFlood(tdcAtt, tdcCible, bRecup = false) {
    // Si la cible est à porter
    if (tdcCible >= tdcAtt * 0.5 && tdcCible <= tdcAtt * 3) {
      let methode = $("#o_methodeFlood").val();
      // on recup les attaques manuellement
      let attaques = new Array();
      // on push au moins l'antisonde quelque soit le cas !
      attaques.push($("#o_floodAntiSonde").spinner("value"));
      if (bRecup || methode == "0") {
        for (let i = 1; i < this._nbAttaque; i++)
          if ($("#o_attaque" + i).length) attaques.push($("#o_attaque" + i).spinner("value"));
      }
      // si attaques n'est pas vide c'est qu'on parametre soit meme les floods
      // si la methode est uniforme ou degressive on utilise que le nbAttaque dans le tableau
      let indSupp = $("input[name='o_suppAttaque']:checked").length
        ? $("input[name='o_suppAttaque']:checked").attr("id").replace("o_suppAttaque", "")
        : -1;
      let simulation = this._armee.simulerFlood(
        tdcAtt,
        tdcCible,
        methode,
        attaques,
        $("#o_attaque1").spinner("value"),
        methode == "2" || methode == "3"
          ? Math.min($("input[id^='o_attaque']").length, this._nbAttaque)
          : this._nbAttaque,
        indSupp,
      );
      // mise a jour de l'antisonde
      let priseMax = Math.floor(tdcCible * 0.2),
        pourcent = 0;
      if (simulation[0]) {
        priseMax = simulation[0] > priseMax ? priseMax : simulation[0];
        pourcent = Math.round((priseMax * 100) / tdcCible);
        tdcAtt += priseMax;
        tdcCible -= priseMax;
        $("#o_pourcentAttaque" + 0).text(pourcent);
        $("#o_simulationFlood tr:eq(2) td:eq(3)").text(numeral(tdcAtt).format());
        $("#o_simulationFlood tr:eq(2) td:eq(4)").text(numeral(tdcCible).format());
      }
      // mise à jour des attaques
      for (let i = 1; i < simulation.length; i++) {
        if (!$("#o_attaque" + i).length) this.ajouterAttaque(true);
        $("#o_attaque" + i).spinner("value", simulation[i]);
        // Calcule des terrains
        if (tdcCible >= tdcAtt * 0.5) {
          priseMax = Math.floor(tdcCible * 0.2);
          priseMax = simulation[i] > priseMax ? priseMax : simulation[i];
          pourcent = Math.round((priseMax * 100) / tdcCible);
          tdcAtt += priseMax;
          tdcCible -= priseMax;
        }
        $("#o_pourcentAttaque" + i).text(pourcent);
        $("#o_simulationFlood tr:eq(" + (i + 2) + ") td:eq(3)").text(numeral(tdcAtt).format());
        $("#o_simulationFlood tr:eq(" + (i + 2) + ") td:eq(4)").text(numeral(tdcCible).format());
      }
      // supprime les attaques en trop si besoin
      for (let i = simulation.length; i < $("#o_simulationFlood tr").length - 3; i++)
        this.supprimerAttaque();
    }
  }
  /**
   *
   */
  ajouterAttaque(silencieux = false) {
    let nbAttaque = $("input[id^='o_attaque']").length + 1,
      // l'antisonde occupe un créneau d'attaque seulement si elle est envoyée :
      // à 0 la simulation place une attaque de plus, la ligne doit exister
      // sinon elle est envoyée sans être affichée
      creneaux = this._nbAttaque - ($("#o_floodAntiSonde").spinner("value") ? 1 : 0);
    // si le nombre d'attaque depasse la VA
    if (nbAttaque > creneaux) {
      // Toast seulement sur clic manuel : en pré-remplissage auto (preparerFlood),
      // l'utilisateur n'a rien fait, l'avertissement est trompeur.
      if (!silencieux)
        $.toast({
          ...TOAST_WARNING,
          text: "Votre vitesse d'attaque ne vous permet d'envoyer plus d'attaques",
        });
    } else {
      $("#o_simulationFlood tr:last").before(
        `<tr class='ligne_paire'><td>Attaque ${nbAttaque} (<span id="o_pourcentAttaque${nbAttaque}">0</span>%)</td><td><input value='0' size='12' id='o_attaque${nbAttaque}'/></td><td><input type="checkbox" id="o_suppAttaque${nbAttaque}" name="o_suppAttaque"/></td><td>${numeral(Utils.terrain).format()}</td><td>${numeral(this._cible.terrain).format()}</td></tr>`,
      );
      $("#o_attaque" + nbAttaque).spinner({ min: 0, numberFormat: "i" });
      $("#o_simulationFlood tr").removeClass("ligne_paire");
      $("#o_simulationFlood tr:even").addClass("ligne_paire");
      // Event
      $("#o_attaque" + nbAttaque).on("input spin", (e, ui) => {
        this.preparerFlood(
          $("#o_floodTDCA").spinner("value"),
          $("#o_floodTDCB").spinner("value"),
          true,
        );
      });
      $("input[name='o_suppAttaque']").on("change", (e) => {
        // une seule checkbox peut etre cocher
        $("input[name='o_suppAttaque']").not(e.currentTarget).prop("checked", false);
        this.preparerFlood($("#o_floodTDCA").spinner("value"), $("#o_floodTDCB").spinner("value"));
      });
      // si la methode est uniforme ou degressive on utilise autocomplete la valeur de l'attaque
      let methode = $("#o_methodeFlood").val();
      if (methode == "2" || methode == "3")
        this.preparerFlood($("#o_floodTDCA").spinner("value"), $("#o_floodTDCB").spinner("value"));
    }
  }
  /**
   *
   */
  supprimerAttaque() {
    // si le nombre d'attaque est de 0
    let nbAttaque = $("input[id^='o_attaque']").length + 1;
    if (nbAttaque == 1)
      $.toast({ ...TOAST_WARNING, text: "Vous ne pouvez plus supprimer d'attaque" });
    else {
      $("#o_attaque" + (nbAttaque - 1)).off();
      $("#o_simulationFlood tr:eq(" + (nbAttaque + 1) + ")").remove();
      $("#o_simulationFlood tr").removeClass("ligne_paire");
      $("#o_simulationFlood tr:even").addClass("ligne_paire");
    }
  }
  /**
   * Ajoute les fonctionnalités du compte+. Affiche les infos sur l'armée et les fléches dans le tableau des unités.
   *
   * @private
   * @method plus
   */
  plus() {
    // Affichage de l'arrivée + sauvegarde des attaques en cours
    let listeAttaque = AttaqueLancee.enrichirLignes();
    // Verification si les données sont deja enregistré
    this.saveAttaque(listeAttaque);
  }
  /**
   * Verifie les attaques en cours avec ce qui est sauvegarder.
   *
   * @private
   * @method saveAttaque
   */
  saveAttaque(listeAttaque) {
    let dataEvo = Utils.lireStockage("outiiil_evolution");
    if (
      !dataEvo.hasOwnProperty("attaque") ||
      dataEvo.attaque.length != listeAttaque.length ||
      (listeAttaque.length &&
        (dataEvo.attaque[0]["cible"] != listeAttaque[0]["cible"] ||
          listeAttaque[0]["exp"].diff(dataEvo.attaque[0]["exp"], "s") > 1))
    ) {
      dataEvo.attaque = listeAttaque;
      dataEvo.startAttaque = Horloge.serveur();
      localStorage.setItem("outiiil_evolution", JSON.stringify(dataEvo));
      if (!Utils.comptePlus && $("#boiteComptePlus").length) {
        this._boiteComptePlus.attaque = dataEvo.attaque;
        this._boiteComptePlus.startAttaque = dataEvo.startAttaque;
        this._boiteComptePlus.majAttaque();
      }
    }
  }
}
