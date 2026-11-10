import { describe, expect, test } from "bun:test";
import { creerPage } from "./harnais";

// $.ajax d'origine simulé : chaque requête attend qu'on la termine à la main
const page = creerPage(
  ["js/class/Requetes.js"],
  `var envoyees = [], enAttente = [], options = [];
   $.ajax = (o) => { let d = $.Deferred(); envoyees.push(o.url + (o.data ? " " + JSON.stringify(o.data) : "")); options.push(Object.keys(o)); enAttente.push(d); return d.promise(); };
   function terminer() { enAttente.shift().resolve("ok", "success", {}); }`,
);
const attendre = (ms = 0) => new Promise((r) => setTimeout(r, ms));

describe("file des requêtes : actions du joueur d'abord", () => {
  test("une à la fois ; l'action passe devant les lectures en attente", async () => {
    page.lire(`envoyees.length = 0; enAttente.length = 0;
      $.get("/Membre.php?Pseudo=A"); $.post("/alliance.php?forum_menu", "xajax=1"); $.post("/alliance.php?forum_menu", "xajax=2");
      $.get("/Armee.php", { deplacement: 3, t: "x" });`);
    expect(page.lire(`envoyees.slice()`)).toEqual(["/Membre.php?Pseudo=A"]);
    page.lire(`terminer()`);
    await attendre();
    expect(page.lire(`envoyees.slice(-1)[0]`)).toBe('/Armee.php {"deplacement":3,"t":"x"}');
    // juste après une action, les lectures attendent la suite éventuelle
    page.lire(`terminer(); $.post("/Armee.php", { Transferer: "Envoyer" });`);
    await attendre();
    expect(page.lire(`envoyees.slice(-1)[0]`)).toBe('/Armee.php {"Transferer":"Envoyer"}');
    page.lire(`terminer()`);
    await attendre(300);
    expect(page.lire(`envoyees.length`)).toBe(3);
  });
  test("les lectures reprennent après la pause qui suit une action", async () => {
    await attendre(2600);
    expect(page.lire(`envoyees.length`)).toBe(4);
    page.lire(`terminer()`);
    await attendre();
    expect(page.lire(`envoyees.length`)).toBe(5);
    page.lire(`terminer()`);
  });
  test("lecture d'un enchaînement (action: true) : devant les lectures en attente", async () => {
    // fin de la requête du test précédent (jQuery résout ses promesses après un délai)
    await attendre();
    page.lire(`envoyees.length = 0; options.length = 0;
      $.get("/Reine.php"); $.get("/Membre.php?Pseudo=C"); $.ajax({ url: "/Armee.php", action: true });`);
    expect(page.lire(`envoyees.slice()`)).toEqual(["/Reine.php"]);
    page.lire(`terminer()`);
    await attendre();
    expect(page.lire(`envoyees.slice()`)).toEqual(["/Reine.php", "/Armee.php"]);
    // l'option reste dans la file, le jeu ne la reçoit pas
    expect(page.lire(`options[1].includes("action")`)).toBe(false);
    // comme après une action, les lectures attendent la pause
    page.lire(`terminer()`);
    await attendre(300);
    expect(page.lire(`envoyees.length`)).toBe(2);
    await attendre(2400);
    expect(page.lire(`envoyees.slice(-1)[0]`)).toBe("/Membre.php?Pseudo=C");
    page.lire(`terminer()`);
  });
  test("attaques, chasses, annulations reconnues comme actions", () => {
    const action = (url: string, methode = "GET") =>
      page.lire<boolean>(
        `REQUETES_ACTION.some((r) => r.url.test(${JSON.stringify(url)}) && (!r.methode || r.methode == ${JSON.stringify(methode)}))`,
      );
    expect(action("https://s5.fourmizzz.fr/ennemie.php?Attaquer=12", "POST")).toBe(true);
    expect(action("https://s5.fourmizzz.fr/AcquerirTerrain.php", "POST")).toBe(true);
    expect(action("https://s5.fourmizzz.fr/ennemie.php?annuler=5")).toBe(true);
    expect(action("https://s5.fourmizzz.fr/Ressources.php?annuler=5")).toBe(true);
    expect(action("https://s5.fourmizzz.fr/Membre.php?Pseudo=A")).toBe(false);
    expect(action("https://s5.fourmizzz.fr/Reine.php")).toBe(false);
    expect(action("https://s5.fourmizzz.fr/ennemie.php", "POST")).toBe(false);
  });
});
