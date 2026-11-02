import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import ExcelJS from 'exceljs';
import { recordAudit } from '../../common/audit.js';
import { AppError } from '../../common/errors.js';
import { notFound, paginate } from '../../common/pagination.js';
import { renderPdf } from '../../common/pdf.js';
import { computePenalty } from '../../common/schedule.js';
import { nextNumber } from '../../common/sequence.js';
import { DepositTransaction, Invoice, Payment, Receipt, RentSchedule } from '../../models/finance.js';
import { Lease, Tenant } from '../../models/lease.js';
import { Property, Unit } from '../../models/property.js';
import { Organization } from '../../models/identity.js';
import { Notification, Transaction } from '../../models/operations.js';

function org(req: Request): string {
  return req.organizationContext!.organizationId;
}

async function audit(req: Request, action: string, resourceId: string, changes?: Record<string, unknown>): Promise<void> {
  await recordAudit({
    organizationId: org(req),
    ...(req.user?.id ? { actorId: req.user.id } : {}),
    action,
    resourceType: 'Finance',
    resourceId,
    requestId: req.requestId,
    ...(changes ? { changes } : {}),
  });
}

function remainingOf(schedule: { amountDueMinor: number; penaltyMinor: number; amountPaidMinor: number }): number {
  return schedule.amountDueMinor + schedule.penaltyMinor - schedule.amountPaidMinor;
}

function statusFor(schedule: { amountDueMinor: number; penaltyMinor: number; amountPaidMinor: number; dueDate: Date }): 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' {
  const remaining = remainingOf(schedule);
  if (remaining <= 0) return 'PAID';
  if (schedule.dueDate.getTime() < Date.now()) return 'OVERDUE';
  if (schedule.amountPaidMinor > 0) return 'PARTIAL';
  return 'PENDING';
}

export async function listSchedules(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as Record<string, unknown> & { page: number; pageSize: number; order: 'asc' | 'desc'; sort?: string };
  const filter: Record<string, unknown> = { organizationId: org(req) };
  for (const key of ['status', 'propertyId', 'tenantId', 'unitId'] as const) {
    if (query[key]) filter[key] = query[key];
  }
  if (query.from || query.to) {
    filter.dueDate = {
      ...(query.from ? { $gte: query.from } : {}),
      ...(query.to ? { $lte: query.to } : {}),
    };
  }
  const page = await paginate(RentSchedule, filter, query, 'rentSchedule');
  res.locals.data = page.items;
  res.locals.meta = page.meta;
}

export async function updateSchedule(req: Request, res: Response): Promise<void> {
  const schedule = await RentSchedule.findOne({ _id: req.params.id, organizationId: org(req) });
  if (!schedule) throw notFound('Échéance');

  const before = {
    dueDate: schedule.dueDate,
    amountDueMinor: schedule.amountDueMinor,
    penaltyMinor: schedule.penaltyMinor,
    status: schedule.status,
  };

  if (req.body.dueDate !== undefined) schedule.dueDate = req.body.dueDate;
  if (req.body.amountDueMinor !== undefined) schedule.amountDueMinor = req.body.amountDueMinor;
  if (req.body.penaltyMinor !== undefined) schedule.penaltyMinor = req.body.penaltyMinor;

  schedule.status = statusFor(schedule);
  await schedule.save();

  await audit(req, 'schedule.update', String(schedule._id), {
    before,
    after: {
      dueDate: schedule.dueDate,
      amountDueMinor: schedule.amountDueMinor,
      penaltyMinor: schedule.penaltyMinor,
      status: schedule.status,
    },
    reason: req.body.reason,
  });

  res.locals.data = schedule;
}

export async function applyLatePenalties(req: Request, res: Response): Promise<void> {
  const asOfDate = req.body.asOfDate ? new Date(req.body.asOfDate) : new Date();
  const filter: Record<string, unknown> = {
    organizationId: org(req),
    status: { $in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
    dueDate: { $lt: asOfDate },
  };
  if (req.body.propertyId) filter.propertyId = req.body.propertyId;

  const schedules = await RentSchedule.find(filter);
  const organization = await Organization.findById(org(req));
  const orgDefaultPenaltyPct = organization?.billingSettings?.lateFeePercentage ?? 0;

  let count = 0;
  let totalPenaltiesApplied = 0;

  for (const schedule of schedules) {
    const lease = await Lease.findById(schedule.leaseId);
    let penaltyValue = 0;

    if (lease?.penalty && lease.penalty.type !== 'NONE') {
      const graceMs = (lease.penalty.graceDays ?? 0) * 24 * 60 * 60 * 1000;
      if (asOfDate.getTime() - schedule.dueDate.getTime() >= graceMs) {
        penaltyValue = computePenalty(schedule.amountDueMinor, lease.penalty);
      }
    } else if (orgDefaultPenaltyPct > 0) {
      penaltyValue = Math.round((schedule.amountDueMinor * orgDefaultPenaltyPct) / 100);
    }

    if (penaltyValue > 0 && penaltyValue !== schedule.penaltyMinor) {
      const diff = penaltyValue - schedule.penaltyMinor;
      schedule.penaltyMinor = penaltyValue;
      schedule.status = statusFor(schedule);
      await schedule.save();
      count++;
      totalPenaltiesApplied += diff;
    } else if (schedule.status !== 'OVERDUE' && schedule.dueDate.getTime() < asOfDate.getTime() && remainingOf(schedule) > 0) {
      schedule.status = 'OVERDUE';
      await schedule.save();
    }
  }

  await audit(req, 'penalties.apply', 'RentSchedule', { count, totalPenaltiesApplied, asOfDate });
  res.locals.data = { count, totalPenaltiesApplied };
}

/**
 * Enregistre un paiement manuel ou initialise un paiement en attente.
 * Le paiement partiel est natif : le reste dû est recalculé et le statut suit.
 * L'idempotence protège contre les doubles débits.
 */
export async function recordPayment(req: Request, res: Response): Promise<void> {
  const existing = await Payment.findOne({ organizationId: org(req), idempotencyKey: req.body.idempotencyKey });
  if (existing) {
    res.locals.data = { payment: existing, duplicate: true };
    return;
  }

  const schedule = await RentSchedule.findOne({ _id: req.body.rentScheduleId, organizationId: org(req) });
  if (!schedule) throw notFound('Échéance');
  if (schedule.status === 'CANCELLED') throw new AppError('CONFLICT', 'Échéance annulée.', 409);
  if (schedule.status === 'PAID') throw new AppError('CONFLICT', 'Échéance déjà soldée.', 409);

  const remaining = remainingOf(schedule);
  if (req.body.amountMinor > remaining) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Le montant dépasse le reste dû (${remaining}). Aucun trop-perçu n'est enregistré.`,
      422,
    );
  }

  const paymentNumber = await nextNumber(org(req), 'PAY');
  const reference = req.body.reference || `REF-${paymentNumber}`;
  const isPending = req.body.status === 'PENDING';

  const payment = await Payment.create({
    organizationId: org(req),
    number: paymentNumber,
    rentScheduleId: schedule._id,
    tenantId: schedule.tenantId,
    amountMinor: req.body.amountMinor,
    currency: schedule.currency,
    method: req.body.method,
    status: isPending ? 'PENDING' : 'CONFIRMED',
    paidAt: req.body.paidAt ?? new Date(),
    reference,
    note: req.body.note,
    idempotencyKey: req.body.idempotencyKey,
  });

  let invoice = null;
  let receipt = null;

  if (!isPending) {
    schedule.amountPaidMinor += req.body.amountMinor;
    schedule.status = statusFor(schedule);
    await schedule.save();

    invoice = await Invoice.findOneAndUpdate(
      { organizationId: org(req), rentScheduleId: schedule._id },
      {
        $setOnInsert: {
          number: await nextNumber(org(req), 'FAC'),
          tenantId: schedule.tenantId,
          propertyId: schedule.propertyId,
          unitId: schedule.unitId,
          dueDate: schedule.dueDate,
          items: [{ label: 'Loyer et charges', amountMinor: schedule.amountDueMinor + schedule.penaltyMinor }],
          totalMinor: schedule.amountDueMinor + schedule.penaltyMinor,
          currency: schedule.currency,
        },
        $inc: { amountPaidMinor: req.body.amountMinor },
        status: schedule.status === 'PAID' ? 'PAID' : 'PARTIAL',
      },
      { upsert: true, new: true },
    );

    receipt = await Receipt.create({
      organizationId: org(req),
      number: await nextNumber(org(req), 'QUI'),
      paymentId: payment._id,
      tenantId: schedule.tenantId,
      amountMinor: payment.amountMinor,
      currency: schedule.currency,
    });
  }

  await audit(req, 'payment.record', String(payment._id), {
    amountMinor: payment.amountMinor,
    remaining: remainingOf(schedule),
    status: payment.status,
  });

  res.status(201);
  res.locals.data = {
    payment,
    invoice,
    receipt,
    remainingMinor: remainingOf(schedule),
    status: schedule.status,
  };
}

export async function confirmPayment(req: Request, res: Response): Promise<void> {
  const payment = await Payment.findOne({ _id: req.params.id, organizationId: org(req) });
  if (!payment) throw notFound('Paiement');
  if (payment.status === 'CONFIRMED') throw new AppError('CONFLICT', 'Paiement déjà confirmé.', 409);
  if (payment.status === 'REFUNDED') throw new AppError('CONFLICT', 'Paiement déjà remboursé.', 409);

  const schedule = await RentSchedule.findById(payment.rentScheduleId);
  if (!schedule) throw notFound('Échéance');

  payment.status = 'CONFIRMED';
  await payment.save();

  schedule.amountPaidMinor += payment.amountMinor;
  schedule.status = statusFor(schedule);
  await schedule.save();

  const receipt = await Receipt.create({
    organizationId: org(req),
    number: await nextNumber(org(req), 'QUI'),
    paymentId: payment._id,
    tenantId: schedule.tenantId,
    amountMinor: payment.amountMinor,
    currency: schedule.currency,
  });

  await audit(req, 'payment.confirm', String(payment._id));
  res.locals.data = { payment, receipt, status: schedule.status, remainingMinor: remainingOf(schedule) };
}

/** Remboursement : mouvement inverse, l'échéance redevient due du montant rendu. */
export async function refundPayment(req: Request, res: Response): Promise<void> {
  const payment = await Payment.findOne({ _id: req.params.id, organizationId: org(req) });
  if (!payment) throw notFound('Paiement');
  if (payment.status === 'REFUNDED') throw new AppError('CONFLICT', 'Paiement déjà remboursé.', 409);

  const schedule = await RentSchedule.findById(payment.rentScheduleId);
  if (!schedule) throw notFound('Échéance');

  payment.status = 'REFUNDED';
  payment.refundedAmountMinor = payment.amountMinor;
  payment.refundReason = req.body.reason;
  await payment.save();

  schedule.amountPaidMinor = Math.max(0, schedule.amountPaidMinor - payment.amountMinor);
  schedule.status = statusFor(schedule);
  await schedule.save();

  await audit(req, 'payment.refund', String(payment._id), { reason: req.body.reason });
  res.locals.data = { payment, status: schedule.status, remainingMinor: remainingOf(schedule) };
}

export async function cancelSchedule(req: Request, res: Response): Promise<void> {
  const schedule = await RentSchedule.findOne({ _id: req.params.id, organizationId: org(req) });
  if (!schedule) throw notFound('Échéance');
  if (schedule.amountPaidMinor > 0) {
    throw new AppError('CONFLICT', 'Impossible d’annuler une échéance déjà payée en partie. Remboursez d’abord.', 409);
  }
  schedule.status = 'CANCELLED';
  schedule.cancelledReason = req.body.reason;
  await schedule.save();
  await audit(req, 'schedule.cancel', String(schedule._id));
  res.locals.data = schedule;
}

export async function recordDeposit(req: Request, res: Response): Promise<void> {
  const lease = await Lease.findOne({ _id: req.body.leaseId, organizationId: org(req), deletedAt: null });
  if (!lease) throw notFound('Contrat');

  const received = await DepositTransaction.aggregate<{ _id: string; total: number }>([
    { $match: { leaseId: lease._id } },
    { $group: { _id: '$type', total: { $sum: '$amountMinor' } } },
  ]);
  const balance = received.reduce((sum, entry) => {
    if (entry._id === 'RECEIVED') return sum + entry.total;
    return sum - entry.total;
  }, 0);

  if ((req.body.type === 'REFUNDED' || req.body.type === 'DEDUCTION') && req.body.amountMinor > balance) {
    throw new AppError('VALIDATION_ERROR', 'Le montant dépasse le dépôt actuellement détenu.', 422);
  }

  const transaction = await DepositTransaction.create({
    organizationId: org(req),
    leaseId: lease._id,
    tenantId: lease.tenantId,
    type: req.body.type,
    amountMinor: req.body.amountMinor,
    currency: lease.currency,
    note: req.body.note,
  });
  await audit(req, 'deposit.record', String(transaction._id));
  res.status(201);
  res.locals.data = transaction;
}

export async function listPayments(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as Record<string, unknown> & { page: number; pageSize: number; order: 'asc' | 'desc'; sort?: string };
  const filter: Record<string, unknown> = { organizationId: org(req) };
  if (query.method) filter.method = query.method;
  if (query.status) filter.status = query.status;
  if (query.tenantId) filter.tenantId = query.tenantId;
  if (query.from || query.to) {
    filter.paidAt = { ...(query.from ? { $gte: query.from } : {}), ...(query.to ? { $lte: query.to } : {}) };
  }
  const page = await paginate(Payment, filter, query, 'payment');
  res.locals.data = page.items;
  res.locals.meta = page.meta;
}

export async function tenantPaymentHistory(req: Request, res: Response): Promise<void> {
  const tenantId = req.params.tenantId;
  const tenant = await Tenant.findOne({ _id: tenantId, organizationId: org(req) });
  if (!tenant) throw notFound('Locataire');

  const schedules = await RentSchedule.find({ tenantId, organizationId: org(req) }).sort({ dueDate: -1 }).lean();
  const payments = await Payment.find({ tenantId, organizationId: org(req) }).sort({ paidAt: -1 }).lean();
  const deposits = await DepositTransaction.find({ tenantId, organizationId: org(req) }).sort({ createdAt: -1 }).lean();

  let totalBilledMinor = 0;
  let totalPaidMinor = 0;
  let totalOverdueMinor = 0;

  for (const s of schedules) {
    if (s.status !== 'CANCELLED') {
      const due = s.amountDueMinor + s.penaltyMinor;
      totalBilledMinor += due;
      totalPaidMinor += s.amountPaidMinor;
      if (s.status === 'OVERDUE') {
        totalOverdueMinor += Math.max(0, due - s.amountPaidMinor);
      }
    }
  }

  const depositBalanceMinor = deposits.reduce((sum, d) => {
    if (d.type === 'RECEIVED') return sum + d.amountMinor;
    return sum - d.amountMinor;
  }, 0);

  res.locals.data = {
    tenant: {
      id: String(tenant._id),
      fullName: tenant.fullName,
      phone: tenant.phone,
      email: tenant.email,
    },
    metrics: {
      totalBilledMinor,
      totalPaidMinor,
      remainingMinor: Math.max(0, totalBilledMinor - totalPaidMinor),
      totalOverdueMinor,
      depositBalanceMinor,
    },
    schedules,
    payments,
    deposits,
  };
}

export async function splitCharges(req: Request, res: Response): Promise<void> {
  const { propertyId, label, category, totalAmountMinor, splitMethod, dueDate } = req.body;
  const property = await Property.findOne({ _id: propertyId, organizationId: org(req) });
  if (!property) throw notFound('Propriété');

  const units = await Unit.find({ propertyId, organizationId: org(req), deletedAt: null });
  if (units.length === 0) throw new AppError('VALIDATION_ERROR', 'Cette propriété ne contient aucun logement.', 422);

  const activeLeases = await Lease.find({
    propertyId,
    organizationId: org(req),
    status: { $in: ['ACTIVE', 'EXPIRING'] },
    deletedAt: null,
  });

  if (activeLeases.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'Aucun contrat de location actif sur cette propriété pour répartir les charges.', 422);
  }

  const totalSurface = activeLeases.reduce((acc, lease) => {
    const unit = units.find((u) => String(u._id) === String(lease.unitId));
    return acc + (unit?.surfaceM2 ?? 1);
  }, 0);

  const generatedInvoices = [];

  for (const lease of activeLeases) {
    const unit = units.find((u) => String(u._id) === String(lease.unitId));
    let shareMinor = 0;
    if (splitMethod === 'SURFACE' && totalSurface > 0) {
      const surface = unit?.surfaceM2 ?? 1;
      shareMinor = Math.round((totalAmountMinor * surface) / totalSurface);
    } else {
      shareMinor = Math.round(totalAmountMinor / activeLeases.length);
    }

    const invoiceNumber = await nextNumber(org(req), 'FAC');
    const invoice = await Invoice.create({
      organizationId: org(req),
      number: invoiceNumber,
      tenantId: lease.tenantId,
      propertyId: property._id,
      unitId: lease.unitId,
      dueDate,
      items: [{ label, amountMinor: shareMinor, category }],
      totalMinor: shareMinor,
      amountPaidMinor: 0,
      currency: lease.currency,
      status: 'ISSUED',
    });
    generatedInvoices.push({
      invoiceId: String(invoice._id),
      number: invoice.number,
      tenantId: String(lease.tenantId),
      amountMinor: shareMinor,
      unitName: unit?.name ?? 'Lot',
    });
  }

  await audit(req, 'charges.split', String(property._id), {
    propertyId,
    totalAmountMinor,
    splitMethod,
    invoicesCount: generatedInvoices.length,
  });

  res.status(201);
  res.locals.data = {
    propertyId,
    totalAmountMinor,
    splitMethod,
    generatedInvoices,
  };
}

export async function listInvoices(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as Record<string, unknown> & { page: number; pageSize: number; order: 'asc' | 'desc'; sort?: string };
  const filter: Record<string, unknown> = { organizationId: org(req) };
  if (query.status) filter.status = query.status;
  if (query.tenantId) filter.tenantId = query.tenantId;
  if (query.propertyId) filter.propertyId = query.propertyId;

  const page = await paginate(Invoice, filter, query, 'invoice');
  res.locals.data = page.items;
  res.locals.meta = page.meta;
}

export async function sendReceipt(req: Request, res: Response): Promise<void> {
  const receipt = await Receipt.findOne({ _id: req.params.id, organizationId: org(req) });
  if (!receipt) throw notFound('Quittance');

  const tenant = await Tenant.findById(receipt.tenantId);
  if (!tenant) throw notFound('Locataire');

  const recipientEmail = req.body?.email || tenant.email;
  const recipientPhone = req.body?.phone || tenant.phone;

  await Notification.create({
    organizationId: org(req),
    recipientUserId: tenant.userId,
    event: 'PAYMENT_RECEIVED',
    channel: recipientEmail ? 'EMAIL' : 'IN_APP',
    subject: `Quittance de loyer ${receipt.number}`,
    body: `Votre quittance de loyer n° ${receipt.number} d'un montant de ${receipt.amountMinor} ${receipt.currency} est disponible au téléchargement.`,
    status: 'SENT',
    idempotencyKey: `send-receipt:${String(receipt._id)}:${Date.now()}`,
  });

  await audit(req, 'receipt.send', String(receipt._id), { recipientEmail, recipientPhone });
  res.locals.data = { sent: true, receiptNumber: receipt.number, recipientEmail, recipientPhone };
}

/** Dashboard financier complet & Trésorerie (Prompt 2/5 Sections 6 & 7) */
export async function financeDashboard(req: Request, res: Response): Promise<void> {
  const organizationId = org(req);
  const orgObj = new Types.ObjectId(organizationId);
  const now = new Date();
  const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  // 1. Totaux des loyers
  const [scheduleAgg] = await RentSchedule.aggregate<{
    expectedTotal: number;
    collectedTotal: number;
    overdueTotal: number;
  }>([
    { $match: { organizationId: orgObj, status: { $ne: 'CANCELLED' } } },
    {
      $group: {
        _id: null,
        expectedTotal: { $sum: { $add: ['$amountDueMinor', '$penaltyMinor'] } },
        collectedTotal: { $sum: '$amountPaidMinor' },
        overdueTotal: {
          $sum: { $cond: [{ $eq: ['$status', 'OVERDUE'] }, { $subtract: [{ $add: ['$amountDueMinor', '$penaltyMinor'] }, '$amountPaidMinor'] }, 0] },
        },
      },
    },
  ]);

  // 2. Encaissements réels (Payments CONFIRMED)
  const [paymentsAgg] = await Payment.aggregate<{
    totalRevenue: number;
    monthlyRevenue: number;
    annualRevenue: number;
  }>([
    { $match: { organizationId: orgObj, status: 'CONFIRMED' } },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$amountMinor' },
        monthlyRevenue: {
          $sum: { $cond: [{ $gte: ['$paidAt', startOfMonth] }, '$amountMinor', 0] },
        },
        annualRevenue: {
          $sum: { $cond: [{ $gte: ['$paidAt', startOfYear] }, '$amountMinor', 0] },
        },
      },
    },
  ]);

  // 3. Dépenses totales (Transactions EXPENSE non supprimées)
  const [expensesAgg] = await Transaction.aggregate<{
    totalExpenses: number;
    monthlyExpenses: number;
    annualExpenses: number;
  }>([
    { $match: { organizationId: orgObj, direction: 'EXPENSE', deletedAt: null } },
    {
      $group: {
        _id: null,
        totalExpenses: { $sum: '$amountMinor' },
        monthlyExpenses: {
          $sum: { $cond: [{ $gte: ['$date', startOfMonth] }, '$amountMinor', 0] },
        },
        annualExpenses: {
          $sum: { $cond: [{ $gte: ['$date', startOfYear] }, '$amountMinor', 0] },
        },
      },
    },
  ]);

  const totalRevenue = paymentsAgg?.totalRevenue ?? 0;
  const totalExpenses = expensesAgg?.totalExpenses ?? 0;
  const netProfit = totalRevenue - totalExpenses;
  const monthlyRevenue = paymentsAgg?.monthlyRevenue ?? 0;
  const monthlyExpenses = expensesAgg?.monthlyExpenses ?? 0;
  const expectedRent = scheduleAgg?.expectedTotal ?? 0;
  const collectedRent = scheduleAgg?.collectedTotal ?? 0;
  const overdueRent = scheduleAgg?.overdueTotal ?? 0;
  const recoveryRate = expectedRent > 0 ? Math.round((collectedRent / expectedRent) * 100) : 100;

  // 4. Évolution mensuelle sur 12 mois
  const twelveMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const monthlyIncomeAgg = await Payment.aggregate<{ _id: string; total: number }>([
    { $match: { organizationId: orgObj, status: 'CONFIRMED', paidAt: { $gte: twelveMonthsAgo } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$paidAt' } }, total: { $sum: '$amountMinor' } } },
  ]);
  const monthlyExpenseAgg = await Transaction.aggregate<{ _id: string; total: number }>([
    { $match: { organizationId: orgObj, direction: 'EXPENSE', deletedAt: null, date: { $gte: twelveMonthsAgo } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$date' } }, total: { $sum: '$amountMinor' } } },
  ]);

  const monthsMap = new Map<string, { month: string; income: number; expense: number; net: number }>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const mStr = d.toISOString().slice(0, 7);
    monthsMap.set(mStr, { month: mStr, income: 0, expense: 0, net: 0 });
  }
  for (const item of monthlyIncomeAgg) {
    if (monthsMap.has(item._id)) monthsMap.get(item._id)!.income = item.total;
  }
  for (const item of monthlyExpenseAgg) {
    if (monthsMap.has(item._id)) monthsMap.get(item._id)!.expense = item.total;
  }
  const monthlyTrend = Array.from(monthsMap.values()).map((m) => ({
    ...m,
    net: m.income - m.expense,
  }));

  // 5. Dépenses par catégorie
  const expenseByCategory = await Transaction.aggregate<{ category: string; total: number }>([
    { $match: { organizationId: orgObj, direction: 'EXPENSE', deletedAt: null } },
    { $group: { _id: '$category', total: { $sum: '$amountMinor' } } },
    { $project: { _id: 0, category: '$_id', total: 1 } },
  ]);

  // 6. Rentabilité par propriété
  const properties = await Property.find({ organizationId: org(req), deletedAt: null }).lean();
  const profitabilityByProperty = [];

  for (const prop of properties) {
    const [pIncome] = await RentSchedule.aggregate<{ total: number }>([
      { $match: { propertyId: prop._id, organizationId: orgObj, status: { $ne: 'CANCELLED' } } },
      { $group: { _id: null, total: { $sum: '$amountPaidMinor' } } },
    ]);
    const [pExpense] = await Transaction.aggregate<{ total: number }>([
      { $match: { propertyId: prop._id, organizationId: orgObj, direction: 'EXPENSE', deletedAt: null } },
      { $group: { _id: null, total: { $sum: '$amountMinor' } } },
    ]);
    const pUnits = await Unit.countDocuments({ propertyId: prop._id, deletedAt: null });
    const pOccupied = await Unit.countDocuments({ propertyId: prop._id, status: 'OCCUPIED', deletedAt: null });

    profitabilityByProperty.push({
      propertyId: String(prop._id),
      name: prop.name,
      type: prop.type,
      incomeMinor: pIncome?.total ?? 0,
      expenseMinor: pExpense?.total ?? 0,
      netProfitMinor: (pIncome?.total ?? 0) - (pExpense?.total ?? 0),
      unitsCount: pUnits,
      occupancyRate: pUnits > 0 ? Math.round((pOccupied / pUnits) * 100) : 0,
    });
  }

  // 7. Liste des locataires débiteurs
  const overdueSchedules = await RentSchedule.find({
    organizationId: org(req),
    status: 'OVERDUE',
  }).populate('tenantId', 'fullName phone email').sort({ dueDate: 1 }).lean();

  const debtorsMap = new Map<string, { tenantId: string; fullName: string; phone?: string; email?: string; overdueMinor: number; oldestDueDate: Date }>();
  for (const s of overdueSchedules) {
    const t = s.tenantId as unknown as { _id?: unknown; fullName?: string; phone?: string; email?: string };
    const tId = String(t?._id ?? s.tenantId);
    const owed = remainingOf(s);
    if (!debtorsMap.has(tId)) {
      debtorsMap.set(tId, {
        tenantId: tId,
        fullName: t?.fullName ?? 'Locataire',
        phone: t?.phone,
        email: t?.email,
        overdueMinor: owed,
        oldestDueDate: s.dueDate,
      });
    } else {
      debtorsMap.get(tId)!.overdueMinor += owed;
    }
  }

  res.locals.data = {
    overview: {
      totalRevenueMinor: totalRevenue,
      monthlyRevenueMinor: monthlyRevenue,
      annualRevenueMinor: paymentsAgg?.annualRevenue ?? 0,
      totalExpensesMinor: totalExpenses,
      monthlyExpensesMinor: monthlyExpenses,
      annualExpensesMinor: expensesAgg?.annualExpenses ?? 0,
      netProfitMinor: netProfit,
      monthlyNetMinor: monthlyRevenue - monthlyExpenses,
      collectedRentMinor: collectedRent,
      unpaidRentMinor: Math.max(0, expectedRent - collectedRent),
      overdueRentMinor: overdueRent,
      recoveryRate,
      cashBalanceMinor: netProfit,
    },
    monthlyTrend,
    expenseByCategory,
    profitabilityByProperty,
    debtors: Array.from(debtorsMap.values()),
  };
}

export async function financeSummary(req: Request, res: Response): Promise<void> {
  const match: Record<string, unknown> = { organizationId: new Types.ObjectId(org(req)), status: { $ne: 'CANCELLED' } };
  const [totals] = await RentSchedule.aggregate<{ expected: number; collected: number; overdue: number }>([
    { $match: match },
    {
      $group: {
        _id: null,
        expected: { $sum: { $add: ['$amountDueMinor', '$penaltyMinor'] } },
        collected: { $sum: '$amountPaidMinor' },
        overdue: {
          $sum: { $cond: [{ $eq: ['$status', 'OVERDUE'] }, { $subtract: [{ $add: ['$amountDueMinor', '$penaltyMinor'] }, '$amountPaidMinor'] }, 0] },
        },
      },
    },
  ]);
  res.locals.data = {
    expectedMinor: totals?.expected ?? 0,
    collectedMinor: totals?.collected ?? 0,
    remainingMinor: (totals?.expected ?? 0) - (totals?.collected ?? 0),
    overdueMinor: totals?.overdue ?? 0,
  };
}

export async function reconcilePayment(req: Request, res: Response): Promise<void> {
  const payment = await Payment.findOneAndUpdate(
    { _id: req.params.id, organizationId: org(req), reconciledAt: { $exists: false } },
    { reconciledAt: new Date() },
    { new: true },
  );
  if (!payment) throw notFound('Paiement non rapproché');
  await audit(req, 'payment.reconcile', String(payment._id));
  res.locals.data = payment;
}

export async function receiptPdf(req: Request, res: Response): Promise<void> {
  const receipt = await Receipt.findOne({ _id: req.params.id, organizationId: org(req) });
  if (!receipt) throw notFound('Quittance');
  const tenant = await Tenant.findById(receipt.tenantId);
  const organization = await Organization.findById(org(req));
  const payment = await Payment.findById(receipt.paymentId);

  const pdf = await renderPdf({
    title: `QUITTANCE DE LOYER N° ${receipt.number}`,
    subtitle: `Date d'émission : ${receipt.createdAt.toISOString().slice(0, 10)}`,
    organizationName: organization?.name ?? 'DOMORA Immobilier',
    sections: [
      {
        heading: 'Bailleur / Gestionnaire',
        lines: [
          `Organisation : ${organization?.name ?? 'DOMORA'}`,
          ...(organization?.address ? [`Adresse : ${organization.address}`] : []),
          ...(organization?.phone ? [`Téléphone : ${organization.phone}`] : []),
          ...(organization?.email ? [`Email : ${organization.email}`] : []),
        ],
      },
      {
        heading: 'Locataire',
        lines: [
          `Nom complet : ${tenant?.fullName ?? '—'}`,
          ...(tenant?.phone ? [`Téléphone : ${tenant.phone}`] : []),
          ...(tenant?.email ? [`Email : ${tenant.email}`] : []),
        ],
      },
      {
        heading: 'Détails du règlement',
        lines: [
          `Montant acquitté : ${receipt.amountMinor.toLocaleString('fr-FR')} ${receipt.currency}`,
          `Mode de règlement : ${payment?.method ?? 'Espèces'}`,
          `Référence de transaction : ${payment?.reference ?? payment?.number ?? '—'}`,
          `Reçu le : ${payment?.paidAt ? payment.paidAt.toISOString().slice(0, 10) : receipt.createdAt.toISOString().slice(0, 10)}`,
        ],
      },
    ],
    footer: `Document officiel émis par DOMORA pour ${organization?.name ?? 'le bailleur'}. Conservez cette quittance pour faire valoir ce que de droit.`,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="quittance-${receipt.number}.pdf"`);
  res.send(pdf);
}

export async function invoicePdf(req: Request, res: Response): Promise<void> {
  const invoice = await Invoice.findOne({ _id: req.params.id, organizationId: org(req) });
  if (!invoice) throw notFound('Facture');
  const tenant = await Tenant.findById(invoice.tenantId);
  const organization = await Organization.findById(org(req));

  const itemsLines = (invoice.items && invoice.items.length > 0)
    ? invoice.items.map((it) => `${it.label} (${it.category ?? 'Charge'}) : ${it.amountMinor.toLocaleString('fr-FR')} ${invoice.currency}`)
    : [`Total loyer & charges : ${invoice.totalMinor.toLocaleString('fr-FR')} ${invoice.currency}`];

  const pdf = await renderPdf({
    title: `AVIS D'ÉCHÉANCE / FACTURE N° ${invoice.number}`,
    subtitle: `Date d'exigibilité : ${invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : invoice.createdAt.toISOString().slice(0, 10)}`,
    organizationName: organization?.name ?? 'DOMORA Immobilier',
    sections: [
      {
        heading: 'Locataire',
        lines: [
          `Nom : ${tenant?.fullName ?? '—'}`,
          ...(tenant?.phone ? [`Téléphone : ${tenant.phone}`] : []),
        ],
      },
      {
        heading: 'Ventilation des montants dus',
        lines: [
          ...itemsLines,
          `-------------------------------------------`,
          `TOTAL FACTURÉ : ${invoice.totalMinor.toLocaleString('fr-FR')} ${invoice.currency}`,
          `Déjà acquitté : ${invoice.amountPaidMinor.toLocaleString('fr-FR')} ${invoice.currency}`,
          `RESTE À RÉGLER : ${Math.max(0, invoice.totalMinor - invoice.amountPaidMinor).toLocaleString('fr-FR')} ${invoice.currency}`,
          `Statut : ${invoice.status}`,
        ],
      },
    ],
    footer: `Facture émise par DOMORA. Merci d'effectuer votre règlement avant la date d'échéance indiquée.`,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="facture-${invoice.number}.pdf"`);
  res.send(pdf);
}

export async function exportPayments(req: Request, res: Response): Promise<void> {
  const payments = await Payment.find({ organizationId: org(req) }).sort({ paidAt: -1 }).limit(5_000);

  if (req.query.format === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Paiements');
    sheet.addRow(['Numéro', 'Date', 'Montant', 'Devise', 'Mode', 'Statut', 'Référence']);
    for (const payment of payments) {
      sheet.addRow([
        payment.number,
        payment.paidAt.toISOString().slice(0, 10),
        payment.amountMinor,
        payment.currency,
        payment.method,
        payment.status,
        payment.reference ?? '—',
      ]);
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="paiements.xlsx"');
    await workbook.xlsx.write(res);
    return;
  }

  const rows = payments.map((payment) =>
    [
      payment.number,
      payment.paidAt.toISOString().slice(0, 10),
      payment.amountMinor,
      payment.currency,
      payment.method,
      payment.status,
      payment.reference ?? '',
    ].join(','),
  );
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="paiements.csv"');
  res.send(`\uFEFFnumero,date,montant,devise,mode,statut,reference\n${rows.join('\n')}`);
}
