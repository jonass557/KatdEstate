import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { recordAudit } from '../../common/audit.js';
import { AppError } from '../../common/errors.js';
import { escapeRegex, notFound, paginate } from '../../common/pagination.js';
import { renderPdf } from '../../common/pdf.js';
import { Building, Property, Unit } from '../../models/property.js';
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

export async function createProperty(req: Request, res: Response): Promise<void> {
  const property = await Property.create({ ...req.body, organizationId: org(req) });
  await audit(req, 'property.create', 'Property', String(property._id));
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
  res.locals.data = property;
}

export async function updateProperty(req: Request, res: Response): Promise<void> {
  const property = await Property.findOneAndUpdate(
    { _id: req.params.id, ...active(org(req)) },
    req.body,
    { new: true },
  );
  if (!property) throw notFound('Propriété');
  await audit(req, 'property.update', 'Property', String(property._id));
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
