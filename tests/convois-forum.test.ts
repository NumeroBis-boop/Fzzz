import { beforeEach, describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";
import { FORUM_SIMULE } from "./forum-simule";

/**
 * Convois dans le sujet commun « BDD générale convoi - NE RIEN ÉCRIRE » : une
 * réponse par joueur, écrite par son extension, une ligne par convoi avec la
 * nourriture et les matériaux (choix du mainteneur, 19/11/2026), suivie de sa
 * répartition quand il a été transmis au site de suivi. Les sujets
 * « Convois | pseudo » d'avant sont encore lus pour l'état « ✅ Enregistré ».
 * Joueurs et nombres inventés.
 */
const page = creerPage(
  ["js/class/Utils.js", "js/page/PartageChasses.js", "js/page/ConvoisForum.js"],
  `var heure = moment("2026-11-19 10:00", "YYYY-MM-DD HH:mm").valueOf();
   var Horloge = { maintenant: () => heure, serveur: () => moment(heure) };
   var monProfil = { pseudo: "Moi" };
   var OUAF_ECART_ARRIVEE = 120000;`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);
lire(FORUM_SIMULE);
const HEURE = lire<number>(`heure`);
const H = 3600000;
const COMMUN = "BDD générale convoi - NE RIEN ÉCRIRE";

// forum simulé : la section, ses sujets ; appels xajax notés
beforeEach(() =>
  lire(`(() => {
    localStorage.clear();
    console.error = () => {};
    window.FORUM = { sujets: [], appels: [], refuse: false };
    PartageChasses.idSection = "7";
    PartageChasses._html = (d) => d;
    PartageChasses._xajax = (f, args) => {
      FORUM.appels.push(f);
      if (f == "callGetForum")
        return Promise.resolve('<form id="form_cat"><table>' + FORUM.sujets.map((s) =>
          '<tr><td><input name="topic[]" value="' + s.id + '"/></td><td>' + s.titre + '</td><td>X</td></tr>').join("") + '</table></form>');
      // grade sans droit d'écrire : le forum répond par le sujet, inchangé
      if (FORUM.refuse && f.startsWith("envoi"))
        return SIM.traiter(FORUM.sujets, "callGetTopic", SIM.q(args, "topic") || "20", monProfil.pseudo);
      return SIM.traiter(FORUM.sujets, f, args, monProfil.pseudo) || Promise.resolve("");
    };
  })()`),
);
/** Sujet commun des convois, avec les réponses données [auteur, lignes]. */
const commun = (...reponses: [string, string[]][]) =>
  lire(
    `FORUM.sujets.push(${JSON.stringify({
      id: "20",
      titre: COMMUN,
      texte: "NE RIEN ÉCRIRE",
      reponses: reponses.map(([auteur, lignes], i) => ({
        id: 700 + i,
        auteur,
        texte: lignes.join("\n"),
      })),
    })})`,
  );
/** Texte de la réponse d'un joueur dans le sujet commun, null sans réponse. */
const reponse = (auteur = "Moi") =>
  lire<string | null>(`(() => {
    const r = (FORUM.sujets.find((s) => s.id == "20").reponses || []).filter((r) => r.auteur == ${JSON.stringify(auteur)}).pop();
    return r ? r.texte : null;
  })()`);
/** Convoi de la page Convois (OuafSuivi.convoisJeu), arrivée dans `dans` ms. */
const convoi = (id: number, vers: string, nou: number, mat: number, dans = 2 * H) => ({
  id,
  vers,
  nou,
  mat,
  montant: nou + mat,
  arrivee: HEURE + dans,
});
const appels = () => lire<string[]>(`FORUM.appels.filter((f) => f.startsWith("envoi"))`);

describe("lignes d'un convoi", () => {
  const convois = [
    {
      arrivee: "2026-11-19 21:37",
      vers: "Alpha",
      nou: 4,
      mat: 250000,
      montant: 250004,
      id: 123456,
    },
    {
      arrivee: "2026-11-19 18:30",
      vers: "Bravo",
      nou: 340000,
      mat: 0,
      montant: 340000,
      id: 123400,
    },
    { arrivee: "2026-11-18 10:00", vers: "Charlie", nou: 0, mat: 4459, montant: 4459, id: 120000 },
  ];
  test("écriture : nourriture et matériaux sur la même ligne, arrivés retirés, plus tardif en premier, sans doublon", () => {
    const texte = lire<string>(
      `ConvoisForum.ecrire(${JSON.stringify([...convois, convois[0]])}, "2026-11-19 12:00")`,
    );
    expect(texte.split("\n")).toEqual([
      "19/11/26 21:37 | Alpha | 4 pommes | 250 000 bois | #123456",
      "19/11/26 18:30 | Bravo | 340 000 pommes | 0 bois | #123400",
    ]);
  });

  test("lecture de ce qui a été écrit, répartition comprise, et d'une ligne corrigée à la main", () => {
    const texte =
      lire<string>(
        `ConvoisForum.ecrire(${JSON.stringify([{ ...convois[0], prevu: 200000, avance: 50004 }])}, "2026-11-19 12:00")`,
      ) + "\n19/11/2026 19h05 |  Delta | 1 000 pommes|2 000 bois |#99";
    expect(texte.split("\n")[0]).toBe(
      "19/11/26 21:37 | Alpha | 4 pommes | 250 000 bois | #123456 | prévu 200 000 | avance 50 004",
    );
    expect(lire(`ConvoisForum.lire(${JSON.stringify(texte)})`)).toEqual([
      { ...convois[0], prevu: 200000, avance: 50004 },
      { arrivee: "2026-11-19 19:05", vers: "Delta", nou: 1000, mat: 2000, montant: 3000, id: 99 },
    ]);
  });

  test("lignes des sujets « Convois | pseudo » d'avant (un seul montant) toujours lues", () => {
    expect(
      lire(
        `ConvoisForum.lire("01/01/99 10:00 | Alpha | 466 945 | #101 | prévu 300 000 | avance 166 945\\n01/01/99 11:00 | Bravo | 1 000 | #102")`,
      ),
    ).toEqual([
      {
        arrivee: "2099-01-01 10:00",
        vers: "Alpha",
        montant: 466945,
        id: 101,
        prevu: 300000,
        avance: 166945,
      },
      { arrivee: "2099-01-01 11:00", vers: "Bravo", montant: 1000, id: 102 },
    ]);
  });

  test("les lignes de floods et de chasses ne sont pas prises pour des convois", () => {
    expect(
      lire(
        `ConvoisForum.lire("27/10/26 21:17 | Callisto | 30 000 unités | 6 000 cm² | TdC 30 000 | #98529\\n27/10/26 16:03 | 6 889 cm²")`,
      ),
    ).toEqual([]);
  });
});

describe("ma réponse du sujet commun, écrite quand un convoi est transmis au site de suivi", () => {
  const transmis = (id: number, vers: string, nou: number, mat: number, dans = 2 * H) =>
    JSON.stringify({ ...convoi(id, vers, nou, mat, dans), prevu: 0, avance: nou + mat });

  test("premier convoi noté : ma réponse postée avec sa répartition ; celles des autres intactes", async () => {
    commun(["Bravo", ["19/11/26 12:00 | Charlie | 1 pommes | 2 bois | #5"]]);
    await lire(`ConvoisForum.noter([${transmis(901, "Alpha", 4, 0)}])`);
    expect(appels()).toEqual(["envoiNouveauMessage"]);
    expect(reponse()).toBe(
      "19/11/26 12:00 | Alpha | 4 pommes | 0 bois | #901 | prévu 0 | avance 4",
    );
    expect(reponse("Bravo")).toBe("19/11/26 12:00 | Charlie | 1 pommes | 2 bois | #5");
  });

  test("un autre convoi est ajouté à ma réponse, le plus récent en premier", async () => {
    commun(["Moi", ["19/11/26 12:00 | Alpha | 4 pommes | 0 bois | #901 | prévu 0 | avance 4"]]);
    await lire(`ConvoisForum.noter([${transmis(902, "Bravo", 0, 9000, 3 * H)}])`);
    expect(appels()).toEqual(["envoiEditMessage"]);
    expect(reponse()).toBe(
      "19/11/26 13:00 | Bravo | 0 pommes | 9 000 bois | #902 | prévu 0 | avance 9 000\n19/11/26 12:00 | Alpha | 4 pommes | 0 bois | #901 | prévu 0 | avance 4",
    );
  });

  test("convois arrivés : retirés à l'écriture suivante, sans historique", async () => {
    commun(["Moi", ["19/11/26 08:00 | Alpha | 1 pommes | 1 bois | #800 | prévu 2 | avance 0"]]);
    await lire(`ConvoisForum.noter([${transmis(901, "Alpha", 4, 0)}])`);
    expect(reponse()).toBe(
      "19/11/26 12:00 | Alpha | 4 pommes | 0 bois | #901 | prévu 0 | avance 4",
    );
    expect(lire(`FORUM.sujets.length`)).toBe(1);
  });

  test("sujet commun absent : refusé, avec le titre à créer", async () => {
    let erreur = "";
    await lire<Promise<void>>(`ConvoisForum.noter([${transmis(901, "Alpha", 4, 0)}])`).catch(
      (e: Error) => (erreur = e.message),
    );
    expect(erreur).toBe(
      `sujet « ${COMMUN} » absent du forum, à créer par un chef dans la section cachée`,
    );
  });

  test("écriture que le forum ne prend pas (grade sans droit d'écrire) : erreur, pas un succès", async () => {
    commun();
    lire(`FORUM.refuse = true`);
    let erreur = "";
    await lire<Promise<void>>(`ConvoisForum.noter([${transmis(901, "Alpha", 4, 0)}])`).catch(
      (e: Error) => (erreur = e.message),
    );
    expect(erreur).toBe("écriture refusée par le forum (droits de la section ?)");
  });
});

describe("site de suivi : « ✅ Enregistré » d'après le forum", () => {
  test("convoi transmis : sa ligne déjà notée prend sa répartition, une seule ligne", async () => {
    commun(["Moi", ["19/11/26 12:00 | Alpha | 4 pommes | 0 bois | #901"]]);
    await lire(
      `ConvoisForum.noter([${JSON.stringify({ ...convoi(901, "Alpha", 4, 0), prevu: 0, avance: 4 })}])`,
    );
    expect(reponse()).toBe(
      "19/11/26 12:00 | Alpha | 4 pommes | 0 bois | #901 | prévu 0 | avance 4",
    );
  });

  test("état : les lignes avec répartition de ma réponse et celles de mon ancien sujet ; un convoi seulement partagé n'est pas enregistré", async () => {
    commun(
      [
        "Moi",
        [
          "19/11/26 12:00 | Alpha | 4 pommes | 0 bois | #901 | prévu 0 | avance 4",
          "19/11/26 13:00 | Bravo | 0 pommes | 9 000 bois | #902",
        ],
      ],
      ["Bravo", ["19/11/26 12:00 | Moi | 1 pommes | 1 bois | #903 | prévu 1 | avance 1"]],
    );
    lire(
      `FORUM.sujets.push({ id: "5", titre: "Convois | Moi", texte: "19/11/26 14:00 | Charlie | 7 000 | #850 | prévu 7 000 | avance 0" })`,
    );
    const notes = await lire<Promise<{ id: number; arrivee: number }[]>>(`ConvoisForum.notes()`);
    expect(notes.map((n) => n.id)).toEqual([901, 850]);
    expect(notes[0]?.arrivee).toBe(HEURE + 2 * H);
  });

  test("forum sans sujet commun : état inconnu (refusée), pas « non noté »", async () => {
    let erreur = "";
    await lire<Promise<void>>(`ConvoisForum.notes()`).catch((e: Error) => (erreur = e.message));
    expect(erreur).toContain(COMMUN);
  });
});

describe("convoi annulé : sa ligne retirée de ma réponse, une seule", () => {
  const retirer = (c: object) =>
    lire<Promise<boolean>>(`ConvoisForum.retirer(${JSON.stringify(c)})`);
  const A = { id: 901, vers: "Alpha", montant: 4, arrivee: HEURE + 2 * H };

  test("par numéro : la ligne de ce convoi, pas celle du convoi identique", async () => {
    commun([
      "Moi",
      [
        "19/11/26 12:00 | Alpha | 4 pommes | 0 bois | #901",
        "19/11/26 12:00 | Alpha | 4 pommes | 0 bois | #902",
      ],
    ]);
    expect(await retirer(A)).toBe(true);
    expect(reponse()).toBe("19/11/26 12:00 | Alpha | 4 pommes | 0 bois | #902");
  });

  test("numéro inconnu (#0), deux lignes identiques : une seule retirée", async () => {
    commun([
      "Moi",
      [
        "19/11/26 12:00 | Alpha | 4 pommes | 0 bois | #0",
        "19/11/26 12:00 | Alpha | 4 pommes | 0 bois | #0",
      ],
    ]);
    expect(await retirer(A)).toBe(true);
    expect(reponse()).toBe("19/11/26 12:00 | Alpha | 4 pommes | 0 bois | #0");
  });

  test("dernier convoi retiré : « Aucun convoi en cours. » ; absente : rien n'est écrit", async () => {
    commun(["Moi", ["19/11/26 12:00 | Alpha | 4 pommes | 0 bois | #901"]]);
    expect(await retirer(A)).toBe(true);
    expect(reponse()).toBe("Aucun convoi en cours.");
    lire(`FORUM.appels.length = 0`);
    expect(await retirer(A)).toBe(false);
    expect(appels()).toEqual([]);
  });
});

describe("convois qui arrivent chez moi (joueur sans Compte+)", () => {
  test("lignes vers moi de toutes les réponses, comptées à la fin de leur minute ; arrivés, vers d'autres et anciennes lignes ignorés", async () => {
    commun(
      [
        "Alpha",
        [
          "19/11/26 12:00 | moi | 4 pommes | 250 000 bois | #1",
          "19/11/26 13:00 | Bravo | 1 pommes | 1 bois | #2",
        ],
      ],
      [
        "Bravo",
        [
          "19/11/26 08:00 | Moi | 9 pommes | 9 bois | #3",
          "19/11/26 11:30 | Moi | 0 pommes | 600 bois | #4",
        ],
      ],
      ["Charlie", ["19/11/26 12:00 | Moi | 5 000 | #5"]],
    );
    expect(await lire(`ConvoisForum.recus()`)).toEqual([
      { de: "Bravo", t: HEURE + 1.5 * H + 60000, q: [0, 600] },
      { de: "Alpha", t: HEURE + 2 * H + 60000, q: [4, 250000] },
    ]);
  });
});
