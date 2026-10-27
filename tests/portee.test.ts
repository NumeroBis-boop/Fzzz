import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

// TdC du joueur courant : 20 000 cm²
const page = creerPage(
  ["js/class/Utils.js", "js/class/Parametre.js", "js/class/Joueur.js"],
  `var monProfil = { pseudo: "Moi" }, METHODE_FLOOD = [], AFFECTATION_RESSOURCE = [], RATIO_RECOLTE = {};
   document.body.innerHTML = "<span id='quantite_tdc'>20000</span>";`,
);

const epees = (pseudo: string, terrain: number) =>
  page.lire<string>(
    `$("<div>" + Joueur.epeesPortee(new Joueur({ pseudo: ${JSON.stringify(pseudo)}, terrain: ${terrain} })) + "</div>").find(".o_epee").map((i, e) => e.classList.contains("o_epeeRouge") ? "rouge" : "bleue").get().join(" ")`,
  );

describe("épées de portée de flood (page Alliance)", () => {
  test("à portée dans les deux sens : rouge et bleue", () => {
    expect(epees("Alice", 25000)).toBe("rouge bleue");
  });
  test("trop gros pour nous flooder, mais floodable : bleue seule", () => {
    expect(epees("Bob", 50000)).toBe("bleue");
  });
  test("trop petit pour être floodé, mais peut nous flooder : rouge seule", () => {
    expect(epees("Carl", 8000)).toBe("rouge");
  });
  test("hors de portée, ou soi-même : rien", () => {
    expect(epees("Dan", 100000)).toBe("");
    expect(epees("Moi", 20000)).toBe("");
  });
});
