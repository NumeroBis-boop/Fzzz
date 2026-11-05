import { describe, expect, test } from "bun:test";
import { join } from "node:path";

// Le fuseau du PC ne se change qu'au lancement du processus : chaque cas
// s'exécute dans un processus à part, avec la variable TZ voulue.
function dansLeFuseau(tz: string): Record<string, unknown> {
  const harnais = join(import.meta.dir, "harnais.ts");
  const code = `
    import { creerPage } from ${JSON.stringify(harnais)};
    const page = creerPage([
      "js/lib/moment-timezone_0.5.48.js",
      "js/class/Fuseau.js",
      "js/class/Horloge.js",
    ]);
    console.log(JSON.stringify(page.lire(\`({
      zone: moment.defaultZone ? moment.defaultZone.name : null,
      hiver: moment(Date.UTC(2026, 10, 5, 17, 30)).format("YYYY-MM-DD HH:mm"),
      ete: moment(Date.UTC(2026, 6, 1, 10, 0)).format("YYYY-MM-DD HH:mm"),
      lu: moment("2026-11-05 18:30", "YYYY-MM-DD HH:mm").valueOf(),
      impact: (() => {
        let m = Horloge.serveurA(Date.UTC(2026, 10, 5, 1, 0)).add(3600, "s").hours(2).minutes(59).startOf("minute");
        return [m.valueOf(), m.format("YYYY-MM-DD HH:mm")];
      })(),
      changementHeure: moment(Date.UTC(2026, 9, 24, 23, 0)).add(3, "hours").format("HH:mm"),
      local: Horloge.heureLocale(Date.UTC(2026, 10, 5, 17, 30)),
      ligne: Horloge.ligneLocale(Date.UTC(2026, 10, 5, 17, 30)),
    })\`)));
  `;
  const r = Bun.spawnSync({
    cmd: [process.execPath, "-e", code],
    env: { ...process.env, TZ: tz },
  });
  if (r.exitCode !== 0) throw new Error(r.stderr.toString());
  return JSON.parse(r.stdout.toString().trim().split("\n").pop() as string);
}

describe("heures du jeu (Paris) quel que soit le fuseau du PC", () => {
  for (const tz of ["America/Toronto", "UTC"]) {
    test(`PC en ${tz} : heures affichées et lues à l'heure de Paris`, () => {
      const r = dansLeFuseau(tz);
      expect(r.zone).toBe("Europe/Paris");
      expect(r.hiver).toBe("2026-11-05 18:30");
      expect(r.ete).toBe("2026-07-01 12:00");
      expect(r.lu).toBe(Date.UTC(2026, 10, 5, 17, 30));
      // « Arrivée à 02h59 » du jeu : 01:59 UTC en hiver
      expect(r.impact).toEqual([Date.UTC(2026, 10, 5, 1, 59), "2026-11-05 02:59"]);
      // passage à l'heure d'hiver le 25/10/2026 : 01:00 CEST + 3 h = 03:00 CET
      expect(r.changementHeure).toBe("03:00");
    });
  }

  test("horloge : heure locale et écart avec le jeu (info-bulle et ligne)", () => {
    const toronto = dansLeFuseau("America/Toronto"),
      utc = dansLeFuseau("UTC"),
      inde = dansLeFuseau("Asia/Kolkata");
    expect(toronto.local).toBe("Chez toi : 12:30 (6 h de moins que le jeu)");
    expect(utc.local).toBe("Chez toi : 17:30 (1 h de moins que le jeu)");
    expect(inde.local).toBe("Chez toi : 23:00 (4 h 30 de plus que le jeu)");
    // ligne sous l'horloge, lisible sur téléphone
    expect(toronto.ligne).toBe("Chez toi : 12:30 (−6 h)");
    expect(utc.ligne).toBe("Chez toi : 17:30 (−1 h)");
    expect(inde.ligne).toBe("Chez toi : 23:00 (+4 h 30)");
  });

  test("PC à l'heure de Paris : moment garde l'heure du PC", () => {
    const r = dansLeFuseau("Europe/Paris");
    expect(r.zone).toBeNull();
    expect(r.local).toBeNull();
    expect(r.ligne).toBeNull();
    expect(r.hiver).toBe("2026-11-05 18:30");
    expect(r.lu).toBe(Date.UTC(2026, 10, 5, 17, 30));
    expect(r.changementHeure).toBe("03:00");
  });
});
