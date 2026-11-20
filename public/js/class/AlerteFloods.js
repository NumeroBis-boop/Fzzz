// @ts-check
/*
 * AlerteFloods.js
 * Page Ressources : les floods partagés sur le joueur qui arrivent bientôt,
 * à droite des boutons d'envoi du lanceur de chasses (demande du mainteneur,
 * 20/11/2026). Sans flood dans le délai choisi, la page ne change pas.
 **********************************************************************/

// texte (« dans 23 min ») refait chaque minute, sans lecture
const MS_ALERTE_FLOODS = 60000;
let minuterieAlerteFloods = 0;

/**
 * @class AlerteFloods
 */
class AlerteFloods {
  /**
   * Délai choisi dans Préférences → Ressources, en heures.
   *
   * @static
   * @method heures
   * @return {Number}
   */
  static heures() {
    let p = monProfil.parametre && monProfil.parametre["alerteFloods"],
      rang = p ? Number(p.valeur) : ALERTE_FLOODS_DEFAUT;
    return ALERTE_FLOODS_HEURES[rang] ?? ALERTE_FLOODS_HEURES[ALERTE_FLOODS_DEFAUT];
  }
  /**
   * Floods partagés sur moi, rejoués avec les partages du forum comme sur la
   * page d'un membre : la prise et la portée à l'impact suivent les chasses et
   * les floods de chacun. Mes chasses sont celles de la page (elle fait foi),
   * mes floods ceux que j'ai partagés (la page Ressources ne liste pas mes
   * attaques).
   *
   * @static
   * @method lire
   * @param {Array} chasses PageRessource.lireChasses de la page
   * @return {Promise<Array>} événements de PartageChasses.simuler sur moi
   */
  static lire(chasses) {
    let moi = monProfil.pseudo,
      m = String(moi || "").toLowerCase(),
      minute = (/** @type {any} */ instant) => instant.format("YYYY-MM-DD HH:mm");
    if (!moi) return Promise.resolve([]);
    return PartageChasses.enFile(() => PartageChasses.charger([moi], true))
      .then((/** @type {any} */ d) => {
        let mesChasses = PageRessource.aPartager(PageRessource.grouperChasses(chasses)).map(
          (/** @type {any} */ g) => ({ date: minute(g.impact), terrain: g.terrain }),
        );
        return PartageChasses.completer(
          { chasses: { ...d.chasses, [m]: mesChasses }, floods: d.floods },
          [moi],
        );
      })
      .then(({ d, tdc }) =>
        PartageChasses.simuler(
          d,
          PartageChasses.tdcConnus(tdc, { [moi]: Utils.terrain }),
        ).evenements.filter(
          (/** @type {any} */ e) => e.type == "flood" && String(e.cible).toLowerCase() == m,
        ),
      );
  }
  /**
   * Floods qui arrivent d'ici `heures` : leur minute de RC est après la
   * minute en cours (un flood de la minute en cours est déjà arrivé) et au
   * plus celle d'une arrivée dans `heures`.
   *
   * @static
   * @method prochains
   * @param {Array} floods voir lire
   * @param {any} maintenant moment, heure du serveur
   * @param {Number} heures
   * @return {Array}
   */
  static prochains(floods, maintenant, heures) {
    let debut = maintenant.format("YYYY-MM-DD HH:mm"),
      fin = Utils.minuteRC(moment(maintenant).add(heures * 60, "minutes")).format(
        "YYYY-MM-DD HH:mm",
      );
    return floods.filter((e) => e.date > debut && e.date <= fin);
  }
  /**
   * « 30 min », « 1 h », « 1 h 05 » : temps jusqu'à la minute du RC.
   *
   * @static
   * @method dans
   * @param {Number} ms
   * @return {String}
   */
  static dans(ms) {
    let minutes = Math.max(1, Math.round(ms / 60000)),
      h = Math.floor(minutes / 60),
      reste = minutes % 60;
    return h ? `${h} h${reste ? " " + String(reste).padStart(2, "0") : ""}` : `${minutes} min`;
  }
  /**
   * Contenu de l'alerte ; vide sans flood dans le délai.
   *
   * @static
   * @method html
   * @param {Array} floods voir lire
   * @param {any} maintenant moment, heure du serveur
   * @param {Number} heures
   * @return {String}
   */
  static html(floods, maintenant, heures) {
    let liste = AlerteFloods.prochains(floods, maintenant, heures);
    if (!liste.length) return "";
    let delai = heures < 1 ? `${heures * 60} min` : `${numeral(heures).format()} h`,
      titre =
        liste.length == 1
          ? `⚠️ 1 flood arrive sur toi d'ici <span>${delai}</span>`
          : `⚠️ ${liste.length} floods arrivent sur toi d'ici <span>${delai}</span>`,
      lignes = liste.map((e) => {
        let impact = moment(e.date, "YYYY-MM-DD HH:mm");
        return `<div class='o_alerteFloodsLigne'><a href='Membre.php?Pseudo=${encodeURIComponent(e.lanceur)}'>${Utils.echapper(e.lanceur)}</a> à ${impact.format("HH[h]mm")} (dans ${AlerteFloods.dans(impact.valueOf() - maintenant.valueOf())}) : ${PartageChasses.libellePrise({ delta: -e.prise, statut: e.statut, lieu: e.lieu || null })}</div>`;
      });
    return `<div class='o_alerteFloodsTitre'>${titre}</div>${lignes.join("")}`;
  }
  /**
   * Lit les floods sur moi et place l'alerte à droite des boutons « Envoyer »
   * du lanceur de la page, déjà affiché ; refaite chaque minute sans lecture.
   * Forum illisible : rien (la page reste celle d'aujourd'hui), noté au journal.
   *
   * @static
   * @method installer
   * @return {Promise<void>}
   */
  static installer() {
    if (!monProfil.pseudo || !Utils.alliance) return Promise.resolve();
    let heures = AlerteFloods.heures();
    return AlerteFloods.lire(PageRessource.lireChasses($(document))).then(
      (floods) => {
        let maj = () => {
          let html = AlerteFloods.html(floods, Horloge.serveur(), heures),
            $alerte = $("#o_alerteFloods");
          if (!$alerte.length) {
            if (!html) return;
            let $pile = $("#o_chasseEnvoyer").closest(".o_pile");
            if (!$pile.length) return;
            $pile
              .removeClass("o_marginT15")
              .wrap("<div class='o_chasseActions'><div class='o_chasseActionsGrille'></div></div>")
              .after(
                "<div id='o_alerteFloods' class='o_alerteFloods' role='status' title='Floods partagés dans le forum de l&#39;alliance : une attaque ennemie n&#39;y figure pas. Heure du rapport, à la minute ; prise estimée à l&#39;impact.'></div>",
              );
            $alerte = $("#o_alerteFloods");
          }
          $alerte.html(html).prop("hidden", !html);
        };
        maj();
        clearInterval(minuterieAlerteFloods);
        minuterieAlerteFloods = Number(setInterval(maj, MS_ALERTE_FLOODS));
      },
      // niveau « alerte », pas « erreur » : une alliance sans les sujets partagés
      // n'enverrait pas son journal chaque jour pour autant (EnvoiJournal)
      (/** @type {any} */ e) =>
        Journal.noter(
          "alerte",
          "Alerte des floods",
          "floods partagés sur moi illisibles : pas d'alerte",
          String((e && e.message) || e),
        ),
    );
  }
}
