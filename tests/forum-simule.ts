/**
 * Forum d'alliance simulé pour les tests (requêtes xajax de
 * alliance.php?forum_menu), au HTML relevé le 14/11/2026 sur une capture du
 * mainteneur : un sujet est son titre, son premier message puis ses réponses,
 * chacun précédé de son auteur ; « Modifier » sur les messages du joueur,
 * « Effacer » sur le dernier du sujet s'il est le sien ; une écriture répond
 * par le sujet à jour. Pseudos et textes inventés.
 *
 * À exécuter dans la page (page.lire) : définit window.SIM. Un sujet est
 * {id, titre, auteur?, texte | messages[0] (premier message), reponses?:
 * [{id, auteur, texte}]}.
 */
export const FORUM_SIMULE = `(() => {
  const echapper = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const corps = (t) => echapper(t).replace(/\\n/g, "<br />");
  const lien = (fonction, id, image, texte) =>
    '<a href="#" onclick="' + fonction + '(' + id + '); return false;">\\n\\t\\t<img src="images/' + image + '" alt="' + texte + '"></a>';
  const bloc = (auteur, date, idDiv, liens, texte) =>
    '<div class="auteurForum"><a href="Membre.php?Pseudo=' + auteur + '">' + auteur + '</a><br/><span style="font-size:0.8em;white-space:nowrap;"> ' + date + "</span></div>" +
    '<div class="messageForum contenuJoueur"><div   id="' + idDiv + '" >' + liens + corps(texte) + "</div></div><hr/>";
  window.SIM = {
    prochain: 100000,
    q(args, k) {
      const m = new RegExp("[&>]" + k + "=([^&<]*)").exec(String(args));
      return m ? decodeURIComponent(m[1]) : null;
    },
    premier(s) {
      return s.texte != null ? s.texte : s.messages ? s.messages[0] : "";
    },
    html(s, moi) {
      const mien = (auteur) => String(auteur).toLowerCase() == String(moi || "").toLowerCase(),
        auteur = s.auteur || "DoggyBag",
        reponses = s.reponses || [];
      let h = "<h2>" + s.titre + "</h2>";
      h += bloc(auteur, "13 nov. à 22h03", "editTopic" + s.id,
        '<span style="position:float;margin-left:5px;float:right"></span>' +
          (mien(auteur) ? '<span style="position:float;margin-left:15px;float:right">' + lien("xajax_editTopic", s.id, "crayon.gif", "Modifier") + "\\n\\t\\t</span>" : ""),
        SIM.premier(s));
      reponses.forEach((r, i) => {
        const liens = mien(r.auteur)
          ? (i == reponses.length - 1 ? '<span style="position:float;margin-left:5px;float:right">' + lien("remove_message", r.id, "icone/supprimer.gif", "Effacer") + "</span>" : "") +
            '<span style="position:float;margin-left:15px;float:right">' + lien("xajax_editMessage", r.id, "crayon.gif", "Modifier") + "</span>"
          : "";
        h += bloc(r.auteur, "14 nov. à 10h47", "editMessage" + r.id, liens, r.texte);
      });
      return h + '<span style="position:absolute;margin-top:-400px;" id="bulle_premier_nonlu"></span>' +
        '<div onclick="xajax_repondre(' + s.id + '); return false;"><span>Répondre</span></div>';
    },
    // lecture d'un sujet et écritures des réponses ; null pour une autre requête
    traiter(sujets, f, args, moi) {
      const sujet = (id) => sujets.find((s) => s.id == id),
        reponse = (id) => {
          for (const s of sujets) {
            const i = (s.reponses || []).findIndex((r) => r.id == id);
            if (i != -1) return { s, i, r: s.reponses[i] };
          }
          return null;
        };
      if (f == "callGetTopic") {
        const s = sujet(args);
        return Promise.resolve(s ? SIM.html(s, moi) : "");
      }
      if (f == "envoiNouveauMessage") {
        const s = sujet(SIM.q(args, "topic"));
        if (!s) return Promise.resolve("");
        (s.reponses = s.reponses || []).push({ id: ++SIM.prochain, auteur: moi, texte: SIM.q(args, "message") });
        return Promise.resolve(SIM.html(s, moi));
      }
      if (f == "envoiEditMessage") {
        const t = reponse(SIM.q(args, "IDMessage"));
        if (!t) return Promise.resolve("");
        if (String(t.r.auteur).toLowerCase() == String(moi).toLowerCase()) t.r.texte = SIM.q(args, "message");
        return Promise.resolve(SIM.html(t.s, moi));
      }
      if (f == "callSupprimerMessage") {
        const t = reponse(args);
        if (!t) return Promise.resolve("");
        if (t.i == t.s.reponses.length - 1 && String(t.r.auteur).toLowerCase() == String(moi).toLowerCase()) t.s.reponses.splice(t.i, 1);
        return Promise.resolve(SIM.html(t.s, moi));
      }
      return null;
    },
  };
})()`;

/**
 * Sujet tel que le forum l'a renvoyé le 14/11/2026 après une réponse
 * (capture du mainteneur ; pseudos, textes et numéros remplacés) : premier
 * message d'Alpha, réponse de Beta, puis deux réponses d'Alpha, la dernière
 * avec « Effacer ».
 */
export const SUJET_RELEVE =
  '<h2>Sujet d\'essai</h2><div class="auteurForum"><a href="Membre.php?Pseudo=Alpha">Alpha</a><br/><span style="font-size:0.8em;white-space:nowrap;"> 13 nov. à 22h03</span></div><div class="messageForum contenuJoueur"><div   id="editTopic10" ><span style="position:float;margin-left:5px;float:right"></span><span style="position:float;margin-left:15px;float:right"><a href="#" onclick="xajax_editTopic(10); return false;">\n\t\t<img src="images/crayon.gif" alt="Modifier"></a>\n\t\t</span></div></div><hr/><div class="auteurForum"><a href="Membre.php?Pseudo=Beta">Beta</a><br/><span style="font-size:0.8em;white-space:nowrap;"> 14 nov. à 10h47</span></div><div class="messageForum contenuJoueur"><div   id="editMessage501" >texte de Beta</div></div><hr/><div class="auteurForum"><a href="Membre.php?Pseudo=Alpha">Alpha</a><br/><span style="font-size:0.8em;white-space:nowrap;"> 14 nov. à 10h47</span></div><div class="messageForum contenuJoueur"><div   id="editMessage502" ><span style="position:float;margin-left:5px;float:right"></span><span style="position:float;margin-left:15px;float:right"><a href="#" onclick="xajax_editMessage(502); return false;">\n\t\t<img src="images/crayon.gif" alt="Modifier"></a></span>texte d\'Alpha</div></div><hr/><div class="auteurForum"><a href="Membre.php?Pseudo=Alpha">Alpha</a><br/><span style="font-size:0.8em;white-space:nowrap;"> 14 nov. à 11h39</span></div><div class="messageForum contenuJoueur"><div   id="editMessage503" ><span style="position:float;margin-left:5px;float:right"><a href="#" onclick="remove_message(503); return false;">\n\t\t<img src="images/icone/supprimer.gif" alt="Effacer"></a></span><span style="position:float;margin-left:15px;float:right"><a href="#" onclick="xajax_editMessage(503); return false;">\n\t\t<img src="images/crayon.gif" alt="Modifier"></a></span>dernier texte d\'Alpha</div></div><hr/><span style="position:absolute;margin-top:-400px;" id="bulle_premier_nonlu" name="bulle_premier_nonlu"></span>\n<div style="height:23px;display:inline-block;position:relative;white-space:nowrap;cursor:pointer" onclick="xajax_repondre(10); return false;" >\n<img src="images/bouton/repondre_sujet_gauche.png"  />\n<div style="position:absolute;left:25px;top:0px;height:23px;background:url(\'images/bouton/nouveau_sujet_milieu.png\') repeat" >\n<span style="position:relative;top:-5px">\nRépondre\n</span><img style="position:relative;left:5px"src="images/bouton/nouveau_sujet_droite.png"  />\n</div>\n</div>\n';
