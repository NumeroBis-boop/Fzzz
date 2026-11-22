// écart vertical (px) entre les encadrés « S5 pseudo », Compte+ et Extension OUAF
const ECART_ENCADRES = 6;
// « Désactiver l'extension » : lu aussi par bootstrap.js, avant l'affichage
const CLE_DESACTIVEE = "fzzz_desactivee";
// barre d'outils de Toolzzz et d'Outiiil (même id que la nôtre, hors de notre encadré)
const ID_BARRE_TOOLZZZ = "o_toolbarOutiiil";

/**
 * Classe pour la gestion des différents outils globals à fourmizzz.
 *
 * @class Outil
 * @constructor
 * @extends Boite
 */
class Dock {
  /**
   * @param {Boolean} desactivee extension désactivée : titre et case seulement
   */
  constructor(desactivee = false) {
    this._desactivee = desactivee;
    // encadré « Extension OUAF », même style que l'encadré Compte+ du jeu
    this._html = `<div id="o_boiteExtension" class="boite_compte_plus">
            <div class="titre_colonne_cliquable"><span class="titre_compte_plus">${NOM_EXTENSION}</span> <span class="o_versionExtension" title="Version installée">v${VERSION}</span></div>
            <div class="contenu_boite_compte_plus">
            <label class="o_desactiverExtension" title="Coupe tout ce que l'extension ajoute ou calcule : chaque page s'affiche comme sans extension. La page se recharge."><input type="checkbox" id="o_desactiverExtension" ${desactivee ? "checked" : ""}/> Désactiver l'extension</label>
            ${
              desactivee
                ? ""
                : `<div id="o_toolbarOutiiil">${[
                    ["o_toolbarItem6", "o_itemParametre", "Préférences"],
                    ["o_toolbarItem2", "o_itemChasse", "Chasse"],
                    ["o_toolbarItem3", "o_itemCombat", "Combat"],
                  ]
                    .map(
                      ([id, item, legende]) =>
                        `<div class="o_toolbarOutil"><div id="${id}" class="o_toolbarItem"><span id="${item}" style="background-image: url(${IMG_SPRITE_MENU})"/></div><span class="o_toolbarLegende">${legende}</span></div>`,
                    )
                    .join("")}</div>`
            }
            </div></div>`;
    if (desactivee) return;
    this._boiteChasse = new BoiteChasse();
    this._boiteCombat = new BoiteCombat();
    this._boiteParametre = new BoiteParametre();
  }
  /**
   * Affiche la boite.
   *
   * @private
   * @method afficher
   */
  afficher() {
    // Fzzz : encadré à part, juste sous l'encadré Compte+ (celui du jeu, ou
    // celui que Fzzz recrée hors C+). Les trois encadrés (« S5 pseudo »,
    // Compte+, Extension OUAF) sont resserrés : écart ECART_ENCADRES entre
    // chacun. Plus de bandeau fixe sur le bord droit.
    let $cplus = $("#boiteComptePlus").length ? $("#boiteComptePlus") : $("#boiteInfo"),
      $boite = $(this._html);
    if ($cplus.length) {
      // désactivée : les encadrés du jeu restent à leur place d'origine ;
      // l'encadré recréé hors C+ suit déjà « S5 pseudo » (Dock.suivre)
      if (
        $cplus.is("#boiteComptePlus") &&
        !$cplus.hasClass("o_encadreSuivi") &&
        !this._desactivee &&
        Utils.affichage("rapprocherEncadres")
      )
        Dock.rapprocher($("#boiteInfo")[0], $cplus[0]);
      $boite.insertAfter($cplus);
      Dock.suivre($cplus[0], $boite[0], () => ECART_ENCADRES);
    } else $boite.addClass("o_toolbarFlottante").appendTo("body");
    $boite.find("#o_desactiverExtension").on("change", (e) => {
      try {
        if (e.currentTarget.checked) localStorage.setItem(CLE_DESACTIVEE, "1");
        else localStorage.removeItem(CLE_DESACTIVEE);
      } catch (err) {}
      location.reload();
    });
    Dock.signalerAutreExtension($boite);
    if (!this._desactivee) Dock.signalerMiseAJour($boite);
    // evenement sur le clic d'un item de la boite d'outil
    $(".o_toolbarOutil").click((e) => {
      switch ($(e.currentTarget).find(".o_toolbarItem span").attr("id")) {
        case "o_itemChasse":
          this._boiteChasse.afficher();
          break;
        case "o_itemCombat":
          this._boiteCombat.afficher();
          break;
        case "o_itemParametre":
          this._boiteParametre.afficher();
          break;
        default:
          break;
      }
    });
  }
  /**
   * Autres extensions Fourmizzz actives en même temps, repérées à ce qu'elles
   * ajoutent à la page. Toolzzz et Outiiil (dont Fzzz descend) : même id de
   * barre d'outils, hors de notre encadré. Optizzz : classe sur <html> et
   * bouton dans le menu du jeu.
   *
   * @static
   * @method autresExtensions
   * @return {Array<String>} « Toolzzz ou Outiiil », « Optizzz »
   */
  static autresExtensions() {
    let trouvees = [];
    if (
      [...document.querySelectorAll(`[id="${ID_BARRE_TOOLZZZ}"]`)].some(
        (e) => !e.closest("#o_boiteExtension"),
      )
    )
      trouvees.push("Toolzzz ou Outiiil");
    if (
      document.documentElement.classList.contains("optizzz-game-look") ||
      document.querySelector("[data-optizzz-bar-button]")
    )
      trouvees.push("Optizzz");
    return trouvees;
  }
  static signalerAutreExtension($boite) {
    const MESSAGES = {
      "Toolzzz ou Outiiil":
        "Toolzzz ou Outiiil est aussi active : désactive-la, les deux extensions se gênent.",
      Optizzz:
        "Optizzz est aussi active : coupe dans ses « Fonctionnalités » les anti-sondes, le lanceur de chasse et les colonnes de la page Membres, sinon les deux extensions se gênent.",
    };
    let verifier = () =>
      Dock.autresExtensions().forEach((nom) => {
        if ($boite.find(`.o_autreExtension[data-nom="${nom}"]`).length) return;
        $("<div class='o_autreExtension'></div>")
          .attr("data-nom", nom)
          .text(MESSAGES[nom])
          .appendTo($boite.find(".contenu_boite_compte_plus"));
      });
    verifier();
    $(window).on("load", verifier);
    [1000, 3000].forEach((ms) => setTimeout(verifier, ms));
  }
  /**
   * Script utilisateur : numéro de version vert quand il est à jour, rouge
   * quand une version plus récente est publiée, avec alors le lien qui l'ouvre
   * dans le gestionnaire de scripts (« mettre à jour »). Version publiée
   * inconnue (GitHub injoignable) : couleur d'origine.
   *
   * @static
   * @method signalerMiseAJour
   * @param {jQuery} $boite encadré « Extension OUAF »
   */
  static signalerMiseAJour($boite) {
    if (typeof FZZZ_USERSCRIPT == "undefined") return;
    Promise.resolve(chrome.runtime.sendMessage({ type: "fzzz_majVerifier" }))
      .then((r) =>
        r && r.url
          ? MiseAJour.publiee(r.url).then((version) => version && { version, url: r.url })
          : null,
      )
      .then((maj) => {
        if (!maj) return;
        let ancienne = MiseAJour.comparer(maj.version, VERSION) > 0;
        $boite
          .find(".o_versionExtension")
          .toggleClass("o_versionAJour", !ancienne)
          .toggleClass("o_versionAncienne", ancienne)
          .attr(
            "title",
            ancienne
              ? `Version installée ; la v${maj.version} est publiée`
              : "Version installée : à jour",
          );
        if (!ancienne || $boite.find(".o_majDisponible").length) return;
        $("<div class='o_majDisponible'></div>")
          .append(
            $("<a rel='noopener'></a>")
              .text(`Nouvelle version v${maj.version} : mettre à jour`)
              .attr("href", maj.url)
              .attr("target", "_blank")
              // Violentmonkey : onglet resté vide refermé (MiseAJour.ouvrir)
              .on("click", (e) => {
                if (Dock.violentmonkey() && MiseAJour.ouvrir(maj.url, true)) e.preventDefault();
              })
              .attr(
                "title",
                "Ouvre la nouvelle version : « Mettre à jour » dans Violentmonkey ou Tampermonkey, puis recharge la page.",
              ),
          )
          .appendTo($boite.find(".contenu_boite_compte_plus"));
      })
      .catch(() => {});
  }
  /**
   * @static
   * @method violentmonkey
   * @return {Boolean} script utilisateur installé avec Violentmonkey
   */
  static violentmonkey() {
    return (
      typeof GM_info != "undefined" &&
      /violentmonkey/i.test((GM_info && GM_info.scriptHandler) || "")
    );
  }
  /**
   * Place l'encadré Compte+ du jeu à ECART_ENCADRES sous « S5 pseudo »
   * (translation, sans toucher à la mise en page du jeu), plus haut quand il
   * reste de la place, plus bas quand « S5 pseudo » déborde sur lui (lignes
   * « Plein dans … », texte plus grand d'un téléphone). Refait à chaque
   * changement de « S5 pseudo ».
   *
   * @static
   * @method rapprocher
   * @param {HTMLElement} haut encadré « S5 pseudo »
   * @param {HTMLElement} bas encadré Compte+
   */
  static rapprocher(haut, bas) {
    if (!haut || !bas) return;
    let attente = null,
      ajuster = () => {
        let h = Dock.emprise(haut),
          b = Dock.emprise(bas);
        if (!h.height || !b.height) return;
        let applique = Number(
            (/translateY\((-?[\d.]+)px\)/.exec(bas.style.transform) || [])[1] || 0,
          ),
          e = b.top - applique - h.bottom,
          // écart inattendu (encadrés déplacés, colonnes différentes) : on n'y touche pas
          voulu =
            Math.abs(e) < 200 && b.left < h.right && b.right > h.left
              ? ECART_ENCADRES - Math.round(e)
              : 0;
        if (voulu != applique) bas.style.transform = voulu ? `translateY(${voulu}px)` : "";
      };
    ajuster();
    Dock.observer(haut, () => {
      cancelAnimationFrame(attente);
      attente = requestAnimationFrame(ajuster);
    });
  }
  /**
   * Appelle `rappel` quand `ref` change de taille, de contenu ou de style,
   * quand son conteneur change (panneau ouvert sur téléphone), au
   * redimensionnement et un peu après le chargement, le jeu pouvant finir de
   * placer ses encadrés plus tard. Mesures dans la page seulement.
   *
   * @static
   * @method observer
   * @param {HTMLElement} ref
   * @param {Function} rappel
   */
  static observer(ref, rappel) {
    let appeler = () => rappel(),
      tailles = window.ResizeObserver ? new ResizeObserver(appeler) : null,
      // le cadre visible est dessiné par les éléments intérieurs, dont ceux
      // ajoutés après coup (lignes « Plein dans … », contenu refait par le jeu)
      suivreTailles = (/** @type {Element} */ e) =>
        tailles && [e, ...e.querySelectorAll("*")].forEach((x) => tailles.observe(x));
    suivreTailles(ref);
    new MutationObserver((changements) => {
      changements.forEach((c) =>
        c.addedNodes.forEach((n) => n.nodeType == 1 && suivreTailles(/** @type {Element} */ (n))),
      );
      appeler();
    }).observe(ref, {
      attributes: true,
      attributeFilter: ["style", "class"],
      childList: true,
      characterData: true,
      subtree: true,
    });
    if (ref.parentElement)
      new MutationObserver(appeler).observe(ref.parentElement, {
        attributes: true,
        attributeFilter: ["style", "class"],
      });
    $(window).on("load resize", appeler);
    [300, 1000, 3000].forEach((ms) => setTimeout(appeler, ms));
  }
  /**
   * Emprise visible d'un encadré du jeu : son cadre est dessiné par ses
   * éléments intérieurs, l'élément lui-même pouvant mesurer 0 px (comme
   * l'encadré « S5 pseudo », voir Horloge.afficher).
   *
   * @static
   * @method emprise
   * @param {HTMLElement} elt
   * @return {{left: Number, top: Number, right: Number, bottom: Number, width: Number, height: Number}}
   */
  static emprise(elt) {
    let g = Infinity,
      h = Infinity,
      d = -Infinity,
      b = -Infinity;
    [elt, ...elt.querySelectorAll("*")].forEach((e) => {
      let r = e.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        g = Math.min(g, r.left);
        h = Math.min(h, r.top);
        d = Math.max(d, r.right);
        b = Math.max(b, r.bottom);
      }
    });
    return g == Infinity
      ? { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }
      : { left: g, top: h, right: d, bottom: b, width: d - g, height: b - h };
  }
  /**
   * Garde `boite` juste sous `ref`, à `ecart()` px, même colonne, même
   * largeur, même apparence. Le jeu place lui-même les encadrés de sa
   * colonne de gauche (et replace ce qu'on y ajoute) : `boite` est donc
   * rattaché à la page, hors de la colonne, et positionné d'après la
   * position mesurée de `ref`, recalculée quand `ref` bouge ou change de
   * taille (aucune requête au jeu, mesures dans la page seulement).
   *
   * @static
   * @method suivre
   */
  static suivre(ref, boite, ecart) {
    // page sans encart « S5 pseudo » (accueil) : rien à suivre
    if (!ref || !boite) return;
    Dock.copierStyle(ref, boite);
    boite.classList.add("o_encadreSuivi");
    document.body.appendChild(boite);
    let attente = null,
      // position de `ref` dans le repère de `boite` (fenêtre si fixe, document sinon)
      repere = () => {
        let r = ref.getBoundingClientRect(),
          fixe = boite.style.position == "fixed";
        return [
          r.left + (fixe ? 0 : scrollX),
          r.top + (fixe ? 0 : scrollY),
          r.width,
          r.height,
        ].join();
      },
      dernier = "",
      caler = () => {
        cancelAnimationFrame(attente);
        attente = requestAnimationFrame(() => {
          Dock.caler(ref, boite, ecart());
          dernier = repere();
        });
      };
    caler();
    Dock.observer(ref, caler);
    // au défilement, recalage complet seulement si `ref` a bougé dans ce repère
    $(window).on("scroll", () => repere() != dernier && caler());
  }
  /**
   * Même apparence que l'encadré de référence (fond, bordure, ombre, titre),
   * le style du jeu pouvant dépendre de la colonne qu'on quitte.
   *
   * @static
   * @method copierStyle
   */
  static copierStyle(ref, boite) {
    let copier = (de, vers, proprietes) => {
      if (!de || !vers) return;
      let c = getComputedStyle(de);
      proprietes.forEach((p) => (vers.style[p] = c[p]));
    };
    copier(ref, boite, [
      "backgroundColor",
      "backgroundImage",
      "backgroundSize",
      "backgroundRepeat",
      "borderTop",
      "borderRight",
      "borderBottom",
      "borderLeft",
      "borderRadius",
      "boxShadow",
      "color",
      "fontFamily",
      "fontSize",
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",
    ]);
    // largeur totale identique à celle de `ref` (bordure et marges comprises)
    boite.style.boxSizing = "border-box";
    let titre = (e) => e.querySelector(".titre_colonne_cliquable"),
      libelle = (e) => e.querySelector(".titre_compte_plus, .titre_colonne_cliquable > *");
    copier(titre(ref), titre(boite), [
      "backgroundColor",
      "backgroundImage",
      "backgroundSize",
      "backgroundRepeat",
      "borderBottom",
      "borderRadius",
      "height",
      "lineHeight",
      "paddingTop",
      "paddingBottom",
      "textAlign",
      "marginBottom",
    ]);
    let contenu = (e) => e.querySelector(".contenu_boite_compte_plus");
    copier(contenu(ref), contenu(boite), [
      "backgroundColor",
      "backgroundImage",
      "backgroundSize",
      "backgroundRepeat",
      "borderTop",
      "borderRight",
      "borderBottom",
      "borderLeft",
      "borderRadius",
      "boxShadow",
      "paddingLeft",
      "paddingRight",
    ]);
    copier(libelle(ref), libelle(boite), [
      "color",
      "fontFamily",
      "fontSize",
      "fontWeight",
      "textShadow",
      "letterSpacing",
    ]);
  }
  /**
   * Place `boite` (rattaché à la page) sous `ref` : position fixe si `ref`
   * est dans un conteneur fixe (colonne qui ne défile pas), sinon absolue
   * aux coordonnées du document. Masqué si `ref` l'est.
   *
   * @static
   * @method caler
   * @param {HTMLElement} ref encadré au-dessus
   * @param {HTMLElement} boite encadré à placer
   * @param {Number} ecart px entre les deux
   */
  static caler(ref, boite, ecart = 8) {
    let r = Dock.emprise(ref);
    if (!r.width || !r.height) {
      boite.style.display = "none";
      return;
    }
    let fixe = false;
    for (let e = ref; e && e != document.documentElement; e = e.parentElement)
      if (getComputedStyle(e).position == "fixed") {
        fixe = true;
        break;
      }
    // au-dessus de la colonne du jeu : z-index le plus haut parmi `ref` et
    // ses conteneurs positionnés, plus un (sinon l'encadré passe derrière
    // le fond de la colonne)
    let z = 0;
    for (let e = ref; e && e != document.documentElement; e = e.parentElement) {
      let n = parseInt(getComputedStyle(e).zIndex);
      if (!isNaN(n)) z = Math.max(z, n);
    }
    let haut = r.bottom + ecart;
    Object.assign(boite.style, {
      display: "",
      position: fixe ? "fixed" : "absolute",
      margin: "0",
      left: r.left + (fixe ? 0 : window.scrollX) + "px",
      top: haut + (fixe ? 0 : window.scrollY) + "px",
      width: r.width + "px",
      zIndex: String(Math.max(z + 1, 100)),
    });
    if (!fixe) return;
    // colonne fixe : l'encadré doit tenir dans la fenêtre (on ne peut pas
    // défiler jusqu'à lui) ; s'il dépasse, il remonte juste ce qu'il faut
    if (haut + boite.offsetHeight > window.innerHeight)
      boite.style.top = Math.max(0, window.innerHeight - boite.offsetHeight - 4) + "px";
  }
}
