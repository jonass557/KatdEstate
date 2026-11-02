import { z } from 'zod';
import {
  MAINTENANCE_PRIORITIES,
  MAINTENANCE_STATUSES,
  VENDOR_TRADES,
} from '../constants/statuses.js';
import { objectIdSchema, paginationSchema } from './common.js';

const trimmed = (max: number) => z.string().trim().min(1).max(max);
const amount = z.number().int().nonnegative().max(100_000_000_000);

export const maintenanceTicketInputSchema = z.object({
  category: trimmed(80),
  title: trimmed(160),
  description: z.string().trim().max(4_000).optional(),
  priority: z.enum(MAINTENANCE_PRIORITIES).default('MEDIUM'),
  propertyId: objectIdSchema.optional(),
  unitId: objectIdSchema.optional(),
  buildingId: objectIdSchema.optional(),
  estimatedCostMinor: amount.optional(),
  scheduledAt: z.coerce.date().optional(),
  photos: z.array(objectIdSchema).optional(),
});

export const maintenanceTicketUpdateSchema = maintenanceTicketInputSchema.partial().extend({
  status: z.enum(MAINTENANCE_STATUSES).optional(),
  vendorId: objectIdSchema.nullable().optional(),
  actualCostMinor: amount.optional(),
  completedAt: z.coerce.date().optional(),
  validateExpense: z.boolean().optional(),
});

export const maintenanceListQuerySchema = paginationSchema.extend({
  status: z.enum(MAINTENANCE_STATUSES).optional(),
  priority: z.enum(MAINTENANCE_PRIORITIES).optional(),
  propertyId: objectIdSchema.optional(),
  unitId: objectIdSchema.optional(),
});

export const vendorInputSchema = z.object({
  name: trimmed(160),
  trade: z.enum(VENDOR_TRADES),
  phone: z.string().trim().max(32).optional(),
  email: z.string().trim().email().max(160).optional().or(z.literal('')),
  notes: z.string().trim().max(2_000).optional(),
});

export const maintenanceTaskInputSchema = z.object({
  ticketId: objectIdSchema,
  title: trimmed(160),
  vendorId: objectIdSchema.optional(),
});

export type MaintenanceTicketInput = z.infer<typeof maintenanceTicketInputSchema>;
export type VendorInput = z.infer<typeof vendorInputSchema>;
