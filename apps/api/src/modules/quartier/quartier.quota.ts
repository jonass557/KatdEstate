import { HttpError } from '../../common/errors.js';
import { QuartierPlan, QuartierSubscription, QuartierResidence, GeoBlock } from '../../models/quartier.js';

export const DEFAULT_QUARTIER_PLANS = [
  {
    code: 'QUARTIER_DISCOVERY',
    name: 'Formule Découverte',
    priceMinor: 0,
    currency: 'XOF',
    durationMonths: 1,
    maxBlocks: 1,
    maxResidences: 50,
    maxSecondaryLeaders: 0,
    maxAnnouncementsPerMonth: 5,
    advancedReports: false,
    interactiveMap: true,
    isActive: true,
  },
  {
    code: 'QUARTIER_STANDARD',
    name: 'Formule Standard (1 Bloc)',
    priceMinor: 10_000,
    currency: 'XOF',
    durationMonths: 1,
    maxBlocks: 1,
    maxResidences: 300,
    maxSecondaryLeaders: 1,
    maxAnnouncementsPerMonth: 30,
    advancedReports: false,
    interactiveMap: true,
    isActive: true,
  },
  {
    code: 'QUARTIER_PRO',
    name: 'Formule Professionnelle (Multi-Blocs)',
    priceMinor: 25_000,
    currency: 'XOF',
    durationMonths: 1,
    maxBlocks: 5,
    maxResidences: 1_500,
    maxSecondaryLeaders: 5,
    maxAnnouncementsPerMonth: 100,
    advancedReports: true,
    interactiveMap: true,
    isActive: true,
  },
  {
    code: 'QUARTIER_DISTRICT',
    name: 'Formule Quartier Complet',
    priceMinor: 50_000,
    currency: 'XOF',
    durationMonths: 1,
    maxBlocks: 25,
    maxResidences: 10_000,
    maxSecondaryLeaders: 25,
    maxAnnouncementsPerMonth: 300,
    advancedReports: true,
    interactiveMap: true,
    isActive: true,
  },
] as const;

export async function ensureDefaultQuartierPlans(): Promise<void> {
  for (const plan of DEFAULT_QUARTIER_PLANS) {
    await QuartierPlan.updateOne(
      { code: plan.code },
      { $setOnInsert: plan },
      { upsert: true }
    );
  }
}

export async function getLeaderSubscription(userId: string) {
  await ensureDefaultQuartierPlans();

  let sub = await QuartierSubscription.findOne({ userId, status: 'ACTIVE' });
  if (!sub) {
    // Subscription par défaut découverte (30 jours)
    sub = await QuartierSubscription.create({
      userId,
      role: 'BLOCK_LEADER',
      planCode: 'QUARTIER_DISCOVERY',
      status: 'ACTIVE',
      period: 'MONTHLY',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      paymentsHistory: [],
    });
  }

  // Check expiration
  if (sub.expiresAt && sub.expiresAt.getTime() < Date.now()) {
    sub.status = 'EXPIRED';
    await sub.save();
  }

  const plan = (await QuartierPlan.findOne({ code: sub.planCode })) ?? (await QuartierPlan.findOne({ code: 'QUARTIER_DISCOVERY' }));
  if (!plan) {
    throw new HttpError(500, 'Grille tarifaire quartier introuvable.');
  }

  const blocksCount = await GeoBlock.countDocuments({ blockLeaderId: userId });
  const residencesCount = await QuartierResidence.countDocuments({ registeredBy: userId, deletedAt: null });

  return {
    subscription: sub,
    plan,
    isExpired: sub.status === 'EXPIRED',
    usage: {
      blocksCount,
      maxBlocks: plan.maxBlocks,
      canAddBlock: blocksCount < plan.maxBlocks,
      residencesCount,
      maxResidences: plan.maxResidences,
      canAddResidence: residencesCount < plan.maxResidences,
      advancedReports: plan.advancedReports,
      interactiveMap: plan.interactiveMap,
    },
  };
}

export async function checkResidenceQuota(userId: string): Promise<void> {
  const { isExpired, usage, plan } = await getLeaderSubscription(userId);

  if (isExpired) {
    throw new HttpError(
      403,
      'Votre abonnement chef de secteur a expiré. Veuillez renouveler votre formule pour poursuivre le recensement de votre bloc.'
    );
  }

  if (usage.residencesCount >= plan.maxResidences) {
    throw new HttpError(
      403,
      `Limite de recensement atteinte (${usage.residencesCount}/${plan.maxResidences} résidences). Passez à la formule supérieure pour recenser davantage de résidences.`
    );
  }
}
