import mongoose, { Schema, model, type Model, type Types } from 'mongoose';
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

const timestamps = true as const;

function createSchema(
  definition: mongoose.SchemaDefinition,
  options?: mongoose.SchemaOptions,
): Schema {
  return new Schema(definition, options);
}

// 1. Découpage Territorial & Administratif
const geoCitySchema: Schema = createSchema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    region: { type: String, trim: true, maxlength: 120 },
    country: { type: String, required: true, uppercase: true, length: 2, default: 'SN' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps },
);
geoCitySchema.index({ name: 1, country: 1 }, { unique: true });

const geoDistrictSchema: Schema = createSchema(
  {
    cityId: { type: Schema.Types.ObjectId, ref: 'GeoCity', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    code: { type: String, trim: true, uppercase: true, maxlength: 20 },
  },
  { timestamps },
);
geoDistrictSchema.index({ cityId: 1, name: 1 }, { unique: true });

export interface GeoJsonBoundaryDoc {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: unknown;
}

const geoJsonBoundarySubSchema: Schema = createSchema(
  {
    type: { type: String, enum: ['Polygon', 'MultiPolygon'], required: true },
    coordinates: { type: Schema.Types.Mixed, required: true },
  },
  { _id: false },
);

const geoNeighborhoodSchema: Schema = createSchema(
  {
    cityId: { type: Schema.Types.ObjectId, ref: 'GeoCity', required: true, index: true },
    districtId: { type: Schema.Types.ObjectId, ref: 'GeoDistrict', index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    code: { type: String, trim: true, uppercase: true, maxlength: 20 },
    leaderId: { type: Schema.Types.ObjectId, ref: 'User' },
    administrativeAddress: { type: String, trim: true, maxlength: 240 },
    region: { type: String, trim: true, maxlength: 120 },
    department: { type: String, trim: true, maxlength: 120 },
    arrondissement: { type: String, trim: true, maxlength: 120 },
    boundary: { type: geoJsonBoundarySubSchema },
  },
  { timestamps },
);
geoNeighborhoodSchema.index({ cityId: 1, name: 1 });
geoNeighborhoodSchema.index({ boundary: '2dsphere' }, { sparse: true });

const geoBlockSchema: Schema = createSchema(
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
    color: { type: String, trim: true, maxlength: 20, default: '#06b6d4' },
    isActive: { type: Boolean, default: true, index: true },
    boundary: { type: geoJsonBoundarySubSchema },
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
geoBlockSchema.index({ boundary: '2dsphere' }, { sparse: true });

// 1b. Zone géographique attribuée à un Propriétaire par son Chef de Bloc
const geoOwnerSchema: Schema = createSchema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    fullName: { type: String, required: true, trim: true, maxlength: 160 },
    phone: { type: String, required: true, trim: true, maxlength: 32 },
    email: { type: String, trim: true, lowercase: true, maxlength: 160 },
    blockId: { type: Schema.Types.ObjectId, ref: 'GeoBlock', required: true, index: true },
    neighborhoodId: {
      type: Schema.Types.ObjectId,
      ref: 'GeoNeighborhood',
      required: true,
      index: true,
    },
    assignedBoundary: { type: geoJsonBoundarySubSchema, required: true },
    status: { type: String, enum: ['ACTIVE', 'SUSPENDED'], default: 'ACTIVE', index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps },
);
geoOwnerSchema.index({ blockId: 1, fullName: 1 });
geoOwnerSchema.index({ assignedBoundary: '2dsphere' }, { sparse: true });

// 1c. Historique immuable des opérations géographiques
const geoAuditLogSchema: Schema = createSchema(
  {
    entityType: {
      type: String,
      enum: ['NEIGHBORHOOD', 'BLOCK', 'OWNER', 'PROPERTY'],
      required: true,
      index: true,
    },
    entityId: { type: String, required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', index: true },
    neighborhoodId: { type: Schema.Types.ObjectId, ref: 'GeoNeighborhood', index: true },
    blockId: { type: Schema.Types.ObjectId, ref: 'GeoBlock', index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'GeoOwner', index: true },
    action: {
      type: String,
      enum: ['CREATE_BOUNDARY', 'UPDATE_BOUNDARY', 'REASSIGN_ZONE', 'DEROGATION_GRANTED', 'DEACTIVATE'],
      required: true,
    },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    performedByName: { type: String, trim: true, maxlength: 160 },
    performedByRole: { type: String, trim: true, maxlength: 64 },
    previousBoundary: { type: Schema.Types.Mixed },
    newBoundary: { type: Schema.Types.Mixed },
    justification: { type: String, trim: true, maxlength: 1_000 },
  },
  { timestamps },
);
geoAuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

// 2. Affectation de Responsable de Secteur (Chef de Quartier / Chef de Bloc)
const sectorAssignmentSchema: Schema = createSchema(
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
const quartierResidenceSchema: Schema = createSchema(
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
const quartierDwellingSchema: Schema = createSchema(
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
const residentHouseholdSchema: Schema = createSchema(
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
const censusSubmissionSchema: Schema = createSchema(
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
const incidentReportSchema: Schema = createSchema(
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
const communityAnnouncementSchema: Schema = createSchema(
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
const emergencyContactSchema: Schema = createSchema(
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
const quartierPlanSchema: Schema = createSchema(
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

const quartierSubscriptionSchema: Schema = createSchema(
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

export interface GeoCityDocument {
  _id: Types.ObjectId;
  name: string;
  region?: string | null;
  country: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GeoDistrictDocument {
  _id: Types.ObjectId;
  cityId: Types.ObjectId;
  name: string;
  code?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
export interface GeoNeighborhoodDocument {
  _id: Types.ObjectId;
  cityId: Types.ObjectId;
  districtId?: Types.ObjectId | null;
  name: string;
  code?: string | null;
  leaderId?: Types.ObjectId | null;
  administrativeAddress?: string | null;
  region?: string | null;
  department?: string | null;
  arrondissement?: string | null;
  boundary?: GeoJsonBoundaryDoc | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GeoBlockDocument {
  _id: Types.ObjectId;
  neighborhoodId: Types.ObjectId;
  name: string;
  code: string;
  blockLeaderId?: Types.ObjectId | null;
  registrationToken: string;
  description?: string | null;
  color?: string | null;
  isActive: boolean;
  boundary?: GeoJsonBoundaryDoc | null;
  boundaryCoordinates: Array<{ lat?: number | null; lng?: number | null }>;
  stats?: {
    totalResidences: number;
    totalDwellings: number;
    occupiedResidences: number;
    vacantResidences: number;
    totalResidentsDeclared: number;
    pendingValidations: number;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GeoOwnerDocument {
  _id: Types.ObjectId;
  organizationId?: Types.ObjectId | null;
  userId?: Types.ObjectId | null;
  fullName: string;
  phone: string;
  email?: string | null;
  blockId: Types.ObjectId;
  neighborhoodId: Types.ObjectId;
  assignedBoundary: GeoJsonBoundaryDoc;
  status: 'ACTIVE' | 'SUSPENDED';
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GeoAuditLogDocument {
  _id: Types.ObjectId;
  entityType: 'NEIGHBORHOOD' | 'BLOCK' | 'OWNER' | 'PROPERTY';
  entityId: string;
  organizationId?: Types.ObjectId | null;
  neighborhoodId?: Types.ObjectId | null;
  blockId?: Types.ObjectId | null;
  ownerId?: Types.ObjectId | null;
  action:
    | 'CREATE_BOUNDARY'
    | 'UPDATE_BOUNDARY'
    | 'REASSIGN_ZONE'
    | 'DEROGATION_GRANTED'
    | 'DEACTIVATE';
  performedBy: Types.ObjectId;
  performedByName?: string | null;
  performedByRole?: string | null;
  previousBoundary?: unknown;
  newBoundary?: unknown;
  justification?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
export interface SectorAssignmentDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  role: 'NEIGHBORHOOD_LEADER' | 'BLOCK_LEADER';
  cityId: Types.ObjectId;
  districtId?: Types.ObjectId | null;
  neighborhoodId: Types.ObjectId;
  blockId?: Types.ObjectId | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'TRANSFERRED';
  assignedBy: Types.ObjectId;
  startDate: Date;
  endDate?: Date | null;
  notes?: string | null;
  history: Array<{
    action: string;
    performedBy: Types.ObjectId;
    date: Date;
    note?: string | null;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuartierResidenceDocument {
  _id: Types.ObjectId;
  residenceDomoraId: string;
  cityId: Types.ObjectId;
  districtId?: Types.ObjectId | null;
  neighborhoodId: Types.ObjectId;
  blockId: Types.ObjectId;
  buildingType: (typeof RESIDENCE_TYPES)[number];
  address: string;
  landmark?: string | null;
  locationGeo?: { lat?: number | null; lng?: number | null } | null;
  dwellingsCount: number;
  occupancyStatus: (typeof RESIDENCE_OCCUPANCY_STATUSES)[number];
  censusStatus: (typeof CENSUS_STATUSES)[number];
  registeredBy?: Types.ObjectId | null;
  registeredRole: 'BLOCK_LEADER' | 'RESIDENT' | 'SUPER_ADMIN';
  validatedBy?: Types.ObjectId | null;
  validatedAt?: Date | null;
  rejectionReason?: string | null;
  ownerName?: string | null;
  ownerPhone?: string | null;
  notes?: string | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuartierDwellingDocument {
  _id: Types.ObjectId;
  residenceId: Types.ObjectId;
  dwellingNumber: string;
  floor?: number | null;
  occupancyStatus: (typeof RESIDENCE_OCCUPANCY_STATUSES)[number];
  roomsCount?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResidentHouseholdDocument {
  _id: Types.ObjectId;
  residenceId: Types.ObjectId;
  dwellingId?: Types.ObjectId | null;
  blockId: Types.ObjectId;
  neighborhoodId: Types.ObjectId;
  headOfHouseholdId?: Types.ObjectId | null;
  fullName: string;
  phone: string;
  email?: string | null;
  householdSize: number;
  minorsCount: number;
  arrivalDate?: Date | null;
  emergencyContact?: { name?: string | null; phone?: string | null } | null;
  consentAccepted: boolean;
  isMovedOut: boolean;
  movedOutDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CensusSubmissionDocument {
  _id: Types.ObjectId;
  residenceId: Types.ObjectId;
  householdId?: Types.ObjectId | null;
  blockId: Types.ObjectId;
  submittedBy: Types.ObjectId;
  submissionType: 'SELF_REGISTRATION' | 'CHEF_REGISTRATION';
  status: 'PENDING' | 'VALIDATED' | 'REJECTED' | 'DISPUTED';
  decisionNote?: string | null;
  reviewedBy?: Types.ObjectId | null;
  reviewedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IncidentReportDocument {
  _id: Types.ObjectId;
  incidentNumber: string;
  category: (typeof INCIDENT_CATEGORIES)[number];
  description: string;
  severity: (typeof INCIDENT_SEVERITIES)[number];
  neighborhoodId: Types.ObjectId;
  blockId?: Types.ObjectId | null;
  locationText?: string | null;
  photoUrl?: string | null;
  isAnonymous: boolean;
  reporterId?: Types.ObjectId | null;
  reporterName?: string | null;
  reporterPhone?: string | null;
  status: (typeof INCIDENT_STATUSES)[number];
  resolutionNotes?: string | null;
  handledBy?: Types.ObjectId | null;
  handledAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommunityAnnouncementDocument {
  _id: Types.ObjectId;
  scope: (typeof ANNOUNCEMENT_SCOPES)[number];
  type: (typeof ANNOUNCEMENT_TYPES)[number];
  title: string;
  message: string;
  neighborhoodId: Types.ObjectId;
  blockId?: Types.ObjectId | null;
  authorId: Types.ObjectId;
  authorRole: 'NEIGHBORHOOD_LEADER' | 'BLOCK_LEADER' | 'SUPER_ADMIN';
  eventDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmergencyContactDocument {
  _id: Types.ObjectId;
  name: string;
  serviceType: string;
  phone: string;
  shortNumber?: string | null;
  cityId?: Types.ObjectId | null;
  districtId?: Types.ObjectId | null;
  neighborhoodId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuartierPlanDocument {
  _id: Types.ObjectId;
  code: (typeof QUARTIER_PLAN_CODES)[number];
  name: string;
  priceMinor: number;
  currency: string;
  durationMonths: number;
  maxBlocks: number;
  maxResidences: number;
  maxSecondaryLeaders: number;
  maxAnnouncementsPerMonth: number;
  advancedReports: boolean;
  interactiveMap: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuartierSubscriptionDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  role: 'NEIGHBORHOOD_LEADER' | 'BLOCK_LEADER';
  planCode: (typeof QUARTIER_PLAN_CODES)[number];
  status: 'ACTIVE' | 'EXPIRED' | 'SUSPENDED';
  period: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  expiresAt: Date;
  paymentsHistory: Array<{
    amountMinor?: number | null;
    currency?: string | null;
    date: Date;
    reference?: string | null;
    method?: string | null;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

function modelOf<T>(name: string, schema: Schema): Model<T> {
  return (models[name] ?? model(name, schema)) as Model<T>;
}

export const GeoCity = modelOf<GeoCityDocument>('GeoCity', geoCitySchema);
export const GeoDistrict = modelOf<GeoDistrictDocument>('GeoDistrict', geoDistrictSchema);
export const GeoNeighborhood = modelOf<GeoNeighborhoodDocument>(
  'GeoNeighborhood',
  geoNeighborhoodSchema,
);
export const GeoBlock = modelOf<GeoBlockDocument>('GeoBlock', geoBlockSchema);
export const GeoOwner = modelOf<GeoOwnerDocument>('GeoOwner', geoOwnerSchema);
export const GeoAuditLog = modelOf<GeoAuditLogDocument>('GeoAuditLog', geoAuditLogSchema);
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
