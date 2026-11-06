import { Router } from 'express';
import { getDatabaseState, pingDatabase } from '../../db/connection.js';
import { sendError, sendSuccess } from '../../common/http.js';

/**
 * Sondes d'infrastructure.
 *
 * Trois niveaux, volontairement distincts :
 * - `/health/live`  : le processus répond. Ne touche à aucune dépendance, donc
 *   jamais utilisé pour retirer une instance du load balancer.
 * - `/health/ready` : l'instance peut servir du trafic (base joignable).
 * - `/health`       : vue d'ensemble lisible par un humain comme par un outil.
 *
 * Le health check effectue un `ping` réel vers MongoDB : lire `readyState`
 * seul renverrait « ok » alors que la base est devenue injoignable.
 */

const startedAt = Date.now();

export const healthRouter = Router();

healthRouter.get('/live', (_req, res) => {
  sendSuccess(res, {
    status: 'ok',
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1_000),
    timestamp: new Date().toISOString(),
  });
});

healthRouter.get('/ready', async (_req, res) => {
  const database = await pingDatabase();

  if (!database.connected) {
    sendError(res, {
      code: 'SERVICE_UNAVAILABLE',
      message: 'Le service n’est pas prêt : base de données injoignable.',
      statusCode: 503,
      details: [{ path: 'database', message: database.error ?? 'Connexion indisponible.' }],
    });
    return;
  }

  sendSuccess(res, { status: 'ready', dependencies: { database } });
});

healthRouter.get('/', async (_req, res) => {
  const database = await pingDatabase();

  sendSuccess(res, {
    status: database.connected ? 'ok' : 'degraded',
    service: 'katdestate-api',
    version: process.env.npm_package_version ?? '0.1.0',
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1_000),
    timestamp: new Date().toISOString(),
    dependencies: {
      database: {
        ...database,
        state: getDatabaseState(),
      },
    },
  });
});
