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
   * @private
   * @static
   */
  static _construire() {
    etatMultiFlood = {
      cibles: [],
      moi: { tdcSaisi: null, terrainFinal: null, priseMax: null },
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
      gardees: new UnitesGardees("o_mfoGardees", () => MultiFlood.rendre(), {
        titre: "Unités gardées pour ce multi-flood",
      }),
    };
    let options = MultiFlood.options(),
      tag = Utils.echapper(Utils.alliance || "l'alliance");
    $("#centre")
      .append(`<div id='o_multiFlood' class='boite_amelioration simulateur centre${options ? " o_mfoOptions" : ""}' style='display:none'>
        <h2>Multi-flood opti</h2>
        <p class='left'>Optimise tes attaques pour prendre un maximum de terrain, avec le TdC de chacun à l'impact… <span class='cliquable2 o_mfoAide'>En savoir plus ?</span></p>
        <div class='o_mfoExplication left' style='display:none'>${MultiFlood._explication()}</div>
        <div class='o_mfoTableau'><table id='o_mfoForm' cellspacing='0'></table></div>
        <p class='o_mfoAjout'><input type='text' id='o_mfoPseudo' placeholder='Ajouter une cible (pseudo, ou %% : membres à portée)'/>
        <span class='cliquable2 o_mfoBoutonOptions'>Options <span class='o_mfoFleche'>${options ? "▲" : "▼"}</span></span></p>
        <p id='o_mfoEtat' class='reduce'></p>
        <div id='o_mfoResultats'></div>
        ${etatMultiFlood.gardees.html()}
        <div class='o_pile o_marginT15'><button type='button' id='o_mfoLancer' class='o_button o_lieu1' disabled>Lancer ces attaques</button>
        <button type='button' id='o_mfoLancerPartager' class='o_button o_lieu1' disabled title='Lancement, puis publication des attaques dans le forum de la ${tag}'>Lancer + partager</button></div>
        <p id='o_mfoRecap'></p>
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
    $vue.on("click", ".o_mfoRetirer", (e) => {
      let pseudo = String($(e.currentTarget).closest("tr").attr("data-pseudo"));
      etatMultiFlood.cibles = etatMultiFlood.cibles.filter(
        (/** @type {any} */ c) => c.pseudo != pseudo,
      );
      MultiFlood._formulaire();
      MultiFlood.completer().then(() => MultiFlood.rendre());
    });
    $vue.on("change", ".o_mfoCoche", (e) => {
      let caseCochee = /** @type {HTMLInputElement} */ (e.currentTarget),
        cible = MultiFlood._cible(String(caseCochee.dataset.pseudo));
      if (cible) cible.choix[Number(caseCochee.dataset.i)] = caseCochee.checked;
      MultiFlood.rendre();
    });
    $("#o_mfoLancer, #o_mfoLancerPartager").on("click", (e) =>
      MultiFlood.lancer(e.currentTarget.id == "o_mfoLancerPartager"),
    );
    $("#o_mfoPseudo")
      .autocomplete({
        minLength: 1,
        source: (/** @type {any} */ demande, /** @type {(l: Array<any>) => void} */ reponse) =>
          MultiFlood._suggestions(String(demande.term || "").trim()).then(reponse),
        select: (/** @type {any} */ e, /** @type {any} */ ui) => {
          MultiFlood.ajouter(ui.item.value);
          $("#o_mfoPseudo").val("");
          return false;
        },
      })
      .on("keydown", (e) => {
        if (e.key != "Enter") return;
        e.preventDefault();
        let pseudo = String($("#o_mfoPseudo").val() || "").trim();
        if (pseudo && pseudo != "%%") {
          MultiFlood.ajouter(pseudo);
          $("#o_mfoPseudo").val("");
        }
      });
  }
  /**
   * @private
   * @static
   * @return {String}
   */
  static _explication() {
    return `<p><span class='gras'>À quoi ça sert ?</span><br/>Une attaque ne peut pas prendre plus de 20 % du terrain de chasse de sa cible. Cet outil cherche la meilleure série d'attaques pour prendre un maximum de terrain, comme le « Flood TdC » du Compte+, sur autant de cibles que tu veux.</p>
      <p><span class='gras'>TdC à l'impact</span><br/>Chaque attaque est calculée avec le TdC de chacun à son arrivée (minute du RC) : celui que donnent les floods et chasses partagés dans le forum de l'alliance, tes chasses (page Ressources), tes attaques en cours, et les attaques cochées de ce multi-flood sur les cibles plus proches.</p>
      <p><span class='gras'>Comment ça marche ?</span><br/>Écris le pseudo d'une cible et choisis-le dans la liste ; %% propose les membres de ton alliance à portée. Les attaques commencent par la cible la plus proche. Coche ou décoche des attaques, dans la limite de tes attaques disponibles (Vitesse d'attaque + 1) et de ton armée sans les unités gardées. « Lancer ces attaques » les envoie une à une par la page d'attaque de chaque cible, puis ouvre la page Armée (replacement de l'armée ; partage avec « Lancer + partager »).</p>
      <p><span class='gras'>Options</span><br/>- Ton TdC et celui de chaque cible, si tu en connais un plus récent.<br/>- Terrain final : celui que tu veux atteindre, ou laisser à ta cible.<br/>- Prise max : par cible, ou pour tout le multi-flood sur ta ligne.<br/>- Arrondir : une prise trop précise se repère si tes ennemis te surveillent.</p>`;
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
   * Tableau des joueurs : moi, puis les cibles dans l'ordre de leur ajout.
   * Refait à l'ajout ou au retrait d'une cible ; les valeurs suivent ensuite.
   *
   * @private
   * @static
   */
  static _formulaire() {
    let e = etatMultiFlood,
      champ = (
        /** @type {String} */ cle,
        /** @type {String} */ nom,
        /** @type {Number|null} */ valeur,
      ) =>
        `<input type='text' class='o_mfoChamp' data-cle='${Utils.echapper(cle)}' data-champ='${nom}' value='${valeur ?? ""}' placeholder='—' size='9'/>`,
      arrondis = (/** @type {any} */ c) =>
        `<select class='o_mfoChamp' data-cle='${Utils.echapper(c.pseudo)}' data-champ='arrondi'>${ARRONDIS_MULTI_FLOOD.map(
          ([v, nom]) => `<option value='${v}'${c.arrondi == v ? " selected" : ""}>${nom}</option>`,
        ).join("")}</select>`,
      lignes = e.cibles.map(
        (/** @type {any} */ c) => `<tr data-pseudo='${Utils.echapper(c.pseudo)}'>
          <td class='left'><a href='Membre.php?Pseudo=${encodeURIComponent(c.pseudo)}'>${Utils.echapper(c.pseudo)}</a>${c.mv ? " <span class='red reduce'>(vacances)</span>" : ""}<br/><small title='Trajet'>${c.trajet != null ? MultiFlood.duree(c.trajet) : "trajet ?"}</small></td>
          <td>${champ(c.pseudo, "tdcSaisi", c.tdcSaisi ?? c.tdcLu)}</td>
          <td class='o_mfoImpact'></td>
          <td class='o_mfoOpt'>${champ(c.pseudo, "terrainFinal", c.terrainFinal)}</td>
          <td class='o_mfoOpt'>${champ(c.pseudo, "priseMax", c.priseMax)}</td>
          <td class='o_mfoOpt'>${arrondis(c)}</td>
          <td><span class='o_mfoRetirer cursor' title='Retirer cette cible'>✕</span></td></tr>`,
      );
    $("#o_mfoForm").html(`<thead><tr><th class='left'>Joueur</th><th>TdC</th><th>À l'impact</th>
        <th class='o_mfoOpt'>Terrain final</th><th class='o_mfoOpt'>Prise max</th><th class='o_mfoOpt'>Arrondir</th><th></th></tr></thead>
      <tbody><tr class='o_mfoMoi' data-pseudo=''><td class='left gras'>${Utils.echapper(monProfil.pseudo)}<br/><small class='normal'>attaquant</small></td>
        <td>${champ("", "tdcSaisi", e.moi.tdcSaisi ?? Utils.terrain)}</td><td class='reduce'>voir chaque cible</td>
        <td class='o_mfoOpt'>${champ("", "terrainFinal", e.moi.terrainFinal)}</td><td class='o_mfoOpt'>${champ("", "priseMax", e.moi.priseMax)}</td><td class='o_mfoOpt'></td><td></td></tr>
        ${lignes.join("")}</tbody>`);
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
        let lu = cle ? cible.tdcLu : Utils.terrain;
        cible.tdcSaisi = valeur && valeur != lu ? valeur : null;
        cible.saisiA = Horloge.serveur();
      } else cible[nom] = valeur;
      MultiFlood.rendre();
    });
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
   * @return {Number} mon TdC actuel : saisi dans les options, sinon celui de la page
   */
  static _monTdc() {
    return etatMultiFlood.moi.tdcSaisi ?? Utils.terrain;
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
   * Ajoute une cible : sa page de membre donne son id, ses coordonnées, son
   * TdC et le mien au même instant.
   *
   * @static
   * @method ajouter
   * @param {String} pseudo
   * @return {Promise<void>}
   */
  static ajouter(pseudo) {
    let e = etatMultiFlood,
      p = String(pseudo || "").trim();
    if (!p) return Promise.resolve();
    if (p.toLowerCase() == String(monProfil.pseudo).toLowerCase()) {
      $.toast({ ...TOAST_WARNING, text: "Tu ne peux pas t'attaquer toi-même." });
      return Promise.resolve();
    }
    if (
      MultiFlood._cible(p) ||
      e.cibles.some((/** @type {any} */ c) => c.pseudo.toLowerCase() == p.toLowerCase())
    ) {
      $.toast({ ...TOAST_WARNING, text: `${p} est déjà dans la liste.` });
      return Promise.resolve();
    }
    let joueur = new Joueur({ pseudo: p });
    MultiFlood._etat(`Lecture de la page de ${p}…`);
    return Promise.resolve(joueur.getProfil())
      .then((html) => {
        let texte = String(html);
        if (!joueur.chargerProfil(texte) || !(joueur.terrain > 0) || !(Number(joueur.id) > 0))
          throw new Error(`page de ${p} illisible`);
        let moi = parseInt(Utils.parseHtml(texte).find("#quantite_tdc").text()),
          connu = joueur.x >= 0 && joueur.y >= 0 && !(joueur.x == 0 && joueur.y == 0);
        e.cibles.push({
          pseudo: joueur.pseudo || p,
          id: Number(joueur.id),
          mv: !!joueur.mv,
          tdcLu: joueur.terrain,
          moiLu: moi > 0 ? moi : Utils.terrain,
          lu: Horloge.serveur(),
          trajet: connu ? monProfil.getTempsParcours2(joueur) : null,
          tdcSaisi: null,
          saisiA: null,
          terrainFinal: null,
          priseMax: null,
          arrondi: 4,
          choix: {},
        });
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
      });
  }
  /**
   * TdC de moi et d'une cible à l'impact d'une attaque lancée maintenant,
   * d'après les partages, depuis les TdC lus sur sa page (ou saisis).
   *
   * @static
   * @method impact
   * @param {any} c cible
   * @return {{minute: any, cle: String, moi: Number, cible: Number, partages: Boolean}}
   */
  static impact(c) {
    let e = etatMultiFlood,
      moi = e.moi.tdcSaisi ?? c.moiLu,
      cible = c.tdcSaisi ?? c.tdcLu,
      depuis = [c.lu, c.saisiA, e.moi.tdcSaisi != null ? e.moi.saisiA : null]
        .filter(Boolean)
        .sort((a, b) => b.valueOf() - a.valueOf())[0],
      minute = c.trajet != null ? Utils.roundMinute(c.trajet, Horloge.clic()) : null,
      cle = minute ? minute.format("YYYY-MM-DD HH:mm") : "";
    if (!minute || !e.partages) return { minute, cle, moi, cible, partages: false };
    let sim = PartageChasses.simuler(
        e.partages.d,
        PartageChasses.tdcConnus(e.partages.tdc, { [monProfil.pseudo]: moi, [c.pseudo]: cible }),
        depuis,
      ),
      r = PageAttaquer.tdcImpact(sim, monProfil.pseudo, c.pseudo, cle);
    return {
      minute,
      cle,
      moi: r.moi.tdc ?? moi,
      cible: r.cible.tdc ?? cible,
      partages: true,
    };
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
    );
    entrees.forEach((/** @type {any} */ { c, impact }) => {
      let ecart = impact.cible - (c.tdcSaisi ?? c.tdcLu);
      $("#o_mfoForm tr")
        .filter((i, tr) => tr.dataset.pseudo == c.pseudo)
        .find(".o_mfoImpact")
        .html(
          impact.minute
            ? `${numeral(impact.cible).format()} <small>${ecart ? `(${numeral(ecart).format("+0,0")})` : ""}</small><br/><small>${impact.minute.format("DD/MM HH[h]mm")}</small>`
            : "?",
        );
    });
    MultiFlood._afficherResultats();
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
    if (ti > 3 * t0) return { ...r, hors: "haut" };
    if (ti < 0.5 * t0) return { ...r, hors: "bas" };
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
   * à l'impact de chacune augmenté des prises cochées sur les plus proches.
   * Cochées d'office tant que l'armée et les créneaux suffisent, comme la page
   * du jeu ; un choix du joueur garde sa case sans changer les autres.
   *
   * @static
   * @method plan
   * @param {{armee: Number|null, attaquesDispo: Number|null, priseMax: Number|null, terrainFinal: Number|null}} a
   * @param {Array<any>} cibles {trajet, tdcMoi, tdc, priseMax, terrainFinal, arrondi, attaquable, choix, …}
   * @return {Array<any>} par cible, dans l'ordre d'envoi : la cible, ses attaques (coche), t0, lance
   */
  static plan(a, cibles) {
    let armee = a.armee == null ? Infinity : a.armee,
      dispo = a.attaquesDispo == null ? Infinity : a.attaquesDispo,
      gain = 0,
      priseGlobale = a.priseMax != null && a.priseMax > 0 ? a.priseMax : null;
    return cibles
      .map((c, rang) => ({ c, rang }))
      .sort((x, y) => (x.c.trajet ?? Infinity) - (y.c.trajet ?? Infinity) || x.rang - y.rang)
      .map(({ c }) => {
        let t0 = c.tdcMoi + gain,
          r = MultiFlood.attaquesCible(t0, c.tdc, {
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
          if (att.coche) lance += att.prise;
        });
        gain += lance;
        if (priseGlobale != null) priseGlobale = Math.max(0, priseGlobale - lance);
        return { ...c, ...r, t0, lance };
      });
  }
  /**
   * @private
   * @static
   */
  static _afficherResultats() {
    let e = etatMultiFlood,
      html = e.resultats.map((/** @type {any} */ r) => {
        let c = r.cible,
          pseudo = Utils.echapper(c.pseudo),
          tete = `<tr class='ligne_paire'><th class='left'>${pseudo} <span class='normal'>(${c.trajet != null ? MultiFlood.duree(c.trajet) : "?"})</span></th><th>Mon Terrain</th><th>Terrain de ${pseudo}</th><th>Prise</th></tr>`,
          impact = r.impact.minute
            ? `<tr><td colspan='4' class='left reduce'>Impact le ${r.impact.minute.format("DD/MM [à] HH[h]mm")}${r.impact.partages ? "" : " (TdC actuels : partages illisibles)"}</td></tr>`
            : `<tr><td colspan='4' class='left reduce'>Trajet inconnu : TdC actuels</td></tr>`,
          message = (/** @type {String} */ texte) =>
            `<tr><td colspan='4' class='left'>${texte}</td></tr>`,
          corps =
            r.hors == "haut"
              ? message("Le terrain de la cible est trop haut à l'impact")
              : r.hors == "bas"
                ? message("Le terrain de la cible est trop bas à l'impact")
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
        return `<div class='o_mfoTableau'><table class='o_mfoCible' data-pseudo='${pseudo}' cellspacing='0'>${tete}${impact}${corps}${resultat}</table></div>`;
      });
    $("#o_mfoResultats").html(html.join(""));
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
    $("#o_mfoLancer, #o_mfoLancerPartager").prop("disabled", !pret);
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
    if (!e || e.lance || !$("#o_multiFlood").is(":visible")) return;
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
    if (
      !confirm(
        `Lancer ${nombre} attaque(s) sur ${aLancer.length} cible(s) ? Unités gardées : ${Armee.texteGardees(e.armee.gardeesFlood())}. Cette action est irréversible.`,
      )
    )
      return Promise.resolve();
    e.lance = true;
    e.gardees.activer(false);
    $("#o_mfoLancer, #o_mfoLancerPartager").prop("disabled", true);
    $("#o_mfoLancer").text("Lancement…");
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
        $("#o_mfoLancer").text("Lancer ces attaques");
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
