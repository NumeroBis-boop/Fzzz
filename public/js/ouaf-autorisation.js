// @ts-check
/*
 * ouaf-autorisation.js
 * Page de l'extension qui demande l'accès au site de suivi des convois de
 * l'alliance (?site=origine) : le navigateur n'accepte cette demande qu'après
 * un clic dans une page de l'extension.
 **********************************************************************/

(function () {
  const etat = document.getElementById("etat"),
    site = new URLSearchParams(location.search).get("site") || "",
    bouton = /** @type {HTMLButtonElement} */ (document.getElementById("autoriser")),
    demande = { origins: [site + "/*"] };
  if (!/^https?:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(site)) {
    etat.textContent =
      "Adresse du site de suivi invalide : rouvre cette page depuis la page Convois.";
    bouton.disabled = true;
    return;
  }
  document.getElementById("site").textContent = site.replace(/^https?:\/\//, "");
  // Firefox : déclaration des données transmises (code de connexion, convois)
  if (navigator.userAgent.includes("Firefox"))
    demande.data_collection = ["authenticationInfo", "websiteContent"];
  bouton.addEventListener("click", () => {
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
