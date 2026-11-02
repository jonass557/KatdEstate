import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { escapeRegex } from '../../common/pagination.js';
import { Invoice, Payment, RentSchedule } from '../../models/finance.js';
import { Lease, Tenant } from '../../models/lease.js';
import { MaintenanceTicket, Transaction, Vendor } from '../../models/operations.js';
import { Building, Property, Unit } from '../../models/property.js';
import { DashboardLayout, PlatformDocumentModel } from '../../models/platform.js';

const DEFAULT_WIDGETS = ['income', 'arrears', 'occupancy', 'available', 'expiring', 'maintenance', 'expenses', 'cashflow'] as const;

function org(req: Request): string {
  return req.organizationContext!.organizationId;
}

/**
 * Indicateurs du tableau de bord propriétaire.
 * Chaque valeur est un agrégat. Une organisation sans données reçoit des zéros,
 * jamais une valeur d'exemple.
 */
export async function overview(req: Request, res: Response): Promise<void> {
  const organizationId = org(req);
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [units, occupied, available, income, expenses, overdue, expiring, maintenance] = await Promise.all([
    Unit.countDocuments({ organizationId, deletedAt: null }),
    Unit.countDocuments({ organizationId, status: 'OCCUPIED', deletedAt: null }),
    Unit.countDocuments({ organizationId, status: 'AVAILABLE', deletedAt: null }),
    Transaction.aggregate<{ total: number }>([{ $match: { organizationId: new Types.ObjectId(organizationId), direction: 'INCOME', deletedAt: null, date: { $gte: monthStart } } }, { $group: { _id: null, total: { $sum: '$amountMinor' } } }]),
    Transaction.aggregate<{ total: number }>([{ $match: { organizationId: new Types.ObjectId(organizationId), direction: 'EXPENSE', deletedAt: null, date: { $gte: monthStart } } }, { $group: { _id: null, total: { $sum: '$amountMinor' } } }]),
    RentSchedule.aggregate<{ total: number }>([{ $match: { organizationId: new Types.ObjectId(organizationId), status: 'OVERDUE' } }, { $group: { _id: null, total: { $sum: { $subtract: ['$amountDueMinor', '$amountPaidMinor'] } } } }]),
    Lease.countDocuments({ organizationId, status: 'EXPIRING', deletedAt: null }),
    MaintenanceTicket.countDocuments({ organizationId, status: { $nin: ['RESOLVED', 'CLOSED'] }, deletedAt: null }),
  ]);

  const incomeMinor = income[0]?.total ?? 0;
  const expenseMinor = expenses[0]?.total ?? 0;
  res.locals.data = {
    incomeMinor,
    arrearsMinor: overdue[0]?.total ?? 0,
    occupancyRate: units === 0 ? 0 : Math.round((occupied / units) * 100),
    availableUnits: available,
    expiringLeases: expiring,
    openMaintenance: maintenance,
    expenseMinor,
    cashflowMinor: incomeMinor - expenseMinor,
    note: units === 0 && incomeMinor === 0 ? 'Aucune donnée enregistrée pour cette période.' : undefined,
  };
}

export async function getLayout(req: Request, res: Response): Promise<void> {
  const layout = await DashboardLayout.findOne({ organizationId: org(req), userId: req.user?.id });
  res.locals.data = { widgets: layout?.widgets ?? [...DEFAULT_WIDGETS], hidden: layout?.hidden ?? [] };
}

export async function saveLayout(req: Request, res: Response): Promise<void> {
  const layout = await DashboardLayout.findOneAndUpdate(
    { organizationId: org(req), userId: req.user?.id },
    { widgets: req.body.widgets, hidden: req.body.hidden ?? [] },
    { new: true, upsert: true },
  );
  res.locals.data = layout;
}

/** Recherche intelligente universelle limitée aux ressources de l'organisation. */
export async function search(req: Request, res: Response): Promise<void> {
  const term = escapeRegex(String(req.query.q ?? '').trim());
  if (term.length < 2) {
    res.locals.data = [];
    return;
  }
  const regex = { $regex: term, $options: 'i' };
  const organizationId = org(req);

  const [tenants, units, properties, buildings, leases, invoices, payments, docs, tickets, vendors] = await Promise.all([
    Tenant.find({ organizationId, deletedAt: null, $or: [{ fullName: regex }, { phone: regex }, { email: regex }] })
      .limit(5)
      .select('fullName phone email'),
    Unit.find({ organizationId, deletedAt: null, $or: [{ name: regex }, { number: regex }] })
      .limit(5)
      .select('name number status'),
    Property.find({ organizationId, deletedAt: null, $or: [{ name: regex }, { city: regex }, { address: regex }] })
      .limit(5)
      .select('name city type'),
    Building.find({ organizationId, deletedAt: null, name: regex })
      .limit(5)
      .select('name'),
    Lease.find({ organizationId, deletedAt: null, number: regex })
      .limit(5)
      .select('number status'),
    Invoice.find({ organizationId, number: regex })
      .limit(5)
      .select('number amountTotalMinor status'),
    Payment.find({ organizationId, number: regex })
      .limit(5)
      .select('number amountMinor method'),
    PlatformDocumentModel.find({ organizationId, deletedAt: null, title: regex })
      .limit(5)
      .select('title type'),
    MaintenanceTicket.find({ organizationId, deletedAt: null, $or: [{ title: regex }, { category: regex }] })
      .limit(5)
      .select('title category status priority'),
    Vendor.find({ organizationId, deletedAt: null, name: regex })
      .limit(5)
      .select('name trade phone'),
  ]);

  res.locals.data = [
    ...properties.map((item) => ({ type: 'property', id: item._id, label: item.name, subtitle: `${item.type} · ${item.city}`, url: `/properties/${item._id}` })),
    ...buildings.map((item) => ({ type: 'building', id: item._id, label: item.name, subtitle: 'Bâtiment', url: '/properties' })),
    ...units.map((item) => ({ type: 'unit', id: item._id, label: item.name, subtitle: `Lot ${item.number || ''} · ${item.status}`, url: '/units' })),
    ...tenants.map((item) => ({ type: 'tenant', id: item._id, label: item.fullName, subtitle: item.phone || item.email || 'Locataire', url: '/tenants' })),
    ...leases.map((item) => ({ type: 'lease', id: item._id, label: `Bail ${item.number}`, subtitle: item.status, url: '/leases' })),
    ...invoices.map((item) => ({ type: 'invoice', id: item._id, label: `Facture ${item.number}`, subtitle: `${item.amountTotalMinor.toLocaleString('fr-FR')} FCFA`, url: '/rent' })),
    ...payments.map((item) => ({ type: 'payment', id: item._id, label: `Paiement ${item.number}`, subtitle: `${item.amountMinor.toLocaleString('fr-FR')} FCFA · ${item.method}`, url: '/payments' })),
    ...tickets.map((item) => ({ type: 'maintenance', id: item._id, label: item.title, subtitle: `${item.category} · ${item.status}`, url: '/maintenance' })),
    ...docs.map((item) => ({ type: 'document', id: item._id, label: item.title, subtitle: item.type, url: '/documents' })),
    ...vendors.map((item) => ({ type: 'vendor', id: item._id, label: item.name, subtitle: `Artisan ${item.trade}`, url: '/maintenance' })),
  ];
}

/**
 * Indicateur descriptif d'une propriété.
 * Ce n'est pas une notation de la qualité d'un investissement : il résume
 * uniquement l'occupation, les impayés et la maintenance de cette propriété.
 */
export async function propertyHealth(req: Request, res: Response): Promise<void> {
  const propertyId = String(req.params.id);
  const units = await Unit.countDocuments({ organizationId: org(req), propertyId, deletedAt: null });
  const occupied = await Unit.countDocuments({ organizationId: org(req), propertyId, status: 'OCCUPIED', deletedAt: null });
  const overdue = await RentSchedule.countDocuments({ organizationId: org(req), propertyId, status: 'OVERDUE' });
  const open = await MaintenanceTicket.countDocuments({ organizationId: org(req), propertyId, status: { $nin: ['RESOLVED', 'CLOSED'] }, deletedAt: null });
  const occupancy = units === 0 ? 0 : occupied / units;
  const score = Math.max(0, Math.round(100 * occupancy - overdue * 5 - open * 3));
  res.locals.data = {
    score,
    disclaimer: 'Indicateur calculé sur les données de cette propriété, pas une notation de la qualité d’un investissement.',
    inputs: { units, occupied, overdue, openMaintenance: open },
  };
}
