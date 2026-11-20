// @ts-check
/*
 * EnvoiJournal.js
 * Fzzz
 **********************************************************************/

// état de l'envoi dans ce navigateur : le journal aussi y est gardé, pour tous ses pseudos
const CLE_ENVOI_JOURNAL = "fzzz_envoiJournal";
// "0" quand le joueur a décoché la case (Préférences → Partage de données)
const CLE_PARTAGE_JOURNAL = "fzzz_partage_journal";
const JOURNAL_ENVOI = "Envoi du journal";
const SCRIPT_SANS_JOURNAL =
  "le script du Google Sheet des stats membres n'est pas à jour (nouvelle version à déployer)";

/**
 * Envoi du journal de débug à l'onglet « Journal » du Google Sheet des stats
 * membres (demande du mainteneur, 20/11/2026) : une fois par jour du serveur au
 * plus, à une page ouverte, et seulement quand une erreur a été notée depuis le
 * dernier envoi ; alors toutes les notes depuis cet envoi, pour le contexte.
 * Aucune requête au jeu : seulement celle du script du fichier.
 *
 * @class EnvoiJournal
 */
class EnvoiJournal {
  /**
   * @static
   * @method coche
   * @return {Boolean} case « Envoyer mon journal de débug » cochée (par défaut)
   */
  static coche() {
    try {
      return localStorage.getItem(CLE_PARTAGE_JOURNAL) != "0";
    } catch (e) {
      return true;
    }
  }
  /**
   * @static
   * @method choisir
   * @param {Boolean} coche
   */
  static choisir(coche) {
    try {
      localStorage.setItem(CLE_PARTAGE_JOURNAL, coche ? "1" : "0");
    } catch (e) {}
  }
  /**
   * @static
   * @method etat
   * @return {any} {jour, fait, essais, essai, raison, envoye (instant de la dernière note envoyée)}
   */
  static etat() {
    try {
      let e = JSON.parse(localStorage.getItem(CLE_ENVOI_JOURNAL) || "{}");
      return e && typeof e == "object" ? e : {};
    } catch (e) {
      return {};
    }
  }
  /**
   * @private
   * @static
   * @param {any} etat
   */
  static _garder(etat) {
    try {
      localStorage.setItem(CLE_ENVOI_JOURNAL, JSON.stringify(etat));
    } catch (e) {}
  }
  /**
   * Notes du journal plus récentes que `depuis`, de la plus ancienne à la plus récente.
   *
   * @static
   * @method notes
   * @param {Number} depuis instant (horloge du serveur)
   * @return {Array<any>}
   */
  static notes(depuis) {
    // le journal est rangé de la plus récente à la plus ancienne : retourné, deux
    // notes du même instant gardent leur ordre (tri stable)
    return Journal.entrees()
      .reverse()
      .filter((e) => e && Number(e.t) > depuis)
      .sort((a, b) => a.t - b.t);
  }
  /**
   * À chaque page : envoie le journal s'il est dû (une erreur notée depuis le
   * dernier envoi, pas encore d'envoi aujourd'hui) ; un échec est repris à une
   * page ouverte au moins SUIVI_PAUSE_ESSAIS plus tard, SUIVI_ESSAIS_PAR_JOUR
   * fois par jour au plus, comme le relevé des stats.
   *
   * @static
   * @method lancer
   * @return {Promise<String>} "décoché", "sans alliance", "page", "attente", "rien",
   *   "sans sujet", "envoyé" ou "échec"
   */
  static lancer() {
    if (!EnvoiJournal.coche()) return Promise.resolve("décoché");
    if (!monProfil.pseudo || !Utils.alliance) return Promise.resolve("sans alliance");
    // pages où un envoi minuté à la seconde près ne doit rien attendre
    if (Utils.pageSansAlertePonte(location)) return Promise.resolve("page");
    let jour = SuiviMembres.jour(),
      instant = Horloge.maintenant(),
      etat = EnvoiJournal.etat();
    if (etat.jour != jour) etat = { envoye: etat.envoye, jour, fait: false, essais: 0, essai: 0 };
    if (
      etat.fait ||
      etat.essais >= SUIVI_ESSAIS_PAR_JOUR ||
      instant - (etat.essai || 0) < SUIVI_PAUSE_ESSAIS
    )
      return Promise.resolve("attente");
    let notes = EnvoiJournal.notes(Number(etat.envoye) || 0);
    if (!notes.some((e) => e.n == "erreur")) return Promise.resolve("rien");
    // noté avant la requête : une page quittée en route ne compte pas pour rien
    etat = { ...etat, essais: (etat.essais || 0) + 1, essai: instant, raison: "" };
    EnvoiJournal._garder(etat);
    let fin = (/** @type {String} */ resultat, /** @type {any} */ suite) => {
      EnvoiJournal._garder({ ...etat, ...suite });
      return resultat;
    };
    return SuiviMembres.adresse()
      .then(({ url, manque }) => {
        if (manque == "adresse") throw new Error(SuiviMembres.sansAdresse(manque));
        if (!url) {
          Journal.info(
            JOURNAL_ENVOI,
            `journal non envoyé aujourd'hui : ${SuiviMembres.sansAdresse(manque)}`,
          );
          return fin("sans sujet", { fait: true, raison: "sans sujet" });
        }
        return EnvoiJournal.envoyer(url, notes).then(() => {
          Journal.info(
            JOURNAL_ENVOI,
            `journal envoyé au Google Sheet des stats membres : ${notes.length} note(s)`,
          );
          return fin("envoyé", { fait: true, envoye: notes[notes.length - 1].t });
        });
      })
      .catch((e) => {
        let raison = String((e && e.message) || "forum illisible");
        // script d'avant la requête « journal » : il ne connaît que les relevés
        if (/requête invalide/.test(raison)) {
          raison = SCRIPT_SANS_JOURNAL;
          Journal.info(JOURNAL_ENVOI, `journal non envoyé : ${raison}`);
        }
        return fin("échec", { raison });
      });
  }
  /**
   * @static
   * @method envoyer
   * @param {String} url adresse du script du fichier
   * @param {Array<any>} notes entrées du journal
   * @return {Promise<any>} réponse du script
   */
  static envoyer(url, notes) {
    return ExportRapports.requete(url, "POST", {
      journal: {
        joueur: monProfil.pseudo,
        serveur: location.hostname,
        appareil: Journal.appareil(),
        version: VERSION,
        notes: notes.map((e) => ({
          t: e.t,
          niveau: e.n,
          source: e.s || "",
          message: Journal.masquer(e.m || ""),
          detail: Journal.masquer(e.d || ""),
          page: e.p || "",
          version: e.v || "",
          x: e.x || 1,
        })),
      },
    }).then((r) => {
      if (!r.ok) throw new Error("réponse inattendue du script");
      return r;
    });
  }
}
