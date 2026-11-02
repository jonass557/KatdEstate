import mongoose, { Schema, model, type InferSchemaType, type Model, type Types } from 'mongoose';
const models = mongoose.models;
import {
  IDENTITY_DOCUMENT_TYPES,
  LEASE_FREQUENCIES,
  LEASE_STATUSES,
  PENALTY_TYPES,
  SIGNATURE_STATUSES,
  TENANT_STATUSES,
} from '@rentflow/shared';

const timestamps = true;
const org = { type: Schema.Types.ObjectId, ref: 'Organization', required: true } as const;

const tenantSchema = new Schema(
  {
    organizationId: org,
    firstName: { type: String, trim: true, maxlength: 80 },
    lastName: { type: String, trim: true, maxlength: 80 },
    fullName: { type: String, required: true, trim: true, maxlength: 160 },
    phone: { type: String, maxlength: 32 },
    email: { type: String, maxlength: 160 },
    address: { type: String, maxlength: 240 },
    identityDocumentType: { type: String, enum: IDENTITY_DOCUMENT_TYPES },
    /** Numéro de pièce chiffré (AES-256-GCM). Jamais renvoyé en clair par défaut. */
    identityDocumentNumberEnc: { type: String, select: false },
    birthDate: { type: Date },
    emergencyContactName: { type: String, maxlength: 160 },
    emergencyContactPhone: { type: String, maxlength: 32 },
    profession: { type: String, maxlength: 120 },
    documents: { type: [{ fileId: { type: Schema.Types.ObjectId, ref: 'StoredFile' } }], default: [] },
    notes: { type: String, maxlength: 4_000 },
    status: { type: String, enum: TENANT_STATUSES, default: 'ACTIVE', index: true },
    /** Utilisateur lié, pour l'espace locataire. Absent tant qu'aucun accès n'est créé. */
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date },
  },
  { timestamps },
);
tenantSchema.index({ organizationId: 1, fullName: 1 }, { name: 'tenants_org_name' });
tenantSchema.index({ organizationId: 1, userId: 1 }, { name: 'tenants_org_user' });

const leaseSchema = new Schema(
  {
    organizationId: org,
    number: { type: String, required: true },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    unitId: { type: Schema.Types.ObjectId, ref: 'Unit', required: true },
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property', required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User' },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    rentAmountMinor: { type: Number, required: true, min: 0 },
    depositAmountMinor: { type: Number, required: true, min: 0, default: 0 },
    chargesAmountMinor: { type: Number, required: true, min: 0, default: 0 },
    currency: { type: String, required: true, uppercase: true, length: 3 },
    frequency: { type: String, enum: LEASE_FREQUENCIES, default: 'MONTHLY' },
    dueDay: { type: Number, required: true, min: 1, max: 28 },
    penalty: {
      type: { type: String, enum: PENALTY_TYPES, default: 'NONE' },
      value: { type: Number, default: 0 },
      graceDays: { type: Number, default: 0 },
    },
    terms: { type: String, maxlength: 8_000 },
    status: { type: String, enum: LEASE_STATUSES, default: 'DRAFT', index: true },
    /** Contrat précédent, quand celui-ci est un renouvellement. */
    renewedFromId: { type: Schema.Types.ObjectId, ref: 'Lease' },
    terminationDate: { type: Date },
    terminationReason: { type: String, maxlength: 500 },
    /** Préparé pour une signature électronique ; aucun fournisseur n'est branché. */
    signature: {
      status: { type: String, enum: SIGNATURE_STATUSES, default: 'NOT_REQUESTED' },
      requestedAt: { type: Date },
      signedAt: { type: Date },
      documentHash: { type: String },
    },
    deletedAt: { type: Date },
  },
  { timestamps },
);
leaseSchema.index({ organizationId: 1, number: 1 }, { unique: true, name: 'leases_org_number_unique' });
leaseSchema.index({ organizationId: 1, status: 1, endDate: 1 }, { name: 'leases_org_status_end' });
leaseSchema.index({ organizationId: 1, unitId: 1, status: 1 }, { name: 'leases_org_unit_status' });

export type TenantDocument = InferSchemaType<typeof tenantSchema> & { _id: Types.ObjectId };
export type LeaseDocument = InferSchemaType<typeof leaseSchema> & { _id: Types.ObjectId };

export const Tenant =
  (models.Tenant as Model<TenantDocument>) ?? model<TenantDocument>('Tenant', tenantSchema);
export const Lease = (models.Lease as Model<LeaseDocument>) ?? model<LeaseDocument>('Lease', leaseSchema);
