import { Router } from 'express';
import {
  buildingInputSchema,
  buildingUpdateSchema,
  objectIdSchema,
  paginationSchema,
  propertyInputSchema,
  propertyListQuerySchema,
  propertyUpdateSchema,
  unitInputSchema,
  unitListQuerySchema,
  unitUpdateSchema,
} from '@rentflow/shared';
import { z } from 'zod';
import type { AppConfig } from '../../config/index.js';
import { sendSuccess } from '../../common/http.js';
import { createAuthenticate } from '../../middleware/authenticate.js';
import { requireOrganizationMembership } from '../../middleware/organization.js';
import { requirePermission } from '../../middleware/permissions.js';
import { validateRequest } from '../../middleware/validate-request.js';
import { sendStoredFile, upload, uploadFiles } from '../files/files.service.js';
import * as service from './properties.service.js';

const idParams = z.object({ id: objectIdSchema });
const fileIdsSchema = z.object({ fileIds: z.array(objectIdSchema).min(1).max(20) });

function respond(
  handler: (
    req: Parameters<typeof service.createProperty>[0],
    res: Parameters<typeof service.createProperty>[1],
  ) => Promise<void>,
) {
  return (
    req: Parameters<typeof handler>[0],
    res: Parameters<typeof handler>[1],
    next: (error: unknown) => void,
  ) => {
    handler(req, res)
      .then(() => {
        if (!res.headersSent)
          sendSuccess(res, res.locals.data, {
            statusCode: res.statusCode === 200 ? 200 : res.statusCode,
            meta: res.locals.meta,
          });
      })
      .catch(next);
  };
}

export function createPropertyPublicRouter() {
  const router = Router();
  router.get('/public/:code', respond(service.getPublicPropertyByCode));
  return router;
}

export function createPropertyRouter(config: AppConfig) {
  const router = Router({ mergeParams: true });
  router.use(createAuthenticate(config), requireOrganizationMembership);

  router.get(
    '/properties',
    requirePermission('properties.view'),
    validateRequest(propertyListQuerySchema, 'query'),
    respond(service.listProperties),
  );
  router.get(
    '/properties/export',
    requirePermission('reports.export'),
    respond(service.exportProperties),
  );
  router.post(
    '/properties',
    requirePermission('properties.create'),
    validateRequest(propertyInputSchema),
    respond(service.createProperty),
  );
  router.get(
    '/properties/:id',
    requirePermission('properties.view'),
    validateRequest(idParams, 'params'),
    respond(service.getProperty),
  );
  router.patch(
    '/properties/:id',
    requirePermission('properties.update'),
    validateRequest(idParams, 'params'),
    validateRequest(propertyUpdateSchema),
    respond(service.updateProperty),
  );
  router.delete(
    '/properties/:id',
    requirePermission('properties.delete'),
    validateRequest(idParams, 'params'),
    respond(service.deleteProperty),
  );
  router.get(
    '/properties/:id/stats',
    requirePermission('properties.view'),
    validateRequest(idParams, 'params'),
    respond(service.propertyStats),
  );
  router.post(
    '/properties/:id/photos',
    requirePermission('documents.upload'),
    validateRequest(idParams, 'params'),
    validateRequest(fileIdsSchema),
    respond(service.attachPhotos),
  );

  router.get(
    '/buildings',
    requirePermission('buildings.view'),
    validateRequest(paginationSchema.extend({ propertyId: objectIdSchema.optional() }), 'query'),
    respond(service.listBuildings),
  );
  router.post(
    '/buildings',
    requirePermission('buildings.create'),
    validateRequest(buildingInputSchema),
    respond(service.createBuilding),
  );
  router.patch(
    '/buildings/:id',
    requirePermission('buildings.update'),
    validateRequest(idParams, 'params'),
    validateRequest(buildingUpdateSchema),
    respond(service.updateBuilding),
  );
  router.delete(
    '/buildings/:id',
    requirePermission('buildings.delete'),
    validateRequest(idParams, 'params'),
    respond(service.deleteBuilding),
  );

  router.get(
    '/units',
    requirePermission('units.view'),
    validateRequest(unitListQuerySchema, 'query'),
    respond(service.listUnits),
  );
  router.post(
    '/units',
    requirePermission('units.create'),
    validateRequest(unitInputSchema),
    respond(service.createUnit),
  );
  router.get(
    '/units/:id',
    requirePermission('units.view'),
    validateRequest(idParams, 'params'),
    respond(service.getUnit),
  );
  router.patch(
    '/units/:id',
    requirePermission('units.update'),
    validateRequest(idParams, 'params'),
    validateRequest(unitUpdateSchema),
    respond(service.updateUnit),
  );
  router.delete(
    '/units/:id',
    requirePermission('units.delete'),
    validateRequest(idParams, 'params'),
    respond(service.deleteUnit),
  );
  router.post(
    '/units/:id/photos',
    requirePermission('documents.upload'),
    validateRequest(z.object({ id: objectIdSchema }), 'params'),
    validateRequest(fileIdsSchema),
    (req, res, next) => {
      req.params.unitId = req.params.id ?? '';
      service
        .attachPhotos(req, res)
        .then(() => sendSuccess(res, res.locals.data))
        .catch(next);
    },
  );

  router.post(
    '/files',
    requirePermission('documents.upload'),
    upload.array('files', 10),
    uploadFiles,
  );
  router.get(
    '/files/:id',
    requirePermission('documents.view'),
    validateRequest(idParams, 'params'),
    (req, res, next) => {
      sendStoredFile(res, req.organizationContext!.organizationId, String(req.params.id)).catch(
        next,
      );
    },
  );

  return router;
}
