import { z } from 'zod';
import { UTILITY_TYPES } from '../constants/statuses.js';
import { objectIdSchema, paginationSchema } from './common.js';

const index = z.number().nonnegative().max(1_000_000_000);

export const utilityMeterInputSchema = z.object({
  type: z.enum(UTILITY_TYPES),
  label: z.string().trim().min(1).max(160),
  serialNumber: z.string().trim().max(80).optional(),
  propertyId: objectIdSchema.optional(),
  buildingId: objectIdSchema.optional(),
  unitId: objectIdSchema.optional(),
  /** Prix d'une unité de consommation, en unités mineures (ex. FCFA par kWh). */
  unitPriceMinor: z.number().int().nonnegative().max(100_000_000),
  /** Au-delà de ce multiple de la moyenne, la consommation est signalée anormale. */
  anomalyMultiplier: z.number().min(1).max(100).default(2),
});

export const utilityMeterUpdateSchema = utilityMeterInputSchema.partial();

export const utilityReadingInputSchema = z
  .object({
    meterId: objectIdSchema,
    previousIndex: index,
    currentIndex: index,
    readAt: z.coerce.date(),
  })
  .refine((value) => value.currentIndex >= value.previousIndex, {
    message: "Le nouvel index ne peut pas être inférieur à l'ancien.",
    path: ['currentIndex'],
  });

export const utilityListQuerySchema = paginationSchema.extend({
  type: z.enum(UTILITY_TYPES).optional(),
  propertyId: objectIdSchema.optional(),
  unitId: objectIdSchema.optional(),
});

export type UtilityMeterInput = z.infer<typeof utilityMeterInputSchema>;
export type UtilityReadingInput = z.infer<typeof utilityReadingInputSchema>;
