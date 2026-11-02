import type { RequestHandler } from 'express';
import { isPermission, resolvePermissions, type Permission } from '@rentflow/shared';
import { AppError } from '../common/errors.js';
import { Membership, Organization } from '../models/identity.js';

export const requireOrganizationMembership: RequestHandler = async (req, _res, next) => {
  try {
    const organizationId = Array.isArray(req.params.organizationId)
      ? req.params.organizationId[0]
      : req.params.organizationId;
    if (!req.user || !organizationId) {
      throw new AppError('UNAUTHENTICATED', 'Authentification requise.', 401);
    }

    const organization = await Organization.findOne({ _id: organizationId, status: 'ACTIVE' }).select('_id').lean();
    const membership = await Membership.findOne({
      organizationId,
      userId: req.user.id,
      status: 'ACTIVE',
    }).lean();

    if (!organization || !membership) {
      throw new AppError('FORBIDDEN', 'Accès refusé.', 403);
    }

    const granted = (membership.grantedPermissions ?? []).filter(isPermission) as Permission[];
    const revoked = (membership.revokedPermissions ?? []).filter(isPermission) as Permission[];
    req.organizationContext = {
      organizationId,
      role: membership.role,
      permissions: resolvePermissions(membership.role, { granted, revoked }),
    };
    next();
  } catch (error) {
    next(error);
  }
};
