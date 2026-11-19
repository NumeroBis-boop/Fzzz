// @ts-check
/*
 * MultiFlood.js
 * « Multi-flood opti » (menu Fourmilière, vue de la page Ennemies) : le Flood
 * TdC du Compte+ pour tous les joueurs (choix du mainteneur, 18/11/2026), avec
 * le TdC de chacun à l'impact et autant de cibles que voulu. Les attaques
 * partent au clic, une à une, par la page d'attaque de chaque cible.
 **********************************************************************/

const HASH_MULTI_FLOOD = "#multiflood";
// options dépliées : "1" (la page du jeu garde aussi ce choix)
const CLE_MULTI_FLOOD_OPTIONS = "fzzz_multiFloodOptions";
// calcul avec le TdC de chacun à l'impact, coché par défaut ; "0" : décoché,
// les TdC actuels, comme la page du Compte+
const CLE_MULTI_FLOOD_IMPACT = "fzzz_multiFloodImpact";
// cases « Pseudo » des cibles, comme la page du jeu ; une vide de plus dès
// qu'elles sont toutes prises
const PLACES_MULTI_FLOOD = 3;
// arrondi de la page du jeu : 1 Fort, 2 Normal, 3 Faible, 4 Aucun
const ARRONDIS_MULTI_FLOOD = [
  [4, "Aucun"],
  [3, "Faible"],
  [2, "Normal"],
  [1, "Fort"],
];
// minute d'impact suivie sans requête : le plan est refait quand elle change
const MS_SUIVI_MULTI_FLOOD = 15000;
// entre deux envois, comme le Lanceur de Flood
const MS_ENTRE_ATTAQUES = 1000;
// numéros des attaques de ce multi-flood dans la simulation des partages : elles
// partent après celles du jeu, plus anciennes, et passent donc après elles à minute égale
const NUMERO_ATTAQUES_MULTI_FLOOD = 1e15;

/** @type {any} */
let etatMultiFlood = null;

/**
 * @class MultiFlood
 */
class MultiFlood {
  /**
   * Entrée « Multi-flood opti » à la fin du menu Fourmilière.
   *
   * @static
   * @method ajouterMenu
   */
  static ajouterMenu() {
    let $menu = $("#menuFourmiliere");
    if (!$menu.length || $("#o_ongletMultiFlood").length) return;
    $menu.append(
      `<li><a id='o_ongletMultiFlood' class='boutonSimulateurFlood' href='ennemie.php${HASH_MULTI_FLOOD}'><span></span>Multi-flood opti</a></li>`,
    );
  }
  /**
   * Page Ennemies : vue montrée au clic sur l'entrée du menu, ou à l'arrivée
   * par son adresse (aussi tapée sur la page ouverte). Rien n'est lu avant.
   *
   * @static
   * @method installer
   */
  static installer() {
    $("#o_ongletMultiFlood").on("click", (e) => {
      e.preventDefault();
      MultiFlood.afficher();
    });
    window.addEventListener("hashchange", () => {
      if (location.hash == HASH_MULTI_FLOOD) MultiFlood.afficher();
    });
    if (location.hash == HASH_MULTI_FLOOD) MultiFlood.afficher();
  }
  /**
   * Cache le contenu du jeu, montre la vue et lit l'armée, les chasses et les
   * partages la première fois.
   *
   * @static
   * @method afficher
   * @return {Promise<void>} fin de la lecture
   */
  static afficher() {
    if (!etatMultiFlood) MultiFlood._construire();
    $("#centre")
      .children()
      .filter((i, e) => !MultiFlood._garde(e))
      .addClass("o_mfoCache");
    $("#o_multiFlood").show();
    if (!etatMultiFlood.lecture) etatMultiFlood.lecture = MultiFlood.lire();
    if (!etatMultiFlood.suivi)
      etatMultiFlood.suivi = setInterval(() => MultiFlood._suivre(), MS_SUIVI_MULTI_FLOOD);
    return etatMultiFlood.lecture;
  }
  /**
   * @private
   * @static
   * @param {Element} e enfant de #centre
   * @return {Boolean} gardé visible : menu du jeu, scripts, éléments de l'extension
   */
  static _garde(e) {
    let classes = typeof e.className == "string" ? e.className : "";
    return (
      /^(nav|script|style)$/i.test(e.tagName) || /^o_/.test(e.id || "") || /(^|\s)o_/.test(classes)
    );
  }
  /**
   * @static
   * @method options
   * @return {Boolean} options dépliées
   */
  static options() {
    try {
      return localStorage.getItem(CLE_MULTI_FLOOD_OPTIONS) == "1";
    } catch (e) {
      return false;
    }
  }
  /**
   * @static
   * @method avecImpact
   * @return {Boolean} calcul avec le TdC de chacun à l'impact (sinon les TdC actuels)
   */
  static avecImpact() {
    try {
      return localStorage.getItem(CLE_MULTI_FLOOD_IMPACT) != "0";
    } catch (e) {
      return true;
    }
  }
  /**
   * Vue de la forme de la page Flood TdC du Compte+ : attaquant et cibles côte
   * à côte, options repliées, les cibles dans un seul tableau, « Lancer +
   * partager », les unités gardées en bas.
   *
   * @private
   * @static
   */
  static _construire() {
    etatMultiFlood = {
      cibles: [],
      moi: { tdcSaisi: null, saisiA: null, tdcLu: null, terrainFinal: null, priseMax: null },
      armee: null,
      lignes: [],
      enCours: null,
      base: null,
      partages: null,
      erreur: "",
      lecture: null,
      suivi: null,
      minutes: "",
      resultats: [],
      lance: false,
      // pages de membre en cours de lecture, par pseudo en minuscules
      enLecture: {},
      gardees: new UnitesGardees("o_mfoGardees", () => MultiFlood.rendre(), {
        titre: "Unités gardées pour ce multi-flood",
        lienPreferences: false,
      }),
    };
    let options = MultiFlood.options(),
      tag = Utils.echapper(Utils.alliance || "l'alliance");
    $("#centre")
      .append(`<div id='o_multiFlood' class='boite_amelioration simulateur centre${options ? " o_mfoOptions" : ""}' style='display:none'>
        <h2>Multi-flood opti</h2>
        <p class='left'>Optimise tes attaques pour prendre un maximum de terrain… <span class='cliquable2 o_mfoAide'>En savoir plus ?</span></p>
        <div class='o_mfoExplication left' style='display:none'>${MultiFlood._explication()}</div>
        <div class='o_mfoTableau'><table id='o_mfoForm' cellspacing='0'></table></div>
        <p class='o_mfoChoixImpact'><label title='Floods et chasses partagés dans le forum de l&#39;alliance, tes chasses et tes attaques en cours ; décochée : les TdC actuels, comme la page du Compte+'><input type='checkbox' id='o_mfoImpact'${MultiFlood.avecImpact() ? " checked" : ""}/> Calculer avec le TdC de chacun à l'impact</label></p>
        <p id='o_mfoEtat' class='reduce'></p>
        <div id='o_mfoResultats'></div>
        <p id='o_mfoAvertissement' class='red'></p>
        <p class='o_mfoBoutons'><button type='button' id='o_mfoLancerPartager' class='o_button o_lieu1' disabled title='Lancement, puis publication des attaques dans le forum de la ${tag}'>Lancer + partager</button></p>
        <p id='o_mfoRecap'></p>
        <div class='o_mfoBas'><hr class='o_mfoSeparateur'/>${etatMultiFlood.gardees.html()}</div>
      </div>`);
    etatMultiFlood.gardees.brancher();
    MultiFlood._formulaire();
    let $vue = $("#o_multiFlood");
    $vue.on("click", ".o_mfoAide", () => $vue.find(".o_mfoExplication").toggle());
    $vue.on("click", ".o_mfoBoutonOptions", () => {
      let ouvert = !$vue.hasClass("o_mfoOptions");
      $vue.toggleClass("o_mfoOptions", ouvert);
      $vue.find(".o_mfoFleche").text(ouvert ? "▲" : "▼");
      try {
        localStorage.setItem(CLE_MULTI_FLOOD_OPTIONS, ouvert ? "1" : "0");
      } catch (e) {}
    });
    $vue.on("change", ".o_mfoCoche", (e) => {
      let caseCochee = /** @type {HTMLInputElement} */ (e.currentTarget),
        cible = MultiFlood._cible(String(caseCochee.dataset.pseudo));
      if (cible) cible.choix[Number(caseCochee.dataset.i)] = caseCochee.checked;
      MultiFlood.rendre();
    });
    // un pseudo validé (Entrée, ou case quittée) : cible ajoutée, changée ou retirée
    $vue.on("keydown", ".o_mfoCiblePseudo", (e) => {
      if (e.key != "Enter") return;
      e.preventDefault();
      let champ = /** @type {HTMLInputElement} */ (e.currentTarget);
      MultiFlood.choisirCible(Number(champ.dataset.i), champ.value);
    });
    $vue.on("change", ".o_mfoCiblePseudo", (e) => {
      let champ = /** @type {HTMLInputElement} */ (e.currentTarget);
      MultiFlood.choisirCible(Number(champ.dataset.i), champ.value);
    });
    $("#o_mfoImpact").on("change", (e) => {
      let coche = /** @type {HTMLInputElement} */ (e.currentTarget).checked;
      try {
        localStorage.setItem(CLE_MULTI_FLOOD_IMPACT, coche ? "1" : "0");
      } catch (err) {}
      MultiFlood.rendre();
    });
    // un flood va toujours au terrain de chasse : un seul bouton, au vert du terrain
    $("#o_mfoLancerPartager").on("click", () => MultiFlood.lancer(true));
  }
  /**
   * @private
   * @static
   * @return {String}
   */
  static _explication() {
    return `<p><span class='gras'>À quoi ça sert ?</span><br/>Une attaque ne peut pas prendre plus de 20 % du terrain de chasse de sa cible. Cet outil cherche la meilleure série d'attaques pour prendre un maximum de terrain, comme le « Flood TdC » du Compte+, sur autant de cibles que tu veux.</p>
      <p><span class='gras'>TdC à l'impact</span><br/>Case « Calculer avec le TdC de chacun à l'impact » cochée, chaque attaque est calculée avec le TdC de chacun à son arrivée (minute du RC) : celui que donnent les floods et chasses partagés dans le forum de l'alliance, tes chasses (page Ressources), tes attaques en cours, et les attaques cochées de ce multi-flood sur les cibles plus proches (elles changent aussi ce que prennent les floods qui dépendent de ton TdC : portée, 20 %). La ligne sous le nom de chaque cible donne ces TdC et d'où vient leur écart avec les TdC actuels. Un avertissement en rouge, au-dessus du bouton, signale chacun de tes floods déjà lancés que les attaques cochées font sortir de portée : il ne prendrait plus rien. Décochée, avec les TdC actuels, comme la page du Compte+.</p>
      <p><span class='gras'>Comment ça marche ?</span><br/>Écris le pseudo d'une cible dans une case « Pseudo » et choisis-le dans la liste ; %% propose les membres de ton alliance à portée. Une case vidée retire sa cible ; une case vide de plus apparaît quand toutes sont prises. Les attaques commencent par la cible la plus proche. Coche ou décoche des attaques, dans la limite de tes attaques disponibles (Vitesse d'attaque + 1) et de ton armée sans les unités gardées (en bas de la page). « Lancer + partager » les envoie une à une par la page d'attaque de chaque cible, les publie dans le forum de l'alliance, puis ouvre la page Armée (replacement de l'armée).</p>
      <p><span class='gras'>Options</span><br/>- Terrain : ton TdC et celui de chaque cible, si tu en connais un plus récent.<br/>- Terrain final : celui que tu veux atteindre, ou laisser à ta cible.<br/>- Prise max : par cible, ou pour tout le multi-flood dans ta colonne.<br/>- Arrondir : une prise trop précise se repère si tes ennemis te surveillent.</p>`;
  }
  /**
   * @private
   * @static
   * @param {String} pseudo
   * @return {any} cible de la liste, ou undefined
   */
  static _cible(pseudo) {
    return etatMultiFlood.cibles.find((/** @type {any} */ c) => c.pseudo == pseudo);
  }
  /**
   * Formulaire de la page du Compte+ : attaquant, puis une case « Pseudo » par
   * cible (au moins trois, une vide de plus quand toutes sont prises) ; en
   * options, une ligne par réglage et une colonne par joueur. Refait à l'ajout
   * ou au retrait d'une cible, les pseudos tapés et pas encore lus gardés.
   *
   * @private
   * @static
   */
  static _formulaire() {
    let e = etatMultiFlood,
      n = e.cibles.length,
      places = Math.max(PLACES_MULTI_FLOOD, n + 1),
      pris = new Set(e.cibles.map((/** @type {any} */ c) => c.pseudo.toLowerCase())),
      /** @type {Record<Number, String>} */
      saisies = {},
      focus = -1;
    $("#o_mfoForm .o_mfoCiblePseudo").each((i, el) => {
      let champ = /** @type {HTMLInputElement} */ (el),
        v = champ.value.trim();
      if (i >= n && v && !pris.has(v.toLowerCase())) saisies[i] = champ.value;
      if (champ == document.activeElement) focus = i;
      if ($(champ).autocomplete("instance")) $(champ).autocomplete("destroy");
    });
    let champ = (
        /** @type {String} */ cle,
        /** @type {String} */ nom,
        /** @type {Number|null} */ valeur,
      ) =>
        `<input type='text' class='o_mfoChamp' data-cle='${Utils.echapper(cle)}' data-champ='${nom}' value='${valeur ?? ""}' placeholder='—' size='9'/>`,
      arrondis = (/** @type {any} */ c) =>
        `<select class='o_mfoChamp' data-cle='${Utils.echapper(c.pseudo)}' data-champ='arrondi'>${ARRONDIS_MULTI_FLOOD.map(
          ([v, nom]) => `<option value='${v}'${c.arrondi == v ? " selected" : ""}>${nom}</option>`,
        ).join("")}</select>`,
      colonnes = (/** @type {(c: any) => String} */ contenu) =>
        [...Array(places).keys()]
          .map((i) => `<td>${i < n ? contenu(e.cibles[i]) : ""}</td>`)
          .join(""),
      pseudos = [...Array(places).keys()]
        .map(
          (i) =>
            `<td><input type='text' class='o_mfoCiblePseudo' data-i='${i}' value='${Utils.echapper(i < n ? e.cibles[i].pseudo : saisies[i] || "")}' placeholder='Pseudo${i + 1}' autocomplete='off'/></td>`,
        )
        .join(""),
      ouvert = $("#o_multiFlood").hasClass("o_mfoOptions");
    $("#o_mfoForm")
      .html(`<thead><tr><th>Attaquant</th><th></th><th colspan='${places - 2}'>Cibles</th>
        <th colspan='2' class='right'><span class='cliquable2 o_mfoBoutonOptions'>Options <span class='o_mfoFleche'>${ouvert ? "▲" : "▼"}</span></span></th></tr></thead>
      <tbody><tr><td><input type='text' class='o_mfoAttaquant' value='${Utils.echapper(monProfil.pseudo)}' readonly/></td><td>Pseudo</td>${pseudos}</tr>
        <tr class='o_mfoOpt'><td>${champ("", "tdcSaisi", e.moi.tdcSaisi ?? MultiFlood._monTdcLu())}</td><td>Terrain</td>${colonnes((c) => champ(c.pseudo, "tdcSaisi", c.tdcSaisi ?? c.tdcLu))}</tr>
        <tr class='o_mfoOpt'><td>${champ("", "terrainFinal", e.moi.terrainFinal)}</td><td>Terrain final</td>${colonnes((c) => champ(c.pseudo, "terrainFinal", c.terrainFinal))}</tr>
        <tr class='o_mfoOpt'><td>${champ("", "priseMax", e.moi.priseMax)}</td><td>Prise max</td>${colonnes((c) => champ(c.pseudo, "priseMax", c.priseMax))}</tr>
        <tr class='o_mfoOpt'><td></td><td>Arrondir</td>${colonnes(arrondis)}</tr></tbody>`);
    $("#o_mfoForm input.o_mfoChamp").spinner({ min: 0 });
    // une valeur relue en entier : le champ affiche « 1 804 000 », que parseInt lirait 1
    $("#o_mfoForm .o_mfoChamp").on("change spinstop", (ev) => {
      let $el = $(ev.currentTarget),
        cle = String($el.attr("data-cle")),
        nom = String($el.attr("data-champ")),
        valeur = $el.is("select") ? Number($el.val()) : Number($el.spinner("value")) || null,
        cible = cle ? MultiFlood._cible(cle) : e.moi;
      if (!cible) return;
      if (nom == "tdcSaisi") {
        let lu = cle ? cible.tdcLu : MultiFlood._monTdcLu();
        cible.tdcSaisi = valeur && valeur != lu ? valeur : null;
        cible.saisiA = Horloge.serveur();
      } else cible[nom] = valeur;
      MultiFlood.rendre();
    });
    $("#o_mfoForm .o_mfoCiblePseudo").autocomplete({
      minLength: 1,
      source: (/** @type {any} */ demande, /** @type {(l: Array<any>) => void} */ reponse) =>
        MultiFlood._suggestions(String(demande.term || "").trim()).then(reponse),
      select: (/** @type {any} */ ev, /** @type {any} */ ui) => {
        $(ev.target).val(ui.item.value);
        MultiFlood.choisirCible(Number(ev.target.dataset.i), ui.item.value);
        return false;
      },
    });
    if (focus >= 0) {
      let el = /** @type {HTMLInputElement|undefined} */ (
        $("#o_mfoForm .o_mfoCiblePseudo").get(focus)
      );
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }
  }
  /**
   * Pseudo validé dans la case `i` : cible ajoutée, remplacée, ou retirée si
   * la case est vidée.
   *
   * @static
   * @method choisirCible
   * @param {Number} i rang de la case
   * @param {String} pseudo
   * @return {Promise<void>}
   */
  static choisirCible(i, pseudo) {
    let e = etatMultiFlood,
      p = String(pseudo || "").trim(),
      c = e.cibles[i];
    if (p == "%%" || (c && c.pseudo.toLowerCase() == p.toLowerCase())) return Promise.resolve();
    if (!p) {
      if (!c) return Promise.resolve();
      e.cibles.splice(i, 1);
      MultiFlood._formulaire();
      return MultiFlood.completer().then(() => MultiFlood.rendre());
    }
    return MultiFlood.ajouter(p, c || null);
  }
  /**
   * Suggestions du champ de pseudo : la recherche du jeu ; %% : les membres de
   * l'alliance à portée de mon TdC, du plus grand TdC au plus petit.
   *
   * @private
   * @static
   * @param {String} terme
   * @return {Promise<Array<{label: String, value: String}>>}
   */
  static _suggestions(terme) {
    let pris = new Set(
      [monProfil.pseudo, ...etatMultiFlood.cibles.map((/** @type {any} */ c) => c.pseudo)].map(
        (p) => String(p).toLowerCase(),
      ),
    );
    if (terme == "%%")
      return PartageChasses.tdcMembres().then((tdc) =>
        MultiFlood.membresAPortee(tdc, MultiFlood._monTdc(), pris).map((p) => ({
          label: `${p} (${numeral(tdc[p]).format()})`,
          value: p,
        })),
      );
    return Promise.resolve(Joueur.rechercher(terme)).then(
      (data) =>
        Utils.extraitRecherche(data, true, false)
          .map((/** @type {any} */ it) => String(it.value))
          .filter((p) => !pris.has(p.toLowerCase()))
          .map((p) => ({ label: p, value: p })),
      () => [],
    );
  }
  /**
   * @static
   * @method membresAPortee
   * @param {Record<String, Number>} tdc TdC des membres
   * @param {Number} monTdc
   * @param {Set<String>} exclus pseudos en minuscules
   * @return {Array<String>} membres que je peux flooder, du plus grand TdC au plus petit
   */
  static membresAPortee(tdc, monTdc, exclus) {
    return Object.keys(tdc)
      .filter((p) => !exclus.has(p.toLowerCase()) && Utils.aPortee(tdc[p], monTdc))
      .sort((a, b) => tdc[b] - tdc[a]);
  }
  /**
   * @private
   * @static
   * @return {Number} mon TdC actuel : saisi dans les options, sinon le dernier lu
   */
  static _monTdc() {
    return etatMultiFlood.moi.tdcSaisi ?? MultiFlood._monTdcLu();
  }
  /**
   * @private
   * @static
   * @return {Number} mon TdC lu sur la dernière page de cible lue, sinon celui de la page
   */
  static _monTdcLu() {
    return etatMultiFlood.moi.tdcLu ?? Utils.terrain;
  }
  /**
   * Lit, à l'ouverture de la vue : mon armée et mes attaques en cours (page
   * Armée, qui fait foi pour moi), mes chasses (page Ressources) et les floods
   * et chasses partagés de l'alliance.
   *
   * @static
   * @method lire
   * @return {Promise<void>}
   */
  static lire() {
    let e = etatMultiFlood,
      mesure = Journal.mesurer("Multi-flood opti");
    MultiFlood._etat("Lecture de ton armée, de tes chasses et des partages…");
    return Promise.all([
      Promise.resolve($.get(location.origin + "/Armee.php")).then(
        (html) => String(html),
        () => "",
      ),
      Promise.resolve($.get(location.origin + "/Ressources.php"))
        .then((html) => PageRessource.lireChasses(Utils.parseHtml(String(html))))
        .catch(() => null),
      PartageChasses.charger(null).catch((err) => {
        Journal.info(
          "Multi-flood opti",
          "partages illisibles",
          String((err && err.message) || err),
        );
        return null;
      }),
    ])
      .then(([armeeHtml, chasses, d]) => {
        if (!MultiFlood.lireArmee(armeeHtml))
          e.erreur = "ton armée n'a pas pu être lue (page Armée)";
        if (!d) e.erreur = e.erreur || "partages illisibles : les TdC actuels sont utilisés";
        else e.base = MultiFlood._avecMoi(d, chasses);
        return MultiFlood.completer();
      })
      .catch((err) => {
        e.erreur = "lecture interrompue";
        Journal.erreur("Multi-flood opti", "lecture", String((err && err.message) || err));
      })
      .then(() => {
        mesure.fin();
        MultiFlood.rendre();
      });
  }
  /**
   * Armée et attaques en cours d'une page Armée reçue.
   *
   * @static
   * @method lireArmee
   * @param {String} html Armee.php
   * @return {Boolean} page Armée lue
   */
  static lireArmee(html) {
    let e = etatMultiFlood;
    // page de connexion, ou pas de réponse : pas une page Armée
    if (!/Troupes en Garnison/i.test(html)) return false;
    let armee = new Armee();
    armee.chargeData(html);
    armee.gardees = e.gardees.reglage;
    e.armee = armee;
    e.lignes = AttaqueLancee.extraireLignes(Utils.parseHtml(html));
    e.enCours = e.lignes.length;
    return true;
  }
  /**
   * Partages où mes floods sont ceux de la page Armée et mes chasses celles de
   * la page Ressources, comme le TdC à l'impact du Lanceur de Flood.
   *
   * @private
   * @static
   * @param {Object} d PartageChasses.charger()
   * @param {Array|null} chasses PageRessource.lireChasses()
   * @return {Object}
   */
  static _avecMoi(d, chasses) {
    let lignes = etatMultiFlood.lignes,
      captures = AttaqueLancee.charger(),
      mesFloods = PartageChasses.entreesFloods(
        lignes
          .filter((/** @type {any} */ l) => l.cible)
          .map((/** @type {any} */ l) =>
            AttaqueLancee.pourPartage({
              ligne: l,
              capture: captures.find((/** @type {any} */ c) => c.id == l.id) || null,
            }),
          ),
      ),
      mesChasses = chasses
        ? PageRessource.aPartager(PageRessource.grouperChasses(chasses)).map(
            (/** @type {any} */ g) => ({
              date: g.impact.format("YYYY-MM-DD HH:mm"),
              terrain: g.terrain,
            }),
          )
        : null;
    return PartageChasses.avecMesMouvements(
      d,
      monProfil.pseudo,
      mesFloods,
      mesChasses,
      lignes.map((/** @type {any} */ l) => l.id),
    );
  }
  /**
   * Chasses des joueurs liés aux cibles par des floods partagés et TdC des
   * membres (PartageChasses.completer), à chaque changement de cibles.
   *
   * @static
   * @method completer
   * @return {Promise<void>}
   */
  static completer() {
    let e = etatMultiFlood;
    if (!e.base) return Promise.resolve();
    let suivis = [monProfil.pseudo, ...e.cibles.map((/** @type {any} */ c) => c.pseudo)];
    return PartageChasses.completer(e.base, suivis).then(
      (r) => {
        e.partages = r;
      },
      () => {
        e.partages = { d: e.base, tdc: {} };
      },
    );
  }
  /**
   * Ajoute une cible, ou en remplace une : sa page de membre donne son id, ses
   * coordonnées, son TdC et le mien au même instant.
   *
   * @static
   * @method ajouter
   * @param {String} pseudo
   * @param {any} [ancienne] cible remplacée (case dont le pseudo a changé)
   * @return {Promise<void>}
   */
  static ajouter(pseudo, ancienne = null) {
    let e = etatMultiFlood,
      p = String(pseudo || "").trim(),
      k = p.toLowerCase(),
      // pseudo refusé : effacé de sa case, la cible remplacée revient
      refuser = (/** @type {String} */ texte) => {
        $.toast({ ...TOAST_WARNING, text: texte });
        $("#o_mfoForm .o_mfoCiblePseudo")
          .filter((i, el) => /** @type {HTMLInputElement} */ (el).value.trim().toLowerCase() == k)
          .val("");
        MultiFlood._formulaire();
        return Promise.resolve();
      };
    if (!p) return Promise.resolve();
    if (k == String(monProfil.pseudo).toLowerCase())
      return refuser("Tu ne peux pas t'attaquer toi-même.");
    if (e.cibles.some((/** @type {any} */ c) => c != ancienne && c.pseudo.toLowerCase() == k))
      return refuser(`${p} est déjà dans la liste.`);
    if (e.enLecture[k]) return e.enLecture[k];
    let joueur = new Joueur({ pseudo: p });
    MultiFlood._etat(`Lecture de la page de ${p}…`);
    e.enLecture[k] = Promise.resolve(joueur.getProfil())
      .then((html) => {
        let texte = String(html);
        if (!joueur.chargerProfil(texte) || !(joueur.terrain > 0) || !(Number(joueur.id) > 0))
          throw new Error(`page de ${p} illisible`);
        let moi = parseInt(Utils.parseHtml(texte).find("#quantite_tdc").text()),
          connu = joueur.x >= 0 && joueur.y >= 0 && !(joueur.x == 0 && joueur.y == 0),
          nouvelle = {
            pseudo: joueur.pseudo || p,
            id: Number(joueur.id),
            mv: !!joueur.mv,
            tdcLu: joueur.terrain,
            moiLu: moi > 0 ? moi : MultiFlood._monTdcLu(),
            lu: Horloge.serveur(),
            trajet: connu ? monProfil.getTempsParcours2(joueur) : null,
            tdcSaisi: null,
            saisiA: null,
            terrainFinal: null,
            priseMax: null,
            arrondi: 4,
            choix: {},
          },
          rang = ancienne ? e.cibles.indexOf(ancienne) : -1;
        if (moi > 0) e.moi.tdcLu = moi;
        if (rang >= 0) e.cibles[rang] = nouvelle;
        else e.cibles.push(nouvelle);
        MultiFlood._formulaire();
        return MultiFlood.completer();
      })
      .then(() => MultiFlood.rendre())
      .catch((err) => {
        MultiFlood._etat("");
        $.toast({
          ...TOAST_ERROR,
          text: `${p} n'a pas pu être ajouté : ${String((err && err.message) || "page illisible")}.`,
        });
        // une case changée reprend la cible gardée ; une case vide garde le pseudo tapé
        MultiFlood._formulaire();
      })
      .then(() => {
        delete e.enLecture[k];
      });
    return e.enLecture[k];
  }
  /**
   * TdC de moi et d'une cible à l'impact d'une attaque lancée maintenant,
   * d'après les partages, depuis les TdC lus sur sa page (ou saisis) ; case
   * « TdC à l'impact » décochée : les TdC actuels, comme la page du Compte+.
   * Les attaques de ce multi-flood sur les cibles plus proches sont des floods
   * de la même simulation : ce qui dépend de mon TdC entre deux impacts (portée,
   * 20 % d'un flood sur moi) en tient compte.
   *
   * @static
   * @method impact
   * @param {any} c cible
   * @param {Array<{pseudo: String, cle: String, prise: Number, tdc: Number}>} [precedentes]
   *   attaques cochées de ce multi-flood sur les cibles plus proches, dans l'ordre
   *   d'envoi : cible, minute du RC, prise, TdC lu de la cible
   * @param {any} [minute] minute du RC de la cible, déjà calculée pendant ce rendu
   * @return {{minute: any, cle: String, moi: Number, cible: Number, partages: Boolean, actuels: Boolean, moiAvant: Number, cibleAvant: Number}}
   *   moiAvant, cibleAvant : TdC d'où part le calcul (lus ou saisis) ; partages :
   *   TdC simulés
   */
  static impact(c, precedentes = [], minute = undefined) {
    let e = etatMultiFlood,
      cible = c.tdcSaisi ?? c.tdcLu;
    if (minute === undefined)
      minute = c.trajet != null ? Utils.roundMinute(c.trajet, Horloge.clic()) : null;
    let cle = minute ? minute.format("YYYY-MM-DD HH:mm") : "";
    if (!MultiFlood.avecImpact()) {
      let moi = MultiFlood._monTdc();
      return {
        minute,
        cle,
        moi,
        cible,
        partages: false,
        actuels: true,
        moiAvant: moi,
        cibleAvant: cible,
      };
    }
    let moi = e.moi.tdcSaisi ?? c.moiLu,
      depuis = [c.lu, c.saisiA, e.moi.tdcSaisi != null ? e.moi.saisiA : null]
        .filter(Boolean)
        .sort((a, b) => b.valueOf() - a.valueOf())[0],
      sans = {
        minute,
        cle,
        moi,
        cible,
        partages: false,
        actuels: false,
        moiAvant: moi,
        cibleAvant: cible,
      };
    if (!minute || !e.partages) return sans;
    let r = PageAttaquer.tdcImpact(
      MultiFlood._simuler(c, precedentes),
      monProfil.pseudo,
      c.pseudo,
      cle,
    );
    return {
      ...sans,
      moi: r.moi.tdc ?? moi,
      cible: r.cible.tdc ?? cible,
      partages: true,
    };
  }
  /**
   * Partages rejoués avec des attaques de ce multi-flood, mes floods datés à la
   * minute du RC de leur cible et numérotés après ceux du jeu, depuis les TdC
   * lus sur la page de la cible `c` (le mien compris) et ceux des cibles de ces
   * attaques.
   *
   * @private
   * @static
   * @param {any} c cible dont la lecture donne mon TdC et l'heure de départ
   * @param {Array<{pseudo: String, cle: String, prise: Number, tdc: Number}>} attaques
   * @param {Boolean} [ajouter] false : TdC des mêmes cibles, sans leurs attaques
   * @return {any} PartageChasses.simuler()
   */
  static _simuler(c, attaques, ajouter = true) {
    let e = etatMultiFlood,
      depuis = [c.lu, c.saisiA, e.moi.tdcSaisi != null ? e.moi.saisiA : null]
        .filter(Boolean)
        .sort((a, b) => b.valueOf() - a.valueOf())[0];
    /** @type {Object<string, Number>} */
    let connus = {},
      floods = attaques.map((p, k) => {
        connus[p.pseudo] = p.tdc;
        return {
          id: NUMERO_ATTAQUES_MULTI_FLOOD + k,
          date: p.cle,
          lanceur: monProfil.pseudo,
          cible: p.pseudo,
          unites: p.prise,
          terrain: p.prise,
        };
      });
    connus[monProfil.pseudo] = e.moi.tdcSaisi ?? c.moiLu;
    connus[c.pseudo] = c.tdcSaisi ?? c.tdcLu;
    // copie : les partages lus restent ceux du forum
    let d =
      ajouter && floods.length
        ? { chasses: e.partages.d.chasses, floods: e.partages.d.floods.concat(floods) }
        : e.partages.d;
    return PartageChasses.simuler(d, PartageChasses.tdcConnus(e.partages.tdc, connus), depuis);
  }
  /**
   * Mes floods déjà lancés que les attaques cochées de ce multi-flood font
   * sortir de portée (demande du mainteneur, 19/11/2026) : à portée sans elles,
   * ils ne prendraient plus rien avec. Seulement avec le TdC à l'impact : il faut
   * la simulation des partages, et la minute du RC de chaque cible.
   *
   * @static
   * @method floodsPerdus
   * @return {Array<{cible: String, date: String, prise: Number}>} prise : sans ce multi-flood
   */
  static floodsPerdus() {
    let e = etatMultiFlood;
    if (!e || !e.partages || !MultiFlood.avecImpact()) return [];
    let dates = e.resultats.filter((/** @type {any} */ r) => r.impact && r.impact.partages),
      attaques = dates.flatMap((/** @type {any} */ r) =>
        r.attaques
          .filter((/** @type {any} */ a) => a.coche && a.prise > 0)
          .map((/** @type {any} */ a) => ({
            pseudo: r.cible.pseudo,
            cle: r.impact.cle,
            prise: a.prise,
            tdc: r.cible.tdcSaisi ?? r.cible.tdcLu,
          })),
      );
    if (!attaques.length) return [];
    // la cible lue en dernier donne mon TdC et l'heure de départ des deux simulations
    let ref = dates
        .map((/** @type {any} */ r) => r.cible)
        .sort((/** @type {any} */ a, /** @type {any} */ b) => (b.lu || 0) - (a.lu || 0))[0],
      moi = String(monProfil.pseudo).toLowerCase(),
      mien = (/** @type {any} */ ev) =>
        ev.type == "flood" &&
        String(ev.lanceur).toLowerCase() == moi &&
        !(ev.id >= NUMERO_ATTAQUES_MULTI_FLOOD),
      cle = (/** @type {any} */ ev) => `${ev.id}|${ev.date}|${String(ev.cible).toLowerCase()}`,
      avant = new Map(
        MultiFlood._simuler(ref, attaques, false)
          .evenements.filter(mien)
          .map((/** @type {any} */ ev) => [cle(ev), ev]),
      );
    return MultiFlood._simuler(ref, attaques)
      .evenements.filter((/** @type {any} */ ev) => {
        let sans = avant.get(cle(ev));
        return (
          mien(ev) && ev.statut == "portee" && sans && sans.statut != "portee" && sans.prise > 0
        );
      })
      .map((/** @type {any} */ ev) => ({
        cible: ev.cible,
        date: ev.date,
        prise: avant.get(cle(ev)).prise,
      }));
  }
  /**
   * @private
   * @static
   * @param {Array<{cible: String, date: String, prise: Number}>} perdus floodsPerdus()
   * @return {Array<String>} une phrase par flood, en texte
   */
  static _phrasesPerdus(perdus) {
    return perdus.map(
      (f) =>
        `Avec les attaques cochées, ton flood déjà lancé sur ${f.cible} (impact le ${moment(f.date, "YYYY-MM-DD HH:mm").format("DD/MM [à] HH[h]mm")}) serait hors de portée : il ne prendrait rien au lieu de ${numeral(f.prise).format()}.`,
    );
  }
  /**
   * @private
   * @static
   */
  static _afficherAvertissement() {
    let phrases = MultiFlood._phrasesPerdus(MultiFlood.floodsPerdus());
    $("#o_mfoAvertissement").html(phrases.map((t) => `⚠ ${Utils.echapper(t)}`).join("<br/>"));
  }
  /**
   * Plan refait et affiché : TdC à l'impact, attaques, récapitulatif.
   *
   * @static
   * @method rendre
   */
  static rendre() {
    let e = etatMultiFlood;
    if (!e) return;
    let entrees = e.cibles.map((/** @type {any} */ c) => ({ c, impact: MultiFlood.impact(c) }));
    e.minutes = entrees.map((/** @type {any} */ x) => x.impact.cle).join("|");
    e.resultats = MultiFlood.plan(
      {
        armee: MultiFlood.disponibles(),
        attaquesDispo: MultiFlood.attaquesDispo(),
        priseMax: e.moi.priseMax,
        terrainFinal: e.moi.terrainFinal,
      },
      entrees.map((/** @type {any} */ { c, impact }) => ({
        cible: c,
        impact,
        trajet: c.trajet,
        tdcMoi: impact.moi,
        tdc: impact.cible,
        priseMax: c.priseMax,
        terrainFinal: c.terrainFinal,
        arrondi: c.arrondi,
        attaquable: !c.mv,
        choix: c.choix,
      })),
      (/** @type {any} */ x, /** @type {Array<any>} */ precedentes) =>
        precedentes.length
          ? MultiFlood.impact(
              x.cible,
              precedentes.map((p) => ({
                pseudo: p.c.cible.pseudo,
                cle: p.c.impact.cle,
                prise: p.prise,
                tdc: p.c.cible.tdcSaisi ?? p.c.cible.tdcLu,
              })),
              x.impact.minute,
            )
          : x.impact,
    );
    MultiFlood._afficherResultats();
    MultiFlood._afficherAvertissement();
    MultiFlood._afficherRecap();
    e.gardees.afficher(e.armee);
    MultiFlood._etat(
      e.erreur
        ? e.erreur.charAt(0).toUpperCase() + e.erreur.slice(1) + "."
        : e.lecture && !e.partages && e.base == null
          ? "Lecture en cours…"
          : "",
    );
  }
  /**
   * Durée comme la page Flood TdC du jeu : deux unités au plus (« 3h 49m »).
   *
   * @static
   * @method duree
   * @param {Number} secondes
   * @return {String}
   */
  static duree(secondes) {
    let s = Math.max(0, Math.floor(secondes)),
      nombres = [
        Math.floor(s / 86400),
        Math.floor((s % 86400) / 3600),
        Math.floor((s % 3600) / 60),
        s % 60,
      ],
      unites = ["j", "h", "m", "s"],
      premiere = nombres.findIndex((n) => n > 0);
    if (premiere < 0) return "0s";
    return [premiere, premiere + 1]
      .filter((i) => i < nombres.length && nombres[i] > 0)
      .map((i) => nombres[i] + unites[i])
      .join(" ");
  }
  /**
   * @static
   * @method disponibles
   * @return {Number|null} unités de l'armée lue, sans celles gardées ; null avant sa lecture
   */
  static disponibles() {
    let e = etatMultiFlood;
    if (!e.armee) return null;
    e.armee.gardees = e.gardees.reglage;
    return e.armee
      .disponibleFlood()
      .reduce((/** @type {Number} */ s, /** @type {Number} */ n) => s + n, 0);
  }
  /**
   * @static
   * @method attaquesDispo
   * @return {Number|null} créneaux d'attaque libres (Vitesse d'attaque + 1) ; null si inconnus
   */
  static attaquesDispo() {
    let va = monProfil.niveauRecherche[6],
      enCours = etatMultiFlood.enCours;
    return va >= 0 && enCours != null ? Math.max(0, va + 1 - enCours) : null;
  }
  /**
   * Arrondi de la prise totale, celui de la page Flood TdC du jeu.
   *
   * @static
   * @method arrondir
   * @param {Number} prise
   * @param {Number} arrondi 1 Fort, 2 Normal, 3 Faible ; autre : aucun
   * @return {Number}
   */
  static arrondir(prise, arrondi) {
    if (!(prise > 0) || ![1, 2, 3].includes(arrondi)) return prise;
    let chiffres = Math.ceil(Math.log(prise) / Math.LN10),
      premier = Math.floor(prise / Math.pow(10, chiffres - 1)),
      pas = Math.pow(10, chiffres - arrondi) * (premier == 1 ? 1 : premier < 5 ? 2.5 : 5);
    return pas * Math.floor(prise / pas);
  }
  /**
   * Attaques sur une cible, comme la page Flood TdC du jeu : 20 % de son TdC
   * tant que je reste à portée, une attaque qui m'amène à la limite (elle aux
   * deux tiers de mon TdC… la moitié après), puis 20 % une dernière fois.
   *
   * @static
   * @method attaquesCible
   * @param {Number} t0 mon TdC à l'impact
   * @param {Number} ti TdC de la cible à l'impact
   * @param {{priseMax?: Number|null, terrainFinal?: Number|null, arrondi?: Number, priseGlobale?: Number|null, terrainFinalMoi?: Number|null}} [o]
   * @return {{hors: String|null, priseMax: Number, attaques: Array<{prise: Number, pct: Number, moi: Number, cible: Number}>, total: Number, moiFin: Number, cibleFin: Number}}
   *   hors : "haut", "bas" (hors de portée) ou "inconnu" (TdC inconnu)
   */
  static attaquesCible(t0, ti, o = {}) {
    /** @type {Array<{prise: Number, pct: Number, moi: Number, cible: Number}>} */
    let attaques = [],
      r = {
        hors: /** @type {String|null} */ (null),
        priseMax: 0,
        attaques,
        total: 0,
        moiFin: t0,
        cibleFin: ti,
      };
    if (!(t0 > 0) || !(ti > 0)) return { ...r, hors: "inconnu" };
    if (!Utils.aPortee(ti, t0)) return { ...r, hors: ti > t0 ? "haut" : "bas" };
    let seuilAtt = Math.floor(((ti + t0) * 2) / 3),
      seuilDef = Math.ceil((ti + t0) / 3),
      arrondir = true;
    if (seuilAtt < t0) {
      seuilAtt = t0;
      seuilDef = ti;
    }
    let priseMax = Math.floor(seuilAtt - t0 + Math.floor(0.2 * seuilDef));
    if (o.priseMax != null && o.priseMax > 0 && priseMax > o.priseMax) {
      priseMax = o.priseMax;
      arrondir = false;
    }
    if (o.priseGlobale != null && priseMax > o.priseGlobale) {
      priseMax = o.priseGlobale;
      arrondir = false;
    }
    // terrain final déjà atteint : aucune attaque (la page du jeu attaquait quand même)
    if (o.terrainFinal != null && o.terrainFinal > 0) {
      if (o.terrainFinal >= ti) priseMax = 0;
      else if (o.terrainFinal > ti - priseMax) priseMax = ti - o.terrainFinal;
      arrondir = false;
    }
    if (o.terrainFinalMoi != null && o.terrainFinalMoi > 0) {
      if (o.terrainFinalMoi <= t0) priseMax = 0;
      else if (o.terrainFinalMoi < t0 + priseMax) priseMax = o.terrainFinalMoi - t0;
      arrondir = false;
    }
    if (arrondir && o.arrondi) priseMax = MultiFlood.arrondir(priseMax, o.arrondi);
    r.priseMax = Math.max(0, priseMax);
    let moi = t0,
      cible = ti,
      total = 0,
      ajouter = (/** @type {Number} */ a) => {
        attaques.push({ prise: a, pct: Math.round((100 * a) / cible), moi, cible });
        total += a;
        moi += a;
        cible -= a;
      };
    for (let encore = r.priseMax > 0; encore; ) {
      let a = Math.floor(0.2 * cible);
      if (moi + a > seuilAtt) {
        a = seuilAtt - moi;
        encore = false;
      }
      if (total + a > r.priseMax) {
        a = r.priseMax - total;
        encore = false;
      }
      // sans prise possible, la boucle de la page du jeu ne finirait pas
      if (a > 0) ajouter(a);
      else break;
    }
    if (r.priseMax > total) ajouter(r.priseMax - total);
    return { ...r, total, moiFin: moi, cibleFin: cible };
  }
  /**
   * Plan du multi-flood : cibles de la plus proche à la plus lointaine, mon TdC
   * à l'impact de chacune avec les attaques cochées sur les plus proches.
   * Cochées d'office tant que l'armée et les créneaux suffisent, comme la page
   * du jeu ; un choix du joueur garde sa case sans changer les autres.
   *
   * @static
   * @method plan
   * @param {{armee: Number|null, attaquesDispo: Number|null, priseMax: Number|null, terrainFinal: Number|null}} a
   * @param {Array<any>} cibles {trajet, tdcMoi, tdc, priseMax, terrainFinal, arrondi, attaquable, choix, …}
   * @param {function(any, Array<{c: any, prise: Number}>): any} [impactAvec] TdC à
   *   l'impact d'une cible simulés avec les attaques cochées des plus proches
   *   (MultiFlood.impact) ; sans lui, ou sans simulation (partages : false), leurs
   *   prises sont ajoutées à tdcMoi
   * @return {Array<any>} par cible, dans l'ordre d'envoi : la cible, ses attaques
   *   (coche), t0 et ti (mon TdC et le sien au départ des attaques), lance
   */
  static plan(a, cibles, impactAvec = undefined) {
    let armee = a.armee == null ? Infinity : a.armee,
      dispo = a.attaquesDispo == null ? Infinity : a.attaquesDispo,
      gain = 0,
      priseGlobale = a.priseMax != null && a.priseMax > 0 ? a.priseMax : null,
      /** @type {Array<{c: any, prise: Number}>} */
      precedentes = [];
    return cibles
      .map((c, rang) => ({ c, rang }))
      .sort((x, y) => (x.c.trajet ?? Infinity) - (y.c.trajet ?? Infinity) || x.rang - y.rang)
      .map(({ c }) => {
        let im = impactAvec ? impactAvec(c, precedentes.slice()) : null,
          simule = !!(im && im.partages),
          t0 = simule ? im.moi : c.tdcMoi + gain,
          ti = simule ? im.cible : c.tdc,
          r = MultiFlood.attaquesCible(t0, ti, {
            priseMax: c.priseMax,
            terrainFinal: c.terrainFinal,
            arrondi: c.arrondi,
            priseGlobale,
            terrainFinalMoi: a.terrainFinal,
          }),
          lance = 0;
        r.attaques.forEach((/** @type {any} */ att, /** @type {Number} */ i) => {
          let choix = c.choix ? c.choix[i] : undefined,
            tient = att.prise <= armee && dispo > 0;
          if (c.attaquable) {
            // la page du jeu ne coche plus rien après une attaque qui ne tient pas
            if (tient) {
              armee -= att.prise;
              dispo--;
            } else armee = 0;
          }
          att.coche = !!c.attaquable && (choix === undefined ? tient : !!choix);
          if (att.coche) {
            lance += att.prise;
            precedentes.push({ c, prise: att.prise });
          }
        });
        gain += lance;
        if (priseGlobale != null) priseGlobale = Math.max(0, priseGlobale - lance);
        return { ...c, ...r, t0, ti, lance };
      });
  }
  /**
   * D'où vient l'écart entre un TdC lu et celui d'où partent les attaques :
   * « (+61 648 des chasses et floods en cours, +46 648 de ce multi-flood) ».
   *
   * @static
   * @method origines
   * @param {Number} lu TdC lu (ou saisi)
   * @param {Number} partages TdC à l'impact d'après les partages seuls
   * @param {Number} total TdC à l'impact avec les attaques de ce multi-flood sur les cibles plus proches
   * @return {String} vide sans écart
   */
  static origines(lu, partages, total) {
    let parts = [
      [partages - lu, "des chasses et floods en cours"],
      [total - partages, "de ce multi-flood"],
    ]
      .filter(([v]) => v)
      .map(([v, texte]) => `${numeral(v).format("+0,0")} ${texte}`);
    return parts.length ? ` (${parts.join(", ")})` : "";
  }
  /**
   * Un seul tableau, une section encadrée par cible (colonnes et cases des
   * attaques alignées d'une cible à l'autre), comme la page du Compte+ ; TdC à
   * l'impact : une ligne sous le titre dit d'où partent les chiffres.
   *
   * @private
   * @static
   */
  static _afficherResultats() {
    let e = etatMultiFlood,
      html = e.resultats.map((/** @type {any} */ r) => {
        let c = r.cible,
          im = r.impact,
          pseudo = Utils.echapper(c.pseudo),
          calcule = im.partages && im.minute,
          aLImpact = calcule ? " à l'impact" : "",
          tete = `<tr class='ligne_paire'><th class='left'>${pseudo} <span class='normal'>(${c.trajet != null ? MultiFlood.duree(c.trajet) : "?"})${c.mv ? " en vacances" : ""}</span></th><th>Mon Terrain</th><th>Terrain de ${pseudo}</th><th>Prise</th></tr>`,
          // partages illisibles : la ligne d'état le dit déjà, une fois
          note = calcule
            ? `<tr><td colspan='4' class='left reduce o_mfoNote'>À l'impact le ${im.minute.format("DD/MM [à] HH[h]mm")} : toi ${numeral(r.t0).format()}${MultiFlood.origines(im.moiAvant, im.moi, r.t0)}, ${pseudo} ${numeral(r.ti).format()}${MultiFlood.origines(im.cibleAvant, im.cible, r.ti)}</td></tr>`
            : !im.actuels && !im.minute
              ? `<tr><td colspan='4' class='left reduce o_mfoNote'>Trajet inconnu : TdC actuels</td></tr>`
              : "",
          message = (/** @type {String} */ texte) =>
            `<tr><td colspan='4' class='left'>${texte}</td></tr>`,
          corps =
            r.hors == "haut"
              ? message(`Le terrain de la cible est trop haut${aLImpact}`)
              : r.hors == "bas"
                ? message(`Le terrain de la cible est trop bas${aLImpact}`)
                : r.hors == "inconnu"
                  ? message("TdC inconnu")
                  : !r.attaques.length
                    ? message("Pas d'attaque")
                    : r.attaques
                        .map(
                          (/** @type {any} */ a, /** @type {Number} */ i) =>
                            `<tr${i % 2 ? " class='ligne_paire'" : ""}><td class='left'>${
                              c.mv
                                ? `Attaque ${i + 1} (${a.pct} %)`
                                : `<label><input type='checkbox' class='o_mfoCoche' data-pseudo='${pseudo}' data-i='${i}'${a.coche ? " checked" : ""}/> Attaque ${i + 1} (${a.pct} %)</label>`
                            }</td><td>${numeral(a.moi).format()}</td><td>${numeral(a.cible).format()}</td><td>${numeral(a.prise).format()}</td></tr>`,
                        )
                        .join(""),
          resultat = `<tr class='gras ligne_paire'><td>Résultat</td><td>${numeral(r.moiFin).format()}</td><td>${numeral(r.cibleFin).format()}</td><td>${numeral(r.total).format()}</td></tr>`;
        return `<tbody class='o_mfoCible' data-pseudo='${pseudo}'>${tete}${note}${corps}${resultat}</tbody>`;
      });
    $("#o_mfoResultats").html(
      html.length
        ? `<div class='o_mfoTableau'><table id='o_mfoCibles' cellspacing='0'>${html.join("<tbody class='o_mfoEspace'><tr><td colspan='4'></td></tr></tbody>")}</table></div>`
        : "",
    );
  }
  /**
   * Récapitulatif de la page du jeu : attaques et fourmis demandées, part des
   * créneaux libres et de l'armée ; boutons actifs si tout tient.
   *
   * @private
   * @static
   */
  static _afficherRecap() {
    let e = etatMultiFlood,
      attaques = 0,
      fourmis = 0;
    e.resultats.forEach((/** @type {any} */ r) =>
      r.attaques.forEach((/** @type {any} */ a) => {
        if (!a.coche) return;
        attaques++;
        fourmis += a.prise;
      }),
    );
    let dispo = MultiFlood.attaquesDispo(),
      armee = MultiFlood.disponibles(),
      part = (/** @type {Number} */ n, /** @type {Number} */ total) => {
        let p = Math.floor((100 * n) / total);
        return p > 100 ? `<strong class='red'>${p} %</strong>` : `${p} %`;
      },
      texte = !attaques
        ? ""
        : dispo === 0
          ? "Tu n'as pas d'attaque disponible."
          : armee === 0
            ? "Tu n'as pas d'armée disponible (sans les unités gardées)."
            : `Ce flood demande ${attaques} attaque${attaques > 1 ? "s" : ""} et ${numeral(fourmis).format()} fourmis` +
              (dispo != null && armee != null
                ? `,<br/>soit ${part(attaques, dispo)} de tes attaques disponibles et ${part(fourmis, armee)} de ton armée sans les unités gardées.`
                : armee == null
                  ? " (armée pas encore lue)."
                  : ".");
    $("#o_mfoRecap").html(texte);
    let pret =
      !e.lance &&
      attaques > 0 &&
      armee != null &&
      fourmis <= armee &&
      (dispo == null || attaques <= dispo);
    $("#o_mfoLancerPartager").prop("disabled", !pret);
  }
  /**
   * @private
   * @static
   * @param {String} texte
   */
  static _etat(texte) {
    $("#o_mfoEtat").text(texte);
  }
  /**
   * Minute d'impact changée (le temps passe) : plan refait, sans requête.
   *
   * @private
   * @static
   */
  static _suivre() {
    let e = etatMultiFlood;
    if (!e || e.lance || !MultiFlood.avecImpact() || !$("#o_multiFlood").is(":visible")) return;
    let cles = e.cibles.map((/** @type {any} */ c) => MultiFlood.impact(c).cle).join("|");
    if (cles != e.minutes) MultiFlood.rendre();
  }
  /**
   * Lance les attaques cochées, de la plus proche cible à la plus lointaine :
   * armée relue (unités gardées jamais envoyées), page d'attaque de chaque
   * cible lue pour son jeton, chaque attaque postée une seconde après la
   * précédente ; puis la page Armée (replacement, partage des « + partager »).
   *
   * @static
   * @method lancer
   * @param {Boolean} partager
   * @return {Promise<void>}
   */
  static lancer(partager) {
    let e = etatMultiFlood;
    if (e.lance) return Promise.resolve();
    let aLancer = e.resultats
        .map((/** @type {any} */ r) => ({
          cible: r.cible,
          attaques: r.attaques
            .map((/** @type {any} */ a, /** @type {Number} */ i) => ({ ...a, i }))
            .filter((/** @type {any} */ a) => a.coche && a.prise > 0),
        }))
        .filter((/** @type {any} */ x) => x.attaques.length),
      nombre = aLancer.reduce(
        (/** @type {Number} */ s, /** @type {any} */ x) => s + x.attaques.length,
        0,
      ),
      demandees = aLancer.reduce(
        (/** @type {Number} */ s, /** @type {any} */ x) =>
          s + x.attaques.reduce((/** @type {Number} */ t, /** @type {any} */ a) => t + a.prise, 0),
        0,
      );
    if (!nombre) return Promise.resolve();
    let perdus = MultiFlood._phrasesPerdus(MultiFlood.floodsPerdus());
    if (
      !confirm(
        `Lancer ${nombre} attaque(s) sur ${aLancer.length} cible(s) ? Unités gardées : ${Armee.texteGardees(e.armee.gardeesFlood())}.${perdus.length ? `\n\nAttention : ${perdus.join("\n")}` : ""}\n\nCette action est irréversible.`,
      )
    )
      return Promise.resolve();
    e.lance = true;
    e.gardees.activer(false);
    $("#o_mfoLancerPartager").prop("disabled", true).text("Lancement…");
    Journal.info(
      "Multi-flood opti",
      `lancement de ${nombre} attaque(s) sur ${aLancer.map((/** @type {any} */ x) => x.cible.pseudo).join(", ")}`,
    );
    let suivi = { parties: 0 };
    return Promise.resolve($.get(location.origin + "/Armee.php"))
      .then((html) => {
        let texte = String(html),
          armee = new Armee();
        if (!/Troupes en Garnison/i.test(texte)) throw new Error("ton armée n'a pas pu être relue");
        armee.chargeData(texte);
        armee.gardees = e.gardees.reglage;
        let disponibles = armee
          .disponibleFlood()
          .reduce((/** @type {Number} */ s, /** @type {Number} */ n) => s + n, 0);
        if (demandees > disponibles)
          throw new Error(
            `ces attaques demandent ${numeral(demandees).format()} unités, ${numeral(disponibles).format()} disponibles sans les unités gardées`,
          );
        return aLancer.reduce(
          (/** @type {Promise<any>} */ suite, /** @type {any} */ x) =>
            suite.then(() => MultiFlood._lancerCible(armee, x, partager, suivi)),
          Promise.resolve(),
        );
      })
      .then(() => {
        $.toast({ ...TOAST_SUCCESS, text: "Multi-flood lancé." });
        // comme le Lanceur de Flood : la page Armée replace l'armée et partage
        sessionStorage.setItem("outiiil_floodPuisReplacer", "1");
        MultiFlood.ouvrir("/Armee.php");
      })
      .catch((err) => {
        let message = String((err && err.message) || err);
        Journal.erreur("Multi-flood opti", "lancement interrompu", message);
        $("#o_mfoLancerPartager").text("Lancer + partager");
        if (suivi.parties) {
          // des attaques sont parties : pas de nouvel essai d'ici (rien ne part deux fois)
          $.toast({
            ...TOAST_ERROR,
            hideAfter: false,
            text: `Multi-flood interrompu (${message}). Vérifie tes attaques en cours avant de relancer : recharge la page.`,
          });
          MultiFlood._etat("Multi-flood interrompu : recharge la page avant de relancer.");
          return;
        }
        $.toast({ ...TOAST_ERROR, hideAfter: false, text: `Rien n'est parti : ${message}.` });
        e.lance = false;
        e.gardees.activer(true);
        MultiFlood._afficherRecap();
      });
  }
  /**
   * @private
   * @static
   * @param {Armee} armee unités relues, diminuées de celles déjà parties
   * @param {any} x {cible, attaques}
   * @param {Boolean} partager
   * @param {{parties: Number}} suivi
   * @return {Promise<void>}
   */
  static _lancerCible(armee, x, partager, suivi) {
    let c = x.cible;
    return Promise.resolve($.get(`${location.origin}/ennemie.php?Attaquer=${c.id}`)).then(
      (html) => {
        let texte = String(html),
          $page = Utils.parseHtml(texte),
          jeton = $page.find("input#t").last(),
          pseudoCible = String($page.find("input[name=pseudoCible]").val() || c.pseudo);
        if (!jeton.length || !$page.find("#tabChoixArmee").length) {
          // plus attaquable (portée, vacances, déconnexion) : les autres cibles partent
          MultiFlood._marquer(c.pseudo, x.attaques, false);
          Journal.info(
            "Multi-flood opti",
            `${c.pseudo} : page d'attaque sans formulaire, attaques non lancées`,
          );
          $.toast({
            ...TOAST_WARNING,
            text: `${c.pseudo} n'est pas attaquable maintenant : ses attaques ne partent pas.`,
          });
          return;
        }
        armee.floods = x.attaques.map((/** @type {any} */ a) => a.prise);
        armee.repartirUniteFlood(armee.disponibleFlood());
        let securite = { [String(jeton.attr("name"))]: String(jeton.attr("value")) },
          repartition = armee.repartition.map((/** @type {Array<Number>} */ r) => r.slice());
        return x.attaques.reduce(
          (/** @type {Promise<any>} */ suite, /** @type {any} */ a, /** @type {Number} */ k) =>
            suite.then(() =>
              MultiFlood._envoyer(
                c,
                pseudoCible,
                securite,
                repartition[k],
                a,
                partager,
                k > 0,
              ).then((ok) => {
                if (!ok) return;
                suivi.parties++;
                // unités parties : la cible suivante ne les compte plus
                repartition[k].forEach((n, j) => {
                  armee.unite[j] = Math.max(0, armee.unite[j] - n);
                });
              }),
            ),
          Promise.resolve(),
        );
      },
    );
  }
  /**
   * @private
   * @static
   * @param {any} c cible
   * @param {String} pseudoCible
   * @param {Record<String, String>} securite jeton du formulaire d'attaque
   * @param {Array<Number>} repartition unités de l'attaque, ordre d'Armee.unite
   * @param {any} a attaque {prise, i}
   * @param {Boolean} partager
   * @param {Boolean} attendre une seconde avant l'envoi
   * @return {Promise<Boolean>} partie (le jeu dit « Vos troupes sont en marche »)
   */
  static _envoyer(c, pseudoCible, securite, repartition, a, partager, attendre) {
    return (attendre ? MultiFlood.pause(MS_ENTRE_ATTAQUES) : Promise.resolve())
      .then(() =>
        Promise.resolve(
          $.post(`${location.origin}/ennemie.php?Attaquer=${c.id}`, {
            ...securite,
            ChoixArmee: "1",
            lieu: String(LIEU_JEU_TERRAIN),
            pseudoCible,
            ...Armee.champsAttaque(repartition),
          }),
        ).catch(() => {
          MultiFlood._marquer(c.pseudo, [a], false);
          throw new Error(`le jeu n'a pas répondu (${c.pseudo}, attaque ${a.i + 1})`);
        }),
      )
      .then((data) => {
        let html = String(data),
          reponse = Utils.parseHtml(html).find("center:last").text(),
          ok = reponse.indexOf("Vos troupes sont en marche") != -1;
        MultiFlood._marquer(c.pseudo, [a], ok);
        if (!ok) {
          Journal.info(
            "Multi-flood opti",
            `${c.pseudo}, attaque ${a.i + 1} refusée par le jeu`,
            reponse.trim().slice(0, 200),
          );
          return false;
        }
        /** @type {Record<String, Number>} */
        let unite = {};
        repartition.forEach((n, j) => {
          if (n) unite[NOM_UNITE[j + 1]] = n;
        });
        AttaqueLancee.enregistrer(c.pseudo, "Terrain de chasse", unite, {
          html,
          terrain: c.tdcSaisi ?? c.tdcLu,
          partager,
        });
        return true;
      });
  }
  /**
   * @private
   * @static
   * @param {String} pseudo
   * @param {Array<any>} attaques {i}
   * @param {Boolean} ok
   */
  static _marquer(pseudo, attaques, ok) {
    let $table = $(".o_mfoCible").filter((i, t) => t.dataset.pseudo == pseudo);
    attaques.forEach((a) =>
      $table
        .find(`.o_mfoCoche[data-i='${a.i}']`)
        .closest("tr")
        .removeClass("red green")
        .addClass(ok ? "green" : "red"),
    );
  }
  /**
   * @static
   * @method pause
   * @param {Number} ms
   * @return {Promise<void>}
   */
  static pause(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
  /**
   * @static
   * @method ouvrir
   * @param {String} adresse
   */
  static ouvrir(adresse) {
    location.href = adresse;
  }
}
