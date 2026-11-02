import { z } from 'zod';

export const IKEEPAY_OPERATORS = [
  'ORANGE',
  'MTN',
  'WAVE',
  'MOOV',
  'MOBICASH',
  'AIRTEL',
  'VODACOM',
  'OTHER',
] as const;

export type IkeepayOperator = (typeof IKEEPAY_OPERATORS)[number];

export const IKEEPAY_ENVIRONMENTS = ['SANDBOX', 'LIVE'] as const;
export type IkeepayEnvironment = (typeof IKEEPAY_ENVIRONMENTS)[number];

export const ikeepayConfigSchema = z.object({
  publicKey: z.string().trim().min(1, 'La clé publique est requise.'),
  secretKey: z.string().trim().min(1, 'La clé secrète est requise.'),
  environment: z.enum(IKEEPAY_ENVIRONMENTS).default('LIVE'),
  isActive: z.boolean().default(true),
  webhookSecret: z.string().trim().optional(),
});

export type IkeepayConfigInput = z.infer<typeof ikeepayConfigSchema>;

export const ikeepayPayinInputSchema = z.object({
  amount: z.number().int().positive('Le montant doit être un entier positif.'),
  currency: z.string().trim().length(3).default('XOF'),
  country: z.string().trim().length(2).default('CI'),
  phoneNumber: z.string().trim().min(8, 'Numéro de téléphone invalide.'),
  operator: z.enum(IKEEPAY_OPERATORS),
  customerEmail: z.string().trim().email('Email client invalide.').optional(),
  otp: z.string().trim().optional(),
  purpose: z.enum([
    'RENT_PAYMENT',
    'CHEFFERIE_COMMISSION',
    'SUBSCRIPTION_PAYMENT',
    'MARKETPLACE_DEPOSIT',
    'OTHER',
  ]),
  referenceId: z.string().trim().optional(),
  description: z.string().trim().max(255).optional(),
});

export type IkeepayPayinInput = z.infer<typeof ikeepayPayinInputSchema>;

export const ikeepayPayoutInputSchema = z.object({
  amount: z.number().int().positive('Le montant doit être un entier positif.'),
  currency: z.string().trim().length(3).default('XOF'),
  country: z.string().trim().length(2).default('CI'),
  phoneNumber: z.string().trim().min(8, 'Numéro de téléphone invalide.'),
  operator: z.enum(IKEEPAY_OPERATORS),
  beneficiaryName: z.string().trim().min(2, 'Nom du bénéficiaire requis.'),
  description: z.string().trim().max(255).optional(),
});

export type IkeepayPayoutInput = z.infer<typeof ikeepayPayoutInputSchema>;
