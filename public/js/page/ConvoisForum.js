// @ts-check
/*
 * ConvoisForum.js
 * Convois envoyés au site de suivi OUAF, notés dans le forum d'alliance.
 **********************************************************************/

// écritures du sujet, l'une après l'autre (deux envois rapprochés)
let fileConvoisForum = Promise.resolve();

/**
 * Chaque convoi transmis au site de suivi est noté dans le sujet « Convois |
 * pseudo » de la section « BDD partagée cachée » : c'est la seule référence de
 * son état, sur tout appareil (le site de suivi ne garde pas le numéro du
 * convoi dans le jeu).
 *
 * Une ligne par convoi : « 27/10/26 21:37 | Kwhwwymwn | 250 000 | #123456 »
 * (arrivée, destinataire, montant, numéro ; #0 : numéro inconnu, lien Annuler
 * disparu). Les convois arrivés sont retirés à chaque écriture. Requêtes :
 * lecture à l'ouverture de la page Convois, écriture après un envoi au suivi.
 *
 * @class ConvoisForum
 */
class ConvoisForum {
  /**
   * Lignes de convois d'un texte de sujet. La répartition (part du convoi
   * prévu, part en avance) n'est connue que des lignes écrites depuis 1.86.
   *
   * @static
   * @method lire
   * @param {String} texte
   * @return {Array} [{arrivee "AAAA-MM-JJ HH:mm", vers, montant, id, prevu?, avance?}]
   */
  static lire(texte) {
    let nombre = "(\\d[\\d \\u00a0\\u202f.]*)",
      re = new RegExp(
        `(\\d{1,2})\\/(\\d{1,2})\\/(\\d{2,4})\\s+(\\d{1,2})[:hH](\\d{2})\\s*\\|\\s*([^|\\n]+?)\\s*\\|\\s*${nombre}\\s*\\|\\s*#(\\d+)(?:[ \\t]*\\|[ \\t]*prévu[ \\t]+${nombre}[ \\t]*\\|[ \\t]*avance[ \\t]+${nombre})?`,
        "g",
      ),
      entier = (t) => parseInt(t.replace(/\D/g, "")),
      convois = [],
      m;
    while ((m = re.exec(String(texte || ""))))
      convois.push({
        arrivee: moment(
          `${m[1]}/${m[2]}/${m[3].length == 2 ? "20" + m[3] : m[3]} ${m[4]}:${m[5]}`,
          "D/M/YYYY H:mm",
        ).format("YYYY-MM-DD HH:mm"),
        vers: PartageChasses.nettoyer(m[6]),
        montant: entier(m[7]),
        id: parseInt(m[8]),
        ...(m[9] != null ? { prevu: entier(m[9]), avance: entier(m[10]) } : {}),
      });
    return convois;
  }
  /**
   * Texte du sujet : convois pas encore arrivés, plus récents en premier.
   *
   * @static
   * @method ecrire
   * @param {Array} convois [{arrivee, vers, montant, id, prevu?, avance?}]
   * @param {String} maintenant "AAAA-MM-JJ HH:mm"
   */
  static ecrire(convois, maintenant) {
    let vus = new Set();
    return convois
      .filter((c) => c.arrivee >= maintenant && (!c.id || (!vus.has(c.id) && vus.add(c.id))))
      .sort((a, b) => (a.arrivee < b.arrivee ? 1 : a.arrivee > b.arrivee ? -1 : b.id - a.id))
      .slice(0, PARTAGE_MAX_ENTREES)
      .map(
        (c) =>
          `${moment(c.arrivee, "YYYY-MM-DD HH:mm").format("DD/MM/YY HH:mm")} | ${c.vers} | ${numeral(c.montant).format()} | #${c.id}` +
          (c.prevu != null
            ? ` | prévu ${numeral(c.prevu).format()} | avance ${numeral(c.avance || 0).format()}`
            : ""),
      )
      .join("\n");
  }
  /**
   * @private
   * @static
   */
  static _sujet() {
    let titre = `Convois | ${monProfil.pseudo}`;
    return PartageChasses.sujets().then((sujets) => ({
      titre,
      id: sujets[titre.replace(/\| (.+)$/, (t, p) => `| ${p.toLowerCase()}`)] || null,
    }));
  }
  /**
   * @private
   * @static
   */
  static _contenu(idSujet) {
    if (!idSujet) return Promise.resolve([]);
    return PartageChasses._xajax("callGetTopic", idSujet).then((data) => {
      let $div = Utils.parseHtml(PartageChasses._html(data));
      $div.find("br").replaceWith("\n");
      return ConvoisForum.lire($div.text());
    });
  }
  /**
   * Convois notés dans le sujet du joueur ; vide si le sujet n'existe pas
   * encore. Rejetée si le forum n'a pas pu être lu (section absente comprise) :
   * l'état des convois est alors inconnu, pas « non noté ».
   *
   * @static
   * @method notes
   * @return {Promise<Array>} [{id, vers, montant, arrivee (ms)}]
   */
  static notes() {
    return ConvoisForum._sujet()
      .then((s) => ConvoisForum._contenu(s.id))
      .then((convois) =>
        convois.map((c) => ({ ...c, arrivee: moment(c.arrivee, "YYYY-MM-DD HH:mm").valueOf() })),
      );
  }
  /**
   * Convois de la page notés dans le sujet : par numéro, sinon par
   * destinataire, montant et arrivée. Chaque ligne du sujet ne vaut que pour
   * un convoi : deux convois identiques dont un seul a été noté n'en donnent
   * qu'un.
   *
   * @static
   * @method trouves
   * @param {Array} convois voir OuafSuivi.convoisJeu
   * @param {Array} notes voir notes
   * @return {Map<Object, Object>} convoi noté → sa ligne
   */
  static trouves(convois, notes) {
    let libres = notes.slice(),
      trouves = new Map(),
      prendre = (c, egal) => {
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
   * Ajoute des convois transmis au sujet du joueur (créé au premier envoi),
   * avec leur répartition si elle est connue (c.prevu, c.avance).
   *
   * @static
   * @method noter
   * @param {Array} convois voir OuafSuivi.convoisJeu
   * @return {Promise} rejetée si l'écriture a échoué
   */
  static noter(convois) {
    let nouveaux = convois.map((c) => ({
      arrivee: moment(c.arrivee).format("YYYY-MM-DD HH:mm"),
      vers: c.vers,
      montant: c.montant,
      id: c.id || 0,
      ...(c.prevu != null ? { prevu: c.prevu, avance: c.avance || 0 } : {}),
    }));
    if (!nouveaux.length) return Promise.resolve();
    return ConvoisForum._reecrire((anciens) => anciens.concat(nouveaux));
  }
  /**
   * Retire du sujet la ligne d'un convoi annulé, une seule : par numéro, sinon
   * (#0) par destinataire, montant et arrivée. Un convoi identique resté en
   * cours garde la sienne.
   *
   * @static
   * @method retirer
   * @param {Object} c {id, vers, montant, arrivee (ms)}
   * @return {Promise<Boolean>} ligne trouvée et retirée
   */
  static retirer(c) {
    let retiree = false;
    return ConvoisForum._reecrire((anciens) => {
      let i = anciens.findIndex((n) => c.id && n.id == c.id);
      if (i == -1)
        i = anciens.findIndex(
          (n) =>
            !n.id &&
            String(n.vers).toLowerCase() == c.vers.toLowerCase() &&
            n.montant == c.montant &&
            Math.abs(moment(n.arrivee, "YYYY-MM-DD HH:mm").valueOf() - c.arrivee) <=
              OUAF_ECART_ARRIVEE,
        );
      if (i == -1) return null;
      retiree = true;
      return anciens.filter((n, j) => j != i);
    }).then(() => retiree);
  }
  /**
   * Réécrit le sujet du joueur : `changer` reçoit ses lignes et rend les
   * nouvelles (null : rien à écrire). Les écritures d'une même page passent
   * l'une après l'autre.
   *
   * @private
   * @static
   */
  static _reecrire(changer) {
    let ecriture = fileConvoisForum
      .then(() => ConvoisForum._sujet())
      .then((s) =>
        ConvoisForum._contenu(s.id).then((anciens) => {
          let lignes = changer(anciens);
          if (!lignes) return;
          let message = ConvoisForum.ecrire(lignes, Horloge.serveur().format("YYYY-MM-DD HH:mm")),
            q = `sujet=${encodeURIComponent(s.titre)}&message=${encodeURIComponent(message)}&modifiable=envoyer&send=Envoyer`;
          return s.id
            ? PartageChasses._xajax(
                "envoiEditTopic",
                `<xjxquery><q>IDTopic=${s.id}&${q}</q></xjxquery>`,
              )
            : PartageChasses._xajax(
                "envoiNouveauSujet",
                `<xjxquery><q>cat=${PartageChasses.idSection}&${q}&type=normal&question=&reponse[]=&reponse[]=&reponse[]=</q></xjxquery>`,
              );
        }),
      );
    fileConvoisForum = ecriture.catch((e) =>
      console.error(`[${NOM_EXTENSION}] convois : écriture dans le forum impossible`, e),
    );
    return ecriture;
  }
}
