/*
 * CommerceFzzz.js
 * NumeroBis-boop
 **********************************************************************/

// pseudos suivis dans le bloc « Récapitulatif », dans l'ordre d'ajout
const CLE_CONVOIS_MEMBRES = "fzzz_convoisMembres";
// tri du « Récapitulatif » : gardé tant qu'on reste sur la page Convois
// (envoi d'un convoi = rechargement), oublié au chargement d'une autre page
const CLE_TRI_CONVOIS = "fzzz_triConvoisMembres";
const OUAF_PANNE =
  "Le site de suivi OUAF ne répond pas : « Convoi à faire » et « 📤 Envoyer au suivi » sont indisponibles pour l'instant. Réessaie plus tard.";
// le jeu produit 48 récoltes par jour (production du jour = récolte × 48)
const RECOLTE_PERIODE = 30 * 60000;
// terrain d'une chasse compté s'il change jusqu'à deux minutes après une récolte :
// minute du RC à une minute près, plus le délai de lecture de la page
const RECOLTE_MARGE_CHASSE = 2 * 60000;
const RECOLTES_EXAMINEES_MAX = 48 * 14;
// pages Ressources et Reine relues au plus une fois par minute (clics successifs)
const RECOLTE_VALIDITE_LECTURE = 60000;

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
   * « Convois en cours: » et commencent par « - », ou déjà rangés en deux
   * colonnes (CommerceFzzz.colonnes).
   *
   * @static
   * @method lignes
   */
  static lignes() {
    let $titre = $("#centre > h3").filter((i, e) => $(e).text().includes("Convois en cours"));
    if (!$titre.length) return $();
    let $section = $titre.first().nextUntil("h3");
    return $section
      .filter("strong")
      .filter((i, e) => /^\s*-/.test($(e).text()) && $(e).text().includes("dans"))
      .add($section.filter(".o_convois").find(".o_convoiTexte > strong:first-child"));
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
    // tableau plus large que le cadre (téléphone) : débord réparti des deux côtés
    let deborde = $bloc.outerWidth() - r.width;
    if (deborde > 0) $bloc.css("marginLeft", `${Math.max(0, gauche - deborde / 2)}px`);
  }
  /**
   * Devant chaque convoi envoyé, son état d'après le sujet « Convois » du forum
   * de l'alliance, seule référence : « ✅ Enregistré » s'il y est noté, sinon
   * un bouton « 📤 Envoyer au suivi », qui le transmet au site de suivi puis le
   * note dans le sujet. Transmis mais pas noté (écriture du forum en échec) :
   * bouton « 📝 Noter dans le forum », qui ne renvoie rien au site. Le mot de
   * passe du site se renseigne seulement dans Préférences → Grenier. L'état va
   * dans une colonne à part (CommerceFzzz.colonnes).
   *
   * @static
   * @method suiviOuaf
   */
  static suiviOuaf() {
    if (!Utils.affichage("convoisSuiviLignes") || $(".o_ouafLigne").length) return;
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
            `${NOM_EXTENSION} n'a pas encore accès à ouafchaine.fr. <button type='button' id='o_ouafAcces' class='o_button f_info'>Autoriser l'accès</button> puis relance l'envoi.`,
            TOAST_WARNING,
          );
          $(document)
            .off("click.ouafAcces")
            .on("click.ouafAcces", "#o_ouafAcces", () => OuafSuivi.demanderAcces());
        } else if (e.name == "code") CommerceFzzz.ouvrirParametresOuaf();
        else if (e.name == "reseau") {
          CommerceFzzz.signalerSuiviOuaf(OUAF_PANNE);
          toast(
            `Le site de suivi OUAF ne répond pas : rien n'a été envoyé, réessaie plus tard. Si <a href='${OUAF_SITE}' target='_blank' rel='noopener'>${OUAF_SITE.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a> s'ouvre normalement dans un onglet, c'est ton navigateur qui le bloque (Firefox, mode « HTTPS uniquement » : choisis « Continuer vers le site HTTP »).`,
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
   * « convoisAvantRecolte » : le calcul est refait avec les ouvrières qui
   * arrivent avant chaque récolte (remplirAvantRecolte).
   *
   * @static
   * @method remplirMateriaux
   * @param {Number} du montant restant à livrer
   */
  static remplirMateriaux(du) {
    if (!$("#input_nbMateriaux").length) return;
    let total = Utils.ouvrieres,
      libres = total - Math.min(total, Utils.terrain || 0),
      avantRecolte = !!monProfil.parametre?.["convoisAvantRecolte"]?.valeur,
      ecrit = CommerceFzzz.ecrireConvoi(du, libres);
    if (!avantRecolte) {
      if (ecrit.reduit) $.toast({ ...TOAST_INFO, text: ecrit.reduit });
      return;
    }
    CommerceFzzz.remplirAvantRecolte(du, libres, ecrit);
  }
  /**
   * Matériaux et ouvrières du convoi pour `libres` ouvrières disponibles.
   *
   * @static
   * @method ecrireConvoi
   * @param {Number} du montant restant à livrer
   * @param {Number} libres ouvrières qui peuvent partir
   * @return {{mat: String, ouvrieres: Number, reduit: String|null}} reduit : texte de la réduction des matériaux
   */
  static ecrireConvoi(du, libres) {
    let parOuvriere = 10 + monProfil.niveauConstruction[11] / 2,
      nou = Math.floor(parseFloat($("#nbNourriture").val())) || 0,
      mat = CommerceFzzz.montantMateriaux(du, Utils.materiaux, libres * parOuvriere - nou),
      ouvrieres = Math.ceil((parseInt(mat) + nou) / parOuvriere);
    $("#input_nbMateriaux").val(mat);
    $("#nbMateriaux").val(mat);
    $("#input_nbOuvriere").val(String(ouvrieres));
    $("#nbOuvriere").val(ouvrieres);
    return {
      mat,
      ouvrieres,
      reduit:
        parseInt(mat) < Math.floor(du)
          ? `Matériaux réduits à ${numeral(mat).format()} sur ${numeral(du).format()} : ${
              parseInt(mat) >= Utils.materiaux
                ? "stock"
                : "ouvrières à garder pour exploiter le terrain"
            }.`
          : null,
    };
  }
  /**
   * Remplissage refait avec les ouvrières qui reviennent de convoi ou sont
   * pondues avant chaque récolte (idée de KWHWWYMWN, option décochée par
   * défaut) : pages Ressources et Reine lues au clic. Les champs ne sont
   * réécrits que s'ils gardent les valeurs écrites au clic (le joueur a pu
   * les changer entre-temps) ; sans lecture possible, le remplissage habituel
   * reste.
   *
   * @static
   * @method remplirAvantRecolte
   * @param {Number} du montant restant à livrer
   * @param {Number} habituelles ouvrières libres du remplissage habituel
   * @param {Object} ecrit ce que ecrireConvoi a écrit au clic
   */
  static remplirAvantRecolte(du, habituelles, ecrit) {
    let jeton = (CommerceFzzz._jetonRecolte = (CommerceFzzz._jetonRecolte || 0) + 1),
      intacts = () =>
        $("#input_nbMateriaux").val() == ecrit.mat &&
        String($("#input_nbOuvriere").val()) == String(ecrit.ouvrieres);
    return CommerceFzzz.lireRecolte()
      .then((lu) => {
        if (jeton != CommerceFzzz._jetonRecolte) return;
        let parOuvriere = 10 + monProfil.niveauConstruction[11] / 2,
          calcul = CommerceFzzz.libresAvantRecolte({
            ...lu,
            retours: CommerceFzzz.plafonnerRetours(
              CommerceFzzz.retoursConvois(lu.instant, parOuvriere),
              lu.enConvoi,
            ),
            maintenant: Horloge.maintenant(),
          }),
          attaques = parseInt($("#ligne_attaque strong").first().text()) || 0,
          garde = !intacts(),
          refait = garde ? ecrit : CommerceFzzz.ecrireConvoi(du, calcul.libres);
        Journal.info("Convois", "remplissage avant la récolte", {
          recolte: moment(calcul.recolte).format("HH:mm:ss"),
          libres: calcul.libres,
          habituelles,
          presentes: lu.presentes,
          terrain: lu.terrain,
          revenues: calcul.revenues,
          pondues: calcul.pondues,
          chasses: calcul.gagne,
          automatique: lu.automatique,
          attaques,
          champsGardes: garde,
        });
        $.toast({
          ...TOAST_INFO,
          hideAfter: 12000,
          text: CommerceFzzz.messageRecolte(calcul, habituelles, {
            reduit: refait.reduit,
            automatique: lu.automatique,
            attaques,
            garde,
          }),
        });
      })
      .catch((err) => {
        if (jeton != CommerceFzzz._jetonRecolte) return;
        Journal.erreur("Convois", "remplissage avant la récolte", err && err.message);
        $.toast({
          ...TOAST_WARNING,
          hideAfter: 10000,
          text: `Ouvrières d'avant la récolte non comptées (${Utils.echapper((err && err.message) || "lecture impossible")}) : remplissage habituel.${ecrit.reduit ? " " + ecrit.reduit : ""}`,
        });
      });
  }
  /**
   * Message du remplissage avant la récolte.
   *
   * @static
   * @method messageRecolte
   * @param {Object} calcul résultat de libresAvantRecolte
   * @param {Number} habituelles ouvrières libres du remplissage habituel
   * @param {Object} d {reduit, automatique, attaques, garde}
   * @return {String}
   */
  static messageRecolte(calcul, habituelles, d) {
    let n = (x) => numeral(x).format(),
      mot = (x, singulier) => (x >= 2 ? singulier + "s" : singulier),
      heure = moment(calcul.recolte).format("HH[h]mm"),
      ecart = calcul.libres - habituelles,
      texte =
        ecart > 0
          ? `Récolte de ${heure} : ${n(ecart)} ${mot(ecart, "ouvrière")} de plus pour le convoi (comptées : ${n(calcul.revenues)} de retour de convoi, ${n(calcul.pondues)} ${mot(calcul.pondues, "pondue")} d'ici là).`
          : ecart < 0
            ? `Récolte de ${heure} : ${n(-ecart)} ${mot(-ecart, "ouvrière")} de moins pour le convoi, ${mot(-ecart, "gardée")} pour exploiter ton terrain${calcul.gagne ? ` (${n(calcul.gagne)} cm² de chasses compris)` : ""}.`
            : `Récolte de ${heure} : pas d'ouvrière de plus pour le convoi.`;
    if (d.garde) texte += " Champs du convoi changés entre-temps : non réécrits.";
    else if (d.reduit) texte += " " + d.reduit;
    if (ecart > 0 && !d.automatique)
      texte +=
        " Sans affectation automatique des ouvrières (Compte+ réglé sur Nourriture ou Matériaux, page Ressources), affecte toi-même celles qui arrivent avant chaque récolte.";
    if (d.attaques)
      texte += ` Le terrain que prendront tes ${n(d.attaques)} ${mot(d.attaques, "attaque")} en cours n'est pas compté.`;
    return texte;
  }
  /**
   * Ouvrières qui peuvent partir en convoi sans laisser de terrain inexploité
   * à une récolte à venir (une ouvrière par cm²) : à chaque récolte, les
   * présentes, plus celles revenues de convoi ou pondues dont la minute
   * d'arrivée est entière avant la récolte (règle du mainteneur), moins le
   * terrain d'alors, chasses comprises. Le minimum sur les récoltes, entre 0
   * et les présentes : valable quel que soit le retour du convoi envoyé.
   *
   * @static
   * @method libresAvantRecolte
   * @param {Object} d
   * @param {Number} d.presentes ouvrières à la fourmilière
   * @param {Number} d.terrain TdC
   * @param {Number} d.recolte une récolte (ms, horloge du serveur), les autres de 30 en 30 min
   * @param {Number} [d.maintenant] récoltes passées ignorées
   * @param {Array} [d.retours] [{minute (ms, début de la minute de retour), ouvrieres}]
   * @param {Array} [d.pontes] [{debut, fin (ms), ouvrieres}] pondues une à une, la dernière à fin
   * @param {Array} [d.chasses] [{impact (ms, minute du RC), terrain (cm²)}]
   * @return {{libres: Number, recolte: Number, revenues: Number, pondues: Number, gagne: Number}} la récolte qui limite et ce qui y compte
   */
  static libresAvantRecolte(d) {
    let retours = d.retours || [],
      pontes = d.pontes || [],
      chasses = d.chasses || [],
      // arrivée comptée si sa minute est entière avant la récolte : avant le
      // début de la minute de la récolte
      debutMinute = (t) => Math.floor(t / 60000) * 60000,
      revenues = (h) =>
        retours.reduce((s, r) => s + (r.minute < debutMinute(h) ? r.ouvrieres : 0), 0),
      pondues = (h) =>
        pontes.reduce((s, p) => {
          if (!(p.ouvrieres > 0)) return s;
          // la k-ième arrive à debut + k × pas
          let pas = (p.fin - p.debut) / p.ouvrieres,
            n =
              pas > 0
                ? Math.ceil((debutMinute(h) - p.debut) / pas) - 1
                : p.fin < debutMinute(h)
                  ? p.ouvrieres
                  : 0;
          return s + Math.max(0, Math.min(p.ouvrieres, n));
        }, 0),
      gagne = (h) =>
        chasses.reduce((s, c) => s + (c.impact <= h + RECOLTE_MARGE_CHASSE ? c.terrain : 0), 0),
      dernier = Math.max(
        d.recolte,
        ...retours.map((r) => r.minute + 60000),
        ...pontes.map((p) => p.fin),
        ...chasses.map((c) => c.impact),
      ),
      h = d.recolte,
      limite = null;
    if (d.maintenant > h) h += Math.ceil((d.maintenant - h) / RECOLTE_PERIODE) * RECOLTE_PERIODE;
    for (let k = 0; k < RECOLTES_EXAMINEES_MAX; k++, h += RECOLTE_PERIODE) {
      let r = revenues(h),
        p = pondues(h),
        g = gagne(h),
        libres = d.presentes + r + p - (d.terrain + g);
      if (!limite || libres < limite.libres)
        limite = { libres, recolte: h, revenues: r, pondues: p, gagne: g };
      // au-delà, plus rien n'arrive : les récoltes suivantes donnent la même chose
      if (h > dernier + 60000) break;
    }
    limite.libres = Math.max(0, Math.min(d.presentes, limite.libres));
    return limite;
  }
  /**
   * Ouvrières des convois comptées au plus jusqu'aux ouvrières en convoi
   * (page Reine) : en trop, ce sont les premiers retours qui ne comptent pas.
   *
   * @static
   * @method plafonnerRetours
   * @param {Array} retours [{minute, ouvrieres}]
   * @param {Number} enConvoi
   * @return {Array}
   */
  static plafonnerRetours(retours, enConvoi) {
    let reste = Math.max(0, enConvoi || 0);
    return [...retours]
      .sort((a, b) => b.minute - a.minute)
      .map((r) => {
        let n = Math.min(r.ouvrieres, reste);
        reste -= n;
        return { ...r, ouvrieres: n };
      })
      .filter((r) => r.ouvrieres > 0);
  }
  /**
   * Convois que je livre, d'après la page Convois : minute « Retour le » du
   * jeu (Compte+) et ouvrières qui le portent. Seuls ceux encore partis à
   * `depuis` (lecture de la page Reine, qui donne les ouvrières présentes)
   * comptent : un convoi revenu avant est déjà parmi les présentes.
   *
   * @static
   * @method retoursConvois
   * @param {Number} depuis ms
   * @param {Number} parOuvriere ressources portées par une ouvrière
   * @return {Array} [{minute, ouvrieres}]
   */
  static retoursConvois(depuis, parOuvriere) {
    let nombre = (t) => parseInt(String(t).replace(/\D/g, "")) || 0;
    return CommerceFzzz.lignes()
      .get()
      .map((elt) => {
        let m = CommerceFzzz.texte(elt).match(
            /Vous allez livrer\s+([\d\s  ]+)\D+?et\s+([\d\s  ]+)\D+?à\s/i,
          ),
          retour = CommerceFzzz.texteRetour(elt),
          minute = retour == null ? null : CommerceFzzz.minuteRetour(retour, depuis);
        if (!m || minute == null || minute < depuis) return null;
        return { minute, ouvrieres: Math.ceil((nombre(m[1]) + nombre(m[2])) / parOuvriere) };
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
   * Pages Ressources puis Reine lues pour le remplissage avant la récolte,
   * gardées une minute pour les clics suivants.
   *
   * @static
   * @method lireRecolte
   * @return {Promise} voir analyserRecolte
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
    let fin = () => (CommerceFzzz._recolteEnCours = null);
    return (CommerceFzzz._recolteEnCours = lire("/Ressources.php")
      .then((ressources) =>
        lire("/Reine.php").then((reine) => {
          let lu = CommerceFzzz.analyserRecolte(ressources, reine);
          CommerceFzzz._recolteLue = lu;
          return lu;
        }),
      )
      .finally(fin));
  }
  /**
   * Prochaine récolte et chasses (page Ressources), ouvrières présentes et en
   * convoi, et pontes (page Reine). Les heures sont prises du côté sûr :
   * récolte depuis l'envoi de la demande (au plus tôt), pontes depuis la
   * réponse (au plus tard), TdC le plus grand des deux pages.
   *
   * @static
   * @method analyserRecolte
   * @param {Object} ressources {html, avant, apres (ms)}
   * @param {Object} reine {html, avant, apres (ms)}
   * @return {Object} {recolte, presentes, enConvoi, terrain, pontes, chasses, automatique, instant}
   */
  static analyserRecolte(ressources, reine) {
    let $ressources = Utils.parseHtml(ressources.html),
      $reine = Utils.parseHtml(reine.html),
      secondes = (ressources.html.match(/reste\(\s*(\d+)\s*,\s*["']retour_ouvrieres["']/) || [])[1],
      nombre = ($page, selecteur) =>
        parseInt($page.find(selecteur).first().text().replace(/[^\d]/g, ""));
    if (secondes == null || !$ressources.find("#retour_ouvrieres").length)
      throw new Error("heure de la récolte absente de la page Ressources");
    if (!Utils.estPageReine($reine)) throw new Error("page Reine illisible");
    let presentes = nombre($reine, "#nb_ouvrieres"),
      total = Utils.analyserReine($reine).ouvrieres;
    if (isNaN(presentes)) throw new Error("ouvrières absentes de la page Reine");
    let chasses = PageRessource.lireChasses($ressources).map((c) => ({
      impact: c.impact.valueOf(),
      terrain: c.terrain,
    }));
    if (chasses.length < (ressources.html.match(/Vos chasseuses vont conquérir/g) || []).length)
      throw new Error("chasses en cours illisibles");
    let fin = 0,
      pontes = [];
    Utils.pontesReine($reine).forEach((p) => {
      let debut = fin;
      fin = Math.max(fin, p.secondes);
      if (/^ouvri[eè]re/i.test(p.unite.trim()))
        pontes.push({
          debut: reine.apres + debut * 1000,
          fin: reine.apres + fin * 1000,
          ouvrieres: p.nombre,
        });
    });
    let choix = $ressources.find("input[name=choixOuvriere]:checked").val();
    return {
      recolte: ressources.avant + parseInt(secondes) * 1000,
      presentes,
      enConvoi: Math.max(0, total - presentes),
      terrain: Math.max(
        nombre($reine, "#quantite_tdc") || 0,
        nombre($ressources, "#quantite_tdc") || 0,
      ),
      pontes,
      chasses,
      automatique: choix == "nourriture" || choix == "materiaux",
      instant: reine.apres,
    };
  }
  /**
   * Bloc « Récapitulatif » sous les convois en cours : pour chaque membre
   * suivi, temps de trajet (avec la Vitesse d'attaque), heure de retour d'un
   * convoi lancé maintenant, et reste à livrer d'après le site de suivi OUAF
   * (lu une fois à l'ouverture, si le mot de passe est enregistré). Les
   * coordonnées viennent du cache de l'alliance (Membres → Temps de trajet).
   *
   * @static
   * @method membresSuivis
   */
  static membresSuivis() {
    if (!Utils.affichage("convoisMembres") || $("#o_convoisMembres").length) return;
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
      ouaf = { restes: null, etat: "attente", membres: [] },
      deux = (n) => String(n).padStart(2, "0"),
      hms = (s) =>
        `${deux(Math.floor(s / 3600))}:${deux(Math.floor((s % 3600) / 60))}:${deux(s % 60)}`,
      trajet = (p) => (connus[p] ? OuafSuivi.trajet(p) : null),
      // clic : ce joueur en destinataire (voir plus bas) ; Ctrl+clic ou clic
      // du milieu : sa page, par le lien
      lien = (p) =>
        `<a href='Membre.php?Pseudo=${encodeURIComponent(p)}' class='o_convoisMembreDestinataire' title='Clic : convoi vers ${Utils.echapper(p)} (Ctrl+clic : sa page)'>${Utils.echapper(p)}</a>`,
      reste = (p) => {
        if (ouaf.etat == "attente") return "<span class='small'>…</span>";
        if (ouaf.etat == "code")
          return "<span class='small' title='Mot de passe du site de suivi à renseigner dans Préférences → Grenier'>—</span>";
        if (ouaf.etat == "erreur")
          return `<span class='small' title='${Utils.echapper(ouaf.erreur || "")}'>?</span>`;
        let r = ouaf.restes.get(p.toLowerCase());
        if (r == null)
          return "<span class='small' title='Aucun convoi prévu vers ce joueur sur le site de suivi'>—</span>";
        return r > 0
          ? `<a href='#' class='o_convoisMembreMontant' data-montant='${Math.round(r)}' title='Clic : ${Utils.echapper(p)} en destinataire et ce montant en matériaux (au plus ton stock)'>${numeral(r).format()}</a>`
          : numeral(r).format();
      },
      choix = () => {
        let libres = [...new Set([...Object.keys(connus), ...ouaf.membres])]
          .filter((p) => p && p != monProfil.pseudo && !suivis.includes(p))
          .sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
        return `<select class='o_convoisMembreChoix'><option value=''>— choisir un membre —</option>${libres.map((p) => `<option value='${Utils.echapper(p)}'>${Utils.echapper(p)}</option>`).join("")}</select>`;
      },
      ligne = (p) => {
        if (!p)
          return `<tr class='o_convoisMembreVide'><td>${choix()}</td><td>—</td><td>—</td><td>—</td><td></td></tr>`;
        let t = trajet(p);
        return `<tr data-pseudo='${Utils.echapper(p)}'><td>${lien(p)}</td>
          <td>${reste(p)}</td>
          <td>${t == null ? "<span class='small' title='Coordonnées inconnues : Alliance → Membres → Temps de trajet'>?</span>" : hms(t)}</td>
          <td class='o_convoisMembreRetour'>${t == null ? "—" : Horloge.clic().add(t, "s").format("DD/MM HH:mm")}</td>
          <td><span class='o_convoisMembreRetirer' title='Ne plus suivre ce membre'>✕</span></td></tr>`;
      },
      // encadré à part, comme « Organiser un convoi » : bien distinct des convois en cours
      $bloc = $(`<div id='o_convoisMembres' class='boite_amelioration simulateur centre'>
          <div class='o_convoisMembresTitre'><span class='titre'>Récapitulatif</span></div>
          <table class='o_convoisMembres o_maxWidth centre' cellspacing='0'>
            <thead><tr><th data-tri='joueur'>Joueur&nbsp;<span class='o_triIcone'></span></th><th data-tri='reste' title='Convoi restant à livrer (site de suivi)'>Convoi à faire&nbsp;<span class='o_triIcone'></span></th><th data-tri='trajet'>Temps de trajet&nbsp;<span class='o_triIcone'></span></th><th data-tri='retour' title='Horaire de retour d&#39;un convoi lancé maintenant'>Horaire de retour&nbsp;<span class='o_triIcone'></span></th><th></th></tr></thead>
            <tbody></tbody>
            <tfoot><tr><td colspan='5'><a href='#' id='o_convoisMembreAjouter'>+ Ajouter un membre à suivre</a></td></tr></tfoot>
          </table>
          ${Object.keys(connus).length ? "" : "<p class='small'>Positions des membres inconnues : ouvre Alliance → Membres → « Temps de trajet » une fois pour les charger.</p>"}
          <p class='o_convoisLienOuaf'><a href='${OUAF_SITE}' target='_blank' rel='noopener' title='Ouvre le site de suivi, connecté avec le mot de passe enregistré (Préférences → Convois)'>Ouvrir le site de suivi OUAF</a></p>
        </div>`),
      // tri par colonne : croissant, décroissant, puis ordre d'ajout (col null)
      tri = (() => {
        try {
          return { col: null, sens: 1, ...JSON.parse(sessionStorage.getItem(CLE_TRI_CONVOIS)) };
        } catch (e) {
          return { col: null, sens: 1 };
        }
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
      afficher = () => {
        let vides = $bloc.find(".o_convoisMembreVide").length || (suivis.length ? 0 : 1);
        $bloc
          .find("tbody")
          .html(ordonnes().map(ligne).join("") + Array(vides).fill(ligne("")).join(""));
        icones();
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
      else tri.col = null;
      try {
        sessionStorage.setItem(CLE_TRI_CONVOIS, JSON.stringify(tri));
      } catch (err) {}
      afficher();
    });
    // destinataire (et montant en matériaux) écrits sans recharger la page ; le
    // joueur valide lui-même
    let preparer = (pseudo, montant = null) => {
      CommerceFzzz.remplirDestinataire(pseudo);
      if (montant != null) CommerceFzzz.remplirMateriaux(montant);
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
            onglet.location.href = OUAF_SITE;
          } else window.open(OUAF_SITE, "_blank", "noopener");
        };
      OuafSuivi._connecter().then(ouvrir, (err) => {
        ouvrir();
        $.toast({
          ...TOAST_WARNING,
          text:
            err.name == "code"
              ? "Mot de passe du site de suivi à enregistrer dans Préférences → Grenier : connecte-toi sur le site."
              : "Connexion automatique impossible : connecte-toi sur le site.",
        });
      });
    });
    $bloc.find("#o_convoisMembreAjouter").on("click", (e) => {
      e.preventDefault();
      if ($bloc.find(".o_convoisMembreVide").length) return;
      $bloc.find("tbody").append(ligne(""));
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
    // reste à livrer : une lecture du site à l'ouverture de la page
    OuafSuivi.lireCode().then((code) => {
      if (!code) {
        ouaf.etat = "code";
        return afficher();
      }
      OuafSuivi.mesConvois().then(
        (r) => {
          Object.assign(ouaf, { etat: "ok", restes: r.restes, membres: r.membres });
          afficher();
        },
        (e) => {
          Object.assign(ouaf, {
            etat: "erreur",
            erreur:
              e.name == "permission"
                ? "Accès à ouafchaine.fr non accordé (bouton « Autoriser l'accès » en envoyant un convoi au suivi)"
                : e.name == "reseau"
                  ? OUAF_PANNE
                  : "Site de suivi OUAF : " + e.message,
          });
          afficher();
          CommerceFzzz.signalerSuiviOuaf(ouaf.erreur);
        },
      );
    });
  }
  /**
   * Premier envoi sans mot de passe : ouvre Préférences → Grenier, sur le champ
   * du mot de passe du site de suivi.
   *
   * @static
   * @method ouvrirParametresOuaf
   */
  static ouvrirParametresOuaf() {
    $.toast({
      ...TOAST_INFO,
      text: "Renseigne d'abord le mot de passe du site de suivi (Préférences → Grenier), puis relance l'envoi.",
      hideAfter: 8000,
    });
    BoiteParametre.ouvrirOnglet("Grenier");
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
