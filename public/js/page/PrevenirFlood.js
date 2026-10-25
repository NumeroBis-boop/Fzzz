/*
 * PrevenirFlood.js
 * NumeroBis-boop
 **********************************************************************/

// demande en cours : {cible, mode ("formulaire" | "flood"), depuis (ms)}
const CLE_PREVENIR_FLOOD = "fzzz_prevenirFlood";
// brouillon prêt pour la messagerie : {destinataire, objet, message, cree (ms)}
const CLE_BROUILLON_MESSAGE = "fzzz_brouillonMessage";
// au-delà (ms), une demande ou un brouillon oublié est abandonné
const DUREE_VIE_PREVENIR = 15 * 60 * 1000;

/**
 * « Prévenir X du flood » : après le lancement effectif des attaques, ouvre
 * la messagerie sur un nouveau message à la cible, prérempli avec l'arrivée
 * de chaque attaque et le terrain estimé pris. Le message n'est jamais envoyé
 * par l'extension : le joueur le relit et clique lui-même sur Envoyer.
 *
 * Les attaques sont celles capturées par AttaqueLancee (id, arrivée exacte
 * lue dans la liste du jeu, terrain estimé), lancées depuis la demande.
 *
 * @class PrevenirFlood
 */
class PrevenirFlood {
  /**
   * Case à cocher « Prévenir X du flood ».
   *
   * @static
   * @method caseHtml
   */
  static caseHtml(id, pseudo) {
    return `<label class='o_prevenirFlood' for='${id}'><input type='checkbox' id='${id}'/> Prévenir ${pseudo} du flood</label>`;
  }
  /**
   * Durée avec les secondes, toujours affichées : « 8h 05m 03s ».
   *
   * @static
   * @method duree
   */
  static duree(secondes) {
    let s = Math.round(secondes),
      j = Math.floor(s / 86400),
      h = Math.floor((s % 86400) / 3600),
      m = Math.floor((s % 3600) / 60),
      deux = (n) => String(n).padStart(2, "0");
    return `${j ? j + "J " : ""}${h}h ${deux(m)}m ${deux(s % 60)}s`;
  }
  /**
   * @static
   * @method armer
   */
  static armer(cible, mode) {
    sessionStorage.setItem(
      CLE_PREVENIR_FLOOD,
      JSON.stringify({ cible: cible, mode: mode, depuis: moment().valueOf() }),
    );
  }
  /**
   * @static
   * @method demande
   */
  static demande() {
    try {
      let d = JSON.parse(sessionStorage.getItem(CLE_PREVENIR_FLOOD));
      if (d && moment().valueOf() - d.depuis < DUREE_VIE_PREVENIR) return d;
    } catch (e) {}
    sessionStorage.removeItem(CLE_PREVENIR_FLOOD);
    return null;
  }
  /**
   * Prépare le brouillon à partir des attaques confirmées depuis la demande.
   * Ne fait rien sans demande (ou pour un autre mode).
   *
   * @static
   * @method preparer
   * @return {Boolean} true si un brouillon est prêt
   */
  static preparer(mode) {
    let d = PrevenirFlood.demande();
    if (!d || d.mode != mode) return false;
    sessionStorage.removeItem(CLE_PREVENIR_FLOOD);
    let attaques = AttaqueLancee.charger()
      .filter((a) => a.cible == d.cible && a.id && a.arrivee && a.lancee >= d.depuis - 1000)
      .sort((a, b) => a.arrivee - b.arrivee);
    if (!attaques.length) {
      $.toast({
        ...TOAST_WARNING,
        text: `Aucune attaque confirmée sur ${d.cible} : pas de message préparé.`,
      });
      return false;
    }
    sessionStorage.setItem(
      CLE_BROUILLON_MESSAGE,
      JSON.stringify({
        destinataire: d.cible,
        objet: "Flood en approche",
        message: PrevenirFlood.texte(d.cible, attaques),
        cree: moment().valueOf(),
      }),
    );
    return true;
  }
  /**
   * @static
   * @method texte
   */
  static texte(cible, attaques) {
    let lignes = [`Salut ${cible},`, "", "Je te préviens d'un flood :"],
      total = 0,
      estime = true;
    attaques.forEach((a, i) => {
      let arrivee = moment(a.arrivee),
        terrain = /terrain/i.test(a.lieu || ""),
        prise =
          terrain && a.terrainDepart != null && a.terrainCible != null
            ? a.terrainDepart - a.terrainCible
            : null;
      if (terrain && prise == null) estime = false;
      total += prise || 0;
      lignes.push(
        `- Attaque ${i + 1} : arrivée le ${arrivee.format("D MMM à HH[h]mm[m]ss[s]")} (RC à ${Utils.minuteRC(arrivee).format("HH[h]mm")})` +
          (terrain
            ? `, environ ${prise != null ? numeral(prise).format() : "?"} cm² de terrain de chasse`
            : `, sur ${(a.lieu || "?").toLowerCase()}`),
      );
    });
    let premiere = attaques.find((a) => a.terrainDepart != null),
      derniere = attaques.filter((a) => a.terrainCible != null).pop();
    lignes.push("");
    if (total)
      lignes.push(
        `Total estimé : ${numeral(total).format()} cm²` +
          (premiere && derniere
            ? ` (ton terrain : ${numeral(premiere.terrainDepart).format()} → ${numeral(derniere.terrainCible).format()} cm²).`
            : "."),
        `Estimation faite à partir de ton terrain au lancement${estime ? "" : " (incomplète)"} : la quantité réelle peut varier.`,
        "",
      );
    lignes.push(monProfil.pseudo);
    return lignes.join("\n");
  }
  /**
   * Ouvre la messagerie sur le brouillon prêt, s'il y en a un.
   *
   * @static
   * @method ouvrir
   * @return {Boolean} true si la page change
   */
  static ouvrir() {
    let b = PrevenirFlood.brouillon();
    if (!b) return false;
    location = "/messagerie.php?defaut=Ecrire&destinataire=" + encodeURIComponent(b.destinataire);
    return true;
  }
  /**
   * @static
   * @method brouillon
   */
  static brouillon() {
    try {
      let b = JSON.parse(sessionStorage.getItem(CLE_BROUILLON_MESSAGE));
      if (b && moment().valueOf() - b.cree < DUREE_VIE_PREVENIR) return b;
    } catch (e) {}
    sessionStorage.removeItem(CLE_BROUILLON_MESSAGE);
    return null;
  }
  /**
   * Messagerie : remplit l'objet et le message du nouveau message si le
   * brouillon vise le destinataire de l'URL. Le jeu initialise le formulaire
   * au chargement ; on repasse un peu plus tard si un champ a été vidé.
   *
   * @static
   * @method remplir
   */
  static remplir() {
    let b = PrevenirFlood.brouillon(),
      params = new URLSearchParams(location.search);
    if (!b || params.get("defaut") != "Ecrire" || params.get("destinataire") != b.destinataire)
      return;
    sessionStorage.removeItem(CLE_BROUILLON_MESSAGE);
    // panneau « Nouveau » du jeu replié : on le déplie (affichage seulement)
    if (!$("#contenu_ecrire_nouveau_message").is(":visible"))
      $("#ecrire_nouveau_message").trigger("click");
    if (!$("#contenu_ecrire_nouveau_message").is(":visible"))
      $("#contenu_ecrire_nouveau_message").show();
    let ecrire = () => {
      if (!$("#objet").val()) $("#objet").val(b.objet);
      if (!$("#message_envoi").val()) $("#message_envoi").val(b.message);
    };
    ecrire();
    setTimeout(ecrire, 300);
    $.toast({
      ...TOAST_INFO,
      text: `Message pour ${b.destinataire} prérempli : relis-le puis clique sur Envoyer.`,
    });
  }
}
