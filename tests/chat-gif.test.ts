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
