/*
 * PartageChasses.js
 * NumeroBis-boop
 **********************************************************************/

// section cachée du forum d'alliance qui sert de stockage partagé
const FORUM_SECTION_CHASSES = "Fzzz_Chasses";

/**
 * Partage des chasses avec l'alliance, stocké dans son forum (aucun serveur
 * tiers) : une section cachée « Fzzz_Chasses », un sujet par groupe de chasses
 * partagé, titré « Chasse | pseudo | AAAA-MM-JJ HH:mm | cm² ». La page membre
 * lit la section et affiche les chasses du joueur consulté.
 *
 * L'identifiant de la section est repéré quand le joueur ouvre le forum de
 * l'alliance ; un chef peut l'y créer d'un clic. Requêtes : au clic sur
 * Partager, et une lecture de la section à l'ouverture d'une page membre.
 *
 * @class PartageChasses
 */
class PartageChasses {
  static get cle() {
    return "fzzz_forumChasses_" + Utils.serveur;
  }
  static get idSection() {
    try {
      return localStorage.getItem(PartageChasses.cle);
    } catch (e) {
      return null;
    }
  }
  static set idSection(id) {
    try {
      localStorage.setItem(PartageChasses.cle, id);
    } catch (e) {}
  }
  /**
   * Requête xajax du forum d'alliance (même protocole que l'ancien utilitaire).
   *
   * @private
   */
  static _xajax(fonction, args) {
    return Promise.resolve(
      $.ajax({
        type: "post",
        url: location.origin + "/alliance.php?forum_menu",
        data: { xajax: fonction, "xajaxargs[]": args, xajaxr: moment().valueOf() },
      }),
    );
  }
  /**
   * Sujets de la section : [{pseudo, impact (moment), terrain}].
   *
   * @static
   * @method lire
   */
  static lire() {
    let id = PartageChasses.idSection;
    if (!id) return Promise.reject(new Error("section inconnue"));
    return PartageChasses._xajax("callGetForum", id).then((data) => {
      let reponse = $(data).find("cmd:eq(1)").text();
      if (!reponse || reponse.includes("Vous n'avez pas accès à ce forum."))
        throw new Error("section inaccessible");
      let sujets = [];
      $("<div/>")
        .append(reponse)
        .find("#form_cat tr:gt(0)")
        .each((i, elt) => {
          let m = $(elt)
            .find("td:eq(1)")
            .text()
            .trim()
            .match(/^Chasse \| (.+?) \| (\d{4}-\d\d-\d\d \d\d:\d\d) \| (\d+)/);
          if (m)
            sujets.push({
              pseudo: m[1],
              impact: moment(m[2], "YYYY-MM-DD HH:mm"),
              terrain: parseInt(m[3]),
            });
        });
      return sujets;
    });
  }
  /**
   * Partage les groupes de la synthèse : un sujet par groupe, sans doublon.
   *
   * @static
   * @method partager
   * @param {Array} groupes [{impact (moment), terrain, unites (texte)}]
   */
  static partager(groupes, $bouton) {
    if (!PartageChasses.idSection) {
      $.toast({
        ...TOAST_WARNING,
        hideAfter: 10000,
        text: `Ouvre une fois le forum de l'alliance pour que Fzzz y trouve la section « ${FORUM_SECTION_CHASSES} ». Si elle n'existe pas, un chef peut la créer depuis le forum (bouton Fzzz).`,
      });
      return;
    }
    let pseudo = monProfil.pseudo;
    $bouton.prop("disabled", true);
    PartageChasses.lire()
      .then((sujets) => {
        let deja = sujets
            .filter((s) => s.pseudo == pseudo)
            .map((s) => s.impact.format("YYYY-MM-DD HH:mm")),
          nouveaux = groupes.filter((g) => !deja.includes(g.impact.format("YYYY-MM-DD HH:mm")));
        // créations l'une après l'autre, dans l'ordre des impacts
        return nouveaux
          .reduce(
            (p, g) =>
              p.then(() =>
                PartageChasses._xajax(
                  "envoiNouveauSujet",
                  `<xjxquery><q>cat=${PartageChasses.idSection}&sujet=${encodeURIComponent(`Chasse | ${pseudo} | ${g.impact.format("YYYY-MM-DD HH:mm")} | ${g.terrain}`)}&message=${encodeURIComponent(`Impact le ${g.impact.format("D MMM à HH[h]mm")} : ${numeral(g.terrain).format()} cm².\n${g.unites}`)}&type=normal&modifiable=envoyer&send=Envoyer&question=&reponse[]=&reponse[]=&reponse[]=</q></xjxquery>`,
                ),
              ),
            Promise.resolve(),
          )
          .then(() => nouveaux.length);
      })
      .then((n) =>
        $.toast({
          ...TOAST_SUCCESS,
          text: n
            ? `${n} groupe${n > 1 ? "s" : ""} de chasses partagé${n > 1 ? "s" : ""} avec la ${Utils.alliance}.`
            : "Ces chasses étaient déjà partagées.",
        }),
      )
      .catch(() =>
        $.toast({
          ...TOAST_ERROR,
          text: `Partage impossible : section « ${FORUM_SECTION_CHASSES} » introuvable ou inaccessible. Rouvre le forum de l'alliance.`,
        }),
      )
      .finally(() => $bouton.prop("disabled", false));
  }
  /**
   * Page membre : chasses partagées par le joueur consulté.
   *
   * @static
   * @method afficherProfil
   */
  static afficherProfil(pseudo) {
    if (!PartageChasses.idSection) return;
    PartageChasses.lire()
      .then((sujets) => {
        let siennes = sujets
          .filter((s) => s.pseudo.toLowerCase() == pseudo.toLowerCase())
          .sort((a, b) => b.impact - a.impact);
        let html = `<div id='o_chassesPartagees' class='boite_membre'><h3>Chasses partagées avec la ${Utils.alliance}</h3>`;
        if (!siennes.length) html += "<p class='centre'>Aucune chasse partagée.</p>";
        else {
          html += `<table class='centre' cellspacing='0'><tr class='gras'><td>Heure d'impact</td><td>TdC chassé</td></tr>`;
          siennes.forEach((s, i) => {
            html += `<tr${i % 2 ? "" : " class='ligne_paire'"}><td>${s.impact.format("D MMM YYYY à HH[h]mm")}</td><td>${numeral(s.terrain).format()} cm²</td></tr>`;
          });
          html += `<tr class='gras o_syntheseTotal'><td>Total (${siennes.length})</td><td>${numeral(siennes.reduce((t, s) => t + s.terrain, 0)).format()} cm²</td></tr></table>`;
        }
        $(".boite_membre")
          .last()
          .after(html + "</div>");
      })
      .catch(() => {});
  }
  /**
   * Forum d'alliance : repère la section (et propose de la créer).
   *
   * @static
   * @method observerForum
   */
  static observerForum() {
    let $alliance = $("#alliance");
    if (!$alliance.length) return;
    let traiter = () => {
      let $span = $alliance.find(`span[class^='forum']:contains('${FORUM_SECTION_CHASSES}')`);
      if ($span.length) {
        let id = ($span.attr("class").match(/\d+/) || [])[0];
        if (id) PartageChasses.idSection = id;
        $("#o_creerSectionChasses").remove();
      } else if ($alliance.find("#cat_forum").length && !$("#o_creerSectionChasses").length) {
        $alliance
          .find("#cat_forum")
          .after(
            `<div id='o_creerSectionChasses' class='centre o_marginT15'><button type='button' class='o_button f_info'>Fzzz : créer la section cachée « ${FORUM_SECTION_CHASSES} » (partage des chasses)</button></div>`,
          );
        $("#o_creerSectionChasses button").on("click", (e) => {
          $(e.currentTarget).prop("disabled", true);
          PartageChasses._creerSection().then(
            () => location.reload(),
            () => {
              $(e.currentTarget).prop("disabled", false);
              $.toast({
                ...TOAST_ERROR,
                text: "Création impossible : il faut les droits de gestion du forum.",
              });
            },
          );
        });
      }
    };
    traiter();
    new MutationObserver(traiter).observe($alliance[0], { childList: true, subtree: true });
  }
  /**
   * Crée la section puis la passe en « cachée » (le jeu ne permet pas de la
   * créer directement cachée).
   *
   * @private
   */
  static _creerSection() {
    let nom = FORUM_SECTION_CHASSES;
    return PartageChasses._xajax("ajoutCategorie", `<xjxquery><q>nom=${nom}</q></xjxquery>`).then(
      (data) => {
        let reponse = Utils.parseHtml($(data).find("cmd:eq(1)").text() || "");
        let id = ($(reponse).find(`input[value='${nom}']`).parent().attr("id") || "").match(/\d+/);
        if (!id) throw new Error("section non créée");
        PartageChasses.idSection = id[0];
        return PartageChasses._xajax(
          "renommerCategorie",
          `<xjxquery><q>nom=${nom}&type=cache&ID_cat=${id[0]}&del=Supprimer</q></xjxquery>`,
        );
      },
    );
  }
}
