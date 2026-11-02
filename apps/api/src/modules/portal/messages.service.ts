import type { Request, Response } from 'express';
import { notFound, paginate } from '../../common/pagination.js';
import { InternalMessage } from '../../models/operations.js';
import { Tenant } from '../../models/lease.js';

function org(req: Request): string {
  return req.organizationContext!.organizationId;
}

export async function listMessages(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as Record<string, unknown> & { page: number; pageSize: number; order: 'asc' | 'desc'; sort?: string };
  const filter: Record<string, unknown> = { organizationId: org(req), deletedAt: null };

  if (req.organizationContext!.role === 'TENANT') {
    // Le locataire ne voit que ses propres conversations
    filter.$or = [{ senderId: req.user?.id }, { recipientId: req.user?.id }];
  } else if (query.category) {
    filter.category = query.category;
  }

  const page = await paginate(InternalMessage, filter, query, 'messages');
  res.locals.data = page.items;
  res.locals.meta = page.meta;
}

export async function getMessage(req: Request, res: Response): Promise<void> {
  const filter: Record<string, unknown> = { _id: req.params.id, organizationId: org(req), deletedAt: null };
  if (req.organizationContext!.role === 'TENANT') {
    filter.$or = [{ senderId: req.user?.id }, { recipientId: req.user?.id }];
  }
  const message = await InternalMessage.findOne(filter);
  if (!message) throw notFound('Message');
  res.locals.data = message;
}

export async function sendMessage(req: Request, res: Response): Promise<void> {
  let recipientId = req.body.recipientId;

  // Si c'est un locataire qui écrit, le destinataire par défaut est l'équipe gestionnaire
  if (req.organizationContext!.role === 'TENANT' && !recipientId) {
    const tenant = await Tenant.findOne({ organizationId: org(req), userId: req.user?.id });
    if (tenant) {
      req.body.tenantId = tenant._id;
    }
  }

  const message = await InternalMessage.create({
    ...req.body,
    organizationId: org(req),
    senderId: req.user?.id,
    readBy: [req.user?.id],
  });

  res.status(201);
  res.locals.data = message;
}

export async function replyMessage(req: Request, res: Response): Promise<void> {
  const filter: Record<string, unknown> = { _id: req.params.id, organizationId: org(req), deletedAt: null };
  if (req.organizationContext!.role === 'TENANT') {
    filter.$or = [{ senderId: req.user?.id }, { recipientId: req.user?.id }];
  }

  const message = await InternalMessage.findOne(filter);
  if (!message) throw notFound('Message');

  message.replies.push({
    senderId: req.user!.id as never,
    body: req.body.body,
    createdAt: new Date(),
  });
  message.readBy = [req.user!.id as never];
  await message.save();

  res.locals.data = message;
}

export async function markRead(req: Request, res: Response): Promise<void> {
  const message = await InternalMessage.findOne({ _id: req.params.id, organizationId: org(req), deletedAt: null });
  if (!message) throw notFound('Message');

  if (!message.readBy.some((id) => String(id) === String(req.user?.id))) {
    message.readBy.push(req.user!.id as never);
    await message.save();
  }

  res.locals.data = { read: true };
}
