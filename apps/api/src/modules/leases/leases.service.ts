import type { Request, Response } from 'express';
import type { AppConfig } from '../../config/index.js';
import { recordAudit } from '../../common/audit.js';
import { decryptString, encryptString, maskSecret } from '../../common/crypto.js';
import { AppError } from '../../common/errors.js';
import { escapeRegex, notFound, paginate } from '../../common/pagination.js';
import { renderPdf } from '../../common/pdf.js';
import { buildSchedule } from '../../common/schedule.js';
import { nextNumber } from '../../common/sequence.js';
import { Lease, Tenant } from '../../models/lease.js';
import { Membership, Organization, User } from '../../models/identity.js';
import { hashPassword } from '../../common/password.js';
import { Unit } from '../../models/property.js';
import { Payment, RentSchedule } from '../../models/finance.js';
import { MaintenanceTicket, Notification } from '../../models/operations.js';

function org(req: Request): string {
  return req.organizationContext!.organizationId;
}
const active = (organizationId: string) => ({ organizationId, deletedAt: null });

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

/** Le numéro de pièce ne sort en clair que pour qui détient la permission dédiée. */
function presentTenant(tenant: Record<string, unknown>, reveal: boolean, secret: string) {
  const encrypted = tenant.identityDocumentNumberEnc as string | undefined;
  const rest = { ...tenant };
  delete rest.identityDocumentNumberEnc;
  if (!encrypted) return rest;
  const plain = decryptString(encrypted, secret);
  return { ...rest, identityDocumentNumber: reveal ? plain : maskSecret(plain) };
}

export function createTenantHandlers(config: AppConfig) {
  const secret = config.tokens.accessSecret;

  return {
    async create(req: Request, res: Response): Promise<void> {
      const { identityDocumentNumber, email, firstName, lastName, loginPassword, ...rest } =
        req.body;
      const fullName =
        rest.fullName || [firstName, lastName].filter(Boolean).join(' ') || 'Locataire';
      const organizationId = org(req);
      let linkedUserId: unknown = undefined;

      if (email && String(email).trim()) {
        const emailNormalized = String(email).trim().toLowerCase();
        const plainPassword =
          loginPassword && String(loginPassword).trim()
            ? String(loginPassword).trim()
            : 'Locataire2026!';
        try {
          const passwordHash = await hashPassword(plainPassword, config.argon2);
          let user = await User.findOne({ emailNormalized });
          if (!user) {
            user = await User.create({
              email: emailNormalized,
              emailNormalized,
              displayName: fullName,
              passwordHash,
              status: 'ACTIVE',
            });
          } else {
            user.passwordHash = passwordHash;
            user.displayName = fullName;
            await user.save();
          }
          linkedUserId = user._id;
          const existingMembership = await Membership.findOne({
            userId: user._id,
            organizationId,
          });
          if (!existingMembership) {
            await Membership.create({
              userId: user._id,
              organizationId,
              role: 'TENANT',
              status: 'ACTIVE',
            });
          }
        } catch {
          // Ne pas bloquer la création de la fiche locataire si l'email existe déjà ailleurs
        }
      }

      const tenant = await Tenant.create({
        ...rest,
        fullName,
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
        ...(email ? { email } : {}),
        ...(linkedUserId ? { userId: linkedUserId } : {}),
        ...(identityDocumentNumber
          ? { identityDocumentNumberEnc: encryptString(identityDocumentNumber, secret) }
          : {}),
        organizationId,
      });
      await audit(req, 'tenant.create', 'Tenant', String(tenant._id));
      res.status(201);
      res.locals.data = presentTenant(tenant.toObject(), false, secret);
    },

    async list(req: Request, res: Response): Promise<void> {
      const query = req.query as unknown as {
        search?: string;
        status?: string;
        page: number;
        pageSize: number;
        order: 'asc' | 'desc';
        sort?: string;
      };
      const filter: Record<string, unknown> = { ...active(org(req)) };
      if (query.status) filter.status = query.status;
      if (query.search) {
        const regex = { $regex: escapeRegex(query.search), $options: 'i' };
        filter.$or = [
          { fullName: regex },
          { firstName: regex },
          { lastName: regex },
          { email: regex },
          { phone: regex },
        ];
      }
      const page = await paginate(Tenant, filter, query, 'tenant');
      res.locals.data = page.items;
      res.locals.meta = page.meta;
    },

    async timeline(req: Request, res: Response): Promise<void> {
      const tenant = await Tenant.findOne({ _id: req.params.id, ...active(org(req)) });
      if (!tenant) throw notFound('Locataire');

      const leases = await Lease.find({
        tenantId: tenant._id,
        organizationId: tenant.organizationId,
      });
      const leaseIds = leases.map((l) => l._id);
      const unitIds = leases.map((l) => l.unitId);

      const schedules = await RentSchedule.find({ leaseId: { $in: leaseIds } }).sort({
        dueDate: 1,
      });
      const scheduleIds = schedules.map((s) => s._id);

      const payments = await Payment.find({ rentScheduleId: { $in: scheduleIds } }).sort({
        paidAt: 1,
      });

      const tickets = await MaintenanceTicket.find({
        organizationId: tenant.organizationId,
        unitId: { $in: unitIds },
      }).sort({ createdAt: 1 });

      const notifications = await Notification.find({
        organizationId: tenant.organizationId,
        recipient: { $in: [tenant.email, tenant.phone].filter(Boolean) },
      }).sort({ createdAt: 1 });

      const events: Array<{ date: Date | string; label: string; kind: string }> = [
        {
          date: tenant.createdAt,
          label: 'Arrivée / Création de la fiche locataire',
          kind: 'ARRIVAL',
        },
      ];

      for (const lease of leases) {
        events.push({
          date: lease.createdAt,
          label: `Contrat ${lease.number} créé`,
          kind: 'LEASE',
        });
        if (lease.startDate) {
          events.push({
            date: lease.startDate,
            label: `Début du contrat ${lease.number}`,
            kind: 'LEASE',
          });
        }
        if (lease.status === 'TERMINATED' && lease.terminationDate) {
          events.push({
            date: lease.terminationDate,
            label: `Fin du contrat ${lease.number} (Résilié)`,
            kind: 'LEASE',
          });
        }
      }

      for (const schedule of schedules) {
        if (schedule.status === 'OVERDUE') {
          events.push({
            date: schedule.dueDate,
            label: `Retard : échéance du ${schedule.dueDate.toISOString().slice(0, 10)} non réglée`,
            kind: 'DELAY',
          });
        }
      }

      for (const payment of payments) {
        events.push({
          date: payment.paidAt,
          label: `Paiement : ${payment.amountMinor} (Réf: ${payment.reference ?? '—'})`,
          kind: 'PAYMENT',
        });
      }

      for (const ticket of tickets) {
        events.push({
          date: ticket.createdAt,
          label: `Maintenance : ${ticket.title} (${ticket.status})`,
          kind: 'MAINTENANCE',
        });
      }

      for (const notif of notifications) {
        events.push({
          date: notif.createdAt,
          label: `Communication : ${notif.title ?? notif.event}`,
          kind: 'COMMUNICATION',
        });
      }

      events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      res.locals.data = events;
    },

    async get(req: Request, res: Response): Promise<void> {
      const tenant = await Tenant.findOne({ _id: req.params.id, ...active(org(req)) }).select(
        '+identityDocumentNumberEnc',
      );
      if (!tenant) throw notFound('Locataire');
      const reveal = req.organizationContext!.permissions.includes('tenants.viewSensitive');
      res.locals.data = presentTenant(tenant.toObject(), reveal, secret);
    },

    async update(req: Request, res: Response): Promise<void> {
      const { identityDocumentNumber, ...rest } = req.body;
      const tenant = await Tenant.findOneAndUpdate(
        { _id: req.params.id, ...active(org(req)) },
        {
          ...rest,
          ...(identityDocumentNumber
            ? { identityDocumentNumberEnc: encryptString(identityDocumentNumber, secret) }
            : {}),
        },
        { new: true },
      );
      if (!tenant) throw notFound('Locataire');
      await audit(req, 'tenant.update', 'Tenant', String(tenant._id));
      res.locals.data = tenant;
    },

    async remove(req: Request, res: Response): Promise<void> {
      const tenant = await Tenant.findOneAndUpdate(
        { _id: req.params.id, ...active(org(req)) },
        { deletedAt: new Date() },
      );
      if (!tenant) throw notFound('Locataire');
      await audit(req, 'tenant.delete', 'Tenant', String(tenant._id));
      res.locals.data = { id: String(tenant._id), deleted: true };
    },
  };
}

async function currencyOf(organizationId: string): Promise<string> {
  const organization = await Organization.findById(organizationId).select('currency');
  return organization?.currency ?? 'XOF';
}

export async function createLease(req: Request, res: Response): Promise<void> {
  const tenant = await Tenant.findOne({ _id: req.body.tenantId, ...active(org(req)) });
  const unit = await Unit.findOne({ _id: req.body.unitId, ...active(org(req)) });
  if (!tenant) throw notFound('Locataire');
  if (!unit) throw notFound('Logement');
  if (req.body.endDate <= req.body.startDate) {
    throw new AppError('VALIDATION_ERROR', 'La date de fin doit suivre la date de début.', 422);
  }

  const lease = await Lease.create({
    ...req.body,
    organizationId: org(req),
    propertyId: unit.propertyId,
    currency: await currencyOf(org(req)),
    number: await nextNumber(org(req), 'BAIL'),
    status: 'DRAFT',
  });
  await audit(req, 'lease.create', 'Lease', String(lease._id));
  res.status(201);
  res.locals.data = lease;
}

export async function listLeases(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as Record<string, string | undefined> & {
    page: number;
    pageSize: number;
    order: 'asc' | 'desc';
    sort?: string;
  };
  const filter: Record<string, unknown> = { ...active(org(req)) };
  for (const key of ['status', 'tenantId', 'unitId', 'propertyId'] as const) {
    if (query[key]) filter[key] = query[key];
  }
  const page = await paginate(Lease, filter, query, 'lease');
  res.locals.data = page.items;
  res.locals.meta = page.meta;
}

export async function getLease(req: Request, res: Response): Promise<void> {
  const lease = await Lease.findOne({ _id: req.params.id, ...active(org(req)) });
  if (!lease) throw notFound('Contrat');
  res.locals.data = lease;
}

/**
 * Active un contrat et génère son échéancier.
 *
 * Une seule fois : l'index unique (contrat, date d'échéance) empêche tout doublon
 * si l'activation est rejouée.
 */
export async function activateLease(req: Request, res: Response): Promise<void> {
  const lease = await Lease.findOne({ _id: req.params.id, ...active(org(req)) });
  if (!lease) throw notFound('Contrat');
  if (lease.status !== 'DRAFT') {
    throw new AppError('CONFLICT', 'Seul un contrat en brouillon peut être activé.', 409);
  }

  const periods = buildSchedule(lease.startDate, lease.endDate, lease.dueDay, lease.frequency);
  if (periods.length === 0) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Aucune échéance ne tombe dans la période du contrat.',
      422,
    );
  }

  await RentSchedule.insertMany(
    periods.map((period) => ({
      organizationId: lease.organizationId,
      leaseId: lease._id,
      tenantId: lease.tenantId,
      unitId: lease.unitId,
      propertyId: lease.propertyId,
      periodStart: period.periodStart,
      dueDate: period.dueDate,
      amountDueMinor: lease.rentAmountMinor + lease.chargesAmountMinor,
      currency: lease.currency,
    })),
    { ordered: false },
  ).catch((error: { code?: number }) => {
    if (error.code !== 11000) throw error;
  });

  lease.status = 'ACTIVE';
  await lease.save();
  await Unit.updateOne({ _id: lease.unitId }, { status: 'OCCUPIED' });
  await audit(req, 'lease.activate', 'Lease', String(lease._id));
  res.locals.data = lease;
}

/** Renouvellement : nouveau contrat enchaîné, l'ancien est clos. */
export async function renewLease(req: Request, res: Response): Promise<void> {
  const lease = await Lease.findOne({
    _id: req.params.id,
    ...active(org(req)),
    status: { $in: ['ACTIVE', 'EXPIRING', 'EXPIRED'] },
  });
  if (!lease) throw notFound('Contrat');

  const renewed = await Lease.create({
    organizationId: org(req),
    number: await nextNumber(org(req), 'BAIL'),
    tenantId: lease.tenantId,
    unitId: lease.unitId,
    propertyId: lease.propertyId,
    currency: lease.currency,
    rentAmountMinor: req.body.rentAmountMinor ?? lease.rentAmountMinor,
    depositAmountMinor: lease.depositAmountMinor,
    chargesAmountMinor: lease.chargesAmountMinor,
    frequency: lease.frequency,
    dueDay: lease.dueDay,
    penalty: lease.penalty,
    startDate: req.body.startDate,
    endDate: req.body.endDate,
    renewedFromId: lease._id,
    status: 'DRAFT',
  });
  lease.status = 'TERMINATED';
  lease.terminationReason = 'Renouvelé';
  lease.terminationDate = new Date();
  await lease.save();
  await audit(req, 'lease.renew', 'Lease', String(renewed._id));
  res.status(201);
  res.locals.data = renewed;
}

export async function terminateLease(req: Request, res: Response): Promise<void> {
  const lease = await Lease.findOne({ _id: req.params.id, ...active(org(req)) });
  if (!lease) throw notFound('Contrat');
  if (lease.status === 'TERMINATED') throw new AppError('CONFLICT', 'Contrat déjà résilié.', 409);

  lease.status = 'TERMINATED';
  lease.terminationDate = req.body.terminationDate;
  lease.terminationReason = req.body.reason;
  await lease.save();

  await RentSchedule.updateMany(
    {
      leaseId: lease._id,
      status: { $in: ['PENDING', 'OVERDUE'] },
      dueDate: { $gt: req.body.terminationDate },
    },
    { status: 'CANCELLED', cancelledReason: 'Contrat résilié' },
  );
  const stillOccupied = await Lease.exists({
    unitId: lease.unitId,
    status: { $in: ['ACTIVE', 'EXPIRING'] },
    deletedAt: null,
  });
  if (!stillOccupied) await Unit.updateOne({ _id: lease.unitId }, { status: 'AVAILABLE' });

  await audit(req, 'lease.terminate', 'Lease', String(lease._id));
  res.locals.data = lease;
}

/** Prépare la signature sans l'exécuter : aucun fournisseur n'est appelé. */
export async function requestSignature(req: Request, res: Response): Promise<void> {
  const lease = await Lease.findOneAndUpdate(
    { _id: req.params.id, ...active(org(req)) },
    { 'signature.status': 'PENDING', 'signature.requestedAt': new Date() },
    { new: true },
  );
  if (!lease) throw notFound('Contrat');
  res.locals.data = {
    status: lease.signature?.status,
    note: 'Demande enregistrée. Aucun fournisseur de signature électronique n’est configuré : la signature n’a pas été envoyée.',
  };
}

/** Chronologie du contrat : signature, échéances, paiements, échéance finale. */
export async function leaseTimeline(req: Request, res: Response): Promise<void> {
  const lease = await Lease.findOne({ _id: req.params.id, ...active(org(req)) });
  if (!lease) throw notFound('Contrat');

  const schedules = await RentSchedule.find({ leaseId: lease._id }).sort({ dueDate: 1 });
  const payments = await Payment.find({
    rentScheduleId: { $in: schedules.map((item) => item._id) },
  }).sort({ paidAt: 1 });

  const events = [
    { date: lease.createdAt, label: 'Contrat créé', kind: 'LEASE' },
    ...(lease.status !== 'DRAFT'
      ? [{ date: lease.startDate, label: 'Contrat en vigueur', kind: 'LEASE' }]
      : []),
    ...schedules.map((schedule) => ({
      date: schedule.dueDate,
      label: `Échéance ${schedule.status}`,
      kind: 'SCHEDULE',
    })),
    ...payments.map((payment) => ({
      date: payment.paidAt,
      label: `Paiement ${payment.amountMinor}`,
      kind: 'PAYMENT',
    })),
    {
      date: lease.endDate,
      label: lease.status === 'TERMINATED' ? 'Contrat résilié' : 'Expiration prévue',
      kind: 'LEASE',
    },
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  res.locals.data = events;
}

export async function leasePdf(req: Request, res: Response): Promise<void> {
  const lease = await Lease.findOne({ _id: req.params.id, ...active(org(req)) });
  if (!lease) throw notFound('Contrat');
  const tenant = await Tenant.findById(lease.tenantId);
  const pdf = await renderPdf({
    title: `Contrat ${lease.number}`,
    organizationName: 'RentFlow',
    sections: [
      {
        lines: [
          `Locataire : ${tenant?.fullName ?? '—'}`,
          `Du ${lease.startDate.toISOString().slice(0, 10)} au ${lease.endDate.toISOString().slice(0, 10)}`,
          `Loyer : ${lease.rentAmountMinor} ${lease.currency}`,
          `Charges : ${lease.chargesAmountMinor} ${lease.currency}`,
          `Dépôt : ${lease.depositAmountMinor} ${lease.currency}`,
          `Statut : ${lease.status}`,
          ...(lease.terms ? [`Conditions : ${lease.terms}`] : []),
        ],
      },
    ],
    footer: 'Document généré par RentFlow. La signature électronique n’est pas encore active.',
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${lease.number}.pdf"`);
  res.send(pdf);
}
