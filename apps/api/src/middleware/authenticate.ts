import type { RequestHandler } from 'express';
import { AppError } from '../common/errors.js';
import { verifyAccessToken } from '../common/tokens.js';
import type { AppConfig } from '../config/index.js';
import { Session, User } from '../models/identity.js';

export function createAuthenticate(config: AppConfig): RequestHandler {
  return async (req, _res, next) => {
    try {
      const header = req.header('Authorization');
      const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined;
      if (!token) throw new AppError('UNAUTHENTICATED', 'Authentification requise.', 401);
      const claims = verifyAccessToken(token, config.tokens);
      const session = await Session.findOne({
        _id: claims.sid,
        userId: claims.sub,
        jti: claims.jti,
        revokedAt: { $exists: false },
        expiresAt: { $gt: new Date() },
      }).lean();
      if (!session) throw new AppError('UNAUTHENTICATED', 'Session invalide ou expirée.', 401);
      const user = await User.findOne({ _id: claims.sub, status: 'ACTIVE' }).lean();
      if (!user) throw new AppError('UNAUTHENTICATED', 'Session invalide ou expirée.', 401);
      req.user = { id: String(user._id), roles: user.platformRole ? [user.platformRole] : [] };
      req.sessionId = String(session._id);
      next();
    } catch (error) {
      next(
        error instanceof AppError
          ? error
          : new AppError('UNAUTHENTICATED', 'Authentification requise.', 401),
      );
    }
  };
}

export const authenticate: RequestHandler = (_req, _res, next) =>
  next(new AppError('UNAUTHENTICATED', 'Authentification requise.', 401));
