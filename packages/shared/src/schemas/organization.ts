import { z } from 'zod';
import { ORGANIZATION_ROLES } from '../constants/roles.js';
import { emailSchema } from './auth.js';
import { objectIdSchema } from './common.js';

/** Validation d'un code pays ISO 3166-1 alpha-2. */
export const isoCountrySchema = z
  .string()
  .trim()
  .length(2, 'Le code pays doit comporter 2 lettres (ISO 3166-1)')
  .toUpperCase();

/** Devises sans décimales, fréquentes en Afrique francophone. */
const ZERO_DECIMAL_CURRENCIES = new Set(['XOF', 'XAF', 'JPY', 'KRW', 'VND', 'CLP', 'ISK']);

export function minorUnitExponent(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 0 : 2;
}

/** Validation d'un code devise ISO 4217 via Intl (source de vérité). */
export function isValidCurrency(currency: string): boolean {
  try {
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency });
    return true;
  } catch {
    return false;
  }
}

/** Validation d'un fuseau IANA via Intl (source de vérité). */
export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('fr-FR', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export const currencySchema = z
  .string()
  .trim()
  .length(3, 'Le code devise doit comporter 3 lettres (ISO 4217)')
  .toUpperCase()
  .refine(isValidCurrency, 'Code devise ISO 4217 inconnu');

export const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine(isValidTimezone, 'Fuseau horaire IANA inconnu');

export const localeSchema = z.string().trim().min(2).max(10);

export const organizationNameSchema = z.string().trim().min(2).max(160);

export const notificationSettingsSchema = z
  .object({
    emailRentReminder: z.boolean().default(true),
    smsRentReminder: z.boolean().default(false),
    whatsappRentReminder: z.boolean().default(false),
    emailMaintenanceAlert: z.boolean().default(true),
    reminderDaysBeforeDue: z.number().int().min(1).max(30).default(5),
  })
  .partial();

export const billingSettingsSchema = z
  .object({
    taxIdentificationNumber: z.string().trim().max(64).optional(),
    invoicePrefix: z.string().trim().max(16).default('FACT-'),
    receiptPrefix: z.string().trim().max(16).default('RECU-'),
    lateFeePercentage: z.number().min(0).max(100).default(0),
    defaultPaymentTermsDays: z.number().int().min(0).max(90).default(5),
  })
  .partial();

export const createOrganizationSchema = z.object({
  name: organizationNameSchema,
  country: isoCountrySchema,
  currency: currencySchema,
  timezone: timezoneSchema.default('Africa/Dakar'),
  locale: localeSchema.default('fr'),
  logo: z.string().trim().max(512).optional(),
  address: z.string().trim().max(240).optional(),
  phone: z.string().trim().max(32).optional(),
  email: z.string().trim().email().max(160).optional().or(z.literal('')),
  notificationSettings: notificationSettingsSchema.optional(),
  billingSettings: billingSettingsSchema.optional(),
});

export const updateOrganizationSchema = createOrganizationSchema.partial();

export const inviteMemberSchema = z.object({
  email: emailSchema,
  role: z.enum(ORGANIZATION_ROLES),
});

export const updateMemberSchema = z
  .object({
    role: z.enum(ORGANIZATION_ROLES).optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  })
  .refine((value) => value.role !== undefined || value.status !== undefined, {
    message: 'Aucune modification fournie',
  });

export const organizationIdParamSchema = z.object({ organizationId: objectIdSchema });

export type CreateOrganizationInput = z.input<typeof createOrganizationSchema>;
export type InviteMemberInput = z.input<typeof inviteMemberSchema>;
