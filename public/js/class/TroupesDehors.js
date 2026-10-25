/*
 * TroupesDehors.js
 **********************************************************************/

/**
 * Registre des troupes parties en chasse ou en attaque, pour compter toute
 * l'armée du joueur alors qu'Armee.php ne montre que la garnison.
 *
 * Hors Compte+, aucune page ne donne la composition des troupes parties : on
 * la mémorise donc à l'envoi. Les attaques arrivent déjà liées à leur id par
 * AttaqueLancee ; les chasses sont mémorisées sans id puis liées, comme les
 * attaques, aux ids les plus élevés que liste Ressources.php. Une chasse ou
 * une attaque lancée hors de ce navigateur n'est pas comptée.
 *
 * Pour ne jamais compter de troupes fantômes, seules comptent les entrées
 * liées à une ligne que le jeu affiche encore : une entrée disparaît à
 * l'heure de retour (arrivée de l'attaque, les survivantes sont alors de
 * nouveau en garnison ; fin de la chasse), dès que sa ligne n'est plus dans
 * la liste du jeu (annulation), et un envoi jamais retrouvé dans la liste
 * (refusé par le serveur) est abandonné à la synchronisation suivante.
 *
 * Entrée : {type: "chasse"|"attaque", id, unite (ordre d'Armee.unite), lancee, retour}
 *
 * @class TroupesDehors
 */
const CLE_TROUPES_DEHORS = "outiiil_troupesDehors";
// délai (s) laissé à une chasse envoyée pour apparaître dans la liste du jeu
// (requête de la liste partie avant la fin de l'envoi)
const DELAI_LIAISON_CHASSE = 5;
// au-delà (s), un envoi jamais synchronisé est oublié
const DUREE_VIE_ENVOI = 3600;

class TroupesDehors {
  /**
   * Charge le registre en purgeant les troupes déjà rentrées.
   */
  static charger() {
    let liste;
    try {
      liste = JSON.parse(localStorage.getItem(CLE_TROUPES_DEHORS)) || [];
    } catch (e) {
      liste = [];
    }
    return liste.filter((t) =>
      t.id ? t.retour > Date.now() : Date.now() - t.lancee < DUREE_VIE_ENVOI * 1000,
    );
  }
  /**
   *
   */
  static sauvegarder(liste) {
    localStorage.setItem(CLE_TROUPES_DEHORS, JSON.stringify(liste));
  }
  /**
   * Ajoute (ou met à jour) une attaque déjà liée à son id.
   *
   * @param {Integer} id id d'attaque du jeu
   * @param {Array} unite nombre par unité, ordre d'Armee.unite
   * @param {Integer} retour timestamp (ms) de l'arrivée de l'attaque
   */
  static ajouterAttaque(id, unite, retour) {
    let liste = TroupesDehors.charger().filter((t) => !(t.type == "attaque" && t.id == id));
    liste.push({ type: "attaque", id: id, unite: unite, lancee: Date.now(), retour: retour });
    TroupesDehors.sauvegarder(liste);
  }
  /**
   * Retire les attaques que la liste du jeu (complète : Armee.php, page
   * Attaquer) n'affiche plus : arrivées ou annulées.
   *
   * @param {Array} lignes lignes d'AttaqueLancee.extraireLignes
   */
  static synchroniserAttaques(lignes) {
    TroupesDehors.sauvegarder(
      TroupesDehors.charger().filter(
        (t) => t.type != "attaque" || lignes.some((l) => l.id == t.id),
      ),
    );
  }
  /**
   * Mémorise une chasse au moment de l'envoi, liée plus tard par synchroniserChasses.
   *
   * @param {Array} unite nombre par unité, ordre d'Armee.unite
   */
  static enregistrerChasse(unite) {
    if (!unite.some((nb) => nb)) return;
    let liste = TroupesDehors.charger();
    liste.push({ type: "chasse", id: null, unite: unite, lancee: Date.now(), retour: null });
    TroupesDehors.sauvegarder(liste);
  }
  /**
   * Met les chasses en phase avec celles que liste Ressources.php (toutes les
   * chasses en cours) : liaison des envois récents aux ids les plus élevés,
   * purge des chasses finies ou annulées et des envois sans ligne (refusés).
   *
   * @param {jQuery} racine document (ou fragment) de Ressources.php
   */
  static synchroniserChasses(racine = $(document)) {
    let lignes = [];
    racine.find("#boite_tdc span[id^='chasse_']").each((i, elt) => {
      // compte à rebours du jeu : reste(secondes, "chasse_<id>") dans le script voisin
      let secondes = parseInt($(elt).parent().nextAll("script").first().text().split("(")[1]);
      if (!isNaN(secondes))
        lignes.push({
          id: parseInt($(elt).attr("id").split("_")[1]),
          retour: Date.now() + secondes * 1000,
        });
    });
    lignes.sort((a, b) => a.id - b.id);
    let liste = TroupesDehors.charger(),
      chasses = liste.filter((t) => t.type == "chasse"),
      idsLies = chasses.filter((t) => t.id).map((t) => t.id),
      envois = chasses.filter((t) => !t.id).sort((a, b) => a.lancee - b.lancee),
      candidates = lignes.filter((l) => idsLies.indexOf(l.id) == -1),
      nb = Math.min(envois.length, candidates.length);
    envois.slice(-nb).forEach((envoi, i) => {
      let ligne = candidates[candidates.length - nb + i];
      envoi.id = ligne.id;
      envoi.retour = ligne.retour;
    });
    liste = liste.filter((t) =>
      t.type != "chasse"
        ? true
        : t.id
          ? lignes.some((l) => l.id == t.id)
          : Date.now() - t.lancee < DELAI_LIAISON_CHASSE * 1000,
    );
    TroupesDehors.sauvegarder(liste);
    return liste;
  }
  /**
   * Nombre de chaque unité actuellement dehors, ordre d'Armee.unite. Seules
   * les entrées liées à une ligne du jeu comptent.
   *
   * @return {Array}
   */
  static total() {
    return TroupesDehors.charger()
      .filter((t) => t.id)
      .reduce((total, t) => total.map((nb, i) => nb + (t.unite[i] || 0)), new Array(14).fill(0));
  }
}
