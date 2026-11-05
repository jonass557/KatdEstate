import type { Permission } from '@rentflow/shared';
import type { RequestHandler } from 'express';
import { AppError } from '../common/errors.js';

export function requirePermission(permission: Permission): RequestHandler {
  return (req, _res, next) => {
    // Le propriétaire, le super administrateur et l'administrateur ont plein pouvoir sans restriction
    if (
      req.user?.platformRole === 'SUPER_ADMIN' ||
      req.organizationContext?.role === 'OWNER' ||
      req.organizationContext?.role === 'ADMIN'
    ) {
      next();
      return;
    }
    if (!req.organizationContext?.permissions.includes(permission)) {
      next(new AppError('FORBIDDEN', 'Permission insuffisante.', 403));
      return;
    }
    next();
  };
}
