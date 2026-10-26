/*
 * CommerceFzzz.js
 * NumeroBis-boop
 **********************************************************************/

/**
 * Ajouts Fzzz à la page /commerce.php : case à cocher et icône de copie sur
 * chaque convoi en cours, case « tout cocher » et bouton de copie des convois
 * sélectionnés. Rien n'est envoyé au jeu : tout se passe dans la page.
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
   * @static
   * @method decorer
   */
  static decorer() {
    if (!Utils.affichage("convoisSelection")) return;
    let $lignes = CommerceFzzz.lignes();
    if (!$lignes.length || $("#o_convoisOutils").length) return;
    $lignes.each((i, elt) => {
      // case et icône entre le « - » et le texte du convoi
      let noeud = elt.firstChild,
        tiret = noeud && noeud.nodeType == Node.TEXT_NODE ? noeud.data.match(/^\s*-\s*/) : null,
        $ajout = $(
          `<span class='o_convoiOutils'><input type='checkbox' class='o_convoiCoche'/><img class='o_convoiCopier' src='${IMG_COPIER}' title='Copier ce convoi' alt='Copier'/></span>`,
        );
      if (tiret) $ajout.insertBefore(noeud.splitText(tiret[0].length));
      else $(elt).prepend($ajout);
      $ajout.find(".o_convoiCopier").on("click", (e) => {
        e.preventDefault();
        CommerceFzzz.copier(CommerceFzzz.texte(elt), "Convoi copié dans le presse-papier.");
      });
    });
    let $outils = $(`<div id='o_convoisOutils'>
        <label title='Tout cocher'><input type='checkbox' id='o_convoisTous'/> Tout cocher</label>
        <button type='button' class='o_button f_info'>Copier tous les convois sélectionnés</button>
      </div>`).insertBefore($lignes.first());
    let $tous = $outils.find("#o_convoisTous"),
      $coches = $lignes.find(".o_convoiCoche");
    $tous.on("change", () => $coches.prop("checked", $tous.prop("checked")));
    $coches.on("change", () => {
      let n = $coches.filter(":checked").length;
      $tous.prop({ checked: n == $coches.length, indeterminate: n > 0 && n < $coches.length });
    });
    $outils.find("button").on("click", (e) => {
      e.preventDefault();
      let textes = $lignes
        .filter((i, elt) => $(elt).find(".o_convoiCoche").prop("checked"))
        .map((i, elt) => CommerceFzzz.texte(elt))
        .get();
      if (!textes.length) {
        $.toast({ ...TOAST_INFO, text: "Aucun convoi sélectionné." });
        return;
      }
      CommerceFzzz.copier(
        textes.join("\n"),
        textes.length > 1
          ? `${textes.length} convois copiés dans le presse-papier.`
          : "Convoi copié dans le presse-papier.",
      );
    });
  }
  /**
   * Bloc « Suivi des convois OUAF » (au-dessus des convois en cours) et, à
   * côté de chaque convoi envoyé, son état sur le site et un bouton d'envoi.
   * À l'ouverture de la page, l'historique du site est lu (si le code est
   * enregistré et l'accès accordé) pour savoir ce qui est déjà noté.
   *
   * @static
   * @method suiviOuaf
   */
  static suiviOuaf() {
    let bloc = Utils.affichage("convoisSuiviOuaf"),
      lignes = Utils.affichage("convoisSuiviLignes");
    if ((!bloc && !lignes) || $("#o_ouafSuivi").length) return;
    let convois = OuafSuivi.convoisJeu(),
      site = OUAF_SITE.replace(/^https?:\/\//, "").replace(/\/$/, ""),
      $titre = $("#centre > h3").filter((i, e) => $(e).text().includes("Convois en cours"));
    if (bloc) {
      let html = `<div id='o_ouafSuivi' class='boite_amelioration simulateur centre'>
          <h2>Suivi des convois OUAF</h2>
          <p>Outil de suivi : <a href='${OUAF_SITE}' target='_blank' rel='noopener'>${site}</a></p>
          <p><label for='o_ouafCodeCommerce'>Code de connexion de ton compte :</label>
            <input type='password' id='o_ouafCodeCommerce' autocomplete='new-password' spellcheck='false'/>
            <button type='button' id='o_ouafCodeCommerceOk' class='o_button'>Enregistrer</button>
            <span id='o_ouafCodeCommerceEtat' class='small'></span></p>
          <p><button type='button' id='o_ouafTout' class='o_button f_success'>Envoyer TOUS mes convois pas encore notés au site de suivi</button></p>
          <p id='o_ouafMsg' class='small'></p>
          <p class='small red'><em>Le site de suivi n'est pas chiffré (http) : ton code et tes convois y circulent en clair.</em></p>
        </div>`;
      if ($titre.length) $titre.first().before(html);
      else $("#centre").append(html);
    }
    let message = (texte, classe = "") =>
        $("#o_ouafMsg")
          .attr("class", "small " + classe)
          .html(texte),
      etatCode = (code) =>
        $("#o_ouafCodeCommerceEtat").html(
          code ? "<span class='green'>enregistré</span>" : "<span class='red'>à renseigner</span>",
        ),
      // état affiché à côté d'un convoi
      etatLigne = (c, statut, detail = "") => {
        if (!lignes) return;
        let libelles = {
            inconnu: ["Suivi OUAF : non vérifié", "o_ouafInconnu"],
            verif: ["Suivi OUAF : vérification…", "o_ouafInconnu"],
            non: ["Non noté au suivi OUAF", "o_ouafNon"],
            transmis: ["Noté au suivi OUAF ✓", "o_ouafOui"],
            envoye: ["Noté au suivi OUAF ✓", "o_ouafOui"],
            envoi: ["Envoi au suivi OUAF…", "o_ouafInconnu"],
            introuvable: ["Joueur introuvable sur le site de suivi", "o_ouafNon"],
            erreur: ["Envoi au suivi OUAF échoué", "o_ouafNon"],
          },
          [texte, classe] = libelles[statut] || libelles.inconnu,
          fait = statut == "transmis" || statut == "envoye",
          $l = $(c.elt).nextAll(".o_ouafLigne").first();
        if (!$l.length)
          $l = $(
            `<span class='o_ouafLigne'> <span class='o_ouafEtat'></span> <button type='button' class='o_button o_ouafEnvoyer'>Envoyer au suivi</button></span>`,
          ).insertAfter(c.elt);
        $l.find(".o_ouafEtat")
          .attr("class", "o_ouafEtat " + classe)
          .attr("title", detail)
          .text(texte);
        $l.find(".o_ouafEnvoyer").toggle(!fait && statut != "introuvable");
      },
      echec = (e) => {
        if (e.name == "permission") {
          message(
            "Fzzz n'a pas encore accès à ouafchaine.fr. <button type='button' id='o_ouafAcces' class='o_button f_info'>Autoriser l'accès</button> puis relance l'envoi.",
            "red",
          );
          $("#o_ouafAcces").on("click", () => OuafSuivi.demanderAcces());
        } else if (e.name == "code")
          message("Renseigne d'abord ton code de connexion au site de suivi.", "red");
        else
          message("Le site de suivi n'a pas pu être joint : " + Utils.echapper(e.message), "red");
      },
      envoyer = (liste, $bouton) => {
        if (!liste.length) {
          message("Aucun convoi envoyé en cours sur cette page.");
          return;
        }
        $bouton.prop("disabled", true);
        liste.forEach((c) => etatLigne(c, "envoi"));
        message("Envoi au site de suivi…");
        OuafSuivi.envoyer(liste, (c, statut, detail) => etatLigne(c, statut, detail))
          .then(
            (b) => {
              let morceaux = [];
              if (b.envoyes)
                morceaux.push(`${b.envoyes} convoi${b.envoyes > 1 ? "s notés" : " noté"}`);
              if (b.deja) morceaux.push(`${b.deja} déjà noté${b.deja > 1 ? "s" : ""}`);
              if (b.introuvables)
                morceaux.push(
                  `${b.introuvables} destinataire${b.introuvables > 1 ? "s" : ""} introuvable${b.introuvables > 1 ? "s" : ""} sur le site`,
                );
              if (b.erreurs) morceaux.push(`${b.erreurs} en erreur`);
              message(morceaux.join(", ") + ".", b.erreurs || b.introuvables ? "red" : "green");
            },
            (e) => {
              // convois pas encore traités : état d'avant l'envoi
              liste.forEach((c) => {
                if (
                  $(c.elt)
                    .nextAll(".o_ouafLigne")
                    .first()
                    .find(".o_ouafEtat")
                    .text()
                    .includes("Envoi au suivi")
                )
                  etatLigne(c, "inconnu");
              });
              echec(e);
            },
          )
          .finally(() => $bouton.prop("disabled", false));
      };
    convois.forEach((c) => etatLigne(c, "verif"));
    $(".o_ouafLigne").on("click", ".o_ouafEnvoyer", (e) => {
      let c = convois.find(
        (x) =>
          $(x.elt).nextAll(".o_ouafLigne").first()[0] ==
          $(e.currentTarget).closest(".o_ouafLigne")[0],
      );
      if (c) envoyer([c], $(e.currentTarget));
    });
    $("#o_ouafTout").on("click", (e) => envoyer(convois, $(e.currentTarget)));
    $("#o_ouafCodeCommerceOk").on("click", () => {
      let code = String($("#o_ouafCodeCommerce").val() || "").trim();
      if (!code) return;
      OuafSuivi.enregistrerCode(code).then(() => {
        $("#o_ouafCodeCommerce").val("");
        etatCode(code);
      });
    });
    OuafSuivi.lireCode().then((code) => {
      etatCode(code);
      if (!code) return convois.forEach((c) => etatLigne(c, "inconnu"));
      // ouverture de la page : lecture de l'historique du site, une fois
      OuafSuivi.etat(convois).then(
        (transmis) =>
          convois.forEach((c) => etatLigne(c, transmis.has(c.cle) ? "transmis" : "non")),
        (e) => {
          convois.forEach((c) => etatLigne(c, "inconnu"));
          if (e.name != "permission") echec(e);
        },
      );
    });
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
    $clone.find(".o_convoiOutils").remove();
    $clone.find("img").each((i, img) => {
      let alt = (img.getAttribute("alt") || "").replace(/^materiaux$/i, "matériaux");
      $(img).replaceWith(" " + alt + " ");
    });
    let morceaux = [$clone.text()];
    for (let n = elt.nextSibling; n && n.nodeName != "BR"; n = n.nextSibling) {
      if (n.nodeName == "A" && /annuler=/.test(n.getAttribute("href") || "")) continue;
      // état du suivi OUAF ajouté par Fzzz
      if (n.nodeType == 1 && n.classList.contains("o_ouafLigne")) continue;
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
