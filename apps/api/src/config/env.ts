import { z } from 'zod';

/**
 * Schéma unique des variables d'environnement de l'API.
 *
 * C'est le **seul** endroit du code autorisé à lire `process.env`. Toute autre
 * couche consomme l'objet de configuration dérivé exposé par `config/index.ts`.
 * Un secret absent ou trop faible fait échouer le démarrage : mieux vaut un
 * serveur qui refuse de démarrer qu'un serveur qui tourne sans sécurité.
 */

/** Liste d'origines autorisées, séparées par des virgules (`http://a,https://b`). */
const originListSchema = z
  .string()
  .min(1, 'CLIENT_URL ne peut pas être vide')
  .transform((value) =>
    value
      .split(',')
      .map((origin) => origin.trim().replace(/\/+$/, ''))
      .filter((origin) => origin.length > 0),
  )
  .refine((origins) => origins.length > 0, 'Au moins une origine est requise dans CLIENT_URL')
  .refine(
    (origins) => origins.every((origin) => /^https?:\/\/[^\s/]+$/.test(origin)),
    'Chaque origine doit être une URL absolue sans chemin (ex. http://localhost:5173)',
  );

/** Durée lisible : `15m`, `30d`, `3600s`, `12h`. */
const durationSchema = z
  .string()
  .regex(/^\d+[smhd]$/i, 'Durée attendue au format 15m, 12h, 30d ou 3600s');

/**
 * Chaîne optionnelle tolérante.
 *
 * Une variable laissée vide dans `.env` (`COOKIE_DOMAIN=`) arrive comme chaîne
 * vide, pas comme `undefined` : un `.optional()` seul échouerait alors sur une
 * contrainte de longueur. Or laisser une ligne vide est le geste naturel pour
 * « non défini ». On normalise donc explicitement vers `undefined`.
 */
const optionalStringSchema = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed !== undefined && trimmed.length > 0 ? trimmed : undefined;
  });

/**
 * Valeurs d’exemple livrées dans `.env.example`. Elles ne doivent jamais
 * atteindre la production : le serveur refuse alors de démarrer.
 */
const PLACEHOLDER_SECRETS = new Set([
  'replace-with-a-long-development-secret',
  'replace-with-a-different-long-development-secret',
  'changeme',
  'secret',
]);

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    // --- Serveur ---------------------------------------------------------
    PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    /** URL publique de l'API, utilisée pour les liens absolus et les webhooks. */
    SERVER_URL: z.string().url().default('http://localhost:4000'),
    /** Derrière un reverse proxy, faire confiance à `X-Forwarded-*`. */
    TRUST_PROXY: z
      .string()
      .optional()
      .transform((value) => value === 'true'),

    // --- Base de données -------------------------------------------------
    MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/rentflow_africa'),
    MONGODB_SERVER_SELECTION_TIMEOUT_MS: z.coerce.number().int().min(100).default(5_000),

    // --- Client ----------------------------------------------------------
    /** Origine(s) autorisée(s) par CORS. Plusieurs valeurs séparées par des virgules. */
    CLIENT_URL: originListSchema.default('http://localhost:5173'),

    // --- Jetons ----------------------------------------------------------
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET doit faire au moins 32 caractères'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET doit faire au moins 32 caractères'),
    JWT_ISSUER: z.string().min(1).default('rentflow-api'),
    JWT_AUDIENCE: z.string().min(1).default('rentflow-web'),
    ACCESS_TOKEN_TTL: durationSchema.default('15m'),
    REFRESH_TOKEN_TTL: durationSchema.default('30d'),

    // --- Email delivery ---------------------------------------------------
    MAIL_HOST: optionalStringSchema,
    MAIL_PORT: z.coerce.number().int().min(1).max(65_535).default(587),
    MAIL_SECURE: z
      .string()
      .optional()
      .transform((value) => value === 'true'),
    MAIL_USER: optionalStringSchema,
    MAIL_PASSWORD: optionalStringSchema,
    MAIL_FROM: z.string().email().default('no-reply@example.com'),

    // --- Cookies ---------------------------------------------------------
    COOKIE_NAME: z.string().min(1).default('rentflow_refresh'),
    /** Laisser vide en local ; renseigner en production (ex. `.rentflow.africa`). */
    COOKIE_DOMAIN: optionalStringSchema,
    /** `true` en production : le cookie de refresh ne circule qu'en HTTPS. */
    COOKIE_SECURE: z
      .string()
      .optional()
      .transform((value) => value === 'true'),

    // --- Rate limiting ---------------------------------------------------
    RATE_LIMIT_GENERAL_WINDOW_MS: z.coerce.number().int().min(1_000).default(60_000),
    RATE_LIMIT_GENERAL_MAX: z.coerce.number().int().min(1).default(120),
    RATE_LIMIT_AUTH_WINDOW_MS: z.coerce.number().int().min(1_000).default(900_000),
    RATE_LIMIT_AUTH_MAX: z.coerce.number().int().min(1).default(10),
    RATE_LIMIT_SENSITIVE_WINDOW_MS: z.coerce.number().int().min(1_000).default(60_000),
    RATE_LIMIT_SENSITIVE_MAX: z.coerce.number().int().min(1).default(30),

    // --- Observabilité ---------------------------------------------------
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),

    // --- Assistant IA (optionnel) ----------------------------------------
    AI_API_KEY: optionalStringSchema,
    AI_MODEL: z.string().min(1).default('claude-sonnet-4-6'),

    // --- Cloudinary Storage (Photos, Certificats, Sceaux) ----------------
    CLOUDINARY_CLOUD_NAME: optionalStringSchema,
    CLOUDINARY_API_KEY: optionalStringSchema,
    CLOUDINARY_API_SECRET: optionalStringSchema,
    CLOUDINARY_FOLDER: z.string().trim().default('katdestate'),
  })
  .superRefine((value, ctx) => {
    const isProduction = value.NODE_ENV === 'production';

    if (value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_REFRESH_SECRET'],
        message:
          'JWT_REFRESH_SECRET doit être différent de JWT_ACCESS_SECRET : réutiliser la même clé permettrait de rejouer un refresh token comme access token.',
      });
    }

    if (!isProduction) return;

    // Les contrôles suivants ne s'appliquent qu'en production.
    for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
      if (PLACEHOLDER_SECRETS.has(value[key])) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} utilise encore la valeur d’exemple : remplacez-la par un secret généré aléatoirement.`,
        });
      }
    }

    if (value.COOKIE_SECURE !== true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['COOKIE_SECURE'],
        message: 'COOKIE_SECURE doit valoir true en production (cookie de refresh en HTTPS seul).',
      });
    }

    if (value.CLIENT_URL.some((origin) => !origin.startsWith('https://'))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CLIENT_URL'],
        message: 'Toutes les origines de CLIENT_URL doivent utiliser HTTPS en production.',
      });
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

/** Erreur de configuration lisible, journalisée puis fatale au démarrage. */
export class ConfigError extends Error {
  constructor(public readonly issues: readonly string[]) {
    super(`Configuration invalide :\n  - ${issues.join('\n  - ')}`);
    this.name = 'ConfigError';
  }
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new ConfigError(
      parsed.error.issues.map((issue) => {
        const path = issue.path.join('.') || '(racine)';
        return `${path} : ${issue.message}`;
      }),
    );
  }
  return parsed.data;
}
