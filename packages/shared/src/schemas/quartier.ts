import { z } from 'zod';
import {
  ANNOUNCEMENT_SCOPES,
  ANNOUNCEMENT_TYPES,
  CENSUS_STATUSES,
  INCIDENT_CATEGORIES,
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
  QUARTIER_PLAN_CODES,
  RESIDENCE_OCCUPANCY_STATUSES,
  RESIDENCE_TYPES,
} from '../constants/statuses.js';
import { objectIdSchema } from './common.js';

// 1. Division Administrative & Territoriale
export const geoCityInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  region: z.string().trim().max(120).optional(),
  country: z.string().trim().length(2).default('SN'),
});

export const geoDistrictInputSchema = z.object({
  cityId: objectIdSchema,
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().max(20).optional(),
});

export const geoNeighborhoodInputSchema = z.object({
  cityId: objectIdSchema,
  districtId: objectIdSchema.optional(),
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().max(20).optional(),
});

export const geoBlockInputSchema = z.object({
  neighborhoodId: objectIdSchema,
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().max(20).optional(),
  description: z.string().trim().max(1_000).optional(),
  boundaryCoordinates: z
    .array(
      z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      })
    )
    .optional(),
});

// 2. Attribution de Responsabilité de Secteur
export const sectorAssignmentInputSchema = z.object({
  userId: objectIdSchema,
  role: z.enum(['NEIGHBORHOOD_LEADER', 'BLOCK_LEADER']),
  cityId: objectIdSchema,
  districtId: objectIdSchema.optional(),
  neighborhoodId: objectIdSchema,
  blockId: objectIdSchema.optional(),
  startDate: z.string().or(z.date()).optional(),
  endDate: z.string().or(z.date()).optional(),
  notes: z.string().trim().max(1_000).optional(),
});

// 3. Recensement des Propriétés & Résidences
export const residenceInputSchema = z.object({
  cityId: objectIdSchema,
  districtId: objectIdSchema.optional(),
  neighborhoodId: objectIdSchema,
  blockId: objectIdSchema,
  buildingType: z.enum(RESIDENCE_TYPES),
  address: z.string().trim().min(3).max(240),
  landmark: z.string().trim().max(240).optional(),
  locationGeo: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .optional(),
  dwellingsCount: z.number().int().min(1).default(1),
  occupancyStatus: z.enum(RESIDENCE_OCCUPANCY_STATUSES).default('OCCUPIED'),
  ownerName: z.string().trim().max(160).optional(),
  ownerPhone: z.string().trim().max(32).optional(),
  notes: z.string().trim().max(2_000).optional(),
});

// 4. Logement au sein d'un immeuble (Dwelling)
export const dwellingInputSchema = z.object({
  residenceId: objectIdSchema,
  dwellingNumber: z.string().trim().min(1).max(80),
  floor: z.number().int().optional(),
  occupancyStatus: z.enum(RESIDENCE_OCCUPANCY_STATUSES).default('OCCUPIED'),
  roomsCount: z.number().int().min(1).optional(),
});

// 5. Enregistrement d'Habitant & Foyer (Privacy-first)
export const householdRegistrationSchema = z.object({
  cityId: objectIdSchema,
  districtId: objectIdSchema.optional(),
  neighborhoodId: objectIdSchema,
  blockId: objectIdSchema,
  residenceId: objectIdSchema.optional(),
  dwellingId: objectIdSchema.optional(),
  // Déclaration de l'adresse si nouvelle résidence
  address: z.string().trim().min(3).max(240).optional(),
  landmark: z.string().trim().max(240).optional(),
  buildingType: z.enum(RESIDENCE_TYPES).optional(),
  // Données de l'habitant
  fullName: z.string().trim().min(2).max(160),
  phone: z.string().trim().min(6).max(32),
  email: z.string().trim().email().optional(),
  // Foyer agrégé (zéro profil individuel de mineur stocké)
  householdSize: z.number().int().min(1).max(50).default(1),
  minorsCount: z.number().int().min(0).max(50).default(0),
  arrivalDate: z.string().or(z.date()).optional(),
  // Contact d'urgence
  emergencyContactName: z.string().trim().max(160).optional(),
  emergencyContactPhone: z.string().trim().max(32).optional(),
  // Consentement RGPD / APDP obligatoire
  consentAccepted: z.literal(true, {
    errorMap: () => ({ message: 'Le consentement à la politique de confidentialité est obligatoire.' }),
  }),
});

// 6. Workflow de Validation du Recensement
export const censusValidationSchema = z.object({
  status: z.enum(['VALIDATED', 'REJECTED', 'TO_UPDATE']),
  decisionReason: z.string().trim().max(1_000).optional(),
});

// 7. Signalement d'Incident & Sécurité Communautaire
export const incidentReportInputSchema = z.object({
  category: z.enum(INCIDENT_CATEGORIES),
  description: z.string().trim().min(10).max(4_000),
  severity: z.enum(INCIDENT_SEVERITIES).default('MEDIUM'),
  neighborhoodId: objectIdSchema,
  blockId: objectIdSchema.optional(),
  locationText: z.string().trim().max(240).optional(),
  photoUrl: z.string().trim().url().optional(),
  isAnonymous: z.boolean().default(false),
  reporterName: z.string().trim().max(160).optional(),
  reporterPhone: z.string().trim().max(32).optional(),
});

export const incidentStatusUpdateSchema = z.object({
  status: z.enum(INCIDENT_STATUSES),
  resolutionNotes: z.string().trim().max(2_000).optional(),
});

// 8. Communication & Annonces Communautaires
export const communityAnnouncementInputSchema = z.object({
  scope: z.enum(ANNOUNCEMENT_SCOPES).default('BLOCK'),
  type: z.enum(ANNOUNCEMENT_TYPES).default('INFO'),
  title: z.string().trim().min(3).max(200),
  message: z.string().trim().min(10).max(4_000),
  neighborhoodId: objectIdSchema,
  blockId: objectIdSchema.optional(),
  eventDate: z.string().or(z.date()).optional(),
});

// 9. Formule d'Abonnement Chef de Quartier / Bloc
export const quartierPlanInputSchema = z.object({
  code: z.enum(QUARTIER_PLAN_CODES),
  name: z.string().trim().min(2).max(120),
  priceMinor: z.number().int().min(0),
  currency: z.string().trim().length(3).default('XOF'),
  durationMonths: z.number().int().min(1).default(1),
  maxBlocks: z.number().int().min(1).default(1),
  maxResidences: z.number().int().min(10).default(500),
  maxSecondaryLeaders: z.number().int().min(0).default(0),
  maxAnnouncementsPerMonth: z.number().int().min(1).default(30),
  advancedReports: z.boolean().default(false),
  interactiveMap: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

// 10. Paramétrage des Commissions de la Chefferie
export const chefferieCommissionSettingsSchema = z.object({
  cityId: objectIdSchema.optional(),
  neighborhoodId: objectIdSchema,
  houseSalePercent: z.number().min(0).max(50).default(3),
  houseRentPercent: z.number().min(0).max(50).default(10),
  landSalePercent: z.number().min(0).max(50).default(5),
});

// 11. Transaction de Vente de Maison
export const houseSaleTransactionInputSchema = z.object({
  cityId: objectIdSchema,
  neighborhoodId: objectIdSchema,
  blockId: objectIdSchema,
  residenceId: objectIdSchema.optional(),
  houseDescription: z.string().trim().min(3).max(500),
  address: z.string().trim().min(3).max(240),
  landmark: z.string().trim().max(240).optional(),
  // Ancien propriétaire
  formerOwnerFullName: z.string().trim().min(2).max(160),
  formerOwnerPhone: z.string().trim().min(6).max(32),
  formerOwnerNationalId: z.string().trim().max(60).optional(),
  formerOwnerAddress: z.string().trim().max(240).optional(),
  // Nouvel acquéreur
  newBuyerFullName: z.string().trim().min(2).max(160),
  newBuyerPhone: z.string().trim().min(6).max(32),
  newBuyerNationalId: z.string().trim().max(60).optional(),
  newBuyerAddress: z.string().trim().max(240).optional(),
  // Financier
  salePriceMinor: z.number().int().min(1),
  currency: z.string().trim().length(3).default('XOF'),
  customCommissionPercent: z.number().min(0).max(50).optional(),
  commissionPaidMinor: z.number().int().min(0).default(0),
  transactionDate: z.string().or(z.date()).optional(),
  notes: z.string().trim().max(2_000).optional(),
});

// 12. Gestion des Locations de Maisons
export const houseRentalRecordInputSchema = z.object({
  cityId: objectIdSchema,
  neighborhoodId: objectIdSchema,
  blockId: objectIdSchema,
  residenceId: objectIdSchema.optional(),
  houseDescription: z.string().trim().min(3).max(500),
  address: z.string().trim().min(3).max(240),
  // Bailleur / Propriétaire
  ownerFullName: z.string().trim().min(2).max(160),
  ownerPhone: z.string().trim().min(6).max(32),
  ownerNationalId: z.string().trim().max(60).optional(),
  // Locataire
  tenantFullName: z.string().trim().min(2).max(160),
  tenantPhone: z.string().trim().min(6).max(32),
  tenantProfession: z.string().trim().max(120).optional(),
  // Contrat & Loyer
  rentAmountMinor: z.number().int().min(1),
  currency: z.string().trim().length(3).default('XOF'),
  rentalDurationMonths: z.number().int().min(1).default(12),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()).optional(),
  customCommissionPercent: z.number().min(0).max(50).optional(),
  commissionPaidMinor: z.number().int().min(0).default(0),
  notes: z.string().trim().max(2_000).optional(),
});

// 13. Gestion des Ventes de Terrains (Foncier)
export const landSaleTransactionInputSchema = z.object({
  cityId: objectIdSchema,
  neighborhoodId: objectIdSchema,
  blockId: objectIdSchema,
  plotNumber: z.string().trim().max(80).optional(),
  locationText: z.string().trim().min(3).max(240),
  surfaceM2: z.number().positive(),
  // Propriétaire initial
  initialOwnerFullName: z.string().trim().min(2).max(160),
  initialOwnerPhone: z.string().trim().min(6).max(32),
  initialOwnerNationalId: z.string().trim().max(60).optional(),
  // Nouvel acquéreur
  newBuyerFullName: z.string().trim().min(2).max(160),
  newBuyerPhone: z.string().trim().min(6).max(32),
  newBuyerNationalId: z.string().trim().max(60).optional(),
  // Financier
  salePriceMinor: z.number().int().min(1),
  currency: z.string().trim().length(3).default('XOF'),
  customCommissionPercent: z.number().min(0).max(50).optional(),
  commissionPaidMinor: z.number().int().min(0).default(0),
  transactionDate: z.string().or(z.date()).optional(),
  notes: z.string().trim().max(2_000).optional(),
});

// 14. Délivrance de Certificat Officiel par la Chefferie
export const issueCertificateInputSchema = z.object({
  operationType: z.enum(['HOUSE_SALE', 'HOUSE_RENTAL', 'LAND_SALE']),
  transactionId: objectIdSchema,
  chefferieName: z.string().trim().min(3).max(200),
  signatoryName: z.string().trim().min(2).max(160),
  signatoryTitle: z.string().trim().min(2).max(120).default('Chef de Quartier / Chef Traditionnel'),
  signatureImageUrl: z.string().trim().url().optional(),
  stampImageUrl: z.string().trim().url().optional(),
  notes: z.string().trim().max(1_000).optional(),
});
