// @ts-check
/*
 * ouaf-autorisation.js
 * Page de l'extension qui demande l'accès à ouafchaine.fr : le navigateur
 * n'accepte cette demande qu'après un clic dans une page de l'extension.
 **********************************************************************/

(function () {
  const etat = document.getElementById("etat"),
    demande = { origins: ["http://ouafchaine.fr/*"] };
  // Firefox : déclaration des données transmises (code de connexion, convois)
  if (navigator.userAgent.includes("Firefox"))
    demande.data_collection = ["authenticationInfo", "websiteContent"];
  document.getElementById("autoriser").addEventListener("click", () => {
    chrome.permissions.request(demande).then(
      (ok) => {
        etat.textContent = ok
          ? "C'est fait. Tu peux fermer cet onglet et relancer l'envoi depuis la page Convois."
          : "Accès refusé : les convois ne seront pas envoyés au site de suivi.";
        if (ok) setTimeout(() => window.close(), 2500);
      },
      (e) => (etat.textContent = "La demande a échoué : " + e.message),
    );
  });
})();
