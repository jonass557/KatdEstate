import mongoose from 'mongoose';
import dns from 'node:dns';

/**
 * Configuration DNS pour MongoDB+SRV en environnement local/Windows.
 * Les résolveurs par défaut de certaines box internet échouent sur les requêtes SRV Atlas.
 */
if (process.platform === 'win32') {
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
  } catch {
    // Ignore si non supporté
  }
}

/**
 * Connexion MongoDB.
 *
 * Le cycle de vie est volontairement minimal : connexion, déconnexion, état et
 * un `ping` réel utilisé par le health check. Un health check qui se contente de
 * lire `readyState` mentirait si le serveur Mongo est devenu injoignable après
 * la connexion initiale — d'où l'aller-retour effectif vers la base.
 */

/** Libellés lisibles des états de connexion Mongoose. */
const READY_STATES: Record<number, string> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
  99: 'uninitialized',
};

export interface DatabaseStatus {
  /** Vrai uniquement si un `ping` a abouti. */
  connected: boolean;
  /** État déclaré par Mongoose (`connected`, `connecting`, …). */
  state: string;
  /** Aller-retour mesuré, en millisecondes. */
  latencyMs?: number;
  /** Message d'erreur lisible, sans détail interne sensible. */
  error?: string;
}

export interface ConnectDatabaseOptions {
  uri: string;
  serverSelectionTimeoutMs?: number;
}

export async function connectDatabase(options: ConnectDatabaseOptions): Promise<void> {
  mongoose.set('strictQuery', true);

  await mongoose.connect(options.uri, {
    serverSelectionTimeoutMS: options.serverSelectionTimeoutMs ?? 5_000,
    // Les index sont créés explicitement par les modèles concernés, jamais
    // implicitement au démarrage : cela évite des créations inattendues.
    autoIndex: false,
  });
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === 1;
}

export function getDatabaseState(): string {
  return READY_STATES[mongoose.connection.readyState] ?? 'unknown';
}

/**
 * Vérifie la base par un `ping` réel, borné dans le temps.
 * Ne lève jamais : l'appelant reçoit un statut exploitable dans tous les cas.
 */
export async function pingDatabase(timeoutMs = 1_500): Promise<DatabaseStatus> {
  const state = getDatabaseState();

  if (mongoose.connection.readyState !== 1) {
    return { connected: false, state };
  }

  const database = mongoose.connection.db;
  if (!database) {
    return { connected: false, state, error: 'Connexion sans handle de base de données.' };
  }

  const startedAt = Date.now();
  try {
    await Promise.race([
      database.admin().command({ ping: 1 }),
      new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error('timeout')), timeoutMs).unref(),
      ),
    ]);

    return { connected: true, state, latencyMs: Date.now() - startedAt };
  } catch (error) {
    return {
      connected: false,
      state,
      latencyMs: Date.now() - startedAt,
      error:
        error instanceof Error && error.message === 'timeout' ? 'Délai dépassé.' : 'Ping échoué.',
    };
  }
}
