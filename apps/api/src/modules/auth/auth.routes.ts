import { Router, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import { changePasswordSchema, emailVerificationSchema, loginSchema, passwordResetRequestSchema, passwordResetSchema, refreshTokenSchema, registerSchema } from '@rentflow/shared';
import type { AppConfig } from '../../config/index.js';
import { AppError } from '../../common/errors.js';
import { sendSuccess } from '../../common/http.js';
import { createAuthenticate } from '../../middleware/authenticate.js';
import { validateRequest } from '../../middleware/validate-request.js';
import { changePassword, getSession, login, logout, refresh, register, requestPasswordReset, resetPassword, verifyEmail } from './auth.service.js';
import { createRateLimiters } from '../../middleware/rate-limiters.js';
import { audit } from '../../middleware/audit.js';

export function createAuthRouter(config: AppConfig) {
  const router = Router();
  router.use(cookieParser());
  const authenticate = createAuthenticate(config);
  const rateLimiters = createRateLimiters(config);
  router.use(rateLimiters.auth);
  const cookieOptions = { httpOnly: true, secure: config.cookie.secure, sameSite: 'lax' as const, maxAge: config.cookie.maxAgeMs, ...(config.cookie.domain ? { domain: config.cookie.domain } : {}) };
  const metadata = (req: Request) => ({
    ...(req.get('user-agent') ? { userAgent: req.get('user-agent') as string } : {}),
    ...(req.ip ? { ip: req.ip } : {}),
    requestId: req.requestId,
  });
  const setCookie = (res: Response, token: string) => res.cookie(config.cookie.name, token, cookieOptions);

  router.post('/register', audit, validateRequest(registerSchema), async (req, res, next) => { try { const result = await register(req.body, config, metadata(req)); setCookie(res, result.refreshToken); sendSuccess(res, { accessToken: result.accessToken, expiresIn: result.expiresIn }, { statusCode: 201 }); } catch (error) { next(error); } });
  router.post('/login', audit, validateRequest(loginSchema), async (req, res, next) => { try { const result = await login(req.body, config, metadata(req)); setCookie(res, result.refreshToken); sendSuccess(res, { accessToken: result.accessToken, expiresIn: result.expiresIn }); } catch (error) { next(error); } });
  router.post('/refresh', validateRequest(refreshTokenSchema), async (req, res, next) => { try { const token = req.cookies?.[config.cookie.name] ?? req.body.refreshToken; if (!token) throw new AppError('UNAUTHENTICATED', 'Session invalide ou expirée.', 401); const result = await refresh(token, config, metadata(req)); setCookie(res, result.refreshToken); sendSuccess(res, { accessToken: result.accessToken, expiresIn: result.expiresIn }); } catch (error) { next(error); } });
  router.post('/logout', authenticate, async (req, res, next) => { try { if (req.sessionId) await logout(req.sessionId); res.clearCookie(config.cookie.name, cookieOptions); sendSuccess(res, null); } catch (error) { next(error); } });
  router.get('/me', authenticate, async (req, res, next) => { try { sendSuccess(res, await getSession(req.user!.id)); } catch (error) { next(error); } });
  router.post('/request-password-reset', rateLimiters.sensitive, validateRequest(passwordResetRequestSchema), async (req, res, next) => { try { await requestPasswordReset(req.body.email, config); sendSuccess(res, { message: 'Si un compte correspond, un lien sera envoyé.' }); } catch (error) { next(error); } });
  router.post('/reset-password', rateLimiters.sensitive, validateRequest(passwordResetSchema), async (req, res, next) => { try { await resetPassword(req.body.token, req.body.password); sendSuccess(res, { message: 'Mot de passe réinitialisé.' }); } catch (error) { next(error); } });
  router.post('/change-password', authenticate, rateLimiters.sensitive, validateRequest(changePasswordSchema), async (req, res, next) => { try { await changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword); sendSuccess(res, { message: 'Mot de passe modifié avec succès.' }); } catch (error) { next(error); } });
  router.post('/verify-email', rateLimiters.sensitive, validateRequest(emailVerificationSchema), async (req, res, next) => { try { await verifyEmail(req.body.token); sendSuccess(res, { message: 'Adresse email vérifiée.' }); } catch (error) { next(error); } });
  return router;
}
