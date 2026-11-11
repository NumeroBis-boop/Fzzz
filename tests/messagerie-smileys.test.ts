import { beforeEach, describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Smileys de l'alliance dans la Messagerie (1.103.0, demande du mainteneur) :
 * bouton « Smileys OUAF » au bout de la barre de mise en forme du nouveau
 * message et de chaque réponse ; un clic écrit le code {nom} du smiley, que
 * l'extension remplace par [img]adresse[/img] quand le joueur clique sur
 * « Envoyer » ou « Répondre », avant que le jeu lise le message.
 */
const nouvellePage = () =>
  creerPage(
    [
      "js/class/Utils.js",
      "js/page/PartageChasses.js",
      "js/page/ChatGif.js",
      "js/page/MessagerieFzzz.js",
      "js/page/Messagerie.js",
    ],
    `var heure = moment("2026-11-11 12:00", "YYYY-MM-DD HH:mm").valueOf();
   var Horloge = { maintenant: () => heure, serveur: () => moment(heure) };
   var monProfil = { pseudo: "DoggyBag", parametre: { couleurMessagerie: { valeur: "#000000", sauvegarde() {} } } };
   var TOAST_INFO = {}, TOAST_WARNING = {}, TOAST_ERROR = {}, TOAST_SUCCESS = {};
   var IMG_COPIER = "copier.png";
   var LISTESMILEY1 = "", LISTESMILEY2 = "", LISTESMILEY3 = "", LISTESMILEY4 = "", LISTESMILEY5 = "", LISTESMILEY6 = "";`,
  );
// une page par test : l'écoute des envois, posée une fois par page, ne passe pas de l'un à l'autre
let page = nouvellePage();
const lire = <T = any>(e: string) => page.lire<T>(e);
const attendre = (ms = 0) => new Promise((r) => setTimeout(r, ms));

const KROKMOU = "https://i.postimg.cc/aaa/Krokmou-1.png";
const COLLEY = "https://i.postimg.cc/ccc/colley.png";
const SUJET = `Membres :<br/><img src="${KROKMOU}"/><br/>Génériques :<br/><img src="${COLLEY}"/>`;

// barre du nouveau message en Compte+, comme le jeu l'écrit (10/11/2026)
const BARRE_JEU = `<span id="barreJeu" style="cursor: pointer;position:relative;top:3px">
  <img onclick="miseEnForme('message_envoi','gras');" src="images/BBCode/bold.png"/>
  <img onclick="miseEnForme('message_envoi','ally');" src="images/BBCode/groupe.gif"/></span>`;
const ecrire = (barre = BARRE_JEU) => `<div id="contenu_ecrire_nouveau_message">
  <div><span><textarea id="message_envoi" name="message"></textarea></span></div>
  <div id="smileys_nouveau_message"><span><div id="tousLesSmiley0" class="tousLesSmiley"><div id="listeSmiley10">
    <img src="images/smiley/tongue.gif" onclick="addRaccourciSmiley('message_envoi','tongue')"/></div></div></span></div>
  <div id="barre_bbcode_nouveau_message"><span><input type="button" id="bt_envoi_message" value="Envoyer"/></span>
    <span><span id="smileyPrecedent0"></span><span><img onclick="changerCookieSmiley('0')" src="images/BBCode/smile.gif"/></span><span id="smileySuivant0"></span>
      <strong id="boutonCouleur" onclick="spoilerId('listeCouleur0')">A</strong>${barre}<span id="message_autosave_0" style="display:none">Sauvegarde en cours ...</span></span></div>
  <div><span><div id="listeCouleur0" class="listeCouleur" style="display: none"><img src="images/BBCode/000000.gif" onclick="miseEnCouleur('0','message_envoi','000000');"/></div></span></div>
</div>`;
// réponse d'une conversation ouverte : identifiants du script de la messagerie du jeu
const reponse = (
  id: number,
  barre = true,
) => `<tr class="contenu_conversation" id="reaction_${id}"><td>
  <textarea id="champ_reponse_${id}" class="champs_reaction_${id}"></textarea>
  ${
    barre
      ? `<div id="champ_bbcode_${id}" class="champs_reaction_${id}"><span id="smileySuivant${id}"></span><span>
    <img onclick="miseEnForme('champ_reponse_${id}','gras');" src="images/BBCode/bold.png"/>
    <img onclick="miseEnForme('champ_reponse_${id}','ally');" src="images/BBCode/groupe.gif"/></span></div>`
      : ""
  }
  <div id="reaction_message_${id}"><span class="reaction_choisie" id="repondre_tous_${id}"><b>Répondre</b></span>
    <span class="autre_reaction" id="repondre_unique_${id}">Répondre à un seul</span>
    <span class="autre_reaction" id="supprimer_${id}">Corbeille</span></div>
</td></tr>`;

beforeEach(() => {
  page = nouvellePage();
  lire(`(() => {
    localStorage.clear();
    window.TOASTS = [];
    $.toast = (o) => { TOASTS.push(o.text); return {}; };
    window.FORUM = { sujets: [{ id: "8", titre: "Smileys de l'alliance", messages: [${JSON.stringify(SUJET)}] }], appels: [], echoue: false };
    PartageChasses.idSection = "7";
    PartageChasses._html = (d) => d;
    PartageChasses._xajax = (f, args) => {
      FORUM.appels.push(f);
      if (FORUM.echoue) return Promise.reject(new Error("forum"));
      if (f == "callGetForum")
        return Promise.resolve('<form id="form_cat"><table>' + FORUM.sujets.map((s) => '<tr><td><input name="topic[]" value="' + s.id + '"/></td><td>' + s.titre + '</td></tr>').join("") + "</table></form>");
      if (f == "callGetTopic") {
        const s = FORUM.sujets.find((s) => s.id == args);
        return Promise.resolve(s ? s.messages.map((m) => '<div class="messageForum">' + m + "</div>").join("") : "");
      }
      return Promise.resolve("");
    };
  })()`);
});

// messagerie ouverte ; `comptePlus` : le menu du jeu qui le signale
const ouvrir = (
  corps = ecrire(),
  { cases = {}, comptePlus = true }: { cases?: Record<string, boolean>; comptePlus?: boolean } = {},
) =>
  lire(`(() => {
    ["messagerieCouleurs", "messagerieCopie", "messagerieAnalyse", "messagerieExport", "messagerieRanger",
      "messagerieMiseEnForme", "messagerieSmileys"].forEach((c) => localStorage.setItem("fzzz_affichage_" + c, "0"));
    Object.entries(${JSON.stringify(cases)}).forEach(([c, oui]) =>
      localStorage.setItem("fzzz_affichage_" + c, oui ? "1" : "0"));
    document.body.innerHTML = "<span id='tag_alliance'>OUAF</span>" +
      ${JSON.stringify(comptePlus ? `<ul id="menuComptePlus"><li><a class="boutonStatJoueur">Stat</a></li></ul>` : "")} +
      "<div id='corps_messagerie'>" + ${JSON.stringify(corps)} + "<div id='liste_conversations'><table id='table_liste_conversations'><tbody></tbody></table></div></div>";
    // le jeu lit le message au clic, depuis un élément parent
    window.LUS = [];
    $("#contenu_ecrire_nouveau_message").on("click", "#bt_envoi_message", () => LUS.push($("#message_envoi").val()));
    $("#liste_conversations").on("click", ".reaction_choisie", function () {
      let id = this.id.match(/[0-9]+/)[0];
      if (/^repondre_/.test(this.id)) LUS.push($("#champ_reponse_" + id).val());
    });
    new PageMessagerie().executer();
  })()`);
const ouvrirConversation = async (id: number, barre = true) => {
  lire(`$("#table_liste_conversations tbody").append(${JSON.stringify(reponse(id, barre))})`);
  // l'extension suit les lignes que le jeu ajoute
  await attendre(120);
};
const clic = (selecteur: string) =>
  lire(`document.querySelector(${JSON.stringify(selecteur)}).click()`);
const appels = () => lire<string[]>(`FORUM.appels.slice()`);
const lus = () => lire<string[]>(`LUS.slice()`);

describe("nouveau message : bouton « Smileys OUAF »", () => {
  test("au bout de la barre de mise en forme, après les boutons du jeu ; son panneau dans la barre ; rien lu à l'ouverture de la page", async () => {
    ouvrir();
    await attendre();
    expect(
      lire(`(() => {
        let $b = $("#barre_bbcode_nouveau_message .o_smileysBouton");
        return [$b.length, $b.prop("tagName") + "/" + $b.attr("type") + "/" + $b.val(), $b.prev().attr("id"),
          $b[0].previousSibling.nodeValue, $b.next().attr("id"),
          $("#barre_bbcode_nouveau_message").children().last().attr("class"), $(".o_smileysPanneau").prop("hidden")];
      })()`),
    ).toEqual([
      1,
      "INPUT/button/Smileys OUAF",
      "barreJeu",
      " ",
      "message_autosave_0",
      "o_smileysPanneau",
      true,
    ]);
    expect(appels()).toEqual([]);
  });

  test("premier clic : le sujet est lu ; les smileys sous leurs titres ; un clic écrit le code au curseur et ferme le panneau", async () => {
    ouvrir();
    lire(
      `(() => { let c = $("#message_envoi")[0]; c.value = "Bien joué"; c.setSelectionRange(4, 4); })()`,
    );
    clic(".o_smileysBouton");
    await attendre();
    expect(appels()).toEqual(["callGetForum", "callGetTopic"]);
    expect(
      lire(
        `$(".o_smileysPanneau details").map((i, d) => [[d.querySelector("summary").textContent, $(d).find(".o_smileyChoix").map((j, b) => b.title).get()]]).get()`,
      ),
    ).toEqual([
      ["Membres", ["{krokmou-1}"]],
      ["Génériques", ["{colley}"]],
    ]);
    clic(".o_smileyChoix");
    expect(
      lire(
        `[$("#message_envoi").val(), $(".o_smileysPanneau").prop("hidden"), $(".o_smileysBouton").attr("aria-expanded")]`,
      ),
    ).toEqual(["Bien {krokmou-1} joué", true, "false"]);
    // rouvert : pas de nouvelle lecture
    clic(".o_smileysBouton");
    await attendre();
    expect(appels()).toHaveLength(2);
  });

  test("« Envoyer » : le jeu lit le message avec les images à la place des codes ; ceux du jeu restent", async () => {
    ouvrir();
    clic(".o_smileysBouton");
    await attendre();
    lire(`$("#message_envoi").val("Salut {colley} {tongue}\\n{Krokmou 1}")`);
    clic("#bt_envoi_message");
    expect(lus()).toEqual([`Salut [img]${COLLEY}[/img] {tongue}\n[img]${KROKMOU}[/img]`]);
  });

  test("hors Compte+ : après la barre de l'extension si elle est cochée, sinon à la fin de la barre du jeu", () => {
    ouvrir(ecrire(""), { comptePlus: false });
    expect(
      lire(
        `[$(".o_smileysBouton").length, $(".o_smileysBouton").parent().attr("id"), $(".o_smileysBouton").next().attr("class")]`,
      ),
    ).toEqual([1, "barre_bbcode_nouveau_message", "o_smileysPanneau"]);
    // la barre de l'extension suit la flèche des smileys du jeu : le bouton vient juste après elle
    ouvrir(ecrire(""), { comptePlus: false, cases: { messagerieMiseEnForme: true } });
    expect(
      lire(
        `[$(".o_smileysBouton").length, $(".o_smileysBouton").prev().find("#o_colorMessmessage_envoi").length, $(".o_smileysBouton").prev().prev().attr("id")]`,
      ),
    ).toEqual([1, 1, "smileySuivant0"]);
  });

  test("case décochée : ni bouton ni conversion", async () => {
    await lire(`ChatGif.lireAlliance("smileys")`);
    ouvrir(ecrire(), { cases: { messagerieSmileysAlliance: false } });
    lire(`$("#message_envoi").val("{colley}")`);
    clic("#bt_envoi_message");
    expect([lire(`$(".o_smileysBouton").length`), lus()]).toEqual([0, ["{colley}"]]);
  });
});

describe("réponse d'une conversation ouverte", () => {
  test("bouton ajouté quand le jeu ouvre la conversation, un par message à écrire ; même lecture du sujet pour toute la page", async () => {
    ouvrir();
    await ouvrirConversation(12);
    await ouvrirConversation(34);
    expect(
      lire(
        `[$(".o_smileysBouton").length, $("#champ_bbcode_12 .o_smileysBouton").length, $("#champ_bbcode_12").children().last().attr("class"), $("#champ_bbcode_34 .o_smileysBouton").length]`,
      ),
    ).toEqual([3, 1, "o_smileysPanneau", 1]);
    clic("#champ_bbcode_12 .o_smileysBouton");
    await attendre();
    clic("#champ_bbcode_34 .o_smileysBouton");
    await attendre();
    expect(appels()).toEqual(["callGetForum", "callGetTopic"]);
    // chaque panneau écrit dans son message
    clic("#champ_bbcode_34 .o_smileyChoix");
    clic("#champ_bbcode_12 details:last-of-type .o_smileyChoix");
    expect(
      lire(
        `["message_envoi", "champ_reponse_12", "champ_reponse_34"].map((c) => $("#" + c).val())`,
      ),
    ).toEqual(["", "{colley} ", "{krokmou-1} "]);
    // les ajouts de l'extension ne relancent pas d'autres boutons
    await attendre(120);
    expect(lire(`$(".o_smileysBouton").length`)).toBe(3);
  });

  test("« Répondre » et « Répondre à un seul » : converti avant la lecture du jeu ; une autre action ne touche pas au message", async () => {
    ouvrir();
    await lire(`ChatGif.lireAlliance("smileys")`);
    await ouvrirConversation(12);
    lire(`$("#champ_reponse_12").val("Bravo {colley}")`);
    // clic dans le libellé du bouton, pas sur le bouton lui-même
    clic("#repondre_tous_12 b");
    expect(lus()).toEqual([`Bravo [img]${COLLEY}[/img]`]);
    // le jeu échange les identifiants quand le joueur choisit une autre action
    lire(`(() => {
      $("#repondre_tous_12").attr("id", "tmp"); $("#repondre_unique_12").attr("id", "repondre_tous_12"); $("#tmp").attr("id", "repondre_unique_12");
      $("#champ_reponse_12").val("{krokmou-1}");
    })()`);
    clic(".reaction_choisie");
    expect(lus()[1]).toBe(`[img]${KROKMOU}[/img]`);
    lire(`(() => {
      $(".reaction_choisie").attr("id", "tmp"); $("#supprimer_12").attr("id", "repondre_unique_12"); $("#tmp").attr("id", "supprimer_12");
      $("#champ_reponse_12").val("{colley}");
    })()`);
    clic(".reaction_choisie");
    expect([lus().length, lire(`$("#champ_reponse_12").val()`)]).toEqual([2, "{colley}"]);
  });

  test("réponse sans barre de mise en forme : pas de bouton, mais un code tapé est converti", async () => {
    ouvrir();
    await lire(`ChatGif.lireAlliance("smileys")`);
    await ouvrirConversation(56, false);
    expect(lire(`$("#reaction_56 .o_smileysBouton").length`)).toBe(0);
    lire(`$("#champ_reponse_56").val("{colley}")`);
    clic("#repondre_tous_56");
    expect(lus()).toEqual([`[img]${COLLEY}[/img]`]);
  });

  test("sujet jamais lu par ce navigateur : le code part tel quel", async () => {
    ouvrir();
    await ouvrirConversation(12);
    lire(`$("#champ_reponse_12").val("{colley}")`);
    clic("#repondre_tous_12");
    expect([lus(), appels()]).toEqual([["{colley}"], []]);
  });
});
