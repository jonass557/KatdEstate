import mongoose, { Schema, model, type InferSchemaType, type Model, type Types } from 'mongoose';
const models = mongoose.models;
import {
  ANNOUNCEMENT_SCOPES,
  ANNOUNCEMENT_TYPES,
  CENSUS_STATUSES,
  INCIDENT_CATEGORIES,
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
  QUARTIER_PLAN_CODES,
  RESIDENCE_OCCUPANCY_STATUSES,
  RESIDENCE_TYPES,
} from '@rentflow/shared';

const timestamps = true;

// 1. Découpage Territorial & Administratif
const geoCitySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    region: { type: String, trim: true, maxlength: 120 },
    country: { type: String, required: true, uppercase: true, length: 2, default: 'SN' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps },
);
geoCitySchema.index({ name: 1, country: 1 }, { unique: true });

const geoDistrictSchema = new Schema(
  {
    cityId: { type: Schema.Types.ObjectId, ref: 'GeoCity', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    code: { type: String, trim: true, uppercase: true, maxlength: 20 },
  },
  { timestamps },
);
geoDistrictSchema.index({ cityId: 1, name: 1 }, { unique: true });

const geoNeighborhoodSchema = new Schema(
  {
    cityId: { type: Schema.Types.ObjectId, ref: 'GeoCity', required: true, index: true },
    districtId: { type: Schema.Types.ObjectId, ref: 'GeoDistrict', index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    code: { type: String, trim: true, uppercase: true, maxlength: 20 },
    leaderId: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps },
);
geoNeighborhoodSchema.index({ cityId: 1, name: 1 });

const geoBlockSchema = new Schema(
  {
    neighborhoodId: {
      type: Schema.Types.ObjectId,
      ref: 'GeoNeighborhood',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 30 },
    blockLeaderId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    registrationToken: { type: String, required: true, unique: true, index: true },
    description: { type: String, maxlength: 1_000 },
    boundaryCoordinates: {
      type: [{ lat: Number, lng: Number }],
      default: [],
    },
    stats: {
      totalResidences: { type: Number, default: 0 },
      totalDwellings: { type: Number, default: 0 },
      occupiedResidences: { type: Number, default: 0 },
      vacantResidences: { type: Number, default: 0 },
      totalResidentsDeclared: { type: Number, default: 0 },
      pendingValidations: { type: Number, default: 0 },
    },
  },
  { timestamps },
);
geoBlockSchema.index({ neighborhoodId: 1, code: 1 }, { unique: true });

// 2. Affectation de Responsable de Secteur (Chef de Quartier / Chef de Bloc)
const sectorAssignmentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ['NEIGHBORHOOD_LEADER', 'BLOCK_LEADER'], required: true },
    cityId: { type: Schema.Types.ObjectId, ref: 'GeoCity', required: true },
    districtId: { type: Schema.Types.ObjectId, ref: 'GeoDistrict' },
    neighborhoodId: { type: Schema.Types.ObjectId, ref: 'GeoNeighborhood', required: true },
    blockId: { type: Schema.Types.ObjectId, ref: 'GeoBlock' },
    status: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED', 'TRANSFERRED'],
      default: 'ACTIVE',
      index: true,
    },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },
    notes: { type: String, maxlength: 1_000 },
    history: {
      type: [
        {
          action: { type: String, required: true },
          performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
          date: { type: Date, default: Date.now },
          note: { type: String },
        },
      ],
      default: [],
    },
  },
  { timestamps },
);
sectorAssignmentSchema.index({ userId: 1, status: 1 });

// 3. Résidence Recensée
const quartierResidenceSchema = new Schema(
  {
    residenceDomoraId: { type: String, required: true, unique: true, uppercase: true, index: true },
    cityId: { type: Schema.Types.ObjectId, ref: 'GeoCity', required: true, index: true },
    districtId: { type: Schema.Types.ObjectId, ref: 'GeoDistrict' },
    neighborhoodId: {
      type: Schema.Types.ObjectId,
      ref: 'GeoNeighborhood',
      required: true,
      index: true,
    },
    blockId: { type: Schema.Types.ObjectId, ref: 'GeoBlock', required: true, index: true },
    buildingType: { type: String, enum: RESIDENCE_TYPES, required: true },
    address: { type: String, required: true, trim: true, maxlength: 240 },
    landmark: { type: String, trim: true, maxlength: 240 },
    locationGeo: {
      lat: { type: Number },
      lng: { type: Number },
    },
    dwellingsCount: { type: Number, required: true, default: 1, min: 1 },
    occupancyStatus: {
      type: String,
      enum: RESIDENCE_OCCUPANCY_STATUSES,
      default: 'OCCUPIED',
      index: true,
    },
    censusStatus: {
      type: String,
      enum: CENSUS_STATUSES,
      default: 'PENDING',
      index: true,
    },
    registeredBy: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    registeredRole: {
      type: String,
      enum: ['BLOCK_LEADER', 'RESIDENT', 'SUPER_ADMIN'],
      required: true,
    },
    validatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    validatedAt: { type: Date },
    rejectionReason: { type: String, maxlength: 1_000 },
    ownerName: { type: String, trim: true, maxlength: 160 },
    ownerPhone: { type: String, trim: true, maxlength: 32 },
    notes: { type: String, maxlength: 2_000 },
    deletedAt: { type: Date },
  },
  { timestamps },
);
quartierResidenceSchema.index({ blockId: 1, address: 1 });
quartierResidenceSchema.index({ neighborhoodId: 1, censusStatus: 1 });

// 4. Logements d'un immeuble (Dwelling)
const quartierDwellingSchema = new Schema(
  {
    residenceId: {
      type: Schema.Types.ObjectId,
      ref: 'QuartierResidence',
      required: true,
      index: true,
    },
    dwellingNumber: { type: String, required: true, trim: true, maxlength: 80 },
    floor: { type: Number },
    occupancyStatus: { type: String, enum: RESIDENCE_OCCUPANCY_STATUSES, default: 'OCCUPIED' },
    roomsCount: { type: Number, min: 1 },
  },
  { timestamps },
);
quartierDwellingSchema.index({ residenceId: 1, dwellingNumber: 1 }, { unique: true });

// 5. Foyer & Habitant (Déclaration Privacy-first)
const residentHouseholdSchema = new Schema(
  {
    residenceId: {
      type: Schema.Types.ObjectId,
      ref: 'QuartierResidence',
      required: true,
      index: true,
    },
    dwellingId: { type: Schema.Types.ObjectId, ref: 'QuartierDwelling', index: true },
    blockId: { type: Schema.Types.ObjectId, ref: 'GeoBlock', required: true, index: true },
    neighborhoodId: {
      type: Schema.Types.ObjectId,
      ref: 'GeoNeighborhood',
      required: true,
      index: true,
    },
    headOfHouseholdId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    fullName: { type: String, required: true, trim: true, maxlength: 160 },
    phone: { type: String, required: true, trim: true, maxlength: 32 },
    email: { type: String, trim: true, lowercase: true, maxlength: 160 },
    householdSize: { type: Number, required: true, default: 1, min: 1 },
    minorsCount: { type: Number, default: 0, min: 0 },
    arrivalDate: { type: Date },
    emergencyContact: {
      name: { type: String, trim: true, maxlength: 160 },
      phone: { type: String, trim: true, maxlength: 32 },
    },
    consentAccepted: { type: Boolean, required: true, default: true },
    isMovedOut: { type: Boolean, default: false, index: true },
    movedOutDate: { type: Date },
  },
  { timestamps },
);
residentHouseholdSchema.index({ blockId: 1, isMovedOut: 1 });

// 6. Demandes de Recensement & Workflow
const censusSubmissionSchema = new Schema(
  {
    residenceId: {
      type: Schema.Types.ObjectId,
      ref: 'QuartierResidence',
      required: true,
      index: true,
    },
    householdId: { type: Schema.Types.ObjectId, ref: 'ResidentHousehold', index: true },
    blockId: { type: Schema.Types.ObjectId, ref: 'GeoBlock', required: true, index: true },
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    submissionType: {
      type: String,
      enum: ['SELF_REGISTRATION', 'CHEF_REGISTRATION'],
      default: 'SELF_REGISTRATION',
    },
    status: {
      type: String,
      enum: ['PENDING', 'VALIDATED', 'REJECTED', 'DISPUTED'],
      default: 'PENDING',
      index: true,
    },
    decisionNote: { type: String, maxlength: 1_000 },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
  },
  { timestamps },
);
censusSubmissionSchema.index({ blockId: 1, status: 1 });

// 7. Signalements & Sécurité Communautaire (Incident Report)
const incidentReportSchema = new Schema(
  {
    incidentNumber: { type: String, required: true, unique: true, uppercase: true, index: true },
    category: { type: String, enum: INCIDENT_CATEGORIES, required: true, index: true },
    description: { type: String, required: true, maxlength: 4_000 },
    severity: { type: String, enum: INCIDENT_SEVERITIES, default: 'MEDIUM', index: true },
    neighborhoodId: {
      type: Schema.Types.ObjectId,
      ref: 'GeoNeighborhood',
      required: true,
      index: true,
    },
    blockId: { type: Schema.Types.ObjectId, ref: 'GeoBlock', index: true },
    locationText: { type: String, trim: true, maxlength: 240 },
    photoUrl: { type: String, trim: true },
    isAnonymous: { type: Boolean, default: false },
    reporterId: { type: Schema.Types.ObjectId, ref: 'User' },
    reporterName: { type: String, trim: true, maxlength: 160 },
    reporterPhone: { type: String, trim: true, maxlength: 32 },
    status: { type: String, enum: INCIDENT_STATUSES, default: 'NEW', index: true },
    resolutionNotes: { type: String, maxlength: 2_000 },
    handledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    handledAt: { type: Date },
  },
  { timestamps },
);
incidentReportSchema.index({ neighborhoodId: 1, status: 1 });

// 8. Communications & Annonces Communautaires
const communityAnnouncementSchema = new Schema(
  {
    scope: { type: String, enum: ANNOUNCEMENT_SCOPES, default: 'BLOCK', required: true },
    type: { type: String, enum: ANNOUNCEMENT_TYPES, default: 'INFO', required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 4_000 },
    neighborhoodId: {
      type: Schema.Types.ObjectId,
      ref: 'GeoNeighborhood',
      required: true,
      index: true,
    },
    blockId: { type: Schema.Types.ObjectId, ref: 'GeoBlock', index: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    authorRole: {
      type: String,
      enum: ['NEIGHBORHOOD_LEADER', 'BLOCK_LEADER', 'SUPER_ADMIN'],
      required: true,
    },
    eventDate: { type: Date },
  },
  { timestamps },
);
communityAnnouncementSchema.index({ neighborhoodId: 1, scope: 1, createdAt: -1 });

// 9. Annuaire d'Urgence Local
const emergencyContactSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    serviceType: { type: String, required: true, maxlength: 80 },
    phone: { type: String, required: true, trim: true, maxlength: 32 },
    shortNumber: { type: String, trim: true, maxlength: 10 },
    cityId: { type: Schema.Types.ObjectId, ref: 'GeoCity', index: true },
    districtId: { type: Schema.Types.ObjectId, ref: 'GeoDistrict' },
    neighborhoodId: { type: Schema.Types.ObjectId, ref: 'GeoNeighborhood', index: true },
  },
  { timestamps },
);

// 10. Formules d'Abonnement Chefs de Secteur
const quartierPlanSchema = new Schema(
  {
    code: { type: String, enum: QUARTIER_PLAN_CODES, required: true, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    priceMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, uppercase: true, length: 3, default: 'XOF' },
    durationMonths: { type: Number, required: true, default: 1 },
    maxBlocks: { type: Number, required: true, default: 1 },
    maxResidences: { type: Number, required: true, default: 500 },
    maxSecondaryLeaders: { type: Number, required: true, default: 0 },
    maxAnnouncementsPerMonth: { type: Number, required: true, default: 30 },
    advancedReports: { type: Boolean, required: true, default: false },
    interactiveMap: { type: Boolean, required: true, default: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps },
);

const quartierSubscriptionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ['NEIGHBORHOOD_LEADER', 'BLOCK_LEADER'], required: true },
    planCode: { type: String, enum: QUARTIER_PLAN_CODES, required: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'EXPIRED', 'SUSPENDED'],
      default: 'ACTIVE',
      index: true,
    },
    period: { type: String, enum: ['MONTHLY', 'QUARTERLY', 'YEARLY'], default: 'MONTHLY' },
    expiresAt: { type: Date, required: true },
    paymentsHistory: [
      {
        amountMinor: Number,
        currency: String,
        date: { type: Date, default: Date.now },
        reference: String,
        method: String,
      },
    ],
  },
  { timestamps },
);

export type GeoCityDocument = InferSchemaType<typeof geoCitySchema> & { _id: Types.ObjectId };
export type GeoDistrictDocument = InferSchemaType<typeof geoDistrictSchema> & {
  _id: Types.ObjectId;
};
export type GeoNeighborhoodDocument = InferSchemaType<typeof geoNeighborhoodSchema> & {
  _id: Types.ObjectId;
};
export type GeoBlockDocument = InferSchemaType<typeof geoBlockSchema> & { _id: Types.ObjectId };
export type SectorAssignmentDocument = InferSchemaType<typeof sectorAssignmentSchema> & {
  _id: Types.ObjectId;
};
export type QuartierResidenceDocument = InferSchemaType<typeof quartierResidenceSchema> & {
  _id: Types.ObjectId;
};
export type QuartierDwellingDocument = InferSchemaType<typeof quartierDwellingSchema> & {
  _id: Types.ObjectId;
};
export type ResidentHouseholdDocument = InferSchemaType<typeof residentHouseholdSchema> & {
  _id: Types.ObjectId;
};
export type CensusSubmissionDocument = InferSchemaType<typeof censusSubmissionSchema> & {
  _id: Types.ObjectId;
};
export type IncidentReportDocument = InferSchemaType<typeof incidentReportSchema> & {
  _id: Types.ObjectId;
};
export type CommunityAnnouncementDocument = InferSchemaType<typeof communityAnnouncementSchema> & {
  _id: Types.ObjectId;
};
export type EmergencyContactDocument = InferSchemaType<typeof emergencyContactSchema> & {
  _id: Types.ObjectId;
};
export type QuartierPlanDocument = InferSchemaType<typeof quartierPlanSchema> & {
  _id: Types.ObjectId;
};
export type QuartierSubscriptionDocument = InferSchemaType<typeof quartierSubscriptionSchema> & {
  _id: Types.ObjectId;
};

function modelOf<T>(name: string, schema: Schema): Model<T> {
  return (models[name] as Model<T> | undefined) ?? model<T>(name, schema);
}

export const GeoCity = modelOf<GeoCityDocument>('GeoCity', geoCitySchema);
export const GeoDistrict = modelOf<GeoDistrictDocument>('GeoDistrict', geoDistrictSchema);
export const GeoNeighborhood = modelOf<GeoNeighborhoodDocument>(
  'GeoNeighborhood',
  geoNeighborhoodSchema,
);
export const GeoBlock = modelOf<GeoBlockDocument>('GeoBlock', geoBlockSchema);
export const SectorAssignment = modelOf<SectorAssignmentDocument>(
  'SectorAssignment',
  sectorAssignmentSchema,
);
export const QuartierResidence = modelOf<QuartierResidenceDocument>(
  'QuartierResidence',
  quartierResidenceSchema,
);
export const QuartierDwelling = modelOf<QuartierDwellingDocument>(
  'QuartierDwelling',
  quartierDwellingSchema,
);
export const ResidentHousehold = modelOf<ResidentHouseholdDocument>(
  'ResidentHousehold',
  residentHouseholdSchema,
);
export const CensusSubmission = modelOf<CensusSubmissionDocument>(
  'CensusSubmission',
  censusSubmissionSchema,
);
export const IncidentReport = modelOf<IncidentReportDocument>(
  'IncidentReport',
  incidentReportSchema,
);
export const CommunityAnnouncement = modelOf<CommunityAnnouncementDocument>(
  'CommunityAnnouncement',
  communityAnnouncementSchema,
);
export const EmergencyContact = modelOf<EmergencyContactDocument>(
  'EmergencyContact',
  emergencyContactSchema,
);
export const QuartierPlan = modelOf<QuartierPlanDocument>('QuartierPlan', quartierPlanSchema);
export const QuartierSubscription = modelOf<QuartierSubscriptionDocument>(
  'QuartierSubscription',
  quartierSubscriptionSchema,
);
