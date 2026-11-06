import { Router } from 'express';
import {
  leaseInputSchema,
  leaseListQuerySchema,
  leaseTerminateSchema,
  objectIdSchema,
  tenantInputSchema,
  tenantListQuerySchema,
  tenantUpdateSchema,
} from '@rentflow/shared';
import { z } from 'zod';
import type { AppConfig } from '../../config/index.js';
import { sendSuccess } from '../../common/http.js';
import { createAuthenticate } from '../../middleware/authenticate.js';
import { requireOrganizationMembership } from '../../middleware/organization.js';
import { requirePermission } from '../../middleware/permissions.js';
import { validateRequest } from '../../middleware/validate-request.js';
import {
  createTenantHandlers,
  activateLease,
  createLease,
  getLease,
  leasePdf,
  leaseTimeline,
  listLeases,
  renewLease,
  requestSignature,
  terminateLease,
} from './leases.service.js';

const idParams = z.object({ id: objectIdSchema });
const renewSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  rentAmountMinor: z.number().int().nonnegative().optional(),
});

function respond(
  handler: (req: import('express').Request, res: import('express').Response) => Promise<void>,
) {
  return (
    req: import('express').Request,
    res: import('express').Response,
    next: (error: unknown) => void,
  ) => {
    handler(req, res)
      .then(() => {
        if (!res.headersSent)
          sendSuccess(res, res.locals.data, { statusCode: res.statusCode, meta: res.locals.meta });
      })
      .catch(next);
  };
}

export function createLeaseRouter(config: AppConfig) {
  const router = Router({ mergeParams: true });
  const tenants = createTenantHandlers(config);
  router.use(createAuthenticate(config), requireOrganizationMembership);

  router.get(
    '/tenants',
    requirePermission('tenants.view'),
    validateRequest(tenantListQuerySchema, 'query'),
    respond(tenants.list),
  );
  router.post(
    '/tenants',
    requirePermission('tenants.create'),
    validateRequest(tenantInputSchema),
    respond(tenants.create),
  );
  router.get(
    '/tenants/:id',
    requirePermission('tenants.view'),
    validateRequest(idParams, 'params'),
    respond(tenants.get),
  );
  router.get(
    '/tenants/:id/timeline',
    requirePermission('tenants.view'),
    validateRequest(idParams, 'params'),
    respond(tenants.timeline),
  );
  router.patch(
    '/tenants/:id',
    requirePermission('tenants.update'),
    validateRequest(idParams, 'params'),
    validateRequest(tenantUpdateSchema),
    respond(tenants.update),
  );
  router.delete(
    '/tenants/:id',
    requirePermission('tenants.delete'),
    validateRequest(idParams, 'params'),
    respond(tenants.remove),
  );

  router.get(
    '/leases',
    requirePermission('leases.view'),
    validateRequest(leaseListQuerySchema, 'query'),
    respond(listLeases),
  );
  router.post(
    '/leases',
    requirePermission('leases.create'),
    validateRequest(leaseInputSchema),
    respond(createLease),
  );
  router.get(
    '/leases/:id',
    requirePermission('leases.view'),
    validateRequest(idParams, 'params'),
    respond(getLease),
  );
  router.get(
    '/leases/:id/timeline',
    requirePermission('leases.view'),
    validateRequest(idParams, 'params'),
    respond(leaseTimeline),
  );
  router.get(
    '/leases/:id/pdf',
    requirePermission('leases.view'),
    validateRequest(idParams, 'params'),
    (req, res, next) => {
      leasePdf(req, res).catch(next);
    },
  );
  router.post(
    '/leases/:id/activate',
    requirePermission('leases.update'),
    validateRequest(idParams, 'params'),
    respond(activateLease),
  );
  router.post(
    '/leases/:id/renew',
    requirePermission('leases.create'),
    validateRequest(idParams, 'params'),
    validateRequest(renewSchema),
    respond(renewLease),
  );
  router.post(
    '/leases/:id/terminate',
    requirePermission('leases.terminate'),
    validateRequest(idParams, 'params'),
    validateRequest(leaseTerminateSchema),
    respond(terminateLease),
  );
  router.post(
    '/leases/:id/signature',
    requirePermission('leases.update'),
    validateRequest(idParams, 'params'),
    respond(requestSignature),
  );

  return router;
}
