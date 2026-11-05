/*
 * Ressource.js
 * Hraesvelg
 **********************************************************************/

/**
 * Classe de fonction pour la page /Ressource.php.
 *
 * @class PageRessource
 * @constructor
 * @extends Page
 */
/**
 * Clé (localStorage) des réglages du lanceur de chasses.
 */
const CLE_LANCEUR_CHASSE = "fzzz_lanceurChasse";

class PageRessource {
  constructor(boiteComptePlus) {
    /**
     * Accés à la boite compte+
     */
    this._boiteComptePlus = boiteComptePlus;
    /**
     * Nombre de chasse restante
     */
    this._nbChasse =
      monProfil.niveauRecherche[5] +
      2 -
      $("#boite_tdc")
        .text()
        .split(/- Vos chasseuses vont conquérir/g).length;
    /**
     * Armée du joueur pour envoyer des chasses
     */
    this._armee = new Armee();
    /**
     * Dernière simulation du lanceur
     */
    this._simu = null;
    /**
     * Heure de retour affichée par la simulation (champ « Retour le ») : seule
     * une autre valeur est une saisie du joueur
     */
    this._dateAffichee = null;
    /**
     * Vrai quand l'affectation des ouvrières a soumis le formulaire du jeu
     */
    this._rechargement = false;
  }
  /**
   *
   */
  executer() {
    if (Utils.affichage("lanceurChasse"))
      this._armee.getArmee().then((data) => {
        // la page va se recharger (affectation des ouvrières) : un lancement de
        // chasses commencé maintenant serait coupé en route
        if (this._rechargement) return;
        this._armee.chargeData(data);
        this.lanceur();
      });
    // Lie les chasses lancées aux lignes du jeu (compte des troupes dehors)
    TroupesDehors.synchroniserChasses();
    // Sauvegarde les chasses en cours et ajoute les boutons max recolte
    if (!Utils.comptePlus) this.plus();
    // Affectation automatique des ouvrières (tous comptes)
    this.affectation();
    // Fzzz : synthèse des chasses en cours par minute d'impact
    this.syntheseChasses();
    // Bouton "Annuler toutes les chasses" si au moins une est en cours
    this.boutonAnnulerChasses();
    // annulation d'une chasse, lancement : même position à l'écran après rechargement
    Utils.garderPosition("fzzz_positionRessources");
    return this;
  }
  /**
   * Fzzz : synthèse des chasses en cours par minute d'impact. Les chasses qui
   * arrivent sur des minutes consécutives (13h05, 13h06, 13h07…) forment un
   * seul groupe, affiché à la minute la plus tardive. Pour chaque groupe :
   * heure d'impact, TdC chassé, TdC par heure, JSN perdues par heure (estimées
   * d'après l'armée envoyée et le TdC courant) et unités mises en chasse.
   * La durée d'une chasse lancée d'ici est connue (TroupesDehors retient
   * l'heure de lancement) ; sinon elle est estimée comme si la chasse partait
   * maintenant, et la ligne le signale.
   *
   * @private
   * @method syntheseChasses
   */
  syntheseChasses() {
    let partagerMaintenant = false;
    try {
      partagerMaintenant = Number(sessionStorage.getItem(CLE_PARTAGE_CHASSES_APRES)) > Date.now();
      sessionStorage.removeItem(CLE_PARTAGE_CHASSES_APRES);
    } catch (e) {}
    // page Ressources réelle (pas une page de connexion) : elle liste toutes les chasses
    if (!$("#boite_tdc").length) return;
    let chasses = [],
      dehors = {},
      niveau = (n) => Math.max(0, n || 0),
      vitesse = niveau(monProfil.niveauRecherche[5]),
      armes = niveau(monProfil.niveauRecherche[2]),
      bouclier = niveau(monProfil.niveauRecherche[1]),
      tdc = Math.max(1, Utils.terrain || 1);
    TroupesDehors.charger().forEach((t) => {
      if (t.type == "chasse" && t.id) dehors[t.id] = t;
    });
    $("#boite_tdc span[id^='chasse_']").each((i, elt) => {
      let $ligne = $(elt).parent(),
        secondes = parseInt($ligne.nextAll("script").first().text().split("(")[1]),
        terrain = numeral(($ligne.text().match(/conquérir\s+([\d\s ]+)\s*cm/) || [])[1]).value(),
        details = $ligne.nextAll("small").first().text(),
        troupes =
          (details.match(/Troupes en chasses?\s*:\s*([^\n]+?)\.?\s*(?:Arrivée|$)/i) || [])[1] || "",
        libelle = details.match(/Arrivée à (\d+)h(\d+)/i);
      if (isNaN(secondes)) return;
      // minute d'impact : celle qu'affiche le jeu (« Arrivée à 02h59 »), placée
      // au jour le plus proche de l'arrivée calculée ; sinon l'arrivée calculée
      let arrivee = Horloge.serveur().add(secondes, "s"),
        impact = arrivee.clone().startOf("minute");
      if (libelle) {
        impact = arrivee
          .clone()
          .hours(parseInt(libelle[1]))
          .minutes(parseInt(libelle[2]))
          .startOf("minute");
        let ecart = impact.diff(arrivee, "hours", true);
        if (ecart > 12) impact.subtract(1, "day");
        else if (ecart < -12) impact.add(1, "day");
      }
      let unites = {};
      troupes.split(",").forEach((morceau) => {
        let m = morceau.trim().match(/^([\d\s ]+)\s+(.+)$/);
        if (m) unites[m[2].trim()] = numeral(m[1]).value();
      });
      // durée : écoulé depuis le lancement + reste du jeu, sinon estimée
      let envoi = dehors[parseInt($(elt).attr("id").split("_")[1])],
        duree = envoi
          ? Math.max(1, secondes + (Date.now() - envoi.lancee) / 1000)
          : Math.max(1, SimulationChasse.duree(tdc, terrain || 0, vitesse)),
        armee = envoi ? envoi.unite : this._armeeDepuisNoms(unites),
        difficulte = SimulationChasse.difficulte(tdc, terrain || 0),
        attaque = SimulationChasse.attaqueArmee(armee, armes),
        pertes =
          attaque > 0
            ? SimulationChasse.pertes(
                SimulationChasse.indexRatioRef(attaque / difficulte),
                difficulte,
                bouclier,
              ).AVG
            : 0;
      chasses.push({
        impact: impact,
        terrain: terrain || 0,
        unites: unites,
        duree: duree,
        estime: !envoi,
        pertes: pertes,
      });
    });
    if (!chasses.length) {
      // chasses annulées ou arrivées : plus rien à garder dans le forum
      PartageChasses.recalerChasses([]);
      if (partagerMaintenant)
        $.toast({ ...TOAST_WARNING, text: "Aucune chasse en cours : rien à partager." });
      return;
    }
    chasses.sort((a, b) => a.impact - b.impact);
    let groupes = [];
    chasses.forEach((c) => {
      let dernier = groupes[groupes.length - 1];
      if (dernier && c.impact.diff(dernier.impact, "minutes") <= 1) {
        dernier.impact = c.impact;
        dernier.chasses.push(c);
      } else groupes.push({ impact: c.impact, chasses: [c] });
    });
    let somme = (liste) => {
        let terrain = 0,
          tdcHeure = 0,
          jsnHeure = 0,
          estime = false,
          unites = {};
        liste.forEach((c) => {
          terrain += c.terrain;
          tdcHeure += (c.terrain / c.duree) * 3600;
          jsnHeure += (c.pertes / c.duree) * 3600;
          estime = estime || c.estime;
          // singulier et pluriel (« 1 Tank », « 3 Tanks ») sous la même clé
          for (let nom in c.unites) {
            let cle = nom.toLowerCase().replace(/s\b/g, "");
            if (!unites[cle]) unites[cle] = { nom: nom, nb: 0 };
            unites[cle].nb += c.unites[nom];
            // forme plurielle (la plus longue) pour l'affichage
            if (nom.length > unites[cle].nom.length) unites[cle].nom = nom;
          }
        });
        // ordre des unités du jeu (JSN, SN, NE, JS, S…), inconnues en dernier
        let rang = (nom) => {
            let r = [...NOM_UNITES, ...NOM_UNITE].findIndex(
              (n) => n.toLowerCase() == nom.toLowerCase(),
            );
            return r == -1 ? 99 : r % NOM_UNITES.length;
          },
          detail = Object.values(unites).sort((a, b) => rang(a.nom) - rang(b.nom)),
          total = detail.reduce((t, u) => t + u.nb, 0);
        return {
          terrain: terrain,
          tdcHeure: tdcHeure,
          jsnHeure: jsnHeure,
          estime: estime,
          total: total,
          detail: detail.map((u) => `${numeral(u.nb).format()} ${u.nom}`).join(", "),
        };
      },
      textes = [],
      ligne = (libelle, liste, classe) => {
        let s = somme(liste),
          unites = s.detail ? s.detail + "." : "",
          // ~ : durée estimée (chasse lancée ailleurs qu'ici) ; les pertes sont toujours une estimation
          tdcHeure = `${s.estime ? "~" : ""}${numeral(Math.round(s.tdcHeure)).format()}`,
          jsnHeure = `≈ ${numeral(Math.round(s.jsnHeure)).format()}`;
        textes.push(
          `${libelle} : ${liste.length} chasse${liste.length > 1 ? "s" : ""}, ${numeral(s.terrain).format()} cm², ${tdcHeure} cm²/h, ${jsnHeure} JSN/h perdues, ${unites}`,
        );
        return `<tr class='${classe}'><td>${libelle}</td><td>${liste.length}</td><td>${numeral(s.terrain).format()} cm²</td><td title='${s.estime ? "~ : durée estimée comme si la chasse partait maintenant (lancée ailleurs que d&#39;ici)" : "Durée réelle depuis le lancement"}'>${tdcHeure}</td><td title='Pertes moyennes estimées d&#39;après l&#39;armée envoyée et le TdC courant'>${jsnHeure}</td><td class='o_syntheseUnites'>${unites}</td></tr>`;
      },
      html = `<table class='o_maxWidth centre' cellspacing='0'>
        <tr class='gras'><td>Heure d'impact</td><td>Chasses</td><td>TdC chassé</td><td>TdC / h</td><td>JSN / h</td><td>Unités mises en chasse</td></tr>`;
    let aPartager = () =>
      groupes.map((g) => {
        let s = somme(g.chasses);
        return { impact: g.impact, terrain: s.terrain, unites: s.detail ? s.detail + "." : "" };
      });
    if (partagerMaintenant) PartageChasses.partager(aPartager(), null);
    // chasses partagées puis annulées (ici ou par le lien du jeu) : retirées du forum
    else
      PartageChasses.recalerChasses(
        groupes.map((g) => ({
          debut: g.chasses[0].impact.format("YYYY-MM-DD HH:mm"),
          fin: g.impact.format("YYYY-MM-DD HH:mm"),
          terrain: somme(g.chasses).terrain,
        })),
      );
    if (!Utils.affichage("syntheseChasses")) return;
    groupes.forEach((g, i) => {
      html += ligne(g.impact.format("D MMM [à] HH[h]mm"), g.chasses, i % 2 ? "" : "ligne_paire");
    });
    if (groupes.length > 1) html += ligne("Total", chasses, "gras o_syntheseTotal");
    html += `</table><div class='o_syntheseBoutons'>
        <button type='button' id='o_copierSynthese' class='o_button f_info'>Copier la synthèse</button>
        <button type='button' id='o_partagerChasses' class='o_button f_info'>Partager mes chasses avec la ${Utils.alliance || "l'alliance"}</button>
      </div>`;
    html =
      "<div id='o_syntheseChasses'>" +
      Utils.spoiler(
        `Synthèse des chasses en cours (${chasses.length})`,
        html,
        "ressourcesSynthese",
        "gras",
      ) +
      "</div>";
    // sous le titre « Chasse en cours », au-dessus des lignes de chasse
    let $titre = $("#boite_tdc span.titre").filter((i, e) =>
      $(e).text().includes("Chasse en cours"),
    );
    if ($titre.length) $titre.first().after(html);
    else $("#boite_tdc").append(html);
    $("#o_copierSynthese").on("click", () =>
      CommerceFzzz.copier(textes.join("\n"), "Synthèse des chasses copiée dans le presse-papier."),
    );
    $("#o_partagerChasses").on("click", (e) =>
      PartageChasses.partager(aPartager(), $(e.currentTarget)),
    );
  }
  /**
   * Armée (ordre d'Armee.unite) d'après les unités nommées par le jeu
   * (« Troupes en chasse : 1 000 Jeunes Soldates Naines, … »).
   *
   * @private
   * @method _armeeDepuisNoms
   * @param {Object} unites nom → nombre
   * @return {Array}
   */
  _armeeDepuisNoms(unites) {
    let armee = new Array(14).fill(0),
      noms = [...NOM_UNITES, ...NOM_UNITE].map((n) => n.toLowerCase().replace(/['’]/g, "'"));
    for (let nom in unites) {
      let i = noms.indexOf(nom.toLowerCase().replace(/['’]/g, "'")),
        u = i == -1 ? -1 : (i % NOM_UNITES.length) - 1;
      if (u >= 0) armee[u] += unites[nom] || 0;
    }
    return armee;
  }
  /**
   * Ajoute un bouton "Annuler toutes les chasses" dans la boîte de chasse en cours.
   * Le serveur expose `Ressources.php?annuler=<chasseId>` pour annuler une chasse —
   * on itère sur tous les spans `chasse_<id>` présents dans `#boite_tdc`.
   *
   * @private
   * @method boutonAnnulerChasses
   */
  boutonAnnulerChasses() {
    let chasses = $("#boite_tdc span[id^='chasse_']");
    if (!chasses.length) return;
    $("#boite_tdc").append(
      `<div class="o_marginT15 centre"><button id="o_annulerChasses" class="o_button f_error" type="button">Annuler toutes les chasses (${chasses.length})</button></div>`,
    );
    $("#o_annulerChasses").click(() => {
      if (!confirm(`Annuler les ${chasses.length} chasse(s) en cours ? Action irréversible.`))
        return;
      $("#o_annulerChasses").prop("disabled", true).text("Annulation…");
      let promesses = chasses
        .map((_, span) => $(span).attr("id").replace("chasse_", ""))
        .get()
        .map((id) => $.get(`${location.origin}/Ressources.php?annuler=${id}`));
      Promise.all(promesses).then(
        () => {
          location.reload();
        },
        () => {
          $.toast({
            ...TOAST_ERROR,
            text: "Au moins une annulation a échoué — rechargement quand même.",
          });
          setTimeout(() => location.reload(), 1500);
        },
      );
    });
  }
  /**
   * Réglages mémorisés du lanceur : ce qui ne dépend pas de la salve du moment,
   * pour n'avoir rien à retoucher d'une fois sur l'autre : difficulté et pertes
   * acceptées (fixées ou Auto, et leur valeur), intervalle, marge de JSN max,
   * rééquilibrage et JSN gardées. Nombre, terrain, retour et rendement
   * repartent en Auto.
   */
  get reglagesLanceur() {
    let r = {};
    try {
      r = JSON.parse(localStorage.getItem(CLE_LANCEUR_CHASSE)) || {};
    } catch (e) {
      r = {};
    }
    return {
      auto: {
        ratio: r.auto && r.auto.ratio != null ? !!r.auto.ratio : false,
        budget: r.auto && r.auto.budget != null ? !!r.auto.budget : true,
      },
      ratio: r.ratio >= 1 ? r.ratio : 9,
      budget: r.budget > 0 ? r.budget : 30,
      intervalle: [2, 30, 60, 120].includes(r.intervalle) ? r.intervalle : 2,
      marge: r.marge >= 0 ? r.marge : SimulationChasse.FACTEUR_SECURITE,
      reequilibrer: r.reequilibrer == null ? true : !!r.reequilibrer,
      jsn: r.jsn > 0 ? r.jsn : 0,
    };
  }
  set reglagesLanceur(r) {
    try {
      localStorage.setItem(CLE_LANCEUR_CHASSE, JSON.stringify(r));
    } catch (e) {}
  }
  /**
   * Formulaire de lancement pour les chasses. Deux choses à décider, le nombre
   * de chasses et le terrain par chasse ; le joueur fixe ce qu'il veut (case
   * « Auto » décochée) parmi le nombre, le terrain (ou l'heure de retour, ce
   * qui revient au même), la difficulté, les pertes acceptées et le rendement,
   * et le lanceur calcule le reste (SimulationChasse.resoudre). Par défaut la
   * difficulté est fixée et le reste calculé, comme le lanceur a toujours fait.
   *
   * @private
   * @method lanceur
   */
  lanceur() {
    let R = this.reglagesLanceur,
      ratios = RATIO_CHASSE.map(
        (r, i) =>
          `<option value='${r}' label='${r.toFixed(1)} → Rep10% : ${this._replique(i)}'></option>`,
      ).join(""),
      auto = (id, coche, titre = "") =>
        `<input id='${id}' type='checkbox' class='o_chasseAuto'${coche ? " checked='checked'" : ""}/><label for='${id}'${titre ? ` title='${titre}'` : ""}>Auto</label>`;
    $("#boite_tdc")
      .after(`<br/><div id='o_prepaChasse' class='boite_amelioration simulateur centre'><h2>Lanceur de Chasses</h2>
            <div class='o_spoilerCadre o_marginT15' id='o_chasseParamCadre'>
              <div class='o_spoilerBandeau' id='o_chasseParamToggle' title='Voir ou modifier l&#39;armée et les niveaux que le lanceur utilise'><span class='o_fleche'>▶</span> Armée et niveaux utilisés <span class='small o_chasseParamAide'>(cliquer pour voir ou modifier)</span></div>
              <div class='o_spoilerContenu'>Garder des JSN <input value='0' size='12' id='o_chasseJSN'/> <span class='small'>max : <span id='o_chasseJSNMax'>${numeral(this._armee.nbrJSN).format()}</span></span></div>
              <div id='o_chasseParam' style='display:none' class='o_spoilerContenu'>
                <table class='o_maxWidth'><tr><td valign='top'>
                  <table id='o_chasseParamArmee'>
                    <tr class='gras entete'><td>Armée <span id='o_chasseParamImporter' class='cursor' title='Importer une armée (texte collé : page Armée, rapport, « 30 jsn et 27 artilleuses »…)'>${IMG_COPY}</span></td><td></td></tr>
                    ${NOM_UNITE.slice(1)
                      .map(
                        (nom, i) =>
                          `<tr><td><input name='o_cpUnite' data-i='${i}' value='0' size='12'/></td><td class='left'>${nom}</td></tr>`,
                      )
                      .join("")}
                  </table>
                </td><td valign='top'>
                  <table id='o_chasseParamNiveau'>
                    <tr class='gras entete'><td colspan='2'>Niveaux</td></tr>
                    ${[
                      ["o_cpArmes", "Armes"],
                      ["o_cpBouclier", "Bouclier thoracique"],
                      ["o_cpVitesse", "Vitesse de chasse"],
                      ["o_cpCouveuse", "Couveuse"],
                      ["o_cpSolarium", "Solarium"],
                      ["o_cpPonte", "Technique de ponte"],
                    ]
                      .map(
                        ([id, nom]) =>
                          `<tr><td><input id='${id}' value='0' size='6'/></td><td class='left'>${nom}</td></tr>`,
                      )
                      .join("")}
                    <tr class='gras entete'><td colspan='2'>Chasse</td></tr>
                    <tr><td><input id='o_cpTdcLancement' value='0' size='12' title='Fixe la durée des chasses'/></td><td class='left'>TdC au lancement</td></tr>
                    <tr><td><input id='o_cpPlaces' value='0' size='6'/></td><td class='left'>Places de chasse libres</td></tr>
                    <tr><td colspan='2'><button type='button' id='o_chasseParamRetablir' class='o_button'>Rétablir mes valeurs</button></td></tr>
                  </table>
                  <p class='small'><em>Modifiés, ces paramètres servent à simuler : le lancement est alors désactivé.</em></p>
                </td></tr></table>
              </div>
            </div>
            <table id='o_lanceurChasse' class='o_maxWidth o_marginT15' cellspacing=0>
			<tr class='ligne_paire'><td>Terrain à l'arrivée</td><td><input value='${Math.min(Utils.terrain || 0, monProfil.parametre["tdcArriveeMax"].valeur || Infinity)}' size='21' id='o_chasseTDCDep'/></td><td></td></tr>
			<tr><td>Nombre de chasse</td><td><input value='0' size='21' id='o_chasseNbr'/></td><td>${auto("o_chasseNbrAuto", true)}</td></tr>
			<tr class='ligne_paire'><td>Terrain par chasse</td><td><input value='0' size='21' id='o_chasseTDCRep'/></td><td>${auto("o_chasseTDCRepAuto", true, "Calculé, ou fixé ici ou par l&#39;heure de retour")}</td></tr>
			<tr><td>Retour le</td><td><input value='' size='21' id='o_chasseDateArrivee' placeholder='JJ-MM-AAAA HH:mm'/></td><td class='small'>= terrain par chasse</td></tr>
			<tr class='ligne_paire'><td>Difficulté</td><td><input value='9' size='21' id='o_chasseDiff' list='o_chasseDiffListe' title='Ratio (Attaque de votre Armée) / (Difficulté de chasse) : détermine les pertes et taux de réplique de votre chasse. Les valeurs de la liste sont celles des tables de pertes ; entre deux, les pertes estimées sont celles de la valeur du dessous.'/><datalist id='o_chasseDiffListe'>${ratios}</datalist></td><td>${auto("o_chasseDiffAuto", false, `Difficulté la plus basse que les pertes acceptées permettent, jamais sous ${SimulationChasse.RATIO_PLANCHER}`)} <span id='o_chasseDiffInfo' class='small'></span></td></tr>
			<tr><td title='Part du temps de ponte de JSN consacrée à remplacer les pertes moyennes'>Pertes acceptées (% de la ponte) <span class='o_chasseCible' id='o_chasseCiblePertes' title='Ce que le lanceur minimise : la salve la moins coûteuse qui atteint le rendement fixé'>🎯</span></td><td><input value='${R.budget}' size='21' id='o_chasseBudget'/></td><td>${auto("o_chasseBudgetAuto", true)} <span id='o_chasseBudgetInfo' class='small'></span></td></tr>
			<tr class='ligne_paire'><td title='TdC chassé par heure de chasse'>Rendement (cm² / h) <span class='o_chasseCible' id='o_chasseCibleRendement' title='Ce que le lanceur maximise, dans les limites fixées'>🎯</span></td><td><input value='0' size='21' id='o_chasseRendement'/></td><td>${auto("o_chasseRendementAuto", true, "Fixé : la salve la moins coûteuse qui l&#39;atteint")} <span id='o_chasseRendementInfo' class='small'></span></td></tr>
			<tr><td colspan='3'><em>Basé sur le lanceur de <a href='http://alliancead2.free.fr/Outils/Repository/HuntSimv2.00/Simulator_2.00.00.html' class='violet' target='_blank' rel='noopener'>Calystene</a></em> · <a id='o_chasseReglagesDefaut' class='cursor souligne small' title='Oublie les réglages mémorisés (difficulté, pertes acceptées, intervalle, marge, rééquilibrage, JSN gardées)'>réglages par défaut</a></td></tr>
			</table>
            <p id='o_chasseAlerte' class='o_marginT15'></p>
            <div class='o_marginT15'><span title='Au plus marge × pertes max de JSN partent en tampon avec chaque chasse ; au-delà, les JSN sont des attaquantes. Si le stock ne permet pas ce tampon à toutes les chasses, il est réduit pour toutes. Dès × 1, les pertes max sont couvertes.'>Marge JSN max <input value='${R.marge}' size='12' id='o_chasseMarge'/> × pertes max</span> &nbsp; <input id='o_chasseReequilibrer' type='checkbox'${R.reequilibrer ? " checked='checked'" : ""}/><label for='o_chasseReequilibrer' title='Redistribue les JSN au prorata des pertes max de chaque chasse, puis complète avec les SN et les NE (totaux inchangés).'>Rééquilibrer JSN → SN → NE</label></div>
            <div id='o_simuChasse'><table id='o_simulationChasse' cellspacing=0 class='o_maxWidth'></table></div>
            <div class='o_marginT15'>Intervalle entre les chasses <select id='o_chasseInt' title='Intervalle entre les chasses'><option value='2' selected>2 secondes</option><option value='30'>30 secondes</option><option value='60'>1 minute</option><option value='120'>2 minutes</option></select></div>
            <div class='o_pile o_marginT15'><button class='o_button f_success' type='button' id='o_chasseEnvoyer'>Envoyer</button>
            <button class='o_button f_info' type='button' id='o_chasseEnvoyerPartager' title='Lance les chasses, puis publie toutes tes chasses en cours dans le forum de la ${Utils.echapper(Utils.alliance || "l'alliance")}'>Envoyer + partager</button></div>
            <p class='o_marginT0'><em class='small'>Veuillez rester sur cette page le temps du lancement !</em></p>
            <table id='o_recapChasse' cellspacing=0>
			<tr class='ligne_paire'><td colspan='3' class='gras'>Récapitulatif</td></tr>
			<tr><td>Chasse(s)</td><td>:</td><td id='o_chasseTotal'></td><td></td></tr>
			<tr class='ligne_paire'><td>Temps requis</td><td>:</td><td id='o_chasseTemps'></td></tr>
			<tr><td>Retour</td><td>:</td><td id='o_chasseRetour'></td></tr>
			<tr class='ligne_paire'><td>Rentabilité</td><td>:</td><td id='o_chasseRentabilite'></td></tr>
			<tr><td>Difficulté</td><td>:</td><td id='o_chasseRefDiff'></td></tr>
			<tr class='ligne_paire'><td>Perte estimé</td><td>:</td><td id='o_chassePerte'></td></tr>
			<tr><td>Limité par</td><td>:</td><td id='o_chasseLimite'></td></tr>
			</table>
            <div class='o_marginT15'>
              <a id='o_chassePertesTdcToggle' class='cursor souligne'>▼ Pertes selon le niveau de TdC à l'arrivée ▼</a>
              <div id='o_chassePertesTdc' style='display:none' class='o_marginT15'>
                <table id='o_chassePertesTdcTable' class='o_maxWidth' cellspacing='0'>
                  <thead>
                    <tr class='gras ligne_paire'>
                      <td>TdC à l'arrivée</td>
                      <td class='right'>Pertes Min</td>
                      <td class='right'>Pertes Avg</td>
                      <td class='right'>Pertes Max</td>
                      <td class='right'>Variation moy.</td>
                    </tr>
                  </thead>
                  <tbody>
                    <tr class='gras'><td><span id='o_otherHfRefValue'>—</span> cm² <span class='small'>(Terrain à l'arrivée)</span></td><td class='right o_otherHfMin' data-idx='0'>—</td><td class='right o_otherHfAvg' data-idx='0'>—</td><td class='right o_otherHfMax' data-idx='0'>—</td><td class='right'>—</td></tr>
                    ${[
                      1000000, 5000000, 10000000, 15000000, 20000000, 30000000, 40000000, 50000000,
                      75000000, 100000000,
                    ]
                      .map((v, k) => {
                        let i = k + 1;
                        return `<tr ${i % 2 ? "class='ligne_paire'" : ""}><td><input class='o_otherHfInputAlt' data-idx='${i}' value='${v}' size='15'/> cm²</td><td class='right o_otherHfMin' data-idx='${i}'>—</td><td class='right o_otherHfAvg' data-idx='${i}'>—</td><td class='right o_otherHfMax' data-idx='${i}'>—</td><td class='right o_otherHfVar' data-idx='${i}'>—</td></tr>`;
                      })
                      .join("")}
                  </tbody>
                </table>
              </div>
            </div></div>`);
    $("#o_chasseTDCDep").spinner({ min: 0, numberFormat: "i" });
    $("#o_chasseJSN").spinner({
      min: 0,
      max: this._armee.nbrJSN,
      numberFormat: "i",
    });
    $("#o_chasseTDCRep").spinner({ min: 1, numberFormat: "i" });
    $("#o_chasseNbr").spinner({ min: 1, max: this._nbChasse, numberFormat: "i" });
    $("#o_chasseBudget").spinner({ min: 0.1, step: 0.1, numberFormat: "i" });
    $("#o_chasseRendement").spinner({ min: 1, numberFormat: "i" });
    // le widget pose autocomplete=off, qui peut cacher la liste des ratios de référence
    $("#o_chasseDiff").spinner({ min: 1, step: 0.1, numberFormat: "i" }).removeAttr("autocomplete");
    $("#o_chasseMarge").spinner({ min: 0, step: 0.1, numberFormat: "i" });
    $("input[name='o_cpUnite'], #o_cpTdcLancement").spinner({ min: 0, numberFormat: "i" });
    $("#o_cpArmes, #o_cpBouclier, #o_cpVitesse, #o_cpCouveuse, #o_cpSolarium, #o_cpPonte").spinner({
      min: 0,
      max: 50,
      numberFormat: "i",
    });
    $("#o_cpPlaces").spinner({ min: 0, max: 20, numberFormat: "i" });
    this._remplirParametres();
    $("#o_chasseDateArrivee").datetimepicker({
      ...DATEPICKER_OPTION,
      dateFormat: "dd-mm-yy",
      timeFormat: "HH:mm",
      timeText: "Horaire",
      hourText: "Heure",
      minuteText: "Minute",
      minDate: 0,
    });
    $(".o_otherHfInputAlt").spinner({ min: 0, numberFormat: "i" });
    // Completion des valeurs
    this._restaurerReglages();
    this._majVerrous();
    this.preparerChasse();
    // Event
    $(
      "#o_chasseTDCDep, #o_chasseNbr, #o_chasseTDCRep, #o_chasseBudget, #o_chasseRendement, #o_chasseDiff",
    ).on("input spin", (e, ui) => {
      // champs décimaux : la virgule française vaut le point (Globalize est en
      // culture par défaut, où « 7,2 » se lirait 72) ; pas les entiers, que
      // Globalize affiche avec une virgule de milliers (« 1,804 »)
      if (
        !ui &&
        ["o_chasseDiff", "o_chasseBudget"].includes(e.currentTarget.id) &&
        /^\d+,\d{1,2}$/.test(e.currentTarget.value)
      )
        e.currentTarget.value = e.currentTarget.value.replace(",", ".");
      let nombre = ui ? ui.value : $(e.currentTarget).spinner("value");
      $(e.currentTarget).spinner("value", nombre);
      if (e.currentTarget.id == "o_chasseDiff") this._majCouleurDiff();
      this._sauverReglages();
      this.preparerChasse();
    });
    $(".o_chasseAuto").on("change", (e) => {
      this._majVerrous(e.currentTarget.id);
      this._sauverReglages();
      this.preparerChasse();
    });
    // un clic (ou le clavier) sur un champ calculé le fixe, à la valeur affichée
    let cases = {
      o_chasseNbr: "#o_chasseNbrAuto",
      o_chasseTDCRep: "#o_chasseTDCRepAuto",
      o_chasseBudget: "#o_chasseBudgetAuto",
      o_chasseRendement: "#o_chasseRendementAuto",
      o_chasseDiff: "#o_chasseDiffAuto",
    };
    $("#o_chasseNbr, #o_chasseTDCRep, #o_chasseBudget, #o_chasseRendement, #o_chasseDiff")
      .parent(".ui-spinner")
      .on("click", (e) => this._fixerAuClic($(e.currentTarget).find("input").attr("id"), cases));
    $("#o_chasseNbr, #o_chasseTDCRep, #o_chasseBudget, #o_chasseRendement, #o_chasseDiff").on(
      "focus",
      (e) => this._fixerAuClic(e.currentTarget.id, cases),
    );
    $("#o_chasseInt").change(() => this._sauverReglages());
    $("#o_chasseReglagesDefaut").click(() => {
      try {
        localStorage.removeItem(CLE_LANCEUR_CHASSE);
      } catch (e) {}
      $("#o_chasseReequilibrer").prop("checked", this.reglagesLanceur.reequilibrer);
      $("#o_chasseMarge").spinner("value", this.reglagesLanceur.marge);
      this._restaurerReglages();
      this._majVerrous();
      this.preparerChasse();
    });
    $("#o_chasseJSN").on("input spin", (e, ui) => {
      let nombre = ui ? ui.value : $(e.currentTarget).spinner("value");
      $(e.currentTarget).spinner("value", nombre);
      this._sauverReglages();
      this.preparerChasse();
    });
    $("#o_chasseDateArrivee").on("change", () => this.terrainDepuisDate());
    $("#o_chasseMarge").on("input spin", (e, ui) => {
      if (!ui && /^\d+,\d{1,2}$/.test(e.currentTarget.value))
        e.currentTarget.value = e.currentTarget.value.replace(",", ".");
      let nombre = ui ? ui.value : $(e.currentTarget).spinner("value");
      $(e.currentTarget).spinner("value", nombre);
      this._sauverReglages();
      this.preparerChasse();
    });
    $("#o_chasseParam input").on("input spin", (e, ui) => {
      let nombre = ui ? ui.value : $(e.currentTarget).spinner("value");
      $(e.currentTarget).spinner("value", nombre);
      this._majParametres();
      this.preparerChasse();
    });
    $("#o_chasseParamImporter").click(() =>
      ouvrirImportArmee((armee) => {
        $("input[name='o_cpUnite']").each((_, elt) =>
          $(elt).spinner("value", armee.unite[$(elt).data("i")] || 0),
        );
        this._majParametres();
        this.preparerChasse();
      }),
    );
    $("#o_chasseParamRetablir").click(() => {
      this._remplirParametres();
      this.preparerChasse();
    });
    $("#o_chasseParamToggle").click(() => {
      let ouvert = !$("#o_chasseParam").is(":visible");
      $("#o_chasseParam").toggle(ouvert);
      $("#o_chasseParamToggle")
        .toggleClass("o_ouvert", ouvert)
        .find(".o_fleche")
        .text(ouvert ? "▼" : "▶");
    });
    $("#o_chasseReequilibrer").on("change", () => {
      this._sauverReglages();
      this.preparerChasse();
    });
    $("#o_chassePertesTdcToggle").click(() => {
      let $div = $("#o_chassePertesTdc");
      $div.toggle();
      let arrow = $div.is(":visible") ? "▲" : "▼";
      $("#o_chassePertesTdcToggle").text(
        `${arrow} Pertes selon le niveau de TdC à l'arrivée ${arrow}`,
      );
    });
    $(".o_otherHfInputAlt").on("input spin", () => this.mettreAjourPertesTdc());
    // Lancement des chasses
    $("#o_chasseEnvoyer, #o_chasseEnvoyerPartager").click((e) => {
      if (this._armee.getSommeUnite() && this._simu && !this._parametresModifies()) {
        // désactivés dès le premier clic : un double clic enverrait chaque chasse deux fois
        $("#o_chasseEnvoyer, #o_chasseEnvoyerPartager").prop("disabled", true);
        $(e.currentTarget).text("Envoi en cours…");
        let terrainChasse = this._simu.terrain,
          nbChasse = this._simu.nombre,
          intervalle = $("#o_chasseInt").val() * 1000;
        // partage au rechargement qui suit la dernière chasse ; sans rechargement
        // (page quittée en route), l'ordre expire
        if (e.currentTarget.id == "o_chasseEnvoyerPartager")
          try {
            sessionStorage.setItem(
              CLE_PARTAGE_CHASSES_APRES,
              String(Date.now() + nbChasse * intervalle + 5 * 60000),
            );
          } catch (err) {}
        // chaque chasse relit un jeton neuf (Armee.posterChasse)
        this._armee.envoyerChasse(terrainChasse, nbChasse, 0, intervalle);
      } else
        $.toast({
          ...TOAST_ERROR,
          text: "Vous n'avez pas d'armée à envoyer.",
        });
      return false;
    });
    return this;
  }
  /**
   * Mémorise les pertes acceptées, la marge de JSN et le rééquilibrage.
   *
   * @private
   * @method _sauverReglages
   */
  _sauverReglages() {
    let R = this.reglagesLanceur,
      auto = (id) => $(id).is(":checked"),
      valeur = (id) => $(id).spinner("value") || 0,
      cases = { ratio: auto("#o_chasseDiffAuto"), budget: auto("#o_chasseBudgetAuto") };
    this.reglagesLanceur = {
      auto: cases,
      ratio: cases.ratio ? R.ratio : valeur("#o_chasseDiff"),
      budget: cases.budget ? R.budget : valeur("#o_chasseBudget"),
      intervalle: parseInt($("#o_chasseInt").val()) || 2,
      marge: Math.max(0, valeur("#o_chasseMarge")),
      reequilibrer: $("#o_chasseReequilibrer").is(":checked"),
      jsn: valeur("#o_chasseJSN"),
    };
  }
  /**
   * Applique les réglages mémorisés au formulaire (avant le premier calcul).
   *
   * @private
   * @method _restaurerReglages
   */
  _restaurerReglages() {
    let R = this.reglagesLanceur;
    $("#o_chasseDiffAuto").prop("checked", R.auto.ratio);
    $("#o_chasseBudgetAuto").prop("checked", R.auto.budget);
    $("#o_chasseDiff").spinner("value", R.ratio);
    this._majCouleurDiff();
    $("#o_chasseBudget").spinner("value", R.budget);
    $("#o_chasseInt").val(String(R.intervalle));
    $("#o_chasseJSN").spinner("value", Math.min(R.jsn, $("#o_chasseJSN").spinner("option", "max")));
    return this;
  }
  /**
   * Armée et niveaux du compte : garnison, recherches, ponte, TdC, places.
   *
   * @private
   * @method _parametresReels
   */
  _parametresReels() {
    // un niveau inconnu vaut -1 dans le profil : compté 0, comme les champs
    let niveau = (n) => Math.max(0, n || 0);
    return {
      unites: this._armee.unite.slice(),
      armes: niveau(monProfil.niveauRecherche[2]),
      bouclier: niveau(monProfil.niveauRecherche[1]),
      vitesse: niveau(monProfil.niveauRecherche[5]),
      couveuse: niveau(monProfil.niveauConstruction[3]),
      solarium: niveau(monProfil.niveauConstruction[4]),
      ponte: niveau(monProfil.niveauRecherche[0]),
      tdcLancement: niveau(Utils.terrain),
      nombreMax: Math.max(0, this._nbChasse || 0),
    };
  }
  /**
   * Remplit la section « Armée et niveaux » avec les valeurs du compte.
   *
   * @private
   * @method _remplirParametres
   */
  _remplirParametres() {
    let P = this._parametresReels();
    $("input[name='o_cpUnite']").each((_, elt) =>
      $(elt).spinner("value", P.unites[$(elt).data("i")]),
    );
    for (let [id, cle] of [
      ["#o_cpArmes", "armes"],
      ["#o_cpBouclier", "bouclier"],
      ["#o_cpVitesse", "vitesse"],
      ["#o_cpCouveuse", "couveuse"],
      ["#o_cpSolarium", "solarium"],
      ["#o_cpPonte", "ponte"],
      ["#o_cpTdcLancement", "tdcLancement"],
      ["#o_cpPlaces", "nombreMax"],
    ])
      $(id).spinner("value", P[cle]);
    this._majParametres();
    return this;
  }
  /**
   * Armée et niveaux saisis dans la section « Armée et niveaux ».
   *
   * @private
   * @method _parametres
   */
  _parametres() {
    let valeur = (id) => $(id).spinner("value") || 0,
      unites = new Array(14).fill(0);
    $("input[name='o_cpUnite']").each((_, elt) => (unites[$(elt).data("i")] = valeur(elt)));
    return {
      unites,
      armes: valeur("#o_cpArmes"),
      bouclier: valeur("#o_cpBouclier"),
      vitesse: valeur("#o_cpVitesse"),
      couveuse: valeur("#o_cpCouveuse"),
      solarium: valeur("#o_cpSolarium"),
      ponte: valeur("#o_cpPonte"),
      tdcLancement: valeur("#o_cpTdcLancement"),
      nombreMax: valeur("#o_cpPlaces"),
    };
  }
  /**
   * Vrai quand la section « Armée et niveaux » ne reflète plus le compte :
   * la salve calculée ne peut pas partir.
   *
   * @private
   * @method _parametresModifies
   */
  _parametresModifies() {
    return JSON.stringify(this._parametres()) != JSON.stringify(this._parametresReels());
  }
  /**
   * Après un changement de paramètres : JSN à garder bornées par l'armée saisie.
   *
   * @private
   * @method _majParametres
   */
  _majParametres() {
    let jsn = this._parametres().unites[0];
    $("#o_chasseJSN").spinner("option", "max", jsn);
    if ($("#o_chasseJSN").spinner("value") > jsn) $("#o_chasseJSN").spinner("value", jsn);
    $("#o_chasseJSNMax").text(numeral(jsn).format());
    $("#o_chasseNbr").spinner("option", "max", Math.max(1, this._parametres().nombreMax));
    return this;
  }
  /**
   * Un champ calculé qu'on touche devient fixé (sauf verrouillé par nombre et
   * terrain fixés) : sa case Auto se décoche, la valeur affichée reste.
   *
   * @private
   * @method _fixerAuClic
   * @param {String} id du champ
   * @param {Object} cases id du champ → sélecteur de sa case Auto
   */
  _fixerAuClic(id, cases) {
    let $case = $(cases[id]);
    if (!$case.length || !$case.is(":checked") || $case.prop("disabled")) return;
    $case.prop("checked", false);
    this._majVerrous(cases[id].slice(1));
    this._sauverReglages();
    this.preparerChasse();
  }
  /**
   * Cases « Auto », champs et cible 🎯 : ce qui est fixé se saisit, le reste
   * s'affiche, et la cible marque ce que le lanceur optimise (le rendement, ou
   * les pertes quand le rendement est fixé).
   * Nombre et terrain fixés déterminent tout, le reste passe en Auto ; la
   * difficulté ne peut être libre que si un coût est fixé (pertes acceptées ou
   * rendement), sinon le lanceur descendrait au plancher quoi qu'il en coûte.
   *
   * @private
   * @method _majVerrous
   * @param {String} declencheur id de la case qui vient de changer
   */
  _majVerrous(declencheur = "") {
    let auto = (id) => $(id).is(":checked"),
      tout = !auto("#o_chasseNbrAuto") && !auto("#o_chasseTDCRepAuto");
    for (let id of ["#o_chasseDiffAuto", "#o_chasseBudgetAuto", "#o_chasseRendementAuto"]) {
      if (tout) $(id).prop("checked", true);
      $(id).prop("disabled", tout);
    }
    if (
      !tout &&
      auto("#o_chasseDiffAuto") &&
      auto("#o_chasseBudgetAuto") &&
      auto("#o_chasseRendementAuto")
    ) {
      if (declencheur == "o_chasseDiffAuto") {
        $("#o_chasseBudgetAuto").prop("checked", false);
        $("#o_chasseBudget").spinner("value", this.reglagesLanceur.budget);
      } else $("#o_chasseDiffAuto").prop("checked", false);
    }
    // calculé : en lecture seule et grisé, mais cliquable (un clic le fixe)
    for (let [champ, id] of [
      ["#o_chasseNbr", "#o_chasseNbrAuto"],
      ["#o_chasseTDCRep", "#o_chasseTDCRepAuto"],
      ["#o_chasseBudget", "#o_chasseBudgetAuto"],
      ["#o_chasseRendement", "#o_chasseRendementAuto"],
      ["#o_chasseDiff", "#o_chasseDiffAuto"],
    ])
      $(champ)
        .prop("readonly", auto(id))
        .parent(".ui-spinner")
        .toggleClass("o_chasseCalcule", auto(id));
    // la cible : le rendement, ou les pertes quand le rendement est fixé
    $("#o_chasseCibleRendement").toggle(!tout && auto("#o_chasseRendementAuto"));
    $("#o_chasseCiblePertes").toggle(!tout && !auto("#o_chasseRendementAuto"));
    return this;
  }
  /**
   * Calcule les données de la chasse en fonction des valeurs souhaitées par le joueur.
   *
   * @private
   * @method preparerChasse
   */
  preparerChasse() {
    let tdcArrivee = $("#o_chasseTDCDep").spinner("value"),
      auto = (id) => $(id).is(":checked"),
      valeur = (id) => $(id).spinner("value") || 0,
      autoNb = auto("#o_chasseNbrAuto"),
      autoTerrain = auto("#o_chasseTDCRepAuto"),
      autoRatio = auto("#o_chasseDiffAuto"),
      autoBudget = auto("#o_chasseBudgetAuto"),
      autoRendement = auto("#o_chasseRendementAuto"),
      ratioChoisi = valeur("#o_chasseDiff"),
      R = this.reglagesLanceur,
      P = (this._parametresSimu = this._parametres()),
      tempsPonte = SimulationChasse.tempsPonte(P.couveuse + P.solarium + P.ponte),
      fmt = (v, d = 0) => numeral(v).format(d ? "0,0." + "0".repeat(d) : "0,0"),
      unites = P.unites.slice();
    if (!tdcArrivee) return;
    // JSN gardées à la fourmilière
    unites[0] = Math.max(0, unites[0] - valeur("#o_chasseJSN"));
    let p = {
        unites,
        armes: P.armes,
        bouclier: P.bouclier,
        tdcLancement: P.tdcLancement,
        tdcArrivee,
        nombreMax: P.nombreMax,
        vitesse: P.vitesse,
        tempsPonte,
        nombre: autoNb ? 0 : valeur("#o_chasseNbr"),
        terrain: autoTerrain ? 0 : valeur("#o_chasseTDCRep"),
        ratio: autoRatio ? 0 : ratioChoisi,
        budget: autoBudget ? 0 : valeur("#o_chasseBudget") / 100,
        rendement: autoRendement ? 0 : valeur("#o_chasseRendement") / 3600,
        facteur: R.marge,
        reequilibrer: R.reequilibrer,
      },
      plan = this._armee.resoudreChasse(p),
      alertes = [];
    // difficulté choisie hors de portée : comme avant, on redescend à ce que
    // l'armée peut tenir (une chasse de 1 cm²), la liste suit
    if (plan && plan.erreur == "ratio" && !autoRatio)
      plan = this._armee.resoudreChasse({
        ...p,
        ratio: 0,
        nombre: p.nombre || 1,
        terrain: p.terrain || 1,
      });
    this._simu = plan && !plan.erreur ? plan : null;
    $("#o_chasseEnvoyer, #o_chasseEnvoyerPartager").prop(
      "disabled",
      !this._simu || this._parametresModifies(),
    );
    if (!this._simu) {
      this._alerter([
        !plan
          ? P.nombreMax < 1
            ? "Aucune chasse possible pour l'instant (toutes les places sont prises)."
            : "Aucune unité d'attaque à envoyer."
          : plan.erreur == "budget"
            ? "Pertes acceptées trop faibles : même 1 cm² coûte davantage."
            : plan.erreur == "plancher"
              ? `Armée trop faible pour ce TdC : la difficulté ${SimulationChasse.RATIO_PLANCHER} ne tient même pas sur 1 cm².`
              : "Rien ne borne le coût : fixe la difficulté, les pertes acceptées ou le rendement.",
      ]);
      $("#o_simulationChasse").empty();
      $("#o_chasseLimite").text("");
      return;
    }
    if (autoNb) $("#o_chasseNbr").spinner("value", plan.nombre);
    if (autoTerrain) $("#o_chasseTDCRep").spinner("value", plan.terrain);
    if (autoBudget) $("#o_chasseBudget").spinner("value", Math.round(plan.budget * 1000) / 10);
    if (autoRendement) $("#o_chasseRendement").spinner("value", Math.round(plan.rendement * 3600));
    // l'heure de retour suit le terrain par chasse
    this._dateAffichee = Utils.roundMinute(plan.duree).format("DD-MM-YYYY HH:mm");
    $("#o_chasseDateArrivee").val(this._dateAffichee);
    $("#o_chasseBudgetInfo").text(`≈ ${fmt((plan.budget * 86400) / tempsPonte)} JSN / jour`);
    $("#o_chasseRendementInfo").text(`≈ ${fmt(plan.rendement * 86400)} cm² / jour`);
    this.majSimulation(this._armee.repartition, unites);
    this.majRecapitulatif(plan);
    // Difficulté calculée (ratio atteint), ou redescendue si l'armée ne tient
    // pas celle choisie (ou si nombre et terrain sont fixés à la main) ; sinon
    // la valeur saisie reste
    if (autoRatio || plan.ratio < ratioChoisi - 0.0001) {
      $("#o_chasseDiff").spinner("value", Math.round(plan.ratio * 100) / 100);
      this._majCouleurDiff();
    }
    this._majInfoDiff(plan, tdcArrivee, ratioChoisi, autoNb && autoTerrain, autoRatio);
    this.mettreAjourPertesTdc();
    let infos = [];
    if (plan.plafonne)
      alertes.push(
        `Difficulté plafonnée à ${SimulationChasse.RATIO_PLANCHER} : pertes ${fmt(100 * plan.budget, 1)} % seulement.`,
      );
    if (plan.infaisable)
      alertes.push(`Rendement inatteignable : au mieux ${fmt(plan.rendement * 3600)} cm² / h.`);
    // tampon de chaque chasse en multiples de ses pertes max, JSN seules puis
    // avec les SN et NE (ordre de mort JSN → SN → NE → JS…) : sous × 1 avec
    // tout, les unités chères sont exposées ; sous × 1 en JSN seules, ce sont
    // des SN ou NE qui peuvent mourir ; sous la marge, simple information
    let pv = (u) => VIE_UNITE[u + 1] / VIE_UNITE[1],
      couvJsn = plan.chasses.map((c) => (c.pertes.MAX > 0 ? c.unites[0] / c.pertes.MAX : Infinity)),
      couvTout = plan.chasses.map((c) =>
        c.pertes.MAX > 0
          ? (c.unites[0] + c.unites[1] * pv(1) + c.unites[2] * pv(2)) / c.pertes.MAX
          : Infinity,
      ),
      liste = (couv) =>
        couv
          .map((x, i) => (x < 0.995 ? `${i + 1} (× ${fmt(x, 2)})` : null))
          .filter(Boolean)
          .join(", "),
      exposees = liste(couvTout),
      entamees = liste(couvJsn);
    if (exposees)
      alertes.push(`Unités chères exposées (JSN + SN + NE < pertes max) : chasses ${exposees}.`);
    else if (entamees)
      infos.push(
        `SN/NE exposées (JSN < pertes max) : chasses ${entamees}. Avec SN et NE : × ${fmt(Math.min(...couvTout), 2)} au moins.`,
      );
    else if (Math.min(...couvJsn) < R.marge - 0.005)
      infos.push(
        `Tampon JSN × ${fmt(Math.min(...couvJsn), 2)} des pertes max (max × ${fmt(R.marge, 2)} : ${fmt(unites[0])} JSN pour ${fmt(plan.pertes.MAX)} de pertes max).`,
      );
    if (this._parametresModifies())
      alertes.push(
        "Simulation seulement : armée ou niveaux modifiés (« Rétablir mes valeurs » pour lancer).",
      );
    this._alerter(alertes, infos);
  }
  /**
   * Affiche les alertes (en rouge) et les informations sous le formulaire.
   *
   * @private
   * @method _alerter
   */
  _alerter(alertes, infos = []) {
    $("#o_chasseAlerte").html(
      [
        ...alertes.map((t) => `<span class='red gras'>${t}</span>`),
        ...infos.map((t) => `<span class='small'>${t}</span>`),
      ].join("<br/>"),
    );
  }
  /**
   * Taux de réplique à 10 % d'un ratio de référence, pour les libellés.
   *
   * @private
   * @method _replique
   */
  _replique(i) {
    return REPLIQUE_CHASSE[i] >= 0.2 ? (100 * REPLIQUE_CHASSE[i]).toFixed(2) + "%" : "< 20%";
  }
  /**
   * À côté de la difficulté : le ratio de référence des tables (celui du
   * dessous) et son taux de réplique à 10 %, et pourquoi la valeur a changé.
   * Même une chasse de 1 cm² a une difficulté minimale, qui croît avec le TdC
   * (formule de Calystene) : au-delà de attaque / difficulté minimale, aucun
   * nombre ni aucun terrain ne tient le ratio.
   *
   * @private
   * @method _majInfoDiff
   * @param {Object} plan résultat de la simulation
   * @param {Number} tdcArrivee TdC à l'arrivée des chasses
   * @param {Number} choisi ratio saisi avant le calcul
   * @param {Boolean} auto nombre et terrain calculés par le lanceur
   * @param {Boolean} libre difficulté calculée elle aussi (pertes acceptées ou rendement fixés)
   */
  _majInfoDiff(plan, tdcArrivee, choisi, auto, libre = false) {
    let max = plan.attArmee / SimulationChasse.difficulte(Math.max(1, tdcArrivee), 1),
      info = `réf. ${RATIO_CHASSE[plan.indexRef].toFixed(1)}, Rep10% : ${this._replique(plan.indexRef)}`;
    if (libre) info += " — au plus bas que les pertes acceptées ou le rendement permettent.";
    else if (!auto) info += " — nombre ou terrain fixé : la difficulté en découle.";
    else if (choisi > max + 0.0001)
      info += ` — ${numeral(choisi).format("0.0")} impossible, max ${numeral(max).format("0.00")} avec cette armée (une chasse de 1 cm²).`;
    $("#o_chasseDiffInfo").text(info);
  }
  /**
   * Met à jour la couleur du champ Difficulté selon le seuil de ratio.
   *
   * @private
   * @method _majCouleurDiff
   */
  _majCouleurDiff() {
    let value = $("#o_chasseDiff").spinner("value") || 0,
      color = value <= 4 ? "black" : value <= 6 ? "red" : value <= 7.5 ? "orange" : "green";
    $("#o_chasseDiff").css("color", color);
  }
  /**
   * Fixe le terrain par chasse pour qu'une chasse parte maintenant et revienne
   * à la date saisie. Inverse de `temps = (Utils.terrain + terrain) × 0.9^niveau`
   * (SimulationChasse.duree).
   *
   * @private
   * @method terrainDepuisDate
   */
  terrainDepuisDate() {
    let raw = $("#o_chasseDateArrivee").val();
    // datetimepicker redéclenche `change` au blur : seule une valeur différente
    // de celle affichée par la simulation est une saisie
    if (!raw || raw === this._dateAffichee) return;
    let target = moment(raw, "DD-MM-YYYY HH:mm");
    if (!target.isValid()) return;
    let secondsLeft = target.diff(Horloge.serveur(), "seconds"),
      P = this._parametres(),
      terrain = Math.round(secondsLeft / Math.pow(0.9, P.vitesse) - P.tdcLancement);
    if (terrain <= 0) {
      this._alerter([secondsLeft <= 0 ? "Date de retour passée." : "Retour trop tôt."]);
      return;
    }
    $("#o_chasseTDCRepAuto").prop("checked", false);
    $("#o_chasseTDCRep").spinner("enable").spinner("value", terrain);
    this._majVerrous("o_chasseTDCRepAuto");
    this.preparerChasse();
  }
  /**
   * Met à jour la table "Pertes selon TdC à l'arrivée" en réutilisant les paramètres
   * courants (nb chasses, terrain par chasse, difficulté) mais en faisant varier
   * uniquement le tdcDep sur les valeurs saisies par l'utilisateur. Affiche aussi
   * la variation moyenne par rapport au tdcDep courant.
   *
   * @private
   * @method mettreAjourPertesTdc
   */
  mettreAjourPertesTdc() {
    let simu = this._simu,
      tdcCourant = $("#o_chasseTDCDep").spinner("value");
    if (!simu) return;
    let pertesA = (tdc) =>
        SimulationChasse.pertesAutreTdc(
          simu.attArmee,
          tdcCourant,
          tdc,
          simu.terrain,
          simu.nombre,
          simu.indexRef,
          (this._parametresSimu || this._parametresReels()).bouclier,
        ),
      curPertes = simu.pertes;
    // Ligne 0 = référence (TdC courant, miroir live de #o_chasseTDCDep)
    $("#o_otherHfRefValue").text(numeral(tdcCourant).format());
    $(".o_otherHfMin[data-idx='0']").text(numeral(Math.round(curPertes.MIN)).format());
    $(".o_otherHfAvg[data-idx='0']").text(numeral(Math.round(curPertes.AVG)).format());
    $(".o_otherHfMax[data-idx='0']").text(numeral(Math.round(curPertes.MAX)).format());
    // Lignes 1..10 = alternatives, variation calculée vs ligne 0
    $(".o_otherHfInputAlt").each((_, el) => {
      let $el = $(el),
        i = $el.data("idx"),
        p = pertesA($el.spinner("value") || 0);
      $(`.o_otherHfMin[data-idx='${i}']`).text(numeral(Math.round(p.MIN)).format());
      $(`.o_otherHfAvg[data-idx='${i}']`).text(numeral(Math.round(p.AVG)).format());
      $(`.o_otherHfMax[data-idx='${i}']`).text(numeral(Math.round(p.MAX)).format());
      let varAvg = curPertes.AVG > 0 ? ((p.AVG - curPertes.AVG) / curPertes.AVG) * 100 : 0,
        sign = varAvg >= 0 ? "+" : "",
        cls = varAvg > 0.5 ? "red" : varAvg < -0.5 ? "green" : "";
      $(`.o_otherHfVar[data-idx='${i}']`).html(
        `<span class='${cls}'>${sign}${varAvg.toFixed(1)} %</span>`,
      );
    });
  }
  /**
   * Affiche la répartition des unités pour les chasses.
   *
   * @private
   * @method majSimulation
   * @param {Array} repartition
   * @param {Array} unites armée simulée (colonnes affichées)
   */
  majSimulation(repartition, unites = this._armee.unite) {
    let simulation = `<tr class='gras'><td>Chasse</td>${NOM_RAC_UNITE.slice(1)
      .map((nom, j) => (unites[j] ? `<td>${nom}</td>` : ""))
      .join("")}</tr>`;
    for (let i = 0, l = repartition.length; i < l; i++) {
      simulation += `<tr><td>${i + 1}</td>`;
      for (
        let j = -1;
        ++j < 14;
        simulation += unites[j]
          ? "<td class='small' nowrap>" +
            (repartition[i][j] ? numeral(repartition[i][j]).format() : "") +
            "</td>"
          : ""
      );
      simulation += `</tr>`;
    }
    $("#o_simulationChasse").html(simulation);
    $("#o_simulationChasse tr:even").addClass("ligne_paire");
  }
  /**
   * Affiche le compte rendu de la simulation.
   *
   * @private
   * @method majRecapitulatif
   * @param {Object} plan résultat d'Armee.resoudreChasse
   */
  majRecapitulatif(plan) {
    let nbChasse = plan.nombre,
      terrainChasse = plan.terrain,
      temps = plan.duree;
    $("#o_chasseTotal").html(
      nbChasse +
        " x " +
        numeral(terrainChasse).format() +
        " = <span class='green'>" +
        numeral(nbChasse * terrainChasse).format() +
        "</span> cm²",
    );
    $("#o_chasseTemps").text(Utils.intToTime(temps));
    let dateLong = Utils.roundMinute(temps).format("dddd D MMM YYYY [à] HH[h]mm");
    $("#o_chasseRetour").text(dateLong.charAt(0).toUpperCase() + dateLong.slice(1));
    $("#o_chasseRentabilite").text(
      numeral(Math.round(plan.rendement * 3600)).format() +
        " cm² / h (" +
        numeral(Math.round(plan.rendement * 86400)).format() +
        " / jour)",
    );
    $("#o_chasseRefDiff").text(
      numeral(plan.ratio).format("0.00") + " ~ " + RATIO_CHASSE[plan.indexRef].toFixed(1),
    );
    $("#o_chassePerte").text(
      numeral(Math.round(plan.pertes.AVG)).format() +
        " JSN (max : " +
        numeral(Math.round(plan.pertes.MAX)).format() +
        "), " +
        numeral(100 * plan.budget).format("0.0") +
        " % du temps de ponte",
    );
    $("#o_chasseLimite").text(
      {
        fixe: "nombre et terrain fixés",
        ratio: "la difficulté choisie",
        budget: "les pertes acceptées",
        plancher: `la difficulté plancher ${SimulationChasse.RATIO_PLANCHER}`,
        rendement: "le rendement demandé",
      }[plan.limite] || "",
    );
  }
  /**
   * Ajoute les boutons "max", sauvegarde la chasse en cours.
   *
   * @private
   * @method plus
   */
  plus() {
    // Ajout des boutons pour l'affectation max
    $("#RecolteNourriture").after(
      "<a title='Affecter un maximum d’ouvrière à la nourriture' class='button_max' onclick='javascript:maxNourriture();' href='#max'><img class='o_vAlign' width='23' height='23' src='images/bouton/fleche_haut.gif'/></a>",
    );
    $("#RecolteMateriaux").after(
      "<a title='Affecter un maximum d’ouvrière aux matériaux' class='button_max' onclick='javascript:maxMateriaux();' href='#max'><img class='o_vAlign' width='23' height='23' src='images/bouton/fleche_haut.gif'/></a>",
    );
    // Hors C+ le formulaire du jeu envoie chasser toute l'armée du terrain de
    // chasse : on la mémorise pour la compter tant qu'elle est dehors. Elle
    // est relue juste avant l'envoi (elle a pu bouger depuis le chargement de
    // la page, une valeur périmée compterait des troupes fantômes), puis le
    // formulaire est renvoyé tel quel, quoi qu'il arrive à la lecture.
    let formChasse = $("form[action='AcquerirTerrain.php']"),
      armeeLue = false;
    formChasse.on("submit", (e) => {
      if (armeeLue || !(numeral($("#AcquerirTerrain").val()).value() > 0)) return;
      e.preventDefault();
      armeeLue = true;
      let bouton = e.originalEvent && e.originalEvent.submitter;
      Promise.resolve(new Armee().getArmee())
        .then((data) => TroupesDehors.enregistrerChasse(new Armee().chargeData(data, 1).unite))
        .catch(() => {})
        .finally(() => formChasse[0].requestSubmit(bouton || undefined));
    });
    // Affichage du retour des chasses
    let listeChasse = new Array();
    $("span[id^=chasse_]").each((i, elt) => {
      listeChasse.push({
        quantite: numeral($(elt).parent().text().split("conquérir")[1].split("cm²")[0]).value(),
        exp: moment().add($(elt).parent().next().text().split("reste(")[1].split(",")[0], "s"),
      });
      $(elt)
        .parent()
        .next()
        .after(
          "<span class='small'> Retour le " +
            Utils.roundMinute($(elt).parent().next().text().split(",")[0].split("(")[1]).format(
              "D MMM YYYY à HH[h]mm",
            ) +
            "</span>",
        );
    });
    // Sauvegarde de la chasse en cours, y compris quand il n'y en a plus
    // (annulée) pour vider la boîte
    this.saveChasse(listeChasse);
  }
  /**
   * Choix du mode d'affectation automatique des ouvrières sur la page, et
   * application du mode enregistré. Pour tous les comptes : en C+ le jeu
   * propose nativement Matériaux / Nourriture, mais pas le ratio.
   *
   * @private
   * @method affectation
   */
  affectation() {
    let affection = parseInt(monProfil.parametre["affectationRessource"].valeur),
      ratio = parseInt(monProfil.parametre["ratioRecolte"].valeur),
      // la part en nourriture est saisissable au clavier, celle en matériaux
      // en découle ; les deux suivent le curseur
      libelleRatio = (r) =>
        `<input id="o_ratioRecoltePart" class="o_sliderValeur" type="text" value="${r}"/> % <img alt="nourriture" src="images/icone/icone_pomme.png" height="14" class="o_vAlign"/> nourriture, <span id="o_ratioRecolteReste" class="gras">${100 - r} %</span> <img alt="matériaux" src="images/icone/icone_bois.png" height="13" class="o_vAlign"/> matériaux`,
      majRatio = (r) => {
        $("#o_ratioRecoltePart").spinner("value", r);
        $("#o_ratioRecolteReste").text(`${100 - r} %`);
      };
    // Ajout de la pref pour l'affectation auto.
    // C+ : le jeu a déjà sa rangée « Affectation automatique des ouvrières »
    // (radios choixOuvriere, envoyées au serveur). On y ajoute un choix
    // « Ratio » dans le même groupe pour garder une seule sélection. Sa valeur
    // est « rien », comme la croix : le jeu enregistre « pas d'affectation
    // automatique » (sinon il replacerait les ouvrières libres d'un seul côté
    // entre deux visites) et Toolzzz garde le mode Ratio de son côté. Le
    // radio est reconnu par son id, pas par sa valeur.
    // Non-C+ : rangée Toolzzz complète, avec un nom de groupe qui lui est propre.
    let ligneRatio = `<tr id="o_ratioRecolte" style="display:none;">
            <td><span class="text"><img src="images/icone/favicon.gif" height="16"> Répartition : <span id="o_ratioRecolteValeur">${libelleRatio(ratio)}</span></span></td>
            <td><div id="o_ratioRecolteCurseur" class="slider" style="width:150px;margin:6px 0;"></div></td>
        </tr>`;
    if (Utils.comptePlus) {
      // état enregistré côté serveur, lu avant d'ajouter notre radio
      let natifCoche = $("input[name=choixOuvriere]:checked").val();
      $("input[name=choixOuvriere][value=rien]")
        .closest("label")
        .before(
          `<label title="Répartir les ouvrières entre nourriture et matériaux selon une part fixe, préparée à chaque consultation de la page : clique sur Valider pour l'enregistrer (${NOM_EXTENSION})"><input type="radio" name="choixOuvriere" value="rien" id="o_ratioRadio"> Ratio</label> `,
        );
      // L'exclusion mutuelle des radios se fait par formulaire propriétaire, pas
      // par position dans le DOM : inséré dynamiquement, notre radio n'en a
      // aucun (le HTML du jeu ferme son <form> avant cette cellule) et forme
      // donc un groupe à part, où il reste coché en même temps qu'un choix
      // natif. On le rattache explicitement au formulaire des radios du jeu,
      // ce qui rétablit l'exclusion et l'envoi de sa valeur (« rien »).
      let formNatif = $("input[name=choixOuvriere]").not("#o_ratioRadio")[0].form;
      if (formNatif) {
        if (!formNatif.id) formNatif.id = "o_formRessource";
        $("#o_ratioRadio").attr("form", formNatif.id);
      }
      // Le mode Ratio soumet toujours « rien » au jeu : si le serveur a
      // enregistré autre chose, c'est que l'affectation native a été choisie
      // depuis, on abandonne le ratio. Sans ce recalage, un ratio mémorisé
      // recocherait Ratio à chaque chargement et rendrait les autres choix
      // impossibles à conserver.
      if (affection == 3 && natifCoche && natifCoche != "rien") {
        affection = 0;
        monProfil.parametre["affectationRessource"].valeur = 0;
        monProfil.parametre["affectationRessource"].sauvegarde();
      }
      if (affection == 3) $("#o_ratioRadio").prop("checked", true);
      $("input[name=choixOuvriere]").closest("tr").after(ligneRatio);
    } else
      $("#ChangeRessource").parent().parent().before(`<tr>
            <td><span class="text"><img src="images/icone/favicon.gif" height="16"> Affectation des ouvrières préparée à l'ouverture de la page : </span></td>
            <td class="o_affectationChoix" style="white-space:nowrap;"><label><input type="radio" name="o_choixOuvriere" value="nourriture" ${affection == 2 ? 'checked="checked"' : ""}><img alt="nourritures" src="images/icone/icone_pomme.png" height="18" title="Nourriture"></label>
            <label><input type="radio" name="o_choixOuvriere" value="materiaux" ${affection == 1 ? 'checked="checked"' : ""}> <img alt="materiaux" src="images/icone/icone_bois.png" height="17" title="Materiaux"></label>
            <label title="Répartir les ouvrières entre nourriture et matériaux selon une part fixe, conservée après une chasse ou un flood"><input type="radio" name="o_choixOuvriere" value="ratio" ${affection == 3 ? 'checked="checked"' : ""}> Ratio</label>
            <label><input type="radio" name="o_choixOuvriere" value="rien" ${affection == 0 ? 'checked="checked"' : ""}> <img alt="rien" src="images/croix.gif" height="23" title="Pas d'affectation automatique"></label>
        </td></tr>${ligneRatio}`);
    $("#o_ratioRecolte").toggle(affection == 3);
    $("#o_ratioRecoltePart").spinner({ min: 0, max: 100, numberFormat: "i" });
    // Un réglage du ratio n'est qu'un aperçu dans les champs du jeu : il est
    // enregistré avec eux par le bouton du jeu, qui recharge la page. Appliqué
    // à chaque changement, il rechargeait la page à chaque clic sur une flèche.
    let apercuRatio = (r) => {
      ratio = r;
      majRatio(ratio);
      let repartition = this.repartitionRatio(ratio);
      $("#RecolteMateriaux").val(repartition.materiaux);
      $("#RecolteNourriture").val(repartition.nourriture);
    };
    $("#ChangeRessource").on("click", () => {
      if (monProfil.parametre["affectationRessource"].valeur != 3) return;
      monProfil.parametre["ratioRecolte"].valeur = ratio;
      monProfil.parametre["ratioRecolte"].sauvegarde();
    });
    // Le pas jQuery UI reste à 1 : avec un pas de 10, une valeur fine posée
    // depuis le champ serait arrondie. Le glissement à la souris est filtré
    // sur les multiples de 10 pour garder un curseur rapide ; le clavier sur
    // la poignée garde la précision.
    $("#o_ratioRecolteCurseur").slider({
      min: 0,
      max: 100,
      step: 1,
      value: ratio,
      slide: (e, ui) => {
        if (ui.value % 10 && !(e.originalEvent && e.originalEvent.type == "keydown")) return false;
        majRatio(ui.value);
      },
      // seulement sur action de l'utilisateur : une valeur posée depuis le
      // champ est appliquée par le champ
      change: (e, ui) => {
        if (e.originalEvent) apercuRatio(ui.value);
      },
    });
    // saisie au clavier : prise en compte à la sortie du champ ou avec les flèches
    $("#o_ratioRecoltePart").on("spinstop change", (e) => {
      let v = Math.min(100, Math.max(0, parseInt($(e.currentTarget).val()) || 0));
      $("#o_ratioRecolteCurseur").slider("value", v);
      apercuRatio(v);
    });
    if (Utils.comptePlus)
      // sur "click" et non "change" : le jeu peut réagir au changement en
      // rechargeant la page, l'écriture du paramètre doit être faite avant.
      // On identifie notre radio par son id, sa valeur étant « rien » comme
      // celle de la croix native.
      $("input[name=choixOuvriere]").on("click", (e) => {
        let actif = e.currentTarget.id == "o_ratioRadio";
        // un choix natif (nourriture, matériaux, rien) désactive le ratio Toolzzz
        monProfil.parametre["affectationRessource"].valeur = actif ? 3 : 0;
        monProfil.parametre["affectationRessource"].sauvegarde();
        $("#o_ratioRecolte").toggle(actif);
        // soumission même si la répartition est déjà bonne : le jeu doit
        // enregistrer « rien » pour son affectation automatique
        if (actif) this.affecterOuvrieres(3, ratio, true);
      });
    else
      $("input[name=o_choixOuvriere]").change(() => {
        switch ($("input[name=o_choixOuvriere]:checked").val()) {
          case "nourriture":
            monProfil.parametre["affectationRessource"].valeur = 2;
            break;
          case "materiaux":
            monProfil.parametre["affectationRessource"].valeur = 1;
            break;
          case "ratio":
            monProfil.parametre["affectationRessource"].valeur = 3;
            break;
          default:
            monProfil.parametre["affectationRessource"].valeur = 0;
            break;
        }
        monProfil.parametre["affectationRessource"].sauvegarde();
        $("#o_ratioRecolte").toggle(monProfil.parametre["affectationRessource"].valeur == 3);
        // le ratio s'affiche dans les champs du jeu, à enregistrer avec son
        // bouton ; les autres modes agissent à la prochaine consultation
        if (monProfil.parametre["affectationRessource"].valeur == 3) apercuRatio(ratio);
        return false;
      });
    // Affectation des ouvrières inutilisées si on a la pref. Règlement du s5 :
    // rien ne part sans clic du joueur. À l'ouverture de la page, la
    // répartition est seulement préparée dans le formulaire du jeu ; le joueur
    // l'enregistre avec le bouton du jeu.
    if (affection) this.affecterOuvrieres(affection, ratio, false, false);
  }
  /**
   * Affecte les ouvrières selon le mode choisi et soumet le formulaire du jeu
   * si quelque chose change. Matériaux / Nourriture complètent seulement les
   * ouvrières inutilisées ; Ratio impose la répartition.
   *
   * @private
   * @method affecterOuvrieres
   * @param {Integer} mode 1 matériaux, 2 nourriture, 3 ratio
   * @param {Integer} ratio part en nourriture (%) pour le mode 3
   * @param {Boolean} forcer soumettre même si la répartition ne change pas
   * @param {Boolean} soumettre faux : remplit le formulaire sans l'envoyer
   */
  affecterOuvrieres(mode, ratio, forcer = false, soumettre = true) {
    const CLE_TENTATIVE = "outiiil_affectationTentee";
    let materiaux = numeral($("#RecolteMateriaux").val()).value(),
      nourriture = numeral($("#RecolteNourriture").val()).value(),
      affectables = Math.min(Utils.ouvrieres, Utils.terrain),
      nouveauMateriaux = materiaux,
      nouvelleNourriture = nourriture;
    if (mode == 3) {
      let repartition = this.repartitionRatio(ratio);
      nouvelleNourriture = repartition.nourriture;
      nouveauMateriaux = repartition.materiaux;
    } else if (materiaux + nourriture < affectables) {
      // si on ne couvre pas le terrain et qu'on a assez d'ouvrières
      if (mode == 1) nouveauMateriaux = affectables - nourriture;
      else if (mode == 2) nouvelleNourriture = affectables - materiaux;
    }
    if (nouveauMateriaux == materiaux && nouvelleNourriture == nourriture && !forcer) {
      sessionStorage.removeItem(CLE_TENTATIVE);
      return;
    }
    if (!soumettre) {
      $("#RecolteMateriaux").val(nouveauMateriaux);
      $("#RecolteNourriture").val(nouvelleNourriture);
      $("#ChangeRessource").addClass("o_synchroPret");
      $.toast({
        ...TOAST_INFO,
        text: "Affectation des ouvrières préparée : clique sur le bouton du jeu pour l'enregistrer.",
      });
      return;
    }
    // la soumission recharge la page : si le jeu n'a pas appliqué la valeur
    // demandée on ne retente pas, sinon la page rechargerait en boucle
    if (sessionStorage.getItem(CLE_TENTATIVE)) {
      sessionStorage.removeItem(CLE_TENTATIVE);
      $.toast({
        ...TOAST_WARNING,
        text: "L'affectation automatique des ouvrières n'a pas été appliquée par le jeu.",
      });
      return;
    }
    sessionStorage.setItem(CLE_TENTATIVE, "1");
    this._rechargement = true;
    $("#RecolteMateriaux").val(nouveauMateriaux);
    $("#RecolteNourriture").val(nouvelleNourriture);
    $("#ChangeRessource").click();
  }
  /**
   * Ouvrières en nourriture et en matériaux pour une part `ratio` (%) en nourriture.
   *
   * @private
   * @method repartitionRatio
   */
  repartitionRatio(ratio) {
    let affectables = Math.min(Utils.ouvrieres, Utils.terrain),
      nourriture = Math.round((affectables * ratio) / 100);
    return { nourriture: nourriture, materiaux: affectables - nourriture };
  }
  /**
   * Sauvegarde la chasse en cours.
   *
   * @private
   * @method saveChasse
   */
  saveChasse(listeChasse) {
    if (!listeChasse.length) {
      if (this._boiteComptePlus.chasse.length) {
        this._boiteComptePlus.chasse = [];
        this._boiteComptePlus.startChasse = 0;
        this._boiteComptePlus.sauvegarder().majChasse();
      }
      return this;
    }
    if (
      !this._boiteComptePlus.hasOwnProperty("chasse") ||
      this._boiteComptePlus.chasse.length != listeChasse.length ||
      this._boiteComptePlus.chasse[0]["quantite"] != listeChasse[0]["quantite"] ||
      (listeChasse[0]["exp"].diff(this._boiteComptePlus.chasse[0]["exp"], "s") > 1 &&
        !Utils.comptePlus &&
        $("#boiteComptePlus").length)
    ) {
      this._boiteComptePlus.chasse = listeChasse;
      this._boiteComptePlus.startChasse = moment();
      this._boiteComptePlus.sauvegarder().majChasse();
    }
    return this;
  }
}
