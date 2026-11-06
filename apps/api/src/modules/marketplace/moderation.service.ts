import type { Request, Response } from 'express';
import { HttpError } from '../../common/errors.js';
import { Listing, AgentProfile, AgentPlan } from '../../models/marketplace.js';
import { ensureDefaultAgentPlans } from './marketplace.quota.js';

export async function listModerationListings(req: Request, res: Response): Promise<void> {
  const { status, category, transactionType, page = '1', limit = '20' } = req.query;

  const filter: Record<string, unknown> = { deletedAt: null };
  if (status && typeof status === 'string') {
    filter.status = status;
  }
  if (category && typeof category === 'string') {
    filter.category = category;
  }
  if (transactionType && typeof transactionType === 'string') {
    filter.transactionType = transactionType;
  }

  const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [items, total] = await Promise.all([
    Listing.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('publisherId', 'name email phone role')
      .populate('agentProfileId')
      .populate('propertyId', 'name address')
      .lean(),
    Listing.countDocuments(filter),
  ]);

  res.locals.data = {
    items,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    },
  };
}

export async function approveListing(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { comment } = req.body;

  const listing = await Listing.findById(id);
  if (!listing) {
    throw new HttpError(404, 'Annonce introuvable.');
  }

  listing.status = 'PUBLISHED';
  if (comment) listing.moderationComment = comment;
  await listing.save();

  res.locals.data = { listing, message: 'Annonce validée et publiée sur la marketplace.' };
}

export async function rejectListing(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    throw new HttpError(400, 'Le motif de rejet est obligatoire.');
  }

  const listing = await Listing.findById(id);
  if (!listing) {
    throw new HttpError(404, 'Annonce introuvable.');
  }

  listing.status = 'REJECTED';
  listing.moderationComment = reason.trim();
  await listing.save();

  res.locals.data = { listing, message: 'Annonce rejetée avec motif.' };
}

export async function suspendListing(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { reason } = req.body;

  const listing = await Listing.findById(id);
  if (!listing) {
    throw new HttpError(404, 'Annonce introuvable.');
  }

  listing.status = 'SUSPENDED';
  if (reason) listing.moderationComment = reason.trim();
  await listing.save();

  res.locals.data = { listing, message: 'Annonce suspendue.' };
}

export async function toggleListingVerified(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { isVerified } = req.body;

  const listing = await Listing.findById(id);
  if (!listing) {
    throw new HttpError(404, 'Annonce introuvable.');
  }

  listing.isVerified = Boolean(isVerified);
  await listing.save();

  res.locals.data = {
    listing,
    message: listing.isVerified ? 'Badge "Bien vérifié" activé.' : 'Badge "Bien vérifié" retiré.',
  };
}

// --- Modération des Agents ---

export async function listAgentProfiles(req: Request, res: Response): Promise<void> {
  const { verificationStatus } = req.query;

  const filter: Record<string, unknown> = {};
  if (verificationStatus && typeof verificationStatus === 'string') {
    filter.verificationStatus = verificationStatus;
  }

  const agents = await AgentProfile.find(filter)
    .sort({ createdAt: -1 })
    .populate('userId', 'name email phone role')
    .lean();

  res.locals.data = agents;
}

export async function verifyAgentProfile(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const profile = await AgentProfile.findById(id);
  if (!profile) {
    throw new HttpError(404, 'Profil agent introuvable.');
  }

  profile.verificationStatus = 'VERIFIED';
  profile.verifiedAt = new Date();
  profile.rejectionReason = undefined;
  await profile.save();

  res.locals.data = { profile, message: 'Profil agent vérifié avec succès.' };
}

export async function rejectAgentProfile(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    throw new HttpError(400, 'Le motif de rejet est obligatoire.');
  }

  const profile = await AgentProfile.findById(id);
  if (!profile) {
    throw new HttpError(404, 'Profil agent introuvable.');
  }

  profile.verificationStatus = 'REJECTED';
  profile.rejectionReason = reason.trim();
  await profile.save();

  res.locals.data = { profile, message: 'Vérification de l’agent rejetée.' };
}

// --- Gestion des Formules d'Abonnement Agent ---

export async function listAdminAgentPlans(req: Request, res: Response): Promise<void> {
  await ensureDefaultAgentPlans();
  const plans = await AgentPlan.find().sort({ priceMinor: 1 }).lean();
  res.locals.data = plans;
}

export async function updateAdminAgentPlan(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const plan = await AgentPlan.findByIdAndUpdate(id, { $set: req.body }, { new: true });

  if (!plan) {
    throw new HttpError(404, 'Formule d’abonnement introuvable.');
  }

  res.locals.data = { plan, message: 'Formule mise à jour avec succès.' };
}
