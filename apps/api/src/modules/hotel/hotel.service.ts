import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { AppError } from '../../common/errors.js';
import { deleteFromCloudinary, uploadToCloudinary } from '../../common/cloudinary.js';
import {
  HotelEstablishment,
  type HotelEstablishmentStatus,
  type HotelEstablishmentType,
} from '../../models/hotel.js';

interface EstablishmentPhotoInput {
  url: string;
  publicId?: string | undefined;
  isPrimary?: boolean | undefined;
}

interface EstablishmentBody {
  name: string;
  type: HotelEstablishmentType;
  stars?: number | undefined;
  description?: string | undefined;
  address: string;
  city: string;
  country: string;
  phone?: string | undefined;
  email?: string | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  photos?: EstablishmentPhotoInput[] | undefined;
  amenities?: string[] | undefined;
  status?: HotelEstablishmentStatus | undefined;
  totalRooms?: number | undefined;
  occupiedRooms?: number | undefined;
  estimatedMonthlyRevenue?: number | undefined;
  currency?: string | undefined;
}

async function resolveCloudinaryPhotos(
  photos: EstablishmentPhotoInput[] | undefined,
  organizationId: string,
): Promise<EstablishmentPhotoInput[]> {
  if (!photos || photos.length === 0) return [];
  const resolved: EstablishmentPhotoInput[] = [];
  for (let i = 0; i < photos.length; i += 1) {
    const item = photos[i]!;
    if (item.url.startsWith('data:image/')) {
      const uploaded = await uploadToCloudinary(item.url, {
        folder: `katdestate/hotels/${organizationId}`,
        resourceType: 'image',
      });
      resolved.push({
        url: uploaded.secureUrl || uploaded.url,
        publicId: uploaded.publicId,
        isPrimary: item.isPrimary ?? i === 0,
      });
    } else {
      resolved.push({
        url: item.url,
        publicId: item.publicId,
        isPrimary: item.isPrimary ?? i === 0,
      });
    }
  }
  return resolved;
}

export async function listEstablishments(req: Request, res: Response): Promise<void> {
  const organizationId = new Types.ObjectId(req.organizationContext!.organizationId);
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const skip = (page - 1) * limit;
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const type = typeof req.query.type === 'string' ? req.query.type : undefined;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;

  const filter: Record<string, unknown> = { organizationId };
  if (status && status !== 'ALL') {
    filter.status = status;
  }
  if (type && type !== 'ALL') {
    filter.type = type;
  }
  if (search) {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: regex }, { city: regex }, { country: regex }, { address: regex }];
  }

  const [items, total, allForStats] = await Promise.all([
    HotelEstablishment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    HotelEstablishment.countDocuments(filter),
    HotelEstablishment.find({ organizationId })
      .select('status totalRooms occupiedRooms estimatedMonthlyRevenue')
      .lean(),
  ]);

  const stats = allForStats.reduce(
    (acc, item) => {
      acc.total += 1;
      if (item.status === 'ACTIVE') acc.active += 1;
      else if (item.status === 'MAINTENANCE') acc.maintenance += 1;
      else if (item.status === 'INACTIVE') acc.inactive += 1;
      else if (item.status === 'ARCHIVED') acc.archived += 1;
      acc.totalRooms += item.totalRooms ?? 0;
      acc.occupiedRooms += item.occupiedRooms ?? 0;
      acc.estimatedMonthlyRevenue += item.estimatedMonthlyRevenue ?? 0;
      return acc;
    },
    {
      total: 0,
      active: 0,
      maintenance: 0,
      inactive: 0,
      archived: 0,
      totalRooms: 0,
      occupiedRooms: 0,
      estimatedMonthlyRevenue: 0,
    },
  );

  res.locals.data = items;
  res.locals.meta = {
    page,
    limit,
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
    stats,
  };
}

export async function getEstablishment(req: Request, res: Response): Promise<void> {
  const organizationId = new Types.ObjectId(req.organizationContext!.organizationId);
  const item = await HotelEstablishment.findOne({
    _id: req.params.id,
    organizationId,
  }).lean();

  if (!item) {
    throw new AppError('NOT_FOUND', 'Établissement introuvable.', 404);
  }

  res.locals.data = item;
}

export async function createEstablishment(req: Request, res: Response): Promise<void> {
  const orgId = req.organizationContext!.organizationId;
  const organizationId = new Types.ObjectId(orgId);
  const ownerId = new Types.ObjectId(req.user!.id);
  const body = req.body as EstablishmentBody;

  const photos = await resolveCloudinaryPhotos(body.photos, orgId);
  const hasCoords =
    typeof body.latitude === 'number' &&
    Number.isFinite(body.latitude) &&
    typeof body.longitude === 'number' &&
    Number.isFinite(body.longitude);

  const created = await HotelEstablishment.create({
    organizationId,
    ownerId,
    name: body.name,
    type: body.type,
    stars: body.stars ?? 3,
    description: body.description ?? '',
    address: body.address,
    city: body.city,
    country: body.country,
    phone: body.phone ?? '',
    email: body.email ?? '',
    latitude: hasCoords ? body.latitude : undefined,
    longitude: hasCoords ? body.longitude : undefined,
    location: hasCoords
      ? { type: 'Point', coordinates: [body.longitude!, body.latitude!] }
      : undefined,
    photos,
    amenities: body.amenities ?? [],
    status: body.status ?? 'ACTIVE',
    totalRooms: body.totalRooms ?? 0,
    occupiedRooms: body.occupiedRooms ?? 0,
    estimatedMonthlyRevenue: body.estimatedMonthlyRevenue ?? 0,
    currency: body.currency ?? 'FCFA',
  });

  res.status(201);
  res.locals.data = created.toObject();
}

export async function updateEstablishment(req: Request, res: Response): Promise<void> {
  const orgId = req.organizationContext!.organizationId;
  const organizationId = new Types.ObjectId(orgId);
  const body = req.body as Partial<EstablishmentBody>;

  const existing = await HotelEstablishment.findOne({
    _id: req.params.id,
    organizationId,
  });

  if (!existing) {
    throw new AppError('NOT_FOUND', 'Établissement introuvable.', 404);
  }

  if (body.photos !== undefined) {
    existing.set('photos', await resolveCloudinaryPhotos(body.photos, orgId));
  }

  const scalarFields = [
    'name',
    'type',
    'stars',
    'description',
    'address',
    'city',
    'country',
    'phone',
    'email',
    'amenities',
    'status',
    'totalRooms',
    'occupiedRooms',
    'estimatedMonthlyRevenue',
    'currency',
  ] as const;

  for (const field of scalarFields) {
    if (body[field] !== undefined) {
      existing.set(field, body[field]);
    }
  }

  if (typeof body.latitude === 'number' && typeof body.longitude === 'number') {
    existing.latitude = body.latitude;
    existing.longitude = body.longitude;
    existing.location = { type: 'Point', coordinates: [body.longitude, body.latitude] };
  }

  await existing.save();
  res.locals.data = existing.toObject();
}

export async function updateEstablishmentStatus(req: Request, res: Response): Promise<void> {
  const organizationId = new Types.ObjectId(req.organizationContext!.organizationId);
  const { status } = req.body as { status: HotelEstablishmentStatus };

  const updated = await HotelEstablishment.findOneAndUpdate(
    { _id: req.params.id, organizationId },
    { $set: { status } },
    { new: true },
  ).lean();

  if (!updated) {
    throw new AppError('NOT_FOUND', 'Établissement introuvable.', 404);
  }

  res.locals.data = updated;
}

export async function deleteEstablishment(req: Request, res: Response): Promise<void> {
  const organizationId = new Types.ObjectId(req.organizationContext!.organizationId);
  const existing = await HotelEstablishment.findOneAndDelete({
    _id: req.params.id,
    organizationId,
  }).lean();

  if (!existing) {
    throw new AppError('NOT_FOUND', 'Établissement introuvable.', 404);
  }

  for (const photo of existing.photos ?? []) {
    if (photo.publicId && !photo.publicId.startsWith('local_')) {
      await deleteFromCloudinary(photo.publicId);
    }
  }

  res.locals.data = { deleted: true, id: req.params.id };
}

export async function uploadEstablishmentPhotos(req: Request, res: Response): Promise<void> {
  const orgId = req.organizationContext!.organizationId;
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const dataUrls = Array.isArray((req.body as any)?.photos)
    ? ((req.body as any).photos as string[])
    : [];

  if (files.length === 0 && dataUrls.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'Aucune image fournie.', 422);
  }

  const uploaded: Array<{ url: string; publicId: string; isPrimary: boolean }> = [];

  for (let i = 0; i < files.length; i += 1) {
    const f = files[i]!;
    const base64 = `data:${f.mimetype};base64,${f.buffer.toString('base64')}`;
    const result = await uploadToCloudinary(base64, {
      folder: `katdestate/hotels/${orgId}`,
      resourceType: 'image',
    });
    uploaded.push({
      url: result.secureUrl || result.url,
      publicId: result.publicId,
      isPrimary: i === 0,
    });
  }

  for (let i = 0; i < dataUrls.length; i += 1) {
    const src = dataUrls[i]!;
    const result = await uploadToCloudinary(src, {
      folder: `katdestate/hotels/${orgId}`,
      resourceType: 'image',
    });
    uploaded.push({
      url: result.secureUrl || result.url,
      publicId: result.publicId,
      isPrimary: uploaded.length === 0 && i === 0,
    });
  }

  res.status(201);
  res.locals.data = uploaded;
}
