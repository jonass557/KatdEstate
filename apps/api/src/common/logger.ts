import { randomUUID } from 'node:crypto';
import pino from 'pino';
import { pinoHttp } from 'pino-http';
import type { AppConfig } from '../config/index.js';

/**
 * Journalisation structurée (Pino).
 *
 * Les secrets ne doivent jamais atteindre les journaux : la liste `redact`
 * couvre les en-têtes d'authentification, les cookies, les champs de mot de
 * passe et les jetons, y compris imbriqués. Toute nouvelle donnée sensible doit
 * être ajoutée ici **et** couverte par un test.
 */
const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'password',
  'passwordHash',
  'newPassword',
  'currentPassword',
  'token',
  'accessToken',
  'refreshToken',
  'tokenHash',
  'secret',
  'apiKey',
  '*.password',
  '*.passwordHash',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.tokenHash',
  '*.secret',
  '*.apiKey',
];

export function createLogger(config: AppConfig) {
  return pino({
    level: config.logging.level,
    // Sortie JSON structurée, sans dépendance de transport : un transport
    // optionnel peut faire échouer le démarrage s'il n'est pas installé. Pour
    // des logs lisibles en développement, utiliser `npm run api:dev:pretty`.
    redact: { paths: REDACTED_PATHS, censor: '[REDACTED]' },
    base: { service: 'rentflow-api', env: config.nodeEnv },
  });
}

export type AppLogger = ReturnType<typeof createLogger>;

export function createRequestLogger(config: AppConfig, logger = createLogger(config)) {
  return pinoHttp({
    logger,
    // Un identifiant de corrélation unique relie log applicatif, réponse HTTP et
    // éventuel signalement utilisateur. `requestId` est posé en amont par
    // `middleware/request-id.ts` ; le repli couvre un usage isolé du logger.
    genReqId: (req) => (req as { requestId?: string }).requestId ?? randomUUID(),
    customLogLevel: (_req, res, error) => {
      if (error || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customSuccessMessage: (req, res) => `${req.method} ${fullUrl(req)} → ${res.statusCode}`,
    serializers: {
      req: (req) => ({ method: req.method, url: fullUrl(req), id: req.id }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  });
}

/**
 * Express retire le préfixe de montage de `req.url` : pour une route servie sous
 * `/api/health`, le log afficherait `/live`. `originalUrl` conserve le chemin
 * réellement demandé, ce qui est indispensable pour corréler avec un signalement
 * utilisateur ou une trace de reverse proxy.
 */
function fullUrl(req: { originalUrl?: string | undefined; url?: string | undefined }): string {
  return req.originalUrl ?? req.url ?? '/';
}
