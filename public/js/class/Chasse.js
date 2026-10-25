/*
 * RapportChasse.js
 * Hraesvelg
 **********************************************************************/

/**
 * Classe de fonction pour l'analyse d'un rapport de chasse, herite des fonctions de la classe Rapport.
 *
 * @class Chasse
 * @constructor
 * @extends Rapport
 */
class Chasse {
  constructor(rc) {
    /**
     *
     */
    this._rc = rc;
    /**
     *
     */
    this._armeeAv = new Armee();
    /**
     *
     */
    this._armeePe = new Armee();
    /**
     *
     */
    this._armeeAp = new Armee();
    /**
     * Fzzz : terrain conquis, nourriture ramenée et unités montées en XP
     * (nombre par type d'origine, ordre d'Armee.unite).
     */
    this._terrain = 0;
    this._nourriture = 0;
    this._xp = new Array(14).fill(0);
  }
  /**
   *
   */
  get armeeAv() {
    return this._armeeAv;
  }
  /**
   *
   */
  get armeePe() {
    return this._armeePe;
  }
  /**
   *
   */
  get armeeAp() {
    return this._armeeAp;
  }
  /**
   * Fzzz : terrain conquis (cm²) et unités perdues.
   */
  get terrain() {
    return this._terrain;
  }
  get pertes() {
    return this._armeeAv.getSommeUnite() - this._armeePe.getSommeUnite();
  }
  /**
   * Calcule le niveau d'armes en fonction des degats.
   *
   * @private
   * @method getArmes
   * @param {Integer} fdf de base
   * @param {Integer} fdf avec bonus
   * @return {Integer} le niveau d'armes
   */
  calculArmes(base, bonus) {
    return Math.round((bonus / base) * 10);
  }
  /**
   * Calcule le niveau du bouclier.
   *
   * @private
   * @method getBouclier
   * @param {Integer} degat
   * @param {Object} armee1
   * @param {Object} armee2
   * @return {Integer} le niveau de bouclier
   */
  calculBouclier(degat, armee1, armee2) {
    let viePerdue = armee1.getBaseVie() - armee2.getBaseVie();
    return Math.round(((degat - viePerdue) / viePerdue) * 10);
  }
  /**
   * Retourne l'armée en retirant d'aprés le rapport les unités perdues suivant le texte.
   *
   * @private
   * @method retirePerte
   * @param {Object} armee
   * @return {Object} armee perdue
   */
  retirePerte(armee) {
    let res = new Armee(),
      tmp = this._rc.split("et en tue"),
      total = 0;
    res.unite = armee.unite.slice(0);
    // Si le rc à plusieurs tours on additionne d'abords les pertes.
    for (let i = 1; i < tmp.length; total += parseInt(tmp[i++].split(".")[0].replace(/ /g, "")));
    // Tant que le total n'est pas 0 on retire les unités
    for (let i = 0; i < 14; i++) {
      if (res.unite[i] >= total) {
        res.unite[i] -= total;
        break;
      } else {
        total -= res.unite[i];
        res.unite[i] = 0;
      }
    }
    return res;
  }
  /**
   * Retourne l'armée en ajoutant l'xp.
   *
   * @private
   * @method ajouteXP
   * @param {Object} armee
   * @return {Object} armee avec XP
   */
  ajouteXP(armee) {
    let res = new Armee(),
      tmp = this._rc.split("- "),
      tableXP = [-1, 1, 2, -1, 4, 9, 6, -1, 8, -1, -1, 11, -1, 13, -1];
    res.unite = armee.unite.slice(0);
    // Pour chaques types d'unitées qui ont XP.
    for (let i = 1, l = tmp.length; i < l; i++) {
      let uniteXP = NOM_UNITE.indexOf(
          tmp[i].replace(/[0-9]/g, "").split("sont")[0].replace(/s /g, " ").trim(),
        ),
        qteXP = parseInt(tmp[i].replace(/ /g, ""));
      res.unite[uniteXP - 1] -= qteXP;
      res.unite[tableXP[uniteXP]] += qteXP;
      if (uniteXP > 0) this._xp[uniteXP - 1] += qteXP;
    }
    return res;
  }
  /**
   * Récupére l'armée, les pertes et l'xp d'un rapport de chasse.
   *
   * @private
   * @method analyse
   */
  analyse() {
    let motCle = new Array("Troupes en attaque : ", "et en tue");
    if (
      motCle.some((substring) => {
        return this._rc.includes(substring);
      })
    ) {
      this._armeeAv.parseArmee(this._rc.split("Troupes en attaque : ")[1].split(".")[0]);
      // terrain conquis et nourriture ramenée, s'ils figurent dans le rapport
      let nombre = (m) => (m ? parseInt(m[1].replace(/[^0-9]/g, "")) || 0 : 0);
      this._terrain = nombre(this._rc.match(/([\d   .]+)\s*cm²/));
      this._nourriture =
        nombre(this._rc.match(/([\d   .]+)\s*(?:de\s+)?nourriture/i)) ||
        nombre(this._rc.match(/rapportent\s+([\d   .]+)/i));
      this._armeePe = this.retirePerte(this._armeeAv);
      this._armeeAp = this.ajouteXP(this._armeePe);
      return true;
    }
    return false;
  }
  /**
   * Ajoute les données des chasses pour faire un bilan.
   *
   * @private
   * @method ajoute
   * @param {Object} chasse
   */
  ajoute(chasse) {
    for (let i = 0; i < 14; i++) {
      this._armeeAv.unite[i] += chasse.armeeAv.unite[i];
      this._armeePe.unite[i] += chasse.armeePe.unite[i];
      this._armeeAp.unite[i] += chasse.armeeAp.unite[i];
      this._xp[i] += chasse._xp[i];
    }
    this._terrain += chasse._terrain;
    this._nourriture += chasse._nourriture;
    return this;
  }
  /**
   * Fzzz : bilan compact d'une ou plusieurs chasses (messagerie) — en-tête
   * (terrain, pertes, nourriture, pertes par million de cm², perte HOF), puis
   * FdF, défense, vie et unités avant / variation (valeur et %) / après, et la
   * part de chaque unité montée en XP.
   *
   * @method toHTMLBilan
   * @return {String} HTML
   */
  toHTMLBilan() {
    let fmt = (n) => numeral(n).format(),
      av = this._armeeAv,
      ap = this._armeeAp,
      pertes = av.getSommeUnite() - this._armeePe.getSommeUnite(),
      xpTotal = this._xp.reduce((s, n) => s + n, 0),
      pct = (n, d) => (d ? ((n * 100) / d).toFixed(2).replace(".", ",") + " %" : ""),
      entete = [
        this._terrain ? `<b>${fmt(this._terrain)}</b> cm²` : "",
        `<span class='o_varNeg'>${fmt(pertes)}</span> pertes`,
        this._nourriture ? `<b>${fmt(this._nourriture)}</b> nourriture` : "",
        this._terrain
          ? `<b>${fmt(Math.round((pertes * 1e6) / this._terrain))}</b> pertes / M cm²`
          : "",
        `perte HOF <b>${Utils.intToTime(av.getTemps(0) - this._armeePe.getTemps(0))}</b>`,
      ].filter(Boolean),
      ligne = (libelle, a, b, xp = "", classe = "") =>
        `<tr${classe ? ` class='${classe}'` : ""}><td class='left'>${libelle}</td><td class='right'>${fmt(a)}</td><td class='right'>${Utils.variation(b - a, a)}</td><td class='right'>${fmt(b)}</td><td class='right o_bilanXp'>${xp}</td></tr>`,
      // humeur du toutou (SVG animés de l'extension, aucun site tiers) :
      // niais mais heureux si la FdF a augmenté, en larmes sinon
      fdfHausse = ap.getBaseAtt() >= av.getBaseAtt(),
      chien = `<img class='o_bilanChien' src='${chrome.runtime.getURL(fdfHausse ? "images/chien_content.svg" : "images/chien_triste.svg")}' alt='${fdfHausse ? "Toutou heureux" : "Toutou en larmes"}' title='FdF ${fdfHausse ? "en hausse" : "en baisse"} : ${numeral(ap.getBaseAtt() - av.getBaseAtt()).format("+0,0")}'/>`,
      html = `<div class='o_bilanChasse'><p class='o_bilanEntete'>${entete.join(" · ")}</p>
        <div class='o_bilanCorps'>
        <table class='o_bilanTable' cellspacing='0'>
        <tr class='gras'><td></td><td class='right'>Avant</td><td class='right'>Chasses</td><td class='right'>Après</td><td class='right' title="Part des unités de ce type montées en XP">XP</td></tr>`;
    html += ligne(IMG_ATT, av.getBaseAtt(), ap.getBaseAtt());
    html += ligne(IMG_DEF, av.getBaseDef(), ap.getBaseDef());
    html += ligne(IMG_VIE, av.getBaseVie(), ap.getBaseVie());
    html += ligne(
      "<img height='18' class='o_vAlign' src='images/icone/fourmi.png'/>",
      av.getSommeUnite(),
      ap.getSommeUnite(),
      pct(xpTotal, av.getSommeUnite()),
    );
    html += "<tr class='o_bilanSeparation'><td colspan='5'></td></tr>";
    for (let i = 0; i < 14; i++)
      if (av.unite[i] || ap.unite[i])
        html += ligne(
          `<span class='o_bilanUnite'>${NOM_RAC_UNITE[i + 1]}</span>`,
          av.unite[i],
          ap.unite[i],
          this._xp[i] ? pct(this._xp[i], av.unite[i]) : "",
          "o_bilanLigneUnite",
        );
    return html + `</table><div class='o_bilanChienZone'>${chien}</div></div></div>`;
  }
  /**
   *
   */
  toHTMLMessagerie() {
    let tdp = monProfil.getTDP(),
      sommeUnite = this._armeePe.getSommeUnite() - this._armeeAv.getSommeUnite(),
      baseAtt = this._armeeAp.getBaseAtt() - this._armeeAv.getBaseAtt(),
      baseDef = this._armeeAp.getBaseDef() - this._armeeAv.getBaseDef(),
      baseVie = this._armeeAp.getBaseVie() - this._armeeAv.getBaseVie(),
      bonusAtt =
        this._armeeAp.getTotalAtt(monProfil.niveauRecherche[2]) -
        this._armeeAv.getTotalAtt(monProfil.niveauRecherche[2]),
      bonusDef =
        this._armeeAp.getTotalDef(monProfil.niveauRecherche[2]) -
        this._armeeAv.getTotalDef(monProfil.niveauRecherche[2]),
      bonusVie =
        this._armeeAp.getTotalVie(monProfil.niveauRecherche[1]) -
        this._armeeAv.getTotalVie(monProfil.niveauRecherche[1]),
      pAtt = ((baseAtt * 100) / this._armeeAv.getBaseAtt()).toFixed(2),
      pDef = ((baseDef * 100) / this._armeeAv.getBaseDef()).toFixed(2),
      pVie = ((baseVie * 100) / this._armeeAv.getBaseVie()).toFixed(2);
    return `<p class='retour'>Perte HOF : ${Utils.intToTime(this._armeeAv.getTemps(0) - this._armeePe.getTemps(0))} - Perte (TDP ${tdp}) : ${Utils.intToTime(this._armeeAv.getTemps(tdp) - this._armeePe.getTemps(tdp))}</p>
            <table class='o_tabAnalyse right' cellspacing='0'>
			<tr><td><img width='35' src='images/icone/icone_ouvriere.png' alt='nb_unite'/></td><td colspan='2' style='padding-left:10px'>${numeral(sommeUnite).format()}</td><td style='padding-left:10px'>${((sommeUnite * 100) / this._armeeAv.getSommeUnite()).toFixed(2)}%</td></tr>
			<tr><td>${IMG_VIE}</td><td class='right'>${(baseVie > 0 ? "+" : "") + numeral(baseVie).format()}(HB)</td><td class='right'>${(bonusVie > 0 ? "+" : "") + numeral(bonusVie).format()}(AB)</td><td style='padding-left:10px'>${(pVie > 0 ? "+" : "") + pVie}%</td></tr>
			<tr><td>${IMG_ATT}</td><td style='padding-left:10px' class='right'>${(baseAtt > 0 ? "+" : "") + numeral(baseAtt).format()}(HB)</td><td style='padding-left:10px' class='right'>${(bonusAtt > 0 ? "+" : "") + numeral(bonusAtt).format()}(AB)</td><td style='padding-left:10px'>${(pAtt > 0 ? "+" : "") + pAtt}%</td></tr>
			<tr><td>${IMG_DEF}</td><td class='right'>${(baseDef > 0 ? "+" : "") + numeral(baseDef).format()}(HB)</td><td class='right'>${(bonusDef > 0 ? "+" : "") + numeral(bonusDef).format()}(AB)</td></td><td style='padding-left:10px'>${(pDef > 0 ? "+" : "") + pDef}%</td></tr>
			</table>`;
  }
  /**
   *
   */
  toHTMLBoite(bVisible) {
    let diffNbr = this._armeeAp.getSommeUnite() - this._armeeAv.getSommeUnite(),
      diffVie = this._armeeAp.getBaseVie() - this._armeeAv.getBaseVie(),
      diffAtt = this._armeeAp.getBaseAtt() - this._armeeAv.getBaseAtt(),
      diffDef = this._armeeAp.getBaseDef() - this._armeeAv.getBaseDef();
    let html = `<tr ${bVisible ? "" : "style='display:none'"}><td><img height='20' src='images/icone/fourmi.png'/></td><td>${numeral(this._armeeAv.getSommeUnite()).format()}</td><td><img height='20' src='images/icone/fourmi.png'/></td><td>${Utils.variation(diffNbr, this._armeeAv.getSommeUnite())}</td><td><img height='20' src='images/icone/fourmi.png'/></td><td>${numeral(this._armeeAp.getSommeUnite()).format()}</td></tr>
            <tr ${bVisible ? "" : "style='display:none'"}><td>${IMG_VIE}</td><td>${numeral(this._armeeAv.getBaseVie()).format()}</td><td>${IMG_VIE}</td><td>${Utils.variation(diffVie, this._armeeAv.getBaseVie())}</td><td>${IMG_VIE}</td><td>${numeral(this._armeeAp.getBaseVie()).format()}</td></tr>
			<tr ${bVisible ? "" : "style='display:none'"}><td>${IMG_ATT}</td><td>${numeral(this._armeeAv.getBaseAtt()).format()}</td><td>${IMG_ATT}</td><td>${Utils.variation(diffAtt, this._armeeAv.getBaseAtt())}</td><td>${IMG_ATT}</td><td>${numeral(this._armeeAp.getBaseAtt()).format()}</td></tr>
			<tr ${bVisible ? "" : "style='display:none'"}><td>${IMG_DEF}</td><td>${numeral(this._armeeAv.getBaseDef()).format()}</td><td>${IMG_DEF}</td><td>${Utils.variation(diffDef, this._armeeAv.getBaseDef())}</td><td>${IMG_DEF}</td><td>${numeral(this._armeeAp.getBaseDef()).format()}</td></tr>`;
    return html;
  }
}
