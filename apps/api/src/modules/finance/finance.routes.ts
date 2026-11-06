import { Router } from 'express';
import {
  applyLatePenaltiesSchema,
  cancelScheduleSchema,
  chargeSplitSchema,
  financeListQuerySchema,
  objectIdSchema,
  recordDepositSchema,
  recordPaymentSchema,
  refundPaymentSchema,
  sendReceiptSchema,
  updateScheduleSchema,
} from '@rentflow/shared';
import { z } from 'zod';
import type { AppConfig } from '../../config/index.js';
import { sendSuccess } from '../../common/http.js';
import { createAuthenticate } from '../../middleware/authenticate.js';
import { requireOrganizationMembership } from '../../middleware/organization.js';
import { requirePermission } from '../../middleware/permissions.js';
import { validateRequest } from '../../middleware/validate-request.js';
import * as service from './finance.service.js';

const idParams = z.object({ id: objectIdSchema });
const tenantParams = z.object({ tenantId: objectIdSchema });

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

export function createFinanceRouter(config: AppConfig) {
  const router = Router({ mergeParams: true });
  router.use(createAuthenticate(config), requireOrganizationMembership);

  // Rent schedules
  router.get(
    '/rent-schedules',
    requirePermission('rentSchedules.view'),
    validateRequest(financeListQuerySchema, 'query'),
    respond(service.listSchedules),
  );
  router.patch(
    '/rent-schedules/:id',
    requirePermission('rentSchedules.manage'),
    validateRequest(idParams, 'params'),
    validateRequest(updateScheduleSchema),
    respond(service.updateSchedule),
  );
  router.post(
    '/rent-schedules/:id/cancel',
    requirePermission('invoices.cancel'),
    validateRequest(idParams, 'params'),
    validateRequest(cancelScheduleSchema),
    respond(service.cancelSchedule),
  );
  router.post(
    '/rent-schedules/apply-penalties',
    requirePermission('rentSchedules.manage'),
    validateRequest(applyLatePenaltiesSchema),
    respond(service.applyLatePenalties),
  );

  // Analytics & Dashboard
  router.get(
    '/finance/summary',
    requirePermission('payments.view'),
    respond(service.financeSummary),
  );
  router.get(
    '/finance/dashboard',
    requirePermission('payments.view'),
    respond(service.financeDashboard),
  );
  router.get(
    '/finance/tenants/:tenantId/history',
    requirePermission('payments.view'),
    validateRequest(tenantParams, 'params'),
    respond(service.tenantPaymentHistory),
  );
  router.post(
    '/finance/split-charges',
    requirePermission('invoices.create'),
    validateRequest(chargeSplitSchema),
    respond(service.splitCharges),
  );

  // Payments
  router.get(
    '/payments',
    requirePermission('payments.view'),
    validateRequest(financeListQuerySchema, 'query'),
    respond(service.listPayments),
  );
  router.post(
    '/payments',
    requirePermission('payments.create'),
    validateRequest(recordPaymentSchema),
    respond(service.recordPayment),
  );
  router.post(
    '/payments/:id/confirm',
    requirePermission('payments.create'),
    validateRequest(idParams, 'params'),
    respond(service.confirmPayment),
  );
  router.post(
    '/payments/:id/refund',
    requirePermission('payments.refund'),
    validateRequest(idParams, 'params'),
    validateRequest(refundPaymentSchema),
    respond(service.refundPayment),
  );
  router.post(
    '/payments/:id/reconcile',
    requirePermission('payments.create'),
    validateRequest(idParams, 'params'),
    respond(service.reconcilePayment),
  );
  router.get('/payments/export', requirePermission('reports.export'), (req, res, next) => {
    service.exportPayments(req, res).catch(next);
  });

  // Invoices & Receipts
  router.get(
    '/invoices',
    requirePermission('invoices.view'),
    validateRequest(financeListQuerySchema, 'query'),
    respond(service.listInvoices),
  );
  router.get(
    '/invoices/:id/pdf',
    requirePermission('invoices.view'),
    validateRequest(idParams, 'params'),
    (req, res, next) => {
      service.invoicePdf(req, res).catch(next);
    },
  );
  router.get(
    '/receipts/:id/pdf',
    requirePermission('receipts.view'),
    validateRequest(idParams, 'params'),
    (req, res, next) => {
      service.receiptPdf(req, res).catch(next);
    },
  );
  router.post(
    '/receipts/:id/send',
    requirePermission('receipts.generate'),
    validateRequest(idParams, 'params'),
    validateRequest(sendReceiptSchema),
    respond(service.sendReceipt),
  );

  // Deposits
  router.post(
    '/deposits',
    requirePermission('deposits.manage'),
    validateRequest(recordDepositSchema),
    respond(service.recordDeposit),
  );

  return router;
}
