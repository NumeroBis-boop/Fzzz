/*
 * MessagerieFzzz.js
 * Fzzz
 **********************************************************************/

/**
 * Catégories des messages et dossier du jeu qui les reçoit. `type` est la
 * valeur de data-type des lignes déjà rangées dans ce dossier.
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
    nom: "chasse",
    dossier: "Chasse",
    type: "Chasses",
    systeme: true,
    titre: /chasse|chasseuses/i,
  },
  {
    nom: "combat",
    dossier: "Combat",
    type: "Combats",
    systeme: true,
    titre:
      /vol par|butin chez|invasion|attaque (réussie|échouée)|colonie|rebellion|conquis par|défense/i,
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
   * Catégorie d'une ligne de conversation, ou null.
   *
   * @static
   * @method categorie
   */
  static categorie($ligne) {
    let titre = $ligne.find(".intitule_message").text(),
      participants = $ligne.find(".td_participants").text().trim(),
      systeme = /^fourmizzz$/i.test(participants);
    if (!systeme) return $ligne.data("type") == "Alliance" ? null : CATEGORIES_MESSAGES[3];
    return CATEGORIES_MESSAGES.find((c) => c.systeme && c.titre.test(titre)) || null;
  }
  /**
   * Couleurs et bouton de copie sur les lignes pas encore traitées.
   *
   * @static
   * @method decorer
   */
  static decorer() {
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
        if (classe) $titre.addClass(classe);
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
  static _bloc(id, libelle, contenu) {
    let $bloc = $(`<div id='${id}' class='o_analyseRapport'>
        <button type='button' class='o_button f_info o_analyseBouton'>${libelle}</button>
        <div class='o_analyseContenu' style='display:none'>${contenu}</div>
      </div>`);
    $bloc.find(".o_analyseBouton").on("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      $bloc.find(".o_analyseContenu").toggle();
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
        choix +
        vues
          .map(
            (v, k) =>
              `<div class='o_analyseVue'${k == vues.length - 1 ? "" : " style='display:none'"}>${v}</div>`,
          )
          .join(""),
      $bloc = MessagerieFzzz._bloc(
        "o_analyseChasses_" + conv,
        n > 1 ? `Analyser les ${n} chasses` : "Analyser la chasse",
        contenu,
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
   * Copie le rapport complet d'une conversation. Si elle est ouverte, on lit la
   * page ; sinon on la charge comme le jeu le fait à l'ouverture.
   *
   * @static
   * @method copier
   */
  static copier($ligne) {
    let id = $ligne.attr("id").match(/\d+/)[0],
      ouverts = $ligne.nextUntil("tr.en_tete_message").find("tr[id^='message_']");
    let charger = ouverts.length
      ? Promise.resolve(ouverts)
      : Promise.resolve(
          $.post(location.origin + "/messagerie.php", { traitement: "afficher", conversation: id }),
        ).then((html) => $("<table>").html(html).find("tr[id^='message_']"));
    charger
      .then(($messages) => {
        if (!$messages.length) throw new Error("vide");
        let texte = MessagerieFzzz.texte($ligne, $messages),
          ecrire =
            navigator.clipboard && navigator.clipboard.writeText
              ? navigator.clipboard.writeText(texte)
              : Promise.reject(new Error("presse-papier indisponible"));
        return ecrire.then(
          () => $.toast({ ...TOAST_SUCCESS, text: "Rapport copié dans le presse-papier." }),
          () => MessagerieFzzz._copieManuelle(texte),
        );
      })
      .catch(() =>
        $.toast({ ...TOAST_ERROR, text: "Le rapport n'a pas pu être chargé, la copie a échoué." }),
      );
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
