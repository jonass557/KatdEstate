import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { AccessTokenClaims } from '@rentflow/shared';
import { AppError } from './errors.js';

export interface TokenConfig {
  accessSecret: string;
  refreshSecret: string;
  issuer: string;
  audience: string;
  accessTtl: string;
  refreshTtl: string;
}

const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3_600, d: 86_400 };

/**
 * Convertit une durée lisible (`15m`, `30d`, `3600s`) en secondes.
 * Volontairement strict : toute valeur non reconnue est une erreur de configuration.
 */
export function parseDurationSeconds(value: string): number {
  const match = /^(\d+)([smhd])$/i.exec(value.trim());
  if (!match) {
    throw new Error(`Durée invalide : « ${value} » (attendu : 15m, 30d, 3600s…)`);
  }
  const amount = Number(match[1]);
  const unitSeconds = UNIT_SECONDS[(match[2] ?? '').toLowerCase()] ?? 0;
  if (!Number.isFinite(amount) || amount <= 0 || unitSeconds === 0) {
    throw new Error(`Durée invalide : « ${value} »`);
  }
  return amount * unitSeconds;
}

export interface IssuedAccessToken {
  token: string;
  expiresIn: number;
}

/**
 * Access token JWT court. Les claims portent l'utilisateur (`sub`), le token
 * (`jti`) et la session (`sid`) afin de pouvoir révoquer une session entière.
 */
export function signAccessToken(
  input: { userId: string; sessionId: string; jti: string },
  config: TokenConfig,
): IssuedAccessToken {
  const expiresIn = parseDurationSeconds(config.accessTtl);
  const token = jwt.sign({ sid: input.sessionId }, config.accessSecret, {
    subject: input.userId,
    jwtid: input.jti,
    issuer: config.issuer,
    audience: config.audience,
    algorithm: 'HS256',
    expiresIn,
  });
  return { token, expiresIn };
}

/**
 * Vérifie un access token : signature, algorithme, issuer, audience et expiration.
 * Toute anomalie devient un 401 uniforme — aucune information interne n'est exposée.
 */
export function verifyAccessToken(token: string, config: TokenConfig): AccessTokenClaims {
  try {
    const payload = jwt.verify(token, config.accessSecret, {
      issuer: config.issuer,
      audience: config.audience,
      algorithms: ['HS256'],
    });

    if (
      typeof payload === 'string' ||
      typeof payload.sub !== 'string' ||
      typeof payload.jti !== 'string' ||
      typeof payload.sid !== 'string'
    ) {
      throw new Error('Claims manquants');
    }

    return { sub: payload.sub, jti: payload.jti, sid: payload.sid };
  } catch {
    throw new AppError('UNAUTHENTICATED', 'Jeton d’accès invalide ou expiré.', 401);
  }
}

export interface GeneratedRefreshToken {
  /** Valeur en clair : transmise une seule fois, jamais persistée. */
  token: string;
  /** Empreinte SHA-256 persistée en base. */
  tokenHash: string;
}

/**
 * Refresh token opaque de 256 bits d'entropie.
 * Il n'est jamais stocké en clair : seule son empreinte SHA-256 est conservée.
 * Un SHA-256 suffit ici (contrairement à un mot de passe) car la valeur est
 * aléatoire et à haute entropie, donc non attaquable par dictionnaire.
 */
export function generateRefreshToken(): GeneratedRefreshToken {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashRefreshToken(token) };
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function refreshTokenExpiry(config: TokenConfig, from: Date = new Date()): Date {
  return new Date(from.getTime() + parseDurationSeconds(config.refreshTtl) * 1_000);
}
