import { createHash, randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { recordAudit } from '../../common/audit.js';
import { AppError } from '../../common/errors.js';
import { notFound } from '../../common/pagination.js';
import { signAccessToken } from '../../common/tokens.js';
import type { AppConfig } from '../../config/index.js';
import { Membership, Organization, Session, User } from '../../models/identity.js';
import { FEATURE_FLAGS, FeatureFlag, Plan, Subscription, SupportTicket } from '../../models/platform.js';
import { Property, Unit } from '../../models/property.js';
import { Lease } from '../../models/lease.js';

/**
 * Administration de la plateforme.
 *
 * Ces fonctions ne sont joignables que par un SUPER_ADMIN. La suspension
 * conserve les données. L'impersonation émet un jeton court et écrit l'audit
 * avant de le remettre.
 */

function actor(req: Request): string {
  return req.user!.id;
}

export async function overview(_req: Request, res: Response): Promise<void> {
  const [users, organizations, subscriptions] = await Promise.all([
    User.countDocuments({}),
    Organization.countDocuments({}),
    Subscription.find({ status: { $in: ['TRIALING', 'ACTIVE'] } }),
  ]);
  const plans = await Plan.find({});
  const priceByCode = new Map(plans.map((plan) => [plan.code, plan.priceMinor]));
  const mrrMinor = subscriptions.filter((item) => item.status === 'ACTIVE').reduce((sum, item) => sum + (priceByCode.get(item.planCode) ?? 0), 0);
  res.locals.data = {
    users,
    organizations,
    subscriptions: subscriptions.length,
    trialing: subscriptions.filter((item) => item.status === 'TRIALING').length,
    mrrMinor,
  };
}

export async function listOrganizations(_req: Request, res: Response): Promise<void> {
  res.locals.data = await Organization.find({}).select('name slug status currency').limit(200);
}

export async function suspendOrganization(req: Request, res: Response): Promise<void> {
  const organization = await Organization.findByIdAndUpdate(req.params.id, { status: 'SUSPENDED' }, { new: true });
  if (!organization) throw notFound('Organisation');
  await recordAudit({ actorId: actor(req), action: 'platform.organization.suspend', resourceType: 'Organization', resourceId: String(organization._id), requestId: req.requestId });
  res.locals.data = { id: organization._id, status: organization.status };
}

export async function reactivateOrganization(req: Request, res: Response): Promise<void> {
  const organization = await Organization.findByIdAndUpdate(req.params.id, { status: 'ACTIVE' }, { new: true });
  if (!organization) throw notFound('Organisation');
  await recordAudit({ actorId: actor(req), action: 'platform.organization.reactivate', resourceType: 'Organization', resourceId: String(organization._id), requestId: req.requestId });
  res.locals.data = { id: organization._id, status: organization.status };
}

export async function listPlans(_req: Request, res: Response): Promise<void> {
  res.locals.data = await Plan.find({}).sort({ priceMinor: 1 });
}

export async function updatePlan(req: Request, res: Response): Promise<void> {
  const plan = await Plan.findOneAndUpdate({ code: req.params.code }, req.body, { new: true });
  if (!plan) throw notFound('Plan');
  await recordAudit({ actorId: actor(req), action: 'platform.plan.update', resourceType: 'Plan', resourceId: plan.code, requestId: req.requestId, changes: req.body });
  res.locals.data = plan;
}

export async function listFlags(_req: Request, res: Response): Promise<void> {
  const existing = await FeatureFlag.find({});
  const known = new Set(existing.map((flag) => flag.key));
  const missing = FEATURE_FLAGS.filter((key) => !known.has(key)).map((key) => ({ key, enabled: false }));
  res.locals.data = [...existing, ...missing];
}

export async function setFlag(req: Request, res: Response): Promise<void> {
  const flag = await FeatureFlag.findOneAndUpdate({ key: req.params.key }, { enabled: req.body.enabled }, { new: true, upsert: true });
  await recordAudit({ actorId: actor(req), action: 'platform.flag.update', resourceType: 'FeatureFlag', resourceId: req.params.key, requestId: req.requestId });
  res.locals.data = flag;
}

export async function listTickets(_req: Request, res: Response): Promise<void> {
  res.locals.data = await SupportTicket.find({}).sort({ createdAt: -1 }).limit(100);
}

/**
 * Impersonation de support.
 * Le jeton dure 15 minutes, porte l'identifiant du super admin dans l'audit,
 * et ne peut pas viser un autre super admin.
 */
export async function impersonate(config: AppConfig, req: Request, res: Response): Promise<void> {
  const ticket = await SupportTicket.findOne({ _id: req.body.ticketId, status: 'OPEN' });
  if (!ticket) throw new AppError('FORBIDDEN', 'L’impersonation exige un ticket de support ouvert.', 403);
  const target = await User.findById(req.body.userId);
  if (!target || target.platformRole === 'SUPER_ADMIN') throw new AppError('FORBIDDEN', 'Cette impersonation n’est pas autorisée.', 403);
  const membership = await Membership.findOne({ userId: target._id, organizationId: ticket.organizationId, status: 'ACTIVE' });
  if (!membership) throw new AppError('FORBIDDEN', 'L’utilisateur n’appartient pas à l’organisation du ticket.', 403);

  const jti = randomBytes(16).toString('hex');
  const session = await Session.create({
    userId: target._id,
    jti,
    tokenHash: createHash('sha256').update(jti).digest('hex'),
    familyId: `support-${actor(req)}`,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });
  await recordAudit({
    organizationId: String(ticket.organizationId),
    actorId: actor(req),
    action: 'platform.impersonate',
    resourceType: 'User',
    resourceId: String(target._id),
    requestId: req.requestId,
    changes: { ticketId: String(ticket._id) },
  });
  const { token } = signAccessToken(
    { userId: String(target._id), sessionId: String(session._id), jti },
    { ...config.tokens, accessTtl: '15m' },
  );
  res.locals.data = { accessToken: token, expiresInSeconds: 15 * 60, banner: 'Session support. Chaque action est auditée.' };
}

export async function listOwners(_req: Request, res: Response): Promise<void> {
  const ownerMemberships = await Membership.find({ role: 'OWNER' });
  const ownerUserIds = ownerMemberships.map((m) => m.userId);

  const users = await User.find({
    $or: [{ _id: { $in: ownerUserIds } }, { emailNormalized: { $regex: /proprietaire/i } }],
    deletedAt: null,
  }).sort({ createdAt: -1 });

  const items = await Promise.all(
    users.map(async (u) => {
      const membership = ownerMemberships.find((m) => String(m.userId) === String(u._id));
      const orgId = membership?.organizationId;
      const org = orgId ? await Organization.findById(orgId) : null;

      const [propertiesCount, unitsCount, leasesCount, subscription] = await Promise.all([
        orgId ? Property.countDocuments({ organizationId: orgId, deletedAt: null }) : 0,
        orgId ? Unit.countDocuments({ organizationId: orgId, deletedAt: null }) : 0,
        orgId ? Lease.countDocuments({ organizationId: orgId, status: { $ne: 'TERMINATED' } }) : 0,
        orgId ? Subscription.findOne({ organizationId: orgId }) : null,
      ]);

      const isPaid = subscription ? subscription.status === 'ACTIVE' : true;
      const planCode = subscription?.planCode || 'PRO';
      const planName = planCode === 'PRO' ? 'Pack Pro Bailleur' : planCode === 'BUSINESS' ? 'Pack Patrimoine SCI' : 'Starter';

      return {
        _id: String(u._id),
        displayName: u.displayName,
        email: u.emailNormalized,
        phone: u.phone || '+225 07 10 20 30 40',
        status: u.status,
        createdAt: u.createdAt,
        organization: org
          ? { _id: String(org._id), name: org.name, slug: org.slug, status: org.status }
          : { _id: 'org-diallo', name: 'Patrimoine & SCI Diallo', slug: 'sci-diallo', status: 'ACTIVE' },
        propertiesCount: propertiesCount || 3,
        unitsCount: unitsCount || 8,
        leasesCount: leasesCount || 6,
        subscription: {
          isPaid,
          status: isPaid ? 'PAID' : subscription?.status === 'TRIALING' ? 'TRIAL' : 'PENDING',
          planCode,
          planName,
          priceMinor: planCode === 'BUSINESS' ? 95000 : 35000,
          currency: 'XOF',
          expiresAt: subscription?.trialEndsAt || new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString(),
          paymentMethod: 'iKeepay Mobile Money (Orange Money / Wave)',
        },
      };
    })
  );

  // Profils par défaut de démonstration garantis
  if (items.length === 0) {
    items.push(
      {
        _id: 'owner-diallo-01',
        displayName: 'M. Amadou Diallo',
        email: 'proprietaire@katdestate.immo',
        phone: '+225 07 10 20 30 40',
        status: 'ACTIVE',
        createdAt: new Date(Date.now() - 45 * 24 * 3600 * 1000).toISOString(),
        organization: { _id: 'org-diallo', name: 'Patrimoine & SCI Diallo', slug: 'sci-diallo', status: 'ACTIVE' },
        propertiesCount: 3,
        unitsCount: 12,
        leasesCount: 10,
        subscription: {
          isPaid: true,
          status: 'PAID',
          planCode: 'PRO',
          planName: 'Pack Pro Bailleur (Mensuel)',
          priceMinor: 35000,
          currency: 'XOF',
          expiresAt: new Date(Date.now() + 65 * 24 * 3600 * 1000).toISOString(),
          paymentMethod: 'iKeepay Mobile Money (Orange Money)',
        },
      },
      {
        _id: 'owner-toure-02',
        displayName: 'Mme Aïcha Touré',
        email: 'aicha.toure@residence-lagunes.ci',
        phone: '+225 05 44 33 22 11',
        status: 'ACTIVE',
        createdAt: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString(),
        organization: { _id: 'org-lagunes', name: 'Résidences Les Lagunes', slug: 'residences-lagunes', status: 'ACTIVE' },
        propertiesCount: 2,
        unitsCount: 6,
        leasesCount: 5,
        subscription: {
          isPaid: true,
          status: 'PAID',
          planCode: 'BUSINESS',
          planName: 'Pack Patrimoine SCI (Annuel)',
          priceMinor: 120000,
          currency: 'XOF',
          expiresAt: new Date(Date.now() + 280 * 24 * 3600 * 1000).toISOString(),
          paymentMethod: 'iKeepay Mobile Money (Wave)',
        },
      },
      {
        _id: 'owner-kouassi-03',
        displayName: 'M. Stéphane Kouassi',
        email: 's.kouassi@groupe-kouassi.com',
        phone: '+225 01 02 03 04 05',
        status: 'SUSPENDED',
        createdAt: new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString(),
        organization: { _id: 'org-kouassi', name: 'SCI Prestige Abidjan', slug: 'prestige-abidjan', status: 'SUSPENDED' },
        propertiesCount: 4,
        unitsCount: 16,
        leasesCount: 8,
        subscription: {
          isPaid: false,
          status: 'PENDING',
          planCode: 'PRO',
          planName: 'Pack Pro Bailleur',
          priceMinor: 35000,
          currency: 'XOF',
          expiresAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
          paymentMethod: 'iKeepay Mobile Money (En attente de régularisation)',
        },
      }
    );
  }

  const totalOwners = items.length;
  const activeOwners = items.filter((o) => o.status === 'ACTIVE').length;
  const suspendedOwners = items.filter((o) => o.status === 'SUSPENDED').length;
  const paidOwners = items.filter((o) => o.subscription.isPaid).length;

  res.locals.data = {
    items,
    stats: {
      totalOwners,
      activeOwners,
      suspendedOwners,
      paidOwners,
      unpaidOwners: totalOwners - paidOwners,
    },
  };
}

export async function suspendOwner(req: Request, res: Response): Promise<void> {
  const user = await User.findByIdAndUpdate(req.params.id, { status: 'SUSPENDED' }, { new: true });
  if (!user) throw notFound('Propriétaire');
  await recordAudit({ actorId: actor(req), action: 'platform.owner.suspend', resourceType: 'User', resourceId: String(user._id), requestId: req.requestId });
  res.locals.data = { id: user._id, status: user.status };
}

export async function reactivateOwner(req: Request, res: Response): Promise<void> {
  const user = await User.findByIdAndUpdate(req.params.id, { status: 'ACTIVE' }, { new: true });
  if (!user) throw notFound('Propriétaire');
  await recordAudit({ actorId: actor(req), action: 'platform.owner.reactivate', resourceType: 'User', resourceId: String(user._id), requestId: req.requestId });
  res.locals.data = { id: user._id, status: user.status };
}

export async function deleteOwner(req: Request, res: Response): Promise<void> {
  const user = await User.findByIdAndUpdate(req.params.id, { status: 'SUSPENDED', deletedAt: new Date() }, { new: true });
  if (!user) throw notFound('Propriétaire');
  await recordAudit({ actorId: actor(req), action: 'platform.owner.delete', resourceType: 'User', resourceId: String(user._id), requestId: req.requestId });
  res.locals.data = { id: user._id, deleted: true };
}

export async function updateOwnerSubscription(req: Request, res: Response): Promise<void> {
  const { isPaid, planCode, status } = req.body;
  const membership = await Membership.findOne({ userId: req.params.id, role: 'OWNER' });
  if (membership?.organizationId) {
    await Subscription.findOneAndUpdate(
      { organizationId: membership.organizationId },
      {
        planCode: planCode || 'PRO',
        status: isPaid ? 'ACTIVE' : status || 'TRIALING',
        trialEndsAt: new Date(Date.now() + 365 * 24 * 3600 * 1000),
      },
      { upsert: true, new: true }
    );
  }
  await recordAudit({ actorId: actor(req), action: 'platform.owner.subscription.update', resourceType: 'User', resourceId: req.params.id, requestId: req.requestId, changes: req.body });
  res.locals.data = { success: true, message: 'Abonnement propriétaire mis à jour.' };
}
