import { parseDurationSeconds } from '../common/tokens.js';
import { loadEnv, type AppEnv } from './env.js';

export { ConfigError, loadEnv } from './env.js';
export type { AppEnv } from './env.js';

/** Politique de limitation de débit, appliquée par `middleware/rate-limiters.ts`. */
export interface RateLimitPolicy {
  readonly windowMs: number;
  readonly max: number;
}

/**
 * Configuration applicative dérivée et **gelée**.
 *
 * Les couches métier (app, sockets, modules) ne reçoivent que cet objet : elles
 * n'accèdent jamais à `process.env` et ne peuvent donc pas lire une variable non
 * validée. L'objet est gelé en profondeur pour éviter toute mutation accidentelle
 * en cours d'exécution.
 */
export interface AppConfig {
  readonly nodeEnv: AppEnv['NODE_ENV'];
  readonly isProduction: boolean;
  readonly isDevelopment: boolean;
  readonly isTest: boolean;

  readonly server: {
    readonly port: number;
    readonly url: string;
    readonly trustProxy: boolean;
  };

  readonly client: {
    /** Allowlist CORS. Le premier élément sert d'origine de repli pour les redirections. */
    readonly origins: readonly string[];
    readonly primaryOrigin: string;
  };

  readonly database: {
    readonly uri: string;
    readonly serverSelectionTimeoutMs: number;
  };

  readonly tokens: {
    readonly accessSecret: string;
    readonly refreshSecret: string;
    readonly issuer: string;
    readonly audience: string;
    readonly accessTtl: string;
    readonly refreshTtl: string;
  };

  readonly mail: {
    readonly host: string | undefined;
    readonly port: number;
    readonly secure: boolean;
    readonly user: string | undefined;
    readonly password: string | undefined;
    readonly from: string;
  };

  readonly cookie: {
    readonly name: string;
    readonly secure: boolean;
    readonly domain: string | undefined;
    /** Durée de vie du cookie de refresh, en millisecondes. */
    readonly maxAgeMs: number;
  };

  readonly rateLimit: {
    readonly general: RateLimitPolicy;
    readonly auth: RateLimitPolicy;
    readonly sensitive: RateLimitPolicy;
  };

  readonly logging: {
    readonly level: AppEnv['LOG_LEVEL'];
  };

  /** Absent tant qu'aucune clé n'est configurée : l'assistant répond alors qu'il n'est pas actif. */
  readonly ai?: {
    readonly apiKey: string;
    readonly model: string;
  };

  /** Configuration Cloudinary pour le stockage sécurisé des médias, certificats et sceaux. */
  readonly cloudinary?: {
    readonly cloudName: string;
    readonly apiKey: string;
    readonly apiSecret: string;
    readonly folder: string;
  };
}

function freezeConfig(config: AppConfig): AppConfig {
  const deepFreeze = <T>(value: T): T => {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.freeze(value);
      for (const nested of Object.values(value as Record<string, unknown>)) {
        deepFreeze(nested);
      }
    }
    return value;
  };
  return deepFreeze(config);
}

export function createConfig(env: AppEnv): AppConfig {
  const primaryOrigin = env.CLIENT_URL[0] ?? 'http://localhost:5173';

  const config: AppConfig = {
    nodeEnv: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    isDevelopment: env.NODE_ENV === 'development',
    isTest: env.NODE_ENV === 'test',

    server: {
      port: env.PORT,
      url: env.SERVER_URL.replace(/\/+$/, ''),
      trustProxy: env.TRUST_PROXY,
    },

    client: {
      origins: env.CLIENT_URL,
      primaryOrigin,
    },

    database: {
      uri: env.MONGODB_URI,
      serverSelectionTimeoutMs: env.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
    },

    tokens: {
      accessSecret: env.JWT_ACCESS_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      accessTtl: env.ACCESS_TOKEN_TTL,
      refreshTtl: env.REFRESH_TOKEN_TTL,
    },

    mail: {
      host: env.MAIL_HOST,
      port: env.MAIL_PORT,
      secure: env.MAIL_SECURE,
      user: env.MAIL_USER,
      password: env.MAIL_PASSWORD,
      from: env.MAIL_FROM,
    },

    cookie: {
      name: env.COOKIE_NAME,
      secure: env.COOKIE_SECURE,
      domain: env.COOKIE_DOMAIN,
      maxAgeMs: parseDurationSeconds(env.REFRESH_TOKEN_TTL) * 1_000,
    },

    rateLimit: {
      general: { windowMs: env.RATE_LIMIT_GENERAL_WINDOW_MS, max: env.RATE_LIMIT_GENERAL_MAX },
      auth: { windowMs: env.RATE_LIMIT_AUTH_WINDOW_MS, max: env.RATE_LIMIT_AUTH_MAX },
      sensitive: {
        windowMs: env.RATE_LIMIT_SENSITIVE_WINDOW_MS,
        max: env.RATE_LIMIT_SENSITIVE_MAX,
      },
    },

    logging: {
      level: env.LOG_LEVEL,
    },

    ...(env.AI_API_KEY ? { ai: { apiKey: env.AI_API_KEY, model: env.AI_MODEL } } : {}),

    ...(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
      ? {
          cloudinary: {
            cloudName: env.CLOUDINARY_CLOUD_NAME,
            apiKey: env.CLOUDINARY_API_KEY,
            apiSecret: env.CLOUDINARY_API_SECRET,
            folder: env.CLOUDINARY_FOLDER,
          },
        }
      : {}),
  };

  return freezeConfig(config);
}

/** Point d'entrée unique : lit l'environnement, valide, puis dérive la config. */
export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  return createConfig(loadEnv(source));
}
