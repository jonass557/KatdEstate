import { z } from 'zod';
import { objectIdSchema } from './common.js';

export const geoCoordinatePairSchema = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);

export const geoJsonPointSchema = z.object({
  type: z.literal('Point'),
  coordinates: geoCoordinatePairSchema,
});

export const geoJsonPolygonSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z
    .array(z.array(geoCoordinatePairSchema).min(4, 'Un polygone nécessite au moins 3 sommets fermés'))
    .min(1),
});

export const geoJsonMultiPolygonSchema = z.object({
  type: z.literal('MultiPolygon'),
  coordinates: z
    .array(z.array(z.array(geoCoordinatePairSchema).min(4)).min(1))
    .min(1),
});

export const geoJsonBoundarySchema = z.union([geoJsonPolygonSchema, geoJsonMultiPolygonSchema]);

export const neighborhoodBoundaryInputSchema = z.object({
  boundary: geoJsonBoundarySchema,
  administrativeAddress: z.string().trim().max(240).optional(),
  region: z.string().trim().max(120).optional(),
  department: z.string().trim().max(120).optional(),
  arrondissement: z.string().trim().max(120).optional(),
  justification: z.string().trim().max(500).optional(),
});

export const blockZoneInputSchema = z.object({
  neighborhoodId: objectIdSchema,
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(2).max(30).optional(),
  blockLeaderId: objectIdSchema.optional(),
  description: z.string().trim().max(1_000).optional(),
  color: z.string().trim().max(20).optional(),
  boundary: geoJsonBoundarySchema,
  overrideOverlap: z.boolean().optional(),
  overrideReason: z.string().trim().max(500).optional(),
});

export const blockZoneUpdateSchema = z.object({
  boundary: geoJsonBoundarySchema,
  name: z.string().trim().min(2).max(120).optional(),
  color: z.string().trim().max(20).optional(),
  overrideOverlap: z.boolean().optional(),
  overrideReason: z.string().trim().max(500).optional(),
  justification: z.string().trim().max(500).optional(),
});

export const geoOwnerInputSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  phone: z.string().trim().min(6).max(32),
  email: z.string().trim().email().optional().or(z.literal('')),
  userId: objectIdSchema.optional(),
  blockId: objectIdSchema,
  neighborhoodId: objectIdSchema.optional(),
  assignedBoundary: geoJsonBoundarySchema,
  justification: z.string().trim().max(500).optional(),
});

export const geoOwnerBoundaryUpdateSchema = z.object({
  assignedBoundary: geoJsonBoundarySchema,
  justification: z.string().trim().max(500).optional(),
});

export type GeoJsonPointInput = z.infer<typeof geoJsonPointSchema>;
export type GeoJsonBoundaryInput = z.infer<typeof geoJsonBoundarySchema>;
export type NeighborhoodBoundaryInput = z.infer<typeof neighborhoodBoundaryInputSchema>;
export type BlockZoneInput = z.infer<typeof blockZoneInputSchema>;
export type GeoOwnerInput = z.infer<typeof geoOwnerInputSchema>;
