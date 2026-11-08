// @ts-check
/*
 * Journal.js
 * Fzzz
 **********************************************************************/

// entrées montrées boîte repliée (« Tout voir » : toutes)
const JOURNAL_APERCU = 3;
// boîte dépliée ou non, d'une page à l'autre
const CLE_JOURNAL_OUVERT = "fzzz_journalOuvert";

/**
 * Boîte « Journal » sous l'encadré « Extension OUAF » : dernières entrées du
 * journal de l'extension (Journal), « Copier » pour transmettre le texte
 * complet quand quelque chose ne marche pas, « Effacer ».
 *
 * @class BoiteJournal
 */
class BoiteJournal {
  constructor() {
    /** @type {any} */
    this._$boite = null;
  }
  /**
   * @method afficher
   * @return {BoiteJournal}
   */
  afficher() {
    let ref = document.getElementById("o_boiteExtension");
    if (!ref || document.getElementById("o_boiteJournal")) return this;
    let $boite = $(`<div id="o_boiteJournal" class="boite_compte_plus">
        <div class="titre_colonne_cliquable"><span class="titre_compte_plus">Journal</span> <span class="o_journalCompte"></span></div>
        <div class="contenu_boite_compte_plus">
          <div class="o_journalBoutons">
            <button type="button" class="o_button o_journalCopier" title="Copie tout le journal (versions, page, étapes et erreurs) pour le coller dans un message">Copier</button>
            <button type="button" class="o_button o_journalVoir"></button>
            <button type="button" class="o_button o_journalEffacer" title="Vide le journal de ce navigateur">Effacer</button>
          </div>
          <p class="o_journalEtat"></p>
          <ul class="o_journalListe"></ul>
        </div></div>`);
    $boite.toggleClass("o_journalOuvert", BoiteJournal.ouvert());
    Dock.suivre(ref, $boite[0], () => ECART_ENCADRES);
    this._$boite = $boite;
    this.remplir();
    // boîte placée par Dock.suivre après coup : hauteur de la liste revue alors
    $(window).on("load resize", () => this.ajusterHauteur());
    [300, 1000, 3000].forEach((ms) => setTimeout(() => this.ajusterHauteur(), ms));
    // entrées notées sur cette page ou dans un autre onglet du jeu
    document.addEventListener("fzzz_journal", () => this.remplir());
    window.addEventListener("storage", (e) => e.key == CLE_JOURNAL && this.remplir());
    $boite.find(".o_journalVoir").on("click", () => {
      let ouvert = !$boite.hasClass("o_journalOuvert");
      $boite.toggleClass("o_journalOuvert", ouvert);
      try {
        localStorage.setItem(CLE_JOURNAL_OUVERT, ouvert ? "1" : "0");
      } catch (e) {}
      this.remplir();
    });
    $boite.find(".o_journalEffacer").on("click", () => {
      Journal.vider();
      this.etat("");
    });
    $boite.find(".o_journalCopier").on("click", () => this.copier());
    return this;
  }
  /**
   * @static
   * @method ouvert
   * @return {Boolean}
   */
  static ouvert() {
    try {
      return localStorage.getItem(CLE_JOURNAL_OUVERT) == "1";
    } catch (e) {
      return false;
    }
  }
  /**
   * Liste et compteur d'erreurs, d'après le journal gardé.
   *
   * @method remplir
   */
  remplir() {
    let $boite = this._$boite,
      ouvert = $boite.hasClass("o_journalOuvert"),
      entrees = Journal.entrees(),
      erreurs = entrees.filter((e) => e.n == "erreur").length,
      aujourdhui = Horloge.serveur().format("DD/MM"),
      heure = (/** @type {Number} */ t) => {
        let m = moment(t);
        return m.format("DD/MM") == aujourdhui ? m.format("HH:mm:ss") : m.format("DD/MM HH:mm");
      };
    $boite
      .find(".o_journalCompte")
      .text(erreurs ? `${erreurs} erreur${erreurs > 1 ? "s" : ""}` : "");
    $boite
      .find(".o_journalVoir")
      .text(ouvert ? "Réduire" : "Tout voir")
      .prop("disabled", entrees.length <= JOURNAL_APERCU && !ouvert);
    let $liste = $boite.find(".o_journalListe").empty();
    if (!entrees.length) $("<li class='o_journalVide'>Rien à signaler.</li>").appendTo($liste);
    (ouvert ? entrees : entrees.slice(0, JOURNAL_APERCU)).forEach((e) => {
      let $li = $("<li></li>")
        .addClass("o_journal_" + e.n)
        .attr("title", e.d || e.m)
        .text(`${heure(e.t)} · ${e.s} : ${e.m}${e.x > 1 ? ` (×${e.x})` : ""}`);
      if (ouvert && e.d) $("<div class='o_journalDetail'></div>").text(e.d).appendTo($li);
      $li.appendTo($liste);
    });
    this.ajusterHauteur();
  }
  /**
   * Liste dépliée : dans une colonne fixe (qu'on ne peut pas faire défiler),
   * elle s'arrête au bas de la fenêtre et défile seule.
   *
   * @method ajusterHauteur
   */
  ajusterHauteur() {
    let $liste = this._$boite.find(".o_journalListe");
    if (!this._$boite.hasClass("o_journalOuvert")) return $liste.css("max-height", "");
    let haut = $liste[0].getBoundingClientRect().top;
    $liste.css(
      "max-height",
      this._$boite.css("position") == "fixed"
        ? Math.max(60, Math.floor(window.innerHeight - haut - 12)) + "px"
        : "45vh",
    );
  }
  /**
   * Copie le texte complet ; sans presse-papiers (page en http, navigateur
   * qui refuse), le texte est montré sélectionné pour une copie à la main.
   *
   * @method copier
   */
  copier() {
    let texte = Journal.texte(),
      manuelle = () => {
        let $zone = this._$boite.find(".o_journalCopie");
        if (!$zone.length)
          $zone = $("<textarea class='o_journalCopie' readonly></textarea>").insertAfter(
            this._$boite.find(".o_journalEtat"),
          );
        $zone.val(texte).trigger("focus").trigger("select");
        this.etat("Texte sélectionné : copie-le (Ctrl+C, ou appui long puis « Copier »).");
      };
    if (!navigator.clipboard || !navigator.clipboard.writeText) return manuelle();
    navigator.clipboard
      .writeText(texte)
      .then(() => this.etat("Journal copié : colle-le dans ton message."), manuelle);
  }
  /**
   * @method etat
   * @param {String} texte
   */
  etat(texte) {
    this._$boite.find(".o_journalEtat").text(texte);
  }
}
