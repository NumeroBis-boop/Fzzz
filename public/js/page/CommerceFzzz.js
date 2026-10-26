/*
 * CommerceFzzz.js
 * NumeroBis-boop
 **********************************************************************/

/**
 * Ajouts Fzzz à la page /commerce.php : lecture des convois en cours, et
 * devant chacun son état sur le site de suivi de la OUAF. Rien n'est envoyé
 * au jeu. `texte` et `copier` servent aussi aux autres pages.
 *
 * @class CommerceFzzz
 */
class CommerceFzzz {
  /**
   * Lignes des convois en cours : les <strong> qui suivent le titre
   * « Convois en cours: » et commencent par « - ».
   *
   * @static
   * @method lignes
   */
  static lignes() {
    let $titre = $("#centre > h3").filter((i, e) => $(e).text().includes("Convois en cours"));
    if (!$titre.length) return $();
    return $titre
      .first()
      .nextUntil("h3")
      .filter("strong")
      .filter((i, e) => /^\s*-/.test($(e).text()) && $(e).text().includes("dans"));
  }
  /**
   * Devant chaque convoi envoyé, son état sur le site de suivi de la OUAF :
   * « ✅ Enregistré », ou un bouton « 📤 Envoyer au suivi ». À l'ouverture de
   * la page, l'historique du site est lu (si le mot de passe est enregistré
   * et l'accès accordé) pour savoir ce qui est déjà noté. Le mot de passe se
   * renseigne seulement dans Paramètres → Convoi.
   *
   * @static
   * @method suiviOuaf
   */
  static suiviOuaf() {
    if (!Utils.affichage("convoisSuiviLignes") || $(".o_ouafLigne").length) return;
    let convois = OuafSuivi.convoisJeu();
    if (!convois.length) return;
    let toast = (texte, type = TOAST_INFO) => $.toast({ ...type, text: texte, hideAfter: 8000 }),
      // état affiché devant un convoi : enregistré, ou bouton d'envoi
      etatLigne = (c, statut, detail = "") => {
        let $l = $(c.elt).find(".o_ouafLigne");
        if (!$l.length) {
          $l = $(
            `<span class='o_ouafLigne'><span class='o_ouafOui'>✅ Enregistré</span><button type='button' class='o_button o_ouafEnvoyer'>📤 Envoyer au suivi</button></span>`,
          );
          // entre le « - » du jeu et « Vous allez livrer… »
          let noeud = c.elt.firstChild,
            tiret = noeud && noeud.nodeType == Node.TEXT_NODE ? noeud.data.match(/^\s*-\s*/) : null;
          if (tiret) $l.insertBefore(noeud.splitText(tiret[0].length));
          else $(c.elt).prepend($l);
          $l.find(".o_ouafEnvoyer").on("click", (e) => {
            e.preventDefault();
            envoyer(c);
          });
        }
        let fait = statut == "transmis" || statut == "envoye",
          titres = {
            verif: "Vérification sur le site de suivi…",
            envoi: "Envoi au site de suivi…",
            non: "Pas encore noté sur le site de suivi",
            introuvable: "Destinataire introuvable sur le site de suivi",
            erreur: "Le dernier envoi a échoué",
          };
        $l.find(".o_ouafOui")
          .toggle(fait)
          .attr("title", fait ? detail || "Noté sur le site de suivi" : "");
        $l.find(".o_ouafEnvoyer")
          .toggle(!fait)
          .prop("disabled", statut == "verif" || statut == "envoi")
          .attr("title", [titres[statut], detail].filter(Boolean).join(" : "));
      },
      echec = (e) => {
        if (e.name == "permission") {
          toast(
            "Fzzz n'a pas encore accès à ouafchaine.fr. <button type='button' id='o_ouafAcces' class='o_button f_info'>Autoriser l'accès</button> puis relance l'envoi.",
            TOAST_WARNING,
          );
          $(document)
            .off("click.ouafAcces")
            .on("click.ouafAcces", "#o_ouafAcces", () => OuafSuivi.demanderAcces());
        } else if (e.name == "code") CommerceFzzz.ouvrirParametresOuaf();
        else
          toast(
            "Le site de suivi n'a pas pu être joint : " + Utils.echapper(e.message),
            TOAST_ERROR,
          );
      },
      envoyer = (c) => {
        etatLigne(c, "envoi");
        OuafSuivi.envoyer([c], (x, statut, detail) => etatLigne(x, statut, detail)).then(
          (b) => {
            if (b.introuvables)
              toast(
                `${Utils.echapper(c.vers)} est introuvable dans « Vers joueur » sur le site de suivi : rien n'a été noté.`,
                TOAST_WARNING,
              );
            else if (b.erreurs) toast("L'envoi au site de suivi a échoué.", TOAST_ERROR);
          },
          (e) => {
            etatLigne(c, "non");
            echec(e);
          },
        );
      };
    convois.forEach((c) => etatLigne(c, "verif"));
    OuafSuivi.lireCode().then((code) => {
      if (!code) return convois.forEach((c) => etatLigne(c, "non"));
      // ouverture de la page : lecture de l'historique du site, une fois
      OuafSuivi.etat(convois).then(
        (transmis) =>
          convois.forEach((c) => etatLigne(c, transmis.has(c.cle) ? "transmis" : "non")),
        (e) => {
          convois.forEach((c) => etatLigne(c, "non", "état du site inconnu"));
          if (e.name != "permission") echec(e);
        },
      );
    });
  }
  /**
   * Premier envoi sans mot de passe : ouvre Paramètres → Convoi, sur le champ
   * du mot de passe du site de suivi.
   *
   * @static
   * @method ouvrirParametresOuaf
   */
  static ouvrirParametresOuaf() {
    $.toast({
      ...TOAST_INFO,
      text: "Renseigne d'abord le mot de passe du site de suivi (Paramètres → Convoi), puis relance l'envoi.",
      hideAfter: 8000,
    });
    if (!$("#o_tabsParametre6").is(":visible"))
      $("#o_itemParametre").closest(".o_toolbarItem").trigger("click");
    let $onglets = $("#o_tabsParametre");
    if ($onglets.hasClass("ui-tabs"))
      $onglets.tabs(
        "option",
        "active",
        $onglets.find("a[href='#o_tabsParametre6']").parent().index(),
      );
    setTimeout(() => $("#o_ouafCode").trigger("focus").addClass("o_champSignale"), 400);
  }
  /**
   * Texte d'un convoi : la ligne en gras puis ce qui suit jusqu'au saut de
   * ligne (heure de retour), sans le lien « Annuler » ni les ajouts Fzzz.
   * Les icônes de ressources sont remplacées par leur nom.
   *
   * @static
   * @method texte
   */
  static texte(elt) {
    let $clone = $(elt).clone();
    $clone.find(".o_ouafLigne").remove();
    $clone.find("img").each((i, img) => {
      let alt = (img.getAttribute("alt") || "").replace(/^materiaux$/i, "matériaux");
      $(img).replaceWith(" " + alt + " ");
    });
    let morceaux = [$clone.text()];
    for (let n = elt.nextSibling; n && n.nodeName != "BR"; n = n.nextSibling) {
      if (n.nodeName == "A" && /annuler=/.test(n.getAttribute("href") || "")) continue;
      morceaux.push(n.textContent);
    }
    return morceaux
      .join("")
      .replace(/\s+/g, " ")
      .replace(/^\s*-\s*/, "")
      .replace(/(\s*-)+\s*$/, "")
      .replace(/(\s-)+\s-/g, " -")
      .trim();
  }
  /**
   * @static
   * @method copier
   */
  static copier(texte, message) {
    let ecrire =
      navigator.clipboard && navigator.clipboard.writeText
        ? navigator.clipboard.writeText(texte)
        : Promise.reject(new Error("presse-papier indisponible"));
    ecrire.then(
      () => $.toast({ ...TOAST_SUCCESS, text: message }),
      () => MessagerieFzzz._copieManuelle(texte),
    );
  }
}
