// @ts-check
/*
 * ChatGif.js
 * GIF du chat d'alliance : ceux que le joueur a envoyés, ceux de l'alliance.
 **********************************************************************/

// GIF envoyés par le joueur avec [img]…[/img], le plus récent en premier
const CLE_MES_GIF = "fzzz_mesGif";
const MES_GIF_MAX = 60;
// dernières lectures des sujets de l'alliance, montrées quand le forum ne répond pas
const CLE_GIF_ALLIANCE = "fzzz_gifAlliance";
const CLE_SMILEYS_ALLIANCE = "fzzz_smileysAlliance";
// listes du panneau repliées par le joueur : {mes: true, alliance: true}
const CLE_GIF_REPLIEES = "fzzz_gifRepliees";
// adresse utilisable telle quelle dans [img]…[/img]
const ADRESSE_IMAGE = /^https?:\/\/[^\s[\]<>"'`]+$/i;

/**
 * Bouton « GIF » des chats d'alliance et général, deux listes : « Mes GIF »
 * (ceux que le joueur a envoyés avec la balise [img] du jeu, gardés dans son
 * navigateur) et « GIF de l'alliance » (premier message du sujet caché
 * TITRE_GIF_ALLIANCE, tenu à la main) ; à côté, le bouton « Smileys » et les
 * images du sujet TITRE_SMILEYS_ALLIANCE. Un clic écrit [img]adresse[/img]
 * dans le message, que le joueur envoie lui-même ; le jeu affiche l'image à
 * tous, avec ou sans l'extension.
 *
 * Requêtes : les sujets de l'alliance sont lus à l'ouverture de la page (une
 * lecture chacun et une de la liste des sujets, permises par les règles s5 :
 * rien de périodique), et de nouveau à l'ouverture du panneau si elle a échoué.
 *
 * @class ChatGif
 */
class ChatGif {
  /**
   * Adresses des images d'un message, balises [img] en majuscules comprises.
   *
   * @static
   * @method adresses
   * @param {String} message
   * @return {Array<String>}
   */
  static adresses(message) {
    return [...String(message || "").matchAll(/\[img\]\s*(.*?)\s*\[\/img\]/gi)]
      .map((m) => m[1])
      .filter((a) => ADRESSE_IMAGE.test(a));
  }
  /**
   * @private
   * @static
   * @param {String} adresse
   * @return {URL|null}
   */
  static _url(adresse) {
    if (!ADRESSE_IMAGE.test(adresse)) return null;
    try {
      return new URL(adresse);
    } catch (e) {
      return null;
    }
  }
  /**
   * @static
   * @method extension
   * @param {String} adresse
   * @return {String} extension du fichier, en minuscules ("" sans)
   */
  static extension(adresse) {
    let url = ChatGif._url(adresse),
      m = url && /\.([a-z0-9]+)$/i.exec(url.pathname);
    return m ? m[1].toLowerCase() : "";
  }
  /**
   * @static
   * @method estGif
   * @param {String} adresse
   * @return {Boolean} GIF ou WebP (animé chez Giphy)
   */
  static estGif(adresse) {
    return ["gif", "webp"].includes(ChatGif.extension(adresse));
  }
  /**
   * @static
   * @method estImage
   * @param {String} adresse
   * @return {Boolean}
   */
  static estImage(adresse) {
    return ["gif", "webp", "png", "jpg", "jpeg"].includes(ChatGif.extension(adresse));
  }
  /**
   * « Mes GIF », le plus récent en premier.
   *
   * @static
   * @method mesGif
   * @return {Array<String>}
   */
  static mesGif() {
    try {
      let liste = JSON.parse(localStorage.getItem(CLE_MES_GIF) || "[]");
      return Array.isArray(liste)
        ? liste.filter((a) => typeof a == "string" && ChatGif.estGif(a))
        : [];
    } catch (e) {
      return [];
    }
  }
  /**
   * @private
   * @static
   * @param {Array<String>} liste
   */
  static _garder(liste) {
    try {
      localStorage.setItem(CLE_MES_GIF, JSON.stringify(liste.slice(0, MES_GIF_MAX)));
    } catch (e) {}
  }
  /**
   * GIF d'un message envoyé : en tête de « Mes GIF », sans doublon.
   *
   * @static
   * @method noterEnvoi
   * @param {String} message
   */
  static noterEnvoi(message) {
    let nouveaux = ChatGif.adresses(message).filter((a) => ChatGif.estGif(a));
    if (nouveaux.length) ChatGif._garder([...new Set([...nouveaux, ...ChatGif.mesGif()])]);
  }
  /**
   * @static
   * @method retirer
   * @param {String} adresse
   */
  static retirer(adresse) {
    ChatGif._garder(ChatGif.mesGif().filter((a) => a != adresse));
  }
  /**
   * Images du premier message du sujet de l'alliance (les réponses ne comptent
   * pas) : images affichées, liens et adresses écrites en texte.
   *
   * @static
   * @method lireListe
   * @param {String} data réponse du forum
   * @return {{gifs: Array<String>, ignores: Number}} ignores : liens qui ne sont pas des images
   */
  static lireListe(data) {
    let $div = Utils.parseHtml(PartageChasses._html(data)),
      $premier = $div.find(".messageForum").first(),
      $message = ($premier.length ? $premier : $div).clone(),
      vues = [
        ...$message
          .find("img[src]")
          .get()
          .map((/** @type {Element} */ e) => e.getAttribute("src")),
        ...$message
          .find("a[href]")
          .get()
          .map((/** @type {Element} */ e) => e.getAttribute("href")),
      ];
    // le texte d'un lien peut être l'adresse raccourcie : seul son href compte
    $message.find("a").remove();
    $message.find("br").replaceWith("\n");
    vues.push(
      ...($message.text().match(/https?:\/\/[^\s[\]<>"'`]+/gi) || []).map((a) =>
        a.replace(/[.,;:!?)]+$/, ""),
      ),
    );
    let adresses = [
        ...new Set(vues.map((a) => String(a || "").trim()).filter((a) => /^https?:\/\//i.test(a))),
      ],
      // smileys et pages du jeu dans le message : ni GIF de la liste, ni lien à signaler
      horsJeu = adresses.filter((a) => {
        let url = ChatGif._url(a);
        return !url || !/(^|\.)fourmizzz\.fr$/i.test(url.hostname);
      }),
      gifs = horsJeu.filter((a) => ChatGif.estImage(a));
    return { gifs, ignores: horsJeu.length - gifs.length };
  }
  /**
   * Liste de l'alliance « gif » ou « smileys » : son panneau, son sujet du
   * forum et ses textes.
   *
   * @private
   * @static
   * @param {String} type "gif" ou "smileys"
   */
  static _liste(type) {
    return type == "smileys"
      ? {
          panneau: "#o_smileysPanneau",
          bouton: "#o_smileysBouton",
          zone: ".o_smileysAlliance",
          sujet: "smileysAlliance",
          titre: TITRE_SMILEYS_ALLIANCE,
          cle: CLE_SMILEYS_ALLIANCE,
          nom: "smileys",
          image: "le smiley",
          ce: "ce smiley",
        }
      : {
          panneau: "#o_gifPanneau",
          bouton: "#o_gifBouton",
          zone: ".o_gifAlliance",
          sujet: "gifAlliance",
          titre: TITRE_GIF_ALLIANCE,
          cle: CLE_GIF_ALLIANCE,
          nom: "GIF",
          image: "le GIF",
          ce: "ce GIF",
        };
  }
  /**
   * @private
   * @static
   * @param {String} [type] "gif" ou "smileys"
   * @return {any} dernière lecture du sujet pour cette alliance, ou null
   */
  static _lue(type = "gif") {
    try {
      let lue = JSON.parse(localStorage.getItem(ChatGif._liste(type).cle) || "null");
      return lue && lue.alliance == Utils.alliance && Array.isArray(lue.gifs) ? lue : null;
    } catch (e) {
      return null;
    }
  }
  /**
   * Images d'une liste de l'alliance lues dans son sujet du forum ; la lecture
   * est gardée pour le cas où le forum ne répond pas.
   *
   * @static
   * @method lireAlliance
   * @param {String} type "gif" ou "smileys"
   * @param {Boolean} [listeRecente] liste des sujets lue il y a moins d'une
   *   minute acceptée ; sinon relue (le sujet a pu être créé depuis)
   * @return {Promise<{gifs: Array<String>, ignores: Number, absent?: Boolean, date: Number}>}
   */
  static lireAlliance(type, listeRecente = false) {
    let liste = ChatGif._liste(type);
    return PartageChasses.sujets(listeRecente)
      .then((sujets) =>
        sujets[liste.sujet]
          ? PartageChasses._xajax("callGetTopic", sujets[liste.sujet]).then((data) =>
              ChatGif.lireListe(data),
            )
          : { gifs: [], ignores: 0, absent: true },
      )
      .then((r) => {
        let lecture = { ...r, date: Horloge.maintenant(), alliance: Utils.alliance };
        try {
          localStorage.setItem(liste.cle, JSON.stringify(lecture));
        } catch (e) {}
        return lecture;
      });
  }
  /**
   * @static
   * @method gifAlliance
   * @return {Promise<{gifs: Array<String>, ignores: Number, absent?: Boolean, date: Number}>}
   */
  static gifAlliance() {
    return ChatGif.lireAlliance("gif");
  }
  /**
   * Lecture d'une liste de l'alliance pour cette page : celle lancée à son
   * ouverture, sinon (échec) une nouvelle.
   *
   * @private
   * @static
   * @param {String} [type] "gif" ou "smileys"
   * @param {Promise<any>|null} [apres] lecture des GIF de la page : la liste des
   *   sujets qu'elle vient de lire sert aussi aux smileys
   * @return {Promise<any>}
   */
  static _lecture(type = "gif", apres = null) {
    let $panneau = $(ChatGif._liste(type).panneau),
      lecture = $panneau.data("o_lecture");
    if (lecture) return lecture;
    lecture = apres
      ? apres.then(
          () => ChatGif.lireAlliance(type, true),
          () => ChatGif.lireAlliance(type),
        )
      : ChatGif.lireAlliance(type);
    $panneau.data("o_lecture", lecture);
    // l'erreur est montrée à l'ouverture du panneau, qui relira
    lecture.catch(() => {
      if ($panneau.data("o_lecture") === lecture) $panneau.removeData("o_lecture");
    });
    return lecture;
  }
  /**
   * Écrit [img]adresse[/img] à la place du curseur, séparé du texte voisin.
   *
   * @static
   * @method inserer
   * @param {HTMLInputElement|HTMLTextAreaElement} champ
   * @param {String} adresse
   * @return {Boolean} faux si le message dépasserait la longueur permise
   */
  static inserer(champ, adresse) {
    let valeur = champ.value,
      debut = champ.selectionStart ?? valeur.length,
      fin = champ.selectionEnd ?? valeur.length,
      avant = valeur.slice(0, debut),
      apres = valeur.slice(fin),
      ajout =
        (avant && !/\s$/.test(avant) ? " " : "") +
        `[img]${adresse}[/img]` +
        (apres && !/^\s/.test(apres) ? " " : ""),
      nouveau = avant + ajout + apres;
    if (champ.maxLength > 0 && nouveau.length > champ.maxLength) return false;
    champ.value = nouveau;
    champ.focus();
    champ.setSelectionRange((avant + ajout).length, (avant + ajout).length);
    return true;
  }
  /**
   * Boutons « GIF » et « Smileys » au bout de la ligne d'« Envoyer » du chat,
   * leurs panneaux sous le formulaire.
   *
   * @static
   * @method installer
   * @param {{mes: Boolean, alliance: Boolean, smileys?: Boolean}} sections listes cochées dans les Préférences
   */
  static installer(sections) {
    let $champ = $("#message"),
      $formulaire = $("#formulaireChat");
    if (!$champ.length || $("#o_gifBouton, #o_smileysBouton").length) return;
    let $ancre = ChatGif._ancre($formulaire),
      // même bouton que « Envoyer » et « Actualiser » du jeu (maintainer request)
      classe = $("input[name='Envoyer']").attr("class") || "",
      ajouter = (
        /** @type {String} */ id,
        /** @type {String} */ libelle,
        /** @type {String} */ panneau,
      ) => {
        let $bouton = $(
            `<input type="button" id="${id}" aria-expanded="false" aria-controls="${panneau}"/>`,
          )
            .attr("value", libelle)
            .addClass(classe),
          $panneau = $(`<div id="${panneau}" hidden></div>`);
        if ($ancre.length) $bouton.insertAfter($ancre);
        else if ($formulaire.length) $bouton.appendTo($formulaire);
        else $bouton.insertAfter($champ);
        // espace avant : le navigateur peut passer à la ligne avant le bouton
        $bouton.before(document.createTextNode(" "));
        $ancre = $bouton;
        if ($formulaire.length) $panneau.appendTo($formulaire);
        else $panneau.insertAfter($bouton);
        // pas de mise en forme si le bouton est tombé dans un élément cliquable du jeu
        return $bouton.on("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
      },
      lectureGif = null;
    if (sections.mes || sections.alliance) {
      ajouter("o_gifBouton", "GIF", "o_gifPanneau").on("click", () => ChatGif.basculer(sections));
      // lu dès l'ouverture de la page : la liste est à jour au premier clic
      if (sections.alliance) lectureGif = ChatGif._lecture();
    }
    if (sections.smileys) {
      ajouter("o_smileysBouton", `Smileys ${Utils.alliance}`.trim(), "o_smileysPanneau").on(
        "click",
        () => ChatGif.basculerSmileys(),
      );
      ChatGif._lecture("smileys", lectureGif);
    }
    if (!sections.mes) return;
    // lu avant l'envoi par le jeu, comme la couleur du texte (PageChat.parserMessage)
    let noter = () => ChatGif.noterEnvoi(String($champ.val() || ""));
    $champ.on("keypress.o_gif", (e) => {
      if ((e.keyCode || e.which) == 13) noter();
    });
    $("input[name='Envoyer']").on("click.o_gif", noter);
  }
  /**
   * Place des boutons : au bout de la ligne d'« Envoyer », après les boutons
   * de mise en forme, ceux du jeu (Compte+ : images dans un span) ou le groupe
   * de ceux de l'extension. Les images des couleurs du jeu (#listeCouleur0,
   * caché, en fin de formulaire) ne sont pas un repère.
   *
   * @private
   * @static
   * @param {any} $formulaire
   * @return {any} jQuery ; vide : à la fin du formulaire
   */
  static _ancre($formulaire) {
    let $dernier = $formulaire.find("[onclick*='miseEnForme']").last(),
      $parent = $dernier.parent(),
      $ancre = $dernier.closest(".o_group_bouton_chat");
    if (!$ancre.length)
      $ancre =
        !$parent.is($formulaire) && $parent.children("[onclick*='miseEnForme']").length > 1
          ? $parent
          : $dernier;
    // ligne insécable du jeu : les boutons la suivent, pour passer à la ligne
    // sur téléphone au lieu d'élargir la page
    let $ligne = $ancre.closest(".sur_une_ligne", $formulaire[0]);
    return $ligne.length ? $ligne : $ancre;
  }
  /**
   * @private
   * @static
   * @param {String} panneau
   * @param {String} bouton
   */
  static _fermer(panneau, bouton) {
    $(panneau).prop("hidden", true);
    $(bouton).attr("aria-expanded", "false");
  }
  /**
   * @static
   * @method basculer
   * @param {{mes: Boolean, alliance: Boolean}} sections
   */
  static basculer(sections) {
    let $panneau = $("#o_gifPanneau"),
      ouvrir = $panneau.prop("hidden");
    if (ouvrir) ChatGif._fermer("#o_smileysPanneau", "#o_smileysBouton");
    $panneau.prop("hidden", !ouvrir);
    $("#o_gifBouton").attr("aria-expanded", String(ouvrir));
    if (ouvrir) ChatGif.dessiner(sections);
  }
  /**
   * Panneau des smileys de l'alliance ; celui des GIF se ferme.
   *
   * @static
   * @method basculerSmileys
   */
  static basculerSmileys() {
    let $panneau = $("#o_smileysPanneau"),
      ouvrir = $panneau.prop("hidden");
    if (ouvrir) ChatGif._fermer("#o_gifPanneau", "#o_gifBouton");
    $panneau.prop("hidden", !ouvrir);
    $("#o_smileysBouton").attr("aria-expanded", String(ouvrir));
    if (!ouvrir) return;
    $panneau.html(`<div class="o_smileysAlliance"></div>`);
    ChatGif.afficherAlliance("smileys");
  }
  /**
   * @static
   * @method dessiner
   * @param {{mes: Boolean, alliance: Boolean}} sections
   */
  static dessiner(sections) {
    let $panneau = $("#o_gifPanneau").empty();
    if (sections.mes)
      ChatGif._montrerMes(
        ChatGif._section("mes", "Mes GIF").addClass("o_gifMes").appendTo($panneau),
      );
    if (sections.alliance) {
      ChatGif._section("alliance", "GIF de l'alliance")
        .append(`<div class="o_gifAlliance"></div>`)
        .appendTo($panneau);
      ChatGif.afficherAlliance();
    }
  }
  /**
   * Liste dépliable du panneau (titre cliquable), repliée si le joueur l'a
   * laissée repliée.
   *
   * @private
   * @static
   * @param {String} cle "mes" ou "alliance"
   * @param {String} titre
   * @return {any} jQuery
   */
  static _section(cle, titre) {
    let $section = $(
      `<details class="o_gifSection"><summary class="o_gifTitre gras"></summary></details>`,
    );
    $section.find("summary").text(titre);
    $section.prop("open", !Utils.lireStockage(CLE_GIF_REPLIEES)[cle]);
    $section.on("toggle", () => {
      let repliees = Utils.lireStockage(CLE_GIF_REPLIEES);
      repliees[cle] = !$section.prop("open");
      try {
        localStorage.setItem(CLE_GIF_REPLIEES, JSON.stringify(repliees));
      } catch (e) {}
    });
    return $section;
  }
  /**
   * @private
   * @static
   * @param {any} $section
   */
  static _montrerMes($section) {
    $section.find(".o_gifGrille, .o_gifNote").remove();
    let liste = ChatGif.mesGif();
    if (!liste.length) {
      $section.append(
        `<p class="reduce o_gifNote">Les GIF que tu envoies avec [img]adresse du GIF[/img] s'ajoutent ici.</p>`,
      );
      return;
    }
    $section.append(
      ChatGif.grille(liste, (adresse) => {
        ChatGif.retirer(adresse);
        ChatGif._montrerMes($section);
      }),
    );
  }
  /**
   * Vignettes cliquables ; avec `retirer`, une croix sur chacune.
   *
   * @static
   * @method grille
   * @param {Array<String>} adresses
   * @param {(adresse: String) => void} [retirer]
   * @return {any} jQuery
   */
  static grille(adresses, retirer) {
    let $grille = $(`<div class="o_gifGrille"></div>`);
    adresses.forEach((adresse, i) => {
      let $case = $(`<span class="o_gifCase">
          <button type="button" class="o_gifChoix" title="Mettre ce GIF dans le message"><img loading="lazy" alt=""/></button>
        </span>`);
      $case.find("img").attr({ src: adresse, alt: `GIF ${i + 1}` });
      $case.find(".o_gifChoix").on("click", (e) => {
        e.preventDefault();
        ChatGif.choisir(adresse);
      });
      if (retirer)
        $(
          `<button type="button" class="o_gifRetirer" title="Retirer de Mes GIF" aria-label="Retirer de Mes GIF">×</button>`,
        )
          .on("click", (e) => {
            e.preventDefault();
            retirer(adresse);
          })
          .appendTo($case);
      $grille.append($case);
    });
    return $grille;
  }
  /**
   * Petites icônes des smileys de l'alliance.
   *
   * @static
   * @method grilleSmileys
   * @param {Array<String>} adresses
   * @return {any} jQuery
   */
  static grilleSmileys(adresses) {
    let $grille = $(`<div class="o_smileysGrille"></div>`);
    adresses.forEach((adresse, i) => {
      let $choix = $(
        `<button type="button" class="o_smileyChoix" title="Mettre ce smiley dans le message"><img loading="lazy" alt=""/></button>`,
      );
      $choix.find("img").attr({ src: adresse, alt: `Smiley ${i + 1}` });
      $choix.on("click", (e) => {
        e.preventDefault();
        ChatGif.choisir(adresse, "smileys");
      });
      $grille.append($choix);
    });
    return $grille;
  }
  /**
   * Image mise dans le message, puis son panneau se ferme.
   *
   * @static
   * @method choisir
   * @param {String} adresse
   * @param {String} [type] "gif" ou "smileys"
   */
  static choisir(adresse, type = "gif") {
    let champ = /** @type {HTMLInputElement} */ ($("#message")[0]),
      liste = ChatGif._liste(type);
    if (!champ) return;
    if (!ChatGif.inserer(champ, adresse)) {
      $.toast({
        ...TOAST_WARNING,
        text: `Message trop long pour y ajouter ${liste.ce} (${numeral(champ.maxLength).format()} caractères au plus).`,
      });
      return;
    }
    ChatGif._fermer(liste.panneau, liste.bouton);
  }
  /**
   * @static
   * @method afficherAlliance
   * @param {String} [type] "gif" ou "smileys"
   */
  static afficherAlliance(type = "gif") {
    let liste = ChatGif._liste(type),
      $zone = $(`${liste.panneau} ${liste.zone}`);
    $zone.html(`<p class="reduce o_gifNote">Lecture du forum…</p>`);
    return ChatGif._lecture(type).then(
      (r) => ChatGif._montrerAlliance($zone, r, type),
      (e) => {
        let absente = e && e.message == "absente",
          lue = ChatGif._lue(type);
        if (typeof Journal != "undefined")
          Journal.erreur(
            type == "smileys" ? "Smileys" : "GIF",
            `sujet des ${liste.nom} de l'alliance illisible`,
            e && e.message,
          );
        $zone.empty();
        if (lue) ChatGif._montrerAlliance($zone, lue, type);
        $zone.prepend(
          `<p class="reduce red o_gifNote">${absente ? SECTION_INTROUVABLE : `Forum de l'alliance illisible${lue ? " : dernière lecture affichée" : ""}.`}</p>`,
        );
      },
    );
  }
  /**
   * @private
   * @static
   * @param {any} $zone
   * @param {{gifs: Array<String>, ignores: Number, absent?: Boolean}} r
   * @param {String} [type] "gif" ou "smileys"
   */
  static _montrerAlliance($zone, r, type = "gif") {
    let liste = ChatGif._liste(type);
    $zone.empty();
    if (r.absent) {
      $zone.append(
        `<p class="reduce o_gifNote">Pas de sujet « ${liste.titre} » dans la section « ${FORUM_SECTIONS_CHASSES[0]} » du forum. Crée-le et mets les adresses des ${liste.nom} dans son premier message (n'y réponds pas : le premier message ne serait plus modifiable).</p>`,
      );
      return;
    }
    if (r.gifs.length)
      $zone.append(type == "smileys" ? ChatGif.grilleSmileys(r.gifs) : ChatGif.grille(r.gifs));
    else
      $zone.append(
        `<p class="reduce o_gifNote">Aucune adresse d'image dans le premier message du sujet « ${liste.titre} ».</p>`,
      );
    if (r.ignores)
      $zone.append(
        `<p class="reduce o_gifNote">${numeral(r.ignores).format()} lien${r.ignores > 1 ? "s" : ""} du sujet ne mène${r.ignores > 1 ? "nt" : ""} pas à une image : l'adresse doit finir par .gif, .webp, .png ou .jpg (clic droit sur ${liste.image}, « Copier l'adresse de l'image »).</p>`,
      );
  }
}
