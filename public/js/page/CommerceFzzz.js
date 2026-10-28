/*
 * CommerceFzzz.js
 * NumeroBis-boop
 **********************************************************************/

// pseudos suivis dans le tableau « Joueur à livrer », dans l'ordre d'ajout
const CLE_CONVOIS_MEMBRES = "fzzz_convoisMembres";
// tri de « Convois à faire » : gardé tant qu'on reste sur la page Convois
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
      envoyer = (c) => {
        etatLigne(c, "envoi");
        OuafSuivi.envoyer([c], (x, statut, detail) => {
          etatLigne(x, statut, detail);
          if (statut == "envoye") ConvoisForum.noter([x]);
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
    let forum = ConvoisForum.transmis();
    OuafSuivi.lireCode().then((code) => {
      let site = code
        ? OuafSuivi.etat(convois).then(
            (transmis) => ({ transmis }),
            (erreur) => ({ erreur }),
          )
        : Promise.resolve({ transmis: new Set() });
      Promise.all([forum, site]).then(([notes, r]) => {
        convois.forEach((c) => {
          if (c.id && notes.has(c.id)) etatLigne(c, "transmis", "Noté dans le forum de l'alliance");
          else if (r.transmis) etatLigne(c, r.transmis.has(c.cle) ? "transmis" : "non");
          else etatLigne(c, "non", "état du site inconnu");
        });
        // site injoignable à l'ouverture de la page : expliqué au clic sur un envoi
        if (r.erreur && r.erreur.name != "permission" && r.erreur.name != "reseau") echec(r.erreur);
      });
    });
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
      lien = (p) => {
        let m = connus[p];
        return `<a href='${m && m.id ? "commerce.php?ID=" + m.id : "Membre.php?Pseudo=" + encodeURIComponent(p)}' title='${m && m.id ? "Convoyer " + Utils.echapper(p) : "Page de " + Utils.echapper(p)}'>${Utils.echapper(p)}</a>`;
      },
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
          <h3 class='o_convoisMembresTitre'>Convois à faire</h3>
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
