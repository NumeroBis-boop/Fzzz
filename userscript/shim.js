/*
 * shim.js — version « script utilisateur » de Fzzz (Tampermonkey, Violentmonkey).
 *
 * Premier fichier chargé par fzzz.user.js, avant les bibliothèques et les
 * scripts de l'extension. Il remplace les fonctions `chrome.*` dont ces
 * scripts ont besoin par leurs équivalents GM_* :
 *  - runtime.getURL : fichiers statiques (images, CSS) servis par jsDelivr,
 *    à la même version que les scripts (adresse lue dans la ressource fzzzBase) ;
 *  - storage.local : GM_getValue / GM_setValue (partagé entre les onglets) ;
 *  - runtime.sendMessage : site de suivi OUAF par GM_xmlhttpRequest (@connect
 *    ouafchaine.fr, accès demandé par le gestionnaire au premier envoi) ;
 *  - horloge serveur : lecture passive de l'en-tête Date des requêtes déjà
 *    faites par Fzzz (aucune requête ajoutée), comme le fait l'extension.
 **********************************************************************/

var FZZZ_USERSCRIPT = true;

// `var` : masque le `window.chrome` de la page dans la portée du script
var chrome = (function () {
  const OUAF = "http://ouafchaine.fr";
  const MAX_ECHANTILLONS = 30;

  /** Dossier public/ de la version installée, d'après la ressource fzzzBase. */
  function base() {
    let url = "";
    try {
      let r = GM_info.script.resources;
      let liste = Array.isArray(r) ? r : Object.values(r || {});
      url = (liste.find((x) => x && x.name == "fzzzBase") || {}).url || "";
    } catch (e) {
      /* GM_info incomplet : on lit l'en-tête */
    }
    if (!url) {
      let m = /@resource\s+fzzzBase\s+(\S+)/.exec((GM_info && GM_info.scriptMetaStr) || "");
      url = m ? m[1] : "";
    }
    return url.replace(/[^/]*$/, "");
  }
  const BASE = base();

  const ecouteurs = [];
  const local = {
    get(cles) {
      let liste = cles == null ? GM_listValues() : Array.isArray(cles) ? cles : [cles];
      let r = {};
      for (let cle of liste) {
        let v = GM_getValue(cle);
        if (v !== undefined) r[cle] = v;
      }
      return Promise.resolve(r);
    },
    set(objet) {
      let changements = {};
      for (let [cle, v] of Object.entries(objet)) {
        changements[cle] = { oldValue: GM_getValue(cle), newValue: v };
        GM_setValue(cle, v);
      }
      ecouteurs.forEach((f) => {
        try {
          f(changements, "local");
        } catch (e) {
          /* écouteur en erreur : les autres sont quand même prévenus */
        }
      });
      return Promise.resolve();
    },
    remove(cles) {
      (Array.isArray(cles) ? cles : [cles]).forEach((cle) => GM_deleteValue(cle));
      return Promise.resolve();
    },
  };

  /** Requête au site de suivi OUAF, mêmes limites que l'extension (API seulement). */
  function requeteOuaf(m) {
    if (!/^\/api\/[a-z/-]+$/.test(m.chemin) || !["GET", "POST", "PUT"].includes(m.methode))
      return Promise.resolve({ erreur: "requete" });
    return new Promise((resoudre) => {
      GM_xmlhttpRequest({
        method: m.methode,
        url: OUAF + m.chemin,
        headers: m.corps === undefined ? {} : { "Content-Type": "application/json" },
        data: m.corps === undefined ? undefined : JSON.stringify(m.corps),
        timeout: 20000,
        onload: (r) => {
          let donnees = {};
          try {
            donnees = JSON.parse(r.responseText);
          } catch (e) {
            /* réponse vide ou non JSON */
          }
          resoudre({ ok: r.status >= 200 && r.status < 300, statut: r.status, donnees });
        },
        onerror: () => resoudre({ erreur: "reseau" }),
        ontimeout: () => resoudre({ erreur: "reseau" }),
      });
    });
  }

  // Horloge : heure d'envoi et en-tête Date des requêtes vers le jeu (lecture seule)
  const cleHorloge = `fzzz_horloge_${location.hostname.split(".")[0]}`;
  function echantillon(envoi, entete) {
    let date = entete ? Date.parse(entete) : NaN;
    if (Number.isNaN(date)) return;
    let lu = GM_getValue(cleHorloge),
      liste = Array.isArray(lu) ? lu : [];
    liste.push({ date, envoi, reception: Date.now() });
    local.set({ [cleHorloge]: liste.slice(-MAX_ECHANTILLONS) });
  }
  try {
    const XHR = window.XMLHttpRequest.prototype,
      envoyer = XHR.send;
    XHR.send = function () {
      let envoi = Date.now(),
        lu = false;
      this.addEventListener("readystatechange", () => {
        if (lu || this.readyState < 2) return;
        lu = true;
        try {
          if (new URL(this.responseURL).hostname === "s5.fourmizzz.fr")
            echantillon(envoi, this.getResponseHeader("Date"));
        } catch (e) {
          /* adresse illisible : pas d'échantillon */
        }
      });
      return envoyer.apply(this, arguments);
    };
  } catch (e) {
    /* XMLHttpRequest non modifiable : l'horloge reste sur l'heure du PC */
  }

  return {
    runtime: {
      getURL: (chemin) => BASE + String(chemin).replace(/^\//, ""),
      getManifest: () => ({ version: GM_info.script.version }),
      sendMessage(message) {
        let type = message && message.type;
        if (type == "fzzz_ouaf") return requeteOuaf(message);
        if (type == "fzzz_majVerifier") return Promise.resolve({ statut: "userscript" });
        return Promise.resolve(undefined);
      },
    },
    storage: {
      local,
      onChanged: { addListener: (f) => ecouteurs.push(f) },
    },
    // l'accès à ouafchaine.fr est géré par le gestionnaire de scripts (@connect)
    permissions: {
      contains: () => Promise.resolve(true),
      request: () => Promise.resolve(true),
    },
  };
})();
