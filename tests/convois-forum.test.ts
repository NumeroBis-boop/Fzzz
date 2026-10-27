import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

const page = creerPage([
  "js/class/Utils.js",
  "js/page/PartageChasses.js",
  "js/page/ConvoisForum.js",
]);

describe("convois notés dans le forum", () => {
  const convois = [
    { arrivee: "2026-10-27 21:37", vers: "Kwhwwymwn", montant: 250000, id: 123456 },
    { arrivee: "2026-10-27 18:30", vers: "Staffie", montant: 340000, id: 123400 },
    { arrivee: "2026-10-26 10:00", vers: "Marmule", montant: 4459, id: 120000 },
  ];
  test("écriture : convois arrivés retirés, plus récent en premier, sans doublon", () => {
    const texte = page.lire<string>(
      `ConvoisForum.ecrire(${JSON.stringify([...convois, convois[0]])}, "2026-10-27 12:00")`,
    );
    expect(texte.split("\n")).toEqual([
      "27/10/26 21:37 | Kwhwwymwn | 250 000 | #123456",
      "27/10/26 18:30 | Staffie | 340 000 | #123400",
    ]);
  });
  test("lecture de ce qui a été écrit, et d'une ligne corrigée à la main", () => {
    const texte =
      page.lire<string>(`ConvoisForum.ecrire(${JSON.stringify(convois)}, "2026-10-27 12:00")`) +
      "\n27/10/2026 19h05 |  Grim | 1 000 000 |#99";
    expect(page.lire(`ConvoisForum.lire(${JSON.stringify(texte)})`)).toEqual([
      { arrivee: "2026-10-27 21:37", vers: "Kwhwwymwn", montant: 250000, id: 123456 },
      { arrivee: "2026-10-27 18:30", vers: "Staffie", montant: 340000, id: 123400 },
      { arrivee: "2026-10-27 19:05", vers: "Grim", montant: 1000000, id: 99 },
    ]);
  });
  test("les lignes de floods et de chasses ne sont pas prises pour des convois", () => {
    expect(
      page.lire(
        `ConvoisForum.lire("27/10/26 21:17 | Callisto | 30 000 unités | 6 000 cm² | TdC 30 000 | #98529\\n27/10/26 16:03 | 6 889 cm²")`,
      ),
    ).toEqual([]);
  });
});
