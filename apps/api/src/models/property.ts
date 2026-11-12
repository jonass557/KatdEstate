import mongoose, { Schema, model, type InferSchemaType, type Model, type Types } from 'mongoose';
const models = mongoose.models;
import { PROPERTY_STATUSES, UNIT_STATUSES, UNIT_TYPES } from '@rentflow/shared';

const timestamps = true;
const org = { type: Schema.Types.ObjectId, ref: 'Organization', required: true } as const;

const photoSchema = new Schema(
  { fileId: { type: Schema.Types.ObjectId, ref: 'StoredFile', required: true } },
  { _id: false },
);

const delegationSubSchema = new Schema(
  {
    managerName: { type: String, trim: true, maxlength: 160 },
    managerEmail: { type: String, trim: true, maxlength: 160 },
    managerPhone: { type: String, trim: true, maxlength: 32 },
    agencyName: { type: String, trim: true, maxlength: 160 },
    scope: { type: String, enum: ['ALL_PORTFOLIO', 'PROPERTY'], default: 'PROPERTY' },
    permissions: { type: [String], default: ['COLLECTION', 'LEASES', 'MAINTENANCE'] },
    commissionRate: { type: Number, default: 0 },
    startDate: { type: Date },
    endDate: { type: Date },
    status: { type: String, enum: ['ACTIVE', 'SUSPENDED', 'REVOKED'], default: 'ACTIVE' },
    notes: { type: String, maxlength: 2_000 },
  },
  { _id: false },
);

const propertySchema = new Schema(
  {
    organizationId: org,
    name: { type: String, required: true, trim: true, maxlength: 160 },
    type: { type: String, default: 'BUILDING', index: true },
    address: { type: String, required: true, trim: true, maxlength: 240 },
    city: { type: String, required: true, trim: true, maxlength: 120 },
    zone: { type: String, trim: true, maxlength: 120 },
    customPropertyType: { type: String, trim: true, maxlength: 120 },
    chambreSimpleCount: { type: Number, default: 0, min: 0 },
    chambreModerneCount: { type: Number, default: 0, min: 0 },
    studioSimpleCount: { type: Number, default: 0, min: 0 },
    studioModerneCount: { type: Number, default: 0, min: 0 },
    appartementCount: { type: Number, default: 0, min: 0 },
    otherCustomType: { type: String, trim: true, maxlength: 120 },
    otherCustomCount: { type: Number, default: 0, min: 0 },
    roomsCount: { type: Number, default: 0, min: 0 },
    studiosCount: { type: Number, default: 0, min: 0 },
    apartmentsCount: { type: Number, default: 0, min: 0 },
    otherUnitsCount: { type: Number, default: 0, min: 0 },
    country: { type: String, required: true, uppercase: true, length: 2 },
    description: { type: String, maxlength: 4_000 },
    status: { type: String, enum: PROPERTY_STATUSES, default: 'ACTIVE', index: true },
    owner: { type: String, maxlength: 160 },
    manager: { type: String, maxlength: 160 },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    geoOwnerId: { type: Schema.Types.ObjectId, ref: 'GeoOwner', index: true },
    neighborhoodId: { type: Schema.Types.ObjectId, ref: 'GeoNeighborhood', index: true },
    blockId: { type: Schema.Types.ObjectId, ref: 'GeoBlock', index: true },
    geoUniqueId: { type: String, trim: true, uppercase: true, maxlength: 64 },
    region: { type: String, trim: true, maxlength: 120 },
    department: { type: String, trim: true, maxlength: 120 },
    arrondissement: { type: String, trim: true, maxlength: 120 },
    neighborhoodName: { type: String, trim: true, maxlength: 120 },
    sectorName: { type: String, trim: true, maxlength: 120 },
    neighborhoodLeaderName: { type: String, trim: true, maxlength: 160 },
    blockLeaderName: { type: String, trim: true, maxlength: 160 },
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 },
    location: {
      type: new Schema(
        {
          type: { type: String, enum: ['Point'], required: true },
          coordinates: { type: [Number], required: true },
        },
        { _id: false },
      ),
    },
    boundary: {
      type: new Schema(
        {
          type: { type: String, enum: ['Polygon', 'MultiPolygon'], required: true },
          coordinates: { type: Schema.Types.Mixed, required: true },
        },
        { _id: false },
      ),
    },
    geoDerogation: {
      type: new Schema(
        {
          granted: { type: Boolean, default: false },
          justification: { type: String, trim: true, maxlength: 500 },
          grantedBy: { type: Schema.Types.ObjectId, ref: 'User' },
          grantedAt: { type: Date },
        },
        { _id: false },
      ),
    },
    delegation: { type: delegationSubSchema },
    acquisitionDate: { type: Date },
    value: { type: Number, min: 0 },
    photos: { type: [photoSchema], default: [] },
    documents: { type: [photoSchema], default: [] },
    deletedAt: { type: Date },
  },
  { timestamps },
);
propertySchema.index({ organizationId: 1, name: 1 }, { name: 'properties_org_name' });
propertySchema.index({ organizationId: 1, city: 1 }, { name: 'properties_org_city' });
propertySchema.index({ organizationId: 1, type: 1 }, { name: 'properties_org_type' });
propertySchema.index({ geoUniqueId: 1 }, { unique: true, sparse: true, name: 'properties_geo_unique_id' });
propertySchema.index({ location: '2dsphere' }, { sparse: true, name: 'properties_location_2dsphere' });
propertySchema.index({ boundary: '2dsphere' }, { sparse: true, name: 'properties_boundary_2dsphere' });

const buildingSchema = new Schema(
  {
    organizationId: org,
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property', required: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    address: { type: String, trim: true, maxlength: 240 },
    floors: { type: Number, min: 0 },
    deletedAt: { type: Date },
  },
  { timestamps },
);
buildingSchema.index({ organizationId: 1, propertyId: 1 }, { name: 'buildings_org_property' });

const unitSchema = new Schema(
  {
    organizationId: org,
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property', required: true },
    buildingId: { type: Schema.Types.ObjectId, ref: 'Building' },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    number: { type: String, trim: true, maxlength: 32 },
    floor: { type: Number },
    type: { type: String, enum: UNIT_TYPES, required: true },
    surfaceM2: { type: Number, min: 0 },
    bedrooms: { type: Number, min: 0 },
    bathrooms: { type: Number, min: 0 },
    rentAmountMinor: { type: Number, required: true, min: 0 },
    chargesAmountMinor: { type: Number, required: true, min: 0, default: 0 },
    depositAmountMinor: { type: Number, required: true, min: 0, default: 0 },
    status: { type: String, enum: UNIT_STATUSES, default: 'AVAILABLE', index: true },
    description: { type: String, maxlength: 4_000 },
    photos: { type: [photoSchema], default: [] },
    documents: { type: [photoSchema], default: [] },
    amenities: { type: [String], default: [] },
    deletedAt: { type: Date },
  },
  { timestamps },
);
unitSchema.index(
  { organizationId: 1, propertyId: 1, status: 1 },
  { name: 'units_org_property_status' },
);
unitSchema.index({ organizationId: 1, type: 1 }, { name: 'units_org_type' });

export type PropertyDocument = InferSchemaType<typeof propertySchema> & { _id: Types.ObjectId };
export type BuildingDocument = InferSchemaType<typeof buildingSchema> & { _id: Types.ObjectId };
export type UnitDocument = InferSchemaType<typeof unitSchema> & { _id: Types.ObjectId };

export const Property =
  (models.Property as Model<PropertyDocument>) ??
  model<PropertyDocument>('Property', propertySchema);
export const Building =
  (models.Building as Model<BuildingDocument>) ??
  model<BuildingDocument>('Building', buildingSchema);
export const Unit = (models.Unit as Model<UnitDocument>) ?? model<UnitDocument>('Unit', unitSchema);
