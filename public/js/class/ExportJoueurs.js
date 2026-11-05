// @ts-check
/*
 * ExportJoueurs.js
 * Export public des joueurs du serveur (API du jeu, voir developer.php).
 **********************************************************************/

/** Le jeu refait l'export chaque heure : une base plus récente est à jour. */
const DUREE_BASE_JOUEURS = 3600000;

/**
 * Le jeu publie chaque heure la liste de tous les joueurs (pseudo, id,
 * coordonnées, TdC, alliance) : une requête au lieu d'une page de profil par
 * joueur. C'est la collecte automatique prévue par le jeu. Le TdC y date de
 * l'export : le TdC en direct reste celui des pages du jeu.
 */
class ExportJoueurs {
  static get cle() {
    return "fzzz_joueurs_" + Utils.serveur;
  }
  /**
   * Joueurs du dernier export, indexés par pseudo. Renouvelle aussi la base
   * gardée dans le navigateur (voir base).
   *
   * @static
   * @method lire
   * @return {Promise<Map<string, {id: number, pseudo: string, x: number, y: number, terrain: number, alliance: string|null}>>}
   */
  static lire() {
    let racine = location.origin + "/api/exports/";
    return Promise.resolve($.ajax({ url: racine, dataType: "json" }))
      .then((versions) => {
        let derniere = versions && versions.players && versions.players[0];
        if (!derniere) throw new Error("export des joueurs absent");
        return $.ajax({
          url: `${racine}players/?version=${encodeURIComponent(derniere)}`,
          dataType: "json",
        });
      })
      .then((joueurs) => {
        let index = ExportJoueurs.indexer(joueurs);
        // réponse vide ou illisible : la base gardée n'est pas écrasée
        if (!index.size) throw new Error("export des joueurs vide");
        ExportJoueurs.garder(index);
        return index;
      });
  }
  /**
   * @static
   * @method indexer
   * @param {Array<Object>} joueurs réponse de /api/exports/players/
   * @return {Map<string, {id: number, pseudo: string, x: number, y: number, terrain: number, alliance: string|null}>}
   */
  static indexer(joueurs) {
    let index = new Map();
    if (!Array.isArray(joueurs)) return index;
    joueurs.forEach((j) => {
      if (j && typeof j.pseudo == "string" && Number.isInteger(j.x) && Number.isInteger(j.y))
        index.set(j.pseudo, {
          id: j.id,
          pseudo: j.pseudo,
          x: j.x,
          y: j.y,
          terrain: j.field || 0,
          alliance: j.alliance ?? null,
        });
    });
    return index;
  }
  /**
   * {pseudo: [x, y, terrain]} : ~50 000 caractères pour les 2 000 joueurs du s5.
   *
   * @static
   * @method compacter
   * @param {Map<string, {x: number, y: number, terrain: number}>} index
   * @return {Object<string, Array<number>>}
   */
  static compacter(index) {
    /** @type {Object<string, Array<number>>} */
    let joueurs = {};
    index.forEach((j, pseudo) => (joueurs[pseudo] = [j.x, j.y, j.terrain]));
    return joueurs;
  }
  /**
   * @static
   * @method garder
   * @param {Map<string, {x: number, y: number, terrain: number}>} index
   */
  static garder(index) {
    try {
      localStorage.setItem(
        ExportJoueurs.cle,
        JSON.stringify({ t: Date.now(), joueurs: ExportJoueurs.compacter(index) }),
      );
    } catch (e) {
      /* stockage plein : la base ne sert qu'au calcul en cours */
    }
  }
  /**
   * Coordonnées et TdC de tous les joueurs, gardés dans le navigateur : l'export
   * n'est relu que si la base a plus d'une heure. Si l'export ne répond pas, la
   * base plus ancienne sert encore (les coordonnées ne changent pas).
   *
   * @static
   * @method base
   * @return {Promise<Object<string, Array<number>>>} {pseudo: [x, y, terrain]}
   */
  static base() {
    let gardee = Utils.lireStockage(ExportJoueurs.cle);
    if (gardee.joueurs && Date.now() - gardee.t < DUREE_BASE_JOUEURS)
      return Promise.resolve(gardee.joueurs);
    return ExportJoueurs.lire()
      .then((index) => ExportJoueurs.compacter(index))
      .catch((e) => {
        if (gardee.joueurs) return gardee.joueurs;
        throw e;
      });
  }
  /**
   * Remplit x, y et terrain des joueurs avec la base. Un joueur absent (inscrit
   * depuis l'export, export indisponible) est lu sur sa page.
   *
   * @static
   * @method completer
   * @param {Array<Joueur>} joueurs
   * @return {Promise<Array<Joueur>>} les joueurs qui n'existent pas
   */
  static completer(joueurs) {
    return ExportJoueurs.base()
      .catch(() => ({}))
      .then((base) => {
        let minuscules = null;
        return Promise.all(
          joueurs.map((j) => {
            let e = base[j.pseudo];
            if (!e) {
              // pseudo saisi sans les majuscules
              minuscules =
                minuscules || new Map(Object.keys(base).map((p) => [p.toLowerCase(), p]));
              let p = minuscules.get(String(j.pseudo).toLowerCase());
              e = p && base[p];
            }
            if (e) {
              [j.x, j.y, j.terrain] = e;
              return null;
            }
            return Promise.resolve(j.getProfil()).then(
              (html) => (j.chargerProfil(html) ? null : j),
              () => j,
            );
          }),
        );
      })
      .then((r) => r.filter(Boolean));
  }
}
