import type { Request, Response } from 'express';
import { HttpError } from '../../common/errors.js';
import { CommunityAnnouncement } from '../../models/quartier.js';
import { assertLeaderSectorAccess } from './geo.service.js';

export async function broadcastAnnouncement(req: Request, res: Response): Promise<void> {
  const authorId = req.user!.id;
  const authorRole = req.user!.role;
  const { scope, type, title, message, neighborhoodId, blockId, eventDate } = req.body;

  // Contrôle d'affectation
  await assertLeaderSectorAccess(authorId, authorRole, { neighborhoodId, blockId });

  const announcement = await CommunityAnnouncement.create({
    scope,
    type,
    title,
    message,
    neighborhoodId,
    blockId: scope === 'BLOCK' ? blockId : undefined,
    authorId,
    authorRole,
    eventDate: eventDate ? new Date(eventDate) : undefined,
  });

  res.locals.data = {
    announcement,
    message:
      type === 'URGENT_ALERT'
        ? 'Alerte urgente diffusée aux résidents !'
        : 'Annonce publiée avec succès.',
  };
}

export async function listAnnouncements(req: Request, res: Response): Promise<void> {
  const { neighborhoodId, blockId, type } = req.query;

  const filter: Record<string, unknown> = {};

  if (neighborhoodId) {
    if (blockId) {
      filter.$or = [
        { neighborhoodId, scope: 'NEIGHBORHOOD' },
        { blockId, scope: 'BLOCK' },
      ];
    } else {
      filter.neighborhoodId = neighborhoodId;
    }
  }

  if (type) {
    filter.type = type;
  }

  const announcements = await CommunityAnnouncement.find(filter)
    .sort({ createdAt: -1 })
    .populate('authorId', 'name role')
    .populate('neighborhoodId', 'name')
    .populate('blockId', 'name code')
    .lean();

  res.locals.data = announcements;
}
