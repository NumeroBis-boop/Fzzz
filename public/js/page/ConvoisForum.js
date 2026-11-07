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
   * Lignes de convois d'un texte de sujet.
   *
   * @static
   * @method lire
   * @param {String} texte
   * @return {Array} [{arrivee "AAAA-MM-JJ HH:mm", vers, montant, id}]
   */
  static lire(texte) {
    let re =
        /(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2})[:hH](\d{2})\s*\|\s*([^|\n]+?)\s*\|\s*(\d[\d   .]*)\s*\|\s*#(\d+)/g,
      convois = [],
      m;
    while ((m = re.exec(String(texte || ""))))
      convois.push({
        arrivee: moment(
          `${m[1]}/${m[2]}/${m[3].length == 2 ? "20" + m[3] : m[3]} ${m[4]}:${m[5]}`,
          "D/M/YYYY H:mm",
        ).format("YYYY-MM-DD HH:mm"),
        vers: PartageChasses.nettoyer(m[6]),
        montant: parseInt(m[7].replace(/\D/g, "")),
        id: parseInt(m[8]),
      });
    return convois;
  }
  /**
   * Texte du sujet : convois pas encore arrivés, plus récents en premier.
   *
   * @static
   * @method ecrire
   * @param {Array} convois [{arrivee, vers, montant, id}]
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
          `${moment(c.arrivee, "YYYY-MM-DD HH:mm").format("DD/MM/YY HH:mm")} | ${c.vers} | ${numeral(c.montant).format()} | #${c.id}`,
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
   * @return {Set<Object>} convois notés
   */
  static trouves(convois, notes) {
    let libres = notes.slice(),
      trouves = new Set(),
      prendre = (c, egal) => {
        let i = libres.findIndex(egal);
        if (i == -1) return;
        libres.splice(i, 1);
        trouves.add(c);
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
   * Ajoute des convois transmis au sujet du joueur (créé au premier envoi).
   * Les écritures d'une même page passent l'une après l'autre.
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
    }));
    if (!nouveaux.length) return Promise.resolve();
    let ecriture = fileConvoisForum
      .then(() => ConvoisForum._sujet())
      .then((s) =>
        ConvoisForum._contenu(s.id).then((anciens) => {
          let message = ConvoisForum.ecrire(
              anciens.concat(nouveaux),
              Horloge.serveur().format("YYYY-MM-DD HH:mm"),
            ),
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
      console.error(`[${NOM_EXTENSION}] convois : note dans le forum impossible`, e),
    );
    return ecriture;
  }
}
