import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { AuthSession, MembershipWithOrganization, Permission } from '@rentflow/shared';
import { resolvePermissions } from '@rentflow/shared';
import { AppError } from '../../common/errors.js';
import { dummyPasswordHash, hashPassword, verifyPassword } from '../../common/password.js';
import { generateRefreshToken, hashRefreshToken, refreshTokenExpiry, signAccessToken } from '../../common/tokens.js';
import { AuditLog, Membership, Organization, Session, User, VerificationToken } from '../../models/identity.js';
import type { AppConfig } from '../../config/index.js';
import { createEmailDelivery } from './email-delivery.js';

function publicUser(user: { _id: unknown; emailNormalized: string; displayName: string }) {
  return { id: String(user._id), email: user.emailNormalized, displayName: user.displayName };
}

export async function getSession(userId: string): Promise<AuthSession> {
  const user = await User.findById(userId).lean();
  if (!user) throw new AppError('UNAUTHENTICATED', 'Session invalide.', 401);
  const memberships = await Membership.find({ userId, status: 'ACTIVE' }).populate('organizationId').lean();
  const result: MembershipWithOrganization[] = [];
  for (const membership of memberships) {
    const organization = membership.organizationId as unknown as Record<string, unknown>;
    if (!organization?._id) continue;
    result.push({
      organizationId: String(organization._id),
      role: membership.role,
      permissions: resolvePermissions(membership.role, {
        granted: membership.grantedPermissions as Permission[],
        revoked: membership.revokedPermissions as Permission[],
      }),
      status: membership.status,
      organization: {
        id: String(organization._id),
        name: String(organization.name),
        slug: String(organization.slug),
        country: String(organization.country),
        currency: String(organization.currency),
        timezone: String(organization.timezone),
        locale: String(organization.locale),
      },
    });
  }
  return { user: publicUser(user), memberships: result };
}

function hashIp(ip?: string) {
  return ip ? createHash('sha256').update(ip).digest('hex') : undefined;
}

function hashOneTimeToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

async function createOneTimeToken(userId: string, purpose: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET', ttlMs: number) {
  const token = randomBytes(32).toString('base64url');
  await VerificationToken.create({
    userId,
    tokenHash: hashOneTimeToken(token),
    purpose,
    expiresAt: new Date(Date.now() + ttlMs),
  });
  return token;
}

async function issueTokens(userId: string, config: AppConfig, metadata: { userAgent?: string | undefined; ip?: string | undefined }, familyId: string = randomUUID()) {
  const refresh = generateRefreshToken();
  const session = await Session.create({
    userId,
    jti: randomUUID(),
    tokenHash: refresh.tokenHash,
    familyId,
    expiresAt: refreshTokenExpiry(config.tokens),
    userAgent: metadata.userAgent?.slice(0, 512),
    ipHash: hashIp(metadata.ip),
  });
  const access = signAccessToken({ userId, sessionId: String(session._id), jti: session.jti }, config.tokens);
  return {
    accessToken: access.token,
    expiresIn: access.expiresIn,
    refreshToken: refresh.token,
    session: await getSession(userId),
  };
}

export async function register(
  input: { email: string; password: string; displayName: string; role?: string; phone?: string },
  config: AppConfig,
  metadata: { userAgent?: string | undefined; ip?: string | undefined; requestId?: string }
) {
  const user = await User.create({
    emailNormalized: input.email.trim().toLowerCase(),
    displayName: input.displayName,
    passwordHash: await hashPassword(input.password),
    phone: input.phone,
  });
  const slug = `${input.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'organisation'}-${String(user._id).slice(-6)}`;
  const organization = await Organization.create({
    name: `${input.displayName} — Espace KadtEstate`,
    slug,
    country: 'CI',
    currency: 'XOF',
    timezone: 'Africa/Abidjan',
    locale: 'fr',
    phone: input.phone,
    email: input.email,
  });
  const roleToAssign = input.role || 'OWNER';
  await Membership.create({ userId: user._id, organizationId: organization._id, role: roleToAssign, status: 'ACTIVE' });
  await AuditLog.create({ actorId: user._id, action: 'auth.register', resourceType: 'User', resourceId: String(user._id), result: 'SUCCESS', requestId: metadata.requestId ?? 'system' });
  const verificationToken = await createOneTimeToken(
    String(user._id),
    'EMAIL_VERIFICATION',
    24 * 60 * 60 * 1_000,
  );
  await createEmailDelivery(config).sendVerificationEmail(input.email, verificationToken);
  return issueTokens(String(user._id), config, metadata);
}

export async function login(input: { email: string; password: string }, config: AppConfig, metadata: { userAgent?: string | undefined; ip?: string | undefined }) {
  const user = await User.findOne({ emailNormalized: input.email.trim().toLowerCase() }).select('+passwordHash').exec();
  const valid = await verifyPassword(user?.passwordHash ?? (await dummyPasswordHash()), input.password);
  if (!user || !valid || user.status !== 'ACTIVE') throw new AppError('UNAUTHENTICATED', 'Identifiants invalides.', 401);
  return issueTokens(String(user._id), config, metadata);
}

export async function refresh(token: string, config: AppConfig, metadata: { userAgent?: string | undefined; ip?: string | undefined }) {
  const session = await Session.findOne({ tokenHash: hashRefreshToken(token) }).select('+tokenHash').exec();
  if (!session) throw new AppError('UNAUTHENTICATED', 'Session invalide ou expirée.', 401);
  if (session.revokedAt || session.expiresAt <= new Date()) {
    await Session.updateMany({ familyId: session.familyId, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
    throw new AppError('UNAUTHENTICATED', 'Session invalide ou expirée.', 401);
  }
  session.revokedAt = new Date();
  await session.save();
  if (!session.familyId) throw new AppError('UNAUTHENTICATED', 'Session invalide ou expirée.', 401);
  return issueTokens(String(session.userId), config, metadata, session.familyId);
}

export async function logout(sessionId: string) {
  await Session.updateOne({ _id: sessionId, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
}

export async function requestPasswordReset(email: string, config: AppConfig): Promise<void> {
  const user = await User.findOne({ emailNormalized: email.trim().toLowerCase(), status: 'ACTIVE' }).select('_id emailNormalized').lean();
  if (!user) return;

  const resetToken = await createOneTimeToken(String(user._id), 'PASSWORD_RESET', 60 * 60 * 1_000);
  await createEmailDelivery(config).sendPasswordResetEmail(user.emailNormalized, resetToken);
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const tokenRecord = await VerificationToken.findOneAndUpdate(
    { tokenHash: hashOneTimeToken(token), purpose: 'PASSWORD_RESET', consumedAt: { $exists: false }, expiresAt: { $gt: new Date() } },
    { $set: { consumedAt: new Date() } },
    { new: true },
  ).lean();
  if (!tokenRecord) throw new AppError('UNAUTHENTICATED', 'Jeton invalide ou expiré.', 401);
  await User.updateOne({ _id: tokenRecord.userId, status: 'ACTIVE' }, { $set: { passwordHash: await hashPassword(password) } });
  await Session.updateMany({ userId: tokenRecord.userId, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
}

export async function verifyEmail(token: string): Promise<void> {
  const tokenRecord = await VerificationToken.findOneAndUpdate(
    { tokenHash: hashOneTimeToken(token), purpose: 'EMAIL_VERIFICATION', consumedAt: { $exists: false }, expiresAt: { $gt: new Date() } },
    { $set: { consumedAt: new Date() } },
    { new: true },
  ).lean();
  if (!tokenRecord) throw new AppError('UNAUTHENTICATED', 'Jeton invalide ou expiré.', 401);
  await User.updateOne({ _id: tokenRecord.userId, status: 'ACTIVE' }, { $set: { emailVerifiedAt: new Date() } });
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await User.findById(userId).select('+passwordHash').exec();
  if (!user || user.status !== 'ACTIVE') throw new AppError('UNAUTHENTICATED', 'Compte introuvable ou inactif.', 401);
  const valid = await verifyPassword(user.passwordHash, currentPassword);
  if (!valid) throw new AppError('UNAUTHENTICATED', 'Mot de passe actuel incorrect.', 401);
  user.passwordHash = await hashPassword(newPassword);
  await user.save();
}
