// @ts-check
/*
 * ConseilRecherche.js
 * NumeroBis-boop
 **********************************************************************/

// Conseils sous « Bouclier Thoracique » et « Armes » du Laboratoire, méthode
// d'Optizzz (github.com/Achaak/Optizzz, licence MIT, conseil « Armes et
// Bouclier Thoracique ») : une recherche coûte des ouvrières, et les repondre
// prend un temps où la Reine pourrait pondre des unités à la place.
// +10 % de la caractéristique de base de l'armée par niveau
const PAS_RECHERCHE = 0.1;
// à 5 % près, le calcul ne départage pas la recherche et la ponte
const ECART_EGAL_CONSEIL = 0.05;
// en dessous (téléphone), la description du jeu est une colonne trop étroite :
// le bloc passe sur une ligne de toute la largeur, sous celle de la recherche
const LARGEUR_MIN_CONSEIL = 280;
// Armes comparée sur l'attaque (attaquant) ou la défense (défenseur), au choix
const CLE_CONSEIL_ARMES_STAT = "fzzz_conseilArmesStat";

/** @typedef {"vie"|"attaque"|"defense"} StatConseil */
/** @typedef {"bouclier"|"armes"} RechercheConseil */
const RECHERCHES_CONSEIL = {
  bouclier: { nom: "Bouclier Thoracique", ouvert: "fzzz_conseilBouclierOuvert" },
  armes: { nom: "Armes", ouvert: "fzzz_conseilArmesOuvert" },
};
const STATS_CONSEIL = {
  vie: { court: "de vie", long: "points de vie" },
  attaque: { court: "d'attaque", long: "dégâts en attaque" },
  defense: { court: "de défense", long: "dégâts en défense" },
};

/**
 * @typedef {{unite: Number, nombre: Number, gain: Number}} OptionPonte
 * @typedef {{secondes: Number, base: Number, gainRecherche: Number, options: Array<OptionPonte>,
 *   meilleure: OptionPonte|null, ecart: Number|null, seuil: Number}} Conseil
 * @typedef {{recherche: RechercheConseil, niveau: Number, ouvrieres: Number}} LigneConseil
 * @typedef {{armee: Array<Number>, complete: Boolean, vitesse: Number|null, pondables: Array<Number>}} DonneesConseil
 */
class ConseilRecherche {
  /**
   * @static
   * @method valeurs
   * @param {StatConseil} stat
   * @return {Array<Number>} la caractéristique de chaque unité, rangs de NOM_UNITE
   */
  static valeurs(stat) {
    return stat == "vie" ? VIE_UNITE : stat == "attaque" ? ATT_UNITE : DEF_UNITE;
  }
  /**
   * Niveau suivant de la recherche contre la ponte des unités, pendant le
   * temps de repondre les ouvrières qu'il coûte.
   *
   * @static
   * @method calculer
   * @param {{stat: StatConseil, niveau: Number, ouvrieres: Number, armee: Array<Number>, vitesse: Number, pondables: Array<Number>}} e
   *   niveau : celui d'avant la recherche (bonus des unités pondues) ; armee : nombres dans l'ordre de
   *   NOM_UNITE sans l'ouvrière ; vitesse : facteur des temps de ponte ; pondables : rangs dans NOM_UNITE
   * @return {Conseil}
   */
  static calculer({ stat, niveau, ouvrieres, armee, vitesse, pondables }) {
    let valeurs = ConseilRecherche.valeurs(stat),
      secondes = ouvrieres * TEMPS_UNITE[0] * vitesse,
      base = armee.reduce((s, n, i) => s + (n || 0) * valeurs[i + 1], 0),
      gainRecherche = base * PAS_RECHERCHE,
      options = pondables
        .filter((u, i, liste) => u > 0 && liste.indexOf(u) == i)
        .map((u) => {
          // un rien de marge : 7 235 s à 14,13 s l'une font 512 unités, pas 511,999…
          let nombre = Math.floor((ouvrieres * TEMPS_UNITE[0]) / TEMPS_UNITE[u] + 1e-9);
          return { unite: u, nombre, gain: nombre * valeurs[u] * (1 + PAS_RECHERCHE * niveau) };
        })
        .filter((o) => o.nombre > 0)
        .sort((a, b) => b.gain - a.gain),
      meilleure = options[0] || null;
    return {
      secondes,
      base,
      gainRecherche,
      options,
      meilleure,
      ecart: meilleure ? gainRecherche / meilleure.gain - 1 : null,
      seuil: meilleure ? meilleure.gain / PAS_RECHERCHE : 0,
    };
  }
  /**
   * @static
   * @method verdict
   * @param {Number|null} ecart
   * @return {"recherche"|"ponte"|"egal"}
   */
  static verdict(ecart) {
    if (ecart === null || ecart > ECART_EGAL_CONSEIL) return "recherche";
    return ecart < -ECART_EGAL_CONSEIL ? "ponte" : "egal";
  }
  /**
   * « +116 % de vie », ou « 4,2 × plus d'attaque » à partir du triple.
   *
   * @static
   * @method plus
   * @param {Number} ratio
   * @param {StatConseil} [stat]
   * @return {String}
   */
  static plus(ratio, stat = "vie") {
    let court = STATS_CONSEIL[stat].court;
    if (ratio < 3) return `+${numeral(Math.round((ratio - 1) * 100)).format()} % ${court}`;
    let fois = ratio < 10 ? Utils.decimal(ratio, 1, true) : numeral(Math.round(ratio)).format();
    return `${fois} × plus ${court}`;
  }
  /**
   * @static
   * @method texteVerdict
   * @param {Conseil} c
   * @param {StatConseil} [stat]
   * @return {String} la ligne repliée : le meilleur choix, et de combien
   */
  static texteVerdict(c, stat = "vie") {
    if (!c.meilleure || c.ecart === null)
      return "Recherche préférable : ce temps ne suffit à pondre aucune unité";
    let v = ConseilRecherche.verdict(c.ecart);
    if (v == "egal") return "Recherche et ponte se valent (à 5 % près)";
    if (v == "recherche")
      return `Recherche préférable · ${ConseilRecherche.plus(1 + c.ecart, stat)} que la ponte`;
    return `Ponte préférable · ${NOM_UNITES[c.meilleure.unite]} : ${ConseilRecherche.plus(1 / (1 + c.ecart), stat)}`;
  }
  /**
   * « 45 min », « 2 h 01 », « 3 j 5 h ».
   *
   * @static
   * @method duree
   * @param {Number} secondes
   * @return {String}
   */
  static duree(secondes) {
    let minutes = Math.ceil(secondes / 60);
    if (minutes < 60) return `${numeral(minutes).format()} min`;
    if (minutes < 24 * 60)
      return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
    let heures = Math.ceil(minutes / 60);
    return `${numeral(Math.floor(heures / 24)).format()} j ${heures % 24} h`;
  }
  /**
   * Unités que la Reine peut pondre : sur sa page, une ligne avec son champ de
   * quantité et aucun prérequis manquant (un prérequis manquant enlève le
   * champ, mais l'unité peut être dans l'armée).
   *
   * @static
   * @method pondables
   * @param {any} $page page Reine
   * @return {Array<Number>} rangs dans NOM_UNITE
   */
  static pondables($page) {
    return $page
      .find(".ligneAmelioration")
      .filter(
        (/** @type {Number} */ i, /** @type {Element} */ tr) =>
          $(tr).find("input[id^='input_cout_nombre']").length > 0 &&
          !$(tr).find(".verificationNonOK").length,
      )
      .map((/** @type {Number} */ i, /** @type {Element} */ tr) =>
        Utils.uniteLue($(tr).find("h2").first().text(), "Conseil du Laboratoire"),
      )
      .get()
      .filter((/** @type {Number} */ u) => u > 0);
  }
  /**
   * Niveau dont part le coût affiché : une recherche en cours (« - Armes 12
   * terminé dans : ») fait montrer au jeu le coût du niveau d'après. À lire
   * avant que l'extension range ces lignes.
   *
   * @static
   * @method niveauDepart
   * @param {any} $page page Laboratoire
   * @param {String} nom nom de la recherche
   * @param {Number} affiche niveau de la ligne
   * @return {Number}
   */
  static niveauDepart($page, nom, affiche) {
    let cle = Utils.texteUnite(nom),
      niveaux = $page
        .find("#centre strong")
        .map((/** @type {Number} */ i, /** @type {Element} */ s) => {
          let m = /^[\s-]*(.+?)\s+(\d+)\s+(?:termin|se\s+termine)/.exec(
            Utils.texteUnite($(s).text()),
          );
          return m && m[1] == cle ? Number(m[2]) : null;
        })
        .get();
    return Math.max(affiche, ...niveaux);
  }
  /**
   * @static
   * @method statArmes
   * @return {"attaque"|"defense"} ce sur quoi Armes est comparée, gardé par serveur
   */
  static statArmes() {
    try {
      return localStorage.getItem(CLE_CONSEIL_ARMES_STAT) == "defense" ? "defense" : "attaque";
    } catch (e) {
      return "attaque";
    }
  }
  /**
   * Bloc « Conseil » à la fin de la description de la ligne, replié sur son
   * verdict ; son ouverture est gardée par serveur.
   *
   * @static
   * @method afficher
   * @param {any} $description cellule de description de la ligne
   * @param {LigneConseil} ligne
   * @param {{manque: String}|DonneesConseil} donnees
   * @return {any} le bloc
   */
  static afficher($description, ligne, donnees) {
    let cleOuvert = RECHERCHES_CONSEIL[ligne.recherche].ouvert,
      ouvert = false;
    try {
      ouvert = localStorage.getItem(cleOuvert) == "1";
    } catch (e) {}
    $description.find(".o_conseil").remove();
    $description.closest("tr").next(".o_conseilLigne").remove();
    let $bloc = $(
      `<details class="o_conseil" data-recherche="${ligne.recherche}"${ouvert ? " open" : ""}></details>`,
    );
    $bloc.on("toggle", () => {
      try {
        if ($bloc.prop("open")) localStorage.setItem(cleOuvert, "1");
        else localStorage.removeItem(cleOuvert);
      } catch (e) {}
    });
    ConseilRecherche.placer($bloc, $description);
    ConseilRecherche._remplir($bloc, ligne, donnees);
    return $bloc;
  }
  /**
   * @private
   * @static
   * @param {any} $bloc
   * @param {LigneConseil} ligne
   * @param {{manque: String}|DonneesConseil} donnees
   */
  static _remplir($bloc, ligne, donnees) {
    let $resume = $(`<summary><span class="o_conseilTag">Conseil</span></summary>`);
    $bloc.empty().removeAttr("data-verdict").append($resume);
    if ("manque" in donnees) {
      $resume.append($("<span>").text(" " + donnees.manque));
      $bloc.append(
        `<div class="o_conseilCorps"><p class="o_conseilNote">Le conseil compare la recherche à la ponte d'unités pendant le temps de repondre ses ouvrières.</p></div>`,
      );
      return;
    }
    /** @type {StatConseil} */
    let stat = ligne.recherche == "bouclier" ? "vie" : ConseilRecherche.statArmes(),
      c = ConseilRecherche.calculer({
        stat,
        niveau: ligne.niveau,
        ouvrieres: ligne.ouvrieres,
        armee: donnees.armee,
        vitesse: donnees.vitesse || 1,
        pondables: donnees.pondables,
      });
    $bloc.attr("data-verdict", ConseilRecherche.verdict(c.ecart));
    $resume.append(
      " ",
      $("<strong>").text(ConseilRecherche.texteVerdict(c, stat)),
      ` <span class="o_conseilPlus">Détails</span>`,
    );
    let $corps = $(ConseilRecherche._corps(ligne, c, donnees, stat)).appendTo($bloc);
    $corps.find(".o_conseilChoix button").on("click", (e) => {
      try {
        localStorage.setItem(CLE_CONSEIL_ARMES_STAT, e.currentTarget.dataset.stat);
      } catch (err) {}
      ConseilRecherche._remplir($bloc, ligne, donnees);
    });
  }
  /**
   * Dans la description de la ligne, comme Optizzz ; sur une ligne de toute la
   * largeur juste dessous quand la description est trop étroite. Largeur
   * inconnue (0) : dans la description.
   *
   * @static
   * @method placer
   * @param {any} $bloc
   * @param {any} $description
   */
  static placer($bloc, $description) {
    let $ligne = $description.closest("tr"),
      $dessous = $ligne.next(".o_conseilLigne");
    $bloc.detach();
    let largeur = $description[0].getBoundingClientRect().width;
    if (largeur && largeur < LARGEUR_MIN_CONSEIL) {
      if (!$dessous.length)
        $dessous = $(
          `<tr class="o_conseilLigne"><td colspan="${$ligne.children().length}"></td></tr>`,
        ).insertAfter($ligne);
      $dessous.children("td").append($bloc);
    } else {
      $description.append($bloc);
      $dessous.remove();
    }
  }
  /**
   * @private
   * @static
   * @param {LigneConseil} ligne
   * @param {Conseil} c
   * @param {DonneesConseil} donnees
   * @param {StatConseil} stat
   * @return {String}
   */
  static _corps(ligne, c, donnees, stat) {
    let long = STATS_CONSEIL[stat].long,
      nombre = (/** @type {Number} */ n) => numeral(Math.round(n)).format().replace(/ /g, " "),
      unites = (/** @type {OptionPonte} */ o) =>
        `${nombre(o.nombre)} ${o.nombre > 1 ? NOM_UNITES[o.unite] : NOM_UNITE[o.unite]}`,
      haut = Math.max(c.gainRecherche, c.meilleure ? c.meilleure.gain : 0, 1),
      barre = (/** @type {String} */ libelle, /** @type {Number} */ valeur, recherche = false) =>
        `<div class="o_conseilBarre${recherche ? " o_conseilRecherche" : ""}"><div class="o_conseilBarreTete"><span>${libelle}</span><span class="o_conseilValeur">+${nombre(valeur)} ${long}</span></div><div class="o_conseilPiste"><span style="width:${(valeur / haut) * 100}%"></span></div></div>`,
      ouvrieres = `${nombre(ligne.ouvrieres)} ouvrière${ligne.ouvrieres > 1 ? "s" : ""}`,
      // sans niveaux de ponte connus, pas de durée : le verdict n'en dépend pas
      temps = donnees.vitesse
        ? ` : les repondre prend ${ConseilRecherche.duree(c.secondes)},`
        : ",",
      html = `<div class="o_conseilCorps">`;
    if (ligne.recherche == "armes")
      html += `<p class="o_conseilChoix" role="group">Comparer sur : ${[
        ["attaque", "l'attaque"],
        ["defense", "la défense"],
      ]
        .map(
          ([s, libelle]) =>
            `<button type="button" class="o_button" data-stat="${s}" aria-pressed="${s == stat}">${libelle}</button>`,
        )
        .join("")}</p>`;
    html += `<div class="o_conseilBarres">${barre(`Recherche niveau ${ligne.niveau + 1}`, c.gainRecherche, true)}${c.meilleure ? barre(`ou ${unites(c.meilleure)}`, c.meilleure.gain) : ""}</div>`;
    html += c.meilleure
      ? `<p>La recherche coûte ${ouvrieres}${temps} le temps de pondre ${unites(c.meilleure)} à la place.</p>
        <p>La recherche l'emporte dès ${nombre(Math.ceil(c.seuil))} ${long} de base dans l'armée ; ${c.base >= c.seuil ? "la tienne en a" : "la tienne n'en a que"} ${nombre(c.base)}.</p>`
      : `<p>La recherche coûte ${ouvrieres}${temps} trop peu pour pondre une unité.</p>`;
    if (c.options.length > 1)
      html += `<details class="o_conseilUnites"><summary>Comparer les unités débloquées</summary><div class="o_conseilDefile"><table class="o_conseilTableau"><thead><tr><th>Unité</th><th>Pondues dans le temps</th><th>Gain (${long})</th><th>Recherche comparée</th></tr></thead><tbody>${c.options
        .map((o) => {
          let ecart = c.gainRecherche / o.gain - 1;
          return `<tr${o == c.meilleure ? ` class="o_conseilMeilleure"` : ""}><td>${NOM_UNITE[o.unite]}</td><td>${nombre(o.nombre)}</td><td>+${nombre(o.gain)}</td><td>${ecart >= 0 ? "+" : "−"}${nombre(Math.abs(ecart) * 100)} %</td></tr>`;
        })
        .join("")}</tbody></table></div></details>`;
    let armee = donnees.complete
      ? "armée complète (page Reine : garnison et troupes parties)"
      : "garnison de la page Armée et troupes parties en chasse ou en attaque depuis ce navigateur (celles lancées ailleurs ne sont pas comptées)";
    html += `<p class="o_conseilNote">Gains en ${long} de base, avec le bonus actuel pour les unités pondues, sans XP${stat == "vie" ? " ni bonus de Dôme ou de Loge" : ""}. Repondre les ouvrières coûte aussi ${nombre(ligne.ouvrieres * COUT_UNITE[0])} nourriture ; Laboratoire et Reine travaillent en parallèle. D'après : ${armee}${donnees.vitesse ? "" : " ; vitesse de ponte inconnue (Couveuse, Solarium ou Technique de ponte jamais lus : ouvre les pages Construction et Laboratoire)"}. Méthode d'Optizzz.</p></div>`;
    return html;
  }
}
