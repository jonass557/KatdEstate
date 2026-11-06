import { Router } from 'express';
import { objectIdSchema } from '@rentflow/shared';
import { z } from 'zod';
import type { AppConfig } from '../../config/index.js';
import { sendSuccess } from '../../common/http.js';
import { createAuthenticate } from '../../middleware/authenticate.js';
import { requireOrganizationMembership } from '../../middleware/organization.js';
import { requirePermission } from '../../middleware/permissions.js';
import { validateRequest } from '../../middleware/validate-request.js';
import { DOCUMENT_TYPE_VALUES } from '../../models/platform.js';
import * as service from './documents.service.js';

const idParams = z.object({ id: objectIdSchema });
const folderSchema = z.object({
  name: z.string().trim().min(1).max(160),
  parentId: objectIdSchema.optional(),
  resourceType: z.string().trim().max(40).optional(),
  resourceId: objectIdSchema.optional(),
});
const documentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  type: z.enum(DOCUMENT_TYPE_VALUES),
  fileId: objectIdSchema,
  folderId: objectIdSchema.optional(),
  tags: z.array(z.string().trim().max(40)).max(20).optional(),
  expiresAt: z.coerce.date().optional(),
  tenantId: objectIdSchema.optional(),
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
        if (!res.headersSent) sendSuccess(res, res.locals.data, { statusCode: res.statusCode });
      })
      .catch(next);
  };
}

export function createDocumentRouter(config: AppConfig) {
  const router = Router({ mergeParams: true });
  router.use(createAuthenticate(config), requireOrganizationMembership);

  router.get(
    '/document-folders',
    requirePermission('documents.view'),
    respond(service.listFolders),
  );
  router.post(
    '/document-folders',
    requirePermission('documents.upload'),
    validateRequest(folderSchema),
    respond(service.createFolder),
  );
  router.get('/documents', requirePermission('documents.view'), respond(service.listDocuments));
  router.get(
    '/documents/storage-usage',
    requirePermission('documents.view'),
    respond(service.storageUsage),
  );
  router.get(
    '/documents/expiring',
    requirePermission('documents.view'),
    respond(service.expiringDocuments),
  );
  router.post(
    '/documents',
    requirePermission('documents.upload'),
    validateRequest(documentSchema),
    respond(service.createDocument),
  );
  router.post(
    '/documents/:id/versions',
    requirePermission('documents.upload'),
    validateRequest(idParams, 'params'),
    validateRequest(z.object({ fileId: objectIdSchema })),
    respond(service.addVersion),
  );
  router.get(
    '/documents/:id/versions',
    requirePermission('documents.view'),
    validateRequest(idParams, 'params'),
    respond(service.listVersions),
  );
  router.get(
    '/documents/:id/download',
    requirePermission('documents.view'),
    validateRequest(idParams, 'params'),
    (req, res, next) => {
      service.downloadDocument(req, res).catch(next);
    },
  );
  router.post(
    '/documents/:id/archive',
    requirePermission('documents.upload'),
    validateRequest(idParams, 'params'),
    respond(service.archiveDocument),
  );
  router.post(
    '/documents/:id/restore',
    requirePermission('documents.upload'),
    validateRequest(idParams, 'params'),
    respond(service.restoreDocument),
  );
  router.delete(
    '/documents/:id',
    requirePermission('documents.delete'),
    validateRequest(idParams, 'params'),
    respond(service.deleteDocument),
  );
  router.post(
    '/documents/:id/share',
    requirePermission('documents.view'),
    validateRequest(idParams, 'params'),
    respond(service.shareDocument),
  );
  router.post(
    '/documents/:id/signature',
    requirePermission('documents.upload'),
    validateRequest(idParams, 'params'),
    respond(service.requestSignature),
  );

  return router;
}
