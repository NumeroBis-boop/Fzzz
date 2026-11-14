import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

const page = creerPage(["js/class/Utils.js", "js/page/PartageChasses.js"]);
page.lire(`var lectures = 0, decalage = 0, vraiNow = Date.now;
  Date.now = () => vraiNow() + decalage;
  PartageChasses._lireSujets = (id) => { lectures++; return Promise.resolve({ historiques: [], communs: {} }); };
  $.ajax = () => $.Deferred().resolve("<xjx></xjx>").promise();`);
const lire = (cache: boolean) =>
  page.lire<Promise<number>>(
    `(PartageChasses.idSection = "7", PartageChasses.sujets(${cache}).then(() => lectures))`,
  );

describe("liste des sujets du forum gardée une minute pour l'affichage", () => {
  test("relu une fois par minute ; lecture neuve toujours possible", async () => {
    page.lire(`localStorage.clear(); lectures = 0; decalage = 0;`);
    expect(await lire(true)).toBe(1);
    expect(await lire(true)).toBe(1);
    // avant une écriture : toujours relu
    expect(await lire(false)).toBe(2);
    page.lire(`decalage = 61000`);
    expect(await lire(true)).toBe(3);
  });
  test("écriture dans le forum depuis cet appareil : lectures gardées oubliées, sujets communs compris", async () => {
    page.lire(`localStorage.clear(); lectures = 0; decalage = 0;
      localStorage.setItem("fzzz_sujetsGardes", JSON.stringify({ 10: { dernier: "", lu: 0, v: {}, version: "" } }));`);
    await lire(true);
    await page.lire(
      `PartageChasses._xajax("envoiEditMessage", "<xjxquery><q>IDMessage=5</q></xjxquery>")`,
    );
    expect(await lire(true)).toBe(2);
    // lu avant mon écriture, le sujet commun ne l'aurait pas
    expect(page.lire(`localStorage.getItem("fzzz_sujetsGardes")`)).toBeNull();
  });
});
