// @ts-check
/*
 * ConseilBouclier.js
 * NumeroBis-boop
 **********************************************************************/

// Conseil sous « Bouclier Thoracique » du Laboratoire, méthode d'Optizzz
// (github.com/Achaak/Optizzz, licence MIT, conseil « Armes et Bouclier
// Thoracique ») : une recherche coûte des ouvrières, et les repondre prend un
// temps où la Reine pourrait pondre des unités à la place.
const NOM_BOUCLIER = "Bouclier Thoracique";
// +10 % de la vie de base de l'armée par niveau
const PAS_BOUCLIER = 0.1;
// à 5 % près, le calcul ne départage pas la recherche et la ponte
const ECART_EGAL_BOUCLIER = 0.05;
const CLE_CONSEIL_BOUCLIER_OUVERT = "fzzz_conseilBouclierOuvert";
// en dessous (téléphone), la description du jeu est une colonne trop étroite :
// le bloc passe sur une ligne de toute la largeur, sous celle du Bouclier
const LARGEUR_MIN_CONSEIL = 280;

/**
 * @typedef {{unite: Number, nombre: Number, gain: Number}} OptionPonte
 * @typedef {{secondes: Number, base: Number, gainRecherche: Number, options: Array<OptionPonte>,
 *   meilleure: OptionPonte|null, ecart: Number|null, seuil: Number}} Conseil
 */
class ConseilBouclier {
  /**
   * Niveau suivant de Bouclier Thoracique contre la ponte des unités, pendant
   * le temps de repondre les ouvrières qu'il coûte.
   *
   * @static
   * @method calculer
   * @param {{niveau: Number, ouvrieres: Number, armee: Array<Number>, vitesse: Number, pondables: Array<Number>}} e
   *   niveau : celui d'avant la recherche (bonus des unités pondues) ; armee : nombres dans l'ordre de
   *   NOM_UNITE sans l'ouvrière ; vitesse : facteur des temps de ponte ; pondables : rangs dans NOM_UNITE
   * @return {Conseil}
   */
  static calculer({ niveau, ouvrieres, armee, vitesse, pondables }) {
    let secondes = ouvrieres * TEMPS_UNITE[0] * vitesse,
      base = armee.reduce((s, n, i) => s + (n || 0) * VIE_UNITE[i + 1], 0),
      gainRecherche = base * PAS_BOUCLIER,
      options = pondables
        .filter((u, i, liste) => u > 0 && liste.indexOf(u) == i)
        .map((u) => {
          // un rien de marge : 7 235 s à 14,13 s l'une font 512 unités, pas 511,999…
          let nombre = Math.floor((ouvrieres * TEMPS_UNITE[0]) / TEMPS_UNITE[u] + 1e-9);
          return { unite: u, nombre, gain: nombre * VIE_UNITE[u] * (1 + PAS_BOUCLIER * niveau) };
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
      seuil: meilleure ? meilleure.gain / PAS_BOUCLIER : 0,
    };
  }
  /**
   * @static
   * @method verdict
   * @param {Number|null} ecart
   * @return {"recherche"|"ponte"|"egal"}
   */
  static verdict(ecart) {
    if (ecart === null || ecart > ECART_EGAL_BOUCLIER) return "recherche";
    return ecart < -ECART_EGAL_BOUCLIER ? "ponte" : "egal";
  }
  /**
   * « +116 % de vie », ou « 4,2 × plus de vie » à partir du triple.
   *
   * @static
   * @method plus
   * @param {Number} ratio
   * @return {String}
   */
  static plus(ratio) {
    if (ratio < 3) return `+${numeral(Math.round((ratio - 1) * 100)).format()} % de vie`;
    let fois = ratio < 10 ? Utils.decimal(ratio, 1, true) : numeral(Math.round(ratio)).format();
    return `${fois} × plus de vie`;
  }
  /**
   * @static
   * @method texteVerdict
   * @param {Conseil} c
   * @return {String} la ligne repliée : le meilleur choix, et de combien
   */
  static texteVerdict(c) {
    if (!c.meilleure || c.ecart === null)
      return "Recherche préférable : ce temps ne suffit à pondre aucune unité";
    let v = ConseilBouclier.verdict(c.ecart);
    if (v == "egal") return "Recherche et ponte se valent (à 5 % près)";
    if (v == "recherche")
      return `Recherche préférable · ${ConseilBouclier.plus(1 + c.ecart)} que la ponte`;
    return `Ponte préférable · ${NOM_UNITES[c.meilleure.unite]} : ${ConseilBouclier.plus(1 / (1 + c.ecart))}`;
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
        Utils.uniteLue($(tr).find("h2").first().text(), "Conseil Bouclier"),
      )
      .get()
      .filter((/** @type {Number} */ u) => u > 0);
  }
  /**
   * Niveau dont part le coût affiché : une recherche du Bouclier en cours
   * (« - Bouclier Thoracique 11 terminé dans : ») fait montrer au jeu le coût
   * du niveau d'après. À lire avant que l'extension range ces lignes.
   *
   * @static
   * @method niveauDepart
   * @param {any} $page page Laboratoire
   * @param {Number} affiche niveau de la ligne
   * @return {Number}
   */
  static niveauDepart($page, affiche) {
    let niveaux = $page
      .find("#centre strong")
      .map((/** @type {Number} */ i, /** @type {Element} */ s) => {
        let m = /bouclier thoracique\s+(\d+)\s+(?:termin|se\s+termine)/i.exec(
          Utils.texteUnite($(s).text()),
        );
        return m ? Number(m[1]) : null;
      })
      .get();
    return Math.max(affiche, ...niveaux);
  }
  /**
   * Bloc « Conseil » à la fin de la description de la ligne, replié sur son
   * verdict ; son ouverture est gardée par serveur.
   *
   * @static
   * @method afficher
   * @param {any} $description cellule de description de la ligne
   * @param {{niveau: Number, ouvrieres: Number}} ligne
   * @param {{manque: String}|{armee: Array<Number>, complete: Boolean, vitesse: Number|null, pondables: Array<Number>}} donnees
   * @return {any} le bloc
   */
  static afficher($description, ligne, donnees) {
    let ouvert = false;
    try {
      ouvert = localStorage.getItem(CLE_CONSEIL_BOUCLIER_OUVERT) == "1";
    } catch (e) {}
    $description.find(".o_conseil").remove();
    $description.closest("tr").next(".o_conseilLigne").remove();
    let $bloc = $(`<details class="o_conseil"${ouvert ? " open" : ""}></details>`),
      $resume = $(`<summary><span class="o_conseilTag">Conseil</span></summary>`).appendTo($bloc);
    $bloc.on("toggle", () => {
      try {
        if ($bloc.prop("open")) localStorage.setItem(CLE_CONSEIL_BOUCLIER_OUVERT, "1");
        else localStorage.removeItem(CLE_CONSEIL_BOUCLIER_OUVERT);
      } catch (e) {}
    });
    ConseilBouclier.placer($bloc, $description);
    if ("manque" in donnees) {
      $resume.append($("<span>").text(" " + donnees.manque));
      $bloc.append(
        `<div class="o_conseilCorps"><p class="o_conseilNote">Le conseil compare la recherche à la ponte d'unités pendant le temps de repondre ses ouvrières.</p></div>`,
      );
      return $bloc;
    }
    let c = ConseilBouclier.calculer({
      niveau: ligne.niveau,
      ouvrieres: ligne.ouvrieres,
      armee: donnees.armee,
      vitesse: donnees.vitesse || 1,
      pondables: donnees.pondables,
    });
    $bloc.attr("data-verdict", ConseilBouclier.verdict(c.ecart));
    $resume.append(
      " ",
      $("<strong>").text(ConseilBouclier.texteVerdict(c)),
      ` <span class="o_conseilPlus">Détails</span>`,
    );
    $bloc.append(ConseilBouclier._corps(ligne, c, donnees));
    return $bloc;
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
   * @param {{niveau: Number, ouvrieres: Number}} ligne
   * @param {Conseil} c
   * @param {{armee: Array<Number>, complete: Boolean, vitesse: Number|null, pondables: Array<Number>}} donnees
   * @return {String}
   */
  static _corps(ligne, c, donnees) {
    let nombre = (/** @type {Number} */ n) =>
        numeral(Math.round(n)).format().replace(/ /g, "\u00a0"),
      unites = (/** @type {OptionPonte} */ o) =>
        `${nombre(o.nombre)} ${o.nombre > 1 ? NOM_UNITES[o.unite] : NOM_UNITE[o.unite]}`,
      haut = Math.max(c.gainRecherche, c.meilleure ? c.meilleure.gain : 0, 1),
      barre = (/** @type {String} */ libelle, /** @type {Number} */ valeur, recherche = false) =>
        `<div class="o_conseilBarre${recherche ? " o_conseilRecherche" : ""}"><div class="o_conseilBarreTete"><span>${libelle}</span><span class="o_conseilValeur">+${nombre(valeur)} points de vie</span></div><div class="o_conseilPiste"><span style="width:${(valeur / haut) * 100}%"></span></div></div>`,
      ouvrieres = `${nombre(ligne.ouvrieres)} ouvrière${ligne.ouvrieres > 1 ? "s" : ""}`,
      // sans niveaux de ponte connus, pas de durée : le verdict n'en dépend pas
      temps = donnees.vitesse ? ` : les repondre prend ${ConseilBouclier.duree(c.secondes)},` : ",",
      html = `<div class="o_conseilCorps"><div class="o_conseilBarres">${barre(`Recherche niveau ${ligne.niveau + 1}`, c.gainRecherche, true)}${c.meilleure ? barre(`ou ${unites(c.meilleure)}`, c.meilleure.gain) : ""}</div>`;
    html += c.meilleure
      ? `<p>La recherche coûte ${ouvrieres}${temps} le temps de pondre ${unites(c.meilleure)} à la place.</p>
        <p>La recherche l'emporte dès ${nombre(Math.ceil(c.seuil))} points de vie de base dans l'armée ; ${c.base >= c.seuil ? "la tienne en a" : "la tienne n'en a que"} ${nombre(c.base)}.</p>`
      : `<p>La recherche coûte ${ouvrieres}${temps} trop peu pour pondre une unité.</p>`;
    if (c.options.length > 1)
      html += `<details class="o_conseilUnites"><summary>Comparer les unités débloquées</summary><div class="o_conseilDefile"><table class="o_conseilTableau"><thead><tr><th>Unité</th><th>Pondues dans le temps</th><th>Gain (points de vie)</th><th>Recherche comparée</th></tr></thead><tbody>${c.options
        .map((o) => {
          let ecart = c.gainRecherche / o.gain - 1;
          return `<tr${o == c.meilleure ? ` class="o_conseilMeilleure"` : ""}><td>${NOM_UNITE[o.unite]}</td><td>${nombre(o.nombre)}</td><td>+${nombre(o.gain)}</td><td>${ecart >= 0 ? "+" : "−"}${nombre(Math.abs(ecart) * 100)} %</td></tr>`;
        })
        .join("")}</tbody></table></div></details>`;
    let armee = donnees.complete
      ? "armée complète (page Reine : garnison et troupes parties)"
      : "garnison de la page Armée, troupes en chasse ou en attaque non comptées";
    html += `<p class="o_conseilNote">Gains en points de vie de base, avec le bonus actuel pour les unités pondues, sans XP ni bonus de Dôme ou de Loge. Repondre les ouvrières coûte aussi ${nombre(ligne.ouvrieres * COUT_UNITE[0])} nourriture ; Laboratoire et Reine travaillent en parallèle. D'après : ${armee}${donnees.vitesse ? "" : " ; vitesse de ponte inconnue (Couveuse, Solarium ou Technique de ponte jamais lus : ouvre les pages Construction et Laboratoire)"}. Méthode d'Optizzz.</p></div>`;
    return html;
  }
}
