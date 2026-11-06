import { z } from 'zod';
import {
  AGENT_PLAN_CODES,
  AGENT_TYPES,
  COMMISSION_TYPES,
  LEAD_STATUSES,
  LISTING_STATUSES,
  LISTING_TRANSACTION_TYPES,
  MANDATE_STATUSES,
  MANDATE_TYPES,
  MARKETPLACE_PROPERTY_CATEGORIES,
  MARKETPLACE_PROPERTY_TYPES,
  OFFER_STATUSES,
  VIEWING_STATUSES,
} from '../constants/statuses.js';

export const photoInputSchema = z.object({
  url: z.string().url('L’URL de la photo doit être valide'),
  isPrimary: z.boolean().default(false),
  caption: z.string().max(160).optional(),
});

export const documentRefSchema = z.object({
  name: z.string().min(1).max(160),
  url: z.string().url('L’URL du document doit être valide'),
});

export const listingInputSchema = z.object({
  propertyId: z.string().optional(),
  unitId: z.string().optional(),
  mandateId: z.string().optional(),
  title: z.string().min(3, 'Le titre doit comporter au moins 3 caractères').max(200),
  description: z
    .string()
    .min(10, 'La description doit comporter au moins 10 caractères')
    .max(10_000),
  category: z.enum(MARKETPLACE_PROPERTY_CATEGORIES),
  propertyType: z.enum(MARKETPLACE_PROPERTY_TYPES),
  transactionType: z.enum(LISTING_TRANSACTION_TYPES),
  priceMinor: z.number().int().min(0, 'Le prix ne peut pas être négatif'),
  currency: z.string().length(3).default('XOF'),
  location: z.object({
    country: z.string().length(2).default('SN'),
    city: z.string().min(1, 'La ville est obligatoire').max(120),
    district: z.string().max(120).optional(),
    address: z.string().max(240).optional(),
    hideExactAddress: z.boolean().default(false),
  }),
  surfaceM2: z.number().min(0).optional(),
  bedrooms: z.number().int().min(0).optional(),
  bathrooms: z.number().int().min(0).optional(),
  roomsCount: z.number().int().min(0).optional(),
  floorsCount: z.number().int().min(0).optional(),
  condition: z.string().max(80).optional(),
  availabilityDate: z.string().optional(),
  isTitled: z.boolean().default(false),
  landTitleNumber: z.string().max(120).optional(),
  amenities: z.array(z.string().max(80)).default([]),
  photos: z.array(photoInputSchema).default([]),
  videos: z.array(z.string().url()).default([]),
  documents: z.array(documentRefSchema).default([]),
  status: z.enum(LISTING_STATUSES).default('PENDING_REVIEW'),
});

export type ListingInput = z.infer<typeof listingInputSchema>;

export const listingUpdateSchema = listingInputSchema.partial();
export type ListingUpdate = z.infer<typeof listingUpdateSchema>;

export const listingFilterSchema = z.object({
  q: z.string().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  category: z.enum(MARKETPLACE_PROPERTY_CATEGORIES).optional(),
  propertyType: z.enum(MARKETPLACE_PROPERTY_TYPES).optional(),
  transactionType: z.enum(LISTING_TRANSACTION_TYPES).optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  minSurface: z.coerce.number().optional(),
  maxSurface: z.coerce.number().optional(),
  bedrooms: z.coerce.number().optional(),
  isTitled: z.coerce.boolean().optional(),
  isVerified: z.coerce.boolean().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
});

export type ListingFilter = z.infer<typeof listingFilterSchema>;

export const mandateInputSchema = z.object({
  agentId: z.string().min(1, 'L’identifiant de l’agent est requis'),
  propertyId: z.string().optional(),
  listingId: z.string().optional(),
  mandateType: z.enum(MANDATE_TYPES),
  commissionType: z.enum(COMMISSION_TYPES).default('PERCENTAGE'),
  commissionRate: z.number().min(0, 'Le taux ou montant de commission doit être positif'),
  startDate: z.string().min(1, 'Date de début requise'),
  endDate: z.string().min(1, 'Date d’expiration requise'),
  terms: z.string().max(4_000).optional(),
  authorizedRights: z.array(z.string()).default(['PUBLISH', 'NEGOTIATE', 'ORGANIZE_VIEWINGS']),
  documents: z.array(documentRefSchema).default([]),
});

export type MandateInput = z.infer<typeof mandateInputSchema>;

export const mandateUpdateSchema = z.object({
  status: z.enum(MANDATE_STATUSES).optional(),
  terms: z.string().max(4_000).optional(),
  authorizedRights: z.array(z.string()).optional(),
  endDate: z.string().optional(),
  note: z.string().max(1_000).optional(),
});

export type MandateUpdate = z.infer<typeof mandateUpdateSchema>;

export const leadInputSchema = z.object({
  fullName: z.string().min(2, 'Le nom doit comporter au moins 2 caractères').max(160),
  phone: z.string().min(5, 'Numéro de téléphone requis').max(32),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  searchType: z.enum(['BUY', 'RENT']).default('BUY'),
  budgetMinor: z.number().min(0).optional(),
  currency: z.string().length(3).default('XOF'),
  targetCity: z.string().max(120).optional(),
  targetDistrict: z.string().max(120).optional(),
  targetPropertyType: z.string().max(80).optional(),
  status: z.enum(LEAD_STATUSES).default('NEW'),
  associatedListings: z.array(z.string()).default([]),
  notes: z.string().max(4_000).optional(),
});

export type LeadInput = z.infer<typeof leadInputSchema>;

export const viewingInputSchema = z.object({
  listingId: z.string().min(1, 'L’annonce concernée est requise'),
  date: z.string().min(1, 'La date et l’heure de visite sont requises'),
  prospectName: z.string().min(2, 'Nom du prospect requis').max(160),
  prospectPhone: z.string().min(5, 'Téléphone requis').max(32),
  prospectEmail: z.string().email().optional().or(z.literal('')),
  notes: z.string().max(2_000).optional(),
});

export type ViewingInput = z.infer<typeof viewingInputSchema>;

export const viewingUpdateSchema = z.object({
  status: z.enum(VIEWING_STATUSES).optional(),
  date: z.string().optional(),
  notes: z.string().max(2_000).optional(),
  feedback: z.string().max(2_000).optional(),
});

export type ViewingUpdate = z.infer<typeof viewingUpdateSchema>;

export const offerInputSchema = z.object({
  listingId: z.string().min(1, 'L’annonce concernée est requise'),
  offeredAmountMinor: z.number().int().min(1, 'Le montant offert doit être supérieur à zéro'),
  currency: z.string().length(3).default('XOF'),
  prospectName: z.string().min(2, 'Nom du proposant requis').max(160),
  prospectPhone: z.string().min(5, 'Téléphone requis').max(32),
  prospectEmail: z.string().email().optional().or(z.literal('')),
  message: z.string().max(4_000).optional(),
});

export type OfferInput = z.infer<typeof offerInputSchema>;

export const offerDecisionSchema = z.object({
  decision: z.enum(['ACCEPT', 'REJECT', 'COUNTER']),
  counterOfferAmountMinor: z.number().int().min(1).optional(),
  note: z.string().max(2_000).optional(),
});

export type OfferDecision = z.infer<typeof offerDecisionSchema>;

export const agentProfileInputSchema = z.object({
  firstName: z.string().min(2).max(120),
  lastName: z.string().min(2).max(120),
  phone: z.string().min(5).max(32),
  email: z.string().email(),
  city: z.string().min(1).max(120),
  country: z.string().length(2).default('SN'),
  activityZone: z.string().max(160).optional(),
  bio: z.string().max(4_000).optional(),
  experienceYears: z.number().int().min(0).default(0),
  specialties: z.array(z.string().max(80)).default([]),
  agencyName: z.string().max(160).optional(),
  agentType: z.enum(AGENT_TYPES).default('INDEPENDENT'),
  photoUrl: z.string().url().optional().or(z.literal('')),
  documents: z.array(documentRefSchema).default([]),
});

export type AgentProfileInput = z.infer<typeof agentProfileInputSchema>;

export const agentPlanInputSchema = z.object({
  code: z.enum(AGENT_PLAN_CODES),
  name: z.string().min(2).max(120),
  priceMinor: z.number().int().min(0),
  currency: z.string().length(3).default('XOF'),
  durationMonths: z.number().int().min(1).default(1),
  trialDays: z.number().int().min(0).default(14),
  maxActiveListings: z.number().int().min(1),
  maxPhotosPerListing: z.number().int().min(1),
  maxVideosPerListing: z.number().int().min(0).default(0),
  featuredListingsQuota: z.number().int().min(0).default(0),
  advancedAnalytics: z.boolean().default(false),
  leadManagement: z.boolean().default(false),
  maxCollaborators: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export type AgentPlanInput = z.infer<typeof agentPlanInputSchema>;
