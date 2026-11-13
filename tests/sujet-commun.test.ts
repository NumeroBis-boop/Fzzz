import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Sujets communs « BDD générale flood » et « BDD générale chasse » (version
 * TEST, demande du mainteneur) : une section par joueur dans le premier
 * message, recopiée de son sujet « Floods | … » / « Chasses | … » après chaque
 * écriture ; l'affichage lit le sujet commun et ne lit le sujet d'un joueur
 * que si sa section est plus ancienne que lui. Joueurs inventés.
 */
const page = creerPage(
  ["js/class/Utils.js", "js/class/Requetes.js", "js/page/PartageChasses.js"],
  `var VERSION = "1.110.3";
   var heure = moment("2026-11-13 22:30:00", "YYYY-MM-DD HH:mm:ss").valueOf();
   var Horloge = { maintenant: () => heure, serveur: () => moment(heure), clic: () => moment(heure) };
   var monProfil = { pseudo: "Alpha" };
   var TOAST_INFO = {};
   var FORUM = {};`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);
lire(`(() => {
  PartageChasses._html = (d) => d;
  // forum simulé : liste des sujets (case, titre, dernier message), premier message, modifications
  PartageChasses._xajax = (f, args) => {
    if (f == "callGetForum")
      return Promise.resolve('<form id="form_cat"><table>' + FORUM.sujets.map((s) =>
        '<tr><td><input name="topic[]" value="' + s.id + '"/></td><td>' + s.titre + '</td><td><b>X</b><br/>' + s.dernier + '</td></tr>').join("") + '</table></form>');
    if (f == "callGetTopic") {
      FORUM.lectures.push(String(args));
      FORUM.ordre.push("lu " + args);
      if (FORUM.echoue.includes(String(args))) return Promise.reject(new Error("forum"));
      const s = FORUM.sujets.find((s) => s.id == args);
      return Promise.resolve(s ? '<div class="messageForum">' + s.texte.replace(/\\n/g, "<br/>") + "</div>" : "");
    }
    if (f == "envoiEditTopic") {
      const q = String(args), id = q.match(/IDTopic=(\\d+)/)[1],
        sujet = decodeURIComponent(q.match(/sujet=([^&]*)/)[1]),
        message = decodeURIComponent(q.match(/message=([^&]*)/)[1]),
        s = FORUM.sujets.find((s) => s.id == id);
      FORUM.ecritures.push({ id, sujet, message, modifiable: /modifiable=envoyer/.test(q) });
      FORUM.ordre.push("écrit " + id);
      PartageChasses.oublierCache();
      if (s && !FORUM.refuse.includes(id)) {
        s.titre = sujet;
        s.texte = message;
        s.dernier = moment(heure).format("D MMM [à] H[h]mm");
      }
      return Promise.resolve("<xjx></xjx>");
    }
    return Promise.reject(new Error("inattendu " + f));
  };
  // pause avant la vérification : un autre membre peut écrire pendant ce temps
  PartageChasses._attendre = () => (FORUM.pendant ? FORUM.pendant() : Promise.resolve());
})()`);

const ligne = (type: string, e: any) =>
  lire<string>(`PartageChasses._ligne(${JSON.stringify(type)}, ${JSON.stringify(e)})`);
const flood = (date: string, cible: string, id: number) => ({
  date,
  cible,
  unites: 1000,
  terrain: 1000,
  id,
});
const F11 = flood("2026-11-13 23:00", "Gamma", 11);
const F21 = flood("2026-11-13 23:10", "Alpha", 21);
const COMMUN_F = "BDD générale flood - NE RIEN ÉCRIRE";
const COMMUN_C = "BDD générale chasse - NE RIEN ÉCRIRE";
const regler = (quand: string) =>
  lire(`(() => { heure = moment(${JSON.stringify(quand)}, "YYYY-MM-DD HH:mm:ss").valueOf(); })()`);
const section = (pseudo: string, ecrit: string, lignes: string[]) =>
  [`--- ${pseudo} · ${ecrit} ---`, ...lignes].join("\n");

/** Section « BDD partagée cachée » : sujets communs et sujets des joueurs. */
function preparer(
  communFloods: string | null = section("Alpha", "2026-11-13 22:20:30", [ligne("Floods", F11)]),
) {
  const sujets = [
    { id: "1", titre: "Floods | Alpha", dernier: "13 nov. à 22h20", texte: ligne("Floods", F11) },
    { id: "2", titre: "Floods | Beta", dernier: "13 nov. à 22h25", texte: ligne("Floods", F21) },
    {
      id: "3",
      titre: "Chasses | Alpha",
      dernier: "13 nov. à 21h00",
      texte: ligne("Chasses", { date: "2026-11-13 23:30", terrain: 1500 }),
    },
    { id: "4", titre: "Convois | Alpha", dernier: "13 nov. à 21h00", texte: "rien" },
  ];
  if (communFloods != null)
    sujets.push({
      id: "10",
      titre: COMMUN_F,
      dernier: "13 nov. à 22h29",
      texte: "NE RIEN ÉCRIRE ICI\n" + communFloods,
    });
  sujets.push({ id: "11", titre: COMMUN_C, dernier: "13 nov. à 22h00", texte: "" });
  lire(`(() => {
    localStorage.clear();
    PartageChasses.idSection = "7";
    heure = moment("2026-11-13 22:30:00", "YYYY-MM-DD HH:mm:ss").valueOf();
    monProfil.pseudo = "Alpha";
    journalInstalle = true;
    Object.keys(COMPTE_REQUETES).forEach((k) => (COMPTE_REQUETES[k] = 0));
    FORUM = { sujets: ${JSON.stringify(sujets)}, lectures: [], ecritures: [], ordre: [], echoue: [], refuse: [], pendant: null };
  })()`);
}
const sujet = (id: string) => lire<any>(`FORUM.sujets.find((s) => s.id == ${JSON.stringify(id)})`);
const lectures = () => lire<string[]>(`FORUM.lectures.slice().sort()`);
const notes = (source = "Forum") =>
  lire<string[]>(
    `Journal.entrees().filter((e) => e.s == ${JSON.stringify(source)}).map((e) => e.m)`,
  );
async function charger(args = "") {
  lire(`(() => { PartageChasses.oublierCache(); FORUM.lectures.length = 0; })()`);
  return lire<Promise<any>>(
    `PartageChasses.charger(${args}).then((d) => JSON.parse(JSON.stringify(d)))`,
  );
}

describe("format du sujet commun", () => {
  test("titre reconnu sans tenir compte de la casse, des accents et de la suite", () => {
    const est = (titre: string, type: string) =>
      lire<boolean>(`PartageChasses.estCommun(${JSON.stringify(titre)}, ${JSON.stringify(type)})`);
    expect(est(COMMUN_F, "Floods")).toBe(true);
    expect(est("bdd GENERALE  flood (ne rien écrire)", "Floods")).toBe(true);
    expect(est(COMMUN_C, "Chasses")).toBe(true);
    expect(est(COMMUN_C, "Floods")).toBe(false);
    expect(est("Floods | BDD générale flood", "Floods")).toBe(false);
  });

  test("sections : en-tête « --- pseudo · heure --- », lignes, préambule gardé", () => {
    preparer();
    const texte = [
      "NE RIEN ÉCRIRE ICI",
      section("Beta", "2026-11-13 22:25:10", ["  " + ligne("Floods", F21) + "  ", ""]),
      section("Alpha", "2026-11-13 22:20:30", [ligne("Floods", F11)]),
    ].join("\n");
    const lu = lire<any>(`PartageChasses.sections(${JSON.stringify(texte)})`);
    expect(lu.preambule).toBe("NE RIEN ÉCRIRE ICI");
    expect(
      lu.sections.map((s: any) => [
        s.pseudo,
        s.ecrit,
        s.lignes.length,
        s.floods.map((f: any) => f.id),
      ]),
    ).toEqual([
      ["Beta", "2026-11-13 22:25:10", 1, [21]],
      ["Alpha", "2026-11-13 22:20:30", 1, [11]],
    ]);
    // réécrit : préambule, puis sections par pseudo
    expect(
      lire<string>(
        `PartageChasses.texteCommun(${JSON.stringify(lu.preambule)}, ${JSON.stringify(lu.sections)})`,
      ),
    ).toBe(
      [
        "NE RIEN ÉCRIRE ICI",
        section("Alpha", "2026-11-13 22:20:30", [ligne("Floods", F11)]),
        section("Beta", "2026-11-13 22:25:10", [ligne("Floods", F21)]),
      ].join("\n"),
    );
  });

  test("jamais vide : sans section ni préambule, une ligne neutre, retirée dès qu'une section revient", () => {
    expect(lire<string>(`PartageChasses.texteCommun("", [])`)).toBe("Aucun partage en cours.");
    expect(
      lire<string>(
        `PartageChasses.texteCommun("Aucun partage en cours.", [{ pseudo: "Alpha", ecrit: "2026-11-13 22:20:30", lignes: ["x"] }])`,
      ),
    ).toBe(section("Alpha", "2026-11-13 22:20:30", ["x"]));
  });

  test("la liste des sujets donne les sujets communs ; deux du même type : le plus ancien", async () => {
    preparer();
    lire(
      `(() => { FORUM.sujets.push({ id: "9", titre: "BDD générale flood - bis", dernier: "13 nov. à 22h00", texte: "" }); })()`,
    );
    const s = await lire<Promise<any>>(
      `PartageChasses.sujets().then((s) => JSON.parse(JSON.stringify(s.communs)))`,
    );
    expect([s.Floods.id, s.Floods.dernier, s.Chasses.id]).toEqual(["9", "X 13 nov. à 22h00", "11"]);
  });
});

describe("lecture : le sujet commun d'abord, le sujet d'un joueur seulement s'il est plus récent que sa section", () => {
  test("Alpha a sa section à jour : son sujet n'est pas lu ; Beta n'a pas de section : son sujet est lu", async () => {
    preparer();
    const d = await charger();
    expect(lectures()).toEqual(["10", "11", "2", "3"]);
    expect(d.floods.map((f: any) => [f.lanceur, f.id])).toEqual([
      ["Alpha", 11],
      ["Beta", 21],
    ]);
    expect(d.chasses.alpha.map((c: any) => c.terrain)).toEqual([1500]);
    // le sujet d'Alpha, couvert par sa section : une lecture évitée
    expect(lire<number>(`COMPTE_REQUETES.cache`)).toBe(1);
  });

  test("sujet du joueur modifié après sa section (autre appareil, ancienne version) : c'est lui qui fait foi", async () => {
    preparer();
    lire(`(() => {
      const s = FORUM.sujets.find((s) => s.id == "1");
      s.dernier = "13 nov. à 22h21";
      s.texte = ${JSON.stringify(ligne("Floods", flood("2026-11-13 23:40", "Delta", 12)))};
    })()`);
    const d = await charger();
    expect(lectures()).toContain("1");
    expect(d.floods.filter((f: any) => f.lanceur == "Alpha").map((f: any) => f.id)).toEqual([12]);
  });

  test("sujet modifié dans la minute de la section (écrit juste avant elle) : la section suffit", async () => {
    preparer(section("Alpha", "2026-11-13 22:20:59", [ligne("Floods", F11)]));
    await charger();
    expect(lectures()).not.toContain("1");
  });

  test("joueur qui n'a que sa section : ses floods sont pris ; ses chasses seulement s'il est suivi", async () => {
    preparer(
      [
        section("Alpha", "2026-11-13 22:20:30", [ligne("Floods", F11)]),
        section("Gamma", "2026-11-13 22:28:00", [
          ligne("Floods", flood("2026-11-13 23:50", "Beta", 31)),
        ]),
      ].join("\n"),
    );
    lire(
      `(() => { FORUM.sujets.find((s) => s.id == "11").texte = ${JSON.stringify(section("Gamma", "2026-11-13 22:28:00", [ligne("Chasses", { date: "2026-11-13 23:55", terrain: 900 })]))}; })()`,
    );
    const d = await charger();
    expect(d.floods.map((f: any) => [f.lanceur, f.id])).toEqual([
      ["Alpha", 11],
      ["Beta", 21],
      ["Gamma", 31],
    ]);
    expect(Object.keys(d.chasses).sort()).toEqual(["alpha", "gamma"]);
    const suivi = await charger(`["Beta"]`);
    expect(Object.keys(suivi.chasses)).toEqual([]);
  });

  test("deux sections d'un même joueur : la plus récente", async () => {
    preparer(
      [
        section("Alpha", "2026-11-13 22:10:00", [
          ligne("Floods", flood("2026-11-13 23:05", "Old", 9)),
        ]),
        section("Alpha", "2026-11-13 22:20:30", [ligne("Floods", F11)]),
      ].join("\n"),
    );
    const d = await charger();
    expect(d.floods.filter((f: any) => f.lanceur == "Alpha").map((f: any) => f.id)).toEqual([11]);
    // la plus récente couvre le sujet d'Alpha : il n'est pas lu
    expect(lectures()).not.toContain("1");
  });

  test("sujet commun illisible ou absent : tous les sujets des joueurs sont lus, comme avant", async () => {
    preparer();
    lire(`(() => { FORUM.echoue.push("10"); })()`);
    let d = await charger();
    expect(lectures()).toEqual(["1", "10", "11", "2", "3"]);
    expect(d.floods.map((f: any) => f.id)).toEqual([11, 21]);
    preparer(null);
    d = await charger();
    expect(lectures()).toEqual(["1", "11", "2", "3"]);
  });

  test("chasses seules d'un joueur : seul le sujet commun des chasses est lu, jamais celui des convois", async () => {
    preparer();
    await charger(`["Alpha"], false`);
    expect(lectures()).toEqual(["11", "3"]);
  });

  test("sujet commun inchangé (même date) : gardé d'une page à l'autre, comme les autres", async () => {
    preparer();
    // 22:30:00 : le sujet commun, daté 22h29, est lu dans la minute qui suit sa date
    await charger();
    regler("2026-11-13 22:35:00");
    await charger();
    // une modification de 22:29:59 pourrait manquer à cette lecture : relu une fois
    expect(lectures()).toEqual(["10"]);
    regler("2026-11-13 22:40:00");
    await charger();
    expect(lectures()).toEqual([]);
  });
});

describe("recopie de ma section après l'écriture de mon sujet", () => {
  const recopier = (type: string, entrees: any[]) =>
    lire<Promise<string>>(
      `PartageChasses.recopier(${JSON.stringify(type)}, ${JSON.stringify(entrees)})`,
    );

  test("ma section remplacée, celles des autres et le préambule gardés tels quels ; titre et case du sujet", async () => {
    preparer(
      [
        section("Alpha", "2026-11-13 22:20:30", [ligne("Floods", F11)]),
        section("Beta", "2026-11-13 22:25:10", ["13/11/26 23:10 | Alpha | 1 000 cm² | #21"]),
      ].join("\n"),
    );
    regler("2026-11-13 22:31:05");
    const F12 = flood("2026-11-13 23:40", "Delta", 12);
    expect(await recopier("Floods", [F11, F12])).toBe("recopiée");
    const e = lire<any[]>(`FORUM.ecritures`);
    expect(e.length).toBe(1);
    expect([e[0].id, e[0].sujet, e[0].modifiable]).toEqual(["10", COMMUN_F, true]);
    expect(sujet("10").texte).toBe(
      [
        "NE RIEN ÉCRIRE ICI",
        section("Alpha", "2026-11-13 22:31:05", [ligne("Floods", F12), ligne("Floods", F11)]),
        section("Beta", "2026-11-13 22:25:10", ["13/11/26 23:10 | Alpha | 1 000 cm² | #21"]),
      ].join("\n"),
    );
    // relu après la pause pour vérifier
    expect(lire<string[]>(`FORUM.lectures`)).toEqual(["10", "10"]);
    expect(notes()).toContain(
      "« BDD générale flood - NE RIEN ÉCRIRE » : section de Alpha recopiée (2 ligne(s), essai 1)",
    );
  });

  test("plus rien à venir : ma section est retirée", async () => {
    preparer();
    expect(await recopier("Floods", [])).toBe("recopiée");
    expect(sujet("10").texte).toBe("NE RIEN ÉCRIRE ICI");
  });

  test("ma section retirée puis remise par un membre qui avait lu avant : retirée de nouveau", async () => {
    preparer();
    regler("2026-11-13 22:31:05");
    lire(`(() => {
      const avant = FORUM.sujets.find((s) => s.id == "10").texte;
      let fois = 0;
      FORUM.pendant = () => {
        if (fois++ == 0) FORUM.sujets.find((s) => s.id == "10").texte = avant;
        return Promise.resolve();
      };
    })()`);
    expect(await recopier("Floods", [])).toBe("recopiée");
    expect(lire<number>(`FORUM.ecritures.length`)).toBe(2);
    expect(sujet("10").texte).toBe("NE RIEN ÉCRIRE ICI");
  });

  test("un autre membre réécrit le sujet lu avant ma recopie : elle est refaite", async () => {
    preparer(section("Beta", "2026-11-13 22:25:10", [ligne("Floods", F21)]));
    // Beta a lu le sujet avant ma recopie et l'écrit pendant la pause : ma section disparaît
    lire(`(() => {
      const avant = FORUM.sujets.find((s) => s.id == "10").texte;
      let fois = 0;
      FORUM.pendant = () => {
        if (fois++ == 0) FORUM.sujets.find((s) => s.id == "10").texte = avant + "\\n" + "13/11/26 23:20 | Beta2 | 500 cm²";
        return Promise.resolve();
      };
    })()`);
    expect(await recopier("Floods", [F11])).toBe("recopiée");
    expect(lire<number>(`FORUM.ecritures.length`)).toBe(2);
    const lu = lire<any>(`PartageChasses.sections(FORUM.sujets.find((s) => s.id == "10").texte)`);
    expect(lu.sections.map((s: any) => s.pseudo)).toEqual(["Alpha", "Beta"]);
    expect(notes().some((n) => n.includes("essai 2"))).toBe(true);
  });

  test("défaite à chaque essai : trois essais, puis une erreur au journal ; mon sujet seul fait foi", async () => {
    preparer();
    lire(`(() => {
      const avant = FORUM.sujets.find((s) => s.id == "10").texte;
      FORUM.pendant = () => {
        FORUM.sujets.find((s) => s.id == "10").texte = avant;
        return Promise.resolve();
      };
    })()`);
    regler("2026-11-13 22:31:05");
    expect(await recopier("Floods", [F11])).toBe("échec");
    expect(lire<number>(`FORUM.ecritures.length`)).toBe(3);
    expect(notes()).toContain(
      "« BDD générale flood - NE RIEN ÉCRIRE » : section de Alpha défaite après 3 essais ; ton sujet seul fait foi",
    );
  });

  test("recopie plus récente depuis mon autre appareil pendant la pause : rien à refaire", async () => {
    preparer();
    regler("2026-11-13 22:31:05");
    lire(`(() => {
      FORUM.pendant = () => {
        const s = FORUM.sujets.find((s) => s.id == "10");
        s.texte = s.texte.replace("2026-11-13 22:31:05", "2026-11-13 22:31:07");
        return Promise.resolve();
      };
    })()`);
    expect(await recopier("Floods", [F11])).toBe("recopiée");
    expect(lire<number>(`FORUM.ecritures.length`)).toBe(1);
  });

  test("écriture refusée par le forum (grade, message verrouillé) : vue à la relecture", async () => {
    preparer();
    lire(`(() => { FORUM.refuse.push("10"); })()`);
    expect(await recopier("Floods", [flood("2026-11-13 23:40", "Delta", 12)])).toBe("échec");
  });

  test("pas de sujet commun : rien n'est écrit, noté au journal", async () => {
    preparer(null);
    expect(await recopier("Floods", [F11])).toBe("sans sujet");
    expect(lire<number>(`FORUM.ecritures.length`)).toBe(0);
    expect(notes()).toContain(
      "pas de sujet « BDD générale flood - NE RIEN ÉCRIRE » dans la section : rien n'est recopié",
    );
  });

  test("trop de lignes, ou message trop long : pas de recopie, mon sujet seul fait foi", async () => {
    preparer();
    const beaucoup = Array.from({ length: 101 }, (_, i) =>
      flood("2026-11-13 23:40", "Cible", 100 + i),
    );
    expect(await recopier("Floods", beaucoup)).toBe("trop long");
    lire(`(() => { FORUM.sujets.find((s) => s.id == "10").texte = "x".repeat(40000); })()`);
    expect(await recopier("Floods", [F11])).toBe("trop long");
    expect(lire<number>(`FORUM.ecritures.length`)).toBe(0);
  });

  test("deux recopies d'une page : l'une après l'autre, la dernière l'emporte", async () => {
    preparer();
    const F12 = flood("2026-11-13 23:40", "Delta", 12);
    regler("2026-11-13 22:31:05");
    const p1 = recopier("Floods", [F11]);
    regler("2026-11-13 22:31:20");
    const p2 = recopier("Floods", [F11, F12]);
    expect([await p1, await p2]).toEqual(["recopiée", "recopiée"]);
    // la seconde lit le sujet une fois la première vérifiée
    expect(lire<string[]>(`FORUM.ordre`)).toEqual([
      "lu 10",
      "écrit 10",
      "lu 10",
      "lu 10",
      "écrit 10",
      "lu 10",
    ]);
    const lu = lire<any>(`PartageChasses.sections(FORUM.sujets.find((s) => s.id == "10").texte)`);
    expect(lu.sections[0].floods.map((f: any) => f.id).sort()).toEqual([11, 12]);
  });
});

describe("recopies déclenchées par les écritures du sujet du joueur", () => {
  function espionner() {
    lire(`(() => {
      window.RECOPIES = [];
      window.vraiRecopier = window.vraiRecopier || PartageChasses.recopier;
      PartageChasses.recopier = (type, entrees) => { RECOPIES.push([type, entrees.map((e) => e.id || e.date)]); return Promise.resolve("recopiée"); };
    })()`);
  }
  const remettre = () => lire(`(() => { PartageChasses.recopier = window.vraiRecopier; })()`);

  test("partage de floods : mon sujet puis ma section, avec les entrées à venir seulement", async () => {
    preparer();
    espionner();
    await lire(
      `PartageChasses._partager("Floods", [${JSON.stringify(flood("2026-11-13 23:40", "Delta", 12))}])`,
    );
    expect(lire<any[]>(`RECOPIES`)).toEqual([["Floods", [12, 11]]]);
    remettre();
  });

  test("rien de nouveau à partager : pas de recopie", async () => {
    preparer();
    espionner();
    await lire(`PartageChasses._partager("Floods", [${JSON.stringify(F11)}])`);
    expect(lire<any[]>(`RECOPIES`)).toEqual([]);
    remettre();
  });

  test("floods annulés retirés de mon sujet : ma section suit", async () => {
    preparer();
    espionner();
    await lire(`PartageChasses._retirerFloods([11], "Alpha", "Floods | Alpha")`);
    expect(lire<any[]>(`RECOPIES`)).toEqual([["Floods", []]]);
    remettre();
  });

  test("chasses annulées (page Ressources) : ma section suit", async () => {
    preparer();
    espionner();
    lire(`(() => { localStorage.setItem("fzzz_finChassesPartagees", "2026-11-13 23:30"); })()`);
    await lire(`PartageChasses.recalerChasses([])`);
    expect(lire<any[]>(`RECOPIES`)).toEqual([["Chasses", []]]);
    remettre();
  });
});
