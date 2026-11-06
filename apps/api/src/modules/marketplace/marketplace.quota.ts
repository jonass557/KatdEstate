import { HttpError } from '../../common/errors.js';
import { AgentPlan, AgentProfile, Listing } from '../../models/marketplace.js';

export const DEFAULT_AGENT_PLANS = [
  {
    code: 'AGENT_FREE',
    name: 'Agent Gratuit',
    priceMinor: 0,
    currency: 'XOF',
    durationMonths: 1,
    trialDays: 0,
    maxActiveListings: 3,
    maxPhotosPerListing: 5,
    maxVideosPerListing: 0,
    featuredListingsQuota: 0,
    advancedAnalytics: false,
    leadManagement: false,
    maxCollaborators: 0,
    isActive: true,
  },
  {
    code: 'AGENT_STARTER',
    name: 'Agent Starter',
    priceMinor: 15_000,
    currency: 'XOF',
    durationMonths: 1,
    trialDays: 14,
    maxActiveListings: 15,
    maxPhotosPerListing: 12,
    maxVideosPerListing: 1,
    featuredListingsQuota: 2,
    advancedAnalytics: false,
    leadManagement: true,
    maxCollaborators: 1,
    isActive: true,
  },
  {
    code: 'AGENT_PRO',
    name: 'Agent Professionnel',
    priceMinor: 35_000,
    currency: 'XOF',
    durationMonths: 1,
    trialDays: 14,
    maxActiveListings: 50,
    maxPhotosPerListing: 20,
    maxVideosPerListing: 3,
    featuredListingsQuota: 5,
    advancedAnalytics: true,
    leadManagement: true,
    maxCollaborators: 3,
    isActive: true,
  },
  {
    code: 'AGENT_BUSINESS',
    name: 'Agent Business / Agence',
    priceMinor: 75_000,
    currency: 'XOF',
    durationMonths: 1,
    trialDays: 14,
    maxActiveListings: 200,
    maxPhotosPerListing: 35,
    maxVideosPerListing: 10,
    featuredListingsQuota: 15,
    advancedAnalytics: true,
    leadManagement: true,
    maxCollaborators: 10,
    isActive: true,
  },
] as const;

export async function ensureDefaultAgentPlans(): Promise<void> {
  for (const plan of DEFAULT_AGENT_PLANS) {
    await AgentPlan.updateOne({ code: plan.code }, { $setOnInsert: plan }, { upsert: true });
  }
}

export async function getAgentPlanWithUsage(userId: string) {
  await ensureDefaultAgentPlans();

  let profile = await AgentProfile.findOne({ userId });
  if (!profile) {
    // Profil par défaut non initialisé
    profile = await AgentProfile.create({
      userId,
      firstName: 'Agent',
      lastName: 'Immobilier',
      phone: '+221000000000',
      email: 'agent@domora.immo',
      city: 'Dakar',
      country: 'SN',
      activeSubscriptionPlan: 'AGENT_FREE',
      verificationStatus: 'UNVERIFIED',
    });
  }

  const planCode = profile.activeSubscriptionPlan || 'AGENT_FREE';
  const plan =
    (await AgentPlan.findOne({ code: planCode })) ??
    (await AgentPlan.findOne({ code: 'AGENT_FREE' }));

  if (!plan) {
    throw new HttpError(500, 'Grille tarifaire agent introuvable.');
  }

  const [activeListingsCount, featuredListingsCount] = await Promise.all([
    Listing.countDocuments({
      publisherId: userId,
      status: { $in: ['PUBLISHED', 'PENDING_REVIEW'] },
      deletedAt: null,
    }),
    Listing.countDocuments({
      publisherId: userId,
      isFeatured: true,
      status: 'PUBLISHED',
      deletedAt: null,
    }),
  ]);

  return {
    profile,
    plan,
    usage: {
      activeListingsCount,
      maxActiveListings: plan.maxActiveListings,
      canCreateListing: activeListingsCount < plan.maxActiveListings,
      featuredListingsCount,
      maxFeaturedListings: plan.featuredListingsQuota,
      canFeatureListing: featuredListingsCount < plan.featuredListingsQuota,
      maxPhotosPerListing: plan.maxPhotosPerListing,
      maxVideosPerListing: plan.maxVideosPerListing,
      advancedAnalytics: plan.advancedAnalytics,
      leadManagement: plan.leadManagement,
    },
  };
}

export async function checkAgentListingQuota(
  userId: string,
  photosCount: number,
  videosCount: number,
  isFeatured = false,
  isUpdate = false,
): Promise<void> {
  const { plan, usage } = await getAgentPlanWithUsage(userId);

  if (!isUpdate && usage.activeListingsCount >= plan.maxActiveListings) {
    throw new HttpError(
      403,
      `Quota d'annonces atteint (${usage.activeListingsCount}/${plan.maxActiveListings}). Passez à une formule supérieure pour publier davantage d'annonces.`,
    );
  }

  if (photosCount > plan.maxPhotosPerListing) {
    throw new HttpError(
      403,
      `Votre abonnement autorise un maximum de ${plan.maxPhotosPerListing} photos par annonce (fourni: ${photosCount}).`,
    );
  }

  if (videosCount > plan.maxVideosPerListing) {
    throw new HttpError(
      403,
      `Votre formule autorise ${plan.maxVideosPerListing} vidéo(s) par annonce (fourni: ${videosCount}).`,
    );
  }

  if (isFeatured && usage.featuredListingsCount >= plan.featuredListingsQuota) {
    throw new HttpError(
      403,
      `Quota d'annonces mises en avant atteint (${usage.featuredListingsCount}/${plan.featuredListingsQuota}).`,
    );
  }
}
