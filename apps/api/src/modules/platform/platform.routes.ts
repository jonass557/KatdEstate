import { Router } from 'express';
import type { RequestHandler } from 'express';
import { objectIdSchema } from '@rentflow/shared';
import { z } from 'zod';
import type { AppConfig } from '../../config/index.js';
import { AppError } from '../../common/errors.js';
import { sendSuccess } from '../../common/http.js';
import { createAuthenticate } from '../../middleware/authenticate.js';
import { validateRequest } from '../../middleware/validate-request.js';
import { FEATURE_FLAGS, PLAN_CODE_VALUES } from '../../models/platform.js';
import * as geo from '../quartier/geo.service.js';
import * as service from './platform.service.js';

const requireSuperAdmin: RequestHandler = (req, _res, next) => {
  if (!req.user?.roles.includes('SUPER_ADMIN')) {
    next(new AppError('FORBIDDEN', 'Réservé au super administrateur.', 403));
    return;
  }
  next();
};

const planUpdate = z.object({
  priceMinor: z.number().int().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  trialDays: z.number().int().nonnegative().optional(),
  limits: z
    .object({ properties: z.number().int(), users: z.number().int(), units: z.number().int() })
    .optional(),
  features: z.array(z.string()).optional(),
});

const geoSettingsUpdate = z.object({
  googleMapsBrowserApiKey: z.string().trim().max(512).optional(),
  googleMapsServerApiKey: z.string().trim().max(512).optional(),
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
      .then(() => sendSuccess(res, res.locals.data))
      .catch(next);
  };
}

export function createPlatformRouter(config: AppConfig) {
  const router = Router();
  router.use(createAuthenticate(config), requireSuperAdmin);

  router.get('/overview', respond(service.overview));
  router.get('/owners', respond(service.listOwners));
  router.post('/owners/:id/suspend', respond(service.suspendOwner));
  router.post('/owners/:id/reactivate', respond(service.reactivateOwner));
  router.delete('/owners/:id', respond(service.deleteOwner));
  router.patch('/owners/:id/subscription', respond(service.updateOwnerSubscription));
  router.get('/organizations', respond(service.listOrganizations));
  router.post(
    '/organizations/:id/suspend',
    validateRequest(z.object({ id: objectIdSchema }), 'params'),
    respond(service.suspendOrganization),
  );
  router.post(
    '/organizations/:id/reactivate',
    validateRequest(z.object({ id: objectIdSchema }), 'params'),
    respond(service.reactivateOrganization),
  );
  router.get('/plans', respond(service.listPlans));
  router.patch(
    '/plans/:code',
    validateRequest(z.object({ code: z.enum(PLAN_CODE_VALUES) }), 'params'),
    validateRequest(planUpdate),
    respond(service.updatePlan),
  );
  router.get('/flags', respond(service.listFlags));
  router.get('/geo-settings', respond(geo.getAdminGeoSettings));
  router.put('/geo-settings', validateRequest(geoSettingsUpdate), respond(geo.updateAdminGeoSettings));
  router.put(
    '/flags/:key',
    validateRequest(z.object({ key: z.enum(FEATURE_FLAGS) }), 'params'),
    validateRequest(z.object({ enabled: z.boolean() })),
    respond(service.setFlag),
  );
  router.get('/support-tickets', respond(service.listTickets));
  router.post(
    '/impersonate',
    validateRequest(z.object({ ticketId: objectIdSchema, userId: objectIdSchema })),
    (req, res, next) => {
      service
        .impersonate(config, req, res)
        .then(() => sendSuccess(res, res.locals.data))
        .catch(next);
    },
  );

  return router;
}
