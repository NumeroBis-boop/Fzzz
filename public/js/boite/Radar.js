// @ts-check
/**
 * Creer une boite radar pour la surveillance des joueurs/alliances.
 *
 * @class BoiteRadar
 * @constructor
 * @extends Boite
 */
class BoiteRadar {
  constructor() {
    /**
     * liste des joueurs
     */
    this._joueurs = {};
    /**
     * liste des alliances
     */
    this._alliances = {};
    /**
     * Liste des séparateurs (sections de regroupement, ex. "--- Amis ---").
     * Chaque entrée : { id, texte, ordreRadar }. `id` est généré côté client
     * (timestamp) puisqu'un séparateur n'a pas de clé naturelle comme un
     * pseudo ou un tag d'alliance.
     */
    this._separateurs = [];
    /**
     * État du mode édition (toggle via ⚙ du toolbar). En mode édition :
     * un `×` apparait sur chaque ligne pour supprimer, et le texte des
     * séparateurs devient `contenteditable`. État volatile (pas persisté).
     */
    this._modeEdition = false;
    // on recupére les données
    this.getData();
  }
  /**
   *
   */
  get joueurs() {
    return this._joueurs;
  }
  /**
   *
   */
  set joueurs(newJoueurs) {
    this._joueurs = newJoueurs;
  }
  /**
   *
   */
  get alliances() {
    return this._alliances;
  }
  /**
   *
   */
  set alliances(newAlliances) {
    this._alliances = newAlliances;
  }
  /**
   *
   */
  get separateurs() {
    return this._separateurs;
  }
  /**
   *
   */
  ajouteJoueur(joueur) {
    this._joueurs[joueur.pseudo] = joueur;
    this._joueurs[joueur.pseudo].ordreRadar = this.getOrdreMax() + 1;
    return this;
  }
  /**
   *
   */
  supprimeJoueur(joueur) {
    delete this._joueurs[joueur.pseudo];
    return this;
  }
  /**
   *
   */
  ajouteAlliance(alliance) {
    this._alliances[alliance.tag] = alliance;
    this._alliances[alliance.tag].ordreRadar = this.getOrdreMax() + 1;
    return this;
  }
  /**
   *
   */
  supprimeAlliance(alliance) {
    delete this._alliances[alliance.tag];
    return this;
  }
  /**
   * Ajoute un séparateur à la fin de la liste.
   */
  ajouteSeparateur(texte = "Section") {
    this._separateurs.push({
      id: "sep_" + Date.now(),
      texte: texte,
      ordreRadar: this.getOrdreMax() + 1,
    });
    return this;
  }
  /**
   * Supprime un séparateur par son id.
   */
  supprimeSeparateur(id) {
    this._separateurs = this._separateurs.filter((s) => s.id !== id);
    return this;
  }
  /**
   * Renomme un séparateur. Repli sur "Section" si le texte fourni est vide.
   */
  renommeSeparateur(id, texte) {
    let sep = this._separateurs.find((s) => s.id === id);
    if (sep) sep.texte = ((texte || "").trim() || "Section").substring(0, 16);
    return this;
  }
  /**
   *
   */
  getOrdreMax() {
    let max = 0;
    for (let j in this._joueurs)
      if (this._joueurs[j].ordreRadar > max) max = this._joueurs[j].ordreRadar;
    for (let a in this._alliances)
      if (this._alliances[a].ordreRadar > max) max = this._alliances[a].ordreRadar;
    for (let s of this._separateurs) if (s.ordreRadar > max) max = s.ordreRadar;
    return max;
  }
  /**
   *
   */
  calculeOrdre(serie) {
    let newOrdre = serie.split("&");
    for (let i = 0; i < newOrdre.length; i++) {
      let item = newOrdre[i].split("=");
      let $row = $("#o_item_" + item[1]);
      if ($row.hasClass("o_radarSep")) {
        let sep = this._separateurs.find((s) => s.id === $row.attr("data-id"));
        if (sep) sep.ordreRadar = i;
      } else {
        let lien = $row.find("a:eq(1)"),
          href = lien.attr("href") || "",
          key = lien.text();
        if (href.includes("Membre.php")) {
          if (this._joueurs[key]) this._joueurs[key].ordreRadar = i;
        } else if (this._alliances[key]) {
          this._alliances[key].ordreRadar = i;
        }
      }
    }
    return this.sauvegarder();
  }
  /**
   * Récupére les données sur les joueurs sous surveillance.
   *
   * @method getRadar
   */
  getData() {
    let data = Utils.lireStockage("outiiil_radar");
    // Si des données sont deja presente et à jour on les charges
    if (data.hasOwnProperty("joueurs"))
      for (let item in data.joueurs) this._joueurs[item] = new Joueur(data.joueurs[item]);
    if (data.hasOwnProperty("alliances"))
      for (let item in data.alliances) this._alliances[item] = new Alliance(data.alliances[item]);
    if (Array.isArray(data.separateurs)) this._separateurs = data.separateurs;
  }
  /**
   *
   */
  toJSON() {
    let json = {},
      joueurs = {},
      alliances = {};
    for (let j in this._joueurs)
      joueurs[j] = JSON.parse(
        JSON.stringify(this._joueurs[j], ["pseudo", "id", "x", "y", "mv", "terrain", "ordreRadar"]),
      );
    for (let a in this._alliances)
      alliances[a] = JSON.parse(
        JSON.stringify(this._alliances[a], ["tag", "terrain", "ordreRadar"]),
      );
    // si on a des joueurs sous surveillance on ajoute à l'objet
    if (Object.keys(joueurs).length) json["joueurs"] = joueurs;
    // si on a des alliances sous surveillance on ajoute à l'objet
    if (Object.keys(alliances).length) json["alliances"] = alliances;
    if (this._separateurs.length) json["separateurs"] = this._separateurs;
    return json;
  }
  /**
   *
   */
  sauvegarder() {
    localStorage.setItem("outiiil_radar", JSON.stringify(this));
    return this;
  }
  /**
   * Affiche la boie.
   *
   * @private
   * @method afficher
   */
  afficher() {
    // si il y a des joueurs, alliances ou séparateurs surveillés on affiche la boite
    if (
      Object.keys(this._joueurs).length ||
      Object.keys(this._alliances).length ||
      this._separateurs.length
    ) {
      // Modification de la boite compte plus pour faire apparaitre la boite radar
      $("#boiteComptePlus .titre_colonne_cliquable").replaceWith(() => {
        return `<div class='titre_colonne_cliquable'>${IMG_FLECHE} <span class='titre_compte_plus'>Fzzz ${VERSION.substring(0, 2)}<span class='reduce'>${VERSION.substring(2)}</span></span> ${IMG_FLECHE}</div>`;
      });
      // Event sur le titre si on utilise le radar
      $("#boiteComptePlus .titre_colonne_cliquable").click((e) => {
        if ($(e.currentTarget).next().find("table:visible").attr("id"))
          localStorage.setItem("outiiil_boiteActive", "C");
        else localStorage.setItem("outiiil_boiteActive", "R");
        $("#boiteComptePlus .contenu_boite_compte_plus table").toggle();
      });
      // Remplissage de la boite
      this.actualiser();
    }
    return this;
  }
  /**
   * Rafraichie la boite radar quand un element est inséré ou retiré.
   *
   * @private
   * @method actualiseBoite
   */
  actualiser() {
    let affiche = localStorage.getItem("outiiil_boiteActive"),
      // En Compte+, le champ #requete natif vit dans une <tr><td> du table:eq(0)
      // qui est masqué en mode radar — donc inaccessible. On insère ici une row
      // jumelle dans le tfoot d'#o_radar (id `o_requete` pour éviter le duplicate
      // ID avec le natif resté en place côté table caché). Wiré sur l'autocomplete
      // Toolzzz (`Joueur.rechercher`) comme #recherche en non-C+.
      searchRow = Utils.comptePlus
        ? `<tr id='o_radarSearchRow'><td colspan='3'><form method='post' action='classementAlliance.php' style='text-align:center;'><input type='text' name='requete' id='o_requete' placeholder='Rechercher Joueur ou Alliance' autocomplete='off' style='text-align:center;width:95%;'/></form></td></tr>`
        : "",
      html = `<table id='o_radar' ${!affiche || affiche == "C" ? `style="display:none"` : ""}><colgroup><col><col><col></colgroup><tbody></tbody><tfoot><tr id='o_radarToolbar'><td colspan='3' class='right'><div id='o_radarToolbarInner'><a id='o_radarRefreshAll' class='o_actualiser' href='' title='Tout actualiser'><img src="${IMG_ACTUALISER}" alt="Tout actualiser" height="14"/></a><span id='o_radarAddSep' class='cursor' title='Ajouter une section'>+</span><span id='o_radarToggleEdit' class='cursor' title='Mode édition'>✎</span></div></td></tr>${searchRow}</tfoot></table>`;
    // on remplace le contenu ou l'ajoute
    if ($("#o_radar").length) $("#o_radar").replaceWith(html);
    else $("#boiteComptePlus .contenu_boite_compte_plus table").after(html);
    // Autocomplete sur le champ de recherche injecté en C+, branché sur le même
    // backend que `#recherche` non-C+ (Joueur.rechercher → Utils.extraitRecherche).
    // Réinit nécessaire à chaque rebuild car le DOM précédent est remplacé.
    if (Utils.comptePlus)
      $("#o_requete").autocomplete({
        source: (request, response) => {
          Joueur.rechercher(request.term).then((data) => response(Utils.extraitRecherche(data)));
        },
        position: { my: "left top-5", at: "left bottom" },
        delay: 0,
        minLength: 3,
        select: (event, ui) => {
          window.location.replace(ui.item.url);
        },
      });
    // Le `sortable` doit être (ré)initialisé à chaque rebuild de la table :
    // un `replaceWith` remplace le tbody par un nouveau noeud DOM qui n'a pas
    // l'instance jQuery UI sortable. Sans cette ligne, ajouter un joueur via
    // "Surveiller" cassait silencieusement le drag-and-drop jusqu'au prochain
    // reload de la page.
    $("#o_radar tbody").sortable({
      placeholder: "o_radarPlaceholder",
      // `cancel` empêche le drag de démarrer quand on clique sur un élément
      // listé : on ajoute `[contenteditable="true"]` pour qu'éditer un texte
      // de séparateur (mode édition) ne lance pas un drag par accident.
      cancel: 'input, textarea, button, select, option, [contenteditable="true"]',
      // Le drag-and-drop n'est actif qu'en mode édition (cf. UX iOS/Linear/
      // Notion : "Edit puis réordonne"). En vue normale, la liste est en
      // lecture seule pour éviter les mismanipulations.
      disabled: !this._modeEdition,
      update: (e, ui) => {
        this.calculeOrdre($("#o_radar tbody").sortable("serialize"));
      },
    });
    // Event pour mettre à jour les données d'un joueur ou une alliance
    $("#o_radar").off();
    // Rendu unifié des 3 collections, ordonnées par `ordreRadar` croissant.
    let entries = [];
    for (let p in this._joueurs)
      entries.push({ type: "joueur", obj: this._joueurs[p], ordre: this._joueurs[p].ordreRadar });
    for (let t in this._alliances)
      entries.push({
        type: "alliance",
        obj: this._alliances[t],
        ordre: this._alliances[t].ordreRadar,
      });
    for (let s of this._separateurs)
      entries.push({ type: "separateur", obj: s, ordre: s.ordreRadar });
    entries.sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
    let indice = 1;
    for (let e of entries) {
      if (e.type === "separateur") this._renderSeparateur(e.obj, indice++);
      else e.obj.getLigneRadar(this, "#o_radar tbody", indice++);
    }
    // Pour les rows joueur/alliance, on wrappe deux cellules :
    //  - 1re td dans `<div.o_radarFirstCell>` (flex) — le `≡` du mode édition
    //    s'alignait sinon sous l'icône refresh à cause d'une règle native
    //    Fourmizzz qui force `display: block` sur les `<a>` du panneau Compte+.
    //  - 3e td (terrain) dans `<span.o_radarTerrainNum>` — permet d'ellipsizer
    //    juste le nombre en mode édition sans manger le `×`.
    // Les wrappers sont posés indépendamment du mode édition (cosmétiquement
    // identiques sans le `≡` / sans l'ellipsis). `.detach()` préserve les
    // event handlers déjà bindés (notamment le click du `.o_actualiser`
    // et le `<a>` du terrain attaquable).
    $("#o_radar tbody tr:not(.o_radarSep)").each((_, tr) => {
      let $td1 = $(tr).find("td:first");
      if (!$td1.find(".o_radarFirstCell").length) {
        let $children = $td1.children().detach();
        $td1.append($("<div class='o_radarFirstCell'></div>").append($children));
      }
      let $td3 = $(tr).find("td:last");
      if (!$td3.find(".o_radarTerrainNum").length) {
        let $contents = $td3.contents().detach();
        $td3.append($("<span class='o_radarTerrainNum'></span>").append($contents));
      }
    });
    // Toolbar
    $("#o_radarRefreshAll").click((e) => {
      this._actualiserTout();
      return false;
    });
    $("#o_radarAddSep").click((e) => {
      e.stopPropagation();
      this.ajouteSeparateur().sauvegarder().actualiser();
      // En mode édition, focus + sélection du texte du nouveau séparateur
      // pour permettre de taper son nom directement (les `Section` par défaut
      // sont remplacés par la frappe vu que la sélection est active).
      if (this._modeEdition) {
        let nodes = $("#o_radar tbody .o_radarSep").last().find(".o_radarSepText");
        if (nodes.length) {
          let node = nodes[0];
          node.focus();
          let range = document.createRange();
          range.selectNodeContents(node);
          let sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    });
    $("#o_radarToggleEdit").click((e) => {
      e.stopPropagation();
      this._toggleEdit();
    });
    // Ré-applique le mode édition après chaque rebuild (le DOM des rows a
    // été régénéré, les × et `contenteditable` doivent être ré-attachés).
    if (this._modeEdition) this._appliquerEdition();
    return this;
  }
  /**
   * Rend une ligne séparateur dans le tbody. Wrapper `<div>` intérieur :
   * mettre `display: flex` directement sur un `<td>` casse le rendu table
   * (la cellule shrink à la largeur du contenu au lieu de remplir colspan),
   * d'où ce niveau d'indirection. Le `data-id` permet à calculeOrdre /
   * supprimeSeparateur / renommeSeparateur de retrouver l'entrée.
   */
  _renderSeparateur(sep, indice) {
    $("#o_radar tbody").append(
      `<tr id='o_item_${indice}' class='o_radarSep' data-id='${sep.id}'><td colspan='3'><div class='o_radarSepInner'><span class='o_radarSepText'>${BoiteRadar._escapeHtml(sep.texte)}</span></div></td></tr>`,
    );
  }
  /**
   * Échappement minimal pour les valeurs user-supplied injectées en HTML.
   */
  static _escapeHtml(s) {
    return String(s).replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  }
  /**
   * Refresh batch de toutes les entrées surveillées (joueurs + alliances) en
   * parallèle via Promise.all. Le navigateur cap naturellement à ~6 connexions
   * simultanées sur l'origine, donc 30 entrées finissent en quelques vagues
   * sans pool explicite. Les suppressions (joueurs disparus du jeu) sont
   * appliquées en différé pour éviter un rebuild DOM en plein batch — qui
   * casserait les highlights et les refresh en cours.
   *
   * @private
   * @method _actualiserTout
   */
  _actualiserTout() {
    let entries = [...Object.values(this._joueurs), ...Object.values(this._alliances)];
    if (!entries.length) return;
    let $btn = $("#o_radarRefreshAll");
    // Spin du bouton — même 600ms qu'une icône per-ligne. Pas de compteur ni de
    // disable : le batch va trop vite (~1-2s en pratique) pour que ça serve.
    $({ deg: 0 }).animate(
      { deg: 360 },
      {
        duration: 600,
        step: (now) => $btn.find("img").css({ transform: "rotate(" + now + "deg)" }),
      },
    );
    let refreshOne = (entry) =>
      entry
        .refreshDansRadar(this)
        .then((r) => ({ entry, ...r }))
        .catch(() => ({ entry, failed: true }));
    Promise.all(entries.map(refreshOne)).then((results) => {
      let removed = results.filter((r) => r.removed),
        changed = results.filter((r) => r.changed).length,
        failed = results.filter((r) => r.failed).length;
      removed.forEach((r) => {
        $.toast({ ...TOAST_WARNING, text: `Le joueur ${r.entry._pseudo} n'existe plus.` });
        this.supprimeJoueur(r.entry);
      });
      if (removed.length || changed) this.sauvegarder();
      if (failed) {
        $.toast({ ...TOAST_WARNING, text: `${failed} actualisation(s) échouée(s).` });
      }
      if (removed.length) this.actualiser();
    });
  }
  /**
   * Toggle du mode édition.
   */
  _toggleEdit() {
    this._modeEdition = !this._modeEdition;
    this._appliquerEdition();
  }
  /**
   * Applique (ou retire) les affordances du mode édition :
   *  - × cliquable à droite de chaque ligne (joueur, alliance ou séparateur)
   *  - séparateurs `contenteditable` pour rename inline
   */
  _appliquerEdition() {
    let on = this._modeEdition;
    $("#o_radar").toggleClass("o_radarEditMode", on);
    // Reset des affordances avant ré-application — actualiser() peut être
    // appelée alors que _modeEdition est déjà true (cas : ajout séparateur).
    $("#o_radar .o_radarDelete, #o_radar .o_radarDragHandle").remove();
    $(".o_radarSepText")
      .off("blur.radarSep keydown.radarSep input.radarSep")
      .removeAttr("contenteditable");
    $("#o_radar").off("click.radarDel");

    // Le drag-and-drop suit l'état du mode édition.
    if ($("#o_radar tbody").sortable("instance"))
      $("#o_radar tbody").sortable(on ? "enable" : "disable");

    if (!on) return;
    // Pour chaque ligne (joueur, alliance, séparateur) on injecte :
    //  - `≡` à gauche pour signaler le drag-and-drop
    //  - `×` à droite pour la suppression
    // Pour joueur/alliance, on les met dans la 1re et la dernière `<td>`.
    // Pour séparateur, on les met dans `.o_radarSepInner` (le flex container),
    // pour qu'ils deviennent flex items et restent alignés autour du texte.
    $("#o_radar tbody tr").each((i, tr) => {
      let $tr = $(tr);
      if ($tr.hasClass("o_radarSep")) {
        $tr
          .find(".o_radarSepInner")
          .prepend(`<span class='o_radarDragHandle' title='Glisser pour réordonner'>≡</span>`)
          .append(` <span class='o_radarDelete cursor red gras' title='Retirer'>×</span>`);
      } else {
        $tr
          .find(".o_radarFirstCell")
          .prepend(`<span class='o_radarDragHandle' title='Glisser pour réordonner'>≡</span>`);
        $tr
          .find("td:last")
          .append(` <span class='o_radarDelete cursor red gras' title='Retirer'>×</span>`);
      }
    });
    // Séparateurs : contenteditable + save on blur, Enter pour valider, et
    // cap dur à 16 caractères (le panneau Compte+ est étroit, au-delà le
    // texte serait tronqué visuellement par les pointillés du flex). On
    // tronque dynamiquement au lieu de bloquer l'input pour rester simple
    // (replace selection, paste, etc. sont tous gérés au même endroit).
    $(".o_radarSepText")
      .attr("contenteditable", "true")
      .on("blur.radarSep", (e) => {
        let id = $(e.currentTarget).closest("tr").attr("data-id");
        this.renommeSeparateur(id, $(e.currentTarget).text()).sauvegarder();
      })
      .on("keydown.radarSep", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          $(e.currentTarget).blur();
        }
      })
      .on("input.radarSep", (e) => {
        let node = e.currentTarget,
          text = $(node).text();
        if (text.length > 16) {
          $(node).text(text.substring(0, 16));
          let range = document.createRange();
          range.selectNodeContents(node);
          range.collapse(false);
          let sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
      });
    // Délégation sur #o_radar pour la suppression — les × sont des spans
    // ajoutés dynamiquement, et la délégation évite de re-bind à chaque rebuild.
    $("#o_radar").on("click.radarDel", ".o_radarDelete", (e) => {
      e.stopPropagation();
      let $tr = $(e.currentTarget).closest("tr");
      if ($tr.hasClass("o_radarSep")) {
        this.supprimeSeparateur($tr.attr("data-id"));
      } else {
        let lien = $tr.find("a:eq(1)"),
          href = lien.attr("href") || "",
          key = lien.text();
        if (href.includes("Membre.php")) delete this._joueurs[key];
        else delete this._alliances[key];
      }
      this.sauvegarder().actualiser();
    });
  }
}
