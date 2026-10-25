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
 * - titres des convois en violet clair, des conversations entre joueurs en blanc
 *   (les pertes de TdC restent en rouge, via PageMessagerie.couleurMessage) ;
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
          c = MessagerieFzzz.categorie($ligne);
        if (c && c.nom == "convoi") $ligne.find(".intitule_message").addClass("o_titreConvoi");
        if (c && c.nom == "conversation")
          $ligne.find(".intitule_message").addClass("o_titreConversation");
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
  static observer() {
    let cible = document.getElementById("corps_messagerie") || document.body,
      attente = null;
    new MutationObserver(() => {
      clearTimeout(attente);
      attente = setTimeout(MessagerieFzzz.decorer, 50);
    }).observe(cible, { childList: true, subtree: true });
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
