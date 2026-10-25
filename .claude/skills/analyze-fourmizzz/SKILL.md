---
name: analyze-fourmizzz
description: Analyze a Fourmizzz.fr scenario by capturing and documenting its network traffic. Use when the user wants to understand how a specific in-game action talks to the PHP backend, asks to record/capture/document traffic for a feature (combat, convoi, messagerie, profil, alliance, etc.), or provides a HAR file from fourmizzz.fr. Two modes — guides the capture procedure when no HAR exists yet, produces a structured endpoint report when a HAR is provided.
---

# analyze-fourmizzz

Documents the client/server protocol of [Fourmizzz.fr](http://www.fourmizzz.fr) one scenario at a time so that the Toolzzz extension can hook into endpoints with confidence.

## Two modes

Detect which mode applies from the user's message:

- **Mode A — Capture guidance**: user describes a scenario but has not produced a HAR yet, or asks how to record traffic. Output the capture procedure (below) and stop. Do **not** invent endpoints.
- **Mode B — Report generation**: user provides a path to a `.har` file (typically under `docs/scenarios/<name>/capture.har`). Parse it and produce the report (format below) at `docs/scenarios/<name>/report.md`.

If both apply (HAR provided + scenario unclear), parse the HAR but ask one clarifying question about the scenario intent before writing the report.

## Mode A — Capture procedure

Walk the user through these steps. Adapt wording to the scenario they named.

1. **Pick a scenario name** in `kebab-case` (e.g. `envoyer-convoi`, `lancer-attaque`, `lire-message`). Create `docs/scenarios/<name>/` if absent.
2. **Open Fourmizzz** in Chrome or Firefox, log in normally, navigate to the page where the scenario _starts_.
3. **Open DevTools** (F12) → **Network** tab. Activate:
   - ✅ `Preserve log` (so navigations don't clear the log)
   - ✅ `Disable cache` (forces real responses)
   - Filter: `Doc` + `Fetch/XHR` (ignore images/CSS/JS unless suspect)
4. **Clear the log** (🚫 icon) immediately before performing the action.
5. **Perform the scenario** end-to-end — exactly what a user would do (click, fill, submit). Stop when the visible result is in.
6. **Export**: right-click in the Network panel → `Save all as HAR with content` → save as `docs/scenarios/<name>/capture.har`.
7. **Sidecar description**: create `docs/scenarios/<name>/scenario.md` with:
   - what the user did (1-3 sentences)
   - what the user saw afterwards (visible result)
   - any precondition (auth, fourmilière state, target player, etc.)
8. **Tell me** the scenario name. I switch to Mode B.

⚠️ HAR files contain session cookies — the repo's `.gitignore` excludes `*.har` so they stay local. Never paste HAR contents into a public issue/PR.

## Mode B — Report format

For each scenario, write `docs/scenarios/<name>/report.md` with this structure:

```markdown
# Scénario : <nom lisible>

## Contexte

- **Action joueur** : <résumé fonctionnel>
- **Page de départ** : <URL>
- **Résultat visible** : <ce que le joueur voit>
- **Préconditions** : <auth, état de jeu, cibles, ...>

## Vue d'ensemble des requêtes

| #   | Méthode | URL (path + query) | Type | Statut | Déclencheur |
| --- | ------- | ------------------ | ---- | ------ | ----------- |
| 1   | GET     | /Membre.php?...    | doc  | 200    | navigation  |
| 2   | POST    | /xhr/...           | xhr  | 200    | clic bouton |

(Filtrer le bruit : ne garder que les requêtes vers `*.fourmizzz.fr` qui portent l'action. Ignorer assets statiques, ads, analytics tiers.)

## Détail par endpoint

### [n] METHOD /chemin

- **Rôle présumé** : <ce que ça fait côté métier>
- **Headers notables** : `Content-Type`, `X-Requested-With`, `Referer` (uniquement si signifiant)
- **Payload** :
  - form-data : `champ1=...`, `champ2=...`
  - ou JSON : `{ ... }`
  - ou query string déjà incluse dans l'URL
- **Réponse** :
  - Type : `text/html` | `application/json` | `redirect 302 → ...`
  - Forme : page complète | fragment HTML | JSON `{...}`
  - Champs/sélecteurs intéressants : `.boite_membre h2`, `#convoi_id`, etc.
- **Données extractibles** : <liste ce qu'on peut récupérer côté extension>
- **Code existant** : `public/js/page/<File>.js:<lines>` si déjà hooké, sinon `aucun`
- **Hypothèses / inconnues** : <signaler explicitement quand on devine>

## Enchaînement

<Diagramme texte ou liste : (1) déclenche (2), redirige vers (3), etc. Indispensable quand il y a >2 requêtes.>

## Pistes d'amélioration Toolzzz

- <Idée concrète de feature ou de hook que ce scénario rend possible>
- <Endpoint sous-exploité, donnée non affichée actuellement, etc.>

## Notes

<Surprises, comportements obscurs, indices que le serveur renvoie du HTML précomputed avec des valeurs hardcodées, etc.>
```

## Règles de rédaction du rapport

- **Honnêteté > complétude** : marquer `?` ou « hypothèse » dès qu'on devine. Ne jamais affirmer un rôle d'endpoint qu'on n'a pas confirmé par la réponse.
- **Filtrer le bruit** : exclure analytics, ads, assets statiques. Ne garder que les requêtes qui portent réellement l'action vers `*.fourmizzz.fr`.
- **Recouper avec le code existant** : avant d'écrire la section _Code existant_, faire un `Grep` du chemin de l'endpoint dans `public/js/page/`, `public/js/boite/`, `public/js/class/`. Citer file:line.
- **Anonymiser** : ne pas mentionner le pseudo/ID du joueur réel dans le rapport — remplacer par `<pseudo>`, `<id>`. Le HAR brut, lui, garde tout (mais reste local).
- **Pas de contenu HTML brut** dans le rapport. Décrire la structure, pas la coller.
- **Lire avant de proposer un remplacement** : pour toute _Piste d'amélioration_ du type « utiliser X au lieu de Y » (réutiliser une valeur serveur au lieu d'un calcul client, simplifier une branche, retirer un fallback...), **toujours** :
  1. `Grep` le nom de la fonction/variable que tu proposes de remplacer.
  2. `Read` son implémentation pour identifier les inputs cachés : bonus personnalisés au viewer, branches conditionnelles (Compte+, vacances, alliance...), fallbacks, valeurs hardcodées.
  3. Si la logique existante a un branchement sur le contexte (auth, tier premium, provenance), la suggestion doit explicitement préserver ou adresser chaque branche.
  4. Si tu n'arrives pas à trancher, formule la suggestion comme une **expérience à mener** (« capturer la même cible depuis deux comptes avec X et Y différents et comparer ») plutôt qu'une recommandation. Liste les variables à isoler.

  Précédent : sur `consulter-profil`, j'ai initialement suggéré de remplacer `monProfil.getTempsParcours2()` par la valeur serveur sans lire la fonction — qui applique en réalité le bonus de recherche du viewer (`Joueur.js:417`). La suggestion aurait cassé la personnalisation et la branche `!Utils.comptePlus` déjà en place dans `Profil.js:43`.

## Convention de stockage

```
docs/scenarios/
├── <name>/
│   ├── capture.har      ← gitignored (cookies)
│   ├── scenario.md      ← description du scénario, committed
│   └── report.md        ← rapport produit, committed
```

Le rapport committed devient une doc vivante du protocole Fourmizzz, indépendante du HAR.
