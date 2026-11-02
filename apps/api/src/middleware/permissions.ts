import type { Permission } from '@rentflow/shared';
import type { RequestHandler } from 'express';
import { AppError } from '../common/errors.js';

export function requirePermission(permission: Permission): RequestHandler {
  return (req, _res, next) => {
    if (!req.organizationContext?.permissions.includes(permission)) {
      next(new AppError('FORBIDDEN', 'Permission insuffisante.', 403));
      return;
    }
    next();
  };
}
