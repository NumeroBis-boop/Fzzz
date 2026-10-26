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
  executer() {
    if ($("#tabChoixArmee").length) {
      // récupération de l'armée
      this._armee = new Armee({ unite: this.extraitArmee() });
      this.majStatistique(this._armee);
      // ajoute event
      $("input[id^=unite]").on("input", (e) => {
        this.majStatistique();
      });
      // on recupére le profil du joueur pour les coordonnées
      this._cible.getProfil().then((data) => {
        this._cible.chargerProfil(data);
        // affichage des options avancées de lancement de l'armée
        this.ajouterOption();
        // ajoute des outils de floods
        this.formulaireFlood();
      });
    }
    if (!Utils.comptePlus) this.plus();
    AttaqueLancee.afficherTableaux();
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
    $("#formulaireChoixArmee fieldset:eq(1)")
      .tooltip({
        position: { my: "left+10", at: "right center" },
        content: html,
        items: "fieldset",
        hide: { effect: "fade", duration: 10 },
        tooltipClass: "ui-tooltip-right ui-tooltip-brown ui-tooltip-lightBrown",
      })
      .tooltip("open");
    $("#formulaireChoixArmee fieldset:eq(1)").on("mouseout focusout", (e) => {
      e.stopImmediatePropagation();
    });
  }
  /**
   *
   */
  ajouterOption() {
    // on deplace le bouton standarf à droite
    $("input[name='ChoixArmee']").unwrap().wrap("<div id='o_btnLancer' class='right'></div>");
    // Capture de l'attaque au moment de l'envoi pour le récapitulatif par
    // cible. Hook sur le submit du formulaire : couvre le clic sur le bouton,
    // la touche Entrée, et les lancements programmés (Synchroniser / Sonder).
    $("input[name='ChoixArmee']")
      .closest("form")
      .on("submit", () => {
        AttaqueLancee.enregistrer(
          this._cible.pseudo,
          $("#lieu option:selected").text().trim(),
          this.extraitArmee(),
          { terrain: this._cible.terrain },
        );
      });
    // Ajout du bouton pour la synchro simple
    // Ajout du temps de trajet
    const nbSonde = monProfil.parametre["uniteSonde"].valeur;
    const titleSync = `Affiche le compte à rebours, au dixième de seconde et en heure du serveur + latence, jusqu'au moment où l'attaque arrivera sur une minute pleine (utile pour synchroniser plusieurs attaques avec des alliés). À zéro, c'est à toi de cliquer sur Lancer.`;
    const titleSonde = `Prépare ${nbSonde} unité${nbSonde > 1 ? "s" : ""} de la première espèce disponible (configurable dans Paramètres → Général) et affiche le compte à rebours de la minute pleine — révèle le nombre de défenseurs ennemis sans engager toute l'armée. À zéro, c'est à toi de cliquer sur Lancer.`;
    const titleSondeDirect = `Comme Sonder mais sans attendre la minute pleine : envoi immédiat, au clic. Utile quand le timing n'a pas d'importance.`;
    $("#o_btnLancer")
      .before(
        `<div id="o_btnSynchro"><button id='o_synchro' class="o_button f_info" title="${titleSync}">Synchroniser</button><button id='o_sonder' class="o_button f_error" title="${titleSonde}">Sonder</button><button id='o_sonderDirect' class="o_button f_error" title="${titleSondeDirect}">Sonder direct</button></div>`,
      )
      .after(
        `${Utils.affichage("trajet") ? `<p class="centre reduce">Temps de trajet : <span id="o_tempsTrajet" class="gras">${Utils.duree(monProfil.getTempsParcours2(this._cible))}</span></p>` : ""}<p class="centre reduce ligne_paire">Votre armée rentrera le <span id="o_retourArmee" class="gras">${Horloge.clic().add(monProfil.getTempsParcours2(this._cible), "s").format("D MMM à HH[h]mm[m]ss[s]")}</span> (RC : <span id="o_retourArmeeRC" class="gras">${Utils.roundMinute(monProfil.getTempsParcours2(this._cible), Horloge.clic()).format("D MMM à HH[h]mm")}</span>).</p>`,
      );
    $("#o_synchro").click((e) => {
      e.preventDefault();
      $("#o_btnSynchro button").prop("disabled", true);
      this.lancerSynchro(this._cible.attenteSynchro());
      return false;
    });
    // Remplit le formulaire avec une sonde (1ʳᵉ espèce dispo × paramètre uniteSonde)
    const remplirFormulaireSonde = () => {
      let premiereUnite = true;
      $("#lieu").val(3);
      for (let i = 1; i < 15; i++)
        if ($("#unite" + i).length) {
          $("#unite" + i).val(premiereUnite ? monProfil.parametre["uniteSonde"].valeur : 0);
          premiereUnite = false;
        }
    };
    // Sonde synchronisée (arrive sur la minute pleine)
    $("#o_sonder").click((e) => {
      e.preventDefault();
      $("#o_btnSynchro button").prop("disabled", true);
      remplirFormulaireSonde();
      this.lancerSynchro(this._cible.attenteSynchro());
      return false;
    });
    // Sonde directe (envoi immédiat, pas de synchro)
    $("#o_sonderDirect").click((e) => {
      e.preventDefault();
      $("#o_btnSynchro button").prop("disabled", true);
      remplirFormulaireSonde();
      $("input[name='ChoixArmee']").click();
      return false;
    });
    Utils.incrementTime(
      monProfil.getTempsParcours2(this._cible),
      "o_retourArmee",
      "o_retourArmeeRC",
    );
  }
  /**
   *
   */
  lancerSynchro(attente) {
    // Règlement du s5 : le clic final appartient au joueur. L'extension affiche
    // seulement le compte à rebours et signale le moment de cliquer.
    // Compte à rebours au dixième, en heure serveur + latence : un réglage de
    // la latence pendant le décompte est pris en compte.
    let cible = Horloge.clic().valueOf() + attente * 1000,
      arrivee = Horloge.clic().add(attente, "s").add(monProfil.getTempsParcours2(this._cible), "s");
    $("#formulaireChoixArmee fieldset:eq(1)").append(
      `<p id="o_syncA" class="centre">Clique sur <b>Lancer</b> dans : <span id='o_decSyncA' class='gras'></span> (arrivée ${arrivee.format("HH[h]mm[m]ss[s]")}, latence ${Horloge.libelleLatence()}).</p>`,
    );
    let tic = () => {
      let reste = cible - Horloge.clic().valueOf();
      if (reste > 0) {
        $("#o_decSyncA").text((reste / 1000).toFixed(1).replace(".", ",") + " s");
        setTimeout(tic, Math.min(100, reste));
      } else {
        $("#o_syncA").html("<b>Clique sur Lancer maintenant.</b>").addClass("red");
        $("input[name='ChoixArmee']").addClass("o_synchroPret").focus();
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
    $(".simulateur:eq(0)")
      .append(`<fieldset id='o_prepaFlood' class='centre'><legend><span class='titre'>Lanceur de Flood</span> <span class='reduce'>(${creneaux} créneau${creneaux > 1 ? "x" : ""} libre${creneaux > 1 ? "s" : ""} sur ${monProfil.niveauRecherche[6] + 1})</span></legend>
            <table id='o_simulationFlood' class='o_maxWidth' cellspacing=0>
			<tr class='gras'><td>Etape</td><td>Troupes</td><td>Supp.*</td><td>Mon Terrain</td><td>${this._cible.pseudo} (${Utils.intToTime(monProfil.getTempsParcours2(this._cible))})</td></tr>
			<tr><td><select id='o_methodeFlood'><option value='0' ${methode == 0 ? "selected" : ""}>${METHODE_FLOOD[0]}</option><option value='1' ${methode == 1 ? "selected" : ""}>${METHODE_FLOOD[1]}</option><option value='2' ${methode == 2 ? "selected" : ""}>${METHODE_FLOOD[2]}</option><option value='3' ${methode == 3 ? "selected" : ""}>${METHODE_FLOOD[3]}</option></select></td><td colspan="2"></td><td><input value='${Utils.terrain}' size='12' id='o_floodTDCA'/></td><td><input value='${this._cible.terrain}' size='12' id='o_floodTDCB'/></td></tr>
			<tr><td>Antisonde (<span id="o_pourcentAttaque0">0</span>%)</td><td><input value='0' size='12' id='o_floodAntiSonde'/></td><td></td><td>${numeral(Utils.terrain).format()}</td><td>${numeral(this._cible.terrain).format()}</td></tr>
            <tr class="gras reduce"><td colspan="3"></td><td><span id="o_supprimeAttaque" class="souligne cursor" ${methode == 1 ? "style=display:none;" : ""}>Supprimer une attaque</span></td><td><span id="o_ajouteAttaque" class="souligne cursor" ${methode == 1 ? "style=display:none;" : ""}>Ajouter une attaque</span></td></tr>
            </table>
            <button id='o_lanceFlood' class='o_button f_success'>Flooder</button>
            <p class="reduce left">* : place les unités restantes sur l'attaque selectionnée.</p>
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
    $("#o_lanceFlood").click((e) => {
      // désactivé dès le premier clic : un double clic lançait deux floods en
      // parallèle (chaque attaque partait deux fois)
      $(e.currentTarget).prop("disabled", true).text("Flood en cours…");
      // contexte pour que envoyerFlood capture chaque attaque confirmée. Le
      // terrain de départ est celui saisi dans la simulation (par défaut celui
      // du profil, modifiable si on connaît une valeur plus fraîche)
      AttaqueLancee.contexteFlood = {
        cible: this._cible.pseudo,
        terrain: $("#o_floodTDCB").spinner("value"),
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
      dataEvo.startAttaque = moment();
      localStorage.setItem("outiiil_evolution", JSON.stringify(dataEvo));
      if (!Utils.comptePlus && $("#boiteComptePlus").length) {
        this._boiteComptePlus.attaque = dataEvo.attaque;
        this._boiteComptePlus.startAttaque = dataEvo.startAttaque;
        this._boiteComptePlus.majAttaque();
      }
    }
  }
}
