/*
 * Profil.js
 * Hraesvelg
 **********************************************************************/

/**
 * Classe de fonction pour la page /Membre.php?Pseudo=?.
 *
 * @class PageProfil
 * @constructor
 */
class PageProfil {
  /**
   *
   */
  constructor(boiteRadar) {
    /**
     * Creation du modele profil
     */
    this._profil = null;
    /**
     * Acces à la boite radar
     */
    this._boiteRadar = boiteRadar;
  }
  /**
   *
   */
  executer() {
    // Sélecteur scopé `center > h2` : la toast "Toolzzz mis à jour" utilise
    // aussi un <h2> (cf. jquery-toast `.jq-toast-heading`) qu'un `$("h2")` global
    // concaténerait avec le pseudo de la page et corromprait la clé de
    // surveillance dans `_joueurs`.
    this._profil = new Joueur({ pseudo: $("center > h2").text() });
    let coordonnees = Utils.coordonnees($(".boite_membre"));
    this._profil.x = coordonnees.x;
    this._profil.y = coordonnees.y;
    this._profil.mv = $(".boite_membre table:eq(0) tr:eq(0) td:eq(0)")
      .text()
      .includes("Joueur en vacances");
    this._profil.id = $("a[href^='commerce.php?ID=']").attr("href").match(/\d+/g)[0];
    this._profil.terrain = numeral($(".tableau_score tr:eq(1) td:eq(1)").text()).value();
    // si on consulte un profil différent du sien
    if (!this._profil.estJoueurCourant()) {
      // si on a pas de compte+ on affiche le temps de trajet
      !Utils.comptePlus && this.plus();
      // Affichage du retour dynamique
      $(".boite_membre:first div:first table").append(
        `<tr><td class='right'>Retour le :</td><td id='o_tempsRetour'>${Horloge.clic().add(monProfil.getTempsParcours2(this._profil), "s").format("D MMM à HH[h]mm[m]ss[s]")}</td></tr><tr><td class='right'>Rapport :</td><td id='o_tempsRetourRapport'>${Utils.roundMinute(monProfil.getTempsParcours2(this._profil), Horloge.clic()).format("D MMM à HH[h]mm")}</td></tr>`,
      );
      Utils.incrementTime(
        monProfil.getTempsParcours2(this._profil),
        "o_tempsRetour",
        "o_tempsRetourRapport",
      );
    }

    // Ajout de l'option pour ajouter au radar + un lien vers AntLeaks (s4 seulement)
    // (https://antleaks.guics.st) avec le pseudo dans le chemin — outil community
    // pour consulter l'historique public d'un joueur Fourmizzz.
    let antleaksUrl = `https://antleaks.guics.st/player/${encodeURIComponent(this._profil.pseudo)}`;
    $(".boite_membre:eq(1) table tr td:eq(0)").append(
      `${Utils.comptePlus ? "<br/>" : ""}- <span id='o_surveiller' class='cursor gras'>${this._boiteRadar.joueurs.hasOwnProperty(this._profil.pseudo) ? "Supprimer la surveillance" : "Surveiller ce joueur"}</span>${Utils.antleaksDisponible ? `<br/>- <a class='gras' href='${antleaksUrl}' target='_blank' rel='noopener'>Voir sur AntLeaks</a>` : ""}`,
    );

    $("#o_surveiller").click((e) => {
      if (!this._boiteRadar.joueurs.hasOwnProperty(this._profil.pseudo)) {
        $(e.currentTarget).text("Supprimer la surveillance");
        this._boiteRadar.ajouteJoueur(this._profil);
      } else {
        $(e.currentTarget).text("Surveiller ce joueur");
        this._boiteRadar.supprimeJoueur(this._profil);
      }
      this._boiteRadar.sauvegarder().actualiser();
    });
    return this;
  }
  /**
   *
   */
  plus() {
    // Affichage du temps de trajet
    $(".boite_membre:first div:first table").append(
      `<tr><td style='text-align:right'>Temps de trajet :</td><td>${Utils.intToTime(monProfil.getTempsParcours2(this._profil))}</td></tr>`,
    );
    return this;
  }
}
