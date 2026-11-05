import { Router } from 'express';
import { notificationPreferenceInputSchema, notificationTemplateInputSchema, objectIdSchema, paginationSchema } from '@rentflow/shared';
import { z } from 'zod';
import type { AppConfig } from '../../config/index.js';
import { sendSuccess } from '../../common/http.js';
import { createAuthenticate } from '../../middleware/authenticate.js';
import { requireOrganizationMembership } from '../../middleware/organization.js';
import { requirePermission } from '../../middleware/permissions.js';
import { validateRequest } from '../../middleware/validate-request.js';
import { createTriggerReminders, listNotifications, listPreferences, listTemplates, markRead, upsertPreference, upsertTemplate } from './notifications.service.js';

function respond(handler: (req: import('express').Request, res: import('express').Response) => Promise<void>) {
  return (req: import('express').Request, res: import('express').Response, next: (error: unknown) => void) => {
    handler(req, res).then(() => sendSuccess(res, res.locals.data, { meta: res.locals.meta })).catch(next);
  };
}

export function createNotificationRouter(config: AppConfig) {
  const router = Router({ mergeParams: true });
  router.use(createAuthenticate(config), requireOrganizationMembership);

  router.post('/notifications/trigger-reminders', respond(createTriggerReminders(config)));
  router.get('/notifications', requirePermission('notifications.view'), validateRequest(paginationSchema, 'query'), respond(listNotifications));
  router.post('/notifications/:id/read', requirePermission('notifications.view'), validateRequest(z.object({ id: objectIdSchema }), 'params'), respond(markRead));
  router.get('/notification-preferences', requirePermission('notifications.view'), respond(listPreferences));
  router.put('/notification-preferences', requirePermission('notifications.view'), validateRequest(notificationPreferenceInputSchema), respond(upsertPreference));
  router.get('/notification-templates', requirePermission('notifications.manage'), respond(listTemplates));
  router.put('/notification-templates', requirePermission('notifications.manage'), validateRequest(notificationTemplateInputSchema), respond(upsertTemplate));

  return router;
}
