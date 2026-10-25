---
name: ui-primitives
description: Toolzzz UI conventions — CSS utility classes, table/form/button patterns, jQuery UI widgets, toast helpers, available globals (monProfil, Utils, Joueur.rechercher, BoiteRadar, Armee). Use when adding HTML/CSS to a Boite (`public/js/boite/*.js`) or a Page (`public/js/page/*.js`), when designing new UI components, or when refactoring existing markup. Read before introducing new classes/components — most things you'd want to add already exist in `public/css/outiiil.css` or as a global.
---

# Toolzzz UI primitives

Inventaire des classes CSS et patterns réutilisables pour rester cohérent visuellement avec le reste de l'extension. **À consulter avant d'écrire du HTML/CSS dans une Boite ou une Page**.

## Classes utilitaires (dans `public/css/outiiil.css`)

### Couleurs (color)

`.black` `.green` `.green_light` `.red` `.red_light` `.red_xlight` `.blue` `.blue_light` `.orange` `.violet` `.marron` `.marron_dark`

→ S'utilisent sur `<span>`, `<td>`, `<input>`. Préfèrent `!important`, donc surchargent les styles natifs Fourmizzz.

### Texte

- `.centre` `.left` `.right` — alignement
- `.gras` — bold
- `.small` — 0.8em (vraiment petit)
- `.reduce` — 0.9em (légèrement réduit, idéal pour notes/footnotes)
- `.souligne:hover` — soulignement au survol

### Typographie

Préférer les caractères UTF-8 aux substituts ASCII dans le texte affiché : `→` (U+2192) plutôt que `->`, idem `←` `≤` `≥` `…` `—`. Le rendu est nettement plus propre que la version ASCII qui fait « code source ». Les constantes `IMG_FLECHE` / `IMG_GAUCHE` / `IMG_DROITE` (cf. `content.js`) restent pertinentes quand on veut une vraie image (sprite Fourmizzz), mais pour du texte inline les caractères UTF-8 suffisent.

### Layout

- `.o_maxWidth` — `width: 100%` (utile sur tables et inputs pour étirer)
- `.o_marginT0` / `.o_marginT15` — espace vertical au-dessus
- `.cursor` — `cursor: pointer` (à mettre sur tout élément cliquable non-bouton)
- `.cursor_copy` — `cursor: copy`
- `.clear` — clearfix

### Game-specific (du natif Fourmizzz, à éviter sauf si vraiment nécessaire)

- `.ligne_paire` — fond alterné natif
- `.boite_amelioration` `.simulateur` `.centre` — wrappers de boîtes natives (cf. section « Conteneur de widget injecté » plus bas)

## Conteneur de widget injecté dans une page

Pour un widget Toolzzz qui s'ajoute en bas (ou au milieu) d'une page Fourmizzz native — typiquement injecté via `$("#alliance").after(...)` ou `$("#cadre").append(...)` — utiliser le **même pattern que `Lanceur de Chasses`** (cf. `public/js/page/Ressource.js:92`) pour s'intégrer visuellement comme une vraie « boîte » du jeu :

```html
<br />
<div id="o_<feature>" class="boite_amelioration simulateur centre">
  <h2>Titre du widget</h2>
  <p class="reduce">Description courte (optionnelle).</p>
  ...contenu (formulaire, tableau, chart, ...) ...
</div>
```

Détails :

- **`<div>` et pas `<fieldset>`** — fieldset donne le rendu HTML par défaut du browser (border grise + legend), qui sort du style Fourmizzz.
- **`boite_amelioration`** = classe native Fourmizzz, donne le fond bois et la bordure ocre.
- **`simulateur centre`** = overrides Toolzzz par-dessus (centrage, padding interne).
- **`<h2>` pour le titre** — pas `<legend>` (réservé aux fieldsets), pas `<span class='titre'>` (réservé aux tables `boite_amelioration` natives type `<table>`).
- **`<br/>` avant le `<div>`** — espace visuellement de la boîte précédente, comme le fait Fourmizzz nativement entre ses sections.

⚠️ Distinction importante :

- Pour un **widget injecté dans une page** (= `public/js/page/*.js`), utiliser ce pattern.
- Pour une **Boite flottante** (= `public/js/boite/*.js`, fenêtre draggable affichée via `BoiteX.afficher()`), c'est la classe `Boite` qui gère le wrapper — passer juste le contenu via le constructeur `super(id, titre, html)`.

## Sections dans un onglet de Boite

Quand un onglet (`#o_tabs<X>1`, `2`, …) regroupe **plusieurs paramètres ou champs** qui touchent à des aspects différents, séparer en sections avec un titre en gras au-dessus de chaque groupe :

```html
<form>
  <p class="left reduce gras">Description courte de la section 1</p>
  ${formGroup1}
  <p class="left reduce gras">Description courte de la section 2</p>
  ${formGroup2} ...
</form>
```

- **`<p class='left reduce gras'>`** — c'est la convention pour un titre/intro de section dans un form de Boite (cf. `parametreGeneral` et `parametreStyle` dans `public/js/boite/Parametres.js`).
- **Le texte décrit ce que les champs en dessous contrôlent** — il joue le rôle de label de groupe, donc soit informatif (« La méthode sera sélectionnée par défaut dans le lanceur de flood ») plutôt que générique (« Méthodes »).
- **Pour les notes/aides discrètes en dessous d'un titre**, ajouter une ligne `<p class='left small'><em>…</em></p>` (cf. la note « Le nombre est choisi aléatoirement entre 90% du max et le max. » sous les antisondes).
- **Garder titres et notes courts : une phrase, ~120 caractères max.** La `.o_content` est en `position: fixed` sans `max-width`, donc elle s'ajuste à son contenu : un paragraphe long n'est pas coupé, il **élargit la boîte jusqu'à la largeur de l'écran**. Le CSS borne `.o_content p.left` à `60ch` pour forcer le wrap, mais c'est un filet de sécurité, pas une autorisation d'écrire un pavé. Si une explication est vraiment longue, la découper en plusieurs `<p>` courts ou la passer dans un spoiler « En savoir plus ? » (cf. section dédiée plus bas). Précédent : la note du mode Ratio (v3.9.0) faisait 250 caractères en Compte+ et rendait la boîte Paramètres aussi large que la fenêtre.

Cas particulier des paramètres `checkbox` : leur label est rendu **à côté de la case** par `Parametre.getForm()` dans une `.group { width: 250px }`. Un libellé long y wrapperait sur 2 lignes en poussant la case sous le texte (effet pas joli). Convention : garder le label de la checkbox **court** (≈ 30 caractères max, cf. `dockVisible` = « Outils toujours visible ? ») et mettre la description complète dans le `<p class='left reduce gras'>` au-dessus.

## Tableaux — pattern recommandé

Suivre le style de `BoiteCombat.calculatrice()` (onglet « Temps de trajet ») :

```html
<table id="o_<feature>" class="o_maxWidth centre" cellspacing="0">
  <thead>
    <tr>
      <th>Col1</th>
      <th>Col2</th>
      …
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>val1</td>
      <td>val2</td>
      …
    </tr>
    …
    <tr class="reduce">
      <td colspan="N"><em>Note de bas de tableau</em></td>
    </tr>
  </tbody>
</table>
```

### Padding des cellules

Les `<table>` dans `.o_content` ont `border-collapse: collapse` et **aucun padding par défaut** sur les `td`/`th` — sans règle explicite, les cellules se collent les unes aux autres (effet `valeurLibellé` indésirable). Ajouter une règle `#o_<id> td, #o_<id> th { padding: 2px 6px }` dans `outiiil.css` à proximité des règles équivalentes (cf. `#o_simulationChasse td`, `#o_historiqueAlliance tr td`). **Ne pas** utiliser de `style="padding:…"` inline ni de `.css()` jQuery — les règles per-table-id sont la convention partout.

Pour un layout 4-col « libellé/valeur | libellé/valeur » côte à côte, ajouter en plus `#o_<id> td:nth-child(3) { padding-left: 28px }` pour séparer visuellement les deux blocs (sinon la valeur du bloc gauche colle au libellé du bloc droit).

### Titre de section vs `<thead>`

Si l'onglet contient **plusieurs sections distinctes** (récap + formulaire, par ex.), mettre le titre **au-dessus** du tableau via `<div class='centre gras o_marginT15'>Titre</div>` plutôt qu'un `<thead><th colspan='N'>Titre</th></thead>`. Le `<thead>` est réservé à la ligne d'en-tête des colonnes.

### Séparateurs entre sections

Pour distinguer visuellement deux sections successives dans un même onglet (sans abuser de `o_marginT15`) :

```html
<hr class="o_<feature>Separ" />
```

```css
hr.o_<feature > Separ {
  border: 0;
  border-top: 1px dashed currentColor;
  opacity: 0.35;
  margin: 18px 0 0;
}
```

→ `currentColor` reprend automatiquement la `couleurTexte` de l'utilisateur — pas besoin de `monProfil.parametre[...]` côté JS.

### Onglets à contenu long

Quand un onglet (`#o_tabs<X>1`, `2`, …) risque de dépasser la hauteur du viewport (la `.o_content` est `position:fixed` + `draggable`, sans `max-height` global), poser le scroll **sur le div d'onglet entier** :

```js
$("#o_tabs<X>1").css({ "max-height": "70vh", "overflow-y": "auto" });
```

→ Préférer ce scroll unique aux scrollables imbriqués (textarea + tableau résultat + section calc, etc.) qui rendent la navigation pénible. Si le tableau résultat avait déjà un wrapper `style='max-height:200px;overflow:auto'`, l'enlever en même temps.

### Alternance de lignes (couleur2)

Dans la méthode `css()` de la Boite, ajouter le sélecteur :

```js
$("#o_<feature> tr:even, …").css("background-color", monProfil.parametre["couleur2"].valeur);
```

→ Convention : `tr:even` (jQuery 0-indexé) sur la table entière colore le `<thead>` (index 0) et les lignes paires d'index, donc `<thead>` foncé puis ligne 1 claire / ligne 2 foncée / ligne 3 claire... Ne pas inverser — c'est le pattern de toute l'extension.
→ La `couleur2` est paramétrable par l'utilisateur via la BoiteParametres.

### Tableaux complexes (recherche/tri/export)

Utiliser **DataTables** comme `BoiteCombat.afficherTemps()` :

```js
$("#o_<feature>").DataTable({ bInfo: false, dom: "Bfrtip", buttons: ["copyHtml5", "csvHtml5", "excelHtml5"], pageLength: 15, … });
```

Toujours fournir des `language` traduits FR (cf. exemple existant). DataTables est déjà bundlé.

## Boutons

- `<button>` plain — pour les actions secondaires inline (cf. calculatrice)
- `<button class="o_button">` — bouton stylé Toolzzz
- `<button class="o_button f_success">` — bouton vert (action principale ; ex. Lancer/Envoyer)
- `<button … disabled>` — automatiquement grisé (cf. CSS `button[disabled]`)

## Bouton groupé (`.o_group_bouton`)

Pattern natif Fourmizzz pour des actions liées rendues côte à côte dans un même cadre avec séparateur (ex. `Surveiller | Voir sur AntLeaks` sur la page d'une alliance, ou `B I U` dans le chat) :

```html
<div id="o_<feature>" class="o_group_bouton">
  <span id="o_action1" class="option_gestion"> <img src="${IMG_X}" alt="" /> Label 1 </span>
  <span id="o_action2" class="option_gestion cursor"> <img src="${IMG_Y}" alt="" /> Label 2 </span>
</div>
```

- **`.o_group_bouton`** = wrapper natif `inline-block` avec border ocre.
- **`.option_gestion`** = native button-cell ; `:hover` change le background.
- **`.o_group_bouton > span:not(:last-child)`** dessine automatiquement un `border-right` entre les boutons (notre CSS, `outiiil.css`).

⚠️ Pièges connus, à neutraliser dès qu'on a **plus d'un span** dans le wrapper :

1. **`.o_group_bouton` ne pose AUCUN padding sur ses spans** — `.option_gestion` seule n'a que du `:hover`. Pour un look propre il faut ajouter `padding: 4px 10px` soi-même (cf. `.o_group_bouton_chat span` dans `outiiil.css`).
2. **Hauteurs inégales en inline** — deux spans côte à côte avec `<img>` + texte se retrouvent à des baselines légèrement différentes selon le rendu inline ; le séparateur paraît tronqué et le hover ne couvre pas toute la hauteur. **Fix bulletproof :** passer le wrapper en `display: inline-table` et les spans en `display: table-cell` (cellules de table = hauteurs garanties identiques).
3. **`<img>` inline** — toujours ajouter `vertical-align: middle` sur les images dans les spans, sinon la baseline tire le rendu vers le bas.

```css
#o_<feature > {
  display: inline-table;
}
#o_<feature > .option_gestion {
  display: table-cell;
  vertical-align: middle;
  padding: 4px 10px;
}
#o_<feature > img {
  vertical-align: middle;
}
```

**Préférer un `<span class='option_gestion cursor'>` + click jQuery à un `<a class='option_gestion'>` direct** pour les actions qui ouvrent une URL externe. L'`<a>` direct se comporte différemment du `<span>` au niveau layout (display inline vs option_gestion attendant un span), ce qui casse l'alignement et le hover. Le span avec `window.open(url, "_blank")` rend identique au reste du groupe.

Exemple en place : `PageDescription` (`public/js/page/Description.js`) pour le bouton Alliance « Surveiller + Voir sur AntLeaks ».

## Spoiler « En savoir plus ? » (natif Fourmizzz)

Pour un bloc d'explication optionnel (masqué par défaut, révélé au clic), réutiliser le pattern natif du jeu plutôt qu'un toggle jQuery custom :

```html
<p class="left reduce gras">
  Texte principal de la consigne<span
    class="cliquable2"
    style="font-size:0.8em; font-weight:normal;"
    onclick="spoilerId('o_<feature>Info');"
  >
    En savoir plus ?</span
  >
</p>
<div id="o_<feature>Info" style="display:none;">… contenu de l'explication …</div>
```

- **`cliquable2`** = classe native (curseur + couleur lien) ; `font-size:0.8em` rend le lien discret à côté du libellé principal.
- **`spoilerId('id')`** = fonction globale Fourmizzz qui toggle le `display` du `<div>` cible. Vit dans le **page world**, donc accessible uniquement via `onclick` inline injecté dans le DOM — un binding jQuery côté content script n'y aurait pas accès.
- **`font-weight:normal` inline sur le span** — nécessaire quand le parent porte `gras`, sinon l'héritage CSS rend le lien gras lui aussi (bien que `cliquable2` ne le force pas).
- **`display:none` initial** sur le div cible — `spoilerId` se contente de basculer la visibilité.

Cf. `BoiteParametres.parametreUtilitaire()` (`public/js/boite/Parametres.js`) pour un exemple en place.

## Inputs et widgets jQuery UI

Disponibles partout via `jquery-ui_1.12.1.js` (tout le bundle est chargé).

### Inputs numériques — TOUJOURS via `.spinner()`

⚠️ **Ne jamais utiliser `<input type="number">`**. Convention partout dans Toolzzz : input texte simple + appel `.spinner({ min, max, numberFormat: "i" })`. Donne les flèches haut/bas customisées qui matchent visuellement le reste de l'extension (cf. Lanceur de Chasses, Lanceur de Flood, Multi-flood, Calculatrice combat).

```html
<input type="text" id="o_truc" value="0" size="12" />
```

```js
$("#o_truc").spinner({ min: 0, numberFormat: "i" });
// ou max: 50 pour des niveaux, etc.
```

À appeler **après** que le HTML soit dans le DOM. Pour des inputs re-rendus dynamiquement (genre `_mfBindForm` du multi-flood), réappliquer `.spinner()` après chaque render — sinon les nouveaux inputs sont des champs texte plats.

### Autres widgets

- `$("#x").autocomplete({ source, select, … })` — autocomplete (cf. `Joueur.rechercher` + `Utils.extraitRecherche`)
- `$("#x").datetimepicker(DATEPICKER_OPTION)` — date/heure. Sur l'`<input>` associé, **utiliser systématiquement `placeholder="JJ-MM-AAAA HH:mm"`** (le format affiché par `DATEPICKER_OPTION` + `dateFormat: "dd-mm-yy"`, `timeFormat: "HH:mm"`). Pas de `placeholder='—'` ni autre tiret — le tiret n'indique pas à l'utilisateur quel format saisir.
- `$("#x").slider({ min, max, change })` — slider 0/1
- `$("#x").slider({ range: true, min, max, values: [a, b], slide })` — **range slider** (sélection d'une plage). Cf. la plage de niveaux du widget Coûts (`PageConstruction.couts`). Pour avoir des paliers nets, `step: Math.max(1, Math.floor((max - min) / N))` avec N ≈ 20–50 ; jQuery UI exige que `(max - min) % step == 0` pour snapper proprement.
- `$("#x").tooltip({ position, content })` — tooltips

### Préférer un input éditable à une checkbox + valeur figée

Quand l'utilisateur a un « niveau actuel » et qu'on voudrait permettre une simulation hypothétique (« et si j'avais Archi 30 ? »), l'idiome est :

- ❌ Checkbox « Tenir compte de mes améliorations » + label `Architecture 16` figé
- ✅ Spinner pré-rempli avec sa vraie valeur, modifiable

Le spinner conserve la valeur par défaut utile (= ce que l'utilisateur veut **par défaut**) et débloque la simulation gratuitement. Cf. inputs Architecture / Salle d'analyse de `PageConstruction.couts`.

## Toasts (feedback utilisateur)

Constantes globales dans `content.js` :

- `TOAST_INFO` `TOAST_SUCCESS` `TOAST_WARNING` `TOAST_ERROR`

Utilisation :

```js
$.toast({ ...TOAST_WARNING, text: "message" });
```

## Sources de données pré-existantes

Avant de fetch quoi que ce soit, vérifier qu'on n'a pas déjà la donnée :

- `monProfil` — Joueur courant (pseudo, x/y, niveauRecherche, niveauConstruction, parametre)
- `Utils.serveur` — sous-domaine du serveur (uppercase)
- `Utils.terrain` — terrain courant en cm² (depuis le DOM)
- `Utils.ouvrieres` `Utils.nourriture` `Utils.materiaux` — stocks
- `Utils.comptePlus` — booléen
- `Utils.alliance` — tag alliance
- `Joueur.rechercher(term)` — POST `classementAlliance.php` (autocomplete pseudo+alliance, page-agnostique)
- `Alliance.rechercher(term)` — idem mais priorité alliance
- `Utils.extraitRecherche(html, joueur=true, alliance=true)` — parse résultat de la recherche
- `BoiteRadar` — instance créée à demande, lit `localStorage` (`outiiil_radar`)
- `Armee.getArmee()` — Promise qui fetch l'armée du joueur (via la page Armée appropriée)

## Constantes globales utiles

Dans `public/js/content.js` :

- `NOM_UNITE` — noms des 14 unités, indexé 1-14
- `ATT_UNITE` `DEF_UNITE` `VIE_UNITE` — stats par unité
- `RATIO_CHASSE` `PERTE_*_CHASSE` `REPLIQUE_CHASSE` — constantes calibrage chasse
- `IMG_FLECHE` `IMG_VIE` `IMG_ATT` `IMG_DEF` `IMG_COPY` `IMG_GAUCHE` `IMG_DROITE` — icônes inline (chaînes HTML)
- `LIEU.TERRAIN` `LIEU.DOME` `LIEU.LOGE` — enums lieux d'attaque
- `DATEPICKER_OPTION` — options par défaut pour datetimepicker

## Vue qui prend la page en otage (« page takeover »)

Pour une feature qui remplace temporairement le contenu natif d'une page (ex. carte alliance sur `alliance.php?Membres#carte`, courbes coûts sur `construction.php#cout`), le pattern est :

1. **Trigger dans le menu colonne natif** — injecter un `<li>` avec une classe `boutonX` existante dans `#menuFourmiliere` ou `#menuAlliance`, l'`href` pointe vers la page cible avec un hash distinct.
2. **Toggle hash-based** — `location.hash === "#xxx"` détermine si on cache le natif et montre le widget. Un listener `hashchange` permet de basculer sans rechargement.
3. **Anti-flash via bootstrap au document_start** — voir `public/js/bootstrap.js`, déclaré comme content_script séparé avec `run_at: "document_start"`. Le script (a) injecte un `<style>` inline avec les règles de masquage, et (b) pose une classe `toolzzz-mode-X` sur `<html>` selon `location.hash`. Comme tout est appliqué avant le parse du body, le natif n'a jamais l'occasion de flasher.

```js
// public/js/bootstrap.js — content_scripts entry séparée, run_at: document_start
(function () {
  // ⚠️ Ne PAS compter sur content_scripts.css du manifest pour ce CSS-là :
  // il suit le run_at de son entrée. Chrome est rapide donc ça passe parfois,
  // mais Firefox laisse passer un flash visible. L'injection inline depuis
  // ce script document_start est la seule approche fiable cross-browser.
  let style = document.createElement("style");
  style.textContent = `
    .toolzzz-mode-X table:has(.ligneAmelioration),
    .toolzzz-mode-X #centre > strong {
      display: none !important;
    }
  `;
  (document.head || document.documentElement).appendChild(style);

  let appliquer = () =>
    document.documentElement.classList.toggle("toolzzz-mode-X", location.hash === "#X");
  appliquer();
  window.addEventListener("hashchange", appliquer);
})();
```

→ Côté JS principal, ne **plus** faire `.hide()/.show()` sur les éléments natifs : laisser le CSS gérer. Sinon les inline styles deviennent prioritaires sur la classe `toolzzz-mode-X` quand on bascule.

→ `:has()` est dispo en Chrome 105+ et Firefox 121+, on est largement au-dessus du `strict_min_version: 142.0`.

→ **Variantes pathname-based** : même pattern pour une page sans hash, on toggle la classe sur `location.pathname` au lieu de `location.hash` (cf. `toolzzz-mode-evolution` dans `bootstrap.js`, active sur `construction.php` et `laboratoire.php`). Utile quand on remplace en JS (via `document_idle`) un bloc natif et qu'on veut éviter le flash de la version initiale — on hide en CSS dès le parse, notre JS remplace, le hide disparaît parce que les éléments ne matchent plus le sélecteur (déplacés ou retirés).

## Règle d'or

**Avant d'ajouter une nouvelle classe CSS ou un nouveau composant JS** : `Grep` dans `public/js/` et `public/css/outiiil.css` pour voir si quelque chose d'équivalent existe déjà. La leçon retenue dans le skill `analyze-fourmizzz` (« Lire avant de proposer un remplacement ») s'applique aussi aux primitives UI.
