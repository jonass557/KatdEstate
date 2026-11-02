import { createHash, randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { recordAudit } from '../../common/audit.js';
import { AppError } from '../../common/errors.js';
import { notFound } from '../../common/pagination.js';
import { signAccessToken } from '../../common/tokens.js';
import type { AppConfig } from '../../config/index.js';
import { Membership, Organization, Session, User } from '../../models/identity.js';
import { FEATURE_FLAGS, FeatureFlag, Plan, Subscription, SupportTicket } from '../../models/platform.js';

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
