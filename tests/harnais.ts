/**
 * Harnais de test : charge les vrais fichiers de l'extension (bibliothèques
 * puis classes) dans une fenêtre happy-dom, comme le navigateur les injecte.
 * Les classes, déclarées au niveau global des scripts, se lisent avec `lire`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { Window } from "happy-dom";

const PUBLIC = join(import.meta.dir, "..", "public");

const BIBLIOTHEQUES = [
  "js/lib/jquery_3.2.1.js",
  "js/lib/moment_2.19.1.js",
  "js/lib/moment-locale-fr.js",
  "js/lib/numeral_2.0.6.js",
  "js/lib/numeral-locale-fr.js",
];

// journal de l'extension : les modules y notent leurs erreurs
const JOURNAL = "js/class/Journal.js";
// réglages de l'alliance (sujet du forum), lus par beaucoup de modules ; rien
// n'y est exécuté au chargement, il peut donc précéder Utils.js
const REGLAGES = "js/class/ReglagesAlliance.js";

export interface Page {
  window: Window;
  /** Évalue une expression dans la page (classes globales comprises). */
  lire: <T = any>(expression: string) => T;
}

/**
 * @param fichiers scripts de public/ à charger après les bibliothèques
 * @param avant code exécuté avant ces scripts (constantes et objets simulés)
 * @param url adresse de la page (serveur s5 par défaut)
 */
export function creerPage(
  fichiers: string[],
  avant = "",
  url = "https://s5.fourmizzz.fr/Armee.php",
): Page {
  const window = new Window({
    url,
    // code de confiance (celui du dépôt) : évaluation activée, sans avertissement
    settings: {
      enableJavaScriptEvaluation: true,
      suppressInsecureJavaScriptEnvironmentWarning: true,
    },
  });
  // la fenêtre est un contexte vm : les classes déclarées par un script
  // restent visibles des scripts suivants, comme dans le navigateur
  const executer = (code: string) => vm.runInContext(code, window as any);
  for (const f of BIBLIOTHEQUES) executer(readFileSync(join(PUBLIC, f), "utf8"));
  executer(`moment.locale("fr"); numeral.locale("fr");`);
  if (avant) executer(avant);
  // chargés en premier des scripts de l'extension sauf s'ils sont dans la liste
  for (const f of [...[JOURNAL, REGLAGES].filter((t) => !fichiers.includes(t)), ...fichiers])
    executer(readFileSync(join(PUBLIC, f), "utf8"));
  return { window, lire: (expression) => executer(expression) };
}
