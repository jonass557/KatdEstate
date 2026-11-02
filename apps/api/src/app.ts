import express from 'express';
import type { Express } from 'express';
import type { AppConfig } from './config/index.js';
import { createLogger, createRequestLogger } from './common/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFound } from './middleware/not-found.js';
import { requestId } from './middleware/request-id.js';
import { createSecurityMiddleware } from './middleware/security.js';
import { healthRouter } from './modules/health/health.routes.js';
import { createApiRouter } from './routes/index.js';

/**
 * Construit l'application Express sans ouvrir de port.
 *
 * Cette séparation permet aux tests d'exercer l'application complète via
 * Supertest, sans serveur HTTP ni base de données. L'ordre des middlewares est
 * significatif et documenté ci-dessous.
 */
export function createApp(config: AppConfig): Express {
  const app = express();
  const security = createSecurityMiddleware(config);
  const logger = createLogger(config);

  // Aucun en-tête révélant la stack technique.
  app.disable('x-powered-by');

  // Derrière un reverse proxy (Nginx, Traefik, PaaS), faire confiance au premier
  // hop est nécessaire pour que `req.ip` et `secure` reflètent la vraie requête.
  if (config.server.trustProxy) {
    app.set('trust proxy', 1);
  }

  // 1. Corrélation : chaque requête reçoit un identifiant avant toute chose.
  app.use(requestId);

  // 2. Journalisation structurée, rattachée à cet identifiant.
  app.use(createRequestLogger(config, logger));

  // 3. Corps JSON borné (protection mémoire).
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  // 4. Assainissement des entrées avant qu'un contrôleur ne les voie.
  app.use(security.mongoSanitize);

  // 5. En-têtes de sécurité, CORS, puis quota global.
  app.use(security.helmet);
  app.use(security.cors);
  app.use(security.rateLimit.general);

  // 6. Sondes d'infrastructure, hors versionnement : leur contrat est stable et
  //    indépendant de l'API métier.
  app.use('/api/health', healthRouter);

  // 7. API métier versionnée. `/api/v1/health` reste exposé comme alias
  //    documenté dans ARCHITECTURE.md.
  app.use('/api/v1', createApiRouter(config));

  // 8. Terminaison : 404 puis gestionnaire d'erreur, toujours en dernier.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
