// @ts-check
/*
 * ExportAuto.js
 * Partage de données : export automatique des rapports de chasse du rôle
 * Chasseur vers le Google Sheet, après un clic sur « Envoyer » ou « Envoyer +
 * partager » du lanceur de chasses, deux fois par semaine au plus.
 **********************************************************************/

// case décochée : "0" ; cochée par défaut
const CLE_PARTAGE_EXPORT_CHASSES = "fzzz_partage_exportChasses";
// par pseudo : chasse lancée qui attend son export, rendez-vous traité, essais
// du jour, raison du dernier échec, annonce déjà montrée, conversations à
// remettre « non lues », dernier export
const CLE_EXPORT_AUTO = "fzzz_exportAuto";
// export qui échoue (jeu, forum ou fichier sans réponse) ou page quittée en
// route : nouvel essai à une page ouverte plus tard, jamais à chaque page
const EXPORT_AUTO_ESSAIS_PAR_JOUR = 3;
const EXPORT_AUTO_PAUSE_ESSAIS = 3600 * 1000;
// conversations lues puis envoyées par lots : une page quittée en route ne
// perd que le lot en cours
const EXPORT_AUTO_LOT = 10;
// toutes les requêtes de l'export automatique au jeu : la priorité la plus
// faible de toutes (règle du mainteneur), après les autres (Requetes.js)
const REQUETE_DE_FOND = Object.freeze({ fond: true });

/**
 * Quand le joueur clique sur « Envoyer » ou « Envoyer + partager » du lanceur
 * de chasses alors qu'un export est dû (RappelExport : après le mercredi et le
 * dimanche 22h, un export des 24 h d'avant compte), les rapports de chasse de
 * sa messagerie pas encore dans le fichier sont lus et envoyés après l'envoi
 * des chasses, comme le fait le bouton « Exporter mes chasses », qui reste
 * pour un export immédiat. Règles du mainteneur : détection à ce clic, pas à
 * la première page ouverte après le rendez-vous, et la priorité la plus faible
 * de toutes. Rôle Chasseur seulement, case de Préférences → Partage de données
 * cochée ; le joueur est prévenu avant le premier export.
 *
 * Le jeu marque « lue » une conversation qu'on lui demande : celles qui ne
 * l'étaient pas sont remises « non lues » (requête du bouton « Marquer comme
 * non lu » de la messagerie), le joueur retrouve sa messagerie comme il l'a
 * laissée.
 *
 * Règles s5 : tout part d'un clic du joueur, deux fois par semaine au plus ;
 * aucune minuterie, aucune requête répétée.
 *
 * @class ExportAuto
 */
class ExportAuto {
  /**
   * @static
   * @method coche
   * @return {Boolean} export automatique coché dans les Préférences
   */
  static coche() {
    try {
      return localStorage.getItem(CLE_PARTAGE_EXPORT_CHASSES) != "0";
    } catch (e) {
      return true;
    }
  }
  /**
   * Case cochée ou décochée par le joueur ; recochée, l'export dû se fait à la
   * prochaine page.
   *
   * @static
   * @method choisir
   * @param {Boolean} coche
   */
  static choisir(coche) {
    try {
      localStorage.setItem(CLE_PARTAGE_EXPORT_CHASSES, coche ? "1" : "0");
    } catch (e) {}
    ExportAuto._garder({ ...ExportAuto.etat(), essais: 0, essai: 0, raison: "" });
  }
  /**
   * @static
   * @method actif
   * @return {Boolean} rôle Chasseur et case cochée
   */
  static actif() {
    return RappelExport.chasseur() && ExportAuto.coche();
  }
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
   * @return {any} export automatique du joueur dans ce navigateur :
   *   {chasse, rdv, jour, essais, essai, raison, annonce, aRemettre, dernier}
   */
  static etat() {
    let e = Utils.lireStockage(CLE_EXPORT_AUTO)[ExportAuto._pseudo()];
    return e && typeof e == "object" ? e : {};
  }
  /**
   * @private
   * @static
   * @param {any} etat
   */
  static _garder(etat) {
    let tous = Utils.lireStockage(CLE_EXPORT_AUTO);
    tous[ExportAuto._pseudo()] = etat;
    try {
      localStorage.setItem(CLE_EXPORT_AUTO, JSON.stringify(tous));
    } catch (e) {}
  }
  /**
   * Clic sur « Envoyer » ou « Envoyer + partager » du lanceur de chasses : si
   * un export est dû, il se fera après l'envoi (lancer). Un clic quand rien
   * n'est dû ne compte pas : le rendez-vous suivant attendra un nouveau clic.
   *
   * @static
   * @method noterChasse
   */
  static noterChasse() {
    if (!ExportAuto._pseudo() || !ExportAuto.actif() || !RappelExport.rendezVousDu()) return;
    let etat = ExportAuto.etat();
    if (!etat.chasse) ExportAuto._garder({ ...etat, chasse: Horloge.maintenant() });
  }
  /**
   * L'export automatique s'occupe-t-il de ce rendez-vous ? Oui une fois le
   * clic sur « Envoyer » noté, tant que son essai n'a pas échoué : pas de
   * rappel « Export des chasses à faire » pendant ce temps. Avant ce clic, le
   * rappel reste : un chasseur qui lance ses chasses avec le formulaire du jeu
   * n'aurait sinon ni export ni rappel, et le jeu supprime les conversations
   * lues au bout de 7 jours.
   *
   * @static
   * @method enCharge
   * @param {Number} rdv instant du rendez-vous (ms)
   * @return {Boolean}
   */
  static enCharge(rdv) {
    if (!ExportAuto.actif()) return false;
    let e = ExportAuto.etat();
    return !!e.chasse && !(e.rdv == rdv && e.raison);
  }
  /**
   * Conversations de chasse de la boîte de réception : la liste de la page si
   * c'est elle qui est affichée, sinon la page de la messagerie, lue une fois.
   *
   * @static
   * @method liste
   * @return {Promise<Array<{id: Number, titre: String, camp: String, nonLue: Boolean}>>}
   */
  static liste() {
    let lire = (/** @type {any} */ $racine) => {
      // page de connexion (session finie), page d'erreur : pas « rien à exporter »
      if (!$racine.find("#liste_conversations").length)
        throw new Error("liste des conversations de la messagerie illisible");
      return ExportRapports.listees("chasse", $racine);
    };
    // avec une ancre (#Envoi, #Chasse…), le jeu affiche un autre dossier
    if (/^\/messagerie\.php$/i.test(location.pathname) && !location.search && !location.hash)
      return Promise.resolve().then(() => lire($(document)));
    return Promise.resolve(
      $.ajax({ url: location.origin + "/messagerie.php", ...REQUETE_DE_FOND }),
    ).then((html) => lire(Utils.parseHtml(String(html))));
  }
  /**
   * Remet « non lues » des conversations que l'export a lues ; un échec est
   * noté au journal, sans suite (elles restent lues).
   *
   * @private
   * @static
   * @param {Array<Number>} ids
   * @return {Promise<void>}
   */
  static _remettre(ids) {
    if (!ids.length) return Promise.resolve();
    return Promise.resolve(
      $.ajax({
        url: location.origin + "/messagerie.php",
        type: "post",
        data: { traitement: "lecture", id_conversations: ids, est_lu: 0 },
        ...REQUETE_DE_FOND,
      }),
    )
      .then((reponse) => {
        if (!/action_valide/.test(String(reponse))) throw new Error("refusé par le jeu");
      })
      .catch((e) => {
        Journal.noter(
          "alerte",
          JOURNAL_EXPORT,
          `${ids.length} conversation(s) de chasse lue(s) par l'export automatique pas remise(s) « non lues »`,
          e,
        );
      });
  }
  /**
   * Lit et envoie les conversations par lots ; après chaque lot, ses
   * conversations non lues le redeviennent, que l'envoi ait réussi ou non.
   *
   * @private
   * @static
   * @param {Array<{id: Number, titre: String, camp: String, nonLue: Boolean}>} aLire
   * @param {String} url
   * @return {Promise<{lues: Number, echecs: Number, ajoutees: Number, deja: Number, sansDate: Number, entete: String}>}
   */
  static _parLots(aLire, url) {
    let total = { lues: 0, echecs: 0, ajoutees: 0, deja: 0, sansDate: 0, entete: "" },
      /** @type {Array<typeof aLire>} */
      lots = [];
    for (let i = 0; i < aLire.length; i += EXPORT_AUTO_LOT)
      lots.push(aLire.slice(i, i + EXPORT_AUTO_LOT));
    return lots
      .reduce(
        (suite, lot) =>
          suite.then(() => {
            let nonLues = lot.filter((c) => c.nonLue).map((c) => c.id),
              rendre = () => {
                ExportAuto._garder({ ...ExportAuto.etat(), aRemettre: [] });
                return ExportAuto._remettre(nonLues);
              };
            // noté avant de lire : après une page quittée en route, la suivante les remet « non lues »
            ExportAuto._garder({ ...ExportAuto.etat(), aRemettre: nonLues });
            return ExportRapports.lireEtEnvoyer(
              "chasse",
              lot,
              url,
              new Set(),
              () => {},
              REQUETE_DE_FOND,
            ).then(
              (b) =>
                rendre().then(() => {
                  total.lues += b.lues;
                  total.echecs += b.echecs;
                  total.sansDate += b.sansDate;
                  total.entete = total.entete || b.entete;
                  b.bilans.forEach((o) => {
                    total.ajoutees += o.ajoutees;
                    total.deja += o.deja;
                  });
                }),
              (e) =>
                rendre().then(() => {
                  throw e;
                }),
            );
          }),
        Promise.resolve(),
      )
      .then(() => total);
  }
  /**
   * Export des chasses dû et chasse lancée depuis : fait à cette page, sauf
   * essai trop récent ou page où l'armée se lance ou se replace (une lecture en
   * cours retarderait un envoi à la seconde près). Appelé à l'ouverture de
   * chaque page et à la fin d'un lancement fait depuis la boîte d'outils.
   *
   * @static
   * @method lancer
   * @return {Promise<String>} ce qui a été fait
   */
  static lancer() {
    if (!ExportAuto._pseudo() || Utils.pageSansAlertePonte(location))
      return Promise.resolve("page");
    // conversations qu'un export quitté en route a laissées lues
    let enSuspens = ExportAuto.etat().aRemettre || [];
    if (enSuspens.length) ExportAuto._garder({ ...ExportAuto.etat(), aRemettre: [] });
    let remise = ExportAuto._remettre(enSuspens);
    if (!ExportAuto.actif()) return remise.then(() => "inactif");
    let rdv = RappelExport.rendezVousDu(),
      etat = ExportAuto.etat();
    if (!rdv) {
      // exporté entre-temps au bouton : le rendez-vous suivant attendra un nouveau lancement
      if (etat.chasse) ExportAuto._garder({ ...etat, chasse: 0 });
      return remise.then(() => "à jour");
    }
    if (!etat.chasse) return remise.then(() => "sans chasse");
    let instant = Horloge.maintenant(),
      jour = Horloge.serveur().format("YYYY-MM-DD");
    if (etat.rdv != rdv)
      etat = {
        annonce: etat.annonce,
        dernier: etat.dernier,
        chasse: etat.chasse,
        rdv,
        jour,
        essais: 0,
        essai: 0,
      };
    else if (etat.jour != jour) etat = { ...etat, jour, essais: 0 };
    if (
      ExportRapports.enCours ||
      etat.essais >= EXPORT_AUTO_ESSAIS_PAR_JOUR ||
      instant - (etat.essai || 0) < EXPORT_AUTO_PAUSE_ESSAIS
    )
      return remise.then(() => "attente");
    // noté avant les lectures : une page quittée en route ne relance pas tout à la suivante
    etat = { ...etat, essais: (etat.essais || 0) + 1, essai: instant, raison: "" };
    ExportAuto._garder(etat);
    ExportRapports.enCours = true;
    let fin = (/** @type {String} */ resultat, /** @type {any} */ suite) => {
      ExportAuto._garder({ ...ExportAuto.etat(), ...suite });
      return resultat;
    };
    return remise
      .then(() => ExportRapports.cible(REQUETE_DE_FOND))
      .then(({ url, alliance, illisible }) => {
        if (!ExportRapports.adresseValide(url)) {
          // joueur sans alliance : pas de forum à relire
          let seul = !Utils.alliance,
            raison = seul
              ? "tu n'as pas d'alliance et aucune adresse de Google Sheet n'est renseignée dans Préférences → Messagerie"
              : ExportRapports.sansAdresse(alliance, !!illisible);
          // forum pas lu : un échec comme un autre
          if (illisible && !seul) throw new Error(raison);
          // pas de fichier où exporter : rien à attendre d'un nouvel essai aujourd'hui
          Journal.info(JOURNAL_EXPORT, `export automatique des chasses impossible : ${raison}`);
          return fin("sans fichier", { raison, essais: EXPORT_AUTO_ESSAIS_PAR_JOUR });
        }
        if (!etat.annonce) {
          ExportAuto.annoncer(alliance);
          return fin("annonce", { annonce: true, essais: 0, essai: 0 });
        }
        return ExportAuto.liste()
          .then((listees) =>
            ExportRapports.aLire("chasse", listees, url).then(({ aLire, connues, absentes }) => {
              Journal.info(
                JOURNAL_EXPORT,
                `Export automatique des chasses vers le fichier ${alliance ? "de l'alliance" : "personnel"} : ${listees.length} conversation(s) listée(s), ${connues} RC déjà exporté(s) dont ${absentes} absent(s) du fichier, ${aLire.length} conversation(s) à lire`,
              );
              return ExportAuto._parLots(aLire, url);
            }),
          )
          .then((b) => {
            let s = (/** @type {Number} */ n) => (n > 1 ? "s" : "");
            if (b.ajoutees || b.sansDate)
              $.toast({
                ...(b.sansDate ? TOAST_WARNING : TOAST_SUCCESS),
                hideAfter: b.sansDate ? false : 6000,
                text:
                  `Export automatique des chasses : ${numeral(b.ajoutees).format()} ligne${s(b.ajoutees)} ajoutée${s(b.ajoutees)} dans « ${EXPORTS_RAPPORTS.chasse.onglet} ».` +
                  (b.sansDate ? ExportRapports.phraseSansDate(b.sansDate, b.entete) : ""),
              });
            // une conversation illisible : à refaire, l'export n'est pas mené au bout
            if (b.echecs) throw new Error(`${b.echecs} conversation(s) de chasse illisible(s)`);
            RappelExport.noterExport();
            Journal.info(
              JOURNAL_EXPORT,
              `export automatique des chasses mené au bout : ${b.lues} conversation(s) lue(s), ${b.ajoutees} ligne(s) ajoutée(s), ${b.deja} déjà présente(s)`,
            );
            // le rendez-vous suivant attendra un nouveau lancement de chasse
            return fin("exporté", {
              chasse: 0,
              dernier: { instant: Horloge.maintenant(), ajoutees: b.ajoutees },
            });
          });
      })
      .catch((e) => {
        let raison = String((e && e.message) || "erreur inconnue");
        Journal.erreur(JOURNAL_EXPORT, "export automatique des chasses non mené au bout", raison);
        return fin("échec", { raison });
      })
      .finally(() => {
        ExportRapports.enCours = false;
      });
  }
  /**
   * Prévient le joueur, avant le premier export automatique.
   *
   * @static
   * @method annoncer
   * @param {Boolean} alliance fichier de l'alliance (sinon celui du joueur)
   */
  static annoncer(alliance) {
    $.toast({
      ...TOAST_INFO,
      heading: "Partage de données",
      text: `Tes rapports de chasse sont maintenant exportés automatiquement vers ${alliance ? "le Google Sheet de ton alliance" : "ton Google Sheet"} : deux fois par semaine au plus, à ton premier clic sur « Envoyer » ou « Envoyer + partager » du lanceur de chasses après le mercredi ou le dimanche 22h, une fois les chasses envoyées et après toutes les autres demandes de l'extension au jeu. Le premier export se fera à ta prochaine page. Le bouton « Exporter mes chasses » de la messagerie reste, pour un export immédiat. Tu peux désactiver l'export automatique dans <a href='#' class='o_ouvrirPartage'>Préférences → Partage de données</a>.`,
      hideAfter: false,
      allowToastClose: true,
    });
    SuiviMembres.lierPreferences();
  }
  /**
   * Où en est l'export des chasses dans ce navigateur, pour l'onglet des Préférences.
   *
   * @static
   * @method resume
   * @return {String} texte
   */
  static resume() {
    if (!RappelExport.chasseur())
      return "Ton rôle n'est pas « Chasseur » (Préférences → Rôle) : tes chasses ne sont pas exportées automatiquement.";
    let e = ExportAuto.etat(),
      fait = RappelExport.exportFait(),
      rdv = RappelExport.rendezVousDu(),
      phrases = [
        fait
          ? `Dernier export des chasses mené au bout depuis ce navigateur : le ${moment(fait).format("DD/MM/YYYY [à] HH[h]mm")}.`
          : "Aucun export des chasses mené au bout depuis ce navigateur pour l'instant.",
      ];
    // case décochée : choisir() a effacé la raison du dernier essai
    if (rdv && e.rdv == rdv && e.raison)
      phrases.push(
        `Le dernier essai automatique n'a pas abouti : ${e.raison}. Nouvel essai à une page ouverte plus tard (${numeral(EXPORT_AUTO_ESSAIS_PAR_JOUR).format()} essais par jour au plus) ; le bouton « Exporter mes chasses » de la messagerie marche aussi.`,
      );
    else if (ExportAuto.coche() && rdv)
      phrases.push(
        e.chasse
          ? "Le prochain export se fera à ta prochaine page."
          : "Le prochain export se fera après ton prochain clic sur « Envoyer » du lanceur de chasses.",
      );
    return phrases.join(" ");
  }
}
