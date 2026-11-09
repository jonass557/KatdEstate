import { z } from 'zod';
import {
  IDENTITY_DOCUMENT_TYPES,
  LEASE_FREQUENCIES,
  LEASE_STATUSES,
  PENALTY_TYPES,
  TENANT_STATUSES,
} from '../constants/statuses.js';
import { objectIdSchema, paginationSchema } from './common.js';

const trimmed = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional();
const amount = z.number().int().nonnegative().max(100_000_000_000);

export const tenantBaseSchema = z.object({
  firstName: optionalText(80),
  lastName: optionalText(80),
  fullName: trimmed(160).optional(),
  phone: optionalText(32),
  email: z.string().trim().email().max(160).optional().or(z.literal('')),
  address: optionalText(240),
  identityDocumentType: z.enum(IDENTITY_DOCUMENT_TYPES).optional(),
  identityDocumentNumber: optionalText(64),
  birthDate: z.coerce.date().optional(),
  emergencyContactName: optionalText(160),
  emergencyContactPhone: optionalText(32),
  profession: optionalText(120),
  loginPassword: optionalText(120),
  notes: optionalText(4_000),
  status: z.enum(TENANT_STATUSES).default('ACTIVE'),
});

export const tenantInputSchema = tenantBaseSchema.refine(
  (data) => Boolean(data.fullName || data.lastName || data.firstName),
  { message: 'Le nom du locataire est obligatoire', path: ['fullName'] },
);

export const tenantUpdateSchema = tenantBaseSchema.partial();

export const tenantListQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  status: z.enum(TENANT_STATUSES).optional(),
});

export const penaltyRuleSchema = z.object({
  type: z.enum(PENALTY_TYPES).default('NONE'),
  /** Montant fixe en unités mineures, ou pourcentage entier (5 = 5 %). */
  value: z.number().int().nonnegative().max(1_000_000).default(0),
  /** Délai de grâce en jours après l'échéance avant application. */
  graceDays: z.number().int().min(0).max(365).default(0),
});

export const leaseInputSchema = z.object({
  tenantId: objectIdSchema,
  unitId: objectIdSchema,
  propertyId: objectIdSchema.optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  rentAmountMinor: amount,
  depositAmountMinor: amount.default(0),
  chargesAmountMinor: amount.default(0),
  frequency: z.enum(LEASE_FREQUENCIES).default('MONTHLY'),
  dueDay: z.number().int().min(1).max(28).default(1),
  penalty: penaltyRuleSchema.default({ type: 'NONE', value: 0, graceDays: 0 }),
  terms: optionalText(8_000),
});

export const leaseUpdateSchema = leaseInputSchema.partial();

export const leaseTerminateSchema = z.object({
  terminationDate: z.coerce.date(),
  reason: trimmed(500),
});

export const leaseListQuerySchema = paginationSchema.extend({
  status: z.enum(LEASE_STATUSES).optional(),
  tenantId: objectIdSchema.optional(),
  unitId: objectIdSchema.optional(),
  propertyId: objectIdSchema.optional(),
});

export type TenantInput = z.infer<typeof tenantInputSchema>;
export type LeaseInput = z.infer<typeof leaseInputSchema>;
