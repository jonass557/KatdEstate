import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import type { Request, Response } from 'express';
import type { AppConfig } from '../config/index.js';
import { sendError } from '../common/http.js';

/**
 * Source unique de vérité pour la limitation de débit.
 *
 * Toutes les politiques vivent ici afin d'être relues en un seul endroit plutôt
 * que redéfinies au fil des modules. Les routes d'authentification reçoivent un
 * budget nettement plus strict que la surface API générale.
 */

function createLimiter(policy: { windowMs: number; max: number }): RateLimitRequestHandler {
  return rateLimit({
    windowMs: policy.windowMs,
    limit: policy.max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Réponse uniforme : un client ne doit pas pouvoir distinguer un refus de
    // quota d'une autre erreur applicative.
    handler: (_req: Request, res: Response) => {
      sendError(res, {
        code: 'RATE_LIMITED',
        message: 'Trop de requêtes. Merci de réessayer dans quelques instants.',
        statusCode: 429,
      });
    },
  });
}

export interface RateLimiters {
  readonly general: RateLimitRequestHandler;
  readonly auth: RateLimitRequestHandler;
  readonly sensitive: RateLimitRequestHandler;
}

/**
 * Les limiteurs sont instanciés une fois par processus : ils portent un compteur
 * en mémoire, partagé par toutes les requêtes.
 */
export function createRateLimiters(config: AppConfig): RateLimiters {
  return {
    general: createLimiter(config.rateLimit.general),
    auth: createLimiter(config.rateLimit.auth),
    sensitive: createLimiter(config.rateLimit.sensitive),
  };
}
