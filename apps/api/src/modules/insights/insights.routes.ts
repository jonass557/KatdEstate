import { Router } from 'express';
import { objectIdSchema } from '@rentflow/shared';
import { z } from 'zod';
import type { AppConfig } from '../../config/index.js';
import { sendSuccess } from '../../common/http.js';
import { createAuthenticate } from '../../middleware/authenticate.js';
import { requireOrganizationMembership } from '../../middleware/organization.js';
import { requirePermission } from '../../middleware/permissions.js';
import { validateRequest } from '../../middleware/validate-request.js';
import * as service from './insights.service.js';

const WIDGETS = ['income', 'arrears', 'occupancy', 'available', 'expiring', 'maintenance', 'expenses', 'cashflow'] as const;
const layoutSchema = z.object({
  widgets: z.array(z.enum(WIDGETS)).min(1),
  hidden: z.array(z.enum(WIDGETS)).optional(),
});

function respond(handler: (req: import('express').Request, res: import('express').Response) => Promise<void>) {
  return (req: import('express').Request, res: import('express').Response, next: (error: unknown) => void) => {
    handler(req, res).then(() => sendSuccess(res, res.locals.data)).catch(next);
  };
}

export function createInsightsRouter(config: AppConfig) {
  const router = Router({ mergeParams: true });
  router.use(createAuthenticate(config), requireOrganizationMembership);

  router.get('/dashboard', requirePermission('reports.view'), respond(service.overview));
  router.get('/me/dashboard-layout', requirePermission('reports.view'), respond(service.getLayout));
  router.put('/me/dashboard-layout', requirePermission('reports.view'), validateRequest(layoutSchema), respond(service.saveLayout));
  router.get('/search', requirePermission('properties.view'), validateRequest(z.object({ q: z.string().trim().max(120) }), 'query'), respond(service.search));
  router.get('/properties/:id/health', requirePermission('properties.view'), validateRequest(z.object({ id: objectIdSchema }), 'params'), respond(service.propertyHealth));

  return router;
}
