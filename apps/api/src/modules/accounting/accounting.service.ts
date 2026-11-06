import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { recordAudit } from '../../common/audit.js';
import { notFound, paginate } from '../../common/pagination.js';
import { renderPdf } from '../../common/pdf.js';
import { RentSchedule } from '../../models/finance.js';
import { Unit } from '../../models/property.js';
import { Transaction } from '../../models/operations.js';

function org(req: Request): string {
  return req.organizationContext!.organizationId;
}

export async function createTransaction(req: Request, res: Response): Promise<void> {
  const transaction = await Transaction.create({
    ...req.body,
    organizationId: org(req),
    currency: 'XOF',
  });
  await recordAudit({
    organizationId: org(req),
    ...(req.user?.id ? { actorId: req.user.id } : {}),
    action: 'transaction.create',
    resourceType: 'Transaction',
    resourceId: String(transaction._id),
    requestId: req.requestId,
  });
  res.status(201);
  res.locals.data = transaction;
}

export async function listTransactions(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as Record<string, unknown> & {
    page: number;
    pageSize: number;
    order: 'asc' | 'desc';
    sort?: string;
  };
  const filter: Record<string, unknown> = { organizationId: org(req), deletedAt: null };
  for (const key of ['direction', 'category', 'propertyId', 'status'] as const) {
    if (query[key]) filter[key] = query[key];
  }
  if (query.from || query.to) {
    filter.date = {
      ...(query.from ? { $gte: query.from } : {}),
      ...(query.to ? { $lte: query.to } : {}),
    };
  }
  const page = await paginate(Transaction, filter, query, 'transaction');
  res.locals.data = page.items;
  res.locals.meta = page.meta;
}

export async function updateTransaction(req: Request, res: Response): Promise<void> {
  const transaction = await Transaction.findOneAndUpdate(
    { _id: req.params.id, organizationId: org(req), deletedAt: null },
    req.body,
    { new: true },
  );
  if (!transaction) throw notFound('Transaction');
  await recordAudit({
    organizationId: org(req),
    ...(req.user?.id ? { actorId: req.user.id } : {}),
    action: 'transaction.update',
    resourceType: 'Transaction',
    resourceId: String(transaction._id),
    requestId: req.requestId,
  });
  res.locals.data = transaction;
}

export async function approveExpense(req: Request, res: Response): Promise<void> {
  const transaction = await Transaction.findOne({
    _id: req.params.id,
    organizationId: org(req),
    deletedAt: null,
  });
  if (!transaction) throw notFound('Transaction');
  transaction.status = 'APPROVED';
  if (req.user?.id) transaction.approvedBy = new Types.ObjectId(req.user.id);
  transaction.approvedAt = new Date();
  await transaction.save();

  await recordAudit({
    organizationId: org(req),
    ...(req.user?.id ? { actorId: req.user.id } : {}),
    action: 'expense.approve',
    resourceType: 'Transaction',
    resourceId: String(transaction._id),
    requestId: req.requestId,
  });
  res.locals.data = transaction;
}

export async function rejectExpense(req: Request, res: Response): Promise<void> {
  const transaction = await Transaction.findOne({
    _id: req.params.id,
    organizationId: org(req),
    deletedAt: null,
  });
  if (!transaction) throw notFound('Transaction');
  transaction.status = 'REJECTED';
  transaction.rejectionReason = req.body.reason;
  await transaction.save();

  await recordAudit({
    organizationId: org(req),
    ...(req.user?.id ? { actorId: req.user.id } : {}),
    action: 'expense.reject',
    resourceType: 'Transaction',
    resourceId: String(transaction._id),
    requestId: req.requestId,
  });
  res.locals.data = transaction;
}

export async function payExpense(req: Request, res: Response): Promise<void> {
  const transaction = await Transaction.findOne({
    _id: req.params.id,
    organizationId: org(req),
    deletedAt: null,
  });
  if (!transaction) throw notFound('Transaction');
  transaction.status = 'PAID';
  await transaction.save();

  await recordAudit({
    organizationId: org(req),
    ...(req.user?.id ? { actorId: req.user.id } : {}),
    action: 'expense.pay',
    resourceType: 'Transaction',
    resourceId: String(transaction._id),
    requestId: req.requestId,
  });
  res.locals.data = transaction;
}

export async function deleteTransaction(req: Request, res: Response): Promise<void> {
  const transaction = await Transaction.findOneAndUpdate(
    { _id: req.params.id, organizationId: org(req), deletedAt: null },
    { deletedAt: new Date() },
  );
  if (!transaction) throw notFound('Transaction');
  res.locals.data = { id: String(transaction._id), deleted: true };
}

interface ReportFigures {
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
  incomeByMonth: { month: string; total: number }[];
  expenseByMonth: { month: string; total: number }[];
  expenseByCategory: { category: string; total: number }[];
  incomeByProperty: { propertyId: string; total: number }[];
  occupancyRate: number;
  arrearsRate: number;
}

/** Rapport financier sur une période libre. Tous les chiffres sont calculés. */
export async function report(req: Request, res: Response): Promise<void> {
  res.locals.data = await computeReport(org(req), req.query as never);
}

async function computeReport(
  organizationId: string,
  query: { from: Date; to: Date; propertyId?: string },
): Promise<ReportFigures> {
  const match: Record<string, unknown> = {
    organizationId: new Types.ObjectId(organizationId),
    deletedAt: null,
    date: { $gte: query.from, $lte: query.to },
    ...(query.propertyId ? { propertyId: new Types.ObjectId(query.propertyId) } : {}),
  };

  const grouped = await Transaction.aggregate<{
    _id: { direction: string; month: string };
    total: number;
  }>([
    { $match: match },
    {
      $group: {
        _id: {
          direction: '$direction',
          month: { $dateToString: { format: '%Y-%m', date: '$date' } },
        },
        total: { $sum: '$amountMinor' },
      },
    },
  ]);

  const byCategory = await Transaction.aggregate<{ _id: string; total: number }>([
    { $match: { ...match, direction: 'EXPENSE' } },
    { $group: { _id: '$category', total: { $sum: '$amountMinor' } } },
  ]);

  const byProperty = await Transaction.aggregate<{ _id: Types.ObjectId; total: number }>([
    { $match: { ...match, direction: 'INCOME', propertyId: { $ne: null } } },
    { $group: { _id: '$propertyId', total: { $sum: '$amountMinor' } } },
  ]);

  const incomeMinor = grouped
    .filter((row) => row._id.direction === 'INCOME')
    .reduce((sum, row) => sum + row.total, 0);
  const expenseMinor = grouped
    .filter((row) => row._id.direction === 'EXPENSE')
    .reduce((sum, row) => sum + row.total, 0);

  const unitFilter = {
    organizationId,
    deletedAt: null,
    ...(query.propertyId ? { propertyId: query.propertyId } : {}),
  };
  const units = await Unit.countDocuments(unitFilter);
  const occupied = await Unit.countDocuments({ ...unitFilter, status: 'OCCUPIED' });

  const schedules = await RentSchedule.aggregate<{ expected: number; overdue: number }>([
    {
      $match: {
        organizationId: new Types.ObjectId(organizationId),
        dueDate: { $gte: query.from, $lte: query.to },
        status: { $ne: 'CANCELLED' },
      },
    },
    {
      $group: {
        _id: null,
        expected: { $sum: '$amountDueMinor' },
        overdue: {
          $sum: {
            $cond: [
              { $eq: ['$status', 'OVERDUE'] },
              { $subtract: ['$amountDueMinor', '$amountPaidMinor'] },
              0,
            ],
          },
        },
      },
    },
  ]);

  return {
    incomeMinor,
    expenseMinor,
    netMinor: incomeMinor - expenseMinor,
    incomeByMonth: grouped
      .filter((row) => row._id.direction === 'INCOME')
      .map((row) => ({ month: row._id.month, total: row.total })),
    expenseByMonth: grouped
      .filter((row) => row._id.direction === 'EXPENSE')
      .map((row) => ({ month: row._id.month, total: row.total })),
    expenseByCategory: byCategory.map((row) => ({ category: row._id, total: row.total })),
    incomeByProperty: byProperty.map((row) => ({ propertyId: String(row._id), total: row.total })),
    occupancyRate: units === 0 ? 0 : Math.round((occupied / units) * 1000) / 10,
    arrearsRate:
      !schedules[0] || schedules[0].expected === 0
        ? 0
        : Math.round((schedules[0].overdue / schedules[0].expected) * 1000) / 10,
  };
}

/**
 * Prévision de trésorerie.
 *
 * Estimation calculée uniquement à partir des échéances connues encore dues.
 * Les impayés constatés ne sont pas comptés comme des recettes futures : rien
 * ne garantit leur règlement. Ce chiffre n'est pas une prévision garantie.
 */
export async function forecast(req: Request, res: Response): Promise<void> {
  const rows = await RentSchedule.aggregate<{ _id: string; total: number }>([
    {
      $match: {
        organizationId: new Types.ObjectId(org(req)),
        status: { $in: ['PENDING', 'PARTIAL'] },
        dueDate: { $gte: new Date() },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$dueDate' } },
        total: {
          $sum: { $subtract: [{ $add: ['$amountDueMinor', '$penaltyMinor'] }, '$amountPaidMinor'] },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  res.locals.data = {
    disclaimer:
      'Estimation calculée à partir des échéances connues. Ce n’est pas une garantie de trésorerie : les impayés déjà constatés sont exclus.',
    months: rows.map((row) => ({ month: row._id, expectedMinor: row.total })),
  };
}

export async function reportPdf(req: Request, res: Response): Promise<void> {
  const figures = await computeReport(org(req), req.query as never);
  const pdf = await renderPdf({
    title: 'Rapport financier',
    subtitle: 'Les montants sont des constats sur la période demandée.',
    organizationName: 'RentFlow',
    sections: [
      {
        lines: [
          `Revenus : ${figures.incomeMinor}`,
          `Dépenses : ${figures.expenseMinor}`,
          `Bénéfice net : ${figures.netMinor}`,
          `Taux d'occupation : ${figures.occupancyRate} %`,
          `Taux d'impayés : ${figures.arrearsRate} %`,
        ],
      },
    ],
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.send(pdf);
}

export async function exportTransactions(req: Request, res: Response): Promise<void> {
  const transactions = await Transaction.find({ organizationId: org(req), deletedAt: null })
    .sort({ date: -1 })
    .limit(5_000);
  const rows = transactions.map((transaction) =>
    [
      transaction.date.toISOString().slice(0, 10),
      transaction.direction,
      transaction.category,
      transaction.amountMinor,
      transaction.label.replace(/"/g, '""'),
    ].join(','),
  );
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.send(`\uFEFFdate,sens,categorie,montant,libelle\n${rows.join('\n')}`);
}
