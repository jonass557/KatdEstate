import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { renderPdf } from '../../common/pdf.js';
import { Property, Unit } from '../../models/property.js';
import { Lease, Tenant } from '../../models/lease.js';
import { Payment, RentSchedule } from '../../models/finance.js';
import { MaintenanceTicket, Transaction } from '../../models/operations.js';
import { AuditLog } from '../../models/identity.js';

function org(req: Request): string {
  return req.organizationContext!.organizationId;
}

export async function ownerOverview(req: Request, res: Response): Promise<void> {
  const organizationId = org(req);
  const orgObjectId = new Types.ObjectId(organizationId);

  // Propriétés du propriétaire ou de l'organisation
  const propertyFilter: Record<string, unknown> = { organizationId, deletedAt: null };
  if (req.organizationContext!.role === 'OWNER') {
    // Si spécifié sur la propriété ou si propriétaire de l'organisation
    const userProperties = await Property.find({ organizationId, owner: req.user?.id, deletedAt: null });
    if (userProperties.length > 0) {
      propertyFilter.owner = req.user?.id;
    }
  }

  const properties = await Property.find(propertyFilter).sort({ name: 1 });
  const propertyIds = properties.map((p) => p._id);

  // Unités
  const units = await Unit.find({ organizationId, propertyId: { $in: propertyIds }, deletedAt: null });
  const totalUnits = units.length;
  const occupiedUnits = units.filter((u) => u.status === 'OCCUPIED').length;
  const availableUnits = units.filter((u) => u.status === 'AVAILABLE').length;
  const maintenanceUnits = units.filter((u) => u.status === 'MAINTENANCE').length;
  const occupancyRate = totalUnits === 0 ? 0 : Math.round((occupiedUnits / totalUnits) * 100);
  const vacancyRate = totalUnits === 0 ? 0 : Math.max(0, 100 - occupancyRate);

  // Baux
  const activeLeases = await Lease.countDocuments({
    organizationId,
    propertyId: { $in: propertyIds },
    status: { $in: ['ACTIVE', 'EXPIRING'] },
    deletedAt: null,
  });
  const expiringLeases = await Lease.countDocuments({
    organizationId,
    propertyId: { $in: propertyIds },
    status: 'EXPIRING',
    deletedAt: null,
  });

  // Finances du mois en cours
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [collectedAgg, expectedAgg, overdueAgg, expensesAgg] = await Promise.all([
    Payment.aggregate<{ total: number }>([
      { $match: { organizationId: orgObjectId, paidAt: { $gte: startOfMonth }, status: { $ne: 'REFUNDED' } } },
      { $group: { _id: null, total: { $sum: '$amountMinor' } } },
    ]),
    RentSchedule.aggregate<{ total: number }>([
      { $match: { organizationId: orgObjectId, propertyId: { $in: propertyIds }, dueDate: { $gte: startOfMonth }, status: { $ne: 'CANCELLED' } } },
      { $group: { _id: null, total: { $sum: '$amountDueMinor' } } },
    ]),
    RentSchedule.aggregate<{ total: number }>([
      { $match: { organizationId: orgObjectId, propertyId: { $in: propertyIds }, status: 'OVERDUE' } },
      { $group: { _id: null, total: { $sum: { $subtract: [{ $add: ['$amountDueMinor', '$penaltyMinor'] }, '$amountPaidMinor'] } } } },
    ]),
    Transaction.aggregate<{ total: number }>([
      { $match: { organizationId: orgObjectId, propertyId: { $in: propertyIds }, direction: 'EXPENSE', deletedAt: null, date: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$amountMinor' } } },
    ]),
  ]);

  const monthlyCollectedMinor = collectedAgg[0]?.total ?? 0;
  const monthlyExpectedMinor = expectedAgg[0]?.total ?? 0;
  const monthlyExpensesMinor = expensesAgg[0]?.total ?? 0;
  const arrearsMinor = overdueAgg[0]?.total ?? 0;
  const netProfitMinor = monthlyCollectedMinor - monthlyExpensesMinor;
  const recoveryRate = monthlyExpectedMinor === 0 ? 100 : Math.round((monthlyCollectedMinor / monthlyExpectedMinor) * 100);

  // Tickets de maintenance en cours
  const openMaintenance = await MaintenanceTicket.countDocuments({
    organizationId,
    propertyId: { $in: propertyIds },
    status: { $nin: ['RESOLVED', 'CLOSED', 'CANCELLED'] },
    deletedAt: null,
  });

  // Activités récentes des gestionnaires
  const recentActivities = await AuditLog.find({
    organizationId,
    action: { $in: ['lease.activate', 'payment.create', 'maintenance.create', 'maintenance.update', 'transaction.create'] },
  })
    .sort({ createdAt: -1 })
    .limit(10)
    .select('action resourceType resourceId createdAt');

  // Détail par propriété
  const propertiesBreakdown = await Promise.all(
    properties.map(async (prop) => {
      const propUnits = units.filter((u) => String(u.propertyId) === String(prop._id));
      const occupied = propUnits.filter((u) => u.status === 'OCCUPIED').length;
      const potentialRentMinor = propUnits.reduce((sum, u) => sum + (u.rentAmountMinor || 0), 0);

      const propCollected = await Payment.aggregate<{ total: number }>([
        {
          $lookup: {
            from: 'rentschedules',
            localField: 'rentScheduleId',
            foreignField: '_id',
            as: 'schedule',
          },
        },
        { $unwind: '$schedule' },
        {
          $match: {
            organizationId: orgObjectId,
            'schedule.propertyId': prop._id,
            paidAt: { $gte: startOfMonth },
            status: { $ne: 'REFUNDED' },
          },
        },
        { $group: { _id: null, total: { $sum: '$amountMinor' } } },
      ]);

      return {
        id: prop._id,
        name: prop.name,
        type: prop.type,
        city: prop.city,
        address: prop.address,
        totalUnits: propUnits.length,
        occupiedUnits: occupied,
        occupancyRate: propUnits.length === 0 ? 0 : Math.round((occupied / propUnits.length) * 100),
        potentialRentMinor,
        collectedRentMinor: propCollected[0]?.total ?? 0,
      };
    }),
  );

  res.locals.data = {
    portfolio: {
      totalProperties: properties.length,
      totalUnits,
      occupiedUnits,
      availableUnits,
      maintenanceUnits,
      occupancyRate,
      vacancyRate,
      activeLeases,
      expiringLeases,
      openMaintenance,
    },
    financials: {
      monthlyCollectedMinor,
      monthlyExpectedMinor,
      monthlyExpensesMinor,
      netProfitMinor,
      arrearsMinor,
      recoveryRate,
    },
    properties: propertiesBreakdown,
    recentActivities,
  };
}

export async function ownerReportPdf(req: Request, res: Response): Promise<void> {
  const organizationId = org(req);
  const properties = await Property.find({ organizationId, deletedAt: null });
  const units = await Unit.find({ organizationId, deletedAt: null });
  const occupied = units.filter((u) => u.status === 'OCCUPIED').length;

  const pdf = await renderPdf({
    title: 'Rapport de Gestion Patrimoniale — DOMORA',
    subtitle: `Synthèse propriétaire au ${new Date().toISOString().slice(0, 10)}`,
    organizationName: 'DOMORA Real Estate SaaS',
    sections: [
      {
        heading: 'Patrimoine immobilier',
        lines: [
          `Nombre total de propriétés : ${properties.length}`,
          `Nombre de lots / logements : ${units.length}`,
          `Logements occupés : ${occupied}`,
          `Taux d'occupation global : ${units.length === 0 ? 0 : Math.round((occupied / units.length) * 100)} %`,
        ],
      },
      {
        heading: 'Propriétés gérées',
        lines: properties.map(
          (p) => `• ${p.name} (${p.type}) — ${p.city}, ${p.address} — Lots : ${units.filter((u) => String(u.propertyId) === String(p._id)).length}`,
        ),
      },
    ],
    footer: 'Rapport confidentiel généré par DOMORA.',
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.send(pdf);
}
