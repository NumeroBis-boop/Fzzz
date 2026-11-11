import { beforeEach, describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * GIF du chat d'alliance (1.98.0) : « Mes GIF », ceux que le joueur a envoyés
 * avec la balise [img] du jeu (gardés dans le navigateur), et « GIF de
 * l'alliance », ceux du premier message du sujet caché « GIF de l'alliance »
 * (lu à l'ouverture de la page). Un clic écrit [img]adresse[/img] dans le
 * message : le joueur l'envoie lui-même, le jeu affiche le GIF à tous.
 */
const page = creerPage(
  ["js/class/Utils.js", "js/page/PartageChasses.js", "js/page/ChatGif.js", "js/page/Chat.js"],
  `var heure = moment("2026-11-10 12:00", "YYYY-MM-DD HH:mm").valueOf();
   var Horloge = { maintenant: () => heure, serveur: () => moment(heure) };
   var monProfil = { pseudo: "DoggyBag", couleur1: "#fff",
     parametre: { couleurChat: { valeur: "#000000", sauvegarde() {} } } };
   var TOAST_INFO = {}, TOAST_WARNING = {}, TOAST_ERROR = {}, TOAST_SUCCESS = {};
   // packs de smileys du jeu, comme dans content.js
   var LISTESMILEY1 = "<img src='images/smiley/ant_pouce.gif' onclick='addRaccourciSmiley(\\"message\\",\\"ant_pouce\\")'>",
     LISTESMILEY2 = "", LISTESMILEY3 = "",
     LISTESMILEY4 = "<img src='images/smiley/flower.gif' onclick='addRaccourciSmiley(\\"message\\",\\"flower\\")'>",
     LISTESMILEY5 = "", LISTESMILEY6 = "";`,
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
    ["chatCiter", "chatCouleur", "chatMiseEnForme", "chatSmileys", "chatSmileysAlliance"].forEach((c) =>
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

  const lectures = () => lire<string[]>(`FORUM.appels`).filter((a) => a == "callGetTopic").length;
  const premierGif = () => lire<string>(`$(".o_gifAlliance .o_gifChoix img").attr("src")`);

  test("lu dès l'ouverture de la page, sans clic ; le panneau s'en sert ; plus de « Relire »", async () => {
    sujet("4", "GIF de l'alliance", `<img src="${GIF1}"/>`);
    ouvrirChat("/alliance.php", { chatMesGif: false, chatGifAlliance: true });
    await attendre();
    expect(lectures()).toBe(1);
    // sujet modifié pendant que la page reste ouverte : vu à la prochaine ouverture
    lire(`FORUM.sujets[0].messages = [${JSON.stringify(`<img src="${GIF2}"/>`)}]`);
    lire(`$("#o_gifBouton").click()`);
    await attendre();
    expect(premierGif()).toBe(GIF1);
    expect(
      lire(`$("#o_gifPanneau button").filter((i, b) => /relire/i.test(b.textContent)).length`),
    ).toBe(0);
    lire(`$("#o_gifBouton").click(); $("#o_gifBouton").click()`);
    await attendre();
    expect(lectures()).toBe(1);
    // page rouverte (chat général compris) : relue tout de suite
    lire(`$("#o_gifBouton, #o_gifPanneau").remove()`);
    ouvrirChat("/chat.php", { chatMesGif: false, chatGifAlliance: true });
    await attendre();
    expect(lectures()).toBe(2);
    lire(`$("#o_gifBouton").click()`);
    await attendre();
    expect(premierGif()).toBe(GIF2);
  });

  test("liste décochée : rien lu à l'ouverture", async () => {
    sujet("4", "GIF de l'alliance", `<img src="${GIF1}"/>`);
    ouvrirChat("/alliance.php", { chatMesGif: true, chatGifAlliance: false });
    await attendre();
    expect(lire(`FORUM.appels`)).toEqual([]);
  });

  test("lecture de l'ouverture échouée : refaite à l'ouverture du panneau", async () => {
    sujet("4", "GIF de l'alliance", `<img src="${GIF1}"/>`);
    lire(`FORUM.echoue = true`);
    ouvrirChat("/alliance.php", { chatMesGif: false, chatGifAlliance: true });
    await attendre();
    lire(`FORUM.echoue = false`);
    lire(`$("#o_gifBouton").click()`);
    await attendre();
    expect(premierGif()).toBe(GIF1);
  });

  test("dernière lecture d'une autre alliance : jamais montrée", async () => {
    sujet("4", "GIF de l'alliance", `<img src="${GIF1}"/>`);
    await lire(`ChatGif.gifAlliance()`);
    expect(lire(`ChatGif._lue().gifs`)).toEqual([GIF1]);
    lire(`$("#tag_alliance").text("AUTRE")`);
    expect(lire(`ChatGif._lue()`)).toBeNull();
  });

  test("pas de sujet : la consigne ; forum illisible : la dernière lecture, avec un avertissement", async () => {
    ouvrirChat("/alliance.php", { chatMesGif: false, chatGifAlliance: true });
    lire(`$("#o_gifBouton").click()`);
    await attendre();
    expect(lire<string>(`$(".o_gifAlliance").text()`)).toContain(
      "Pas de sujet « GIF de l'alliance » dans la section « BDD partagée cachée »",
    );
    // sujet créé, page rouverte : ses GIF
    sujet("4", "GIF de l'alliance", `<img src="${GIF1}"/>`);
    lire(`$("#o_gifBouton, #o_gifPanneau").remove()`);
    ouvrirChat("/alliance.php", { chatMesGif: false, chatGifAlliance: true });
    lire(`$("#o_gifBouton").click()`);
    await attendre();
    expect(lire(`$(".o_gifAlliance .o_gifChoix img").attr("src")`)).toBe(GIF1);
    // page rouverte, forum illisible
    lire(`FORUM.echoue = true; $("#o_gifBouton, #o_gifPanneau").remove()`);
    ouvrirChat("/alliance.php", { chatMesGif: false, chatGifAlliance: true });
    lire(`$("#o_gifBouton").click()`);
    await attendre();
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

  test("titres « Mes GIF » et « GIF de l'alliance » dépliables, état gardé par liste", async () => {
    envoyer(`[img]${GIF2}[/img]`);
    sujet("4", "GIF de l'alliance", `<img src="${GIF1}"/>`);
    ouvrirChat("/alliance.php", { chatMesGif: true, chatGifAlliance: true });
    const etat = () =>
      lire<[string, boolean][]>(
        `$("#o_gifPanneau details.o_gifSection").map((i, d) => [[d.querySelector("summary").textContent, d.open]]).get()`,
      );
    lire(`$("#o_gifBouton").click()`);
    await attendre();
    expect(etat()).toEqual([
      ["Mes GIF", true],
      ["GIF de l'alliance", true],
    ]);
    // un clic sur le titre replie sa liste ; panneau rouvert, puis page rouverte : toujours repliée
    lire(`$("#o_gifPanneau summary").first().click()`);
    await attendre();
    lire(`$("#o_gifBouton").click(); $("#o_gifBouton").click()`);
    await attendre();
    expect(etat()).toEqual([
      ["Mes GIF", false],
      ["GIF de l'alliance", true],
    ]);
    lire(`$("#o_gifBouton, #o_gifPanneau").remove()`);
    ouvrirChat("/alliance.php", { chatMesGif: true, chatGifAlliance: true });
    lire(`$("#o_gifBouton").click()`);
    await attendre();
    expect(etat()).toEqual([
      ["Mes GIF", false],
      ["GIF de l'alliance", true],
    ]);
    // dépliée : ses GIF ; l'autre liste repliée puis dépliée de même
    lire(`$("#o_gifPanneau summary").first().click()`);
    await attendre();
    expect(etat()[0]).toEqual(["Mes GIF", true]);
    expect(lire(`$(".o_gifMes .o_gifChoix img").attr("src")`)).toBe(GIF2);
    lire(`$("#o_gifPanneau summary").last().click()`);
    await attendre();
    expect(etat()[1]).toEqual(["GIF de l'alliance", false]);
  });

  test("chaque case retire sa liste ; sans case, pas de bouton ; chat général : aussi", () => {
    const titres = () =>
      lire<string[]>(`$(".o_gifTitre").map((i, e) => e.firstChild.textContent.trim()).get()`);
    ouvrirChat("/alliance.php", { chatMesGif: true, chatGifAlliance: false });
    lire(`$("#o_gifBouton").click()`);
    expect(titres()).toEqual(["Mes GIF"]);
    lire(`$("#o_gifBouton, #o_gifPanneau").remove()`);
    ouvrirChat("/alliance.php", { chatMesGif: false, chatGifAlliance: true });
    lire(`$("#o_gifBouton").click()`);
    expect(titres()).toEqual(["GIF de l'alliance"]);
    lire(`$("#o_gifBouton, #o_gifPanneau").remove()`);
    ouvrirChat("/alliance.php", { chatMesGif: false, chatGifAlliance: false });
    expect(lire(`$("#o_gifBouton").length`)).toBe(0);
    ouvrirChat("/chat.php", { chatMesGif: true, chatGifAlliance: true });
    expect(lire(`$("#o_gifBouton").length`)).toBe(1);
  });

  test("bouton comme « Envoyer », au bout de sa ligne : après les boutons de mise en forme ; listes sous le formulaire", () => {
    const place = (barre: string) => {
      lire(`(() => {
        $("#o_gifBouton, #o_gifPanneau").remove();
        $("input[name='Envoyer']").attr("class", "bouton_jeu").nextAll().remove();
        $("#formulaireChat").append(${JSON.stringify(barre)});
      })()`);
      ouvrirChat("/alliance.php", { chatMesGif: true, chatGifAlliance: true });
      return lire<string[]>(`(() => {
        let $b = $("#o_gifBouton"), $f = $("#formulaireChat");
        return [$b.prop("tagName") + "/" + $b.attr("type") + "/" + $b.val() + "/" + $b.attr("class"),
          $b.prev().attr("id") || $b.prev().attr("name") || $b.prev().attr("class") || "", $f.children().last().attr("id")];
      })()`);
    };
    // Compte+ : boutons du jeu, puis un élément qui n'en est pas un
    expect(
      place(
        `<span id="jeuB" onclick="miseEnForme('message','gras');">B</span><img id="jeuAlly" onclick="miseEnForme('message','ally');"/>`,
      ),
    ).toEqual(["INPUT/button/GIF/bouton_jeu", "jeuAlly", "o_gifPanneau"]);
    // hors Compte+ : après le groupe de boutons de l'extension, pas dedans
    expect(
      place(
        `<div class="o_group_bouton o_group_bouton_chat"><span id="o_msgAlly" onclick="miseEnForme('message','ally');"></span></div>`,
      ),
    ).toEqual([
      "INPUT/button/GIF/bouton_jeu",
      "o_group_bouton o_group_bouton_chat",
      "o_gifPanneau",
    ]);
    // icône du jeu dans un lien cliquable : après le lien
    expect(
      place(
        `<a id="lienAlly" href="#" onclick="miseEnForme('message','ally'); return false;"><img src="images/BBCode/groupe.gif"/></a>`,
      )[1],
    ).toBe("lienAlly");
    // chat du jeu en Compte+ (chat.php, 10/11/2026) : images de mise en forme
    // dans un span d'une ligne insécable, puis la liste des couleurs, cachée,
    // faite d'autres images BBCode : le bouton suit la ligne, jamais dans la liste
    const COULEURS = `<div id="listeCouleur0" class="listeCouleur" style="display: none"><img src="images/BBCode/000000.gif" id="000000" onClick="changerCookieCouleur('000000');"/><img src="images/BBCode/084c08.gif" id="084c08" onClick="changerCookieCouleur('084c08');"/></div>`;
    expect(
      place(
        `<span class="sur_une_ligne"><span id="smileySuivant0"></span><strong id="boutonCouleur">A</strong><span id="barreJeu" style="cursor: pointer;position:relative;top:3px"><img onclick="miseEnForme('message','gras');" src="images/BBCode/bold.png"/><img onclick="miseEnForme('message','img');" src="images/BBCode/picture.png"/><img onclick="miseEnForme('message','ally');" src="images/BBCode/groupe.gif"/></span></span>${COULEURS}`,
      ),
    ).toEqual(["INPUT/button/GIF/bouton_jeu", "sur_une_ligne", "o_gifPanneau"]);
    // après la ligne insécable du jeu, pas dedans, une espace avant lui : il
    // passe à la ligne sur téléphone au lieu d'élargir la page
    expect(
      lire(
        `[$("#o_gifBouton").parent().attr("id"), $("#listeCouleur0 #o_gifBouton, .sur_une_ligne #o_gifBouton").length, $("#o_gifBouton")[0].previousSibling.nodeValue]`,
      ),
    ).toEqual(["formulaireChat", 0, " "]);
    // sans boutons de mise en forme, avec la liste des couleurs : à la fin du formulaire
    expect(place(COULEURS)[1]).toBe("listeCouleur0");
    // seul bouton dans un élément cliquable : juste après lui, et un clic sur
    // GIF ne déclenche pas cet élément
    place(`<span id="cliquable"><img onclick="miseEnForme('message','ally');"/></span>`);
    lire(`$("#cliquable").on("click", () => (window.CLIC_JEU = true)); $("#o_gifBouton").click()`);
    expect(
      lire(
        `[$("#o_gifBouton").parent().attr("id"), window.CLIC_JEU === true, $("#o_gifPanneau").prop("hidden")]`,
      ),
    ).toEqual(["cliquable", false, false]);
    // sans boutons de mise en forme : à la fin du formulaire, avant les listes
    expect(place(``)[1]).toBe("Envoyer");
    expect(lire(`$("#o_gifPanneau").prev().attr("id")`)).toBe("o_gifBouton");
  });

  test("sans case « Mes GIF », un envoi n'est pas noté", () => {
    ouvrirChat("/alliance.php", { chatMesGif: false, chatGifAlliance: true });
    lire(
      `$("#message").val(${JSON.stringify(`[img]${GIF1}[/img]`)}); $("input[name='Envoyer']").click()`,
    );
    expect(mesGif()).toEqual([]);
  });
});

/**
 * Bouton « Smileys » (1.101.0, demande du mainteneur) : à côté de « GIF », les
 * images du premier message du sujet caché « Smileys de l'alliance », lues à
 * l'ouverture de la page avec la liste des sujets déjà lue pour les GIF.
 */
describe("bouton « Smileys » : sujet « Smileys de l'alliance »", () => {
  const SMILEY1 = "https://i.postimg.cc/abc/colley-32.png";
  const SMILEY2 = "https://i.postimg.cc/def/ouaf.gif";
  const smileys = () =>
    lire<string[]>(
      `$("#o_smileysPanneau .o_smileyChoix img").map((i, e) => e.getAttribute("src")).get()`,
    );
  const appels = () => lire<string[]>(`FORUM.appels.slice()`);
  const rouvrir = (cases: Record<string, boolean>) => {
    lire(`$("#o_gifBouton, #o_gifPanneau, #o_smileysBouton, #o_smileysPanneau").remove()`);
    ouvrirChat("/alliance.php", cases);
  };
  const SEULS_SMILEYS = { chatMesGif: false, chatGifAlliance: false, chatSmileysAlliance: true };

  test("sujet repéré par son titre comme celui des GIF, le plus ancien s'il y en a deux", async () => {
    sujet("12", "smileys de l’Alliance");
    sujet("8", "Smileys de l'alliance");
    sujet("4", "GIF de l'alliance");
    const s = await lire<Promise<any>>(`PartageChasses.sujets()`);
    expect([s.gifAlliance, s.smileysAlliance]).toEqual(["4", "8"]);
  });

  test("« Smileys OUAF » juste après « GIF », même aspect ; seul sans les GIF ; sans case, rien", () => {
    lire(`$("input[name='Envoyer']").addClass("bouton_jeu")`);
    ouvrirChat("/alliance.php", {
      chatMesGif: true,
      chatGifAlliance: false,
      chatSmileysAlliance: true,
    });
    expect(lire(`$("#o_gifBouton").nextAll("input").first().attr("id")`)).toBe("o_smileysBouton");
    expect(
      lire(`[$("#o_smileysBouton").val(), $("#o_smileysBouton").hasClass("bouton_jeu")]`),
    ).toEqual(["Smileys OUAF", true]);
    rouvrir(SEULS_SMILEYS);
    expect(lire(`[$("#o_gifBouton").length, $("#o_smileysBouton").length]`)).toEqual([0, 1]);
    rouvrir({ chatMesGif: true, chatGifAlliance: true, chatSmileysAlliance: false });
    expect(lire(`$("#o_smileysBouton").length`)).toBe(0);
  });

  test("chat en Compte+ : « Smileys » suit « GIF » après la ligne insécable du jeu, jamais dans la liste des couleurs", () => {
    const LIGNE = `<span class="sur_une_ligne"><strong id="boutonCouleur">A</strong><span id="barreJeu"><img onclick="miseEnForme('message','gras');" src="images/BBCode/bold.png"/><img onclick="miseEnForme('message','ally');" src="images/BBCode/groupe.gif"/></span></span><div id="listeCouleur0" style="display: none"><img src="images/BBCode/000000.gif" onClick="changerCookieCouleur('000000');"/></div>`;
    lire(
      `$("input[name='Envoyer']").nextAll().remove(); $("#formulaireChat").append(${JSON.stringify(LIGNE)})`,
    );
    ouvrirChat("/chat.php", {
      chatMesGif: true,
      chatGifAlliance: false,
      chatSmileysAlliance: true,
    });
    expect(
      lire(
        `[$(".sur_une_ligne").next().attr("id"), $("#o_gifBouton").next().attr("id"), $("#o_smileysBouton")[0].previousSibling.nodeValue, $(".sur_une_ligne #o_smileysBouton, #listeCouleur0 #o_smileysBouton").length]`,
      ),
    ).toEqual(["o_gifBouton", "o_smileysBouton", " ", 0]);
    expect(lire(`$("#formulaireChat").children().slice(-2).map((i, e) => e.id).get()`)).toEqual([
      "o_gifPanneau",
      "o_smileysPanneau",
    ]);
  });

  test("lus dès l'ouverture avec les GIF : une lecture de la liste des sujets, une par sujet", async () => {
    sujet("4", "GIF de l'alliance", `<img src="${GIF1}"/>`);
    sujet("8", "Smileys de l'alliance", `<img src="${SMILEY1}"/> ${SMILEY2}`);
    ouvrirChat("/alliance.php", {
      chatMesGif: false,
      chatGifAlliance: true,
      chatSmileysAlliance: true,
    });
    await attendre();
    expect(appels()).toEqual(["callGetForum", "callGetTopic", "callGetTopic"]);
    lire(`$("#o_smileysBouton").click()`);
    await attendre();
    expect(smileys()).toEqual([SMILEY1, SMILEY2]);
    expect(appels()).toHaveLength(3);
  });

  test("un clic met le smiley au curseur et ferme le panneau, comme les GIF ; ouvrir l'un ferme l'autre", async () => {
    sujet("8", "Smileys de l'alliance", `<img src="${SMILEY1}"/><img src="${SMILEY2}"/>`);
    ouvrirChat("/alliance.php", {
      chatMesGif: true,
      chatGifAlliance: false,
      chatSmileysAlliance: true,
    });
    const etat = () =>
      lire(`[$("#o_smileysPanneau").prop("hidden"), $("#o_smileysBouton").attr("aria-expanded")]`);
    lire(`(() => { let c = $("#message")[0]; c.value = "Ouaf"; c.setSelectionRange(4, 4); })()`);
    lire(`$("#o_smileysBouton").click()`);
    await attendre();
    expect(etat()).toEqual([false, "true"]);
    lire(`$(".o_smileyChoix").first().click()`);
    expect(etat()).toEqual([true, "false"]);
    // un autre : panneau rouvert, ajouté à la suite
    lire(`$("#o_smileysBouton").click()`);
    await attendre();
    lire(`$(".o_smileyChoix").last().click()`);
    // le code du smiley, comme ceux du jeu, une espace après lui pour la suite
    expect(lire(`$("#message").val()`)).toBe("Ouaf {colley-32} {ouaf} ");
    expect(etat()).toEqual([true, "false"]);
    lire(`$("#o_smileysBouton").click(); $("#o_gifBouton").click()`);
    expect(
      lire(
        `[$("#o_gifPanneau").prop("hidden"), $("#o_smileysPanneau").prop("hidden"), $("#o_smileysBouton").attr("aria-expanded")]`,
      ),
    ).toEqual([false, true, "false"]);
    lire(`$("#o_smileysBouton").click()`);
    expect(
      lire(`[$("#o_gifPanneau").prop("hidden"), $("#o_smileysPanneau").prop("hidden")]`),
    ).toEqual([true, false]);
  });

  test("pas de sujet : la consigne ; forum illisible : la dernière lecture, avec un avertissement", async () => {
    ouvrirChat("/alliance.php", SEULS_SMILEYS);
    await attendre();
    // sans liste de GIF, la liste des sujets est lue pour les smileys
    expect(appels()).toEqual(["callGetForum"]);
    lire(`$("#o_smileysBouton").click()`);
    await attendre();
    expect(lire<string>(`$("#o_smileysPanneau").text()`)).toContain(
      "Pas de sujet « Smileys de l'alliance » dans la section « BDD partagée cachée » du forum. Crée-le et mets les adresses des smileys dans son premier message",
    );
    sujet("8", "Smileys de l'alliance", `<img src="${SMILEY1}"/>`);
    rouvrir(SEULS_SMILEYS);
    lire(`$("#o_smileysBouton").click()`);
    await attendre();
    expect(smileys()).toEqual([SMILEY1]);
    lire(`FORUM.echoue = true`);
    rouvrir(SEULS_SMILEYS);
    lire(`$("#o_smileysBouton").click()`);
    await attendre();
    expect(lire<string>(`$("#o_smileysPanneau").text()`)).toContain(
      "Forum de l'alliance illisible : dernière lecture affichée.",
    );
    expect(smileys()).toEqual([SMILEY1]);
  });

  /**
   * Codes {nom} et sections (1.103.0, demandes du mainteneur) : le sujet range
   * ses smileys sous des titres (« Membres : », « Génériques : ») ; un clic
   * écrit le code du smiley, comme pour ceux du jeu ({tongue}, {flower}), et
   * le code devient [img]adresse[/img] quand le joueur envoie son message : le
   * jeu ne connaît que ses propres codes.
   */
  const MEMBRE1 = "https://i.postimg.cc/aaa/Krokmou-1.png";
  const MEMBRE2 = "https://i.postimg.cc/bbb/Sirius.png";
  const GENERIQUE1 = "https://i.postimg.cc/ccc/chien-amoureux.png";
  const GENERIQUE2 = "https://i.postimg.cc/ddd/ouaf.gif";
  const SUJET =
    `Smileys de l'alliance, à utiliser dans les chats et les messages<br/>` +
    `<strong>Membres :</strong><br/>` +
    `<img src="${MEMBRE1}"/> {sirius} <img src="${MEMBRE2}"/><br/><br/>` +
    `Génériques&nbsp;:<br/>` +
    `<img src="${GENERIQUE1}"/><br/>` +
    `${GENERIQUE2}<br/>` +
    `Crédits : dessins de l'alliance`;
  const lireSmileys = (html: string) =>
    lire<{ gifs: string[]; ignores: number; sections: any[] }>(
      `ChatGif.lireSmileys(${JSON.stringify(html)})`,
    );
  const codes = (html: string) =>
    lireSmileys(html).sections.map((s) => [s.titre, ...s.smileys.map((x: any) => x.nom)]);
  const message = () => lire<string>(`$("#message").val()`);
  const ENTREE = `$("#message").trigger($.Event("keypress", { which: 13, keyCode: 13 }))`;
  const ENVOYER = `$("input[name='Envoyer']").click()`;
  const envoi = (texte: string, par: string) => {
    lire(`$("#message").val(${JSON.stringify(texte)})`);
    lire(par);
    return message();
  };
  const ouvrirSmileys = async (cases: Record<string, boolean> = SEULS_SMILEYS) => {
    sujet("8", "Smileys de l'alliance", SUJET);
    ouvrirChat("/alliance.php", cases);
    await attendre();
  };

  test("sections : une ligne sans image qui finit par « : » titre les smileys qui la suivent", () => {
    expect(lireSmileys(`<div class="messageForum">${SUJET}</div>`)).toEqual({
      gifs: [MEMBRE1, MEMBRE2, GENERIQUE1, GENERIQUE2],
      ignores: 0,
      sections: [
        {
          titre: "Membres",
          smileys: [
            { nom: "krokmou-1", adresse: MEMBRE1 },
            { nom: "sirius", adresse: MEMBRE2 },
          ],
        },
        {
          titre: "Génériques",
          smileys: [
            { nom: "chien-amoureux", adresse: GENERIQUE1 },
            { nom: "ouaf", adresse: GENERIQUE2 },
          ],
        },
      ],
    });
  });

  test("smileys d'avant le premier titre : sans titre ; titre sans smiley, trop long ou suivi d'une image sur sa ligne : pas une section", () => {
    const long = "Une très longue phrase d'introduction qui finit par deux points";
    expect(
      codes(
        `<div class="messageForum"><img src="https://x.fr/a/un.png"/><br/>Vide :<br/>Chats :<br/>${long} :<br/>` +
          `Bull : <img src="https://x.fr/a/deux.png"/><br/><div>Chiens :</div><img src="https://x.fr/a/trois.png"/></div>`,
      ),
    ).toEqual([
      ["", "un"],
      ["Chats", "deux"],
      ["Chiens", "trois"],
    ]);
  });

  test("codes : le {nom} écrit devant l'image, sinon le nom du fichier ; déjà pris (smiley du jeu ou de l'alliance) : numéroté", () => {
    expect(
      codes(
        `<div class="messageForum">` +
          `<img src="https://x.fr/a/Chien%20D%C3%A9tective.PNG"/>` +
          `<img src="https://x.fr/b/tongue.png"/><img src="https://x.fr/c/flower.gif"/>` +
          `{Ant_Pouce} <img src="https://x.fr/d/pouce-leve.png"/>` +
          `<img src="https://x.fr/e/chien-detective.png"/>` +
          `{Mon Chien !}<br/><img src="https://x.fr/f/1.png"/>` +
          `{pas pour lui} et du texte <img src="https://x.fr/g/%21%21.png"/>` +
          `<img src="https://x.fr/h/%21.png"/></div>`,
      )[0],
    ).toEqual([
      "",
      "chien-detective",
      // {tongue} (premier pack) et {flower} (LISTESMILEY4) restent ceux du jeu
      "tongue-2",
      "flower-2",
      "ant_pouce-2",
      "chien-detective-2",
      "mon-chien",
      "smiley",
      "smiley-2",
    ]);
  });

  test("premier message seulement ; smileys du jeu et doublons écartés, liens qui ne sont pas des images comptés", () => {
    const lu = lireSmileys(
      `<div class="messageForum">Membres :<br/><img src="${MEMBRE1}"/><img src="images/smiley/smile.gif"/>` +
        `<img src="https://s5.fourmizzz.fr/images/smiley/rire.gif"/><a href="https://x.fr/page">https://x.fr/pa...</a>` +
        `<img src="${MEMBRE1}"/><a href="${MEMBRE2}">lien</a></div>` +
        `<div class="messageForum">Autres :<br/><img src="https://x.fr/reponse.png"/></div>`,
    );
    expect([lu.gifs, lu.ignores, lu.sections.map((s) => s.titre)]).toEqual([
      [MEMBRE1, MEMBRE2],
      1,
      ["Membres"],
    ]);
  });

  test("panneau : les smileys sous les titres du sujet, dépliables comme les listes de GIF ; le code de chacun en info-bulle", async () => {
    await ouvrirSmileys();
    const sections = () =>
      lire<[string, boolean, string[]][]>(
        `$("#o_smileysPanneau details.o_gifSection").map((i, d) => [[d.querySelector("summary").textContent, d.open, $(d).find(".o_smileyChoix").map((j, b) => b.title).get()]]).get()`,
      );
    lire(`$("#o_smileysBouton").click()`);
    await attendre();
    expect(sections()).toEqual([
      ["Membres", true, ["{krokmou-1}", "{sirius}"]],
      ["Génériques", true, ["{chien-amoureux}", "{ouaf}"]],
    ]);
    // pas de mention sous les smileys (règle du mainteneur) : le code est dans l'info-bulle
    expect(lire<number>(`$("#o_smileysPanneau .o_gifNote").length`)).toBe(0);
    // titre replié : gardé, panneau puis page rouverts
    lire(`$("#o_smileysPanneau summary").first().click()`);
    await attendre();
    lire(`$("#o_smileysBouton").click(); $("#o_smileysBouton").click()`);
    await attendre();
    expect(sections().map((s) => s[1])).toEqual([false, true]);
    rouvrir(SEULS_SMILEYS);
    lire(`$("#o_smileysBouton").click()`);
    await attendre();
    expect(sections().map((s) => s[1])).toEqual([false, true]);
  });

  test("sujet sans titre : une seule liste, sans titre ; titre piégé : affiché en texte", async () => {
    sujet("8", "Smileys de l'alliance", `<img src="${SMILEY1}"/><img src="${SMILEY2}"/>`);
    ouvrirChat("/alliance.php", SEULS_SMILEYS);
    lire(`$("#o_smileysBouton").click()`);
    await attendre();
    expect(
      lire(
        `[$("#o_smileysPanneau details").length, $("#o_smileysPanneau .o_smileysGrille").length]`,
      ),
    ).toEqual([0, 1]);
    lire(
      `FORUM.sujets[0].messages = [${JSON.stringify(`&lt;img src=x onerror=alert(1)&gt; :<br/><img src="${SMILEY1}"/>`)}]`,
    );
    rouvrir(SEULS_SMILEYS);
    lire(`$("#o_smileysBouton").click()`);
    await attendre();
    expect(
      lire(`[$("#o_smileysPanneau summary").text(), $("#o_smileysPanneau summary img").length]`),
    ).toEqual(["<img src=x onerror=alert(1)>", 0]);
  });

  test("à l'envoi (Entrée ou « Envoyer ») : les codes deviennent les images ; ceux du jeu et les autres accolades restent", async () => {
    await ouvrirSmileys();
    // casse, accents et espaces du code tapé ignorés, comme dans son nom
    expect(envoi("Salut {sirius} {tongue} {flower} {inconnu} {Krokmou 1}!", ENTREE)).toBe(
      `Salut [img]${MEMBRE2}[/img] {tongue} {flower} {inconnu} [img]${MEMBRE1}[/img]!`,
    );
    expect(envoi("{CHIEN-AMOUREUX}{ouaf}", ENVOYER)).toBe(
      `[img]${GENERIQUE1}[/img][img]${GENERIQUE2}[/img]`,
    );
    // une autre touche n'envoie rien : le code reste
    expect(
      envoi("{sirius}", `$("#message").trigger($.Event("keypress", { which: 65, keyCode: 65 }))`),
    ).toBe("{sirius}");
    // envoyé deux fois (Entrée puis validation du formulaire) : même message
    expect(envoi(`[img]${MEMBRE2}[/img]`, ENTREE)).toBe(`[img]${MEMBRE2}[/img]`);
  });

  test("formulaire validé sans touche ni clic vus (clavier d'un téléphone) : converti avant le jeu", async () => {
    lire(
      `document.body.innerHTML = "<span id='tag_alliance'>OUAF</span><form id='formulaireChat'><input id='message' type='text'/><input type='submit' name='Envoyer' value='Envoyer'/></form>"`,
    );
    await ouvrirSmileys();
    expect(
      lire(`(() => {
        let formulaire = document.getElementById("formulaireChat"), lu = null;
        // le jeu lit le message à la validation
        formulaire.addEventListener("submit", (e) => { e.preventDefault(); lu = $("#message").val(); });
        $("#message").val("{sirius}");
        formulaire.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        return lu;
      })()`),
    ).toBe(`[img]${MEMBRE2}[/img]`);
  });

  test("message trop long avec les images : smiley refusé au clic ; tapé à la main, l'envoi est retenu avec une notification", async () => {
    await ouvrirSmileys();
    lire(`$("#message").attr("maxlength", "60").val("Bonjour à tous")`);
    lire(`$("#o_smileysBouton").click()`);
    await attendre();
    // le code tiendrait, pas la balise qui le remplacera
    lire(`$(".o_smileyChoix").first().click()`);
    expect([message(), lire(`$("#o_smileysPanneau").prop("hidden")`)]).toEqual([
      "Bonjour à tous",
      false,
    ]);
    const retenu = (par: string) =>
      lire(`(() => {
        window.JEU = 0;
        $("#message").val("{sirius} {sirius}").off(".jeu").on("keypress.jeu", () => JEU++);
        $("input[name='Envoyer']").off(".jeu").on("click.jeu", () => JEU++);
        let e = ${par};
        return [e.isDefaultPrevented(), JEU, $("#message").val()];
      })()`);
    expect(
      retenu(
        `(() => { let e = $.Event("keypress", { which: 13, keyCode: 13 }); $("#message").trigger(e); return e; })()`,
      ),
    ).toEqual([true, 0, "{sirius} {sirius}"]);
    expect(
      retenu(
        `(() => { let e = $.Event("click"); $("input[name='Envoyer']").trigger(e); return e; })()`,
      ),
    ).toEqual([true, 0, "{sirius} {sirius}"]);
    const trop = `[img]${MEMBRE2}[/img] [img]${MEMBRE2}[/img]`.length - 60;
    expect(lire<string[]>(`TOASTS`)).toEqual([
      "Message trop long pour y ajouter ce smiley (60 caractères au plus).",
      `Message trop long de ${trop} caractères avec les images de ses smileys : raccourcis-le avant de l'envoyer.`,
      `Message trop long de ${trop} caractères avec les images de ses smileys : raccourcis-le avant de l'envoyer.`,
    ]);
    // raccourci : il part
    expect(envoi("{sirius}", ENTREE)).toBe(`[img]${MEMBRE2}[/img]`);
  });

  test("« Mes GIF » : un smiley animé de l'alliance n'y va pas, un GIF du même message oui", async () => {
    await ouvrirSmileys({ chatMesGif: true, chatGifAlliance: false, chatSmileysAlliance: true });
    expect(envoi(`{ouaf} [img]${GIF1}[/img]`, ENVOYER)).toBe(
      `[img]${GENERIQUE2}[/img] [img]${GIF1}[/img]`,
    );
    expect(mesGif()).toEqual([GIF1]);
  });

  test("case décochée : les codes ne sont pas convertis", async () => {
    await ouvrirSmileys({ chatMesGif: true, chatGifAlliance: false, chatSmileysAlliance: false });
    await lire(`ChatGif.lireAlliance("smileys")`);
    expect(envoi("{sirius}", ENVOYER)).toBe("{sirius}");
  });

  test("forum illisible : les codes de la dernière lecture servent encore, celle d'une version sans sections comprise ; jamais ceux d'une autre alliance", async () => {
    lire(
      `localStorage.setItem("fzzz_smileysAlliance", JSON.stringify({ gifs: ${JSON.stringify([SMILEY1, SMILEY2])}, ignores: 0, date: 1, alliance: "OUAF" }))`,
    );
    lire(`FORUM.echoue = true`);
    ouvrirChat("/alliance.php", SEULS_SMILEYS);
    await attendre();
    expect(envoi("{colley-32} {ouaf}", ENVOYER)).toBe(
      `[img]${SMILEY1}[/img] [img]${SMILEY2}[/img]`,
    );
    lire(`$("#o_smileysBouton").click()`);
    await attendre();
    expect(lire(`$("#o_smileysPanneau .o_smileyChoix").map((i, b) => b.title).get()`)).toEqual([
      "{colley-32}",
      "{ouaf}",
    ]);
    lire(`$("#tag_alliance").text("AUTRE")`);
    expect(envoi("{ouaf}", ENVOYER)).toBe("{ouaf}");
  });

  test("lecture gardée abîmée : smileys douteux écartés, rien d'injecté dans un message", () => {
    lire(
      `localStorage.setItem("fzzz_smileysAlliance", JSON.stringify({ gifs: [], alliance: "OUAF", sections: [
        { titre: "x", smileys: [{ nom: "ok", adresse: ${JSON.stringify(SMILEY1)} }, { nom: "a]b", adresse: ${JSON.stringify(SMILEY2)} },
          { nom: "c", adresse: "javascript:alert(1)" }, { nom: "d", adresse: "https://x.fr/a.png[/img][url=x]" }, null] }, "oups"] }))`,
    );
    expect(lire(`[...ChatGif.codes()]`)).toEqual([["ok", SMILEY1]]);
    expect(lire(`ChatGif.convertir("{ok} {c} {d}")`)).toBe(`[img]${SMILEY1}[/img] {c} {d}`);
  });
});
