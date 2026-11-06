import type { Request, Response } from 'express';
import { recordAudit } from '../../common/audit.js';
import { AppError } from '../../common/errors.js';
import { notFound } from '../../common/pagination.js';
import { renderPdf } from '../../common/pdf.js';
import { Lease, Tenant } from '../../models/lease.js';
import { Invoice, Payment, Receipt, RentSchedule } from '../../models/finance.js';
import { MaintenanceTicket } from '../../models/operations.js';
import { Unit } from '../../models/property.js';
import { StoredFile } from '../files/files.service.js';

/**
 * Espace locataire.
 *
 * Chaque lecture part du dossier lié à l'utilisateur connecté, puis filtre par
 * cet identifiant. Connaître l'identifiant d'une ressource d'un autre locataire
 * ne suffit donc pas : la requête ne la trouve pas.
 */

function org(req: Request): string {
  return req.organizationContext!.organizationId;
}

async function ownTenant(req: Request) {
  const tenant = await Tenant.findOne({
    organizationId: org(req),
    userId: req.user?.id,
    deletedAt: null,
  });
  if (!tenant)
    throw new AppError('NOT_FOUND', 'Aucun dossier locataire n’est lié à ce compte.', 404);
  return tenant;
}

const PROFILE_FIELDS = [
  'phone',
  'email',
  'address',
  'emergencyContactName',
  'emergencyContactPhone',
] as const;

export async function dashboard(req: Request, res: Response): Promise<void> {
  const tenant = await ownTenant(req);
  const lease = await Lease.findOne({
    organizationId: org(req),
    tenantId: tenant._id,
    status: { $in: ['ACTIVE', 'EXPIRING'] },
    deletedAt: null,
  }).sort({ startDate: -1 });
  const unit = lease
    ? await Unit.findOne({ _id: lease.unitId, organizationId: org(req), deletedAt: null })
    : null;
  const nextRent = lease
    ? await RentSchedule.findOne({
        organizationId: org(req),
        tenantId: tenant._id,
        leaseId: lease._id,
        status: { $in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
      }).sort({ dueDate: 1 })
    : null;
  const openTickets = await MaintenanceTicket.countDocuments({
    organizationId: org(req),
    tenantId: tenant._id,
    status: { $nin: ['RESOLVED', 'CLOSED'] },
    deletedAt: null,
  });

  res.locals.data = {
    tenant: { id: tenant._id, fullName: tenant.fullName },
    unit: unit ? { id: unit._id, name: unit.name, type: unit.type, status: unit.status } : null,
    lease: lease
      ? {
          id: lease._id,
          number: lease.number,
          status: lease.status,
          startDate: lease.startDate,
          endDate: lease.endDate,
          rentAmountMinor: lease.rentAmountMinor,
          currency: lease.currency,
        }
      : null,
    nextRent: nextRent
      ? {
          id: nextRent._id,
          dueDate: nextRent.dueDate,
          amountDueMinor: nextRent.amountDueMinor,
          amountPaidMinor: nextRent.amountPaidMinor,
          status: nextRent.status,
          currency: nextRent.currency,
        }
      : null,
    documents: tenant.documents.length,
    openTickets,
  };
}

export async function rents(req: Request, res: Response): Promise<void> {
  const tenant = await ownTenant(req);
  res.locals.data = await RentSchedule.find({ organizationId: org(req), tenantId: tenant._id })
    .sort({ dueDate: -1 })
    .limit(120);
}

export async function payments(req: Request, res: Response): Promise<void> {
  const tenant = await ownTenant(req);
  res.locals.data = await Payment.find({ organizationId: org(req), tenantId: tenant._id })
    .sort({ paidAt: -1 })
    .limit(120);
}

export async function receipts(req: Request, res: Response): Promise<void> {
  const tenant = await ownTenant(req);
  res.locals.data = await Receipt.find({ organizationId: org(req), tenantId: tenant._id })
    .sort({ createdAt: -1 })
    .limit(120);
}

export async function invoices(req: Request, res: Response): Promise<void> {
  const tenant = await ownTenant(req);
  res.locals.data = await Invoice.find({ organizationId: org(req), tenantId: tenant._id })
    .sort({ dueDate: -1 })
    .limit(120);
}

export async function invoicePdf(req: Request, res: Response): Promise<void> {
  const tenant = await ownTenant(req);
  const invoice = await Invoice.findOne({
    _id: req.params.id,
    organizationId: org(req),
    tenantId: tenant._id,
  });
  if (!invoice) throw notFound('Facture');
  const pdf = await renderPdf({
    title: `Facture ${invoice.number}`,
    organizationName: 'DOMORA',
    sections: [
      {
        lines: [
          `Locataire : ${tenant.fullName}`,
          `Montant total : ${invoice.amountTotalMinor} ${invoice.currency}`,
          `Échéance : ${invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : '—'}`,
          `Statut : ${invoice.status}`,
        ],
      },
    ],
    footer: 'Facture générée par DOMORA.',
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.send(pdf);
}

export async function receiptPdf(req: Request, res: Response): Promise<void> {
  const tenant = await ownTenant(req);
  const receipt = await Receipt.findOne({
    _id: req.params.id,
    organizationId: org(req),
    tenantId: tenant._id,
  });
  if (!receipt) throw notFound('Quittance');
  const pdf = await renderPdf({
    title: `Quittance ${receipt.number}`,
    organizationName: 'RentFlow',
    sections: [
      {
        lines: [
          `Locataire : ${tenant.fullName}`,
          `Montant : ${receipt.amountMinor} ${receipt.currency}`,
          `Émise le : ${receipt.createdAt.toISOString().slice(0, 10)}`,
        ],
      },
    ],
    footer: 'Quittance générée par RentFlow.',
  });
  await recordAudit({
    organizationId: org(req),
    actorId: req.user!.id,
    action: 'receipt.download',
    resourceType: 'Receipt',
    resourceId: String(receipt._id),
    requestId: req.requestId,
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.send(pdf);
}

export async function lease(req: Request, res: Response): Promise<void> {
  const tenant = await ownTenant(req);
  const current = await Lease.find({
    organizationId: org(req),
    tenantId: tenant._id,
    deletedAt: null,
  }).sort({ startDate: -1 });
  res.locals.data = current;
}

export async function leasePdf(req: Request, res: Response): Promise<void> {
  const tenant = await ownTenant(req);
  const current = await Lease.findOne({
    _id: req.params.id,
    organizationId: org(req),
    tenantId: tenant._id,
    deletedAt: null,
  });
  if (!current) throw notFound('Contrat');
  const pdf = await renderPdf({
    title: `Contrat ${current.number}`,
    organizationName: 'RentFlow',
    sections: [
      {
        lines: [
          `Locataire : ${tenant.fullName}`,
          `Du ${current.startDate.toISOString().slice(0, 10)} au ${current.endDate.toISOString().slice(0, 10)}`,
          `Loyer : ${current.rentAmountMinor} ${current.currency}`,
          `Statut : ${current.status}`,
        ],
      },
    ],
    footer: 'Contrat généré par RentFlow.',
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.send(pdf);
}

export async function documents(req: Request, res: Response): Promise<void> {
  const tenant = await ownTenant(req);
  const ids = tenant.documents.map((document) => document.fileId);
  res.locals.data = await StoredFile.find({ _id: { $in: ids }, organizationId: org(req) }).select(
    'originalName mimeType size createdAt',
  );
}

export async function profile(req: Request, res: Response): Promise<void> {
  const tenant = await ownTenant(req);
  res.locals.data = {
    fullName: tenant.fullName,
    phone: tenant.phone,
    email: tenant.email,
    address: tenant.address,
    emergencyContactName: tenant.emergencyContactName,
    emergencyContactPhone: tenant.emergencyContactPhone,
  };
}

/** Le locataire ne modifie que ses coordonnées. Le loyer, le statut et la pièce restent intouchables. */
export async function updateProfile(req: Request, res: Response): Promise<void> {
  const tenant = await ownTenant(req);
  const patch: Record<string, unknown> = {};
  for (const field of PROFILE_FIELDS) {
    if (req.body[field] !== undefined) patch[field] = req.body[field];
  }
  const updated = await Tenant.findOneAndUpdate(
    { _id: tenant._id, organizationId: org(req) },
    patch,
    { new: true },
  );
  await recordAudit({
    organizationId: org(req),
    actorId: req.user!.id,
    action: 'tenant.profile.update',
    resourceType: 'Tenant',
    resourceId: String(tenant._id),
    requestId: req.requestId,
  });
  res.locals.data = {
    fullName: updated?.fullName,
    phone: updated?.phone,
    email: updated?.email,
    address: updated?.address,
    emergencyContactName: updated?.emergencyContactName,
    emergencyContactPhone: updated?.emergencyContactPhone,
  };
}
