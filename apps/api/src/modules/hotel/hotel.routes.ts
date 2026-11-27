import { Router } from 'express';
import { objectIdSchema } from '@rentflow/shared';
import { z } from 'zod';
import type { AppConfig } from '../../config/index.js';
import { sendSuccess } from '../../common/http.js';
import { createAuthenticate } from '../../middleware/authenticate.js';
import { requireOrganizationMembership } from '../../middleware/organization.js';
import { requirePermission } from '../../middleware/permissions.js';
import { validateRequest } from '../../middleware/validate-request.js';
import { upload } from '../files/files.service.js';
import {
  HOTEL_ESTABLISHMENT_STATUSES,
  HOTEL_ESTABLISHMENT_TYPES,
} from '../../models/hotel.js';
import * as service from './hotel.service.js';

const idParams = z.object({ id: objectIdSchema });

const photoSchema = z.object({
  url: z.string().min(1),
  publicId: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

const createEstablishmentSchema = z.object({
  name: z.string().trim().min(2).max(160),
  type: z.enum(HOTEL_ESTABLISHMENT_TYPES).default('HOTEL'),
  stars: z.coerce.number().int().min(1).max(5).optional(),
  description: z.string().max(3000).optional(),
  address: z.string().trim().min(2).max(240),
  city: z.string().trim().min(1).max(120),
  country: z.string().trim().min(2).max(120),
  phone: z.string().max(40).optional(),
  email: z.string().email().optional().or(z.literal('')),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  photos: z.array(photoSchema).max(20).optional(),
  amenities: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
  status: z.enum(HOTEL_ESTABLISHMENT_STATUSES).optional(),
  totalRooms: z.coerce.number().int().min(0).optional(),
  occupiedRooms: z.coerce.number().int().min(0).optional(),
  estimatedMonthlyRevenue: z.coerce.number().min(0).optional(),
  currency: z.string().trim().min(1).max(12).optional(),
});

const updateEstablishmentSchema = createEstablishmentSchema.partial();

const statusSchema = z.object({
  status: z.enum(HOTEL_ESTABLISHMENT_STATUSES),
});

const roomStatusEnum = z.enum(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING', 'MAINTENANCE']);

const createRoomCategorySchema = z.object({
  establishmentId: objectIdSchema,
  name: z.string().trim().min(2).max(100),
  description: z.string().max(500).optional(),
  basePrice: z.coerce.number().min(0).optional(),
  defaultBedsCount: z.coerce.number().int().min(1).optional(),
  defaultMaxCapacity: z.coerce.number().int().min(1).optional(),
  currency: z.string().trim().min(1).max(12).optional(),
});

const createRoomSchema = z.object({
  establishmentId: objectIdSchema,
  roomNumber: z.string().trim().min(1).max(40),
  categoryId: objectIdSchema.optional(),
  categoryName: z.string().trim().min(1).max(100).optional(),
  floor: z.coerce.number().int().min(-5).max(200).optional(),
  bedsCount: z.coerce.number().int().min(1).max(30).optional(),
  maxCapacity: z.coerce.number().int().min(1).max(50).optional(),
  pricePerNight: z.coerce.number().min(0).optional(),
  currency: z.string().trim().min(1).max(12).optional(),
  description: z.string().max(2000).optional(),
  photos: z.array(photoSchema).max(20).optional(),
  status: roomStatusEnum.optional(),
  amenities: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
});

const updateRoomSchema = createRoomSchema.partial();

const createReservationSchema = z.object({
  establishmentId: objectIdSchema,
  roomId: objectIdSchema,
  guestName: z.string().trim().min(2).max(140),
  guestEmail: z.string().email().optional().or(z.literal('')),
  guestPhone: z.string().max(40).optional(),
  source: z.enum(['DIRECT', 'OTA', 'CORPORATE', 'WALK_IN']).optional(),
  checkInDate: z.string().min(1),
  checkOutDate: z.string().min(1),
  totalAmount: z.coerce.number().min(0).optional(),
});

function respond(
  handler: (
    req: Parameters<typeof service.listEstablishments>[0],
    res: Parameters<typeof service.listEstablishments>[1],
  ) => Promise<void>,
) {
  return (
    req: Parameters<typeof handler>[0],
    res: Parameters<typeof handler>[1],
    next: (error: unknown) => void,
  ) => {
    handler(req, res)
      .then(() => {
        if (!res.headersSent) {
          sendSuccess(res, res.locals.data, {
            statusCode: res.statusCode === 200 ? 200 : res.statusCode,
            meta: res.locals.meta,
          });
        }
      })
      .catch(next);
  };
}

export function createHotelRouter(config: AppConfig) {
  const router = Router({ mergeParams: true });
  router.use(createAuthenticate(config), requireOrganizationMembership);

  router.get(
    '/hotel-dashboard',
    requirePermission('properties.view'),
    respond(service.getHotelDashboard),
  );

  router.get(
    '/establishments',
    requirePermission('properties.view'),
    respond(service.listEstablishments),
  );

  router.post(
    '/establishments',
    requirePermission('properties.create'),
    validateRequest(createEstablishmentSchema),
    respond(service.createEstablishment),
  );

  router.post(
    '/establishments/upload-photos',
    requirePermission('properties.create'),
    upload.array('files', 10),
    respond(service.uploadEstablishmentPhotos),
  );

  router.get(
    '/establishments/:id',
    requirePermission('properties.view'),
    validateRequest(idParams, 'params'),
    respond(service.getEstablishment),
  );

  router.patch(
    '/establishments/:id',
    requirePermission('properties.update'),
    validateRequest(idParams, 'params'),
    validateRequest(updateEstablishmentSchema),
    respond(service.updateEstablishment),
  );

  router.patch(
    '/establishments/:id/status',
    requirePermission('properties.update'),
    validateRequest(idParams, 'params'),
    validateRequest(statusSchema),
    respond(service.updateEstablishmentStatus),
  );

  router.delete(
    '/establishments/:id',
    requirePermission('properties.delete'),
    validateRequest(idParams, 'params'),
    respond(service.deleteEstablishment),
  );

  // Room Categories
  router.get(
    '/room-categories',
    requirePermission('properties.view'),
    respond(service.listRoomCategories),
  );
  router.post(
    '/room-categories',
    requirePermission('properties.create'),
    validateRequest(createRoomCategorySchema),
    respond(service.createRoomCategory),
  );
  router.delete(
    '/room-categories/:id',
    requirePermission('properties.delete'),
    validateRequest(idParams, 'params'),
    respond(service.deleteRoomCategory),
  );

  // Rooms
  router.get(
    '/rooms',
    requirePermission('properties.view'),
    respond(service.listRooms),
  );
  router.post(
    '/rooms',
    requirePermission('properties.create'),
    validateRequest(createRoomSchema),
    respond(service.createRoom),
  );
  router.get(
    '/rooms/:id',
    requirePermission('properties.view'),
    validateRequest(idParams, 'params'),
    respond(service.getRoomDetail),
  );
  router.patch(
    '/rooms/:id',
    requirePermission('properties.update'),
    validateRequest(idParams, 'params'),
    validateRequest(updateRoomSchema),
    respond(service.updateRoom),
  );
  router.delete(
    '/rooms/:id',
    requirePermission('properties.delete'),
    validateRequest(idParams, 'params'),
    respond(service.deleteRoom),
  );

  // Reservations (with strict anti-overlap check & room status sync)
  router.post(
    '/reservations',
    requirePermission('properties.create'),
    validateRequest(createReservationSchema),
    respond(service.createRoomReservation),
  );

  return router;
}
