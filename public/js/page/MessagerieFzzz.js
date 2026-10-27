/*
 * MessagerieFzzz.js
 * Fzzz
 **********************************************************************/

/**
 * Catégories des messages et dossier du jeu qui les reçoit. `type` est la
 * valeur de data-type des lignes déjà rangées dans ce dossier. Le combat est
 * testé avant la chasse : « Invasion de X : votre armée a été vaincue sur le
 * Terrain de chasse » est un RC de combat.
 */
const CATEGORIES_MESSAGES = [
  {
    nom: "convoi",
    dossier: "Commerce",
    type: "Commerce",
    systeme: true,
    titre: /^convoi\b|\bconvoi (reçu|livré)/i,
  },
  {
    nom: "combat",
    dossier: "Combat",
    type: "Combats",
    systeme: true,
    titre:
      /vol par|butin chez|invasion|attaque (réussie|échouée)|colonie|rebellion|conquis par|défense/i,
  },
  {
    nom: "chasse",
    dossier: "Chasse",
    type: "Chasses",
    systeme: true,
    titre: /chasse|chasseuses/i,
  },
  { nom: "conversation", dossier: "Conversation", type: "Conversations", systeme: false },
];

/**
 * Ajouts de Fzzz à la messagerie :
 * - titres colorés par type : RC de combat en défense ou en attaque, RC de
 *   chasse, convois, autres messages ;
 * - à l'ouverture de la messagerie, rangement des convois dans « Commerce »,
 *   des RC de chasse dans « Chasse », des RC de combat dans « Combat » et des
 *   conversations dans « Conversation », avec la requête du menu « Déplacer
 *   vers » du jeu (une par dossier, uniquement pour les messages mal rangés) ;
 * - un bouton qui copie le rapport complet d'une conversation.
 *
 * @class MessagerieFzzz
 */
class MessagerieFzzz {
  /**
   * Bouton « Partager mes RC » avec l'alliance sous le titre « Messagerie ».
   * Pas encore branchés : un message l'indique.
   *
   * @static
   * @method boutonsPartage
   */
  static boutonsPartage() {
    let $titre = $("#messagerie > h2").first();
    if (!$titre.length || $("#o_partageAlliance").length) return;
    let tag = Utils.alliance || "l'alliance";
    $(`<div id='o_partageAlliance'>
        <button type='button' class='o_button f_info' data-quoi='rc'>Partager mes RC avec la ${tag}</button>
      </div>`)
      .insertAfter($titre)
      .find("button")
      .on("click", (e) => {
        e.preventDefault();
        $.toast({ ...TOAST_INFO, text: "En cours de dev" });
      });
  }
  /**
   * Catégorie d'une ligne de conversation, ou null.
   *
   * @static
   * @method categorie
   */
  static categorie($ligne) {
    let titre = $ligne.find(".intitule_message").text(),
      participants = $ligne.find(".td_participants").text().trim(),
      systeme = /^fourmizzz$/i.test(participants);
    if (!systeme)
      return $ligne.data("type") == "Alliance"
        ? null
        : CATEGORIES_MESSAGES.find((c) => c.nom == "conversation");
    return CATEGORIES_MESSAGES.find((c) => c.systeme && c.titre.test(titre)) || null;
  }
  /**
   * Couleurs et bouton de copie sur les lignes pas encore traitées.
   *
   * @static
   * @method decorer
   */
  static decorer() {
    if (!Utils.affichage("messagerieCouleurs")) return;
    // copie des conversations cochées, à gauche de « Boîte de réception »
    let $toutes = $("#selection_toutes_checkbox");
    if ($toutes.length && !$toutes.find(".o_copierRapport").length)
      $(
        `<img class='o_copierRapport' src='${IMG_COPIER}' title='Copier les rapports complets des conversations sélectionnées' alt='Copier'/>`,
      )
        .appendTo($toutes)
        .on("click", (e) => {
          // le clic sur la case voisine coche tout : il ne doit pas l'atteindre
          e.preventDefault();
          e.stopPropagation();
          MessagerieFzzz.copierSelection();
        });
    $("tr.en_tete_message[id^='conversation_']")
      .not(".o_fzzz")
      .each((i, elt) => {
        let $ligne = $(elt).addClass("o_fzzz"),
          c = MessagerieFzzz.categorie($ligne),
          $titre = $ligne.find(".intitule_message");
        // titre complet au survol : la liste compactée le tronque
        if (!$titre.attr("title")) $titre.attr("title", $titre.text().trim());
        // une couleur par type : combat en défense / en attaque, chasse,
        // convoi, autres messages (voir outiiil.css)
        let classe = !c
          ? "o_titreAutre"
          : c.nom == "combat"
            ? // en défense : on a été attaqué (vol, invasion, colonie perdue…)
              /vol par|invasion|colonie perdue|conquis par|défense/i.test($titre.text())
              ? "o_titreDefense"
              : "o_titreAttaque"
            : { convoi: "o_titreConvoi", chasse: "o_titreChasse", conversation: "o_titreAutre" }[
                c.nom
              ];
        // le titre et la date prennent la couleur du type
        if (classe) $titre.add($ligne.find(".td_objet > span").first()).addClass(classe);
        $(
          `<img class='o_copierRapport' src='${IMG_COPIER}' title='Copier le rapport complet' alt='Copier'/>`,
        )
          .appendTo($ligne.find(".td_coche"))
          .on("click", (e) => {
            // la ligne s'ouvre au clic : celui-ci ne doit pas l'atteindre
            e.preventDefault();
            e.stopPropagation();
            MessagerieFzzz.copier($ligne);
          });
      });
  }
  /**
   * Suit les listes rechargées par le jeu (changement de dossier, recherche).
   *
   * @static
   * @method observer
   */
  static observer(page) {
    let cible = document.getElementById("corps_messagerie") || document.body,
      attente = null;
    new MutationObserver(() => {
      clearTimeout(attente);
      attente = setTimeout(() => {
        // couleurs du jeu (rouge / vert) sur les listes rechargées
        if (page) page.couleurMessage();
        MessagerieFzzz.decorer();
        MessagerieFzzz.analyser();
      }, 50);
    }).observe(cible, { childList: true, subtree: true });
  }
  /**
   * Ligne d'en-tête (tr.en_tete_message) de la conversation qui contient `elt`.
   *
   * @private
   * @static
   */
  static _entete(elt) {
    for (let n = elt; n && n !== document.body; n = n.parentElement)
      for (let s = n.previousElementSibling; s; s = s.previousElementSibling)
        if (s.matches && s.matches("tr.en_tete_message")) return $(s);
    return $();
  }
  /**
   * Boutons « Analyser » sous les rapports ouverts : un pour l'ensemble des
   * chasses d'une conversation, un par RC de combat.
   *
   * @static
   * @method analyser
   */
  static analyser() {
    if (!Utils.affichage("messagerieAnalyse")) return;
    let chasses = new Set();
    $("tr[id^='message_']")
      .not(".o_fzzzVu")
      .each((i, elt) => {
        let $m = $(elt).addClass("o_fzzzVu"),
          $texte = $m.find(".message").first();
        if (!$texte.length) return;
        // correction d'affichage reprise de Toolzzz
        $texte.removeAttr("colspan");
        let $entete = MessagerieFzzz._entete(elt),
          titre = $entete.find(".intitule_message").text();
        if (/chasseuses ont conquis|chasse réussie/i.test(titre)) chasses.add($entete.attr("id"));
        else if (
          /attaque (réussie|échouée)|invasion|rebellion|vol par|butin chez|colonie/i.test(titre)
        )
          MessagerieFzzz._analyseCombat($m, $texte);
      });
    chasses.forEach((id) => id && MessagerieFzzz._analyseChasses($("#" + id)));
  }
  /**
   * Bouton et tableau repliable, comme l'onglet « Analyser » des outils.
   *
   * @private
   * @static
   */
  static _bloc(id, libelle, contenu, aLOuverture = null) {
    let $bloc = $(`<div id='${id}' class='o_analyseRapport'>
        <button type='button' class='o_button f_info o_analyseBouton'>${libelle}</button>
        <div class='o_analyseContenu' style='display:none'>${contenu}</div>
      </div>`);
    $bloc.find(".o_analyseBouton").on("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      let $contenu = $bloc.find(".o_analyseContenu").toggle();
      if (aLOuverture && $contenu.is(":visible")) aLOuverture($bloc);
    });
    return $bloc;
  }
  /**
   * Bilan des chasses d'une conversation, sous son dernier rapport : une
   * chasse ou le bilan au choix, comme dans l'outil Chasse.
   *
   * @private
   * @static
   */
  static _analyseChasses($entete) {
    let conv = $entete.attr("id").match(/\d+/)[0],
      $messages = $entete.nextUntil("tr.en_tete_message").find("tr[id^='message_'] .message"),
      bilan = new Chasse(""),
      vues = [];
    $messages.each((i, elt) => {
      let chasse = new Chasse($(elt).text());
      try {
        if (!chasse.analyse()) return;
      } catch (e) {
        return;
      }
      vues.push(chasse.toHTMLBilan());
      bilan.ajoute(chasse);
      HistoriqueChasses.enregistrer($(elt).closest("tr[id^='message_']"), chasse);
    });
    $("#o_analyseChasses_" + conv).remove();
    if (!vues.length) return;
    let n = vues.length,
      choix = "";
    if (n > 1) {
      vues.push(bilan.toHTMLBilan());
      choix = `<select class='o_analyseChoix'>${vues
        .map(
          (v, k) =>
            `<option value='${k}'${k == n ? " selected" : ""}>${k == n ? "Bilan" : "Chasse " + (k + 1)}</option>`,
        )
        .join("")}</select>`;
    }
    let contenu =
        `<div class='o_analyseLigne'><div class='o_analyseGauche'>` +
        choix +
        vues
          .map(
            (v, k) =>
              `<div class='o_analyseVue'${k == vues.length - 1 ? "" : " style='display:none'"}>${v}</div>`,
          )
          .join("") +
        `</div><div class='o_analyseDroite'><div id='o_grapheChasses_${conv}' class='o_grapheChasses'></div><div class='o_grapheActions'></div></div></div>`,
      $bloc = MessagerieFzzz._bloc(
        "o_analyseChasses_" + conv,
        n > 1 ? `Analyser les ${n} chasses` : "Analyser la chasse",
        contenu,
        ($b) => HistoriqueChasses.afficher($b, "o_grapheChasses_" + conv),
      );
    $messages.last().append($bloc);
    $bloc.find(".o_analyseChoix").on("change", (e) => {
      $bloc.find(".o_analyseVue").hide().eq(parseInt(e.currentTarget.value)).show();
    });
  }
  /**
   * Analyse d'un RC de combat sous le rapport. Pour une sonde, un bouton ouvre
   * l'onglet « Analyser » de l'outil Combat avec ce rapport (calcul de
   * l'attaque à lancer).
   *
   * @private
   * @static
   */
  static _analyseCombat($m, $texte) {
    let id = ($m.attr("id").match(/\d+/) || [""])[0],
      rc = $texte.text(),
      combat = new Combat({ id: id, RC: rc }),
      contenu = "";
    try {
      contenu = combat.analyse()
        ? `<table class='o_maxWidth'>${combat.toHTMLBoite()}</table>`
        : "<p>Ce rapport ne peut pas être analysé.</p>";
    } catch (e) {
      contenu = "<p>Ce rapport ne peut pas être analysé.</p>";
    }
    let sonde = null;
    try {
      sonde = combat.analyseSonde();
    } catch (e) {}
    if (sonde)
      contenu += `<button type='button' class='o_button o_analyseSonde'>Analyse de la sonde dans l'outil Combat</button>`;
    let $bloc = MessagerieFzzz._bloc("o_analyseCombat_" + id, "Analyser", contenu);
    $texte.append($bloc);
    $bloc.find("table tr:even").css("background-color", monProfil.parametre["couleur2"].valeur);
    $bloc.find(".o_analyseSonde").on("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      // outil Combat, onglet Analyser, avec ce rapport
      $("#o_itemCombat").parent().click();
      setTimeout(() => {
        $("#o_tabsCombat").tabs("option", "active", 0);
        $("#o_rcCombat").val(rc).trigger("input");
      }, 300);
    });
  }
  /**
   * Range les messages mal classés dans le dossier de leur catégorie.
   *
   * @static
   * @method ranger
   */
  static ranger() {
    // identifiants des dossiers, lus dans le menu « Déplacer vers » du jeu
    let dossiers = {};
    $(".option_deplacement[id^='deplacer_vers_']").each((i, elt) => {
      dossiers[$(elt).find(".intitule_choix").text().trim()] = $(elt).attr("id").match(/\d+/)[0];
    });
    let aDeplacer = {};
    $("tr.en_tete_message[id^='conversation_']").each((i, elt) => {
      let $ligne = $(elt),
        c = MessagerieFzzz.categorie($ligne);
      if (!c || !dossiers[c.dossier] || $ligne.data("type") == c.type) return;
      (aDeplacer[c.dossier] = aDeplacer[c.dossier] || []).push($ligne);
    });
    let envois = Object.keys(aDeplacer).map((dossier) => {
      let lignes = aDeplacer[dossier];
      return Promise.resolve(
        $.post(location.origin + "/messagerie.php", {
          traitement: "deplacer",
          id_conversations: lignes.map(($l) => parseInt($l.attr("id").match(/\d+/)[0])),
          id_destination: dossiers[dossier],
        }),
      )
        .then((reponse) => {
          if (!/action_valide/.test(String(reponse))) return 0;
          let type = CATEGORIES_MESSAGES.find((c) => c.dossier == dossier).type;
          lignes.forEach(($l) => $l.attr("data-type", type).data("type", type));
          return lignes.length;
        })
        .catch(() => 0);
    });
    if (!envois.length) return;
    Promise.all(envois).then((nombres) => {
      let total = nombres.reduce((s, n) => s + n, 0),
        prevu = Object.values(aDeplacer).reduce((s, l) => s + l.length, 0);
      if (total)
        $.toast({
          ...TOAST_SUCCESS,
          text: `${total} message${total > 1 ? "s rangés" : " rangé"} dans leur dossier (Commerce, Chasse, Combat, Conversation).`,
        });
      if (total < prevu)
        $.toast({
          ...TOAST_ERROR,
          text: `${prevu - total} message(s) n'ont pas pu être rangés.`,
        });
    });
  }
  /**
   * Texte complet d'une conversation : titre, puis chaque message avec son
   * en-tête (auteur, date).
   *
   * @static
   * @method texte
   */
  static texte($ligne, $messages) {
    let lignes = [
      $ligne.find(".intitule_message").text().trim(),
      $ligne.find(".td_participants").text().trim(),
      "",
    ];
    $messages.each((i, elt) => {
      // lignes sans contenu (séparateurs, en-têtes seuls) : ignorées
      if (!$(elt).find(".message").length) return;
      let message = $(elt).find(".message").first().clone();
      message.find("br").replaceWith("\n");
      // retire les ajouts de l'extension (analyses, boutons)
      message.find("div[id^='o_analyse'], .o_optionMessage").remove();
      let entete = $(elt).find(".expe").first().text().replace(/\s+/g, " ").trim();
      if (entete) lignes.push(entete);
      lignes.push(
        message
          .text()
          .split("\n")
          .map((l) => l.replace(/[ \t ]+/g, " ").trim())
          .join("\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim(),
        "",
      );
    });
    return lignes.join("\n").trim();
  }
  /**
   * Rapport complet d'une conversation. Si elle est ouverte, on lit la page ;
   * sinon on la charge comme le jeu le fait à l'ouverture.
   *
   * @static
   * @method rapport
   * @return {Promise} texte
   */
  static rapport($ligne) {
    // déjà chargé pendant cette visite, et sans nouveau message depuis
    let cle = MessagerieFzzz._cleRapport($ligne);
    MessagerieFzzz._rapports = MessagerieFzzz._rapports || new Map();
    if (!MessagerieFzzz._rapports.has(cle)) {
      let p = MessagerieFzzz._chargerRapport($ligne);
      MessagerieFzzz._rapports.set(cle, p);
      p.catch(() => MessagerieFzzz._rapports.delete(cle));
    }
    return MessagerieFzzz._rapports.get(cle);
  }
  /**
   * Durée moyenne (ms) du chargement d'un rapport, mesurée sur les copies
   * précédentes (moyenne glissante, gardée dans le navigateur).
   *
   * @static
   */
  static get dureeRapport() {
    return parseInt(localStorage.getItem("fzzz_dureeRapport")) || 600;
  }
  static set dureeRapport(ms) {
    localStorage.setItem(
      "fzzz_dureeRapport",
      Math.round(0.7 * MessagerieFzzz.dureeRapport + 0.3 * ms),
    );
  }
  /**
   * Vrai si le rapport s'obtient sans requête : conversation ouverte, ou déjà
   * chargée pendant cette visite.
   *
   * @static
   * @method rapportPret
   */
  static rapportPret($ligne) {
    return (
      $ligne.nextUntil("tr.en_tete_message").find("tr[id^='message_']").length > 0 ||
      (MessagerieFzzz._rapports || new Map()).has(MessagerieFzzz._cleRapport($ligne))
    );
  }
  /**
   * @private
   * @static
   */
  static _cleRapport($ligne) {
    return $ligne.attr("id") + "|" + $ligne.find(".td_objet > span").first().text();
  }
  /**
   * @private
   * @static
   */
  static _chargerRapport($ligne) {
    let debut = Date.now(),
      id = $ligne.attr("id").match(/\d+/)[0],
      ouverts = $ligne.nextUntil("tr.en_tete_message").find("tr[id^='message_']");
    let charger = ouverts.length
      ? Promise.resolve(ouverts)
      : Promise.resolve(
          $.post(location.origin + "/messagerie.php", { traitement: "afficher", conversation: id }),
        ).then((html) => {
          MessagerieFzzz.dureeRapport = Date.now() - debut;
          // DOMParser : le contenu des messages (écrit par d'autres joueurs)
          // n'exécute rien ; <table> pour garder les lignes <tr>
          return Utils.parseHtml(`<table>${html}</table>`).find("tr[id^='message_']");
        });
    return charger.then(($messages) => {
      if (!$messages.length) throw new Error("vide");
      return MessagerieFzzz.texte($ligne, $messages);
    });
  }
  /**
   * @static
   * @method copier
   */
  static copier($ligne) {
    MessagerieFzzz.rapport($ligne)
      .then((texte) => CommerceFzzz.copier(texte, "Rapport copié dans le presse-papier."))
      .catch(() =>
        $.toast({ ...TOAST_ERROR, text: "Le rapport n'a pas pu être chargé, la copie a échoué." }),
      );
  }
  /**
   * Copie les rapports des conversations cochées, l'un après l'autre (une
   * requête à la fois pour celles qui ne sont pas ouvertes).
   *
   * @static
   * @method copierSelection
   */
  static copierSelection() {
    let lignes = $("tr.en_tete_message[id^='conversation_']")
      .filter((i, elt) => $(elt).find(".checkbox_message").prop("checked"))
      .get();
    if (!lignes.length) {
      $.toast({ ...TOAST_INFO, text: "Aucune conversation sélectionnée." });
      return;
    }
    // double clic : une seule série de chargements à la fois
    if (MessagerieFzzz._copieEnCours) {
      $.toast({ ...TOAST_INFO, text: "Copie déjà en cours, patiente un instant." });
      return;
    }
    MessagerieFzzz._copieEnCours = true;
    // le serveur refuse deux requêtes simultanées (voir Requetes.js) : les
    // rapports sont chargés l'un après l'autre, dans l'ordre de la liste
    let textes = [],
      echecs = 0,
      aCharger = lignes.filter((elt) => !MessagerieFzzz.rapportPret($(elt))).length,
      restants = aCharger,
      // attente estimée : durée moyenne d'un chargement × rapports restants
      fin = Date.now() + restants * MessagerieFzzz.dureeRapport,
      attente = null,
      afficher = () => {
        let s = Math.max(1, Math.ceil((fin - Date.now()) / 1000));
        $("#o_attenteCopie").text(`${aCharger - restants}/${aCharger} chargés · encore ≈ ${s} s`);
      };
    if (aCharger > 1) {
      $.toast({
        ...TOAST_INFO,
        hideAfter: false,
        text: `Chargement des rapports, un par un (le jeu n'en sert qu'un à la fois) :<br/><strong id='o_attenteCopie'></strong>`,
      });
      afficher();
      // décompte affiché seulement : aucune requête
      attente = setInterval(afficher, 1000);
    }
    lignes
      .reduce(
        (suite, elt) =>
          suite.then(() => {
            let pret = MessagerieFzzz.rapportPret($(elt));
            return MessagerieFzzz.rapport($(elt))
              .then(
                (t) => textes.push(t),
                () => echecs++,
              )
              .then(() => {
                if (pret || !attente) return;
                restants--;
                fin = Date.now() + restants * MessagerieFzzz.dureeRapport;
                afficher();
              });
          }),
        Promise.resolve(),
      )
      .then(() => {
        MessagerieFzzz._copieEnCours = false;
        if (attente) {
          clearInterval(attente);
          $("#o_attenteCopie").closest(".jq-toast-single").remove();
        }
        if (!textes.length) {
          $.toast({ ...TOAST_ERROR, text: "Les rapports n'ont pas pu être chargés." });
          return;
        }
        CommerceFzzz.copier(
          textes.join("\n\n----------\n\n"),
          `${textes.length} rapport${textes.length > 1 ? "s" : ""} copié${textes.length > 1 ? "s" : ""} dans le presse-papier.` +
            (echecs ? ` ${echecs} n'ont pas pu être chargés.` : ""),
        );
      });
  }
  /**
   * Repli quand le navigateur refuse l'accès au presse-papier : le texte est
   * sélectionné dans une zone, prêt pour Ctrl+C.
   *
   * @private
   * @static
   */
  static _copieManuelle(texte) {
    $("#o_copieManuelle").remove();
    let $zone = $(
      `<div id='o_copieManuelle'><p>Copie bloquée par le navigateur : Ctrl+C (ou Cmd+C) puis Échap.</p><textarea rows='12'></textarea></div>`,
    ).appendTo("body");
    $zone.find("textarea").val(texte).trigger("focus").trigger("select");
    $zone.find("textarea").on("keydown", (e) => {
      if (e.key == "Escape") $zone.remove();
    });
    $zone.on("click", (e) => {
      if (e.target === $zone[0]) $zone.remove();
    });
  }
}

/**
 * Historique local des chasses analysées (par serveur) et graphe des pertes
 * par million de cm² chassés sur les 15 dernières.
 *
 * Chaque chasse ouverte dans la messagerie est mémorisée. Pour compléter
 * l'historique, un bouton charge, au clic du joueur, les rapports de chasse
 * listés dans la messagerie, comme le jeu le fait à l'ouverture d'une
 * conversation.
 *
 * @class HistoriqueChasses
 */
class HistoriqueChasses {
  static get NOMBRE() {
    return 15;
  }
  static get cle() {
    return `fzzz_historiqueChasses_${Utils.serveur}`;
  }
  /**
   * {chasses: {idMessage: {id, date, terrain, pertes}}, conversations: [ids lues]}
   */
  static charger() {
    let h = null;
    try {
      h = JSON.parse(localStorage.getItem(HistoriqueChasses.cle));
    } catch (e) {}
    return h && h.chasses ? h : { chasses: {}, conversations: [] };
  }
  static sauver(h) {
    // on garde les 60 chasses les plus récentes
    let ids = Object.keys(h.chasses)
      .map(Number)
      .sort((a, b) => b - a);
    ids.slice(60).forEach((id) => delete h.chasses[id]);
    h.conversations = h.conversations.slice(-200);
    try {
      localStorage.setItem(HistoriqueChasses.cle, JSON.stringify(h));
    } catch (e) {}
  }
  /**
   * Mémorise une chasse analysée ; `$message` est sa ligne tr[id^='message_'].
   */
  static enregistrer($message, chasse, h = null) {
    let id = parseInt(($message.attr("id") || "").replace(/\D/g, ""));
    if (!id || !chasse.terrain) return;
    let sauver = !h;
    h = h || HistoriqueChasses.charger();
    let date = $message
      .find(".expe")
      .text()
      .match(/(\d{2}\/\d{2}\/\d{2}) à (\d{2}h\d{2})/);
    h.chasses[id] = {
      id,
      date: date ? `${date[1].slice(0, 5)} ${date[2]}` : "",
      terrain: chasse.terrain,
      pertes: chasse.pertes,
    };
    if (sauver) HistoriqueChasses.sauver(h);
  }
  /**
   * Les N dernières chasses, de la plus ancienne à la plus récente.
   */
  static dernieres(h = HistoriqueChasses.charger()) {
    return Object.values(h.chasses)
      .filter((c) => c.terrain > 0)
      .sort((a, b) => a.id - b.id)
      .slice(-HistoriqueChasses.NOMBRE);
  }
  /**
   * Dessine le graphe et, s'il manque des chasses, le bouton pour compléter.
   */
  static afficher($bloc, idGraphe) {
    let chasses = HistoriqueChasses.dernieres(),
      $actions = $bloc.find(".o_grapheActions").empty();
    if (chasses.length < 2)
      $("#" + idGraphe).html(
        "<p class='small'>Il faut au moins deux chasses pour tracer l'évolution.</p>",
      );
    else HistoriqueChasses._dessiner(idGraphe, chasses);
    let aCharger = HistoriqueChasses._conversationsACharger();
    if (chasses.length < HistoriqueChasses.NOMBRE && aCharger.length)
      $(
        `<button type='button' class='o_button'>Charger les chasses précédentes (${chasses.length}/${HistoriqueChasses.NOMBRE})</button>`,
      )
        .appendTo($actions)
        .on("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          $(e.currentTarget).prop("disabled", true).text("Chargement…");
          HistoriqueChasses.completer(aCharger).then(() =>
            HistoriqueChasses.afficher($bloc, idGraphe),
          );
        });
  }
  /**
   * Conversations de chasse de la liste pas encore lues, des plus récentes aux plus anciennes.
   */
  static _conversationsACharger() {
    let lues = HistoriqueChasses.charger().conversations;
    return $("tr.en_tete_message[id^='conversation_']")
      .filter((i, elt) => {
        let c = MessagerieFzzz.categorie($(elt));
        return c && c.nom == "chasse";
      })
      .map((i, elt) => parseInt($(elt).attr("id").replace(/\D/g, "")))
      .get()
      .filter((id) => lues.indexOf(id) == -1)
      .sort((a, b) => b - a);
  }
  /**
   * Charge les conversations une par une jusqu'à avoir assez de chasses.
   */
  static completer(conversations) {
    let suite = Promise.resolve();
    conversations.forEach((idConv) => {
      suite = suite.then(() => {
        let h = HistoriqueChasses.charger();
        if (HistoriqueChasses.dernieres(h).length >= HistoriqueChasses.NOMBRE) return;
        return Promise.resolve(
          $.post(location.origin + "/messagerie.php", {
            traitement: "afficher",
            conversation: idConv,
          }),
        )
          .then((html) => {
            $("<table>")
              .html(html)
              .find("tr[id^='message_']")
              .each((i, elt) => {
                let chasse = new Chasse($(elt).find(".message").first().text());
                try {
                  if (chasse.analyse()) HistoriqueChasses.enregistrer($(elt), chasse, h);
                } catch (e) {}
              });
            h.conversations.push(idConv);
            HistoriqueChasses.sauver(h);
          })
          .catch(() => {});
      });
    });
    return suite;
  }
  /**
   * Courbe des pertes par million de cm² (Highcharts, fourni avec Toolzzz).
   */
  static _dessiner(idGraphe, chasses) {
    let ratio = (c) => Math.round((c.pertes * 1e6) / c.terrain),
      moyenne = Math.round(chasses.reduce((s, c) => s + ratio(c), 0) / chasses.length);
    Highcharts.chart(idGraphe, {
      chart: { type: "line", height: 260, backgroundColor: "transparent", spacing: [6, 6, 6, 6] },
      title: {
        text: `Pertes par M cm² chassés — ${chasses.length} dernières chasses`,
        style: { fontSize: "13px", fontWeight: "bold" },
      },
      credits: { enabled: false },
      legend: { enabled: false },
      xAxis: {
        categories: chasses.map((c, i) => c.date || "#" + (i + 1)),
        labels: { rotation: -45, style: { fontSize: "10px" } },
      },
      yAxis: {
        title: { text: "pertes / M cm²" },
        min: 0,
        plotLines: [
          {
            value: moyenne,
            color: "#7a6a3a",
            dashStyle: "Dash",
            width: 1,
            label: { text: `moyenne ${numeral(moyenne).format()}`, style: { fontSize: "10px" } },
          },
        ],
      },
      tooltip: {
        formatter: function () {
          let c = chasses[this.point.index];
          return `<b>${this.x}</b><br/>${numeral(this.y).format()} pertes / M cm²<br/>${numeral(c.terrain).format()} cm², ${numeral(c.pertes).format()} pertes`;
        },
      },
      series: [{ name: "Pertes / M cm²", color: "#9A5700", data: chasses.map(ratio) }],
    });
  }
}
