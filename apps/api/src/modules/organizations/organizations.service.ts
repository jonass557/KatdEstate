import type { Request, Response } from 'express';
import { resolvePermissions, type OrganizationRole, type Permission } from '@rentflow/shared';
import { recordAudit } from '../../common/audit.js';
import { AppError } from '../../common/errors.js';
import { notFound } from '../../common/pagination.js';
import { Membership, Organization, User } from '../../models/identity.js';

export async function listUserOrganizations(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const memberships = await Membership.find({ userId, status: 'ACTIVE' })
    .populate('organizationId')
    .lean();

  const organizations = memberships
    .map((m) => {
      const org = m.organizationId as unknown as Record<string, unknown>;
      if (!org?._id) return null;
      return {
        id: String(org._id),
        name: org.name,
        slug: org.slug,
        country: org.country,
        currency: org.currency,
        timezone: org.timezone,
        locale: org.locale,
        logo: org.logo,
        address: org.address,
        phone: org.phone,
        email: org.email,
        notificationSettings: org.notificationSettings,
        billingSettings: org.billingSettings,
        role: m.role,
        permissions: resolvePermissions(m.role, {
          granted: (m.grantedPermissions ?? []) as Permission[],
          revoked: (m.revokedPermissions ?? []) as Permission[],
        }),
      };
    })
    .filter(Boolean);

  res.locals.data = organizations;
}

export async function createOrganization(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const {
    name,
    country,
    currency,
    timezone,
    locale,
    logo,
    address,
    phone,
    email,
    notificationSettings,
    billingSettings,
  } = req.body;

  const baseSlug =
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'organisation';
  const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 8)}`;

  const organization = await Organization.create({
    name,
    slug,
    country,
    currency,
    timezone: timezone ?? 'Africa/Dakar',
    locale: locale ?? 'fr',
    ...(logo ? { logo } : {}),
    ...(address ? { address } : {}),
    ...(phone ? { phone } : {}),
    ...(email ? { email } : {}),
    ...(notificationSettings ? { notificationSettings } : {}),
    ...(billingSettings ? { billingSettings } : {}),
    status: 'ACTIVE',
  });

  const membership = await Membership.create({
    userId,
    organizationId: organization._id,
    role: 'OWNER',
    status: 'ACTIVE',
  });

  await recordAudit({
    organizationId: String(organization._id),
    actorId: userId,
    action: 'organization.create',
    resourceType: 'Organization',
    resourceId: String(organization._id),
    requestId: req.requestId ?? 'unknown',
  });

  res.status(201);
  res.locals.data = {
    id: String(organization._id),
    name: organization.name,
    slug: organization.slug,
    country: organization.country,
    currency: organization.currency,
    timezone: organization.timezone,
    locale: organization.locale,
    logo: organization.logo,
    address: organization.address,
    phone: organization.phone,
    email: organization.email,
    notificationSettings: organization.notificationSettings,
    billingSettings: organization.billingSettings,
    role: membership.role,
  };
}

export async function getOrganization(req: Request, res: Response): Promise<void> {
  const organizationId = req.params.organizationId ?? req.params.id;
  const organization = await Organization.findOne({ _id: organizationId, status: 'ACTIVE' }).lean();
  if (!organization) throw notFound('Organisation');

  res.locals.data = {
    id: String(organization._id),
    name: organization.name,
    slug: organization.slug,
    country: organization.country,
    currency: organization.currency,
    timezone: organization.timezone,
    locale: organization.locale,
    logo: organization.logo,
    address: organization.address,
    phone: organization.phone,
    email: organization.email,
    notificationSettings: organization.notificationSettings,
    billingSettings: organization.billingSettings,
  };
}

export async function updateOrganization(req: Request, res: Response): Promise<void> {
  const organizationId = req.params.organizationId ?? req.params.id;
  const organization = await Organization.findOneAndUpdate(
    { _id: organizationId, status: 'ACTIVE' },
    { $set: req.body },
    { new: true },
  ).lean();
  if (!organization) throw notFound('Organisation');

  await recordAudit({
    organizationId: String(organization._id),
    ...(req.user?.id ? { actorId: req.user.id } : {}),
    action: 'organization.update',
    resourceType: 'Organization',
    resourceId: String(organization._id),
    requestId: req.requestId ?? 'unknown',
  });

  res.locals.data = {
    id: String(organization._id),
    name: organization.name,
    slug: organization.slug,
    country: organization.country,
    currency: organization.currency,
    timezone: organization.timezone,
    locale: organization.locale,
    logo: organization.logo,
    address: organization.address,
    phone: organization.phone,
    email: organization.email,
    notificationSettings: organization.notificationSettings,
    billingSettings: organization.billingSettings,
  };
}

export async function listMembers(req: Request, res: Response): Promise<void> {
  const organizationId = req.params.organizationId;
  const members = await Membership.find({ organizationId, status: { $ne: 'REMOVED' } })
    .populate('userId', 'displayName emailNormalized')
    .lean();

  res.locals.data = members.map((m) => {
    const user = m.userId as unknown as {
      _id?: unknown;
      displayName?: string;
      emailNormalized?: string;
    };
    return {
      id: String(m._id),
      userId: user?._id ? String(user._id) : String(m.userId),
      displayName: user?.displayName ?? '—',
      email: user?.emailNormalized ?? '—',
      role: m.role,
      status: m.status,
      permissions: resolvePermissions(m.role as OrganizationRole, {
        granted: (m.grantedPermissions ?? []) as Permission[],
        revoked: (m.revokedPermissions ?? []) as Permission[],
      }),
      createdAt: m.createdAt,
    };
  });
}

export async function inviteMember(req: Request, res: Response): Promise<void> {
  const organizationId = req.params.organizationId;
  const { email, role } = req.body;

  let user = await User.findOne({ emailNormalized: email.trim().toLowerCase() });
  if (!user) {
    user = await User.create({
      emailNormalized: email.trim().toLowerCase(),
      displayName: email.split('@')[0],
      passwordHash: 'INVITED_USER_PLACEHOLDER',
      status: 'ACTIVE',
    });
  }

  const existing = await Membership.findOne({ organizationId, userId: user._id });
  if (existing) {
    if (existing.status === 'REMOVED') {
      existing.status = 'INVITED';
      existing.role = role;
      await existing.save();
      res.status(200);
      res.locals.data = { id: String(existing._id), invited: true };
      return;
    }
    throw new AppError('CONFLICT', 'Cet utilisateur est déjà membre de l’organisation.', 409);
  }

  const membership = await Membership.create({
    organizationId,
    userId: user._id,
    role,
    status: 'INVITED',
  });

  await recordAudit({
    organizationId,
    ...(req.user?.id ? { actorId: req.user.id } : {}),
    action: 'organization.member_invite',
    resourceType: 'Membership',
    resourceId: String(membership._id),
    requestId: req.requestId ?? 'unknown',
  });

  res.status(201);
  res.locals.data = {
    id: String(membership._id),
    userId: String(user._id),
    role: membership.role,
    status: membership.status,
  };
}

export async function updateMember(req: Request, res: Response): Promise<void> {
  const { organizationId, memberId } = req.params;
  const update: Record<string, unknown> = {};
  if (req.body.role) update.role = req.body.role;
  if (req.body.status) update.status = req.body.status;

  const membership = await Membership.findOneAndUpdate(
    { _id: memberId, organizationId },
    { $set: update },
    { new: true },
  );
  if (!membership) throw notFound('Membre');

  await recordAudit({
    organizationId,
    ...(req.user?.id ? { actorId: req.user.id } : {}),
    action: 'organization.member_update',
    resourceType: 'Membership',
    resourceId: String(membership._id),
    requestId: req.requestId ?? 'unknown',
  });

  res.locals.data = {
    id: String(membership._id),
    role: membership.role,
    status: membership.status,
  };
}

export async function removeMember(req: Request, res: Response): Promise<void> {
  const { organizationId, memberId } = req.params;
  const membership = await Membership.findOneAndUpdate(
    { _id: memberId, organizationId },
    { $set: { status: 'REMOVED' } },
    { new: true },
  );
  if (!membership) throw notFound('Membre');

  await recordAudit({
    organizationId,
    ...(req.user?.id ? { actorId: req.user.id } : {}),
    action: 'organization.member_remove',
    resourceType: 'Membership',
    resourceId: String(membership._id),
    requestId: req.requestId ?? 'unknown',
  });

  res.locals.data = { id: String(membership._id), removed: true };
}
