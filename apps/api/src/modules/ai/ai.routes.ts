import { Router } from 'express';
import { z } from 'zod';
import type { AppConfig } from '../../config/index.js';
import { sendSuccess } from '../../common/http.js';
import { createAuthenticate } from '../../middleware/authenticate.js';
import { requireOrganizationMembership } from '../../middleware/organization.js';
import { requirePermission } from '../../middleware/permissions.js';
import { validateRequest } from '../../middleware/validate-request.js';
import * as service from './ai.service.js';

const askSchema = z.object({ question: z.string().trim().min(2).max(1_000) });
const draftSchema = z.object({
  kind: z.enum(['REMINDER', 'OVERDUE', 'FORMAL_NOTICE', 'RENEWAL_PROPOSAL', 'MAINTENANCE_UPDATE']),
  tenantName: z.string().trim().min(1).max(160),
  amount: z.string().max(40).optional(),
  dueDate: z.string().max(30).optional(),
  propertyName: z.string().max(160).optional(),
});

export function createAiRouter(config: AppConfig) {
  const router = Router({ mergeParams: true });
  router.use(createAuthenticate(config), requireOrganizationMembership);

  router.post(
    '/ai/ask',
    requirePermission('reports.view'),
    validateRequest(askSchema),
    (req, res, next) => {
      service
        .ask(config, req, res)
        .then(() => sendSuccess(res, res.locals.data))
        .catch(next);
    },
  );
  router.post(
    '/ai/drafts',
    requirePermission('messages.send'),
    validateRequest(draftSchema),
    (req, res, next) => {
      service
        .draftMessage(req, res)
        .then(() => sendSuccess(res, res.locals.data))
        .catch(next);
    },
  );
  router.get('/ai/conversations', requirePermission('reports.view'), (req, res, next) => {
    service
      .getConversations(req, res)
      .then(() => sendSuccess(res, res.locals.data))
      .catch(next);
  });

  return router;
}
