// @ts-check
/*
 * ProfilConvois.js
 * Profil du joueur sur le site de suivi des convois de l'alliance (page « Mon
 * profil » du site) : niveaux de l'Étable à pucerons et de la Champignonnière,
 * nombre total d'ouvrières.
 **********************************************************************/

// par pseudo : jour, fait, essais, essai, raison, prevenu (jour du dernier
// avertissement), envoi {instant, site, ecrit, puceron, champignonniere, ouvrieres}
const CLE_PROFIL_CONVOIS = "fzzz_profilConvois";
const JOURNAL_PROFIL = "Profil du site de suivi";
// champ du profil du site → information du relevé des stats membres
const CHAMPS_PROFIL_CONVOIS = {
  etable_puceron: "puceron",
  champi: "champignonniere",
  ouvriere: "ouvrieres",
};
const NOMS_PROFIL_CONVOIS = {
  puceron: "étable",
  champignonniere: "champi",
  ouvrieres: "ouvrières",
};

/**
 * Une fois par jour, en même temps que le relevé des stats membres
 * (SuiviMembres, dont les lectures des pages Construction et Reine servent
 * aussi ici), et à la première page ouverte après un changement de niveau de
 * la Champignonnière ou de l'Étable à pucerons (observer), le profil du joueur
 * sur le site de suivi des convois reçoit ces deux niveaux et son nombre total
 * d'ouvrières, celles parties en convoi comprises (demande du mainteneur,
 * 19/11/2026). Seulement vers le site des réglages de l'alliance accepté par
 * le joueur, avec le mot de passe enregistré dans ce navigateur, et dans le
 * profil de ce pseudo ; la case « Je ne souhaite pas recevoir de convois » du
 * site est renvoyée telle qu'il la donne.
 *
 * Règles s5 : tout part d'une page ouverte par le joueur ; aucune minuterie,
 * aucune requête répétée.
 *
 * @class ProfilConvois
 */
class ProfilConvois {
  /**
   * @private
   * @static
   * @return {String}
   */
  static _pseudo() {
    return String(monProfil.pseudo || "").toLowerCase();
  }
  /**
   * @static
   * @method etat
   * @return {any} état du joueur dans ce navigateur, voir CLE_PROFIL_CONVOIS
   */
  static etat() {
    let e = Utils.lireStockage(CLE_PROFIL_CONVOIS)[ProfilConvois._pseudo()];
    return e && typeof e == "object" ? e : {};
  }
  /**
   * @private
   * @static
   * @param {any} etat
   */
  static _garder(etat) {
    let tous = Utils.lireStockage(CLE_PROFIL_CONVOIS);
    tous[ProfilConvois._pseudo()] = etat;
    try {
      localStorage.setItem(CLE_PROFIL_CONVOIS, JSON.stringify(tous));
    } catch (e) {}
  }
  /**
   * @static
   * @method texte
   * @param {Record<String, Number>} valeurs {puceron, champignonniere, ouvrieres}
   * @return {String} « étable 6, champi 20, ouvrières 68 031 »
   */
  static texte(valeurs) {
    return Object.keys(NOMS_PROFIL_CONVOIS)
      .map((c) => `${NOMS_PROFIL_CONVOIS[c]} ${numeral(valeurs[c]).format()}`)
      .join(", ");
  }
  /**
   * Niveau de la Champignonnière ou de l'Étable à pucerons changé depuis la
   * mise à jour du jour : elle est marquée à refaire, et lancer() la refait sur
   * cette page. Sans requête, comme SuiviMembres.observer(), avant lequel il
   * faut l'appeler : celui-ci oublie la construction suivie une fois finie.
   *
   * @static
   * @method observer
   */
  static observer() {
    if (!ProfilConvois._pseudo() || !Utils.alliance) return;
    let etat = ProfilConvois.etat();
    // mise à jour du jour pas encore faite : elle prendra les niveaux du moment
    if (!etat.envoi || etat.jour != SuiviMembres.jour() || !etat.fait) return;
    let changes = SuiviMembres.niveauxChanges(
      SuiviMembres.constructionVue(Horloge.maintenant()),
      etat.envoi,
      etat.envoi.instant,
    );
    if (!changes.length) return;
    Journal.info(
      JOURNAL_PROFIL,
      "niveau changé depuis la mise à jour du profil : à refaire",
      changes.map((c) => NOMS_PROFIL_CONVOIS[c]).join(" et "),
    );
    ProfilConvois._garder({ ...etat, fait: false, essais: 0, essai: 0 });
  }
  /**
   * Le joueur vient d'accepter le site ou d'enregistrer son mot de passe : la
   * mise à jour du jour se fait à la page suivante, sans attendre la pause
   * entre deux essais.
   *
   * @static
   * @method reprendre
   */
  static reprendre() {
    let etat = ProfilConvois.etat();
    if (ProfilConvois._pseudo() && etat.jour == SuiviMembres.jour())
      ProfilConvois._garder({ ...etat, fait: false, essais: 0, essai: 0, raison: "" });
  }
  /**
   * Mise à jour du profil, si elle reste à faire : appelé à chaque page
   * ouverte, après le relevé des stats membres. Il n'écrit quelque chose qu'à
   * la première page du jour, puis à celle où observer() a vu un niveau
   * changer (ou, après un échec, à une page ouverte au moins
   * SUIVI_PAUSE_ESSAIS plus tard, SUIVI_ESSAIS_PAR_JOUR fois au plus). Site
   * pas accepté ou mot de passe absent : rien n'est lu ni envoyé, le joueur
   * est prévenu une fois par jour.
   *
   * @static
   * @method lancer
   * @return {Promise<String>} "sans alliance", "sans site", "attente", "à régler",
   *   "à jour" (rien à changer sur le site), "envoyé" ou "échec"
   */
  static lancer() {
    let site = OuafSuivi.site();
    if (!ProfilConvois._pseudo() || !Utils.alliance) return Promise.resolve("sans alliance");
    if (!site) return Promise.resolve("sans site");
    // une lecture du jeu en cours retarderait un envoi réglé à la seconde
    if (Utils.pageSansAlertePonte(location)) return Promise.resolve("attente");
    let jour = SuiviMembres.jour(),
      instant = Horloge.maintenant(),
      etat = ProfilConvois.etat();
    // nouveau jour, ou profil mis à jour sur un autre site (réglages changés)
    if (etat.jour != jour || (etat.fait && !(etat.envoi && etat.envoi.site == site.origine)))
      etat = { envoi: etat.envoi, prevenu: etat.prevenu, jour, fait: false, essais: 0, essai: 0 };
    if (
      etat.fait ||
      etat.essais >= SUIVI_ESSAIS_PAR_JOUR ||
      instant - (etat.essai || 0) < SUIVI_PAUSE_ESSAIS
    )
      return Promise.resolve("attente");
    return Promise.all([OuafSuivi.siteAccepte(), OuafSuivi.codeEnregistre()]).then(
      ([accepte, code]) => {
        if (!accepte || !code) {
          ProfilConvois._garder(ProfilConvois._prevenir(etat, accepte ? "code" : "accepte", site));
          return "à régler";
        }
        // noté avant les lectures : une page quittée en route ne relance pas tout à la suivante
        etat = { ...etat, essais: (etat.essais || 0) + 1, essai: instant, raison: "" };
        ProfilConvois._garder(etat);
        // le site d'abord : injoignable ou mot de passe refusé, aucune page du jeu n'est lue pour rien
        return ProfilConvois.lireProfil()
          .then((profil) =>
            ProfilConvois.valeurs().then((valeurs) =>
              ProfilConvois.ecrire(profil, valeurs).then((ecrit) => {
                Journal.info(
                  JOURNAL_PROFIL,
                  ecrit ? "profil du site mis à jour" : "profil du site déjà à jour",
                  ProfilConvois.texte(valeurs),
                );
                ProfilConvois._garder({
                  ...etat,
                  fait: true,
                  envoi: { instant, site: site.origine, ecrit, ...valeurs },
                });
                return ecrit ? "envoyé" : "à jour";
              }),
            ),
          )
          .catch((e) => {
            // une lecture du jeu refusée rejette avec la requête de jQuery (statut, sans message)
            let raison =
              e && e.message
                ? String(e.message)
                : e && e.status != null
                  ? `page du jeu sans réponse (erreur ${e.status || "réseau"})`
                  : String(e || "erreur inconnue");
            Journal.erreur(JOURNAL_PROFIL, "profil du site non mis à jour", raison);
            etat = { ...etat, raison };
            if (e && (e.name == "refuse" || e.name == "identite"))
              etat = ProfilConvois._prevenir(etat, e.name, site, raison);
            ProfilConvois._garder(etat);
            return "échec";
          });
      },
    );
  }
  /**
   * Niveaux de la page Construction et nombre total d'ouvrières de la page
   * Reine, lues une fois par page ouverte avec le relevé des stats membres.
   *
   * @static
   * @method valeurs
   * @return {Promise<Record<String, Number>>} {puceron, champignonniere, ouvrieres}
   */
  static valeurs() {
    return Promise.all([
      SuiviMembres.niveauxDe("/construction.php"),
      SuiviMembres.ouvrieres(),
    ]).then(([niveaux, ouvrieres]) => {
      /** @type {Record<String, Number>} */
      let valeurs = { ouvrieres: Number(ouvrieres) };
      ["puceron", "champignonniere"].forEach((c) => {
        let nom = SUIVI_NIVEAUX_SUIVIS[c];
        if (niveaux[nom] == null)
          throw new Error(`niveau introuvable sur la page Construction : ${nom}`);
        valeurs[c] = niveaux[nom];
      });
      return valeurs;
    });
  }
  /**
   * Connexion au site et lecture du profil : il doit être celui de ce pseudo
   * (un mot de passe enregistré pour un autre joueur écrirait chez lui) et
   * donner sa case « Je ne souhaite pas recevoir de convois », renvoyée telle
   * quelle à l'écriture.
   *
   * @static
   * @method lireProfil
   * @return {Promise<any>} profil du site ; rejetée sinon
   */
  static lireProfil() {
    return OuafSuivi.connecter()
      .then(() => OuafSuivi.requete("GET", "/api/profil"))
      .then((/** @type {any} */ profil) => {
        let pseudo = String(profil.pseudo || "").trim();
        if (pseudo && pseudo.toLowerCase() != ProfilConvois._pseudo()) {
          let e = new Error(
            `le mot de passe enregistré dans ce navigateur est celui de ${pseudo} sur le site, pas le tien`,
          );
          e.name = "identite";
          throw e;
        }
        if (!("sans_reception" in profil))
          throw new Error("profil du site illisible : rien n'y est modifié");
        return profil;
      });
  }
  /**
   * Écrit les valeurs dans le profil du site, comme « Enregistrer » sur sa
   * page « Mon profil », s'il n'a pas déjà les mêmes : tous les champs, en
   * texte comme ceux de sa page.
   *
   * @static
   * @method ecrire
   * @param {any} profil lu par lireProfil()
   * @param {Record<String, Number>} valeurs voir valeurs()
   * @return {Promise<Boolean>} écrit (false : le site avait déjà ces valeurs) ;
   *   rejetée si le site refuse ou ne garde pas ce qui est envoyé
   */
  static ecrire(profil, valeurs) {
    let champs = Object.keys(CHAMPS_PROFIL_CONVOIS),
      different = (/** @type {any} */ p, /** @type {String} */ champ) =>
        Number(p[champ]) != valeurs[CHAMPS_PROFIL_CONVOIS[champ]];
    if (!champs.some((c) => different(profil, c))) return Promise.resolve(false);
    return OuafSuivi.requete("PUT", "/api/profil", {
      ...Object.fromEntries(champs.map((c) => [c, String(valeurs[CHAMPS_PROFIL_CONVOIS[c]])])),
      sans_reception: Boolean(profil.sans_reception),
    }).then((/** @type {any} */ garde) => {
      let ecarts = champs.filter((c) => c in garde && different(garde, c));
      if (ecarts.length)
        throw new Error(
          `le site a gardé ${ecarts.map((c) => `${NOMS_PROFIL_CONVOIS[CHAMPS_PROFIL_CONVOIS[c]]} ${garde[c]} au lieu de ${valeurs[CHAMPS_PROFIL_CONVOIS[c]]}`).join(", ")}`,
        );
      return true;
    });
  }
  /**
   * Prévient le joueur, une fois par jour au plus, que son profil n'est pas
   * mis à jour faute d'un réglage qu'il est seul à pouvoir faire.
   *
   * @private
   * @static
   * @param {any} etat
   * @param {"accepte"|"code"|"refuse"|"identite"} cause
   * @param {{hote: String}} site
   * @param {String} [raison] message de l'échec
   * @return {any} l'état, avec le jour de l'avertissement
   */
  static _prevenir(etat, cause, site, raison = "") {
    let jour = SuiviMembres.jour();
    // Préférences → Pages, « Toutes les pages » décochée : rien n'est affiché
    if (etat.prevenu == jour || document.documentElement.classList.contains("o_origineGenerale"))
      return etat;
    let probleme =
      cause == "accepte"
        ? `tu n'as pas encore accepté le site ${site.hote}`
        : cause == "code"
          ? "aucun mot de passe du site n'est enregistré dans ce navigateur"
          : cause == "refuse"
            ? `le site ${site.hote} refuse le mot de passe enregistré dans ce navigateur`
            : raison;
    Journal.info(JOURNAL_PROFIL, "joueur prévenu", probleme);
    $.toast({
      ...TOAST_WARNING,
      heading: "Site de suivi des convois",
      text: `Ton profil sur le site de suivi des convois n'est pas mis à jour : ${Utils.echapper(probleme)}. À régler dans <a href='#' class='o_ouvrirConvois'>Préférences → Convois</a>.`,
      hideAfter: false,
      allowToastClose: true,
    });
    $(document)
      .off("click.o_ouvrirConvois")
      .on("click.o_ouvrirConvois", ".o_ouvrirConvois", (e) => {
        e.preventDefault();
        BoiteParametre.ouvrirOnglet("Convois");
      });
    return { ...etat, prevenu: jour };
  }
  /**
   * Où en est le profil du site dans ce navigateur, pour Préférences → Convois.
   *
   * @static
   * @method resume
   * @param {Boolean} accepte site des réglages accepté
   * @param {String} code mot de passe enregistré
   * @return {String} texte
   */
  static resume(accepte, code) {
    let e = ProfilConvois.etat(),
      aujourdhui = e.jour == SuiviMembres.jour(),
      phrases = [];
    if (e.envoi && e.envoi.instant)
      phrases.push(
        `Profil du site ${e.envoi.ecrit ? "mis à jour" : "vérifié, déjà à jour,"} le ${moment(e.envoi.instant).format("DD/MM [à] HH[h]mm")} : ${ProfilConvois.texte(e.envoi)}.`,
      );
    if (!accepte)
      phrases.push(
        "Ton profil sur le site (Étable à pucerons, Champignonnière, ouvrières) n'est mis à jour qu'une fois ce site accepté.",
      );
    else if (!code)
      phrases.push(
        "Ton profil sur le site (Étable à pucerons, Champignonnière, ouvrières) n'est pas mis à jour sans mot de passe enregistré dans ce navigateur.",
      );
    else if (aujourdhui && !e.fait && e.raison)
      phrases.push(
        `Aujourd'hui, ton profil sur le site n'a pas pu être mis à jour : ${e.raison}. ${e.essais >= SUIVI_ESSAIS_PAR_JOUR ? "Nouvel essai demain." : `Nouvel essai à une page ouverte au moins une heure plus tard (${numeral(SUIVI_ESSAIS_PAR_JOUR).format()} essais par jour au plus).`}`,
      );
    else if (!(aujourdhui && e.fait))
      phrases.push(
        "Ton profil sur le site (Étable à pucerons, Champignonnière, ouvrières) sera mis à jour à ta prochaine page.",
      );
    return phrases.join(" ");
  }
}
