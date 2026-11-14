import { beforeEach, describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Forum de l'alliance (demande du mainteneur, 14/11/2026 : « l'option de mettre
 * des smileys et GIF dans les forums ») : boutons « GIF » et « Smileys OUAF »
 * sous chaque message à écrire (champ « message » des formulaires du jeu,
 * ajoutés par xajax dans #alliance), avec les listes des chats ; un clic écrit
 * [img]adresse[/img] ou le code {nom}, que l'extension remplace par l'image au
 * clic sur le bouton d'envoi du jeu, avant qu'il lise le formulaire. Forme des
 * formulaires d'après les champs envoyés au jeu (topic, message, send) : non
 * vérifiée sur le vrai forum. Joueurs et images inventés.
 */
const nouvellePage = () =>
  creerPage(
    ["js/class/Utils.js", "js/page/PartageChasses.js", "js/page/ChatGif.js"],
    `var heure = moment("2026-11-14 12:00", "YYYY-MM-DD HH:mm").valueOf();
     var Horloge = { maintenant: () => heure, serveur: () => moment(heure) };
     var monProfil = { pseudo: "Moi" };
     var TOAST_INFO = {}, TOAST_WARNING = {}, TOAST_ERROR = {}, TOAST_SUCCESS = {};
     var LISTESMILEY1 = "", LISTESMILEY2 = "", LISTESMILEY3 = "", LISTESMILEY4 = "", LISTESMILEY5 = "", LISTESMILEY6 = "";`,
  );
let page = nouvellePage();
const lire = <T = any>(e: string) => page.lire<T>(e);
const attendre = (ms = 0) => new Promise((r) => setTimeout(r, ms));

const GIF = "https://media.invalid/danse.gif";
const MOUTON = "https://media.invalid/mouton.png";
// forme supposée des formulaires du jeu : champ « message », bouton « send » qui envoie par xajax
const reponse = (id = "1") =>
  `<form id="form_reponse_${id}"><input type="hidden" name="topic" value="${id}"/><textarea name="message" cols="60" rows="8"></textarea><br/><input type="button" class="bouton_jeu" name="send" value="Envoyer" onclick="ENVOIS.push(this.form.message.value)"/></form>`;

beforeEach(() => {
  page = nouvellePage();
  lire(`(() => {
    localStorage.clear();
    window.ENVOIS = [];
    window.TOASTS = [];
    $.toast = (o) => { TOASTS.push(o.text); return {}; };
    document.body.innerHTML = "<span id='tag_alliance'>OUAF</span><div id='alliance'></div>";
    window.FORUM = { appels: [], sujets: [
      { id: "8", titre: "Smileys de l'alliance", message: ${JSON.stringify(`<img src="${MOUTON}"/>`)} },
      { id: "9", titre: "GIF de l'alliance", message: ${JSON.stringify(`<img src="${GIF}"/>`)} },
    ] };
    PartageChasses.idSection = "7";
    PartageChasses._html = (d) => d;
    PartageChasses._xajax = (f, args) => {
      FORUM.appels.push(f);
      if (f == "callGetForum")
        return Promise.resolve('<form id="form_cat"><table>' + FORUM.sujets.map((s) => '<tr><td><input name="topic[]" value="' + s.id + '"/></td><td>' + s.titre + '</td></tr>').join("") + "</table></form>");
      if (f == "callGetTopic") {
        const s = FORUM.sujets.find((s) => s.id == args);
        return Promise.resolve(s ? '<div class="messageForum">' + s.message + "</div>" : "");
      }
      return Promise.reject(new Error("inattendu " + f));
    };
  })()`);
});
/** Le forum affiche un formulaire (xajax remplace le contenu de #alliance). */
const afficher = async (html: string) => {
  lire(`$("#alliance").html(${JSON.stringify(html)})`);
  await attendre();
};
const boutons = () =>
  lire<string[]>(`$("#alliance .o_forumGif input[type='button']").map((i, b) => b.value).get()`);

describe("boutons sous le message à écrire", () => {
  test("ajoutés quand le jeu affiche le formulaire, une fois ; rien n'est lu au forum avant un clic", async () => {
    lire(`ChatGif.forum({ gif: true, smileys: true })`);
    expect(boutons()).toEqual([]);
    await afficher(reponse());
    expect(boutons()).toEqual(["GIF", "Smileys OUAF"]);
    // la même classe que le bouton d'envoi du jeu
    expect(lire(`$(".o_forumGif input").first().hasClass("bouton_jeu")`)).toBe(true);
    lire(`$("#alliance").append("<p>autre</p>")`);
    await attendre();
    expect(boutons()).toEqual(["GIF", "Smileys OUAF"]);
    expect(lire(`FORUM.appels`)).toEqual([]);
    // un autre sujet ouvert : son formulaire a les siens
    await afficher(reponse("2"));
    expect(boutons()).toEqual(["GIF", "Smileys OUAF"]);
  });

  test("case décochée : son bouton manque ; les deux décochées : rien", async () => {
    lire(`ChatGif.forum({ gif: false, smileys: true })`);
    await afficher(reponse());
    expect(boutons()).toEqual(["Smileys OUAF"]);
    page = nouvellePage();
    lire(
      `document.body.innerHTML = "<div id='alliance'></div>"; ChatGif.forum({ gif: false, smileys: false })`,
    );
    await afficher(reponse());
    expect(boutons()).toEqual([]);
  });
});

describe("GIF", () => {
  test("le panneau montre Mes GIF et GIF de l'alliance ; un clic écrit [img]…[/img] dans le message, sans l'envoyer", async () => {
    lire(
      `localStorage.setItem("fzzz_mesGif", JSON.stringify([${JSON.stringify("https://media.invalid/mien.gif")}]))`,
    );
    lire(`ChatGif.forum({ gif: true, smileys: true })`);
    await afficher(reponse());
    lire(`$("#alliance textarea").val("Bravo")`);
    lire(`$(".o_forumGif input[value='GIF']").trigger("click")`);
    await attendre();
    expect(lire(`$(".o_gifPanneauForum").prop("hidden")`)).toBe(false);
    expect(lire(`$(".o_gifPanneauForum .o_gifMes img").attr("src")`)).toBe(
      "https://media.invalid/mien.gif",
    );
    expect(lire(`$(".o_gifPanneauForum .o_gifAlliance img").attr("src")`)).toBe(GIF);
    lire(`$(".o_gifPanneauForum .o_gifAlliance .o_gifChoix").first().trigger("click")`);
    expect(lire(`$("#alliance textarea").val()`)).toBe(`Bravo [img]${GIF}[/img]`);
    expect(lire(`$(".o_gifPanneauForum").prop("hidden")`)).toBe(true);
    expect(lire(`ENVOIS`)).toEqual([]);
    // un des miens : dans le même message
    lire(`$(".o_forumGif input[value='GIF']").trigger("click")`);
    await attendre();
    lire(`$(".o_gifPanneauForum .o_gifMes .o_gifChoix").first().trigger("click")`);
    expect(lire(`$("#alliance textarea").val()`)).toBe(
      `Bravo [img]${GIF}[/img] [img]https://media.invalid/mien.gif[/img]`,
    );
  });

  test("ouvrir un panneau ferme l'autre ; les boutons restent sur leur ligne, les panneaux dessous", async () => {
    lire(`ChatGif.forum({ gif: true, smileys: true })`);
    await afficher(reponse());
    expect(lire(`$(".o_forumGif").children().map((i, e) => e.className).get()`)).toEqual([
      "o_forumGifBoutons",
      "o_gifPanneauForum",
      "o_smileysPanneau",
    ]);
    lire(`$(".o_forumGif input[value='GIF']").trigger("click")`);
    lire(`$(".o_forumGif input[value='Smileys OUAF']").trigger("click")`);
    await attendre();
    expect(
      lire(
        `[$(".o_gifPanneauForum").prop("hidden"), $(".o_forumGif .o_smileysPanneau").prop("hidden")]`,
      ),
    ).toEqual([true, false]);
  });
});

describe("envoi par le bouton du jeu", () => {
  test("codes des smileys remplacés par leurs images avant que le jeu lise le message ; les GIF envoyés rejoignent Mes GIF", async () => {
    lire(`ChatGif.forum({ gif: true, smileys: true })`);
    await afficher(reponse());
    // lecture du sujet des smileys au premier clic
    lire(`$(".o_forumGif input[value='Smileys OUAF']").trigger("click")`);
    await attendre();
    lire(`$(".o_forumGif .o_smileyChoix").first().trigger("click")`);
    const code = lire<string>(`$("#alliance textarea").val()`);
    expect(code).toBe("{mouton} ");
    lire(`$("#alliance textarea").val($("#alliance textarea").val() + "et [img]${GIF}[/img]")`);
    lire(`document.querySelector("#alliance input[name='send']").click()`);
    expect(lire(`ENVOIS`)).toEqual([`[img]${MOUTON}[/img] et [img]${GIF}[/img]`]);
    expect(lire(`JSON.parse(localStorage.getItem("fzzz_mesGif"))`)).toEqual([GIF]);
  });

  test("validation du formulaire sans clic (clavier d'un téléphone) : convertie aussi", async () => {
    lire(`ChatGif.forum({ gif: false, smileys: true })`);
    await afficher(reponse());
    lire(`$(".o_forumGif input").trigger("click")`);
    await attendre();
    lire(`(() => {
      let f = document.querySelector("#form_reponse_1");
      f.querySelector("textarea").value = "{mouton}";
      f.addEventListener("submit", (e) => { e.preventDefault(); ENVOIS.push(f.message.value); });
      f.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    })()`);
    expect(lire(`ENVOIS`)).toEqual([`[img]${MOUTON}[/img]`]);
  });

  test("bouton de mise en forme du jeu dans le formulaire : le code reste jusqu'à l'envoi", async () => {
    lire(`ChatGif.forum({ gif: false, smileys: true })`);
    await afficher(
      reponse().replace(
        "<br/>",
        `<input type="button" value="Gras" onclick="miseEnForme('message', 'gras')"/><br/>`,
      ),
    );
    lire(`(() => { window.GRAS = 0; window.miseEnForme = () => GRAS++; })()`);
    lire(`$(".o_forumGif input").trigger("click")`);
    await attendre();
    lire(`$("#alliance textarea").val("{mouton}")`);
    lire(`document.querySelector("#alliance input[value='Gras']").click()`);
    expect(lire(`[$("#alliance textarea").val(), GRAS]`)).toEqual(["{mouton}", 1]);
    lire(`document.querySelector("#alliance input[name='send']").click()`);
    expect(lire(`ENVOIS`)).toEqual([`[img]${MOUTON}[/img]`]);
  });

  test("lien d'envoi du jeu hors du formulaire (action xajax « envoi… ») : converti aussi", async () => {
    lire(`ChatGif.forum({ gif: false, smileys: true })`);
    await afficher(
      `<form id="f"><textarea name="message"></textarea></form><a href="#" onclick="ENVOIS.push(document.querySelector('#f textarea').value); xajax_envoiNouveauSujet(); return false;">Poster</a>`,
    );
    lire(`window.xajax_envoiNouveauSujet = () => {}`);
    lire(`$(".o_forumGif input").trigger("click")`);
    await attendre();
    lire(`$("#alliance textarea").val("{mouton}")`);
    lire(`document.querySelector("#alliance a").click()`);
    expect(lire(`ENVOIS`)).toEqual([`[img]${MOUTON}[/img]`]);
  });

  test("clic sur un bouton de l'extension : rien n'est converti ; message sans code : inchangé", async () => {
    lire(`ChatGif.forum({ gif: true, smileys: true })`);
    await afficher(reponse());
    lire(`$(".o_forumGif input[value='Smileys OUAF']").trigger("click")`);
    await attendre();
    lire(`$("#alliance textarea").val("{mouton}")`);
    lire(`document.querySelector(".o_forumGif input[value='GIF']").click()`);
    expect(lire(`$("#alliance textarea").val()`)).toBe("{mouton}");
    lire(`$("#alliance textarea").val("Bonjour")`);
    lire(`document.querySelector("#alliance input[name='send']").click()`);
    expect(lire(`ENVOIS`)).toEqual(["Bonjour"]);
  });
});
