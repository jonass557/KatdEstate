import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Chargement des fichiers `.env`.
 *
 * Node 22 fournit `process.loadEnvFile()`, ce qui évite d'ajouter `dotenv` : une
 * dépendance de moins dans le chemin de démarrage, donc un risque de panne en
 * moins.
 *
 * Plusieurs emplacements sont essayés, du plus proche au plus éloigné, car le
 * serveur peut être lancé depuis la racine du monorepo (`npm run dev`) ou depuis
 * `apps/api` (`npm run dev --workspace @rentflow/api`). Les variables déjà
 * définies dans l'environnement ne sont **jamais** écrasées : en production, ce
 * sont les variables injectées par la plateforme qui font foi.
 */
const CANDIDATE_PATHS = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../.env'),
  resolve(process.cwd(), '../.env'),
];

export function loadDotEnvFiles(): readonly string[] {
  const loaded: string[] = [];

  for (const path of CANDIDATE_PATHS) {
    if (!existsSync(path) || loaded.includes(path)) continue;

    try {
      process.loadEnvFile(path);
      loaded.push(path);
    } catch {
      // Un fichier illisible ou mal encodé ne doit pas empêcher le démarrage :
      // la validation de configuration signalera les variables manquantes.
    }
  }

  return loaded;
}
