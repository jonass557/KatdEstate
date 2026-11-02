import { z } from 'zod';
import { DEPOSIT_TRANSACTION_TYPES, PAYMENT_METHODS, RENT_SCHEDULE_STATUSES } from '../constants/statuses.js';
import { objectIdSchema, paginationSchema } from './common.js';

const amount = z.number().int().positive().max(100_000_000_000);

export const recordPaymentSchema = z.object({
  rentScheduleId: objectIdSchema,
  amountMinor: amount,
  method: z.enum(PAYMENT_METHODS),
  paidAt: z.coerce.date().optional(),
  reference: z.string().trim().max(120).optional(),
  note: z.string().trim().max(500).optional(),
  /** Empêche un double enregistrement du même paiement. */
  idempotencyKey: z.string().trim().min(8).max(120),
});

export const refundPaymentSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export const cancelScheduleSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export const updateScheduleSchema = z.object({
  dueDate: z.coerce.date().optional(),
  amountDueMinor: z.number().int().nonnegative().optional(),
  penaltyMinor: z.number().int().nonnegative().optional(),
  reason: z.string().trim().min(1).max(500),
});

export const recordDepositSchema = z.object({
  leaseId: objectIdSchema,
  type: z.enum(DEPOSIT_TRANSACTION_TYPES),
  amountMinor: amount,
  note: z.string().trim().max(500).optional(),
});

export const applyLatePenaltiesSchema = z.object({
  asOfDate: z.coerce.date().optional(),
  propertyId: objectIdSchema.optional(),
});

export const chargeSplitSchema = z.object({
  propertyId: objectIdSchema,
  label: z.string().trim().min(1).max(200),
  category: z.enum(['WATER', 'ELECTRICITY', 'INTERNET', 'CLEANING', 'OTHER']),
  totalAmountMinor: amount,
  splitMethod: z.enum(['EQUAL', 'SURFACE']).default('EQUAL'),
  dueDate: z.coerce.date(),
  note: z.string().trim().max(500).optional(),
});

export const sendReceiptSchema = z.object({
  email: z.string().trim().email().optional(),
  phone: z.string().trim().max(32).optional(),
});

export const financeListQuerySchema = paginationSchema.extend({
  status: z.enum(RENT_SCHEDULE_STATUSES).optional(),
  method: z.enum(PAYMENT_METHODS).optional(),
  propertyId: objectIdSchema.optional(),
  tenantId: objectIdSchema.optional(),
  unitId: objectIdSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;
export type RecordDepositInput = z.infer<typeof recordDepositSchema>;
export type ChargeSplitInput = z.infer<typeof chargeSplitSchema>;
