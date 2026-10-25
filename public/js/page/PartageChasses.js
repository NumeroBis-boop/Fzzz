/*
 * PartageChasses.js
 * NumeroBis-boop
 **********************************************************************/

// section du forum d'alliance qui sert de stockage partagé (premier nom : celui
// créé par Fzzz ; les autres sont acceptés s'ils existent déjà)
const FORUM_SECTIONS_CHASSES = ["Fzzz-Chasses", "Fzzz_Chasses"];
// entrées gardées par sujet (les plus récentes)
const PARTAGE_MAX_ENTREES = 300;

/**
 * Partage des chasses et des floods avec l'alliance, stocké dans son forum
 * (aucun serveur tiers). Deux sujets par joueur dans la section
 * « Fzzz-Chasses » : « Chasses | pseudo » et « Floods | pseudo ». Le premier
 * message du sujet contient tout l'historique, une ligne par entrée, et chaque
 * partage le réécrit (fusion sans doublon). La page membre lit les deux
 * sujets du joueur consulté.
 *
 * Chaque ligne porte un code lisible par Fzzz (« FZC|date|cm²| » pour une
 * chasse, « FZF|date|cible|cm²| » pour un flood) après le texte pour les humains.
 *
 * Requêtes : au clic sur Partager, et la lecture des sujets à l'ouverture
 * d'une page membre. Rien de périodique.
 *
 * @class PartageChasses
 */
class PartageChasses {
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
   * @private
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
   * @private
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
      let $span = $("<div/>")
          .append(PartageChasses._html(data))
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
        $("<div/>")
          .append(reponse)
          .find("#form_cat tr")
          .each((i, elt) => {
            let titre = $(elt).find("td:eq(1)").text().trim(),
              m = titre.match(/^(Chasses|Floods) \| (.+)$/),
              idSujet =
                $(elt).find("input[name='topic[]']").val() ||
                (($(elt).find("a.topic_forum").attr("onclick") || "").match(/\d+/) || [])[0];
            if (m && idSujet) {
              sujets[`${m[1]} | ${m[2].trim().toLowerCase()}`] = idSujet;
              sujets.liste.push({ type: m[1], pseudo: m[2].trim(), id: idSujet });
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
      let $div = $("<div/>").append(PartageChasses._html(data));
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
        reF = new RegExp(`${D}\\s*\\|\\s*([^|\\n]+?)\\s*\\|\\s*${N}`, "g"),
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
        floods.push({ date: date(m), cible: m[6].trim(), terrain: nombre(m[7]) });
      // une ligne de flood contient aussi « date | … » : les chasses sont lues
      // sur le texte privé des lignes de flood
      let texteC = texte.replace(reF, "");
      while ((m = reC.exec(texteC))) chasses.push({ date: date(m), terrain: nombre(m[6]) });
      if (!chasses.length)
        while ((m = reC0.exec(texte))) chasses.push({ date: m[1], terrain: parseInt(m[2]) });
      if (!floods.length)
        while ((m = reF0.exec(texte)))
          floods.push({ date: m[1], cible: m[2], terrain: parseInt(m[3]) });
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
      cle = (e) => e.date + "|" + (e.cible || "");
    return PartageChasses.sujets().then((sujets) => {
      let idSujet = sujets[`${type} | ${pseudo.toLowerCase()}`];
      return (
        idSujet
          ? PartageChasses.lireSujet(idSujet).then((d) =>
              type == "Chasses" ? d.chasses : d.floods,
            )
          : Promise.resolve([])
      ).then((anciennes) => {
        let connues = anciennes.map(cle),
          nouvelles = entrees.filter((e) => !connues.includes(cle(e)));
        if (!nouvelles.length) return 0;
        let toutes = anciennes
            .concat(nouvelles)
            .sort((a, b) => (a.date < b.date ? 1 : -1))
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
      : `${date} | ${e.cible} | ${numeral(e.terrain).format()} cm²`;
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
      return;
    }
    $bouton.prop("disabled", true);
    PartageChasses._partager(type, entrees)
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
              ? `Le forum de l'alliance n'a pas encore de section « ${FORUM_SECTIONS_CHASSES[0]} » : un chef peut la créer d'un clic depuis la page Forum (bouton Fzzz).`
              : `Partage impossible : le forum de l'alliance n'a pas pu être lu ou modifié.`,
        }),
      )
      .finally(() => $bouton.prop("disabled", false));
  }
  /**
   * Ressources.php : groupes de la synthèse des chasses.
   *
   * @static
   * @method partager
   * @param {Array} groupes [{impact (moment), terrain, unites (texte)}]
   */
  static partager(groupes, $bouton) {
    PartageChasses._avecBouton(
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
    PartageChasses._avecBouton(
      $bouton,
      "Floods",
      captures
        .filter(
          (c) =>
            c &&
            c.arrivee &&
            /terrain/i.test(c.lieu || "") &&
            c.terrainDepart != null &&
            c.terrainCible != null &&
            c.terrainDepart > c.terrainCible,
        )
        .map((c) => ({
          // minute du RC (celle où le terrain change), comme le tableau des attaques
          date: Utils.minuteRC(moment(c.arrivee)).format("YYYY-MM-DD HH:mm"),
          cible: c.cible,
          terrain: c.terrainDepart - c.terrainCible,
        })),
    );
  }
  /**
   * Page membre : chasses et floods partagés par le joueur consulté.
   *
   * @static
   * @method afficherProfil
   */
  static afficherProfil(pseudo, terrain) {
    let cible = pseudo.toLowerCase();
    PartageChasses.sujets()
      .then((sujets) => {
        let idChasses = sujets[`Chasses | ${cible}`],
          sujetsFloods = sujets.liste.filter((t) => t.type == "Floods");
        // chasses du joueur affiché ; floods de tous les membres dirigés vers lui
        // (lecture des sujets « Floods » par paquets de 4, à chaque affichage :
        // une correction faite dans le forum est donc prise en compte)
        let floods = [],
          lirePaquet = (k) =>
            k >= sujetsFloods.length
              ? Promise.resolve()
              : Promise.all(
                  sujetsFloods.slice(k, k + 4).map((t) =>
                    PartageChasses.lireSujet(t.id)
                      .then((d) =>
                        d.floods.forEach((e) => {
                          // vers le joueur : perte ; depuis le joueur : prise
                          let vers = e.cible.toLowerCase() == cible,
                            depuis = t.pseudo.toLowerCase() == cible;
                          if (vers != depuis)
                            floods.push({
                              ...e,
                              lanceur: t.pseudo,
                              delta: vers ? -e.terrain : e.terrain,
                            });
                        }),
                      )
                      .catch(() => {}),
                  ),
                ).then(() => lirePaquet(k + 4));
        return Promise.all([
          idChasses ? PartageChasses.lireSujet(idChasses).then((d) => d.chasses) : [],
          lirePaquet(0).then(() => floods),
        ]);
      })
      .then(([chasses, floods]) => {
        let tableau = (titre, entrees, colonnes, cellules) => {
          let html = `<h3 class='o_partageTitre'>${titre}</h3>`;
          if (!entrees.length) return html + "<p class='centre'>Aucun partage en cours.</p>";
          html += `<table class='centre' cellspacing='0'><tr class='o_partageEntete'>${colonnes.map((t) => `<td>${t}</td>`).join("")}</tr>`;
          entrees.forEach((e, i) => {
            html += `<tr${i % 2 ? "" : " class='ligne_paire'"}>${cellules(e)
              .map((t) => `<td>${t}</td>`)
              .join("")}</tr>`;
          });
          let somme = entrees.reduce((t, e) => t + (e.delta != null ? e.delta : e.terrain), 0),
            total = entrees.some((e) => e.delta != null)
              ? signe(somme)
              : `${numeral(somme).format()} cm²`;
          return (
            html +
            `<tr class='o_syntheseTotal'><td>Total (${entrees.length})</td><td>${total}</td>${colonnes.length > 2 ? "<td></td>" : ""}</tr></table>`
          );
        };
        // « +2 340 cm² » en vert, « −2 340 cm² » en rouge
        function signe(v, unite = " cm²") {
          return `<span class='${v >= 0 ? "o_varPos" : "o_varNeg"}'>${v >= 0 ? "+" : "−"}${numeral(Math.abs(v)).format()}${unite}</span>`;
        }
        let date = (e) => moment(e.date, "YYYY-MM-DD HH:mm").format("DD/MM/YY HH:mm"),
          // en cours : impact pas encore passé (heure du serveur)
          maintenant = Horloge.serveur().format("YYYY-MM-DD HH:mm"),
          enCours = (liste) =>
            liste.filter((e) => e.date >= maintenant).sort((a, b) => (a.date < b.date ? -1 : 1));
        // synthèse : TdC du joueur après chaque minute où il varie (chasse +, flood −)
        let variations = {};
        enCours(chasses).forEach(
          (e) => (variations[e.date] = (variations[e.date] || 0) + e.terrain),
        );
        enCours(floods).forEach((e) => (variations[e.date] = (variations[e.date] || 0) + e.delta));
        let synthese = "";
        if (Object.keys(variations).length && terrain > 0) {
          let tdc = terrain,
            lignes = [
              `<tr><td>${Horloge.serveur().format("DD/MM HH[h]mm")}</td><td>${numeral(tdc).format()} cm²</td><td></td></tr>`,
            ];
          Object.keys(variations)
            .sort()
            .forEach((d) => {
              tdc += variations[d];
              lignes.push(
                `<tr><td>${moment(d, "YYYY-MM-DD HH:mm").format("DD/MM HH[h]mm")}</td><td>${numeral(tdc).format()} cm²</td><td class='o_partageVariation'>(${signe(variations[d], "")})</td></tr>`,
              );
            });
          synthese =
            "<div class='o_partageSeparation'></div>" +
            `<div class='o_partageSynthese'><h3 class='o_partageTitre'>Évolution du TdC de ${pseudo}</h3>
              <table class='centre' cellspacing='0'>${lignes.join("")}</table>
              <p class='o_partageAvertissement'><em>En cas d'opti-flood raté, les niveaux de TdC sont mal estimés.</em></p></div>`;
        }
        $("#o_chassesPartagees").remove();
        // entre le bloc « Action » et la suite de la page
        let $action = $(".boite_membre").filter((i, e) => /^\s*Action/.test($(e).text()));
        ($action.length ? $action.first() : $(".boite_membre").last()).after(
          `<div id='o_chassesPartagees' class='boite_membre'>` +
            tableau(
              `Chasses en cours partagées avec la ${Utils.alliance}`,
              enCours(chasses),
              ["Heure d'impact", "TdC chassé"],
              (e) => [date(e), numeral(e.terrain).format() + " cm²"],
            ) +
            "<div class='o_partageSeparation'></div>" +
            tableau(
              `Floods en cours depuis ou vers ${pseudo} partagés avec la ${Utils.alliance}`,
              enCours(floods),
              ["Arrivée", "TdC (estimé)", "Lanceur → cible"],
              (e) => [
                date(e),
                signe(e.delta),
                `<a href='Membre.php?Pseudo=${encodeURIComponent(e.lanceur)}'>${e.lanceur}</a> → <a href='Membre.php?Pseudo=${encodeURIComponent(e.cible)}'>${e.cible}</a>`,
              ],
            ) +
            synthese +
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
            `<div id='o_creerSectionChasses' class='centre o_marginT15'><button type='button' class='o_button f_info'>Fzzz : créer la section cachée « ${FORUM_SECTIONS_CHASSES[0]} » (partage des chasses)</button></div>`,
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
