import { Router } from 'express';
import { objectIdSchema, utilityListQuerySchema, utilityMeterInputSchema, utilityMeterUpdateSchema, utilityReadingInputSchema } from '@rentflow/shared';
import { z } from 'zod';
import type { AppConfig } from '../../config/index.js';
import { sendSuccess } from '../../common/http.js';
import { createAuthenticate } from '../../middleware/authenticate.js';
import { requireOrganizationMembership } from '../../middleware/organization.js';
import { requirePermission } from '../../middleware/permissions.js';
import { validateRequest } from '../../middleware/validate-request.js';
import { createUtilityHandlers, rejectOcr } from './utilities.service.js';

const idParams = z.object({ id: objectIdSchema });

function respond(handler: (req: import('express').Request, res: import('express').Response) => Promise<void>) {
  return (req: import('express').Request, res: import('express').Response, next: (error: unknown) => void) => {
    handler(req, res).then(() => { if (!res.headersSent) sendSuccess(res, res.locals.data, { statusCode: res.statusCode, meta: res.locals.meta }); }).catch(next);
  };
}

export function createUtilityRouter(config: AppConfig) {
  const router = Router({ mergeParams: true });
  const utilities = createUtilityHandlers(config);
  router.use(createAuthenticate(config), requireOrganizationMembership);

  router.get('/meters', requirePermission('meters.view'), validateRequest(utilityListQuerySchema, 'query'), respond(utilities.listMeters));
  router.post('/meters', requirePermission('meters.manage'), validateRequest(utilityMeterInputSchema), respond(utilities.createMeter));
  router.patch('/meters/:id', requirePermission('meters.manage'), validateRequest(idParams, 'params'), validateRequest(utilityMeterUpdateSchema), respond(utilities.updateMeter));
  router.post('/meter-readings', requirePermission('meters.read'), validateRequest(utilityReadingInputSchema), respond(utilities.recordReading));
  router.get('/meters/:id/readings', requirePermission('meters.view'), validateRequest(idParams, 'params'), respond(utilities.readings));
  router.get('/meters/consumption', requirePermission('meters.view'), respond(utilities.consumption));
  router.post('/meter-readings/ocr', requirePermission('meters.read'), (_req, _res, next) => next(rejectOcr()));

  return router;
}
