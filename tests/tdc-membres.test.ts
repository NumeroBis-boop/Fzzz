import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * TdC des membres (page Membres du jeu, sinon classement de l'alliance) : une
 * lecture coupée (HTTP 0, le plus souvent le joueur qui change de page pendant
 * la lecture) n'est pas une erreur du journal, qui part au fichier les jours
 * d'erreur ; une page du jeu qui répond mal en reste une (journaux du 19 au
 * 21/11/2026).
 */
const page = creerPage(["js/class/Utils.js", "js/page/PartageChasses.js"], ``);

/** Notes du journal d'une lecture dont chaque page répond par `statuts` (0, 503…) ou le tableau. */
const notes = (statuts: (number | null)[]) =>
  page.lire<Promise<(string | undefined)[][]>>(`(() => {
    localStorage.clear();
    document.body.innerHTML = "<span id='tag_alliance'>OUAF</span>";
    window.NOTES = [];
    Journal.info = (source, message, detail) => NOTES.push(["info", source, message, detail]);
    Journal.erreur = (source, message, detail) => NOTES.push(["erreur", source, message, detail]);
    let statuts = ${JSON.stringify(statuts)};
    $.get = () => {
      let s = statuts.shift();
      return s == null
        ? Promise.resolve("<table id='tabMembresAlliance'><tr><td></td><td></td><td>Alpha</td><td></td><td>1 000</td></tr></table>")
        : Promise.reject({ status: s });
    };
    return PartageChasses.tdcMembres(true).then((tdc) => NOTES.concat([["tdc", JSON.stringify(tdc)]]));
  })()`);

describe("TdC des membres : lecture interrompue ou en échec", () => {
  test("les deux pages coupées (HTTP 0) : simple information", async () => {
    expect(await notes([0, 0])).toEqual([
      [
        "info",
        "TdC des membres",
        "lecture interrompue (page quittée ?)",
        "/alliance.php?Membres : HTTP 0 ; /classementAlliance.php?alliance=OUAF : HTTP 0",
      ],
      ["tdc", "{}"],
    ]);
  });

  test("le jeu répond par une erreur : erreur au journal, avec les deux pages essayées", async () => {
    expect(await notes([503, 0])).toEqual([
      [
        "erreur",
        "TdC des membres",
        "/alliance.php?Membres : HTTP 503 ; /classementAlliance.php?alliance=OUAF : HTTP 0",
        undefined,
      ],
      ["tdc", "{}"],
    ]);
    expect((await notes([0, 502]))[0]?.[0]).toBe("erreur");
  });

  test("page Membres lisible : aucune note", async () => {
    expect(await notes([null])).toEqual([["tdc", '{"Alpha":1000}']]);
  });
});
