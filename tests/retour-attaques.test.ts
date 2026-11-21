import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

/**
 * Page Armée, liste des attaques du jeu : date et heure de retour de chaque
 * attaque (demande du mainteneur, 21/11/2026, toujours affichées). Les
 * survivantes sont de nouveau en garnison à l'arrivée de l'attaque (modèle de
 * TroupesDehors) : le retour est l'arrivée, datée. Compte+ : sous « Arrivée à
 * … » du détail (ligne relevée sur la page enregistrée du mainteneur) ; sans
 * Compte+ : sous la ligne, qui n'a qu'un compte à rebours. Joueurs inventés.
 */
const page = creerPage(
  ["js/class/Utils.js", "js/page/PartageChasses.js", "js/class/AttaqueLancee.js"],
  `var heure = moment("2026-11-21 23:00:00", "YYYY-MM-DD HH:mm:ss").valueOf();
   var Horloge = { maintenant: () => heure, serveur: () => moment(heure), serveurA: () => moment(heure) };
   var monProfil = { pseudo: "Moi" };`,
);

const ligne = (id: number, secondes: number, comptePlus: boolean) =>
  `- Vous allez attaquer <span class="gras"><a href="Membre.php?Pseudo=Cible${id}">Cible${id}</a>(<a href="classementAlliance.php?alliance=XYZ">XYZ</a>)</span> (Terrain de chasse) dans <span class="gras" id="attaque_${id}">x</span><script language="JavaScript">reste(${secondes}, "attaque_${id}");</script> - <a href="/Armee.php?annuler=${id}">Annuler</a><br />` +
  (comptePlus
    ? `<small><em> Troupes en attaques : 1 Jeune Soldate Naine.<br /> Arrivée à ${moment_(secondes)}</em></small><br/>`
    : "");
// heure d'arrivée écrite par le jeu en Compte+
function moment_(secondes: number) {
  const t = new Date(Date.UTC(2026, 10, 21, 23, 0, 0) + secondes * 1000);
  return `${String(t.getUTCHours()).padStart(2, "0")}h${String(t.getUTCMinutes()).padStart(2, "0")}`;
}

const afficher = (html: string) =>
  page.lire<{ texte: string; retours: string[] }>(`(() => {
    document.body.innerHTML = "<div id='liste'>" + ${JSON.stringify(html)} + "</div>";
    AttaqueLancee.afficherRetours($("#liste"));
    return {
      texte: $("#liste").text().replace(/\\s+/g, " "),
      retours: $(".o_retourAttaque").map((i, e) => $(e).text()).get(),
    };
  })()`);

describe("retour des attaques sur la liste du jeu", () => {
  test("Compte+ : sous « Arrivée à … », avec la date", () => {
    const r = afficher(
      `<h3>Attaque(s) en cours</h3>${ligne(7, 1800, true)}${ligne(8, 7200, true)}`,
    );
    expect(r.retours).toEqual(["Retour le 21 nov. à 23h30", "Retour le 22 nov. à 01h00"]);
    // .text() ne met rien pour un saut de ligne
    expect(r.texte).toContain("Arrivée à 23h30Retour le 21 nov. à 23h30- Vous allez attaquer");
  });

  test("sans Compte+ : sous la ligne du compte à rebours", () => {
    const r = afficher(
      `<h3>Attaque(s) en cours</h3>${ligne(7, 3600, false)}${ligne(8, 90000, false)}`,
    );
    expect(r.retours).toEqual(["Retour le 22 nov. à 00h00", "Retour le 23 nov. à 00h00"]);
    // chaque retour suit sa propre ligne
    expect(r.texte).toMatch(
      /Cible7.*AnnulerRetour le 22 nov\. à 00h00- Vous allez attaquer.*Cible8/,
    );
  });

  test("renforts : rien", () => {
    const r = afficher(
      `<h3>Attaque(s) en cours</h3>- Des renforts arrivent dans <span class="gras" id="attaque_9">x</span><script>reste(600, "attaque_9");</script><br />`,
    );
    expect(r.retours).toEqual([]);
  });

  test("lue après coup, la ligne garde sa cible, son lieu et ses troupes", () => {
    afficher(`<h3>Attaque(s) en cours</h3>${ligne(7, 1800, true)}`);
    const l = page.lire<any>(
      `(({ cible, lieuNatif, troupesNatif, minuteJeu }) => ({ cible, lieuNatif, troupesNatif, jeu: minuteJeu && moment(minuteJeu).format("HH:mm") }))(AttaqueLancee.extraireLignes($("#liste"))[0])`,
    );
    expect(l).toEqual({
      cible: "Cible7",
      lieuNatif: "Terrain de chasse",
      troupesNatif: "1 Jeune Soldate Naine.",
      jeu: "23:30",
    });
  });
});
