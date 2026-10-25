/*
 * Alliance.js
 * Hraesvelg
 **********************************************************************/

/**
 * Classe de fonction pour la page /alliance.php.
 *
 * @class PageAlliance
 * @constructor
 */
class PageAlliance {
  constructor() {
    /**
     * Creation du modele Alliance
     */
    this._alliance = new Alliance({ tag: Utils.alliance });
    /**
     * Grade natif du jeu par pseudo, proposé comme filtre sur la carte.
     */
    this._gradesNatifs = {};
    /**
     * Dernière liste complète de membres passée à la carte (avant filtrage).
     */
    this._carteMembres = null;
  }
  /**
   *
   */
  executer() {
    // Si le tableau des membres est déjà rendu, on enrichit directement.
    // Sinon, on observe `#alliance` pour réagir dès que le tableau apparaît
    // (rendu async sur certaines variantes de la page). Si aucun des deux
    // n'existe — page sans UI alliance, mobile, ou DOM atypique —, on skip
    // proprement plutôt que de crasher sur `observe(undefined)`.
    if ($("#tabMembresAlliance").length) {
      this.traitementMembre();
      this.carte();
      this.ongletCarte();
    } else if ($("#alliance").length) {
      let observer = new MutationObserver((mutationsList) => {
        this.traitementMembre();
        this.carte();
        this.ongletCarte();
        observer.disconnect();
      });
      observer.observe($("#alliance")[0], { childList: true });
    }
    return this;
  }
  /**
   * Affiche les modifications du tableau des membres.
   *
   * @private
   * @method traitementMembre
   */
  traitementMembre() {
    $("#tabMembresAlliance td:eq(5)").css("white-space", "nowrap");
    $(".simulateur table[class='ligne_paire'] tr:eq(0) td:eq(1)").append(
      ` (${$("img[alt='Actif']").length})`,
    );
    $(".simulateur table[class='ligne_paire'] tr:eq(0) td:eq(3)").append(
      ` (${$("img[alt='Vacances']").length})`,
    );
    $(".simulateur table[class='ligne_paire'] tr:eq(1) td:eq(1)").append(
      ` (${$("img[alt='Inactif depuis 3 jours']").length})`,
    );
    $(".simulateur table[class='ligne_paire'] tr:eq(1) td:eq(3)").append(
      ` (${$("img[alt='Bannie']").length})`,
    );
    $(".simulateur table[class='ligne_paire'] tr:eq(2) td:eq(1)").append(
      ` (${$("img[alt='Inactif depuis 10 jours']").length})`,
    );
    $(".simulateur table[class='ligne_paire'] tr:eq(2) td:eq(3)").append(
      ` (${$("img[alt='Colonisé']").length})`,
    );
    // ajout des totaux de l'alliance
    let tmpJoueurs = {};
    $("#tabMembresAlliance tr:gt(0)").each((i, elt) => {
      let pseudo = $(elt).find("td:eq(3)").text(),
        terrain = numeral($(elt).find("td:eq(5)").text()).value();
      tmpJoueurs[pseudo] = new Joueur({
        pseudo: pseudo,
        terrain: terrain,
        fourmiliere: ~~$(elt).find("td:eq(8)").text(),
        technologie: ~~$(elt).find("td:eq(7)").text(),
        // grade natif du jeu
        rang: $(elt).find("td:eq(2)").text().trim().replace(/\//g, "-"),
      });
      this._gradesNatifs[pseudo] = tmpJoueurs[pseudo].rang;
      if (!Utils.comptePlus && !tmpJoueurs[pseudo].estJoueurCourant()) {
        if (tmpJoueurs[pseudo].estAttaquable())
          $(elt).find("td:eq(6)").html(Joueur.lienAttaque(pseudo));
        if (tmpJoueurs[pseudo].estAttaquant()) $(elt).find("td:eq(4)").html(IMG_DEF);
      }
    });
    this._alliance.joueurs = tmpJoueurs;
    Joueur.activerLiensAttaque();

    $("#tabMembresAlliance").append(
      `<tfoot class='${Object.keys(this._alliance.joueurs).length % 2 ? "ligne_paire" : ""}'><tr class='gras centre'><td colspan='12'>Terrain : <span id='totalTerrain'>${numeral(this._alliance.calculTerrain()).format()}</span> cm² | Fourmilière : ${numeral(this._alliance.calculFourmiliere()).format()} | Technologie : ${numeral(this._alliance.calculTechnologie()).format()}.</td></tr></tfoot>`,
    );
    $("#tabMembresAlliance tr:first").remove();
    $("#tabMembresAlliance").prepend(
      `<thead><tr class='alt'><th></th><th></th><th>Rang</th><th>Pseudo</th><th></th><th>Terrain</th><th></th><th><span style='padding-right:10px'>Technologie</span></th><th><span style='padding-right:10px'>Fourmiliere</span></th><th colspan='2'>Etat</th><th></th></tr></thead>`,
    );

    this.tableauAvecCarteCache();
    return this;
  }
  /**
   * Variante de tableau() qui utilise le cache local de la Carte de l'alliance
   * (rempli via le bouton "Charger / Actualiser") pour ajouter les colonnes
   * Tdt + Retour.
   * Si pas de cache → fallback sur tableau() basique.
   *
   * @method tableauAvecCarteCache
   */
  tableauAvecCarteCache() {
    const cacheKey = `outiiil_carteAlliance_${Utils.serveur}_${Utils.alliance}`;
    let cached = null;
    try {
      cached = JSON.parse(localStorage.getItem(cacheKey));
    } catch (e) {
      cached = null;
    }
    const hasCache = cached && cached.members && cached.members.length;
    if (hasCache) {
      // Hydrate les coords depuis le cache
      const coordsByPseudo = new Map();
      cached.members.forEach((m) => coordsByPseudo.set(m.pseudo, { x: m.x, y: m.y }));
      for (const pseudo in this._alliance.joueurs) {
        if (coordsByPseudo.has(pseudo)) {
          Object.assign(this._alliance.joueurs[pseudo], coordsByPseudo.get(pseudo));
        }
      }
      // Ajoute les colonnes Tdt + Retour entre Fourmilière et Etat
      $("#tabMembresAlliance th:eq(8)").after(`<th>Tdt</th><th>Retour</th>`);
      $("#tabMembresAlliance tfoot td:eq(0)").attr("colspan", 14);
      $("#tabMembresAlliance tr:gt(0):lt(-1)").each((i, elt) => {
        const pseudo = $(elt).find("td:eq(3)").text();
        const j = this._alliance.joueurs[pseudo];
        const has = j && j.x !== -1 && j.y !== -1;
        let tdHtml;
        if (has) {
          const tdt = monProfil.getTempsParcours2(j);
          const retour = Utils.roundMinute(tdt, Horloge.clic());
          // data-order : DataTable trie sur l'attribut (entier brut) plutôt que sur
          // le texte affiché ("22h 31m" sinon trié en alphabétique).
          tdHtml = `<td data-order='${tdt}'>${Utils.intToTime(tdt)}</td><td data-order='${retour.unix()}'>${retour.format("D MMM à HH[h]mm")}</td>`;
        } else {
          tdHtml = `<td data-order='-1'>N/C</td><td data-order='-1'>N/C</td>`;
        }
        $(elt).find("td:eq(8)").after(tdHtml);
      });
      // DataTable — targets ajustés vs tableau() : Etat-2 et last passent de 10/11 à 12/13
      $("#tabMembresAlliance th:eq(7), #tabMembresAlliance th:eq(8)").css({
        maxWidth: "50px",
        textOverflow: "ellipsis",
        overflow: "hidden",
      });
      AllianceFzzz.colonnes();
      $("#tabMembresAlliance").DataTable({
        bInfo: false,
        bPaginate: false,
        bAutoWidth: false,
        dom: "Bfrti",
        buttons: [],
        order: [],
        stripeClasses: ["", "alt"],
        responsive: false, // Fzzz : le repli des colonnes (bouton +) cachait les colonnes ajoutées
        language: {
          zeroRecords: "Aucun joueur trouvé",
          infoEmpty: "Aucun enregistrement",
          infoFiltered: "(Filtré par _MAX_ enregistrements)",
          search: "Rechercher : ",
        },
        columnDefs: [
          { type: "quantite-grade", targets: 5 },
          { sortable: false, targets: [0, 1, 4, 6, 12, 13] },
        ],
      });
    } else {
      this.tableau();
    }
    // Fzzz : vues Temps de trajet (ancien « Synchroniser ») / Reset / Floods et
    // chasses en cours, et évolution du TdC au survol (AllianceFzzz)
    AllianceFzzz.installer((progres) => this._fetchAndCacheCoords(progres), !!hasCache);
    return this;
  }
  /**
   * Ajoute le tri.
   *
   * @private
   * @method tableau
   */
  tableau() {
    $("#tabMembresAlliance th:eq(7), #tabMembresAlliance th:eq(8)").css({
      maxWidth: "50px",
      textOverflow: "ellipsis",
      overflow: "hidden",
    });
    AllianceFzzz.colonnes();
    $("#tabMembresAlliance").DataTable({
      bInfo: false,
      bPaginate: false,
      bAutoWidth: false,
      dom: "Bfrti",
      buttons: [],
      order: [],
      stripeClasses: ["", "alt"],
      responsive: false, // Fzzz : le repli des colonnes (bouton +) cachait les colonnes ajoutées
      language: {
        zeroRecords: "Aucun joueur trouvé",
        infoEmpty: "Aucun enregistrement",
        infoFiltered: "(Filtré par _MAX_ enregistrements)",
        search: "Rechercher : ",
      },
      columnDefs: [
        { type: "quantite-grade", targets: 5 },
        { sortable: false, targets: [0, 1, 4, 6, 10, 11] },
      ],
    });
    return this;
  }
  /**
   * Injecte la section "Carte de l'alliance" en bas de la page.
   * Charge depuis localStorage si dispo ; refresh manuel via bouton.
   *
   * @method carte
   */
  carte() {
    if ($("#o_carteAlliance").length) return this; // déjà rendue
    const cacheKey = `outiiil_carteAlliance_${Utils.serveur}_${Utils.alliance}`;
    $("#alliance").after(`
      <div id='o_carteAlliance' class='boite_amelioration simulateur centre' style='display:none;'>
        <h2>Carte de l'alliance</h2>
        <p class='reduce'>Carte interactive des positions des membres. <b>Survole</b> un point pour voir les temps de trajet depuis ta fourmilière. <b>Drag</b> pour zoomer sur une zone, <b>clic</b> sur un point pour zoomer 4× dessus (utile dans les clusters denses). Données chargées à la demande puis mises en cache localement.</p>
        <div class='centre o_marginT15'>
          <button id='o_carteAllianceRefresh' class='o_button f_info'>Charger / Actualiser</button>
          <button id='o_carteAllianceExportForum' class='o_button f_success' style='margin-left:8px;'>Exporter pour le forum</button>
          <span id='o_carteAllianceStatus' class='reduce' style='margin-left:12px;color:#666;'></span>
        </div>
        <div id='o_carteFiltres' class='left o_marginT15' style='display:none;'></div>
        <div id='o_carteAllianceChart' style='height:800px;margin-top:15px;display:none;'></div>
        <div id='o_carteChaine' class='o_marginT15' style='display:none;'>
          <div class='centre gras'>Chaîne entre plus proches voisins</div>
          <p class='reduce'>Ordre de passage qui minimise le temps de trajet total entre les membres affichés : chacun envoie au suivant. Les joueurs décochés dans les filtres sont exclus. Temps sans amélioration de Vitesse d'attaque.</p>
          <div class='centre o_marginT15'>
            <label>Départ <select id='o_chaineDepart'></select></label>
            <label style='margin-left:12px;'><input type='checkbox' id='o_chaineTracer'/> Tracer sur la carte</label>
            <button id='o_chaineCopier' class='o_button f_success' style='margin-left:12px;'>Copier pour le forum</button>
          </div>
          <table id='o_chaineListe' class='o_maxWidth centre o_marginT15' cellspacing='0'></table>
        </div>
      </div>
    `);
    let cached = null;
    try {
      cached = JSON.parse(localStorage.getItem(cacheKey));
    } catch (e) {
      cached = null;
    }
    // les versions qui ne lisaient pas le lien carte.php de s5 ont mis en cache
    // des membres en 0 / 0 : on les ignore (un Actualiser les repositionne)
    if (cached && cached.members)
      cached.members = cached.members.filter((m) => !(m.x == 0 && m.y == 0));
    if (cached && cached.members && cached.members.length) {
      this._renderCarte(cached.members);
      this._afficherAge(cached.timestamp);
    }
    $("#o_carteAllianceRefresh").click(() => this._actualiserCarte());
    $("#o_carteAllianceExportForum").click(() => this._exporterCarteForumPng());
    this._evenementsChaine();
    return this;
  }
  /**
   * Active l'onglet "Carte" du menu Alliance (injecté par content.js sur toutes
   * les pages) : intercepte le clic pour un toggle client-side, et bascule
   * automatiquement si la page est chargée avec le hash #carte (cas où on
   * arrive depuis une autre page d'alliance).
   *
   * @method ongletCarte
   */
  ongletCarte() {
    if (!$("#o_ongletCarte").length) return this;
    const showCarte = () => {
      $("#alliance").hide();
      $("#o_carteAlliance").show();
    };
    $("#o_ongletCarte").click((e) => {
      e.preventDefault();
      showCarte();
    });
    if (location.hash === "#carte") showCarte();
    return this;
  }
  /**
   * Fetch des coords pour tous les membres + persistance localStorage.
   * Ne touche pas à l'UI — résolveurs (Carte / tableau Membres) gèrent leur propre feedback.
   *
   * @private
   * @method _fetchAndCacheCoords
   * @returns {Promise<{members, timestamp}>}
   */
  _fetchAndCacheCoords(progres = () => {}) {
    const pseudos = Object.keys(this._alliance.joueurs);
    if (!pseudos.length) {
      return Promise.reject(new Error("Aucun membre détecté dans l'alliance."));
    }
    const cacheKey = `outiiil_carteAlliance_${Utils.serveur}_${Utils.alliance}`;
    let faits = 0;
    const promises = pseudos.map((pseudo) => {
      const joueur = this._alliance.joueurs[pseudo];
      return joueur
        .getProfil()
        .then((html) => {
          joueur.chargerProfil(html);
          return joueur;
        })
        .catch(() => null)
        .then((j) => {
          progres(++faits, pseudos.length);
          return j;
        });
    });
    return Promise.all(promises).then((joueurs) => {
      const members = joueurs
        .filter((j) => j && j.x !== -1 && j.y !== -1)
        .map((j) => ({
          pseudo: j.pseudo,
          x: j.x,
          y: j.y,
          terrain: j.terrain || 0,
        }));
      if (!members.length) throw new Error("Aucune coordonnée récupérée.");
      const timestamp = Date.now();
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ timestamp, members }));
      } catch (e) {
        console.warn("outiiil: localStorage write failed", e);
      }
      return { members, timestamp };
    });
  }
  /**
   * Refresh de la Carte (UI Carte + render Highcharts).
   *
   * @private
   * @method _actualiserCarte
   */
  _actualiserCarte() {
    const pseudos = Object.keys(this._alliance.joueurs),
      liberer = () => {
        $("#o_carteAllianceRefresh").prop("disabled", false).text("Charger / Actualiser");
        $("#o_carteAllianceExportForum").prop("disabled", false);
      };
    // bloqués pendant le chargement : les profils partent un par un
    $("#o_carteAllianceRefresh")
      .prop("disabled", true)
      .text(`Chargement des profils… (0/${pseudos.length})`);
    $("#o_carteAllianceExportForum").prop("disabled", true);
    $("#o_carteAllianceStatus").text("");
    this._fetchAndCacheCoords((faits, total) =>
      $("#o_carteAllianceRefresh").text(`Chargement des profils… (${faits}/${total})`),
    )
      .then(({ members, timestamp }) => {
        liberer();
        $.toast({
          ...TOAST_SUCCESS,
          text: `Carte mise à jour : ${members.length} membres positionnés.`,
        });
        this._afficherAge(timestamp);
        this._renderCarte(members);
      })
      .catch((err) => {
        liberer();
        $.toast({
          ...TOAST_ERROR,
          text: err.message || "Erreur lors du chargement des profils.",
        });
      });
  }
  /**
   * Génère un PNG simple dessiné sur canvas, avec les vraies proportions du jeu
   * (1 case = 5 unités X × 50 unités Y, donc pxPerY = pxPerX / 10). Image étroite
   * et haute, sans grille ni axes — pensée pour partager dans le forum d'alliance.
   * Utilise directement le cache des coords (pas besoin que le chart Highcharts
   * soit rendu).
   *
   * @private
   * @method _exporterCarteForumPng
   */
  _exporterCarteForumPng() {
    const cacheKey = `outiiil_carteAlliance_${Utils.serveur}_${Utils.alliance}`;
    let cached = null;
    try {
      cached = JSON.parse(localStorage.getItem(cacheKey));
    } catch (e) {
      cached = null;
    }
    if (!cached || !cached.members || !cached.members.length) {
      $.toast({
        ...TOAST_WARNING,
        text: "Charge d'abord la carte avant de pouvoir l'exporter pour le forum.",
      });
      return;
    }
    // même sélection que la carte à l'écran
    if (!this._filtres) this._filtres = this._chargerFiltres();
    const members = this._filtrerMembres(this._carteMembres || cached.members);
    if (!members.length) {
      $.toast({
        ...TOAST_WARNING,
        text: "Aucun membre affiché : élargis les filtres avant d'exporter.",
      });
      return;
    }
    const xs = members.map((m) => m.x);
    const ys = members.map((m) => m.y);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    // Échelle : 1 case du jeu = 5 X × 50 Y → pxPerY = pxPerX / 10 pour rendre les
    // cellules visuellement carrées (proportions réelles).
    const PX_PER_X = 14;
    const PX_PER_Y = PX_PER_X / 10;
    // Padding suffisant pour les graduations d'axes (X en haut, Y à gauche)
    const PAD_LEFT = 38;
    const PAD_TOP = 26;
    const PAD_BOTTOM = 16;
    const PAD_RIGHT_MIN = 16;
    const LABEL_LINE_H = 13;
    const LABEL_GAP = 8;
    // Pré-mesure des largeurs de label sur un canvas temporaire pour calculer les
    // collisions avant de dimensionner le vrai canvas.
    const tmp = document.createElement("canvas").getContext("2d");
    tmp.font = "bold 11px sans-serif";
    // Tri haut→bas, gauche→droite : algo glouton qui décale les labels vers le bas
    // dès qu'ils chevaucheraient un label déjà placé.
    const sorted = [...members].sort((a, b) => a.y - b.y || a.x - b.x);
    const placed = [];
    const positions = sorted.map((m) => {
      const dotX = (m.x - xMin) * PX_PER_X + PAD_LEFT;
      const dotY = (m.y - yMin) * PX_PER_Y + PAD_TOP;
      const labelW = tmp.measureText(m.pseudo).width;
      const labelX = dotX + LABEL_GAP;
      let labelY = dotY;
      while (
        placed.some(
          (p) =>
            labelX < p.x + p.w + 4 &&
            labelX + labelW + 4 > p.x &&
            Math.abs(labelY - p.y) < LABEL_LINE_H,
        )
      ) {
        labelY += LABEL_LINE_H;
      }
      placed.push({ x: labelX, y: labelY, w: labelW });
      return { m, dotX, dotY, labelX, labelY, labelW };
    });
    // Dimensions du canvas en fonction des positions finales (labels potentiellement
    // décalés vers le bas en cas de cluster dense). On étend aussi pour couvrir le
    // tick supérieur arrondi (ceil) afin que le 50 / 1900 / etc. soit toujours visible.
    const maxRight = Math.max(...positions.map((p) => p.labelX + p.labelW));
    const maxBottom = Math.max(...positions.map((p) => Math.max(p.labelY + 6, p.dotY + 4)));
    const yRange = yMax - yMin;
    const yStep = yRange > 1500 ? 200 : yRange > 500 ? 100 : 50;
    const xStep = 5;
    const xTickEnd = Math.ceil(xMax / xStep) * xStep;
    const yTickEnd = Math.ceil(yMax / yStep) * yStep;
    const tickRight = (xTickEnd - xMin) * PX_PER_X + PAD_LEFT;
    const tickBottom = (yTickEnd - yMin) * PX_PER_Y + PAD_TOP;
    const W = Math.max(220, Math.max(maxRight, tickRight) + PAD_RIGHT_MIN);
    const H = Math.max(220, Math.max(maxBottom, tickBottom) + PAD_BOTTOM);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(W);
    canvas.height = Math.round(H);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Graduations d'axes — yStep et xStep déjà calculés plus haut.
    ctx.strokeStyle = "#eee";
    ctx.lineWidth = 0.5;
    ctx.fillStyle = "#888";
    ctx.font = "10px sans-serif";
    // Grille verticale (X) + labels en haut. Ceil sur la borne sup pour inclure 50, etc.
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    const xGridStart = Math.floor(xMin / xStep) * xStep;
    for (let x = xGridStart; x <= xTickEnd; x += xStep) {
      if (x < xMin) continue;
      const px = (x - xMin) * PX_PER_X + PAD_LEFT;
      ctx.beginPath();
      ctx.moveTo(px, PAD_TOP);
      ctx.lineTo(px, canvas.height - PAD_BOTTOM);
      ctx.stroke();
      ctx.fillText(x.toString(), px, PAD_TOP - 6);
    }
    // Grille horizontale (Y) + labels à gauche. Ceil sur la borne sup pour inclure 1900, etc.
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    const yGridStart = Math.floor(yMin / yStep) * yStep;
    for (let y = yGridStart; y <= yTickEnd; y += yStep) {
      if (y < yMin) continue;
      const py = (y - yMin) * PX_PER_Y + PAD_TOP;
      ctx.beginPath();
      ctx.moveTo(PAD_LEFT, py);
      ctx.lineTo(canvas.width - PAD_RIGHT_MIN, py);
      ctx.stroke();
      ctx.fillText(y.toString(), PAD_LEFT - 4, py);
    }
    ctx.font = "bold 11px sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    for (const pos of positions) {
      const { m, dotX, dotY, labelX, labelY } = pos;
      // Connecteur fin gris si le label a été décalé pour éviter une collision —
      // sinon on ne sait plus quel label appartient à quel dot.
      if (Math.abs(labelY - dotY) > 1) {
        ctx.strokeStyle = "#bbb";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(dotX + 4, dotY);
        ctx.lineTo(labelX - 1, labelY);
        ctx.stroke();
      }
      // Toutes les fourmilières en rouge — l'image est destinée au forum (partage),
      // pas de raison de mettre en évidence l'auteur.
      ctx.fillStyle = "#c0392b";
      ctx.beginPath();
      ctx.arc(dotX, dotY, 4, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.fillText(m.pseudo, labelX, labelY);
    }
    canvas.toBlob((blob) => {
      if (!blob) {
        $.toast({ ...TOAST_ERROR, text: "Erreur lors de la génération du PNG forum." });
        return;
      }
      const date = new Date().toISOString().slice(0, 10);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `toolzzz-carte-forum-${Utils.alliance}-${date}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    }, "image/png");
  }
  /**
   * Affiche le timestamp en texte humain à côté du bouton.
   *
   * @private
   * @method _afficherAge
   */
  _afficherAge(timestamp) {
    const minutes = Math.floor((Date.now() - timestamp) / 60000);
    let age;
    if (minutes < 1) age = "à l'instant";
    else if (minutes < 60) age = `il y a ${minutes} min`;
    else if (minutes < 1440) age = `il y a ${Math.floor(minutes / 60)}h`;
    else age = `il y a ${Math.floor(minutes / 1440)}j`;
    $("#o_carteAllianceStatus").text(`Données ${age}`);
  }
  /**
   * Clé de persistance de la sélection des filtres (par serveur et alliance).
   *
   * @private
   * @method _cleFiltres
   */
  _cleFiltres() {
    return `outiiil_carteFiltres_${Utils.serveur}_${Utils.alliance}`;
  }
  /**
   * Sélection courante. On mémorise ce qui est *masqué* et non ce qui est
   * affiché : un membre ou un grade apparu depuis la dernière visite est
   * visible par défaut, au lieu d'être silencieusement absent de la carte.
   *
   * @private
   * @method _chargerFiltres
   */
  _chargerFiltres() {
    let f = {};
    try {
      f = JSON.parse(localStorage.getItem(this._cleFiltres())) || {};
    } catch (e) {
      f = {};
    }
    return {
      grades: f.grades || [],
      joueurs: f.joueurs || [],
    };
  }
  /**
   *
   * @private
   * @method _sauverFiltres
   */
  _sauverFiltres() {
    try {
      localStorage.setItem(this._cleFiltres(), JSON.stringify(this._filtres));
    } catch (e) {
      console.warn("outiiil: localStorage write failed", e);
    }
    return this;
  }
  /**
   * Grade natif du jeu d'un membre.
   *
   * @private
   * @method _gradeDe
   */
  _gradeDe(pseudo) {
    return this._gradesNatifs[pseudo] || "Sans grade";
  }
  /**
   * Applique la sélection à une liste de membres.
   *
   * @private
   * @method _filtrerMembres
   */
  _filtrerMembres(membres) {
    let f = this._filtres;
    return membres.filter((m) => {
      return f.grades.indexOf(this._gradeDe(m.pseudo)) == -1 && f.joueurs.indexOf(m.pseudo) == -1;
    });
  }
  /**
   * Construit le bloc de filtres : une case par grade et la liste dépliable
   * des joueurs.
   *
   * @private
   * @method _construireFiltres
   */
  _construireFiltres(membres) {
    const esc = (t) => $("<div>").text(t).html();
    // Un grade d'alliance est du texte libre : chaque chef y met ce qu'il veut,
    // souvent long et décoré. On n'essaie pas de deviner sa mise en forme, on
    // se contente de retirer les remplisseurs invisibles (U+3164, espaces
    // insécables…) qui creusent des trous dans la liste, et de tronquer pour
    // que les cases restent alignées. Le libellé complet est en infobulle et
    // la valeur filtrée reste le grade brut.
    const lisible = (t) => {
      let net = t
        .replace(/[\u3164\u00a0\u200b\u2800]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return esc(net.length > 34 ? net.slice(0, 34) + "…" : net || t);
    };
    // valeurs passées par index : un grade peut contenir n'importe quel caractère
    let compte = (valeur, accesseur) =>
        membres.filter((m) => accesseur.call(this, m.pseudo) == valeur).length,
      // grades les plus portés en tête : dans beaucoup d'alliances chaque
      // membre a son grade décoratif à lui, et les rares grades partagés
      // (VIP, passeurs…) sont justement ceux sur lesquels on veut filtrer
      parEffectif = (accesseur) => (a, b) =>
        compte(b, accesseur) - compte(a, accesseur) || a.localeCompare(b),
      grades = [...new Set(membres.map((m) => this._gradeDe(m.pseudo)))].sort(
        parEffectif(this._gradeDe),
      ),
      pseudos = membres.map((m) => m.pseudo).sort(),
      cases = (liste, classe, accesseur) =>
        liste
          .map(
            (v, i) =>
              `<label title='${esc(v)}'><input type='checkbox' class='${classe}' data-i='${i}'/> ${lisible(v)}${accesseur ? ` <span class='reduce'>(${compte(v, accesseur)})</span>` : ""}</label>`,
          )
          .join("");
    this._filtresValeurs = { grades: grades, joueurs: pseudos };
    // un grade unique par membre ne regroupe rien : on le signale plutôt que
    // d'afficher une liste de grades qui double celle des joueurs
    let partages = grades.filter((g) => compte(g, this._gradeDe) > 1).length;
    // Chaque section est repliée par défaut pour ne pas alourdir la page. Le
    // titre indique combien d'entrées sont masquées, pour qu'un filtre actif
    // reste visible même section fermée.
    let section = (id, titre, contenu) =>
      `<p class='left reduce gras'>${titre} <span id='${id}Masques' class='reduce' style='font-weight:normal;'></span> <span class='o_filtreVoir cliquable2 cursor' data-cible='${id}' style='font-size:0.8em;font-weight:normal;'>Afficher la liste</span></p>
      <div id='${id}' style='display:none;'>${contenu}</div>`;
    let html = section(
      "o_filtreGrades",
      "Grades",
      `${partages ? "" : `<p class='left small'><em>Chaque membre a un grade différent dans cette alliance : la liste des joueurs sera sans doute plus pratique.</em></p>`}
        <div>${cases(grades, "o_filtreGrade", this._gradeDe)}</div>`,
    );
    html += section(
      "o_filtreJoueurs",
      "Joueurs",
      `<p class='left small'><em><span id='o_filtreTout' class='souligne cursor'>Tout cocher</span> · <span id='o_filtreAucun' class='souligne cursor'>Tout décocher</span></em></p>
        <div>${cases(pseudos, "o_filtreJoueur", null)}</div>`,
    );
    $("#o_carteFiltres").html(html).show();
    // état initial des cases depuis la sélection mémorisée
    let poser = (classe, valeurs, exclus) =>
      $("." + classe).each((i, elt) => {
        $(elt).prop("checked", exclus.indexOf(valeurs[$(elt).data("i")]) == -1);
      });
    poser("o_filtreGrade", grades, this._filtres.grades);
    poser("o_filtreJoueur", pseudos, this._filtres.joueurs);
    let afficherMasques = () => {
      let libelle = (n) => (n ? `(${n} masqué${n > 1 ? "s" : ""})` : "");
      $("#o_filtreGradesMasques").text(libelle(this._filtres.grades.length));
      $("#o_filtreJoueursMasques").text(libelle(this._filtres.joueurs.length));
    };
    afficherMasques();
    let appliquer = () => {
      let lire = (classe, valeurs) =>
        $("." + classe)
          .filter((i, elt) => !elt.checked)
          .map((i, elt) => valeurs[$(elt).data("i")])
          .get();
      this._filtres = {
        grades: lire("o_filtreGrade", grades),
        joueurs: lire("o_filtreJoueur", pseudos),
      };
      this._sauverFiltres();
      afficherMasques();
      this._dessinerCarte(this._filtrerMembres(this._carteMembres), this._carteMembres.length);
    };
    $("#o_carteFiltres input[type=checkbox]").on("change", appliquer);
    $("#o_carteFiltres .o_filtreVoir").click((e) => {
      let cible = $("#" + $(e.currentTarget).data("cible"));
      cible.toggle();
      $(e.currentTarget).text(cible.is(":visible") ? "Masquer la liste" : "Afficher la liste");
    });
    $("#o_filtreTout").click(() => {
      $(".o_filtreJoueur").prop("checked", true);
      appliquer();
    });
    $("#o_filtreAucun").click(() => {
      $(".o_filtreJoueur").prop("checked", false);
      appliquer();
    });
    return this;
  }
  /**
   * Options de la chaîne (départ, tracé), mémorisées par alliance.
   *
   * @private
   * @method _chargerOptionsChaine
   */
  _chargerOptionsChaine() {
    let o = {};
    try {
      o =
        JSON.parse(
          localStorage.getItem(`outiiil_carteChaine_${Utils.serveur}_${Utils.alliance}`),
        ) || {};
    } catch (e) {
      o = {};
    }
    return { depart: o.depart || "", tracer: !!o.tracer };
  }
  /**
   * @private
   * @method _sauverOptionsChaine
   */
  _sauverOptionsChaine() {
    try {
      localStorage.setItem(
        `outiiil_carteChaine_${Utils.serveur}_${Utils.alliance}`,
        JSON.stringify(this._optionsChaine),
      );
    } catch (e) {
      console.warn("outiiil: localStorage write failed", e);
    }
    return this;
  }
  /**
   * @private
   * @method _evenementsChaine
   */
  _evenementsChaine() {
    if (!this._optionsChaine) this._optionsChaine = this._chargerOptionsChaine();
    $("#o_chaineTracer").prop("checked", this._optionsChaine.tracer);
    let redessiner = () => {
      this._optionsChaine = {
        depart: $("#o_chaineDepart").val() || "",
        tracer: $("#o_chaineTracer").prop("checked"),
      };
      this._sauverOptionsChaine();
      if (this._carteMembres)
        this._dessinerCarte(this._filtrerMembres(this._carteMembres), this._carteMembres.length);
    };
    $("#o_chaineDepart, #o_chaineTracer").on("change", redessiner);
    let copie = new Clipboard("#o_chaineCopier", { text: () => this._texteChaine() });
    copie.on("success", () => {
      $.toast({ ...TOAST_SUCCESS, text: "La chaîne a été copiée dans le presse papier." });
    });
    copie.on("error", () => {
      $.toast({ ...TOAST_ERROR, text: "Une erreur a été rencontrée, la copie a échoué." });
    });
    return this;
  }
  /**
   * Temps de trajet de base (sans Vitesse d'attaque) entre deux fourmilières.
   *
   * @private
   * @method _tempsEntre
   */
  _tempsEntre(a, b) {
    return Math.round(637200 * (1 - Math.exp(-Math.hypot(a.x - b.x, a.y - b.y) / 350)));
  }
  /**
   * Ordre de passage qui minimise la somme des temps de trajet : plus proche
   * voisin depuis le départ, puis amélioration 2-opt (on inverse un morceau du
   * parcours tant que ça raccourcit le total). Avec quelques dizaines de membres
   * c'est instantané, et en pratique très proche de l'optimum.
   *
   * @private
   * @method _calculerChaine
   * @param {Array} membres membres affichés
   * @param {Object} depart membre de départ
   */
  _calculerChaine(membres, depart) {
    let ordre = [depart],
      restants = membres.filter((m) => m !== depart);
    while (restants.length) {
      let dernier = ordre[ordre.length - 1],
        i = 0;
      restants.forEach((m, j) => {
        if (this._tempsEntre(dernier, m) < this._tempsEntre(dernier, restants[i])) i = j;
      });
      ordre.push(restants.splice(i, 1)[0]);
    }
    const n = ordre.length,
      t = (a, b) => (a && b ? this._tempsEntre(a, b) : 0),
      // suivant de la position k : rien en bout de chaîne
      suivant = (k) => (k + 1 < n ? ordre[k + 1] : null);
    let ameliore = n > 3;
    while (ameliore) {
      ameliore = false;
      for (let i = 1; i < n - 1; i++)
        for (let k = i + 1; k < n; k++) {
          let avant = t(ordre[i - 1], ordre[i]) + t(ordre[k], suivant(k)),
            apres = t(ordre[i - 1], ordre[k]) + t(ordre[i], suivant(k));
          if (apres < avant) {
            ordre = [
              ...ordre.slice(0, i),
              ...ordre.slice(i, k + 1).reverse(),
              ...ordre.slice(k + 1),
            ];
            ameliore = true;
          }
        }
    }
    return this._chaineDepuisOrdre(ordre);
  }
  /**
   * Temps de chaque étape d'un ordre de passage donné.
   *
   * @private
   * @method _chaineDepuisOrdre
   */
  _chaineDepuisOrdre(ordre) {
    let etapes = ordre.slice(1).map((m, k) => this._tempsEntre(ordre[k], m));
    return {
      ordre: ordre,
      etapes: etapes,
      total: etapes.reduce((s, v) => s + v, 0),
      max: etapes.length ? Math.max(...etapes) : 0,
    };
  }
  /**
   * Départ libre : on essaie chaque membre comme départ et on garde la chaîne
   * la plus courte, orientée du bas vers le haut de la carte (la parcourir dans
   * un sens ou dans l'autre prend le même temps).
   *
   * @private
   * @method _chaineLaPlusCourte
   */
  _chaineLaPlusCourte(membres) {
    let c = membres
      .map((m) => this._calculerChaine(membres, m))
      .reduce((a, b) => (b.total < a.total ? b : a));
    if (c.ordre[0].y > c.ordre[c.ordre.length - 1].y) {
      c.ordre.reverse();
      c.etapes.reverse();
    }
    return c;
  }
  /**
   * Recalcule la chaîne sur les membres affichés et remplit le tableau sous la
   * carte. Renvoie null s'il n'y a pas assez de membres.
   *
   * @private
   * @method _majChaine
   */
  _majChaine(membres) {
    if (!this._optionsChaine) this._optionsChaine = this._chargerOptionsChaine();
    $("#o_carteChaine").show();
    let pseudos = membres.map((m) => m.pseudo).sort((a, b) => a.localeCompare(b)),
      // sans départ choisi (ou s'il n'est plus affiché), départ libre
      depart = membres.find((m) => m.pseudo === this._optionsChaine.depart);
    $("#o_chaineDepart").html(
      `<option value=''>Le plus court (départ libre)</option>` +
        pseudos
          .map(
            (p) =>
              `<option value='${$("<div>").text(p).html()}'>${$("<div>").text(p).html()}</option>`,
          )
          .join(""),
    );
    $("#o_chaineDepart").val(depart ? depart.pseudo : "");
    if (membres.length < 2) {
      this._chaine = null;
      $("#o_chaineListe").html(
        "<tr><td><em>Il faut au moins deux membres affichés pour former une chaîne.</em></td></tr>",
      );
      $("#o_chaineCopier").prop("disabled", true);
      return null;
    }
    $("#o_chaineCopier").prop("disabled", false);
    let chaine = (this._chaine = depart
        ? this._calculerChaine(membres, depart)
        : this._chaineLaPlusCourte(membres)),
      n = chaine.ordre.length,
      lien = (m) =>
        `<a href='Membre.php?Pseudo=${m.pseudo}'>${$("<div>").text(m.pseudo).html()}</a>`,
      lignes = chaine.ordre.map((m, k) => {
        let vers = chaine.ordre[k + 1];
        return `<tr><td>${k + 1}</td><td>${lien(m)}${m.isMe ? " <em>(toi)</em>" : ""}</td><td>${m.x} / ${m.y}</td>
          <td>${vers ? lien(vers) : "—"}</td><td>${vers ? Utils.intToTime(chaine.etapes[k]) : "—"}</td></tr>`;
      });
    $("#o_chaineListe").html(
      `<thead><tr><th>#</th><th>Joueur</th><th>Position</th><th>Envoie à</th><th>Temps de trajet</th></tr></thead>
      <tbody>${lignes.join("")}
        <tr class='reduce'><td colspan='5'><em>${chaine.etapes.length} étapes · temps cumulé ${Utils.intToTime(chaine.total)} · plus longue étape ${Utils.intToTime(chaine.max)}</em></td></tr>
      </tbody>`,
    );
    $("#o_chaineListe tr:even").css("background-color", monProfil.parametre["couleur2"].valeur);
    return chaine;
  }
  /**
   * Texte de la chaîne pour le forum, une étape par ligne.
   *
   * @private
   * @method _texteChaine
   */
  _texteChaine() {
    let c = this._chaine;
    if (!c) return "";
    let n = c.ordre.length,
      lignes = c.etapes.map(
        (t, k) =>
          `${k + 1}. ${c.ordre[k].pseudo} → ${c.ordre[k + 1].pseudo} (${Utils.intToTime(t)})`,
      );
    return (
      `Chaîne de ${n} joueurs :\n${lignes.join("\n")}\n` +
      `Temps cumulé ${Utils.intToTime(c.total)}, plus longue étape ${Utils.intToTime(c.max)} (sans Vitesse d'attaque)`
    );
  }
  /**
   * Point d'entrée de la carte : mémorise la liste complète, (re)construit les
   * filtres, puis dessine la carte filtrée.
   *
   * @private
   * @method _renderCarte
   */
  _renderCarte(membres) {
    this._carteMembres = membres;
    this._filtres = this._chargerFiltres();
    this._construireFiltres(membres);
    return this._dessinerCarte(this._filtrerMembres(membres), membres.length);
  }
  /**
   * Render Highcharts dans #o_carteAllianceChart.
   * Regroupe les membres par case (x,y), trace les liens en-dessous d'un seuil,
   * affiche le tooltip avec temps de trajet (sans / avec bonus Vitesse d'attaque).
   *
   * @private
   * @method _dessinerCarte
   * @param {Array} members membres à tracer (déjà filtrés)
   * @param {Integer} total effectif avant filtrage, pour le titre
   */
  _dessinerCarte(members, total) {
    $("#o_carteAllianceChart").show();
    // Désactive le warning Highcharts #15 : nos séries `line` représentent des arêtes
    // arbitraires entre cases (a→b dans n'importe quelle direction), donc les x ne
    // sont pas monotonement croissants. Le rendu marche, c'est juste un warning console.
    Highcharts.seriesTypes.line.prototype.requireSorting = false;
    const K_NEIGHBORS = 3; // chaque case reliée à ses K cases les plus proches
    const niveauVitesseAttaque = monProfil.niveauRecherche[6] || 0;
    members.forEach((m) => {
      m.isMe = m.pseudo === monProfil.pseudo;
    });
    const me = members.find((m) => m.isMe) || { x: monProfil.x, y: monProfil.y };
    const chaine = this._majChaine(members);
    const tracer = !!(chaine && this._optionsChaine.tracer);
    const rangs = new Map(tracer ? chaine.ordre.map((m, k) => [m.pseudo, k + 1]) : []);
    const tempsParcours = (target, niveauVit) =>
      Math.ceil(
        Math.pow(0.9, niveauVit) *
          637200 *
          (1 - Math.exp(-Math.hypot(target.x - me.x, target.y - me.y) / 350)),
      );
    // Regroupement par case (x, y)
    const spotMap = new Map();
    for (const m of members) {
      const key = `${m.x},${m.y}`;
      if (!spotMap.has(key)) spotMap.set(key, { x: m.x, y: m.y, members: [] });
      spotMap.get(key).members.push(m);
    }
    const spots = [...spotMap.values()].map((s) => ({
      ...s,
      isMyGroup: s.members.some((m) => m.isMe),
    }));
    // Liens : K plus proches voisins (s'adapte à l'étalement de l'alliance)
    const edgeSet = new Set();
    for (let i = 0; i < spots.length; i++) {
      const others = spots
        .map((s, j) => ({ idx: j, d: Math.hypot(s.x - spots[i].x, s.y - spots[i].y) }))
        .filter((o) => o.idx !== i)
        .sort((a, b) => a.d - b.d)
        .slice(0, K_NEIGHBORS);
      others.forEach((o) => {
        const key = i < o.idx ? `${i}-${o.idx}` : `${o.idx}-${i}`;
        edgeSet.add(key);
      });
    }
    // la chaîne tracée remplace les liens, sinon la carte devient illisible
    if (tracer) edgeSet.clear();
    const edges = [...edgeSet].map((key) => {
      const [i, j] = key.split("-").map(Number);
      return [spots[i], spots[j]];
    });
    // Split en deux séries : liens vers moi (vert) vs entre autres membres (gris)
    const myLineData = [];
    const otherLineData = [];
    edges.forEach(([a, b]) => {
      const target = a.isMyGroup || b.isMyGroup ? myLineData : otherLineData;
      target.push([a.x, a.y]);
      target.push([b.x, b.y]);
      target.push([null, null]);
    });
    // Stats
    const allDists = [];
    for (let i = 0; i < spots.length; i++) {
      for (let j = i + 1; j < spots.length; j++) {
        allDists.push(Math.hypot(spots[i].x - spots[j].x, spots[i].y - spots[j].y));
      }
    }
    const dMin = allDists.length ? Math.min(...allDists) : 0;
    const dMax = allDists.length ? Math.max(...allDists) : 0;
    const dAvg = allDists.length ? allDists.reduce((s, v) => s + v, 0) / allDists.length : 0;
    Highcharts.chart("o_carteAllianceChart", {
      chart: {
        type: "scatter",
        zoomType: "xy",
        panKey: "shift",
        backgroundColor: "#fff",
        spacingTop: 25,
      },
      title: {
        text: `${total > members.length ? `${members.length} membres affichés sur ${total}` : `${members.length} membres`} • ${spots.length} cases • ${tracer ? `chaîne de ${chaine.ordre.length} joueurs (${Utils.intToTime(chaine.total)} cumulés)` : `${edges.length} liens (${K_NEIGHBORS} plus proches voisins)`}`,
        style: { fontSize: "14px", fontWeight: "600" },
      },
      subtitle: {
        text: allDists.length
          ? `Distance min ${dMin.toFixed(0)} • max ${dMax.toFixed(0)} • moyenne ${dAvg.toFixed(0)}`
          : "",
        style: { fontSize: "11px", color: "#888" },
      },
      xAxis: {
        title: { text: "X (coord monde)" },
        gridLineWidth: 1,
        gridLineColor: "#f0f0f0",
      },
      yAxis: { title: { text: "Y (coord monde)" }, gridLineColor: "#f0f0f0" },
      credits: { enabled: false },
      legend: { enabled: false },
      tooltip: {
        // Semi-transparent pour ne pas masquer le rectangle de drag-zoom derrière
        backgroundColor: "rgba(255,255,255,0.7)",
        borderColor: "#888",
        useHTML: true,
        formatter: function () {
          const spot = this.point.spot;
          const pos = `(${spot.x.toFixed(0)}, ${spot.y.toFixed(0)})`;
          let html = "";
          if (spot.members.length === 1) {
            const m = spot.members[0];
            html += `<b>${m.pseudo}</b><br/>`;
            html += `Terrain : ${numeral(m.terrain).format()} cm²<br/>`;
            html += `Position : ${pos}`;
            if (m.isMe) {
              html += `<br/><em style="color:#27ae60">C'est toi</em>`;
            } else {
              const tSans = tempsParcours(m, 0);
              const tAvec = tempsParcours(m, niveauVitesseAttaque);
              html += `<br/><br/><b>Temps de trajet</b><br/>`;
              html += `&nbsp;&nbsp;Sans amélioration : ${Utils.intToTime(tSans)}<br/>`;
              html += `&nbsp;&nbsp;Avec ton bonus (Vit. att. ${niveauVitesseAttaque}) : ${Utils.intToTime(tAvec)}`;
            }
          } else {
            html += `<b>${spot.members.length} membres sur cette case</b><br/>`;
            html += `Position : ${pos}`;
            if (spot.isMyGroup) {
              html += `<br/><em style="color:#27ae60">Tu es ici, avec :</em>`;
              spot.members
                .filter((m) => !m.isMe)
                .forEach((m) => {
                  html += `<br/>&nbsp;&nbsp;• ${m.pseudo} (${numeral(m.terrain).format()} cm²)`;
                });
            } else {
              html += `<br/><br/>`;
              spot.members.forEach((m) => {
                html += `&nbsp;&nbsp;• <b>${m.pseudo}</b> (${numeral(m.terrain).format()} cm²)<br/>`;
              });
              const tSans = tempsParcours(spot, 0);
              const tAvec = tempsParcours(spot, niveauVitesseAttaque);
              html += `<br/><b>Temps de trajet</b> (commun, même case)<br/>`;
              html += `&nbsp;&nbsp;Sans amélioration : ${Utils.intToTime(tSans)}<br/>`;
              html += `&nbsp;&nbsp;Avec ton bonus (Vit. att. ${niveauVitesseAttaque}) : ${Utils.intToTime(tAvec)}`;
            }
          }
          return html;
        },
      },
      plotOptions: {
        scatter: {
          marker: {
            symbol: "circle",
            states: { hover: { lineColor: "#000", lineWidth: 2 } },
          },
          point: {
            events: {
              click: function () {
                // Clic sur un point → zoom 4× autour (utile pour explorer les clusters denses).
                // Cap : on stop si le viewport descendrait sous 1 unité de jeu (sinon clic infini).
                const chart = this.series.chart;
                const xExt = chart.xAxis[0].getExtremes();
                const yExt = chart.yAxis[0].getExtremes();
                const xR = (xExt.max - xExt.min) / 4;
                const yR = (yExt.max - yExt.min) / 4;
                if (xR < 1 || yR < 1) return;
                chart.xAxis[0].setExtremes(this.x - xR / 2, this.x + xR / 2);
                chart.yAxis[0].setExtremes(this.y - yR / 2, this.y + yR / 2);
                // Force l'apparition du bouton natif "Reset zoom" (sinon il n'apparaît
                // que quand le zoom est déclenché par drag-select, pas via setExtremes).
                chart.showResetZoom();
              },
            },
          },
        },
      },
      series: [
        // Liens entre autres membres (gris discret, en arrière-plan)
        {
          type: "line",
          name: "Liens",
          data: otherLineData,
          color: "rgba(120, 140, 160, 0.35)",
          lineWidth: 1,
          marker: { enabled: false },
          enableMouseTracking: false,
          states: { hover: { enabled: false } },
          showInLegend: false,
          animation: false,
        },
        // Liens vers moi (vert plus marqué, par-dessus les autres)
        {
          type: "line",
          name: "Liens vers toi",
          data: myLineData,
          color: "rgba(39, 174, 96, 0.7)",
          lineWidth: 1.5,
          marker: { enabled: false },
          enableMouseTracking: false,
          states: { hover: { enabled: false } },
          showInLegend: false,
          animation: false,
        },
        // Chaîne entre plus proches voisins, dans l'ordre de passage
        {
          type: "line",
          name: "Chaîne",
          data: tracer ? chaine.ordre.map((m) => [m.x, m.y]) : [],
          color: "rgba(41, 128, 185, 0.85)",
          lineWidth: 2,
          dashStyle: "ShortDash",
          marker: { enabled: false },
          enableMouseTracking: false,
          states: { hover: { enabled: false } },
          showInLegend: false,
          animation: false,
        },
        {
          type: "scatter",
          name: "Membres",
          data: spots.map((s) => {
            const n = s.members.length;
            const terrainMax = Math.max(...s.members.map((m) => m.terrain || 0));
            let fill, line;
            if (s.isMyGroup) {
              fill = "#27ae60";
              line = "#196f3d";
            } else if (n > 1) {
              fill = "#f39c12";
              line = "#b9770e";
            } else {
              fill = "#c0392b";
              line = "#fff";
            }
            let label;
            if (n === 1) label = s.members[0].pseudo;
            else if (s.isMyGroup) label = `Toi +${n - 1}`;
            else label = `${[...s.members].map((m) => m.pseudo).sort()[0]} +${n - 1}`;
            // numéro de passage dans la chaîne tracée
            if (tracer)
              label = `${s.members
                .map((m) => rangs.get(m.pseudo))
                .sort((a, b) => a - b)
                .join(", ")}. ${label}`;
            // Radius modeste : log(terrain) compressé pour limiter le stack visuel dans
            // les clusters denses (alliances de 30+ membres souvent groupés).
            const radiusBase = terrainMax > 0 ? 2 + Math.log10(terrainMax) / 2 : 4;
            return {
              x: s.x,
              y: s.y,
              spot: s,
              name: label,
              marker: {
                radius: n > 1 ? 5 + Math.min(n - 1, 3) : Math.max(3, Math.min(radiusBase, 6)),
                fillColor: fill,
                lineColor: line,
                lineWidth: n > 1 ? 2 : 1.5,
              },
            };
          }),
          dataLabels: {
            enabled: true,
            format: "{point.name}",
            allowOverlap: false,
            style: {
              fontSize: "10px",
              fontWeight: "normal",
              color: "#222",
              textOutline: "2px contrast",
            },
            y: -14,
          },
        },
      ],
    });
  }
}
