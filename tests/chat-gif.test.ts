import { beforeEach, describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * GIF du chat d'alliance (1.98.0) : « Mes GIF », ceux que le joueur a envoyés
 * avec la balise [img] du jeu (gardés dans le navigateur), et « GIF de
 * l'alliance », ceux du premier message du sujet caché « GIF de l'alliance »
 * (lu au clic, gardé une heure). Un clic écrit [img]adresse[/img] dans le
 * message : le joueur l'envoie lui-même, le jeu affiche le GIF à tous.
 */
const page = creerPage(
  ["js/class/Utils.js", "js/page/PartageChasses.js", "js/page/ChatGif.js", "js/page/Chat.js"],
  `var heure = moment("2026-11-10 12:00", "YYYY-MM-DD HH:mm").valueOf();
   var Horloge = { maintenant: () => heure, serveur: () => moment(heure) };
   var monProfil = { pseudo: "DoggyBag", couleur1: "#fff",
     parametre: { couleurChat: { valeur: "#000000", sauvegarde() {} } } };
   var TOAST_INFO = {}, TOAST_WARNING = {}, TOAST_ERROR = {}, TOAST_SUCCESS = {};`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);
const attendre = () => new Promise((r) => setTimeout(r, 0));

const GIF1 = "https://media.giphy.com/media/abc123/giphy.gif";
const GIF2 = "https://media.tenor.com/XyZ/bravo.gif";
const WEBP = "https://i.giphy.com/def456.webp";

// forum simulé : sujets {id, titre, messages}, appels xajax notés
beforeEach(() => {
  lire(`(() => {
    localStorage.clear();
    window.TOASTS = [];
    $.toast = (o) => { TOASTS.push(o.text); return {}; };
    window.FORUM = { sujets: [], appels: [], echoue: false };
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
    document.body.innerHTML = "<span id='tag_alliance'>OUAF</span><div id='formulaireChat'><input id='message' type='text' maxlength='300'/><input type='button' name='Envoyer' value='Envoyer'/></div>";
  })()`);
});
const sujet = (id: string, titre: string, ...messages: string[]) =>
  lire(`FORUM.sujets.push(${JSON.stringify({ id, titre, messages })})`);
const mesGif = () => lire<string[]>(`ChatGif.mesGif()`);
const envoyer = (message: string) => lire(`ChatGif.noterEnvoi(${JSON.stringify(message)})`);

// chat d'alliance ouvert, les autres ajouts du chat décochés
const ouvrirChat = (chemin = "/alliance.php", cases: Record<string, boolean> = {}) =>
  lire(`(() => {
    history.replaceState(null, "", ${JSON.stringify(chemin)});
    ["chatCiter", "chatCouleur", "chatMiseEnForme", "chatSmileys"].forEach((c) =>
      localStorage.setItem("fzzz_affichage_" + c, "0"));
    Object.entries(${JSON.stringify(cases)}).forEach(([c, oui]) =>
      localStorage.setItem("fzzz_affichage_" + c, oui ? "1" : "0"));
    Object.create(PageChat.prototype).executer();
  })()`);

describe("adresses et formats", () => {
  test("[img] du message, casse ignorée ; adresses douteuses écartées", () => {
    expect(
      lire(
        `ChatGif.adresses(${JSON.stringify(`Salut [img]${GIF1}[/img] et [IMG] ${GIF2} [/IMG] [img]javascript:alert(1)[/img] [img]https://x.fr/a b.gif[/img]`)})`,
      ),
    ).toEqual([GIF1, GIF2]);
  });

  test("GIF : .gif ou .webp, paramètres compris ; image : aussi .png et .jpg", () => {
    expect(
      lire(`[
        ChatGif.estGif(${JSON.stringify(GIF1)}),
        ChatGif.estGif(${JSON.stringify(WEBP)}),
        ChatGif.estGif("https://media1.giphy.com/media/v1.Y2lk/abc/giphy.gif?cid=1&ct=g"),
        ChatGif.estGif("https://x.fr/capture.png"),
        ChatGif.estGif("https://giphy.com/gifs/chat-abc123"),
        ChatGif.estImage("https://x.fr/capture.png"),
        ChatGif.estImage("https://x.fr/page"),
      ]`),
    ).toEqual([true, true, true, false, false, true, false]);
  });
});

describe("« Mes GIF » : les GIF envoyés", () => {
  test("les GIF d'un message envoyé passent en tête, sans doublon ; une image .png n'y va pas", () => {
    envoyer(`[img]${GIF1}[/img]`);
    envoyer(`[img]${GIF2}[/img] [img]https://x.fr/capture.png[/img]`);
    // la capture ne prend pas non plus de place parmi les 60
    expect(lire(`JSON.parse(localStorage.getItem("fzzz_mesGif"))`)).toEqual([GIF2, GIF1]);
    envoyer(`[color=#ff0000][img]${GIF1}[/img][/color]`);
    expect(mesGif()).toEqual([GIF1, GIF2]);
  });

  test("60 au plus, les plus anciens partent ; stockage illisible : liste vide", () => {
    for (let i = 0; i < 65; i++) envoyer(`[img]https://x.fr/${i}.gif[/img]`);
    const liste = mesGif();
    expect([liste.length, liste[0], liste[59]]).toEqual([
      60,
      "https://x.fr/64.gif",
      "https://x.fr/5.gif",
    ]);
    lire(`localStorage.setItem("fzzz_mesGif", "{pas du json")`);
    expect(mesGif()).toEqual([]);
  });

  test("croix : le GIF quitte « Mes GIF »", () => {
    envoyer(`[img]${GIF2}[/img]`);
    envoyer(`[img]${GIF1}[/img]`);
    ouvrirChat("/alliance.php", { chatMesGif: true, chatGifAlliance: false });
    lire(`$("#o_gifBouton").click()`);
    expect(lire(`$(".o_gifMes .o_gifChoix").length`)).toBe(2);
    lire(`$(".o_gifMes .o_gifRetirer").first().click()`);
    expect(mesGif()).toEqual([GIF2]);
    expect(lire(`$(".o_gifMes .o_gifChoix img").attr("src")`)).toBe(GIF2);
  });
});

describe("« GIF de l'alliance » : premier message du sujet caché", () => {
  test("images affichées, liens et adresses en texte ; réponses, smileys du jeu et doublons écartés", () => {
    const html =
      `<div class="messageForum">Nos GIF :<br/><img src="${GIF1}"/><br/>` +
      `<a href="${GIF2}">https://media.tenor.com/XyZ/bra...</a><br/>${WEBP}.<br/>` +
      `<img src="images/smiley/smile.gif"/><img src="https://s5.fourmizzz.fr/images/smiley/rire.gif"/><br/>` +
      `https://giphy.com/gifs/chat-abc123<br/><img src="${GIF1}"/></div>` +
      `<div class="messageForum"><img src="https://x.fr/reponse.gif"/></div>`;
    expect(lire(`ChatGif.lireListe(${JSON.stringify(html)})`)).toEqual({
      gifs: [GIF1, GIF2, WEBP],
      ignores: 1,
    });
  });

  test("adresse piégée : écartée, jamais de balise injectée", () => {
    const html = `<div class="messageForum"><img src="https://x.fr/a.gif&quot; onerror=&quot;alert(1)"/></div>`;
    expect(lire(`ChatGif.lireListe(${JSON.stringify(html)}).gifs`)).toEqual([]);
  });

  test("sujet repéré par son titre (casse, apostrophe typographique), le plus ancien s'il y en a deux", async () => {
    sujet("9", "Gif de l’alliance");
    sujet("4", "GIF de l'alliance");
    sujet("5", "Convois | DoggyBag");
    const s = await lire<Promise<any>>(`PartageChasses.sujets()`);
    expect(s.gifAlliance).toBe("4");
    expect(s.liste.map((t: any) => t.id)).toEqual(["5"]);
  });

  test("lu au clic, gardé une heure ; « Relire » force la lecture", async () => {
    sujet("4", "GIF de l'alliance", `<img src="${GIF1}"/>`);
    const lectures = () => lire<string[]>(`FORUM.appels`).filter((a) => a == "callGetTopic").length;
    expect((await lire<Promise<any>>(`ChatGif.gifAlliance()`)).gifs).toEqual([GIF1]);
    lire(`FORUM.sujets[0].messages = [${JSON.stringify(`<img src="${GIF2}"/>`)}]`);
    lire(`heure += 59 * 60000`);
    expect((await lire<Promise<any>>(`ChatGif.gifAlliance()`)).gifs).toEqual([GIF1]);
    expect(lectures()).toBe(1);
    lire(`heure += 2 * 60000`);
    expect((await lire<Promise<any>>(`ChatGif.gifAlliance()`)).gifs).toEqual([GIF2]);
    expect(lectures()).toBe(2);
    await lire(`ChatGif.gifAlliance(true)`);
    expect(lectures()).toBe(3);
  });

  test("lecture d'une autre alliance : pas reprise", async () => {
    sujet("4", "GIF de l'alliance", `<img src="${GIF1}"/>`);
    await lire(`ChatGif.gifAlliance()`);
    lire(`$("#tag_alliance").text("AUTRE")`);
    await lire(`ChatGif.gifAlliance()`);
    expect(lire<string[]>(`FORUM.appels`).filter((a) => a == "callGetTopic").length).toBe(2);
  });

  test("pas de sujet : la consigne ; forum illisible : la dernière lecture, avec un avertissement", async () => {
    ouvrirChat("/alliance.php", { chatMesGif: false, chatGifAlliance: true });
    lire(`$("#o_gifBouton").click()`);
    await attendre();
    expect(lire<string>(`$(".o_gifAlliance").text()`)).toContain(
      "Pas de sujet « GIF de l'alliance » dans la section « BDD partagée cachée »",
    );
    sujet("4", "GIF de l'alliance", `<img src="${GIF1}"/>`);
    await lire(`ChatGif.afficherAlliance(true)`);
    expect(lire(`$(".o_gifAlliance .o_gifChoix img").attr("src")`)).toBe(GIF1);
    lire(`FORUM.echoue = true; heure += 2 * 3600000`);
    await lire(`ChatGif.afficherAlliance(false)`);
    expect(lire<string>(`$(".o_gifAlliance").text()`)).toContain(
      "Forum de l'alliance illisible : dernière lecture affichée.",
    );
    expect(lire(`$(".o_gifAlliance .o_gifChoix").length`)).toBe(1);
  });
});

describe("bouton « GIF » du chat d'alliance", () => {
  test("un clic sur un GIF l'écrit dans le message, au curseur, séparé du texte ; le panneau se ferme", () => {
    envoyer(`[img]${GIF1}[/img]`);
    ouvrirChat("/alliance.php", { chatMesGif: true, chatGifAlliance: false });
    lire(`(() => { let c = $("#message")[0]; c.value = "Bravo !"; c.setSelectionRange(7, 7); })()`);
    lire(`$("#o_gifBouton").click()`);
    expect(lire(`$("#o_gifPanneau").prop("hidden")`)).toBe(false);
    lire(`$(".o_gifChoix").first().click()`);
    expect(lire(`$("#message").val()`)).toBe(`Bravo ! [img]${GIF1}[/img]`);
    expect(lire(`$("#o_gifPanneau").prop("hidden")`)).toBe(true);
    lire(`(() => { let c = $("#message")[0]; c.value = "ab"; c.setSelectionRange(1, 1); })()`);
    lire(`$("#o_gifBouton").click(); $(".o_gifChoix").first().click()`);
    expect(lire(`$("#message").val()`)).toBe(`a [img]${GIF1}[/img] b`);
  });

  test("message trop long pour le chat : rien écrit, une notification", () => {
    envoyer(`[img]${GIF1}[/img]`);
    ouvrirChat("/alliance.php", { chatMesGif: true, chatGifAlliance: false });
    lire(`$("#message").attr("maxlength", "40").val("Bravo !")`);
    lire(`$("#o_gifBouton").click(); $(".o_gifChoix").first().click()`);
    expect(lire(`$("#message").val()`)).toBe("Bravo !");
    expect(lire<string[]>(`TOASTS`)).toEqual([
      "Message trop long pour y ajouter ce GIF (40 caractères au plus).",
    ]);
  });

  test("envoi par Entrée ou par « Envoyer » : ses GIF rejoignent « Mes GIF »", () => {
    ouvrirChat("/alliance.php", { chatMesGif: true, chatGifAlliance: true });
    lire(
      `$("#message").val(${JSON.stringify(`[img]${GIF2}[/img]`)}).trigger($.Event("keypress", { which: 13, keyCode: 13 }))`,
    );
    expect(mesGif()).toEqual([GIF2]);
    lire(
      `$("#message").val(${JSON.stringify(`[img]${GIF1}[/img]`)}); $("input[name='Envoyer']").click()`,
    );
    expect(mesGif()).toEqual([GIF1, GIF2]);
  });

  test("chaque case retire sa liste ; sans case, pas de bouton ; chat général : rien", () => {
    const titres = () =>
      lire<string[]>(`$(".o_gifTitre").map((i, e) => e.firstChild.textContent.trim()).get()`);
    ouvrirChat("/alliance.php", { chatMesGif: true, chatGifAlliance: false });
    lire(`$("#o_gifBouton").click()`);
    expect(titres()).toEqual(["Mes GIF"]);
    lire(`$("#o_gif").remove()`);
    ouvrirChat("/alliance.php", { chatMesGif: false, chatGifAlliance: true });
    lire(`$("#o_gifBouton").click()`);
    expect(titres()).toEqual(["GIF de l'alliance"]);
    lire(`$("#o_gif").remove()`);
    ouvrirChat("/alliance.php", { chatMesGif: false, chatGifAlliance: false });
    expect(lire(`$("#o_gif").length`)).toBe(0);
    ouvrirChat("/chat.php", { chatMesGif: true, chatGifAlliance: true });
    expect(lire(`$("#o_gif").length`)).toBe(0);
  });

  test("sans case « Mes GIF », un envoi n'est pas noté", () => {
    ouvrirChat("/alliance.php", { chatMesGif: false, chatGifAlliance: true });
    lire(
      `$("#message").val(${JSON.stringify(`[img]${GIF1}[/img]`)}); $("input[name='Envoyer']").click()`,
    );
    expect(mesGif()).toEqual([]);
  });
});
