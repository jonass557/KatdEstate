import mongoose, { Schema, model, type InferSchemaType, type Model, type Types } from 'mongoose';
const models = mongoose.models;
import {
  AGENT_PLAN_CODES,
  AGENT_TYPES,
  AGENT_VERIFICATION_STATUSES,
  COMMISSION_STATUSES,
  COMMISSION_TYPES,
  LEAD_STATUSES,
  LISTING_STATUSES,
  LISTING_TRANSACTION_TYPES,
  MANDATE_STATUSES,
  MANDATE_TYPES,
  MARKETPLACE_PROPERTY_CATEGORIES,
  MARKETPLACE_PROPERTY_TYPES,
  OFFER_STATUSES,
  VIEWING_STATUSES,
} from '@rentflow/shared';

const timestamps = true;

// 1. Profil professionnel de l'Agent Immobilier
const agentProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization' },
    firstName: { type: String, required: true, trim: true, maxlength: 120 },
    lastName: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 32 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
    city: { type: String, required: true, trim: true, maxlength: 120 },
    country: { type: String, required: true, uppercase: true, length: 2, default: 'SN' },
    activityZone: { type: String, trim: true, maxlength: 160 },
    bio: { type: String, maxlength: 4_000 },
    experienceYears: { type: Number, default: 0, min: 0 },
    specialties: { type: [String], default: [] },
    agencyName: { type: String, trim: true, maxlength: 160 },
    agentType: { type: String, enum: AGENT_TYPES, default: 'INDEPENDENT', required: true },
    photoUrl: { type: String, trim: true },
    documents: {
      type: [{ name: { type: String, required: true }, url: { type: String, required: true } }],
      default: [],
    },
    verificationStatus: {
      type: String,
      enum: AGENT_VERIFICATION_STATUSES,
      default: 'UNVERIFIED',
      index: true,
    },
    verifiedAt: { type: Date },
    rejectionReason: { type: String, maxlength: 1_000 },
    rating: { type: Number, default: 5.0, min: 1.0, max: 5.0 },
    reviewCount: { type: Number, default: 0, min: 0 },
    activeSubscriptionPlan: {
      type: String,
      enum: AGENT_PLAN_CODES,
      default: 'AGENT_FREE',
    },
    subscriptionExpiresAt: { type: Date },
  },
  { timestamps },
);
agentProfileSchema.index({ city: 1, verificationStatus: 1 });
agentProfileSchema.index({ userId: 1 }, { unique: true });

// 2. Grille tarifaire d'abonnements des agents immobiliers (configurable Super Admin)
const agentPlanSchema = new Schema(
  {
    code: { type: String, enum: AGENT_PLAN_CODES, required: true, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    priceMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, uppercase: true, length: 3, default: 'XOF' },
    durationMonths: { type: Number, required: true, default: 1 },
    trialDays: { type: Number, required: true, default: 14 },
    maxActiveListings: { type: Number, required: true, default: 3 },
    maxPhotosPerListing: { type: Number, required: true, default: 5 },
    maxVideosPerListing: { type: Number, required: true, default: 0 },
    featuredListingsQuota: { type: Number, required: true, default: 0 },
    advancedAnalytics: { type: Boolean, required: true, default: false },
    leadManagement: { type: Boolean, required: true, default: false },
    maxCollaborators: { type: Number, required: true, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps },
);
agentPlanSchema.index({ code: 1 }, { unique: true });

// 3. Annonce immobilière (Listing)
const photoItemSchema = new Schema(
  {
    url: { type: String, required: true },
    isPrimary: { type: Boolean, default: false },
    caption: { type: String, maxlength: 160 },
  },
  { _id: false },
);

const listingSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization' },
    publisherId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    publisherRole: { type: String, enum: ['OWNER', 'AGENT', 'ADMIN'], required: true },
    agentProfileId: { type: Schema.Types.ObjectId, ref: 'AgentProfile' },
    mandateId: { type: Schema.Types.ObjectId, ref: 'Mandate' },
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property' },
    unitId: { type: Schema.Types.ObjectId, ref: 'Unit' },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 10_000 },
    category: { type: String, enum: MARKETPLACE_PROPERTY_CATEGORIES, required: true },
    propertyType: { type: String, enum: MARKETPLACE_PROPERTY_TYPES, required: true, index: true },
    transactionType: { type: String, enum: LISTING_TRANSACTION_TYPES, required: true, index: true },
    priceMinor: { type: Number, required: true, min: 0, index: true },
    currency: { type: String, required: true, uppercase: true, length: 3, default: 'XOF' },
    location: {
      country: { type: String, required: true, uppercase: true, length: 2, default: 'SN' },
      city: { type: String, required: true, trim: true, maxlength: 120, index: true },
      district: { type: String, trim: true, maxlength: 120 },
      address: { type: String, trim: true, maxlength: 240 },
      hideExactAddress: { type: Boolean, default: false },
    },
    surfaceM2: { type: Number, min: 0 },
    bedrooms: { type: Number, min: 0 },
    bathrooms: { type: Number, min: 0 },
    roomsCount: { type: Number, min: 0 },
    floorsCount: { type: Number, min: 0 },
    condition: { type: String, maxlength: 80 },
    availabilityDate: { type: Date },
    isTitled: { type: Boolean, default: false },
    landTitleNumber: { type: String, maxlength: 120 },
    amenities: { type: [String], default: [] },
    photos: { type: [photoItemSchema], default: [] },
    videos: { type: [String], default: [] },
    documents: {
      type: [{ name: { type: String, required: true }, url: { type: String, required: true } }],
      default: [],
    },
    status: {
      type: String,
      enum: LISTING_STATUSES,
      default: 'PENDING_REVIEW',
      index: true,
    },
    moderationComment: { type: String, maxlength: 1_000 },
    isVerified: { type: Boolean, default: false, index: true },
    isFeatured: { type: Boolean, default: false, index: true },
    viewsCount: { type: Number, default: 0, min: 0 },
    inquiriesCount: { type: Number, default: 0, min: 0 },
    deletedAt: { type: Date },
  },
  { timestamps },
);
listingSchema.index({ status: 1, transactionType: 1, priceMinor: 1 });
listingSchema.index({ 'location.city': 1, status: 1 });
listingSchema.index({ publisherId: 1, status: 1 });

// 4. Mandat Immobilier (Confier la gestion/commercialisation à un agent)
const mandateHistoryItemSchema = new Schema(
  {
    action: { type: String, required: true },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, default: Date.now },
    note: { type: String, maxlength: 1_000 },
  },
  { _id: false },
);

const mandateSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization' },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    agentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    agentProfileId: { type: Schema.Types.ObjectId, ref: 'AgentProfile' },
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property' },
    listingId: { type: Schema.Types.ObjectId, ref: 'Listing' },
    mandateType: { type: String, enum: MANDATE_TYPES, required: true },
    commissionType: { type: String, enum: COMMISSION_TYPES, default: 'PERCENTAGE', required: true },
    commissionRate: { type: Number, required: true, min: 0 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: MANDATE_STATUSES,
      default: 'PENDING',
      index: true,
    },
    authorizedRights: { type: [String], default: ['PUBLISH', 'NEGOTIATE', 'ORGANIZE_VIEWINGS'] },
    terms: { type: String, maxlength: 4_000 },
    documents: {
      type: [{ name: { type: String, required: true }, url: { type: String, required: true } }],
      default: [],
    },
    history: { type: [mandateHistoryItemSchema], default: [] },
  },
  { timestamps },
);
mandateSchema.index({ ownerId: 1, status: 1 });
mandateSchema.index({ agentId: 1, status: 1 });

// 5. CRM Prospects & Clients (Lead)
const leadSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization' },
    agentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    fullName: { type: String, required: true, trim: true, maxlength: 160 },
    phone: { type: String, required: true, trim: true, maxlength: 32 },
    email: { type: String, trim: true, lowercase: true, maxlength: 160 },
    searchType: { type: String, enum: ['BUY', 'RENT'], default: 'BUY' },
    budgetMinor: { type: Number, min: 0 },
    currency: { type: String, uppercase: true, length: 3, default: 'XOF' },
    targetCity: { type: String, trim: true, maxlength: 120 },
    targetDistrict: { type: String, trim: true, maxlength: 120 },
    targetPropertyType: { type: String, maxlength: 80 },
    status: { type: String, enum: LEAD_STATUSES, default: 'NEW', index: true },
    associatedListings: [{ type: Schema.Types.ObjectId, ref: 'Listing' }],
    notes: { type: String, maxlength: 4_000 },
    contactDate: { type: Date, default: Date.now },
  },
  { timestamps },
);
leadSchema.index({ agentId: 1, status: 1 });

// 6. Organisation des visites (Viewing)
const viewingSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization' },
    listingId: { type: Schema.Types.ObjectId, ref: 'Listing', required: true, index: true },
    agentId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    prospectName: { type: String, required: true, trim: true, maxlength: 160 },
    prospectPhone: { type: String, required: true, trim: true, maxlength: 32 },
    prospectEmail: { type: String, trim: true, lowercase: true, maxlength: 160 },
    date: { type: Date, required: true },
    status: {
      type: String,
      enum: VIEWING_STATUSES,
      default: 'SCHEDULED',
      index: true,
    },
    notes: { type: String, maxlength: 2_000 },
    feedback: { type: String, maxlength: 2_000 },
  },
  { timestamps },
);
viewingSchema.index({ listingId: 1, date: 1 });

// 7. Propositions & Négociations (Offer)
const offerSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization' },
    listingId: { type: Schema.Types.ObjectId, ref: 'Listing', required: true, index: true },
    buyerId: { type: Schema.Types.ObjectId, ref: 'User' },
    agentId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    prospectName: { type: String, required: true, trim: true, maxlength: 160 },
    prospectPhone: { type: String, required: true, trim: true, maxlength: 32 },
    prospectEmail: { type: String, trim: true, lowercase: true, maxlength: 160 },
    offeredAmountMinor: { type: Number, required: true, min: 1 },
    counterOfferAmountMinor: { type: Number, min: 1 },
    currency: { type: String, uppercase: true, length: 3, default: 'XOF' },
    status: {
      type: String,
      enum: OFFER_STATUSES,
      default: 'SUBMITTED',
      index: true,
    },
    message: { type: String, maxlength: 4_000 },
    ownerDecisionNote: { type: String, maxlength: 2_000 },
    decidedAt: { type: Date },
  },
  { timestamps },
);
offerSchema.index({ listingId: 1, status: 1 });

// 8. Commissions Immobilières
const commissionSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization' },
    mandateId: { type: Schema.Types.ObjectId, ref: 'Mandate' },
    listingId: { type: Schema.Types.ObjectId, ref: 'Listing' },
    agentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    transactionAmountMinor: { type: Number, required: true, min: 0 },
    commissionAmountMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, uppercase: true, length: 3, default: 'XOF' },
    status: {
      type: String,
      enum: COMMISSION_STATUSES,
      default: 'ESTIMATED',
      index: true,
    },
    paidAt: { type: Date },
    paymentReference: { type: String, maxlength: 120 },
    notes: { type: String, maxlength: 2_000 },
  },
  { timestamps },
);
commissionSchema.index({ agentId: 1, status: 1 });

export type AgentProfileDocument = InferSchemaType<typeof agentProfileSchema> & { _id: Types.ObjectId };
export type AgentPlanDocument = InferSchemaType<typeof agentPlanSchema> & { _id: Types.ObjectId };
export type ListingDocument = InferSchemaType<typeof listingSchema> & { _id: Types.ObjectId };
export type MandateDocument = InferSchemaType<typeof mandateSchema> & { _id: Types.ObjectId };
export type LeadDocument = InferSchemaType<typeof leadSchema> & { _id: Types.ObjectId };
export type ViewingDocument = InferSchemaType<typeof viewingSchema> & { _id: Types.ObjectId };
export type OfferDocument = InferSchemaType<typeof offerSchema> & { _id: Types.ObjectId };
export type CommissionDocument = InferSchemaType<typeof commissionSchema> & { _id: Types.ObjectId };

function modelOf<T>(name: string, schema: Schema): Model<T> {
  return (models[name] as Model<T> | undefined) ?? model<T>(name, schema);
}

export const AgentProfile = modelOf<AgentProfileDocument>('AgentProfile', agentProfileSchema);
export const AgentPlan = modelOf<AgentPlanDocument>('AgentPlan', agentPlanSchema);
export const Listing = modelOf<ListingDocument>('Listing', listingSchema);
export const Mandate = modelOf<MandateDocument>('Mandate', mandateSchema);
export const Lead = modelOf<LeadDocument>('Lead', leadSchema);
export const Viewing = modelOf<ViewingDocument>('Viewing', viewingSchema);
export const Offer = modelOf<OfferDocument>('Offer', offerSchema);
export const Commission = modelOf<CommissionDocument>('Commission', commissionSchema);
