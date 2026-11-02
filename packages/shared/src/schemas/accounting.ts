import { z } from 'zod';
import { EXPENSE_CATEGORIES, EXPENSE_STATUSES, TRANSACTION_DIRECTIONS } from '../constants/statuses.js';
import { objectIdSchema, paginationSchema } from './common.js';

const amount = z.number().int().positive().max(100_000_000_000);

export const transactionInputSchema = z.object({
  direction: z.enum(TRANSACTION_DIRECTIONS),
  category: z.enum(EXPENSE_CATEGORIES),
  amountMinor: amount,
  date: z.coerce.date(),
  label: z.string().trim().min(1).max(200),
  note: z.string().trim().max(2_000).optional(),
  propertyId: objectIdSchema.optional(),
  buildingId: objectIdSchema.optional(),
  unitId: objectIdSchema.optional(),
  tenantId: objectIdSchema.optional(),
  vendorId: objectIdSchema.optional(),
  payee: z.string().trim().max(160).optional(),
  receiptFileId: objectIdSchema.optional(),
  status: z.enum(EXPENSE_STATUSES).default('APPROVED'),
});

export const transactionUpdateSchema = transactionInputSchema.partial();

export const expenseRejectSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export const transactionListQuerySchema = paginationSchema.extend({
  direction: z.enum(TRANSACTION_DIRECTIONS).optional(),
  category: z.enum(EXPENSE_CATEGORIES).optional(),
  propertyId: objectIdSchema.optional(),
  status: z.enum(EXPENSE_STATUSES).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const reportPeriodQuerySchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
    propertyId: objectIdSchema.optional(),
  })
  .refine((value) => value.to.getTime() >= value.from.getTime(), {
    message: 'La date de fin précède la date de début.',
    path: ['to'],
  });

export type TransactionInput = z.infer<typeof transactionInputSchema>;
