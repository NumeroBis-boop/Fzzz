/*
 * Messagerie.js
 * Hraesvelg
 **********************************************************************/

/**
 * Classe de fonction pour la page /messagerie.php.
 *
 * @class PageMessagerie
 * @constructor
 */
class PageMessagerie {
  constructor() {
    /**
     * Liste des messages analysés.
     */
    this._messagesOuvert = {};
  }
  /**
   *
   */
  executer() {
    // ajout des boutons pour les nouveaux messages
    if (!Utils.comptePlus) this.plus(0);
    this.couleurMessage();
    // Fzzz : couleurs des convois et conversations, bouton de copie, rangement
    MessagerieFzzz.boutonsPartage();
    MessagerieFzzz.decorer();
    MessagerieFzzz.observer(this);
    MessagerieFzzz.ranger();
    // Fzzz : l'analyse des rapports ouverts passe par MessagerieFzzz.observer
    // (boutons « Analyser »). L'ancien analyseMessage(), fondé sur l'événement
    // DOMNodeInserted retiré de Chrome, a été supprimé.
    return this;
  }
  /**
   *
   */
  plus(id) {
    let champsReponse = id != 0 ? "champ_reponse_" + id : "message_envoi";
    $("#smileySuivant" + id).after(` <span style='cursor:pointer;position:relative;top:3px;'>
            <span style="position:relative;top:-4px"><input id="o_colorMess${champsReponse}" type="color" name="couleur" value="${monProfil.parametre["couleurMessagerie"].valeur}"/></span>
            <img onclick='miseEnForme("${champsReponse}","gras");' title='Gras' src='images/BBCode/bold.png'>
            <img onclick='miseEnForme("${champsReponse}","italic");' title='Italique' src='images/BBCode/italic.png'>
            <img onclick='miseEnForme("${champsReponse}","souligne");' title='Souligné' src='images/BBCode/underline.png'>
            <img onclick='miseEnForme("${champsReponse}","img");' title='Image' src='images/BBCode/picture.png'>
            <img onclick='miseEnForme("${champsReponse}","url");' title='Lien' src='images/BBCode/link.png'>
            <img onclick='miseEnForme("${champsReponse}","player");' title='Pseudo' src='images/BBCode/membre.gif' height='15'>
            <img onclick='miseEnForme("${champsReponse}","ally");' title='Alliance' src='images/BBCode/groupe.gif' height='15'>
            </span>`);
    // event sur le changement de couleur
    $("#o_colorMess" + champsReponse).change((e) => {
      let color = e.currentTarget.value;
      $(this).val(color.substring(1));
      monProfil.parametre["couleurMessagerie"].valeur = color;
      monProfil.parametre["couleurMessagerie"].sauvegarde();
    });
    $(`#${id != 0 ? "repondre_tous_" + id : "bt_envoi_message"}`).click((e) => {
      let color = $("#o_colorMess" + champsReponse).val(),
        idChamps = `#${id != 0 ? "champ_reponse_" + id : "message_envoi"}`;
      if (color != "#000000")
        $(idChamps).val("[color=" + color + "]" + $(idChamps).val() + "[/color]");
    });
    // Ajoute des emoticones
    $("#listeSmiley2" + id).html(LISTESMILEY1.replace(/message/g, champsReponse));
    $("#listeSmiley3" + id).html(LISTESMILEY2.replace(/message/g, champsReponse));
    $("#listeSmiley4" + id).html(LISTESMILEY3.replace(/message/g, champsReponse));
    $("#listeSmiley5" + id).html(LISTESMILEY4.replace(/message/g, champsReponse));
    $("#listeSmiley6" + id).html(LISTESMILEY5.replace(/message/g, champsReponse));
    $("#listeSmiley7" + id).html(LISTESMILEY6.replace(/message/g, champsReponse));
    // event pour selectionner les listes de smiley
    if (id != 0) {
      if ($("#tousLesSmiley" + id).find("div:visible").length)
        $("#smileySuivant" + id + ", #smileyPrecedent" + id).toggle();
      $("#smileySuivant" + id)
        .prev()
        .click((e) => {
          $("#smileySuivant" + id + ", #smileyPrecedent" + id).toggle();
        });
    }
    // event pour selectionner la liste precedante
    $("#smileyPrecedent" + id)
      .html(`<img title='Précédent' class='cursor' src='images/bouton/fleche-champs-gauche.gif'/>`)
      .removeAttr("onclick")
      .click((e) => {
        let div = $("#tousLesSmiley" + id + " div:visible");
        div.hide();
        div.prev().length ? div.prev().show() : $("#tousLesSmiley" + id + " div:last").show();
      });
    // event pour selectionner la liste suivante
    $("#smileySuivant" + id)
      .html(`<img title='Suivant' class='cursor' src='images/bouton/fleche-champs-droite.gif'/>`)
      .removeAttr("onclick")
      .click((e) => {
        let div = $("#tousLesSmiley" + id + " div:visible");
        div.hide();
        div.next().length ? div.next().show() : $("#tousLesSmiley" + id + " div:first").show();
      });
    return this;
  }
  /**
   * Ajout d'un code couleur sur les messages par defaut
   */
  couleurMessage() {
    $("tr[id^='conversation_']").each((i, elt) => {
      let titre = $(elt).find("td:eq(3) .intitule_message").text();
      if (
        titre.includes("Colonie perdue") ||
        titre.includes("conquis par") ||
        titre.includes("Vol par") ||
        titre.includes("Invasion") ||
        titre.includes("Attaque échouée contre") ||
        titre.includes("Rebellion échouée")
      )
        $(elt).find("td:eq(3)").children().addClass("red");
      if (
        titre.includes("Colonie conquise") ||
        titre.includes("Butin chez") ||
        titre.includes("Attaque réussie contre") ||
        titre.includes("Rebellion réussie")
      )
        $(elt).find("td:eq(3)").children().addClass("green");
    });
    return this;
  }
}
