import type { Request, Response } from 'express';
import { HttpError } from '../../common/errors.js';
import {
  AgentProfile,
  AgentPlan,
  Listing,
  Mandate,
  Lead,
  Viewing,
  Offer,
  Commission,
} from '../../models/marketplace.js';
import { checkAgentListingQuota, getAgentPlanWithUsage } from './marketplace.quota.js';

export async function getAgentDashboard(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;

  const [
    activeListings,
    pendingListings,
    soldListings,
    rentedListings,
    leadsCount,
    newLeadsCount,
    upcomingViewings,
    activeMandates,
    commissions,
    subscriptionInfo,
  ] = await Promise.all([
    Listing.countDocuments({ publisherId: userId, status: 'PUBLISHED', deletedAt: null }),
    Listing.countDocuments({ publisherId: userId, status: 'PENDING_REVIEW', deletedAt: null }),
    Listing.countDocuments({ publisherId: userId, status: 'SOLD' }),
    Listing.countDocuments({ publisherId: userId, status: 'RENTED' }),
    Lead.countDocuments({ agentId: userId }),
    Lead.countDocuments({ agentId: userId, status: 'NEW' }),
    Viewing.find({ agentId: userId, date: { $gte: new Date() }, status: { $in: ['SCHEDULED', 'CONFIRMED'] } })
      .sort({ date: 1 })
      .limit(5)
      .populate('listingId', 'title location priceMinor currency')
      .lean(),
    Mandate.countDocuments({ agentId: userId, status: 'ACTIVE' }),
    Commission.find({ agentId: userId }).lean(),
    getAgentPlanWithUsage(userId),
  ]);

  const estimatedCommissions = commissions
    .filter((c) => c.status === 'ESTIMATED' || c.status === 'VALIDATED')
    .reduce((sum, c) => sum + (c.commissionAmountMinor || 0), 0);

  const earnedCommissions = commissions
    .filter((c) => c.status === 'PAID')
    .reduce((sum, c) => sum + (c.commissionAmountMinor || 0), 0);

  const recentLeads = await Lead.find({ agentId: userId })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('associatedListings', 'title')
    .lean();

  res.locals.data = {
    kpis: {
      activeListings,
      pendingListings,
      soldListings,
      rentedListings,
      totalLeads: leadsCount,
      newLeads: newLeadsCount,
      upcomingViewingsCount: upcomingViewings.length,
      activeMandates,
      estimatedCommissionsMinor: estimatedCommissions,
      earnedCommissionsMinor: earnedCommissions,
      currency: 'XOF',
    },
    upcomingViewings,
    recentLeads,
    subscription: subscriptionInfo,
  };
}

export async function getAgentProfile(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { profile } = await getAgentPlanWithUsage(userId);
  res.locals.data = profile;
}

export async function updateAgentProfile(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const updates = req.body;

  // Protected fields cannot be self-updated
  delete updates.verificationStatus;
  delete updates.verifiedAt;
  delete updates.rejectionReason;
  delete updates.rating;
  delete updates.reviewCount;
  delete updates.activeSubscriptionPlan;

  const profile = await AgentProfile.findOneAndUpdate(
    { userId },
    { $set: updates },
    { new: true, upsert: true }
  );

  res.locals.data = profile;
}

export async function getAgentSubscription(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const info = await getAgentPlanWithUsage(userId);
  const availablePlans = await AgentPlan.find({ isActive: true }).lean();
  res.locals.data = {
    ...info,
    availablePlans,
  };
}

export async function changeAgentSubscriptionPlan(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { planCode } = req.body;

  const targetPlan = await AgentPlan.findOne({ code: planCode, isActive: true });
  if (!targetPlan) {
    throw new HttpError(404, 'Formule d’abonnement introuvable.');
  }

  const profile = await AgentProfile.findOneAndUpdate(
    { userId },
    {
      $set: {
        activeSubscriptionPlan: targetPlan.code,
        subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 jours
      },
    },
    { new: true, upsert: true }
  );

  res.locals.data = {
    profile,
    message: `Abonnement mis à jour vers "${targetPlan.name}".`,
  };
}

// --- Listings CRUD ---
export async function listAgentListings(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { status } = req.query;

  const filter: Record<string, unknown> = {
    publisherId: userId,
    deletedAt: null,
  };

  if (status && typeof status === 'string') {
    filter.status = status;
  }

  const listings = await Listing.find(filter)
    .sort({ createdAt: -1 })
    .populate('propertyId', 'name address')
    .populate('unitId', 'unitNumber')
    .populate('mandateId', 'mandateType commissionRate status')
    .lean();

  res.locals.data = listings;
}

export async function createAgentListing(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const body = req.body;

  const photosCount = Array.isArray(body.photos) ? body.photos.length : 0;
  const videosCount = Array.isArray(body.videos) ? body.videos.length : 0;
  const isFeatured = Boolean(body.isFeatured);

  // Check quota enforcement
  await checkAgentListingQuota(userId, photosCount, videosCount, isFeatured, false);

  // If linking to a DOMORA property, check mandate
  if (body.propertyId) {
    const activeMandate = await Mandate.findOne({
      agentId: userId,
      propertyId: body.propertyId,
      status: 'ACTIVE',
      endDate: { $gte: new Date() },
    });

    if (!activeMandate) {
      throw new HttpError(
        403,
        'Aucun mandat actif n’a été trouvé pour commercialiser ce bien au nom du propriétaire.'
      );
    }
    body.mandateId = activeMandate._id;
  }

  const agentProfile = await AgentProfile.findOne({ userId });

  const listing = await Listing.create({
    ...body,
    organizationId: req.params.organizationId,
    publisherId: userId,
    publisherRole: 'AGENT',
    agentProfileId: agentProfile?._id,
    status: 'PENDING_REVIEW', // Subject to admin moderation
    isVerified: agentProfile?.verificationStatus === 'VERIFIED',
  });

  res.locals.data = listing;
}

export async function updateAgentListing(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { id } = req.params;
  const body = req.body;

  const existing = await Listing.findOne({ _id: id, publisherId: userId, deletedAt: null });
  if (!existing) {
    throw new HttpError(404, 'Annonce introuvable.');
  }

  const photosCount = Array.isArray(body.photos) ? body.photos.length : existing.photos.length;
  const videosCount = Array.isArray(body.videos) ? body.videos.length : existing.videos.length;
  const isFeatured = body.isFeatured !== undefined ? Boolean(body.isFeatured) : existing.isFeatured;

  await checkAgentListingQuota(userId, photosCount, videosCount, isFeatured, true);

  Object.assign(existing, body);
  // Any update to crucial content resets to review if modified
  if (body.title || body.priceMinor || body.description) {
    existing.status = 'PENDING_REVIEW';
  }

  await existing.save();
  res.locals.data = existing;
}

export async function deleteAgentListing(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { id } = req.params;

  const listing = await Listing.findOne({ _id: id, publisherId: userId, deletedAt: null });
  if (!listing) {
    throw new HttpError(404, 'Annonce introuvable.');
  }

  listing.deletedAt = new Date();
  listing.status = 'WITHDRAWN';
  await listing.save();

  res.locals.data = { message: 'Annonce retirée avec succès.' };
}

// --- Leads CRM ---
export async function listAgentLeads(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { status } = req.query;

  const filter: Record<string, unknown> = { agentId: userId };
  if (status && typeof status === 'string') {
    filter.status = status;
  }

  const leads = await Lead.find(filter)
    .sort({ updatedAt: -1 })
    .populate('associatedListings', 'title priceMinor currency location')
    .lean();

  res.locals.data = leads;
}

export async function createAgentLead(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const lead = await Lead.create({
    ...req.body,
    organizationId: req.params.organizationId,
    agentId: userId,
  });
  res.locals.data = lead;
}

export async function updateAgentLead(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { id } = req.params;

  const lead = await Lead.findOneAndUpdate(
    { _id: id, agentId: userId },
    { $set: req.body },
    { new: true }
  );

  if (!lead) {
    throw new HttpError(404, 'Prospect introuvable.');
  }

  res.locals.data = lead;
}

export async function deleteAgentLead(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { id } = req.params;

  const result = await Lead.findOneAndDelete({ _id: id, agentId: userId });
  if (!result) {
    throw new HttpError(404, 'Prospect introuvable.');
  }

  res.locals.data = { message: 'Prospect supprimé.' };
}

// --- Viewings ---
export async function listAgentViewings(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const viewings = await Viewing.find({ agentId: userId })
    .sort({ date: 1 })
    .populate('listingId', 'title location priceMinor currency photos')
    .lean();
  res.locals.data = viewings;
}

export async function updateAgentViewing(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { id } = req.params;

  const viewing = await Viewing.findOneAndUpdate(
    { _id: id, agentId: userId },
    { $set: req.body },
    { new: true }
  );

  if (!viewing) {
    throw new HttpError(404, 'Visite introuvable.');
  }

  res.locals.data = viewing;
}

// --- Offers & Negotiations ---
export async function listAgentOffers(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const offers = await Offer.find({ agentId: userId })
    .sort({ createdAt: -1 })
    .populate('listingId', 'title priceMinor currency location')
    .lean();
  res.locals.data = offers;
}

export async function updateAgentOfferDecision(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { id } = req.params;
  const { status, counterOfferAmountMinor, ownerDecisionNote } = req.body;

  const offer = await Offer.findOne({ _id: id, agentId: userId });
  if (!offer) {
    throw new HttpError(404, 'Offre introuvable.');
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

  // If offer is ACCEPTED, create or update a Commission record as ESTIMATED
  if (status === 'ACCEPTED') {
    const listing = await Listing.findById(offer.listingId);
    let commissionAmount = 0;
    if (listing?.mandateId) {
      const mandate = await Mandate.findById(listing.mandateId);
      if (mandate && mandate.commissionRate) {
        if (mandate.commissionType === 'PERCENTAGE') {
          commissionAmount = Math.round((offer.offeredAmountMinor * mandate.commissionRate) / 100);
        } else {
          commissionAmount = mandate.commissionRate;
        }
      }
    } else {
      // Default standard 5% estimation if direct agent listing
      commissionAmount = Math.round((offer.offeredAmountMinor * 5) / 100);
    }

    await Commission.create({
      organizationId: offer.organizationId,
      mandateId: listing?.mandateId,
      listingId: offer.listingId,
      agentId: userId,
      ownerId: offer.ownerId,
      transactionAmountMinor: offer.offeredAmountMinor,
      commissionAmountMinor: commissionAmount,
      currency: offer.currency,
      status: 'ESTIMATED',
      notes: `Commission estimée suite à l'acceptation de l'offre de ${offer.prospectName}.`,
    });
  }

  res.locals.data = offer;
}

// --- Commissions ---
export async function listAgentCommissions(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const commissions = await Commission.find({ agentId: userId })
    .sort({ createdAt: -1 })
    .populate('listingId', 'title location priceMinor currency')
    .populate('mandateId', 'mandateType commissionRate')
    .lean();
  res.locals.data = commissions;
}
