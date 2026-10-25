# Installer Fzzz

Les archives à installer s'obtiennent de deux façons :

- **Dernière version de `main`** : onglet **Actions** du dépôt, dernière exécution « Extension » réussie, section **Artifacts**, fichier `fzzz-extension` (connexion GitHub requise). Il contient les trois archives.
- **Versions publiées** : page **Releases** (https://github.com/NumeroBis-boop/fzzz/releases). Pour publier une version : **Draft a new release**, tag `v0.5.0` par exemple, **Publish release**. Les archives sont jointes automatiquement quelques minutes plus tard.

| Fichier | Pour |
|---|---|
| `fzzz-<version>-chrome.zip` | Chrome, Edge, Brave, Opera |
| `fzzz-<version>-firefox.zip` | Firefox (PC et Android, après signature) |
| `fzzz-<version>-sources.zip` | Les sources, à fournir à Mozilla pour la signature |

## Chrome, Edge, Brave (PC)

1. Télécharge `fzzz-<version>-chrome.zip` et **décompresse-le** dans un dossier que tu garderas, par exemple `Documents\Fzzz`. Le navigateur charge l'extension depuis ce dossier : ne le supprime pas.
2. Ouvre `chrome://extensions` (Edge : `edge://extensions`).
3. Active le **Mode développeur** (interrupteur en haut à droite ; sur Edge, dans la colonne de gauche).
4. Clique **Charger l'extension non empaquetée** et choisis le dossier décompressé, celui qui contient `manifest.json`.
5. Ouvre ou recharge une page de `s5.fourmizzz.fr` : l'heure serveur apparaît à côté de « S5 Pseudo », en haut de l'encart d'information.

**Mise à jour** : décompresse la nouvelle version **dans le même dossier** (en remplaçant les fichiers), puis clique l'icône ↻ de Fzzz dans `chrome://extensions`.

Chrome peut afficher au démarrage un avertissement sur les extensions en mode développeur : c'est normal pour une extension non publiée sur le Chrome Web Store.

## Firefox PC

### Essai rapide (extension temporaire)

1. Télécharge `fzzz-<version>-firefox.zip` (inutile de le décompresser).
2. Ouvre `about:debugging#/runtime/this-firefox`.
3. Clique **Charger un module complémentaire temporaire…** et choisis le fichier `.zip`.

L'extension disparaît à la fermeture de Firefox. Pour une installation durable, il faut la faire signer.

### Installation durable (signature Mozilla, gratuite)

Firefox n'installe durablement que des extensions signées par Mozilla. La signature « non listée » ne publie pas l'extension dans le catalogue : seul le titulaire du compte peut la distribuer.

1. Crée un compte sur https://addons.mozilla.org (bouton « Connexion »).
2. Va sur https://addons.mozilla.org/developers/addon/submit/distribution et choisis **« Sur votre propre site »** (*On your own*).
3. Envoie `fzzz-<version>-firefox.zip`. À la question sur le code source, réponds **Oui** et envoie `fzzz-<version>-sources.zip`.
4. La validation automatique prend en général quelques minutes. Télécharge ensuite le fichier `.xpi` signé.
5. Ouvre le `.xpi` avec Firefox (glisser-déposer dans une fenêtre) et confirme l'installation.

## Firefox Android

Firefox Android n'installe que des extensions signées par Mozilla.

1. Fais d'abord signer l'extension comme ci-dessus, pour obtenir le fichier `.xpi`.
2. Copie le `.xpi` sur le téléphone.
3. Dans Firefox Android, active le menu de débogage : **Paramètres → À propos de Firefox**, puis touche le logo 5 fois.
4. Dans **Paramètres**, choisis **Installer un module depuis un fichier** et sélectionne le `.xpi`.

Cette procédure par fichier est **à vérifier** sur ta version de Firefox Android. Si elle n'existe pas, la solution est une publication « listée » sur addons.mozilla.org, avec une revue par Mozilla.

## Vérifier que tout fonctionne

| Page | Ce qui doit apparaître |
|---|---|
| Toutes | Heure serveur à côté de « S5 Pseudo », avec les boutons − et + (latence ±0,1 s) |
| Armée, Attaquer | `→ 19:56:57 · RC 19h57 (n° 1)` après chaque compte à rebours d’attaque |
| Ressources | Heure de retour à la seconde de chaque chasse |
| Armée | Bloc « Chasse(s) en cours » et bloc « Rentabilité » (après une visite de Ressources) |
| Laboratoire | Lignes Fzzz sous Bouclier, Armes et Communication |
| Ennemies | En haut : tes attaques en cours ; colonnes Trajet et Arrivée (exactes pour les joueurs dont tu as ouvert le profil) |
| Profil d'un joueur | `→ arrivée HH:MM:SS` à côté du temps de trajet |

Ordre conseillé pour la première utilisation : **ton propre profil**, Construction, Laboratoire, Ressources, Armée. L'extension mémorise alors tes coordonnées, tes niveaux et ton armée.

En cas de souci : clic droit sur la page → Inspecter → onglet Console, puis copie les lignes en rouge.
