import type { AppConfig } from '../../config/index.js';
import { computePenalty } from '../../common/schedule.js';
import { Lease } from '../../models/lease.js';
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
  const overdue = await RentSchedule.find({ status: { $in: ['PENDING', 'PARTIAL'] }, dueDate: { $lt: now } });
  for (const schedule of overdue) {
    const lease = await Lease.findById(schedule.leaseId);
    if (!lease) continue;

    const grace = (lease.penalty?.graceDays ?? 0) * DAY;
    if (now.getTime() - schedule.dueDate.getTime() >= grace && schedule.penaltyMinor === 0) {
      schedule.penaltyMinor = computePenalty(schedule.amountDueMinor, lease.penalty ?? { type: 'NONE', value: 0 });
    }
    schedule.status = 'OVERDUE';
    await schedule.save();

    const daysLate = Math.floor((now.getTime() - schedule.dueDate.getTime()) / DAY);
    if (daysLate >= 3) {
      await notify(config, {
        organizationId: String(schedule.organizationId),
        event: 'RENT_OVERDUE',
        variables: { tenantName: '', rentAmount: String(schedule.amountDueMinor), dueDate: schedule.dueDate.toISOString().slice(0, 10), propertyName: '', unitName: '', paymentLink: '' },
        idempotencyKey: `rent-overdue:${String(schedule._id)}`,
      });
    }
  }
}

async function sendDueReminders(config: AppConfig, now: Date): Promise<void> {
  const upcoming = await RentSchedule.find({
    status: 'PENDING',
    dueDate: { $gte: now, $lte: new Date(now.getTime() + 5 * DAY) },
  });
  for (const schedule of upcoming) {
    const daysBefore = Math.ceil((schedule.dueDate.getTime() - now.getTime()) / DAY);
    const threshold = daysBefore <= 0 ? 'due-day' : 'due-soon';
    await notify(config, {
      organizationId: String(schedule.organizationId),
      event: 'RENT_DUE_SOON',
      variables: { tenantName: '', rentAmount: String(schedule.amountDueMinor), dueDate: schedule.dueDate.toISOString().slice(0, 10), propertyName: '', unitName: '', paymentLink: '' },
      idempotencyKey: `rent-reminder:${String(schedule._id)}:${threshold}`,
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

    for (const threshold of [60, 30] as const) {
      if (daysLeft <= threshold && daysLeft > threshold - 1) {
        await notify(config, {
          organizationId: String(lease.organizationId),
          event: 'LEASE_EXPIRING',
          variables: { tenantName: '', rentAmount: String(lease.rentAmountMinor), dueDate: lease.endDate.toISOString().slice(0, 10), propertyName: '', unitName: '', paymentLink: '' },
          idempotencyKey: `lease-expiry:${String(lease._id)}:${threshold}:${lease.endDate.getUTCFullYear()}`,
        });
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
      variables: { tenantName: '', rentAmount: '', dueDate: '', propertyName: '', unitName: meter.label, paymentLink: '' },
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
      { finishedAt: { $exists: false }, runAt: { $lte: now }, $or: [{ lockedUntil: { $exists: false } }, { lockedUntil: { $lte: now } }] },
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
      await Job.updateOne({ _id: job._id }, { $unset: { lockedUntil: 1 }, lastError: job.lastError });
      break;
    }
  }
  return processed;
}
