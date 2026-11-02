import { Router } from 'express';
import {
  createOrganizationSchema,
  inviteMemberSchema,
  objectIdSchema,
  updateMemberSchema,
  updateOrganizationSchema,
} from '@rentflow/shared';
import { z } from 'zod';
import type { AppConfig } from '../../config/index.js';
import { sendSuccess } from '../../common/http.js';
import { createAuthenticate } from '../../middleware/authenticate.js';
import { requireOrganizationMembership } from '../../middleware/organization.js';
import { requirePermission } from '../../middleware/permissions.js';
import { validateRequest } from '../../middleware/validate-request.js';
import * as service from './organizations.service.js';

function respond(handler: (req: import('express').Request, res: import('express').Response) => Promise<void>) {
  return (req: import('express').Request, res: import('express').Response, next: (error: unknown) => void) => {
    handler(req, res)
      .then(() => {
        if (!res.headersSent) sendSuccess(res, res.locals.data, { statusCode: res.statusCode });
      })
      .catch(next);
  };
}

export function createOrganizationsRouter(config: AppConfig) {
  const router = Router();
  const authenticate = createAuthenticate(config);

  // User-level organization endpoints
  router.get('/', authenticate, respond(service.listUserOrganizations));
  router.post('/', authenticate, validateRequest(createOrganizationSchema), respond(service.createOrganization));

  // Tenant-scoped organization management
  router.get(
    '/:organizationId',
    authenticate,
    requireOrganizationMembership,
    requirePermission('organizations.view'),
    respond(service.getOrganization),
  );

  router.patch(
    '/:organizationId',
    authenticate,
    requireOrganizationMembership,
    requirePermission('organizations.update'),
    validateRequest(updateOrganizationSchema),
    respond(service.updateOrganization),
  );

  // Members management
  router.get(
    '/:organizationId/members',
    authenticate,
    requireOrganizationMembership,
    requirePermission('users.view'),
    respond(service.listMembers),
  );

  router.post(
    '/:organizationId/members',
    authenticate,
    requireOrganizationMembership,
    requirePermission('users.invite'),
    validateRequest(inviteMemberSchema),
    respond(service.inviteMember),
  );

  router.patch(
    '/:organizationId/members/:memberId',
    authenticate,
    requireOrganizationMembership,
    requirePermission('users.manage'),
    validateRequest(z.object({ memberId: objectIdSchema }), 'params'),
    validateRequest(updateMemberSchema),
    respond(service.updateMember),
  );

  router.delete(
    '/:organizationId/members/:memberId',
    authenticate,
    requireOrganizationMembership,
    requirePermission('users.remove'),
    validateRequest(z.object({ memberId: objectIdSchema }), 'params'),
    respond(service.removeMember),
  );

  return router;
}
