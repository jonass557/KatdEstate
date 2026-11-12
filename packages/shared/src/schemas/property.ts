import { z } from 'zod';
import {
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
  UNIT_STATUSES,
  UNIT_TYPES,
} from '../constants/statuses.js';
import { objectIdSchema, paginationSchema } from './common.js';
import { geoJsonBoundarySchema, geoJsonPointSchema } from './geo.js';

const trimmed = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional();

export const propertyInputSchema = z.object({
  name: trimmed(160),
  type: z.string().default('BUILDING'),
  address: trimmed(240),
  city: trimmed(120),
  zone: optionalText(120),
  customPropertyType: optionalText(120),
  chambreSimpleCount: z.coerce.number().int().nonnegative().optional().default(0),
  chambreModerneCount: z.coerce.number().int().nonnegative().optional().default(0),
  studioSimpleCount: z.coerce.number().int().nonnegative().optional().default(0),
  studioModerneCount: z.coerce.number().int().nonnegative().optional().default(0),
  appartementCount: z.coerce.number().int().nonnegative().optional().default(0),
  otherCustomType: optionalText(120),
  otherCustomCount: z.coerce.number().int().nonnegative().optional().default(0),
  roomsCount: z.coerce.number().int().nonnegative().optional().default(0),
  studiosCount: z.coerce.number().int().nonnegative().optional().default(0),
  apartmentsCount: z.coerce.number().int().nonnegative().optional().default(0),
  otherUnitsCount: z.coerce.number().int().nonnegative().optional().default(0),
  country: z
    .string()
    .trim()
    .length(2)
    .transform((value) => value.toUpperCase()),
  description: optionalText(4_000),
  status: z.enum(PROPERTY_STATUSES).default('ACTIVE'),
  acquisitionDate: z.coerce.date().optional(),
  value: z.number().nonnegative().optional(),
  owner: optionalText(160),
  manager: optionalText(160),
  ownerId: optionalText(64),
  geoOwnerId: optionalText(64),
  neighborhoodId: optionalText(64),
  blockId: optionalText(64),
  geoUniqueId: optionalText(64),
  region: optionalText(120),
  department: optionalText(120),
  arrondissement: optionalText(120),
  neighborhoodName: optionalText(120),
  sectorName: optionalText(120),
  neighborhoodLeaderName: optionalText(160),
  blockLeaderName: optionalText(160),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  location: geoJsonPointSchema.optional(),
  boundary: geoJsonBoundarySchema.optional(),
  geoDerogation: z
    .object({
      granted: z.boolean().optional(),
      justification: optionalText(500),
    })
    .optional(),
  delegation: z
    .object({
      managerName: trimmed(160),
      managerEmail: z.string().trim().email().max(160).optional().or(z.literal('')),
      managerPhone: optionalText(32),
      agencyName: optionalText(160),
      scope: z.enum(['ALL_PORTFOLIO', 'PROPERTY']).default('PROPERTY'),
      permissions: z.array(z.string()).default(['COLLECTION', 'LEASES', 'MAINTENANCE']),
      commissionRate: z.coerce.number().min(0).max(100).default(0),
      startDate: z.coerce.date().optional(),
      endDate: z.coerce.date().optional(),
      status: z.enum(['ACTIVE', 'SUSPENDED', 'REVOKED']).default('ACTIVE'),
      notes: optionalText(2_000),
    })
    .optional(),
});

export const propertyUpdateSchema = propertyInputSchema.partial();

export const buildingInputSchema = z.object({
  propertyId: objectIdSchema,
  name: trimmed(160),
  address: optionalText(240),
  floors: z.number().int().min(0).max(200).optional(),
});

export const buildingUpdateSchema = buildingInputSchema.partial().omit({ propertyId: true });

export const unitInputSchema = z.object({
  propertyId: objectIdSchema,
  buildingId: objectIdSchema.optional(),
  name: trimmed(160),
  number: optionalText(32),
  floor: z.number().int().min(-5).max(200).optional(),
  type: z.enum(UNIT_TYPES),
  surfaceM2: z.number().min(0).max(100_000).optional(),
  bedrooms: z.number().int().min(0).max(100).optional(),
  bathrooms: z.number().int().min(0).max(100).optional(),
  rentAmountMinor: z.number().int().nonnegative().max(100_000_000_000),
  chargesAmountMinor: z.number().int().nonnegative().max(100_000_000_000).default(0),
  depositAmountMinor: z.number().int().nonnegative().max(100_000_000_000).default(0),
  status: z.enum(UNIT_STATUSES).default('AVAILABLE'),
  description: optionalText(4_000),
  amenities: z.array(trimmed(80)).max(50).default([]),
});

export const unitUpdateSchema = unitInputSchema.partial().omit({ propertyId: true });

export const propertyListQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  status: z.enum(PROPERTY_STATUSES).optional(),
  type: z.enum(PROPERTY_TYPES).optional(),
  city: z.string().trim().max(120).optional(),
});

export const unitListQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  status: z.enum(UNIT_STATUSES).optional(),
  type: z.enum(UNIT_TYPES).optional(),
  propertyId: objectIdSchema.optional(),
  buildingId: objectIdSchema.optional(),
});

export type PropertyInput = z.infer<typeof propertyInputSchema>;
export type BuildingInput = z.infer<typeof buildingInputSchema>;
export type UnitInput = z.infer<typeof unitInputSchema>;
