import { beforeEach, describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Page Convois : « Envoyer + partager » (choix B du mainteneur, 19/11/2026).
 * Le clic retient les convois en cours et envoie le formulaire par le bouton
 * du jeu ; la page Convois qui suit partage le convoi apparu, vers le joueur
 * choisi. Un convoi partagé puis annulé avec le lien « Annuler » du jeu est
 * retiré du forum au chargement suivant. Le forum est simulé ici
 * (ConvoisForum.partager / retirer : convois-forum.test.ts). Le formulaire est
 * inventé : celui du jeu n'a pas encore été relevé.
 */
const page = creerPage(
  [
    "js/class/Utils.js",
    "js/class/OuafSuivi.js",
    "js/page/PartageChasses.js",
    "js/page/ConvoisForum.js",
    "js/page/CommerceFzzz.js",
  ],
  `var heure = moment("2026-11-19 10:00", "YYYY-MM-DD HH:mm").valueOf();
   var Horloge = { maintenant: () => heure, serveur: () => moment(heure) };
   var monProfil = { pseudo: "Moi" };
   var TOAST_INFO = { t: "info" }, TOAST_WARNING = { t: "attention" }, TOAST_ERROR = { t: "erreur" }, TOAST_SUCCESS = { t: "ok" };`,
  "https://s5.fourmizzz.fr/commerce.php",
);
const lire = <T = any>(e: string) => page.lire<T>(e);
const attendre = (ms = 30) => new Promise((r) => setTimeout(r, ms));

const ligne = (id: number, vers = "Alpha") =>
  `<strong>- Vous allez livrer 4 nourriture et 466 945 matériaux à <a href="Membre.php?Pseudo=${vers}">${vers}</a> dans 2h 00m 00s</strong> - <a href="commerce.php?annuler=${id}">Annuler</a><br/>`;
const FORMULAIRE = `<form method="post" action="commerce.php"><table><tr><td><input id="pseudo_convoi" value="alpha"/></td><td><input type="submit" class="bouton_jeu" value="Lancer le convoi"/></td></tr></table></form>`;
/** Page Convois : le formulaire, puis les convois en cours. */
const ouvrir = (ids: number[]) =>
  lire(`(() => {
    document.body.innerHTML = ${JSON.stringify(
      `<div id="tag_alliance">TAG</div><div id="centre">${FORMULAIRE}<h3>Convois en cours:</h3>${ids.map((id) => ligne(id)).join("")}<h3>Fin</h3></div>`,
    )};
    // bouton du jeu : l'envoi est compté, la page ne part pas
    document.querySelector(".bouton_jeu").addEventListener("click", (e) => { e.preventDefault(); ENVOIS++; });
    return CommerceFzzz.partageConvois();
  })()`);

beforeEach(() =>
  lire(`(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.ENVOIS = 0;
    window.TOASTS = [];
    window.PARTAGES = [];
    window.RETRAITS = [];
    $.toast = (o) => TOASTS.push(o.t + " " + o.text);
    ConvoisForum.partager = (c) => (PARTAGES.push(c.map((x) => x.id)), Promise.resolve(c.length));
    ConvoisForum.retirer = (c) => (RETRAITS.push(c.id), Promise.resolve(true));
  })()`),
);

describe("« Envoyer + partager »", () => {
  test("bouton à côté de celui du jeu, avec ses classes ; le clic retient les convois en cours et envoie par le bouton du jeu", async () => {
    await ouvrir([901]);
    expect(lire(`$(".bouton_jeu").next().is(".o_convoiPartager.bouton_jeu")`)).toBe(true);
    expect(lire(`$(".o_convoiPartager").val()`)).toBe("Envoyer + partager");
    lire(`$(".o_convoiPartager").trigger("click")`);
    expect(lire(`ENVOIS`)).toBe(1);
    expect(lire(`JSON.parse(sessionStorage.getItem("fzzz_partageConvoiApres"))`)).toEqual({
      ids: [901],
      vers: "alpha",
      quand: lire<number>(`heure`),
    });
  });

  test("page qui suit l'envoi : le convoi apparu vers le joueur choisi est partagé, pas les autres", async () => {
    await ouvrir([901]);
    lire(`$(".o_convoiPartager").trigger("click")`);
    // le jeu affiche la page Convois avec le nouveau convoi (et un autre, vers un autre joueur)
    lire(`heure += 20000`);
    await lire(`(() => {
      document.body.innerHTML = ${JSON.stringify(
        `<div id="tag_alliance">TAG</div><div id="centre">${FORMULAIRE}<h3>Convois en cours:</h3>${ligne(901)}${ligne(902)}${ligne(903, "Bravo")}<h3>Fin</h3></div>`,
      )};
      return CommerceFzzz.partageConvois();
    })()`);
    expect(lire(`PARTAGES`)).toEqual([[902]]);
    expect(lire<string[]>(`TOASTS`)[0]).toStartWith("ok Convoi vers Alpha partagé avec la TAG");
    expect(lire(`sessionStorage.getItem("fzzz_partageConvoiApres")`)).toBeNull();
    // retenu pour surveiller son « Annuler »
    expect(lire(`CommerceFzzz._partages().map((c) => c.id)`)).toEqual([902]);
  });

  test("sans alliance : pas de bouton", async () => {
    await ouvrir([901]);
    lire(
      `$("#tag_alliance").remove(); $(".o_convoiPartager").remove(); CommerceFzzz.boutonPartage()`,
    );
    expect(lire(`$(".o_convoiPartager").length`)).toBe(0);
  });

  test("bouton du jeu seul : rien n'est partagé", async () => {
    await ouvrir([901, 902]);
    expect(lire(`PARTAGES`)).toEqual([]);
    expect(lire(`TOASTS`)).toEqual([]);
  });

  test("page Convois revenue trop tard, ou sans nouveau convoi : rien n'est partagé, et c'est dit", async () => {
    await ouvrir([901]);
    lire(`$(".o_convoiPartager").trigger("click")`);
    lire(`heure += 3 * 60000`);
    await ouvrir([901, 902]);
    expect(lire(`PARTAGES`)).toEqual([]);
    expect(lire<string[]>(`TOASTS`)[0]).toContain("pas revenue à temps");
    lire(`(() => { TOASTS.length = 0; })()`);
    lire(`$(".o_convoiPartager").trigger("click")`);
    await ouvrir([901, 902]);
    expect(lire(`PARTAGES`)).toEqual([]);
    expect(lire<string[]>(`TOASTS`)[0]).toContain("aucun nouveau convoi");
  });

  test("partage refusé par le forum : erreur, convoi pas retenu", async () => {
    lire(
      `ConvoisForum.partager = () => Promise.reject(new Error("écriture refusée par le forum (droits de la section ?)"))`,
    );
    await ouvrir([901]);
    lire(`$(".o_convoiPartager").trigger("click")`);
    await ouvrir([901, 902]);
    expect(lire<string[]>(`TOASTS`)[0]).toBe(
      "erreur Convoi envoyé, mais pas partagé dans le forum de l'alliance (écriture refusée par le forum (droits de la section ?)).",
    );
    expect(lire(`CommerceFzzz._partages()`)).toEqual([]);
  });
});

describe("convoi partagé puis annulé", () => {
  const partage = (id: number) =>
    lire(
      `localStorage.setItem("fzzz_convoisPartages", JSON.stringify({ moi: [{ id: ${id}, vers: "Alpha", montant: 466949, arrivee: heure + 7200000 }] }))`,
    );
  const annuler = (id: number) =>
    lire(
      `document.querySelector('a[href="commerce.php?annuler=${id}"]').dispatchEvent(new MouseEvent("click", { bubbles: true }))`,
    );

  test("clic sur « Annuler » : au chargement suivant, sa ligne retirée du forum, une fois", async () => {
    partage(902);
    await ouvrir([901, 902]);
    annuler(902);
    expect(lire(`OuafSuivi.annulations().map((a) => [a.id, a.suivi, a.siteFait])`)).toEqual([
      [902, false, true],
    ]);
    // le jeu recharge la page : le convoi annulé n'y est plus
    await ouvrir([901]);
    await attendre();
    expect(lire(`RETRAITS`)).toEqual([902]);
    expect(lire(`OuafSuivi.annulations()`)).toEqual([]);
    expect(lire(`CommerceFzzz._partages()`)).toEqual([]);
    expect(lire<string[]>(`TOASTS`).join(" ")).toContain("retiré du forum");
  });

  test("annulation refusée par le jeu : le convoi est toujours là, rien n'est retiré", async () => {
    partage(902);
    await ouvrir([901, 902]);
    annuler(902);
    await ouvrir([901, 902]);
    await attendre();
    expect(lire(`RETRAITS`)).toEqual([]);
    expect(lire(`OuafSuivi.annulations()`)).toEqual([]);
  });

  test("convoi aussi transmis au site de suivi : son annulation du suivi est gardée (elle retire aussi la ligne)", async () => {
    partage(902);
    lire(
      `OuafSuivi.enregistrerAnnulations([{ id: 902, vers: "Alpha", montant: 466949, arrivee: heure + 7200000, prevu: 466949, avance: 0, dansForum: true, siteFait: false, quand: heure }])`,
    );
    await ouvrir([901, 902]);
    annuler(902);
    expect(lire(`OuafSuivi.annulations().map((a) => [a.id, a.prevu, a.suivi])`)).toEqual([
      [902, 466949, undefined],
    ]);
  });
});
