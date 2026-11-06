import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import type { AppConfig } from '../../config/index.js';
import { recordAudit } from '../../common/audit.js';
import { AppError } from '../../common/errors.js';
import { notFound, paginate } from '../../common/pagination.js';
import { nextNumber } from '../../common/sequence.js';
import { Organization } from '../../models/identity.js';
import { UtilityBill, UtilityMeter, UtilityReading } from '../../models/operations.js';
import { notify } from '../notifications/notifications.service.js';

function org(req: Request): string {
  return req.organizationContext!.organizationId;
}

/**
 * Lecture d'un compteur.
 *
 * L'OCR n'est pas implémenté : seul le relevé manuel existe. L'interface
 * `MeterOcrProvider` ci-dessous réserve le point d'extension sans fournisseur.
 */
export interface MeterOcrProvider {
  /** Aucune implémentation n'est fournie. */
  readonly available: false;
}

export const meterOcr: MeterOcrProvider = { available: false };

export function createUtilityHandlers(config: AppConfig) {
  return {
    async createMeter(req: Request, res: Response): Promise<void> {
      const meter = await UtilityMeter.create({ ...req.body, organizationId: org(req) });
      res.status(201);
      res.locals.data = meter;
    },

    async listMeters(req: Request, res: Response): Promise<void> {
      const query = req.query as unknown as Record<string, unknown> & {
        page: number;
        pageSize: number;
        order: 'asc' | 'desc';
        sort?: string;
      };
      const filter: Record<string, unknown> = { organizationId: org(req), deletedAt: null };
      if (query.type) filter.type = query.type;
      if (query.propertyId) filter.propertyId = query.propertyId;
      if (query.unitId) filter.unitId = query.unitId;
      const page = await paginate(UtilityMeter, filter, query, 'meter');
      res.locals.data = page.items;
      res.locals.meta = page.meta;
    },

    async updateMeter(req: Request, res: Response): Promise<void> {
      const meter = await UtilityMeter.findOneAndUpdate(
        { _id: req.params.id, organizationId: org(req), deletedAt: null },
        req.body,
        { new: true },
      );
      if (!meter) throw notFound('Compteur');
      res.locals.data = meter;
    },

    async recordReading(req: Request, res: Response): Promise<void> {
      const meter = await UtilityMeter.findOne({
        _id: req.body.meterId,
        organizationId: org(req),
        deletedAt: null,
      });
      if (!meter) throw notFound('Compteur');

      const consumption = req.body.currentIndex - req.body.previousIndex;
      const history = await UtilityReading.find({ meterId: meter._id }).select('consumption');
      const average =
        history.length === 0
          ? 0
          : history.reduce((sum, reading) => sum + reading.consumption, 0) / history.length;
      const abnormal = history.length >= 3 && consumption > average * meter.anomalyMultiplier;

      const reading = await UtilityReading.create({
        organizationId: org(req),
        meterId: meter._id,
        previousIndex: req.body.previousIndex,
        currentIndex: req.body.currentIndex,
        consumption,
        readAt: req.body.readAt,
        abnormal,
      });

      if (abnormal) {
        await notify(config, {
          organizationId: org(req),
          event: 'DOCUMENT_EXPIRING',
          variables: {
            tenantName: '',
            rentAmount: '',
            dueDate: '',
            propertyName: '',
            unitName: meter.label,
            paymentLink: '',
          },
          idempotencyKey: `meter-anomaly:${String(reading._id)}`,
        });
      }

      const organization = await Organization.findById(org(req)).select('currency');
      const amountMinor = Math.round(consumption * meter.unitPriceMinor);
      const bill = await UtilityBill.create({
        organizationId: org(req),
        meterId: meter._id,
        readingId: reading._id,
        number: await nextNumber(org(req), 'UTIL'),
        consumption,
        unitPriceMinor: meter.unitPriceMinor,
        amountMinor,
        currency: organization?.currency ?? 'XOF',
        dueDate: new Date(req.body.readAt.getTime() + 15 * 24 * 60 * 60 * 1000),
      });

      await recordAudit({
        organizationId: org(req),
        ...(req.user?.id ? { actorId: req.user.id } : {}),
        action: 'meter.read',
        resourceType: 'UtilityReading',
        resourceId: String(reading._id),
        requestId: req.requestId,
      });
      res.status(201);
      res.locals.data = { reading, bill, abnormal };
    },

    async readings(req: Request, res: Response): Promise<void> {
      const meter = await UtilityMeter.findOne({
        _id: req.params.id,
        organizationId: org(req),
        deletedAt: null,
      });
      if (!meter) throw notFound('Compteur');
      res.locals.data = await UtilityReading.find({ meterId: meter._id }).sort({ readAt: 1 });
    },

    /** Consommation mensuelle, pour le graphique. */
    async consumption(req: Request, res: Response): Promise<void> {
      const match: Record<string, unknown> = { organizationId: new Types.ObjectId(org(req)) };
      if (typeof req.query.meterId === 'string')
        match.meterId = new Types.ObjectId(req.query.meterId);
      const rows = await UtilityReading.aggregate<{ _id: string; total: number }>([
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$readAt' } },
            total: { $sum: '$consumption' },
          },
        },
        { $sort: { _id: 1 } },
      ]);
      res.locals.data = rows.map((row) => ({ month: row._id, consumption: row.total }));
    },
  };
}

export function rejectOcr(): AppError {
  return new AppError(
    'SERVICE_UNAVAILABLE',
    'La lecture automatique des compteurs (OCR) n’est pas disponible. Saisissez le relevé manuellement.',
    501,
  );
}
