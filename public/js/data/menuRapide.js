/*
 * menuRapide.js
 *
 * Liste des entrées du « menu rapide » Compte+ (configurable via compte.php),
 * répliquée pour les non-C+ : `PageCompte` capture les checkboxes côté form
 * (ou injecte sa propre copie pour les non-C+ qui n'ont pas le natif),
 * `BoiteComptePlus` rend les <a> raccourcis dans la boîte flottante en bas.
 *
 * Section "Compte+" volontairement omise — les fonctions concernées
 * (simulateurs, bloc note, etc.) ne sont accessibles qu'aux Compte+.
 *
 * URLs et labels alignés sur le rendu natif Compte+ (extraction faite à
 * partir d'une boîte C+ avec toutes les cases cochées). Quelques URLs ont
 * des bizarreries dans le HTML natif (`invitation.php.php`, suffixes `.php`
 * après `?`) qu'on conserve à l'identique pour rester compatibles avec le
 * routeur Fourmizzz qui les accepte.
 **********************************************************************/

const MENU_RAPIDE = [
  // Fourmilière.
  { section: "Fourmilière", name: "menuRapideReine", label: "Reine", url: "Reine.php" },
  {
    section: "Fourmilière",
    name: "menuRapideRessources",
    label: "Ressources",
    url: "Ressources.php",
  },
  {
    section: "Fourmilière",
    name: "menuRapideConstruction",
    label: "Construction",
    url: "construction.php",
  },
  {
    section: "Fourmilière",
    name: "menuRapideLaboratoire",
    label: "Laboratoire",
    url: "laboratoire.php",
  },
  { section: "Fourmilière", name: "menuRapideArmee", label: "Armée", url: "Armee.php" },
  { section: "Fourmilière", name: "menuRapideEnnemies", label: "Ennemies", url: "ennemie.php" },
  { section: "Fourmilière", name: "menuRapideColonies", label: "Colonies", url: "colonies.php" },
  { section: "Fourmilière", name: "menuRapideCarte", label: "Carte", url: "carte2.php" },
  { section: "Fourmilière", name: "menuRapideCommerce", label: "Commerce", url: "commerce.php" },
  {
    section: "Fourmilière",
    name: "menuRapideMessagerie",
    label: "Messagerie",
    url: "messagerie.php",
  },
  {
    section: "Fourmilière",
    name: "menuRapideMaFourmiliere",
    label: "Vue",
    url: "fourmiliere.php",
  },
  // Alliance.
  { section: "Alliance", name: "menuRapideChatAlliance", label: "CA", url: "alliance.php" },
  {
    section: "Alliance",
    name: "menuRapideForumExterne",
    label: "Forum Externe",
    url: "http://fourmizzz.cforum.info/index.php",
    target: "_blank",
  },
  {
    section: "Alliance",
    name: "menuRapideForumAlliance",
    label: "Forum Alliance",
    url: "alliance.php?forum_menu",
  },
  { section: "Alliance", name: "menuRapideMembres", label: "Membres", url: "alliance.php?Membres" },
  {
    section: "Alliance",
    name: "menuRapideCandidatures",
    label: "Candidatures",
    url: "alliance.php?voirCandidature",
  },
  {
    section: "Alliance",
    name: "menuRapideMessageCollectif",
    label: "Message Collectif",
    url: "alliance.php?messCollectif.php",
  },
  {
    section: "Alliance",
    name: "menuRapideDiplomatie",
    label: "Diplomatie",
    url: "alliance.php?Diplomatie.php",
  },
  {
    section: "Alliance",
    name: "menuRapideDescription",
    label: "Description",
    url: "alliance.php?Description",
  },
  {
    section: "Alliance",
    name: "menuRapideOptions",
    label: "Options",
    url: "alliance.php?Options",
  },
  // Communauté.
  { section: "Communauté", name: "menuRapideChat", label: "Chat", url: "chat.php" },
  { section: "Communauté", name: "menuRapideEchange", label: "Echange", url: "echange.php" },
  {
    section: "Communauté",
    name: "menuRapidePropositions",
    label: "Propositions",
    url: "propositions.php",
  },
  {
    section: "Communauté",
    name: "menuRapideClassementJoueurs",
    label: "Classement Joueurs",
    url: "classement2.php",
  },
  {
    section: "Communauté",
    name: "menuRapideClassementAlliances",
    label: "Classement Alliances",
    url: "classement2.php?type_classement=alliance_total",
  },
  { section: "Communauté", name: "menuRapideMonProfil", label: "Mon Profil", url: "Membre.php" },
  { section: "Communauté", name: "menuRapideMonCompte", label: "Mon Compte", url: "compte.php" },
  {
    section: "Communauté",
    name: "menuRapideParrainage",
    label: "Parrainage",
    url: "FourmilieresFilles.php",
  },
  {
    section: "Communauté",
    name: "menuRapideInviterAmis",
    label: "Inviter mes Amis",
    // typo dans le natif, conservée à l'identique pour matcher.
    url: "invitation.php.php",
  },
  {
    section: "Communauté",
    name: "menuRapideForum",
    label: "Forum",
    url: "http://fourmizzz.cforum.info/index.php",
    target: "_blank",
  },
];

const MENU_RAPIDE_KEY = "outiiil_menuRapide";
