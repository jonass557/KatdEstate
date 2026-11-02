import mongoose, { Schema, model, type InferSchemaType, type Model, type Types } from 'mongoose';
const models = mongoose.models;
import type { Role } from '@rentflow/shared';

const timestamps = true;

const userSchema = new Schema(
  {
    emailNormalized: { type: String, required: true, unique: true, index: true, trim: true, lowercase: true },
    displayName: { type: String, required: true, trim: true, maxlength: 120 },
    passwordHash: { type: String, required: true, select: false },
    status: { type: String, enum: ['ACTIVE', 'SUSPENDED'], default: 'ACTIVE', index: true },
    emailVerifiedAt: { type: Date },
    /** Rôle plateforme. Jamais accordé par une invitation d'organisation. */
    platformRole: { type: String, enum: ['SUPER_ADMIN'] },
  },
  { timestamps },
);
userSchema.index({ emailNormalized: 1 }, { unique: true, name: 'users_email_unique' });

const organizationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, unique: true, index: true, trim: true, lowercase: true },
    country: { type: String, required: true, uppercase: true, length: 2 },
    currency: { type: String, required: true, uppercase: true, length: 3 },
    timezone: { type: String, required: true },
    locale: { type: String, required: true, default: 'fr' },
    logo: { type: String, trim: true, maxlength: 512 },
    address: { type: String, trim: true, maxlength: 240 },
    phone: { type: String, trim: true, maxlength: 32 },
    email: { type: String, trim: true, maxlength: 160 },
    notificationSettings: {
      emailRentReminder: { type: Boolean, default: true },
      smsRentReminder: { type: Boolean, default: false },
      whatsappRentReminder: { type: Boolean, default: false },
      emailMaintenanceAlert: { type: Boolean, default: true },
      reminderDaysBeforeDue: { type: Number, default: 5 },
    },
    billingSettings: {
      taxIdentificationNumber: { type: String, trim: true, maxlength: 64 },
      invoicePrefix: { type: String, trim: true, default: 'FACT-' },
      receiptPrefix: { type: String, trim: true, default: 'RECU-' },
      lateFeePercentage: { type: Number, default: 0 },
      defaultPaymentTermsDays: { type: Number, default: 5 },
    },
    status: { type: String, enum: ['ACTIVE', 'SUSPENDED'], default: 'ACTIVE', index: true },
  },
  { timestamps },
);
organizationSchema.index({ slug: 1 }, { unique: true, name: 'organizations_slug_unique' });

const membershipSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['ADMIN', 'OWNER', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'AGENT', 'TENANT'], required: true },
    grantedPermissions: { type: [String], default: [] },
    revokedPermissions: { type: [String], default: [] },
    status: { type: String, enum: ['INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED'], default: 'ACTIVE', index: true },
  },
  { timestamps },
);
membershipSchema.index({ organizationId: 1, userId: 1 }, { unique: true, name: 'memberships_org_user_unique' });
membershipSchema.index({ userId: 1, status: 1 }, { name: 'memberships_user_status' });

const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    jti: { type: String, required: true, unique: true },
    tokenHash: { type: String, required: true, select: false },
    familyId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    userAgent: { type: String, maxlength: 512 },
    ipHash: { type: String, maxlength: 128 },
  },
  { timestamps },
);
sessionSchema.index({ jti: 1 }, { unique: true, name: 'sessions_jti_unique' });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'sessions_expiry_ttl' });
sessionSchema.index({ userId: 1, revokedAt: 1 }, { name: 'sessions_user_revocation' });

const verificationTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, select: false },
    purpose: { type: String, enum: ['EMAIL_VERIFICATION', 'PASSWORD_RESET'], required: true },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date },
  },
  { timestamps },
);
verificationTokenSchema.index({ tokenHash: 1, purpose: 1 }, { unique: true, name: 'verification_tokens_hash_purpose_unique' });
verificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'verification_tokens_expiry_ttl' });

const auditLogSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', index: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    action: { type: String, required: true, maxlength: 120 },
    resourceType: { type: String, required: true, maxlength: 80 },
    resourceId: { type: String, maxlength: 120 },
    result: { type: String, enum: ['SUCCESS', 'FAILURE'], required: true },
    requestId: { type: String, required: true, maxlength: 96 },
    changes: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
auditLogSchema.index({ organizationId: 1, createdAt: -1 }, { name: 'audit_org_date' });
auditLogSchema.index({ actorId: 1, createdAt: -1 }, { name: 'audit_actor_date' });
auditLogSchema.pre('save', function (next) {
  if (!this.isNew) return next(new Error('Audit logs are append-only.'));
  next();
});

export type UserDocument = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };
export type OrganizationDocument = InferSchemaType<typeof organizationSchema> & { _id: Types.ObjectId };
export type MembershipDocument = InferSchemaType<typeof membershipSchema> & { _id: Types.ObjectId };
export type SessionDocument = InferSchemaType<typeof sessionSchema> & { _id: Types.ObjectId };
export type VerificationTokenDocument = InferSchemaType<typeof verificationTokenSchema> & { _id: Types.ObjectId };

export const User = (models.User as Model<UserDocument>) ?? model<UserDocument>('User', userSchema);
export const Organization = (models.Organization as Model<OrganizationDocument>) ?? model<OrganizationDocument>('Organization', organizationSchema);
export const Membership = (models.Membership as Model<MembershipDocument>) ?? model<MembershipDocument>('Membership', membershipSchema);
export const Session = (models.Session as Model<SessionDocument>) ?? model<SessionDocument>('Session', sessionSchema);
export const VerificationToken = (models.VerificationToken as Model<VerificationTokenDocument>) ?? model<VerificationTokenDocument>('VerificationToken', verificationTokenSchema);
export const AuditLog = (models.AuditLog as Model<InferSchemaType<typeof auditLogSchema>>) ?? model('AuditLog', auditLogSchema);

export function roleOfMembership(membership: MembershipDocument): Role {
  return membership.role as Role;
}
