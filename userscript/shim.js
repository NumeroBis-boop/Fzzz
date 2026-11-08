/*
 * shim.js — version « script utilisateur » de Fzzz (Tampermonkey, Violentmonkey,
 * Userscripts sur Safari iOS).
 *
 * Premier fichier chargé par fzzz.user.js, avant les bibliothèques et les
 * scripts de l'extension. Il remplace les fonctions `chrome.*` dont ces
 * scripts ont besoin par leurs équivalents GM_* :
 *  - runtime.getURL : fichiers statiques (images, CSS) servis par jsDelivr,
 *    à la même version que les scripts (adresse lue dans la ressource fzzzBase) ;
 *  - storage.local : GM_getValue / GM_setValue (partagé entre les onglets),
 *    ou GM.getValue / GM.setValue asynchrones quand le gestionnaire n'a que
 *    ceux-là (Userscripts sur Safari iOS) ;
 *  - runtime.sendMessage : site de suivi OUAF par GM_xmlhttpRequest (@connect
 *    ouafchaine.fr, accès demandé par le gestionnaire au premier envoi), et
 *    script du Google Sheet de l'alliance (export des RC, @connect
 *    script.google.com) ;
 *  - horloge serveur : lecture passive de l'en-tête Date des requêtes déjà
 *    faites par Fzzz (aucune requête ajoutée), comme le fait l'extension.
 **********************************************************************/

var FZZZ_USERSCRIPT = true;
// nom affiché dans le jeu : celui du script installé (« Extension OUAF - TEST »
// pour la version d'essai), lu dans son en-tête
var FZZZ_NOM_EXTENSION = (function () {
  try {
    let m = /@name:fr\s+(.+)/.exec(GM_info.scriptMetaStr || "");
    return m ? m[1].trim() : null;
  } catch (e) {
    return null;
  }
})();

// Gestionnaire sans @resource (Userscripts sur Safari iOS) : feuilles de style
// liées dès maintenant depuis jsDelivr (adresses lues dans l'en-tête), avant que
// les scripts ne mesurent la page ; fzzz.user.js les reprend sinon.
(function () {
  if (typeof GM_getResourceText == "function") return;
  try {
    let entete = (typeof GM_info != "undefined" && GM_info.scriptMetaStr) || "";
    for (let m of entete.matchAll(/@resource\s+fzzzCss\d+\s+(\S+)/g)) {
      let lien = document.createElement("link");
      lien.rel = "stylesheet";
      lien.href = m[1];
      (document.head || document.documentElement).appendChild(lien);
    }
  } catch (e) {
    /* en-tête illisible : fzzz.user.js liera les feuilles de style */
  }
})();

// `var` : masque le `window.chrome` de la page dans la portée du script
var chrome = (function () {
  const OUAF = "http://ouafchaine.fr";
  const ADRESSE_SHEET =
    /^https:\/\/script\.google\.com\/(?:a\/macros\/[^/\s]+|macros)\/s\/[\w-]+\/exec$/;
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

  // Tampermonkey, Violentmonkey : GM_* synchrones. Userscripts (Safari iOS),
  // Greasemonkey 4 : seulement GM.*, asynchrones. Sans l'un ni l'autre : en
  // mémoire, le temps de la page.
  const memoire = new Map();
  const valeurs =
    typeof GM_getValue == "function"
      ? {
          lire: (cle) => Promise.resolve(GM_getValue(cle)),
          ecrire: (cle, v) => Promise.resolve(GM_setValue(cle, v)),
          effacer: (cle) => Promise.resolve(GM_deleteValue(cle)),
          cles: () => Promise.resolve(GM_listValues()),
        }
      : typeof GM != "undefined" && GM && typeof GM.getValue == "function"
        ? {
            lire: (cle) => GM.getValue(cle),
            ecrire: (cle, v) => GM.setValue(cle, v),
            effacer: (cle) => GM.deleteValue(cle),
            cles: () => GM.listValues(),
          }
        : {
            lire: (cle) => Promise.resolve(memoire.get(cle)),
            ecrire: (cle, v) => Promise.resolve(memoire.set(cle, v)),
            effacer: (cle) => Promise.resolve(memoire.delete(cle)),
            cles: () => Promise.resolve([...memoire.keys()]),
          };

  const ecouteurs = [];
  const local = {
    get(cles) {
      return (cles == null ? valeurs.cles() : Promise.resolve([].concat(cles))).then((liste) =>
        Promise.all(liste.map((cle) => valeurs.lire(cle))).then((lus) => {
          let r = {};
          liste.forEach((cle, i) => {
            if (lus[i] !== undefined) r[cle] = lus[i];
          });
          return r;
        }),
      );
    },
    set(objet) {
      let entrees = Object.entries(objet);
      return Promise.all(entrees.map(([cle]) => valeurs.lire(cle)))
        .then((anciennes) => {
          let changements = {};
          entrees.forEach(([cle, v], i) => {
            changements[cle] = { oldValue: anciennes[i], newValue: v };
          });
          return Promise.all(entrees.map(([cle, v]) => valeurs.ecrire(cle, v))).then(
            () => changements,
          );
        })
        .then((changements) =>
          ecouteurs.forEach((f) => {
            try {
              f(changements, "local");
            } catch (e) {
              /* écouteur en erreur : les autres sont quand même prévenus */
            }
          }),
        );
    },
    remove(cles) {
      return Promise.all([].concat(cles).map((cle) => valeurs.effacer(cle))).then(() => {});
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

  /**
   * Script du Google Sheet de l'alliance (export des RC) : adresse de script
   * Google seulement, JSON en texte brut. GM.xmlHttpRequest quand le
   * gestionnaire n'a que lui (Userscripts sur Safari iOS).
   */
  function requeteSheet(m) {
    if (!ADRESSE_SHEET.test(String(m.url || "")) || !["GET", "POST"].includes(m.methode))
      return Promise.resolve({ erreur: "requete" });
    let xhr =
      typeof GM_xmlhttpRequest == "function"
        ? GM_xmlhttpRequest
        : typeof GM != "undefined" && GM && typeof GM.xmlHttpRequest == "function"
          ? GM.xmlHttpRequest
          : null;
    if (!xhr) return Promise.resolve({ erreur: "reseau" });
    return new Promise((resoudre) => {
      xhr({
        method: m.methode,
        url: m.url,
        headers: m.corps === undefined ? {} : { "Content-Type": "text/plain;charset=utf-8" },
        data: m.corps === undefined ? undefined : JSON.stringify(m.corps),
        timeout: 60000,
        onload: (r) => {
          let donnees = {},
            extrait = "";
          try {
            donnees = JSON.parse(r.responseText);
          } catch (e) {
            // page d'erreur de Google (exception du script…) : son texte, pour le journal
            extrait = String(r.responseText || "")
              .replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ")
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 300);
          }
          resoudre({
            ok: r.status >= 200 && r.status < 300,
            statut: r.status,
            donnees,
            ...(extrait ? { extrait } : {}),
          });
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
    let reception = Date.now();
    valeurs
      .lire(cleHorloge)
      .then((lu) => {
        let liste = Array.isArray(lu) ? lu : [];
        liste.push({ date, envoi, reception });
        return local.set({ [cleHorloge]: liste.slice(-MAX_ECHANTILLONS) });
      })
      .catch(() => {});
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

  /** Adresse d'installation du script (version publiée ou TEST). */
  function adresseScript() {
    let url = "";
    try {
      url = GM_info.script.downloadURL || "";
    } catch (e) {
      /* GM_info incomplet */
    }
    if (url) return url;
    let m = /@downloadURL\s+(\S+)/.exec((GM_info && GM_info.scriptMetaStr) || "");
    return m ? m[1] : undefined;
  }

  return {
    runtime: {
      getURL: (chemin) => BASE + String(chemin).replace(/^\//, ""),
      getManifest: () => ({ version: GM_info.script.version }),
      sendMessage(message) {
        let type = message && message.type;
        if (type == "fzzz_ouaf") return requeteOuaf(message);
        if (type == "fzzz_sheet") return requeteSheet(message);
        if (type == "fzzz_majVerifier")
          return Promise.resolve({ statut: "userscript", url: adresseScript() });
        return Promise.resolve(undefined);
      },
    },
    storage: {
      local,
      onChanged: { addListener: (f) => ecouteurs.push(f) },
    },
    // l'accès à ouafchaine.fr et à script.google.com est géré par le
    // gestionnaire de scripts (@connect)
    permissions: {
      contains: () => Promise.resolve(true),
      request: () => Promise.resolve(true),
    },
  };
})();
