/*
 * Horloge.js
 * Fzzz
 **********************************************************************/

/**
 * Horloge à la seconde, sur l'heure du PC, affichée au-dessus de l'encart
 * « S5 Pseudo » (#boiteInfo). Purement locale : aucune requête vers le jeu.
 *
 * @class Horloge
 */
class Horloge {
  /**
   * Place l'horloge et lance sa mise à jour, calée sur le changement de seconde.
   *
   * @static
   * @method afficher
   */
  static afficher() {
    let $boite = $("#boiteInfo");
    if (!$boite.length || $("#o_horloge").length) return;
    // Ancrée à l'encart : elle suit sa position, qu'il défile avec la page ou non.
    if ($boite.css("position") == "static") $boite.css("position", "relative");
    $boite.css("overflow", "visible");
    let $horloge = $(
      `<div id='o_horloge' title="Heure de ton ordinateur, à la seconde"></div>`,
    ).prependTo($boite);
    let tic = () => {
      let maintenant = moment();
      $horloge.text(maintenant.format("HH:mm:ss"));
      // prochain tic juste après le changement de seconde, pour ne pas dériver
      setTimeout(tic, 1000 - maintenant.milliseconds() + 5);
    };
    tic();
  }
}
