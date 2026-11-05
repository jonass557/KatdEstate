import type { NotificationChannel, NotificationEvent } from '@rentflow/shared';
import type { Request, Response } from 'express';
import type { AppConfig } from '../../config/index.js';
import { AppError } from '../../common/errors.js';
import { paginate } from '../../common/pagination.js';
import { Notification, NotificationPreference, NotificationTemplate } from '../../models/operations.js';
import { providersFor } from './providers.js';

/** Templates par défaut. L'administrateur peut les remplacer par organisation. */
export const DEFAULT_TEMPLATES: Record<NotificationEvent, { subject: string; body: string }> = {
  RENT_DUE_SOON: {
    subject: 'Rappel : loyer à venir',
    body: 'Bonjour {{tenantName}}, votre loyer de {{rentAmount}} pour {{unitName}} arrive à échéance le {{dueDate}}.',
  },
  RENT_OVERDUE: {
    subject: 'Loyer en retard',
    body: 'Bonjour {{tenantName}}, le loyer de {{rentAmount}} dû le {{dueDate}} pour {{unitName}} n’a pas été reçu.',
  },
  PAYMENT_RECEIVED: {
    subject: 'Paiement reçu',
    body: 'Bonjour {{tenantName}}, nous avons reçu votre paiement de {{rentAmount}}. Merci.',
  },
  LEASE_EXPIRING: {
    subject: 'Contrat bientôt à échéance',
    body: 'Le contrat de {{tenantName}} pour {{unitName}} ({{propertyName}}) arrive à échéance le {{dueDate}}.',
  },
  MAINTENANCE_CREATED: {
    subject: 'Nouveau signalement',
    body: 'Un problème a été signalé pour {{unitName}} ({{propertyName}}).',
  },
  MAINTENANCE_UPDATED: {
    subject: 'Signalement mis à jour',
    body: 'Le signalement concernant {{unitName}} a été mis à jour.',
  },
  DOCUMENT_EXPIRING: {
    subject: 'Document bientôt expiré',
    body: 'Un document lié à {{tenantName}} arrive à expiration.',
  },
  PAYMENT_FAILED: {
    subject: 'Paiement non abouti',
    body: 'Le paiement de {{tenantName}} n’a pas abouti.',
  },
};

export function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (_match, name: string) => variables[name] ?? '');
}

export interface NotifyInput {
  organizationId: string;
  event: NotificationEvent;
  recipientUserId?: string;
  recipientAddress?: string;
  variables: Record<string, string>;
  /** Fait déclencheur : une même clé ne produit jamais deux envois. */
  idempotencyKey: string;
  channels?: readonly NotificationChannel[];
}

/**
 * Envoie une notification sur les canaux choisis, une seule fois par clé.
 *
 * L'idempotence est portée par l'index unique (organisation, clé, canal) : un
 * second appel avec la même clé est ignoré, même après un redémarrage.
 */
export async function notify(config: AppConfig, input: NotifyInput): Promise<void> {
  const providers = providersFor(config);
  const channels = input.channels ?? ['IN_APP'];

  for (const channel of channels) {
    const template = await NotificationTemplate.findOne({
      organizationId: input.organizationId,
      event: input.event,
      channel,
    });
    const base = DEFAULT_TEMPLATES[input.event];
    const subject = renderTemplate(template?.subject ?? base.subject, input.variables);
    const body = renderTemplate(template?.body ?? base.body, input.variables);

    const alreadySent = await Notification.exists({
      organizationId: input.organizationId,
      idempotencyKey: input.idempotencyKey,
      channel,
    });
    if (alreadySent) continue;

    const provider = providers[channel];
    const result = await provider.send({ to: input.recipientAddress ?? '', subject, body }).catch((error: unknown) => ({
      status: 'FAILED' as const,
      detail: error instanceof Error ? error.message : 'Échec d’envoi',
    }));

    await Notification.create({
      organizationId: input.organizationId,
      ...(input.recipientUserId ? { recipientUserId: input.recipientUserId } : {}),
      event: input.event,
      channel,
      subject,
      body,
      status: result.status,
      idempotencyKey: input.idempotencyKey,
    }).catch((error: { code?: number }) => {
      if (error.code !== 11000) throw error;
    });
  }
}

export async function listNotifications(req: Request, res: Response): Promise<void> {
  const page = await paginate(
    Notification,
    { recipientUserId: req.user!.id, organizationId: req.organizationContext!.organizationId },
    req.query as never,
    'notification',
  );
  res.locals.data = page.items;
  res.locals.meta = page.meta;
}

export async function markRead(req: Request, res: Response): Promise<void> {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipientUserId: req.user!.id },
    { readAt: new Date() },
    { new: true },
  );
  if (!notification) throw new AppError('NOT_FOUND', 'Notification introuvable.', 404);
  res.locals.data = notification;
}

export async function upsertTemplate(req: Request, res: Response): Promise<void> {
  const template = await NotificationTemplate.findOneAndUpdate(
    { organizationId: req.organizationContext!.organizationId, event: req.body.event, channel: req.body.channel },
    { subject: req.body.subject, body: req.body.body },
    { upsert: true, new: true },
  );
  res.locals.data = template;
}

export async function listTemplates(req: Request, res: Response): Promise<void> {
  res.locals.data = await NotificationTemplate.find({ organizationId: req.organizationContext!.organizationId });
}

export async function upsertPreference(req: Request, res: Response): Promise<void> {
  const preference = await NotificationPreference.findOneAndUpdate(
    { organizationId: req.organizationContext!.organizationId, userId: req.user!.id, event: req.body.event },
    { channels: req.body.channels },
    { upsert: true, new: true },
  );
  res.locals.data = preference;
}

export async function listPreferences(req: Request, res: Response): Promise<void> {
  res.locals.data = await NotificationPreference.find({
    organizationId: req.organizationContext!.organizationId,
    userId: req.user!.id,
  });
}

export function createTriggerReminders(config: AppConfig) {
  return async function triggerReminders(req: Request, res: Response): Promise<void> {
    const { runAutomations } = await import('../jobs/jobs.service.js');
    await runAutomations(config, new Date());
    const recent = await Notification.find({
      organizationId: req.organizationContext!.organizationId,
      createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) },
    })
      .sort({ createdAt: -1 })
      .limit(10);
    res.locals.data = {
      success: true,
      message: 'Vérification des échéances et alertes emails envoyées avec succès aux locataires et propriétaires.',
      dispatchedCount: recent.length,
      recentDispatched: recent,
    };
  };
}
