import { Router } from 'express';
import { messageInputSchema, messageReplySchema, objectIdSchema, tenantUpdateSchema } from '@rentflow/shared';
import { z } from 'zod';
import type { AppConfig } from '../../config/index.js';
import { sendSuccess } from '../../common/http.js';
import { createAuthenticate } from '../../middleware/authenticate.js';
import { requireOrganizationMembership } from '../../middleware/organization.js';
import { requirePermission } from '../../middleware/permissions.js';
import { validateRequest } from '../../middleware/validate-request.js';
import * as portal from './portal.service.js';
import * as owner from './owner.service.js';
import * as messages from './messages.service.js';

const idParams = z.object({ id: objectIdSchema });

/**
 * Champs qu'un locataire a le droit de changer lui-même.
 * Tout le reste du schéma locataire (loyer, statut, pièce d'identité) est ignoré.
 */
const profileSchema = tenantUpdateSchema.pick({
  phone: true,
  email: true,
  address: true,
  emergencyContactName: true,
  emergencyContactPhone: true,
});

function respond(handler: (req: import('express').Request, res: import('express').Response) => Promise<void>) {
  return (req: import('express').Request, res: import('express').Response, next: (error: unknown) => void) => {
    handler(req, res)
      .then(() => {
        if (!res.headersSent) sendSuccess(res, res.locals.data);
      })
      .catch(next);
  };
}

export function createPortalRouter(config: AppConfig) {
  const router = Router({ mergeParams: true });
  router.use(createAuthenticate(config), requireOrganizationMembership);

  // --- Portail Locataire ---
  router.get('/portal', requirePermission('leases.view'), respond(portal.dashboard));
  router.get('/portal/rents', requirePermission('leases.view'), respond(portal.rents));
  router.get('/portal/payments', requirePermission('payments.view'), respond(portal.payments));
  router.get('/portal/receipts', requirePermission('receipts.view'), respond(portal.receipts));
  router.get('/portal/receipts/:id/pdf', requirePermission('receipts.view'), validateRequest(idParams, 'params'), (req, res, next) => {
    portal.receiptPdf(req, res).catch(next);
  });
  router.get('/portal/invoices', requirePermission('invoices.view'), respond(portal.invoices));
  router.get('/portal/invoices/:id/pdf', requirePermission('invoices.view'), validateRequest(idParams, 'params'), (req, res, next) => {
    portal.invoicePdf(req, res).catch(next);
  });
  router.get('/portal/lease', requirePermission('leases.view'), respond(portal.lease));
  router.get('/portal/lease/:id/pdf', requirePermission('leases.view'), validateRequest(idParams, 'params'), (req, res, next) => {
    portal.leasePdf(req, res).catch(next);
  });
  router.get('/portal/documents', requirePermission('documents.view'), respond(portal.documents));
  router.get('/portal/profile', requirePermission('leases.view'), respond(portal.profile));
  router.patch('/portal/profile', requirePermission('leases.view'), validateRequest(profileSchema), respond(portal.updateProfile));

  // --- Portail Propriétaire ---
  router.get('/owner/overview', requirePermission('properties.view'), respond(owner.ownerOverview));
  router.get('/owner/report/pdf', requirePermission('reports.view'), (req, res, next) => {
    owner.ownerReportPdf(req, res).catch(next);
  });

  // --- Messagerie interne & Communication ---
  router.get('/messages', requirePermission('messages.view'), respond(messages.listMessages));
  router.get('/messages/:id', requirePermission('messages.view'), validateRequest(idParams, 'params'), respond(messages.getMessage));
  router.post('/messages', requirePermission('messages.send'), validateRequest(messageInputSchema), respond(messages.sendMessage));
  router.post('/messages/:id/reply', requirePermission('messages.send'), validateRequest(idParams, 'params'), validateRequest(messageReplySchema), respond(messages.replyMessage));
  router.post('/messages/:id/read', requirePermission('messages.view'), validateRequest(idParams, 'params'), respond(messages.markRead));

  return router;
}
