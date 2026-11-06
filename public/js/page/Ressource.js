/*
 * Ressource.js
 * Hraesvelg
 **********************************************************************/

/**
 * Classe de fonction pour la page /Ressource.php.
 *
 * @class PageRessource
 * @constructor
 * @extends Page
 */
class PageRessource {
  constructor(boiteComptePlus) {
    /**
     * Accés à la boite compte+
     */
    this._boiteComptePlus = boiteComptePlus;
    /**
     * Nombre de chasse restante
     */
    this._nbChasse =
      monProfil.niveauRecherche[5] +
      2 -
      $("#boite_tdc")
        .text()
        .split(/- Vos chasseuses vont conquérir/g).length;
    /**
     * Armée du joueur pour envoyer des chasses
     */
    this._armee = new Armee();
    /**
     * Vrai quand l'affectation des ouvrières a soumis le formulaire du jeu
     */
    this._rechargement = false;
  }
  /**
   *
   */
  executer() {
    if (Utils.affichage("lanceurChasse"))
      this._armee.getArmee().then(
        (data) => {
          // la page va se recharger (affectation des ouvrières) : un lancement de
          // chasses commencé maintenant serait coupé en route
          if (this._rechargement) return;
          this._armee.chargeData(data);
          new LanceurChasse(this._armee, this._nbChasse).afficher($("#boite_tdc"));
        },
        () => {
          // armée illisible : le lanceur quand même, l'armée à saisir dans son encart
          if (this._rechargement) return;
          new LanceurChasse(this._armee, this._nbChasse).afficher($("#boite_tdc"));
          $.toast({
            ...TOAST_ERROR,
            text: "Armée illisible : à saisir dans « Armée et niveaux utilisés ».",
          });
        },
      );
    // Lie les chasses lancées aux lignes du jeu (compte des troupes dehors)
    TroupesDehors.synchroniserChasses();
    // Sauvegarde les chasses en cours et ajoute les boutons max recolte
    if (!Utils.comptePlus) this.plus();
    // Affectation automatique des ouvrières (tous comptes)
    this.affectation();
    // Fzzz : synthèse des chasses en cours par minute d'impact
    this.syntheseChasses();
    // Bouton "Annuler toutes les chasses" si au moins une est en cours
    this.boutonAnnulerChasses();
    // annulation d'une chasse, lancement : même position à l'écran après rechargement
    Utils.garderPosition("fzzz_positionRessources");
    return this;
  }
  /**
   * Fzzz : synthèse des chasses en cours par minute d'impact. Les chasses qui
   * arrivent sur des minutes consécutives (13h05, 13h06, 13h07…) forment un
   * seul groupe, affiché à la minute la plus tardive. Pour chaque groupe :
   * heure d'impact, TdC chassé, TdC par heure, JSN perdues par heure (estimées
   * d'après l'armée envoyée et le TdC courant) et unités mises en chasse.
   * La durée d'une chasse lancée d'ici est connue (TroupesDehors retient
   * l'heure de lancement) ; sinon elle est estimée comme si la chasse partait
   * maintenant, et la ligne le signale.
   *
   * @private
   * @method syntheseChasses
   */
  syntheseChasses() {
    let partagerMaintenant = false;
    try {
      partagerMaintenant = Number(sessionStorage.getItem(CLE_PARTAGE_CHASSES_APRES)) > Date.now();
      sessionStorage.removeItem(CLE_PARTAGE_CHASSES_APRES);
    } catch (e) {}
    // page Ressources réelle (pas une page de connexion) : elle liste toutes les chasses
    if (!$("#boite_tdc").length) return;
    let chasses = PageRessource.lireChasses($(document));
    if (!chasses.length) {
      // chasses annulées ou arrivées : plus rien à garder dans le forum
      PartageChasses.recalerChasses([]);
      if (partagerMaintenant)
        $.toast({ ...TOAST_WARNING, text: "Aucune chasse en cours : rien à partager." });
      return;
    }
    let groupes = PageRessource.grouperChasses(chasses),
      somme = PageRessource.sommeChasses,
      textes = [],
      ligne = (libelle, liste, classe) => {
        let s = somme(liste),
          unites = s.detail ? s.detail + "." : "",
          // ~ : durée estimée (chasse lancée ailleurs qu'ici) ; les pertes sont toujours une estimation
          tdcHeure = `${s.estime ? "~" : ""}${numeral(Math.round(s.tdcHeure)).format()}`,
          jsnHeure = `≈ ${numeral(Math.round(s.jsnHeure)).format()}`;
        // texte copié : sans les débits quand la durée n'est qu'estimée
        textes.push(
          `${libelle} : ${liste.length} chasse${liste.length > 1 ? "s" : ""}, ${numeral(s.terrain).format()} cm², ${s.estime ? "" : `${tdcHeure} cm²/h, ${jsnHeure} JSN/h perdues, `}${unites}`,
        );
        return `<tr class='${classe}'><td>${libelle}</td><td>${liste.length}</td><td>${numeral(s.terrain).format()} cm²</td><td title='${s.estime ? "~ : durée estimée comme si la chasse partait maintenant (lancée ailleurs que d&#39;ici)" : "Durée réelle depuis le lancement"}'>${tdcHeure}</td><td title='Pertes moyennes estimées d&#39;après l&#39;armée envoyée et le TdC courant'>${jsnHeure}</td><td class='o_syntheseUnites'>${unites}</td></tr>`;
      },
      html = `<table class='o_maxWidth centre' cellspacing='0'>
        <tr class='gras'><td>Heure d'impact</td><td>Chasses</td><td>TdC chassé</td><td>TdC / h</td><td>JSN / h</td><td>Unités mises en chasse</td></tr>`;
    let aPartager = () => PageRessource.aPartager(groupes);
    if (partagerMaintenant) PartageChasses.partager(aPartager(), null);
    // chasses partagées puis annulées (ici ou par le lien du jeu) : retirées du forum
    else
      PartageChasses.recalerChasses(
        groupes.map((g) => ({
          debut: g.chasses[0].impact.format("YYYY-MM-DD HH:mm"),
          fin: g.impact.format("YYYY-MM-DD HH:mm"),
          terrain: somme(g.chasses).terrain,
        })),
      );
    if (!Utils.affichage("syntheseChasses")) return;
    groupes.forEach((g, i) => {
      html += ligne(g.impact.format("D MMM [à] HH[h]mm"), g.chasses, i % 2 ? "" : "ligne_paire");
    });
    if (groupes.length > 1) html += ligne("Total", chasses, "gras o_syntheseTotal");
    html += `</table><div class='o_syntheseBoutons'>
        <button type='button' id='o_copierSynthese' class='o_button f_info'>Copier la synthèse</button>
        <button type='button' id='o_partagerChasses' class='o_button f_info'>Partager mes chasses avec la ${Utils.alliance || "l'alliance"}</button>
      </div>`;
    html =
      "<div id='o_syntheseChasses'>" +
      Utils.spoiler(
        `Synthèse des chasses en cours (${chasses.length})`,
        html,
        "ressourcesSynthese",
        "gras",
      ) +
      "</div>";
    // sous le titre « Chasse en cours », au-dessus des lignes de chasse
    let $titre = $("#boite_tdc span.titre").filter((i, e) =>
      $(e).text().includes("Chasse en cours"),
    );
    if ($titre.length) $titre.first().after(html);
    else $("#boite_tdc").append(html);
    $("#o_copierSynthese").on("click", () =>
      CommerceFzzz.copier(textes.join("\n"), "Synthèse des chasses copiée dans le presse-papier."),
    );
    $("#o_partagerChasses").on("click", (e) =>
      PartageChasses.partager(aPartager(), $(e.currentTarget)),
    );
  }
  /**
   * Chasses en cours listées par une page Ressources (la courante, ou une
   * page lue par requête) : heure d'impact, terrain, unités, durée (réelle
   * pour une chasse lancée d'ici, estimée sinon) et pertes estimées.
   *
   * @static
   * @method lireChasses
   * @param {jQuery} racine document de Ressources.php
   * @return {Array}
   */
  static lireChasses(racine = $(document)) {
    if (!racine.find("#boite_tdc").length) return [];
    let chasses = [],
      dehors = {},
      niveau = (n) => Math.max(0, n || 0),
      vitesse = niveau(monProfil.niveauRecherche[5]),
      armes = niveau(monProfil.niveauRecherche[2]),
      bouclier = niveau(monProfil.niveauRecherche[1]),
      tdc = Math.max(1, Utils.terrain || 1);
    TroupesDehors.charger().forEach((t) => {
      if (t.type == "chasse" && t.id) dehors[t.id] = t;
    });
    racine.find("#boite_tdc span[id^='chasse_']").each((i, elt) => {
      let $ligne = $(elt).parent(),
        secondes = parseInt($ligne.nextAll("script").first().text().split("(")[1]),
        terrain = numeral(($ligne.text().match(/conquérir\s+([\d\s ]+)\s*cm/) || [])[1]).value(),
        details = $ligne.nextAll("small").first().text(),
        troupes =
          (details.match(/Troupes en chasses?\s*:\s*([^\n]+?)\.?\s*(?:Arrivée|$)/i) || [])[1] || "",
        libelle = details.match(/Arrivée à (\d+)h(\d+)/i);
      if (isNaN(secondes)) return;
      // minute d'impact : celle qu'affiche le jeu (« Arrivée à 02h59 »), placée
      // au jour le plus proche de l'arrivée calculée ; sinon l'arrivée calculée
      let arrivee = Horloge.serveur().add(secondes, "s"),
        impact = arrivee.clone().startOf("minute");
      if (libelle) {
        impact = arrivee
          .clone()
          .hours(parseInt(libelle[1]))
          .minutes(parseInt(libelle[2]))
          .startOf("minute");
        let ecart = impact.diff(arrivee, "hours", true);
        if (ecart > 12) impact.subtract(1, "day");
        else if (ecart < -12) impact.add(1, "day");
      }
      let unites = {};
      troupes.split(",").forEach((morceau) => {
        let m = morceau.trim().match(/^([\d\s ]+)\s+(.+)$/);
        if (m) unites[m[2].trim()] = numeral(m[1]).value();
      });
      // durée : écoulé depuis le lancement + reste du jeu, sinon estimée
      let envoi = dehors[parseInt($(elt).attr("id").split("_")[1])],
        duree = envoi
          ? Math.max(1, secondes + (Horloge.maintenant() - envoi.lancee) / 1000)
          : Math.max(1, SimulationChasse.duree(tdc, terrain || 0, vitesse)),
        armee = envoi ? envoi.unite : PageRessource._armeeDepuisNoms(unites),
        difficulte = SimulationChasse.difficulte(tdc, terrain || 0),
        attaque = SimulationChasse.attaqueArmee(armee, armes),
        pertes =
          attaque > 0 ? SimulationChasse.pertes(attaque / difficulte, difficulte, bouclier).AVG : 0;
      chasses.push({
        impact: impact,
        terrain: terrain || 0,
        unites: unites,
        duree: duree,
        estime: !envoi,
        pertes: pertes,
      });
    });
    return chasses;
  }
  /**
   * Groupes de chasses par minute d'impact (minutes consécutives : un seul
   * groupe, à la minute la plus tardive), par ordre d'impact.
   *
   * @static
   * @method grouperChasses
   */
  static grouperChasses(chasses) {
    chasses.sort((a, b) => a.impact - b.impact);
    let groupes = [];
    chasses.forEach((c) => {
      let dernier = groupes[groupes.length - 1];
      if (dernier && c.impact.diff(dernier.impact, "minutes") <= 1) {
        dernier.impact = c.impact;
        dernier.chasses.push(c);
      } else groupes.push({ impact: c.impact, chasses: [c] });
    });
    return groupes;
  }
  /**
   * Total d'une liste de chasses : terrain, débits, unités (détail par nom).
   *
   * @static
   * @method sommeChasses
   */
  static sommeChasses(liste) {
    let terrain = 0,
      tdcHeure = 0,
      jsnHeure = 0,
      estime = false,
      unites = {};
    liste.forEach((c) => {
      terrain += c.terrain;
      tdcHeure += (c.terrain / c.duree) * 3600;
      jsnHeure += (c.pertes / c.duree) * 3600;
      estime = estime || c.estime;
      // singulier et pluriel (« 1 Tank », « 3 Tanks ») sous la même clé
      for (let nom in c.unites) {
        let cle = nom.toLowerCase().replace(/s\b/g, "");
        if (!unites[cle]) unites[cle] = { nom: nom, nb: 0 };
        unites[cle].nb += c.unites[nom];
        // forme plurielle (la plus longue) pour l'affichage
        if (nom.length > unites[cle].nom.length) unites[cle].nom = nom;
      }
    });
    // ordre des unités du jeu (JSN, SN, NE, JS, S…), inconnues en dernier
    let rang = (nom) => {
        let r = [...NOM_UNITES, ...NOM_UNITE].findIndex(
          (n) => n.toLowerCase() == nom.toLowerCase(),
        );
        return r == -1 ? 99 : r % NOM_UNITES.length;
      },
      detail = Object.values(unites).sort((a, b) => rang(a.nom) - rang(b.nom)),
      total = detail.reduce((t, u) => t + u.nb, 0);
    return {
      terrain: terrain,
      tdcHeure: tdcHeure,
      jsnHeure: jsnHeure,
      estime: estime,
      total: total,
      detail: detail.map((u) => `${numeral(u.nb).format()} ${u.nom}`).join(", "),
    };
  }
  /**
   * Ce qui se publie dans le forum pour chaque groupe.
   *
   * @static
   * @method aPartager
   */
  static aPartager(groupes) {
    return groupes.map((g) => {
      let s = PageRessource.sommeChasses(g.chasses);
      return { impact: g.impact, terrain: s.terrain, unites: s.detail ? s.detail + "." : "" };
    });
  }
  /**
   * Publie dans le forum les chasses en cours d'une page Ressources lue par
   * requête (lancement depuis la boîte Chasse, sur une autre page).
   *
   * @static
   * @method partagerChassesDe
   * @param {String} html Ressources.php
   */
  static partagerChassesDe(html) {
    let racine = Utils.parseHtml(html);
    TroupesDehors.synchroniserChasses(racine);
    let chasses = PageRessource.lireChasses(racine);
    if (!chasses.length)
      return $.toast({ ...TOAST_WARNING, text: "Aucune chasse en cours : rien à partager." });
    PartageChasses.partager(PageRessource.aPartager(PageRessource.grouperChasses(chasses)), null);
  }
  /**
   * Armée (ordre d'Armee.unite) d'après les unités nommées par le jeu
   * (« Troupes en chasse : 1 000 Jeunes Soldates Naines, … »).
   *
   * @private
   * @static
   * @method _armeeDepuisNoms
   * @param {Object} unites nom → nombre
   * @return {Array}
   */
  static _armeeDepuisNoms(unites) {
    let armee = new Array(14).fill(0),
      noms = [...NOM_UNITES, ...NOM_UNITE].map((n) => n.toLowerCase().replace(/['’]/g, "'"));
    for (let nom in unites) {
      let i = noms.indexOf(nom.toLowerCase().replace(/['’]/g, "'")),
        u = i == -1 ? -1 : (i % NOM_UNITES.length) - 1;
      if (u >= 0) armee[u] += unites[nom] || 0;
    }
    return armee;
  }
  /**
   * Ajoute un bouton "Annuler toutes les chasses" dans la boîte de chasse en cours.
   * Le serveur expose `Ressources.php?annuler=<chasseId>` pour annuler une chasse —
   * on itère sur tous les spans `chasse_<id>` présents dans `#boite_tdc`.
   *
   * @private
   * @method boutonAnnulerChasses
   */
  boutonAnnulerChasses() {
    // le jeu n'affiche son lien « Annuler » que sur les chasses encore
    // annulables : ce sont elles qui comptent ; aucun lien, pas de bouton
    let ids = $("#boite_tdc a[href*='annuler=']")
      .map((_, a) => ($(a).attr("href") || "").split("annuler=")[1].replace(/\D.*$/, ""))
      .get()
      .filter((id, i, liste) => id && liste.indexOf(id) == i);
    if (!ids.length) return;
    $("#boite_tdc").append(
      `<div class="o_marginT15 centre"><button id="o_annulerChasses" class="o_button f_error" type="button">Annuler toutes les chasses (${ids.length})</button></div>`,
    );
    $("#o_annulerChasses").click(() => {
      if (!confirm(`Annuler les ${ids.length} chasse(s) en cours ? Action irréversible.`)) return;
      $("#o_annulerChasses").prop("disabled", true).text("Annulation…");
      let promesses = ids.map((id) => $.get(`${location.origin}/Ressources.php?annuler=${id}`));
      Promise.all(promesses).then(
        () => {
          location.reload();
        },
        () => {
          $.toast({
            ...TOAST_ERROR,
            text: "Au moins une annulation a échoué — rechargement quand même.",
          });
          setTimeout(() => location.reload(), 1500);
        },
      );
    });
  }
  /**
   * Ajoute les boutons "max", sauvegarde la chasse en cours.
   *
   * @private
   * @method plus
   */
  plus() {
    // Ajout des boutons pour l'affectation max
    $("#RecolteNourriture").after(
      "<a title='Affecter un maximum d’ouvrière à la nourriture' class='button_max' onclick='javascript:maxNourriture();' href='#max'><img class='o_vAlign' width='23' height='23' src='images/bouton/fleche_haut.gif'/></a>",
    );
    $("#RecolteMateriaux").after(
      "<a title='Affecter un maximum d’ouvrière aux matériaux' class='button_max' onclick='javascript:maxMateriaux();' href='#max'><img class='o_vAlign' width='23' height='23' src='images/bouton/fleche_haut.gif'/></a>",
    );
    // Hors C+ le formulaire du jeu envoie chasser toute l'armée du terrain de
    // chasse : on la mémorise pour la compter tant qu'elle est dehors. Elle
    // est relue juste avant l'envoi (elle a pu bouger depuis le chargement de
    // la page, une valeur périmée compterait des troupes fantômes), puis le
    // formulaire est renvoyé tel quel, quoi qu'il arrive à la lecture.
    let formChasse = $("form[action='AcquerirTerrain.php']"),
      armeeLue = false;
    formChasse.on("submit", (e) => {
      if (armeeLue || !(numeral($("#AcquerirTerrain").val()).value() > 0)) return;
      e.preventDefault();
      armeeLue = true;
      let bouton = e.originalEvent && e.originalEvent.submitter;
      Promise.resolve(new Armee().getArmee())
        .then((data) => TroupesDehors.enregistrerChasse(new Armee().chargeData(data, 1).unite))
        .catch(() => {})
        .finally(() => formChasse[0].requestSubmit(bouton || undefined));
    });
    // Affichage du retour des chasses
    let listeChasse = new Array();
    $("span[id^=chasse_]").each((i, elt) => {
      listeChasse.push({
        quantite: numeral($(elt).parent().text().split("conquérir")[1].split("cm²")[0]).value(),
        exp: Horloge.serveur().add(
          $(elt).parent().next().text().split("reste(")[1].split(",")[0],
          "s",
        ),
      });
      $(elt)
        .parent()
        .next()
        .after(
          "<span class='small'> Retour le " +
            Utils.roundMinute($(elt).parent().next().text().split(",")[0].split("(")[1]).format(
              "D MMM YYYY à HH[h]mm",
            ) +
            "</span>",
        );
    });
    // Sauvegarde de la chasse en cours, y compris quand il n'y en a plus
    // (annulée) pour vider la boîte
    this.saveChasse(listeChasse);
  }
  /**
   * Choix du mode d'affectation automatique des ouvrières sur la page, et
   * application du mode enregistré. Pour tous les comptes : en C+ le jeu
   * propose nativement Matériaux / Nourriture, mais pas le ratio.
   *
   * @private
   * @method affectation
   */
  affectation() {
    let affection = parseInt(monProfil.parametre["affectationRessource"].valeur),
      ratio = parseInt(monProfil.parametre["ratioRecolte"].valeur),
      // la part en nourriture est saisissable au clavier, celle en matériaux
      // en découle ; les deux suivent le curseur
      libelleRatio = (r) =>
        `<input id="o_ratioRecoltePart" class="o_sliderValeur" type="text" value="${r}"/> % <img alt="nourriture" src="images/icone/icone_pomme.png" height="14" class="o_vAlign"/> nourriture, <span id="o_ratioRecolteReste" class="gras">${100 - r} %</span> <img alt="matériaux" src="images/icone/icone_bois.png" height="13" class="o_vAlign"/> matériaux`,
      majRatio = (r) => {
        $("#o_ratioRecoltePart").spinner("value", r);
        $("#o_ratioRecolteReste").text(`${100 - r} %`);
      };
    // Ajout de la pref pour l'affectation auto.
    // C+ : le jeu a déjà sa rangée « Affectation automatique des ouvrières »
    // (radios choixOuvriere, envoyées au serveur). On y ajoute un choix
    // « Ratio » dans le même groupe pour garder une seule sélection. Sa valeur
    // est « rien », comme la croix : le jeu enregistre « pas d'affectation
    // automatique » (sinon il replacerait les ouvrières libres d'un seul côté
    // entre deux visites) et Toolzzz garde le mode Ratio de son côté. Le
    // radio est reconnu par son id, pas par sa valeur.
    // Non-C+ : rangée Toolzzz complète, avec un nom de groupe qui lui est propre.
    let ligneRatio = `<tr id="o_ratioRecolte" style="display:none;">
            <td><span class="text"><img src="images/icone/favicon.gif" height="16"> Répartition : <span id="o_ratioRecolteValeur">${libelleRatio(ratio)}</span></span></td>
            <td><div id="o_ratioRecolteCurseur" class="slider" style="width:150px;margin:6px 0;"></div></td>
        </tr>`;
    if (Utils.comptePlus) {
      // état enregistré côté serveur, lu avant d'ajouter notre radio
      let natifCoche = $("input[name=choixOuvriere]:checked").val();
      $("input[name=choixOuvriere][value=rien]")
        .closest("label")
        .before(
          `<label title="Répartir les ouvrières entre nourriture et matériaux selon une part fixe, préparée à chaque consultation de la page : clique sur Valider pour l'enregistrer (${NOM_EXTENSION})"><input type="radio" name="choixOuvriere" value="rien" id="o_ratioRadio"> Ratio</label> `,
        );
      // L'exclusion mutuelle des radios se fait par formulaire propriétaire, pas
      // par position dans le DOM : inséré dynamiquement, notre radio n'en a
      // aucun (le HTML du jeu ferme son <form> avant cette cellule) et forme
      // donc un groupe à part, où il reste coché en même temps qu'un choix
      // natif. On le rattache explicitement au formulaire des radios du jeu,
      // ce qui rétablit l'exclusion et l'envoi de sa valeur (« rien »).
      let formNatif = $("input[name=choixOuvriere]").not("#o_ratioRadio")[0].form;
      if (formNatif) {
        if (!formNatif.id) formNatif.id = "o_formRessource";
        $("#o_ratioRadio").attr("form", formNatif.id);
      }
      // Le mode Ratio soumet toujours « rien » au jeu : si le serveur a
      // enregistré autre chose, c'est que l'affectation native a été choisie
      // depuis, on abandonne le ratio. Sans ce recalage, un ratio mémorisé
      // recocherait Ratio à chaque chargement et rendrait les autres choix
      // impossibles à conserver.
      if (affection == 3 && natifCoche && natifCoche != "rien") {
        affection = 0;
        monProfil.parametre["affectationRessource"].valeur = 0;
        monProfil.parametre["affectationRessource"].sauvegarde();
      }
      if (affection == 3) $("#o_ratioRadio").prop("checked", true);
      $("input[name=choixOuvriere]").closest("tr").after(ligneRatio);
    } else
      $("#ChangeRessource").parent().parent().before(`<tr>
            <td><span class="text"><img src="images/icone/favicon.gif" height="16"> Affectation des ouvrières préparée à l'ouverture de la page : </span></td>
            <td class="o_affectationChoix" style="white-space:nowrap;"><label><input type="radio" name="o_choixOuvriere" value="nourriture" ${affection == 2 ? 'checked="checked"' : ""}><img alt="nourritures" src="images/icone/icone_pomme.png" height="18" title="Nourriture"></label>
            <label><input type="radio" name="o_choixOuvriere" value="materiaux" ${affection == 1 ? 'checked="checked"' : ""}> <img alt="materiaux" src="images/icone/icone_bois.png" height="17" title="Materiaux"></label>
            <label title="Répartir les ouvrières entre nourriture et matériaux selon une part fixe, conservée après une chasse ou un flood"><input type="radio" name="o_choixOuvriere" value="ratio" ${affection == 3 ? 'checked="checked"' : ""}> Ratio</label>
            <label><input type="radio" name="o_choixOuvriere" value="rien" ${affection == 0 ? 'checked="checked"' : ""}> <img alt="rien" src="images/croix.gif" height="23" title="Pas d'affectation automatique"></label>
        </td></tr>${ligneRatio}`);
    $("#o_ratioRecolte").toggle(affection == 3);
    $("#o_ratioRecoltePart").spinner({ min: 0, max: 100 });
    // Un réglage du ratio n'est qu'un aperçu dans les champs du jeu : il est
    // enregistré avec eux par le bouton du jeu, qui recharge la page. Appliqué
    // à chaque changement, il rechargeait la page à chaque clic sur une flèche.
    let apercuRatio = (r) => {
      ratio = r;
      majRatio(ratio);
      let repartition = this.repartitionRatio(ratio);
      $("#RecolteMateriaux").val(repartition.materiaux);
      $("#RecolteNourriture").val(repartition.nourriture);
    };
    $("#ChangeRessource").on("click", () => {
      if (monProfil.parametre["affectationRessource"].valeur != 3) return;
      monProfil.parametre["ratioRecolte"].valeur = ratio;
      monProfil.parametre["ratioRecolte"].sauvegarde();
    });
    // Le pas jQuery UI reste à 1 : avec un pas de 10, une valeur fine posée
    // depuis le champ serait arrondie. Le glissement à la souris est filtré
    // sur les multiples de 10 pour garder un curseur rapide ; le clavier sur
    // la poignée garde la précision.
    $("#o_ratioRecolteCurseur").slider({
      min: 0,
      max: 100,
      step: 1,
      value: ratio,
      slide: (e, ui) => {
        if (ui.value % 10 && !(e.originalEvent && e.originalEvent.type == "keydown")) return false;
        majRatio(ui.value);
      },
      // seulement sur action de l'utilisateur : une valeur posée depuis le
      // champ est appliquée par le champ
      change: (e, ui) => {
        if (e.originalEvent) apercuRatio(ui.value);
      },
    });
    // saisie au clavier : prise en compte à la sortie du champ ou avec les flèches
    $("#o_ratioRecoltePart").on("spinstop change", (e) => {
      let v = Math.min(100, Math.max(0, parseInt($(e.currentTarget).val()) || 0));
      $("#o_ratioRecolteCurseur").slider("value", v);
      apercuRatio(v);
    });
    if (Utils.comptePlus)
      // sur "click" et non "change" : le jeu peut réagir au changement en
      // rechargeant la page, l'écriture du paramètre doit être faite avant.
      // On identifie notre radio par son id, sa valeur étant « rien » comme
      // celle de la croix native.
      $("input[name=choixOuvriere]").on("click", (e) => {
        let actif = e.currentTarget.id == "o_ratioRadio";
        // un choix natif (nourriture, matériaux, rien) désactive le ratio Toolzzz
        monProfil.parametre["affectationRessource"].valeur = actif ? 3 : 0;
        monProfil.parametre["affectationRessource"].sauvegarde();
        $("#o_ratioRecolte").toggle(actif);
        // soumission même si la répartition est déjà bonne : le jeu doit
        // enregistrer « rien » pour son affectation automatique
        if (actif) this.affecterOuvrieres(3, ratio, true);
      });
    else
      $("input[name=o_choixOuvriere]").change(() => {
        switch ($("input[name=o_choixOuvriere]:checked").val()) {
          case "nourriture":
            monProfil.parametre["affectationRessource"].valeur = 2;
            break;
          case "materiaux":
            monProfil.parametre["affectationRessource"].valeur = 1;
            break;
          case "ratio":
            monProfil.parametre["affectationRessource"].valeur = 3;
            break;
          default:
            monProfil.parametre["affectationRessource"].valeur = 0;
            break;
        }
        monProfil.parametre["affectationRessource"].sauvegarde();
        $("#o_ratioRecolte").toggle(monProfil.parametre["affectationRessource"].valeur == 3);
        // le ratio s'affiche dans les champs du jeu, à enregistrer avec son
        // bouton ; les autres modes agissent à la prochaine consultation
        if (monProfil.parametre["affectationRessource"].valeur == 3) apercuRatio(ratio);
        return false;
      });
    // Affectation des ouvrières inutilisées si on a la pref. Règlement du s5 :
    // rien ne part sans clic du joueur. À l'ouverture de la page, la
    // répartition est seulement préparée dans le formulaire du jeu ; le joueur
    // l'enregistre avec le bouton du jeu.
    if (affection) this.affecterOuvrieres(affection, ratio, false, false);
  }
  /**
   * Affecte les ouvrières selon le mode choisi et soumet le formulaire du jeu
   * si quelque chose change. Matériaux / Nourriture complètent seulement les
   * ouvrières inutilisées ; Ratio impose la répartition.
   *
   * @private
   * @method affecterOuvrieres
   * @param {Integer} mode 1 matériaux, 2 nourriture, 3 ratio
   * @param {Integer} ratio part en nourriture (%) pour le mode 3
   * @param {Boolean} forcer soumettre même si la répartition ne change pas
   * @param {Boolean} soumettre faux : remplit le formulaire sans l'envoyer
   */
  affecterOuvrieres(mode, ratio, forcer = false, soumettre = true) {
    const CLE_TENTATIVE = "outiiil_affectationTentee";
    let materiaux = numeral($("#RecolteMateriaux").val()).value(),
      nourriture = numeral($("#RecolteNourriture").val()).value(),
      affectables = Math.min(Utils.ouvrieres, Utils.terrain),
      nouveauMateriaux = materiaux,
      nouvelleNourriture = nourriture;
    if (mode == 3) {
      let repartition = this.repartitionRatio(ratio);
      nouvelleNourriture = repartition.nourriture;
      nouveauMateriaux = repartition.materiaux;
    } else if (materiaux + nourriture < affectables) {
      // si on ne couvre pas le terrain et qu'on a assez d'ouvrières
      if (mode == 1) nouveauMateriaux = affectables - nourriture;
      else if (mode == 2) nouvelleNourriture = affectables - materiaux;
    }
    if (nouveauMateriaux == materiaux && nouvelleNourriture == nourriture && !forcer) {
      sessionStorage.removeItem(CLE_TENTATIVE);
      return;
    }
    if (!soumettre) {
      $("#RecolteMateriaux").val(nouveauMateriaux);
      $("#RecolteNourriture").val(nouvelleNourriture);
      $("#ChangeRessource").addClass("o_synchroPret");
      $.toast({
        ...TOAST_INFO,
        text: "Affectation des ouvrières préparée : clique sur le bouton du jeu pour l'enregistrer.",
      });
      return;
    }
    // la soumission recharge la page : si le jeu n'a pas appliqué la valeur
    // demandée on ne retente pas, sinon la page rechargerait en boucle
    if (sessionStorage.getItem(CLE_TENTATIVE)) {
      sessionStorage.removeItem(CLE_TENTATIVE);
      $.toast({
        ...TOAST_WARNING,
        text: "L'affectation automatique des ouvrières n'a pas été appliquée par le jeu.",
      });
      return;
    }
    sessionStorage.setItem(CLE_TENTATIVE, "1");
    this._rechargement = true;
    $("#RecolteMateriaux").val(nouveauMateriaux);
    $("#RecolteNourriture").val(nouvelleNourriture);
    $("#ChangeRessource").click();
  }
  /**
   * Ouvrières en nourriture et en matériaux pour une part `ratio` (%) en nourriture.
   *
   * @private
   * @method repartitionRatio
   */
  repartitionRatio(ratio) {
    let affectables = Math.min(Utils.ouvrieres, Utils.terrain),
      nourriture = Math.round((affectables * ratio) / 100);
    return { nourriture: nourriture, materiaux: affectables - nourriture };
  }
  /**
   * Sauvegarde la chasse en cours.
   *
   * @private
   * @method saveChasse
   */
  saveChasse(listeChasse) {
    if (!listeChasse.length) {
      if (this._boiteComptePlus.chasse.length) {
        this._boiteComptePlus.chasse = [];
        this._boiteComptePlus.startChasse = 0;
        this._boiteComptePlus.sauvegarder().majChasse();
      }
      return this;
    }
    if (
      !this._boiteComptePlus.hasOwnProperty("chasse") ||
      this._boiteComptePlus.chasse.length != listeChasse.length ||
      this._boiteComptePlus.chasse[0]["quantite"] != listeChasse[0]["quantite"] ||
      (listeChasse[0]["exp"].diff(this._boiteComptePlus.chasse[0]["exp"], "s") > 1 &&
        !Utils.comptePlus &&
        $("#boiteComptePlus").length)
    ) {
      this._boiteComptePlus.chasse = listeChasse;
      this._boiteComptePlus.startChasse = Horloge.serveur();
      this._boiteComptePlus.sauvegarder().majChasse();
    }
    return this;
  }
}
