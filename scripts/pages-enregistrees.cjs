/**
 * Pages du jeu enregistrées, servies aux scripts de vérification (mobile.cjs,
 * diff-origine.cjs) : « armee.html » pour Armee.php, et pour une adresse avec
 * paramètre le nom du premier paramètre après « _ » : « alliance_membres.html »
 * pour alliance.php?Membres, « alliance_forum_menu.html » pour le forum,
 * « membre_pseudo.html » pour Membre.php?Pseudo=…, « ennemie_attaquer.html »
 * pour la page d'attaque ; « alliance.html » est le chat. Tout en minuscules.
 * Les scripts et feuilles du dossier « _files » d'une page enregistrée sont
 * servis depuis <dossier>/js et <dossier>/css (par leur nom), design7.css
 * depuis le dossier lui-même ; sans eux, le menu du jeu ne s'ouvre pas.
 */
const fs = require("fs"),
  path = require("path");

function noms(adresse) {
  const url = new URL(adresse, "http://s5.fourmizzz.fr/"),
    page = url.pathname
      .replace(/^\//, "")
      .replace(/\.php$/i, "")
      .toLowerCase(),
    cle = [...url.searchParams.keys()].find((k) => k != "jt");
  return {
    page,
    propre: cle ? `${page}_${cle.toLowerCase()}` : null,
    racine: /^[^/]+$/.test(page),
  };
}

/** Fichier servi pour une requête : celui de son paramètre, sinon celui de la page. */
function fichierRequete(dossier, adresse) {
  const { page, propre, racine } = noms(adresse);
  if (!racine) return null;
  for (const nom of propre ? [propre, page] : [page]) {
    const f = path.join(dossier, nom + ".html");
    if (fs.existsSync(f)) return f;
  }
  return null;
}

const TYPES = { js: "application/javascript", css: "text/css" };

/** Répond à une requête vers le jeu depuis le dossier (404 pour le reste, sans requête au jeu). */
function servir(route, dossier) {
  const url = new URL(route.request().url()),
    nom = decodeURIComponent(url.pathname.split("/").pop()),
    ext = (nom.match(/\.(js|css)$/i) || [])[1],
    f = ext
      ? [path.join(dossier, ext.toLowerCase(), nom), path.join(dossier, nom)].find((c) =>
          fs.existsSync(c),
        )
      : fichierRequete(dossier, url.href);
  return route.fulfill({
    status: f ? 200 : 404,
    headers: {
      "content-type": ext ? TYPES[ext.toLowerCase()] : "text/html; charset=utf-8",
    },
    body: f ? fs.readFileSync(f) : "",
  });
}

/** Pages de la liste dont le dossier a le fichier exact (une page d'attaque n'est pas la liste des ennemis). */
function pagesPresentes(dossier, liste) {
  const presentes = [],
    absentes = [];
  for (const p of liste) {
    const { page, propre } = noms(p);
    (fs.existsSync(path.join(dossier, (propre || page) + ".html")) ? presentes : absentes).push(p);
  }
  if (absentes.length)
    console.warn(`pages absentes du dossier, non vérifiées : ${absentes.join(", ")}`);
  return presentes;
}

const PAGES_JEU = [
  "messagerie.php",
  "Armee.php",
  "Ressources.php",
  "laboratoire.php",
  "construction.php",
  "commerce.php",
  "Reine.php",
  "ennemie.php",
  "ennemie.php?Attaquer=1",
  "Membre.php?Pseudo=X",
  "alliance.php",
  "alliance.php?Membres",
  "alliance.php?forum_menu",
];

module.exports = { fichierRequete, pagesPresentes, servir, PAGES_JEU };
