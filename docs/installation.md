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

1. Fais signer l'extension (ci-dessus) pour obtenir le `.xpi`, et copie-le sur le téléphone.
2. Dans Firefox Android : **Paramètres → À propos de Firefox**, touche le logo 5 fois pour activer le menu de débogage.
3. **Paramètres → Installer un module depuis un fichier**, puis choisis le `.xpi`.

Cette procédure par fichier est **à vérifier** sur ta version de Firefox Android. Une publication listée sur addons.mozilla.org l'évite.

## Publication automatique sur les boutiques

Les workflows `release-chrome.yml` et `release-firefox.yml` (hérités de Toolzzz) publient sur le Chrome Web Store et sur addons.mozilla.org quand un tag `v*.*.*` est poussé. Ils demandent des secrets GitHub (liste dans `CLAUDE.md`, section « Release pipeline ») : sans eux, ils échouent sans rien publier.

En cas de souci : clic droit sur la page → Inspecter → onglet Console, puis copie les lignes en rouge.
