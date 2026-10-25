---
name: release-notes
description: Format et méthodologie pour rédiger les release notes Toolzzz à publier sur GitHub Releases. Audience = joueurs Fourmizzz francophones (pas développeurs). Use quand l'utilisateur demande de rédiger / drafter / préparer un changelog ou release notes pour une nouvelle version (ex. "prépare les notes pour v3.2.0", "draft le changelog", "qu'est-ce qu'on met dans la release"), quand un bump de version vient d'être commité, ou avant `gh release create` / `gh release edit`.
---

# Release notes Toolzzz

Format reproductible pour les notes de release sur GitHub. Audience = **joueurs Fourmizzz francophones**, pas devs : vocabulaire jeu (ponte, chasse, flood, TDC, alliance), pas de jargon technique inutile.

## Workflow

1. **Identifier la version précédente** : la dernière qui a une GitHub Release, pas juste un tag (l'auto-gen GitHub utilise la même logique). Vérifier avec `gh release list -R GuiEpi/toolzzz --limit 5`.
2. **Lister tous les commits** : `git log --oneline v{prev}..v{new}` — **pas juste les PRs**, l'auto-gen GitHub rate les commits directs sur master.
3. **Scanner les `revert(...)`** : ⚠️ piège classique. Une feature ajoutée puis revert dans la même fenêtre ne doit pas apparaître dans le changelog. Idem pour les features remplacées par autre chose puis re-supprimées (chercher `replace .* with` dans les messages).
4. **Catégoriser** par préfixe Conventional Commits :
   - `feat:` → **Nouveautés** (sauf si purement interne)
   - `fix:` → **Corrections**
   - `perf:` → **Corrections** ou **Sous le capot** selon l'impact perçu
   - `build:` / `chore:` / `docs:` / `style:` / `refactor:` / `test:` / `ops:` → **Sous le capot** uniquement si user-visible (publication store, politique de confidentialité, permissions retirées, support nouvelle plateforme), sinon **omettre**.
5. **Retrouver les issues et contributions externes** : `git log v{prev}..v{new} --format='%h %s%n%b' | grep -iE '(fixes|closes|resolves) #[0-9]+'` pour les issues fermées par un commit, plus `gh issue list -R GuiEpi/toolzzz --state closed --search "closed:>=AAAA-MM-JJ"` (date de la release précédente) et `gh pr list -R GuiEpi/toolzzz --state merged --search "merged:>=AAAA-MM-JJ"` pour celles fermées à la main et les PR de contributeurs. Noter le login de l'auteur (`gh issue view N -R GuiEpi/toolzzz --json author -q .author.login`) : il est remercié dans le bullet (cf. Conventions). Ignorer les PR Renovate.
6. **Vérifier que les features citées existent encore dans le code** avant de pousser — `grep` les noms de tabs/boîtes mentionnés dans `public/js/boite/*.js`.
7. **Rédiger** chaque bullet : nom en gras, deux-points, une phrase courte en français orientée joueur.
8. **Coller** dans `gh release edit v{x.y.z} -R GuiEpi/toolzzz --notes-file ...` (ou directement via l'UI GitHub).

## Template

```markdown
### ✨ Nouveautés

- **Nom de la feature** : description courte orientée joueur, en une phrase.
- ...

### 🐛 Corrections

- **Zone affectée** : ce qui a été corrigé, en une phrase.
- ...

### ⚙️ Sous le capot

- **Sujet** : impact pour l'utilisateur (sécurité, perf, support, publication).
- ...

---

**Full Changelog**: https://github.com/GuiEpi/toolzzz/compare/vX.X.X...vX.X.X
```

## Conventions de rédaction

- **Niveau de titre** : `###` (pas `##`) — la page GitHub Release a déjà un H1 avec le numéro de version.
- **Emojis dans les titres** : ✨ Nouveautés / 🐛 Corrections / ⚙️ Sous le capot. Ne pas en mettre ailleurs (ni dans les bullets, ni dans le footer hors des deux fixes 📦 et 🐛).
- **Vocabulaire jeu** : "boîte" (pas "panel"), "onglet" (pas "tab"), "TDC" (pas "terrain de chasse" en toutes lettres si ambiance technique), "flood", "ponte", "chasse", "redéploiement", "sonde", "convoi". Garder les noms propres du jeu.
- **Bullets courts** : une phrase par feature. Si une feature a plusieurs sous-changements (ex. multi-flood + cap à 3 cibles + auto-fill), regrouper en un seul bullet — l'utilisateur ne lit pas une histoire git, il lit ce qui a changé pour lui.
- **Pas de mention de PR / commit / SHA** dans les bullets — ces infos sont dans l'auto-gen GitHub si on la garde, sinon dans `git log`. **Seule exception : les remerciements** (ci-dessous).
- **Remercier qui a signalé ou contribué** : quand un bullet répond à une issue ou à une PR d'un joueur ou contributeur externe, finir la phrase par `Merci à @login [#N].` (référence courte, GitHub la transforme en lien vers l'issue ou la PR du dépôt). Un bullet par issue, même si la correction est petite : le joueur qui a signalé doit retrouver sa demande. Plusieurs personnes : `Merci à @a et @b [#N].` Pour une issue d'un autre dépôt (ex. upstream Outiiil), lien complet : `[[#13](https://github.com/Hraesvelg/Outiiil/issues/13)]`. Ne pas se remercier soi-même (issues ouvertes par le mainteneur).

  Exemple : `- **Flèches de déplacement de l'armée** : les flèches de la page Armée s'affichent de nouveau sur les serveurs en HTTPS et sur Brave. Merci à @Tsnou [#29].`

- **Sections vides** : si une catégorie n'a aucun bullet, supprimer toute la section (titre compris). Une release peut très bien n'avoir que des corrections.

## Quoi inclure dans "Sous le capot"

Garder uniquement ce qui a un effet concret pour l'utilisateur final :

- Publication sur un nouveau store / changement de canal de distribution.
- Politique de confidentialité, déclaration de collecte de données.
- Permissions ajoutées / retirées (impact installation et review stores).
- Changement de version minimum supportée d'un navigateur.
- Migration de manifeste (MV2 → MV3) — uniquement la première fois.

Ne PAS inclure : refactor de code, formatage, mise à jour de dépendances dev, modifications de CI, changements de docs internes, fix de typos, etc. C'est dans l'historique git pour les curieux, pas dans les notes pour les joueurs.

## Auto-gen GitHub : à garder ou pas ?

Par défaut, **virer la liste auto-générée** (les titres de PR en anglais qui ne servent à rien aux joueurs). Si quelqu'un veut le détail technique, il a `git log` et l'historique des PRs. Garder uniquement le bloc FR rédigé manuellement.

Pour générer une release sans la liste auto-gen :

```bash
gh release create v{x.y.z} -R GuiEpi/toolzzz \
  --title "v{x.y.z}" \
  --notes-file release-notes.md \
  .output/toolzzz-{x.y.z}-chrome.zip \
  .output/toolzzz-{x.y.z}-firefox.zip \
  .output/toolzzz-{x.y.z}-sources.zip
```

Pour éditer une release déjà créée (ex. workflow CI a fait le `--generate-notes` automatique) :

```bash
gh release edit v{x.y.z} -R GuiEpi/toolzzz --notes-file release-notes.md
```
