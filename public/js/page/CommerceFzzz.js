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
