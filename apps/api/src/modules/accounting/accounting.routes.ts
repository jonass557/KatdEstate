import { Router } from 'express';
import {
  expenseRejectSchema,
  objectIdSchema,
  reportPeriodQuerySchema,
  transactionInputSchema,
  transactionListQuerySchema,
  transactionUpdateSchema,
} from '@rentflow/shared';
import { z } from 'zod';
import type { AppConfig } from '../../config/index.js';
import { sendSuccess } from '../../common/http.js';
import { createAuthenticate } from '../../middleware/authenticate.js';
import { requireOrganizationMembership } from '../../middleware/organization.js';
import { requirePermission } from '../../middleware/permissions.js';
import { validateRequest } from '../../middleware/validate-request.js';
import * as service from './accounting.service.js';

const idParams = z.object({ id: objectIdSchema });

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

export function createAccountingRouter(config: AppConfig) {
  const router = Router({ mergeParams: true });
  router.use(createAuthenticate(config), requireOrganizationMembership);

  router.get(
    '/transactions',
    requirePermission('expenses.view'),
    validateRequest(transactionListQuerySchema, 'query'),
    respond(service.listTransactions),
  );
  router.post(
    '/transactions',
    requirePermission('expenses.create'),
    validateRequest(transactionInputSchema),
    respond(service.createTransaction),
  );
  router.patch(
    '/transactions/:id',
    requirePermission('expenses.update'),
    validateRequest(idParams, 'params'),
    validateRequest(transactionUpdateSchema),
    respond(service.updateTransaction),
  );
  router.post(
    '/transactions/:id/approve',
    requirePermission('expenses.update'),
    validateRequest(idParams, 'params'),
    respond(service.approveExpense),
  );
  router.post(
    '/transactions/:id/reject',
    requirePermission('expenses.update'),
    validateRequest(idParams, 'params'),
    validateRequest(expenseRejectSchema),
    respond(service.rejectExpense),
  );
  router.post(
    '/transactions/:id/pay',
    requirePermission('expenses.update'),
    validateRequest(idParams, 'params'),
    respond(service.payExpense),
  );
  router.delete(
    '/transactions/:id',
    requirePermission('expenses.delete'),
    validateRequest(idParams, 'params'),
    respond(service.deleteTransaction),
  );
  router.get('/transactions/export', requirePermission('reports.export'), (req, res, next) => {
    service.exportTransactions(req, res).catch(next);
  });

  router.get(
    '/reports/finance',
    requirePermission('reports.view'),
    validateRequest(reportPeriodQuerySchema, 'query'),
    respond(service.report),
  );
  router.get(
    '/reports/finance/pdf',
    requirePermission('reports.export'),
    validateRequest(reportPeriodQuerySchema, 'query'),
    (req, res, next) => {
      service.reportPdf(req, res).catch(next);
    },
  );
  router.get('/reports/forecast', requirePermission('reports.view'), respond(service.forecast));

  return router;
}
