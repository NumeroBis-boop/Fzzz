import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";
import { FORUM_SIMULE } from "./forum-simule";

/**
 * Heures de mes chasses et floods publiées dans le forum, retardées d'un délai
 * tiré au hasard de 0 au réglage (Préférences → Général ; chasses 5 min et
 * floods 0 min par défaut, 59 au plus) : une fuite du forum ne donne pas
 * l'heure exacte où l'armée est dehors (demande du mainteneur, 21/11/2026).
 * Le délai est tiré une fois par chasse (heure réelle) ou flood (numéro
 * d'attaque) et gardé : tiré à chaque écriture, les versions successives de la
 * réponse laisseraient retrouver l'heure. Une ligne reste au forum jusqu'à son
 * heure publiée. Joueurs inventés.
 */
const page = creerPage(
  ["js/class/Utils.js", "js/class/Requetes.js", "js/page/PartageChasses.js"],
  `var VERSION = "1.149.0";
   var heure = moment("2026-11-21 12:00:00", "YYYY-MM-DD HH:mm:ss").valueOf();
   var Horloge = { maintenant: () => heure, serveur: () => moment(heure), clic: () => moment(heure) };
   var monProfil = { pseudo: "Alpha", parametre: { decalageChasses: { valeur: 5 }, decalageFloods: { valeur: 0 } } };
   var TOAST_INFO = {}, TOAST_SUCCESS = {}, TOAST_ERROR = {};
   var AttaqueLancee = { majPartages() {}, oublierPartage() {} };
   var FORUM = {}, TIRAGE = 0, TIRAGES = [];
   Math.random = () => (TIRAGES.length ? TIRAGES.shift() : TIRAGE);`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);
lire(FORUM_SIMULE);
lire(`(() => {
  PartageChasses._html = (d) => d;
  PartageChasses._xajax = (f, args) => {
    FORUM.ordre.push(f);
    if (/^envoi/.test(f)) PartageChasses.oublierCache();
    if (f == "callGetForum")
      return Promise.resolve('<form id="form_cat"><table>' + FORUM.sujets.map((s) =>
        '<tr><td><input name="topic[]" value="' + s.id + '"/></td><td>' + s.titre + '</td><td><b>X</b><br/>21 nov. à 11h00</td></tr>').join("") + '</table></form>');
    const r = SIM.traiter(FORUM.sujets, f, args, monProfil.pseudo);
    return r || Promise.reject(new Error("inattendu " + f));
  };
  $.toast = () => {};
})()`);

const COMMUN_F = "BDD générale flood - NE RIEN ÉCRIRE";
const COMMUN_C = "BDD générale chasse - NE RIEN ÉCRIRE";
const ligne = (type: string, e: any) =>
  lire<string>(`PartageChasses._ligne(${JSON.stringify(type)}, ${JSON.stringify(e)})`);

/** Forum avec les deux sujets communs ; réponses données [auteur, lignes]. */
function preparer(
  chasses: [string, string[]][] = [],
  floods: [string, string[]][] = [],
  reglages = { chasses: 5, floods: 0 },
) {
  const reponses = (l: [string, string[]][], depart: number) =>
    l.map(([auteur, lignes], i) => ({ id: depart + i, auteur, texte: lignes.join("\n") }));
  const sujets = [
    { id: "10", titre: COMMUN_F, texte: "", reponses: reponses(floods, 500) },
    { id: "11", titre: COMMUN_C, texte: "", reponses: reponses(chasses, 600) },
  ];
  lire(`(() => {
    localStorage.clear();
    PartageChasses.idSection = "7";
    heure = moment("2026-11-21 12:00:00", "YYYY-MM-DD HH:mm:ss").valueOf();
    monProfil.parametre.decalageChasses.valeur = ${reglages.chasses};
    monProfil.parametre.decalageFloods.valeur = ${reglages.floods};
    TIRAGE = 0;
    FORUM = { sujets: ${JSON.stringify(sujets)}, ordre: [] };
  })()`);
}
const regler = (quand: string) =>
  lire(`heure = moment(${JSON.stringify(quand)}, "YYYY-MM-DD HH:mm:ss").valueOf()`);
const tirage = (t: number) => lire(`TIRAGE = ${t}`);
const maReponse = (id: string) =>
  lire<string>(
    `((FORUM.sujets.find((s) => s.id == ${JSON.stringify(id)}).reponses || []).find((r) => r.auteur == "Alpha") || {}).texte || ""`,
  );
// dans une fonction : une affectation évaluée seule au niveau du script ne prend pas ici
const oublierAppels = () => lire(`(() => { FORUM.ordre = []; })()`);
const ecritures = () => lire<string[]>(`FORUM.ordre.filter((f) => /^envoi/.test(f))`);
const decaler = (type: string, entrees: any[]) =>
  lire<any[]>(`PartageChasses.decaler(${JSON.stringify(type)}, ${JSON.stringify(entrees)})`);
const chasse = (date: string, terrain = 30000) => ({ date, terrain });
const flood = (date: string, id: number, cible = "Gamma") => ({
  date,
  cible,
  unites: 1000,
  terrain: 1000,
  id,
});

describe("retard tiré une fois par chasse ou flood", () => {
  test("de 0 au réglage, gardé pour la même chasse (heure réelle)", () => {
    preparer();
    tirage(0.99);
    expect(decaler("Chasses", [chasse("2026-11-21 13:00")])[0]).toMatchObject({
      date: "2026-11-21 13:05",
      reel: "2026-11-21 13:00",
    });
    // un nouveau tirage ne change pas l'heure publiée de la même chasse
    tirage(0);
    expect(decaler("Chasses", [chasse("2026-11-21 13:00")])[0].date).toBe("2026-11-21 13:05");
    expect(decaler("Chasses", [chasse("2026-11-21 14:00")])[0].date).toBe("2026-11-21 14:00");
  });

  test("floods : 0 par défaut, retard gardé par numéro d'attaque", () => {
    preparer();
    tirage(0.99);
    expect(decaler("Floods", [flood("2026-11-21 13:00", 11)])[0].date).toBe("2026-11-21 13:00");
    preparer([], [], { chasses: 5, floods: 10 });
    tirage(0.5);
    expect(decaler("Floods", [flood("2026-11-21 13:00", 11)])[0].date).toBe("2026-11-21 13:05");
    tirage(0.99);
    expect(decaler("Floods", [flood("2026-11-21 13:00", 11)])[0].date).toBe("2026-11-21 13:05");
    expect(decaler("Floods", [flood("2026-11-21 13:00", 12)])[0].date).toBe("2026-11-21 13:10");
  });

  test("59 min au plus, 0 : heure exacte", () => {
    preparer([], [], { chasses: 80, floods: 0 });
    tirage(0.999);
    expect(lire(`PartageChasses.decalageMax("Chasses")`)).toBe(59);
    expect(decaler("Chasses", [chasse("2026-11-21 13:00")])[0].date).toBe("2026-11-21 13:59");
    preparer([], [], { chasses: 0, floods: 0 });
    tirage(0.999);
    expect(decaler("Chasses", [chasse("2026-11-21 13:00")])[0].date).toBe("2026-11-21 13:00");
  });

  test("deux chasses ne prennent pas la même heure publiée", () => {
    preparer();
    tirage(0.99);
    const [a, b] = decaler("Chasses", [chasse("2026-11-21 13:00"), chasse("2026-11-21 13:00")]);
    expect(a.date).toBe("2026-11-21 13:05");
    // même heure réelle : même chasse, même retard
    expect(b.date).toBe("2026-11-21 13:05");
    // 13:03 + 2 = 13:05, déjà publiée pour l'autre chasse : tiré à nouveau
    lire(`TIRAGES = [0.4, 0]`);
    expect(decaler("Chasses", [chasse("2026-11-21 13:03")])[0].date).toBe("2026-11-21 13:03");
  });
});

describe("partage au forum", () => {
  test("la ligne publiée porte l'heure retardée ; un nouveau partage n'écrit rien", async () => {
    preparer();
    tirage(0.99);
    expect(
      await lire(
        `PartageChasses._partager("Chasses", [${JSON.stringify(chasse("2026-11-21 13:00"))}])`,
      ),
    ).toBe(1);
    expect(maReponse("11")).toBe(ligne("Chasses", chasse("2026-11-21 13:05")));
    oublierAppels();
    tirage(0);
    expect(
      await lire(
        `PartageChasses._partager("Chasses", [${JSON.stringify(chasse("2026-11-21 13:00"))}])`,
      ),
    ).toBe(0);
    expect(ecritures()).toEqual([]);
  });

  test("chasse déjà publiée à l'heure exacte (avant la mise à jour, ou depuis un autre appareil) : pas de doublon", async () => {
    preparer([["Alpha", [ligne("Chasses", chasse("2026-11-21 13:00"))]]]);
    tirage(0.99);
    expect(
      await lire(
        `PartageChasses._partager("Chasses", [${JSON.stringify(chasse("2026-11-21 13:00"))}])`,
      ),
    ).toBe(0);
    expect(ecritures()).toEqual([]);
  });

  test("mes affichages lisent mes chasses à l'heure réelle, ceux des autres à l'heure publiée", async () => {
    preparer([["Beta", [ligne("Chasses", chasse("2026-11-21 13:20"))]]]);
    tirage(0.99);
    await lire(
      `PartageChasses._partager("Chasses", [${JSON.stringify(chasse("2026-11-21 13:00"))}])`,
    );
    lire(`PartageChasses.oublierCache()`);
    const d = await lire<any>(`PartageChasses.charger(null, false)`);
    expect(d.chasses.alpha.map((e: any) => e.date)).toEqual(["2026-11-21 13:00"]);
    expect(d.chasses.beta.map((e: any) => e.date)).toEqual(["2026-11-21 13:20"]);
  });
});

describe("chasses annulées ou arrivées (page Ressources)", () => {
  const recaler = (anciennes: any[], groupes: any[], maintenant: string, fenetre = 0) =>
    lire<any>(
      `PartageChasses.recalerListeChasses(${JSON.stringify(anciennes)}, ${JSON.stringify(groupes)}, ${JSON.stringify(maintenant)}, ${fenetre})`,
    );
  const groupe = (debut: string, fin: string, terrain = 30000) => ({ debut, fin, terrain });

  test("toujours en cours : la ligne retardée reste telle quelle", () => {
    expect(
      recaler(
        [{ date: "2026-11-21 13:05", terrain: 30000, reel: "2026-11-21 13:00" }],
        [groupe("2026-11-21 12:58", "2026-11-21 13:00")],
        "2026-11-21 12:00",
      ).change,
    ).toBe(false);
  });

  test("dernière chasse du groupe annulée : la ligne suit le groupe avec le même retard", () => {
    expect(
      recaler(
        [{ date: "2026-11-21 13:05", terrain: 30000, reel: "2026-11-21 13:00" }],
        [groupe("2026-11-21 12:58", "2026-11-21 12:59", 20000)],
        "2026-11-21 12:00",
      ),
    ).toEqual({
      lignes: [{ date: "2026-11-21 13:04", terrain: 20000, reel: "2026-11-21 12:59" }],
      change: true,
    });
  });

  test("arrivée avant son heure publiée : gardée jusqu'à elle", () => {
    expect(
      recaler(
        [{ date: "2026-11-21 13:05", terrain: 30000, reel: "2026-11-21 13:00" }],
        [],
        "2026-11-21 13:02",
      ).change,
    ).toBe(false);
  });

  test("annulée avant son heure réelle : retirée", () => {
    expect(
      recaler(
        [{ date: "2026-11-21 13:05", terrain: 30000, reel: "2026-11-21 13:00" }],
        [],
        "2026-11-21 12:00",
      ),
    ).toEqual({ lignes: [], change: true });
  });

  test("retardée sur un autre appareil (heure réelle inconnue ici) : reconnue dans la fenêtre, heure publiée gardée", () => {
    expect(
      recaler(
        [{ date: "2026-11-21 13:04", terrain: 30000 }],
        [groupe("2026-11-21 12:58", "2026-11-21 13:00")],
        "2026-11-21 12:00",
        5,
      ),
    ).toEqual({
      lignes: [{ date: "2026-11-21 13:04", terrain: 30000, reel: "2026-11-21 13:00" }],
      change: false,
    });
  });

  test("recalage au forum : retard repris, heure réelle gardée pour mes affichages", async () => {
    preparer();
    tirage(0.99);
    await lire(
      `PartageChasses._partager("Chasses", [${JSON.stringify(chasse("2026-11-21 13:00"))}])`,
    );
    await lire(
      `PartageChasses.recalerChasses([${JSON.stringify(groupe("2026-11-21 12:58", "2026-11-21 12:59", 20000))}])`,
    );
    expect(maReponse("11")).toBe(ligne("Chasses", chasse("2026-11-21 13:04", 20000)));
    lire(`PartageChasses.oublierCache()`);
    const d = await lire<any>(`PartageChasses.charger(null, false)`);
    expect(d.chasses.alpha.map((e: any) => e.date)).toEqual(["2026-11-21 12:59"]);
  });
});

describe("floods arrivés ou annulés (page Armée)", () => {
  test("arrivé avant son heure publiée : gardé au forum, sans écriture ; annulé : retiré", async () => {
    preparer([], [], { chasses: 5, floods: 10 });
    tirage(0.99);
    await lire(
      `PartageChasses._partager("Floods", ${JSON.stringify([flood("2026-11-21 12:03", 11), flood("2026-11-21 12:20", 12)])})`,
    );
    expect(maReponse("10")).toContain("21/11/26 12:13 | Gamma");
    expect(maReponse("10")).toContain("21/11/26 12:30 | Gamma");
    // 12:05 : le flood 11 est arrivé (12:03), le 12 a été annulé ; tous deux ont quitté la liste du jeu
    regler("2026-11-21 12:05:00");
    oublierAppels();
    await lire(`PartageChasses._retirerFloods([11, 12])`);
    expect(maReponse("10")).toContain("21/11/26 12:13 | Gamma");
    expect(maReponse("10")).not.toContain("12:30");
    // arrivé, plus à retirer : la lecture du forum ne le remarque pas partagé
    lire(`PartageChasses.recalerFloods([11], [])`);
    expect(lire(`Object.keys(PartageChasses.floodsPartages())`)).toEqual([]);
  });
});

describe("chasse retardée sur un autre appareil au-delà de mon réglage", () => {
  // mainteneur, 25/11/2026 : sa chasse publiée à 21h55 (heure réelle 21h44,
  // retard tiré sur un autre appareil), « Partager » proposé dans « Mes attaques
  // en cours » d'un appareil réglé plus bas, le clic a publié 21h44 : doublon.
  // La même chasse a le même TdC chassé ; heures et TdC inventés.
  const recaler = (anciennes: any[], groupes: any[], fenetre = 0) =>
    lire<any>(
      `PartageChasses.recalerListeChasses(${JSON.stringify(anciennes)}, ${JSON.stringify(groupes)}, "2026-11-21 12:00", ${fenetre})`,
    );
  const g = { debut: "2026-11-21 21:44", fin: "2026-11-21 21:44", terrain: 74816 };

  test("reconnue à son TdC chassé (même chasse), heure publiée gardée", () => {
    expect(recaler([{ date: "2026-11-21 21:55", terrain: 74816 }], [g])).toEqual({
      lignes: [{ date: "2026-11-21 21:55", terrain: 74816, reel: "2026-11-21 21:44" }],
      change: false,
    });
  });

  test("autre TdC chassé : une autre chasse, pas reconnue", () => {
    expect(recaler([{ date: "2026-11-21 21:55", terrain: 50000 }], [g]).lignes).toEqual([]);
  });

  test("plus de 59 min après son groupe : pas reconnue", () => {
    expect(recaler([{ date: "2026-11-21 22:45", terrain: 74816 }], [g]).lignes).toEqual([]);
  });

  test("doublon déjà au forum : la ligne à l'heure exacte reste, l'autre part", () => {
    expect(
      recaler(
        [
          { date: "2026-11-21 21:55", terrain: 74816 },
          { date: "2026-11-21 21:44", terrain: 74816 },
        ],
        [g],
      ),
    ).toEqual({
      lignes: [{ date: "2026-11-21 21:44", terrain: 74816, reel: "2026-11-21 21:44" }],
      change: true,
    });
  });

  test("partage : pas de doublon d'une chasse déjà publiée retardée ailleurs", async () => {
    preparer([["Alpha", [ligne("Chasses", chasse("2026-11-21 21:55", 74816))]]], [], {
      chasses: 0,
      floods: 0,
    });
    expect(
      await lire(
        `PartageChasses._partager("Chasses", [${JSON.stringify(chasse("2026-11-21 21:44", 74816))}])`,
      ),
    ).toBe(0);
    expect(ecritures()).toEqual([]);
    // une autre chasse (autre TdC chassé) est bien publiée
    expect(
      await lire(
        `PartageChasses._partager("Chasses", [${JSON.stringify(chasse("2026-11-21 21:44", 50000))}])`,
      ),
    ).toBe(1);
  });
});
