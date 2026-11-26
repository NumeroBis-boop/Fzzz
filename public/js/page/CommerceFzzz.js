/*
 * CommerceFzzz.js
 * NumeroBis-boop
 **********************************************************************/

// pseudos suivis dans le bloc « Récapitulatif », dans l'ordre d'ajout
const CLE_CONVOIS_MEMBRES = "fzzz_convoisMembres";
// tri du « Récapitulatif » choisi par le joueur, gardé jusqu'à ce qu'il le
// change (demande du mainteneur) ; sans tri choisi : ordre d'ajout
const CLE_TRI_CONVOIS = "fzzz_triConvoisMembres";
const OUAF_PANNE =
  "Le site de suivi des convois ne répond pas : « Convoi à faire » et « 📤 Envoyer au suivi » sont indisponibles pour l'instant. Réessaie plus tard.";
// le jeu produit 48 récoltes par jour (production du jour = récolte × 48)
const RECOLTE_PERIODE = 30 * 60000;
// B (règle du mainteneur) : les ouvrières d'un convoi ne comptent que s'il
// rentre au moins une minute avant la récolte
const RECOLTE_AVANCE_RETOUR = 60000;
// convoi encore parti à la lecture de la page Ressources : son compte à rebours
// (à la seconde près) finit au moins 2 s après
const RECOLTE_MARGE_RETOUR = 2000;
// minute « Retour le » du jeu passée depuis 90 s : convoi revenu, quel que soit
// le compte à rebours affiché (figé si la page a été mise en pause)
const RECOLTE_RETOUR_PASSE = 90000;
// temps laissé au joueur pour lancer le convoi rempli : son retour est compté
// depuis la fin de ce délai, que le message rappelle
const RECOLTE_DELAI_ENVOI = 5 * 60000;
const RECOLTES_EXAMINEES_MAX = 48 * 14;
// pages Ressources et Armée relues au plus une fois par minute (clics successifs)
const RECOLTE_VALIDITE_LECTURE = 60000;
// convoi en cours du joueur : quantités de nourriture et de matériaux
const LIGNE_CONVOI_ENVOYE = /Vous allez livrer\s+([\d\s  ]+)\D+?et\s+([\d\s  ]+)\D+?à\s/i;
// convoi enregistré sur le site de suivi : le Récapitulatif relit « Mes convois »
const EVENEMENT_CONVOI_ENREGISTRE = "o_convoiEnregistre";
// Récapitulatif : info-bulle d'un destinataire qui ne veut pas de convois
const TITRE_SANS_RECEPTION =
  "Ne veut pas de convois : case « Je ne souhaite pas recevoir de convois » cochée sur le site de suivi";

/**
 * Ajouts Fzzz à la page /commerce.php : lecture des convois en cours, et
 * devant chacun son état sur le site de suivi de l'alliance. Rien n'est envoyé
 * au jeu. `texte` et `copier` servent aussi aux autres pages.
 *
 * @class CommerceFzzz
 */
class CommerceFzzz {
  /**
   * Lignes des convois en cours : les <strong> qui suivent le titre
   * « Convois en cours: » et commencent par « - », ou déjà rangés en deux
   * colonnes (CommerceFzzz.colonnes).
   *
   * @static
   * @method lignes
   * @param {jQuery} [$racine] page Convois ouverte (par défaut) ou lue
   */
  static lignes($racine = $(document)) {
    let $titre = $racine
      .find("#centre > h3")
      .filter((i, e) => $(e).text().includes("Convois en cours"));
    if (!$titre.length) return $();
    let $section = $titre.first().nextUntil("h3");
    return $section
      .filter("strong")
      .filter((i, e) => /^\s*-/.test($(e).text()) && $(e).text().includes("dans"))
      .add($section.filter(".o_convois").find(".o_convoiTexte > strong:first-child"));
  }
  /**
   * Quantités (nourriture + matériaux) des convois en cours du joueur, sur la
   * page Convois ouverte ou lue.
   *
   * @static
   * @method montantsEnvoyes
   * @param {jQuery} [$racine] page Convois
   * @return {Array<Number>}
   */
  static montantsEnvoyes($racine = $(document)) {
    let nombre = (t) => parseInt(String(t).replace(/\D/g, "")) || 0;
    return CommerceFzzz.lignes($racine)
      .get()
      .map((elt) => CommerceFzzz.texte(elt).match(LIGNE_CONVOI_ENVOYE))
      .filter(Boolean)
      .map((m) => nombre(m[1]) + nombre(m[2]));
  }
  /**
   * Convois en cours en deux colonnes : le « - » du jeu et l'état de suivi à
   * gauche, le reste de la ligne à droite, replié sous « Vous allez… » ; ainsi
   * « Annuler » ne se trouve jamais sous ou sur un bouton d'envoi (demande du
   * mainteneur). Rend la case d'état de chaque ligne.
   *
   * @static
   * @method colonnes
   * @param {Array<Element>} lignes <strong> des convois (CommerceFzzz.lignes)
   * @return {Map<Element, any>}
   */
  static colonnes(lignes) {
    let cases = new Map(),
      $convois = $("<div class='o_convois'></div>");
    lignes.forEach((elt) => {
      let noeud = elt.firstChild,
        tiret = noeud instanceof Text ? noeud.data.match(/^\s*-\s*/) : null;
      // sans « - » en tête : ligne d'un autre format, ou déjà rangée
      if (!tiret) return;
      // une ligne du jeu : le <strong>, puis « - Retour… - Annuler » jusqu'au <br>
      let suite = [],
        n = elt.nextSibling;
      for (
        ;
        n &&
        n.nodeName != "BR" &&
        (n instanceof Text || /^(A|SMALL|EM|I|B|SPAN|IMG|FONT)$/.test(n.nodeName));
        n = n.nextSibling
      )
        suite.push(n);
      if (!$convois.parent().length) $convois.insertBefore(elt);
      noeud.splitText(tiret[0].length);
      let $etat = $("<span class='o_convoiEtat'></span>").append(noeud);
      $("<span class='o_convoi'></span>")
        .append($etat, $("<span class='o_convoiTexte'></span>").append(elt, suite))
        .appendTo($convois);
      if (n && n.nodeName == "BR") n.remove();
      cases.set(elt, $etat);
    });
    return cases;
  }
  /**
   * Cadre « Organiser un convoi » du jeu : le tableau du formulaire, ou son
   * ancêtre encadré s'il en a un.
   *
   * @static
   * @method cadreConvoi
   */
  static cadreConvoi() {
    let $t = $("#centre form table").first();
    if (!$t.length) return null;
    let cadre = $t[0];
    $t.parentsUntil("#centre").each((i, e) => {
      let st = getComputedStyle(e);
      if (st.borderTopStyle != "none" && parseFloat(st.borderTopWidth) > 0) cadre = e;
    });
    return cadre;
  }
  /**
   * Même largeur et même bord gauche que le cadre « Organiser un convoi ».
   *
   * @static
   * @method calerSurCadreConvoi
   */
  static calerSurCadreConvoi($bloc) {
    let cadre = CommerceFzzz.cadreConvoi(),
      parent = $bloc.parent()[0];
    if (!cadre || !parent) return;
    let r = cadre.getBoundingClientRect(),
      rp = parent.getBoundingClientRect(),
      gauche = r.left - rp.left - parseFloat(getComputedStyle(parent).paddingLeft || "0");
    if (!r.width) return;
    $bloc.css({ width: `${r.width}px`, marginLeft: `${Math.max(0, gauche)}px`, marginRight: "0" });
  }
  /**
   * Suivi des convois de l'alliance sur la page Convois : rien sans site de
   * suivi dans ses réglages ; le site accepté par le joueur, l'état de chaque
   * convoi et le Récapitulatif ; sinon la demande d'accord.
   *
   * @static
   * @method suivi
   * @return {Promise<void>|undefined}
   */
  static suivi() {
    let lancer = () => {
      let site = OuafSuivi.site();
      if (!site) return;
      return OuafSuivi.siteAccepte().then((ok) => {
        if (!ok) return CommerceFzzz.proposerSite(site);
        CommerceFzzz.suiviOuaf();
        CommerceFzzz.membresSuivis();
      });
    };
    // jamais lus dans ce navigateur : les réglages sont lus d'abord
    return ReglagesAlliance.garde() ? lancer() : ReglagesAlliance.charger().then(lancer, () => {});
  }
  /**
   * Site de suivi des réglages pas encore accepté : rien n'y part (ni convoi
   * ni mot de passe) avant l'accord du joueur, le forum pouvant être modifié
   * par un autre membre.
   *
   * @static
   * @method proposerSite
   * @param {{url: String, origine: String, hote: String}} site
   */
  static proposerSite(site) {
    if ($("#centre .o_convoisSite").length) return;
    let $titre = $("#centre > h3")
      .filter((i, e) => $(e).text().includes("Convois en cours"))
      .first();
    if (!$titre.length) return;
    $(
      `<p class='o_convoisSite'>Suivi des convois de l'alliance : ses réglages donnent le site <b>${Utils.echapper(site.hote)}</b>. Tes convois et le mot de passe du site n'y partent qu'avec ton accord. <button type='button' class='o_button f_info'>Accepter ce site</button></p>`,
    )
      .insertAfter($titre)
      .find("button")
      .on("click", (e) => {
        $(e.currentTarget).prop("disabled", true);
        OuafSuivi.accepterSite().then(() => {
          $("#centre .o_convoisSite").remove();
          CommerceFzzz.suiviOuaf();
          CommerceFzzz.membresSuivis();
        });
      });
  }
  /**
   * Devant chaque convoi envoyé, son état d'après le sujet « Convois » du forum
   * de l'alliance, seule référence : « ✅ Enregistré » s'il y est noté, sinon
   * un bouton « 📤 Envoyer au suivi », qui le transmet au site de suivi puis le
   * note dans le sujet. Transmis mais pas noté (écriture du forum en échec) :
   * bouton « 📝 Noter dans le forum », qui ne renvoie rien au site. Le mot de
   * passe du site se renseigne seulement dans Préférences → Convois. L'état va
   * dans une colonne à part (CommerceFzzz.colonnes).
   *
   * @static
   * @method suiviOuaf
   */
  static suiviOuaf() {
    if (!OuafSuivi.site() || !Utils.affichage("convoisSuiviLignes") || $(".o_ouafLigne").length)
      return;
    let convois = OuafSuivi.convoisJeu();
    CommerceFzzz.reporterAnnulations(convois);
    if (!convois.length) return;
    let cases = Utils.affichage("convoisColonnes")
        ? CommerceFzzz.colonnes(CommerceFzzz.lignes().get())
        : new Map(),
      toast = (texte, type = TOAST_INFO) => $.toast({ ...type, text: texte, hideAfter: 8000 }),
      // convoi noté dans le forum → sa ligne (sa répartition sert à une annulation)
      notees = new Map(),
      // clic sur « Annuler » du jeu, pour un convoi transmis : retenu, puis retiré
      // du suivi au chargement suivant s'il n'est plus en cours
      surveillerAnnulation = (c) => {
        let lien = OuafSuivi.lienAnnuler(c.elt);
        if (!lien || $(lien).data("o_annulation")) return;
        $(lien)
          .data("o_annulation", true)
          .on("click", () => {
            let note = notees.get(c),
              source = note || c;
            if (!note && c.prevu == null) return;
            OuafSuivi.enregistrerAnnulations(
              OuafSuivi.annulations()
                .filter((x) => x.id != c.id)
                .concat([
                  {
                    id: c.id,
                    vers: c.vers,
                    montant: c.montant,
                    arrivee: c.arrivee,
                    ...(source.prevu != null
                      ? { prevu: source.prevu, avance: source.avance || 0 }
                      : {}),
                    dansForum: !!note,
                    siteFait: false,
                    quand: Horloge.maintenant(),
                  },
                ]),
            );
          });
      },
      titres = {
        verif: "Lecture du forum de l'alliance…",
        envoi: "Envoi au site de suivi…",
        non: "Pas encore noté dans le forum de l'alliance",
        introuvable: "Destinataire introuvable sur le site de suivi",
        erreur: "Le dernier envoi a échoué",
        forum: "Transmis au site de suivi, pas encore noté dans le forum : ne le renvoie pas",
        note: "Écriture dans le forum…",
      },
      // état affiché devant un convoi : noté dans le forum, bouton d'envoi, ou
      // bouton de note dans le forum (transmis au site, pas encore noté)
      etatLigne = (c, statut, detail = "") => {
        let $case = cases.get(c.elt),
          $l = ($case || $(c.elt)).find(".o_ouafLigne");
        if (!$l.length) {
          $l = $(
            `<span class='o_ouafLigne'><span class='o_ouafOui'>✅ Enregistré</span><button type='button' class='o_button o_ouafEnvoyer'>📤 Envoyer au suivi</button><button type='button' class='o_button o_ouafNoter'>📝 Noter dans le forum</button></span>`,
          );
          // après le « - » du jeu : dans la colonne des états, sinon dans la ligne
          let noeud = c.elt.firstChild,
            tiret = noeud instanceof Text ? noeud.data.match(/^\s*-\s*/) : null;
          if ($case) $case.append($l);
          else if (tiret) $l.insertBefore(noeud.splitText(tiret[0].length));
          else $(c.elt).prepend($l);
          $l.find(".o_ouafEnvoyer").on("click", (e) => {
            e.preventDefault();
            envoyer(c);
          });
          $l.find(".o_ouafNoter").on("click", (e) => {
            e.preventDefault();
            noter(c);
          });
        }
        let titre = [titres[statut], detail].filter(Boolean).join(" : "),
          aNoter = statut == "forum" || statut == "note";
        $l.find(".o_ouafOui")
          .toggle(statut == "transmis")
          .attr("title", statut == "transmis" ? detail || "Noté dans le forum de l'alliance" : "");
        $l.find(".o_ouafEnvoyer")
          .text(
            statut == "verif"
              ? "⏳ Vérification…"
              : statut == "envoi"
                ? "⏳ Envoi au suivi…"
                : "📤 Envoyer au suivi",
          )
          .toggle(statut != "transmis" && !aNoter)
          .prop("disabled", statut == "verif" || statut == "envoi")
          .attr("title", titre);
        $l.find(".o_ouafNoter")
          .text(statut == "note" ? "⏳ Note dans le forum…" : "📝 Noter dans le forum")
          .toggle(aNoter)
          .prop("disabled", statut == "note")
          .attr("title", titre);
      },
      echec = (e) => {
        if (e.name == "permission") {
          toast(
            `${NOM_EXTENSION} n'a pas encore accès à ${Utils.echapper((OuafSuivi.site() || { hote: "ce site" }).hote)}. <button type='button' id='o_ouafAcces' class='o_button f_info'>Autoriser l'accès</button> puis relance l'envoi.`,
            TOAST_WARNING,
          );
          $(document)
            .off("click.ouafAcces")
            .on("click.ouafAcces", "#o_ouafAcces", () => OuafSuivi.demanderAcces());
        } else if (e.name == "code") CommerceFzzz.ouvrirParametresOuaf();
        else if (e.name == "site") toast(Utils.echapper(e.message), TOAST_WARNING);
        else if (e.name == "session")
          toast(`${Utils.echapper(e.message)}. Rien n'a été envoyé.`, TOAST_WARNING);
        else if (e.name == "reseau") {
          let site = OuafSuivi.site() || { url: "", hote: "" };
          CommerceFzzz.signalerSuiviOuaf(OUAF_PANNE);
          toast(
            `Le site de suivi des convois ne répond pas : rien n'a été envoyé, réessaie plus tard. Si <a href='${Utils.echapper(site.url)}' target='_blank' rel='noopener'>${Utils.echapper(site.hote)}</a> s'ouvre normalement dans un onglet, c'est ton navigateur qui le bloque (Firefox, mode « HTTPS uniquement » : choisis « Continuer vers le site HTTP »).`,
            TOAST_ERROR,
          );
        } else
          toast(
            "Le site de suivi n'a pas pu être joint : " + Utils.echapper(e.message),
            TOAST_ERROR,
          );
      },
      // la note dans le sujet du forum fait « ✅ Enregistré »
      noter = (c, detail = "") => {
        etatLigne(c, "note");
        ConvoisForum.noter([c]).then(
          () => {
            notees.set(c, { id: c.id || 0, prevu: c.prevu, avance: c.avance });
            surveillerAnnulation(c);
            etatLigne(
              c,
              "transmis",
              ["Noté dans le forum de l'alliance", detail].filter(Boolean).join(" : "),
            );
          },
          (e) => {
            let raison =
              e.message == "absente"
                ? "section « " + FORUM_SECTIONS_CHASSES[0] + " » inexistante ou cachée à ton grade"
                : Utils.echapper(e.message);
            etatLigne(c, "forum", raison);
            surveillerAnnulation(c);
            toast(
              `Convoi noté sur le site de suivi, mais pas dans le forum de l'alliance (${raison}). Clique « 📝 Noter dans le forum » : sinon il s'affichera de nouveau « 📤 Envoyer au suivi », et le renvoyer le compterait deux fois sur le site.`,
              TOAST_WARNING,
            );
          },
        );
      },
      envoyer = (c) => {
        etatLigne(c, "envoi");
        OuafSuivi.envoyer([c], (x, statut, detail) => {
          if (statut == "envoye") {
            $("#centre .o_convoisOuafPanne").remove();
            noter(x, detail);
            // « Convoi à faire » du Récapitulatif, relu sur le site
            $(document).trigger(EVENEMENT_CONVOI_ENREGISTRE);
          } else etatLigne(x, statut, detail);
        }).then(
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
    // état lu dans le sujet « Convois » du forum seulement, jamais sur le site de suivi
    ConvoisForum.notes().then(
      (notes) => {
        ConvoisForum.trouves(convois, notes).forEach((note, c) => notees.set(c, note));
        convois.forEach((c) => {
          etatLigne(c, notees.has(c) ? "transmis" : "non");
          if (notees.has(c)) surveillerAnnulation(c);
        });
      },
      (e) => {
        let raison =
          e.message == "absente"
            ? "section « " + FORUM_SECTIONS_CHASSES[0] + " » inexistante ou cachée à ton grade"
            : Utils.echapper(e.message);
        convois.forEach((c) => etatLigne(c, "non", "forum illisible, état inconnu"));
        toast(
          `Le forum de l'alliance n'a pas pu être lu (${raison}) : l'état des convois est inconnu. N'envoie pas au suivi un convoi déjà noté.`,
          TOAST_WARNING,
        );
      },
    );
  }
  /**
   * Convois transmis dont le joueur a cliqué « Annuler » : au chargement
   * suivant, celui qui n'est plus en cours avant son arrivée est retiré du site
   * de suivi (sa part seulement, d'après la répartition notée à l'envoi), puis
   * sa ligne du forum, une seule : un convoi identique resté en cours n'est
   * pas touché. En échec, nouvel essai au chargement suivant.
   *
   * @static
   * @method reporterAnnulations
   * @param {Array} convois convois en cours (voir OuafSuivi.convoisJeu)
   * @return {Promise}
   */
  static reporterAnnulations(convois) {
    let maintenant = Horloge.maintenant(),
      toast = (texte, type) => $.toast({ ...type, text: texte, hideAfter: 12000 }),
      changer = (a, champs) =>
        OuafSuivi.enregistrerAnnulations(
          OuafSuivi.annulations()
            .map((x) => (x.id == a.id ? (champs ? { ...x, ...champs } : null) : x))
            .filter(Boolean),
        ),
      montant = (n) => numeral(n).format();
    return OuafSuivi.annulations().reduce(
      (suite, a) =>
        suite.then(() => {
          // toujours en cours (annulation refusée ou abandonnée), ou arrivé
          if (convois.some((c) => c.id == a.id) || a.arrivee <= maintenant + OUAF_ECART_ARRIVEE)
            return changer(a);
          let convoi = `Convoi annulé vers ${Utils.echapper(a.vers)} (${montant(a.montant)})`;
          if (maintenant - a.quand > OUAF_DUREE_ANNULATION) {
            changer(a);
            return toast(
              `${convoi} : annulation non reportée à temps, retire-le à la main du site de suivi et du forum.`,
              TOAST_WARNING,
            );
          }
          let progres = (champs) => changer(a, champs),
            site =
              a.siteFait || a.prevu == null ? Promise.resolve(null) : OuafSuivi.retirer(a, progres);
          return site
            .then((bilan) => {
              if (bilan) changer(a, { siteFait: true });
              return (a.dansForum ? ConvoisForum.retirer(a, progres) : Promise.resolve(false)).then(
                () => bilan,
              );
            })
            .then(
              (bilan) => {
                changer(a);
                let parts = bilan
                  ? [
                      bilan.prevu && `${montant(bilan.prevu)} du convoi prévu`,
                      bilan.avance && `${montant(bilan.avance)} d'avance`,
                    ].filter(Boolean)
                  : [];
                toast(
                  `${convoi} : ${[
                    a.prevu == null
                      ? null
                      : `retiré du site de suivi${parts.length ? " (" + parts.join(", ") + ")" : ""}`,
                    a.dansForum ? "retiré du forum" : null,
                  ]
                    .filter(Boolean)
                    .join(" et ")}.${
                    a.prevu == null
                      ? " Retire-le à la main du site de suivi : sa répartition n'était pas notée."
                      : bilan && bilan.manque.length
                        ? " À vérifier sur le site : " +
                          Utils.echapper(bilan.manque.join(", ")) +
                          "."
                        : ""
                  }`,
                  a.prevu == null || (bilan && bilan.manque.length) ? TOAST_WARNING : TOAST_SUCCESS,
                );
              },
              (e) =>
                toast(
                  `${convoi} : pas encore retiré du suivi (${Utils.echapper(e.message)}). Nouvel essai au prochain chargement de la page Convois.`,
                  TOAST_WARNING,
                ),
            );
        }),
      Promise.resolve(),
    );
  }
  /**
   * Problème du site de suivi écrit sur la page (une info-bulle ne se voit pas
   * sur téléphone) : dans le Récapitulatif, sinon sous « Convois en cours ».
   *
   * @static
   * @method signalerSuiviOuaf
   * @param {String} texte
   */
  static signalerSuiviOuaf(texte) {
    let $p = $("#centre .o_convoisOuafPanne");
    if (!$p.length) {
      $p = $("<p class='o_convoisOuafPanne'></p>");
      let $recap = $("#o_convoisMembres table.o_convoisMembres"),
        $titre = $("#centre > h3")
          .filter((i, e) => $(e).text().includes("Convois en cours"))
          .first();
      if ($recap.length) $p.insertBefore($recap);
      else if ($titre.length) $p.insertAfter($titre);
      else return;
    }
    $p.text("⚠ " + texte);
  }
  /**
   * Écrit le destinataire du convoi, sans donner le focus au champ ni
   * déclencher d'événement : la liste de suggestions ne s'ouvre pas.
   *
   * @static
   * @method remplirDestinataire
   * @param {String} pseudo
   */
  static remplirDestinataire(pseudo) {
    let $champ = $("#pseudo_convoi");
    if (!$champ.length) return;
    $champ.val(pseudo);
    if ($champ.autocomplete && $champ.autocomplete("instance")) $champ.autocomplete("close");
    if (document.activeElement === $champ[0]) $champ.trigger("blur");
  }
  /**
   * Quantité de matériaux à écrire, en chiffres seuls (le champ du jeu refuse
   * les espaces) : le montant dû, au plus le stock et au plus ce que peuvent
   * porter les ouvrières qui ne sont pas nécessaires au terrain.
   *
   * @static
   * @method montantMateriaux
   * @param {Number} du montant restant à livrer
   * @param {Number} stock matériaux en stock (NaN si inconnu)
   * @param {Number} [portable] ressources transportables en plus de la nourriture déjà saisie (NaN si inconnu)
   * @return {String}
   */
  static montantMateriaux(du, stock, portable = NaN) {
    let n = Math.min(du, isNaN(stock) ? du : stock, isNaN(portable) ? du : portable);
    return String(Math.max(0, Math.floor(n)));
  }
  /**
   * Écrit les matériaux du convoi (nourriture inchangée) et les ouvrières
   * nécessaires. Les ouvrières qui exploitent le terrain (une par cm²)
   * restent à la fourmilière : seules les autres partent en convoi. Option
   * « convoisAvantRecolte » : le calcul est refait avec ce qui arrive avant
   * chaque récolte (remplirAvantRecolte).
   *
   * @static
   * @method remplirMateriaux
   * @param {Number} du montant restant à livrer
   * @param {Number|null} [trajet] temps de trajet vers le destinataire (s), null si inconnu
   * @return {Promise<void>|undefined} la lecture d'avant la récolte, quand l'option la fait
   */
  static remplirMateriaux(du, trajet = null) {
    if (!$("#input_nbMateriaux").length) return;
    let total = Utils.ouvrieres,
      libres = total - Math.min(total, Utils.terrain || 0),
      avantRecolte = !!monProfil.parametre?.["convoisAvantRecolte"]?.valeur,
      ecrit = CommerceFzzz.ecrireConvoi(du, libres);
    if (!avantRecolte) return void CommerceFzzz.avisCapacite(ecrit);
    return CommerceFzzz.remplirAvantRecolte(du, libres, ecrit, trajet);
  }
  /**
   * Matériaux et ouvrières du convoi pour `libres` ouvrières disponibles.
   *
   * @static
   * @method ecrireConvoi
   * @param {Number} du montant restant à livrer
   * @param {Number} libres ouvrières qui peuvent partir
   * @return {{mat: String, ouvrieres: Number, reduit: String|null, capacite: Boolean}} reduit : texte
   *   de la réduction des matériaux ; capacite : réduits faute d'ouvrières, pas de stock
   */
  static ecrireConvoi(du, libres) {
    let parOuvriere = Utils.parOuvriere(),
      nou = Math.floor(parseFloat($("#nbNourriture").val())) || 0,
      mat = CommerceFzzz.montantMateriaux(du, Utils.materiaux, libres * parOuvriere - nou),
      ouvrieres = Math.ceil((parseInt(mat) + nou) / parOuvriere);
    $("#input_nbMateriaux").val(mat);
    $("#nbMateriaux").val(mat);
    $("#input_nbOuvriere").val(String(ouvrieres));
    $("#nbOuvriere").val(ouvrieres);
    let reduit = parseInt(mat) < Math.floor(du),
      stock = parseInt(mat) >= Utils.materiaux;
    return {
      mat,
      ouvrieres,
      reduit: reduit
        ? `Matériaux réduits à ${numeral(mat).format()} sur ${numeral(du).format()} : ${
            stock
              ? "stock"
              : libres >= Utils.ouvrieres
                ? "pas assez d'ouvrières"
                : "ouvrières à garder pour exploiter le terrain"
          }.`
        : null,
      capacite: reduit && !stock,
    };
  }
  /**
   * Seule notification du remplissage d'un convoi (demande du mainteneur,
   * 21/11/2026) : le montant réduit faute d'ouvrières pour le porter.
   *
   * @static
   * @method avisCapacite
   * @param {{reduit: String|null, capacite: Boolean}} ecrit ecrireConvoi
   */
  static avisCapacite(ecrit) {
    if (ecrit.capacite) $.toast({ ...TOAST_INFO, text: ecrit.reduit });
  }
  /**
   * Remplissage refait selon la formule du mainteneur (idée de KWHWWYMWN,
   * option décochée par défaut) : ouvrières disponibles = A + B − E − F à
   * chaque récolte avant le retour du convoi envoyé (libresAvantRecolte),
   * pages Ressources et Armée lues au clic. Les champs ne sont réécrits que
   * s'ils gardent les valeurs écrites au clic (le joueur a pu les changer
   * entre-temps) ; sans lecture possible, le remplissage habituel reste.
   *
   * @static
   * @method remplirAvantRecolte
   * @param {Number} du montant restant à livrer
   * @param {Number} habituelles ouvrières libres du remplissage habituel
   * @param {Object} ecrit ce que ecrireConvoi a écrit au clic
   * @param {Number|null} [trajet] temps de trajet vers le destinataire (s)
   */
  static remplirAvantRecolte(du, habituelles, ecrit, trajet = null) {
    let jeton = (CommerceFzzz._jetonRecolte = (CommerceFzzz._jetonRecolte || 0) + 1),
      intacts = () =>
        $("#input_nbMateriaux").val() == ecrit.mat &&
        String($("#input_nbOuvriere").val()) == String(ecrit.ouvrieres);
    return CommerceFzzz.lireRecolte()
      .then((lu) => {
        if (jeton != CommerceFzzz._jetonRecolte) return;
        let parOuvriere = Utils.parOuvriere(),
          maintenant = Horloge.maintenant(),
          envoi = trajet != null ? maintenant + RECOLTE_DELAI_ENVOI : null,
          calcul = CommerceFzzz.libresAvantRecolte({
            presentes: lu.presentes,
            terrain: lu.terrain,
            recolte: lu.recolte,
            maintenant,
            retours: CommerceFzzz.retoursConvois(lu.instant, parOuvriere, maintenant),
            chasses: lu.chasses,
            attaques: lu.attaques,
            retourConvoi: envoi != null ? envoi + /** @type {Number} */ (trajet) * 1000 : null,
          }),
          garde = !intacts(),
          refait = garde ? ecrit : CommerceFzzz.ecrireConvoi(du, calcul.libres);
        Journal.info("Convois", "remplissage avant la récolte", {
          message: CommerceFzzz.messageRecolte(calcul, habituelles, {
            reduit: refait.reduit,
            automatique: lu.automatique,
            armee: lu.armee,
            inconnues: lu.attaquesInconnues,
            envoi,
            garde,
          }),
          recolte: calcul.recolte == null ? null : moment(calcul.recolte).format("HH:mm:ss"),
          libres: calcul.libres,
          habituelles,
          presentes: lu.presentes,
          terrain: lu.terrain,
          revenues: calcul.revenues,
          chasses: calcul.gagne,
          attaques: calcul.attaques,
          attaquesInconnues: lu.attaquesInconnues,
          armee: lu.armee,
          trajet,
          automatique: lu.automatique,
          champsGardes: garde,
        });
        if (!garde) CommerceFzzz.avisCapacite(refait);
      })
      .catch((err) => {
        if (jeton != CommerceFzzz._jetonRecolte) return;
        Journal.erreur(
          "Convois",
          "remplissage avant la récolte : remplissage habituel",
          err && err.message,
        );
        CommerceFzzz.avisCapacite(ecrit);
      });
  }
  /**
   * Détail du remplissage avant la récolte, noté au journal de débug (la
   * notification ne dit que la réduction faute d'ouvrières, avisCapacite).
   *
   * @static
   * @method messageRecolte
   * @param {Object} calcul résultat de libresAvantRecolte
   * @param {Number} habituelles ouvrières libres du remplissage habituel
   * @param {Object} d {reduit, automatique, armee (page Armée lue : vrai,
   *   illisible : faux, pas lue : null), inconnues, envoi (ms, convoi à lancer
   *   avant, ou null), garde}
   * @return {String}
   */
  static messageRecolte(calcul, habituelles, d) {
    let n = (x) => numeral(x).format(),
      mot = (x, singulier) => (x >= 2 ? singulier + "s" : singulier),
      ecart = calcul.libres - habituelles,
      gains = [
        calcul.gagne ? `${n(calcul.gagne)} cm² de chasses` : "",
        calcul.attaques ? `${n(calcul.attaques)} cm² de tes floods` : "",
      ]
        .filter(Boolean)
        .join(" et "),
      texte;
    if (calcul.recolte == null)
      texte =
        "Le convoi revient au moins une minute avant la prochaine récolte : toutes tes ouvrières présentes peuvent partir.";
    else {
      let heure = moment(calcul.recolte).format("HH[h]mm");
      texte =
        ecart > 0
          ? `Récolte de ${heure} : ${n(ecart)} ${mot(ecart, "ouvrière")} de plus pour le convoi (comptées : ${n(calcul.revenues)} de retour de convoi${gains ? ` ; terrain gagné d'ici là : ${gains}` : ""}).`
          : ecart < 0
            ? `Récolte de ${heure} : ${n(-ecart)} ${mot(-ecart, "ouvrière")} de moins pour le convoi, ${mot(-ecart, "gardée")} pour exploiter ton terrain${gains ? ` (${gains} compris)` : ""}.`
            : `Récolte de ${heure} : pas d'ouvrière de plus pour le convoi.`;
    }
    if (d.garde) texte += " Champs du convoi changés entre-temps : non réécrits.";
    else {
      if (d.reduit) texte += " " + d.reduit;
      if (d.envoi)
        texte += ` Valable si tu lances le convoi d'ici ${moment(d.envoi).format("HH[h]mm")}.`;
    }
    if (ecart > 0 && !d.automatique)
      texte +=
        " Sans affectation automatique des ouvrières (Compte+ réglé sur Nourriture ou Matériaux, page Ressources), affecte toi-même celles qui arrivent avant chaque récolte.";
    if (d.armee === false)
      texte += " Page Armée illisible : le terrain de tes floods en cours n'est pas compté.";
    else if (d.inconnues)
      texte += ` ${n(d.inconnues)} ${mot(d.inconnues, "flood")} en cours sans troupes connues : ${d.inconnues > 1 ? "leur" : "son"} terrain n'est pas compté.`;
    return texte;
  }
  /**
   * Ouvrières qui peuvent partir en convoi sans laisser de terrain inexploité
   * (une ouvrière par cm²), formule du mainteneur, à chaque récolte où le
   * convoi envoyé est dehors : A + B − E − F, A les ouvrières présentes, B
   * celles d'un convoi qui rentre au moins une minute avant la récolte, E le
   * TdC, F le terrain de mes chasses et de mes floods arrivés avant la récolte.
   * Les floods reçus et les pontes ne comptent pas (prudence). Le plus petit
   * résultat, entre 0 et A ; aucune récolte avant le retour du convoi : A.
   *
   * @static
   * @method libresAvantRecolte
   * @param {Object} d
   * @param {Number} d.presentes A
   * @param {Number} d.terrain E
   * @param {Number} d.recolte la prochaine récolte (ms, horloge du serveur), les suivantes de 30 en 30 min
   * @param {Number} [d.maintenant] récoltes passées ignorées
   * @param {Array} [d.retours] [{retour (ms), ouvrieres}]
   * @param {Array} [d.chasses] [{arrivee (ms), terrain (cm²)}]
   * @param {Array} [d.attaques] mes floods, comme d.chasses (prise de la synthèse)
   * @param {Number|null} [d.retourConvoi] retour du convoi envoyé (ms) ; inconnu : toutes les récoltes jusqu'à la dernière arrivée connue
   * @return {{libres: Number, recolte: Number|null, revenues: Number, gagne: Number, attaques: Number}} la récolte qui limite (null : aucune) et ce qui y compte (gagne : terrain des chasses, attaques : celui des floods)
   */
  static libresAvantRecolte(d) {
    let retours = d.retours || [],
      chasses = d.chasses || [],
      attaques = d.attaques || [],
      revenues = (/** @type {Number} */ h) =>
        retours.reduce((s, r) => s + (r.retour < h - RECOLTE_AVANCE_RETOUR ? r.ouvrieres : 0), 0),
      gain = (/** @type {Array} */ liste, /** @type {Number} */ h) =>
        liste.reduce((s, c) => s + (c.arrivee < h ? c.terrain : 0), 0),
      // dernière récolte où le convoi envoyé est encore dehors (il ne rentre pas
      // une minute avant) ; sans son retour, celle qui suit la dernière arrivée
      derniere =
        d.retourConvoi != null
          ? d.retourConvoi + RECOLTE_AVANCE_RETOUR
          : Math.max(
              d.recolte,
              ...retours.map((r) => r.retour + RECOLTE_AVANCE_RETOUR),
              ...chasses.map((c) => c.arrivee),
              ...attaques.map((c) => c.arrivee),
            ) + RECOLTE_PERIODE,
      h = d.recolte,
      limite = null;
    if (d.maintenant > h) h += Math.ceil((d.maintenant - h) / RECOLTE_PERIODE) * RECOLTE_PERIODE;
    for (let k = 0; k < RECOLTES_EXAMINEES_MAX && h <= derniere; k++, h += RECOLTE_PERIODE) {
      let r = revenues(h),
        g = gain(chasses, h),
        a = gain(attaques, h),
        libres = d.presentes + r - d.terrain - g - a;
      if (!limite || libres < limite.libres)
        limite = { libres, recolte: h, revenues: r, gagne: g, attaques: a };
    }
    if (!limite) return { libres: d.presentes, recolte: null, revenues: 0, gagne: 0, attaques: 0 };
    limite.libres = Math.max(0, Math.min(d.presentes, limite.libres));
    return limite;
  }
  /**
   * Convois que je livre, d'après la page Convois : retour à la fin du compte
   * à rebours du jeu (« dans … », le même instant que son « Retour le » en
   * Compte+) et ouvrières qui le portent. Seuls ceux encore partis à `depuis`
   * (lecture de la page Ressources, qui donne les ouvrières présentes)
   * comptent : un convoi revenu avant est déjà parmi les présentes. Pour un
   * retour dans la minute de cette lecture, seul le compte à rebours dit s'il
   * était déjà revenu : la minute « Retour le » ne le dit pas.
   *
   * @static
   * @method retoursConvois
   * @param {Number} depuis ms
   * @param {Number} parOuvriere ressources portées par une ouvrière
   * @param {Number} [maintenant] ms, heure du serveur des comptes à rebours affichés
   * @return {Array} [{retour (ms), ouvrieres}]
   */
  static retoursConvois(depuis, parOuvriere, maintenant = Horloge.maintenant()) {
    let nombre = (t) => parseInt(String(t).replace(/\D/g, "")) || 0;
    return CommerceFzzz.lignes()
      .get()
      .map((elt) => {
        let texte = CommerceFzzz.texte(elt),
          m = texte.match(LIGNE_CONVOI_ENVOYE),
          compte = texte.match(/\bdans\s+(.+?)(?:\s+-|$)/i),
          arrivee = compte ? maintenant + Utils.timeToInt(compte[1]) * 1000 : null,
          retour = CommerceFzzz.texteRetour(elt),
          minuteJeu = retour == null ? null : CommerceFzzz.minuteRetour(retour, depuis);
        if (!m || (arrivee == null && minuteJeu == null)) return null;
        let parti =
          arrivee != null
            ? arrivee > depuis + RECOLTE_MARGE_RETOUR &&
              !(minuteJeu != null && minuteJeu + RECOLTE_RETOUR_PASSE <= depuis)
            : /** @type {Number} */ (minuteJeu) >= depuis;
        if (!parti) return null;
        return {
          // sans compte à rebours, la fin de la minute « Retour le » (au plus tard)
          retour: arrivee != null ? arrivee : /** @type {Number} */ (minuteJeu) + 59999,
          ouvrieres: Math.ceil((nombre(m[1]) + nombre(m[2])) / parOuvriere),
        };
      })
      .filter(Boolean);
  }
  /**
   * Texte « Retour le … » écrit par le jeu après la ligne d'un convoi
   * (Compte+), pas celui qu'ajoute l'extension sans Compte+ (l'heure
   * d'arrivée, dans un <span>).
   *
   * @static
   * @method texteRetour
   * @param {Element} elt <strong> du convoi
   * @return {String|null}
   */
  static texteRetour(elt) {
    for (let n = elt.nextSibling; n && n.nodeName != "BR"; n = n.nextSibling)
      if (n.nodeName == "SMALL" && /Retour le/i.test(n.textContent)) return n.textContent;
    return null;
  }
  /**
   * Début de la minute « Retour le 25 oct. à 15h32 » (heure du serveur) ;
   * sans année, celle qui place la date au plus près de `maintenant`.
   *
   * @static
   * @method minuteRetour
   * @param {String} texte
   * @param {Number} maintenant ms
   * @return {Number|null}
   */
  static minuteRetour(texte, maintenant) {
    let m = String(texte)
      .replace(/\s+/g, " ")
      .match(/Retour le (\d{1,2}) ([a-zà-ÿ]+)\.? (?:(\d{4}) )?à (\d{1,2})h(\d{2})/i);
    if (!m) return null;
    let mois = MOIS_EN_LETTRES[m[2].toLowerCase()];
    if (mois == null) return null;
    let date = (an) =>
        moment({
          year: an,
          month: mois,
          date: parseInt(m[1]),
          hour: parseInt(m[4]),
          minute: parseInt(m[5]),
        }).valueOf(),
      an = moment(maintenant).year();
    if (m[3]) return date(parseInt(m[3]));
    return [an - 1, an, an + 1]
      .map(date)
      .reduce((a, b) => (Math.abs(b - maintenant) < Math.abs(a - maintenant) ? b : a));
  }
  /**
   * Pages Ressources puis Armée lues pour le remplissage avant la récolte,
   * gardées une minute pour les clics suivants. La page Armée n'est lue que si
   * l'encart Compte+ montre des attaques en cours, ou sans lui.
   *
   * @static
   * @method lireRecolte
   * @return {Promise} voir analyserRecolte, plus {attaques, attaquesInconnues, armee}
   */
  static lireRecolte() {
    let garde = CommerceFzzz._recolteLue;
    if (garde && Horloge.maintenant() - garde.instant < RECOLTE_VALIDITE_LECTURE)
      return Promise.resolve(garde);
    if (CommerceFzzz._recolteEnCours) return CommerceFzzz._recolteEnCours;
    let lire = (url) => {
      let avant = Horloge.maintenant();
      return Promise.resolve($.get(url)).then(
        (html) => ({ html: String(html), avant, apres: Horloge.maintenant() }),
        (jqXHR) => {
          throw new Error(
            jqXHR && jqXHR.status == 503
              ? "le jeu traitait une autre action"
              : jqXHR && jqXHR.statusText == "timeout"
                ? "pas de réponse du jeu"
                : `erreur ${(jqXHR && jqXHR.status) || "réseau"}`,
          );
        },
      );
    };
    let fin = () => (CommerceFzzz._recolteEnCours = null),
      attaques =
        !Utils.comptePlus || (parseInt($("#ligne_attaque strong").first().text()) || 0) > 0;
    return (CommerceFzzz._recolteEnCours = lire("/Ressources.php")
      .then((ressources) => {
        let lu = CommerceFzzz.analyserRecolte(ressources);
        return (
          attaques
            ? lire("/Armee.php").then(
                (armee) => CommerceFzzz.attaquesArmee(armee.html, lu.chassesLues),
                () => ({ liste: [], inconnues: 0, lue: false }),
              )
            : Promise.resolve({ liste: [], inconnues: 0, lue: null })
        ).then((a) => {
          let resultat = {
            ...lu,
            attaques: a.liste,
            attaquesInconnues: a.inconnues,
            armee: a.lue,
          };
          CommerceFzzz._recolteLue = resultat;
          return resultat;
        });
      })
      .finally(fin));
  }
  /**
   * Page Ressources lue au clic : prochaine récolte (prise au plus tôt, depuis
   * l'envoi de la demande), ouvrières présentes (A) et TdC (E) du bloc du
   * joueur, chasses en cours.
   *
   * @static
   * @method analyserRecolte
   * @param {Object} ressources {html, avant, apres (ms)}
   * @return {Object} {recolte, presentes, terrain, chasses [{arrivee, terrain}],
   *   chassesLues (PageRessource.lireChasses), automatique, instant}
   */
  static analyserRecolte(ressources) {
    let $ressources = Utils.parseHtml(ressources.html),
      secondes = (ressources.html.match(/reste\(\s*(\d+)\s*,\s*["']retour_ouvrieres["']/) || [])[1],
      nombre = ($page, selecteur) =>
        parseInt($page.find(selecteur).first().text().replace(/[^\d]/g, ""));
    if (secondes == null || !$ressources.find("#retour_ouvrieres").length)
      throw new Error("heure de la récolte absente de la page Ressources");
    let presentes = nombre($ressources, "#nb_ouvrieres"),
      terrain = nombre($ressources, "#quantite_tdc");
    if (isNaN(presentes) || isNaN(terrain))
      throw new Error("ouvrières ou TdC absents de la page Ressources");
    let lues = PageRessource.lireChasses($ressources);
    if (lues.length < (ressources.html.match(/Vos chasseuses vont conquérir/g) || []).length)
      throw new Error("chasses en cours illisibles");
    let choix = $ressources.find("input[name=choixOuvriere]:checked").val();
    return {
      recolte: ressources.avant + parseInt(secondes) * 1000,
      presentes,
      terrain,
      chasses: lues.map((c) => ({ arrivee: c.arrivee.valueOf(), terrain: c.terrain })),
      chassesLues: lues,
      automatique: choix == "nourriture" || choix == "materiaux",
      instant: ressources.apres,
    };
  }
  /**
   * Terrain que prendront mes floods en cours (liste du jeu d'une page Armée) :
   * la prise de la synthèse, calculée comme dans « Mes attaques en cours »
   * (AttaqueLancee.mouvements, mes chasses déjà lues), sinon ses troupes, le
   * plus qu'il puisse prendre. Le dôme et la loge prennent le TdC comme le
   * terrain de chasse.
   *
   * @static
   * @method attaquesArmee
   * @param {String} html page Armée
   * @param {Array} chassesLues mes chasses (PageRessource.lireChasses)
   * @return {Promise<{liste: Array, inconnues: Number, lue: Boolean}>} liste
   *   [{arrivee (ms), terrain}] ; inconnues : floods sans prise ni troupes
   *   connues ; lue : faux si ce n'est pas une page Armée
   */
  static attaquesArmee(html, chassesLues) {
    // page de connexion ou autre : floods inconnus, signalé dans le message
    if (!/Troupes en Garnison/i.test(html))
      return Promise.resolve({ liste: [], inconnues: 0, lue: false });
    let captures = AttaqueLancee.charger(),
      attaques = AttaqueLancee.extraireLignes(Utils.parseHtml(html))
        // un renfort n'a pas de cible
        .filter((l) => l.cible)
        .map((l) => ({ ligne: l, capture: captures.find((c) => c.id == l.id) || null }));
    if (!attaques.length) return Promise.resolve({ liste: [], inconnues: 0, lue: true });
    return AttaqueLancee.mouvements(attaques, null, chassesLues).then((mouvements) => {
      let liste = [],
        inconnues = 0;
      attaques.forEach((a) => {
        let e = mouvements.floods[a.ligne.id],
          unites = Object.values(
            a.ligne.troupesNatif
              ? AttaqueLancee.uniteNatif(a.ligne.troupesNatif)
              : (a.capture && a.capture.unite) || {},
          ).reduce((s, n) => s + (n || 0), 0),
          terrain = e && e.prise != null ? e.prise : unites || null;
        if (terrain == null) inconnues++;
        else liste.push({ arrivee: a.ligne.arrivee.valueOf(), terrain });
      });
      return { liste, inconnues, lue: true };
    });
  }
  /**
   * Bloc « Récapitulatif » sous les convois en cours : pour chaque membre
   * suivi, temps de trajet (avec la Vitesse d'attaque), heure de retour d'un
   * convoi lancé maintenant, et reste à livrer d'après le site de suivi de l'alliance
   * (lu une fois à l'ouverture, si le mot de passe est enregistré). Les
   * positions viennent du cache de la Carte de l'alliance, relu au clic sur
   * « Actualiser les positions » (PageAlliance.actualiserPositions).
   *
   * @static
   * @method membresSuivis
   */
  static membresSuivis() {
    // fait pour le site de suivi de l'alliance (« Convoi à faire »)
    if (!OuafSuivi.site() || !Utils.affichage("convoisMembres") || $("#o_convoisMembres").length)
      return;
    let cache = Utils.lireStockage(`outiiil_carteAlliance_${Utils.serveur}_${Utils.alliance}`),
      connus = {};
    (cache.members || []).forEach((m) => {
      if (m.pseudo && m.pseudo != monProfil.pseudo) connus[m.pseudo] = m;
    });
    let suivis = [];
    try {
      suivis = JSON.parse(localStorage.getItem(CLE_CONVOIS_MEMBRES)) || [];
    } catch (e) {}
    let enregistrer = () => {
        try {
          localStorage.setItem(CLE_CONVOIS_MEMBRES, JSON.stringify(suivis));
        } catch (e) {}
      },
      ouaf = { restes: null, etat: "attente", membres: [], sansReception: null, avances: null },
      barree = Utils.affichage("convoisSansReceptionBarree"),
      rouge = Utils.affichage("convoisSansReceptionRouge"),
      colonneStatut = Utils.affichage("convoisSansReceptionColonne"),
      deux = (n) => String(n).padStart(2, "0"),
      hms = (s) =>
        `${deux(Math.floor(s / 3600))}:${deux(Math.floor((s % 3600) / 60))}:${deux(s % 60)}`,
      trajet = (p) => (connus[p] ? OuafSuivi.trajet(p) : null),
      // clic : ce joueur en destinataire (voir plus bas) ; Ctrl+clic ou clic
      // du milieu : sa page, par le lien
      lien = (p) =>
        `<a href='Membre.php?Pseudo=${encodeURIComponent(p)}' class='o_convoisMembreDestinataire' title='Clic : convoi vers ${Utils.echapper(p)} (Ctrl+clic : sa page)'>${Utils.echapper(p)}</a>`,
      // site pas encore lu, sans mot de passe ou en erreur : même cellule pour toutes ses colonnes
      provisoire = () =>
        ouaf.etat == "attente"
          ? "<span class='small'>…</span>"
          : ouaf.etat == "code"
            ? "<span class='small' title='Mot de passe du site de suivi à renseigner dans Préférences → Convois'>—</span>"
            : ouaf.etat == "erreur"
              ? `<span class='small' title='${Utils.echapper(ouaf.erreur || "")}'>?</span>`
              : null,
      // vrai : ne veut pas de convois ; indéfini : le site ne le dit pas (aucune ligne vers lui)
      refuse = (p) => (ouaf.sansReception ? ouaf.sansReception.get(p.toLowerCase()) : undefined),
      statut = (p) => {
        let r = refuse(p),
          a = avance(p),
          mot = a
            ? `<span class='o_convoisAvanceStatut' title='A demandé une avance de ${numeral(a).format()} sur le site de suivi (page Avances)'>Avance</span>`
            : "";
        if (provisoire()) return provisoire();
        if (r === true)
          return `<span class='o_convoisPlein' title='${TITRE_SANS_RECEPTION}'>⚠️ Plein ⚠️</span>${mot ? " " + mot : ""}`;
        if (mot) return mot;
        if (r == null)
          return "<span class='small' title='Aucun convoi prévu vers ce joueur sur le site de suivi : son choix n&#39;y est pas donné'>—</span>";
        return "<span title='Accepte les convois (site de suivi)'>✅</span>";
      },
      // avance demandée sur la page Avances du site, montrée après le convoi à faire
      avance = (p) => (!provisoire() && ouaf.avances ? ouaf.avances.get(p.toLowerCase()) || 0 : 0),
      reste = (p) => {
        if (provisoire()) return provisoire();
        let r = ouaf.restes.get(p.toLowerCase()),
          a = avance(p),
          montant =
            r == null
              ? "<span class='small' title='Aucun convoi prévu vers ce joueur sur le site de suivi'>—</span>"
              : r > 0
                ? `<a href='#' class='o_convoisMembreMontant' data-montant='${Math.round(r)}' title='Clic : ${Utils.echapper(p)} en destinataire et ce montant en matériaux (au plus ton stock)'>${numeral(r).format()}</a>`
                : numeral(r).format();
        return a
          ? `<span class='o_convoisReste'>${montant}</span> <span class='o_convoisAvance' title='Avance demandée par ${Utils.echapper(p)} sur le site de suivi (page Avances) : ${numeral(a).format()}'>(+${numeral(a).format()})</span>`
          : montant;
      },
      choix = () => {
        let libres = [...new Set([...Object.keys(connus), ...ouaf.membres])]
          .filter((p) => p && p != monProfil.pseudo && !suivis.includes(p))
          .sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
        return `<select class='o_convoisMembreChoix'><option value=''>— choisir un membre —</option>${libres.map((p) => `<option value='${Utils.echapper(p)}'>${Utils.echapper(p)}</option>`).join("")}</select>`;
      },
      ligne = (p) => {
        if (!p)
          return `<tr class='o_convoisMembreVide'><td>${choix()}</td><td>—</td>${colonneStatut ? "<td>—</td>" : ""}<td>—</td><td>—</td><td></td></tr>`;
        let t = trajet(p),
          marques =
            refuse(p) === true
              ? [barree && "o_convoisBarree", rouge && "o_convoisRouge"].filter(Boolean)
              : [];
        return `<tr data-pseudo='${Utils.echapper(p)}'${marques.length ? ` class='${marques.join(" ")}' title='${TITRE_SANS_RECEPTION}'` : ""}><td>${lien(p)}</td>
          <td${avance(p) ? " class='o_convoisAvecAvance'" : ""}>${reste(p)}</td>
          ${colonneStatut ? `<td class='o_convoisMembreStatut'>${statut(p)}</td>` : ""}
          <td>${t == null ? "<span class='small' title='Position inconnue : « Actualiser les positions » en bas de ce tableau'>?</span>" : hms(t)}</td>
          <td class='o_convoisMembreRetour'>${t == null ? "—" : Horloge.clic().add(t, "s").format("DD/MM HH:mm")}</td>
          <td><span class='o_convoisMembreRetirer' title='Ne plus suivre ce membre'>✕</span></td></tr>`;
      },
      // encadré à part, comme « Organiser un convoi » : bien distinct des convois en cours
      $bloc = $(`<div id='o_convoisMembres' class='boite_amelioration simulateur centre'>
          <div class='o_convoisMembresTitre'><span class='titre'>Récapitulatif</span></div>
          <div class='o_convoisMembresDefile'><table class='o_convoisMembres o_maxWidth centre' cellspacing='0'>
            <thead><tr><th data-tri='joueur'>Joueur&nbsp;<span class='o_triIcone'></span></th><th data-tri='reste' title='Convoi restant à livrer (site de suivi)'>Convoi à faire&nbsp;<span class='o_triIcone'></span></th>${colonneStatut ? "<th title='⚠️ Plein ⚠️ : ne veut pas de convois (case du site de suivi) ; ✅ : en accepte ; Avance : a demandé une avance sur le site ; — : le site ne le dit pas'>Statut des stocks</th>" : ""}<th data-tri='trajet'>Temps de trajet&nbsp;<span class='o_triIcone'></span></th><th data-tri='retour' title='Horaire de retour d&#39;un convoi lancé maintenant'>Horaire de retour&nbsp;<span class='o_triIcone'></span></th><th></th></tr></thead>
            <tbody></tbody>
            <tfoot><tr><td colspan='${colonneStatut ? 6 : 5}'><a href='#' id='o_convoisMembreAjouter'>+ Ajouter un membre à suivre</a><a href='#' class='o_convoisPositions' title='Relit les positions des membres de l&#39;alliance, comme « Charger / Actualiser » de la Carte (un nouveau membre, une fourmilière déplacée)'>Actualiser les positions</a></td></tr></tfoot>
          </table></div>
          ${Object.keys(connus).length ? "" : "<p class='small o_convoisPositionsInconnues'>Positions des membres inconnues : « Actualiser les positions » en bas de ce tableau.</p>"}
          <p class='o_convoisLienOuaf'><a href='${Utils.echapper(OuafSuivi.site().url)}' target='_blank' rel='noopener' title='Ouvre le site de suivi, connecté avec le mot de passe enregistré (Préférences → Convois)'>Ouvrir le site de suivi des convois</a></p>
        </div>`),
      // tri par colonne : croissant, décroissant, puis ordre d'ajout (col null) ;
      // un tri gardé sur une colonne que le tableau n'a plus est ignoré
      tri = (() => {
        let colonnes = $bloc
            .find("th[data-tri]")
            .map((i, th) => th.dataset.tri)
            .get(),
          garde = Utils.lireStockage(CLE_TRI_CONVOIS, null);
        return garde && colonnes.includes(garde.col) && (garde.sens == 1 || garde.sens == -1)
          ? { col: garde.col, sens: garde.sens }
          : { col: null, sens: 1 };
      })(),
      valeurTri = (p) =>
        tri.col == "joueur"
          ? p.toLowerCase()
          : tri.col == "reste"
            ? ouaf.restes
              ? (ouaf.restes.get(p.toLowerCase()) ?? null)
              : null
            : trajet(p),
      ordonnes = () =>
        !tri.col
          ? suivis
          : suivis.slice().sort((a, b) => {
              let x = valeurTri(a),
                y = valeurTri(b);
              // valeur inconnue (« ? », « — ») toujours en bas
              if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1;
              return tri.sens * (typeof x == "string" ? x.localeCompare(y, "fr") : x - y);
            }),
      icones = () =>
        $bloc.find("th[data-tri]").each((i, th) => {
          let actif = th.dataset.tri == tri.col;
          $(th)
            .find(".o_triIcone")
            .text(actif ? (tri.sens > 0 ? "▲" : "▼") : "⇅")
            .toggleClass("o_triActif", actif)
            .attr(
              "title",
              actif
                ? tri.sens > 0
                  ? "Trié croissant : clic pour décroissant"
                  : "Trié décroissant : clic pour l'ordre d'origine"
                : "Trier par ordre croissant",
            );
        }),
      // « Actualiser les positions » seulement quand un temps de trajet est
      // inconnu faute de position (demande du mainteneur)
      majPositions = () => {
        let inconnus = suivis.some((p) => trajet(p) == null);
        $bloc.find(".o_convoisPositions:not(.o_enCours)").toggle(inconnus);
        $bloc.find(".o_convoisPositionsInconnues").toggle(inconnus);
      },
      afficher = () => {
        let vides = $bloc.find(".o_convoisMembreVide").length || (suivis.length ? 0 : 1);
        $bloc
          .find("tbody")
          .html(ordonnes().map(ligne).join("") + Array(vides).fill(ligne("")).join(""));
        icones();
        majPositions();
      };
    // sous les convois en cours (dernier élément de la section)
    let $titre = $("#centre > h3").filter((i, e) => $(e).text().includes("Convois en cours")),
      $section = $titre.first().nextUntil("h3").addBack();
    if ($titre.length) $bloc.insertAfter($section.last());
    else $("#centre").append($bloc);
    afficher();
    CommerceFzzz.calerSurCadreConvoi($bloc);
    $(window).on("resize", () => CommerceFzzz.calerSurCadreConvoi($bloc));
    $bloc.on("click", ".o_triIcone", (e) => {
      let col = $(e.currentTarget).closest("th").data("tri");
      if (tri.col != col) Object.assign(tri, { col, sens: 1 });
      else if (tri.sens > 0) tri.sens = -1;
      else Object.assign(tri, { col: null, sens: 1 });
      try {
        if (tri.col) localStorage.setItem(CLE_TRI_CONVOIS, JSON.stringify(tri));
        else localStorage.removeItem(CLE_TRI_CONVOIS);
      } catch (err) {}
      afficher();
    });
    // destinataire (et montant en matériaux) écrits sans recharger la page ; le
    // joueur valide lui-même
    let preparer = (pseudo, montant = null) => {
      CommerceFzzz.remplirDestinataire(pseudo);
      if (montant != null) CommerceFzzz.remplirMateriaux(montant, trajet(pseudo));
    };
    $bloc.on("click", ".o_convoisMembreDestinataire", (e) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
      e.preventDefault();
      preparer(String($(e.currentTarget).closest("tr").data("pseudo")));
    });
    $bloc.on("click", ".o_convoisMembreMontant", (e) => {
      e.preventDefault();
      preparer(
        String($(e.currentTarget).closest("tr").data("pseudo")),
        parseInt($(e.currentTarget).data("montant")) || 0,
      );
    });
    $bloc.on("change", ".o_convoisMembreChoix", (e) => {
      let p = String($(e.currentTarget).val() || "");
      if (!p || suivis.includes(p)) return;
      $(e.currentTarget).closest("tr").remove();
      suivis.push(p);
      enregistrer();
      afficher();
    });
    $bloc.on("click", ".o_convoisMembreRetirer", (e) => {
      let p = String($(e.currentTarget).closest("tr").data("pseudo"));
      suivis = suivis.filter((x) => x != p);
      enregistrer();
      afficher();
    });
    // connexion faite par l'extension (cookie de session du site), puis le
    // site s'ouvre déjà connecté ; l'onglet est ouvert au clic pour ne pas
    // être bloqué comme fenêtre surgissante
    $bloc.find(".o_convoisLienOuaf a").on("click", (e) => {
      e.preventDefault();
      let onglet = window.open("about:blank", "_blank"),
        ouvrir = () => {
          if (onglet) {
            onglet.opener = null;
            onglet.location.href = OuafSuivi.site().url;
          } else window.open(OuafSuivi.site().url, "_blank", "noopener");
        };
      OuafSuivi._connecter().then(ouvrir, (err) => {
        ouvrir();
        $.toast({
          ...TOAST_WARNING,
          text:
            err.name == "code"
              ? "Mot de passe du site de suivi à enregistrer dans Préférences → Convois : connecte-toi sur le site."
              : "Connexion automatique impossible : connecte-toi sur le site.",
        });
      });
    });
    $bloc.find("#o_convoisMembreAjouter").on("click", (e) => {
      e.preventDefault();
      if ($bloc.find(".o_convoisMembreVide").length) return;
      $bloc.find("tbody").append(ligne(""));
    });
    // positions relues au clic seulement (règles s5), comme le bouton de la Carte
    $bloc.on("click", ".o_convoisPositions", (e) => {
      e.preventDefault();
      let $lien = $(e.currentTarget);
      if ($lien.hasClass("o_enCours")) return;
      $lien.addClass("o_enCours").text("Actualisation des positions…");
      PageAlliance.actualiserPositions((faits, total) =>
        $lien.text(`Actualisation des positions… (${faits}/${total})`),
      )
        .then(
          ({ members }) => {
            for (let p in connus) delete connus[p];
            members.forEach((m) => {
              if (m.pseudo && m.pseudo != monProfil.pseudo) connus[m.pseudo] = m;
            });
            $bloc.find(".o_convoisPositionsInconnues").remove();
            afficher();
          },
          (err) =>
            $.toast({
              ...TOAST_ERROR,
              text: `Positions non mises à jour : ${Utils.echapper((err && err.message) || "lecture impossible")}`,
            }),
        )
        .then(() => {
          $lien.removeClass("o_enCours").text("Actualiser les positions");
          majPositions();
        });
    });
    // heure de retour : recalculée toutes les 30 s (affichage seulement)
    setInterval(() => {
      $bloc.find("tr[data-pseudo]").each((i, tr) => {
        let t = trajet(String($(tr).data("pseudo")));
        if (t != null)
          $(tr)
            .find(".o_convoisMembreRetour")
            .text(Horloge.clic().add(t, "s").format("DD/MM HH:mm"));
      });
    }, 30000);
    // reste à livrer et demandes d'avance : une lecture du site à l'ouverture de
    // la page, puis après chaque convoi que le joueur y enregistre
    // (EVENEMENT_CONVOI_ENREGISTRE) ; sans les demandes, le reste s'affiche quand même
    let lireSite = () =>
      OuafSuivi.lireCode().then((code) => {
        if (!code) {
          ouaf.etat = "code";
          return afficher();
        }
        OuafSuivi.lireDemandesAvance().then(
          (avances) => {
            ouaf.avances = avances;
            afficher();
          },
          (e) => Journal.info("Convois", "demandes d'avance du site non lues", e && e.message),
        );
        return OuafSuivi.mesConvois().then(
          (r) => {
            Object.assign(ouaf, {
              etat: "ok",
              restes: r.restes,
              membres: r.membres,
              sansReception: r.sansReception,
            });
            afficher();
          },
          (e) => {
            Object.assign(ouaf, {
              etat: "erreur",
              erreur:
                e.name == "permission"
                  ? "Accès au site de suivi non accordé (bouton « Autoriser l'accès » en envoyant un convoi au suivi)"
                  : e.name == "reseau"
                    ? OUAF_PANNE
                    : e.name == "session"
                      ? e.message
                      : "Site de suivi des convois : " + e.message,
            });
            afficher();
            CommerceFzzz.signalerSuiviOuaf(ouaf.erreur);
          },
        );
      });
    lireSite();
    $(document).on(EVENEMENT_CONVOI_ENREGISTRE, () => lireSite());
  }
  /**
   * Premier envoi sans mot de passe : ouvre Préférences → Convois, sur le champ
   * du mot de passe du site de suivi.
   *
   * @static
   * @method ouvrirParametresOuaf
   */
  static ouvrirParametresOuaf() {
    $.toast({
      ...TOAST_INFO,
      text: "Renseigne d'abord le mot de passe du site de suivi (Préférences → Convois), puis relance l'envoi.",
      hideAfter: 8000,
    });
    BoiteParametre.ouvrirOnglet("Convois");
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
