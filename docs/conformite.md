# Conformité au règlement

Source : règlement du s5 (sections C1, C2, C3, E3), transmis par le joueur le 2026-10-24.
Principe du règlement : **« L'optimisation est autorisée, pas l'automatisation. »**

## Ce que le règlement autorise explicitement (C2, C3)

- Enchaîner, **à l'initiative du joueur**, des actions successives : multi-chasse, multi-flood, convois, annulations.
- Synchroniser avec un site externe **les données présentes sur la page affichée**.
- Simulateurs de combat, de chasse et outils d'optiflood, « à la condition stricte que le clic final appartienne toujours au joueur ».

## Ce qu'il interdit (C1, C2, E3)

| Interdit | Conséquence pour l'extension |
|---|---|
| Maintenir la session au-delà de 30 min | Aucune requête périodique vers le jeu, pas même un `HEAD` pour l'heure serveur |
| Reconnexion automatique | Jamais de stockage d'identifiants |
| Actions de jeu sans intervention humaine | Chaque envoi part d'un clic ; pas de minuterie qui lance une attaque à l'heure H |
| Récolte régulière d'informations sans intervention | Pas de lecture de pages en arrière-plan ; les données publiques viennent de l'API officielle |
| Fonctions équivalentes au Compte+ pour un joueur sans Compte+ | **À vérifier** : liste des fonctions Compte+ du s5 nécessaire |
| Publier une armée ou un RC (chat général, description d'alliance, profil) | La copie de RC vise le forum ou le chat d'alliance, ou l'outil partagé ; jamais un espace public |

## Règles de conception qui en découlent

1. **Un clic, une intention.** Un clic peut déclencher une suite d'envois (multi-flood autorisé), mais rien ne part sans clic.
2. **Lecture passive uniquement.** L'extension lit les pages que le joueur affiche, et les en-têtes HTTP de ces mêmes pages. Elle n'émet aucune requête de lecture vers le jeu.
3. **Synchronisation externe = ce qui est affiché.** Le partage d'alliance n'envoie que des données lues sur une page ouverte par le joueur (attaques lancées, page Armée).
4. **API officielle** pour les TDC et coordonnées des autres joueurs.

## Points ouverts

- Liste des fonctions Compte+ du s5, pour ne pas les reproduire.
- La synchronisation de l'heure de lancement d'un flood (« attendre la bonne seconde puis envoyer ») : si l'envoi part automatiquement après un délai, il n'y a plus de clic final. **Décision : l'extension affiche un compte à rebours, le joueur clique.**
