---
name: messages-discord
description: Mise en forme Markdown de Discord pour les messages que le mainteneur publie sur le Discord de l'alliance (réponses aux joueurs, annonces de version, explications d'une fonction). Use quand l'utilisateur demande un message « pour Discord », « à publier », « pour répondre à mes camarades », une annonce ou une réponse à coller dans un salon.
---

# Messages pour Discord

Le mainteneur colle lui-même le message dans Discord. Il faut donc lui donner le texte **brut**, avec les caractères de mise en forme, prêt à copier.

## Source

Syntaxe de l'article d'aide de Discord « Markdown de Texte 101 (Formatage du chat : gras, italique, souligné) », https://support.discord.com/hc/fr/articles/210298617. Le 20/11/2026, l'article n'a pas pu être lu depuis la session (page de vérification anti-robots de Cloudflare, non contournée) : le tableau ci-dessous vient de la syntaxe connue de Discord. Si le mainteneur colle le texte de l'article, le comparer à ce fichier et corriger les écarts.

## Syntaxe

| Effet                           | À taper                              | Remarque                                                                                                                     |
| ------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Italique                        | `*texte*` ou `_texte_`               |                                                                                                                              |
| Gras                            | `**texte**`                          |                                                                                                                              |
| Gras italique                   | `***texte***`                        |                                                                                                                              |
| Souligné                        | `__texte__`                          | Se combine : `__*texte*__`, `__**texte**__`, `__***texte***__`                                                               |
| Barré                           | `~~texte~~`                          |                                                                                                                              |
| Spoiler (masqué)                | `\|\|texte\|\|`                      | Le lecteur clique pour le voir                                                                                               |
| Titres                          | `# Titre`, `## Titre`, `### Titre`   | En début de ligne, suivi d'une espace                                                                                        |
| Petit texte gris                | `-# texte`                           | En début de ligne ; pour une précision discrète                                                                              |
| Lien masqué                     | `[texte](https://adresse)`           | Une adresse entre `<` et `>` s'affiche sans aperçu                                                                           |
| Liste à puces                   | `- élément` ou `* élément`           | Sous-liste : des espaces avant le tiret                                                                                      |
| Liste numérotée                 | `1. élément`                         |                                                                                                                              |
| Citation d'une ligne            | `> texte`                            |                                                                                                                              |
| Citation jusqu'à la fin         | `>>> texte`                          | Tout ce qui suit dans le message est cité                                                                                    |
| Code en ligne                   | `` `texte` ``                        | Aucune autre mise en forme à l'intérieur                                                                                     |
| Bloc de code                    | ` ``` ` sur une ligne avant et après | ` ```js ` colore le code ; les espaces sont gardés tels quels                                                                |
| Caractère littéral              | `\*`, `\_`, `\~`, `\|`, `\>`         | La barre oblique inverse annule la mise en forme                                                                             |
| Heure dans le fuseau du lecteur | `<t:1795183200:F>`                   | Instant Unix en secondes (ici le 20/11/2026 à 15h00 à Paris) ; formats `t`, `T`, `d`, `D`, `f`, `F`, `R` (« dans 2 heures ») |

Longueur : 2 000 caractères par message (4 000 avec Nitro). Au-delà, découper en plusieurs messages.

## Règles pour les messages du mainteneur

- **Livraison** : dans la réponse, le message va dans un bloc délimité par `~~~` (pas ` ``` `, qui peut apparaître dans le message lui-même), pour que les `**`, `__` et `>` restent visibles et se copient tels quels. Donner sa longueur en caractères quand elle approche 2 000.
- **Ton** : français, court, à la première personne du mainteneur (« je demande à la modération »). « Vous » pour l'alliance entière, « tu » quand le message répond à un joueur. Pronoms neutres ou le pseudo, jamais un genre supposé.
- **Structure** : un titre en gras (`**…**`) ou `##` seulement si le message est long ; des puces pour les listes ; le lien de mise à jour entre `<` et `>` pour éviter un grand aperçu : `<https://raw.githubusercontent.com/NumeroBis-boop/Fzzz/main/fzzz.user.js>`.
- **Pièges** :
  - un pseudo avec `_` ou `*` (`Dark_Ant_`) se met en italique : l'échapper (`Dark\_Ant\_`) ou le mettre entre `` ` `` ;
  - une ligne qui commence par `#`, `-`, `>` ou `1.` change de forme ; un « - » en début de ligne pour un tiret de texte devient une puce ;
  - jamais `@everyone` ni `@here` sans demande explicite : tout le serveur reçoit une notification ;
  - les nombres à la française (« 1 234 », « 12,5 % ») et les termes du jeu (TdC, flood, convoi, C+) comme dans l'extension.
- **Contenu** : seulement ce qui est vérifié dans le code ou observé ; dire ce qui n'est pas vérifié plutôt que d'affirmer.

## Exemple

```
**Heures d'arrivée et de retour : qui affiche quoi**

**Le jeu sans C+** : seulement le compte à rebours (« dans 1 h 39 min »).
**Le C+** : ajoute l'heure (retour des convois et des chasses, arrivée des attaques).

**L'extension, sans C+** :
- Convois et chasses : « Retour le … » sous chaque ligne.
- Attaques : colonne « Arrivée » du bloc « Mes attaques en cours », en haut de la page Armée.

-# Je demande à la modération si ces affichages sont autorisés sans C+ (règle E3).
```
