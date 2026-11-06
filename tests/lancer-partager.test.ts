import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

const page = creerPage(
  ["js/class/Utils.js", "js/page/Attaquer.js"],
  `var AFFICHAGES_ONGLET = {}, TOAST_ERROR = {}, toasts = [], envois = [];
   var monProfil = { getTempsParcours2: () => 600, parametre: { sondeUnite: { valeur: 0 }, sondeQuantite: { valeur: 1 }, sondeLieu: { valeur: 0 } } };
   var NOM_UNITE = ["Ouvrière", "Jeune Soldate Naine", "Soldate Naine", "Naine d’Elite", "Jeune Soldate", "Soldate", "Concierge", "Concierge d’élite", "Artilleuse"];
   var COUT_UNITE = [5, 16, 20, 26, 30, 36, 70, 100, 30];
   var VIE_UNITE = [-1, 8, 10, 13, 16, 20, 30, 40, 10];
   var posts = [];
   var Horloge = { clic: () => moment(), maintenant: () => Date.now(), libelleLatence: () => "" };
   var AttaqueLancee = { enregistrer: (cible, lieu, unite, o) => envois.push({ lieu, partager: !!o.partager }) };`,
);
page.lire(`$.toast = (o) => toasts.push(o.text); Utils.incrementTime = () => {};
  // envoi de la sonde : requête notée, réponse « refusée » (la page ne se recharge pas)
  $.post = (url, donnees) => { posts.push({ url, donnees }); return { done() { return this; }, fail() { return this; } }; };`);

// formulaire d'attaque du jeu (structure de ennemie.php?Attaquer=…)
// lignes : [nom, terrain, fourmilière, loge] ; champ Armée seulement si l'unité est présente
const ouvrir = (
  lignes: [string, string, string, string][] = [["Jeune Soldate Naine", "", "", "10"]],
  parametres = { sondeUnite: 0, sondeQuantite: 1, sondeLieu: 0 },
) =>
  page.lire(`(() => {
    toasts.length = 0; envois.length = 0; posts.length = 0;
    Object.entries(${JSON.stringify(parametres)}).forEach(([k, v]) => (monProfil.parametre[k].valeur = v));
    let lignes = ${JSON.stringify(lignes)}.map(([nom, t, f, l], i) => {
      let nb = [t, f, l].reduce((s, x) => s + (parseInt(x.replace(/\\D/g, "")) || 0), 0);
      return "<tr><td>" + nom + "</td><td>" + t + "</td><td>" + f + "</td><td>" + l + "</td><td>" + (nb ? "<input id='unite" + (i + 1) + "' name='unite" + (i + 1) + "' value='" + nb + "'/>" : "") + "</td></tr>";
    }).join("");
    document.body.innerHTML = \`<form id="formulaireChoixArmee" action="ennemie.php?Attaquer=866"><fieldset><select id="lieu" name="lieu">
      <option value="1">Terrain de Chasse</option><option value="2">Fourmilière</option><option value="3">Loge Impériale</option></select></fieldset>
      <fieldset><table id="tabChoixArmee"><tr><th>Unités</th></tr>\${lignes}</table><input type="hidden" name="t" id="t" value="jeton"/><input type="hidden" value="X" name="pseudoCible"/>
      <center><input type="submit" name="ChoixArmee" value="Attaquer X !"/></center></fieldset></form>\`;
    // aucun vrai envoi : on compte les soumissions
    document.querySelector("form").addEventListener("submit", (e) => e.preventDefault());
    window.p = Object.create(PageAttaquer.prototype);
    p._cible = { pseudo: "X", terrain: 1000, attenteSynchro: () => 30 };
    p.majStatistique = () => {};
    p.lancerSynchro = () => (window.synchroLancee = true);
    p.ajouterBoutons();
  })()`);
const etat = () =>
  page.lire<{ partager: string; desactive: boolean; envois: object[]; toasts: string[] }>(`({
    partager: $("#o_lancerPartager").css("visibility"),
    desactive: $("#o_lancerPartager").prop("disabled"),
    envois: envois.slice(), toasts: toasts.slice() })`);

describe("page d'attaque : boutons sous celui du jeu", () => {
  test("le bouton du jeu reste en place, nos boutons dessous, inactifs avant le profil", () => {
    ouvrir();
    expect(
      page.lire(
        `(() => { let b = $("input[name='ChoixArmee']"); return [b.parent().is("center"), b.index(), b.next().attr("id")]; })()`,
      ),
    ).toEqual([true, 0, "o_btnLancer"]);
    expect(page.lire(`$("#o_sonderDirect").length`)).toBe(0);
    expect(etat().desactive).toBe(true);
    page.lire(`p.activerBoutons()`);
    expect(etat().desactive).toBe(false);
  });
  test("« Lancer + partager » : une fois par clic", () => {
    ouvrir();
    page.lire(
      `p.activerBoutons(); $("#o_lancerPartager")[0].click(); $("#o_lancerPartager")[0].click(); $("#o_lancerPartager").click();`,
    );
    expect(etat().envois).toEqual([{ lieu: "Terrain de Chasse", partager: true }]);
    expect(etat().desactive).toBe(true);
  });
  test("« Lancer + partager » sur chaque lieu, partagé avec le lieu de la liste", () => {
    for (const [valeur, lieu] of [
      ["2", "Fourmilière"],
      ["3", "Loge Impériale"],
    ]) {
      ouvrir();
      page.lire(
        `p.activerBoutons(); $("#lieu").val("${valeur}"); $("#o_lancerPartager")[0].click();`,
      );
      const e = etat();
      expect(e.partager).not.toBe("hidden");
      expect(e.envois).toEqual([{ lieu, partager: true }]);
      expect(e.toasts).toEqual([]);
    }
  });
  test("le bouton du jeu envoie le lieu choisi, sans partage", () => {
    ouvrir();
    page.lire(`p.activerBoutons(); $("#lieu").val("2"); $("input[name='ChoixArmee']")[0].click();`);
    expect(etat().envois).toEqual([{ lieu: "Fourmilière", partager: false }]);
  });
});

const champs = () =>
  page.lire<Record<string, string>>(
    `Object.fromEntries($("#tabChoixArmee input").map((i, c) => [[c.id, c.value]]).get())`,
  );
const couleurs = () =>
  page.lire<string[]>(
    `["input[name='ChoixArmee']", "#o_sonder", "#o_synchroSonde", "#o_lancerPartager"].map((s) => ($(s).attr("class").match(/o_lieu\\d/) || ["aucune"])[0])`,
  );

describe("page d'attaque : sondes", () => {
  test("couleur du lieu : boutons d'envoi d'après la liste, Sonder d'après le lieu de sonde", () => {
    // [Attaquer, Sonder, Synchro sonde (n'envoie rien : couleur fixe), Lancer + partager]
    ouvrir();
    expect(couleurs()).toEqual(["o_lieu1", "o_lieu1", "aucune", "o_lieu1"]);
    page.lire(`$("#lieu").val("2").trigger("change")`);
    expect(couleurs()).toEqual(["o_lieu2", "o_lieu2", "aucune", "o_lieu2"]);
    ouvrir(undefined, { sondeUnite: 0, sondeQuantite: 1, sondeLieu: 3 });
    expect(couleurs()).toEqual(["o_lieu1", "o_lieu3", "aucune", "o_lieu1"]);
    expect(page.lire(`$("#o_sonder").text()`)).toBe("Sonder (Loge)");
    page.lire(`monProfil.parametre.sondeLieu.valeur = 0; $("#lieu").val("2").trigger("change")`);
    expect(page.lire(`$("#o_sonder").text()`)).toBe("Sonder (Dôme)");
  });
  test("Sonder : sonde réglée, vers la liste ou le lieu des préférences, liste inchangée", () => {
    const armee: [string, string, string, string][] = [
      ["Jeune Soldate Naine", "", "", "27 699"],
      ["Soldate Naine", "", "", "5 339"],
    ];
    ouvrir(armee, { sondeUnite: 1, sondeQuantite: 3, sondeLieu: 0 });
    page.lire(`p.activerBoutons(); $("#lieu").val("2"); $("#o_sonder")[0].click();`);
    const posts = page.lire<{ url: string; donnees: Record<string, unknown> }[]>(`posts`);
    expect(posts.length).toBe(1);
    const [post] = posts;
    expect(post?.url).toBe("https://s5.fourmizzz.fr/ennemie.php?Attaquer=866");
    expect(post?.donnees).toEqual({
      t: "jeton",
      ChoixArmee: "1",
      lieu: "2",
      pseudoCible: "X",
      unite1: 0,
      unite2: 3,
    });
    expect(champs()).toEqual({ unite1: "0", unite2: "3" });
    ouvrir(armee, { sondeUnite: 0, sondeQuantite: 1, sondeLieu: 3 });
    page.lire(`p.activerBoutons(); $("#o_sonder")[0].click();`);
    expect(page.lire(`[posts[0].donnees.lieu, $("#lieu").val()]`)).toEqual(["3", "1"]);
  });
  test("quantité plafonnée à ce que j'ai ; unité absente : 1 de la moins chère", () => {
    ouvrir([["Soldate Naine", "", "2", ""]], { sondeUnite: 1, sondeQuantite: 50, sondeLieu: 0 });
    page.lire(`p.activerBoutons(); $("#o_sonder")[0].click();`);
    expect(page.lire(`posts[0].donnees.unite1`)).toBe(2);
    ouvrir(
      [
        ["Jeune Soldate Naine", "", "", ""],
        ["Soldate", "", "", "40"],
        ["Artilleuse", "", "", "12"],
      ],
      { sondeUnite: 0, sondeQuantite: 5, sondeLieu: 0 },
    );
    page.lire(`p.activerBoutons(); $("#o_sonder")[0].click();`);
    expect(champs()).toEqual({ unite2: "0", unite3: "1" });
  });
  test("aucune troupe : rien n'est envoyé, notification", () => {
    ouvrir([["Jeune Soldate Naine", "", "", ""]]);
    page.lire(`p.activerBoutons(); $("#o_sonder")[0].click(); $("#o_synchroSonde")[0].click();`);
    expect(page.lire(`posts.length`)).toBe(0);
    expect(etat().toasts).toEqual([
      "Pas de troupe disponible : aucune sonde envoyée.",
      "Pas de troupe disponible : aucune sonde envoyée.",
    ]);
  });
  test("Synchro sonde : formulaire prérempli, compte à rebours, rien d'envoyé", () => {
    ouvrir([["Jeune Soldate Naine", "", "", "300"]], {
      sondeUnite: 0,
      sondeQuantite: 2,
      sondeLieu: 3,
    });
    page.lire(`window.synchroLancee = false; p.activerBoutons(); $("#o_synchroSonde")[0].click();`);
    expect(champs()).toEqual({ unite1: "2" });
    expect(page.lire(`[posts.length, envois.length, synchroLancee, $("#lieu").val()]`)).toEqual([
      0,
      0,
      true,
      "1",
    ]);
  });
});

describe("page d'attaque : Annuler dans la liste du jeu", () => {
  test("le lien du jeu ne quitte pas la page : annulation en arrière-plan", async () => {
    page.lire(`window.annulations = [];
      AttaqueLancee.annulerSurPlace = ($lien) => annulations.push($lien.attr("href"));
      document.body.innerHTML = '<h3>Attaque(s) en cours</h3>- Vous allez attaquer X <a id="annuler" href="/ennemie.php?annuler=208399">Annuler</a>';
      // le reste de executer() demande toute la page du jeu : seul le lien compte ici
      try { Object.create(PageAttaquer.prototype).executer(); } catch (e) {}`);
    const clic = page.lire<boolean>(
      `document.getElementById("annuler").dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }))`,
    );
    await new Promise((r) => setTimeout(r, 10));
    expect(clic).toBe(false);
    expect(page.lire(`annulations.slice()`)).toEqual(["/ennemie.php?annuler=208399"]);
  });
});
