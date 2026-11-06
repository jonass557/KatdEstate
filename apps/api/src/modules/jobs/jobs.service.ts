import type { AppConfig } from '../../config/index.js';
import { computePenalty } from '../../common/schedule.js';
import { Lease, Tenant } from '../../models/lease.js';
import { Property, Unit } from '../../models/property.js';
import { User } from '../../models/identity.js';
import { RentSchedule } from '../../models/finance.js';
import { Job, UtilityMeter, UtilityReading } from '../../models/operations.js';
import { notify } from '../notifications/notifications.service.js';

const DAY = 24 * 60 * 60 * 1000;

/**
 * Travaux récurrents.
 *
 * Chaque exécution est idempotente : les notifications portent une clé dérivée
 * du fait déclencheur, et les transitions de statut ne s'appliquent qu'à l'état
 * attendu. Relancer le travail ne double donc rien.
 */
export async function runAutomations(config: AppConfig, now: Date = new Date()): Promise<void> {
  await flagOverdue(config, now);
  await flagExpiringLeases(config, now);
  await sendDueReminders(config, now);
  await flagMissingReadings(config, now);
}

async function flagOverdue(config: AppConfig, now: Date): Promise<void> {
  const overdue = await RentSchedule.find({
    status: { $in: ['PENDING', 'PARTIAL'] },
    dueDate: { $lt: now },
  });
  for (const schedule of overdue) {
    const lease = await Lease.findById(schedule.leaseId);
    if (!lease) continue;

    const grace = (lease.penalty?.graceDays ?? 0) * DAY;
    if (now.getTime() - schedule.dueDate.getTime() >= grace && schedule.penaltyMinor === 0) {
      schedule.penaltyMinor = computePenalty(
        schedule.amountDueMinor,
        lease.penalty ?? { type: 'NONE', value: 0 },
      );
    }
    schedule.status = 'OVERDUE';
    await schedule.save();

    const tenant = schedule.tenantId ? await Tenant.findById(schedule.tenantId) : null;
    const unit = schedule.unitId ? await Unit.findById(schedule.unitId) : null;
    const property = schedule.propertyId ? await Property.findById(schedule.propertyId) : null;
    const ownerUser = lease?.ownerId
      ? await User.findById(lease.ownerId)
      : await User.findOne({
          organizationId: schedule.organizationId,
          role: { $in: ['OWNER', 'SUPER_ADMIN'] },
        });

    const tenantName = tenant?.fullName ?? 'Locataire';
    const rentAmount = `${schedule.amountDueMinor.toLocaleString('fr-FR')} ${schedule.currency || 'XOF'}`;
    const dueDateStr = schedule.dueDate.toLocaleDateString('fr-FR');
    const propertyName = property?.name ?? 'Propriété KatdEstate';
    const unitName = unit
      ? `${unit.name} (${unit.number ? 'Porte ' + unit.number : unit.type})`
      : 'Logement';

    // Notification au Propriétaire (Loyer en retard)
    const ownerEmail = ownerUser?.email ?? 'proprietaire@katdestate.immo';
    await notify(config, {
      organizationId: String(schedule.organizationId),
      event: 'RENT_OVERDUE',
      recipientAddress: ownerEmail,
      recipientUserId: ownerUser?._id ? String(ownerUser._id) : undefined,
      channels: ['EMAIL', 'IN_APP'],
      variables: {
        tenantName,
        rentAmount,
        dueDate: dueDateStr,
        propertyName,
        unitName,
        paymentLink: `${config.client.primaryOrigin}/finance/rents`,
      },
      idempotencyKey: `rent-overdue-owner:${String(schedule._id)}`,
    });

    // Notification au Locataire
    if (tenant?.email) {
      await notify(config, {
        organizationId: String(schedule.organizationId),
        event: 'RENT_OVERDUE',
        recipientAddress: tenant.email,
        recipientUserId: tenant.userId ? String(tenant.userId) : undefined,
        channels: ['EMAIL', 'IN_APP'],
        variables: {
          tenantName,
          rentAmount,
          dueDate: dueDateStr,
          propertyName,
          unitName,
          paymentLink: `${config.client.primaryOrigin}/portal/rent`,
        },
        idempotencyKey: `rent-overdue-tenant:${String(schedule._id)}`,
      });
    }
  }
}

async function sendDueReminders(config: AppConfig, now: Date): Promise<void> {
  const upcoming = await RentSchedule.find({
    status: 'PENDING',
    dueDate: { $gte: new Date(now.getTime() - DAY), $lte: new Date(now.getTime() + 5 * DAY) },
  });
  for (const schedule of upcoming) {
    const daysBefore = Math.ceil((schedule.dueDate.getTime() - now.getTime()) / DAY);
    const threshold = daysBefore <= 0 ? 'due-day' : 'due-soon';
    const lease = await Lease.findById(schedule.leaseId);
    const tenant = schedule.tenantId ? await Tenant.findById(schedule.tenantId) : null;
    const unit = schedule.unitId ? await Unit.findById(schedule.unitId) : null;
    const property = schedule.propertyId ? await Property.findById(schedule.propertyId) : null;
    const ownerUser = lease?.ownerId
      ? await User.findById(lease.ownerId)
      : await User.findOne({
          organizationId: schedule.organizationId,
          role: { $in: ['OWNER', 'SUPER_ADMIN'] },
        });

    const tenantName = tenant?.fullName ?? 'Locataire';
    const rentAmount = `${schedule.amountDueMinor.toLocaleString('fr-FR')} ${schedule.currency || 'XOF'}`;
    const dueDateStr = schedule.dueDate.toLocaleDateString('fr-FR');
    const propertyName = property?.name ?? 'Propriété KatdEstate';
    const unitName = unit
      ? `${unit.name} (${unit.number ? 'Porte ' + unit.number : unit.type})`
      : 'Logement';

    // 1. Notification au Locataire
    if (tenant?.email) {
      await notify(config, {
        organizationId: String(schedule.organizationId),
        event: 'RENT_DUE_SOON',
        recipientAddress: tenant.email,
        recipientUserId: tenant.userId ? String(tenant.userId) : undefined,
        channels: ['EMAIL', 'IN_APP'],
        variables: {
          tenantName,
          rentAmount,
          dueDate: dueDateStr,
          propertyName,
          unitName,
          paymentLink: `${config.client.primaryOrigin}/portal/rent`,
        },
        idempotencyKey: `rent-reminder-tenant:${String(schedule._id)}:${threshold}`,
      });
    }

    // 2. Notification au Propriétaire (Bailleur)
    const ownerEmail = ownerUser?.email ?? 'proprietaire@katdestate.immo';
    await notify(config, {
      organizationId: String(schedule.organizationId),
      event: 'RENT_DUE_SOON',
      recipientAddress: ownerEmail,
      recipientUserId: ownerUser?._id ? String(ownerUser._id) : undefined,
      channels: ['EMAIL', 'IN_APP'],
      variables: {
        tenantName,
        rentAmount,
        dueDate: dueDateStr,
        propertyName,
        unitName,
        paymentLink: `${config.client.primaryOrigin}/finance/rents`,
      },
      idempotencyKey: `rent-reminder-owner:${String(schedule._id)}:${threshold}`,
    });
  }
}

async function flagExpiringLeases(config: AppConfig, now: Date): Promise<void> {
  const leases = await Lease.find({ status: { $in: ['ACTIVE', 'EXPIRING'] }, deletedAt: null });
  for (const lease of leases) {
    const daysLeft = Math.ceil((lease.endDate.getTime() - now.getTime()) / DAY);
    if (daysLeft < 0 && lease.status !== 'EXPIRED') {
      lease.status = 'EXPIRED';
      await lease.save();
    } else if (daysLeft <= 60 && lease.status === 'ACTIVE') {
      lease.status = 'EXPIRING';
      await lease.save();
    }

    const tenant = lease.tenantId ? await Tenant.findById(lease.tenantId) : null;
    const unit = lease.unitId ? await Unit.findById(lease.unitId) : null;
    const property = lease.propertyId ? await Property.findById(lease.propertyId) : null;
    const ownerUser = lease?.ownerId
      ? await User.findById(lease.ownerId)
      : await User.findOne({
          organizationId: lease.organizationId,
          role: { $in: ['OWNER', 'SUPER_ADMIN'] },
        });

    const tenantName = tenant?.fullName ?? 'Locataire';
    const rentAmount = `${lease.rentAmountMinor.toLocaleString('fr-FR')} ${lease.currency || 'XOF'}`;
    const dueDateStr = lease.endDate.toLocaleDateString('fr-FR');
    const propertyName = property?.name ?? 'Propriété KatdEstate';
    const unitName = unit
      ? `${unit.name} (${unit.number ? 'Porte ' + unit.number : unit.type})`
      : 'Logement';

    for (const threshold of [60, 30, 7] as const) {
      if (daysLeft <= threshold && daysLeft > threshold - 1) {
        // Notification au Propriétaire
        const ownerEmail = ownerUser?.email ?? 'proprietaire@katdestate.immo';
        await notify(config, {
          organizationId: String(lease.organizationId),
          event: 'LEASE_EXPIRING',
          recipientAddress: ownerEmail,
          recipientUserId: ownerUser?._id ? String(ownerUser._id) : undefined,
          channels: ['EMAIL', 'IN_APP'],
          variables: {
            tenantName,
            rentAmount,
            dueDate: dueDateStr,
            propertyName,
            unitName,
            paymentLink: `${config.client.primaryOrigin}/leases`,
          },
          idempotencyKey: `lease-expiry-owner:${String(lease._id)}:${threshold}:${lease.endDate.getUTCFullYear()}`,
        });

        // Notification au Locataire
        if (tenant?.email) {
          await notify(config, {
            organizationId: String(lease.organizationId),
            event: 'LEASE_EXPIRING',
            recipientAddress: tenant.email,
            recipientUserId: tenant.userId ? String(tenant.userId) : undefined,
            channels: ['EMAIL', 'IN_APP'],
            variables: {
              tenantName,
              rentAmount,
              dueDate: dueDateStr,
              propertyName,
              unitName,
              paymentLink: `${config.client.primaryOrigin}/portal`,
            },
            idempotencyKey: `lease-expiry-tenant:${String(lease._id)}:${threshold}:${lease.endDate.getUTCFullYear()}`,
          });
        }
      }
    }
  }
}

/** Signale les compteurs sans relevé depuis plus de 35 jours. */
async function flagMissingReadings(config: AppConfig, now: Date): Promise<void> {
  const meters = await UtilityMeter.find({ deletedAt: null });
  for (const meter of meters) {
    const latest = await UtilityReading.findOne({ meterId: meter._id }).sort({ readAt: -1 });
    const stale = !latest || now.getTime() - latest.readAt.getTime() > 35 * DAY;
    if (!stale) continue;
    await notify(config, {
      organizationId: String(meter.organizationId),
      event: 'DOCUMENT_EXPIRING',
      variables: {
        tenantName: '',
        rentAmount: '',
        dueDate: '',
        propertyName: '',
        unitName: meter.label,
        paymentLink: '',
      },
      idempotencyKey: `meter-missing:${String(meter._id)}:${now.getUTCFullYear()}-${now.getUTCMonth()}`,
    });
  }
}

/** Planifie les automations quotidiennes. La clé d'idempotence empêche les doublons. */
export async function scheduleDailyAutomations(now: Date = new Date()): Promise<void> {
  const day = now.toISOString().slice(0, 10);
  await Job.updateOne(
    { idempotencyKey: `automations:${day}` },
    { $setOnInsert: { type: 'AUTOMATIONS', runAt: now, idempotencyKey: `automations:${day}` } },
    { upsert: true },
  );
}

/**
 * Worker de la file.
 *
 * Le verrou `lockedUntil` garantit qu'une seule instance traite un travail. S'il
 * expire (crash), le travail redevient disponible et sera repris.
 */
export async function processJobs(config: AppConfig, now: Date = new Date()): Promise<number> {
  let processed = 0;
  for (;;) {
    const job = await Job.findOneAndUpdate(
      {
        finishedAt: { $exists: false },
        runAt: { $lte: now },
        $or: [{ lockedUntil: { $exists: false } }, { lockedUntil: { $lte: now } }],
      },
      { lockedUntil: new Date(now.getTime() + 5 * 60 * 1000), $inc: { attempts: 1 } },
      { new: true },
    );
    if (!job) break;

    try {
      if (job.type === 'AUTOMATIONS') await runAutomations(config, now);
      job.finishedAt = new Date();
      await job.save();
      processed += 1;
    } catch (error) {
      job.lastError = error instanceof Error ? error.message.slice(0, 500) : 'Erreur inconnue';
      await Job.updateOne(
        { _id: job._id },
        { $unset: { lockedUntil: 1 }, lastError: job.lastError },
      );
      break;
    }
  }
  return processed;
}
