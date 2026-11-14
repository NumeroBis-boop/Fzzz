import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { creerPage } from "./harnais";

/**
 * Relevés de la version TEST (Releves.js) : horloge, comptes à rebours des
 * pages et des réponses, clics des lanceurs, envois de formulaires, messages
 * ouverts, calibrage. Pseudos et RC inventés.
 */
const DECALAGE = 1500; // heure du serveur − heure du PC
const page = creerPage(
  ["js/class/Journal.js", "js/class/AttaqueLancee.js", "js/class/Releves.js"],
  `var VERSION = "1.114.1", NOM_EXTENSION = "Extension OUAF";
   window.DECALAGE = ${DECALAGE};
   var Horloge = {
     maintenant: () => Date.now() + DECALAGE,
     serveurA: (local) => moment(local + DECALAGE),
     clic: () => moment(Date.now() + DECALAGE + 300),
     libelleLatence: () => "+0,3 s",
   };
   window.STOCKAGE = {};
   var chrome = { storage: { local: { get: (cle) => Promise.resolve({ [cle]: STOCKAGE[cle] }) } } };
   window.VRAIS = { now: Date.now, perf: performance.now, entrees: performance.getEntriesByType, minuterie: setTimeout };`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);
// 14/11/2026 17:23:08,800 à l'heure du PC : 17:23:10,300 à celle du serveur
const PC = lire<number>(`moment("2026-11-14T17:23:08.800").valueOf()`);
const releves = () => lire<any[]>(`Releves.liste()`);

// ligne d'attaque et ligne de chasse comme les écrit le jeu (Compte+ : minute d'arrivée)
const LIGNES = `<div id="zone">
  <span>- Vous allez attaquer <a href="Membre.php?Pseudo=Alpha">Alpha</a></span><span id="attaque_501"></span><script>reste(600, "attaque_501");</script> <a href="ennemie.php?annuler=501">Annuler</a><br/><small>Troupes en attaque : 1 unité. Arrivée à 17h33</small><br/>
  <span>- Vous allez attaquer <a href="Membre.php?Pseudo=Beta">Beta</a></span><span id="attaque_502"></span><script>reste(65, "attaque_502");</script><br/>
  <div id="boite_tdc"><span>- Vos chasseuses vont conquérir 1 cm² dans <span id="chasse_9"></span></span><script>reste(120,"chasse_9")</script><small>Arrivée à 17h25</small></div>
  <a id="temps_ponte"></a><script>resteTemps(25050,"temps_ponte");</script>
</div>`;

beforeEach(() =>
  lire(`localStorage.clear(); document.body.innerHTML = ""; STOCKAGE = {};
    Date.now = () => ${PC}; performance.now = () => 10000;`),
);
afterEach(() =>
  lire(`Date.now = VRAIS.now; performance.now = VRAIS.perf;
    performance.getEntriesByType = VRAIS.entrees; window.setTimeout = VRAIS.minuterie;`),
);

describe("horloge", () => {
  test("intervalle du décalage : même milieu que Horloge.estimer, avec ses bornes", () => {
    const horloge = creerPage(["js/class/Horloge.js"]);
    // serveur en avance de 1,25 s ; réponses à des fractions de seconde différentes
    const vrai = 1250,
      ech = [0, 1, 2, 3, 4, 5].map((k) => {
        const envoi = 1763137000000 + k * 1370,
          reception = envoi + 100;
        return { date: Math.floor((envoi + 50 + vrai) / 1000) * 1000, envoi, reception };
      });
    const r = lire(`Releves.intervalle(${JSON.stringify(ech)})`);
    expect(r.n).toBe(6);
    expect(r.min).toBeLessThanOrEqual(vrai);
    expect(r.max).toBeGreaterThanOrEqual(vrai);
    expect((r.min + r.max) / 2).toBe(horloge.lire(`Horloge.estimer(${JSON.stringify(ech)})`));
    // heure du PC changée entre-temps : les échantillons plus anciens ne comptent plus
    const change = [
      { date: 1763130000000, envoi: 1763100000000, reception: 1763100000100 },
      ...ech,
    ];
    expect(lire(`Releves.intervalle(${JSON.stringify(change)})`).n).toBe(6);
    expect(lire(`Releves.intervalle([])`)).toBeNull();
  });

  test("libellé : décalage ± demi-largeur, échantillons utilisés sur gardés", () => {
    expect(lire(`Releves.libelleHorloge({ min: 1200, max: 1300, n: 4, total: 9 })`)).toBe(
      "décalage serveur − PC +1,250 s ± 0,050 s (4 échantillon(s) sur 9)",
    );
    expect(lire(`Releves.libelleHorloge({ total: 0 })`)).toBe(
      "heure du PC (aucun échantillon du serveur sur 0)",
    );
  });
});

describe("comptes à rebours", () => {
  test("arrivée = seconde de la page + compteur ; cible, minute du jeu ; ponte ignorée", () => {
    lire(`document.body.innerHTML = ${JSON.stringify(LIGNES)}`);
    const t = lire<number>(`moment("2026-11-14T17:23:10.250").valueOf()`);
    expect(lire(`Releves.compteurs(document, ${t - 200}, ${t})`)).toEqual([
      "attaque_501 (Alpha) 600 s → 17:33:10 [jeu : 17h33]",
      "attaque_502 (Beta) 65 s → 17:24:15",
      "chasse_9 120 s → 17:25:10 [jeu : 17h25]",
    ]);
  });

  test("une seconde passée entre la requête et la réponse : les deux arrivées possibles", () => {
    lire(`document.body.innerHTML = ${JSON.stringify(LIGNES)}`);
    const t = lire<number>(`moment("2026-11-14T17:23:10.050").valueOf()`);
    expect(lire(`Releves.compteurs(document, ${t - 150}, ${t})[1]`)).toBe(
      "attaque_502 (Beta) 65 s → 17:24:14 ou 17:24:15",
    );
  });
});

describe("relevés gardés", () => {
  test("notés avec l'heure du serveur et la page ; case décochée : rien", () => {
    lire(`Releves.noter("LATENCE", "réglée +0,3 s")`);
    expect(releves()).toEqual([
      { t: PC + DECALAGE, y: "LATENCE", p: "Armee.php", m: "réglée +0,3 s" },
    ]);
    expect(lire(`Releves.texte()`)).toContain(
      "14/11 17:23:10,300 LATENCE (Armee.php) réglée +0,3 s",
    );
    lire(`Releves.actifs = false; Releves.noter("PAGE", "x")`);
    expect(releves()).toHaveLength(1);
  });

  test("au-delà de 1 000, les plus anciens partent", () => {
    lire(`localStorage.setItem("fzzz_releves", JSON.stringify(Array.from({ length: 999 }, (x, i) => ({ t: i, y: "PAGE", p: "", m: "n" + i }))));
      Releves.noter("PAGE", "a"); Releves.noter("PAGE", "b");`);
    const l = releves();
    expect(l).toHaveLength(1000);
    expect(l[0].m).toBe("n1");
    expect(l.at(-1).m).toBe("b");
  });

  test("« Copier » du journal copie les relevés, « Effacer » les efface", () => {
    lire(`Releves.noter("PAGE", "essai")`);
    expect(lire<string>(`Journal.texte()`)).toContain("Relevés de la version TEST : 1");
    expect(lire<string>(`Journal.texte()`)).toContain("PAGE (Armee.php) essai");
    lire(`Journal.vider()`);
    expect(releves()).toEqual([]);
  });
});

describe("page", () => {
  test("requête et réponse à l'heure du serveur, horloge, TdC, envoi qui l'a demandée, compteurs", async () => {
    lire(`document.body.innerHTML = "<span id='quantite_tdc'>12924</span>" + ${JSON.stringify(LIGNES)};
      STOCKAGE.fzzz_horloge_s5 = [{ date: ${PC} + 1000, envoi: ${PC} - 400, reception: ${PC} - 300 }];
      localStorage.setItem("fzzz_releves", JSON.stringify([{ t: ${PC} - 400 + DECALAGE, y: "ENVOI", p: "ennemie.php", m: "formulaire", c: ${PC} - 400 }]));
      performance.getEntriesByType = () => [{ type: "navigate", requestStart: 9700, responseStart: 9950, transferSize: 5000, decodedBodySize: 20000 }];`);
    await lire(`Releves.page()`);
    const m = releves().at(-1);
    expect(m.y).toBe("PAGE");
    expect(m.t).toBe(PC - 50 + DECALAGE);
    expect(m.m.split(" | ")).toEqual([
      "navigate",
      "requête 17:23:10,000 → réponse 17:23:10,250 (0,250 s)",
      "décalage serveur − PC +1,850 s ± 0,550 s (1 échantillon(s) sur 1)",
      "latence réglée +0,3 s",
      "mon TdC 12 924",
      "après le formulaire envoyé de 17:23:09,900 : clic → requête +0,100 s, clic → réponse +0,350 s",
      "compteurs : attaque_501 (Alpha) 600 s → 17:33:10 [jeu : 17h33] ; attaque_502 (Beta) 65 s → 17:24:15 ; chasse_9 120 s → 17:25:10 [jeu : 17h25]",
    ]);
  });
});

describe("clics, envois et requêtes", () => {
  // écoutes posées une fois, comme sur une page
  lire(`Releves.installer()`);

  test("clic d'un lanceur et formulaire envoyé : instant noté, valeurs du formulaire jamais", () => {
    lire(`document.body.innerHTML = "<button id='o_lanceFlood'>Flooder</button><span id='o_tempsTrajet'>0h 10m 00s</span>" +
      "<form id='formulaireChoixArmee' action='ennemie.php?Attaquer=429'><input name='unite1' value='12345'/><input type='submit' name='ChoixArmee' value='Attaquer'/></form>";
      window.Utils = { timeToInt: (t) => 600 };
      document.getElementById("o_lanceFlood").click();
      document.getElementById("formulaireChoixArmee").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));`);
    const [clic, envoi] = releves();
    expect(clic.y).toBe("CLIC");
    expect(clic.c).toBe(PC);
    expect(clic.m).toBe(
      "« Flooder » | latence réglée +0,3 s | trajet affiché 0h 10m 00s → arrivée prévue 17:33:10",
    );
    expect(envoi.y).toBe("ENVOI");
    expect(envoi.m).toContain("formulaire ennemie.php?Attaquer=429 (#formulaireChoixArmee)");
    expect(envoi.m).not.toContain("12345");
    // une seule fois, même vu par l'écoute native et par celle de jQuery
    expect(releves()).toHaveLength(2);
  });

  test("requête d'attaque : envoi, réponse, écart au clic et compteurs de la réponse", () => {
    lire(`localStorage.setItem("fzzz_releves", JSON.stringify([{ t: ${PC} - 300 + DECALAGE, y: "CLIC", p: "ennemie.php", m: "« Flooder »", c: ${PC} - 300 }]));
      let s = { url: "https://s5.fourmizzz.fr/ennemie.php?Attaquer=429", type: "POST", data: "lieu=1" };
      Date.now = () => ${PC} - 280; $(document).trigger("ajaxSend", [{}, s]);
      Date.now = () => ${PC}; $(document).trigger("ajaxComplete", [{ status: 200, responseText: '<span><a href="Membre.php?Pseudo=Alpha">Alpha</a></span><span id="attaque_77"></span><script>reste(600, "attaque_77")</script>' }, s]);`);
    const r = releves().at(-1);
    expect(r.y).toBe("REQUÊTE");
    expect(r.m.split(" | ")).toEqual([
      "POST ennemie.php?Attaquer=429 statut 200",
      "envoyée 17:23:10,020 → reçue 17:23:10,300 (0,280 s)",
      "après le clic de 17:23:10,000 : clic → requête +0,020 s, clic → réponse +0,300 s",
      "compteurs : attaque_77 (Alpha) 600 s → 17:33:10",
    ]);
  });

  test("lecture sans compte à rebours, forum, xajax : rien", () => {
    lire(`let fin = (s, texte) => { $(document).trigger("ajaxSend", [{}, s]); $(document).trigger("ajaxComplete", [{ status: 200, responseText: texte }, s]); };
      fin({ url: "https://s5.fourmizzz.fr/Armee.php", type: "GET" }, "<p>rien</p>");
      fin({ url: "https://s5.fourmizzz.fr/alliance.php?forum_menu", type: "POST", data: "xajax=callGetTopic" }, "reste(5, 'attaque_1')");
      fin({ url: "https://s5.fourmizzz.fr/Armee.php", type: "POST", data: "xajax=x" }, "");`);
    expect(releves()).toEqual([]);
  });

  test("réglage de la latence noté après le changement", () => {
    lire(`document.body.innerHTML = "<button id='o_latencePlus'>+</button>";
      window.setTimeout = (f) => { f(); return 0; };
      document.getElementById("o_latencePlus").click();`);
    expect(releves().map((r) => [r.y, r.m])).toEqual([["LATENCE", "réglée +0,3 s"]]);
  });
});

describe("messages ouverts", () => {
  const MESSAGERIE = `<table>
    <tr class="en_tete_message" id="conversation_11"><td class="td_objet">Vol par Alpha : 7 500 cm²</td></tr>
    <tr><td><table><tr id="message_901"><td class="expe"><span class="date_locale" data-timestamp="1763137390">14/11/26 17h23</span></td>
      <td class="message">Troupes en attaque : 1 000 Jeune Soldate Naine. Alpha vous a pris 7 500 cm². Les unités survivantes ont appris de cette bataille.</td></tr></table></td></tr>
    <tr class="en_tete_message" id="conversation_12"><td class="td_objet">Chasse</td></tr>
  </table>`;

  test("horodatage à la seconde, titre, phrases du TdC sans les armées ; une fois par message", () => {
    lire(
      `document.body.innerHTML = ${JSON.stringify(MESSAGERIE)}; Releves.messages(); Releves.messages();`,
    );
    const l = releves();
    expect(l).toHaveLength(1);
    expect(l[0].y).toBe("RC");
    expect(l[0].m).toBe(
      `message « Vol par Alpha : 7 500 cm² » message 901 : horodatage ${lire(`moment(1763137390000).format("DD/MM HH:mm:ss")`)} | Alpha vous a pris 7 500 cm²`,
    );
    expect(l[0].m).not.toContain("Soldate");
  });
});

describe("calibrage", () => {
  test("requêtes l'une après l'autre, bilan noté : ces réponses, avant, après", async () => {
    lire(`window.setTimeout = (f) => { f(); return 0; };
      window.K = 0;
      Releves._requeteHorloge = () => {
        let envoi = ${PC} + K * 1370, reception = envoi + 100;
        K++;
        let e = { date: Math.floor((envoi + 50 + 1250) / 1000) * 1000, envoi, reception };
        (STOCKAGE.fzzz_horloge_s5 = STOCKAGE.fzzz_horloge_s5 || []).push(e);
        return Promise.resolve(e);
      };`);
    const etats: string[] = [];
    page.window.eval("window").ETATS = etats;
    const bilan = await lire<Promise<string>>(`Releves.calibrer((t) => ETATS.push(t))`);
    expect(lire(`K`)).toBe(12);
    expect(etats[0]).toBe("Calibrage : requête 1 / 12…");
    expect(bilan).toContain("12 réponse(s) sur 12, aller-retour médian 0,100 s");
    expect(bilan).toContain("avant : heure du PC (aucun échantillon du serveur sur 0)");
    expect(bilan).toContain("après : décalage serveur − PC +1,");
    expect(releves().at(-1).y).toBe("CALIBRAGE");
  });

  test("case et bouton dans la boîte Journal", () => {
    lire(`document.body.innerHTML = "<div id='o_boiteJournal'><div class='o_journalBoutons'></div></div>";
      Releves.noter("PAGE", "x");
      window.APPELS = 0; window.CALIBRER = Releves.calibrer;
      Releves.calibrer = (etat) => { APPELS++; etat("en cours"); return Promise.resolve("fini"); };
      Releves.equiperBoite(); Releves.equiperBoite();`);
    expect(lire(`$(".o_releves").length`)).toBe(1);
    expect(lire(`$(".o_relevesActifs").prop("checked")`)).toBe(true);
    expect(lire(`$(".o_relevesNombre").text()`)).toBe("1");
    lire(`$(".o_relevesCalibrer").trigger("click")`);
    expect(lire(`APPELS`)).toBe(1);
    lire(
      `$(".o_relevesActifs").prop("checked", false).trigger("change"); Releves.calibrer = CALIBRER;`,
    );
    expect(lire(`Releves.actifs`)).toBe(false);
  });
});

describe("règles du s5", () => {
  const source = readFileSync(
    join(import.meta.dir, "..", "public", "js", "class", "Releves.js"),
    "utf8",
  );

  test("une seule requête possible, celle du calibrage, lancé par un clic", () => {
    expect(source.match(/\$\.(ajax|get|post)\(|fetch\(|new XMLHttpRequest/g)).toEqual([
      "$.ajax(",
      "new XMLHttpRequest",
    ]);
    const requete = source.slice(
      source.indexOf("static _requeteHorloge"),
      source.indexOf("static calibrer"),
    );
    expect(requete).toContain("$.ajax(");
    expect(requete).toContain("new XMLHttpRequest");
    // appelé seulement par la définition et le clic du bouton de la boîte
    expect(source.match(/Releves\.calibrer\(/g)).toHaveLength(1);
    expect(source).not.toContain("setInterval");
  });

  test("installé une fois par page, horloge chargée (content.js)", () => {
    const content = readFileSync(join(import.meta.dir, "..", "public", "js", "content.js"), "utf8");
    expect(content.match(/Releves\.installer\(\)/g)).toEqual(["Releves.installer()"]);
    expect(content).toContain("horlogePrete.then(() => Releves.installer());");
  });
});
