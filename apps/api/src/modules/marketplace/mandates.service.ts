import type { Request, Response } from 'express';
import { HttpError } from '../../common/errors.js';
import { Mandate, Listing, Offer, AgentProfile, Commission } from '../../models/marketplace.js';

// --- Mandats Immobiliers ---

export async function createMandate(req: Request, res: Response): Promise<void> {
  const ownerId = req.user!.id;
  const {
    agentId,
    propertyId,
    mandateType,
    commissionType = 'PERCENTAGE',
    commissionRate,
    startDate,
    endDate,
    authorizedRights = ['PUBLISH', 'NEGOTIATE', 'ORGANIZE_VIEWINGS'],
    terms,
  } = req.body;

  const agentProfile = await AgentProfile.findOne({ userId: agentId });

  const mandate = await Mandate.create({
    organizationId: req.params.organizationId,
    ownerId,
    agentId,
    agentProfileId: agentProfile?._id,
    propertyId,
    mandateType,
    commissionType,
    commissionRate,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    status: 'PENDING',
    authorizedRights,
    terms,
    history: [
      {
        action: 'MANDATE_CREATED',
        performedBy: ownerId,
        date: new Date(),
        note: `Mandat proposé par le propriétaire. Type: ${mandateType}, Commission: ${commissionRate}%`,
      },
    ],
  });

  res.locals.data = mandate;
}

export async function acceptMandate(req: Request, res: Response): Promise<void> {
  const agentId = req.user!.id;
  const { id } = req.params;

  const mandate = await Mandate.findOne({ _id: id, agentId });
  if (!mandate) {
    throw new HttpError(404, 'Mandat introuvable.');
  }

  if (mandate.status !== 'PENDING') {
    throw new HttpError(400, `Impossible d'accepter un mandat au statut "${mandate.status}".`);
  }

  mandate.status = 'ACTIVE';
  mandate.history.push({
    action: 'MANDATE_ACCEPTED',
    performedBy: agentId,
    date: new Date(),
    note: 'Mandat accepté par l’agent immobilier.',
  });

  await mandate.save();
  res.locals.data = mandate;
}

export async function rejectMandate(req: Request, res: Response): Promise<void> {
  const agentId = req.user!.id;
  const { id } = req.params;
  const { reason } = req.body;

  const mandate = await Mandate.findOne({ _id: id, agentId });
  if (!mandate) {
    throw new HttpError(404, 'Mandat introuvable.');
  }

  mandate.status = 'REJECTED';
  mandate.history.push({
    action: 'MANDATE_REJECTED',
    performedBy: agentId,
    date: new Date(),
    note: reason ? `Refusé : ${reason}` : 'Mandat refusé par l’agent immobilier.',
  });

  await mandate.save();
  res.locals.data = mandate;
}

export async function revokeMandate(req: Request, res: Response): Promise<void> {
  const ownerId = req.user!.id;
  const { id } = req.params;
  const { reason } = req.body;

  const mandate = await Mandate.findOne({ _id: id, ownerId });
  if (!mandate) {
    throw new HttpError(404, 'Mandat introuvable.');
  }

  mandate.status = 'REVOKED';
  mandate.history.push({
    action: 'MANDATE_REVOKED',
    performedBy: ownerId,
    date: new Date(),
    note: reason ? `Révocation : ${reason}` : 'Mandat révoqué par le propriétaire.',
  });
  await mandate.save();

  // Withdraw any active listings linked to this mandate immediately
  await Listing.updateMany(
    { mandateId: mandate._id, status: { $in: ['PUBLISHED', 'PENDING_REVIEW'] } },
    { $set: { status: 'WITHDRAWN', moderationComment: 'Retiré suite à la révocation du mandat.' } },
  );

  res.locals.data = {
    mandate,
    message:
      'Le mandat a été révoqué. Les droits et annonces associées ont été immédiatement suspendus.',
  };
}

export async function listOwnerMandates(req: Request, res: Response): Promise<void> {
  const ownerId = req.user!.id;
  const mandates = await Mandate.find({ ownerId })
    .sort({ createdAt: -1 })
    .populate('agentProfileId')
    .populate('propertyId', 'name address')
    .lean();
  res.locals.data = mandates;
}

export async function listAgentMandates(req: Request, res: Response): Promise<void> {
  const agentId = req.user!.id;
  const mandates = await Mandate.find({ agentId })
    .sort({ createdAt: -1 })
    .populate('ownerId', 'name email phone')
    .populate('propertyId', 'name address')
    .lean();
  res.locals.data = mandates;
}

// --- Espace Propriétaire : Mes Annonces & Offres ---

export async function listOwnerListings(req: Request, res: Response): Promise<void> {
  const ownerId = req.user!.id;
  const listings = await Listing.find({ publisherId: ownerId, deletedAt: null })
    .sort({ createdAt: -1 })
    .populate('propertyId', 'name address')
    .populate('unitId', 'unitNumber')
    .lean();
  res.locals.data = listings;
}

export async function createOwnerListing(req: Request, res: Response): Promise<void> {
  const ownerId = req.user!.id;
  const body = req.body;

  const listing = await Listing.create({
    ...body,
    organizationId: req.params.organizationId,
    publisherId: ownerId,
    publisherRole: 'OWNER',
    status: 'PENDING_REVIEW',
    isVerified: false,
  });

  res.locals.data = listing;
}

export async function updateOwnerListing(req: Request, res: Response): Promise<void> {
  const ownerId = req.user!.id;
  const { id } = req.params;

  const listing = await Listing.findOne({ _id: id, publisherId: ownerId, deletedAt: null });
  if (!listing) {
    throw new HttpError(404, 'Annonce introuvable.');
  }

  Object.assign(listing, req.body);
  if (req.body.title || req.body.priceMinor || req.body.description) {
    listing.status = 'PENDING_REVIEW';
  }

  await listing.save();
  res.locals.data = listing;
}

export async function deleteOwnerListing(req: Request, res: Response): Promise<void> {
  const ownerId = req.user!.id;
  const { id } = req.params;

  const listing = await Listing.findOne({ _id: id, publisherId: ownerId, deletedAt: null });
  if (!listing) {
    throw new HttpError(404, 'Annonce introuvable.');
  }

  listing.deletedAt = new Date();
  listing.status = 'WITHDRAWN';
  await listing.save();

  res.locals.data = { message: 'Annonce supprimée.' };
}

export async function listOwnerReceivedOffers(req: Request, res: Response): Promise<void> {
  const ownerId = req.user!.id;

  // Find all listings belonging to this owner
  const myListings = await Listing.find({ publisherId: ownerId }, { _id: 1 }).lean();
  const listingIds = myListings.map((l) => l._id);

  const offers = await Offer.find({
    $or: [{ ownerId }, { listingId: { $in: listingIds } }],
  })
    .sort({ createdAt: -1 })
    .populate('listingId', 'title priceMinor currency location')
    .lean();

  res.locals.data = offers;
}

export async function decideOwnerOffer(req: Request, res: Response): Promise<void> {
  const ownerId = req.user!.id;
  const { id } = req.params;
  const { status, counterOfferAmountMinor, ownerDecisionNote } = req.body;

  const offer = await Offer.findById(id);
  if (!offer) {
    throw new HttpError(404, 'Offre introuvable.');
  }

  // Check that the offer is for a listing of this owner
  const listing = await Listing.findById(offer.listingId);
  if (
    !listing ||
    (String(listing.publisherId) !== String(ownerId) && String(offer.ownerId) !== String(ownerId))
  ) {
    throw new HttpError(403, 'Action non autorisée sur cette offre.');
  }

  offer.status = status;
  if (counterOfferAmountMinor) {
    offer.counterOfferAmountMinor = counterOfferAmountMinor;
  }
  if (ownerDecisionNote) {
    offer.ownerDecisionNote = ownerDecisionNote;
  }
  offer.decidedAt = new Date();
  await offer.save();

  // If accepted and an agent is attached via mandate, log commission as ESTIMATED
  if (status === 'ACCEPTED' && listing.mandateId) {
    const mandate = await Mandate.findById(listing.mandateId);
    if (mandate) {
      let commissionAmount = 0;
      if (mandate.commissionType === 'PERCENTAGE') {
        commissionAmount = Math.round((offer.offeredAmountMinor * mandate.commissionRate) / 100);
      } else {
        commissionAmount = mandate.commissionRate;
      }

      await Commission.create({
        organizationId: offer.organizationId,
        mandateId: mandate._id,
        listingId: offer.listingId,
        agentId: mandate.agentId,
        ownerId,
        transactionAmountMinor: offer.offeredAmountMinor,
        commissionAmountMinor: commissionAmount,
        currency: offer.currency,
        status: 'ESTIMATED',
        notes: `Commission suite à l'acceptation de l'offre propriétaire pour ${offer.prospectName}.`,
      });
    }
  }

  res.locals.data = offer;
}
