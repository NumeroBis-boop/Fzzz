import { beforeEach, describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Export des RC de la messagerie vers le Google Sheet de l'alliance
 * (ExportRapports) : lecture des rapports, clé unique de chaque RC, lecture des
 * conversations longues et parcours complet d'un export. Rapports inventés, au
 * format du jeu (aucune armée réelle dans le dépôt public).
 */
const page = creerPage(
  ["js/class/Utils.js", "js/class/ExportRapports.js", "js/page/MessagerieFzzz.js"],
  `var monProfil = { pseudo: "Alpha", parametre: {} };
   var TOAST_INFO = {}, TOAST_ERROR = {}, TOAST_SUCCESS = {};`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);
const URL_SCRIPT = "https://script.google.com/macros/s/AKfycbTest_123-abc/exec";
const DATE = "2026-11-07 21:07";

// une expédition d'une multichasse : armées propres, même minute et même terrain
const chasse = (
  n: number,
) => `Troupes en attaque : ${n} 000 Jeunes Soldates Naines, 500 Naines d’Elites.
Troupes en défense : ${n}0 Petites araignées, 900 Criquets.

Vous infligez 300 000 (+ 300 000) dégâts et tuez 1 203 ennemies.
L’ennemie inflige 5 000 (+ 0) dégâts à vos fourmis et en tue 3${n}1.

Écrasante victoire ! A peine le temps de se dégourdir les pattes qu’ils étaient tous morts ...
Vous avez gagné cette bataille !

Les unités survivantes ont appris de cette bataille :
- 200 Jeunes Soldates Naines sont devenues des Soldates Naines

Vos chasseuses ont conquis 7 000 cm², les carcasses des prédateurs vous rapportent 6${n} 000 de nourriture`;

const ARMEES = `Troupes en attaque : 20 000 Jeunes Soldates Naines, 1 000 Soldates.
Troupes en défense : 5 000 Jeunes Soldates Naines.
`;
// le même combat vu par l'attaquant (Alpha) et par le défenseur (Bravo)
const ATTAQUE = `Vous attaquez la fourmilière de Bravo
${ARMEES}
Vous infligez 50 000 (+ 25 000) dégâts et tuez 4 000 ennemies.
La troupe ennemie inflige 8 000 (+ 4 000) dégâts à vos fourmis et en tue 900.

Vous infligez 20 000 (+ 10 000) dégâts et tuez 1 000 ennemies.
La troupe ennemie inflige 1 000 (+ 500) dégâts à vos fourmis et en tue 100.

Vous avez gagné cette bataille !`;
const DEFENSE = `Alpha attaque votre fourmilière
${ARMEES}
Vous infligez 8 000 (+ 4 000) dégâts et tuez 900 ennemies.
La troupe ennemie inflige 50 000 (+ 25 000) dégâts à vos fourmis et en tue 4 000.

Vous infligez 1 000 (+ 500) dégâts et tuez 100 ennemies.
La troupe ennemie inflige 20 000 (+ 10 000) dégâts à vos fourmis et en tue 1 000.`;

const conv = (messages: { id: number; texte: string; date?: string }[], titre = "") => ({
  id: 1,
  titre,
  messages: messages.map((m) => ({ date: DATE, ...m })),
});
const lignes = (type: string, conversations: object[], pseudo = "Alpha") =>
  lire<any[][]>(
    `ExportRapports.lignes(${JSON.stringify(type)}, ${JSON.stringify(conversations)}, ${JSON.stringify(pseudo)})`,
  );

describe("lecture des rapports", () => {
  test("date d'un message du jeu", () => {
    expect(lire(`ExportRapports.date("07/11/26 à 21h07")`)).toBe(DATE);
    expect(lire(`ExportRapports.date("Fourmizzz 25/10/26 à 04h21")`)).toBe("2026-10-25 04:21");
    expect(lire(`ExportRapports.date("hier 21h07")`)).toBe("");
  });

  test("chasse : terrain, nourriture, fourmis perdues, armées et RC", () => {
    const r = lire(`ExportRapports.chasse(${JSON.stringify(chasse(1))}, "${DATE}", "Alpha")`);
    expect(r.valeurs.slice(0, 7)).toEqual([
      "Alpha",
      DATE,
      7000,
      61000,
      311,
      "1 000 Jeunes Soldates Naines, 500 Naines d’Elites",
      "10 Petites araignées, 900 Criquets",
    ]);
    expect(r.valeurs[7]).toContain("Vous avez gagné cette bataille !");
    expect(r.valeurs).toHaveLength(lire<number>(`EXPORTS_RAPPORTS.chasse.entetes.length`) - 1);
  });

  test("message sans RC (titre, texte libre) : ignoré", () => {
    expect(lire(`ExportRapports.chasse("Bonjour", "${DATE}", "Alpha")`)).toBeNull();
    expect(lire(`ExportRapports.combat("Bonjour", "${DATE}", "Alpha")`)).toBeNull();
  });

  test("combat vu de l'attaquant : camps, lieu, pertes de chacun sur tous les tours", () => {
    const r = lire(`ExportRapports.combat(${JSON.stringify(ATTAQUE)}, "${DATE}", "Alpha")`);
    expect(r.valeurs.slice(0, 12)).toEqual([
      "Alpha",
      DATE,
      "Combat",
      "Alpha",
      "Bravo",
      "Fourmilière",
      "",
      "",
      "",
      1000,
      5000,
      "20 000 Jeunes Soldates Naines, 1 000 Soldates",
    ]);
  });

  test("combat vu du défenseur : mêmes camps et mêmes pertes", () => {
    const r = lire(`ExportRapports.combat(${JSON.stringify(DEFENSE)}, "${DATE}", "Bravo")`);
    expect(r.valeurs.slice(2, 11)).toEqual([
      "Combat",
      "Alpha",
      "Bravo",
      "Fourmilière",
      "",
      "",
      "",
      1000,
      5000,
    ]);
  });

  test("terrain de chasse d'un autre joueur : le nom du lieu ne coupe pas le pseudo", () => {
    const rc = ATTAQUE.replace("la fourmilière de Bravo", "le Terrain de Chasse de Bravo");
    const r = lire(`ExportRapports.combat(${JSON.stringify(rc)}, "${DATE}", "Alpha")`);
    expect(r.valeurs.slice(3, 6)).toEqual(["Alpha", "Bravo", "Terrain de chasse"]);
  });

  test("prise : « Vol par » chez le défenseur, butin chez l'attaquant, ou titre seul", () => {
    const vol = lire(
      `ExportRapports.prise("Alpha vous a pris 7 500 cm².", "${DATE}", "Bravo", "Vol par Alpha : 7 500 cm²")`,
    );
    expect(vol.valeurs.slice(2, 9)).toEqual(["Prise", "Alpha", "Bravo", "", 7500, 0, 0]);
    const butin = lire(
      `ExportRapports.prise("Vos fourmis ont conquis 7 500 cm² qui appartenaient à Bravo.", "${DATE}", "Alpha")`,
    );
    expect(butin.valeurs.slice(2, 9)).toEqual(["Prise", "Alpha", "Bravo", "", 7500, 0, 0]);
    const titre = lire(
      `ExportRapports.prise("Texte inconnu", "${DATE}", "Bravo", "Vol par Alpha : 7 500 cm²")`,
    );
    expect(titre.valeurs.slice(3, 7)).toEqual(["Alpha", "Bravo", "", 7500]);
    expect(lire(`ExportRapports.prise("Texte inconnu", "${DATE}", "Bravo", "Avance")`)).toBeNull();
  });
});

describe("clé unique de chaque RC", () => {
  test("multichasse : un message par expédition, une ligne et une clé chacun", () => {
    const l = lignes("chasse", [
      conv([
        { id: 11, texte: chasse(1) },
        { id: 12, texte: chasse(2) },
        { id: 13, texte: chasse(3) },
      ]),
    ]);
    expect(l).toHaveLength(3);
    expect(new Set(l.map((r) => r[0])).size).toBe(3);
    for (const r of l) expect(r[0]).toMatch(/^2026-11-07 21:07\|[0-9a-f]{14}$/);
    expect(l.map((r) => r[3])).toEqual([7000, 7000, 7000]);
  });

  test("même RC exporté deux fois (autre appareil) : même clé", () => {
    const a = lignes("chasse", [conv([{ id: 11, texte: chasse(1) }])]),
      b = lignes("chasse", [conv([{ id: 11, texte: chasse(1).replace(/ /g, "  ") }])]);
    expect(a[0]![0]).toBe(b[0]![0]);
  });

  test("combat exporté par l'attaquant puis par le défenseur : une seule clé", () => {
    const a = lignes("combat", [conv([{ id: 5, texte: ATTAQUE }])], "Alpha"),
      d = lignes("combat", [conv([{ id: 9, texte: DEFENSE }])], "Bravo");
    expect(a[0]![0]).toBe(d[0]![0]);
    const vol = lignes(
        "combat",
        [conv([{ id: 6, texte: "Alpha vous a pris 7 500 cm²." }])],
        "Bravo",
      ),
      butin = lignes(
        "combat",
        [conv([{ id: 7, texte: "Vos fourmis ont conquis 7 500 cm² qui appartenaient à Bravo." }])],
        "Alpha",
      );
    expect(vol[0]![0]).toBe(butin[0]![0]);
  });

  test("deux prises identiques à la même minute : distinguées par leur rang", () => {
    const l = lignes("combat", [
      conv([{ id: 6, texte: "Bravo vous a pris 1 000 cm²." }], "Vol par Bravo : 1 000 cm²"),
      conv([{ id: 8, texte: "Bravo vous a pris 1 000 cm²." }], "Vol par Bravo : 1 000 cm²"),
    ]);
    expect(l.map((r) => r[0].split("|").length)).toEqual([2, 3]);
    expect(l[1]![0]).toBe(`${l[0]![0]}|2`);
  });

  test("le titre ne sert qu'une fois par conversation", () => {
    const l = lignes("combat", [
      conv(
        [
          { id: 6, texte: "Texte inconnu" },
          { id: 7, texte: "Autre texte inconnu" },
        ],
        "Vol par Bravo : 1 000 cm²",
      ),
    ]);
    expect(l).toHaveLength(1);
  });
});

describe("lecture d'une conversation", () => {
  const ligneMessage = (id: number) =>
    `<tr id="message_${id}"><td class="expe">07/11/26 à 21h07</td><td class="message">${chasse(id).replace(/\n/g, "<br/>")}</td></tr>`;
  const precedent = `<tr><td><a href="#" class="lien_voir_precedent">Voir les messages précédents</a></td></tr>`;

  test("longue conversation : « messages précédents » suivis jusqu'au premier", async () => {
    lire(`window.POSTS = [];
      $.post = (url, d) => {
        POSTS.push(d);
        if (d.traitement == "afficher") return Promise.resolve(${JSON.stringify(precedent + ligneMessage(4) + ligneMessage(5))});
        if (d.id_dernier_message == 4) return Promise.resolve(${JSON.stringify(precedent + ligneMessage(2) + ligneMessage(3))});
        return Promise.resolve(${JSON.stringify(ligneMessage(1))});
      };`);
    const messages = await lire<Promise<any[]>>(`ExportRapports.messages(77)`);
    expect(messages.map((m) => m.id)).toEqual([1, 2, 3, 4, 5]);
    expect(messages[0].date).toBe(DATE);
    expect(messages[0].texte).toContain("Troupes en attaque : 1 000 Jeunes Soldates Naines");
    expect(lire(`POSTS`)).toEqual([
      { traitement: "afficher", conversation: 77 },
      { traitement: "afficher_plus", id_conversation: 77, id_dernier_message: 4 },
      { traitement: "afficher_plus", id_conversation: 77, id_dernier_message: 2 },
    ]);
  });
});

describe("export complet depuis la messagerie", () => {
  const entete = (id: number, titre: string) =>
    `<tr class="en_tete_message" id="conversation_${id}"><td class="td_coche"><input type="checkbox" class="checkbox_message"/></td><td class="td_participants">Fourmizzz</td><td class="td_objet"><span class="intitule_message">${titre}</span><span>hier 21h07</span></td></tr>`;
  const message = (id: number, texte: string) =>
    `<tr id="message_${id}"><td class="expe">07/11/26 à 21h07</td><td class="message">${texte.replace(/\n/g, "<br/>")}</td></tr>`;
  const CONVERSATIONS: Record<number, string> = {
    11: message(101, chasse(1)) + message(102, chasse(2)) + message(103, chasse(3)),
    12: message(104, chasse(4)),
    21: message(201, "Bravo vous a pris 1 000 cm²."),
  };

  beforeEach(() => {
    lire(`localStorage.clear();
      window.ENVOIS = []; window.TOASTS = []; window.POSTS = []; window.REPONSE = null;
      document.body.innerHTML = '<table id="liste">' + ${JSON.stringify(
        entete(11, "Vos chasseuses ont conquis 21 000 cm² en 3 expéditions") +
          entete(12, "Chasse réussie : vos chasseuses ont conquis 7 000 cm² en 1 expédition") +
          entete(21, "Vol par Bravo : 1 000 cm²") +
          entete(31, "Convoi reçu de Bravo : 100"),
      )} + '</table>';
      $.toast = (o) => { TOASTS.push(o.text); return {}; };
      $.post = (url, d) => { POSTS.push(d.conversation); return Promise.resolve(${JSON.stringify(CONVERSATIONS)}[d.conversation] || ""); };
      window.chrome = {
        storage: { local: { get: () => Promise.resolve({ fzzz_exportSheet: "${URL_SCRIPT}" }) } },
        runtime: { sendMessage: (m) => {
          ENVOIS.push(m);
          return Promise.resolve(REPONSE || { ok: true, statut: 200, donnees: { ajoutees: m.corps.lignes.length, deja: 0 } });
        } },
      };`);
  });

  test("chasses : conversations de chasse seulement, un RC par ligne, puis rien à refaire", async () => {
    await lire(`ExportRapports.exporter("chasse")`);
    expect(lire(`POSTS`)).toEqual([11, 12]);
    const envois = lire<any[]>(`ENVOIS`);
    expect(envois).toHaveLength(1);
    expect(envois[0].type).toBe("fzzz_sheet");
    expect(envois[0].url).toBe(URL_SCRIPT);
    expect(envois[0].methode).toBe("POST");
    expect(envois[0].corps.onglet).toBe("BDD chasse");
    expect(envois[0].corps.entetes[0]).toBe("Clé");
    expect(envois[0].corps.lignes).toHaveLength(4);
    for (const l of envois[0].corps.lignes) expect(l[1]).toBe("Alpha");
    expect(lire<string[]>(`TOASTS`).at(-1)).toContain("4 lignes ajoutées");
    // second clic : tout est déjà exporté, rien n'est relu ni envoyé
    lire(`POSTS.length = 0; ENVOIS.length = 0;`);
    await lire(`ExportRapports.exporter("chasse")`);
    expect(lire(`POSTS`)).toEqual([]);
    expect(lire(`ENVOIS`)).toEqual([]);
    expect(lire<string[]>(`TOASTS`).at(-1)).toContain("Aucun nouveau rapport de chasse");
  });

  test("RC : onglet « BDD RC », lignes déjà dans le fichier comptées à part", async () => {
    lire(`REPONSE = { ok: true, statut: 200, donnees: { ajoutees: 0, deja: 1 } };`);
    await lire(`ExportRapports.exporter("combat")`);
    expect(lire(`POSTS`)).toEqual([21]);
    const corps = lire<any>(`ENVOIS[0].corps`);
    expect(corps.onglet).toBe("BDD RC");
    expect(corps.lignes[0].slice(1, 9)).toEqual([
      "Alpha",
      DATE,
      "Prise",
      "Bravo",
      "Alpha",
      "",
      1000,
      0,
    ]);
    expect(lire<string[]>(`TOASTS`).at(-1)).toContain("1 déjà présente");
  });

  test("script injoignable : message clair et rien de marqué (le prochain clic relit tout)", async () => {
    lire(`REPONSE = { erreur: "reseau" };`);
    await lire(`ExportRapports.exporter("chasse")`);
    expect(lire<string[]>(`TOASTS`).at(-1)).toContain("ne répond pas");
    lire(`REPONSE = null; POSTS.length = 0;`);
    await lire(`ExportRapports.exporter("chasse")`);
    expect(lire(`POSTS`)).toEqual([11, 12]);
  });

  test("adresse du script absente : renvoi vers les Préférences, aucune lecture", async () => {
    lire(`chrome.storage.local.get = () => Promise.resolve({});`);
    await lire(`ExportRapports.exporter("chasse")`);
    expect(lire(`POSTS`)).toEqual([]);
    expect(lire<string[]>(`TOASTS`).at(-1)).toContain("Préférences → Messagerie");
  });

  test("adresses acceptées : script Google seulement", () => {
    const valide = (u: string) =>
      lire<boolean>(`ExportRapports.adresseValide(${JSON.stringify(u)})`);
    expect(valide(URL_SCRIPT)).toBe(true);
    expect(valide("https://script.google.com/a/macros/ouaf.fr/s/AKfy_1/exec")).toBe(true);
    expect(valide("https://script.google.com/macros/s/AKfy/dev")).toBe(false);
    expect(valide("https://evil.example/macros/s/AKfy/exec")).toBe(false);
    expect(valide("http://script.google.com/macros/s/AKfy/exec")).toBe(false);
  });
});
