/*
 * CommerceFzzz.js
 * NumeroBis-boop
 **********************************************************************/

// pseudos suivis dans le tableau « Joueur à livrer », dans l'ordre d'ajout
const CLE_CONVOIS_MEMBRES = "fzzz_convoisMembres";
// tri du « Récapitulatif » : gardé tant qu'on reste sur la page Convois
// (envoi d'un convoi = rechargement), oublié au chargement d'une autre page
const CLE_TRI_CONVOIS = "fzzz_triConvoisMembres";

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
   * Devant chaque convoi envoyé, son état sur le site de suivi de la OUAF :
   * « ✅ Enregistré », ou un bouton « 📤 Envoyer au suivi ». À l'ouverture de
   * la page, l'historique du site est lu (si le mot de passe est enregistré
   * et l'accès accordé) pour savoir ce qui est déjà noté. Le mot de passe se
   * renseigne seulement dans Paramètres → Convois.
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
            `${NOM_EXTENSION} n'a pas encore accès à ouafchaine.fr. <button type='button' id='o_ouafAcces' class='o_button f_info'>Autoriser l'accès</button> puis relance l'envoi.`,
            TOAST_WARNING,
          );
          $(document)
            .off("click.ouafAcces")
            .on("click.ouafAcces", "#o_ouafAcces", () => OuafSuivi.demanderAcces());
        } else if (e.name == "code") CommerceFzzz.ouvrirParametresOuaf();
        else if (e.name == "reseau")
          toast(
            `Le site de suivi n'a pas pu être joint. Il n'est pas en https : le mode « HTTPS uniquement » de Firefox le bloque souvent. Ouvre une fois <a href='${OUAF_SITE}' target='_blank' rel='noopener'>${OUAF_SITE.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a>, choisis « Continuer vers le site HTTP », puis réessaie.`,
            TOAST_ERROR,
          );
        else
          toast(
            "Le site de suivi n'a pas pu être joint : " + Utils.echapper(e.message),
            TOAST_ERROR,
          );
      },
      noterForum = (liste) =>
        ConvoisForum.noter(liste).catch((e) =>
          toast(
            `${liste.length > 1 ? "Convois notés" : "Convoi noté"} sur le site de suivi, mais pas dans le forum de l'alliance (${e.message == "absente" ? "section « " + FORUM_SECTIONS_CHASSES[0] + " » introuvable" : Utils.echapper(e.message)}) : sur un autre appareil, ${liste.length > 1 ? "ils pourront" : "il pourra"} s'afficher « Pas encore noté ».`,
            TOAST_WARNING,
          ),
        ),
      envoyer = (c) => {
        etatLigne(c, "envoi");
        OuafSuivi.envoyer([c], (x, statut, detail) => {
          etatLigne(x, statut, detail);
          if (statut == "envoye") noterForum([x]);
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
    // ouverture de la page : numéros notés dans le forum (exacts), puis
    // historique du site pour les convois qui n'y sont pas
    let forum = ConvoisForum.notes();
    OuafSuivi.lireCode().then((code) => {
      let site = code
        ? OuafSuivi.etat(convois).then(
            (transmis) => ({ transmis }),
            (erreur) => ({ erreur }),
          )
        : Promise.resolve({ transmis: new Set() });
      Promise.all([forum, site]).then(([notes, r]) => {
        let ids = new Set(notes.map((n) => n.id)),
          // convoi sans numéro (lien Annuler disparu, autre appareil) : reconnu
          // dans le forum par destinataire, montant et arrivée
          pris = new Set(convois.map((c) => c.id).filter((id) => id && ids.has(id))),
          aNoter = [];
        convois.forEach((c) => {
          let retrouve = !c.id && OuafSuivi.retrouver(notes, c, pris);
          if (retrouve) pris.add(retrouve.id);
          if ((c.id && ids.has(c.id)) || retrouve)
            etatLigne(c, "transmis", "Noté dans le forum de l'alliance");
          else if (r.transmis) {
            let fait = r.transmis.has(c.cle);
            etatLigne(c, fait ? "transmis" : "non");
            // noté sur le site mais pas dans le forum : ajouté pour les autres appareils
            if (fait && c.id) aNoter.push(c);
          } else etatLigne(c, "non", "état du site inconnu");
        });
        if (aNoter.length) noterForum(aNoter);
        // site injoignable à l'ouverture de la page : expliqué au clic sur un envoi
        if (r.erreur && r.erreur.name != "permission" && r.erreur.name != "reseau") echec(r.erreur);
      });
    });
  }
  /**
   * Numéro d'un joueur, retenu dans le cache de la carte d'alliance.
   *
   * @static
   * @method retenirId
   */
  static retenirId(pseudo, id) {
    let cle = `outiiil_carteAlliance_${Utils.serveur}_${Utils.alliance}`,
      cache = Utils.lireStockage(cle, null),
      membre = cache && (cache.members || []).find((m) => m.pseudo == pseudo);
    if (!membre) return;
    membre.id = id;
    try {
      localStorage.setItem(cle, JSON.stringify(cache));
    } catch (e) {}
  }
  /**
   * Tableau « Joueur à livrer » sous les convois en cours : pour chaque membre
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
      // clic : commerce.php?ID=…, que le jeu ouvre avec ce joueur en destinataire
      // (voir plus bas) ; Ctrl+clic ou clic du milieu : sa page, par le lien
      lien = (p) =>
        `<a href='Membre.php?Pseudo=${encodeURIComponent(p)}' class='o_convoisMembreDestinataire' title='Clic : convoi vers ${Utils.echapper(p)} (Ctrl+clic : sa page)'>${Utils.echapper(p)}</a>`,
      reste = (p) => {
        if (ouaf.etat == "attente") return "<span class='small'>…</span>";
        if (ouaf.etat == "code")
          return "<span class='small' title='Mot de passe du site de suivi à renseigner dans Paramètres → Convois'>—</span>";
        if (ouaf.etat == "erreur")
          return `<span class='small' title='${Utils.echapper(ouaf.erreur || "")}'>?</span>`;
        let r = ouaf.restes.get(p.toLowerCase());
        return r == null
          ? "<span class='small' title='Aucun convoi prévu vers ce joueur sur le site de suivi'>—</span>"
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
    $bloc.on("click", ".o_convoisMembreDestinataire", (e) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
      e.preventDefault();
      let pseudo = String($(e.currentTarget).closest("tr").data("pseudo")),
        ouvrir = (id) => (location.href = `commerce.php?ID=${id}`);
      if (connus[pseudo] && connus[pseudo].id) return ouvrir(connus[pseudo].id);
      // numéro du joueur inconnu : lu sur son profil, puis retenu dans le cache
      // de la carte d'alliance pour les fois suivantes
      let joueur = new Joueur({ pseudo });
      Promise.resolve(joueur.getProfil())
        .then((html) => (joueur.chargerProfil(html) && joueur.id > 0 ? joueur.id : null))
        .catch(() => null)
        .then((id) => {
          if (id) {
            CommerceFzzz.retenirId(pseudo, id);
            return ouvrir(id);
          }
          // profil illisible : pseudo écrit dans le champ, sans le laisser
          // sélectionné (la sélection ouvre la liste de suggestions)
          let $champ = $("#pseudo_convoi").val(pseudo).trigger("change");
          if ($champ.autocomplete("instance")) $champ.autocomplete("close");
          $champ.trigger("blur");
        });
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
    $bloc.find("#o_convoisMembreAjouter").on("click", (e) => {
      e.preventDefault();
      if ($bloc.find(".o_convoisMembreVide").length) return;
      $bloc.find("tbody").append(ligne(""));
    });
    // heure de retour : recalculée chaque minute (affichage seulement)
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
                  ? "Site de suivi injoignable (non https : Firefox peut le bloquer, ouvre-le une fois et accepte le http)"
                  : "Site de suivi : " + e.message,
          });
          afficher();
        },
      );
    });
  }
  /**
   * Premier envoi sans mot de passe : ouvre Paramètres → Convois, sur le champ
   * du mot de passe du site de suivi.
   *
   * @static
   * @method ouvrirParametresOuaf
   */
  static ouvrirParametresOuaf() {
    $.toast({
      ...TOAST_INFO,
      text: "Renseigne d'abord le mot de passe du site de suivi (Paramètres → Convois), puis relance l'envoi.",
      hideAfter: 8000,
    });
    if (!$("#o_tabsParametreConvois").is(":visible"))
      $("#o_itemParametre").closest(".o_toolbarItem").trigger("click");
    let $onglets = $("#o_tabsParametre");
    if ($onglets.hasClass("ui-tabs"))
      $onglets.tabs(
        "option",
        "active",
        $onglets.find("a[href='#o_tabsParametreConvois']").parent().index(),
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
