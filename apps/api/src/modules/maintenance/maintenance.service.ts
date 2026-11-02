import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import type { AppConfig } from '../../config/index.js';
import { recordAudit } from '../../common/audit.js';
import { AppError } from '../../common/errors.js';
import { notFound, paginate } from '../../common/pagination.js';
import { MaintenanceEvent, MaintenanceTask, MaintenanceTicket, Vendor } from '../../models/operations.js';
import { Lease, Tenant } from '../../models/lease.js';
import { Unit } from '../../models/property.js';
import { notify } from '../notifications/notifications.service.js';

function org(req: Request): string {
  return req.organizationContext!.organizationId;
}
const active = (organizationId: string) => ({ organizationId, deletedAt: null });

async function history(req: Request, ticketId: string, type: string, message: string): Promise<void> {
  await MaintenanceEvent.create({
    organizationId: org(req),
    ticketId,
    ...(req.user?.id ? { actorId: req.user.id } : {}),
    type,
    message,
  });
}

export function createMaintenanceHandlers(config: AppConfig) {
  return {
    async create(req: Request, res: Response): Promise<void> {
      let propertyId: unknown;
      let tenantId: unknown;

      if (req.body.unitId) {
        const unit = await Unit.findOne({ _id: req.body.unitId, ...active(org(req)) });
        if (!unit) throw notFound('Logement');
        propertyId = unit.propertyId;

        // Un locataire ne signale un problème que sur le logement de son contrat.
        if (req.organizationContext!.role === 'TENANT') {
          const tenant = await Tenant.findOne({ organizationId: org(req), userId: req.user!.id, deletedAt: null });
          const lease = await Lease.findOne({
            organizationId: org(req),
            tenantId: tenant?._id,
            unitId: unit._id,
            status: { $in: ['ACTIVE', 'EXPIRING'] },
            deletedAt: null,
          });
          if (!lease) throw new AppError('FORBIDDEN', 'Vous ne pouvez signaler un problème que sur votre logement.', 403);
          tenantId = tenant?._id;
        }
      }

      const ticket = await MaintenanceTicket.create({
        ...req.body,
        organizationId: org(req),
        ...(propertyId ? { propertyId } : {}),
        ...(tenantId ? { tenantId } : {}),
      });
      await history(req, String(ticket._id), 'CREATED', 'Ticket ouvert');
      await recordAudit({ organizationId: org(req), ...(req.user?.id ? { actorId: req.user.id } : {}), action: 'maintenance.create', resourceType: 'MaintenanceTicket', resourceId: String(ticket._id), requestId: req.requestId });
      await notify(config, {
        organizationId: org(req),
        event: 'MAINTENANCE_CREATED',
        variables: { tenantName: '', rentAmount: '', dueDate: '', propertyName: '', unitName: '', paymentLink: '' },
        idempotencyKey: `maintenance-created:${String(ticket._id)}`,
      });
      res.status(201);
      res.locals.data = ticket;
    },

    async list(req: Request, res: Response): Promise<void> {
      const query = req.query as unknown as Record<string, unknown> & { page: number; pageSize: number; order: 'asc' | 'desc'; sort?: string };
      const filter: Record<string, unknown> = { ...active(org(req)) };
      for (const key of ['status', 'priority', 'propertyId', 'unitId'] as const) {
        if (query[key]) filter[key] = query[key];
      }
      if (req.organizationContext!.role === 'TENANT') {
        const tenant = await Tenant.findOne({ organizationId: org(req), userId: req.user!.id });
        filter.tenantId = tenant?._id ?? null;
      }
      const page = await paginate(MaintenanceTicket, filter, query, 'maintenance');
      res.locals.data = page.items;
      res.locals.meta = page.meta;
    },

    async update(req: Request, res: Response): Promise<void> {
      if (req.organizationContext!.role === 'TENANT') {
        throw new AppError('FORBIDDEN', 'Un locataire ne peut pas modifier un ticket.', 403);
      }
      const ticket = await MaintenanceTicket.findOne({ _id: req.params.id, ...active(org(req)) });
      if (!ticket) throw notFound('Ticket');

      if (req.body.vendorId) {
        const vendor = await Vendor.findOne({ _id: req.body.vendorId, ...active(org(req)) });
        if (!vendor) throw notFound('Fournisseur');
        if (!req.body.status) req.body.status = 'ASSIGNED';
      }
      if (req.body.status === 'RESOLVED' && !req.body.completedAt) req.body.completedAt = new Date();

      Object.assign(ticket, req.body);
      await ticket.save();

      // Relier les dépenses de maintenance au module financier
      if ((ticket.status === 'RESOLVED' || req.body.validateExpense) && ticket.actualCostMinor && ticket.actualCostMinor > 0) {
        const vendor = ticket.vendorId ? await Vendor.findById(ticket.vendorId) : null;
        const existingTx = await Transaction.findOne({
          organizationId: org(req),
          label: `Maintenance : ${ticket.title}`,
          amountMinor: ticket.actualCostMinor,
          deletedAt: null,
        });
        if (!existingTx) {
          await Transaction.create({
            organizationId: org(req),
            direction: 'EXPENSE',
            category: 'MAINTENANCE',
            amountMinor: ticket.actualCostMinor,
            currency: ticket.currency || 'XOF',
            date: new Date(),
            label: `Maintenance : ${ticket.title}`,
            note: `Intervention clôturée - Réf #${String(ticket._id).slice(-6)}`,
            propertyId: ticket.propertyId,
            unitId: ticket.unitId,
            vendorId: ticket.vendorId,
            payee: vendor?.name || 'Prestataire maintenance',
            status: 'PAID',
          });
        }
      }

      await history(req, String(ticket._id), 'UPDATED', `Statut : ${ticket.status}`);
      await notify(config, {
        organizationId: org(req),
        event: 'MAINTENANCE_UPDATED',
        ...(ticket.tenantId ? {} : {}),
        variables: { tenantName: '', rentAmount: '', dueDate: '', propertyName: '', unitName: '', paymentLink: '' },
        idempotencyKey: `maintenance-updated:${String(ticket._id)}:${ticket.status}:${ticket.updatedAt.toISOString()}`,
      });
      res.locals.data = ticket;
    },

    async history(req: Request, res: Response): Promise<void> {
      const ticket = await MaintenanceTicket.findOne({ _id: req.params.id, ...active(org(req)) });
      if (!ticket) throw notFound('Ticket');
      res.locals.data = await MaintenanceEvent.find({ ticketId: ticket._id }).sort({ createdAt: 1 });
    },

    async stats(req: Request, res: Response): Promise<void> {
      const base = active(org(req));
      const open = await MaintenanceTicket.countDocuments({ ...base, status: { $nin: ['RESOLVED', 'CLOSED'] } });
      const urgent = await MaintenanceTicket.countDocuments({ ...base, priority: 'URGENT', status: { $nin: ['RESOLVED', 'CLOSED'] } });
      const [cost] = await MaintenanceTicket.aggregate<{ total: number }>([
        { $match: { organizationId: new Types.ObjectId(org(req)), deletedAt: null } },
        { $group: { _id: null, total: { $sum: '$actualCostMinor' } } },
      ]);
      const resolved = await MaintenanceTicket.find({ ...base, completedAt: { $ne: null } }).select('createdAt completedAt');
      const averageResolutionDays = resolved.length === 0
        ? 0
        : Math.round(
            (resolved.reduce((sum, ticket) => sum + (new Date(ticket.completedAt as Date).getTime() - new Date(ticket.createdAt).getTime()), 0) /
              resolved.length /
              (24 * 60 * 60 * 1000)) * 10,
          ) / 10;
      res.locals.data = { open, urgent, costMinor: cost?.total ?? 0, averageResolutionDays };
    },
  };
}

export async function createVendor(req: Request, res: Response): Promise<void> {
  const vendor = await Vendor.create({ ...req.body, organizationId: org(req) });
  res.status(201);
  res.locals.data = vendor;
}

export async function listVendors(req: Request, res: Response): Promise<void> {
  res.locals.data = await Vendor.find(active(org(req))).sort({ name: 1 });
}

export async function updateVendor(req: Request, res: Response): Promise<void> {
  const vendor = await Vendor.findOneAndUpdate(
    { _id: req.params.id, ...active(org(req)) },
    req.body,
    { new: true },
  );
  if (!vendor) throw notFound('Fournisseur');
  res.locals.data = vendor;
}

export async function deleteVendor(req: Request, res: Response): Promise<void> {
  const vendor = await Vendor.findOneAndUpdate(
    { _id: req.params.id, ...active(org(req)) },
    { deletedAt: new Date() },
    { new: true },
  );
  if (!vendor) throw notFound('Fournisseur');
  res.locals.data = { id: String(vendor._id), deleted: true };
}

export async function createTask(req: Request, res: Response): Promise<void> {
  const ticket = await MaintenanceTicket.findOne({ _id: req.body.ticketId, ...active(org(req)) });
  if (!ticket) throw notFound('Ticket');
  const task = await MaintenanceTask.create({ ...req.body, organizationId: org(req) });
  res.status(201);
  res.locals.data = task;
}
