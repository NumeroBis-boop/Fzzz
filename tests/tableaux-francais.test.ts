import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Tableaux DataTables de l'extension (Utils.js) : textes de la bibliothèque et
 * de ses boutons d'export en français ; ceux qu'un tableau précise restent.
 */
const page = creerPage(["js/lib/datatables_1.10.16.js", "js/class/Utils.js"]);
const LIGNES = "<tr><td>Alpha</td><td>10</td></tr><tr><td>Bravo</td><td>20</td></tr>";

function tableau(options: string, lignes = LIGNES) {
  page.lire(`(() => {
    document.body.innerHTML = "<table id='t'><thead><tr><th>Pseudo</th><th>Terrain</th></tr></thead><tbody>${lignes}</tbody></table>";
    $("#t").DataTable(${options});
  })()`);
}
const textes = (selecteur: string) =>
  page.lire<string[]>(`$(${JSON.stringify(selecteur)}).map((i, e) => $(e).text()).get()`);
const copie = (lignes: number) =>
  page.lire<string>(`$("#t").DataTable().i18n("buttons.copySuccess", {}, ${lignes})`);

describe("tableaux en français", () => {
  test("boutons d'export : Colonnes, Copier, CSV, Excel", () => {
    tableau(`{ dom: "Bfrti", buttons: ["colvis", "copyHtml5", "csvHtml5", "excelHtml5"] }`);
    expect(textes(".dt-button")).toEqual(["Colonnes", "Copier", "CSV", "Excel"]);
  });

  test("messages de la copie, accordés au nombre de lignes", () => {
    tableau(`{ dom: "Bfrti", buttons: ["copyHtml5"] }`);
    expect(page.lire<string>(`$("#t").DataTable().i18n("buttons.copyTitle", "")`)).toBe(
      "Copie du tableau",
    );
    expect([copie(0), copie(1), copie(3)]).toEqual([
      "Aucune ligne copiée",
      "1 ligne copiée",
      "3 lignes copiées",
    ]);
    expect(page.lire<string>(`$("#t").DataTable().i18n("buttons.copyKeys", "")`)).toContain(
      "pour copier le tableau",
    );
  });

  test("tableau vide, recherche, pagination et tri lus à voix haute", () => {
    tableau(`{ dom: "frtip" }`, "");
    expect(textes("#t td.dataTables_empty")).toEqual(["Aucune donnée"]);
    expect(textes(".dataTables_filter label")).toEqual(["Rechercher : "]);
    expect(textes(".paginate_button.previous, .paginate_button.next")).toEqual(["Préc.", "Suiv."]);
    // nombres des textes « Lignes _START_ à _END_ sur _TOTAL_ »
    expect(page.lire<string>(`$("#t").DataTable().settings()[0].fnFormatNumber(1804000)`)).toBe(
      "1 804 000",
    );
    // 1re colonne déjà triée (croissant) : le prochain tri est décroissant
    expect(page.lire<string[]>(`$("#t th").map((i, e) => $(e).attr("aria-label")).get()`)).toEqual([
      "Pseudo : trier par ordre décroissant",
      "Terrain : trier par ordre croissant",
    ]);
  });

  test("export CSV pour Excel en français : « ; » entre les colonnes, marque UTF-8 en tête", async () => {
    tableau(`{ dom: "Bfrti", buttons: ["csvHtml5"] }`, "<tr><td>Élodie</td><td>1 234,5</td></tr>");
    page.lire(`(() => {
      window.fichierCsv = null;
      URL.createObjectURL = (blob) => { window.fichierCsv = blob; return "blob:csv"; };
      URL.revokeObjectURL = () => {};
      $(".buttons-csv").trigger("click");
    })()`);
    const octets = await page.lire<Promise<number[]>>(
      `fichierCsv.arrayBuffer().then((b) => Array.from(new Uint8Array(b)))`,
    );
    expect(octets.slice(0, 3)).toEqual([0xef, 0xbb, 0xbf]);
    const texte = new TextDecoder().decode(new Uint8Array(octets));
    expect(texte.split(/\r?\n/)).toEqual(['"Pseudo";"Terrain"', '"Élodie";"1 234,5"']);
  });

  test("un tableau garde les textes qu'il précise", () => {
    tableau(
      `{ dom: "Bfrti", buttons: ["colvis", "copyHtml5"], language: { buttons: { colvis: "Colonne" }, zeroRecords: "Aucun joueur trouvé" } }`,
    );
    expect(textes(".dt-button")).toEqual(["Colonne", "Copier"]);
    page.lire(`$("#t").DataTable().search("zzz").draw()`);
    expect(textes("#t td.dataTables_empty")).toEqual(["Aucun joueur trouvé"]);
  });
});
