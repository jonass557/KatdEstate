import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { AppError } from '../../common/errors.js';
import { deleteFromCloudinary, uploadToCloudinary } from '../../common/cloudinary.js';
import {
  HotelActivityLog,
  HotelEstablishment,
  HotelExtraServiceOrder,
  HotelPayment,
  HotelReservation,
  HotelRestaurantOrder,
  HotelRoom,
  HotelRoomCategory,
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

export async function getHotelDashboard(req: Request, res: Response): Promise<void> {
  const organizationId = new Types.ObjectId(req.organizationContext!.organizationId);
  const establishmentIdRaw =
    typeof req.query.establishmentId === 'string' && req.query.establishmentId.trim()
      ? req.query.establishmentId.trim()
      : undefined;
  const period =
    typeof req.query.period === 'string' ? req.query.period.toUpperCase() : '30D';

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 6);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const periodDays =
    period === 'TODAY' ? 1 : period === '7D' ? 7 : period === '90D' ? 90 : period === '1Y' ? 365 : 30;
  const periodStart = new Date(startOfToday);
  periodStart.setDate(periodStart.getDate() - (periodDays - 1));
  const prevPeriodStart = new Date(periodStart);
  prevPeriodStart.setDate(prevPeriodStart.getDate() - periodDays);

  const estFilter: Record<string, unknown> = { organizationId };
  if (establishmentIdRaw && Types.ObjectId.isValid(establishmentIdRaw)) {
    estFilter._id = new Types.ObjectId(establishmentIdRaw);
  }

  const establishments = await HotelEstablishment.find(estFilter).sort({ createdAt: -1 }).lean();
  const activeEst = establishments[0] || null;
  const scopeFilter: Record<string, unknown> = { organizationId };
  if (establishmentIdRaw && Types.ObjectId.isValid(establishmentIdRaw)) {
    scopeFilter.establishmentId = new Types.ObjectId(establishmentIdRaw);
  }

  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [
    rooms,
    reservations,
    payments,
    restaurantOrders,
    serviceOrders,
    activityLogs,
  ] = await Promise.all([
    HotelRoom.find(scopeFilter).lean(),
    HotelReservation.find(scopeFilter).sort({ createdAt: -1 }).lean(),
    HotelPayment.find({ ...scopeFilter, paidAt: { $gte: sixMonthsAgo } }).sort({ paidAt: -1 }).lean(),
    HotelRestaurantOrder.find({ ...scopeFilter, orderedAt: { $gte: sixMonthsAgo } })
      .sort({ orderedAt: -1 })
      .lean(),
    HotelExtraServiceOrder.find({ ...scopeFilter, createdAt: { $gte: sixMonthsAgo } })
      .sort({ createdAt: -1 })
      .lean(),
    HotelActivityLog.find(scopeFilter).sort({ createdAt: -1 }).limit(12).lean(),
  ]);

  // Chambres & Taux d'occupation
  const roomCountFromDocs = rooms.length;
  const fallbackRoomsTotal = establishments.reduce((sum, e) => sum + (e.totalRooms || 0), 0);
  const fallbackOccupied = establishments.reduce((sum, e) => sum + (e.occupiedRooms || 0), 0);

  const totalRooms = roomCountFromDocs > 0 ? roomCountFromDocs : fallbackRoomsTotal;
  const occupiedRooms =
    roomCountFromDocs > 0
      ? rooms.filter((r) => r.status === 'OCCUPIED').length
      : fallbackOccupied;
  const cleaningRooms =
    roomCountFromDocs > 0 ? rooms.filter((r) => r.status === 'CLEANING').length : 0;
  const maintenanceRooms =
    roomCountFromDocs > 0 ? rooms.filter((r) => r.status === 'MAINTENANCE').length : 0;
  const availableRooms =
    roomCountFromDocs > 0
      ? rooms.filter((r) => r.status === 'AVAILABLE').length
      : Math.max(0, totalRooms - occupiedRooms);
  const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

  // Chiffre d'affaires (Paiements + Restaurant + Services payés)
  const paidEntries: Array<{ amount: number; category: 'ROOM' | 'RESTAURANT' | 'SERVICE'; date: Date }> = [];
  for (const p of payments) {
    if (p.status === 'PAID') {
      paidEntries.push({
        amount: p.amount || 0,
        category: p.category || 'ROOM',
        date: new Date(p.paidAt || p.createdAt),
      });
    }
  }
  for (const o of restaurantOrders) {
    if (o.status === 'PAID') {
      paidEntries.push({
        amount: o.totalAmount || 0,
        category: 'RESTAURANT',
        date: new Date(o.orderedAt || o.createdAt),
      });
    }
  }
  for (const s of serviceOrders) {
    if (s.status === 'PAID') {
      paidEntries.push({
        amount: s.amount || 0,
        category: 'SERVICE',
        date: new Date(s.createdAt),
      });
    }
  }

  const sumSince = (from: Date, to?: Date) =>
    paidEntries
      .filter((e) => e.date >= from && (!to || e.date <= to))
      .reduce((acc, e) => acc + e.amount, 0);

  const dailyRevenue = sumSince(startOfToday);
  const weeklyRevenue = sumSince(startOfWeek);
  const monthlyRevenue = sumSince(startOfMonth);
  const periodRevenue = sumSince(periodStart);
  const previousPeriodRevenue = sumSince(prevPeriodStart, periodStart);
  const revenueGrowthPct =
    previousPeriodRevenue > 0
      ? Math.round(((periodRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100)
      : periodRevenue > 0
        ? 100
        : 0;

  // Réservations du jour, arrivées & départs prévus
  const todayReservations = reservations.filter((r) => new Date(r.createdAt) >= startOfToday).length;
  const periodReservations = reservations.filter((r) => new Date(r.createdAt) >= periodStart).length;
  const arrivalsToday = reservations.filter((r) => {
    const d = new Date(r.checkInDate);
    return d >= startOfToday && d <= endOfToday && r.status !== 'CANCELLED';
  }).length;
  const departuresToday = reservations.filter((r) => {
    const d = new Date(r.checkOutDate);
    return d >= startOfToday && d <= endOfToday && r.status !== 'CANCELLED';
  }).length;

  // Série d'évolution des revenus & occupation (selon la période)
  const bucketCount = period === 'TODAY' ? 1 : period === '7D' ? 7 : period === '1Y' ? 12 : 10;
  const revenueSeries: Array<{
    dateLabel: string;
    roomRevenue: number;
    restaurantRevenue: number;
    serviceRevenue: number;
    totalRevenue: number;
  }> = [];
  const occupancySeries: Array<{ dateLabel: string; occupancyRate: number }> = [];

  if (period === '1Y') {
    for (let m = 11; m >= 0; m -= 1) {
      const mStart = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - m + 1, 0, 23, 59, 59, 999);
      const label = mStart.toLocaleDateString('fr-FR', { month: 'short' });
      const inBucket = paidEntries.filter((e) => e.date >= mStart && e.date <= mEnd);
      const roomRevenue = inBucket.filter((e) => e.category === 'ROOM').reduce((a, b) => a + b.amount, 0);
      const restaurantRevenue = inBucket.filter((e) => e.category === 'RESTAURANT').reduce((a, b) => a + b.amount, 0);
      const serviceRevenue = inBucket.filter((e) => e.category === 'SERVICE').reduce((a, b) => a + b.amount, 0);
      revenueSeries.push({
        dateLabel: label,
        roomRevenue,
        restaurantRevenue,
        serviceRevenue,
        totalRevenue: roomRevenue + restaurantRevenue + serviceRevenue,
      });
      const activeResCount = reservations.filter(
        (r) => r.status !== 'CANCELLED' && new Date(r.checkInDate) <= mEnd && new Date(r.checkOutDate) >= mStart,
      ).length;
      occupancySeries.push({
        dateLabel: label,
        occupancyRate: totalRooms > 0 ? Math.min(100, Math.round((activeResCount / totalRooms) * 100)) : 0,
      });
    }
  } else {
    const stepDays = Math.max(1, Math.ceil(periodDays / bucketCount));
    for (let i = bucketCount - 1; i >= 0; i -= 1) {
      const bEnd = new Date(endOfToday);
      bEnd.setDate(bEnd.getDate() - i * stepDays);
      const bStart = new Date(startOfToday);
      bStart.setDate(bStart.getDate() - (i * stepDays + stepDays - 1));
      const label = bEnd.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
      const inBucket = paidEntries.filter((e) => e.date >= bStart && e.date <= bEnd);
      const roomRevenue = inBucket.filter((e) => e.category === 'ROOM').reduce((a, b) => a + b.amount, 0);
      const restaurantRevenue = inBucket.filter((e) => e.category === 'RESTAURANT').reduce((a, b) => a + b.amount, 0);
      const serviceRevenue = inBucket.filter((e) => e.category === 'SERVICE').reduce((a, b) => a + b.amount, 0);
      revenueSeries.push({
        dateLabel: label,
        roomRevenue,
        restaurantRevenue,
        serviceRevenue,
        totalRevenue: roomRevenue + restaurantRevenue + serviceRevenue,
      });
      const activeResCount = reservations.filter(
        (r) => r.status !== 'CANCELLED' && new Date(r.checkInDate) <= bEnd && new Date(r.checkOutDate) >= bStart,
      ).length;
      occupancySeries.push({
        dateLabel: label,
        occupancyRate: totalRooms > 0 ? Math.min(100, Math.round((activeResCount / totalRooms) * 100)) : 0,
      });
    }
  }

  // Répartition des réservations par canal
  const sources: Array<{ key: 'DIRECT' | 'OTA' | 'CORPORATE' | 'WALK_IN'; label: string; color: string }> = [
    { key: 'DIRECT', label: 'Direct', color: '#2563eb' },
    { key: 'OTA', label: 'OTA (Booking, Expedia)', color: '#d97706' },
    { key: 'CORPORATE', label: 'Entreprise', color: '#10b981' },
    { key: 'WALK_IN', label: 'Passage (Walk-in)', color: '#8b5cf6' },
  ];
  const periodResList = reservations.filter((r) => new Date(r.createdAt) >= periodStart);
  const totalResForBreakdown = periodResList.length;
  const bookingBreakdown = sources.map((s) => {
    const count = periodResList.filter((r) => (r.source || 'DIRECT') === s.key).length;
    return {
      source: s.key,
      label: s.label,
      color: s.color,
      count,
      percentage: totalResForBreakdown > 0 ? Math.round((count / totalResForBreakdown) * 100) : 0,
    };
  });

  // Comparaison des performances mensuelles (6 derniers mois)
  const monthlyComparison: Array<{
    month: string;
    revenue: number;
    reservations: number;
  }> = [];
  for (let m = 5; m >= 0; m -= 1) {
    const mStart = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const mEnd = new Date(now.getFullYear(), now.getMonth() - m + 1, 0, 23, 59, 59, 999);
    const monthLabel = mStart.toLocaleDateString('fr-FR', { month: 'short' });
    const rev = sumSince(mStart, mEnd);
    const resCount = reservations.filter((r) => {
      const d = new Date(r.createdAt);
      return d >= mStart && d <= mEnd;
    }).length;
    monthlyComparison.push({ month: monthLabel, revenue: rev, reservations: resCount });
  }

  // Dernières transactions (Paiements + Restaurant + Services)
  const recentTransactions = [
    ...payments.slice(0, 6).map((p) => ({
      id: String(p._id),
      label: p.guestName || 'Paiement séjour',
      category: p.category || 'ROOM',
      method: p.method || 'MOBILE_MONEY',
      amount: p.amount || 0,
      currency: p.currency || activeEst?.currency || 'FCFA',
      status: p.status,
      date: p.paidAt || p.createdAt,
    })),
    ...restaurantOrders.slice(0, 4).map((o) => ({
      id: String(o._id),
      label: `${o.label}${o.roomNumber ? ` (Ch. ${o.roomNumber})` : ''}`,
      category: 'RESTAURANT',
      method: 'RESTAURANT',
      amount: o.totalAmount || 0,
      currency: o.currency || activeEst?.currency || 'FCFA',
      status: o.status,
      date: o.orderedAt || o.createdAt,
    })),
    ...serviceOrders.slice(0, 4).map((s) => ({
      id: String(s._id),
      label: s.serviceName,
      category: 'SERVICE',
      method: s.category || 'SERVICE',
      amount: s.amount || 0,
      currency: s.currency || activeEst?.currency || 'FCFA',
      status: s.status,
      date: s.createdAt,
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);

  // Alertes opérationnelles réelles
  const alerts: Array<{ id: string; severity: 'WARNING' | 'ALERT' | 'INFO'; title: string; detail: string }> = [];
  if (maintenanceRooms > 0) {
    alerts.push({
      id: 'alert-maint-rooms',
      severity: 'ALERT',
      title: `${maintenanceRooms} chambre(s) en maintenance`,
      detail: 'Vérifiez les interventions techniques en cours pour libérer ces chambres.',
    });
  }
  if (cleaningRooms > 0) {
    alerts.push({
      id: 'alert-clean-rooms',
      severity: 'WARNING',
      title: `${cleaningRooms} chambre(s) à nettoyer (Housekeeping)`,
      detail: 'En attente de validation propreté avant le prochain check-in.',
    });
  }
  const unpaidResCount = reservations.filter(
    (r) => r.status !== 'CANCELLED' && (r.paidAmount || 0) < (r.totalAmount || 0),
  ).length;
  if (unpaidResCount > 0) {
    alerts.push({
      id: 'alert-unpaid',
      severity: 'WARNING',
      title: `${unpaidResCount} réservation(s) avec solde en attente`,
      detail: 'Consultez la facturation pour encaisser les montants restants.',
    });
  }
  const pendingResto = restaurantOrders.filter((o) => o.status === 'PENDING').length;
  if (pendingResto > 0) {
    alerts.push({
      id: 'alert-resto',
      severity: 'INFO',
      title: `${pendingResto} commande(s) restaurant en attente`,
      detail: 'Commandes en cuisine / room service à traiter.',
    });
  }

  res.locals.data = {
    establishment: activeEst,
    period,
    kpis: {
      dailyRevenue,
      weeklyRevenue,
      monthlyRevenue,
      periodRevenue,
      revenueGrowthPct,
      currency: activeEst?.currency || 'FCFA',
      todayReservations,
      periodReservations,
      totalRooms,
      availableRooms,
      occupiedRooms,
      cleaningRooms,
      maintenanceRooms,
      occupancyRate,
      arrivalsToday,
      departuresToday,
    },
    charts: {
      revenueSeries,
      occupancySeries,
      bookingBreakdown,
      monthlyComparison,
    },
    recentReservations: reservations.slice(0, 6),
    recentTransactions,
    recentActivities: activityLogs,
    alerts,
  };
}

// ============================================================================
// Room Categories CRUD
// ============================================================================

export async function listRoomCategories(req: Request, res: Response): Promise<void> {
  const organizationId = new Types.ObjectId(req.organizationContext!.organizationId);
  const filter: Record<string, unknown> = { organizationId };
  if (typeof req.query.establishmentId === 'string' && Types.ObjectId.isValid(req.query.establishmentId)) {
    filter.establishmentId = new Types.ObjectId(req.query.establishmentId);
  }
  const items = await HotelRoomCategory.find(filter).sort({ name: 1 }).lean();
  res.locals.data = items;
}

export async function createRoomCategory(req: Request, res: Response): Promise<void> {
  const organizationId = new Types.ObjectId(req.organizationContext!.organizationId);
  const body = req.body as {
    establishmentId: string;
    name: string;
    description?: string;
    basePrice?: number;
    defaultBedsCount?: number;
    defaultMaxCapacity?: number;
    currency?: string;
  };
  const created = await HotelRoomCategory.create({
    organizationId,
    establishmentId: new Types.ObjectId(body.establishmentId),
    name: body.name,
    description: body.description ?? '',
    basePrice: body.basePrice ?? 0,
    defaultBedsCount: body.defaultBedsCount ?? 1,
    defaultMaxCapacity: body.defaultMaxCapacity ?? 2,
    currency: body.currency ?? 'FCFA',
  });
  res.status(201);
  res.locals.data = created.toObject();
}

export async function deleteRoomCategory(req: Request, res: Response): Promise<void> {
  const organizationId = new Types.ObjectId(req.organizationContext!.organizationId);
  const deleted = await HotelRoomCategory.findOneAndDelete({
    _id: req.params.id,
    organizationId,
  }).lean();
  if (!deleted) {
    throw new AppError('NOT_FOUND', 'Catégorie introuvable.', 404);
  }
  res.locals.data = { deleted: true, id: req.params.id };
}

// ============================================================================
// Rooms CRUD & Occupancy Sync
// ============================================================================

async function syncEstablishmentRoomCounts(organizationId: Types.ObjectId, establishmentId: Types.ObjectId) {
  const [totalRooms, occupiedRooms] = await Promise.all([
    HotelRoom.countDocuments({ organizationId, establishmentId }),
    HotelRoom.countDocuments({ organizationId, establishmentId, status: 'OCCUPIED' }),
  ]);
  await HotelEstablishment.updateOne(
    { _id: establishmentId, organizationId },
    { $set: { totalRooms, occupiedRooms } },
  );
}

export async function listRooms(req: Request, res: Response): Promise<void> {
  const organizationId = new Types.ObjectId(req.organizationContext!.organizationId);
  const filter: Record<string, unknown> = { organizationId };

  if (typeof req.query.establishmentId === 'string' && Types.ObjectId.isValid(req.query.establishmentId)) {
    filter.establishmentId = new Types.ObjectId(req.query.establishmentId);
  }
  if (typeof req.query.status === 'string' && req.query.status !== 'ALL') {
    filter.status = req.query.status;
  }
  if (typeof req.query.floor === 'string' && req.query.floor !== 'ALL') {
    const f = Number(req.query.floor);
    if (!Number.isNaN(f)) filter.floor = f;
  }
  if (typeof req.query.category === 'string' && req.query.category !== 'ALL') {
    filter.categoryName = req.query.category;
  }
  if (typeof req.query.search === 'string' && req.query.search.trim()) {
    const regex = new RegExp(req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ roomNumber: regex }, { categoryName: regex }, { description: regex }];
  }

  const baseScope: Record<string, unknown> = { organizationId };
  if (filter.establishmentId) baseScope.establishmentId = filter.establishmentId;

  const [rooms, allRooms] = await Promise.all([
    HotelRoom.find(filter).sort({ floor: 1, roomNumber: 1 }).lean(),
    HotelRoom.find(baseScope).select('status floor categoryName').lean(),
  ]);

  const floorsSet = new Set<number>();
  const categoriesSet = new Set<string>();
  const stats = allRooms.reduce(
    (acc, r) => {
      acc.total += 1;
      if (r.status === 'AVAILABLE') acc.available += 1;
      else if (r.status === 'OCCUPIED') acc.occupied += 1;
      else if (r.status === 'RESERVED') acc.reserved += 1;
      else if (r.status === 'CLEANING') acc.cleaning += 1;
      else if (r.status === 'MAINTENANCE') acc.maintenance += 1;
      if (typeof r.floor === 'number') floorsSet.add(r.floor);
      if (r.categoryName) categoriesSet.add(r.categoryName);
      return acc;
    },
    { total: 0, available: 0, occupied: 0, reserved: 0, cleaning: 0, maintenance: 0 },
  );

  res.locals.data = rooms;
  res.locals.meta = {
    stats,
    floors: Array.from(floorsSet).sort((a, b) => a - b),
    categories: Array.from(categoriesSet).sort(),
  };
}

export async function getRoomDetail(req: Request, res: Response): Promise<void> {
  const organizationId = new Types.ObjectId(req.organizationContext!.organizationId);
  const room = await HotelRoom.findOne({ _id: req.params.id, organizationId }).lean();
  if (!room) {
    throw new AppError('NOT_FOUND', 'Chambre introuvable.', 404);
  }

  const reservations = await HotelReservation.find({
    organizationId,
    roomId: room._id,
  })
    .sort({ checkInDate: -1 })
    .limit(20)
    .lean();

  res.locals.data = {
    room,
    reservations,
    occupancyHistory: reservations.filter((r) => r.status !== 'CANCELLED'),
  };
}

export async function createRoom(req: Request, res: Response): Promise<void> {
  const orgId = req.organizationContext!.organizationId;
  const organizationId = new Types.ObjectId(orgId);
  const body = req.body as {
    establishmentId: string;
    roomNumber: string;
    categoryId?: string;
    categoryName?: string;
    floor?: number;
    bedsCount?: number;
    maxCapacity?: number;
    pricePerNight?: number;
    currency?: string;
    description?: string;
    photos?: EstablishmentPhotoInput[];
    status?: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING' | 'MAINTENANCE';
    amenities?: string[];
  };

  const establishmentId = new Types.ObjectId(body.establishmentId);
  const existingNum = await HotelRoom.findOne({
    establishmentId,
    roomNumber: body.roomNumber.trim(),
  }).lean();
  if (existingNum) {
    throw new AppError('CONFLICT', `La chambre ${body.roomNumber} existe déjà dans cet établissement.`, 409);
  }

  const photos = await resolveCloudinaryPhotos(body.photos, orgId);
  const created = await HotelRoom.create({
    organizationId,
    establishmentId,
    roomNumber: body.roomNumber.trim(),
    categoryId: body.categoryId && Types.ObjectId.isValid(body.categoryId)
      ? new Types.ObjectId(body.categoryId)
      : undefined,
    categoryName: body.categoryName?.trim() || 'Standard',
    floor: body.floor ?? 1,
    bedsCount: body.bedsCount ?? 1,
    maxCapacity: body.maxCapacity ?? 2,
    pricePerNight: body.pricePerNight ?? 0,
    currency: body.currency || 'FCFA',
    description: body.description || '',
    photos,
    status: body.status || 'AVAILABLE',
    amenities: body.amenities || [],
  });

  await syncEstablishmentRoomCounts(organizationId, establishmentId);

  res.status(201);
  res.locals.data = created.toObject();
}

export async function updateRoom(req: Request, res: Response): Promise<void> {
  const orgId = req.organizationContext!.organizationId;
  const organizationId = new Types.ObjectId(orgId);
  const existing = await HotelRoom.findOne({ _id: req.params.id, organizationId });
  if (!existing) {
    throw new AppError('NOT_FOUND', 'Chambre introuvable.', 404);
  }

  const body = req.body as Record<string, any>;
  if (body.photos !== undefined) {
    existing.set('photos', await resolveCloudinaryPhotos(body.photos, orgId));
  }

  const fields = [
    'roomNumber',
    'categoryName',
    'floor',
    'bedsCount',
    'maxCapacity',
    'pricePerNight',
    'currency',
    'description',
    'status',
    'amenities',
  ] as const;
  for (const field of fields) {
    if (body[field] !== undefined) {
      existing.set(field, body[field]);
    }
  }
  if (body.categoryId && Types.ObjectId.isValid(body.categoryId)) {
    existing.categoryId = new Types.ObjectId(body.categoryId);
  }

  await existing.save();
  await syncEstablishmentRoomCounts(organizationId, existing.establishmentId);
  res.locals.data = existing.toObject();
}

export async function deleteRoom(req: Request, res: Response): Promise<void> {
  const organizationId = new Types.ObjectId(req.organizationContext!.organizationId);
  const room = await HotelRoom.findOne({ _id: req.params.id, organizationId }).lean();
  if (!room) {
    throw new AppError('NOT_FOUND', 'Chambre introuvable.', 404);
  }

  // Règle de réservation : impossible de supprimer si la chambre a des réservations actives ou à venir
  const activeReservationsCount = await HotelReservation.countDocuments({
    organizationId,
    roomId: room._id,
    status: { $in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
    checkOutDate: { $gte: new Date() },
  });

  if (activeReservationsCount > 0 || room.status === 'OCCUPIED' || room.status === 'RESERVED') {
    throw new AppError(
      'CONFLICT',
      'Suppression impossible : cette chambre est actuellement occupée ou possède des réservations actives/à venir.',
      409,
    );
  }

  await HotelRoom.deleteOne({ _id: room._id, organizationId });
  await syncEstablishmentRoomCounts(organizationId, room.establishmentId);

  for (const photo of room.photos ?? []) {
    if (photo.publicId && !photo.publicId.startsWith('local_')) {
      await deleteFromCloudinary(photo.publicId);
    }
  }

  res.locals.data = { deleted: true, id: req.params.id };
}

export async function createRoomReservation(req: Request, res: Response): Promise<void> {
  const organizationId = new Types.ObjectId(req.organizationContext!.organizationId);
  const body = req.body as {
    establishmentId: string;
    roomId: string;
    guestName: string;
    guestEmail?: string;
    guestPhone?: string;
    source?: 'DIRECT' | 'OTA' | 'CORPORATE' | 'WALK_IN';
    checkInDate: string;
    checkOutDate: string;
    totalAmount?: number;
  };

  const checkIn = new Date(body.checkInDate);
  const checkOut = new Date(body.checkOutDate);
  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()) || checkOut <= checkIn) {
    throw new AppError('VALIDATION_ERROR', 'Les dates de séjour sont invalides (départ doit être après arrivée).', 422);
  }

  const room = await HotelRoom.findOne({
    _id: body.roomId,
    organizationId,
    establishmentId: new Types.ObjectId(body.establishmentId),
  });
  if (!room) {
    throw new AppError('NOT_FOUND', 'Chambre introuvable dans cet établissement.', 404);
  }

  if (room.status === 'MAINTENANCE') {
    throw new AppError('CONFLICT', 'Cette chambre est en maintenance et ne peut pas être réservée.', 409);
  }

  // Vérification stricte anti-chevauchement : aucune chambre occupée/réservée sur une période qui se chevauche
  const overlapping = await HotelReservation.findOne({
    organizationId,
    roomId: room._id,
    status: { $in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
    checkInDate: { $lt: checkOut },
    checkOutDate: { $gt: checkIn },
  }).lean();

  if (overlapping) {
    throw new AppError(
      'CONFLICT',
      `Conflit de réservation : la chambre ${room.roomNumber} est déjà attribuée à ${overlapping.guestName} sur cette période.`,
      409,
    );
  }

  const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
  const totalAmount = body.totalAmount ?? nights * (room.pricePerNight || 0);
  const now = new Date();
  const isCurrentStay = checkIn <= now && checkOut > now;

  const created = await HotelReservation.create({
    organizationId,
    establishmentId: room.establishmentId,
    roomId: room._id,
    roomNumber: room.roomNumber,
    guestName: body.guestName.trim(),
    guestEmail: body.guestEmail?.trim() || '',
    guestPhone: body.guestPhone?.trim() || '',
    source: body.source || 'DIRECT',
    checkInDate: checkIn,
    checkOutDate: checkOut,
    nights,
    totalAmount,
    paidAmount: 0,
    currency: room.currency || 'FCFA',
    status: isCurrentStay ? 'CHECKED_IN' : 'CONFIRMED',
  });

  // Synchroniser automatiquement le statut de la chambre
  if (isCurrentStay) {
    room.status = 'OCCUPIED';
    await room.save();
  } else if (room.status === 'AVAILABLE') {
    room.status = 'RESERVED';
    await room.save();
  }
  await syncEstablishmentRoomCounts(organizationId, room.establishmentId);

  await HotelActivityLog.create({
    organizationId,
    establishmentId: room.establishmentId,
    type: 'RESERVATION',
    title: `Réservation Ch. ${room.roomNumber} — ${created.guestName}`,
    description: `${nights} nuit(s) du ${checkIn.toLocaleDateString('fr-FR')} au ${checkOut.toLocaleDateString('fr-FR')}`,
    severity: 'INFO',
  });

  res.status(201);
  res.locals.data = created.toObject();
}
