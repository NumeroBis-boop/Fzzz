/*
 * Parametre.js
 * Hraesvelg
 **********************************************************************/

/**
 * Classe permettant la gestion de parametre
 *
 * @class Page
 */
class Parametre {
  constructor(id, libelle, type = "", valeur = "", valeurPossible = []) {
    /**
     * id du parametre
     */
    this._id = id;
    /**
     * nom du parametre
     */
    this._libelle = libelle;
    /**
     * type du parametre : input ou select
     */
    this._type = type;
    /**
     * valeur du parametre
     */
    this._valeur = valeur;
    /**
     * dans le cas d'un select les valeurs possibles
     */
    this._valeurPossible = valeurPossible;
  }
  /**
   *
   */
  get id() {
    return this._id;
  }
  /**
   *
   */
  get libelle() {
    return this._libelle;
  }
  /**
   *
   */
  set libelle(newLibelle) {
    this._libelle = newLibelle;
  }
  /**
   *
   */
  get type() {
    return this._type;
  }
  /**
   *
   */
  set type(newType) {
    this._type = newType;
  }
  /**
   *
   */
  get valeur() {
    return this._valeur;
  }
  /**
   *
   */
  set valeur(newValeur) {
    this._valeur = newValeur;
  }
  /**
   *
   */
  get valeurPossible() {
    return this._valeurPossible;
  }
  /**
   *
   */
  set valeurPossible(newPossible) {
    this._valeurPossible = newPossible;
  }
  /**
   * override JSON
   */
  toJSON() {
    return this._valeur;
  }
  /**
   *
   */
  sauvegarde() {
    localStorage.setItem("outiiil_parametre", JSON.stringify(monProfil.parametre));
    return this;
  }
  /**
   * Libellé et champ sur une ligne ; `suite` : HTML ajouté au bout de la ligne.
   */
  getForm(libelle = this._libelle, suite = "") {
    let champ;
    switch (this._type) {
      case "color":
        champ = `<input id="${this._id}" type="text" value="${this._valeur}" size="7"/><input id="${this._id}Picker" class="o_inputColor" type="color" value="${this._valeur}"/>`;
        break;
      case "number":
        champ = `<input id="${this._id}" value="${this._valeur}" size="7"/>`;
        break;
      case "input":
        champ = `<input id="${this._id}" type="text" value="${this._valeur}"/>`;
        break;
      case "checkbox":
        champ = `<input id="${this._id}" type="checkbox" ${this._valeur ? "checked" : ""}/>`;
        break;
      case "slider":
        // valeurPossible = { min, max, step, unite } ; la valeur est aussi
        // saisissable au clavier, dans un champ synchronisé avec le curseur
        return `<div id="${this._id}Groupe" class="o_ligneParam"><label for="${this._id}Valeur">${libelle}</label><input id="${this._id}Valeur" class="o_sliderValeur" type="text" value="${this._valeur}"/>${this._valeurPossible.unite || ""}<div id="${this._id}" class="slider o_sliderParam"></div>${suite}</div>`;
      case "select":
        champ = `<select id="${this._id}">${this._valeurPossible.map((item, index) => `<option value="${index}" ${index == this._valeur ? "selected" : ""}>${item}</option>`).join("")}</select>`;
        break;
      default:
        champ = "";
    }
    return `<div class="o_ligneParam"><label for="${this._id}">${libelle}</label>${champ}${suite}</div>`;
  }
  /**
   *
   */
  ajouterEvent() {
    switch (this._type) {
      case "number":
        $("#" + this._id).spinner({
          min: 0,
          classes: { "ui-spinner": "o_number ui-corner-all" },
          numberFormat: "i",
        });
        $("#" + this._id).on("spinchange spinstop", (e) => {
          this._valeur = $(e.currentTarget).spinner("value") ?? 0;
          this.sauvegarde();
        });
        break;
      case "color":
        $("#" + this._id).on("input", (e) => {
          this._valeur = e.currentTarget.value.padEnd(7, "0");
          $("#" + this._id + "Picker").val(this._valeur);
          this.sauvegarde();
        });
        $("#" + this._id + "Picker").on("change", (e) => {
          this._valeur = e.currentTarget.value;
          $("#" + this._id).val(this._valeur);
          this.sauvegarde();
        });
        break;
      case "checkbox":
        $("#" + this._id).on("change", (e) => {
          this._valeur = e.currentTarget.checked;
          this.sauvegarde();
        });
        break;
      case "slider": {
        let min = this._valeurPossible.min,
          max = this._valeurPossible.max,
          pas = this._valeurPossible.step || 1,
          champ = $("#" + this._id + "Valeur"),
          enregistrer = (v) => {
            this._valeur = v;
            champ.spinner("value", v);
            this.sauvegarde();
          };
        // Le pas jQuery UI reste à 1 : avec un pas de `pas`, une valeur fine
        // posée depuis le champ serait arrondie. Le glissement à la souris
        // est filtré sur les multiples de `pas` pour garder un curseur rapide ;
        // le clavier sur la poignée garde la précision.
        $("#" + this._id).slider({
          min: min,
          max: max,
          step: 1,
          value: parseInt(this._valeur),
          slide: (e, ui) => {
            if ((ui.value - min) % pas && !(e.originalEvent && e.originalEvent.type == "keydown"))
              return false;
            champ.spinner("value", ui.value);
          },
          // seulement sur action de l'utilisateur : une valeur posée depuis le
          // champ est enregistrée par le champ
          change: (e, ui) => {
            if (e.originalEvent) enregistrer(ui.value);
          },
        });
        champ.spinner({ min: min, max: max, numberFormat: "i" });
        champ.on("spinstop change", () => {
          let v = Math.min(max, Math.max(min, parseInt(champ.val()) || 0));
          $("#" + this._id).slider("value", v);
          enregistrer(v);
        });
        break;
      }
      default:
        $("#" + this._id).on("input", (e) => {
          this._valeur = e.currentTarget.value;
          this.sauvegarde();
        });
        break;
    }
    return this;
  }
}
