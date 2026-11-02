import mongoose, { Schema, model, type InferSchemaType, type Model, type Types } from 'mongoose';
const models = mongoose.models;

/**
 * Modèles ajoutés par le plan du 23/09.
 *
 * Documents, disposition du tableau de bord, conversations IA, abonnements,
 * feature flags et tickets de support. Chaque collection reste scopée à une
 * organisation, sauf les réglages de plateforme (plans, flags).
 */

const timestamps = true;
const org = { type: Schema.Types.ObjectId, ref: 'Organization', required: true } as const;

const DOCUMENT_TYPES = ['LEASE_CONTRACT', 'IDENTITY', 'RECEIPT', 'INVOICE', 'PAYMENT_RECEIPT', 'INSURANCE', 'VENDOR_INVOICE', 'OTHER'] as const;

const documentFolderSchema = new Schema(
  {
    organizationId: org,
    parentId: { type: Schema.Types.ObjectId, ref: 'DocumentFolder' },
    name: { type: String, required: true, maxlength: 160 },
    resourceType: { type: String, maxlength: 40 },
    resourceId: { type: Schema.Types.ObjectId },
    deletedAt: { type: Date },
  },
  { timestamps },
);
documentFolderSchema.index({ organizationId: 1, parentId: 1 }, { name: 'folders_org_parent' });

const documentSchema = new Schema(
  {
    organizationId: org,
    folderId: { type: Schema.Types.ObjectId, ref: 'DocumentFolder' },
    type: { type: String, enum: DOCUMENT_TYPES, required: true },
    category: { type: String, default: 'OTHER' },
    title: { type: String, required: true, maxlength: 200 },
    fileId: { type: Schema.Types.ObjectId, ref: 'StoredFile', required: true },
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property' },
    unitId: { type: Schema.Types.ObjectId, ref: 'Unit' },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant' },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User' },
    tags: { type: [String], default: [] },
    size: { type: Number, default: 0 },
    expiresAt: { type: Date },
    version: { type: Number, required: true, default: 1 },
    isArchived: { type: Boolean, default: false },
    signature: {
      status: { type: String, enum: ['NOT_REQUESTED', 'PENDING', 'SIGNED'], default: 'NOT_REQUESTED' },
      requestedAt: { type: Date },
      signedAt: { type: Date },
      documentHash: { type: String },
    },
    deletedAt: { type: Date },
  },
  { timestamps },
);
documentSchema.index({ organizationId: 1, expiresAt: 1 }, { name: 'documents_org_expiry' });
documentSchema.index({ organizationId: 1, category: 1 }, { name: 'documents_org_category' });
documentSchema.index({ organizationId: 1, propertyId: 1 }, { name: 'documents_org_property' });

const documentVersionSchema = new Schema(
  {
    organizationId: org,
    documentId: { type: Schema.Types.ObjectId, ref: 'Document', required: true },
    fileId: { type: Schema.Types.ObjectId, ref: 'StoredFile', required: true },
    version: { type: Number, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const dashboardLayoutSchema = new Schema(
  {
    organizationId: org,
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    widgets: { type: [String], default: [] },
    hidden: { type: [String], default: [] },
  },
  { timestamps },
);
dashboardLayoutSchema.index({ organizationId: 1, userId: 1 }, { unique: true, name: 'layouts_org_user_unique' });

const aiConversationSchema = new Schema(
  {
    organizationId: org,
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    messages: {
      type: [{ role: { type: String, enum: ['user', 'assistant'] }, content: String, tools: [String] }],
      default: [],
    },
  },
  { timestamps },
);

const aiUsageSchema = new Schema(
  {
    organizationId: org,
    model: { type: String, required: true },
    tokens: { type: Number, required: true, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const PLAN_CODES = ['FREE_TRIAL', 'PRO', 'BUSINESS', 'ENTERPRISE'] as const;
const planSchema = new Schema(
  {
    code: { type: String, enum: PLAN_CODES, required: true, unique: true },
    priceMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, uppercase: true, length: 3 },
    trialDays: { type: Number, required: true, min: 0 },
    limits: {
      properties: { type: Number, required: true },
      users: { type: Number, required: true },
      units: { type: Number, required: true },
    },
    features: { type: [String], default: [] },
  },
  { timestamps },
);

const subscriptionSchema = new Schema(
  {
    organizationId: org,
    planCode: { type: String, enum: PLAN_CODES, required: true },
    status: { type: String, enum: ['TRIALING', 'ACTIVE', 'CANCELLED'], default: 'TRIALING' },
    trialEndsAt: { type: Date },
  },
  { timestamps },
);

const featureFlagSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    enabled: { type: Boolean, required: true, default: false },
    description: { type: String, maxlength: 240 },
  },
  { timestamps },
);

const supportTicketSchema = new Schema(
  {
    organizationId: org,
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: String, required: true, maxlength: 200 },
    status: { type: String, enum: ['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'], default: 'OPEN' },
    messages: { type: [{ authorId: Schema.Types.ObjectId, body: String, createdAt: Date }], default: [] },
  },
  { timestamps },
);

export type DocumentFolderDocument = InferSchemaType<typeof documentFolderSchema> & { _id: Types.ObjectId };
export type PlatformDocument = InferSchemaType<typeof documentSchema> & { _id: Types.ObjectId };
export type DocumentVersionDocument = InferSchemaType<typeof documentVersionSchema> & { _id: Types.ObjectId };
export type DashboardLayoutDocument = InferSchemaType<typeof dashboardLayoutSchema> & { _id: Types.ObjectId };
export type AIConversationDocument = InferSchemaType<typeof aiConversationSchema> & { _id: Types.ObjectId };
export type AIUsageDocument = InferSchemaType<typeof aiUsageSchema> & { _id: Types.ObjectId };
export type PlanDocument = InferSchemaType<typeof planSchema> & { _id: Types.ObjectId };
export type SubscriptionDocument = InferSchemaType<typeof subscriptionSchema> & { _id: Types.ObjectId };
export type FeatureFlagDocument = InferSchemaType<typeof featureFlagSchema> & { _id: Types.ObjectId };
export type SupportTicketDocument = InferSchemaType<typeof supportTicketSchema> & { _id: Types.ObjectId };

function modelOf<T>(name: string, schema: Schema): Model<T> {
  return (models[name] as Model<T> | undefined) ?? model<T>(name, schema);
}

export const DocumentFolder = modelOf<DocumentFolderDocument>('DocumentFolder', documentFolderSchema);
export const PlatformDocumentModel = modelOf<PlatformDocument>('PlatformDocument', documentSchema);
export const DocumentVersion = modelOf<DocumentVersionDocument>('DocumentVersion', documentVersionSchema);
export const DashboardLayout = modelOf<DashboardLayoutDocument>('DashboardLayout', dashboardLayoutSchema);
export const AIConversation = modelOf<AIConversationDocument>('AIConversation', aiConversationSchema);
export const AIUsage = modelOf<AIUsageDocument>('AIUsage', aiUsageSchema);
export const Plan = modelOf<PlanDocument>('Plan', planSchema);
export const Subscription = modelOf<SubscriptionDocument>('Subscription', subscriptionSchema);
export const FeatureFlag = modelOf<FeatureFlagDocument>('FeatureFlag', featureFlagSchema);
export const SupportTicket = modelOf<SupportTicketDocument>('SupportTicket', supportTicketSchema);

export const FEATURE_FLAGS = ['AI_ASSISTANT', 'WHATSAPP', 'SMS', 'ADVANCED_REPORTS', 'MULTI_PROPERTY'] as const;
export const DOCUMENT_TYPE_VALUES = DOCUMENT_TYPES;
export const PLAN_CODE_VALUES = PLAN_CODES;
