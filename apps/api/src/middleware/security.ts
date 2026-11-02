import cors from 'cors';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import type { AppConfig } from '../config/index.js';
import { createRateLimiters } from './rate-limiters.js';

/**
 * Pile de sécurité HTTP centralisée.
 *
 * Toutes les protections transverses sont assemblées ici, dans un ordre
 * volontaire : le rate limiting général arrive après CORS pour qu'une origine
 * refusée ne consomme pas le quota d'un autre client.
 *
 * CORS utilise une **allowlist explicite** : `Access-Control-Allow-Origin` n'est
 * reflété que pour une origine approuvée. Une origine unique passée telle quelle
 * serait renvoyée à tout le monde, ce qui revient à désactiver CORS.
 */
export function createSecurityMiddleware(config: AppConfig) {
  const allowedOrigins = [...config.client.origins];
  const limiters = createRateLimiters(config);

  return {
    helmet: helmet({
      // L'API ne sert que du JSON : aucune ressource embarquable n'est attendue.
      crossOriginResourcePolicy: { policy: 'same-site' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      referrerPolicy: { policy: 'no-referrer' },
    }),

    cors: cors({
      origin: (origin, callback) => {
        // Requêtes sans en-tête Origin : outils serveur, health checks, curl.
        // Aucun cookie n'y est envoyé, l'accès reste donc sans état.
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id'],
      maxAge: 600,
    }),

    mongoSanitize: mongoSanitize({
      // Remplace les clés interdites au lieu de lever une erreur : les
      // contrôleurs reçoivent une entrée assainie, jamais un opérateur Mongo.
      replaceWith: '_',
    }),

    rateLimit: limiters,
  };
}
