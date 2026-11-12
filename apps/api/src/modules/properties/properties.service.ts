import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { Types } from 'mongoose';
import {
  isPointInsideBoundary,
  isPolygonInsidePolygon,
  validatePolygonGeometry,
  type GeoJsonBoundary,
  type GeoJsonCoordinate,
} from '@rentflow/shared';
import { recordAudit } from '../../common/audit.js';
import { AppError } from '../../common/errors.js';
import { escapeRegex, notFound, paginate } from '../../common/pagination.js';
import { renderPdf } from '../../common/pdf.js';
import { Organization, User } from '../../models/identity.js';
import { Building, Property, Unit } from '../../models/property.js';
import { GeoAuditLog, GeoBlock, GeoNeighborhood, GeoOwner } from '../../models/quartier.js';
import { MaintenanceTicket } from '../../models/operations.js';
import { Payment, RentSchedule } from '../../models/finance.js';

function org(req: Request): string {
  return req.organizationContext!.organizationId;
}

function active(organizationId: string): { organizationId: string; deletedAt: null } {
  return { organizationId, deletedAt: null };
}

async function audit(
  req: Request,
  action: string,
  resourceType: string,
  resourceId: string,
): Promise<void> {
  await recordAudit({
    organizationId: org(req),
    ...(req.user?.id ? { actorId: req.user.id } : {}),
    action,
    resourceType,
    resourceId,
    requestId: req.requestId,
  });
}

function isAdminActor(req: Request): boolean {
  return (
    Boolean(req.user?.roles?.includes('SUPER_ADMIN')) ||
    req.organizationContext?.role === 'ADMIN'
  );
}

async function validateAndPreparePropertyGeo(
  req: Request,
  payload: Record<string, unknown>,
  existing?: {
    geoOwnerId?: unknown;
    blockId?: unknown;
    neighborhoodId?: unknown;
    latitude?: number | null | undefined;
    longitude?: number | null | undefined;
    location?: { type: string; coordinates: number[] } | null | undefined;
    boundary?: unknown;
    geoUniqueId?: string | null | undefined;
  },
): Promise<{ prepared: Record<string, unknown>; derogationGranted: boolean }> {
  const prepared: Record<string, unknown> = { ...payload };

  // Normaliser latitude/longitude <-> location GeoJSON Point
  const bodyLoc = payload.location as { coordinates?: [number, number] } | undefined;
  let lat = payload.latitude as number | undefined;
  let lng = payload.longitude as number | undefined;

  if (bodyLoc?.coordinates && bodyLoc.coordinates.length === 2) {
    lng = bodyLoc.coordinates[0];
    lat = bodyLoc.coordinates[1];
  } else if (lat !== undefined && lng !== undefined) {
    prepared.location = { type: 'Point', coordinates: [lng, lat] };
  }

  if (lat !== undefined && lng !== undefined) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new AppError('VALIDATION_ERROR', 'Coordonnées GPS (latitude/longitude) invalides.', 422);
    }
    prepared.latitude = lat;
    prepared.longitude = lng;
    prepared.location = { type: 'Point', coordinates: [lng, lat] };
  }

  const boundary = payload.boundary as GeoJsonBoundary | undefined;
  if (boundary) {
    const valid = validatePolygonGeometry(boundary);
    if (!valid.valid) {
      throw new AppError('VALIDATION_ERROR', valid.error ?? 'Polygone de propriété invalide.', 422);
    }
  }

  const effectivePoint: GeoJsonCoordinate | undefined =
    lng !== undefined && lat !== undefined
      ? [lng, lat]
      : existing?.location?.coordinates?.length === 2
        ? [existing.location.coordinates[0]!, existing.location.coordinates[1]!]
        : existing?.longitude !== undefined && existing?.longitude !== null && existing?.latitude !== undefined && existing?.latitude !== null
          ? [existing.longitude, existing.latitude]
          : undefined;
  const effectiveBoundary = boundary ?? (existing?.boundary as GeoJsonBoundary | undefined);

  const hasGeoInput = Boolean(
    lat !== undefined ||
      lng !== undefined ||
      boundary ||
      payload.geoOwnerId ||
      payload.blockId ||
      payload.neighborhoodId,
  );

  if (!hasGeoInput) {
    return { prepared, derogationGranted: false };
  }

  // Résoudre le propriétaire géographique, bloc et quartier de rattachement
  let geoOwnerId = (payload.geoOwnerId ?? existing?.geoOwnerId) as string | undefined;
  let geoOwnerDoc = geoOwnerId ? await GeoOwner.findById(geoOwnerId).lean() : null;

  if (!geoOwnerDoc && req.user?.id && req.organizationContext?.role === 'OWNER') {
    const userDoc = await User.findById(req.user.id).select('emailNormalized').lean();
    geoOwnerDoc = await GeoOwner.findOne({
      $or: [
        { userId: req.user.id },
        ...(userDoc?.emailNormalized ? [{ email: userDoc.emailNormalized }] : []),
      ],
    }).lean();
    if (geoOwnerDoc) {
      geoOwnerId = String(geoOwnerDoc._id);
      prepared.geoOwnerId = geoOwnerDoc._id;
    }
  }

  const resolvedBlockId = (payload.blockId ?? geoOwnerDoc?.blockId ?? existing?.blockId) as
    | string
    | undefined;
  const blockDoc = resolvedBlockId
    ? await GeoBlock.findById(resolvedBlockId)
        .populate('blockLeaderId', 'displayName')
        .lean()
    : null;
  if (blockDoc) {
    prepared.blockId = blockDoc._id;
    if (!prepared.sectorName) prepared.sectorName = blockDoc.name;
    const blockLeader = blockDoc.blockLeaderId as unknown as { displayName?: string } | undefined;
    if (!prepared.blockLeaderName && blockLeader?.displayName) {
      prepared.blockLeaderName = blockLeader.displayName;
    }
  }

  const resolvedNeighborhoodId = (payload.neighborhoodId ??
    blockDoc?.neighborhoodId ??
    geoOwnerDoc?.neighborhoodId ??
    existing?.neighborhoodId) as string | undefined;
  const neighborhoodDoc = resolvedNeighborhoodId
    ? await GeoNeighborhood.findById(resolvedNeighborhoodId)
        .populate('leaderId', 'displayName')
        .lean()
    : null;
  if (neighborhoodDoc) {
    prepared.neighborhoodId = neighborhoodDoc._id;
    if (!prepared.neighborhoodName) prepared.neighborhoodName = neighborhoodDoc.name;
    if (!prepared.region && neighborhoodDoc.region) prepared.region = neighborhoodDoc.region;
    if (!prepared.department && neighborhoodDoc.department)
      prepared.department = neighborhoodDoc.department;
    if (!prepared.arrondissement && neighborhoodDoc.arrondissement)
      prepared.arrondissement = neighborhoodDoc.arrondissement;
    const chief = neighborhoodDoc.leaderId as unknown as { displayName?: string } | undefined;
    if (!prepared.neighborhoodLeaderName && chief?.displayName) {
      prepared.neighborhoodLeaderName = chief.displayName;
    }
  }

  // Vérification obligatoire d'inclusion hiérarchique (Niveau 3 -> Niveau 2 -> Niveau 1)
  const violations: string[] = [];

  if (geoOwnerDoc?.assignedBoundary) {
    const ownerBoundary = geoOwnerDoc.assignedBoundary as GeoJsonBoundary;
    if (effectivePoint && !isPointInsideBoundary(effectivePoint, ownerBoundary)) {
      violations.push(
        `la position du bien sort de la zone géographique attribuée au propriétaire (${geoOwnerDoc.fullName})`,
      );
    }
    if (effectiveBoundary && !isPolygonInsidePolygon(effectiveBoundary, ownerBoundary)) {
      violations.push(
        `le contour du bien dépasse la zone attribuée au propriétaire (${geoOwnerDoc.fullName})`,
      );
    }
  }

  if (blockDoc?.boundary?.coordinates) {
    const blockBoundary = blockDoc.boundary as GeoJsonBoundary;
    if (effectivePoint && !isPointInsideBoundary(effectivePoint, blockBoundary)) {
      violations.push(`la position se situe hors de la zone du Chef de Bloc (${blockDoc.name})`);
    }
    if (effectiveBoundary && !isPolygonInsidePolygon(effectiveBoundary, blockBoundary)) {
      violations.push(`le contour dépasse les frontières du bloc (${blockDoc.name})`);
    }
  }

  if (neighborhoodDoc?.boundary?.coordinates) {
    const nbBoundary = neighborhoodDoc.boundary as GeoJsonBoundary;
    if (effectivePoint && !isPointInsideBoundary(effectivePoint, nbBoundary)) {
      violations.push(`la position sort des limites du quartier (${neighborhoodDoc.name})`);
    }
    if (effectiveBoundary && !isPolygonInsidePolygon(effectiveBoundary, nbBoundary)) {
      violations.push(`le contour sort des limites du quartier (${neighborhoodDoc.name})`);
    }
  }

  let derogationGranted = false;
  if (violations.length > 0) {
    const derogation = payload.geoDerogation as { granted?: boolean; justification?: string } | undefined;
    const canOverride =
      derogation?.granted === true &&
      isAdminActor(req) &&
      typeof derogation.justification === 'string' &&
      derogation.justification.trim().length > 0;

    if (!canOverride) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Contrôle géographique échoué : ${violations.join(' ; ')}. Veuillez replacer le bien dans votre périmètre autorisé ou demander une dérogation administrative justifiée.`,
        422,
      );
    }

    derogationGranted = true;
    prepared.geoDerogation = {
      granted: true,
      justification: derogation.justification!.trim(),
      grantedBy: req.user!.id,
      grantedAt: new Date(),
    };
  }

  if (!prepared.geoUniqueId && !existing?.geoUniqueId && (effectivePoint || effectiveBoundary)) {
    prepared.geoUniqueId = `DOM-GEO-${Date.now().toString(36).toUpperCase()}-${randomBytes(2)
      .toString('hex')
      .toUpperCase()}`;
  }

  if (req.user?.id && !prepared.ownerId && !existing) {
    prepared.ownerId = req.user.id;
  }

  return { prepared, derogationGranted };
}

function generatePropertyMatricule(): string {
  return `DOM-PROP-${randomBytes(4).toString('hex').toUpperCase()}`;
}

export async function createProperty(req: Request, res: Response): Promise<void> {
  const { prepared, derogationGranted } = await validateAndPreparePropertyGeo(
    req,
    req.body as Record<string, unknown>,
  );
  if (!prepared.geoUniqueId) {
    prepared.geoUniqueId = generatePropertyMatricule();
  }
  if (!prepared.ownerId && req.user?.id) {
    prepared.ownerId = req.user.id;
  }
  const property = await Property.create({ ...prepared, organizationId: org(req) });
  await audit(req, 'property.create', 'Property', String(property._id));

  if ((prepared.location || prepared.boundary) && req.user?.id) {
    await GeoAuditLog.create({
      entityType: 'PROPERTY',
      entityId: String(property._id),
      organizationId: org(req),
      neighborhoodId: property.neighborhoodId,
      blockId: property.blockId,
      ownerId: property.geoOwnerId,
      action: derogationGranted ? 'DEROGATION_GRANTED' : 'CREATE_BOUNDARY',
      performedBy: req.user.id,
      performedByRole: req.user?.roles?.includes('SUPER_ADMIN') ? 'SUPER_ADMIN' : req.organizationContext?.role,
      newBoundary: prepared.boundary ?? prepared.location,
      justification: derogationGranted ? property.geoDerogation?.justification : undefined,
    });
  }

  res.status(201);
  res.locals.data = property;
}

export async function listProperties(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as {
    page: number;
    pageSize: number;
    order: 'asc' | 'desc';
    sort?: string;
    search?: string;
    status?: string;
    city?: string;
    type?: string;
  };
  const filter: Record<string, unknown> = { ...active(org(req)) };
  if (query.status) filter.status = query.status;
  if (query.city) filter.city = query.city;
  if (query.type) filter.type = query.type;
  if (query.search) filter.name = { $regex: escapeRegex(query.search), $options: 'i' };

  const page = await paginate(Property, filter, query, 'property');
  res.locals.data = page.items;
  res.locals.meta = page.meta;
}

export async function getProperty(req: Request, res: Response): Promise<void> {
  const property = await Property.findOne({ _id: req.params.id, ...active(org(req)) });
  if (!property) throw notFound('Propriété');
  if (!property.geoUniqueId) {
    property.geoUniqueId = generatePropertyMatricule();
    await property.save();
  }
  res.locals.data = property;
}

export async function getPublicPropertyByCode(req: Request, res: Response): Promise<void> {
  const rawCode = String(req.params.code ?? '').trim();
  if (!rawCode) {
    throw notFound('Propriété');
  }
  const codeUpper = rawCode.toUpperCase();
  const property = await Property.findOne({
    deletedAt: null,
    $or: [
      { geoUniqueId: codeUpper },
      ...(Types.ObjectId.isValid(rawCode) ? [{ _id: rawCode }] : []),
    ],
  }).lean();

  if (!property) {
    throw notFound('Propriété');
  }

  const [organizationDoc, userDoc, geoOwnerDoc, units] = await Promise.all([
    Organization.findById(property.organizationId).select('name country').lean(),
    property.ownerId
      ? User.findById(property.ownerId).select('displayName emailNormalized phone').lean()
      : null,
    property.geoOwnerId
      ? GeoOwner.findById(property.geoOwnerId)
          .select('fullName phone email')
          .lean()
      : null,
    Unit.find({ propertyId: property._id, deletedAt: null })
      .select('name number type status rentAmountMinor surfaceM2')
      .sort({ name: 1 })
      .lean(),
  ]);

  const ownerFullName =
    property.owner ||
    geoOwnerDoc?.fullName ||
    userDoc?.displayName ||
    organizationDoc?.name ||
    'Propriétaire enregistré';

  res.locals.data = {
    property: {
      _id: String(property._id),
      geoUniqueId: property.geoUniqueId || String(property._id),
      name: property.name,
      type: property.type,
      customPropertyType: property.customPropertyType,
      address: property.address,
      city: property.city,
      zone: property.zone,
      country: property.country,
      status: property.status,
      description: property.description,
      region: property.region,
      department: property.department,
      arrondissement: property.arrondissement,
      neighborhoodName: property.neighborhoodName,
      sectorName: property.sectorName,
      neighborhoodLeaderName: property.neighborhoodLeaderName,
      blockLeaderName: property.blockLeaderName,
      latitude: property.latitude,
      longitude: property.longitude,
      location: property.location,
      boundary: property.boundary,
      chambreSimpleCount: property.chambreSimpleCount,
      chambreModerneCount: property.chambreModerneCount,
      studioSimpleCount: property.studioSimpleCount,
      studioModerneCount: property.studioModerneCount,
      appartementCount: property.appartementCount,
      otherCustomType: property.otherCustomType,
      otherCustomCount: property.otherCustomCount,
      roomsCount: property.roomsCount,
      studiosCount: property.studiosCount,
      apartmentsCount: property.apartmentsCount,
      otherUnitsCount: property.otherUnitsCount,
      createdAt: property.createdAt,
    },
    owner: {
      name: ownerFullName,
      phone: geoOwnerDoc?.phone || userDoc?.phone || '',
      email: geoOwnerDoc?.email || userDoc?.emailNormalized || '',
      organizationName: organizationDoc?.name || '',
      manager: property.manager || '',
    },
    units,
  };
}

export async function updateProperty(req: Request, res: Response): Promise<void> {
  const existing = await Property.findOne({ _id: req.params.id, ...active(org(req)) });
  if (!existing) throw notFound('Propriété');

  const { prepared, derogationGranted } = await validateAndPreparePropertyGeo(
    req,
    req.body as Record<string, unknown>,
    existing,
  );
  const previousBoundary = existing.boundary ?? existing.location;

  const property = await Property.findOneAndUpdate(
    { _id: req.params.id, ...active(org(req)) },
    prepared,
    { new: true },
  );
  if (!property) throw notFound('Propriété');
  await audit(req, 'property.update', 'Property', String(property._id));

  if ((prepared.location || prepared.boundary) && req.user?.id) {
    await GeoAuditLog.create({
      entityType: 'PROPERTY',
      entityId: String(property._id),
      organizationId: org(req),
      neighborhoodId: property.neighborhoodId,
      blockId: property.blockId,
      ownerId: property.geoOwnerId,
      action: derogationGranted ? 'DEROGATION_GRANTED' : 'UPDATE_BOUNDARY',
      performedBy: req.user.id,
      performedByRole: req.user?.roles?.includes('SUPER_ADMIN') ? 'SUPER_ADMIN' : req.organizationContext?.role,
      previousBoundary,
      newBoundary: prepared.boundary ?? prepared.location,
      justification: derogationGranted ? property.geoDerogation?.justification : undefined,
    });
  }

  res.locals.data = property;
}

export async function deleteProperty(req: Request, res: Response): Promise<void> {
  const property = await Property.findOneAndUpdate(
    { _id: req.params.id, ...active(org(req)) },
    { deletedAt: new Date() },
    { new: true },
  );
  if (!property) throw notFound('Propriété');
  await audit(req, 'property.delete', 'Property', String(property._id));
  res.locals.data = { id: String(property._id), deleted: true };
}

export async function createBuilding(req: Request, res: Response): Promise<void> {
  const property = await Property.findOne({ _id: req.body.propertyId, ...active(org(req)) });
  if (!property) throw notFound('Propriété');
  const building = await Building.create({ ...req.body, organizationId: org(req) });
  await audit(req, 'building.create', 'Building', String(building._id));
  res.status(201);
  res.locals.data = building;
}

export async function listBuildings(req: Request, res: Response): Promise<void> {
  const filter: Record<string, unknown> = { ...active(org(req)) };
  if (req.query.propertyId) filter.propertyId = req.query.propertyId;
  const page = await paginate(Building, filter, req.query as never, 'building');
  res.locals.data = page.items;
  res.locals.meta = page.meta;
}

export async function updateBuilding(req: Request, res: Response): Promise<void> {
  const building = await Building.findOneAndUpdate(
    { _id: req.params.id, ...active(org(req)) },
    req.body,
    { new: true },
  );
  if (!building) throw notFound('Bâtiment');
  await audit(req, 'building.update', 'Building', String(building._id));
  res.locals.data = building;
}

export async function deleteBuilding(req: Request, res: Response): Promise<void> {
  const building = await Building.findOneAndUpdate(
    { _id: req.params.id, ...active(org(req)) },
    { deletedAt: new Date() },
  );
  if (!building) throw notFound('Bâtiment');
  await audit(req, 'building.delete', 'Building', String(building._id));
  res.locals.data = { id: String(building._id), deleted: true };
}

export async function createUnit(req: Request, res: Response): Promise<void> {
  const property = await Property.findOne({ _id: req.body.propertyId, ...active(org(req)) });
  if (!property) throw notFound('Propriété');
  if (req.body.buildingId) {
    const building = await Building.findOne({
      _id: req.body.buildingId,
      propertyId: req.body.propertyId,
      ...active(org(req)),
    });
    if (!building)
      throw new AppError(
        'VALIDATION_ERROR',
        'Le bâtiment n’appartient pas à cette propriété.',
        422,
      );
  }
  const unit = await Unit.create({ ...req.body, organizationId: org(req) });
  await audit(req, 'unit.create', 'Unit', String(unit._id));
  res.status(201);
  res.locals.data = unit;
}

export async function listUnits(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as Record<string, string | undefined> & {
    page: number;
    pageSize: number;
    order: 'asc' | 'desc';
    sort?: string;
  };
  const filter: Record<string, unknown> = { ...active(org(req)) };
  for (const key of ['status', 'type', 'propertyId', 'buildingId'] as const) {
    if (query[key]) filter[key] = query[key];
  }
  if (query.search) {
    filter.$or = ['name', 'number'].map((field) => ({
      [field]: { $regex: escapeRegex(query.search as string), $options: 'i' },
    }));
  }
  const page = await paginate(Unit, filter, query, 'unit');
  res.locals.data = page.items;
  res.locals.meta = page.meta;
}

export async function getUnit(req: Request, res: Response): Promise<void> {
  const unit = await Unit.findOne({ _id: req.params.id, ...active(org(req)) });
  if (!unit) throw notFound('Logement');
  res.locals.data = unit;
}

export async function updateUnit(req: Request, res: Response): Promise<void> {
  const unit = await Unit.findOneAndUpdate({ _id: req.params.id, ...active(org(req)) }, req.body, {
    new: true,
  });
  if (!unit) throw notFound('Logement');
  await audit(req, 'unit.update', 'Unit', String(unit._id));
  res.locals.data = unit;
}

export async function deleteUnit(req: Request, res: Response): Promise<void> {
  const unit = await Unit.findOneAndUpdate(
    { _id: req.params.id, ...active(org(req)) },
    { deletedAt: new Date() },
  );
  if (!unit) throw notFound('Logement');
  await audit(req, 'unit.delete', 'Unit', String(unit._id));
  res.locals.data = { id: String(unit._id), deleted: true };
}

export async function attachPhotos(req: Request, res: Response): Promise<void> {
  const id = req.params.unitId ?? req.params.id;
  const fileIds = (req.body.fileIds as string[]).map((fileId) => new Types.ObjectId(fileId));
  const update = { $push: { photos: { $each: fileIds.map((fileId) => ({ fileId })) } } };
  const document = req.params.unitId
    ? await Unit.findOneAndUpdate({ _id: id, ...active(org(req)) }, update, { new: true })
    : await Property.findOneAndUpdate({ _id: id, ...active(org(req)) }, update, { new: true });
  if (!document) throw notFound('Ressource');
  res.locals.data = document;
}

/** Indicateurs d'une propriété, calculés à la volée — jamais mis en cache dur. */
export async function propertyStats(req: Request, res: Response): Promise<void> {
  const property = await Property.findOne({ _id: req.params.id, ...active(org(req)) });
  if (!property) throw notFound('Propriété');

  const units = await Unit.find({ propertyId: property._id, ...active(org(req)) }).select(
    'status rentAmountMinor',
  );
  const occupied = units.filter((unit) => unit.status === 'OCCUPIED').length;
  const available = units.filter((unit) => unit.status === 'AVAILABLE').length;
  const potentialRentMinor = units.reduce((acc, unit) => acc + (unit.rentAmountMinor ?? 0), 0);

  const [collected] = await Payment.aggregate<{ total: number }>([
    { $match: { organizationId: property.organizationId, status: 'CONFIRMED' } },
    {
      $lookup: {
        from: 'rentschedules',
        localField: 'rentScheduleId',
        foreignField: '_id',
        as: 'schedule',
      },
    },
    { $match: { 'schedule.propertyId': property._id } },
    { $group: { _id: null, total: { $sum: '$amountMinor' } } },
  ]);

  const [overdue] = await RentSchedule.aggregate<{ total: number }>([
    {
      $match: {
        propertyId: property._id,
        organizationId: property.organizationId,
        status: 'OVERDUE',
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: { $subtract: ['$amountDueMinor', '$amountPaidMinor'] } },
      },
    },
  ]);

  const openMaintenance = await MaintenanceTicket.countDocuments({
    propertyId: property._id,
    ...active(org(req)),
    status: { $nin: ['RESOLVED', 'CLOSED'] },
  });

  res.locals.data = {
    units: units.length,
    occupied,
    available,
    occupancyRate: units.length === 0 ? 0 : Math.round((occupied / units.length) * 1000) / 10,
    potentialRentMinor,
    collectedMinor: collected?.total ?? 0,
    overdueMinor: overdue?.total ?? 0,
    openMaintenance,
    currency: 'XOF',
  };
}

export async function exportProperties(req: Request, res: Response): Promise<void> {
  const properties = await Property.find(active(org(req))).sort({ name: 1 });
  if (req.query.format === 'pdf') {
    const pdf = await renderPdf({
      title: 'Parc immobilier',
      organizationName: 'RentFlow',
      table: {
        columns: ['Nom', 'Ville', 'Statut'],
        rows: properties.map((property) => [property.name, property.city, property.status]),
      },
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="proprietes.pdf"');
    res.send(pdf);
    return;
  }

  const header = 'nom,adresse,ville,pays,statut';
  const rows = properties.map((property) =>
    [property.name, property.address, property.city, property.country, property.status]
      .map((value) => `"${value.replace(/"/g, '""')}"`)
      .join(','),
  );
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="proprietes.csv"');
  res.send(`\uFEFF${[header, ...rows].join('\n')}`);
}
