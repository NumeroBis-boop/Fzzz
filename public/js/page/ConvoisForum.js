// @ts-check
/*
 * ConvoisForum.js
 * Convois partagés dans le forum de l'alliance : sujet commun, une réponse par joueur.
 **********************************************************************/

// écritures de ma réponse, l'une après l'autre (deux clics rapprochés)
let fileConvoisForum = Promise.resolve();

/**
 * Convois du joueur dans sa réponse du sujet commun des convois
 * (SUJETS_COMMUNS.Convois, section « BDD partagée cachée »), que son extension
 * poste puis modifie ; personne d'autre ne l'écrit. Une ligne par convoi :
 * « 19/11/26 19:30 | Kwhwwymwn | 4 pommes | 250 000 bois | #123456 »
 * (arrivée, destinataire, nourriture et matériaux, numéro ; #0 : numéro
 * inconnu, lien Annuler disparu), suivie de « | prévu N | avance N » quand le
 * convoi a été transmis au site de suivi : c'est ce qui fait « ✅ Enregistré »
 * (le site de suivi ne garde pas le numéro du convoi dans le jeu).
 *
 * Écritures : au clic sur « 📤 Envoyer au suivi » ou « 📝 Noter dans le
 * forum » (sa répartition), et au chargement de la page Convois qui suit un
 * clic sur « Annuler » d'un convoi noté. Les convois arrivés sont retirés à l'écriture suivante, sans
 * historique. Les sujets « Convois | pseudo » d'avant (premier message) sont
 * encore lus pour l'état « ✅ Enregistré », jamais écrits.
 *
 * @class ConvoisForum
 */
class ConvoisForum {
  /**
   * Lignes de convois d'un texte : celles du sujet commun (nourriture et
   * matériaux), et celles des sujets « Convois | pseudo » d'avant (un seul
   * montant, leur somme). La répartition (part du convoi prévu, part en
   * avance) n'est connue que des lignes transmises au site depuis 1.86.
   *
   * @static
   * @method lire
   * @param {String} texte
   * @return {Array<any>} [{arrivee "AAAA-MM-JJ HH:mm", vers, nou?, mat?, montant, id, prevu?, avance?}]
   */
  static lire(texte) {
    let nombre = "(\\d[\\d \\u00a0\\u202f.]*)",
      date = "(\\d{1,2})\\/(\\d{1,2})\\/(\\d{2,4})\\s+(\\d{1,2})[:hH](\\d{2})",
      vers = "\\s*\\|\\s*([^|\\n]+?)\\s*\\|\\s*",
      repartition = `(?:[ \\t]*\\|[ \\t]*prévu[ \\t]+${nombre}[ \\t]*\\|[ \\t]*avance[ \\t]+${nombre})?`,
      separes = new RegExp(
        `${date}${vers}${nombre}\\s*pommes?\\s*\\|\\s*${nombre}\\s*bois\\s*\\|\\s*#(\\d+)${repartition}`,
        "g",
      ),
      somme = new RegExp(`${date}${vers}${nombre}\\s*\\|\\s*#(\\d+)${repartition}`, "g"),
      entier = (/** @type {String} */ t) => parseInt(t.replace(/\D/g, "")),
      arrivee = (/** @type {Array<String>} */ m) =>
        moment(
          `${m[1]}/${m[2]}/${m[3].length == 2 ? "20" + m[3] : m[3]} ${m[4]}:${m[5]}`,
          "D/M/YYYY H:mm",
        ).format("YYYY-MM-DD HH:mm"),
      /** @type {Array<any>} */
      convois = [],
      m;
    texte = String(texte || "");
    while ((m = separes.exec(texte))) {
      let nou = entier(m[7]),
        mat = entier(m[8]);
      convois.push({
        arrivee: arrivee(m),
        vers: PartageChasses.nettoyer(m[6]),
        nou,
        mat,
        montant: nou + mat,
        id: parseInt(m[9]),
        ...(m[10] != null ? { prevu: entier(m[10]), avance: entier(m[11]) } : {}),
      });
    }
    while ((m = somme.exec(texte)))
      convois.push({
        arrivee: arrivee(m),
        vers: PartageChasses.nettoyer(m[6]),
        montant: entier(m[7]),
        id: parseInt(m[8]),
        ...(m[9] != null ? { prevu: entier(m[9]), avance: entier(m[10]) } : {}),
      });
    return convois;
  }
  /**
   * Texte de ma réponse : convois pas encore arrivés, plus tardif en premier ;
   * "" sans convoi.
   *
   * @static
   * @method ecrire
   * @param {Array<any>} convois [{arrivee, vers, nou, mat, id, prevu?, avance?}]
   * @param {String} maintenant "AAAA-MM-JJ HH:mm"
   * @return {String}
   */
  static ecrire(convois, maintenant) {
    let vus = new Set();
    return convois
      .filter((c) => c.arrivee >= maintenant && (!c.id || (!vus.has(c.id) && vus.add(c.id))))
      .sort((a, b) => (a.arrivee < b.arrivee ? 1 : a.arrivee > b.arrivee ? -1 : b.id - a.id))
      .slice(0, PARTAGE_MAX_ENTREES)
      .map(ConvoisForum.ligne)
      .join("\n");
  }
  /**
   * Ligne d'un convoi dans ma réponse.
   *
   * @static
   * @method ligne
   * @param {any} c {arrivee "AAAA-MM-JJ HH:mm", vers, nou, mat, id, prevu?, avance?}
   * @return {String}
   */
  static ligne(c) {
    return (
      `${moment(c.arrivee, "YYYY-MM-DD HH:mm").format("DD/MM/YY HH:mm")} | ${c.vers} | ${numeral(c.nou || 0).format()} pommes | ${numeral(c.mat || 0).format()} bois | #${c.id}` +
      (c.prevu != null
        ? ` | prévu ${numeral(c.prevu).format()} | avance ${numeral(c.avance || 0).format()}`
        : "")
    );
  }
  /**
   * Entrée d'un convoi de la page (OuafSuivi.convoisJeu) pour ma réponse.
   *
   * @static
   * @method entree
   * @param {any} c {id, vers, nou, mat, arrivee (ms), prevu?, avance?}
   * @param {Boolean} [avecRepartition] transmis au site de suivi
   * @return {any}
   */
  static entree(c, avecRepartition = false) {
    return {
      arrivee: moment(c.arrivee).format("YYYY-MM-DD HH:mm"),
      vers: c.vers,
      nou: c.nou || 0,
      mat: c.mat || 0,
      montant: (c.nou || 0) + (c.mat || 0),
      id: c.id || 0,
      ...(avecRepartition && c.prevu != null ? { prevu: c.prevu, avance: c.avance || 0 } : {}),
    };
  }
  /**
   * Dernière réponse de chaque joueur dans le sujet commun des convois ; le
   * premier message n'en est pas une.
   *
   * @static
   * @method reponses
   * @param {any} data réponse xajax du sujet
   * @return {any} {pseudo en minuscules: {pseudo, id, convois}}
   */
  static reponses(data) {
    /** @type {any} */
    let joueurs = {};
    PartageChasses.messages(data).forEach((m) => {
      let k = m.auteur.toLowerCase();
      if (m.id == null || !k || (joueurs[k] && joueurs[k].id > m.id)) return;
      joueurs[k] = { pseudo: m.auteur, id: m.id, convois: ConvoisForum.lire(m.texte) };
    });
    return joueurs;
  }
  /**
   * @private
   * @static
   * @param {any} data réponse xajax du sujet
   * @return {any} ma dernière réponse (reponses()), ou null
   */
  static _maReponse(data) {
    return (
      ConvoisForum.reponses(data)[PartageChasses.nettoyer(monProfil.pseudo).toLowerCase()] || null
    );
  }
  /**
   * Sujet commun des convois et, s'il existe, mon ancien sujet « Convois | pseudo ».
   * Rejetée si le forum n'a pas pu être lu ou si le sujet commun manque.
   *
   * @private
   * @static
   * @return {Promise<{commun: {id: String}, ancien: String|null}>}
   */
  static _sujets() {
    return PartageChasses.sujets().then((sujets) => {
      let commun = (sujets.communs || {}).Convois;
      if (!commun)
        throw new Error(
          `sujet « ${SUJETS_COMMUNS.Convois} » absent du forum, à créer par un chef dans la section cachée`,
        );
      return {
        commun,
        ancien:
          sujets[`Convois | ${PartageChasses.nettoyer(monProfil.pseudo).toLowerCase()}`] || null,
      };
    });
  }
  /**
   * Convois transmis au site de suivi, notés dans le forum : ma réponse (lignes
   * avec leur répartition) et mon ancien sujet « Convois | pseudo ». Rejetée si
   * le forum n'a pas pu être lu (section ou sujet commun absent compris) :
   * l'état des convois est alors inconnu, pas « non noté ».
   *
   * @static
   * @method notes
   * @return {Promise<Array<any>>} [{id, vers, montant, arrivee (ms), prevu?, avance?}]
   */
  static notes() {
    return ConvoisForum._sujets().then(({ commun, ancien }) =>
      Promise.all([
        PartageChasses._lireSujet(commun.id).then((data) => {
          let moi = ConvoisForum._maReponse(data);
          return moi ? moi.convois.filter((/** @type {any} */ c) => c.prevu != null) : [];
        }),
        ancien
          ? PartageChasses._lireSujet(ancien).then((data) =>
              ConvoisForum.lire(PartageChasses.premierMessage(data)),
            )
          : Promise.resolve([]),
      ]).then(([miennes, anciennes]) => {
        let ids = new Set(miennes.filter((c) => c.id).map((c) => c.id));
        return miennes
          .concat(anciennes.filter((/** @type {any} */ c) => !c.id || !ids.has(c.id)))
          .map((c) => ({ ...c, arrivee: moment(c.arrivee, "YYYY-MM-DD HH:mm").valueOf() }));
      }),
    );
  }
  /**
   * Convois de la page notés dans le forum : par numéro, sinon par
   * destinataire, montant et arrivée. Chaque ligne du forum ne vaut que pour
   * un convoi : deux convois identiques dont un seul a été noté n'en donnent
   * qu'un.
   *
   * @static
   * @method trouves
   * @param {Array<any>} convois voir OuafSuivi.convoisJeu
   * @param {Array<any>} notes voir notes
   * @return {Map<Object, Object>} convoi noté → sa ligne
   */
  static trouves(convois, notes) {
    let libres = notes.slice(),
      trouves = new Map(),
      prendre = (/** @type {any} */ c, /** @type {(n: any) => Boolean} */ egal) => {
        let i = libres.findIndex(egal);
        if (i != -1) trouves.set(c, libres.splice(i, 1)[0]);
      };
    convois.filter((c) => c.id).forEach((c) => prendre(c, (n) => n.id == c.id));
    // sans numéro d'abord : une ligne au numéro inconnu ici est la leur
    convois
      .filter((c) => !trouves.has(c))
      .sort((a, b) => (a.id ? 1 : 0) - (b.id ? 1 : 0))
      .forEach((c) =>
        prendre(
          c,
          (n) =>
            String(n.vers).toLowerCase() == c.vers.toLowerCase() &&
            n.montant == c.montant &&
            Math.abs(n.arrivee - c.arrivee) <= OUAF_ECART_ARRIVEE,
        ),
      );
    return trouves;
  }
  /**
   * Convois transmis au site de suivi : leur ligne, avec leur répartition,
   * remplace celle du même convoi déjà notée (même numéro).
   *
   * @static
   * @method noter
   * @param {Array<any>} convois voir OuafSuivi.convoisJeu, avec prevu et avance
   * @return {Promise} rejetée si l'écriture a échoué
   */
  static noter(convois) {
    let nouveaux = convois.map((c) => ConvoisForum.entree(c, true));
    if (!nouveaux.length) return Promise.resolve();
    return ConvoisForum._reecrire((anciens) =>
      anciens.filter((a) => !nouveaux.some((n) => n.id && a.id == n.id)).concat(nouveaux),
    );
  }
  /**
   * Retire de ma réponse la ligne d'un convoi annulé, une seule : par numéro,
   * sinon (#0) par destinataire, montant et arrivée. Un convoi identique resté
   * en cours garde la sienne. Le nombre de lignes pareilles est passé à
   * `progres` avant l'écriture : un nouvel essai après une réponse perdue ne
   * retire pas une seconde ligne.
   *
   * @static
   * @method retirer
   * @param {any} c {id, vers, montant, arrivee (ms), lignesForum?}
   * @param {Function} [progres] reçoit {lignesForum}
   * @return {Promise<Boolean>} ligne retirée (maintenant ou par un essai précédent)
   */
  static retirer(c, progres = () => {}) {
    let retiree = false;
    return ConvoisForum._reecrire((anciens) => {
      let parNumero = (/** @type {any} */ n) => c.id && n.id == c.id,
        pareille = (/** @type {any} */ n) =>
          !n.id &&
          String(n.vers).toLowerCase() == c.vers.toLowerCase() &&
          n.montant == c.montant &&
          Math.abs(moment(n.arrivee, "YYYY-MM-DD HH:mm").valueOf() - c.arrivee) <=
            OUAF_ECART_ARRIVEE,
        egal = anciens.some(parNumero) ? parNumero : pareille,
        nombre = anciens.filter(egal).length;
      if (c.lignesForum != null && nombre < c.lignesForum) retiree = true;
      if (retiree || !nombre) return null;
      progres({ lignesForum: nombre });
      retiree = true;
      let i = anciens.findIndex(egal);
      return anciens.filter((n, k) => k != i);
    }).then(() => retiree);
  }
  /**
   * Convois qui arrivent chez moi, d'après les réponses de tous les joueurs du
   * sujet commun (lecture gardée une minute) : la page Convois du jeu ne les
   * montre qu'avec le Compte+. Comptés à la fin de leur minute d'arrivée, la
   * ligne ne donnant que la minute.
   *
   * @static
   * @method recus
   * @return {Promise<Array<{de: String, t: Number, q: Array<Number>}>>} par heure d'arrivée
   */
  static recus() {
    let moi = PartageChasses.nettoyer(monProfil.pseudo).toLowerCase(),
      maintenant = Horloge.maintenant();
    return PartageChasses.sujets(true)
      .then((sujets) => {
        let commun = (sujets.communs || {}).Convois;
        if (!commun) throw new Error(`sujet « ${SUJETS_COMMUNS.Convois} » absent du forum`);
        return PartageChasses._enCache("convoisCommun", true, () =>
          PartageChasses._lireSujet(commun.id).then((data) =>
            Object.values(ConvoisForum.reponses(data)),
          ),
        );
      })
      .then((joueurs) => {
        /** @type {Array<{de: String, t: Number, q: Array<Number>}>} */
        let liste = [];
        joueurs.forEach((/** @type {any} */ r) =>
          r.convois.forEach((/** @type {any} */ c) => {
            let t = moment(c.arrivee, "YYYY-MM-DD HH:mm").valueOf() + 60000;
            // une ligne d'un seul montant ne dit pas ce qui est nourriture ou matériaux
            if (c.nou != null && String(c.vers).toLowerCase() == moi && t > maintenant)
              liste.push({ de: r.pseudo, t, q: [c.nou, c.mat] });
          }),
        );
        return liste.sort((a, b) => a.t - b.t);
      });
  }
  /**
   * Réécrit ma réponse : `changer` reçoit mes convois notés et rend les
   * nouveaux (null : rien à écrire). La réponse du forum, sujet à jour, sert
   * de vérification : il ne signale pas une écriture refusée (grade sans droit
   * d'écrire dans la section). Les écritures d'une même page passent l'une
   * après l'autre.
   *
   * @private
   * @static
   * @param {(anciens: Array<any>) => Array<any>|null} changer
   * @return {Promise<Boolean>} écrite ; rejetée si refusée
   */
  static _reecrire(changer) {
    let ecriture = fileConvoisForum
      .then(() => ConvoisForum._sujets())
      .then(({ commun }) =>
        PartageChasses._lireSujet(commun.id).then((data) => {
          let moi = ConvoisForum._maReponse(data),
            anciens = moi ? moi.convois : [],
            lignes = changer(anciens);
          if (!lignes) return false;
          let maintenant = Horloge.serveur().format("YYYY-MM-DD HH:mm"),
            texte = ConvoisForum.ecrire(lignes, maintenant),
            avant = ConvoisForum.ecrire(anciens, maintenant);
          // pas encore de réponse et rien à y mettre, ou rien qui change
          if ((!moi && !texte) || (moi && texte == avant)) return false;
          texte = texte || MESSAGE_VIDE.Convois;
          if (texte.length > COMMUN_MAX_CARACTERES)
            throw new Error(`réponse trop longue (${texte.length} caractères)`);
          let q = `message=${encodeURIComponent(texte)}&send=Envoyer`,
            prise = (/** @type {any} */ d) => {
              let m = ConvoisForum._maReponse(d);
              return (
                !!m &&
                ConvoisForum.ecrire(m.convois, maintenant) ==
                  ConvoisForum.ecrire(ConvoisForum.lire(texte), maintenant)
              );
            };
          return (
            moi
              ? PartageChasses._xajax(
                  "envoiEditMessage",
                  `<xjxquery><q>IDMessage=${moi.id}&${q}</q></xjxquery>`,
                )
              : PartageChasses._xajax(
                  "envoiNouveauMessage",
                  `<xjxquery><q>topic=${commun.id}&${q}</q></xjxquery>`,
                )
          )
            .then((d) => prise(d) || PartageChasses._lireSujet(commun.id).then(prise))
            .then((ok) => {
              PartageChasses.oublierCache();
              if (!ok) throw new Error("écriture refusée par le forum (droits de la section ?)");
              return true;
            });
        }),
      );
    fileConvoisForum = ecriture.then(
      () => {},
      (e) => console.error(`[${NOM_EXTENSION}] convois : écriture dans le forum impossible`, e),
    );
    return ecriture;
  }
}
