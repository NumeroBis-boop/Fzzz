// @ts-check
/*
 * ExportJoueurs.js
 * Export public des joueurs du serveur (API du jeu, voir developer.php).
 **********************************************************************/

/**
 * Le jeu publie chaque heure la liste de tous les joueurs (pseudo, id,
 * coordonnées, TdC, alliance) : une requête au lieu d'une page de profil par
 * joueur. C'est la collecte automatique prévue par le jeu. Le TdC y date de
 * l'export : le TdC en direct reste celui des pages du jeu.
 */
class ExportJoueurs {
  /**
   * Joueurs du dernier export, indexés par pseudo.
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
      .then((joueurs) => ExportJoueurs.indexer(joueurs));
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
}
