# Installer Fzzz

**Avant tout** : si Toolzzz est installé, désactive-le (`chrome://extensions` ou `about:addons`). Fzzz contient tout Toolzzz : avec les deux actifs, chaque page reçoit deux fois les mêmes outils.

Les archives à installer s'obtiennent de deux façons :

- **Dernière version de `main`** : onglet **Actions** du dépôt, dernière exécution « CI » réussie, section **Artifacts**, fichier `fzzz-extension` (connexion GitHub requise).
- **Versions publiées** : page **Releases** (https://github.com/NumeroBis-boop/fzzz/releases).

| Fichier                      | Pour                                               |
| ---------------------------- | -------------------------------------------------- |
| `fzzz-<version>-chrome.zip`  | Chrome, Edge, Brave, Opera                         |
| `fzzz-<version>-firefox.zip` | Firefox (PC et Android, après signature)           |
| `fzzz-<version>-sources.zip` | Les sources, à fournir à Mozilla pour la signature |

## Chrome, Edge, Brave (PC)

1. Télécharge `fzzz-<version>-chrome.zip` et **décompresse-le** dans un dossier que tu garderas, par exemple `Documents\Fzzz`. Le navigateur charge l'extension depuis ce dossier : ne le supprime pas.
2. Ouvre `chrome://extensions` (Edge : `edge://extensions`).
3. Active le **Mode développeur** (interrupteur en haut à droite ; sur Edge, dans la colonne de gauche).
4. Clique **Charger l'extension non empaquetée** et choisis le dossier décompressé, celui qui contient `manifest.json`.
5. Ouvre ou recharge une page de `s5.fourmizzz.fr` : la boîte « Fzzz 1.0 » apparaît dans la colonne de gauche.

**Mise à jour** : décompresse la nouvelle version **dans le même dossier** en remplaçant les fichiers, puis clique l'icône ↻ de Fzzz dans `chrome://extensions`.

## Firefox PC

### Essai rapide (extension temporaire)

1. Télécharge `fzzz-<version>-firefox.zip`, sans le décompresser.
2. Ouvre `about:debugging#/runtime/this-firefox`.
3. Clique **Charger un module complémentaire temporaire…** et choisis le fichier `.zip`.

L'extension disparaît à la fermeture de Firefox.

### Installation durable (signature Mozilla, gratuite)

1. Crée un compte sur https://addons.mozilla.org.
2. Va sur https://addons.mozilla.org/developers/addon/submit/distribution et choisis **« Sur votre propre site »** (non listée) ou **« Sur ce site »** (listée : visible dans le catalogue, mises à jour automatiques, revue par Mozilla).
3. Envoie `fzzz-<version>-firefox.zip`. À la question sur le code source, réponds **Oui** et envoie `fzzz-<version>-sources.zip`.
4. Version non listée : télécharge le `.xpi` signé et ouvre-le avec Firefox.

La version minimale de Firefox est la 142 (PC et Android), comme Toolzzz.

## Firefox Android

1. Récupère le `.xpi` signé de la dernière version : page **Releases** du dépôt, fichier `fzzz-<version>.xpi`. Télécharge-le sur le téléphone.
2. Dans Firefox : **Paramètres → À propos de Firefox**, touche le logo 5 fois pour activer le menu de débogage.
3. **Paramètres → Installer une extension depuis un fichier** (_Install Extension from File_), puis choisis le `.xpi`.

## Mises à jour automatiques

Une fois installé depuis un `.xpi` publié par le workflow (version 1.21 ou plus), Firefox se met à jour tout seul : il consulte régulièrement `updates.json` (adresse `update_url` du manifeste, environ une fois par jour) et installe la nouvelle version sans action du joueur. Pour forcer la vérification : `about:addons` → roue dentée → **Rechercher des mises à jour**. Sur Android, ce mécanisme est **à vérifier** (la documentation Mozilla ne le précise pas pour les extensions installées depuis un fichier).

**Bouton « Mettre à jour Fzzz »** (Paramètres → À propos) :

- Chrome installé depuis le Chrome Web Store : vérification immédiate, installation de la nouvelle version et rechargement de la page, en un clic.
- Firefox : ouvre le dernier `.xpi` signé (`releases/latest/download/fzzz.xpi`) ; Firefox ordinateur propose de l'installer (« Autoriser » puis « Ajouter »). Firefox Android n'installe pas depuis un lien : la mise à jour quotidienne automatique s'en charge.
- Extension chargée depuis un dossier (mode développeur) : aucune mise à jour automatique possible, le bouton l'indique et renvoie vers la page des versions.

Chrome n'accepte de mise à jour automatique que depuis le Chrome Web Store : une fiche **non répertoriée** (visible seulement avec le lien) suffit. Une extension chargée depuis un dossier décompressé ne se met jamais à jour seule.

### Mise en place (une fois, par le mainteneur)

1. Clés d'API Mozilla : https://addons.mozilla.org/developers/addon/api/key/ → **Générer de nouveaux identifiants**.
2. Dans le dépôt GitHub : **Settings → Secrets and variables → Actions → New repository secret** :
   - `FIREFOX_JWT_ISSUER` : l'« émetteur JWT » (`user:…`) ;
   - `FIREFOX_JWT_SECRET` : le « secret JWT ».
3. Chrome (facultatif, 5 $ une fois) : compte développeur du Chrome Web Store, première mise en ligne à la main avec la visibilité **Non répertorié**, puis les secrets `CHROME_EXTENSION_ID`, `CHROME_PUBLISHER_ID`, `CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL`, `CHROME_SERVICE_ACCOUNT_PRIVATE_KEY` (voir `CLAUDE.md`). Sans eux, le workflow Chrome publie seulement le zip dans la release.

### Publier une mise à jour

1. Monter la version dans `package.json` et pousser sur `main`.
2. GitHub → **Actions** → **Release (Firefox)** → **Run workflow** (et **Release (Chrome)** si le Store est configuré). Pousser un tag `vX.Y.Z` fait la même chose.
3. Le workflow fait signer la version par Mozilla (non listée : pas de fiche publique), crée la release `vX.Y.Z` avec le `.xpi` signé et `updates.json` : les Firefox installés la récupèrent à leur prochaine vérification.

## Publication automatique sur les boutiques

Les workflows `release-chrome.yml` et `release-firefox.yml` se lancent sur un tag `v*.*.*` ou à la main (« Run workflow », version de `package.json`). Firefox : signature non listée sur addons.mozilla.org et mises à jour par `updates.json` (ci-dessus). Chrome : Chrome Web Store si ses clés sont configurées. Ils demandent des secrets GitHub (liste dans `CLAUDE.md`, section « Release pipeline ») : sans eux, ils échouent sans rien publier.

En cas de souci : clic droit sur la page → Inspecter → onglet Console, puis copie les lignes en rouge.
