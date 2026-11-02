import { Router } from 'express';
import {
  maintenanceListQuerySchema,
  maintenanceTaskInputSchema,
  maintenanceTicketInputSchema,
  maintenanceTicketUpdateSchema,
  objectIdSchema,
  vendorInputSchema,
} from '@rentflow/shared';
import { z } from 'zod';
import type { AppConfig } from '../../config/index.js';
import { sendSuccess } from '../../common/http.js';
import { createAuthenticate } from '../../middleware/authenticate.js';
import { requireOrganizationMembership } from '../../middleware/organization.js';
import { requirePermission } from '../../middleware/permissions.js';
import { validateRequest } from '../../middleware/validate-request.js';
import { createMaintenanceHandlers, createTask, createVendor, deleteVendor, listVendors, updateVendor } from './maintenance.service.js';

const idParams = z.object({ id: objectIdSchema });

function respond(handler: (req: import('express').Request, res: import('express').Response) => Promise<void>) {
  return (req: import('express').Request, res: import('express').Response, next: (error: unknown) => void) => {
    handler(req, res).then(() => { if (!res.headersSent) sendSuccess(res, res.locals.data, { statusCode: res.statusCode, meta: res.locals.meta }); }).catch(next);
  };
}

export function createMaintenanceRouter(config: AppConfig) {
  const router = Router({ mergeParams: true });
  const tickets = createMaintenanceHandlers(config);
  router.use(createAuthenticate(config), requireOrganizationMembership);

  router.get('/maintenance/stats', requirePermission('maintenance.view'), respond(tickets.stats));
  router.get('/maintenance', requirePermission('maintenance.view'), validateRequest(maintenanceListQuerySchema, 'query'), respond(tickets.list));
  router.post('/maintenance', requirePermission('maintenance.create'), validateRequest(maintenanceTicketInputSchema), respond(tickets.create));
  router.patch('/maintenance/:id', requirePermission('maintenance.manage'), validateRequest(idParams, 'params'), validateRequest(maintenanceTicketUpdateSchema), respond(tickets.update));
  router.get('/maintenance/:id/history', requirePermission('maintenance.view'), validateRequest(idParams, 'params'), respond(tickets.history));

  router.get('/vendors', requirePermission('vendors.view'), respond(listVendors));
  router.post('/vendors', requirePermission('vendors.manage'), validateRequest(vendorInputSchema), respond(createVendor));
  router.patch('/vendors/:id', requirePermission('vendors.manage'), validateRequest(idParams, 'params'), validateRequest(vendorInputSchema.partial()), respond(updateVendor));
  router.delete('/vendors/:id', requirePermission('vendors.manage'), validateRequest(idParams, 'params'), respond(deleteVendor));
  router.post('/maintenance-tasks', requirePermission('maintenance.manage'), validateRequest(maintenanceTaskInputSchema), respond(createTask));

  return router;
}
