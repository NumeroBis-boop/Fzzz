import { beforeEach, describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * « Lancer + partager » du Multi-flood opti (capture du mainteneur du
 * 19/11/2026 : aucun des floods lancés n'était partagé). Les attaques sont
 * enregistrées par le vrai AttaqueLancee, liées aux lignes du jeu, puis
 * partagées par la page Armée. Le jeu reconnaît un pseudo tapé sans sa casse :
 * la capture gardait « grim », la liste du jeu écrit « Grim », la capture
 * n'était jamais liée puis était jetée comme un envoi refusé.
 */
const page = creerPage(
  [
    "js/lib/jquery-ui_1.12.1.js",
    "js/lib/globalize_0.1.1.js",
    "js/lib/globalize-locale-fr.js",
    "js/lib/moment-duration-format.js",
    "js/class/Utils.js",
    "js/class/Parametre.js",
    "js/class/Joueur.js",
    "js/class/Armee.js",
    "js/class/UnitesGardees.js",
    "js/class/AttaqueLancee.js",
    "js/page/MultiFlood.js",
  ],
  `var METHODE_FLOOD = [], AFFECTATION_RESSOURCE = [], RATIO_RECOLTE = {},
     TOAST_ERROR = {}, TOAST_SUCCESS = {}, TOAST_WARNING = {}, TOAST_INFO = {};
   var NOM_UNITE = ["Ouvrière", "Jeune Soldate Naine", "Soldate Naine", "Naine d’Elite", "Jeune Soldate"],
     NOM_UNITES = ["Ouvrières", "Jeunes Soldates Naines", "Soldates Naines", "Naines d’Elite", "Jeunes Soldates"];
   var LIEU_JEU_TERRAIN = 1;
   var heure = Date.UTC(2026, 10, 19, 7, 1, 18);
   var Horloge = { maintenant: () => heure, serveur: () => moment(heure), clic: () => moment(heure), serveurA: () => moment(heure) };
   var TroupesDehors = { ajouterAttaque() {}, synchroniserAttaques() {} };
   var PARTAGES = [], FAITS = {};
   var PageRessource = { lireChasses: () => [], grouperChasses: (c) => c, aPartager: () => [] };
   var PartageChasses = { charger: () => Promise.reject(new Error("sans sujet commun")),
     completer: (d) => Promise.resolve({ d, tdc: {} }), tdcMembres: () => Promise.resolve({}),
     entreesFloods: () => [], avecMesMouvements: (d) => d, simuler: () => ({ evenements: [], depart: {} }),
     chronologie: () => [], tdcConnus: (a, b) => ({ ...a, ...b }),
     floodsPartages: () => FAITS, retirerFloods() {},
     partagerFloods: (captures) => {
       PARTAGES.push(captures.map((c) => [c.id, c.cible]));
       captures.forEach((c) => (FAITS[c.id] = Date.now()));
       return Promise.resolve(true);
     } };
   var PageAttaquer = { tdcImpact: () => ({ moi: { tdc: null }, cible: { tdc: null } }) };
   // liste « Attaque(s) en cours » du jeu, comme sur la page d'attaque et la page Armée
   var LISTE = (ids) => "<h3>Attaque(s) en cours</h3>" + ids.map((id) =>
     '- Vous allez attaquer <span class="gras"><a href="Membre.php?Pseudo=Grim">Grim</a>(<a href="classementAlliance.php?alliance=TAG">TAG</a>)</span> (Terrain de chasse) dans ' +
     '<span class="gras" id="attaque_' + id + '">4H</span><script>reste(' + (14000 + id) + ', "attaque_' + id + '");</script> - <a href="/Armee.php?annuler=' + id + '">Annuler</a><br />').join("");`,
  "https://s5.fourmizzz.fr/ennemie.php",
);
const lire = <T = any>(e: string) => page.lire<T>(e);

/** Page Armée inventée : 65 136 JSN en garnison. */
const ARMEE =
  "<table class='simulateur'><tr><td colspan=10><h3> Troupes en Garnison </h3></td></tr>" +
  "<tr align='center'><td><div class='pas_sur_telephone'>Jeune Soldate Naine</div></td><td><span class='cliquable'>50 000</span></td><td><span class='cliquable'>15 136</span></td></tr></table>";
/** Page d'un membre inventée, structure du jeu : le pseudo écrit par le jeu dans « center > h2 ». */
const MEMBRE =
  "<div><div id='quantite_tdc'>73254</div></div><center><h2>Grim</h2><div class='boite_membre'><a href='carte.php?x=30&y=36'>x=30 et y=36</a></div>" +
  "<a href='commerce.php?ID=42'>Convoi</a><table class='tableau_score'><tr><td></td></tr><tr><td>Terrain</td><td>171672</td></tr></table></center>";
const FORMULAIRE =
  "<form><input type='hidden' name='pseudoCible' value='Grim'/><input type='hidden' id='t' name='t' value='jeton'/><table id='tabChoixArmee'></table></form>";

describe("Multi-flood opti : « Lancer + partager »", () => {
  beforeEach(() => {
    lire(`(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem("outiiil_parametre", JSON.stringify({ reserveFlood: 0, reserveFloodAuto: false }));
      window.monProfil = new Joueur({ pseudo: "Moi" }).getParametre();
      monProfil.niveauRecherche[6] = 9;
      monProfil.getTempsParcours2 = () => 14820;
      etatMultiFlood = null;
      PARTAGES.length = 0;
      FAITS = {};
      history.replaceState(null, "", "/ennemie.php");
      document.body.innerHTML = "<div id='data'><div id='quantite_tdc'>73254</div></div>" +
        "<div id='centre'><nav id='menu'><ul id='menuFourmiliere'><li><a class='boutonReine' href='Reine.php'>Reine</a></li></ul></nav>" +
        "<table id='tabEnnemie'><tr><td>liste du jeu</td></tr></table><div class='Bas'></div></div>";
      window.OUVERT = [];
      window.confirm = () => true;
      window.setTimeout = (f) => (f(), 0);
      $.toast = () => {};
      MultiFlood.ouvrir = (u) => OUVERT.push(u);
      // numéros d'attaque donnés par le jeu ; réponse du POST avec ou sans la liste
      window.ids = [];
      window.listeDansReponse = true;
      const pages = {
        "/Armee.php": ${JSON.stringify(ARMEE)},
        "/Ressources.php": "<div></div>",
        // le jeu ouvre la page de Grim pour « grim »
        "/Membre.php?Pseudo=Grim": ${JSON.stringify(MEMBRE)},
        "/Membre.php?Pseudo=grim": ${JSON.stringify(MEMBRE)},
      };
      const repondre = (url) => {
        const chemin = String(url).replace(location.origin, "");
        if (chemin == "/ennemie.php?Attaquer=42")
          return $.Deferred().resolve(${JSON.stringify(FORMULAIRE)} + LISTE(ids)).promise();
        return pages[chemin] !== undefined ? $.Deferred().resolve(pages[chemin]).promise() : $.Deferred().reject({ status: 404 }).promise();
      };
      $.get = repondre;
      $.ajax = (o) => repondre(o.url);
      $.post = () => {
        ids.push(900 + ids.length + 1);
        return $.Deferred().resolve("<center>Vos troupes sont en marche !</center>" + (listeDansReponse ? LISTE(ids) : "")).promise();
      };
    })()`);
  });
  const ouvrir = async () => {
    lire(`MultiFlood.ajouterMenu(); MultiFlood.installer()`);
    lire(`$("#o_ongletMultiFlood").trigger("click")`);
    await lire(`etatMultiFlood.lecture`);
    lire(
      `(() => { const r = etatMultiFlood.gardees.reglage; r.antisondes = false; r.autres = []; })()`,
    );
  };
  /** Page Armée ouverte après le lancement : la liste du jeu, puis le partage des floods marqués. */
  const pageArmee = async () => {
    lire(`document.body.innerHTML = "<div id='centre'>" + LISTE(ids) + "</div>"`);
    lire(`AttaqueLancee.afficherTableaux(false)`);
    await lire(`AttaqueLancee.partageEnCours`);
  };
  const lancer = async (tape: string) => {
    await ouvrir();
    await lire(`MultiFlood.ajouter(${JSON.stringify(tape)})`);
    await lire(`MultiFlood.lancer(true)`);
    const ids = lire<number[]>(`ids`);
    expect(ids.length).toBeGreaterThan(1);
    return ids;
  };

  test("cible choisie avec le pseudo du jeu : chaque attaque partie est partagée", async () => {
    const ids = await lancer("Grim");
    expect(lire(`AttaqueLancee.charger().map((a) => [a.id, a.cible, !!a.partager])`)).toEqual(
      ids.map((id) => [id, "Grim", true]),
    );
    await pageArmee();
    expect(lire(`PARTAGES`)).toEqual([ids.map((id) => [id, "Grim"])]);
    expect(lire(`AttaqueLancee.charger().filter((a) => a.partager).length`)).toBe(0);
  });

  test("pseudo tapé sans sa casse (« grim ») : écrit comme le jeu, attaques liées et partagées", async () => {
    const ids = await lancer("grim");
    expect(lire(`etatMultiFlood.cibles.map((c) => c.pseudo)`)).toEqual(["Grim"]);
    expect(lire(`$(".o_mfoCible").map((i, t) => t.dataset.pseudo).get()`)).toEqual(["Grim"]);
    expect(lire(`AttaqueLancee.charger().map((a) => [a.id, a.cible])`)).toEqual(
      ids.map((id) => [id, "Grim"]),
    );
    await pageArmee();
    expect(lire(`PARTAGES`)).toEqual([ids.map((id) => [id, "Grim"])]);
  });

  test("réponse du jeu sans la liste des attaques : liées sur la page Armée, puis partagées", async () => {
    lire(`listeDansReponse = false`);
    const ids = await lancer("grim");
    expect(lire(`AttaqueLancee.charger().map((a) => [a.id, a.cible, !!a.partager])`)).toEqual(
      ids.map(() => [null, "Grim", true]),
    );
    await pageArmee();
    expect(lire(`PARTAGES`)).toEqual([ids.map((id) => [id, "Grim"])]);
  });
});
