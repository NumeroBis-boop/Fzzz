// @ts-check
/*
 * PartageChasses.js
 * NumeroBis-boop
 **********************************************************************/

// section du forum d'alliance qui sert de stockage partagé (premier nom : celui
// créé par Fzzz ; les autres sont acceptés s'ils existent déjà)
const FORUM_SECTIONS_CHASSES = ["Fzzz-Chasses", "Fzzz_Chasses"];
// entrées gardées par sujet (les plus récentes)
const PARTAGE_MAX_ENTREES = 300;

// numéros des attaques déjà publiées dans le sujet « Floods » du joueur
const CLE_FLOODS_PARTAGES = "fzzz_floodsPartages";
// échéance (ms) du partage des chasses demandé par « Envoyer + partager »
const CLE_PARTAGE_CHASSES_APRES = "fzzz_partageChassesApres";
// lectures et écritures du sujet « Floods » d'une page, l'une après l'autre :
// une lecture partie avant une écriture rendrait un état périmé
let fileFloodsForum = Promise.resolve();

/**
 * Partage des chasses et des floods avec l'alliance, stocké dans son forum
 * (aucun serveur tiers). Deux sujets par joueur dans la section
 * « Fzzz-Chasses » : « Chasses | pseudo » et « Floods | pseudo » (et
 * « Convois | pseudo », voir ConvoisForum). Le premier
 * message du sujet contient tout l'historique, une ligne par entrée, et chaque
 * partage le réécrit (fusion sans doublon). La page membre lit les deux
 * sujets du joueur consulté.
 *
 * Chaque ligne porte un code lisible par Fzzz (« FZC|date|cm²| » pour une
 * chasse, « FZF|date|cible|cm²| » pour un flood) après le texte pour les humains.
 *
 * Requêtes : au clic sur Partager, au chargement de page qui suit un envoi
 * « + partager » ou l'annulation d'un flood partagé, et la lecture des sujets
 * à l'ouverture d'une page membre. Rien de périodique.
 *
 * @class PartageChasses
 */
class PartageChasses {
  /**
   * Passe `action` (lecture ou écriture du sujet « Floods ») après les
   * précédentes de la page.
   *
   * @static
   * @method enFile
   * @param {() => any} action renvoie une promesse
   * @return {Promise}
   */
  static enFile(action) {
    let p = fileFloodsForum.then(action);
    fileFloodsForum = p.catch(() => {});
    return p;
  }
  static get cle() {
    return "fzzz_forumChasses_" + Utils.serveur;
  }
  static get idSection() {
    try {
      return localStorage.getItem(PartageChasses.cle);
    } catch (e) {
      return null;
    }
  }
  static set idSection(id) {
    try {
      if (id) localStorage.setItem(PartageChasses.cle, id);
      else localStorage.removeItem(PartageChasses.cle);
    } catch (e) {}
  }
  static estSection(nom) {
    return FORUM_SECTIONS_CHASSES.includes(String(nom).trim());
  }
  /**
   * Requête xajax du forum d'alliance (même protocole que la page Forum).
   *
   * @static
   */
  static _xajax(fonction, args) {
    return Promise.resolve(
      $.ajax({
        type: "post",
        url: location.origin + "/alliance.php?forum_menu",
        data:
          args === undefined
            ? { xajax: fonction, xajaxr: moment().valueOf() }
            : { xajax: fonction, "xajaxargs[]": args, xajaxr: moment().valueOf() },
      }),
    );
  }
  /**
   * Texte HTML de toutes les commandes d'une réponse xajax.
   *
   * @static
   */
  static _html(data) {
    return $(data)
      .find("cmd")
      .map((i, c) => $(c).text())
      .get()
      .join("");
  }
  /**
   * Identifiant de la section : celui mémorisé, sinon lu dans la liste des
   * sections que renvoie le forum (le même appel que la page Forum du jeu).
   *
   * @static
   * @method trouverSection
   * @return {Promise<String>} rejetée avec Error("absente") si la section n'existe pas
   */
  static trouverSection() {
    if (PartageChasses.idSection) return Promise.resolve(PartageChasses.idSection);
    return PartageChasses._xajax("callGetForum").then((data) => {
      // DOMParser : le HTML du forum (écrit par des membres) n'exécute rien
      let $span = Utils.parseHtml(PartageChasses._html(data))
          .find("span[class^='forum']")
          .filter((i, e) => PartageChasses.estSection($(e).text()))
          .first(),
        id = $span.length ? ($span.attr("class").match(/\d+/) || [])[0] : null;
      if (!id) throw new Error("absente");
      PartageChasses.idSection = id;
      return id;
    });
  }
  /**
   * Pseudo ou cible lu dans le forum, texte libre écrit par un membre : les
   * caractères de balisage (< > & " ') n'existent pas dans un pseudo du jeu et
   * sont retirés, pour qu'aucune balise ne puisse être injectée.
   *
   * @static
   * @method nettoyer
   */
  static nettoyer(texte) {
    return String(texte || "")
      .replace(/[<>&"']/g, "")
      .trim();
  }
  /**
   * Sujets de la section : {"Chasses | pseudo": idSujet, ...}.
   *
   * @static
   * @method sujets
   */
  static sujets() {
    return PartageChasses.trouverSection().then((id) =>
      PartageChasses._xajax("callGetForum", id).then((data) => {
        let reponse = PartageChasses._html(data);
        if (!reponse.includes("form_cat")) {
          // identifiant périmé (section supprimée puis recréée) : on le relira
          PartageChasses.idSection = null;
          throw new Error("section inaccessible");
        }
        // clé « Type | pseudo en minuscules » → id ; sujets.liste garde la casse
        let sujets = { liste: [] };
        Utils.parseHtml(reponse)
          .find("#form_cat tr")
          .each((i, elt) => {
            let titre = $(elt).find("td:eq(1)").text().trim(),
              m = titre.match(/^(Chasses|Floods|Convois) \| (.+)$/),
              idSujet =
                $(elt).find("input[name='topic[]']").val() ||
                (($(elt).find("a.topic_forum").attr("onclick") || "").match(/\d+/) || [])[0];
            if (m && idSujet) {
              // titre écrit par un membre : caractères de balisage retirés
              let pseudo = PartageChasses.nettoyer(m[2]);
              sujets[`${m[1]} | ${pseudo.toLowerCase()}`] = idSujet;
              sujets.liste.push({ type: m[1], pseudo: pseudo, id: idSujet });
            }
          });
        return sujets;
      }),
    );
  }
  /**
   * Lignes de données (codes FZC / FZF) du premier message d'un sujet.
   *
   * @static
   * @method lireSujet
   */
  static lireSujet(idSujet) {
    return PartageChasses._xajax("callGetTopic", idSujet).then((data) => {
      let $div = Utils.parseHtml(PartageChasses._html(data));
      $div.find("br").replaceWith("\n");
      let texte = $div.text(),
        chasses = [],
        floods = [],
        m,
        // tolérant aux corrections à la main : 1 ou 2 chiffres, année sur 2 ou
        // 4 chiffres, « 02:46 » ou « 02h46 », espaces libres autour des « | »
        D = "(\\d{1,2})/(\\d{1,2})/(\\d{2,4})\\s+(\\d{1,2})[:hH](\\d{2})",
        N = "(\\d[\\d \\u00a0\\u202f.]*)\\s*cm",
        reC = new RegExp(`${D}\\s*\\|\\s*${N}`, "g"),
        // flood : « date | cible | [unités envoyées |] prise cm² [| TdC relevé] [| #id] »
        // (unités et TdC relevé depuis 1.19 ; numéro d'attaque depuis 1.18.5)
        U = "(\\d[\\d \\u00a0\\u202f.]*)\\s*unit[ée]s?",
        reF = new RegExp(
          `${D}\\s*\\|\\s*([^|\\n]+?)\\s*\\|\\s*(?:${U}\\s*\\|\\s*)?${N}²?(?:\\s*\\|\\s*TdC\\s*(\\d[\\d \\u00a0\\u202f.]*))?(?:\\s*\\|\\s*#(\\d+))?`,
          "g",
        ),
        // anciens relevés (Fzzz 1.13.0/1.13.1) : codes FZC / FZF, lus seulement
        // si le sujet n'a aucune ligne au format actuel
        reC0 = /FZC\|(\d{4}-\d\d-\d\d \d\d:\d\d)\|(\d+)\|/g,
        reF0 = /FZF\|(\d{4}-\d\d-\d\d \d\d:\d\d)\|([^|\s]+)\|(\d+)\|/g,
        date = (m) =>
          moment(
            `${m[1]}/${m[2]}/${m[3].length == 2 ? "20" + m[3] : m[3]} ${m[4]}:${m[5]}`,
            "D/M/YYYY H:mm",
          ).format("YYYY-MM-DD HH:mm"),
        nombre = (t) => parseInt(t.replace(/\D/g, ""));
      while ((m = reF.exec(texte)))
        floods.push({
          date: date(m),
          cible: PartageChasses.nettoyer(m[6]),
          unites: m[7] ? nombre(m[7]) : null,
          terrain: nombre(m[8]),
          tdcCible: m[9] ? nombre(m[9]) : null,
          id: m[10] ? parseInt(m[10]) : null,
        });
      // une ligne de flood contient aussi « date | … » : les chasses sont lues
      // sur le texte privé des lignes de flood
      let texteC = texte.replace(reF, "");
      while ((m = reC.exec(texteC))) chasses.push({ date: date(m), terrain: nombre(m[6]) });
      if (!chasses.length)
        while ((m = reC0.exec(texte))) chasses.push({ date: m[1], terrain: parseInt(m[2]) });
      if (!floods.length)
        while ((m = reF0.exec(texte)))
          floods.push({
            date: m[1],
            cible: PartageChasses.nettoyer(m[2]),
            terrain: parseInt(m[3]),
          });
      return { chasses: chasses, floods: floods };
    });
  }
  /**
   * Fusionne des entrées dans le sujet du joueur (créé au premier partage).
   *
   * @private
   * @param {String} type "Chasses" ou "Floods"
   * @param {Array} entrees [{date "AAAA-MM-JJ HH:mm", terrain, cible?, unites?}]
   * @return {Promise<Integer>} nombre d'entrées nouvelles
   */
  static _partager(type, entrees) {
    let pseudo = monProfil.pseudo,
      titre = `${type} | ${pseudo}`,
      // une chasse par minute ; un flood par attaque du jeu (un multi-flood
      // envoie plusieurs attaques sur la même cible à la même minute)
      cle = (e) => e.date + "|" + (e.cible || "") + "|" + (e.cible ? e.terrain : "");
    return PartageChasses.sujets().then((sujets) => {
      let idSujet = sujets[`${type} | ${pseudo.toLowerCase()}`];
      return (
        idSujet
          ? PartageChasses.lireSujet(idSujet).then((d) =>
              type == "Chasses" ? d.chasses : d.floods,
            )
          : Promise.resolve([])
      ).then((anciennes) => {
        let ids = anciennes.filter((e) => e.id).map((e) => e.id),
          // anciennes lignes sans numéro d'attaque : chacune ne couvre qu'un envoi
          sansId = anciennes.filter((e) => !e.id).map(cle),
          nouvelles = entrees.filter((e) => {
            if (e.id && ids.includes(e.id)) return false;
            let k = sansId.indexOf(cle(e));
            if (type == "Chasses" ? k != -1 : k != -1 && !e.id) return false;
            if (k != -1) {
              sansId.splice(k, 1);
              return false;
            }
            return true;
          });
        // les entrées passées sont retirées du sujet à chaque partage
        let maintenant = Horloge.serveur().format("YYYY-MM-DD HH:mm"),
          aVenir = anciennes.filter((e) => e.date >= maintenant);
        if (!nouvelles.length && aVenir.length == anciennes.length) return 0;
        let toutes = aVenir
            .concat(nouvelles.filter((e) => e.date >= maintenant))
            .sort((a, b) =>
              a.date < b.date ? 1 : a.date > b.date ? -1 : (b.id || 0) - (a.id || 0),
            )
            .slice(0, PARTAGE_MAX_ENTREES),
          message = toutes.map((e) => PartageChasses._ligne(type, e)).join("\n"),
          q = `sujet=${encodeURIComponent(titre)}&message=${encodeURIComponent(message)}&modifiable=envoyer&send=Envoyer`;
        return (
          idSujet
            ? PartageChasses._xajax(
                "envoiEditTopic",
                `<xjxquery><q>IDTopic=${idSujet}&${q}</q></xjxquery>`,
              )
            : PartageChasses._xajax(
                "envoiNouveauSujet",
                `<xjxquery><q>cat=${PartageChasses.idSection}&${q}&type=normal&question=&reponse[]=&reponse[]=&reponse[]=</q></xjxquery>`,
              )
        ).then(() => nouvelles.length);
      });
    });
  }
  /**
   * @private
   */
  static _ligne(type, e) {
    let date = moment(e.date, "YYYY-MM-DD HH:mm").format("DD/MM/YY HH:mm");
    return type == "Chasses"
      ? `${date} | ${numeral(e.terrain).format()} cm²`
      : `${date} | ${e.cible} | ${e.unites ? numeral(e.unites).format() + " unités | " : ""}${numeral(e.terrain).format()} cm²${e.tdcCible ? ` | TdC ${numeral(e.tdcCible).format()}` : ""}${e.id ? ` | #${e.id}` : ""}`;
  }
  /**
   * Bouton : désactivé pendant l'envoi, puis bilan.
   *
   * @private
   */
  static _avecBouton($bouton, type, entrees) {
    let libelle = type == "Chasses" ? "chasse" : "flood",
      accord = (n) => (type == "Chasses" ? "e" : "") + (n > 1 ? "s" : "");
    if (!entrees.length) {
      $.toast({ ...TOAST_INFO, text: `Aucun ${libelle} à partager.` });
      return Promise.resolve();
    }
    if ($bouton) $bouton.prop("disabled", true);
    return PartageChasses._partager(type, entrees)
      .then((n) => {
        // floods présents dans le sujet (nouveaux ou déjà publiés) : marqués partagés
        if (type == "Floods") {
          PartageChasses.marquerFloodsPartages(entrees.map((e) => e.id));
          AttaqueLancee.majPartages();
        }
        return n;
      })
      .then((n) =>
        $.toast({
          ...TOAST_SUCCESS,
          text: n
            ? `${n} ${libelle}${n > 1 ? "s" : ""} partagé${accord(n)} avec la ${Utils.alliance}.`
            : `Ces ${libelle}s étaient déjà partagé${accord(2)}.`,
        }),
      )
      .catch((e) =>
        $.toast({
          ...TOAST_ERROR,
          hideAfter: 10000,
          text:
            e && e.message == "absente"
              ? `Le forum de l'alliance n'a pas encore de section « ${FORUM_SECTIONS_CHASSES[0]} » : un chef peut la créer d'un clic depuis la page Forum (bouton ${NOM_EXTENSION}).`
              : `Partage impossible : le forum de l'alliance n'a pas pu être lu ou modifié.`,
        }),
      )
      .finally(() => $bouton && $bouton.prop("disabled", false));
  }
  /**
   * Retire des floods (numéros d'attaque) du sujet « Floods » du joueur ; les
   * entrées passées sont purgées au passage, comme lors d'un partage.
   *
   * @static
   * @method retirerFloods
   * @return {Promise}
   */
  static retirerFloods(ids, $bouton) {
    let pseudo = monProfil.pseudo,
      titre = `Floods | ${pseudo}`;
    if ($bouton) $bouton.prop("disabled", true);
    return PartageChasses.enFile(() => PartageChasses._retirerFloods(ids, $bouton, pseudo, titre));
  }
  /**
   * @private
   * @static
   */
  static _retirerFloods(ids, $bouton, pseudo, titre) {
    return PartageChasses.sujets()
      .then((sujets) => {
        let idSujet = sujets[`Floods | ${pseudo.toLowerCase()}`];
        if (!idSujet) return 0;
        return PartageChasses.lireSujet(idSujet).then((d) => {
          let maintenant = Horloge.serveur().format("YYYY-MM-DD HH:mm"),
            gardes = d.floods.filter((e) => e.date >= maintenant && !ids.includes(e.id)),
            retires = d.floods.filter((e) => ids.includes(e.id)).length,
            // un sujet ne peut pas être vide : ligne neutre, ignorée à la lecture
            message =
              gardes
                .sort((a, b) =>
                  a.date < b.date ? 1 : a.date > b.date ? -1 : (b.id || 0) - (a.id || 0),
                )
                .map((e) => PartageChasses._ligne("Floods", e))
                .join("\n") || "Aucun flood en cours.",
            q = `sujet=${encodeURIComponent(titre)}&message=${encodeURIComponent(message)}&modifiable=envoyer&send=Envoyer`;
          return PartageChasses._xajax(
            "envoiEditTopic",
            `<xjxquery><q>IDTopic=${idSujet}&${q}</q></xjxquery>`,
          ).then(() => retires);
        });
      })
      .then((n) => {
        PartageChasses.oublierFloodsPartages(ids);
        AttaqueLancee.majPartages();
        $.toast({
          ...TOAST_SUCCESS,
          text: n
            ? `${n} flood${n > 1 ? "s retirés" : " retiré"} du forum de la ${Utils.alliance}.`
            : "Ce flood n'était plus dans le forum.",
        });
      })
      .catch(() =>
        $.toast({
          ...TOAST_ERROR,
          text: "Retrait impossible : le forum de l'alliance n'a pas pu être lu ou modifié.",
        }),
      )
      .finally(() => $bouton && $bouton.prop("disabled", false));
  }
  /**
   * @static
   * @method oublierFloodsPartages
   */
  static oublierFloodsPartages(ids) {
    let liste = PartageChasses.floodsPartages();
    ids.forEach((id) => delete liste[id]);
    try {
      localStorage.setItem(CLE_FLOODS_PARTAGES, JSON.stringify(liste));
    } catch (e) {}
  }
  /**
   * Numéros des attaques déjà publiées dans le sujet « Floods » du joueur :
   * {id: date du marquage (ms)}. Tenu à jour à chaque partage depuis ce
   * navigateur, et sur la page Armée d'après la lecture du forum.
   *
   * @static
   * @method floodsPartages
   */
  static floodsPartages() {
    return Utils.lireStockage(CLE_FLOODS_PARTAGES, {});
  }
  /**
   * @static
   * @method marquerFloodsPartages
   */
  static marquerFloodsPartages(ids) {
    let liste = PartageChasses.floodsPartages(),
      limite = Date.now() - 7 * 86400000;
    ids.filter(Boolean).forEach((id) => (liste[id] = Date.now()));
    // attaques arrivées depuis longtemps : oubliées
    for (let id in liste) if (liste[id] < limite) delete liste[id];
    try {
      localStorage.setItem(CLE_FLOODS_PARTAGES, JSON.stringify(liste));
    } catch (e) {}
  }
  /**
   * Numéros d'attaque publiés dans le sujet « Floods » du joueur, lus sur le
   * forum (deux lectures : liste des sujets, puis le sien). Vide si le sujet
   * ou la section n'existe pas.
   *
   * @static
   * @method mesFloodsForum
   * @return {Promise<Array<Number>>}
   */
  static mesFloodsForum() {
    let pseudo = (monProfil.pseudo || "").toLowerCase();
    return PartageChasses.sujets().then((sujets) => {
      let id = sujets[`Floods | ${pseudo}`];
      return id
        ? PartageChasses.lireSujet(id).then((d) => d.floods.map((f) => f.id).filter(Boolean))
        : [];
    });
  }
  /**
   * État « partagé » des floods affichés recalé sur le forum, qui fait foi
   * entre appareils : publiés ailleurs → partagés ici, retirés ailleurs →
   * à partager ici.
   *
   * @static
   * @method recalerFloods
   * @param {Array<Number>} publies numéros présents dans le sujet du joueur
   * @param {Array<Number>} affiches numéros des attaques affichées
   */
  static recalerFloods(publies, affiches) {
    PartageChasses.marquerFloodsPartages(publies);
    PartageChasses.oublierFloodsPartages(affiches.filter((id) => !publies.includes(id)));
  }
  /**
   * Ressources.php : groupes de la synthèse des chasses.
   *
   * @static
   * @method partager
   * @param {Array} groupes [{impact (moment), terrain, unites (texte)}]
   */
  static partager(groupes, $bouton) {
    return PartageChasses._avecBouton(
      $bouton,
      "Chasses",
      groupes.map((g) => ({
        date: g.impact.format("YYYY-MM-DD HH:mm"),
        terrain: g.terrain,
      })),
    );
  }
  /**
   * Attaques capturées (AttaqueLancee) : floods sur le terrain de chasse dont
   * l'arrivée et la prise estimée sont connues.
   *
   * @static
   * @method partagerFloods
   */
  static partagerFloods(captures, $bouton) {
    if ($bouton) $bouton.prop("disabled", true);
    return PartageChasses.enFile(() => PartageChasses._partagerFloods(captures, $bouton));
  }
  /**
   * @private
   * @static
   */
  static _partagerFloods(captures, $bouton) {
    return PartageChasses._avecBouton(
      $bouton,
      "Floods",
      captures
        .filter((c) => c && c.arrivee && /terrain/i.test(c.lieu || ""))
        .map((c) => {
          let unites = Object.values(c.unite || {}).reduce((t, n) => t + (n || 0), 0),
            estimee =
              c.terrainDepart != null && c.terrainCible != null
                ? c.terrainDepart - c.terrainCible
                : null;
          return {
            // minute du RC (celle où le terrain change), comme le tableau des attaques
            date: Utils.minuteRC(moment(c.arrivee)).format("YYYY-MM-DD HH:mm"),
            cible: c.cible,
            // unités envoyées et prise estimée au lancement (règle des 20 %) ;
            // les synthèses recalculent la prise à l'impact (PartageChasses.simuler)
            unites: unites || null,
            terrain: estimee != null ? estimee : unites,
            // TdC de la cible connu au lancement (profil ou saisie du lanceur de flood)
            tdcCible: c.terrainConnu || c.terrainDepart || null,
            id: c.id,
          };
        })
        .filter((e) => e.terrain > 0),
    );
  }
  /**
   * Lit dans le forum les chasses (des joueurs demandés, ou de tous) et les
   * floods de tous les membres, par paquets de 4 sujets.
   *
   * @static
   * @method charger
   * @param {Array|null} chassesDe pseudos dont lire les chasses (null : tous)
   * @return {Promise<Object>} {chasses: {pseudo minuscule: [...]}, floods: [... avec lanceur]}
   */
  static charger(chassesDe = null) {
    return PartageChasses.sujets().then((sujets) => {
      let voulus = chassesDe ? chassesDe.map((p) => p.toLowerCase()) : null,
        liste = sujets.liste.filter(
          (t) =>
            t.type == "Floods" ||
            (t.type == "Chasses" && (!voulus || voulus.includes(t.pseudo.toLowerCase()))),
        ),
        d = { chasses: {}, floods: [] },
        lirePaquet = (k) =>
          k >= liste.length
            ? Promise.resolve()
            : Promise.all(
                liste.slice(k, k + 4).map((t) =>
                  PartageChasses.lireSujet(t.id)
                    .then((r) => {
                      if (t.type == "Chasses") d.chasses[t.pseudo.toLowerCase()] = r.chasses;
                      else r.floods.forEach((e) => d.floods.push({ ...e, lanceur: t.pseudo }));
                    })
                    .catch(() => {}),
                ),
              ).then(() => lirePaquet(k + 4));
      return lirePaquet(0).then(() => d);
    });
  }
  /**
   * Rejoue dans l'ordre d'arrivée les chasses et floods partagés à venir, en
   * suivant le TdC de chaque joueur concerné, pour estimer la prise réelle de
   * chaque flood à l'impact :
   *  - prise = min(unités envoyées, ⌊20 % du TdC de la cible à l'impact⌋) ;
   *  - aucune prise si, à l'impact, la cible n'est plus à portée du lanceur
   *    (TdC entre 50 % + 1 et 300 % − 1 de celui du lanceur, la règle de
   *    lancement du jeu ; c'est l'« opti-flood raté ») ;
   *  - TdC connus : ceux de la page (paramètre `connus`), sinon, pour une
   *    cible, le TdC relevé au lancement du flood le plus récent sur elle ;
   *    sans TdC connu pour la cible, la prise estimée au lancement est gardée.
   * À minute égale : les chasses d'abord, puis les floods dans l'ordre d'envoi.
   *
   * @static
   * @method simuler
   * @param {Object} d résultat de charger()
   * @param {Object} connus {pseudo: TdC actuel}
   * @return {Object} {evenements: [...], depart: {pseudo minuscule: TdC}}
   */
  static simuler(d, connus = {}) {
    let maintenant = Horloge.serveur().format("YYYY-MM-DD HH:mm"),
      tdc = {},
      releve = {};
    for (let p in connus) if (connus[p] > 0) tdc[p.toLowerCase()] = connus[p];
    d.floods.forEach((f) => {
      let c = f.cible.toLowerCase();
      if (f.tdcCible > 0 && (!releve[c] || (f.id || 0) >= releve[c].id))
        releve[c] = { id: f.id || 0, tdc: f.tdcCible };
    });
    for (let c in releve) if (tdc[c] == null) tdc[c] = releve[c].tdc;
    let depart = { ...tdc },
      evts = [];
    for (let p in d.chasses)
      (d.chasses[p] || []).forEach((e) =>
        evts.push({ type: "chasse", date: e.date, joueur: p, terrain: e.terrain, id: 0 }),
      );
    d.floods.forEach((f) => evts.push({ ...f, type: "flood", id: f.id || 0 }));
    evts = evts
      .filter((e) => e.date >= maintenant)
      .sort((a, b) =>
        a.date < b.date
          ? -1
          : a.date > b.date
            ? 1
            : a.type != b.type
              ? a.type == "chasse"
                ? -1
                : 1
              : a.id - b.id,
      );
    evts.forEach((e) => {
      if (e.type == "chasse") {
        e.prise = e.terrain;
        if (tdc[e.joueur] != null) tdc[e.joueur] += e.terrain;
        e.tdcApres = tdc[e.joueur];
        return;
      }
      let c = e.cible.toLowerCase(),
        l = e.lanceur.toLowerCase(),
        tc = tdc[c],
        tl = tdc[l],
        envoi = e.unites != null ? e.unites : e.terrain;
      e.tdcCibleAvant = tc;
      if (tc == null) {
        // TdC de la cible inconnu : prise estimée au lancement
        e.prise = e.terrain;
        e.statut = "inconnu";
      } else if (tl != null && (tc < tl * 0.5 + 1 || tc > tl * 3 - 1)) {
        e.prise = 0;
        e.statut = "portee";
      } else {
        let plafond = Math.floor(tc * 0.2);
        e.prise = Math.min(envoi, plafond);
        e.statut = envoi > plafond ? "plafond" : "ok";
      }
      if (tc != null) tdc[c] = tc - e.prise;
      if (tl != null) tdc[l] = tl + e.prise;
      e.tdcCibleApres = tdc[c];
      e.tdcLanceurApres = tdc[l];
    });
    return { evenements: evts, depart: depart };
  }
  /**
   * Variations à venir d'un joueur d'après une simulation : une ligne par
   * chasse ou par flood (même à la même minute), dans l'ordre.
   *
   * @static
   * @method chronologie
   * @return {Array} [{date, delta, unites, autre, statut, flood}]
   */
  static chronologie(sim, pseudo) {
    let p = pseudo.toLowerCase(),
      lignes = [];
    sim.evenements.forEach((e) => {
      if (e.type == "chasse") {
        if (e.joueur == p)
          lignes.push({ date: e.date, delta: e.prise, autre: "Chasse", flood: false });
        return;
      }
      let vers = e.cible.toLowerCase() == p,
        depuis = e.lanceur.toLowerCase() == p;
      if (vers == depuis) return;
      lignes.push({
        date: e.date,
        delta: vers ? -e.prise : e.prise,
        unites: e.unites,
        autre: vers ? e.lanceur : e.cible,
        lanceur: e.lanceur,
        cible: e.cible,
        statut: e.statut,
        flood: true,
      });
    });
    return lignes;
  }
  /**
   * Prise signée et colorée, avec la raison quand elle diffère des unités
   * envoyées : « (20 %) » plafonnée, « hors portée », « ~ » estimée au lancement.
   *
   * @static
   * @method libellePrise
   */
  static libellePrise(v, unite = " cm²") {
    let html =
      v.delta == 0
        ? `<span>0${unite}</span>`
        : `<span class='${v.delta > 0 ? "o_varPos" : "o_varNeg"}'>${v.delta > 0 ? "+" : "−"}${v.statut == "inconnu" ? "~" : ""}${numeral(Math.abs(v.delta)).format()}${unite}</span>`;
    if (v.statut == "plafond") html += " <small class='o_priseNote'>(20 %)</small>";
    else if (v.statut == "portee")
      html +=
        " <small class='o_priseNote' title='À l&#39;impact, la cible n&#39;est plus à portée (50 % à 300 % du TdC du lanceur) : opti-flood raté'>(hors portée)</small>";
    return html;
  }
  /**
   * Armee.php : floods en cours sur le joueur, au-dessus de « Troupes en
   * Garnison » : unités envoyées et TdC qu'ils prendront à l'impact
   * (simulation avec le TdC actuel du joueur et ses chasses partagées).
   *
   * @static
   * @method afficherArmee
   */
  static afficherArmee() {
    if (!Utils.affichage("floodsRecus")) return;
    let moi = monProfil.pseudo,
      $titre = $("#centre *")
        .filter(
          (i, e) =>
            /^\s*Troupes en Garnison/i.test(e.textContent) &&
            !$(e)
              .children()
              .filter((k, c) => /Troupes en Garnison/i.test(c.textContent)).length,
        )
        .first();
    if (!moi || !$titre.length) return;
    let $ancre = $titre.closest("table").length ? $titre.closest("table") : $titre;
    PartageChasses.enFile(() => PartageChasses.charger([moi]))
      .then((d) => {
        // mes floods publiés ou retirés, y compris depuis un autre appareil
        PartageChasses.recalerFloods(
          d.floods
            .filter((f) => f.id && f.lanceur.toLowerCase() == moi.toLowerCase())
            .map((f) => f.id),
          AttaqueLancee.idsAffiches(),
        );
        AttaqueLancee.majPartages();
        let sim = PartageChasses.simuler(d, { [moi]: Utils.terrain }),
          recus = PartageChasses.chronologie(sim, moi).filter(
            (v) => v.flood && v.delta <= 0 && v.cible.toLowerCase() == moi.toLowerCase(),
          ),
          html = "";
        if (!recus.length) html += "<p>Aucun flood partagé en cours sur toi.</p>";
        else {
          html += `<table class='o_attaquesLancees o_maxWidth centre' cellspacing='0'><thead><tr><th>#</th><th>Arrivée</th><th>Unités envoyées</th><th>TdC perdu (estimé)</th><th>Lanceur</th></tr></thead><tbody>`;
          recus.forEach((v, i) => {
            html += `<tr${i % 2 ? " class='ligne_paire'" : ""}><td>${i + 1}</td><td>${moment(v.date, "YYYY-MM-DD HH:mm").format("DD/MM HH[h]mm")}</td><td>${v.unites != null ? numeral(v.unites).format() : "?"}</td><td>${PartageChasses.libellePrise(v)}</td><td><a href='Membre.php?Pseudo=${encodeURIComponent(v.lanceur)}'>${Utils.echapper(v.lanceur)}</a></td></tr>`;
          });
          let unites = recus.reduce((t, v) => t + (v.unites || 0), 0),
            perte = recus.reduce((t, v) => t + v.delta, 0);
          html += `<tr class='o_syntheseTotal'><td></td><td>Total (${recus.length})</td><td>${numeral(unites).format()}</td><td>${PartageChasses.libellePrise({ delta: perte })}</td><td></td></tr></tbody></table>
            <p class='reduce'><em>Prise estimée à l'impact : au plus 20 % de ton TdC à ce moment, rien si tu sors de la portée du lanceur.</em></p>`;
        }
        $("#o_floodsRecus").remove();
        $ancre.before(
          "<div id='o_floodsRecus' class='boite_amelioration simulateur centre o_blocAttaques o_blocArmee'>" +
            Utils.spoiler(
              `Floods en cours sur ${moi} partagés avec la ${Utils.alliance} (${recus.length})`,
              html,
              "armeeFloodsRecus",
              "o_attaquesTitre",
              false,
            ) +
            "</div>",
        );
      })
      .catch(() => {});
  }
  /**
   * Page membre : chasses et floods partagés du joueur consulté, et évolution
   * de son TdC (unités envoyées et prise estimée à l'impact pour chaque flood).
   *
   * @static
   * @method afficherProfil
   */
  static afficherProfil(pseudo, terrain) {
    if (!Utils.affichage("profilPartages")) return;
    // chasses du joueur affiché (et les miennes, qui comptent pour mes floods) ;
    // floods de tous les membres : à chaque affichage, une correction faite dans
    // le forum est prise en compte
    PartageChasses.charger([pseudo, monProfil.pseudo])
      .then((d) => {
        let connus = { [pseudo]: terrain };
        if (monProfil.pseudo && Utils.terrain) connus[monProfil.pseudo] = Utils.terrain;
        let sim = PartageChasses.simuler(d, connus),
          vars = PartageChasses.chronologie(sim, pseudo),
          chasses = vars.filter((v) => !v.flood),
          floods = vars.filter((v) => v.flood),
          date = (v) => moment(v.date, "YYYY-MM-DD HH:mm").format("DD/MM/YY HH:mm"),
          lien = (p) =>
            `<a href='Membre.php?Pseudo=${encodeURIComponent(p)}'>${Utils.echapper(p)}</a>`,
          tableau = (titre, lignes, colonnes, cellules, total) => {
            let html = `<h3 class='o_partageTitre'>${titre} (${lignes.length})</h3>`;
            if (!lignes.length) return html + "<p class='centre'>Aucun partage en cours.</p>";
            html += `<table class='centre' cellspacing='0'><tr class='o_partageEntete'>${colonnes.map((t) => `<td>${t}</td>`).join("")}</tr>`;
            lignes.forEach((v, i) => {
              html += `<tr${i % 2 ? "" : " class='ligne_paire'"}>${cellules(v)
                .map((t) => `<td>${t}</td>`)
                .join("")}</tr>`;
            });
            return (
              html +
              `<tr class='o_syntheseTotal'>${total.map((t) => `<td>${t}</td>`).join("")}</tr></table>`
            );
          };
        let synthese = "";
        if (vars.length && terrain > 0) {
          let tdc = terrain,
            lignes = [
              `<tr class='o_partageEntete'><td></td><td>TdC</td><td>Variation</td><td>Unités</td><td>Avec</td></tr>`,
              `<tr><td>Actuellement</td><td>${numeral(tdc).format()} cm²</td><td></td><td></td><td></td></tr>`,
            ];
          vars.forEach((v) => {
            tdc += v.delta;
            lignes.push(
              `<tr><td>${moment(v.date, "YYYY-MM-DD HH:mm").format("DD/MM HH[h]mm")}</td><td>${numeral(tdc).format()} cm²</td><td class='o_partageVariation'>${PartageChasses.libellePrise(v, "")}</td><td class='o_partageVariation'>${v.flood && v.unites != null ? numeral(v.unites).format() : ""}</td><td class='o_allInfoCible'>${Utils.echapper(v.autre)}</td></tr>`,
            );
          });
          synthese =
            "<div class='o_partageSeparation'></div>" +
            `<div class='o_partageSynthese'>` +
            `<h3 class='o_partageTitre'>Évolution du TdC de ${pseudo}</h3>
              <table class='centre' cellspacing='0'>${lignes.join("")}</table>` +
            "</div>";
        }
        let unitesFloods = floods.reduce((t, v) => t + (v.unites || 0), 0),
          netFloods = floods.reduce((t, v) => t + v.delta, 0);
        $("#o_chassesPartagees").remove();
        // entre le bloc « Action » et la suite de la page
        let $action = $(".boite_membre").filter((i, e) => /^\s*Action/.test($(e).text()));
        ($action.length ? $action.first() : $(".boite_membre").last()).after(
          `<div id='o_chassesPartagees' class='boite_membre'>` +
            // un seul dépliant pour tout l'encart
            Utils.spoiler(
              `Chasses et floods en cours partagés avec la ${Utils.alliance}`,
              tableau(
                `Chasses en cours partagées avec la ${Utils.alliance}`,
                chasses,
                ["Heure d'impact", "TdC chassé"],
                (v) => [date(v), numeral(v.delta).format() + " cm²"],
                [
                  `Total (${chasses.length})`,
                  numeral(chasses.reduce((t, v) => t + v.delta, 0)).format() + " cm²",
                ],
              ) +
                "<div class='o_partageSeparation'></div>" +
                tableau(
                  `Floods en cours depuis ou vers ${pseudo} partagés avec la ${Utils.alliance}`,
                  floods,
                  ["Arrivée", "Unités envoyées", "TdC pris (estimé)", "Lanceur → cible"],
                  (v) => [
                    date(v),
                    v.unites != null ? numeral(v.unites).format() : "?",
                    PartageChasses.libellePrise(v),
                    `${lien(v.lanceur)} → ${lien(v.cible)}`,
                  ],
                  [
                    `Total (${floods.length})`,
                    numeral(unitesFloods).format(),
                    PartageChasses.libellePrise({ delta: netFloods }),
                    "",
                  ],
                ) +
                synthese,
              "profilPartages",
              "o_partageTitre o_partageSpoiler",
            ) +
            "</div>",
        );
      })
      .catch(() => {});
  }
  /**
   * Forum d'alliance : repère la section (et propose de la créer).
   *
   * @static
   * @method observerForum
   */
  static observerForum() {
    let $alliance = $("#alliance");
    if (!$alliance.length) return;
    let traiter = () => {
      let $span = $alliance
        .find("span[class^='forum']")
        .filter((i, e) => PartageChasses.estSection($(e).text()))
        .first();
      if ($span.length) {
        let id = ($span.attr("class").match(/\d+/) || [])[0];
        if (id) PartageChasses.idSection = id;
        $("#o_creerSectionChasses").remove();
      } else if ($alliance.find("#cat_forum").length && !$("#o_creerSectionChasses").length) {
        $alliance
          .find("#cat_forum")
          .after(
            `<div id='o_creerSectionChasses' class='centre o_marginT15'><button type='button' class='o_button f_info'>${NOM_EXTENSION} : créer la section cachée « ${FORUM_SECTIONS_CHASSES[0]} » (partage des chasses)</button></div>`,
          );
        $("#o_creerSectionChasses button").on("click", (e) => {
          $(e.currentTarget).prop("disabled", true);
          PartageChasses._creerSection().then(
            () => location.reload(),
            () => {
              $(e.currentTarget).prop("disabled", false);
              $.toast({
                ...TOAST_ERROR,
                text: "Création impossible : il faut les droits de gestion du forum.",
              });
            },
          );
        });
      }
    };
    traiter();
    new MutationObserver(traiter).observe($alliance[0], { childList: true, subtree: true });
  }
  /**
   * Crée la section puis la passe en « cachée » (le jeu ne permet pas de la
   * créer directement cachée).
   *
   * @private
   */
  static _creerSection() {
    let nom = FORUM_SECTIONS_CHASSES[0];
    return PartageChasses._xajax("ajoutCategorie", `<xjxquery><q>nom=${nom}</q></xjxquery>`).then(
      (data) => {
        let reponse = Utils.parseHtml($(data).find("cmd:eq(1)").text() || "");
        let id = ($(reponse).find(`input[value='${nom}']`).parent().attr("id") || "").match(/\d+/);
        if (!id) throw new Error("section non créée");
        PartageChasses.idSection = id[0];
        return PartageChasses._xajax(
          "renommerCategorie",
          `<xjxquery><q>nom=${nom}&type=cache&ID_cat=${id[0]}&del=Supprimer</q></xjxquery>`,
        );
      },
    );
  }
}
