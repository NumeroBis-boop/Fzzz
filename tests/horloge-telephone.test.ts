import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Horloge dans l'affichage mobile du jeu (sans « site pour ordinateur ») : le
 * jeu y cache ses encadrés hors de l'écran tant que la première icône de son
 * menu n'est pas touchée. Au-dessus de l'encart « S5 Pseudo », l'horloge se
 * retrouvait en haut de l'écran, sur les icônes du menu (dont celle qui ouvre
 * les encadrés) : elle va sous la barre du menu et le haut de la page lui
 * laisse sa place. happy-dom n'a pas de mise en page : les emprises sont posées.
 */
const page = creerPage(
  ["js/class/Utils.js", "js/class/Horloge.js"],
  `var TOAST_INFO = { icon: "info" };
   var heure = moment("2026-11-24 10:00", "YYYY-MM-DD HH:mm").valueOf();`,
);
const lire = <T = any>(e: string) => page.lire<T>(e);

type Rect = { left: number; top: number; right: number; bottom: number };
/** Ouvre une page : encart « S5 Pseudo » (null : absent), barre du menu, position déplacée. */
async function ouvrir(encart: Rect | null, menu: Rect | null, retenue: object | null = null) {
  lire(`(() => {
    Date.now = () => heure;
    setTimeout = () => 0;
    localStorage.clear();
    const GARDE = ${JSON.stringify(retenue ? { fzzz_positionHorloge: retenue } : {})};
    window.chrome = {
      storage: {
        local: {
          get: (cles) => Promise.resolve(Object.fromEntries([].concat(cles).filter((c) => c in GARDE).map((c) => [c, GARDE[c]]))),
          set: () => Promise.resolve(),
          remove: () => Promise.resolve(),
        },
        onChanged: { addListener: () => {} },
      },
    };
    const encart = ${JSON.stringify(encart)}, menu = ${JSON.stringify(menu)};
    window.Dock = { emprise: () => ({ ...encart, width: encart.right - encart.left, height: encart.bottom - encart.top }) };
    document.documentElement.removeAttribute("style");
    document.body.innerHTML = (menu ? "<nav id='menu'></nav>" : "") + (encart ? "<div id='boiteInfo'></div>" : "");
    if (menu) document.getElementById("menu").getBoundingClientRect = () => ({ ...menu, width: menu.right - menu.left, height: menu.bottom - menu.top });
    // l'horloge déborde sur la barre du menu du PC (252 px) comme dans le jeu
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, get() { return this.id == "o_horloge" ? 280 : 0; } });
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, get() { return this.id == "o_horloge" ? 24 : 0; } });
    Object.defineProperty(document.documentElement, "clientWidth", { configurable: true, get: () => 1300 });
    Object.defineProperty(document.documentElement, "clientHeight", { configurable: true, get: () => 900 });
    // une vraie page n'a qu'une horloge : celles des tests précédents se taisent
    $("#o_horloge").remove();
    $(window).off("load resize");
    Horloge.afficher();
  })()`);
  await new Promise((r) => setTimeout(r, 0));
  return lire<{ top: string; left: string; sousMenu: boolean; hauteur: string }>(`({
    top: $("#o_horloge")[0].style.top,
    left: $("#o_horloge")[0].style.left,
    sousMenu: $("#o_horloge").hasClass("o_horlogeSousMenu"),
    hauteur: document.documentElement.style.getPropertyValue("--o-horloge-hauteur"),
  })`);
}

const MENU_TELEPHONE = { left: 0, top: 0, right: 412, bottom: 48 },
  MENU_PC = { left: 252, top: 0, right: 1300, bottom: 30 };

describe("horloge et menu du jeu sur téléphone", () => {
  test("encart hors de l'écran (menu des encadrés fermé) : sous la barre du menu, place réservée", async () => {
    const h = await ouvrir({ left: 15, top: -980, right: 235, bottom: -820 }, MENU_TELEPHONE);
    expect(h).toMatchObject({ top: "52px", left: "15px", sousMenu: true });
    expect(h.hauteur).toBe("24px");
  });

  test("PC : au-dessus de l'encart, comme avant", async () => {
    expect(await ouvrir({ left: 15, top: 50, right: 235, bottom: 200 }, MENU_PC)).toMatchObject({
      left: "15px",
      top: "20px",
      sousMenu: false,
    });
    // page sans encart : en haut à gauche, sous la barre qu'elle couvrirait
    expect(await ouvrir(null, MENU_PC)).toMatchObject({ left: "8px", top: "34px" });
    // grand écran, barre à 302 px : l'horloge ne la touche pas et reste en haut
    expect(await ouvrir(null, { ...MENU_PC, left: 302 })).toMatchObject({
      top: "8px",
      sousMenu: false,
    });
  });

  test("position choisie par le joueur : gardée, rien de réservé", async () => {
    expect(
      await ouvrir({ left: 15, top: -980, right: 235, bottom: -820 }, MENU_TELEPHONE, {
        x: 100,
        y: 300,
      }),
    ).toMatchObject({ left: "100px", top: "300px", sousMenu: false });
  });

  test("CSS : effacée tant qu'un menu du jeu est ouvert, haut de page réservé, seulement dans l'affichage mobile", () => {
    const css = require("node:fs").readFileSync(
      require("node:path").join(__dirname, "..", "public", "css", "outiiil.css"),
      "utf8",
    );
    const bloc = css.slice(
      css.indexOf(
        "@media screen and (max-width: 61em) {\n  html:not(.o_origineGenerale):has(.menuActif)",
      ),
    );
    expect(bloc).toContain("#o_horloge {\n    visibility: hidden !important;");
    expect(bloc).toContain("#o_horloge.o_horlogeSousMenu:not(.o_horlogeMasquee)) #centre");
  });
});

describe("ce qui se place sous le menu passe sous l'horloge", () => {
  const sous = creerPage(["js/class/Utils.js", "js/class/AttaqueLancee.js"], "");
  /** Barre du menu de 48 px (affichage mobile : elle défile avec la page) et horloge en dessous. */
  const preparer = (classes: string) =>
    sous.lire(`(() => {
      document.body.innerHTML = "<div id='centre'><nav id='menu' style='position: absolute'></nav><div id='bloc'></div></div><div id='o_horloge' class='${classes}'></div>";
      document.getElementById("menu").getBoundingClientRect = () => ({ left: 0, right: 412, top: 0, bottom: 48, width: 412, height: 48 });
      document.getElementById("o_horloge").getBoundingClientRect = () => ({ left: 15, right: 295, top: 52, bottom: 76, width: 280, height: 24 });
      // sans marge, le bloc commence sous la barre
      document.getElementById("bloc").getBoundingClientRect = () => ({ left: 0, right: 412, top: 48, bottom: 100, width: 412, height: 52 });
    })()`);

  test("Utils.calerSousMenu : sous l'horloge quand elle est sous le menu, sinon sous le menu", () => {
    preparer("o_horlogeSousMenu");
    expect(sous.lire(`Utils.basHorlogeSousMenu()`)).toBe(76);
    sous.lire(`Utils.calerSousMenu(document.getElementById("bloc"), 6)`);
    expect(sous.lire(`document.getElementById("bloc").style.marginTop`)).toBe("34px");
    for (const classes of ["o_horlogeSousMenu o_horlogeMasquee", ""]) {
      preparer(classes);
      expect(sous.lire(`Utils.basHorlogeSousMenu()`)).toBe(0);
      sous.lire(`Utils.calerSousMenu(document.getElementById("bloc"), 6)`);
      expect(sous.lire(`document.getElementById("bloc").style.marginTop`)).toBe("6px");
    }
  });

  test("« Mes attaques en cours » épinglé : collé sous l'horloge en défilant, et recalé quand elle se place", () => {
    preparer("");
    sous.lire(`AttaqueLancee.epingler(document.getElementById("bloc"))`);
    expect(sous.lire(`document.getElementById("bloc").style.top`)).toBe("0px");
    sous.lire(
      `$("#o_horloge").addClass("o_horlogeSousMenu"); $(document).trigger(EVENEMENT_HORLOGE_PLACEE)`,
    );
    expect(sous.lire(`document.getElementById("bloc").style.top`)).toBe("76px");
  });
});

test("l'horloge annonce son passage sous le menu, une fois", async () => {
  const annonces = () =>
    lire(
      `(() => { window.PLACEES = 0; $(document).off(EVENEMENT_HORLOGE_PLACEE).on(EVENEMENT_HORLOGE_PLACEE, () => PLACEES++); })()`,
    );
  annonces();
  await ouvrir({ left: 15, top: -980, right: 235, bottom: -820 }, MENU_TELEPHONE);
  expect(lire(`PLACEES`)).toBe(1);
  lire(`$(window).trigger("resize")`);
  expect(lire(`PLACEES`)).toBe(1);
});
