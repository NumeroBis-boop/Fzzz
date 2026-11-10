// @ts-check
/*
 * ChatGif.js
 * GIF du chat d'alliance : ceux que le joueur a envoyés, ceux de l'alliance.
 **********************************************************************/

// GIF envoyés par le joueur avec [img]…[/img], le plus récent en premier
const CLE_MES_GIF = "fzzz_mesGif";
const MES_GIF_MAX = 60;
// dernière lecture du sujet de l'alliance ; relu au clic au-delà d'une heure
const CLE_GIF_ALLIANCE = "fzzz_gifAlliance";
const DUREE_GIF_ALLIANCE = 3600000;
// adresse utilisable telle quelle dans [img]…[/img]
const ADRESSE_IMAGE = /^https?:\/\/[^\s[\]<>"'`]+$/i;

/**
 * Bouton « GIF » des chats d'alliance et général, deux listes : « Mes GIF »
 * (ceux que le joueur a envoyés avec la balise [img] du jeu, gardés dans son
 * navigateur) et « GIF de l'alliance » (premier message du sujet caché
 * TITRE_GIF_ALLIANCE, tenu à la main). Un clic écrit [img]adresse[/img] dans
 * le message, que le joueur envoie lui-même ; le jeu affiche l'image à tous,
 * avec ou sans l'extension.
 *
 * Requêtes : la lecture du sujet de l'alliance, au clic, au plus une fois par
 * heure (« Relire » pour forcer).
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
   * @private
   * @static
   * @return {any} dernière lecture du sujet pour cette alliance, ou null
   */
  static _lue() {
    try {
      let lue = JSON.parse(localStorage.getItem(CLE_GIF_ALLIANCE) || "null");
      return lue && lue.alliance == Utils.alliance && Array.isArray(lue.gifs) ? lue : null;
    } catch (e) {
      return null;
    }
  }
  /**
   * GIF de l'alliance : la dernière lecture si elle a moins d'une heure, sinon
   * le sujet du forum.
   *
   * @static
   * @method gifAlliance
   * @param {Boolean} [relire] lire le forum même avec une lecture récente
   * @return {Promise<{gifs: Array<String>, ignores: Number, absent?: Boolean, date: Number}>}
   */
  static gifAlliance(relire = false) {
    let lue = ChatGif._lue(),
      age = lue ? Horloge.maintenant() - lue.date : -1;
    if (lue && !relire && age >= 0 && age < DUREE_GIF_ALLIANCE) return Promise.resolve(lue);
    // « Relire » : sujet peut-être créé depuis la dernière liste des sujets
    return PartageChasses.sujets(!relire)
      .then((sujets) =>
        sujets.gifAlliance
          ? PartageChasses._xajax("callGetTopic", sujets.gifAlliance).then((data) =>
              ChatGif.lireListe(data),
            )
          : { gifs: [], ignores: 0, absent: true },
      )
      .then((r) => {
        let lecture = { ...r, date: Horloge.maintenant(), alliance: Utils.alliance };
        try {
          localStorage.setItem(CLE_GIF_ALLIANCE, JSON.stringify(lecture));
        } catch (e) {}
        return lecture;
      });
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
   * Bouton « GIF » sous le formulaire du chat d'alliance.
   *
   * @static
   * @method installer
   * @param {{mes: Boolean, alliance: Boolean}} sections listes cochées dans les Préférences
   */
  static installer(sections) {
    let $champ = $("#message"),
      $formulaire = $("#formulaireChat");
    if (!$champ.length || $("#o_gifBouton").length) return;
    // même bouton que « Envoyer » et « Actualiser » du jeu (maintainer request),
    // au bout de leur ligne : après les boutons de mise en forme, ceux du jeu
    // (Compte+ : images dans un span) ou le groupe de ceux de l'extension,
    // sinon à la fin du formulaire. Les images des couleurs du jeu
    // (#listeCouleur0, caché, en fin de formulaire) ne sont pas un repère.
    let $bouton = $(
        `<input type="button" id="o_gifBouton" value="GIF" aria-expanded="false" aria-controls="o_gifPanneau"/>`,
      ).addClass($("input[name='Envoyer']").attr("class") || ""),
      $panneau = $(`<div id="o_gifPanneau" hidden></div>`),
      $dernier = $formulaire.find("[onclick*='miseEnForme']").last(),
      $parent = $dernier.parent(),
      $ancre = $dernier.closest(".o_group_bouton_chat");
    if (!$ancre.length)
      $ancre =
        !$parent.is($formulaire) && $parent.children("[onclick*='miseEnForme']").length > 1
          ? $parent
          : $dernier;
    // ligne insécable du jeu : le bouton la suit, pour passer à la ligne sur
    // téléphone au lieu d'élargir la page
    let $ligne = $ancre.closest(".sur_une_ligne", $formulaire[0]);
    if ($ligne.length) $ancre = $ligne;
    if ($ancre.length) $bouton.insertAfter($ancre);
    else if ($formulaire.length) $bouton.appendTo($formulaire);
    else $bouton.insertAfter($champ);
    // espace avant : le navigateur peut passer à la ligne avant le bouton
    $bouton.before(document.createTextNode(" "));
    if ($formulaire.length) $panneau.appendTo($formulaire);
    else $panneau.insertAfter($bouton);
    $bouton.on("click", (e) => {
      // pas de mise en forme si le bouton est tombé dans un élément cliquable du jeu
      e.preventDefault();
      e.stopPropagation();
      ChatGif.basculer(sections);
    });
    if (!sections.mes) return;
    // lu avant l'envoi par le jeu, comme la couleur du texte (PageChat.parserMessage)
    let noter = () => ChatGif.noterEnvoi(String($champ.val() || ""));
    $champ.on("keypress.o_gif", (e) => {
      if ((e.keyCode || e.which) == 13) noter();
    });
    $("input[name='Envoyer']").on("click.o_gif", noter);
  }
  /**
   * @static
   * @method basculer
   * @param {{mes: Boolean, alliance: Boolean}} sections
   */
  static basculer(sections) {
    let $panneau = $("#o_gifPanneau"),
      ouvrir = $panneau.prop("hidden");
    $panneau.prop("hidden", !ouvrir);
    $("#o_gifBouton").attr("aria-expanded", String(ouvrir));
    if (ouvrir) ChatGif.dessiner(sections);
  }
  /**
   * @static
   * @method dessiner
   * @param {{mes: Boolean, alliance: Boolean}} sections
   */
  static dessiner(sections) {
    let $panneau = $("#o_gifPanneau").empty();
    if (sections.mes) {
      let $section = $(
        `<div class="o_gifSection o_gifMes"><p class="o_gifTitre gras">Mes GIF</p></div>`,
      ).appendTo($panneau);
      ChatGif._montrerMes($section);
    }
    if (sections.alliance) {
      let $section = $(`<div class="o_gifSection">
          <p class="o_gifTitre gras">GIF de l'alliance <button type="button" class="o_gifRelire reduce">Relire</button></p>
          <div class="o_gifAlliance"></div>
        </div>`).appendTo($panneau);
      $section.find(".o_gifRelire").on("click", (e) => {
        e.preventDefault();
        ChatGif.afficherAlliance(true);
      });
      ChatGif.afficherAlliance(false);
    }
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
   * @static
   * @method choisir
   * @param {String} adresse
   */
  static choisir(adresse) {
    let champ = /** @type {HTMLInputElement} */ ($("#message")[0]);
    if (!champ) return;
    if (!ChatGif.inserer(champ, adresse)) {
      $.toast({
        ...TOAST_WARNING,
        text: `Message trop long pour y ajouter ce GIF (${numeral(champ.maxLength).format()} caractères au plus).`,
      });
      return;
    }
    $("#o_gifPanneau").prop("hidden", true);
    $("#o_gifBouton").attr("aria-expanded", "false");
  }
  /**
   * @static
   * @method afficherAlliance
   * @param {Boolean} relire
   */
  static afficherAlliance(relire) {
    let $zone = $("#o_gifPanneau .o_gifAlliance");
    $zone.html(`<p class="reduce o_gifNote">Lecture du forum…</p>`);
    return ChatGif.gifAlliance(relire).then(
      (r) => ChatGif._montrerAlliance($zone, r),
      (e) => {
        let absente = e && e.message == "absente",
          lue = ChatGif._lue();
        if (typeof Journal != "undefined")
          Journal.erreur("GIF", "sujet des GIF de l'alliance illisible", e && e.message);
        $zone.empty();
        if (lue) ChatGif._montrerAlliance($zone, lue);
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
   */
  static _montrerAlliance($zone, r) {
    $zone.empty();
    if (r.absent) {
      $zone.append(
        `<p class="reduce o_gifNote">Pas de sujet « ${TITRE_GIF_ALLIANCE} » dans la section « ${FORUM_SECTIONS_CHASSES[0]} » du forum. Crée-le et mets les adresses des GIF dans son premier message (n'y réponds pas : le premier message ne serait plus modifiable).</p>`,
      );
      return;
    }
    if (r.gifs.length) $zone.append(ChatGif.grille(r.gifs));
    else
      $zone.append(
        `<p class="reduce o_gifNote">Aucune adresse d'image dans le premier message du sujet « ${TITRE_GIF_ALLIANCE} ».</p>`,
      );
    if (r.ignores)
      $zone.append(
        `<p class="reduce o_gifNote">${numeral(r.ignores).format()} lien${r.ignores > 1 ? "s" : ""} du sujet ne mène${r.ignores > 1 ? "nt" : ""} pas à une image : l'adresse doit finir par .gif, .webp, .png ou .jpg (clic droit sur le GIF, « Copier l'adresse de l'image »).</p>`,
      );
  }
}
