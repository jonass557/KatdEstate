import type { RequestHandler } from 'express';
import { AuditLog } from '../models/identity.js';

/** Persists a minimal append-only audit record after a sensitive request finishes. */
export const audit: RequestHandler = (req, res, next) => {
  res.once('finish', () => {
    const context = req.organizationContext;
    void AuditLog.create({
      ...(context ? { organizationId: context.organizationId } : {}),
      ...(req.user?.id ? { actorId: req.user.id } : {}),
      action: `${req.method.toLowerCase()} ${req.baseUrl}${req.path}`.slice(0, 120),
      resourceType: 'HTTP',
      resourceId: req.params.organizationId,
      result: res.statusCode < 400 ? 'SUCCESS' : 'FAILURE',
      requestId: req.requestId,
    }).catch(() => undefined);
  });
  next();
};
