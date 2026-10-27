# Fzzz

Extension navigateur pour [Fourmizzz](http://www.fourmizzz.fr) (serveur s5), pour Chrome, Edge, Brave et Firefox (PC et Android).

Fzzz est un fork de [Toolzzz](https://github.com/GuiEpi/toolzzz) (GuiEpi), lui-même fork et maintenance d'[Outiiil](https://github.com/Hraesvelg/Outiiil) (Hraesvelg). La base est celle de Toolzzz 3.12.3, que nous améliorons pour l'alliance.

## Différences avec Toolzzz

- Nom, identifiant Firefox (`fzzz@numerobis-boop.github.io`) et liens propres : Fzzz peut être installé à côté de Toolzzz, mais **il faut désactiver l'un des deux**, sinon les deux s'injectent dans les mêmes pages.
- **Conformité au règlement du s5** (voir [docs/conformite.md](docs/conformite.md)) :
  - « Synchroniser » et « Sonder » n'envoient plus l'attaque tout seuls à la fin du compte à rebours. Ils affichent le décompte, puis mettent en évidence le bouton Lancer : **le clic final appartient au joueur**.
  - L'actualisation automatique du chat (une requête toutes les 5 s) est retirée.
- **Retiré** : l'utilitaire d'alliance (stockage partagé dans le forum : commandes de convois, rangs et fiches SDC, onglet « Utilitaire » des paramètres), le lanceur de ponte de la barre d'outils, et les boutons Colonne, Copier, Copie simple, CSV et Excel de la liste des membres (seul « Synchroniser » reste).
- **Ajouté** :
  - barre d'outils (Chasse, Combat, Paramètres) en bas de l'encadré Compte+ (celui du jeu, ou celui que Fzzz recrée sans C+), au lieu du bandeau fixe sur le bord droit ;
  - rentabilité des Armes au Laboratoire calculée sur l'armée complète lue dans la page Reine (garnison et troupes parties), à défaut sur la garnison plus les troupes parties depuis ce navigateur ;
  - horloge à la seconde **sur l'heure du serveur** au-dessus de l'encart « S5 Pseudo », avec une **latence** réglable par pas de 0,1 s (boutons − et +, mémorisée). L'heure du serveur est déduite de l'en-tête HTTP `Date` des pages déjà chargées (permission `webRequest`, en lecture seule) : aucune requête supplémentaire vers le jeu. L'heure serveur + latence sert aux outils de synchronisation : « Synchroniser » et « Sonder » (compte à rebours au dixième), heures de retour et de RC, « Lancer à » de la boîte Combat ;
  - temps de trajet arrondis au plus proche, comme le jeu (Toolzzz arrondissait au supérieur : 1 s d'écart possible) ; minute du RC selon la règle du jeu (impact à hh:mm:00 pile → hh:mm) ;
  - au Laboratoire, dans une extension sous la ligne Armes : FdF hors bonus de l'armée, FdF HB requise pour que le niveau suivant soit rentable face à la ponte de JS, d'Artilleuses, de Tanks ou de Tueuses d'élite, FdF HB manquante et nombre d'unités à pondre ;
  - en Construction sous l'Étable à pucerons, et au Laboratoire sous Communication avec les animaux, un même bandeau : ouvrières totales, exploitées sur le TdC et disponibles pour les convois, puis pour chaque niveau suivant les ouvrières sacrifiées (niveaux de Communication manquants), la capacité de convoi, le gain et les ouvrières qui manquent (ΔK = 0,5 × O − Cₙ × (10 + 0,5n), sur les ouvrières disponibles pour les convois) ;
  - second lanceur de chasses, **par budget de pertes** : le simulateur/lanceur de chasse de Calystène (v2.00.35.03) avec son greffon CHS2B, intégré tel quel (`public/js/lib/calystene-chs2_2.00.35.03.js`), au choix avec le lanceur standard via un sélecteur sur la page Ressources ; seules retouches : image hébergée sur free.fr retirée (aucune requête vers un tiers), bouton « Annuler tout » non ajouté (doublon), lectures synchrones de pages passées par une requête native (jQuery ignore `async: false` dans une extension) ;
  - messagerie : titres colorés par type : RC de combat en défense #B42318, en attaque #287A36, RC de chasse en noir et en italique, convois #7137A8, autres messages blanc en gras ; messages non lus précédés d'une pastille bleue « ● » (le bleu du jeu étant masqué par ces couleurs) ; la date prend la couleur du titre ; à l'ouverture de la messagerie, convois rangés dans « Commerce », RC de chasse dans « Chasse », RC de combat dans « Combat », conversations dans « Conversation » (requête du menu « Déplacer vers » du jeu, seulement pour les messages mal rangés) ; bouton de copie du rapport complet entre la case à cocher et l'expéditeur ; boutons « Analyser » sous les rapports de chasse (bilan compact avec un toutou animé (SVG de l'extension) niais mais heureux si la FdF augmente, en larmes sinon, chasse par chasse, et graphe des pertes par M cm² des 15 dernières chasses) et sous les RC de combat (avec accès à l'analyse de sonde de l'outil Combat), même contenu que les onglets « Analyser » des outils ;
  - page d'attaque d'un joueur : « Temps de trajet » avec les secondes au-dessus de l'heure de retour ;
  - page Convois : sous les convois en cours, tableau « Joueur à livrer » (membres suivis choisis dans une liste, lien pour les convoyer, temps de trajet avec la Vitesse d'attaque, horaire de retour, convoi restant à livrer lu sur le site de suivi OUAF) ;
  - page Convois : devant chaque convoi envoyé, son état sur le site de suivi de la OUAF, « ✅ Enregistré » ou bouton « 📤 Envoyer au suivi » ; le mot de passe du site se renseigne (et se consulte) dans Paramètres → Convoi ;
  - encarts ajoutés par Fzzz (liste des attaques, floods reçus sur la page Armée, synthèse des chasses, chasses/floods/évolution du TdC sur la page membre) repliables (dépliés par défaut, repli mémorisé) et désactivables un par un dans Paramètres → Affichages ;
  - page Armée : floods partagés en cours sur le joueur, au-dessus de « Troupes en Garnison » ;
  - page Membres de l'alliance : vues « Standard » (tableau du jeu), « Temps de trajet » (ancien « Synchroniser ») et « Floods et chasses en cours » (rang, pseudo, terrain, prochaine variation, montant, joueur cible, TdC final), et au survol d'une ligne l'évolution future du TdC du membre ; totaux de l'alliance affichés sous le tableau ;
  - liste des attaques en cours (Armée, page d'attaque) : un seul tableau dans l'ordre d'arrivée, colonnes #, arrivée, cible et tag d'alliance coloré (vert : son alliance, couleur du jeu pour les pactes, noir sinon), troupes (quantité, détail au survol), lieu (TDC, Dôme, Loge), « Copier le détail » et « Partager ce flood » par ligne, une attaque par ligne (la police rétrécit si le tableau dépasse) ; « Annuler » recharge la page au même endroit ; bouton « Partager TOUS mes floods » sous le compteur d'attaques du jeu ;
  - partage des chasses et des floods avec l'alliance, stocké dans son forum (section « Fzzz-Chasses », deux sujets par joueur : « Chasses | pseudo » et « Floods | pseudo », dont le premier message est réécrit à chaque partage, sans doublon, une ligne par entrée : « jj/mm/aa hh:mm | cm² » ou « jj/mm/aa hh:mm | cible | cm² | #numéro d'attaque » (le numéro distingue les attaques d'un multi-flood) ; aucun serveur tiers) : bouton sous la synthèse des chasses (Ressources) et sous chaque tableau d'attaques (« Partager mes floods »), sur la page membre : chasses en cours du joueur et floods en cours dirigés vers lui (lus dans les sujets Floods de tous les membres), placés sous le bloc Action, avec une synthèse encadrée de l'évolution du TdC du joueur à chaque minute où il varie ; la section est retrouvée automatiquement, un chef peut la créer d'un clic depuis le forum ;
  - floods : distinction entre les unités envoyées et le TdC réellement pris. Chaque flood partagé garde ses unités, sa prise estimée au lancement et le TdC de la cible relevé ; les synthèses (page membre, page Membres, page Armée) rejouent toutes les chasses et floods partagés dans l'ordre d'arrivée pour estimer la prise à l'impact : au plus 20 % du TdC de la cible à ce moment, rien si la cible n'est plus à portée du lanceur (50 % à 300 % de son TdC, l'opti-flood raté) ;
  - Ressources : synthèse des chasses en cours par minute d'impact (minutes consécutives regroupées sur la plus tardive) : heure d'impact, nombre de chasses, TdC chassé, unités mises en chasse (détail au survol), total ;
  - lanceur de chasses : les difficultés que l'armée ne peut pas tenir sont grisées, avec le maximum possible.

- **Mises à jour** : Firefox (version signée) se met à jour seul chaque jour ; bouton « Mettre à jour Fzzz » dans Paramètres → À propos (Chrome Web Store : mise à jour immédiate en un clic ; Firefox : installation du dernier .xpi signé).
- **Mobile** (Firefox pour Android) : sur écran étroit, les tableaux et encarts ajoutés défilent horizontalement dans leur cadre au lieu d'élargir la page, les rangées de boutons passent à la ligne, la largeur fixe du tableau des membres est désactivée et l'infobulle d'évolution du TdC s'ouvre au toucher d'une ligne (second toucher ou toucher ailleurs pour la fermer).

## Installer

- **Script utilisateur** (Tampermonkey ou Violentmonkey) : ouvrir https://raw.githubusercontent.com/NumeroBis-boop/Fzzz/main/fzzz.user.js. Ce fichier d'en-tête déclare tous les fichiers de Fzzz en dépendance (`@require`).
- **Extension** et différences entre les deux : voir [docs/installation.md](docs/installation.md).

## Développer

```bash
bun install
bun run dev            # Chrome, rechargement automatique
bun run dev:firefox
bun run compile        # vérification TypeScript
bun run format         # formatage (oxfmt)
bun run zip && bun run zip:firefox
```

L'architecture (scripts déclarés à la main dans `wxt.config.ts`, ordre de chargement, contraintes MV3) est décrite dans [CLAUDE.md](CLAUDE.md) et [CONTRIBUTING.md](CONTRIBUTING.md).

Pour récupérer les corrections de Toolzzz : `git fetch toolzzz master && git merge toolzzz/master` (remote `toolzzz` = https://github.com/GuiEpi/toolzzz.git). L'historique de Toolzzz est conservé dans celui de Fzzz, les fusions restent donc simples.

L'ancienne version de Fzzz (0.5, écrite de zéro) est archivée dans la branche `archive/fzzz-0.5`. Ses formules vérifiées sur le s5 sont résumées dans [docs/observations-s5.md](docs/observations-s5.md).

## Crédits et licence

- Projet original : [Outiiil](https://github.com/Hraesvelg/Outiiil) par Hraesvelg
- Fork maintenu : [Toolzzz](https://github.com/GuiEpi/toolzzz) par GuiEpi
- Fzzz : NumeroBis-boop
- Thème jQuery UI « humanity » (paquet npm `jquery-ui-themes` 1.12.0, jQuery Foundation, licence MIT), embarqué dans `public/css/lib/`

[GPL-3.0](LICENSE), conformément à la licence des projets d'origine.
