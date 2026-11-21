import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Encarts de la colonne de gauche : « S5 pseudo », Compte+ (celui du jeu ou
 * la « Synthèse » recréée hors C+) et « Extension OUAF ». Les lignes
 * « Plein dans … » ajoutées sous la nourriture et les matériaux agrandissent
 * « S5 pseudo » : l'encadré du dessous doit le suivre au lieu de le recouvrir
 * (capture d'un joueur sans Compte+ sur téléphone, 21/11/2026 : la ligne du
 * TdC cachée sous « Synthèse »). happy-dom n'a pas de mise en page : chaque
 * encadré donne son emprise dans `data-geo`, translation comprise.
 */
const page = creerPage(
  ["js/class/Utils.js", "js/boite/Dock.js"],
  `var Journal = { info() {}, erreur() {} };`,
);

page.lire(`(() => {
  Dock.emprise = (e) => {
    let g = JSON.parse(e.dataset.geo || '{"left":0,"top":0,"right":0,"bottom":0}'),
      t = Number((/translateY\\((-?[\\d.]+)px\\)/.exec(e.style.transform) || [])[1] || 0);
    return { left: g.left, right: g.right, top: g.top + t, bottom: g.bottom + t, width: g.right - g.left, height: g.bottom - g.top };
  };
  Dock.signalerAutreExtension = () => {};
  Dock.signalerMiseAJour = () => {};
})()`);

const geo = (left: number, top: number, right: number, bottom: number) =>
  JSON.stringify(JSON.stringify({ left, top, right, bottom }));

/** Encart « S5 pseudo » et encart Compte+ du jeu, dans la même colonne. */
const encarts = (s5: string, cplus: string) =>
  page.lire(`(() => {
    document.body.innerHTML = "<div id='menuBoite'><div id='boiteInfo'><div class='contenu_boite_info'><table><tr><td class='nourriture'></td></tr></table></div></div><div id='boiteComptePlus' class='boite_compte_plus'></div></div>";
    document.querySelector("#boiteInfo").dataset.geo = ${s5};
    document.querySelector("#boiteComptePlus").dataset.geo = ${cplus};
  })()`);

const translation = () =>
  page.lire<string>(`document.querySelector("#boiteComptePlus").style.transform`);

/** Après les observateurs (microtâche) et le recalage (image suivante). */
const apresRecalage = () =>
  page.lire<Promise<string>>(
    `new Promise((r) => setTimeout(() => requestAnimationFrame(() => r(document.querySelector("#boiteComptePlus").style.transform)), 0))`,
  );

describe("encadré Compte+ du jeu sous « S5 pseudo » (Dock.rapprocher)", () => {
  test("place en trop : remonté à ECART_ENCADRES", () => {
    encarts(geo(15, 20, 295, 167), geo(15, 200, 235, 610));
    page.lire(
      `Dock.rapprocher(document.querySelector("#boiteInfo"), document.querySelector("#boiteComptePlus"))`,
    );
    expect(translation()).toBe("translateY(-27px)");
  });

  test("« S5 pseudo » qui grandit après coup (lignes « Plein dans ») : l'encadré redescend", async () => {
    encarts(geo(15, 20, 295, 167), geo(15, 200, 235, 610));
    page.lire(
      `Dock.rapprocher(document.querySelector("#boiteInfo"), document.querySelector("#boiteComptePlus"))`,
    );
    expect(translation()).toBe("translateY(-27px)");
    page.lire(`(() => {
      document.querySelector("#boiteInfo").dataset.geo = ${geo(15, 20, 295, 229)};
      let ligne = document.createElement("div");
      ligne.className = "o_entrepotPlein";
      ligne.textContent = "Plein dans 2 h 18";
      document.querySelector("#boiteInfo td.nourriture").appendChild(ligne);
    })()`);
    // 200 + 35 = 229 + 6
    expect(await apresRecalage()).toBe("translateY(35px)");
  });

  test("« S5 pseudo » qui recouvre déjà l'encadré au chargement : descendu", () => {
    encarts(geo(15, 20, 295, 229), geo(15, 200, 235, 610));
    page.lire(
      `Dock.rapprocher(document.querySelector("#boiteInfo"), document.querySelector("#boiteComptePlus"))`,
    );
    expect(translation()).toBe("translateY(35px)");
  });

  test("écart déjà juste : rien", () => {
    encarts(geo(15, 20, 295, 194), geo(15, 200, 235, 610));
    page.lire(
      `Dock.rapprocher(document.querySelector("#boiteInfo"), document.querySelector("#boiteComptePlus"))`,
    );
    expect(translation()).toBe("");
  });

  test("encadrés éloignés ou dans deux colonnes : jamais déplacés", () => {
    encarts(geo(15, 20, 295, 167), geo(15, 600, 235, 900));
    page.lire(
      `Dock.rapprocher(document.querySelector("#boiteInfo"), document.querySelector("#boiteComptePlus"))`,
    );
    expect(translation()).toBe("");
    encarts(geo(15, 20, 295, 229), geo(300, 200, 520, 610));
    page.lire(
      `Dock.rapprocher(document.querySelector("#boiteInfo"), document.querySelector("#boiteComptePlus"))`,
    );
    expect(translation()).toBe("");
  });
});

describe("encadré « Synthèse » recréé hors Compte+", () => {
  test("il suit « S5 pseudo » (Dock.suivre) : Dock.afficher ne le translate pas en plus", () => {
    const appels = page.lire<number>(`(() => {
      localStorage.clear();
      document.body.innerHTML = "<div id='menuBoite'><div id='boiteInfo'></div><div id='boiteComptePlus' class='boite_compte_plus'></div></div>";
      document.querySelector("#boiteInfo").dataset.geo = ${geo(15, 20, 295, 167)};
      document.querySelector("#boiteComptePlus").dataset.geo = ${geo(15, 200, 235, 610)};
      Dock.suivre(document.querySelector("#boiteInfo"), document.querySelector("#boiteComptePlus"), () => ECART_ENCADRES);
      let rapprocher = Dock.rapprocher, n = 0;
      Dock.rapprocher = () => n++;
      try {
        Dock.prototype.afficher.call({ _html: "<div id='o_boiteExtension' class='boite_compte_plus'></div>", _desactivee: false });
      } finally {
        Dock.rapprocher = rapprocher;
      }
      return n;
    })()`);
    expect(appels).toBe(0);
  });

  test("encadré Compte+ du jeu : rapproché comme avant", () => {
    const appels = page.lire<number>(`(() => {
      localStorage.clear();
      document.body.innerHTML = "<div id='menuBoite'><div id='boiteInfo'></div><div id='boiteComptePlus' class='boite_compte_plus'></div></div>";
      let rapprocher = Dock.rapprocher, n = 0;
      Dock.rapprocher = () => n++;
      try {
        Dock.prototype.afficher.call({ _html: "<div id='o_boiteExtension' class='boite_compte_plus'></div>", _desactivee: false });
      } finally {
        Dock.rapprocher = rapprocher;
      }
      return n;
    })()`);
    expect(appels).toBe(1);
  });

  test("Dock.suivre suit aussi les lignes ajoutées dans « S5 pseudo »", async () => {
    const haut = await page.lire<Promise<string>>(`(() => {
      document.body.innerHTML = "<div id='menuBoite'><div id='boiteInfo'><div class='contenu_boite_info'><table><tr><td class='nourriture'></td></tr></table></div></div></div><div id='o_suivie'></div>";
      let s5 = document.querySelector("#boiteInfo"), boite = document.querySelector("#o_suivie");
      s5.dataset.geo = ${geo(15, 20, 295, 167)};
      Dock.suivre(s5, boite, () => ECART_ENCADRES);
      return new Promise((r) => setTimeout(() => requestAnimationFrame(() => {
        s5.dataset.geo = ${geo(15, 20, 295, 229)};
        let ligne = document.createElement("div");
        ligne.className = "o_entrepotPlein";
        document.querySelector("#boiteInfo td.nourriture").appendChild(ligne);
        setTimeout(() => requestAnimationFrame(() => r(boite.style.top)), 0);
      }), 0));
    })()`);
    expect(haut).toBe(`${229 + 6}px`);
  });
});
